// Bay Area Life 2.0 — renderer: scene (real meters).
//
// `createWorld2Scene(container, city)` owns the renderer, camera, lights,
// fog, ground and sky. It does NOT build city geometry — the harness wires
// `buildRoads(city)` once and a `createChunkStreamer` for buildings, and
// drives `update(dt, focus)` from its own requestAnimationFrame loop (same
// shape as the World2App stub scene this replaces, including `getCameraYaw`
// for the character controller and drag-to-rotate yaw).
//
// Scale notes (all meters):
//   * Street fog near 14 / far 42 — the 10g numbers, already meters. The
//     10g invariant (fog far inside the full-detail ring) is asserted in
//     streaming.ts: (FULL_R + 1) * CHUNK = 64 m >= 42 m.
//   * Map fog near 800 / far 2000: the whole 500 m block stays clear.
//   * Street camera: ~3.5 m behind the player, height floor 1.6 m (legacy
//     street-mode numbers); eye height 2.4 m, looking at focus + 1.5 m.
//   * Sun shadows ONLY in street mode, in a ~60 m box following the focus.
//     Map mode turns the shadow caster off (a 500 m shadow map would be a
//     blurry waste).
//   * pixelRatio is capped at 2 on desktop: above 2 the GPU cost grows
//     ~quadratically for no visible gain on this scene. (ZhuyaHome's
//     device.ts caps mobile at 1.5; this slice is desktop-first —
//     a mobile pass should lower the cap, not raise it.)
//   * Ground: one large plane sized to the slice render bounds
//     (bbox ENU + 100 m, see roads.ts `sliceRenderBounds`) + 400 m margin,
//     grid-free asphalt/concrete colouring. Roads that run past the box
//     are clipped to the bounds in roads.ts, so no ribbon floats past
//     the ground edge.
import * as THREE from "three";
import { latLonToEnu, type SliceCity } from "../cityData";
import { sliceRenderBounds } from "./roads";
import type { PerfStats } from "./hud";
import type { ChunkStreamer } from "./streaming";

/** Street fog (m): near / far — the 10g numbers, already meters. */
export const STREET_FOG_NEAR = 14;
export const STREET_FOG_FAR = 42;
/** Map fog (m): the whole 500 m block stays clear. */
export const MAP_FOG_NEAR = 800;
export const MAP_FOG_FAR = 2000;
/** Third-person street camera: distance behind the focus, eye height, height floor. */
export const STREET_CAM_DIST = 3.5;
export const STREET_CAM_HEIGHT = 2.4;
export const STREET_CAM_HEIGHT_FLOOR = 1.6;
/** Sun shadow box half-extent (m): a ~60 m box following the focus. */
export const SHADOW_HALF_EXTENT = 30;

export interface World2Scene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update(dt: number, focus: { x: number; y?: number; z: number }): void;
  setMode(mode: "street" | "map"): void;
  /** Camera yaw (radians) — the character controller steers against this. */
  getCameraYaw(): number;
  setYaw(yaw: number): void;
  /** Feed chunk numbers into stats() (harness-owned streamer). */
  attachChunkStreamer(streamer: ChunkStreamer | null): void;
  stats(): PerfStats;
  dispose(): void;
}

export function createWorld2Scene(container: HTMLElement, city: SliceCity): World2Scene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  // Desktop pixel-ratio cap: 2 (see header note).
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / Math.max(1, container.clientHeight),
    0.1,
    3000,
  );

  // ---- sky: gradient dome + sun disc ----
  const skyGeo = new THREE.SphereGeometry(1500, 24, 12);
  const skyPos = skyGeo.attributes.position as THREE.BufferAttribute;
  const skyCol = new Float32Array(skyPos.count * 3);
  const top = new THREE.Color(0x6ea8d8);
  const horizon = new THREE.Color(0xdfe9ef);
  for (let i = 0; i < skyPos.count; i++) {
    const t = Math.max(0, Math.min(1, skyPos.getY(i) / 1500));
    const c = horizon.clone().lerp(top, t);
    skyCol[i * 3] = c.r;
    skyCol[i * 3 + 1] = c.g;
    skyCol[i * 3 + 2] = c.b;
  }
  skyGeo.setAttribute("color", new THREE.BufferAttribute(skyCol, 3));
  const sky = new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  const sunDir = new THREE.Vector3(0.5, 1, 0.35).normalize();
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(40, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }),
  );
  sunDisc.position.copy(sunDir).multiplyScalar(1400);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);
  scene.background = new THREE.Color(0xdfe9ef);

  // ---- fog + lights ----
  const fog = new THREE.Fog(0xdfe9ef, STREET_FOG_NEAR, STREET_FOG_FAR);
  scene.fog = fog;
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7f70, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -SHADOW_HALF_EXTENT;
  sun.shadow.camera.right = SHADOW_HALF_EXTENT;
  sun.shadow.camera.top = SHADOW_HALF_EXTENT;
  sun.shadow.camera.bottom = -SHADOW_HALF_EXTENT;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 300;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);

  // ---- ground: one plane over the render bounds + margin ----
  const bounds = sliceRenderBounds(city);
  const groundW = bounds.maxX - bounds.minX + 400;
  const groundD = bounds.maxZ - bounds.minZ + 400;
  const groundCx = (bounds.minX + bounds.maxX) / 2;
  const groundCz = (bounds.minZ + bounds.maxZ) / 2;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundW, groundD),
    new THREE.MeshStandardMaterial({ color: 0x8f938a, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(groundCx, 0, groundCz);
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- map-mode framing: bbox center + fit height ----
  const c00 = latLonToEnu(city.bbox.minLat, city.bbox.minLon, city.origin);
  const c11 = latLonToEnu(city.bbox.maxLat, city.bbox.maxLon, city.origin);
  const mapCx = (c00[0] + c11[0]) / 2;
  const mapCz = (c00[1] + c11[1]) / 2;
  const mapHalf = Math.max(Math.abs(c11[0] - c00[0]), Math.abs(c11[1] - c00[1])) / 2;
  const mapHeight =
    (mapHalf / Math.tan(((camera.fov / 2) * Math.PI) / 180)) * 1.15;

  // ---- state ----
  let mode: "street" | "map" = "street";
  let yaw = Math.PI; // camera starts south of the player, looking north (World2App stub convention)
  let streamer: ChunkStreamer | null = null;
  let disposed = false;
  const frameMs: number[] = []; // ring buffer of recent frame times (ms)
  const camTarget = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();

  const applyMode = () => {
    if (mode === "street") {
      fog.near = STREET_FOG_NEAR;
      fog.far = STREET_FOG_FAR;
      sun.castShadow = true;
    } else {
      fog.near = MAP_FOG_NEAR;
      fog.far = MAP_FOG_FAR;
      sun.castShadow = false;
    }
  };
  applyMode();

  // ---- drag to rotate (yaw) ----
  let dragging = false;
  let lastX = 0;
  const onPointerDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    renderer.domElement.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    yaw -= (e.clientX - lastX) * 0.005;
    lastX = e.clientX;
  };
  const onPointerUp = () => {
    dragging = false;
  };
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerup", onPointerUp);

  const onResize = () => {
    camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);
  window.addEventListener("resize", onResize);

  const api: World2Scene = {
    renderer,
    scene,
    camera,
    update(dt: number, focus: { x: number; y?: number; z: number }): void {
      if (disposed) return;
      const clampedDt = Math.min(0.1, Math.max(0.001, dt));
      frameMs.push(clampedDt * 1000);
      if (frameMs.length > 120) frameMs.shift();
      const fy = focus.y ?? 0;
      if (mode === "map") {
        camera.position.set(mapCx, mapHeight, mapCz + 0.01);
        camera.lookAt(mapCx, 0, mapCz);
      } else {
        camTarget.set(
          focus.x + Math.sin(yaw) * STREET_CAM_DIST,
          Math.max(STREET_CAM_HEIGHT_FLOOR, fy + STREET_CAM_HEIGHT),
          focus.z + Math.cos(yaw) * STREET_CAM_DIST,
        );
        // Smooth follow (no snap on focus jumps); look at the focus head.
        const k = 1 - Math.exp(-clampedDt * 10);
        camera.position.lerp(camTarget, k);
        lookTarget.set(focus.x, fy + 1.5, focus.z);
        camera.lookAt(lookTarget);
        // Sun shadow box follows the focus.
        sun.position.set(
          focus.x + sunDir.x * 120,
          fy + sunDir.y * 120,
          focus.z + sunDir.z * 120,
        );
        sun.target.position.set(focus.x, 0, focus.z);
        sun.target.updateMatrixWorld();
      }
      renderer.render(scene, camera);
    },
    setMode(m: "street" | "map"): void {
      if (m === mode) return;
      mode = m;
      applyMode();
    },
    getCameraYaw(): number {
      return yaw;
    },
    setYaw(y: number): void {
      yaw = y;
    },
    attachChunkStreamer(s: ChunkStreamer | null): void {
      streamer = s;
    },
    stats(): PerfStats {
      const sorted = [...frameMs].sort((a, b) => a - b);
      const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] ?? 0 : 0;
      const mean = sorted.length > 0 ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
      const fps = mean > 0 ? 1000 / mean : 0;
      const heapMB =
        typeof performance !== "undefined" &&
        (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
          ? (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1048576
          : null;
      const s = streamer?.stats();
      const l = streamer?.ledgerStats();
      return {
        fps,
        frameMsP95: p95,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        heapMB,
        geometryMB: l?.geometryMB ?? 0,
        unreferencedMB: l?.unreferencedMB ?? 0,
        chunksLoaded: s?.loaded ?? 0,
        chunksSimple: s?.simple ?? 0,
      };
    },
    dispose(): void {
      disposed = true;
      resizeObserver.disconnect();
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      skyGeo.dispose();
      (sky.material as THREE.Material).dispose();
      (sunDisc.geometry as THREE.BufferGeometry).dispose();
      (sunDisc.material as THREE.Material).dispose();
      (ground.geometry as THREE.BufferGeometry).dispose();
      (ground.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
  return api;
}
