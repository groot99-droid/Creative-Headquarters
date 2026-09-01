# typography_system.context.md — BRAND CONSTANT
### Studio Headless OS · Router.md §3 gate · Gates: css_html_ui, ui_ux_intelligence

## 0. PROVENANCE

**L0 AUTHORED.** Transcribed from `skills/css_html_ui.skill.md` ARTIFACT A — the
token dictionary already in force in this repository and machine-enforced by
`tools/verify_system.py → check_palette_parity`.

Nothing here was generated or inferred. This file does not introduce a new type
system; it promotes one the studio was **already operating under** from an
implementation detail inside one skill file to a Router-visible L0 gate.

`skills/ui_ux_intelligence.skill.md` is the declared **regeneration path** for this
file (DECISIONS.md § D9), under ARTIFACT A's `operator-approval only` mutation
policy. It proposes; it does not commit.

---

## 1. ROUTING GLOSSARY

| Ask about | Jump to |
|---|---|
| Which typefaces, and where each is used | `## 2. The two faces` |
| Sizes, the scale, tracking | `## 3. Scale and tracking` |
| Hierarchy rules | `## 4. Hierarchy` |
| Licensing | `## 5. Licensing` |
| Product and client work | `## 6. Scope boundary` |

---

## 2. The two faces

A two-face system. There is no third.

| Role | Stack | Used for |
|---|---|---|
| display | `'Chakra Petch', sans-serif` | headings, phase names, numerals |
| mono | `'IBM Plex Mono', monospace` | body, data, labels, logs |

**Mono is the body face**, not an accent for code. This inversion is what gives the
studio's surfaces their instrument-readout character, and it is deliberate —
reading it as a mistake and "fixing" body copy to a sans is the failure mode this
section exists to prevent.

An un-tokened `font-family` in generated CSS is a protocol violation
(`css_html_ui` §0 anti-hallucination law), not a style preference.

---

## 3. Scale and tracking

| Step | Size |
|---|---|
| xs | `10px` |
| sm | `11px` |
| base | `13px` |
| md | `14px` |
| lg | `20px` |

Tracking: labels `0.18em`, display `0.14em`. Both are wide on purpose — at 10–11px,
label tracking is what keeps a dim uppercase label legible against a dark ground.

Legibility at these sizes depends on the ink carrying real contrast, which is why
the 2026-08-31 retheme raised `ink-dim` from `#6E7690` (3.78:1, below AA while
carrying 10px labels) to `#9AA4C0` (6.34:1). A future palette change that lowers it
again breaks this scale, not just that colour.

The scale tops out at `20px`. There is no display size above it because no surface
in this system needs one; a heading that wants 32px is a heading in the wrong place.

**Note the tension, and do not resolve it silently.** A `10px` label and a `13px`
body sit below the 16px body minimum `ui_ux_intelligence` returns from
`ux-guidelines.csv` for general web UI. That guidance is correct for consumer web
and is **not in force here** — these are dense instrumentation surfaces, viewed at
arm's length on one known display. A routed task must not "correct" the studio
scale toward the database default. For product work the database default applies
and this scale does not (§6).

---

## 4. Hierarchy

Hierarchy is carried by **face, size, and tracking together** — never by colour.
Colour is state (`visual_identity` §3), so a heading does not become a heading by
turning cyan.

Descending: display/lg → display/md → mono/base → mono/sm dim → mono/xs dim.

---

## 5. Licensing

Both families are open-licensed (SIL OFL) and embeddable. `ui_ux_intelligence` can
confirm current licence and axis metadata for either:

```bash
python3 tools/ui-ux-pro-max/scripts/search.py "Chakra Petch" --domain google-fonts
```

No licence check has been run against a shipping artifact yet. Treat the OFL
statement as accurate for the families and verify before any distributed binary
embeds them.

---

## 6. Scope boundary

This file governs **the studio's own surfaces** — `control_room.html`, `hub/`, and
anything else HQ ships as its own interface.

It does **not** govern typography for product or client work. There,
`ui_ux_intelligence` selects a pairing from `typography.csv` for that product's
category and persists it to that project's own design system. Applying the Chakra
Petch / IBM Plex Mono pair to a client project because it is "the studio font" is a
category error — see DECISIONS.md § D9.
