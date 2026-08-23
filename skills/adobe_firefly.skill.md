# adobe_firefly.skill.md — AI IMAGE GENERATION EXECUTABLE
### Studio Headless OS · Skill 3/8 · Four-Part Artifact Architecture


> [!WARNING] MIGRATION PENDING — state references in this file are stale
> This skill's prerequisite gates read `dashboard.json → active_variables.*`
> (e.g. `seed_lock`, `style_ref_id`, `master_palette`, `audio_bpm`). Per
> **DECISIONS.md § D6** that key no longer holds durable state — it is run-scoped
> and disposable. Project state now lives in the task's **Content MD**
> (`vault/SCHEMA.md`), read at intercept step 4 and written at step 8.
>
> Until this file is rewritten, treat every `dashboard.active_variables.X` gate
> below as **"the corresponding value in this task's Content MD
> `## Decisions in Force` or `## Method`"**, and every "ask the operator" as the
> mode gate in `Router.md` §5. Do not restore values to `active_variables` to
> satisfy a gate literally.

---

## 0. ROUTING HEADER (Part 1 of 4)

```yaml
skill_id: adobe_firefly
version: 1.0
trigger_a: ["generate image", "concept art", "style frame", "style ref", "firefly", "key art"]
trigger_b: [".png reference", ".jpg reference", "pipeline phase skill=adobe_firefly"]
mandatory_context: [visual_identity, color_science]
writes_dashboard_keys: [active_variables.style_ref_id, active_variables.style_ref_id_prev]
danger_class: EXTERNAL_API_SPEND
```

Firefly output metadata is the studio's style-continuity ledger. Every generation MUST be parsed with the ARTIFACT B regex set — eyeballing JSON responses and hand-copying IDs is a protocol violation (it is how style refs get lost).

---

## 1. PREREQUISITES & STATE VERIFICATION (Part 2 of 4)

```bash
# P1 — Attestation exists
grep -q "ROUTER INTERCEPT" ./.task_scratch/attestation.txt || echo "FAIL:P1"

# P2 — OAuth server-to-server credentials present
[ -n "$FIREFLY_CLIENT_ID" ] && [ -n "$FIREFLY_CLIENT_SECRET" ] && echo "OK:P2" || echo "FAIL:P2"

# P3 — Mint access token (expires ~24h; never cache across days)
TOKEN=$(curl -s -X POST "https://ims-na1.adobelogin.com/ims/token/v3" \
  -d "client_id=$FIREFLY_CLIENT_ID&client_secret=$FIREFLY_CLIENT_SECRET&grant_type=client_credentials&scope=openid,AdobeID,firefly_api" \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token',''))")
[ -n "$TOKEN" ] && echo "OK:P3" || echo "FAIL:P3 token mint failed"

# P4 — Style-ref ledger exists
python3 -c "import json;json.load(open('state/style_ledger.json'))" 2>/dev/null && echo "OK:P4" \
  || { echo '{"refs":[]}' > state/style_ledger.json && echo "OK:P4 (initialized)"; }
```

State verification (agent-level):
- **V1:** `dashboard.active_variables.style_ref_id` must exist in `state/style_ledger.json → refs[]`. If not → the dashboard is claiming a ref this skill never minted → HALT.
- **V2:** Palette lock: extract the request's color intent and confirm it maps into `dashboard.active_variables.master_palette` per `color_science` context. Off-palette requests need operator override.

---

## 2. EXECUTION PROCESS (Part 3 of 4)

1. **UNPACK** — Load ARTIFACT A (payload structures) and ARTIFACT B (regex set) into working memory.
2. **PAYLOAD BUILD** — Instantiate ARTIFACT A `generate_images`. Compose `prompt` from `visual_identity` vocabulary; set `style.imageReference` to the current `style_ref_id` upload handle when continuity is required; set `seeds` explicitly for reproducibility.
3. **SUBMIT** — `POST https://firefly-api.adobe.io/v3/images/generate` with headers from ARTIFACT A. Capture raw response body to `./.task_scratch/ff_resp_{ts}.json` BEFORE any parsing.
4. **PARSE (surgical)** — Run every ARTIFACT B regex against the saved raw body. Required captures: `image_url`, `seed`, `content_class`. Optional: `style_ref_upload_id`. A required-capture miss = malformed response → retry once, then `blocked`.
5. **DOWNLOAD** — Fetch each presigned `image_url` immediately (they expire); save to `renders/stills/{shot_or_frame_id}_{seed}.png`.
6. **⟪ CONTEXT FLUSH №1 ⟫** — Write parsed fields to `state/style_ledger.json` and dashboard. Delete raw response from working memory (file remains on disk for audit).
7. **STYLE-REF MINT** (only when the operator marks an output "canon") — `POST /v2/storage/image` with the chosen PNG; parse the returned upload id with `RX_UPLOAD_ID`; mint a ledger entry `sref_ff_{yyyymmdd}_{4hex}`; supersede dashboard: current → `style_ref_id_prev`, new → `style_ref_id`.
8. **VALIDATE** — Open the image(s). Check against `visual_identity` constraints and V2 palette lock. Log pass/fail per image in the ledger entry.
9. **⟪ CONTEXT FLUSH №2 ⟫** — Working memory reduced to: ledger entry summary + file paths. Writeback dashboard; end or chain.

---

## 3. EMBEDDED ARTIFACTS (Part 4 of 4)

### ARTIFACT A — Payload Structures
```json
{
  "auth_headers": {
    "Authorization": "Bearer {ACCESS_TOKEN}",
    "x-api-key": "{FIREFLY_CLIENT_ID}",
    "Content-Type": "application/json"
  },
  "generate_images": {
    "endpoint": "POST https://firefly-api.adobe.io/v3/images/generate",
    "body": {
      "prompt": "{{visual_identity_composed_prompt}}",
      "negativePrompt": "text, watermark, logo, oversaturation",
      "numVariations": 2,
      "seeds": [448811, 448812],
      "size": { "width": 2688, "height": 1152 },
      "contentClass": "photo",
      "visualIntensity": 6,
      "style": {
        "presets": ["{{optional_named_preset}}"],
        "strength": 60,
        "imageReference": { "source": { "uploadId": "{{style_ref_upload_id}}" } }
      },
      "structure": {
        "strength": 40,
        "imageReference": { "source": { "uploadId": "{{optional_composition_ref}}" } }
      }
    }
  },
  "upload_reference": {
    "endpoint": "POST https://firefly-api.adobe.io/v2/storage/image",
    "headers_override": { "Content-Type": "image/png" },
    "body": "<raw PNG bytes>",
    "returns": "images[0].id → feed to style.imageReference.source.uploadId"
  },
  "expand_image": {
    "endpoint": "POST https://firefly-api.adobe.io/v3/images/expand",
    "body": { "image": { "source": { "uploadId": "{{id}}" } }, "size": { "width": 3840, "height": 1646 }, "prompt": "{{edge_continuation_prompt}}" }
  }
}
```

### ARTIFACT B — Surgical Regex Set (run against RAW response text, Python `re`)

`"mode"` says which `re` call to use: `findall` for every match (Python has no `g` flag —
`re.findall`/`re.finditer` *is* the global form), `search` for the single expected match.
```json
{
  "RX_IMAGE_URL": {
    "pattern": "\"url\"\\s*:\\s*\"(https://[^\"]+?)\"",
    "mode": "findall",
    "capture": 1,
    "purpose": "presigned output image URLs — download immediately, they expire"
  },
  "RX_SEED": {
    "pattern": "\"seed\"\\s*:\\s*(\\d{1,10})",
    "mode": "findall",
    "capture": 1,
    "purpose": "actual seed used per variation — REQUIRED for reproducibility ledger"
  },
  "RX_UPLOAD_ID": {
    "pattern": "\"images\"\\s*:\\s*\\[\\s*\\{\\s*\"id\"\\s*:\\s*\"([0-9a-fA-F-]{36})\"",
    "mode": "search",
    "capture": 1,
    "purpose": "storage upload UUID returned by /v2/storage/image"
  },
  "RX_CONTENT_CLASS": {
    "pattern": "\"contentClass\"\\s*:\\s*\"(photo|art)\"",
    "mode": "search",
    "capture": 1,
    "purpose": "verify the API honored the requested content class"
  },
  "RX_STYLE_REF_LEDGER_ID": {
    "pattern": "\\bsref_ff_(\\d{8})_([0-9a-f]{4})\\b",
    "mode": "findall",
    "capture": 0,
    "purpose": "validate/locate studio-minted style ref ids in any text (dashboard, filenames, notes)"
  },
  "RX_ERROR_CODE": {
    "pattern": "\"error_code\"\\s*:\\s*\"([a-z_]+)\"",
    "mode": "search",
    "capture": 1,
    "purpose": "classify failures: rate_limited → backoff 30s; validation → fix payload, do not retry blind"
  },
  "parse_law": "Regexes run on the SAVED raw body file, never on a mentally-reconstructed response. A required capture returning zero matches is a hard failure, not a shrug."
}
```

### ARTIFACT C — Style Ledger Entry Schema (`state/style_ledger.json`)
```json
{
  "refs": [
    {
      "id": "sref_ff_20260630_114a",
      "upload_id": "8c3f2b6e-0000-0000-0000-000000000000",
      "source_png": "renders/stills/anchor_448811.png",
      "seed": 448811,
      "minted_ts": "2026-06-30T11:04:00Z",
      "canon": true,
      "palette_check": "pass",
      "supersedes": "sref_ff_20260628_09c1"
    }
  ]
}
```

— END OF SKILL —
