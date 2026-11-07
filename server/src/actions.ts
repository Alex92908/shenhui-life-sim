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
import { and, desc, eq, gte } from "drizzle-orm";
import * as schema from "./schema";

const ONLINE_WINDOW_MS = 90_000;

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
  status: z.string(),
  resultTitle: z.string().nullable(),
  lastSeen: z.string(),
});

const worldResponse = z.object({
  online: z.array(playerShape),
  onlineSz: z.number(),
  onlineHz: z.number(),
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
});

type World = z.infer<typeof worldResponse>;

async function loadWorld(ctx: Ctx, cityKey: string): Promise<World> {
  const db = ctx.db<typeof schema>();
  const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS);
  const onlineRows = await db
    .select()
    .from(schema.players)
    .where(gte(schema.players.lastSeen, cutoff))
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
  const boardRows = await db
    .select()
    .from(schema.players)
    .orderBy(desc(schema.players.money))
    .limit(20);
  return {
    online: onlineRows.map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      color: p.color,
      cityKey: p.cityKey,
      locId: p.locId,
      gameDay: p.gameDay,
      money: p.money,
      careerIdx: p.careerIdx,
      apecCount: p.apecCount,
      status: p.status,
      resultTitle: p.resultTitle,
      lastSeen: p.lastSeen.toISOString(),
    })),
    onlineSz: onlineRows.filter((p) => p.cityKey === "sz").length,
    onlineHz: onlineRows.filter((p) => p.cityKey === "hz").length,
    chat: chatRows
      .slice()
      .reverse()
      .map((m) => ({
        id: m.id,
        playerId: m.playerId,
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
      id: p.id,
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
  };
}

const profileArgs = {
  playerId: z.string().min(4).max(64),
  name: z.string().trim().min(1).max(12),
  emoji: z.string().min(1).max(8),
  color: z.number().int().min(0).max(0xffffff),
  cityKey: z.enum(["sz", "hz"]),
};

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
  cityKey: z.enum(["sz", "hz"]),
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

export const Actions = {
  joinWorld: defineAction({
    description:
      "Registers (or re-registers) a player in the shared Shenzhen/Huizhou city and returns the current world snapshot.",
    request: z.object({ ...profileArgs }),
    response: z.object({ world: worldResponse }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const now = new Date();
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
            text: `来到了${args.cityKey === "sz" ? "深圳" : "惠州"}，开始过日子`,
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
              }
            : {};
        await db
          .update(schema.players)
          .set({
            name: args.name,
            emoji: args.emoji,
            color: args.color,
            cityKey: args.cityKey,
            lastSeen: now,
            ...freshRun,
          })
          .where(eq(schema.players.id, args.playerId));
      }
      ctx.invalidateQueries();
      return { world: await loadWorld(ctx, args.cityKey) };
    },
  }),

  syncPresence: defineAction({
    description:
      "Heartbeat: updates a player's current location and run snapshot, returns the fresh world snapshot.",
    request: z.object({
      playerId: z.string().min(4).max(64),
      cityKey: z.enum(["sz", "hz"]),
      locId: z.string().min(1).max(32),
      gameDay: z.number().int().min(1).max(31),
      money: z.number().int().min(-1000000).max(100000000),
      careerIdx: z.number().int().min(0).max(4),
      apecCount: z.number().int().min(0).max(999),
    }),
    response: z.object({ world: worldResponse }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.players)
        .set({
          cityKey: args.cityKey,
          locId: args.locId,
          gameDay: args.gameDay,
          money: args.money,
          careerIdx: args.careerIdx,
          apecCount: args.apecCount,
          lastSeen: new Date(),
        })
        .where(eq(schema.players.id, args.playerId));
      return { world: await loadWorld(ctx, args.cityKey) };
    },
  }),

  getWorld: defineAction({
    description:
      "Returns the shared world snapshot for a city: online players, chat, life feed and leaderboard.",
    request: z.object({ cityKey: z.enum(["sz", "hz"]) }),
    response: z.object({ world: worldResponse }),
    async handler(ctx, args) {
      return { world: await loadWorld(ctx, args.cityKey) };
    },
  }),

  getRealWeather: defineAction({
    description:
      "Returns the real current weather for Shenzhen or Huizhou (live channel, cached server-side for 30 minutes), used to drive the game's sky, rain and weather displays.",
    request: z.object({
      cityKey: z.enum(["sz", "hz"]),
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
      await db.insert(schema.chatMessages).values({
        playerId: me.id,
        playerName: me.name,
        cityKey: me.cityKey,
        body: args.body,
        createdAt: new Date(),
      });
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
      await db.insert(schema.feedEvents).values({
        playerId: me.id,
        playerName: me.name,
        kind: args.kind,
        text: args.text,
        createdAt: new Date(),
      });
      ctx.invalidateQueries();
      return { ok: true };
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
          text: `过完了 30 天，结局是「${args.resultTitle}」，存款 ¥${args.money.toLocaleString()}`,
          createdAt: new Date(),
        });
        ctx.invalidateQueries();
      }
      return { ok: true };
    },
  }),
} satisfies ActionsModule;
