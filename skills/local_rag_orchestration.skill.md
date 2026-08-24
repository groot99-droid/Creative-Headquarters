# local_rag_orchestration.skill.md — LOCAL RAG / OLLAMA ORCHESTRATION EXECUTABLE
### Studio Headless OS · Skill 7/8 · Four-Part Artifact Architecture

---

## 0. ROUTING HEADER (Part 1 of 4)

```yaml
skill_id: local_rag_orchestration
version: 2.0
trigger_a: ["search my docs", "recall", "summarize corpus", "RAG", "local model", "what did we decide", "project memory"]
trigger_b: ["corpus dirs: ./project/docs ./project/notes", "pipeline research phases"]
mandatory_context: [memory_discipline]
host_kinds: [windows, wsl, linux]
writes_dashboard_keys: [hardware.local_llm.context_used_pct, hardware.local_llm.loaded_tier]
danger_class: LOCAL_COMPUTE_HEAVY
depends_on_skill: hardware_compute.skill.md   # must PASS before any model call
workload_class: llm_local_sm   # llm_local_md only when the task declares it and the gate agrees
target_model: resolved at runtime from dashboard.json → hardware.local_llm.tiers (see §1 P2)
version_note: v2.0 — retargeted from DeepSeek-R1-671B on a 192 GB host to tiered local models on a 16 GB laptop. Model identity is now registry-driven, never hardcoded.
```

**The model is a tier, not a name.** v1.x was written against one model on one machine:
DeepSeek-R1-671B, 131,072-token window, 192 GB of unified memory to hold it. This
machine has 16 GB shared with Windows, two OLED panels, and whatever else is open. A
671B model is not "slow" here — it does not load. The skill now resolves a *tier* from
`dashboard.json → hardware.local_llm.tiers` and verifies the tag against what Ollama
actually serves, so swapping models is a dashboard edit rather than a rewrite of this
file.

**Reasoning models are still first-class**, and the `<think>`-stripping laws below still
apply — an 8B reasoning model burns the same reasoning tokens as a 671B one, out of a
window an order of magnitude smaller. That makes the flush discipline in §2 more load-
bearing on this machine, not less.

---

## 1. PREREQUISITES & STATE VERIFICATION (Part 2 of 4)

```bash
# P1 — Attestation exists
grep -q "ROUTER INTERCEPT" ./.task_scratch/attestation.txt || echo "FAIL:P1"

# P2 — Resolve endpoint + tier from dashboard state, never from a literal.
#      hardware.local_llm.endpoint is the single source of truth and it does move.
RAG_ENDPOINT=$(python3 -c "import json;print(json.load(open('dashboard.json'))['hardware']['local_llm']['endpoint'])")
RAG_TIER=${RAG_TIER:-sm}
RAG_MODEL=$(python3 -c "import json,os;print(json.load(open('dashboard.json'))['hardware']['local_llm']['tiers'][os.environ.get('RAG_TIER','sm')]['model'])")

# P2a — WSL BRIDGE: Ollama runs as a Windows service on this machine. Under WSL2's
#       default NAT networking, "localhost" inside WSL is the WSL VM, NOT Windows —
#       the endpoint resolves to nothing and the failure looks like a dead server.
#       Rewrite host to the WSL gateway unless Windows is in mirrored networking mode.
if grep -qi microsoft /proc/version 2>/dev/null; then
  if ! curl -s --max-time 3 "$RAG_ENDPOINT/api/tags" >/dev/null 2>&1; then
    WIN_HOST=$(ip route show default 2>/dev/null | awk '{print $3; exit}')
    [ -n "$WIN_HOST" ] && RAG_ENDPOINT=$(echo "$RAG_ENDPOINT" | sed "s#//[^:/]*#//$WIN_HOST#")
    echo "NOTE:P2a retargeted endpoint to Windows host $WIN_HOST"
    echo "      (Windows side needs OLLAMA_HOST=0.0.0.0 and a firewall rule for 11434)"
  fi
fi

# P2b — Endpoint live AND the tier's model actually served. Verify the resolved tag,
#       not a hardcoded family substring: the registry is what this skill will call.
curl -s --max-time 6 "$RAG_ENDPOINT/api/tags" \
  | RAG_MODEL="$RAG_MODEL" python3 -c "import sys,json,os; want=os.environ['RAG_MODEL'].split(':')[0]; names=[m['name'] for m in json.load(sys.stdin).get('models',[])]; sys.exit(0 if any(n.split(':')[0]==want for n in names) else 1)" \
  && echo "OK:P2 serving $RAG_MODEL" || echo "FAIL:P2 $RAG_MODEL not served — 'ollama pull $RAG_MODEL'"

# P3 — HARDWARE GATE: a model load is a memory event on a 16 GB machine, so this skill
#      needs the same fresh, unconsumed, workload-matched token blender_python needs.
#      v1.x declared danger_class LOCAL_COMPUTE_HEAVY and then never checked a token —
#      harmless when the host had 192 GB, a stall when it has 16.
python3 - <<'PY'
import json, os, time
want = "llm_local_md" if os.environ.get("RAG_TIER") == "md" else "llm_local_sm"
try:
    t = json.load(open("state/compute_gate.json"))
    age = time.time() - t["ts_epoch"]
    ttl = t.get("ttl_seconds", 1800)
    reasons = []
    if t.get("verdict") != "PASS":       reasons.append("verdict=%s" % t.get("verdict"))
    if age >= ttl:                       reasons.append("stale (%ds > %ds TTL)" % (age, ttl))
    if t.get("workload") != want:        reasons.append("wrong workload=%s, need %s" % (t.get("workload"), want))
    if t.get("consumed_by") is not None: reasons.append("already consumed by %s" % t["consumed_by"])
except Exception as e:
    reasons = ["unreadable token: %s" % e]
print("OK:P3" if not reasons else "FAIL:P3 " + "; ".join(reasons))
PY

# P4 — Context budget check BEFORE loading anything
python3 - <<'PY'
import json
d=json.load(open("dashboard.json"))
pct=d["hardware"]["local_llm"]["context_used_pct"]
print("OK:P4" if pct < 50 else "FAIL:P4 window already %d%% — flush first" % pct)
PY

# P5 — Vector index exists and is fresher than the corpus
[ -f state/rag_index/index.faiss ] && \
[ "$(find ./project/docs ./project/notes -newer state/rag_index/index.faiss -type f 2>/dev/null | wc -l)" -eq 0 ] \
  && echo "OK:P5" || echo "WARN:P5 reindex required before query"
```

State verification (agent-level):
- **V1:** `memory_discipline` context defines what is quotable vs. summarizable from the corpus — load it before writing any answer.
- **V2:** Confirm which of the three modes applies: `INDEX`, `QUERY`, or `SYNTHESIS`. Each has its own flush schedule (§2). Never mix modes in one session.
- **V3:** Confirm the tier. `md` is the ceiling this machine can hold and it requires AC power and a near-idle desktop (ARTIFACT B of `hardware_compute`). If the task does not specifically need it, `sm` is the answer.

---

## 2. EXECUTION PROCESS (Part 3 of 4)

**Token budget law (tier-scoped, not a fixed 131k).** The window is set by
`options.num_ctx` for the resolved tier, and on this machine `num_ctx` is a *memory*
decision before it is a quality one: Ollama allocates the KV cache at load, so doubling
the context can cost another gigabyte of the sixteen.

| tier | `num_ctx` | retrieval payload / hop | reasoning reserve | `num_predict` |
|---|---|---|---|---|
| `sm` (≤8B Q4) | 8192 | ≤ 3,000 tok | ≥ 2,500 tok | 800 |
| `md` (12–14B Q4) | 4096 | ≤ 1,200 tok | ≥ 1,500 tok | 600 |

Session ceiling stays 60% of the tier's window — crossing it forces CHECKPOINT-F
immediately, mid-task if necessary. Hard-truncate the lowest-ranked chunks first.

1. **UNPACK** — Load ARTIFACT A (request payloads) and ARTIFACT B (routing sub-prompts).
2. **MODE ROUTE** — Classify the task with the `ROUTER_SUBPROMPT` (ARTIFACT B) via a *small, cheap* call (`num_predict: 400`). Output is one word: `INDEX | QUERY | SYNTHESIS`.
3. **INDEX mode** — Chunk corpus (800-token chunks, 120 overlap) → embed → write `state/rag_index/`. No generation calls except chunk-title generation in batches of 20.
   **⟪ CHECKPOINT-F1 ⟫** after every 20 chunks: persist index shard to disk, drop chunk text from working memory, keep only the shard manifest.
4. **QUERY mode** —
   a. Embed question → retrieve top-k=8 → rerank to 4 → assemble retrieval block within the tier's payload cap.
   b. Build the call from ARTIFACT B `QUERY_SUBPROMPT` (note: for reasoning models, instructions live in the **user turn** — no system prompt; temperature 0.6).
   c. Call the model; strip any `<think>…</think>` block from the answer before it goes anywhere downstream; archive the think block to `state/rag_traces/` (audit only, never re-fed).
   **⟪ CHECKPOINT-F2 ⟫** after each answered question: write answer + source chunk-ids to dashboard event_log; PURGE retrieval block and think trace from working memory. Only the ≤10-line answer summary survives to the next question.
5. **SYNTHESIS mode** (multi-doc reports) — map-reduce:
   a. MAP: per document, one call with `MAP_SUBPROMPT` → ≤300-token structured note.
   **⟪ CHECKPOINT-F3 ⟫** after each MAP call: note → disk (`state/rag_notes/{doc}.md`), source doc evicted from memory.
   b. REDUCE: single call with `REDUCE_SUBPROMPT` over the notes only (never the originals).
6. **WINDOW REPORT** — Estimate tokens consumed (the endpoint's `prompt_eval_count`, or chars/4); write `hardware.local_llm.context_used_pct` against the **tier's** `num_ctx`, not a constant.
7. **⟪ CHECKPOINT-F4 / final ⟫** — Persist outputs; working memory reduced to file paths + one-paragraph result.
8. **EVICT (single-host law)** — Release the model before handing back:
   ```bash
   curl -s "$RAG_ENDPOINT/api/generate" -d "{\"model\":\"$RAG_MODEL\",\"keep_alive\":0}" >/dev/null
   ```
   Then stamp `consumed_by` on the gate token. On the old two-machine studio a resident
   model cost nothing the renderer needed; here it holds gigabytes that the next Blender
   or Photoshop job is about to be denied for. Every call in ARTIFACT A already sets
   `keep_alive: "5m"` so an abandoned session self-evicts, but an explicit release is
   the contract — a still-resident model after handback is a protocol violation.

---

## 3. EMBEDDED ARTIFACTS (Part 4 of 4)

### ARTIFACT A — Request Payloads (Ollama local endpoint)
```json
{
  "_resolution": "model and num_ctx come from dashboard.json → hardware.local_llm.tiers[tier]. The values below are the sm tier's defaults, shown concretely; do not hardcode them into a call.",
  "generate": {
    "endpoint": "POST {{RAG_ENDPOINT}}/api/generate",
    "body": {
      "model": "{{RAG_MODEL}}",
      "prompt": "{{subprompt_with_task_and_retrieval}}",
      "stream": false,
      "keep_alive": "5m",
      "options": { "temperature": 0.6, "top_p": 0.95, "num_ctx": 8192, "num_predict": 800 }
    },
    "laws": [
      "num_ctx is a memory decision: Ollama allocates the KV cache at load, so raising it can cost another GB of the sixteen. Never raise it past the tier table in §2 to 'fit more context' — reduce retrieval instead.",
      "keep_alive '5m' on every call; an abandoned session must not hold the model resident against the next compute job",
      "NO system field for reasoning models — all instructions in the user prompt",
      "temperature 0.5–0.7 (0.6 default); 0.0 causes repetition loops on reasoning models",
      "never few-shot a reasoning model — examples degrade it; describe the format instead",
      "always strip <think>…</think> before storing or displaying the answer"
    ]
  },
  "router_call": {
    "note": "same endpoint, options.num_predict: 400 — classification must stay cheap",
    "body_overrides": { "options": { "temperature": 0.3, "num_predict": 400 } }
  },
  "embed": {
    "endpoint": "POST {{RAG_ENDPOINT}}/api/embeddings",
    "body": { "model": "{{EMBED_MODEL}}", "prompt": "{{chunk_or_query}}", "keep_alive": "5m" },
    "note": "the embedding model is a second resident model. Index in one pass, evict it, then query — holding both at once is ~1 GB this machine does not have spare."
  }
}
```

### ARTIFACT B — Routing Sub-Prompts (directive, format-described, zero-shot)
```json
{
  "ROUTER_SUBPROMPT": "Classify the task below into exactly one mode and output ONLY that word on the final line after your reasoning.\nModes: INDEX (corpus must be chunked/embedded before anything else) | QUERY (answerable from retrieval over an existing index) | SYNTHESIS (requires reading multiple documents and producing a combined report).\nTask: {{task_text}}\nFinal line format: MODE: <INDEX|QUERY|SYNTHESIS>",

  "QUERY_SUBPROMPT": "You are answering from the studio's private corpus. Use ONLY the retrieval block below; if it does not contain the answer, say so plainly — do not fill gaps from general knowledge.\nCite chunk ids in square brackets like [c_0412] after each claim.\nQuestion: {{question}}\n<RETRIEVAL>\n{{ranked_chunks_with_ids}}\n</RETRIEVAL>\nAnswer in at most {{max_words}} words. Put your final answer after the line 'ANSWER:'.",

  "MAP_SUBPROMPT": "Read the single document below and produce a structured note of AT MOST 300 tokens with exactly these sections: DECISIONS (bullet list), OPEN_QUESTIONS (bullet list), FACTS (bullet list with dates), QUOTE_CANDIDATES (max 2 short verbatim quotes with location). No preamble, no conclusion.\n<DOC id=\"{{doc_id}}\">\n{{doc_text}}\n</DOC>",

  "REDUCE_SUBPROMPT": "Below are structured notes distilled from {{n}} documents. Synthesize them into a report with sections: SUMMARY (≤150 words), TIMELINE, DECISIONS_IN_FORCE, CONTRADICTIONS (flag any note that conflicts with another, by doc id), NEXT_ACTIONS. Work only from the notes — the original documents are not available and must not be imagined.\n<NOTES>\n{{all_map_notes}}\n</NOTES>",

  "FLUSH_SELFCHECK_SUBPROMPT": "Estimate in one line whether the conversation so far exceeds 60% of a {{num_ctx}}-token window (chars/4 heuristic). Output exactly 'FLUSH: yes' or 'FLUSH: no'.\n<TRANSCRIPT_STATS>{{char_count}} chars</TRANSCRIPT_STATS>"
}
```

### ARTIFACT C — Flush Checkpoint Ledger Schema (`state/rag_flush_ledger.json`)
```json
{
  "session_id": "rag_20260701_a",
  "mode": "QUERY",
  "tier": "sm",
  "num_ctx": 8192,
  "checkpoints": [
    { "id": "F2", "ts": "2026-07-01T10:02:11Z", "purged": ["retrieval_block(2.9k tok)", "think_trace(1.6k tok)"], "retained": "answer summary (~140 tok)", "window_pct_after": 22 }
  ],
  "evicted": { "ts": "2026-07-01T10:04:02Z", "model": "{{RAG_MODEL}}", "keep_alive": 0 },
  "law": "every ⟪ CHECKPOINT ⟫ in §2 writes one entry here BEFORE purging — an unlogged flush never happened. The final entry records eviction: a session that ends with the model still resident has not ended."
}
```

— END OF SKILL —
