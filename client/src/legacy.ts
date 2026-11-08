/* ---- 深漂档案：跨局成长 ----
   A 30-day run no longer ends in nothing. Each finished run banks 档案点
   (by ending, career, and the neighbours' stories you saw through), and
   points unlock permanent 传承 (perks). Up to MAX_EQUIP owned perks ride
   along into a run, so each new run starts with a choice. */

export interface Perk {
  id: string; emoji: string; name: string; desc: string; cost: number;
}
export const MAX_EQUIP = 3;
export const PERKS: Perk[] = [
  { id: "cash", emoji: "🧧", name: "老乡接济", desc: "开局多带 ¥800", cost: 3 },
  { id: "wardrobe", emoji: "👔", name: "衣柜传家", desc: "开局就有正装和雨衣", cost: 2 },
  { id: "skill", emoji: "📚", name: "夜校结业", desc: "开局技能 +2", cost: 4 },
  { id: "xp", emoji: "💼", name: "职场老手", desc: "开局经验 +6，大厂面试更容易", cost: 4 },
  { id: "route", emoji: "🧭", name: "熟门熟路", desc: "所有出行省 20% 时间", cost: 4 },
  { id: "early", emoji: "🐦", name: "早起的鸟", desc: "每天 7:00 起床，多出 1 小时", cost: 5 },
  { id: "rent", emoji: "🔑", name: "熟人房东", desc: "房租 -10%", cost: 5 },
  { id: "friends", emoji: "🏘️", name: "街坊记得你", desc: "所有街坊开局就是「熟人」，剧情解锁更快", cost: 6 },
];
export const perkById = (id: string) => PERKS.find((p) => p.id === id) ?? null;

/** 档案点 a finished run earns. */
export function runPoints(r: { reason: "done" | "debt"; money: number; goal: number; careerIdx: number; bigCo: boolean; stories: number; romance?: number; buddies?: number }): { pts: number; parts: string[] } {
  const parts: string[] = [];
  let pts: number;
  if (r.reason === "debt" || r.money < -500) { pts = 1; parts.push("被请出门 +1"); }
  else if (r.money >= r.goal * 1.5) { pts = 8; parts.push("超额达成 +8"); }
  else if (r.money >= r.goal) { pts = 5; parts.push("达成目标 +5"); }
  else if (r.money >= 0) { pts = 3; parts.push("撑满 30 天 +3"); }
  else { pts = 2; parts.push("月光收场 +2"); }
  if (r.careerIdx > 0) { pts += r.careerIdx; parts.push(`职级 +${r.careerIdx}`); }
  if (r.bigCo) { pts += 1; parts.push("进过大厂 +1"); }
  if (r.stories > 0) { pts += r.stories * 2; parts.push(`街坊故事 ${r.stories} 个 +${r.stories * 2}`); }
  if ((r.romance ?? 0) >= 2) { pts += 2; parts.push("收获爱情 +2"); }
  if ((r.buddies ?? 0) > 0) { const b = Math.min(5, r.buddies ?? 0); pts += b; parts.push(`和真人组局 ${r.buddies} 次 +${b}`); }
  return { pts, parts };
}
