// Bay Area Life 2.0 — Stage 1 chunk streamer tests (2.0 module).
//
// These drive the REAL 2.0 streamer in `client/src/world2/render/streaming.ts`
// (32 m chunks, synchronous builds, 10g semantics: data/mesh split,
// nearest-first, 1-chunk hysteresis, 8 ms frame budget, ownership-based
// dispose, memory ledger, buildId guard) against the REAL slice data
// (`client/src/world2/data/slice-city.json`). The 1.0 ChunkManager
// (`client/src/chunks.ts`) is legacy and is NOT covered here anymore —
// its behaviour was tested by the earlier version of this file while the
// 2.0 streamer did not exist yet.
//
// Pure Node (three.js imports headless fine — no scene render, no DOM, no
// renderer). The fake build callback returns one small box mesh per chunk
// (tagged with userData.chunkKey) so the ledger counts real geometry
// bytes and the test can observe which chunks are in the scene.
//
// Run with: node client/src/world2/tests/run-tests.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import {
  CHUNK,
  FULL_KEEP_R,
  FULL_R,
  SIMPLE_KEEP_R,
  SIMPLE_R,
  STREET_FOG_FAR,
  ChunkLedger,
  chunkContent,
  chunkKeyOf,
  chunkKeysForBBox,
  contentKeysForCity,
  createChunkStreamer,
  groupGeometryBytes,
} from "../render/streaming";
import type { ChunkStreamer } from "../render/streaming";
import { buildingAreaM2 } from "../cityData";
import type { SliceCity } from "../cityData";

const CITY = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../data/slice-city.json"), "utf8"),
) as SliceCity;

/** Content keys as a set (only ~half the cells in the bbox hold a building). */
const CONTENT_KEYS = new Set(contentKeysForCity(CITY));
/** The content chunk nearest the origin — a known-good focus / guard key. */
function nearestContentKey(x: number, z: number): string {
  let best = "";
  let bestD = Infinity;
  for (const key of CONTENT_KEYS) {
    const [cx, cz] = key.split(",").map(Number);
    const d = Math.max(
      Math.abs((cx ?? 0) - Math.floor(x / CHUNK)),
      Math.abs((cz ?? 0) - Math.floor(z / CHUNK)),
    );
    if (d < bestD) {
      bestD = d;
      best = key;
    }
  }
  return best;
}
function chunkCenter(key: string): { x: number; z: number } {
  const [cx, cz] = key.split(",").map(Number);
  return { x: ((cx ?? 0) + 0.5) * CHUNK, z: ((cz ?? 0) + 0.5) * CHUNK };
}

/* ------------------------------------------------------------------ */
/* tiny harness (node:assert only, no framework)                      */
/* ------------------------------------------------------------------ */

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`ok ${passed + failed} - ${name}`);
  } catch (e) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`${name}: ${msg}`);
    console.log(`not ok ${passed + failed} - ${name}\n  ${msg}`);
  }
}

/* ------------------------------------------------------------------ */
/* fakes: one small box mesh per chunk, fresh geometry per build       */
/* (shared geometry would be disposed out from under other chunks)     */
/* ------------------------------------------------------------------ */

function fakeChunkGroup(key: string): THREE.Group {
  const group = new THREE.Group();
  group.userData.chunkKey = key;
  group.add(
    new THREE.Mesh(new THREE.BoxGeometry(4, 10, 4), new THREE.MeshBasicMaterial()),
  );
  return group;
}

/** The full (ready) group for `key`, if it is currently in the scene. */
function fullGroupInScene(scene: THREE.Scene, key: string): THREE.Group | undefined {
  return scene.children.find(
    (o) => (o as THREE.Group).userData?.chunkKey === key,
  ) as THREE.Group | undefined;
}

/** Sum of ledger-counted bytes for every group currently in the scene. */
function sceneGeometryBytes(scene: THREE.Scene): number {
  let n = 0;
  for (const child of scene.children) {
    n += groupGeometryBytes(child as THREE.Group);
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* 1. deterministic chunk keying                                       */
/* ------------------------------------------------------------------ */

test("chunkKeyOf is deterministic for a position", () => {
  for (const [x, z] of [
    [0, 0],
    [100, -50],
    [-33.5, 77.25],
    [CHUNK * 3 + 1, CHUNK * -2 - 1],
  ] as [number, number][]) {
    assert.equal(chunkKeyOf(x, z), chunkKeyOf(x, z), `key unstable at (${x}, ${z})`);
  }
});

test("chunkKeyOf puts either side of a chunk edge in different chunks (floor semantics)", () => {
  const edge = 2 * CHUNK;
  assert.notEqual(chunkKeyOf(edge - 0.001, 0), chunkKeyOf(edge + 0.001, 0));
  // Exactly on the edge belongs to the higher chunk (Math.floor).
  assert.equal(chunkKeyOf(edge, 0), chunkKeyOf(edge + 0.001, 0));
  // Negative coordinates floor, not truncate: -1 is chunk -1, not 0.
  assert.equal(chunkKeyOf(-1, 0), "-1,0");
  assert.equal(chunkKeyOf(-CHUNK, 0), "-1,0");
  assert.equal(chunkKeyOf(-CHUNK - 0.001, 0), "-2,0");
});

/* ------------------------------------------------------------------ */
/* 2. pure data step: chunkContent is deterministic, clips exactly     */
/* ------------------------------------------------------------------ */

test("chunkContent is deterministic and clips footprints without loss", () => {
  // 尚美科技大厦 (b533679872): the biggest clipped building — its
  // footprint is cut across 8 chunks, so the clipped areas must sum
  // back to the original footprint area.
  const target = CITY.buildings.find((b) => b.id === "b533679872");
  assert.ok(target, "enterable office b533679872 missing from slice data");
  const xs = target.footprint.map((p) => p[0]);
  const zs = target.footprint.map((p) => p[1]);
  const bb = {
    minX: Math.min(...xs),
    minZ: Math.min(...zs),
    maxX: Math.max(...xs),
    maxZ: Math.max(...zs),
  };
  const keys = chunkKeysForBBox(bb);
  assert.ok(keys.length >= 8, `expected >= 8 chunks for 尚美, got ${keys.length}`);
  let clippedTotal = 0;
  for (const key of keys) {
    const a = chunkContent(CITY, key);
    const b = chunkContent(CITY, key); // determinism: same key twice
    assert.deepEqual(
      a.buildings.map((x) => x.building.id).sort(),
      b.buildings.map((x) => x.building.id).sort(),
      `chunkContent non-deterministic for ${key}`,
    );
    for (const entry of a.buildings) {
      if (entry.building.id !== target.id) continue;
      clippedTotal += buildingAreaM2({
        ...entry.building,
        footprint: entry.footprint,
      });
    }
  }
  const original = buildingAreaM2(target);
  assert.ok(
    Math.abs(clippedTotal - original) < 0.01,
    `clipped areas sum ${clippedTotal.toFixed(2)} != original ${original.toFixed(2)}`,
  );
  console.log(`  尚美科技大厦: ${original.toFixed(1)} m² over ${keys.length} chunks, clipped sum exact`);
});

test("contentKeysForCity: 142 content chunks, sorted, unique, all non-empty", () => {
  const keys = contentKeysForCity(CITY);
  assert.equal(keys.length, 142, `expected 142 content chunks, got ${keys.length}`);
  assert.deepEqual(keys, [...keys].sort(), "keys not sorted");
  assert.equal(new Set(keys).size, keys.length, "duplicate keys");
  for (const key of keys) {
    assert.ok(
      chunkContent(CITY, key).buildings.length > 0,
      `content key ${key} has no buildings`,
    );
  }
});

/* ------------------------------------------------------------------ */
/* 3. ledger: track / release / leak detection                         */
/* ------------------------------------------------------------------ */

test("ChunkLedger: track/release moves geometryMB; unreferencedMB flags a leak", () => {
  const led = new ChunkLedger();
  led.track("0,0", 1024 * 1024);
  led.track("1,0", 512 * 1024);
  let s = led.stats(new Set(["0,0", "1,0"]));
  assert.equal(s.chunks, 2);
  assert.equal(s.geometryMB, 1.5);
  assert.equal(s.unreferencedMB, 0);
  // "1,0" is tracked but no longer held by the manager → leak signal.
  s = led.stats(new Set(["0,0"]));
  assert.equal(s.unreferencedMB, 0.5, "unreferencedMB must expose the 0.5 MB leak");
  led.release("1,0");
  s = led.stats(new Set(["0,0"]));
  assert.equal(s.geometryMB, 1);
  assert.equal(s.unreferencedMB, 0);
  led.clear();
  assert.equal(led.stats(new Set()).chunks, 0);
});

/* ------------------------------------------------------------------ */
/* 4. walk: one-way east leg — no duplicate builds, no holes           */
/*    then a full loop — no holes, ledger clean throughout             */
/* ------------------------------------------------------------------ */

test("walk: one-way leg has no duplicate builds and no holes; loop stays clean", () => {
  const scene = new THREE.Scene();
  const buildCounts = new Map<string, number>();
  const streamer: ChunkStreamer = createChunkStreamer(
    scene,
    CITY,
    (key: string) => {
      buildCounts.set(key, (buildCounts.get(key) ?? 0) + 1);
      return fakeChunkGroup(key);
    },
    { frameBudgetMs: 1000 }, // drain fully each update in the test
  );
  let holes = 0;
  let steps = 0;
  const checkFocus = (x: number, z: number): void => {
    steps++;
    streamer.update({ x, z });
    // No hole means: IF the focus cell holds a building, its full group
    // must be in the scene. Empty cells (~half the bbox) are not content
    // chunks and are never built — they are not holes.
    const focusKey = chunkKeyOf(x, z);
    if (CONTENT_KEYS.has(focusKey) && !fullGroupInScene(scene, focusKey)) holes++;
    assert.equal(streamer.ledgerStats().unreferencedMB, 0, `step ${steps}: ledger leak`);
  };

  // Leg 1 (one-way east along z=0, -240 → 280): no chunk may be
  // full-built twice — each key enters the full ring once.
  for (let x = -240; x <= 280; x += 8) checkFocus(x, 0);
  let maxBuilds = 0;
  let totalBuilds = 0;
  for (const [key, n] of buildCounts) {
    maxBuilds = Math.max(maxBuilds, n);
    totalBuilds += n;
    assert.ok(n <= 1, `chunk ${key} built ${n} times on a one-way leg (duplicate build)`);
  }
  assert.equal(holes, 0, `${holes} focus positions had no ready full chunk on leg 1`);

  // Legs 2-4: loop south → west → north → east again. Rebuilds on
  // revisit are legitimate, so only no-holes + ledger-clean are
  // asserted here.
  for (let z = 8; z <= 280; z += 8) checkFocus(280, z);
  for (let x = 272; x >= -240; x -= 8) checkFocus(x, 280);
  for (let z = 272; z >= 0; z -= 8) checkFocus(-240, z);
  for (let x = -232; x <= 280; x += 8) checkFocus(x, 0);
  assert.equal(holes, 0, `${holes}/${steps} focus positions had no ready full chunk (holes)`);
  assert.equal(streamer.ledgerStats().unreferencedMB, 0);
  assert.ok(streamer.ledgerStats().geometryMB > 0, "ledger should hold geometry at the end");
  console.log(
    `  walk: ${steps} updates, ${totalBuilds} full builds on leg 1 over ${buildCounts.size} distinct chunks ` +
      `(max per chunk on leg 1: ${maxBuilds}), focus chunk ready at every step`,
  );
  streamer.dispose();
});

/* ------------------------------------------------------------------ */
/* 5. buildId guard: a build invalidated mid-build is dropped          */
/* ------------------------------------------------------------------ */

test("buildId guard: a chunk unloaded mid-build never lands in the scene", () => {
  const scene = new THREE.Scene();
  const holder: { s?: ChunkStreamer } = {};
  const guardKey = nearestContentKey(0, 0);
  const guardFocus = chunkCenter(guardKey);
  let guardFired = false;
  let firstGroup: THREE.Group | null = null;
  let buildsOfKey = 0;
  const streamer = createChunkStreamer(
    scene,
    CITY,
    (key: string) => {
      const group = fakeChunkGroup(key);
      if (key === guardKey && !guardFired) {
        // Invalidate this very build while it is in flight: unload the
        // record (which bumps the buildId when it is re-queued).
        guardFired = true;
        buildsOfKey++;
        firstGroup = group;
        holder.s!.refreshKeys([guardKey]);
      } else if (key === guardKey) {
        buildsOfKey++;
      }
      return group;
    },
    { frameBudgetMs: 1000 },
  );
  holder.s = streamer;

  streamer.buildNow(guardKey);
  assert.ok(guardFired, "guard path never triggered");
  // (Read through a fresh binding: TS's control flow cannot see the
  // assignment inside the buildChunk callback, so it narrows firstGroup
  // to null and assert.ok would narrow it to never. The `as` keeps the
  // declared union type instead of the narrowed null.)
  const staleGroup = firstGroup as THREE.Group | null;
  assert.ok(staleGroup, "first build group missing");
  // The stale build was disposed, never added to the scene.
  assert.equal(staleGroup.parent, null, "stale build group must not be in the scene");
  assert.equal(
    fullGroupInScene(scene, guardKey),
    undefined,
    "stale build must not leave a group in the scene",
  );
  // The re-queued record builds fresh on the next update.
  streamer.update(guardFocus);
  assert.equal(buildsOfKey, 2, `expected 2 builds of ${guardKey} (stale + fresh), got ${buildsOfKey}`);
  const fresh = fullGroupInScene(scene, guardKey);
  assert.ok(fresh, "fresh build of the key never landed");
  assert.notEqual(fresh, firstGroup, "the group in the scene must be the fresh build, not the stale one");
  // Ledger counts exactly what is in the scene — no double count.
  const sceneBytes = sceneGeometryBytes(scene);
  const ledgerMB = streamer.ledgerStats().geometryMB;
  assert.ok(
    Math.abs(ledgerMB * 1048576 - sceneBytes) < 1,
    `ledger ${ledgerMB} MB != scene bytes ${sceneBytes}`,
  );
  assert.equal(streamer.ledgerStats().unreferencedMB, 0);
  streamer.dispose();
});

/* ------------------------------------------------------------------ */
/* 6. map mode: loadAll loads every content chunk; back to street      */
/*    unloads the far ones, ledger clean                               */
/* ------------------------------------------------------------------ */

test("map mode: loadAll loads all 142 content chunks; street mode unloads far ones", () => {
  const scene = new THREE.Scene();
  const streamer = createChunkStreamer(scene, CITY, fakeChunkGroup, {
    frameBudgetMs: 1000,
  });
  const focusKey = nearestContentKey(0, 0);
  const focus = chunkCenter(focusKey);
  streamer.setMode("map");
  streamer.update(focus);
  const mapStats = streamer.stats();
  assert.equal(mapStats.loaded, 142, `expected 142 loaded in map mode, got ${mapStats.loaded}`);
  assert.equal(mapStats.total, 142);
  assert.equal(streamer.ledgerStats().unreferencedMB, 0);
  const mapMB = streamer.ledgerStats().geometryMB;
  assert.ok(mapMB > 0, "map mode should hold geometry");

  streamer.setMode("street");
  streamer.update(focus);
  const streetStats = streamer.stats();
  // Hysteresis: after a mode switch the focus does not move, so chunks
  // inside the KEEP ring (FULL_KEEP_R = 2 → at most the 5x5 = 25 cells)
  // stay full; they only downgrade once the player walks away past it.
  assert.ok(
    streetStats.loaded <= 25,
    `street mode should hold at most the 5x5 keep ring, got ${streetStats.loaded}`,
  );
  assert.ok(fullGroupInScene(scene, focusKey), "focus chunk must stay loaded in street mode");
  assert.ok(
    streamer.ledgerStats().geometryMB < mapMB,
    `street geometry ${streamer.ledgerStats().geometryMB} MB did not drop below map ${mapMB} MB`,
  );
  // Walk 10 chunks east: the old window is beyond SIMPLE_KEEP_R and
  // unloads, leaving only the 3x3 enter ring around the new focus.
  const farFocus = { x: focus.x + 10 * CHUNK, z: focus.z };
  streamer.update(farFocus);
  const movedStats = streamer.stats();
  assert.ok(
    movedStats.loaded <= 9,
    `after walking away, street mode should hold at most the 3x3 enter ring, got ${movedStats.loaded}`,
  );
  assert.ok(
    fullGroupInScene(scene, chunkKeyOf(farFocus.x, farFocus.z)) ||
      !CONTENT_KEYS.has(chunkKeyOf(farFocus.x, farFocus.z)),
    "new focus chunk must be loaded if it holds a building",
  );
  assert.equal(streamer.ledgerStats().unreferencedMB, 0);
  streamer.dispose();
  assert.equal(scene.children.length, 0, "dispose must empty the scene");
  assert.equal(streamer.ledgerStats().geometryMB, 0, "dispose must clear the ledger");
});

test("radii sanity: full ring inside simple ring inside keep rings; fog inside full ring", () => {
  assert.ok(FULL_R <= SIMPLE_R, `FULL_R ${FULL_R} > SIMPLE_R ${SIMPLE_R}`);
  assert.ok(FULL_R < FULL_KEEP_R, "no hysteresis on the full ring");
  assert.ok(SIMPLE_R < SIMPLE_KEEP_R, "no hysteresis on the simple ring");
  assert.ok(
    STREET_FOG_FAR <= (FULL_R + 1) * CHUNK,
    `street fog far ${STREET_FOG_FAR} exceeds the full-detail ring ${(FULL_R + 1) * CHUNK}`,
  );
  console.log(
    `  CHUNK=${CHUNK} FULL_R=${FULL_R} FULL_KEEP_R=${FULL_KEEP_R} SIMPLE_R=${SIMPLE_R} SIMPLE_KEEP_R=${SIMPLE_KEEP_R} FOG_FAR=${STREET_FOG_FAR}`,
  );
});

/* ------------------------------------------------------------------ */

console.log(`\nstreaming: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("FAILURES:");
  for (const f of failures) console.log(` - ${f}`);
  process.exitCode = 1;
}
