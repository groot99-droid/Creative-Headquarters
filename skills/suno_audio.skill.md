# suno_audio.skill.md — AI MUSIC GENERATION EXECUTABLE
### Studio Headless OS · Skill 2/8 · Four-Part Artifact Architecture


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
skill_id: suno_audio
version: 1.0
trigger_a: ["music", "track", "score", "stem", "theme", "drop", "verse", "soundtrack"]
trigger_b: [".wav", ".mp3", ".stem", "pipeline phase skill=suno_audio"]
mandatory_context: [sound_identity, brand_voice]
host_kinds: [windows, wsl, linux]   # network/API skill — no host-native bridge
writes_dashboard_keys: [active_variables.audio_bpm, active_variables.audio_key]
danger_class: EXTERNAL_API_SPEND
```

Structural prompting is not optional decoration. Suno's output quality is a direct function of bracket-tag architecture. Free-prose prompts are a protocol violation — always build from ARTIFACT B fixtures.

---

## 1. PREREQUISITES & STATE VERIFICATION (Part 2 of 4)

```bash
# P1 — Attestation exists (Router intercept ran)
grep -q "ROUTER INTERCEPT" ./.task_scratch/attestation.txt || echo "FAIL:P1"

# P2 — Credentials
[ -n "${SUNO_API_KEY:-}" ] && echo "OK:P2" || echo "FAIL:P2 missing SUNO_API_KEY"

# P3 — Quota check before spend
SUNO_BASE_URL="${SUNO_BASE_URL:-https://studio-api.suno.ai}"
curl -s --max-time 8 -H "Authorization: Bearer ${SUNO_API_KEY:-}" "$SUNO_BASE_URL/api/get_limit" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('credits_left',0) >= 10 else 1)" \
  && echo "OK:P3" || echo "FAIL:P3 insufficient credits"

# P4 — Output directory + no orphan pending jobs
mkdir -p renders/audio || echo "FAIL:P4 cannot create renders/audio"
[ ! -f state/suno_pending.lock ] && echo "OK:P4" || echo "FAIL:P4 pending job lock exists"
```

State verification (agent-level):
- **V1:** `dashboard.active_variables.audio_bpm` and `audio_key` are the musical continuity locks. If a score already exists for this project, new cues MUST match key/BPM or be an approved modulation (operator sign-off).
- **V2:** Confirm the target pipeline phase is `queued` or `in_progress` — never generate over a phase marked `review`.

---

## 2. EXECUTION PROCESS (Part 3 of 4)

1. **UNPACK** — Load ARTIFACT A (payload templates) and ARTIFACT B (fixtures library).
2. **STYLE RESOLVE** — From `sound_identity` context, select ONE fixture family (e.g., `grunge_92`, `electronic_festival`). Never blend fixture families in a single generation.
3. **STRUCTURE BUILD** — Copy the fixture's bracket skeleton verbatim. Replace only lyric/texture lines. The tag sequence (`[Intro]…[Outro]`) is mathematically fixed per fixture — do not add, remove, or reorder tags.
4. **PAYLOAD BUILD** — Instantiate ARTIFACT A `custom_generate`. `tags` field = fixture's `style_tags` string verbatim + BPM/key from dashboard. `title` = `{project}_{cue_id}`.
5. **DRY VALIDATE** — Print payload. Check: `prompt` ≤ 3000 chars, `tags` ≤ 200 chars, `make_instrumental` matches cue spec, no key/BPM conflict with V1.
6. **SUBMIT** — `POST {SUNO_BASE_URL}/api/custom_generate`. Write `state/suno_pending.lock` containing the returned `ids`.
7. **⟪ CONTEXT FLUSH №1 ⟫** — Persist job ids + fixture id to dashboard `event_log`. Discard lyric drafts and rejected variants from working memory.
8. **POLL** — `GET /api/get?ids={ids}` every 15s until `status: "complete"` (max 40 polls). Two clips return per job — download both to `renders/audio/`.
9. **A/B SELECT** — Evaluate both clips against the fixture's `pass_criteria`. Select one, rename `{cue_id}_master.mp3`, archive the other as `_alt`.
10. **STATE WRITE** — Update dashboard: `audio_bpm`, `audio_key` (if first cue), phase progress, event log. Delete `suno_pending.lock`.
11. **⟪ CONTEXT FLUSH №2 ⟫** — Reduce working memory to: cue id, file path, key/BPM. Chain to next cue at step 2 or end task.

---

## 3. EMBEDDED ARTIFACTS (Part 4 of 4)

### ARTIFACT A — API Request Payloads (exact wire format)
```json
{
  "custom_generate": {
    "endpoint": "POST {SUNO_BASE_URL}/api/custom_generate",
    "headers": { "Authorization": "Bearer {SUNO_API_KEY}", "Content-Type": "application/json" },
    "body": {
      "prompt": "{{bracket_structured_lyrics_or_[Instrumental]_tags}}",
      "tags": "{{fixture.style_tags}}, {{bpm}} bpm, {{key}}",
      "title": "{{project}}_{{cue_id}}",
      "make_instrumental": false,
      "model": "chirp-v4",
      "wait_audio": false
    }
  },
  "poll_status": {
    "endpoint": "GET {SUNO_BASE_URL}/api/get?ids={{id1}},{{id2}}",
    "terminal_states": ["complete", "error"],
    "response_fields_of_interest": ["id", "status", "audio_url", "metadata.duration", "metadata.tags"]
  },
  "extend_clip": {
    "endpoint": "POST {SUNO_BASE_URL}/api/extend_audio",
    "body": { "audio_id": "{{clip_id}}", "prompt": "{{continuation_brackets}}", "continue_at": "{{seconds}}", "tags": "{{same_tags_verbatim}}" },
    "rule": "tags MUST be byte-identical to the source clip or the join will drift"
  }
}
```

### ARTIFACT B — Fixtures: Mathematically Perfect Structural Prompting
```json
{
  "fixture_families": {
    "grunge_92": {
      "style_tags": "grunge, 90s alternative rock, raw distorted guitars, live drum room, male vocal grit, lo-fi warmth",
      "default_bpm": 112,
      "default_key": "E minor",
      "bracket_skeleton": [
        "[Intro: feedback swell, 4 bars]",
        "[Verse 1]", "{{4 lines, 8-10 syllables, hard consonant endings}}",
        "[Pre-Chorus: half-time drums]", "{{2 lines, rising tension}}",
        "[Chorus]", "{{4 lines, hook repeats line 1 and 4}}",
        "[Verse 2]", "{{4 lines, mirror Verse 1 meter exactly}}",
        "[Chorus]",
        "[Bridge: bass and vocal only, 4 bars]", "{{2 lines, quietest moment}}",
        "[Final Chorus: double-tracked vocals]",
        "[Outro: guitars decay to feedback]"
      ],
      "pass_criteria": ["distortion present bar 1", "dynamic drop at bridge ≥ 6dB", "no synthetic sheen"]
    },
    "electronic_festival": {
      "style_tags": "electronic, big room house, festival energy, sidechained supersaw, punchy 909 kick, female vocal chop",
      "default_bpm": 128,
      "default_key": "F minor",
      "bracket_skeleton": [
        "[Intro: filtered kick, 8 bars]",
        "[Build: rising white noise, snare roll accelerando]",
        "[Drop]", "{{hook phrase, ≤6 words, chopped}}",
        "[Breakdown: pads only, vocal enters]", "{{2 emotive lines}}",
        "[Build: 8 bars, pitch riser]",
        "[Drop: variation, add lead layer]",
        "[Outro: elements exit every 4 bars]"
      ],
      "pass_criteria": ["drop lands within ±1 bar of build end", "sidechain audible", "hook intelligible"]
    },
    "score_ambient": {
      "style_tags": "cinematic ambient score, analog synth pads, tape saturation, slow evolving, no drums, F minor drone",
      "default_bpm": 70,
      "default_key": "F minor",
      "bracket_skeleton": [
        "[Instrumental]",
        "[Intro: single sustained low drone]",
        "[Movement 1: pad layers enter one per 8 bars]",
        "[Swell: harmonic peak, brightest chord]",
        "[Movement 2: subtract layers, sub-bass remains]",
        "[Outro: drone decays to silence over 8 bars]"
      ],
      "pass_criteria": ["no percussive transients", "sits under dialogue at -18 LUFS", "matches project key F minor"]
    }
  },
  "structural_laws": [
    "One fixture family per generation — blending families produces genre mud",
    "Bracket tags are load-bearing: Suno's arranger reads them as a state sequence",
    "Meter symmetry: Verse 2 must scan identically to Verse 1 (syllable-count match ±1)",
    "The tags field is timbre; the bracket skeleton is structure — never encode structure in tags"
  ]
}
```

— END OF SKILL —
