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
  if (!p) return;
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
      <div class="meta status-word ${statusColor(ph.status)}">${esc(ph.status.replace("_", " "))}</div>
      <div class="bar"><i style="width:${Number(ph.progress_pct) || 0}%"></i></div>`;
    rail.appendChild(el);
  }
}

function statusColor(status) {
  return { complete: "c-cyan", in_progress: "c-cyan", compositing: "c-cyan",
           awaiting_render: "c-amber", review: "c-amber",
           blocked: "c-alert", queued: "c-dim" }[status] || "c-dim";
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
      vEl.innerHTML = `<span class="swatches">${val.map(h =>
        `<span style="background:${esc(h)}" title="${esc(h)}"></span>`).join("")}</span>`;
    } else {
      vEl.textContent = Array.isArray(val) ? val.join(", ") : val;
    }
    box.append(k, vEl);
  }
}

function renderHardware(h) {
  if (!h) return;
  $("hw-host").textContent = h.host || "";

  const egpu = h.egpu || {};
  const llm = h.local_llm || {};
  const vramPct = egpu.vram_gb > 0 ? Math.round((egpu.vram_used_gb / egpu.vram_gb) * 100) : 0;
  const ctxPct = llm.context_used_pct ?? 0;
  // memory_pressure is a coarse enum (green/yellow/red), not a byte count —
  // project it to an indicative meter fill rather than pretending we have exact free/used GB.
  const pressurePct = { green: 30, yellow: 65, red: 90 }[h.memory_pressure] ?? 0;

  $("hw-meters").innerHTML = `
    ${meter("eGPU VRAM", `${egpu.vram_used_gb ?? 0} / ${egpu.vram_gb ?? 0} GB`, vramPct)}
    ${meter("Unified memory pressure", `${esc(h.memory_pressure ?? "—")} · ${esc(h.unified_memory_gb ?? "—")} GB total`, pressurePct)}
    ${meter("LLM context window", `${ctxPct}% of ${((llm.context_window_tokens ?? 0) / 1024).toFixed(0)}k tokens`, ctxPct)}`;

  const egpuOk = egpu.status === "attached";
  const thermalOk = egpu.thermal === "nominal";
  $("hw-facts").innerHTML = `
    ${kv("eGPU", `<span class="${egpuOk ? "c-cyan" : "c-alert"}">${esc(egpu.status)}</span> · ${esc(egpu.model)}`)}
    ${kv("eGPU thermal", `<span class="${thermalOk ? "c-cyan" : "c-amber"}">${esc(egpu.thermal)}</span>`)}
    ${kv("Unified memory", `${esc(h.unified_memory_gb)} GB · pressure ${esc(h.memory_pressure)}`)}
    ${kv("Local model", `${esc(llm.model)} (${esc(llm.quantization)})`)}
    ${kv("Endpoint", esc(llm.endpoint))}`;
}

const meter = (label, detail, pct) => `
  <div class="meter ${pct > 80 ? "warn" : ""}">
    <div class="row"><span>${esc(label)}</span><span>${esc(detail)}</span></div>
    <div class="track"><i style="width:${Math.min(100, pct)}%"></i></div>
  </div>`;

const kv = (k, vHtml) => `<div class="k">${esc(k)}</div><div class="v">${vHtml}</div>`;

function renderLog(events = []) {
  $("log").innerHTML = events.slice(0, CONFIG.LOG_LIMIT).map(e => `
    <li>
      <span class="ev ${e.event.includes("VIOLATION") || e.event.includes("ERROR") ? "c-alert" : "c-cyan"}">${esc(e.event)}</span>
      <span class="ts">${formatTime(e.ts)} · ${esc(e.actor)}</span>
      <span class="dt">${esc(e.detail)}</span>
    </li>`).join("");
}

function renderSkills(skills = []) {
  const box = $("skills");
  box.innerHTML = "";
  for (const s of skills) {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.type = "button";
    chip.dataset.status = s.status === "ready" ? "ready" : s.status;
    chip.innerHTML = `<span class="dot"></span>${esc(s.file)} <span class="c-dim">· ${esc(s.domain)}</span>`;
    chip.addEventListener("click", () => routeSkill(s.file));
    box.appendChild(chip);
  }
}

function formatTime(iso) {
  if (!iso) return "—";
  const t = new Date(iso);
  return isNaN(t) ? "—" : t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/* ─────────────── 3. ROUTING LAYER (placeholder API bridge) ───────────────
   These stubs are the seam where the headless agent / local services attach.
   Each mirrors the Router.md intercept: resolve context → verify → dispatch. */

async function routeSkill(skillFile) {
  console.info(`[router] intercept engaged → ${skillFile}`);
  const context = resolveContext(skillFile);
  console.info(`[router] mandatory context:`, context);
  // TODO: POST to local agent runner, e.g.
  // await dispatchAPICall("agent", "/route", { skill: skillFile, context });
  logLocal("INTERCEPT", `UI-initiated route → ${skillFile} (stub)`);
}

function resolveContext(skillFile) {
  // Mirror of Router.md §3 routing table
  const table = {
    "higgsfield_api.skill.md":          ["motion_language", "narrative_continuity", "visual_identity"],
    "suno_audio.skill.md":              ["sound_identity", "brand_voice"],
    "adobe_firefly.skill.md":           ["visual_identity", "color_science"],
    "adobe_suite_uxp.skill.md":         ["render_philosophy", "color_science"],
    "blender_python.skill.md":          ["render_philosophy", "motion_language"],
    "css_html_ui.skill.md":             ["typography_system", "visual_identity", "brand_voice"],
    "local_rag_orchestration.skill.md": ["memory_discipline"],
    "hardware_compute.skill.md":        ["pipeline_ethics", "render_philosophy"],
  };
  return table[skillFile] || [];
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
  if (!STATE) return;
  STATE.event_log.unshift({ ts: new Date().toISOString(), actor: "control_room", event, detail });
  renderLog(STATE.event_log);
}

/* ─────────────────────────── 4. BOOT ─────────────────────────── */

fetchDashboard();
setInterval(fetchDashboard, CONFIG.POLL_MS);
