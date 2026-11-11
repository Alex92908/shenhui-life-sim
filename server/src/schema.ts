// Drizzle schema for 湾区人生.
//
// players: one row per person who has entered the shared city. Presence is
// derived from lastSeen (a player counts as online for ~90s after their last
// heartbeat). game fields are the player's current run snapshot, used for the
// live leaderboard and the finished-season rankings.
import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
/** A player's published home: tier, wall style, and which piece sits in which slot.
    Visiting reads this. The rest of the save stays on the device. */
export const homes = sqliteTable("homes", {
  playerId: text("player_id").primaryKey(),
  tier: integer("tier").notNull().default(0),
  style: text("style"),
  layout: text("layout").notNull().default("[]"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const gifts = sqliteTable("gifts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromId: text("from_id").notNull(),
  fromName: text("from_name").notNull(),
  toId: text("to_id").notNull(),
  kind: text("kind").notNull(),
  company: text("company"),
  claimed: integer("claimed").notNull().default(0),
  /** 分成 / 红包里的金额。奶茶这类礼物是 0，效果在种类上。 */
  amount: integer("amount").notNull().default(0),
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

/* ---- round-2 (S): pets + community (c) ---- */
export const strays = sqliteTable("strays", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  city: text("city").notNull(),
  kind: text("kind").notNull(), // cat | dog
  appearance: text("appearance").notNull(),
  temper: text("temper").notNull(), // friendly | shy | wary
  locId: text("loc_id").notNull(),
  locName: text("loc_name").notNull(),
  x: real("x").notNull().default(0),
  z: real("z").notNull().default(0),
  trust: integer("trust").notNull().default(0),
  lastFedDay: integer("last_fed_day").notNull().default(-1),
  firstSeenDay: integer("first_seen_day").notNull().default(1),
  adopted: integer("adopted").notNull().default(0),
  fedByCount: integer("fed_by_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const strayFeeds = sqliteTable("stray_feeds", {
  strayId: integer("stray_id").notNull(),
  playerId: text("player_id").notNull(),
  day: integer("day").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (t) => [primaryKey({ columns: [t.strayId, t.playerId, t.day] })]);
export const playerPets = sqliteTable("player_pets", {
  playerId: text("player_id").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const notices = sqliteTable("notices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  city: text("city").notNull(),
  kind: text("kind").notNull(), // lost-pet | lost-item | found-pet | found-item
  title: text("title").notNull(),
  body: text("body").notNull(),
  locId: text("loc_id").notNull(),
  locName: text("loc_name").notNull(),
  x: real("x"),
  z: real("z"),
  photoUrl: text("photo_url"),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  status: text("status").notNull().default("open"), // open | claimed | expired
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  claimedByName: text("claimed_by_name"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const noticeReplies = sqliteTable("notice_replies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noticeId: integer("notice_id").notNull(),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  text: text("text").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const snakeReports = sqliteTable("snake_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  city: text("city").notNull(),
  locId: text("loc_id").notNull(),
  locName: text("loc_name").notNull(),
  x: real("x"),
  z: real("z"),
  speciesGuess: text("species_guess").notNull().default(""),
  description: text("description").notNull(),
  photoUrl: text("photo_url"),
  reporterId: text("reporter_id").notNull(),
  reporterName: text("reporter_name").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  confirmations: integer("confirmations").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const snakeConfirms = sqliteTable("snake_confirms", {
  reportId: integer("report_id").notNull(),
  playerId: text("player_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (t) => [primaryKey({ columns: [t.reportId, t.playerId] })]);
export const fishingSpots = sqliteTable("fishing_spots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  city: text("city").notNull(),
  locId: text("loc_id").notNull(),
  locName: text("loc_name").notNull(),
  x: real("x"),
  z: real("z"),
  catchDesc: text("catch_desc").notNull(),
  bait: text("bait").notNull().default(""),
  notes: text("notes").notNull().default(""),
  photoUrl: text("photo_url"),
  reporterId: text("reporter_id").notNull(),
  reporterName: text("reporter_name").notNull(),
  confirmations: integer("confirmations").notNull().default(0),
  lastConfirmedAt: integer("last_confirmed_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const fishingConfirms = sqliteTable("fishing_confirms", {
  spotId: integer("spot_id").notNull(),
  playerId: text("player_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (t) => [primaryKey({ columns: [t.spotId, t.playerId] })]);

/* ---- round-2 (S): black landlords / companies (d) ---- */
export const blackReports = sqliteTable("black_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  city: text("city").notNull(),
  kind: text("kind").notNull(), // landlord | employer
  reporterId: text("reporter_id").notNull(),
  targetId: text("target_id").notNull(),
  targetName: text("target_name").notNull(),
  body: text("body").notNull(),
  evidence: text("evidence"),
  status: text("status").notNull().default("open"), // open | upheld | rejected | expired
  verdictNote: text("verdict_note"),
  dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
  reporterClaimed: integer("reporter_claimed").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const blackReportVotes = sqliteTable("black_report_votes", {
  reportId: integer("report_id").notNull(),
  voterId: text("voter_id").notNull(),
  side: text("side").notNull(), // uphold | reject
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (t) => [primaryKey({ columns: [t.reportId, t.voterId] })]);
export const blackReputations = sqliteTable("black_reputations", {
  targetId: text("target_id").notNull(),
  kind: text("kind").notNull(),
  city: text("city").notNull().default("sz"),
  targetName: text("target_name").notNull(),
  score: integer("score").notNull().default(80),
  upheldCount: integer("upheld_count").notNull().default(0),
  rejectedCount: integer("rejected_count").notNull().default(0),
  flaggedUntil: integer("flagged_until", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (t) => [primaryKey({ columns: [t.targetId, t.kind] })]);
export const reporterStanding = sqliteTable("reporter_standing", {
  playerId: text("player_id").primaryKey(),
  credibility: integer("credibility").notNull().default(100),
  filedCount: integer("filed_count").notNull().default(0),
  upheldCount: integer("upheld_count").notNull().default(0),
  rejectedCount: integer("rejected_count").notNull().default(0),
  lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
/* Server-side rent rollback: when an upheld landlord report is claimed, the
   rolled-back rent is written here so a later save/load can never resurrect
   the raised rent (the client's applyLandlordVerdict alone is not durable). */
export const blackRentRollbacks = sqliteTable("black_rent_rollbacks", {
  playerId: text("player_id").primaryKey(),
  rent: integer("rent").notNull(),
  baseRent: integer("base_rent").notNull(),
  reportId: integer("report_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

/* ---- round-2 (S): open economy (e) ---- */
export const tradeTasks = sqliteTable("trade_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  city: text("city").notNull(), // sz | hz | hk | any
  posterId: text("poster_id").notNull(),
  posterName: text("poster_name").notNull(),
  kind: text("kind").notNull(), // buy | sell | swap | service | other
  title: text("title").notNull(),
  body: text("body").notNull(),
  price: integer("price"),
  negotiable: integer("negotiable").notNull().default(0),
  tags: text("tags").notNull().default("[]"),
  status: text("status").notNull().default("open"), // open | accepted | completed | cancelled | disputed
  accepterId: text("accepter_id"),
  accepterName: text("accepter_name"),
  escrowHeld: integer("escrow_held").notNull().default(0),
  escrowFromId: text("escrow_from_id"),
  escrowFromName: text("escrow_from_name"),
  createdDay: integer("created_day").notNull(),
  expiresDay: integer("expires_day").notNull().default(0),
  completionNote: text("completion_note"),
  disputeReason: text("dispute_reason"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
/* Dedicated trade escrow ledger (NOT sendGift: gift kinds cap at ¥5,000 and
   10/day). One row per hold; status held | released | refunded | frozen. */
export const tradeEscrow = sqliteTable("trade_escrow", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: integer("task_id").notNull(),
  kind: text("kind").notNull().default("trade"), // trade | sublet-deposit | delivery
  payerId: text("payer_id").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("held"), // held | released | refunded | frozen
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  releasedAt: integer("released_at", { mode: "timestamp_ms" }),
});
export const subletListings = sqliteTable("sublet_listings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  city: text("city").notNull(),
  ownerId: text("owner_id").notNull(),
  ownerName: text("owner_name").notNull(),
  homeLocId: text("home_loc_id").notNull().default("home"),
  space: text("space").notNull(), // room | bed | sofa | whole
  monthlyPrice: integer("monthly_price").notNull(),
  deposit: integer("deposit").notNull().default(0),
  terms: text("terms").notNull().default(""),
  minDays: integer("min_days").notNull().default(0),
  maxDays: integer("max_days").notNull().default(0),
  availableFromDay: integer("available_from_day").notNull().default(0),
  status: text("status").notNull().default("open"), // open | taken | closed
  tenantId: text("tenant_id"),
  tenantName: text("tenant_name"),
  tenancyStartDay: integer("tenancy_start_day").notNull().default(0),
  rentCollected: integer("rent_collected").notNull().default(0),
  lastRentDay: integer("last_rent_day").notNull().default(0),
  rentLate: integer("rent_late").notNull().default(0),
  suspicion: integer("suspicion").notNull().default(0),
  ownMonthlyRent: integer("own_monthly_rent"),
  createdDay: integer("created_day").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const overseasOrders = sqliteTable("overseas_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  buyerId: text("buyer_id").notNull(),
  itemId: text("item_id").notNull(),
  itemJson: text("item_json").notNull(),
  qty: integer("qty").notNull().default(1),
  paidTotal: integer("paid_total").notNull(),
  dutyDue: integer("duty_due").notNull().default(0),
  dutyPaid: integer("duty_paid").notNull().default(0),
  shipDays: integer("ship_days").notNull(),
  orderedDay: integer("ordered_day").notNull(),
  etaDay: integer("eta_day").notNull(),
  status: text("status").notNull().default("ordered"), // ordered | shipped | customs | arrived | held
  heldOnce: integer("held_once").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const usedFurnitureOwned = sqliteTable("used_furniture_owned", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: text("player_id").notNull(),
  pieceId: text("piece_id").notNull(),
  baseId: text("base_id"),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🪑"),
  room: text("room").notNull().default("living"),
  condition: integer("condition").notNull(),
  paidPrice: integer("paid_price").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const cheapGoodsOwned = sqliteTable("cheap_goods_owned", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: text("player_id").notNull(),
  goodId: text("good_id").notNull(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("📦"),
  kind: text("kind").notNull().default("other"),
  state: text("state").notNull().default("plain"),
  condition: integer("condition").notNull(),
  buyPrice: integer("buy_price").notNull(),
  boughtDay: integer("bought_day").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const usedFurnitureListings = sqliteTable("used_furniture_listings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  city: text("city").notNull(),
  sellerId: text("seller_id").notNull(),
  sellerName: text("seller_name").notNull(),
  baseId: text("base_id"),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🪑"),
  room: text("room").notNull().default("living"),
  condition: integer("condition").notNull(),
  price: integer("price").notNull(),
  newPrice: integer("new_price").notNull(),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("open"), // open | sold | closed
  listedDay: integer("listed_day").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

/* ---- round-2 (S): lifestyles — Sanhe + lying flat (f) ---- */
export const lifestyleStates = sqliteTable("lifestyle_states", {
  playerId: text("player_id").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const jobApplications = sqliteTable("job_applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: text("player_id").notNull(),
  listingId: text("listing_id").notNull(),
  day: integer("day").notNull(),
  status: text("status").notNull().default("applied"), // applied | trial | hired | left
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const courseEnrollments = sqliteTable("course_enrollments", {
  playerId: text("player_id").notNull(),
  courseId: text("course_id").notNull(),
  startDay: integer("start_day").notNull(),
  days: integer("days").notNull(),
  done: integer("done").notNull().default(0),
  allowancePaid: integer("allowance_paid").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (t) => [primaryKey({ columns: [t.playerId, t.courseId] })]);
export const courseAllowanceDays = sqliteTable("course_allowance_days", {
  playerId: text("player_id").notNull(),
  courseId: text("course_id").notNull(),
  day: integer("day").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (t) => [primaryKey({ columns: [t.playerId, t.courseId, t.day] })]);
export const guidanceSessions = sqliteTable("guidance_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: text("player_id").notNull(),
  routeId: text("route_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const trials = sqliteTable("trials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: text("player_id").notNull(),
  listingId: text("listing_id").notNull(),
  startDay: integer("start_day").notNull(),
  daysWorked: integer("days_worked").notNull().default(0),
  totalScore: integer("total_score").notNull().default(0),
  status: text("status").notNull().default("active"), // active | hired | left
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const trialDays = sqliteTable("trial_days", {
  trialId: integer("trial_id").notNull(),
  day: integer("day").notNull(),
  score: integer("score").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (t) => [primaryKey({ columns: [t.trialId, t.day] })]);
export const flatGigs = sqliteTable("flat_gigs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  city: text("city").notNull(),
  posterId: text("poster_id").notNull(),
  posterName: text("poster_name").notNull(),
  title: text("title").notNull(),
  desc: text("desc").notNull().default(""),
  pay: integer("pay").notNull().default(0),
  kind: text("kind").notNull().default("help"), // help | work
  status: text("status").notNull().default("open"), // open | taken | done | cancelled
  takerId: text("taker_id"),
  takerName: text("taker_name"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const stalls = sqliteTable("stalls", {
  playerId: text("player_id").primaryKey(),
  city: text("city").notNull(),
  kind: text("kind").notNull(),
  day: integer("day").notNull(),
  lvl: integer("lvl").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const sanheShiftLogs = sqliteTable("sanhe_shift_logs", {
  playerId: text("player_id").notNull(),
  day: integer("day").notNull(),
  shiftId: text("shift_id").notNull(),
  pay: integer("pay").notNull(),
  city: text("city").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (t) => [primaryKey({ columns: [t.playerId, t.day] })]);

/* ---- round-2 (S): delivery pool (h) ---- */
export const deliveryPoolOrders = sqliteTable("delivery_pool_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  city: text("city").notNull(),
  customerId: text("customer_id").notNull(),
  customerName: text("customer_name").notNull(),
  platformId: text("platform_id").notNull().default(""),
  restaurantId: text("restaurant_id").notNull(),
  restaurantName: text("restaurant_name").notNull(),
  itemsJson: text("items_json").notNull().default("[]"),
  total: integer("total").notNull().default(0),
  riderFee: integer("rider_fee").notNull(),
  destId: text("dest_id"),
  destName: text("dest_name").notNull(),
  distance: integer("distance").notNull().default(0),
  status: text("status").notNull().default("open"), // open | taken | pickedUp | delivered | expired | cancelled
  riderId: text("rider_id"),
  riderName: text("rider_name"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  deadlineAt: integer("deadline_at", { mode: "timestamp_ms" }).notNull(),
  takenAt: integer("taken_at", { mode: "timestamp_ms" }),
  deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
  tip: integer("tip").notNull().default(0),
  stars: integer("stars"),
});
export const deliveryRiders = sqliteTable("delivery_riders", {
  playerId: text("player_id").primaryKey(),
  rating: integer("rating").notNull().default(500), // rating × 100 (5.00 = 500); avoids float drift
  completed: integer("completed").notNull().default(0),
  onTime: integer("on_time").notNull().default(0),
  late: integer("late").notNull().default(0),
  cancelled: integer("cancelled").notNull().default(0),
  totalEarned: integer("total_earned").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const deliverySponsors = sqliteTable("delivery_sponsors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  city: text("city").notNull(),
  name: text("name").notNull(),
  cuisine: text("cuisine").notNull().default(""),
  emoji: text("emoji").notNull().default("🍜"),
  tier: text("tier").notNull().default(""),
  dishesJson: text("dishes_json").notNull().default("[]"),
  owner: text("owner").notNull().default(""),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
