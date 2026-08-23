# Content MD — Schema

A **Content MD** is the durable record of one made thing: a character, a design,
an audio piece, a shot, a brush. It captures the exact steps that produced it,
what state it is in, and what happens next.

It is the unit of memory for this system. No live session state persists between
tasks — a Content MD is read cold and is sufficient to resume the work.

---

## The one rule

**The first screenful must answer: what is this, and what do I do next.**

`## Overview` and `## Next Steps` come first, always, before any detail. A person
opening the file in Obsidian and an agent reading the first 40 lines must both
get a usable answer without scrolling. Everything below those two sections is
reference material for when the answer isn't enough.

---

## File placement

```
vault/
├── SCHEMA.md              ← this file
├── _templates/
│   └── content-md.md      ← Obsidian template (Templater/core Templates)
├── _examples/             ← worked examples, safe to delete
└── <project>/
    └── <kind>/
        └── <slug>.md      ← e.g. aurora/character/aurora-lead.md
```

One Content MD per made thing, not per session. Resuming work **updates** the
existing file — appends to `## Timeline`, rewrites `## Next Steps`. It does not
create a second file.

---

## Frontmatter

YAML, Obsidian-native. Queryable by Dataview, indexed by the archive.

```yaml
---
id: cmd_20260823_aurora-lead            # cmd_<YYYYMMDD>_<slug>, stable forever
type: content-md                        # always this literal, marks the file for ingest
kind: character                         # see Kinds below
title: Aurora — Lead Character           # human title, shown in the hub
project: "[[Project Aurora]]"            # wikilink to the project note
status: in-progress                     # see Status below
created: 2026-08-23
updated: 2026-08-23
skills: [adobe_firefly, brush_designer]  # skill ids that touched this
context_brand: [visual_identity, color_science]
context_domain: [classical_illustration]
artifacts:
  - path: assets/aurora/concept-01.png
    role: concept-frame                  # concept-frame | final | variant | reference | export
tags: [character, protagonist]
---
```

### Required
`id`, `type`, `kind`, `title`, `status`, `created`, `updated`

### Optional
`project`, `skills`, `context_brand`, `context_domain`, `artifacts`, `tags`

`project` is optional so a one-off piece doesn't need a project note invented for
it. Everything else optional is genuinely additive.

### Kinds
`character` · `design` · `audio` · `video` · `3d` · `brush` · `copy` · `ui` ·
`world` · `other`

Kinds are a flat vocabulary on purpose. Hierarchy lives in `project` and in the
archive's derived classification path, not here — a fixed taxonomy would go stale
faster than the work does.

### Status
| value | meaning |
|---|---|
| `seed` | Intent captured, nothing made yet |
| `in-progress` | Active work, has artifacts |
| `blocked` | Needs something before it can continue — say what in Next Steps |
| `complete` | Done; may still be referenced as precedent |
| `archived` | Superseded or abandoned; excluded from active views, kept for learning |

---

## Body

Sections in this order. Omit a section only when it is genuinely empty — do not
pad it, and do not reorder.

### `## Overview`
Two to four sentences. What this thing is, where it stands, why it exists. Written
so someone who has never seen the project understands it. No preamble.

### `## Next Steps`
Markdown checkboxes, most important first. Each one concrete enough to start
without asking a question. If `status: blocked`, the blocker is the first item and
names what would unblock it.

```markdown
- [ ] Generate three-quarter view from concept-01 at seed 448811
- [ ] Reconcile jacket colour against `color_science` — current amber reads warm
- [x] Lock front-facing reference
```

### `## Timeline`
Append-only, newest last. One entry per work session. This is the "exact steps"
record — enough to reproduce, not a transcript.

```markdown
### 2026-08-23 · adobe_firefly
Generated 12 concept frames from the brief. Kept 3. Discarded the rest for
silhouette drift — the shoulder line kept widening past the brief's "lean".
→ `assets/aurora/concept-01.png`, `concept-04.png`, `concept-09.png`
```

### `## Method`
The reproducible recipe: prompts, parameters, settings, tool versions. What a
future run needs to match this one. Prefer a code block over prose.

### `## Decisions in Force`
Decisions that constrain future work on this thing. Each one is a rule a later
session must respect or explicitly overturn. Not history — history is the Timeline.

```markdown
- Amber (`#F2A33C`) is an accent only, never the dominant. Overturns the initial
  warm-key direction from 08-21.
- No visible tech; the world is pre-industrial.
```

### `## Open Questions`
Unresolved, with enough context to be answerable later. Deleted when answered —
the answer goes to Decisions in Force.

### `## Contradictions`
Conflicts with other Content MDs, each naming the other file. Written when
detected, cleared when resolved. Empty is the normal state.

```markdown
- `[[neon-harbor-environment]]` sets dusk lighting; this note's Method assumes
  midday key. One of the two has to move.
```

### `## Links`
Wikilinks to related notes. Obsidian's own graph is built from these, so they are
the cheapest way to make the cosmos view real.

---

## For agents writing these

- **Never fabricate a Timeline entry.** Only record steps actually taken. An
  unrecorded step is recoverable; a fictional one poisons every future read.
- **Rewrite `## Next Steps` in full** at the end of each session. It describes the
  present, not an accumulating backlog. Stale next steps are worse than none.
- **Append to `## Timeline`, never edit past entries.** Correct a wrong entry with
  a new dated one that says what was wrong.
- **Bump `updated`.** The hub sorts by it.
- **Move answered Open Questions into Decisions in Force.** Don't leave both.
- **`## Method` must be sufficient to reproduce.** If a parameter mattered, it goes
  in — a Method that needs the original session to interpret has failed.
