// Bay Area Life 2.0 — Stage 1 slice: drivable vehicle.
//
// Wiring on top of physics.createVehicle — the body owns motion and
// collision; this file owns enter/exit, the car mesh, input, and the
// 40 km/h园区限速. SEAM: VehicleBodyLike is a structural mirror of the
// physics.ts VehicleBody contract (position / heading / speedKmh /
// drive). The real createVehicle satisfies it by shape; when physics.ts
// lands, delete the local interface and import the real type.
//
// Car mesh: tries ./models/car/sedan.glb first (the Kenney Car Kit GLB
// already in client/public/models/car/, same load-or-fallback pattern as
// MapView's loadModel). If it fails to load, a primitive car body
// (boxes + cylinder wheels) stands in — the slice stays drivable either
// way. Which one rendered is reported via controller.meshKind.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Vec3Like } from "./character";

/**
 * Structural mirror of the physics.ts VehicleBody contract.
 * Heading: 0 = +x (east), increasing toward +z (south); forward is
 * (cos h, 0, sin h), so a three.js mesh needs rotation.y = -heading
 * (physics.ts headingToQuaternion). drive() takes brake as a BOOLEAN.
 * Collision stops the car — physics handles it; this controller only
 * stops asking for throttle at the 40 km/h cap.
 */
export interface VehicleBodyLike {
  position(): Vec3Like;
  heading(): number;
  speedKmh(): number;
  drive(steer: number, throttle: number, brake: boolean): void;
}

export const VEHICLE_TOP_SPEED_KMH = 40;
export const CAR_GLB_URL = "./models/car/sedan.glb";

export interface VehicleControllerOpts {
  scene: THREE.Scene;
  createVehicle: (x: number, z: number, heading: number) => VehicleBodyLike;
  spawn: { x: number; z: number; heading: number };
  getPlayerPos: () => Vec3Like;
  carGlbUrl?: string;
  onEnter?: () => void;
  onExit?: () => void;
}

export interface VehicleController {
  readonly driving: boolean;
  readonly meshKind: "glb" | "primitive" | "loading";
  readonly body: VehicleBodyLike;
  /** E near the parked car (<= 3 m) enters; E while driving exits. */
  tryEnter(): boolean;
  exit(): boolean;
  /** Where the player steps out after exit() — read right after exit(). */
  getExitPosition(): { x: number; z: number };
  nearestDistance(playerPos: Vec3Like): number;
  update(dt: number): void;
  dispose(): void;
}

const gltfLoader = new GLTFLoader();

function primitiveCar(): THREE.Group {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0x2f6fb5, roughness: 0.4, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.15, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 4.2), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.0), glass);
  cabin.position.set(0, 1.05, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16);
  for (const [x, z] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]] as const) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.34, z);
    wheel.castShadow = true;
    g.add(wheel);
  }
  return g;
}

export function createVehicleController(opts: VehicleControllerOpts): VehicleController {
  const body = opts.createVehicle(opts.spawn.x, opts.spawn.z, opts.spawn.heading);
  const group = new THREE.Group();
  // The car model is built length-along-Z (Kenney kit / primitive);
  // physics forward at heading 0 is +x, so the model lives in an inner
  // group turned 90° (rotation.y = π/2 maps +z to +x). Assumption: the
  // model's front is its +z end (MapView's fittedClone treats +Z as
  // forward the same way); if the car drives backwards in the browser,
  // flip this to -π/2.
  const inner = new THREE.Group();
  inner.rotation.y = Math.PI / 2;
  group.add(inner);
  opts.scene.add(group);
  let meshKind: VehicleController["meshKind"] = "loading";
  let disposed = false;

  // GLB first (Kenney sedan), primitive fallback — MapView loadModel pattern.
  void gltfLoader
    .loadAsync(opts.carGlbUrl ?? CAR_GLB_URL)
    .then((gltf) => {
      if (disposed) return;
      const model = gltf.scene;
      // Normalise: length along +Z ~= 4.2 m, wheels on y = 0, centred.
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const longest = Math.max(size.x, size.z);
      const k = 4.2 / Math.max(0.001, longest);
      model.scale.multiplyScalar(k);
      const box2 = new THREE.Box3().setFromObject(model);
      const c = box2.getCenter(new THREE.Vector3());
      model.position.set(-c.x, -box2.min.y, -c.z);
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      inner.add(model);
      meshKind = "glb";
    })
    .catch(() => {
      if (disposed) return;
      console.warn(
        `[world2] car GLB not available (${opts.carGlbUrl ?? CAR_GLB_URL}) — primitive car fallback`,
      );
      inner.add(primitiveCar());
      meshKind = "primitive";
    });

  const keys = new Set<string>();
  let driving = false;
  const exitPos = { x: opts.spawn.x, z: opts.spawn.z };
  const onKeyDown = (e: KeyboardEvent) => {
    keys.add(e.key.toLowerCase());
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.key.toLowerCase());
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const syncMesh = () => {
    const p = body.position();
    group.position.set(p.x, p.y, p.z);
    // Physics heading 0 = +x east; three rotation.y = -heading (see above).
    group.rotation.y = -body.heading();
  };
  syncMesh();

  const controller: VehicleController = {
    get driving() {
      return driving;
    },
    get meshKind() {
      return meshKind;
    },
    body,
    nearestDistance(playerPos: Vec3Like) {
      const p = body.position();
      return Math.hypot(playerPos.x - p.x, playerPos.z - p.z);
    },
    tryEnter() {
      if (driving) return false;
      if (controller.nearestDistance(opts.getPlayerPos()) > 3) return false;
      driving = true;
      opts.onEnter?.();
      return true;
    },
    exit() {
      if (!driving) return false;
      driving = false;
      // Step out beside the car (2 m to the right of the forward axis:
      // forward is (cos h, sin h) in xz, so right is (-sin h, cos h)).
      const p = body.position();
      const h = body.heading();
      const outX = p.x + -Math.sin(h) * 2;
      const outZ = p.z + Math.cos(h) * 2;
      body.drive(0, 0, true);
      opts.onExit?.();
      // The caller (World2App) respawns the player capsule at the exit
      // position (getExitPosition) right after exit() returns true —
      // the physics contract has no teleport.
      exitPos.x = outX;
      exitPos.z = outZ;
      return true;
    },
    getExitPosition() {
      return { ...exitPos };
    },
    update(dt: number) {
      void dt;
      if (!driving) {
        syncMesh();
        return;
      }
      let throttle = 0;
      let steer = 0;
      let brake = false;
      if (keys.has("w") || keys.has("arrowup")) throttle += 1;
      if (keys.has("s") || keys.has("arrowdown")) throttle -= 1;
      if (keys.has("a") || keys.has("arrowleft")) steer -= 1;
      if (keys.has("d") || keys.has("arrowright")) steer += 1;
      if (keys.has(" ")) brake = true; // Space = handbrake
      // 40 km/h cap: stop asking for throttle at the cap (physics still
      // owns braking / collision stops).
      if (body.speedKmh() >= VEHICLE_TOP_SPEED_KMH && throttle > 0) throttle = 0;
      body.drive(steer, throttle, brake);
      syncMesh();
    },
    dispose() {
      disposed = true;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      opts.scene.remove(group);
    },
  };
  return controller;
}
