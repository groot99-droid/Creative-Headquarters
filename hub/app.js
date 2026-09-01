/* app.js -- UI wiring for the hub: tabs, library cards, the Ask chat, and
 * the static (unwired) pipeline preview. Ollama/RAG mechanics live in
 * ollama.js; this file is DOM only. */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

  let tiers = HubOllama.DEFAULT_TIERS;
  let embedModel = HubOllama.DEFAULT_EMBED_MODEL;
  let manifestNotes = [];
  let indexState = { embedModel, chunks: [] };

  // ── bootstrap ────────────────────────────────────────────────────────────

  if (location.protocol === "file:") document.body.classList.add("offline");

  fetch("../dashboard.json").then((r) => r.ok ? r.json() : null).then((d) => {
    const llm = d && d.hardware && d.hardware.local_llm;
    if (!llm) return;
    if (llm.tiers) {
      tiers = {
        sm: { ...HubOllama.DEFAULT_TIERS.sm, model: llm.tiers.sm?.model || HubOllama.DEFAULT_TIERS.sm.model,
              num_ctx: llm.tiers.sm?.context_window_tokens || HubOllama.DEFAULT_TIERS.sm.num_ctx },
        md: { ...HubOllama.DEFAULT_TIERS.md, model: llm.tiers.md?.model || HubOllama.DEFAULT_TIERS.md.model,
              num_ctx: llm.tiers.md?.context_window_tokens || HubOllama.DEFAULT_TIERS.md.num_ctx },
      };
    }
    if (llm.embed_model) embedModel = llm.embed_model;
    if (llm.endpoint && !localStorage.getItem("hub:endpoint")) HubOllama.setEndpoint(llm.endpoint);
  }).catch(() => {}).finally(refreshConnDot);

  // ── tabs ─────────────────────────────────────────────────────────────────

  function showTab(name) {
    $all(".tab").forEach((b) => {
      if (b.dataset.tab === name) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    $all(".panel-view").forEach((s) => { s.hidden = s.id !== `view-${name}`; });
    localStorage.setItem("hub:tab", name);
    if (name === "library" && !manifestNotes.length) loadManifest();
    if (name === "ask" && !$("#chatLog").dataset.inited) initAsk();
  }

  $("#tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (btn) showTab(btn.dataset.tab);
  });
  showTab(localStorage.getItem("hub:tab") || "library");

  // ── settings dialog ─────────────────────────────────────────────────────

  const dialog = $("#settingsDialog");
  $("#settingsBtn").addEventListener("click", () => {
    $("#endpointInput").value = HubOllama.getEndpoint();
    $("#tierSelect").value = localStorage.getItem("hub:tier") || "sm";
    $("#testConnResult").textContent = "";
    dialog.showModal();
  });
  $("#endpointInput").addEventListener("change", (e) => {
    HubOllama.setEndpoint(e.target.value.trim() || HubOllama.DEFAULT_ENDPOINT);
    refreshConnDot();
  });
  $("#tierSelect").addEventListener("change", (e) => {
    localStorage.setItem("hub:tier", e.target.value);
  });
  $("#testConnBtn").addEventListener("click", async () => {
    const out = $("#testConnResult");
    out.textContent = "checking…";
    try {
      const served = await HubOllama.fetchTags(HubOllama.getEndpoint());
      out.textContent = served.length ? `reachable — ${served.join(", ")}` : "reachable — no models pulled";
    } catch (err) {
      out.textContent = `unreachable — ${err.message}`;
    }
    refreshConnDot();
  });
  $("#evictBtn").addEventListener("click", async () => {
    const endpoint = HubOllama.getEndpoint();
    const tier = tiers[localStorage.getItem("hub:tier") || "sm"];
    await Promise.all([HubOllama.evict(endpoint, tier.model), HubOllama.evict(endpoint, embedModel)]);
    $("#testConnResult").textContent = "evicted";
  });

  async function refreshConnDot() {
    const dot = $("#connDot"), label = $("#connLabel");
    try {
      const served = await HubOllama.fetchTags(HubOllama.getEndpoint());
      dot.className = "dot on";
      const tier = tiers[localStorage.getItem("hub:tier") || "sm"];
      const ok = HubOllama.familyMatches(tier.model, served);
      label.textContent = ok ? `Ollama — ${tier.model}` : `Ollama — ${tier.model} not pulled`;
    } catch (_) {
      dot.className = "dot off";
      label.textContent = "Ollama — unreachable";
    }
  }
  refreshConnDot();

  // ── library ──────────────────────────────────────────────────────────────

  async function loadManifest() {
    const grid = $("#libraryGrid"), empty = $("#libraryEmpty");
    grid.innerHTML = `<p class="hint">Loading manifest…</p>`;
    try {
      const r = await fetch("../state/vault_manifest.json");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      manifestNotes = data.notes || [];
      const vaultLabel = $("#libraryVaultName");
      if (vaultLabel) vaultLabel.textContent = (data.vault || "").split(/[\\/]/).filter(Boolean).pop() || "?";
    } catch (err) {
      grid.innerHTML = "";
      empty.hidden = false;
      empty.innerHTML = `Could not load <code>state/vault_manifest.json</code> (${esc(err.message)}). ` +
        `Run <code>python3 tools/vault_manifest.py --vault &lt;path&gt;</code> from the repo root, then Refresh.`;
      return;
    }
    populateLibraryFilters();
    renderLibrary();
  }

  function populateLibraryFilters() {
    const kinds = [...new Set(manifestNotes.map((n) => n.kind).filter(Boolean))].sort();
    const statuses = [...new Set(manifestNotes.map((n) => n.status).filter(Boolean))].sort();
    const fillSelect = (sel, values) => {
      const el = $(sel);
      const current = el.value;
      el.innerHTML = el.querySelector('option[value=""]').outerHTML +
        values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
      el.value = current;
    };
    fillSelect("#libraryKind", kinds);
    fillSelect("#libraryStatus", statuses);
  }

  function renderLibrary() {
    const q = $("#librarySearch").value.trim().toLowerCase();
    const kind = $("#libraryKind").value;
    const status = $("#libraryStatus").value;
    const sort = $("#librarySort").value;
    const empty = $("#libraryEmpty"), grid = $("#libraryGrid");

    let list = manifestNotes.filter((n) => {
      if (kind && n.kind !== kind) return false;
      if (status && n.status !== status) return false;
      if (!q) return true;
      const hay = [n.title, n.project, ...(n.tags || [])].join(" ").toLowerCase();
      return hay.includes(q);
    });
    list = list.slice().sort((a, b) =>
      sort === "title" ? a.title.localeCompare(b.title) : (b.updated || "").localeCompare(a.updated || ""));

    if (!list.length) {
      grid.innerHTML = "";
      empty.hidden = false;
      empty.textContent = manifestNotes.length
        ? "No notes match this filter."
        : "The indexed vault has no notes in it yet. Run tools/vault_manifest.py --vault <path> " +
          "against the vault you want to browse, then refresh.";
      return;
    }
    empty.hidden = true;
    grid.innerHTML = list.map(cardHtml).join("");
  }

  function cardHtml(n) {
    const cachedAi = localStorage.getItem(`hub:overview:${n.content_hash}`);
    return `
      <article class="card" data-hash="${esc(n.content_hash)}" data-path="${esc(n.path)}">
        <div class="card-head">
          <div>
            <div class="card-title">${esc(n.title)}</div>
            <div class="card-meta">
              <span class="pill">${esc(n.kind)}</span>
              ${n.status ? `<span class="pill status-${esc(n.status)}">${esc(n.status)}</span>` : ""}
              ${n.updated ? `<span>updated ${esc(n.updated)}</span>` : ""}
              ${n.next_steps_open ? `<span>${n.next_steps_open} open step${n.next_steps_open === 1 ? "" : "s"}</span>` : ""}
            </div>
          </div>
        </div>
        ${n.overview ? `
          <div>
            <div class="card-section-label">Overview (authored)</div>
            <p class="card-overview">${esc(n.overview)}</p>
          </div>` : `<p class="hint">No authored ## Overview section.</p>`}
        <div class="card-ai-slot">
          ${cachedAi ? `
            <div class="card-section-label">AI overview — ${esc(JSON.parse(cachedAi).model)}</div>
            <p class="card-ai">${esc(JSON.parse(cachedAi).text)}</p>` : ""}
        </div>
        <div class="card-actions">
          <button class="btn ai-overview-btn" type="button">${cachedAi ? "Regenerate AI overview" : "Generate AI overview"}</button>
          ${n.tags && n.tags.length ? `<div class="card-tags">${n.tags.map((t) => `<span>#${esc(t)}</span>`).join("")}</div>` : ""}
        </div>
      </article>`;
  }

  $("#librarySearch").addEventListener("input", renderLibrary);
  $("#libraryKind").addEventListener("change", renderLibrary);
  $("#libraryStatus").addEventListener("change", renderLibrary);
  $("#librarySort").addEventListener("change", renderLibrary);
  $("#libraryRefresh").addEventListener("click", loadManifest);

  $("#libraryGrid").addEventListener("click", async (e) => {
    const btn = e.target.closest(".ai-overview-btn");
    if (!btn) return;
    const card = btn.closest(".card");
    const path = card.dataset.path, hash = card.dataset.hash;
    const note = manifestNotes.find((n) => n.path === path);
    if (!note) return;

    btn.disabled = true;
    const prevLabel = btn.textContent;
    btn.innerHTML = `<span class="spinner"></span> Generating…`;
    try {
      const endpoint = HubOllama.getEndpoint();
      const tierKey = localStorage.getItem("hub:tier") || "sm";
      const model = tiers[tierKey].model;
      const served = await HubOllama.fetchTags(endpoint);
      if (!HubOllama.familyMatches(model, served)) {
        throw new Error(`'${model}' is not served — installed: ${served.join(", ") || "(none)"}`);
      }
      const body = (note.body || "").slice(0, 6000);
      const prompt = `Summarize this note for a library card. Two to three sentences, plain ` +
        `language, no preamble, no restating the title. Note titled "${note.title}":\n\n${body}`;
      const response = await HubOllama.generate(endpoint, {
        model, prompt, options: { temperature: 0.4, num_predict: 200 },
      });
      const text = HubOllama.stripThink(response);
      localStorage.setItem(`hub:overview:${hash}`, JSON.stringify({ text, model }));
      renderLibrary();
    } catch (err) {
      btn.textContent = prevLabel;
      btn.disabled = false;
      const slot = card.querySelector(".card-ai-slot");
      slot.innerHTML = `<p class="hint" style="color:var(--alert)">Generation failed: ${esc(err.message)}</p>`;
    }
  });

  // ── ask ──────────────────────────────────────────────────────────────────

  function initAsk() {
    $("#chatLog").dataset.inited = "1";
    try {
      const saved = JSON.parse(localStorage.getItem("hub:index:v1") || "null");
      if (saved && saved.embedModel === embedModel) indexState = saved;
    } catch (_) { /* corrupt cache, ignore */ }
    updateIndexStats();
  }

  function updateIndexStats() {
    const notesCovered = new Set(indexState.chunks.map((c) => c.file)).size;
    $("#idxStatus").textContent = indexState.chunks.length ? "built" : "not built";
    $("#idxChunks").textContent = String(indexState.chunks.length);
    $("#idxNotes").textContent = String(notesCovered);
  }

  $("#buildIndexBtn").addEventListener("click", async () => {
    if (!manifestNotes.length) await loadManifest();
    if (!manifestNotes.length) {
      alert("No notes in the manifest yet — nothing to index.");
      return;
    }
    const endpoint = HubOllama.getEndpoint();
    const btn = $("#buildIndexBtn"), bar = $("#idxProgress"), fill = bar.querySelector("i");
    btn.disabled = true;
    bar.hidden = false;

    try {
      const served = await HubOllama.fetchTags(endpoint);
      if (!HubOllama.familyMatches(embedModel, served)) {
        throw new Error(`embedding model '${embedModel}' is not served — installed: ${served.join(", ") || "(none)"}`);
      }
    } catch (err) {
      alert(`Cannot build index: ${err.message}`);
      btn.disabled = false; bar.hidden = true;
      return;
    }

    const validHashes = new Set(manifestNotes.map((n) => n.content_hash));
    let chunks = indexState.chunks.filter((c) => validHashes.has(c.hash));
    const alreadyDone = new Set(chunks.map((c) => c.hash));
    const todo = manifestNotes.filter((n) => !alreadyDone.has(n.content_hash));

    let done = 0;
    for (const note of todo) {
      try {
        const parts = HubOllama.chunkText(note.body || "");
        for (let i = 0; i < parts.length; i++) {
          const vecRaw = await HubOllama.embed(endpoint, embedModel, parts[i]);
          chunks.push({
            id: `c_${note.path}_${i}`, file: note.path, title: note.title,
            hash: note.content_hash, text: parts[i], vec: HubOllama.normalize(vecRaw),
          });
        }
      } catch (err) {
        console.error(`embedding failed on ${note.path}:`, err);
      }
      done++;
      fill.style.width = `${Math.round((done / todo.length) * 100)}%`;
    }
    await HubOllama.evict(endpoint, embedModel);

    indexState = { embedModel, chunks };
    try {
      localStorage.setItem("hub:index:v1", JSON.stringify(indexState));
    } catch (_) {
      console.warn("index too large for localStorage — kept in memory for this session only");
    }
    updateIndexStats();
    btn.disabled = false;
    bar.hidden = true;
    fill.style.width = "0%";
  });

  function addMessage(role, html) {
    const log = $("#chatLog");
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    div.innerHTML = `<div class="who${role === "assistant-error" ? " c-alert" : ""}">${role === "user" ? "You" : "Model"}</div>
      <div class="bubble">${html}</div>`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  $("#askForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#askInput");
    const question = input.value.trim();
    if (!question) return;
    if (!indexState.chunks.length) {
      alert('No index yet — click "Build / refresh index" first.');
      return;
    }

    addMessage("user", esc(question));
    input.value = "";
    $("#askSubmit").disabled = true;
    const waiting = addMessage("assistant", `<span class="spinner"></span> thinking…`);

    const endpoint = HubOllama.getEndpoint();
    const tierKey = localStorage.getItem("hub:tier") || "sm";
    const tier = tiers[tierKey];
    const topK = Number($("#optTopK").value) || 12;
    const rerankTo = Number($("#optRerankTo").value) || 4;
    const maxWords = Number($("#optMaxWords").value) || 220;

    try {
      const served = await HubOllama.fetchTags(endpoint);
      if (!HubOllama.familyMatches(embedModel, served)) throw new Error(`embedding model '${embedModel}' not served`);
      if (!HubOllama.familyMatches(tier.model, served)) throw new Error(`tier model '${tier.model}' not served`);

      const qvecRaw = await HubOllama.embed(endpoint, embedModel, question);
      const qvec = HubOllama.normalize(qvecRaw);
      const kept = HubOllama.retrieve(qvec, indexState.chunks, {
        topK, rerankTo, payloadTokens: tier.payload_tokens,
      });
      const prompt = HubOllama.buildPrompt(question, kept, maxWords);

      const raw = await HubOllama.generate(endpoint, {
        model: tier.model, prompt,
        options: { temperature: 0.6, top_p: 0.95, num_ctx: tier.num_ctx, num_predict: tier.num_predict },
      });
      await HubOllama.evict(endpoint, tier.model);
      const answer = HubOllama.stripThink(raw) || "(empty response)";

      const sourcesHtml = kept.map(({ score, c }) =>
        `<div class="source-row">[${esc(c.id)}] <b>${esc(c.title)}</b> — ${esc(c.file)} · score ${score.toFixed(3)}</div>`
      ).join("");
      waiting.querySelector(".bubble").innerHTML =
        `${esc(answer).replace(/\n/g, "<br>")}<div class="sources">${sourcesHtml}</div>`;
    } catch (err) {
      waiting.className = "msg assistant";
      waiting.querySelector(".who").classList.add("c-alert");
      waiting.querySelector(".bubble").textContent = `Could not answer: ${err.message}`;
    } finally {
      $("#askSubmit").disabled = false;
    }
  });

  // ── pipeline (static preview only — no dashboard.json, no polling) ────────

  const PREVIEW_STATIONS = [
    { name: "Ideation", status: "complete", meta: "seed captured" },
    { name: "Context Resolution", status: "complete", meta: "L1 recalled" },
    { name: "Generation", status: "in_progress", meta: "sm tier · llama3.1:8b" },
    { name: "Review", status: "awaiting_render", meta: "queued" },
    { name: "Export", status: "queued", meta: "—" },
  ];

  $("#previewRail").innerHTML = PREVIEW_STATIONS.map((s) => `
    <div class="station s-${s.status}">
      <div class="node"></div>
      <div class="name">${esc(s.name)}</div>
      <div class="meta">${esc(s.meta)}</div>
    </div>`).join("");
})();
