// ROUND-10g — port of lee's home-designer src/lib/texCpuRelease.ts.
//
// Home-designer measured this on iPhone: CPU-resident textures 546 MB
// (256 textures, 65% of 842 MB total) -> 7 MB, JS heap 1.1 GB -> ~323 MB.
// It is plain THREE.Texture (no R3F dependency), so it ports almost
// verbatim into the game — the only adaptation is where it is armed
// (chunk-owned textures, in materializeChunk) and the mobile-only gate.
//
// The rule, unchanged from home-designer:
//   * ONLY compressed textures (KTX2 / ASTC) and ImageBitmap-backed
//     textures get the hook — their CPU copy is a large buffer that the
//     GPU no longer needs after upload.
//   * NEVER canvas / HTMLImage textures: they are often shared across
//     views, and a new WebGL context would have nothing to re-upload from
//     (home-designer photographed this failure: cars and doors all black).
//   * Dynamic redraw textures are excluded via a WeakSet (markTexDynamic).
//   * Cost: after a context loss the texture cannot re-upload (its CPU
//     copy is gone), so this is mobile-only — iOS WebKit kills the render
//     process past ~1–1.5 GB per page (home-designer device.ts), while the
//     desktop game has headroom and keeps its CPU copies.
//
// Honest status in this game (2026-11-12): the game's textures today are
// procedural canvases (lit windows, neon, smoke glow) and standard GLB
// images — NONE of them qualifies, so the hook is dormant. It fires the
// moment a chunk-owned texture is a compressed or ImageBitmap texture.
// The next step is adopting KTX2 / ImageBitmap for the GLB models, at
// which point the same call sites start paying off. What does NOT port
// from home-designer: useGLTF.clear (the game generates geometry in code
// and has no GLTF cache), drei <Detailed>, R3F components.
import * as THREE from "three";

/** Textures the game redraws at runtime — never CPU-release these: a
    context loss would leave nothing to re-upload from. */
const dynamicTexs = new WeakSet<THREE.Texture>();
export function markTexDynamic(tex: THREE.Texture): void {
  dynamicTexs.add(tex);
}

/** Mobile-only gate (see header). MapView sets this once from its
    phone / lite detection; desktop leaves it off. */
let cpuReleaseEnabled = false;
export function setCpuReleaseEnabled(on: boolean): void {
  cpuReleaseEnabled = on;
}

/** Is this texture a safe candidate for CPU release after upload? */
function isReleasable(tex: THREE.Texture): boolean {
  if (dynamicTexs.has(tex)) return false;
  const img = tex.image as unknown;
  if (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) return true;
  if ((tex as THREE.CompressedTexture).isCompressedTexture) return true;
  return false;
}

/** Arm the release: after the texture's first GPU upload, drop its CPU
    copy (source.data = null, ImageBitmap.close(), mipmaps = []). Safe to
    call on any texture — non-candidates and dynamic textures are ignored,
    and the hook is a no-op when CPU release is disabled (desktop). */
export function releaseCpuAfterUpload(tex: THREE.Texture): void {
  if (!cpuReleaseEnabled || !isReleasable(tex)) return;
  const prev = tex.onUpdate;
  tex.onUpdate = () => {
    if (prev) prev.call(tex);
    const src = tex.source;
    if (src) {
      const data = src.data as unknown;
      if (typeof ImageBitmap !== "undefined" && data instanceof ImageBitmap) data.close();
      src.data = null;
    }
    tex.mipmaps = [];
    tex.onUpdate = () => {};
  };
}
