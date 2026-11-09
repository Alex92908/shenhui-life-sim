// Drizzle schema for 湾区人生.
//
// players: one row per person who has entered the shared city. Presence is
// derived from lastSeen (a player counts as online for ~90s after their last
// heartbeat). game fields are the player's current run snapshot, used for the
// live leaderboard and the finished-season rankings.
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  // 大厂跳槽 / 集章 / 称号 (0004): shown to other players and on the boards
  employer: text("employer").notNull().default("startup"),
  stamps: integer("stamps").notNull().default(0),
  title: text("title"),
  // 防作弊 (0005): 1 = a heartbeat reported an implausible jump (money,
  // 职级 or stamps); such players are left off every leaderboard.
  suspect: integer("suspect").notNull().default(0),
  // 运营 (0009): 1 = banned by a moderator (no chat, DMs, parties, gifts,
  // hidden from the online list and boards); season = "YYYY-MM" of the run.
  banned: integer("banned").notNull().default(0),
  season: text("season").notNull().default("2026-11"),
  // 防薅羊毛 (0010): a per-browser device id, a salted hash of the IP and of
  // its /24 network, and how many distinct Beijing days the player was active.
  device: text("device"),
  ipHash: text("ip_hash"),
  ipGroup: text("ip_group"),
  activeDays: integer("active_days").notNull().default(0),
  lastActiveDay: text("last_active_day"),
  // 账号 (0011): the account this player belongs to once bound (guests: null).
  accountId: text("account_id"),
  // 经济 (0012): the server's own balance is \`money\`; reportedMoney is the
  // client's last proposal, earnBudget what it may still earn without
  // proof (refills over real time), cosmetic the equipped look (name colour).
  reportedMoney: integer("reported_money").notNull().default(0),
  earnBudget: integer("earn_budget").notNull().default(60000),
  budgetAt: integer("budget_at", { mode: "timestamp_ms" }),
  cosmetic: text("cosmetic"),
  // 运营 (0017): chat / DMs / posts blocked until this time (a temporary mute, lighter than a ban)
  mutedUntil: integer("muted_until", { mode: "timestamp_ms" }),
  // 公开编号 (0006): sha256(id) prefix. The id itself is the player's
  // private key and is never sent to other clients; everything shown to
  // others (chat, online list, boards, gifts, invite links) uses pub.
  pub: text("pub").unique(),
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

// Gifts between real players (0004): a 奶茶 / 早餐 / 红包 / 内推 sent to someone
// online; the receiver claims it on their next heartbeat and the client
// applies the effect. company is the sender's employer (for 内推).
export const gifts = sqliteTable("gifts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromId: text("from_id").notNull(),
  fromName: text("from_name").notNull(),
  toId: text("to_id").notNull(),
  kind: text("kind").notNull(),
  company: text("company"),
  claimed: integer("claimed").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// 云存档 (0005): the whole local save + meta progress, keyed by player and
// unlocked on another device with the player's transfer code (secret).
export const cloudSaves = sqliteTable("cloud_saves", {
  playerId: text("player_id").primaryKey(),
  secret: text("secret").notNull().unique(),
  save: text("save").notNull(),
  meta: text("meta").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// 组局 (0007): a player opens a party for an activity at a place; others in
// the same city join, the host starts it, everyone plays the mini-game and
// submits a score. members is a JSON array of
// { id (public), name, emoji, score|null }.
export const parties = sqliteTable("parties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  hostId: text("host_id").notNull(),
  hostName: text("host_name").notNull(),
  cityKey: text("city_key").notNull(),
  locId: text("loc_id").notNull(),
  locName: text("loc_name").notNull(),
  activityId: text("activity_id").notNull(),
  members: text("members").notNull().default("[]"),
  status: text("status").notNull().default("open"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  startedAt: integer("started_at", { mode: "timestamp_ms" }),
});

// 搭子: how many parties two players (private ids, a < b) played together.
export const buddies = sqliteTable("buddies", {
  a: text("a").notNull(),
  b: text("b").notNull(),
  n: integer("n").notNull().default(0),
  lastAt: integer("last_at", { mode: "timestamp_ms" }).notNull(),
}, (t) => [primaryKey({ columns: [t.a, t.b] })]);

// 私聊 (0008): any player can message any other; the receiver can block
// (blocks: a blocked b) and report (reports, reviewed by moderators).
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromId: text("from_id").notNull(),
  toId: text("to_id").notNull(),
  body: text("body").notNull(),
  read: integer("read").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const blocks = sqliteTable("blocks", {
  a: text("a").notNull(),
  b: text("b").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (t) => [primaryKey({ columns: [t.a, t.b] })]);
export const reports = sqliteTable("reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reporterId: text("reporter_id").notNull(),
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  context: text("context"),
  status: text("status").notNull().default("open"),
  resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

// 自建统计 (0009): anonymous product events (player = public id, day = Beijing
// date) for retention / funnel numbers, and client-side errors (deduped by
// message) for the admin page. No third-party analytics.
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  player: text("player").notNull(),
  name: text("name").notNull(),
  props: text("props"),
  day: text("day").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const clientErrors = sqliteTable("client_errors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  player: text("player"),
  message: text("message").notNull(),
  stack: text("stack"),
  url: text("url"),
  ua: text("ua"),
  count: integer("count").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  lastAt: integer("last_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

// 邀请 (0010): an invite only pays the inviter once the invitee has been
// active on 3 days and played a party with a real player, from another
// device and network, within the inviter's weekly cap.
export const invites = sqliteTable("invites", {
  inviteeId: text("invitee_id").primaryKey(),
  inviterId: text("inviter_id").notNull(),
  status: text("status").notNull().default("pending"),
  reason: text("reason"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
});
// 奖励领取 (0010): sign-in / streak / welcome bonus, granted by the server
// once per player per Beijing day (welcome: once per player and per device).
export const rewardClaims = sqliteTable("reward_claims", {
  playerId: text("player_id").notNull(),
  kind: text("kind").notNull(),
  day: text("day").notNull(),
  n: integer("n").notNull().default(1),
  money: integer("money").notNull().default(0),
  device: text("device"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (t) => [primaryKey({ columns: [t.playerId, t.kind, t.day] })]);

// 账号 (0011): one account per person; identities are the ways to log in
// (email / phone now, Apple / Google / WeChat later); a session is a random
// token whose SHA-256 is stored. Login codes are stored hashed, expire in 10
// minutes and allow 5 attempts.
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  playerId: text("player_id"),
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});
export const identities = sqliteTable("identities", {
  provider: text("provider").notNull(),
  subject: text("subject").notNull(),
  accountId: text("account_id").notNull(),
  verifiedAt: integer("verified_at", { mode: "timestamp_ms" }).notNull(),
}, (t) => [primaryKey({ columns: [t.provider, t.subject] })]);
export const loginCodes = sqliteTable("login_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  subject: text("subject").notNull(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  ipHash: text("ip_hash"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  usedAt: integer("used_at", { mode: "timestamp_ms" }),
});
export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  accountId: text("account_id").notNull(),
  device: text("device"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
});

/* 经济 (0012): every change to a player's season money, as the server saw it */
export const ledger = sqliteTable("ledger", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: text("player_id").notNull(),
  season: text("season").notNull(),
  kind: text("kind").notNull(), // earn | spend | reward | clamped | season-start
  amount: integer("amount").notNull(),
  balance: integer("balance").notNull(),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
/* ✨星光 (paid currency, per account, never per run): append-only ledger */
export const starLedger = sqliteTable("star_ledger", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: text("account_id").notNull(),
  amount: integer("amount").notNull(),
  balance: integer("balance").notNull(),
  reason: text("reason").notNull(), // purchase | refund | pass | member | shop | grant
  ref: text("ref"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  product: text("product").notNull(),
  amount: integer("amount").notNull(), // minor units (分 / cents)
  currency: text("currency").notNull(),
  status: text("status").notNull().default("pending"), // pending | paid | refunded | failed
  provider: text("provider").notNull(), // stripe | dev
  providerRef: text("provider_ref"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  paidAt: integer("paid_at", { mode: "timestamp_ms" }),
  refundedAt: integer("refunded_at", { mode: "timestamp_ms" }),
});
export const entitlements = sqliteTable("entitlements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: text("account_id").notNull(),
  kind: text("kind").notNull(), // pass | member | item | claim
  item: text("item").notNull(),
  season: text("season"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  orderId: text("order_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
});

/* ---- 上线运营 + 真人关系 (0013) ---- */
// 玩家反馈：游戏里「🆕 更新」面板底下的意见箱
export const feedback = sqliteTable("feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: text("player_id").notNull(),
  kind: text("kind").notNull(), // bug | idea | other
  body: text("body").notNull(),
  city: text("city"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
// 真人关系：合租室友 / 结拜 / 情侣。a 发起，b 接受；ended 之后保留记录
export const bonds = sqliteTable("bonds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  a: text("a").notNull(),
  b: text("b").notNull(),
  kind: text("kind").notNull(), // roommate | sworn | partner
  status: text("status").notNull().default("pending"), // pending | active | declined | ended
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
// 业委会选举：每城每周一届，参选人带一条政策承诺，得票最多的人下周当主任、政策全城生效
export const committeeCandidates = sqliteTable("committee_candidates", {
  week: integer("week").notNull(),
  city: text("city").notNull(),
  playerId: text("player_id").notNull(),
  pledge: text("pledge").notNull(), // rent | metro | eat
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (t) => [primaryKey({ columns: [t.week, t.city, t.playerId] })]);
export const committeeVotes = sqliteTable("committee_votes", {
  week: integer("week").notNull(),
  city: text("city").notNull(),
  voterId: text("voter_id").notNull(),
  candidateId: text("candidate_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (t) => [primaryKey({ columns: [t.week, t.city, t.voterId] })]);

/* ---- 零工 + 纠纷陪审 (0014) ---- */
// a real player posts a paid job (the pay is held by the server), another takes and delivers it;
// the employer confirms (or it pays out after 2 h); a dispute goes to a 24 h jury of the city's players
export const gigs = sqliteTable("gigs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  city: text("city").notNull(),
  employerId: text("employer_id").notNull(),
  workerId: text("worker_id"),
  title: text("title").notNull(),
  pay: integer("pay").notNull(),
  status: text("status").notNull().default("open"), // open | taken | delivered | disputed | paid | refunded
  reason: text("reason"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  takenAt: integer("taken_at", { mode: "timestamp_ms" }),
  deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
  dueAt: integer("due_at", { mode: "timestamp_ms" }), // auto-pay time (delivered) or jury end (disputed)
  workerClaimed: integer("worker_claimed").notNull().default(0),
  employerClaimed: integer("employer_claimed").notNull().default(0),
});
export const gigVotes = sqliteTable("gig_votes", {
  gigId: integer("gig_id").notNull(),
  voterId: text("voter_id").notNull(),
  side: text("side").notNull(), // worker | employer
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (t) => [primaryKey({ columns: [t.gigId, t.voterId] })]);

/* ---- 地图广告牌 + 运营公告 (0015) ---- */
// three billboard slots per city, rented for 7 days with ✨ (or placed by an operator for a local business)
export const billboards = sqliteTable("billboards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  city: text("city").notNull(),
  slot: integer("slot").notNull(),
  accountId: text("account_id"),
  owner: text("owner").notNull(), // shown name: the player, or the business an operator placed
  text: text("text").notNull(),
  emoji: text("emoji").notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
// update notes the operator posts from the admin page (no deploy needed)
export const announcements = sqliteTable("announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  zh: text("zh").notNull(),
  en: text("en").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

/* ---- 🎶 Livehouse：音乐人投稿，审核后进全城同步轮播 (0016) ---- */
export const musicTracks = sqliteTable("music_tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: text("account_id").notNull(),
  artist: text("artist").notNull(),
  title: text("title").notNull(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),
  durationSec: integer("duration_sec").notNull(),
  chunks: integer("chunks").notNull(),
  status: text("status").notNull().default("uploading"), // uploading | pending | approved | rejected
  boostUntil: integer("boost_until", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const musicChunks = sqliteTable("music_chunks", {
  trackId: integer("track_id").notNull(),
  idx: integer("idx").notNull(),
  data: text("data").notNull(), // base64
}, (t) => [primaryKey({ columns: [t.trackId, t.idx] })]);

/* 运营后台 (0017): staff tokens with a role (the ADMIN_TOKEN env value is always the owner), and an audit log of every admin action */
export const adminUsers = sqliteTable("admin_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  role: text("role").notNull().default("ops"), // owner | ops | moderator
  disabled: integer("disabled").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const adminAudit = sqliteTable("admin_audit", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  admin: text("admin").notNull(),
  action: text("action").notNull(),
  target: text("target"),
  detail: text("detail"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
