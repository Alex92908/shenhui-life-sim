# ROUND-7 — Desktop-only visual upgrade （桌面端视觉升级）

Date: 2026-11-11 · Branch: `feature/round-2` · NOT pushed (parent verifies + pushes)

lee: "帮我不设置限制去实现真实的湾区生活" / "我想电脑体验足够棒" —
go all-in on the desktop experience, no artificial limits on visual quality.
Phones are completely untouched: every effect below only runs when the
browser is a real desktop (`matchMedia("(pointer: fine)")`, not `phoneLike`,
not lite mode). On a phone the game looks and costs exactly what it did
before. The bright low-poly life-sim identity is kept — this is NOT a dark
cyberpunk restyle; the existing city just gets richer, glossier and warmer.

## What changed (2 files)

### NEW — `client/src/round2/desktopfx.ts` (~9.5 KB, no new dependency)
A small module that owns all the desktop-only effect state and the three
procedural canvas textures (baked once at startup, reused everywhere):

- `makeAsphaltTexture()` — 256×256 dark asphalt: patchy blotches, 5,200
  aggregate speckles, hairline cracks. `RepeatWrapping`, repeat (6,1).
- `makeConcreteTexture()` — 256×256 pale warm-grey concrete: speckles,
  stains, faint expansion-joint grid. Repeat (6,1).
- `makeNeonTexture()` — 128×64 black canvas with two bright horizontal tube
  bands (white core + shadowBlur glow) + a dim accent line; used as an
  emissiveMap so each sign glows in its own emissive colour instead of as a
  flat glowing box.
- `applyWetShader(mat, wet)` — `onBeforeCompile` injection on a
  MeshStandardMaterial. Vertex passes world XZ (`vWetXZ`); fragment adds a
  `uWet` uniform + a tiny `dfxHash`/`dfxNoise` value-noise GLSL pair. After
  `roughnessmap_fragment` it lowers roughness toward 0.12 inside noise
  puddle patches (puddle `smoothstep(0.58, 0.8)`, damp `smoothstep(0.3,
  0.62)`); after `color_fragment` it darkens (×(1 − uWet·0.5·0.38)) and
  cools the tint slightly. When `uWet` = 0 the injection is a no-op.
  `customProgramCacheKey = "desktopfx-wet-v1"` so the wet program is shared.
- `makeDesktopFx()` — the state object: `level` 0 off / 1 reduced / 2 full
  (starts at 2), shared `wet` uniform, the three textures, `noteFps(fps)`
  (fps < 32 → level−1; fps ≥ 57 twice in a row → level+1),
  `update({raining, storm, nightF, duskF, dt})` (wetness eases toward 1
  when raining, else 0, capped by level: 0→0, 1→0.6, 2→1; soaks fast
  0.55/s, dries slow 0.02/s so streets stay glossy for a while after the
  rain stops), `neonBoost()` (1 / 1.3 / 1.7), `windowBoost()` (1 / 1.25 /
  1.5), `hazeF()` (0 / nightF·0.5 / nightF).

### EDIT — `client/src/MapView.tsx` (9 small, clearly-marked `ROUND-7` spots)
1. Import of `makeDesktopFx, applyWetShader, DesktopFx` (line ~34).
2. Desktop gate right after `lite`/`phoneLike` are computed (~line 977):
   `pointerFine` + `desktopFxOn = !lite && !phoneLike && pointerFine`;
   `dfx = desktopFxOn ? makeDesktopFx() : null`. `dfx` is in scope for the
   whole scene-setup effect and the render loop; when it is `null` every
   later `if (dfx)` is skipped and the code path is byte-for-byte the old
   one.
3. Road material (~line 1324): `roadMat.map = dfx.asphaltTex` +
   `applyWetShader(roadMat, dfx.wet)`.
4. Sidewalk material (~line 1440): `paveMat.map = dfx.concreteTex` +
   `applyWetShader(paveMat, dfx.wet)`.
5. Neon signs: building-loop `neonMat` (~line 1735) and shop-sign
   `signMatS` (~line 1986) both get `emissiveMap = dfx.neonTex`.
   (Landmark `neonMats` are created in `createLandmarks` elsewhere — left
   alone; they still get the per-frame emissive boost below.)
6. FPS block (~line 2984): the 2.5s FPS window is now consumed every window
   and `dfx.noteFps(fps)` runs each window, while the pixel-ratio ladder
   keeps its own `prChanges < 3 && prWindows > 1` guard. So the effect
   guard keeps measuring even after the pixel-ratio ladder is exhausted.
7. Per-frame update (~line 3031), right after `nightF` is computed:
   `dfx.update({raining, storm, nightF, duskF, dt})` — wetness follows the
   existing real-weather `weatherKind` (`rain`/`storm` → wet), and the
   sky/fog colours are re-lerped toward warm amber `C_HAZE_WARM`
   (`0xff9a5c`, × `hazeF() * 0.16`).
8. Emissive multipliers (~line 3050): `buildingMats` and `fillerMat` and
   `bulbMat` × `windowBoost()`; `neonMats` × `neonBoost()` — the existing
   bloom pass turns the extra emissive into real glow at night.
9. Fog (~line 3045): `near` − `haze * 14`, `far` − `haze * 28`, so the
   warm night haze also pulls the distance fog a little closer after dark.
   `C_HAZE_WARM` is defined with the other colour constants (~line 2938).

## Performance guard
The FPS adaptive system already steps the pixel ratio down when slow.
Round-7 adds a second, independent guard on top: `noteFps` steps the
effect `level` 2 → 1 → 0 (wetness cap 1 → 0.6 → 0, neon/window boost
1.7/1.5 → 1.3/1.25 → 1, haze → 0) whenever the measured FPS drops below
32, and steps back up only after two consecutive windows at ≥ 57 FPS.
Level 0 = all new effects off, back to the pre-round-7 look. The guard
keeps measuring even after the pixel-ratio ladder stops changing.

## Verification
- `bun x tsc --noEmit -p client/tsconfig.json` — 0 errors (only the
  pre-existing `Cannot find type definition file for 'bun-types'`).
- `npm run build` in `standalone/` — vite build succeeds (~9–11s);
  bundle `index-*.js` ≈ 2.00 MB (was 1.999 MB — +~5 KB for this module).
- Shader chunk names verified against three 0.170.0
  (`roughnessmap_fragment` defines `roughnessFactor`,
  `color_fragment` runs after the map is applied, `begin_vertex` /
  `common` / `dithering_fragment` all exist).
- Re-verified on the combined file after the round-8 agent's concurrent
  MapView.tsx edits (spacious blocks + click-to-walk): typecheck clean,
  vite build succeeds. Both rounds' changes coexist; no edit conflicted
  (all round-7 edits matched exact text and are still present).

## How to verify visually (desktop Chrome, lee's Mac)
1. Pull `feature/round-2`, rebuild, restart the server as usual.
2. **Wet streets:** wait for real rain (or set weather to rain in the
   demo), walk/drive through 深南大道 — roads should look darker and
   glossier than before, with patchy puddle glints; after the rain stops
   the gloss lingers for a while, then dries.
3. **Neon night:** at night go to 华强北 / a night market — signs should
   glow as tubes (not flat boxes), windows and street bulbs noticeably
   warmer/brighter, sky/fog leaning warm amber, fog a touch closer.
   The bloom pass does the glow; the effect is warm and lively, not dark.
4. **Day / phone:** in daylight the asphalt/concrete texture is the only
   visible change (subtle grain); on a phone nothing changes at all.

## Deliberately left out
- Viaduct material not wet (less visible, keep the change focused);
  land/ground material not wet (roads + sidewalks only = "streets").
- No glow sprites placed at neon locations (the bloom pass already makes
  boosted neon glow; avoids fragile coordinate hardcoding).
- No new migration; no game-logic / price / save-data change; no change
  to the pixel-ratio ladder's own behaviour (only the FPS feed for the
  FX guard was added).
- No change to `lite` mode or the 画质 toggle: lite already disables
  postfx/shadows, and round-7 additionally requires `!lite`.

## Note for the parent (merge order)
Round-8 (spacious blocks + click-to-walk) edited the same file
`client/src/MapView.tsx` concurrently. Both sets of edits are present and
the combined file typechecks + builds. When pushing, include both
rounds' files in one snapshot push (or push round-7 first, then round-8)
— do not push from a stale copy.
