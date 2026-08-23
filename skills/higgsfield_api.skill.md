# higgsfield_api.skill.md — AI VIDEO GENERATION EXECUTABLE
### Studio Headless OS · Skill 1/8 · Four-Part Artifact Architecture


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
skill_id: higgsfield_api
version: 1.0
trigger_a: ["generate video", "motion", "animate shot", "camera move", "shot gen", "img2vid"]
trigger_b: [".mp4", ".mov", "pipeline phase status: awaiting_render on skill=higgsfield_api"]
mandatory_context: [motion_language, narrative_continuity, visual_identity]
writes_dashboard_keys: [active_variables.character_uuid, active_variables.environment_uuid,
                        active_variables.seed_lock, active_variables.motion_vector_preset]
danger_class: EXTERNAL_API_SPEND   # every call costs credits — no speculative submissions
```

This file is a **self-extracting executable**. Do not summarize it. Unpack §3 artifacts, follow §2 in order, and mutate ARTIFACT C (the Continuity State-Machine) as the single source of truth for character/environment persistence.

---

## 1. PREREQUISITES & STATE VERIFICATION (Part 2 of 4)

Run every check. Any failure → set pipeline phase to `blocked`, log to `event_log`, HALT.

```bash
# P1 — Router intercept completed? (Attestation Block must already exist this task)
grep -q "ROUTER INTERCEPT" ./.task_scratch/attestation.txt || echo "FAIL:P1 no attestation"

# P2 — Credentials present (never echo the key itself)
[ -n "${HIGGSFIELD_API_KEY:-}" ] && echo "OK:P2" || echo "FAIL:P2 missing HIGGSFIELD_API_KEY"

# P3 — Endpoint reachable. HIGGSFIELD_BASE_URL is optional; this default is the
#      same origin router.js registers for the "higgsfield" service.
HIGGSFIELD_BASE_URL="${HIGGSFIELD_BASE_URL:-https://platform.higgsfield.ai}"
curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$HIGGSFIELD_BASE_URL/health" | grep -qE "200|401" \
  && echo "OK:P3" || echo "FAIL:P3 endpoint unreachable"

# P4 — Continuity State-Machine exists and parses (create from ARTIFACT C on first run)
python3 -c "import json;json.load(open('state/continuity_sm.json'))" && echo "OK:P4" || echo "FAIL:P4"

# P5 — Compute gate: this skill is API-bound, but frame extraction for i2v needs disk headroom
# df -g is BSD-only; -Pk is POSIX everywhere and -P stops long device names
# from wrapping onto a second line (which silently shifted the NR==2 fields).
df -Pk . | awk 'NR==2 {exit (int($4/1048576) < 20)}' && echo "OK:P5 disk" || echo "FAIL:P5 <20GB free"
```

State verification (agent-level, not shell):
- **V1:** `dashboard.json → active_variables.character_uuid` MUST equal `continuity_sm.json → entities.character.uuid`. Mismatch = continuity fault → HALT, ask operator which is canonical.
- **V2:** If task is a continuation shot (`shot_index > 1` in the state machine), a `last_frame_ref` MUST exist. No last frame = you may not claim continuity; route back to operator.

---

## 2. EXECUTION PROCESS (Part 3 of 4)

1. **UNPACK** — Read ARTIFACT A (payload template), ARTIFACT B (UUID protocol), ARTIFACT C (state machine) into working memory.
2. **STATE READ** — Load `state/continuity_sm.json`. Extract: `entities.*.uuid`, `entities.*.anchor_prompt`, `seed_lock`, `shot_ledger[last]`.
3. **PAYLOAD BUILD** — Instantiate ARTIFACT A. Rules:
   - `prompt` = `anchor_prompt(character)` + `anchor_prompt(environment)` + shot-specific action (from context: motion_language vocabulary ONLY — no invented camera terms).
   - `seed` = `seed_lock` from the state machine. Never randomize on continuation shots.
   - `motion.vector` = one preset from ARTIFACT A's `motion_vector_library`. Custom vectors require operator sign-off.
   - Reference media: pass `last_frame_ref` as `start_image` when `continuity_mode: "chain"`.
4. **DRY VALIDATE** — Print the full payload. Check: no null UUIDs, aspect ratio matches `dashboard.active_variables.aspect_ratio`, duration ≤ policy max. Only then submit.
5. **SUBMIT** — `POST {HIGGSFIELD_BASE_URL}/v1/image2video` (or `/v1/text2video`) with ARTIFACT A payload. Capture `job_id`.
6. **⟪ CONTEXT FLUSH №1 ⟫** — Write `job_id`, payload hash, and seed to `dashboard.json`. Discard the raw payload from working memory. Retain only: job_id, state-machine handle, attestation constraints.
7. **POLL** — `GET /v1/jobs/{job_id}` every 20s, max 30 polls. Terminal states: `completed | failed | nsfw_blocked`.
8. **VALIDATE OUTPUT** — Download result. Verify duration/fps/aspect against request. Extract final frame → save as `state/frames/{shot_id}_last.png`.
9. **STATE WRITE** — Mutate ARTIFACT C on disk: append to `shot_ledger`, update `last_frame_ref`, increment `shot_index`, set `drift_check.due = true` every 3rd shot.
10. **DRIFT CHECK** (every 3rd shot) — Compare shot N frame vs shot 1 anchor frame (visual inspection or embedding distance if available). Drift detected → do NOT regenerate autonomously; flag `continuity_drift` in dashboard and request operator review.
11. **⟪ CONTEXT FLUSH №2 ⟫** — Writeback complete dashboard state. Working memory reduced to: updated state-machine summary (≤10 lines). Task ends or chains to next shot at step 2.

---

## 3. EMBEDDED ARTIFACTS (Part 4 of 4)

### ARTIFACT A — Generation Payload Template + Motion Vector Library
```json
{
  "payload_template": {
    "model": "{{model_id}}",
    "prompt": "{{character_anchor}} :: {{environment_anchor}} :: {{shot_action}}",
    "negative_prompt": "text, watermark, extra limbs, morphing, style drift",
    "seed": "{{seed_lock}}",
    "duration_s": 5,
    "fps": 24,
    "aspect_ratio": "{{dashboard.active_variables.aspect_ratio}}",
    "medias": [
      { "role": "start_image", "value": "{{last_frame_ref | media_uuid}}" },
      { "role": "character_reference", "value": "{{character_ref_media_uuid}}" }
    ],
    "motion": {
      "vector": "{{motion_vector_preset}}",
      "strength": 0.65
    },
    "webhook": null,
    "metadata": { "shot_id": "{{shot_id}}", "project": "{{dashboard.pipeline.project}}" }
  },
  "motion_vector_library": {
    "dolly_in_slow_02":   { "vector": [0.0, 0.0, -0.4], "ease": "in_out_sine",  "use": "reveal, intimacy" },
    "dolly_out_slow_01":  { "vector": [0.0, 0.0,  0.4], "ease": "in_out_sine",  "use": "isolation, ending" },
    "truck_left_med_01":  { "vector": [-0.6, 0.0, 0.0], "ease": "linear",       "use": "parallax pass-by" },
    "pedestal_up_slow":   { "vector": [0.0, 0.5, 0.0],  "ease": "out_quad",     "use": "scale reveal" },
    "orbit_cw_15deg":     { "vector": "orbit:+15",      "ease": "in_out_cubic", "use": "hero moment" },
    "static_breathe":     { "vector": [0.0, 0.0, -0.05],"ease": "in_out_sine",  "use": "dialogue, tension hold" }
  }
}
```

### ARTIFACT B — UUID Handling Protocol
```json
{
  "uuid_rules": {
    "format": "prefix_[0-9a-f]{8}-slug",
    "prefixes": { "chr_": "character", "env_": "environment", "prp_": "prop", "sht_": "shot", "hf_": "remote job id" },
    "creation": "UUIDs are minted ONCE at entity birth by the operator or Router — this skill NEVER mints chr_/env_ UUIDs",
    "propagation": "every payload metadata block and every dashboard write must carry the active chr_/env_ UUIDs verbatim",
    "collision_policy": "on any UUID mismatch between dashboard and state machine → HALT (continuity fault)",
    "remote_mapping": "store {hf_job_id → sht_uuid} pairs in continuity_sm.json → job_map; never rely on memory"
  }
}
```

### ARTIFACT C — Continuity State-Machine (LIVE FILE: copy to `state/continuity_sm.json` on first run, then mutate on disk only)
```json
{
  "$schema": "studio-os/continuity-sm/v1",
  "machine_state": "READY",
  "states": ["READY", "GENERATING", "VALIDATING", "DRIFT_REVIEW", "BLOCKED"],
  "transitions": {
    "READY→GENERATING": "on payload submit (step 5)",
    "GENERATING→VALIDATING": "on job completed (step 8)",
    "VALIDATING→READY": "on state write success (step 9)",
    "VALIDATING→DRIFT_REVIEW": "on drift_check.due && drift detected",
    "ANY→BLOCKED": "on UUID mismatch, API 4xx, or 3 consecutive failed jobs"
  },
  "seed_lock": 448811,
  "continuity_mode": "chain",
  "entities": {
    "character": {
      "uuid": "chr_7f3a9d2e-aurora-lead",
      "anchor_prompt": "a woman in her 30s, silver utility jacket, short black hair with teal streak, calm intensity",
      "reference_media_uuid": null,
      "locked_attributes": ["hair", "jacket", "eye color"]
    },
    "environment": {
      "uuid": "env_c4b81f00-neon-harbor",
      "anchor_prompt": "rain-slick harbor promenade at night, amber sodium lamps against teal fog, 21:9",
      "locked_attributes": ["lighting palette", "weather", "era"]
    }
  },
  "shot_index": 0,
  "shot_ledger": [],
  "ledger_entry_schema": { "shot_id": "sht_*", "hf_job_id": "hf_*", "seed": 0, "motion_vector": "", "last_frame_ref": "", "ts": "ISO8601" },
  "last_frame_ref": null,
  "job_map": {},
  "drift_check": { "every_n_shots": 3, "due": false, "last_result": null }
}
```

— END OF SKILL —
