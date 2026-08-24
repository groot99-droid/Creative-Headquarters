/* ============================================================================
   router.js — Studio Headless OS · Logic Bridge (Core File 4/4)
   Responsibilities:
     1. Fetch dashboard.json on load + poll interval
     2. Render every panel of control_room.html from that single state object
     3. Expose placeholder routing functions for skill/API dispatch
   ============================================================================ */

"use strict";

const CONFIG = {
  DASHBOARD_URL: "dashboard.json",
  POLL_MS: 5000,          // live refresh cadence
  LOG_LIMIT: 40,
};

let STATE = null;          // last successfully parsed dashboard.json
let LOCAL_EVENTS = [];     // UI-originated events; the poll replaces STATE, so these live outside it

/* ─────────────────────────── 1. DATA LAYER ─────────────────────────── */

async function fetchDashboard() {
  try {
    const res = await fetch(`${CONFIG.DASHBOARD_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    STATE = await res.json();
    document.body.classList.remove("offline");
    renderAll(STATE);
  } catch (err) {
    console.warn("[router] dashboard.json fetch failed:", err.message);
    document.body.classList.add("offline");
    if (STATE) renderAll(STATE); // keep last known state on screen
  }
}

/* ─────────────────────────── 2. RENDER LAYER ─────────────────────────── */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "—").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function renderAll(d) {
  renderHeader(d);
  renderPipeline(d.pipeline);
  renderVariables(d.active_variables);
  renderHardware(d.hardware);
  renderLog(d.event_log);
  renderSkills(d.registries?.skills);
  renderContext(d);
}

function renderHeader(d) {
  const s = d.system_status || {};
  $("sys-state").textContent = s.state || "UNKNOWN";
  $("sys-mode").textContent = s.mode || "—";
  $("sys-skill").textContent = s.active_skill || "idle";
  $("sys-project").textContent = d.pipeline?.project || "—";
  $("heartbeat").textContent = `heartbeat ${formatTime(s.last_heartbeat)}`;

  const lamp = $("lamp");
  lamp.className = "lamp";
  if (s.state === "DEGRADED") lamp.classList.add("warn");
  if (s.state === "BLOCKED" || s.state === "OFFLINE") lamp.classList.add("alert");
}

function renderPipeline(p) {
  if (!p || !Array.isArray(p.phases)) return;
  const rail = $("rail");
  rail.innerHTML = "";
  $("phase-count").textContent =
    `${p.phases.filter(x => x.status === "complete").length}/${p.phases.length} complete`;

  for (const ph of p.phases) {
    const el = document.createElement("div");
    el.className = `station s-${ph.status}`;
    el.innerHTML = `
      <div class="node" title="${esc(ph.id)}"></div>
      <div class="name">${esc(ph.label)}</div>
      <div class="meta">${esc(ph.skill)}</div>
      <div class="meta status-word ${statusColor(ph.status)}">${esc(String(ph.status ?? "").replace(/_/g, " "))}</div>
      <div class="bar"><i style="width:${Number(ph.progress_pct) || 0}%"></i></div>`;
    rail.appendChild(el);
  }
}

function statusColor(status) {
  // Projection of design_tokens.json -> semantic.* (css_html_ui ARTIFACT C).
  // status.idle is color.accent.queued, NOT ink.dim — c-dim is only the unknown-status fallback.
  return { complete: "c-cyan", in_progress: "c-cyan", compositing: "c-cyan",
           awaiting_render: "c-amber", review: "c-amber",
           blocked: "c-alert", queued: "c-queued" }[status] || "c-dim";
}

function renderVariables(v) {
  if (!v) return;
  const box = $("vars");
  box.innerHTML = "";
  for (const [key, val] of Object.entries(v)) {
    if (key.endsWith("_prev")) continue; // legacy key shape; active_variables is run-scoped now (DECISIONS.md D6)
    const k = document.createElement("div"); k.className = "k"; k.textContent = key.replace(/_/g, " ");
    const vEl = document.createElement("div"); vEl.className = "v";
    if (key === "master_palette" && Array.isArray(val)) {
      // Only literal hex reaches a style attribute; anything else renders as plain text
      // (esc() escapes HTML, not CSS — `background:` is a different injection surface).
      vEl.innerHTML = `<span class="swatches">${val.map(h =>
        /^#[0-9a-fA-F]{3,8}$/.test(String(h))
          ? `<span style="background:${h}" title="${esc(h)}"></span>`
          : `<span class="c-alert" title="not a hex color">${esc(h)}</span>`).join("")}</span>`;
    } else {
      if (Array.isArray(val)) {
        vEl.textContent = val.length ? val.join(", ") : "—";
      } else if (val === null || val === undefined) {
        vEl.textContent = "—";           // e.g. content_md before a note exists
      } else {
        vEl.textContent = val;
      }
    }
    box.append(k, vEl);
  }
}

function renderHardware(h) {
  if (!h) return;
  $("hw-host").textContent = h.host || "";

  // schema 2.0 is single-host: hardware.egpu / hardware.compute_node are gone, because
  // the CUDA node is gone. Old files are still rendered rather than blanked — a stale
  // dashboard should look stale, not broken.
  const legacyNode = h.compute_node || h.egpu;
  const gpu = h.gpu || {};
  const llm = h.local_llm || {};
  const power = h.power || {};
  const thermal = h.thermal || {};

  const tier = llm.loaded_tier ? (llm.tiers || {})[llm.loaded_tier] : null;
  const ctxTokens = tier?.context_window_tokens ?? llm.context_window_tokens ?? 0;
  const ctxPct = clampPct(llm.context_used_pct);

  // Memory: prefer measured available_gb from the last probe. memory_pressure is a
  // coarse enum and only stands in when no probe has run — projecting it to a fill is
  // an indication, not a measurement, so the label says which one you are looking at.
  const totalGb = h.memory_gb ?? h.unified_memory_gb;
  const availGb = h.memory_available_gb;
  const measured = typeof availGb === "number" && totalGb > 0;
  const memPct = measured
    ? clampPct(Math.round(((totalGb - availGb) / totalGb) * 100))
    : ({ green: 30, yellow: 65, red: 90 }[h.memory_pressure] ?? 0);
  const memDetail = measured
    ? `${(totalGb - availGb).toFixed(0)} / ${totalGb} GB used`
    : `${h.memory_pressure ?? "—"} · ${totalGb ?? "—"} GB total (unprobed)`;

  // Performance headroom, not utilisation: 100% is a machine running at nominal clock,
  // and a low fill here is the throttling that denies render_3d_cpu.
  const perf = thermal.cpu_perf_pct;
  const perfKnown = typeof perf === "number";

  $("hw-meters").innerHTML = `
    ${meter("Memory", memDetail, memPct)}
    ${meter("CPU throttling",
            perfKnown ? `${perf}% of nominal clock` : "unreadable — gate closed",
            perfKnown ? 100 - clampPct(perf) : 100)}
    ${meter("LLM context window",
            `${ctxPct}% of ${(ctxTokens / 1024).toFixed(0)}k tokens`, ctxPct)}`;

  const onAc = power.source === "ac";
  const powerHtml = power.source
    ? `<span class="${onAc ? "c-cyan" : "c-amber"}">${esc(power.source)}</span>` +
      (typeof power.battery_pct === "number" ? ` · ${power.battery_pct}%` : "")
    : `<span class="c-alert">unreadable</span>`;

  const thermalHtml = [
    typeof thermal.cpu_temp_c === "number" ? `${thermal.cpu_temp_c} °C` : null,
    perfKnown ? `${perf}% perf` : null,
  ].filter(Boolean).join(" · ") || `<span class="c-alert">no readable sensor</span>`;

  $("hw-facts").innerHTML = `
    ${kv("Host", `${esc(h.host)} · ${esc(h.host_os ?? "—")} · ${esc(h.host_kind ?? "—")}`)}
    ${kv("Graphics", `${esc(gpu.name ?? "—")} · ${esc(gpu.status ?? "—")}${gpu.cuda === false ? " · no CUDA" : ""}`)}
    ${kv("Power", powerHtml)}
    ${kv("Thermal", thermalHtml)}
    ${kv("Memory", `${esc(totalGb)} GB${h.memory_soldered ? " soldered" : ""} · pressure ${esc(h.memory_pressure)}`)}
    ${kv("Local model", tier
        ? `${esc(tier.model)} (${esc(tier.quantization)}) · tier ${esc(llm.loaded_tier)}`
        : `<span class="c-dim">none resident</span>`)}
    ${kv("Endpoint", esc(llm.endpoint))}
    ${legacyNode ? kv("Legacy compute node",
        `<span class="c-amber">declared, but schema 2.0 is single-host</span>`) : ""}`;
}

const clampPct = (n) => Math.max(0, Math.min(100, Number(n) || 0));

const meter = (label, detail, pct) => `
  <div class="meter ${pct > 80 ? "warn" : ""}">
    <div class="row"><span>${esc(label)}</span><span>${esc(detail)}</span></div>
    <div class="track"><i style="width:${clampPct(pct)}%"></i></div>
  </div>`;

const kv = (k, vHtml) => `<div class="k">${esc(k)}</div><div class="v">${vHtml}</div>`;

function renderLog(events = []) {
  // LOCAL_EVENTS lives outside STATE so a poll (which replaces STATE wholesale)
  // cannot silently erase UI-originated entries a few seconds after they appear.
  const merged = [...LOCAL_EVENTS, ...(Array.isArray(events) ? events : [])]
    .sort((a, b) => String(b.ts ?? "").localeCompare(String(a.ts ?? "")));

  $("log").innerHTML = merged.slice(0, CONFIG.LOG_LIMIT).map(e => {
    const name = String(e.event ?? "EVENT");
    const bad = name.includes("VIOLATION") || name.includes("ERROR") || name.includes("FAIL");
    return `
    <li>
      <span class="ev ${bad ? "c-alert" : "c-cyan"}">${esc(name)}</span>
      <span class="ts">${formatTime(e.ts)} · ${esc(e.actor)}</span>
      <span class="dt">${esc(e.detail)}</span>
    </li>`;
  }).join("");
}

function renderSkills(skills = []) {
  const box = $("skills");
  const list = Array.isArray(skills) ? skills : [];
  box.innerHTML = "";
  $("skill-count").textContent = `${list.length} executable${list.length === 1 ? "" : "s"}`;
  for (const s of list) {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.type = "button";
    chip.dataset.status = s.status === "ready" ? "ready" : s.status;
    chip.innerHTML = `<span class="dot"></span>${esc(s.file)} <span class="c-dim">· ${esc(s.domain)}</span>`;
    chip.addEventListener("click", () => routeSkill(s.file));
    box.appendChild(chip);
  }
}

/* Router.md §4 requires the attestation to be visible to the operator, not just
   asserted in chat. This panel is that readout. */
function renderContext(d) {
  const gates = d.registries?.context_brand_gates ?? [];
  const loaded = new Set(d.system_status?.context_loaded ?? []);
  const violations = d.system_status?.intercept_violations_24h ?? 0;
  const missing = gates.filter(g => !g.authored).length;

  $("ctx-violations").innerHTML = missing > 0
    ? `<span class="c-alert">${esc(missing)} of ${gates.length} unresolved at L0</span>`
    : (violations > 0
        ? `<span class="c-alert">${esc(violations)} intercept violation${violations === 1 ? "" : "s"} / 24h</span>`
        : `<span class="c-cyan">all gates authored (L0) · 0 violations / 24h</span>`);

  $("ctx-list").innerHTML = gates.map(g => {
    const on = g.authored && loaded.has(g.role);
    const cls = g.authored ? (on ? "on" : "") : "missing";
    return `<div class="ctx-row ${cls}">
      <span class="dot"></span>
      <span class="f">${esc(brandPath(g.role))}</span>
      <span class="r c-dim">${g.authored ? esc((g.gates_skills ?? []).join(", ")) : "not authored — §5 ladder, L3 parks"}</span>
    </div>`;
  }).join("");
}

function formatTime(iso) {
  if (!iso) return "—";
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? "—" : t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/* ─────────────── 3. ROUTING LAYER (placeholder API bridge) ───────────────
   These stubs are the seam where the headless agent / local services attach.
   Each mirrors the Router.md intercept: resolve context → verify → dispatch. */

async function routeSkill(skillFile) {
  console.info(`[router] intercept engaged → ${skillFile}`);
  const gates = resolveGates(skillFile);
  const paths = gates.map(brandPath);

  // Router.md §5: an authored brand file is L0. Anything below that (L1 recall from the
  // vault, L2 derivation across Content MDs) needs vault access this page does not have,
  // so the UI reports L0 only and defers the ladder to the agent. Gates that are not
  // authored are shown as unresolved-at-L0 — never silently satisfied by a
  // context/domain/ library, which §3 forbids outright.
  const unresolved = gates.filter(g => !isAuthoredL0(g));
  if (unresolved.length) {
    logLocal("PARKED", `${skillFile} → not resolved at L0: ${unresolved.join(", ")} ` +
                       `(agent must descend §5 ladder; L3 parks in every mode)`);
    console.warn(`[router] unresolved at L0:`, unresolved.map(brandPath));
    return { ok: false, parked: true, unresolvedAtL0: unresolved.map(brandPath) };
  }

  console.info(`[router] all gates authored (L0):`, paths);
  // TODO: POST to local agent runner, e.g.
  // await dispatchAPICall("agent", "/route", { skill: skillFile, gates, paths });
  logLocal("INTERCEPT", `UI-initiated route → ${skillFile} · L0 context: ${paths.join(", ")} (stub)`);
  return { ok: true, skill: skillFile, gates, paths };
}

/* Skill → mandatory context. Mirror of Router.md §3. */
function resolveGates(skillFile) {
  const table = {
    "skills/higgsfield_api.skill.md":          ["motion_language", "narrative_continuity", "visual_identity"],
    "skills/suno_audio.skill.md":              ["sound_identity", "brand_voice"],
    "skills/adobe_firefly.skill.md":           ["visual_identity", "color_science"],
    "skills/adobe_suite_uxp.skill.md":         ["render_philosophy", "color_science"],
    "skills/blender_python.skill.md":          ["render_philosophy", "motion_language"],
    "skills/css_html_ui.skill.md":             ["typography_system", "visual_identity", "brand_voice"],
    "skills/local_rag_orchestration.skill.md": ["memory_discipline"],
    "skills/hardware_compute.skill.md":        ["pipeline_ethics", "render_philosophy"],
  };
  return table[skillFile] || [];
}

/* Router.md §3/§5 L0 path — a gate is always context/brand/<name>.context.md. */
const brandPath = (role) => `context/brand/${role}.context.md`;

/* Authored state lives in dashboard.json so the UI reflects reality rather than a
   second hard-coded list. Unknown role → not authored → parked (fail closed). */
function isAuthoredL0(role) {
  const gates = STATE?.registries?.context_brand_gates ?? [];
  return gates.some(g => g.role === role && g.authored === true);
}

async function dispatchAPICall(service, endpoint, payload) {
  /* Placeholder unified dispatcher.
     service ∈ { "higgsfield", "suno", "firefly", "adobe_uxp", "blender", "deepseek", "agent" } */
  const registry = {
    higgsfield: "https://platform.higgsfield.ai",   // via MCP in production
    deepseek:   "http://localhost:11434/api/generate",
    agent:      "http://localhost:8787",            // local agent runner (stub)
  };
  const base = registry[service];
  console.info(`[router] dispatch (stub) → ${service}${endpoint}`, payload);
  if (!base) return { ok: false, error: `unregistered service: ${service}` };
  // TODO(agent): implement fetch with auth headers per skill file §3 artifacts
  return { ok: true, stub: true, would_call: base + endpoint };
}

async function writeDashboard(patch) {
  /* Placeholder writeback. Browsers cannot write local files directly;
     the headless agent owns dashboard.json. This posts a patch request. */
  console.info("[router] writeback (stub):", patch);
  // TODO: await dispatchAPICall("agent", "/dashboard/patch", patch);
}

function logLocal(event, detail) {
  LOCAL_EVENTS.unshift({ ts: new Date().toISOString(), actor: "control_room", event, detail });
  LOCAL_EVENTS = LOCAL_EVENTS.slice(0, CONFIG.LOG_LIMIT);
  renderLog(STATE?.event_log ?? []);   // works before the first successful fetch too
}

/* ─────────────────────────── 4. BOOT ─────────────────────────── */

let POLL_TIMER = null;

function startPolling() {
  if (POLL_TIMER === null) POLL_TIMER = setInterval(fetchDashboard, CONFIG.POLL_MS);
}
function stopPolling() {
  if (POLL_TIMER !== null) { clearInterval(POLL_TIMER); POLL_TIMER = null; }
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) return stopPolling();
  fetchDashboard();   // catch up immediately on return, then resume the cadence
  startPolling();
});

fetchDashboard();
startPolling();
