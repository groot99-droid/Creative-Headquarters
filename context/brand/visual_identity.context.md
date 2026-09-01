# visual_identity.context.md — BRAND CONSTANT
### Studio Headless OS · Router.md §3 gate · Gates: adobe_firefly, higgsfield_api, css_html_ui, ui_ux_intelligence

## 0. PROVENANCE

**L0 AUTHORED.** Transcribed from `skills/css_html_ui.skill.md` ARTIFACT A — the
token dictionary already in force in this repository and machine-enforced by
`tools/verify_system.py → check_palette_parity`, which fails the build if
`control_room.html` drifts from it.

Nothing here was generated or inferred. This file does not introduce a new brand;
it promotes constraints the studio was **already operating under** from an
implementation detail inside one skill file to a Router-visible L0 gate.

`skills/ui_ux_intelligence.skill.md` is the declared **regeneration path** for this
file (DECISIONS.md § D9). It does not hold authority to rewrite it: ARTIFACT A's
`mutation_policy` is `operator-approval only; agent proposes, never commits`, and
that policy governs this file too. Where a required constraint has no source, this
file says so rather than inventing one — per Router.md §0, a constraint the system
cannot source is a constraint it does not have.

---

## 1. ROUTING GLOSSARY

| Ask about | Jump to |
|---|---|
| Surface treatment, ground, panels, borders | `## 2. Interface identity` |
| What colour is allowed to mean | `## 3. Semantic discipline` |
| Layout structure, grid, spacing rhythm | `## 4. Structural discipline` |
| Glow, elevation, motion | `## 5. Depth and motion` |
| What is off-limits | `## 6. Off-limits` |
| Generated imagery — motifs, framing, texture | `## 7. Unresolved` |

---

## 2. Interface identity

Dark-ground instrumentation. The studio's own surfaces read as a control room, not
a document: near-black ground, raised panels, hairline borders, dim ink for
structure, and bright ink only where something is live.

| Role | Value | Use |
|---|---|---|
| ground | `#05070E` | page base, never a panel |
| raised | `#121829` | one step up from ground |
| panel | `#1B2238` | content surfaces |
| line | `#3D4668` | hairline borders and dividers, never a fill |
| ink | `#D8DDEA` | body and data |
| ink dim | `#9AA4C0` | labels, structure, anything not being read now |

**Light mode does not exist.** No surface in this studio's own tooling inverts.
Product work built for a client is not bound by this — see §7 and DECISIONS.md § D9.

---

## 3. Semantic discipline

Colour carries state and nothing else. The four accents are a closed vocabulary:

| Accent | Hex | Means |
|---|---|---|
| cyan | `#3EE0CF` | active · healthy · complete |
| amber | `#F2A33C` | awaiting · review · warning |
| alert | `#FF6B87` | blocked · error · violation |
| queued | `#8E93E0` | queued · idle · disabled |

**Decorative colour is a violation.** An accent applied to something that has no
state is the most common way this identity degrades. If an element is not
reporting a condition, it is ink or it is dim ink.

Meaning is never re-derived from appearance — "amber-ish for warning" is how a
fifth accent gets invented. The mapping above is the whole of it.

---

## 4. Structural discipline

- 12 columns, `14px` gutter, `1440px` maximum. New regions are **grid areas**,
  never absolutely-positioned patches.
- Spacing steps are `4 · 8 · 14 · 18 · 22`px. A value between two steps is a bug.
- Radii: panel `6px`, chip `4px`, bar `3px`, pill `999px`.
- Breakpoints: tablet `980px`, mobile `640px`.

`control_room.html` is the reference implementation. A new surface that disagrees
with it is wrong until the token dictionary says otherwise.

---

## 5. Depth and motion

Elevation is **glow, not shadow** — `0 0 10px` of the accent already carrying that
element's state. A glow in a colour the element is not currently signalling is a
semantic error, not a styling choice.

Motion is functional: `width .6s ease` for a fill, a `2.4s` pulse for a live
heartbeat. Every `motion.*` token nulls out under `prefers-reduced-motion`. There
is no decorative animation.

Focus is always visible: `2px solid #3EE0CF`, `2px` offset, applied globally via
`:focus-visible` — not per-component, which is how a control ends up with no ring at
all. Removing it is off-limits (§6), not a trade-off.

---

## 6. Off-limits

- Raw hex or an arbitrary px value in any generated markup — every value resolves
  to a token or it does not ship. This includes `rgba()` restatements of a token:
  a literal copy survives a palette change silently. Derive with `color-mix()`.
- Any value that regresses the ARTIFACT A `contrast_floor`. Every ink and accent
  clears 4.5:1 on all three grounds; every status dot, node, and progress fill
  clears 3.0:1 on its own ground.
- A fifth accent, or an existing accent used decoratively.
- Light-mode surfaces in the studio's own tooling.
- Removing `:focus-visible` styling, for any reason.
- Shadow-based elevation.
- Absolutely-positioned patches instead of grid areas.

---

## 7. Unresolved

This file answers **interface** identity, because that is what the studio has
actually decided. The brand-gate contract (`context/brand/README.md`) also asks
what *generated imagery* from this studio looks like — motifs, framing, texture.

**That has no source yet and is not invented here.** `adobe_firefly` and
`higgsfield_api` load this gate at L0 and will find the interface constraints real
and the imagery constraints absent. Two ways to close it, in order of preference:

1. The operator authors §7 directly — it encodes taste, which is not derivable.
2. Precedent accumulates: once three or more Content MDs of `kind: design` or
   `character` carry imagery decisions, Router.md §5 L2 can derive it, marked
   provisional.

Until then, a route needing imagery motifs states that in its attestation rather
than reading the interface rules above as if they answered the question.
