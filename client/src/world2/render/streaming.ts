// Bay Area Life 2.0 — renderer: meter-based chunk streamer (32 m chunks).
//
// Semantics copied from the 10g ChunkManager (`client/src/chunks.ts`):
//   * Data/mesh split — `chunkContent(city, key)` is PURE data (which
//     buildings belong to a chunk, footprints clipped to the chunk rect);
//     `buildChunk` turns that into THREE objects. No THREE objects in the
//     data step, so the content step is deterministic and Node-testable.
//   * Load nearest-first, FULL / SIMPLE tiers with exactly 1-chunk
//     hysteresis on the keep radius (standing on a boundary must not flip
//     a chunk every frame).
//   * Per-frame 8 ms budget (`processQueue` stops when the budget is spent;
//     a single dense build may exceed it on its own — the loop just stops
//     after it instead of starting another, same as 10g).
//   * Ownership-based dispose: only per-chunk owned geometries are freed;
//     shared materials/textures are NEVER disposed. The memory ledger
//     (`geometryMB` / `unreferencedMB`) must keep `unreferencedMB` at 0 —
//     any non-zero value is a leak.
//   * A monotonic `buildId` per record guards against stale builds: a
//     result is only added to the scene when its record still exists with
//     the same buildId.
//
// Radii, re-derived for 32 m chunks (10g used 16 m chunks, FULL_R = 2):
//   * Street fog far is 42 m. A player standing on a chunk corner only sees
//     (FULL_R + 1) * CHUNK of loaded city ahead, so FULL_R = 1 covers
//     64 m > 42 m (10g's argument at 16 m: r = 2 covered 48 m > 42 m).
//   * FULL_KEEP_R = FULL_R + 1 = 2, SIMPLE_R = 2, SIMPLE_KEEP_R = 3 —
//     hysteresis exactly 1 chunk, as in 10g. The simple ring (32-96 m from
//     the player) shows as box silhouettes through the fog's outer band,
//     exactly like 10g's distance-3 ring at 16 m chunks.
//   * Asserted in the constructor, same as chunks.ts:1299.
//
// WORKER DECISION — synchronous builds, no Vite worker (documented choice):
//   * 10g needed a worker because its payloads are big merged city geometry
//     built from a whole-city landmark factory. Here `buildChunk` is
//     caller-supplied and may return arbitrary THREE.Groups, which are not
//     serializable payloads — a worker cannot host it without a payload
//     protocol the slice does not have yet.
//   * Chunk builds here are small: one 32 m chunk holds a handful of
//     buildings (median slice chunk: 1-2 buildings), and the Node smoke
//     test measures the real cost. As long as a build stays inside the 8 ms
//     frame budget, the worker round-trip + structured clone would cost
//     MORE than the build itself.
//   * Trigger to add a worker (Stage 2): median chunk build > 8 ms, or a
//     visible hitch on boundary crossings. Then port the 10g pattern —
//     `chunk.worker.ts` builds a serializable payload from the pure
//     `chunkContent` step, the main thread materializes it inside the
//     budget — the data/mesh split in this file is already shaped for it.
//   * Street mode shows only chunks near the focus; map mode loads all
//     content chunks. NOTE for map mode: `loadAll()` is correct but costs
//     ~5 draw calls per content chunk; for the 500 m slice the harness
//     should prefer one merged `buildBuildings(city, materials)` group
//     (~8 draw calls for every building) and only use the streamer for
//     street mode. Both paths are valid; the streamer does not care.
//
// Chunk assignment: a building belongs to EVERY chunk its footprint bbox
// intersects, and its footprint is clipped to the chunk rect (see
// `clipBuildingToRect` in buildings.ts) — so a 200 m podium renders as
// continuous walls across chunks, with no gap and no duplicate geometry.
// Door / balcony / roof props are built only in the chunk holding their
// anchor point (`propRect`), so they are never duplicated.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  clipBuildingToRect,
  footprintBBox,
  type BBox,
  type SliceBuilding,
  type SliceCity,
} from "./buildings";

/** Render chunk edge, in meters. */
export const CHUNK = 32;
/** Full-detail ring: enter at FULL_R, stay until FULL_KEEP_R (Chebyshev chunk distance). */
export const FULL_R = 1;
export const FULL_KEEP_R = 2;
/** Simple (silhouette) ring: enter at SIMPLE_R, stay until SIMPLE_KEEP_R. */
export const SIMPLE_R = 2;
export const SIMPLE_KEEP_R = 3;
/** Street fog far end (m). Hard invariant: inside the full-detail ring. */
export const STREET_FOG_FAR = 42;
/** Per-frame time budget for chunk work (10g `frameBudgetMs`). */
export const FRAME_BUDGET_MS = 8;
/** Desktop geometry budget for the ledger (10g `CHUNK_MEMORY_BUDGETS`). */
export const GEOMETRY_BUDGET_MB = 256;

export const chunkKeyOf = (x: number, z: number): string =>
  `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
export const chunkKeyOfCell = (cx: number, cz: number): string => `${cx},${cz}`;
export function chunkRectOf(key: string): BBox {
  const [cx, cz] = key.split(",").map(Number);
  const x = cx ?? 0;
  const z = cz ?? 0;
  return { minX: x * CHUNK, minZ: z * CHUNK, maxX: (x + 1) * CHUNK, maxZ: (z + 1) * CHUNK };
}
export function chunkKeysForBBox(bb: BBox): string[] {
  const keys: string[] = [];
  const cx0 = Math.floor(bb.minX / CHUNK);
  const cx1 = Math.floor(bb.maxX / CHUNK);
  const cz0 = Math.floor(bb.minZ / CHUNK);
  const cz1 = Math.floor(bb.maxZ / CHUNK);
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cz = cz0; cz <= cz1; cz++) keys.push(chunkKeyOfCell(cx, cz));
  }
  return keys;
}

/**
 * All content chunks: chunks where at least one building's CLIPPED
 * footprint has area (>= 0.5 m^2 — the same threshold `clipBuildingToRect`
 * uses). Derived from the actual clip, not just the bbox, so a chunk that
 * only touches a bbox corner with a sub-0.5 m^2 sliver is NOT a content
 * chunk — content keys and `chunkContent` can never disagree.
 */
export function contentKeysForCity(city: SliceCity): string[] {
  const set = new Set<string>();
  for (const b of city.buildings) {
    if (b.footprint.length < 3) continue;
    for (const k of chunkKeysForBBox(footprintBBox(b.footprint))) {
      if (clipBuildingToRect(b, chunkRectOf(k))) set.add(k);
    }
  }
  return [...set].sort();
}

export interface ChunkBuilding {
  building: SliceBuilding;
  /** Footprint clipped to the chunk rect (== the original when fully inside). */
  footprint: [number, number][];
}

/** PURE data step: which buildings (clipped) belong to one chunk. No THREE. */
export function chunkContent(city: SliceCity, key: string): { buildings: ChunkBuilding[] } {
  const rect = chunkRectOf(key);
  const buildings: ChunkBuilding[] = [];
  for (const b of city.buildings) {
    if (b.footprint.length < 3) continue;
    const clipped = clipBuildingToRect(b, rect);
    if (clipped) buildings.push({ building: b, footprint: clipped.footprint });
  }
  return { buildings };
}

/* ---- memory ledger (10g ChunkLedger semantics) ---- */

/** GPU-side geometry bytes held by a group (attributes + instance buffers). */
export function groupGeometryBytes(
  group: THREE.Group,
  sharedGeos?: ReadonlySet<THREE.BufferGeometry>,
): number {
  let n = 0;
  group.traverse((o) => {
    if ((o as THREE.Sprite).isSprite) return;
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    if (sharedGeos?.has(m.geometry)) return; // counted once, not per chunk
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

/** Every chunk's geometry bytes, accounted at build and released at unload. */
export class ChunkLedger {
  private bytes = new Map<string, number>();
  track(key: string, n: number): void {
    this.bytes.set(key, n);
  }
  release(key: string): void {
    this.bytes.delete(key);
  }
  clear(): void {
    this.bytes.clear();
  }
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

/* ---- streamer ---- */

export type ChunkState = "queued" | "generating" | "ready";
export type ChunkDetail = "full" | "simple";
export interface ChunkRecord {
  key: string;
  cx: number;
  cz: number;
  state: ChunkState;
  detail: ChunkDetail;
  buildId: number;
  group: THREE.Group | null;
  simpleGroup: THREE.Group | null;
}

export type BuildChunkFn = (key: string) => THREE.Group;
export type BuildSimpleFn = (key: string) => THREE.Group | null;

export interface ChunkStreamerOpts {
  /** Per-frame budget in ms (default 8). */
  frameBudgetMs?: number;
  /** Custom silhouette builder; defaults to merged boxes per building. */
  buildSimpleChunk?: BuildSimpleFn;
  /** Geometries shared across chunks (never disposed, never ledger-counted). */
  sharedGeometries?: ReadonlySet<THREE.BufferGeometry>;
}

export interface ChunkStreamer {
  readonly mode: "street" | "map";
  setMode(mode: "street" | "map"): void;
  /** Street-mode sync at the focus; also runs the frame budget. */
  update(focus: { x: number; z: number }): void;
  /** Build one chunk synchronously now (first paint must never be empty). */
  buildNow(key: string): boolean;
  /** Unload + re-sync the given chunks (city data changed under them). */
  refreshKeys(keys: string[]): void;
  stats(): { loaded: number; simple: number; queued: number; inFlight: number; pending: number; total: number };
  ledgerStats(): { chunks: number; geometryMB: number; unreferencedMB: number; budgetMB: number };
  dispose(): void;
}

export function createChunkStreamer(
  scene: THREE.Scene,
  city: SliceCity,
  buildChunk: BuildChunkFn,
  opts: ChunkStreamerOpts = {},
): ChunkStreamer {
  // Hard invariant (10g, chunks.ts:1299): the street fog far end must stay
  // inside the full-detail ring, or chunk pop-in shows past the fog.
  console.assert(
    STREET_FOG_FAR <= (FULL_R + 1) * CHUNK,
    "[world2/streaming] street fog far exceeds full-detail ring — raise FULL_R",
  );

  const frameBudgetMs = opts.frameBudgetMs ?? FRAME_BUDGET_MS;
  const contentKeys = contentKeysForCity(city);
  const contentSet = new Set(contentKeys);
  const records = new Map<string, ChunkRecord>();
  const queue: string[] = [];
  const ledger = new ChunkLedger();
  let nextBuildId = 1;
  let mode: "street" | "map" = "street";
  let lastFocus = { x: 0, z: 0 };
  let disposed = false;

  // Default silhouette material: one shared matte material for every
  // simple-tier chunk (owned by the streamer, never disposed per chunk).
  const silhouetteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.9,
    flatShading: true,
  });

  function newRecord(key: string): ChunkRecord {
    const [cx, cz] = key.split(",").map(Number);
    return {
      key,
      cx: cx ?? 0,
      cz: cz ?? 0,
      state: "queued",
      detail: "full",
      buildId: nextBuildId++,
      group: null,
      simpleGroup: null,
    };
  }

  function disposeGroup(group: THREE.Group | null): void {
    if (!group) return;
    group.traverse((o) => {
      if ((o as THREE.Sprite).isSprite) return;
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry && !opts.sharedGeometries?.has(m.geometry)) {
        m.geometry.dispose();
      }
    });
    group.removeFromParent();
  }

  function unloadRecord(rec: ChunkRecord): void {
    disposeGroup(rec.group);
    disposeGroup(rec.simpleGroup);
    rec.group = null;
    rec.simpleGroup = null;
    ledger.release(rec.key);
    const qi = queue.indexOf(rec.key);
    if (qi >= 0) queue.splice(qi, 1);
    records.delete(rec.key);
  }

  /** Default simple tier: one merged box mass per building in the chunk. */
  function buildDefaultSimple(key: string): THREE.Group | null {
    const content = chunkContent(city, key);
    if (content.buildings.length === 0) return null;
    const geos: THREE.BufferGeometry[] = [];
    for (const { building, footprint } of content.buildings) {
      const bb = footprintBBox(footprint);
      const w = Math.max(1, bb.maxX - bb.minX);
      const d = Math.max(1, bb.maxZ - bb.minZ);
      const h = Math.max(3, building.height);
      const geo = new THREE.BoxGeometry(w, h, d);
      const n = geo.attributes.position!.count;
      const arr = new Float32Array(n * 3);
      const c = new THREE.Color(0x8a8d90);
      for (let i = 0; i < n; i++) {
        arr[i * 3] = c.r;
        arr[i * 3 + 1] = c.g;
        arr[i * 3 + 2] = c.b;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
      geo.translate((bb.minX + bb.maxX) / 2, h / 2, (bb.minZ + bb.maxZ) / 2);
      geos.push(geo.index ? geo.toNonIndexed() : geo);
    }
    const merged = mergeGeometries(geos, false);
    if (!merged) return null;
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(merged, silhouetteMat);
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    return group;
  }

  function buildSimpleRecord(key: string): void {
    if (records.has(key)) return;
    const rec = newRecord(key);
    rec.detail = "simple";
    const group = opts.buildSimpleChunk ? opts.buildSimpleChunk(key) : buildDefaultSimple(key);
    if (!group) return;
    rec.simpleGroup = group;
    rec.state = "ready";
    records.set(key, rec);
    scene.add(group);
    ledger.track(key, groupGeometryBytes(group, opts.sharedGeometries));
  }

  function downgradeRecord(rec: ChunkRecord): void {
    // Full -> simple in the same tick: the silhouette stands up before the
    // full group comes down, so the chunk never shows a hole.
    const simple = opts.buildSimpleChunk ? opts.buildSimpleChunk(rec.key) : buildDefaultSimple(rec.key);
    if (!simple) {
      unloadRecord(rec);
      return;
    }
    disposeGroup(rec.group);
    rec.group = null;
    rec.simpleGroup = simple;
    rec.detail = "simple";
    scene.add(simple);
    ledger.track(rec.key, groupGeometryBytes(simple, opts.sharedGeometries));
  }

  function upgradeRecord(rec: ChunkRecord): void {
    // Simple -> full: keep the silhouette as a placeholder until the full
    // build lands (the build is synchronous, so this is the same tick —
    // the placeholder only matters if the queue is budget-starved).
    rec.detail = "full";
    rec.buildId = nextBuildId++;
    rec.state = "queued";
    if (!queue.includes(rec.key)) queue.push(rec.key);
  }

  function buildRecord(rec: ChunkRecord): void {
    const qi = queue.indexOf(rec.key);
    if (qi >= 0) queue.splice(qi, 1);
    rec.state = "generating";
    const buildId = rec.buildId;
    const group = buildChunk(rec.key);
    // buildId guard: the record may have been unloaded while queued (mode
    // switch, refreshKeys) — a stale build is dropped, never added.
    const live = records.get(rec.key);
    if (!live || live.buildId !== buildId) {
      disposeGroup(group);
      return;
    }
    if (live.simpleGroup) {
      disposeGroup(live.simpleGroup);
      live.simpleGroup = null;
    }
    live.group = group;
    live.detail = "full";
    live.state = "ready";
    scene.add(group);
    ledger.track(rec.key, groupGeometryBytes(group, opts.sharedGeometries));
  }

  function cheb(key: string, pcx: number, pcz: number): number {
    const [cx, cz] = key.split(",").map(Number);
    return Math.max(Math.abs((cx ?? 0) - pcx), Math.abs((cz ?? 0) - pcz));
  }

  function dist2(key: string, px: number, pz: number): number {
    const [cx, cz] = key.split(",").map(Number);
    const mx = ((cx ?? 0) + 0.5) * CHUNK;
    const mz = ((cz ?? 0) + 0.5) * CHUNK;
    const dx = mx - px;
    const dz = mz - pz;
    return dx * dx + dz * dz;
  }

  function syncStreet(px: number, pz: number): void {
    const pcx = Math.floor(px / CHUNK);
    const pcz = Math.floor(pz / CHUNK);
    const d = (key: string) => cheb(key, pcx, pcz);
    for (const rec of [...records.values()]) {
      const dist = d(rec.key);
      if (rec.state === "ready" && rec.detail === "full") {
        if (dist > FULL_KEEP_R) {
          if (dist <= SIMPLE_KEEP_R) downgradeRecord(rec);
          else unloadRecord(rec);
        }
      } else if (rec.state === "ready" && rec.detail === "simple") {
        if (dist <= FULL_R) upgradeRecord(rec);
        else if (dist > SIMPLE_KEEP_R) unloadRecord(rec);
      }
      // Queued / generating records ride out their build; the buildId
      // guard drops the result if the record moved on.
    }
    for (const key of contentKeys) {
      if (records.has(key)) continue;
      const dist = d(key);
      if (dist <= FULL_R) {
        records.set(key, newRecord(key));
        queue.push(key);
      } else if (dist <= SIMPLE_R) {
        buildSimpleRecord(key);
      }
    }
    queue.sort((a, b) => dist2(a, px, pz) - dist2(b, px, pz));
  }

  function loadAll(): void {
    for (const key of contentKeys) {
      if (records.has(key)) {
        const rec = records.get(key)!;
        if (rec.state === "ready" && rec.detail === "simple") upgradeRecord(rec);
        continue;
      }
      records.set(key, newRecord(key));
      queue.push(key);
    }
    queue.sort((a, b) => dist2(a, lastFocus.x, lastFocus.z) - dist2(b, lastFocus.x, lastFocus.z));
  }

  function processQueue(budgetMs: number): number {
    const t0 = performance.now();
    let done = 0;
    while (queue.length > 0) {
      if (performance.now() - t0 >= budgetMs) break;
      const key = queue[0]!;
      const rec = records.get(key);
      if (!rec || rec.state !== "queued") {
        queue.shift();
        continue;
      }
      queue.shift();
      buildRecord(rec);
      done++;
      if (performance.now() - t0 >= budgetMs) break;
    }
    return done;
  }

  function buildNow(key: string): boolean {
    if (!contentSet.has(key)) return false;
    let rec = records.get(key);
    if (rec?.state === "ready" && rec.detail === "full") return true;
    if (rec?.state === "generating") return true;
    if (rec?.state === "ready" && rec.detail === "simple") {
      disposeGroup(rec.simpleGroup);
      rec.simpleGroup = null;
      rec.detail = "full";
    }
    if (!rec) {
      rec = newRecord(key);
      records.set(key, rec);
    }
    buildRecord(rec);
    return true;
  }

  const api: ChunkStreamer = {
    get mode() {
      return mode;
    },
    setMode(m: "street" | "map"): void {
      if (m === mode) return;
      mode = m;
      if (m === "map") loadAll();
      else syncStreet(lastFocus.x, lastFocus.z);
    },
    update(focus: { x: number; z: number }): void {
      if (disposed) return;
      lastFocus = focus;
      if (mode === "street") syncStreet(focus.x, focus.z);
      processQueue(frameBudgetMs);
    },
    buildNow,
    refreshKeys(keys: string[]): void {
      for (const key of keys) {
        const rec = records.get(key);
        if (rec) unloadRecord(rec);
      }
      if (mode === "street") syncStreet(lastFocus.x, lastFocus.z);
      else loadAll();
    },
    stats(): { loaded: number; simple: number; queued: number; inFlight: number; pending: number; total: number } {
      let loaded = 0;
      let simple = 0;
      let inFlight = 0;
      for (const rec of records.values()) {
        if (rec.state === "ready" && rec.detail === "full") loaded++;
        else if (rec.state === "ready" && rec.detail === "simple") simple++;
        else if (rec.state === "generating") inFlight++;
      }
      return { loaded, simple, queued: queue.length, inFlight, pending: 0, total: contentKeys.length };
    },
    ledgerStats(): { chunks: number; geometryMB: number; unreferencedMB: number; budgetMB: number } {
      const s = ledger.stats(new Set(records.keys()));
      return { ...s, budgetMB: GEOMETRY_BUDGET_MB };
    },
    dispose(): void {
      disposed = true;
      for (const rec of [...records.values()]) unloadRecord(rec);
      queue.length = 0;
      ledger.clear();
      silhouetteMat.dispose();
    },
  };
  return api;
}
