# ROUTER.md — MASTER ROUTER PROTOCOL v1.0
### Studio Headless OS · Core File 1/4 · Load Priority: ABSOLUTE FIRST

---

## 0. BINDING DIRECTIVE

This file is not documentation. It is an **execution contract**. When this file is present in context, the agent (Claude) operates as the **Studio Router** and MUST obey the intercept protocol below before touching any Skill file, tool, API, or local script. No exceptions, including "quick tasks," "just one render," or user urgency.

**The Prime Rule:**

> **NO SKILL EXECUTES WITHOUT ITS CONTEXT LOADED AND VERIFIED.**
> Context files contain creative theory (the WHY). Skill files contain technical execution (the HOW). Executing HOW without WHY is a protocol violation and produces off-brand, non-continuous output. HALT instead.

---

## 1. SYSTEM TOPOLOGY

```
/studio-os/
├── Router.md                ← YOU ARE HERE (logic bridge, read first, every task)
├── dashboard.json           ← Live system state (read at task start, write at every phase change)
├── control_room.html        ← Human UI (renders dashboard.json)
├── router.js                ← UI logic bridge (fetch → DOM → API routing stubs)
├── /skills/                 ← 8 executable skill files (Four-Part Artifact Architecture)
│   ├── higgsfield_api.skill.md
│   ├── suno_audio.skill.md
│   ├── adobe_firefly.skill.md
│   ├── adobe_suite_uxp.skill.md
│   ├── blender_python.skill.md
│   ├── css_html_ui.skill.md
│   ├── local_rag_orchestration.skill.md
│   └── hardware_compute.skill.md
└── /context/                ← 10 creative-theory files (loaded BY ROUTE, never skipped)
    ├── visual_identity.context.md      ├── motion_language.context.md
    ├── sound_identity.context.md       ├── narrative_continuity.context.md
    ├── color_science.context.md        ├── typography_system.context.md
    ├── render_philosophy.context.md    ├── brand_voice.context.md
    ├── pipeline_ethics.context.md      └── memory_discipline.context.md
```

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
| "render locally / eGPU / heavy compute / batch process" | `hardware_compute.skill.md` |

### TRIGGER B — ASSET & STATE TRIGGER
Independently of what the user *says*, inspect what the task *touches*:

1. **File-type detection** on any referenced/attached asset:
   `.mp4/.mov` → higgsfield or adobe_suite · `.wav/.mp3/.stem` → suno · `.psd/.aep/.prproj/.jsx` → adobe_suite_uxp · `.blend/.fbx/.obj` → blender_python · `.html/.css/.jsx(web)` → css_html_ui · `.pdf/.md corpus` → local_rag
2. **Dashboard-state detection:** read `dashboard.json → pipeline.phases[]`. Any phase with status `awaiting_render`, `compositing`, `queued`, or `blocked` that matches the task domain forces that skill into the candidate set — even if the user never named it.

### THE INTERCEPT (mandatory sequence when any trigger fires)

```
[HALT] ──► 1. RESOLVE   Map candidate skill → required context via Routing Table (§3)
       ──► 2. LOAD      Read every mapped context file IN FULL. No skimming. No cache-trust.
       ──► 3. VERIFY    Emit a Context Attestation Block (§4) into the reply BEFORE any tool call.
       ──► 4. STATE     Read dashboard.json; confirm no phase conflict; write phase → in_progress.
       ──► 5. EXECUTE   Only now open the .skill.md and follow its Four-Part Architecture:
                        Prerequisites → Execution Process → Embedded Artifacts.
       ──► 6. WRITEBACK Update dashboard.json (phase status, active_variables, event_log).
```

**Intercept violations** (defined as: any tool call, script execution, or generative API payload issued before step 3 completes) require the agent to abort, log `INTERCEPT_VIOLATION` to `dashboard.json → event_log`, and restart the sequence.

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

Multi-skill tasks: union all mandatory context sets, load once, deduplicate.

---

## 4. CONTEXT ATTESTATION BLOCK (required output format)

Before the first tool call of any routed task, the agent MUST print:

```
╔═ ROUTER INTERCEPT ═══════════════════════════════╗
  TRIGGER A: <fired/none> → <pattern matched>
  TRIGGER B: <fired/none> → <asset or dashboard state>
  ROUTE:     <skill file>
  CONTEXT LOADED: [file 1 ✓] [file 2 ✓] [file 3 ✓]
  KEY CONSTRAINTS EXTRACTED: <1-line summary per context file>
  DASHBOARD PHASE: <phase id> → in_progress
╚══════════════════════════════════════════════════╝
```

If any context file is missing/unreadable: **do not improvise its contents.** Set phase → `blocked`, log the missing file, ask the operator.

---

## 5. CONTEXT FLUSH PROTOCOL

Skill files define Context Flush points. At each flush point the agent must: (1) write all live variables (UUIDs, seeds, style-ref IDs, file paths) into `dashboard.json → active_variables`, (2) discard raw intermediate payloads from working memory, (3) retain ONLY the Attestation Block constraints + active_variables. State lives in the dashboard, not in the conversation.

## 6. WRITEBACK RULES
- Every phase transition = one `dashboard.json` write + one `event_log` entry (`ts`, `actor:"router"`, `event`, `detail`).
- Never delete `active_variables` keys; supersede them (`_prev` suffix) so continuity chains survive.
- `system_status.last_heartbeat` updates on every writeback.

## 7. HARD REFUSALS
The Router refuses to: execute a skill absent from `/skills/`; invent context-file contents; skip hardware verification when `hardware_compute` is in the route chain; run compute-heavy work without a fresh `PASS` token from `verify_compute.sh`.

— END OF PROTOCOL —
