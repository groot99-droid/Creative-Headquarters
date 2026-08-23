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
    if (key.endsWith("_prev")) continue; // superseded continuity values stay in JSON, not UI
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
      vEl.textContent = Array.isArray(val) ? val.join(", ") : val;
    }
    box.append(k, vEl);
  }
}

function renderHardware(h) {
  if (!h) return;
  $("hw-host").textContent = h.host || "";

  // schema 1.1 renamed hardware.egpu -> hardware.compute_node (it is a LAN CUDA box,
  // not a Thunderbolt eGPU — Apple silicon has no eGPU support). Fall back for old files.
  const node = h.compute_node || h.egpu || {};
  const llm = h.local_llm || {};
  const vramPct = node.vram_gb > 0 ? Math.round((node.vram_used_gb / node.vram_gb) * 100) : 0;
  const ctxPct = clampPct(llm.context_used_pct);
  // memory_pressure is a coarse enum (green/yellow/red), not a byte count —
  // project it to an indicative meter fill rather than pretending we have exact free/used GB.
  const pressurePct = { green: 30, yellow: 65, red: 90 }[h.memory_pressure] ?? 0;

  $("hw-meters").innerHTML = `
    ${meter("Compute node VRAM", `${node.vram_used_gb ?? 0} / ${node.vram_gb ?? 0} GB`, vramPct)}
    ${meter("Unified memory pressure", `${h.memory_pressure ?? "—"} · ${h.unified_memory_gb ?? "—"} GB total`, pressurePct)}
    ${meter("LLM context window", `${ctxPct}% of ${((llm.context_window_tokens ?? 0) / 1024).toFixed(0)}k tokens`, ctxPct)}`;

  const nodeOk = node.status === "attached";
  const thermalOk = node.thermal === "nominal";
  $("hw-facts").innerHTML = `
    ${kv("Host", `${esc(h.host)} · ${esc(h.host_os ?? "—")}`)}
    ${kv("Compute node", `<span class="${nodeOk ? "c-cyan" : "c-alert"}">${esc(node.status)}</span> · ${esc(node.model)}`)}
    ${kv("Node GPU", `${esc(node.gpu ?? "—")} · ${esc(node.os ?? "—")}`)}
    ${kv("Node thermal", `<span class="${thermalOk ? "c-cyan" : "c-amber"}">${esc(node.thermal)}</span>`)}
    ${kv("Unified memory", `${esc(h.unified_memory_gb)} GB · pressure ${esc(h.memory_pressure)}`)}
    ${kv("Local model", `${esc(llm.model)} (${esc(llm.quantization)})`)}
    ${kv("Endpoint", esc(llm.endpoint))}`;
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
  const loaded = d.system_status?.context_loaded ?? [];
  const files = d.registries?.context_files ?? [];
  const violations = d.system_status?.intercept_violations_24h ?? 0;

  $("ctx-violations").innerHTML = violations > 0
    ? `<span class="c-alert">${esc(violations)} intercept violation${violations === 1 ? "" : "s"} / 24h</span>`
    : `<span class="c-cyan">0 violations / 24h</span>`;

  const loadedFiles = new Set(resolveContext(null, loaded));
  $("ctx-list").innerHTML = files.map(f => {
    const on = loadedFiles.has(f.file);
    return `<div class="ctx-row ${on ? "on" : ""}">
      <span class="dot"></span>
      <span class="f">${esc(f.file)}</span>
      <span class="r c-dim">${esc((f.roles ?? []).join(", "))}</span>
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
  const roles = resolveRoles(skillFile);
  const files = resolveContext(skillFile, roles);

  // Router.md §7: the Router never invents context. If a mapped role resolves to
  // nothing, that is a BLOCKED route, not a route with less context.
  const unbound = roles.filter(r => contextRoleMap()[r] === undefined);
  if (unbound.length) {
    logLocal("ROUTE_BLOCKED", `${skillFile} → unbound context roles: ${unbound.join(", ")}`);
    console.error(`[router] unbound context roles for ${skillFile}:`, unbound);
    return { ok: false, blocked: true, unbound };
  }

  console.info(`[router] roles: ${roles.join(", ")} → files:`, files);
  // TODO: POST to local agent runner, e.g.
  // await dispatchAPICall("agent", "/route", { skill: skillFile, roles, files });
  logLocal("INTERCEPT", `UI-initiated route → ${skillFile} · context: ${files.join(", ")} (stub)`);
  return { ok: true, skill: skillFile, roles, files };
}

/* Skill → mandatory context ROLES. Mirror of Router.md §3.
   Roles are abstract; they only become files through the binding map below. */
function resolveRoles(skillFile) {
  const table = {
    "higgsfield_api.skill.md":          ["motion_language", "narrative_continuity", "visual_identity"],
    "suno_audio.skill.md":              ["sound_identity", "brand_voice"],
    "adobe_firefly.skill.md":           ["visual_identity", "color_science"],
    "adobe_suite_uxp.skill.md":         ["render_philosophy", "color_science", "system_fabric"],
    "blender_python.skill.md":          ["render_philosophy", "motion_language"],
    "css_html_ui.skill.md":             ["typography_system", "visual_identity", "brand_voice", "system_fabric"],
    "local_rag_orchestration.skill.md": ["memory_discipline"],
    "hardware_compute.skill.md":        ["pipeline_ethics", "render_philosophy"],
  };
  return table[skillFile] || [];
}

/* The role → real-file binding lives in dashboard.json (registries.context_roles),
   so the protocol has exactly one source of truth. The literal below is only a
   cold-start fallback for when the dashboard has not been fetched yet. */
function contextRoleMap() {
  return STATE?.registries?.context_roles ?? {
    visual_identity:      ["classical_illustration_context.md"],
    motion_language:      ["cinematic_videography_context.md"],
    sound_identity:       ["music_ambience_context.md"],
    narrative_continuity: ["creative_analytical_writing_context.md", "world_building_context.md"],
    color_science:        ["classical_illustration_context.md", "cinematic_videography_context.md"],
    typography_system:    ["typography_ad_arts_context.md"],
    render_philosophy:    ["digital_3d_motion_context.md"],
    brand_voice:          ["social_media_marketing_context.md"],
    system_fabric:        ["multimedia_fusion_context.md"],
    pipeline_ethics:      ["ai_creative_strategies_context.md"],
    memory_discipline:    ["ai_creative_strategies_context.md"],
  };
}

/* Resolve roles to a deduplicated list of real files on disk.
   Pass skillFile=null to resolve an explicit role list (used by the context panel). */
function resolveContext(skillFile, roles = null) {
  const map = contextRoleMap();
  const wanted = roles ?? resolveRoles(skillFile);
  return [...new Set(wanted.flatMap(r => map[r] ?? []))];
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
