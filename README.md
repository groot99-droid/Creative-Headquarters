# Creative Headquarters

**A protocol-driven operating system for an AI creative studio.**

This repository is not an application. It is an **execution contract** — a set of
documents that constrain how an AI agent behaves when it is asked to make creative
work, plus a live dashboard that shows what the agent is doing.

The premise is one rule:

> **No skill executes without its context loaded and verified.**

Context files hold creative theory (the *why*). Skill files hold technical execution
(the *how*). An agent that runs the *how* without the *why* produces off-brand,
discontinuous output — a shot that ignores the film's camera grammar, a track in the
wrong key, a UI that invents its own colors. The Router exists to make that failure
structurally impossible: it halts instead.

---

## Quick start

```bash
git clone https://github.com/groot99-droid/Creative-Headquarters.git
cd Creative-Headquarters

python3 -m http.server 8000        # the control room needs a server, not file://
open http://localhost:8000/control_room.html

python3 tools/verify_system.py     # confirm the protocol is internally consistent
```

`verify_system.py` exits non-zero if any part of the routing contract has drifted.
Run it after editing any protocol file.

---

## What's in here

22 protocol files, flat in the repository root. Filenames carry the namespace.

### Core (4)

| File | Role |
|---|---|
| `Router.md` | The execution contract. Read first, every task. Dual-trigger intercept, routing table, attestation format, hard refusals. |
| `dashboard.json` | Live system state **and** the single source of truth for the context binding map. |
| `control_room.html` | Operator UI. Renders `dashboard.json` — pipeline rail, continuity locks, compute meters, event log, context attestation. |
| `router.js` | Logic bridge. Fetches state, renders every panel, resolves routes. API dispatch is stubbed. |

### Skills (8) — the *how*

Each follows a Four-Part Artifact Architecture: routing header → prerequisites →
execution process → embedded artifacts. Artifacts are meant to be extracted to disk
verbatim and run, not paraphrased.

| Skill | Domain | Danger class |
|---|---|---|
| `higgsfield_api` | AI video generation, shot continuity | external API spend |
| `suno_audio` | AI music, structural prompting | external API spend |
| `adobe_firefly` | AI image generation, style-ref ledger | external API spend |
| `adobe_suite_uxp` | Photoshop / Premiere automation via UXP + ExtendScript | **local destructive** |
| `blender_python` | Headless 3D via `bpy` | local compute heavy |
| `css_html_ui` | Front-end construction against a token dictionary | low (brand risk) |
| `local_rag_orchestration` | DeepSeek-R1 retrieval with hard flush checkpoints | local compute heavy |
| `hardware_compute` | Compute verification gate | **gatekeeper** |

### Context (10) — the *why*

Ten ~25,000-word research corpora. Each opens with a routing glossary (`## 1`) mapping
keywords to ten deep categories (`## 2.A` … `## 2.J`), so an agent can jump to the
relevant theory instead of reading 25k words to answer one question.

`ai_creative_strategies` · `cinematic_videography` · `classical_illustration` ·
`creative_analytical_writing` · `digital_3d_motion` · `multimedia_fusion` ·
`music_ambience` · `social_media_marketing` · `typography_ad_arts` · `world_building`

---

## How routing works

Every task passes through two independent detectors. If **either** fires, the
intercept engages.

- **Trigger A — semantic.** Intent verbs and domain nouns in the request.
  *"animate this shot"* → `higgsfield_api`.
- **Trigger B — asset & state.** What the task *touches*, regardless of wording. A
  `.blend` file, or a pipeline phase sitting at `awaiting_render`, forces its skill
  into the candidate set even if the operator never named it.

Then, in order, with no shortcuts:

```
[HALT] ─► RESOLVE   skill → context roles → real files
       ─► LOAD      read every mapped context file
       ─► VERIFY    print the Context Attestation Block
       ─► STATE     read dashboard.json, claim the phase
       ─► EXECUTE   only now open the .skill.md
       ─► WRITEBACK update dashboard.json + event_log
```

Any tool call issued before the attestation prints is an **intercept violation**:
abort, log it, restart.

### Roles, not filenames

Skills declare abstract context **roles** (`motion_language`, `color_science`). Roles
resolve to real files through one binding map in
`dashboard.json → registries.context_roles`, mirrored for humans in Router.md §3.1.

```
higgsfield_api
  ├── motion_language      → cinematic_videography_context.md
  ├── narrative_continuity → creative_analytical_writing_context.md
  │                        + world_building_context.md
  └── visual_identity      → classical_illustration_context.md
```

The indirection is the point: the corpus can be re-cut without editing eight skill
files, and `router.js` reads the map at runtime rather than keeping a second copy that
can drift. Two invariants hold, and `verify_system.py` enforces both:

1. **Total binding** — every role resolves to a file that exists. An unbound role is a
   `blocked` route, never a route that proceeds with less context.
2. **Total coverage** — every context file is reachable through some role. Unreachable
   corpus files are reported as dead weight.

---

## The control room

Open `control_room.html` through a local server and it polls `dashboard.json` every
five seconds.

- **Pipeline rail** — six phases as transit stations, colored by status.
- **Active variables** — the continuity locks. Seed, character/environment UUIDs,
  style ref, BPM and key, master palette. These are what make shot 7 match shot 6.
- **Compute** — the studio is two machines: a macOS host running Adobe and
  orchestration, and a LAN CUDA node for rendering. (Not a Thunderbolt eGPU —
  Apple silicon has no eGPU support.)
- **Event log** — router writeback. UI-initiated routes appear here too.
- **Context attestation** — which corpora are actually loaded right now, and the
  24-hour violation count. Router.md §4 requires the attestation to be *visible to the
  operator*, not merely asserted in chat. This panel is that readout.

Clicking a skill chip runs the resolve step and logs the route it *would* take,
including the real context filenames. It does not dispatch.

---

## Hardware gating

`hardware_compute` is a bouncer, not a launcher. Compute-heavy skills may not run
without a fresh `PASS` token at `state/compute_gate.json`. The token carries a
workload class and a 30-minute TTL, and **one token authorizes one job** — the
consuming skill stamps `consumed_by` and the token is spent.

Its probe emits one JSON object and mutates nothing. A metric it cannot read comes
back as `null` and evaluates to **fail**, never to pass-by-default. An unverifiable
gate is a closed gate.

---

## What is real and what is not

Being explicit, because this repo reads like a running system and is not one:

**Real.** The control room renders live state from `dashboard.json` and its routing
resolution is genuine. `verify_system.py` genuinely checks the contract.
`verify_compute.sh` is a working probe — run it. The skill artifacts (payload
schemas, regex sets, `.jsx` scripts, `bpy` templates, token dictionary) are written to
be extracted and executed.

**Not real.** There is no agent runner. `dispatchAPICall()` and `writeDashboard()` in
`router.js` are stubs that log and return; browsers cannot write local files, so a
headless agent is expected to own `dashboard.json`. No credentials ship here — the
skills read `HIGGSFIELD_API_KEY`, `SUNO_API_KEY`, and Adobe OAuth from the
environment. The state files skills refer to (`state/continuity_sm.json`,
`state/style_ledger.json`, `state/compute_gate.json`) are created on first run; the
schemas live in each skill's ARTIFACT section. `PROJECT_AURORA` and its hardware
figures are illustrative seed state.

The intended deployment is an agent that loads `Router.md` first, obeys the intercept,
and writes back to `dashboard.json` — with the control room as the human window onto
what it is doing.

---

## Working on this repo

The routing contract is duplicated by necessity across `Router.md` (human-readable),
`dashboard.json` (authoritative), `router.js` (runtime), and eight skill headers. Those
copies drift, and drift here is not cosmetic — a stale mapping halts every task or,
worse, routes with context that was never loaded.

So: **after editing any protocol file, run the checker.**

```bash
python3 tools/verify_system.py
```

It verifies that every registered skill exists, every role resolves, every context file
is reachable, the mirrors agree, every CSS class and element id `router.js` touches
exists in the markup, the UI tokens still mirror `master_palette`, phases route to real
skills with coherent progress, and the event log is well-formed.

When you add a context file, bind it to a role in `registries.context_roles`, add it to
`registries.context_files`, mirror it in Router.md §3.1, and re-run the checker.
