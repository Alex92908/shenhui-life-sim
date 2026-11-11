/* ---- round-2 (f): 三和日结 + 失业躺平 — Sanhe day labor & lying flat ----
   Implements the design in
   ~/workspace/goals/shenhui-life-sim-launch/files/round-2-lying-flat-design-2026-11-11.md
   (authoritative; this module follows it, it does not re-invent it).

   ONE PRINCIPLE (lee): lying flat is NOT punishment and NOT a dead end. It is a
   dignified path with a way out. The game gives the player the chances lee
   did not have in real life: small opportunities, being seen, a hand offered.

   THREE PILLARS:
   (1) HEALING — lying flat restores energy/mood (no "the more you lie flat the
       more you lose" loop). One "small joy" a day (sunrise at the beach, a park
       bench, feeding a stray cat, catching a fish, cooking a meal) raises the
       mood cap. NPCs encourage, never mock. No "falling behind" judgment.
       After a few days a "someone comes to check on you" event fires — accept
       help or politely decline. An adopted stray cat/dog follows the player
       (companionship is itself healing; the pet system itself lives in
       round2/pets.ts, area (c) — this module only reads its `petFollows` flag).
   (2) SURVIVAL — Sanhe bunk ¥20/day, daily-pay shifts, internet-cafe nights and
       cheap meals are the floor: money is tight but never "one day and you're
       done". Rent pressure has exits (installments / delay / work-for-rent) and
       black-landlord reporting hooks into area (d). Selling second-hand items
       and subletting hook into area (e).
   (3) A WAY OUT — the 就业服务中心 (job service center), anchored on an EXISTING
       civic/service place (see isJobCenterPlace — no new map art): (a) job search
       filtered by the player's skills/gigs, with a VISIBLE ladder
       daily-pay → short-term → stable job; (b) skill training with an NPC
       counselor who SUGGESTS a route (never a forced task), 3–6 day short
       courses with a small living allowance; (c) mock interviews with NO mood
       penalty, and 3-day trial work (good → permanent, bad → leave with daily
       pay, no black mark).

   Progress is a "重新出发" (fresh start) bar, never a failure meter.
   Unemployment days are shown as "第 X 天，有 Y 个机会在等你" — never a shame
   number. Continuing to lie flat is allowed, without punishment.

   DON'Ts (from the design doc): no mocking/shaming language, no countdown
   pressure, no death-by-starvation, no preaching — the counselor suggests, the
   player chooses. Round-2 branch only; the launch build is untouched.

   This module is UI-free and pure: every action takes state + a small context
   and returns { state, delta, lines, ok }. App.tsx (integration agent) applies
   `delta` to GameState and renders `lines` as toasts/panel text. Nothing here
   touches GameState, the DOM, or the server directly — the server surface this
   needs is specified in LIFESTYLE_SERVER_SPEC at the bottom for area (S).
   Money figures are ¥/day unless noted. All copy is bilingual: L2 = [中文, English].
*/
import { sanhePay } from "../ads";
import type { CityKey, Loc } from "../data";

export type L2 = [string, string];

/* ================= shared plumbing ================= */

/** Numeric fields this module may move on GameState. App.tsx clamps to 0–100
    (mood clamps to 100 + life.flat.moodCapBonus — see integration snippet). */
export interface StatDelta {
  money?: number; energy?: number; mood?: number; hunger?: number;
  clean?: number; social?: number; fun?: number; xp?: number; skill?: number;
  network?: number; fit?: number; earned?: number;
}

/** What every action returns. `extra` carries machine-readable outcomes the
    UI needs (hired identity, rent deferral, an unlocked listing, …). */
export interface LifeResult {
  state: LifestyleState;
  delta: StatDelta;
  /** Toast / panel lines, shown in order. */
  lines: L2[];
  ok: boolean;
  reason?: L2;
  hiredIdentityId?: string;
  rentDelayDays?: number;
  rentDueMul?: number;
  unlockListingId?: string;
  gigLeadId?: string;
}

const ok = (state: LifestyleState, delta: StatDelta, lines: L2[], extra?: Partial<LifeResult>): LifeResult =>
  ({ state, delta, lines, ok: true, ...extra });
const fail = (state: LifestyleState, reason: L2): LifeResult =>
  ({ state, delta: {}, lines: [], ok: false, reason });

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

/* ================= state ================= */

export interface CourseEnroll {
  id: string; startDay: number; days: number; done: boolean;
  /** Allowance days already paid out, so a reloaded save never double-pays. */
  allowancePaid: number;
}
export interface JobApplication {
  listingId: string; day: number;
  status: "applied" | "trial" | "hired" | "left";
}
export interface TrialState { listingId: string; startDay: number; daysWorked: number; totalScore: number; }

/** The lying-flat / unemployed side. `unemployedSinceDay === 0` means the
    player is currently employed (or has never been unemployed in this run). */
export interface FlatState {
  unemployedSinceDay: number;
  /** Day the last "small joy" was done; 0 = never. */
  joyDay: number;
  joyCount: number;
  /** Mood-cap bonus from small joys, 0–15. Mood clamps at 100 + this. */
  moodCapBonus: number;
  /** Day the check-in event fired; 0 = not yet fired. */
  checkinDay: number;
  checkinDone: boolean;
  /** "重新出发" progress, 0–100. Rises with every step forward, never falls. */
  hope: number;
  /** Counselor-suggested route id, or null if none suggested yet. */
  routeId: string | null;
  courses: CourseEnroll[];
  interviews: number;
  /** Mock-interview readiness, 0–100. */
  interviewReady: number;
  applications: JobApplication[];
  trial: TrialState | null;
  /** A tiny street stall — the smallest start. Grows into the shop system. */
  stall: { kind: string; day: number; lvl: number } | null;
  rentTalks: number;
  /** Neighbors helped (community gigs / small favors). */
  helped: number;
  /** Set by round2/pets.ts (area c) when an adopted stray follows the player. */
  petFollows: boolean;
}

/** The Sanhe day-laborer side. Both sides can be live at once: a day laborer
    can also be on the lying-flat path, and vice versa. */
export interface SanheState {
  /** Last game day a shift was settled (mirrors the existing sanheDay rule:
      one settled shift per day). */
  shiftDay: number;
  shiftsDone: number;
  cashEarned: number;
  /** "做一天玩三天" rhythm, counted in days. */
  workDays: number;
  restDays: number;
  sleepChoice: "bunk" | "cafe" | "bench" | "home" | null;
  /** Fellow laborers met (ids in SANHE_MATES). */
  mates: string[];
  mateBond: Record<string, number>;
}

export interface LifestyleState { flat: FlatState; sanhe: SanheState; }

export function defaultLifestyleState(): LifestyleState {
  return {
    flat: {
      unemployedSinceDay: 0, joyDay: 0, joyCount: 0, moodCapBonus: 0,
      checkinDay: 0, checkinDone: false, hope: 0, routeId: null, courses: [],
      interviews: 0, interviewReady: 0, applications: [], trial: null,
      stall: null, rentTalks: 0, helped: 0, petFollows: false,
    },
    sanhe: {
      shiftDay: 0, shiftsDone: 0, cashEarned: 0, workDays: 0, restDays: 0,
      sleepChoice: null, mates: [], mateBond: {},
    },
  };
}

/** Defensive loader for saves (old saves have no `life` field at all). */
export function sanitizeLifestyleState(raw: unknown): LifestyleState {
  const d = defaultLifestyleState();
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;
  const f = (r.flat ?? {}) as Record<string, unknown>;
  const s = (r.sanhe ?? {}) as Record<string, unknown>;
  const courses = Array.isArray(f.courses) ? f.courses : [];
  const applications = Array.isArray(f.applications) ? f.applications : [];
  return {
    flat: {
      unemployedSinceDay: num(f.unemployedSinceDay, 0),
      joyDay: num(f.joyDay, 0), joyCount: num(f.joyCount, 0),
      moodCapBonus: clamp(num(f.moodCapBonus, 0), 0, 15),
      checkinDay: num(f.checkinDay, 0), checkinDone: f.checkinDone === true,
      hope: clamp(num(f.hope, 0), 0, 100),
      routeId: typeof f.routeId === "string" ? f.routeId : null,
      courses: courses.filter((c): c is CourseEnroll =>
        !!c && typeof c === "object" && typeof (c as CourseEnroll).id === "string").map((c) => ({
        id: c.id, startDay: num(c.startDay, 0), days: clamp(num(c.days, 3), 3, 6),
        done: c.done === true, allowancePaid: num(c.allowancePaid, 0),
      })),
      interviews: num(f.interviews, 0),
      interviewReady: clamp(num(f.interviewReady, 0), 0, 100),
      applications: applications.filter((a): a is JobApplication =>
        !!a && typeof a === "object" && typeof (a as JobApplication).listingId === "string").map((a) => ({
        listingId: a.listingId, day: num(a.day, 0),
        status: a.status === "trial" || a.status === "hired" || a.status === "left" ? a.status : "applied",
      })),
      trial: f.trial && typeof f.trial === "object" ? {
        listingId: String((f.trial as TrialState).listingId ?? ""),
        startDay: num((f.trial as TrialState).startDay, 0),
        daysWorked: num((f.trial as TrialState).daysWorked, 0),
        totalScore: num((f.trial as TrialState).totalScore, 0),
      } : null,
      stall: f.stall && typeof f.stall === "object" ? {
        kind: String((f.stall as { kind: unknown }).kind ?? ""),
        day: num((f.stall as { day: unknown }).day, 0),
        lvl: num((f.stall as { lvl: unknown }).lvl, 1),
      } : null,
      rentTalks: num(f.rentTalks, 0), helped: num(f.helped, 0),
      petFollows: f.petFollows === true,
    },
    sanhe: {
      shiftDay: num(s.shiftDay, 0), shiftsDone: num(s.shiftsDone, 0),
      cashEarned: num(s.cashEarned, 0), workDays: num(s.workDays, 0),
      restDays: num(s.restDays, 0),
      sleepChoice: s.sleepChoice === "bunk" || s.sleepChoice === "cafe" || s.sleepChoice === "bench" || s.sleepChoice === "home"
        ? s.sleepChoice : null,
      mates: Array.isArray(s.mates) ? s.mates.filter((m): m is string => typeof m === "string") : [],
      mateBond: (s.mateBond && typeof s.mateBond === "object" ? s.mateBond : {}) as Record<string, number>,
    },
  };
}

/** Minimal snapshot of the player the lifestyle systems filter on. App.tsx
    builds this from GameState (skill / xp / gig history) at the call site. */
export interface PlayerProfile {
  skill: number; xp: number;
  /** Ids of gigs / activities the player has done (e.g. "fish_sea", "cook"). */
  gigs: string[];
  coursesDone: string[];
  interviewReady: number;
  day: number; city: CityKey;
}

const clone = (s: LifestyleState): LifestyleState =>
  ({ flat: { ...s.flat, courses: s.flat.courses.map((c) => ({ ...c })), applications: s.flat.applications.map((a) => ({ ...a })), trial: s.flat.trial ? { ...s.flat.trial } : null, stall: s.flat.stall ? { ...s.flat.stall } : null }, sanhe: { ...s.sanhe, mates: [...s.sanhe.mates], mateBond: { ...s.sanhe.mateBond } } });

/** Hope only ever rises. Returns the new state plus any milestone just crossed. */
function addHope(s: LifestyleState, n: number): { state: LifestyleState; crossed: number[] } {
  const next = clone(s);
  const before = next.flat.hope;
  next.flat.hope = clamp(next.flat.hope + n, 0, 100);
  const crossed = HOPE_MILESTONES.filter((m) => before < m.at && next.flat.hope >= m.at).map((m) => m.at);
  return { state: next, crossed };
}

/** Days unemployed so far (0 while employed). */
export function flatDays(state: LifestyleState, day: number): number {
  return state.flat.unemployedSinceDay > 0 ? Math.max(0, day - state.flat.unemployedSinceDay + 1) : 0;
}

/** Mark the player unemployed (job lost / quit / never had one). Call once. */
export function markUnemployed(state: LifestyleState, day: number): LifestyleState {
  if (state.flat.unemployedSinceDay > 0) return state;
  const next = clone(state);
  next.flat.unemployedSinceDay = day;
  return next;
}

/** Mark the player employed again (hired through the ladder, or any other
    job). Clears the unemployment clock but KEEPS hope and mood-cap bonus —
    what was built while flat stays built. */
export function markEmployed(state: LifestyleState): LifestyleState {
  const next = clone(state);
  next.flat.unemployedSinceDay = 0;
  next.flat.checkinDay = 0;
  next.flat.checkinDone = false;
  return next;
}

/* ================= (f-1) SANHE DAY LABORER — 三和大神 =================
   Living day-to-day on daily pay. A legitimate way to play, not a failure
   state. One settled shift per day (same rule as the existing "站一天 · 日结"
   button in App.tsx); the board just gives the day a shape — what the work
   was, what it paid, what it cost the body. Cash is in hand the same day. */

/** A day's work, picked up at the labor market. `payMul` multiplies
    sanhePay(city) — the existing per-city daily-pay base (SZ ¥220 / HZ ¥160 /
    HK ¥200). Hours are minutes since midnight. */
export interface SanheShift {
  id: string; emoji: string; name: L2; desc: L2;
  payMul: number; energy: number; hunger: number;
  hours: [number, number]; xp: number; skill?: number; tags: string[];
}
export const SANHE_SHIFTS: SanheShift[] = [
  { id: "warehouse", emoji: "📦", name: ["仓库分拣", "Warehouse sorting"], desc: ["流水线上下货，分拣打包。活儿稳，管一顿饭。", "Load, sort, pack. Steady work, and they feed you."], payMul: 1, energy: 20, hunger: 8, hours: [8 * 60, 18 * 60], xp: 2, tags: ["logistics"] },
  { id: "construction", emoji: "👷", name: ["工地搬砖", "Construction haul"], desc: ["绑钢筋、搬砖、浇混凝土。日结里给得最高的，身体也最累。", "Rebar, bricks, concrete. The best day pay — and the hardest on the body."], payMul: 1.45, energy: 26, hunger: 16, hours: [7 * 60, 18 * 60], xp: 2, skill: 1, tags: ["construction"] },
  { id: "moving", emoji: "🚚", name: ["搬家帮工", "Moving help"], desc: ["跟车去帮人搬家，上下楼扛家具。做完当场结钱。", "Ride along and haul furniture up the stairs. Paid on the spot."], payMul: 1.2, energy: 22, hunger: 12, hours: [8 * 60, 17 * 60], xp: 2, tags: ["logistics"] },
  { id: "flyer", emoji: "📄", name: ["发传单", "Flyer handouts"], desc: ["路口站一天发传单。钱最少，但最轻省，还能顺便看看城。", "Hand out flyers at the crossing all day. Least pay, lightest work — and you get to watch the city."], payMul: 0.6, energy: 12, hunger: 8, hours: [9 * 60, 18 * 60], xp: 1, tags: ["street"] },
  { id: "harbor", emoji: "⚓", name: ["渔港帮工", "Harbor hand"], desc: ["渔船靠岸卸货、分鱼、洗甲板。沾点鱼腥味，管一顿海鲜饭。", "Unload the boats, sort the catch, hose the deck. Smells of fish; they feed you seafood rice."], payMul: 1.1, energy: 21, hunger: 8, hours: [5 * 60, 14 * 60], xp: 2, tags: ["fish", "harbor"] },
  { id: "market", emoji: "🧺", name: ["市集帮工", "Market stall help"], desc: ["帮摊主搬货、看摊、吆喝。收摊后常能带点剩菜回去。", "Help a stallholder haul, mind the stall, call out to customers. Leftovers often come home with you."], payMul: 0.9, energy: 16, hunger: 6, hours: [6 * 60, 15 * 60], xp: 2, tags: ["market"] },
];

/** Take today's shift. One per day — if today is already settled, it fails
    with a reason instead of double-paying (same guard as takeSanhe). */
export function takeSanheShift(state: LifestyleState, shiftId: string, day: number, city: CityKey, energy: number): LifeResult {
  const shift = SANHE_SHIFTS.find((s) => s.id === shiftId);
  if (!shift) return fail(state, ["没有这个活儿。", "No such shift."]);
  if (state.sanhe.shiftDay === day) return fail(state, ["今天这单结过了，明天再来。", "Already settled today. Come back tomorrow."]);
  if (energy < shift.energy) return fail(state, ["能量不够，先喘口气再干。", "Not enough energy — catch your breath first."]);
  const pay = Math.round(sanhePay(city) * shift.payMul);
  const next = clone(state);
  next.sanhe.shiftDay = day;
  next.sanhe.shiftsDone += 1;
  next.sanhe.cashEarned += pay;
  next.sanhe.workDays += 1;
  const { state: hoped } = addHope(next, 2);
  return ok(hoped,
    { money: pay, earned: pay, energy: -shift.energy, hunger: -shift.hunger, xp: shift.xp, skill: shift.skill ?? 0 },
    [[`干完${shift.name[0]}，现金 ¥${pay} 当场到手。`, `Finished ${shift.name[1]} — ¥${pay} cash in hand, same day.`],
     ["做一天，玩三天。这单结了，明后天是自己的。", "One day on, three days off. This job is paid — the next two are yours."]]);
}

/** "做一天玩三天" — where the player stands in the rhythm. Pure display. */
export function sanheRhythm(state: LifestyleState): L2 {
  const { workDays, restDays } = state.sanhe;
  if (workDays === 0) return ["还没开过工。人才市场门口站一站，有活就上。", "No shifts yet. Stand at the labor market a while — take work when there is work."];
  if (restDays >= workDays * 2) return [`做 ${workDays} 天，玩 ${restDays} 天——这节奏对味了。`, `Worked ${workDays} days, played ${restDays} — that's the rhythm.`];
  return [`做了 ${workDays} 天，歇了 ${restDays} 天。想歇就歇，活儿明天还有。`, `Worked ${workDays} days, rested ${restDays}. Rest when you want — there will be work tomorrow.`];
}

/* ---------- cheap sleep — where the night is spent ---------- */

export interface SleepOption {
  id: "bunk" | "cafe" | "bench" | "home";
  emoji: string; name: L2; desc: L2; cost: number;
  energy: number; hunger: number; mood: number; clean: number; fun: number;
}
export const SANHE_SLEEP: SleepOption[] = [
  { id: "bunk", emoji: "🛏️", name: ["三和床位 · ¥20", "Sanhe bunk · ¥20"], desc: ["一张床位，一晚二十。不签合同，先到先住。", "A bed for the night, twenty yuan. No contract — first come, first served."], cost: 20, energy: 30, hunger: 0, mood: 2, clean: -4, fun: 0 },
  { id: "cafe", emoji: "🖥️", name: ["网吧过夜 · ¥30", "Internet cafe night · ¥30"], desc: ["包夜上网，泡面管饱。椅子上眯一觉，天亮再说。", "All-night PC, instant noodles included. Doze in the chair; morning will sort itself out."], cost: 30, energy: 22, hunger: 20, mood: 4, clean: -6, fun: 6 },
  { id: "bench", emoji: "🌙", name: ["长椅将就一晚 · 免费", "Park bench · free"], desc: ["星空下将就一晚。免费，就是早上起来腰有点酸。", "Sleep under the stars, free. Your back will complain a little in the morning."], cost: 0, energy: 14, hunger: 0, mood: 2, clean: -8, fun: 0 },
  { id: "home", emoji: "🏠", name: ["回自己家睡", "Sleep at home"], desc: ["自己的床，还是最舒服的。", "Your own bed is still the best one."], cost: 0, energy: 36, hunger: 0, mood: 4, clean: 0, fun: 0 },
];

/** Sleep for the night. Fails only when the player cannot afford the option —
    the bench is always free, so there is never a "no place to sleep" dead end. */
export function sanheSleep(state: LifestyleState, sleepId: SleepOption["id"], money: number): LifeResult {
  const opt = SANHE_SLEEP.find((s) => s.id === sleepId);
  if (!opt) return fail(state, ["没有这种过夜法。", "No such way to spend the night."]);
  if (money < opt.cost) return fail(state, ["钱不够——长椅不要钱，先将就一晚。", "Not enough cash — the bench is free, take it for tonight."]);
  const next = clone(state);
  next.sanhe.sleepChoice = opt.id;
  return ok(next,
    { money: -opt.cost, energy: opt.energy, hunger: opt.hunger, mood: opt.mood, clean: opt.clean, fun: opt.fun },
    [[`${opt.name[0]}。${opt.desc[0]}`, `${opt.name[1]}. ${opt.desc[1]}`]]);
}

/* ---------- cheap eats ---------- */

export interface CheapEat { id: string; emoji: string; name: L2; desc: L2; cost: number; hunger: number; mood: number; }
export const SANHE_EATS: CheapEat[] = [
  { id: "noodles", emoji: "🍜", name: ["泡面 · ¥5", "Instant noodles · ¥5"], desc: ["热水一冲，三分钟就是一顿。", "Hot water, three minutes, that's dinner."], cost: 5, hunger: 25, mood: 0 },
  { id: "fastfood", emoji: "🍱", name: ["快餐 · ¥12", "Budget lunchbox · ¥12"], desc: ["两荤一素，管饱。打工人的午饭标配。", "Two mains, one veg, all you can eat. The day laborer's standard lunch."], cost: 12, hunger: 38, mood: 2 },
  { id: "marketmeal", emoji: "🥬", name: ["菜市便宜饭 · ¥15", "Market meal · ¥15"], desc: ["菜市边上的小店，现炒现卖，热乎。", "A little place by the wet market — cooked fresh, served hot."], cost: 15, hunger: 46, mood: 3 },
];

export function sanheEat(state: LifestyleState, eatId: string, money: number): LifeResult {
  const eat = SANHE_EATS.find((e) => e.id === eatId);
  if (!eat) return fail(state, ["没有这道饭。", "No such meal."]);
  if (money < eat.cost) return fail(state, ["钱不够，先吃碗泡面顶一顶。", "Not enough cash — noodles will hold you over."]);
  return ok(state, { money: -eat.cost, hunger: eat.hunger, mood: eat.mood },
    [[`${eat.name[0]}。${eat.desc[0]}`, `${eat.name[1]}. ${eat.desc[1]}`]]);
}

/* ---------- the social side — other day laborers ---------- */

export interface SanheMate {
  id: string; emoji: string; name: L2; role: L2; lines: L2[]; tip: L2;
  /** Short-term listing this mate can point the player at once bond ≥ 50. */
  gigLeadId: string;
}
export const SANHE_MATES: SanheMate[] = [
  { id: "laochen", emoji: "👴", name: ["老陈", "Old Chen"], role: ["在三和待了十年的老哥", "Ten years at Sanhe"], gigLeadId: "short-guard",
    lines: [["「慢慢来，急不得。活儿天天有，身体只有一个。」", "\"Take it slow. There's work every day, but only one body.\""],
            ["「我年轻时也急，后来明白了：做一天，玩三天，日子照样过。」", "\"I rushed when I was young too. Then I learned: one day on, three off — life goes on.\""]],
    tip: ["「想找稳当点的活？去保安亭问问，他们常年缺替班。」", "\"Want something steadier? Ask at the security booth — they always need cover shifts.\""] },
  { id: "aqiang", emoji: "🧑", name: ["阿强", "A-Qiang"], role: ["攒钱买手机的年轻人", "Young, saving for a phone"], gigLeadId: "short-courier",
    lines: [["「我这个月攒了八百，再干两个月就能换手机了。」", "\"Saved eight hundred this month. Two more months and I get the phone.\""],
            ["「你也别老一个人闷着，晚上网吧开黑不？」", "\"Don't sit alone all evening — fancy a game at the cafe tonight?\""]],
    tip: ["「快递站招分拣短工，按件算，干得多挣得多。」", "\"The courier depot needs short-term sorters — paid per parcel. The more you do, the more you earn.\""] },
  { id: "dajie", emoji: "👩", name: ["菜市大姐", "Market Auntie"], role: ["市集摊主，常年找帮工", "Stallholder, always needs a hand"], gigLeadId: "short-waiter",
    lines: [["「小伙子手脚勤快，收摊的剩菜拿回去，别浪费。」", "\"You're quick on your feet — take the leftovers home, don't let them go to waste.\""],
            ["「我那餐馆亲戚缺个帮工，你要愿意，我帮你问问。」", "\"My cousin's restaurant needs a helper. If you're up for it, I'll ask for you.\""]],
    tip: ["「想学点手艺？餐馆后厨缺人，管饭，还能学两手。」", "\"Want to learn a trade? Restaurant kitchens need hands — they feed you, and you pick up skills.\""] },
  { id: "ahui", emoji: "🎣", name: ["阿辉", "A-Hui"], role: ["以前打鱼，现在打零工", "Used to fish, now takes day work"], gigLeadId: "short-harbor",
    lines: [["「我以前天天出海。现在岸上也挺好，至少晚上能睡个整觉。」", "\"I used to be out at sea every day. Shore life is fine too — at least I sleep through the night now.\""],
            ["「渔港早上缺卸货的人，手脚麻利的一上午就结钱。」", "\"The harbor needs unloaders in the morning — quick hands get paid before noon.\""]],
    tip: ["「会钓鱼是本事。渔港招短期工，懂鱼的人优先。」", "\"Knowing fish is a skill. The harbor hires short-term hands — people who know fish go first.\""] },
];

/** Hang out with a fellow laborer: a chat, sometimes a shared meal. Bond rises;
    at bond ≥ 50 the mate points the player at a short-term job (a gig lead). */
export function chatMate(state: LifestyleState, mateId: string): LifeResult {
  const mate = SANHE_MATES.find((m) => m.id === mateId);
  if (!mate) return fail(state, ["不认识这个人。", "You don't know that person."]);
  const next = clone(state);
  if (!next.sanhe.mates.includes(mateId)) next.sanhe.mates.push(mateId);
  const before = next.sanhe.mateBond[mateId] ?? 0;
  const bond = clamp(before + 8, 0, 100);
  next.sanhe.mateBond[mateId] = bond;
  const line = mate.lines[Math.abs(next.sanhe.shiftsDone + bond) % mate.lines.length]!;
  const lines: L2[] = [[`${mate.emoji} ${mate.name[0]}：${line[0]}`, `${mate.emoji} ${mate.name[1]}: ${line[1]}`]];
  const extra: Partial<LifeResult> = {};
  if (before < 50 && bond >= 50) {
    lines.push([`🤝 ${mate.name[0]}把你当自己人了：${mate.tip[0]}`, `🤝 ${mate.name[1]} trusts you now: ${mate.tip[1]}`]);
    extra.gigLeadId = mate.gigLeadId;
    extra.unlockListingId = mate.gigLeadId;
  }
  const { state: hoped } = addHope(next, 1);
  return ok(hoped, { mood: 4, social: 6, energy: -2 }, lines, extra);
}

/* ================= (f-2) HEALING — 治愈：先稳住心情，不扣分 =================
   Lying flat RESTORES energy/mood — there is no "the more you lie flat the
   more you lose" loop anywhere in this module. One "small joy" a day raises
   the mood cap a little; NPCs encourage, never mock. All scenes reuse places
   that already exist (beach, park bench, home balcony…) — no new map art. */

/* Place predicates reuse the same name/placeKind tests as activities.ts. */
const isBeach = (l: Loc) => l.placeKind === "beach" || /海滩|沙滩|海边|海滨|双月湾|巽寮|黄金海岸|西涌|杨梅坑|大梅沙|小梅沙|较场尾|三角洲|海龟/.test(l.name);
const isPark = (l: Loc) => l.placeKind === "park" || l.placeKind === "nature" || /公园|绿道|植物园/.test(l.name);
const isWater = (l: Loc) => isBeach(l) || /湖|水库|东江|河|江公园|渔港|码头|海鲜街/.test(l.name);
const isHome = (l: Loc) => l.type === "home";

export interface SmallJoy {
  id: string; emoji: string; name: L2; desc: L2;
  /** Where it can be done. Undefined = anywhere (the caller need not pass a place). */
  at?: (l: Loc) => boolean;
  /** Allowed window, minutes since midnight. Undefined = any time. */
  hours?: [number, number];
  energy: number; mood: number;
}
export const SMALL_JOYS: SmallJoy[] = [
  { id: "sunrise", emoji: "🌅", name: ["海边看日出", "Sunrise at the beach"], desc: ["天刚亮，海是粉的。坐一会儿，什么都不用想。", "First light, and the sea turns pink. Sit a while. Nothing to figure out."], at: isBeach, hours: [5 * 60 + 30, 7 * 60 + 30], energy: 8, mood: 12 },
  { id: "bench", emoji: "🪑", name: ["公园长椅坐一会", "Sit on a park bench"], desc: ["长椅上晒太阳，看人遛狗、打太极。时间慢慢走。", "Sun on a bench, watching dogs walked and tai chi practiced. Time moves slowly."], at: isPark, energy: 6, mood: 10 },
  { id: "cat", emoji: "🐱", name: ["喂流浪猫", "Feed a stray cat"], desc: ["楼下的橘猫蹭你的裤腿。给它半根火腿肠，它就拿你当自己人。", "The orange cat downstairs rubs against your leg. Half a sausage and you're family."], energy: 4, mood: 11 },
  { id: "fish", emoji: "🎣", name: ["钓一条鱼", "Catch a fish"], desc: ["浮漂动一下午，心就静一下午。钓到了是惊喜，没钓到也没关系。", "Watch the float all afternoon and the mind goes quiet. A catch is a bonus; no catch is fine too."], at: isWater, energy: 6, mood: 10 },
  { id: "cook", emoji: "🍳", name: ["做一顿饭", "Cook a meal"], desc: ["给自己做一顿热饭。切菜、等水开、闻着香味——日子是有烟火气的。", "Cook yourself a hot meal. Chop, wait for the water, smell it cooking — life has a warm smell to it."], at: isHome, energy: 6, mood: 12 },
];

/** Do a small joy. The FIRST joy of each day raises the mood cap by 1 (to a
    max of +15) and adds a little hope; later joys the same day still restore,
    at half mood. A pet following the player (area c) adds +2 mood. */
export function doSmallJoy(state: LifestyleState, joyId: string, day: number, loc?: Loc, minutes?: number): LifeResult {
  const joy = SMALL_JOYS.find((j) => j.id === joyId);
  if (!joy) return fail(state, ["没有这件小事。", "No such small joy."]);
  if (loc && joy.at && !joy.at(loc)) return fail(state, ["这件小事得换个地方做。", "That needs a different place."]);
  if (minutes !== undefined && joy.hours && (minutes < joy.hours[0] || minutes > joy.hours[1]))
    return fail(state, ["这个点来，不赶趟了。", "Wrong time of day for that."]);
  const next = clone(state);
  const firstToday = next.flat.joyDay !== day;
  const petBonus = next.flat.petFollows ? 2 : 0;
  if (firstToday) {
    next.flat.joyDay = day;
    next.flat.moodCapBonus = clamp(next.flat.moodCapBonus + 1, 0, 15);
  }
  next.flat.joyCount += 1;
  const mood = (firstToday ? joy.mood : Math.ceil(joy.mood / 2)) + petBonus;
  const { state: hoped } = addHope(next, firstToday ? 2 : 0);
  const lines: L2[] = [[`${joy.emoji} ${joy.name[0]}。${joy.desc[0]}`, `${joy.emoji} ${joy.name[1]}. ${joy.desc[1]}`]];
  if (firstToday) lines.push([`小确幸 +1：心情上限涨了一点（+${next.flat.moodCapBonus}）。`, `A small joy: your mood cap rose a little (+${next.flat.moodCapBonus}).`]);
  if (petBonus > 0) lines.push(["🐾 它蹭蹭你，陪你坐着。", "🐾 It rubs against you and sits with you."]);
  return ok(hoped, { energy: joy.energy, mood }, lines);
}

/** Lying flat itself ("躺平摸鱼" in App.tsx) stays a free restore. This helper
    is the extra the module adds: a pet companion makes the rest warmer, and
    the doc's rule is explicit — resting NEVER costs mood. */
export function flatRestBonus(state: LifestyleState): StatDelta {
  return state.flat.petFollows ? { mood: 2 } : {};
}

/** Encouragement, never mockery. Rotates by day; the same NPC never repeats
    the same line two days running. */
export const ENCOURAGEMENT_LINES: { who: L2; lines: L2[] }[] = [
  { who: ["街坊阿姨", "Neighbor auntie"], lines: [["「慢慢来，不着急。谁没个难的时候。」", "\"Take your time, no rush. Everyone has hard times.\""], ["「今天天气好，出去走走，回来我给你留碗汤。」", "\"Lovely day — go for a walk. I'll save you a bowl of soup.\""]] },
  { who: ["好房东", "Kind landlord"], lines: [["「房租的事好商量，先把日子过稳。」", "\"Rent can wait — get your days steady first.\""], ["「我年轻时也断过粮，后来都过去了。」", "\"I went hungry when I was young too. It passed.\""]] },
  { who: ["便利店老板", "Convenience store owner"], lines: [["「饭团今天打折，拿两个走。」", "\"Rice balls are on sale today — take two.\""], ["「别老熬夜，白天出来晒晒太阳。」", "\"Stop staying up all night. Come out and get some sun.\""]] },
  { who: ["公园大爷", "Park grandpa"], lines: [["「来，跟我打两手太极，活动活动筋骨。」", "\"Come, do tai chi with me — loosen up those joints.\""], ["「年轻人，日子长着呢，急什么。」", "\"Young friend, life is long. What's the rush?\""]] },
];
export function encouragementFor(day: number): { who: L2; line: L2 } {
  const who = ENCOURAGEMENT_LINES[Math.abs(day) % ENCOURAGEMENT_LINES.length]!;
  const line = who.lines[Math.abs(Math.floor(day / ENCOURAGEMENT_LINES.length)) % who.lines.length]!;
  return { who: who.who, line };
}

/* ---------- "someone comes to check on you" ---------- */

export const CHECKIN_NPCS: { id: string; emoji: string; name: L2; line: L2 }[] = [
  { id: "auntie", emoji: "👵", name: ["街坊阿姨", "Neighbor auntie"], line: ["「好几天没见你出门了，过来看看你。饭吃了吗？」", "\"Haven't seen you out in days — came to check on you. Have you eaten?\""] },
  { id: "landlord", emoji: "🏠", name: ["房东", "Landlord"], line: ["「路过顺便看看你。房租不急，先顾好自己。」", "\"Just passing by. Don't worry about rent — look after yourself first.\""] },
  { id: "shopkeeper", emoji: "🏪", name: ["便利店老板", "Shop owner"], line: ["「给你带了两个饭团。别总一个人闷着。」", "\"Brought you two rice balls. Don't shut yourself away.\""] },
];

/** The check-in fires once, after 3+ days unemployed — never a "falling behind"
    judgment, only a knock on the door. App.tsx calls this on day advance. */
export function checkinDue(state: LifestyleState, day: number): boolean {
  return flatDays(state, day) >= 3 && !state.flat.checkinDone && state.flat.checkinDay === 0;
}

/** Accept help or politely decline. Both are respected; declining still
    restores a little mood (being seen is the point, not the help itself).
    Accepting also brings a gig lead: a short-term listing the NPC heard about. */
export function doCheckin(state: LifestyleState, accept: boolean, day: number): LifeResult {
  if (!checkinDue(state, day)) return fail(state, ["今天没有人来敲门。", "Nobody's knocking today."]);
  const npc = CHECKIN_NPCS[Math.abs(day) % CHECKIN_NPCS.length]!;
  const next = clone(state);
  next.flat.checkinDay = day;
  next.flat.checkinDone = true;
  const lines: L2[] = [[`${npc.emoji} ${npc.name[0]}：${npc.line[0]}`, `${npc.emoji} ${npc.name[1]}: ${npc.line[1]}`]];
  if (accept) {
    const { state: hoped } = addHope(next, 8);
    lines.push(["你接受了这份关心。有人惦记着，路就没那么难走。", "You accepted the kindness. Knowing someone cares makes the road easier."]);
    lines.push(["💡 她顺便告诉你一个招短工的消息。", "💡 She also mentions a short-term opening she heard about."]);
    return ok(hoped, { mood: 10, social: 8, hunger: 15 }, lines, { gigLeadId: "short-waiter", unlockListingId: "short-waiter" });
  }
  const { state: hoped } = addHope(next, 2);
  lines.push(["你笑着婉拒了：「谢谢，我自己慢慢来。」她点点头走了——没有多问一句。", "You smile and decline: \"Thanks — I'll take it slow, on my own.\" She nods and goes. No more questions."]);
  return ok(hoped, { mood: 4, social: 2 }, lines);
}

/* ================= (f-2b) SURVIVAL — 稳住：活下去有办法 =================
   Money is tight but never "one day and you're done". The floor: bunk ¥20,
   daily pay, cafe nights, cheap meals (above). The rest of the floor lives
   here: rent has exits, old things turn into cash, a spare bunk earns rent. */

/* ---------- rent pressure has exits ---------- */

export type RentTalk = "installments" | "delay" | "work";
export interface RentTalkOption {
  id: RentTalk; emoji: string; name: L2; desc: L2;
  /** How many days the rent deadline moves. */
  rentDelayDays: number;
  /** Multiplier on this week's rent due (1 = unchanged). */
  rentDueMul: number; mood: number; social: number;
}
export const RENT_TALKS: RentTalkOption[] = [
  { id: "installments", emoji: "🧾", name: ["分期付房租", "Pay rent in installments"], desc: ["跟房东商量：这周先付一半，下周补上。好房东一般都肯。", "Ask the landlord: half this week, half next. A decent landlord usually agrees."], rentDelayDays: 0, rentDueMul: 0.5, mood: 4, social: 2 },
  { id: "delay", emoji: "🗓️", name: ["缓几天交租", "Ask for a few days"], desc: ["「手头紧，缓五天，一定补上。」先喘口气。", "\"Money's tight — five more days, I promise.\" Room to breathe."], rentDelayDays: 5, rentDueMul: 1, mood: 3, social: 0 },
  { id: "work", emoji: "🔧", name: ["拿兼职抵房租", "Work off the rent"], desc: ["帮房东修修补补、跑跑腿，抵一周房租。手艺换住处。", "Fix things and run errands for the landlord — a week's rent, paid in work."], rentDelayDays: 0, rentDueMul: 0, mood: 6, social: 4 },
];

/** Negotiate with the landlord. Returns rentDelayDays / rentDueMul for App.tsx
    to apply to the Saturday rent run. Talking costs nothing and always helps
    a little — asking is itself a step forward. */
export function negotiateRent(state: LifestyleState, talk: RentTalk): LifeResult {
  const opt = RENT_TALKS.find((t) => t.id === talk);
  if (!opt) return fail(state, ["没有这种谈法。", "No such way to ask."]);
  const next = clone(state);
  next.flat.rentTalks += 1;
  const { state: hoped } = addHope(next, 3);
  return ok(hoped, { mood: opt.mood, social: opt.social },
    [[`${opt.emoji} ${opt.name[0]}。${opt.desc[0]}`, `${opt.emoji} ${opt.name[1]}. ${opt.desc[1]}`],
     ["开口谈了，就是一步。房租有商量，日子就有余地。", "Asking is a step. Rent can be talked about — and that leaves room to live."]],
    { rentDelayDays: opt.rentDelayDays, rentDueMul: opt.rentDueMul });
}

/** Black-landlord report — intent only. Area (d) owns the report/jury flow
    (reportPlayer / juryVote); App.tsx routes this intent into it. */
export function reportLandlordIntent(reason: "乱涨租" | "扣押金" | "断水不修" | "赶人"): { action: "reportLandlord"; reason: string } {
  return { action: "reportLandlord", reason };
}

/* ---------- old things turn into cash (floor values; area (e) may override) ---------- */

export interface SecondhandItem { id: string; emoji: string; name: L2; value: number; }
export const SECONDHAND_FLOOR: SecondhandItem[] = [
  { id: "old-phone", emoji: "📱", name: ["旧手机", "Old phone"], value: 300 },
  { id: "old-furniture", emoji: "🪑", name: ["旧家具", "Old furniture"], value: 150 },
  { id: "old-bike", emoji: "🚲", name: ["旧自行车", "Old bike"], value: 120 },
  { id: "spare-clothes", emoji: "👕", name: ["闲置衣服", "Spare clothes"], value: 40 },
];

/** Sell a second-hand item at the flea market. Pure value function — the full
    buy-cheap-sell-cheap loop lives in area (e) economy.ts. */
export function sellSecondHand(state: LifestyleState, itemId: string): LifeResult {
  const item = SECONDHAND_FLOOR.find((i) => i.id === itemId);
  if (!item) return fail(state, ["这东西卖不上价。", "That won't sell."]);
  const { state: hoped } = addHope(state, 1);
  return ok(hoped, { money: item.value, earned: item.value },
    [[`二手市集上卖掉了${item.name[0]}，回血 ¥${item.value}。`, `Sold the ${item.name[1]} at the flea market — ¥${item.value} back in your pocket.`]]);
}

/** Sublet a spare bunk/bed: ¥150 a week, paid up front for the week.
    Hooks into area (e)'s subletting system; this is the floor rate. */
export function subletBunk(state: LifestyleState): LifeResult {
  const { state: hoped } = addHope(state, 2);
  return ok(hoped, { money: 150, earned: 150 },
    [["把多余的床位转租出去一周，¥150 到手。有人合租，房租也轻一点。", "Sublet the spare bunk for a week — ¥150 in hand. A roommate lightens the rent too."]]);
}

/** Start tiny: a street stall. The smallest start — one table, a few goods.
    It plugs into the existing shop system (GameState.shop) when it grows;
    App.tsx creates the shop record from the returned stall kind. */
export function openStall(state: LifestyleState, kind: string, day: number): LifeResult {
  if (state.flat.stall) return fail(state, ["你已经有个小摊了，先把它经营好。", "You already have a stall — grow that one first."]);
  const next = clone(state);
  next.flat.stall = { kind, day, lvl: 1 };
  const { state: hoped } = addHope(next, 6);
  return ok(hoped, { money: -100, mood: 8 },
    [[`摆起了小摊（${kind}）。一张桌子、几件货——老板是你自己。`, `Set up a little stall (${kind}). One table, a few goods — and you're the boss.`],
     ["从小摊开始，不丢人。很多店，都是从一张桌子开始的。", "Starting with a stall is nothing to be ashamed of. Plenty of shops began as one table."]]);
}
export const STALL_KINDS: L2[] = [
  ["烤串 / 小吃", "Grill / snacks"], ["二手杂货", "Second-hand goods"], ["花 / 手作", "Flowers / handmade"], ["手机配件", "Phone accessories"],
];

/* ================= (f-3) A WAY OUT — 出路：就业服务中心 =================
   Anchored on an EXISTING civic/service place (isJobCenterPlace, bottom) —
   no new map. Three functions inside: job search, skill training, mock
   interviews. The ladder is visible: daily-pay → short-term → stable job,
   each step spelling out what it needs, what it pays, and how it converts. */

export type JobRung = "daily" | "short" | "stable";
export const RUNG_LABEL: Record<JobRung, L2> = {
  daily: ["🧾 日结", "🧾 Day pay"],
  short: ["📅 短工", "📅 Short-term"],
  stable: ["💼 稳定工", "💼 Stable job"],
};

export interface JobListing {
  id: string; rung: JobRung; emoji: string; title: L2; desc: L2;
  /** ¥/day at Shenzhen baseline; scaled by city below. */
  payDay: number;
  cityMul?: Partial<Record<CityKey, number>>;
  /** IDENTITIES id the player becomes when hired (App.tsx applies it). */
  identityId?: string;
  requires: { skill?: number; course?: string; interviewReady?: number; gigs?: string[]; hope?: number };
  /** Short-term only: work this many days and it converts to permanent. */
  daysToPermanent?: number;
  /** One line: what it needs, what it pays, how it converts. */
  path: L2;
  tags: string[];
}

export const JOB_LADDER: JobListing[] = [
  /* --- rung 1: daily pay (the Sanhe board, seen from inside the center) --- */
  { id: "daily-warehouse", rung: "daily", emoji: "📦", title: ["仓库日结", "Warehouse day pay"], desc: ["分拣打包，干完结钱。", "Sort and pack; paid when the shift ends."], payDay: 220, cityMul: { hz: 0.73, hk: 0.91 }, requires: {}, path: ["不要经验，当天结钱。干几天，手熟了就能往短工走。", "No experience needed, paid today. A few days of this and short-term work opens up."], tags: ["logistics"] },
  { id: "daily-construction", rung: "daily", emoji: "👷", title: ["工地日结", "Construction day pay"], desc: ["搬砖绑钢筋，日结里给得最高的。", "Hauling and rebar — the best day pay there is."], payDay: 320, cityMul: { hz: 0.73, hk: 0.91 }, requires: {}, path: ["不要经验，当天结钱。身体累，攒钱快。", "No experience needed, paid today. Hard on the body, fast to save."], tags: ["construction"] },
  { id: "daily-harbor", rung: "daily", emoji: "⚓", title: ["渔港日结", "Harbor day pay"], desc: ["卸货分鱼，早上开工中午结钱。", "Unload and sort the catch; start at dawn, paid by noon."], payDay: 240, cityMul: { hz: 0.73, hk: 0.91 }, requires: {}, path: ["不要经验。钓过鱼的优先——懂鱼的人上手快。", "No experience needed. People who've fished get picked first — they already know fish."], tags: ["fish", "harbor"] },
  /* --- rung 2: short-term (a week or two, with a road to permanent) --- */
  { id: "short-waiter", rung: "short", emoji: "🍜", title: ["餐厅短期帮工", "Restaurant short-term helper"], desc: ["午市晚市帮工，管饭。干满 7 天表现好就转正。", "Lunch and dinner shifts, meals included. Do well for 7 days and it turns permanent."], payDay: 200, cityMul: { hz: 0.8, hk: 1.3 }, identityId: "waiter", requires: {}, daysToPermanent: 7, path: ["不要经验，管饭。7 天试工，表现好转正当服务员。", "No experience, meals included. 7-day trial — do well and become a waiter."], tags: ["food"] },
  { id: "short-courier", rung: "short", emoji: "📦", title: ["快递分拣短工", "Courier sorting short-term"], desc: ["按件算，多劳多得。干满 10 天可转正当快递员。", "Paid per parcel — the more you sort, the more you earn. 10 days to convert to courier."], payDay: 260, cityMul: { hz: 0.8, hk: 1.2 }, identityId: "courier", requires: {}, daysToPermanent: 10, path: ["不要经验，按件计酬。10 天试工，转正当快递员。", "No experience, paid per parcel. 10-day trial, then convert to courier."], tags: ["logistics"] },
  { id: "short-guard", rung: "short", emoji: "💂", title: ["保安替班", "Security cover shifts"], desc: ["替人顶班，站岗巡逻。干满 14 天可转正。", "Cover shifts — gate duty and patrols. 14 days to convert."], payDay: 210, cityMul: { hz: 0.8, hk: 1.25 }, identityId: "guard", requires: {}, daysToPermanent: 14, path: ["不要经验。14 天替班，表现稳就转正当保安。", "No experience. 14 days of cover shifts, then convert to security guard."], tags: ["security"] },
  { id: "short-harbor", rung: "short", emoji: "⚓", title: ["渔港短期工", "Harbor short-term hand"], desc: ["跟船卸货、理货。钓过鱼或上过渔港培训的优先。", "Unload with the boats, sort the catch. Fishers and harbor-course graduates go first."], payDay: 260, cityMul: { hz: 0.8, hk: 1.1 }, requires: { gigs: ["fish_sea", "fish_lake"] }, daysToPermanent: 10, path: ["要钓过鱼，或上过渔港帮工培训。10 天试工，转正上岸。", "Needs fishing experience or the harbor course. 10-day trial, then a steady harbor job."], tags: ["fish", "harbor"] },
  { id: "short-cleaner", rung: "short", emoji: "🧹", title: ["商场保洁短工", "Mall cleaning short-term"], desc: ["早班保洁，干满 10 天可转正。", "Early cleaning shifts. 10 days to convert."], payDay: 180, cityMul: { hz: 0.8, hk: 1.3 }, identityId: "cleaner", requires: {}, daysToPermanent: 10, path: ["不要经验。10 天试工，转正当保洁。", "No experience. 10-day trial, then convert to cleaner."], tags: ["cleaning"] },
  /* --- rung 3: stable (needs a skill, a course, or interview readiness) --- */
  { id: "stable-factory", rung: "stable", emoji: "🔩", title: ["工厂普工", "Factory worker"], desc: ["流水线普工，包吃住，加班多攒钱快。", "Assembly line, meals and bed included. Overtime pays; savings grow fast."], payDay: 230, cityMul: { hz: 0.85, hk: 1.2 }, identityId: "factory", requires: { skill: 1 }, path: ["要技能 1 点（上个短期培训就有）。包吃住，月薪稳定。", "Needs skill 1 (one short course gets you there). Meals and bed included, steady monthly pay."], tags: ["factory"] },
  { id: "stable-courier", rung: "stable", emoji: "🛵", title: ["快递员", "Courier"], desc: ["派件越多挣越多，片区跑熟了就是自己的地盘。", "More parcels, more pay. Learn your patch and it becomes yours."], payDay: 290, cityMul: { hz: 0.85, hk: 1.2 }, identityId: "courier", requires: { interviewReady: 40 }, path: ["要模拟面试练到 40 分。跑单计酬，越熟挣得越多。", "Needs mock-interview readiness 40. Paid per delivery — the better you know the streets, the more you earn."], tags: ["logistics"] },
  { id: "stable-waiter", rung: "stable", emoji: "🍜", title: ["餐厅服务员", "Restaurant server"], desc: ["午市晚市两场，员工餐管饱。", "Lunch and dinner rushes; staff meals included."], payDay: 200, cityMul: { hz: 0.85, hk: 1.35 }, identityId: "waiter", requires: { interviewReady: 30 }, path: ["要模拟面试练到 30 分。熟手了能往领班走。", "Needs mock-interview readiness 30. Do it well and you can work up to shift lead."], tags: ["food"] },
  { id: "stable-chef-assist", rung: "stable", emoji: "👨‍🍳", title: ["厨师助理", "Kitchen assistant"], desc: ["后厨帮手，切配打荷。会做饭的上手最快。", "Kitchen hand — prep and plating. People who cook pick it up fastest."], payDay: 300, cityMul: { hz: 0.85, hk: 1.3 }, identityId: "chef", requires: { course: "cooking" }, path: ["要上过「家常菜速成」培训。会做饭的人，后厨抢着要。", "Needs the \"home cooking crash course\". Kitchens fight over people who can cook."], tags: ["food", "cooking"] },
  { id: "stable-guard", rung: "stable", emoji: "💂", title: ["保安", "Security guard"], desc: ["站岗巡逻，整栋楼的人你都认识。", "Gate duty and patrols — you'll know everyone in the building."], payDay: 210, cityMul: { hz: 0.85, hk: 1.25 }, identityId: "guard", requires: { interviewReady: 30 }, path: ["要模拟面试练到 30 分。稳定、包吃住、认识一栋楼的人。", "Needs mock-interview readiness 30. Steady, meals and bed included — and you'll know the whole building."], tags: ["security"] },
  { id: "stable-harbor", rung: "stable", emoji: "⚓", title: ["渔港正式工", "Harbor permanent hand"], desc: ["跟船理货、验鱼，考证之后就是正式工。", "Sort and grade the catch with the boats — certified, and it's a permanent post."], payDay: 280, cityMul: { hz: 0.85, hk: 1.1 }, identityId: "worker", requires: { course: "harbor" }, path: ["要上过「渔港帮工考证」培训。钓过鱼 → 帮工 → 考证 → 稳定岗。", "Needs the \"harbor certification\" course. Fished before → harbor hand → certificate → steady job."], tags: ["fish", "harbor"] },
];

export function listingPay(l: JobListing, city: CityKey): number {
  return Math.round(l.payDay * (l.cityMul?.[city] ?? 1));
}

/** Why a listing is (not) open to this player — the ladder shows the locked
    steps too, with the missing piece named, so the path is always visible. */
export function listingAvailable(l: JobListing, p: PlayerProfile): { ok: boolean; missing: L2[] } {
  const missing: L2[] = [];
  const r = l.requires;
  if (r.skill !== undefined && p.skill < r.skill) missing.push([`技能要 ${r.skill} 点（现在 ${p.skill} 点）`, `Needs skill ${r.skill} (you have ${p.skill})`]);
  if (r.course && !p.coursesDone.includes(r.course)) {
    const c = COURSES.find((x) => x.id === r.course);
    missing.push([`要上过「${c ? c.name[0] : r.course}」培训`, `Needs the "${c ? c.name[1] : r.course}" course`]);
  }
  if (r.interviewReady !== undefined && p.interviewReady < r.interviewReady) missing.push([`模拟面试要练到 ${r.interviewReady} 分（现在 ${p.interviewReady} 分）`, `Needs mock-interview readiness ${r.interviewReady} (you have ${p.interviewReady})`]);
  if (r.gigs && !r.gigs.some((g) => p.gigs.includes(g))) missing.push(["要先有相关零工经验（钓过鱼 / 打过零工）", "Needs related gig experience first (fishing / day work)"]);
  return { ok: missing.length === 0, missing };
}

/** The board, ladder-ordered. `available` listings are open; locked ones show
    their missing piece. Player-issued tasks (area S: listJobBoard merges the
    server's getGigs rows) are appended by App.tsx — see the snippet. */
export function listingsFor(p: PlayerProfile): { listing: JobListing; available: boolean; missing: L2[]; pay: number }[] {
  const order: Record<JobRung, number> = { daily: 0, short: 1, stable: 2 };
  return [...JOB_LADDER].sort((a, b) => order[a.rung] - order[b.rung])
    .map((listing) => {
      const { ok: available, missing } = listingAvailable(listing, p);
      return { listing, available, missing, pay: listingPay(listing, p.city) };
    });
}

/** Apply for a listing. Applying is free and always allowed — the ladder
    shows requirements, but nobody is turned away from trying. */
export function applyForJob(state: LifestyleState, listingId: string, day: number): LifeResult {
  const listing = JOB_LADDER.find((l) => l.id === listingId);
  if (!listing) return fail(state, ["没有这个岗位。", "No such posting."]);
  if (state.flat.applications.some((a) => a.listingId === listingId && (a.status === "applied" || a.status === "trial")))
    return fail(state, ["这个岗位已经投过了，等消息就好。", "Already applied — just wait to hear back."]);
  const next = clone(state);
  next.flat.applications.push({ listingId, day, status: "applied" });
  const { state: hoped } = addHope(next, 6);
  return ok(hoped, { mood: 3 },
    [[`投了「${listing.title[0]}」。${listing.path[0]}`, `Applied for "${listing.title[1]}". ${listing.path[1]}`],
     ["投出去就是一步。等消息的这几天，可以先去练练模拟面试。", "Applying is a step. While you wait, a mock interview or two wouldn't hurt."]]);
}

/* ---------- the counselor: a suggested route, never a forced task ---------- */

export interface CounselorRoute {
  id: string; emoji: string; title: L2; basedOn: L2; steps: L2[];
}
export const COUNSELOR_ROUTES: CounselorRoute[] = [
  { id: "route-fish", emoji: "🎣", title: ["从钓鱼到渔港正式工", "From fishing to a harbor job"], basedOn: ["你钓过鱼，懂鱼。", "You've fished before — you know fish."],
    steps: [["去渔港打几天日结，熟悉卸货分鱼", "Take harbor day shifts for a few days — learn unloading and sorting"], ["上「渔港帮工考证」培训（4 天，有补贴）", "Take the harbor certification course (4 days, with allowance)"], ["应聘渔港短期工，10 天试工转正", "Apply for the harbor short-term post — 10-day trial, then permanent"]] },
  { id: "route-cook", emoji: "🍳", title: ["从做饭到后厨", "From cooking to the kitchen"], basedOn: ["你会做饭，这是手艺。", "You can cook — that's a trade."],
    steps: [["上「家常菜速成」培训（3 天，有补贴）", "Take the home-cooking crash course (3 days, with allowance)"], ["应聘餐厅短期帮工，管饭", "Apply for restaurant short-term work — meals included"], ["7 天试工转正，再往厨师助理走", "7-day trial to permanent, then work up to kitchen assistant"]] },
  { id: "route-logistics", emoji: "📦", title: ["从搬货到快递员", "From hauling to courier"], basedOn: ["你搬过货、跑过腿，认路快。", "You've hauled and run errands — you learn streets fast."],
    steps: [["去快递站打几天分拣短工，按件计酬", "Take courier sorting short-term shifts — paid per parcel"], ["练两次模拟面试，练到 40 分", "Do two mock interviews, get readiness to 40"], ["应聘快递员，跑熟片区就是自己的地盘", "Apply for courier — learn your patch and it becomes yours"]] },
  { id: "route-general", emoji: "🧭", title: ["先稳住，再慢慢走", "Steady first, then step by step"], basedOn: ["不着急，先找个落脚的活儿。", "No rush — find a foothold first."],
    steps: [["打几天日结，手里有现金，心里不慌", "Take day shifts for a few days — cash in hand steadies the nerves"], ["挑一个 3–6 天的短期培训，学个傍身的技能", "Pick a 3–6 day short course and learn a skill to lean on"], ["投一个短工，试工转正；转正了再想下一步", "Apply for a short-term post, convert from the trial — then think about what's next"]] },
];

/** The counselor reads what the player has actually done and suggests the
    route that fits — a suggestion, not an assignment. */
export function suggestRoute(p: PlayerProfile): CounselorRoute {
  if (p.gigs.some((g) => g.startsWith("fish"))) return COUNSELOR_ROUTES[0]!;
  if (p.gigs.some((g) => g === "cook" || g.startsWith("cook"))) return COUNSELOR_ROUTES[1]!;
  if (p.gigs.some((g) => ["moving", "warehouse", "courier", "delivery"].includes(g))) return COUNSELOR_ROUTES[2]!;
  return COUNSELOR_ROUTES[3]!;
}

/** Sit down with the counselor. Free, no mood cost, and it records the
    suggested route so the center can show it. */
export function bookGuidance(state: LifestyleState, p: PlayerProfile): LifeResult {
  const route = suggestRoute(p);
  const next = clone(state);
  next.flat.routeId = route.id;
  const { state: hoped } = addHope(next, 4);
  return ok(hoped, { mood: 5, social: 4 },
    [[`🧑‍🏫 指导员看了看你的经历：「${route.basedOn[0]}」`, `🧑‍🏫 The counselor looks over what you've done: "${route.basedOn[1]}"`],
     [`她建议的路线是「${route.title[0]}」——只是建议，走不走、怎么走，你说了算。`, `Her suggested route is "${route.title[1]}" — a suggestion only. Whether and how you walk it is your call.`]]);
}

/* ---------- short courses: 3–6 days, with a living allowance ---------- */

export interface Course {
  id: string; emoji: string; name: L2; desc: L2;
  days: number; allowanceDay: number; skillGain: number; unlocks: string[];
}
export const COURSES: Course[] = [
  { id: "harbor", emoji: "⚓", name: ["渔港帮工考证", "Harbor certification"], desc: ["跟船卸货、分鱼验鱼，考个证。渔港正式工的敲门砖。", "Unload, sort and grade the catch, and earn the certificate. The key to a permanent harbor post."], days: 4, allowanceDay: 30, skillGain: 2, unlocks: ["stable-harbor", "short-harbor"] },
  { id: "cooking", emoji: "🍳", name: ["家常菜速成", "Home cooking crash course"], desc: ["切配、火候、摆盘，三天能炒一桌家常菜。后厨抢着要会做饭的人。", "Chopping, heat, plating — three days to cook a table of home dishes. Kitchens fight over people who can cook."], days: 3, allowanceDay: 30, skillGain: 2, unlocks: ["stable-chef-assist"] },
  { id: "forklift", emoji: "🏗️", name: ["叉车入门", "Forklift basics"], desc: ["仓库里的硬通货。会开叉车，仓库的活儿随便挑。", "The warehouse's hard currency. Drive a forklift and you can pick your warehouse job."], days: 5, allowanceDay: 30, skillGain: 2, unlocks: ["stable-factory"] },
  { id: "office", emoji: "💻", name: ["电脑办公入门", "Basic office computing"], desc: ["表格、打字、收发文件。坐办公室的活儿，从这儿开始。", "Spreadsheets, typing, filing. Office work starts here."], days: 6, allowanceDay: 30, skillGain: 3, unlocks: ["stable-factory"] },
  { id: "ecommerce", emoji: "🛒", name: ["电商运营入门", "E-commerce basics"], desc: ["开店、上架、客服。想自己摆摊开店，先学这个。", "Open a shop, list goods, handle customers. Learn this before opening your own stall or shop."], days: 6, allowanceDay: 30, skillGain: 3, unlocks: ["stable-factory"] },
  { id: "housekeeping", emoji: "🧹", name: ["家政服务培训", "Housekeeping training"], desc: ["收纳、保洁、照护。街坊最缺的，就是信得过的人。", "Tidying, cleaning, care. What neighbors need most is someone they can trust."], days: 3, allowanceDay: 30, skillGain: 2, unlocks: ["short-cleaner"] },
];

/** Enroll in a course. Free — training is not something the player pays for
    out of pocket (mirrors the real free vocational training for the
    unemployed). One course at a time. */
export function enrollCourse(state: LifestyleState, courseId: string, day: number): LifeResult {
  const course = COURSES.find((c) => c.id === courseId);
  if (!course) return fail(state, ["没有这门培训。", "No such course."]);
  if (state.flat.courses.some((c) => !c.done)) return fail(state, ["手头还有一门课没上完，先上完它。", "You're mid-course — finish that one first."]);
  if (state.flat.courses.some((c) => c.id === courseId && c.done)) return fail(state, ["这门课你已经上过了。", "You've already finished this course."]);
  const next = clone(state);
  next.flat.courses.push({ id: courseId, startDay: day, days: course.days, done: false, allowancePaid: 0 });
  const { state: hoped } = addHope(next, 4);
  return ok(hoped, { mood: 4 },
    [[`报了「${course.name[0]}」（${course.days} 天）。培训免费，每天还有 ¥${course.allowanceDay} 生活补贴。`, `Enrolled in "${course.name[1]}" (${course.days} days). Training is free, with a ¥${course.allowanceDay}/day living allowance.`],
     ["上课的日子也算数：每天来，补贴当天到。", "Class days count too — show up each day and the allowance lands the same day."]]);
}

/** Advance an in-progress course by one day. App.tsx calls this once per game
    day while a course is active (on day advance, not on click). Pays that
    day's allowance; on the last day grants the skill and marks it done. */
export function courseDayTick(state: LifestyleState, day: number): LifeResult {
  const active = state.flat.courses.find((c) => !c.done);
  if (!active) return ok(state, {}, []);
  const course = COURSES.find((c) => c.id === active.id);
  if (!course) return ok(state, {}, []);
  const next = clone(state);
  const enroll = next.flat.courses.find((c) => c.id === active.id && !c.done)!;
  const dayInCourse = day - enroll.startDay + 1;
  if (dayInCourse <= 0) return ok(state, {}, []);
  if (enroll.allowancePaid >= dayInCourse) return ok(state, {}, []);
  enroll.allowancePaid = dayInCourse;
  const finishing = dayInCourse >= enroll.days;
  if (finishing) {
    enroll.done = true;
    const { state: hoped } = addHope(next, 10);
    return ok(hoped, { money: course.allowanceDay, earned: course.allowanceDay, skill: course.skillGain, energy: -6, mood: 6 },
      [[`🎓 「${course.name[0]}」结课了！技能 +${course.skillGain}，生活补贴 ¥${course.allowanceDay} 到账。`, `🎓 Finished "${course.name[1]}"! Skill +${course.skillGain}, allowance ¥${course.allowanceDay} in.`],
       [`解锁了：${course.unlocks.map((u) => JOB_LADDER.find((l) => l.id === u)?.title[0] ?? u).join("、")}。`, `Unlocked: ${course.unlocks.map((u) => JOB_LADDER.find((l) => l.id === u)?.title[1] ?? u).join(", ")}.`]]);
  }
  return ok(next, { money: course.allowanceDay, earned: course.allowanceDay, energy: -6, mood: 2 },
    [[`上课第 ${dayInCourse}/${enroll.days} 天。生活补贴 ¥${course.allowanceDay} 到账。`, `Course day ${dayInCourse}/${enroll.days}. Allowance ¥${course.allowanceDay} in.`]]);
}

/* ---------- mock interviews: no mood penalty, ever ---------- */

export interface InterviewQ { q: L2; opts: { t: L2; pts: number; tip?: L2 }[]; }
export const INTERVIEW_QUESTIONS: InterviewQ[] = [
  { q: ["「先简单介绍一下你自己吧。」", "\"Tell us a little about yourself.\""], opts: [
    { t: ["我是XX，之前做过XX，最近在学XX。想找份踏实的工作。", "I'm XX, I've done XX before, and I'm learning XX now. I'm looking for steady work.", ], pts: 2 },
    { t: ["我……没什么好说的。", "I… don't really have much to say.", ], pts: 0, tip: ["先说一句你做过什么、会什么，就够了。不用背稿。", "Just say one thing you've done and one thing you can do. No script needed."] },
    { t: ["我什么都能干！什么苦都能吃！", "I can do anything! I can take any hardship!", ], pts: 1, tip: ["态度很好。再加一句具体的：你做过什么、擅长什么，更有说服力。", "Great attitude. Add one concrete thing — what you've done, what you're good at — and it lands better."] },
  ] },
  { q: ["「你上一份工作为什么不做了？」", "\"Why did you leave your last job?\""], opts: [
    { t: ["合同到期了 / 公司调整，我想找个更稳定的。", "The contract ended / the company restructured. I'm looking for something steadier.", ], pts: 2 },
    { t: ["老板太差了，待不下去。", "The boss was awful. Couldn't stay.", ], pts: 0, tip: ["可以说事实，但换个说法：「和那边的发展方向不太合，我想换个环境。」", "You can be honest — just frame it forward: \"The direction there didn't fit me; I want a different setting.\""] },
    { t: ["家里有点事，休息了一段时间。", "Something came up at home; I took some time off.", ], pts: 2 },
  ] },
  { q: ["「你能接受加班吗？」", "\"Can you do overtime?\""], opts: [
    { t: ["可以，但希望提前说一声，我好安排。", "Yes — I just appreciate a heads-up so I can plan.", ], pts: 2 },
    { t: ["不行，一分钟都不行。", "No. Not a single minute.", ], pts: 0, tip: ["底线可以有，但先听听对方的节奏，再谈条件。", "Boundaries are fine — but hear their rhythm first, then negotiate."] },
    { t: ["可以，钱给够就行。", "Sure, as long as the pay is right.", ], pts: 1 },
  ] },
  { q: ["「你对这份工作有什么想问的？」", "\"Any questions for us?\""], opts: [
    { t: ["想问一下：试用期多久？转正后待遇怎么算？", "How long is the trial period, and what are the terms once it's permanent?", ], pts: 2 },
    { t: ["没有问题。", "No questions.", ], pts: 0, tip: ["问一句转正条件、排班，显得你认真，也能避开坑。", "Ask about conversion terms or shifts — it shows you're serious, and it helps you dodge bad deals."] },
    { t: ["包吃住吗？几点下班？", "Meals and bed included? What time do we finish?", ], pts: 1 },
  ] },
  { q: ["「如果试工三天表现一般，你会怎么办？」", "\"If your three-day trial goes just okay, what would you do?\""], opts: [
    { t: ["问清楚哪里做得不够，改过来，再争取一次机会。", "Ask exactly what fell short, fix it, and ask for another chance.", ], pts: 2 },
    { t: ["那就算了，换一家。", "Forget it — try somewhere else.", ], pts: 1 },
    { t: ["求他们再给我一次机会。", "Beg them for another chance.", ], pts: 0, tip: ["不用求。问清楚、改过来，就是最体面的争取。", "No begging needed. Ask what's missing, fix it — that's the dignified way to ask again."] },
  ] },
];

/** Run a mock interview. `picks` are the option indexes for the first three
    questions (App.tsx draws three). A wrong answer costs NOTHING — the
    counselor gives a tip instead. Readiness rises with the score. */
export function mockInterview(state: LifestyleState, picks: number[]): LifeResult {
  const questions = INTERVIEW_QUESTIONS.slice(0, 3);
  let score = 0;
  const tips: L2[] = [];
  questions.forEach((q, i) => {
    const pick = q.opts[picks[i] ?? 0] ?? q.opts[0]!;
    score += pick.pts;
    if (pick.tip) tips.push(pick.tip);
  });
  const max = questions.length * 2;
  const next = clone(state);
  next.flat.interviews += 1;
  const gain = 8 + score * 2;
  next.flat.interviewReady = clamp(next.flat.interviewReady + gain, 0, 100);
  const { state: hoped } = addHope(next, 8);
  const lines: L2[] = [[
    `模拟面试练完了：${score}/${max} 分。面试熟练度 +${gain}（现在 ${next.flat.interviewReady} 分）。答错了不扣心情——练，就是用来错的。`,
    `Mock interview done: ${score}/${max}. Readiness +${gain} (now ${next.flat.interviewReady}). Wrong answers cost no mood — practice is for getting it wrong.`,
  ]];
  lines.push(...tips);
  if (score >= max - 1) lines.push(["指导员点点头：「就这个状态，去面真的也没问题。」", "The counselor nods: \"Like that, you'd do fine in a real one.\""]);
  return ok(hoped, { mood: 2, social: 2 }, lines);
}

/* ---------- 3-day trial work: good → permanent, bad → daily pay, no black mark ---------- */

export function startTrial(state: LifestyleState, listingId: string, day: number): LifeResult {
  const listing = JOB_LADDER.find((l) => l.id === listingId);
  if (!listing) return fail(state, ["没有这个岗位。", "No such posting."]);
  if (state.flat.trial) return fail(state, ["手头还有一份试工没做完。", "You're mid-trial — finish that one first."]);
  const app = state.flat.applications.find((a) => a.listingId === listingId && a.status === "applied");
  if (!app) return fail(state, ["先投这个岗位，等通知再来试工。", "Apply for the post first — trial comes after the application."]);
  if (listing.requires.interviewReady !== undefined && state.flat.interviewReady < listing.requires.interviewReady)
    return fail(state, [`模拟面试先练到 ${listing.requires.interviewReady} 分，再来试工。`, `Get mock-interview readiness to ${listing.requires.interviewReady} before the trial.`]);
  const next = clone(state);
  next.flat.trial = { listingId, startDay: day, daysWorked: 0, totalScore: 0 };
  app.status = "trial";
  const { state: hoped } = addHope(next, 8);
  return ok(hoped, { mood: 6 },
    [[`开始试工「${listing.title[0]}」：3 天。好好干，转正就是你的；就算不合适，也按日结拿钱走人，不记黑历史。`, `Trial started: "${listing.title[1]}" — 3 days. Do well and it's yours; even if it doesn't fit, you leave with day pay and no black mark.`]]);
}

/** One trial day. `score` (0–100) comes from the caller — App.tsx wires it to
    a mini-game or a work choice. Pays that day's wage either way. */
export function trialWorkDay(state: LifestyleState, score: number, city: CityKey): LifeResult {
  const trial = state.flat.trial;
  if (!trial) return fail(state, ["现在没有在试的工。", "No trial in progress."]);
  const listing = JOB_LADDER.find((l) => l.id === trial.listingId);
  if (!listing) return fail(state, ["试工的岗位找不到了。", "The trial post can't be found."]);
  const next = clone(state);
  const t = next.flat.trial!;
  t.daysWorked += 1;
  t.totalScore += clamp(score, 0, 100);
  const pay = listingPay(listing, city);
  const { state: hoped } = addHope(next, 5);
  return ok(hoped, { money: pay, earned: pay, energy: -18, hunger: -10, xp: 2 },
    [[`试工第 ${t.daysWorked}/3 天：¥${pay} 到手。${score >= 60 ? "今天干得不错。" : "今天有点磕绊，明天再努一把。"}`, `Trial day ${t.daysWorked}/3: ¥${pay} in. ${score >= 60 ? "Good work today." : "A bit rough today — another push tomorrow."}`]]);
}

/** Resolve the trial after 3 days. Average ≥ 60 → hired (App.tsx applies the
    identity + markEmployed). Below → leave with the trial pay already banked,
    no black mark, and the application is closed so the player can try again
    or try another post. */
export function resolveTrial(state: LifestyleState): LifeResult {
  const trial = state.flat.trial;
  if (!trial || trial.daysWorked < 3) return fail(state, ["试工还没满 3 天。", "The trial hasn't run 3 days yet."]);
  const listing = JOB_LADDER.find((l) => l.id === trial.listingId);
  if (!listing) return fail(state, ["试工的岗位找不到了。", "The trial post can't be found."]);
  const avg = Math.round(trial.totalScore / trial.daysWorked);
  const next = clone(state);
  next.flat.trial = null;
  const app = next.flat.applications.find((a) => a.listingId === trial.listingId && a.status === "trial");
  if (avg >= 60) {
    if (app) app.status = "hired";
    const { state: hoped } = addHope(next, 25);
    const employed = markEmployed(hoped);
    return ok(employed, { mood: 20, social: 4 },
      [[`🎉 转正了！「${listing.title[0]}」3 天试工平均 ${avg} 分，老板点头了。`, `🎉 Permanent! "${listing.title[1]}" — 3-day trial averaged ${avg}, and the boss nodded.`],
       ["这一步是你自己走出来的。好好干，日子会越来越稳。", "You walked this step yourself. Keep at it — life gets steadier from here."]],
      { hiredIdentityId: listing.identityId });
  }
  if (app) app.status = "left";
  const { state: hoped } = addHope(next, 4);
  return ok(hoped, { mood: 2 },
    [[`试工结束了，平均 ${avg} 分，没转正——但试工的 3 天工资都结清了，不欠你一分，也不记黑历史。`, `Trial over — averaged ${avg}, no conversion. But all 3 days are paid in full, nothing owed, no black mark.`],
     ["不合适就是不合适，换一家再试。你已经知道试工是怎么回事了。", "Not a fit is just not a fit. Try another place — you already know how trials work now."]]);
}

/* ================= progress: "重新出发", never a failure meter ================= */

export interface HopeMilestone { at: number; title: L2; desc: L2; }
export const HOPE_MILESTONES: HopeMilestone[] = [
  { at: 25, title: ["站稳了", "On your feet"], desc: ["手里有现金，心里有底。短工向你敞开了。", "Cash in hand, ground underfoot. Short-term work is open to you."] },
  { at: 50, title: ["有方向了", "A direction"], desc: ["技能在长，面试也敢上了。稳定工的门已经推开一条缝。", "Skills are growing and interviews don't scare you. The door to steady work is ajar."] },
  { at: 75, title: ["快出发了", "Almost there"], desc: ["试工、转正、自己的小摊——下一级机会已经在等你。", "Trials, conversion, your own little stall — the next level of opportunity is waiting."] },
  { at: 100, title: ["重新出发", "A fresh start"], desc: ["不是「通关」，是解锁了下一级机会：更好的岗、更稳的租约。", "Not a finish line — the next level of opportunity: better posts, a steadier lease."] },
];

/** How many concrete next steps are open right now: available listings +
    available courses + an un-fired check-in + the stall option. */
export function opportunitiesCount(state: LifestyleState, p: PlayerProfile): number {
  let n = 0;
  n += JOB_LADDER.filter((l) => listingAvailable(l, p).ok).length;
  n += COURSES.filter((c) => !state.flat.courses.some((e) => e.id === c.id)).length;
  if (checkinDue(state, p.day)) n += 1;
  if (!state.flat.stall) n += 1;
  if (state.flat.applications.some((a) => a.status === "applied")) n += 1;
  return n;
}

/** "第 X 天，有 Y 个机会在等你" — the only unemployment-day display. Never a
    shame number, never a countdown. */
export function flatStatusLine(state: LifestyleState, p: PlayerProfile): L2 {
  const days = flatDays(state, p.day);
  const opps = opportunitiesCount(state, p);
  if (days <= 0) return ["不在失业期。", "Not currently unemployed."];
  return [
    `第 ${days} 天，有 ${opps} 个机会在等你。慢慢来，一步一步走。`,
    `Day ${days} — ${opps} opportunit${opps === 1 ? "y" : "ies"} waiting for you. Take it slow, one step at a time.`,
  ];
}

/** One-line summary for the lifestyle panel header. */
export function lifestyleSummary(state: LifestyleState, p: PlayerProfile): L2 {
  const days = flatDays(state, p.day);
  const milestone = [...HOPE_MILESTONES].reverse().find((m) => state.flat.hope >= m.at);
  const hopePart = milestone
    ? `重新出发 ${state.flat.hope}/100 · ${milestone.title[0]}`
    : `重新出发 ${state.flat.hope}/100`;
  if (days > 0) return [`${flatStatusLine(state, p)[0]} ${hopePart}。`, `${flatStatusLine(state, p)[1]} Fresh start ${state.flat.hope}/100${milestone ? ` · ${milestone.title[1]}` : ""}.`];
  if (state.sanhe.shiftsDone > 0) return [`${sanheRhythm(state)[0]} ${hopePart}。`, `${sanheRhythm(state)[1]} Fresh start ${state.flat.hope}/100.`];
  return ["日子照常过。想换个活法，就业服务中心随时开着。", "Life goes on as usual. If you want a different way of living, the job service center is always open."];
}

/* ================= real-life help page — 信息，不做玩法 =================
   VERIFIED public channels only. Amounts/policies are marked "以官方为准"
   (check the official source) — the game gives the direction, not the fine
   print. Acceptance criterion (4): both numbers (12333, 12356) must render
   correctly, with no typos — they are typed here once, in one place. */

export interface HelpSection { title: L2; lines: L2[]; tel?: string; telNote?: L2; }
export const REAL_HELP: {
  title: L2; updated: L2; disclaimer: L2; sections: HelpSection[];
} = {
  title: ["现实里也可以", "In real life, too"],
  updated: ["信息更新：2026 年 11 月", "Information current as of November 2026"],
  disclaimer: ["以下只是公开渠道的方向，具体条件和金额各地不同，以官方为准：查广东政务服务网，或打电话确认。", "These are public channels only. Exact conditions and amounts vary by place — check the official source: the Guangdong government services site, or call to confirm."],
  sections: [
    {
      title: ["找工作 / 失业登记", "Finding work / registering as unemployed"],
      tel: "12333",
      telNote: ["人社咨询热线", "Human resources & social security hotline"],
      lines: [
        ["打 12333（人社咨询），或去所在街道便民服务中心 / 社区公共就业服务机构：办失业登记、就业困难人员认定、灵活就业登记。", "Call 12333 (HR & social security), or visit your street-level convenience service center / community public employment office for unemployment registration, recognition as a person with employment difficulties, or flexible-employment registration."],
        ["补贴方向（2026 年广东省就业创业补贴清单）：灵活就业社保补贴约每月 300 元；就业见习（16–24 岁登记失业青年）；失业保险金领取期间免费职业介绍和一期减免费职业培训。", "Subsidy directions (2026 Guangdong employment & entrepreneurship subsidy list): flexible-employment social insurance subsidy around ¥300/month; employment traineeships (registered unemployed youth aged 16–24); free job placement and one round of free/reduced-fee vocational training while receiving unemployment insurance."],
        ["深圳另有“4050”灵活就业社保补贴（约每月最高 600 元，需认定为就业困难人员）。", "Shenzhen additionally offers the \"4050\" flexible-employment social insurance subsidy (up to around ¥600/month, for those recognized as having employment difficulties)."],
      ],
    },
    {
      title: ["心情实在撑不住", "When it feels like too much"],
      tel: "12356",
      telNote: ["全国统一心理援助热线，免费；深圳 24 小时，外地拨 0755-12356", "National psychological assistance hotline, free; 24 hours in Shenzhen, dial 0755-12356 from elsewhere"],
      lines: [
        ["全国统一心理援助热线 12356，免费，2025 年 5 月 1 日起全国开通。深圳 24 小时；外地拨 0755-12356。", "The national psychological assistance hotline 12356 is free and has operated nationwide since May 1, 2025. In Shenzhen it runs 24 hours; from elsewhere dial 0755-12356."],
        ["难受不是你的错。打个电话，和人说说话，不丢人。", "Feeling bad is not your fault. Calling and talking to someone is nothing to be ashamed of."],
      ],
    },
    {
      title: ["紧急情况", "Emergencies"],
      tel: "120 / 110",
      telNote: ["急救 120 · 报警 110", "Ambulance 120 · Police 110"],
      lines: [
        ["身体出状况打 120；遇到危险打 110。", "Call 120 for a medical emergency; 110 if you are in danger."],
      ],
    },
  ],
};

/* ================= job service center anchor + tabs =================
   NO new map: the center lives on an existing civic/service place. The
   natural anchor is the 游客 / 志愿服务中心 (placeKind "info", type
   "service"); any place named 服务中心 / 便民 / 街道 / 社区 / 政务 / 人社
   also counts. (Police stations are type "service" too — excluded here;
   they belong to area (g) police, not the job center.) */

export function isJobCenterPlace(l: Loc): boolean {
  if (l.placeKind === "police") return false;
  if (l.placeKind === "info") return true;
  return /服务中心|便民|街道|社区|政务|人社|就业/.test(l.name);
}

export const JOB_CENTER_TABS: { id: "jobs" | "guide" | "interview" | "help"; label: L2 }[] = [
  { id: "jobs", label: ["🔍 找工作", "🔍 Find work"] },
  { id: "guide", label: ["🧑‍🏫 就业指导", "🧑‍🏫 Guidance"] },
  { id: "interview", label: ["🎤 练面试", "🎤 Mock interview"] },
  { id: "help", label: ["💛 现实里也可以", "💛 In real life, too"] },
];

/** The counselor NPC. Her voice lines live in area (g)'s voice system
    (per-NPC tones); this is her copy + identity for the panel. */
export const COUNSELOR: { name: L2; title: L2; greeting: L2 } = {
  name: ["陈指导员", "Counselor Chen"],
  title: ["就业服务中心 · 就业指导员", "Job service center · career counselor"],
  greeting: ["「坐。慢慢说，想找个什么样的活儿？不着急，咱们一条一条看。」", "\"Sit down. Tell me slowly — what kind of work are you looking for? No rush, we'll go through it one by one.\""],
};

/* ================= server surface — for area (S) =================
   Endpoint specs only — no code here runs against the server. Naming follows
   the existing defineAction style in server/src/actions.ts (camelCase, e.g.
   getGigs / postGig / gigAction). Client state stays the source of truth for
   the solo loop; the server persists it and carries the SHARED parts (job
   board listings incl. player-issued tasks, community help gigs, stall
   visibility, trial/hiring records for anti-cheat). Money/level stay
   client-calculated until server-authoritative accounting lands (per the
   repo's BUSINESS-PLAN.md warning) — so no endpoint here moves real money. */

export interface EndpointSpec {
  name: string;
  request: Record<string, string>;
  response: Record<string, string>;
  notes: string;
}

export const LIFESTYLE_SERVER_SPEC: Record<string, EndpointSpec> = {
  getLifestyle: {
    name: "getLifestyle",
    request: {},
    response: { life: "LifestyleState JSON (as stored by saveLifestyle; null on first run)", updatedAt: "string (ISO)" },
    notes: "Load on login. If null, client uses defaultLifestyleState(). No other endpoint trusts client state without this row existing.",
  },
  saveLifestyle: {
    name: "saveLifestyle",
    request: { life: "LifestyleState JSON (full object; server validates shape with the same rules as sanitizeLifestyleState)", day: "number (game day, for staleness checks)" },
    response: { ok: "boolean", updatedAt: "string (ISO)" },
    notes: "Called on every lifestyle action (debounced by the client). Server clamps hope 0–100, moodCapBonus 0–15, and rejects negative money deltas carried in the payload — the client never sends money here, only the state object.",
  },
  listJobBoard: {
    name: "listJobBoard",
    request: { city: "CityKey (sz | hz | hk)" },
    response: { listings: "JobListing[] (server copy of JOB_LADDER, so pay/requirements can be tuned without a client release)", playerGigs: "player-issued gig/task rows from getGigs, shown in the same board (open-game direction)" },
    notes: "Merges the static ladder with live player-issued tasks. The client falls back to its local JOB_LADDER if the call fails.",
  },
  applyJob: {
    name: "applyJob",
    request: { listingId: "string", day: "number" },
    response: { ok: "boolean", application: "{ listingId, day, status: 'applied' }", error: "string (optional, e.g. already-applied)" },
    notes: "Records the application server-side so a trial/hire later can be checked against it (anti-cheat: no trial without an application).",
  },
  bookGuidance: {
    name: "bookGuidance",
    request: { routeId: "string (counselor-suggested route the player accepted to view)" },
    response: { ok: "boolean", route: "CounselorRoute (server copy)" },
    notes: "Logs the guidance session. No gate: the player may book guidance any number of times; the route is a suggestion, never a quest.",
  },
  enrollCourse: {
    name: "enrollCourse",
    request: { courseId: "string", day: "number" },
    response: { ok: "boolean", enrollment: "{ courseId, startDay, days }", error: "string (optional, e.g. already-enrolled / already-done)" },
    notes: "One active course at a time. The daily allowance is paid by the server on courseDay, not by the client.",
  },
  courseDay: {
    name: "courseDay",
    request: { courseId: "string", day: "number" },
    response: { ok: "boolean", allowance: "number (¥ paid for this day, 0 if already paid)", done: "boolean", skillGain: "number (0 unless finishing)" },
    notes: "Idempotent per (player, courseId, day) — a reload or double-tap never double-pays the allowance. Called by the client on day advance while a course is active.",
  },
  mockInterview: {
    name: "mockInterview",
    request: { score: "number (0–6)", day: "number" },
    response: { ok: "boolean", interviewReady: "number (new total, server-clamped 0–100)" },
    notes: "Server stores readiness so it survives reinstalls. No penalty path exists: a low score still adds readiness, per the design doc.",
  },
  startTrial: {
    name: "startTrial",
    request: { listingId: "string", day: "number" },
    response: { ok: "boolean", trial: "{ listingId, startDay }", error: "string (optional, e.g. no application / already in trial)" },
    notes: "Requires a prior applyJob row for the same listing. Rejects a second concurrent trial.",
  },
  trialDay: {
    name: "trialDay",
    request: { listingId: "string", score: "number (0–100, from the client's mini-game/work choice)", day: "number" },
    response: { ok: "boolean", daysWorked: "number", pay: "number (¥ for this day, server-computed from the listing)" },
    notes: "Idempotent per (player, listingId, day). Pay is computed server-side from the listing so the client cannot inflate trial wages.",
  },
  resolveTrial: {
    name: "resolveTrial",
    request: { listingId: "string" },
    response: { ok: "boolean", hired: "boolean", avgScore: "number", identityId: "string | null" },
    notes: "Hired when avgScore >= 60 after 3 days. A failed trial returns hired:false with NO black mark recorded anywhere — the design doc forbids it.",
  },
  postFlatGig: {
    name: "postFlatGig",
    request: { title: "string (≤ 40 chars)", desc: "string (≤ 200 chars)", pay: "number (¥, 0 = unpaid favor)", kind: "'help' | 'work'" },
    response: { ok: "boolean", gigId: "number" },
    notes: "Community help board: neighbors post small paid/unpaid help (carry a bag, watch a stall, fix a tap). Shared with the community system (area c) — one board, not two.",
  },
  listFlatGigs: {
    name: "listFlatGigs",
    request: { city: "CityKey" },
    response: { gigs: "{ id, title, desc, pay, kind, poster }[] (open, newest first)" },
    notes: "Shown in the job center's job tab under the ladder, and in the community panel (area c).",
  },
  takeFlatGig: {
    name: "takeFlatGig",
    request: { gigId: "number" },
    response: { ok: "boolean", error: "string (optional, e.g. already-taken)" },
    notes: "One taker per gig. Completing it (client reports via gigAction, existing action) adds hope +5 and helped +1.",
  },
  openStall: {
    name: "openStall",
    request: { kind: "string (one of STALL_KINDS)", day: "number" },
    response: { ok: "boolean", stall: "{ kind, day, lvl: 1 }", error: "string (optional, e.g. already-has-stall)" },
    notes: "Registers the tiny stall so other players can see/visit it. Growth into the full shop system (GameState.shop) is area (e)'s economy module.",
  },
  reportLandlord: {
    name: "reportLandlord",
    request: { target: "string (landlord id / name)", reason: "'乱涨租' | '扣押金' | '断水不修' | '赶人'", detail: "string (≤ 500 chars)" },
    response: { ok: "boolean", reportId: "number" },
    notes: "HANDOFF TO AREA (d): the report/jury flow already exists (reportPlayer / juryVote). This endpoint only files the report; adjudication stays in (d).",
  },
  sanheShiftLog: {
    name: "sanheShiftLog",
    request: { shiftId: "string", pay: "number", day: "number" },
    response: { ok: "boolean", error: "string (optional, e.g. already-settled-today)" },
    notes: "Server-side log of settled daily-pay shifts. Guards the one-shift-per-day rule and the cash amounts (pay must equal sanhePay(city) × the shift's payMul) — the anti-cheat half of takeSanheShift. Read-only for the client; no money moves here.",
  },
};
