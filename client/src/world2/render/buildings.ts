// Bay Area Life 2.0 — renderer: buildings (real meters).
//
// The SliceCity contract lives in `../cityData` (data agent owns it; the
// snapshot is `../data/slice-city.json`, bbox B, OSM base 2026-11-13T05:58:28Z).
// Coordinate convention: x east, z south, y up, meters, origin = bbox center.
//
// What this file does:
//   * `buildBuildings(city, materials, opts?)` — every building as an
//     extruded footprint prism at its real height, built from per-edge wall
//     quads (not ExtrudeGeometry) so each wall face gets whole-tile facade
//     UVs, exactly like the 10h `tileBoxUVs` rule (one tile per 2.6 m,
//     repeats rounded to whole tiles, windows never cut mid-pane).
//   * Facades reuse the 10h technique: a procedural canvas texture (daylight
//     windows) + a matching emissive canvas (same window layout on black),
//     one pair per kind, shared across all buildings. No per-building
//     materials: 5 facade materials (office / residential / commercial /
//     civic / glassy) + 3 trim materials (matte / sign / dark).
//   * Towers > 60 m get one setback at ~60% height + parapet + roof
//     AC / water-tank boxes. Residential fronts get balconies on +z-facing
//     edges; commercial ground floors get a glass shopfront + sign band.
//   * Enterable buildings get a REAL door opening: the front wall is split
//     around a 2.2 x 3.0 m portal, with a recessed dark interior (back +
//     sides + top quads, 0.4 m deep) and a sign-board mesh above — geometry,
//     not a flat texture.
//   * Chunking: a building whose footprint crosses chunk borders is CLIPPED
//     to the chunk rect (Sutherland-Hodgman, pure data) by `buildBuildings`
//     when `opts.clipRect` is set, so neighbouring chunks continue the same
//     wall with no gap and no duplicate (no z-fighting). Door / balcony /
//     roof props are built only in the chunk holding their anchor point.
//   * Ownership (10g rule): all geometries in the returned group are
//     chunk-owned and freed by `disposeBuildings`; the shared materials and
//     textures are NEVER disposed here.
//
// Pure-data helpers (no THREE) are exported for the Node smoke test:
// `enuFromLatLon`, `clipPolygonToRect`, `clipBuildingToRect`,
// `footprintBBox`, `footprintArea`, `doorPositionFor`, `setbackFor`.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { SliceBuilding, SliceCity } from "../cityData";

/** Re-exported so roads.ts / streaming.ts can import the contract from here. */
export type { SliceBuilding, SliceCity, SliceRoad } from "../cityData";

/** One facade tile per 2.6 m of frontage and height (10h `FACADE_TILE`). */
export const FACADE_TILE = 2.6;
/** Setback threshold: towers taller than this get one setback (10h rule). */
export const SETBACK_HEIGHT_M = 60;
/** Ground-floor height for shopfront / enterable treatment. */
export const GROUND_FLOOR_H = 3.2;
/** Door opening (enterable buildings): 2.2 m wide x 3.0 m high, 0.4 m deep. */
export const DOOR_W = 2.2;
export const DOOR_H = 3.0;
export const DOOR_DEPTH = 0.4;

/* ---- pure helpers ---- */

/** Deterministic string hash (same shape as the 10g `hash`). */
export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Seeded PRNG (mulberry32) — deterministic per building, like MapView's `mulberry`. */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Lat/lon -> ENU meters: use `latLonToEnu` from ../cityData (canonical,
   M_PER_DEG = 111320 on both axes). No local copy — one conversion. */

export interface BBox {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}
export function footprintBBox(footprint: [number, number][]): BBox {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of footprint) {
    if (x < minX) minX = x;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (z > maxZ) maxZ = z;
  }
  return { minX, minZ, maxX, maxZ };
}

/** Shoelace area (m^2) of a footprint polygon. */
export function footprintArea(footprint: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < footprint.length; i++) {
    const [x1, z1] = footprint[i]!;
    const [x2, z2] = footprint[(i + 1) % footprint.length]!;
    a += x1 * z2 - x2 * z1;
  }
  return Math.abs(a) / 2;
}

function centroidOf(footprint: [number, number][]): [number, number] {
  let x = 0;
  let z = 0;
  for (const [px, pz] of footprint) {
    x += px;
    z += pz;
  }
  return [x / Math.max(1, footprint.length), z / Math.max(1, footprint.length)];
}

/**
 * Sutherland-Hodgman clip of a polygon against an axis-aligned rect.
 * Pure data, no THREE. Returns the clipped polygon, or null when nothing
 * of the polygon lies inside the rect. The clip region is convex, so the
 * result is a single (possibly concave) polygon.
 */
export function clipPolygonToRect(
  poly: [number, number][],
  rect: BBox,
): [number, number][] | null {
  let out: [number, number][] = poly.slice();
  // Clip against x >= minX, x <= maxX, z >= minZ, z <= maxZ in turn.
  const edges: {
    inside: (p: [number, number]) => boolean;
    intersect: (a: [number, number], b: [number, number]) => [number, number];
  }[] = [
    {
      inside: (p) => p[0] >= rect.minX,
      intersect: (a, b) => {
        const t = (rect.minX - a[0]) / (b[0] - a[0]);
        return [rect.minX, a[1] + (b[1] - a[1]) * t];
      },
    },
    {
      inside: (p) => p[0] <= rect.maxX,
      intersect: (a, b) => {
        const t = (rect.maxX - a[0]) / (b[0] - a[0]);
        return [rect.maxX, a[1] + (b[1] - a[1]) * t];
      },
    },
    {
      inside: (p) => p[1] >= rect.minZ,
      intersect: (a, b) => {
        const t = (rect.minZ - a[1]) / (b[1] - a[1]);
        return [a[0] + (b[0] - a[0]) * t, rect.minZ];
      },
    },
    {
      inside: (p) => p[1] <= rect.maxZ,
      intersect: (a, b) => {
        const t = (rect.maxZ - a[1]) / (b[1] - a[1]);
        return [a[0] + (b[0] - a[0]) * t, rect.maxZ];
      },
    },
  ];
  for (const edge of edges) {
    if (out.length === 0) break;
    const next: [number, number][] = [];
    for (let i = 0; i < out.length; i++) {
      const cur = out[i]!;
      const prev = out[(i + out.length - 1) % out.length]!;
      const curIn = edge.inside(cur);
      const prevIn = edge.inside(prev);
      if (curIn) {
        if (!prevIn) next.push(edge.intersect(prev, cur));
        next.push(cur);
      } else if (prevIn) {
        next.push(edge.intersect(prev, cur));
      }
    }
    out = next;
  }
  // Drop degenerate slivers (a wall clipped to a line has no area).
  if (out.length < 3 || footprintArea(out) < 0.5) return null;
  return out;
}

/** A building with its footprint clipped to `rect`, or null when it does not reach the rect. */
export function clipBuildingToRect(b: SliceBuilding, rect: BBox): SliceBuilding | null {
  const clipped = clipPolygonToRect(b.footprint, rect);
  if (!clipped) return null;
  return { ...b, footprint: clipped };
}

/** Setback split for towers: null when no setback applies. */
export function setbackFor(
  height: number,
): { lowerH: number; upperScale: number } | null {
  if (height <= SETBACK_HEIGHT_M) return null;
  return { lowerH: height * 0.6, upperScale: 0.76 };
}

/** Door anchor for an enterable building: midpoint of its longest edge + outward normal. */
export function doorPositionFor(b: SliceBuilding): {
  x: number;
  z: number;
  nx: number;
  nz: number;
} {
  const c = centroidOf(b.footprint);
  let best = 0;
  let bestA: [number, number] = b.footprint[0]!;
  let bestB: [number, number] = b.footprint[1] ?? b.footprint[0]!;
  for (let i = 0; i < b.footprint.length; i++) {
    const a = b.footprint[i]!;
    const p = b.footprint[(i + 1) % b.footprint.length]!;
    const len = Math.hypot(p[0] - a[0], p[1] - a[1]);
    if (len > best) {
      best = len;
      bestA = a;
      bestB = p;
    }
  }
  const mx = (bestA[0] + bestB[0]) / 2;
  const mz = (bestA[1] + bestB[1]) / 2;
  // Outward normal: the perpendicular pointing away from the centroid.
  const dx = bestB[0] - bestA[0];
  const dz = bestB[1] - bestA[1];
  const len = Math.hypot(dx, dz) || 1;
  let nx = dz / len;
  let nz = -dx / len;
  if ((mx - c[0]) * nx + (mz - c[1]) * nz < 0) {
    nx = -nx;
    nz = -nz;
  }
  return { x: mx, z: mz, nx, nz };
}

/* ---- facade textures (10h technique, per kind) ---- */

interface FacadeSpec {
  /** Window rects [x, y, w, h] inside the 128x128 tile, and which are lit at night. */
  windows: { x: number; y: number; w: number; h: number; lit: boolean }[];
  wall: string;
  glass: string;
  glint: string;
}

function facadeSpec(kind: SliceBuilding["kind"]): FacadeSpec {
  const rnd = mulberry(7); // same seed as 10h: lit windows match day/night
  const lit = () => rnd() > 0.8;
  switch (kind) {
    case "office":
      // Dense grid: three narrow bays per tile.
      return {
        wall: "#eef0f0",
        glass: "#2b3644",
        glint: "#7fa8c8",
        windows: [6, 48, 90].map((x) => ({ x, y: 24, w: 32, h: 56, lit: lit() })),
      };
    case "residential":
      // 10h layout: two windows, warm wall; balconies are geometry (see below).
      return {
        wall: "#efe6d2",
        glass: "#232c38",
        glint: "#7fa8c8",
        windows: [16, 72].map((x) => ({ x, y: 24, w: 40, h: 56, lit: lit() })),
      };
    case "commercial":
      // Wide glass panes (upper floors; the ground floor is a real shopfront).
      return {
        wall: "#e6ddcb",
        glass: "#2a3542",
        glint: "#9fc4d8",
        windows: [8, 68].map((x) => ({ x, y: 20, w: 52, h: 64, lit: lit() })),
      };
    case "public":
    case "other":
    default:
      // Civic: tall panes, pale stone wall.
      return {
        wall: "#e9ecec",
        glass: "#2b3644",
        glint: "#7fa8c8",
        windows: [16, 72].map((x) => ({ x, y: 16, w: 40, h: 72, lit: lit() })),
      };
  }
}

function paintFacadeCanvas(kind: SliceBuilding["kind"], emissive: boolean): HTMLCanvasElement {
  const spec = facadeSpec(kind);
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = emissive ? "#000000" : spec.wall;
  g.fillRect(0, 0, 128, 128);
  if (!emissive) {
    g.fillStyle = "rgba(0,0,0,0.05)";
    g.fillRect(0, 0, 2, 128);
    g.fillRect(126, 0, 2, 128);
  }
  for (const w of spec.windows) {
    g.fillStyle = emissive ? (w.lit ? "#ffd98a" : "#141c26") : spec.glass;
    g.fillRect(w.x, w.y, w.w, w.h);
    if (!emissive) {
      g.fillStyle = w.lit ? "#ffd98a" : spec.glint;
      g.fillRect(w.x + 3, w.y + 3, w.w - 6, 12);
      g.fillStyle = w.lit ? "#ffedb5" : "#33465c";
      g.fillRect(w.x + 3, w.y + 18, w.w - 6, w.h - 21);
      // Mullion cross.
      g.fillStyle = "rgba(242,237,226,0.85)";
      g.fillRect(w.x + w.w / 2 - 2, w.y, 4, w.h);
      g.fillRect(w.x, w.y + w.h / 2 - 2, w.w, 4);
    } else {
      g.fillStyle = "#000000";
      g.fillRect(w.x + w.w / 2 - 2, w.y, 4, w.h);
      g.fillRect(w.x, w.y + w.h / 2 - 2, w.w, 4);
    }
  }
  if (!emissive) {
    g.fillStyle = "#d8d0bd";
    g.fillRect(0, 118, 128, 5);
    g.fillStyle = "rgba(0,0,0,0.10)";
    g.fillRect(0, 123, 128, 5);
  }
  return c;
}

function canvasTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/* ---- shared materials ---- */

export interface BuildingMaterials {
  /** Per-kind facade materials (the 5 facade materials). */
  office: THREE.MeshStandardMaterial;
  residential: THREE.MeshStandardMaterial;
  commercial: THREE.MeshStandardMaterial;
  civic: THREE.MeshStandardMaterial;
  /** Tall towers (> 60 m upper tier) + shopfront glass. */
  glassy: THREE.MeshStandardMaterial;
  /** Roofs, parapets, AC/tanks, balconies, doorsteps. */
  matte: THREE.MeshStandardMaterial;
  /** Sign bands + door sign boards (unlit so they read in shade). */
  sign: THREE.MeshBasicMaterial;
  /** Recessed doorway interiors. */
  dark: THREE.MeshStandardMaterial;
  /** Owned textures (disposed only by `disposeBuildingMaterials`). */
  textures: THREE.Texture[];
}

function facadeMaterial(kind: SliceBuilding["kind"], textures: THREE.Texture[]): THREE.MeshStandardMaterial {
  const day = canvasTexture(paintFacadeCanvas(kind, false));
  const night = canvasTexture(paintFacadeCanvas(kind, true));
  textures.push(day, night);
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.05,
    map: day,
    emissive: 0xffc873,
    emissiveMap: night,
    // Daytime: windows read from the diffuse tile; the harness raises
    // emissiveIntensity at night (10h behaviour) so lit windows glow.
    emissiveIntensity: 0,
  });
}

/**
 * Build the shared material set. Needs `document` (canvas textures) — call
 * once at scene setup, never per chunk. The caller owns the result and frees
 * it with `disposeBuildingMaterials` at scene teardown only.
 */
export function createBuildingMaterials(): BuildingMaterials {
  const textures: THREE.Texture[] = [];
  const officeDay = canvasTexture(paintFacadeCanvas("office", false));
  const officeNight = canvasTexture(paintFacadeCanvas("office", true));
  textures.push(officeDay, officeNight);
  const glassy = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.32,
    metalness: 0.45,
    map: officeDay,
    emissive: 0xffc873,
    emissiveMap: officeNight,
    emissiveIntensity: 0,
  });
  return {
    office: facadeMaterial("office", textures),
    residential: facadeMaterial("residential", textures),
    commercial: facadeMaterial("commercial", textures),
    civic: facadeMaterial("public", textures),
    glassy,
    matte: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.9,
      flatShading: true,
    }),
    sign: new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a2027, roughness: 1 }),
    textures,
  };
}

/** Teardown-only: frees the shared materials + textures. Never call per chunk. */
export function disposeBuildingMaterials(m: BuildingMaterials): void {
  for (const t of m.textures) t.dispose();
  m.office.dispose();
  m.residential.dispose();
  m.commercial.dispose();
  m.civic.dispose();
  m.glassy.dispose();
  m.matte.dispose();
  m.sign.dispose();
  m.dark.dispose();
}

/* ---- geometry helpers ---- */

const KIND_COLOR: Record<SliceBuilding["kind"], number> = {
  office: 0xcfd6dd,
  commercial: 0xd9c9a8,
  residential: 0xe8dcc4,
  public: 0xdfe3e6,
  other: 0xd5d2cc,
};
const SIGN_COLORS = [0xd9a86a, 0x7fb3a8, 0xc96f5a, 0x8fa8d8];

type Bucket = THREE.BufferGeometry[];
interface Buckets {
  office: Bucket;
  residential: Bucket;
  commercial: Bucket;
  civic: Bucket;
  glassy: Bucket;
  matte: Bucket;
  sign: Bucket;
  dark: Bucket;
}

function newBuckets(): Buckets {
  return { office: [], residential: [], commercial: [], civic: [], glassy: [], matte: [], sign: [], dark: [] };
}

function facadeBucket(buckets: Buckets, kind: SliceBuilding["kind"]): Bucket {
  switch (kind) {
    case "office":
      return buckets.office;
    case "residential":
      return buckets.residential;
    case "commercial":
      return buckets.commercial;
    default:
      return buckets.civic;
  }
}

/** Fill a `color` vertex attribute (10h `paint`). */
function paint(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const n = geo.attributes.position!.count;
  const arr = new Float32Array(n * 3);
  const c = new THREE.Color(hex);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geo;
}

const shade = (hex: number, f: number): number => new THREE.Color(hex).multiplyScalar(f).getHex();

/** Non-indexed geometry (mergeGeometries needs consistent index-ness). */
function flat(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  return geo.index ? geo.toNonIndexed() : geo;
}

type V3 = [number, number, number];
/**
 * Push one quad (two triangles) with explicit UVs and an outward normal.
 * Winding is fixed against `nrm` so OSM polygon winding cannot flip a wall
 * inside-out. `color` null = no color attribute (dark bucket).
 */
function pushQuad(
  bucket: Bucket,
  bl: V3,
  br: V3,
  tr: V3,
  tl: V3,
  nrm: V3,
  uv: { u0: number; u1: number; v0: number; v1: number },
  color: number | null,
): void {
  // Triangle order (bl, br, tr) + (bl, tr, tl); flip when its geometric
  // normal points away from the wanted outward normal.
  const e1: V3 = [br[0] - bl[0], br[1] - bl[1], br[2] - bl[2]];
  const e2: V3 = [tr[0] - bl[0], tr[1] - bl[1], tr[2] - bl[2]];
  const n: V3 = [
    e1[1] * e2[2] - e1[2] * e2[1],
    e1[2] * e2[0] - e1[0] * e2[2],
    e1[0] * e2[1] - e1[1] * e2[0],
  ];
  const dot = n[0] * nrm[0] + n[1] * nrm[1] + n[2] * nrm[2];
  const tris: V3[] =
    dot >= 0
      ? [bl, br, tr, bl, tr, tl]
      : [bl, tr, br, bl, tl, tr];
  const uvs: [number, number][] =
    dot >= 0
      ? [
          [uv.u0, uv.v0],
          [uv.u1, uv.v0],
          [uv.u1, uv.v1],
          [uv.u0, uv.v0],
          [uv.u1, uv.v1],
          [uv.u0, uv.v1],
        ]
      : [
          [uv.u0, uv.v0],
          [uv.u1, uv.v1],
          [uv.u1, uv.v0],
          [uv.u0, uv.v0],
          [uv.u0, uv.v1],
          [uv.u1, uv.v1],
        ];
  const pos = new Float32Array(18);
  const uvArr = new Float32Array(12);
  const nrmArr = new Float32Array(18);
  for (let i = 0; i < 6; i++) {
    const v = tris[i]!;
    pos[i * 3] = v[0];
    pos[i * 3 + 1] = v[1];
    pos[i * 3 + 2] = v[2];
    uvArr[i * 2] = uvs[i]![0];
    uvArr[i * 2 + 1] = uvs[i]![1];
    nrmArr[i * 3] = nrm[0];
    nrmArr[i * 3 + 1] = nrm[1];
    nrmArr[i * 3 + 2] = nrm[2];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nrmArr, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvArr, 2));
  if (color !== null) paint(geo, color);
  bucket.push(geo);
}

/** Wall quad for one footprint edge, UV-tiled in whole tiles (10h rule). */
function pushWall(
  bucket: Bucket,
  a: [number, number],
  b: [number, number],
  y0: number,
  y1: number,
  nrm: [number, number],
  color: number,
  opts?: { u0?: number; u1?: number },
): void {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const repU = Math.max(1, Math.round(len / FACADE_TILE));
  const repV = Math.max(1, Math.round((y1 - y0) / FACADE_TILE));
  const u0 = opts?.u0 ?? 0;
  const u1 = opts?.u1 ?? repU;
  pushQuad(
    bucket,
    [a[0], y0, a[1]],
    [b[0], y0, b[1]],
    [b[0], y1, b[1]],
    [a[0], y1, a[1]],
    [nrm[0], 0, nrm[1]],
    { u0, u1, v0: 0, v1: repV },
    color,
  );
}

/** Outward normal of an edge (perpendicular pointing away from the centroid). */
function edgeOutward(
  a: [number, number],
  b: [number, number],
  c: [number, number],
): [number, number] {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  let nx = dz / len;
  let nz = -dx / len;
  const mx = (a[0] + b[0]) / 2 - c[0];
  const mz = (a[1] + b[1]) / 2 - c[1];
  if (mx * nx + mz * nz < 0) {
    nx = -nx;
    nz = -nz;
  }
  return [nx, nz];
}

/** Flat roof from a footprint polygon (ShapeGeometry, winding fixed to face up). */
function pushRoof(bucket: Bucket, footprint: [number, number][], y: number, color: number): void {
  if (footprint.length < 3) return;
  const shape = new THREE.Shape();
  shape.moveTo(footprint[0]![0], footprint[0]![1]);
  for (let i = 1; i < footprint.length; i++) shape.lineTo(footprint[i]![0], footprint[i]![1]);
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2); // shape XY -> ground XZ; +z shape normal becomes +y
  geo.translate(0, y, 0);
  // ShapeGeometry triangulation follows the ring winding; if the first
  // triangle faces down, reverse every triangle's winding.
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const p0: V3 = [pos.getX(0), pos.getY(0), pos.getZ(0)];
  const p1: V3 = [pos.getX(1), pos.getY(1), pos.getZ(1)];
  const p2: V3 = [pos.getX(2), pos.getY(2), pos.getZ(2)];
  const ny =
    (p1[0] - p0[0]) * (p2[2] - p0[2]) - (p1[2] - p0[2]) * (p2[0] - p0[0]);
  if (ny < 0) {
    const arr = pos.array as Float32Array;
    for (let t = 0; t < pos.count; t += 3) {
      for (let k = 0; k < 3; k++) {
        const tmp = arr[(t + 1) * 3 + k]!;
        arr[(t + 1) * 3 + k] = arr[(t + 2) * 3 + k]!;
        arr[(t + 2) * 3 + k] = tmp;
      }
    }
    pos.needsUpdate = true;
    const nrm = geo.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
    nrm.needsUpdate = true;
  }
  // Roof samples a plain wall patch (10h top-face rule); colour does the work.
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.22);
  paint(geo, color);
  bucket.push(flat(geo));
}

function pushBox(
  bucket: Bucket,
  cx: number,
  cy: number,
  cz: number,
  w: number,
  h: number,
  d: number,
  color: number,
  /** Y rotation (radians): +x of the box maps to (cos ry, 0, -sin ry). */
  ry = 0,
): void {
  const geo = flat(new THREE.BoxGeometry(w, h, d));
  if (ry !== 0) geo.rotateY(ry);
  geo.translate(cx, cy, cz);
  paint(geo, color);
  bucket.push(geo);
}

/** Y rotation that maps a box's +x axis onto the (tx, tz) tangent. */
const tangentRy = (tx: number, tz: number): number => Math.atan2(-tz, tx);

function scaleFootprint(
  footprint: [number, number][],
  c: [number, number],
  s: number,
): [number, number][] {
  return footprint.map(([x, z]) => [c[0] + (x - c[0]) * s, c[1] + (z - c[1]) * s]);
}

/* ---- main build ---- */

export interface BuildBuildingsOpts {
  /** When set, each footprint is clipped to this rect (chunk build). */
  clipRect?: BBox;
  /**
   * When set, door / balcony / roof props are built only when their anchor
   * point lies in this chunk rect (prevents duplicates across chunks).
   * Omit for a whole-city build.
   */
  propRect?: BBox;
}

function inRect(x: number, z: number, r: BBox): boolean {
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

/** Build one prism tier (walls + roof) for a footprint at [y0, y1]. */
function buildTier(
  buckets: Buckets,
  bucket: Bucket,
  footprint: [number, number][],
  y0: number,
  y1: number,
  color: number,
  doorGap?: { a: [number, number]; b: [number, number]; at: number; w: number; h: number },
): void {
  const c = centroidOf(footprint);
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i]!;
    const b = footprint[(i + 1) % footprint.length]!;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.01) continue; // closed-ring seam
    const nrm = edgeOutward(a, b, c);
    if (doorGap && a === doorGap.a && b === doorGap.b && y0 === 0) {
      // Real door opening: split the wall around the portal (gap from the
      // ground to DOOR_H), lintel above the door.
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const ux = (b[0] - a[0]) / len;
      const uz = (b[1] - a[1]) / len;
      const s0 = doorGap.at - doorGap.w / 2;
      const s1 = doorGap.at + doorGap.w / 2;
      const p = (s: number): [number, number] => [a[0] + ux * s, a[1] + uz * s];
      const repU = Math.max(1, Math.round(len / FACADE_TILE));
      const uAt = (s: number) => (s / len) * repU;
      if (s0 > 0.01) pushWall(bucket, a, p(s0), y0, y1, nrm, color, { u0: 0, u1: uAt(s0) });
      if (s1 < len - 0.01) pushWall(bucket, p(s1), b, y0, y1, nrm, color, { u0: uAt(s1), u1: repU });
      // Lintel over the doorway.
      pushWall(bucket, p(s0), p(s1), DOOR_H, y1, nrm, color, { u0: uAt(s0), u1: uAt(s1) });
    } else {
      pushWall(bucket, a, b, y0, y1, nrm, color);
    }
  }
  pushRoof(buckets.matte, footprint, y1, shade(color, 0.82));
}

/**
 * Build buildings into one THREE.Group, merged per material bucket.
 * `materials` is the shared set from `createBuildingMaterials` (never
 * disposed here). With `opts.clipRect`, footprints are clipped to the rect
 * (chunk streaming); without it the whole city is built in one group
 * (the map-mode merged path, ~8 draw calls for the whole slice).
 */
export function buildBuildings(
  city: SliceCity,
  materials: BuildingMaterials,
  opts: BuildBuildingsOpts = {},
): THREE.Group {
  const buckets = newBuckets();
  const group = new THREE.Group();
  let built = 0;
  let skipped = 0;

  for (const b of city.buildings) {
    const height = Math.min(300, Math.max(3, b.height || b.levels * 3 || 9));
    let footprint: [number, number][] = b.footprint;
    if (footprint.length < 3) {
      skipped++;
      continue;
    }
    if (opts.clipRect) {
      const clipped = clipPolygonToRect(footprint, opts.clipRect);
      if (!clipped) {
        skipped++;
        continue;
      }
      footprint = clipped;
    }
    const color = KIND_COLOR[b.kind] ?? KIND_COLOR.other;
    const bucket = facadeBucket(buckets, b.kind);
    const c = centroidOf(footprint);
    const sb = setbackFor(height);
    const isTower = height > SETBACK_HEIGHT_M;
    const propHere =
      !opts.propRect ||
      inRect(c[0], c[1], opts.propRect) ||
      (b.enterable !== null && inRect(doorPositionFor(b).x, doorPositionFor(b).z, opts.propRect));

    // Door gap (enterable only, ground tier, front edge) — computed on the
    // CLIPPED footprint's longest edge so the portal lands in this chunk.
    let doorGap: { a: [number, number]; b: [number, number]; at: number; w: number; h: number } | undefined;
    let door: { x: number; z: number; nx: number; nz: number } | undefined;
    if (b.enterable !== null && propHere) {
      const d = doorPositionFor({ ...b, footprint });
      door = d;
      // Find the clipped edge whose midpoint is nearest the door anchor.
      let bestDist = Infinity;
      let bestEdge: { a: [number, number]; b: [number, number]; at: number } | undefined;
      for (let i = 0; i < footprint.length; i++) {
        const a = footprint[i]!;
        const p = footprint[(i + 1) % footprint.length]!;
        const mx = (a[0] + p[0]) / 2;
        const mz = (a[1] + p[1]) / 2;
        const dist = Math.hypot(mx - d.x, mz - d.z);
        if (dist < bestDist) {
          bestDist = dist;
          const len = Math.hypot(p[0] - a[0], p[1] - a[1]) || 1;
          bestEdge = { a, b: p, at: ((d.x - a[0]) * (p[0] - a[0]) + (d.z - a[1]) * (p[1] - a[1])) / len };
        }
      }
      if (bestEdge && bestEdge.at > DOOR_W / 2 + 0.5 && bestEdge.at < Math.hypot(bestEdge.b[0] - bestEdge.a[0], bestEdge.b[1] - bestEdge.a[1]) - DOOR_W / 2 - 0.5) {
        doorGap = { ...bestEdge, w: DOOR_W, h: DOOR_H };
      }
    }

    if (sb) {
      buildTier(buckets, bucket, footprint, 0, sb.lowerH, color, doorGap);
      const upper = scaleFootprint(footprint, c, sb.upperScale);
      buildTier(buckets, isTower ? buckets.glassy : bucket, upper, sb.lowerH, height, shade(color, 0.92));
      // Parapet on the upper roof.
      const uc = centroidOf(upper);
      for (let i = 0; i < upper.length; i++) {
        const a = upper[i]!;
        const p = upper[(i + 1) % upper.length]!;
        const nrm = edgeOutward(a, p, uc);
        const el = Math.hypot(p[0] - a[0], p[1] - a[1]);
        if (el < 0.01) continue;
        pushBox(buckets.matte, (a[0] + p[0]) / 2 + (nrm[0] * 0.15), height + 0.45, (a[1] + p[1]) / 2 + (nrm[1] * 0.15), el, 0.9, 0.3, shade(color, 0.7), tangentRy((p[0] - a[0]) / (el || 1), (p[1] - a[1]) / (el || 1)));
      }
    } else {
      buildTier(buckets, bucket, footprint, 0, height, color, doorGap);
      // Parapet on the roof edge.
      for (let i = 0; i < footprint.length; i++) {
        const a = footprint[i]!;
        const p = footprint[(i + 1) % footprint.length]!;
        const nrm = edgeOutward(a, p, c);
        const el = Math.hypot(p[0] - a[0], p[1] - a[1]);
        if (el < 0.01) continue;
        pushBox(buckets.matte, (a[0] + p[0]) / 2 + (nrm[0] * 0.15), height + 0.45, (a[1] + p[1]) / 2 + (nrm[1] * 0.15), el, 0.9, 0.3, shade(color, 0.7), tangentRy((p[0] - a[0]) / (el || 1), (p[1] - a[1]) / (el || 1)));
      }
    }

    if (propHere) {
      const rnd = mulberry(hashStr(b.id));
      const bb = footprintBBox(footprint);
      // Roof props: 1-2 AC boxes, + a water tank on towers.
      const acN = 1 + Math.floor(rnd() * 2);
      for (let i = 0; i < acN; i++) {
        const px = bb.minX + 3 + rnd() * Math.max(1, bb.maxX - bb.minX - 6);
        const pz = bb.minZ + 3 + rnd() * Math.max(1, bb.maxZ - bb.minZ - 6);
        pushBox(buckets.matte, px, height + 0.6, pz, 2.2, 1.2, 2.0, 0x9a9d9e);
      }
      if (isTower) {
        pushBox(buckets.matte, bb.minX + 4, height + 1.3, bb.minZ + 4, 2.4, 2.6, 2.4, 0x7e8a94);
      }

      // Residential balconies on +z-facing edges (south fronts), every 2nd floor.
      if (b.kind === "residential") {
        let made = 0;
        for (let i = 0; i < footprint.length && made < 6; i++) {
          const a = footprint[i]!;
          const p = footprint[(i + 1) % footprint.length]!;
          const nrm = edgeOutward(a, p, c);
          if (nrm[1] <= 0.5) continue;
          const len = Math.hypot(p[0] - a[0], p[1] - a[1]);
          if (len < 0.5) continue;
          const floors = Math.floor(height / FACADE_TILE);
          for (let f = 2; f < floors && made < 6; f += 2) {
            const y = f * FACADE_TILE + 0.4;
            const mx = (a[0] + p[0]) / 2 + nrm[0] * 0.55;
            const mz = (a[1] + p[1]) / 2 + nrm[1] * 0.55;
            pushBox(buckets.matte, mx, y, mz, Math.min(len * 0.7, 3.2), 0.15, 1.1, shade(color, 0.85));
            made++;
          }
        }
      }

      // Commercial ground floor: glass shopfront + sign band on the longest edge.
      if (b.kind === "commercial" || b.enterable?.role === "shop") {
        const d = door ?? doorPositionFor({ ...b, footprint });
        const len = Math.min(18, Math.hypot(bb.maxX - bb.minX, bb.maxZ - bb.minZ));
        const signColor = SIGN_COLORS[hashStr(b.id) % SIGN_COLORS.length]!;
        const shopRy = tangentRy(-d.nz, d.nx);
        pushBox(buckets.glassy, d.x, GROUND_FLOOR_H / 2, d.z, Math.max(4, len), GROUND_FLOOR_H, 0.18, 0x2a3542, shopRy);
        pushBox(buckets.sign, d.x, GROUND_FLOOR_H + 0.55, d.z, Math.max(4, len), 0.9, 0.22, signColor, shopRy);
      }

      // Enterable door: recessed dark portal + sign board + doorstep.
      if (door && doorGap) {
        const { x, z, nx, nz } = door;
        // Portal interior: back plane 0.4 m inside, plus sides + top.
        const bx = x + nx * DOOR_DEPTH;
        const bz = z + nz * DOOR_DEPTH;
        const tx = -nz; // tangent along the wall
        const tz = nx;
        const hw = DOOR_W / 2;
        pushQuad(buckets.dark, [bx - tx * hw, 0, bz - tz * hw], [bx + tx * hw, 0, bz + tz * hw], [bx + tx * hw, DOOR_H, bz + tz * hw], [bx - tx * hw, DOOR_H, bz - tz * hw], [-nx, 0, -nz], { u0: 0, u1: 1, v0: 0, v1: 1 }, null);
        // Sides + top of the recess (dark).
        pushQuad(buckets.dark, [x - tx * hw, 0, z - tz * hw], [bx - tx * hw, 0, bz - tz * hw], [bx - tx * hw, DOOR_H, bz - tz * hw], [x - tx * hw, DOOR_H, z - tz * hw], [-tx, 0, -tz], { u0: 0, u1: 1, v0: 0, v1: 1 }, null);
        pushQuad(buckets.dark, [bx + tx * hw, 0, bz + tz * hw], [x + tx * hw, 0, z + tz * hw], [x + tx * hw, DOOR_H, z + tz * hw], [bx + tx * hw, DOOR_H, bz + tz * hw], [tx, 0, tz], { u0: 0, u1: 1, v0: 0, v1: 1 }, null);
        pushQuad(buckets.dark, [x - tx * hw, DOOR_H, z - tz * hw], [x + tx * hw, DOOR_H, z + tz * hw], [bx + tx * hw, DOOR_H, bz + tz * hw], [bx - tx * hw, DOOR_H, bz - tz * hw], [0, -1, 0], { u0: 0, u1: 1, v0: 0, v1: 1 }, null);
        // Sign board above the door (real geometry) + doorstep slab.
        const doorRy = tangentRy(tx, tz);
        pushBox(buckets.sign, x + nx * 0.15, DOOR_H + 0.65, z + nz * 0.15, 2.6, 0.9, 0.18, SIGN_COLORS[hashStr(b.id + ":door") % SIGN_COLORS.length]!, doorRy);
        pushBox(buckets.matte, x + nx * 0.7, 0.06, z + nz * 0.7, 2.8, 0.12, 1.4, shade(color, 0.75), doorRy);
      }
    }
    built++;
  }

  const matFor: [Bucket, THREE.Material][] = [
    [buckets.office, materials.office],
    [buckets.residential, materials.residential],
    [buckets.commercial, materials.commercial],
    [buckets.civic, materials.civic],
    [buckets.glassy, materials.glassy],
    [buckets.matte, materials.matte],
    [buckets.sign, materials.sign],
    [buckets.dark, materials.dark],
  ];
  for (const [bucket, mat] of matFor) {
    if (bucket.length === 0) continue;
    const merged = mergeGeometries(bucket, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  group.userData = { kind: "world2-buildings", buildingCount: built, skipped };
  return group;
}

/**
 * Free a group built by `buildBuildings`. Disposes ONLY chunk-owned
 * geometries — the shared materials/textures are never disposed here
 * (10g ownership rule; disposing one would black out the whole city).
 */
export function disposeBuildings(group: THREE.Group): void {
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) m.geometry.dispose();
  });
  group.removeFromParent();
}
