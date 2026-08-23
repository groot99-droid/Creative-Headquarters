# local_rag_orchestration.skill.md — LOCAL RAG / DEEPSEEK-R1 ORCHESTRATION EXECUTABLE
### Studio Headless OS · Skill 7/8 · Four-Part Artifact Architecture

---

## 0. ROUTING HEADER (Part 1 of 4)

```yaml
skill_id: local_rag_orchestration
version: 1.0
trigger_a: ["search my docs", "recall", "summarize corpus", "RAG", "DeepSeek", "what did we decide", "project memory"]
trigger_b: ["corpus dirs: /project/docs /project/notes", "pipeline research phases"]
mandatory_context: [memory_discipline]
writes_dashboard_keys: [hardware.local_llm.context_used_pct]
danger_class: LOCAL_COMPUTE_HEAVY
target_model: DeepSeek-R1-671B (local, e.g. Ollama/llama.cpp endpoint)
```

R1 is a reasoning model with a long visible `<think>` phase. It is powerful and it is a context hog: reasoning tokens count against the window, and retrieval bloat degrades it faster than it degrades a chat model. This skill exists to keep the window lean via **hard flush checkpoints** and to speak to R1 in the exact prompt dialect it rewards (ARTIFACT B).

---

## 1. PREREQUISITES & STATE VERIFICATION (Part 2 of 4)

```bash
# P1 — Attestation exists
grep -q "ROUTER INTERCEPT" ./.task_scratch/attestation.txt || echo "FAIL:P1"

# P2 — Endpoint live + model resident
# Endpoint comes from dashboard state, never a literal — hardware.local_llm.endpoint
# is the single source of truth and it does move (remote node, alternate port).
RAG_ENDPOINT=$(python3 -c "import json;print(json.load(open('dashboard.json'))['hardware']['local_llm']['endpoint'])")
curl -s --max-time 6 "$RAG_ENDPOINT/api/tags" \
  | python3 -c "import sys,json;names=[m['name'] for m in json.load(sys.stdin).get('models',[])];exit(0 if any('deepseek-r1' in n for n in names) else 1)" \
  && echo "OK:P2" || echo "FAIL:P2 deepseek-r1 not served"

# P3 — Context budget check BEFORE loading anything (hardware gate cross-check)
python3 - <<'PY'
import json
d=json.load(open("dashboard.json"))
pct=d["hardware"]["local_llm"]["context_used_pct"]
print("OK:P3" if pct < 50 else "FAIL:P3 window already %d%% — flush first" % pct)
PY

# P4 — Vector index exists and is fresher than the corpus
[ -f state/rag_index/index.faiss ] && \
[ "$(find /project/docs /project/notes -newer state/rag_index/index.faiss -type f | wc -l)" -eq 0 ] \
  && echo "OK:P4" || echo "WARN:P4 reindex required before query"
```

State verification (agent-level):
- **V1:** `memory_discipline` context defines what is quotable vs. summarizable from the corpus — load it before writing any answer.
- **V2:** Confirm which of the three modes applies: `INDEX`, `QUERY`, or `SYNTHESIS`. Each has its own flush schedule (§2). Never mix modes in one R1 session.

---

## 2. EXECUTION PROCESS (Part 3 of 4)

**Token budget law (131,072-token window):** retrieval payload ≤ 24k tokens per hop · R1 reasoning reserve ≥ 32k · running session ceiling 60% — crossing 60% forces CHECKPOINT-F immediately, mid-task if necessary.

1. **UNPACK** — Load ARTIFACT A (request payloads) and ARTIFACT B (routing sub-prompts).
2. **MODE ROUTE** — Classify the task with the `ROUTER_SUBPROMPT` (ARTIFACT B) via a *small, cheap* R1 call (`max_tokens: 400`). Output is one word: `INDEX | QUERY | SYNTHESIS`.
3. **INDEX mode** — Chunk corpus (800-token chunks, 120 overlap) → embed → write `state/rag_index/`. No R1 calls except chunk-title generation in batches of 20.
   **⟪ CHECKPOINT-F1 ⟫** after every 20 chunks: persist index shard to disk, drop chunk text from working memory, keep only the shard manifest.
4. **QUERY mode** —
   a. Embed question → retrieve top-k=8 → rerank to 4 → assemble retrieval block (≤ 24k tokens, hard-truncate lowest-ranked first).
   b. Build the R1 call from ARTIFACT B `QUERY_SUBPROMPT` (note: instructions live in the **user turn** — R1 official guidance is *no system prompt*; temperature 0.6).
   c. Call R1; strip the `<think>…</think>` block from the answer before it goes anywhere downstream; archive the think block to `state/rag_traces/` (audit only, never re-fed).
   **⟪ CHECKPOINT-F2 ⟫** after each answered question: write answer + source chunk-ids to dashboard event_log; PURGE retrieval block and think trace from working memory. Only the ≤10-line answer summary survives to the next question.
5. **SYNTHESIS mode** (multi-doc reports) — map-reduce:
   a. MAP: per document, one R1 call with `MAP_SUBPROMPT` → ≤300-token structured note.
   **⟪ CHECKPOINT-F3 ⟫** after each MAP call: note → disk (`state/rag_notes/{doc}.md`), source doc evicted from memory.
   b. REDUCE: single R1 call with `REDUCE_SUBPROMPT` over the notes only (never the originals).
6. **WINDOW REPORT** — Estimate tokens consumed (chars/4 heuristic or endpoint's `prompt_eval_count`); write `hardware.local_llm.context_used_pct` to dashboard.
7. **⟪ CHECKPOINT-F4 / final ⟫** — Persist outputs; working memory reduced to file paths + one-paragraph result. If a follow-up question arrives, start at step 2 with a fresh session — R1 sessions are disposable by design; the disk is the memory.

---

## 3. EMBEDDED ARTIFACTS (Part 4 of 4)

### ARTIFACT A — Request Payloads (Ollama-style local endpoint)
```json
{
  "r1_generate": {
    "endpoint": "POST http://localhost:11434/api/generate",
    "body": {
      "model": "deepseek-r1:671b",
      "prompt": "{{subprompt_with_task_and_retrieval}}",
      "stream": false,
      "options": { "temperature": 0.6, "top_p": 0.95, "num_ctx": 131072, "num_predict": 4096 }
    },
    "laws": [
      "NO system field — R1 guidance: all instructions in the user prompt",
      "temperature 0.5–0.7 (0.6 default); 0.0 causes repetition loops on R1",
      "never few-shot R1 — examples degrade its reasoning; describe the format instead",
      "always strip <think>…</think> before storing or displaying the answer"
    ]
  },
  "r1_router_call": {
    "note": "same endpoint, options.num_predict: 400 — classification must stay cheap",
    "body_overrides": { "options": { "temperature": 0.3, "num_predict": 400 } }
  },
  "embed": {
    "endpoint": "POST http://localhost:11434/api/embeddings",
    "body": { "model": "nomic-embed-text", "prompt": "{{chunk_or_query}}" }
  }
}
```

### ARTIFACT B — Routing Sub-Prompts (R1-optimized: directive, format-described, zero-shot)
```json
{
  "ROUTER_SUBPROMPT": "Classify the task below into exactly one mode and output ONLY that word on the final line after your reasoning.\nModes: INDEX (corpus must be chunked/embedded before anything else) | QUERY (answerable from retrieval over an existing index) | SYNTHESIS (requires reading multiple documents and producing a combined report).\nTask: {{task_text}}\nFinal line format: MODE: <INDEX|QUERY|SYNTHESIS>",

  "QUERY_SUBPROMPT": "You are answering from the studio's private corpus. Use ONLY the retrieval block below; if it does not contain the answer, say so plainly — do not fill gaps from general knowledge.\nCite chunk ids in square brackets like [c_0412] after each claim.\nQuestion: {{question}}\n<RETRIEVAL>\n{{ranked_chunks_with_ids}}\n</RETRIEVAL>\nAnswer in at most {{max_words}} words. Put your final answer after the line 'ANSWER:'.",

  "MAP_SUBPROMPT": "Read the single document below and produce a structured note of AT MOST 300 tokens with exactly these sections: DECISIONS (bullet list), OPEN_QUESTIONS (bullet list), FACTS (bullet list with dates), QUOTE_CANDIDATES (max 2 short verbatim quotes with location). No preamble, no conclusion.\n<DOC id=\"{{doc_id}}\">\n{{doc_text}}\n</DOC>",

  "REDUCE_SUBPROMPT": "Below are structured notes distilled from {{n}} documents. Synthesize them into a report with sections: SUMMARY (≤150 words), TIMELINE, DECISIONS_IN_FORCE, CONTRADICTIONS (flag any note that conflicts with another, by doc id), NEXT_ACTIONS. Work only from the notes — the original documents are not available and must not be imagined.\n<NOTES>\n{{all_map_notes}}\n</NOTES>",

  "FLUSH_SELFCHECK_SUBPROMPT": "Estimate in one line whether the conversation so far exceeds 60% of a 131072-token window (chars/4 heuristic). Output exactly 'FLUSH: yes' or 'FLUSH: no'.\n<TRANSCRIPT_STATS>{{char_count}} chars</TRANSCRIPT_STATS>"
}
```

### ARTIFACT C — Flush Checkpoint Ledger Schema (`state/rag_flush_ledger.json`)
```json
{
  "session_id": "rag_20260701_a",
  "mode": "QUERY",
  "checkpoints": [
    { "id": "F2", "ts": "2026-07-01T10:02:11Z", "purged": ["retrieval_block(23.1k tok)", "think_trace(8.4k tok)"], "retained": "answer summary (~140 tok)", "window_pct_after": 22 }
  ],
  "law": "every ⟪ CHECKPOINT ⟫ in §2 writes one entry here BEFORE purging — an unlogged flush never happened"
}
```

— END OF SKILL —
