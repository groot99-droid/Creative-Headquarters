# Architecture Decisions

Decisions in force for Studio Headless OS. Each records what was chosen, what it
rules out, and what it obliges the next pass to do.

---

## D1 — The memory layer is local-first

**Chosen:** Ollama-served local model + on-disk vector index, single process.

**Rejected:** the cloud stack the Living Archive Engine currently ships
(Groq + Neo4j + Pinecone + Postgres + Redis + Celery, seven Docker services).

**Why:** `dashboard.json → hardware` already describes the target machine — Mac
Studio M3 Ultra, 192 GB unified memory, DeepSeek-R1-671B at
`http://localhost:11434`. `skills/local_rag_orchestration.skill.md` is written
end to end against that endpoint: Ollama request payloads, a 131,072-token
budget law, R1-specific prompt rules (no system field, temperature 0.6, strip
`<think>`), and FAISS shards under `state/rag_index/`. The engine's code was
written against an entirely different substrate. The skill file is the
specification; the engine is the implementation that has to move.

**Not yet done.** The engine was consolidated *as written* — cloud and all.
Nothing was rewritten in this pass. What that obliges:

- `archive/backend/app/services/ai_engine.py` targets Groq via the OpenAI client.
  Its classification prompt and JSON contract are the valuable part and should
  survive; the transport should move to the Ollama endpoint.
- `graph_store.py` (Neo4j) and `vector_store.py` (Pinecone) need local
  equivalents. `vector_store.py` already imports Pinecone lazily inside
  `try/except` and degrades without it, so it is the easier of the two.
- `app/tasks/reorganization.py` is two stub Celery tasks that return literals.
  Local-first probably means no Redis and no Celery — re-home them before
  building on them.
- `pinecone` is left commented out in `requirements.txt` for this reason.

---

## D2 — The brush generator becomes a routed executable skill

**Chosen:** wrap the DOM-free core in a programmatic API the Router and agents
can call, and write `skills/brush_designer.skill.md` in the Four-Part Artifact
Architecture. The existing UI stays as the manual surface.

**Rejected:** embedding the UI as a control-room panel with no programmatic
entry — that makes it a bookmark inside HQ rather than a capability.

**Why it's feasible:** the app is already split along the right seam. Verified by
inspection:

| Module | DOM references | Role |
|---|---|---|
| `editor/BrushState.js` | **0** | State, ranges, `toExportFormat()`, `createBrushObject()`, `toJSON`/`fromJSON` |
| `generators/ShapeGenerator.js` | 1 | Shape synthesis |
| `generators/GrainGenerator.js` | 1 | Grain synthesis |
| `export/BrushExporter.js` | 5 | `static async exportBrush(brushState, shapeCanvas, grainCanvas)`, `exportBrushset(name, brushes)` |

`BrushState` is already fully headless. The generators and exporter touch the DOM
only for `<canvas>`, which is substitutable with `OffscreenCanvas` or a Node
canvas. No core rewrite is needed — the work is a thin adapter plus the skill file.

**Not yet done.** No adapter and no skill file in this pass; `skills/` still holds
eight files, not nine. The tool sits at `tools/brush-designer/` and runs
standalone exactly as it did before.

---

## D3 — Living Archive's canonical source is crispy-engine

`groot99-droid/Living-Archive` and `groot99-droid/crispy-engine` are the same
project. Verified file by file: all 27 shared files are **byte-identical**, and
crispy-engine additionally contains nine files Living-Archive never had —
including the five modules Living-Archive's own imports referenced but that were
never committed to it on any branch:

```
ai_engine.py  graph_store.py  vector_store.py  api.js  websocket.js
```

plus `README.md`, `DEPLOY.md`, `docker-compose.yml`, `setup.sh`.

Living-Archive is a partial upload of crispy-engine, missing its core. Its only
unique file is `.github/workflows/webpack.yml` — a webpack action on a Vite
project, not carried over.

**Everything under `archive/` came from crispy-engine.** Once this branch merges,
both source repos can be archived on GitHub.

---

## D4 — Directory structure was derived, not invented

Both source projects shipped flat: every file at repo root, while the code
imported `app.config`, `app.api.*`, `app.services.*`, `./components/*`,
`./services/api`. Nothing ran.

The tree under `archive/` is reconstructed from three independent sources that
agree with each other:

1. **The import graph** — `from app.services.ai_engine import ai_engine` fixes
   that file's path exactly.
2. **`render.yaml`** — `rootDir: backend`, `rootDir: frontend`,
   `dockerCommand: celery -A app.tasks.reorganization worker`. That last one is
   why `reorganization.py` is at `app/tasks/`, not `app/services/`.
3. **`docker-compose.yml`** — `build: ./backend`, `build: ./frontend`,
   backend on `:8000` with `./backend:/app` mounted.

Every Python and JSX import was verified to resolve against the result.

**Two files were newly written** because the deploy configs require them and they
never existed: `archive/backend/Dockerfile` and
`archive/backend/requirements.txt`. Both are derived from what the code actually
imports. Neither has been installed or run — see the caveat in the README.

---

## D5 — A third-party Groq key was scrubbed during consolidation

`crispy-engine`'s `DEPLOY.md` carried a `gsk_` key in plaintext, labeled "already
configured in `.env`". It came into `archive/` with the consolidation and tripped
GitHub push protection.

Per the repo owner it is not his key, is not active, and was copied from a public
Reddit post. No rotation is needed. It stays redacted anyway for two practical
reasons: push protection blocks the string regardless of whether it works, and
republishing someone else's credential into a public repo is not worth the
argument.

Other `gsk_`/`sk-` strings across the repo were checked and are documentation
placeholders.

`archive/backend/app/config.py` reads every secret from the environment with empty
defaults and `docker-compose.yml` passes them through as `${GROQ_API_KEY}`, so
`.env` is the only place a real value belongs. `.gitignore` now covers it.
