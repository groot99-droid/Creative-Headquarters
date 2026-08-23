---
id: cmd_20260823_dry-stipple-brush
type: content-md
kind: brush
title: Dry Stipple — Texture Brush
project: "[[Brush Kit v1]]"
status: in-progress
created: 2026-08-23
updated: 2026-08-23
skills: [brush_designer]
context_brand: [visual_identity]
context_domain: [classical_illustration]
artifacts:
  - path: assets/brushes/dry-stipple-v3.brush
    role: final
  - path: assets/brushes/dry-stipple-v1.brush
    role: variant
tags: [brush, texture, procreate]
---

## Overview

A dry stipple brush for building tonal texture without visible stroke direction —
the grain reads as deposited pigment rather than a dragged mark. Intended as the
shading workhorse of Brush Kit v1. v3 is usable and exported; spacing at very low
pressure still clumps slightly.

## Next Steps

- [ ] Fix low-pressure clumping — try `brushSpacingJitter` 0.18 → 0.26 before
      touching spacing itself
- [ ] Test against a full value ramp, not just mid-tones
- [ ] Decide whether this ships alongside `[[wet-stipple-brush]]` or replaces it
- [x] Export v3 as `.brush` and confirm it opens in Procreate

## Timeline

### 2026-08-23 · brush_designer

Built from the default state. Three iterations:

- **v1** — square grain, spacing 0.08. Far too dense, read as solid fill above 40%
  pressure. Kept as a variant for reference.
- **v2** — swapped to noise grain, spacing 0.14. Better, but the stroke direction
  was visible on long curves; streamline was doing too much.
- **v3** — dropped `brushStreamline` to 0.12, raised `brushJitterX/Y`. Direction
  cue gone. Exported.

Clumping below ~15% pressure was present in all three and is not spacing alone —
noted for next session.

→ `assets/brushes/dry-stipple-v3.brush`

## Method

Reproduce from `tools/brush-designer/` defaults, changing only:

```
brushSpacing            0.14
brushSpacingJitter      0.18
brushStreamline         0.12
brushStreamlinePressure 0.40
brushJitterX            0.22
brushJitterY            0.22
blendMode               Normal (0)
grain                   noise generator, scale 0.6, contrast 0.75
shape                   default round, hardness 0.35
```

Export via the Export panel → `.brush`. Do not export as `.brushset` unless
shipping the whole kit — Procreate imports a single-brush set as a new group.

## Decisions in Force

- Grain is generated, never a photographed texture. Keeps the kit self-contained
  and redistributable.
- Streamline stays below 0.15 on every texture brush in this kit. Above that the
  stroke reads as vector-smooth and breaks the hand-made quality the kit is for.
- Blend mode stays Normal. Multiply looked better in isolation but stacks
  unpredictably over the palette's darks.

## Open Questions

- Is low-pressure clumping a spacing artifact or a grain-scale artifact? The two
  are hard to separate by eye at that pressure.

## Contradictions

*(none)*

## Links

- [[Brush Kit v1]]
- [[wet-stipple-brush]]
- [[visual_identity]]
