// Drizzle schema for 深惠人生模拟多人联机版.
//
// players: one row per person who has entered the shared city. Presence is
// derived from lastSeen (a player counts as online for ~90s after their last
// heartbeat). game fields are the player's current run snapshot, used for the
// live leaderboard and the finished-season rankings.
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🧑"),
  color: integer("color").notNull().default(0xe63a1f),
  cityKey: text("city_key").notNull().default("sz"),
  locId: text("loc_id").notNull().default("home"),
  gameDay: integer("game_day").notNull().default(1),
  money: integer("money").notNull().default(0),
  careerIdx: integer("career_idx").notNull().default(0),
  apecCount: integer("apec_count").notNull().default(0),
  status: text("status", { enum: ["playing", "finished"] })
    .notNull()
    .default("playing"),
  resultTitle: text("result_title"),
  lastSeen: integer("last_seen", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: text("player_id").notNull(),
  playerName: text("player_name").notNull(),
  cityKey: text("city_key").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Latest real-weather snapshot per city, fetched server-side from the
// platform weather channel and cached so the page reads a fresh copy on
// open without hammering the upstream. payload is the normalized JSON the
// getRealWeather action returns.
export const weatherSnapshots = sqliteTable("weather_snapshots", {
  cityKey: text("city_key").primaryKey(),
  payload: text("payload").notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const feedEvents = sqliteTable("feed_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: text("player_id").notNull(),
  playerName: text("player_name").notNull(),
  kind: text("kind").notNull().default("life"),
  text: text("text").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
