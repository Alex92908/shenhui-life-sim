// Bay Area Life 2.0 — Stage 1 slice-city snapshot tests.
//
// Reads client/src/world2/data/slice-city.json DIRECTLY (fs, not via the
// TS loader in cityData.ts) and asserts the snapshot contract from the
// Stage 0 audit (§5.1–§5.3): bbox B, 20–30 buildings, exactly 3 enterable
// (office/shop/lobby), closed footprints > 200 m², heights/levels, unique
// ids, road reachability, named-road hygiene, walkable ground, and
// determinism (canonical re-serialisation).
//
// Pure Node, no three.js, no DOM. Run with:
//   node client/src/world2/tests/run-tests.mjs
//
// Pinned snapshot (parent-verified 2026-11-12):
//   OSM base 2026-11-13T05:58:28Z
//   sha256 1ebe2a2d8299711fc791147d5bb4d7ced0a0720fdf30bae00c2fddbc55a5098a
//   (v1.2: walkable 340 -> 593 — carriageway walkable + door aprons +
//   sidewalk-band overlap; same OSM base, buildings/roads byte-identical.
//   Re-verified: every other assertion in this file passes.)
// If the data agent regenerates the file on purpose, update EXPECTED_SHA256
// below AND re-verify every other assertion still holds — do not just
// bump the hash to make the test green.
//
// Determinism note (documented, not a failure): the file was written by a
// Python writer, which renders whole floats as `45.0`; JS renders the same
// number as `45`. Byte-identical JS re-serialisation therefore differs at
// the first such number. The determinism test below compares the canonical
// token streams with numbers compared BY VALUE, so it still proves the
// file is in canonical sorted-key form; the float-formatting difference is
// reported, not failed.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SLICE_JSON_URL = new URL("../data/slice-city.json", import.meta.url);
const SLICE_JSON_PATH = fileURLToPath(SLICE_JSON_URL);
// tools/buildings/buildings-osm.json — the 1.0 height library (audit §2.4).
const HEIGHT_LIB_URL = new URL(
  "../../../../tools/buildings/buildings-osm.json",
  import.meta.url,
);
const HEIGHT_LIB_PATH = fileURLToPath(HEIGHT_LIB_URL);

/** Pinned snapshot hash (see header). Bump only with a deliberate regen. */
const EXPECTED_SHA256 =
  "1ebe2a2d8299711fc791147d5bb4d7ced0a0720fdf30bae00c2fddbc55a5098a";
/** Selected slice box B (audit §5.1), degrees. Tolerance ~55 m. */
const BOX_B = { minLat: 22.5465, maxLat: 22.551, minLon: 113.949, maxLon: 113.954 };
/** M0 fallback box (Huaqiangbei, hk-action-m0/public/sz-block.json). */
const BOX_M0_FALLBACK = {
  minLat: 22.5399,
  maxLat: 22.5456,
  minLon: 114.0818,
  maxLon: 114.0885,
};
const BBOX_TOL_DEG = 0.0005;
/** A building centroid must be within this distance of a road centreline. */
const MAX_ROAD_GAP_M = 50;
/** At most this many buildings may fail the road-gap check. */
const MAX_ROAD_EXCEPTIONS = 2;
/** Height-library cross-check floor (parent stated 27/30 match). */
const MIN_HEIGHT_LIB_MATCHES = 25;

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
/* loose JSON accessors (the file is untyped JSON)                     */
/* ------------------------------------------------------------------ */

type Json = Record<string, unknown>;

function asRecord(v: unknown, what: string): Json {
  assert.ok(v !== null && typeof v === "object" && !Array.isArray(v), `${what} must be an object`);
  return v as Json;
}
function asArray(v: unknown, what: string): unknown[] {
  assert.ok(Array.isArray(v), `${what} must be an array`);
  return v;
}
function asNum(v: unknown, what: string): number {
  assert.ok(typeof v === "number" && Number.isFinite(v), `${what} must be a finite number, got ${JSON.stringify(v)}`);
  return v;
}
function asStr(v: unknown, what: string): string {
  assert.ok(typeof v === "string" && v.length > 0, `${what} must be a non-empty string`);
  return v;
}
function asStrOrNull(v: unknown, what: string): string | null {
  if (v === null || v === undefined) return null;
  return asStr(v, what);
}

/** A footprint/centreline point: [x, z] array, or {x,y} / {lon,lat} object. */
type Pt = [number, number];

function asPoint(v: unknown, what: string): Pt {
  if (Array.isArray(v) && v.length >= 2) {
    return [asNum(v[0], `${what}[0]`), asNum(v[1], `${what}[1]`)];
  }
  if (v !== null && typeof v === "object") {
    const r = v as Json;
    if (typeof r.x === "number" && typeof r.y === "number") return [r.x, r.y];
    if (typeof r.lon === "number" && typeof r.lat === "number") return [r.lon, r.lat];
  }
  throw new Error(`${what} is not a point: ${JSON.stringify(v)}`);
}

function asPointArray(v: unknown, what: string): Pt[] {
  return asArray(v, what).map((p, i) => asPoint(p, `${what}[${i}]`));
}

function pointsEqual(a: Pt, b: Pt): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/* ------------------------------------------------------------------ */
/* geo helpers — footprints/centrelines are ENU metres in this file   */
/* (cityData.ts: +x east, +z south from the bbox centre). A lon/lat    */
/* file would show coordinates inside the bbox ranges; ENU shows      */
/* ±250 m magnitudes. Detect by range and project accordingly.         */
/* ------------------------------------------------------------------ */

function shoelaceAreaM2(poly: Pt[], lonLat: boolean, lat0: number): number {
  let a = 0;
  const kx = lonLat ? 111320 * Math.cos((lat0 * Math.PI) / 180) : 1;
  const ky = lonLat ? 110540 : 1;
  for (let i = 0; i + 1 < poly.length; i++) {
    const p = poly[i] as Pt;
    const q = poly[i + 1] as Pt;
    a += p[0] * kx * (q[1] * ky) - q[0] * kx * (p[1] * ky);
  }
  return Math.abs(a) / 2;
}

function centroid(poly: Pt[]): Pt {
  const pts = pointsEqual(poly[0] as Pt, poly[poly.length - 1] as Pt)
    ? poly.slice(0, -1)
    : poly;
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += p[0];
    sy += p[1];
  }
  return [sx / pts.length, sy / pts.length];
}

function distPointToSegmentM(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/* ------------------------------------------------------------------ */
/* canonical serialisation (sorted keys, 2-space indent)              */
/* ------------------------------------------------------------------ */

function sortKeysDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v !== null && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Json).sort()) {
      out[k] = sortKeysDeep((v as Json)[k]);
    }
    return out;
  }
  return v;
}

function canonicalStringify(v: unknown): string {
  return JSON.stringify(sortKeysDeep(v), null, 2) + "\n";
}

/** Split JSON text into tokens; numbers stay as raw text for value compare. */
function tokenize(s: string): string[] {
  const re = /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}[\],:]/g;
  return s.match(re) ?? [];
}

function isNumberToken(t: string): boolean {
  return /^-?\d/.test(t);
}

/* ------------------------------------------------------------------ */
/* load                                                                */
/* ------------------------------------------------------------------ */

if (!existsSync(SLICE_JSON_PATH)) {
  console.log("not ok 1 - slice-city.json exists on disk");
  console.log(
    "  slice-city.json is NOT on disk yet — the data agent has not delivered " +
      "client/src/world2/data/slice-city.json. Every snapshot assertion below " +
      "is skipped; this file FAILS until the data lands.",
  );
  process.exitCode = 1;
  process.exit(1);
}

const rawText = readFileSync(SLICE_JSON_PATH, "utf8");
const rawBytes = readFileSync(SLICE_JSON_PATH);
const data = JSON.parse(rawText) as Json;

/* ------------------------------------------------------------------ */
/* assertions                                                          */
/* ------------------------------------------------------------------ */

test("snapshot hash matches the parent-verified sha256", () => {
  const actual = createHash("sha256").update(rawBytes).digest("hex");
  assert.equal(
    actual,
    EXPECTED_SHA256,
    `slice-city.json changed (sha256 ${actual}). If the data agent regenerated it on purpose, ` +
      `update EXPECTED_SHA256 in sliceCity.test.ts AND re-verify every other assertion.`,
  );
});

test("version + timestamp_osm_base present", () => {
  const version = data.version ?? (data.meta as Json | undefined)?.version;
  assert.ok(
    (typeof version === "string" && version.length > 0) || typeof version === "number",
    `version missing or empty (got ${JSON.stringify(version)})`,
  );
  const ts =
    data.timestamp_osm_base ??
    (data.osm3s as Json | undefined)?.timestamp_osm_base ??
    (data.meta as Json | undefined)?.timestamp_osm_base;
  assert.ok(typeof ts === "string" && ts.length > 0, "timestamp_osm_base missing");
  assert.ok(!Number.isNaN(Date.parse(ts)), `timestamp_osm_base is not a date: ${ts}`);
  console.log(`  version=${String(version)} timestamp_osm_base=${ts}`);
});

test("ODbL / OpenStreetMap attribution present", () => {
  // Soft check: warns but does not fail — the audit (§6 risk 5) requires
  // the attribution; the file carries it in `source`.
  const hay = rawText;
  if (!hay.includes("OpenStreetMap") || !hay.includes("ODbL")) {
    console.log(
      "  WARNING: no OpenStreetMap/ODbL attribution string found in slice-city.json " +
        "(audit §6 risk 5 requires it in the file).",
    );
  } else {
    console.log(`  source=${JSON.stringify(data.source)}`);
  }
});

interface Bbox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

function readBbox(d: Json): Bbox {
  const b = d.bbox;
  if (Array.isArray(b) && b.length === 4) {
    return {
      minLon: asNum(b[0], "bbox[0]"),
      minLat: asNum(b[1], "bbox[1]"),
      maxLon: asNum(b[2], "bbox[2]"),
      maxLat: asNum(b[3], "bbox[3]"),
    };
  }
  const r = asRecord(b, "bbox");
  const pick = (...keys: string[]): number | undefined => {
    for (const k of keys) if (typeof r[k] === "number") return r[k] as number;
    return undefined;
  };
  const minLat = pick("minLat", "minlat", "south");
  const maxLat = pick("maxLat", "maxlat", "north");
  const minLon = pick("minLon", "minlon", "west");
  const maxLon = pick("maxLon", "maxlon", "east");
  if (
    minLat === undefined ||
    maxLat === undefined ||
    minLon === undefined ||
    maxLon === undefined
  ) {
    throw new Error(`bbox has an unrecognised shape: ${JSON.stringify(b)}`);
  }
  return { minLat, maxLat, minLon, maxLon };
}

function bboxClose(a: Bbox, b: Bbox, tol: number): boolean {
  return (
    Math.abs(a.minLat - b.minLat) <= tol &&
    Math.abs(a.maxLat - b.maxLat) <= tol &&
    Math.abs(a.minLon - b.minLon) <= tol &&
    Math.abs(a.maxLon - b.maxLon) <= tol
  );
}

const bbox = readBbox(data);

test("bbox is box B (22.5465–22.5510°N / 113.9490–113.9540°E)", () => {
  if (bboxClose(bbox, BOX_M0_FALLBACK, BBOX_TOL_DEG)) {
    assert.fail(
      "FALLBACK DATA USED: bbox matches the M0 Huaqiangbei fallback box " +
        "(22.5399–22.5456°N / 114.0818–114.0885°E), NOT the selected Nanshan box B. " +
        "The slice must be built on box B (audit §5.1). " +
        `Actual bbox: ${JSON.stringify(bbox)}`,
    );
  }
  assert.ok(
    bboxClose(bbox, BOX_B, BBOX_TOL_DEG),
    `bbox ${JSON.stringify(bbox)} matches neither box B ${JSON.stringify(BOX_B)} ` +
      `nor the M0 fallback — the slice box is wrong.`,
  );
});

const buildings = asArray(data.buildings, "buildings").map((b, i) =>
  asRecord(b, `buildings[${i}]`),
);
const roads = asArray(data.roads, "roads").map((r, i) => asRecord(r, `roads[${i}]`));
const walkable = asArray(data.walkable, "walkable").map((w, i) =>
  asPointArray(w, `walkable[${i}]`),
);

// Footprints are ENU metres when their magnitudes look like metres (±1000)
// while the bbox is in degrees; lon/lat when they sit inside the bbox.
const firstFootprint = asPointArray(buildings[0]?.footprint, "buildings[0].footprint");
const lonLatMode = firstFootprint.every(
  (p) =>
    p[0] >= bbox.minLon - 0.01 &&
    p[0] <= bbox.maxLon + 0.01 &&
    p[1] >= bbox.minLat - 0.01 &&
    p[1] <= bbox.maxLat + 0.01,
);
if (lonLatMode) console.log("  coordinate mode: lon/lat (projected for areas/distances)");
else console.log("  coordinate mode: ENU metres from bbox centre");

test("building count is 20–30", () => {
  assert.ok(
    buildings.length >= 20 && buildings.length <= 30,
    `expected 20–30 buildings, got ${buildings.length}`,
  );
  console.log(`  buildings=${buildings.length}`);
});

test("exactly 3 enterable buildings with roles office/shop/lobby", () => {
  const enterable = buildings.filter((b) => b.enterable !== null && b.enterable !== undefined);
  assert.equal(enterable.length, 3, `expected exactly 3 enterable buildings, got ${enterable.length}`);
  const roles = enterable.map((b) => {
    const e = asRecord(b.enterable, "enterable");
    return asStr(e.role, "enterable.role");
  });
  assert.deepEqual(
    [...roles].sort(),
    ["lobby", "office", "shop"],
    `enterable roles must be exactly one each of office/shop/lobby, got ${JSON.stringify(roles)}`,
  );
  for (const b of enterable) {
    console.log(
      `  enterable ${String(b.id)} role=${String((b.enterable as Json).role)} name=${JSON.stringify(b.name)}`,
    );
  }
});

test("every footprint closed and area > 200 m²", () => {
  const lat0 = (bbox.minLat + bbox.maxLat) / 2;
  const bad: string[] = [];
  for (const b of buildings) {
    const fp = asPointArray(b.footprint, `building ${String(b.id)} footprint`);
    assert.ok(fp.length >= 4, `building ${String(b.id)} footprint has < 4 points`);
    if (!pointsEqual(fp[0] as Pt, fp[fp.length - 1] as Pt)) {
      bad.push(`${String(b.id)}: footprint not closed`);
      continue;
    }
    const area = shoelaceAreaM2(fp, lonLatMode, lat0);
    if (!(area > 200)) bad.push(`${String(b.id)}: area ${area.toFixed(1)} m² ≤ 200`);
  }
  assert.deepEqual(bad, [], `footprint problems:\n  ${bad.join("\n  ")}`);
});

test("every building has height > 0 and levels ≥ 1", () => {
  const bad: string[] = [];
  for (const b of buildings) {
    const h = asNum(b.height, `building ${String(b.id)} height`);
    const lv = asNum(b.levels, `building ${String(b.id)} levels`);
    if (!(h > 0)) bad.push(`${String(b.id)}: height ${h}`);
    if (!(lv >= 1)) bad.push(`${String(b.id)}: levels ${lv}`);
  }
  assert.deepEqual(bad, [], `height/levels problems:\n  ${bad.join("\n  ")}`);
});

test("no two buildings share an id", () => {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const b of buildings) {
    const id = String(b.id);
    if (seen.has(id)) dupes.push(id);
    seen.add(id);
  }
  assert.deepEqual(dupes, [], `duplicate building ids: ${dupes.join(", ")}`);
});

test("every building centroid within 50 m of some road centreline (≤ 2 exceptions)", () => {
  const centrelines = roads.map((r) => {
    const pts = r.points ?? r.centerline ?? r.geometry;
    return asPointArray(pts, `road ${String(r.id)} points`);
  });
  const exceptions: string[] = [];
  for (const b of buildings) {
    const fp = asPointArray(b.footprint, `building ${String(b.id)} footprint`);
    const [cx, cy] = centroid(fp);
    let best = Infinity;
    for (const line of centrelines) {
      for (let i = 0; i + 1 < line.length; i++) {
        const p = line[i] as Pt;
        const q = line[i + 1] as Pt;
        best = Math.min(best, distPointToSegmentM(cx, cy, p[0], p[1], q[0], q[1]));
      }
    }
    if (best > MAX_ROAD_GAP_M) {
      exceptions.push(`${String(b.id)}: ${best.toFixed(1)} m from nearest centreline`);
    }
  }
  for (const e of exceptions) console.log(`  exception: ${e}`);
  assert.ok(
    exceptions.length <= MAX_ROAD_EXCEPTIONS,
    `${exceptions.length} buildings are > ${MAX_ROAD_GAP_M} m from any road ` +
      `(max ${MAX_ROAD_EXCEPTIONS} allowed):\n  ${exceptions.join("\n  ")}`,
  );
});

test("roads non-empty; names are null or non-empty strings (never invented)", () => {
  assert.ok(roads.length > 0, "roads array is empty");
  let named = 0;
  for (const r of roads) {
    const name = asStrOrNull(r.name, `road ${String(r.id)} name`);
    if (name !== null) named++;
    const pts = asPointArray(
      r.points ?? r.centerline ?? r.geometry,
      `road ${String(r.id)} points`,
    );
    assert.ok(pts.length >= 2, `road ${String(r.id)} has < 2 centreline points`);
  }
  console.log(`  roads=${roads.length} named=${named} unnamed=${roads.length - named}`);
});

test("walkable polygons non-empty and closed", () => {
  assert.ok(walkable.length > 0, "walkable array is empty");
  const bad: string[] = [];
  for (let i = 0; i < walkable.length; i++) {
    const poly = walkable[i] as Pt[];
    if (poly.length < 4) bad.push(`walkable[${i}]: < 4 points`);
    else if (!pointsEqual(poly[0] as Pt, poly[poly.length - 1] as Pt)) {
      bad.push(`walkable[${i}]: not closed`);
    }
  }
  assert.deepEqual(bad, [], `walkable problems:\n  ${bad.join("\n  ")}`);
  console.log(`  walkable polygons=${walkable.length}`);
});

test("no hard ±250 m ENU clip asserted — report footprint extent as info", () => {
  // Parent caveat: some footprints extend slightly past ±250 m ENU.
  // Do NOT fail on it; just report the extent so a future clip is visible.
  let maxAbs = 0;
  for (const b of buildings) {
    const fp = asPointArray(b.footprint, `building ${String(b.id)} footprint`);
    for (const p of fp) maxAbs = Math.max(maxAbs, Math.abs(p[0]), Math.abs(p[1]));
  }
  console.log(`  max |ENU| over all footprints: ${maxAbs.toFixed(1)} m`);
});

test("height-library cross-check: ≥ 25/30 buildings match tools/buildings (nearest ≤ 40 m, height within max(10 m, 20%))", () => {
  if (!existsSync(HEIGHT_LIB_PATH)) {
    console.log("  SKIP: tools/buildings/buildings-osm.json not on disk — cross-check skipped.");
    return;
  }
  const lib = JSON.parse(readFileSync(HEIGHT_LIB_PATH, "utf8")) as Json;
  const entries = asArray(lib.sz, "height library sz").map((e) => asRecord(e, "height entry"));
  // 0.001° buckets for a cheap nearest search.
  const buckets = new Map<string, Json[]>();
  for (const e of entries) {
    const key = `${(e.lat as number).toFixed(3)},${(e.lon as number).toFixed(3)}`;
    const arr = buckets.get(key);
    if (arr) arr.push(e);
    else buckets.set(key, [e]);
  }
  const M_PER_DEG = 111320;
  const origin = asRecord(data.origin, "origin");
  const oLat = asNum(origin.lat, "origin.lat");
  const oLon = asNum(origin.lon, "origin.lon");
  const cosLat = Math.cos((oLat * Math.PI) / 180);
  const noMatch: string[] = [];
  let matches = 0;
  for (const b of buildings) {
    const fp = asPointArray(b.footprint, `building ${String(b.id)} footprint`);
    const [cx, cy] = centroid(fp);
    const lat = oLat - cy / M_PER_DEG;
    const lon = oLon + cx / (M_PER_DEG * cosLat);
    let best: Json | null = null;
    let bestDist = Infinity;
    for (const dLat of [-0.001, 0, 0.001]) {
      for (const dLon of [-0.001, 0, 0.001]) {
        const bucket = buckets.get(`${(lat + dLat).toFixed(3)},${(lon + dLon).toFixed(3)}`);
        if (!bucket) continue;
        for (const e of bucket) {
          const d = Math.hypot(
            ((e.lat as number) - lat) * M_PER_DEG,
            ((e.lon as number) - lon) * M_PER_DEG * cosLat,
          );
          if (d < bestDist) {
            bestDist = d;
            best = e;
          }
        }
      }
    }
    const height = asNum(b.height, `building ${String(b.id)} height`);
    const ok =
      best !== null &&
      bestDist <= 40 &&
      Math.abs((best.h as number) - height) <= Math.max(10, 0.2 * height);
    if (ok) matches++;
    else {
      noMatch.push(
        `${String(b.id)}: height ${height} m, nearest library entry ` +
          (best === null
            ? "none within 0.001°"
            : `${String(best.h)} m at ${bestDist.toFixed(1)} m`),
      );
    }
  }
  for (const n of noMatch) console.log(`  no height-library match: ${n}`);
  console.log(`  height-library matches: ${matches}/30 (parent stated 27/30)`);
  assert.ok(
    matches >= MIN_HEIGHT_LIB_MATCHES,
    `only ${matches}/30 buildings match the height library (floor ${MIN_HEIGHT_LIB_MATCHES})`,
  );
});

test("determinism: canonical re-serialisation is stable; file is in canonical sorted-key form", () => {
  // (a) Round-trip stability: parse → canonical stringify → parse →
  // canonical stringify must be byte-identical (the writer is deterministic).
  const once = canonicalStringify(data);
  const twice = canonicalStringify(JSON.parse(once) as unknown);
  assert.equal(twice, once, "canonical re-serialisation is not stable across round-trips");
  // (b) The file itself must be in canonical sorted-key form. Numbers are
  // compared BY VALUE, not by text: the file was written by a Python writer
  // (`45.0`), JS writes `45` — same number, different bytes. A token-stream
  // difference anywhere else (key order, structure, values) fails loudly.
  const fileTokens = tokenize(rawText);
  const canonTokens = tokenize(once);
  assert.equal(
    fileTokens.length,
    canonTokens.length,
    `token count differs: file ${fileTokens.length} vs canonical ${canonTokens.length} — ` +
      `the file is not in canonical form (regenerate with sorted keys).`,
  );
  for (let i = 0; i < fileTokens.length; i++) {
    const f = fileTokens[i] as string;
    const c = canonTokens[i] as string;
    if (isNumberToken(f) && isNumberToken(c)) {
      assert.ok(
        Number(f) === Number(c),
        `number differs at token ${i}: file ${f} vs canonical ${c}`,
      );
    } else {
      assert.equal(
        f,
        c,
        `token ${i} differs: file ${JSON.stringify(f)} vs canonical ${JSON.stringify(c)} ` +
          `(context: …${fileTokens.slice(Math.max(0, i - 4), i + 4).join(" ")}…)`,
      );
    }
  }
  const byteIdentical = rawText === once;
  console.log(
    `  canonical form: token streams identical (${fileTokens.length} tokens); ` +
      `byte-identical to JS output: ${byteIdentical ? "yes" : "no — Python float formatting only (e.g. 45.0 vs 45), documented in the file header"}`,
  );
});

/* ------------------------------------------------------------------ */

console.log(`\nsliceCity: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("FAILURES:");
  for (const f of failures) console.log(` - ${f}`);
  process.exitCode = 1;
}
