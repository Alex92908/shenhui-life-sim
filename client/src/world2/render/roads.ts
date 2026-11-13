// Bay Area Life 2.0 — renderer: roads (real meters).
//
// Asphalt ribbons from SliceRoad centerlines, sidewalk strips alongside,
// dashed center lines on primary/secondary roads, and zebra crossings at
// way intersections (computed from shared endpoints). No textures — vertex
// colors + plain materials only.
//
// Deliberate scope call: roads are built ONCE for the whole slice
// (`buildRoads(city)` -> one group, 3 merged meshes) and are NOT chunked.
// The slice has a few dozen roads; 3 draw calls city-wide beats per-chunk
// ribbon clipping, and a road crossing a chunk border must never be cut.
// Only buildings stream (see streaming.ts).
//
// Ownership: the returned group OWNS its 3 materials (created here), so
// `disposeRoads` frees geometries AND materials — unlike buildings, whose
// materials are shared and never disposed per chunk.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { latLonToEnu, type SliceCity, type SliceRoad } from "../cityData";
import type { BBox } from "./buildings";

/** Carriageway width by OSM highway kind (meters). */
export function roadWidth(kind: string): number {
  switch (kind) {
    case "primary":
      return 14;
    case "secondary":
      return 10;
    case "tertiary":
      return 12;
    case "secondary_link":
      return 8;
    case "residential":
      return 7;
    case "unclassified":
      return 6;
    case "service":
      return 5;
    case "footway":
    case "pedestrian":
    case "path":
      return 2.5;
    default:
      return 7;
  }
}

/** Sidewalk strip width by kind (0 = the way IS a footway, no separate sidewalk). */
export function sidewalkWidth(kind: string): number {
  switch (kind) {
    case "primary":
      return 3;
    case "secondary":
    case "tertiary":
      return 2.5;
    case "residential":
      return 2;
    case "service":
    case "unclassified":
      return 1.5;
    default:
      return 0;
  }
}

/**
 * Render bounds for roads: the slice bbox in ENU meters, expanded by
 * `marginM`. Boundary-crossing OSM ways return FULL geometry — in the real
 * slice one road runs to z = -1112 m, 860 m past the box edge — so road
 * polylines are CLIPPED to these bounds in `buildRoads` (below) instead of
 * rendering ribbons that float past the ground plane. Buildings are NOT
 * clamped this way (a building at x = 287 m is real and renders whole;
 * chunk clipping handles it per chunk).
 */
export function sliceRenderBounds(city: SliceCity, marginM = 100): BBox {
  const corners = [
    latLonToEnu(city.bbox.minLat, city.bbox.minLon, city.origin),
    latLonToEnu(city.bbox.minLat, city.bbox.maxLon, city.origin),
    latLonToEnu(city.bbox.maxLat, city.bbox.minLon, city.origin),
    latLonToEnu(city.bbox.maxLat, city.bbox.maxLon, city.origin),
  ];
  const xs = corners.map((c) => c[0]);
  const zs = corners.map((c) => c[1]);
  return {
    minX: Math.min(...xs) - marginM,
    maxX: Math.max(...xs) + marginM,
    minZ: Math.min(...zs) - marginM,
    maxZ: Math.max(...zs) + marginM,
  };
}

/**
 * Clip a polyline to an axis-aligned rect (Liang-Barsky per segment).
 * Pure data. Returns the in-bounds runs (usually one; a road that leaves
 * and re-enters yields several). Empty when the polyline never enters.
 */
export function clipPolylineToRect(
  points: [number, number][],
  rect: BBox,
): [number, number][][] {
  const runs: [number, number][][] = [];
  let cur: [number, number][] = [];
  const clipSeg = (
    a: [number, number],
    b: [number, number],
  ): [number, number][] | null => {
    let t0 = 0;
    let t1 = 1;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const edges: [number, number][] = [
      [-dx, a[0] - rect.minX],
      [dx, rect.maxX - a[0]],
      [-dz, a[1] - rect.minZ],
      [dz, rect.maxZ - a[1]],
    ];
    for (const [p, q] of edges) {
      if (p === 0) {
        if (q < 0) return null;
      } else {
        const r = q / p;
        if (p < 0) {
          if (r > t1) return null;
          if (r > t0) t0 = r;
        } else {
          if (r < t0) return null;
          if (r < t1) t1 = r;
        }
      }
    }
    return [
      [a[0] + dx * t0, a[1] + dz * t0],
      [a[0] + dx * t1, a[1] + dz * t1],
    ];
  };
  for (let i = 0; i < points.length - 1; i++) {
    const seg = clipSeg(points[i]!, points[i + 1]!);
    if (!seg) {
      if (cur.length >= 2) runs.push(cur);
      cur = [];
      continue;
    }
    if (cur.length === 0) cur.push(seg[0]!);
    else {
      const last = cur[cur.length - 1]!;
      if (Math.hypot(seg[0]![0] - last[0], seg[0]![1] - last[1]) > 0.001) {
        if (cur.length >= 2) runs.push(cur);
        cur = [seg[0]!];
      }
    }
    cur.push(seg[1]!);
  }
  if (cur.length >= 2) runs.push(cur);
  return runs;
}

const ASPHALT = 0x3a3d42;
const SIDEWALK = 0xb9b7ae;
const MARKING = 0xf2f0e6;
const CENTER_LINE = 0xe8c84a;

/** Layer heights above the ground plane (y = 0): stacked to avoid z-fighting. */
export const ROAD_Y = 0.02;
export const SIDEWALK_Y = 0.035;
export const MARKING_Y = 0.05;

export interface RoadIntersection {
  x: number;
  z: number;
  roadIds: [string, string];
}

/**
 * Intersections from SHARED ENDPOINTS: two roads whose endpoints coincide
 * (within 0.5 m) cross there. Pure data, no THREE. (Mid-segment crossings
 * are not in the OSM way data the slice ships; the data agent can extend
 * this with segment-segment tests if a way crosses without a shared node.)
 */
export function findIntersections(roads: SliceRoad[]): RoadIntersection[] {
  const out: RoadIntersection[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < roads.length; i++) {
    for (let j = i + 1; j < roads.length; j++) {
      const a = roads[i]!;
      const b = roads[j]!;
      const endsA = [a.points[0]!, a.points[a.points.length - 1]!];
      const endsB = [b.points[0]!, b.points[b.points.length - 1]!];
      for (const pa of endsA) {
        for (const pb of endsB) {
          if (Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) <= 0.5) {
            const key = `${a.id}<${b.id}@${pa[0].toFixed(1)},${pa[1].toFixed(1)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ x: (pa[0] + pb[0]) / 2, z: (pa[1] + pb[1]) / 2, roadIds: [a.id, b.id] });
          }
        }
      }
    }
  }
  return out;
}

/**
 * Flat ribbon strip along a polyline (pure math, no THREE): per-vertex
 * averaged normals give clean miters at joints. Returns non-indexed
 * positions (two triangles per segment) at height `y`.
 */
export function polylineRibbon(
  points: [number, number][],
  width: number,
  y: number,
): { positions: Float32Array; count: number } {
  const half = width / 2;
  const clean: [number, number][] = [];
  for (const p of points) {
    const last = clean[clean.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.001) clean.push(p);
  }
  const n = clean.length;
  const positions = new Float32Array(Math.max(0, (n - 1) * 6 * 3));
  if (n < 2) return { positions, count: 0 };
  let v = 0;
  const leftOf = (i: number): [number, number] => {
    // Averaged direction at vertex i (miter), left normal of the path.
    const p = clean[i]!;
    const prev = clean[Math.max(0, i - 1)]!;
    const next = clean[Math.min(n - 1, i + 1)]!;
    let dx = next[0] - prev[0];
    let dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    return [p[0] + -dz * half, p[1] + dx * half];
  };
  const rightOf = (i: number): [number, number] => {
    const p = clean[i]!;
    const prev = clean[Math.max(0, i - 1)]!;
    const next = clean[Math.min(n - 1, i + 1)]!;
    let dx = next[0] - prev[0];
    let dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    return [p[0] + dz * half, p[1] + -dx * half];
  };
  const tri = (a: [number, number], b: [number, number], c: [number, number]) => {
    positions[v++] = a[0];
    positions[v++] = y;
    positions[v++] = a[1];
    positions[v++] = b[0];
    positions[v++] = y;
    positions[v++] = b[1];
    positions[v++] = c[0];
    positions[v++] = y;
    positions[v++] = c[1];
  };
  for (let i = 0; i < n - 1; i++) {
    const l0 = leftOf(i);
    const r0 = rightOf(i);
    const l1 = leftOf(i + 1);
    const r1 = rightOf(i + 1);
    tri(l0, r0, r1);
    tri(l0, r1, l1);
  }
  return { positions, count: (n - 1) * 6 };
}

function ribbonGeometry(
  points: [number, number][],
  width: number,
  y: number,
  color: number,
): THREE.BufferGeometry | null {
  const { positions, count } = polylineRibbon(points, width, y);
  if (count === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const nrm = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) nrm[i * 3 + 1] = 1;
  geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  const uv = new Float32Array(count * 2);
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  const col = new Float32Array(count * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

/** Offset a polyline sideways by `off` meters (for sidewalk strips). */
function offsetPolyline(points: [number, number][], off: number): [number, number][] {
  return points.map((p, i) => {
    const prev = points[Math.max(0, i - 1)]!;
    const next = points[Math.min(points.length - 1, i + 1)]!;
    let dx = next[0] - prev[0];
    let dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    return [p[0] + -dz * off, p[1] + dx * off];
  });
}

/** Build one merged mesh from a bucket of geometries, or null when empty. */
function mergedMesh(
  bucket: THREE.BufferGeometry[],
  mat: THREE.Material,
): THREE.Mesh | null {
  if (bucket.length === 0) return null;
  const merged = mergeGeometries(bucket, false);
  if (!merged) return null;
  const mesh = new THREE.Mesh(merged, mat);
  mesh.matrixAutoUpdate = false;
  return mesh;
}

/**
 * Build the whole slice road network: one asphalt mesh, one sidewalk mesh,
 * one markings mesh (dashed center lines + zebra crossings). Vertex colors
 * carry the per-layer colour; all three share one material shape.
 */
export function buildRoads(city: SliceCity): THREE.Group {
  const group = new THREE.Group();
  const asphalt: THREE.BufferGeometry[] = [];
  const sidewalks: THREE.BufferGeometry[] = [];
  const markings: THREE.BufferGeometry[] = [];
  const byId = new Map(city.roads.map((r) => [r.id, r]));
  // Out-of-range geometry: clip every road to the render bounds (slice
  // bbox + 100 m). Intersections are computed from the ORIGINAL ways and
  // then filtered to the bounds, so clipped endpoints (rect crossings)
  // can never invent a crossing.
  const bounds = sliceRenderBounds(city);
  const inBounds = (x: number, z: number) =>
    x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;

  for (const road of city.roads) {
    if (road.points.length < 2) continue;
    const w = roadWidth(road.kind);
    for (const run of clipPolylineToRect(road.points, bounds)) {
      const g = ribbonGeometry(run, w, ROAD_Y, ASPHALT);
      if (g) asphalt.push(g);
      const sw = sidewalkWidth(road.kind);
      if (sw > 0) {
        const off = w / 2 + sw / 2;
        for (const side of [1, -1]) {
          const strip = offsetPolyline(run, off * side);
          const sg = ribbonGeometry(strip, sw, SIDEWALK_Y, SIDEWALK);
          if (sg) sidewalks.push(sg);
        }
      }
      // Dashed center line on primary / secondary (3 m dash, 3 m gap).
      if (road.kind === "primary" || road.kind === "secondary") {
        for (let i = 0; i < run.length - 1; i++) {
          const a = run[i]!;
          const b = run[i + 1]!;
          const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const dx = (b[0] - a[0]) / (segLen || 1);
          const dz = (b[1] - a[1]) / (segLen || 1);
          let s = 0;
          while (s < segLen) {
            const dashLen = Math.min(3, segLen - s);
            const p0: [number, number] = [a[0] + dx * s, a[1] + dz * s];
            const p1: [number, number] = [a[0] + dx * (s + dashLen), a[1] + dz * (s + dashLen)];
            const mg = ribbonGeometry([p0, p1], 0.15, MARKING_Y, road.kind === "primary" ? CENTER_LINE : MARKING);
            if (mg) markings.push(mg);
            s += 6;
          }
        }
      }
    }
  }

  // Zebra crossings at intersections: stripes across the wider road,
  // perpendicular to its direction at the crossing point.
  const intersections = findIntersections(city.roads).filter((ix) => inBounds(ix.x, ix.z));
  for (const ix of intersections) {
    const ra = byId.get(ix.roadIds[0]);
    const rb = byId.get(ix.roadIds[1]);
    if (!ra || !rb) continue;
    const w = Math.max(roadWidth(ra.kind), roadWidth(rb.kind));
    // Direction: follow the first road's segment nearest the crossing.
    let dir: [number, number] = [1, 0];
    let best = Infinity;
    for (let i = 0; i < ra.points.length - 1; i++) {
      const a = ra.points[i]!;
      const b = ra.points[i + 1]!;
      const mx = (a[0] + b[0]) / 2;
      const mz = (a[1] + b[1]) / 2;
      const d = Math.hypot(mx - ix.x, mz - ix.z);
      if (d < best) {
        best = d;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        dir = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      }
    }
    // Stripes run across the road (perpendicular to `dir`), spaced 1 m.
    const px = -dir[1];
    const pz = dir[0];
    const stripes = Math.max(3, Math.floor(w / 1.1));
    for (let s = 0; s < stripes; s++) {
      const along = (s - (stripes - 1) / 2) * 1.1;
      const cx = ix.x + dir[0] * along;
      const cz = ix.z + dir[1] * along;
      const p0: [number, number] = [cx - px * (w / 2), cz - pz * (w / 2)];
      const p1: [number, number] = [cx + px * (w / 2), cz + pz * (w / 2)];
      const zg = ribbonGeometry([p0, p1], 0.5, MARKING_Y, MARKING);
      if (zg) markings.push(zg);
    }
  }

  const mat = (rough: number) =>
    new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: rough });
  const aMesh = mergedMesh(asphalt, mat(0.95));
  const sMesh = mergedMesh(sidewalks, mat(1));
  const mMesh = mergedMesh(markings, mat(0.6));
  if (aMesh) group.add(aMesh);
  if (sMesh) group.add(sMesh);
  if (mMesh) group.add(mMesh);
  group.userData = {
    kind: "world2-roads",
    roadCount: city.roads.length,
    intersections: intersections.length,
    renderBounds: bounds,
  };
  return group;
}

/** Free a group built by `buildRoads` (geometries AND its own materials). */
export function disposeRoads(group: THREE.Group): void {
  const mats = new Set<THREE.Material>();
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((x) => mats.add(x));
      else if (mat) mats.add(mat);
    }
  });
  for (const m of mats) m.dispose();
  group.removeFromParent();
}
