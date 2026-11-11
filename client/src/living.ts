/** The parts of a life that pull you back: hunger, a wash, people,
    a home you can actually use, a family, a plot of land, a car. */

export const HAIRS: { zh: string; en: string; color: number; sx: number; sy: number }[] = [
  { zh: "短发", en: "Short", color: 0x2b2118, sx: 1, sy: 0.72 },
  { zh: "长发", en: "Long", color: 0x1a1420, sx: 1.08, sy: 1.15 },
  { zh: "寸头", en: "Buzz", color: 0x4a3226, sx: 0.9, sy: 0.42 },
  { zh: "染发", en: "Dyed", color: 0xc45c26, sx: 1.06, sy: 0.82 },
];

export function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 78;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Bag, cap and tie sit on the body, so the same person still reads from behind. */
export const ACCESSORIES: { id: string; zh: string; en: string }[] = [
  { id: "none", zh: "不戴", en: "None" },
  { id: "bag", zh: "包", en: "Bag" },
  { id: "cap", zh: "帽", en: "Cap" },
  { id: "tie", zh: "领带", en: "Tie" },
];

/** Store looks stay `name-gold` / `title-veteran`. Hair and accessory ride on the end as `#h2a1`. */
const LOOK_SUFFIX = /#h[0-3](?:a[0-3])?$/;
export function storeLook(look: string | null | undefined): string | null {
  if (!look) return null;
  const base = look.replace(LOOK_SUFFIX, "");
  return base || null;
}
export function hairFromLook(look: string | null | undefined): number | null {
  const m = look?.match(/#h([0-3])(?:a[0-3])?$/);
  return m ? Number(m[1]) : null;
}
export function accessoryFromLook(look: string | null | undefined): number | null {
  const m = look?.match(/#h[0-3]a([0-3])$/);
  return m ? Number(m[1]) : null;
}
export function withLook(cosmetic: string | null | undefined, hair: number, accessory: number): string {
  const base = (cosmetic ?? "").replace(LOOK_SUFFIX, "");
  const h = Math.max(0, Math.min(3, Math.round(hair)));
  const a = Math.max(0, Math.min(3, Math.round(accessory)));
  return `${base}#h${h}a${a}`;
}

export type HomeSpot = { id: string; slot: number };
export type NpcHome = { tier: number; layout: HomeSpot[] };

/** What you see when you walk into a neighbour's place. Players publish their own. */
export const NPC_HOMES: Record<string, NpcHome> = {
  小美: { tier: 2, layout: [{ id: "sofa-fabric", slot: 0 }, { id: "desk", slot: 2 }, { id: "tv-cabinet", slot: 4 }] },
  阿强: { tier: 1, layout: [{ id: "bed-double", slot: 2 }, { id: "dining-table", slot: 1 }] },
  陈伯: { tier: 2, layout: [{ id: "sofa-fabric", slot: 0 }, { id: "table-oak", slot: 1 }] },
  Lisa: { tier: 3, layout: [{ id: "sofa-leather", slot: 0 }, { id: "desk", slot: 4 }] },
  大芬姐: { tier: 1, layout: [{ id: "dining-table", slot: 1 }, { id: "fridge", slot: 3 }] },
  子健: { tier: 0, layout: [{ id: "desk", slot: 2 }, { id: "bed-double", slot: 4 }] },
  阿琳: { tier: 2, layout: [{ id: "sofa-fabric", slot: 0 }, { id: "desk", slot: 2 }] },
  林婶: { tier: 1, layout: [{ id: "dining-table", slot: 1 }, { id: "sofa-fabric", slot: 0 }] },
  郭叔: { tier: 1, layout: [{ id: "dining-table", slot: 1 }, { id: "fridge", slot: 3 }] },
  阿海: { tier: 1, layout: [{ id: "table-oak", slot: 1 }, { id: "bed-double", slot: 2 }] },
  秀姐: { tier: 2, layout: [{ id: "sofa-fabric", slot: 0 }, { id: "tv-cabinet", slot: 4 }] },
  小黄: { tier: 0, layout: [{ id: "bed-double", slot: 2 }, { id: "fridge", slot: 3 }] },
  何伯: { tier: 1, layout: [{ id: "table-oak", slot: 1 }, { id: "sofa-fabric", slot: 0 }] },
  华哥: { tier: 1, layout: [{ id: "dining-table", slot: 1 }, { id: "fridge", slot: 3 }] },
  阿May: { tier: 3, layout: [{ id: "sofa-leather", slot: 0 }, { id: "desk", slot: 4 }] },
  强哥: { tier: 1, layout: [{ id: "sofa-fabric", slot: 0 }, { id: "tv-cabinet", slot: 4 }] },
  婆婆珍: { tier: 1, layout: [{ id: "dining-table", slot: 1 }, { id: "fridge", slot: 3 }] },
  船长辉: { tier: 2, layout: [{ id: "table-oak", slot: 1 }, { id: "bed-double", slot: 2 }] },
  肥妈: { tier: 1, layout: [{ id: "dining-table", slot: 1 }, { id: "sofa-fabric", slot: 0 }] },
};
export function npcHome(name: string): NpcHome | null {
  return NPC_HOMES[name] ?? null;
}

export type FurnUse = "bed" | "sit" | "cook" | "wash" | "watch";

export function furnUse(id: string): FurnUse | null {
  if (id.startsWith("bed")) return "bed";
  if (id.startsWith("sofa") || id === "dining-table") return "sit";
  if (id.startsWith("kitchen") || id === "fridge") return "cook";
  if (id === "bathtub" || id === "washer") return "wash";
  if (id === "tv-cabinet" || id === "desk") return "watch";
  return null;
}

export const PLOT_PRICE: Record<string, number> = { sz: 18000, hz: 9000, hk: 28000 };

/** About +1.8% each game day the plot is held. */
export function plotWorth(paid: number, boughtDay: number, day: number): number {
  const d = Math.max(0, day - boughtDay);
  return Math.round(paid * Math.pow(1.018, d));
}

export const KID_NAMES = ["念念", "安安", "一诺"];

export const CAR_PRICE = 28000;
