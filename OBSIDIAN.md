# Connecting Obsidian to Ollama

Both are installed locally. This wires them together on one machine, with nothing
leaving it — Ollama answers from the laptop's own memory and CPU, and the vault is
read from disk.

There are **two connections**, and they are worth keeping separate in your head
because they fail differently:

| | What it is | Sees |
|---|---|---|
| **A — Obsidian → Ollama** | A community plugin inside Obsidian talks to the Ollama server. Chat in the sidebar, rewrite a selection, continue a paragraph. | The note you have open |
| **B — Vault → Ollama** | `tools/vault_rag.py` indexes the whole vault into embeddings and answers questions across it. | Everything you have written |

A is for writing. B is for remembering. Set up A first — it is three settings and
gives you something immediately. B is the one that makes the vault a corpus.

---

## 0. Check Ollama is actually serving

```bash
ollama list                       # what you have
curl http://localhost:11434/api/tags
```

If `curl` returns JSON, the server is up. If `ollama list` works but `curl` does
not, Ollama is installed but not running — start the tray app on Windows, or
`ollama serve`.

Pull what this system expects, if you have not:

```bash
ollama pull llama3.1:8b          # the sm tier — the everyday model
ollama pull nomic-embed-text     # embeddings; connection B needs this
```

Then make `dashboard.json` agree with reality:

```bash
python3 tools/reconcile_models.py            # report drift
python3 tools/reconcile_models.py --write    # apply it
```

**Sizing, on 16 GB shared with Windows.** An 8B model at Q4 is about 6 GB resident;
a 12–14B is about 10. That second number is most of your headroom, which is why
`md` is gated behind AC power and a quiet desktop, and why `sm` is the answer unless
a task specifically needs otherwise. Context length costs memory too — Ollama
allocates the KV cache when the model loads, so raising `num_ctx` to fit more text is
a decision to spend gigabytes, not a free quality knob.

---

## A. Obsidian → Ollama (in-app)

### A1. Open the vault

Obsidian → **Open folder as vault** → pick one:

- `Creative-Headquarters/vault/` — Content MDs, the studio's working memory
- `Creative-Writing/` — the Living Archive, 63 finished works

Both are plain markdown and can be open as separate vaults at the same time.

### A2. Let Obsidian through Ollama's origin check

**This is the step that gets skipped, and its symptom looks like a broken plugin.**

Ollama refuses cross-origin browser requests it does not recognize. Obsidian's
renderer is a browser, and its origin is `app://obsidian.md`, so a plugin's calls are
rejected before they reach a model. The plugin reports "failed to fetch" or "cannot
connect" while `curl` from a terminal works perfectly — which sends you debugging the
wrong half of the system.

```powershell
# Windows, once. Then fully quit Ollama from the tray and reopen it —
# setx affects new processes only.
setx OLLAMA_ORIGINS "app://obsidian.md"
```

```bash
# macOS/Linux equivalent, if you ever move the vault to another machine
export OLLAMA_ORIGINS="app://obsidian.md"
```

### A3. Install a plugin and point it at localhost

Settings → **Community plugins** → Browse. Any of these speak to Ollama:

- **Copilot** — chat sidebar over the current note or the whole vault; has a first-class Ollama provider
- **Smart Connections** — surfaces related notes as you write; runs local embeddings
- **Text Generator** — templated generation, custom endpoint

Wherever the plugin asks:

| Setting | Value |
|---|---|
| Provider / API | Ollama (or "custom / OpenAI-compatible") |
| Base URL | `http://localhost:11434` |
| Model | `llama3.1:8b` — whatever `ollama list` shows |
| API key | leave blank, or any placeholder if the field is required |

Plugin UIs move between versions, so treat the labels as a description of what to
look for rather than a path to follow. The three values are what matter.

**If a plugin offers to index your vault for its own semantic search**, know that it
writes several hundred megabytes of embeddings next to your notes — `.smart-env/`,
plugin `vectors/` folders. Those are gitignored in both repos (they are a
reconstructible copy of the whole corpus, and they churn constantly).

---

## B. Vault → Ollama (the RAG tool)

`tools/vault_rag.py` is `skills/local_rag_orchestration.skill.md` made executable:
same endpoint resolution, tier table, payload caps, `<think>` stripping, and model
eviction. Stdlib only — no numpy, no faiss, nothing to install.

```bash
python3 tools/vault_rag.py status      # endpoint, models, index freshness
```

### Index a vault

```bash
# this repo's vault/
python3 tools/vault_rag.py index

# or the writing archive
python3 tools/vault_rag.py index --vault ../Creative-Writing
```

Chunks every note at ~800 tokens with 120 of overlap, embeds each through Ollama, and
writes `state/rag_index/`. Re-running is cheap: a note whose content hash is unchanged
keeps its vectors, so adding one file re-embeds one file. The index is written every
20 chunks, so an interrupted run resumes instead of starting over.

Expect a few minutes for a full first pass over 60-odd notes, most of it Ollama
embedding rather than anything this script does.

### Ask across it

```bash
python3 tools/vault_rag.py ask "what did I decide about the Wyrmreach magic system"
python3 tools/vault_rag.py ask "which stories share the drowning motif" --json
```

Retrieves the 8 nearest chunks, keeps the best 4 that fit the tier's payload budget,
and answers **only** from them — with chunk ids you can trace back to files. It is
instructed to say the corpus does not contain the answer rather than fill the gap from
general knowledge, which is the entire point of grounding it in your work.

One index at a time. Indexing `Creative-Writing` replaces an index built over
`vault/`; `status` always names which vault the current one came from.

### Release the memory

```bash
python3 tools/vault_rag.py evict
```

Every call already sets `keep_alive: "5m"` so an abandoned session self-evicts, and
each command evicts on its way out. Use this when something died mid-run and you want
the gigabytes back before opening Photoshop.

---

## When it does not work

| Symptom | Cause |
|---|---|
| Plugin says "failed to fetch", `curl` works | `OLLAMA_ORIGINS` — step A2. Restart Ollama fully after setting it. |
| `Ollama not reachable`, from WSL2 | `localhost` inside WSL is the VM, not the laptop. The tool retargets to the WSL gateway on its own, but Windows still needs `OLLAMA_HOST=0.0.0.0` and an inbound rule for 11434 — [BOOT.md § 2](BOOT.md). |
| `model 'x' is not served` | The registry names a tag you have not pulled. `ollama pull x`, or `python3 tools/reconcile_models.py --write`. It fails loudly on purpose: a wrong model answering in place of the right one is worse than no answer. |
| Answers ignore recent notes | The index predates them. `status` lists what changed; re-run `index`. |
| Everything slows down, fans spin | Two models resident at once. `evict`, then index and query as separate passes. |
| `verify_system.py` still says BLOCKED | Not this. That is the brand-gate ladder — [BOOT.md](BOOT.md). |

---

## What is kept out of git

Obsidian and local AI plugins both write secrets and bulk state into the vault as a
side effect of ordinary use. `.gitignore` in this repo and in `Creative-Writing`
covers:

- **`.obsidian/plugins/*/data.json`** — where plugin API keys live. A paid-service
  key pasted into a plugin's settings lands here, and it is the single most likely
  way a credential reaches a remote. (`DECISIONS.md` § D5 records one that already
  did.) Force-add a specific plugin's file if you want its settings versioned.
- **`workspace.json`, `cache`, `.trash/`** — machine-local state. Churns every
  session, records which notes you had open, and in `.trash/`'s case keeps deleted
  notes fully readable on disk.
- **Embedding caches** — `.smart-env/`, `state/rag_index/`, `*.faiss`. Hundreds of
  megabytes, and a vectorized copy of everything you have written. Rebuildable from
  the notes in minutes.
- **`.env`, keys, certificates, tokens.**

Vault *settings* — hotkeys, appearance, which plugins are enabled — stay versioned on
purpose, so opening the vault on another machine gives you the same Obsidian.

`Creative-Writing/.gitignore` also reserves `_private/`, `99_Private/`, and
`*.private.md` for notes you want kept off the remote entirely. That is a convention
for what you write from here on — it does not affect anything already committed.
