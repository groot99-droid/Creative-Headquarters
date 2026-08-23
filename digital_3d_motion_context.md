# digital_3d_motion_context.md

## 1. THE ROUTING GLOSSARY (AI Search Index)
*System Note: Maps user raw prompt keywords directly to downstream deep research nodes. Each macro category contains exactly 10 high-density semantic trigger blocks.*

### A. Category A: PBR Shading Math & Rendering Algorithms
*   **Target Section:** `Jump to ## 2.A`
*   **Subcategory Triggers:** `BRDF & Energy Conservation`, `Metallic-Roughness Workflow`, `Specular-Glossiness Workflow`, `Fresnel & Grazing Reflectance`, `Microfacet Distribution`, `Albedo & Base Color`, `Normal & Bump Mapping`, `Ray Tracing vs Rasterization`, `Path Tracing & Monte Carlo`, `Subsurface Scattering`

### B. Category B: Topology Optimization & Polygonal Flow
*   **Target Section:** `Jump to ## 2.B`
*   **Subcategory Triggers:** `Edge Loop Flow`, `Quad vs Triangle vs Ngon`, `Poles & Singularities`, `Deformation-Ready Topology`, `Subdivision Surface Prep`, `Retopology Workflow`, `Poly Density Distribution`, `UV-Aware Topology`, `Hard-Surface Support Loops`, `Manifold & Watertight Geometry`

### C. Category C: Kinematic Systems, Rigging, & Deformations
*   **Target Section:** `Jump to ## 2.C`
*   **Subcategory Triggers:** `Skeletal Joint Hierarchy`, `Forward vs Inverse Kinematics`, `Skin Weighting & Falloff`, `Blend Shapes & Morphs`, `Control Rig & Constraints`, `Corrective & Driven Shapes`, `Deformer Stacks`, `Facial Rigging Systems`, `Spline & Ribbon Rigs`, `Muscle & Jiggle Systems`

### D. Category D: Dynamic Simulations & Particle Physics
*   **Target Section:** `Jump to ## 2.D`
*   **Subcategory Triggers:** `Rigid Body Dynamics`, `Soft Body & Cloth`, `Fluid & Smoke Solvers`, `Particle Systems`, `Force Fields & Emitters`, `Collision Detection`, `Hair & Fur Dynamics`, `Fracture & Destruction`, `Constraint Networks`, `Cache & Bake Simulation`

### E. Category E: Animation Curves, Interpolation, & Bezier Math
*   **Target Section:** `Jump to ## 2.E`
*   **Subcategory Triggers:** `Keyframe & Interpolation`, `Bezier & Tangent Handles`, `Ease In/Out & Spacing`, `Graph Editor & F-Curves`, `Twelve Principles`, `Timing & Spacing`, `Arcs & Trajectory`, `Overshoot & Follow-Through`, `Cycles & Loops`, `Motion Blur & Sampling`

### F. Category F: Camera Rigging & Virtual Cinematography
*   **Target Section:** `Jump to ## 2.F`
*   **Subcategory Triggers:** `Focal Length & FOV`, `Depth of Field & Aperture`, `Camera Constraints & Path`, `Virtual Camera & Mocap`, `Framing & Composition`, `Camera Shake & Handheld Sim`, `Multi-Cam & Cuts`, `Lens Distortion Emulation`, `Match-Move & Tracking`, `Aspect Ratio & Sensor`

### G. Category G: Lighting Environments & Global Illumination (GI)
*   **Target Section:** `Jump to ## 2.G`
*   **Subcategory Triggers:** `Direct vs Indirect Light`, `HDRI & Image-Based Lighting`, `Area & Portal Lights`, `Bounce & Color Bleeding`, `Ambient Occlusion Pass`, `Caustics`, `Light Linking & Exclusion`, `Volumetric & Atmospheric`, `Three-Point CG Setup`, `Physical Light Units`

### H. Category H: Hard-Surface vs. Organic Modeling Workflows
*   **Target Section:** `Jump to ## 2.H`
*   **Subcategory Triggers:** `Box vs Poly Modeling`, `Sculpting & Dynamesh`, `Boolean Operations`, `Bevel & Chamfer Logic`, `Curve & Surface (NURBS)`, `Procedural & Parametric`, `Kitbashing & Assembly`, `Detail Sculpt & Layers`, `Panel & Seam Design`, `Symmetry & Radial Modeling`

### I. Category I: Composite Pass Architecture & Motion Graphics Integration
*   **Target Section:** `Jump to ## 2.I`
*   **Subcategory Triggers:** `Render Pass & AOV`, `Node-Based Compositing`, `Cryptomatte & ID Mattes`, `Deep Compositing`, `Color Management (ACES)`, `2D-3D Integration`, `Motion Graphics Layering`, `Roto & Keying in Comp`, `Glow, Bloom, Lens FX`, `Multi-Pass Reassembly`

### J. Category J: Asset Optimization & Universal Real-Time Pipelines
*   **Target Section:** `Jump to ## 2.J`
*   **Subcategory Triggers:** `LOD & Decimation`, `Texture Atlasing & Baking`, `Draw Call Reduction`, `glTF/USD Interchange`, `Normal Map Baking`, `Instancing & Batching`, `Shader Optimization`, `Poly Budget Management`, `Real-Time GI (Lumen/Baked)`, `Cross-Platform Export`

---

## 2. DEEP RESEARCH (The Expert Knowledge Base)
*System Note: Elite, industry-standard ground truths in compressed technical shorthand (15-20 words/node).*

### 2.A PBR Shading Math & Rendering Algorithms
**Category Overview:** Physically-based rendering mathematics governing energy-conserving light-surface interaction, reflectance models, and rendering algorithms that produce photorealistic material and illumination accuracy.

*   **2.A.1 BRDF & Energy Conservation:** Bidirectional reflectance distribution function models light scatter; energy conservation ensures reflected light never exceeds incident, preventing physically-impossible brightening.
*   **2.A.2 Metallic-Roughness Workflow:** Base color, metallic, and roughness maps define surface; industry-standard PBR authoring balancing realism, efficiency, and cross-engine compatibility.
*   **2.A.3 Specular-Glossiness Workflow:** Alternative PBR using diffuse, specular, and glossiness maps; offers explicit specular control at cost of energy-conservation enforcement.
*   **2.A.4 Fresnel & Grazing Reflectance:** Reflectance increases at glancing angles per Fresnel equations; all surfaces become mirror-like at extreme grazing viewing angles.
*   **2.A.5 Microfacet Distribution:** Surface modeled as microscopic mirror facets; GGX/Beckmann distribution statistically describes roughness-driven highlight spread and specular shape.
*   **2.A.6 Albedo & Base Color:** Diffuse surface color without lighting or shadow baked in; albedo maps must exclude directional illumination for correct PBR response.
*   **2.A.7 Normal & Bump Mapping:** Tangent-space normal maps perturb surface normals faking geometric detail; bump/height maps offer alternative surface-detail illusion without polygons.
*   **2.A.8 Ray Tracing vs Rasterization:** Ray tracing simulates light-path physics for accurate reflection/shadow; rasterization projects geometry faster, approximating effects with screen-space techniques.
*   **2.A.9 Path Tracing & Monte Carlo:** Stochastic ray-sampling integrates global illumination; Monte Carlo convergence reduces noise with sample count, balancing quality against render time.
*   **2.A.10 Subsurface Scattering:** Light penetrating and diffusing within translucent materials (skin, wax, marble); SSS produces characteristic soft, glowing internal-light diffusion.

---

### 2.B Topology Optimization & Polygonal Flow
**Category Overview:** Mesh-construction principles governing edge flow, polygon distribution, and deformation-readiness that produce clean, efficient, animation-friendly, and subdivision-compatible geometry.

*   **2.B.1 Edge Loop Flow:** Continuous edge loops following form contours and deformation lines; proper flow ensures clean subdivision and predictable joint bending.
*   **2.B.2 Quad vs Triangle vs Ngon:** Quads preferred for subdivision and deformation; triangles acceptable for real-time; ngons (5+ sides) avoided in deforming areas.
*   **2.B.3 Poles & Singularities:** Vertices with 3 or 5+ edges (poles) disrupt loop flow; strategic pole placement in low-deformation, low-visibility regions.
*   **2.B.4 Deformation-Ready Topology:** Sufficient edge loops at joints (elbow, knee) enable clean bending; topology anticipates animation deformation requirements at articulation.
*   **2.B.5 Subdivision Surface Prep:** All-quad, evenly-distributed topology subdivides smoothly; support loops control edge sharpness; poles and ngons cause subdivision pinching artifacts.
*   **2.B.6 Retopology Workflow:** Rebuilding clean low-poly topology over dense sculpt; retopo produces animation-ready mesh preserving high-detail sculpt via normal-map baking.
*   **2.B.7 Poly Density Distribution:** Concentrating polygons where detail and deformation demand; efficient distribution avoids wasted geometry in flat, low-detail, static regions.
*   **2.B.8 UV-Aware Topology:** Topology designed anticipating clean UV seam placement; edge flow supports logical unwrapping and minimal texture distortion.
*   **2.B.9 Hard-Surface Support Loops:** Tight edge loops adjacent to hard edges control subdivision bevel sharpness; support-loop spacing determines mechanical edge crispness.
*   **2.B.10 Manifold & Watertight Geometry:** Closed, non-self-intersecting mesh without holes or non-manifold edges; watertight geometry required for printing, boolean, and simulation.

---

### 2.C Kinematic Systems, Rigging, & Deformations
**Category Overview:** Rigging architecture governing skeletal control, skin deformation, and articulation systems that transform static meshes into animatable, believably-deforming performance-ready characters.

*   **2.C.1 Skeletal Joint Hierarchy:** Parent-child bone chain drives mesh deformation; hierarchy establishes inheritance so parent rotation propagates through dependent child joints.
*   **2.C.2 Forward vs Inverse Kinematics:** FK rotates joints sequentially down chain; IK solves joint rotation from end-effector target position, easing limb-placement animation.
*   **2.C.3 Skin Weighting & Falloff:** Vertex-to-joint influence weights determine deformation; smooth weight falloff prevents candy-wrapper collapse and unnatural joint pinching.
*   **2.C.4 Blend Shapes & Morphs:** Interpolating between sculpted target shapes drives facial expression and corrective deformation; linear vertex blending between shape keys.
*   **2.C.5 Control Rig & Constraints:** Animator-facing control objects drive underlying skeleton via constraints; intuitive controls abstract complex joint hierarchy for efficient posing.
*   **2.C.6 Corrective & Driven Shapes:** Pose-space-driven blend shapes fix deformation errors at specific joint angles; correctives triggered by joint rotation preserve volume.
*   **2.C.7 Deformer Stacks:** Layered deformation operators (skin, lattice, wrap, bend) evaluated in order; stack sequence determines cumulative deformation result.
*   **2.C.8 Facial Rigging Systems:** FACS-based blend shapes or joint-based facial controls; expression driven by muscle-action units for nuanced performance.
*   **2.C.9 Spline & Ribbon Rigs:** Curve-driven flexible deformation for tails, spines, and tentacles; spline IK enables smooth continuous bending along control curve.
*   **2.C.10 Muscle & Jiggle Systems:** Simulated muscle bulge and secondary soft-tissue jiggle add organic realism; dynamic secondary motion responds to primary animation.

---

### 2.D Dynamic Simulations & Particle Physics
**Category Overview:** Physics-simulation systems governing rigid, soft, fluid, and particle behavior that produce believable natural motion, destruction, and volumetric phenomena procedurally.

*   **2.D.1 Rigid Body Dynamics:** Solid objects with mass, friction, and restitution respond to gravity and collision; rigid simulation drives realistic tumbling and stacking.
*   **2.D.2 Soft Body & Cloth:** Deformable-mesh simulation with stretch, bend, and self-collision; cloth solvers model draping, wrinkling, and fabric dynamic behavior.
*   **2.D.3 Fluid & Smoke Solvers:** Navier-Stokes-based volumetric simulation of liquid and gas; grid or particle solvers model flow, splash, smoke, and fire.
*   **2.D.4 Particle Systems:** Emitting numerous points driven by forces and behaviors; particles simulate sparks, dust, rain, crowds, and aggregate phenomena efficiently.
*   **2.D.5 Force Fields & Emitters:** Gravity, wind, turbulence, and vortex forces influence simulation; emitters spawn particles/objects with velocity and distribution parameters.
*   **2.D.6 Collision Detection:** Intersection testing prevents interpenetration; collision geometry, thickness, and substeps balance accuracy against computational cost in simulation.
*   **2.D.7 Hair & Fur Dynamics:** Guide-curve-driven strand simulation with stiffness, damping, and collision; hair responds to motion, wind, and gravity naturally.
*   **2.D.8 Fracture & Destruction:** Voronoi and pattern-based mesh shattering with constraint networks; destruction simulates breaking, crumbling, and structural collapse dynamically.
*   **2.D.9 Constraint Networks:** Connections linking simulated objects (glue, hinge, spring); breakable constraints enable structural integrity until stress threshold triggers collapse.
*   **2.D.10 Cache & Bake Simulation:** Pre-computing and storing simulation to disk; caching enables playback, iteration, and render without recalculating expensive dynamics.

---

### 2.E Animation Curves, Interpolation, & Bezier Math
**Category Overview:** Animation interpolation and timing systems governing keyframe transition, spacing, and motion principles that produce fluid, weighted, and appealing believable movement.

*   **2.E.1 Keyframe & Interpolation:** Defined pose values at specific frames; interpolation calculates in-between frames via linear, stepped, or spline curve methods.
*   **2.E.2 Bezier & Tangent Handles:** Cubic bezier curve tangents control interpolation velocity between keys; handle angle and length shape acceleration and easing precisely.
*   **2.E.3 Ease In/Out & Spacing:** Gradual acceleration/deceleration near keys mimics natural motion; spacing (frame-to-frame distance) controls perceived speed and weight.
*   **2.E.4 Graph Editor & F-Curves:** Function-curve visualization of animated value over time; editing curve shape directly controls motion timing, velocity, and smoothness.
*   **2.E.5 Twelve Principles of Animation:** Squash-stretch, anticipation, staging, follow-through, and appeal; foundational Disney principles governing believable, expressive character motion.
*   **2.E.6 Timing & Spacing:** Number of frames (timing) and their distribution (spacing) define motion speed and weight; core determinant of animation quality.
*   **2.E.7 Arcs & Trajectory:** Natural motion follows curved paths, not straight lines; maintaining smooth arcs produces organic, believable movement trajectory.
*   **2.E.8 Overshoot & Follow-Through:** Motion overshooting target then settling, and secondary parts lagging primary; adds weight, elasticity, and organic realism.
*   **2.E.9 Cycles & Loops:** Seamlessly repeating animation (walk, run, idle); matching start-end poses and velocity enables continuous loop without visible seam.
*   **2.E.10 Motion Blur & Sampling:** Directional blur from movement during shutter interval; sample count and shutter angle control blur quality and length.

---

### 2.F Camera Rigging & Virtual Cinematography
**Category Overview:** Virtual camera systems governing lens simulation, movement, and framing that translate cinematographic language into 3D scenes with photographic authenticity and intent.

*   **2.F.1 Focal Length & FOV:** Virtual lens millimeter sets field-of-view and perspective compression; wide distorts and expands, telephoto flattens and isolates.
*   **2.F.2 Depth of Field & Aperture:** F-stop controls focal plane and blur; shallow DOF isolates subject, deep DOF maintains sharpness across scene depth.
*   **2.F.3 Camera Constraints & Path:** Animating camera along spline path or constraining to target; path animation and aim constraints enable controlled cinematic movement.
*   **2.F.4 Virtual Camera & Mocap:** Real-time handheld virtual camera operation via tracked device; mocap camera brings organic human framing into virtual production.
*   **2.F.5 Framing & Composition:** Applying compositional principles (thirds, leading lines) in 3D viewport; virtual framing follows cinematographic and photographic convention.
*   **2.F.6 Camera Shake & Handheld Sim:** Procedural or keyframed subtle movement mimics handheld operation; controlled shake adds organic energy and documentary realism.
*   **2.F.7 Multi-Cam & Cuts:** Multiple virtual cameras enable coverage and editorial cutting; camera switching replicates live-action multi-angle shooting and edit workflow.
*   **2.F.8 Lens Distortion Emulation:** Simulating barrel/pincushion distortion and chromatic aberration; lens imperfection adds photographic authenticity to clean CG renders.
*   **2.F.9 Match-Move & Tracking:** Solving real camera motion from footage to composite CG; match-move aligns virtual camera to live-action plate perspective.
*   **2.F.10 Aspect Ratio & Sensor:** Virtual sensor size and aspect ratio determine framing and field-of-view; sensor settings match target delivery format specification.

---

### 2.G Lighting Environments & Global Illumination (GI)
**Category Overview:** Virtual lighting systems governing direct, indirect, and image-based illumination that produce physically-plausible, atmospheric, and cinematically-controlled light across 3D environments.

*   **2.G.1 Direct vs Indirect Light:** Direct light hits surfaces from source; indirect (GI) bounces between surfaces; combined illumination produces realistic light distribution.
*   **2.G.2 HDRI & Image-Based Lighting:** High-dynamic-range environment map lights scene realistically; HDRI provides accurate ambient illumination, reflection, and color from captured real environments.
*   **2.G.3 Area & Portal Lights:** Area lights produce soft realistic shadows scaling with size; portal lights guide GI sampling through openings, reducing interior noise.
*   **2.G.4 Bounce & Color Bleeding:** Indirect light carries surface color to adjacent surfaces; color bleeding (red wall tinting nearby white) signals realistic GI.
*   **2.G.5 Ambient Occlusion Pass:** Contact-shadow darkening in crevices and surface proximity; AO adds grounding, depth, and detail definition to GI-lit scenes.
*   **2.G.6 Caustics:** Focused light patterns from refraction/reflection through glass, water, metal; caustics add realism but demand high sample counts.
*   **2.G.7 Light Linking & Exclusion:** Selectively including/excluding objects from specific lights; light linking enables non-physical artistic control over illumination relationships.
*   **2.G.8 Volumetric & Atmospheric:** Participating media (fog, dust) scatter light, creating god-rays and haze; volumetric lighting adds atmosphere and depth.
*   **2.G.9 Three-Point CG Setup:** Key, fill, rim virtual light arrangement; classical cinematic lighting adapted to 3D for controlled dimensional subject modeling.
*   **2.G.10 Physical Light Units:** Real-world photometric units (lumens, lux, kelvin); physical light values ensure consistent, predictable exposure and color-temperature accuracy.

---

### 2.H Hard-Surface vs. Organic Modeling Workflows
**Category Overview:** Modeling methodology systems governing mechanical and organic form creation through distinct sculpting, poly-modeling, and procedural workflows suited to differing subject requirements.

*   **2.H.1 Box vs Poly Modeling:** Starting from primitive and extruding/refining (box) vs building face-by-face (poly); both construct precise mechanical hard-surface forms.
*   **2.H.2 Sculpting & Dynamesh:** Digital clay sculpting with dynamic remeshing maintaining even density; sculpting excels at organic form, detail, and intuitive shaping.
*   **2.H.3 Boolean Operations:** Union, subtract, intersect combining meshes; booleans rapidly create complex hard-surface forms but require cleanup for clean topology.
*   **2.H.4 Bevel & Chamfer Logic:** Rounding hard edges with controlled bevels; no real edge is perfectly sharp, beveling catches light for realism.
*   **2.H.5 Curve & Surface (NURBS):** Mathematically-defined smooth surfaces from control curves; NURBS excels at precise, smooth industrial and automotive surface modeling.
*   **2.H.6 Procedural & Parametric:** Node-based non-destructive modeling with adjustable parameters; procedural workflows enable rapid iteration and infinite variation generation.
*   **2.H.7 Kitbashing & Assembly:** Combining pre-made component parts into complex assemblies; kitbashing rapidly builds detailed mechanical and environmental structures efficiently.
*   **2.H.8 Detail Sculpt & Layers:** High-frequency surface detail (pores, wrinkles, scratches) on separate layers; layered sculpting enables non-destructive detail refinement.
*   **2.H.9 Panel & Seam Design:** Hard-surface paneling with gaps, seams, and greebles; panel-line logic conveys manufactured, mechanical, and functional surface believability.
*   **2.H.10 Symmetry & Radial Modeling:** Mirroring across axis or radial duplication accelerates symmetric modeling; symmetry maintained until asymmetric detail-pass breaks uniformity purposefully.

---

### 2.I Composite Pass Architecture & Motion Graphics Integration
**Category Overview:** Compositing and integration systems governing render-pass assembly, color management, and 2D-3D fusion that combine rendered elements into final polished imagery.

*   **2.I.1 Render Pass & AOV:** Arbitrary output variables separate render into diffuse, specular, shadow, depth layers; passes enable flexible post-render adjustment control.
*   **2.I.2 Node-Based Compositing:** Graph of connected operations processing image data; node compositing enables non-destructive, flexible, and complex layered image assembly.
*   **2.I.3 Cryptomatte & ID Mattes:** Automatic per-object/material ID masks; cryptomatte enables precise selection and isolation of scene elements in compositing.
*   **2.I.4 Deep Compositing:** Per-pixel depth samples enable accurate depth-based merging without holdout mattes; deep data resolves complex overlapping and volumetric integration.
*   **2.I.5 Color Management (ACES):** Academy Color Encoding System standardizes color pipeline; ACES ensures consistent color across capture, render, and display transformation.
*   **2.I.6 2D-3D Integration:** Combining rendered 3D with 2D footage or elements; matching perspective, lighting, and grain achieves seamless composite integration.
*   **2.I.7 Motion Graphics Layering:** Animated typography, shapes, and graphic elements layered with footage; motion design integrates informational and stylistic graphic content.
*   **2.I.8 Roto & Keying in Comp:** Rotoscope masking and chroma keying isolate elements; comp-stage extraction enables layering, replacement, and selective adjustment.
*   **2.I.9 Glow, Bloom, Lens FX:** Post effects (glow, bloom, flare, chromatic aberration) add photographic character; lens FX enhance realism and cinematic polish.
*   **2.I.10 Multi-Pass Reassembly:** Recombining separated render passes with adjusted weighting; reassembly reconstructs beauty render with granular per-component control flexibility.

---

### 2.J Asset Optimization & Universal Real-Time Pipelines
**Category Overview:** Optimization and interchange systems governing performance efficiency, format standardization, and real-time delivery that ensure assets run smoothly across platforms and engines.

*   **2.J.1 LOD & Decimation:** Level-of-detail variants reduce polygon count at distance; decimation and LOD switching optimize rendering performance without close-range quality loss.
*   **2.J.2 Texture Atlasing & Baking:** Combining multiple textures into single atlas reduces draw calls; baking transfers high-detail information into efficient texture maps.
*   **2.J.3 Draw Call Reduction:** Minimizing separate render commands via batching and atlasing; fewer draw calls dramatically improve real-time rendering frame rate.
*   **2.J.4 glTF/USD Interchange:** Open standard formats for cross-application asset transfer; glTF for real-time delivery, USD for pipeline scene interchange and collaboration.
*   **2.J.5 Normal Map Baking:** Transferring high-poly surface detail to low-poly normal map; baking preserves visual detail while drastically reducing geometry cost.
*   **2.J.6 Instancing & Batching:** Rendering many copies of geometry from single mesh data; instancing enables massive object counts with minimal memory and performance cost.
*   **2.J.7 Shader Optimization:** Reducing shader instruction complexity and texture lookups; optimized shaders maintain visual quality while meeting real-time performance budgets.
*   **2.J.8 Poly Budget Management:** Allocating polygon count across scene per performance target; budget discipline prioritizes geometry where visual impact justifies cost.
*   **2.J.9 Real-Time GI (Lumen/Baked):** Dynamic real-time global illumination vs pre-baked lightmaps; each balances lighting quality, flexibility, and runtime performance tradeoffs.
*   **2.J.10 Cross-Platform Export:** Adapting assets to platform constraints (mobile, console, web); export pipelines adjust resolution, format, and complexity per target hardware.

---

## 3. EXECUTION VARIABLES (The Hand-off Payload)
*System Note: Maps raw theoretical variables into structured key-value configurations passed to corresponding `.skill.md` scripts.*

*   `primary_domain_bias`: 0.0 (neutral default; steered per-prompt toward Shading/Topology/Rigging/Simulation/Lighting weighting based on detected user intent keywords)
*   `system_exclusion_tokens`: [non-manifold-geometry, ngon-in-deformation, energy-non-conserving-shader, candy-wrapper-skinning, linear-interpolation-default, unmotivated-camera-shake, GI-fireflies, over-budget-polycount, baked-lighting-in-albedo, self-intersecting-mesh]
*   `hardware_render_overrides`: [target_renderer: path-traced-or-realtime, target_color_space: ACES, target_poly_budget: platform-specific, target_texture_res: power-of-two, target_export_format: glTF/USD/FBX, target_frame_rate: 24-60fps]
