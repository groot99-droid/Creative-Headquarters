# ROUTER.md — MASTER ROUTER PROTOCOL v1.1
### Studio Headless OS · Core File 1/4 · Load Priority: ABSOLUTE FIRST

---

## 0. BINDING DIRECTIVE

This file is not documentation. It is an **execution contract**. When this file is present in context, the agent (Claude) operates as the **Studio Router** and MUST obey the intercept protocol below before touching any Skill file, tool, API, or local script. No exceptions, including "quick tasks," "just one render," or user urgency.

**The Prime Rule:**

> **NO SKILL EXECUTES WITHOUT ITS CONTEXT RESOLVED, ATTESTED, AND SOURCED.**
> Context carries the WHY; skill files carry the HOW. Executing HOW without WHY
> produces off-brand output, so it does not happen.
>
> *Resolved*, not merely *loaded*: context is satisfied by an authored file, by a
> prior decision recalled from the vault, or by precedent derived across past work
> — the ladder in §5. What never changes is that every constraint must trace to a
> real source, and that source is stated in the attestation. Derived is allowed and
> labelled; invented is not allowed at all.

**Output is a function of the input and the matched context — nothing else.** The
Router's job is to find the right context for this input and refuse anything that
would fill a gap from general knowledge instead. A constraint the system cannot
source is a constraint it does not have, and a task it cannot ground is a task it
parks (§5).

---

## 1. SYSTEM TOPOLOGY

```
Creative-Headquarters/
├── Router.md                ← YOU ARE HERE (logic bridge, read first, every task)
├── dashboard.json           ← Live system state (read at task start, write at every phase change)
├── control_room.html        ← Human UI (renders dashboard.json)
├── router.js                ← UI logic bridge (fetch → DOM → API routing stubs)
├── DECISIONS.md             ← Architecture decisions in force
├── /skills/                 ← 8 executable skill files (Four-Part Artifact Architecture)
│   ├── higgsfield_api.skill.md
│   ├── suno_audio.skill.md
│   ├── adobe_firefly.skill.md
│   ├── adobe_suite_uxp.skill.md
│   ├── blender_python.skill.md
│   ├── css_html_ui.skill.md
│   ├── local_rag_orchestration.skill.md
│   └── hardware_compute.skill.md
├── /context/
│   ├── /brand/              ← 10 gate files named in §3. NOT YET AUTHORED — see brand/README.md
│   │   └── README.md            Absence is survivable: §5's ladder resolves them from
│   │                            the vault. Authoring one promotes it to L0.
│   └── /domain/             ← 10 reference libraries (worldbuilding, cinematography, …)
│                                Retrievable material. NOT substitutes for /brand/.
├── /agents/                 ← 9 sub-executor definitions (debugger, code-reviewer, …)
├── /tools/
│   └── /brush-designer/     ← Procreate brush generator. DOM-free core in editor/ + generators/
│                                + export/; UI in ui/ + panels/. Not yet routed — see DECISIONS.md.
├── /vault/                  ← THE SOURCE OF TRUTH. Obsidian vault of Content MDs.
│   ├── SCHEMA.md                Content MD spec — read before writing one
│   └── _templates/              Obsidian template
└── /archive/                ← Indexes the vault for search + the cosmos view.
    ├── /backend/app/            FastAPI + classification core + graph/vector stores
    └── /frontend/src/           React + d3 knowledge-graph UI
                                  Indexes the vault. Never owns it.
```

Each file in `context/domain/` is a large corpus with a routing glossary at `## 1` and ten
deep-research categories at `## 2.A` … `## 2.J`; the glossary exists so the agent can jump
to the relevant theory rather than skim the whole thing. These are retrieval material.
They are never loaded to satisfy a §3 mandatory gate — see §3 path resolution.

---

## 2. THE DUAL-TRIGGER INTERCEPT SYSTEM

Every incoming task is passed through TWO independent trigger detectors. **If EITHER fires, the Intercept engages.** Both firing raises confidence; neither firing routes to `general_chat` (no skill execution permitted at all).

### TRIGGER A — SEMANTIC INTENT TRIGGER
Scan the user request for intent verbs and domain nouns:

| Detected intent pattern | Candidate skill |
|---|---|
| "generate video / motion / animate shot / camera move" + AI gen | `higgsfield_api.skill.md` |
| "music / track / score / stem / drop / verse" | `suno_audio.skill.md` |
| "generate image / concept art / style ref / firefly" | `adobe_firefly.skill.md` |
| "photoshop / premiere / after effects / comp / batch edit" | `adobe_suite_uxp.skill.md` |
| "3D / blender / camera path / low-poly / procedural / rig" | `blender_python.skill.md` |
| "UI / dashboard / component / landing page / DOM" | `css_html_ui.skill.md` |
| "search my docs / recall / summarize corpus / RAG / DeepSeek" | `local_rag_orchestration.skill.md` |
| "render locally / GPU / compute node / heavy compute / batch process" | `hardware_compute.skill.md` |

### TRIGGER B — ASSET & STATE TRIGGER
Independently of what the user *says*, inspect what the task *touches*:

1. **File-type detection** on any referenced/attached asset:
   `.mp4/.mov` → higgsfield or adobe_suite · `.wav/.mp3/.stem` → suno · `.psd/.aep/.prproj/.jsx` → adobe_suite_uxp · `.blend/.fbx/.obj` → blender_python · `.html/.css/.jsx(web)` → css_html_ui · `.pdf/.md corpus` → local_rag
2. **Dashboard-state detection:** read `dashboard.json → pipeline.phases[]`. Any phase with status `awaiting_render`, `compositing`, `queued`, or `blocked` that matches the task domain forces that skill into the candidate set — even if the user never named it.

### THE INTERCEPT (mandatory sequence when any trigger fires)

```
[HALT] ──► 1. MODE      Read dashboard.json → system_status.mode (§4).
       ──► 2. RESOLVE   Map candidate skill → required context via Routing Table (§3).
       ──► 3. LADDER    Resolve every required context via the ladder (§5).
                        Apply the mode gate. Park here if any context hits L3.
       ──► 4. RECALL    Locate/create the Content MD; read Overview, Next Steps,
                        Decisions in Force, Method IN FULL (§7).
       ──► 5. VERIFY    Emit the Context Attestation Block (§6) BEFORE any tool call.
       ──► 6. STATE     Confirm no phase conflict; write phase → in_progress.
       ──► 7. EXECUTE   Only now open the .skill.md and follow its Four-Part Architecture:
                        Prerequisites → Execution Process → Embedded Artifacts.
       ──► 8. WRITEBACK Update the Content MD (§7), then dashboard.json (§9).
```

**Intercept violations** (defined as: any tool call, script execution, or generative API payload issued before step 5 completes) require the agent to abort, log `INTERCEPT_VIOLATION` to `dashboard.json → event_log`, and restart the sequence.

---

## 3. THE ROUTING TABLE (Skill → Mandatory Context)

| Skill | MUST load before execution | Also load if flagged in dashboard |
|---|---|---|
| `higgsfield_api` | `motion_language`, `narrative_continuity`, `visual_identity` | `color_science` |
| `suno_audio` | `sound_identity`, `brand_voice` | `narrative_continuity` |
| `adobe_firefly` | `visual_identity`, `color_science` | `typography_system` |
| `adobe_suite_uxp` | `render_philosophy`, `color_science` | `visual_identity` |
| `blender_python` | `render_philosophy`, `motion_language` | `visual_identity` |
| `css_html_ui` | `typography_system`, `visual_identity`, `brand_voice` | — |
| `local_rag_orchestration` | `memory_discipline` | `pipeline_ethics` |
| `hardware_compute` | `pipeline_ethics`, `render_philosophy` | — |

**Path resolution:** every name in the two right-hand columns resolves to
`context/brand/<name>.context.md` when authored — level L0 in §5. These are brand
constants; the files in `context/domain/` have different names and a different job
and never satisfy a mandatory slot.

None of the ten is authored yet. That no longer halts the Router: §5's ladder
resolves an unauthored constant from the vault's accumulated Content MDs (L1/L2),
and only a constant with no authored file *and* no precedent (L3) stops a task.
Authoring a file promotes that constant to L0 permanently. See
`context/brand/README.md`.

Multi-skill tasks: union all mandatory context sets, load once, deduplicate.

---

## 4. EXECUTION MODE

`dashboard.json → system_status.mode` selects how the Router behaves when context
is incomplete. It is read at the start of every task, before §5. The protocol has
three modes and they differ **only** in that: what happens when a required
constraint cannot be resolved. Nothing else about routing changes between modes.

| mode | when a constraint is unresolved |
|---|---|
| `manual` | Stop and ask. Nothing proceeds without a human answer. |
| `supervised` | Ask on low confidence; proceed on high confidence, flagged. |
| `autonomous` | Never wait on a human. Proceed on any derivable constraint, or park the task with a written reason and move on. |

**Autonomous does not mean unconstrained.** It means the system never idles
waiting for a person. When it genuinely cannot ground a task, it does not sit
blocked — it writes the blocker into the Content MD, sets that note's status to
`blocked`, and routes the next task. A human returning later reads why, in the
note, and unblocks it. That is the difference between autonomous and unattended:
the work stops, the system does not.

---

## 5. THE CONTEXT RESOLUTION LADDER

When §3 says a skill requires a context and that context is not present as an
authored file, the Router descends this ladder. It stops at the first level that
resolves.

```
L0  AUTHORED    context/brand/<name>.context.md exists.
                → Load in full. Confidence 1.0. Done.

L1  RECALLED    Query the vault for Content MDs whose frontmatter `context_brand`
                includes <name>. Read their `## Decisions in Force`.
                A decision that directly states the constraint resolves it.
                → Confidence 0.9. Cite the note id.

L2  DERIVED     No direct statement. Infer the constraint from precedent across
                Content MDs of related `kind`, weighting `status: complete` over
                `in-progress` and recent over old.
                → Confidence 0.3-0.8. Cite every note the inference drew on.
                Requires at least 3 notes; fewer is not precedent, it is a
                coincidence.

L3  UNRESOLVED  Nothing authored, nothing recalled, nothing to derive from.
                → No confidence. The constraint does not exist yet.
```

### Mode gate

| | `manual` | `supervised` | `autonomous` |
|---|---|---|---|
| **L0 / L1** | proceed | proceed | proceed |
| **L2, conf ≥ 0.70** | ask | proceed, flag | proceed, flag |
| **L2, conf < 0.70** | ask | ask | proceed **provisionally**, flag hard |
| **L3** | ask | ask | **park** |

**Proceed provisionally** means: execute, and record in the Content MD's
`## Decisions in Force` that this constraint was derived rather than authored,
with its confidence and sources. It is a real decision with a visible asterisk,
overturnable by a later authored file without contradicting the record.

**Park** means: do not execute. Write the gap into the Content MD's
`## Next Steps` as the first item, naming exactly which context is missing and
what would resolve it. Set `status: blocked`. Log `PARKED` to the event log.
Route the next task. Do not ask, do not wait, do not guess.

L3 halts in every mode including autonomous, and this is the one place autonomy
stops. A task with no authored context, no precedent, and nothing to derive from
has nothing to ground on, and output that isn't grounded in input plus matched
context is not this system's output. Parking it is the correct result, not a
failure.

---

## 6. CONTEXT ATTESTATION BLOCK (required output format)

Before the first tool call of any routed task, the agent MUST print:

```
╔═ ROUTER INTERCEPT ═══════════════════════════════════════════╗
  MODE:      <manual|supervised|autonomous>
  TRIGGER A: <fired/none> → <pattern matched>
  TRIGGER B: <fired/none> → <asset or vault state>
  ROUTE:     <skill file>
  CONTEXT RESOLUTION:
    <name>  L0 AUTHORED   1.00  context/brand/<name>.context.md
    <name>  L1 RECALLED   0.90  [[cmd_20260812_x]]
    <name>  L2 DERIVED    0.62  [[cmd_...]], [[cmd_...]], [[cmd_...]]  ⚠ PROVISIONAL
  KEY CONSTRAINTS EXTRACTED: <1-line per resolved context>
  CONTENT MD: <path> → <created|updating>
╚══════════════════════════════════════════════════════════════╝
```

Every context named in §3 for the routed skill must appear with its level,
confidence, and source. A context resolved at L2 must carry the ⚠ marker. An
attestation missing any required context is itself an intercept violation.

---

## 7. CONTENT MD EMISSION (mandatory)

Every routed task reads and writes exactly one Content MD. This is not optional
and not deferred to the end of a project — it is how the next session exists.

**At task start:** locate the Content MD for the thing being worked on. If none
exists, create it from `vault/_templates/content-md.md` with `status: seed`. Read
`## Overview`, `## Next Steps`, `## Decisions in Force`, and `## Method` in full
before executing. Those four sections are context on equal footing with
`context/brand/` — a decision in force binds the task exactly as a brand constant
does.

**At task end,** before the task is considered complete:

1. Append one `## Timeline` entry — what was actually done. Never a step not taken.
2. Rewrite `## Next Steps` in full to describe the present state.
3. Add any new `## Decisions in Force`, marking derived ones per §5.
4. Move answered `## Open Questions` into Decisions in Force; delete them there.
5. Record conflicts with other notes in `## Contradictions`, naming each file.
6. Update `## Method` if parameters changed.
7. Bump `updated`; set `status`.

Full field and section rules: `vault/SCHEMA.md`. The vault is the source of
truth — the archive indexes it, never owns it.

---

## 8. CONTEXT FLUSH PROTOCOL

Skill files define Context Flush points. At each flush point: (1) write everything
that must survive into the Content MD, (2) discard raw intermediate payloads from
working memory, (3) retain only the Attestation Block constraints and the Content
MD path.

**State lives in the Content MD, not in the conversation and not in the dashboard.**
`dashboard.json` holds live run state — which phase is executing, hardware,
heartbeat — and is disposable between runs. Anything that must survive to the next
session belongs in the note. If a flush would lose something the note does not
say, the note is wrong; fix it before flushing.

---

## 9. WRITEBACK RULES

- Every phase transition = one `dashboard.json` write + one `event_log` entry
  (`ts`, `actor:"router"`, `event`, `detail`).
- Content MD writes are append-and-revise per §7, never destructive: `## Timeline`
  is append-only, and a wrong past entry is corrected by a new dated entry saying
  so, not by editing it away.
- `system_status.last_heartbeat` updates on every writeback.
- `PARKED`, `PROVISIONAL`, and `INTERCEPT_VIOLATION` are logged with the context
  name and the Content MD path, so every one is traceable to a file.

---

## 10. HARD REFUSALS (mode-invariant)

These hold in every mode, `autonomous` included. Autonomy relaxes §5's gate on
unresolved context and nothing else.

The Router refuses to:

- execute a skill absent from `/skills/`;
- **present a derived constraint as an authored one** — L2 output is always marked
  provisional with its confidence and sources (deriving is permitted; laundering
  the provenance is not);
- execute at L3 in any mode;
- record a Timeline step that was not taken;
- skip hardware verification when `hardware_compute` is in the route chain;
- run compute-heavy work without a fresh `PASS` token from `verify_compute.sh`.

— END OF PROTOCOL —
