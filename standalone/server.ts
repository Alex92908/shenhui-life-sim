// Standalone server: runs the game's real server actions
// (server/src/actions.ts, unchanged) on Node + SQLite, outside Muse.
//
//   POST /actions  {action, args}  ->  {ok: true, data} | {ok: false, error}
//   GET  /*        built client from standalone/dist (production mode)
//
// Env: PORT (default 8787), HOST (default 127.0.0.1; set 0.0.0.0 to let
// friends on your LAN join the shared world), DB_PATH (default
// standalone/data/app.db), WEATHER=off to skip the live weather lookup.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { brotliCompressSync, gzipSync, constants as zlibConstants } from "node:zlib";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Ctx } from "@hatch/space-sdk";
import { Actions } from "../server/src/actions";
import * as schema from "../server/src/schema";
import { openMeteoWeather } from "./weather";

const HERE = dirname(fileURLToPath(import.meta.url));
/* keys and settings live in standalone/.env (git-ignored; see .env.example and docs/LAUNCH-SETUP.md) */
if (existsSync(join(HERE, ".env"))) { try { process.loadEnvFile(join(HERE, ".env")); } catch (e) { console.error("[env] could not read .env:", e); } }
const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";
const DB_PATH = resolve(process.env.DB_PATH ?? join(HERE, "data", "app.db"));
const DIST = join(HERE, "dist");
const MIGRATIONS = join(HERE, "..", "drizzle");

/* ---- database + migrations (the same drizzle/*.sql files Muse applies) ---- */
mkdirSync(dirname(DB_PATH), { recursive: true });
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.exec("CREATE TABLE IF NOT EXISTS __standalone_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
const applied = new Set(
  (sqlite.prepare("SELECT name FROM __standalone_migrations").all() as { name: string }[]).map((r) => r.name),
);
for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
  if (applied.has(file)) continue;
  const sql = readFileSync(join(MIGRATIONS, file), "utf8");
  sqlite.transaction(() => {
    for (const stmt of sql.split("--> statement-breakpoint")) if (stmt.trim()) sqlite.exec(stmt);
    sqlite.prepare("INSERT INTO __standalone_migrations (name, applied_at) VALUES (?, ?)").run(file, Date.now());
  })();
  console.log(`[db] applied ${file}`);
}
const db = drizzle(sqlite, { schema });

const ctx: Ctx = {
  db: (() => db) as Ctx["db"],
  tool: {
    weather: async (_q, opts) => {
      if (process.env.WEATHER === "off") throw new Error("weather disabled");
      return openMeteoWeather(opts.location.lat, opts.location.lon, opts.location.timezone ?? "Asia/Shanghai");
    },
  },
  invalidateQueries: () => {},
};

/* ---- http ---- */
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

const send = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
};

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((ok, fail) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 256 * 1024) {
        fail(new Error("body too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => ok(Buffer.concat(chunks).toString("utf8")));
    req.on("error", fail);
  });

/* The caller's IP, visible to actions for anti-abuse checks (they only keep
   a salted hash). Actions read it through a global hook so the same action
   code still runs on hosts that don't provide it. */
const requestScope = new AsyncLocalStorage<{ ip: string }>();
(globalThis as { __shhrRequestIp?: () => string }).__shhrRequestIp = () => requestScope.getStore()?.ip ?? "";

/* Login codes. Email through Resend (RESEND_API_KEY + LOGIN_FROM) or any HTTPS
 * webhook (LOGIN_CODE_WEBHOOK receives {provider, to, code} — point it at your
 * SMS/email provider). With neither set, DEV_LOGIN_CODES=1 prints the code to
 * this log and shows it on the page, for local testing only. */
const sendCode = async (provider: "email" | "phone", to: string, code: string) => {
  const hook = process.env.LOGIN_CODE_WEBHOOK;
  if (hook) {
    const r = await fetch(hook, { method: "POST", headers: { "content-type": "application/json", ...(process.env.LOGIN_CODE_WEBHOOK_SECRET ? { authorization: `Bearer ${process.env.LOGIN_CODE_WEBHOOK_SECRET}` } : {}) }, body: JSON.stringify({ provider, to, code }) });
    if (!r.ok) throw new Error(`webhook ${r.status}`);
    return;
  }
  if (provider === "phone" && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID)) {
    // overseas SMS through Twilio (Chinese mainland numbers need a local provider through LOGIN_CODE_WEBHOOK)
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const body = new URLSearchParams({ To: to, Body: `【深惠人生】验证码 ${code}，10 分钟内有效。Your Shenhui Life code is ${code}.`, ...(process.env.TWILIO_MESSAGING_SERVICE_SID ? { MessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID } : { From: process.env.TWILIO_FROM! }) });
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: "POST", headers: { authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" }, body });
    if (!r.ok) throw new Error(`twilio ${r.status}`);
    return;
  }
  if (provider === "email" && process.env.RESEND_API_KEY) {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.RESEND_API_KEY}` }, body: JSON.stringify({ from: process.env.LOGIN_FROM ?? "深惠人生 <login@example.com>", to: [to], subject: `深惠人生登录验证码 ${code}`, text: `你的验证码是 ${code}，10 分钟内有效。不是你本人操作请忽略。\nYour login code is ${code} (valid for 10 minutes).` }) });
    if (!r.ok) throw new Error(`resend ${r.status}`);
    return;
  }
  throw new Error("no sender for " + provider);
};
if (process.env.LOGIN_CODE_WEBHOOK || process.env.RESEND_API_KEY || process.env.TWILIO_ACCOUNT_SID) (globalThis as { __shhrSendCode?: typeof sendCode }).__shhrSendCode = sendCode;

/* Payments. Stripe calls POST /stripe/webhook; the event is trusted only if
 * its Stripe-Signature (HMAC-SHA256 with STRIPE_WEBHOOK_SECRET) checks out
 * and is under 5 minutes old. Fulfilment runs through the paymentEvent
 * action, which only accepts this process's random internal key — so no
 * client can mark an order paid. */
const INTERNAL_KEY = randomBytes(24).toString("hex");
(globalThis as { __shhrInternalKey?: string }).__shhrInternalKey = INTERNAL_KEY;
function stripeSignatureOk(raw: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]).filter((p) => p.length === 2).map(([k, v]) => [k, v]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const want = createHmac("sha256", secret).update(`${t}.${raw}`).digest();
  return header.split(",").filter((kv) => kv.startsWith("v1=")).some((kv) => {
    const got = Buffer.from(kv.slice(3), "hex");
    return got.length === want.length && timingSafeEqual(got, want);
  });
}
async function handleStripe(req: IncomingMessage, res: ServerResponse) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return send(res, 404, { ok: false });
  let raw = "";
  try { raw = await readBody(req); } catch { return send(res, 400, { ok: false }); }
  if (!stripeSignatureOk(raw, String(req.headers["stripe-signature"] ?? ""), secret)) return send(res, 400, { ok: false, error: "bad signature" });
  let ev: { type?: string; data?: { object?: Record<string, any> } };
  try { ev = JSON.parse(raw); } catch { return send(res, 400, { ok: false }); }
  const o = ev.data?.object ?? {};
  const call = (args: { type: string; orderId?: string; providerRef?: string }) =>
    (Actions.paymentEvent.handler as (c: Ctx, a: unknown) => Promise<unknown>)(ctx, { key: INTERNAL_KEY, ...args });
  try {
    if ((ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") && o.payment_status === "paid")
      await call({ type: "paid", orderId: o.metadata?.order_id ?? o.client_reference_id, providerRef: o.payment_intent ?? o.id });
    else if (ev.type === "charge.refunded")
      await call({ type: "refunded", orderId: o.metadata?.order_id, providerRef: o.payment_intent });
    send(res, 200, { received: true });
  } catch (err) {
    console.error("[stripe webhook]", err);
    send(res, 500, { ok: false });
  }
}

async function handleAction(req: IncomingMessage, res: ServerResponse) {
  let parsed: { action?: unknown; args?: unknown };
  try {
    parsed = JSON.parse(await readBody(req));
  } catch {
    return send(res, 400, { ok: false, error: "invalid JSON" });
  }
  const name = typeof parsed.action === "string" ? parsed.action : "";
  if (!Object.hasOwn(Actions, name)) return send(res, 404, { ok: false, error: `unknown action ${name}` });
  const def = Actions[name as keyof typeof Actions];
  const args = def.request.safeParse(parsed.args ?? {});
  if (!args.success) return send(res, 400, { ok: false, error: args.error.message });
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await requestScope.run({ ip: clientIp(req) }, () => (def.handler as (c: Ctx, a: any) => Promise<unknown>)(ctx, args.data));
    send(res, 200, { ok: true, data });
  } catch (err) {
    console.error(`[action ${name}]`, err);
    send(res, 500, { ok: false, error: "server error" });
  }
}

function serveStatic(req: IncomingMessage, res: ServerResponse) {
  if (!existsSync(DIST)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("还没有构建客户端：先运行 npm run build，或用 npm run dev 开发模式。");
    return;
  }
  const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]!);
  let file = normalize(join(DIST, urlPath));
  if (!file.startsWith(DIST)) file = join(DIST, "index.html");
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, "index.html");
  const ext = extname(file);
  const type = MIME[ext] ?? "application/octet-stream";
  // hashed build output (assets/index-AbC123.js) never changes: cache it for a year;
  // index.html must always be fresh so a new build is picked up straight away
  const hashed = /[\\/]assets[\\/].+-[A-Za-z0-9_-]{6,}\.[a-z0-9]+$/.test(file);
  const cache = ext === ".html" ? "no-cache" : hashed ? "public, max-age=31536000, immutable" : "public, max-age=3600";
  const ae = String(req.headers["accept-encoding"] ?? "");
  const enc = COMPRESSIBLE.has(ext) ? (/\bbr\b/.test(ae) ? "br" : /\bgzip\b/.test(ae) ? "gzip" : null) : null;
  if (enc) {
    const body = compressedFile(file, enc);
    res.writeHead(200, { "content-type": type, "content-encoding": enc, "content-length": body.length, "cache-control": cache, vary: "accept-encoding" });
    res.end(body);
    return;
  }
  res.writeHead(200, { "content-type": type, "cache-control": cache, vary: "accept-encoding" });
  createReadStream(file).pipe(res);
}

/* Text assets go out compressed (the game bundle is ~2.5 MB raw, ~0.7 MB with
   Brotli). Each file is compressed once and kept in memory until it changes. */
const COMPRESSIBLE = new Set([".js", ".css", ".html", ".json", ".svg", ".txt", ".glb", ".mjs", ".map"]);
const zipCache = new Map<string, { mtime: number; br?: Buffer; gzip?: Buffer }>();
function compressedFile(file: string, enc: "br" | "gzip"): Buffer {
  const mtime = statSync(file).mtimeMs;
  let c = zipCache.get(file);
  if (!c || c.mtime !== mtime) { c = { mtime }; zipCache.set(file, c); }
  if (!c[enc]) {
    const raw = readFileSync(file);
    c[enc] = enc === "br"
      ? brotliCompressSync(raw, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 9, [zlibConstants.BROTLI_PARAM_SIZE_HINT]: raw.length } })
      : gzipSync(raw, { level: 9 });
  }
  return c[enc]!;
}

/* Per-IP throttle on /actions: a normal player sends well under one request
   a second; a script hammering the API gets 429 instead of the database.
   Behind a reverse proxy, set TRUST_PROXY=1 so X-Forwarded-For is used. */
const RATE_WINDOW_MS = 10_000;
const RATE_LIMIT = Number(process.env.RATE_LIMIT ?? 120);
const hits = new Map<string, { n: number; at: number }>();
const clientIp = (req: IncomingMessage) =>
  (process.env.TRUST_PROXY === "1" ? String(req.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim() : "") || req.socket.remoteAddress || "?";
const throttled = (req: IncomingMessage): boolean => {
  const ip = clientIp(req);
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.at > RATE_WINDOW_MS) { hits.set(ip, { n: 1, at: now }); return false; }
  h.n += 1;
  return h.n > RATE_LIMIT;
};
setInterval(() => { const now = Date.now(); for (const [ip, h] of hits) if (now - h.at > RATE_WINDOW_MS) hits.delete(ip); }, 60_000).unref();

createServer((req, res) => {
  const path = (req.url ?? "/").split("?")[0]!;
  if (req.method === "POST" && path === "/stripe/webhook") void handleStripe(req, res);
  else if (req.method === "POST" && path.endsWith("/actions")) {
    if (throttled(req)) send(res, 429, { ok: false, error: "too many requests" });
    else void handleAction(req, res);
  }
  else if (req.method === "GET" || req.method === "HEAD") serveStatic(req, res);
  else send(res, 405, { ok: false, error: "method not allowed" });
}).listen(PORT, HOST, () => {
  console.log(`深惠人生模拟 standalone server → http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}  (db: ${DB_PATH})`);
});
