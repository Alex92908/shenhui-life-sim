/**
 * Bay Area Life 2.0 — Stage 1 physics (Rapier).
 *
 * Pure logic + Rapier. No three.js, no React, no game imports.
 *
 * Coordinate convention (shared with city-data / nav):
 *   x = east, z = south, y = up, all in meters. Ground plane is y = 0.
 *   Heading 0 = +x (east), increasing toward +z (south); see
 *   `headingToQuaternion` for the exact mapping.
 *
 * Decisions (Stage 1, single-player slice):
 * - Rapier `@dimforge/rapier3d-compat` 0.21.0. The `-compat` build inlines
 *   its WASM as base64, so `await RAPIER.init()` works in Node, in a Vite
 *   browser build, and in a worker with no extra asset/copy step.
 * - Fixed timestep 1/60 s with an accumulator inside `step()`; incoming
 *   `dt` is clamped to 0.25 s and at most 5 substeps run per call (any
 *   backlog beyond that is dropped, so a hitch can never spiral).
 * - Buildings are ONE axis-aligned cuboid collider per building (footprint
 *   AABB). True polygon / rotated-footprint colliders are a later step:
 *   an AABB over-approximates rotated or L-shaped footprints, so a
 *   building's collider can stick out past its walls by up to half the
 *   footprint's diagonal on the short side. The navmesh (nav.ts) is the
 *   source of truth for where agents may walk; physics colliders are the
 *   hard stop for the player and the car.
 * - The vehicle is a SIMPLE arcade vehicle: one dynamic cuboid rigid
 *   body + velocity steering. It is NOT Rapier's raycast-vehicle
 *   controller (no suspension, no wheels, no slip model). It does
 *   steering / braking / collision / parking only, top speed 40 km/h,
 *   and collides with buildings + ground. A raycast vehicle would give
 *   believable suspension and drifting, but for a 40 km/h park loop the
 *   arcade body is the same player-visible behaviour for far less
 *   tuning surface; revisit if the slice ever wants drifting, curbs, or
 *   ramps.
 */

import RAPIER from "@dimforge/rapier3d-compat";
import type { SliceBuilding } from "./cityData";

/** Fixed physics timestep (s). */
export const FIXED_DT = 1 / 60;
/** Hard cap on substeps per step() call; backlog beyond this is dropped. */
const MAX_SUBSTEPS = 5;
/** Incoming dt above this is treated as a hitch and clamped. */
const MAX_DT = 0.25;

const GRAVITY_Y = -9.81;

/** Player capsule: radius 0.35 m, cylindrical half-height 0.55 m. */
export const PLAYER_RADIUS = 0.35;
export const PLAYER_HALF_HEIGHT = 0.55;
/** Total player height = 2 * (0.55 + 0.35) = 1.8 m. */
export const PLAYER_HEIGHT = 2 * (PLAYER_HALF_HEIGHT + PLAYER_RADIUS);
/** Jump take-off speed (m/s); ~1.5 m jump height under -9.81 gravity. */
const JUMP_SPEED = 5.5;
/** Grounded ray length: capsule centre sits 0.9 m above ground when
 *  standing, so a 0.98 m ray gives ~8 cm of step/curb tolerance. */
const GROUNDED_RAY_LENGTH = PLAYER_HALF_HEIGHT + PLAYER_RADIUS + 0.08;

/** Vehicle: top speed 40 km/h (park speed limit = gameplay constraint). */
export const VEHICLE_MAX_SPEED_KMH = 40;
export const VEHICLE_MAX_SPEED = VEHICLE_MAX_SPEED_KMH / 3.6;
/** Reverse is capped well below forward speed. */
const VEHICLE_MAX_REVERSE = 5 / 3.6;
const VEHICLE_ACCEL = 6; // m/s^2
const VEHICLE_BRAKE_DECEL = 12; // m/s^2
const VEHICLE_COAST_DECEL = 3; // m/s^2 when no throttle
const VEHICLE_DECEL = 8; // m/s^2 when easing off the throttle
/** Steering rate (rad/s) at full lock and full speed; scaled down at low
 *  speed so the car cannot spin on the spot. */
const VEHICLE_STEER_RATE = 1.1;
/** Vehicle body half-extents (m): 1.8 wide, 1.2 tall, 4.2 long. */
const VEHICLE_HALF_EXTENTS = { x: 0.9, y: 0.6, z: 2.1 };
/** Body centre height: the cuboid rests exactly on the ground (bottom
 *  at y = 0), so the car does not drop and settle on spawn. */
const VEHICLE_BODY_Y = VEHICLE_HALF_EXTENTS.y;

export interface PhysicsWorld {
  rapier: typeof RAPIER;
  world: RAPIER.World;
  step(dt: number): void;
  dispose(): void;
}

/** Per-substep controller, driven from PhysicsWorld.step(). */
interface WorldController {
  /** Runs before world.step(): write velocities / rotations. */
  preStep(dt: number): void;
  /** Runs after world.step(): reconcile scripted state with reality. */
  postStep(): void;
}

/** Controllers registered against their world (keyed by the world object). */
const controllersByWorld = new WeakMap<object, WorldController[]>();

function approach(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(value + maxDelta, target);
  if (value > target) return Math.max(value - maxDelta, target);
  return value;
}

export async function createPhysicsWorld(): Promise<PhysicsWorld> {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: GRAVITY_Y, z: 0 });
  world.timestep = FIXED_DT;

  let accumulator = 0;
  let disposed = false;
  const controllers: WorldController[] = [];
  controllersByWorld.set(world, controllers);

  function step(dt: number): void {
    if (disposed) return;
    const clamped = Math.min(Math.max(dt, 0), MAX_DT);
    accumulator += clamped;
    let substeps = 0;
    while (accumulator >= FIXED_DT && substeps < MAX_SUBSTEPS) {
      for (const c of controllers) c.preStep(FIXED_DT);
      world.step();
      for (const c of controllers) c.postStep();
      accumulator -= FIXED_DT;
      substeps++;
    }
    if (substeps === MAX_SUBSTEPS) accumulator = 0; // drop backlog
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    controllersByWorld.delete(world);
    world.free();
  }

  return { rapier: RAPIER, world, step, dispose };
}

/**
 * Big flat ground collider for the 500 m block. A single cuboid whose top
 * face is y = 0 (half-extent 0.5 m, centred at y = -0.5).
 *
 * NOTE — sizeM must cover the data extent, not just the nominal 500 m
 * bbox: in the current slice snapshot some footprints extend past
 * ±250 m ENU (max |x| 286.7 m, max |z| 272.0 m), so a 500 m ground
 * plane would leave those buildings standing past the ground edge and
 * the player would fall into the void walking toward them. Pass
 * sizeM >= 600 for this snapshot (or derive it from the data extent).
 */
export function addGroundPlane(w: PhysicsWorld, sizeM: number): void {
  const half = sizeM / 2;
  w.world.createCollider(
    RAPIER.ColliderDesc.cuboid(half, 0.5, half)
      .setTranslation(0, -0.5, 0)
      .setFriction(0.9),
  );
}

/**
 * One cuboid collider per building, from the footprint's axis-aligned
 * bounding box, standing on y = 0. See the header note: AABBs
 * over-approximate rotated / L-shaped footprints; true polygon colliders
 * are a later step.
 *
 * Out-of-range footprints are handled, not clamped: colliders are placed
 * at their true ENU coordinates even when they extend past the nominal
 * 500 m block (e.g. 尚美科技大厦 reaches x = 270 m). Clamping would put
 * a solid wall in the wrong place; it is the ground plane's job (see
 * addGroundPlane) to be sized to the data extent.
 */
export function addBuildingColliders(
  w: PhysicsWorld,
  buildings: SliceBuilding[],
): void {
  for (const b of buildings) {
    if (b.footprint.length < 3 || !(b.height > 0)) continue;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const [x, z] of b.footprint) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const dx = maxX - minX;
    const dz = maxZ - minZ;
    if (!(dx > 0.01) || !(dz > 0.01)) continue;
    w.world.createCollider(
      RAPIER.ColliderDesc.cuboid(dx / 2, b.height / 2, dz / 2)
        .setTranslation((minX + maxX) / 2, b.height / 2, (minZ + maxZ) / 2)
        .setFriction(0.5),
    );
  }
}

export interface PlayerBody {
  position(): { x: number; y: number; z: number };
  velocity(): { x: number; y: number; z: number };
  move(dirX: number, dirZ: number, speed: number): void;
  jump(): void;
  grounded(): boolean;
}

/**
 * Dynamic capsule, r 0.35 m, cylindrical half-height 0.55 m (~1.8 m
 * tall), rotations locked, CCD on. Spawned standing on y = 0.
 * Movement is arcade velocity control: move() records the desired
 * horizontal velocity, and PhysicsWorld.step() re-applies it every
 * fixed substep (re-applying matters — ground friction would otherwise
 * eat a one-shot velocity write within a few frames). Vertical velocity
 * is always preserved, so jumping and falling are unaffected; with no
 * input the desired velocity is zero, so the capsule stops dead.
 */
export function createPlayerCapsule(
  w: PhysicsWorld,
  x: number,
  z: number,
): PlayerBody {
  const body = w.world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, PLAYER_HALF_HEIGHT + PLAYER_RADIUS, z)
      .setLinearDamping(0)
      .lockRotations()
      .setCcdEnabled(true),
  );
  // ~70 kg: capsule volume is ~0.60 m^3, so density ~116 kg/m^3.
  const collider = w.world.createCollider(
    RAPIER.ColliderDesc.capsule(PLAYER_HALF_HEIGHT, PLAYER_RADIUS)
      .setFriction(0.8)
      .setRestitution(0)
      .setDensity(116),
    body,
  );

  // Desired horizontal velocity (m/s), set by move(), applied each substep.
  let desiredX = 0;
  let desiredZ = 0;
  const controllers = controllersByWorld.get(w.world);
  if (controllers) {
    controllers.push({
      preStep(): void {
        const v = body.linvel();
        body.setLinvel({ x: desiredX, y: v.y, z: desiredZ }, true);
      },
      postStep(): void {
        // Nothing to reconcile: velocity is re-applied every substep.
      },
    });
  }

  function position(): { x: number; y: number; z: number } {
    const t = body.translation();
    return { x: t.x, y: t.y, z: t.z };
  }

  function velocity(): { x: number; y: number; z: number } {
    const v = body.linvel();
    return { x: v.x, y: v.y, z: v.z };
  }

  function grounded(): boolean {
    const p = body.translation();
    const ray = new RAPIER.Ray(
      { x: p.x, y: p.y, z: p.z },
      { x: 0, y: -1, z: 0 },
    );
    const hit = w.world.castRay(
      ray,
      GROUNDED_RAY_LENGTH,
      true,
      undefined,
      undefined,
      collider,
    );
    return hit !== null;
  }

  function move(dirX: number, dirZ: number, speed: number): void {
    const len = Math.hypot(dirX, dirZ);
    if (len < 1e-6) {
      desiredX = 0;
      desiredZ = 0;
      return;
    }
    const s = speed / len;
    desiredX = dirX * s;
    desiredZ = dirZ * s;
  }

  function jump(): void {
    if (!grounded()) return;
    const v = body.linvel();
    body.setLinvel({ x: v.x, y: JUMP_SPEED, z: v.z }, true);
  }

  return { position, velocity, move, jump, grounded };
}

export interface VehicleBody {
  position(): { x: number; y: number; z: number };
  heading(): number;
  speedKmh(): number;
  drive(steer: number, throttle: number, brake: boolean): void;
}

/** Heading (0 = +x east, + toward +z south) to a Y-axis quaternion.
 *  Rapier/three use a right-handed y-up frame, where rotation about +y
 *  by theta maps +x to (cos theta, 0, -sin theta); to get forward
 *  (cos h, 0, sin h) the rotation angle is therefore -h. */
function headingToQuaternion(heading: number): {
  x: number;
  y: number;
  z: number;
  w: number;
} {
  const half = -heading / 2;
  return { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(-1, v));
}

/**
 * SIMPLE arcade vehicle: one dynamic cuboid rigid body + velocity
 * steering (NOT Rapier's raycast-vehicle). `drive()` only records the
 * inputs; the speed / heading integration and the velocity write happen
 * inside PhysicsWorld.step() at the fixed 1/60 s timestep, so the car
 * behaves identically at any frame rate. Steering / braking /
 * collision / parking only; top speed 40 km/h; collides with buildings
 * + ground. Hitting a wall stops the car (see postStep).
 */
export function createVehicle(
  w: PhysicsWorld,
  x: number,
  z: number,
  heading: number,
): VehicleBody {
  const body = w.world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, VEHICLE_BODY_Y, z)
      .setLinearDamping(0)
      .lockRotations()
      .setCcdEnabled(true),
  );
  // ~1180 kg: cuboid volume 1.8 * 1.2 * 4.2 = 9.07 m^3 at 130 kg/m^3.
  w.world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      VEHICLE_HALF_EXTENTS.x,
      VEHICLE_HALF_EXTENTS.y,
      VEHICLE_HALF_EXTENTS.z,
    )
      .setFriction(0.6)
      .setRestitution(0)
      .setDensity(130),
    body,
  );

  let currentHeading = heading;
  let speed = 0; // signed m/s along the forward axis
  let steer = 0;
  let throttle = 0;
  let brake = false;

  function forward(): { x: number; z: number } {
    return { x: Math.cos(currentHeading), z: Math.sin(currentHeading) };
  }

  const controller: WorldController = {
    preStep(dt: number): void {
      if (brake) {
        speed = approach(speed, 0, VEHICLE_BRAKE_DECEL * dt);
      } else {
        const target =
          throttle >= 0
            ? throttle * VEHICLE_MAX_SPEED
            : Math.max(throttle * VEHICLE_MAX_SPEED, -VEHICLE_MAX_REVERSE);
        const rate =
          target > speed
            ? VEHICLE_ACCEL
            : throttle === 0
              ? VEHICLE_COAST_DECEL
              : VEHICLE_DECEL;
        speed = approach(speed, target, rate * dt);
      }
      if (Math.abs(speed) > 0.05) {
        currentHeading +=
          steer *
          VEHICLE_STEER_RATE *
          Math.min(1, Math.abs(speed) / 6) *
          Math.sign(speed) *
          dt;
      }
      const f = forward();
      const v = body.linvel();
      body.setLinvel({ x: f.x * speed, y: v.y, z: f.z * speed }, true);
      body.setRotation(headingToQuaternion(currentHeading), true);
    },
    postStep(): void {
      const f = forward();
      const v = body.linvel();
      const actual = v.x * f.x + v.z * f.z;
      // The solver killed our forward motion: we are pressed against
      // something (usually a building). Drop the scripted speed to the
      // actual speed so the car stops instead of grinding the wall.
      if (speed > 0.5 && actual < speed * 0.6) speed = Math.max(0, actual);
      else if (speed < -0.5 && actual > speed * 0.6)
        speed = Math.min(0, actual);
    },
  };

  const controllers = controllersByWorld.get(w.world);
  if (controllers) controllers.push(controller);

  function position(): { x: number; y: number; z: number } {
    const t = body.translation();
    return { x: t.x, y: t.y, z: t.z };
  }

  return {
    position,
    heading(): number {
      return currentHeading;
    },
    speedKmh(): number {
      const v = body.linvel();
      return Math.hypot(v.x, v.z) * 3.6;
    },
    drive(nextSteer: number, nextThrottle: number, nextBrake: boolean): void {
      steer = clamp01(nextSteer);
      throttle = clamp01(nextThrottle);
      brake = nextBrake;
    },
  };
}
