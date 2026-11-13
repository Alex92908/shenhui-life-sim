// ROUND-10g — TRUE on-demand chunk streaming.
//
// 10f cut the city into 16 m chunks but built ALL of them at city start
// and only toggled visibility, so startup still built the whole city and
// the geometry sat in memory forever. This module is the real thing, per
// the Three.js streaming best practice (research report
// research_notes/threejs-chunked-streaming-best-practice-20261113-0149):
//
//   * generateChunkData() — PURE data (no THREE): which locations, decor,
//     filler towers and shop rows belong to one chunk. Deterministic: every
//     random draw is seeded per spot (hash of its coordinates), so a chunk
//     rebuilds identically no matter what order chunks stream in.
//   * buildChunkMesh() — turns one chunk's data into THREE objects: at most
//     three merged meshes (matte / lit-windows / glassy, all sharing one
//     global material each, colour via vertex colours) + one InstancedMesh
//     per prop type (signs, filler towers). Landmark models merge per chunk
//     with the existing mergeStatic().
//   * disposeChunk() — on unload the chunk's geometries AND its chunk-owned
//     materials/textures are disposed (scene.remove() alone frees nothing —
//     that was the 10f leak). Shared materials (landmark cache, filler,
//     merged buckets) are never disposed.
//   * ChunkManager — imperative, outside React: Map keyed `${cx},${cz}`,
//     states unloaded -> queued -> generating -> ready, nearest-first,
//     one chunk built per frame, unload radius = load radius + 1 chunk.
//
// Chunk size: the cities are SMALL (Shenzhen ~48x28 units, 11 content
// chunks at 16 m). A 64 m render chunk would swallow a whole city, so the
// render chunk stays 16 m. Load radius 2 (5x5 = 80x80 m) is not arbitrary:
// street fog far is 42 m, and a player standing on a chunk corner only sees
// (r+1)*16 m of loaded city ahead — r=1 covers 32 m < 42 m (10f's 3x3 could
// show empty ground at the fog edge), r=2 covers 48 m > 42 m, so a chunk
// always materialises inside the fog. Unload radius is load + 1 (hysteresis:
// standing on a boundary must not load/unload the same chunk every frame).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createLandmarks, mergeStaticGeometries, collectKept, Kit, type DecorDesc } from "./landmarks";
import { releaseCpuAfterUpload } from "./round2/texCpuRelease";
import { getLocations, resolveLoc, type CityKey, type Loc } from "./data";
import { SKYLINE } from "./skyline";
import { ROADS as REAL_ROADS, type MapRoad } from "./roads";
import * as TSZ from "./terrain-sz";
import * as THZ from "./terrain-hz";
import * as THK from "./terrain-hk";

/** Land deck height; buildings sit on it. (Moved here from MapView — the
    chunk builder and the map share it.) */
export const LAND = 0.6;

/* ---- real land (moved here from MapView — chunk generation needs the
    same land test the map uses; MapView imports these back) ---- */
const TERRAIN: Record<CityKey, typeof THK> = { sz: TSZ, hz: THZ, hk: THK };
function inRing(x: number, z: number, r: [number, number][]): boolean {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i]!, [xj, zj] = r[j]!;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
const LAND_BOX: Record<CityKey, (readonly [number, number, number, number])[]> = Object.fromEntries((Object.keys(TERRAIN) as CityKey[]).map((ck) => [ck, TERRAIN[ck].LAND.map((p) => { const xs = p[0]!.map((q) => q[0]); const zs = p[0]!.map((q) => q[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)] as const; })])) as Record<CityKey, (readonly [number, number, number, number])[]>;
export function landAt(ck: CityKey, x: number, z: number): boolean {
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
    closest point on an expanding ring (step 0.5, out to 10 units). */
export function nearestLand(cityKey: CityKey, x: number, z: number, maxR = 10, step = 0.5): { x: number; z: number } | null {
  if (isLand(cityKey, x, z)) return { x, z };
  for (let r = step; r <= maxR + 1e-9; r += step) {
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

/* ---- chunk grid ---- */
/** Render chunk edge, in map units. */
export const CHUNK = 16;
/** Road widening applied to the real road data (was a MapView local). */
export const ROAD_W = 1.8;
/** THREE DETAIL TIERS — lee's home-designer cell-and-portal model
    (walkthrough-lod-references.md), rooms mapped to chunks: the player's
    chunk and its neighbours are FULL detail, the ring around them is a
    SIMPLIFIED silhouette (one merged box mass per building), and everything
    further is CULLED (unloaded + disposed). Each tier has an enter radius
    and a keep radius one chunk wider (hysteresis — standing on a boundary
    must not flip a chunk every frame). Radii are Chebyshev chunk distances
    from the player's chunk. The full radius still covers the street fog far
    end (42 m): a chunk at distance 2 spans 16–48 m, so the fog range is
    full detail; the simple ring (distance 3, 32–64 m) shows as coloured
    masses through the fog's outer band and is invisible beyond it. */
export const FULL_R = 2;
export const FULL_KEEP_R = 3;
export const SIMPLE_R = 3;
export const SIMPLE_KEEP_R = 4;
/** Street fog far end (m). Hard invariant: it must stay inside the
    full-detail ring — a chunk at distance FULL_R spans up to
    (FULL_R + 1) * CHUNK from the player's chunk edge — so new chunks
    materialise inside the fog. If you raise the fog, raise FULL_R to match
    (asserted in the ChunkManager constructor). */
export const STREET_FOG_FAR = 42;
export const chunkKeyOf = (x: number, z: number) => `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
export const chunkKeyOfCell = (cx: number, cz: number) => `${cx},${cz}`;
/** chunk keys within Chebyshev radius r of (x, z). */
export const chunksNear = (x: number, z: number, r: number): string[] => {
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  const out: string[] = [];
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) out.push(`${cx + dx},${cz + dz}`);
  return out;
};

export function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** One deterministic RNG stream per spot, seeded from the spot's identity
    — a chunk's content never depends on which chunks built before it. */
export const spotRnd = (tag: string) => mulberry(hash(tag));

export type LandmarksFactory = ReturnType<typeof createLandmarks>;
export const roadLen = (r: MapRoad) => Math.hypot(r.x2 - r.x1, r.z2 - r.z1);

/* ---- pure chunk data (no THREE) ---- */

export interface FillerSpot { x: number; z: number; h: number; c: number; w?: number }
export interface ShopSpot {
  x: number; z: number; rot: number; gw: number; gh: number;
  /** index into SHOP_PALETTE (body) / awning palette / sign colours */
  pal: number; awnPal: number; sign: number;
  /** pedestrian door point (where a passer-by walks in) */
  door: { dx: number; dz: number };
}
export interface ShopPt { x: number; z: number; dx: number; dz: number; ck: string }
export interface PlayerBuildingData { id: string; kind: "shop" | "flat"; locId: string; name: string; color: number }
export type ChunkSpecial = "wheel" | "pagoda" | null;

export interface ChunkCityData {
  cityKey: CityKey;
  locs: Loc[];
  locById: Map<string, Loc>;
  decor: DecorDesc[];
  filler: FillerSpot[];
  shops: ShopSpot[];
  roads: MapRoad[];
  chunkKeys: string[];
}

export interface ChunkData {
  key: string; cx: number; cz: number;
  locations: Loc[];
  decor: DecorDesc[];
  filler: FillerSpot[];
  shops: ShopSpot[];
  special: ChunkSpecial;
  playerBuildings: PlayerBuildingData[];
}

/* ---- mountains (moved here from MapView — the near checks need them) ---- */
export interface Peak { x: number; z: number; h: number; r: number; rock?: boolean }
export interface MountainRange { peaks: Peak[]; label?: string; lx?: number; lz?: number; ly?: number }
export function mountainRanges(ck: CityKey): MountainRange[] {
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
}

export interface NearChecks {
  nearLoc(x: number, z: number): boolean;
  nearRoad(x: number, z: number): boolean;
  nearMountain(x: number, z: number): boolean;
  nearLake(x: number, z: number): boolean;
}
/** Clearance tests for filler / shop / tree placement, from explicit
    inputs (no closure over the map builder). nearLake is always false:
    LAKES is empty in every city — reservoirs are real WATER polygons now. */
export function makeNearChecks(cityKey: CityKey, locs: Loc[], decor: DecorDesc[], roads: MapRoad[]): NearChecks {
  const mountains = mountainRanges(cityKey);
  const roadDist = (r: MapRoad, x: number, z: number): number => {
    const dx = r.x2 - r.x1, dz = r.z2 - r.z1;
    const t = Math.max(0, Math.min(1, ((x - r.x1) * dx + (z - r.z1) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - (r.x1 + dx * t), z - (r.z1 + dz * t));
  };
  return {
    nearLoc: (x, z) => locs.some((l) => Math.abs(l.x - x) < 3.4 && Math.abs(l.z - z) < 3.4) || decor.some((d) => Math.hypot(d.x - x, d.z - z) < d.r + 1.4),
    nearRoad: (x, z) => roads.some((r) => roadDist(r, x, z) < r.w / 2 + 1.1),
    nearMountain: (x, z) => mountains.some((range) => range.peaks.some((pk) => Math.hypot(x - pk.x, z - pk.z) < pk.r + 0.8)),
    nearLake: () => false,
  };
}

const FILLER_PALETTE = [0xe8e0cc, 0xd8cfb8, 0xc9d4d8, 0xe3d3c2, 0xd5dde3, 0xe9dcc8, 0xcfc4ae];
const TOWER_PALETTE = [0xb9cbd6, 0xa7bccb, 0xc9d4d8, 0x9fb4c2, 0xd5dde3];
export const SHOP_PALETTE = [0xe8dcc4, 0xdcc7a8, 0xc9d4d8, 0xe3cdb4, 0xd8e0d2, 0xead9c2, 0xd5c6e0, 0xf0dfc0];
export const SIGN_COLORS = [0xe63a1f, 0xf5b942, 0x2dd4bf, 0xec4899, 0x3b82f6];

/** Background filler towers on the 2.8 m grid, with the real skyline
    (OSM 90th-percentile heights) where mapped. Pure data; every random
    draw comes from the cell's own seeded stream, so the grid is identical
    no matter which chunks stream in first. */
function computeFillerSpots(cityKey: CityKey, near: NearChecks): FillerSpot[] {
  const spots: FillerSpot[] = [];
  const sky = (SKYLINE as Record<string, Record<string, [number, number]>>)[cityKey] ?? {};
  const skyRich = Object.keys(sky).length >= 60;
  for (let gx = -36; gx <= 36; gx += 2.8) {
    for (let gz = -20; gz <= 14; gz += 2.8) {
      const rng = spotRnd(`filler:${cityKey}:${gx},${gz}`);
      const real = sky[`${Math.round((gx + 36) / 2.8)},${Math.round((gz + 20) / 2.8)}`];
      const x = gx + (rng() - 0.5) * 1.3;
      const z = gz + (rng() - 0.5) * 1.3;
      if (!isLand(cityKey, x, z, 1.6)) continue;
      if (near.nearLoc(x, z) || near.nearRoad(x, z) || near.nearMountain(x, z) || near.nearLake(x, z)) continue;
      if (real) {
        const [n, h90] = real;
        const tall = Math.min(13, 1.4 + h90 / 20);
        const tc = () => TOWER_PALETTE[Math.floor(rng() * TOWER_PALETTE.length)] ?? 0xc9d4d8;
        if (n >= 30) {
          spots.push({ x: x - 0.45, z: z - 0.3, h: tall * (0.85 + rng() * 0.15), c: tc(), w: 0.5 });
          spots.push({ x: x + 0.5, z: z + 0.35, h: tall * (0.6 + rng() * 0.25), c: tc(), w: 0.55 });
        } else spots.push({ x, z, h: Math.max(1.5, tall * (0.7 + rng() * 0.3)), c: tc(), w: n >= 8 ? 0.7 : 0.85 });
        continue;
      }
      if (rng() < (skyRich ? 0.45 : 0.33)) continue;
      const c = FILLER_PALETTE[Math.floor(rng() * FILLER_PALETTE.length)] ?? 0xe8e0cc;
      spots.push({ x, z, h: skyRich ? 0.8 + rng() * 1.8 : 1.2 + rng() * rng() * 7.5, c });
    }
  }
  return spots;
}

/** Shop rows lining the roads (max 120/city). Pure data; each candidate
    has its own seeded stream, and candidates are considered in fixed road
    order, so the accepted set is deterministic. */
function computeShopSpots(cityKey: CityKey, roads: MapRoad[], near: NearChecks): ShopSpot[] {
  const spots: ShopSpot[] = [];
  const roadDist = (r: MapRoad, x: number, z: number): number => {
    const dx = r.x2 - r.x1, dz = r.z2 - r.z1;
    const t = Math.max(0, Math.min(1, ((x - r.x1) * dx + (z - r.z1) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - (r.x1 + dx * t), z - (r.z1 + dz * t));
  };
  let shopCount = 0;
  for (let ri = 0; ri < roads.length; ri++) {
    const r = roads[ri]!;
    if (shopCount >= 120) break;
    const len = roadLen(r);
    const ang = Math.atan2(r.z2 - r.z1, r.x2 - r.x1);
    const steps = Math.floor(len / 3.3);
    for (let i = 1; i < steps && shopCount < 120; i++) {
      for (const side of [1, -1]) {
        if (shopCount >= 120) break;
        const rng = spotRnd(`shop:${cityKey}:${ri}:${i}:${side}`);
        if (rng() < 0.3) continue;
        const t = (i + (rng() - 0.5) * 0.3) / steps;
        const off = r.w / 2 + 1.85;
        const x = r.x1 + (r.x2 - r.x1) * t + Math.sin(ang) * off * side;
        const z = r.z1 + (r.z2 - r.z1) * t - Math.cos(ang) * off * side;
        if (!isLand(cityKey, x, z, 1.4)) continue;
        if (near.nearLoc(x, z) || near.nearMountain(x, z) || near.nearLake(x, z)) continue;
        if (roads.some((o) => o !== r && roadDist(o, x, z) < o.w / 2 + 1.5)) continue;
        if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 2.3)) continue;
        const gh = 1.5 + rng() * 2.1;
        const gw = 2 + rng() * 0.9;
        const pal = Math.floor(rng() * SHOP_PALETTE.length);
        const awnPal = Math.floor(rng() * SHOP_PALETTE.length);
        const sign = Math.floor(rng() * SIGN_COLORS.length);
        spots.push({
          x, z, rot: -ang + (side > 0 ? 0 : Math.PI), gw, gh, pal, awnPal, sign,
          door: { dx: x - Math.sin(ang) * side * 1.15, dz: z + Math.cos(ang) * side * 1.15 },
        });
        shopCount++;
      }
    }
  }
  return spots;
}

/** The whole city's chunk data, computed ONCE per city (pure, no THREE —
    a few thousand cheap checks). Chunk builds then only filter it. */
export function buildCityData(cityKey: CityKey, roads: MapRoad[], landmarks: LandmarksFactory): ChunkCityData {
  const locs = getLocations(cityKey);
  const locById = new Map(locs.map((l) => [l.id, l]));
  const decor = landmarks.decor(cityKey);
  const near = makeNearChecks(cityKey, locs, decor, roads);
  const filler = computeFillerSpots(cityKey, near);
  const shops = computeShopSpots(cityKey, roads, near);
  const keys = new Set<string>();
  for (const s of [...locs, ...decor, ...filler, ...shops]) keys.add(chunkKeyOf(s.x, s.z));
  // the ferris wheel / pagoda anchor can sit in a neighbouring chunk with
  // no other content — its chunk must exist or the landmark never builds
  if (cityKey === "sz") {
    const hv = locById.get("happyvalley");
    if (hv) keys.add(chunkKeyOf(hv.x - 1.2, hv.z - 2.2));
  } else {
    const xh = getLocations("hz").find((l) => l.id === "xihu");
    if (xh) keys.add(chunkKeyOf(xh.x + 2.2, xh.z + 1.6));
  }
  return { cityKey, locs, locById, decor, filler, shops, roads, chunkKeys: [...keys].sort() };
}

/** The data for ONE chunk — a pure filter over the city data. Call it
    twice with the same inputs and you get the same chunk back (the Node
    smoke test asserts exactly that). */
export function generateChunkData(cityData: ChunkCityData, key: string, playerBuildings: PlayerBuildingData[]): ChunkData {
  const [cx, cz] = key.split(",").map(Number);
  const inChunk = (x: number, z: number) => Math.floor(x / CHUNK) === cx && Math.floor(z / CHUNK) === cz;
  let special: ChunkSpecial = null;
  if (cityData.cityKey === "sz") {
    const hv = cityData.locById.get("happyvalley");
    if (hv && inChunk(hv.x - 1.2, hv.z - 2.2)) special = "wheel";
  } else {
    const xh = getLocations("hz").find((l) => l.id === "xihu");
    if (xh && inChunk(xh.x + 2.2, xh.z + 1.6)) special = "pagoda";
  }
  const pbs = playerBuildings.filter((b) => {
    const loc = cityData.locById.get(b.locId) ?? resolveLoc(cityData.cityKey, b.locId);
    return !!loc && inChunk(loc.x + 1.8, loc.z + 1.3);
  });
  return {
    key, cx: cx ?? 0, cz: cz ?? 0,
    locations: cityData.locs.filter((l) => inChunk(l.x, l.z)),
    decor: cityData.decor.filter((d) => inChunk(d.x, d.z)),
    filler: cityData.filler.filter((s) => inChunk(s.x, s.z)),
    shops: cityData.shops.filter((s) => inChunk(s.x, s.z)),
    special,
    playerBuildings: pbs,
  };
}

/* ---- mesh building (THREE objects, one chunk at a time) ---- */

export interface SmokeSprite { sp: THREE.Sprite; phase: number; x: number; z: number }
export interface FacadeTarget { id: string; x: number; z: number; w: number; h: number; d: number; rot: number; chunkKey: string; color: number }

export interface SharedChunkMats {
  /** bases, roofs, door props, awnings, player buildings — one material for
      the whole city, colour via vertex colours */
  matte: THREE.MeshStandardMaterial;
  /** matte bodies, with the lit-windows texture glowing after dark */
  windows: THREE.MeshStandardMaterial;
  /** tall towers (h > 6.5): glassy metal, same window glow */
  glassy: THREE.MeshStandardMaterial;
  /** instanced neon signs: one material, colour via instanceColor */
  sign: THREE.MeshBasicMaterial;
}
export function createSharedChunkMats(winTex: THREE.Texture): SharedChunkMats {
  return {
    matte: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85, flatShading: true }),
    windows: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.78, metalness: 0.05, emissive: 0xffc873, emissiveMap: winTex, emissiveIntensity: 0 }),
    glassy: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.32, metalness: 0.45, emissive: 0xffc873, emissiveMap: winTex, emissiveIntensity: 0 }),
    sign: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
}

/** Geometries shared across chunks (one box each, never disposed per chunk
    — disposeChunk skips them; the per-chunk cost is the InstancedMesh
    instance buffers, released by mesh.dispose()). */
const SHARED_GEOS = new Set<THREE.BufferGeometry>();
export const FILLER_GEO: THREE.BufferGeometry = (() => { const g = new THREE.BoxGeometry(1.9 * 0.72, 1, 1.9 * 0.72); SHARED_GEOS.add(g); return g; })();
const SIGN_GEO: THREE.BufferGeometry = (() => { const g = new THREE.BoxGeometry(1, 1, 1); SHARED_GEOS.add(g); return g; })();

const _bm = new THREE.Matrix4();
const _bq = new THREE.Quaternion();
const _be = new THREE.Euler();
const _bv = new THREE.Vector3();
const _bs = new THREE.Vector3();
/** Bake a part into world space: the part sits in a group at (gx, LAND, gz)
    rotated gRy, at local (lx, ly, lz) rotated (lRx, lRy, lRz), scaled. */
function bake(geo: THREE.BufferGeometry, gx: number, gz: number, gRy: number, lx: number, ly: number, lz: number, lRx = 0, lRy = 0, lRz = 0, sX = 1, sY = 1, sZ = 1): THREE.BufferGeometry {
  _bq.setFromEuler(_be.set(lRx, lRy, lRz));
  _bm.compose(_bv.set(lx, ly, lz), _bq, _bs.set(sX, sY, sZ));
  geo.applyMatrix4(_bm);
  _bq.setFromEuler(_be.set(0, gRy, 0));
  _bm.compose(_bv.set(gx, LAND, gz), _bq, _bs.set(1, 1, 1));
  geo.applyMatrix4(_bm);
  return geo;
}
/** Fill a `color` vertex attribute so merged meshes can share one white
    material and still wear per-building colours. */
function paint(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const n = geo.attributes.position!.count;
  const arr = new Float32Array(n * 3);
  const c = new THREE.Color(hex);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geo;
}
const shade = (hex: number, f: number): number => new THREE.Color(hex).multiplyScalar(f).getHex();

const NEON_TYPES = new Set(["food", "mall", "social", "apec", "market", "electronics", "oilpainting", "secondhand", "seafood", "oldtown", "womensstreet", "museum", "library", "factory", "transit", "work", "lodging", "home"]);
const STREET_TYPES = new Set(["food", "mall", "market", "electronics", "oilpainting", "secondhand", "seafood", "oldtown", "womensstreet", "social"]);

export interface ChunkBuildCtx {
  cityKey: CityKey;
  scene: THREE.Scene;
  landmarks: LandmarksFactory;
  /** cityData.locById — player buildings resolve their anchor through it */
  locById: Map<string, Loc>;
  mats: SharedChunkMats;
  fillerMat: THREE.Material;
  pickMat: THREE.Material;
  labelTop: Map<string, number>;
  glowTexture: () => THREE.Texture;
  /** loaded Ping An .glb (null until the async load lands); read live so a
      chunk built after the load applies the tower immediately */
  pinganModel: { current: THREE.Object3D | null };
}

export interface ChunkBuildResult {
  group: THREE.Group;
  picks: THREE.Object3D[];
  playerPicks: THREE.Object3D[];
  smokes: SmokeSprite[];
  avs: THREE.Mesh[];
  wheels: THREE.Object3D[];
  flags: THREE.Mesh[];
  facades: FacadeTarget[];
  shopPts: ShopPt[];
  labelTops: [string, number][];
  ownedMats: Set<THREE.Material>;
  ownedTexs: Set<THREE.Texture>;
  pinganRoot: THREE.Group | null;
}

interface SignSpec { x: number; y: number; z: number; ry: number; sx: number; sy: number; sz: number; color: number }

/** Replace a location's landmark miniature in place with the compiled
    Ping An .glb (ported verbatim from MapView's swap, minus the
    still-loaded guard which belongs to the caller). */
export function applyPinganGlb(root: THREE.Group, model: THREE.Object3D, labelTop: Map<string, number>): void {
  const inner = model.clone(true);
  const plaza: THREE.Mesh[] = [];
  inner.traverse((o) => {
    const me = o as THREE.Mesh;
    if (!me.isMesh) return;
    const b = new THREE.Box3().setFromObject(me);
    const s = b.getSize(new THREE.Vector3());
    if (s.x > 10 && s.z > 10 && s.y < 0.5) plaza.push(me);
  });
  for (const me of plaza) { me.removeFromParent(); me.geometry.dispose(); }
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  inner.scale.setScalar(19 / Math.max(1e-3, size.y));
  const box2 = new THREE.Box3().setFromObject(inner);
  const c2 = box2.getCenter(new THREE.Vector3());
  inner.position.set(-c2.x, -box2.min.y, -c2.z);
  for (const ch of root.children.slice()) {
    if ((ch as THREE.Mesh).userData?.locId) continue;
    ch.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh) me.geometry.dispose(); });
    root.remove(ch);
  }
  root.add(inner);
  labelTop.set("bank", 19);
}

/** Build ONE chunk's THREE objects from its pure data. Nothing here runs
    at city start — the ChunkManager calls it only when the chunk is wanted.
    Static masses merge into at most three meshes (matte / windows / glassy);
    neon signs become one InstancedMesh; landmark models merge per chunk with
    mergeStatic() as before. Picking still works: every location gets an
    invisible pick box (the merged bodies can't carry a per-building locId). */
/* ---- chunk payload: serializable geometry (worker-safe) ---- */

export interface GeometryArrays {
  position: Float32Array;
  normal: Float32Array;
  uv?: Float32Array;
  color?: Float32Array;
  index?: Uint16Array | Uint32Array;
}
/** One merged mesh: `mat` is a shared-bucket name ("matte" | "windows" |
    "glassy") or a landmark matKey (resolved on the main thread). */
export interface PayloadMesh { mat: string; arrays: GeometryArrays; }
/** A kept object (spinning wheel, Ping An miniature): its meshes baked
    into its local space, plus its world matrix for placement. */
export interface KeptPayload { matrix: number[]; parts: PayloadMesh[]; }
export interface PickMeta { locId: string; x: number; y: number; z: number; w: number; h: number; d: number }
export interface PlayerPickMeta { id: string; x: number; y: number; z: number; w: number; h: number; d: number }
export interface SmokeMeta { locId: string; x: number; y: number; z: number; s: number; ph: number; lx: number; lz: number }

/** Everything a chunk needs, as plain data + typed arrays — no THREE
    objects escape, so this crosses the worker boundary by postMessage. */
export interface ChunkPayload {
  key: string;
  meshes: PayloadMesh[];
  filler: { matrices: Float32Array; colors: Float32Array; count: number } | null;
  signs: { matrices: Float32Array; colors: Float32Array; count: number } | null;
  picks: PickMeta[];
  playerPicks: PlayerPickMeta[];
  smokes: SmokeMeta[];
  avs: { x: number; y: number; z: number }[];
  flags: { x: number; y: number; z: number; wx: number }[];
  spin: KeptPayload[];
  pingan: KeptPayload | null;
  /** the 泗洲塔 pagoda anchor (the ferris wheel rides the `spin` payload
      instead — it is a spinning group, not static metadata) */
  special: { kind: "pagoda"; x: number; z: number } | null;
  facades: FacadeTarget[];
  shopPts: ShopPt[];
  labelTops: [string, number][];
}

/** Strip a BufferGeometry down to its raw arrays (the geometry itself is
    left for GC — its arrays live on in the payload). */
export function geometryToArrays(geo: THREE.BufferGeometry): GeometryArrays {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nor = geo.attributes.normal as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute | undefined;
  const col = geo.attributes.color as THREE.BufferAttribute | undefined;
  const out: GeometryArrays = { position: pos.array as Float32Array, normal: nor.array as Float32Array };
  if (uv) out.uv = uv.array as Float32Array;
  if (col) out.color = col.array as Float32Array;
  if (geo.index) out.index = geo.index.array as Uint16Array | Uint32Array;
  return out;
}
export function geometryFromArrays(a: GeometryArrays): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(a.position, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(a.normal, 3));
  if (a.uv) geo.setAttribute("uv", new THREE.BufferAttribute(a.uv, 2));
  if (a.color) geo.setAttribute("color", new THREE.BufferAttribute(a.color, 3));
  if (a.index) geo.setIndex(new THREE.BufferAttribute(a.index, 1));
  geo.computeBoundingSphere();
  return geo;
}
/** Every transferable ArrayBuffer in a payload, for zero-copy postMessage.
    (Only buffers the array fully owns — a view into a larger buffer is
    left untransferred rather than risking a duplicate entry.) */
export function payloadTransferables(p: ChunkPayload): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];
  const add = (a: ArrayBufferView | undefined) => {
    if (!a) return;
    if (a.byteOffset === 0 && a.buffer.byteLength === a.byteLength) out.push(a.buffer as ArrayBuffer);
  };
  const addMesh = (m: PayloadMesh) => { add(m.arrays.position); add(m.arrays.normal); add(m.arrays.uv); add(m.arrays.color); add(m.arrays.index); };
  for (const m of p.meshes) addMesh(m);
  if (p.filler) { add(p.filler.matrices); add(p.filler.colors); }
  if (p.signs) { add(p.signs.matrices); add(p.signs.colors); }
  for (const s of p.spin) for (const part of s.parts) addMesh(part);
  if (p.pingan) for (const part of p.pingan.parts) addMesh(part);
  return out;
}

export interface ChunkPayloadCtx {
  cityKey: CityKey;
  landmarks: LandmarksFactory;
  /** cityData.locById — player buildings resolve their anchor through it */
  locById: Map<string, Loc>;
}
export interface ChunkMaterializeCtx {
  cityKey: CityKey;
  landmarks: LandmarksFactory;
  mats: SharedChunkMats;
  fillerMat: THREE.Material;
  pickMat: THREE.Material;
  labelTop: Map<string, number>;
  glowTexture: () => THREE.Texture;
  /** loaded Ping An .glb (null until the async load lands); read live so a
      chunk built after the load applies the tower immediately */
  pinganModel: { current: THREE.Object3D | null };
}

/** Build ONE chunk's geometry as a serializable payload — no THREE objects
    escape, so it runs identically on the main thread and in the chunk
    worker. Geometry production is the expensive half (~15–20 ms on the
    densest chunk, mostly landmark Kit building + merging); materializing
    is just wrapping arrays (~1–2 ms). */
export function buildChunkPayload(data: ChunkData, pctx: ChunkPayloadCtx): ChunkPayload {
  const { cityKey } = pctx;
  const key = data.key;
  const meshes: PayloadMesh[] = [];
  const picks: PickMeta[] = [];
  const playerPicks: PlayerPickMeta[] = [];
  const smokes: SmokeMeta[] = [];
  const avs: { x: number; y: number; z: number }[] = [];
  const flags: { x: number; y: number; z: number; wx: number }[] = [];
  const facades: FacadeTarget[] = [];
  const shopPts: ShopPt[] = [];
  const labelTops: [string, number][] = [];
  const signs: SignSpec[] = [];
  const spin: KeptPayload[] = [];
  let pingan: KeptPayload | null = null;
  const matte: THREE.BufferGeometry[] = [];
  const windows: THREE.BufferGeometry[] = [];
  const glassy: THREE.BufferGeometry[] = [];
  const flushBucket = (geos: THREE.BufferGeometry[], mat: string) => {
    if (geos.length === 0) return;
    const merged = mergeGeometries(geos, false)!;
    meshes.push({ mat, arrays: geometryToArrays(merged) });
  };

  /* ---- location buildings ---- */
  const landmarkRoots: THREE.Object3D[] = [];
  const spinObjs: THREE.Object3D[] = [];
  for (const l of data.locations) {
    const built = pctx.landmarks.forLoc(cityKey, l);
    if (built) {
      built.group.position.set(l.x, LAND, l.z);
      if (l.id === "bank" && cityKey === "sz") {
        // Ping An miniature: kept whole (the .glb swap replaces it), never merged
        const kept = collectKept(built.group);
        pingan = { matrix: kept.matrix, parts: kept.parts.map((p) => ({ mat: p.matKey, arrays: geometryToArrays(p.geometry) })) };
        picks.push({ locId: l.id, x: l.x, y: LAND + built.top / 2, z: l.z, w: l.w, h: built.top, d: l.w });
        labelTops.push([l.id, built.top]);
        built.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
        continue;
      }
      spinObjs.push(...built.spin);
      landmarkRoots.push(built.group);
      picks.push({ locId: l.id, x: l.x, y: LAND + built.top / 2, z: l.z, w: l.w, h: built.top, d: l.w });
      labelTops.push([l.id, built.top]);
      if (l.type === "apec") {
        matte.push(paint(bake(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), l.x, l.z, 0, 0, built.top + 1.2, 0), 0x222222));
        flags.push({ x: l.x + 0.78, y: LAND + built.top + 1.95, z: l.z, wx: l.x });
      }
      continue;
    }
    const h = l.h * 1.7;
    const bodyBucket = h > 6.5 ? glassy : windows;
    matte.push(paint(bake(new THREE.BoxGeometry(l.w, 0.5, l.w), l.x, l.z, 0, 0, 0.25, 0), 0xb8ad92));
    bodyBucket.push(paint(bake(new THREE.BoxGeometry(l.w * 0.82, h, l.w * 0.82), l.x, l.z, 0, 0, 0.5 + h / 2, 0), l.color));
    const roofH = Math.min(1.6, h * 0.22 + 0.5);
    matte.push(paint(bake(new THREE.ConeGeometry(l.w * 0.66, roofH, 4), l.x, l.z, 0, 0, 0.5 + h + roofH / 2, 0, 0, Math.PI / 4, 0), shade(l.color, 0.72)));
    if (NEON_TYPES.has(l.type)) {
      signs.push({ x: l.x, y: LAND + 0.5 + h * 0.52, z: l.z + l.w * 0.41 + 0.06, ry: 0, sx: Math.min(2.2, l.w * 0.62), sy: 0.55, sz: 0.1, color: l.color });
    }
    if (STREET_TYPES.has(l.type)) {
      matte.push(paint(bake(new THREE.BoxGeometry(l.w * 0.72, 0.08, 0.9), l.x, l.z, 0, 0, 1.55, l.w * 0.41 + 0.42, 0.38, 0, 0), shade(l.color, 0.85)));
      matte.push(paint(bake(new THREE.BoxGeometry(0.9, 1.1, 0.06), l.x, l.z, 0, l.w * 0.3, 0.75, l.w * 0.41 + 0.18, 0, 0.15, 0), 0x2b2118));
      matte.push(paint(bake(new THREE.BoxGeometry(0.45, 0.45, 0.45), l.x, l.z, 0, -l.w * 0.28, 0.22, l.w * 0.41 + 0.32), 0x8a6b45));
      matte.push(paint(bake(new THREE.BoxGeometry(0.38, 0.38, 0.38), l.x, l.z, 0, -l.w * 0.28, 0.6, l.w * 0.41 + 0.32, 0, 0.3, 0), 0x8a6b45));
      matte.push(paint(bake(new THREE.CylinderGeometry(0.22, 0.16, 0.3, 8), l.x, l.z, 0, l.w * 0.34, 0.15, l.w * 0.41 + 0.38), 0x9a5a3c));
      matte.push(paint(bake(new THREE.ConeGeometry(0.26, 0.55, 8), l.x, l.z, 0, l.w * 0.34, 0.55, l.w * 0.41 + 0.38), 0x4a7a3f));
    }
    if (h > 7) avs.push({ x: l.x, y: LAND + 0.5 + h + roofH + 0.25, z: l.z });
    if (l.type === "food") {
      const rng = spotRnd(`smoke:${l.id}`);
      for (let i = 0; i < 9; i++) {
        const ph = i / 9;
        smokes.push({
          locId: l.id,
          x: l.x + (rng() - 0.5) * 1.6, y: LAND + 1.6 + ph * 3.4, z: l.z + (rng() - 0.5) * 1.2,
          s: 1.1 + ph * 1.8, ph, lx: l.x, lz: l.z,
        });
      }
    }
    if (l.type === "apec") {
      matte.push(paint(bake(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), l.x, l.z, 0, 0, 0.5 + h + 1.6, 0), 0x222222));
      flags.push({ x: l.x + 0.78, y: LAND + 0.5 + h + 2.35, z: l.z, wx: l.x });
    }
    picks.push({ locId: l.id, x: l.x, y: LAND + 0.5 + h / 2, z: l.z, w: l.w * 0.82, h, d: l.w * 0.82 });
    facades.push({ id: `loc:${l.id}`, x: l.x, z: l.z, w: l.w * 0.82, h, d: l.w * 0.82, rot: 0, chunkKey: key, color: l.color });
  }

  /* ---- decor landmarks: build from the lazy descriptors, merge per chunk ---- */
  const decorRoots: THREE.Object3D[] = [];
  for (const d of data.decor) {
    const g = new THREE.Group();
    const k = new Kit();
    const spinArr: THREE.Object3D[] = [];
    d.build(k, g, spinArr);
    k.into(g);
    g.position.set(d.x, LAND, d.z);
    if (d.ry) g.rotation.y = d.ry;
    decorRoots.push(g);
    spinObjs.push(...spinArr);
  }
  for (const s of spinObjs) {
    const kept = collectKept(s);
    spin.push({ matrix: kept.matrix, parts: kept.parts.map((p) => ({ mat: p.matKey, arrays: geometryToArrays(p.geometry) })) });
  }
  const keepSet = new Set<THREE.Object3D>(spinObjs);
  if (landmarkRoots.length > 0) {
    for (const { matKey, geometry } of mergeStaticGeometries(landmarkRoots, keepSet)) {
      meshes.push({ mat: matKey, arrays: geometryToArrays(geometry) });
    }
  }
  if (decorRoots.length > 0) {
    for (const { matKey, geometry } of mergeStaticGeometries(decorRoots, keepSet)) {
      meshes.push({ mat: matKey, arrays: geometryToArrays(geometry) });
    }
  }

  /* ---- filler towers (instance data; the InstancedMesh is built on the main thread) ---- */
  let filler: ChunkPayload["filler"] = null;
  if (data.filler.length > 0) {
    const matrices = new Float32Array(data.filler.length * 16);
    const colors = new Float32Array(data.filler.length * 3);
    const m4 = new THREE.Matrix4();
    const c = new THREE.Color();
    data.filler.forEach((s, i) => {
      m4.makeScale(s.w ?? 1, s.h, s.w ?? 1).setPosition(s.x, LAND + s.h / 2, s.z);
      matrices.set(m4.toArray(), i * 16);
      c.setHex(s.c);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    });
    filler = { matrices, colors, count: data.filler.length };
  }

  /* ---- shop rows ---- */
  for (const s of data.shops) {
    windows.push(paint(bake(new THREE.BoxGeometry(s.gw, s.gh, 1.6), s.x, s.z, s.rot, 0, s.gh / 2, 0), SHOP_PALETTE[s.pal] ?? 0xe8dcc4));
    matte.push(paint(bake(new THREE.BoxGeometry(s.gw * 0.82, 0.07, 0.6), s.x, s.z, s.rot, 0, 1.32, 1.06, 0.35, 0, 0), shade(SHOP_PALETTE[s.awnPal] ?? 0xe8dcc4, 0.7)));
    const sy = Math.min(s.gh - 0.35, 1.95);
    signs.push({
      x: s.x + Math.sin(s.rot) * 0.84, y: LAND + sy, z: s.z + Math.cos(s.rot) * 0.84,
      ry: s.rot, sx: Math.min(1.9, s.gw * 0.7), sy: 0.42, sz: 0.08, color: SIGN_COLORS[s.sign] ?? 0xe63a1f,
    });
    facades.push({ id: `shop:${s.x.toFixed(1)},${s.z.toFixed(1)}`, x: s.x, z: s.z, w: s.gw, h: s.gh, d: 1.6, rot: s.rot, chunkKey: key, color: SHOP_PALETTE[s.pal] ?? 0xe8dcc4 });
    shopPts.push({ x: s.x, z: s.z, dx: s.door.dx, dz: s.door.dz, ck: key });
  }

  /* ---- player shops / flats (round-9 buildings, at the loc's offset) ---- */
  for (const b of data.playerBuildings) {
    const loc = pctx.locById.get(b.locId) ?? resolveLoc(cityKey, b.locId);
    if (!loc) continue;
    const x = loc.x + 1.8;
    const z = loc.z + 1.3;
    const isShop = b.kind === "shop";
    const bw = isShop ? 2.6 : 2.1;
    const bh = isShop ? 2.4 : 2.1;
    matte.push(paint(bake(new THREE.BoxGeometry(bw, bh, 2.0), x, z, 0, 0, bh / 2, 0), isShop ? 0xd9a86a : 0xb8a8d8));
    matte.push(paint(bake(new THREE.BoxGeometry(bw, 0.3, 2.1), x, z, 0, 0, bh + 0.15, 0), isShop ? 0xa06a2e : 0x6a4a9a));
    if (isShop) {
      matte.push(paint(bake(new THREE.BoxGeometry(bw * 0.85, 0.07, 0.55), x, z, 0, 0, 1.28, 1.2, 0.32, 0, 0), 0xe8dcc4));
      signs.push({ x, y: LAND + 1.85, z: z + 1.06, ry: 0, sx: Math.min(2.0, bw * 0.7), sy: 0.45, sz: 0.08, color: 0xe63a1f });
    }
    playerPicks.push({ id: b.id, x, y: LAND + (bh + 0.6) / 2, z, w: bw, h: bh + 0.6, d: 2.0 });
  }

  /* ---- ferris wheel (SZ) / 泗洲塔 pagoda anchor (HZ, and — pre-existing
      quirk from MapView — the same anchor on HK too) ----
      The wheel is the landmarks factory's own ferrisWheel (as MapView
      built it: R 2.6 at LAND+3.4, two strut legs) — it spins, so it rides
      the `spin` payload like the 湾区之光 wheel, not the static merge.
      The legs are static and bake into the matte bucket. The pagoda is
      cheap primitives, so it stays metadata for the main thread. */
  let special: ChunkPayload["special"] = null;
  if (data.special === "wheel") {
    const hv = pctx.locById.get("happyvalley");
    if (hv) {
      const wheel = pctx.landmarks.wheel(2.6, 0xf472b6, 0xfacc15);
      wheel.position.set(hv.x - 1.2, LAND + 3.4, hv.z - 2.2);
      const kept = collectKept(wheel);
      spin.push({ matrix: kept.matrix, parts: kept.parts.map((p) => ({ mat: p.matKey, arrays: geometryToArrays(p.geometry) })) });
      wheel.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
      for (const s of [-1, 1]) {
        matte.push(paint(bake(new THREE.BoxGeometry(0.12, 3.6, 0.12), hv.x - 1.2, hv.z - 2.2, 0, s * 0.5, 1.7, 0, 0, 0, s * 0.15), 0xc9d3da));
      }
    }
  } else if (data.special === "pagoda") {
    const xh = getLocations("hz").find((l) => l.id === "xihu");
    if (xh) {
      special = { kind: "pagoda", x: xh.x + 2.2, z: xh.z + 1.6 };
      picks.push({ locId: "xihu", x: xh.x + 2.2, y: LAND + 2.25, z: xh.z + 1.6, w: 2.2, h: 4.5, d: 2.2 });
    }
  }

  /* ---- flush the three merged buckets + the instanced signs ---- */
  flushBucket(matte, "matte");
  flushBucket(windows, "windows");
  flushBucket(glassy, "glassy");
  let signsPayload: ChunkPayload["signs"] = null;
  if (signs.length > 0) {
    const matrices = new Float32Array(signs.length * 16);
    const colors = new Float32Array(signs.length * 3);
    const m4 = new THREE.Matrix4();
    signs.forEach((s, i) => {
      m4.makeRotationY(s.ry).scale(new THREE.Vector3(s.sx, s.sy, s.sz)).setPosition(s.x, s.y, s.z);
      matrices.set(m4.toArray(), i * 16);
      const c = new THREE.Color(s.color);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    });
    signsPayload = { matrices, colors, count: signs.length };
  }

  return {
    key, meshes, filler, signs: signsPayload, picks, playerPicks, smokes, avs, flags,
    spin, pingan, special, facades, shopPts, labelTops,
  };
}

/** The SIMPLIFIED tier — one merged mesh of box silhouettes (one box per
    location / shop / player building / filler tower, each in its own
    colour): the "reachable room simplified" tier of lee's cell-and-portal
    design. Built synchronously on the main thread — a dozen boxes merged
    is a fraction of a millisecond, far cheaper than a worker round-trip,
    and it is the tier that fills the fog's outer band (32–64 m) so there
    is never a hole at the edge of the full-detail window. No pick boxes,
    no smoke, no signs, no landmark detail, no decor (a decor tower has no
    box in its descriptor — it simply waits for the chunk to go full, which
    happens inside the fog). The mesh uses the shared matte material, so
    there is nothing to dispose but its geometry. */
export function buildSilhouetteGroup(data: ChunkData, matte: THREE.Material, locById: Map<string, Loc>): THREE.Group {
  const group = new THREE.Group();
  group.name = `chunk-${data.key}-simple`;
  const geos: THREE.BufferGeometry[] = [];
  const box = (x: number, z: number, w: number, h: number, d: number, color: number, ry = 0) => {
    geos.push(paint(bake(new THREE.BoxGeometry(w, h, d), x, z, ry, 0, h / 2, 0), color));
  };
  for (const l of data.locations) box(l.x, l.z, l.w * 0.82, l.h * 1.7, l.w * 0.82, l.color);
  for (const s of data.shops) box(s.x, s.z, s.gw, s.gh, 1.6, SHOP_PALETTE[s.pal] ?? 0xe8dcc4, s.rot);
  for (const b of data.playerBuildings) {
    const loc = locById.get(b.locId);
    if (!loc) continue;
    const isShop = b.kind === "shop";
    box(loc.x + 1.8, loc.z + 1.3, isShop ? 2.6 : 2.1, isShop ? 2.4 : 2.1, 2.0, isShop ? 0xd9a86a : 0xb8a8d8);
  }
  for (const s of data.filler) box(s.x, s.z, 1.9 * (s.w ?? 1) * 0.72, s.h, 1.9 * (s.w ?? 1) * 0.72, s.c);
  if (geos.length > 0) {
    const merged = mergeGeometries(geos, false)!;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, matte);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

/** Turn a chunk payload into THREE objects (main thread only). Fast: it
    only wraps the payload's arrays in BufferGeometry and creates the
    small per-chunk objects (pick boxes, smoke sprites, flags, the wheel /
    pagoda, spin groups). The merged meshes are already in world space. */
export function materializeChunk(payload: ChunkPayload, mctx: ChunkMaterializeCtx): ChunkBuildResult {
  const group = new THREE.Group();
  group.name = `chunk-${payload.key}`;
  const ownedMats = new Set<THREE.Material>();
  const ownedTexs = new Set<THREE.Texture>();
  const picks: THREE.Object3D[] = [];
  const playerPicks: THREE.Object3D[] = [];
  const smokes: SmokeSprite[] = [];
  const avs: THREE.Mesh[] = [];
  const wheels: THREE.Object3D[] = [];
  const flags: THREE.Mesh[] = [];
  const facades: FacadeTarget[] = payload.facades;
  const shopPts: ShopPt[] = payload.shopPts;
  const labelTops: [string, number][] = payload.labelTops;
  let pinganRoot: THREE.Group | null = null;

  for (const pm of payload.meshes) {
    const geo = geometryFromArrays(pm.arrays);
    const mat = pm.mat === "matte" ? mctx.mats.matte : pm.mat === "windows" ? mctx.mats.windows : pm.mat === "glassy" ? mctx.mats.glassy : mctx.landmarks.materialForKey(pm.mat);
    const mesh = new THREE.Mesh(geo, mat);
    const wire = (mat as THREE.MeshStandardMaterial).wireframe;
    mesh.castShadow = !wire;
    mesh.receiveShadow = !wire;
    group.add(mesh);
  }
  if (payload.filler) {
    const filler = new THREE.InstancedMesh(FILLER_GEO, mctx.fillerMat, payload.filler.count);
    (filler.instanceMatrix.array as Float32Array).set(payload.filler.matrices);
    filler.instanceColor = new THREE.InstancedBufferAttribute(payload.filler.colors, 3);
    filler.instanceMatrix.needsUpdate = true;
    filler.instanceColor.needsUpdate = true;
    filler.castShadow = true;
    filler.receiveShadow = true;
    group.add(filler);
  }
  if (payload.signs) {
    const inst = new THREE.InstancedMesh(SIGN_GEO, mctx.mats.sign, payload.signs.count);
    (inst.instanceMatrix.array as Float32Array).set(payload.signs.matrices);
    inst.instanceColor = new THREE.InstancedBufferAttribute(payload.signs.colors, 3);
    inst.instanceMatrix.needsUpdate = true;
    inst.instanceColor.needsUpdate = true;
    group.add(inst);
  }
  for (const p of payload.picks) {
    const pick = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), mctx.pickMat);
    pick.position.set(p.x, p.y, p.z);
    pick.userData.locId = p.locId;
    group.add(pick);
    picks.push(pick);
  }
  for (const p of payload.playerPicks) {
    const pp = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), mctx.pickMat);
    pp.position.set(p.x, p.y, p.z);
    pp.userData.playerBuildingId = p.id;
    group.add(pp);
    playerPicks.push(pp);
  }
  const smokeByLoc = new Map<string, SmokeMeta[]>();
  for (const s of payload.smokes) {
    const arr = smokeByLoc.get(s.locId) ?? [];
    arr.push(s);
    smokeByLoc.set(s.locId, arr);
  }
  for (const list of smokeByLoc.values()) {
    const smokeTex = mctx.glowTexture();
    ownedTexs.add(smokeTex);
    // ROUND-10g (home-designer texCpuRelease): arm the CPU-release hook.
    // A canvas glow texture is not a candidate (never touch canvas /
    // image textures), so this is a no-op today — it fires the moment a
    // chunk-owned texture is compressed or ImageBitmap-backed.
    releaseCpuAfterUpload(smokeTex);
    for (const s of list) {
      const sm = new THREE.SpriteMaterial({ map: smokeTex, color: 0xe8e2d6, transparent: true, opacity: 0.16, depthWrite: false });
      ownedMats.add(sm);
      const sp = new THREE.Sprite(sm);
      sp.position.set(s.x, s.y, s.z);
      sp.scale.set(s.s, s.s, 1);
      group.add(sp);
      smokes.push({ sp, phase: s.ph, x: s.lx, z: s.lz });
    }
  }
  for (const a of payload.avs) {
    const avMat = new THREE.MeshStandardMaterial({ color: 0x330b0b, emissive: 0xff2a1e, emissiveIntensity: 0.2 });
    ownedMats.add(avMat);
    const av = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), avMat);
    av.position.set(a.x, a.y, a.z);
    group.add(av);
    avs.push(av);
  }
  for (const f of payload.flags) {
    const flagMat = new THREE.MeshStandardMaterial({ color: 0xe63a1f, side: THREE.DoubleSide, emissive: 0xe63a1f, emissiveIntensity: 0.25 });
    ownedMats.add(flagMat);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), flagMat);
    flag.position.set(f.x, f.y, f.z);
    flag.userData.wx = f.wx;
    group.add(flag);
    flags.push(flag);
  }
  const placeKept = (kept: KeptPayload): THREE.Group => {
    const g = new THREE.Group();
    const m = new THREE.Matrix4().fromArray(kept.matrix);
    g.position.setFromMatrixPosition(m);
    g.quaternion.setFromRotationMatrix(m);
    g.scale.setFromMatrixScale(m);
    for (const part of kept.parts) {
      const mesh = new THREE.Mesh(geometryFromArrays(part.arrays), mctx.landmarks.materialForKey(part.mat));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    return g;
  };
  for (const s of payload.spin) {
    const g = placeKept(s);
    group.add(g);
    wheels.push(g);
  }
  if (payload.pingan) {
    const g = placeKept(payload.pingan);
    group.add(g);
    pinganRoot = g;
    // the bank pick box belongs inside the root (applyPinganGlb keeps
    // locId children when it swaps the miniature for the .glb)
    const bankPick = picks.find((p) => (p as THREE.Mesh).userData.locId === "bank");
    if (bankPick) {
      group.remove(bankPick);
      bankPick.position.sub(g.position);
      g.add(bankPick);
    }
    if (mctx.pinganModel.current) applyPinganGlb(g, mctx.pinganModel.current, mctx.labelTop);
  }
  if (payload.special?.kind === "pagoda") {
    // 泗洲塔 beside 西湖 — ported verbatim from MapView: five cylinder
    // tiers with cone eaves and a gold tip (not the box pagoda the first
    // 10g draft invented)
    const { x, z } = payload.special;
    const pagoda = new THREE.Group();
    pagoda.position.set(x, LAND, z);
    const tierMat = new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.9 });
    ownedMats.add(tierMat);
    const eaveMat = new THREE.MeshStandardMaterial({ color: 0x8a4b2d, roughness: 0.9, flatShading: true });
    ownedMats.add(eaveMat);
    for (let i = 0; i < 5; i++) {
      const tier = new THREE.Mesh(new THREE.CylinderGeometry(1.45 - i * 0.2, 1.65 - i * 0.2, 1.15, 6), tierMat);
      tier.position.y = 0.6 + i * 1.15;
      tier.castShadow = true;
      pagoda.add(tier);
      const eave = new THREE.Mesh(new THREE.ConeGeometry(1.95 - i * 0.24, 0.5, 6), eaveMat);
      eave.position.y = 1.2 + i * 1.15;
      eave.castShadow = true;
      pagoda.add(eave);
    }
    const tipMat = new THREE.MeshStandardMaterial({ color: 0xf5b942, roughness: 0.4, metalness: 0.6 });
    ownedMats.add(tipMat);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.4, 6), tipMat);
    tip.position.y = 7.1;
    pagoda.add(tip);
    group.add(pagoda);
  }
  for (const [id, top] of payload.labelTops) mctx.labelTop.set(id, top);
  return { group, picks, playerPicks, smokes, avs, wheels, flags, facades, shopPts, labelTops, ownedMats, ownedTexs, pinganRoot };
}

/** Build ONE chunk's THREE objects from its pure data (synchronous path:
    payload on this thread, then materialize). The worker path calls
    buildChunkPayload in the worker and materializeChunk here instead. */
export function buildChunkMesh(data: ChunkData, ctx: ChunkBuildCtx): ChunkBuildResult {
  const payload = buildChunkPayload(data, { cityKey: ctx.cityKey, landmarks: ctx.landmarks, locById: ctx.locById });
  return materializeChunk(payload, {
    cityKey: ctx.cityKey, landmarks: ctx.landmarks, mats: ctx.mats, fillerMat: ctx.fillerMat,
    pickMat: ctx.pickMat, labelTop: ctx.labelTop, glowTexture: ctx.glowTexture, pinganModel: ctx.pinganModel,
  });
}
/* ---- disposal ---- */

/** Remove `gone` items from `arr` in place (the MapView bookkeeping
    arrays are `const` in the effect — their contents mutate). */
export function removeAll<T>(arr: T[], gone: ReadonlySet<T>): void {
  if (gone.size === 0) return;
  for (let i = arr.length - 1; i >= 0; i--) if (gone.has(arr[i]!)) arr.splice(i, 1);
}

/** Free a chunk's GPU memory. Traverse the group and dispose EVERY
    geometry — including shared ones (a disposed shared geometry just
    re-uploads on next render; what matters is the buffers are freed).
    Sprites share one geometry and hold nothing per-sprite, so skip them.
    InstancedMeshes dispose their instance buffers. Materials: dispose
    ONLY the chunk-owned set (per-building smoke / flag / pagoda / wheel
    materials); NEVER shared materials (landmark cache, filler, the merged
    buckets, pickMat, winTex, dfx textures) — disposing one of those would
    black out the whole city. */
export function disposeChunk(rec: ChunkRecord): void {
  const g = rec.group;
  if (g) {
    g.traverse((o) => {
      if ((o as THREE.Sprite).isSprite) return;
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
      const m = o as THREE.Mesh;
      if (m.geometry && !SHARED_GEOS.has(m.geometry)) m.geometry.dispose();
    });
    g.removeFromParent();
  }
  // the simplified tier is one merged mesh on the shared matte material:
  // only its geometry is chunk-owned
  const sg = rec.simpleGroup;
  if (sg) {
    sg.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) m.geometry.dispose();
    });
    sg.removeFromParent();
  }
  for (const mt of rec.ownedMats) mt.dispose();
  for (const tx of rec.ownedTexs) tx.dispose();
  rec.group = null;
  rec.simpleGroup = null;
}

/* ---- memory ledger (threeforge's ResourceTracker idea, at our scale) ---- */

/** Tiered geometry/texture budgets, in MB — threeforge's tiers
    (desktop / mid phone / low phone). Our whole city is ~13 MB of chunk
    geometry, far under even the low tier; the ledger is a dev diagnostic
    (window.__chunks), not a limiter. */
export const CHUNK_MEMORY_BUDGETS = {
  geometry: { desktop: 256, mid: 96, low: 48 },
  texture: { desktop: 512, mid: 192, low: 96 },
} as const;

/** GPU-side geometry bytes held by a group (attributes + instance buffers).
    Sprites share one geometry — nothing per-sprite. Shared geometries
    (filler / sign unit boxes) are skipped: they are counted once, not once
    per chunk that references them. (The Ping An .glb clone shares its
    geometries with the loader cache, so its ~35 KB is counted here but not
    freed on unload — a small, known overcount.) */
export function groupGeometryBytes(group: THREE.Group): number {
  let n = 0;
  group.traverse((o) => {
    if ((o as THREE.Sprite).isSprite) return;
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry || SHARED_GEOS.has(m.geometry)) return;
    const g = m.geometry;
    for (const name of Object.keys(g.attributes)) n += g.attributes[name]!.array.byteLength;
    if (g.index) n += g.index.array.byteLength;
    const im = m as THREE.InstancedMesh;
    if (im.isInstancedMesh) {
      n += im.instanceMatrix.array.byteLength;
      if (im.instanceColor) n += im.instanceColor.array.byteLength;
    }
  });
  return n;
}

/** Every chunk's geometry bytes, accounted when it is built and released
    when it is disposed. `unreferenced` is memory still tracked for a chunk
    the manager no longer holds — a leak if it is ever non-zero. The
    registry-owned shared materials (landmark cache, filler, the merged
    buckets, pickMat, winTex) are never disposed — the threeforge rule that
    shared, registry-owned resources are immortal. */
export class ChunkLedger {
  private bytes = new Map<string, number>();
  track(key: string, n: number): void { this.bytes.set(key, n); }
  release(key: string): void { this.bytes.delete(key); }
  clear(): void { this.bytes.clear(); }
  stats(heldKeys: ReadonlySet<string>): { chunks: number; geometryMB: number; unreferencedMB: number } {
    let total = 0;
    let unref = 0;
    for (const [k, n] of this.bytes) {
      total += n;
      if (!heldKeys.has(k)) unref += n;
    }
    return { chunks: this.bytes.size, geometryMB: total / 1048576, unreferencedMB: unref / 1048576 };
  }
}

/* ---- ChunkManager ---- */

export type ChunkState = "queued" | "generating" | "ready";
/** Detail tier (lee's three-tier cell model): "full" is the chunk as built
    (merged meshes, signs, filler, picks, smoke, spin); "simple" is one
    merged box silhouette. A record holds at most one of `group` /
    `simpleGroup` at a time — except during an upgrade, when the silhouette
    stays up as a placeholder until the full build lands, so the chunk
    never shows a hole. */
export type ChunkDetail = "full" | "simple";
export interface ChunkRecord extends ChunkBuildResult {
  key: string;
  cx: number;
  cz: number;
  state: ChunkState;
  detail: ChunkDetail;
  buildId: number;
  simpleGroup: THREE.Group | null;
}

/** Imperative chunk streaming, outside React: no component per chunk, no
    setState in useFrame. The MapView effect owns one per city and hands it
    a build callback (generateChunkData + buildChunkMesh + scene.add) and an
    unload callback (un-register the record's bookkeeping from the effect
    arrays). Chunk records are deleted on unload — a chunk that is not in
    the Map is simply unloaded.
    - syncStreet(px, pz): load 5x5 around the player, keep 7x7.
    - loadAll(px, pz): map mode — every content chunk loads, within the
      per-frame time budget (a 13-chunk city is whole in ~0.2 s).
    - processQueue(): work the queue inside the per-frame time budget
      (frameBudgetMs, default 8 ms — HighRoads' CHUNK.frameBudgetMs idea:
      milliseconds, not a fixed chunk count); call once per frame from
      MapView's render loop. Worker results that already landed
      materialize first, then new builds are posted. */
export class ChunkManager {
  records = new Map<string, ChunkRecord>();
  queue: string[] = [];
  contentKeys: string[] = [];
  /** Per-frame time budget for chunk work (HighRoads' CHUNK.frameBudgetMs:
      slice by milliseconds, not by a fixed chunk count). Default 8 ms — a
      dense chunk materializes in ~2.4 ms, so a frame can usually take two
      or three; a single dense SYNC build (~20 ms) can still exceed the
      budget on its own, which is why the worker path exists. */
  frameBudgetMs = 8;
  /** Cap on builds in flight to the worker (its queue is serial; posting
      far ahead just builds stale chunks the player may have left). */
  maxInFlight = 4;
  /** Memory ledger (threeforge's ResourceTracker idea): geometry bytes per
      chunk, released on unload. `unreferenced` > 0 in stats() is a leak. */
  readonly ledger = new ChunkLedger();
  /** Worker results that landed but have not been materialized yet —
      materializing happens in processQueue(), inside the frame budget. */
  private pendingResults: { key: string; buildId: number; payload: ChunkPayload }[] = [];
  private nextBuildId = 1;
  private lastMode: "map" | "street" = "map";
  private lastPx = 0;
  private lastPz = 0;
  private lastWanted = new Set<string>();
  constructor(
    private build: (key: string) => ChunkBuildResult,
    private onUnload: (rec: ChunkRecord) => void,
    /** Worker path (Step 2): post a build to the worker instead of building
        inline. When set, processQueue() sends one build per call and the
        result arrives via onWorkerBuilt(). `materialize` turns the worker's
        payload into THREE objects on the main thread. `onCancel` tells the
        worker to drop an in-flight build. When absent, everything builds
        synchronously (Step 1 only). */
    private worker?: {
      post: (key: string, buildId: number) => void;
      cancel: (key: string, buildId: number) => void;
      materialize: (payload: ChunkPayload) => ChunkBuildResult;
    },
    /** Simplified tier: build the chunk's box silhouette (sync, main
        thread) and add it to the scene, returning the group (null = no
        silhouette — the manager falls back to unloading the chunk). When
        absent, the manager is binary (full or unloaded) and the simple
        tier is skipped. */
    private buildSimple?: (key: string) => THREE.Group | null,
  ) {
    // Hard invariant (external review #1.3): the street fog far end must
    // stay inside the full-detail ring, or chunk pop-in shows past the fog.
    console.assert(STREET_FOG_FAR <= (FULL_R + 1) * CHUNK, "[chunks] street fog far exceeds full-detail ring — raise FULL_R in chunks.ts");
  }

  private newRecord(key: string): ChunkRecord {
    const [cx, cz] = key.split(",").map(Number);
    return {
      key, cx: cx ?? 0, cz: cz ?? 0, state: "queued", detail: "full", buildId: this.nextBuildId++,
      group: null, simpleGroup: null, picks: [], playerPicks: [], smokes: [], avs: [], wheels: [], flags: [],
      facades: [], shopPts: [], labelTops: [], ownedMats: new Set(), ownedTexs: new Set(), pinganRoot: null,
    };
  }
  private dist2(key: string, px: number, pz: number): number {
    const rec = this.records.get(key);
    if (!rec) return Infinity;
    const dx = (rec.cx + 0.5) * CHUNK - px;
    const dz = (rec.cz + 0.5) * CHUNK - pz;
    return dx * dx + dz * dz;
  }
  /** Chebyshev chunk distance from the player's chunk — the tier metric. */
  private cheb(key: string, pcx: number, pcz: number): number {
    const [cx, cz] = key.split(",").map(Number);
    return Math.max(Math.abs((cx ?? 0) - pcx), Math.abs((cz ?? 0) - pcz));
  }
  /** Street mode, three tiers with hysteresis (lee's cell-and-portal):
      - full: enter at FULL_R, stay until FULL_KEEP_R
      - simple (silhouette): enter at SIMPLE_R, stay until SIMPLE_KEEP_R
      - beyond: culled (unloaded + disposed)
      A chunk that downgrades full -> simple keeps no hole: the silhouette
      stands up in the same tick. A chunk that upgrades simple -> full
      keeps its silhouette as a placeholder until the full build lands. */
  syncStreet(px: number, pz: number): void {
    const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
    const d = (key: string) => this.cheb(key, pcx, pcz);
    this.lastMode = "street";
    this.lastPx = px;
    this.lastPz = pz;
    for (const rec of [...this.records.values()]) {
      const dist = d(rec.key);
      if (rec.state === "ready" && rec.detail === "full") {
        if (dist > FULL_KEEP_R) {
          if (dist <= SIMPLE_KEEP_R) this.downgradeRecord(rec);
          else this.unloadRecord(rec);
        }
      } else if (rec.state === "ready" && rec.detail === "simple") {
        if (dist <= FULL_R) this.upgradeRecord(rec);
        else if (dist > SIMPLE_KEEP_R) this.unloadRecord(rec);
      }
      // queued / generating records ride out their build; the result is
      // checked against the record when it lands (stale = dropped)
    }
    for (const key of this.contentKeys) {
      if (this.records.has(key)) continue;
      const dist = d(key);
      if (dist <= FULL_R) {
        this.records.set(key, this.newRecord(key));
        this.queue.push(key);
      } else if (dist <= SIMPLE_R) {
        this.buildSimpleRecord(key);
      }
    }
    this.lastWanted = new Set(this.contentKeys.filter((k) => d(k) <= SIMPLE_KEEP_R));
    this.queue.sort((a, b) => this.dist2(a, px, pz) - this.dist2(b, px, pz));
  }
  /** Map mode: every content chunk goes full. Simple chunks upgrade (their
      silhouette stays up until the full build lands); missing chunks queue.
      Fill-in runs inside the per-frame time budget, so a 13-chunk city is
      whole in ~0.2 s. */
  loadAll(px: number, pz: number): void {
    this.lastMode = "map";
    this.lastPx = px;
    this.lastPz = pz;
    for (const key of this.contentKeys) {
      const rec = this.records.get(key);
      if (!rec) {
        this.records.set(key, this.newRecord(key));
        this.queue.push(key);
      } else if (rec.state === "ready" && rec.detail === "simple") {
        this.upgradeRecord(rec);
      }
    }
    this.lastWanted = new Set(this.contentKeys);
    this.queue.sort((a, b) => this.dist2(a, px, pz) - this.dist2(b, px, pz));
  }
  /** Re-run the last sync (after contentKeys changed, e.g. a player shop
      opened in a chunk that previously had no content). */
  resync(): void {
    if (this.lastMode === "street") this.syncStreet(this.lastPx, this.lastPz);
    else this.loadAll(this.lastPx, this.lastPz);
  }
  /** Work the queue inside a per-frame time budget (HighRoads:
      milliseconds, not a fixed chunk count). Worker results that already
      landed materialize first (they are the closest thing to visible),
      then new builds are posted. Returns the number of chunk operations
      done this call. A single dense SYNC build can exceed the budget on
      its own — the loop just stops after it instead of starting another. */
  processQueue(budgetMs = this.frameBudgetMs): number {
    const t0 = performance.now();
    let done = 0;
    while (this.pendingResults.length > 0) {
      const next = this.pendingResults[0]!;
      if (this.materializePending(next)) done++;
      this.pendingResults.shift();
      if (performance.now() - t0 >= budgetMs) return done;
    }
    while (this.queue.length > 0) {
      if (performance.now() - t0 >= budgetMs) break;
      if (this.worker && this.inFlightCount() >= this.maxInFlight) break;
      const key = this.queue.shift()!;
      const rec = this.records.get(key);
      if (!rec || rec.state !== "queued") continue;
      if (this.worker) {
        rec.state = "generating";
        this.worker.post(rec.key, rec.buildId);
      } else {
        this.buildRecord(rec);
      }
      done++;
      if (!this.worker && performance.now() - t0 >= budgetMs) break;
    }
    return done;
  }
  private inFlightCount(): number {
    let n = 0;
    for (const rec of this.records.values()) if (rec.state === "generating") n++;
    return n;
  }
  /** A worker build landed — enqueue it, don't materialize here: the
      materialize runs in processQueue(), inside the frame budget, so a
      burst of arrivals can't hitch a frame. Stale results are dropped
      when they reach the front of the queue (record gone / buildId moved
      on). Returns false when the result is already stale. */
  onWorkerBuilt(key: string, buildId: number, payload: ChunkPayload): boolean {
    const rec = this.records.get(key);
    if (!rec || rec.state !== "generating" || rec.buildId !== buildId) return false;
    this.pendingResults.push({ key, buildId, payload });
    return true;
  }
  /** Materialize one pending worker result (called from processQueue).
      On an upgrade the placeholder silhouette goes away now that the full
      chunk is here. */
  private materializePending(next: { key: string; buildId: number; payload: ChunkPayload }): boolean {
    const rec = this.records.get(next.key);
    if (!rec || rec.state !== "generating" || rec.buildId !== next.buildId || !this.worker) return false;
    const result = this.worker.materialize(next.payload);
    if (rec.simpleGroup) {
      rec.simpleGroup.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry) m.geometry.dispose(); });
      rec.simpleGroup.removeFromParent();
      rec.simpleGroup = null;
    }
    Object.assign(rec, result);
    rec.detail = "full";
    rec.state = "ready";
    if (rec.group) this.ledger.track(next.key, groupGeometryBytes(rec.group));
    return true;
  }
  /** Build the player's chunk synchronously in phase A so the map is never
      empty on arrival (even with a worker — the first paint can't wait for
      a round-trip). Returns false when the key has no content. */
  buildNow(key: string): boolean {
    if (!this.contentKeys.includes(key)) return false;
    let rec = this.records.get(key);
    if (rec?.state === "ready" && rec.detail === "full") return true;
    if (rec?.state === "generating") return true; // a worker build is already in flight — leave it
    if (rec?.state === "ready" && rec.detail === "simple") {
      // upgrade synchronously: drop the placeholder silhouette, build full now
      if (rec.simpleGroup) disposeChunk(rec);
      rec.detail = "full";
    }
    if (!rec) { rec = this.newRecord(key); this.records.set(key, rec); }
    this.buildRecord(rec);
    return true;
  }
  /** Unload the given keys (player buildings changed in those chunks) and
      re-sync, which rebuilds them at their current tier. */
  refreshKeys(keys: string[]): void {
    for (const key of keys) {
      const rec = this.records.get(key);
      if (rec) this.unloadRecord(rec);
    }
    this.resync();
  }
  setContent(keys: string[]): void { this.contentKeys = keys; }
  getRecord(key: string): ChunkRecord | undefined { return this.records.get(key); }
  stats(): { loaded: number; simple: number; queued: number; inFlight: number; pending: number; total: number } {
    let loaded = 0;
    let simple = 0;
    let inFlight = 0;
    for (const rec of this.records.values()) {
      if (rec.state === "ready" && rec.detail === "full") loaded++;
      else if (rec.state === "ready" && rec.detail === "simple") simple++;
      else if (rec.state === "generating") inFlight++;
    }
    return { loaded, simple, queued: this.queue.length, inFlight, pending: this.pendingResults.length, total: this.contentKeys.length };
  }
  /** Memory ledger snapshot: chunk geometry held, and `unreferenced` (memory
      tracked for a chunk the manager no longer holds — a leak if > 0). */
  ledgerStats(): { chunks: number; geometryMB: number; unreferencedMB: number; budgetMB: number } {
    const s = this.ledger.stats(new Set(this.records.keys()));
    return { ...s, budgetMB: CHUNK_MEMORY_BUDGETS.geometry.desktop };
  }
  /** Drop bookkeeping only — GPU disposal of loaded chunks happens through
      the effect cleanup's scene traverse on city change. */
  dispose(): void {
    this.queue = [];
    this.pendingResults = [];
    this.records.clear();
    this.ledger.clear();
  }
  private buildRecord(rec: ChunkRecord): void {
    const qi = this.queue.indexOf(rec.key);
    if (qi >= 0) this.queue.splice(qi, 1);
    rec.state = "generating";
    const result = this.build(rec.key);
    Object.assign(rec, result);
    rec.detail = "full";
    rec.state = "ready";
    if (rec.group) this.ledger.track(rec.key, groupGeometryBytes(rec.group));
  }
  /** Stand up the simplified tier for a chunk that has no record yet. */
  private buildSimpleRecord(key: string): void {
    if (!this.buildSimple) return;
    const g = this.buildSimple(key);
    if (!g) return;
    const rec = this.newRecord(key);
    rec.state = "ready";
    rec.detail = "simple";
    rec.simpleGroup = g;
    this.records.set(key, rec);
    this.ledger.track(key, groupGeometryBytes(g));
  }
  /** full -> simple: dispose the full-detail group (and its bookkeeping),
      then stand up the cheap silhouette in its place. No hole: the
      silhouette is built in the same tick. */
  private downgradeRecord(rec: ChunkRecord): void {
    if (rec.group) {
      disposeChunk(rec);
      this.onUnload(rec);
    }
    this.ledger.release(rec.key);
    rec.picks = []; rec.playerPicks = []; rec.smokes = []; rec.avs = []; rec.wheels = []; rec.flags = [];
    rec.facades = []; rec.shopPts = []; rec.labelTops = []; rec.ownedMats = new Set(); rec.ownedTexs = new Set(); rec.pinganRoot = null;
    rec.detail = "simple";
    rec.state = "ready";
    if (this.buildSimple) {
      const g = this.buildSimple(rec.key);
      if (g) {
        rec.simpleGroup = g;
        this.ledger.track(rec.key, groupGeometryBytes(g));
        return;
      }
    }
    // no silhouette available — fall back to unloading the chunk entirely
    this.records.delete(rec.key);
  }
  /** simple -> full: queue a full build, keeping the silhouette up as a
      placeholder until it lands (onWorkerBuilt / buildRecord swaps it). */
  private upgradeRecord(rec: ChunkRecord): void {
    rec.state = "queued";
    rec.buildId = this.nextBuildId++;
    this.queue.push(rec.key);
    this.queue.sort((a, b) => this.dist2(a, this.lastPx, this.lastPz) - this.dist2(b, this.lastPx, this.lastPz));
  }
  private unloadRecord(rec: ChunkRecord): void {
    if (rec.state === "queued") {
      const qi = this.queue.indexOf(rec.key);
      if (qi >= 0) this.queue.splice(qi, 1);
      this.records.delete(rec.key);
      return;
    }
    if (rec.state === "generating") {
      if (this.worker) this.worker.cancel(rec.key, rec.buildId);
      // an upgrade placeholder silhouette still needs disposing; a fresh
      // build has neither group (disposeChunk is a no-op for it)
      disposeChunk(rec);
      this.ledger.release(rec.key);
      this.records.delete(rec.key);
      return;
    }
    // ready: dispose whatever it holds; un-register full bookkeeping only
    // if it actually had a full group (a simple chunk has none)
    const hadFull = rec.group !== null;
    disposeChunk(rec);
    this.ledger.release(rec.key);
    if (hadFull) this.onUnload(rec);
    this.records.delete(rec.key);
    console.debug(`[chunks] unload ${rec.key}`);
  }
}