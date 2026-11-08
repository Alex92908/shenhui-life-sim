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
import { createHash } from "node:crypto";
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
    request: z.object({ ...profileArgs }),
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
    }),
    response: z.object({ world: worldResponse, inbox: z.array(giftShape), me: z.string() }),
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
      await db
        .update(schema.players)
        .set({
          suspect,
          pub: pubOf(args.playerId),
          cityKey: args.cityKey,
          locId: args.locId,
          gameDay: args.gameDay,
          money: args.money,
          careerIdx: args.careerIdx,
          apecCount: args.apecCount,
          ...(args.employer !== undefined ? { employer: args.employer } : {}),
          ...(args.stamps !== undefined ? { stamps: args.stamps } : {}),
          ...(args.title !== undefined ? { title: args.title } : {}),
          ...(args.season !== undefined ? { season: args.season } : {}),
          lastSeen: new Date(),
        })
        .where(eq(schema.players.id, args.playerId));
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
      if (args.kind === "invite") {
        const dup = await db.select().from(schema.gifts).where(and(eq(schema.gifts.fromId, me.id), eq(schema.gifts.kind, "invite"))).limit(1);
        if (dup.length > 0) return { ok: false, error: "已经报到过了" };
      }
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
      return { ok: true, data: {
        totalPlayers, banned,
        dau: [...dau.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-30),
        d1: cohort(1), d7: cohort(7),
        topEvents: top.map((t) => ({ name: t.name, n: Number(t.n) })),
        reports,
        errors: errors.map((e) => ({ id: e.id, message: e.message, stack: e.stack, url: e.url, ua: e.ua, count: e.count, lastAt: e.lastAt.toISOString() })),
        chat: chat.map((c) => ({ id: c.id, player: pubOf(c.playerId), name: c.playerName, city: c.cityKey, body: c.body, at: c.createdAt.toISOString() })),
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
