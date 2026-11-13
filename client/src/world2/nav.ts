/**
 * Bay Area Life 2.0 — Stage 1 navigation (Recast + Detour).
 *
 * Pure logic + recast-navigation. No three.js, no React, no game imports.
 *
 * Coordinate convention (shared with city-data / physics):
 *   x = east, z = south, y = up, meters. The navmesh is built flat at
 *   y = 0 (the slice is a flat 500 m block; no stairs/ramps in Stage 1).
 *
 * How it works:
 * - `buildNavMesh` triangulates each walkable polygon (ear clipping),
 *   then REJECTS any triangle that touches a building footprint
 *   (centroid inside, vertex inside, or edge crossing a footprint edge).
 *   The rejection is conservative on purpose: no navmesh triangle ever
 *   overlaps a footprint, so findPath / randomPointNear / crowd can never
 *   route an agent into a building. A later step can replace rejection
 *   with exact polygon clipping if a thin walkable strip ever gets
 *   severed by it; the slice data (340 quads, already avoiding
 *   buildings) does not hit that case.
 * - The triangle soup is rasterized by Recast (`generateSoloNavMesh`,
 *   single tile — the whole slice is one 500 m tile) and queried with
 *   Detour (`NavMeshQuery` for paths, `Crowd` for agents).
 *
 * Recast parameters, chosen for a 500 m x 500 m flat block and a
 * 1.8 m-tall, 0.35 m-radius agent:
 * - cs = 0.5 m (xz cell size), ch = 0.2 m (y cell size): the block is
 *   1000 x 1000 cells (~1M cells, ~19-26 s build — too slow for a
 *   loading screen, hence the pre-baked bytes; see `bakeNavMeshData`).
 *   would triple the build for no gain — the narrowest walkable strip
 *   in the slice is ~2 m wide.
 * - walkableRadius = 1 voxel = 0.5 m: the walkable area is eroded
 *   0.5 m away from walls/obstacles (agent radius 0.35 m, rounded up
 *   to one cell), so agents keep a half-metre clearance from facades.
 * - walkableHeight = 10 voxels = 2.0 m clearance (agent height 1.8 m).
 * - walkableClimb = 2 voxels = 0.4 m (curb-height step).
 * - walkableSlopeAngle = 45 deg (flat ground; anything steeper is a wall).
 * - maxEdgeLen 12, maxSimplificationError 1.3, minRegionArea 8,
 *   mergeRegionArea 20, maxVertsPerPoly 6, detailSampleDist 6,
 *   detailSampleMaxError 1: recast-navigation defaults.
 *
 * WASM loading: recast-navigation's `init()` dynamically imports
 * `@recast-navigation/wasm`, whose WASM binary is inlined as base64 in
 * the compat JS build — no separate .wasm asset is fetched, so the Vite
 * config needs NO change (verified by a scratch vite build; see report).
 * `init()` is idempotent: calling it twice resolves immediately.
 *
 * Build cost (measured on the real slice data, 340 quads / 30
 * buildings): ~26 s for one `buildNavMesh` call at cs = 0.5 m
 * (1000+ x 1300+ heightfield cells). That is a one-time cost, but it is
 * too slow for a loading screen — the production path should pre-bake
 * the navmesh once (`bakeNavMeshData`: build the live mesh, then
 * `exportNavMesh` to bytes, shipped with the slice data) and import it
 * with `loadNavMesh` instead of rebuilding at runtime. cs = 1.0 m
 * would also cut the build roughly 4x, at the cost of 1 m erosion
 * around walls.
 */

import {
  Crowd as RecastCrowd,
  exportNavMesh,
  importNavMesh,
  init,
  NavMesh as RecastNavMesh,
  NavMeshQuery,
} from "recast-navigation";
import { generateSoloNavMesh } from "recast-navigation/generators";

export interface NavMesh {
  findPath(from: [number, number], to: [number, number]): [number, number][];
  randomPointNear(x: number, z: number, radius: number): [number, number] | null;
}

/** Recast handles the caller never sees; kept in a WeakMap so the
 *  exported NavMesh interface stays exactly as contracted. */
interface NavMeshInternals {
  navMesh: RecastNavMesh;
  query: NavMeshQuery;
}
const internalsByNavMesh = new WeakMap<object, NavMeshInternals>();

type Point = [number, number];

/* ------------------------------------------------------------------ */
/* 2D geometry helpers (xz plane)                                      */
/* ------------------------------------------------------------------ */

function signedArea(poly: Point[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i]!;
    const [x2, z2] = poly[(i + 1) % poly.length]!;
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

function pointInPolygon(p: Point, poly: Point[]): boolean {
  const [x, z] = p;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function segmentsIntersect(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
): boolean {
  const d1 = (d[0] - c[0]) * (a[1] - c[1]) - (d[1] - c[1]) * (a[0] - c[0]);
  const d2 = (d[0] - c[0]) * (b[1] - c[1]) - (d[1] - c[1]) * (b[0] - c[0]);
  const d3 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d4 = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

/** True if any part of triangle `tri` overlaps footprint `poly`. */
function triangleTouchesPolygon(tri: Point[], poly: Point[]): boolean {
  const centroid: Point = [
    (tri[0]![0] + tri[1]![0] + tri[2]![0]) / 3,
    (tri[0]![1] + tri[1]![1] + tri[2]![1]) / 3,
  ];
  if (pointInPolygon(centroid, poly)) return true;
  for (const v of tri) if (pointInPolygon(v, poly)) return true;
  for (let i = 0; i < 3; i++) {
    const a = tri[i]!;
    const b = tri[(i + 1) % 3]!;
    for (let j = 0; j < poly.length; j++) {
      if (segmentsIntersect(a, b, poly[j]!, poly[(j + 1) % poly.length]!))
        return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Ear-clipping triangulation (simple polygons, no holes)              */
/* ------------------------------------------------------------------ */

function cross2(a: Point, b: Point, c: Point): number {
  return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
}

function pointInTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const d1 = cross2(p, a, b);
  const d2 = cross2(p, b, c);
  const d3 = cross2(p, c, a);
  const hasNeg = d1 < -1e-9 || d2 < -1e-9 || d3 < -1e-9;
  const hasPos = d1 > 1e-9 || d2 > 1e-9 || d3 > 1e-9;
  return !(hasNeg && hasPos);
}

/** Triangulate a simple polygon (3+ points, closing point optional).
 *  Returns triangles as [x, z] triples. Degenerate/collinear input is
 *  handled by dropping the flattest vertex when no ear can be found. */
function triangulatePolygon(input: Point[]): Point[][] {
  const pts = input.slice();
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (pts.length > 1 && first[0] === last[0] && first[1] === last[1]) {
    pts.pop();
  }
  // Drop duplicate consecutive points.
  const ring: Point[] = [];
  for (const p of pts) {
    const last = ring[ring.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) ring.push(p);
  }
  if (ring.length < 3) return [];
  // Normalise winding so triangle normals point UP (+y). Recast only
  // rasterizes triangles whose normal faces up (walkable-slope test),
  // and in the (x, z) plane a NEGATIVE shoelace area is what gives an
  // up normal: for (0,0),(0,1),(1,0) the cross product is (0,+1,0).
  // (Getting this backwards yields a valid-looking triangulation that
  // Recast rejects wholesale with "Failed to create Detour navmesh".)
  if (signedArea(ring) > 0) ring.reverse();

  const tris: Point[][] = [];
  const idx: number[] = ring.map((_, i) => i);
  // Wrapped vertex lookup: ring vertex at ring-index position i.
  const v = (i: number): Point =>
    ring[idx[((i % idx.length) + idx.length) % idx.length]!]!;
  let guard = 0;
  while (idx.length > 3) {
    if (guard++ > idx.length * idx.length + 16) break; // never loop forever
    let ear = -1;
    for (let i = 0; i < idx.length; i++) {
      const a = v(i - 1);
      const b = v(i);
      const c = v(i + 1);
      // Up-normal winding (see above): a convex vertex has cross2 < 0.
      if (cross2(a, b, c) >= -1e-9) continue; // reflex or collinear
      let blocked = false;
      for (let j = 0; j < idx.length; j++) {
        const k = idx[j]!;
        if (k === idx[((i - 1) % idx.length + idx.length) % idx.length] || k === idx[i] || k === idx[(i + 1) % idx.length]) continue;
        if (pointInTriangle(ring[k]!, a, b, c)) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        ear = i;
        break;
      }
    }
    if (ear === -1) {
      // No ear (collinear vertex somewhere): drop the flattest vertex.
      let flat = 0;
      let flatCross = Infinity;
      for (let i = 0; i < idx.length; i++) {
        const a = v(i - 1);
        const b = v(i);
        const c = v(i + 1);
        const cr = Math.abs(cross2(a, b, c));
        if (cr < flatCross) {
          flatCross = cr;
          flat = i;
        }
      }
      idx.splice(flat, 1);
      continue;
    }
    const a = v(ear - 1);
    const b = v(ear);
    const c = v(ear + 1);
    tris.push([a, b, c]);
    idx.splice(ear, 1);
  }
  if (idx.length === 3) tris.push([v(0), v(1), v(2)]);
  return tris;
}

/* ------------------------------------------------------------------ */
/* NavMesh construction                                                */
/* ------------------------------------------------------------------ */

/** Single Recast config shared by the runtime build and the offline bake
 *  (tools: `standalone/bake_navmesh.mts`) — the baked bytes and a runtime
 *  build must describe the same mesh, so there is exactly one config. */
const NAV_CONFIG = {
  cs: 0.5,
  ch: 0.2,
  walkableSlopeAngle: 45,
  walkableHeight: 10,
  walkableClimb: 2,
  walkableRadius: 1,
  maxEdgeLen: 12,
  maxSimplificationError: 1.3,
  minRegionArea: 8,
  mergeRegionArea: 20,
  maxVertsPerPoly: 6,
  detailSampleDist: 6,
  detailSampleMaxError: 1,
} as const;

/** PURE data step: triangulate the walkable polygons and drop every
 *  triangle that touches a building footprint. No Recast, no WASM —
 *  deterministic and Node-testable. Shared by the runtime build and
 *  the offline bake so both produce the same triangle soup. */
export function buildTriangleSoup(
  walkable: [number, number][][],
  obstacles: { footprint: [number, number][] }[],
): { positions: number[]; indices: number[]; triangleCount: number } {
  const positions: number[] = [];
  const indices: number[] = [];
  let triangleCount = 0;

  for (const poly of walkable) {
    if (poly.length < 3) continue;
    for (const tri of triangulatePolygon(poly)) {
      // Conservative obstacle rejection: no triangle may touch a
      // building footprint (see header note).
      let blocked = false;
      for (const o of obstacles) {
        if (o.footprint.length >= 3 && triangleTouchesPolygon(tri, o.footprint)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      const base = positions.length / 3;
      for (const [x, z] of tri) positions.push(x, 0, z);
      indices.push(base, base + 1, base + 2);
      triangleCount++;
    }
  }
  return { positions, indices, triangleCount };
}

export async function buildNavMesh(
  walkable: [number, number][][],
  // SliceBuilding[] is directly assignable here (structural typing:
  // only `footprint` is read); the caller passes city.buildings as-is.
  obstacles: { footprint: [number, number][] }[],
): Promise<NavMesh> {
  await init();

  const { positions, indices, triangleCount } = buildTriangleSoup(
    walkable,
    obstacles,
  );
  if (triangleCount === 0) {
    throw new Error(
      "buildNavMesh: no walkable triangles survived (empty walkable input, or obstacles cover everything)",
    );
  }

  const result = generateSoloNavMesh(positions, indices, NAV_CONFIG);
  if (!result.success || !result.navMesh) {
    throw new Error(`buildNavMesh: Recast failed: ${result.error}`);
  }

  return wrapNavMesh(result.navMesh);
}

/** Wrap a Recast navmesh in the slice NavMesh API and register its
 *  internals so `createCrowd` can find them. Shared by the runtime
 *  build and the pre-baked load. */
function wrapNavMesh(navMesh: RecastNavMesh): NavMesh {
  const query = new NavMeshQuery(navMesh);

  const api: NavMesh = {
    findPath(from: [number, number], to: [number, number]): [number, number][] {
      // Snap endpoints onto the mesh: callers (player position, task
      // targets) are often a few metres off the walkable strips — e.g.
      // standing mid-carriageway, 3-6 m from the nearest sidewalk.
      // The default 1 m half-extents would fail those lookups outright.
      const snap = { x: 10, y: 2, z: 10 };
      const start = query.findClosestPoint(
        { x: from[0], y: 0, z: from[1] },
        { halfExtents: snap },
      );
      const end = query.findClosestPoint(
        { x: to[0], y: 0, z: to[1] },
        { halfExtents: snap },
      );
      if (!start.success || !end.success) return [];
      const path = query.findPath(
        start.polyRef,
        end.polyRef,
        start.point,
        end.point,
      );
      if (!path.success) return [];
      try {
        const straight = query.findStraightPath(
          start.point,
          end.point,
          path.polys,
        );
        if (!straight.success || straight.straightPathCount === 0) return [];
        const out: [number, number][] = [];
        for (let i = 0; i < straight.straightPathCount; i++) {
          out.push([
            straight.straightPath.get(i * 3),
            straight.straightPath.get(i * 3 + 2),
          ]);
        }
        straight.straightPath.destroy();
        straight.straightPathFlags.destroy();
        straight.straightPathRefs.destroy();
        return out;
      } finally {
        path.polys.destroy();
      }
    },

    randomPointNear(
      x: number,
      z: number,
      radius: number,
    ): [number, number] | null {
      // The start-poly lookup uses halfExtents (default 1 m): without
      // an explicit box it fails whenever the centre is >1 m from any
      // walkable strip — which is the common case, not an edge case.
      const res = query.findRandomPointAroundCircle(
        { x, y: 0, z },
        radius,
        { halfExtents: { x: radius, y: 2, z: radius } },
      );
      if (!res.success) return null;
      return [res.randomPoint.x, res.randomPoint.z];
    },
  };

  internalsByNavMesh.set(api, { navMesh, query });
  return api;
}

/**
 * Offline bake: build the navmesh ONCE (same triangle soup, same
 * NAV_CONFIG as the runtime build) and return the serialized Detour
 * bytes. The runtime build takes 19–26 s at cs = 0.5 m — too slow for
 * a loading screen — so the slice ships the baked bytes
 * (`client/src/world2/data/navmesh.b64.ts`, produced by
 * `standalone/bake_navmesh.mts`) and loads them with `loadNavMesh`.
 * Deterministic: same slice data in → same bytes out.
 */
export async function bakeNavMeshData(
  walkable: [number, number][][],
  obstacles: { footprint: [number, number][] }[],
): Promise<Uint8Array> {
  await init();
  const { positions, indices, triangleCount } = buildTriangleSoup(
    walkable,
    obstacles,
  );
  if (triangleCount === 0) {
    throw new Error(
      "bakeNavMeshData: no walkable triangles survived (empty walkable input, or obstacles cover everything)",
    );
  }
  // Build the live mesh, then serialize with the library's own export.
  // (Do NOT use generateSoloNavMeshData here: its navMeshData is an
  // Emscripten UnsignedCharArray wrapper, not a JS TypedArray —
  // Uint8Array.from() on it silently yields 0 bytes.)
  const result = generateSoloNavMesh(positions, indices, NAV_CONFIG);
  if (!result.success || !result.navMesh) {
    throw new Error(`bakeNavMeshData: Recast failed: ${result.error}`);
  }
  return exportNavMesh(result.navMesh);
}

/** Load pre-baked navmesh bytes (see `bakeNavMeshData`). Fast — no
 *  rasterization, no 19–26 s build. The returned NavMesh is identical
 *  in API to a runtime-built one, including `createCrowd` support. */
export async function loadNavMesh(data: Uint8Array): Promise<NavMesh> {
  await init();
  const { navMesh } = importNavMesh(data);
  return wrapNavMesh(navMesh);
}

/** `loadNavMesh` for a base64 string (the form shipped in
 *  `client/src/world2/data/navmesh.b64.ts`). */
export async function loadNavMeshFromBase64(b64: string): Promise<NavMesh> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return loadNavMesh(bytes);
}

/* ------------------------------------------------------------------ */
/* Crowd                                                               */
/* ------------------------------------------------------------------ */

export interface Crowd {
  addAgent(x: number, z: number): number;
  goto(agentId: number, x: number, z: number): void;
  position(agentId: number): [number, number];
  update(dt: number): void;
}

/** Detour crowd agent parameters for a walking pedestrian. */
const AGENT_PARAMS = {
  radius: 0.35,
  height: 1.8,
  maxAcceleration: 8,
  maxSpeed: 1.4, // walking speed ~1.4 m/s
  collisionQueryRange: 2.5,
  separationWeight: 1,
};

export function createCrowd(nav: NavMesh, maxAgents: number): Crowd {
  const internals = internalsByNavMesh.get(nav);
  if (!internals) {
    throw new Error("createCrowd: NavMesh was not built by buildNavMesh");
  }
  const crowd = new RecastCrowd(internals.navMesh, {
    maxAgents,
    maxAgentRadius: 0.6,
  });

  return {
    addAgent(x: number, z: number): number {
      const agent = crowd.addAgent({ x, y: 0, z }, AGENT_PARAMS);
      return agent.agentIndex;
    },

    goto(agentId: number, x: number, z: number): void {
      const agent = crowd.getAgent(agentId);
      if (!agent) throw new Error(`goto: no crowd agent ${agentId}`);
      if (!agent.requestMoveTarget({ x, y: 0, z })) {
        // Target off the mesh (or on another island): snap to the
        // nearest navmesh point and retry once.
        const snapped = internals.query.findClosestPoint(
          { x, y: 0, z },
          { halfExtents: { x: 10, y: 2, z: 10 } },
        );
        if (snapped.success) {
          agent.requestMoveTarget(snapped.point);
        }
      }
    },

    position(agentId: number): [number, number] {
      const agent = crowd.getAgent(agentId);
      if (!agent) throw new Error(`position: no crowd agent ${agentId}`);
      const p = agent.position();
      return [p.x, p.z];
    },

    update(dt: number): void {
      crowd.update(dt);
    },
  };
}
