# blender_python.skill.md — 3D EXECUTION VIA bpy (HEADLESS)
### Studio Headless OS · Skill 5/8 · Four-Part Artifact Architecture

---

## 0. ROUTING HEADER (Part 1 of 4)

```yaml
skill_id: blender_python
version: 1.0
trigger_a: ["3D", "blender", "camera path", "low-poly", "procedural", "insert shot", "previz"]
trigger_b: [".blend", ".fbx", ".obj", ".glb", "pipeline phase skill=blender_python"]
mandatory_context: [render_philosophy, motion_language]
writes_dashboard_keys: [pipeline.phases[*].progress_pct]
danger_class: LOCAL_COMPUTE_HEAVY   # rendering — hardware_compute gate REQUIRED first
depends_on_skill: hardware_compute.skill.md   # must PASS before any render step
```

The §3 `bpy` templates are **localized tools**: extract to `./tools/bpy/`, parameterize, run headless (`blender -b -P`). Never improvise bpy calls line-by-line in an interactive session — the templates encode the studio's camera grammar and render settings; ad-hoc code drifts from both.

---

## 1. PREREQUISITES & STATE VERIFICATION (Part 2 of 4)

```bash
# P1 — Attestation exists
grep -q "ROUTER INTERCEPT" ./.task_scratch/attestation.txt || echo "FAIL:P1"

# P2 — Blender binary + version floor
BLENDER=${BLENDER_BIN:-/Applications/Blender.app/Contents/MacOS/Blender}
"$BLENDER" --version | head -1 | grep -qE "Blender (4|5)\." && echo "OK:P2" || echo "FAIL:P2 need Blender 4+"

# P3 — Headless python sanity (bpy importable, GPU backend visible)
"$BLENDER" -b --python-expr "import bpy;prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.get_devices();print('DEV:',[d.name for d in prefs.devices])" 2>/dev/null | grep -q "DEV:" \
  && echo "OK:P3" || echo "FAIL:P3 cycles devices not enumerable"

# P4 — HARDWARE GATE: hardware_compute must have written a fresh, unconsumed PASS
#      token FOR THIS WORKLOAD. ARTIFACT C's law is "one token, one workload" —
#      checking only verdict+age would let a batch_2d token authorize a 3D render.
python3 - <<'PY'
import json, time
try:
    t = json.load(open("state/compute_gate.json"))
    age = time.time() - t["ts_epoch"]
    ttl = t.get("ttl_seconds", 1800)          # honor the token's own TTL, don't hard-code
    reasons = []
    if t.get("verdict") != "PASS":            reasons.append("verdict=%s" % t.get("verdict"))
    if age >= ttl:                            reasons.append("stale (%ds > %ds TTL)" % (age, ttl))
    if t.get("workload") != "render_3d":      reasons.append("wrong workload=%s" % t.get("workload"))
    if t.get("consumed_by") is not None:      reasons.append("already consumed by %s" % t["consumed_by"])
except Exception as e:
    reasons = ["unreadable token: %s" % e]
print("OK:P4" if not reasons else "FAIL:P4 " + "; ".join(reasons))
PY

# P5 — Output + tools dirs
mkdir -p renders/3d tools/bpy && echo "OK:P5"
```

State verification (agent-level):
- **V1:** `fps` and `aspect_ratio` in every template MUST equal `dashboard.active_variables` (24 fps, 21:9 → e.g. 2688×1152). A render at the wrong cadence is wasted compute — verify before, not after.
- **V2:** Camera moves must map to a named preset in `motion_language` context; the bpy path template mirrors the Higgsfield motion library so 3D inserts and AI shots share one grammar.

---

## 2. EXECUTION PROCESS (Part 3 of 4)

1. **UNPACK** — Write ARTIFACT A → `tools/bpy/camera_path.py` and ARTIFACT B → `tools/bpy/lowpoly_gen.py` verbatim (skip if byte-identical files already exist).
2. **CLAIM THE GATE** — Immediately before the first render call, write `"consumed_by": "blender_python"` into `state/compute_gate.json`. The token is now spent; a second job needs a fresh probe (ARTIFACT C: one token, one workload).
3. **PARAMETERIZE** — Templates read params from a JSON sidecar (`tools/bpy/params.json`, schema in ARTIFACT C). Write the sidecar; never edit the .py bodies per-task.
4. **DRY RUN** — Execute with `"render": false` in params: builds the scene, prints frame count + camera checksum, renders nothing. Inspect the printed manifest.
5. **⟪ CONTEXT FLUSH №1 ⟫** — Log manifest to dashboard event_log; drop scene-construction reasoning from working memory.
6. **RENDER** — Re-run with `"render": true`:
   ```bash
   "$BLENDER" -b -P tools/bpy/camera_path.py -- tools/bpy/params.json
   ```
   Monitor stdout for `Fra:` progress lines; update `progress_pct` every 10%.
7. **VERIFY** — Frame count on disk == manifest count; spot-open first/middle/last frames against `render_philosophy` (no default grey world, no un-set film exposure).
8. **⟪ CONTEXT FLUSH №2 ⟫** — Writeback paths + manifest summary; delete params.json only if the operator marks the shot final (params are the reproducibility record — prefer archiving to deleting).

---

## 3. EMBEDDED ARTIFACTS (Part 4 of 4)

### ARTIFACT A — `camera_path.py` (rigid bezier camera pathing, headless)
```python
# studio_os :: bpy tool :: rigid camera pathing v1
# run: blender -b -P camera_path.py -- params.json
import bpy, json, sys, math

argv = sys.argv[sys.argv.index("--") + 1:]
P = json.load(open(argv[0]))

# ── scene reset (deterministic: never inherit a stale default scene) ──
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
scn.render.fps = P["fps"]
scn.render.resolution_x, scn.render.resolution_y = P["resolution"]
scn.frame_start, scn.frame_end = 1, P["frames"]
scn.render.engine = P.get("engine", "CYCLES")
scn.cycles.samples = P.get("samples", 128)
scn.cycles.device = "GPU"
scn.render.image_settings.file_format = "PNG"
scn.render.filepath = P["out_dir"] + "/" + P["shot_id"] + "_"

# ── load subject asset ──
if P.get("import_glb"):
    bpy.ops.import_scene.gltf(filepath=P["import_glb"])

# ── bezier path from control points (RIGID: points come from params, not improvisation) ──
curve = bpy.data.curves.new("cam_path", type="CURVE"); curve.dimensions = "3D"
sp = curve.splines.new("BEZIER"); sp.bezier_points.add(len(P["path_points"]) - 1)
for bp, (x, y, z) in zip(sp.bezier_points, P["path_points"]):
    bp.co = (x, y, z); bp.handle_left_type = bp.handle_right_type = "AUTO"
path_obj = bpy.data.objects.new("cam_path", curve); scn.collection.objects.link(path_obj)
path_obj.data.path_duration = P["frames"]

# ── camera + constraints (follow path, track target) ──
cam = bpy.data.cameras.new("cam"); cam.lens = P.get("lens_mm", 35)
cam_obj = bpy.data.objects.new("cam", cam); scn.collection.objects.link(cam_obj)
scn.camera = cam_obj
follow = cam_obj.constraints.new("FOLLOW_PATH"); follow.target = path_obj; follow.use_fixed_location = False
bpy.ops.object.select_all(action="DESELECT")
target = bpy.data.objects.new("cam_target", None); scn.collection.objects.link(target)
target.location = tuple(P["look_at"])
track = cam_obj.constraints.new("TRACK_TO"); track.target = target
track.track_axis, track.up_axis = "TRACK_NEGATIVE_Z", "UP_Y"

# animate path offset with studio easing (sine in-out ≈ 'dolly_in_slow' grammar)
follow.offset = 0; follow.keyframe_insert("offset", frame=1)
follow.offset = -P["frames"]; follow.keyframe_insert("offset", frame=P["frames"])
for fc in cam_obj.animation_data.action.fcurves:
    for kp in fc.keyframe_points: kp.interpolation = "SINE"; kp.easing = "EASE_IN_OUT"

# ── three-point light rig (values from render_philosophy defaults) ──
for name, loc, energy in [("key", (4, -4, 5), 1000), ("fill", (-5, -2, 3), 300), ("rim", (0, 6, 4), 600)]:
    l = bpy.data.lights.new(name, "AREA"); l.energy = energy
    lo = bpy.data.objects.new(name, l); scn.collection.objects.link(lo); lo.location = loc

manifest = {"shot_id": P["shot_id"], "frames": P["frames"], "res": P["resolution"],
            "cam_checksum": round(sum(sum(p) for p in P["path_points"]), 4)}
print("MANIFEST::" + json.dumps(manifest))

if P.get("render", False):
    bpy.ops.render.render(animation=True)
    print("RENDER_DONE::" + P["shot_id"])
```

### ARTIFACT B — `lowpoly_gen.py` (low-poly procedural terrain + scatter)
```python
# studio_os :: bpy tool :: low-poly procedural generation v1
# run: blender -b -P lowpoly_gen.py -- params.json
import bpy, json, sys, random

argv = sys.argv[sys.argv.index("--") + 1:]
P = json.load(open(argv[0]))
random.seed(P["seed"])          # dashboard seed_lock → deterministic geometry

bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene

# terrain: subdivided grid + displace + decimate-to-facets
bpy.ops.mesh.primitive_grid_add(x_subdivisions=P["grid"], y_subdivisions=P["grid"], size=P["size"])
terr = bpy.context.active_object; terr.name = "terrain"
tex = bpy.data.textures.new("noise", "CLOUDS"); tex.noise_scale = P.get("noise_scale", 2.5)
disp = terr.modifiers.new("disp", "DISPLACE"); disp.texture = tex; disp.strength = P.get("relief", 1.6)
dec = terr.modifiers.new("dec", "DECIMATE"); dec.ratio = P.get("facet_ratio", 0.12)
for m in list(terr.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
bpy.ops.object.shade_flat()     # LOW-POLY LAW: flat shading, always

# flat-color material from dashboard master_palette
mat = bpy.data.materials.new("terr_mat"); mat.use_nodes = True
mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = P["base_color_rgba"]
mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
terr.data.materials.append(mat)

# deterministic prop scatter (icosphere 'rocks')
for i in range(P.get("scatter_count", 40)):
    x, y = (random.uniform(-P["size"]/2, P["size"]/2) for _ in range(2))
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=random.uniform(0.1, 0.5), location=(x, y, 0.3))
    bpy.context.active_object.data.materials.append(mat)
    bpy.ops.object.shade_flat()

bpy.ops.wm.save_as_mainfile(filepath=P["out_blend"])
print("MANIFEST::" + json.dumps({"seed": P["seed"], "polys": sum(len(o.data.polygons) for o in scn.objects if o.type=='MESH'), "blend": P["out_blend"]}))
```

### ARTIFACT C — Params Sidecar Schema (`tools/bpy/params.json`)
```json
{
  "shot_id": "sht_3d_01",
  "fps": 24,
  "resolution": [2688, 1152],
  "frames": 120,
  "engine": "CYCLES",
  "samples": 128,
  "lens_mm": 35,
  "path_points": [[8, -8, 3], [5, -5, 2.5], [2.5, -2.5, 2]],
  "look_at": [0, 0, 1],
  "import_glb": null,
  "out_dir": "renders/3d/sht_3d_01",
  "render": false,

  "seed": 448811,
  "grid": 64, "size": 20, "relief": 1.6, "facet_ratio": 0.12,
  "base_color_rgba": [0.043, 0.055, 0.09, 1.0],
  "scatter_count": 40,
  "out_blend": "project/blend/lowpoly_env_v1.blend"
}
```

— END OF SKILL —
