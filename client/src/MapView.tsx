// PC high-end 3D map: a real Three.js low-poly miniature of Shenzhen /
// Huizhou. Locations sit at their real geographic bearings (airport NW,
// Shekou SW, Futian centre, Dameisha far east; Huicheng NW, Daya Bay and
// Shuangyue Bay along the southern coast), joined by the real road
// corridors (深南大道 / 滨海大道 / 北环大道 / 惠州大道 / 沿海高速 …) rendered
// as raised roadways with moving traffic. Desktop rendering: shadow-mapped
// sun, a slow day–night cycle with lit windows at dusk, instanced filler
// buildings and trees, animated bay water, orbit + zoom camera that follows
// the player. ROUND-2 (a): wider streets (roads ×1.35 at the source),
// a real-time water shader (waves + ripples + Fresnel + foam), refined
// traffic (headlights / brake lights / wheels / suspension bob), and live
// ambient life — circling birds, park butterflies, schooling fish, swaying
// trees — plus the 3D figures themselves as the characters (no floating
// avatar badges; the standard is the figure + a small name label).
// Clicking a building (or its label chip) walks there.
import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createLandmarks } from "./landmarks";
import {
  ROAD_W, buildCityData, generateChunkData, buildChunkMesh, buildSilhouetteGroup,
  createSharedChunkMats, applyPinganGlb, ChunkManager, removeAll, makeNearChecks,
  materializeChunk, chunkKeyOf,
  type ChunkPayload, type PlayerBuildingData, type FacadeTarget,
  type ChunkMaterializeCtx, type ChunkBuildResult, type ChunkRecord, type ShopPt,
} from "./chunks";
import { setCpuReleaseEnabled } from "./round2/texCpuRelease";
import { AREA_LABELS } from "./areas";
import { ACCESSORIES, HAIRS } from "./living";
import { makeFigure, faceSpecFor, addAccessory, disposeGroup, type FaceSpec } from "./figure";
import { activitiesAt } from "./activities";
import { SKYLINE } from "./skyline";
import * as TSZ from "./terrain-sz";
import * as THZ from "./terrain-hz";
import * as THK from "./terrain-hk";
import { ROADS as REAL_ROADS } from "./roads";
/* Real land / inland water / bridges / rivers per city (tools/terrain/gen_terrain.py). */
const TERRAIN: Record<CityKey, typeof THK> = { sz: TSZ, hz: THZ, hk: THK };
import { CITIES, LOC_EN, getLocations, resolveLoc, areaLocId, placesForCity, billboardSpots, PLACE_KINDS, stationLocId, metroLinesForCity, modeById, npcsForCity, npcAllowedAt, outfitOf, type CityKey, type Loc, type LocType, type Npc, type TransportModeId } from "./data";
import { COMMUNITY_PIN_COLOR, type CommunityMapMarker } from "./round2/community";
import { PET_MODEL, stepPetFollow, type Pet, type PetRuntime } from "./round2/pets";
import { makePostFx, type PostFx } from "./postfx";
import { makeDesktopFx, applyWetShader, type DesktopFx } from "./round2/desktopfx";
import { getLang } from "./i18n";
const tt = (zh: string, en: string) => (getLang() === "zh" ? zh : en);

export interface RemotePlayer {
  id: string;
  name: string;
  emoji: string;
  color: number;
  locId: string;
  /** hair index the player chose; absent until their heartbeat lands */
  hair?: number;
  /** accessory index into ACCESSORIES */
  accessory?: number;
  /** character creator: the player's hand-picked face (null = seed face) */
  faceSpec?: FaceSpec | null;
}

/** identity of the face an actor's 3D view should show: the custom spec
    as JSON, or `seed:<faceSeed>` for a seed-derived face. */
export function faceKeyFor(faceSpec: FaceSpec | null | undefined, faceSeed: string): string {
  return faceSpec ? `c:${JSON.stringify(faceSpec)}` : `s:${faceSeed}`;
}

interface Props {
  cityKey: CityKey;
  selfLocId: string;
  /** 省电画质（手机 / 低配）：1x 像素、无阴影、无后期、树更少。只在建图时读取。 */
  lite?: boolean;
  /** A/B map mode: "city" frames the whole city (A); "follow" keeps the camera close on you with the minimap always on (B) */
  mapMode?: "city" | "follow";
  /** the searched place: a label that always stays, a light pillar on the map, "go" and "✕" on the label */
  pinLocId?: string | null;
  onPinClear?: () => void;
  /** 观景时刻: the camera flies low over a spot at sunset / night (null = normal map) */
  scenic?: { x: number; z: number; phase: number; az: number; pol: number; dist: number; path?: [number, number][]; durMs: number; nonce: number } | null;
  onMapMode?: (m: "city" | "follow") => void;
  selfEmoji: string;
  /** the player's face seed (same value LifeStage gets as faceId) — so the
      player has the same face on the map and in interiors */
  selfFaceId?: string;
  /** character creator: the player's hand-picked face (null = seed face) */
  selfFaceSpec?: FaceSpec | null;
  selfColor: number;
  selfName: string;
  remotePlayers: RemotePlayer[];
  /** 📢 rented billboards by slot (0–2), shown at the city's billboard spots */
  billboards?: { slot: number; text: string; emoji: string; owner: string; go?: string }[];
  /** extra buttons shown first in the bottom-right control row (sound) */
  extraControls?: ReactNode;
  selfOutfitId?: string;
  selfHair?: number;
  selfAccessory?: string;
  travelModeId?: string;
  npcMoodEmoji?: Record<string, string>;
  /** Real current weather kind for the played city (from the server's
      live weather action): clear | partly | cloudy | overcast | fog |
      rain | storm | unknown. Drives cloud cover, grey skies and rain. */
  weatherKind?: string;
  apecDay: boolean;
  onSelect: (locId: string) => void;
  /** Tapped a person on the map: an NPC (by name) or another player (by public id). */
  onPickActor?: (who: { npc: string } | { player: string }) => void;
  /** Round-10 street mode: reports { active, walking } when it changes, so
      App can switch the ambience bed (traffic + footsteps) and so the map
      button can read as the minimap layer. */
  onStreetState?: (s: { active: boolean; walking: boolean }) => void;
  /** Round-3 (C): community pins for this city — the return value of
      toMapMarkers() (round2/community.ts) over App's server queries
      (strays / notices / snake warnings / fishing spots). Absent or empty
      = no pins. Clicks go to onCommunityMarkerClick. */
  communityMarkers?: CommunityMapMarker[];
  /** Round-3 (C): the pet currently following the player
      (getActivePet(pets) in App). Absent / null = no pet on the map. */
  activePet?: Pet | null;
  /** Tapped a community pin: App opens the matching detail panel
      (stray / notice / snake warning / fishing spot). */
  onCommunityMarkerClick?: (marker: CommunityMapMarker) => void;
  /** Round-9: player shops / bought flats as VISIBLE 3D buildings on the
      map — one small building per shop/flat, at its stored locId, offset
      beside the place's own building so nothing z-fights or moves. The
      name rides the community-marker chip (same labels overlay as places);
      the building itself carries a coloured shop sign. Clicking a building
      selects its place (pick mesh with userData.locId). */
  playerBuildings?: { id: string; kind: "shop" | "flat"; locId: string; name: string; color: number; emoji: string }[];
  /** Search focus: when focusNonce changes, the camera pans to focusLocId
      for a few seconds so a searched place is actually shown on the map. */
  focusLocId?: string;
  /** Focus a raw map point instead (e.g. a metro station with no location). */
  focusX?: number;
  focusZ?: number;
  focusNonce?: number;
  /** The place the player has selected / is heading to: drawn on the
      minimap as the pulsing destination marker while it differs from
      where the player figure currently stands. */
  destLocId?: string;
  /** Extra UI floated over the 3D map (the 出行导航 panel lives in App).
      Rendered only in the WebGL view — the list fallback has its own
      built-in location list, so the overlay would duplicate it there. */
  navOverlay?: ReactNode;
  /** Fullscreen mode: the map fills its (fixed, viewport-sized) parent
      instead of using the fixed responsive heights. */
  fill?: boolean;
  /** True while a full-screen overlay (life-stage / ride scenes, which run
      their own WebGL scene) covers the map: the frame loop keeps ticking
      but skips simulation + rendering so two 3D scenes never render at once. */
  paused?: boolean;
  /** A metro / rail ride in progress: the train runs along the real line
      between the stations the ride passes (pts), in step with the stop
      timer (idx = last station reached, stepMs per hop), carrying the
      player; hold = waiting at a station (boarding, transfer, arrival). */
  /** after changing city: the direction travelled (map units, x east / z south), so the figure walks in from the side the other city really lies on */
  arrival?: { dx: number; dz: number; nonce: number };
  /** epoch ms the player's current trip arrives: the figure paces itself to land exactly then */
  selfEtaAt?: number;
  train?: { pts: [number, number][]; idx: number; stepMs: number; color: number; rail: boolean; hold: boolean } | null;
}

/* ---- real 3D vehicles (Kenney Car Kit / Train Kit, CC0) ----
   Loaded once in the background from public/models; until they arrive (or
   if they fail) the hand-built box vehicles stand in. Each model is scaled to
   a target length, turned so it runs along +Z, centred and set on the ground. */
const MODEL_BASE = "./models/";
const gltfLoader = new GLTFLoader();
const modelCache = new Map<string, Promise<THREE.Object3D | null>>();
function loadModel(path: string): Promise<THREE.Object3D | null> {
  let p = modelCache.get(path);
  if (!p) {
    p = new Promise((res) => gltfLoader.load(MODEL_BASE + path, (g) => {
      g.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      res(g.scene);
    }, undefined, () => res(null)));
    modelCache.set(path, p);
  }
  return p;
}
/** a fitted copy: length along +Z = len, centred on x/z, wheels on y = 0 (turnX: the model's length runs along X) */
function fittedClone(src: THREE.Object3D, len: number, flip = false): THREE.Group {
  const obj = src.clone(true);
  const g = new THREE.Group(); const inner = new THREE.Group(); inner.add(obj); g.add(inner);
  let b = new THREE.Box3().setFromObject(inner); let sz = b.getSize(new THREE.Vector3());
  if (sz.x > sz.z) { inner.rotation.y = Math.PI / 2; b = new THREE.Box3().setFromObject(inner); sz = b.getSize(new THREE.Vector3()); }
  if (flip) inner.rotation.y += Math.PI;
  const k = len / Math.max(1e-3, sz.z); inner.scale.multiplyScalar(k);
  b = new THREE.Box3().setFromObject(inner); const c = b.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -b.min.y, -c.z);
  return g;
}

interface Actor {
  key: string;
  name: string;
  emoji: string;
  color: number;
  x: number;
  z: number;
  tx: number;
  tz: number;
  /** schedule anchor: the place this NPC's current beat of the day belongs
      to — wander targets cluster around it, so NPCs live somewhere instead
      of drifting across the whole city at random */
  ax?: number;
  az?: number;
  /** a greeting shown on the name chip while two people pass each other */
  greet?: string;
  greetUntil?: number;
  isSelf?: boolean;
  wander?: boolean;
  shirt: number;
  pants: number;
  accessory: string;
  /** index into HAIRS; a stable silhouette so two people in the same shirt are not the same person */
  hair?: number;
  behavior: string;
  speed: number;
  seed: number;
  /** face seed for the shared figure builder — the SAME seed LifeStage
      uses for this person, so the face matches between map and interior:
      the player's faceId, an NPC's name, a remote player's id */
  faceSeed?: string;
  /** character creator: a hand-picked face. When set it wins over the
      seed face (same override LifeStage uses). */
  faceSpec?: FaceSpec | null;
  /** identity of the face currently built into this actor's 3D view —
      custom spec JSON, or `seed:<faceSeed>`; when it changes, the view's
      figure is rebuilt (a face is geometry, it can't be recoloured) */
  faceKey?: string;
  heading: number;
  phase: number;
  blend: number;
  /** 0..1 seated-on-vehicle blend (player only); rideMode remembers the
      vehicle so the pose can ease out after stopping */
  rideBlend?: number;
  rideMode?: string;
}

interface Road {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  w: number;
  name?: string;
  lx?: number;
  lz?: number;
}

/* main roads follow their real alignments (tools/terrain/gen_roads.py) */
const ROADS: Record<CityKey, Road[]> = REAL_ROADS;

/* ---- terrain: the real ranges, as low-poly cone clusters ----
   Shenzhen is not a flat board: 梧桐山 (943.7m, the city's highest peak)
   rises behind Luohu/Yantian, 莲花山/塘朗山/阳台山/凤凰山 rib the built-up
   area, 大南山 drops into Shenzhen Bay at Shekou and the Dapeng peninsula
   hills run down the east coast. Huizhou is ringed by 罗浮山 (飞云顶
   1296m), 南昆山 and 象头山. Peaks sit clear of location buildings; the
   filler/trees placement below keeps their slopes empty. */
interface Peak { x: number; z: number; h: number; r: number; rock?: boolean }
interface MountainRange { peaks: Peak[]; label?: string; lx?: number; lz?: number; ly?: number }
/* real peaks at their real spots, height by real elevation; a peak that
   shares its spot with a game location (梧桐山, 罗浮山…) steps back so the
   location's own model stays clear */
const realRanges = (ck: CityKey): MountainRange[] => {
  const locs = getLocations(ck);
  const top = Math.max(...TERRAIN[ck].PEAKS.map((p) => p.ele), 900);
  return TERRAIN[ck].PEAKS.map((p) => {
    let { x, z } = p;
    for (const l of locs) {
      const d = Math.hypot(x - l.x, z - l.z);
      if (d < 2.6) { const k = (2.6 - d) / Math.max(d, 0.01); x += (x - l.x) * k || 2.6; z += (z - l.z) * k; }
    }
    const h = 2 + (p.ele / top) * 6.5;
    return { peaks: [{ x, z, h, r: 1.4 + h * 0.32 }], label: p.ele >= 500 ? `⛰️ ${p.name} ${p.ele}m` : undefined, lx: x, lz: z, ly: h + 1.2 };
  });
};
const MOUNTAINS: Record<CityKey, MountainRange[]> = { sz: realRanges("sz"), hz: realRanges("hz"), hk: realRanges("hk") };

/* Reservoirs and lakes drawn as real water patches in the miniature:
   Shenzhen's 梅林/西丽/铁岗 reservoirs, Huizhou's 红花湖 and 西湖补水面. */
const LAKES: Record<CityKey, { x: number; z: number; r: number }[]> = {
  // reservoirs and lakes are real polygons now (TERRAIN[city].WATER)
  sz: [], hz: [], hk: [],
};

const LAND = 0.6; // land deck height; buildings sit on it
const WORLD = { x: 38, zn: -22, zs: 24 };

/* ---- camera framing ----
   The miniature spans x −38…38 and z −22…~17 (coast). Desktop "whole city"
   uses contain: the distance at which every place fits. A phone is too
   small for that — contain zooms out until the city is a postage stamp
   in a void. Phones use fill instead, the way Apple Maps and Google Maps
   do: a neighbourhood around you runs to the edges of the glass, and you
   pinch out if you want the whole city. CAM_POL is flatter than the old
   0.92 so the foreground water strip stays a strip. */
const CAM_POL = 0.68;
const LAND_CX = 0;
const LAND_CZ = -2.5;
/* each city is framed on where its places are (not the whole 76×46 board):
   Shenzhen's strip without the Hong Kong / sea margin, Huizhou's centre and
   coast without the neighbouring cities */
const frameCache = new Map<CityKey, { cx: number; cz: number; w: number; h: number }>();
function frameOf(ck: CityKey) {
  let f = frameCache.get(ck);
  if (!f) {
    // outlying mountains still on the map but outside the everyday city frame
    const FAR: Record<string, string[]> = { hz: ["nankunshan", "luofu"] };
    const ls = getLocations(ck).filter((l) => !(FAR[ck] ?? []).includes(l.id));
    const xs = ls.map((l) => l.x), zs = ls.map((l) => l.z);
    const x0 = Math.max(-38, Math.min(...xs) - 2.5), x1 = Math.min(38, Math.max(...xs) + 2.5);
    const z0 = Math.max(-22, Math.min(...zs) - 2.5), z1 = Math.min(24, Math.max(...zs) + 2.5);
    f = { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: Math.max(24, x1 - x0), h: Math.max(16, z1 - z0) };
    frameCache.set(ck, f);
  }
  return f;
}
function fitDistForAspect(aspect: number, ck: CityKey = "sz"): { contain: number; fill: number } {
  const f = frameOf(ck);
  const tanV = Math.tan(THREE.MathUtils.degToRad(42) / 2);
  const projH = f.h * Math.sin(CAM_POL) + 6; // places' depth projected + headroom for towers/labels
  const projW = f.w; // places' width (north-up: the city runs side to side)
  const distH = (projH / 2) / tanV;
  const distW = (projW / 2) / (tanV * Math.max(0.45, aspect));
  const contain = THREE.MathUtils.clamp(Math.max(distH * 1.03, distW * 1.2), 20, 110);
  /* a few blocks, not the metro. max() contains that patch in the glass,
     so a tall phone and a wide phone both fill with streets, not void. */
  const nearH = (8 / 2) / tanV;
  const nearW = (12 / 2) / (tanV * Math.max(0.45, aspect));
  const fill = THREE.MathUtils.clamp(Math.max(nearH, nearW) * 0.96, 14, contain);
  return { contain, fill };
}

function coastZ(cityKey: CityKey, x: number): number {
  if (cityKey === "sz") return 16.6 + Math.sin(x * 0.1) * 1.1 + Math.sin(x * 0.23 + 1.7) * 0.7;
  if (cityKey === "hk") return 21.6 + Math.sin(x * 0.08 + 1) * 1 + Math.sin(x * 0.19 + 0.4) * 0.6;
  return 14.6 + Math.sin(x * 0.09 + 2) * 1.2 + Math.sin(x * 0.21 + 0.6) * 0.7;
}

/* ---- Hong Kong's real land (OSM coastline, see terrain-hk.ts) ---- */
function inRing(x: number, z: number, r: [number, number][]): boolean {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i]!, [xj, zj] = r[j]!;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
const LAND_BOX: Record<CityKey, (readonly [number, number, number, number])[]> = Object.fromEntries((Object.keys(TERRAIN) as CityKey[]).map((ck) => [ck, TERRAIN[ck].LAND.map((p) => { const xs = p[0]!.map((q) => q[0]); const zs = p[0]!.map((q) => q[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)] as const; })])) as Record<CityKey, (readonly [number, number, number, number])[]>;
function landAt(ck: CityKey, x: number, z: number): boolean {
  const T = TERRAIN[ck];
  for (let k = 0; k < T.LAND.length; k++) {
    const b = LAND_BOX[ck][k]!;
    if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) continue;
    const p = T.LAND[k]!;
    if (inRing(x, z, p[0]!) && !p.slice(1).some((h) => inRing(x, z, h))) return !T.WATER.some((w) => inRing(x, z, w[0]!));
  }
  return false;
}
/** Dry land at (x, z), at least `margin` from the shore (real terrain, every city). */
export function isLand(cityKey: CityKey, x: number, z: number, margin = 0): boolean {
  if (!landAt(cityKey, x, z)) return false;
  return margin <= 0 || [[margin, 0], [-margin, 0], [0, margin], [0, -margin]].every(([dx, dz]) => landAt(cityKey, x + dx!, z + dz!));
}

/** Nearest dry land to (x, z): the point itself if it is land, else the
    closest point on an expanding ring (step 0.5, out to 10 units). The
    waterfront promenade / beach at the Shenzhen Bay coast renders as a
    walkable-looking strip but sits outside the terrain LAND polygons, so a
    click there used to be silently dropped; clamping walks the player to
    the nearest shore instead. Null when there is no land within 10 units
    (e.g. clicked far out in the sea) — the click stays a no-op. */
export function nearestLand(cityKey: CityKey, x: number, z: number, maxR = 10, step = 0.5): { x: number; z: number } | null {
  if (isLand(cityKey, x, z)) return { x, z };
  for (let r = step; r <= maxR + 1e-9; r += step) {
    // samples ~step apart along the ring, at least 8 so small rings are covered
    const n = Math.max(8, Math.ceil((2 * Math.PI * r) / step));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sx = x + Math.cos(a) * r;
      const sz = z + Math.sin(a) * r;
      if (isLand(cityKey, sx, sz)) return { x: sx, z: sz };
    }
  }
  return null;
}

/** ROUND-10 street mode: the street / place name for the HUD pill —
    nearest named road within ~4 units, else the nearest place within ~5,
    else the city name. Real road names come from roads.ts (深南大道,
    弥敦道, 惠州大道 …). */
export function streetNameAt(cityKey: CityKey, x: number, z: number): string {
  let bestRoad: { d: number; name: string } | null = null;
  for (const r of REAL_ROADS[cityKey]) {
    if (!r.name) continue;
    const dx = r.x2 - r.x1, dz = r.z2 - r.z1;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - r.x1) * dx + (z - r.z1) * dz) / len2));
    const d = Math.hypot(x - (r.x1 + dx * t), z - (r.z1 + dz * t));
    if (d < 4 && (!bestRoad || d < bestRoad.d)) bestRoad = { d, name: r.name };
  }
  let bestLoc: { d: number; name: string } | null = null;
  for (const l of getLocations(cityKey)) {
    const d = Math.hypot(x - l.x, z - l.z);
    if (d < 5 && (!bestLoc || d < bestLoc.d)) bestLoc = { d, name: l.name };
  }
  if (bestRoad && (!bestLoc || bestRoad.d <= bestLoc.d + 1)) return bestRoad.name;
  if (bestLoc) return bestLoc.name;
  return CITIES[cityKey].name;
}

/** ROUND-10: the street-mode direction stick — a fixed Lagos-style
    joystick (bottom-left, above the minimap) so third-person walking
    works by mouse or touch, not only WASD. Same vector as the interior
    MoveStick (x = strafe right, y = forward, each −1…1); push to the
    edge to run. Pointer capture keeps the drag off the map's own
    drag-to-rotate handler. */
function StreetStick({ stick }: { stick: MutableRefObject<{ x: number; y: number }> }) {
  const [k, setK] = useState({ x: 0, y: 0 });
  const R = 36;
  const update = (e: ReactPointerEvent<HTMLDivElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    let x = e.clientX - cx;
    let y = e.clientY - cy;
    const m = Math.hypot(x, y);
    if (m > R) { x = (x / m) * R; y = (y / m) * R; }
    setK({ x, y });
    stick.current.x = x / R;
    stick.current.y = -y / R;
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    update(e);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    update(e);
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setK({ x: 0, y: 0 });
    stick.current.x = 0;
    stick.current.y = 0;
  };
  return (
    <div
      aria-label="方向摇杆：按住拖动走路，推到底跑"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className="pointer-events-auto absolute bottom-40 left-6 z-20 h-[112px] w-[112px] touch-none select-none"
    >
      <div className="pointer-events-none absolute inset-0 rounded-full border border-white/45 bg-black/30 shadow-[inset_0_0_0_12px_rgba(255,255,255,0.07)] backdrop-blur-[2px]" />
      <div className="pointer-events-none absolute h-[54px] w-[54px] rounded-full border border-white/80 bg-white/88 shadow-[0_6px_16px_rgba(0,0,0,0.35)]" style={{ left: `calc(50% + ${k.x}px)`, top: `calc(50% + ${k.y}px)`, transform: "translate(-50%, -50%)" }} />
    </div>
  );
}

/* ROUND-10g: the chunk grid (CHUNK, chunkKeyOf, chunksNear) and the
   ChunkManager live in chunks.ts now — this file only keeps `hash`. */

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* Where an NPC plausibly is at a given hour of the REAL day — their beat:
   morning commute, work at the kind of place their job belongs to, lunch
   at food streets, evening food/social, night back in the home quarter.
   "stay" roles （摊主/同事/邻居） keep to their corner all day. The map's
   sky already runs on the real Asia/Shanghai clock; NPC schedules ride
   the same clock, so the street the player sees matches the hour. */
function npcAnchorLocId(n: Npc, hour: number, locs: Loc[]): string {
  const first = locs[0];
  if (!first) return "home";
  /* Round-3 (C): npcAllowedAt (data.ts) decides — onlyLocIds / neverLocIds
     win over preferTypes, so e.g. 阿海 never gets sent to a second-hand
     market for lunch and 大芬姐 never to Dafen / 华强北. The type-only
     fallback below runs only for NPCs without an allow-list; an NPC whose
     allow-list matches nothing here (e.g. 郭叔, onlyLocIds: []) is not
     placed on this city's map at all (actor sync filters them out), so the
     `allowedFirst ?? first` fallback here is only a safety net. */
  const allowedFirst = locs.find((l) => npcAllowedAt(n, l));
  const byType = (types: LocType[]): Loc | undefined =>
    locs.find((l) => types.includes(l.type) && npcAllowedAt(n, l)) ??
    (n.onlyLocIds ? undefined : locs.find((l) => types.includes(l.type)));
  if (n.behavior === "stay") return (allowedFirst ?? first).id;
  if (hour >= 7 && hour < 9) return (byType(["transit", "work"]) ?? allowedFirst ?? first).id;
  if (hour >= 12 && hour < 14) return (byType(["food", "market"]) ?? allowedFirst ?? first).id;
  if (hour >= 18 && hour < 22) return (byType(["food", "social", "mall", "fun"]) ?? allowedFirst ?? first).id;
  if (hour >= 22 || hour < 7) return (byType(["home", "fun"]) ?? allowedFirst ?? first).id;
  return (byType(n.preferTypes) ?? allowedFirst ?? first).id;
}

/* Street greetings: when two named neighbours pass on the pavement, one
   of them says something — the city acknowledging itself. */
const GREETS = ["👋「早啊！」", "👋「吃了吗？」", "💬「今天天儿不错」", "👋「忙着呢？慢点」", "💬「路上小心点」", "👋「又见面了」", "💬「回头一起吃饭」"];
const GREETS_PLAYER = ["👋「嗨，又碰见你了」", "👋「今天也加油啊」", "💬「出门呢？路上慢点」", "👋「吃了吗你？」"];

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

function windowsTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#101418";
  g.fillRect(0, 0, 64, 128);
  const rnd = mulberry(42);
  for (let y = 6; y < 122; y += 10) {
    for (let x = 6; x < 58; x += 10) {
      const lit = rnd();
      g.fillStyle = lit > 0.45 ? "#ffd98a" : "#2b3644";
      g.fillRect(x, y, 6, 6);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** ROUND-10 street mode: a one-floor facade tile (warm-white wall, two
    glass windows, a floor line) used as the `map` of nearby buildings
    while the player walks the street, so a flat box reads as a real
    frontage. The building's own colour tints the near-white wall.
    Applied only in street mode; the map keeps its clean look. */
function facadeTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f2ede2";
  g.fillRect(0, 0, 128, 128);
  // faint vertical bay joints
  g.fillStyle = "rgba(0,0,0,0.05)";
  g.fillRect(0, 0, 2, 128);
  g.fillRect(126, 0, 2, 128);
  // two windows per bay: dark glass, a sky glint, one in five lit warm
  const rnd = mulberry(7);
  for (const wx of [16, 72]) {
    const lit = rnd() > 0.8;
    g.fillStyle = "#232c38";
    g.fillRect(wx, 24, 40, 56);
    g.fillStyle = lit ? "#ffd98a" : "#7fa8c8";
    g.fillRect(wx + 3, 27, 34, 12);
    g.fillStyle = lit ? "#ffedb5" : "#33465c";
    g.fillRect(wx + 3, 42, 34, 35);
    // mullion cross
    g.fillStyle = "rgba(242,237,226,0.85)";
    g.fillRect(wx + 18, 24, 4, 56);
    g.fillRect(wx, 50, 40, 4);
  }
  // floor slab line at the bottom of the tile
  g.fillStyle = "#d8d0bd";
  g.fillRect(0, 118, 128, 5);
  g.fillStyle = "rgba(0,0,0,0.10)";
  g.fillRect(0, 123, 128, 5);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Companion to facadeTexture: the same window layout on a black field,
    so the facade's lit windows glow at night in exactly the same places
    as the daylight windows. Same seed (7) and window order as the map. */
function facadeEmissiveTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000000";
  g.fillRect(0, 0, 128, 128);
  const rnd = mulberry(7);
  for (const wx of [16, 72]) {
    const lit = rnd() > 0.8;
    g.fillStyle = lit ? "#ffd98a" : "#141c26";
    g.fillRect(wx, 24, 40, 56);
    // mullion cross stays dark, matching the map
    g.fillStyle = "#000000";
    g.fillRect(wx + 18, 24, 4, 56);
    g.fillRect(wx, 50, 40, 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function glowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function emojiSprite(emoji: string, ring: number, self = false): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.beginPath();
  g.arc(48, 48, self ? 36 : 42, 0, Math.PI * 2);
  g.fillStyle = self ? "#ff4d2e" : `#${ring.toString(16).padStart(6, "0")}`;
  g.fill();
  g.lineWidth = self ? 7 : 6;
  g.strokeStyle = "rgba(255,255,255,0.98)";
  g.stroke();
  if (self) { g.beginPath(); g.arc(48, 48, 44, 0, Math.PI * 2); g.lineWidth = 4; g.strokeStyle = "#ffd23f"; g.stroke(); } // gold halo: this one is you
  g.font = "52px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(emoji, 48, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(1.3, 1.3, 1); // a small badge, not bigger than the person under it
  sp.renderOrder = 20;
  return sp;
}

/* The pet model's moving parts, kept on the group so the frame loop can
   animate them without re-querying the scene graph every frame. */
interface PetParts {
  body?: THREE.Group;
  tail?: THREE.Group;
  legFL?: THREE.Group;
  legFR?: THREE.Group;
  legBL?: THREE.Group;
  legBR?: THREE.Group;
}

/** Dispose a pet group built by makePetGroup (geometries + materials +
    the badge sprite's canvas texture) when the pet changes. */
function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const m = mesh.material as THREE.Material | THREE.Material[];
      const disposeOne = (x: THREE.Material) => {
        if (x instanceof THREE.SpriteMaterial) x.map?.dispose();
        x.dispose();
      };
      if (Array.isArray(m)) m.forEach(disposeOne);
      else if (m) disposeOne(m);
    }
  });
}

/* Round-3 (C): the player's pet as a low-poly animal, built from the same
   primitive-geometry language as the map figures above (LifeStage's
   makeFigure works the same way) — no new .glb. Facing +Z, like the
   actors: rotation.y = heading from stepPetFollow().
   Cat vs dog is read off PET_MODEL (round2/pets.ts): pointed triangle ears
   + up-curved thin tail + smaller frame for a cat; floppy ears + level
   thick tail + snout + bigger frame for a dog. Both get real geometry eyes
   (the round-2 faces rule: nothing faceless). Coat colour is the pet's own
   pet.color; belly / muzzle are the same colour lightened. */
function makePetGroup(pet: Pet): THREE.Group {
  const spec = PET_MODEL[pet.kind];
  const g = new THREE.Group();
  const s = pet.kind === "dog" ? 1.28 : 1; // dogs read bigger than cats at map scale
  const coat = new THREE.MeshStandardMaterial({ color: pet.color, roughness: 0.85 });
  const light = new THREE.MeshStandardMaterial({ color: new THREE.Color(pet.color).lerp(new THREE.Color(0xffffff), 0.45), roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(pet.color).multiplyScalar(0.55), roughness: 0.9 });
  const mkLeg = (x: number, z: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.22 * s, z);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.045 * s, 0.22 * s, 8), dark);
    m.position.y = -0.11 * s;
    m.castShadow = true;
    pivot.add(m);
    g.add(pivot);
    return pivot;
  };
  const legFL = mkLeg(-0.11 * s, 0.17 * s);
  const legFR = mkLeg(0.11 * s, 0.17 * s);
  const legBL = mkLeg(-0.11 * s, -0.17 * s);
  const legBR = mkLeg(0.11 * s, -0.17 * s);
  // body parts live in their own subgroup so the sit pose can lift the
  // chest (rotation.x) while the legs stay planted on the ground
  const body = new THREE.Group();
  body.position.y = 0.22 * s;
  g.add(body);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.26 * s, 14, 10), coat);
  torso.scale.set(0.85, 0.78, 1.3);
  torso.position.y = 0.12 * s;
  torso.castShadow = true;
  body.add(torso);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 12, 8), light);
  belly.scale.set(0.7, 0.55, 1.1);
  belly.position.set(0, 0.02 * s, 0.08 * s);
  body.add(belly);
  const head = new THREE.Group();
  head.position.set(0, 0.32 * s, 0.34 * s);
  body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19 * s, 14, 10), coat);
  skull.castShadow = true;
  head.add(skull);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3 });
  for (const ex of [-0.07, 0.07]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028 * s, 8, 6), eyeMat);
    eye.position.set(ex * s, 0.05 * s, 0.165 * s);
    head.add(eye);
  }
  if (pet.kind === "cat") {
    for (const ex of [-0.1, 0.1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.085 * s, 0.17 * s, 4), coat);
      ear.position.set(ex * s, 0.2 * s, 0);
      ear.rotation.y = Math.PI / 4;
      ear.castShadow = true;
      head.add(ear);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.045 * s, 0.1 * s, 4), new THREE.MeshStandardMaterial({ color: 0xf5a8b8, roughness: 0.9 }));
      inner.position.set(ex * s, 0.18 * s, 0.03 * s);
      inner.rotation.y = Math.PI / 4;
      head.add(inner);
    }
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.05 * s, 0.03 * s, 0.02), new THREE.MeshStandardMaterial({ color: 0xe87a90, roughness: 0.7 }));
    nose.position.set(0, -0.01 * s, 0.19 * s);
    head.add(nose);
  } else {
    for (const ex of [-0.17, 0.17]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.07 * s, 0.24 * s, 0.05 * s), dark);
      ear.position.set(ex * s, 0.02 * s, 0.02 * s);
      ear.rotation.z = ex < 0 ? 0.25 : -0.25;
      ear.castShadow = true;
      head.add(ear);
    }
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.15 * s, 0.11 * s, 0.13 * s), light);
    muzzle.position.set(0, -0.05 * s, 0.18 * s);
    muzzle.castShadow = true;
    head.add(muzzle);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.04 * s, 0.03), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }));
    nose.position.set(0, -0.02 * s, 0.25 * s);
    head.add(nose);
  }
  // tail on its own pivot so the frame loop can wag it: cat up-curved,
  // dog out level and slightly up
  const tail = new THREE.Group();
  tail.position.set(0, 0.14 * s, -0.33 * s);
  const tailLen = pet.kind === "cat" ? 0.42 : 0.3;
  const tailMesh = new THREE.Mesh(new THREE.CylinderGeometry(pet.kind === "cat" ? 0.028 * s : 0.042 * s, pet.kind === "cat" ? 0.022 * s : 0.035 * s, tailLen * s, 8), coat);
  tailMesh.position.y = (tailLen / 2) * s;
  tailMesh.castShadow = true;
  tail.add(tailMesh);
  tail.rotation.x = pet.kind === "cat" ? -0.35 : -1.15;
  body.add(tail);
  const badge = emojiSprite(spec.emoji, pet.color);
  badge.scale.set(0.9, 0.9, 1);
  badge.position.y = 0.85 * s;
  g.add(badge);
  const parts = g.userData as PetParts;
  parts.body = body;
  parts.tail = tail;
  parts.legFL = legFL;
  parts.legFR = legFR;
  parts.legBL = legBL;
  parts.legBR = legBR;
  return g;
}

interface Chip {
  el: HTMLButtonElement | HTMLDivElement;
  getPos: () => { x: number; y: number; z: number };
  kind: "loc" | "road" | "actor" | "community";
  /** round-3 (C): community pin kind (stray / notice / snake / fishing) */
  community?: CommunityMapMarker["kind"];
  /** a scripted neighbour (not a real player): name shows only near you */
  npc?: boolean;
  locId?: string;
  self?: boolean;
  metro?: boolean;
  /** A metro station name tag — shown only when zoomed in close. */
  station?: boolean;
  /** A real place (park, mall, museum …) — shown only when zoomed in. */
  place?: boolean;
  /** billboard slot (0–2): always shown while rented, outside the label caps */
  ad?: number;
  /** the searched place's pinned label */
  pin?: boolean;
  /** A neighbourhood / town name over the filler blocks and woods. */
  area?: "big" | "small";
  /** The small English subtitle line under a place name, if any. */
  sub?: HTMLElement | null;
  /** Billboard copy lives in its own span so the 「广告」 badge survives updates. */
  textEl?: HTMLElement | null;
  w: number;
  h: number;
  lastText: string;
  /** source (untranslated) text last written to an actor chip — rewrite only when it changes, so the page translator's English sticks */
  src?: string;
  visible: boolean;
  /* Last edge-clamped anchor (set by the declutter pass): on the frames
     between passes the chip follows its 3D anchor plus this clamp delta,
     so a label near the screen edge stays pulled fully inside instead of
     being sliced by the overlay's overflow-hidden edge. */
  clampDx: number;
  clampDy: number;
}

export function MapView(p: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const actorsRef = useRef<Map<string, Actor>>(new Map());
  /* each NPC's current schedule anchor (locId), so a changed beat only
     retargets them once — they then walk there across the map */
  const npcAnchorRef = useRef<Map<string, string>>(new Map());
  /* round-3 (C): the following pet's live position, driven every frame by
     stepPetFollow() (round2/pets.ts); not saved, rebuilt when the pet changes */
  const petRuntimeRef = useRef<PetRuntime>({ pos: { x: 0, z: 0 }, heading: 0, pose: "sit" });
  /* round-3 (C): community pins — the chip divs the sync effect below
     creates in the labels overlay, positioned by the frame loop's
     declutter pass together with the place / NPC chips */
  const communityChipsRef = useRef<Chip[]>([]);
  /* Round-9: the scene (built by the mount effect) so the player-buildings
     effect can add/remove shop & flat meshes without rebuilding the city. */
  const sceneRef = useRef<THREE.Scene | null>(null);
  /* Round-9: pick meshes of the player buildings, so a tap on a shop/flat
     building selects its place (onUp raycasts these alongside pickMeshes). */
  const playerPickMeshesRef = useRef<THREE.Object3D[]>([]);
  const propsRef = useRef(p);
  propsRef.current = p;
  /* ROUND-10: street mode is the primary play view; the top-down map is
     the navigation / minimap layer ("这个反而有点像是小地图"). Desktop
     starts on the street (the player lives there); phones and lite mode
     keep the map as the default, where touch steering is weaker. One
     constant to flip if the default ever wants to change. */
  const streetDefault = !p.lite && typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer:fine)").matches;
  const camRef = useRef({ az: 0, pol: CAM_POL, dist: 46, distCur: 46, tx: LAND_CX, tz: LAND_CZ, lastUser: 0, cut: 0 });
  /* Distance that fills the current canvas, recomputed on every resize;
     while autoFit is on (initially, after ⌂ reset, and whenever the
     fullscreen/fill mode changes) the camera distance tracks it, so the
     city re-fills the frame after entering/leaving fullscreen, zooming
     the window, or any other size change. Manual wheel/button zoom turns
     autoFit off until the next reset or fullscreen toggle. */
  const fitDistRef = useRef(46);
  const autoFitRef = useRef(!streetDefault);
  const [zoomPct, setZoomPct] = useState(100);
  const [glFailed, setGlFailed] = useState(false);
  const [cine, setCine] = useState(true);
  /* 标签密度：精简 / 标准 / 全部 — fewer labels when zoomed out so they stop
     covering the city; remembered per browser. */
  type LabelDensity = "few" | "normal" | "all";
  const [labelDensity, setLabelDensity] = useState<LabelDensity>(() => {
    try { const v = localStorage.getItem("shhr-labels"); if (v === "few" || v === "normal" || v === "all") return v; } catch { /* default */ }
    return typeof window !== "undefined" && (window.innerWidth < 640 || window.innerHeight < 500) ? "few" : "normal"; // a phone screen fits far fewer names
  });
  const labelDensityRef = useRef(labelDensity);
  labelDensityRef.current = labelDensity;
  const cycleLabels = () => setLabelDensity((d) => {
    const next: LabelDensity = d === "few" ? "normal" : d === "normal" ? "all" : "few";
    try { localStorage.setItem("shhr-labels", next); } catch { /* storage unavailable */ }
    return next;
  });
  const cineRef = useRef(true);
  cineRef.current = cine;
  /* Street-level camera: drops the lens to the pavement behind the player
     so the miniature stops reading as a model — shopfronts, crossings,
     signals, traffic and pedestrians at eye height, true-scale streets.
     ROUND-10: this is now the PRIMARY view (Sleeping Dogs style). The
     player walks the street with WASD; the camera sits over the shoulder
     and swings in behind the heading; nearby buildings get lit facades;
     the street name shows on screen. The map is the minimap layer. */
  const [streetCam, setStreetCam] = useState(streetDefault);
  const streetRef = useRef(streetDefault);
  /** keys held for street steering (WASD / arrows + Shift) */
  const streetKeysRef = useRef<Set<string>>(new Set());
  /** ROUND-10: the on-screen direction stick in street mode (Lagos-style
      joystick) — same move vector as WASD, so the frame loop needs no
      separate path; push to the edge to run, like the interior stick. */
  const streetStickRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  /** ROUND-10g: the ChunkManager for this city (owned by the scene effect);
      the player-buildings effect and the street functions reach it here. */
  const chunkManagerRef = useRef<ChunkManager | null>(null);
  /** ROUND-10g: player shops/flats as data (the manager builds them into
      their chunks at build time); the player-buildings effect is now a
      registry — it updates this list and asks the manager to refresh the
      affected chunks, instead of building meshes itself. */
  const playerBuildingsDataRef = useRef<PlayerBuildingData[]>([]);
  /** the current click-walk target was set by street steering (not a mouse click) */
  const streetWalkRef = useRef(false);
  const streetNameRef = useRef("");
  const [streetName, setStreetName] = useState("");
  /** ROUND-10g: buildings currently wearing a street facade — overlay boxes
      (bodies are merged now, so a facade is a slightly larger box with
      lit-window materials, added to the scene, not a material swap). */
  const streetFacadeRef = useRef<{ id: string; group: THREE.Group; mats: THREE.Material[]; chunkKey: string }[]>([]);
  /** every building that can wear a facade (plain data, captured at build):
      position + size + rotation + chunk, so overlays land exactly. */
  const streetFacadeTargetsRef = useRef<FacadeTarget[]>([]);
  const streetFacadeTexRef = useRef<THREE.Texture | null>(null);
  const streetFacadeEmTexRef = useRef<THREE.Texture | null>(null);
  /** facade materials, driven with the day cycle like buildingMats */
  const streetFacadeMatsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const streetReportedRef = useRef({ active: false, walking: false });
  const toggleStreetCamRef = useRef<() => void>(() => {});
  const focusRef = useRef(0);
  const lookRef = useRef<{ x: number; z: number; until: number } | null>(null);
  /* a spot picked on the minimap stays the camera's centre until the player
     asks to come back (tap themselves, ⌂, switch view) or sets off */
  const anchorRef = useRef<{ x: number; z: number } | null>(null);
  /* tap-yourself: keep the lens on the live player, even in whole-city view
     where an idle camera would otherwise settle on the city centre */
  const trackSelfRef = useRef(streetDefault);
  /* the searched place, pinned until the next search or ✕ */
  const pinRef = useRef<{ id: string; x: number; z: number; name: string } | null>(null);
  /* ROUND-8 click-to-walk (desktop mouse): the ground point the player
     clicked — the self actor walks there at travel-mode speed. Set by the
     map's onUp, cleared on arrival / new click / trip / location change.
     The ring mesh lives in the scene effect (next to pinRing). */
  const clickWalkRef = useRef<{ x: number; z: number } | null>(null);
  const clickMarkerRef = useRef<THREE.Mesh | null>(null);
  /* Walk-to-person: tapping an NPC / player walks you up to them (before
     this, tapping only opened the chat/card and the player never moved).
     The frame loop re-targets clickWalkRef to the person's current spot
     each frame, so a wandering NPC is followed until close. followActorRef
     = the actor being followed; pendingActorRef = the actor whose chat/card
     opens on arrival (NPCs only — a remote player's card opens at once,
     the walk just follows in the background). */
  const followActorRef = useRef<string | null>(null);
  const pendingActorRef = useRef<string | null>(null);
  /* LoL-style move-click ripple: performance.now() of the last click-to-walk
     click (-1 = none). The frame loop expands + fades the ring for ~500ms
     from this timestamp, then the ring settles into the faint persistent
     destination marker while the player walks there. */
  const clickRippleAtRef = useRef<number>(-1);
  /* a trip or teleport cancels any click-walk, so the figure never walks
     back to a stale point after arriving somewhere else */
  useEffect(() => {
    clickWalkRef.current = null;
    followActorRef.current = null;
    pendingActorRef.current = null;
    if (clickMarkerRef.current) clickMarkerRef.current.visible = false;
  }, [p.selfLocId, p.cityKey]);
  useEffect(() => {
    const l = p.pinLocId ? resolveLoc(p.cityKey, p.pinLocId) : undefined;
    pinRef.current = l && p.pinLocId ? { id: p.pinLocId, x: l.x, z: l.z, name: document.documentElement.lang === "en" ? (LOC_EN[l.name] ?? l.name) : l.name } : null;
  }, [p.pinLocId, p.cityKey]);
  /* B mode: the camera rides close behind you (about a third of the whole-city distance) */
  const FOLLOW_K = 0.34;
  const followRef = useRef(p.mapMode === "follow");
  followRef.current = p.mapMode === "follow";
  const fillDistRef = useRef(28);
  const compactRef = useRef(false);
  /* Desktop city mode contains the whole city. A phone contains a district
     around you (fill) so the buildings reach the edges of the glass. */
  const baseDist = () => {
    const contain = fitDistRef.current || 46;
    if (!compactRef.current) return Math.max(16, contain * (followRef.current ? FOLLOW_K : 1));
    const fill = fillDistRef.current || 28;
    return followRef.current ? Math.max(14, fill * 0.72) : fill;
  };
  const reportZoom = () => setZoomPct(Math.round((baseDist() / Math.max(1, camRef.current.dist)) * 100));
  useEffect(() => {
    // a new trip (or arrival) hands the camera back: follow while moving
    anchorRef.current = null;
    lookRef.current = null;
    trackSelfRef.current = false;
  }, [p.selfLocId]);
  useEffect(() => {
    // switching A ↔ B re-frames at that mode's distance; B always shows the minimap
    anchorRef.current = null;
    lookRef.current = null;
    trackSelfRef.current = false;
    autoFitRef.current = true;
    camRef.current.dist = baseDist();
    reportZoom();
    if (p.mapMode === "follow") setMiniOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.mapMode]);
  /* scenic moment: take over the camera and the sky, hide the labels; give everything back afterwards */
  const scenicRef = useRef<(NonNullable<Props["scenic"]> & { at: number }) | null>(null);
  useEffect(() => {
    const sc = p.scenic;
    if (sc) {
      scenicRef.current = { ...sc, at: performance.now() };
      jumpToPhase(sc.phase);
      setCine(true);
      if (labelsRef.current) { labelsRef.current.style.transition = "opacity .8s"; labelsRef.current.style.opacity = "0"; }
    } else if (scenicRef.current) {
      scenicRef.current = null;
      backToRealTime();
      camRef.current.az = 0; camRef.current.pol = CAM_POL;
      autoFitRef.current = true; camRef.current.dist = baseDist();
      if (labelsRef.current) labelsRef.current.style.opacity = "1";
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.scenic?.nonce]);
  /* LOL-style minimap: a live 2D thumbnail of the whole miniature, drawn
     on a small canvas from the SAME actor refs the 3D scene animates, so
     the player dot, NPC dots, remote players and the destination marker
     move exactly when the big map moves. Clicking it pins the main camera
     there until the player taps themselves, resets, switches view, or sets off. */
  const [miniOpen, setMiniOpen] = useState(() => typeof window === "undefined" || (window.innerWidth >= 640 && window.innerHeight >= 500)); // phones and landscape phones: the map first, the minimap on request
  const miniCanvasRef = useRef<HTMLCanvasElement | null>(null);

  /* Day-cycle phase control: jumped instantly via the ☀️/🌇/🌙 buttons,
     a ?time= URL parameter (day | dusk | night, or a 0–1 phase number),
     or the 🎥 demo mode that runs a 30-second day for screen recordings.
     The sky follows the REAL local time in Shenzhen/Huizhou
     (Asia/Shanghai): phase = fraction of the real day, advancing in real
     time (1 phase per 86,400s). The ☀️/🌇/🌙 buttons preview a moment,
     🕐 snaps back to real time, and the 🎥 demo runs a 30s day for
     recordings. A ?time= URL parameter still overrides the start. */
  const REAL_RATE = 1 / 86400;
  const DEMO_RATE = 10 / 300;
  const shanghaiPhase = (): number => {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }).formatToParts(new Date());
      const get = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? 0);
      return ((get("hour") % 24) * 3600 + get("minute") * 60 + get("second")) / 86400;
    } catch { return 0.4; }
  };
  const phaseRef = useRef<{ base: number; at: number } | null>(null);
  if (phaseRef.current === null) {
    let base = shanghaiPhase();
    try {
      const q =
        new URLSearchParams(window.location.search).get("time") ??
        new URLSearchParams(window.location.hash.replace(/^#/, "")).get("time");
      const named: Record<string, number> = { day: 0.32, morning: 0.32, noon: 0.45, dusk: 0.74, sunset: 0.74, night: 0.93 };
      if (q != null && q.trim() !== "") {
        const n = Number(q);
        if (!Number.isNaN(n)) base = Math.min(0.999, Math.max(0, n));
        else if (named[q] !== undefined) base = named[q]!;
      }
    } catch { /* URL unavailable — keep the real-time default */ }
    phaseRef.current = { base, at: performance.now() };
  }
  const rateRef = useRef(REAL_RATE);
  const [demo, setDemo] = useState(false);
  /* compact screens: the time-of-day / camera / label buttons live behind one 🎛️ button */
  const [viewMenu, setViewMenu] = useState(false);
  const demoRef = useRef(false);
  const currentPhase = (): number => {
    const pr = phaseRef.current!;
    const el = (performance.now() - pr.at) / 1000;
    return (((pr.base + el * rateRef.current) % 1) + 1) % 1;
  };
  const jumpToPhase = (ph: number) => {
    phaseRef.current = { base: ph, at: performance.now() };
  };
  const backToRealTime = () => {
    demoRef.current = false;
    setDemo(false);
    rateRef.current = REAL_RATE;
    phaseRef.current = { base: shanghaiPhase(), at: performance.now() };
  };
  const toggleDemo = () => {
    // Rebase at the current phase so flipping speed never jumps the clock.
    const cur = currentPhase();
    const next = !demoRef.current;
    demoRef.current = next;
    setDemo(next);
    phaseRef.current = { base: cur, at: performance.now() };
    rateRef.current = next ? DEMO_RATE : REAL_RATE;
    if (next) setCine(true);
  };

  // Arriving somewhere new triggers a short cinematic push-in.
  useEffect(() => {
    focusRef.current = 1;
    camRef.current.cut = 1;
  }, [p.selfLocId]);

  // Entering/leaving fullscreen changes the stage size: re-arm auto-fit so
  // the ResizeObserver in the scene effect snaps the camera distance back
  // to the fill-the-frame distance for the new size.
  useEffect(() => {
    autoFitRef.current = true;
  }, [p.fill]);

  // A searched place takes the camera for a few seconds.
  useEffect(() => {
    if (!p.focusNonce) return;
    if (p.focusX !== undefined && p.focusZ !== undefined) {
      lookRef.current = { x: p.focusX, z: p.focusZ, until: performance.now() + 5000 };
      return;
    }
    if (!p.focusLocId) return;
    const loc = p.focusLocId ? resolveLoc(p.cityKey, p.focusLocId) : undefined;
    if (loc) lookRef.current = { x: loc.x, z: loc.z, until: performance.now() + 4500 };
  }, [p.focusLocId, p.focusX, p.focusZ, p.focusNonce, p.cityKey]);

  // Sync the actor set with props (self, remote players, NPCs).
  // App rebuilds remotePlayers / npcMoodEmoji as fresh objects on EVERY
  // render, so depending on them by identity re-ran this sync constantly;
  // depend on their content instead.
  const remoteKey = p.remotePlayers.map((rp) => `${rp.id}|${rp.name}|${rp.emoji}|${rp.color}|${rp.locId}|${rp.hair ?? ""}|${rp.accessory ?? ""}|${faceKeyFor(rp.faceSpec ?? null, rp.id)}`).join(";");
  const moodKey = p.npcMoodEmoji ? Object.entries(p.npcMoodEmoji).map(([k, v]) => `${k}=${v}`).join(";") : "";
  const cityRef = useRef(p.cityKey);
  useEffect(() => {
    const locs = getLocations(p.cityKey);
    const byId = new Map(locs.map((l) => [l.id, l]));
    const actors = actorsRef.current;
    const switched = cityRef.current !== p.cityKey;
    cityRef.current = p.cityKey;
    const want = new Set<string>();
    const upsert = (a: Omit<Actor, "x" | "z" | "tx" | "tz"> & { startLoc: string }) => {
      want.add(a.key);
      const cur = actors.get(a.key);
      const loc = byId.get(a.startLoc) ?? resolveLoc(p.cityKey, a.startLoc) ?? locs[0];
      if (!cur) {
        actors.set(a.key, {
          ...a,
          faceSpec: a.faceSpec ?? null,
          faceKey: faceKeyFor(a.faceSpec ?? null, a.faceSeed ?? a.key),
          x: (loc?.x ?? 0) + ((a.seed % 5) - 2) * 0.35,
          z: (loc?.z ?? 0) + ((a.seed % 3) - 1) * 0.35,
          tx: loc?.x ?? 0,
          tz: loc?.z ?? 0,
        });
      } else {
        cur.name = a.name;
        cur.emoji = a.emoji;
        cur.color = a.color;
        cur.isSelf = a.isSelf;
        cur.wander = a.wander;
        cur.shirt = a.shirt;
        cur.pants = a.pants;
        cur.accessory = a.accessory;
        cur.hair = a.hair;
        cur.faceSeed = a.faceSeed;
        cur.faceSpec = a.faceSpec ?? null;
        cur.faceKey = faceKeyFor(a.faceSpec ?? null, a.faceSeed ?? a.key);
        cur.behavior = a.behavior;
        cur.speed = a.speed;
        if (!a.wander) {
          cur.tx = loc?.x ?? cur.tx;
          cur.tz = loc?.z ?? cur.tz;
        }
        if (switched && a.isSelf && loc) {
          // new city: come in from the real direction of the city you left (Hong Kong → Shenzhen walks north over the border)
          const arr = p.arrival;
          const len = arr ? Math.hypot(arr.dx, arr.dz) || 1 : 1;
          cur.x = loc.x - (arr ? (arr.dx / len) * 5 : 0);
          cur.z = loc.z - (arr ? (arr.dz / len) * 5 : 0);
        } else if (switched && loc) {
          cur.x = cur.tx; cur.z = cur.tz;
        }
      }
    };
    const selfOutfit = outfitOf(p.selfOutfitId ?? "casual");
    // The figure moves at the SELECTED MODE's real map speed — walking is
    // visibly slow, a taxi crosses the miniature ~3× faster, rail fastest.
    // App's trip timer derives from the same table, so arrival matches.
    const selfSpeed = modeById((p.travelModeId ?? "walk") as TransportModeId).mapSpeed;
    upsert({ key: "self", name: p.selfName, emoji: p.selfEmoji, color: p.selfColor, isSelf: true, seed: 7, faceSeed: p.selfFaceId ?? `player-${p.selfEmoji}`, faceSpec: p.selfFaceSpec ?? null, heading: 0, phase: 0, blend: 0, startLoc: p.selfLocId, shirt: selfOutfit.shirt, pants: selfOutfit.pants, accessory: p.selfAccessory && p.selfAccessory !== "none" ? p.selfAccessory : (selfOutfit.id === "formal" ? "tie" : "none"), hair: p.selfHair ?? 0, behavior: "self", speed: selfSpeed });
    for (const rp of p.remotePlayers) {
      upsert({ key: `p-${rp.id}`, name: rp.name, emoji: rp.emoji, color: rp.color, seed: hash(rp.id), faceSeed: rp.id, faceSpec: rp.faceSpec ?? null, heading: 0, phase: hash(rp.id) % 6, blend: 0, startLoc: rp.locId, shirt: rp.color, pants: 0x2e3440, accessory: ACCESSORIES[rp.accessory ?? 0]?.id ?? "none", hair: rp.hair ?? hash(rp.id) % 4, behavior: "wander", speed: 2.4 });
    }
    /* NPCs keep a quiet city company: each real player in town sends one neighbour home
       (at least two stay), so the map belongs to real people as soon as they show up.
       Round-3 (C): npcAllowedAt decides where an NPC may stand — an NPC whose
       onlyLocIds matches nothing in this city (e.g. 郭叔, onlyLocIds: [], no
       real wet market in Huizhou yet) is not placed at all, instead of
       falling back to a random corner. */
    const cast = npcsForCity(p.cityKey).filter((n) => !n.onlyLocIds || locs.some((l) => npcAllowedAt(n, l)));
    cast.slice(0, Math.max(2, cast.length - p.remotePlayers.length)).forEach((n, i) => {
      const preferred = locs.filter((l) => npcAllowedAt(n, l));
      const pool = preferred.length > 0 ? preferred : locs;
      const loc = pool[(hash(n.name) + i) % pool.length];
      /* 路人走路的速度：不能比玩家步行（2.6）快，不然满街都是跑步的人。
         普通路人 1.8 是散步，通勤族 2.6 是赶路的快走（等于玩家步行），
         巡逻 2.0 是稳步，守摊/守工位 1.4 是慢挪。之前 wander 4.2 =
         玩家跑步速度、commute 5.6 比玩家跑步还快，所以看着像在 sprint。 */
      const speed = n.behavior === "commute" ? 2.6 : n.behavior === "patrol" ? 2.0 : n.behavior === "stay" ? 1.4 : 1.8;
      upsert({ key: `npc-${n.name}`, name: `${n.name}·${n.job}${p.npcMoodEmoji?.[n.name] ? ` ${p.npcMoodEmoji[n.name]}` : ""}`, emoji: n.emoji, color: n.color, wander: true, seed: hash(n.name), faceSeed: n.name, heading: 0, phase: hash(n.name) % 6, blend: 0, startLoc: loc?.id ?? "home", shirt: n.shirt, pants: n.pants, accessory: n.accessory, hair: hash(n.name) % 4, behavior: n.behavior, speed });
    });
    // NPC schedules: the beat changes with the real hour, and when it does
    // the NPC visibly travels to the new anchor across the map (commuting
    // to work, heading out for lunch, going home at night) instead of
    // teleporting or drifting at random.
    const hourNow = Math.floor(currentPhase() * 24);
    for (const n of npcsForCity(p.cityKey)) {
      const a = actors.get(`npc-${n.name}`);
      if (!a) continue;
      const anchorId = npcAnchorLocId(n, hourNow, locs);
      const loc = byId.get(anchorId);
      if (!loc) continue;
      a.ax = loc.x;
      a.az = loc.z;
      if (npcAnchorRef.current.get(n.name) !== anchorId) {
        npcAnchorRef.current.set(n.name, anchorId);
        a.tx = loc.x + ((a.seed % 5) - 2) * 0.4;
        a.tz = loc.z + ((a.seed % 3) - 1) * 0.4;
      }
    }
    for (const key of Array.from(actors.keys())) {
      if (!want.has(key)) actors.delete(key);
    }
  }, [p.cityKey, p.selfLocId, p.selfEmoji, p.selfColor, p.selfName, remoteKey, p.selfOutfitId, p.selfHair, p.selfAccessory, moodKey, p.travelModeId, faceKeyFor(p.selfFaceSpec ?? null, p.selfFaceId ?? `player-${p.selfEmoji}`)]);

  // Build/rebuild the whole 3D scene when the city changes.
  useEffect(() => {
    const mount = mountRef.current;
    const labels = labelsRef.current;
    if (!mount || !labels) return;
    const cityKey = propsRef.current.cityKey;
    const locs = getLocations(cityKey);
    // ROUND-10: scene rebuild (city change) drops the old facade targets;
    // the street-mode refresh loop re-applies facades for the new city.
    streetFacadeTargetsRef.current = [];
    streetFacadeRef.current = [];
    streetFacadeMatsRef.current = [];
    /* ROUND-2 (a) wider streets: the map's roads read cramped ("太急了").
       Safest fix — do NOT rescale the canvas / move any place: widen every
       road at the source (×1.35, so 深南大道 2.8 → 3.8). Every downstream
       use reads r.w (road mesh, viaduct, sidewalks, zebra stop lines,
       lamps, nearRoad clearance, shop offsets, pedestrian pavements), so
       the whole street cross-section breathes out together and all place
       positions, landAt(), metro lines and camera framing stay untouched.
       ROUND-6: still too narrow / the map reads thin ("瘦") — bump to
       ×1.8 (深南大道 2.8 → 5.0) and widen the sidewalks to match, so the
       whole street corridor scales up proportionally. */
    const SIDEWALK_W = 1.5;
    const roads: Road[] = ROADS[cityKey].map((r) => ({ ...r, w: r.w * ROAD_W }));
    const flagMeshes: THREE.Mesh[] = [];
    const wheelGroups: THREE.Object3D[] = [];
    const rnd = mulberry(cityKey === "sz" ? 2026 : cityKey === "hk" ? 2088 : 2077);

    // WebGL can be unavailable or refuse a context in some webviews (the
    // Mac app's WKWebView among them). That must degrade to the location
    // list below, never throw and unmount the whole game.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    } catch {
      setGlFailed(true);
      return;
    }
    const lite = !!propsRef.current.lite;
    /* Adaptive resolution: start sharp — a phone at its native density (up to
       3×), a desktop at up to 2× — then watch the frame rate and step down
       (3× → 2× → 1.5× → 1×) when the device can't keep up, or back up once
       when it runs smoothly. Text and labels are HTML and always native. */
    const dpr = window.devicePixelRatio || 1;
    const phoneLike = lite || window.innerWidth < 768 || (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches);
    /* ROUND-7 desktop-only visual effects (rain-wet streets, neon night,
       procedural textures, warm night haze): only on a real desktop — fine
       pointer, not phone-like, not lite. Phones keep the exact previous
       look and cost; nothing below runs for them. */
    const pointerFine = typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches;
    const desktopFxOn = !lite && !phoneLike && pointerFine;
    const dfx: DesktopFx | null = desktopFxOn ? makeDesktopFx() : null;
    const prTop = Math.min(phoneLike ? 3 : 2, dpr);
    const prLadder = [prTop, 2, 1.5, 1].filter((v, i, a) => v <= prTop && a.indexOf(v) === i);
    let prIdx = 0;
    renderer.setPixelRatio(prLadder[0]!);
    renderer.shadowMap.enabled = !lite;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab;";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd9e8);
    scene.fog = new THREE.Fog(0xbfd9e8, 120, 240);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);

    // Cinematic post chain (PC high-end): bloom for lit windows / neon /
    // streetlights, warm grade + tilt-shift depth of field over the
    // miniature. Falls back to the plain renderer if it can't initialise.
    const fx: PostFx | null = lite ? null : makePostFx(renderer, scene, camera, { bloomStrength: 0.33, bloomThreshold: 0.8, blur: 0.0038 });

    const hemi = new THREE.HemisphereLight(0xdff2ff, 0x8a7a5a, 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -55;
    sun.shadow.camera.right = 55;
    sun.shadow.camera.top = 55;
    sun.shadow.camera.bottom = -55;
    sun.shadow.camera.far = 260;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 6;
    scene.add(sun);
    scene.add(sun.target);
    const amb = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(amb);
    // cool moonlight fill so nights keep shape instead of going flat black
    const moon = new THREE.DirectionalLight(0x8fb6ff, 0);
    moon.position.set(-40, 60, -30);
    scene.add(moon);
    // warm pool of light that follows the player after dark
    const playerLight = new THREE.PointLight(0xffc98a, 0, 14, 1.8);
    playerLight.position.set(0, 3.4, 0);
    scene.add(playerLight);

    /* the train the player rides on metro / rail trips: a short metro set
       in the line colour, or a longer white high-speed set with a coloured
       stripe; cars follow the head along the line */
    const trainGroup = new THREE.Group();
    trainGroup.visible = false;
    const trainBodyMat = new THREE.MeshStandardMaterial({ color: 0x0096d6, roughness: 0.45, metalness: 0.25 });
    const trainWinMat = new THREE.MeshStandardMaterial({ color: 0x1b2633, roughness: 0.2, metalness: 0.4, emissive: 0xffe6a8, emissiveIntensity: 0.35 });
    const trainRoofMat = new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.6 });
    const trainCars: THREE.Group[] = [];
    for (let i = 0; i < 6; i++) {
      const car = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 1.45), trainBodyMat); body.position.y = 0.32; body.castShadow = true; car.add(body);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.16, 1.2), trainWinMat); win.position.y = 0.42; car.add(win);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.06, 1.38), trainRoofMat); roof.position.y = 0.6; car.add(roof);
      if (i === 0) { const nose = new THREE.Mesh(new THREE.ConeGeometry(0.31, 0.5, 4), trainBodyMat); nose.rotation.x = Math.PI / 2; nose.rotation.z = Math.PI / 4; nose.position.set(0, 0.32, 0.95); car.add(nose); }
      trainGroup.add(car); trainCars.push(car);
    }
    scene.add(trainGroup);
    // swap in the Kenney trains once they load: subway set for metro, bullet set for high-speed / intercity
    const trainModels: { metro: THREE.Group[]; rail: THREE.Group[] }[] = trainCars.map(() => ({ metro: [], rail: [] }));
    let trainModelsReady = false;
    void Promise.all(["subway-a", "subway-b", "subway-c", "bullet-a", "bullet-b", "bullet-c"].map((n) => loadModel(`train/train-electric-${n}.glb`))).then((ms) => {
      if (ms.some((m) => !m)) return;
      trainCars.forEach((car, ci) => {
        for (const [kind, off] of [["metro", 0], ["rail", 3]] as const) {
          for (let v = 0; v < 3; v++) {
            const g = fittedClone(ms[off + v]!, 1.5);
            g.visible = false; g.userData.v = v; car.add(g); trainModels[ci]![kind].push(g);
          }
        }
      });
      trainModelsReady = true;
    });
    let trainKey = ""; let trainIdx = -1; let trainSince = 0; let selfOnTrain = false;
    const trainPos = { x: 0, z: 0, active: false };
    /* round-3 (C): the following pet — one makePetGroup model, rebuilt only
       when the pet itself changes (id / kind / colour); the scene rebuild
       on city change resets these, and the runtime ref restarts at the
       player's feet. petPhase is the walk-cycle clock for the leg swing. */
    let petGroup: THREE.Group | null = null;
    let petGroupKey = "";
    let petPhase = 0;

    /* registries for materials the frame loop animates with the day cycle */
    const buildingMats: THREE.MeshStandardMaterial[] = [];
    const neonMats: THREE.MeshStandardMaterial[] = [];
    const avLights: THREE.Mesh[] = [];
    const smokeSprites: { sp: THREE.Sprite; phase: number; x: number; z: number }[] = [];
    let foamMat: THREE.MeshBasicMaterial | null = null;
    let bulbMat: THREE.MeshStandardMaterial | null = null;
    let glowMat: THREE.SpriteMaterial | null = null;
    let fillerMat: THREE.MeshStandardMaterial | null = null;

    /* ---- water & land ----
       ROUND-2 (a) real-time water shader (Three.js Water-example pattern:
       vertex waves + scrolling normal ripples + Fresnel + depth colour +
       shoreline foam). The sea is a segmented plane whose vertices heave
       with summed sines; the fragment shader perturbs the normal with
       scrolling procedural noise, mixes deep/shallow colour, adds a
       Fresnel sky tint + sun glint, and foams where the water meets the
       coast (coastZ is reproduced in-shader from per-city coefficients).
       Inland water (TERRAIN WATER polygons) shares the same shader with
       foam off — same uniforms, so one loop update drives both. Rivers
       stay on waterMat (thin ribbons; a vertex shader buys nothing there).
       coastZ() / landAt() behaviour is untouched. */
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x2e7fb8, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.9 });
    const coastCoeff: [number, number, number, number, number, number] =
      cityKey === "sz" ? [16.6, 0.1, 1.1, 0.23, 0.7, 1.7] :
      cityKey === "hk" ? [21.6, 0.08, 1.0, 0.19, 0.6, 0.4] :
      [14.6, 0.09, 1.2, 0.21, 0.7, 0.6];
    const waterUniforms = {
      uTime: { value: 0 },
      uDayF: { value: 1 },
      uNightF: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3) },
      uCoast: { value: new THREE.Vector4(coastCoeff[0], coastCoeff[1], coastCoeff[2], coastCoeff[3]) },
      uCoast2: { value: new THREE.Vector2(coastCoeff[4], coastCoeff[5]) },
      uFoam: { value: 1 },
    };
    const waterVert = `
      uniform float uTime;
      varying vec3 vPos;
      varying vec3 vNormalW;
      void main() {
        vec3 p = position;
        float w = sin(p.x * 0.35 + uTime * 1.1) * 0.09
          + sin(p.z * 0.28 - uTime * 0.8) * 0.07
          + sin((p.x + p.z) * 0.16 + uTime * 0.5) * 0.05;
        p.y += w;
        // world position: the foam band compares against the world-space
        // coast line, and the sea mesh sits at z = +4, so local z is off
        vPos = (modelMatrix * vec4(p, 1.0)).xyz;
        // analytic-ish normal from the wave slopes
        float dx = 0.35 * 0.09 * cos(p.x * 0.35 + uTime * 1.1) + 0.16 * 0.05 * cos((p.x + p.z) * 0.16 + uTime * 0.5);
        float dz = 0.28 * 0.07 * cos(p.z * 0.28 - uTime * 0.8) + 0.16 * 0.05 * cos((p.x + p.z) * 0.16 + uTime * 0.5);
        vNormalW = normalize(vec3(-dx, 1.0, -dz));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`;
    const waterFrag = `
      uniform float uTime; uniform float uDayF; uniform float uNightF;
      uniform vec3 uSunDir; uniform vec4 uCoast; uniform vec2 uCoast2; uniform float uFoam;
      varying vec3 vPos; varying vec3 vNormalW;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        // scrolling ripple normal, two octaves drifting against each other
        float n1 = noise(vPos.xz * 0.55 + vec2(uTime * 0.22, uTime * 0.13));
        float n2 = noise(vPos.xz * 1.3 - vec2(uTime * 0.17, uTime * 0.29));
        vec3 n = normalize(vNormalW + vec3(n1 - 0.5, 0.0, n2 - 0.5) * 0.55);
        vec3 viewDir = normalize(cameraPosition - vPos);
        float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 3.0);
        // depth colour: shallow turquoise where the waves crest / near shore, deep blue out at sea
        float depthK = clamp(0.5 + vPos.y * 2.2 + (n1 - 0.5) * 0.4, 0.0, 1.0);
        vec3 deep = vec3(0.05, 0.32, 0.55);
        vec3 shallow = vec3(0.16, 0.62, 0.78);
        vec3 col = mix(deep, shallow, depthK);
        // Fresnel sky reflection + sun glint
        col = mix(col, vec3(0.62, 0.78, 0.88), fres * 0.65);
        float spec = pow(max(dot(reflect(-normalize(uSunDir), n), viewDir), 0.0), 90.0);
        col += vec3(1.0, 0.95, 0.8) * spec * (0.4 + 0.6 * uDayF);
        // shoreline foam: a breathing band just seaward of the coast line
        if (uFoam > 0.5) {
          float coast = uCoast.x + sin(vPos.x * uCoast.y) * uCoast.z + sin(vPos.x * uCoast.w + uCoast2.y) * uCoast2.x;
          float d = coast - vPos.z;
          float band = smoothstep(0.0, 0.9, d) * (1.0 - smoothstep(0.9, 2.6, d));
          float foamN = noise(vPos.xz * 2.2 + vec2(uTime * 0.6, -uTime * 0.4));
          float foam = band * smoothstep(0.35, 0.75, foamN + 0.25 * sin(uTime * 1.4 + vPos.x * 0.8));
          col = mix(col, vec3(0.96, 0.99, 1.0), clamp(foam, 0.0, 1.0) * 0.85);
        }
        // night: dark, moonlit water
        col = mix(col, col * vec3(0.16, 0.28, 0.48) + vec3(0.02, 0.05, 0.1), uNightF * 0.85);
        gl_FragColor = vec4(col, 0.82);
      }`;
    const makeWaterMat = (foam: number) => {
      const m = new THREE.ShaderMaterial({
        uniforms: {
          uTime: waterUniforms.uTime, uDayF: waterUniforms.uDayF, uNightF: waterUniforms.uNightF,
          uSunDir: waterUniforms.uSunDir, uCoast: waterUniforms.uCoast, uCoast2: waterUniforms.uCoast2,
          uFoam: { value: foam },
        },
        vertexShader: waterVert, fragmentShader: waterFrag,
        transparent: true, depthWrite: false,
      });
      return m;
    };
    const seaWaterMat = makeWaterMat(1);
    const lakeWaterMat = makeWaterMat(0);
    // The sea hugs the miniature (a margin around the land, not a 240×160
    // ocean): an oversized plane was most of the empty dark-blue area the
    // city used to float in. Geometry is baked flat (rotateX on the
    // geometry, not the mesh) so the shader's local +Y is world up.
    const seaGeo = new THREE.PlaneGeometry(168, 104, 96, 64);
    seaGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(seaGeo, seaWaterMat);
    water.position.set(0, 0, 4);
    water.renderOrder = 1;
    scene.add(water);
    // (rivers are real centrelines now — see TERRAIN[city].RIVERS below)
    // Hong Kong's Victoria Harbour: a real water channel cut between
    // Kowloon (north shore, Tsim Sha Tsui) and Hong Kong Island (south
    // shore, Central/Wan Chai) — the harbour IS the city's centre.
    // (Hong Kong's harbour is now the real gap between Kowloon and the
    // island: the land below is built from the OSM coastline.)
    // reservoirs & lakes as flat water patches in the land
    for (const lk of LAKES[cityKey]) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(lk.r, lk.r * 1.04, 0.12, 22), waterMat);
      disc.position.set(lk.x, LAND + 0.03, lk.z);
      disc.receiveShadow = true;
      scene.add(disc);
    }
    const landShapes: THREE.Shape[] = [];
    if (TERRAIN[cityKey].LAND.length) {
      // real islands, peninsulas and bays (OSM coastline)
      const toShape = (ring: [number, number][]) => { const sh = new THREE.Shape(); ring.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z))); return sh; };
      for (const poly of TERRAIN[cityKey].LAND) {
        const sh = toShape(poly[0]!);
        for (const hole of poly.slice(1)) sh.holes.push(toShape(hole));
        landShapes.push(sh);
      }
    } else {
      const landShape = new THREE.Shape();
      landShape.moveTo(-WORLD.x, -WORLD.zn);
      landShape.lineTo(WORLD.x, -WORLD.zn);
      for (let x = WORLD.x; x >= -WORLD.x; x -= 2) landShape.lineTo(x, -coastZ(cityKey, x));
      landShape.lineTo(-WORLD.x, -WORLD.zn);
      landShapes.push(landShape);
    }
    const landGeo = new THREE.ExtrudeGeometry(landShapes, { depth: LAND, bevelEnabled: false });
    landGeo.rotateX(-Math.PI / 2);
    const land = new THREE.Mesh(
      landGeo,
      new THREE.MeshStandardMaterial({ color: cityKey === "sz" ? 0xd9cfae : 0xcfd6a8, roughness: 1 }),
    );
    land.receiveShadow = true;
    scene.add(land);
    // hinterland: neighbouring land continuing off the map edge (Dongguan /
    // Huizhou / Hong Kong New Territories) — a thin ring around the city,
    // so the city no longer reads as an island. It is NOT in TERRAIN LAND,
    // so isLand / nearestLand / click-to-walk stay inside the city (visual
    // only, you cannot walk off into Dongguan).
    // lee (2026-11-12): "四周加一圈边缘就好……不要这么多" — the first
    // version was a huge solid deck, then a 35-unit fade was still too
    // much land. So the fade is now the same short one ACROSS uses:
    // solid within ~2 units of the city border, dithered out by ~10 — a
    // narrow ring, sea where it's sea (the water plane shows), land where
    // it's land (the ring). Same land colour as the city (no colour step
    // at the border). +0.02 lift: it overlaps the faded ACROSS where the
    // two meet (the NT), and a coplanar deck would z-fight with it.
    if (TERRAIN[cityKey].HINTERLAND.length) {
      const toShapeH = (ring: [number, number][]) => { const sh = new THREE.Shape(); ring.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z))); return sh; };
      const hShapes = TERRAIN[cityKey].HINTERLAND.map((poly) => { const sh = toShapeH(poly[0]!); for (const hole of poly.slice(1)) sh.holes.push(toShapeH(hole)); return sh; });
      const hGeo = new THREE.ExtrudeGeometry(hShapes, { depth: LAND, bevelEnabled: false });
      hGeo.rotateX(-Math.PI / 2);
      const ownPtsH: [number, number][] = [];
      for (const poly of TERRAIN[cityKey].LAND) { const ring = poly[0] ?? []; const step = Math.max(1, Math.floor(ring.length / 600)); for (let i = 0; i < ring.length; i += step) ownPtsH.push(ring[i]!); }
      const hinterPts: [number, number][] = [];
      for (const poly of TERRAIN[cityKey].HINTERLAND) { const ring = poly[0] ?? []; const step = Math.max(1, Math.floor(ring.length / 600)); for (let i = 0; i < ring.length; i += step) hinterPts.push(ring[i]!); }
      let borderH = ownPtsH.filter(([x, z]) => hinterPts.some(([hx, hz]) => (hx - x) ** 2 + (hz - z) ** 2 < 2.25));
      if (borderH.length === 0) borderH = ownPtsH;
      const NH = 64;
      const pickH: THREE.Vector2[] = [];
      for (let i = 0; i < NH; i++) { const p = borderH[Math.floor((i * borderH.length) / NH)] ?? borderH[0]!; pickH.push(new THREE.Vector2(p[0], p[1])); }
      const hinterMat = new THREE.MeshStandardMaterial({ color: cityKey === "sz" ? 0xd9cfae : 0xcfd6a8, roughness: 1 });
      hinterMat.onBeforeCompile = (sh) => {
        sh.uniforms.uBorder = { value: pickH };
        sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vXZ;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvXZ = (modelMatrix * vec4(transformed, 1.0)).xz;");
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vXZ;\nuniform vec2 uBorder[64];").replace("#include <dithering_fragment>", "#include <dithering_fragment>\nfloat bd = 1e9; for (int i = 0; i < 64; i++) { bd = min(bd, distance(vXZ, uBorder[i])); }\nfloat fade = 1.0 - smoothstep(2.0, 10.0, bd); float nz = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453); if (fade < nz) discard;");
      };
      const hinter = new THREE.Mesh(hGeo, hinterMat);
      hinter.position.y = 0.02;
      hinter.receiveShadow = true;
      scene.add(hinter);
    }
    // the neighbour across the border (Hong Kong from Shenzhen and vice versa): seen, not walked
    if (TERRAIN[cityKey].ACROSS.length) {
      const toShape2 = (ring: [number, number][]) => { const sh = new THREE.Shape(); ring.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z))); return sh; };
      const shapes = TERRAIN[cityKey].ACROSS.map((poly) => { const sh = toShape2(poly[0]!); for (const hole of poly.slice(1)) sh.holes.push(toShape2(hole)); return sh; });
      const g2 = new THREE.ExtrudeGeometry(shapes, { depth: LAND, bevelEnabled: false });
      g2.rotateX(-Math.PI / 2);
      /* only a band of the neighbour shows: solid within ~2 units of the shared
         border, fading out by ~10 — the border reads clearly without a big grey
         block filling the screen (portrait phones see far to the south). The
         fade is per pixel (distance to sampled border points), so big
         triangles don't smear it. The neighbour is extruded to the same height
         as our own land (not lower): a step at the border reads as a cut. */
      const ownPts: [number, number][] = [];
      for (const poly of TERRAIN[cityKey].LAND) { const ring = poly[0] ?? []; const step = Math.max(1, Math.floor(ring.length / 600)); for (let i = 0; i < ring.length; i += step) ownPts.push(ring[i]!); }
      const acrossPts: [number, number][] = [];
      for (const poly of TERRAIN[cityKey].ACROSS) { const ring = poly[0] ?? []; const step = Math.max(1, Math.floor(ring.length / 600)); for (let i = 0; i < ring.length; i += step) acrossPts.push(ring[i]!); }
      let border = ownPts.filter(([x, z]) => acrossPts.some(([ax, az]) => (ax - x) ** 2 + (az - z) ** 2 < 2.25));
      if (border.length === 0) border = ownPts;
      const N = 64;
      const pick: THREE.Vector2[] = [];
      for (let i = 0; i < N; i++) { const p = border[Math.floor((i * border.length) / N)] ?? border[0]!; pick.push(new THREE.Vector2(p[0], p[1])); }
      const acrossMat = new THREE.MeshStandardMaterial({ color: 0xb3b598, roughness: 1 });
      acrossMat.onBeforeCompile = (sh) => {
        sh.uniforms.uBorder = { value: pick };
        sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vXZ;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvXZ = (modelMatrix * vec4(transformed, 1.0)).xz;");
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vXZ;\nuniform vec2 uBorder[64];").replace("#include <dithering_fragment>", "#include <dithering_fragment>\nfloat bd = 1e9; for (int i = 0; i < 64; i++) { bd = min(bd, distance(vXZ, uBorder[i])); }\nfloat fade = 1.0 - smoothstep(2.0, 10.0, bd); float nz = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453); if (fade < nz) discard;");
      };
      const across = new THREE.Mesh(g2, acrossMat);
      across.receiveShadow = true;
      scene.add(across);
    }
    // beach strip along the coast
    const beachMat = new THREE.MeshStandardMaterial({ color: 0xead9a0, roughness: 1 });
    for (let x = -WORLD.x; x < WORLD.x && !TERRAIN[cityKey].LAND.length; x += 2) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 1.6), beachMat);
      seg.position.set(x + 1, LAND - 0.18, coastZ(cityKey, x + 1) + 0.7);
      seg.receiveShadow = true;
      scene.add(seg);
    }
    // foam line where the water meets the sand, breathing with the waves
    foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
    {
      // reservoirs and lakes as water set into the land — same shader as
      // the sea (ripples + depth colour, no shoreline foam: no coast here)
      for (const poly of TERRAIN[cityKey].WATER) {
        const sh = new THREE.Shape(); poly[0]!.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)));
        const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2);
        const m = new THREE.Mesh(g, lakeWaterMat); m.position.y = LAND + 0.03; m.receiveShadow = true; m.renderOrder = 1; scene.add(m);
      }
      // real bridges: deck, two towers, main cables (青马、汲水门、汀九、昂船洲、深圳湾…)
      const deckMat = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.6 });
      const towerMat = new THREE.MeshStandardMaterial({ color: 0xd9d2c3, roughness: 0.8 });
      const cableMat = new THREE.MeshStandardMaterial({ color: 0xcfd5db, roughness: 0.4, metalness: 0.3 });
      // rivers: ribbons along their real centrelines
      for (const rv of TERRAIN[cityKey].RIVERS) {
        for (let i = 1; i < rv.pts.length; i++) {
          const [ax, az] = rv.pts[i - 1]!, [bx, bz] = rv.pts[i]!;
          const mx = (ax + bx) / 2, mz = (az + bz) / 2;
          // border rivers (深圳河) hug the edge of the land, so a segment's
          // midpoint can fall just off it — accept it if either end is on land,
          // so the river ribbon doesn't drop out right at the border seam
          if (!landAt(cityKey, mx, mz) && !landAt(cityKey, ax, az) && !landAt(cityKey, bx, bz)) continue;
          const len = Math.hypot(bx - ax, bz - az);
          const seg = new THREE.Mesh(new THREE.BoxGeometry(len + 0.25, 0.04, 0.55), waterMat);
          seg.position.set(mx, LAND + 0.02, mz); seg.rotation.y = -Math.atan2(bz - az, bx - ax); scene.add(seg);
        }
      }
      for (const b of TERRAIN[cityKey].BRIDGES) {
        const [ax, az] = b.a, [bx, bz] = b.b;
        const len = Math.hypot(bx - ax, bz - az); if (len < 0.5) continue;
        const ang = Math.atan2(bz - az, bx - ax);
        const g = new THREE.Group(); g.position.set((ax + bx) / 2, 0, (az + bz) / 2); g.rotation.y = -ang;
        const deck = new THREE.Mesh(new THREE.BoxGeometry(len + 0.6, 0.2, 0.9), deckMat); deck.position.y = LAND + 0.25; deck.castShadow = true; g.add(deck);
        const tH = 1.4 + Math.min(2.6, len * 0.35);
        for (const t of [-0.28, 0.28]) for (const s2 of [-0.4, 0.4]) {
          const tw = new THREE.Mesh(new THREE.BoxGeometry(0.16, tH, 0.16), towerMat); tw.position.set(t * len, LAND + tH / 2, s2); tw.castShadow = true; g.add(tw);
        }
        for (const s2 of [-0.4, 0.4]) {
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i <= 20; i++) { const u = -0.5 + i / 20; const xx = u * len; const top = LAND + tH; const y = Math.abs(u) > 0.28 ? LAND + 0.35 + (top - LAND - 0.35) * (0.5 - Math.abs(u)) / 0.22 : top - (top - LAND - 0.6) * (1 - Math.pow(u / 0.28, 2)); pts.push(new THREE.Vector3(xx, y, s2)); }
          g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.035, 4), cableMat));
        }
        scene.add(g);
      }
    }
    for (let x = -WORLD.x; x < WORLD.x && !TERRAIN[cityKey].LAND.length; x += 2) {
      const foam = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.04, 0.5), foamMat);
      foam.position.set(x + 1, 0.16, coastZ(cityKey, x + 1) + 1.75);
      scene.add(foam);
    }

    /* ---- roads ---- */
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x3c4148, roughness: 0.95 });
    // ROUND-7 desktop: procedural asphalt + rain-wet shader (phones: flat as before)
    if (dfx) {
      roadMat.map = dfx.asphaltTex;
      applyWetShader(roadMat, dfx.wet);
    }
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5e9b8 });
    const roadMeshes: THREE.Mesh[] = [];
    const viaductMat = new THREE.MeshStandardMaterial({ color: 0xbfc3c7, roughness: 0.8 });
    for (const r of roads) {
      const len = Math.hypot(r.x2 - r.x1, r.z2 - r.z1);
      const ang = Math.atan2(r.z2 - r.z1, r.x2 - r.x1);
      if (TERRAIN[cityKey].LAND.length) {
        // over water a road is a viaduct on piers — or, for the
        // cross-harbour tunnels, runs under the sea and is not drawn there.
        const tunnel = /隧道/.test(r.name ?? "");
        const n = Math.max(2, Math.ceil(len / 1.5));
        for (let i = 0; i < n; i++) {
          const t0 = i / n, t1 = (i + 1) / n, tm = (t0 + t1) / 2;
          const mx = r.x1 + (r.x2 - r.x1) * tm, mz = r.z1 + (r.z2 - r.z1) * tm;
          const dry = isLand(cityKey, mx, mz);
          if (!dry && tunnel) continue;
          const piece = new THREE.Mesh(new THREE.BoxGeometry(len / n + 0.02, dry ? 0.1 : 0.18, r.w), dry ? roadMat : viaductMat);
          piece.position.set(mx, LAND + 0.05, mz);
          piece.rotation.y = -ang;
          piece.receiveShadow = true;
          scene.add(piece);
          roadMeshes.push(piece);
          if (!dry && i % 2 === 0) { const pier = new THREE.Mesh(new THREE.BoxGeometry(0.3, LAND + 0.4, 0.3), viaductMat); pier.position.set(mx, (LAND - 0.4) / 2, mz); scene.add(pier); }
        }
      } else {
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, r.w), roadMat);
      m.position.set((r.x1 + r.x2) / 2, LAND + 0.05, (r.z1 + r.z2) / 2);
      m.rotation.y = -ang;
      m.receiveShadow = true;
      scene.add(m);
      roadMeshes.push(m);
      }
      const dashes = Math.floor(len / 2.4);
      const dashGeo = new THREE.BoxGeometry(1.1, 0.04, 0.16);
      const dash = new THREE.InstancedMesh(dashGeo, lineMat, Math.max(1, dashes));
      const mat4 = new THREE.Matrix4();
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -ang, 0));
      const tunnelHk = /隧道/.test(r.name ?? "");
      for (let i = 0; i < dashes; i++) {
        const t = (i + 0.5) / dashes;
        if (tunnelHk && !isLand(cityKey, r.x1 + (r.x2 - r.x1) * t, r.z1 + (r.z2 - r.z1) * t)) { mat4.makeScale(0, 0, 0); dash.setMatrixAt(i, mat4); continue; }
        mat4.compose(
          new THREE.Vector3(r.x1 + (r.x2 - r.x1) * t, LAND + 0.11, r.z1 + (r.z2 - r.z1) * t),
          quat,
          new THREE.Vector3(1, 1, 1),
        );
        dash.setMatrixAt(i, mat4);
      }
      scene.add(dash);
    }

    /* ---- streets at true scale: sidewalks, zebra crossings, traffic
       lights the traffic OBEYS ----
       The corridors stop being a model railway here. Every road gets a
       pavement on both sides; where two roads cross there is a zebra
       crossing and a working signal head for each approach. Signals run
       an 18-second cycle (offsets per junction so the city doesn't pulse
       in sync), and the traffic + pedestrian systems below brake for red
       lights, queue behind each other, and cross on their green. */
    interface IxStop { t: number; ix: number; slot: 0 | 1; back: number; other: Road; otherT: number }
    interface Ix { x: number; z: number }
    const roadLen = (r: Road) => Math.hypot(r.x2 - r.x1, r.z2 - r.z1);
    const segIx = (a: Road, b: Road) => {
      const d1x = a.x2 - a.x1, d1z = a.z2 - a.z1;
      const d2x = b.x2 - b.x1, d2z = b.z2 - b.z1;
      const den = d1x * d2z - d1z * d2x;
      if (Math.abs(den) < 1e-6) return null;
      const ex = b.x1 - a.x1, ez = b.z1 - a.z1;
      const ta = (ex * d2z - ez * d2x) / den;
      const tb = (ex * d1z - ez * d1x) / den;
      if (ta < 0.03 || ta > 0.97 || tb < 0.03 || tb > 0.97) return null;
      return { x: a.x1 + d1x * ta, z: a.z1 + d1z * ta, ta, tb };
    };
    const ixs: Ix[] = [];
    const roadStops = new Map<Road, IxStop[]>();
    const addStop = (r: Road, s: IxStop) => {
      const arr = roadStops.get(r) ?? [];
      arr.push(s);
      roadStops.set(r, arr);
    };
    for (let i = 0; i < roads.length; i++) {
      for (let j = i + 1; j < roads.length; j++) {
        const hit = segIx(roads[i]!, roads[j]!);
        if (!hit) continue;
        const ixIdx = ixs.length;
        ixs.push({ x: hit.x, z: hit.z });
        addStop(roads[i]!, { t: hit.ta, ix: ixIdx, slot: 0, back: roads[j]!.w / 2 + 1.15, other: roads[j]!, otherT: hit.tb });
        addStop(roads[j]!, { t: hit.tb, ix: ixIdx, slot: 1, back: roads[i]!.w / 2 + 1.15, other: roads[i]!, otherT: hit.ta });
      }
    }
    const TL_CYCLE = 18;
    const tlPhaseAt = (ix: number, tSec: number) => (((tSec + ix * 3.7) % TL_CYCLE) + TL_CYCLE) % TL_CYCLE;
    /* slot 0 runs first (0–8s green), then slot 1 (9.2–17.2s); the gaps are
       the amber/all-red changeover. Pedestrians may cross a road while the
       OTHER approach has the green (or during the changeover). */
    const tlGreen = (ix: number, slot: 0 | 1, tSec: number) => {
      const ph = tlPhaseAt(ix, tSec);
      return slot === 0 ? ph < 8 : ph >= 9.2 && ph < 17.2;
    };
    const tlYellow = (ix: number, slot: 0 | 1, tSec: number) => {
      const ph = tlPhaseAt(ix, tSec);
      return slot === 0 ? ph >= 8 && ph < 9.2 : ph >= 17.2;
    };
    const tlPedGreen = (ix: number, slot: 0 | 1, tSec: number) => {
      const ph = tlPhaseAt(ix, tSec);
      if (ph >= 8 && ph < 9.2) return true; // changeover: both approaches stopped
      return slot === 0 ? ph >= 9.2 && ph < 17.2 : ph < 8 || ph >= 17.2;
    };
    // sidewalks: a pale pavement strip hugging both sides of every road
    {
      const paveMat = new THREE.MeshStandardMaterial({ color: 0xcfc8b2, roughness: 1 });
      // ROUND-7 desktop: procedural concrete + rain-wet shader (phones: flat as before)
      if (dfx) {
        paveMat.map = dfx.concreteTex;
        applyWetShader(paveMat, dfx.wet);
      }
      for (const r of roads) {
        const len = roadLen(r);
        const ang = Math.atan2(r.z2 - r.z1, r.x2 - r.x1);
        for (const side of [1, -1]) {
          const off = (r.w / 2 + SIDEWALK_W / 2 - 0.075) * side;
          if (TERRAIN[cityKey].LAND.length) {
            // pavements only where the road is on land (not along viaducts / tunnels)
            const n = Math.max(2, Math.ceil(len / 1.5));
            for (let i = 0; i < n; i++) {
              const tm = (i + 0.5) / n;
              const mx = r.x1 + (r.x2 - r.x1) * tm + Math.sin(ang) * off, mz = r.z1 + (r.z2 - r.z1) * tm - Math.cos(ang) * off;
              if (!isLand(cityKey, mx, mz)) continue;
              const pm = new THREE.Mesh(new THREE.BoxGeometry(len / n + 0.02, 0.07, SIDEWALK_W), paveMat);
              pm.position.set(mx, LAND + 0.045, mz); pm.rotation.y = -ang; pm.receiveShadow = true; scene.add(pm);
            }
            continue;
          }
          const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, SIDEWALK_W), paveMat);
          m.position.set((r.x1 + r.x2) / 2 + Math.sin(ang) * off, LAND + 0.045, (r.z1 + r.z2) / 2 - Math.cos(ang) * off);
          m.rotation.y = -ang;
          m.receiveShadow = true;
          scene.add(m);
        }
      }
    }
    // zebra crossings: one instanced set of white bars at every junction,
    // across each approach road, just before its stop line
    {
      const mats4: THREE.Matrix4[] = [];
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const one = new THREE.Vector3(1, 1, 1);
      for (let ii = 0; ii < ixs.length; ii++) {
        const ix = ixs[ii]!;
        for (const r of roads) {
          const stops = roadStops.get(r);
          const st = stops?.find((s) => s.ix === ii);
          if (!st) continue;
          const ang = Math.atan2(r.z2 - r.z1, r.x2 - r.x1);
          const dirx = Math.cos(ang), dirz = Math.sin(ang);
          const cx = ix.x, cz = ix.z;
          for (const sgn of [1, -1]) {
            const bx = cx + dirx * (st.back + 0.55) * sgn;
            const bz = cz + dirz * (st.back + 0.55) * sgn;
            q.setFromEuler(new THREE.Euler(0, -ang, 0));
            const bars = Math.max(3, Math.floor(r.w / 0.62));
            for (let b = 0; b < bars; b++) {
              const off = (b - (bars - 1) / 2) * 0.62;
              m4.compose(new THREE.Vector3(bx + Math.sin(ang) * off, LAND + 0.12, bz - Math.cos(ang) * off), q, one);
              mats4.push(m4.clone());
            }
          }
        }
      }
      if (mats4.length > 0) {
        const zebra = new THREE.InstancedMesh(new THREE.BoxGeometry(0.85, 0.03, 0.3), new THREE.MeshBasicMaterial({ color: 0xf4f1e6, transparent: true, opacity: 0.85 }), mats4.length);
        mats4.forEach((mm, i) => zebra.setMatrixAt(i, mm));
        scene.add(zebra);
      }
    }
    // signal heads: two per junction (one per approach), lamps lit by phase
    interface LightHead { ix: number; slot: 0 | 1; red: THREE.MeshStandardMaterial; yel: THREE.MeshStandardMaterial; grn: THREE.MeshStandardMaterial }
    const lightHeads: LightHead[] = [];
    {
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.7, metalness: 0.4 });
      const lampGeo = new THREE.SphereGeometry(0.1, 8, 8);
      for (let ii = 0; ii < ixs.length; ii++) {
        const ix = ixs[ii]!;
        for (const r of roads) {
          const st = roadStops.get(r)?.find((s) => s.ix === ii);
          if (!st) continue;
          const ang = Math.atan2(r.z2 - r.z1, r.x2 - r.x1);
          // pole on the right-hand corner of this approach
          const pxv = ix.x + Math.cos(ang) * (st.back + 1.7) + Math.sin(ang) * (r.w / 2 + 0.75);
          const pzv = ix.z + Math.sin(ang) * (st.back + 1.7) - Math.cos(ang) * (r.w / 2 + 0.75);
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.5, 6), poleMat);
          pole.position.set(pxv, LAND + 1.25, pzv);
          scene.add(pole);
          const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.86, 0.22), poleMat);
          headBox.position.set(pxv, LAND + 2.72, pzv);
          headBox.rotation.y = -ang;
          scene.add(headBox);
          const mkLampMat = (em: number) => new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.4, emissive: em, emissiveIntensity: 0.12 });
          const red = mkLampMat(0xff2a1e);
          const yel = mkLampMat(0xffb020);
          const grn = mkLampMat(0x2ee66b);
          const lampOffs: [THREE.MeshStandardMaterial, number][] = [[red, 0.28], [yel, 0], [grn, -0.28]];
          for (const [lm, dy] of lampOffs) {
            const lamp = new THREE.Mesh(lampGeo, lm);
            lamp.position.set(pxv - Math.cos(ang) * 0.13, LAND + 2.72 + dy, pzv - Math.sin(ang) * 0.13);
            scene.add(lamp);
          }
          lightHeads.push({ ix: ii, slot: st.slot, red, yel, grn });
        }
      }
    }

    /* ---- streetlights along the roads (glow wakes up at dusk) ---- */
    {
      const glowTex = glowTexture();
      const lampGlowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffca7a, transparent: true, opacity: 0, depthWrite: false });
      glowMat = lampGlowMat;
      bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff3cf, roughness: 0.4, emissive: 0xffc873, emissiveIntensity: 0.15 });
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.8 });
      const lampPts: { x: number; z: number }[] = [];
      for (const r of roads) {
        const len = Math.hypot(r.x2 - r.x1, r.z2 - r.z1);
        const ang = Math.atan2(r.z2 - r.z1, r.x2 - r.x1);
        const n = Math.max(1, Math.floor(len / 7));
        for (let i = 0; i <= n; i++) {
          const t = (i + 0.5) / (n + 1);
          const side = i % 2 === 0 ? 1 : -1;
          const off = (r.w / 2 + 0.55) * side;
          lampPts.push({ x: r.x1 + (r.x2 - r.x1) * t + Math.sin(ang) * off, z: r.z1 + (r.z2 - r.z1) * t - Math.cos(ang) * off });
        }
      }
      const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.07, 1.7, 6), poleMat, lampPts.length);
      const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 10, 8), bulbMat, lampPts.length);
      const m4 = new THREE.Matrix4();
      lampPts.forEach((pt, i) => {
        m4.makeTranslation(pt.x, LAND + 0.85, pt.z);
        poles.setMatrixAt(i, m4);
        m4.makeTranslation(pt.x, LAND + 1.78, pt.z);
        bulbs.setMatrixAt(i, m4);
        const glow = new THREE.Sprite(lampGlowMat);
        glow.scale.set(2.6, 2.6, 1);
        glow.position.set(pt.x, LAND + 1.78, pt.z);
        scene.add(glow);
      });
      scene.add(poles);
      scene.add(bulbs);
    }

    /* ---- metro / intercity lines ----
       ~380 stations on ~20 lines: track segments and station markers are
       instanced (3 draw calls in total) instead of 2 meshes per station. */
    const stationMarks: { name: string; x: number; z: number; hasLoc: boolean }[] = [];
    {
      const lines = metroLinesForCity(cityKey);
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const eul = new THREE.Euler();
      const scl = new THREE.Vector3();
      const pos = new THREE.Vector3();
      const col = new THREE.Color();
      const nSeg = lines.reduce((n, l) => n + Math.max(0, l.stations.length - 1), 0);
      const segs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.06, 0.42), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55 }), Math.max(1, nSeg));
      let si = 0;
      const marks = new Map<string, { x: number; z: number; color: number; n: number; hasLoc: boolean }>();
      for (const line of lines) {
        const pts = line.stations.map((st) => new THREE.Vector3(st.x, LAND + 0.22, st.z));
        if (pts.length > 1) {
          scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: line.color, transparent: true, opacity: 0.92 })));
          for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i]!; const b = pts[i + 1]!;
            const len = Math.hypot(b.x - a.x, b.z - a.z);
            q.setFromEuler(eul.set(0, -Math.atan2(b.z - a.z, b.x - a.x), 0));
            m4.compose(pos.set((a.x + b.x) / 2, LAND + 0.16, (a.z + b.z) / 2), q, scl.set(len, 1, 1));
            segs.setMatrixAt(si, m4);
            segs.setColorAt(si, col.setHex(line.color));
            si++;
          }
        }
        for (const st of line.stations) {
          if (st.name.endsWith("方向")) continue; // direction stub, not a station
          const cur = marks.get(st.name);
          if (cur) { cur.n++; cur.hasLoc ||= !!st.locId; }
          else marks.set(st.name, { x: st.x, z: st.z, color: line.color, n: 1, hasLoc: !!st.locId });
        }
      }
      segs.count = si;
      scene.add(segs);
      const ringGeo = new THREE.RingGeometry(0.72, 1, 16);
      ringGeo.rotateX(-Math.PI / 2);
      const dots = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.22, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), Math.max(1, marks.size));
      const rings = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), Math.max(1, marks.size));
      let mi = 0;
      q.identity();
      for (const [name, mk] of marks) {
        const r = mk.hasLoc ? 0.42 : mk.n > 1 ? 0.33 : 0.22;
        m4.compose(pos.set(mk.x, LAND + 0.28, mk.z), q, scl.set(r, 1, r));
        dots.setMatrixAt(mi, m4);
        m4.compose(pos.set(mk.x, LAND + 0.3, mk.z), q, scl.set(r * 1.4, 1, r * 1.4));
        rings.setMatrixAt(mi, m4);
        rings.setColorAt(mi, col.setHex(mk.n > 1 ? 0x1f2937 : mk.color));
        stationMarks.push({ name, x: mk.x, z: mk.z, hasLoc: mk.hasLoc });
        mi++;
      }
      dots.count = mi;
      rings.count = mi;
      scene.add(dots);
      scene.add(rings);
    }

    /* ---- real places (OSM): one instanced pin per park / mall / museum … ---- */
    const cityPlaces = placesForCity(cityKey);
    if (cityPlaces.length > 0) {
      const pinGeo = new THREE.ConeGeometry(0.2, 0.55, 8);
      pinGeo.rotateX(Math.PI);
      const pins = new THREE.InstancedMesh(pinGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), cityPlaces.length);
      const m4 = new THREE.Matrix4();
      const col = new THREE.Color();
      cityPlaces.forEach((pl, i) => {
        m4.makeTranslation(pl.x, LAND + 0.55, pl.z);
        pins.setMatrixAt(i, m4);
        pins.setColorAt(i, col.setHex(PLACE_KINDS[pl.kind].color));
      });
      scene.add(pins);
    }

    /* ---- location buildings ---- */
    /* ---- ROUND-10g: TRUE on-demand chunk streaming ----
       The city is no longer built all at once. chunks.ts owns the pure
       data (buildCityData, once per city) and the mesh builders
       (buildChunkPayload / materializeChunk, per chunk, on a worker);
       the ChunkManager below decides which chunks live, at which detail
       tier, and disposes them on unload. This effect only builds the
       GLOBAL layer (terrain, water, roads, lights, mountains, trees,
       clouds, traffic, pedestrians, labels) and hands the manager the
       callbacks that register / un-register a chunk's bookkeeping. */
    const winTex = windowsTexture();
    const pickMeshes: THREE.Object3D[] = [];
    /* Real-place miniatures (landmarks.ts): a location with a model gets it
       instead of the generic box + roof. Label height follows the model. */
    const landmarks = createLandmarks(winTex);
    const labelTop = new Map<string, number>();
    const pickMat = new THREE.MeshBasicMaterial({ visible: false });
    // the filler towers' material is global (one InstancedMesh per chunk
    // shares it); the frame loop drives its night glow
    const fillerMatLocal = new THREE.MeshStandardMaterial({ roughness: 0.95, emissive: 0xffc873, emissiveMap: winTex, emissiveIntensity: 0 });
    fillerMat = fillerMatLocal;
    const chunkMats = createSharedChunkMats(winTex);
    // the day-cycle registries hold ONLY the shared materials now (one
    // windows + one glassy + the landmark lit/neon sets) — per-building
    // materials are gone; the merged buckets wear these
    buildingMats.push(chunkMats.windows, chunkMats.glassy, ...landmarks.litMats);
    neonMats.push(...landmarks.neonMats);
    // city-wide pure data, computed once per city (filler spots, shop
    // spots, decor descriptors, locations, chunk keys)
    const cityData = buildCityData(cityKey, roads, landmarks);
    // clearance tests for the (global) tree placement below — the same
    // tests the chunk data used, from the same inputs
    const { nearLoc, nearRoad, nearMountain, nearLake } = makeNearChecks(cityKey, locs, cityData.decor, roads);
    const shopPts: ShopPt[] = [];
    // ROUND-10 (Three-Live): the compiled 平安金融中心 .glb, loaded once;
    // a chunk built after it lands applies the tower at build time, and
    // the live root (if already built) is swapped in place below
    const pinganModelRef = { current: null as THREE.Object3D | null };
    const pinganRootRef = { current: null as THREE.Group | null };
    const mctx: ChunkMaterializeCtx = {
      cityKey, landmarks, mats: chunkMats, fillerMat: fillerMatLocal, pickMat, labelTop,
      glowTexture, pinganModel: pinganModelRef,
    };
    // remove the street-facade overlays that belong to one chunk (called
    // when the chunk unloads, so a facade never floats over empty ground)
    const removeFacadesForChunk = (chunkKey: string) => {
      for (let i = streetFacadeRef.current.length - 1; i >= 0; i--) {
        const e = streetFacadeRef.current[i]!;
        if (e.chunkKey !== chunkKey) continue;
        e.group.removeFromParent();
        for (const m of e.mats) {
          const sm = m as THREE.MeshStandardMaterial;
          (sm.map as THREE.Texture | null)?.dispose?.();
          (sm.emissiveMap as THREE.Texture | null)?.dispose?.();
          m.dispose();
        }
        const mi = streetFacadeMatsRef.current.indexOf(e.mats[0] as THREE.MeshStandardMaterial);
        if (mi >= 0) streetFacadeMatsRef.current.splice(mi, 1);
        streetFacadeRef.current.splice(i, 1);
      }
    };
    // register one built chunk: add it to the scene and to every
    // bookkeeping array the frame loop / picking / facades read
    const registerChunk = (res: ChunkBuildResult) => {
      scene.add(res.group);
      pickMeshes.push(...res.picks);
      playerPickMeshesRef.current.push(...res.playerPicks);
      smokeSprites.push(...res.smokes);
      avLights.push(...res.avs);
      wheelGroups.push(...res.wheels);
      flagMeshes.push(...res.flags);
      streetFacadeTargetsRef.current.push(...res.facades);
      shopPts.push(...res.shopPts);
      for (const [id, top] of res.labelTops) labelTop.set(id, top);
      if (res.pinganRoot) pinganRootRef.current = res.pinganRoot;
    };
    const unregisterChunk = (rec: ChunkRecord) => {
      removeAll(pickMeshes, new Set(rec.picks));
      removeAll(playerPickMeshesRef.current, new Set(rec.playerPicks));
      removeAll(smokeSprites, new Set(rec.smokes));
      removeAll(avLights, new Set(rec.avs));
      removeAll(wheelGroups, new Set(rec.wheels));
      removeAll(flagMeshes, new Set(rec.flags));
      removeAll(streetFacadeTargetsRef.current, new Set(rec.facades));
      removeAll(shopPts, new Set(rec.shopPts));
      for (const [id] of rec.labelTops) labelTop.delete(id);
      removeFacadesForChunk(rec.key);
      if (pinganRootRef.current && rec.pinganRoot === pinganRootRef.current) pinganRootRef.current = null;
    };
    // ROUND-10g Step 2: the chunk worker. It owns its own city data +
    // landmarks factory (init once per city) and builds payloads off the
    // main thread; the main thread only materializes (~2.4 ms). If the
    // worker fails to construct, the manager falls back to sync builds.
    let chunkWorker: Worker | null = null;
    try {
      chunkWorker = new Worker(new URL("./chunk.worker.ts", import.meta.url), { type: "module" });
    } catch {
      chunkWorker = null;
    }
    const manager = new ChunkManager(
      (key) => {
        const data = generateChunkData(cityData, key, playerBuildingsDataRef.current);
        const res = buildChunkMesh(data, { ...mctx, scene, locById: cityData.locById });
        registerChunk(res);
        return res;
      },
      unregisterChunk,
      chunkWorker
        ? {
            post: (key, buildId) => {
              chunkWorker!.postMessage({ type: "build", key, buildId, playerBuildings: playerBuildingsDataRef.current });
            },
            cancel: (key) => { chunkWorker!.postMessage({ type: "cancel", key }); },
            materialize: (payload: ChunkPayload) => {
              const res = materializeChunk(payload, mctx);
              registerChunk(res);
              return res;
            },
          }
        : undefined,
      (key) => {
        const data = generateChunkData(cityData, key, playerBuildingsDataRef.current);
        const g = buildSilhouetteGroup(data, chunkMats.matte, cityData.locById);
        scene.add(g);
        return g;
      },
    );
    chunkManagerRef.current = manager;
    manager.setContent(cityData.chunkKeys);
    if (chunkWorker) {
      chunkWorker.postMessage({ type: "init", cityKey });
      chunkWorker.onmessage = (e: MessageEvent) => {
        const msg = e.data as { type: string; key?: string; buildId?: number; payload?: ChunkPayload };
        if (msg.type === "built" && msg.key && msg.buildId !== undefined && msg.payload) {
          manager.onWorkerBuilt(msg.key, msg.buildId, msg.payload);
        }
      };
    }
    if (cityKey === "sz") {
      void loadModel("pingan.glb").then((m) => {
        if (!m) return;
        pinganModelRef.current = m;
        const root = pinganRootRef.current;
        if (root) applyPinganGlb(root, m, labelTop);
      });
    }
    // ROUND-10g (home-designer texCpuRelease): mobile-only — the CPU copy
    // of a texture is released after its first GPU upload. Desktop keeps
    // its copies (context-loss safety); the game has no KTX2/ImageBitmap
    // textures today, so this is dormant until those arrive.
    setCpuReleaseEnabled(phoneLike || lite);
    // the player's own chunk is built synchronously, so the map is never
    // empty on arrival; the rest fills in within the frame budget.
    // (playerBuildingsDataRef is seeded here so the first builds already
    // include the shops/flats — the registry effect below keeps it fresh.)
    playerBuildingsDataRef.current = (propsRef.current.playerBuildings ?? []).map((b) => ({
      id: b.id, kind: b.kind, locId: b.locId, name: b.name, color: b.color,
    }));
    const selfLoc = propsRef.current.selfLocId ? resolveLoc(cityKey, propsRef.current.selfLocId) : undefined;
    const px0 = selfLoc?.x ?? 0;
    const pz0 = selfLoc?.z ?? 0;
    manager.buildNow(chunkKeyOf(px0, pz0));
    if (streetRef.current) manager.syncStreet(px0, pz0);
    else manager.loadAll(px0, pz0);
    // dev check: memory + chunk state in the console
    //   window.__chunks.stats() -> {loaded, simple, queued, inFlight, pending, total, chunks, geometryMB, unreferencedMB, budgetMB, geometries, textures, calls, triangles}
    (window as unknown as { __chunks?: unknown }).__chunks = {
      stats: () => ({
        ...manager.stats(),
        ...manager.ledgerStats(),
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      }),
    };

    /* ---- terrain: mountain ranges as flat-shaded cone clusters ---- */
    const mtnMat = new THREE.MeshStandardMaterial({ color: 0x5d8a4f, roughness: 1, flatShading: true });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 1, flatShading: true });
    for (const range of MOUNTAINS[cityKey]) {
      for (const pk of range.peaks) {
        if (!isLand(cityKey, pk.x, pk.z)) continue; // hand-placed peak that now falls in real water
        const cone = new THREE.Mesh(new THREE.ConeGeometry(pk.r, pk.h, 7), pk.rock ? rockMat : mtnMat);
        cone.position.set(pk.x, LAND + pk.h / 2 - 0.15, pk.z);
        cone.rotation.y = hash(`${pk.x},${pk.z}`) % 6;
        cone.castShadow = true;
        cone.receiveShadow = true;
        scene.add(cone);
        // a dusting of trees on the lower slopes
        for (let i = 0; i < 5; i++) {
          const ang = rnd() * Math.PI * 2;
          const rr = pk.r * (0.55 + rnd() * 0.3);
          const tx = pk.x + Math.cos(ang) * rr;
          const tz = pk.z + Math.sin(ang) * rr;
          const ty = LAND + pk.h * (1 - rr / pk.r) - 0.1;
          const tree = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.3, 6), new THREE.MeshStandardMaterial({ color: 0x3f7d46, roughness: 1, flatShading: true }));
          tree.position.set(tx, ty + 0.5, tz);
          scene.add(tree);
        }
      }
    }

    // trees (instanced cones)
    const treeSpots: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < 1500 && treeSpots.length < (lite ? 160 : 430); i++) {
      const x = -37 + rnd() * 74;
      const z = -21 + rnd() * 36;
      if (!isLand(cityKey, x, z, 0.6)) continue;
      if (nearLoc(x, z) || nearRoad(x, z) || nearMountain(x, z) || nearLake(x, z)) continue;
      treeSpots.push({ x, z, s: 0.7 + rnd() * 0.8 });
    }
    // ROUND-2 (a) trees sway: a vertex-shader bend on the instanced
    // foliage material (tip moves most, trunk stays put) — zero per-frame
    // matrix work for 430 trees. uTime is fed from the frame loop.
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x4d9b5f, roughness: 1, flatShading: true });
    const foliageUniforms = { uTime: { value: 0 } };
    foliageMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = foliageUniforms.uTime;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec2 swayXZ = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
            float swayPh = uTime * 1.1 + swayXZ.x * 0.8 + swayXZ.y * 0.6;
            float swayK = smoothstep(0.0, 2.1, position.y) * 0.14;
            transformed.x += sin(swayPh) * swayK;
            transformed.z += cos(swayPh * 0.83) * swayK * 0.6;
          #endif`);
    };
    const foliage = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.85, 2.1, 7),
      foliageMat,
      treeSpots.length,
    );
    {
      const mat4 = new THREE.Matrix4();
      treeSpots.forEach((s, i) => {
        mat4.makeScale(s.s, s.s, s.s).setPosition(s.x, LAND + 1.5 * s.s, s.z);
        foliage.setMatrixAt(i, mat4);
      });
    }
    foliage.castShadow = true;
    scene.add(foliage);

    /* (The random decorative 🏥🚓⛽ street blocks are gone: real hospitals,
       pharmacies and police stations from OpenStreetMap are pins on the
       map now, with their real names, addresses and phone numbers.) */

    // clouds: clusters of flattened low-poly puffs that soften at dusk
    const clouds: THREE.Group[] = [];
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, transparent: true, opacity: 0.88 });
    for (let i = 0; i < 9; i++) {
      const cl = new THREE.Group();
      const puffs = 3 + Math.floor(rnd() * 2);
      for (let k = 0; k < puffs; k++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 + rnd() * 1.1, 0), cloudMat);
        puff.position.set((k - puffs / 2) * 1.7 + (rnd() - 0.5), (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 1.4);
        puff.scale.y = 0.45;
        cl.add(puff);
      }
      cl.position.set(-45 + rnd() * 90, 17 + rnd() * 6, -20 + rnd() * 36);
      scene.add(cl);
      clouds.push(cl);
    }

    /* ---- ambient motes: dust in the day, city sparkle after dark ---- */
    const moteCount = 240;
    const motePos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      motePos[i * 3] = -38 + rnd() * 76;
      motePos[i * 3 + 1] = 1 + rnd() * 8;
      motePos[i * 3 + 2] = -21 + rnd() * 38;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
    const moteMat = new THREE.PointsMaterial({ color: 0xfff3cf, size: 0.22, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
    const motes = new THREE.Points(moteGeo, moteMat);
    scene.add(motes);

    /* ---- rain: falls only when the REAL weather says rain/storm ---- */
    const rainCount = 650;
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = -40 + rnd() * 80;
      rainPos[i * 3 + 1] = rnd() * 24;
      rainPos[i * 3 + 2] = -24 + rnd() * 44;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({ color: 0xcfe4f5, size: 0.34, transparent: true, opacity: 0, depthWrite: false });
    const rainPts = new THREE.Points(rainGeo, rainMat);
    rainPts.visible = false;
    scene.add(rainPts);

    /* ---- ROUND-2 (a) map ambient life: birds, butterflies, fish ----
       The map was static. All three are instanced (a handful of draw
       calls, matrices rewritten per frame from preallocated state — no
       per-frame allocations). Birds circle the city in loose flocks;
       butterflies flutter round the parks; fish school in the sea just
       off the coast and in the reservoirs/lakes (TERRAIN WATER polygons).
       Trees sway in the vertex shader (see foliage above), not here. */
    const AMB_LITE = lite;
    const birdN = AMB_LITE ? 8 : 14;
    const bflyN = AMB_LITE ? 6 : 10;
    const fishSeaN = AMB_LITE ? 14 : 24;
    const birdBody = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.07, 0.36), new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.8 }), birdN);
    const birdWingGeoL = new THREE.BoxGeometry(0.52, 0.03, 0.2); birdWingGeoL.translate(0.3, 0, 0);
    const birdWingGeoR = new THREE.BoxGeometry(0.52, 0.03, 0.2); birdWingGeoR.translate(-0.3, 0, 0);
    const birdWingMat = new THREE.MeshStandardMaterial({ color: 0x3a4556, roughness: 0.8 });
    const birdWingL = new THREE.InstancedMesh(birdWingGeoL, birdWingMat, birdN);
    const birdWingR = new THREE.InstancedMesh(birdWingGeoR, birdWingMat, birdN);
    for (const m of [birdBody, birdWingL, birdWingR]) { m.frustumCulled = false; scene.add(m); }
    const birds = Array.from({ length: birdN }, () => ({
      cx: -30 + rnd() * 60, cz: -16 + rnd() * 30, r: 2 + rnd() * 3.5,
      h: 7.5 + rnd() * 4.5, ang: rnd() * Math.PI * 2, sp: (0.14 + rnd() * 0.2) * (rnd() > 0.5 ? 1 : -1),
      flap: 6 + rnd() * 3, ph: rnd() * 6,
    }));
    const parkLocs = locs.filter((l) => l.type === "fun" || l.type === "scenic");
    const bflyAnchors = (parkLocs.length ? parkLocs : locs).slice(0, 3);
    const bflyBody = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.03, 0.15), new THREE.MeshStandardMaterial({ roughness: 0.7 }), bflyN);
    const bflyWingGeoL = new THREE.BoxGeometry(0.26, 0.02, 0.2); bflyWingGeoL.translate(0.15, 0, 0);
    const bflyWingGeoR = new THREE.BoxGeometry(0.26, 0.02, 0.2); bflyWingGeoR.translate(-0.15, 0, 0);
    const bflyWingMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
    const bflyWingL = new THREE.InstancedMesh(bflyWingGeoL, bflyWingMat, bflyN);
    const bflyWingR = new THREE.InstancedMesh(bflyWingGeoR, bflyWingMat, bflyN);
    for (const m of [bflyBody, bflyWingL, bflyWingR]) { m.frustumCulled = false; scene.add(m); }
    const bflyCols = [0xf5b942, 0xffffff, 0x7cc7ff, 0xec4899, 0xff8a5c];
    const bflies = Array.from({ length: bflyN }, (_, i) => {
      const a = bflyAnchors[i % bflyAnchors.length] ?? locs[0]!;
      const c = new THREE.Color(bflyCols[i % bflyCols.length]!);
      bflyBody.setColorAt(i, c); bflyWingL.setColorAt(i, c); bflyWingR.setColorAt(i, c);
      return { ax: a.x, az: a.z, seed: rnd() * 20, ph: rnd() * 6 };
    });
    const fishGeo = new THREE.ConeGeometry(0.08, 0.38, 5);
    fishGeo.rotateX(Math.PI / 2); // tip forward (+Z)
    const fishSea = new THREE.InstancedMesh(fishGeo, new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.5, metalness: 0.2 }), fishSeaN);
    fishSea.frustumCulled = false;
    scene.add(fishSea);
    const fishSeaState = Array.from({ length: fishSeaN }, (_, i) => {
      const fx = -32 + (i / Math.max(1, fishSeaN - 1)) * 64 + (rnd() - 0.5) * 2;
      return { cx: fx, cz: coastZ(cityKey, fx) + 2.2 + rnd() * 2.5, r: 0.8 + rnd() * 1.4, ang: rnd() * Math.PI * 2, sp: (0.25 + rnd() * 0.35) * (rnd() > 0.5 ? 1 : -1), ph: rnd() * 6 };
    });
    const fishSeaCols = [0x9fc4d8, 0x7fb3d5, 0xc7d8e6, 0x5b8fb9];
    fishSeaState.forEach((_, i) => fishSea.setColorAt(i, new THREE.Color(fishSeaCols[i % fishSeaCols.length]!)));
    // lake fish: one small school per inland water polygon (centroid)
    const lakeSpots = TERRAIN[cityKey].WATER.map((poly) => {
      const ring = poly[0]!;
      let x = 0, z = 0;
      for (const [px, pz] of ring) { x += px; z += pz; }
      return { x: x / ring.length, z: z / ring.length };
    });
    const fishLakeN = AMB_LITE ? Math.min(6, lakeSpots.length * 3) : Math.min(12, lakeSpots.length * 4);
    const fishLake = new THREE.InstancedMesh(fishGeo, new THREE.MeshStandardMaterial({ color: 0x8fb8c9, roughness: 0.5, metalness: 0.2 }), Math.max(1, fishLakeN));
    fishLake.frustumCulled = false;
    fishLake.count = fishLakeN;
    scene.add(fishLake);
    const fishLakeState = Array.from({ length: fishLakeN }, (_, i) => {
      const s = lakeSpots[i % Math.max(1, lakeSpots.length)] ?? { x: 0, z: 0 };
      return { cx: s.x, cz: s.z, r: 0.4 + rnd() * 0.6, ang: rnd() * Math.PI * 2, sp: (0.3 + rnd() * 0.3) * (rnd() > 0.5 ? 1 : -1), ph: rnd() * 6 };
    });
    fishLakeState.forEach((_, i) => fishLake.setColorAt(i, new THREE.Color(0xd8a75c))); // carp / koi flashes in the lakes

    /* ---- traffic: cars that drive like traffic ----
       Every vehicle eases toward its cruise speed, brakes for a red (or
       late-amber) light at the stop line ahead, and queues behind the
       vehicle in front — the flow visibly bunches at junctions and
       releases on green, like the real 深南大道 at rush hour. */
    interface Car { road: Road; t: number; speed: number; cur: number; dir: 1 | -1; lane: number; want: number }
    const cars: Car[] = [];
    const carMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.15, 0.5, 0.62),
      new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 }),
      30,
    );
    const carColors = [0xffffff, 0xe63a1f, 0x2563eb, 0xf5b942, 0x222831, 0x2dd4bf];
    for (let i = 0; i < 30; i++) {
      const road = roads[Math.floor(rnd() * roads.length)] ?? roads[0]!;
      const sp = 0.02 + rnd() * 0.035;
      cars.push({ road, t: rnd(), speed: sp, cur: sp, dir: rnd() > 0.5 ? 1 : -1, lane: (rnd() - 0.5) * 1.1, want: sp });
      carMesh.setColorAt(i, new THREE.Color(carColors[i % carColors.length]));
    }
    carMesh.castShadow = true;
    scene.add(carMesh);
    /* ROUND-2 (a) vehicle refinement — lights + wheels, driven by the same
       per-frame matrices as the cars, so GLB and box stand-ins match:
       headlights (warm, brighten after dark) and tail lights (per-instance
       colour: bright red while braking, dim otherwise) sit at the local
       ±X ends — local +X is always forward (the yaw quat adds π for dir
       −1). Wheels are real cylinders, shown only under the box stand-ins
       (the Kenney GLBs already have wheels); they hide with carMesh when
       the GLBs arrive. */
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d5, emissive: 0xffe9a8, emissiveIntensity: 0.4 });
    const headMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.09, 0.1), headMat, 60);
    headMesh.frustumCulled = false;
    scene.add(headMesh);
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const tailMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.09, 0.1), tailMat, 60);
    tailMesh.frustumCulled = false;
    for (let i = 0; i < 60; i++) tailMesh.setColorAt(i, new THREE.Color(0x7a1a12));
    scene.add(tailMesh);
    const wheelGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.09, 10);
    wheelGeo.rotateX(Math.PI / 2); // axle along the car's width (local Z)
    const wheelMesh = new THREE.InstancedMesh(wheelGeo, new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.9 }), 120);
    wheelMesh.frustumCulled = false;
    scene.add(wheelMesh);
    /* real traffic: once the Kenney cars load, each car type becomes one merged
       instanced mesh (taxis, sedans, SUVs, vans, police, delivery trucks) and the
       box stand-ins hide; the same per-frame matrices drive them */
    const carTypes: THREE.InstancedMesh[] = [];
    const carSlot: { m: number; k: number }[] = [];
    void Promise.all(["taxi", "sedan", "suv", "van", "police", "delivery"].map((n) => loadModel(`car/${n}.glb`))).then((ms) => {
      if (ms.some((m) => !m)) return;
      const counts = ms.map(() => 0);
      cars.forEach((_c, i) => { const t = i % ms.length; carSlot[i] = { m: t, k: counts[t]! }; counts[t]! += 1; });
      ms.forEach((m, t) => {
        const g = fittedClone(m!, 1.3);
        g.rotation.y = Math.PI / 2; // length along +X, like the road-aligned box it replaces
        g.updateMatrixWorld(true);
        const geos: THREE.BufferGeometry[] = []; let mat: THREE.Material | null = null;
        g.traverse((o) => {
          const me = o as THREE.Mesh;
          if (!me.isMesh) return;
          let gg = me.geometry.clone(); gg.applyMatrix4(me.matrixWorld);
          if (gg.index) gg = gg.toNonIndexed();
          for (const k of Object.keys(gg.attributes)) if (!["position", "normal", "uv"].includes(k)) gg.deleteAttribute(k);
          geos.push(gg);
          mat ??= (Array.isArray(me.material) ? me.material[0] : me.material) as THREE.Material;
        });
        const merged = geos.length ? mergeGeometries(geos, false) : null;
        if (!merged || !mat) return;
        const im = new THREE.InstancedMesh(merged, mat, Math.max(1, counts[t]!));
        im.castShadow = true;
        scene.add(im); carTypes[t] = im;
      });
      if (carTypes.filter(Boolean).length === ms.length) carMesh.visible = false;
    });
    /* one traffic step for anything with wheels: returns the speed to
       ease toward this frame (lights + car-following), the caller eases
       cur toward it and advances t */
    const trafficWant = (v: Car, tSec: number): number => {
      let want = v.speed;
      const len = roadLen(v.road);
      const stops = roadStops.get(v.road);
      if (stops) {
        for (const st of stops) {
          const stopT = st.t - v.dir * (st.back / len);
          const aheadT = (stopT - v.t) * v.dir;
          if (aheadT < -0.004) continue; // already over the line
          const dW = aheadT * len;
          if (dW > 7) continue;
          const green = tlGreen(st.ix, st.slot, tSec);
          const yellow = tlYellow(st.ix, st.slot, tSec);
          if (!green && !(yellow && dW < 1.1)) {
            want = Math.min(want, v.speed * THREE.MathUtils.clamp((dW - 0.55) / 3.2, 0, 1));
          }
        }
      }
      for (const o of cars) {
        if (o === v || o.road !== v.road || o.dir !== v.dir || Math.abs(o.lane - v.lane) > 0.85) continue;
        const gapW = (o.t - v.t) * v.dir * len;
        if (gapW > 0 && gapW < 2.6) want = Math.min(want, v.speed * THREE.MathUtils.clamp((gapW - 1.25) / 1.3, 0, 1));
      }
      return want;
    };
    const trafficAdvance = (v: Car, dt: number, tSec: number) => {
      const want = trafficWant(v, tSec);
      v.want = want;
      // ROUND-2 (a): snappier braking (2.2) + livelier pull-away (0.6) so
      // the flow bunches and releases instead of gliding through reds
      if (want < v.cur) v.cur = Math.max(want, v.cur - dt * v.speed * 2.2);
      else v.cur = Math.min(want, v.cur + dt * v.speed * 0.6);
      v.t += v.cur * dt * v.dir;
      if (v.t > 1) v.t -= 1;
      if (v.t < 0) v.t += 1;
    };
    /* 阿强 the delivery rider is part of the traffic: his scooter loops
       the roads with the flow, stops at the same lights, and carries his
       name over his head — an NPC earning a living, not a prop. */
    const riderCar: Car = { road: roads[1] ?? roads[0]!, t: 0.3, speed: 0.045, cur: 0.045, dir: 1, lane: -0.5, want: 0.045 };
    const riderG = new THREE.Group();
    {
      const tyreM = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.9 });
      const sBody = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.32, 1.15), new THREE.MeshStandardMaterial({ color: 0xf5b301, roughness: 0.45, metalness: 0.25 }));
      sBody.position.y = 0.48;
      riderG.add(sBody);
      const sBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.6 }));
      sBox.position.set(0, 0.85, -0.42);
      riderG.add(sBox);
      for (const wz of [-0.5, 0.5]) {
        const wm = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 10), tyreM);
        wm.rotation.z = Math.PI / 2;
        wm.position.set(0, 0.26, wz);
        riderG.add(wm);
      }
      // the rider himself, seated: torso, helmet, legs bent to the boards
      const rTorso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.6, 0.32), new THREE.MeshStandardMaterial({ color: 0xf5b301, roughness: 0.7 }));
      rTorso.position.set(0, 1.22, -0.08);
      riderG.add(rTorso);
      const rHead = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf5b301, roughness: 0.35 }));
      rHead.position.set(0, 1.78, -0.08);
      riderG.add(rHead);
      for (const lx of [-0.15, 0.15]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.55, 0.17), new THREE.MeshStandardMaterial({ color: 0x2e3440, roughness: 0.85 }));
        leg.position.set(lx, 0.62, 0.18);
        leg.rotation.x = -0.7;
        riderG.add(leg);
      }
      const tag = emojiSprite("🛵", 0xff8a00);
      tag.scale.set(1.5, 1.5, 1);
      tag.position.y = 2.5;
      riderG.add(tag);
      riderG.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
      scene.add(riderG);
    }

    /* ---- pedestrians: the pavement population ----
       Two dozen unnamed citizens with small lives: they walk the
       pavements, wait at the kerb for their green, cross on the zebra,
       turn at junctions onto other streets, step into shops and come out
       a while later with their errands done. Light-weight figures (no
       accessories, no shadows) so the street can afford a crowd. */
    interface Ped {
      g: THREE.Group; legL: THREE.Group; legR: THREE.Group; armL: THREE.Group; armR: THREE.Group;
      road: Road; t: number; dir: 1 | -1; side: 1 | -1; speed: number; phase: number;
      mode: "walk" | "wait" | "cross" | "toshop" | "inside" | "back";
      cool: number; waitSide: number;
      fx: number; fz: number; tx2: number; tz2: number; u: number; dur: number;
      shop?: { dx: number; dz: number }; insideT: number; crossStop?: IxStop;
    }
    const peds: Ped[] = [];
    {
      const skinM = new THREE.MeshStandardMaterial({ color: 0xf2c79b, roughness: 0.7 });
      const pedPalette = [0xe63a1f, 0x2563eb, 0x22c55e, 0xec4899, 0xf5b942, 0x8b5cf6, 0x14b8a6, 0xf97316, 0x64748b, 0xdbe7f5];
      const mkPedFigure = (shirtHex: number, pantsHex: number) => {
        const g = new THREE.Group();
        const shirt = new THREE.MeshStandardMaterial({ color: shirtHex, roughness: 0.75 });
        const pants = new THREE.MeshStandardMaterial({ color: pantsHex, roughness: 0.9 });
        const mkLimbP = (m: THREE.Material, w: number, len: number) => {
          const pivot = new THREE.Group();
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, len, w + 0.02), m);
          mesh.position.y = -len / 2;
          pivot.add(mesh);
          return pivot;
        };
        const legL = mkLimbP(pants, 0.16, 0.66); legL.position.set(-0.12, 0.7, 0); g.add(legL);
        const legR = mkLimbP(pants, 0.16, 0.66); legR.position.set(0.12, 0.7, 0); g.add(legR);
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.58, 0.3), shirt); torso.position.y = 1.0; g.add(torso);
        const armL = mkLimbP(shirt, 0.14, 0.54); armL.position.set(-0.33, 1.26, 0); g.add(armL);
        const armR = mkLimbP(shirt, 0.14, 0.54); armR.position.set(0.33, 1.26, 0); g.add(armR);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skinM); head.position.y = 1.5; g.add(head);
        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshStandardMaterial({ color: [0x2b2118, 0x4a3226, 0x1c1c22, 0x6b4a2f][Math.floor(rnd() * 4)] ?? 0x2b2118, roughness: 0.95 }));
        hair.position.y = 1.57; hair.scale.y = 0.72; g.add(hair);
        return { g, legL, legR, armL, armR };
      };
      const PED_COUNT = 22;
      for (let i = 0; i < PED_COUNT; i++) {
        const road = roads[Math.floor(rnd() * roads.length)] ?? roads[0]!;
        const fig = mkPedFigure(pedPalette[Math.floor(rnd() * pedPalette.length)] ?? 0x2563eb, [0x2e3440, 0x3a3f4a, 0x4a3226, 0x374151][Math.floor(rnd() * 4)] ?? 0x2e3440);
        fig.g.scale.setScalar(0.92);
        scene.add(fig.g);
        peds.push({
          ...fig,
          road, t: 0.05 + rnd() * 0.9, dir: rnd() > 0.5 ? 1 : -1, side: rnd() > 0.5 ? 1 : -1,
          speed: 0.85 + rnd() * 0.55, phase: rnd() * 6, mode: "walk", cool: 0, waitSide: 0,
          fx: 0, fz: 0, tx2: 0, tz2: 0, u: 0, dur: 1, insideT: 0,
        });
      }
    }
    const pedPoint = (road: Road, t: number, side: number) => {
      const ang = Math.atan2(road.z2 - road.z1, road.x2 - road.x1);
      const off = (road.w / 2 + 0.5) * side;
      return { x: road.x1 + (road.x2 - road.x1) * t + Math.sin(ang) * off, z: road.z1 + (road.z2 - road.z1) * t - Math.cos(ang) * off, ang };
    };

    /* ---- player trail: a dashed line tracing the current trip ----
       Points are sampled while the player figure moves; choosing a new
       destination starts a fresh trail from where the player stands, so a
       walk/ride reads as an actual journey across the miniature. */
    const TRAIL_MAX = 180;
    const trailPos = new Float32Array(TRAIL_MAX * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
    const trailLine = new THREE.Line(
      trailGeo,
      new THREE.LineDashedMaterial({ color: 0xe63a1f, dashSize: 0.8, gapSize: 0.5, transparent: true, opacity: 0.95 }),
    );
    trailLine.frustumCulled = false;
    trailLine.renderOrder = 4;
    scene.add(trailLine);
    let trailCount = 0;
    let trailFor = "";
    const trailLast = new THREE.Vector3(1e9, 0, 1e9);
    const pushTrail = (x: number, z: number) => {
      if (trailCount >= TRAIL_MAX) {
        trailPos.copyWithin(0, 3);
        trailCount = TRAIL_MAX - 1;
      }
      trailPos[trailCount * 3] = x;
      trailPos[trailCount * 3 + 1] = LAND + 0.22;
      trailPos[trailCount * 3 + 2] = z;
      trailCount++;
      trailLast.set(x, 0, z);
      trailGeo.setDrawRange(0, trailCount);
      trailGeo.attributes.position!.needsUpdate = true;
      trailLine.computeLineDistances();
    };

    /* ---- labels (HTML overlay) ---- */
    labels.innerHTML = "";
    const chips: Chip[] = [];
    const mkChip = (cls: string, html: string): HTMLDivElement => {
      const d = document.createElement("div");
      d.className = cls;
      d.innerHTML = html;
      d.style.cssText = "position:absolute;left:0;top:0;transform:translate(-50%,-100%);white-space:nowrap;pointer-events:none;";
      labels.appendChild(d);
      return d;
    };
    for (const l of locs) {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", `前往${l.name}`);
      // scenic spots and Summit venues carry their English name under the
      // Chinese one, so a visiting Summit guest can read the city off the map
      const en = LOC_EN[l.name];
      if (en && (l.type === "scenic" || l.type === "fun" || l.type === "apec")) {
        b.innerHTML = `${l.emoji} ${l.short}<br><span style="font-size:8.5px;font-weight:600;opacity:.62;letter-spacing:.02em">${en}</span>`;
      } else {
        b.textContent = `${l.emoji} ${l.short}`;
      }
      b.style.cssText =
        "position:absolute;left:0;top:0;transform:translate(-50%,-100%);white-space:nowrap;pointer-events:auto;cursor:pointer;font:700 11px 'Noto Sans SC',sans-serif;line-height:1.3;padding:3px 8px;border-radius:10px;border:1px solid rgba(20,26,32,.55);background:rgba(255,253,248,.93);color:#14202b;box-shadow:0 1px 4px rgba(10,20,30,.25);";
      { const nAct = activitiesAt(l).length; if (nAct) b.insertAdjacentHTML("beforeend", ` <b title="🎮" style="font-size:9px;font-weight:800;padding:0 4px;border-radius:6px;background:#ff4d2e;color:#fff">🎮${nAct}</b>`); }
      b.addEventListener("click", () => propsRef.current.onSelect(l.id));
      labels.appendChild(b);
      chips.push({ el: b, kind: "loc", sub: b.querySelector("span"), locId: l.id, w: 0, h: 0, lastText: "", visible: true, clampDx: 0, clampDy: 0, getPos: () => ({ x: l.x, y: LAND + (labelTop.get(l.id) ?? l.h * 1.7 + 1.2) + 1.4, z: l.z }) });
    }
    for (const range of MOUNTAINS[cityKey]) {
      if (!range.label || range.lx === undefined || range.lz === undefined) continue;
      const d = mkChip("", range.label);
      d.style.cssText += "font:800 10px 'Noto Sans SC',sans-serif;padding:2px 8px;border-radius:999px;background:rgba(38,64,38,.82);color:#e8f5d8;box-shadow:0 1px 4px rgba(10,20,10,.4);";
      const lx = range.lx;
      const lz = range.lz;
      const ly = range.ly ?? 8;
      chips.push({ el: d, kind: "road", w: 0, h: 0, lastText: "", visible: true, clampDx: 0, clampDy: 0, getPos: () => ({ x: lx, y: LAND + ly, z: lz }) });
    }
    {
      // name the land across the border, on its biggest piece
      const big = TERRAIN[cityKey].ACROSS.map((p) => p[0]!).sort((a, b) => b.length - a.length)[0];
      const across = { sz: "🇭🇰 香港 · 过关才能去", hk: "深圳 · 过关才能去", hz: "邻市：深圳 · 东莞 · 河源 · 汕尾" }[cityKey];
      if (big) {
        let ax = 0, az = 0; for (const [x, z] of big) { ax += x; az += z; } ax /= big.length; az /= big.length;
        const near = big.reduce((m, q) => (Math.hypot(q[0] - ax, q[1] - az) < Math.hypot(m[0] - ax, m[1] - az) ? q : m), big[0]!);
        const lx = (ax * 2 + near[0]) / 3, lz = (az * 2 + near[1]) / 3;
        const d = mkChip("", across);
        d.style.cssText += "font:800 11px 'Noto Sans SC',sans-serif;padding:2px 10px;border-radius:999px;background:rgba(40,46,52,.78);color:#eef2f6;";
        chips.push({ el: d, kind: "road", w: 0, h: 0, lastText: "", visible: true, clampDx: 0, clampDy: 0, getPos: () => ({ x: lx, y: LAND + 1.5, z: lz }) });
      }
    }
    for (const r of roads) {
      if (!r.name || r.lx === undefined || r.lz === undefined) continue;
      const d = mkChip(
        "",
        r.name,
      );
      d.style.cssText += "font:700 10px 'Noto Sans SC',sans-serif;letter-spacing:.18em;color:rgba(255,255,255,.92);text-shadow:0 1px 3px rgba(10,20,30,.8);";
      const lx = r.lx;
      const lz = r.lz;
      chips.push({ el: d, kind: "road", w: 0, h: 0, lastText: "", visible: true, clampDx: 0, clampDy: 0, getPos: () => ({ x: lx, y: LAND + 0.4, z: lz }) });
    }

    // area names (OSM neighbourhoods, towns, villages): the filler blocks and
    // woods between game places belong to real neighbourhoods
    for (const a of AREA_LABELS) {
      if (a.c !== cityKey) continue;
      const d = mkChip("", a.k === "big" ? `🏘️ ${a.n}` : a.n);
      d.title = `${a.n} · ${a.k === "big" ? "街道 / 片区" : "社区 / 村"}（居民楼、城中村和绿地）`;
      d.style.cssText += a.k === "big"
        ? "font:800 11px 'Noto Sans SC',sans-serif;letter-spacing:.12em;color:#2f2a1f;text-shadow:0 0 3px #fffaf0,0 0 6px #fffaf0;"
        : "font:600 10px 'Noto Sans SC',sans-serif;letter-spacing:.06em;color:rgba(47,42,31,.88);text-shadow:0 0 3px #fffaf0,0 0 5px #fffaf0;";
      const ax = a.x, az = a.z;
      // towns and villages are destinations: click to go there (taxi, car, bike, e-bike, bus, walk)
      d.style.cssText += "pointer-events:auto;cursor:pointer;";
      d.title += " · 点一下去这里";
      const aid = areaLocId(a.c, a.n);
      d.addEventListener("click", () => propsRef.current.onSelect(aid));
      chips.push({ el: d, kind: "road", area: a.k, w: 0, h: 0, lastText: "", visible: true, clampDx: 0, clampDy: 0, getPos: () => ({ x: ax, y: LAND + 0.3, z: az }) });
    }

    for (const line of metroLinesForCity(cityKey)) {
      const mid = line.stations[Math.floor(line.stations.length / 2)];
      if (!mid) continue;
      const d = mkChip("", line.short);
      d.title = `${line.short} · ${line.stations[0]?.name ?? ""}↔${line.stations[line.stations.length - 1]?.name ?? ""}`;
      d.style.cssText += `font:800 9.5px 'Noto Sans SC',sans-serif;padding:2px 7px;border-radius:999px;background:${line.colorCss};color:#fff;box-shadow:0 1px 4px rgba(0,0,0,.35);`;
      chips.push({ el: d, kind: "road", metro: true, w: 0, h: 0, lastText: "", visible: true, clampDx: 0, clampDy: 0, getPos: () => ({ x: mid.x, y: LAND + 1.1, z: mid.z }) });
    }
    // Station names: only shown zoomed in, lowest priority (places with a
    // location already carry their own label).
    for (const st of stationMarks) {
      if (st.hasLoc) continue;
      const d = mkChip("", "");
      d.textContent = `🚇 ${st.name}`;
      d.title = `${st.name}站 · 点一下去这个站`;
      d.style.cssText += "pointer-events:auto;cursor:pointer;font:700 9px 'Noto Sans SC',sans-serif;padding:1px 5px;border-radius:6px;color:#fff;background:rgba(15,23,42,.72);";
      d.addEventListener("click", () => propsRef.current.onSelect(stationLocId(st.name)));
      chips.push({ el: d, kind: "road", station: true, w: 0, h: 0, lastText: "", visible: true, clampDx: 0, clampDy: 0, getPos: () => ({ x: st.x, y: LAND + 0.8, z: st.z }) });
    }
    // Real places: clickable name tags, shown when zoomed in.
    for (const pl of cityPlaces) {
      const k = PLACE_KINDS[pl.kind];
      const d = mkChip("", "");
      d.textContent = `${k.emoji} ${pl.name}`;
      d.title = `${pl.name} · ${k.label} · 最近站：${pl.st}`;
      d.style.cssText += `pointer-events:auto;cursor:pointer;font:700 9px 'Noto Sans SC',sans-serif;padding:1px 6px;border-radius:7px;color:#14202b;background:rgba(255,253,248,.88);border:1px solid #${k.color.toString(16).padStart(6, "0")};`;
      d.addEventListener("click", () => propsRef.current.onSelect(`pl:${pl.id}`));
      chips.push({ el: d, kind: "road", place: true, w: 0, h: 0, lastText: "", visible: true, clampDx: 0, clampDy: 0, getPos: () => ({ x: pl.x, y: LAND + 1.0, z: pl.z }) });
    }

    /* ---- 📍 the searched place: a label that always shows + a light pillar ---- */
    {
      const d = document.createElement("div");
      d.style.cssText = "position:absolute;left:0;top:0;pointer-events:auto;display:none;align-items:center;gap:4px;font:900 12px 'Noto Sans SC',sans-serif;padding:4px 5px 4px 10px;border-radius:999px;color:#fff;background:#e63a1f;border:2px solid #fff;box-shadow:0 3px 12px rgba(0,0,0,.4);white-space:nowrap;z-index:3;";
      const nameEl = document.createElement("span");
      const goEl = document.createElement("button"); goEl.type = "button";
      goEl.style.cssText = "border:0;border-radius:999px;background:#fff;color:#e63a1f;font:900 11px 'Noto Sans SC',sans-serif;padding:2px 8px;cursor:pointer;";
      goEl.textContent = document.documentElement.lang === "en" ? "Go →" : "去这里 →";
      goEl.addEventListener("click", (e) => { e.stopPropagation(); const pin = pinRef.current; if (pin) propsRef.current.onSelect(pin.id); });
      const xEl = document.createElement("button"); xEl.type = "button";
      xEl.style.cssText = "border:0;border-radius:999px;background:rgba(0,0,0,.25);color:#fff;font:900 11px sans-serif;width:20px;height:20px;cursor:pointer;";
      xEl.textContent = "✕"; xEl.setAttribute("aria-label", "取消标记");
      xEl.addEventListener("click", (e) => { e.stopPropagation(); propsRef.current.onPinClear?.(); });
      d.append(nameEl, goEl, xEl);
      labels.appendChild(d);
      chips.push({ el: d as HTMLDivElement, kind: "road", pin: true, w: 0, h: 0, lastText: "", visible: false, clampDx: 0, clampDy: 0, getPos: () => ({ x: pinRef.current?.x ?? 0, y: LAND + 3.4, z: pinRef.current?.z ?? 0 }) });
      (d as HTMLDivElement & { nameEl?: HTMLSpanElement }).nameEl = nameEl;
    }
    const pinBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 9, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    const pinRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.8, 36), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    pinRing.rotation.x = -Math.PI / 2;
    pinBeam.visible = pinRing.visible = false;
    // ROUND-8 click-to-walk marker: a sky-blue ring on the clicked ground
    // point, pulsing while the player walks there (teal-blue, distinct from
    // the red search pin). Position/visibility are driven by the frame loop.
    const clickMarker = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.7, 36), new THREE.MeshBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    clickMarker.rotation.x = -Math.PI / 2;
    clickMarker.visible = false;
    scene.add(clickMarker);
    clickMarkerRef.current = clickMarker;
    scene.add(pinBeam, pinRing);

    /* ---- walk-to-person: tap an NPC / player and you walk up to them ----
       Arrived beside the followed person: stop, hide the marker, and open
       the chat/card that was waiting (if any). */
    const arriveAtFollowed = () => {
      const key = pendingActorRef.current;
      followActorRef.current = null;
      pendingActorRef.current = null;
      clickWalkRef.current = null;
      if (clickMarkerRef.current) clickMarkerRef.current.visible = false;
      if (key) propsRef.current.onPickActor?.(key.startsWith("npc-") ? { npc: key.slice(4) } : { player: key.slice(2) });
    };
    /* Tap a person: a remote player's card opens at once (inspect) and you
       walk over in the background; an NPC's chat opens when you arrive
       beside them — at once if you are already close, or the spot is
       unreachable by land (so a tap never silently does nothing). */
    const tapActor = (key: string) => {
      if (key === "self") return;
      const openNow = () => propsRef.current.onPickActor?.(key.startsWith("npc-") ? { npc: key.slice(4) } : { player: key.slice(2) });
      const target = actorsRef.current.get(key);
      if (key.startsWith("p-")) {
        openNow();
        if (target && !propsRef.current.selfEtaAt) { followActorRef.current = key; clickRippleAtRef.current = performance.now(); }
        return;
      }
      if (!target || propsRef.current.selfEtaAt) { openNow(); return; }
      const self = actorsRef.current.get("self");
      if (!self) { openNow(); return; }
      if (Math.hypot(target.x - self.x, target.z - self.z) <= 1.5) { openNow(); return; }
      if (!nearestLand(cityKey, target.x, target.z)) { openNow(); return; }
      followActorRef.current = key;
      pendingActorRef.current = key;
      clickRippleAtRef.current = performance.now();
    };

    /* ---- 📢 billboards: a real button per spot. The 「广告」 badge stays;
       only the text span is rewritten each pass (textContent on the root
       would wipe the badge). Click walks to the place that hosts the slot. ---- */
    billboardSpots(cityKey).forEach((spot, slot) => {
      const d = document.createElement("button");
      d.type = "button";
      d.setAttribute("aria-label", `广告，前往${spot.name}`);
      d.style.cssText = "position:absolute;left:0;top:0;transform:translate(-50%,-100%);white-space:nowrap;pointer-events:auto;cursor:pointer;display:none;align-items:center;gap:5px;font:900 11px 'Noto Sans SC',sans-serif;padding:2px 9px 2px 2px;border-radius:999px;color:#fff;background:linear-gradient(135deg,#e63a1f,#f59e0b);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);z-index:6;";
      const badge = document.createElement("span");
      badge.textContent = "广告";
      badge.style.cssText = "display:inline-block;padding:1px 6px;border-radius:999px;background:#fff;color:#e63a1f;font:900 10px 'Noto Sans SC',sans-serif;letter-spacing:.06em;";
      const textEl = document.createElement("span");
      d.append(badge, textEl);
      d.addEventListener("pointerdown", (e) => e.stopPropagation());
      d.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); const ad = propsRef.current.billboards?.find((b) => b.slot === slot); propsRef.current.onSelect(ad?.go || spot.id); });
      labels.appendChild(d);
      chips.push({ el: d, kind: "road", ad: slot, textEl, w: 0, h: 0, lastText: "", visible: false, clampDx: 0, clampDy: 0, getPos: () => ({ x: spot.x, y: LAND + 4.2, z: spot.z }) });
    });

    /* ---- actors (3D) ---- */
    const actorViews = new Map<string, THREE.Group>();
    const actorChips = new Map<string, Chip>();
    interface ActorLimbs { armL: THREE.Group; armR: THREE.Group; legL: THREE.Group; legR: THREE.Group }
    /* Build one actor's body: the shared figure (./figure.ts) plus its
       identity accessories. Split out of ensureActorView so a FACE change
       can rebuild just the body — a face is geometry (eyes / mouth), it
       can't be recoloured like a shirt. The hit cylinder, self ring and
       vehicle live on the view group, not the body, so they survive a
       rebuild untouched. */
    const buildBody = (a: Actor) => {
      const mat = (c: number, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
      const faceSeed = a.faceSeed ?? a.key;
      const spec = a.faceSpec ?? faceSpecFor(faceSeed);
      // skin rule mirrors LifeStage: the player uses the fixed light skin,
      // everyone else uses their face seed's skin tone — unless the creator
      // picked a face, whose own skin tone wins (head and body must match)
      const skin = a.faceSpec ? a.faceSpec.skin : (a.isSelf ? 0xf2c79b : spec.skin);
      const fig = makeFigure(mat, a.shirt, a.pants, skin, faceSeed, a.faceSpec ?? undefined);
      const body = fig.g;
      // identity accessories, toggled by role/outfit: cap (保安), helmet (骑手),
      // tie (正装/通勤), apron (摊主), reflective vest (保洁), bag (学生/白领).
      // Geometry comes from the shared ./figure.ts addAccessory — the same
      // definition LifeStage uses, so an accessory looks identical in both.
      const accGroup = new THREE.Group();
      const mkAcc = (name: string) => { const g = new THREE.Group(); g.name = `acc-${name}`; addAccessory(g, name); g.visible = false; accGroup.add(g); };
      for (const accName of ["cap", "helmet", "tie", "apron", "vest", "bag"]) mkAcc(accName);
      body.add(accGroup);
      return { body, fig, accGroup };
    };
    const ensureActorView = (a: Actor) => {
      let v = actorViews.get(a.key);
      if (!v) {
        v = new THREE.Group();
        // round-9: generous invisible hit target so a moving person is
        // tappable — the thin character mesh is nearly impossible to hit on
        // touch, and a tap that misses it falls through to the building
        // behind (place name instead of the person). The onUp raycast tests
        // this cylinder, not the model. Never on yourself (you can't pick you).
        if (a.key !== "self") {
          const hitMat = new THREE.MeshBasicMaterial({ visible: false });
          const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.6, 8), hitMat);
          hit.position.y = 1.3;
          hit.userData.actorKey = a.key;
          v.add(hit);
          (v.userData as { hit?: THREE.Mesh }).hit = hit;
        }
        // No floating avatar badge above the head (round-9 removed it):
        // the standard way is the 3D figure itself (it already has a face)
        // plus the small DOM name chip. A big circular portrait dwarfs the
        // character and covers the map at close zoom.
        if (a.isSelf) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.65, 0.85, 28),
            new THREE.MeshBasicMaterial({ color: 0xff4d2e, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.06;
          v.add(ring);
          (v.userData as { ring?: THREE.Mesh }).ring = ring;
          // rideable vehicles for the player: the chosen transport mode is
          // shown under the figure while it moves (bike / scooter / taxi /
          // bus), so picking a mode is something you can actually see
          const veh = new THREE.Group();
          veh.visible = false;
          const tyreMat = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.9 });
          const mkWheelZ = (r: number, wdt: number) => {
            const wgeo = new THREE.CylinderGeometry(r, r, wdt, 12);
            const wm = new THREE.Mesh(wgeo, tyreMat);
            wm.rotation.z = Math.PI / 2;
            wm.castShadow = true;
            return wm;
          };
          const bike = new THREE.Group();
          bike.name = "veh-bike";
          for (const wz of [-0.48, 0.48]) {
            const wgeo = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 6, 16), tyreMat);
            wgeo.rotation.y = Math.PI / 2;
            wgeo.position.set(0, 0.3, wz);
            bike.add(wgeo);
          }
          const bFrame = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.85), new THREE.MeshStandardMaterial({ color: 0xe63a1f, roughness: 0.5, metalness: 0.4 }));
          bFrame.position.set(0, 0.52, 0);
          bFrame.rotation.x = 0.18;
          bike.add(bFrame);
          const bBar = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.06), tyreMat);
          bBar.position.set(0, 0.78, 0.5);
          bike.add(bBar);
          const bSeat = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.07, 0.32), tyreMat);
          bSeat.position.set(0, 0.68, -0.3);
          bike.add(bSeat);
          veh.add(bike);
          // e-bike: a delivery scooter — low deck, steering column, bars, headlamp, mudguards, seat and a delivery box
          const moto = new THREE.Group();
          moto.name = "veh-moto";
          const mPaint = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35, metalness: 0.3 });
          const mDark = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6, metalness: 0.3 });
          const mChrome = new THREE.MeshStandardMaterial({ color: 0xd9dee5, roughness: 0.25, metalness: 0.8 });
          const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; moto.add(m); return m; };
          mk(new THREE.BoxGeometry(0.34, 0.1, 0.62), mDark, 0, 0.36, 0.02); // footboard
          mk(new THREE.BoxGeometry(0.36, 0.32, 0.5), mPaint, 0, 0.52, -0.32); // rear body over the motor
          mk(new THREE.BoxGeometry(0.3, 0.1, 0.42), mDark, 0, 0.72, -0.28); // seat
          mk(new THREE.BoxGeometry(0.32, 0.5, 0.12), mPaint, 0, 0.62, 0.38, -0.25); // leg shield
          mk(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 8), mChrome, 0, 0.82, 0.44, -0.28); // steering column
          mk(new THREE.BoxGeometry(0.62, 0.05, 0.05), mDark, 0, 1.1, 0.36); // handlebar
          for (const gx of [-0.3, 0.3]) mk(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 8), mDark, gx, 1.1, 0.36).rotation.z = Math.PI / 2; // grips
          mk(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff6d5, emissive: 0xffe9a8, emissiveIntensity: 0.9 }), 0, 0.98, 0.5); // headlamp
          mk(new THREE.BoxGeometry(0.16, 0.06, 0.34), mPaint, 0, 0.4, 0.55); // front mudguard
          mk(new THREE.BoxGeometry(0.16, 0.06, 0.32), mPaint, 0, 0.42, -0.58); // rear mudguard
          const box = mk(new THREE.BoxGeometry(0.46, 0.4, 0.42), new THREE.MeshStandardMaterial({ color: 0xff8a00, roughness: 0.5 }), 0, 1.0, -0.56); // delivery box
          box.name = "deliveryBox";
          mk(new THREE.BoxGeometry(0.47, 0.06, 0.43), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), 0, 1.0, -0.56); // reflective stripe
          mk(new THREE.BoxGeometry(0.08, 0.05, 0.03), new THREE.MeshStandardMaterial({ color: 0xff2d2d, emissive: 0xff2020, emissiveIntensity: 0.8 }), 0, 0.56, -0.58); // tail light
          for (const wz of [-0.48, 0.48]) {
            const wm = mkWheelZ(0.22, 0.1);
            wm.position.set(0, 0.22, wz);
            moto.add(wm);
            const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.11, 10), mChrome);
            hub.rotation.z = Math.PI / 2; hub.position.set(0, 0.22, wz); moto.add(hub);
          }
          veh.add(moto);
          const car = new THREE.Group();
          car.name = "veh-taxi";
          const cBody = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.52, 2.2), new THREE.MeshStandardMaterial({ color: 0x2f9e6b, roughness: 0.35, metalness: 0.35 }));
          cBody.position.set(0, 0.55, 0);
          cBody.castShadow = true;
          car.add(cBody);
          // tall glass cabin: the driver sits inside it, on the seat, bent
          // legs tucked into the body — never standing through the roof
          const cCab = new THREE.Mesh(new THREE.BoxGeometry(0.94, 1.2, 1.5), new THREE.MeshStandardMaterial({ color: 0xbfe3f2, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.45 }));
          cCab.position.set(0, 1.4, 0);
          car.add(cCab);
          const cRoof = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.06, 1.55), new THREE.MeshStandardMaterial({ color: 0x2f9e6b, roughness: 0.4, metalness: 0.3 }));
          cRoof.position.set(0, 2.03, 0);
          car.add(cRoof);
          const cSeat = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.9 }));
          cSeat.position.set(0, 0.62, 0.05);
          car.add(cSeat);
          const cSeatBack = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.55, 0.12), cSeat.material);
          cSeatBack.position.set(0, 0.95, -0.24);
          car.add(cSeatBack);
          const cSign = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.22), new THREE.MeshStandardMaterial({ color: 0xfff3cf, emissive: 0xffc873, emissiveIntensity: 0.5 }));
          cSign.position.set(0, 2.16, 0);
          car.add(cSign);
          for (const wx of [-0.53, 0.53]) for (const wz of [-0.8, 0.8]) {
            const wm = mkWheelZ(0.28, 0.1);
            wm.position.set(wx, 0.28, wz);
            car.add(wm);
          }
          veh.add(car);
          // bus: a Shenzhen-style green electric bus — window band with pillars, white roof with the air-con pod,
          // glowing destination sign, two doors, head and tail lights, six wheels
          const bus = new THREE.Group();
          bus.name = "veh-bus";
          const bGreen = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.4, metalness: 0.25 });
          const bWhite = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.45, metalness: 0.2 });
          const bGlass = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.1, metalness: 0.6, emissive: 0x334155, emissiveIntensity: 0.25 });
          const bDark = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 });
          const bk = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; bus.add(m); return m; };
          const L = 3.4, W = 1.18;
          bk(new THREE.BoxGeometry(W, 0.62, L), bGreen, 0, 0.6, 0); // lower body
          bk(new THREE.BoxGeometry(W + 0.01, 0.62, L - 0.25), bGlass, 0, 1.22, -0.06); // side window band
          for (let k = -4; k <= 4; k++) for (const sx of [-1, 1]) bk(new THREE.BoxGeometry(0.03, 0.62, 0.06), bWhite, sx * (W / 2 + 0.01), 1.22, k * 0.36); // window pillars
          bk(new THREE.BoxGeometry(W, 0.12, L), bWhite, 0, 1.59, 0); // roof
          bk(new THREE.BoxGeometry(0.8, 0.18, 0.9), bWhite, 0, 1.74, -0.6); // air-con / battery pod
          bk(new THREE.BoxGeometry(W - 0.06, 0.72, 0.04), bGlass, 0, 1.18, L / 2 + 0.01); // windscreen
          bk(new THREE.BoxGeometry(0.8, 0.14, 0.05), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0xff8a00, emissiveIntensity: 1 }), 0, 1.47, L / 2 + 0.03); // destination sign
          for (const dz of [1.15, -0.1]) bk(new THREE.BoxGeometry(0.03, 0.95, 0.5), bDark, W / 2 + 0.015, 0.98, dz); // doors (kerb side)
          for (const hx of [-0.42, 0.42]) {
            bk(new THREE.BoxGeometry(0.16, 0.08, 0.03), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3c4, emissiveIntensity: 0.9 }), hx, 0.5, L / 2 + 0.01); // headlights
            bk(new THREE.BoxGeometry(0.14, 0.12, 0.03), new THREE.MeshStandardMaterial({ color: 0xb91c1c, emissive: 0xff2020, emissiveIntensity: 0.7 }), hx, 0.58, -L / 2 - 0.01); // tail lights
          }
          bk(new THREE.BoxGeometry(W + 0.02, 0.08, L + 0.02), bDark, 0, 0.3, 0); // skirt
          for (const wx of [-0.56, 0.56]) for (const wz of [1.05, -0.85, -1.25]) {
            const wm = mkWheelZ(0.3, 0.16);
            wm.position.set(wx, 0.3, wz);
            bus.add(wm);
            const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.17, 10), new THREE.MeshStandardMaterial({ color: 0xc7ccd3, roughness: 0.3, metalness: 0.7 }));
            hub.rotation.z = Math.PI / 2; hub.position.set(wx, 0.3, wz); bus.add(hub);
          }
          veh.add(bus);
          // your own car for 自驾： same honest glass cabin as the taxi (you
          // sit inside it, on the seat), but painted in YOUR colour and no
          // taxi sign — the body material is kept so it can be re-tinted
          const drive = new THREE.Group();
          drive.name = "veh-drive";
          const dBodyMat = new THREE.MeshStandardMaterial({ color: 0xe63a1f, roughness: 0.32, metalness: 0.35 });
          const dBody = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.52, 2.2), dBodyMat);
          dBody.position.set(0, 0.55, 0);
          dBody.castShadow = true;
          drive.add(dBody);
          const dCab = new THREE.Mesh(new THREE.BoxGeometry(0.94, 1.2, 1.5), new THREE.MeshStandardMaterial({ color: 0xbfe3f2, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.45 }));
          dCab.position.set(0, 1.4, 0);
          drive.add(dCab);
          const dRoof = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.06, 1.55), dBodyMat);
          dRoof.position.set(0, 2.03, 0);
          drive.add(dRoof);
          const dSeat = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.9 }));
          dSeat.position.set(0, 0.62, 0.05);
          drive.add(dSeat);
          const dSeatBack = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.55, 0.12), dSeat.material);
          dSeatBack.position.set(0, 0.95, -0.24);
          drive.add(dSeatBack);
          for (const wx of [-0.53, 0.53]) for (const wz of [-0.8, 0.8]) {
            const wm = mkWheelZ(0.28, 0.1);
            wm.position.set(wx, 0.28, wz);
            drive.add(wm);
          }
          veh.add(drive);
          (v.userData as { driveMat?: THREE.MeshStandardMaterial }).driveMat = dBodyMat;
          // real car models (Kenney Car Kit): a taxi for 打车, a sedan for your own car; the box versions stay as fallback
          void Promise.all([loadModel("car/taxi.glb"), loadModel("car/sedan.glb")]).then(([tm, sm]) => {
            for (const [grp, m] of [[car, tm], [drive, sm]] as const) {
              if (!m) continue;
              for (const ch of grp.children) ch.visible = false;
              const g = fittedClone(m, 2.3); g.userData.real = true; grp.add(g);
            }
            if (v) (v.userData as { realCars?: boolean }).realCars = !!(tm && sm);
          });
          v.add(veh);
          (v.userData as { veh?: THREE.Group }).veh = veh;
        }
        scene.add(v);
        actorViews.set(a.key, v);
        const chipEl = mkChip("", "");
        chipEl.style.cssText += a.isSelf
          ? "font:900 12.5px 'Noto Sans SC',sans-serif;padding:3px 10px;border-radius:999px;background:#ff4d2e;color:#fff;border:2px solid #fff;box-shadow:0 0 0 2px #ff4d2e,0 3px 10px rgba(255,77,46,.55);z-index:5;"
          : "font:700 10.5px 'Noto Sans SC',sans-serif;padding:2px 7px;border-radius:999px;background:rgba(255,253,248,.92);color:#14202b;border:1px solid rgba(20,26,32,.4);";
        /* 点玩家 / NPC 的名字：NPC 直接聊天，玩家弹出名片（私聊、组局、送礼） */
        if (!a.isSelf) {
          chipEl.style.cssText += "pointer-events:auto;cursor:pointer;";
          chipEl.setAttribute("role", "button");
          const key = a.key;
          chipEl.addEventListener("pointerdown", (e) => e.stopPropagation());
          chipEl.addEventListener("click", (e) => { e.stopPropagation(); tapActor(key); });
        }
        actorChips.set(a.key, { el: chipEl, kind: "actor", self: !!a.isSelf, npc: a.key.startsWith("npc-"), w: 0, h: 0, lastText: "", visible: true, clampDx: 0, clampDy: 0, getPos: () => ({ x: a.x, y: LAND + 3.6, z: a.z }) });
        chips.push(actorChips.get(a.key)!);
      }
      /* Face change? The body is rebuilt (and the old one disposed) — the
         figure's own group IS the body subgroup, so riding a vehicle can
         lift it onto the seat, and the frame loop reads body / limbs /
         mats / acc fresh from userData every frame. Runs on first build
         too (faceKey starts unset), so creation and rebuild share one path. */
      const fk = a.faceKey ?? faceKeyFor(a.faceSpec ?? null, a.faceSeed ?? a.key);
      if ((v.userData as { faceKey?: string }).faceKey !== fk) {
        const oldBody = (v.userData as { body?: THREE.Group }).body;
        if (oldBody) { v.remove(oldBody); disposeGroup(oldBody); }
        const built = buildBody(a);
        v.add(built.body);
        (v.userData as { body?: THREE.Group }).body = built.body;
        (v.userData as { limbs?: ActorLimbs }).limbs = { armL: built.fig.armL, armR: built.fig.armR, legL: built.fig.legL, legR: built.fig.legR };
        (v.userData as { mats?: { shirt: THREE.MeshStandardMaterial; dark: THREE.MeshStandardMaterial; pants: THREE.MeshStandardMaterial; hair: THREE.MeshStandardMaterial; hairMesh: THREE.Mesh } }).mats = built.fig.mats;
        (v.userData as { acc?: THREE.Group }).acc = built.accGroup;
        (v.userData as { faceKey?: string }).faceKey = fk;
      }
      return v;
    };

    /* ---- interaction: orbit / zoom / pick ---- */
    const dom = renderer.domElement;
    let dragging = false;
    let moved = 0;
    let px = 0;
    let py = 0;
    let hover: { x: number; y: number } | null = null;
    const HOVER_R = 60; // px around the cursor where every label shows (small: only what you point at)
    const onDown = (e: PointerEvent) => {
      dragging = true;
      camRef.current.lastUser = performance.now();
      moved = 0;
      px = e.clientX;
      py = e.clientY;
      dom.setPointerCapture(e.pointerId);
      dom.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - px;
      const dy = e.clientY - py;
      moved += Math.abs(dx) + Math.abs(dy);
      px = e.clientX;
      py = e.clientY;
      camRef.current.az -= dx * 0.005;
      // ROUND-10: street mode is near-horizontal (pol 1.55), so the drag
      // ceiling must allow it — the old 1.35 cap kept the camera looking
      // down like a map even after the street ease pulled it level.
      const polMax = streetRef.current ? 1.55 : 1.35;
      camRef.current.pol = Math.max(0.35, Math.min(polMax, camRef.current.pol - dy * 0.004));
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      dom.style.cursor = "grab";
      if (moved < 6) {
        // treat as click. Round-9: PEOPLE FIRST — the avatar itself is the tap
        // target, not just the tiny floating name chip. A tap on a moving
        // person must select the person even when a building is behind them
        // (before this fix the ray hit the building and only the place name
        // showed, so people were unselectable).
        const rect = dom.getBoundingClientRect();
        const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        const rc = new THREE.Raycaster();
        rc.setFromCamera(ndc, camera);
        const pickActor = (key: string) => { tapActor(key); };
        // 1) raycast the generous hit cylinders on every actor (not the thin
        //    character mesh). Nearest hit wins; yourself is never pickable.
        const hitMeshes: THREE.Object3D[] = [];
        for (const v of actorViews.values()) {
          const hit = (v.userData as { hit?: THREE.Mesh }).hit;
          if (hit) hitMeshes.push(hit);
        }
        const actorHits = rc.intersectObjects(hitMeshes, false);
        const actorKey = actorHits[0]?.object.userData.actorKey as string | undefined;
        if (actorKey) { pickActor(actorKey); return; }
        // 2) screen-space fallback for moving people + imprecise touch: a tap
        //    within ~36px of a person's projected position picks the nearest
        //    such person (the raycast can miss someone who just walked on).
        {
          let best: { key: string; d: number } | null = null;
          const tmp = new THREE.Vector3();
          for (const [key, v] of actorViews) {
            if (key === "self") continue;
            tmp.set(v.position.x, LAND + 1.3, v.position.z).project(camera);
            if (tmp.z > 1) continue; // behind the camera
            const sx = ((tmp.x + 1) / 2) * rect.width;
            const sy = ((1 - tmp.y) / 2) * rect.height;
            const d = Math.hypot(sx - (e.clientX - rect.left), sy - (e.clientY - rect.top));
            if (d <= 36 && (!best || d < best.d)) best = { key, d };
          }
          if (best) { pickActor(best.key); return; }
        }
        // 3) buildings (places + round-9 player shop/flat buildings).
        // ROUND-10 chunked streaming: raycasting ignores object visibility,
        // so a hidden chunk's pick box would still be hit — walk up to the
        // chunk group and skip the hit when that group is hidden.
        const hits = rc.intersectObjects([...pickMeshes, ...playerPickMeshesRef.current], false).filter((h) => {
          let o: THREE.Object3D | null = h.object;
          while (o) {
            if (o.name.startsWith("chunk-") && !o.visible) return false;
            o = o.parent;
          }
          return true;
        });
        const id = hits[0]?.object.userData.locId as string | undefined;
        if (id) {
          // a building was picked: select it, and stop any click-walk /
          // walk-to-person (and its waiting chat)
          clickWalkRef.current = null;
          followActorRef.current = null;
          pendingActorRef.current = null;
          if (clickMarkerRef.current) clickMarkerRef.current.visible = false;
          propsRef.current.onSelect(id);
          return;
        }
        // ROUND-8 click-to-walk (mouse only — touch keeps its tap-to-select):
        // no building hit, so raycast the ground plane and walk there.
        // A trip in progress wins; a new click retargets, arrival clears.
        // Clicked water / off-land (e.g. the Shenzhen Bay promenade, which
        // looks walkable but sits outside the terrain LAND polygons): walk
        // to the nearest dry land instead of silently doing nothing. The
        // blue ring marker follows clickWalkRef, so it shows at the clamped
        // point. No land within 10 units (far out in the sea): no-op.
        if (e.pointerType === "mouse" && !propsRef.current.selfEtaAt) {
          // a new ground click retargets: cancel any walk-to-person and
          // the chat waiting on it (the player changed their mind)
          followActorRef.current = null;
          pendingActorRef.current = null;
          const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LAND);
          const pt = new THREE.Vector3();
          if (rc.ray.intersectPlane(ground, pt)) {
            const dest = nearestLand(cityKey, pt.x, pt.z);
            if (dest) {
              clickWalkRef.current = dest;
              streetWalkRef.current = false; // a mouse click, not street steering — the keys-up branch must not clear it
              // LoL-style move-click ripple: (re)start the expanding ring
              clickRippleAtRef.current = performance.now();
            }
          }
        }
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camRef.current.lastUser = performance.now();
      autoFitRef.current = false;
      // a trackpad pinch arrives as ctrl+wheel with small deltas: scale it
      // multiplicatively so pinching feels like pinching
      const d = camRef.current.dist;
      const next = e.ctrlKey ? d * Math.exp(e.deltaY * 0.012) : d + e.deltaY * 0.05;
      camRef.current.dist = Math.max(14, Math.min(130, next));
      reportZoom();
    };
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerup", onUp);
    // Wheel / pinch anywhere over the map (labels, chips and the corner
    // controls included), not just on the bare canvas: a pinch that lands
    // on a label would otherwise reach the browser and magnify the whole
    // page, pushing the header and side panels out of view.
    const wheelTarget = mount.parentElement ?? dom;
    wheelTarget.addEventListener("wheel", onWheel, { passive: false });
    // Hover reveal: where the mouse rests, every label around it shows
    // (past the density cap and the zoomed-out cut), so you can read a
    // crowded neighbourhood without zooming in. Touch has no hover.
    const onHover = (e: PointerEvent) => {
      if (e.pointerType === "touch" || dragging) { hover = null; return; }
      const r = mount.getBoundingClientRect();
      hover = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onHoverOut = () => { hover = null; };
    wheelTarget.addEventListener("pointermove", onHover);
    wheelTarget.addEventListener("pointerleave", onHoverOut);

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      fx?.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // Re-frame for the new size: the fill distance depends on the
      // canvas aspect, so fullscreen, window resizes and panel collapses
      // all re-fit the city to the frame while auto-fit is armed.
      const fit = fitDistForAspect(w / h, propsRef.current.cityKey);
      fitDistRef.current = fit.contain;
      fillDistRef.current = fit.fill;
      compactRef.current = w < 820 || h < 520;
      if (autoFitRef.current) {
        camRef.current.dist = baseDist();
        reportZoom();
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    /* ---- day cycle palettes ---- */
    const skyDay = new THREE.Color(0xbfd9e8);
    const skyDusk = new THREE.Color(0xf2a56b);
    const skyNight = new THREE.Color(0x14263f);
    const sunDay = new THREE.Color(0xfff2d8);
    const sunDusk = new THREE.Color(0xff9a4d);
    const tmpColor = new THREE.Color();
    // frame-loop scratch objects + colour constants, allocated once (the loop
    // used to new() these every frame → steady GC pressure / hitches)
    const C_GREY = new THREE.Color(0x8d9aa3);
    const C_WATER_NIGHT = new THREE.Color(0x14324e);
    const C_CLOUD_NIGHT = new THREE.Color(0x5a6c85);
    const C_CLOUD_DUSK = new THREE.Color(0xffb37a);
    const C_CLOUD_GREY = new THREE.Color(0x707c85);
    const C_MOTE_NIGHT = new THREE.Color(0xffd98a);
    const carMat4 = new THREE.Matrix4();
    const carQuat = new THREE.Quaternion();
    const carScl = new THREE.Vector3(1, 1, 1);
    const carEuler = new THREE.Euler();
    // ROUND-2 (a) ambient-life + vehicle-light scratch (allocated once)
    const ambM1 = new THREE.Matrix4();
    const ambM2 = new THREE.Matrix4();
    const ambM3 = new THREE.Matrix4();
    const ambQ = new THREE.Quaternion();
    const ambE = new THREE.Euler();
    const ambV = new THREE.Vector3();
    const ambS = new THREE.Vector3();
    const tailCol = new THREE.Color();
    const brakeCol = new THREE.Color(0xff2a1e);
    const dimTailCol = new THREE.Color(0x7a1a12);
    const shirtTmp = new THREE.Color();

    const v3 = new THREE.Vector3();
    let raf = 0;
    let declutterTick = 0;
    let streetTick = 0;
    let greetTick = 0;
    let last = performance.now();
    const clockStart = performance.now();

    // adaptive resolution bookkeeping (see prLadder above)
    let prFrames = 0, prTime = 0, prWindows = 0, prSmooth = 0, prChanges = 0;
    const applyPixelRatio = () => {
      const pr = prLadder[prIdx]!;
      renderer.setPixelRatio(pr);
      fx?.setPixelRatio(pr);
      resize();
      prChanges += 1;
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (propsRef.current.paused) {
        last = now;
        return;
      }
      const rawDt = (now - last) / 1000;
      if (!document.hidden && rawDt < 1) { prFrames += 1; prTime += rawDt; }
      if (prTime >= 2.5) {
        const fps = prFrames / prTime;
        prFrames = 0; prTime = 0; prWindows += 1;
        // ROUND-7 desktop: the FPS guard for the new effects keeps measuring
        // even after the pixel-ratio ladder is exhausted (3 changes), so a
        // struggling desktop still steps its effects down
        if (dfx) dfx.noteFps(fps);
        if (prChanges < 3 && prWindows > 1) { // the first window is loading noise
          if (fps < 32 && prIdx < prLadder.length - 1) { prIdx += 1; prSmooth = 0; prWindows = 0; applyPixelRatio(); }
          else if (fps >= 57 && prIdx > 0) { prSmooth += 1; if (prSmooth >= 3) { prIdx -= 1; prSmooth = 0; prWindows = 0; applyPixelRatio(); } }
          else prSmooth = 0;
        }
      }
      const dt = Math.min(0.05, rawDt);
      last = now;
      // ROUND-10g: chunk work within the per-frame time budget (8 ms) —
      // materialize landed worker results first, then post new builds
      manager.processQueue();
      const tSec = (now - clockStart) / 1000;

      // day cycle: the phase advances at the REAL rate (one day per
      // 86,400s) from the phase base; the ☀️/🌇/🌙 jumps, the 🕐 real-time
      // resync and the 🎥 30s-day demo mode all rebase through phaseRef.
      const pr = phaseRef.current!;
      const dayT = (((pr.base + ((now - pr.at) / 1000) * rateRef.current) % 1) + 1) % 1;
      const sunAng = dayT * Math.PI * 2 - Math.PI / 2;
      const elev = Math.sin(sunAng);
      const dayF = THREE.MathUtils.smoothstep(elev, -0.08, 0.25);
      const duskF = Math.max(0, 1 - Math.abs(elev) * 3.2) * (elev > -0.25 ? 1 : 0);
      sun.position.set(Math.cos(sunAng) * 90, Math.max(6, elev * 95), 42);
      sun.intensity = 0.25 + dayF * 2;
      tmpColor.copy(sunDay).lerp(sunDusk, duskF);
      sun.color.copy(tmpColor);
      hemi.intensity = 0.22 + dayF * 0.75;
      amb.intensity = 0.12 + dayF * 0.1;
      tmpColor.copy(skyNight).lerp(skyDay, dayF).lerp(skyDusk, duskF * 0.55);
      // REAL weather bends the sky: cloud/overcast/rain/storm/fog grey it
      // out and dim the sun; rain actually falls. Kind comes from the
      // server's live weather for the played city (App prop).
      const wk = propsRef.current.weatherKind ?? "unknown";
      const greyF = wk === "storm" ? 0.55 : wk === "overcast" || wk === "fog" ? 0.5 : wk === "rain" ? 0.45 : wk === "cloudy" ? 0.22 : wk === "partly" ? 0.08 : 0;
      if (greyF > 0) tmpColor.lerp(C_GREY, greyF * (0.3 + 0.7 * dayF));
      (scene.background as THREE.Color).copy(tmpColor);
      scene.fog!.color.copy(tmpColor);
      sun.intensity *= 1 - greyF * 0.65;
      const raining = wk === "rain" || wk === "storm";
      rainPts.visible = raining;
      if (raining) {
        rainMat.opacity = wk === "storm" ? 0.75 : 0.5;
        rainPts.position.y = -((tSec * (wk === "storm" ? 17 : 12)) % 24);
        rainPts.position.x = Math.sin(tSec * 0.7) * 0.6;
      }
      const nightF = 1 - dayF;
      // ROUND-7 desktop: ease the street wetness toward the weather.
      // (The warm night-haze tint on sky/fog was reverted: it dragged the
      // cool dark-blue night sky toward amber and turned it muddy
      // reddish-brown, which looked worse than before.)
      if (dfx) {
        dfx.update({ raining, storm: wk === "storm", nightF, duskF, dt, street: streetRef.current });
      }
      waterMat.color.setHex(0x2e7fb8).lerp(C_WATER_NIGHT, nightF * 0.8);
      waterMat.roughness = 0.35 - dayF * 0.12 + nightF * 0.1;
      // ---- drive every animated material off the day cycle ----
      renderer.toneMappingExposure = 1.08 - nightF * 0.16 + duskF * 0.04;
      // ROUND-10: in street mode the fog closes in (Sleeping Dogs) — the
      // distant city dissolves into haze and only the local street reads.
      // The whole-city map is the navigation layer, not the street view.
      // Fog eases toward its target so entering/leaving the street is smooth.
      const mapNear = 120 - nightF * 32 - (wk === "fog" ? 55 : wk === "storm" ? 30 : wk === "rain" ? 18 : 0);
      const mapFar = 240 - nightF * 45 - (wk === "fog" ? 95 : wk === "storm" ? 55 : wk === "rain" ? 35 : 0);
      const fogK = Math.min(1, dt * 2);
      const fog = scene.fog as THREE.Fog;
      if (streetRef.current) {
        fog.near += (14 - fog.near) * fogK;
        fog.far += (42 - fog.far) * fogK;
      } else {
        fog.near += (mapNear - fog.near) * fogK;
        fog.far += (mapFar - fog.far) * fogK;
      }
      moon.intensity = nightF * 0.55;
      playerLight.intensity = nightF * 26 + duskF * 8;
      // ROUND-7 desktop: windows / bulbs / neon burn brighter after dark
      // (the bloom pass turns the extra emissive into real glow)
      const winB = dfx ? dfx.windowBoost() : 1;
      // ROUND-10: on the street the neon signs stay loud even in daylight
      // (Sleeping Dogs Hong Kong), instead of only burning after dark
      const neoB = (dfx ? dfx.neonBoost() : 1) * (streetRef.current ? 1.4 : 1);
      for (const m of buildingMats) m.emissiveIntensity = (nightF * 0.95 + duskF * 0.3) * winB;
      // ROUND-10: street facades glow with the same day cycle as the buildings
      for (const m of streetFacadeMatsRef.current) m.emissiveIntensity = (nightF * 0.95 + duskF * 0.3) * winB;
      if (fillerMat) fillerMat.emissiveIntensity = nightF * 0.5 * winB;
      if (bulbMat) bulbMat.emissiveIntensity = (0.15 + nightF * 2.4) * winB;
      if (glowMat) glowMat.opacity = nightF * 0.75;
      if (foamMat) foamMat.opacity = 0.22 + 0.18 * (0.5 + 0.5 * Math.sin(tSec * 1.4));
      neonMats.forEach((m, i) => {
        m.emissiveIntensity = (0.35 + nightF * 1.5 + Math.sin(tSec * 2.4 + i * 1.7) * (0.12 + nightF * 0.3)) * neoB;
      });
      // ROUND-10g: the instanced signs share one material — day/night
      // brightness via its colour (day dimmed, night full) + a subtle
      // global shimmer; the per-sign pulse is gone (one InstancedMesh now)
      chunkMats.sign.color.setScalar(Math.min(1, 0.45 + nightF * 0.55 + Math.sin(tSec * 2.4) * 0.04));
      avLights.forEach((av, i) => {
        const m = av.material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = nightF > 0.25 && Math.sin(tSec * 2 + i * 1.3) > 0 ? 2.4 : 0.15;
      });
      cloudMat.color.setHex(0xffffff).lerp(C_CLOUD_NIGHT, nightF * 0.75).lerp(C_CLOUD_DUSK, duskF * 0.4);
      if (greyF > 0.15) cloudMat.color.lerp(C_CLOUD_GREY, greyF * 0.7);
      cloudMat.opacity = Math.min(0.97, 0.88 - nightF * 0.3 + greyF * 0.35);
      moteMat.opacity = 0.22 + nightF * 0.4;
      moteMat.color.setHex(0xfff3cf).lerp(C_MOTE_NIGHT, nightF);
      motes.rotation.y = tSec * 0.006;
      motes.position.y = Math.sin(tSec * 0.25) * 0.35;
      for (const s of smokeSprites) {
        s.phase += dt * 0.14;
        if (s.phase > 1) s.phase -= 1;
        const ph = s.phase;
        s.sp.position.set(s.x + Math.sin(ph * 5 + s.z) * 0.4 + ph * 0.9, LAND + 1.7 + ph * 3.6, s.z + Math.cos(ph * 4) * 0.2);
        const sc = 1.1 + ph * 2.1;
        s.sp.scale.set(sc, sc, 1);
        (s.sp.material as THREE.SpriteMaterial).opacity = 0.17 * Math.sin(ph * Math.PI) * (0.5 + dayF * 0.5);
      }
      // ROUND-10g: flags are meshes now (the chunk owns them); wx is the
      // building's x, the wave phase
      for (const f of flagMeshes) f.rotation.y = Math.sin(tSec * 3 + (f.userData.wx as number)) * 0.35;
      for (const w of wheelGroups) w.rotation.z = tSec * 0.25;
      for (const cl of clouds) {
        cl.position.x += dt * 0.55;
        if (cl.position.x > 55) cl.position.x = -55;
      }
      water.position.y = Math.sin(tSec * 0.7) * 0.05;
      // ROUND-2 (a) water shader + tree sway run off the same clock
      waterUniforms.uTime.value = tSec;
      waterUniforms.uDayF.value = dayF;
      waterUniforms.uNightF.value = nightF;
      waterUniforms.uSunDir.value.copy(sun.position).normalize();
      foliageUniforms.uTime.value = tSec;

      // traffic lights: lamps follow the same phase the cars obey
      for (const lh of lightHeads) {
        const ph = tlPhaseAt(lh.ix, tSec);
        const green = lh.slot === 0 ? ph < 8 : ph >= 9.2 && ph < 17.2;
        const yellow = lh.slot === 0 ? ph >= 8 && ph < 9.2 : ph >= 17.2;
        lh.grn.emissiveIntensity = green ? 2.4 : 0.12;
        lh.yel.emissiveIntensity = !green && yellow ? 2.4 : 0.12;
        lh.red.emissiveIntensity = !green && !yellow ? 2.4 : 0.12;
      }

      // traffic
      {
        headMat.emissiveIntensity = 0.25 + nightF * 2.2;
        wheelMesh.visible = carMesh.visible;
        cars.forEach((car, i) => {
          trafficAdvance(car, dt, tSec);
          const r = car.road;
          const ang = Math.atan2(r.z2 - r.z1, r.x2 - r.x1);
          const pxv = r.x1 + (r.x2 - r.x1) * car.t + Math.sin(ang) * car.lane;
          const pzv = r.z1 + (r.z2 - r.z1) * car.t - Math.cos(ang) * car.lane;
          carQuat.setFromEuler(carEuler.set(0, -ang + (car.dir < 0 ? Math.PI : 0), 0));
          const slot = carSlot[i];
          const typed = slot && !carMesh.visible ? carTypes[slot.m] : undefined;
          // suspension bob: a whisper of road feel, scaled by speed
          const bobY = Math.sin(tSec * 9 + i * 1.3) * 0.012 * Math.min(1, car.cur / Math.max(1e-3, car.speed));
          if (typed && slot) {
            carMat4.compose(v3.set(pxv, LAND + bobY * 0.5, pzv), carQuat, carScl);
            typed.setMatrixAt(slot.k, carMat4);
          } else {
            carMat4.compose(v3.set(pxv, LAND + 0.38 + bobY, pzv), carQuat, carScl);
            carMesh.setMatrixAt(i, carMat4);
          }
          // ROUND-2 (a) headlights / tail lights / wheels, from the same matrix
          const hy = typed ? 0.42 : 0.07;
          const hx = typed ? 0.62 : 0.58;
          for (const sgn of [1, -1]) {
            ambM2.copy(carMat4).multiply(ambM3.makeTranslation(hx, hy, 0.2 * sgn));
            headMesh.setMatrixAt(i * 2 + (sgn > 0 ? 0 : 1), ambM2);
            ambM2.copy(carMat4).multiply(ambM3.makeTranslation(-hx, hy + 0.03, 0.2 * sgn));
            tailMesh.setMatrixAt(i * 2 + (sgn > 0 ? 0 : 1), ambM2);
            tailCol.copy(car.want < car.cur * 0.85 || car.want < car.speed * 0.25 ? brakeCol : dimTailCol);
            tailMesh.setColorAt(i * 2 + (sgn > 0 ? 0 : 1), tailCol);
            if (!typed) {
              for (const wx of [0.38, -0.38]) {
                ambM2.copy(carMat4).multiply(ambM3.makeTranslation(wx, -0.2, 0.32 * sgn));
                wheelMesh.setMatrixAt(i * 4 + (wx > 0 ? 0 : 1) + (sgn > 0 ? 0 : 2), ambM2);
              }
            }
          }
        });
        carMesh.instanceMatrix.needsUpdate = true;
        for (const im of carTypes) if (im) im.instanceMatrix.needsUpdate = true;
        headMesh.instanceMatrix.needsUpdate = true;
        tailMesh.instanceMatrix.needsUpdate = true;
        if (tailMesh.instanceColor) tailMesh.instanceColor.needsUpdate = true;
        wheelMesh.instanceMatrix.needsUpdate = true;
        // 阿强's scooter rides the same rules (it just isn't in the queue
        // check — one scooter slipping past a queue is true to life)
        trafficAdvance(riderCar, dt, tSec);
        {
          const r = riderCar.road;
          const ang = Math.atan2(r.z2 - r.z1, r.x2 - r.x1);
          riderG.position.set(r.x1 + (r.x2 - r.x1) * riderCar.t + Math.sin(ang) * riderCar.lane, LAND + 0.1, r.z1 + (r.z2 - r.z1) * riderCar.t - Math.cos(ang) * riderCar.lane);
          riderG.rotation.y = -ang + (riderCar.dir < 0 ? Math.PI : 0) + Math.PI / 2;
        }
      }

      // ROUND-2 (a) ambient life: birds circle, butterflies flutter,
      // fish school — all instanced, all from preallocated state
      {
        for (let i = 0; i < birds.length; i++) {
          const b = birds[i]!;
          b.ang += dt * b.sp;
          b.ph += dt * b.flap;
          const bx = b.cx + Math.cos(b.ang) * b.r;
          const bz = b.cz + Math.sin(b.ang) * b.r;
          // forward is local +Z: circling counter-clockwise, heading = -ang
          ambM1.compose(ambV.set(bx, b.h + Math.sin(b.ph * 0.5) * 0.3, bz), ambQ.setFromEuler(ambE.set(0, -b.ang, 0.18)), ambS.set(1, 1, 1));
          birdBody.setMatrixAt(i, ambM1);
          const flap = Math.sin(b.ph) * 0.75;
          ambM2.copy(ambM1).multiply(ambM3.makeRotationZ(flap));
          birdWingL.setMatrixAt(i, ambM2);
          ambM2.copy(ambM1).multiply(ambM3.makeRotationZ(-flap));
          birdWingR.setMatrixAt(i, ambM2);
        }
        birdBody.instanceMatrix.needsUpdate = true;
        birdWingL.instanceMatrix.needsUpdate = true;
        birdWingR.instanceMatrix.needsUpdate = true;
        for (let i = 0; i < bflies.length; i++) {
          const f = bflies[i]!;
          f.ph += dt * 11;
          const fx = f.ax + Math.sin(tSec * 0.7 + f.seed) * 1.4 + Math.sin(tSec * 1.7 + f.seed * 2) * 0.4;
          const fz = f.az + Math.cos(tSec * 0.55 + f.seed) * 1.2 + Math.cos(tSec * 1.3 + f.seed) * 0.4;
          const fy = LAND + 1.4 + Math.sin(tSec * 1.3 + f.seed) * 0.5;
          ambM1.compose(ambV.set(fx, fy, fz), ambQ.setFromEuler(ambE.set(0, tSec * 0.7 + f.seed, 0)), ambS.set(1, 1, 1));
          bflyBody.setMatrixAt(i, ambM1);
          const flap = Math.sin(f.ph) * 0.9;
          ambM2.copy(ambM1).multiply(ambM3.makeRotationZ(flap));
          bflyWingL.setMatrixAt(i, ambM2);
          ambM2.copy(ambM1).multiply(ambM3.makeRotationZ(-flap));
          bflyWingR.setMatrixAt(i, ambM2);
        }
        bflyBody.instanceMatrix.needsUpdate = true;
        bflyWingL.instanceMatrix.needsUpdate = true;
        bflyWingR.instanceMatrix.needsUpdate = true;
        for (let i = 0; i < fishSeaState.length; i++) {
          const f = fishSeaState[i]!;
          f.ang += dt * f.sp;
          f.ph += dt * 3;
          ambM1.compose(
            ambV.set(f.cx + Math.cos(f.ang) * f.r, -0.12 + Math.sin(f.ph) * 0.03, f.cz + Math.sin(f.ang) * f.r),
            ambQ.setFromEuler(ambE.set(0, -f.ang + Math.sin(f.ph * 2) * 0.25, 0)),
            ambS.set(1, 1, 1),
          );
          fishSea.setMatrixAt(i, ambM1);
        }
        fishSea.instanceMatrix.needsUpdate = true;
        for (let i = 0; i < fishLakeState.length; i++) {
          const f = fishLakeState[i]!;
          f.ang += dt * f.sp;
          f.ph += dt * 3;
          ambM1.compose(
            ambV.set(f.cx + Math.cos(f.ang) * f.r, LAND + 0.06 + Math.sin(f.ph) * 0.02, f.cz + Math.sin(f.ang) * f.r),
            ambQ.setFromEuler(ambE.set(0, -f.ang + Math.sin(f.ph * 2) * 0.25, 0)),
            ambS.set(0.85, 0.85, 0.85),
          );
          fishLake.setMatrixAt(i, ambM1);
        }
        fishLake.instanceMatrix.needsUpdate = true;
      }

      // pedestrians: walk the pavements, cross on green, duck into shops
      for (const pd of peds) {
        const len = roadLen(pd.road);
        let px = 0, pz = 0, heading = 0, walking = false;
        pd.cool = Math.max(0, pd.cool - dt);
        if (pd.mode === "walk") {
          pd.t += (pd.speed / len) * dt * pd.dir;
          if (pd.t > 0.985) { pd.t = 0.985; pd.dir = -1 as const; }
          if (pd.t < 0.015) { pd.t = 0.015; pd.dir = 1 as const; }
          const pt = pedPoint(pd.road, pd.t, pd.side);
          px = pt.x; pz = pt.z;
          heading = Math.atan2((pd.road.x2 - pd.road.x1) * pd.dir, (pd.road.z2 - pd.road.z1) * pd.dir);
          walking = true;
          // at a junction, life happens: cross, turn, or duck into a shop
          if (pd.cool <= 0) {
            const stops = roadStops.get(pd.road);
            const st = stops?.find((s) => Math.abs(s.t - pd.t) < (1.6 / len));
            if (st) {
              pd.cool = 2.2;
              const roll = Math.random();
              if (roll < 0.3) {
                // cross THIS road at the junction — wait for the ped green
                const from = pedPoint(pd.road, pd.t, pd.side);
                const to = pedPoint(pd.road, pd.t, -pd.side);
                pd.fx = from.x; pd.fz = from.z; pd.tx2 = to.x; pd.tz2 = to.z;
                pd.crossStop = st;
                pd.u = 0;
                pd.dur = Math.max(0.7, Math.hypot(to.x - from.x, to.z - from.z) / (pd.speed * 1.25));
                pd.mode = tlPedGreen(st.ix, st.slot, tSec) ? "cross" : "wait";
              } else if (roll < 0.55) {
                // turn onto the crossing street and keep walking
                pd.road = st.other;
                pd.t = THREE.MathUtils.clamp(st.otherT + (Math.random() > 0.5 ? 0.012 : -0.012), 0.02, 0.98);
                pd.dir = Math.random() > 0.5 ? 1 : -1;
              } else if (roll < 0.68 && shopPts.length > 0) {
                const near = shopPts.filter((s) => Math.hypot(s.x - px, s.z - pz) < 4.2);
                const shop = near[Math.floor(Math.random() * near.length)];
                if (shop) {
                  pd.shop = shop;
                  pd.fx = px; pd.fz = pz; pd.tx2 = shop.dx; pd.tz2 = shop.dz;
                  pd.u = 0;
                  pd.dur = Math.max(0.4, Math.hypot(shop.dx - px, shop.dz - pz) / pd.speed);
                  pd.mode = "toshop";
                }
              }
            }
          }
        } else if (pd.mode === "wait") {
          const pt = pedPoint(pd.road, pd.t, pd.side);
          px = pt.x; pz = pt.z;
          heading = Math.atan2(pd.tx2 - px, pd.tz2 - pz);
          if (pd.crossStop && tlPedGreen(pd.crossStop.ix, pd.crossStop.slot, tSec)) pd.mode = "cross";
        } else if (pd.mode === "cross") {
          pd.u += dt / pd.dur;
          const u = Math.min(1, pd.u);
          px = pd.fx + (pd.tx2 - pd.fx) * u;
          pz = pd.fz + (pd.tz2 - pd.fz) * u;
          heading = Math.atan2(pd.tx2 - pd.fx, pd.tz2 - pd.fz);
          walking = true;
          if (u >= 1) { pd.side = (pd.side * -1) as 1 | -1; pd.mode = "walk"; pd.cool = 1.6; }
        } else if (pd.mode === "toshop") {
          pd.u += dt / pd.dur;
          const u = Math.min(1, pd.u);
          px = pd.fx + (pd.tx2 - pd.fx) * u;
          pz = pd.fz + (pd.tz2 - pd.fz) * u;
          heading = Math.atan2(pd.tx2 - pd.fx, pd.tz2 - pd.fz);
          walking = true;
          if (u >= 1) { pd.mode = "inside"; pd.insideT = 3.5 + Math.random() * 6; pd.g.visible = false; }
        } else if (pd.mode === "inside") {
          pd.insideT -= dt;
          if (pd.insideT <= 0 && pd.shop) {
            pd.g.visible = true;
            const pt = pedPoint(pd.road, pd.t, pd.side);
            pd.fx = pd.shop.dx; pd.fz = pd.shop.dz; pd.tx2 = pt.x; pd.tz2 = pt.z;
            pd.u = 0;
            pd.dur = Math.max(0.3, Math.hypot(pt.x - pd.shop.dx, pt.z - pd.shop.dz) / pd.speed);
            pd.mode = "back";
          }
          continue;
        } else {
          // back: out of the shop, rejoin the pavement
          pd.u += dt / pd.dur;
          const u = Math.min(1, pd.u);
          px = pd.fx + (pd.tx2 - pd.fx) * u;
          pz = pd.fz + (pd.tz2 - pd.fz) * u;
          heading = Math.atan2(pd.tx2 - pd.fx, pd.tz2 - pd.fz);
          walking = true;
          if (u >= 1) { pd.mode = "walk"; pd.cool = 1.2; }
        }
        pd.phase += dt * (walking ? 7.5 : 0);
        const swing = walking ? Math.sin(pd.phase) * 0.55 : 0;
        pd.legL.rotation.x = swing;
        pd.legR.rotation.x = -swing;
        pd.armL.rotation.x = -swing * 0.7;
        pd.armR.rotation.x = swing * 0.7;
        pd.g.position.set(px, LAND + 0.08 + (walking ? Math.abs(Math.sin(pd.phase)) * 0.05 : Math.sin(tSec * 1.7 + pd.phase) * 0.012), pz);
        pd.g.rotation.y = heading;
      }

      // street greetings: when two named neighbours pass on the pavement
      // one of them says something (and they greet YOU when you pass) —
      // the city acknowledging itself, Sleeping-Dogs style street life
      greetTick++;
      if (greetTick % 40 === 0) {
        const npcActors = [...actorsRef.current.values()].filter((a) => a.key.startsWith("npc-"));
        const selfA = actorsRef.current.get("self");
        const tNow = performance.now();
        for (let i = 0; i < npcActors.length; i++) {
          const a = npcActors[i]!;
          if (a.greetUntil && a.greetUntil > tNow) continue;
          if (selfA && Math.hypot(a.x - selfA.x, a.z - selfA.z) < 2.3 && Math.random() < 0.4) {
            a.greet = GREETS_PLAYER[Math.floor(Math.random() * GREETS_PLAYER.length)];
            a.greetUntil = tNow + 2600;
            continue;
          }
          for (let j = i + 1; j < npcActors.length; j++) {
            const b = npcActors[j]!;
            if (Math.hypot(a.x - b.x, a.z - b.z) < 2.3 && Math.random() < 0.3) {
              const speaker = Math.random() > 0.5 ? a : b;
              if (!speaker.greetUntil || speaker.greetUntil <= tNow) {
                speaker.greet = GREETS[Math.floor(Math.random() * GREETS.length)];
                speaker.greetUntil = tNow + 2600;
              }
              break;
            }
          }
        }
      }

      // the train: head eases from station idx to idx+1 over stepMs (held at a station while boarding / transferring / arriving)
      const tr = propsRef.current.train;
      trainPos.active = !!tr && tr.pts.length >= 2;
      if (tr && trainPos.active) {
        const key = tr.pts.map((q) => q.join(",")).join(";");
        if (key !== trainKey) { trainKey = key; trainIdx = -1; }
        if (tr.idx !== trainIdx) { trainIdx = tr.idx; trainSince = now; }
        const i = Math.min(tr.idx, tr.pts.length - 1);
        const a0 = tr.pts[i]!, a1 = tr.pts[Math.min(i + 1, tr.pts.length - 1)]!;
        const raw = tr.hold || i >= tr.pts.length - 1 ? 0 : Math.min(1, (now - trainSince) / tr.stepMs);
        const k = raw * raw * (3 - 2 * raw); // pull out of the station, glide, brake into the next
        trainPos.x = a0[0] + (a1[0] - a0[0]) * k; trainPos.z = a0[1] + (a1[1] - a0[1]) * k;
        let hx = a1[0] - a0[0], hz = a1[1] - a0[1];
        if (Math.hypot(hx, hz) < 1e-3 && i > 0) { const b = tr.pts[i - 1]!; hx = a0[0] - b[0]; hz = a0[1] - b[1]; }
        const len = Math.hypot(hx, hz) || 1; const ux = hx / len, uz = hz / len;
        const nCars = tr.rail ? 6 : 4;
        trainBodyMat.color.setHex(tr.rail ? 0xf3f5f7 : tr.color);
        trainRoofMat.color.setHex(tr.rail ? tr.color : 0xe8edf2);
        trainCars.forEach((car, ci) => {
          car.visible = ci < nCars;
          if (trainModelsReady) {
            // head car, middle cars, tail car from the model set; the box parts hide
            const v = ci === 0 ? 0 : ci === nCars - 1 ? 2 : 1;
            for (const child of car.children) if (!(child as THREE.Group).userData || (child as THREE.Group).userData.v === undefined) child.visible = false;
            for (const kind of ["metro", "rail"] as const) for (const g of trainModels[ci]![kind]) g.visible = (kind === "rail") === tr.rail && g.userData.v === v;
          }
          car.position.set(trainPos.x - ux * ci * 1.55, LAND + 0.05, trainPos.z - uz * ci * 1.55);
          car.rotation.y = Math.atan2(ux, uz);
        });
        trainGroup.visible = true;
      } else {
        trainGroup.visible = false; trainKey = "";
      }

      // actors
      const locsNow = getLocations(propsRef.current.cityKey);
      for (const a of actorsRef.current.values()) {
        const view = ensureActorView(a);
        if (a.isSelf) {
          view.visible = !trainPos.active;
          if (trainPos.active) { a.x = a.tx = trainPos.x; a.z = a.tz = trainPos.z; selfOnTrain = true; }
          else if (selfOnTrain) {
            // off the train: walk on from the last station to where the trip ends
            selfOnTrain = false;
            const dest = resolveLoc(propsRef.current.cityKey, propsRef.current.selfLocId);
            if (dest) { a.tx = dest.x; a.tz = dest.z; }
          }
        }
        // ROUND-8 click-to-walk: steer the self actor to the clicked ground
        // point at travel-mode speed (the same tx/tz + speed path trips use,
        // so walk cycle, heading and the player light all just work). A trip
        // or a ride cancels it; arriving clears it and hides the marker.
        if (a.isSelf) {
          if (propsRef.current.selfEtaAt || trainPos.active) {
            if (clickWalkRef.current) {
              clickWalkRef.current = null;
              if (clickMarkerRef.current) clickMarkerRef.current.visible = false;
            }
            followActorRef.current = null;
            pendingActorRef.current = null;
          } else if (followActorRef.current) {
            // walk-to-person: re-target to the person's current spot each
            // frame (they wander); stop beside them and open the chat/card
            const target = actorsRef.current.get(followActorRef.current);
            if (!target) {
              // the person left the map: stop, don't open anything
              followActorRef.current = null;
              pendingActorRef.current = null;
            } else if (Math.hypot(target.x - a.x, target.z - a.z) <= 1.5) {
              arriveAtFollowed();
            } else {
              // clamp to the nearest land so a person at the water/road edge
              // doesn't strand you; if unreachable, keep the last target
              const dest = nearestLand(cityKey, target.x, target.z);
              if (dest) { clickWalkRef.current = dest; streetWalkRef.current = false; }
            }
          }
          // ROUND-10 street mode: WASD / arrows steer the player directly
          // (camera-relative, Sleeping Dogs on foot). Reuses the same tx/tz
          // + speed path as click-to-walk, so the walk cycle, heading and
          // the player light all just work. Shift = run. Blocked by
          // building footprints and water — slides along them instead.
          if (streetRef.current && !propsRef.current.selfEtaAt && !trainPos.active) {
            const keys = streetKeysRef.current;
            const stk = streetStickRef.current;
            // dead zone: a resting thumb must not creep the player forward
            const sm = Math.hypot(stk.x, stk.y);
            const sx = sm < 0.15 ? 0 : stk.x;
            const sy = sm < 0.15 ? 0 : stk.y;
            const fwd = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) + sy;
            const str = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) + sx;
            if (fwd !== 0 || str !== 0) {
              const az = camRef.current.az;
              const fx = -Math.sin(az), fz = -Math.cos(az);
              const rx = Math.cos(az), rz = -Math.sin(az);
              let mx = fx * fwd + rx * str, mz = fz * fwd + rz * str;
              const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
              const run = keys.has("ShiftLeft") || keys.has("ShiftRight") || sm > 0.9;
              a.speed = run ? 4.2 : 2.6;
              followActorRef.current = null;
              pendingActorRef.current = null;
              const step = 4;
              let tx = a.x + mx * step, tz = a.z + mz * step;
              const blocked = (x: number, z: number) => !isLand(cityKey, x, z, 0.3) || locsNow.some((l) => Math.abs(x - l.x) < l.w / 2 + 0.4 && Math.abs(z - l.z) < l.w / 2 + 0.4);
              if (blocked(tx, tz)) {
                const ax2 = a.x + mx * step, az2 = a.z;
                const ax3 = a.x, az3 = a.z + mz * step;
                if (!blocked(ax2, az2)) { tx = ax2; tz = az2; }
                else if (!blocked(ax3, az3)) { tx = ax3; tz = az3; }
                else { tx = a.x; tz = a.z; }
              }
              clickWalkRef.current = { x: tx, z: tz };
              streetWalkRef.current = true;
            } else {
              // keys up: stop — but only clear a target street steering set
              // itself, never a mouse click-walk or a walk-to-person
              if (streetWalkRef.current && !followActorRef.current) {
                clickWalkRef.current = null;
                if (clickMarkerRef.current) clickMarkerRef.current.visible = false;
              }
              streetWalkRef.current = false;
              a.speed = modeById((propsRef.current.travelModeId ?? "walk") as TransportModeId).mapSpeed;
            }
          } else if (streetWalkRef.current) {
            streetWalkRef.current = false;
          }
          if (clickWalkRef.current) {
            a.tx = clickWalkRef.current.x;
            a.tz = clickWalkRef.current.z;
          }
        }
        const dx = a.tx - a.x;
        const dz = a.tz - a.z;
        const dist = Math.hypot(dx, dz);
        // arrived at the clicked point: stop here, hide the marker
        if (a.isSelf && clickWalkRef.current && dist <= 0.25) {
          clickWalkRef.current = null;
          if (clickMarkerRef.current) clickMarkerRef.current.visible = false;
          // walked to the closest land beside the person (they may have
          // drifted just out of reach): open the waiting chat/card
          if (pendingActorRef.current) {
            const key = pendingActorRef.current;
            followActorRef.current = null;
            pendingActorRef.current = null;
            propsRef.current.onPickActor?.(key.startsWith("npc-") ? { npc: key.slice(4) } : { player: key.slice(2) });
          } else {
            followActorRef.current = null;
          }
        }
        if (dist > 0.06) {
          const eta = a.isSelf ? propsRef.current.selfEtaAt : undefined;
          const left = eta ? (eta - Date.now()) / 1000 : 0;
          const sp = (eta && left > 0.05 ? dist / left : (a.speed || 2.4)) * dt;
          const step = Math.min(dist, sp);
          a.x += (dx / dist) * step;
          a.z += (dz / dist) * step;
        } else if (a.wander) {
          // behaviour by identity: stay roles keep to their corner (摊主守摊、
          // 同事守工位、邻居在家附近), patrol roles roam a beat (保安、保洁),
          // commuters cross the city between stations and workplaces (骑手、
          // 通勤族). Everyone's small movements cluster around their
          // schedule anchor for this hour — they live in a neighbourhood,
          // with the occasional longer stroll somewhere they like.
          const chance = a.behavior === "stay" ? 0.0016 : a.behavior === "patrol" ? 0.006 : a.behavior === "commute" ? 0.0032 : 0.004;
          if (Math.random() < chance) {
            if (a.behavior === "stay") {
              a.tx += (Math.random() - 0.5) * 2.4;
              a.tz += (Math.random() - 0.5) * 2;
            } else if (a.ax !== undefined && a.az !== undefined && Math.random() < 0.8) {
              a.tx = a.ax + (Math.random() - 0.5) * 3.4;
              a.tz = a.az + (Math.random() - 0.5) * 2.8;
            } else {
              const loc = locsNow[Math.floor(Math.random() * locsNow.length)];
              if (loc) {
                a.tx = loc.x + (Math.random() - 0.5) * 1.6;
                a.tz = loc.z + (Math.random() - 0.5) * 1.4;
              }
            }
          }
        }
        // walk cycle: blend in limb swing + lean while moving, breathe at idle
        const moving = dist > 0.06;
        a.blend += ((moving ? 1 : 0) - a.blend) * Math.min(1, dt * 7);
        if (moving) {
          // stride cadence follows the actual travel speed: a walker
          // strolls, a runner's legs blur, a commuter hurries
          a.phase += dt * 1.62 * Math.min(6, a.speed || 2.4) * (a.isSelf && propsRef.current.selfEtaAt ? 1.4 : 1);
          const targetHeading = Math.atan2(dx, dz);
          let dh = targetHeading - a.heading;
          while (dh > Math.PI) dh -= Math.PI * 2;
          while (dh < -Math.PI) dh += Math.PI * 2;
          a.heading += dh * Math.min(1, dt * 10);
        }
        const bob = Math.abs(Math.sin(a.phase)) * 0.11 * a.blend + Math.sin(tSec * 1.6 + a.seed) * 0.012 * (1 - a.blend);
        view.position.set(a.x, LAND + bob, a.z);
        view.rotation.y = a.heading;
        view.rotation.x = a.blend * 0.07;
        const limbs = (view.userData as { limbs?: ActorLimbs }).limbs;
        if (limbs) {
          const swing = Math.sin(a.phase) * 0.62 * a.blend;
          const idleSway = Math.sin(tSec * 1.6 + a.seed) * 0.045 * (1 - a.blend);
          limbs.legL.rotation.x = swing;
          limbs.legR.rotation.x = -swing;
          limbs.armL.rotation.x = -swing * 0.8 + idleSway;
          limbs.armR.rotation.x = swing * 0.8 - idleSway;
        }
        if (a.isSelf) playerLight.position.set(a.x, LAND + 3.2, a.z);
        if (a.isSelf) {
          // ride the chosen vehicle while moving — and SIT on it: the pose
          // blends from the walk cycle into a true seated posture (hips on
          // the saddle/seat, legs bent forward onto pedals / floorboard /
          // tucked inside the car body, hands on the bars or wheel), never
          // a walking figure hovering over a vehicle with legs swinging
          const veh = (view.userData as { veh?: THREE.Group }).veh;
          const bodyG = (view.userData as { body?: THREE.Group }).body;
          if (veh && bodyG) {
            const mode = propsRef.current.travelModeId ?? "walk";
            const wantMode = mode === "bike" || mode === "moto" || mode === "taxi" || mode === "bus" || mode === "drive" ? mode : null;
            if (wantMode) a.rideMode = wantMode;
            const ridingNow = wantMode !== null && moving;
            a.rideBlend = (a.rideBlend ?? 0) + ((ridingNow ? 1 : 0) - (a.rideBlend ?? 0)) * Math.min(1, dt * 6);
            const rb = a.rideBlend ?? 0;
            const rm = a.rideMode ?? "bike";
            veh.visible = rb > 0.03;
            // riding: the whole rig (vehicle + you) grows a touch so the car / bus / scooter reads on the map
            const grow = rm === "bike" ? 0.25 : 0.5;
            view.scale.setScalar(1 + grow * rb);
            const limbs0 = (view.userData as { limbs?: ActorLimbs }).limbs;
            if (veh.visible && limbs0) {
              for (const child of veh.children) child.visible = child.name === `veh-${rm}`;
              const seat = rm === "bike" ? { y: -0.14, s: 1 } : rm === "moto" ? { y: -0.1, s: 1 } : rm === "taxi" || rm === "drive" ? { y: 0.03, s: 0.9 } : { y: 0.18, s: 0.9 };
              bodyG.position.y = seat.y * rb;
              const sc = 1 + (seat.s - 1) * rb;
              bodyG.scale.set(sc, sc, sc);
              limbs0.legL.visible = true;
              limbs0.legR.visible = true;
              const mix = (cur: number, target: number) => cur * (1 - rb) + target * rb;
              if (rm === "bike") {
                const pedal = Math.sin(a.phase * 0.55) * 0.38;
                limbs0.legL.rotation.x = mix(limbs0.legL.rotation.x, -1.05 + pedal);
                limbs0.legR.rotation.x = mix(limbs0.legR.rotation.x, -1.05 - pedal);
                limbs0.armL.rotation.x = mix(limbs0.armL.rotation.x, -0.95);
                limbs0.armR.rotation.x = mix(limbs0.armR.rotation.x, -0.95);
              } else if (rm === "moto") {
                limbs0.legL.rotation.x = mix(limbs0.legL.rotation.x, -1.18);
                limbs0.legR.rotation.x = mix(limbs0.legR.rotation.x, -1.18);
                limbs0.armL.rotation.x = mix(limbs0.armL.rotation.x, -0.9);
                limbs0.armR.rotation.x = mix(limbs0.armR.rotation.x, -0.9);
              } else {
                limbs0.legL.rotation.x = mix(limbs0.legL.rotation.x, -1.28);
                limbs0.legR.rotation.x = mix(limbs0.legR.rotation.x, -1.28);
                limbs0.armL.rotation.x = mix(limbs0.armL.rotation.x, -0.25);
                limbs0.armR.rotation.x = mix(limbs0.armR.rotation.x, -0.68);
              }
              // inside a real (closed) car model the figure is hidden by the body: don't let the head poke through the roof
              bodyG.visible = !(rb > 0.5 && (rm === "bus" || ((rm === "taxi" || rm === "drive") && (view.userData as { realCars?: boolean }).realCars)));
              // seated: the walk bob dies away, a whisper of engine buzz stays
              view.position.y = LAND + bob * (1 - rb) + Math.sin(tSec * 31) * 0.008 * rb;
            } else {
              bodyG.position.y = 0;
              bodyG.scale.set(1, 1, 1);
              bodyG.visible = true;
              view.scale.setScalar(1);
            }
          }
          // trail: new destination → fresh trail; moving → sample points
          if (propsRef.current.selfLocId !== trailFor) {
            trailFor = propsRef.current.selfLocId;
            trailCount = 0;
            trailGeo.setDrawRange(0, 0);
            pushTrail(a.x, a.z);
          }
          if (moving && Math.hypot(a.x - trailLast.x, a.z - trailLast.z) > 0.7) pushTrail(a.x, a.z);
        }
        const ring = (view.userData as { ring?: THREE.Mesh }).ring;
        if (ring) {
          const s = 1 + Math.sin(tSec * 3) * 0.12;
          ring.scale.set(s, s, 1);
        }
        const mats = (view.userData as { mats?: { shirt: THREE.MeshStandardMaterial; dark: THREE.MeshStandardMaterial; pants: THREE.MeshStandardMaterial; hair?: THREE.MeshStandardMaterial; hairMesh?: THREE.Mesh } }).mats;
        if (mats) {
          mats.shirt.color.setHex(a.shirt);
          mats.dark.color.copy(shirtTmp.setHex(a.shirt).multiplyScalar(0.78));
          mats.pants.color.setHex(a.pants);
          const look = HAIRS[(a.hair ?? 0) % HAIRS.length] ?? HAIRS[0]!;
          /* character creator: a hand-picked hair colour wins over the
             hairstyle's own colour (the style still sets the silhouette
             scale); without a custom face the style colour stands, as before */
          if (mats.hair) mats.hair.color.setHex(a.faceSpec?.hair ?? look.color);
          if (mats.hairMesh) mats.hairMesh.scale.set(look.sx, look.sy, 1);
        }
        // your own car wears your identity colour
        const driveMat = (view.userData as { driveMat?: THREE.MeshStandardMaterial }).driveMat;
        if (driveMat) driveMat.color.setHex(a.color);
        const acc = (view.userData as { acc?: THREE.Group }).acc;
        if (acc) for (const child of acc.children) child.visible = child.name === `acc-${a.accessory}`;
        const chip = actorChips.get(a.key);
        if (chip) {
          const greeting = a.greet && a.greetUntil && performance.now() < a.greetUntil ? ` ${a.greet}` : "";
          const t = a.isSelf ? `📍 ${a.name} · ${document.documentElement.lang === "en" ? "me" : "我"}` : `${a.name}${greeting}`;
          if (chip.src !== t) { chip.src = t; chip.el.textContent = t; }
        }
      }
      for (const key of Array.from(actorViews.keys())) {
        if (!actorsRef.current.has(key)) {
          const v = actorViews.get(key);
          if (v) scene.remove(v);
          actorViews.delete(key);
          const chip = actorChips.get(key);
          if (chip) {
            chip.el.remove();
            const idx = chips.indexOf(chip);
            if (idx >= 0) chips.splice(idx, 1);
            actorChips.delete(key);
          }
        }
      }

      // round-3 (C): the player's pet — a low-poly cat/dog (makePetGroup)
      // driven every frame by stepPetFollow() in round2/pets.ts. No pet,
      // or the player riding the train, hides the model; a new pet
      // (id / kind / colour changed) rebuilds it. Poses come from the
      // state machine: follow = legs swing + tail wag, sit = chest up,
      // play = little hops + fast wag, sleep = lying low.
      {
        const pet = propsRef.current.activePet ?? null;
        const selfA = actorsRef.current.get("self");
        if (pet && selfA && !trainPos.active) {
          const key = `${pet.id}|${pet.kind}|${pet.color}`;
          if (!petGroup || petGroupKey !== key) {
            if (petGroup) { scene.remove(petGroup); disposeObject(petGroup); }
            petGroup = makePetGroup(pet);
            petGroupKey = key;
            scene.add(petGroup);
            petRuntimeRef.current = { pos: { x: selfA.x, z: selfA.z }, heading: selfA.heading, pose: "sit" };
            petPhase = 0;
          }
          const rt = stepPetFollow(pet, petRuntimeRef.current, { x: selfA.x, z: selfA.z }, selfA.heading, dt);
          petRuntimeRef.current = rt;
          const moving = rt.pose === "follow";
          if (moving) petPhase += dt * 9;
          const parts = petGroup.userData as PetParts;
          if (parts.tail) parts.tail.rotation.y = Math.sin(tSec * (rt.pose === "play" ? 10 : 5)) * 0.45;
          const swing = Math.sin(petPhase) * 0.55 * (moving ? 1 : 0);
          if (parts.legFL) parts.legFL.rotation.x = swing;
          if (parts.legBR) parts.legBR.rotation.x = swing;
          if (parts.legFR) parts.legFR.rotation.x = -swing;
          if (parts.legBL) parts.legBL.rotation.x = -swing;
          if (parts.body) {
            const target = rt.pose === "sit" ? -0.5 : rt.pose === "sleep" ? 0.28 : 0;
            parts.body.rotation.x += (target - parts.body.rotation.x) * Math.min(1, dt * 8);
          }
          const hop = rt.pose === "play" ? Math.abs(Math.sin(tSec * 6)) * 0.09 : moving ? Math.abs(Math.sin(petPhase)) * 0.03 : 0;
          petGroup.visible = true;
          petGroup.position.set(rt.pos.x, LAND + hop, rt.pos.z);
          petGroup.rotation.y = rt.heading;
        } else if (petGroup) {
          petGroup.visible = false;
        }
      }

      // camera follows the player, user keeps orbit/zoom; in cinematic mode
      // it eases, leads the walk direction, pushes in on arrival, and drifts
      // very slowly when the user has not touched it for a while
      const self = actorsRef.current.get("self");
      const cam = camRef.current;
      if (self && !scenicRef.current) {
        const look = lookRef.current;
        const anchor = anchorRef.current;
        if (anchor && !(look && performance.now() < look.until)) {
          // minimap pin: hold this spot until tap-self, ⌂, a view switch, or setting off
          cam.tx += (THREE.MathUtils.clamp(anchor.x, -37, 37) - cam.tx) * Math.min(1, dt * 2.6);
          cam.tz += (THREE.MathUtils.clamp(anchor.z, -23, 23) - cam.tz) * Math.min(1, dt * 2.6);
        } else if (look && performance.now() < look.until) {
          // search focus wins for a few seconds: pan to the searched place
          cam.tx += (THREE.MathUtils.clamp(look.x, -37, 37) - cam.tx) * Math.min(1, dt * 2.6);
          cam.tz += (THREE.MathUtils.clamp(look.z, -23, 23) - cam.tz) * Math.min(1, dt * 2.6);
        } else {
          const lead = cineRef.current && self.blend > 0.3 ? self.blend : 0;
          const leadX = Math.sin(self.heading) * 1.6 * lead;
          const leadZ = Math.cos(self.heading) * 1.6 * lead;
          // Follow behaviour splits by state:
          // · MOVING — the camera travels WITH the player like a real map:
          //   the target tracks the figure's live position (not just the
          //   destination), easing at a rate that keeps up at vehicle
          //   speeds, and the map's orientation never changes on its own.
          // · STILL at overview distance — the frame re-anchors on the
          //   LAND's centre so the whole city stays the picture (pure
          //   player-follow pushed the city into the top half whenever
          //   the player stood in the south, leaving empty sea below).
          // Target clamps span nearly the whole miniature (±37 / ±23),
          // so following never stalls at the map's edge districts.
          const movingNow = self.blend > 0.25;
          const fitD = fitDistRef.current || 46;
          // phones stay on you: the frame is a neighbourhood, and centring
          // the whole metro would put that neighbourhood off to one side
          const centerW = compactRef.current || movingNow || followRef.current || trackSelfRef.current ? 0 : THREE.MathUtils.clamp((cam.distCur - fitD * 0.7) / (fitD * 0.3), 0, 1);
          const fr = frameOf(propsRef.current.cityKey);
          const fx = (self.x + leadX) * (1 - centerW) + fr.cx * centerW;
          const fz = (self.z + leadZ) * (1 - centerW) + (fr.cz - fr.h * 0.08) * centerW; // a touch north: the tilted view shows more foreground
          const ease = movingNow ? Math.min(1, dt * 4.2) : Math.min(1, dt * 2.2);
          cam.tx += (THREE.MathUtils.clamp(fx, -37, 37) - cam.tx) * ease;
          cam.tz += (THREE.MathUtils.clamp(fz, -23, 23) - cam.tz) * ease;
          // No automatic azimuth swing: like a real map app the city keeps
          // its orientation while you travel; only the user rotates it.
        }
      }
      if (focusRef.current > 0) focusRef.current = Math.max(0, focusRef.current - dt * 0.45);
      const pulse = cineRef.current ? Math.sin(Math.min(1, focusRef.current) * Math.PI) : 0;
      if (cam.cut > 0) cam.cut = Math.max(0, cam.cut - dt * 1.3);
      const cutEase = cam.cut * cam.cut;
      // on a trip the camera closes in on you so the vehicle / train is easy to follow (unless you zoomed yourself just now)
      const tripping = !!propsRef.current.selfEtaAt || trainPos.active;
      const userZoomedRecently = performance.now() - cam.lastUser < 4000;
      const tripDist = tripping && !userZoomedRecently ? Math.min(cam.dist, (fitDistRef.current || 46) * 0.42) : cam.dist;
      // ROUND-10 fix: in street mode the map zoom (cam.dist, often ~30)
      // used to fight the street target — the two eases settled halfway
      // (~19), so the camera stayed far away and the street read as a
      // tilted map. The street distance is now the single target.
      const streetDist = 3.5;
      const inStreet = streetRef.current && !trainPos.active && !propsRef.current.selfEtaAt;
      const wantDist = inStreet ? streetDist : tripDist * (1 - pulse * 0.16) * (1 - cutEase * 0.1);
      cam.distCur += (wantDist - cam.distCur) * Math.min(1, dt * 3.2);
      if (inStreet) {
        // street level: near-horizontal lens, close behind the player —
        // the follow logic above already tracks the figure, so the world
        // streams past at eye height like walking the real street.
        // Sleeping Dogs: while you walk, the camera swings in behind your
        // heading (unless you just dragged it somewhere yourself).
        cam.pol += (1.55 - cam.pol) * Math.min(1, dt * 3);
        cam.distCur += (streetDist - cam.distCur) * Math.min(1, dt * 3);
        const selfA = actorsRef.current.get("self");
        if (selfA && selfA.blend > 0.25 && performance.now() - cam.lastUser > 1500) {
          const wantAz = selfA.heading + Math.PI;
          let dAz = wantAz - cam.az;
          while (dAz > Math.PI) dAz -= Math.PI * 2;
          while (dAz < -Math.PI) dAz += Math.PI * 2;
          cam.az += dAz * Math.min(1, dt * 1.1);
        }
      }
      const sc = scenicRef.current;
      if (sc) {
        const t = Math.min(1, (performance.now() - sc.at) / sc.durMs);
        let sx2 = sc.x, sz2 = sc.z;
        if (sc.path && sc.path.length > 1) {
          const f = t * (sc.path.length - 1); const i = Math.min(sc.path.length - 2, Math.floor(f)); const u = f - i;
          sx2 = sc.path[i]![0] + (sc.path[i + 1]![0] - sc.path[i]![0]) * u; sz2 = sc.path[i]![1] + (sc.path[i + 1]![1] - sc.path[i]![1]) * u;
        }
        const k = Math.min(1, dt * 1.4);
        cam.tx += (sx2 - cam.tx) * k; cam.tz += (sz2 - cam.tz) * k;
        cam.az += (sc.az + t * 0.45 - cam.az) * k; // a slow, steady pan across the view
        cam.pol += (sc.pol - cam.pol) * k;
        cam.dist = sc.dist; cam.distCur += (sc.dist - cam.distCur) * k;
      }
      const distNow = cam.distCur;
      const azNow = cam.az + cutEase * 0.5;
      // portrait screens look more steeply down: the whole-city view used to be half sky and sea
      const polNow = !streetRef.current && !scenicRef.current && mount.clientWidth / Math.max(1, mount.clientHeight) < 0.8 ? Math.min(cam.pol, 0.42) : cam.pol;
      const cx = cam.tx + Math.sin(azNow) * Math.sin(polNow) * distNow;
      const cy = Math.cos(polNow) * distNow + 2;
      const cz = cam.tz + Math.cos(azNow) * Math.sin(polNow) * distNow;
      // ROUND-10 fix: the old Math.max(4, cy) floor lifted the street
      // camera to 4 units — above the player's head — so it looked DOWN
      // at the figure like a map. In street mode the floor is eye level.
      camera.position.set(cx, Math.max(streetRef.current ? 1.6 : 4, cy), cz);
      // street mode looks at chest height, so the horizon sits mid-frame
      // and the player is centred instead of sunk to the bottom edge
      camera.lookAt(cam.tx, LAND + (streetRef.current ? 1.3 : 0), cam.tz);
      const targetFov = streetRef.current ? 48 : cineRef.current && self ? 42 + self.blend * 2.5 : 42;
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
        camera.updateProjectionMatrix();
      }
      // ROUND-10g: fog = load distance — the street only loads ~48 m out,
      // so the far plane pulls in to 64 (just past the fog) and the map
      // keeps the full 500
      const targetFar = streetRef.current ? 64 : 500;
      if (Math.abs(camera.far - targetFar) > 0.5) {
        camera.far += (targetFar - camera.far) * Math.min(1, dt * 3);
        camera.updateProjectionMatrix();
      }

      // ROUND-10 street mode, throttled to ~4 Hz so React state doesn't
      // churn every frame: street name, facade refresh, state report.
      streetTick += dt;
      if (streetTick > 0.25) {
        streetTick = 0;
        if (streetRef.current) {
          const s = actorsRef.current.get("self");
          if (s) {
            const nm = streetNameAt(propsRef.current.cityKey, s.x, s.z);
            if (nm !== streetNameRef.current) { streetNameRef.current = nm; setStreetName(nm); }
            syncStreetFacades(s.x, s.z);
            manager.syncStreet(s.x, s.z);
          }
        }
        const walking = streetWalkRef.current || (streetRef.current && !!clickWalkRef.current);
        const rep = streetReportedRef.current;
        if (rep.active !== streetRef.current || rep.walking !== walking) {
          streetReportedRef.current = { active: streetRef.current, walking };
          propsRef.current.onStreetState?.({ active: streetRef.current, walking });
        }
      }

      // labels — decluttered. Every chip used to be drawn at once, so at the
      // default city-wide view ~90 pills (places + NPC name tags + metro
      // lines + road names) stacked into one unreadable blob. Now placement
      // is greedy by priority every few frames: you > where you stand >
      // people near you > nearby places > metro lines > road names, and any
      // chip that would overlap an already-placed one is hidden until the
      // camera moves or zooms. Zoomed out, NPC name tags (their emoji heads
      // stay in 3D) and road names drop out entirely; zoom in and everything
      // nearby comes back.
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      const overview = distNow > fitDistRef.current * 0.98;
      declutterTick++;
      const redo = declutterTick % 3 === 1;
      const placed: { x1: number; y1: number; x2: number; y2: number }[] = [];
      const density = labelDensityRef.current;
      const english = document.documentElement.lang === "en";
      // how many place labels may show at once (zoomed out it is the city view)
      // a phone shows a fraction of a desktop's map area, so it gets a fraction of the labels
      const scr = Math.max(0.35, Math.min(1, (w * h) / (1100 * 650)));
      const locCap = density === "all" ? 999 : Math.max(3, Math.round((overview ? (density === "few" ? 5 : 9) : density === "few" ? 8 : 18) * scr));
      let locShown = 0;
      /* separate budgets so place pins, neighbourhood names and stations never
         swamp the view (zoomed in they used to fill every gap) */
      const kc = (n: number) => Math.max(2, Math.round(n * scr));
      const kindCap = density === "all" ? { place: 999, area: 999, station: 999, road: 999 } : density === "few" ? { place: kc(3), area: kc(3), station: kc(2), road: 1 } : { place: kc(4), area: kc(3), station: kc(3), road: kc(2) };
      const kindShown = { place: 0, area: 0, station: 0, road: 0 };
      const cands: { chip: Chip; sx: number; sy: number; prio: number; near: boolean }[] = [];
      let measured = 0;
      /* round-3 (C): community pins ride the same declutter pass as the
         place / NPC chips, so a snake warning never stacks on top of a
         place name — they just compete for the same screen space. */
      const allChips = communityChipsRef.current.length > 0 ? chips.concat(communityChipsRef.current) : chips;
      for (const chip of allChips) {
        const pos = chip.getPos();
        // far-off place / area / station labels: skip before any projection or DOM work.
        // ROUND-10: in street mode the cutoff closes in too (20) — far place
        // names must not float over the street fog.
        const labelCut = streetRef.current ? 20 : 32;
        if ((chip.place || chip.area || chip.station) && !hover && (((chip.place || chip.station) && overview) || Math.hypot(pos.x - cam.tx, pos.z - cam.tz) > labelCut)) {
          if (chip.visible || chip.el.style.display !== "none") { chip.visible = false; chip.el.style.display = "none"; }
          continue;
        }
        v3.set(pos.x, pos.y, pos.z).project(camera);
        if (v3.z > 1 || v3.z < -1) {
          chip.visible = false;
          chip.el.style.display = "none";
          continue;
        }
        const sx = (v3.x * 0.5 + 0.5) * w;
        const sy = (-v3.y * 0.5 + 0.5) * h;
        if (!redo) {
          if (chip.visible) {
            chip.el.style.transform = `translate(-50%,-100%) translate(${(sx + chip.clampDx).toFixed(1)}px,${(sy + chip.clampDy).toFixed(1)}px)`;
          }
          continue;
        }
        const dCam = Math.hypot(pos.x - cam.tx, pos.z - cam.tz);
        const dHover = hover ? Math.hypot(sx - hover.x, sy - hover.y) : Infinity;
        const near = dHover < HOVER_R;
        let prio: number;
        if (chip.kind === "actor") {
          if (chip.self) prio = 0;
          else {
            // neighbours (NPCs) are scenery until you're next to them: their names show only within a few
            // steps of you (or under the cursor) — real players keep the wider rule below
            const me = actorsRef.current.get("self");
            const npcFar = chip.npc && (overview || !me || Math.hypot(pos.x - me.x, pos.z - me.z) > 5);
            if (!near && (npcFar || (overview && dCam > 20) || (density !== "all" && dCam > (density === "few" ? 6 : 12)))) {
              chip.visible = false;
              chip.el.style.display = "none";
              continue;
            }
            prio = 2 + dCam / 40;
          }
        } else if (chip.kind === "loc") {
          prio = (chip.locId !== undefined && chip.locId === propsRef.current.selfLocId ? 1 : 3) + dCam / 60;
        } else if (chip.kind === "community") {
          /* round-3 (C): community pins. A snake warning is safety info —
             it shows even at city-wide zoom and outranks everything but
             you and the searched pin; strays / notices / fishing spots
             join the normal mid-zoom crowd. */
          if (overview && chip.community !== "snake") {
            chip.visible = false;
            chip.el.style.display = "none";
            continue;
          }
          prio = (chip.community === "snake" ? 1.5 : chip.community === "stray" ? 3.5 : chip.community === "notice" ? 4 : 5) + dCam / 60;
        } else if (chip.area) {
          // towns/streets show from mid zoom (and city-wide unless 精简);
          // small neighbourhoods only up close — or under the cursor
          const show = chip.area === "big" ? (!overview || density !== "few") && dCam < 30 : !overview && dCam < 13;
          if (!near && !show) {
            chip.visible = false;
            chip.el.style.display = "none";
            continue;
          }
          prio = (chip.area === "big" ? 9.1 : 9.6) + dCam / 40;
        } else if (chip.pin) {
          const pin = pinRef.current;
          if (!pin || scenicRef.current) { if (chip.visible) { chip.visible = false; chip.el.style.display = "none"; } continue; }
          const nameEl = (chip.el as HTMLDivElement & { nameEl?: HTMLSpanElement }).nameEl;
          const t = `📍 ${pin.name}`;
          if (nameEl && nameEl.textContent !== t) { nameEl.textContent = t; chip.w = 0; }
          if (chip.w === 0) { chip.el.style.display = "flex"; chip.w = chip.el.offsetWidth; chip.h = chip.el.offsetHeight; }
          cands.push({ chip, sx, sy, prio: -1, near: true });
          continue;
        } else if (chip.ad !== undefined) {
          const ad = propsRef.current.billboards?.find((b) => b.slot === chip.ad);
          if (!ad) { if (chip.visible) { chip.visible = false; chip.el.style.display = "none"; } continue; }
          const t = `${ad.emoji} ${ad.text}`;
          if (chip.textEl && chip.textEl.textContent !== t) {
            chip.textEl.textContent = t;
            chip.el.title = `${ad.owner} · 广告 · 点一下去这里`;
            chip.el.setAttribute("aria-label", `广告：${ad.text}，前往这里`);
            chip.w = 0;
          }
          // ahead of the hover boost (0.5): moving the cursor onto the ad must not
          // let a neighbouring place name take its spot and hide it
          prio = 0.12;
        } else if (chip.station || chip.place) {
          if (!near && (overview || dCam > (chip.place ? 11 : 12))) {
            chip.visible = false;
            chip.el.style.display = "none";
            continue;
          }
          prio = (chip.place ? 9.3 : 9.5) + dCam / 40;
        } else if (chip.metro) {
          if (density === "few") {
            chip.visible = false;
            chip.el.style.display = "none";
            continue;
          }
          prio = 8;
        } else {
          if (overview) {
            chip.visible = false;
            chip.el.style.display = "none";
            continue;
          }
          prio = 9;
        }
        // around the cursor: labels win over the rest, closest first.
        // billboards stay at their own priority so the cursor never hides them
        if (near && chip.ad === undefined && !chip.self && (chip.kind !== "road" || chip.station || chip.place || chip.area)) prio = 0.5 + dHover / HOVER_R;
        // the English subtitle duplicates the name in English mode, and is
        // noise at city scale: show it only zoomed in, in Chinese
        if (chip.sub) {
          const want = overview || english || density === "few" ? "none" : "";
          if (chip.sub.style.display !== want) { chip.sub.style.display = want; chip.w = 0; }
        }
        const txt = chip.el.textContent ?? "";
        if (chip.w === 0 || (chip.kind === "actor" && txt !== chip.lastText)) {
          // measuring a label forces a layout: only a few per pass, so moving across the map doesn't stutter
          if (measured >= 8 && !chip.self && chip.kind !== "loc" && chip.ad === undefined) {
            // not measured yet: keep it hidden until its turn, or the first seconds after loading show every label at once
            if (chip.visible) { chip.visible = false; chip.el.style.display = "none"; }
            continue;
          }
          measured++;
          chip.el.style.display = chip.ad !== undefined ? "inline-flex" : "";
          chip.w = chip.el.offsetWidth;
          chip.h = chip.el.offsetHeight;
          chip.lastText = txt;
        }
        if (chip.w === 0) continue;
        cands.push({ chip, sx, sy, prio, near });
      }
      if (redo) {
        cands.sort((a, b) => a.prio - b.prio);
        for (const c of cands) {
          if (!c.near && c.chip.kind === "loc" && !c.chip.self && c.chip.locId !== propsRef.current.selfLocId && c.chip.locId !== propsRef.current.destLocId && locShown >= locCap) {
            c.chip.visible = false;
            c.chip.el.style.display = "none";
            continue;
          }
          const kk = c.chip.place ? "place" : c.chip.area ? "area" : c.chip.station ? "station" : c.chip.kind === "road" && !c.chip.metro && c.chip.ad === undefined && !c.chip.pin ? "road" : null;
          if (kk && !c.near && kindShown[kk] >= kindCap[kk]) {
            c.chip.visible = false;
            c.chip.el.style.display = "none";
            continue;
          }
          const hw = c.chip.w / 2 + (density === "all" || c.near ? 3 : 14);
          /* Edge clamp: pull the anchor inward so the WHOLE chip stays on
             screen — a place at the map's edge used to get its label sliced
             in half by the overlay edge. The delta is remembered on the
             chip so the between-pass frames stay clamped too. */
          const EDGE = 6;
          let ax = c.sx;
          let ay = c.sy;
          if (c.chip.w + 8 > w - EDGE * 2) ax = w / 2;
          else {
            if (ax - hw < EDGE) ax = EDGE + hw;
            if (ax + hw > w - EDGE) ax = w - EDGE - hw;
          }
          if (ay - c.chip.h - 5 < EDGE) ay = EDGE + c.chip.h + 5;
          if (ay + 2 > h - EDGE) ay = h - EDGE - 2;
          c.chip.clampDx = ax - c.sx;
          c.chip.clampDy = ay - c.sy;
          const box = { x1: ax - hw, y1: ay - c.chip.h - (density === "all" ? 5 : 10), x2: ax + hw, y2: ay + (density === "all" ? 2 : 6) };
          const hit = placed.some((b) => box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1);
          // a rented billboard is a button: overlap hides the other label, never the ad
          if (hit && c.chip.ad === undefined) {
            c.chip.visible = false;
            c.chip.el.style.display = "none";
            continue;
          }
          placed.push(box);
          if (c.chip.kind === "loc") locShown++;
          if (kk) kindShown[kk]++;
          c.chip.visible = true;
          c.chip.el.style.display = c.chip.pin ? "flex" : c.chip.ad !== undefined ? "inline-flex" : "";
          c.chip.el.style.transform = `translate(-50%,-100%) translate(${ax.toFixed(1)}px,${ay.toFixed(1)}px)`;
          if (c.chip.kind === "loc") {
            const pos = c.chip.getPos();
            const d = Math.hypot(pos.x - cam.tx, pos.z - cam.tz);
            c.chip.el.style.opacity = d > 46 ? "0.55" : "1";
          }
        }
      }

      {
        const pin = pinRef.current;
        pinBeam.visible = pinRing.visible = !!pin && !scenicRef.current;
        if (pin) {
          pinBeam.position.set(pin.x, LAND + 4.5, pin.z);
          pinRing.position.set(pin.x, LAND + 0.08, pin.z);
          const k = 1 + Math.sin(performance.now() / 260) * 0.18; pinRing.scale.set(k, k, k);
        }
      }
      // ROUND-8 click-to-walk marker: LoL-style move-click ripple on each
      // click (the ring spreads outward and fades over ~500ms), then a faint
      // persistent ring at the destination while the player walks there.
      // One ring mesh, reused per click; hidden when there is no target.
      {
        const cw = clickWalkRef.current;
        const mk = clickMarkerRef.current;
        if (mk) {
          if (!cw) {
            mk.visible = false;
          } else {
            mk.visible = true;
            mk.position.set(cw.x, LAND + 0.08, cw.z);
            const now = performance.now();
            const RIPPLE_MS = 500;
            const t0 = clickRippleAtRef.current;
            const mat = mk.material as THREE.MeshBasicMaterial;
            if (t0 >= 0 && now - t0 < RIPPLE_MS) {
              // expanding ripple: small -> ~2.4x, fading to transparent
              const u = (now - t0) / RIPPLE_MS; // 0..1
              const ease = 1 - Math.pow(1 - u, 2); // easeOutQuad: fast start
              const s = 0.5 + ease * 1.9;
              mk.scale.set(s, s, s);
              mat.opacity = 0.95 * (1 - u);
            } else {
              // ripple done: faint persistent ring at the destination
              const k = 1 + Math.sin(now / 300) * 0.15;
              mk.scale.set(k, k, k);
              mat.opacity = 0.55;
            }
          }
        }
      }
      if (fx) fx.render();
      else renderer.render(scene, camera);
    };
    // ROUND-10g: the manager owns chunk state now; the frame loop above
    // drains its queue within the per-frame budget, and the street tick
    // narrows it to the neighbourhood on the street.
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      fx?.dispose();
      ro.disconnect();
      sceneRef.current = null;
      chunkManagerRef.current = null;
      manager.dispose();
      chunkWorker?.terminate();
      delete (window as unknown as { __chunks?: unknown }).__chunks;
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerup", onUp);
      wheelTarget.removeEventListener("wheel", onWheel);
      wheelTarget.removeEventListener("pointermove", onHover);
      wheelTarget.removeEventListener("pointerleave", onHoverOut);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      labels.innerHTML = "";
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Sprite || o instanceof THREE.Points) {
          const mesh = o as THREE.Mesh;
          mesh.geometry?.dispose?.();
          const m = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m?.dispose?.();
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.cityKey]);

  /* Round-3 (C): community pins. App passes toMapMarkers() output as the
     communityMarkers prop; this effect turns each marker into a clickable
     HTML chip in the labels overlay (same mkChip-free pattern as the actor
     chips: emoji + label, pointer-events on, click → onCommunityMarkerClick).
     Position resolves from the marker's own x/z, falling back to its locId
     via resolveLoc, so pins without exact coordinates still land on their
     place. Declared AFTER the scene effect on purpose: the scene rebuild
     wipes the labels overlay (labels.innerHTML = ""), and effects run in
     declaration order, so these chips are recreated after every rebuild.
     Capped at 24 pins so a busy city can't flood the declutter pass. */
  const communityKey = (p.communityMarkers ?? []).map((m) => `${m.kind}:${m.id}:${m.label}`).join("|");
  useEffect(() => {
    const labels = labelsRef.current;
    for (const c of communityChipsRef.current) c.el.remove();
    communityChipsRef.current = [];
    const markers = (p.communityMarkers ?? []).slice(0, 24);
    if (!labels || markers.length === 0) return;
    const locs = getLocations(p.cityKey);
    const byId = new Map(locs.map((l) => [l.id, l]));
    for (const m of markers) {
      const loc = byId.get(m.pin.locId) ?? resolveLoc(p.cityKey, m.pin.locId);
      const x = m.pin.x ?? loc?.x;
      const z = m.pin.z ?? loc?.z;
      if (x === undefined || z === undefined) continue;
      const el = document.createElement("button");
      el.type = "button";
      el.textContent = `${m.emoji} ${m.label}`;
      el.setAttribute("aria-label", m.label);
      el.style.cssText = "position:absolute;left:0;top:0;transform:translate(-50%,-100%);white-space:nowrap;pointer-events:auto;cursor:pointer;font:700 10.5px 'Noto Sans SC',sans-serif;line-height:1.3;padding:2px 7px;border-radius:999px;background:rgba(255,253,248,.94);color:#14202b;border:1px solid rgba(20,26,32,.4);box-shadow:0 1px 4px rgba(10,20,30,.25);";
      if (m.kind === "snake") el.style.cssText += "background:#fef2f2;border-color:#dc2626;color:#991b1b;";
      el.addEventListener("pointerdown", (e) => e.stopPropagation());
      el.addEventListener("click", (e) => { e.stopPropagation(); propsRef.current.onCommunityMarkerClick?.(m); });
      labels.appendChild(el);
      communityChipsRef.current.push({
        el, kind: "community", community: m.kind, w: 0, h: 0, lastText: "", visible: true, clampDx: 0, clampDy: 0,
        getPos: () => ({ x, y: LAND + 1.6, z }),
      });
    }
    return () => {
      for (const c of communityChipsRef.current) c.el.remove();
      communityChipsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityKey, p.cityKey]);

  /* Round-9 + ROUND-10g: player shops / flats as VISIBLE 3D buildings on
     the map. This effect is now a REGISTRY: it turns the prop list into
     PlayerBuildingData (id/kind/locId/name/color) and hands it to the
     ChunkManager, which builds each shop/flat into its chunk at build
     time (body/roof/awning -> the matte bucket, the shop sign -> the
     chunk's sign InstancedMesh, the pick box -> playerPicks). A building
     in an unloaded chunk reappears when the chunk rebuilds — it reads the
     current list at build time. Changing the list refreshes only the
     chunks that gained or lost a building. (The scene effect seeds the
     ref before its first builds, so the first run below is a no-op when
     nothing changed since.) */
  const playerBuildingsKey = (p.playerBuildings ?? []).map((b) => `${b.id}|${b.kind}|${b.locId}|${b.name}|${b.color}`).join(";");
  useEffect(() => {
    const prev = playerBuildingsDataRef.current;
    const next: PlayerBuildingData[] = (p.playerBuildings ?? []).map((b) => ({
      id: b.id, kind: b.kind, locId: b.locId, name: b.name, color: b.color,
    }));
    const prevKey = prev.map((b) => `${b.id}|${b.kind}|${b.locId}|${b.name}|${b.color}`).join(";");
    const nextKey = next.map((b) => `${b.id}|${b.kind}|${b.locId}|${b.name}|${b.color}`).join(";");
    playerBuildingsDataRef.current = next;
    if (prevKey === nextKey) return; // nothing changed (incl. the first run, seeded by the scene effect)
    const mgr = chunkManagerRef.current;
    if (!mgr) return; // scene effect not built yet — the list is read at build time anyway
    const affected = new Set<string>();
    for (const b of [...prev, ...next]) {
      const loc = getLocations(p.cityKey).find((l) => l.id === b.locId) ?? resolveLoc(p.cityKey, b.locId);
      if (!loc) continue;
      affected.add(chunkKeyOf(loc.x + 1.8, loc.z + 1.3));
    }
    mgr.refreshKeys([...affected]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerBuildingsKey, p.cityKey]);

  const zoomBy = (f: number) => {
    autoFitRef.current = false;
    camRef.current.dist = Math.max(14, Math.min(130, camRef.current.dist * f));
    reportZoom();
  };
  const resetCam = () => {
    anchorRef.current = null;
    lookRef.current = null;
    trackSelfRef.current = false;
    camRef.current.az = 0; // north up: the long cities (Shenzhen strip, Hong Kong, Huizhou) fill the screen side to side
    camRef.current.pol = CAM_POL;
    autoFitRef.current = true;
    camRef.current.dist = baseDist();
    reportZoom();
  };
  /* ---- ROUND-10 street facades ---- */
  /** Nearest buildings wear lit facades while on the street; the map keeps
      its clean look. Synced on entry and refreshed as you walk (the frame
      loop calls this ~4 Hz). At most 12 buildings, within 16 units.
      ROUND-10g: bodies are merged now, so a facade is an OVERLAY BOX — a
      slightly larger box (w+0.06, h, d+0.06) with the same lit-window
      materials, placed at the building's world position/rotation and
      added to the scene (not the chunk group). It is removed when the
      building leaves the nearest 12, when its chunk unloads, or when the
      street is left. */
  const syncStreetFacades = (px: number, pz: number) => {
    if (!streetRef.current) return;
    const mapTex = streetFacadeTexRef.current ?? (streetFacadeTexRef.current = facadeTexture());
    const emTex = streetFacadeEmTexRef.current ?? (streetFacadeEmTexRef.current = facadeEmissiveTexture());
    const scored: { t: FacadeTarget; d: number }[] = [];
    for (const t of streetFacadeTargetsRef.current) {
      const d = Math.hypot(t.x - px, t.z - pz);
      if (d < 16) scored.push({ t, d });
    }
    scored.sort((a, b) => a.d - b.d);
    const near = scored.slice(0, 12);
    const want = new Set(near.map((s) => s.t.id));
    const have = new Set(streetFacadeRef.current.map((e) => e.id));
    for (let i = streetFacadeRef.current.length - 1; i >= 0; i--) {
      const e = streetFacadeRef.current[i]!;
      if (want.has(e.id)) continue;
      e.group.removeFromParent();
      for (const m of e.mats) {
        const sm = m as THREE.MeshStandardMaterial;
        (sm.map as THREE.Texture | null)?.dispose?.();
        (sm.emissiveMap as THREE.Texture | null)?.dispose?.();
        m.dispose();
      }
      const mi = streetFacadeMatsRef.current.indexOf(e.mats[0] as THREE.MeshStandardMaterial);
      if (mi >= 0) streetFacadeMatsRef.current.splice(mi, 1);
      streetFacadeRef.current.splice(i, 1);
    }
    for (const { t } of near) {
      if (have.has(t.id)) continue;
      const rx = Math.max(1, Math.round(t.w / 2.6));
      const ry = Math.max(1, Math.round(t.h / 2.6));
      const mapTile = mapTex.clone();
      mapTile.needsUpdate = true;
      mapTile.repeat.set(rx, ry);
      const emTile = emTex.clone();
      emTile.needsUpdate = true;
      emTile.repeat.set(rx, ry);
      const side = new THREE.MeshStandardMaterial({
        color: new THREE.Color(t.color), roughness: 0.85, metalness: 0.05,
        map: mapTile, emissive: 0xffc873, emissiveMap: emTile, emissiveIntensity: 0,
      });
      const plain = new THREE.MeshStandardMaterial({ color: new THREE.Color(t.color), roughness: 0.9 });
      const g = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(t.w + 0.06, t.h, t.d + 0.06), [side, side, plain, plain, side, side]);
      box.position.y = t.h / 2;
      g.add(box);
      g.position.set(t.x, LAND, t.z);
      g.rotation.y = t.rot;
      sceneRef.current?.add(g);
      streetFacadeMatsRef.current.push(side);
      streetFacadeRef.current.push({ id: t.id, group: g, mats: [side, plain], chunkKey: t.chunkKey });
    }
  };
  const removeStreetFacades = () => {
    for (const e of streetFacadeRef.current) {
      e.group.removeFromParent();
      for (const m of e.mats) {
        const sm = m as THREE.MeshStandardMaterial;
        (sm.map as THREE.Texture | null)?.dispose?.();
        (sm.emissiveMap as THREE.Texture | null)?.dispose?.();
        m.dispose();
      }
    }
    streetFacadeRef.current = [];
    streetFacadeMatsRef.current = [];
  };

  const toggleStreetCam = () => {
    const next = !streetRef.current;
    streetRef.current = next;
    setStreetCam(next);
    if (next) {
      // street level is the view from behind you, so a pinned look steps aside
      anchorRef.current = null;
      lookRef.current = null;
      trackSelfRef.current = true;
      autoFitRef.current = false;
      setCine(true);
      // facades come on with the street: the nearest buildings get lit
      // windows (refreshed as you walk); the map keeps its clean look
      const s = actorsRef.current.get("self");
      if (s) { syncStreetFacades(s.x, s.z); chunkManagerRef.current?.syncStreet(s.x, s.z); }
    } else {
      camRef.current.pol = CAM_POL;
      removeStreetFacades();
      const s0 = actorsRef.current.get("self");
      chunkManagerRef.current?.loadAll(s0?.x ?? 0, s0?.z ?? 0);
      streetWalkRef.current = false;
      streetKeysRef.current.clear();
      streetStickRef.current.x = 0;
      streetStickRef.current.y = 0;
      clickWalkRef.current = null;
      const s = actorsRef.current.get("self");
      if (s) s.speed = modeById((propsRef.current.travelModeId ?? "walk") as TransportModeId).mapSpeed;
      resetCam();
    }
    const rep = streetReportedRef.current;
    streetReportedRef.current = { active: next, walking: false };
    if (rep.active !== next || rep.walking) propsRef.current.onStreetState?.({ active: next, walking: false });
  };
  useEffect(() => { toggleStreetCamRef.current = toggleStreetCam; });

  /* ROUND-10: WASD / arrows steer in street mode; V toggles street/map,
     M goes back to the map. Ignored while typing, while a trip runs, or
     while the map is paused under a full-screen scene. */
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.code === "KeyV" && !e.repeat) { toggleStreetCamRef.current(); return; }
      if (e.code === "KeyM" && !e.repeat) { if (streetRef.current) toggleStreetCamRef.current(); return; }
      if (!streetRef.current || propsRef.current.paused) return;
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"].includes(e.code)) {
        streetKeysRef.current.add(e.code);
        if (e.code.startsWith("Arrow")) e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { streetKeysRef.current.delete(e.code); };
    const onBlur = () => { streetKeysRef.current.clear(); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  /* ---- minimap: world bounds shared by the draw + click mapping ---- */
  const MINI = { xMin: -40, xMax: 40, zMin: -25, zMax: 19 };
  useEffect(() => {
    if (!miniOpen) return;
    const draw = () => {
      const cv = miniCanvasRef.current;
      if (!cv) return;
      const g = cv.getContext("2d");
      if (!g) return;
      const W = cv.width, H = cv.height;
      const px = (x: number) => ((x - MINI.xMin) / (MINI.xMax - MINI.xMin)) * W;
      const py = (z: number) => ((z - MINI.zMin) / (MINI.zMax - MINI.zMin)) * H;
      const sx = W / (MINI.xMax - MINI.xMin);
      const cityKey = propsRef.current.cityKey;
      const locs = getLocations(cityKey);
      // sea, then the landmass deck (schematic, same bounds as the 3D one)
      const sea = g.createLinearGradient(0, 0, 0, H);
      sea.addColorStop(0, "#9fd3f0"); sea.addColorStop(1, "#6fb6e3");
      g.fillStyle = sea; g.fillRect(0, 0, W, H);
      g.fillStyle = "#eef0e2";
      g.strokeStyle = "#8fb3c9"; g.lineWidth = 2;
      if (TERRAIN[cityKey].LAND.length) {
        // the real islands and peninsulas, same polygons as the 3D land
        for (const poly of TERRAIN[cityKey].LAND) {
          g.beginPath();
          for (const ring of poly) ring.forEach(([x, z], i) => (i ? g.lineTo(px(x), py(z)) : g.moveTo(px(x), py(z))));
          g.fill("evenodd"); g.stroke();
        }
        g.fillStyle = "#c9cdc4";
        for (const poly of TERRAIN[cityKey].ACROSS) {
          g.beginPath();
          for (const ring of poly) ring.forEach(([x, z], i) => (i ? g.lineTo(px(x), py(z)) : g.moveTo(px(x), py(z))));
          g.fill("evenodd");
        }
        g.fillStyle = "#eef0e2";
      } else {
        const lx = px(-38), ly = py(-24), lw = px(38) - lx, lh = py(14) - ly;
        g.beginPath(); g.rect(lx, ly, lw, lh); g.fill(); g.stroke();
      }
      // road corridors
      g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineCap = "round";
      for (const r of ROADS[cityKey]) {
        g.lineWidth = Math.max(1.4, Math.min(4, r.w * sx * 0.55));
        g.beginPath(); g.moveTo(px(r.x1), py(r.z1)); g.lineTo(px(r.x2), py(r.z2)); g.stroke();
      }
      // the real metro / rail lines in their own colours: the minimap reads like a transit map
      g.lineJoin = "round";
      for (const line of metroLinesForCity(cityKey)) {
        if (line.stations.length < 2) continue;
        g.strokeStyle = line.colorCss; g.lineWidth = 3;
        g.beginPath(); line.stations.forEach((st, i) => (i ? g.lineTo(px(st.x), py(st.z)) : g.moveTo(px(st.x), py(st.z)))); g.stroke();
      }
      // every location as a small dot
      g.fillStyle = "rgba(60,70,80,0.55)";
      for (const l of locs) { g.beginPath(); g.arc(px(l.x), py(l.z), 2.6, 0, Math.PI * 2); g.fill(); }
      const actors = actorsRef.current;
      const self = actors.get("self");
      // destination: pulsing red target while it differs from where you stand
      const dest = propsRef.current.destLocId ? resolveLoc(cityKey, propsRef.current.destLocId) : undefined;
      if (dest && (!self || Math.hypot(dest.x - self.x, dest.z - self.z) > 2)) {
        const pulse = 7 + Math.sin(performance.now() / 280) * 2.5;
        g.strokeStyle = "#ff4d2e"; g.lineWidth = 3;
        g.beginPath(); g.arc(px(dest.x), py(dest.z), pulse, 0, Math.PI * 2); g.stroke();
        g.fillStyle = "#ff4d2e";
        g.beginPath(); g.arc(px(dest.x), py(dest.z), 3.4, 0, Math.PI * 2); g.fill();
      }
      // camera view centre: a dashed ring showing where the big map looks
      const cam = camRef.current;
      g.strokeStyle = "rgba(20,32,43,0.55)"; g.lineWidth = 1.8; g.setLineDash([5, 4]);
      g.beginPath(); g.arc(px(cam.tx), py(cam.tz), Math.max(8, cam.distCur * 0.3 * sx), 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
      // NPCs + remote players (live positions, straight from the actor set)
      for (const a of actors.values()) {
        if (a.isSelf) continue;
        const col = `#${a.color.toString(16).padStart(6, "0")}`;
        if (a.key.startsWith("npc-")) {
          g.fillStyle = col; g.globalAlpha = 0.85;
          g.beginPath(); g.arc(px(a.x), py(a.z), 3.6, 0, Math.PI * 2); g.fill();
          g.globalAlpha = 1;
        } else {
          g.fillStyle = col;
          g.strokeStyle = "#ffffff"; g.lineWidth = 1.8;
          g.beginPath(); g.arc(px(a.x), py(a.z), 5, 0, Math.PI * 2); g.fill(); g.stroke();
        }
      }
      // round-3 (C): community pins as small coloured dots (positions
      // already resolved onto the map by the chip sync effect)
      for (const c of communityChipsRef.current) {
        const pos = c.getPos();
        g.fillStyle = COMMUNITY_PIN_COLOR[c.community ?? "notice"];
        g.beginPath(); g.arc(px(pos.x), py(pos.z), 3.2, 0, Math.PI * 2); g.fill();
      }
      // you: the biggest dot, white ring + heading tick
      if (self) {
        const col = `#${self.color.toString(16).padStart(6, "0")}`;
        g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = 2;
        g.beginPath(); g.arc(px(self.x), py(self.z), 10 + Math.sin(performance.now() / 300) * 1.6, 0, Math.PI * 2); g.stroke();
        g.fillStyle = col; g.strokeStyle = "#ffffff"; g.lineWidth = 2.6;
        g.beginPath(); g.arc(px(self.x), py(self.z), 6.4, 0, Math.PI * 2); g.fill(); g.stroke();
        g.strokeStyle = "#ffffff"; g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(px(self.x), py(self.z));
        g.lineTo(px(self.x) + Math.sin(self.heading) * 11, py(self.z) + Math.cos(self.heading) * 11);
        g.stroke();
      }
    };
    draw();
    const id = window.setInterval(draw, 120);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miniOpen]);

  const onMiniClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const wx = MINI.xMin + ((e.clientX - rect.left) / rect.width) * (MINI.xMax - MINI.xMin);
    const wz = MINI.zMin + ((e.clientY - rect.top) / rect.height) * (MINI.zMax - MINI.zMin);
    // Pin the camera on the clicked spot. It stays there — no timed glance —
    // until the player taps their own dot, hits ⌂, switches view, or sets off.
    // Tapping the player dot hands the lens back to them. 16px is a little
    // wider than the drawn ring, still a dot on a whole-city thumbnail.
    const self = actorsRef.current.get("self");
    if (self) {
      const sx = rect.left + ((self.x - MINI.xMin) / (MINI.xMax - MINI.xMin)) * rect.width;
      const sy = rect.top + ((self.z - MINI.zMin) / (MINI.zMax - MINI.zMin)) * rect.height;
      if (Math.hypot(e.clientX - sx, e.clientY - sy) <= 16) {
        anchorRef.current = null;
        lookRef.current = null;
        trackSelfRef.current = true;
        return;
      }
    }
    trackSelfRef.current = false;
    lookRef.current = null;
    anchorRef.current = { x: wx, z: wz };
  };

  if (glFailed) {
    const locs = getLocations(p.cityKey);
    return (
      <div className="w-full rounded-[12px] border border-[var(--line)] bg-[var(--surface2)] p-4">
        <p className="mb-1 text-sm font-black">🗺️ 这台设备没能启动 3D 地图</p>
        <p className="mb-3 text-xs leading-relaxed text-[var(--dim)]">
          浏览器拒绝了 WebGL 画面（Mac App 里偶尔会这样）。先用地点列表照常玩——点任意地点即可前往，所有玩法都不受影响。
        </p>
        <div className="grid max-h-[380px] grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
          {locs.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-label={`前往${l.name}`}
              onClick={() => p.onSelect(l.id)}
              className={`rounded-[10px] border px-2.5 py-2 text-left text-[13px] font-bold transition ${l.id === p.selfLocId ? "border-[var(--accent)] bg-[var(--surface)]" : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--border)]"}`}
            >
              {l.emoji} {l.name}
              {l.id === p.selfLocId ? <span className="ml-1 text-[11px] text-[var(--accent)]">· 你在这里</span> : null}
            </button>
          ))}
        </div>
        {/* round-3 (C): community pins also work without WebGL — same tap → detail panel */}
        {(p.communityMarkers?.length ?? 0) > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-black">📍 社区动态 · 点一下看详情</p>
            <div className="flex flex-wrap gap-1.5">
              {p.communityMarkers!.map((m) => (
                <button
                  key={`${m.kind}:${m.id}`}
                  type="button"
                  onClick={() => p.onCommunityMarkerClick?.(m)}
                  className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-left text-xs font-bold"
                >
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={p.fill ? "map-stage relative h-full min-h-0 w-full flex-1 overflow-hidden rounded-[12px] bg-[#0b1622]" : "map-stage relative h-[420px] w-full overflow-hidden rounded-[12px] bg-[#0b1622] sm:h-[480px] lg:h-[640px] xl:h-[740px] 2xl:h-[840px]"}>
      <div ref={mountRef} className="absolute inset-0" />
      <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
      {cine && <div aria-hidden="true" className="cine-grade" />}
      {cine && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[5]" style={{ background: "radial-gradient(ellipse 118% 96% at 50% 42%, transparent 62%, rgba(5,10,18,0.34) 100%), linear-gradient(to bottom, rgba(5,10,18,0.16), transparent 13%, transparent 88%, rgba(5,10,18,0.2))" }} />
      )}
      <div className={`absolute bottom-3 right-3 z-10 flex max-w-[calc(100%-24px)] flex-wrap justify-end gap-1.5 compact-dock${miniOpen ? " mini-open" : ""}${p.scenic ? " hidden" : ""}`}>
        {p.extraControls}
        <button type="button" aria-label={viewMenu ? "收起视角和时间按钮" : "更多：时间、镜头、标签"} aria-expanded={viewMenu} data-tip={viewMenu ? tt("收起", "Collapse") : tt("更多按钮", "More buttons")} onClick={() => setViewMenu((v) => !v)} className={`tipbtn compact-only h-9 w-9 place-items-center justify-center rounded-full border text-base shadow ${viewMenu ? "border-[var(--accent)] bg-[#14202b]/95 text-white" : "border-black/40 bg-[#fffdf8]/95"}`}>🎛️</button>
        <button type="button" aria-label="跳到白天" data-tip={tt("跳到白天", "Jump to day")} onClick={() => jumpToPhase(0.32)} className={`tipbtn grid h-9 w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 text-base shadow${viewMenu ? "" : " compact-hide"}`}>☀️</button>
        <button type="button" aria-label="跳到黄昏" data-tip={tt("跳到黄昏", "Jump to dusk")} onClick={() => jumpToPhase(0.74)} className={`tipbtn grid h-9 w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 text-base shadow${viewMenu ? "" : " compact-hide"}`}>🌇</button>
        <button type="button" aria-label="跳到夜晚" data-tip={tt("跳到夜晚", "Jump to night")} onClick={() => jumpToPhase(0.93)} className={`tipbtn grid h-9 w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 text-base shadow${viewMenu ? "" : " compact-hide"}`}>🌙</button>
        <button type="button" aria-label="回到真实时间：天色按深圳/惠州当地此刻走" data-tip={tt("回到真实时间", "Back to real time")} onClick={backToRealTime} className={`tipbtn grid h-9 w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 text-base shadow${viewMenu ? "" : " compact-hide"}`}>🕐</button>
        <button type="button" aria-label={demo ? "停止延时演示" : "延时演示：一昼夜30秒，看昼夜光影全程"} aria-pressed={demo} data-tip={demo ? tt("停止延时演示", "Stop time-lapse") : tt("延时演示：一昼夜 30 秒", "Time-lapse: a day in 30 s")} onClick={toggleDemo} className={`tipbtn grid h-9 w-9 place-items-center rounded-full border text-base shadow ${demo ? "border-[var(--accent)] bg-[#14202b]/95" : "border-black/40 bg-[#fffdf8]/95"}${viewMenu ? "" : " compact-hide"}`}>🎥</button>
        <button type="button" aria-label={streetCam ? "打开地图（小地图/导航）" : "下到街上走（街景，WASD 移动，V 切换）"} aria-pressed={streetCam} data-tip={streetCam ? tt("打开地图 · M", "Open map · M") : tt("下到街上走 · V", "Walk the street · V")} onClick={toggleStreetCam} className={`tipbtn flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-black shadow ${streetCam ? "border-[var(--accent)] bg-[#14202b]/95 text-white" : "border-black/40 bg-[#fffdf8]/95 text-[#14202b]"}`}>{streetCam ? "🗺️ 地图" : "🚶 街景"}</button>
        <button type="button" aria-label={cine ? "关闭电影镜头" : "开启电影镜头"} aria-pressed={cine} data-tip={cine ? tt("关闭电影镜头", "Cinematic off") : tt("电影镜头", "Cinematic camera")} onClick={() => setCine((c) => !c)} className={`tipbtn grid h-9 w-9 place-items-center rounded-full border text-base shadow ${cine ? "border-[var(--accent)] bg-[#14202b]/95" : "border-black/40 bg-[#fffdf8]/95"}${viewMenu ? "" : " compact-hide"}`}>🎬</button>
        <span tabIndex={0} className={`tipbtn grid h-9 min-w-9 place-items-center rounded-full border border-black/40 bg-[#14202b]/90 px-2 text-[11px] font-black text-white shadow${viewMenu ? "" : " compact-hide"}`} aria-label={`当前缩放 ${zoomPct}%`} data-tip={tt("拖动旋转 · 滚轮或双指缩放", "Drag to rotate · scroll or pinch to zoom")} title="当前缩放比例（⌂ 回到 100%）">{zoomPct}%</span>
        <button type="button" aria-label="放大地图" data-tip={tt("放大", "Zoom in")} onClick={() => zoomBy(0.78)} className="tipbtn grid h-9 w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 text-base font-black text-[#14202b] shadow">＋</button>
        <button type="button" aria-label="缩小地图" data-tip={tt("缩小", "Zoom out")} onClick={() => zoomBy(1.28)} className="tipbtn grid h-9 w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 text-base font-black text-[#14202b] shadow">－</button>
        <button type="button" aria-label="标签密度" title={labelDensity === "few" ? "标签：精简（点一下切换）" : labelDensity === "normal" ? "标签：标准（点一下切换）" : "标签：全部（点一下切换）"} data-tip={labelDensity === "few" ? tt("标签：精简", "Labels: few") : labelDensity === "normal" ? tt("标签：标准", "Labels: standard") : tt("标签：全部", "Labels: all")} onClick={cycleLabels} className={`tipbtn tip-r grid h-9 min-w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 px-2 text-[11px] font-black text-[#14202b] shadow${viewMenu ? "" : " compact-hide"}`}>🏷️{labelDensity === "few" ? "简" : labelDensity === "normal" ? "标" : "全"}</button>
        <button type="button" aria-label={p.mapMode === "follow" ? "切换到更广的视角" : "切换到贴身视角"} title={p.mapMode === "follow" ? "现在：贴着你。点一下拉开，看你这一片（宽屏上是整座城）" : "现在：看你这一片。点一下贴得更近。想看整座城就双指捏合"} data-tip={p.mapMode === "follow" ? tt("贴着我 → 看这一片", "Close → wider") : tt("这一片 → 贴着我", "Wider → close")} onClick={() => p.onMapMode?.(p.mapMode === "follow" ? "city" : "follow")} className="tipbtn tip-r grid h-9 w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 text-base font-black text-[#14202b] shadow">{p.mapMode === "follow" ? "🗺️" : "🎯"}</button>
        <button type="button" aria-label="重置视角" data-tip={tt("重置视角", "Reset view")} onClick={resetCam} className="tipbtn tip-r grid h-9 w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 text-base font-black text-[#14202b] shadow">⌂</button>
      </div>
      {/* LOL-style minimap: whole-city thumbnail, live-linked to the big map */}
      <div className={`mini-dock absolute bottom-3 left-3 z-10${p.scenic ? " hidden" : ""}`}>
        {miniOpen ? (
          <div className="mini-card relative w-[176px] overflow-hidden rounded-[12px] border border-black/50 bg-[#0b1622]/85 shadow-xl sm:w-[220px]">
            <button type="button" aria-label="收起小地图" onClick={() => setMiniOpen(false)} className="compact-only absolute right-1 top-1 z-10 h-6 w-6 place-items-center justify-center rounded-full bg-black/55 text-[11px] font-black text-white">✕</button>
            <div className="compact-hide flex items-center gap-1 px-2 py-1">
              <span className="min-w-0 flex-1 truncate text-[11px] font-black text-white/90">🗺️ 小地图 · {CITIES[p.cityKey].name}全城</span>
              <button type="button" aria-label="收起小地图" onClick={() => setMiniOpen(false)} className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-white/85 transition hover:bg-white/20">收起 ▾</button>
            </div>
            <canvas
              ref={miniCanvasRef}
              width={440}
              height={242}
              onClick={onMiniClick}
              role="img"
              aria-label={tt("全城小地图：白色大圆点是你，彩色小点是NPC和在线玩家，红色靶心是目的地，虚线圈是大地图镜头位置。点别处，镜头停在那里；点自己回到人物。", "City minimap. The white dot is you. Tap elsewhere and the camera stays there; tap yourself to come back.")}
              className="mini-canvas block h-[97px] w-[176px] cursor-crosshair sm:h-[121px] sm:w-[220px]"
            />
            <p className="compact-hide px-2 py-1 text-[10px] font-bold leading-tight text-white/70">{tt("点别处镜头停住 · 点自己或 ⌂ 回来", "Tap to look · tap yourself or ⌂ to return")}</p>
          </div>
        ) : (
          <button type="button" aria-label="展开小地图" onClick={() => setMiniOpen(true)} className="rounded-full border border-black/50 bg-[#0b1622]/85 px-3.5 py-2 text-xs font-black text-white shadow-xl transition hover:bg-[#0b1622]">🗺️<span className="compact-hide"> 小地图 ▸</span></button>
        )}
      </div>
      {streetCam && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
          <div className="flex max-w-[calc(100vw-32px)] items-center gap-2 rounded-full border border-black/40 bg-[#0b1622]/85 px-3.5 py-1.5 text-xs font-black text-white shadow-xl">
            <span className="truncate">📍 {streetName || CITIES[p.cityKey].name}</span>
            <span className="hidden font-bold text-white/60 sm:inline">WASD / 摇杆走 · Shift 跑 · 拖动看四周 · V 回地图</span>
          </div>
        </div>
      )}
      {streetCam && <StreetStick stick={streetStickRef} />}
      {p.navOverlay}
    </div>
  );
}
