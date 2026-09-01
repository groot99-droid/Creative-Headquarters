/*
 * ollama.js -- browser client for the local Ollama server, plus the same
 * chunk / embed / retrieve steps tools/vault_rag.py runs from the CLI.
 *
 * This is the in-browser half of connection B in OBSIDIAN.md ("Vault ->
 * Ollama"): everything here talks straight to http://localhost:11434, the
 * same way an Obsidian plugin does for connection A. Nothing leaves the
 * machine -- the vault is fetched from disk over the local static server,
 * embeddings and answers come back from the Ollama process on this laptop.
 *
 * Mirrors vault_rag.py's constants and prompt so the two stay honest about
 * doing the same thing: same tiers, same chunk size, same "answer only from
 * the retrieval block" discipline.
 */

const HubOllama = (() => {
  const CHARS_PER_TOKEN = 4;
  const CHUNK_TOKENS = 800;
  const OVERLAP_TOKENS = 120;

  const DEFAULT_TIERS = {
    sm: { model: "llama3.1:8b", num_ctx: 8192, payload_tokens: 3000, num_predict: 800 },
    md: { model: "mistral-nemo:12b", num_ctx: 4096, payload_tokens: 1200, num_predict: 600 },
  };
  const DEFAULT_EMBED_MODEL = "nomic-embed-text";
  const DEFAULT_ENDPOINT = "http://localhost:11434";

  const QUERY_TEMPLATE = (question, retrieval, maxWords) =>
    `You are answering from the studio's private corpus. Use ONLY the retrieval block ` +
    `below; if it does not contain the answer, say so plainly -- do not fill gaps from ` +
    `general knowledge.\n` +
    `Cite chunk ids in square brackets like [c_0412] after each claim.\n` +
    `Question: ${question}\n<RETRIEVAL>\n${retrieval}\n</RETRIEVAL>\n` +
    `Answer in at most ${maxWords} words. Put your final answer after the line 'ANSWER:'.`;

  function getEndpoint() {
    return localStorage.getItem("hub:endpoint") || DEFAULT_ENDPOINT;
  }
  function setEndpoint(v) {
    localStorage.setItem("hub:endpoint", v);
  }

  async function fetchTags(endpoint) {
    const r = await fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return (data.models || []).map((m) => m.name);
  }

  function familyMatches(tag, served) {
    const fam = tag.split(":")[0];
    return served.some((n) => n.split(":")[0] === fam);
  }

  async function embed(endpoint, model, prompt) {
    const r = await fetch(`${endpoint}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, keep_alive: "5m" }),
    });
    if (!r.ok) throw new Error(`embeddings HTTP ${r.status}`);
    const data = await r.json();
    return data.embedding;
  }

  /* `signal` is optional and additive -- callers that omit it behave exactly as
     before. Local generation on a no-CUDA laptop runs for minutes, so a caller
     needs a way to let the operator take it back. */
  async function generate(endpoint, { model, prompt, options, signal }) {
    const r = await fetch(`${endpoint}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false, keep_alive: "5m", options }),
      signal,
    });
    if (!r.ok) throw new Error(`generate HTTP ${r.status}`);
    const data = await r.json();
    return data.response || "";
  }

  async function evict(endpoint, model) {
    try {
      await fetch(`${endpoint}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, keep_alive: 0 }),
      });
    } catch (_) {
      /* best effort */
    }
  }

  function stripThink(raw) {
    return raw.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^ANSWER:\s*/m, "").trim();
  }

  function stripFrontmatter(text) {
    if (!text.startsWith("---")) return text;
    const end = text.indexOf("\n---", 3);
    if (end === -1) return text;
    return text.slice(end + 4);
  }

  // Paragraph-packing chunker -- same shape as vault_rag.py's chunk(): pack
  // paragraphs up to the token budget, carry `overlap` chars into the next
  // chunk, hard-split anything still oversized.
  function chunkText(text, sizeTokens = CHUNK_TOKENS, overlapTokens = OVERLAP_TOKENS) {
    const size = sizeTokens * CHARS_PER_TOKEN;
    const overlap = overlapTokens * CHARS_PER_TOKEN;
    const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const chunks = [];
    let cur = "";
    for (const p of paras) {
      if (cur && cur.length + p.length + 2 > size) {
        chunks.push(cur);
        cur = overlap ? cur.slice(-overlap) + "\n\n" + p : p;
      } else {
        cur = cur ? `${cur}\n\n${p}` : p;
      }
      while (cur.length > size * 1.5) {
        chunks.push(cur.slice(0, size));
        cur = cur.slice(size - overlap);
      }
    }
    if (cur.trim()) chunks.push(cur);
    return chunks;
  }

  function normalize(vec) {
    const mag = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
    return mag ? vec.map((x) => x / mag) : vec.slice();
  }

  function dot(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  // Retrieval: score all chunks, keep the top-k, then greedily fill the
  // tier's char budget up to rerankTo chunks -- identical logic to
  // vault_rag.py's cmd_ask so the two tools answer from the same discipline.
  function retrieve(qvec, chunks, { topK = 12, rerankTo = 4, payloadTokens }) {
    const cap = payloadTokens * CHARS_PER_TOKEN;
    const scored = chunks
      .map((c) => ({ score: dot(qvec, c.vec), c }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    let budget = cap;
    const kept = [];
    for (const { score, c } of scored) {
      if (kept.length >= rerankTo) break;
      if (c.text.length > budget) continue;
      kept.push({ score, c });
      budget -= c.text.length;
    }
    if (!kept.length && scored.length) {
      const best = scored[0];
      kept.push({ score: best.score, c: { ...best.c, text: best.c.text.slice(0, cap) } });
    }
    return kept;
  }

  function buildPrompt(question, kept, maxWords) {
    const retrieval = kept
      .map(({ c }) => `[${c.id}] (${c.title} -- ${c.file})\n${c.text}`)
      .join("\n\n");
    return QUERY_TEMPLATE(question, retrieval, maxWords);
  }

  return {
    DEFAULT_TIERS, DEFAULT_EMBED_MODEL, DEFAULT_ENDPOINT,
    getEndpoint, setEndpoint, fetchTags, familyMatches,
    embed, generate, evict, stripThink, stripFrontmatter,
    chunkText, normalize, dot, retrieve, buildPrompt,
  };
})();
