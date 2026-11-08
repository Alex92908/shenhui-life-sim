/* ---- 一天的时间预算 ----
   Every day runs from 8:00 to midnight. Actions, rides and walks spend
   clock time, so a day holds one shift plus an evening — not endless
   rest→work loops. Past midnight only travelling home and sleeping are
   left; staying up costs the next morning's energy. */

export const DAY_START = 8 * 60;
export const DAY_END = 24 * 60;
/** 免费回血（躺平/歇会儿）每天最多几次。 */
export const REST_CAP = 2;
/** 上班打卡最晚几点（之后就算旷工，只能接零活）。 */
export const WORK_LATEST = 13 * 60;

/** Minutes each action takes. Unlisted kinds take an hour. */
const ACTION_MIN: Record<string, number> = {
  rest: 60, work: 480, overtime: 180, interview: 120, "join-company": 30, canteen: 30, "campus-tour": 60,
  gig: 150, eat: 45, wash: 20, cook: 60, "buy-groceries": 30, stroll: 60, fun: 150,
  "learn-course": 120, "learn-self": 120, "apec-staff": 300, "apec-host": 240, "apec-visit": 120,
  "apec-checkin": 30, "apec-task": 180, "mall-shop": 90, "mall-cloth": 60, "mall-promo": 30,
  "health-check": 90, "health-cure": 120, gym: 90, "bank-buy": 30, "bank-sell": 30,
  "social-ktv": 180, "social-drink": 120, "market-phone": 60, "market-fix": 60, checkin: 20,
  "hk-trip": 360, ferry: 90, flight: 180, "buy-medicine": 20, "ask-help": 30, "tourist-map": 15,
  volunteer: 180, hike: 240, story: 30,
};
export function actionMinutes(kind: string): number {
  return ACTION_MIN[kind] ?? 60;
}

/** Ride time for a metro / rail trip. */
export function metroMinutes(stops: number, transfer: boolean): number {
  return Math.round(6 + stops * 2.6 + (transfer ? 6 : 0));
}

export function clockStr(min: number): string {
  const m = Math.round(min) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
export function durLabel(min: number): string {
  if (min < 60) return `${min} 分钟`;
  const h = min / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} 小时`;
}

export interface ClockState {
  day: number;
  minute?: number;
  restDay?: number; restN?: number;
  workDay?: number; otDay?: number;
}
export const nowMin = (s: ClockState) => s.minute ?? DAY_START;

/** Why this action can't be done right now (null = it can). */
export function timeBlock(kind: string, s: ClockState): string | null {
  if (kind === "__sleep") return null;
  const now = nowMin(s);
  if (now >= DAY_END) return "已经过了午夜，回家睡觉吧";
  if (kind === "rest" && s.restDay === s.day && (s.restN ?? 0) >= REST_CAP) return `今天已经歇了 ${REST_CAP} 次，再躺就要躺废了`;
  if (kind === "work") {
    if (s.workDay === s.day) return "今天已经上过班了";
    if (now > WORK_LATEST) return "下午一点后就别去打卡了，今天接零活或者去玩吧";
  }
  if (kind === "overtime") {
    if (s.workDay !== s.day) return "先正常上完班才能加班";
    if (s.otDay === s.day) return "今天已经加过班了";
  }
  return null;
}

/** Next morning's energy after sleeping at `min` (late nights cost energy). */
export function morningEnergy(min: number): { energy: number; note: string } {
  if (min > DAY_END) {
    const loss = Math.min(40, Math.round((min - DAY_END) / 6));
    return { energy: 100 - loss, note: `昨晚熬到 ${clockStr(min)}，早上能量只有 ${100 - loss}。` };
  }
  if (min <= 22 * 60) return { energy: 100, note: "早睡早起，心情 +4。" };
  return { energy: 100, note: "" };
}
