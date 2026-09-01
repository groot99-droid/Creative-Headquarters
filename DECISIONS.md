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
`http://localhost:11434`. *(Machine superseded by § D8: one Lenovo Yoga Book 9i,
16 GB, tiered local models. The decision itself — local-first, single process, no
seven-service cloud stack — survives the move and is now a memory requirement rather
than a preference. Only the hardware it cites has changed.)* `skills/local_rag_orchestration.skill.md` is written
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

---

## D8 — The studio is one Windows laptop, not a Mac host plus a CUDA node

**Chosen:** a single host — a **Lenovo Yoga Book 9i** (16 GB soldered, Intel integrated
graphics, no CUDA), driven from **Claude Code desktop on Windows**, with local models
served by Ollama on the same machine. Bash blocks may run under Git Bash or WSL2; both
are supported and the probe distinguishes them.

**Rejected:** keeping the two-machine topology (macOS host for Adobe and orchestration,
LAN CUDA node for rendering) and treating the laptop as a third client.

**Why:** the two-machine assumption was not a preference expressed in prose — it was
compiled into the gates. `hardware_compute` probed with `sysctl`/`vm_stat`, required
`host.kind ∈ {linux, windows}` *with* an available discrete GPU for `render_3d`, and set
`memory.available_gb_min: 140` for a 671B model. `adobe_suite_uxp` executed every script
through `osascript`. `blender_python` looked for Blender at
`/Applications/Blender.app/…` and set `cycles.device = "GPU"`. On this laptop each of
those is not slower — it is a hard failure at execution, and several of them fail
*silently*, which is worse.

**What changed, and what each change costs:**

1. **Probe rewritten** (`hardware_compute` v2.0, ARTIFACT A). One host, three shells.
   Memory, power, thermals and disk come through a PowerShell bridge under Windows and
   WSL; `/proc` is used only on native Linux. New: `power.source` and
   `thermal.cpu_perf_pct`.
2. **Thresholds re-cut, not softened.** `llm_671b` (140 GB) and `render_3d` (CUDA, 32 GB)
   were deleted rather than scaled, because a threshold nothing can pass and a threshold
   everything passes are the same broken gate. The classes are now `llm_local_sm`,
   `llm_local_md`, `render_3d_cpu`, `batch_2d`, sized against 16 GB.
3. **Single-flight law.** With one machine, two heavy jobs contend for the same memory
   and thermal budget, so a live gate token now blocks minting a token for any other
   workload. This is a real capability loss: render-while-compositing is gone.
4. **Adobe moved from AppleScript to COM.** `osascript … do javascript file` became
   PowerShell `New-Object -ComObject Photoshop.Application` + `DoJavaScriptFile`. The
   ExtendScript artifacts themselves are unchanged — they were always cross-platform.
   Two Windows-specific traps are now encoded: a modal dialog blocks COM indefinitely
   (hence the timeout in ARTIFACT D), and COM binds only at a matching integrity level,
   so an elevated shell silently drives a *second* Photoshop instance (hence P2a).
5. **Blender defaults to EEVEE, and Cycles is CPU-only.** Cycles has no usable backend on
   Intel integrated graphics; `device = "GPU"` only chose whether the fallback was
   silent. Default resolution dropped from 2688×1152 to 1920×823 for the same reason.
6. **The local model became a tier, not a name.** DeepSeek-R1-671B does not load in 16 GB.
   `local_rag_orchestration` v2.0 resolves a tier from
   `dashboard.json → hardware.local_llm.tiers` and verifies the tag against Ollama's
   `/api/tags` before calling. The window dropped from 131,072 tokens to 8,192 (sm) /
   4,096 (md) — on this machine `num_ctx` is a memory decision, since Ollama allocates
   the KV cache at load.
7. **Models must be evicted, not left resident.** Every call sets `keep_alive: "5m"` and
   §2.8 releases the model explicitly. A resident model on the old host was free; here it
   holds gigabytes the next render is about to be denied for.
8. **`dashboard.json` schema 2.0.0.** `hardware.egpu` / `hardware.compute_node` are
   retired; `hardware.gpu`, `hardware.power`, `hardware.thermal` and
   `hardware.local_llm.tiers` replace them. `router.js` renders the new shape and still
   displays a legacy node if an old dashboard is loaded, flagged rather than hidden.

**Enforced, not just documented.** `tools/verify_system.py` gained
`check_host_portability`: every skill must declare `host_kinds` within the dashboard's
enum, no skill may invoke a macOS-only binary or carry an `/Applications/` path inside a
code fence, and no skill may set `cycles.device = "GPU"` while `hardware.gpu.cuda` is
false. Run against the pre-port files it reports 8 failures; against the ported tree, 0.

**Made executable in a follow-up pass.** The gate was specified but not runnable:
ARTIFACT B said "compare probe JSON against these thresholds" to an agent reading the
file, and nothing executed it. First boot needed that to be a mechanism.

- `tools/bootstrap.sh` — preflight (shell kind, hard vs. soft prerequisites, Ollama
  reachability including the WSL gateway retarget, COM registration via `Test-Path` on the
  registry rather than `New-Object`, which would launch Photoshop), extracts ARTIFACT A,
  runs it, and surveys every workload class.
- `tools/hw/evaluate_gate.py` — parses ARTIFACT B out of the skill at run time and mints
  or denies the token. Implements `null_law`, `thermal_law` (either reading suffices,
  neither does not), `host_law` and `single_flight_law`. No second copy of the thresholds
  exists, so the evaluator cannot drift from the skill.
- `tools/hw/test_gate.py` — ten cases pinning the verdicts that matter on this machine:
  AC required for sustained work, throttling denied, one readable thermal reading enough,
  a discrete GPU or a macOS host refused, a live token blocking a second workload.
- `tools/reconcile_models.py` — compares the tier registry against Ollama's `/api/tags`
  and reports drift; `--write` applies it. It excludes models outside a tier's parameter
  range (a 70B is not "md but slower" on 16 GB — it does not load) and never picks
  silently.
- `.github/workflows/verify.yml` — runs both checkers on every push and PR, plus an
  extract-and-`bash -n` of ARTIFACT A. It is executable content living in a markdown file;
  nothing else would notice if an edit broke its syntax.
- `verify_system.py` also now fails if `tools/hw/verify_compute.sh` has drifted from
  ARTIFACT A — the extracted copy is gitignored precisely because debugging it in place
  and leaving the skill file broken is the obvious failure mode.
- `BOOT.md` — the runbook, including why a clean bootstrap still reports `BLOCKED`.

**Not yet done.**

- `hardware.local_llm.tiers` still carries **provisional** model tags (`llama3.1:8b`,
  `mistral-nemo:12b`, `nomic-embed-text`). `reconcile_models.py` exists to correct them but
  has only been run against a stub endpoint; the real inventory is unknown until someone
  runs `ollama list` on the machine.
- The probe has been syntax-checked and exercised on Linux, where it emits valid JSON.
  Its Windows and WSL branches — every `psq` query, the WSL gateway rewrite, the
  `wslpath` handoff — have **never been run on the target machine**. Treat first boot as
  debugging, not as a smoke test. The same is true of bootstrap's COM-registration probe.
- The system remains `BLOCKED` after bootstrap, and correctly so: ten brand gates are
  unauthored and the vault is empty, so §5's ladder parks every route at L3. Authoring
  them encodes taste and prior decisions, which is exactly what cannot be generated.
- `archive/` still ships `docker-compose.yml` and a cloud stack (§ D1). Docker Desktop on
  16 GB competes directly with both Ollama and Adobe; the local-first rewrite D1 calls
  for is now a memory requirement, not a preference.
- Premiere has no COM automation on Windows. `adobe_suite_uxp` ARTIFACT C still assumes
  the CEP/UXP panel endpoint it assumed on macOS, and that path is unverified here.

---

## D9 — ui-ux-pro-max is vendored as a routed skill, and authors three brand gates

**Chosen:** vendor the upstream corpus and search engine into
`tools/ui-ux-pro-max/`, write `skills/ui_ux_intelligence.skill.md` in the Four-Part
Artifact Architecture, and use `css_html_ui` ARTIFACT A to author three of the ten
brand gates.

**Rejected — a `context/domain/` library.** The corpus is thirteen CSVs behind a
BM25 engine; flattening it into an eleventh 216-line reference file would make it
worse at the one thing it is good at, and domain libraries never satisfy a gate
(§3). The CSVs *are* the corpus; the skill is its retrieval interface.

**Rejected — referencing the payload in place** on the authoring machine. That
hardcodes an absolute path into a routed skill and makes it unroutable anywhere
else. D2 drew the same line for the brush designer: a capability, not a bookmark.

**Why it routes cleanly.** Verified by running it from `tools/`:

| Requirement | Status |
|---|---|
| Headless entry point | `search.py`, argparse CLI, `--json` on every mode |
| Dependencies | Python 3 standard library only |
| Network | none — the corpus is local CSV |
| `host_kinds` | `[windows, wsl, linux]`; no host bridge, no macOS binary |
| Adapter needed | **none** — unlike D2, the seam was already there |

### The token-authority split

`css_html_ui` ARTIFACT A calls itself the "ABSOLUTE SOURCE OF TRUTH" for tokens and
`check_palette_parity` enforces it against `control_room.html`. ui-ux-pro-max
generates a *new* palette and type pairing per product. Left unscoped, the second
would license drift in the first.

**Two authorities, split by consumer:**

- **Studio surfaces** (`control_room.html`, `hub/`) — ARTIFACT A governs.
  `ui_ux_intelligence` is the declared *upstream generator*, and proposes only.
  ARTIFACT A's own `mutation_policy` (`operator-approval only; agent proposes,
  never commits`) governs the three gates too. The four-step approval loop is the
  skill's ARTIFACT D.
- **Product and client work** — `ui_ux_intelligence` is the sole authority, through
  a per-project `MASTER.md`. The studio palette and Chakra Petch do not travel to a
  client project.

### The three gates

`visual_identity`, `typography_system`, and `color_science` are now authored, and
were **transcribed from ARTIFACT A, not generated**. `context/brand/README.md` is
right that brand constants cannot be generated — they encode taste. But these three
were never actually missing: they were decided, in force, and machine-verified,
just buried in one skill file where the Router could not see them. Promoting them
is bookkeeping, not invention, and each file's §0 PROVENANCE block says so.

**L0 now means authored, not complete.** Two of the three declare their own gaps —
`visual_identity` §7 (imagery motifs, framing, texture) and `color_science` §5
(working space, LUTs, grading). Both are real holes that the corpus cannot fill:
`colors.csv` holds product palettes, not colour-management policy. A route needing
those constraints treats them as unresolved even though the file loads at L0.
Router.md §3 now says this explicitly, because "the file exists, so the question is
answered" is the cheapest way to lose the guarantee the gates exist for.

**Consequence:** the system moved `BLOCKED` → `DEGRADED`. `ui_ux_intelligence` is
the first skill whose entire mandatory context resolves at L0 — the first route in
this repository that runs with no provisional constraint. `css_html_ui` still parks
on `brand_voice`, the last of its three.

**Not yet done.**

- No product-work design system has been generated end to end, so the ARTIFACT B
  handoff shape is asserted against the engine's JSON output, not proven against
  what `css_html_ui` actually consumes.
- `VENDOR.md` records a payload sha256; nothing verifies it on a run. A
  `check_vendor_hash` in `verify_system.py` would close that.
- `ui_ux_intelligence` has no pipeline phase. It routes on trigger; `ph_06` still
  lists `css_html_ui` alone.

### D9 addendum — the first regeneration ran, and the palette was failing WCAG

`ui_ux_intelligence` was exercised as the upstream generator for the studio's own
tokens (ARTIFACT D), operator-authorised. Two things worth recording.

**The generator misrouted twice before it was useful.** `"creative studio control
room dashboard dark instrumentation"` resolved to *Photography Studio* — "studio"
dominated the match — and returned a scroll-storytelling pattern for a portfolio
site. The narrower rewrite `"internal operations monitoring dashboard telemetry"`
resolved to *Smart Home/IoT Dashboard*: still an imperfect label, but dark-tech
ground, a status accent, monospace-family type and a dense spacing scale, all of
which fit. That is the Query Contract working as designed — verify the category,
retry once, and treat the result as evidence rather than instruction. The final
palette is not the generator's output; it is the studio's identity with the
generator's evidence applied to the values that were broken.

**The old palette failed WCAG in two places, and the brand gate had papered over
one of them.** Measured:

| token | before | after | |
|---|---|---|---|
| `accent.queued` | 2.23:1 | 5.55:1 | below the **3.0** non-text floor — a queued status dot was non-compliant, not just hard to read |
| `ink.dim` | 3.78:1 | 6.34:1 | below **4.5** while carrying 10–11px labels |
| `accent.alert` | 4.64:1 | 5.78:1 | passed, tightened |
| `line` | 1.21:1 | 1.71:1 | container border; 1.4.11 does not bind, raised for legibility |

`color_science.context.md` §4 had claimed ink cleared AA and hedged that dim ink
was "structure, not reading matter". That hedge was covering a real failure. The
section now states the measured floor, and ARTIFACT A carries a `contrast_floor`
block so a future value that regresses either number is rejected rather than
re-hedged.

**Four layout bugs surfaced only by rendering the page**, none visible in the
source review that preceded it:

- `word-break: break-all` on prose split words mid-token — "Windo|ws 11",
  "pressure g|reen", "next se|ssion". The corpus names this exactly
  (*Long Token Wrapping*): use `overflow-wrap: anywhere` and let grid children
  shrink; never `break-all` on prose.
- The Event Log panel spans three grid rows (~1100px) but its list was capped at
  340px — **724px of dead space** while the list scrolled 800px of content.
- **Mobile horizontal overflow**: 682px of content in a 375px viewport. Grid tracks
  default to `min-width: auto`, so each station's 101px min-content forced `.rail`
  to 597px, and that one child stretched every panel to 635px. Fixed with
  `minmax(0, 1fr)` tracks, `min-width: 0` panels, and giving the rail its own
  scroll container — six 62px stations would be unreadable, so shrinking alone was
  the wrong answer.
- Two scrollable regions (`#log`, `#rail`) were not keyboard-reachable (WCAG 2.1.1).

Also folded in: `:focus-visible` is now global rather than `.chip`-only, the four
hardcoded `rgba()` glows became ARTIFACT A `elevation.*` tokens, and
`prefers-reduced-motion` now nulls the bar/track transitions it had been missing.

**Verified** at 375 / 768 / 1265px: zero horizontal overflow at every breakpoint,
`check_palette_parity` green, `verify_system.py` exit 0.

**Not done.** The retheme was measured and rendered, not reviewed by a person on
the target display. Contrast was computed against WCAG 2.1 ratios; APCA, which
models dark-mode legibility better, was not consulted.
