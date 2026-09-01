---
id: cmd_20260831_ui-ux-intelligence-integration
type: content-md
kind: ui
title: ui_ux_intelligence — Skill Integration
project: "[[Studio Headless OS]]"
status: in-progress
created: 2026-08-31
updated: 2026-09-01
skills: [ui_ux_intelligence, css_html_ui]
context_brand: [visual_identity, typography_system, color_science]
context_domain: [typography_ad_arts]
artifacts:
  - path: skills/ui_ux_intelligence.skill.md
    role: final
  - path: tools/ui-ux-pro-max/
    role: reference
  - path: context/brand/visual_identity.context.md
    role: final
  - path: context/brand/typography_system.context.md
    role: final
  - path: context/brand/color_science.context.md
    role: final
tags: [protocol, skill, design-system, brand-gate]
---

## Overview

The ninth routed skill. `ui_ux_intelligence` wraps a vendored design-intelligence
corpus — 79 searchable UI styles, 192 product palettes, 74 font pairings, 119 UX
guidelines, 22 stacks — behind a stdlib-only Python search engine that runs offline
from `tools/ui-ux-pro-max/`. It decides what a thing should look like;
`css_html_ui` builds it.

Integrating it also closed three of the ten brand gates. `visual_identity`,
`typography_system`, and `color_science` were **transcribed** from `css_html_ui`
ARTIFACT A — constraints the studio was already operating under and that
`check_palette_parity` already enforced — and promoted from an implementation
detail inside one skill file to Router-visible L0 gates. They were not generated.

The system moved from `BLOCKED` to `DEGRADED`: `ui_ux_intelligence` is the first
skill in this repository whose entire mandatory context resolves at L0, so it is
the first route that runs without provisional constraints.

## Next Steps

- [ ] Look at the rethemed control room on the actual Yoga Book display. The palette
      was verified by computed contrast ratios and rendered at three breakpoints, but
      no person has judged it on the target screen.
- [ ] Decide the working space and delivery transform. `color_science` §5 is
      authored but explicitly does not answer it, so `adobe_suite_uxp` still gets a
      palette rather than a colour pipeline. Operator decision; the corpus cannot
      supply it.
- [ ] Author `visual_identity` §7 — imagery motifs, framing, texture. Until it
      exists, `adobe_firefly` and `higgsfield_api` load the gate at L0 and find the
      interface constraints real and the imagery constraints absent.
- [ ] Run the first *product-work* design system end to end (`--design-system
      --persist --output-dir <project-root>`) to confirm the ARTIFACT B handoff shape
      is what `css_html_ui` actually consumes. Still untested.
- [ ] Decide whether `brand_voice` is next. It is the last gate blocking
      `css_html_ui`, queued at `ph_06`.
- [ ] Widen `check_palette_parity` to every studio surface, not just
      `control_room.html`. `hub/styles.css` drifted once and was only caught by
      reading it; a second surface added later would not be caught at all.
- [ ] Consider a `check_vendor_hash` addition to `verify_system.py` — the payload
      sha256 in `VENDOR.md` is recorded but nothing verifies it on a run.

## Timeline

### 2026-08-31 · ui_ux_intelligence

Vendored `data/` + `scripts/` from upstream ui-ux-pro-max 2.13.0 into
`tools/ui-ux-pro-max/` — 44 files, 3.3 MB, excluding `scripts/tests/` and
`__pycache__/`. Kept the payload byte-identical to upstream (LF) rather than
normalising to this repo's CRLF, so the recorded sha256 stays comparable against an
upstream checkout. Smoke-tested in place: the `ux` domain and `--design-system
--json` both answer from the new location.

Wrote `skills/ui_ux_intelligence.skill.md` in the Four-Part Artifact Architecture.
Its §0.1 scope boundary is the load-bearing part — the skill is the *upstream
generator* for studio surfaces (proposes, never commits, per ARTIFACT A's
`operator-approval only` mutation policy) and the *sole token authority* for
product work.

Authored three brand gates by transcription from ARTIFACT A. Each carries a §0
PROVENANCE block stating it was transcribed rather than generated, and each names
its own gaps rather than padding them: `visual_identity` §7 and `color_science` §5.

Wired the registries: `dashboard.json` (skill entry, three gates flipped to
`authored: true`, `file_count_target` 22 → 23, state → `DEGRADED`, two event-log
entries), `Router.md` (§1 topology, §2 Trigger A and file-type detection, §3
routing table, plus a new paragraph distinguishing *authored* from *complete*),
`router.js` (`resolveGates` map), `tools/verify_system.py` (hardcoded skill count
→ dynamic).

`python3 tools/verify_system.py` returned 17 pass / 1 fail before this note
existed — the L3-consistency check correctly objected that seven gates were
unauthored with zero vault notes to derive from while `state` claimed `DEGRADED`.
Writing this file is what makes that state true.

### 2026-08-31 · ui_ux_intelligence, css_html_ui

Ran the ARTIFACT D regeneration loop against the studio's own tokens, operator-
authorised, and committed the result — the first time this skill wrote studio
surface tokens rather than proposing them.

The generator misrouted twice before it was useful: `"creative studio control room
dashboard dark instrumentation"` → *Photography Studio* (scroll-storytelling for a
portfolio site). The narrower `"internal operations monitoring dashboard telemetry"`
→ *Smart Home/IoT Dashboard*, whose dark-tech ground, status accent, and dense
spacing did fit. Used as evidence, not instruction.

Measured the old palette before changing anything, which is what justified the
change: `accent.queued` at **2.23:1** (below the 3.0 non-text floor, so a queued
status dot was non-compliant) and `ink.dim` at **3.78:1** while carrying 10–11px
labels. Both now clear 4.5:1 — worst case 5.55:1 and 6.34:1 on `bg-panel`. Recorded
a `contrast_floor` block in ARTIFACT A so the next palette cannot regress them
silently, and corrected `color_science` §4, which had hedged around the ink-dim
failure rather than reporting it.

Rendering the page then exposed four layout bugs the source review had missed:
`word-break: break-all` splitting words mid-token, 724px of dead space inside the
Event Log panel, mobile horizontal overflow (682px in a 375px viewport, caused by
`min-width:auto` grid tracks), and two scroll regions that could not take keyboard
focus. All fixed; the wrapping fix came straight out of the corpus
(*Long Token Wrapping*), which diagnosed its own host system.

Verified at 375 / 768 / 1265px: no horizontal overflow anywhere, log dead space
724px → 24px, `check_palette_parity` green, `verify_system.py` exit 0.

### 2026-09-01 · ui_ux_intelligence, css_html_ui

Rethemed `hub/` to ARTIFACT A, clearing the contradiction logged yesterday — the two
studio surfaces no longer disagree. Nothing enforces that automatically:
`check_palette_parity` still reads only `control_room.html`.

Added a **Designer Pro** tab to the hub. It fetches the vendored CSVs over HTTP and
filters them by domain, so there is no second copy of the corpus to drift. It is a
token-overlap reader, not the BM25 engine, and the tab says so in a banner rather
than leaving a user to discover the difference by being wrong.

Built it wrong first: the domain config guessed column names (`Mood` for what is
actually `Mood/Style Keywords`), so several domains scored against columns that do
not exist and returned near-nothing. Only `ux` worked, because those guesses happened
to be right. Rewrote the config against the real CSV headers and made scoring cover
every column except an explicit noise list, so a new upstream column is picked up
instead of silently ignored.

Verified against the CLI: `"keyboard focus modal" --domain ux` ranks *Focus States*
first in both. Ordering diverges elsewhere — the CLI's top three for
`"playful modern" --domain typography` are Fredoka / Baloo 2 / Outfit, the reader's
are Modern Professional / Playful Creative / Geometric Modern. Both are defensible;
they are different algorithms, which is exactly what the banner warns about.

### 2026-09-01 · ui_ux_intelligence (hub)

Rebuilt the Designer Pro tab from a read-only corpus browser into a **style
generation and mixing assistant**. Ingredients are picked across domains and blended
by Ollama; the tab splits deliberately into a deterministic layer and a model layer.

The deterministic layer runs conflict checks straight off corpus fields — `Status:
deprecated` (with the replacement id), `risk:high` / `risk:conditional`, `cost:high`,
mode clashes between `Preferred Mode` and `Dark/Light Mode ✓`, and complexity
stacking. None of it needs a model, and none of it can be wrong the way a generated
claim can.

**Built it wrong first, twice.** The initial prompt showed those checks on screen but
did not put them in the prompt; asked to blend Neumorphism with Glassmorphism — two
competing depth systems the corpus flags `risk:conditional` — the model answered
`TENSIONS: none, the ingredients blend harmoniously`. Feeding the findings into the
prompt as stated FACTS with "do not answer none while a check is listed" changed the
same mix to four tensions, including one it found itself: Neumorphism's guidance
against dark-mode-only products against the brief's dark-first requirement, with an
explicit call on which side to keep. The second error was mechanical — patching the
file through a shell heredoc turned `
` escapes into real newlines inside a
double-quoted JS string, which is a syntax error; the whole tab silently failed to
mount. Fixed by editing the file literally instead of through two escaping layers.

Measured on this hardware: 137s for a 3-ingredient blend, llama3.1:8b, CPU only.
That is slow enough that a static "working…" line reads as a hang, so the run shows
an elapsed counter and the button becomes Cancel (added an optional `signal` to
`HubOllama.generate`, additive — the Ask tab passes nothing and is unchanged).
`num_predict` came down from 700 to 420.

Verified: 375px and desktop both clean, no horizontal overflow; parse-checked before
mounting after the syntax break.

## Method

```bash
# Vendor (excludes tests and __pycache__; keeps upstream LF)
SRC="<upstream>/src/ui-ux-pro-max"
cp -r "$SRC/data" "$SRC/scripts" tools/ui-ux-pro-max/
rm -rf tools/ui-ux-pro-max/scripts/tests
find tools/ui-ux-pro-max -name __pycache__ -type d -exec rm -rf {} +

# Locked smoke tests — both must answer from the vendored path
python3 tools/ui-ux-pro-max/scripts/search.py "keyboard focus modal" --domain ux -n 1
python3 tools/ui-ux-pro-max/scripts/search.py "studio creative tooling dark" --design-system --json

# Protocol integrity — must exit 0
python3 tools/verify_system.py
```

Upstream: ui-ux-pro-max 2.13.0, MIT. Payload sha256 recorded in
`tools/ui-ux-pro-max/VENDOR.md`; recompute it after any re-vendor.

Gate transcription source: `skills/css_html_ui.skill.md` ARTIFACT A — ten palette
values, two font stacks, the 10/11/13/14/20px scale, `0.18em` / `0.14em` tracking,
the `4·8·14·18·22` spacing steps, 12-column `14px`/`1440px` grid, and the four-state
semantic binding.

## Decisions in Force

- **Two token authorities, split by consumer.** `css_html_ui` ARTIFACT A governs
  studio surfaces (`control_room.html`, `hub/`). `ui_ux_intelligence` governs
  product and client work through its own persisted `MASTER.md`. Applying the
  studio palette or Chakra Petch to a client project is a category error.
- **On studio surfaces this skill proposes and never commits.** Regenerating
  ARTIFACT A or any of the three gates follows the four-step operator-approval loop
  in the skill's ARTIFACT D. Writing those files from a search result without step
  4 is an intercept violation.
- **The three gates were transcribed, not generated.** They encode decisions
  already in force. This matters for provenance: they are L0 authored, not L2
  derived, and their §0 blocks say so.
- **L0 means authored, not complete.** `visual_identity` §7 and `color_science` §5
  declare what they do not answer. A route needing those constraints treats them as
  unresolved regardless of the file existing. Recorded in Router.md §3.
- **The studio type scale is not the corpus default.** `ux-guidelines.csv` sets a
  16px body minimum for consumer web; the studio runs 13px body and 10px labels on
  dense instrumentation surfaces. A routed task must not "correct" the studio scale
  toward the database. For product work the database default applies.
- **The ARTIFACT A `contrast_floor` is binding.** Every ink and accent clears
  4.5:1 on all three grounds; every status dot, node, and progress fill clears
  3.0:1 on its own ground. A proposed token that regresses either is rejected.
  This overturns the pre-2026-08-31 reading of `color_science` §4, which treated
  dim ink's sub-AA contrast as an acceptable hierarchy trade-off.
- **No `word-break: break-all` on prose.** Use `overflow-wrap: anywhere` with
  `min-inline-size: 0`. break-all splits inside words and is for opaque tokens
  only.
- **Grid tracks are `minmax(0, ·)`, never bare `1fr`.** A bare track has
  `min-width: auto`, so one over-wide child silently widens the whole grid —
  this is what put 682px of content in a 375px viewport.
- **Wide content scrolls inside its own container, never the page body.** The
  pipeline rail owns its overflow; a scroll region also carries `tabindex="0"`
  and an accessible name, or it is not keyboard-operable.
- **Deterministic findings must enter the prompt, not just the screen.** A check
  the model cannot see is a check the model will contradict — it reported
  "TENSIONS: none" over a mix the corpus itself flagged. Corpus facts go into the
  prompt as facts.
- **Generated directions are proposals and never tokens.** The hub writes nothing
  to ARTIFACT A or `context/brand/`; that path stays the ARTIFACT D operator loop.
- **The vendored payload carries no local edits.** Fixes go upstream and are
  re-vendored, because a local patch is invisible to the recorded hash.

## Open Questions

- Should `ui_ux_intelligence` get its own pipeline phase, or does it always run as
  the front half of a `css_html_ui` phase? Currently unphased — it routes on
  trigger, and `ph_06` still lists `css_html_ui` alone.
- The upstream corpus ships a `web` domain for iOS/Android/React Native interface
  guidance that overlaps `adobe_suite_uxp`'s territory at the edges. No conflict has
  surfaced yet; worth watching rather than pre-empting.

## Contradictions

Resolved 2026-09-01: `hub/styles.css` was rethemed to ARTIFACT A, so the two studio
surfaces agree again. The underlying gap remains and is now a Next Step —
`check_palette_parity` reads only `control_room.html`, so nothing would catch the
hub drifting a second time.

The contradiction that would otherwise have existed — `ui_ux_intelligence`
generating a palette that contradicts ARTIFACT A — is prevented by the §0.1 scope
split rather than left to be caught later.

## Links

- [[Studio Headless OS]]
