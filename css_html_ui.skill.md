# css_html_ui.skill.md — FRONT-END CONSTRUCTION EXECUTABLE
### Studio Headless OS · Skill 6/8 · Four-Part Artifact Architecture

---

## 0. ROUTING HEADER (Part 1 of 4)

```yaml
skill_id: css_html_ui
version: 1.0
trigger_a: ["UI", "dashboard", "component", "landing page", "DOM", "front-end", "panel", "widget"]
trigger_b: [".html", ".css", ".jsx(web)", "pipeline phase skill=css_html_ui"]
mandatory_context: [typography_system, visual_identity, brand_voice, system_fabric]
writes_dashboard_keys: [pipeline.phases[*].progress_pct]
danger_class: LOW   # but style drift is BRAND damage — tokens are law
```

**Anti-hallucination law:** every color, font, size, radius, shadow, spacing step, and status meaning used in ANY generated markup or DOM mutation MUST resolve to a key in ARTIFACT A (the Design Token Dictionary). If a needed value has no token, the agent does not invent one — it proposes a token addition to the operator and waits. Hex literals, arbitrary px values, and un-tokened font stacks in output = protocol violation.

---

## 1. PREREQUISITES & STATE VERIFICATION (Part 2 of 4)

```bash
# P1 — Attestation exists
grep -q "ROUTER INTERCEPT" ./.task_scratch/attestation.txt || echo "FAIL:P1"

# P2 — Token artifact extracted to disk and valid
python3 -c "import json;json.load(open('tokens/design_tokens.json'))" 2>/dev/null && echo "OK:P2" \
  || echo "INIT:P2 extract ARTIFACT A → tokens/design_tokens.json first"

# P3 — Token/dashboard palette parity (tokens must mirror active_variables.master_palette)
python3 - <<'PY'
import json
t=json.load(open('tokens/design_tokens.json'))["color"]
d=json.load(open('dashboard.json'))["active_variables"]["master_palette"]
core=[t["bg"]["base"],t["accent"]["amber"],t["accent"]["cyan"],t["accent"]["alert"],t["ink"]["base"]]
print("OK:P3" if [c.upper() for c in core]==[c.upper() for c in d] else "FAIL:P3 token/palette drift")
PY

# P4 — Lint target exists for edits (never mutate a file you haven't read this task)
if [ -z "${TARGET_FILE:-}" ] || [ -f "${TARGET_FILE}" ]; then
  echo "OK:P4"
else
  echo "FAIL:P4 target missing: $TARGET_FILE"
fi
```

State verification (agent-level):
- **V1:** New pages/components must be checked against `control_room.html` — the reference implementation. Same tokens, same grid discipline.
- **V2:** Copy in UI follows `brand_voice` context: sentence case, plain verbs, controls named for what they do.

---

## 2. EXECUTION PROCESS (Part 3 of 4)

1. **UNPACK** — Extract ARTIFACT A → `tokens/design_tokens.json` and ARTIFACT B → `tokens/tokens.css` (skip if byte-identical). These two files are generated from the same dictionary; B is the CSS projection of A.
2. **READ TARGET** — If editing, read the full target file. Enumerate every existing class that maps to tokens; note any legacy hard-coded values as debt (report, don't silently rewrite).
3. **PLAN** — List the components to build and, per component, the exact tokens each will consume. A component whose plan contains a non-token value stops here (see anti-hallucination law).
4. **BUILD** — Write markup + CSS referencing ONLY `var(--…)` custom properties from ARTIFACT B. Grid layouts use `--grid-*` tokens. Status colors come from `semantic.*` — never re-derive meaning ("amber-ish for warning") from raw hex.
5. **⟪ CONTEXT FLUSH №1 ⟫** — After each component: log component name + tokens consumed to dashboard; drop its construction reasoning.
6. **AUDIT** — Run the token audit:
   ```bash
   grep -nE '#[0-9a-fA-F]{3,8}\b' build/*.css build/*.html | grep -v "tokens.css" && echo "FAIL: raw hex found" || echo "OK: no raw hex"
   grep -nE 'font-family:(?!.*var\().' -P build/*.css && echo "FAIL: un-tokened font" || echo "OK: fonts tokened"
   ```
7. **RESPONSIVE + A11Y PASS** — Verify at `--bp-*` breakpoints; visible `:focus-visible` (token `focus.ring`); `prefers-reduced-motion` respected for anything using `motion.*` tokens.
8. **⟪ CONTEXT FLUSH №2 ⟫** — Writeback file paths + audit results; retain only the token-consumption summary.

---

## 3. EMBEDDED ARTIFACTS (Part 4 of 4)

### ARTIFACT A — Design Token Dictionary (ABSOLUTE SOURCE OF TRUTH → `tokens/design_tokens.json`)
```json
{
  "$schema": "studio-os/design-tokens/v1",
  "mutation_policy": "operator-approval only; agent proposes, never commits token changes",

  "color": {
    "bg":     { "base": "#0B0E17", "raise": "#121627", "panel": "#161B30" },
    "line":   { "base": "#232A45" },
    "ink":    { "base": "#C9CEDB", "dim": "#6E7690" },
    "accent": { "amber": "#F2A33C", "cyan": "#3EE0CF", "alert": "#E84D6F", "queued": "#4A5273" }
  },

  "semantic": {
    "status.nominal":  { "color": "{color.accent.cyan}",   "meaning": "active / healthy / complete" },
    "status.waiting":  { "color": "{color.accent.amber}",  "meaning": "awaiting_render / review / warning" },
    "status.blocked":  { "color": "{color.accent.alert}",  "meaning": "blocked / error / violation" },
    "status.idle":     { "color": "{color.accent.queued}", "meaning": "queued / idle / disabled" }
  },

  "font": {
    "display": { "stack": "'Chakra Petch', sans-serif", "use": "headings, phase names, numerals" },
    "mono":    { "stack": "'IBM Plex Mono', monospace", "use": "body, data, labels, logs" }
  },

  "type_scale": {
    "xs": "10px", "sm": "11px", "base": "13px", "md": "14px", "lg": "20px",
    "tracking.label": "0.18em", "tracking.display": "0.14em"
  },

  "space": { "1": "4px", "2": "8px", "3": "14px", "4": "18px", "5": "22px" },
  "radius": { "panel": "6px", "chip": "4px", "bar": "3px", "pill": "999px" },

  "grid": {
    "columns": 12, "gap": "14px", "max_width": "1440px",
    "bp": { "tablet": "980px", "mobile": "640px" }
  },

  "elevation": {
    "glow.nominal": "0 0 10px {color.accent.cyan}",
    "glow.waiting": "0 0 10px {color.accent.amber}",
    "glow.blocked": "0 0 10px {color.accent.alert}"
  },

  "motion": {
    "bar_fill": "width .6s ease",
    "pulse": "2.4s ease-in-out infinite",
    "reduced_motion_rule": "all motion.* tokens null out under prefers-reduced-motion"
  },

  "focus": { "ring": "2px solid {color.accent.cyan}", "offset": "2px" }
}
```

### ARTIFACT B — CSS Projection (`tokens/tokens.css` — generated from A, imported by every page)
```css
/* studio-os tokens.css — GENERATED FROM design_tokens.json. Edit the JSON, never this file. */
:root {
  --bg: #0B0E17; --bg-raise: #121627; --bg-panel: #161B30;
  --line: #232A45; --ink: #C9CEDB; --ink-dim: #6E7690;
  --amber: #F2A33C; --cyan: #3EE0CF; --alert: #E84D6F; --queued: #4A5273;

  --font-disp: 'Chakra Petch', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
  --fs-xs: 10px; --fs-sm: 11px; --fs-base: 13px; --fs-md: 14px; --fs-lg: 20px;
  --track-label: 0.18em; --track-display: 0.14em;

  --sp-1: 4px; --sp-2: 8px; --sp-3: 14px; --sp-4: 18px; --sp-5: 22px;
  --r-panel: 6px; --r-chip: 4px; --r-bar: 3px; --r-pill: 999px;

  --grid-cols: 12; --grid-gap: 14px; --grid-max: 1440px;
  --bp-tablet: 980px; --bp-mobile: 640px;

  --glow-nominal: 0 0 10px var(--cyan);
  --glow-waiting: 0 0 10px var(--amber);
  --glow-blocked: 0 0 10px var(--alert);

  --m-bar-fill: width .6s ease;
  --focus-ring: 2px solid var(--cyan); --focus-offset: 2px;
}
@media (prefers-reduced-motion: reduce) { :root { --m-bar-fill: none; } }
:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }
```

### ARTIFACT C — DOM Mutation Contract (for router.js and any future JS)
```json
{
  "rules": [
    "JS never sets style.color/background with literals — it toggles token-backed classes (c-cyan, c-amber, c-alert, c-dim) or sets CSS custom properties defined in tokens.css",
    "Status → class mapping is EXACTLY the semantic.* table in ARTIFACT A; router.js statusColor() is its projection and must stay in sync",
    "New DOM regions must be grid areas, not absolutely-positioned patches",
    "Any innerHTML write passes through an escape function (see router.js esc()) — no exceptions"
  ]
}
```

— END OF SKILL —
