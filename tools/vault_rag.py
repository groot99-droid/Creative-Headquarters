#!/usr/bin/env python3
"""
vault_rag.py -- connect an Obsidian vault to local Ollama.

This is the local implementation the archive has been missing (DECISIONS.md D1:
"graph_store.py (Neo4j) and vector_store.py (Pinecone) need local equivalents").
It is the executable counterpart to skills/local_rag_orchestration.skill.md -- same
endpoint resolution, same token budget law, same eviction contract -- runnable by
hand without a router turn.

    python3 tools/vault_rag.py status
    python3 tools/vault_rag.py index
    python3 tools/vault_rag.py ask "what did I decide about the Wyrmreach magic system"
    python3 tools/vault_rag.py evict

Point it at any vault, not just this repo's. `index` chooses the vault; `ask` reads
whichever vault the current index was built from, so it takes no --vault of its own:

    python3 tools/vault_rag.py index --vault ../Creative-Writing
    python3 tools/vault_rag.py ask "which stories share the drowning motif"

Nothing leaves the machine. Embeddings and answers are produced by the Ollama
process on this laptop; the vault is read, never written.

Stdlib only -- no numpy, no faiss. On a vault of a few thousand chunks a pure-Python
dot product over normalized vectors costs milliseconds, and a dependency that has to
be installed is a dependency that will be missing on first boot.

Exit codes: 0 ok | 1 problem with the index or the answer | 2 endpoint unreachable.
"""

import argparse
import base64
import hashlib
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from array import array
from datetime import datetime, timezone
from pathlib import Path

# Never die on the console's encoding. This tool prints the vault's own titles and paths,
# which carry em dashes and worse; a legacy Windows console (cp437) cannot encode them, and
# a UnicodeEncodeError after the model has already produced the answer throws away the work.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(errors="replace")
    except (AttributeError, OSError):
        pass  # not a reconfigurable stream (piped, redirected, or an older wrapper)

ROOT = Path(__file__).resolve().parent.parent
DASH = ROOT / "dashboard.json"
STATE = ROOT / "state"
INDEX_DIR = STATE / "rag_index"
INDEX_FILE = INDEX_DIR / "index.json"
TRACE_DIR = STATE / "rag_traces"

# Chunking, per skill section 2 step 3. Tokens are estimated as chars/4 throughout -- the
# same heuristic the skill's FLUSH_SELFCHECK uses, and close enough for budgeting.
CHARS_PER_TOKEN = 4
CHUNK_TOKENS = 800
OVERLAP_TOKENS = 120
CHECKPOINT_EVERY = 20  # CHECKPOINT-F1: persist a shard every N chunks

# Retrieval payload ceilings per tier, from the skill's section 2 table.
TIER_LIMITS = {
    "sm": {"num_ctx": 8192, "payload_tokens": 3000, "num_predict": 800},
    "md": {"num_ctx": 4096, "payload_tokens": 1200, "num_predict": 600},
}


# ── transport ────────────────────────────────────────────────────────────────

def wsl_gateway():
    """Under WSL2's default NAT, localhost is the VM. The Windows host is the gateway."""
    try:
        with open("/proc/version", encoding="utf-8") as f:
            if "microsoft" not in f.read().lower():
                return None
    except OSError:
        return None
    try:
        out = subprocess.run(["ip", "route", "show", "default"],
                             capture_output=True, text=True, timeout=5).stdout
        parts = out.split()
        return parts[2] if len(parts) > 2 else None
    except (OSError, subprocess.SubprocessError):
        return None


def post(endpoint, path, body, timeout):
    req = urllib.request.Request(
        f"{endpoint}{path}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def fetch_tags(endpoint):
    try:
        with urllib.request.urlopen(f"{endpoint}/api/tags", timeout=6) as r:
            return json.loads(r.read().decode())["models"]
    except (urllib.error.URLError, OSError, ValueError, KeyError):
        return None


def resolve_endpoint(override=None):
    """dashboard.json is the source of truth for the endpoint, and it does move (skill section 1 P2).

    Returns (endpoint, served_model_names). Exits 2 if nothing answers.
    """
    d = json.loads(DASH.read_text(encoding="utf-8"))
    endpoint = override or d["hardware"]["local_llm"]["endpoint"]

    served = fetch_tags(endpoint)
    if served is None and not override:
        gw = wsl_gateway()
        if gw:
            alt = re.sub(r"//[^:/]*", f"//{gw}", endpoint)
            if fetch_tags(alt) is not None:
                print(f"  note: reachable at {alt}, not {endpoint} -- from WSL, "
                      f"localhost is the VM", file=sys.stderr)
                endpoint, served = alt, fetch_tags(alt)

    if served is None:
        print(f"  Ollama not reachable at {endpoint}.\n"
              f"  Start it (`ollama serve`, or the tray app on Windows), or pass "
              f"--endpoint.\n"
              f"  From WSL2 the Windows side needs OLLAMA_HOST=0.0.0.0 and an inbound "
              f"rule for 11434 -- see BOOT.md section 2.", file=sys.stderr)
        sys.exit(2)
    return endpoint, [m["name"] for m in served]


def require_model(tag, served, what):
    """Verify the resolved tag is actually served (skill section 1 P2b).

    Matches on family, so llama3.1:8b is satisfied by llama3.1:8b-instruct-q4_K_M.
    Fails loudly rather than substituting: a wrong model answering in place of the
    right one is the failure this check exists to prevent.
    """
    family = tag.split(":")[0]
    if not any(n.split(":")[0] == family for n in served):
        print(f"  {what} '{tag}' is not served by this Ollama.\n"
              f"    installed: {', '.join(served) or '(none)'}\n"
              f"    fix:       ollama pull {tag}\n"
              f"    or reconcile the registry: python3 tools/reconcile_models.py --write",
              file=sys.stderr)
        sys.exit(1)


def evict(endpoint, model):
    """Release a resident model (skill section 2 step 8, the single-host law).

    On this machine a resident model holds gigabytes the next Blender or Photoshop
    job is about to be denied for. Handing back with a model still loaded is a
    protocol violation, not an optimization.
    """
    try:
        post(endpoint, "/api/generate", {"model": model, "keep_alive": 0}, timeout=15)
    except (urllib.error.URLError, OSError, ValueError):
        pass  # best effort; keep_alive "5m" on every call means it self-evicts anyway


# ── vectors ──────────────────────────────────────────────────────────────────

def pack(vec):
    """float32 + base64. A 768-dim vector is ~4 KB of JSON as raw floats and 1 KB packed."""
    return base64.b64encode(array("f", vec).tobytes()).decode()


def unpack(blob):
    a = array("f")
    a.frombytes(base64.b64decode(blob))
    return a


def normalize(vec):
    """Normalize at index time so retrieval is a dot product, not a cosine."""
    mag = sum(x * x for x in vec) ** 0.5
    return [x / mag for x in vec] if mag else list(vec)


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


# ── vault reading ────────────────────────────────────────────────────────────

def vault_files(vault: Path):
    """Every markdown note, minus scaffolding.

    Directories prefixed `_` are ignored by ingest (vault/README.md), as are the
    vault's own docs. Everything else -- including a plain writing vault with no
    Content MD frontmatter at all -- is corpus.
    """
    out = []
    for f in sorted(vault.rglob("*.md")):
        rel = f.relative_to(vault)
        if any(p.startswith("_") or p.startswith(".") for p in rel.parts[:-1]):
            continue
        if rel.name in ("SCHEMA.md", "README.md"):
            continue
        out.append(f)
    return out


def strip_frontmatter(text):
    """Return (frontmatter_dict_ish, body). Only the fields worth carrying into a citation."""
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    fm, body = text[3:end], text[end + 4:]
    meta = {}
    for line in fm.splitlines():
        m = re.match(r"^(\w[\w_]*):\s*(.+?)\s*$", line)
        if m and m.group(1) in ("title", "kind", "project", "status", "id"):
            meta[m.group(1)] = m.group(2).strip('"\'')
    return meta, body


def chunk(text, size_tokens=CHUNK_TOKENS, overlap_tokens=OVERLAP_TOKENS):
    """Split on paragraph boundaries, packing up to the token budget, with overlap.

    Paragraph-aligned rather than a blind character window: a chunk that starts
    mid-sentence retrieves badly and quotes worse.
    """
    size, overlap = size_tokens * CHARS_PER_TOKEN, overlap_tokens * CHARS_PER_TOKEN
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks, cur = [], ""
    for p in paras:
        if cur and len(cur) + len(p) + 2 > size:
            chunks.append(cur)
            cur = (cur[-overlap:] + "\n\n" + p) if overlap else p
        else:
            cur = f"{cur}\n\n{p}" if cur else p
        # A single paragraph longer than the budget (a long prose block) still has
        # to be broken, or it becomes an unretrievable chunk that blows the payload.
        while len(cur) > size * 1.5:
            chunks.append(cur[:size])
            cur = cur[size - overlap:]
    if cur.strip():
        chunks.append(cur)
    return chunks


# ── index ────────────────────────────────────────────────────────────────────

def load_index():
    if not INDEX_FILE.exists():
        return None
    try:
        return json.loads(INDEX_FILE.read_text(encoding="utf-8"))
    except ValueError:
        return None


def save_index(idx):
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    tmp = INDEX_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(idx, ensure_ascii=False), encoding="utf-8")
    tmp.replace(INDEX_FILE)  # atomic: a half-written index is worse than none


def cmd_index(args):
    vault = Path(args.vault).resolve()
    if not vault.is_dir():
        print(f"  no vault at {vault}", file=sys.stderr)
        return 1

    endpoint, served = resolve_endpoint(args.endpoint)
    d = json.loads(DASH.read_text(encoding="utf-8"))
    embed_model = args.embed_model or d["hardware"]["local_llm"]["embed_model"]
    require_model(embed_model, served, "embedding model")

    files = vault_files(vault)
    if not files:
        print(f"  {vault} has no notes to index", file=sys.stderr)
        return 1

    old = load_index() or {}
    reusable = {}
    if old.get("vault") == str(vault) and old.get("embed_model") == embed_model:
        for c in old.get("chunks", []):
            reusable.setdefault(c["file_hash"], []).append(c)

    print(f"  vault    {vault}")
    print(f"  endpoint {endpoint}")
    print(f"  embed    {embed_model}")
    print(f"  files    {len(files)}")

    chunks, n_embedded, n_reused, seq = [], 0, 0, 0
    t0 = time.time()

    for f in files:
        rel = str(f.relative_to(vault))
        raw = f.read_text(encoding="utf-8", errors="replace")
        fh = hashlib.sha256(raw.encode()).hexdigest()[:16]

        # Unchanged file: reuse its vectors. Re-embedding a 65-note vault to add one
        # note is minutes of a 16 GB laptop's attention for no new information.
        if fh in reusable:
            for c in reusable[fh]:
                c = dict(c, id=f"c_{seq:04d}")
                seq += 1
                chunks.append(c)
            n_reused += len(reusable[fh])
            continue

        meta, body = strip_frontmatter(raw)
        title = meta.get("title") or re.sub(r"^\d+_", "", f.stem).replace("_", " ")

        for part in chunk(body):
            try:
                r = post(endpoint, "/api/embeddings",
                         {"model": embed_model, "prompt": part, "keep_alive": "5m"},
                         timeout=120)
                vec = r["embedding"]
            except (urllib.error.URLError, OSError, ValueError, KeyError) as e:
                print(f"\n  embedding failed on {rel}: {e}", file=sys.stderr)
                save_index({"vault": str(vault), "embed_model": embed_model,
                            "built": datetime.now(timezone.utc).isoformat(),
                            "partial": True, "chunks": chunks})
                print(f"  partial index saved ({len(chunks)} chunks) -- re-run to resume",
                      file=sys.stderr)
                return 1

            chunks.append({
                "id": f"c_{seq:04d}", "file": rel, "title": title,
                "kind": meta.get("kind", ""), "file_hash": fh,
                "text": part, "vec": pack(normalize(vec)),
            })
            seq += 1
            n_embedded += 1

            # CHECKPOINT-F1 -- persist the shard, do not hold the whole corpus in
            # memory waiting for a clean finish that may not come.
            if n_embedded % CHECKPOINT_EVERY == 0:
                save_index({"vault": str(vault), "embed_model": embed_model,
                            "built": datetime.now(timezone.utc).isoformat(),
                            "partial": True, "chunks": chunks})
                if sys.stdout.isatty():
                    print(f"\r  embedding... {n_embedded} new chunks", end="", flush=True)

    save_index({
        "vault": str(vault), "embed_model": embed_model,
        "built": datetime.now(timezone.utc).isoformat(),
        "partial": False, "chunks": chunks,
        "dims": len(unpack(chunks[0]["vec"])) if chunks else 0,
    })
    evict(endpoint, embed_model)

    print(f"{chr(13) if sys.stdout.isatty() else ''}  indexed  {len(chunks)} chunks "
          f"({n_embedded} embedded, {n_reused} reused) in {time.time() - t0:.1f}s")
    print(f"  written  {INDEX_FILE.relative_to(ROOT)} "
          f"({INDEX_FILE.stat().st_size / 1e6:.1f} MB)")
    print(f"  evicted  {embed_model}")
    return 0


# ── ask ──────────────────────────────────────────────────────────────────────

QUERY_SUBPROMPT = """\
You are answering from the studio's private corpus. Use ONLY the retrieval block \
below; if it does not contain the answer, say so plainly -- do not fill gaps from \
general knowledge.
Cite chunk ids in square brackets like [c_0412] after each claim.
Question: {question}
<RETRIEVAL>
{retrieval}
</RETRIEVAL>
Answer in at most {max_words} words. Put your final answer after the line 'ANSWER:'."""


def cmd_ask(args):
    idx = load_index()
    if not idx or not idx.get("chunks"):
        print("  no index yet -- run: python3 tools/vault_rag.py index", file=sys.stderr)
        return 1
    if idx.get("partial"):
        print("  warning: index is partial, a previous run did not finish", file=sys.stderr)

    endpoint, served = resolve_endpoint(args.endpoint)
    d = json.loads(DASH.read_text(encoding="utf-8"))
    llm = d["hardware"]["local_llm"]
    tier = args.tier
    model = args.model or llm["tiers"][tier]["model"]
    embed_model = idx["embed_model"]
    limits = TIER_LIMITS[tier]

    require_model(embed_model, served, "embedding model")
    require_model(model, served, f"tier '{tier}' model")

    # 1. Embed the question with the same model the index was built with. A query
    #    embedded by a different model lands in a different space and retrieves noise.
    try:
        qv = normalize(post(endpoint, "/api/embeddings",
                            {"model": embed_model, "prompt": args.question,
                             "keep_alive": "5m"}, timeout=60)["embedding"])
    except (urllib.error.URLError, OSError, ValueError, KeyError) as e:
        print(f"  could not embed the question: {e}", file=sys.stderr)
        return 1
    evict(endpoint, embed_model)  # never hold both models resident on 16 GB

    # 2. Retrieve top-k, then trim to the tier's payload cap. Scores are similarity
    #    order, not a cross-encoder rerank -- the ranking is honest about being cheap.
    scored = sorted(
        ((dot(qv, unpack(c["vec"])), c) for c in idx["chunks"]),
        key=lambda s: s[0], reverse=True,
    )[: args.top_k]

    cap = limits["payload_tokens"] * CHARS_PER_TOKEN
    budget, kept = cap, []
    for score, c in scored:
        if len(kept) >= args.rerank_to:
            break
        if len(c["text"]) > budget:
            continue  # skip an oversized chunk, keep filling from the ones below it
        kept.append((score, c))
        budget -= len(c["text"])
    if not kept:
        # Every candidate is bigger than the whole payload cap. Truncate the best one
        # rather than answering from nothing.
        best = scored[0]
        kept = [(best[0], dict(best[1], text=best[1]["text"][:cap]))]

    retrieval = "\n\n".join(
        f"[{c['id']}] ({c['title']} -- {c['file']})\n{c['text']}" for _, c in kept
    )
    prompt = QUERY_SUBPROMPT.format(question=args.question, retrieval=retrieval,
                                    max_words=args.max_words)

    # 3. Generate. No system field, temperature 0.6, keep_alive 5m -- skill ARTIFACT A.
    try:
        r = post(endpoint, "/api/generate", {
            "model": model, "prompt": prompt, "stream": False, "keep_alive": "5m",
            "options": {"temperature": 0.6, "top_p": 0.95,
                        "num_ctx": limits["num_ctx"],
                        "num_predict": limits["num_predict"]},
        }, timeout=600)
    except (urllib.error.URLError, OSError, ValueError) as e:
        print(f"  generation failed: {e}", file=sys.stderr)
        return 1
    finally:
        evict(endpoint, model)

    raw = r.get("response", "")

    # 4. Strip <think>. A reasoning model's trace is archived for audit and never
    #    shown or re-fed -- it is the largest thing in the window and the least useful.
    think = "\n".join(re.findall(r"<think>(.*?)</think>", raw, re.S))
    answer = re.sub(r"<think>.*?</think>", "", raw, flags=re.S).strip()
    answer = re.sub(r"^ANSWER:\s*", "", answer, flags=re.M).strip()
    if think:
        TRACE_DIR.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        (TRACE_DIR / f"{stamp}.txt").write_text(think, encoding="utf-8")

    used = r.get("prompt_eval_count") or len(prompt) // CHARS_PER_TOKEN
    pct = round(100 * used / limits["num_ctx"])

    if args.json:
        print(json.dumps({
            "question": args.question, "answer": answer, "model": model, "tier": tier,
            "sources": [{"id": c["id"], "file": c["file"], "title": c["title"],
                         "score": round(s, 4)} for s, c in kept],
            "context_used_pct": pct,
        }, indent=2, ensure_ascii=False))
    else:
        print(f"\n{answer}\n")
        print("  sources")
        for s, c in kept:
            print(f"    [{c['id']}] {s:.3f}  {c['file']}")
        print(f"\n  {model} | tier {tier} | window {pct}% of {limits['num_ctx']}"
              + (f" | think trace archived" if think else ""))
        if pct >= 60:
            print("  window past 60% -- the skill's session ceiling. Next question "
                  "should start clean.")

    # 5. Write the window reading back to the dashboard (skill section 2 step 6).
    if args.write_dashboard:
        llm["context_used_pct"] = pct
        llm["loaded_tier"] = tier
        DASH.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print("  dashboard.json updated (context_used_pct, loaded_tier)")
    return 0


# ── status ───────────────────────────────────────────────────────────────────

def cmd_status(args):
    endpoint, served = resolve_endpoint(args.endpoint)
    d = json.loads(DASH.read_text(encoding="utf-8"))
    llm = d["hardware"]["local_llm"]

    print(f"  endpoint  {endpoint}  ok")
    print(f"  serving   {', '.join(served) or '(none)'}")
    for tier, spec in llm["tiers"].items():
        fam = spec["model"].split(":")[0]
        hit = [n for n in served if n.split(":")[0] == fam]
        print(f"  tier {tier}    {spec['model']:<24} "
              + (f"ok ({hit[0]})" if hit else "MISSING -- ollama pull " + spec["model"]))
    em = llm["embed_model"]
    print(f"  embed     {em:<24} "
          + ("ok" if any(n.split(":")[0] == em.split(":")[0] for n in served)
             else "MISSING -- ollama pull " + em))

    idx = load_index()
    if not idx:
        print(f"  index     none -- run: python3 tools/vault_rag.py index")
        return 0

    vault = Path(idx["vault"])
    print(f"  index     {len(idx['chunks'])} chunks from {vault}")
    print(f"            built {idx['built']}"
          + ("  (PARTIAL)" if idx.get("partial") else ""))

    if vault.is_dir():
        built = datetime.fromisoformat(idx["built"]).timestamp()
        stale = [str(f.relative_to(vault)) for f in vault_files(vault)
                 if f.stat().st_mtime > built]
        if stale:
            print(f"            {len(stale)} note(s) changed since -- reindex: "
                  f"{', '.join(stale[:3])}{'...' if len(stale) > 3 else ''}")
        else:
            print("            fresh")
    else:
        print(f"            vault path no longer exists")
    return 0


def cmd_evict(args):
    endpoint, served = resolve_endpoint(args.endpoint)
    d = json.loads(DASH.read_text(encoding="utf-8"))
    llm = d["hardware"]["local_llm"]
    for tag in [t["model"] for t in llm["tiers"].values()] + [llm["embed_model"]]:
        evict(endpoint, tag)
        print(f"  released {tag}")
    return 0


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--endpoint", help="override the dashboard's Ollama endpoint")
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("status", help="endpoint, models, index freshness")
    s.set_defaults(fn=cmd_status)

    s = sub.add_parser("index", help="chunk + embed a vault into state/rag_index/")
    s.add_argument("--vault", default=str(ROOT / "vault"),
                   help="vault directory (default: this repo's vault/)")
    s.add_argument("--embed-model", help="override the dashboard's embed_model")
    s.set_defaults(fn=cmd_index)

    s = sub.add_parser("ask", help="answer a question from the indexed vault")
    s.add_argument("question")
    s.add_argument("--tier", choices=["sm", "md"], default="sm",
                   help="sm is the answer unless the task specifically needs md")
    s.add_argument("--model", help="override the tier's model")
    s.add_argument("--top-k", type=int, default=8, help="candidates retrieved")
    s.add_argument("--rerank-to", type=int, default=4,
                   help="candidates that survive into the prompt (skill section 2 step 4a)")
    s.add_argument("--max-words", type=int, default=250)
    s.add_argument("--json", action="store_true")
    s.add_argument("--write-dashboard", action="store_true",
                   help="write context_used_pct and loaded_tier back to dashboard.json")
    s.set_defaults(fn=cmd_ask)

    s = sub.add_parser("evict", help="release every resident model")
    s.set_defaults(fn=cmd_evict)

    args = ap.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
