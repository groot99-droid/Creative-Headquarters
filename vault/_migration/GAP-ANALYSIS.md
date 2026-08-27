# Creative-Writing → Vault: Migration Gap Analysis

Scope: what separates the 63 works in `groot99-droid/Creative-Writing` from the
Content MDs this system needs to actually route on. Assessment only — no files
have been migrated.

This document lives under `vault/_migration/`. Underscore-prefixed directories are
ignored by ingest (`vault/README.md`) and excluded from the note count in
`tools/verify_system.py`, so this file is not mistaken for a Content MD.

---

## Headline

**The corpus is in excellent shape as a corpus and in zero shape as Content MDs.**

Every one of the 63 works is clean, complete, consistently headed, and correctly
indexed. None of them carries a single field or section the Router reads.

More consequentially: **a perfect migration of all 63 files unblocks 0 of 8 skill
routes.** The corpus can serve 2 of the 10 mandatory brand gates, and neither of
those 2 is sufficient on its own for any skill in the routing table. Migration is
worth doing, but it is not what unblocks the system — see §6.

---

## 1. What exists today

`Creative-Writing/` — 65 markdown files: 63 works + `00_INDEX.md` + `README.md`.

| Folder | Files | Bytes |
|---|---|---|
| `01_Books` | 1 | 64 KB |
| `02_Novels` | 5 | 86 KB |
| `03_Stories` | 9 | 45 KB |
| `04_Book_Concepts` | 8 | 19 KB |
| `05_Worldbuilding` | 3 | 26 KB |
| `06_Songs` | 2 | 6 KB |
| `07_Poems_and_Prose` | 21 | 43 KB |
| `08_Letters` | 1 | 2 KB |
| `09_Dream_Journal` | 2 | 31 KB |
| `10_Characters` | 5 | 22 KB |
| `11_Essays` | 6 | 30 KB |

### What is already right

These are real assets and should survive migration intact:

- **A uniform header block on 63/63 files.** Every work opens with `# Title`, then
  `**Type:**`, `**Source:**`, `**Text:**`, and an optional `**Note:**`, then `---`.
  100% consistent — this is machine-parseable and is the reason most frontmatter
  can be generated rather than hand-entered.
- **Provenance is preserved.** Every file cites its source volume and line range
  (`Master_Volume_1`, lines 4110–4141). That is exactly the kind of traceability
  the Router's attestation model wants, and it is already there.
- **`00_INDEX.md` is perfectly consistent.** 63 links, 63 targets, zero broken
  links, zero unlisted files. Verified both directions.
- **Titles are unique.** Slugifying all 63 titles produces zero collisions, so
  `id` and filename generation is unambiguous.
- **The text is verbatim and declared as such.** No file has been condensed or
  rewritten, and each says so.

### What is absent

- **0 of 63 files have YAML frontmatter.** Not partial — none.
- **0 of 63 have any Content MD body section.** No `## Overview`, `## Next Steps`,
  `## Timeline`, `## Method`, `## Decisions in Force`.
- **0 wikilinks in the entire repo.** `[[...]]` count is zero. The Obsidian graph
  would render 63 disconnected nodes.
- **No project layer.** The schema's path is `<project>/<kind>/<slug>.md`. The
  source has numbered categories, which are *kinds*, not projects.
- **No usable chronology.** All 5 commits land on 2026-08-27. Git gives one date
  for all 63 works, so `created` cannot be recovered from history.

---

## 2. What the system requires

From `vault/SCHEMA.md`:

**7 required frontmatter fields** — `id`, `type`, `kind`, `title`, `status`,
`created`, `updated`. Plus 6 optional: `project`, `skills`, `context_brand`,
`context_domain`, `artifacts`, `tags`.

**8 body sections, in fixed order** — `Overview`, `Next Steps`, `Timeline`,
`Method`, `Decisions in Force`, `Open Questions`, `Contradictions`, `Links`.

**The one rule:** *the first screenful must answer what this is and what to do
next.* `## Overview` and `## Next Steps` come first, always.

**One Content MD per made thing**, not per session.

---

## 3. Field-by-field gap

| Field | Coverage now | Derivable? | Notes |
|---|---|---|---|
| `id` | 0/63 | **Mechanical** | `cmd_<date>_<slug>` from H1; slugs verified unique |
| `type` | 0/63 | **Mechanical** | Literal constant `content-md` |
| `title` | 0/63 | **Mechanical** | H1 line, present on 63/63 |
| `kind` | 0/63 | **Partial — see §4** | 11/63 map cleanly; 52 collapse to `copy` |
| `status` | 0/63 | **Partial** | Folder is a decent proxy: `04_Book_Concepts` → `seed`, finished works → `complete`. Needs a human pass |
| `created` | 0/63 | **No** | Git has one date for everything. Either accept a uniform migration date or recover per-work dates from the author's memory |
| `updated` | 0/63 | **Mechanical** | Migration date is honest here |
| `tags` | 0/63 | **Mechanical** | From `**Type:**` + folder |
| `context_domain` | 0/63 | **Partial** | `world_building_context` and `creative_analytical_writing_context` map plausibly; the other 8 libraries do not |
| `project` | 0/63 | **No** | No project layer exists to derive from — §5 |
| `context_brand` | 0/63 | **No** | This is the L1 lookup key. Requires authoring — §6 |
| `skills` | 0/63 | **N/A** | No skill produced these; empty is the honest value |
| `artifacts` | 0/63 | **N/A** | The markdown *is* the artifact |

### Body sections

| Section | Derivable? | Notes |
|---|---|---|
| `## Overview` | **Partial** | `**Type:**` + `**Note:**` + opening lines give real material, but each still needs 2–4 written sentences |
| `## Next Steps` | **No** | Finished works have no next step. This is the schema's *first* rule and the hardest gap — §7 |
| `## Timeline` | **No, and must not be faked** | SCHEMA: *"Never fabricate a Timeline entry."* The only honest entry for a migrated work is the migration itself |
| `## Method` | **No** | These are hand-written. There is no prompt, seed, or parameter set to record. Honest answer for most is omission |
| `## Decisions in Force` | **No — critical** | Nothing in the corpus states a decision as a forward-binding rule. This is precisely what the L1 ladder reads — §6 |
| `## Open Questions` | N/A | Empty is normal |
| `## Contradictions` | N/A | Empty is normal |
| `## Links` | **No** | Zero wikilinks exist; the relationships are real but entirely unrecorded |

---

## 4. The `kind` vocabulary does not fit writing

`SCHEMA.md` defines a flat vocabulary: `character` · `design` · `audio` · `video` ·
`3d` · `brush` · `copy` · `ui` · `world` · `other`. It is a visual/AV production
vocabulary. Mapping the corpus onto it:

| Proposed `kind` | Files | Source folders |
|---|---|---|
| `copy` | **52** | Books, Novels, Stories, Book Concepts, Poems, Letters, Dream Journal, Essays |
| `character` | 6 | `10_Characters` (5) + Chasing Cold Clues |
| `world` | 3 | `05_Worldbuilding` |
| `audio` | 2 | `06_Songs` |

**83% of the corpus lands in a single bucket.** That is not a cosmetic problem. The
L2 rung of the resolution ladder derives constraints from *"precedent across Content
MDs of related `kind`"* — if a poem, a horror novel, a dream journal and a personal
essay are all `copy`, then everything is related to everything and `kind` stops
discriminating. L2 derivation over this corpus would be noise.

Note also that `audio` at 2 files sits below the ladder's own floor: L2 *"requires at
least 3 notes; fewer is not precedent, it is a coincidence."*

**This needs a decision before migration, not after.** Three options:

1. **Extend the vocabulary** — add `poem`, `story`, `novel`, `essay`, `concept`,
   `journal`. Cleanest semantically; requires an edit to `SCHEMA.md` and a DECISIONS
   entry. The schema calls the vocabulary flat *on purpose*, so this is a real
   amendment, not a typo fix.
2. **Keep `copy` and discriminate via `tags`** — no schema change, but `tags` is
   optional and unqueried by the ladder, so L2 stays degraded.
3. **Migrate as `copy` and accept L2 is unusable for writing** — lowest effort,
   and defensible if the corpus is only ever meant to serve L1 recall.

Recommendation: **option 1.** The vocabulary was written before a 63-work writing
corpus existed; it should absorb it.

---

## 5. There is no project layer

The schema's path is `vault/<project>/<kind>/<slug>.md`, and `project` is a wikilink
to a project note (`"[[Project Aurora]]"`). The source has none. `01_Books`,
`07_Poems_and_Prose` and the rest are kinds, not projects.

`project` is explicitly optional — *"so a one-off piece doesn't need a project note
invented for it"* — and many poems genuinely are one-offs. But some works clearly do
cluster: Wyrmreach (`World_Codex_of_Wyrmreach` + `Graknox`), the Lira Calyx
four-book bible, the four archetype profiles (Bottonian / Kafkan / Darwishan /
Rossettian). Those clusters exist in the author's head and nowhere in the files.

Decisions needed: (a) which works group into projects, (b) whether project notes get
authored, (c) the flat-directory fallback for genuine one-offs. Only the author can
answer (a).

---

## 6. Migration alone unblocks nothing — the decisive finding

The system is `BLOCKED` because all 10 brand gates are unauthored and the vault is
empty, so every route parks at L3 (`dashboard.json`, `Router.md` §5). It is tempting
to read "the vault is empty" as *the* problem and migration as the fix. It is not.

Of the 10 mandatory gates, here is what 63 works of prose can honestly serve:

| Gate | Servable from this corpus? | Why |
|---|---|---|
| `brand_voice` | **Yes** | Diction, register, person — 63 works of the author's own prose is a strong evidence base |
| `narrative_continuity` | **Yes** | Canon rules and character persistence: 3 world bibles + 6 character profiles + 5 novels |
| `memory_discipline` | Weak | The repo is "private notes" — a real signal, but retention rules are stated nowhere |
| `sound_identity` | No | 2 song files, both lyrics; no instrumentation, tempo, or mix targets. Also below the L2 floor of 3 |
| `visual_identity` | No | — |
| `color_science` | No | — |
| `typography_system` | No | — |
| `motion_language` | No | — |
| `render_philosophy` | No | — |
| `pipeline_ethics` | No | — |

Now against the routing table (`Router.md` §3):

| Skill | Mandatory gates | Served by corpus | Still blocked by |
|---|---|---|---|
| `higgsfield_api` | motion_language, narrative_continuity, visual_identity | 1 of 3 | motion_language, visual_identity |
| `suno_audio` | sound_identity, brand_voice | 1 of 2 | **sound_identity** |
| `adobe_firefly` | visual_identity, color_science | 0 of 2 | both |
| `adobe_suite_uxp` | render_philosophy, color_science | 0 of 2 | both |
| `blender_python` | render_philosophy, motion_language | 0 of 2 | both |
| `css_html_ui` | typography_system, visual_identity, brand_voice | 1 of 3 | typography_system, visual_identity |
| `local_rag_orchestration` | memory_discipline | 0 of 1 (weak) | **memory_discipline** |
| `hardware_compute` | pipeline_ethics, render_philosophy | 0 of 2 | both |

**0 of 8 skills route after a complete, perfect migration.** The two closest are
`suno_audio` and `local_rag_orchestration`, each one authored file away.

The reason is structural, not a matter of migration quality: L1 resolution reads a
note's `## Decisions in Force` for a statement of the constraint, and finished
creative works do not contain forward-binding rules about how future work must be
made. A poem is evidence of a voice; it is not a statement of voice policy.

**Implication for sequencing:** the cheapest path to a non-BLOCKED system is
authoring 2–3 `context/brand/*.context.md` files, which is independent of this
migration and could happen today. Migration's real payoff is different and slower —
it builds the precedent corpus that keeps derived constraints honest, and it makes
`brand_voice` and `narrative_continuity` genuinely derivable rather than invented.
Both are worth doing. They are not the same task, and migration should not be sold
as the thing that turns the system on.

---

## 7. The `Next Steps` problem

The schema's central rule is that the first screenful says *what do I do next*, and
`## Next Steps` must be *"concrete enough to start without asking a question."*

For 63 works that are already finished, the honest answer is frequently "nothing."
Writing filler next-steps to satisfy the template would violate the schema's own
standard — *"Stale next steps are worse than none"* — and would poison every future
read of the vault.

Options, in order of preference:

1. **Migrate finished works as `status: complete` with `## Next Steps` omitted.**
   The schema permits omitting a genuinely empty section. `complete` already means
   *"done; may still be referenced as precedent"* — which is exactly the role these
   files play. This is the honest reading.
2. **Give concepts and pitches real next steps.** The 8 book concepts, the seeds and
   fragments (`Low In The Water` is 12 lines) plausibly *do* have a next action, and
   those should carry `status: seed` with genuine items.
3. **Do not invent next steps for finished work.** Explicitly rejected.

Same logic for `## Timeline`: the only non-fabricated entry for a migrated work is
the migration itself, dated, noting the source volume and line range.

---

## 8. Summary of decisions required before migration

These are the author's to make; none can be derived from the files.

1. **`kind` vocabulary** — extend the schema for writing, or accept 52 files in
   `copy` and a degraded L2 (§4). *Blocks everything else.*
2. **Project grouping** — which works cluster into projects, which stay one-offs (§5).
3. **`created` dates** — accept a uniform migration date, or supply real ones (§3).
4. **`status` per work** — `complete` vs `seed`; folder is a starting proxy (§3).
5. **Granularity** — `09_Dream_Journal/01_Dream_Journal.md` holds six dream entries
   and `01_The_First_Friend.md` holds a book plus its appendix. "One Content MD per
   made thing" arguably makes these 6 and 2 notes rather than 1 and 1.
6. **`Next Steps` policy for finished work** — recommend omission (§7).
7. **Which brand gates to author first** — `sound_identity` and `memory_discipline`
   each unblock a skill outright; `brand_voice` and `narrative_continuity` are the
   two the corpus can back with real precedent (§6).

## What migration will cost

Mechanical, scriptable across all 63 files: `id`, `type`, `title`, `updated`,
`tags`, and the section skeleton. Roughly 6 of 13 frontmatter fields.

Requires human judgment, per file: `kind` (for the 52), `status`, `project`,
`context_brand`, `## Overview`, `## Links`, and next steps for the seeds.

The bottleneck is not the conversion. It is that 63 finished works have to be read
and placed by someone who knows what they are.
