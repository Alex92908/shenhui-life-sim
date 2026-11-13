// Bay Area Life 2.0 — Stage 1 slice: the 3 enterable buildings.
//
// Door trigger (walk near the door + E) + real 3D rooms — walls, floor
// and ceiling are meshes with a doorway, NOT a flat backdrop. Furniture
// is procedural primitives for now (desk / counter / shelves / chairs
// as boxes and cylinders).
//
// ZhuyaHome GLB furniture is NOT in this repo and cannot be pushed as
// binaries — swapping the primitive furniture builders for ZhuyaHome
// GLBs is a follow-up (same room shells, different contents).
//
// Switching pattern (ZhuyaHome walkthrough doc, cell-and-portal idea):
// only the current room renders at full detail; the other rooms are
// hidden (visible = false). Rooms live in an "interior pocket" far from
// the street (default x/z ~ +2000 m) so street geometry never collides
// with them, and entering respawns the physics capsule there (the
// Stage-1 physics contract has no teleport — see World2App
// respawnPlayer).
//
// Streamer choice: while inside, the street chunk streamer is DISABLED
// (World2App checks interiors.isInside() and skips streamer sync) —
// the interior is a pocket, the street is not visible from it, and
// re-syncing on exit rebuilds the street around the door. Exiting
// returns to the street at the door.

import * as THREE from "three";
import type { Vec3Like } from "./character";

export type InteriorRole = "office" | "shop" | "lobby";

export interface EnterableDef {
  id: string;
  name: string;
  role: InteriorRole;
  /** Street-side door position (meters, x east / z south). */
  door: Vec3Like;
  /** Outward normal of the door wall (unit xz) — exit steps out along it. */
  normal?: { x: number; z: number };
  /** Interior room size in meters. */
  size: { w: number; d: number; h: number };
}

export interface InteriorsOpts {
  scene: THREE.Scene;
  buildings: EnterableDef[];
  /** Interior pocket origin — rooms are laid out east of it, 60 m apart. */
  pocketOrigin?: { x: number; z: number };
}

export interface Interiors {
  readonly inside: boolean;
  readonly current: EnterableDef | null;
  /** Building whose street door the player is near (<= 2.5 m), else null. */
  nearDoor(playerPos: Vec3Like): EnterableDef | null;
  /** True when the player is near the interior exit door. */
  nearExit(playerPos: Vec3Like): boolean;
  /** Enter a building: returns the interior spawn for the player body. */
  enter(buildingId: string): { x: number; z: number } | null;
  /** Exit: returns the street door position for the player body. */
  exit(): { x: number; z: number } | null;
  update(playerPos: Vec3Like): void;
  dispose(): void;
}

export const DOOR_TRIGGER_RADIUS = 2.5;
const POCKET_SPACING = 60;

function mat(color: number, roughness = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

function box(
  w: number,
  h: number,
  d: number,
  color: number,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * A real room: floor, ceiling, 4 walls. The south wall (z = +d/2, the
 * side the player enters from) has a 1.4 m doorway: two segments + a
 * lintel above the door, so the player walks through a hole, not a wall.
 */
function buildRoomShell(w: number, d: number, h: number, wallColor: number, floorColor: number): THREE.Group {
  const g = new THREE.Group();
  const t = 0.2; // wall thickness
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, t, d), mat(floorColor, 0.95));
  floor.position.y = -t / 2;
  floor.receiveShadow = true;
  g.add(floor);
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(w, t, d), mat(0xf5f1e8, 0.95));
  ceil.position.y = h + t / 2;
  g.add(ceil);
  // North wall (z = -d/2), west, east — solid.
  const north = box(w, h, t, wallColor, 0, h / 2, -d / 2);
  const west = box(t, h, d, wallColor, -w / 2, h / 2, 0);
  const east = box(t, h, d, wallColor, w / 2, h / 2, 0);
  g.add(north, west, east);
  // South wall with a doorway (1.4 m wide, 2.4 m high, centred).
  const doorW = 1.4;
  const doorH = 2.4;
  const sideW = (w - doorW) / 2;
  const left = box(sideW, h, t, wallColor, -(doorW / 2 + sideW / 2), h / 2, d / 2);
  const right = box(sideW, h, t, wallColor, doorW / 2 + sideW / 2, h / 2, d / 2);
  const lintel = box(doorW, h - doorH, t, wallColor, 0, doorH + (h - doorH) / 2, d / 2);
  g.add(left, right, lintel);
  // A warm ceiling light so the room is never a black box.
  const light = new THREE.PointLight(0xffe8c0, 60, 30, 1.8);
  light.position.set(0, h - 0.4, 0);
  g.add(light);
  return g;
}

function officeFurniture(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  // Reception desk + chairs (the lobby), a desk + computer (the office room).
  g.add(box(3.2, 1.1, 0.8, 0x8a6d4b, 0, 0.55, -d / 2 + 1.2));
  g.add(box(1.6, 0.75, 0.8, 0x6b5a44, -w / 2 + 2.2, 0.375, d / 2 - 2));
  const screen = box(0.9, 0.55, 0.06, 0x1c2733, -w / 2 + 2.2, 1.05, d / 2 - 2.3);
  g.add(screen);
  for (const [x, z] of [[-1.5, 0.5], [1.5, 0.5], [0, 2.2]] as const) {
    g.add(box(0.55, 0.45, 0.55, 0x4a7fb5, x, 0.225, z));
    g.add(box(0.55, 0.5, 0.08, 0x4a7fb5, x, 0.7, z - 0.28));
  }
  // Plant by the door.
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.4, 12), mat(0xa85b32));
  pot.position.set(w / 2 - 1, 0.2, d / 2 - 1);
  pot.castShadow = true;
  g.add(pot);
  const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), mat(0x3d7a3a, 0.9));
  leaves.position.set(w / 2 - 1, 0.85, d / 2 - 1);
  leaves.castShadow = true;
  g.add(leaves);
  return g;
}

function shopFurniture(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  // Counter (the shopkeeper stands behind it) + shelves of goods + fridge.
  g.add(box(3.4, 1.05, 0.7, 0x7a4a2b, 0, 0.525, -d / 2 + 1.6));
  for (const sx of [-1, 1]) {
    const shelf = new THREE.Group();
    for (let level = 0; level < 3; level++) {
      shelf.add(box(2.6, 0.08, 0.5, 0x9a7b52, 0, 0.5 + level * 0.6, 0));
      for (let i = 0; i < 5; i++) {
        const jar = box(
          0.32, 0.34, 0.32,
          [0xe8b4b8, 0xf5d76e, 0x9fc4d8, 0xb8e0b0, 0xe8a87c][i % 5]!,
          -1 + i * 0.5, 0.72 + level * 0.6, 0,
        );
        shelf.add(jar);
      }
    }
    shelf.position.set(sx * (w / 2 - 1.8), 0, 1.5);
    g.add(shelf);
  }
  g.add(box(1.1, 1.9, 0.8, 0xdfe8ee, w / 2 - 1, 0.95, -d / 2 + 0.8));
  return g;
}

function lobbyFurniture(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  // Sofa + coffee table + notice board (the public / residential lobby).
  g.add(box(2.4, 0.5, 0.9, 0x5a6b7a, -1.5, 0.25, -d / 2 + 1.6));
  g.add(box(2.4, 0.5, 0.18, 0x5a6b7a, -1.5, 0.75, -d / 2 + 2.0));
  g.add(box(1.2, 0.4, 0.7, 0x8a6d4b, -1.5, 0.2, -d / 2 + 3.0));
  g.add(box(1.8, 1.2, 0.06, 0xf5f1e8, w / 2 - 0.15, 1.6, 0));
  g.add(box(1.6, 0.08, 1.0, 0x3d7a3a, 1.5, 0.04, 1.5));
  return g;
}

export function createInteriors(opts: InteriorsOpts): Interiors {
  const origin = opts.pocketOrigin ?? { x: 2000, z: 2000 };
  const rooms = new Map<string, { def: EnterableDef; group: THREE.Group; spawn: { x: number; z: number } }>();
  let currentId: string | null = null;

  opts.buildings.forEach((def, i) => {
    const px = origin.x + i * POCKET_SPACING;
    const pz = origin.z;
    const group = new THREE.Group();
    group.position.set(px, 0, pz);
    const wallColor = def.role === "shop" ? 0xf3e2c8 : def.role === "office" ? 0xdfe6ee : 0xe8e0d0;
    const floorColor = def.role === "shop" ? 0x9a7b52 : 0xb0a890;
    group.add(buildRoomShell(def.size.w, def.size.d, def.size.h, wallColor, floorColor));
    const furniture =
      def.role === "shop" ? shopFurniture(def.size.w, def.size.d)
      : def.role === "office" ? officeFurniture(def.size.w, def.size.d)
      : lobbyFurniture(def.size.w, def.size.d);
    group.add(furniture);
    // Door mat on the street side of the doorway, so the exit is findable.
    group.add(box(1.8, 0.04, 0.9, 0x8c2b2e, 0, 0.02, def.size.d / 2 + 0.4));
    group.visible = false; // cell-and-portal: only the current room shows.
    opts.scene.add(group);
    rooms.set(def.id, {
      def,
      group,
      // Spawn just inside the doorway (south side of the room).
      spawn: { x: px, z: pz + def.size.d / 2 - 1.2 },
    });
  });

  const interiors: Interiors = {
    get inside() {
      return currentId !== null;
    },
    get current() {
      return currentId ? rooms.get(currentId)?.def ?? null : null;
    },
    nearDoor(playerPos: Vec3Like) {
      if (currentId) return null;
      for (const def of opts.buildings) {
        if (Math.hypot(playerPos.x - def.door.x, playerPos.z - def.door.z) <= DOOR_TRIGGER_RADIUS) {
          return def;
        }
      }
      return null;
    },
    nearExit(playerPos: Vec3Like) {
      if (!currentId) return false;
      const room = rooms.get(currentId);
      if (!room) return false;
      // Exit door is the room's south doorway, in pocket coordinates.
      const doorX = room.group.position.x;
      const doorZ = room.group.position.z + room.def.size.d / 2;
      return Math.hypot(playerPos.x - doorX, playerPos.z - doorZ) <= DOOR_TRIGGER_RADIUS;
    },
    enter(buildingId: string) {
      const room = rooms.get(buildingId);
      if (!room) return null;
      for (const [id, r] of rooms) r.group.visible = id === buildingId;
      currentId = buildingId;
      return { ...room.spawn };
    },
    exit() {
      if (!currentId) return null;
      const room = rooms.get(currentId);
      if (!room) return null;
      room.group.visible = false;
      currentId = null;
      // Back to the street at the door, a step outside it along the
      // door wall's outward normal.
      const n = room.def.normal ?? { x: 0, z: 1 };
      return { x: room.def.door.x + n.x * 1.5, z: room.def.door.z + n.z * 1.5 };
    },
    update(_playerPos: Vec3Like) {
      // Rooms are static; the caller polls nearDoor/nearExit for the HUD.
      void _playerPos;
    },
    dispose() {
      for (const r of rooms.values()) {
        opts.scene.remove(r.group);
        r.group.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          const mat2 = (m as unknown as { material?: THREE.Material | THREE.Material[] }).material;
          if (Array.isArray(mat2)) mat2.forEach((x) => x.dispose());
          else if (mat2) mat2.dispose();
        });
      }
      rooms.clear();
      currentId = null;
    },
  };
  return interiors;
}
