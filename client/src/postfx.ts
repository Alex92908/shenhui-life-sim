// Cinematic post-processing for the PC high-end edition (this artifact is
// PC-only by design — the phone edition is a separate artifact and keeps
// its own pipeline). One chain shared by the 3D map and the life-stage:
//   RenderPass → UnrealBloomPass （辉光： window lights, neon, carriage
//   screens and lamps actually glow) → warm grade + tilt-shift DOF pass
//   (warm amber shadows, gentle contrast curve, vignette, and a miniature
//   depth-of-field: a sharp focal band with poisson-blurred edges — the
//   tilt-shift look that makes a miniature city read as cinematic) →
//   OutputPass (tone mapping + sRGB).
// Any failure (old GPU, blocked extension) degrades to the plain renderer:
// makePostFx returns null and callers fall back to renderer.render.
// Callers create their renderer with antialias:false on purpose: the
// composer renders the scene into its own (non-MSAA) target, so canvas
// MSAA never touched the 3D scene — it only cost fill rate.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uBlur: { value: 0.004 },
    uAspect: { value: 1.6 },
    uWarm: { value: 1.0 },
    uVignette: { value: 0.32 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uBlur;
    uniform float uAspect;
    uniform float uWarm;
    uniform float uVignette;
    varying vec2 vUv;

    vec3 grade(vec3 c) {
      // gentle filmic S-curve
      c = clamp(c, 0.0, 1.0);
      c = c * c * (3.0 - 2.0 * c) * 0.22 + c * 0.78;
      // warm the shadows toward amber, keep highlights clean
      float luma = dot(c, vec3(0.299, 0.587, 0.114));
      vec3 warmTint = vec3(1.06, 0.98, 0.88);
      c = mix(c, c * warmTint, (1.0 - luma) * 0.35 * uWarm);
      // saturation lift
      c = mix(vec3(luma), c, 1.09);
      return c;
    }

    void main() {
      // tilt-shift depth of field: sharp band around the focal line,
      // poisson-disc blur growing toward the top/bottom edges
      float band = abs(vUv.y - 0.52);
      float amount = smoothstep(0.16, 0.52, band) * uBlur;
      vec2 px = vec2(amount / uAspect, amount);
      vec3 col = texture2D(tDiffuse, vUv).rgb * 0.22;
      col += texture2D(tDiffuse, vUv + px * vec2(1.0, 0.3)).rgb * 0.13;
      col += texture2D(tDiffuse, vUv + px * vec2(-1.0, -0.3)).rgb * 0.13;
      col += texture2D(tDiffuse, vUv + px * vec2(0.3, 1.0)).rgb * 0.13;
      col += texture2D(tDiffuse, vUv + px * vec2(-0.3, -1.0)).rgb * 0.13;
      col += texture2D(tDiffuse, vUv + px * vec2(0.8, 0.8)).rgb * 0.065;
      col += texture2D(tDiffuse, vUv + px * vec2(-0.8, 0.8)).rgb * 0.065;
      col += texture2D(tDiffuse, vUv + px * vec2(0.8, -0.8)).rgb * 0.065;
      col += texture2D(tDiffuse, vUv + px * vec2(-0.8, -0.8)).rgb * 0.065;
      col = grade(col);
      // vignette
      float d = distance(vUv, vec2(0.5, 0.46));
      col *= 1.0 - uVignette * smoothstep(0.42, 0.95, d);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export interface PostFx {
  render: () => void;
  setSize: (w: number, h: number) => void;
  /** follow the renderer when adaptive resolution changes its pixel ratio */
  setPixelRatio: (pr: number) => void;
  dispose: () => void;
}

export function makePostFx(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  opts: { bloomStrength: number; bloomThreshold: number; blur: number },
): PostFx | null {
  try {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), opts.bloomStrength, 0.55, opts.bloomThreshold);
    composer.addPass(bloom);
    const grade = new ShaderPass(GradeShader);
    const gu = grade.uniforms as Record<string, { value: unknown } | undefined>;
    if (gu.uBlur) gu.uBlur.value = opts.blur;
    if (gu.uAspect) gu.uAspect.value = size.x / Math.max(1, size.y);
    composer.addPass(grade);
    composer.addPass(new OutputPass());
    return {
      render: () => composer.render(),
      setSize: (w: number, h: number) => {
        composer.setSize(w, h);
        if (gu.uAspect) gu.uAspect.value = w / Math.max(1, h);
      },
      setPixelRatio: (pr: number) => composer.setPixelRatio(pr),
      dispose: () => composer.dispose(),
    };
  } catch {
    return null;
  }
}
