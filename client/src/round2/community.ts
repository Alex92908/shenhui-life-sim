// community.ts — 社区玩法 (round-2, area c)
//
// 四个开放式系统 (系统, 不是脚本剧情; 玩家自由写文字、自由选地点):
//   1. 照顾流浪猫狗 — 喂食攒信任, 信任满了可以收养 (接 pets.ts)
//   2. 拍照 + 失物招领 — 拍下走失宠物/物品发启事, 其他玩家回复/认领, 会过期
//   3. 上报蛇出没 — 位置 + 照片/描述, 附近玩家在地图上看到警告
//   4. 上报钓鱼点 — 位置 + 钓获, 其他玩家在地图上看到钓点
//
// 后三者 + 流浪动物收养需要服务器共享 (多人同一座城), 端点规格见文件底部
// (SERVER_SPEC) 与 ROUND2-LOG-c.md, 由 area S 实现. 本文件只做客户端的
// 类型 / 状态 / 校验 / 本地逻辑, 不直接调 api (调用点见底部的集成片段).
//
// 共同规则:
//   - 所有玩家输入的自由文本: 长度上限 + 去首尾空白; 内容审核 (违禁词/举报)
//     在服务器端做 (reportPlayer / 管理员体系已存在), 客户端只做长度校验.
//   - 所有带位置的记录都用 locId + 可选 x/z (世界坐标, 供地图打点);
//     locId 为空时只按城市显示, 不打精确点.
//   - 过期由服务器在列表接口里过滤 + 客户端展示时再过滤一次 (双保险).

import type { AdoptInput } from "./pets";
import { SHOP_KIND_EMOJI } from "./shops";

export type CityKey = "sz" | "hz" | "hk";

/** 地图上的一个点: 属于哪个地点 + 世界坐标 (x/z 与 MapView 的坐标系一致). */
export interface MapPin {
  locId: string;
  locName: string;
  x?: number;
  z?: number;
}

export const TEXT_LIMITS = {
  title: 30,
  body: 200,
  name: 12,
  species: 20,
} as const;

export function cleanText(s: string, max: number): string {
  return s.trim().replace(/\s+/g, " ").slice(0, max);
}

export function isExpired(expiresAt: string, nowMs: number = Date.now()): boolean {
  return new Date(expiresAt).getTime() <= nowMs;
}

/** 统一的客户端校验结果. */
export type Validation = { ok: true } | { ok: false; error: string };
const need = (cond: boolean, error: string): Validation => (cond ? { ok: true } : { ok: false, error });

// ---------------------------------------------------------------------------
// 1. 流浪猫狗
// ---------------------------------------------------------------------------

export type StrayKind = "cat" | "dog";
export type StrayTemper = "friendly" | "shy" | "wary";

export interface StrayAnimal {
  id: string;
  kind: StrayKind;
  /** 花色/外貌描述, 如 "橘白相间, 瘸了一条后腿". */
  appearance: string;
  temper: StrayTemper;
  pin: MapPin;
  cityKey: CityKey;
  /** 0–100 的信任值: 喂食 +8~15 (看性格), 每天 -5; >= 70 可收养. */
  trust: number;
  /** 最近一次被喂的游戏天数 (用于每日衰减; -1 = 从没喂过). */
  lastFedDay: number;
  /** 第一次被发现的游戏天数. */
  firstSeenDay: number;
  /** 是否已被人收养 (服务器端状态; 被收养后不再出现在列表). */
  adopted: boolean;
  /** 被多少个玩家喂过 (服务器计数, 显示用: "已有 3 个人喂过它"). */
  fedByCount: number;
  /** 本地: 玩家今天是否喂过它 (每天一次有效信任, 防刷). */
  fedTodayLocal?: boolean;
}

export const STRAY_TRUST = {
  adoptAt: 70,
  feedGain: { friendly: 15, shy: 10, wary: 8 } as Record<StrayTemper, number>,
  dailyDecay: 5,
  /** 信任到 40 时流浪动物开始主动靠近玩家 (地图上跟几步). */
  followsAt: 40,
} as const;

export const STRAY_TEMPER_LABEL: Record<StrayTemper, string> = {
  friendly: "亲人",
  shy: "胆小",
  wary: "警惕",
};

export function validateFeedStray(stray: StrayAnimal, fedToday: boolean): Validation {
  if (stray.adopted) return { ok: false, error: "它已经被好心人收养了" };
  if (fedToday) return { ok: false, error: "今天已经喂过它了, 明天再来吧" };
  return { ok: true };
}

/**
 * 喂一次流浪动物 (本地乐观更新; 服务器端再做一次同样的信任计算并落库,
 * 防止客户端伪造. 喂食花费 ¥5 猫粮/狗粮, 由 App.tsx 扣钱).
 * 返回新的信任值 + 文案.
 */
export function feedStrayLocal(stray: StrayAnimal): { trust: number; note: string } {
  const gain = STRAY_TRUST.feedGain[stray.temper];
  const trust = Math.min(100, stray.trust + gain);
  const notes: Record<StrayTemper, string[]> = {
    friendly: ["它立刻凑过来, 蹭了蹭你的手.", "它吃得很香, 围着你转了两圈."],
    shy: ["它等你走开几步, 才小心翼翼地过来吃.", "它远远地看着你, 耳朵动了动."],
    wary: ["它叼起食物跑到一边, 边吃边盯着你.", "它犹豫了很久, 终于低头吃了."],
  };
  const list = notes[stray.temper];
  const note = list[Math.floor(Math.random() * list.length)] ?? "";
  return { trust, note: trust >= STRAY_TRUST.adoptAt ? `${note} 它好像愿意跟你回家了.` : note };
}

/** 信任够了就可以收养: 生成 pets.ts 的领养输入 (App.tsx 调 adoptPet). */
export function strayToAdoptInput(stray: StrayAnimal, name: string, gameDay: number): AdoptInput | null {
  if (stray.adopted || stray.trust < STRAY_TRUST.adoptAt) return null;
  return {
    kind: stray.kind,
    breed: stray.appearance.slice(0, 16) || (stray.kind === "cat" ? "流浪猫" : "流浪犬"),
    name,
    color: stray.kind === "cat" ? 0xe8a34c : 0x8b6f47,
    source: "stray",
    adoptedAt: stray.pin.locId,
    gameDay,
    personality: STRAY_TEMPER_LABEL[stray.temper],
    strayId: stray.id,
  };
}

/** 每日衰减 (客户端展示用; 服务器端同样算, 以服务器为准). */
export function decayStrayTrust(stray: StrayAnimal, gameDay: number): number {
  const days = Math.max(0, gameDay - Math.max(stray.lastFedDay, stray.firstSeenDay));
  return Math.max(0, stray.trust - STRAY_TRUST.dailyDecay * days);
}

// ---------------------------------------------------------------------------
// 2. 拍照 + 失物招领
// ---------------------------------------------------------------------------

export type NoticeKind = "lost-pet" | "lost-item" | "found-pet" | "found-item";
export type NoticeStatus = "open" | "claimed" | "expired";

export interface NoticeReply {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface LostFoundNotice {
  id: string;
  kind: NoticeKind;
  cityKey: CityKey;
  title: string;
  /** 自由描述: 特征、颜色、最后出现的时间…… 怎么写都行. */
  body: string;
  pin: MapPin;
  /** 照片: 客户端传图床 URL (或复用游戏内截图); 可为空. */
  photoUrl: string | null;
  authorId: string;
  authorName: string;
  status: NoticeStatus;
  createdAt: string;
  /** 默认 7 天后过期; 走失宠物可由作者延长一次 (+7 天). */
  expiresAt: string;
  replies: NoticeReply[];
  /** 认领者 (status === "claimed" 时). */
  claimedByName: string | null;
}

export const NOTICE_TTL_DAYS = 7;
export const NOTICE_KIND_LABEL: Record<NoticeKind, string> = {
  "lost-pet": "走失宠物",
  "lost-item": "丢失物品",
  "found-pet": "捡到宠物",
  "found-item": "捡到物品",
};

export interface PostNoticeInput {
  kind: NoticeKind;
  cityKey: CityKey;
  title: string;
  body: string;
  pin: MapPin;
  photoUrl?: string | null;
}

export function validateNotice(input: PostNoticeInput): Validation {
  if (!input.title.trim()) return { ok: false, error: "写个标题吧, 比如 “走失橘猫”" };
  if (!input.body.trim()) return { ok: false, error: "描述一下特征吧, 大家才好帮忙留意" };
  if (!input.pin.locId) return { ok: false, error: "选一下大概是在哪儿丢的 / 捡到的" };
  return { ok: true };
}

export function validateReply(text: string): Validation {
  return need(cleanText(text, TEXT_LIMITS.body).length > 0, "回复写点什么吧");
}

/** 本地构造一条新启事 (id 由服务器生成后替换; 客户端先乐观展示). */
export function buildNotice(
  input: PostNoticeInput,
  author: { id: string; name: string },
  nowMs: number = Date.now(),
): LostFoundNotice {
  const createdAt = new Date(nowMs).toISOString();
  return {
    id: `local_${nowMs}`,
    kind: input.kind,
    cityKey: input.cityKey,
    title: cleanText(input.title, TEXT_LIMITS.title),
    body: cleanText(input.body, TEXT_LIMITS.body),
    pin: input.pin,
    photoUrl: input.photoUrl ?? null,
    authorId: author.id,
    authorName: author.name,
    status: "open",
    createdAt,
    expiresAt: new Date(nowMs + NOTICE_TTL_DAYS * 86_400_000).toISOString(),
    replies: [],
    claimedByName: null,
  };
}

/** 认领 / 标记已找回 (只有作者或管理员可操作, 服务器校验身份). */
export function claimNoticeLocal(n: LostFoundNotice, claimedByName: string): LostFoundNotice {
  return { ...n, status: "claimed", claimedByName };
}

// ---------------------------------------------------------------------------
// 3. 上报蛇出没
// ---------------------------------------------------------------------------

export interface SnakeReport {
  id: string;
  cityKey: CityKey;
  pin: MapPin;
  /** 玩家猜的种类, 自由文本, 如 "水蛇" / "不认识, 黑色带环纹"; 不认识就写不认识. */
  speciesGuess: string;
  /** 自由描述: 大小、颜色、在干什么. */
  description: string;
  photoUrl: string | null;
  reporterId: string;
  reporterName: string;
  reportedAt: string;
  /** 默认 3 天后过期 (蛇会走); 有人再次目击可续期. */
  expiresAt: string;
  /** 其他玩家点 “我也看到了” 的次数; >= 2 时标记为已证实, 地图上更醒目. */
  confirmations: number;
  /** 本地: 玩家是否已确认过这条 (每人每条一次). */
  confirmedLocal?: boolean;
}

export const SNAKE_TTL_DAYS = 3;
export const SNAKE_CONFIRM_TO_VERIFY = 2;

export interface ReportSnakeInput {
  cityKey: CityKey;
  pin: MapPin;
  speciesGuess: string;
  description: string;
  photoUrl?: string | null;
}

export function validateSnakeReport(input: ReportSnakeInput): Validation {
  if (!input.pin.locId) return { ok: false, error: "先定位一下在哪儿看到的蛇" };
  if (!input.description.trim() && !input.speciesGuess.trim()) {
    return { ok: false, error: "描述一下这条蛇吧 (大小、颜色都行)" };
  }
  return { ok: true };
}

export function buildSnakeReport(
  input: ReportSnakeInput,
  reporter: { id: string; name: string },
  nowMs: number = Date.now(),
): SnakeReport {
  return {
    id: `local_${nowMs}`,
    cityKey: input.cityKey,
    pin: input.pin,
    speciesGuess: cleanText(input.speciesGuess, TEXT_LIMITS.species),
    description: cleanText(input.description, TEXT_LIMITS.body),
    photoUrl: input.photoUrl ?? null,
    reporterId: reporter.id,
    reporterName: reporter.name,
    reportedAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + SNAKE_TTL_DAYS * 86_400_000).toISOString(),
    confirmations: 0,
  };
}

export const isSnakeVerified = (r: SnakeReport): boolean => r.confirmations >= SNAKE_CONFIRM_TO_VERIFY;

/** 蛇出没警告文案 (地图标记 / 附近玩家提示用). */
export function snakeWarningText(r: SnakeReport): string {
  const what = r.speciesGuess ? `疑似${r.speciesGuess}` : "有蛇出没";
  const verified = isSnakeVerified(r) ? " (多人证实)" : "";
  return `⚠️ ${r.pin.locName}: ${what}, 小心脚下${verified}`;
}

// ---------------------------------------------------------------------------
// 4. 上报钓鱼点
// ---------------------------------------------------------------------------

export interface FishingSpotReport {
  id: string;
  cityKey: CityKey;
  pin: MapPin;
  /** 钓到了什么, 自由文本, 如 "罗非鱼, 两斤" / "空军, 但风景好". */
  catchDesc: string;
  /** 饵料/钓法, 自由文本, 可为空. */
  bait: string;
  /** 补充说明, 自由文本, 可为空. */
  notes: string;
  photoUrl: string | null;
  reporterId: string;
  reporterName: string;
  reportedAt: string;
  /** 钓点不过期 (水域不会跑), 但 30 天无人确认则沉底 (列表排序靠后). */
  lastConfirmedAt: string;
  /** 其他玩家点 “我也在这儿钓到了” 的次数. */
  confirmations: number;
  confirmedLocal?: boolean;
}

export const FISHING_SPOT_STALE_DAYS = 30;

export interface ReportFishingSpotInput {
  cityKey: CityKey;
  pin: MapPin;
  catchDesc: string;
  bait?: string;
  notes?: string;
  photoUrl?: string | null;
}

export function validateFishingSpot(input: ReportFishingSpotInput): Validation {
  if (!input.pin.locId) return { ok: false, error: "先定位一下钓点在哪儿" };
  if (!input.catchDesc.trim()) return { ok: false, error: "说说钓到了什么 (空军也可以写!)" };
  return { ok: true };
}

export function buildFishingSpotReport(
  input: ReportFishingSpotInput,
  reporter: { id: string; name: string },
  nowMs: number = Date.now(),
): FishingSpotReport {
  const now = new Date(nowMs).toISOString();
  return {
    id: `local_${nowMs}`,
    cityKey: input.cityKey,
    pin: input.pin,
    catchDesc: cleanText(input.catchDesc, TEXT_LIMITS.body),
    bait: cleanText(input.bait ?? "", 60),
    notes: cleanText(input.notes ?? "", TEXT_LIMITS.body),
    photoUrl: input.photoUrl ?? null,
    reporterId: reporter.id,
    reporterName: reporter.name,
    reportedAt: now,
    lastConfirmedAt: now,
    confirmations: 0,
  };
}

export const isFishingSpotStale = (r: FishingSpotReport, nowMs: number = Date.now()): boolean =>
  nowMs - new Date(r.lastConfirmedAt).getTime() > FISHING_SPOT_STALE_DAYS * 86_400_000;

/** 钓点在地图/列表里的排序: 证实多的在前, 沉底的在后. */
export function sortFishingSpots(spots: FishingSpotReport[], nowMs: number = Date.now()): FishingSpotReport[] {
  return [...spots].sort((a, b) => {
    const staleA = isFishingSpotStale(a, nowMs) ? 1 : 0;
    const staleB = isFishingSpotStale(b, nowMs) ? 1 : 0;
    if (staleA !== staleB) return staleA - staleB;
    if (b.confirmations !== a.confirmations) return b.confirmations - a.confirmations;
    return new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime();
  });
}

// ---------------------------------------------------------------------------
// 地图聚合: 社区内容在地图上以标记显示 (MapView 集成用)
// ---------------------------------------------------------------------------

export type CommunityMapMarker =
  | { kind: "stray"; id: string; pin: MapPin; label: string; emoji: string }
  | { kind: "notice"; id: string; pin: MapPin; label: string; emoji: string }
  | { kind: "snake"; id: string; pin: MapPin; label: string; emoji: string }
  | { kind: "fishing"; id: string; pin: MapPin; label: string; emoji: string }
  /* round-9: player shops / bought flats on the map (same marker system). */
  | { kind: "shop"; id: string; pin: MapPin; label: string; emoji: string }
  | { kind: "flat"; id: string; pin: MapPin; label: string; emoji: string };

/** 图钉在小地图上的圆点颜色 (round-3, MapView 的 minimap 与图钉共用;
    蛇警告用红色, 与普通标记区分). */
export const COMMUNITY_PIN_COLOR: Record<CommunityMapMarker["kind"], string> = {
  stray: "#f59e0b",
  notice: "#3b82f6",
  snake: "#dc2626",
  fishing: "#0ea5e9",
  shop: "#f97316",
  flat: "#8b5cf6",
};

/**
 * 把四类社区内容聚合成地图标记 (App.tsx 从服务器拉到列表后调这个函数,
 * 传给 MapView 渲染; 标记点击后打开对应详情面板).
 * 规则: 只显示未过期、未被收养/认领的; 蛇警告只显示在当前城市.
 */
export function toMapMarkers(input: {
  strays: StrayAnimal[];
  notices: LostFoundNotice[];
  snakes: SnakeReport[];
  fishingSpots: FishingSpotReport[];
  cityKey: CityKey;
  nowMs?: number;
}): CommunityMapMarker[] {
  const nowMs = input.nowMs ?? Date.now();
  const out: CommunityMapMarker[] = [];
  for (const s of input.strays) {
    if (s.adopted || s.cityKey !== input.cityKey) continue;
    out.push({
      kind: "stray", id: s.id, pin: s.pin,
      label: `${s.kind === "cat" ? "流浪猫" : "流浪狗"} · ${STRAY_TEMPER_LABEL[s.temper]} · 信任 ${s.trust}`,
      emoji: s.kind === "cat" ? "🐱" : "🐶",
    });
  }
  for (const n of input.notices) {
    if (n.status !== "open" || n.cityKey !== input.cityKey || isExpired(n.expiresAt, nowMs)) continue;
    out.push({
      kind: "notice", id: n.id, pin: n.pin,
      label: `${NOTICE_KIND_LABEL[n.kind]}: ${n.title}`,
      emoji: n.kind.includes("pet") ? "🐾" : "🔍",
    });
  }
  for (const r of input.snakes) {
    if (r.cityKey !== input.cityKey || isExpired(r.expiresAt, nowMs)) continue;
    out.push({ kind: "snake", id: r.id, pin: r.pin, label: snakeWarningText(r), emoji: "🐍" });
  }
  for (const f of input.fishingSpots) {
    if (f.cityKey !== input.cityKey) continue;
    out.push({
      kind: "fishing", id: f.id, pin: f.pin,
      label: `🎣 ${f.catchDesc}${f.confirmations > 0 ? ` · ${f.confirmations}人证实` : ""}`,
      emoji: "🎣",
    });
  }
  return out;
}

/**
 * Round-9: player shops / bought flats as map markers (App.tsx 从 world
 * 快照拉到 shops/flats 后调这个函数, 拼在 toMapMarkers 前面, 所以 MapView
 * 的 24 个标记上限先保住店和房子, 再放社区内容). 标记落在店/房子的 locId
 * 上; 点一下打开店/房子面板.
 */
export function shopFlatMarkers(input: {
  shops: { ownerPub: string; ownerName: string; kind: string; name: string; locId: string; cityKey: CityKey; lvl: number; floor: number; building: string | null }[];
  flats: { ownerPub: string; ownerName: string; name: string; locId: string; cityKey: CityKey; tier: number }[];
  cityKey: CityKey;
  buildingZh?: (buildingId: string | null) => string | null;
}): CommunityMapMarker[] {
  const out: CommunityMapMarker[] = [];
  for (const sh of input.shops) {
    if (sh.cityKey !== input.cityKey) continue;
    const emoji = SHOP_KIND_EMOJI[sh.kind] ?? "🏪";
    const bZh = sh.building ? (input.buildingZh?.(sh.building) ?? sh.building) : null;
    const floor = sh.floor > 1 || bZh ? ` · ${bZh ? `${bZh} ` : ""}${sh.floor}F` : "";
    out.push({
      kind: "shop", id: `shop:${sh.ownerPub}`, pin: { locId: sh.locId, locName: sh.name },
      label: `${sh.name}${floor} · ${sh.ownerName}`,
      emoji,
    });
  }
  for (const fl of input.flats) {
    if (fl.cityKey !== input.cityKey) continue;
    out.push({
      kind: "flat", id: `flat:${fl.ownerPub}`, pin: { locId: fl.locId, locName: fl.name },
      label: `${fl.name} · ${fl.ownerName}的家`,
      emoji: "🏠",
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 服务器端点规格 (给 area S, 在 server/src/actions.ts + schema.ts 实现)
// ---------------------------------------------------------------------------
//
// 通用: 所有端点先校验 playerId 存在且未被封禁 (banned → { ok:false, error: BANNED_MSG });
// 文本长度上限与本文件 TEXT_LIMITS 一致, 服务器再校验一次; 举报/审核复用
// 现有的 reportPlayer + 管理员体系, 不另起一套.
//
// 1) getStrays({ cityKey, playerId })
//    → { strays: StrayAnimal[] } (只返回本城、未被收养的; trust 按服务器存量返回;
//       客户端每天看到的信任值以服务器为准. 流浪动物由服务器定期生成/补充:
//       每个城市常驻 3–6 只, 位置从公园/城中村/海边等 locId 池里随机, 被收养后
//       隔几天在别处生成新的. 表 strays: id, kind, appearance, temper, city,
//       loc_id, loc_name, x, z, trust, last_fed_day, first_seen_day, adopted,
//       fed_by_count, created_at.)
//
// 2) feedStray({ playerId, strayId, gameDay })
//    → { ok, trust?, note?, error? }
//    校验: 当天该玩家没喂过这只 (表 stray_feeds: stray_id + player_id + day 唯一);
//    trust += 性格对应增益 (friendly 15 / shy 10 / wary 8), 上限 100;
//    fed_by_count 去重计数. 客户端扣 ¥5 猫粮钱 (服务器不扣钱, 钱在客户端算;
//    若后续要防刷, 再把钱收到服务器).
//
// 3) adoptStray({ playerId, strayId, petName, gameDay })
//    → { ok, error? }  校验 trust >= 70 且未被收养; 成功后 strays.adopted = 1,
//    并把收养记录写进 pets 同步 (见 pets.ts 的 PetSyncPayload.adoptedStrayId).
//    并发保护: 更新时 where adopted = 0, 影响行数为 0 则返回 “已经被收养了”.
//
// 4) syncPets({ playerId, pets, activePetId, adoptedStrayId? })
//    → { ok }  宠物是个人资产: 存 players.pet_json (TEXT, JSON) 或新建 pets 表;
//    换设备同步 + 排行榜彩蛋用. adoptedStrayId 有值时走 adoptStray 同一套
//    标记逻辑. 形状见 pets.ts PetSyncPayload.
//
// 5) postNotice({ playerId, kind, cityKey, title, body, locId, locName, x?, z?, photoUrl? })
//    → { ok, noticeId?, error? }  每人每天最多发 5 条; TTL 7 天 (expires_at).
//    表 notices: + status open/claimed/expired, replies 存 JSON 或 notices_replies 表.
// 6) getNotices({ cityKey, playerId })
//    → { notices: LostFoundNotice[] }  只返回本城、open 且未过期的 (过期由查询
//    条件过滤, 不用定时任务); 按 created_at 倒序, 最多 50 条.
// 7) replyNotice({ playerId, noticeId, text })
//    → { ok, reply?, error? }  启事须为 open; 文本 ≤ 200 字.
// 8) claimNotice({ playerId, noticeId })
//    → { ok, error? }  仅作者本人 (或管理员) 可标记已找回/已认领.
//
// 9) reportSnake({ playerId, cityKey, locId, locName, x?, z?, speciesGuess, description, photoUrl? })
//    → { ok, reportId?, error? }  每人每小时最多 3 条 (防刷); TTL 3 天.
//    表 snake_reports: + confirmations, reporter 匿名化只存名字不存精确 id 对外.
// 10) getSnakeWarnings({ cityKey, playerId })
//    → { warnings: SnakeReport[] }  只返回本城未过期的; 按 confirmations 倒序.
// 11) confirmSnake({ playerId, reportId })
//    → { ok, confirmations?, error? }  每人每条一次 (表 snake_confirms 唯一键);
//    成功后 confirmations +1, 并把 expires_at 延长 1 天 (再次目击 = 蛇还在).
//
// 12) reportFishingSpot({ playerId, cityKey, locId, locName, x?, z?, catchDesc, bait?, notes?, photoUrl? })
//    → { ok, spotId?, error? }  同一地点 100 米内已有钓点时, 提示 “这里已有钓点,
//    去确认它吧” (返回 existingSpotId, 不建重复点); 每人每天最多 5 条.
//    表 fishing_spots: + confirmations, last_confirmed_at.
// 13) getFishingSpots({ cityKey, playerId })
//    → { spots: FishingSpotReport[] }  本城全部 (含沉底的, 客户端排序); 最多 100 条.
// 14) confirmFishingSpot({ playerId, spotId })
//    → { ok, confirmations?, error? }  每人每点一次; 成功后 confirmations +1,
//    last_confirmed_at = now (沉底的钓点被重新激活).
//
// 反刷总闸: 以上写操作共用同一限流 (每人每分钟 ≤ 10 次写), 超了返回
// “操作太快了, 歇会儿再来”. 被封禁玩家全部写操作拒绝.
//
// ---------------------------------------------------------------------------
// 集成片段 (给集成 agent, 不要直接改 App.tsx/MapView.tsx)
// ---------------------------------------------------------------------------
//
// APP SNIPPET 1 — 社区面板 (App.tsx, 手机/社区入口, 与 getGigs/getParties 并列):
//   import { buildNotice, buildSnakeReport, buildFishingSpotReport,
//            feedStrayLocal, strayToAdoptInput, toMapMarkers, validateNotice,
//            validateSnakeReport, validateFishingSpot, type StrayAnimal,
//            type LostFoundNotice, type SnakeReport, type FishingSpotReport }
//     from "./round2/community";
//   const straysQuery = useQuery({ queryKey: ["strays", cityKey],
//     queryFn: () => api.getStrays({ cityKey, playerId }), enabled: phase === "game" });
//   const noticesQuery = useQuery({ queryKey: ["notices", cityKey],
//     queryFn: () => api.getNotices({ cityKey, playerId }), refetchInterval: 120_000 });
//   const snakesQuery = useQuery({ queryKey: ["snakes", cityKey],
//     queryFn: () => api.getSnakeWarnings({ cityKey, playerId }), refetchInterval: 120_000 });
//   const fishingQuery = useQuery({ queryKey: ["fishing", cityKey],
//     queryFn: () => api.getFishingSpots({ cityKey, playerId }), refetchInterval: 300_000 });
//
// APP SNIPPET 2 — 喂流浪动物 (地图标记点击 / 流浪动物详情):
//   const feed = feedStrayLocal(stray); // 本地先显示 note
//   void api.feedStray({ playerId, strayId: stray.id, gameDay }).then((r) => {
//     if (!r.ok) toast(r.error); else straysQuery.refetch(); // 以服务器 trust 为准
//   });
//   // 信任 >= 70 时显示 “收养它” 按钮:
//   const input = strayToAdoptInput(stray, petName, gameDay);
//   if (input) { const r = adoptPet(pets, input); /* 见 pets.ts, 再调 api.syncPets */ }
//
// APP SNIPPET 3 — 发启事 / 上报 (表单提交时):
//   if (!validateNotice(form).ok) return toast(validateNotice(form).error);
//   void api.postNotice({ playerId, ...form }); // 成功后 noticesQuery.refetch()
//   // 蛇: validateSnakeReport → api.reportSnake; 钓点: validateFishingSpot → api.reportFishingSpot
//   // 照片: 先走现有的图片上传 (若无, photoUrl 传 null, 只留文字描述)
//
// MAPVIEW SNIPPET — 社区标记 (round-3 已实现, MapView.tsx):
//   MapView 新增 props: communityMarkers (App 传 toMapMarkers() 的返回值)
//   + onCommunityMarkerClick(marker). MapView 把每条标记画成一张可点的
//   HTML 图钉 (emoji + label, 与地点 / NPC 标签同一套 declutter 流程;
//   蛇警告红色描边、优先级最高, 全城视角也显示), 点一下回调 App 打开
//   对应详情面板; 小地图上是按 COMMUNITY_PIN_COLOR 着色的圆点.
//   没传 communityMarkers 时地图上什么都不多画.
//
