# ui_ux_intelligence.skill.md — DESIGN-SYSTEM GENERATION EXECUTABLE
### Studio Headless OS · Skill 9/9 · Four-Part Artifact Architecture

Searchable design intelligence over a local corpus: 79 searchable UI styles (50
active), 192 product palettes and reasoning profiles, 74 font pairings, 119 UX
guidelines, 105 curated icons, 17 GSAP presets, 25 chart types, and 22 technology
stacks. Runs offline from `tools/ui-ux-pro-max/`, Python 3 standard library only.

**This skill decides what a thing should look like. `css_html_ui` builds it.** The
two are upstream and downstream of each other — see §0.1.

---

## 0. ROUTING HEADER (Part 1 of 4)

```yaml
skill_id: ui_ux_intelligence
version: 1.0
trigger_a: ["design system", "palette", "colour scheme", "font pairing", "typography scale", "style direction", "UX review", "accessibility audit", "what should this look like", "spacing scale", "chart type", "icon set"]
trigger_b: ["design-system/*/MASTER.md", "tokens/design_tokens.json", "pipeline phase skill=ui_ux_intelligence"]
mandatory_context: [visual_identity, typography_system, color_science]
host_kinds: [windows, wsl, linux]   # stdlib Python 3, no network, no host bridge
writes_dashboard_keys: [pipeline.phases[*].progress_pct]
danger_class: LOW   # reads a local corpus; the risk is a wrong recommendation, not a wrong write
```

**Anti-fabrication law.** Every style, palette, font pairing, UX rule, chart type,
and stack recommendation this skill emits MUST come from a returned search result.
A search that returns `Found: 0 results` is not a licence to answer from general
knowledge. Retry once with a narrower query or an explicit `--domain`; if it is
still empty, say so and label any fallback as a built-in default, never as a
database match. Presenting an unsourced recommendation as a corpus result is a
protocol violation of the same class as `css_html_ui` inventing a token.

This mirrors Router.md §0 exactly: derived is allowed and labelled, invented is not
allowed at all.

### 0.1 Scope boundary — read before touching any token

This skill generates design systems for **two different consumers**, and confusing
them is the failure mode that costs the most to undo.

| | Studio surfaces | Product / client work |
|---|---|---|
| What | `control_room.html`, `hub/`, HQ's own tooling | Anything HQ makes for a project |
| Token authority | `css_html_ui` ARTIFACT A | This skill's persisted `MASTER.md` |
| Palette | fixed, ten values, machine-verified | selected per product category |
| Type | Chakra Petch / IBM Plex Mono, 10–20px | selected per product category |
| This skill's role | **upstream generator**, operator-approved only | **sole author** |

**On studio surfaces** this skill proposes and never commits. ARTIFACT A's
`mutation_policy` — `operator-approval only; agent proposes, never commits token
changes` — governs, and `check_palette_parity` enforces it. Regenerating the studio
palette is a decision the operator makes, not a query result.

**On product work** the studio palette and type system do not apply. Reaching for
Chakra Petch on a client project because it is "the studio font" is a category
error (`typography_system` §6).

---

## 1. PREREQUISITES & STATE VERIFICATION (Part 2 of 4)

```bash
# P1 — Attestation exists (Router.md §6, before any tool call)
grep -q "ROUTER INTERCEPT" ./.task_scratch/attestation.txt || echo "FAIL:P1"

# P2 — Python 3 present. The scripts are stdlib-only and make no network calls.
python3 --version >/dev/null 2>&1 && echo "OK:P2" \
  || { python --version >/dev/null 2>&1 && echo "OK:P2 (use 'python')" \
       || echo "FAIL:P2 Python 3 not on PATH"; }

# P3 — Vendored payload intact
python3 -c "import csv,sys; sys.exit(0 if sum(1 for _ in csv.DictReader(open('tools/ui-ux-pro-max/data/ux-guidelines.csv',encoding='utf-8')))==119 else 1)" \
  && echo "OK:P3" || echo "FAIL:P3 payload missing or truncated — see tools/ui-ux-pro-max/VENDOR.md"

# P4 — Engine answers a known query (the locked smoke test)
python3 tools/ui-ux-pro-max/scripts/search.py "keyboard focus modal" --domain ux -n 1 --json \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('OK:P4' if d.get('results') else 'FAIL:P4 engine returned nothing')"
```

**Never install Python.** If P2 fails, this skill does not run `winget`, `apt`,
`brew`, or any other package manager — that is a system modification outside this
skill's danger class. Report the gap to the operator per the Router.md §4 mode
gate, and fall back to the three brand gates, which are readable without Python.

State verification (agent-level):

- **V1 — Which consumer?** Establish studio-surface vs product work (§0.1) *before*
  the first search. The answer changes which token authority binds and whether any
  output may touch ARTIFACT A.
- **V2 — Stack detection, never assumption.** Detect from the project: `package.json`
  deps, `pubspec.yaml`, `*.xcodeproj`/`Package.swift`, `composer.json`, or React
  Native markers. If nothing is detectable and stack guidance matters, ask. A
  hardcoded default silently misroutes every recommendation.
- **V3 — Existing MASTER.md.** If `design-system/<slug>/MASTER.md` exists, read it
  before generating. `--force` overwrites prior decisions and requires explicit
  operator authorisation.

---

## 2. EXECUTION PROCESS (Part 3 of 4)

1. **CLASSIFY** — Studio surface or product work (§0.1, V1). Record the answer in
   the attestation's `KEY CONSTRAINTS EXTRACTED` line. Everything downstream
   branches on it.

2. **QUERY CONTRACT** — One dominant intent per search, 2–5 meaningful terms, one
   constraint (product, platform, or interaction). Verify the returned domain and
   top-result identity before applying anything. Retry **once** with a narrower
   rewrite or explicit `--domain`; do not cycle keywords.

   ```bash
   python3 tools/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain> [-n 1-20] [--full]
   ```

   Twelve domains: `product` `style` `color` `typography` `google-fonts` `landing`
   `chart` `ux` `icons` `gsap` `react` `web`. Domain is auto-detected when omitted,
   and auto-detection misroutes overlapping terms — pass `--domain` explicitly when
   results look off-topic.

3. **GENERATE (product work only)** — For a new product surface, one design-system
   call rather than a scatter of domain queries:

   ```bash
   python3 tools/ui-ux-pro-max/scripts/search.py "<product_type> <industry> <keywords>" \
     --design-system -p "Project Name" [--variance 1-10] [--motion 1-10] [--density 1-10]
   ```

   The three dials tune the same query: `--variance` centred→bold, `--motion`
   subtle→choreographed, `--density` spacious→dashboard. Unset dials change nothing.

4. **⟪ CONTEXT FLUSH №1 ⟫** — Write the resolved system (pattern, style, palette,
   typography, effects, anti-patterns) into the Content MD `## Method`. Discard the
   raw search payloads. Retain only the resolved values and the query that produced
   them — a Method that needs the original session to interpret has failed
   (`vault/SCHEMA.md`).

5. **PERSIST (product work only)** — Always pass `--output-dir` pointed at the
   project root; without it, files land wherever the tool happened to run.

   ```bash
   python3 tools/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist \
     -p "Project Name" --output-dir "<project-root>" [--page "dashboard"]
   ```

   Writes `design-system/<slug>/MASTER.md` plus per-page overrides. An existing
   MASTER.md is **skipped, not overwritten**, unless `--force` is explicitly
   authorised by the operator.

6. **PROPOSE (studio surfaces only)** — Never persist over ARTIFACT A. Emit the
   proposed change as a diff against the current token dictionary, state what it
   would break in `control_room.html`, and stop. The operator commits or does not.

7. **AUDIT** — Before handing anything to `css_html_ui`:

   ```bash
   python3 tools/ui-ux-pro-max/scripts/search.py "contrast ratio text legibility" --domain ux
   python3 tools/ui-ux-pro-max/scripts/search.py "<stack keyword>" --stack <stack>
   ```

   Check the output against `visual_identity` §6 (off-limits) and, for studio
   surfaces, against the `typography_system` §3 scale tension — the corpus 16px body
   minimum does **not** override the studio's 13px instrumentation scale.

8. **⟪ CONTEXT FLUSH №2 ⟫** — Writeback: `## Decisions in Force` gains every design
   decision now binding, `## Next Steps` is rewritten in full, `dashboard.json` gets
   one phase write and one `event_log` entry. Retain only the resolved token summary
   and the Content MD path.

---

## 3. EMBEDDED ARTIFACTS (Part 4 of 4)

### ARTIFACT A — Domain routing table

| Need | Domain | Example query |
|---|---|---|
| Product-type patterns | `product` | `"entertainment social" --domain product` |
| Style direction | `style` | `"glassmorphism dark" --domain style` |
| Colour palettes | `color` | `"fintech trust" --domain color` |
| Font pairings | `typography` | `"playful modern" --domain typography` |
| A specific Google font | `google-fonts` | `"Chakra Petch" --domain google-fonts` |
| Page structure, CTA | `landing` | `"hero social-proof" --domain landing` |
| Chart selection | `chart` | `"real-time dashboard" --domain chart` |
| UX rules, accessibility | `ux` | `"error summary validation" --domain ux` |
| Icon choice, a11y naming | `icons` | `"decorative icon aria hidden" --domain icons` |
| Motion presets | `gsap` | `"scroll reveal stagger" --domain gsap` |
| React/Next performance | `react` | `"rerender memo list" --domain react` |
| Native/app interface | `web` | `"accessibilityLabel safe-areas" --domain web` |

**Stacks:** `react` `nextjs` `vue` `svelte` `astro` `nuxtjs` `nuxt-ui` `angular`
`laravel` `swiftui` `react-native` `flutter` `html-tailwind` `shadcn` `threejs`
`javafx` `wpf` `winui` `avalonia` `uno` `uwp`

### ARTIFACT B — Design-system output contract

`--design-system --json` returns `design_system` with these keys. This is the
handoff shape `css_html_ui` consumes for product work.

```json
{
  "project_name": "string",
  "category": "matched product category — verify this before using anything below",
  "pattern": "layout/structure recommendation",
  "style": "resolved style identity",
  "colors": "palette for the matched category",
  "typography": "font pairing + scale",
  "key_effects": "effects and treatments in force",
  "anti_patterns": "what this category must avoid",
  "decision_rules": "reasoning rules that fired",
  "activated_rules": "which ui-reasoning.csv profiles applied",
  "constraints": "hard constraints",
  "source_identities": "corpus rows this resolved from",
  "source_derivations": "what was derived rather than matched",
  "severity": "confidence signal",
  "dials": "variance / motion / density as resolved",
  "motion_snippet": "GSAP snippet when --motion is set",
  "spacing_scale": "spacing tokens, overridden by --density"
}
```

`source_identities` and `source_derivations` are the provenance fields. Carry both
into the Content MD — they are what makes a later session able to tell a matched
constraint from a derived one, which is Router.md §0's whole requirement.

### ARTIFACT C — Zero-result contract

```
Found: 0 results
→ 1. Retry ONCE with a narrower query or an explicit --domain / --stack.
→ 2. Still empty: state that no database match was found, name the fallback as a
     built-in default, and proceed only if the mode gate (Router.md §4) allows.
→ 3. Never present a 0-result search as if it returned data.
```

The engine helps here: an empty search prints `No matches. This is not a match with
an empty value` plus closest known terms. Read that line — it distinguishes "the
corpus has nothing" from "the row exists but the field is blank."

### ARTIFACT D — Gate regeneration protocol (studio surfaces)

The three gates this skill is mandatory-context for — `visual_identity`,
`typography_system`, `color_science` — were transcribed from `css_html_ui`
ARTIFACT A, and this skill is their declared regeneration path (DECISIONS.md § D9).

Regeneration is a **four-step operator-approval loop**, never a single command:

```
1. GENERATE   --design-system against the studio brief, --json, no --persist
2. DIFF       against context/brand/*.context.md AND css_html_ui ARTIFACT A
3. IMPACT     name every control_room.html value that would move, and confirm
              whether check_palette_parity would still pass
4. PROPOSE    hand 1-3 to the operator; stop. Do not write any of the four files.
```

Writing `context/brand/*.context.md`, `skills/css_html_ui.skill.md`, or
`control_room.html` from a search result without completing step 4 is an intercept
violation. The gates are brand constants; a query result is evidence for changing
one, not the authority to.

— END OF SKILL —
