# ROUND-2 LOG — area (a) 3D refinement on the map (MapView.tsx only)

Agent: area (a) · Date: 2026-11-11 · Branch: `feature/round-2` (local only, never pushed)
File changed: `client/src/MapView.tsx` only (no new files; no other file touched).

## 1. Wider streets — DONE
- **Choice: widen roads at the source, NOT scale the canvas.** Scaling the
  canvas 20–30% would have moved every place and broken `landAt()`,
  metro lines, camera framing and `frameOf()`. Instead:
  `const roads = ROADS[cityKey].map(r => ({...r, w: r.w * 1.35}))`
  (ROAD_W = 1.35, e.g. 深南大道 2.8 → 3.8). Every downstream use reads `r.w`
  (road mesh, viaduct, sidewalk offsets, zebra stop lines, lamps,
  `nearRoad` clearance, shop offsets, pedestrian pavements), so the whole
  street cross-section breathes out together; all place positions,
  `landAt()`, coast and camera framing are untouched.
- Sidewalk strip widened 0.95 → 1.15 (both the land-split and fallback branches).
- Fewer labels at once: overview `locCap` normal 12 → 9, few 6 → 5;
  zoomed normal 24 → 18, few 10 → 8; kind caps place 5 → 4, station 4 → 3,
  road 3 → 2 (normal density). The 精简/标准/全部 toggle and user
  preference are unchanged.

## 2. Water shader — DONE
- Sea: `PlaneGeometry(168,104, 96, 64)` (geometry baked flat so shader
  local +Y is world up) + custom `ShaderMaterial`: vertex waves (3 summed
  sines, analytic normal), fragment scrolling procedural-noise ripples,
  Fresnel sky tint, sun glint, depth-based deep/shallow colour, shoreline
  foam (coast line reproduced in-shader from per-city `coastZ`
  coefficients), night darkening. Uniforms `uTime/uDayF/uNightF/uSunDir`
  updated once per frame from the existing day cycle.
- Inland water (TERRAIN WATER polygons): same shader, foam off
  (`lakeWaterMat`); rivers stay on `waterMat` (thin ribbons — a vertex
  shader buys nothing there). `coastZ()` / `landAt()` untouched.
- Note: the old `waterMat` colour/roughness animation in the frame loop
  now only affects rivers (and the empty LAKES discs) — the sea/lakes are
  driven by shader uniforms. The old `water.position.y` bob is kept.
- Gotcha fixed during implementation: the foam band compares against the
  world-space coast, so the varying is world position
  (`modelMatrix * vec4(p,1)`), not local — the sea mesh sits at z = +4.

## 3. Vehicles — DONE (within the existing loadModel cache / spawn logic)
- `loadModel` cache and `fittedClone` merge untouched (deliberately: the
  merged GLB uses the first mesh's material, so mutating it would also
  affect the shared cached model / player taxi — left as a known limit,
  see below).
- Headlights: instanced warm emissive boxes at each car's front
  (emissiveIntensity 0.25 day → 2.45 night). Tail lights: instanced boxes
  with per-instance colour — bright red while braking
  (`want < cur*0.85` or `want < speed*0.25`), dim otherwise. Both driven
  by the same per-frame car matrix (local +X is always forward).
- Wheels: real cylinder wheels (4/car) under the box stand-ins only;
  hidden with `carMesh` when the Kenney GLBs arrive (GLBs have wheels).
- Smoother motion: braking ease 1.7 → 2.2, pull-away 0.45 → 0.6
  (`trafficAdvance`), plus a small speed-scaled suspension bob.
- `Car` gained a `want` field (set in `trafficAdvance`) so the brake
  lights read the same value the traffic logic computed.

## 4. Map ambient life — DONE (instanced, no per-frame allocations)
- Birds: 14 (8 lite) — instanced body + 2 flapping wings each; each bird
  circles a random centre at 7.5–12 height with its own radius/speed/flap.
- Butterflies: 10 (6 lite) — instanced body + 2 wings, coloured per
  instance, fluttering erratically around up to 3 fun/scenic locations
  (parks have no `LocType "park"` — fun/scenic locs are the anchors).
- Fish: sea 24 (14 lite) schooling in circles just off the coast
  (y ≈ −0.12, visible through the shader water's 0.82 alpha); lakes 12
  max (6 lite), up to 4 per TERRAIN WATER polygon at its centroid
  (koi/carp gold). Rivers get no fish (too thin).
- Trees sway: vertex-shader bend on the instanced foliage material
  (`onBeforeCompile`, `uTime` uniform, tip moves most, trunk fixed) —
  zero per-frame matrix work for 430 trees. Mountain-slope trees are
  individual meshes with per-tree materials — not swayed (left as-is).
- All ambient meshes are `frustumCulled = false` (they roam the map) and
  use preallocated scratch matrices (`ambM1/2/3`, `ambQ/E/V/S`).

## 5. Map characters — DONE (sprites kept, interior untouched)
- Emoji badges: one consistent size — NPCs 1.45 (was the 1.3 default that
  drowned at city zoom), self 2.1 (unchanged). Stored on
  `view.userData.badge` + `badgeBaseY` for every actor (was self-only).
- Badge bobs with the walk cycle (`sin(phase) * 0.07 * blend`) in the
  actor frame loop. Interior characters in LifeStage.tsx untouched.

## Typecheck
- `cd ~/workspace/shenhui-life-sim/standalone && npx tsc --noEmit -p tsconfig.json`
- First run: 3 errors in MapView.tsx (mine) + errors in other agents'
  `client/src/round2/` files (delivery.ts, house.ts, lifestyles.ts — NOT
  mine, not touched). My 3 fixed: `LocType` has no `"park"` (filter now
  fun/scenic only); `const badge` redeclared in the frame loop (renamed
  mine to `actorBadge` — the existing self-badge pulse block at ~3291
  keeps the name).
- Re-run after fixes (single clean run to /tmp/tsc-a.txt): exit 2, **4 errors
  total, 0 in MapView.tsx**. All 4 are in files owned by others, not
  touched here: `LifeStage.tsx(87,3)` duplicate property (area g) and
  `round2/house.ts(204)` ×3 duplicate props (another agent). The earlier
  delivery.ts/lifestyles.ts errors from the first run were fixed by their
  owners in the meantime. Baseline was 0 errors, so the integration agent
  will need those 4 fixed elsewhere — none are mine.

## Integration notes (for other files — I did NOT edit them)
- None required. Everything is self-contained in MapView.tsx; no App.tsx
  snippet, no data.ts change, no new module needed.
- Known limits / follow-ups (not blockers):
  1. Traffic GLBs are merged with a single material (the first mesh's);
     Kenney multi-material/colormap detail is flattened. Fixing it means
     merging with groups + a material array in the `carTypes` builder —
     doable but touches the shared `loadModel` cache path, so left for a
     follow-up, not done silently here.
  2. Lake fish sit just under the lake surface (y = LAND+0.06); they read
     best zoomed in. Sea fish are clearer (shader alpha 0.82).
  3. `waterMat` opacity was 0.94 → 0.90 (rivers only now); harmless.
- Browser verification still needed (integration agent): wider streets at
  city + street-cam zoom, water shader day/dusk/night, headlights at
  night + brake lights at a red light, birds/fish/butterflies visible,
  tree sway, NPC badges at city zoom. Lite mode counts are lower by design.
