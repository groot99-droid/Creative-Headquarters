# adobe_suite_uxp.skill.md — ADOBE AUTOMATION EXECUTABLE (UXP / ExtendScript)
### Studio Headless OS · Skill 4/8 · Four-Part Artifact Architecture

---

## 0. ROUTING HEADER (Part 1 of 4)

```yaml
skill_id: adobe_suite_uxp
version: 1.0
trigger_a: ["photoshop", "premiere", "after effects", "comp", "batch edit", "export layers", "grade"]
trigger_b: [".psd", ".psb", ".aep", ".prproj", ".jsx", "pipeline phase status: compositing"]
mandatory_context: [render_philosophy, color_science]
writes_dashboard_keys: [pipeline.phases[*].progress_pct]
danger_class: LOCAL_DESTRUCTIVE   # scripts mutate real project files — originals are sacred
```

**Self-extraction protocol (binding):** the `.jsx` artifacts in §3 are never pasted into a chat, never run from memory. The agent: (1) writes the artifact byte-for-byte to `/tmp/studio_uxp_{task_id}.jsx`, (2) injects `{{params}}`, (3) executes via the MCP bash bridge with `osascript`, (4) captures the script's JSON result line, (5) **deletes the temp file** in a `finally` step even on failure. Orphaned .jsx in /tmp = protocol violation.

---

## 1. PREREQUISITES & STATE VERIFICATION (Part 2 of 4)

```bash
# P1 — Attestation exists
grep -q "ROUTER INTERCEPT" ./.task_scratch/attestation.txt || echo "FAIL:P1"

# P2 — Target app installed and its process state known
osascript -e 'tell application "System Events" to (name of processes) contains "Adobe Photoshop 2026"' \
  | grep -q true && echo "OK:P2 PS running" || echo "WARN:P2 PS not running (will launch)"

# P3 — Source assets exist and are NOT open unsaved elsewhere
[ -d "./project/psd" ] && ls ./project/psd/*.psd >/dev/null 2>&1 && echo "OK:P3" || echo "FAIL:P3 no source PSDs"

# P4 — Write a canary temp file to confirm /tmp execution rights, then remove it
echo 'alert' > /tmp/studio_uxp_canary.jsx && rm /tmp/studio_uxp_canary.jsx && echo "OK:P4" || echo "FAIL:P4"

# P5 — Backup gate: never mutate without a same-day snapshot
[ -d "./backups/$(date +%Y%m%d)" ] && echo "OK:P5" || echo "FAIL:P5 run backup first"
```

State verification (agent-level):
- **V1:** Pipeline phase for this task must be `compositing` or `in_progress`. Phase `review` = read-only; export scripts allowed, mutation scripts forbidden.
- **V2:** Color pipeline: confirm the export color profile in the chosen artifact matches `color_science` context (studio default: export sRGB IEC61966-2.1 for web, leave working files in original profile).

---

## 2. EXECUTION PROCESS (Part 3 of 4)

1. **UNPACK** — Select the ONE §3 artifact matching the task (A: layer batch export · B: batch grade + export · C: Premiere marker/relink shim). Do not chain-run multiple artifacts without a flush between them.
2. **PARAMETERIZE** — Replace every `{{param}}` token. Zero tokens may remain: `grep -c '{{' /tmp/…jsx` must return 0 before execution.
3. **EXTRACT** — Write the parameterized script:
   ```bash
   cat > /tmp/studio_uxp_{{task_id}}.jsx <<'JSX_EOF'
   {{artifact body verbatim}}
   JSX_EOF
   ```
4. **EXECUTE via MCP bash bridge** —
   ```bash
   osascript -e 'tell application id "com.adobe.Photoshop" to do javascript file "/tmp/studio_uxp_{{task_id}}.jsx"'
   ```
   (After Effects: `tell application id "com.adobe.AfterEffects" to DoScriptFile "..."` · Premiere: run via its ExtendScript bridge/CEP panel endpoint.)
5. **CAPTURE** — The script's last line is a single JSON result object (`{"ok":…}`). Parse it. `ok:false` → do not retry blind; read `err`, fix params, re-extract.
6. **⟪ CONTEXT FLUSH №1 ⟫** — Log result JSON to dashboard event_log; update phase `progress_pct`. Drop script body from working memory.
7. **CLEANUP (finally-guaranteed)** —
   ```bash
   rm -f /tmp/studio_uxp_{{task_id}}.jsx && echo "temp jsx removed"
   ```
   Verify: `ls /tmp/studio_uxp_*.jsx 2>/dev/null | wc -l` → 0.
8. **VERIFY OUTPUT** — Count/inspect exported files against the result JSON's `count`. Mismatch → phase `blocked`.
9. **⟪ CONTEXT FLUSH №2 ⟫** — Writeback; retain only output paths + result summary.

---

## 3. EMBEDDED ARTIFACTS (Part 4 of 4)

### ARTIFACT A — Photoshop: Batch Layer → PNG Exporter (`.jsx`, self-extracting)
```javascript
// studio_uxp :: layer_export :: ExtendScript (Photoshop)
// PARAMS: {{SRC_PSD}} {{OUT_DIR}} {{SCALE_PCT}}
#target photoshop
app.displayDialogs = DialogModes.NO;
(function () {
  var result = { ok: false, count: 0, err: "" };
  try {
    var doc = app.open(new File("{{SRC_PSD}}"));
    var out = new Folder("{{OUT_DIR}}"); if (!out.exists) out.create();
    if ({{SCALE_PCT}} !== 100) doc.resizeImage(UnitValue(doc.width.as("px") * {{SCALE_PCT}} / 100, "px"), null, null, ResampleMethod.BICUBICSHARPER);
    for (var i = 0; i < doc.layers.length; i++) {
      for (var j = 0; j < doc.layers.length; j++) doc.layers[j].visible = (j === i);
      var opts = new ExportOptionsSaveForWeb();
      opts.format = SaveDocumentType.PNG; opts.PNG8 = false; opts.transparency = true;
      var safe = doc.layers[i].name.replace(/[^\w\-]/g, "_");
      doc.exportDocument(new File(out + "/" + safe + ".png"), ExportType.SAVEFORWEB, opts);
      result.count++;
    }
    doc.close(SaveOptions.DONOTSAVECHANGES); // source is never mutated
    result.ok = true;
  } catch (e) { result.err = String(e); }
  var log = new File("{{OUT_DIR}}/_result.json"); log.open("w"); log.write(result.toSource()); log.close();
  result.toSource(); // last expression = captured result line
})();
```

### ARTIFACT B — Photoshop: Batch Grade + Export (curves preset + sRGB convert)
```javascript
// studio_uxp :: batch_grade :: ExtendScript (Photoshop)
// PARAMS: {{SRC_DIR}} {{OUT_DIR}} {{BLACK_IN}} {{WHITE_IN}} {{GAMMA}} {{JPG_QUALITY}}
#target photoshop
app.displayDialogs = DialogModes.NO;
(function () {
  var result = { ok: false, count: 0, err: "" };
  try {
    var files = new Folder("{{SRC_DIR}}").getFiles(/\.(png|tif|tiff|psd|jpg)$/i);
    var out = new Folder("{{OUT_DIR}}"); if (!out.exists) out.create();
    for (var i = 0; i < files.length; i++) {
      var doc = app.open(files[i]);
      doc.activeLayer.adjustLevels({{BLACK_IN}}, {{WHITE_IN}}, {{GAMMA}}, 0, 255); // studio curve — values from color_science context ONLY
      doc.convertProfile("sRGB IEC61966-2.1", Intent.RELATIVECOLORIMETRIC, true, true);
      doc.flatten();
      var save = new JPEGSaveOptions(); save.quality = {{JPG_QUALITY}}; save.embedColorProfile = true;
      doc.saveAs(new File(out + "/" + files[i].displayName.replace(/\.[^.]+$/, "") + "_graded.jpg"), save, true);
      doc.close(SaveOptions.DONOTSAVECHANGES);
      result.count++;
    }
    result.ok = true;
  } catch (e) { result.err = String(e); }
  var log = new File("{{OUT_DIR}}/_result.json"); log.open("w"); log.write(result.toSource()); log.close();
  result.toSource();
})();
```

### ARTIFACT C — Premiere Pro: Shot-Ledger Markers + Offline Relink Report
```javascript
// studio_uxp :: pproj_markers :: ExtendScript (Premiere via bridge)
// PARAMS: {{MARKER_JSON_PATH}} {{REPORT_PATH}}
// MARKER_JSON format: [{"seconds": 12.5, "name": "sht_04", "comment": "hf_a91x seed 448811"}]
(function () {
  var result = { ok: false, markers: 0, offline: [], err: "" };
  try {
    var seq = app.project.activeSequence; if (!seq) throw "no active sequence";
    var f = new File("{{MARKER_JSON_PATH}}"); f.open("r"); var data = eval("(" + f.read() + ")"); f.close();
    for (var i = 0; i < data.length; i++) {
      var m = seq.markers.createMarker(data[i].seconds);
      m.name = data[i].name; m.comments = data[i].comment;
      result.markers++;
    }
    for (var p = 0; p < app.project.rootItem.children.numItems; p++) {
      var it = app.project.rootItem.children[p];
      if (it.isOffline && it.isOffline()) result.offline.push(it.name);
    }
    result.ok = true;
  } catch (e) { result.err = String(e); }
  var log = new File("{{REPORT_PATH}}"); log.open("w"); log.write(result.toSource()); log.close();
  result.toSource();
})();
```

### ARTIFACT D — Extraction/Cleanup Wrapper (bash, the ONLY sanctioned runner)
```bash
#!/bin/bash
# usage: run_jsx.sh <artifact_body_file> <app_bundle_id> <task_id>
set -euo pipefail
TMP="/tmp/studio_uxp_${3}.jsx"
trap 'rm -f "$TMP"; echo "[cleanup] $TMP removed"' EXIT   # deletion guaranteed, even on failure
cp "$1" "$TMP"
if grep -q '{{' "$TMP"; then echo '{"ok":false,"err":"unresolved params"}'; exit 1; fi
osascript -e "tell application id \"$2\" to do javascript file \"$TMP\""
```

— END OF SKILL —
