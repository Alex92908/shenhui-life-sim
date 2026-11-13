// Bay Area Life 2.0 — renderer: perf HUD (F3 toggle) + stats sampling.
//
// Mirrors the M0 prototype's `hud.ts` idea (Stage 0 audit §4.2): a resident,
// hidden-by-default overlay showing FPS / frame-time P95 / draw calls /
// triangles / JS heap / chunk-ledger numbers, plus a 5 s sampler that
// appends to localStorage so a run produces numbers without a server.
import type { ChunkStreamer } from "./streaming";

export interface PerfStats {
  fps: number;
  frameMsP95: number;
  drawCalls: number;
  triangles: number;
  /** performance.memory.usedJSHeapSize in MB, or null where unavailable (non-Chrome). */
  heapMB: number | null;
  geometryMB: number;
  unreferencedMB: number;
  chunksLoaded: number;
  chunksSimple: number;
}

/** localStorage ring buffer for 5 s perf samples (max 200 entries). */
export const PERF_SAMPLES_KEY = "world2-perf-samples";
export const PERF_SAMPLES_MAX = 200;
export const PERF_SAMPLE_INTERVAL_MS = 5000;

export interface PerfHud {
  element: HTMLElement;
  setVisible(v: boolean): void;
  sample(stats: PerfStats): void;
  dispose(): void;
}

function readSamples(): (PerfStats & { t: number })[] {
  try {
    const raw = localStorage.getItem(PERF_SAMPLES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as (PerfStats & { t: number })[]) : [];
  } catch {
    return [];
  }
}

/** Append one sample to the localStorage ring buffer (max 200, oldest dropped). */
export function recordPerfSample(stats: PerfStats): void {
  try {
    const samples = readSamples();
    samples.push({ ...stats, t: Date.now() });
    while (samples.length > PERF_SAMPLES_MAX) samples.shift();
    localStorage.setItem(PERF_SAMPLES_KEY, JSON.stringify(samples));
  } catch {
    // Storage full / private mode — the HUD still works, sampling just drops.
  }
}

/** Read back the stored samples (for the slice harness / soak-test analysis). */
export function readPerfSamples(): (PerfStats & { t: number })[] {
  return readSamples();
}

export function createPerfHud(): PerfHud {
  const el = document.createElement("div");
  el.style.cssText = [
    "position:fixed",
    "top:8px",
    "left:8px",
    "z-index:9999",
    "font:12px/1.5 monospace",
    "color:#e8f0e8",
    "background:rgba(10,16,12,0.72)",
    "padding:8px 10px",
    "border-radius:6px",
    "pointer-events:none",
    "white-space:pre",
    "display:none",
  ].join(";");
  el.textContent = "world2 perf — sampling…";
  document.body.appendChild(el);

  let visible = false;
  let lastWrite = 0;

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "F3") {
      e.preventDefault();
      visible = !visible;
      el.style.display = visible ? "block" : "none";
    }
  };
  window.addEventListener("keydown", onKey);

  return {
    element: el,
    setVisible(v: boolean): void {
      visible = v;
      el.style.display = v ? "block" : "none";
    },
    sample(stats: PerfStats): void {
      const heap = stats.heapMB === null ? "n/a" : `${stats.heapMB.toFixed(1)} MB`;
      el.textContent =
        `FPS ${stats.fps.toFixed(0)}  frame P95 ${stats.frameMsP95.toFixed(1)} ms\n` +
        `draw calls ${stats.drawCalls}  triangles ${(stats.triangles / 1000).toFixed(0)}k\n` +
        `JS heap ${heap}\n` +
        `chunk geometry ${stats.geometryMB.toFixed(2)} MB  unreferenced ${stats.unreferencedMB.toFixed(2)} MB\n` +
        `chunks full ${stats.chunksLoaded}  simple ${stats.chunksSimple}`;
      const now = performance.now();
      if (now - lastWrite >= PERF_SAMPLE_INTERVAL_MS) {
        lastWrite = now;
        recordPerfSample(stats);
      }
    },
    dispose(): void {
      window.removeEventListener("keydown", onKey);
      el.remove();
    },
  };
}

/** Convenience: merge scene stats with streamer stats into one PerfStats. */
export function mergeChunkStats(
  base: PerfStats,
  streamer: ChunkStreamer,
): PerfStats {
  const s = streamer.stats();
  const l = streamer.ledgerStats();
  return {
    ...base,
    geometryMB: l.geometryMB,
    unreferencedMB: l.unreferencedMB,
    chunksLoaded: s.loaded,
    chunksSimple: s.simple,
  };
}
