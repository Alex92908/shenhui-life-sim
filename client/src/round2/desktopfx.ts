// Desktop-only visual effects (round 7): rain-wet streets, neon night,
// procedural textures, warm night haze. Lee wants the DESKTOP experience
// as stunning as possible with no artificial limits; phones are completely
// untouched — MapView only wires this in when the desktop gate passes
// (fine pointer, not phone-like, not lite), and the FPS guard below turns
// the effects down first if the machine can't keep up.
//
// Nothing here changes game logic, prices or save data. No migration.
// The look stays a bright low-poly life sim — this makes the existing city
// richer and more alive, it does not turn it into a dark cyberpunk shooter.
import * as THREE from "three";

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wet asphalt: dark aggregate speckle + soft patches. Baked once, reused
    as the road material's map (desktop only). Noise hides the UV stretch
    across road boxes of different lengths. */
export function makeAsphaltTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#c9c9cd";
  g.fillRect(0, 0, 256, 256);
  const rnd = mulberry(1337);
  // soft patchy blotches (repairs, wear)
  for (let i = 0; i < 46; i++) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const r = 14 + rnd() * 42;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() > 0.5;
    grad.addColorStop(0, dark ? "rgba(70,72,78,0.20)" : "rgba(225,225,230,0.16)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // aggregate speckle
  for (let i = 0; i < 5200; i++) {
    const v = 120 + Math.floor(rnd() * 110);
    g.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + rnd() * 0.5})`;
    g.fillRect(rnd() * 256, rnd() * 256, 1 + (rnd() > 0.85 ? 1 : 0), 1 + (rnd() > 0.85 ? 1 : 0));
  }
  // a few hairline cracks
  g.strokeStyle = "rgba(40,42,46,0.35)";
  g.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    g.beginPath();
    let x = rnd() * 256;
    let y = rnd() * 256;
    g.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (rnd() - 0.5) * 44;
      y += (rnd() - 0.5) * 44;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);
  return tex;
}

/** Pavement concrete: pale warm grey, fine grain, faint joints. Baked once,
    reused as the sidewalk material's map (desktop only). */
export function makeConcreteTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#e6dfcd";
  g.fillRect(0, 0, 256, 256);
  const rnd = mulberry(4242);
  for (let i = 0; i < 3600; i++) {
    const v = 190 + Math.floor(rnd() * 55);
    g.fillStyle = `rgba(${v},${v - 4},${v - 16},${0.2 + rnd() * 0.4})`;
    g.fillRect(rnd() * 256, rnd() * 256, 1, 1);
  }
  // soft stains
  for (let i = 0; i < 26; i++) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const r = 12 + rnd() * 30;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(120,110,90,0.14)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // faint expansion joints
  g.strokeStyle = "rgba(90,84,70,0.28)";
  g.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    g.beginPath();
    g.moveTo(i * 64, 0);
    g.lineTo(i * 64, 256);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i * 64);
    g.lineTo(256, i * 64);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);
  return tex;
}

/** Neon tubes: two bright horizontal bands on black. Used as the emissiveMap
    of neon shop signs (desktop only) — the sign's emissive colour tints the
    bands, so each shop glows in its own colour while the gaps stay dark,
    like real neon tubing instead of a flat glowing box. */
export function makeNeonTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000000";
  g.fillRect(0, 0, 128, 64);
  g.shadowColor = "rgba(255,255,255,0.95)";
  g.shadowBlur = 7;
  g.fillStyle = "#ffffff";
  // two tube runs with a small gap, plus a dimmer third accent
  g.fillRect(10, 13, 108, 5);
  g.fillRect(10, 13, 108, 5);
  g.fillRect(22, 40, 84, 5);
  g.fillRect(22, 40, 84, 5);
  g.shadowBlur = 3;
  g.fillStyle = "rgba(255,255,255,0.75)";
  g.fillRect(10, 52, 108, 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Rain-wet look for a street material (roads, sidewalks). Injects a shared
    wetness uniform into a MeshStandardMaterial: while wet the surface goes
    darker and glossier, with world-space noise patches that read as puddles
    catching the sun/moon. When uWet is 0 the injection is a no-op, so level
    0 (off) is exactly the original look. */
export function applyWetShader(mat: THREE.MeshStandardMaterial, wet: { value: number }): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWet = wet;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vWetXZ;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvWetXZ = (modelMatrix * vec4(transformed, 1.0)).xz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uWet;
varying vec2 vWetXZ;
float dfxHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float dfxNoise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dfxHash(i), dfxHash(i + vec2(1.0, 0.0)), u.x),
             mix(dfxHash(i + vec2(0.0, 1.0)), dfxHash(i + vec2(1.0, 1.0)), u.x), u.y);
}`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
{
  float n = dfxNoise(vWetXZ * 0.35) * 0.65 + dfxNoise(vWetXZ * 1.7) * 0.35;
  float puddle = smoothstep(0.58, 0.8, n);
  float damp = smoothstep(0.3, 0.62, n);
  float w = uWet * (0.3 + 0.7 * damp);
  roughnessFactor = mix(roughnessFactor, 0.12, clamp(w, 0.0, 1.0) * (0.5 + 0.5 * puddle));
}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
{
  float cw = uWet * 0.5;
  diffuseColor.rgb *= (1.0 - cw * 0.38);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.85, 0.9, 1.02), cw);
}`,
      );
  };
  mat.customProgramCacheKey = () => "desktopfx-wet-v1";
}

export interface DesktopFx {
  /** 0 = off (original look), 1 = reduced (neon only, wet capped), 2 = full */
  level: number;
  /** shared wetness uniform (0 dry .. 1 soaked), eased toward a target */
  wet: { value: number };
  asphaltTex: THREE.CanvasTexture;
  concreteTex: THREE.CanvasTexture;
  neonTex: THREE.CanvasTexture;
  /** feed a completed FPS window (MapView's 2.5s measurement) */
  noteFps: (fps: number) => void;
  /** per-frame: ease wetness toward the weather */
  update: (o: { raining: boolean; storm: boolean; nightF: number; duskF: number; dt: number; street?: boolean }) => void;
  /** multiplier for neon emissive on desktop (1 when off) */
  neonBoost: () => number;
  /** multiplier for window / bulb emissive on desktop (1 when off) */
  windowBoost: () => number;
}

export function makeDesktopFx(): DesktopFx {
  let level = 2;
  let goodStreak = 0;
  const wet = { value: 0 };
  const asphaltTex = makeAsphaltTexture();
  const concreteTex = makeConcreteTexture();
  const neonTex = makeNeonTexture();
  return {
    get level() {
      return level;
    },
    wet,
    asphaltTex,
    concreteTex,
    neonTex,
    noteFps(fps: number) {
      if (fps < 32) {
        level = Math.max(0, level - 1);
        goodStreak = 0;
      } else if (fps >= 57) {
        goodStreak += 1;
        if (goodStreak >= 2) {
          level = Math.min(2, level + 1);
          goodStreak = 0;
        }
      } else {
        goodStreak = 0;
      }
    },
    update(o: { raining: boolean; storm: boolean; nightF: number; duskF: number; dt: number; street?: boolean }) {
      const cap = level === 0 ? 0 : level === 1 ? 0.6 : 1;
      // ROUND-10: in street mode the road keeps a humid sheen even on a dry
      // day (Sleeping Dogs Hong Kong streets stay glossy) — a floor of 0.35
      // under the weather-driven target, never above the rain target.
      const target = Math.max((o.raining || o.storm ? 1 : 0) * cap, o.street ? 0.35 : 0);
      // soak fast when rain starts, dry slowly so streets stay glossy
      // for a while after the rain stops
      const rate = target > wet.value ? 0.55 : 0.02;
      const step = rate * Math.max(0, o.dt);
      wet.value += Math.max(-step, Math.min(step, target - wet.value));
    },
    neonBoost() {
      return level === 0 ? 1 : level === 1 ? 1.3 : 1.7;
    },
    windowBoost() {
      return level === 0 ? 1 : level === 1 ? 1.25 : 1.5;
    },
  };
}
