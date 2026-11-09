// Actions for 湾区人生 — the shared-city backend.
//
// The game simulation itself runs on the client; this server owns everything
// that has to be shared between real people: presence (who is online, in
// which city, standing at which location), the city chat channel, the city
// life feed, and the season leaderboard. Clients heartbeat every few seconds
// and poll getWorld on the same cadence.

import {
defineAction,
z,
type ActionsModule,
type Ctx,
} from "@hatch/space-sdk";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import * as schema from "./schema";
import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { cleanName, cleanText } from "./moderation";

/** Public id: the player id is their private key (only their own browser
    knows it); others only ever see this one-way hash of it. */
const pubOf = (id: string) => createHash("sha256").update(id).digest("hex").slice(0, 16);

/* World snapshot cache: every client polls it every few seconds, so build it
   at most once per city per WORLD_TTL_MS; writes that others should see
   right away (chat, feed, gifts, joins) clear it. */
const WORLD_TTL_MS = 1500;
const worldCache = new Map<string, { at: number; world: World }>();
const dropWorldCache = () => worldCache.clear();
async function loadWorldCached(ctx: Ctx, cityKey: string): Promise<World> {
  const hit = worldCache.get(cityKey);
  if (hit && Date.now() - hit.at < WORLD_TTL_MS) return hit.world;
  const world = await loadWorld(ctx, cityKey);
  worldCache.set(cityKey, { at: Date.now(), world });
  return world;
}

const ONLINE_WINDOW_MS = 90_000;
/** Generous ceiling on what one game day can earn (best identity × 职级 ×
    company × bonus day, a full day of overtime, plus rewards). */
const MAX_EARN_PER_DAY = 25_000;

const playerShape = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  color: z.number(),
  cityKey: z.string(),
  locId: z.string(),
  gameDay: z.number(),
  money: z.number(),
  careerIdx: z.number(),
  apecCount: z.number(),
  employer: z.string(),
  stamps: z.number(),
  title: z.string().nullable(),
  status: z.string(),
  resultTitle: z.string().nullable(),
  lastSeen: z.string(),
  look: z.string().nullable().optional(),
});

const GIFT_KINDS = ["tea", "breakfast", "hongbao", "referral", "invite"] as const;
const giftShape = z.object({
  id: z.number(),
  fromId: z.string(),
  fromName: z.string(),
  kind: z.string(),
  company: z.string().nullable(),
  createdAt: z.string(),
});

const worldResponse = z.object({
  online: z.array(playerShape),
  onlineSz: z.number(),
  onlineHz: z.number(),
  onlineHk: z.number(),
  chat: z.array(
    z.object({
      id: z.number(),
      playerId: z.string(),
      playerName: z.string(),
      cityKey: z.string(),
      body: z.string(),
      createdAt: z.string(),
    }),
  ),
  feed: z.array(
    z.object({
      id: z.number(),
      playerName: z.string(),
      kind: z.string(),
      text: z.string(),
      createdAt: z.string(),
    }),
  ),
  leaderboard: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      emoji: z.string(),
      cityKey: z.string(),
      money: z.number(),
      careerIdx: z.number(),
      apecCount: z.number(),
      gameDay: z.number(),
      status: z.string(),
      resultTitle: z.string().nullable(),
      look: z.string().nullable().optional(),
    }),
  ),
  /* 公司排行：最近 7 天活跃玩家按公司汇总（人数 / 存款合计） */
  companyBoard: z.array(z.object({ employer: z.string(), count: z.number(), money: z.number() })),
  /* 集章排行：跨局累计盖章最多的人 */
  stampBoard: z.array(z.object({ id: z.string(), name: z.string(), emoji: z.string(), stamps: z.number(), title: z.string().nullable() })),
});

type World = z.infer<typeof worldResponse>;

async function loadWorld(ctx: Ctx, cityKey: string): Promise<World> {
  const db = ctx.db<typeof schema>();
  const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS);
  const onlineRows = await db
    .select()
    .from(schema.players)
    .where(and(gte(schema.players.lastSeen, cutoff), eq(schema.players.banned, 0)))
    .orderBy(desc(schema.players.lastSeen))
    .limit(60);
  const chatRows = await db
    .select()
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.cityKey, cityKey))
    .orderBy(desc(schema.chatMessages.id))
    .limit(40);
  const feedRows = await db
    .select()
    .from(schema.feedEvents)
    .orderBy(desc(schema.feedEvents.id))
    .limit(30);
  /* 排行榜按赛季（北京时间的自然月）分开：只比本月的人生 */
  const boardRows = await db
    .select()
    .from(schema.players)
    .where(and(eq(schema.players.suspect, 0), eq(schema.players.banned, 0), eq(schema.players.season, bjParts().season)))
    .orderBy(desc(schema.players.money))
    .limit(20);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const companyRows = await db
    .select({
      employer: schema.players.employer,
      count: sql<number>`count(*)`,
      money: sql<number>`coalesce(sum(${schema.players.money}), 0)`,
    })
    .from(schema.players)
    .where(and(gte(schema.players.lastSeen, weekAgo), eq(schema.players.cityKey, cityKey), eq(schema.players.suspect, 0)))
    .groupBy(schema.players.employer);
  const stampRows = await db
    .select()
    .from(schema.players)
    .where(and(eq(schema.players.suspect, 0), eq(schema.players.banned, 0)))
    .orderBy(desc(schema.players.stamps))
    .limit(10);
  return {
    online: onlineRows.map((p) => ({
      id: p.pub ?? pubOf(p.id),
      name: p.name,
      emoji: p.emoji,
      color: p.color,
      cityKey: p.cityKey,
      locId: p.locId,
      gameDay: p.gameDay,
      money: p.money,
      careerIdx: p.careerIdx,
      apecCount: p.apecCount,
      employer: p.employer,
      stamps: p.stamps,
      title: p.title,
      status: p.status,
      resultTitle: p.resultTitle,
      lastSeen: p.lastSeen.toISOString(),
      look: p.cosmetic ?? null,
    })),
    onlineSz: onlineRows.filter((p) => p.cityKey === "sz").length,
    onlineHz: onlineRows.filter((p) => p.cityKey === "hz").length,
    onlineHk: onlineRows.filter((p) => p.cityKey === "hk").length,
    chat: chatRows
      .slice()
      .reverse()
      .map((m) => ({
        id: m.id,
        playerId: pubOf(m.playerId),
        playerName: m.playerName,
        cityKey: m.cityKey,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    feed: feedRows.map((f) => ({
      id: f.id,
      playerName: f.playerName,
      kind: f.kind,
      text: f.text,
      createdAt: f.createdAt.toISOString(),
    })),
    leaderboard: boardRows.map((p) => ({
      id: p.pub ?? pubOf(p.id),
      name: p.name,
      emoji: p.emoji,
      cityKey: p.cityKey,
      money: p.money,
      careerIdx: p.careerIdx,
      apecCount: p.apecCount,
      gameDay: p.gameDay,
      status: p.status,
      resultTitle: p.resultTitle,
      look: p.cosmetic ?? null,
    })),
    companyBoard: companyRows
      .map((r) => ({ employer: r.employer, count: Number(r.count), money: Number(r.money) }))
      .sort((a, b) => b.money - a.money),
    stampBoard: stampRows
      .filter((p) => p.stamps > 0)
      .map((p) => ({ id: p.pub ?? pubOf(p.id), name: p.name, emoji: p.emoji, stamps: p.stamps, title: p.title })),
  };
}

const profileArgs = {
  playerId: z.string().min(4).max(64),
  name: z.string().trim().min(1).max(12),
  emoji: z.string().min(1).max(8),
  color: z.number().int().min(0).max(0xffffff),
  cityKey: z.enum(["sz", "hz", "hk"]),
};

const CITY_NAMES: Record<string, string> = { sz: "深圳", hz: "惠州", hk: "香港" };

/* ---- real weather (user: 天色天气应该根据真实的来) ----
   The game's sky, rain and weather readouts follow the REAL current
   weather in the city being played, fetched through the platform weather
   channel and cached per city for 30 minutes. When the channel fails the
   last good snapshot is served marked stale; when there is none the
   action reports ok:false and the client shows an honest "实况暂不可用"
   state instead of falling back to the old per-day invented weather. */
const WEATHER_TTL_MS = 30 * 60_000;
const WEATHER_CITIES = {
  sz: { zh: "深圳", en: "Shenzhen, Guangdong, China", lat: 22.5455, lon: 114.0577 },
  hz: { zh: "惠州", en: "Huizhou, Guangdong, China", lat: 23.1115, lon: 114.4152 },
  hk: { zh: "香港", en: "Hong Kong, China", lat: 22.3193, lon: 114.1694 },
} as const;

type WeatherKind =
  | "clear" | "partly" | "cloudy" | "overcast" | "fog" | "rain" | "storm" | "unknown";

function kindFromDescription(desc: string): WeatherKind {
  const d = desc.toLowerCase();
  if (/thunder|雷/.test(d)) return "storm";
  if (/rain|shower|drizzle|雨/.test(d)) return "rain";
  if (/fog|mist|haze|雾|霾/.test(d)) return "fog";
  if (/overcast|阴/.test(d)) return "overcast";
  if (/partly|多云间晴|晴间多云/.test(d)) return "partly";
  if (/cloud|云/.test(d)) return "cloudy";
  if (/clear|sunny|晴/.test(d)) return "clear";
  return "unknown";
}

const realWeatherResponse = z.object({
  ok: z.boolean(),
  stale: z.boolean(),
  cityKey: z.enum(["sz", "hz", "hk"]),
  locationName: z.string(),
  summary: z.string(),
  description: z.string(),
  kind: z.enum(["clear", "partly", "cloudy", "overcast", "fog", "rain", "storm", "unknown"]),
  temperature: z.number().nullable(),
  unit: z.string(),
  feelsLike: z.number().nullable(),
  high: z.number().nullable(),
  low: z.number().nullable(),
  humidity: z.number().nullable(),
  precipitationChance: z.number().nullable(),
  wind: z.string().nullable(),
  sunrise: z.string().nullable(),
  sunset: z.string().nullable(),
  alerts: z.array(z.string()),
  forecast: z.array(
    z.object({
      date: z.string().nullable(),
      summary: z.string().nullable(),
      high: z.number().nullable(),
      low: z.number().nullable(),
      precipitationChance: z.number().nullable(),
    }),
  ),
  sourceName: z.string(),
  sourceUrl: z.string().nullable(),
  fetchedAt: z.string(),
});

type StoredWeather = Omit<z.infer<typeof realWeatherResponse>, "stale">;


/* ---- 运营：北京时间日期 / 赛季、封禁、管理员口令 ---- */
const bjParts = (d = new Date()) => {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return { day: f, season: f.slice(0, 7) };
};
const BANNED_MSG = "你的账号因违反社区规则被限制了社交功能";
/** Admin token from the server environment (unset = admin actions disabled). */
const adminToken = (): string => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.ADMIN_TOKEN ?? ""); } catch { return ""; } };
const isAdmin = (t: string) => { const want = adminToken(); return want.length >= 12 && t === want; };
/** Who is this admin token? The ADMIN_TOKEN env value is the owner; staff tokens (admin_users) carry a role. */
type AdminRole = "owner" | "ops" | "moderator";
async function adminWho(db: ReturnType<Ctx["db"]>, token: string): Promise<{ name: string; role: AdminRole } | null> {
  if (!token) return null;
  if (isAdmin(token)) return { name: "owner", role: "owner" };
  if (token.length < 16) return null;
  const [u] = await (db as any).select().from(schema.adminUsers).where(eq(schema.adminUsers.tokenHash, createHash("sha256").update("shhr-admin:" + token).digest("hex"))).limit(1);
  return u && !u.disabled ? { name: u.name, role: u.role as AdminRole } : null;
}
/** ok when the token belongs to an admin whose role is in `roles` (owner always passes) */
async function adminOk(db: ReturnType<Ctx["db"]>, token: string, roles: AdminRole[] = ["ops", "moderator"]) {
  const w = await adminWho(db, token);
  return w && (w.role === "owner" || roles.includes(w.role)) ? w : null;
}
async function audit(db: ReturnType<Ctx["db"]>, who: { name: string } | null, action: string, target: string | null, detail: string) {
  try { await (db as any).insert(schema.adminAudit).values({ admin: who?.name ?? "?", action, target, detail: detail.slice(0, 400), createdAt: new Date() }); } catch { /* audit never blocks the action */ }
}
const MUTED_MSG = "你被管理员临时禁言了，到期后自动恢复";
const isMuted = (p: { mutedUntil?: Date | null }) => !!p.mutedUntil && p.mutedUntil.getTime() > Date.now();

/* ---- 防薅羊毛：设备、网络、活跃天数、延迟发放的邀请奖励 ---- */
const IP_SALT = "shhr-ip-v1";
const reqIp = (): string => { try { return String((globalThis as { __shhrRequestIp?: () => string }).__shhrRequestIp?.() ?? ""); } catch { return ""; } };
/** Salted hashes of the caller's IP and of its network (/24 for IPv4, /48 for IPv6) — the raw IP is never stored. */
function ipHashes(): { ipHash: string | null; ipGroup: string | null } {
  const ip = reqIp().replace(/^::ffff:/, "");
  if (!ip || ip === "?") return { ipHash: null, ipGroup: null };
  const group = ip.includes(":") ? ip.split(":").slice(0, 3).join(":") : ip.split(".").slice(0, 3).join(".");
  const h = (v: string) => createHash("sha256").update(IP_SALT + v).digest("hex").slice(0, 16);
  return { ipHash: h(ip), ipGroup: h(group) };
}
const cleanDevice = (d?: string) => (d && /^[A-Za-z0-9-]{8,64}$/.test(d) ? d : null);
const INVITE_DAYS = 3;
const INVITE_WEEKLY_CAP = 10;
/** Record device / network and count distinct active Beijing days. */
async function touchRisk(db: ReturnType<Ctx["db"]>, playerId: string, device?: string) {
  const d = db as any;
  const [p] = await d.select().from(schema.players).where(eq(schema.players.id, playerId)).limit(1);
  if (!p) return;
  const { day } = bjParts();
  const { ipHash, ipGroup } = ipHashes();
  const dev = cleanDevice(device);
  await d.update(schema.players).set({
    ...(dev ? { device: dev } : {}),
    ...(ipHash ? { ipHash, ipGroup } : {}),
    ...(p.lastActiveDay !== day ? { activeDays: (p.activeDays ?? 0) + 1, lastActiveDay: day } : {}),
  }).where(eq(schema.players.id, playerId));
}
/** Decide a pending invite: grant the inviter's reward once the invitee is genuinely playing. */
async function evaluateInvite(db: ReturnType<Ctx["db"]>, inviteeId: string) {
  const d = db as any;
  const [inv] = await d.select().from(schema.invites).where(and(eq(schema.invites.inviteeId, inviteeId), eq(schema.invites.status, "pending"))).limit(1);
  if (!inv) return;
  const decide = async (status: string, reason: string | null) => d.update(schema.invites).set({ status, reason, decidedAt: new Date() }).where(eq(schema.invites.inviteeId, inviteeId));
  if (Date.now() - inv.createdAt.getTime() > 21 * 86_400_000) return decide("expired", "21 天内没有达成条件");
  const [me] = await d.select().from(schema.players).where(eq(schema.players.id, inviteeId)).limit(1);
  const [inviter] = await d.select().from(schema.players).where(eq(schema.players.id, inv.inviterId)).limit(1);
  if (!me || !inviter) return decide("rejected", "玩家不存在");
  if ((me.activeDays ?? 0) < INVITE_DAYS) return;
  if (!me.accountId) return; // the invitee must have bound an account
  const partied = await d.select({ n: sql<number>`count(*)` }).from(schema.buddies).where(sql`${schema.buddies.a} = ${inviteeId} OR ${schema.buddies.b} = ${inviteeId}`);
  if (Number(partied[0]?.n ?? 0) === 0) return;
  if (me.banned || inviter.banned) return decide("rejected", "账号被封");
  if (me.device && me.device === inviter.device) return decide("rejected", "同一台设备");
  if (me.ipHash && (me.ipHash === inviter.ipHash || me.ipGroup === inviter.ipGroup)) return decide("rejected", "同一个网络");
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const granted = await d.select({ n: sql<number>`count(*)` }).from(schema.invites).where(and(eq(schema.invites.inviterId, inv.inviterId), eq(schema.invites.status, "granted"), gte(schema.invites.decidedAt, weekAgo)));
  if (Number(granted[0]?.n ?? 0) >= INVITE_WEEKLY_CAP) return decide("rejected", "邀请人本周奖励已达上限");
  await decide("granted", null);
  await d.insert(schema.gifts).values({ fromId: me.id, fromName: me.name, toId: inviter.id, kind: "invite", company: null, createdAt: new Date() });
  await d.insert(schema.feedEvents).values({ playerId: inviter.id, playerName: inviter.name, kind: "life", text: `邀请的朋友${me.name}在城里站稳了脚跟`, createdAt: new Date() });
}

/* ---- 经济：服务器记账 ----
   The run is simulated in the browser, so the client PROPOSES its balance in
   each heartbeat; the server keeps its own. Spending is always accepted.
   Earning is accepted up to an earning budget that refills with real time
   (EARN_RATE, capped at EARN_CAP) plus a share per game day that passed
   offline; anything beyond is clamped, written to the ledger as "clamped",
   and the client is told to fall back to the server's figure. Rewards the
   server grants itself (sign-in, streak, welcome) are credited directly.
   Every accepted change is a ledger row, so a balance can be audited or
   rolled back. Leaderboards read the server's balance only. */
const EARN_CAP = 60_000;
const EARN_RATE = MAX_EARN_PER_DAY / (3 * 3600_000); // per ms: a full day's best wage every 3 real hours
const SEASON_START_CAP = 30_000;
type PlayerRow = typeof schema.players.$inferSelect;
async function writeLedger(db: ReturnType<Ctx["db"]>, playerId: string, season: string, kind: string, amount: number, balance: number, note?: string) {
  if (!amount && kind !== "season-start") return;
  await (db as any).insert(schema.ledger).values({ playerId, season, kind, amount, balance, note: note ?? null, createdAt: new Date() });
}
async function settleMoney(db: ReturnType<Ctx["db"]>, prev: PlayerRow, proposed: number, season: string, gameDay: number) {
  const now = Date.now();
  // first heartbeat after this system went live, or a new season: take the client's figure as the baseline (capped for a new season)
  if (!prev.budgetAt || season !== prev.season) {
    const base = season !== prev.season ? Math.min(proposed, SEASON_START_CAP) : proposed;
    await writeLedger(db, prev.id, season, season !== prev.season ? "season-start" : "baseline", base - (season !== prev.season ? 0 : prev.money), base);
    return { money: base, reported: base, budget: EARN_CAP, corrected: base !== proposed, cheat: false };
  }
  const dayDelta = Math.max(0, gameDay - prev.gameDay);
  let budget = Math.min(EARN_CAP, prev.earnBudget + Math.floor((now - prev.budgetAt.getTime()) * EARN_RATE)) + Math.floor(dayDelta * MAX_EARN_PER_DAY * 0.6);
  const delta = proposed - prev.reportedMoney;
  let money = prev.money; let corrected = false;
  if (delta <= 0) { money += delta; await writeLedger(db, prev.id, season, "spend", delta, money); }
  else {
    // one jump bigger than a whole budget is no play at all: credit nothing
    const ok = delta > EARN_CAP ? 0 : Math.min(delta, budget);
    budget -= ok; money += ok;
    await writeLedger(db, prev.id, season, "earn", ok, money);
    if (ok < delta) { corrected = true; await writeLedger(db, prev.id, season, "clamped", -(delta - ok), money, `proposed ${proposed}`); }
  }
  return { money, reported: corrected ? money : proposed, budget: Math.max(0, Math.min(EARN_CAP * 2, budget)), corrected, cheat: delta > EARN_CAP };
}
/** Server-granted money (rewards): goes straight onto both balances, so the client's own +amount is not counted twice. */
async function creditMoney(db: ReturnType<Ctx["db"]>, playerId: string, amount: number, note: string) {
  const d = db as any;
  const [p] = await d.select().from(schema.players).where(eq(schema.players.id, playerId)).limit(1);
  if (!p || !amount) return;
  await d.update(schema.players).set({ money: p.money + amount, reportedMoney: p.reportedMoney + amount }).where(eq(schema.players.id, playerId));
  await writeLedger(db, playerId, p.season, "reward", amount, p.money + amount, note);
}

/* ---- 账号：验证码登录、会话、绑定游客进度 ---- */
const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const envFlag = (k: string): string => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[k] ?? ""); } catch { return ""; } };
/** Social features (DMs, parties) need a bound account unless SOCIAL_REQUIRES_ACCOUNT=0. */
const socialNeedsAccount = () => envFlag("SOCIAL_REQUIRES_ACCOUNT") !== "0";
const NEED_ACCOUNT = "先绑定账号（右上角 👤 账号），才能私聊和组局——防骚扰、防小号";

/* ---- 🎶 Livehouse ---- */
const TRACK_MAX_BYTES = 6_000_000;
const TRACK_BOOST_STARS = 300;
const TRACK_VIEW = z.object({ id: z.number(), artist: z.string(), title: z.string(), durationSec: z.number(), chunks: z.number(), featured: z.boolean() });
/* ---- 📢 广告牌 ---- */
const BILLBOARD_STARS = 300;
const BILLBOARD_DAYS = 7;
/* ---- 零工 helpers ---- */
type GigRow = typeof schema.gigs.$inferSelect;
const GIG_VIEW = z.object({ id: z.number(), title: z.string(), pay: z.number(), status: z.string(), reason: z.string().nullable(), employer: z.object({ id: z.string(), name: z.string(), emoji: z.string() }), worker: z.object({ id: z.string(), name: z.string(), emoji: z.string() }).nullable(), role: z.enum(["employer", "worker", "none"]), dueAt: z.string().nullable(), canDeliverAt: z.string().nullable(), votes: z.object({ worker: z.number(), employer: z.number() }) });
async function gigView(db: Db, g: GigRow, me: string) {
  const who = async (id: string | null) => { if (!id) return null; const [p] = await db.select().from(schema.players).where(eq(schema.players.id, id)).limit(1); return p ? { id: p.pub ?? pubOf(p.id), name: p.name, emoji: p.emoji } : { id: "?", name: "?", emoji: "🙂" }; };
  const vs = g.status === "disputed" ? await db.select().from(schema.gigVotes).where(eq(schema.gigVotes.gigId, g.id)) : [];
  return {
    id: g.id, title: g.title, pay: g.pay, status: g.status, reason: g.reason ?? null,
    employer: (await who(g.employerId))!, worker: await who(g.workerId),
    role: (g.employerId === me ? "employer" : g.workerId === me ? "worker" : "none") as "employer" | "worker" | "none",
    dueAt: g.dueAt ? g.dueAt.toISOString() : null,
    canDeliverAt: g.takenAt ? new Date(g.takenAt.getTime() + 120_000).toISOString() : null,
    votes: { worker: vs.filter((v: { side: string }) => v.side === "worker").length, employer: vs.filter((v: { side: string }) => v.side === "employer").length },
  };
}
/** time's up: delivered jobs pay out after 2 h; disputes close after 24 h (tie goes to the worker) */
async function settleGigs(db: Db) {
  const now = new Date();
  await db.update(schema.gigs).set({ status: "paid" }).where(and(eq(schema.gigs.status, "delivered"), sql`${schema.gigs.dueAt} <= ${now.getTime()}`));
  const due = await db.select().from(schema.gigs).where(and(eq(schema.gigs.status, "disputed"), sql`${schema.gigs.dueAt} <= ${now.getTime()}`));
  for (const g of due) {
    const vs = await db.select().from(schema.gigVotes).where(eq(schema.gigVotes.gigId, g.id));
    const w = vs.filter((v: { side: string }) => v.side === "worker").length, e = vs.filter((v: { side: string }) => v.side === "employer").length;
    await db.update(schema.gigs).set({ status: e > w ? "refunded" : "paid" }).where(and(eq(schema.gigs.id, g.id), eq(schema.gigs.status, "disputed")));
  }
}
/* ---- 真人关系 + 业委会 helpers ---- */
const BOND_KINDS = ["roommate", "sworn", "partner"] as const;
type BondKind = (typeof BOND_KINDS)[number];
const PLEDGES = ["rent", "metro", "eat"] as const;
type Pledge = (typeof PLEDGES)[number];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;
/** room for one more bond of this kind: one roommate, one partner, up to three sworn siblings */
async function bondRoom(db: Db, who: string, kind: BondKind): Promise<string | null> {
  const n = await db.select({ n: sql<number>`count(*)` }).from(schema.bonds)
    .where(sql`(${schema.bonds.a} = ${who} OR ${schema.bonds.b} = ${who}) AND ${schema.bonds.kind} = ${kind} AND ${schema.bonds.status} = 'active'`);
  const have = Number(n[0]?.n ?? 0);
  if (kind === "roommate" && have >= 1) return "已经有室友了，一间房只能两个人合租";
  if (kind === "partner" && have >= 1) return "已经有另一半了";
  if (kind === "sworn" && have >= 3) return "结拜的兄弟姐妹最多 3 个";
  return null;
}
/** Beijing-time week number (weeks start Monday 00:00 Beijing) */
const bjWeek = (ms = Date.now()) => Math.floor((Math.floor((ms + 8 * 3600_000) / 86_400_000) + 3) / 7);
const weekStartMs = (week: number) => (week * 7 - 3) * 86_400_000 - 8 * 3600_000;
async function committeeRace(db: Db, week: number, city: string): Promise<{ playerId: string; pub: string; name: string; emoji: string; pledge: Pledge; votes: number; at: number }[]> {
  const cands = await db.select().from(schema.committeeCandidates).where(and(eq(schema.committeeCandidates.week, week), eq(schema.committeeCandidates.city, city)));
  const out = [];
  for (const c of cands) {
    const [pl] = await db.select().from(schema.players).where(eq(schema.players.id, c.playerId)).limit(1);
    if (!pl || pl.banned) continue;
    const v = await db.select({ n: sql<number>`count(*)` }).from(schema.committeeVotes).where(and(eq(schema.committeeVotes.week, week), eq(schema.committeeVotes.city, city), eq(schema.committeeVotes.candidateId, c.playerId)));
    out.push({ playerId: c.playerId, pub: pl.pub ?? pubOf(pl.id), name: pl.name, emoji: pl.emoji, pledge: c.pledge as Pledge, votes: Number(v[0]?.n ?? 0), at: c.createdAt.getTime() });
  }
  return out.sort((x, y) => y.votes - x.votes || x.at - y.at).slice(0, 20);
}
function normSubject(provider: "email" | "phone", to: string): string | null {
  const t = to.trim();
  if (provider === "email") { const e = t.toLowerCase(); return /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/.test(e) ? e : null; }
  const d = t.replace(/[\s-]/g, "");
  if (/^1\d{10}$/.test(d)) return `+86${d}`;
  return /^\+\d{8,15}$/.test(d) ? d : null;
}
const maskSubject = (provider: string, s2: string) => provider === "email" ? s2.replace(/^(.).*(@.*)$/, "$1***$2") : s2.replace(/^(\+\d{2,3})\d+(\d{4})$/, "$1****$2");
type CodeSender = (provider: "email" | "phone", to: string, code: string) => Promise<void>;
async function sessionAccount(db: ReturnType<Ctx["db"]>, token: string) {
  const d = db as any;
  if (!token || token.length < 32) return null;
  const [sess] = await d.select().from(schema.sessions).where(eq(schema.sessions.tokenHash, sha(token))).limit(1);
  if (!sess || sess.revokedAt) return null;
  const [acc] = await d.select().from(schema.accounts).where(eq(schema.accounts.id, sess.accountId)).limit(1);
  if (!acc || acc.status !== "active") return null;
  if (Date.now() - sess.lastUsedAt.getTime() > 3600_000) await d.update(schema.sessions).set({ lastUsedAt: new Date() }).where(eq(schema.sessions.tokenHash, sess.tokenHash));
  return acc as typeof schema.accounts.$inferSelect;
}

/* ---- ✨星光商店：充值、赛季通行证、会员、外观 ----
   ✨ belongs to the ACCOUNT (not the run) and lives only on the server: an
   append-only ledger whose (reason, ref) pair is unique, so a paid order or a
   pass level can never be credited twice. ✨ buys looks and conveniences
   only — never money, stats or rank. Payments: Stripe Checkout when
   STRIPE_SECRET_KEY is set (fulfilled only by the signed webhook), or
   DEV_PAYMENTS=1 for local testing (a fake "pay" button). */
const PRODUCTS = {
  stars_60: { kind: "stars", stars: 60, bonus: 0, usd: 99, cny: 600, name: "60 ✨" },
  stars_300: { kind: "stars", stars: 300, bonus: 30, usd: 499, cny: 3000, name: "300 ✨ +30" },
  stars_980: { kind: "stars", stars: 980, bonus: 150, usd: 1499, cny: 9800, name: "980 ✨ +150" },
  season_pass: { kind: "pass", stars: 0, bonus: 0, usd: 399, cny: 2800, name: "赛季通行证" },
  member_month: { kind: "member", stars: 0, bonus: 0, usd: 299, cny: 1800, name: "深漂会员 · 30 天" },
} as const;
type ProductId = keyof typeof PRODUCTS;
const SHOP = {
  "name-gold": { stars: 120, kind: "name", label: "金色昵称" },
  "name-jade": { stars: 120, kind: "name", label: "翡翠绿昵称" },
  "name-rose": { stars: 120, kind: "name", label: "玫瑰粉昵称" },
  "title-veteran": { stars: 80, kind: "title", label: "称号 · 深漂老炮" },
  "title-harbour": { stars: 80, kind: "title", label: "称号 · 维港夜归人" },
} as const;
type ShopId = keyof typeof SHOP;
const PASS_LEVELS = 30;
const PASS_FREE = new Set([3, 7, 14, 21, 28]);
/** pass rewards: free track 10✨ at a few levels; paid track 8✨ every level plus looks */
const passReward = (track: "free" | "paid", level: number): { stars: number; item?: ShopId } =>
  track === "free" ? (PASS_FREE.has(level) ? { stars: 10 } : { stars: 0 })
  : level === 7 ? { stars: 8, item: "title-veteran" } : level === 14 ? { stars: 8, item: "name-jade" } : level === 21 ? { stars: 8, item: "title-harbour" } : { stars: 8 };
const MEMBER_DAILY = 10;
const payMode = () => (envFlag("STRIPE_SECRET_KEY") ? "stripe" : envFlag("DEV_PAYMENTS") === "1" ? "dev" : "off");
async function starBalance(db: ReturnType<Ctx["db"]>, accountId: string): Promise<number> {
  const [r] = await (db as any).select().from(schema.starLedger).where(eq(schema.starLedger.accountId, accountId)).orderBy(desc(schema.starLedger.id)).limit(1);
  return r?.balance ?? 0;
}
/** Append to the ✨ ledger; false when this (reason, ref) was already booked or the balance would go negative (unless allowNegative). */
async function bookStars(db: ReturnType<Ctx["db"]>, accountId: string, amount: number, reason: string, ref: string, allowNegative = false): Promise<boolean> {
  const d = db as any;
  const [dup] = await d.select().from(schema.starLedger).where(and(eq(schema.starLedger.reason, reason), eq(schema.starLedger.ref, ref))).limit(1);
  if (dup) return false;
  const bal = await starBalance(db, accountId);
  if (!allowNegative && bal + amount < 0) return false;
  try { await d.insert(schema.starLedger).values({ accountId, amount, balance: bal + amount, reason, ref, createdAt: new Date() }); } catch { return false; }
  return true;
}
const activeEnt = (rows: (typeof schema.entitlements.$inferSelect)[], kind: string) => rows.filter((e) => e.kind === kind && !e.revokedAt);
async function grantItem(db: ReturnType<Ctx["db"]>, accountId: string, item: ShopId, orderId: string | null) {
  const d = db as any;
  const [have] = await d.select().from(schema.entitlements).where(and(eq(schema.entitlements.accountId, accountId), eq(schema.entitlements.kind, "item"), eq(schema.entitlements.item, item))).limit(1);
  if (!have) await d.insert(schema.entitlements).values({ accountId, kind: "item", item, orderId, createdAt: new Date() });
}
/** Pay out an order exactly once (Stripe webhook or dev mode). */
async function fulfilOrder(db: ReturnType<Ctx["db"]>, orderId: string, providerRef: string | null): Promise<boolean> {
  const d = db as any;
  const [o] = await d.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
  if (!o || o.status !== "pending") return false;
  await d.update(schema.orders).set({ status: "paid", paidAt: new Date(), providerRef }).where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, "pending")));
  const pr = PRODUCTS[o.product as ProductId];
  if (!pr) return false;
  if (pr.kind === "stars") await bookStars(db, o.accountId, pr.stars + pr.bonus, "purchase", orderId);
  else if (pr.kind === "pass") await d.insert(schema.entitlements).values({ accountId: o.accountId, kind: "pass", item: "season_pass", season: bjParts().season, orderId, createdAt: new Date() });
  else {
    const ents = await d.select().from(schema.entitlements).where(and(eq(schema.entitlements.accountId, o.accountId), eq(schema.entitlements.kind, "member")));
    const until = Math.max(Date.now(), ...activeEnt(ents, "member").map((e: any) => e.expiresAt?.getTime() ?? 0));
    await d.insert(schema.entitlements).values({ accountId: o.accountId, kind: "member", item: "member_month", expiresAt: new Date(until + 30 * 86_400_000), orderId, createdAt: new Date() });
  }
  return true;
}
/** A refund takes back what the order gave (✨ may go negative: buying is then locked). */
async function refundOrder(db: ReturnType<Ctx["db"]>, orderId: string) {
  const d = db as any;
  const [o] = await d.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
  if (!o || o.status !== "paid") return;
  await d.update(schema.orders).set({ status: "refunded", refundedAt: new Date() }).where(eq(schema.orders.id, orderId));
  const pr = PRODUCTS[o.product as ProductId];
  if (pr?.kind === "stars") await bookStars(db, o.accountId, -(pr.stars + pr.bonus), "refund", orderId, true);
  else await d.update(schema.entitlements).set({ revokedAt: new Date() }).where(eq(schema.entitlements.orderId, orderId));
}
async function stripeCheckout(order: { id: string; amount: number; currency: string; name: string }, origin: string): Promise<string> {
  const key = envFlag("STRIPE_SECRET_KEY");
  const body = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": order.currency,
    "line_items[0][price_data][unit_amount]": String(order.amount),
    "line_items[0][price_data][product_data][name]": order.name,
    "metadata[order_id]": order.id,
    "payment_intent_data[metadata][order_id]": order.id,
    client_reference_id: order.id,
    success_url: `${origin}/?paid=${order.id}`,
    cancel_url: `${origin}/?paid=cancel`,
  });
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" }, body });
  const j = await r.json() as { url?: string; error?: { message?: string } };
  if (!r.ok || !j.url) throw new Error(j.error?.message ?? `stripe ${r.status}`);
  return j.url;
}

/** Season-pass level: one per Beijing day this season the character signed in (server-recorded). */
async function passLevel(db: ReturnType<Ctx["db"]>, playerId: string | null, season: string): Promise<number> {
  if (!playerId) return 0;
  const r = await (db as any).select({ n: sql<number>`count(*)` }).from(schema.rewardClaims).where(and(eq(schema.rewardClaims.playerId, playerId), eq(schema.rewardClaims.kind, "signin"), sql`substr(${schema.rewardClaims.day}, 1, 7) = ${season}`));
  return Math.min(PASS_LEVELS, Number(r[0]?.n ?? 0));
}

/* ---- 组局 parties ---- */
type PartyMember = { pid: string; id: string; name: string; emoji: string; score: number | null };
const PARTY_MAX = 6;
const PARTY_OPEN_MS = 30 * 60_000;
const PARTY_PLAY_MS = 10 * 60_000;
const partyShape = z.object({
  id: z.number(), hostId: z.string(), hostName: z.string(), cityKey: z.string(), locId: z.string(), locName: z.string(),
  activityId: z.string(), status: z.string(), createdAt: z.string(), startedAt: z.string().nullable(),
  members: z.array(z.object({ id: z.string(), name: z.string(), emoji: z.string(), score: z.number().nullable(), buddy: z.number() })),
});
const parseMembers = (raw: string): PartyMember[] => { try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; } };
const pairKey = (x: string, y: string) => (x < y ? [x, y] as const : [y, x] as const);
async function bumpBuddies(db: ReturnType<Ctx["db"]>, members: PartyMember[]) {
  const played = members.filter((m) => m.score !== null);
  for (let i = 0; i < played.length; i++) for (let j = i + 1; j < played.length; j++) {
    const [a, b] = pairKey(played[i]!.pid, played[j]!.pid);
    await (db as any).insert(schema.buddies).values({ a, b, n: 1, lastAt: new Date() })
      .onConflictDoUpdate({ target: [schema.buddies.a, schema.buddies.b], set: { n: sql`${schema.buddies.n} + 1`, lastAt: new Date() } });
  }
}

export const Actions = {
  joinWorld: defineAction({
    description:
      "Registers (or re-registers) a player in the shared Shenzhen/Huizhou city and returns the current world snapshot.",
    request: z.object({ ...profileArgs, device: z.string().max(64).optional(), invitedBy: z.string().max(64).optional() }),
    response: z.object({ world: worldResponse, me: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const now = new Date();
      args = { ...args, name: cleanName(args.name) };
      const pub = pubOf(args.playerId);
      const existing = await db
        .select()
        .from(schema.players)
        .where(eq(schema.players.id, args.playerId))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(schema.players).values({
          id: args.playerId,
          name: args.name,
          emoji: args.emoji,
          color: args.color,
          cityKey: args.cityKey,
          locId: "home",
          pub,
          lastSeen: now,
          createdAt: now,
        });
        // 进城动态只发一次：同昵称以前进过城就不再发——换设备、清存档
        // 都会生成新的 playerId，但对看动态的人来说还是同一个人，
        // 重复的「来到了…」只会刷屏（客户端展示时也会再合并一次）。
        const priorJoin = await db
          .select()
          .from(schema.feedEvents)
          .where(
            and(
              eq(schema.feedEvents.playerName, args.name),
              eq(schema.feedEvents.kind, "join"),
            ),
          )
          .limit(1);
        if (priorJoin.length === 0) {
          await db.insert(schema.feedEvents).values({
            playerId: args.playerId,
            playerName: args.name,
            kind: "join",
            text: `来到了${CITY_NAMES[args.cityKey] ?? "深圳"}，开始过日子`,
            createdAt: now,
          });
        }
      } else {
        const prev = existing[0];
        if (!prev) throw new Error("joinWorld: player vanished");
        // Re-entering after a finished season starts a fresh run.
        const freshRun =
          prev.status === "finished"
            ? {
                status: "playing" as const,
                resultTitle: null,
                gameDay: 1,
                money: 0,
                careerIdx: 0,
                apecCount: 0,
                locId: "home",
                suspect: 0,
              }
            : {};
        await db
          .update(schema.players)
          .set({
            name: args.name,
            emoji: args.emoji,
            color: args.color,
            cityKey: args.cityKey,
            pub,
            lastSeen: now,
            ...freshRun,
          })
          .where(eq(schema.players.id, args.playerId));
      }
      await touchRisk(db, args.playerId, args.device);
      /* 邀请：只记一条「待定」，被邀请人连续玩 3 天、和真人组过局后才给邀请人发奖励 */
      if (existing.length === 0 && args.invitedBy) {
        const [inviter] = await db.select().from(schema.players).where(eq(schema.players.pub, args.invitedBy)).limit(1);
        if (inviter && inviter.id !== args.playerId) await db.insert(schema.invites).values({ inviteeId: args.playerId, inviterId: inviter.id, status: "pending", createdAt: now }).onConflictDoNothing();
      }
      dropWorldCache();
      ctx.invalidateQueries();
      return { world: await loadWorldCached(ctx, args.cityKey), me: pub };
    },
  }),

  syncPresence: defineAction({
    description:
      "Heartbeat: updates a player's current location and run snapshot, returns the fresh world snapshot.",
    request: z.object({
      playerId: z.string().min(4).max(64),
      cityKey: z.enum(["sz", "hz", "hk"]),
      locId: z.string().min(1).max(32),
      gameDay: z.number().int().min(1).max(31),
      money: z.number().int().min(-1000000).max(100000000),
      careerIdx: z.number().int().min(0).max(4),
      apecCount: z.number().int().min(0).max(999),
      employer: z.string().min(1).max(24).optional(),
      stamps: z.number().int().min(0).max(999).optional(),
      title: z.string().max(16).nullable().optional(),
      season: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      device: z.string().max(64).optional(),
    }),
    response: z.object({ world: worldResponse, inbox: z.array(giftShape), me: z.string(), bank: z.object({ money: z.number(), corrected: z.boolean() }).optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      /* 防作弊：the simulation runs on the client, so the server checks each
         heartbeat against the last one. A jump no real play can produce
         (money far beyond a day's best wage, two 职级 at once, dozens of
         stamps in five seconds) flags the player, who then drops off every
         leaderboard. Nothing is deleted or reset — see the EFCC lesson. */
      const [prev] = await db.select().from(schema.players).where(eq(schema.players.id, args.playerId)).limit(1);
      let suspect = prev?.suspect ?? 0;
      if (prev && prev.status === "playing") {
        const dayDelta = Math.max(0, args.gameDay - prev.gameDay);
        const allowance = (dayDelta + 1) * MAX_EARN_PER_DAY + 30_000;
        if (args.money > Math.max(prev.money, 0) + allowance) suspect = 1;
        if (args.careerIdx > prev.careerIdx + 1) suspect = 1;
        if (args.stamps !== undefined && args.stamps > prev.stamps + 60) suspect = 1;
      }
      const bank = prev ? await settleMoney(db, prev, args.money, args.season ?? prev.season, args.gameDay) : null;
      if (bank?.cheat) suspect = 1;
      await db
        .update(schema.players)
        .set({
          suspect,
          ...(bank ? { reportedMoney: bank.reported, earnBudget: bank.budget, budgetAt: new Date() } : {}),
          pub: pubOf(args.playerId),
          cityKey: args.cityKey,
          locId: args.locId,
          gameDay: args.gameDay,
          money: bank ? bank.money : args.money,
          careerIdx: args.careerIdx,
          apecCount: args.apecCount,
          ...(args.employer !== undefined ? { employer: args.employer } : {}),
          ...(args.stamps !== undefined ? { stamps: args.stamps } : {}),
          ...(args.title !== undefined ? { title: args.title } : {}),
          ...(args.season !== undefined ? { season: args.season } : {}),
          lastSeen: new Date(),
        })
        .where(eq(schema.players.id, args.playerId));
      await touchRisk(db, args.playerId, args.device);
      await evaluateInvite(db, args.playerId);
      const inboxRows = await db
        .select()
        .from(schema.gifts)
        .where(and(eq(schema.gifts.toId, args.playerId), eq(schema.gifts.claimed, 0)))
        .orderBy(desc(schema.gifts.id))
        .limit(10);
      return {
        world: await loadWorldCached(ctx, args.cityKey),
        inbox: inboxRows.map((g) => ({ id: g.id, fromId: pubOf(g.fromId), fromName: g.fromName, kind: g.kind, company: g.company, createdAt: g.createdAt.toISOString() })),
        me: pubOf(args.playerId),
        ...(bank ? { bank: { money: bank.money, corrected: bank.corrected } } : {}),
      };
    },
  }),

  /* ---- 送礼：给在线的真人玩家送奶茶 / 早餐 / 红包 / 内推 ---- */
  sendGift: defineAction({
    description: "Sends a small gift (tea, breakfast, red packet or job referral) to another player.",
    request: z.object({
      playerId: z.string().min(4).max(64),
      toId: z.string().min(4).max(64),
      kind: z.enum(GIFT_KINDS),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args): Promise<{ ok: boolean; error?: string }> {
      const db = ctx.db<typeof schema>();
      // toId is the receiver's PUBLIC id (what the online list shows)
      const [me] = await db.select().from(schema.players).where(eq(schema.players.id, args.playerId)).limit(1);
      const [to] = await db.select().from(schema.players).where(eq(schema.players.pub, args.toId)).limit(1);
      if (me && to && me.id === to.id) return { ok: false, error: "不能送给自己" };
      if (me?.banned) return { ok: false, error: BANNED_MSG };
      if (!me || !to) return { ok: false, error: "对方不在线了" };
      const dayAgo = new Date(Date.now() - 86_400_000);
      const sent = await db
        .select({ n: sql<number>`count(*)` })
        .from(schema.gifts)
        .where(and(eq(schema.gifts.fromId, me.id), gte(schema.gifts.createdAt, dayAgo)));
      if (Number(sent[0]?.n ?? 0) >= 10) return { ok: false, error: "今天送得太多了，明天再送" };
      if (args.kind === "invite") return { ok: false, error: "邀请奖励由系统在朋友玩满 3 天后自动发放" };
      await db.insert(schema.gifts).values({
        fromId: me.id,
        fromName: me.name,
        toId: to.id,
        kind: args.kind,
        company: args.kind === "referral" ? me.employer : null,
        createdAt: new Date(),
      });
      const label = { tea: "一杯奶茶", breakfast: "一份早餐", hongbao: "一个红包", referral: "一次内推", invite: "一声谢谢：被邀请来深惠过日子" }[args.kind];
      await db.insert(schema.feedEvents).values({ playerId: me.id, playerName: me.name, kind: "life", text: `给${to.name}送了${label}`, createdAt: new Date() });
      dropWorldCache();
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  claimGift: defineAction({
    description: "Claims one of the player's unclaimed gifts; the client applies its effect.",
    request: z.object({ playerId: z.string().min(4).max(64), giftId: z.number().int() }),
    response: z.object({ ok: z.boolean(), gift: giftShape.nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [g] = await db
        .select()
        .from(schema.gifts)
        .where(and(eq(schema.gifts.id, args.giftId), eq(schema.gifts.toId, args.playerId), eq(schema.gifts.claimed, 0)))
        .limit(1);
      if (!g) return { ok: false, gift: null };
      await db.update(schema.gifts).set({ claimed: 1 }).where(eq(schema.gifts.id, g.id));
      return { ok: true, gift: { id: g.id, fromId: pubOf(g.fromId), fromName: g.fromName, kind: g.kind, company: g.company, createdAt: g.createdAt.toISOString() } };
    },
  }),

  getParties: defineAction({
    description: "Lists open / running / just-finished parties (组局) in a city, with how often the caller has played with each member.",
    request: z.object({ cityKey: z.enum(["sz", "hz", "hk"]), playerId: z.string().min(4).max(64) }),
    response: z.object({ parties: z.array(partyShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const now = Date.now();
      const rows = await db.select().from(schema.parties)
        .where(and(eq(schema.parties.cityKey, args.cityKey), gte(schema.parties.createdAt, new Date(now - 2 * 3600_000))))
        .orderBy(desc(schema.parties.id)).limit(40);
      const out: z.infer<typeof partyShape>[] = [];
      for (const r of rows) {
        let status = r.status;
        const members = parseMembers(r.members);
        if (status === "open" && now - r.createdAt.getTime() > PARTY_OPEN_MS) { status = "expired"; await db.update(schema.parties).set({ status }).where(eq(schema.parties.id, r.id)); }
        if (status === "playing" && r.startedAt && now - r.startedAt.getTime() > PARTY_PLAY_MS) { status = "done"; await db.update(schema.parties).set({ status }).where(eq(schema.parties.id, r.id)); await bumpBuddies(db, members); }
        if (status === "expired" || status === "cancelled") continue;
        if (status === "done" && now - (r.startedAt?.getTime() ?? 0) > 20 * 60_000) continue;
        const buddyN: number[] = [];
        for (const m of members) {
          if (m.pid === args.playerId) { buddyN.push(0); continue; }
          const [a, b] = pairKey(m.pid, args.playerId);
          const [row] = await db.select().from(schema.buddies).where(and(eq(schema.buddies.a, a), eq(schema.buddies.b, b))).limit(1);
          buddyN.push(row?.n ?? 0);
        }
        out.push({ id: r.id, hostId: pubOf(r.hostId), hostName: r.hostName, cityKey: r.cityKey, locId: r.locId, locName: r.locName, activityId: r.activityId, status,
          createdAt: r.createdAt.toISOString(), startedAt: r.startedAt?.toISOString() ?? null,
          members: members.map((m, i) => ({ id: m.id, name: m.name, emoji: m.emoji, score: m.score, buddy: buddyN[i] ?? 0 })) });
      }
      return { parties: out };
    },
  }),

  createParty: defineAction({
    description: "Opens a party (组局) for an activity at a place; other players in the city can join.",
    request: z.object({ playerId: z.string().min(4).max(64), cityKey: z.enum(["sz", "hz", "hk"]), locId: z.string().max(80), locName: z.string().max(40), activityId: z.string().max(40), title: z.string().max(30) }),
    response: z.object({ ok: z.boolean(), id: z.number().optional(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [me] = await db.select().from(schema.players).where(eq(schema.players.id, args.playerId)).limit(1);
      if (!me) return { ok: false, error: "先进城再组局" };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (socialNeedsAccount() && !me.accountId) return { ok: false, error: NEED_ACCOUNT };
      const recent = await db.select({ n: sql<number>`count(*)` }).from(schema.parties).where(and(eq(schema.parties.hostId, me.id), gte(schema.parties.createdAt, new Date(Date.now() - 3600_000))));
      if (Number(recent[0]?.n ?? 0) >= 12) return { ok: false, error: "组局太频繁了，歇一会儿" };
      await db.update(schema.parties).set({ status: "cancelled" }).where(and(eq(schema.parties.hostId, me.id), eq(schema.parties.status, "open")));
      const members: PartyMember[] = [{ pid: me.id, id: pubOf(me.id), name: me.name, emoji: me.emoji, score: null }];
      const [row] = await db.insert(schema.parties).values({ hostId: me.id, hostName: me.name, cityKey: args.cityKey, locId: args.locId, locName: cleanText(args.locName).slice(0, 40), activityId: args.activityId, members: JSON.stringify(members), status: "open", createdAt: new Date() }).returning();
      await db.insert(schema.feedEvents).values({ playerId: me.id, playerName: me.name, kind: "life", text: `在${cleanText(args.locName)}组了个局：${cleanText(args.title)}，快来一起！`, createdAt: new Date() });
      dropWorldCache(); ctx.invalidateQueries();
      return { ok: true, id: row?.id };
    },
  }),

  joinParty: defineAction({
    description: "Joins an open party; leaves any other open party the player was in.",
    request: z.object({ playerId: z.string().min(4).max(64), partyId: z.number().int() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [me] = await db.select().from(schema.players).where(eq(schema.players.id, args.playerId)).limit(1);
      const [p] = await db.select().from(schema.parties).where(eq(schema.parties.id, args.partyId)).limit(1);
      if (!me || !p) return { ok: false, error: "这个局不存在了" };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (socialNeedsAccount() && !me.accountId) return { ok: false, error: NEED_ACCOUNT };
      if (p.status !== "open") return { ok: false, error: "这个局已经开始或散了" };
      const members = parseMembers(p.members);
      if (members.some((m) => m.pid === me.id)) return { ok: true };
      if (members.length >= PARTY_MAX) return { ok: false, error: "人满了" };
      const others = await db.select().from(schema.parties).where(and(eq(schema.parties.cityKey, p.cityKey), eq(schema.parties.status, "open")));
      for (const o of others) {
        const ms = parseMembers(o.members);
        if (o.id !== p.id && ms.some((m) => m.pid === me.id)) await db.update(schema.parties).set({ members: JSON.stringify(ms.filter((m) => m.pid !== me.id)) }).where(eq(schema.parties.id, o.id));
      }
      members.push({ pid: me.id, id: pubOf(me.id), name: me.name, emoji: me.emoji, score: null });
      await db.update(schema.parties).set({ members: JSON.stringify(members) }).where(eq(schema.parties.id, p.id));
      return { ok: true };
    },
  }),

  leaveParty: defineAction({
    description: "Leaves a party; if the host leaves an open party it is cancelled.",
    request: z.object({ playerId: z.string().min(4).max(64), partyId: z.number().int() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [p] = await db.select().from(schema.parties).where(eq(schema.parties.id, args.partyId)).limit(1);
      if (!p) return { ok: false };
      if (p.hostId === args.playerId && p.status === "open") { await db.update(schema.parties).set({ status: "cancelled" }).where(eq(schema.parties.id, p.id)); return { ok: true }; }
      const members = parseMembers(p.members).filter((m) => m.pid !== args.playerId || m.score !== null);
      await db.update(schema.parties).set({ members: JSON.stringify(members) }).where(eq(schema.parties.id, p.id));
      return { ok: true };
    },
  }),

  startParty: defineAction({
    description: "The host starts the party: every member now plays the mini-game.",
    request: z.object({ playerId: z.string().min(4).max(64), partyId: z.number().int() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [p] = await db.select().from(schema.parties).where(eq(schema.parties.id, args.partyId)).limit(1);
      if (!p || p.hostId !== args.playerId) return { ok: false, error: "只有发起人能开始" };
      if (p.status !== "open") return { ok: false, error: "已经开始了" };
      await db.update(schema.parties).set({ status: "playing", startedAt: new Date() }).where(eq(schema.parties.id, p.id));
      return { ok: true };
    },
  }),

  submitPartyScore: defineAction({
    description: "Submits the caller's mini-game score for a running party; the party finishes once everyone has played.",
    request: z.object({ playerId: z.string().min(4).max(64), partyId: z.number().int(), score: z.number().min(0).max(1) }),
    response: z.object({ ok: z.boolean(), done: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [p] = await db.select().from(schema.parties).where(eq(schema.parties.id, args.partyId)).limit(1);
      if (!p || p.status !== "playing") return { ok: false, done: p?.status === "done" };
      const members = parseMembers(p.members);
      const m = members.find((x) => x.pid === args.playerId);
      if (!m || m.score !== null) return { ok: false, done: false };
      m.score = Math.round(args.score * 100) / 100;
      const done = members.every((x) => x.score !== null);
      await db.update(schema.parties).set({ members: JSON.stringify(members), ...(done ? { status: "done" } : {}) }).where(eq(schema.parties.id, p.id));
      if (done) {
        await bumpBuddies(db, members);
        if (members.length > 1) {
          const best = [...members].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]!;
          await db.insert(schema.feedEvents).values({ playerId: p.hostId, playerName: p.hostName, kind: "life", text: `和${members.filter((x) => x.pid !== p.hostId).map((x) => x.name).join("、")}在${p.locName}玩了一局，第一名：${best.name}`, createdAt: new Date() });
          dropWorldCache();
        }
      }
      return { ok: true, done };
    },
  }),

  getPlayerCard: defineAction({
    description: "Public profile of another player (by public id) for the tap-a-player card: city, career, employer, stamps, how often you've played together, block state.",
    request: z.object({ playerId: z.string().min(4).max(64), targetId: z.string().min(4).max(64) }),
    response: z.object({ ok: z.boolean(), card: z.object({ id: z.string(), name: z.string(), emoji: z.string(), cityKey: z.string(), careerIdx: z.number(), employer: z.string(), stamps: z.number(), title: z.string().nullable(), gameDay: z.number(), online: z.boolean(), buddy: z.number(), blocked: z.boolean() }).nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [t] = await db.select().from(schema.players).where(eq(schema.players.pub, args.targetId)).limit(1);
      if (!t) return { ok: false, card: null };
      const [a, b] = pairKey(t.id, args.playerId);
      const [bd] = await db.select().from(schema.buddies).where(and(eq(schema.buddies.a, a), eq(schema.buddies.b, b))).limit(1);
      const [bl] = await db.select().from(schema.blocks).where(and(eq(schema.blocks.a, args.playerId), eq(schema.blocks.b, t.id))).limit(1);
      return { ok: true, card: { id: args.targetId, name: t.name, emoji: t.emoji, cityKey: t.cityKey, careerIdx: t.careerIdx, employer: t.employer, stamps: t.stamps, title: t.title, gameDay: t.gameDay, online: Date.now() - t.lastSeen.getTime() < ONLINE_WINDOW_MS, buddy: bd?.n ?? 0, blocked: !!bl } };
    },
  }),

  sendDm: defineAction({
    description: "Sends a private message to another player (by public id). Filtered for abuse, rate-limited, refused if the receiver blocked the sender.",
    request: z.object({ playerId: z.string().min(4).max(64), toId: z.string().min(4).max(64), body: z.string().trim().min(1).max(300) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [me] = await db.select().from(schema.players).where(eq(schema.players.id, args.playerId)).limit(1);
      const [to] = await db.select().from(schema.players).where(eq(schema.players.pub, args.toId)).limit(1);
      if (!me || !to) return { ok: false, error: "对方不存在" };
      if (me.id === to.id) return { ok: false, error: "不能私聊自己" };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (socialNeedsAccount() && !me.accountId) return { ok: false, error: NEED_ACCOUNT };
      /* 陌生人私聊的规矩：对方回复之前最多发 3 条；新账号 24 小时内只能私聊一起组过局、或先找你说话的人 */
      const theyWrote = await db.select({ n: sql<number>`count(*)` }).from(schema.messages).where(and(eq(schema.messages.fromId, to.id), eq(schema.messages.toId, me.id)));
      const replied = Number(theyWrote[0]?.n ?? 0) > 0;
      if (!replied) {
        const [ka, kb] = pairKey(me.id, to.id);
        const [bd] = await db.select().from(schema.buddies).where(and(eq(schema.buddies.a, ka), eq(schema.buddies.b, kb))).limit(1);
        if (!bd && Date.now() - me.createdAt.getTime() < 24 * 3600_000) return { ok: false, error: "新账号 24 小时内只能私聊一起组过局、或先找你说话的人" };
        const iWrote = await db.select({ n: sql<number>`count(*)` }).from(schema.messages).where(and(eq(schema.messages.fromId, me.id), eq(schema.messages.toId, to.id)));
        if (!bd && Number(iWrote[0]?.n ?? 0) >= 3) return { ok: false, error: "对方回复之前，最多只能发 3 条" };
      }
      const [bl] = await db.select().from(schema.blocks).where(and(eq(schema.blocks.a, to.id), eq(schema.blocks.b, me.id))).limit(1);
      if (bl) return { ok: false, error: "对方不接收你的消息" };
      const recent = await db.select({ n: sql<number>`count(*)` }).from(schema.messages).where(and(eq(schema.messages.fromId, me.id), gte(schema.messages.createdAt, new Date(Date.now() - 10 * 60_000))));
      if (Number(recent[0]?.n ?? 0) >= 40) return { ok: false, error: "发得太快了，歇一会儿" };
      const body = /^\[\[party:\d+\]\]$/.test(args.body) ? args.body : cleanText(args.body);
      if (!body.trim()) return { ok: false, error: "消息被过滤了" };
      await db.insert(schema.messages).values({ fromId: me.id, toId: to.id, body, read: 0, createdAt: new Date() });
      return { ok: true };
    },
  }),

  getInbox: defineAction({
    description: "The caller's private conversations: the latest messages with each player, unread counts.",
    request: z.object({ playerId: z.string().min(4).max(64) }),
    response: z.object({ threads: z.array(z.object({ peerId: z.string(), peerName: z.string(), peerEmoji: z.string(), unread: z.number(), online: z.boolean(), messages: z.array(z.object({ id: z.number(), mine: z.boolean(), body: z.string(), createdAt: z.string() })) })) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = args.playerId;
      const rows = await db.select().from(schema.messages)
        .where(sql`${schema.messages.fromId} = ${me} OR ${schema.messages.toId} = ${me}`)
        .orderBy(desc(schema.messages.id)).limit(300);
      const blockedRows = await db.select().from(schema.blocks).where(eq(schema.blocks.a, me));
      const blocked = new Set(blockedRows.map((r) => r.b));
      const byPeer = new Map<string, typeof rows>();
      for (const r of rows) { const peer = r.fromId === me ? r.toId : r.fromId; if (blocked.has(peer)) continue; (byPeer.get(peer) ?? byPeer.set(peer, []).get(peer)!).push(r); }
      const threads = [];
      for (const [peer, list] of byPeer) {
        const [pl] = await db.select().from(schema.players).where(eq(schema.players.id, peer)).limit(1);
        if (!pl) continue;
        threads.push({ peerId: pubOf(peer), peerName: pl.name, peerEmoji: pl.emoji, online: Date.now() - pl.lastSeen.getTime() < ONLINE_WINDOW_MS,
          unread: list.filter((m) => m.toId === me && !m.read).length,
          messages: list.slice(0, 60).reverse().map((m) => ({ id: m.id, mine: m.fromId === me, body: m.body, createdAt: m.createdAt.toISOString() })) });
      }
      return { threads };
    },
  }),

  markDmRead: defineAction({
    description: "Marks the caller's messages from one player as read.",
    request: z.object({ playerId: z.string().min(4).max(64), peerId: z.string().min(4).max(64) }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [pl] = await db.select().from(schema.players).where(eq(schema.players.pub, args.peerId)).limit(1);
      if (!pl) return { ok: false };
      await db.update(schema.messages).set({ read: 1 }).where(and(eq(schema.messages.toId, args.playerId), eq(schema.messages.fromId, pl.id)));
      return { ok: true };
    },
  }),

  blockPlayer: defineAction({
    description: "Blocks or unblocks another player: a blocked player can't message you and disappears from your inbox.",
    request: z.object({ playerId: z.string().min(4).max(64), targetId: z.string().min(4).max(64), block: z.boolean() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [t] = await db.select().from(schema.players).where(eq(schema.players.pub, args.targetId)).limit(1);
      if (!t) return { ok: false };
      if (args.block) await db.insert(schema.blocks).values({ a: args.playerId, b: t.id, createdAt: new Date() }).onConflictDoNothing();
      else await db.delete(schema.blocks).where(and(eq(schema.blocks.a, args.playerId), eq(schema.blocks.b, t.id)));
      return { ok: true };
    },
  }),

  reportPlayer: defineAction({
    description: "Reports another player for moderator review, with the recent conversation attached as context.",
    request: z.object({ playerId: z.string().min(4).max(64), targetId: z.string().min(4).max(64), reason: z.enum(["harassment", "scam", "spam", "inappropriate", "minor", "other"]) }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [t] = await db.select().from(schema.players).where(eq(schema.players.pub, args.targetId)).limit(1);
      if (!t) return { ok: false };
      const convo = await db.select().from(schema.messages)
        .where(sql`(${schema.messages.fromId} = ${args.playerId} AND ${schema.messages.toId} = ${t.id}) OR (${schema.messages.fromId} = ${t.id} AND ${schema.messages.toId} = ${args.playerId})`)
        .orderBy(desc(schema.messages.id)).limit(30);
      await db.insert(schema.reports).values({ reporterId: args.playerId, targetId: t.id, reason: args.reason, context: JSON.stringify(convo.map((m) => ({ from: m.fromId === t.id ? "target" : "reporter", body: m.body, at: m.createdAt.toISOString() }))), createdAt: new Date() });
      return { ok: true };
    },
  }),

  /* ---- 意见箱：游戏里「🆕 更新」面板底下 ---- */
  sendFeedback: defineAction({
    description: "Stores a player's bug report or idea for the team (shown on the admin page). At most 8 a day per player.",
    request: z.object({ playerId: z.string().min(4).max(64), kind: z.enum(["bug", "idea", "other"]), body: z.string().trim().min(2).max(600), city: z.enum(["sz", "hz", "hk"]).optional() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [me] = await db.select().from(schema.players).where(eq(schema.players.id, args.playerId)).limit(1);
      if (!me) return { ok: false, error: "先进游戏再提意见" };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      const today = await db.select({ n: sql<number>`count(*)` }).from(schema.feedback).where(and(eq(schema.feedback.playerId, me.id), gte(schema.feedback.createdAt, new Date(Date.now() - 24 * 3600_000))));
      if (Number(today[0]?.n ?? 0) >= 8) return { ok: false, error: "今天已经提了很多条了，谢谢！明天再来" };
      await db.insert(schema.feedback).values({ playerId: me.id, kind: args.kind, body: cleanText(args.body).slice(0, 600), city: args.city ?? me.cityKey, createdAt: new Date() });
      return { ok: true };
    },
  }),

  /* ---- 真人关系：合租室友 / 结拜 / 情侣 ---- */
  getBonds: defineAction({
    description: "The caller's bonds with other real players (roommate, sworn sibling, partner): active ones and invitations waiting for an answer.",
    request: z.object({ playerId: z.string().min(4).max(64) }),
    response: z.object({ bonds: z.array(z.object({ id: z.number(), kind: z.enum(BOND_KINDS), status: z.enum(["pending", "active"]), mine: z.boolean(), peerId: z.string(), peerName: z.string(), peerEmoji: z.string(), peerCity: z.string(), online: z.boolean(), since: z.string() })) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.bonds)
        .where(sql`(${schema.bonds.a} = ${args.playerId} OR ${schema.bonds.b} = ${args.playerId}) AND ${schema.bonds.status} IN ('pending', 'active')`)
        .orderBy(desc(schema.bonds.id)).limit(30);
      const out = [];
      for (const r of rows) {
        const peer = r.a === args.playerId ? r.b : r.a;
        const [pl] = await db.select().from(schema.players).where(eq(schema.players.id, peer)).limit(1);
        if (!pl) continue;
        out.push({ id: r.id, kind: r.kind as BondKind, status: r.status as "pending" | "active", mine: r.a === args.playerId, peerId: pl.pub ?? pubOf(pl.id), peerName: pl.name, peerEmoji: pl.emoji, peerCity: pl.cityKey, online: Date.now() - pl.lastSeen.getTime() < ONLINE_WINDOW_MS, since: r.updatedAt.toISOString() });
      }
      return { bonds: out };
    },
  }),

  proposeBond: defineAction({
    description: "Invites another real player to become your roommate (rent split in half), sworn sibling or partner. Needs an account; only people you've partied with or exchanged messages with.",
    request: z.object({ playerId: z.string().min(4).max(64), toId: z.string().min(4).max(64), kind: z.enum(BOND_KINDS) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [me] = await db.select().from(schema.players).where(eq(schema.players.id, args.playerId)).limit(1);
      const [to] = await db.select().from(schema.players).where(eq(schema.players.pub, args.toId)).limit(1);
      if (!me || !to) return { ok: false, error: "对方不存在" };
      if (me.id === to.id) return { ok: false, error: "不能和自己结对" };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (socialNeedsAccount() && !me.accountId) return { ok: false, error: NEED_ACCOUNT };
      const [bl] = await db.select().from(schema.blocks).where(and(eq(schema.blocks.a, to.id), eq(schema.blocks.b, me.id))).limit(1);
      if (bl) return { ok: false, error: "对方不接收你的邀请" };
      if (args.kind === "roommate" && me.cityKey !== to.cityKey) return { ok: false, error: "合租要在同一座城" };
      // only people you actually know: partied together, or both have written to each other
      const [ka, kb] = pairKey(me.id, to.id);
      const [bd] = await db.select().from(schema.buddies).where(and(eq(schema.buddies.a, ka), eq(schema.buddies.b, kb))).limit(1);
      if (!bd) {
        const w1 = await db.select({ n: sql<number>`count(*)` }).from(schema.messages).where(and(eq(schema.messages.fromId, me.id), eq(schema.messages.toId, to.id)));
        const w2 = await db.select({ n: sql<number>`count(*)` }).from(schema.messages).where(and(eq(schema.messages.fromId, to.id), eq(schema.messages.toId, me.id)));
        if (!(Number(w1[0]?.n ?? 0) > 0 && Number(w2[0]?.n ?? 0) > 0)) return { ok: false, error: "先一起组个局、或者互相聊过天，再发出邀请" };
      }
      const open = await db.select().from(schema.bonds).where(sql`((${schema.bonds.a} = ${me.id} AND ${schema.bonds.b} = ${to.id}) OR (${schema.bonds.a} = ${to.id} AND ${schema.bonds.b} = ${me.id})) AND ${schema.bonds.kind} = ${args.kind} AND ${schema.bonds.status} IN ('pending', 'active')`).limit(1);
      if (open.length) return { ok: false, error: open[0]!.status === "active" ? "你们已经是这层关系了" : "邀请已经发出，等对方回复" };
      const lim = await bondRoom(db, me.id, args.kind);
      if (lim) return { ok: false, error: lim };
      const pendingMine = await db.select({ n: sql<number>`count(*)` }).from(schema.bonds).where(and(eq(schema.bonds.a, me.id), eq(schema.bonds.status, "pending")));
      if (Number(pendingMine[0]?.n ?? 0) >= 5) return { ok: false, error: "已经发出 5 个邀请了，等等回复" };
      const now = new Date();
      await db.insert(schema.bonds).values({ a: me.id, b: to.id, kind: args.kind, status: "pending", createdAt: now, updatedAt: now });
      await db.insert(schema.messages).values({ fromId: me.id, toId: to.id, body: `[[bond:${args.kind}]]`, read: 0, createdAt: now });
      return { ok: true };
    },
  }),

  answerBond: defineAction({
    description: "Accepts or declines a bond invitation sent to the caller.",
    request: z.object({ playerId: z.string().min(4).max(64), bondId: z.number().int().positive(), accept: z.boolean() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [r] = await db.select().from(schema.bonds).where(eq(schema.bonds.id, args.bondId)).limit(1);
      if (!r || r.b !== args.playerId || r.status !== "pending") return { ok: false, error: "这个邀请已经失效了" };
      if (args.accept) {
        const lim = (await bondRoom(db, r.a, r.kind as BondKind)) ?? (await bondRoom(db, r.b, r.kind as BondKind));
        if (lim) return { ok: false, error: lim };
      }
      await db.update(schema.bonds).set({ status: args.accept ? "active" : "declined", updatedAt: new Date() }).where(eq(schema.bonds.id, r.id));
      return { ok: true };
    },
  }),

  endBond: defineAction({
    description: "Ends a bond (moving out, parting ways) or withdraws an invitation the caller sent. Either side can do it.",
    request: z.object({ playerId: z.string().min(4).max(64), bondId: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [r] = await db.select().from(schema.bonds).where(eq(schema.bonds.id, args.bondId)).limit(1);
      if (!r || (r.a !== args.playerId && r.b !== args.playerId) || (r.status !== "active" && r.status !== "pending")) return { ok: false };
      await db.update(schema.bonds).set({ status: "ended", updatedAt: new Date() }).where(eq(schema.bonds.id, r.id));
      return { ok: true };
    },
  }),

  /* ---- 业委会选举：每城每周一届 ---- */
  committeeState: defineAction({
    description: "This week's estate-committee chair and their policy for a city (elected last week), plus this week's race: candidates, votes, and the caller's own vote / candidacy.",
    request: z.object({ playerId: z.string().min(4).max(64), city: z.enum(["sz", "hz", "hk"]) }),
    response: z.object({
      week: z.number(), endsAt: z.string(),
      chair: z.object({ id: z.string(), name: z.string(), emoji: z.string(), pledge: z.enum(PLEDGES), votes: z.number() }).nullable(),
      candidates: z.array(z.object({ id: z.string(), name: z.string(), emoji: z.string(), pledge: z.enum(PLEDGES), votes: z.number(), me: z.boolean() })),
      myVote: z.string().nullable(), running: z.boolean(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const week = bjWeek();
      const race = await committeeRace(db, week, args.city);
      const prev = await committeeRace(db, week - 1, args.city);
      const top = prev[0];
      const [mv] = await db.select().from(schema.committeeVotes).where(and(eq(schema.committeeVotes.week, week), eq(schema.committeeVotes.city, args.city), eq(schema.committeeVotes.voterId, args.playerId))).limit(1);
      return {
        week, endsAt: new Date(weekStartMs(week + 1)).toISOString(),
        chair: top && top.votes > 0 ? { id: top.pub, name: top.name, emoji: top.emoji, pledge: top.pledge, votes: top.votes } : null,
        candidates: race.map((c) => ({ id: c.pub, name: c.name, emoji: c.emoji, pledge: c.pledge, votes: c.votes, me: c.playerId === args.playerId })),
        myVote: mv ? pubOf(mv.candidateId) : null,
        running: race.some((c) => c.playerId === args.playerId),
      };
    },
  }),

  runForCommittee: defineAction({
    description: "Stands for this week's estate-committee election in the caller's city with one policy pledge (rent -5%, metro fares -20%, eating out -10%). Needs an account.",
    request: z.object({ playerId: z.string().min(4).max(64), city: z.enum(["sz", "hz", "hk"]), pledge: z.enum(PLEDGES) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [me] = await db.select().from(schema.players).where(eq(schema.players.id, args.playerId)).limit(1);
      if (!me) return { ok: false, error: "先进游戏" };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (socialNeedsAccount() && !me.accountId) return { ok: false, error: "先绑定账号（右上角 👤 账号），才能参选——防小号刷票" };
      if (me.cityKey !== args.city) return { ok: false, error: "只能在你住的城市参选" };
      const week = bjWeek();
      await db.insert(schema.committeeCandidates).values({ week, city: args.city, playerId: me.id, pledge: args.pledge, createdAt: new Date() })
        .onConflictDoUpdate({ target: [schema.committeeCandidates.week, schema.committeeCandidates.city, schema.committeeCandidates.playerId], set: { pledge: args.pledge } });
      return { ok: true };
    },
  }),

  voteCommittee: defineAction({
    description: "Casts (or moves) the caller's one vote in this week's estate-committee election of their city. Needs an account; you can't vote for yourself.",
    request: z.object({ playerId: z.string().min(4).max(64), city: z.enum(["sz", "hz", "hk"]), candidateId: z.string().min(4).max(64) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [me] = await db.select().from(schema.players).where(eq(schema.players.id, args.playerId)).limit(1);
      const [cand] = await db.select().from(schema.players).where(eq(schema.players.pub, args.candidateId)).limit(1);
      if (!me || !cand) return { ok: false, error: "候选人不存在" };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (socialNeedsAccount() && !me.accountId) return { ok: false, error: "先绑定账号（右上角 👤 账号），才能投票——一人一票" };
      if (me.id === cand.id) return { ok: false, error: "不能投给自己" };
      if (me.cityKey !== args.city) return { ok: false, error: "只能给你住的城市投票" };
      const week = bjWeek();
      const [isCand] = await db.select().from(schema.committeeCandidates).where(and(eq(schema.committeeCandidates.week, week), eq(schema.committeeCandidates.city, args.city), eq(schema.committeeCandidates.playerId, cand.id))).limit(1);
      if (!isCand) return { ok: false, error: "对方这周没有参选" };
      await db.insert(schema.committeeVotes).values({ week, city: args.city, voterId: me.id, candidateId: cand.id, createdAt: new Date() })
        .onConflictDoUpdate({ target: [schema.committeeVotes.week, schema.committeeVotes.city, schema.committeeVotes.voterId], set: { candidateId: cand.id, createdAt: new Date() } });
      return { ok: true };
    },
  }),

  /* ---- 零工：真人雇真人，工钱由服务器托管；有纠纷交给同城陪审团 ---- */
  getGigs: defineAction({
    description: "The city's open gigs (posted by other players), the caller's own gigs as employer or worker, and disputes the caller can sit on the jury for. Settles anything whose time is up.",
    request: z.object({ playerId: z.string().min(4).max(64), city: z.enum(["sz", "hz", "hk"]) }),
    response: z.object({ open: z.array(GIG_VIEW), mine: z.array(GIG_VIEW), jury: z.array(GIG_VIEW.extend({ myVote: z.string().nullable() })), unclaimed: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await settleGigs(db);
      const me = args.playerId;
      const openRows = await db.select().from(schema.gigs).where(and(eq(schema.gigs.city, args.city), eq(schema.gigs.status, "open"))).orderBy(desc(schema.gigs.id)).limit(30);
      const mineRows = await db.select().from(schema.gigs).where(sql`(${schema.gigs.employerId} = ${me} OR ${schema.gigs.workerId} = ${me})`).orderBy(desc(schema.gigs.id)).limit(20);
      const juryRows = await db.select().from(schema.gigs).where(and(eq(schema.gigs.city, args.city), eq(schema.gigs.status, "disputed"))).orderBy(desc(schema.gigs.id)).limit(20);
      const view = async (g: GigRow) => gigView(db, g, me);
      const jury = [];
      for (const g of juryRows) {
        if (g.employerId === me || g.workerId === me) continue;
        const [v] = await db.select().from(schema.gigVotes).where(and(eq(schema.gigVotes.gigId, g.id), eq(schema.gigVotes.voterId, me))).limit(1);
        jury.push({ ...(await view(g)), myVote: v?.side ?? null });
      }
      const unclaimed = mineRows.filter((g) => (g.status === "paid" && g.workerId === me && !g.workerClaimed) || (g.status === "refunded" && g.employerId === me && !g.employerClaimed)).reduce((t, g) => t + g.pay, 0);
      return { open: await Promise.all(openRows.filter((g) => g.employerId !== me).map(view)), mine: await Promise.all(mineRows.map(view)), jury, unclaimed };
    },
  }),

  postGig: defineAction({
    description: "Posts a paid gig for other players in the caller's city (pay ¥30–¥500, held by the server until the job is done). Needs an account; at most 3 open gigs.",
    request: z.object({ playerId: z.string().min(4).max(64), city: z.enum(["sz", "hz", "hk"]), title: z.string().trim().min(2).max(30), pay: z.number().int().min(30).max(500) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), held: z.number().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [me] = await db.select().from(schema.players).where(eq(schema.players.id, args.playerId)).limit(1);
      if (!me) return { ok: false, error: "先进游戏" };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (socialNeedsAccount() && !me.accountId) return { ok: false, error: "先绑定账号（右上角 👤 账号），才能雇人——工钱要托管在服务器" };
      if (me.cityKey !== args.city) return { ok: false, error: "只能在你所在的城市发活" };
      if (me.money < args.pay) return { ok: false, error: "存款不够付这份工钱" };
      const open = await db.select({ n: sql<number>`count(*)` }).from(schema.gigs).where(and(eq(schema.gigs.employerId, me.id), sql`${schema.gigs.status} IN ('open', 'taken', 'delivered')`));
      if (Number(open[0]?.n ?? 0) >= 3) return { ok: false, error: "最多同时挂 3 个活" };
      const title = cleanText(args.title).slice(0, 30);
      if (title.trim().length < 2) return { ok: false, error: "活的名字被过滤了，换个说法" };
      await creditMoney(db, me.id, -args.pay, "gig escrow");
      await db.insert(schema.gigs).values({ city: args.city, employerId: me.id, title, pay: args.pay, status: "open", createdAt: new Date() });
      return { ok: true, held: args.pay };
    },
  }),

  gigAction: defineAction({
    description: "Moves a gig along: take (worker), deliver (worker, at least 2 minutes after taking), confirm (employer pays), dispute (employer, within 2 hours of delivery — goes to a 24 h city jury), cancel (employer, only while nobody has taken it — the pay comes back).",
    request: z.object({ playerId: z.string().min(4).max(64), gigId: z.number().int().positive(), act: z.enum(["take", "deliver", "confirm", "dispute", "cancel"]), reason: z.string().trim().max(80).optional() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await settleGigs(db);
      const [g] = await db.select().from(schema.gigs).where(eq(schema.gigs.id, args.gigId)).limit(1);
      const [me] = await db.select().from(schema.players).where(eq(schema.players.id, args.playerId)).limit(1);
      if (!g || !me) return { ok: false, error: "这个活不存在了" };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      const now = new Date();
      if (args.act === "take") {
        if (g.status !== "open") return { ok: false, error: "这个活已经被人接了" };
        if (g.employerId === me.id) return { ok: false, error: "不能接自己发的活" };
        if (me.cityKey !== g.city) return { ok: false, error: "只能接你所在城市的活" };
        if (socialNeedsAccount() && !me.accountId) return { ok: false, error: NEED_ACCOUNT };
        const busy = await db.select({ n: sql<number>`count(*)` }).from(schema.gigs).where(and(eq(schema.gigs.workerId, me.id), eq(schema.gigs.status, "taken")));
        if (Number(busy[0]?.n ?? 0) >= 2) return { ok: false, error: "手上已经有 2 个活了，先交付" };
        await db.update(schema.gigs).set({ status: "taken", workerId: me.id, takenAt: now }).where(and(eq(schema.gigs.id, g.id), eq(schema.gigs.status, "open")));
        return { ok: true };
      }
      if (args.act === "deliver") {
        if (g.workerId !== me.id || g.status !== "taken") return { ok: false, error: "这个活不在你手上" };
        if (g.takenAt && now.getTime() - g.takenAt.getTime() < 120_000) return { ok: false, error: "活还没干完——接单 2 分钟后才能交付" };
        await db.update(schema.gigs).set({ status: "delivered", deliveredAt: now, dueAt: new Date(now.getTime() + 2 * 3600_000) }).where(eq(schema.gigs.id, g.id));
        return { ok: true };
      }
      if (args.act === "confirm") {
        if (g.employerId !== me.id || g.status !== "delivered") return { ok: false, error: "现在不能确认" };
        await db.update(schema.gigs).set({ status: "paid" }).where(eq(schema.gigs.id, g.id));
        return { ok: true };
      }
      if (args.act === "dispute") {
        if (g.employerId !== me.id || g.status !== "delivered") return { ok: false, error: "现在不能投诉" };
        const reason = cleanText(args.reason ?? "").slice(0, 80) || "活没干好";
        await db.update(schema.gigs).set({ status: "disputed", reason, dueAt: new Date(now.getTime() + 24 * 3600_000) }).where(eq(schema.gigs.id, g.id));
        return { ok: true };
      }
      if (g.employerId !== me.id || g.status !== "open") return { ok: false, error: "已经有人接了，不能撤" };
      await db.update(schema.gigs).set({ status: "refunded" }).where(eq(schema.gigs.id, g.id));
      return { ok: true };
    },
  }),

  juryVote: defineAction({
    description: "Sits on the jury of a disputed gig in the caller's city: side with the worker (pay them) or the employer (refund). One vote, changeable until the jury closes; not for the two parties.",
    request: z.object({ playerId: z.string().min(4).max(64), gigId: z.number().int().positive(), side: z.enum(["worker", "employer"]) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [g] = await db.select().from(schema.gigs).where(eq(schema.gigs.id, args.gigId)).limit(1);
      const [me] = await db.select().from(schema.players).where(eq(schema.players.id, args.playerId)).limit(1);
      if (!g || !me || g.status !== "disputed") return { ok: false, error: "这个纠纷已经结案了" };
      if (g.employerId === me.id || g.workerId === me.id) return { ok: false, error: "当事人不能投票" };
      if (me.cityKey !== g.city) return { ok: false, error: "只有同城的人能当陪审员" };
      if (socialNeedsAccount() && !me.accountId) return { ok: false, error: "先绑定账号，才能当陪审员——一人一票" };
      await db.insert(schema.gigVotes).values({ gigId: g.id, voterId: me.id, side: args.side, createdAt: new Date() })
        .onConflictDoUpdate({ target: [schema.gigVotes.gigId, schema.gigVotes.voterId], set: { side: args.side } });
      return { ok: true };
    },
  }),

  claimGigMoney: defineAction({
    description: "Collects the caller's money from finished gigs: wages for jobs paid out, refunds for jobs cancelled or lost at the jury. Returns the amount to add to the game wallet.",
    request: z.object({ playerId: z.string().min(4).max(64) }),
    response: z.object({ ok: z.boolean(), money: z.number(), lines: z.array(z.string()) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await settleGigs(db);
      const me = args.playerId;
      const rows = await db.select().from(schema.gigs).where(sql`((${schema.gigs.status} = 'paid' AND ${schema.gigs.workerId} = ${me} AND ${schema.gigs.workerClaimed} = 0) OR (${schema.gigs.status} = 'refunded' AND ${schema.gigs.employerId} = ${me} AND ${schema.gigs.employerClaimed} = 0))`);
      let money = 0; const lines: string[] = [];
      for (const g of rows) {
        const asWorker = g.status === "paid" && g.workerId === me;
        const res = await db.update(schema.gigs).set(asWorker ? { workerClaimed: 1 } : { employerClaimed: 1 }).where(and(eq(schema.gigs.id, g.id), eq(asWorker ? schema.gigs.workerClaimed : schema.gigs.employerClaimed, 0))).returning({ id: schema.gigs.id });
        if (!res.length) continue; // another request got it first
        await creditMoney(db, me, g.pay, asWorker ? `gig pay #${g.id}` : `gig refund #${g.id}`);
        money += g.pay;
        lines.push(asWorker ? `「${g.title}」工钱 +¥${g.pay}` : `「${g.title}」退回 +¥${g.pay}`);
      }
      return { ok: true, money, lines };
    },
  }),

  /* ---- 📢 地图广告牌：每城 3 块，✨ 租一周；运营也可以替本地商家挂 ---- */
  getBillboards: defineAction({
    description: "The billboards on a city's map right now (three slots; empty slots are listed as free).",
    request: z.object({ city: z.enum(["sz", "hz", "hk"]) }),
    response: z.object({ price: z.number(), days: z.number(), slots: z.array(z.object({ slot: z.number(), ad: z.object({ owner: z.string(), text: z.string(), emoji: z.string(), endsAt: z.string() }).nullable() })) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const now = Date.now();
      const rows = await db.select().from(schema.billboards).where(and(eq(schema.billboards.city, args.city), sql`${schema.billboards.endsAt} > ${now}`));
      return { price: BILLBOARD_STARS, days: BILLBOARD_DAYS, slots: [0, 1, 2].map((slot) => { const r = rows.filter((x) => x.slot === slot).sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())[0]; return { slot, ad: r ? { owner: r.owner, text: r.text, emoji: r.emoji, endsAt: r.endsAt.toISOString() } : null }; }) };
    },
  }),

  buyBillboard: defineAction({
    description: "Rents a free billboard slot on a city's map for 7 days with ✨ (logged-in account). The text is filtered; a few words and an emoji.",
    request: z.object({ token: z.string().max(200), playerName: z.string().trim().min(1).max(12), city: z.enum(["sz", "hz", "hk"]), slot: z.number().int().min(0).max(2), text: z.string().trim().min(2).max(20), emoji: z.string().min(1).max(8) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const acc = await sessionAccount(db, args.token);
      if (!acc) return { ok: false, error: "先登录账号" };
      const now = Date.now();
      const taken = await db.select().from(schema.billboards).where(and(eq(schema.billboards.city, args.city), eq(schema.billboards.slot, args.slot), sql`${schema.billboards.endsAt} > ${now}`)).limit(1);
      if (taken.length) return { ok: false, error: "这块广告牌已经有人租了" };
      const text = cleanText(args.text).slice(0, 20);
      if (text.trim().length < 2) return { ok: false, error: "广告内容被过滤了，换个说法" };
      const ok = await bookStars(db, acc.id, -BILLBOARD_STARS, "billboard", `${acc.id}:${args.city}:${args.slot}:${Math.floor(now / 60_000)}`);
      if (!ok) return { ok: false, error: `✨ 不够（需要 ${BILLBOARD_STARS}）` };
      await db.insert(schema.billboards).values({ city: args.city, slot: args.slot, accountId: acc.id, owner: cleanName(args.playerName).slice(0, 12) || "玩家", text, emoji: [...args.emoji][0] ?? "📢", endsAt: new Date(now + BILLBOARD_DAYS * 86_400_000), createdAt: new Date() });
      return { ok: true };
    },
  }),

  adminBillboard: defineAction({
    description: "Admin: places (or clears) a billboard for a local business, free of ✨. Requires the ADMIN_TOKEN.",
    request: z.object({ token: z.string().max(200), city: z.enum(["sz", "hz", "hk"]), slot: z.number().int().min(0).max(2), owner: z.string().trim().max(20), text: z.string().trim().max(20), emoji: z.string().max(8), days: z.number().int().min(0).max(60) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      if (!(await adminOk(ctx.db<typeof schema>(), args.token))) return { ok: false, error: "口令不对" };
      const db = ctx.db<typeof schema>();
      const now = Date.now();
      await db.update(schema.billboards).set({ endsAt: new Date(now) }).where(and(eq(schema.billboards.city, args.city), eq(schema.billboards.slot, args.slot), sql`${schema.billboards.endsAt} > ${now}`));
      if (args.days > 0 && args.text.trim()) await db.insert(schema.billboards).values({ city: args.city, slot: args.slot, accountId: null, owner: args.owner.trim() || "本地商家", text: args.text.trim(), emoji: [...args.emoji][0] ?? "📢", endsAt: new Date(now + args.days * 86_400_000), createdAt: new Date() });
      return { ok: true };
    },
  }),

  /* ---- 🆕 运营公告：后台发，玩家在「更新」里看到 ---- */
  getAnnouncements: defineAction({
    description: "The latest update notes the operators posted (newest first).",
    request: z.object({}),
    response: z.object({ items: z.array(z.object({ id: z.number(), zh: z.string(), en: z.string(), at: z.string() })) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.announcements).orderBy(desc(schema.announcements.id)).limit(20);
      return { items: rows.map((r) => ({ id: r.id, zh: r.zh, en: r.en, at: r.createdAt.toISOString() })) };
    },
  }),

  postAnnouncement: defineAction({
    description: "Admin: posts an update note to every player's 🆕 panel (red dot until read), or deletes one. Requires the ADMIN_TOKEN.",
    request: z.object({ token: z.string().max(200), zh: z.string().trim().max(400).optional(), en: z.string().trim().max(400).optional(), deleteId: z.number().int().positive().optional() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      if (!(await adminOk(ctx.db<typeof schema>(), args.token))) return { ok: false, error: "口令不对" };
      const db = ctx.db<typeof schema>();
      if (args.deleteId) { await db.delete(schema.announcements).where(eq(schema.announcements.id, args.deleteId)); return { ok: true }; }
      if (!args.zh?.trim()) return { ok: false, error: "写点内容" };
      await db.insert(schema.announcements).values({ zh: args.zh.trim(), en: (args.en ?? "").trim() || args.zh.trim(), createdAt: new Date() });
      return { ok: true };
    },
  }),

  /* ---- 🎶 Livehouse：音乐人投稿（分片上传），审核后全城同步轮播 ---- */
  livehouseState: defineAction({
    description: "The Livehouse rotation: approved tracks in play order (featured tracks appear twice), the server clock to sync on, and the caller's own submissions.",
    request: z.object({ token: z.string().max(200).optional() }),
    response: z.object({ now: z.number(), boostStars: z.number(), rotation: z.array(TRACK_VIEW), mine: z.array(TRACK_VIEW.extend({ status: z.string() })) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const now = Date.now();
      const rows = await db.select().from(schema.musicTracks).where(eq(schema.musicTracks.status, "approved")).orderBy(schema.musicTracks.id);
      const view = (t: typeof schema.musicTracks.$inferSelect) => ({ id: t.id, artist: t.artist, title: t.title, durationSec: t.durationSec, chunks: t.chunks, featured: !!t.boostUntil && t.boostUntil.getTime() > now });
      const rotation = rows.flatMap((t) => (view(t).featured ? [view(t), view(t)] : [view(t)]));
      let mine: (ReturnType<typeof view> & { status: string })[] = [];
      if (args.token) {
        const acc = await sessionAccount(db, args.token);
        if (acc) mine = (await db.select().from(schema.musicTracks).where(eq(schema.musicTracks.accountId, acc.id)).orderBy(desc(schema.musicTracks.id)).limit(10)).map((t) => ({ ...view(t), status: t.status }));
      }
      return { now, boostStars: TRACK_BOOST_STARS, rotation, mine };
    },
  }),

  startTrack: defineAction({
    description: "A musician starts submitting an original song (logged-in account, must confirm they own the rights). Returns the track id to upload chunks to. At most 3 submissions a day.",
    request: z.object({ token: z.string().max(200), artist: z.string().trim().min(1).max(20), title: z.string().trim().min(1).max(30), mime: z.enum(["audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/x-m4a", "audio/wav"]), bytes: z.number().int().min(10_000).max(TRACK_MAX_BYTES), durationSec: z.number().int().min(30).max(480), chunks: z.number().int().min(1).max(60), rights: z.literal(true) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), trackId: z.number().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const acc = await sessionAccount(db, args.token);
      if (!acc) return { ok: false, error: "先登录账号再投稿" };
      const today = await db.select({ n: sql<number>`count(*)` }).from(schema.musicTracks).where(and(eq(schema.musicTracks.accountId, acc.id), gte(schema.musicTracks.createdAt, new Date(Date.now() - 86_400_000))));
      if (Number(today[0]?.n ?? 0) >= 3) return { ok: false, error: "今天已经投了 3 首，明天再来" };
      const [r] = await db.insert(schema.musicTracks).values({ accountId: acc.id, artist: cleanName(args.artist).slice(0, 20) || "音乐人", title: cleanText(args.title).slice(0, 30) || "无题", mime: args.mime, bytes: args.bytes, durationSec: args.durationSec, chunks: args.chunks, status: "uploading", createdAt: new Date() }).returning({ id: schema.musicTracks.id });
      return { ok: true, trackId: r!.id };
    },
  }),

  uploadChunk: defineAction({
    description: "Uploads one base64 chunk (≤ 200 KB) of a song being submitted; the last call finishes the upload and sends the song for review.",
    request: z.object({ token: z.string().max(200), trackId: z.number().int().positive(), idx: z.number().int().min(0).max(59), data: z.string().min(1).max(200_000), last: z.boolean().optional() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const acc = await sessionAccount(db, args.token);
      const [t] = await db.select().from(schema.musicTracks).where(eq(schema.musicTracks.id, args.trackId)).limit(1);
      if (!acc || !t || t.accountId !== acc.id || t.status !== "uploading" || args.idx >= t.chunks) return { ok: false, error: "上传已失效，重新投稿" };
      if (!/^[A-Za-z0-9+/=]+$/.test(args.data)) return { ok: false, error: "文件格式不对" };
      await db.insert(schema.musicChunks).values({ trackId: t.id, idx: args.idx, data: args.data }).onConflictDoUpdate({ target: [schema.musicChunks.trackId, schema.musicChunks.idx], set: { data: args.data } });
      if (args.last) {
        const n = await db.select({ n: sql<number>`count(*)` }).from(schema.musicChunks).where(eq(schema.musicChunks.trackId, t.id));
        if (Number(n[0]?.n ?? 0) !== t.chunks) return { ok: false, error: "有分片没传上，重新投稿" };
        await db.update(schema.musicTracks).set({ status: "pending" }).where(eq(schema.musicTracks.id, t.id));
      }
      return { ok: true };
    },
  }),

  trackChunk: defineAction({
    description: "Downloads one chunk of a song: approved songs for anyone; pending ones only for their uploader or an admin (review).",
    request: z.object({ trackId: z.number().int().positive(), idx: z.number().int().min(0).max(59), token: z.string().max(200).optional() }),
    response: z.object({ ok: z.boolean(), data: z.string().optional(), mime: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [t] = await db.select().from(schema.musicTracks).where(eq(schema.musicTracks.id, args.trackId)).limit(1);
      if (!t) return { ok: false };
      if (t.status !== "approved") {
        const admin = args.token ? !!(await adminOk(db, args.token)) : false;
        const acc = !admin && args.token ? await sessionAccount(db, args.token) : null;
        if (!admin && (!acc || acc.id !== t.accountId)) return { ok: false };
      }
      const [c] = await db.select().from(schema.musicChunks).where(and(eq(schema.musicChunks.trackId, t.id), eq(schema.musicChunks.idx, args.idx))).limit(1);
      return c ? { ok: true, data: c.data, mime: t.mime } : { ok: false };
    },
  }),

  boostTrack: defineAction({
    description: "Makes the caller's approved song this week's featured track for 300 ✨ — it plays twice as often in the Livehouse rotation for 7 days.",
    request: z.object({ token: z.string().max(200), trackId: z.number().int().positive() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const acc = await sessionAccount(db, args.token);
      const [t] = await db.select().from(schema.musicTracks).where(eq(schema.musicTracks.id, args.trackId)).limit(1);
      if (!acc || !t || t.accountId !== acc.id) return { ok: false, error: "不是你的歌" };
      if (t.status !== "approved") return { ok: false, error: "审核通过后才能设为主打" };
      const now = Date.now();
      const ok = await bookStars(db, acc.id, -TRACK_BOOST_STARS, "track-boost", `${t.id}:${Math.floor(now / 60_000)}`);
      if (!ok) return { ok: false, error: `✨ 不够（需要 ${TRACK_BOOST_STARS}）` };
      const base = t.boostUntil && t.boostUntil.getTime() > now ? t.boostUntil.getTime() : now;
      await db.update(schema.musicTracks).set({ boostUntil: new Date(base + 7 * 86_400_000) }).where(eq(schema.musicTracks.id, t.id));
      return { ok: true };
    },
  }),

  moderateTrack: defineAction({
    description: "Admin: lists songs waiting for review, or approves / rejects one. Requires the ADMIN_TOKEN.",
    request: z.object({ token: z.string().max(200), trackId: z.number().int().positive().optional(), approve: z.boolean().optional() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), pending: z.array(z.object({ id: z.number(), artist: z.string(), title: z.string(), durationSec: z.number(), chunks: z.number(), mime: z.string(), at: z.string() })).optional() }),
    async handler(ctx, args) {
      if (!(await adminOk(ctx.db<typeof schema>(), args.token))) return { ok: false, error: "口令不对" };
      const db = ctx.db<typeof schema>();
      if (args.trackId && args.approve !== undefined) {
        await db.update(schema.musicTracks).set({ status: args.approve ? "approved" : "rejected" }).where(eq(schema.musicTracks.id, args.trackId));
        if (!args.approve) await db.delete(schema.musicChunks).where(eq(schema.musicChunks.trackId, args.trackId));
      }
      const rows = await db.select().from(schema.musicTracks).where(eq(schema.musicTracks.status, "pending")).orderBy(schema.musicTracks.id).limit(30);
      return { ok: true, pending: rows.map((t) => ({ id: t.id, artist: t.artist, title: t.title, durationSec: t.durationSec, chunks: t.chunks, mime: t.mime, at: t.createdAt.toISOString() })) };
    },
  }),

  /* ---- ✨ 商店 ---- */
  storeState: defineAction({
    description: "The logged-in account's ✨ balance, owned looks, season pass progress, membership and the catalogue.",
    request: z.object({ token: z.string().max(200), playerId: z.string().max(64).optional() }),
    response: z.object({
      ok: z.boolean(), payMode: z.string(), stars: z.number(), owned: z.array(z.string()), equipped: z.string().nullable(),
      pass: z.object({ owned: z.boolean(), season: z.string(), level: z.number(), claimed: z.array(z.string()) }),
      member: z.object({ until: z.string().nullable(), claimedToday: z.boolean() }),
      products: z.array(z.object({ id: z.string(), kind: z.string(), name: z.string(), usd: z.number(), cny: z.number(), stars: z.number(), bonus: z.number() })),
      shop: z.array(z.object({ id: z.string(), kind: z.string(), label: z.string(), stars: z.number() })),
      locked: z.boolean(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const { season, day } = bjParts();
      const products = Object.entries(PRODUCTS).map(([id, p]) => ({ id, kind: p.kind, name: p.name, usd: p.usd, cny: p.cny, stars: p.stars, bonus: p.bonus }));
      const shop = Object.entries(SHOP).map(([id, x]) => ({ id, kind: x.kind, label: x.label, stars: x.stars }));
      const empty = { ok: false, payMode: payMode(), stars: 0, owned: [], equipped: null, pass: { owned: false, season, level: 0, claimed: [] }, member: { until: null, claimedToday: false }, products, shop, locked: false };
      const acc = await sessionAccount(db, args.token);
      if (!acc) return empty;
      const ents = await db.select().from(schema.entitlements).where(eq(schema.entitlements.accountId, acc.id));
      const live = ents.filter((e) => !e.revokedAt);
      const memberUntil = Math.max(0, ...live.filter((e) => e.kind === "member").map((e) => e.expiresAt?.getTime() ?? 0));
      const [pl] = acc.playerId ? await db.select().from(schema.players).where(eq(schema.players.id, acc.playerId)).limit(1) : [];
      const level = await passLevel(db, acc.playerId, season);
      const stars = await starBalance(db, acc.id);
      const refunds = await db.select({ n: sql<number>`count(*)` }).from(schema.orders).where(and(eq(schema.orders.accountId, acc.id), eq(schema.orders.status, "refunded")));
      return {
        ok: true, payMode: payMode(), stars,
        owned: live.filter((e) => e.kind === "item").map((e) => e.item),
        equipped: pl?.cosmetic ?? null,
        pass: { owned: live.some((e) => e.kind === "pass" && e.season === season), season, level, claimed: live.filter((e) => e.kind === "claim" && e.item.startsWith(`pass:${season}:`)).map((e) => e.item.split(":").slice(2).join(":")) },
        member: { until: memberUntil > Date.now() ? new Date(memberUntil).toISOString() : null, claimedToday: live.some((e) => e.kind === "claim" && e.item === `member:${day}`) },
        products, shop, locked: stars < 0 || Number(refunds[0]?.n ?? 0) >= 2,
      };
    },
  }),

  createOrder: defineAction({
    description: "Starts a purchase: returns a Stripe Checkout URL, or (DEV_PAYMENTS=1) an order to confirm with devPay.",
    request: z.object({ token: z.string().max(200), product: z.enum(Object.keys(PRODUCTS) as [ProductId, ...ProductId[]]), origin: z.string().url().max(200) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), url: z.string().optional(), orderId: z.string().optional(), dev: z.boolean().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const acc = await sessionAccount(db, args.token);
      if (!acc) return { ok: false, error: "先登录账号" };
      const mode = payMode();
      if (mode === "off") return { ok: false, error: "支付还没开通（服务器需要配置 Stripe）" };
      const refunds = await db.select({ n: sql<number>`count(*)` }).from(schema.orders).where(and(eq(schema.orders.accountId, acc.id), eq(schema.orders.status, "refunded")));
      if (Number(refunds[0]?.n ?? 0) >= 2 || (await starBalance(db, acc.id)) < 0) return { ok: false, error: "这个账号退款次数过多，已暂停购买，请联系客服" };
      const recent = await db.select({ n: sql<number>`count(*)` }).from(schema.orders).where(and(eq(schema.orders.accountId, acc.id), gte(schema.orders.createdAt, new Date(Date.now() - 600_000))));
      if (Number(recent[0]?.n ?? 0) >= 10) return { ok: false, error: "下单太频繁了，稍后再试" };
      const pr = PRODUCTS[args.product];
      const currency = envFlag("STRIPE_CURRENCY") || "usd";
      const amount = currency === "cny" ? pr.cny : pr.usd;
      const id = `o_${randomBytes(12).toString("hex")}`;
      await db.insert(schema.orders).values({ id, accountId: acc.id, product: args.product, amount, currency, status: "pending", provider: mode, createdAt: new Date() });
      if (mode === "dev") return { ok: true, orderId: id, dev: true };
      try { return { ok: true, orderId: id, url: await stripeCheckout({ id, amount, currency, name: `湾区人生 · ${pr.name}` }, args.origin) }; }
      catch (e) { await db.update(schema.orders).set({ status: "failed" }).where(eq(schema.orders.id, id)); return { ok: false, error: `支付页打不开：${(e as Error).message}` }; }
    },
  }),

  devPay: defineAction({
    description: "Local testing only (DEV_PAYMENTS=1, no Stripe key): marks an order paid.",
    request: z.object({ token: z.string().max(200), orderId: z.string().max(64) }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      if (payMode() !== "dev") return { ok: false };
      const acc = await sessionAccount(db, args.token);
      const [o] = acc ? await db.select().from(schema.orders).where(eq(schema.orders.id, args.orderId)).limit(1) : [];
      if (!acc || !o || o.accountId !== acc.id) return { ok: false };
      return { ok: await fulfilOrder(db, o.id, "dev") };
    },
  }),

  paymentEvent: defineAction({
    description: "Internal: a verified payment-provider event (called by the server's own webhook route only).",
    request: z.object({ key: z.string().max(200), type: z.string().max(80), orderId: z.string().max(64).optional(), providerRef: z.string().max(200).optional() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const internal = (globalThis as { __shhrInternalKey?: string }).__shhrInternalKey;
      if (!internal || args.key !== internal) return { ok: false };
      const db = ctx.db<typeof schema>();
      if (args.type === "paid" && args.orderId) return { ok: await fulfilOrder(db, args.orderId, args.providerRef ?? null) };
      if (args.type === "refunded") {
        let id = args.orderId;
        if (!id && args.providerRef) { const [o] = await db.select().from(schema.orders).where(eq(schema.orders.providerRef, args.providerRef)).limit(1); id = o?.id; }
        if (id) await refundOrder(db, id);
        return { ok: !!id };
      }
      return { ok: false };
    },
  }),

  buyLook: defineAction({
    description: "Buys a look (name colour or title) with ✨. Looks never change money, stats or rank.",
    request: z.object({ token: z.string().max(200), item: z.enum(Object.keys(SHOP) as [ShopId, ...ShopId[]]) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const acc = await sessionAccount(db, args.token);
      if (!acc) return { ok: false, error: "先登录账号" };
      const [have] = await db.select().from(schema.entitlements).where(and(eq(schema.entitlements.accountId, acc.id), eq(schema.entitlements.kind, "item"), eq(schema.entitlements.item, args.item))).limit(1);
      if (have && !have.revokedAt) return { ok: false, error: "已经有了" };
      const ok = await bookStars(db, acc.id, -SHOP[args.item].stars, "shop", `${acc.id}:${args.item}`);
      if (!ok) return { ok: false, error: "✨ 不够" };
      await grantItem(db, acc.id, args.item, null);
      return { ok: true };
    },
  }),

  equipLook: defineAction({
    description: "Wears an owned look on the account's character (or takes it off with null). Members may wear the gold name.",
    request: z.object({ token: z.string().max(200), item: z.string().max(40).nullable() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const acc = await sessionAccount(db, args.token);
      if (!acc?.playerId) return { ok: false, error: "先登录并绑定角色" };
      if (args.item) {
        const ents = (await db.select().from(schema.entitlements).where(eq(schema.entitlements.accountId, acc.id))).filter((e) => !e.revokedAt);
        const member = ents.some((e) => e.kind === "member" && (e.expiresAt?.getTime() ?? 0) > Date.now());
        if (!ents.some((e) => e.kind === "item" && e.item === args.item) && !(member && args.item === "name-gold")) return { ok: false, error: "还没有这个外观" };
      }
      await db.update(schema.players).set({ cosmetic: args.item }).where(eq(schema.players.id, acc.playerId));
      dropWorldCache(); ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  claimStars: defineAction({
    description: "Claims a season-pass level (free or paid track) or today's member ✨. Each claim pays once.",
    request: z.object({ token: z.string().max(200), what: z.enum(["pass", "member"]), track: z.enum(["free", "paid"]).optional(), level: z.number().int().min(1).max(PASS_LEVELS).optional() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), stars: z.number().optional(), item: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const acc = await sessionAccount(db, args.token);
      if (!acc) return { ok: false, error: "先登录账号" };
      const { season, day } = bjParts();
      const ents = (await db.select().from(schema.entitlements).where(eq(schema.entitlements.accountId, acc.id))).filter((e) => !e.revokedAt);
      if (args.what === "member") {
        if (!ents.some((e) => e.kind === "member" && (e.expiresAt?.getTime() ?? 0) > Date.now())) return { ok: false, error: "还不是会员" };
        const ok = await bookStars(db, acc.id, MEMBER_DAILY, "member", `${acc.id}:${day}`);
        if (!ok) return { ok: false, error: "今天已经领过了" };
        await db.insert(schema.entitlements).values({ accountId: acc.id, kind: "claim", item: `member:${day}`, createdAt: new Date() });
        return { ok: true, stars: MEMBER_DAILY };
      }
      const track = args.track ?? "free", level = args.level ?? 1;
      if (track === "paid" && !ents.some((e) => e.kind === "pass" && e.season === season)) return { ok: false, error: "先买本季通行证" };
      if (level > await passLevel(db, acc.playerId, season)) return { ok: false, error: "还没到这一级：每天签到升一级" };
      const rw = passReward(track, level);
      if (!rw.stars && !rw.item) return { ok: false, error: "这一级没有奖励" };
      const ref = `${acc.id}:${season}:${track}:${level}`;
      if (rw.stars) { if (!(await bookStars(db, acc.id, rw.stars, "pass", ref))) return { ok: false, error: "已经领过了" }; }
      else { const [dup] = await db.select().from(schema.entitlements).where(and(eq(schema.entitlements.accountId, acc.id), eq(schema.entitlements.item, `pass:${season}:${track}:${level}`))).limit(1); if (dup) return { ok: false, error: "已经领过了" }; }
      await db.insert(schema.entitlements).values({ accountId: acc.id, kind: "claim", item: `pass:${season}:${track}:${level}`, createdAt: new Date() });
      if (rw.item) await grantItem(db, acc.id, rw.item, null);
      return { ok: true, stars: rw.stars, item: rw.item };
    },
  }),

  /* ---- 账号 ---- */
  requestLoginCode: defineAction({
    description: "Sends a 6-digit login code to an email address or phone number (rate-limited; codes expire in 10 minutes).",
    request: z.object({ provider: z.enum(["email", "phone"]), to: z.string().min(3).max(200) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), devCode: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const subject = normSubject(args.provider, args.to);
      if (!subject) return { ok: false, error: args.provider === "email" ? "邮箱格式不对" : "手机号格式不对（国内 11 位，海外请带 +国家码）" };
      const { ipHash } = ipHashes();
      const recent = await db.select().from(schema.loginCodes).where(and(eq(schema.loginCodes.provider, args.provider), eq(schema.loginCodes.subject, subject), gte(schema.loginCodes.createdAt, new Date(Date.now() - 3600_000)))).orderBy(desc(schema.loginCodes.id));
      if (recent[0] && Date.now() - recent[0].createdAt.getTime() < 60_000) return { ok: false, error: "发得太快了，1 分钟后再试" };
      if (recent.length >= 5) return { ok: false, error: "这个号码 / 邮箱这一小时请求太多次了" };
      if (ipHash) {
        const fromNet = await db.select({ n: sql<number>`count(*)` }).from(schema.loginCodes).where(and(eq(schema.loginCodes.ipHash, ipHash), gte(schema.loginCodes.createdAt, new Date(Date.now() - 3600_000))));
        if (Number(fromNet[0]?.n ?? 0) >= 20) return { ok: false, error: "这个网络请求验证码太频繁了" };
      }
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const sender = (globalThis as { __shhrSendCode?: CodeSender }).__shhrSendCode;
      const dev = envFlag("DEV_LOGIN_CODES") === "1";
      if (!sender && !dev) return { ok: false, error: "登录服务还没配置（服务器需要设置 SMTP 或短信服务）" };
      await db.insert(schema.loginCodes).values({ provider: args.provider, subject, codeHash: sha(`${subject}:${code}`), ipHash, expiresAt: new Date(Date.now() + 10 * 60_000), createdAt: new Date() });
      if (sender) { try { await sender(args.provider, subject, code); } catch { return { ok: false, error: "验证码发送失败，稍后再试" }; } }
      if (dev) { console.log(`[dev login code] ${subject}: ${code}`); return { ok: true, devCode: code }; }
      return { ok: true };
    },
  }),

  verifyLoginCode: defineAction({
    description: "Checks a login code; creates the account on first login, binds the current guest player to it if the account has none, and returns a session token.",
    request: z.object({ provider: z.enum(["email", "phone"]), to: z.string().min(3).max(200), code: z.string().regex(/^\d{6}$/), playerId: z.string().min(4).max(64).optional(), device: z.string().max(64).optional() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), token: z.string().optional(), accountPlayerId: z.string().nullable().optional(), linked: z.boolean().optional(), hasCloudSave: z.boolean().optional(), isNew: z.boolean().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const subject = normSubject(args.provider, args.to);
      if (!subject) return { ok: false, error: "格式不对" };
      const [lc] = await db.select().from(schema.loginCodes).where(and(eq(schema.loginCodes.provider, args.provider), eq(schema.loginCodes.subject, subject))).orderBy(desc(schema.loginCodes.id)).limit(1);
      if (!lc || lc.usedAt || lc.expiresAt.getTime() < Date.now()) return { ok: false, error: "验证码已过期，请重新获取" };
      if (lc.attempts >= 5) return { ok: false, error: "错误次数太多，请重新获取验证码" };
      if (lc.codeHash !== sha(`${subject}:${args.code}`)) {
        await db.update(schema.loginCodes).set({ attempts: lc.attempts + 1 }).where(eq(schema.loginCodes.id, lc.id));
        return { ok: false, error: `验证码不对（还能试 ${4 - lc.attempts} 次）` };
      }
      await db.update(schema.loginCodes).set({ usedAt: new Date() }).where(eq(schema.loginCodes.id, lc.id));
      let isNew = false;
      const [idn] = await db.select().from(schema.identities).where(and(eq(schema.identities.provider, args.provider), eq(schema.identities.subject, subject))).limit(1);
      let accountId = idn?.accountId;
      if (!accountId) {
        accountId = randomUUID(); isNew = true;
        await db.insert(schema.accounts).values({ id: accountId, playerId: null, status: "active", createdAt: new Date() });
        await db.insert(schema.identities).values({ provider: args.provider, subject, accountId, verifiedAt: new Date() });
      }
      let [acc] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, accountId)).limit(1);
      if (!acc || acc.status !== "active") return { ok: false, error: "这个账号已注销" };
      let linked = false;
      if (args.playerId) {
        const [pl] = await db.select().from(schema.players).where(eq(schema.players.id, args.playerId)).limit(1);
        if (pl && !acc.playerId && !pl.accountId) {
          await db.update(schema.accounts).set({ playerId: pl.id }).where(eq(schema.accounts.id, accountId));
          await db.update(schema.players).set({ accountId }).where(eq(schema.players.id, pl.id));
          linked = true; acc = { ...acc, playerId: pl.id };
        } else if (pl && acc.playerId === pl.id) linked = true;
      }
      const token = randomBytes(32).toString("hex");
      await db.insert(schema.sessions).values({ tokenHash: sha(token), accountId, device: cleanDevice(args.device), createdAt: new Date(), lastUsedAt: new Date() });
      const [cs] = acc.playerId ? await db.select({ id: schema.cloudSaves.playerId }).from(schema.cloudSaves).where(eq(schema.cloudSaves.playerId, acc.playerId)).limit(1) : [];
      return { ok: true, token, accountPlayerId: acc.playerId ?? null, linked, hasCloudSave: !!cs, isNew };
    },
  }),

  accountMe: defineAction({
    description: "The logged-in account: masked login methods, linked player, creation date.",
    request: z.object({ token: z.string().max(200) }),
    response: z.object({ ok: z.boolean(), account: z.object({ id: z.string(), createdAt: z.string(), playerId: z.string().nullable(), playerName: z.string().nullable(), identities: z.array(z.object({ provider: z.string(), masked: z.string() })) }).nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const acc = await sessionAccount(db, args.token);
      if (!acc) return { ok: false, account: null };
      const ids = await db.select().from(schema.identities).where(eq(schema.identities.accountId, acc.id));
      const [pl] = acc.playerId ? await db.select().from(schema.players).where(eq(schema.players.id, acc.playerId)).limit(1) : [];
      return { ok: true, account: { id: acc.id.slice(0, 8), createdAt: acc.createdAt.toISOString(), playerId: acc.playerId, playerName: pl?.name ?? null, identities: ids.map((i) => ({ provider: i.provider, masked: maskSubject(i.provider, i.subject) })) } };
    },
  }),

  accountLoadSave: defineAction({
    description: "Returns the cloud save of the account's player, to continue on a new device after logging in.",
    request: z.object({ token: z.string().max(200) }),
    response: z.object({ ok: z.boolean(), save: z.string().optional(), meta: z.string().optional(), secret: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const acc = await sessionAccount(db, args.token);
      if (!acc?.playerId) return { ok: false };
      const [row] = await db.select().from(schema.cloudSaves).where(eq(schema.cloudSaves.playerId, acc.playerId)).limit(1);
      return row ? { ok: true, save: row.save, meta: row.meta, secret: row.secret } : { ok: false };
    },
  }),

  logout: defineAction({
    description: "Ends this session (or every session of the account with everywhere=true).",
    request: z.object({ token: z.string().max(200), everywhere: z.boolean().optional() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const acc = await sessionAccount(db, args.token);
      if (!acc) return { ok: true };
      if (args.everywhere) await db.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.accountId, acc.id));
      else await db.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.tokenHash, sha(args.token)));
      return { ok: true };
    },
  }),

  exportAccountData: defineAction({
    description: "Everything the server holds about the account and its player, as JSON (data portability).",
    request: z.object({ token: z.string().max(200) }),
    response: z.object({ ok: z.boolean(), json: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const acc = await sessionAccount(db, args.token);
      if (!acc) return { ok: false };
      const pid = acc.playerId ?? "";
      const ids = await db.select().from(schema.identities).where(eq(schema.identities.accountId, acc.id));
      const [pl] = pid ? await db.select().from(schema.players).where(eq(schema.players.id, pid)).limit(1) : [];
      const chat = pid ? await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.playerId, pid)) : [];
      const dms = pid ? await db.select().from(schema.messages).where(eq(schema.messages.fromId, pid)) : [];
      const feed = pid ? await db.select().from(schema.feedEvents).where(eq(schema.feedEvents.playerId, pid)) : [];
      const [cs] = pid ? await db.select().from(schema.cloudSaves).where(eq(schema.cloudSaves.playerId, pid)).limit(1) : [];
      const out = {
        exportedAt: new Date().toISOString(),
        account: { createdAt: acc.createdAt, loginMethods: ids.map((i) => ({ provider: i.provider, subject: i.subject })) },
        player: pl ? { name: pl.name, emoji: pl.emoji, city: pl.cityKey, gameDay: pl.gameDay, money: pl.money, careerIdx: pl.careerIdx, employer: pl.employer, stamps: pl.stamps, title: pl.title, createdAt: pl.createdAt } : null,
        publicChat: chat.map((c) => ({ body: c.body, at: c.createdAt })), privateMessagesSent: dms.map((m) => ({ body: m.body, at: m.createdAt })), feed: feed.map((f) => ({ text: f.text, at: f.createdAt })),
        cloudSave: cs ? { save: cs.save, meta: cs.meta, updatedAt: cs.updatedAt } : null,
      };
      return { ok: true, json: JSON.stringify(out, null, 2) };
    },
  }),

  deleteAccount: defineAction({
    description: "Deletes the account: login methods, sessions, cloud save, chats, messages and feed posts of its player; the player's name is replaced and it leaves every list.",
    request: z.object({ token: z.string().max(200), confirm: z.literal("注销") }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const acc = await sessionAccount(db, args.token);
      if (!acc) return { ok: false };
      const pid = acc.playerId;
      await db.delete(schema.identities).where(eq(schema.identities.accountId, acc.id));
      await db.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.accountId, acc.id));
      await db.update(schema.accounts).set({ status: "deleted", deletedAt: new Date(), playerId: null }).where(eq(schema.accounts.id, acc.id));
      if (pid) {
        await db.delete(schema.cloudSaves).where(eq(schema.cloudSaves.playerId, pid));
        await db.delete(schema.chatMessages).where(eq(schema.chatMessages.playerId, pid));
        await db.delete(schema.messages).where(sql`${schema.messages.fromId} = ${pid} OR ${schema.messages.toId} = ${pid}`);
        await db.delete(schema.feedEvents).where(eq(schema.feedEvents.playerId, pid));
        await db.update(schema.players).set({ name: "已注销用户", accountId: null, banned: 1, suspect: 1, title: null }).where(eq(schema.players.id, pid));
      }
      dropWorldCache(); ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  claimReward: defineAction({
    description: "Grants a daily reward (sign-in, streak) or the one-time welcome bonus, decided on the server: once per player per Beijing day, at most 3 accounts per device per day, welcome once per player and per device.",
    request: z.object({ playerId: z.string().min(4).max(64), kind: z.enum(["signin", "streak", "welcome"]), device: z.string().max(64).optional() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), money: z.number(), energy: z.number(), n: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [me] = await db.select().from(schema.players).where(eq(schema.players.id, args.playerId)).limit(1);
      const none = { money: 0, energy: 0, n: 0 };
      if (!me) return { ok: false, error: "先进城", ...none };
      const dev = cleanDevice(args.device) ?? me.device ?? null;
      const { day } = bjParts();
      const keyDay = args.kind === "welcome" ? "once" : day;
      const [dup] = await db.select().from(schema.rewardClaims).where(and(eq(schema.rewardClaims.playerId, me.id), eq(schema.rewardClaims.kind, args.kind), eq(schema.rewardClaims.day, keyDay))).limit(1);
      if (dup) return { ok: false, error: args.kind === "welcome" ? "见面礼已经领过了" : "今天已经领过了", ...none };
      if (dev) {
        const sameDev = await db.select({ n: sql<number>`count(*)` }).from(schema.rewardClaims).where(and(eq(schema.rewardClaims.device, dev), eq(schema.rewardClaims.kind, args.kind), eq(schema.rewardClaims.day, keyDay)));
        const cap = args.kind === "welcome" ? 1 : 3;
        if (Number(sameDev[0]?.n ?? 0) >= cap) return { ok: false, error: args.kind === "welcome" ? "这台设备已经领过见面礼了" : "这台设备今天领奖的账号太多了", ...none };
      }
      let n = 1, money = 0, energy = 0;
      if (args.kind === "signin") { money = 30; energy = 10; }
      else if (args.kind === "welcome") { money = 100; }
      else {
        const y = new Date(`${day}T00:00:00Z`); y.setUTCDate(y.getUTCDate() - 1);
        const [prev] = await db.select().from(schema.rewardClaims).where(and(eq(schema.rewardClaims.playerId, me.id), eq(schema.rewardClaims.kind, "streak"), eq(schema.rewardClaims.day, y.toISOString().slice(0, 10)))).limit(1);
        n = (prev?.n ?? 0) + 1;
        const k = Math.min(7, n); money = 40 + k * 30; energy = k >= 3 ? 10 : 0;
      }
      await db.insert(schema.rewardClaims).values({ playerId: me.id, kind: args.kind, day: keyDay, n, money, device: dev, createdAt: new Date() }).onConflictDoNothing();
      await creditMoney(db, me.id, money, args.kind);
      return { ok: true, money, energy, n };
    },
  }),

  /* ---- 自建统计 & 报错 ---- */
  track: defineAction({
    description: "Records a small batch of anonymous product events (retention, funnels) for the admin page.",
    request: z.object({ playerId: z.string().min(4).max(64), events: z.array(z.object({ name: z.string().regex(/^[a-z0-9_:.-]{1,40}$/), props: z.record(z.string(), z.union([z.string().max(60), z.number(), z.boolean()])).optional() })).min(1).max(25) }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const player = pubOf(args.playerId);
      const { day } = bjParts();
      const recent = await db.select({ n: sql<number>`count(*)` }).from(schema.events).where(and(eq(schema.events.player, player), gte(schema.events.createdAt, new Date(Date.now() - 600_000))));
      if (Number(recent[0]?.n ?? 0) > 400) return { ok: false };
      const now = new Date();
      /* 保留期限（见隐私政策）：统计 12 个月、报错 90 天、已处理举报 12 个月——偶尔顺手清理 */
      if (Math.random() < 0.01) {
        await db.delete(schema.events).where(sql`${schema.events.createdAt} < ${Date.now() - 365 * 86_400_000}`);
        await db.delete(schema.clientErrors).where(sql`${schema.clientErrors.lastAt} < ${Date.now() - 90 * 86_400_000}`);
        await db.delete(schema.reports).where(sql`${schema.reports.status} != 'open' AND ${schema.reports.resolvedAt} < ${Date.now() - 365 * 86_400_000}`);
      }
      for (const e of args.events) await db.insert(schema.events).values({ player, name: e.name, props: e.props ? JSON.stringify(e.props).slice(0, 400) : null, day, createdAt: now });
      return { ok: true };
    },
  }),

  reportError: defineAction({
    description: "Records a client-side error (deduped by message) so crashes show up on the admin page.",
    request: z.object({ playerId: z.string().max(64).optional(), message: z.string().min(1).max(300), stack: z.string().max(2000).optional(), url: z.string().max(300).optional(), ua: z.string().max(300).optional() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [hit] = await db.select().from(schema.clientErrors).where(eq(schema.clientErrors.message, args.message)).limit(1);
      if (hit) { await db.update(schema.clientErrors).set({ count: hit.count + 1, lastAt: new Date() }).where(eq(schema.clientErrors.id, hit.id)); return { ok: true }; }
      const total = await db.select({ n: sql<number>`count(*)` }).from(schema.clientErrors);
      if (Number(total[0]?.n ?? 0) > 5000) return { ok: false };
      await db.insert(schema.clientErrors).values({ player: args.playerId ? pubOf(args.playerId) : null, message: args.message, stack: args.stack ?? null, url: args.url ?? null, ua: args.ua ?? null, count: 1, createdAt: new Date(), lastAt: new Date() });
      return { ok: true };
    },
  }),

  /* ---- 管理后台（需要服务器环境变量 ADMIN_TOKEN） ---- */
  adminOverview: defineAction({
    description: "Admin: players, daily actives, D1/D7 retention, top events, open reports with context, recent errors and chat. Requires the ADMIN_TOKEN.",
    request: z.object({ token: z.string().max(200) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), data: z.any().optional() }),
    async handler(ctx, args) {
      if (!(await adminOk(ctx.db<typeof schema>(), args.token))) return { ok: false, error: adminToken() ? "口令不对" : "服务器没有设置 ADMIN_TOKEN（至少 12 位），后台未开启" };
      const db = ctx.db<typeof schema>();
      const totalPlayers = Number((await db.select({ n: sql<number>`count(*)` }).from(schema.players))[0]?.n ?? 0);
      const banned = Number((await db.select({ n: sql<number>`count(*)` }).from(schema.players).where(eq(schema.players.banned, 1)))[0]?.n ?? 0);
      const since = new Date(Date.now() - 31 * 86_400_000);
      const ev = await db.select({ player: schema.events.player, day: schema.events.day }).from(schema.events).where(gte(schema.events.createdAt, since));
      const daysBy = new Map<string, Set<string>>();
      for (const e of ev) (daysBy.get(e.player) ?? daysBy.set(e.player, new Set()).get(e.player)!).add(e.day);
      const dau = new Map<string, number>();
      for (const days of daysBy.values()) for (const d of days) dau.set(d, (dau.get(d) ?? 0) + 1);
      const addDays = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
      const today = bjParts().day;
      const cohort = (n: number) => { let base = 0, kept = 0; for (const days of daysBy.values()) { const first = [...days].sort()[0]!; if (addDays(first, n) > today) continue; base++; if (days.has(addDays(first, n))) kept++; } return { base, kept, rate: base ? Math.round((kept / base) * 1000) / 10 : null }; };
      const top = await db.select({ name: schema.events.name, n: sql<number>`count(*)` }).from(schema.events).where(gte(schema.events.createdAt, new Date(Date.now() - 7 * 86_400_000))).groupBy(schema.events.name).orderBy(desc(sql`count(*)`)).limit(25);
      const reps = await db.select().from(schema.reports).where(eq(schema.reports.status, "open")).orderBy(desc(schema.reports.id)).limit(50);
      const named = async (id: string) => { const [p] = await db.select().from(schema.players).where(eq(schema.players.id, id)).limit(1); return p ? { pub: pubOf(id), name: p.name, banned: !!p.banned } : { pub: pubOf(id), name: "?", banned: false }; };
      const reports = [];
      for (const r of reps) reports.push({ id: r.id, reason: r.reason, createdAt: r.createdAt.toISOString(), reporter: await named(r.reporterId), target: await named(r.targetId), context: r.context ? JSON.parse(r.context) : [] });
      const errors = await db.select().from(schema.clientErrors).orderBy(desc(schema.clientErrors.lastAt)).limit(30);
      const chat = await db.select().from(schema.chatMessages).orderBy(desc(schema.chatMessages.id)).limit(40);
      /* 风险名单：一台设备多个账号、一个网络一天内大量新号、邀请情况 */
      const multiDevice = await db.select({ device: schema.players.device, n: sql<number>`count(*)`, names: sql<string>`group_concat(${schema.players.name}, '、')` }).from(schema.players).where(sql`${schema.players.device} IS NOT NULL`).groupBy(schema.players.device).having(sql`count(*) >= 3`).orderBy(desc(sql`count(*)`)).limit(20);
      const dayAgo = new Date(Date.now() - 86_400_000);
      const burstNet = await db.select({ group: schema.players.ipGroup, n: sql<number>`count(*)`, names: sql<string>`group_concat(${schema.players.name}, '、')` }).from(schema.players).where(and(sql`${schema.players.ipGroup} IS NOT NULL`, gte(schema.players.createdAt, dayAgo))).groupBy(schema.players.ipGroup).having(sql`count(*) >= 5`).orderBy(desc(sql`count(*)`)).limit(20);
      const inviteRows = await db.select({ inviter: schema.invites.inviterId, status: schema.invites.status, n: sql<number>`count(*)` }).from(schema.invites).groupBy(schema.invites.inviterId, schema.invites.status);
      const inv = new Map<string, Record<string, number>>();
      for (const r of inviteRows) { const m = inv.get(r.inviter) ?? {}; m[r.status] = Number(r.n); inv.set(r.inviter, m); }
      const inviters = [];
      for (const [id, m] of [...inv.entries()].sort((a, b) => Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0)).slice(0, 20)) inviters.push({ ...(await named(id)), pending: m.pending ?? 0, granted: m.granted ?? 0, rejected: m.rejected ?? 0, expired: m.expired ?? 0 });
      const rejected = await db.select().from(schema.invites).where(eq(schema.invites.status, "rejected")).orderBy(desc(schema.invites.decidedAt)).limit(20);
      const rejectedList = [];
      for (const r of rejected) rejectedList.push({ inviter: (await named(r.inviterId)).name, invitee: (await named(r.inviteeId)).name, reason: r.reason ?? "", at: r.decidedAt?.toISOString() ?? "" });
      /* 经济 / 付费：被拦下的进账（按玩家合计）、最近订单、✨ 流通量 */
      const clampRows = await db.select({ pid: schema.ledger.playerId, n: sql<number>`count(*)`, sum: sql<number>`sum(-${schema.ledger.amount})` }).from(schema.ledger).where(and(eq(schema.ledger.kind, "clamped"), gte(schema.ledger.createdAt, new Date(Date.now() - 7 * 86_400_000)))).groupBy(schema.ledger.playerId).orderBy(desc(sql`sum(-${schema.ledger.amount})`)).limit(20);
      const clampNames = clampRows.length ? await db.select({ id: schema.players.id, name: schema.players.name }).from(schema.players).where(sql`${schema.players.id} in (${sql.join(clampRows.map((r) => sql`${r.pid}`), sql`, `)})`) : [];
      const recentOrders = await db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt)).limit(30);
      const starsOut = Number((await db.select({ n: sql<number>`coalesce(sum(${schema.starLedger.amount}), 0)` }).from(schema.starLedger))[0]?.n ?? 0);
      const economy = {
        clamped: clampRows.map((r) => ({ name: clampNames.find((x) => x.id === r.pid)?.name ?? "?", pub: pubOf(r.pid), n: Number(r.n), sum: Number(r.sum) })),
        orders: recentOrders.map((o) => ({ id: o.id, product: o.product, amount: o.amount, currency: o.currency, status: o.status, provider: o.provider, at: o.createdAt.toISOString() })),
        starsOutstanding: starsOut,
      };
      const fbRows = await db.select().from(schema.feedback).orderBy(desc(schema.feedback.id)).limit(80);
      const feedback = [];
      for (const f of fbRows) { const [pl] = await db.select({ name: schema.players.name }).from(schema.players).where(eq(schema.players.id, f.playerId)).limit(1); feedback.push({ id: f.id, kind: f.kind, body: f.body, city: f.city, name: pl?.name ?? "?", at: f.createdAt.toISOString() }); }
      return { ok: true, data: {
        totalPlayers, banned, economy, feedback,
        dau: [...dau.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-30),
        d1: cohort(1), d7: cohort(7),
        topEvents: top.map((t) => ({ name: t.name, n: Number(t.n) })),
        reports,
        errors: errors.map((e) => ({ id: e.id, message: e.message, stack: e.stack, url: e.url, ua: e.ua, count: e.count, lastAt: e.lastAt.toISOString() })),
        chat: chat.map((c) => ({ id: c.id, player: pubOf(c.playerId), name: c.playerName, city: c.cityKey, body: c.body, at: c.createdAt.toISOString() })),
        risk: { multiDevice: multiDevice.map((r) => ({ n: Number(r.n), names: r.names })), burstNet: burstNet.map((r) => ({ n: Number(r.n), names: r.names })), inviters, rejected: rejectedList },
      } };
    },
  }),

  /* ---- 运营后台：玩家管理、管理员团队、操作日志 ---- */
  adminPlayers: defineAction({
    description: "Admin: search players by nickname, public id, or the email / phone they signed in with.",
    request: z.object({ token: z.string().max(200), q: z.string().max(80) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), players: z.array(z.object({ pub: z.string(), name: z.string(), emoji: z.string(), city: z.string(), money: z.number(), banned: z.boolean(), muted: z.boolean(), suspect: z.boolean(), account: z.boolean(), lastSeen: z.string() })).optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      if (!(await adminOk(db, args.token))) return { ok: false, error: "口令不对" };
      const q = args.q.trim();
      let rows: (typeof schema.players.$inferSelect)[] = [];
      if (!q) rows = await db.select().from(schema.players).orderBy(desc(schema.players.lastSeen)).limit(30);
      else {
        const byId = await db.select().from(schema.identities).where(sql`${schema.identities.subject} like ${"%" + q + "%"}`).limit(10);
        const accIds = byId.map((r) => r.accountId);
        rows = await db.select().from(schema.players).where(sql`${schema.players.name} like ${"%" + q + "%"} or ${schema.players.pub} like ${q + "%"}${accIds.length ? sql` or ${schema.players.accountId} in (${sql.join(accIds.map((a) => sql`${a}`), sql`, `)})` : sql``}`).orderBy(desc(schema.players.lastSeen)).limit(30);
      }
      return { ok: true, players: rows.map((p) => ({ pub: p.pub ?? pubOf(p.id), name: p.name, emoji: p.emoji, city: p.cityKey, money: p.money, banned: !!p.banned, muted: isMuted(p), suspect: !!p.suspect, account: !!p.accountId, lastSeen: p.lastSeen.toISOString() })) };
    },
  }),

  adminPlayer: defineAction({
    description: "Admin: one player's full record — balances, login methods (masked), money ledger, ✨ ledger, orders, reports against them, recent chat.",
    request: z.object({ token: z.string().max(200), pub: z.string().max(64) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), data: z.any().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      if (!(await adminOk(db, args.token))) return { ok: false, error: "口令不对" };
      const [p] = await db.select().from(schema.players).where(eq(schema.players.pub, args.pub)).limit(1);
      if (!p) return { ok: false, error: "找不到这个玩家" };
      const ids = p.accountId ? await db.select().from(schema.identities).where(eq(schema.identities.accountId, p.accountId)) : [];
      const [acc] = p.accountId ? await db.select().from(schema.accounts).where(eq(schema.accounts.id, p.accountId)).limit(1) : [];
      const stars = p.accountId ? await starBalance(db, p.accountId) : 0;
      const ledger = await db.select().from(schema.ledger).where(eq(schema.ledger.playerId, p.id)).orderBy(desc(schema.ledger.id)).limit(20);
      const starRows = p.accountId ? await db.select().from(schema.starLedger).where(eq(schema.starLedger.accountId, p.accountId)).orderBy(desc(schema.starLedger.id)).limit(15) : [];
      const orders = p.accountId ? await db.select().from(schema.orders).where(eq(schema.orders.accountId, p.accountId)).orderBy(desc(schema.orders.createdAt)).limit(15) : [];
      const reports = await db.select().from(schema.reports).where(eq(schema.reports.targetId, p.id)).orderBy(desc(schema.reports.id)).limit(10);
      const chat = await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.playerId, p.id)).orderBy(desc(schema.chatMessages.id)).limit(15);
      return { ok: true, data: {
        pub: p.pub, name: p.name, emoji: p.emoji, city: p.cityKey, day: p.gameDay, money: p.money, season: p.season, banned: !!p.banned, mutedUntil: p.mutedUntil?.toISOString() ?? null, suspect: !!p.suspect, activeDays: p.activeDays, createdAt: p.createdAt.toISOString(), lastSeen: p.lastSeen.toISOString(),
        account: acc ? { status: acc.status, createdAt: acc.createdAt.toISOString(), logins: ids.map((i) => `${i.provider === "email" ? "📧" : "📱"} ${maskSubject(i.provider, i.subject)}`) } : null,
        stars,
        ledger: ledger.map((l) => ({ kind: l.kind, amount: l.amount, balance: l.balance, note: l.note, at: l.createdAt.toISOString() })),
        starLedger: starRows.map((l) => ({ reason: l.reason, amount: l.amount, balance: l.balance, at: l.createdAt.toISOString() })),
        orders: orders.map((o) => ({ id: o.id, product: o.product, amount: o.amount, currency: o.currency, status: o.status, at: o.createdAt.toISOString() })),
        reports: reports.map((r) => ({ reason: r.reason, status: r.status, at: r.createdAt.toISOString() })),
        chat: chat.map((c) => ({ body: c.body, at: c.createdAt.toISOString() })),
      } };
    },
  }),

  adminPlayerAct: defineAction({
    description: "Admin: act on one player — ban / unban, mute for N hours / unmute, force a new nickname, compensate season money or ✨, clear the cheat flag. Every action goes to the audit log.",
    request: z.object({ token: z.string().max(200), pub: z.string().max(64), act: z.enum(["ban", "unban", "mute", "unmute", "rename", "money", "stars", "clearSuspect"]), hours: z.number().int().min(1).max(24 * 30).optional(), name: z.string().max(20).optional(), amount: z.number().int().min(-100000).max(100000).optional(), note: z.string().max(120).optional() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const money = args.act === "money" || args.act === "stars";
      const who = await adminOk(db, args.token, money ? ["ops"] : ["ops", "moderator"]);
      if (!who) return { ok: false, error: money ? "补偿需要「运营」或「主账号」权限" : "口令不对" };
      const [p] = await db.select().from(schema.players).where(eq(schema.players.pub, args.pub)).limit(1);
      if (!p) return { ok: false, error: "找不到这个玩家" };
      const note = (args.note ?? "").trim();
      if (args.act === "ban" || args.act === "unban") await db.update(schema.players).set({ banned: args.act === "ban" ? 1 : 0 }).where(eq(schema.players.id, p.id));
      else if (args.act === "mute") await db.update(schema.players).set({ mutedUntil: new Date(Date.now() + (args.hours ?? 24) * 3600_000) }).where(eq(schema.players.id, p.id));
      else if (args.act === "unmute") await db.update(schema.players).set({ mutedUntil: null }).where(eq(schema.players.id, p.id));
      else if (args.act === "rename") { const nm = cleanName(args.name ?? "") || "湾区居民"; await db.update(schema.players).set({ name: nm }).where(eq(schema.players.id, p.id)); }
      else if (args.act === "clearSuspect") await db.update(schema.players).set({ suspect: 0 }).where(eq(schema.players.id, p.id));
      else if (args.act === "money") { if (!args.amount) return { ok: false, error: "填一个金额" }; await creditMoney(db, p.id, args.amount, `补偿：${note || "运营发放"}（${who.name}）`); }
      else if (args.act === "stars") {
        if (!args.amount) return { ok: false, error: "填一个数量" };
        if (!p.accountId) return { ok: false, error: "这个玩家没绑定账号，✨ 记在账号上，发不了" };
        await bookStars(db, p.accountId, args.amount, "grant", `admin:${randomUUID()}`, true);
      }
      await audit(db, who, `player:${args.act}`, `${p.name} (${p.pub})`, [args.hours ? `${args.hours} 小时` : "", args.name ? `改名为 ${args.name}` : "", args.amount ? `数额 ${args.amount}` : "", note].filter(Boolean).join(" · "));
      dropWorldCache(); ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  adminTeam: defineAction({
    description: "Admin (owner only): list staff, add a staff member with a role (returns their token once), disable one.",
    request: z.object({ token: z.string().max(200), op: z.enum(["list", "add", "disable", "enable"]), name: z.string().max(30).optional(), role: z.enum(["ops", "moderator"]).optional(), id: z.number().int().optional() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), me: z.object({ name: z.string(), role: z.string() }).optional(), staff: z.array(z.object({ id: z.number(), name: z.string(), role: z.string(), disabled: z.boolean(), createdAt: z.string() })).optional(), newToken: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const who = await adminWho(db, args.token);
      if (!who) return { ok: false, error: "口令不对" };
      if (args.op !== "list" && who.role !== "owner") return { ok: false, error: "只有主账号（ADMIN_TOKEN）能管理团队" };
      let newToken: string | undefined;
      if (args.op === "add") {
        const name = (args.name ?? "").trim(); if (!name) return { ok: false, error: "填一个名字" };
        newToken = randomBytes(18).toString("base64url");
        await db.insert(schema.adminUsers).values({ name, tokenHash: createHash("sha256").update("shhr-admin:" + newToken).digest("hex"), role: args.role ?? "moderator", createdAt: new Date() });
        await audit(db, who, "team:add", name, args.role ?? "moderator");
      } else if ((args.op === "disable" || args.op === "enable") && args.id !== undefined) {
        await db.update(schema.adminUsers).set({ disabled: args.op === "disable" ? 1 : 0 }).where(eq(schema.adminUsers.id, args.id));
        await audit(db, who, `team:${args.op}`, `#${args.id}`, "");
      }
      const staff = who.role === "owner" ? await db.select().from(schema.adminUsers).orderBy(desc(schema.adminUsers.id)) : [];
      return { ok: true, me: who, staff: staff.map((u) => ({ id: u.id, name: u.name, role: u.role, disabled: !!u.disabled, createdAt: u.createdAt.toISOString() })), newToken };
    },
  }),

  adminAuditLog: defineAction({
    description: "Admin (owner / ops): the last 150 admin actions — who did what to whom, when.",
    request: z.object({ token: z.string().max(200) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), rows: z.array(z.object({ admin: z.string(), action: z.string(), target: z.string().nullable(), detail: z.string().nullable(), at: z.string() })).optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      if (!(await adminOk(db, args.token, ["ops"]))) return { ok: false, error: "需要「运营」或「主账号」权限" };
      const rows = await db.select().from(schema.adminAudit).orderBy(desc(schema.adminAudit.id)).limit(150);
      return { ok: true, rows: rows.map((r) => ({ admin: r.admin, action: r.action, target: r.target, detail: r.detail, at: r.createdAt.toISOString() })) };
    },
  }),

  adminModerate: defineAction({
    description: "Admin: resolve a report (dismiss / ban the reported player) or ban / unban a player by public id. Requires the ADMIN_TOKEN.",
    request: z.object({ token: z.string().max(200), reportId: z.number().int().optional(), targetPub: z.string().max(64).optional(), action: z.enum(["dismiss", "ban", "unban"]) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      if (!(await adminOk(ctx.db<typeof schema>(), args.token))) return { ok: false, error: "口令不对" };
      const db = ctx.db<typeof schema>();
      let targetId: string | null = null;
      if (args.reportId !== undefined) {
        const [r] = await db.select().from(schema.reports).where(eq(schema.reports.id, args.reportId)).limit(1);
        if (!r) return { ok: false, error: "举报不存在" };
        targetId = r.targetId;
        await db.update(schema.reports).set({ status: args.action === "dismiss" ? "dismissed" : "actioned", resolvedAt: new Date() }).where(eq(schema.reports.id, r.id));
      } else if (args.targetPub) {
        const [p] = await db.select().from(schema.players).where(eq(schema.players.pub, args.targetPub)).limit(1);
        targetId = p?.id ?? null;
      }
      if (targetId && args.action !== "dismiss") {
        const ban = args.action === "ban" ? 1 : 0;
        await db.update(schema.players).set({ banned: ban, ...(ban ? { suspect: 1 } : {}) }).where(eq(schema.players.id, targetId));
        if (ban) await db.update(schema.reports).set({ status: "actioned", resolvedAt: new Date() }).where(and(eq(schema.reports.targetId, targetId), eq(schema.reports.status, "open")));
        dropWorldCache(); ctx.invalidateQueries();
      }
      await audit(db, await adminWho(db, args.token), `report:${args.action}`, args.targetPub ?? (args.reportId !== undefined ? `report#${args.reportId}` : null), "");
      return { ok: true };
    },
  }),

  getWorld: defineAction({
    description:
      "Returns the shared world snapshot for a city: online players, chat, life feed and leaderboard.",
    request: z.object({ cityKey: z.enum(["sz", "hz", "hk"]) }),
    response: z.object({ world: worldResponse }),
    async handler(ctx, args) {
      return { world: await loadWorldCached(ctx, args.cityKey) };
    },
  }),

  getRealWeather: defineAction({
    description:
      "Returns the real current weather for Shenzhen or Huizhou (live channel, cached server-side for 30 minutes), used to drive the game's sky, rain and weather displays.",
    request: z.object({
      cityKey: z.enum(["sz", "hz", "hk"]),
      force: z.boolean().optional(),
    }),
    response: realWeatherResponse,
    async handler(ctx, args): Promise<z.infer<typeof realWeatherResponse>> {
      const db = ctx.db<typeof schema>();
      const cachedRows = await db
        .select()
        .from(schema.weatherSnapshots)
        .where(eq(schema.weatherSnapshots.cityKey, args.cityKey))
        .limit(1);
      const cached = cachedRows[0];
      const fresh =
        cached && Date.now() - cached.fetchedAt.getTime() < WEATHER_TTL_MS;
      if (cached && fresh && !args.force) {
        return { ...(JSON.parse(cached.payload) as StoredWeather), stale: false };
      }
      try {
        const meta = WEATHER_CITIES[args.cityKey];
        const res = await ctx.tool.weather(
          `${meta.en} weather today`,
          {
            location: { lat: meta.lat, lon: meta.lon, timezone: "Asia/Shanghai" },
            hourly_hours: 24,
          },
        );
        const c = res.content;
        const cond = c.conditions;
        const stored: StoredWeather = {
          ok: true,
          cityKey: args.cityKey,
          locationName: c.location || meta.zh,
          summary: c.summary ?? "",
          description: cond.description ?? "",
          kind: kindFromDescription(cond.description ?? ""),
          temperature: cond.temperature ?? null,
          unit: cond.unit || "°C",
          feelsLike: cond.feels_like ?? null,
          high: cond.high ?? null,
          low: cond.low ?? null,
          humidity: cond.humidity_percent ?? null,
          precipitationChance: cond.precipitation_chance ?? null,
          wind: cond.wind ?? null,
          sunrise: cond.sunrise ?? null,
          sunset: cond.sunset ?? null,
          alerts: c.alerts ?? [],
          forecast: (c.forecast_days ?? []).slice(0, 7).map((d) => ({
            date: d.date ?? null,
            summary: d.summary ?? null,
            high: d.high ?? null,
            low: d.low ?? null,
            precipitationChance: d.precipitation_chance ?? null,
          })),
          sourceName: c.sources?.[0]?.title ?? "天气服务",
          sourceUrl: c.sources?.[0]?.url ?? null,
          fetchedAt: new Date().toISOString(),
        };
        await db
          .insert(schema.weatherSnapshots)
          .values({
            cityKey: args.cityKey,
            payload: JSON.stringify(stored),
            fetchedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.weatherSnapshots.cityKey,
            set: {
              payload: JSON.stringify(stored),
              fetchedAt: new Date(),
            },
          });
        dropWorldCache();
        ctx.invalidateQueries();
        return { ...stored, stale: false };
      } catch {
        // Upstream failed: serve the last good snapshot, honestly marked
        // stale — never an invented condition.
        if (cached) {
          return { ...(JSON.parse(cached.payload) as StoredWeather), stale: true };
        }
        return {
          ok: false,
          stale: true,
          cityKey: args.cityKey,
          locationName: WEATHER_CITIES[args.cityKey].zh,
          summary: "",
          description: "",
          kind: "unknown",
          temperature: null,
          unit: "°C",
          feelsLike: null,
          high: null,
          low: null,
          humidity: null,
          precipitationChance: null,
          wind: null,
          sunrise: null,
          sunset: null,
          alerts: [],
          forecast: [],
          sourceName: "",
          sourceUrl: null,
          fetchedAt: new Date().toISOString(),
        };
      }
    },
  }),

  postChat: defineAction({
    description: "Posts a message to the player's city chat channel.",
    request: z.object({
      playerId: z.string().min(4).max(64),
      body: z.string().trim().min(1).max(120),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args): Promise<{ ok: boolean; error?: string }> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.players)
        .where(eq(schema.players.id, args.playerId))
        .limit(1);
      const me = rows[0];
      if (!me) throw new Error("player not registered");
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      /* 限流：同一个人 2.5 秒内只能说一句、1 分钟最多 8 句、1 分钟内不能重复同一句 */
      const recent = await db
        .select()
        .from(schema.chatMessages)
        .where(and(eq(schema.chatMessages.playerId, me.id), gte(schema.chatMessages.createdAt, new Date(Date.now() - 60_000))))
        .orderBy(desc(schema.chatMessages.id))
        .limit(10);
      const body = cleanText(args.body);
      if (recent[0] && Date.now() - recent[0].createdAt.getTime() < 2500) return { ok: false, error: "说得太快了，歇两秒再发" };
      if (recent.length >= 8) return { ok: false, error: "一分钟内发得太多了，稍后再聊" };
      if (recent.some((m) => m.body === body)) return { ok: false, error: "刚刚已经发过这句了" };
      await db.insert(schema.chatMessages).values({
        playerId: me.id,
        playerName: me.name,
        cityKey: me.cityKey,
        body,
        createdAt: new Date(),
      });
      dropWorldCache();
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  postFeed: defineAction({
    description:
      "Publishes a life milestone (promotion, APEC service, home upgrade…) to the shared city feed.",
    request: z.object({
      playerId: z.string().min(4).max(64),
      kind: z.enum(["join", "career", "apec", "home", "money", "finish", "life"]),
      text: z.string().trim().min(1).max(80),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.players)
        .where(eq(schema.players.id, args.playerId))
        .limit(1);
      const me = rows[0];
      if (!me) throw new Error("player not registered");
      if (me.banned || isMuted(me)) return { ok: true };
      const lastHour = await db
        .select({ n: sql<number>`count(*)` })
        .from(schema.feedEvents)
        .where(and(eq(schema.feedEvents.playerId, me.id), gte(schema.feedEvents.createdAt, new Date(Date.now() - 3_600_000))));
      if (Number(lastHour[0]?.n ?? 0) >= 40) return { ok: true };
      await db.insert(schema.feedEvents).values({
        playerId: me.id,
        playerName: me.name,
        kind: args.kind,
        text: cleanText(args.text),
        createdAt: new Date(),
      });
      dropWorldCache();
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  /* ---- 云存档：换设备、清缓存都不丢进度 ---- */
  cloudSave: defineAction({
    description: "Stores the player's whole save and meta progress, guarded by their transfer code.",
    request: z.object({
      playerId: z.string().min(4).max(64),
      secret: z.string().min(8).max(32),
      save: z.string().min(2).max(600_000),
      meta: z.string().min(2).max(200_000),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args): Promise<{ ok: boolean; error?: string }> {
      const db = ctx.db<typeof schema>();
      const [row] = await db.select().from(schema.cloudSaves).where(eq(schema.cloudSaves.playerId, args.playerId)).limit(1);
      if (row && row.secret !== args.secret) return { ok: false, error: "存档码不匹配" };
      if (!row) {
        const clash = await db.select().from(schema.cloudSaves).where(eq(schema.cloudSaves.secret, args.secret)).limit(1);
        if (clash.length > 0) return { ok: false, error: "存档码已被占用" };
        await db.insert(schema.cloudSaves).values({ playerId: args.playerId, secret: args.secret, save: args.save, meta: args.meta, updatedAt: new Date() });
      } else {
        await db.update(schema.cloudSaves).set({ save: args.save, meta: args.meta, updatedAt: new Date() }).where(eq(schema.cloudSaves.playerId, args.playerId));
      }
      return { ok: true };
    },
  }),

  cloudLoad: defineAction({
    description: "Returns the save stored under a transfer code, to continue on another device.",
    request: z.object({ secret: z.string().min(8).max(32) }),
    response: z.object({ ok: z.boolean(), playerId: z.string().optional(), save: z.string().optional(), meta: z.string().optional(), updatedAt: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [row] = await db.select().from(schema.cloudSaves).where(eq(schema.cloudSaves.secret, args.secret.trim().toUpperCase())).limit(1);
      if (!row) return { ok: false };
      return { ok: true, playerId: row.playerId, save: row.save, meta: row.meta, updatedAt: row.updatedAt.toISOString() };
    },
  }),

  finishSeason: defineAction({
    description:
      "Marks a player's 30-day season finished with its result title and posts it to the feed.",
    request: z.object({
      playerId: z.string().min(4).max(64),
      money: z.number().int().min(-1000000).max(100000000),
      careerIdx: z.number().int().min(0).max(4),
      apecCount: z.number().int().min(0).max(999),
      resultTitle: z.string().trim().min(1).max(40),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.players)
        .where(
          and(
            eq(schema.players.id, args.playerId),
            eq(schema.players.status, "playing"),
          ),
        )
        .limit(1);
      const me = rows[0];
      if (me) {
        await db
          .update(schema.players)
          .set({
            status: "finished",
            money: args.money,
            careerIdx: args.careerIdx,
            apecCount: args.apecCount,
            resultTitle: args.resultTitle,
            gameDay: 30,
            lastSeen: new Date(),
          })
          .where(eq(schema.players.id, args.playerId));
        await db.insert(schema.feedEvents).values({
          playerId: me.id,
          playerName: me.name,
          kind: "finish",
          text: `过完了 30 天，结局是「${args.resultTitle}」，存款 ${me.cityKey === "hk" ? "HK$" : "¥"}${args.money.toLocaleString()}`,
          createdAt: new Date(),
        });
        dropWorldCache();
        ctx.invalidateQueries();
      }
      return { ok: true };
    },
  }),
} satisfies ActionsModule;
