/* ---- 自建统计 + 报错上报 ----
   Anonymous product events go to our own server (the `track` action):
   batched, flushed every 15 s and when the page is hidden. The server
   stores the player's PUBLIC id and the Beijing date, which is enough for
   daily actives, D1/D7 retention and funnels on the admin page. Client
   errors (window.onerror / unhandledrejection) go to `reportError`,
   deduped and capped so a crash loop can't flood the server. */
import { api } from "./api";

type Props = Record<string, string | number | boolean>;
let playerId: string | null = null;
let queue: { name: string; props?: Props }[] = [];
let timer: number | null = null;

export function setAnalyticsPlayer(id: string | null): void { playerId = id; if (id) flush(); }

export function track(name: string, props?: Props): void {
  const clean = name.toLowerCase().replace(/[^a-z0-9_:.-]/g, "_").slice(0, 40);
  queue.push(props ? { name: clean, props } : { name: clean });
  if (queue.length >= 20) flush();
  else if (timer === null) timer = window.setTimeout(flush, 15_000);
}

export function flush(): void {
  if (timer !== null) { window.clearTimeout(timer); timer = null; }
  if (!playerId || queue.length === 0) return;
  const batch = queue.slice(0, 25);
  queue = queue.slice(25);
  void api.track({ playerId, events: batch }).catch(() => { /* offline: drop, never block play */ });
  if (queue.length) timer = window.setTimeout(flush, 2000);
}

const seen = new Set<string>();
let sent = 0;
function sendError(message: string, stack?: string): void {
  const key = message.slice(0, 200);
  if (seen.has(key) || sent >= 20) return;
  seen.add(key); sent += 1;
  void api.reportError({
    ...(playerId ? { playerId } : {}),
    message: key,
    ...(stack ? { stack: stack.slice(0, 2000) } : {}),
    url: location.pathname + location.hash.slice(0, 40),
    ua: navigator.userAgent.slice(0, 300),
  }).catch(() => {});
}

export function installErrorReporting(): void {
  window.addEventListener("error", (e) => {
    if (!e.message) return;
    sendError(e.message, e.error instanceof Error ? e.error.stack : `${e.filename}:${e.lineno}:${e.colno}`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    sendError(r instanceof Error ? r.message : String(r).slice(0, 200), r instanceof Error ? r.stack : undefined);
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
}

/** A React render crash caught by the root error boundary. */
export function reportCrash(err: Error): void { sendError(`[crash] ${err.message}`, err.stack); }
