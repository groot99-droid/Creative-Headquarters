# Studio Headless OS

A creative-studio control plane: a routing protocol that refuses to execute work
without its governing context loaded, a set of executable skill definitions, the
tools those skills drive, and a knowledge engine meant to give the whole thing
memory.

This repository consolidates what were four separate repos.

---

## Layout

```
Router.md            The execution contract. Read first, every task. Not documentation.
dashboard.json       Live system state — phases, active variables, event log, hardware.
control_room.html    Human-facing UI; renders dashboard.json.
router.js            Polls dashboard.json → DOM. API routing is still stubs.
DECISIONS.md         Architecture decisions in force. Read before changing direction.

skills/              8 skill definitions, Four-Part Artifact Architecture.
context/brand/       10 Router-mandatory gate files. NOT YET AUTHORED.
context/domain/      10 reference libraries, 216 lines each.
agents/              9 sub-executor definitions.
tools/brush-designer/  Procreate brush generator. Runs standalone today.
archive/             Living Archive Engine — the intended memory layer.
```

---

## What runs today

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

**Any routed task.** `Router.md` §3 requires ten context files under
`context/brand/` that have never been written. §7 forbids inventing their
contents and §4 requires setting the phase to `blocked` when one is missing — so
every route halts by design until they exist. `context/brand/README.md` specifies
what each of the ten must answer. This is the single largest thing standing
between the repo and a working system, and it is authorship, not engineering.

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

## The idea

Creative-HQ was an orchestration layer with nothing to orchestrate. The brush
designer was a working tool with nothing driving it. The Living Archive was a
memory system with no one remembering into it. Each was inert alone.

The loop they close together: a task is intercepted and routed, its governing
context is loaded and attested, a skill executes and produces a real artifact,
the run is written back to `dashboard.json`, and that record is ingested into the
archive — where it is classified, embedded, and made retrievable, so the next
route can draw on what the last one learned.

The brush designer is the proof that a skill can actually execute and produce a
file. The archive is what turns a router into something that gets better.

**None of that loop is wired yet.** This pass was consolidation and structural
repair only: one repo, correct directory structure, verified import graphs,
decisions written down. The integration work is specified in DECISIONS.md and
`context/brand/README.md`, and has not been started.
