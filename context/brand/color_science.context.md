# color_science.context.md — BRAND CONSTANT
### Studio Headless OS · Router.md §3 gate · Gates: adobe_firefly, adobe_suite_uxp, ui_ux_intelligence

## 0. PROVENANCE

**L0 AUTHORED.** Transcribed from `skills/css_html_ui.skill.md` ARTIFACT A — the
token dictionary already in force in this repository. Seven of the values below are
re-verified on every run by `tools/verify_system.py → check_palette_parity`.

Nothing here was generated or inferred. Where a constraint the brand-gate contract
asks for has no source, this file says so rather than inventing one — per
Router.md §0, a constraint the system cannot source is a constraint it does not
have. Read §5 before treating this file as a colour pipeline.

---

## 1. ROUTING GLOSSARY

| Ask about | Jump to |
|---|---|
| The palette, exact hex values | `## 2. Palette` |
| What each colour is allowed to mean | `## 3. Semantic binding` |
| Contrast floors | `## 4. Contrast` |
| Working space, LUTs, grading | `## 5. Unresolved` |

---

## 2. Palette

The complete studio palette. Ten values; there is no eleventh.

| Token | Hex | Role |
|---|---|---|
| `bg` | `#05070E` | ground |
| `bg-raise` | `#121829` | raised surface |
| `bg-panel` | `#1B2238` | panel surface |
| `line` | `#3D4668` | hairline border |
| `ink` | `#D8DDEA` | primary text |
| `ink-dim` | `#9AA4C0` | secondary text |
| `cyan` | `#3EE0CF` | state: nominal |
| `amber` | `#F2A33C` | state: waiting |
| `alert` | `#FF6B87` | state: blocked |
| `queued` | `#8E93E0` | state: idle |

The palette is not advisory: `check_palette_parity` re-reads `bg`, `bg-raise`,
`bg-panel`, `cyan`, `amber`, `alert`, and `queued` from ARTIFACT A on every run and
fails if `control_room.html` disagrees.

---

## 3. Semantic binding

`cyan → nominal · amber → waiting · alert → blocked · queued → idle`

This is the same table as `visual_identity` §3, and the two must not drift. The
duplication is deliberate — a colour gate and an identity gate both need it — but
if they ever disagree, ARTIFACT A `semantic.*` is the tiebreak.

An accent used outside its bound state is a violation, including "close enough"
uses: amber as a highlight, cyan as emphasis, alert as a decorative rule.

---

## 4. Contrast

**Every value in §2 clears 4.5:1 on all three grounds.** Worst case is `ink-dim` at
6.34:1 on `bg-panel`. Every accent used as a status dot, node border, or progress
fill clears the 3.0:1 non-text floor against its own ground; worst case is `queued`
on `line` at 3.25:1.

This is stricter than the file said before 2026-08-31. The earlier text claimed ink
cleared AA and hedged that dim ink was "structure, not reading matter" — a measured
audit showed that hedge was covering two real failures: `ink-dim` at **3.78:1**
while carrying 10–11px labels, and `queued` at **2.23:1**, below even the 3.0 floor
that applies to it as a status dot. Both were palette bugs, not acceptable trade-offs,
and the retheme fixed them. The floor is now recorded in ARTIFACT A `contrast_floor`
so a future value that regresses either one is rejected rather than re-hedged.

Dim ink is still **secondary**, and should not hold the only copy of something the
operator must read — but that is now an information-hierarchy rule, not a contrast
excuse.

Verify any new pairing before it ships:

```bash
python3 tools/ui-ux-pro-max/scripts/search.py "contrast ratio text legibility" --domain ux
```

---

## 5. Unresolved

The brand-gate contract asks this file for **working space, LUTs, and grading
rules**. Those have no source in this repository and are **not invented here**.

What §2 gives you is a UI token set in sRGB hex. It is not a colour-managed
pipeline: there is no declared working space, no LUT, no grading ladder, and
nothing that tells `adobe_suite_uxp` what to do with a linear EXR.

Stated plainly, so a route does not mistake this file's existence for an answer:
**`adobe_firefly` and `adobe_suite_uxp` load this gate at L0 and get a palette, not
a colour pipeline.** A task needing a working space or a grade treats that specific
constraint as unresolved and says so in its attestation. A file existing does not
make every question in it answered.

Closing this requires an operator decision — which working space, which delivery
transform — or enough precedent in `vault/` to derive one. `ui_ux_intelligence`
cannot supply it: `colors.csv` holds product palettes, not colour-management policy.
