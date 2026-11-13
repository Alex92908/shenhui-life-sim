# Bay Area Life 2.0 — Stage 1 benchmark runbook

How to measure the slice (scenes A/B from the Stage 0 audit, §4.2).
**The results table at the bottom is empty until someone runs this in a
browser — FPS, heap, chunk load times and cold start cannot be measured
headless. The Node tests (`run-tests.mjs`) cover the logic; this runbook
covers the reality.**

## 0. Prerequisites

- The slice is running in a browser (desktop Chrome on lee's Mac is the
  primary device; one Windows/Chrome run as a对照）.
- How to launch the slice in a browser is defined by the render agent's
  entry point — this runbook assumes the slice is up, the player spawns
  in the slice, and walking works (WASD/arrows; **do not hold Shift** —
  Shift runs, and scene A is a 3 m/s walk).
- Perf HUD: press **F3** to toggle (contract: `render/hud.ts` — **not on
  disk yet as of 2026-11-12**; the render agent owns it. It must show
  FPS / frame time / draw calls / triangles / heap / ledger, and write a
  sample every 5 s to localStorage key **`world2-perf-samples`**).
- If the renderer exposes a debug handle, it is **`window.__world2`**
  (contract). The 1.0 reference is `window.__chunks.stats()` /
  `ledgerStats()` (MapView.tsx:2156) — the 2.0 handle should expose the
  same shape: loaded/simple/queued/inFlight counts and
  `geometryMB` / `unreferencedMB`.
- Heap: `performance.memory.usedJSHeapSize` (Chrome only). On other
  browsers, record "n/a (no performance.memory)" and rely on the ledger.

## 1. Scene A — street walk (must run)

**Route (fixed — do not improvise; all coordinates ENU metres, +x east,
+z south, from `slice-city.json`, origin = bbox centre):**

| Leg | From → To (ENU) | Road | ≈ m |
|---|---|---|---|
| 1 | (-50, 103) shop **8号楼 b533679835** → (-108, 90) | 大冲六路 (west) | 60 |
| 2 | (-108, 90) → (-110, -235) | 大冲二路 (north) | 325 |
| 3 | (-110, -235) → (155, -230) | 金铜路 (east) | 265 |
| 4 | (155, -230) → (155, 80) | 大冲三路 (south) | 310 |
| 5 | (155, 80) → (200, 80) | 大冲六路 (east) | 45 |
| 6 | (200, 80) → (236, 246) | unnamed footway `r489349409` (south) | 166 |
| 7 | **Enter 尚美科技大厦 b533679872** (lobby + 1 office room), walk through, **exit** | — | — |

- Total ≈ **1,171 m ≈ 6.5 min at 3 m/s** (the audit's "5-minute" figure
  is approximate; the route is the fixed thing — record the actual
  elapsed time).
- Landmark on the way: the kindergarten lobby building `b1269262174`
  at (175, 247), just west of the office.
- Chunk-boundary crossings: ≈ 1,171 ÷ chunk size. At the audit's
  starting chunk size of **32 m** that is **≈ 36 crossings (≥ 20
  required)**. If the streaming agent picks a different chunk size,
  recompute: crossings must stay ≥ 20 (chunk ≤ ~58 m for this route).
- Walk at a steady 3 m/s (WASD, no Shift). Do not teleport, do not open
  the map mid-walk. One enter/exit of the office (leg 7) only.
- A **hole frame** is any frame in which the chunk under the player (or
  directly ahead of them) shows no building where the snapshot has one.
  Count hole frames during the walk; the acceptance line is zero.

## 2. Scene B — map mode (must run)

1. Finish scene A (or start fresh in street mode at the shop).
2. Press **V** to switch to map mode. Start a 30 s timer.
3. Stay in map mode for 30 s (you may pan/zoom, but do not switch back).
4. Record: time from pressing V until the full map is rendered, peak
   heap during the 30 s, draw calls / triangles at the end of the 30 s.
5. Press V to return to street mode (needed for the mode-switch soak in
   §4 if you run it).

## 3. The 9 metrics + acceptance lines (audit §4.2)

| # | Metric | How to capture | Acceptance (desktop) |
|---|---|---|---|
| 1 | FPS median / P1 | rAF delta histogram over scene A (HUD) | median ≥ 55, P1 ≥ 30 |
| 2 | Frame time P95 / worst single frame at a chunk boundary | same histogram; worst frame while crossing a boundary | P95 ≤ 25 ms; worst ≤ 50 ms |
| 3 | Draw calls (street) | `renderer.info.render.calls`, sampled every 5 s (HUD) | ≤ 200 |
| 4 | Triangles (street) | `renderer.info.render.triangles`, sampled every 5 s (HUD) | ≤ 1.5 M |
| 5 | JS heap growth over the 5-min walk | `performance.memory.usedJSHeapSize` at walk start vs end | growth ≤ 20 MB |
| 6 | GPU memory estimate + ledger | ChunkLedger `geometryMB` (+ textures ledger); `unreferencedMB` | street steady state ≤ 150 MB; `unreferencedMB`恒 0; no growth across 100 chunk boundaries |
| 7 | Chunk load time | ChunkManager instrumentation: build posted → materialised | P95 ≤ 100 ms; densest chunk ≤ 250 ms; zero hole frames |
| 8 | Mode switch | V street↔map 50×; heap + ledger before vs after | no leak (heap and ledger back within ±5%); map full render ≤ 0.5 s |
| 9 | Cold start | First load → walkable (player can move) | ≤ 8 s desktop |

Mobile lines (iPhone Safari, if run): FPS median ≥ 30, triangles
≤ 600k, GPU ≤ 80 MB, cold start ≤ 15 s — same table, separate column.

## 4. Optional soaks (audit §5.6 — run if time allows)

- **30-minute continuous walk** (repeat the scene A loop): heap growth
  ≤ 20 MB over the whole 30 min; `unreferencedMB`恒 0.
- **50× street↔map switches**: same leak check as metric 8.
- **100 chunk-boundary crossings**: covered by scene A (≈36) — repeat
  legs 1–4 three times to reach 100, counting hole frames.

## 5. How to read the numbers after a run

1. In the browser console: `JSON.parse(localStorage.getItem("world2-perf-samples"))`
   — one sample per 5 s (contract: `{ t, fps, frameMs, calls, tris,
   heapMB, geometryMB, unreferencedMB, mode }`). Export it and attach
   it to the run record.
2. FPS median / P1 / frame P95: compute from the `frameMs` series of
   scene A (median, 1st percentile of FPS, 95th percentile of frameMs).
3. Worst boundary frame: the max `frameMs` among samples taken while
   the player's chunk coordinate changed (HUD shows the current chunk).
4. Heap growth: last `heapMB` minus first `heapMB` in scene A.
5. Chunk load P95: from the ChunkManager timings the HUD exposes
   (`window.__world2` if present); if the HUD has no load timings, note
   "not instrumented" and use hole-frame count as the proxy.
6. Cold start: measure with a stopwatch from reload to first step
   (or from the Navigation Timing API if the HUD reports it).

## 6. Results (fill in by hand after a browser run)

| Metric | Scene A | Scene B | Pass? |
|---|---|---|---|
| FPS median / P1 | | — | |
| Frame time P95 / worst boundary frame | | — | |
| Draw calls | | | |
| Triangles | | | |
| JS heap growth (scene A: start → end) | | | |
| GPU memory (geometryMB) / unreferencedMB | | | |
| Chunk load P95 / densest / hole frames | | — | |
| Mode switch (50×): heap/ledger drift; map full render | — | | |
| Cold start | | — | |

- Run date / device / browser / commit:
- Route actually walked (if it deviated from §1, say so):
- Notes (hitches, pop-in, black frames, anything odd):

## 7. What this runbook does NOT cover

- Real FPS / heap / load times — **browser-only, not verifiable by the
  Node tests**. Anyone quoting numbers for these without a filled-in
  table above is guessing.
- `render/hud.ts`, `world2-perf-samples`, and `window.__world2` are
  **contracts, not landed code** as of 2026-11-12. If the HUD is not
  there when you run this, record the metrics by hand from
  `renderer.info` + `performance.memory` + `window.__chunks` (1.0) or
  the 2.0 equivalent, and file the gap with the render agent.
