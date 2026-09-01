# Studio Headless OS

A creative engine that remembers your work.

Every time it makes something — a character, a design, an audio piece, a brush —
it writes a **Content MD**: the exact steps that produced it, the decisions in
force, and what happens next. Those notes live in an Obsidian vault you edit
directly. Come back a week later and the note is the memory: read it cold, pick up
where you left off. Come back after fifty of them and the vault is a corpus the
system grounds new work in — your precedent, not a generic model's guess.

The hub renders the vault as a cosmos of everything you have made, and for any
piece of it: what this is, and what to do next.

---

## Layout

```
Router.md            The execution contract. Read first, every task. Not documentation.
dashboard.json       Live system state — phases, active variables, event log, hardware.
control_room.html    Human-facing UI; renders dashboard.json.
router.js            Polls dashboard.json → DOM. API routing is still stubs.
DECISIONS.md         Architecture decisions in force. Read before changing direction.
OBSIDIAN.md          Wiring the vault to local Ollama — the in-app half and the corpus half.

skills/              9 skill definitions, Four-Part Artifact Architecture.
context/brand/       10 constants named by the routing table. 3 authored
                     (visual_identity, typography_system, color_science —
                     transcribed from css_html_ui ARTIFACT A, § D9); the other
                     7 resolve from the vault meanwhile (Router §5).
context/domain/      10 reference libraries, 216 lines each.
vault/               THE SOURCE OF TRUTH. Content MDs; see vault/SCHEMA.md.
agents/              9 sub-executor definitions.
tools/bootstrap.sh   First boot: preflight, extract the probe, report what can run.
tools/vault_rag.py   Indexes a vault into Ollama embeddings and answers across it.
                     local_rag_orchestration made executable; stdlib only.
tools/vault_manifest.py  Writes state/vault_manifest.json — the small, embedding-free
                     note index hub/index.html's Library tab reads.
tools/hw/            Gate machinery — evaluate_gate.py mints or denies the compute token,
                     test_gate.py pins its verdicts. verify_compute.sh is generated.
tools/brush-designer/  Procreate brush generator. Runs standalone today.
tools/ui-ux-pro-max/   Vendored design corpus + search engine behind
                     ui_ux_intelligence: 79 styles, 192 palettes, 74 font
                     pairings, 119 UX guidelines, 22 stacks. Offline, stdlib
                     only. Provenance and re-vendor steps in VENDOR.md.
hub/                 Human-facing tool: library of AI-written note overviews, a direct
                     Ollama Q&A over the vault, the brush designer embedded, and a static
                     (unwired) pipeline preview. See "What runs today" below.
archive/             Indexes the vault for search and the cosmos view.
```

**Setting it up on the machine: [BOOT.md](BOOT.md).**
**Connecting Obsidian and Ollama: [OBSIDIAN.md](OBSIDIAN.md).**

---

## What runs today

**`hub/`** — open `hub/index.html` from a static server (see below). Four tabs:

- **Library** — one card per Content MD in `vault/`, built from
  `state/vault_manifest.json` (regenerate with `python3 tools/vault_manifest.py`
  after editing notes). Each card shows the note's authored `## Overview`
  as-is, plus an on-demand **AI overview** the local model writes from the
  full note text — nothing is summarized until you click.
- **Ask** — direct Q&A against Ollama, grounded in the vault. Builds a
  browser-side embedding index over the manifest's notes (same chunking,
  retrieval, and "answer only from the retrieval block" prompt as
  `tools/vault_rag.py ask`, run client-side against `/api/embeddings` and
  `/api/generate`) and cites the chunks it drew on.
  See [OBSIDIAN.md](OBSIDIAN.md) if the connection fails — same
  `OLLAMA_ORIGINS` step as the in-app plugin, one more origin to allow.
- **Designer Pro** — style generation and mixing. Pick rows from the vendored
  ui-ux-pro-max CSVs (`tools/ui-ux-pro-max/data/`) as ingredients across
  domains — a style, a palette, a font pairing — and blend them into one
  direction with the local model. Two layers, and only one is a model: the rows
  and the **conflict checks** (deprecation, mode clashes, `risk:high`,
  complexity stacking) are read straight from corpus fields and need no Ollama;
  the blended direction is written by Ollama from those rows only, cites each
  ingredient, and is a **proposal that never becomes a token**. Retrieval is
  token overlap, not the CLI's BM25 — when they disagree, `search.py` wins.
  Expect 1–2 minutes per blend: 8B CPU inference, no CUDA on this machine.
- **Brushes** — embeds `tools/brush-designer/index.html`.
- **Pipeline** — a static preview of the pipeline rail's layout. Deliberately
  **not** wired to `dashboard.json` or router state yet; `control_room.html`
  remains the live view until that connection is built.

Needs an HTTP origin, not `file://` — `.claude/launch.json` has a
`hub-static-server` entry (`python3 -m http.server 8347`), or run your own
and open `http://localhost:<port>/hub/`.

**`tools/brush-designer/`** — open `index.html` from a static server. Generates
shapes and grains on canvas, previews strokes, exports `.brush` and `.brushset`
files with real plist encoding. ~4,000 lines, no build step, one CDN dependency
(fflate). This is the piece that most closely resembles a finished tool.

**`control_room.html`** — open alongside `dashboard.json`. Renders pipeline
phases, hardware meters, active variables, and the event log. It is a live view
of a state file; it does not drive anything yet.

**`agents/`** — copy into `~/.claude/agents/` and invoke with
`claude --agent <name>`. Portable as-is.

## What does not run yet

**`archive/`** — the Living Archive Engine. Every import now resolves and the
directory structure matches what `render.yaml` and `docker-compose.yml` expect,
but this has not been installed, built, or started. `backend/requirements.txt`
and `backend/Dockerfile` were newly written from the import graph in this pass
and have never been exercised. Treat first boot as debugging, not as a smoke test.

**Any routed task.** The protocol is specified end to end — mode gate, resolution
ladder, attestation, Content MD emission — but nothing executes it yet. There is no
vault indexer, no skill has a Content MD step wired in, and `router.js`'s dispatch
is still stubs. `Router.md` is a contract an agent reads and obeys; it is not code,
and no code implements it.

The ten `context/brand/` constants are still unauthored, but that is no longer
blocking: §5's ladder resolves them from the vault, marked provisional. Authoring
one promotes it to exact.

---

## Verifying the protocol

The routing contract is stated in four places that must agree: `Router.md` (the
contract), `dashboard.json` (live state and gate declarations), `router.js` (runtime
resolution), and the eight `mandatory_context` headers under `skills/`. Those copies
drift, and drift here is not cosmetic — a stale mapping halts every route, or worse,
lets one proceed on context that was never loaded.

```bash
python3 tools/verify_system.py     # exits non-zero on any drift
python3 tools/hw/test_gate.py      # pins the gate's verdicts against ARTIFACT B
```

Both run in CI on every push and pull request (`.github/workflows/verify.yml`), along
with a check that ARTIFACT A still extracts and parses as bash — it is executable content
embedded in a markdown file, and nothing else would notice if an edit broke it.

It checks that every registered skill exists, every brand gate declares the correct
`context/brand/<role>.context.md` path and that its `authored` flag matches what is
actually on disk, no `context/domain/` library is declared as a gate (the substitution
§3 forbids), every skill's `mandatory_context` names a real gate, `system_status.
context_loaded` claims only authored gates, every CSS class and element id `router.js`
touches exists in `control_room.html`, UI tokens still mirror the css_html_ui ARTIFACT A
token dictionary, the pipeline routes to real skills with coherent progress, and the
declared `system_status.state` is consistent with the §5 ladder — with nothing authored
and no vault notes, every context lands at L3, and L3 parks.

Since the single-host port it also checks **portability**: every skill declares
`host_kinds` within the dashboard's enum, no skill invokes a macOS-only binary or carries
an `/Applications/` path inside a code fence, and no skill sets `cycles.device = "GPU"`
while `hardware.gpu.cuda` is false. Prose describing the migration is exempt — the scan
reads fenced code only. Run against the pre-port files it reports 8 failures.

Run it after editing any protocol file. Right now it passes with all ten gates reported
as pending and the state declared `BLOCKED` — honest rather than papered over.

---

## The machine

One laptop runs all of it: a **Lenovo Yoga Book 9i** — 16 GB soldered, Intel integrated
graphics, no CUDA — driven from **Claude Code desktop on Windows**, with Ollama serving
local models on the same machine. Bash blocks may land in Git Bash or in WSL2; both are
supported, and the probe tells them apart because they report different truths about the
same hardware (inside WSL2, `/proc/meminfo` describes the WSL VM, not the laptop).

This replaced a two-machine studio — a 192 GB Mac host plus a LAN CUDA render node. That
assumption was compiled into the gates, not just described in prose, so the port touched
the probe, the thresholds, the Adobe bridge, the Blender device, and the model registry.
See DECISIONS.md § D8 for what each change costs.

## Hardware gating

`skills/hardware_compute.skill.md` is a bouncer, not a launcher. Compute-heavy skills
may not run without a fresh `PASS` token at `state/compute_gate.json`, carrying a
workload class and a 30-minute TTL; **one token authorizes one job** — the consuming
skill stamps `consumed_by` and the token is spent.

`verify_compute.sh` detects which shell it was invoked from and probes accordingly; it
emits one JSON object and mutates nothing. `tools/hw/evaluate_gate.py` turns that probe
into a verdict — reading the thresholds out of ARTIFACT B at run time rather than keeping
a second copy, so the skill file stays the source of truth. A metric it cannot read comes back `null` and
evaluates to **fail**, never to pass-by-default. An unverifiable gate is a closed gate.

Three things this laptop made into gates that the two-machine studio never needed:

- **Power.** Windows caps sustained clocks on battery. Every workload class except
  `llm_local_sm` requires AC.
- **Thermal headroom.** A thin 14″ chassis throttles under load, so the first probe is
  the best the machine will look. Long jobs re-probe every 5 minutes and checkpoint-pause
  on two consecutive denials. Temperature and processor-performance percentage are two
  independent readings of one limit: at least one must be readable, and every readable
  one must pass.
- **Single flight.** One heavy job at a time. A live token for one workload denies a
  token for any other — 16 GB cannot hold a render and a composite at once.

The four workload classes are sized against 16 GB: `llm_local_sm` (≤8B, 8k context),
`llm_local_md` (12–14B, 4k), `render_3d_cpu` (EEVEE, or Cycles on CPU), and `batch_2d`
(Adobe via the COM bridge).

---

## Where each piece came from

| Path | Source repo |
|---|---|
| `Router.md`, `dashboard.json`, `control_room.html`, `router.js`, `skills/`, `context/domain/` | `Creative-Headquarters` |
| `tools/brush-designer/`, `agents/` | `Claude-Code` |
| `archive/` | `crispy-engine` |

`Living-Archive` contributed nothing: it is a strict subset of `crispy-engine`,
missing that project's five core modules. See DECISIONS.md § D3.

---

## The loop

```
input → route to skill (§2-3) → resolve context (§5) → read Content MD (§7)
      → execute → write artifact → update Content MD → index into the cosmos
                                            ↑                        │
                                            └── precedent for next ───┘
```

Output is a function of the input and the matched context, nothing else. The
Router's job is to find the right context and refuse to fill gaps from general
knowledge. Context resolves from an authored file, a decision recalled from a past
note, or precedent derived across past work — always sourced, always stated.

In `autonomous` mode the system never waits on a person. A task it cannot ground
gets parked with a written reason in its Content MD and the next one routed. The
work stops; the system does not.

The brush designer is the proof a skill can actually execute and produce a file —
52 parameters, entirely local, no API cost. The vault is what makes the system get
better. Each closes the other's gap.

**The loop is specified, not built.** See DECISIONS.md for what is decided and why.
