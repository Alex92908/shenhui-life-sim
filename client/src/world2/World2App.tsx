// Bay Area Life 2.0 — Stage 1 slice: React entry + game loop + HUD.
//
// Opens ONLY via the #world2 hash (main.tsx). The legacy start screen
// is untouched. Full-window canvas + HUD (objective, timer, money,
// till, NPC talk panel, shop panel, controls help, F3 perf HUD from
// render/hud.ts).
//
// Real wiring (Stage 1, no stubs left in the boot path):
//   city    — ../cityData loadSliceCity() (slice-city.json, bbox B,
//             OSM base 2026-11-13T05:58:28Z; 30 buildings, 20 roads,
//             340 walkable polygons; kind split residential 28 /
//             commercial 1 / public 1 — no office-tagged building, so
//             the office role is the commercial tower 尚美科技大厦).
//   physics — ../physics createPhysicsWorld + ground + building
//             colliders (AABB per building) + capsule + arcade vehicle.
//   nav     — ../nav buildNavMesh(city.walkable, city.buildings) +
//             createCrowd (Recast + Detour).
//   render  — ../render/scene.ts (createWorld2Scene: renderer, camera,
//             lights, fog, ground, sky) + ../render/buildings
//             (buildBuildings + doorPositionFor), ../render/roads
//             (buildRoads), ../render/streaming (createChunkStreamer),
//             ../render/hud (createPerfHud). Map mode uses one merged
//             buildBuildings(city) group instead of the per-chunk
//             streamer (streaming.ts header note).
//
// Known seams (documented, not hidden):
// - Rapier PlayerBody has no teleport/setTranslation in the Stage-1
//   contract, so interior entry/exit and vehicle exit move the player
//   by RESPAWNING the capsule (respawnPlayer below: dispose the
//   controller, create a fresh capsule at the target, re-create the
//   controller around the same actor). If physics.ts later gains a
//   teleport, replace respawnPlayer — one call site.
// - The interior pocket (2000, 2000) lies outside the 700 m visual
//   ground plane, so the physics ground is built 5000 m wide to cover
//   it; the rooms are enclosed, so the missing visual ground there is
//   invisible from inside.
// - Building colliders are AABBs (physics.ts): for rotated/L-shaped
//   footprints the collider face can sit metres from the visual wall,
//   so door trigger points are pushed out along the door normal until
//   they clear the AABB (doorTriggerFor below).

import { useEffect, useRef, useState } from "react";
import type { MutableRefObject, ReactNode } from "react";
import * as THREE from "three";
import { loadSliceCity } from "./cityData";
import type { SliceBuilding, SliceCity, SliceRoad } from "./cityData";
import {
  addBuildingColliders,
  addGroundPlane,
  createPhysicsWorld,
  createPlayerCapsule,
  createVehicle,
} from "./physics";
import type { PhysicsWorld, PlayerBody } from "./physics";
import { buildNavMesh, createCrowd, loadNavMeshFromBase64 } from "./nav";
import type { Crowd, NavMesh } from "./nav";
import {
  buildBuildings,
  createBuildingMaterials,
  disposeBuildingMaterials,
  disposeBuildings,
  doorPositionFor,
} from "./render/buildings";
import { buildRoads, disposeRoads } from "./render/roads";
import {
  chunkKeyOf,
  chunkRectOf,
  createChunkStreamer,
} from "./render/streaming";
import type { ChunkStreamer } from "./render/streaming";
import { createPerfHud } from "./render/hud";
import type { PerfHud } from "./render/hud";
import { createWorld2Scene } from "./render/scene";
import type { World2Scene } from "./render/scene";
import {
  CHARACTER_VARIANT,
  loadCharacterRig,
  createCharacterController,
} from "./gameplay/character";
import type { CharacterActor, CharacterController, Vec3Like } from "./gameplay/character";
import { createVehicleController } from "./gameplay/vehicle";
import type { VehicleController } from "./gameplay/vehicle";
import { buildSliceCast, createNpcGroup } from "./gameplay/npcs";
import type { NpcActorState, NpcGroup } from "./gameplay/npcs";
import { createDeliveryTask, createSliceLedger } from "./gameplay/task";
import type { DeliveryTask, SliceLedger } from "./gameplay/task";
import { createShop } from "./gameplay/shop";
import type { Shop } from "./gameplay/shop";
import { createInteriors } from "./gameplay/interiors";
import type { EnterableDef, Interiors } from "./gameplay/interiors";
import type { ChatAction } from "../npc";

// ---------------------------------------------------------------------------
// Real slice anchors — derived from slice-city.json, not invented.
// ---------------------------------------------------------------------------

function centroidOf(footprint: [number, number][]): { x: number; z: number } {
  let x = 0;
  let z = 0;
  for (const [px, pz] of footprint) {
    x += px;
    z += pz;
  }
  const n = Math.max(1, footprint.length);
  return { x: x / n, z: z / n };
}

function footprintAABB(footprint: [number, number][]): { minX: number; maxX: number; minZ: number; maxZ: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of footprint) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, maxX, minZ, maxZ };
}

/**
 * Door trigger point for an enterable building: doorPositionFor gives
 * the midpoint of the longest edge + outward normal (on the wall). The
 * player can never reach the wall itself — the AABB collider stops them
 * at the AABB face — so march out along the normal until clear of the
 * AABB, plus 0.75 m. (For 尚美科技大厦 the wall sits ~5 m inside the
 * AABB face; this is the documented AABB over-approximation.)
 */
function doorTriggerFor(b: SliceBuilding): { door: Vec3Like; normal: { x: number; z: number } } {
  const d = doorPositionFor(b);
  const bb = footprintAABB(b.footprint);
  let t = 0;
  for (;;) {
    const x = d.x + d.nx * t;
    const z = d.z + d.nz * t;
    if (x < bb.minX - 0.5 || x > bb.maxX + 0.5 || z < bb.minZ - 0.5 || z > bb.maxZ + 0.5) break;
    t += 0.5;
    if (t > 60) break; // never loop forever on degenerate data
  }
  t += 0.75;
  return {
    door: { x: d.x + d.nx * t, y: 0, z: d.z + d.nz * t },
    normal: { x: d.nx, z: d.nz },
  };
}

const INTERIOR_SIZE: Record<string, { w: number; d: number; h: number }> = {
  office: { w: 14, d: 10, h: 3.6 },
  shop: { w: 12, d: 9, h: 3.4 },
  lobby: { w: 12, d: 9, h: 3.4 },
};

/** The named road whose centreline passes nearest a point. */
function nearestRoadTo(roads: SliceRoad[], name: string, p: Vec3Like): SliceRoad | undefined {
  let best: SliceRoad | undefined;
  let bestD = Infinity;
  for (const r of roads) {
    if (r.name !== name) continue;
    for (const q of r.points) {
      const d = Math.hypot(q[0] - p.x, q[1] - p.z);
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
  }
  return best;
}

interface SliceAnchors {
  office: Vec3Like;
  shop: Vec3Like;
  lobby: Vec3Like;
  plaza: Vec3Like;
  residential: Vec3Like;
  street: Vec3Like[];
  playerSpawn: Vec3Like;
  carSpawn: { x: number; z: number; heading: number };
}

function deriveAnchors(city: SliceCity): { enterables: EnterableDef[]; anchors: SliceAnchors } {
  const enterableBuildings = city.buildings.filter((b) => b.enterable !== null);
  const byRole = (role: string): SliceBuilding => {
    const b = enterableBuildings.find((x) => x.enterable?.role === role);
    if (!b) throw new Error(`[world2] slice-city.json has no enterable building with role ${role}`);
    return b;
  };
  const officeB = byRole("office"); // 尚美科技大厦 (commercial tag, office role)
  const shopB = byRole("shop"); // 8号楼 (residential tower, podium retail)
  const lobbyB = byRole("lobby"); // kindergarten, unnamed in OSM
  const displayName = (b: SliceBuilding): string =>
    b.name ?? (b.enterable?.role === "lobby" ? "幼儿园" : "未命名建筑");
  const toEnterable = (b: SliceBuilding): EnterableDef => {
    const dt = doorTriggerFor(b);
    return {
      id: b.id,
      name: displayName(b),
      role: b.enterable!.role,
      door: dt.door,
      normal: dt.normal,
      size: INTERIOR_SIZE[b.enterable!.role] ?? { w: 12, d: 9, h: 3.4 },
    };
  };
  const enterables = [officeB, shopB, lobbyB].map(toEnterable);
  const officeDoor = enterables[0]!.door;
  const shopDoor = enterables[1]!.door;
  const lobbyDoor = enterables[2]!.door;

  // Plaza: midpoint between the shop door and the office door.
  const plaza: Vec3Like = {
    x: (shopDoor.x + officeDoor.x) / 2,
    y: 0,
    z: (shopDoor.z + officeDoor.z) / 2,
  };
  // Residential anchor: centroid of the residential building nearest the plaza.
  let residential = { x: 0, y: 0, z: 0 };
  let bestD = Infinity;
  for (const b of city.buildings) {
    if (b.kind !== "residential") continue;
    const c = centroidOf(b.footprint);
    const d = Math.hypot(c.x - plaza.x, c.z - plaza.z);
    if (d < bestD) {
      bestD = d;
      residential = { x: c.x, y: 0, z: c.z };
    }
  }
  // Street points + car spawn: the 大冲六路 way that passes NEAREST
  // the shop door (not the longest one — the longest 大冲六路 way runs
  // x 165–323, ~220 m east of the shop; the near one passes right by it).
  const dachong = nearestRoadTo(city.roads, "大冲六路", shopDoor);
  let street: Vec3Like[] = [];
  if (dachong && dachong.points.length >= 4) {
    const pts = dachong.points;
    const pick = (f: number): Vec3Like => {
      const p = pts[Math.min(pts.length - 1, Math.floor(f * (pts.length - 1)))]!;
      return { x: p[0], y: 0, z: p[1] };
    };
    street = [pick(0.05), pick(0.35), pick(0.65), pick(0.95)];
  } else {
    street = [
      { x: plaza.x - 40, y: 0, z: plaza.z },
      { x: plaza.x + 40, y: 0, z: plaza.z },
      { x: plaza.x, y: 0, z: plaza.z - 40 },
      { x: plaza.x, y: 0, z: plaza.z + 40 },
    ];
  }
  // Player spawn: between the shop and the office, closer to the office.
  const playerSpawn: Vec3Like = {
    x: shopDoor.x + (officeDoor.x - shopDoor.x) * 0.6,
    y: 0,
    z: shopDoor.z + (officeDoor.z - shopDoor.z) * 0.6,
  };
  // Car spawn: the 大冲六路 centreline point nearest the shop door,
  // heading along the road.
  let carSpawn = { x: shopDoor.x + 10, z: shopDoor.z, heading: 0 };
  if (dachong) {
    let best: [number, number] | null = null;
    let bestI = 0;
    let bd = Infinity;
    dachong.points.forEach((p, i) => {
      const d = Math.hypot(p[0] - shopDoor.x, p[1] - shopDoor.z);
      if (d < bd) {
        bd = d;
        best = p;
        bestI = i;
      }
    });
    if (best) {
      const next = dachong.points[Math.min(dachong.points.length - 1, bestI + 1)]!;
      const prev = dachong.points[Math.max(0, bestI - 1)]!;
      const dx = next[0] - prev[0];
      const dz = next[1] - prev[1];
      carSpawn = {
        x: best[0],
        z: best[1],
        heading: Math.atan2(dz, dx), // physics: forward = (cos h, sin h)
      };
    }
  }
  return {
    enterables,
    anchors: { office: officeDoor, shop: shopDoor, lobby: lobbyDoor, plaza, residential, street, playerSpawn, carSpawn },
  };
}

// ---------------------------------------------------------------------------
// Touch joystick — same geometry as the legacy StreetStick in MapView
// (112 px base / 54 px knob, pointer capture, x = strafe, y = forward).
// ---------------------------------------------------------------------------

function World2Stick({ stick }: { stick: MutableRefObject<{ x: number; y: number }> }) {
  const [k, setK] = useState({ x: 0, y: 0 });
  const R = 36;
  const update = (e: React.PointerEvent<HTMLDivElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    let x = e.clientX - cx;
    let y = e.clientY - cy;
    const m = Math.hypot(x, y);
    if (m > R) {
      x = (x / m) * R;
      y = (y / m) * R;
    }
    setK({ x, y });
    stick.current.x = x / R;
    stick.current.y = -y / R;
  };
  const release = () => {
    setK({ x: 0, y: 0 });
    stick.current.x = 0;
    stick.current.y = 0;
  };
  return (
    <div
      aria-label="方向摇杆：按住拖动走路，推到底跑"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        update(e);
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        release();
      }}
      onPointerCancel={release}
      className="pointer-events-auto absolute bottom-40 left-6 z-20 h-[112px] w-[112px] touch-none select-none"
    >
      <div className="pointer-events-none absolute inset-0 rounded-full border border-white/45 bg-black/30 shadow-[inset_0_0_0_12px_rgba(255,255,255,0.07)] backdrop-blur-[2px]" />
      <div
        className="pointer-events-none absolute h-[54px] w-[54px] rounded-full border border-white/80 bg-white/88 shadow-[0_6px_16px_rgba(0,0,0,0.35)]"
        style={{ left: `calc(50% + ${k.x}px)`, top: `calc(50% + ${k.y}px)`, transform: "translate(-50%, -50%)" }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// HUD types + game ref (module scope so the loop and the E handler share it)
// ---------------------------------------------------------------------------

interface GameRef {
  ledger: SliceLedger;
  task: DeliveryTask;
  shop: Shop;
  npcs: NpcGroup | null;
  interiors: Interiors | null;
  vehicle: VehicleController | null;
  character: CharacterController | null;
  rigKind: string;
}

interface HudState {
  money: number;
  till: number;
  objective: string;
  timeLeftMs: number;
  taskState: string;
  prompt: string | null;
  driving: boolean;
  speedKmh: number;
  inside: string | null;
  rigKind: string;
  meshKind: string;
  toast: string | null;
}

interface TalkLine {
  who: string;
  text: string;
}

interface TalkState {
  npc: NpcActorState;
  lines: TalkLine[];
}

const CHAT_ACTIONS: { id: ChatAction; label: string; playerLine: string }[] = [
  { id: "greet", label: "👋 打招呼", playerLine: "嗨，最近怎么样？" },
  { id: "weather", label: "🌤️ 聊天气", playerLine: "今天这天儿，你觉得怎么样？" },
  { id: "work", label: "💼 聊工作", playerLine: "最近活儿忙不忙？" },
  { id: "joke", label: "😂 讲笑话", playerLine: "为什么程序员分不清万圣节和圣诞节？因为 Oct 31 == Dec 25。" },
];

function nearPoint(p: Vec3Like, q: Vec3Like, r: number): boolean {
  return Math.hypot(p.x - q.x, p.z - q.z) <= r;
}

// ---------------------------------------------------------------------------
// World2App
// ---------------------------------------------------------------------------

export function World2App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef({ x: 0, y: 0 });
  const gameRef = useRef<GameRef | null>(null);
  const talkOpenRef = useRef(false);
  const shopOpenRef = useRef(false);
  const cleanupRef = useRef(() => {});
  const [hud, setHud] = useState<HudState>({
    money: 500,
    till: 0,
    objective: "加载中…",
    timeLeftMs: 0,
    taskState: "idle",
    prompt: null,
    driving: false,
    speedKmh: 0,
    inside: null,
    rigKind: "…",
    meshKind: "…",
    toast: null,
  });
  const [talk, setTalk] = useState<TalkState | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopTick, setShopTick] = useState(0);
  talkOpenRef.current = talk !== null;
  shopOpenRef.current = shopOpen;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let raf = 0;

    const city = loadSliceCity();
    const { enterables, anchors } = deriveAnchors(city);
    const officeDoor = anchors.office;
    const shopDoor = anchors.shop;

    const ledger = createSliceLedger(500);
    const task = createDeliveryTask({
      pickupLabel: "湾区小文的糖水铺",
      dropoffLabel: "尚美科技大厦大堂",
      ledger,
      onEvent: (event) => {
        if (event === "accepted") gameRef.current?.npcs?.sendCourierTo(shopDoor);
        if (event === "pickedUp") gameRef.current?.npcs?.sendCourierTo(officeDoor);
      },
    });
    const shop = createShop({ ledger, name: "湾区小文的糖水铺", kind: "tangshui" });
    const g: GameRef = {
      ledger,
      task,
      shop,
      npcs: null,
      interiors: null,
      vehicle: null,
      character: null,
      rigKind: "…",
    };
    gameRef.current = g;

    // E / interact priority: vehicle exit > interior exit > shop panel >
    // vehicle enter > NPC talk > task pickup/dropoff > building door.
    // Body moves (enter/exit interior, step out of the car) go through
    // respawnPlayer — the physics contract has no teleport.
    const doInteract = () => {
      const game = gameRef.current;
      if (!game?.character || !game.interiors || !game.vehicle || !game.npcs) return;
      const playerPos = game.character.position();
      if (game.vehicle.driving) {
        if (game.vehicle.exit()) {
          const out = game.vehicle.getExitPosition();
          respawnPlayer(out.x, out.z);
          gameRef.current?.character?.setActorVisible(true);
          setHud((h) => ({ ...h, toast: "下了车" }));
        }
        return;
      }
      if (game.interiors.inside) {
        if (game.interiors.nearExit(playerPos)) {
          const out = game.interiors.exit();
          if (out) {
            respawnPlayer(out.x, out.z);
            setHud((h) => ({ ...h, toast: "走出大楼" }));
          }
          return;
        }
        if (game.interiors.current?.role === "shop") {
          setShopOpen(true);
          return;
        }
        return;
      }
      if (game.vehicle.tryEnter()) {
        game.character.setActorVisible(false);
        setHud((h) => ({ ...h, toast: "上了车 · WASD 开车，空格手刹，E 下车" }));
        return;
      }
      const near = game.npcs.nearest(playerPos, 2.5);
      if (near) {
        const greet = game.npcs.greet(near.id);
        setTalk({
          npc: near,
          lines: greet ? [{ who: near.name, text: greet }] : [],
        });
        return;
      }
      if (game.task.state === "accepted" && nearPoint(playerPos, shopDoor, 3.5)) {
        const r = game.task.markPickedUp();
        setHud((h) => ({ ...h, toast: r.ok ? "取到件了，送往写字楼" : (r.error ?? "") }));
        return;
      }
      if (game.task.state === "pickedUp" && nearPoint(playerPos, officeDoor, 3.5)) {
        const r = game.task.markDelivered();
        setHud((h) => ({ ...h, toast: r.ok ? "送达！点「结算」领报酬" : (r.error ?? "") }));
        return;
      }
      const door = game.interiors.nearDoor(playerPos);
      if (door) {
        const spawn = game.interiors.enter(door.id);
        if (spawn) {
          respawnPlayer(spawn.x, spawn.z);
          setHud((h) => ({ ...h, toast: `进了${door.name}` }));
        }
      }
    };

    // Mutable player body + controller: respawnPlayer swaps both when
    // the player must move somewhere the capsule cannot walk to (an
    // interior pocket, or the car's side). The actor group is reused.
    let body: PlayerBody | null = null;
    let character: CharacterController | null = null;
    let actor: CharacterActor | null = null;
    let physicsWorld: PhysicsWorld | null = null;
    // Camera yaw comes from the scene (render/scene.ts owns the camera).
    let w2scene: World2Scene | null = null;
    const makeCharacter = (b: PlayerBody): CharacterController => {
      if (!actor) throw new Error("[world2] makeCharacter before rig loaded");
      return createCharacterController({
        body: b,
        actor,
        getCameraYaw: () => w2scene?.getCameraYaw() ?? Math.PI,
        stick: stickRef.current,
        onInteract: doInteract,
        enabled: () => !talkOpenRef.current && !shopOpenRef.current,
      });
    };
    const respawnPlayer = (x: number, z: number) => {
      if (!physicsWorld || !actor) return;
      character?.dispose();
      body = createPlayerCapsule(physicsWorld, x, z);
      character = makeCharacter(body);
      if (gameRef.current) gameRef.current.character = character;
    };

    // Shared building materials (one set for the streamer chunks AND
    // the merged map-mode group — never disposed per chunk).
    const materials = createBuildingMaterials();

    // Street/map mode. Map mode uses ONE merged buildBuildings(city)
    // group (~13 draw calls) instead of the per-chunk streamer (~436)
    // — streaming.ts header note. The streamer only runs in street
    // mode: it is disposed on entering map mode and recreated (cheap —
    // chunk builds are synchronous, median 0.3 ms) on returning.
    let cameraMode: "street" | "map" = "street";
    let streamer: ChunkStreamer | null = null;
    let mergedGroup: THREE.Group | null = null;
    const createStreamer = (focus: { x: number; z: number }): ChunkStreamer => {
      if (!w2scene) throw new Error("[world2] createStreamer before scene");
      const s = createChunkStreamer(
        w2scene.scene,
        city,
        (key) => buildBuildings(city, materials, { clipRect: chunkRectOf(key), propRect: chunkRectOf(key) }),
      );
      s.buildNow(chunkKeyOf(focus.x, focus.z));
      w2scene.attachChunkStreamer(s);
      return s;
    };
    const setCameraMode = (m: "street" | "map") => {
      if (m === cameraMode || !w2scene) return;
      cameraMode = m;
      if (m === "map") {
        streamer?.dispose();
        streamer = null;
        w2scene.attachChunkStreamer(null);
        if (mergedGroup) mergedGroup.visible = true;
        w2scene.setMode("map");
      } else {
        if (mergedGroup) mergedGroup.visible = false;
        streamer = createStreamer(body?.position() ?? anchors.playerSpawn);
        w2scene.setMode("street");
      }
    };

    const boot = async () => {
      // Physics first (Rapier WASM init), then nav: the pre-baked
      // navmesh (data/navmesh.b64.ts, baked by standalone/bake_navmesh.mts
      // from the same slice-city.json) loads instantly; if it is missing
      // or stale it falls back to a runtime Recast build (~1 s on a quiet
      // machine — the 19–26 s seen during integration was measured while
      // five agents shared 1.5 CPUs; do not trust it as the true cost).
      const w = await createPhysicsWorld();
      if (cancelled) {
        disposeBuildingMaterials(materials);
        w.dispose();
        return;
      }
      physicsWorld = w;
      addGroundPlane(w, 5000); // wide enough to cover the interior pocket
      addBuildingColliders(w, city.buildings);
      let nav: NavMesh;
      try {
        const { NAVMESH_B64, NAVMESH_META } = await import("./data/navmesh.b64");
        if (NAVMESH_META.timestamp_osm_base !== city.timestamp_osm_base) {
          throw new Error("baked navmesh is for a different slice-city.json");
        }
        nav = await loadNavMeshFromBase64(NAVMESH_B64);
      } catch (e) {
        console.warn("[world2] baked navmesh unavailable, building at runtime:", e);
        nav = await buildNavMesh(city.walkable, city.buildings);
      }
      if (cancelled) {
        disposeBuildingMaterials(materials);
        w.dispose();
        return;
      }
      const crowd: Crowd = createCrowd(nav, 16);

      // Scene (render/scene.ts owns renderer, camera, lights, fog,
      // ground, sky). The harness adds roads + buildings + streamer.
      const scene2 = createWorld2Scene(container, city);
      w2scene = scene2;
      const scene = scene2.scene;
      // Face the office tower on spawn: yaw so the camera looks from
      // the spawn toward 尚美科技大厦 (scene default yaw is π).
      scene2.setYaw(
        Math.atan2(
          -(officeDoor.x - anchors.playerSpawn.x),
          -(officeDoor.z - anchors.playerSpawn.z),
        ),
      );
      const roadsGroup = buildRoads(city);
      scene.add(roadsGroup);
      mergedGroup = buildBuildings(city, materials);
      mergedGroup.visible = false; // map mode only
      scene.add(mergedGroup);
      streamer = createStreamer(anchors.playerSpawn);

      // Perf HUD (render/hud.ts — owns its own F3 toggle + 5 s sampling).
      const perfHud: PerfHud = createPerfHud();

      // Player rig (CHARACTER_VARIANT, default Michelle) + the other
      // Mixamo variant so the NPC cast isn't 8 clones of one model.
      // Both loads run in parallel and share the anim-clip cache; a
      // missing Mixamo file falls back to Quaternius per variant, so
      // this never throws.
      const [rig, altRig] = await Promise.all([
        loadCharacterRig(),
        loadCharacterRig(CHARACTER_VARIANT === "michelle" ? "remy" : "michelle"),
      ]);
      if (cancelled) {
        perfHud.dispose();
        streamer?.dispose();
        if (mergedGroup) disposeBuildings(mergedGroup);
        disposeRoads(roadsGroup);
        disposeBuildingMaterials(materials);
        scene2.dispose();
        w.dispose();
        return;
      }
      g.rigKind = rig.kind;
      actor = rig.createActor({ faceSeed: "slice-player", shirt: 0x4a7fb5, pants: 0x3a3f4a });
      actor.group.position.set(anchors.playerSpawn.x, 0, anchors.playerSpawn.z);
      scene.add(actor.group);
      body = createPlayerCapsule(w, anchors.playerSpawn.x, anchors.playerSpawn.z);
      character = makeCharacter(body);
      g.character = character;

      // NPC anchors snapped onto the navmesh (doors can sit off-mesh).
      const snap = (p: Vec3Like): Vec3Like => {
        const q = nav.randomPointNear(p.x, p.z, 8);
        return q ? { x: q[0], y: 0, z: q[1] } : { ...p };
      };
      const npcAnchors = {
        office: snap(officeDoor),
        shop: snap(shopDoor),
        plaza: snap(anchors.plaza),
        residential: snap(anchors.residential),
        street: anchors.street.map(snap),
      };
      const npcs = createNpcGroup({
        scene,
        rig,
        rigs: [rig, altRig],
        crowd,
        nav,
        cast: buildSliceCast(npcAnchors),
        playerName: "小文",
      });
      g.npcs = npcs;
      const interiors = createInteriors({ scene, buildings: enterables });
      g.interiors = interiors;
      const vehicle = createVehicleController({
        scene,
        createVehicle: (x, z, h) => createVehicle(w, x, z, h),
        spawn: anchors.carSpawn,
        getPlayerPos: () => body?.position() ?? { x: 0, y: 0, z: 0 },
        onEnter: () => character?.setActorVisible(false),
        onExit: () => character?.setActorVisible(true),
      });
      g.vehicle = vehicle;

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key.toLowerCase() === "v") {
          setCameraMode(cameraMode === "street" ? "map" : "street");
        }
      };
      window.addEventListener("keydown", onKeyDown);

      let last = performance.now();
      let hudAcc = 1;
      let perfAcc = 0;
      const frame = (nowMs: number) => {
        if (cancelled || !body || !character) return;
        const dt = Math.min(0.05, Math.max(0.001, (nowMs - last) / 1000));
        last = nowMs;
        w.step(dt);
        const driving = vehicle.driving;
        if (driving) {
          vehicle.update(dt);
        } else {
          character.update(dt);
          vehicle.update(dt); // parked car: mesh sync only
        }
        npcs.update(dt);
        task.tick();
        interiors.update(body.position());
        const focus = driving ? vehicle.body.position() : body.position();
        // While inside, the street streamer is skipped (interiors.ts):
        // the pocket is not street content, and re-sync on exit rebuilds
        // the street around the door.
        if (!interiors.inside && streamer) streamer.update({ x: focus.x, z: focus.z });
        scene2.update(dt, focus);
        hudAcc += dt;
        if (hudAcc >= 0.15) {
          hudAcc = 0;
          setHud((h) => ({
            ...h,
            money: ledger.money,
            till: shop.till,
            objective: task.objective(),
            timeLeftMs: task.timeLeftMs(),
            taskState: task.state,
            prompt: computePrompt(g, body!.position(), shopDoor, officeDoor),
            driving,
            speedKmh: driving ? vehicle.body.speedKmh() : 0,
            inside: interiors.current?.name ?? null,
            rigKind: rig.kind,
            meshKind: vehicle.meshKind,
          }));
        }
        perfAcc += dt;
        if (perfAcc >= 0.25) {
          perfAcc = 0;
          perfHud.sample(scene2.stats());
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);

      // Dev handle, same spirit as 1.0's window.__chunks.
      (window as unknown as { __world2?: unknown }).__world2 = {
        stats: () => ({
          ...scene2.stats(),
          money: ledger.money,
          till: shop.till,
          task: task.state,
        }),
      };

      cleanupRef.current = () => {
        window.removeEventListener("keydown", onKeyDown);
        cancelAnimationFrame(raf);
        character?.dispose();
        vehicle.dispose();
        npcs.dispose();
        interiors.dispose();
        actor?.dispose();
        perfHud.dispose();
        streamer?.dispose();
        if (mergedGroup) disposeBuildings(mergedGroup);
        disposeRoads(roadsGroup);
        disposeBuildingMaterials(materials);
        scene2.dispose();
        w.dispose();
      };
    };
    void boot();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      cleanupRef.current();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmtTime = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  const onTalkAction = (action: ChatAction) => {
    const game = gameRef.current;
    if (!game?.npcs || !talk) return;
    const res = game.npcs.talk(talk.npc.id, action);
    if (!res) return;
    const def = CHAT_ACTIONS.find((a) => a.id === action);
    setTalk((t) =>
      t
        ? {
            ...t,
            lines: [
              ...t.lines,
              { who: "你", text: def?.playerLine ?? "" },
              { who: t.npc.name, text: res.reply },
            ],
          }
        : t,
    );
  };

  const onBuy = (itemId: string) => {
    const game = gameRef.current;
    if (!game) return;
    const r = game.shop.buy(itemId);
    setHud((h) => ({ ...h, toast: r.ok ? `买到了，花了 ¥${r.price}` : (r.error ?? "买失败") }));
    setShopTick((t) => t + 1);
  };

  const onCollect = () => {
    const game = gameRef.current;
    if (!game) return;
    const r = game.shop.collect();
    setHud((h) => ({
      ...h,
      toast: r.amount > 0 ? `收钱 ¥${r.playerShare}（合伙人分成 ¥${r.partnerShare}）` : "till 是空的",
    }));
    setShopTick((t) => t + 1);
  };

  const onAcceptTask = () => {
    const game = gameRef.current;
    if (!game) return;
    const r = game.task.accept();
    setHud((h) => ({ ...h, toast: r.ok ? "接单了，去糖水铺取件" : (r.error ?? "") }));
  };

  const onSettleTask = () => {
    const game = gameRef.current;
    if (!game) return;
    const r = game.task.settle();
    setHud((h) => ({ ...h, toast: r.ok ? `结算 +¥${game.task.reward}` : (r.error ?? "") }));
  };

  const goBackTo10 = () => {
    window.location.hash = "";
    window.location.reload();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0b0f14", color: "#fff", fontFamily: "system-ui, sans-serif", overflow: "hidden" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      <World2Stick stick={stickRef} />

      {/* Top bar */}
      <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start", pointerEvents: "none", zIndex: 30 }}>
        <div style={{ pointerEvents: "auto", background: "rgba(0,0,0,0.55)", borderRadius: 12, padding: "8px 12px", backdropFilter: "blur(4px)" }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>湾区人生 2.0 · 深圳切片</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>南山科技园 500m × 500m · Stage 1</div>
        </div>
        <div style={{ display: "flex", gap: 8, pointerEvents: "auto" }}>
          <div style={{ background: "rgba(0,0,0,0.55)", borderRadius: 12, padding: "8px 12px", fontSize: 13 }}>
            💰 ¥{hud.money} · 🧾 till ¥{hud.till}
          </div>
          <button type="button" onClick={goBackTo10} style={{ background: "rgba(0,0,0,0.55)", color: "#fff", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 12, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>
            ← 回 1.0
          </button>
        </div>
      </div>

      {/* Objective */}
      <div style={{ position: "absolute", top: 76, left: 12, zIndex: 30, background: "rgba(0,0,0,0.55)", borderRadius: 12, padding: "10px 12px", maxWidth: 340, backdropFilter: "blur(4px)" }}>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>{hud.objective}</div>
        {hud.timeLeftMs > 0 && (
          <div style={{ fontSize: 13, marginTop: 4 }}>⏱️ 剩余 {fmtTime(hud.timeLeftMs)}</div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {(hud.taskState === "idle" || hud.taskState === "expired") && (
            <button type="button" onClick={onAcceptTask} style={btnStyle}>📦 接单</button>
          )}
          {hud.taskState === "delivered" && (
            <button type="button" onClick={onSettleTask} style={btnStyle}>💰 结算 +¥36</button>
          )}
        </div>
        {hud.inside && <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>📍 在「{hud.inside}」室内 · 走到门口按 E 出去</div>}
        {hud.driving && <div style={{ fontSize: 12, opacity: 0.9, marginTop: 6 }}>🚗 开车中 {hud.speedKmh.toFixed(0)} km/h（限速 40）· 空格手刹 · E 下车</div>}
      </div>

      {/* E prompt */}
      {hud.prompt && (
        <div style={{ position: "absolute", bottom: 170, left: "50%", transform: "translateX(-50%)", zIndex: 30, background: "rgba(0,0,0,0.65)", borderRadius: 10, padding: "8px 14px", fontSize: 14 }}>
          {hud.prompt}
        </div>
      )}

      {/* Toast */}
      {hud.toast && (
        <div style={{ position: "absolute", bottom: 120, left: "50%", transform: "translateX(-50%)", zIndex: 30, background: "rgba(20,60,30,0.85)", borderRadius: 10, padding: "8px 14px", fontSize: 13 }}>
          {hud.toast}
        </div>
      )}

      {/* Controls help */}
      <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 30, background: "rgba(0,0,0,0.5)", borderRadius: 10, padding: "8px 10px", fontSize: 12, lineHeight: 1.7, opacity: 0.9 }}>
        WASD/方向键走路 · Shift 跑 · 空格跳 · E 互动 · 拖动旋转镜头 · V 地图/街景 · F3 性能
        <br />角色 {hud.rigKind === "glb" ? "GLB" : hud.rigKind === "primitive" ? " primitives（GLB 未装入）" : "…"} · 车 {hud.meshKind === "glb" ? "GLB" : hud.meshKind === "primitive" ? "primitives" : "…"}
      </div>

      {/* Talk panel */}
      {talk && (
        <Panel title={`${talk.npc.emoji} ${talk.npc.name} · ${talk.npc.job}`} onClose={() => setTalk(null)}>
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>作息：{talk.npc.schedule}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto", marginBottom: 10 }}>
            {talk.lines.map((l, i) => (
              <div key={i} style={{ fontSize: 13, lineHeight: 1.6 }}>
                <b>{l.who}：</b>{l.text}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {CHAT_ACTIONS.map((a) => (
              <button key={a.id} type="button" onClick={() => onTalkAction(a.id)} style={btnStyle}>{a.label}</button>
            ))}
          </div>
        </Panel>
      )}

      {/* Shop panel */}
      {shopOpen && gameRef.current && (
        <Panel title={`🍧 ${gameRef.current.shop.name}`} onClose={() => setShopOpen(false)}>
          <div key={shopTick} style={{ fontSize: 13, marginBottom: 8 }}>
            till ¥{gameRef.current.shop.till} · 已卖 {gameRef.current.shop.sales} 单 · 买的钱进 till，收钱才进钱包
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {gameRef.current.shop.menu.map((item) => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
                <span>{item.name}</span>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span>¥{item.price}</span>
                  <button type="button" onClick={() => onBuy(item.id)} style={btnStyle}>买</button>
                </span>
              </div>
            ))}
          </div>
          <button type="button" onClick={onCollect} style={{ ...btnStyle, marginTop: 12 }}>💰 收钱（till → 钱包）</button>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>单人切片：没有合伙人，分成 ¥0，你收全额。</div>
        </Panel>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "#e63a1f",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "7px 12px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div style={{ position: "absolute", right: 12, bottom: 12, zIndex: 40, width: 320, maxWidth: "calc(100vw - 24px)", background: "rgba(20,18,16,0.92)", borderRadius: 14, padding: 14, backdropFilter: "blur(6px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 8, padding: "2px 8px", cursor: "pointer" }}>✕</button>
      </div>
      {children}
    </div>
  );
}

/** The E-action label for the current context (same priority as doInteract). */
function computePrompt(g: GameRef, playerPos: Vec3Like, shopDoor: Vec3Like, officeDoor: Vec3Like): string | null {
  if (!g.character || !g.interiors || !g.vehicle || !g.npcs) return null;
  if (g.vehicle.driving) return "E · 下车";
  if (g.interiors.inside) {
    if (g.interiors.nearExit(playerPos)) return "E · 走出大楼";
    if (g.interiors.current?.role === "shop") return "E · 打开小店";
    return null;
  }
  if (g.vehicle.nearestDistance(playerPos) <= 3) return "E · 上车开车";
  const near = g.npcs.nearest(playerPos, 2.5);
  if (near) return `E · 和${near.name}聊天`;
  if (g.task.state === "accepted" && nearPoint(playerPos, shopDoor, 3.5)) return "E · 取件";
  if (g.task.state === "pickedUp" && nearPoint(playerPos, officeDoor, 3.5)) return "E · 送达";
  const door = g.interiors.nearDoor(playerPos);
  if (door) return `E · 进入${door.name}`;
  return null;
}
