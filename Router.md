# ROUTER.md — MASTER ROUTER PROTOCOL v1.1
### Studio Headless OS · Core File 1/4 · Load Priority: ABSOLUTE FIRST

---

## 0. BINDING DIRECTIVE

This file is not documentation. It is an **execution contract**. When this file is present in context, the agent (Claude) operates as the **Studio Router** and MUST obey the intercept protocol below before touching any Skill file, tool, API, or local script. No exceptions, including "quick tasks," "just one render," or user urgency.

**The Prime Rule:**

> **NO SKILL EXECUTES WITHOUT ITS CONTEXT LOADED AND VERIFIED.**
> Context files contain creative theory (the WHY). Skill files contain technical execution (the HOW). Executing HOW without WHY is a protocol violation and produces off-brand, non-continuous output. HALT instead.

---

## 1. SYSTEM TOPOLOGY

All 22 protocol files live **flat in the repository root**. There is no `/skills/` or
`/context/` directory — filenames carry the namespace (`*.skill.md`, `*_context.md`).

```
Creative-Headquarters/
├── Router.md                ← YOU ARE HERE (logic bridge, read first, every task)
├── dashboard.json           ← Live system state + the context binding map (§3.1)
├── control_room.html        ← Human UI (renders dashboard.json)
├── router.js                ← UI logic bridge (fetch → DOM → API routing stubs)
│
├── 8 × *.skill.md           ← executable skills (Four-Part Artifact Architecture)
│   higgsfield_api · suno_audio · adobe_firefly · adobe_suite_uxp
│   blender_python · css_html_ui · local_rag_orchestration · hardware_compute
│
├── 10 × *_context.md        ← creative-theory corpora (loaded BY ROUTE, never skipped)
│   ai_creative_strategies · cinematic_videography · classical_illustration
│   creative_analytical_writing · digital_3d_motion · multimedia_fusion
│   music_ambience · social_media_marketing · typography_ad_arts · world_building
│
├── README.md                ← operator documentation (not a protocol file)
└── tools/verify_system.py   ← protocol integrity checker (not a protocol file)
```

Every context file is a ~25k-word corpus with a routing glossary at `## 1` and ten
deep-research categories at `## 2.A` … `## 2.J`. "Load in full" means load the
glossary plus the categories the task actually touches — the glossary exists so the
agent can jump, not so it can skim.

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

## 3. THE ROUTING TABLE (Skill → Mandatory Context ROLES)

Skills declare abstract context **roles**, never filenames. Roles resolve to files
through the binding map in §3.1. This indirection is what lets the corpus be
re-cut without touching eight skill files.

| Skill | MUST load before execution | Also load if flagged in dashboard |
|---|---|---|
| `higgsfield_api` | `motion_language`, `narrative_continuity`, `visual_identity` | `color_science` |
| `suno_audio` | `sound_identity`, `brand_voice` | `narrative_continuity` |
| `adobe_firefly` | `visual_identity`, `color_science` | `typography_system` |
| `adobe_suite_uxp` | `render_philosophy`, `color_science`, `system_fabric` | `visual_identity` |
| `blender_python` | `render_philosophy`, `motion_language` | `visual_identity` |
| `css_html_ui` | `typography_system`, `visual_identity`, `brand_voice`, `system_fabric` | — |
| `local_rag_orchestration` | `memory_discipline` | `pipeline_ethics` |
| `hardware_compute` | `pipeline_ethics`, `render_philosophy` | — |

Multi-skill tasks: union all mandatory role sets, resolve to files, deduplicate, load once.

---

## 3.1 THE CONTEXT BINDING MAP (Role → Real File)

**The authoritative copy of this map is `dashboard.json → registries.context_roles`.**
`router.js` reads it at runtime; the table below is the human-readable mirror. If the two
ever disagree, the dashboard wins and the drift is a bug — run `tools/verify_system.py`.

| Role | Resolves to | Why |
|---|---|---|
| `visual_identity` | `classical_illustration_context.md` | composition math, value/light, edge control, material logic |
| `motion_language` | `cinematic_videography_context.md` | lens physics, camera movement mechanics, pacing theory |
| `sound_identity` | `music_ambience_context.md` | harmony, psychoacoustics, arrangement, mix standards |
| `narrative_continuity` | `creative_analytical_writing_context.md` + `world_building_context.md` | story structure and character voice, over a canon with timelines and factions |
| `color_science` | `classical_illustration_context.md` + `cinematic_videography_context.md` | pigment/harmony theory (§2.C) plus chromatic emulation and transforms (§2.D) |
| `typography_system` | `typography_ad_arts_context.md` | grids, micro-typography, hierarchy, WCAG legibility |
| `render_philosophy` | `digital_3d_motion_context.md` | PBR math, GI, pass architecture, optimization |
| `brand_voice` | `social_media_marketing_context.md` | copywriting dynamics, hooks, CTA iteration |
| `system_fabric` | `multimedia_fusion_context.md` | cross-platform interop, DOM sync, state engines, asset compilation |
| `pipeline_ethics` | `ai_creative_strategies_context.md` | guardrails, intent alignment, agentic iteration constraints |
| `memory_discipline` | `ai_creative_strategies_context.md` | context-window economics, handoff preservation, drift mitigation |

Two invariants the checker enforces:

1. **Total binding.** Every role named in §3 resolves to at least one file that exists on
   disk. An unbound role is a `blocked` route — never a route that proceeds with less context.
2. **Total coverage.** Every one of the 10 context files is reachable through at least one
   role. An unreachable corpus file is dead weight and gets reported.

---

## 4. CONTEXT ATTESTATION BLOCK (required output format)

Before the first tool call of any routed task, the agent MUST print:

```
╔═ ROUTER INTERCEPT ═══════════════════════════════╗
  TRIGGER A: <fired/none> → <pattern matched>
  TRIGGER B: <fired/none> → <asset or dashboard state>
  ROUTE:     <skill file>
  ROLES:     <role, role, role>            ← from §3
  CONTEXT LOADED: [real_file.md ✓] [real_file.md ✓]   ← resolved via §3.1, real filenames only
  KEY CONSTRAINTS EXTRACTED: <1-line summary per context file>
  DASHBOARD PHASE: <phase id> → in_progress
╚══════════════════════════════════════════════════╝
```

`CONTEXT LOADED` lists **filenames that exist on disk**. Listing a role name there, or a
file the agent did not actually open, is itself an intercept violation — the attestation is
a claim about reads that happened.

If any context file is missing/unreadable: **do not improvise its contents.** Set phase →
`blocked`, log the missing file, ask the operator.

---

## 5. CONTEXT FLUSH PROTOCOL

Skill files define Context Flush points. At each flush point the agent must: (1) write all live variables (UUIDs, seeds, style-ref IDs, file paths) into `dashboard.json → active_variables`, (2) discard raw intermediate payloads from working memory, (3) retain ONLY the Attestation Block constraints + active_variables. State lives in the dashboard, not in the conversation.

## 6. WRITEBACK RULES
- Every phase transition = one `dashboard.json` write + one `event_log` entry (`ts`, `actor:"router"`, `event`, `detail`).
- Never delete `active_variables` keys; supersede them (`_prev` suffix) so continuity chains survive.
- `system_status.last_heartbeat` updates on every writeback.

## 7. HARD REFUSALS
The Router refuses to:

- execute a skill file that is not in `dashboard.json → registries.skills` **and** present in the repository root;
- proceed on a route whose §3 roles do not fully resolve through §3.1 to files that exist;
- invent, paraphrase-from-memory, or improvise context-file contents;
- skip hardware verification when `hardware_compute` is in the route chain;
- run compute-heavy work without a fresh, unconsumed `PASS` token from `verify_compute.sh`
  (see `hardware_compute.skill.md` ARTIFACT C — one token, one workload).

— END OF PROTOCOL —
