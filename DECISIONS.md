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

---

## D6 — The unit of memory is the Content MD, not a live variable ledger

**Superseded:** the reading in the merged consolidation that
`dashboard.json → active_variables` (`character_uuid`, `seed_lock`,
`style_ref_id`, `style_ref_id_prev`) was a spec for persistent creative identity
threaded across tool calls. Those were sample values, never a design. Router §6's
"never delete a key; supersede with `_prev`" rule was built for that reading and
is removed with it.

**In force:** every task reads and writes exactly one **Content MD** — a markdown
note recording the exact steps that made one thing, living in an Obsidian vault
the author edits directly. Full spec: `vault/SCHEMA.md`.

The properties that follow from it:

- **No session state survives between tasks.** A Content MD is read cold and must
  be sufficient to resume. That constraint is what keeps the notes honest: what the
  file does not say is genuinely lost, so the file says it.
- **The vault is the source of truth; the archive indexes it.** Not the reverse.
  The work stays readable, diffable, and portable with none of this running.
- **Self-learning is corpus growth.** Past Content MDs are precedent — what was
  made, decided, rejected — and that is what §5's ladder derives from. Nothing
  learns weights; the system gets better because the record gets richer.
- **The cosmos view is the vault rendered.** `GraphVisualization.jsx` over notes
  and their links, `NodeDetail.jsx` showing Overview + Next Steps for whatever is
  selected.

`dashboard.json → active_variables` now holds run-scoped state only, with a `_note`
saying so.

---

## D7 — The Router is mode-aware; autonomous never waits on a human

`dashboard.json` declared `"mode": "autonomous"` with a three-value enum that
`Router.md` never read. Its only escape hatch was an unconditional *"ask the
operator"* — a supervised design wearing an autonomous label.

**In force:** §4 reads the mode, and §5 defines a four-level **context resolution
ladder** — L0 authored file, L1 recalled decision, L2 derived precedent, L3
nothing — with a per-mode gate on what happens at each level.

The reframing that makes autonomy coherent: **autonomous does not mean it never
stops; it means it never waits.** When a task cannot be grounded, the Router writes
the blocker into the Content MD's Next Steps, sets `status: blocked`, and routes
the next task. The work stops. The system does not. A human returning later reads
why, in the note.

Two floors hold in every mode, autonomy included:

- **L3 parks in every mode.** No authored file, no recalled decision, no precedent
  means nothing to ground on — and output not grounded in input plus matched
  context is not this system's output. Parking is the correct result.
- **Derived is never presented as authored.** L2 constraints carry their confidence
  and their sources into the attestation and into the Content MD. Deriving is
  permitted; laundering the provenance is refused.

This also resolves the `context/brand/` blocker from the consolidation. Those ten
files being unauthored no longer halts every route — the ladder resolves them from
the vault, and authoring one promotes it to L0 permanently.

### D6 addendum — five skill files carry stale state references

`active_variables` becoming run-scoped broke assumptions in five of the eight
skills, which gate execution on it and HALT on mismatch:

| skill | stale gate |
|---|---|
| `adobe_firefly` | V1 `style_ref_id` ledger check, V2 `master_palette` lock, §2.7 `_prev` supersede |
| `higgsfield_api` | V1 `character_uuid` vs. continuity state machine, `seed_lock`, `aspect_ratio` |
| `blender_python` | V1 `fps`/`aspect_ratio` parity, `seed_lock` → deterministic geometry |
| `css_html_ui` | P3 design-token parity against `master_palette` |
| `suno_audio` | V1 `audio_bpm`/`audio_key` continuity locks |

Each now carries a MIGRATION PENDING banner: read those gates against the task's
Content MD (`## Decisions in Force`, `## Method`) rather than the dashboard, and
read "ask the operator" as §5's mode gate. **Do not repopulate `active_variables`
to satisfy a gate literally** — that reintroduces exactly the layer D6 removes.

Rewriting the five properly is deferred: each needs its Four-Part Architecture
reworked around Content MD read/write, and doing that before one skill has been
run end to end would be guessing at the shape. `brush_designer` should be written
first as the reference implementation, then these five follow its pattern.
