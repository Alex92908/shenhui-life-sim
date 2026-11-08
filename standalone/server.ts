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
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Ctx } from "@hatch/space-sdk";
import { Actions } from "../server/src/actions";
import * as schema from "../server/src/schema";
import { openMeteoWeather } from "./weather";

const HERE = dirname(fileURLToPath(import.meta.url));
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
    const data = await (def.handler as (c: Ctx, a: any) => Promise<unknown>)(ctx, args.data);
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
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
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
  if (req.method === "POST" && path.endsWith("/actions")) {
    if (throttled(req)) send(res, 429, { ok: false, error: "too many requests" });
    else void handleAction(req, res);
  }
  else if (req.method === "GET" || req.method === "HEAD") serveStatic(req, res);
  else send(res, 405, { ok: false, error: "method not allowed" });
}).listen(PORT, HOST, () => {
  console.log(`深惠人生模拟 standalone server → http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}  (db: ${DB_PATH})`);
});
