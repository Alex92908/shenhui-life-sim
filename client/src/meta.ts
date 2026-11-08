/* 长线进度 (meta progress) — what survives from one 30-day run to the next.

   A run ends after 30 game days; this file keeps the reasons to come back:
   · 地铁集章: every station you get on / off / change at gets a stamp; a
     completed line pays a reward.
   · 城市图鉴: every real place you reach is logged, grouped by kind.
   · 连续登录: real calendar days in a row, with a growing daily reward.
   · 本周目标: six goals per real (ISO) week.
   · 成就 / 称号: unlocked from all of the above; one can be worn as a title
     that other players see next to your name.
   · 每日城市事件: what is going on in the city today (typhoon, open day …),
     the same for everyone on the same game day and date.

   Stored in this browser (localStorage); all reads/writes tolerate a
   missing or corrupt store. */
import type { CityKey } from "./data";

export interface Meta {
  v: 1;
  stamps: string[];
  atlas: string[];
  linesDone: string[];
  achievements: string[];
  title: string | null;
  companies: string[];
  streak: { last: string; count: number; best: number; claimed: string };
  week: { key: string; prog: Record<string, number>; claimed: string[] };
  runs: number;
  giftsSent: number;
  eventsSeen: string[];
  /** 深漂档案：跨局积累的档案点和已解锁 / 本局带上的传承 */
  legacy: { pts: number; total: number; owned: string[]; equipped: string[]; history: { title: string; pts: number; day: string }[] };
}

const KEY = "shhr-meta-v1";
const blank = (): Meta => ({
  v: 1, stamps: [], atlas: [], linesDone: [], achievements: [], title: null, companies: ["startup"],
  streak: { last: "", count: 0, best: 0, claimed: "" },
  week: { key: "", prog: {}, claimed: [] },
  runs: 0, giftsSent: 0, eventsSeen: [],
  legacy: { pts: 0, total: 0, owned: [], equipped: [], history: [] },
});

export function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const m = JSON.parse(raw) as Partial<Meta>;
    const b = blank();
    const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
    return {
      ...b,
      stamps: arr(m.stamps), atlas: arr(m.atlas), linesDone: arr(m.linesDone), achievements: arr(m.achievements),
      title: typeof m.title === "string" ? m.title : null,
      companies: arr(m.companies).length ? arr(m.companies) : b.companies,
      streak: m.streak && typeof m.streak === "object" ? { ...b.streak, ...m.streak } : b.streak,
      week: m.week && typeof m.week === "object" ? { key: String(m.week.key ?? ""), prog: { ...(m.week.prog ?? {}) }, claimed: arr(m.week.claimed) } : b.week,
      runs: typeof m.runs === "number" ? m.runs : 0,
      giftsSent: typeof m.giftsSent === "number" ? m.giftsSent : 0,
      eventsSeen: arr(m.eventsSeen),
      legacy: m.legacy && typeof m.legacy === "object" ? {
        pts: typeof m.legacy.pts === "number" ? m.legacy.pts : 0,
        total: typeof m.legacy.total === "number" ? m.legacy.total : 0,
        owned: arr(m.legacy.owned), equipped: arr(m.legacy.equipped),
        history: Array.isArray(m.legacy.history) ? m.legacy.history.filter((h) => h && typeof h.title === "string" && typeof h.pts === "number").slice(0, 20) : [],
      } : b.legacy,
    };
  } catch {
    return blank();
  }
}
export function saveMeta(m: Meta): void {
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* private mode / full: progress just isn't kept */ }
}

/* ---- calendar helpers (local time) ---- */
export function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function weekKey(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((t.getTime() - y0.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${wk}`;
}

/* ---- streak ---- */
/** Roll the login streak forward for today; returns whether today is new. */
export function touchStreak(m: Meta, today = dateKey()): boolean {
  if (m.streak.last === today) return false;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const count = m.streak.last === dateKey(y) ? m.streak.count + 1 : 1;
  m.streak = { ...m.streak, last: today, count, best: Math.max(m.streak.best, count) };
  return true;
}
/** Today's streak reward: grows for 7 days, then stays at the top tier. */
export function streakReward(count: number): { money: number; energy: number } {
  const n = Math.min(7, Math.max(1, count));
  return { money: 40 + n * 30, energy: n >= 3 ? 10 : 0 };
}

/* ---- weekly goals ---- */
export interface WeeklyGoal { id: string; emoji: string; name: string; target: number; reward: number }
export const WEEKLY_GOALS: WeeklyGoal[] = [
  { id: "stamps", emoji: "🎫", name: "盖 10 个新站章", target: 10, reward: 300 },
  { id: "places", emoji: "📖", name: "去 6 个没去过的地方", target: 6, reward: 300 },
  { id: "work", emoji: "💼", name: "上班 6 次", target: 6, reward: 200 },
  { id: "rides", emoji: "🚇", name: "坐 8 趟地铁", target: 8, reward: 200 },
  { id: "interviews", emoji: "📝", name: "面试 2 家公司", target: 2, reward: 200 },
  { id: "social", emoji: "🎁", name: "送出或收到 2 份礼物", target: 2, reward: 200 },
];
export function rollWeek(m: Meta, wk = weekKey()): void {
  if (m.week.key !== wk) m.week = { key: wk, prog: {}, claimed: [] };
}
export function bump(m: Meta, id: string, n = 1): void {
  rollWeek(m);
  m.week.prog[id] = (m.week.prog[id] ?? 0) + n;
}

/* ---- achievements / titles ---- */
export interface Achievement { id: string; emoji: string; title: string; desc: string; done: (m: Meta, ctx: { totalStations: number; totalPlaces: number }) => boolean }
export const ACHIEVEMENTS: Achievement[] = [
  { id: "stamp1", emoji: "🎫", title: "地铁新手", desc: "盖下第一个站章", done: (m) => m.stamps.length >= 1 },
  { id: "stamp50", emoji: "🚇", title: "通勤达人", desc: "集齐 50 个站章", done: (m) => m.stamps.length >= 50 },
  { id: "stamp150", emoji: "🗺️", title: "地铁活地图", desc: "集齐 150 个站章", done: (m) => m.stamps.length >= 150 },
  { id: "stampAll", emoji: "👑", title: "深圳地铁通", desc: "集齐深圳全部站章", done: (m, c) => m.stamps.length >= c.totalStations },
  { id: "line1", emoji: "🏁", title: "一线到底", desc: "集齐一整条线的站章", done: (m) => m.linesDone.length >= 1 },
  { id: "line5", emoji: "🌈", title: "五线谱", desc: "集齐 5 条线", done: (m) => m.linesDone.length >= 5 },
  { id: "atlas20", emoji: "📖", title: "城市漫游者", desc: "去过 20 个真实地点", done: (m) => m.atlas.length >= 20 },
  { id: "atlas100", emoji: "🧭", title: "深圳百事通", desc: "去过 100 个真实地点", done: (m) => m.atlas.length >= 100 },
  { id: "bigco", emoji: "🏢", title: "大厂人", desc: "入职一家大厂", done: (m) => m.companies.some((c) => c !== "startup") },
  { id: "hopper", emoji: "🦘", title: "跳槽王", desc: "在 4 家不同的公司上过班", done: (m) => m.companies.length >= 4 },
  { id: "streak7", emoji: "🔥", title: "七日不断", desc: "连续 7 天上线", done: (m) => m.streak.best >= 7 },
  { id: "streak30", emoji: "💎", title: "深漂老炮", desc: "连续 30 天上线", done: (m) => m.streak.best >= 30 },
  { id: "runs3", emoji: "🔁", title: "三世深漂", desc: "过完 3 局 30 天", done: (m) => m.runs >= 3 },
  { id: "gifts10", emoji: "🎁", title: "暖心街坊", desc: "给别的玩家送出 10 份礼物", done: (m) => m.giftsSent >= 10 },
  { id: "events6", emoji: "📰", title: "城市观察员", desc: "经历 6 种不同的城市事件", done: (m) => m.eventsSeen.length >= 6 },
];
/** Unlock whatever is newly earned; returns the new ones. */
export function checkAchievements(m: Meta, ctx: { totalStations: number; totalPlaces: number }): Achievement[] {
  const fresh = ACHIEVEMENTS.filter((a) => !m.achievements.includes(a.id) && a.done(m, ctx));
  if (fresh.length) m.achievements = [...m.achievements, ...fresh.map((a) => a.id)];
  return fresh;
}

/* ---- 每日城市事件 ---- */
export interface CityEvent {
  id: string; emoji: string; name: string; desc: string;
  /** Effects the game applies today. */
  metroFree?: boolean; mallMul?: number; eatMul?: number; eatMood?: number; payMul?: number;
  funMood?: number; beachClosed?: boolean; taxiMul?: number;
  /** 大厂开放日: this company's bar drops (skill -1, xp -4). */
  openDay?: string;
  /** 地铁站快闪: stamping this station today gives a bonus. */
  flashStation?: string;
}
const EVENTS: Omit<CityEvent, "openDay" | "flashStation">[] = [
  { id: "typhoon", emoji: "🌀", name: "台风预警", desc: "海滩和海边景区今天关闭，打车加价 50%，地铁照常。", beachClosed: true, taxiMul: 1.5 },
  { id: "greenday", emoji: "🚇", name: "绿色出行日", desc: "今天坐地铁全程免费。", metroFree: true },
  { id: "mallsale", emoji: "🛍️", name: "商场大促", desc: "各大商场今天 6 折。", mallMul: 0.6 },
  { id: "foodfest", emoji: "🍢", name: "夜市美食节", desc: "吃东西 7 折，心情额外 +5。", eatMul: 0.7, eatMood: 5 },
  { id: "bonus", emoji: "💰", name: "发奖金日", desc: "今天上班、加班工资 ×1.3。", payMul: 1.3 },
  { id: "concert", emoji: "🎶", name: "公园音乐会", desc: "公园、景点、海边玩一次，心情额外 +8。", funMood: 8 },
  { id: "openday", emoji: "🏢", name: "大厂开放日", desc: "" },
  { id: "flash", emoji: "🎤", name: "地铁站快闪", desc: "" },
];
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** Today's event — shared by everyone on the same date, city and game day. */
export function dailyEvent(cityKey: CityKey, gameDay: number, companies: { id: string; short: string; city?: CityKey }[], stations: string[], date = dateKey()): CityEvent {
  const h = hash(`${date}|${cityKey}|${gameDay}`);
  let base = EVENTS[h % EVENTS.length]!;
  // Huizhou has no metro: no station flash mob there (a food festival instead),
  // and the free-ride day is for the intercity rail
  if (cityKey === "hz" && base.id === "flash") base = EVENTS[3]!;
  if (cityKey === "hz" && base.id === "greenday") return { ...base, desc: "今天坐城轨全程免费。" };
  if (base.id === "openday") {
    const pool = companies.filter((c) => c.id !== "startup" && (c.city ?? "sz") === cityKey);
    if (pool.length === 0) return { ...EVENTS[2]!, };
    const co = pool[(h >>> 8) % pool.length]!;
    return { ...base, openDay: co.id, desc: `${co.short}今天开放日：面试门槛降低（技能 -1、经验 -4），园区参观还送经验。` };
  }
  if (base.id === "flash") {
    const st = stations[(h >>> 8) % Math.max(1, stations.length)] ?? "";
    return { ...base, flashStation: st, desc: `今天「${st}」站有快闪演出：在这站上下车盖章，额外 ¥88、心情 +10。` };
  }
  return base;
}
