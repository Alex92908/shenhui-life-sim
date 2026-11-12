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

const GIFT_KINDS = ["tea", "breakfast", "hongbao", "referral", "invite", "share"] as const;
const giftShape = z.object({
  id: z.number(),
  fromId: z.string(),
  fromName: z.string(),
  kind: z.string(),
  company: z.string().nullable(),
  amount: z.number(),
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
/** Server-granted money (rewards): goes straight onto both balances, so the client's own +amount is not counted twice.
   NOTE: only `money` is bumped — `reportedMoney` is the last balance the
   CLIENT reported, and the client does not know about a server-side grant
   (it restores its balance from localStorage). If reportedMoney were bumped
   too, the next heartbeat would see the client's stale lower balance as a
   ¥(grant) "spend" and claw the whole grant back (settleMoney treats any
   client-proposed decrease as spending). The client picks the grant up from
   the heartbeat reply instead (see syncPresence onSuccess). */
async function creditMoney(db: ReturnType<Ctx["db"]>, playerId: string, amount: number, note: string) {
  const d = db as any;
  const [p] = await d.select().from(schema.players).where(eq(schema.players.id, playerId)).limit(1);
  if (!p || !amount) return;
  await d.update(schema.players).set({ money: p.money + amount }).where(eq(schema.players.id, playerId));
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

/* ---- round-2 (S): shared helpers for the round-2 server endpoints ----
   Conventions (same as the existing actions): defineAction + zod, playerId
   string (4–64), cleanText on free text, same-city + account gates +
   banned/muted checks, creditMoney for every payout, single-claim guards
   copied from claimGigMoney. No endpoint here moves real money (Starlight /
   Stripe); all amounts are in-game ¥ on the server ledger. */
const cityZ = z.enum(["sz", "hz", "hk"]);
const pidZ = z.string().min(4).max(64);
async function r2Player(db: Db, id: string) {
  const [p] = await db.select().from(schema.players).where(eq(schema.players.id, id)).limit(1);
  return p as typeof schema.players.$inferSelect | undefined;
}
/** Shared write rate-limit for the (c) community endpoints: ≤ 10 writes /
    player / minute (in-memory, per server process — same pattern as the
    world snapshot cache above). */
const communityWrites = new Map<string, number[]>();
function communityRateOk(playerId: string): boolean {
  const now = Date.now();
  const list = (communityWrites.get(playerId) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= 10) { communityWrites.set(playerId, list); return false; }
  list.push(now);
  communityWrites.set(playerId, list);
  return true;
}
const RATE_MSG = "操作太快了, 歇会儿再来";
const NO_PLAYER = "先进游戏再操作";

/* ---- (c) strays: spawn pools (real loc ids from client/src/data.ts) ---- */
const STRAY_POOLS: Record<string, { locId: string; locName: string; x: number; z: number }[]> = {
  sz: [
    { locId: "lianhua", locName: "莲花山公园", x: -2.8, z: -2.9 },
    { locId: "fun", locName: "深圳湾公园", x: -20.5, z: 4.6 },
    { locId: "talent", locName: "人才公园", x: -22, z: 6.8 },
    { locId: "dameisha", locName: "大梅沙海滨公园", x: 31.5, z: -0.5 },
    { locId: "xichong", locName: "西涌海滩", x: 36, z: -0.7 },
  ],
  hz: [
    { locId: "dongjiangpark", locName: "东江公园", x: -2.2, z: -9.6 },
    { locId: "dayawan", locName: "大亚湾黄金海岸", x: 10.4, z: 7.7 },
    { locId: "haiguiwan", locName: "海龟湾", x: 22.2, z: 20.3 },
  ],
  hk: [
    { locId: "vicpark", locName: "维多利亚公园", x: 16.6, z: 14.8 },
    { locId: "stanley", locName: "赤柱", x: 16.4, z: 20.9 },
    { locId: "tuenmun", locName: "屯门·黄金海岸", x: -9, z: 1.9 },
  ],
};
const STRAY_APPEARANCES = ["橘白相间", "通体雪白", "黑白花", "狸花纹", "三花", "灰色短毛", "黄毛", "小黑", "奶牛花", "玳瑁色"];
const STRAY_FEED_GAIN: Record<string, number> = { friendly: 15, shy: 10, wary: 8 };
const STRAY_FEED_NOTES: Record<string, string> = {
  friendly: "它立刻凑过来, 蹭了蹭你的手.",
  shy: "它等你走开几步, 才小心翼翼地过来吃.",
  wary: "它叼起食物跑到一边, 边吃边盯着你.",
};
async function ensureStrays(db: Db, city: string, gameDay: number) {
  const alive = await db.select().from(schema.strays).where(and(eq(schema.strays.city, city), eq(schema.strays.adopted, 0)));
  const target = 4; // keep 3–6 per city; top up to 4 on read (adopted ones are replaced elsewhere after a few days)
  const pool = STRAY_POOLS[city] ?? STRAY_POOLS.sz!;
  for (let i = alive.length; i < target; i++) {
    const spot = pool[Math.floor(Math.random() * pool.length)]!;
    const kind = Math.random() < 0.55 ? "cat" : "dog";
    const temper = (["friendly", "shy", "wary"] as const)[Math.floor(Math.random() * 3)]!;
    await db.insert(schema.strays).values({
      city, kind,
      appearance: STRAY_APPEARANCES[Math.floor(Math.random() * STRAY_APPEARANCES.length)] ?? "花色",
      temper, locId: spot.locId, locName: spot.locName, x: spot.x, z: spot.z,
      trust: 5 + Math.floor(Math.random() * 20), lastFedDay: -1, firstSeenDay: gameDay,
      adopted: 0, fedByCount: 0, createdAt: new Date(),
    });
  }
}
const strayShape = z.object({
  id: z.string(), kind: z.enum(["cat", "dog"]), appearance: z.string(), temper: z.enum(["friendly", "shy", "wary"]),
  pin: z.object({ locId: z.string(), locName: z.string(), x: z.number().optional(), z: z.number().optional() }),
  cityKey: z.enum(["sz", "hz", "hk"]), trust: z.number(), lastFedDay: z.number(), firstSeenDay: z.number(),
  adopted: z.boolean(), fedByCount: z.number(),
});
function strayView(r: typeof schema.strays.$inferSelect, gameDay: number) {
  // trust decays 5/day unfed (mirror of decayStrayTrust in community.ts)
  const days = Math.max(0, gameDay - Math.max(r.lastFedDay, r.firstSeenDay));
  const trust = Math.max(0, r.trust - 5 * days);
  return {
    id: String(r.id), kind: r.kind as "cat" | "dog", appearance: r.appearance, temper: r.temper as "friendly" | "shy" | "wary",
    pin: { locId: r.locId, locName: r.locName, x: r.x ?? undefined, z: r.z ?? undefined },
    cityKey: r.city as "sz" | "hz" | "hk", trust, lastFedDay: r.lastFedDay, firstSeenDay: r.firstSeenDay,
    adopted: !!r.adopted, fedByCount: r.fedByCount,
  };
}
const noticeReplyShape = z.object({ id: z.string(), authorId: z.string(), authorName: z.string(), text: z.string(), createdAt: z.string() });
const noticeShape = z.object({
  id: z.string(), kind: z.enum(["lost-pet", "lost-item", "found-pet", "found-item"]), cityKey: z.enum(["sz", "hz", "hk"]),
  title: z.string(), body: z.string(),
  pin: z.object({ locId: z.string(), locName: z.string(), x: z.number().optional(), z: z.number().optional() }),
  photoUrl: z.string().nullable(), authorId: z.string(), authorName: z.string(),
  status: z.enum(["open", "claimed", "expired"]), createdAt: z.string(), expiresAt: z.string(),
  replies: z.array(noticeReplyShape), claimedByName: z.string().nullable(),
});
async function noticeView(db: Db, r: typeof schema.notices.$inferSelect) {
  const replies = await db.select().from(schema.noticeReplies).where(eq(schema.noticeReplies.noticeId, r.id)).orderBy(schema.noticeReplies.id);
  const expired = r.expiresAt.getTime() <= Date.now();
  return {
    id: String(r.id), kind: r.kind as "lost-pet" | "lost-item" | "found-pet" | "found-item",
    cityKey: r.city as "sz" | "hz" | "hk", title: r.title, body: r.body,
    pin: { locId: r.locId, locName: r.locName, x: r.x ?? undefined, z: r.z ?? undefined },
    photoUrl: r.photoUrl, authorId: r.authorId, authorName: r.authorName,
    status: (expired && r.status === "open" ? "expired" : r.status) as "open" | "claimed" | "expired",
    createdAt: r.createdAt.toISOString(), expiresAt: r.expiresAt.toISOString(),
    replies: replies.map((x: typeof schema.noticeReplies.$inferSelect) => ({ id: String(x.id), authorId: x.authorId, authorName: x.authorName, text: x.text, createdAt: x.createdAt.toISOString() })),
    claimedByName: r.claimedByName,
  };
}
const snakeShape = z.object({
  id: z.string(), cityKey: z.enum(["sz", "hz", "hk"]),
  pin: z.object({ locId: z.string(), locName: z.string(), x: z.number().optional(), z: z.number().optional() }),
  speciesGuess: z.string(), description: z.string(), photoUrl: z.string().nullable(),
  reporterId: z.string(), reporterName: z.string(), reportedAt: z.string(), expiresAt: z.string(), confirmations: z.number(),
});
function snakeView(r: typeof schema.snakeReports.$inferSelect) {
  return {
    id: String(r.id), cityKey: r.city as "sz" | "hz" | "hk",
    pin: { locId: r.locId, locName: r.locName, x: r.x ?? undefined, z: r.z ?? undefined },
    speciesGuess: r.speciesGuess, description: r.description, photoUrl: r.photoUrl,
    reporterId: r.reporterId, reporterName: r.reporterName,
    reportedAt: r.createdAt.toISOString(), expiresAt: r.expiresAt.toISOString(), confirmations: r.confirmations,
  };
}
const fishingShape = z.object({
  id: z.string(), cityKey: z.enum(["sz", "hz", "hk"]),
  pin: z.object({ locId: z.string(), locName: z.string(), x: z.number().optional(), z: z.number().optional() }),
  catchDesc: z.string(), bait: z.string(), notes: z.string(), photoUrl: z.string().nullable(),
  reporterId: z.string(), reporterName: z.string(), reportedAt: z.string(), lastConfirmedAt: z.string(), confirmations: z.number(),
});
function fishingView(r: typeof schema.fishingSpots.$inferSelect) {
  return {
    id: String(r.id), cityKey: r.city as "sz" | "hz" | "hk",
    pin: { locId: r.locId, locName: r.locName, x: r.x ?? undefined, z: r.z ?? undefined },
    catchDesc: r.catchDesc, bait: r.bait, notes: r.notes, photoUrl: r.photoUrl,
    reporterId: r.reporterId, reporterName: r.reporterName,
    reportedAt: r.createdAt.toISOString(), lastConfirmedAt: r.lastConfirmedAt.toISOString(), confirmations: r.confirmations,
  };
}

/* ---- (d) black reports: jury settle (mirror of settleGigs) ---- */
const COMPANY_IDS = new Set(["startup", "tencent", "bytedance", "huawei", "dji", "baidu", "zte", "cmb", "pingan", "vanke", "byd", "tcl", "desay", "eve", "petro", "hk-bank", "hk-exchange", "hk-airline", "hk-property", "hk-sciencepark", "hk-rail"]);
const blackReportShape = z.object({
  id: z.number(), kind: z.enum(["landlord", "employer"]), city: z.enum(["sz", "hz", "hk"]),
  reporter: z.object({ id: z.string(), name: z.string(), emoji: z.string() }),
  targetId: z.string(), targetName: z.string(), body: z.string(), evidence: z.any().nullable(),
  status: z.enum(["open", "upheld", "rejected", "expired"]),
  votes: z.object({ uphold: z.number(), reject: z.number() }), myVote: z.enum(["uphold", "reject"]).nullable(),
  dueAt: z.string(), createdAt: z.string(), verdictNote: z.string().nullable().optional(),
});
const reputationShape = z.object({
  targetId: z.string(), targetName: z.string(), kind: z.enum(["landlord", "employer"]),
  score: z.number(), upheldCount: z.number(), rejectedCount: z.number(),
  flaggedUntil: z.string().nullable(), updatedAt: z.string(),
});
async function blackReportView(db: Db, r: typeof schema.blackReports.$inferSelect, meId: string) {
  const vs = await db.select().from(schema.blackReportVotes).where(eq(schema.blackReportVotes.reportId, r.id));
  const [rep] = await db.select().from(schema.players).where(eq(schema.players.id, r.reporterId)).limit(1);
  let evidence: unknown = null;
  try { evidence = r.evidence ? JSON.parse(r.evidence) : null; } catch { evidence = null; }
  return {
    id: r.id, kind: r.kind as "landlord" | "employer", city: r.city as "sz" | "hz" | "hk",
    reporter: { id: pubOf(r.reporterId), name: rep?.name ?? "?", emoji: rep?.emoji ?? "🙂" },
    targetId: r.targetId, targetName: r.targetName, body: r.body, evidence,
    status: r.status as "open" | "upheld" | "rejected" | "expired",
    votes: { uphold: vs.filter((v: { side: string }) => v.side === "uphold").length, reject: vs.filter((v: { side: string }) => v.side === "reject").length },
    myVote: (vs.find((v: { voterId: string }) => v.voterId === meId)?.side ?? null) as "uphold" | "reject" | null,
    dueAt: r.dueAt.toISOString(), createdAt: r.createdAt.toISOString(), verdictNote: r.verdictNote ?? null,
  };
}
function reputationView(r: typeof schema.blackReputations.$inferSelect) {
  return {
    targetId: r.targetId, targetName: r.targetName, kind: r.kind as "landlord" | "employer",
    score: r.score, upheldCount: r.upheldCount, rejectedCount: r.rejectedCount,
    flaggedUntil: r.flaggedUntil?.toISOString() ?? null, updatedAt: r.updatedAt.toISOString(),
  };
}
async function getStanding(db: Db, playerId: string) {
  const [s] = await db.select().from(schema.reporterStanding).where(eq(schema.reporterStanding.playerId, playerId)).limit(1);
  if (s) return s;
  await db.insert(schema.reporterStanding).values({ playerId, credibility: 100, filedCount: 0, upheldCount: 0, rejectedCount: 0, updatedAt: new Date() }).onConflictDoNothing();
  const [row] = await db.select().from(schema.reporterStanding).where(eq(schema.reporterStanding.playerId, playerId)).limit(1);
  return row!;
}
/** Close every due black report (24 h jury, quorum 3, majority decides, tie /
    no-quorum = expired). Reputation moves here — at settle time, so an
    upheld report warns other players even if the reporter never claims.
    Money / reporter standing move only in claimBlackReport. */
async function settleBlackReports(db: Db) {
  const now = new Date();
  const due = await db.select().from(schema.blackReports).where(and(eq(schema.blackReports.status, "open"), sql`${schema.blackReports.dueAt} <= ${now.getTime()}`));
  for (const r of due) {
    const vs = await db.select().from(schema.blackReportVotes).where(eq(schema.blackReportVotes.reportId, r.id));
    const uphold = vs.filter((v: { side: string }) => v.side === "uphold").length;
    const reject = vs.filter((v: { side: string }) => v.side === "reject").length;
    const total = uphold + reject;
    const status = total < 3 ? "expired" : uphold > reject ? "upheld" : reject > uphold ? "rejected" : "expired";
    const verdictNote = status === "upheld" ? `陪审团 ${uphold}–${reject} 判属实`
      : status === "rejected" ? `陪审团 ${uphold}–${reject} 驳回`
      : total < 3 ? `陪审团只凑到 ${total} 票，未达 ${3} 票，按“无法证实”结案` : `陪审团 ${uphold}–${reject} 打平，按“无法证实”结案`;
    const changed = await db.update(schema.blackReports).set({ status, verdictNote }).where(and(eq(schema.blackReports.id, r.id), eq(schema.blackReports.status, "open"))).returning({ id: schema.blackReports.id });
    if (!changed.length) continue; // another request settled it first
    if (status === "upheld" || status === "rejected") {
      const upheld = status === "upheld";
      const [rep] = await db.select().from(schema.blackReputations).where(and(eq(schema.blackReputations.targetId, r.targetId), eq(schema.blackReputations.kind, r.kind))).limit(1);
      if (rep) {
        await db.update(schema.blackReputations).set({
          score: upheld ? Math.max(0, rep.score - 20) : Math.min(100, rep.score + 5),
          upheldCount: rep.upheldCount + (upheld ? 1 : 0),
          rejectedCount: rep.rejectedCount + (upheld ? 0 : 1),
          ...(upheld ? { flaggedUntil: new Date(now.getTime() + 7 * 86_400_000) } : {}),
          updatedAt: now,
        }).where(and(eq(schema.blackReputations.targetId, r.targetId), eq(schema.blackReputations.kind, r.kind)));
      } else {
        await db.insert(schema.blackReputations).values({
          targetId: r.targetId, kind: r.kind, city: r.city, targetName: r.targetName,
          score: upheld ? 60 : 85, upheldCount: upheld ? 1 : 0, rejectedCount: upheld ? 0 : 1,
          flaggedUntil: upheld ? new Date(now.getTime() + 7 * 86_400_000) : null, updatedAt: now,
        });
      }
    }
  }
}
async function fileBlackReportInner(db: Db, me: typeof schema.players.$inferSelect, args: {
  kind: "landlord" | "employer"; city: "sz" | "hz" | "hk"; targetId: string; targetName: string; body: string; evidence?: unknown;
}): Promise<{ ok: boolean; error?: string; reportId?: number; dueAt?: string }> {
  if (me.banned) return { ok: false, error: BANNED_MSG };
  if (isMuted(me)) return { ok: false, error: MUTED_MSG };
  if (me.cityKey !== args.city) return { ok: false, error: "只能举报你所在城市的房东 / 公司" };
  if (args.kind === "landlord" && args.targetId !== `home:${args.city}`) return { ok: false, error: "举报对象不对" };
  if (args.kind === "employer" && !COMPANY_IDS.has(args.targetId)) return { ok: false, error: "举报对象不对" };
  const body = cleanText(args.body).slice(0, 600);
  if (body.trim().length < 10) return { ok: false, error: "写多一点再举报：至少 10 个字，说清楚发生了什么。" };
  const standing = await getStanding(db, me.id);
  if (standing.lockedUntil && standing.lockedUntil.getTime() > Date.now()) return { ok: false, error: "你最近的举报被陪审团驳回太多次了，先冷静几天，等信誉恢复再举报。" };
  if (standing.credibility < 50) return { ok: false, error: "信誉太低了，暂时不能举报——等一周恢复，或者有一份举报被判属实就能恢复。" };
  const open = await db.select({ n: sql<number>`count(*)` }).from(schema.blackReports).where(and(eq(schema.blackReports.reporterId, me.id), eq(schema.blackReports.status, "open")));
  if (Number(open[0]?.n ?? 0) >= 3) return { ok: false, error: "你已经有 3 份举报在等陪审团了，等它们判完再报新的。" };
  const recent = await db.select().from(schema.blackReports).where(and(eq(schema.blackReports.reporterId, me.id), eq(schema.blackReports.kind, args.kind), gte(schema.blackReports.createdAt, new Date(Date.now() - 24 * 3600_000)))).limit(1);
  if (recent.length) return { ok: false, error: "今天已经报过一次了，明天再报——陪审团也需要时间。" };
  const now = new Date();
  const dueAt = new Date(now.getTime() + 24 * 3600_000);
  const [row] = await db.insert(schema.blackReports).values({
    city: args.city, kind: args.kind, reporterId: me.id,
    targetId: args.targetId, targetName: cleanText(args.targetName).slice(0, 40) || args.targetId,
    body, evidence: args.evidence !== undefined ? JSON.stringify(args.evidence).slice(0, 4000) : null,
    status: "open", dueAt, reporterClaimed: 0, createdAt: now,
  }).returning({ id: schema.blackReports.id });
  await db.update(schema.reporterStanding).set({ filedCount: standing.filedCount + 1, updatedAt: now }).where(eq(schema.reporterStanding.playerId, me.id));
  return { ok: true, reportId: row?.id, dueAt: dueAt.toISOString() };
}

/* ---- (e) economy: server copies of the client catalogs (economy.ts) ---- */
const OVERSEAS_CATALOG = [
  { id: "ov-jp-skincare", name: "日本药妆套装", emoji: "🧴", origin: "jp", category: "beauty", price: 320, shipDaysMin: 4, shipDaysMax: 7, dutyRate: 0, resellable: true, resaleRate: 0.9, blurb: "代购圈常年断货款，自己用也好，转手也好。" },
  { id: "ov-kr-mask", name: "韩国面膜 10 片装", emoji: "🎭", origin: "kr", category: "beauty", price: 120, shipDaysMin: 3, shipDaysMax: 5, dutyRate: 0, resellable: true, resaleRate: 0.85, blurb: "便宜量大，囤着慢慢敷。" },
  { id: "ov-jp-camera", name: "日本二手胶片机", emoji: "📷", origin: "jp", category: "electronics", price: 1500, shipDaysMin: 5, shipDaysMax: 9, dutyRate: 0.13, resellable: true, resaleRate: 1, blurb: "中古店淘的成色不错，玩胶片的人都懂。" },
  { id: "ov-hk-sneakers", name: "香港限定球鞋", emoji: "👟", origin: "hk", category: "fashion", price: 980, shipDaysMin: 2, shipDaysMax: 4, dutyRate: 0.1, resellable: true, resaleRate: 1.15, blurb: "过关自己背回来都行，限定款转手常能加价。" },
  { id: "ov-us-headphones", name: "美国降噪耳机", emoji: "🎧", origin: "us", category: "electronics", price: 1890, shipDaysMin: 6, shipDaysMax: 10, dutyRate: 0.13, resellable: true, resaleRate: 0.9, blurb: "海淘比专柜便宜几百，坐地铁全靠它。" },
  { id: "ov-eu-chocolate", name: "比利时巧克力礼盒", emoji: "🍫", origin: "eu", category: "food", price: 210, shipDaysMin: 5, shipDaysMax: 8, dutyRate: 0, resellable: false, resaleRate: 0, blurb: "送礼体面，自己吃更体面。食品不能转手。" },
  { id: "ov-jp-figure", name: "日本限定手办", emoji: "🧸", origin: "jp", category: "toy", price: 650, shipDaysMin: 4, shipDaysMax: 8, dutyRate: 0, resellable: true, resaleRate: 1.1, blurb: "抽不到的限定款，海淘是最后的办法。" },
  { id: "ov-kr-lamp", name: "韩国设计师小夜灯", emoji: "💡", origin: "kr", category: "home", price: 180, shipDaysMin: 3, shipDaysMax: 6, dutyRate: 0, resellable: true, resaleRate: 0.8, blurb: "租房也要有点光。摆家里心情 +。" },
] as const;
const overseasItemShape = z.object({
  id: z.string(), name: z.string(), emoji: z.string(), origin: z.string(), category: z.string(),
  price: z.number(), shipDaysMin: z.number(), shipDaysMax: z.number(), dutyRate: z.number(),
  resellable: z.boolean(), resaleRate: z.number(), blurb: z.string(),
});
const overseasOrderShape = z.object({
  id: z.string(), buyer: z.object({ playerId: z.string(), name: z.string() }), item: overseasItemShape,
  qty: z.number(), paidTotal: z.number(), dutyDue: z.number(), dutyPaid: z.number(),
  shipDays: z.number(), orderedDay: z.number(), etaDay: z.number(),
  status: z.enum(["ordered", "shipped", "customs", "arrived", "held"]), heldOnce: z.boolean(),
});
function overseasOrderView(r: typeof schema.overseasOrders.$inferSelect, buyerName: string) {
  let item: z.infer<typeof overseasItemShape>;
  try { item = JSON.parse(r.itemJson) as z.infer<typeof overseasItemShape>; } catch { item = OVERSEAS_CATALOG[0] as unknown as z.infer<typeof overseasItemShape>; }
  return {
    id: String(r.id), buyer: { playerId: r.buyerId, name: buyerName }, item, qty: r.qty,
    paidTotal: r.paidTotal, dutyDue: r.dutyDue, dutyPaid: r.dutyPaid,
    shipDays: r.shipDays, orderedDay: r.orderedDay, etaDay: r.etaDay,
    status: r.status as "ordered" | "shipped" | "customs" | "arrived" | "held", heldOnce: !!r.heldOnce,
  };
}
/** Lazy advance of overseas orders on read (there is no server day-advance
    path; the client also ticks locally — the server is source of truth). */
async function advanceOverseasOrders(db: Db, buyerId: string, gameDay: number) {
  const rows = await db.select().from(schema.overseasOrders).where(eq(schema.overseasOrders.buyerId, buyerId));
  for (const o of rows) {
    if (o.status === "arrived") continue;
    if (o.status === "held") continue; // waits for the player to pay duty
    if (gameDay < o.etaDay) {
      if (o.status === "ordered") await db.update(schema.overseasOrders).set({ status: "shipped" }).where(eq(schema.overseasOrders.id, o.id));
      continue;
    }
    if (!o.heldOnce && o.dutyDue > 0 && Math.random() < 0.15) {
      await db.update(schema.overseasOrders).set({ heldOnce: 1, status: "held", etaDay: o.etaDay + 2 }).where(eq(schema.overseasOrders.id, o.id));
      continue;
    }
    if (o.dutyDue > o.dutyPaid) {
      await db.update(schema.overseasOrders).set({ status: "customs" }).where(eq(schema.overseasOrders.id, o.id));
      continue;
    }
    await db.update(schema.overseasOrders).set({ status: "arrived" }).where(eq(schema.overseasOrders.id, o.id));
  }
}
/* Daily flea stock, server mirror of dailyCheapStock / dailyUsedFurnitureStock
   in economy.ts — same seeds, same pools, so buy endpoints can verify the
   price instead of trusting the client. Stock ids are deterministic
   (`cheap-<day>-<i>` / `usedfurn-<day>-<i>`) and the client adopts them. */
const CHEAP_POOL = [
  { name: "旧手机（屏幕裂）", emoji: "📱", kind: "phone", state: "broken", condition: 45, buyPrice: 120, askPrice: 300, note: "屏幕裂了，其他都好使，能开机。" },
  { name: "旧电饭煲", emoji: "🍚", kind: "appliance", state: "dirty", condition: 60, buyPrice: 35, askPrice: 80, note: "内胆有点黄，煮饭没问题。" },
  { name: "牛仔外套", emoji: "🧥", kind: "clothes", state: "dirty", condition: 70, buyPrice: 25, askPrice: 60, note: "洗洗就跟新的一样。" },
  { name: "旧自行车", emoji: "🚲", kind: "bike", state: "broken", condition: 50, buyPrice: 80, askPrice: 200, note: "链条掉了，刹车还行。" },
  { name: "漫画合集", emoji: "📚", kind: "book", state: "plain", condition: 80, buyPrice: 40, askPrice: 70, note: "全套，书脊有点旧。" },
  { name: "小霸王游戏机", emoji: "🕹️", kind: "toy", state: "broken", condition: 40, buyPrice: 60, askPrice: 150, note: "插卡没反应，可能是接触不良。" },
  { name: "旧木椅", emoji: "🪑", kind: "furniture-piece", state: "dirty", condition: 65, buyPrice: 30, askPrice: 65, note: "实木的，擦擦能上油。" },
  { name: "旧风扇", emoji: "🌀", kind: "appliance", state: "plain", condition: 75, buyPrice: 45, askPrice: 90, note: "三档都转，就是有点响。" },
] as const;
function dailyCheapStockServer(day: number) {
  const seed = (day * 2654435761) % 1000;
  const count = 4 + (seed % 3);
  const out = [];
  for (let i = 0; i < count; i++) {
    const p = CHEAP_POOL[(seed + i * 97) % CHEAP_POOL.length]!;
    out.push({ id: `cheap-${day}-${i}`, ...p, boughtDay: day, fixSpent: 0 });
  }
  return out;
}
const USED_FURN_POOL = [
  { baseId: "sofa-fabric", name: "布艺三人沙发（二手）", emoji: "🛋️", room: "living", condition: 70, price: 900, newPrice: 4800, note: "房东换房急出，布面洗过，没塌。" },
  { baseId: "sofa-fabric", name: "布艺沙发（有点旧）", emoji: "🛋️", room: "living", condition: 45, price: 480, newPrice: 4800, note: "扶手磨白了，坐着还行，适合过渡。" },
  { baseId: "kitchen-cabinet", name: "旧橱柜一套", emoji: "🍳", room: "kitchen", condition: 60, price: 1500, newPrice: 8900, note: "拆下来就能装，台面有刀痕。" },
  { baseId: null, name: "实木旧书桌", emoji: "🪵", room: "living", condition: 75, price: 220, newPrice: 1200, note: "全实木，沉得很，抽屉顺滑。" },
  { baseId: null, name: "老式木衣柜", emoji: "🚪", room: "living", condition: 55, price: 300, newPrice: 1800, note: "有点味，通通风就好，板子结实。" },
  { baseId: null, name: "二手小冰箱", emoji: "🧊", room: "kitchen", condition: 65, price: 350, newPrice: 1600, note: "制冷正常，声音略大，学生党最爱。" },
  { baseId: null, name: "旧唱片机", emoji: "📻", room: "living", condition: 50, price: 180, newPrice: 900, note: "能转，喇叭有点沙，怀旧摆件也值。" },
  { baseId: null, name: "折叠小饭桌", emoji: "🍜", room: "living", condition: 80, price: 90, newPrice: 400, note: "出租屋神器，不用就折起来。" },
] as const;
function dailyUsedFurnitureStockServer(day: number) {
  const seed = (day * 40503) % 997;
  const count = 4 + (seed % 3);
  return USED_FURN_POOL.slice(0, count).map((p, i) => ({
    id: `usedfurn-${day}-${i}`, ...p,
    seller: { playerId: "npc-flea", name: "桥东摊主阿伯" }, listedDay: day,
  }));
}
const cheapGoodShape = z.object({
  id: z.string(), name: z.string(), emoji: z.string(), kind: z.string(), state: z.string(),
  condition: z.number(), buyPrice: z.number(), askPrice: z.number(), boughtDay: z.number(), fixSpent: z.number(), note: z.string(),
});
const usedFurnitureShape = z.object({
  id: z.string(), baseId: z.string().nullable(), name: z.string(), emoji: z.string(), room: z.string(),
  condition: z.number(), price: z.number(), newPrice: z.number(),
  seller: z.object({ playerId: z.string(), name: z.string() }), note: z.string(), listedDay: z.number(),
});
/* ---- round-3 (S): trade-dispute jury (e) ----
   disputeTradeTask only freezes the escrow; this settles it. Mirror of
   settleBlackReports: 24 h jury, quorum 3, majority wins, tie / too few
   votes = expired. One deliberate difference, forced by money: an expired
   trade case cannot leave the escrow frozen forever, so the money is
   refunded to whoever paid it (the buyer side). Seller wins → escrow
   released to the seller side (same rule as completeTradeTask: sell-task
   → poster, otherwise accepter). Settled tasks go back to completed /
   cancelled, so the client never sees a new status string; the verdict
   rides along in disputeVerdict. A task disputed after completion keeps
   status completed (its escrow was already released) — the verdict is
   recorded only. Called from the trade read endpoints, the vote endpoint
   and adjudicateTradeDispute, like settleBlackReports / settleGigs. */
const TRADE_JURY_MS = 24 * 3600_000;
const TRADE_JURY_QUORUM = 3;
type TradeVerdict = "seller" | "buyer" | "expired";
async function tradeDisputeTallies(db: Db, taskId: number) {
  const vs = await db.select().from(schema.tradeDisputeVotes).where(eq(schema.tradeDisputeVotes.taskId, taskId));
  return {
    seller: vs.filter((v: { side: string }) => v.side === "seller").length,
    buyer: vs.filter((v: { side: string }) => v.side === "buyer").length,
  };
}
async function settleTradeDisputes(db: Db) {
  const now = new Date();
  const due = await db.select().from(schema.tradeTasks).where(eq(schema.tradeTasks.status, "disputed"));
  for (const t of due) {
    const base = t.disputedAt ?? t.createdAt;
    if (base.getTime() + TRADE_JURY_MS > now.getTime()) continue;
    const { seller, buyer } = await tradeDisputeTallies(db, t.id);
    const total = seller + buyer;
    const verdict: TradeVerdict = total < TRADE_JURY_QUORUM ? "expired" : seller > buyer ? "seller" : buyer > seller ? "buyer" : "expired";
    const amount = t.escrowHeld;
    const releaseToId = t.kind === "sell" ? t.posterId : (t.accepterId ?? t.posterId);
    // A task disputed after completion stays completed: the trade already
    // happened and its escrow was already released — the verdict is a record.
    const status = t.disputeFromStatus === "completed" || verdict === "seller" ? "completed" : "cancelled";
    // compare-and-set: only the first settler moves the money
    const changed = await db.update(schema.tradeTasks).set({ status, escrowHeld: 0, disputeVerdict: verdict, disputeSettledAt: now })
      .where(and(eq(schema.tradeTasks.id, t.id), eq(schema.tradeTasks.status, "disputed"))).returning({ id: schema.tradeTasks.id });
    if (!changed.length) continue; // another request settled it first
    if (amount > 0) {
      const [esc] = await db.select().from(schema.tradeEscrow).where(and(eq(schema.tradeEscrow.taskId, t.id), eq(schema.tradeEscrow.kind, "trade"), sql`(${schema.tradeEscrow.status} = 'frozen' OR ${schema.tradeEscrow.status} = 'held')`)).limit(1);
      if (esc) {
        await db.update(schema.tradeEscrow).set({ status: verdict === "seller" ? "released" : "refunded", releasedAt: now }).where(eq(schema.tradeEscrow.id, esc.id));
      }
      // The money moves even if the escrow row is missing (shouldn't happen):
      // a settled verdict must never swallow the frozen amount.
      const toId = verdict === "seller" ? releaseToId : (esc?.payerId ?? t.escrowFromId ?? t.posterId);
      await creditMoney(db, toId, amount, verdict === "seller" ? `trade jury release #${t.id}` : `trade jury refund #${t.id}`);
    }
  }
}
const tradeTaskShape = z.object({
  id: z.string(), poster: z.object({ playerId: z.string(), name: z.string() }),
  kind: z.enum(["buy", "sell", "swap", "service", "other"]), title: z.string(), body: z.string(),
  price: z.number().nullable(), negotiable: z.boolean(), tags: z.array(z.string()),
  city: z.enum(["sz", "hz", "hk", "any"]), status: z.enum(["open", "accepted", "completed", "cancelled", "disputed"]),
  accepter: z.object({ playerId: z.string(), name: z.string() }).optional(),
  escrowHeld: z.number(), escrowFrom: z.object({ playerId: z.string(), name: z.string() }).optional(),
  createdDay: z.number(), expiresDay: z.number(), completionNote: z.string().optional(),
  disputeReason: z.string().optional(), disputeVerdict: z.enum(["seller", "buyer", "expired"]).optional(),
  disputeDueAt: z.string().optional(),
});
function tradeTaskView(r: typeof schema.tradeTasks.$inferSelect) {
  let tags: string[] = [];
  try { const v = JSON.parse(r.tags) as unknown; if (Array.isArray(v)) tags = v.filter((t): t is string => typeof t === "string"); } catch { tags = []; }
  return {
    id: String(r.id), poster: { playerId: r.posterId, name: r.posterName },
    kind: r.kind as "buy" | "sell" | "swap" | "service" | "other", title: r.title, body: r.body,
    price: r.price, negotiable: !!r.negotiable, tags,
    city: r.city as "sz" | "hz" | "hk" | "any",
    status: r.status as "open" | "accepted" | "completed" | "cancelled" | "disputed",
    ...(r.accepterId ? { accepter: { playerId: r.accepterId, name: r.accepterName ?? "" } } : {}),
    escrowHeld: r.escrowHeld,
    ...(r.escrowFromId ? { escrowFrom: { playerId: r.escrowFromId, name: r.escrowFromName ?? "" } } : {}),
    createdDay: r.createdDay, expiresDay: r.expiresDay,
    ...(r.completionNote ? { completionNote: r.completionNote } : {}),
    ...(r.disputeReason ? { disputeReason: r.disputeReason } : {}),
    ...(r.disputeVerdict ? { disputeVerdict: r.disputeVerdict as "seller" | "buyer" | "expired" } : {}),
    ...(r.disputedAt ? { disputeDueAt: new Date(r.disputedAt.getTime() + TRADE_JURY_MS).toISOString() } : {}),
  };
}
const subletShape = z.object({
  id: z.string(), owner: z.object({ playerId: z.string(), name: z.string() }),
  homeLocId: z.string(), city: z.enum(["sz", "hz", "hk"]), space: z.enum(["room", "bed", "sofa", "whole"]),
  monthlyPrice: z.number(), deposit: z.number(), terms: z.string(), minDays: z.number(), maxDays: z.number(),
  availableFromDay: z.number(), status: z.enum(["open", "taken", "closed"]),
  tenant: z.object({ playerId: z.string(), name: z.string() }).optional(),
  tenancyStartDay: z.number(), rentCollected: z.number(), createdDay: z.number(),
  suspicion: z.number(), late: z.boolean(),
});
function subletView(r: typeof schema.subletListings.$inferSelect) {
  return {
    id: String(r.id), owner: { playerId: r.ownerId, name: r.ownerName },
    homeLocId: r.homeLocId, city: r.city as "sz" | "hz" | "hk",
    space: r.space as "room" | "bed" | "sofa" | "whole",
    monthlyPrice: r.monthlyPrice, deposit: r.deposit, terms: r.terms,
    minDays: r.minDays, maxDays: r.maxDays, availableFromDay: r.availableFromDay,
    status: r.status as "open" | "taken" | "closed",
    ...(r.tenantId ? { tenant: { playerId: r.tenantId, name: r.tenantName ?? "" } } : {}),
    tenancyStartDay: r.tenancyStartDay, rentCollected: r.rentCollected, createdDay: r.createdDay,
    suspicion: r.suspicion, late: !!r.rentLate,
  };
}

/* ---- (f) lifestyles: server copies of the client ladder / courses / shifts ---- */
const sanhePayServer = (city: string) => (city === "hk" ? 200 : city === "hz" ? 160 : 220);
const SANHE_SHIFTS_SERVER: Record<string, number> = { warehouse: 1, construction: 1.45, moving: 1.2, flyer: 0.6, harbor: 1.1, market: 0.9 };
const COURSES_SERVER: Record<string, { days: number; allowanceDay: number; skillGain: number }> = {
  harbor: { days: 4, allowanceDay: 30, skillGain: 2 },
  cooking: { days: 3, allowanceDay: 30, skillGain: 2 },
  forklift: { days: 5, allowanceDay: 30, skillGain: 2 },
  office: { days: 6, allowanceDay: 30, skillGain: 3 },
  ecommerce: { days: 6, allowanceDay: 30, skillGain: 3 },
  housekeeping: { days: 3, allowanceDay: 30, skillGain: 2 },
};
const JOB_LADDER_SERVER = [
  { id: "daily-warehouse", rung: "daily", emoji: "📦", title: ["仓库日结", "Warehouse day pay"], desc: ["分拣打包，干完结钱。", "Sort and pack; paid when the shift ends."], payDay: 220, cityMul: { hz: 0.73, hk: 0.91 }, requires: {}, path: ["不要经验，当天结钱。干几天，手熟了就能往短工走。", "No experience needed, paid today. A few days of this and short-term work opens up."], tags: ["logistics"] },
  { id: "daily-construction", rung: "daily", emoji: "👷", title: ["工地日结", "Construction day pay"], desc: ["搬砖绑钢筋，日结里给得最高的。", "Hauling and rebar — the best day pay there is."], payDay: 320, cityMul: { hz: 0.73, hk: 0.91 }, requires: {}, path: ["不要经验，当天结钱。身体累，攒钱快。", "No experience needed, paid today. Hard on the body, fast to save."], tags: ["construction"] },
  { id: "daily-harbor", rung: "daily", emoji: "⚓", title: ["渔港日结", "Harbor day pay"], desc: ["卸货分鱼，早上开工中午结钱。", "Unload and sort the catch; start at dawn, paid by noon."], payDay: 240, cityMul: { hz: 0.73, hk: 0.91 }, requires: {}, path: ["不要经验。钓过鱼的优先——懂鱼的人上手快。", "No experience needed. People who've fished get picked first — they already know fish."], tags: ["fish", "harbor"] },
  { id: "short-waiter", rung: "short", emoji: "🍜", title: ["餐厅短期帮工", "Restaurant short-term helper"], desc: ["午市晚市帮工，管饭。干满 7 天表现好就转正。", "Lunch and dinner shifts, meals included. Do well for 7 days and it turns permanent."], payDay: 200, cityMul: { hz: 0.8, hk: 1.3 }, identityId: "waiter", requires: {}, daysToPermanent: 7, path: ["不要经验，管饭。7 天试工，表现好转正当服务员。", "No experience, meals included. 7-day trial — do well and become a waiter."], tags: ["food"] },
  { id: "short-courier", rung: "short", emoji: "📦", title: ["快递分拣短工", "Courier sorting short-term"], desc: ["按件算，多劳多得。干满 10 天可转正当快递员。", "Paid per parcel — the more you sort, the more you earn. 10 days to convert to courier."], payDay: 260, cityMul: { hz: 0.8, hk: 1.2 }, identityId: "courier", requires: {}, daysToPermanent: 10, path: ["不要经验，按件计酬。10 天试工，转正当快递员。", "No experience, paid per parcel. 10-day trial, then convert to courier."], tags: ["logistics"] },
  { id: "short-guard", rung: "short", emoji: "💂", title: ["保安替班", "Security cover shifts"], desc: ["替人顶班，站岗巡逻。干满 14 天可转正。", "Cover shifts — gate duty and patrols. 14 days to convert."], payDay: 210, cityMul: { hz: 0.8, hk: 1.25 }, identityId: "guard", requires: {}, daysToPermanent: 14, path: ["不要经验。14 天替班，表现稳就转正当保安。", "No experience. 14 days of cover shifts, then convert to security guard."], tags: ["security"] },
  { id: "short-harbor", rung: "short", emoji: "⚓", title: ["渔港短期工", "Harbor short-term hand"], desc: ["跟船卸货、理货。钓过鱼或上过渔港培训的优先。", "Unload with the boats, sort the catch. Fishers and harbor-course graduates go first."], payDay: 260, cityMul: { hz: 0.8, hk: 1.1 }, requires: { gigs: ["fish_sea", "fish_lake"] }, daysToPermanent: 10, path: ["要钓过鱼，或上过渔港帮工培训。10 天试工，转正上岸。", "Needs fishing experience or the harbor course. 10-day trial, then a steady harbor job."], tags: ["fish", "harbor"] },
  { id: "short-cleaner", rung: "short", emoji: "🧹", title: ["商场保洁短工", "Mall cleaning short-term"], desc: ["早班保洁，干满 10 天可转正。", "Early cleaning shifts. 10 days to convert."], payDay: 180, cityMul: { hz: 0.8, hk: 1.3 }, identityId: "cleaner", requires: {}, daysToPermanent: 10, path: ["不要经验。10 天试工，转正当保洁。", "No experience. 10-day trial, then convert to cleaner."], tags: ["cleaning"] },
  { id: "stable-factory", rung: "stable", emoji: "🔩", title: ["工厂普工", "Factory worker"], desc: ["流水线普工，包吃住，加班多攒钱快。", "Assembly line, meals and bed included. Overtime pays; savings grow fast."], payDay: 230, cityMul: { hz: 0.85, hk: 1.2 }, identityId: "factory", requires: { skill: 1 }, path: ["要技能 1 点（上个短期培训就有）。包吃住，月薪稳定。", "Needs skill 1 (one short course gets you there). Meals and bed included, steady monthly pay."], tags: ["factory"] },
  { id: "stable-courier", rung: "stable", emoji: "🛵", title: ["快递员", "Courier"], desc: ["派件越多挣越多，片区跑熟了就是自己的地盘。", "More parcels, more pay. Learn your patch and it becomes yours."], payDay: 290, cityMul: { hz: 0.85, hk: 1.2 }, identityId: "courier", requires: { interviewReady: 40 }, path: ["要模拟面试练到 40 分。跑单计酬，越熟挣得越多。", "Needs mock-interview readiness 40. Paid per delivery — the better you know the streets, the more you earn."], tags: ["logistics"] },
  { id: "stable-waiter", rung: "stable", emoji: "🍜", title: ["餐厅服务员", "Restaurant server"], desc: ["午市晚市两场，员工餐管饱。", "Lunch and dinner rushes; staff meals included."], payDay: 200, cityMul: { hz: 0.85, hk: 1.35 }, identityId: "waiter", requires: { interviewReady: 30 }, path: ["要模拟面试练到 30 分。熟手了能往领班走。", "Needs mock-interview readiness 30. Do it well and you can work up to shift lead."], tags: ["food"] },
  { id: "stable-chef-assist", rung: "stable", emoji: "👨‍🍳", title: ["厨师助理", "Kitchen assistant"], desc: ["后厨帮手，切配打荷。会做饭的上手最快。", "Kitchen hand — prep and plating. People who cook pick it up fastest."], payDay: 300, cityMul: { hz: 0.85, hk: 1.3 }, identityId: "chef", requires: { course: "cooking" }, path: ["要上过「家常菜速成」培训。会做饭的人，后厨抢着要。", "Needs the \"home cooking crash course\". Kitchens fight over people who can cook."], tags: ["food", "cooking"] },
  { id: "stable-guard", rung: "stable", emoji: "💂", title: ["保安", "Security guard"], desc: ["站岗巡逻，整栋楼的人你都认识。", "Gate duty and patrols — you'll know everyone in the building."], payDay: 210, cityMul: { hz: 0.85, hk: 1.25 }, identityId: "guard", requires: { interviewReady: 30 }, path: ["要模拟面试练到 30 分。稳定、包吃住、认识一栋楼的人。", "Needs mock-interview readiness 30. Steady, meals and bed included — and you'll know the whole building."], tags: ["security"] },
  { id: "stable-harbor", rung: "stable", emoji: "⚓", title: ["渔港正式工", "Harbor permanent hand"], desc: ["跟船理货、验鱼，考证之后就是正式工。", "Sort and grade the catch with the boats — certified, and it's a permanent post."], payDay: 280, cityMul: { hz: 0.85, hk: 1.1 }, identityId: "worker", requires: { course: "harbor" }, path: ["要上过「渔港帮工考证」培训。钓过鱼 → 帮工 → 考证 → 稳定岗。", "Needs the \"harbor certification\" course. Fished before → harbor hand → certificate → steady job."], tags: ["fish", "harbor"] },
] as const;
const jobListingShape = z.object({
  id: z.string(), rung: z.enum(["daily", "short", "stable"]), emoji: z.string(),
  title: z.tuple([z.string(), z.string()]), desc: z.tuple([z.string(), z.string()]),
  payDay: z.number(), cityMul: z.record(z.string(), z.number()).optional(), identityId: z.string().optional(),
  requires: z.record(z.string(), z.any()), daysToPermanent: z.number().optional(),
  path: z.tuple([z.string(), z.string()]), tags: z.array(z.string()),
});
const listingPayServer = (l: (typeof JOB_LADDER_SERVER)[number], city: string) =>
  Math.round(l.payDay * ((l.cityMul as Record<string, number> | undefined)?.[city] ?? 1));
const COUNSELOR_ROUTES_SERVER = [
  { id: "route-fish", emoji: "🎣", title: ["从钓鱼到渔港正式工", "From fishing to a harbor job"], basedOn: ["你钓过鱼，懂鱼。", "You've fished before — you know fish."], steps: [["去渔港打几天日结，熟悉卸货分鱼", "Take harbor day shifts for a few days — learn unloading and sorting"], ["上「渔港帮工考证」培训（4 天，有补贴）", "Take the harbor certification course (4 days, with allowance)"], ["应聘渔港短期工，10 天试工转正", "Apply for the harbor short-term post — 10-day trial, then permanent"]] },
  { id: "route-cook", emoji: "🍳", title: ["从做饭到后厨", "From cooking to the kitchen"], basedOn: ["你会做饭，这是手艺。", "You can cook — that's a trade."], steps: [["上「家常菜速成」培训（3 天，有补贴）", "Take the home-cooking crash course (3 days, with allowance)"], ["应聘餐厅短期帮工，管饭", "Apply for restaurant short-term work — meals included"], ["7 天试工转正，再往厨师助理走", "7-day trial to permanent, then work up to kitchen assistant"]] },
  { id: "route-logistics", emoji: "📦", title: ["从搬货到快递员", "From hauling to courier"], basedOn: ["你搬过货、跑过腿，认路快。", "You've hauled and run errands — you learn streets fast."], steps: [["去快递站打几天分拣短工，按件计酬", "Take courier sorting short-term shifts — paid per parcel"], ["练两次模拟面试，练到 40 分", "Do two mock interviews, get readiness to 40"], ["应聘快递员，跑熟片区就是自己的地盘", "Apply for courier — learn your patch and it becomes yours"]] },
  { id: "route-general", emoji: "🧭", title: ["先稳住，再慢慢走", "Steady first, then step by step"], basedOn: ["不着急，先找个落脚的活儿。", "No rush — find a foothold first."], steps: [["打几天日结，手里有现金，心里不慌", "Take day shifts for a few days — cash in hand steadies the nerves"], ["挑一个 3–6 天的短期培训，学个傍身的技能", "Pick a 3–6 day short course and learn a skill to lean on"], ["投一个短工，试工转正；转正了再想下一步", "Apply for a short-term post, convert from the trial — then think about what's next"]] },
] as const;
const counselorRouteShape = z.object({
  id: z.string(), emoji: z.string(), title: z.tuple([z.string(), z.string()]), basedOn: z.tuple([z.string(), z.string()]),
  steps: z.array(z.tuple([z.string(), z.string()])),
});
const STALL_KINDS_SERVER = ["烤串 / 小吃", "二手杂货", "花 / 手作", "手机配件"] as const;
/** Load the stored LifestyleState JSON (null on first run). */
async function loadLife(db: Db, playerId: string): Promise<{ flat: Record<string, unknown>; sanhe: Record<string, unknown> } | null> {
  const [row] = await db.select().from(schema.lifestyleStates).where(eq(schema.lifestyleStates.playerId, playerId)).limit(1);
  if (!row) return null;
  try {
    const v = JSON.parse(row.payload) as { flat?: Record<string, unknown>; sanhe?: Record<string, unknown> };
    if (!v || typeof v !== "object" || !v.flat || !v.sanhe) return null;
    return { flat: v.flat, sanhe: v.sanhe };
  } catch { return null; }
}
async function saveLife(db: Db, playerId: string, life: unknown) {
  const payload = JSON.stringify(life);
  await db.insert(schema.lifestyleStates).values({ playerId, payload, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.lifestyleStates.playerId, set: { payload, updatedAt: new Date() } });
}

/* ---- (h) delivery pool: expire overdue open orders, refunding escrow ---- */
async function expirePoolOrders(db: Db, city: string) {
  const now = Date.now();
  const due = await db.select().from(schema.deliveryPoolOrders).where(and(eq(schema.deliveryPoolOrders.city, city), eq(schema.deliveryPoolOrders.status, "open"), sql`${schema.deliveryPoolOrders.deadlineAt} <= ${now}`));
  for (const o of due) {
    const changed = await db.update(schema.deliveryPoolOrders).set({ status: "expired" }).where(and(eq(schema.deliveryPoolOrders.id, o.id), eq(schema.deliveryPoolOrders.status, "open"))).returning({ id: schema.deliveryPoolOrders.id });
    if (!changed.length) continue;
    await db.update(schema.tradeEscrow).set({ status: "refunded", releasedAt: new Date() }).where(and(eq(schema.tradeEscrow.taskId, o.id), eq(schema.tradeEscrow.kind, "delivery"), eq(schema.tradeEscrow.status, "held")));
    await creditMoney(db, o.customerId, o.riderFee, `delivery pool #${o.id} expired refund`);
  }
}

/* ---- round-3 (E): Lagos gaps — group orders, weekly quests, Livehouse tips ----
   Server mirror of the client defs in client/src/round2/delivery.ts
   (WEEKLY_QUESTS / WEEKLY_REWARD_COUPONS). Rewards are existing money/coupons
   only: ¥ via creditMoney (ledger), coupons are client-side state the server
   names by id and the client grants on claim. */
const WEEKLY_QUEST_DEFS = [
  { id: "order-3", target: 3, reward: { kind: "coupon", couponId: "weekly-free-delivery", label: "免配送费券 ×1" } },
  { id: "try-new", target: 1, reward: { kind: "money", amount: 15, label: "¥15" } },
  { id: "rate-5", target: 1, reward: { kind: "coupon", couponId: "weekly-off-8", label: "立减 ¥8 券 ×1" } },
  { id: "spend-100", target: 100, reward: { kind: "money", amount: 20, label: "¥20" } },
] as const;
/** ISO week (Mon-based) in Beijing time, e.g. "2026-W46". */
function weekKeyOf(d = new Date()): string {
  const bj = new Date(d.getTime() + 8 * 3600_000); // shift to Beijing wall clock, read as UTC
  const day = bj.getUTCDay() || 7;
  const thu = new Date(Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate() + (4 - day)));
  const year = thu.getUTCFullYear();
  const week = Math.floor((thu.getTime() - Date.UTC(year, 0, 4)) / 604_800_000) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}
async function ensureWeeklyQuestRows(db: Db, playerId: string, weekKey: string) {
  const d = db as any;
  for (const q of WEEKLY_QUEST_DEFS) {
    await d.insert(schema.deliveryQuests).values({ playerId, weekKey, questId: q.id, progress: 0, claimed: 0, meta: "{}", updatedAt: new Date() }).onConflictDoNothing();
  }
}
const GROUP_ORDER_MAX_MEMBERS = 6;
const GROUP_ORDER_TTL_MS = 30 * 60_000; // 30 min to gather the group, then it auto-cancels
const GROUP_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — read out loud safely
function randomGroupCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += GROUP_CODE_CHARS[Math.floor(Math.random() * GROUP_CODE_CHARS.length)];
  return code;
}
const GROUP_ORDER_ITEM_Z = z.object({ key: z.string().min(1).max(80), name: z.string().min(1).max(40), qty: z.number().int().min(1).max(99), cost: z.number().int().min(0).max(100000) });
/** escrowStatus per member (shown in the client as 未托管 / 已托管 / 已结算 / 已退回):
    none = nothing escrowed yet (group still open), held = locked at lockGroupOrder,
    released = settled at completeGroupOrder, refunded = cancelled / expired. */
const GROUP_ORDER_ESCROW_STATUS_Z = z.enum(["none", "held", "released", "refunded"]);
const GROUP_ORDER_VIEW = z.object({
  id: z.number(), code: z.string(), city: z.string(), hostId: z.string(), hostName: z.string(),
  restaurantId: z.string(), restaurantName: z.string(), status: z.string(),
  createdAt: z.string(), expiresAt: z.string(), poolId: z.string().nullable(),
  members: z.array(z.object({ playerId: z.string(), playerName: z.string(), items: z.array(GROUP_ORDER_ITEM_Z), subtotal: z.number(), joinedAt: z.string(), escrowStatus: GROUP_ORDER_ESCROW_STATUS_Z, escrowTotal: z.number() })),
});
type GroupOrderView = z.infer<typeof GROUP_ORDER_VIEW>;
/** A locked group the host never completes holds everyone's money: it
    expires 2 h after locking (lazy, same pattern as the 30-min open
    expiry below) and the escrow is refunded in full. */
const GROUP_ORDER_LOCKED_TTL_MS = 2 * 3600_000;
/** Server mirror of the client's groupOrderTotals (delivery.ts): the
    delivery fee is split evenly, the remainder goes to the first member
    (the host, who joined first). Fee shares + subtotals are the amounts
    lockGroupOrder escrows per member. */
function groupOrderSplit(members: { playerId: string; subtotal: number }[], deliveryFee: number): { playerId: string; feeShare: number; total: number }[] {
  const n = Math.max(1, members.length);
  const base = Math.floor(deliveryFee / n);
  return members.map((m, i) => {
    const feeShare = base + (i === 0 ? deliveryFee - base * n : 0);
    return { playerId: m.playerId, feeShare, total: m.subtotal + feeShare };
  });
}
async function groupEscrowByPlayer(db: Db, groupId: number): Promise<Map<string, { status: "held" | "released" | "refunded"; foodAmount: number; feeAmount: number; total: number }>> {
  const rows = await db.select().from(schema.groupOrderEscrow).where(eq(schema.groupOrderEscrow.groupId, groupId));
  return new Map(rows.map((r: typeof schema.groupOrderEscrow.$inferSelect) => [r.playerId, { status: r.status as "held" | "released" | "refunded", foodAmount: r.foodAmount, feeAmount: r.feeAmount, total: r.amount }]));
}
/** Refunds every still-held escrow row of a group (cancel / expiry).
    Money moves even if a row is missing for a member — there is nothing
    to refund then, the member was never charged. */
async function refundGroupEscrow(db: Db, groupId: number): Promise<number> {
  const now = new Date();
  const rows = await db.select().from(schema.groupOrderEscrow).where(and(eq(schema.groupOrderEscrow.groupId, groupId), eq(schema.groupOrderEscrow.status, "held")));
  for (const r of rows) {
    const changed = await db.update(schema.groupOrderEscrow).set({ status: "refunded", releasedAt: now })
      .where(and(eq(schema.groupOrderEscrow.groupId, groupId), eq(schema.groupOrderEscrow.playerId, r.playerId), eq(schema.groupOrderEscrow.status, "held"))).returning({ playerId: schema.groupOrderEscrow.playerId });
    if (!changed.length) continue; // another request refunded it first
    if (r.amount > 0) await creditMoney(db, r.playerId, r.amount, `group order #${groupId} refund`);
  }
  return rows.length;
}
/** Settles a completed group's escrow. The restaurant is an NPC (no player
    account), so the food share is released to the merchant as a sink — the
    money simply leaves the game, exactly as a normal client placeOrder
    deducts it. The fee share: with a pool order the host already fronted
    the riderFee through deliveryPoolPublish, so each member's fee share
    reimburses the host (the rider is then paid out of the pool's own
    riderFee escrow by deliveryPoolDelivered, on-time full / late 70% per
    the existing rule); without a pool order the rider is an NPC too and
    the fee is released as a sink, like a local order. */
async function settleGroupEscrow(db: Db, groupId: number, hostId: string, poolId: string | null): Promise<{ food: number; fee: number; feeToHost: number }> {
  const now = new Date();
  const rows = await db.select().from(schema.groupOrderEscrow).where(and(eq(schema.groupOrderEscrow.groupId, groupId), eq(schema.groupOrderEscrow.status, "held")));
  let food = 0, fee = 0, feeToHost = 0;
  for (const r of rows) {
    const changed = await db.update(schema.groupOrderEscrow).set({ status: "released", releasedAt: now })
      .where(and(eq(schema.groupOrderEscrow.groupId, groupId), eq(schema.groupOrderEscrow.playerId, r.playerId), eq(schema.groupOrderEscrow.status, "held"))).returning({ playerId: schema.groupOrderEscrow.playerId });
    if (!changed.length) continue;
    food += r.foodAmount; fee += r.feeAmount;
    if (poolId && r.feeAmount > 0) { await creditMoney(db, hostId, r.feeAmount, `group order #${groupId} rider fee share`); feeToHost += r.feeAmount; }
  }
  return { food, fee, feeToHost };
}
/** Loads a group + its members; an open group past its deadline is cancelled lazily (same pattern as expirePoolOrders), and a locked group
    past its 2 h lock TTL is cancelled the same way. Either way the held
    escrow (if any) is refunded in full before the view is returned. */
async function groupOrderView(db: Db, groupId: number): Promise<GroupOrderView | null> {
  const [g] = await db.select().from(schema.groupOrders).where(eq(schema.groupOrders.id, groupId)).limit(1);
  if (!g) return null;
  if (g.status === "open" && g.expiresAt.getTime() <= Date.now()) {
    await db.update(schema.groupOrders).set({ status: "cancelled" }).where(and(eq(schema.groupOrders.id, g.id), eq(schema.groupOrders.status, "open")));
    g.status = "cancelled";
    await refundGroupEscrow(db, g.id);
  } else if (g.status === "locked" && g.lockedAt && g.lockedAt.getTime() + GROUP_ORDER_LOCKED_TTL_MS <= Date.now()) {
    await db.update(schema.groupOrders).set({ status: "cancelled" }).where(and(eq(schema.groupOrders.id, g.id), eq(schema.groupOrders.status, "locked")));
    g.status = "cancelled";
    await refundGroupEscrow(db, g.id);
  }
  const rows = await db.select().from(schema.groupOrderMembers).where(eq(schema.groupOrderMembers.groupId, g.id)).orderBy(schema.groupOrderMembers.joinedAt);
  const escrow = await groupEscrowByPlayer(db, g.id);
  return {
    id: g.id, code: g.code, city: g.city, hostId: g.hostId, hostName: g.hostName,
    restaurantId: g.restaurantId, restaurantName: g.restaurantName, status: g.status,
    createdAt: g.createdAt.toISOString(), expiresAt: g.expiresAt.toISOString(), poolId: g.poolId ?? null,
    members: rows.map((m: typeof schema.groupOrderMembers.$inferSelect) => {
      let items: { key: string; name: string; qty: number; cost: number }[] = [];
      try { const parsed = JSON.parse(m.itemsJson) as unknown; if (Array.isArray(parsed)) items = parsed.filter((x): x is { key: string; name: string; qty: number; cost: number } => !!x && typeof (x as { key?: unknown }).key === "string" && typeof (x as { name?: unknown }).name === "string" && typeof (x as { qty?: unknown }).qty === "number" && typeof (x as { cost?: unknown }).cost === "number"); } catch { items = []; }
      const e = escrow.get(m.playerId);
      return { playerId: m.playerId, playerName: m.playerName, items, subtotal: m.subtotal, joinedAt: m.joinedAt.toISOString(), escrowStatus: e ? e.status : "none" as const, escrowTotal: e ? e.total : 0 };
    }),
  };
}
/** Is this player already in an open group (host or member)? One open group at a time. */
async function openGroupOf(db: Db, playerId: string): Promise<GroupOrderView | null> {
  const rows = await db.select().from(schema.groupOrders).where(and(eq(schema.groupOrders.status, "open"), sql`${schema.groupOrders.expiresAt} > ${Date.now()}`));
  for (const g of rows) {
    if (g.hostId === playerId) return groupOrderView(db, g.id);
    const [m] = await db.select().from(schema.groupOrderMembers).where(and(eq(schema.groupOrderMembers.groupId, g.id), eq(schema.groupOrderMembers.playerId, playerId))).limit(1);
    if (m) return groupOrderView(db, g.id);
  }
  return null;
}

/* ---- round-3 (S): police patrol / observation (g) ----
   Server side of client/src/round2/police.ts. Same three rules: in-game
   avatar ids only (isGameAvatarId, mirrored from the client), the watched
   player can always see who is watching (getWatchers), and watching alone
   does nothing — consequences need a filed report through (d). Patrols and
   watches are rows, not process memory, so 👁️ is visible across sessions.
   A patrol goes stale after 6 h (lazy expiry on every patrol read/write);
   ending a patrol ends every watch it opened. */
const PATROL_TTL_MS = 6 * 3600_000;
/** Mirror of client police.ts isGameAvatarId: lowercase slugs only — no
    emails, phone numbers, real names or handles from other apps. */
function isGameAvatarId(id: string): boolean {
  if (!id || id.length > 48) return false;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) return false;
  if (/\d{7,}/.test(id)) return false;
  return true;
}
async function expirePatrols(db: Db) {
  const cutoff = Date.now() - PATROL_TTL_MS;
  const stale = await db.select().from(schema.patrols).where(sql`${schema.patrols.startedAt} <= ${cutoff}`);
  for (const p of stale) {
    await db.delete(schema.patrolWatches).where(eq(schema.patrolWatches.officerId, p.officerId));
    await db.delete(schema.patrols).where(eq(schema.patrols.officerId, p.officerId));
  }
}
async function activePatrol(db: Db, officerId: string) {
  await expirePatrols(db);
  const [p] = await db.select().from(schema.patrols).where(eq(schema.patrols.officerId, officerId)).limit(1);
  return p as typeof schema.patrols.$inferSelect | undefined;
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
      /* 0–3 hair, 0–3 accessory. Stored on cosmetic as #h2a1 so name colours stay intact. */
      hair: z.number().int().min(0).max(3).optional(),
      accessory: z.number().int().min(0).max(3).optional(),
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
          ...(args.hair !== undefined ? { cosmetic: `${(prev?.cosmetic ?? "").replace(/#h[0-3](?:a[0-3])?$/, "")}#h${args.hair}a${args.accessory ?? 0}` } : {}),
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
        inbox: inboxRows.map((g) => ({ id: g.id, fromId: pubOf(g.fromId), fromName: g.fromName, kind: g.kind, company: g.company, amount: g.amount ?? 0, createdAt: g.createdAt.toISOString() })),
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
      amount: z.number().int().min(0).max(5000).optional(),
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
      const share = args.kind === "share" ? Math.min(5000, Math.max(0, args.amount ?? 0)) : 0;
      if (args.kind === "share" && share < 1) return { ok: false, error: "分成金额不对" };
      await db.insert(schema.gifts).values({
        fromId: me.id,
        fromName: me.name,
        toId: to.id,
        kind: args.kind,
        company: args.kind === "referral" ? me.employer : null,
        amount: share,
        createdAt: new Date(),
      });
      const label = { tea: "一杯奶茶", breakfast: "一份早餐", hongbao: "一个红包", referral: "一次内推", invite: "一声谢谢：被邀请来深惠过日子", share: `店里的分成 ¥${share}` }[args.kind];
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
      if (g.kind === "share" && g.amount > 0) await creditMoney(db, args.playerId, g.amount, `share from ${g.fromName}`);
      return { ok: true, gift: { id: g.id, fromId: pubOf(g.fromId), fromName: g.fromName, kind: g.kind, company: g.company, amount: g.amount ?? 0, createdAt: g.createdAt.toISOString() } };
    },
  }),

  publishHome: defineAction({
    description: "Publishes the caller's furniture layout so a visitor walks into this home, not a generic room.",
    request: z.object({
      playerId: z.string().min(4).max(64),
      tier: z.number().int().min(0).max(3),
      style: z.string().max(40).nullable(),
      layout: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{1,32}$/), slot: z.number().int().min(0).max(13) })).max(14),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [me] = await db.select().from(schema.players).where(eq(schema.players.id, args.playerId)).limit(1);
      if (!me || me.banned) return { ok: false };
      const layout = JSON.stringify(args.layout);
      await db.insert(schema.homes).values({ playerId: me.id, tier: args.tier, style: args.style, layout, updatedAt: new Date() })
        .onConflictDoUpdate({ target: schema.homes.playerId, set: { tier: args.tier, style: args.style, layout, updatedAt: new Date() } });
      return { ok: true };
    },
  }),

  getHome: defineAction({
    description: "Reads the home a player has published. Empty when they have not placed anything yet.",
    request: z.object({ pub: z.string().min(4).max(64) }),
    response: z.object({
      home: z.object({
        tier: z.number(),
        style: z.string().nullable(),
        layout: z.array(z.object({ id: z.string(), slot: z.number() })),
      }).nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const [who] = await db.select().from(schema.players).where(eq(schema.players.pub, args.pub)).limit(1);
      if (!who) return { home: null };
      const [row] = await db.select().from(schema.homes).where(eq(schema.homes.playerId, who.id)).limit(1);
      if (!row) return { home: null };
      let layout: { id: string; slot: number }[] = [];
      try {
        const parsed = JSON.parse(row.layout) as unknown;
        if (Array.isArray(parsed)) layout = parsed.flatMap((x) => {
          const o = x as { id?: unknown; slot?: unknown };
          return typeof o?.id === "string" && typeof o.slot === "number" ? [{ id: o.id, slot: o.slot }] : [];
        }).slice(0, 14);
      } catch { layout = []; }
      return { home: { tier: row.tier, style: row.style, layout } };
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
      const [worn] = await db.select().from(schema.players).where(eq(schema.players.id, acc.playerId)).limit(1);
      const hairBit = (worn?.cosmetic ?? "").match(/#h[0-3](?:a[0-3])?$/)?.[0] ?? "";
      const nextLook = `${args.item ?? ""}${hairBit}`;
      await db.update(schema.players).set({ cosmetic: nextLook || null }).where(eq(schema.players.id, acc.playerId));
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

  /* ---- round-2 (c): 流浪动物 + 社区玩法 ---- */
  getStrays: defineAction({
    description: "The city's stray cats/dogs (not adopted). The server keeps 3–6 per city from park/village/beach spots; trust decays 5/day unfed.",
    request: z.object({ cityKey: cityZ, playerId: pidZ }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), strays: z.array(strayShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER, strays: [] };
      if (me.banned) return { ok: false, error: BANNED_MSG, strays: [] };
      if (me.cityKey !== args.cityKey) return { ok: false, error: "只能看你所在城市的流浪动物", strays: [] };
      await ensureStrays(db, args.cityKey, me.gameDay);
      const rows = await db.select().from(schema.strays).where(and(eq(schema.strays.city, args.cityKey), eq(schema.strays.adopted, 0))).orderBy(schema.strays.id);
      // persist the decayed trust so a later feed starts from the decayed value
      for (const r of rows) {
        const v = strayView(r, me.gameDay);
        if (v.trust !== r.trust) await db.update(schema.strays).set({ trust: v.trust }).where(eq(schema.strays.id, r.id));
      }
      return { ok: true, strays: rows.map((r) => strayView(r, me.gameDay)) };
    },
  }),

  feedStray: defineAction({
    description: "Feeds a stray once per player per game day (+8/10/15 trust by temper, cap 100). The ¥5 food cost stays client-side.",
    request: z.object({ playerId: pidZ, strayId: z.string().min(1).max(32), gameDay: z.number().int().min(1).max(366) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), trust: z.number().optional(), note: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (!communityRateOk(me.id)) return { ok: false, error: RATE_MSG };
      const id = Number(args.strayId);
      if (!Number.isInteger(id)) return { ok: false, error: "找不到这只流浪动物" };
      const [s] = await db.select().from(schema.strays).where(eq(schema.strays.id, id)).limit(1);
      if (!s || s.adopted) return { ok: false, error: "它已经被好心人收养了" };
      try {
        await db.insert(schema.strayFeeds).values({ strayId: id, playerId: me.id, day: args.gameDay, createdAt: new Date() });
      } catch { return { ok: false, error: "今天已经喂过它了, 明天再来吧" }; }
      const gain = STRAY_FEED_GAIN[s.temper] ?? 10;
      const trust = Math.min(100, s.trust + gain);
      const feeders = await db.select({ n: sql<number>`count(distinct ${schema.strayFeeds.playerId})` }).from(schema.strayFeeds).where(eq(schema.strayFeeds.strayId, id));
      await db.update(schema.strays).set({ trust, lastFedDay: args.gameDay, fedByCount: Number(feeders[0]?.n ?? 1) }).where(eq(schema.strays.id, id));
      const note = STRAY_FEED_NOTES[s.temper] ?? "它吃得很香.";
      return { ok: true, trust, note: trust >= 70 ? `${note} 它好像愿意跟你回家了.` : note };
    },
  }),

  adoptStray: defineAction({
    description: "Adopts a stray (trust ≥ 70, not adopted). Atomic: the update only lands where adopted = 0, so two players can't adopt the same animal.",
    request: z.object({ playerId: pidZ, strayId: z.string().min(1).max(32), petName: z.string().trim().min(1).max(12), gameDay: z.number().int().min(1).max(366) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (!communityRateOk(me.id)) return { ok: false, error: RATE_MSG };
      const id = Number(args.strayId);
      if (!Number.isInteger(id)) return { ok: false, error: "找不到这只流浪动物" };
      const [s] = await db.select().from(schema.strays).where(eq(schema.strays.id, id)).limit(1);
      if (!s) return { ok: false, error: "找不到这只流浪动物" };
      if (s.adopted) return { ok: false, error: "已经被收养了" };
      if (s.trust < 70) return { ok: false, error: "它还不太信任你, 多喂几次再来吧" };
      const changed = await db.update(schema.strays).set({ adopted: 1 }).where(and(eq(schema.strays.id, id), eq(schema.strays.adopted, 0))).returning({ id: schema.strays.id });
      if (!changed.length) return { ok: false, error: "已经被收养了" };
      return { ok: true };
    },
  }),

  syncPets: defineAction({
    description: "Stores the caller's pets (max 3) for device-switch sync. adoptedStrayId marks that stray adopted with the same guard as adoptStray.",
    request: z.object({
      playerId: pidZ,
      pets: z.array(z.object({
        id: z.string().min(1).max(64), kind: z.enum(["cat", "dog"]), breed: z.string().max(16),
        name: z.string().min(1).max(12), color: z.number().int().min(0).max(0xffffff),
        source: z.enum(["shelter", "stray", "shop", "gift"]), adoptedDay: z.number().int().min(0).max(366),
        adoptedAt: z.string().max(80),
        stats: z.object({ mood: z.number().min(0).max(100), hunger: z.number().min(0).max(100), affection: z.number().min(0).max(100), energy: z.number().min(0).max(100), cleanliness: z.number().min(0).max(100) }),
        tricks: z.array(z.object({ id: z.string().max(64), name: z.string().max(8), learnedDay: z.number().int() })).max(20),
        personality: z.string().max(20), interactionsToday: z.number().int().min(0).max(100),
        lastTickDay: z.number().int().min(0).max(366), greetedToday: z.boolean(),
      })).max(3),
      activePetId: z.string().max(64).nullable(),
      adoptedStrayId: z.string().max(32).optional(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (!communityRateOk(me.id)) return { ok: false, error: RATE_MSG };
      if (args.adoptedStrayId) {
        const id = Number(args.adoptedStrayId);
        if (Number.isInteger(id)) await db.update(schema.strays).set({ adopted: 1 }).where(and(eq(schema.strays.id, id), eq(schema.strays.adopted, 0)));
      }
      const payload = JSON.stringify({ pets: args.pets, activePetId: args.activePetId });
      await db.insert(schema.playerPets).values({ playerId: me.id, payload, updatedAt: new Date() })
        .onConflictDoUpdate({ target: schema.playerPets.playerId, set: { payload, updatedAt: new Date() } });
      return { ok: true };
    },
  }),

  postNotice: defineAction({
    description: "Posts a lost & found notice (title ≤ 30, body ≤ 200, 7-day TTL). Max 5 per player per day.",
    request: z.object({
      playerId: pidZ, kind: z.enum(["lost-pet", "lost-item", "found-pet", "found-item"]), cityKey: cityZ,
      title: z.string().trim().min(1).max(30), body: z.string().trim().min(1).max(200),
      locId: z.string().min(1).max(80), locName: z.string().min(1).max(40),
      x: z.number().optional(), z: z.number().optional(), photoUrl: z.string().max(500).nullable().optional(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), noticeId: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (!communityRateOk(me.id)) return { ok: false, error: RATE_MSG };
      if (me.cityKey !== args.cityKey) return { ok: false, error: "只能在你所在的城市发启事" };
      const today = await db.select({ n: sql<number>`count(*)` }).from(schema.notices).where(and(eq(schema.notices.authorId, me.id), gte(schema.notices.createdAt, new Date(Date.now() - 86_400_000))));
      if (Number(today[0]?.n ?? 0) >= 5) return { ok: false, error: "今天已经发了 5 条启事，明天再来" };
      const title = cleanText(args.title).slice(0, 30);
      const body = cleanText(args.body).slice(0, 200);
      if (!title.trim() || !body.trim()) return { ok: false, error: "标题和描述被过滤了，换个说法" };
      const now = new Date();
      const [row] = await db.insert(schema.notices).values({
        city: args.cityKey, kind: args.kind, title, body,
        locId: args.locId, locName: cleanText(args.locName).slice(0, 40),
        x: args.x ?? null, z: args.z ?? null, photoUrl: args.photoUrl ?? null,
        authorId: me.id, authorName: me.name, status: "open",
        expiresAt: new Date(now.getTime() + 7 * 86_400_000), createdAt: now,
      }).returning({ id: schema.notices.id });
      return { ok: true, noticeId: String(row?.id) };
    },
  }),

  getNotices: defineAction({
    description: "This city's open, unexpired lost & found notices, newest first (max 50). Expiry is filtered on read — no cron needed.",
    request: z.object({ cityKey: cityZ, playerId: pidZ }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), notices: z.array(noticeShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER, notices: [] };
      if (me.banned) return { ok: false, error: BANNED_MSG, notices: [] };
      const rows = await db.select().from(schema.notices)
        .where(and(eq(schema.notices.city, args.cityKey), eq(schema.notices.status, "open"), sql`${schema.notices.expiresAt} > ${Date.now()}`))
        .orderBy(desc(schema.notices.id)).limit(50);
      return { ok: true, notices: await Promise.all(rows.map((r) => noticeView(db, r))) };
    },
  }),

  replyNotice: defineAction({
    description: "Replies to an open notice (≤ 200 chars).",
    request: z.object({ playerId: pidZ, noticeId: z.string().min(1).max(32), text: z.string().trim().min(1).max(200) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), reply: noticeReplyShape.optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (!communityRateOk(me.id)) return { ok: false, error: RATE_MSG };
      const id = Number(args.noticeId);
      if (!Number.isInteger(id)) return { ok: false, error: "这条启事找不到了" };
      const [n] = await db.select().from(schema.notices).where(eq(schema.notices.id, id)).limit(1);
      if (!n || n.status !== "open" || n.expiresAt.getTime() <= Date.now()) return { ok: false, error: "这条启事已经过期或被认领了" };
      const text = cleanText(args.text).slice(0, 200);
      if (!text.trim()) return { ok: false, error: "回复被过滤了" };
      const [row] = await db.insert(schema.noticeReplies).values({ noticeId: id, authorId: me.id, authorName: me.name, text, createdAt: new Date() }).returning();
      return { ok: true, reply: { id: String(row?.id), authorId: me.id, authorName: me.name, text, createdAt: new Date().toISOString() } };
    },
  }),

  claimNotice: defineAction({
    description: "Marks a notice claimed / found (author only).",
    request: z.object({ playerId: pidZ, noticeId: z.string().min(1).max(32) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (!communityRateOk(me.id)) return { ok: false, error: RATE_MSG };
      const id = Number(args.noticeId);
      if (!Number.isInteger(id)) return { ok: false, error: "这条启事找不到了" };
      const [n] = await db.select().from(schema.notices).where(eq(schema.notices.id, id)).limit(1);
      if (!n) return { ok: false, error: "这条启事找不到了" };
      if (n.authorId !== me.id) return { ok: false, error: "只有启事的作者能标记认领" };
      if (n.status !== "open") return { ok: false, error: "这条启事已经结了" };
      await db.update(schema.notices).set({ status: "claimed", claimedByName: me.name }).where(eq(schema.notices.id, id));
      return { ok: true };
    },
  }),

  reportSnake: defineAction({
    description: "Reports a snake sighting (species guess ≤ 20, description ≤ 200, 3-day TTL). Max 3 per player per hour.",
    request: z.object({
      playerId: pidZ, cityKey: cityZ, locId: z.string().min(1).max(80), locName: z.string().min(1).max(40),
      x: z.number().optional(), z: z.number().optional(),
      speciesGuess: z.string().max(20), description: z.string().max(200), photoUrl: z.string().max(500).nullable().optional(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), reportId: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (!communityRateOk(me.id)) return { ok: false, error: RATE_MSG };
      if (me.cityKey !== args.cityKey) return { ok: false, error: "只能上报你所在城市的蛇出没" };
      const hour = await db.select({ n: sql<number>`count(*)` }).from(schema.snakeReports).where(and(eq(schema.snakeReports.reporterId, me.id), gte(schema.snakeReports.createdAt, new Date(Date.now() - 3600_000))));
      if (Number(hour[0]?.n ?? 0) >= 3) return { ok: false, error: "一小时内最多上报 3 条蛇出没" };
      const speciesGuess = cleanText(args.speciesGuess).slice(0, 20);
      const description = cleanText(args.description).slice(0, 200);
      if (!speciesGuess.trim() && !description.trim()) return { ok: false, error: "描述一下这条蛇吧 (大小、颜色都行)" };
      const now = new Date();
      const [row] = await db.insert(schema.snakeReports).values({
        city: args.cityKey, locId: args.locId, locName: cleanText(args.locName).slice(0, 40),
        x: args.x ?? null, z: args.z ?? null, speciesGuess, description, photoUrl: args.photoUrl ?? null,
        reporterId: me.id, reporterName: me.name,
        expiresAt: new Date(now.getTime() + 3 * 86_400_000), confirmations: 0, createdAt: now,
      }).returning({ id: schema.snakeReports.id });
      return { ok: true, reportId: String(row?.id) };
    },
  }),

  getSnakeWarnings: defineAction({
    description: "This city's unexpired snake warnings, most-confirmed first.",
    request: z.object({ cityKey: cityZ, playerId: pidZ }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), warnings: z.array(snakeShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER, warnings: [] };
      if (me.banned) return { ok: false, error: BANNED_MSG, warnings: [] };
      const rows = await db.select().from(schema.snakeReports)
        .where(and(eq(schema.snakeReports.city, args.cityKey), sql`${schema.snakeReports.expiresAt} > ${Date.now()}`))
        .orderBy(desc(schema.snakeReports.confirmations), desc(schema.snakeReports.id)).limit(50);
      return { ok: true, warnings: rows.map(snakeView) };
    },
  }),

  confirmSnake: defineAction({
    description: "Confirms a snake sighting (once per player per report); +1 confirmation and +1 day of expiry. ≥ 2 confirmations = verified.",
    request: z.object({ playerId: pidZ, reportId: z.string().min(1).max(32) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), confirmations: z.number().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (!communityRateOk(me.id)) return { ok: false, error: RATE_MSG };
      const id = Number(args.reportId);
      if (!Number.isInteger(id)) return { ok: false, error: "这条上报找不到了" };
      const [r] = await db.select().from(schema.snakeReports).where(eq(schema.snakeReports.id, id)).limit(1);
      if (!r || r.expiresAt.getTime() <= Date.now()) return { ok: false, error: "这条上报已经过期了" };
      try {
        await db.insert(schema.snakeConfirms).values({ reportId: id, playerId: me.id, createdAt: new Date() });
      } catch { return { ok: false, error: "你已经确认过这条了" }; }
      const confirmations = r.confirmations + 1;
      await db.update(schema.snakeReports).set({ confirmations, expiresAt: new Date(r.expiresAt.getTime() + 86_400_000) }).where(eq(schema.snakeReports.id, id));
      return { ok: true, confirmations };
    },
  }),

  reportFishingSpot: defineAction({
    description: "Reports a fishing spot. A spot within ~100 m of an existing one is refused (returns existingSpotId). Max 5 per player per day.",
    request: z.object({
      playerId: pidZ, cityKey: cityZ, locId: z.string().min(1).max(80), locName: z.string().min(1).max(40),
      x: z.number().optional(), z: z.number().optional(),
      catchDesc: z.string().trim().min(1).max(200), bait: z.string().max(60).optional(), notes: z.string().max(200).optional(),
      photoUrl: z.string().max(500).nullable().optional(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), spotId: z.string().optional(), existingSpotId: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (!communityRateOk(me.id)) return { ok: false, error: RATE_MSG };
      if (me.cityKey !== args.cityKey) return { ok: false, error: "只能上报你所在城市的钓点" };
      const day = await db.select({ n: sql<number>`count(*)` }).from(schema.fishingSpots).where(and(eq(schema.fishingSpots.reporterId, me.id), gte(schema.fishingSpots.createdAt, new Date(Date.now() - 86_400_000))));
      if (Number(day[0]?.n ?? 0) >= 5) return { ok: false, error: "今天已经上报了 5 个钓点，明天再来" };
      const existing = await db.select().from(schema.fishingSpots).where(eq(schema.fishingSpots.city, args.cityKey)).orderBy(desc(schema.fishingSpots.id)).limit(100);
      // ~100 m ≈ 1 world unit on this map (the whole map spans ~38 units); same locId with no coords also counts as a duplicate.
      const dup = existing.find((s) => {
        if (args.x !== undefined && args.z !== undefined && s.x !== null && s.z !== null) return Math.hypot(s.x - args.x, s.z - args.z) < 1;
        return s.locId === args.locId;
      });
      if (dup) return { ok: false, error: "这里已有钓点, 去确认它吧", existingSpotId: String(dup.id) };
      const now = new Date();
      const [row] = await db.insert(schema.fishingSpots).values({
        city: args.cityKey, locId: args.locId, locName: cleanText(args.locName).slice(0, 40),
        x: args.x ?? null, z: args.z ?? null,
        catchDesc: cleanText(args.catchDesc).slice(0, 200),
        bait: cleanText(args.bait ?? "").slice(0, 60), notes: cleanText(args.notes ?? "").slice(0, 200),
        photoUrl: args.photoUrl ?? null, reporterId: me.id, reporterName: me.name,
        confirmations: 0, lastConfirmedAt: now, createdAt: now,
      }).returning({ id: schema.fishingSpots.id });
      return { ok: true, spotId: String(row?.id) };
    },
  }),

  getFishingSpots: defineAction({
    description: "This city's fishing spots, all of them including stale ones (the client sorts; stale = 30 days without a confirmation). Max 100.",
    request: z.object({ cityKey: cityZ, playerId: pidZ }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), spots: z.array(fishingShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER, spots: [] };
      if (me.banned) return { ok: false, error: BANNED_MSG, spots: [] };
      const rows = await db.select().from(schema.fishingSpots).where(eq(schema.fishingSpots.city, args.cityKey))
        .orderBy(desc(schema.fishingSpots.confirmations), desc(schema.fishingSpots.id)).limit(100);
      return { ok: true, spots: rows.map(fishingView) };
    },
  }),

  confirmFishingSpot: defineAction({
    description: "Confirms a fishing spot (once per player per spot); +1 confirmation and re-activates a stale spot.",
    request: z.object({ playerId: pidZ, spotId: z.string().min(1).max(32) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), confirmations: z.number().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (!communityRateOk(me.id)) return { ok: false, error: RATE_MSG };
      const id = Number(args.spotId);
      if (!Number.isInteger(id)) return { ok: false, error: "这个钓点找不到了" };
      const [r] = await db.select().from(schema.fishingSpots).where(eq(schema.fishingSpots.id, id)).limit(1);
      if (!r) return { ok: false, error: "这个钓点找不到了" };
      try {
        await db.insert(schema.fishingConfirms).values({ spotId: id, playerId: me.id, createdAt: new Date() });
      } catch { return { ok: false, error: "你已经确认过这个钓点了" }; }
      const confirmations = r.confirmations + 1;
      await db.update(schema.fishingSpots).set({ confirmations, lastConfirmedAt: new Date() }).where(eq(schema.fishingSpots.id, id));
      return { ok: true, confirmations };
    },
  }),

  /* ---- round-2 (d): 举报黑房东 / 黑公司 ---- */
  fileBlackReport: defineAction({
    description: "Files a free-text report against a game landlord (home:<city>) or company (COMPANIES id). Free; consequences only after a 24 h same-city jury upholds it.",
    request: z.object({
      playerId: pidZ, kind: z.enum(["landlord", "employer"]), city: cityZ,
      targetId: z.string().min(1).max(64), targetName: z.string().min(1).max(40),
      body: z.string().trim().min(10).max(600), evidence: z.record(z.string(), z.any()).optional(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), reportId: z.number().optional(), dueAt: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      return fileBlackReportInner(db, me, args);
    },
  }),

  getBlackReports: defineAction({
    description: "The caller's reports, the open reports they can jury in their city, the upheld exposure board, reputations, their own standing, and any server-side rent rollback to re-apply on load. Settles due juries first.",
    request: z.object({ playerId: pidZ, city: cityZ }),
    response: z.object({
      ok: z.boolean(), error: z.string().optional(),
      mine: z.array(blackReportShape), jury: z.array(blackReportShape), exposed: z.array(blackReportShape),
      reputations: z.array(reputationShape),
      standing: z.object({ credibility: z.number(), filedCount: z.number(), upheldCount: z.number(), rejectedCount: z.number(), lockedUntil: z.string().nullable() }).optional(),
      rentRollback: z.object({ rent: z.number(), baseRent: z.number() }).nullable().optional(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await settleBlackReports(db);
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER, mine: [], jury: [], exposed: [], reputations: [] };
      if (me.banned) return { ok: false, error: BANNED_MSG, mine: [], jury: [], exposed: [], reputations: [] };
      const mineRows = await db.select().from(schema.blackReports).where(eq(schema.blackReports.reporterId, me.id)).orderBy(desc(schema.blackReports.id)).limit(20);
      const juryRows = await db.select().from(schema.blackReports).where(and(eq(schema.blackReports.city, args.city), eq(schema.blackReports.status, "open"))).orderBy(desc(schema.blackReports.id)).limit(20);
      const exposedRows = await db.select().from(schema.blackReports).where(and(eq(schema.blackReports.city, args.city), eq(schema.blackReports.status, "upheld"))).orderBy(desc(schema.blackReports.id)).limit(20);
      const repRows = await db.select().from(schema.blackReputations).where(eq(schema.blackReputations.city, args.city)).orderBy(desc(schema.blackReputations.updatedAt)).limit(50);
      const standing = await getStanding(db, me.id);
      const [rb] = await db.select().from(schema.blackRentRollbacks).where(eq(schema.blackRentRollbacks.playerId, me.id)).limit(1);
      return {
        ok: true,
        mine: await Promise.all(mineRows.map((r) => blackReportView(db, r, me.id))),
        jury: await Promise.all(juryRows.filter((r) => r.reporterId !== me.id).map((r) => blackReportView(db, r, me.id))),
        exposed: await Promise.all(exposedRows.map((r) => blackReportView(db, r, me.id))),
        reputations: repRows.map(reputationView),
        standing: { credibility: standing.credibility, filedCount: standing.filedCount, upheldCount: standing.upheldCount, rejectedCount: standing.rejectedCount, lockedUntil: standing.lockedUntil?.toISOString() ?? null },
        rentRollback: rb ? { rent: rb.rent, baseRent: rb.baseRent } : null,
      };
    },
  }),

  blackReportVote: defineAction({
    description: "Votes on an open black report in the caller's city (uphold / reject). One vote, changeable until the jury closes; parties can't vote; needs an account.",
    request: z.object({ playerId: pidZ, reportId: z.number().int().positive(), side: z.enum(["uphold", "reject"]) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await settleBlackReports(db);
      const [r] = await db.select().from(schema.blackReports).where(eq(schema.blackReports.id, args.reportId)).limit(1);
      const me = await r2Player(db, args.playerId);
      if (!r || !me || r.status !== "open") return { ok: false, error: "这个举报已经结案了" };
      if (r.reporterId === me.id) return { ok: false, error: "举报人不能投票" };
      if (me.cityKey !== r.city) return { ok: false, error: "只有同城的人能当陪审员" };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (socialNeedsAccount() && !me.accountId) return { ok: false, error: "先绑定账号，才能当陪审员——一人一票" };
      await db.insert(schema.blackReportVotes).values({ reportId: r.id, voterId: me.id, side: args.side, createdAt: new Date() })
        .onConflictDoUpdate({ target: [schema.blackReportVotes.reportId, schema.blackReportVotes.voterId], set: { side: args.side } });
      return { ok: true };
    },
  }),

  claimBlackReport: defineAction({
    description: "Collects a closed report's verdict (reporter only, once). Upheld: deposit + overcharge / back pay via creditMoney, and the rent rollback is persisted server-side. Rejected: credibility −25. Expired: nothing.",
    request: z.object({ playerId: pidZ, reportId: z.number().int().positive() }),
    response: z.object({
      ok: z.boolean(), error: z.string().optional(), money: z.number(),
      remedy: z.union([
        z.object({ rentRolledBackTo: z.number(), depositReturned: z.number(), overchargeRefunded: z.number(), fine: z.number() }),
        z.object({ backPay: z.number(), listingFlagged: z.boolean(), hiringSuspended: z.boolean(), fine: z.number() }),
      ]).optional(),
      lines: z.array(z.string()),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await settleBlackReports(db);
      const [r] = await db.select().from(schema.blackReports).where(eq(schema.blackReports.id, args.reportId)).limit(1);
      const me = await r2Player(db, args.playerId);
      if (!r || !me) return { ok: false, error: "这份举报找不到了", money: 0, lines: [] };
      if (r.reporterId !== me.id) return { ok: false, error: "只有举报人能领取裁决", money: 0, lines: [] };
      if (r.status === "open") return { ok: false, error: "陪审团还没判完", money: 0, lines: [] };
      // single-claim guard, same compare-and-set pattern as claimGigMoney
      const claimed = await db.update(schema.blackReports).set({ reporterClaimed: 1 }).where(and(eq(schema.blackReports.id, r.id), eq(schema.blackReports.reporterClaimed, 0))).returning({ id: schema.blackReports.id });
      if (!claimed.length) return { ok: false, error: "已经领过了", money: 0, lines: [] };
      const standing = await getStanding(db, me.id);
      const now = new Date();
      if (r.status === "expired") {
        return { ok: true, money: 0, lines: ["陪审团没凑够票，这份举报按“无法证实”结案，没有惩罚，证据更足了可以再报一次。"] };
      }
      if (r.status === "rejected") {
        const credibility = Math.max(0, standing.credibility - 25);
        const locked = credibility < 50;
        await db.update(schema.reporterStanding).set({
          credibility, rejectedCount: standing.rejectedCount + 1,
          lockedUntil: locked ? new Date(now.getTime() + 7 * 86_400_000) : standing.lockedUntil, updatedAt: now,
        }).where(eq(schema.reporterStanding.playerId, me.id));
        return { ok: true, money: 0, lines: [`陪审团驳回了这份举报，信誉 -25（现在 ${credibility}）。${locked ? "举报功能锁定一周，等信誉恢复。" : "下次举报记得附上更实的证据。"}`] };
      }
      // upheld
      let evidence: Record<string, unknown> = {};
      try { evidence = r.evidence ? JSON.parse(r.evidence) as Record<string, unknown> : {}; } catch { evidence = {}; }
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
      await db.update(schema.reporterStanding).set({ credibility: Math.min(100, standing.credibility + 5), upheldCount: standing.upheldCount + 1, updatedAt: now }).where(eq(schema.reporterStanding.playerId, me.id));
      if (r.kind === "landlord") {
        const baseRent = num(evidence.baseRent);
        const currentRent = num(evidence.currentRent);
        const depositReturned = num(evidence.depositPaid);
        const overchargeRefunded = Math.max(0, currentRent - baseRent);
        const money = depositReturned + overchargeRefunded;
        const remedy = { rentRolledBackTo: baseRent, depositReturned, overchargeRefunded, fine: 200 };
        if (money > 0) await creditMoney(db, me.id, money, `black report #${r.id} landlord remedy`);
        // Persist the rollback server-side: the next save/load must not resurrect the raised rent.
        if (baseRent > 0) {
          await db.insert(schema.blackRentRollbacks).values({ playerId: me.id, rent: baseRent, baseRent, reportId: r.id, createdAt: now })
            .onConflictDoUpdate({ target: schema.blackRentRollbacks.playerId, set: { rent: baseRent, baseRent, reportId: r.id, createdAt: now } });
        }
        const lines = [
          ...(baseRent > 0 ? [`房租从 ¥${currentRent}/周滚回 ¥${baseRent}/周。`] : []),
          ...(money > 0 ? [`押金 + 多收的房租，一共退回 ¥${money}。`] : []),
          "房东被罚 ¥200，进了社区基金。",
          "陪审团判你赢了。以后租房，记得先看曝光栏。",
        ];
        return { ok: true, money, remedy, lines };
      }
      const backPay = Math.min(2000, num(evidence.claimedUnpaid) || num(evidence.otCount) * num(evidence.otPayPerShift));
      const [rep] = await db.select().from(schema.blackReputations).where(and(eq(schema.blackReputations.targetId, r.targetId), eq(schema.blackReputations.kind, r.kind))).limit(1);
      const hiringSuspended = (rep?.upheldCount ?? 0) >= 2;
      const remedy = { backPay, listingFlagged: true, hiringSuspended, fine: 500 };
      if (backPay > 0) await creditMoney(db, me.id, backPay, `black report #${r.id} employer remedy`);
      const lines = [
        ...(backPay > 0 ? [`拖欠的加班费/工资补发了：+¥${backPay}。`] : []),
        "这家公司的招聘已被标记，所有人都能看到这起举报。",
        ...(hiringSuspended ? ["公司暂停招人，直到整改通过。"] : []),
        "公司被罚 ¥500，进了社区基金。",
        "陪审团判你赢了。打工人的委屈，有地方说了。",
      ];
      return { ok: true, money: backPay, remedy, lines };
    },
  }),

  /* ---- round-2 (e): 开放经济 — 交易贴 / 转租 / 海淘 / 贱买贱卖 / 二手家具 ----
     Posting is free; player-to-player trade takes 0% cut. Escrow uses the
     dedicated trade_escrow ledger (NOT sendGift: gift kinds cap at ¥5,000
     and 10/day). Frozen escrow is never released from the client side. */
  getTradeTasks: defineAction({
    description: "Searches the player trade board (free-text substring over title/body/tags + price range + kind/city filters). No fixed categories.",
    request: z.object({
      playerId: pidZ.optional(), city: z.enum(["sz", "hz", "hk", "any"]).optional(),
      kind: z.enum(["buy", "sell", "swap", "service", "other"]).optional(),
      text: z.string().max(60).optional(), minPrice: z.number().int().min(0).optional(),
      maxPrice: z.number().int().min(0).optional(), openOnly: z.boolean().optional(), limit: z.number().int().min(1).max(50).optional(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), tasks: z.array(tradeTaskShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await settleTradeDisputes(db);
      const me = args.playerId ? await r2Player(db, args.playerId) : undefined;
      if (args.playerId && !me) return { ok: false, error: NO_PLAYER, tasks: [] };
      if (me?.banned) return { ok: false, error: BANNED_MSG, tasks: [] };
      if (me && args.city && args.city !== "any" && me.cityKey !== args.city) return { ok: false, error: "只能看你所在城市的交易板", tasks: [] };
      const rows = await db.select().from(schema.tradeTasks).orderBy(desc(schema.tradeTasks.id)).limit(200);
      const needle = (args.text ?? "").trim().toLowerCase();
      const openOnly = args.openOnly !== false;
      const out = rows.filter((t) => {
        if (openOnly && t.status !== "open") return false;
        if (args.kind && t.kind !== args.kind) return false;
        if (args.city && args.city !== "any" && t.city !== "any" && t.city !== args.city) return false;
        if (args.minPrice !== undefined && (t.price === null || t.price < args.minPrice)) return false;
        if (args.maxPrice !== undefined && (t.price === null || t.price > args.maxPrice)) return false;
        if (needle) {
          let tags: string[] = [];
          try { const v = JSON.parse(t.tags) as unknown; if (Array.isArray(v)) tags = v.filter((x): x is string => typeof x === "string"); } catch { tags = []; }
          if (!`${t.title} ${t.body} ${tags.join(" ")}`.toLowerCase().includes(needle)) return false;
        }
        return true;
      }).slice(0, args.limit ?? 50);
      return { ok: true, tasks: out.map(tradeTaskView) };
    },
  }),

  postTradeTask: defineAction({
    description: "Posts a free-text trade task (title ≤ 60, body ≤ 500, price 0 < p ≤ 1,000,000 or null = 面议). Free; max 10 open per player.",
    request: z.object({
      playerId: pidZ, kind: z.enum(["buy", "sell", "swap", "service", "other"]),
      title: z.string().trim().min(1).max(60), body: z.string().trim().max(500),
      price: z.number().int().min(1).max(1000000).nullable().optional(), negotiable: z.boolean().optional(),
      tags: z.array(z.string().trim().min(1).max(10)).max(5).optional(),
      city: z.enum(["sz", "hz", "hk", "any"]).optional(), expiresInDays: z.number().int().min(0).max(30).optional(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), task: tradeTaskShape.optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (socialNeedsAccount() && !me.accountId) return { ok: false, error: "先绑定账号，才能发交易贴——防小号刷贴" };
      if (args.city && args.city !== "any" && me.cityKey !== args.city) return { ok: false, error: "只能在你所在的城市发交易贴" };
      const open = await db.select({ n: sql<number>`count(*)` }).from(schema.tradeTasks).where(and(eq(schema.tradeTasks.posterId, me.id), eq(schema.tradeTasks.status, "open")));
      if (Number(open[0]?.n ?? 0) >= 10) return { ok: false, error: "你已经挂着 10 个未完成的交易，先完成或取消几个再发。" };
      const title = cleanText(args.title).slice(0, 60);
      const body = cleanText(args.body).slice(0, 500);
      if (!title.trim()) return { ok: false, error: "写一句你要买还是要卖什么" };
      const tags = (args.tags ?? []).map((t) => cleanText(t).slice(0, 10)).filter(Boolean);
      const expiresIn = !args.expiresInDays ? 7 : args.expiresInDays;
      const [row] = await db.insert(schema.tradeTasks).values({
        city: args.city ?? me.cityKey, posterId: me.id, posterName: me.name, kind: args.kind,
        title, body, price: args.price ?? null, negotiable: args.negotiable ? 1 : 0,
        tags: JSON.stringify(tags), status: "open", escrowHeld: 0,
        createdDay: me.gameDay, expiresDay: me.gameDay + expiresIn, createdAt: new Date(),
      }).returning();
      return { ok: true, task: row ? tradeTaskView(row) : undefined };
    },
  }),

  acceptTradeTask: defineAction({
    description: "Takes an open trade task (not your own, same city unless the task is city 'any'). No money moves yet — escrow is a separate step.",
    request: z.object({ playerId: pidZ, taskId: z.string().min(1).max(32) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), task: tradeTaskShape.optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      const id = Number(args.taskId);
      if (!Number.isInteger(id)) return { ok: false, error: "这个交易贴找不到了" };
      const [t] = await db.select().from(schema.tradeTasks).where(eq(schema.tradeTasks.id, id)).limit(1);
      if (!t) return { ok: false, error: "这个交易贴找不到了" };
      if (t.status !== "open") return { ok: false, error: "这个交易已经有人接了 / 已经结束" };
      if (t.posterId === me.id) return { ok: false, error: "不能接自己的交易贴" };
      if (t.city !== "any" && me.cityKey !== t.city) return { ok: false, error: "只能接你所在城市的交易" };
      const changed = await db.update(schema.tradeTasks).set({ status: "accepted", accepterId: me.id, accepterName: me.name }).where(and(eq(schema.tradeTasks.id, id), eq(schema.tradeTasks.status, "open"))).returning();
      if (!changed.length) return { ok: false, error: "这个交易已经有人接了" };
      return { ok: true, task: tradeTaskView(changed[0]!) };
    },
  }),

  escrowTradeTask: defineAction({
    description: "Pays into escrow for an accepted task (dedicated ledger, not sendGift). Amount must equal the task price when priced; 面议 tasks need the agreed amount. The payer's money is held by the server.",
    request: z.object({ playerId: pidZ, taskId: z.string().min(1).max(32), amount: z.number().int().min(1).max(1000000) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), task: tradeTaskShape.optional(), escrowDue: z.number().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (socialNeedsAccount() && !me.accountId) return { ok: false, error: "先绑定账号，才能托管交易款" };
      const id = Number(args.taskId);
      if (!Number.isInteger(id)) return { ok: false, error: "这个交易贴找不到了" };
      const [t] = await db.select().from(schema.tradeTasks).where(eq(schema.tradeTasks.id, id)).limit(1);
      if (!t) return { ok: false, error: "这个交易贴找不到了" };
      if (t.status !== "accepted") return { ok: false, error: "先接下交易，再托管钱。" };
      if (t.posterId !== me.id && t.accepterId !== me.id) return { ok: false, error: "只有交易的双方能托管" };
      if (t.escrowHeld > 0) return { ok: false, error: "这单已经托管过了。" };
      const due = t.price ?? args.amount;
      if (args.amount !== due) return { ok: false, error: t.price ? `这单托管金额就是 ${t.price}¥（贴主标的价）。` : "面议的单，先跟贴主谈好价再托管。" };
      if (me.money < due) return { ok: false, error: "存款不够托管这笔钱" };
      await creditMoney(db, me.id, -due, `trade escrow #${id}`);
      await db.insert(schema.tradeEscrow).values({ taskId: id, kind: "trade", payerId: me.id, amount: due, status: "held", createdAt: new Date() });
      const [row] = await db.update(schema.tradeTasks).set({ escrowHeld: due, escrowFromId: me.id, escrowFromName: me.name }).where(eq(schema.tradeTasks.id, id)).returning();
      return { ok: true, task: row ? tradeTaskView(row) : undefined, escrowDue: due };
    },
  }),

  completeTradeTask: defineAction({
    description: "Either party confirms completion; escrow (if any) is released to the seller side (sell-task → poster, otherwise accepter). 0% cut.",
    request: z.object({ playerId: pidZ, taskId: z.string().min(1).max(32), note: z.string().max(200).optional() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), releasedTo: z.string().optional(), releasedAmount: z.number().optional(), task: tradeTaskShape.optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      const id = Number(args.taskId);
      if (!Number.isInteger(id)) return { ok: false, error: "这个交易贴找不到了" };
      const [t] = await db.select().from(schema.tradeTasks).where(eq(schema.tradeTasks.id, id)).limit(1);
      if (!t) return { ok: false, error: "这个交易贴找不到了" };
      if (t.status !== "accepted") return { ok: false, error: "这单还没人接 / 已经结束了。" };
      if (t.posterId !== me.id && t.accepterId !== me.id) return { ok: false, error: "只有交易的双方能确认完成。" };
      const releaseToId = t.kind === "sell" ? t.posterId : (t.accepterId ?? t.posterId);
      const releaseAmount = t.escrowHeld;
      const [row] = await db.update(schema.tradeTasks).set({ status: "completed", escrowHeld: 0, completionNote: cleanText(args.note ?? "").slice(0, 200) || null }).where(and(eq(schema.tradeTasks.id, id), eq(schema.tradeTasks.status, "accepted"))).returning();
      if (!row) return { ok: false, error: "这单已经结束了。" };
      if (releaseAmount > 0) {
        const [esc] = await db.select().from(schema.tradeEscrow).where(and(eq(schema.tradeEscrow.taskId, id), eq(schema.tradeEscrow.kind, "trade"), eq(schema.tradeEscrow.status, "held"))).limit(1);
        if (esc) {
          await db.update(schema.tradeEscrow).set({ status: "released", releasedAt: new Date() }).where(eq(schema.tradeEscrow.id, esc.id));
          await creditMoney(db, releaseToId, releaseAmount, `trade release #${id}`);
        }
      }
      const [to] = await db.select().from(schema.players).where(eq(schema.players.id, releaseToId)).limit(1);
      return { ok: true, releasedTo: to?.name ?? releaseToId, releasedAmount: releaseAmount, task: tradeTaskView(row) };
    },
  }),

  cancelTradeTask: defineAction({
    description: "Cancels an open/accepted task (either side); escrow, if held, is refunded to whoever paid it.",
    request: z.object({ playerId: pidZ, taskId: z.string().min(1).max(32) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), refunded: z.number().optional(), task: tradeTaskShape.optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      const id = Number(args.taskId);
      if (!Number.isInteger(id)) return { ok: false, error: "这个交易贴找不到了" };
      const [t] = await db.select().from(schema.tradeTasks).where(eq(schema.tradeTasks.id, id)).limit(1);
      if (!t) return { ok: false, error: "这个交易贴找不到了" };
      if (t.status !== "open" && t.status !== "accepted") return { ok: false, error: "这单已经结束了，不能取消。" };
      if (t.posterId !== me.id && t.accepterId !== me.id) return { ok: false, error: "只有交易的双方能取消这单。" };
      const refundAmount = t.escrowHeld;
      const refundTo = t.escrowFromId;
      const [row] = await db.update(schema.tradeTasks).set({ status: "cancelled", escrowHeld: 0 }).where(eq(schema.tradeTasks.id, id)).returning();
      if (refundAmount > 0 && refundTo) {
        const [esc] = await db.select().from(schema.tradeEscrow).where(and(eq(schema.tradeEscrow.taskId, id), eq(schema.tradeEscrow.kind, "trade"), eq(schema.tradeEscrow.status, "held"))).limit(1);
        if (esc) {
          await db.update(schema.tradeEscrow).set({ status: "refunded", releasedAt: new Date() }).where(eq(schema.tradeEscrow.id, esc.id));
          await creditMoney(db, refundTo, refundAmount, `trade refund #${id}`);
        }
      }
      return { ok: true, refunded: refundAmount, task: row ? tradeTaskView(row) : undefined };
    },
  }),

  disputeTradeTask: defineAction({
    description: "Freezes an accepted/completed task and its escrow; the dispute goes to a 24 h same-city jury (quorum 3). The frozen money is released/refunded by adjudicateTradeDispute once the jury closes — never by this endpoint.",
    request: z.object({ playerId: pidZ, taskId: z.string().min(1).max(32), reason: z.string().trim().min(4).max(200) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), caseId: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      const id = Number(args.taskId);
      if (!Number.isInteger(id)) return { ok: false, error: "这个交易贴找不到了" };
      const [t] = await db.select().from(schema.tradeTasks).where(eq(schema.tradeTasks.id, id)).limit(1);
      if (!t) return { ok: false, error: "这个交易贴找不到了" };
      if (t.status !== "accepted" && t.status !== "completed") return { ok: false, error: "只有进行中 / 刚完成的交易能申诉。" };
      if (t.posterId !== me.id && t.accepterId !== me.id) return { ok: false, error: "只有交易的双方能申诉。" };
      await db.update(schema.tradeTasks).set({ status: "disputed", disputeReason: cleanText(args.reason).slice(0, 200), disputedAt: new Date(), disputeFromStatus: t.status }).where(eq(schema.tradeTasks.id, id));
      if (t.escrowHeld > 0) await db.update(schema.tradeEscrow).set({ status: "frozen" }).where(and(eq(schema.tradeEscrow.taskId, id), eq(schema.tradeEscrow.kind, "trade"), eq(schema.tradeEscrow.status, "held")));
      return { ok: true, caseId: `trade-${id}` };
    },
  }),

  tradeDisputeVote: defineAction({
    description: "Votes on a disputed trade task in the caller's city (seller = release the frozen escrow to the seller side, buyer = refund it to whoever paid). One vote, changeable until the jury closes; the two parties can't vote; needs an account.",
    request: z.object({ playerId: pidZ, taskId: z.string().min(1).max(32), side: z.enum(["seller", "buyer"]) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), votes: z.object({ seller: z.number(), buyer: z.number() }).optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await settleTradeDisputes(db);
      const id = Number(args.taskId);
      if (!Number.isInteger(id)) return { ok: false, error: "这个交易贴找不到了" };
      const [t] = await db.select().from(schema.tradeTasks).where(eq(schema.tradeTasks.id, id)).limit(1);
      const me = await r2Player(db, args.playerId);
      if (!t || !me || t.status !== "disputed") return { ok: false, error: "这个纠纷已经结案了" };
      if (t.posterId === me.id || t.accepterId === me.id) return { ok: false, error: "当事人不能投票" };
      if (t.city !== "any" && me.cityKey !== t.city) return { ok: false, error: "只有同城的人能当陪审员" };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (socialNeedsAccount() && !me.accountId) return { ok: false, error: "先绑定账号，才能当陪审员——一人一票" };
      await db.insert(schema.tradeDisputeVotes).values({ taskId: id, voterId: me.id, side: args.side, createdAt: new Date() })
        .onConflictDoUpdate({ target: [schema.tradeDisputeVotes.taskId, schema.tradeDisputeVotes.voterId], set: { side: args.side } });
      return { ok: true, votes: await tradeDisputeTallies(db, id) };
    },
  }),

  adjudicateTradeDispute: defineAction({
    description: "Settles a disputed trade task's 24 h jury (quorum 3, majority wins, tie / too few votes = expired and the escrow is refunded to whoever paid it). Seller wins → escrow released to the seller side (sell-task → poster, otherwise accepter); buyer wins or expired → refunded to the payer. Anyone may trigger the settlement once the window has closed — it is deterministic and single-claim guarded — and the response reports the verdict and the money moved.",
    request: z.object({ playerId: pidZ, taskId: z.string().min(1).max(32) }),
    response: z.object({
      ok: z.boolean(), error: z.string().optional(), task: tradeTaskShape.optional(),
      verdict: z.enum(["seller", "buyer", "expired"]).optional(),
      votes: z.object({ seller: z.number(), buyer: z.number() }).optional(),
      releasedTo: z.string().optional(), releasedAmount: z.number().optional(), refunded: z.number().optional(),
      dueAt: z.string().optional(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await settleTradeDisputes(db);
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      const id = Number(args.taskId);
      if (!Number.isInteger(id)) return { ok: false, error: "这个交易贴找不到了" };
      const [t] = await db.select().from(schema.tradeTasks).where(eq(schema.tradeTasks.id, id)).limit(1);
      if (!t) return { ok: false, error: "这个交易贴找不到了" };
      const votes = await tradeDisputeTallies(db, id);
      if (t.status === "disputed") {
        const dueAt = new Date((t.disputedAt ?? t.createdAt).getTime() + TRADE_JURY_MS);
        return { ok: false, error: "陪审团还在投票，24 小时后再来结算。", votes, dueAt: dueAt.toISOString(), task: tradeTaskView(t) };
      }
      if (!t.disputeVerdict) return { ok: false, error: "这单没有在申诉中。", task: tradeTaskView(t) };
      const verdict = t.disputeVerdict as TradeVerdict;
      // The escrow row carries what moved at settle time (at most one trade
      // escrow row exists per task). No row / still held = no money moved.
      const [esc] = await db.select().from(schema.tradeEscrow).where(and(eq(schema.tradeEscrow.taskId, id), eq(schema.tradeEscrow.kind, "trade"))).limit(1);
      const moved = esc && (esc.status === "released" || esc.status === "refunded") ? esc.amount : 0;
      if (verdict === "seller") {
        const releaseToId = t.kind === "sell" ? t.posterId : (t.accepterId ?? t.posterId);
        const [to] = moved > 0 ? await db.select().from(schema.players).where(eq(schema.players.id, releaseToId)).limit(1) : [];
        return { ok: true, task: tradeTaskView(t), verdict, votes, releasedTo: to?.name ?? releaseToId, releasedAmount: moved };
      }
      return { ok: true, task: tradeTaskView(t), verdict, votes, refunded: moved };
    },
  }),

  getMyTradeTasks: defineAction({
    description: "The caller's trade tasks, as poster or accepter.",
    request: z.object({ playerId: pidZ }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), tasks: z.array(tradeTaskShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await settleTradeDisputes(db);
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER, tasks: [] };
      if (me.banned) return { ok: false, error: BANNED_MSG, tasks: [] };
      const rows = await db.select().from(schema.tradeTasks)
        .where(sql`${schema.tradeTasks.posterId} = ${me.id} OR ${schema.tradeTasks.accepterId} = ${me.id}`)
        .orderBy(desc(schema.tradeTasks.id)).limit(50);
      return { ok: true, tasks: rows.map(tradeTaskView) };
    },
  }),

  getSubletListings: defineAction({
    description: "Open sublet listings (city / space / max-price filters), with each listing's landlord-suspicion level.",
    request: z.object({
      playerId: pidZ.optional(), city: z.enum(["sz", "hz", "hk"]).optional(),
      space: z.enum(["room", "bed", "sofa", "whole"]).optional(), maxPrice: z.number().int().min(0).optional(),
      openOnly: z.boolean().optional(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), listings: z.array(subletShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = args.playerId ? await r2Player(db, args.playerId) : undefined;
      if (args.playerId && !me) return { ok: false, error: NO_PLAYER, listings: [] };
      if (me?.banned) return { ok: false, error: BANNED_MSG, listings: [] };
      const rows = await db.select().from(schema.subletListings).orderBy(desc(schema.subletListings.id)).limit(100);
      const out = rows.filter((l) => {
        if (args.openOnly !== false && l.status !== "open") return false;
        if (args.city && l.city !== args.city) return false;
        if (args.space && l.space !== args.space) return false;
        if (args.maxPrice !== undefined && l.monthlyPrice > args.maxPrice) return false;
        return true;
      });
      return { ok: true, listings: out.map(subletView) };
    },
  }),

  getMySublets: defineAction({
    description: "The caller's sublet listings (as owner) and tenancies (as tenant).",
    request: z.object({ playerId: pidZ }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), listings: z.array(subletShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER, listings: [] };
      if (me.banned) return { ok: false, error: BANNED_MSG, listings: [] };
      const rows = await db.select().from(schema.subletListings)
        .where(sql`${schema.subletListings.ownerId} = ${me.id} OR ${schema.subletListings.tenantId} = ${me.id}`)
        .orderBy(desc(schema.subletListings.id)).limit(50);
      return { ok: true, listings: rows.map(subletView) };
    },
  }),

  postSublet: defineAction({
    description: "Posts a sublet listing (free). The poster's own rent is recorded for the markup-suspicion rule; a price above it only warns, never blocks.",
    request: z.object({
      playerId: pidZ, homeLocId: z.string().min(1).max(80), city: cityZ,
      space: z.enum(["room", "bed", "sofa", "whole"]),
      monthlyPrice: z.number().int().min(1).max(100000), deposit: z.number().int().min(0).max(100000),
      terms: z.string().max(500), minDays: z.number().int().min(0).max(365), maxDays: z.number().int().min(0).max(365),
      availableFromDay: z.number().int().min(0).max(366), ownMonthlyRent: z.number().int().min(0).max(100000).optional(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), listing: subletShape.optional(), warning: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (socialNeedsAccount() && !me.accountId) return { ok: false, error: "先绑定账号，才能发转租贴" };
      if (me.cityKey !== args.city) return { ok: false, error: "只能在你所在的城市发转租" };
      if (args.maxDays > 0 && args.maxDays < args.minDays) return { ok: false, error: "最长入住不能比最短还短。" };
      const open = await db.select({ n: sql<number>`count(*)` }).from(schema.subletListings).where(and(eq(schema.subletListings.ownerId, me.id), eq(schema.subletListings.status, "open")));
      if (Number(open[0]?.n ?? 0) >= 10) return { ok: false, error: "你已经挂着 10 个转租贴了" };
      const [row] = await db.insert(schema.subletListings).values({
        city: args.city, ownerId: me.id, ownerName: me.name, homeLocId: args.homeLocId, space: args.space,
        monthlyPrice: args.monthlyPrice, deposit: args.deposit, terms: cleanText(args.terms).slice(0, 500),
        minDays: args.minDays, maxDays: args.maxDays, availableFromDay: args.availableFromDay,
        status: "open", tenancyStartDay: 0, rentCollected: 0, lastRentDay: args.availableFromDay,
        rentLate: 0, suspicion: 0, ownMonthlyRent: args.ownMonthlyRent ?? null,
        createdDay: me.gameDay, createdAt: new Date(),
      }).returning();
      const warning = args.ownMonthlyRent !== undefined && args.monthlyPrice > args.ownMonthlyRent
        ? "提醒：转租价比你自己的房租还高，房东更容易起疑——当二房东有风险。" : undefined;
      return { ok: true, listing: row ? subletView(row) : undefined, warning };
    },
  }),

  acceptSublet: defineAction({
    description: "Takes an open sublet listing. The deposit moves from the tenant into escrow (held, not spent).",
    request: z.object({ playerId: pidZ, listingId: z.string().min(1).max(32) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), listing: subletShape.optional(), depositDue: z.number().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (socialNeedsAccount() && !me.accountId) return { ok: false, error: "先绑定账号，才能租转租房" };
      const id = Number(args.listingId);
      if (!Number.isInteger(id)) return { ok: false, error: "这个转租贴找不到了" };
      const [l] = await db.select().from(schema.subletListings).where(eq(schema.subletListings.id, id)).limit(1);
      if (!l) return { ok: false, error: "这个转租贴找不到了" };
      if (l.status !== "open") return { ok: false, error: "这间已经有人住了。" };
      if (l.ownerId === me.id) return { ok: false, error: "不能租自己的房。" };
      if (me.cityKey !== l.city) return { ok: false, error: "只能租你所在城市的转租房" };
      if (me.gameDay < l.availableFromDay) return { ok: false, error: "还没到可入住的日子。" };
      if (l.deposit > 0 && me.money < l.deposit) return { ok: false, error: "存款不够付押金" };
      const changed = await db.update(schema.subletListings).set({ status: "taken", tenantId: me.id, tenantName: me.name, tenancyStartDay: me.gameDay, lastRentDay: me.gameDay }).where(and(eq(schema.subletListings.id, id), eq(schema.subletListings.status, "open"))).returning();
      if (!changed.length) return { ok: false, error: "这间已经有人住了。" };
      if (l.deposit > 0) {
        await creditMoney(db, me.id, -l.deposit, `sublet deposit #${id}`);
        await db.insert(schema.tradeEscrow).values({ taskId: id, kind: "sublet-deposit", payerId: me.id, amount: l.deposit, status: "held", createdAt: new Date() });
      }
      return { ok: true, listing: subletView(changed[0]!), depositDue: l.deposit };
    },
  }),

  endSublet: defineAction({
    description: "Ends a tenancy (owner or tenant). Deposit returns to the tenant minus damage % (kept part goes to the owner).",
    request: z.object({ playerId: pidZ, listingId: z.string().min(1).max(32), damage: z.number().int().min(0).max(100).optional(), reason: z.string().max(200).optional() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), depositReturned: z.number().optional(), depositKept: z.number().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      const id = Number(args.listingId);
      if (!Number.isInteger(id)) return { ok: false, error: "这个转租贴找不到了" };
      const [l] = await db.select().from(schema.subletListings).where(eq(schema.subletListings.id, id)).limit(1);
      if (!l) return { ok: false, error: "这个转租贴找不到了" };
      if (l.status !== "taken" || !l.tenantId) return { ok: false, error: "这间现在没有租客。" };
      if (l.ownerId !== me.id && l.tenantId !== me.id) return { ok: false, error: "只有房东或租客能结束这次转租。" };
      const damage = args.damage ?? 0;
      const depositKept = Math.round((l.deposit * damage) / 100);
      const depositReturned = l.deposit - depositKept;
      await db.update(schema.subletListings).set({ status: "closed", tenantId: null, tenantName: null, tenancyStartDay: 0 }).where(eq(schema.subletListings.id, id));
      if (l.deposit > 0) {
        const [esc] = await db.select().from(schema.tradeEscrow).where(and(eq(schema.tradeEscrow.taskId, id), eq(schema.tradeEscrow.kind, "sublet-deposit"), eq(schema.tradeEscrow.status, "held"))).limit(1);
        if (esc) {
          await db.update(schema.tradeEscrow).set({ status: "released", releasedAt: new Date() }).where(eq(schema.tradeEscrow.id, esc.id));
          if (depositReturned > 0) await creditMoney(db, l.tenantId, depositReturned, `sublet deposit return #${id}`);
          if (depositKept > 0) await creditMoney(db, l.ownerId, depositKept, `sublet deposit kept #${id}`);
        }
      }
      return { ok: true, depositReturned, depositKept };
    },
  }),

  collectSubletRent: defineAction({
    description: "Weekly sublet rent payout for the caller's listings (monthlyPrice × 7/30 per tenancy, due every 7 days). A tenant who can't pay is marked late — never auto-evicted. Also grows landlord suspicion (+2/day, +4 more when priced above the owner's own rent).",
    request: z.object({ playerId: pidZ }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), paid: z.array(z.object({ listingId: z.string(), amount: z.number() })), late: z.array(z.string()) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER, paid: [], late: [] };
      if (me.banned) return { ok: false, error: BANNED_MSG, paid: [], late: [] };
      const rows = await db.select().from(schema.subletListings).where(and(eq(schema.subletListings.ownerId, me.id), eq(schema.subletListings.status, "taken")));
      const paid: { listingId: string; amount: number }[] = [];
      const late: string[] = [];
      for (const l of rows) {
        const markup = l.ownMonthlyRent !== undefined && l.ownMonthlyRent !== null && l.monthlyPrice > l.ownMonthlyRent;
        const suspicion = Math.min(100, l.suspicion + 2 + (markup ? 4 : 0));
        await db.update(schema.subletListings).set({ suspicion }).where(eq(schema.subletListings.id, l.id));
        if (me.gameDay - l.lastRentDay < 7 || !l.tenantId) continue;
        const amount = Math.round((l.monthlyPrice * 7) / 30);
        const [tenant] = await db.select().from(schema.players).where(eq(schema.players.id, l.tenantId)).limit(1);
        if (!tenant || tenant.money < amount) {
          await db.update(schema.subletListings).set({ rentLate: 1 }).where(eq(schema.subletListings.id, l.id));
          late.push(String(l.id));
          continue;
        }
        await creditMoney(db, tenant.id, -amount, `sublet rent #${l.id}`);
        await creditMoney(db, me.id, amount, `sublet rent #${l.id}`);
        await db.update(schema.subletListings).set({ rentCollected: l.rentCollected + amount, lastRentDay: me.gameDay, rentLate: 0 }).where(eq(schema.subletListings.id, l.id));
        paid.push({ listingId: String(l.id), amount });
      }
      return { ok: true, paid, late };
    },
  }),

  getOverseasCatalog: defineAction({
    description: "The overseas shopping catalog (server copy of OVERSEAS_CATALOG).",
    request: z.object({}),
    response: z.object({ ok: z.boolean(), items: z.array(overseasItemShape) }),
    async handler() {
      return { ok: true, items: [...OVERSEAS_CATALOG] as unknown as z.infer<typeof overseasItemShape>[] };
    },
  }),

  placeOverseasOrder: defineAction({
    description: "Places an overseas order: charges goods + ¥25 shipping now (duty is assessed at customs and paid on arrival, never auto-deducted). Qty ≤ 5.",
    request: z.object({ playerId: pidZ, itemId: z.string().min(1).max(40), qty: z.number().int().min(1).max(5) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), order: overseasOrderShape.optional(), chargeNow: z.number().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      const item = OVERSEAS_CATALOG.find((i) => i.id === args.itemId);
      if (!item) return { ok: false, error: "这个海外商品下架了。" };
      const chargeNow = item.price * args.qty + 25;
      if (me.money < chargeNow) return { ok: false, error: "存款不够下这一单" };
      const goods = item.price * args.qty;
      const dutyDue = Math.round(Math.max(0, goods - 500) * item.dutyRate);
      const shipDays = item.shipDaysMin + Math.floor(Math.random() * (item.shipDaysMax - item.shipDaysMin + 1));
      await creditMoney(db, me.id, -chargeNow, `overseas order ${item.id} x${args.qty}`);
      const [row] = await db.insert(schema.overseasOrders).values({
        buyerId: me.id, itemId: item.id, itemJson: JSON.stringify(item), qty: args.qty,
        paidTotal: chargeNow, dutyDue, dutyPaid: 0, shipDays,
        orderedDay: me.gameDay, etaDay: me.gameDay + shipDays, status: "ordered", heldOnce: 0, createdAt: new Date(),
      }).returning();
      return { ok: true, order: row ? overseasOrderView(row, me.name) : undefined, chargeNow };
    },
  }),

  getOverseasOrders: defineAction({
    description: "The caller's overseas orders (statuses advanced lazily on read).",
    request: z.object({ playerId: pidZ }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), orders: z.array(overseasOrderShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER, orders: [] };
      if (me.banned) return { ok: false, error: BANNED_MSG, orders: [] };
      await advanceOverseasOrders(db, me.id, me.gameDay);
      const rows = await db.select().from(schema.overseasOrders).where(eq(schema.overseasOrders.buyerId, me.id)).orderBy(desc(schema.overseasOrders.id)).limit(50);
      return { ok: true, orders: rows.map((r) => overseasOrderView(r, me.name)) };
    },
  }),

  payOverseasDuty: defineAction({
    description: "Pays the customs duty on an order in customs/held; the order then arrives.",
    request: z.object({ playerId: pidZ, orderId: z.string().min(1).max(32) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), dutyPaid: z.number().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      const id = Number(args.orderId);
      if (!Number.isInteger(id)) return { ok: false, error: "这个订单找不到了。" };
      const [o] = await db.select().from(schema.overseasOrders).where(eq(schema.overseasOrders.id, id)).limit(1);
      if (!o || o.buyerId !== me.id) return { ok: false, error: "这个订单找不到了。" };
      if (o.status !== "customs" && o.status !== "held") return { ok: false, error: "这单现在不用补关税。" };
      const due = o.dutyDue - o.dutyPaid;
      if (due <= 0) return { ok: false, error: "关税已经付过了。" };
      if (me.money < due) return { ok: false, error: "存款不够付关税" };
      await creditMoney(db, me.id, -due, `overseas duty #${id}`);
      await db.update(schema.overseasOrders).set({ dutyPaid: o.dutyDue, status: "arrived" }).where(eq(schema.overseasOrders.id, id));
      return { ok: true, dutyPaid: due };
    },
  }),

  getFleaStock: defineAction({
    description: "The day's flea-market stock: cheap goods + used furniture, seeded by game day so the market rotates (server mirror of dailyCheapStock / dailyUsedFurnitureStock). Player listings mix in on top.",
    request: z.object({ city: cityZ, day: z.number().int().min(1).max(366) }),
    response: z.object({ ok: z.boolean(), cheap: z.array(cheapGoodShape), usedFurniture: z.array(usedFurnitureShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const cheap = dailyCheapStockServer(args.day);
      const npcUsed = dailyUsedFurnitureStockServer(args.day);
      const listed = await db.select().from(schema.usedFurnitureListings)
        .where(and(eq(schema.usedFurnitureListings.city, args.city), eq(schema.usedFurnitureListings.status, "open")))
        .orderBy(desc(schema.usedFurnitureListings.id)).limit(20);
      const playerUsed = listed.map((p) => ({
        id: `usedfurn-p-${p.id}`, baseId: p.baseId, name: p.name, emoji: p.emoji, room: p.room,
        condition: p.condition, price: p.price, newPrice: p.newPrice,
        seller: { playerId: p.sellerId, name: p.sellerName }, note: p.note, listedDay: p.listedDay,
      }));
      return { ok: true, cheap, usedFurniture: [...playerUsed, ...npcUsed] };
    },
  }),

  buyCheapGood: defineAction({
    description: "Buys a cheap good from today's flea stock (price verified against the server's day-seeded stock; buys ≤ ¥5,000 by construction). Repair/clean/resell stay local until a shared market exists.",
    request: z.object({ playerId: pidZ, goodId: z.string().min(1).max(40) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), good: cheapGoodShape.optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      const stock = dailyCheapStockServer(me.gameDay);
      const good = stock.find((g) => g.id === args.goodId);
      if (!good) return { ok: false, error: "这件货今天不在市集上，刷新一下再看看。" };
      if (good.buyPrice > 5000) return { ok: false, error: "超过 5000¥ 就不算「贱买」了。" };
      if (me.money < good.buyPrice) return { ok: false, error: "存款不够买这件" };
      await creditMoney(db, me.id, -good.buyPrice, `cheap good ${good.name}`);
      await db.insert(schema.cheapGoodsOwned).values({
        playerId: me.id, goodId: good.id, name: good.name, emoji: good.emoji, kind: good.kind,
        state: good.state, condition: good.condition, buyPrice: good.buyPrice, boughtDay: me.gameDay, createdAt: new Date(),
      });
      return { ok: true, good };
    },
  }),

  buyUsedFurniture: defineAction({
    description: "Buys a used furniture piece from today's flea stock (price verified against the server's day-seeded stock, or a player listing). The piece is recorded against the player so resale pricing works after reload.",
    request: z.object({ playerId: pidZ, pieceId: z.string().min(1).max(40) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), piece: usedFurnitureShape.optional(), furnitureIdToAdd: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      let piece: z.infer<typeof usedFurnitureShape> | undefined;
      if (args.pieceId.startsWith("usedfurn-p-")) {
        const id = Number(args.pieceId.replace("usedfurn-p-", ""));
        if (Number.isInteger(id)) {
          const [p] = await db.select().from(schema.usedFurnitureListings).where(eq(schema.usedFurnitureListings.id, id)).limit(1);
          if (p && p.status === "open") {
            piece = {
              id: args.pieceId, baseId: p.baseId, name: p.name, emoji: p.emoji, room: p.room,
              condition: p.condition, price: p.price, newPrice: p.newPrice,
              seller: { playerId: p.sellerId, name: p.sellerName }, note: p.note, listedDay: p.listedDay,
            };
          }
        }
      } else {
        piece = dailyUsedFurnitureStockServer(me.gameDay).find((p) => p.id === args.pieceId);
      }
      if (!piece) return { ok: false, error: "这件家具今天不在市集上，刷新一下再看看。" };
      if (piece.seller.playerId === me.id) return { ok: false, error: "不能买自己挂的家具。" };
      if (me.money < piece.price) return { ok: false, error: "存款不够买这件" };
      const [owned] = await db.select().from(schema.usedFurnitureOwned).where(and(eq(schema.usedFurnitureOwned.playerId, me.id), eq(schema.usedFurnitureOwned.pieceId, piece.id))).limit(1);
      if (owned) return { ok: false, error: "这件你已经买过了。" };
      await creditMoney(db, me.id, -piece.price, `used furniture ${piece.name}`);
      if (piece.seller.playerId !== "npc-flea") {
        await creditMoney(db, piece.seller.playerId, piece.price, `used furniture sale ${piece.name}`);
        const pid = Number(piece.id.replace("usedfurn-p-", ""));
        if (Number.isInteger(pid)) await db.update(schema.usedFurnitureListings).set({ status: "sold" }).where(eq(schema.usedFurnitureListings.id, pid));
      }
      await db.insert(schema.usedFurnitureOwned).values({
        playerId: me.id, pieceId: piece.id, baseId: piece.baseId, name: piece.name, emoji: piece.emoji,
        room: piece.room, condition: piece.condition, paidPrice: piece.price, createdAt: new Date(),
      });
      return { ok: true, piece, furnitureIdToAdd: piece.baseId ?? piece.id };
    },
  }),

  resellUsedFurniture: defineAction({
    description: "Resells a used piece the player owns. Price = paid × conditionNow / conditionThen (0% cut now).",
    request: z.object({ playerId: pidZ, pieceId: z.string().min(1).max(40), conditionNow: z.number().int().min(0).max(100) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), received: z.number().optional(), furnitureIdToRemove: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      const [owned] = await db.select().from(schema.usedFurnitureOwned).where(and(eq(schema.usedFurnitureOwned.playerId, me.id), eq(schema.usedFurnitureOwned.pieceId, args.pieceId))).limit(1);
      if (!owned) return { ok: false, error: "这件家具找不到了。" };
      const received = Math.max(0, Math.round(owned.paidPrice * (args.conditionNow / Math.max(1, owned.condition))));
      await db.delete(schema.usedFurnitureOwned).where(eq(schema.usedFurnitureOwned.id, owned.id));
      if (received > 0) await creditMoney(db, me.id, received, `used furniture resell ${owned.name}`);
      return { ok: true, received, furnitureIdToRemove: owned.baseId ?? owned.pieceId };
    },
  }),

  listUsedFurniture: defineAction({
    description: "Lists one of the player's own old furniture pieces on the flea market (shows in getFleaStock for the city).",
    request: z.object({
      playerId: pidZ, city: cityZ, baseId: z.string().max(40).nullable().optional(),
      name: z.string().trim().min(1).max(40), emoji: z.string().min(1).max(8), room: z.string().min(1).max(20),
      condition: z.number().int().min(1).max(100), price: z.number().int().min(1).max(100000),
      note: z.string().max(200).optional(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), piece: usedFurnitureShape.optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (me.cityKey !== args.city) return { ok: false, error: "只能在你所在的城市挂二手家具" };
      const open = await db.select({ n: sql<number>`count(*)` }).from(schema.usedFurnitureListings).where(and(eq(schema.usedFurnitureListings.sellerId, me.id), eq(schema.usedFurnitureListings.status, "open")));
      if (Number(open[0]?.n ?? 0) >= 10) return { ok: false, error: "你已经挂着 10 件二手家具了" };
      const newPrice = Math.max(args.price, Math.round(args.price / 0.25));
      const [row] = await db.insert(schema.usedFurnitureListings).values({
        city: args.city, sellerId: me.id, sellerName: me.name, baseId: args.baseId ?? null,
        name: cleanText(args.name).slice(0, 40), emoji: [...args.emoji][0] ?? "🪑", room: args.room,
        condition: args.condition, price: args.price, newPrice,
        note: cleanText(args.note ?? "").slice(0, 200), status: "open", listedDay: me.gameDay, createdAt: new Date(),
      }).returning();
      const piece = row ? {
        id: `usedfurn-p-${row.id}`, baseId: row.baseId, name: row.name, emoji: row.emoji, room: row.room,
        condition: row.condition, price: row.price, newPrice: row.newPrice,
        seller: { playerId: me.id, name: me.name }, note: row.note, listedDay: row.listedDay,
      } : undefined;
      return { ok: true, piece };
    },
  }),

  /* ---- round-2 (f): 躺平 / 三和 / 就业指导 ----
     No endpoint here moves real money. Money amounts (course allowance,
     trial pay) are computed server-side and returned for the client to
     apply to its local wallet, like other client-calculated earnings. */
  getLifestyle: defineAction({
    description: "Reads the player's lifestyle state (flat / Sanhe + guidance). Null on first run.",
    request: z.object({ playerId: pidZ }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), life: z.record(z.string(), z.any()).nullable(), updatedAt: z.number().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER, life: null };
      if (me.banned) return { ok: false, error: BANNED_MSG, life: null };
      const [row] = await db.select().from(schema.lifestyleStates).where(eq(schema.lifestyleStates.playerId, me.id)).limit(1);
      if (!row) return { ok: true, life: null };
      try { return { ok: true, life: JSON.parse(row.payload) as Record<string, unknown>, updatedAt: row.updatedAt.getTime() }; } catch { return { ok: true, life: null }; }
    },
  }),

  saveLifestyle: defineAction({
    description: "Saves the player's lifestyle state (flat / Sanhe + guidance). hope is clamped 0–100, moodCapBonus 0–15.",
    request: z.object({ playerId: pidZ, day: z.number().int().min(0).max(366), life: z.record(z.string(), z.any()) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      const life = { ...args.life } as Record<string, unknown>;
      const flat = life.flat as Record<string, unknown> | undefined;
      if (flat) {
        if (typeof flat.hope === "number") flat.hope = Math.max(0, Math.min(100, Math.round(flat.hope)));
        if (typeof flat.moodCapBonus === "number") flat.moodCapBonus = Math.max(0, Math.min(15, Math.round(flat.moodCapBonus)));
      }
      await saveLife(db, me.id, life);
      return { ok: true };
    },
  }),

  listJobBoard: defineAction({
    description: "The ladder job board (14 server-mirrored listings) + open player-issued gigs for the city.",
    request: z.object({ city: cityZ, playerId: pidZ.optional() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), listings: z.array(jobListingShape), playerGigs: z.array(z.object({ id: z.string(), title: z.string(), pay: z.number(), employerName: z.string() })) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = args.playerId ? await r2Player(db, args.playerId) : undefined;
      if (args.playerId && !me) return { ok: false, error: NO_PLAYER, listings: [], playerGigs: [] };
      if (me?.banned) return { ok: false, error: BANNED_MSG, listings: [], playerGigs: [] };
      const listings = JOB_LADDER_SERVER.map((l) => ({
        id: l.id, rung: l.rung, emoji: l.emoji,
        title: [...l.title] as [string, string],
        desc: [...l.desc] as [string, string],
        payDay: l.payDay,
        cityMul: l.cityMul ? { ...l.cityMul } : undefined,
        ...("identityId" in l ? { identityId: l.identityId } : {}),
        requires: { ...l.requires },
        ...("daysToPermanent" in l ? { daysToPermanent: l.daysToPermanent } : {}),
        path: [...l.path] as [string, string],
        tags: [...l.tags],
      }));
      const gigRows = await db.select().from(schema.gigs).where(and(eq(schema.gigs.city, args.city), eq(schema.gigs.status, "open"))).orderBy(desc(schema.gigs.createdAt)).limit(20);
      const playerGigs = await Promise.all(gigRows.map(async (g) => {
        const [emp] = await db.select().from(schema.players).where(eq(schema.players.id, g.employerId)).limit(1);
        return { id: String(g.id), title: g.title, pay: g.pay, employerName: emp?.name ?? g.employerId };
      }));
      return {
        ok: true, listings, playerGigs,
      };
    },
  }),

  applyJob: defineAction({
    description: "Applies for a ladder job (one application per listing; re-applying after a trial is rejected).",
    request: z.object({ playerId: pidZ, listingId: z.string().min(1).max(40), day: z.number().int().min(0).max(366) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), application: z.object({ listingId: z.string(), day: z.number(), status: z.enum(["applied", "trial", "hired", "left"]) }).optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (socialNeedsAccount() && !me.accountId) return { ok: false, error: "先绑定账号，才能投简历" };
      const listing = JOB_LADDER_SERVER.find((l) => l.id === args.listingId);
      if (!listing) return { ok: false, error: "这个岗位找不到了。" };
      const existing = await db.select().from(schema.jobApplications).where(and(eq(schema.jobApplications.playerId, me.id), eq(schema.jobApplications.listingId, args.listingId))).limit(1);
      if (existing.length) return { ok: false, error: "你已经投过这个岗位了。" };
      const [row] = await db.insert(schema.jobApplications).values({ playerId: me.id, listingId: args.listingId, day: args.day, status: "applied", createdAt: new Date() }).returning();
      return { ok: true, application: row ? { listingId: row.listingId, day: row.day, status: row.status as "applied" } : undefined };
    },
  }),

  bookGuidance: defineAction({
    description: "Books a career-guidance session (counselor route). Logged for the counselor's follow-up.",
    request: z.object({ playerId: pidZ, routeId: z.string().min(1).max(40) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), route: counselorRouteShape.optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      const route = COUNSELOR_ROUTES_SERVER.find((r) => r.id === args.routeId);
      if (!route) return { ok: false, error: "这个指导路线找不到了。" };
      await db.insert(schema.guidanceSessions).values({ playerId: me.id, routeId: route.id, createdAt: new Date() });
      return {
        ok: true,
        route: {
          id: route.id, emoji: route.emoji,
          title: [...route.title] as [string, string],
          basedOn: [...route.basedOn] as [string, string],
          steps: route.steps.map((s) => [...s] as [string, string]),
        },
      };
    },
  }),

  enrollCourse: defineAction({
    description: "Enrolls in a free skill course (one active at a time; already-done courses can't repeat).",
    request: z.object({ playerId: pidZ, courseId: z.string().min(1).max(40), day: z.number().int().min(0).max(366) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      const course = COURSES_SERVER[args.courseId];
      if (!course) return { ok: false, error: "这门课找不到了。" };
      const rows = await db.select().from(schema.courseEnrollments).where(eq(schema.courseEnrollments.playerId, me.id));
      if (rows.some((r) => r.done === 0)) return { ok: false, error: "你已经在上另一门课了，结课后再报。" };
      if (rows.some((r) => r.courseId === args.courseId && r.done === 1)) return { ok: false, error: "这门课你已经结课了。" };
      await db.insert(schema.courseEnrollments).values({ playerId: me.id, courseId: args.courseId, startDay: args.day, days: 0, done: 0, allowancePaid: 0, createdAt: new Date() });
      return { ok: true };
    },
  }),

  courseDay: defineAction({
    description: "Records one course day (idempotent per player+course+day). Returns the ¥30/day allowance for the client to apply — server-computed, not a ledger credit. On the last day, the course is marked done and the skill gain is returned.",
    request: z.object({ playerId: pidZ, courseId: z.string().min(1).max(40), day: z.number().int().min(0).max(366) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), allowance: z.number().optional(), done: z.boolean().optional(), skillGain: z.number().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      const course = COURSES_SERVER[args.courseId];
      if (!course) return { ok: false, error: "这门课找不到了。" };
      const [enroll] = await db.select().from(schema.courseEnrollments).where(and(eq(schema.courseEnrollments.playerId, me.id), eq(schema.courseEnrollments.courseId, args.courseId))).limit(1);
      if (!enroll) return { ok: false, error: "你还没报这门课。" };
      if (enroll.done === 1) return { ok: false, error: "这门课你已经结课了。" };
      try {
        await db.insert(schema.courseAllowanceDays).values({ playerId: me.id, courseId: args.courseId, day: args.day, createdAt: new Date() });
      } catch {
        return { ok: false, error: "今天这门课的补贴已经领过了。" };
      }
      const daysDone = enroll.days + 1;
      const done = daysDone >= course.days;
      await db.update(schema.courseEnrollments).set({ days: daysDone, done: done ? 1 : 0, allowancePaid: enroll.allowancePaid + course.allowanceDay }).where(and(eq(schema.courseEnrollments.playerId, me.id), eq(schema.courseEnrollments.courseId, args.courseId)));
      return { ok: true, allowance: course.allowanceDay, done, skillGain: done ? course.skillGain : 0 };
    },
  }),

  mockInterview: defineAction({
    description: "Records a mock interview (score 0–6); gain = 8 + score×2, stored in the lifestyle state. No penalty path.",
    request: z.object({ playerId: pidZ, score: z.number().int().min(0).max(6), day: z.number().int().min(0).max(366) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), interviewReady: z.number().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      const life = (await loadLife(db, me.id)) ?? { flat: {}, sanhe: {} };
      const flat = life.flat;
      const interviews = (typeof flat.interviews === "number" ? flat.interviews : 0) + 1;
      const ready = Math.max(0, Math.min(100, (typeof flat.interviewReady === "number" ? flat.interviewReady : 0) + 8 + args.score * 2));
      flat.interviews = interviews; flat.interviewReady = ready; life.flat = flat;
      await saveLife(db, me.id, life);
      return { ok: true, interviewReady: ready };
    },
  }),

  startTrial: defineAction({
    description: "Starts a trial shift for a ladder job (needs a prior application; no concurrent active trial; interviewReady gate from the listing).",
    request: z.object({ playerId: pidZ, listingId: z.string().min(1).max(40), day: z.number().int().min(0).max(366) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), trialId: z.number().optional(), requiredReady: z.number().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      const listing = JOB_LADDER_SERVER.find((l) => l.id === args.listingId);
      if (!listing) return { ok: false, error: "这个岗位找不到了。" };
      const [app] = await db.select().from(schema.jobApplications).where(and(eq(schema.jobApplications.playerId, me.id), eq(schema.jobApplications.listingId, args.listingId))).limit(1);
      if (!app) return { ok: false, error: "先投简历，才能去试岗。" };
      if (app.status === "trial") return { ok: false, error: "你已经在试这个岗位了。" };
      if (app.status === "hired" || app.status === "left") return { ok: false, error: "这个岗位已经走完了。" };
      const active = await db.select().from(schema.trials).where(and(eq(schema.trials.playerId, me.id), eq(schema.trials.status, "active"))).limit(1);
      if (active.length) return { ok: false, error: "你已经在试岗了，先做完当前试岗。" };
      const life = (await loadLife(db, me.id)) ?? { flat: {}, sanhe: {} };
      const flat = life.flat;
      const ready = typeof flat.interviewReady === "number" ? flat.interviewReady : 0;
      const reqRaw = (listing.requires as { interviewReady?: unknown }).interviewReady;
      const req = typeof reqRaw === "number" ? reqRaw : 0;
      if (ready < req) return { ok: false, error: `面试准备还不够（${ready}/${req}），先练练模拟面试再来。`, requiredReady: req };
      const [row] = await db.insert(schema.trials).values({ playerId: me.id, listingId: args.listingId, startDay: args.day, daysWorked: 0, totalScore: 0, status: "active", createdAt: new Date() }).returning();
      await db.update(schema.jobApplications).set({ status: "trial" }).where(eq(schema.jobApplications.id, app.id));
      return { ok: true, trialId: row?.id, requiredReady: req };
    },
  }),

  trialDay: defineAction({
    description: "Records one trial day (idempotent per trial+day). Returns the server-computed daily pay for the client to apply.",
    request: z.object({ playerId: pidZ, listingId: z.string().min(1).max(40), score: z.number().int().min(0).max(100), day: z.number().int().min(0).max(366) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), daysWorked: z.number().optional(), pay: z.number().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      const listing = JOB_LADDER_SERVER.find((l) => l.id === args.listingId);
      if (!listing) return { ok: false, error: "这个岗位找不到了。" };
      const [trial] = await db.select().from(schema.trials).where(and(eq(schema.trials.playerId, me.id), eq(schema.trials.listingId, args.listingId), eq(schema.trials.status, "active"))).limit(1);
      if (!trial) return { ok: false, error: "你没有在进行的试岗。" };
      try {
        await db.insert(schema.trialDays).values({ trialId: trial.id, day: args.day, score: args.score, createdAt: new Date() });
      } catch {
        return { ok: false, error: "今天这一天的试岗已经记过了。" };
      }
      const pay = listingPayServer(listing, me.cityKey);
      await db.update(schema.trials).set({ daysWorked: trial.daysWorked + 1, totalScore: trial.totalScore + args.score }).where(eq(schema.trials.id, trial.id));
      return { ok: true, daysWorked: trial.daysWorked + 1, pay };
    },
  }),

  resolveTrial: defineAction({
    description: "Resolves a trial (needs ≥ 3 days). Hired iff average score ≥ 60. A failed trial records NO black mark anywhere.",
    request: z.object({ playerId: pidZ, listingId: z.string().min(1).max(40) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), hired: z.boolean().optional(), avgScore: z.number().optional(), identityId: z.string().nullable().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      const listing = JOB_LADDER_SERVER.find((l) => l.id === args.listingId);
      if (!listing) return { ok: false, error: "这个岗位找不到了。" };
      const [trial] = await db.select().from(schema.trials).where(and(eq(schema.trials.playerId, me.id), eq(schema.trials.listingId, args.listingId), eq(schema.trials.status, "active"))).limit(1);
      if (!trial) return { ok: false, error: "你没有在进行的试岗。" };
      if (trial.daysWorked < 3) return { ok: false, error: `试岗还差 ${3 - trial.daysWorked} 天才能出结果。` };
      const avg = Math.round(trial.totalScore / trial.daysWorked);
      const hired = avg >= 60;
      await db.update(schema.trials).set({ status: hired ? "hired" : "left" }).where(eq(schema.trials.id, trial.id));
      const [app] = await db.select().from(schema.jobApplications).where(and(eq(schema.jobApplications.playerId, me.id), eq(schema.jobApplications.listingId, args.listingId))).limit(1);
      if (app) await db.update(schema.jobApplications).set({ status: hired ? "hired" : "left" }).where(eq(schema.jobApplications.id, app.id));
      return { ok: true, hired, avgScore: avg, identityId: hired ? ((listing as { identityId?: string }).identityId ?? null) : null };
    },
  }),

  postFlatGig: defineAction({
    description: "Posts a lying-flat side gig (help/work, pay ≥ 0).",
    request: z.object({ playerId: pidZ, city: cityZ.optional(), title: z.string().trim().min(1).max(40), desc: z.string().trim().max(200), pay: z.number().int().min(0).max(100000), kind: z.enum(["help", "work"]) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), gigId: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (socialNeedsAccount() && !me.accountId) return { ok: false, error: "先绑定账号，才能发小活" };
      const city = args.city ?? me.cityKey;
      if (city !== me.cityKey) return { ok: false, error: "只能在你所在的城市发小活" };
      const open = await db.select({ n: sql<number>`count(*)` }).from(schema.flatGigs).where(and(eq(schema.flatGigs.posterId, me.id), eq(schema.flatGigs.status, "open")));
      if (Number(open[0]?.n ?? 0) >= 10) return { ok: false, error: "你已经挂着 10 个小活了" };
      const [row] = await db.insert(schema.flatGigs).values({
        city, posterId: me.id, posterName: me.name,
        title: cleanText(args.title).slice(0, 40), desc: cleanText(args.desc).slice(0, 200),
        pay: args.pay, kind: args.kind, status: "open", createdAt: new Date(),
      }).returning();
      return { ok: true, gigId: row ? String(row.id) : undefined };
    },
  }),

  listFlatGigs: defineAction({
    description: "Lists open lying-flat side gigs for a city.",
    request: z.object({ city: cityZ, playerId: pidZ.optional() }),
    response: z.object({
      ok: z.boolean(), error: z.string().optional(),
      gigs: z.array(z.object({ id: z.string(), title: z.string(), desc: z.string(), pay: z.number(), kind: z.enum(["help", "work"]), poster: z.object({ id: z.string(), name: z.string(), emoji: z.string() }) })),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = args.playerId ? await r2Player(db, args.playerId) : undefined;
      if (args.playerId && !me) return { ok: false, error: NO_PLAYER, gigs: [] };
      if (me?.banned) return { ok: false, error: BANNED_MSG, gigs: [] };
      const rows = await db.select().from(schema.flatGigs).where(and(eq(schema.flatGigs.city, args.city), eq(schema.flatGigs.status, "open"))).orderBy(desc(schema.flatGigs.id)).limit(50);
      return {
        ok: true,
        gigs: await Promise.all(rows.map(async (g) => {
          const [poster] = await db.select().from(schema.players).where(eq(schema.players.id, g.posterId)).limit(1);
          return { id: String(g.id), title: g.title, desc: g.desc, pay: g.pay, kind: g.kind as "help" | "work", poster: { id: g.posterId, name: g.posterName, emoji: poster?.emoji ?? "🧑" } };
        })),
      };
    },
  }),

  takeFlatGig: defineAction({
    description: "Takes an open lying-flat gig (not your own; one taker, atomic).",
    request: z.object({ playerId: pidZ, gigId: z.string().min(1).max(32) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      const id = Number(args.gigId);
      if (!Number.isInteger(id)) return { ok: false, error: "这个小活找不到了。" };
      const [g] = await db.select().from(schema.flatGigs).where(eq(schema.flatGigs.id, id)).limit(1);
      if (!g) return { ok: false, error: "这个小活找不到了。" };
      if (g.status !== "open") return { ok: false, error: "这个小活已经有人接了 / 已经结束" };
      if (g.posterId === me.id) return { ok: false, error: "不能接自己的小活" };
      if (me.cityKey !== g.city) return { ok: false, error: "只能接你所在城市的小活" };
      const changed = await db.update(schema.flatGigs).set({ status: "taken", takerId: me.id }).where(and(eq(schema.flatGigs.id, id), eq(schema.flatGigs.status, "open"))).returning();
      if (!changed.length) return { ok: false, error: "这个小活已经有人接了" };
      return { ok: true };
    },
  }),

  completeFlatGig: defineAction({
    description: "EXTRA (not in the client spec): marks a taken flat gig done, so the taker/poster can close the loop. gigAction only works on the main gigs table.",
    request: z.object({ playerId: pidZ, gigId: z.string().min(1).max(32) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      const id = Number(args.gigId);
      if (!Number.isInteger(id)) return { ok: false, error: "这个小活找不到了。" };
      const [g] = await db.select().from(schema.flatGigs).where(eq(schema.flatGigs.id, id)).limit(1);
      if (!g) return { ok: false, error: "这个小活找不到了。" };
      if (g.status !== "taken") return { ok: false, error: "这个小活还没人接 / 已经结束了。" };
      if (g.posterId !== me.id && g.takerId !== me.id) return { ok: false, error: "只有发活的人或接活的人能确认完成。" };
      await db.update(schema.flatGigs).set({ status: "done" }).where(eq(schema.flatGigs.id, id));
      return { ok: true };
    },
  }),

  openStall: defineAction({
    description: "Opens a street stall (one per player).",
    request: z.object({ playerId: pidZ, kind: z.string().min(1).max(20), day: z.number().int().min(0).max(366) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), stall: z.object({ kind: z.string(), day: z.number(), lvl: z.number() }).optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (!STALL_KINDS_SERVER.includes(args.kind as (typeof STALL_KINDS_SERVER)[number])) return { ok: false, error: "这个摊位类型还没有，换个试试" };
      const kind = args.kind as (typeof STALL_KINDS_SERVER)[number];
      const [existing] = await db.select().from(schema.stalls).where(eq(schema.stalls.playerId, me.id)).limit(1);
      if (existing) return { ok: false, error: "你已经有摊位了" };
      await db.insert(schema.stalls).values({ playerId: me.id, city: me.cityKey, kind, day: args.day, lvl: 1, createdAt: new Date() });
      return { ok: true, stall: { kind, day: args.day, lvl: 1 } };
    },
  }),

  /* ---- round-3 (g): 玩家警察巡逻 + 监视 ----
     Server side of client/src/round2/police.ts. Replaces the in-memory
     watchers Map: patrols and watches are rows, so 👁️ is visible across
     sessions. Watching alone does nothing — consequences need a filed
     report through (d) (fileBlackReport / reportPlayer). This block sits
     where reportLandlord was (round-3: deleted, see ROUND3-LOG-S.md). */
  startPatrol: defineAction({
    description: "Starts a police patrol in the caller's city (one active patrol per officer; starting again refreshes it). Server-side, so other players can see the 👁️.",
    request: z.object({ playerId: pidZ, city: cityZ }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), patrol: z.object({ officerId: z.string(), officerName: z.string(), city: z.string(), since: z.string() }).optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (me.cityKey !== args.city) return { ok: false, error: "只能在你所在的城市巡逻" };
      await expirePatrols(db);
      const now = new Date();
      await db.insert(schema.patrols).values({ officerId: me.id, city: args.city, startedAt: now })
        .onConflictDoUpdate({ target: schema.patrols.officerId, set: { city: args.city, startedAt: now } });
      return { ok: true, patrol: { officerId: me.id, officerName: me.name, city: args.city, since: now.toISOString() } };
    },
  }),

  stopPatrol: defineAction({
    description: "Ends the caller's patrol — and every observation it opened, so no watch lingers after the patrol.",
    request: z.object({ playerId: pidZ }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      await db.delete(schema.patrolWatches).where(eq(schema.patrolWatches.officerId, me.id));
      await db.delete(schema.patrols).where(eq(schema.patrols.officerId, me.id));
      return { ok: true };
    },
  }),

  observe: defineAction({
    description: "Starts watching a game avatar (player id or NPC slug) while on patrol. Avatar ids only — emails, phone numbers and real names are rejected. The watched player can see this via getWatchers.",
    request: z.object({ playerId: pidZ, targetId: z.string().min(1).max(48), note: z.string().max(200).optional() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), watch: z.object({ officerId: z.string(), targetId: z.string(), note: z.string(), city: z.string(), startedAt: z.string() }).optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      const patrol = await activePatrol(db, me.id);
      if (!patrol) return { ok: false, error: "先开始巡逻，才能观察。" };
      if (!isGameAvatarId(args.targetId)) return { ok: false, error: "只能观察游戏里的玩家 / NPC，不能填真实身份。" };
      if (args.targetId === me.id) return { ok: false, error: "不能观察自己。" };
      // A known player in another city can't be watched from this patrol;
      // NPC slugs (not in the players table) are accepted on the slug rule.
      const [target] = await db.select().from(schema.players).where(eq(schema.players.id, args.targetId)).limit(1);
      if (target && target.cityKey !== patrol.city) return { ok: false, error: "这个人不在你巡逻的城市。" };
      const [existing] = await db.select().from(schema.patrolWatches).where(and(eq(schema.patrolWatches.officerId, me.id), eq(schema.patrolWatches.targetId, args.targetId))).limit(1);
      if (existing) return { ok: false, error: "已经在观察这个人了。" };
      const now = new Date();
      const note = cleanText(args.note ?? "").slice(0, 200);
      await db.insert(schema.patrolWatches).values({ officerId: me.id, targetId: args.targetId, note, city: patrol.city, startedAt: now });
      return { ok: true, watch: { officerId: me.id, targetId: args.targetId, note, city: patrol.city, startedAt: now.toISOString() } };
    },
  }),

  stopObserving: defineAction({
    description: "Stops watching one avatar.",
    request: z.object({ playerId: pidZ, targetId: z.string().min(1).max(48) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      await db.delete(schema.patrolWatches).where(and(eq(schema.patrolWatches.officerId, me.id), eq(schema.patrolWatches.targetId, args.targetId)));
      return { ok: true };
    },
  }),

  getWatchers: defineAction({
    description: "Who is watching the caller right now (officer name + note + city + since) — the watched player always sees this; surveillance is never secret. No banned check on purpose: a restricted player still gets to see who is watching them.",
    request: z.object({ playerId: pidZ }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), watchers: z.array(z.object({ officerId: z.string(), officerName: z.string(), officerEmoji: z.string(), note: z.string(), city: z.string(), startedAt: z.string() })) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER, watchers: [] };
      await expirePatrols(db);
      const rows = await db.select().from(schema.patrolWatches).where(eq(schema.patrolWatches.targetId, me.id)).orderBy(desc(schema.patrolWatches.startedAt));
      const watchers = [];
      for (const w of rows) {
        const [officer] = await db.select().from(schema.players).where(eq(schema.players.id, w.officerId)).limit(1);
        watchers.push({ officerId: w.officerId, officerName: officer?.name ?? w.officerId, officerEmoji: officer?.emoji ?? "🙂", note: w.note, city: w.city, startedAt: w.startedAt.toISOString() });
      }
      return { ok: true, watchers };
    },
  }),

  sanheShiftLog: defineAction({
    description: "Logs a Sanhe day-labor shift (one per day; pay must equal round(sanhePay(city) × shift multiplier) — anti-cheat only, no money moves here, the client pays itself).",
    request: z.object({ playerId: pidZ, shiftId: z.string().min(1).max(40), pay: z.number().int().min(0).max(10000), day: z.number().int().min(0).max(366) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      const payMul = SANHE_SHIFTS_SERVER[args.shiftId];
      if (payMul === undefined) return { ok: false, error: "这个工种找不到了。" };
      const expected = Math.round(sanhePayServer(me.cityKey) * payMul);
      if (args.pay !== expected) return { ok: false, error: `工资不对：今天这单应该是 ${expected}¥。` };
      try {
        await db.insert(schema.sanheShiftLogs).values({ playerId: me.id, day: args.day, shiftId: args.shiftId, pay: args.pay, city: me.cityKey, createdAt: new Date() });
      } catch {
        return { ok: false, error: "今天这单已经结过了。" };
      }
      return { ok: true };
    },
  }),

  /* ---- round-2 (h): 跑腿接单池 ----
     The riderFee is escrowed at publish time (tradeEscrow kind "delivery"),
     so pool orders have real money to split. Late delivery pays 70% of the
     fee, the remaining 30% is refunded to the customer. Rating is stored
     ×100 (5.00 = 500). Delivery distance: the server has no place
     coordinates, so distance is stored/returned as 0 and the client must
     compute it from its own place data. */
  deliveryPoolPublish: defineAction({
    description: "Publishes a delivery order to the pool (max 2 open per player). The riderFee is escrowed immediately (dedicated ledger, not sendGift).",
    request: z.object({
      playerId: pidZ, city: cityZ,
      order: z.object({
        platformId: z.string().min(1).max(40), restaurantId: z.string().min(1).max(80),
        restaurantName: z.string().min(1).max(60), items: z.array(z.object({ name: z.string().min(1).max(40), qty: z.number().int().min(1).max(99) })).min(1).max(20),
        total: z.number().int().min(1).max(100000), riderFee: z.number().int().min(3).max(10000),
        destLabel: z.string().min(1).max(60), placedAt: z.number().int().min(0), destId: z.string().max(80).optional(),
      }),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), poolId: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (me.cityKey !== args.city) return { ok: false, error: "只能在你所在的城市发跑腿单" };
      if (me.money < args.order.riderFee) return { ok: false, error: "存款不够付跑腿费" };
      const open = await db.select({ n: sql<number>`count(*)` }).from(schema.deliveryPoolOrders).where(and(eq(schema.deliveryPoolOrders.customerId, me.id), eq(schema.deliveryPoolOrders.status, "open")));
      if (Number(open[0]?.n ?? 0) >= 2) return { ok: false, error: "你已经挂着 2 单跑腿了，送完再发。" };
      const now = new Date();
      const [row] = await db.insert(schema.deliveryPoolOrders).values({
        city: args.city, customerId: me.id, customerName: me.name,
        platformId: args.order.platformId, restaurantId: args.order.restaurantId, restaurantName: cleanText(args.order.restaurantName).slice(0, 60),
        itemsJson: JSON.stringify(args.order.items), total: args.order.total, riderFee: args.order.riderFee,
        destId: args.order.destId ?? null, destName: cleanText(args.order.destLabel).slice(0, 60),
        distance: 0,
        status: "open", deadlineAt: new Date(now.getTime() + 10 * 60 * 1000), createdAt: now,
      }).returning();
      if (!row) return { ok: false, error: "发单失败，稍后再试。" };
      await creditMoney(db, me.id, -args.order.riderFee, `delivery escrow #${row.id}`);
      await db.insert(schema.tradeEscrow).values({ taskId: row.id, kind: "delivery", payerId: me.id, amount: args.order.riderFee, status: "held", createdAt: now });
      return { ok: true, poolId: String(row.id) };
    },
  }),

  deliveryPoolList: defineAction({
    description: "Lists open pool orders for a city (overdue ones expire first, refunding the escrowed riderFee).",
    request: z.object({ playerId: pidZ, city: cityZ }),
    response: z.object({
      ok: z.boolean(), error: z.string().optional(),
      open: z.array(z.object({
        id: z.string(), restaurantId: z.string(), restaurantName: z.string(),
        destId: z.string().nullable(), destName: z.string(), distance: z.number(),
        riderFee: z.number(), customerName: z.string(), deadlineAt: z.number(),
      })),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER, open: [] };
      if (me.banned) return { ok: false, error: BANNED_MSG, open: [] };
      if (me.cityKey !== args.city) return { ok: false, error: "只能看你所在城市的接单池", open: [] };
      await expirePoolOrders(db, args.city);
      const rows = await db.select().from(schema.deliveryPoolOrders)
        .where(and(eq(schema.deliveryPoolOrders.city, args.city), eq(schema.deliveryPoolOrders.status, "open"), sql`${schema.deliveryPoolOrders.deadlineAt} > ${Date.now()}`, sql`${schema.deliveryPoolOrders.customerId} != ${me.id}`))
        .orderBy(desc(schema.deliveryPoolOrders.id)).limit(20);
      return {
        ok: true,
        open: rows.map((r) => ({
          id: String(r.id), restaurantId: r.restaurantId, restaurantName: r.restaurantName,
          destId: r.destId, destName: r.destName, distance: r.distance, riderFee: r.riderFee,
          customerName: r.customerName, deadlineAt: r.deadlineAt.getTime(),
        })),
      };
    },
  }),

  deliveryPoolClaim: defineAction({
    description: "Claims an open pool order (not your own; max 2 taken at once).",
    request: z.object({ playerId: pidZ, city: cityZ, poolId: z.string().min(1).max(32) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (socialNeedsAccount() && !me.accountId) return { ok: false, error: "先绑定账号，才能接跑腿单" };
      if (me.cityKey !== args.city) return { ok: false, error: "只能接你所在城市的单" };
      const id = Number(args.poolId);
      if (!Number.isInteger(id)) return { ok: false, error: "这单找不到了。" };
      const [o] = await db.select().from(schema.deliveryPoolOrders).where(eq(schema.deliveryPoolOrders.id, id)).limit(1);
      if (!o) return { ok: false, error: "这单找不到了。" };
      if (o.status !== "open" || o.deadlineAt.getTime() <= Date.now()) return { ok: false, error: "这单已经过期 / 被接走了。" };
      if (o.customerId === me.id) return { ok: false, error: "不能接自己的单" };
      const taken = await db.select({ n: sql<number>`count(*)` }).from(schema.deliveryPoolOrders).where(and(eq(schema.deliveryPoolOrders.riderId, me.id), sql`${schema.deliveryPoolOrders.status} IN ('taken', 'pickedUp')`));
      if (Number(taken[0]?.n ?? 0) >= 2) return { ok: false, error: "你手上已经有 2 单在跑了，送完再接。" };
      const changed = await db.update(schema.deliveryPoolOrders).set({ status: "taken", riderId: me.id, riderName: me.name, takenAt: new Date() }).where(and(eq(schema.deliveryPoolOrders.id, id), eq(schema.deliveryPoolOrders.status, "open"))).returning();
      if (!changed.length) return { ok: false, error: "这单已经被别人接了。" };
      return { ok: true };
    },
  }),

  deliveryPoolPickedUp: defineAction({
    description: "Marks a taken pool order as picked up (rider only).",
    request: z.object({ playerId: pidZ, poolId: z.string().min(1).max(32) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      const id = Number(args.poolId);
      if (!Number.isInteger(id)) return { ok: false, error: "这单找不到了。" };
      const [o] = await db.select().from(schema.deliveryPoolOrders).where(eq(schema.deliveryPoolOrders.id, id)).limit(1);
      if (!o || o.riderId !== me.id) return { ok: false, error: "这单找不到了。" };
      if (o.status !== "taken") return { ok: false, error: "这单现在不能取餐。" };
      await db.update(schema.deliveryPoolOrders).set({ status: "pickedUp" }).where(eq(schema.deliveryPoolOrders.id, id));
      return { ok: true };
    },
  }),

  deliveryPoolDelivered: defineAction({
    description: "Marks a pool order delivered (rider only). On-time pays the full riderFee; late pays 70% (the other 30% is refunded to the customer). Plus a 25% chance of a ¥3–10 tip.",
    request: z.object({ playerId: pidZ, poolId: z.string().min(1).max(32), stars: z.number().int().min(1).max(5).optional() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), pay: z.number().optional(), tip: z.number().optional(), onTime: z.boolean().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      const id = Number(args.poolId);
      if (!Number.isInteger(id)) return { ok: false, error: "这单找不到了。" };
      const [o] = await db.select().from(schema.deliveryPoolOrders).where(eq(schema.deliveryPoolOrders.id, id)).limit(1);
      if (!o || o.riderId !== me.id) return { ok: false, error: "这单找不到了。" };
      if (o.status !== "taken" && o.status !== "pickedUp") return { ok: false, error: "这单已经送达 / 已经结束了。" };
      const onTime = Date.now() <= o.deadlineAt.getTime();
      const pay = onTime ? o.riderFee : Math.round(o.riderFee * 0.7);
      const tip = Math.random() < 0.25 ? 3 + Math.floor(Math.random() * 8) : 0;
      const [row] = await db.update(schema.deliveryPoolOrders).set({ status: "delivered", deliveredAt: new Date(), tip }).where(and(eq(schema.deliveryPoolOrders.id, id), sql`${schema.deliveryPoolOrders.status} IN ('taken', 'pickedUp')`)).returning();
      if (!row) return { ok: false, error: "这单已经送达 / 已经结束了。" };
      const [esc] = await db.select().from(schema.tradeEscrow).where(and(eq(schema.tradeEscrow.taskId, id), eq(schema.tradeEscrow.kind, "delivery"), eq(schema.tradeEscrow.status, "held"))).limit(1);
      if (esc) {
        await db.update(schema.tradeEscrow).set({ status: "released", releasedAt: new Date() }).where(eq(schema.tradeEscrow.id, esc.id));
        await creditMoney(db, me.id, pay + tip, `delivery pay #${id}`);
        if (o.riderFee - pay > 0) await creditMoney(db, o.customerId, o.riderFee - pay, `delivery late refund #${id}`);
      } else {
        await creditMoney(db, me.id, pay + tip, `delivery pay #${id}`);
      }
      const [rider] = await db.select().from(schema.deliveryRiders).where(eq(schema.deliveryRiders.playerId, me.id)).limit(1);
      if (rider) {
        await db.update(schema.deliveryRiders).set({
          completed: rider.completed + 1, onTime: rider.onTime + (onTime ? 1 : 0),
          late: rider.late + (onTime ? 0 : 1), totalEarned: rider.totalEarned + pay + tip,
        }).where(eq(schema.deliveryRiders.playerId, me.id));
      } else {
        await db.insert(schema.deliveryRiders).values({
          playerId: me.id, completed: 1, onTime: onTime ? 1 : 0, late: onTime ? 0 : 1,
          totalEarned: pay + tip, rating: 500, updatedAt: new Date(),
        });
      }
      return { ok: true, pay, tip, onTime };
    },
  }),

  deliveryPoolRate: defineAction({
    description: "The customer rates a delivered pool order once (within 24h). 5★ +0.02 / 4★ +0.01 / 3★ −0.05 / ≤2★ −0.12, rider rating clamped to 3.0–5.0.",
    request: z.object({ playerId: pidZ, poolId: z.string().min(1).max(32), stars: z.number().int().min(1).max(5) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), riderRating: z.number().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      const id = Number(args.poolId);
      if (!Number.isInteger(id)) return { ok: false, error: "这单找不到了。" };
      const [o] = await db.select().from(schema.deliveryPoolOrders).where(eq(schema.deliveryPoolOrders.id, id)).limit(1);
      if (!o || o.customerId !== me.id) return { ok: false, error: "这单找不到了。" };
      if (o.status !== "delivered") return { ok: false, error: "这单还没送达，没法评价。" };
      if (o.stars !== null) return { ok: false, error: "你已经评价过这单了。" };
      if (o.deliveredAt && Date.now() - o.deliveredAt.getTime() > 24 * 60 * 60 * 1000) return { ok: false, error: "评价时间已经过了（24 小时内）。" };
      await db.update(schema.deliveryPoolOrders).set({ stars: args.stars }).where(eq(schema.deliveryPoolOrders.id, id));
      let rating = 5;
      if (o.riderId) {
        const [rider] = await db.select().from(schema.deliveryRiders).where(eq(schema.deliveryRiders.playerId, o.riderId)).limit(1);
        const delta = args.stars === 5 ? 2 : args.stars === 4 ? 1 : args.stars === 3 ? -5 : -12;
        const current = rider ? rider.rating : 500;
        const next = Math.max(300, Math.min(500, current + delta));
        if (rider) await db.update(schema.deliveryRiders).set({ rating: next }).where(eq(schema.deliveryRiders.playerId, o.riderId));
        else await db.insert(schema.deliveryRiders).values({ playerId: o.riderId, completed: 0, onTime: 0, late: 0, totalEarned: 0, rating: next, updatedAt: new Date() });
        rating = next / 100;
      }
      return { ok: true, riderRating: rating };
    },
  }),

  deliverySponsorSlot: defineAction({
    description: "Admin-only: buys a sponsored-restaurant slot for a city (a sponsored restaurant appears in the pool's restaurant list). No public read endpoint exists yet — display is a next-round item.",
    request: z.object({
      token: z.string().min(1),
      city: cityZ,
      restaurant: z.object({
        name: z.string().min(1).max(60), cuisine: z.string().min(1).max(20), emoji: z.string().min(1).max(8),
        tier: z.enum(["low", "mid", "high"]),
        dishes: z.array(z.object({ name: z.string().min(1).max(40), cost: z.number().int().min(0).max(100000), energy: z.number().int().min(0).max(100), mood: z.number().int().min(0).max(100), desc: z.string().max(200) })).min(1).max(20),
      }),
      days: z.number().int().min(1).max(365),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), sponsorId: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      if (!(await adminOk(db, args.token))) return { ok: false, error: "需要管理员权限。" };
      const [row] = await db.insert(schema.deliverySponsors).values({
        city: args.city, name: cleanText(args.restaurant.name).slice(0, 60),
        cuisine: cleanText(args.restaurant.cuisine).slice(0, 20), emoji: [...args.restaurant.emoji][0] ?? "🍜",
        tier: args.restaurant.tier, dishesJson: JSON.stringify(args.restaurant.dishes),
        endsAt: new Date(Date.now() + args.days * 24 * 60 * 60 * 1000), createdAt: new Date(),
      }).returning();
      return { ok: true, sponsorId: row ? String(row.id) : undefined };
    },
  }),

  /* ---- round-3 (E): Lagos gap merchant-sponsor — read side ----
     deliverySponsorSlot (admin write) already exists; this is the missing
     getDeliverySponsors the client menu needs. No banned/muted gate: reading
     a menu is not a social write. */
  getDeliverySponsors: defineAction({
    description: "Lists the sponsored restaurants live in a city's delivery menu (admin-bought slots whose end date has not passed).",
    request: z.object({ playerId: pidZ, city: cityZ }),
    response: z.object({
      ok: z.boolean(), error: z.string().optional(),
      sponsors: z.array(z.object({
        id: z.number(), name: z.string(), cuisine: z.string(), emoji: z.string(), tier: z.string(),
        dishes: z.array(z.object({ name: z.string(), cost: z.number(), energy: z.number(), mood: z.number(), desc: z.string() })),
        endsAt: z.string(),
      })),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER, sponsors: [] };
      if (me.cityKey !== args.city) return { ok: false, error: "只能看你所在城市的赞助餐厅", sponsors: [] };
      const rows = await db.select().from(schema.deliverySponsors)
        .where(and(eq(schema.deliverySponsors.city, args.city), sql`${schema.deliverySponsors.endsAt} > ${Date.now()}`))
        .orderBy(desc(schema.deliverySponsors.id));
      return {
        ok: true,
        sponsors: rows.map((r) => {
          let dishes: { name: string; cost: number; energy: number; mood: number; desc: string }[] = [];
          try {
            const parsed = JSON.parse(r.dishesJson) as unknown;
            if (Array.isArray(parsed)) dishes = parsed.flatMap((x) => {
              const o = x as { name?: unknown; cost?: unknown; energy?: unknown; mood?: unknown; desc?: unknown };
              return typeof o?.name === "string" && typeof o?.cost === "number" && typeof o?.energy === "number" && typeof o?.mood === "number"
                ? [{ name: o.name, cost: o.cost, energy: o.energy, mood: o.mood, desc: typeof o?.desc === "string" ? o.desc : "" }] : [];
            });
          } catch { dishes = []; }
          return { id: r.id, name: r.name, cuisine: r.cuisine, emoji: r.emoji, tier: r.tier, dishes, endsAt: r.endsAt.toISOString() };
        }),
      };
    },
  }),

  /* ---- round-3 (E): Lagos gap creator-payout — Livehouse tips ----
     Listener pays ✨, the musician gets 70% in ✨ through the account star
     ledger (bookStars, same calls as buyLook / claimStars — the tipper's
     account is debited, the musician's account credited; round-3b changed
     this from the ¥ money ledger, see tipTrack). 30% is the house cut, kept
     only as a number on the livehouse_tips row. Amounts on that table are
     now ✨, not ¥ — no table change, just the unit. The client still shows
     ¥ in its tip buttons / toasts until integration updates the copy. */
  tipTrack: defineAction({
    description: "Tips an approved Livehouse track in ✨: 70% goes to the musician's ✨ balance, 30% is the house cut. Max 10 tips a day per listener. The tipper needs a bound account (✨ lives on the account, not the run).",
    request: z.object({ playerId: pidZ, trackId: z.number().int().positive(), amount: z.number().int().min(1).max(500), message: z.string().max(100).optional() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), creatorShare: z.number().optional(), creatorName: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      const [t] = await db.select().from(schema.musicTracks).where(eq(schema.musicTracks.id, args.trackId)).limit(1);
      if (!t || t.status !== "approved") return { ok: false, error: "这首歌还没上轮播，打赏不了。" };
      const [creator] = await db.select().from(schema.players).where(eq(schema.players.accountId, t.accountId)).limit(1);
      if (!creator) return { ok: false, error: "这首歌的音乐人还没进游戏，暂时不能打赏。" };
      if (creator.id === me.id) return { ok: false, error: "不能给自己的歌打赏。" };
      if (!me.accountId) return { ok: false, error: "打赏要用 ✨，先绑定账号（右上角 👤 账号）再打赏。" };
      if ((await starBalance(db, me.accountId)) < args.amount) return { ok: false, error: "✨ 不够打赏。" };
      const dayAgo = new Date(Date.now() - 86_400_000);
      const sent = await db.select({ n: sql<number>`count(*)` }).from(schema.livehouseTips).where(and(eq(schema.livehouseTips.tipperId, me.id), gte(schema.livehouseTips.createdAt, dayAgo)));
      if (Number(sent[0]?.n ?? 0) >= 10) return { ok: false, error: "今天打赏得够多了，明天再来。" };
      const creatorShare = Math.floor(args.amount * 0.7);
      // ✨ via bookStars (starLedger, reason+ref unique per tip so a retry
      // can never double-book): tipper pays, musician gets 70%.
      const ref = `livehouse-tip:${randomUUID()}`;
      if (!(await bookStars(db, me.accountId, -args.amount, "livehouse-tip", ref))) return { ok: false, error: "✨ 不够打赏。" };
      if (creatorShare > 0 && !(await bookStars(db, t.accountId, creatorShare, "livehouse-tip", `${ref}:creator`))) {
        // Musician credit failed (shouldn't happen — fresh ref, positive
        // amount): give the tip back rather than swallowing it.
        await bookStars(db, me.accountId, args.amount, "livehouse-tip", `${ref}:refund`);
        return { ok: false, error: "打赏没成功，✨ 已退回。" };
      }
      await db.insert(schema.livehouseTips).values({
        trackId: t.id, tipperId: me.id, tipperName: me.name, creatorId: creator.id,
        amount: args.amount, creatorShare, message: cleanText(args.message ?? "").slice(0, 100), createdAt: new Date(),
      });
      await db.insert(schema.feedEvents).values({ playerId: me.id, playerName: me.name, kind: "life", text: `给${creator.name}的《${t.title}》打赏了 ✨${args.amount}`, createdAt: new Date() });
      ctx.invalidateQueries();
      return { ok: true, creatorShare, creatorName: creator.name };
    },
  }),

  getLivehouseTips: defineAction({
    description: "The caller's received Livehouse tips (latest 20) plus per-track tip totals for the whole city, so the rotation can show how much each song earned. totalEarned is the all-time sum of the caller's creatorShare (SQL SUM over all their tips), in ✨.",
    request: z.object({ playerId: pidZ }),
    response: z.object({
      ok: z.boolean(), error: z.string().optional(), totalEarned: z.number(),
      mine: z.array(z.object({ id: z.number(), trackId: z.number(), trackTitle: z.string(), tipperName: z.string(), amount: z.number(), creatorShare: z.number(), message: z.string(), createdAt: z.string() })),
      totals: z.array(z.object({ trackId: z.number(), total: z.number(), count: z.number() })),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER, totalEarned: 0, mine: [], totals: [] };
      const rows = await db.select().from(schema.livehouseTips).where(eq(schema.livehouseTips.creatorId, me.id)).orderBy(desc(schema.livehouseTips.id)).limit(20);
      const tracks = await db.select().from(schema.musicTracks);
      const titleOf = new Map(tracks.map((t) => [t.id, t.title]));
      const agg = await db.select({ trackId: schema.livehouseTips.trackId, total: sql<number>`sum(${schema.livehouseTips.amount})`, count: sql<number>`count(*)` }).from(schema.livehouseTips).groupBy(schema.livehouseTips.trackId);
      // All-time total (not just the latest 20): one SQL SUM, no row scan.
      const [sumRow] = await db.select({ total: sql<number>`sum(${schema.livehouseTips.creatorShare})` }).from(schema.livehouseTips).where(eq(schema.livehouseTips.creatorId, me.id));
      return {
        ok: true,
        totalEarned: Number(sumRow?.total ?? 0),
        mine: rows.map((r) => ({ id: r.id, trackId: r.trackId, trackTitle: titleOf.get(r.trackId) ?? "", tipperName: r.tipperName, amount: r.amount, creatorShare: r.creatorShare, message: r.message, createdAt: r.createdAt.toISOString() })),
        totals: agg.map((a) => ({ trackId: a.trackId, total: Number(a.total ?? 0), count: Number(a.count ?? 0) })),
      };
    },
  }),

  /* ---- round-3 (E): Lagos gap group-order — 顾客拼单 ----
     Not the rider-side stackWith field (delivery.ts:574): this is customers
     ordering together. Host creates a group with a 6-char code, friends join
     with their own dishes, host locks it and places one combined order
     client-side (placeOrder with mergeGroupItems); delivery fee is split by
     the client (groupOrderTotals in delivery.ts). Round-3b escrow: at lock
     the server takes every member's share (subtotal + fee share, same split
     as groupOrderTotals) into group_order_escrow via creditMoney/writeLedger
     (tradeEscrow pattern, dedicated table for the food/fee split); the host
     must NOT pay the combined order again client-side — the money is already
     held. completeGroupOrder settles it (food to the NPC merchant, fee to
     the host as riderFee reimbursement when the order went to the pool, else
     to the NPC rider); cancel / expiry refunds everyone in full. One open
     group per player; 30 min to gather; a locked group expires 2 h after
     locking. The client passes the deliveryFee it computed for placeOrder
     to lockGroupOrder so the server splits the same fee. */
  createGroupOrder: defineAction({
    description: "Starts a group order: the host picks a restaurant and their dishes, and gets a 6-char code to share. Max 6 members, 30 minutes to gather.",
    request: z.object({ playerId: pidZ, city: cityZ, restaurantId: z.string().min(1).max(80), restaurantName: z.string().min(1).max(60), items: z.array(GROUP_ORDER_ITEM_Z).min(1).max(20) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), groupId: z.number().optional(), code: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      if (me.cityKey !== args.city) return { ok: false, error: "只能在你所在的城市拼单" };
      if (await openGroupOf(db, me.id)) return { ok: false, error: "你已经在一个拼单里了，先结了它再开新的。" };
      let code = "";
      for (let i = 0; i < 5; i++) {
        const c = randomGroupCode();
        const [dup] = await db.select().from(schema.groupOrders).where(and(eq(schema.groupOrders.code, c), eq(schema.groupOrders.status, "open"))).limit(1);
        if (!dup) { code = c; break; }
      }
      if (!code) return { ok: false, error: "拼单暗号生成失败，稍后再试。" };
      const subtotal = args.items.reduce((s, it) => s + it.cost * it.qty, 0);
      const now = new Date();
      const [row] = await db.insert(schema.groupOrders).values({
        city: args.city, hostId: me.id, hostName: me.name,
        restaurantId: args.restaurantId, restaurantName: cleanText(args.restaurantName).slice(0, 60),
        code, status: "open", createdAt: now, expiresAt: new Date(now.getTime() + GROUP_ORDER_TTL_MS),
      }).returning();
      if (!row) return { ok: false, error: "拼单开不起来，稍后再试。" };
      await db.insert(schema.groupOrderMembers).values({ groupId: row.id, playerId: me.id, playerName: me.name, itemsJson: JSON.stringify(args.items), subtotal, joinedAt: now });
      return { ok: true, groupId: row.id, code };
    },
  }),

  joinGroupOrder: defineAction({
    description: "Joins an open group order with a 6-char code and your own dishes.",
    request: z.object({ playerId: pidZ, code: z.string().min(6).max(6), items: z.array(GROUP_ORDER_ITEM_Z).min(1).max(20) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), groupId: z.number().optional(), memberCount: z.number().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG };
      const [g] = await db.select().from(schema.groupOrders).where(and(eq(schema.groupOrders.code, args.code.toUpperCase()), eq(schema.groupOrders.status, "open"))).limit(1);
      if (!g) return { ok: false, error: "这个拼单暗号不对，或者拼单已经结束了。" };
      const view = await groupOrderView(db, g.id);
      if (!view || view.status !== "open") return { ok: false, error: "这个拼单已经结束了。" };
      if (me.cityKey !== g.city) return { ok: false, error: "拼单在别的城市，你得先过去。" };
      if (view.members.some((m) => m.playerId === me.id)) return { ok: false, error: "你已经在这个拼单里了。" };
      if (view.members.length >= GROUP_ORDER_MAX_MEMBERS) return { ok: false, error: `拼单满了（最多 ${GROUP_ORDER_MAX_MEMBERS} 人）。` };
      if (await openGroupOf(db, me.id)) return { ok: false, error: "你已经在另一个拼单里了，先结了它再来。" };
      const subtotal = args.items.reduce((s, it) => s + it.cost * it.qty, 0);
      await db.insert(schema.groupOrderMembers).values({ groupId: g.id, playerId: me.id, playerName: me.name, itemsJson: JSON.stringify(args.items), subtotal, joinedAt: new Date() });
      return { ok: true, groupId: g.id, memberCount: view.members.length + 1 };
    },
  }),

  getGroupOrder: defineAction({
    description: "Reads a group order (host + members + dishes + subtotals). Members only.",
    request: z.object({ playerId: pidZ, groupId: z.number().int().positive() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), group: GROUP_ORDER_VIEW.nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER, group: null };
      const view = await groupOrderView(db, args.groupId);
      if (!view) return { ok: false, error: "这个拼单找不到了。", group: null };
      if (view.hostId !== me.id && !view.members.some((m) => m.playerId === me.id)) return { ok: false, error: "你不在这个拼单里。", group: null };
      return { ok: true, group: view };
    },
  }),

  leaveGroupOrder: defineAction({
    description: "Leaves an open group order. If the host leaves, the whole group is cancelled (members can still read it as cancelled) and any held escrow is refunded in full. The host may also cancel a locked group this way (before it is ordered) — the escrow is refunded in full; other members cannot leave once locked.",
    request: z.object({ playerId: pidZ, groupId: z.number().int().positive() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      const view = await groupOrderView(db, args.groupId);
      if (!view) return { ok: false, error: "这个拼单找不到了。" };
      if (!view.members.some((m) => m.playerId === me.id)) return { ok: false, error: "你不在这个拼单里。" };
      if (view.status === "ordered") return { ok: false, error: "拼单已经下单，不能退出了。" };
      if (view.status === "cancelled") return { ok: false, error: "拼单已经取消了。" };
      if (view.status === "locked" && view.hostId !== me.id) return { ok: false, error: "拼单已锁定，不能退出了。" };
      if (view.status === "locked") {
        // Host cancels a locked group: whole group cancelled, escrow refunded in full.
        await db.update(schema.groupOrders).set({ status: "cancelled" }).where(eq(schema.groupOrders.id, args.groupId));
        await refundGroupEscrow(db, args.groupId);
        return { ok: true };
      }
      await db.delete(schema.groupOrderMembers).where(and(eq(schema.groupOrderMembers.groupId, args.groupId), eq(schema.groupOrderMembers.playerId, me.id)));
      if (view.hostId === me.id) {
        await db.update(schema.groupOrders).set({ status: "cancelled" }).where(eq(schema.groupOrders.id, args.groupId));
        await refundGroupEscrow(db, args.groupId);
      } else {
        // Normally nothing is escrowed while a group is still open (escrow
        // happens at lock), but refund defensively if a row ever exists.
        await refundGroupEscrow(db, args.groupId);
      }
      return { ok: true };
    },
  }),

  lockGroupOrder: defineAction({
    description: "Host only: locks an open group so nobody else can join, and escrows every member's share (dishes subtotal + delivery-fee share, same split as the client's groupOrderTotals) from each member's own balance via the money ledger. Fails with no money moved if any member is short — the error names them and the shortfall. The host then places one combined order client-side WITHOUT paying for it again (placeOrder with mergeGroupItems, money already held).",
    request: z.object({ playerId: pidZ, groupId: z.number().int().positive(), deliveryFee: z.number().int().min(0).max(10000).optional() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), group: GROUP_ORDER_VIEW.nullable(), shortfalls: z.array(z.object({ playerId: z.string(), playerName: z.string(), need: z.number(), have: z.number(), short: z.number() })).optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER, group: null };
      const view = await groupOrderView(db, args.groupId);
      if (!view) return { ok: false, error: "这个拼单找不到了。", group: null };
      if (view.hostId !== me.id) return { ok: false, error: "只有发起人能锁定拼单。", group: null };
      if (view.status !== "open") return { ok: false, error: "拼单已经锁定 / 结束了。", group: null };
      const fee = args.deliveryFee ?? 0;
      const split = groupOrderSplit(view.members, fee);
      const existing = await groupEscrowByPlayer(db, args.groupId);
      // All-or-nothing balance check first: nobody is charged if anyone is short.
      const shortfalls: { playerId: string; playerName: string; need: number; have: number; short: number }[] = [];
      for (const s of split) {
        if (existing.has(s.playerId)) continue; // resume after a partial lock: already held, don't charge twice
        const [p] = await db.select().from(schema.players).where(eq(schema.players.id, s.playerId)).limit(1);
        const have = p?.money ?? 0;
        if (have < s.total) {
          const m = view.members.find((x) => x.playerId === s.playerId);
          shortfalls.push({ playerId: s.playerId, playerName: m?.playerName ?? s.playerId, need: s.total, have, short: s.total - have });
        }
      }
      if (shortfalls.length) {
        const first = shortfalls[0]!;
        const more = shortfalls.length > 1 ? `，还有 ${shortfalls.length - 1} 人也不够` : "";
        return { ok: false, error: `余额不够：${first.playerName} 还差 ¥${first.short}（这单要 ¥${first.need}，只有 ¥${first.have}）${more}。没扣任何人的钱。`, group: null, shortfalls };
      }
      const now = new Date();
      const inserted: string[] = [];
      for (const s of split) {
        if (existing.has(s.playerId)) continue;
        const m = view.members.find((x) => x.playerId === s.playerId)!;
        if (s.total > 0) await creditMoney(db, s.playerId, -s.total, `group order #${args.groupId} escrow`);
        await db.insert(schema.groupOrderEscrow).values({ groupId: args.groupId, playerId: s.playerId, foodAmount: m.subtotal, feeAmount: s.feeShare, amount: s.total, status: "held", createdAt: now });
        inserted.push(s.playerId);
      }
      // Compare-and-set: only the first locker wins. If another request
      // locked it first, refund exactly the rows this call inserted.
      const changed = await db.update(schema.groupOrders).set({ status: "locked", lockedAt: now }).where(and(eq(schema.groupOrders.id, args.groupId), eq(schema.groupOrders.status, "open"))).returning({ id: schema.groupOrders.id });
      if (!changed.length) {
        for (const pid of inserted) {
          const [r] = await db.select().from(schema.groupOrderEscrow).where(and(eq(schema.groupOrderEscrow.groupId, args.groupId), eq(schema.groupOrderEscrow.playerId, pid))).limit(1);
          if (r && r.status === "held") {
            await db.update(schema.groupOrderEscrow).set({ status: "refunded", releasedAt: new Date() }).where(and(eq(schema.groupOrderEscrow.groupId, args.groupId), eq(schema.groupOrderEscrow.playerId, pid), eq(schema.groupOrderEscrow.status, "held")));
            if (r.amount > 0) await creditMoney(db, pid, r.amount, `group order #${args.groupId} lock race refund`);
          }
        }
        return { ok: false, error: "拼单已经锁定 / 结束了。", group: null };
      }
      return { ok: true, group: await groupOrderView(db, args.groupId) };
    },
  }),

  completeGroupOrder: defineAction({
    description: "Host only: marks a locked group as ordered, after the combined order is placed client-side, and settles the escrow: each member's food share goes to the restaurant (NPC merchant — released as spent, no player account), and the delivery-fee shares reimburse the host when the combined order was published to the rider pool (poolId), or go to the NPC rider for a local order. Groups locked before round-3b have no escrow rows and complete as before.",
    request: z.object({ playerId: pidZ, groupId: z.number().int().positive(), poolId: z.string().min(1).max(32).optional() }),
    response: z.object({ ok: z.boolean(), error: z.string().optional(), settlement: z.object({ food: z.number(), fee: z.number(), feeToHost: z.number() }).optional() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      const [g] = await db.select().from(schema.groupOrders).where(eq(schema.groupOrders.id, args.groupId)).limit(1);
      if (!g) return { ok: false, error: "这个拼单找不到了。" };
      if (g.hostId !== me.id) return { ok: false, error: "只有发起人能确认下单。" };
      // groupOrderView first: a locked group past its 2 h TTL is cancelled + refunded here.
      const view = await groupOrderView(db, args.groupId);
      if (!view || view.status !== "locked") return { ok: false, error: view?.status === "cancelled" ? "拼单已过期取消，托管已退回各成员。" : "拼单还没锁定，先锁定再确认。" };
      let poolId: string | null = null;
      if (args.poolId) {
        const pid = Number(args.poolId);
        if (!Number.isInteger(pid)) return { ok: false, error: "跑腿单号不对。" };
        const [o] = await db.select().from(schema.deliveryPoolOrders).where(eq(schema.deliveryPoolOrders.id, pid)).limit(1);
        if (!o) return { ok: false, error: "这个跑腿单找不到了。" };
        if (o.customerId !== me.id) return { ok: false, error: "这个跑腿单不是你发的。" };
        if (o.restaurantId !== g.restaurantId) return { ok: false, error: "跑腿单的餐厅和拼单对不上。" };
        if (o.status === "expired" || o.status === "cancelled") return { ok: false, error: "这个跑腿单已经过期 / 取消了，骑手费托管还在原地。" };
        poolId = String(pid);
      }
      const changed = await db.update(schema.groupOrders).set({ status: "ordered", poolId }).where(and(eq(schema.groupOrders.id, args.groupId), eq(schema.groupOrders.status, "locked"))).returning({ id: schema.groupOrders.id });
      if (!changed.length) return { ok: false, error: "拼单还没锁定，先锁定再确认。" };
      const settlement = await settleGroupEscrow(db, args.groupId, me.id, poolId);
      return { ok: true, settlement };
    },
  }),

  /* ---- round-3 (E): Lagos gap retention-loop — 顾客侧每周任务 ----
     Courier streaks already exist; the customer side only had welcome
     coupons. Four weekly quests on existing order/rating play (order count,
     try a new restaurant, 5★ a delivered order, weekly spend). Progress is
     reported by the client (reportDeliveryQuest) — same trust model as the
     rest of delivery money, which is client-computed (see business-plan
     note); a stricter version would derive progress from pool orders only,
     but local orders never reach the pool. Rewards: existing ¥ (ledger) or
     existing coupon ids the client grants on claim. */
  getWeeklyQuests: defineAction({
    description: "This week's delivery quests for the caller (Beijing ISO week): progress and claimed state per quest.",
    request: z.object({ playerId: pidZ }),
    response: z.object({
      ok: z.boolean(), error: z.string().optional(), weekKey: z.string(),
      quests: z.array(z.object({ questId: z.string(), progress: z.number(), target: z.number(), claimed: z.boolean() })),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER, weekKey: "", quests: [] };
      const weekKey = weekKeyOf();
      await ensureWeeklyQuestRows(db, me.id, weekKey);
      const rows = await db.select().from(schema.deliveryQuests).where(and(eq(schema.deliveryQuests.playerId, me.id), eq(schema.deliveryQuests.weekKey, weekKey)));
      const byId = new Map(rows.map((r) => [r.questId, r]));
      return {
        ok: true, weekKey,
        quests: WEEKLY_QUEST_DEFS.map((q) => ({ questId: q.id, progress: byId.get(q.id)?.progress ?? 0, target: q.target, claimed: !!(byId.get(q.id)?.claimed) })),
      };
    },
  }),

  reportDeliveryQuest: defineAction({
    description: "Reports one delivery event for weekly-quest progress: an order (counts orders + spend + new-restaurant) or a 5★ rating.",
    request: z.object({ playerId: pidZ, event: z.enum(["order", "rate"]), restaurantId: z.string().max(80).optional(), amount: z.number().int().min(0).max(100000).optional(), stars: z.number().int().min(1).max(5).optional() }),
    response: z.object({
      ok: z.boolean(), error: z.string().optional(), weekKey: z.string(),
      quests: z.array(z.object({ questId: z.string(), progress: z.number(), target: z.number(), claimed: z.boolean() })),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER, weekKey: "", quests: [] };
      if (me.banned) return { ok: false, error: BANNED_MSG, weekKey: "", quests: [] };
      if (isMuted(me)) return { ok: false, error: MUTED_MSG, weekKey: "", quests: [] };
      if (!communityRateOk(me.id)) return { ok: false, error: RATE_MSG, weekKey: "", quests: [] };
      const weekKey = weekKeyOf();
      await ensureWeeklyQuestRows(db, me.id, weekKey);
      const rows = await db.select().from(schema.deliveryQuests).where(and(eq(schema.deliveryQuests.playerId, me.id), eq(schema.deliveryQuests.weekKey, weekKey)));
      const byId = new Map(rows.map((r) => [r.questId, r]));
      const bump = async (questId: string, next: number, meta?: string) => {
        const row = byId.get(questId);
        if (!row) return;
        const def = WEEKLY_QUEST_DEFS.find((q) => q.id === questId)!;
        const capped = Math.min(def.target, Math.max(row.progress, next));
        if (capped === row.progress && meta === undefined) return;
        await db.update(schema.deliveryQuests).set({ progress: capped, ...(meta !== undefined ? { meta } : {}), updatedAt: new Date() }).where(and(eq(schema.deliveryQuests.playerId, me.id), eq(schema.deliveryQuests.weekKey, weekKey), eq(schema.deliveryQuests.questId, questId)));
        row.progress = capped;
        if (meta !== undefined) row.meta = meta;
      };
      if (args.event === "order") {
        const o = byId.get("order-3");
        if (o) await bump("order-3", o.progress + 1);
        const s = byId.get("spend-100");
        if (s) await bump("spend-100", s.progress + (args.amount ?? 0));
        const t = byId.get("try-new");
        if (t && args.restaurantId && t.progress < 1) {
          let seen: string[] = [];
          try { const parsed = JSON.parse(t.meta) as unknown; if (parsed && typeof parsed === "object" && Array.isArray((parsed as { seen?: unknown }).seen)) seen = (parsed as { seen: string[] }).seen.filter((x) => typeof x === "string"); } catch { seen = []; }
          if (!seen.includes(args.restaurantId)) {
            seen.push(args.restaurantId);
            await bump("try-new", 1, JSON.stringify({ seen }));
          }
        }
      } else if (args.event === "rate" && args.stars === 5) {
        const r = byId.get("rate-5");
        if (r) await bump("rate-5", 1);
      }
      return {
        ok: true, weekKey,
        quests: WEEKLY_QUEST_DEFS.map((q) => ({ questId: q.id, progress: byId.get(q.id)?.progress ?? 0, target: q.target, claimed: !!(byId.get(q.id)?.claimed) })),
      };
    },
  }),

  claimWeeklyQuest: defineAction({
    description: "Claims a completed weekly quest once: ¥ goes to the caller's money via the ledger; a coupon is returned by id for the client to grant.",
    request: z.object({ playerId: pidZ, questId: z.string().min(1).max(20) }),
    response: z.object({
      ok: z.boolean(), error: z.string().optional(),
      reward: z.object({ kind: z.string(), amount: z.number().optional(), couponId: z.string().optional(), label: z.string() }).optional(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await r2Player(db, args.playerId);
      if (!me) return { ok: false, error: NO_PLAYER };
      if (me.banned) return { ok: false, error: BANNED_MSG };
      const def = WEEKLY_QUEST_DEFS.find((q) => q.id === args.questId);
      if (!def) return { ok: false, error: "没有这个任务。" };
      const weekKey = weekKeyOf();
      const [row] = await db.select().from(schema.deliveryQuests).where(and(eq(schema.deliveryQuests.playerId, me.id), eq(schema.deliveryQuests.weekKey, weekKey), eq(schema.deliveryQuests.questId, args.questId))).limit(1);
      if (!row || row.progress < def.target) return { ok: false, error: "这项任务还没完成。" };
      if (row.claimed) return { ok: false, error: "奖励已经领过了。" };
      const changed = await db.update(schema.deliveryQuests).set({ claimed: 1, updatedAt: new Date() }).where(and(eq(schema.deliveryQuests.playerId, me.id), eq(schema.deliveryQuests.weekKey, weekKey), eq(schema.deliveryQuests.questId, args.questId), eq(schema.deliveryQuests.claimed, 0))).returning();
      if (!changed.length) return { ok: false, error: "奖励已经领过了。" };
      if (def.reward.kind === "money") await creditMoney(db, me.id, def.reward.amount, `weekly quest ${args.questId}`);
      return { ok: true, reward: { kind: def.reward.kind, ...(def.reward.kind === "money" ? { amount: def.reward.amount } : { couponId: def.reward.couponId }), label: def.reward.label } };
    },
  }),

} satisfies ActionsModule;
