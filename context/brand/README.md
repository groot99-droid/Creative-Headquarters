# context/brand/ — Router-mandatory context files

**Status: NOT YET AUTHORED. The Router blocks on every route until these exist.**

## Why this directory exists

`Router.md` §3 (Routing Table) names ten context files as mandatory gates. Every
skill route requires two or three of them loaded *in full* before any tool call.
None of them had ever been written — the ten `*_context.md` files that shipped in
this repo are a different kind of artifact entirely, and now live in
`context/domain/`.

The distinction, which the original layout collapsed:

| | `context/brand/` (this directory) | `context/domain/` |
|---|---|---|
| **What it is** | Constants for *this studio's* output — your palette, your voice, your render rules | General reference libraries — worldbuilding, cinematography, illustration theory |
| **Who writes it** | You. It cannot be generated; it encodes taste and prior decisions | Already written, 216 lines each, 10 files |
| **How the Router uses it** | Hard gate. §7: *"refuses to invent context-file contents"* | Retrievable material, not a gate |
| **Scope** | Project-specific, changes when the brand changes | Stable, reusable across projects |

Loading a domain library where a brand constant is required would satisfy the
letter of the routing table and defeat its purpose — the gate exists to keep
output on-brand, and a treatise on cinematography says nothing about *your* brand.

## The ten files required

Each must be readable at `context/brand/<name>.context.md`.

| File | Gates these skills | Must answer |
|---|---|---|
| `visual_identity.context.md` | firefly, higgsfield, css_html_ui, suite_uxp* | What does work from this studio look like? Motifs, framing, texture, what is off-limits. |
| `color_science.context.md` | firefly, suite_uxp, higgsfield* | Working space, LUTs, palette with hex values, grading rules. |
| `typography_system.context.md` | css_html_ui, firefly* | Typefaces, scale, tracking, hierarchy, licensing. |
| `motion_language.context.md` | higgsfield, blender_python | Camera grammar, easing, shot lengths, transitions to avoid. |
| `sound_identity.context.md` | suno_audio | Instrumentation, tempo range, mix targets, sonic signature. |
| `brand_voice.context.md` | suno_audio, css_html_ui | Diction, register, person, banned phrasings. |
| `narrative_continuity.context.md` | higgsfield, suno_audio* | Canon rules, character/environment persistence, what may not be retconned. |
| `render_philosophy.context.md` | suite_uxp, blender_python, hardware_compute | Quality bar, when to re-render vs. accept, output specs. |
| `pipeline_ethics.context.md` | local_rag, hardware_compute | Disclosure, provenance, sourcing rules, what is never generated. |
| `memory_discipline.context.md` | local_rag | Quotable vs. summarizable, retention, what leaves the machine. |

`*` = conditional, loaded only when flagged in `dashboard.json`.

## Format

Match `context/domain/`: markdown, a routing glossary at the top so the Router can
scan it, then the substance. There is no minimum length — a short file of real
decisions beats a long file of plausible-sounding filler, and the Router only
requires that the file exist and be readable.

## Until then

Any routed task will hit §4 and set its phase to `blocked` with the missing
filename logged. That is correct behavior, not a bug — the system refusing to
produce off-brand work rather than guessing.
