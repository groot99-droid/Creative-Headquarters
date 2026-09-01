/* hub/designer-pro.js — style generation and mixing assistant.
 *
 * Two layers, deliberately separated:
 *
 *   GROUNDING (this file, deterministic)  Reads the vendored ui-ux-pro-max CSVs,
 *     lets you pick rows as ingredients, and runs conflict checks computed
 *     straight from corpus fields — deprecation, mode clashes, accessibility
 *     risk, complexity stacking. No model involved; these are facts from the row.
 *
 *   SYNTHESIS (Ollama, local)  Blends the chosen ingredients into one direction.
 *     It is told to use ONLY the ingredient block and never to introduce a colour
 *     or typeface that is not in it — the same "answer only from the retrieval
 *     block" discipline hub/ollama.js and tools/vault_rag.py already use.
 *
 * WHAT THIS IS NOT: `tools/ui-ux-pro-max/scripts/search.py`. That is BM25 + regex
 * with domain auto-detection and the real --design-system generator, and it cannot
 * run in static HTML. Retrieval here is token overlap. When the two disagree the
 * CLI is authoritative — and a generated direction is a proposal, never a corpus
 * match. Nothing here writes tokens; ARTIFACT A stays operator-approval only.
 */
(function () {
  "use strict";

  const BASE = "../tools/ui-ux-pro-max/data/";

  /* Titles are real column names, verified against the CSV headers — an earlier
     version guessed them ("Mood" instead of "Mood/Style Keywords") and silently
     scored nothing. Everything else is scored except NOISE, so a new upstream
     column is picked up automatically rather than ignored. */
  const DOMAINS = [
    { id: "style",      file: "styles.csv",        title: ["Style Category", "Style ID"] },
    { id: "color",      file: "colors.csv",        title: ["Product Type"] },
    { id: "typography", file: "typography.csv",    title: ["Font Pairing Name", "Heading Font"] },
    { id: "ux",         file: "ux-guidelines.csv", title: ["Issue", "Category"] },
    { id: "chart",      file: "charts.csv",        title: ["Best Chart Type", "Data Type"] },
    { id: "landing",    file: "landing.csv",       title: ["Pattern Name", "Pattern ID"] },
    { id: "product",    file: "products.csv",      title: ["Product Type"] },
    { id: "icons",      file: "icons.csv",         title: ["Icon Name", "Category"] },
    { id: "motion",     file: "motion.csv",        title: ["Category", "Intensity Tier"] },
  ];

  const NOISE = new Set([
    "No", "Google Fonts URL", "CSS Import", "Tailwind Config", "Import Code",
    "GSAP Snippet", "Implementation Checklist", "Design System Variables",
    "Code Example Good", "Code Example Bad",
  ]);

  const cache = new Map();
  let activeDomain = "style";
  let mix = [];                 // [{key, domain, title, row}]
  let tiers = null;
  let els = {};

  /* ── CSV ──────────────────────────────────────────────────────────────────
     RFC-4180-ish. The corpus quotes fields containing commas and newlines
     (Do/Don't prose does both), so split(",") silently shreds it. */
  function parseCSV(text) {
    const rows = [];
    let row = [], field = "", inQuotes = false;
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
        else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c !== "\r") field += c;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    if (!rows.length) return [];
    const head = rows.shift().map((h) => h.trim());
    return rows.filter((r) => r.length > 1).map((r) => {
      const o = {}; head.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); }); return o;
    });
  }

  async function load(domain) {
    if (cache.has(domain.file)) return cache.get(domain.file);
    const res = await fetch(BASE + domain.file);
    if (!res.ok) throw new Error(`${domain.file} — HTTP ${res.status}`);
    const rows = parseCSV(await res.text());
    cache.set(domain.file, rows);
    return rows;
  }

  const norm = (s) => String(s || "").toLowerCase();
  const terms = (q) => norm(q).split(/[^a-z0-9]+/).filter((t) => t.length > 1);
  const scoredCols = (row, d) => Object.keys(row).filter((c) => !NOISE.has(c) && !d.title.includes(c));
  const firstOf = (row, cols) => { for (const c of cols) if (row[c]) return row[c]; return "(untitled row)"; };

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function score(row, domain, qTerms, phrase) {
    if (!qTerms.length) return 1;
    let s = 0;
    const t = norm(domain.title.map((c) => row[c]).filter(Boolean).join(" "));
    const b = norm(scoredCols(row, domain).map((c) => row[c]).filter(Boolean).join(" "));
    if (phrase && t.includes(phrase)) s += 30;
    if (phrase && b.includes(phrase)) s += 12;
    for (const q of qTerms) { if (t.includes(q)) s += 6; if (b.includes(q)) s += 2; }
    return s;
  }

  /* ── Conflict checks ──────────────────────────────────────────────────────
     Every finding below is read from a corpus field, not inferred by a model.
     That matters: a generated direction can be wrong, but "this row says
     Status: deprecated" cannot. */
  const parseTag = (v, key) => {
    const m = String(v || "").match(new RegExp(`${key}:([a-z-]+)`));
    return m ? m[1] : null;
  };

  function checks() {
    const out = [];
    const styles = mix.filter((m) => m.domain === "style");

    for (const m of mix) {
      if (norm(m.row["Status"]) === "deprecated") {
        const rep = [m.row["Replacement Domain"], m.row["Replacement ID"]].filter(Boolean).join(" / ");
        out.push({ level: "blocked", text: `<strong>${esc(m.title)}</strong> is marked ` +
          `<code>Status: deprecated</code> in the corpus${rep ? ` — replacement: <code>${esc(rep)}</code>` : ""}.` });
      }
      const risk = parseTag(m.row["Accessibility"], "risk");
      if (risk === "high") {
        out.push({ level: "blocked", text: `<strong>${esc(m.title)}</strong> carries ` +
          `<code>risk:high</code> on accessibility. The corpus flags it, so this is a decision, not an oversight.` });
      } else if (risk === "conditional") {
        out.push({ level: "warn", text: `<strong>${esc(m.title)}</strong> is ` +
          `<code>risk:conditional</code> — it holds up only if its stated requirements are met.` });
      }
      if (parseTag(m.row["Performance"], "cost") === "high") {
        out.push({ level: "warn", text: `<strong>${esc(m.title)}</strong> is <code>cost:high</code> on performance.` });
      }
    }

    /* Mode clash — the one conflict that silently produces an unbuildable mix. */
    const darkPref = styles.filter((m) => norm(m.row["Preferred Mode"]) === "dark");
    const darkBad = styles.filter((m) => norm(m.row["Dark Mode ✓"]) === "not-recommended");
    const lightBad = styles.filter((m) => norm(m.row["Light Mode ✓"]) === "not-recommended");
    if (darkPref.length && darkBad.length) {
      out.push({ level: "blocked", text:
        `Mode clash: <strong>${esc(darkPref[0].title)}</strong> prefers dark, but ` +
        `<strong>${esc(darkBad[0].title)}</strong> is <code>not-recommended</code> in dark. ` +
        `One of the two has to go.` });
    }
    if (darkBad.length && lightBad.length) {
      out.push({ level: "blocked", text:
        `<strong>${esc(darkBad[0].title)}</strong> rules out dark and ` +
        `<strong>${esc(lightBad[0].title)}</strong> rules out light — this mix has no mode left.` });
    }

    const high = styles.filter((m) => norm(m.row["Complexity"]) === "high");
    if (high.length >= 2) {
      out.push({ level: "warn", text: `${high.length} <code>Complexity: High</code> styles stacked ` +
        `(${high.map((m) => esc(m.title)).join(", ")}). Each is a build cost on its own.` });
    }

    if (styles.length >= 3) {
      out.push({ level: "warn", text: `${styles.length} styles in one mix. The corpus anti-pattern ` +
        `"mixing flat &amp; skeuomorphic randomly" starts here — consider one dominant style plus accents.` });
    }
    return out;
  }

  /* ── Rendering ────────────────────────────────────────────────────────────── */
  const keyOf = (domain, row, i) => `${domain.id}:${firstOf(row, domain.title)}:${row["No"] ?? i}`;

  function renderResults(scored, domain, q) {
    if (!scored.length) {
      els.results.innerHTML =
        `<p class="dp-empty">No row in <code>${esc(domain.file)}</code> matches ` +
        `<strong>${esc(q)}</strong>. This is token overlap, not the CLI's BM25 — a miss ` +
        `here is not proof the corpus has nothing:<br>` +
        `<code>python3 tools/ui-ux-pro-max/scripts/search.py "${esc(q)}" --domain ${esc(domain.id)}</code></p>`;
      els.count.textContent = "0 rows";
      return;
    }
    els.count.textContent = `${scored.length} row${scored.length === 1 ? "" : "s"}`;
    const inMix = new Set(mix.map((m) => m.key));
    els.results.innerHTML = scored.map(({ row }, i) => {
      const key = keyOf(domain, row, i);
      const title = firstOf(row, domain.title);
      const fields = Object.entries(row)
        .filter(([k, v]) => v && !domain.title.includes(k) && !NOISE.has(k) && v.length < 900)
        .slice(0, 10);
      const added = inMix.has(key);
      return `<article class="dp-card">
        <div class="dp-card-head">
          <h4>${esc(title)}</h4>
          <button class="dp-add" type="button" data-key="${esc(key)}" data-domain="${esc(domain.id)}"
                  data-idx="${i}" ${added ? "disabled" : ""}>${added ? "in mix" : "+ mix"}</button>
        </div>
        <dl>${fields.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      </article>`;
    }).join("");
    els.results.dataset.domain = domain.id;
    lastScored = scored;
  }

  let lastScored = [];

  function renderMix() {
    els.mixCount.textContent = mix.length ? `${mix.length} ingredient${mix.length === 1 ? "" : "s"}` : "empty";
    els.generate.disabled = mix.length === 0;

    els.mixList.innerHTML = mix.length
      ? mix.map((m, i) => `<li class="dp-ing">
          <span class="dp-ing-tag">${esc(m.domain)}</span>
          <span class="dp-ing-name">${esc(m.title)}</span>
          <button class="dp-drop" type="button" data-i="${i}"
                  aria-label="Remove ${esc(m.title)} from mix">remove</button>
        </li>`).join("")
      : `<li class="dp-empty">Nothing selected. Search above and press <strong>+ mix</strong> on a
         row to use it as an ingredient. Mixing across domains — a style, a palette, a font
         pairing — is what makes the synthesis worth running.</li>`;

    const found = checks();
    els.checks.innerHTML = !mix.length ? ""
      : found.length
        ? `<div class="dp-checks-head">Corpus checks — read from the rows, not generated</div>` +
          found.map((c) => `<p class="dp-check dp-check-${c.level}">${c.text}</p>`).join("")
        : `<p class="dp-check dp-check-ok">No conflicts in the corpus fields for these
           ${mix.length} ingredient${mix.length === 1 ? "" : "s"}.</p>`;
  }

  /* ── Synthesis ────────────────────────────────────────────────────────────── */
  function ingredientBlock() {
    return mix.map((m, i) => {
      const body = Object.entries(m.row)
        .filter(([k, v]) => v && !NOISE.has(k) && v.length < 600)
        .map(([k, v]) => `  ${k}: ${v}`).join("\n");
      return `[ing_${i + 1}] ${m.domain} — ${m.title}\n${body}`;
    }).join("\n\n");
  }

  function buildPrompt(brief, found) {
    /* The deterministic findings go INTO the prompt, not just onto the screen.
       Left out, the model reports "TENSIONS: none" over a mix the corpus itself
       flags — which is exactly what it did on the first run of this feature. */
    const flagged = found.length
      ? found.map((c) => `- (${c.level}) ${c.text.replace(/<[^>]+>/g, "")}`).join("\n")
      : "- none";

    const lines = [
      "You are a design director blending pre-selected ingredients into ONE coherent visual direction.",
      "",
      "HARD RULES:",
      "- Use ONLY the INGREDIENTS block. It is the whole of what you know.",
      "- Never introduce a colour value, typeface, or library that is not in the block. If the" +
        " block has no palette, say the palette is unresolved — do not invent hex codes.",
      "- Cite the ingredient you drew each claim from, like [ing_2].",
      "- The CHECKS below were computed from the corpus fields and are FACTS. You must address" +
        ' every one of them in TENSIONS. Do not answer "none" while a check is listed.',
      "- If two ingredients conflict, say so and pick one, giving the reason. Do not paper over" +
        " a conflict with a compromise that serves neither.",
      "",
      `BRIEF: ${brief || "(none given — describe the direction the ingredients imply on their own)"}`,
      "",
      "<CHECKS>", flagged, "</CHECKS>",
      "",
      "<INGREDIENTS>", ingredientBlock(), "</INGREDIENTS>",
      "",
      "Answer with exactly these four headed sections, no preamble:",
      "DIRECTION: the blended direction in 3-4 sentences.",
      "CONTRIBUTIONS: one line per ingredient — what it brings, with its [ing_n].",
      "TENSIONS: every CHECK above, plus any conflict you see, and which side you kept.",
      'AVOID: 3-4 concrete things drawn from the block\'s "Do Not Use For" and "Don\'t" fields.',
    ];
    return lines.join("\n");
  }

  async function resolveTier() {
    if (tiers) return tiers;
    tiers = HubOllama.DEFAULT_TIERS;
    try {                                   // mirror app.js: dashboard may override
      const r = await fetch("../dashboard.json");
      if (r.ok) {
        const llm = (await r.json())?.hardware?.local_llm;
        if (llm?.tiers?.sm?.model) {
          tiers = { ...tiers, sm: { ...tiers.sm, model: llm.tiers.sm.model,
            num_ctx: llm.tiers.sm.context_window_tokens || tiers.sm.num_ctx } };
        }
      }
    } catch (_) { /* dashboard optional here */ }
    return tiers;
  }

  let inflight = null;

  async function generate() {
    if (inflight) { inflight.abort(); return; }      // button doubles as cancel

    const brief = els.brief.value.trim();
    const found = checks();
    const t0 = Date.now();
    const tier = (await resolveTier()).sm;
    const endpoint = HubOllama.getEndpoint();

    inflight = new AbortController();
    els.generate.textContent = "Cancel";
    els.clear.disabled = true;
    els.out.hidden = false;

    /* This machine has no CUDA, so an 8B blend runs for minutes. A static
       "working…" line is indistinguishable from a hang — show the clock. */
    const tick = setInterval(() => {
      const s = Math.round((Date.now() - t0) / 1000);
      const el = document.getElementById("dpElapsed");
      if (el) el.textContent = `${s}s`;
    }, 1000);

    els.out.innerHTML =
      `<p class="dp-empty">Blending ${mix.length} ingredient${mix.length === 1 ? "" : "s"} ` +
      `with <code>${esc(tier.model)}</code> — <span id="dpElapsed">0s</span> elapsed. ` +
      `CPU inference on this laptop; a minute or two is normal. Press Cancel to stop.</p>`;

    try {
      const served = await HubOllama.fetchTags(endpoint);
      if (!HubOllama.familyMatches(tier.model, served)) {
        throw new Error(`'${tier.model}' is not served. Installed: ${served.join(", ") || "(none)"}`);
      }
      const raw = await HubOllama.generate(endpoint, {
        model: tier.model,
        prompt: buildPrompt(brief, found),
        options: { temperature: 0.5, num_predict: 420, num_ctx: tier.num_ctx },
        signal: inflight.signal,
      });
      const text = HubOllama.stripThink(raw);
      const secs = Math.round((Date.now() - t0) / 1000);
      els.out.innerHTML =
        `<div class="dp-out-label">Generated by <code>${esc(tier.model)}</code> in ${secs}s · ` +
        `grounded in ${mix.length} corpus row${mix.length === 1 ? "" : "s"} and ` +
        `${found.length} check${found.length === 1 ? "" : "s"} · <strong>a proposal, not a ` +
        `corpus match</strong>. Nothing here is written to any token file.</div>` +
        `<pre class="dp-out-body">${esc(text)}</pre>` +
        `<div class="dp-out-src">Ingredients: ${mix.map((m, i) =>
          `<code>[ing_${i + 1}]</code> ${esc(m.title)}`).join(" · ")}</div>`;
    } catch (err) {
      const aborted = err.name === "AbortError";
      els.out.innerHTML = aborted
        ? `<p class="dp-empty">Cancelled after ${Math.round((Date.now() - t0) / 1000)}s. ` +
          `The mix and its checks are untouched.</p>`
        : `<p class="dp-empty dp-err"><strong>Synthesis unavailable.</strong> ${esc(err.message)}<br>` +
          `The mix and its corpus checks above are unaffected — those are read from the CSVs and ` +
          `need no model. Ollama runs locally; see OBSIDIAN.md if the endpoint is refusing.</p>`;
    } finally {
      clearInterval(tick);
      inflight = null;
      els.generate.textContent = "Blend into a direction";
      els.generate.disabled = mix.length === 0;
      els.clear.disabled = false;
    }
  }

  /* ── Wiring ───────────────────────────────────────────────────────────────── */
  async function run() {
    const domain = DOMAINS.find((d) => d.id === activeDomain);
    const q = els.query.value.trim();
    els.results.innerHTML = `<p class="dp-empty">Reading <code>${esc(domain.file)}</code>…</p>`;
    els.count.textContent = "…";
    let rows;
    try { rows = await load(domain); }
    catch (err) {
      els.results.innerHTML = `<p class="dp-empty dp-err">Could not read ` +
        `<code>${esc(domain.file)}</code>: ${esc(err.message)}.<br>The corpus is read over HTTP ` +
        `from <code>tools/ui-ux-pro-max/data/</code> — this tab needs an HTTP origin, not ` +
        `<code>file://</code>.</p>`;
      els.count.textContent = "—";
      return;
    }
    const qTerms = terms(q), phrase = norm(q);
    renderResults(
      rows.map((row) => ({ row, s: score(row, domain, qTerms, phrase) }))
          .filter((r) => r.s > 0).sort((a, b) => b.s - a.s).slice(0, 40),
      domain, q);
  }

  function mount() {
    els = {
      brief: document.getElementById("dpBrief"),
      query: document.getElementById("dpQuery"),
      results: document.getElementById("dpResults"),
      count: document.getElementById("dpCount"),
      domains: document.getElementById("dpDomains"),
      mixList: document.getElementById("dpMixList"),
      mixCount: document.getElementById("dpMixCount"),
      checks: document.getElementById("dpChecks"),
      generate: document.getElementById("dpGenerate"),
      clear: document.getElementById("dpClear"),
      out: document.getElementById("dpOut"),
    };
    if (!els.query) return;

    els.domains.innerHTML = DOMAINS.map((d) =>
      `<button class="dp-domain" type="button" data-domain="${d.id}" ` +
      `aria-pressed="${d.id === activeDomain}">${d.id}</button>`).join("");

    els.domains.addEventListener("click", (e) => {
      const b = e.target.closest(".dp-domain");
      if (!b) return;
      activeDomain = b.dataset.domain;
      els.domains.querySelectorAll(".dp-domain")
        .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      run();
    });

    els.results.addEventListener("click", (e) => {
      const b = e.target.closest(".dp-add");
      if (!b) return;
      const domain = DOMAINS.find((d) => d.id === b.dataset.domain);
      const entry = lastScored[Number(b.dataset.idx)];
      if (!domain || !entry) return;
      const key = b.dataset.key;
      if (mix.some((m) => m.key === key)) return;
      mix.push({ key, domain: domain.id, title: firstOf(entry.row, domain.title), row: entry.row });
      b.disabled = true; b.textContent = "in mix";
      renderMix();
    });

    els.mixList.addEventListener("click", (e) => {
      const b = e.target.closest(".dp-drop");
      if (!b) return;
      mix.splice(Number(b.dataset.i), 1);
      renderMix();
      run();                                  // re-enable the "+ mix" button on that row
    });

    els.clear.addEventListener("click", () => { mix = []; renderMix(); run(); });
    els.generate.addEventListener("click", generate);

    let t;
    els.query.addEventListener("input", () => { clearTimeout(t); t = setTimeout(run, 180); });
    els.query.addEventListener("keydown", (e) => { if (e.key === "Enter") { clearTimeout(t); run(); } });

    renderMix();
    run();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
