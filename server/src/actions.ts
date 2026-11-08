// Actions for 深惠人生模拟多人联机版 — the shared-city backend.
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
      try { return { ok: true, orderId: id, url: await stripeCheckout({ id, amount, currency, name: `深惠人生 · ${pr.name}` }, args.origin) }; }
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
      if (!isAdmin(args.token)) return { ok: false, error: adminToken() ? "口令不对" : "服务器没有设置 ADMIN_TOKEN（至少 12 位），后台未开启" };
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
      return { ok: true, data: {
        totalPlayers, banned, economy,
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

  adminModerate: defineAction({
    description: "Admin: resolve a report (dismiss / ban the reported player) or ban / unban a player by public id. Requires the ADMIN_TOKEN.",
    request: z.object({ token: z.string().max(200), reportId: z.number().int().optional(), targetPub: z.string().max(64).optional(), action: z.enum(["dismiss", "ban", "unban"]) }),
    response: z.object({ ok: z.boolean(), error: z.string().optional() }),
    async handler(ctx, args) {
      if (!isAdmin(args.token)) return { ok: false, error: "口令不对" };
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
      if (me.banned) return { ok: true };
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
