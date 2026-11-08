/* ---- 真实时间 ----
   The game runs on the REAL clock in Beijing time (Asia/Shanghai, the
   same clock the 3D sky already follows):
   - game day N = N days since the season started (for this season, the
     1st of November 2026, so day N = 11 月 N 日 — the Summit really is on
     the 14th–19th);
   - you can't sleep to skip ahead: the day turns over at real midnight,
     and days you missed are lived for you (simulated shift, meals, rent);
   - an action doesn't burn game hours any more, it puts you on a real
     cooldown (1 in-game hour = 3 real minutes), so a shift takes 24 real
     minutes and you can chat, shop online or plan meanwhile;
   - real-world services keep real hours: the metro stops at night, malls
     open at 10, museums close on Mondays, bar streets come alive after 7. */
import type { CityKey, Loc } from "./data";

export const DAY_START = 8 * 60;
export const DAY_END = 24 * 60;
export const REST_CAP = 2;
/** Real ms of cooldown per in-game minute (1 game hour = 3 real minutes). */
export const COOLDOWN_MS_PER_MIN = 3000;
export const SEASON_START = "2026-11-01";

/* ---------- Beijing time ---------- */
export interface BJ { y: number; mo: number; d: number; min: number; sec: number; dow: number; key: string }
export function bjNow(at = new Date()): BJ {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", weekday: "short", hour12: false }).formatToParts(at);
    const g = (t: string) => parts.find((x) => x.type === t)?.value ?? "0";
    const y = Number(g("year")), mo = Number(g("month")), d = Number(g("day"));
    const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(g("weekday"));
    return { y, mo, d, min: (Number(g("hour")) % 24) * 60 + Number(g("minute")), sec: Number(g("second")), dow: dow < 0 ? 0 : dow, key: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
  } catch {
    const n = at; return { y: n.getFullYear(), mo: n.getMonth() + 1, d: n.getDate(), min: n.getHours() * 60 + n.getMinutes(), sec: n.getSeconds(), dow: (n.getDay() + 6) % 7, key: n.toISOString().slice(0, 10) };
  }
}
const dayNum = (key: string) => Math.floor(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) / 86_400_000);
/** Game day for today's Beijing date, counting from the season start (1-based). */
export function realGameDay(startKey = SEASON_START, at = new Date()): number {
  return dayNum(bjNow(at).key) - dayNum(startKey) + 1;
}
/** 赛季 = 北京时间的一个自然月：本局从这个月 1 号算起，月底全服结算。 */
export function seasonStartFor(at = new Date()): string {
  const t = bjNow(at);
  return `${t.y}-${String(t.mo).padStart(2, "0")}-01`;
}
/** Days in the season's month (28–31). */
export function seasonLength(startKey = SEASON_START): number {
  const y = Number(startKey.slice(0, 4)), m = Number(startKey.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export const seasonMonth = (startKey = SEASON_START) => Number(startKey.slice(5, 7));
/** Real minutes since midnight, Beijing time. The argument is ignored (kept for call sites). */
export const nowMin = (_s?: unknown) => bjNow().min;

export function clockStr(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
export function durLabel(min: number): string {
  if (min < 60) return `${Math.round(min)} 分钟`;
  const h = min / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} 小时`;
}
/** "3:05" style countdown for a ms span. */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
/** A window [from, to) in minutes; `to` past 1440 wraps over midnight. */
export function inWindow(min: number, w: [number, number]): boolean {
  return w[1] > 1440 ? min >= w[0] || min < w[1] - 1440 : min >= w[0] && min < w[1];
}
export const windowStr = (w: [number, number]) => `${clockStr(w[0])}–${w[1] === 1440 ? "24:00" : clockStr(w[1])}`;

/* ---------- action cooldowns ---------- */
const ACTION_MIN: Record<string, number> = {
  rest: 60, work: 480, overtime: 180, interview: 120, "join-company": 30, canteen: 30, "campus-tour": 60,
  gig: 150, eat: 45, wash: 20, cook: 60, "buy-groceries": 30, stroll: 60, fun: 150,
  "learn-course": 120, "learn-self": 120, "apec-staff": 300, "apec-host": 240, "apec-visit": 120,
  "apec-checkin": 30, "apec-task": 180, "mall-shop": 90, "mall-cloth": 60, "mall-promo": 30,
  "health-check": 90, "health-cure": 120, gym: 90, "bank-buy": 30, "bank-sell": 30,
  "social-ktv": 180, "social-drink": 120, "market-phone": 60, "market-fix": 60, checkin: 20,
  "hk-trip": 360, ferry: 90, flight: 180, "buy-medicine": 20, "ask-help": 30, "tourist-map": 15,
  volunteer: 180, hike: 240, story: 30, sleep: 100,
};
export function actionMinutes(kind: string): number { return ACTION_MIN[kind] ?? 60; }
export const cooldownMs = (gameMin: number, fast = false) => Math.round(gameMin * COOLDOWN_MS_PER_MIN * (fast ? 0.8 : 1));
export const realMinLabel = (gameMin: number, fast = false) => { const m = cooldownMs(gameMin, fast) / 60000; return m < 1 ? `${Math.round(m * 60)} 秒` : `${+m.toFixed(1)} 分钟`; };

export interface ClockState {
  day: number;
  restDay?: number; restN?: number;
  workDay?: number; otDay?: number;
  busyUntil?: number; busyWhat?: string;
}
/** Why this action can't be done right now (null = it can). */
export function timeBlock(kind: string, s: ClockState, at = Date.now()): string | null {
  if (s.busyUntil && at < s.busyUntil) return `正在${s.busyWhat ?? "忙"}，还要 ${countdown(s.busyUntil - at)}`;
  if (kind === "__sleep") return null;
  if (kind === "rest" && s.restDay === s.day && (s.restN ?? 0) >= REST_CAP) return `今天已经歇了 ${REST_CAP} 次，再躺就要躺废了`;
  if (kind === "work" && s.workDay === s.day) return "今天已经上过班了";
  if (kind === "overtime") {
    if (s.workDay !== s.day) return "先正常上完班才能加班";
    if (s.otDay === s.day) return "今天已经加过班了";
  }
  return null;
}

/* ---------- real opening hours ---------- */
/** Urban rail runs ~6:30–23:30 in Shenzhen; the Huizhou intercity stops earlier. */
/** 港铁大多 6:00 到凌晨 1 点左右。 */
export const RAIL_HOURS: Record<CityKey, [number, number]> = { sz: [390, 1410], hz: [390, 1350], hk: [360, 1500] };
export const MODE_HOURS: Partial<Record<string, [number, number]>> = { bus: [360, 1380], ferry: [480, 1260], flight: [360, 1410] };

/** Parse simple OSM opening_hours like "09:00-18:00" or "Mo-Su 10:00-22:00". */
function parseHours(h: string | undefined): [number, number] | null {
  if (!h) return null;
  if (/24\/7/.test(h)) return [0, 1440];
  const m = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/.exec(h);
  if (!m) return null;
  const a = Number(m[1]) * 60 + Number(m[2]); let b = Number(m[3]) * 60 + Number(m[4]);
  if (b <= a) b += 1440;
  return [a, b];
}
export interface VenueHours { w: [number, number]; closedMon?: boolean; weekdaysOnly?: boolean }
/** Real-world opening hours for a place (null = always open: homes, offices, streets, parks). */
export function venueHours(l: Loc): VenueHours | null {
  const parsed = parseHours(l.hours);
  if (parsed) return { w: parsed };
  if (l.placeKind === "museum" || /博物馆|美术馆/.test(l.name)) return { w: [540, 1050], closedMon: true };
  if (l.placeKind === "library" || l.type === "learn") return { w: [540, 1290] };
  if (l.type === "mall" || l.placeKind === "mall") return { w: [600, 1320] };
  if (l.type === "bank") return { w: [540, 1020], weekdaysOnly: true };
  if (l.type === "social") return { w: [1080, 1620] };
  if (l.type === "food") return { w: [420, 1560] };
  if (l.type === "market") return { w: [480, 1320] };
  if (l.placeKind === "themepark" || /欢乐谷|世界之窗|锦绣中华|野生动物园|东部华侨城|欢乐海岸|青青世界|海上田园|光明农场/.test(l.name)) return { w: [570, 1260] };
  if (l.type === "mountain" || l.placeKind === "peak") return { w: [360, 1080] };
  if (l.type === "port" && /罗湖|深圳湾|福田|莲塘/.test(l.name)) return { w: [390, 1440] };
  return null;
}
/** null when open now, else a short "closed" reason. */
export function venueClosed(l: Loc, at = new Date()): string | null {
  const v = venueHours(l); if (!v) return null;
  const t = bjNow(at);
  if (v.closedMon && t.dow === 0) return "周一闭馆";
  if (v.weekdaysOnly && t.dow >= 5) return "周末不营业";
  return inWindow(t.min, v.w) ? null : `已打烊（营业 ${windowStr(v.w)}）`;
}
