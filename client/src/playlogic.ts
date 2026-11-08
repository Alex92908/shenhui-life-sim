/* ---- 活动结算：把小游戏得分变成数值、掉落和风险 ----
   Pure: App applies the returned outcome to the save. */
import { rollDrop, type Activity, type L2, type RiskKind } from "./activities";
import type { GameResult } from "./MiniGame";

export interface Outcome {
  score: number; bust: boolean; tier: "great" | "ok" | "bad";
  money: number; energy: number; mood: number; xp: number; skill: number; fit: number; network: number;
  minutes: number;
  drop: { key: string; emoji: string; name: L2; food: boolean } | null;
  risk: { kind: RiskKind; text: L2; fine: number } | null;
  romance: number; rel: number;
  passedLicense: boolean;
  line: L2;
}

/** `mates` = other real players who played in the same party (0 when solo). */
export function resolveActivity(a: Activity, r: GameResult, ctx: { payMul: number; mates: number; locId: string; locName: string; rng?: () => number }): Outcome {
  const rng = ctx.rng ?? Math.random;
  const bust = !!r.bust;
  const raw = bust ? 0 : r.score;
  /* playing together is more fun: everyone's rewards get a lift */
  const s = Math.min(1, raw + 0.06 * Math.min(4, ctx.mates));
  const tier: Outcome["tier"] = !bust && s >= 0.75 ? "great" : !bust && s >= 0.35 ? "ok" : "bad";
  const mood = bust ? -Math.round(Math.abs(a.mood) * 0.35) : s >= 0.25 ? Math.round(a.mood * (0.35 + 0.65 * s)) : -Math.round(Math.abs(a.mood) * 0.2);
  const money = !bust && a.money && s >= 0.3 ? Math.round(a.money * s * ctx.payMul) : 0;
  const full = !bust && s >= 0.5;
  let drop: Outcome["drop"] = null;
  if (a.drop && !bust && s >= 0.2) {
    if (a.drop === "peak") drop = { key: `peak:${ctx.locId}`, emoji: "🚩", name: [`${ctx.locName}`, ctx.locName], food: false };
    else { const x = rollDrop(a.drop, s, rng); if (x) drop = { key: x.id, emoji: x.emoji, name: x.name, food: !!x.food }; }
  }
  let risk: Outcome["risk"] = null;
  if (a.risk) {
    const p = bust ? 1 : a.risk.p * (1 - s);
    if (rng() < p) risk = { kind: a.risk.kind, text: a.risk.text, fine: a.risk.fine ?? (a.risk.kind === "injury" ? 150 : 0) };
  }
  return {
    score: s, bust, tier,
    money, energy: a.energy, mood,
    xp: full ? a.xp ?? 0 : 0, skill: full ? a.skill ?? 0 : 0, fit: full ? a.fit ?? 0 : 0,
    network: (full ? a.network ?? 0 : 0) + (ctx.mates > 0 ? 1 : 0),
    minutes: a.min,
    drop, risk,
    romance: a.romance ? Math.round(a.romance * (s - 0.3) * 1.6) : 0,
    rel: a.cat === "date" ? Math.round(10 * s) - 2 : 0,
    passedLicense: a.id === "license" && !bust && s >= 0.5,
    line: a.lines[tier],
  };
}

/** Rush hour on the roads: 7:30–9:30 and 17:30–19:30. */
export const isRushHour = (min: number) => (min >= 450 && min < 570) || (min >= 1050 && min < 1170);
