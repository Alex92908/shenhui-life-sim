// Round-4 — multi-floor buildings (lee: "档口里面不可以进去吗？不应该是
// 几栋楼可以上下楼层吗？" + "其他的也做成这种多样的啊").
//
// The walk-in interiors were one small room each (electronics: one counter,
// two spots, ~5m of walkable floor). This module makes them real buildings:
// every venue set listed in FLOOR_PLANS has one or more buildings, each
// with 2–3 floors. Each floor has its OWN spots, booths, NPC, copy and
// actions — switching floors swaps the whole floor, it is not a reskin.
//
// How it plugs in (see ROUND4-CHANGELOG.md):
//   - LifeStage.tsx reads floorSpots() for the golden pins + the near-spot
//     button, and renders the floor's booths / banner / elevator from the
//     FloorDef. The scene effect is mount-only, so App remounts LifeStage
//     (via key) whenever the building or floor changes.
//   - App.tsx holds venueBuilding + venueFloor for the open venue, renders
//     the building picker + floor buttons above the talk list, handles the
//     "floor-up"/"floor-down" spots, and merges the floor's talks with the
//     existing VENUE_TALK[set] entries on floor 1 (so the verified actions
//     — 验二手手机 ¥-80, 配装配件 ¥-120 — keep working exactly as before).
//   - Spot ids on floor 1 deliberately match the existing ROAM_SPOTS ids
//     for that set, so the existing VENUE_TALK entries line up with the
//     pins. New floors use new ids. Stairs spots are ≥1.5 from every other
//     spot on their floor (near radius is 1.15) and inside clampWalk
//     (x ±5.6, z -1.15…2.15).
//   - A booth is a small U-shaped stall the player WALKS INTO: low walls +
//     a counter + a sign, with its interact spot inside the booth footprint.
//     (There is no collision system — the walls are visual framing, the
//     spot inside is what makes it "enterable".)
//   - Open-air venues (park, beach, hike, farm, etc.) are NOT floored —
//     a park with floors would be nonsense. The one true wet market
//     ("market") is also left as-is: it is already correct.

import type { LifePose, LifeSet } from "../LifeStage";

/** A talk entry on one floor. Same shape as App.tsx's VenueTalk (the
    `open` field is not needed here — only the club opens the Livehouse). */
export interface FloorTalk {
  id: string; emoji: string; zh: string; en: string;
  who: string; whoEn: string; say: string; sayEn: string;
  pose: LifePose;
  partner?: [number, number];
  money?: number; mood?: number; energy?: number; hunger?: number; network?: number; xp?: number;
}

/** One interactable pin on a floor. x/z are on the walkable floor. */
export interface FloorSpot {
  id: string; emoji: string; zh: string; en: string; x: number; z: number;
}

/** A stall booth the player walks into. The booth's interact spot sits at
    (x, z) — inside the booth. goods are the counter-goods colours. */
export interface FloorBooth {
  id: string; x: number; z: number; w: number; d: number;
  color: number; label: string; labelEn: string; goods: number[];
}

/** The NPC who runs this floor (idle host + voice/face when their talk runs). */
export interface FloorNpc {
  who: string; whoEn: string; shirt: number; pants: number; faceId: string;
}

export interface FloorDef {
  floor: number;
  label: string; // "1F"
  zh: string; en: string; // floor theme, e.g. "手机通讯"
  sign: string; // wall sign, e.g. "赛格广场 · 1F 手机通讯"
  signColor?: number;
  accent: number; // goods / banner / elevator tint for this floor
  copy: string; copyEn: string; // venue panel line for this floor
  spots: FloorSpot[];
  booths?: FloorBooth[];
  npc?: FloorNpc;
  /** NEW talks for this floor only. Floor 1 additionally shows the
      existing VENUE_TALK[set] entries (merged by App), so nothing that
      already worked is lost. */
  talks: FloorTalk[];
}

export interface BuildingDef {
  id: string; zh: string; en: string;
  flavour: string; flavourEn: string;
  floors: FloorDef[];
}

/** Stairs/elevator spot ids. App's onSpot handles these by changing the
    floor instead of running a talk. */
export const STAIR_UP_ID = "floor-up";
export const STAIR_DOWN_ID = "floor-down";

/** Stairs spot builders — default positions, overridden per venue where
    the default would sit within 1.5 of another spot (see per-floor notes). */
const up = (x = 4.7, z = 1.5): FloorSpot => ({ id: STAIR_UP_ID, emoji: "🛗", zh: "上楼", en: "Go up", x, z });
const down = (x = -4.7, z = 1.5): FloorSpot => ({ id: STAIR_DOWN_ID, emoji: "🛗", zh: "下楼", en: "Go down", x, z });

/* ================= Huaqiangbei 华强北电子市场 =================
   Three buildings, three floors each. The verified actions (check 验二手手机
   ¥-80, parts 配装配件 ¥-120) live on 1F of the building they belong to and
   are merged in from App's VENUE_TALK.electronics — they are NOT redefined
   here, so their cost/reward/dialogue cannot drift. */
const ELECTRONICS_BUILDINGS: BuildingDef[] = [
  {
    id: "seg", zh: "赛格广场", en: "SEG Plaza",
    flavour: "新机最多，品牌专柜扎堆", flavourEn: "The most new phones — brand counters everywhere",
    floors: [
      {
        floor: 1, label: "1F", zh: "手机通讯", en: "Phones",
        sign: "赛格广场 · 1F 手机通讯", signColor: 0x0b3a4a, accent: 0x0ea5e9,
        copy: "一米柜台：手机、平板、配件，当场验机再付钱",
        copyEn: "One-metre counters: phones, tablets and parts — check it before you pay",
        spots: [
          { id: "check", emoji: "📱", zh: "验二手手机", en: "Check a phone", x: -0.5, z: -0.2 },
          { id: "parts", emoji: "🔌", zh: "配装配件", en: "Pick parts", x: 1.9, z: -0.1 },
          { id: "phone", emoji: "📱", zh: "买一部新手机", en: "Buy a new phone", x: -2.6, z: -0.1 },
          up(),
        ],
        booths: [
          { id: "phone", x: -2.6, z: -0.1, w: 2.4, d: 1.5, color: 0x0b3a4a, label: "手机柜台", labelEn: "Phones", goods: [0x111827, 0xe8eef2, 0x1d4ed8, 0x38bdf8] },
        ],
        npc: { who: "档口老板", whoEn: "The stall owner", shirt: 0x0e7490, pants: 0x1f2937, faceId: "hq-seg-owner" },
        talks: [
          { id: "phone", emoji: "📱", zh: "买一部新手机", en: "Buy a new phone", who: "档口老板", whoEn: "The stall owner", say: "「这款上个月出的，电池大，拍照也行。学生价，六百拿走。」", sayEn: "“Last month's model — big battery, good camera. Student price, ¥600.”", pose: "talk", partner: [0x0e7490, 0x1f2937], money: -600, mood: 10, xp: 1 },
        ],
      },
      {
        floor: 2, label: "2F", zh: "品牌新机", en: "Brand phones",
        sign: "赛格广场 · 2F 品牌新机", signColor: 0x7c3aed, accent: 0x7c3aed,
        copy: "品牌专柜：新机、旗舰、试玩台，销售员比顾客还热情",
        copyEn: "Brand counters: new phones, flagships, demo tables",
        spots: [
          { id: "try", emoji: "📱", zh: "试玩新机", en: "Try a new phone", x: 0.2, z: -0.2 },
          { id: "buy", emoji: "🛍️", zh: "买旗舰新机", en: "Buy a flagship", x: 2.6, z: 0.6 },
          down(), up(),
        ],
        booths: [
          { id: "try", x: 0.2, z: -0.1, w: 2.4, d: 1.5, color: 0x7c3aed, label: "旗舰体验", labelEn: "Flagship demo", goods: [0x7c3aed, 0xec4899, 0xf59e0b, 0x111827] },
        ],
        npc: { who: "品牌店员", whoEn: "The brand assistant", shirt: 0x7c3aed, pants: 0x1f2937, faceId: "hq-seg-2f-clerk" },
        talks: [
          { id: "try", emoji: "📱", zh: "试玩一台新机", en: "Try a new phone", who: "品牌店员", whoEn: "The brand assistant", say: "「这台是今年的旗舰，拍照能拍月亮。你随便玩，不买也没事。」", sayEn: "“This year's flagship — it photographs the moon. Play as long as you like.”", pose: "talk", partner: [0x7c3aed, 0x1f2937], mood: 6 },
          { id: "buy", emoji: "🛍️", zh: "买一台旗舰新机", en: "Buy a flagship phone", who: "品牌店员", whoEn: "The brand assistant", say: "「原装未拆封，保修一年。加个碎屏险不？」", sayEn: "“Sealed, one year warranty. Add screen insurance?”", pose: "talk", partner: [0x7c3aed, 0x1f2937], money: -900, mood: 12, xp: 2 },
        ],
      },
      {
        floor: 3, label: "3F", zh: "以旧换新", en: "Trade-in",
        sign: "赛格广场 · 3F 以旧换新", signColor: 0x059669, accent: 0x059669,
        copy: "以旧换新：旧手机抵钱，换新机补差价，现场验机",
        copyEn: "Trade in your old phone for a new one — checked on the spot",
        spots: [
          { id: "trade", emoji: "🔄", zh: "以旧换新", en: "Trade in", x: -0.5, z: -0.2 },
          { id: "repair", emoji: "🔧", zh: "修手机", en: "Repair a phone", x: 2.4, z: 0.6 },
          down(),
        ],
        booths: [
          { id: "trade", x: -0.5, z: -0.1, w: 2.4, d: 1.5, color: 0x059669, label: "以旧换新", labelEn: "Trade-in", goods: [0x059669, 0x111827, 0xe8eef2] },
        ],
        npc: { who: "回收店员", whoEn: "The trade-in clerk", shirt: 0x059669, pants: 0x1f2937, faceId: "hq-seg-3f-trade" },
        talks: [
          { id: "trade", emoji: "🔄", zh: "旧手机抵钱换新机", en: "Trade in an old phone", who: "回收店员", whoEn: "The trade-in clerk", say: "「你这台成色还行，抵三百，补三百换这台新的。现场过机，不满意不换。」", sayEn: "“Yours is in decent shape — ¥300 credit, ¥300 more for this one. Checked here, no pressure.”", pose: "talk", partner: [0x059669, 0x1f2937], money: -300, mood: 8, xp: 1 },
          { id: "repair", emoji: "🔧", zh: "修一下手机", en: "Repair a phone", who: "回收店员", whoEn: "The trade-in clerk", say: "「换个电池八十，当场换，十分钟拿走。」", sayEn: "“New battery, ¥80, ten minutes while you wait.”", pose: "talk", partner: [0x059669, 0x1f2937], money: -80, mood: 4, xp: 1 },
        ],
      },
    ],
  },
  {
    id: "hqworld", zh: "华强电子世界", en: "Huaqiang Electronics World",
    flavour: "配件和装机的大本营，批发价，懂行的人都来这", flavourEn: "Parts and builds at wholesale prices — the insiders' market",
    floors: [
      {
        floor: 1, label: "1F", zh: "配件批发", en: "Parts wholesale",
        sign: "华强电子世界 · 1F 配件批发", signColor: 0xf59e0b, accent: 0xf59e0b,
        copy: "配件批发：充电器、数据线、手机壳，拿货价",
        copyEn: "Parts wholesale: chargers, cables, cases at trade prices",
        spots: [
          { id: "parts", emoji: "🔌", zh: "配装配件", en: "Pick parts", x: 1.9, z: -0.1 },
          { id: "wholesale", emoji: "📦", zh: "批发一箱配件", en: "Buy a box of parts", x: -0.5, z: -0.2 },
          up(),
        ],
        booths: [
          { id: "parts", x: 1.9, z: -0.1, w: 2.4, d: 1.5, color: 0xf59e0b, label: "配件柜台", labelEn: "Parts", goods: [0xf59e0b, 0x334155, 0x38bdf8, 0x111827] },
        ],
        npc: { who: "配件批发老板", whoEn: "The parts wholesaler", shirt: 0xf59e0b, pants: 0x1f2937, faceId: "hq-world-1f-boss" },
        talks: [
          { id: "wholesale", emoji: "📦", zh: "批发一箱配件", en: "Buy a box of parts wholesale", who: "配件批发老板", whoEn: "The parts wholesaler", say: "「一箱五十个充电头，拿货价。下次进货还找我，给你留最好的。」", sayEn: "“Fifty chargers a box, trade price. Come back for the next batch and I'll keep the best for you.”", pose: "talk", partner: [0xf59e0b, 0x1f2937], money: -200, mood: 6, xp: 1, network: 1 },
        ],
      },
      {
        floor: 2, label: "2F", zh: "装机维修", en: "Builds & repairs",
        sign: "华强电子世界 · 2F 装机维修", signColor: 0xdc2626, accent: 0xdc2626,
        copy: "装机维修：配电脑、修手机，师傅手艺硬",
        copyEn: "Builds and repairs: PCs assembled, phones fixed, by hand",
        spots: [
          { id: "build", emoji: "🖥️", zh: "配一台电脑", en: "Build a PC", x: -0.5, z: -0.2 },
          { id: "fix", emoji: "🔧", zh: "修手机", en: "Repair a phone", x: 2.4, z: 0.6 },
          down(), up(),
        ],
        booths: [
          { id: "build", x: -0.5, z: -0.1, w: 2.4, d: 1.5, color: 0xdc2626, label: "装机台", labelEn: "PC builds", goods: [0xdc2626, 0x111827, 0x38bdf8, 0x334155] },
        ],
        npc: { who: "维修师傅", whoEn: "The repair master", shirt: 0xdc2626, pants: 0x1f2937, faceId: "hq-world-2f-master" },
        talks: [
          { id: "build", emoji: "🖥️", zh: "配一台二手电脑", en: "Build a second-hand PC", who: "维修师傅", whoEn: "The repair master", say: "「这套配置打游戏够用了，内存我给你加到 16G。装不好你拿回来。」", sayEn: "“This build runs games fine — I'll bump the RAM to 16GB. Bring it back if anything's off.”", pose: "talk", partner: [0xdc2626, 0x1f2937], money: -800, mood: 10, xp: 2 },
          { id: "fix", emoji: "🔧", zh: "修一下手机", en: "Repair a phone", who: "维修师傅", whoEn: "The repair master", say: "「屏幕碎了？换个原装屏，一百二，半小时拿走。」", sayEn: "“Cracked screen? Original part, ¥120, half an hour.”", pose: "talk", partner: [0xdc2626, 0x1f2937], money: -120, mood: 5, xp: 1 },
        ],
      },
      {
        floor: 3, label: "3F", zh: "二手捡漏", en: "Second-hand bargains",
        sign: "华强电子世界 · 3F 二手捡漏", signColor: 0x65a30d, accent: 0x65a30d,
        copy: "二手捡漏：旧手机、旧平板，懂行的能淘到宝",
        copyEn: "Second-hand bargains: used phones and tablets for those who know",
        spots: [
          { id: "bargain", emoji: "💎", zh: "淘二手宝贝", en: "Hunt a bargain", x: -0.5, z: -0.2 },
          { id: "check", emoji: "📱", zh: "验二手手机", en: "Check a phone", x: 2.4, z: 0.6 },
          down(),
        ],
        booths: [
          { id: "bargain", x: -0.5, z: -0.1, w: 2.4, d: 1.5, color: 0x65a30d, label: "捡漏摊", labelEn: "Bargains", goods: [0x65a30d, 0x111827, 0xe8eef2, 0x1d4ed8] },
        ],
        npc: { who: "捡漏摊主", whoEn: "The bargain hunter", shirt: 0x65a30d, pants: 0x1f2937, faceId: "hq-world-3f-stall" },
        talks: [
          { id: "bargain", emoji: "💎", zh: "淘一件二手宝贝", en: "Hunt a second-hand treasure", who: "捡漏摊主", whoEn: "The bargain hunter", say: "「这台是人家抵账的，成色九成新。你要，我按收来的价给你。」", sayEn: "“This one came in as payment — near-new. I'll let it go at what I paid.”", pose: "talk", partner: [0x65a30d, 0x1f2937], money: -150, mood: 8, xp: 1 },
        ],
      },
    ],
  },
  {
    id: "yuanwang", zh: "远望数码商城", en: "Yuanwang Digital Mall",
    flavour: "二手手机的大本营，捡漏和以旧换新", flavourEn: "The home of second-hand phones — bargains and trade-ins",
    floors: [
      {
        floor: 1, label: "1F", zh: "二手手机", en: "Used phones",
        sign: "远望数码商城 · 1F 二手手机", signColor: 0x0891b2, accent: 0x0891b2,
        copy: "二手手机：验机、捡漏、以旧换新，懂行的人都来远望",
        copyEn: "Used phones: checked, bargained, traded — the insiders come here",
        spots: [
          { id: "check", emoji: "📱", zh: "验二手手机", en: "Check a phone", x: -0.5, z: -0.2 },
          { id: "bargain", emoji: "💎", zh: "捡漏", en: "Hunt a bargain", x: 1.9, z: -0.1 },
          up(),
        ],
        booths: [
          { id: "check", x: -0.5, z: -0.1, w: 2.4, d: 1.5, color: 0x0891b2, label: "二手手机", labelEn: "Used phones", goods: [0x0891b2, 0x111827, 0xe8eef2, 0x1d4ed8] },
        ],
        npc: { who: "二手老板", whoEn: "The used-phone boss", shirt: 0x0891b2, pants: 0x1f2937, faceId: "hq-yuan-1f-boss" },
        talks: [
          { id: "bargain", emoji: "💎", zh: "捡一部二手手机", en: "Pick up a used phone cheap", who: "二手老板", whoEn: "The used-phone boss", say: "「这台上一任主人就用了一个月，电池 95%。二百，拿走。」", sayEn: "“Last owner had it a month — battery 95%. ¥200, take it.”", pose: "talk", partner: [0x0891b2, 0x1f2937], money: -200, mood: 8, xp: 1 },
        ],
      },
      {
        floor: 2, label: "2F", zh: "配件小商品", en: "Accessories",
        sign: "远望数码商城 · 2F 配件小商品", signColor: 0xec4899, accent: 0xec4899,
        copy: "配件小商品：手机壳、贴膜、耳机，十块钱也能淘",
        copyEn: "Small accessories: cases, screen protectors, earphones — cheap",
        spots: [
          { id: "case", emoji: "📱", zh: "买手机壳", en: "Buy a phone case", x: 0.2, z: -0.2 },
          { id: "film", emoji: "✨", zh: "贴膜", en: "Screen protector", x: 2.6, z: 0.6 },
          down(), up(),
        ],
        booths: [
          { id: "case", x: 0.2, z: -0.1, w: 2.4, d: 1.5, color: 0xec4899, label: "手机壳", labelEn: "Cases", goods: [0xec4899, 0xf59e0b, 0x38bdf8, 0x111827] },
        ],
        npc: { who: "配件档主", whoEn: "The accessories seller", shirt: 0xec4899, pants: 0x1f2937, faceId: "hq-yuan-2f-stall" },
        talks: [
          { id: "case", emoji: "📱", zh: "买个手机壳", en: "Buy a phone case", who: "配件档主", whoEn: "The accessories seller", say: "「这款防摔的，摔三次不碎。二十五，送你一张膜。」", sayEn: "“Drop-proof — survives three drops. ¥25, and I'll throw in a protector.”", pose: "talk", partner: [0xec4899, 0x1f2937], money: -25, mood: 4 },
          { id: "film", emoji: "✨", zh: "贴张钢化膜", en: "Apply a screen protector", who: "配件档主", whoEn: "The accessories seller", say: "「我贴膜手艺全场第一，气泡全无，十五块。」", sayEn: "“Best screen job in the building — zero bubbles. ¥15.”", pose: "talk", partner: [0xec4899, 0x1f2937], money: -15, mood: 3 },
        ],
      },
      {
        floor: 3, label: "3F", zh: "维修翻新", en: "Repairs & refurbs",
        sign: "远望数码商城 · 3F 维修翻新", signColor: 0x475569, accent: 0x475569,
        copy: "维修翻新：换屏、换电池、翻新机，师傅现场拆机",
        copyEn: "Repairs and refurbs: screens, batteries, refurbished phones",
        spots: [
          { id: "fix", emoji: "🔧", zh: "换屏换电池", en: "New screen or battery", x: -0.5, z: -0.2 },
          { id: "refurb", emoji: "📱", zh: "买台翻新机", en: "Buy a refurbished phone", x: 2.4, z: 0.6 },
          down(),
        ],
        booths: [
          { id: "fix", x: -0.5, z: -0.1, w: 2.4, d: 1.5, color: 0x475569, label: "维修台", labelEn: "Repairs", goods: [0x475569, 0x111827, 0x38bdf8] },
        ],
        npc: { who: "维修师傅", whoEn: "The repair master", shirt: 0x475569, pants: 0x1f2937, faceId: "hq-yuan-3f-master" },
        talks: [
          { id: "fix", emoji: "🔧", zh: "换个电池", en: "Replace a battery", who: "维修师傅", whoEn: "The repair master", say: "「原装电池，八十。拆开给你看，假一赔十。」", sayEn: "“Original battery, ¥80. I'll open it up and show you — fake and it's ten times back.”", pose: "talk", partner: [0x475569, 0x1f2937], money: -80, mood: 4, xp: 1 },
          { id: "refurb", emoji: "📱", zh: "买台翻新机", en: "Buy a refurbished phone", who: "维修师傅", whoEn: "The repair master", say: "「这台我亲手翻新的，电池换了新的，保修三个月。四百。」", sayEn: "“I refurbished this one myself — new battery, three months warranty. ¥400.”", pose: "talk", partner: [0x475569, 0x1f2937], money: -400, mood: 8, xp: 1 },
        ],
      },
    ],
  },
];

/* ================= Mall 商场 =================
   1F keeps the existing mall spots (try/milktea/toilet) + stairs up.
   2F fashion, 3F cinema/arcade. */
const MALL_BUILDINGS: BuildingDef[] = [
  {
    id: "mall", zh: "商场", en: "The mall",
    flavour: "一站式商场，吃穿玩全在一栋楼里", flavourEn: "Eat, shop and play — all under one roof",
    floors: [
      {
        floor: 1, label: "1F", zh: "餐饮快餐", en: "Food court",
        sign: "商场 · 1F 餐饮", signColor: 0xdc2626, accent: 0xdc2626,
        copy: "一楼餐饮：快餐、奶茶、小吃，逛累了先吃一口",
        copyEn: "Food court: fast food, bubble tea, snacks",
        spots: [
          { id: "try", emoji: "👗", zh: "试衣服", en: "Try it on", x: 2.15, z: -0.15 },
          { id: "milktea", emoji: "🧋", zh: "买奶茶", en: "Bubble tea", x: -3.6, z: 0.85 },
          { id: "toilet", emoji: "🚻", zh: "去洗手间", en: "Restroom", x: -1.1, z: 1.35 },
          up(),
        ],
        booths: [
          { id: "try", x: 2.15, z: -0.6, w: 2.4, d: 1.5, color: 0x111827, label: "服装店", labelEn: "Fashion", goods: [0xd9534a, 0x3f6d8e, 0xf5b942, 0x65a30d, 0xec4899] },
        ],
        npc: { who: "店员", whoEn: "Shop assistant", shirt: 0x111827, pants: 0x111827, faceId: "mall-1f-clerk" },
        talks: [],
      },
      {
        floor: 2, label: "2F", zh: "服装日用", en: "Fashion",
        sign: "商场 · 2F 服装", signColor: 0xec4899, accent: 0xec4899,
        copy: "二楼服装：新品、折扣、试衣间，店员比你还懂搭配",
        copyEn: "Fashion floor: new arrivals, discounts, fitting rooms",
        spots: [
          { id: "buy", emoji: "👗", zh: "买件衣服", en: "Buy clothes", x: -2.8, z: -0.2 },
          { id: "sale", emoji: "🏷️", zh: "淘打折款", en: "Hunt a discount", x: 2.6, z: 0.6 },
          down(-4.7, -0.9), up(),
        ],
        booths: [
          { id: "buy", x: -2.8, z: -0.6, w: 2.4, d: 1.5, color: 0xec4899, label: "服装店", labelEn: "Fashion", goods: [0xec4899, 0xd9534a, 0x3f6d8e, 0xf5b942, 0x65a30d] },
        ],
        npc: { who: "服装店员", whoEn: "The fashion assistant", shirt: 0xec4899, pants: 0x1f2937, faceId: "mall-2f-clerk" },
        talks: [
          { id: "buy", emoji: "👗", zh: "买件新衣服", en: "Buy something new to wear", who: "服装店员", whoEn: "The fashion assistant", say: "「这件今年最火的款，穿上身再讲价。」", sayEn: "“This is this year's bestseller — try it on, then we talk price.”", pose: "talk", partner: [0xec4899, 0x1f2937], money: -150, mood: 8 },
          { id: "sale", emoji: "🏷️", zh: "淘件打折衣服", en: "Pick up something on sale", who: "服装店员", whoEn: "The fashion assistant", say: "「这件五折，码不全了——你这个码正好有一件。」", sayEn: "“Half price, and your size is the last one left.”", pose: "talk", partner: [0xec4899, 0x1f2937], money: -60, mood: 6 },
        ],
      },
      {
        floor: 3, label: "3F", zh: "电影娱乐", en: "Cinema & games",
        sign: "商场 · 3F 电影", signColor: 0x7c3aed, accent: 0x7c3aed,
        copy: "三楼电影：影院、游戏厅、电玩城，约人来看一场",
        copyEn: "Cinema floor: movies, arcade, games — bring someone along",
        spots: [
          { id: "movie", emoji: "🎬", zh: "看场电影", en: "Watch a movie", x: 0.2, z: -0.2 },
          { id: "arcade", emoji: "🕹️", zh: "玩电玩", en: "Play arcade games", x: -3.0, z: -0.2 },
          down(),
        ],
        booths: [
          { id: "arcade", x: -3.0, z: -0.6, w: 2.2, d: 1.4, color: 0x7c3aed, label: "电玩城", labelEn: "Arcade", goods: [0x7c3aed, 0xec4899, 0xf59e0b, 0x38bdf8] },
        ],
        npc: { who: "影院售票员", whoEn: "The cinema cashier", shirt: 0x7c3aed, pants: 0x1f2937, faceId: "mall-3f-ticket" },
        talks: [
          { id: "movie", emoji: "🎬", zh: "看一场电影", en: "Watch a movie", who: "影院售票员", whoEn: "The cinema cashier", say: "「今晚这场快满了，最后一排还有两个位子。」", sayEn: "“Tonight's screening is nearly full — two seats left at the back.”", pose: "talk", partner: [0x7c3aed, 0x1f2937], money: -45, mood: 12, energy: -4 },
          { id: "arcade", emoji: "🕹️", zh: "打几局电玩", en: "Play a few arcade games", who: "影院售票员", whoEn: "The cinema cashier", say: "「游戏币三十块一袋，抓娃娃机在里头。」", sayEn: "“¥30 a bag of tokens — the claw machines are inside.”", pose: "talk", partner: [0x7c3aed, 0x1f2937], money: -30, mood: 8, energy: -4 },
        ],
      },
    ],
  },
];

/* ================= Museum 博物馆 ================= */
const MUSEUM_BUILDINGS: BuildingDef[] = [
  {
    id: "museum", zh: "博物馆", en: "The museum",
    flavour: "一座城的故事，分楼层慢慢讲", flavourEn: "The city's story, told floor by floor",
    floors: [
      {
        floor: 1, label: "1F", zh: "城市展厅", en: "City hall",
        sign: "博物馆 · 1F 城市展厅", signColor: 0x92400e, accent: 0x92400e,
        copy: "展厅：展柜、灯光、讲解员在讲这座城的故事",
        copyEn: "The gallery halls: display cases, spotlights, a guide telling the city's story",
        spots: [
          { id: "exhibit", emoji: "🏺", zh: "看展", en: "See the exhibit", x: 0.15, z: -0.2 },
          { id: "guide", emoji: "🎧", zh: "听讲解", en: "Hear the guide", x: -2.6, z: 0.85 },
          { id: "shop", emoji: "🎁", zh: "买个纪念品", en: "Buy a souvenir", x: 2.4, z: 0.6 },
          up(),
        ],
        npc: { who: "讲解员", whoEn: "The guide", shirt: 0x0ea5e9, pants: 0x1f2937, faceId: "museum-1f-guide" },
        talks: [
          { id: "shop", emoji: "🎁", zh: "买个文创纪念品", en: "Buy a museum souvenir", who: "讲解员", whoEn: "The guide", say: "「这款冰箱贴是馆里的爆款，拿回去贴冰箱上。」", sayEn: "“This fridge magnet is our bestseller — stick it on your fridge.”", pose: "talk", partner: [0x0ea5e9, 0x1f2937], money: -40, mood: 6 },
        ],
      },
      {
        floor: 2, label: "2F", zh: "古代史", en: "Ancient history",
        sign: "博物馆 · 2F 古代史", signColor: 0x92400e, accent: 0x92400e,
        copy: "二楼古代史：青铜、瓷器、海上丝绸之路",
        copyEn: "Ancient history: bronzes, porcelain, the Maritime Silk Road",
        spots: [
          { id: "bronze", emoji: "🏺", zh: "看青铜器", en: "See the bronzes", x: 0.2, z: -0.2 },
          { id: "porcelain", emoji: "🍶", zh: "看瓷器", en: "See the porcelain", x: 2.6, z: 0.6 },
          down(), up(),
        ],
        npc: { who: "讲解员", whoEn: "The guide", shirt: 0x92400e, pants: 0x1f2937, faceId: "museum-2f-guide" },
        talks: [
          { id: "bronze", emoji: "🏺", zh: "看一件青铜器", en: "Look at a bronze", who: "讲解员", whoEn: "The guide", say: "「这件青铜鼎三千岁了，出土的时候，土里还带着海的味道。」", sayEn: "“This bronze tripod is three thousand years old — it still smelled of the sea when it was dug up.”", pose: "talk", partner: [0x92400e, 0x1f2937], mood: 6, xp: 2 },
          { id: "porcelain", emoji: "🍶", zh: "看宋瓷", en: "Look at Song porcelain", who: "讲解员", whoEn: "The guide", say: "「这釉色叫天青，雨过天青云破处——烧一窑，成三件。」", sayEn: "“This glaze is 'sky blue after rain' — fire a kiln, get three good pieces.”", pose: "talk", partner: [0x92400e, 0x1f2937], mood: 6, xp: 2 },
        ],
      },
      {
        floor: 3, label: "3F", zh: "近现代", en: "Modern history",
        sign: "博物馆 · 3F 近现代", signColor: 0x0ea5e9, accent: 0x0ea5e9,
        copy: "三楼近现代：改革开放、渔村变大城，老照片一面墙",
        copyEn: "Modern history: reform and opening, fishing village to big city",
        spots: [
          { id: "photo", emoji: "📸", zh: "看老照片", en: "See the old photos", x: -0.5, z: -0.2 },
          { id: "story", emoji: "🎧", zh: "听老馆员讲故事", en: "Hear the old curator", x: 2.4, z: 0.6 },
          down(),
        ],
        npc: { who: "老馆员", whoEn: "The old curator", shirt: 0x0ea5e9, pants: 0x1f2937, faceId: "museum-3f-curator" },
        talks: [
          { id: "photo", emoji: "📸", zh: "看一面老照片墙", en: "Look at the wall of old photos", who: "老馆员", whoEn: "The old curator", say: "「这张是八十年代的华强北，那时候全是田。谁能想到呢。」", sayEn: "“This is Huaqiangbei in the eighties — all fields back then. Who would have thought.”", pose: "talk", partner: [0x0ea5e9, 0x1f2937], mood: 6, xp: 1 },
          { id: "story", emoji: "🎧", zh: "听老馆员讲故事", en: "Hear the curator's stories", who: "老馆员", whoEn: "The old curator", say: "「我在馆里四十年，讲的每一件东西，我都摸过。」", sayEn: "“Forty years in this museum — every piece I tell you about, I've held.”", pose: "talk", partner: [0x0ea5e9, 0x1f2937], mood: 8, xp: 2, network: 1 },
        ],
      },
    ],
  },
];

/* ================= Library 图书馆 =================
   The existing librarian line becomes real: "地方志在三楼，考试资料在
   二楼" — 2F is exam books, 3F is local history. */
const LIBRARY_BUILDINGS: BuildingDef[] = [
  {
    id: "library", zh: "图书馆", en: "The library",
    flavour: "书架、阅览桌、自修室，翻书声比说话声大", flavourEn: "Shelves, reading tables, study halls",
    floors: [
      {
        floor: 1, label: "1F", zh: "借阅大厅", en: "Lending hall",
        sign: "图书馆 · 1F 借阅大厅", signColor: 0x7c3aed, accent: 0x7c3aed,
        copy: "书架、阅览桌、自修室，翻书声比说话声大",
        copyEn: "Shelves, reading tables, a study hall — pages turning louder than voices",
        spots: [
          { id: "borrow", emoji: "📚", zh: "借本书", en: "Borrow a book", x: 0.15, z: -0.2 },
          { id: "study", emoji: "📖", zh: "坐下自修", en: "Sit and study", x: 2.4, z: 0.6 },
          up(),
        ],
        npc: { who: "图书管理员", whoEn: "The librarian", shirt: 0x78716c, pants: 0x374151, faceId: "library-1f-librarian" },
        talks: [],
      },
      {
        floor: 2, label: "2F", zh: "考试资料", en: "Exam books",
        sign: "图书馆 · 2F 考试资料", signColor: 0x7c3aed, accent: 0x7c3aed,
        copy: "二楼考试资料：考证、考研、公务员，桌上全是做题的人",
        copyEn: "Exam books: certificates, grad school, civil service — everyone studying",
        spots: [
          { id: "exam", emoji: "📝", zh: "找考试资料", en: "Find exam books", x: 0.2, z: -0.2 },
          { id: "desk", emoji: "📖", zh: "占个座自修", en: "Take a desk and study", x: 2.6, z: 0.6 },
          down(), up(),
        ],
        npc: { who: "自修的同学", whoEn: "A student studying", shirt: 0x7c3aed, pants: 0x1f2937, faceId: "library-2f-student" },
        talks: [
          { id: "exam", emoji: "📝", zh: "借本考试书", en: "Borrow an exam book", who: "自修的同学", whoEn: "A student studying", say: "「这本真题我刷了三遍，错题都标红了，你拿去。」", sayEn: "“I've done this past-paper book three times — mistakes marked in red. Take it.”", pose: "talk", partner: [0x7c3aed, 0x1f2937], mood: 4, xp: 2 },
          { id: "desk", emoji: "📖", zh: "坐下刷会儿题", en: "Sit down and work through problems", who: "自己", whoEn: "You", say: "「这道题，终于做对了。」", sayEn: "“Finally got this one right.”", pose: "sit", mood: 4, xp: 2, energy: -4 },
        ],
      },
      {
        floor: 3, label: "3F", zh: "地方志", en: "Local history",
        sign: "图书馆 · 3F 地方志", signColor: 0x92400e, accent: 0x92400e,
        copy: "三楼地方志：深圳、惠州、香港的老地图和老报纸",
        copyEn: "Local history: old maps and newspapers of Shenzhen, Huizhou, Hong Kong",
        spots: [
          { id: "local", emoji: "📜", zh: "翻地方志", en: "Read the local gazette", x: -0.5, z: -0.2 },
          { id: "map", emoji: "🗺️", zh: "看老地图", en: "Look at old maps", x: 2.4, z: 0.6 },
          down(),
        ],
        npc: { who: "地方志研究员", whoEn: "The local-history researcher", shirt: 0x92400e, pants: 0x1f2937, faceId: "library-3f-scholar" },
        talks: [
          { id: "local", emoji: "📜", zh: "翻一本地方志", en: "Read a local gazette", who: "地方志研究员", whoEn: "The local-history researcher", say: "「这本志里写了，你家那片以前叫什么村。」", sayEn: "“This gazette says what your neighbourhood used to be called.”", pose: "talk", partner: [0x92400e, 0x1f2937], mood: 6, xp: 2 },
          { id: "map", emoji: "🗺️", zh: "看一张老地图", en: "Look at an old map", who: "地方志研究员", whoEn: "The local-history researcher", say: "「这张地图上，深圳还只是一个小渔村。」", sayEn: "“On this map, Shenzhen is still a small fishing village.”", pose: "talk", partner: [0x92400e, 0x1f2937], mood: 6, xp: 2 },
        ],
      },
    ],
  },
];

/* ================= Hospital / Clinic 医院 ================= */
const CLINIC_BUILDINGS: BuildingDef[] = [
  {
    id: "clinic", zh: "医院", en: "The hospital",
    flavour: "挂号、检查、体检，分楼层走", flavourEn: "Registration, tests, check-ups — floor by floor",
    floors: [
      {
        floor: 1, label: "1F", zh: "挂号门诊", en: "Registration & clinic",
        sign: "医院 · 1F 挂号门诊", signColor: 0x0891b2, accent: 0x0891b2,
        copy: "候诊区、叫号屏、白大褂",
        copyEn: "The waiting area, the queue screen, white coats",
        spots: [
          { id: "see", emoji: "🩺", zh: "挂号看病", en: "See a doctor", x: 2.15, z: 0.25 },
          { id: "nurse", emoji: "💉", zh: "问医保", en: "Ask insurance", x: -1.6, z: 0.55 },
          up(),
        ],
        npc: { who: "医生", whoEn: "The doctor", shirt: 0xffffff, pants: 0x1e3a8a, faceId: "clinic-1f-doctor" },
        talks: [],
      },
      {
        floor: 2, label: "2F", zh: "检查药房", en: "Tests & pharmacy",
        sign: "医院 · 2F 检查/药房", signColor: 0x0891b2, accent: 0x0891b2,
        copy: "二楼检查和药房：抽血、拍片、取药，叫号声此起彼伏",
        copyEn: "Tests and pharmacy: blood draws, scans, prescriptions",
        spots: [
          { id: "test", emoji: "🩸", zh: "做个检查", en: "Have a test", x: 0.2, z: -0.2 },
          { id: "pharmacy", emoji: "💊", zh: "取药", en: "Pick up medicine", x: 2.6, z: 0.6 },
          down(), up(),
        ],
        npc: { who: "药剂师", whoEn: "The pharmacist", shirt: 0x0891b2, pants: 0x1f2937, faceId: "clinic-2f-pharmacist" },
        talks: [
          { id: "test", emoji: "🩸", zh: "做个血常规", en: "Have a blood test", who: "药剂师", whoEn: "The pharmacist", say: "「抽血在二楼，空腹来。结果下午三点出。」", sayEn: "“Blood tests are on this floor — come fasting. Results at three.”", pose: "talk", partner: [0x0891b2, 0x1f2937], money: -80, mood: 2, xp: 1 },
          { id: "pharmacy", emoji: "💊", zh: "取药", en: "Pick up medicine", who: "药剂师", whoEn: "The pharmacist", say: "「这药饭后吃，一天两次，别空腹。」", sayEn: "“Take this after meals, twice a day — not on an empty stomach.”", pose: "talk", partner: [0x0891b2, 0x1f2937], money: -40, mood: 3 },
        ],
      },
      {
        floor: 3, label: "3F", zh: "体检中心", en: "Check-up centre",
        sign: "医院 · 3F 体检", signColor: 0x059669, accent: 0x059669,
        copy: "三楼体检中心：全套体检，报告要等三天",
        copyEn: "Check-up centre: the full work-up, results in three days",
        spots: [
          { id: "checkup", emoji: "🩺", zh: "做个体检", en: "Have a check-up", x: -0.5, z: -0.2 },
          { id: "rest", emoji: "🪑", zh: "在长椅坐会儿", en: "Sit on the bench", x: 2.4, z: 0.6 },
          down(),
        ],
        npc: { who: "体检护士", whoEn: "The check-up nurse", shirt: 0x059669, pants: 0x1f2937, faceId: "clinic-3f-nurse" },
        talks: [
          { id: "checkup", emoji: "🩺", zh: "做个全套体检", en: "Have a full check-up", who: "体检护士", whoEn: "The check-up nurse", say: "「全套两百，报告三天后取。身体是本钱，别省这点。」", sayEn: "“Full work-up, ¥200, results in three days. Health is capital — don't skimp.”", pose: "talk", partner: [0x059669, 0x1f2937], money: -200, mood: 4, xp: 1, energy: 6 },
          { id: "rest", emoji: "🪑", zh: "在走廊长椅坐会儿", en: "Sit on the corridor bench", who: "自己", whoEn: "You", say: "「等报告的时候，时间过得特别慢。」", sayEn: "“Waiting for results, time moves so slowly.”", pose: "sit", mood: 4 },
        ],
      },
    ],
  },
];

/* ================= Dafen 大芬油画村 (2 floors) =================
   1F keeps the existing spots (buy/paint/frame) + stairs up. 2F is the
   painters' studio upstairs. */
const OILPAINTING_BUILDINGS: BuildingDef[] = [
  {
    id: "dafen", zh: "大芬油画村", en: "Dafen Oil Painting Village",
    flavour: "满墙油画，楼上是画家赶单的画室", flavourEn: "Walls of paintings; upstairs, the painters' studio",
    floors: [
      {
        floor: 1, label: "1F", zh: "画廊", en: "Gallery",
        sign: "大芬油画村 · 1F 画廊", signColor: 0x7c2d12, accent: 0x7c2d12,
        copy: "满墙油画：画架、颜料、正在作画的画家，隔壁就是装裱店",
        copyEn: "Walls of oil paintings: easels, paint, a painter at work, a framing shop next door",
        spots: [
          { id: "buy", emoji: "🖼️", zh: "买幅画挂家里", en: "Buy a painting", x: 1.9, z: -0.1 },
          { id: "paint", emoji: "🎨", zh: "看画家作画", en: "Watch the painter", x: -2.6, z: -0.2 },
          { id: "frame", emoji: "🪟", zh: "装裱一幅画", en: "Frame a painting", x: 3.6, z: 0.6 },
          up(5.0, -0.9),
        ],
        booths: [
          { id: "buy", x: 1.9, z: -0.6, w: 2.4, d: 1.5, color: 0x7c2d12, label: "画廊", labelEn: "Gallery", goods: [0x2b5ea7, 0xd9534a, 0x65a30d, 0xf5b942, 0x8b5cf6] },
        ],
        npc: { who: "画廊老板", whoEn: "The gallery owner", shirt: 0x7c3aed, pants: 0x1f2937, faceId: "dafen-1f-owner" },
        talks: [],
      },
      {
        floor: 2, label: "2F", zh: "画室", en: "Studio",
        sign: "大芬油画村 · 2F 画室", signColor: 0xd9534a, accent: 0xd9534a,
        copy: "二楼画室：画家们在赶单，颜料味、松节油味，满地都是画布",
        copyEn: "The studio upstairs: painters working to order, the smell of paint",
        spots: [
          { id: "paint2", emoji: "🎨", zh: "看画家赶单", en: "Watch painters at work", x: 0.2, z: -0.2 },
          { id: "learn", emoji: "🖌️", zh: "跟画家学两笔", en: "Learn a few strokes", x: 2.6, z: 0.6 },
          down(),
        ],
        booths: [
          { id: "paint2", x: 0.2, z: -0.6, w: 2.4, d: 1.5, color: 0xd9534a, label: "画室", labelEn: "Studio", goods: [0x2b5ea7, 0xd9534a, 0xf5b942, 0x65a30d] },
        ],
        npc: { who: "画家", whoEn: "The painter", shirt: 0xe8e2d4, pants: 0x374151, faceId: "dafen-2f-painter" },
        talks: [
          { id: "paint2", emoji: "🎨", zh: "看画家赶单", en: "Watch the painters rush an order", who: "画家", whoEn: "The painter", say: "「这批是给酒店的，两百幅，月底交。你看这手速。」", sayEn: "“Two hundred for a hotel, due by month's end. Watch the speed.”", pose: "talk", partner: [0xe8e2d4, 0x374151], mood: 6, xp: 1 },
          { id: "learn", emoji: "🖌️", zh: "跟画家学两笔", en: "Learn a few brushstrokes", who: "画家", whoEn: "The painter", say: "「手腕别僵，颜料要厚。来，你试一笔。」", sayEn: "“Keep the wrist loose, lay the paint thick. Here — you try.”", pose: "talk", partner: [0xe8e2d4, 0x374151], money: -50, mood: 8, xp: 2 },
        ],
      },
    ],
  },
];

/* ================= Qiaodong 桥东二手市集 (2 floors) ================= */
const SECONDHAND_BUILDINGS: BuildingDef[] = [
  {
    id: "qiaodong", zh: "桥东二手市集", en: "Qiaodong Second-hand Market",
    flavour: "地摊一排排，楼上是旧家具和黑胶", flavourEn: "Stalls in rows; upstairs, old furniture and vinyl",
    floors: [
      {
        floor: 1, label: "1F", zh: "地摊区", en: "Street stalls",
        sign: "桥东二手市集 · 1F 地摊", signColor: 0x3f6212, accent: 0x3f6212,
        copy: "二手市集：旧手机、旧家具、黑胶唱片，地摊一排排",
        copyEn: "The second-hand market: used phones, old furniture, vinyl, stall after stall",
        spots: [
          { id: "browse", emoji: "📻", zh: "淘旧货", en: "Browse the stalls", x: 0.15, z: -0.2 },
          { id: "haggle", emoji: "💬", zh: "跟摊主讲价", en: "Haggle", x: -3.6, z: 0.85 },
          up(),
        ],
        booths: [
          { id: "browse", x: 0.15, z: -0.6, w: 2.4, d: 1.5, color: 0x3f6212, label: "旧货摊", labelEn: "Old goods", goods: [0x111827, 0xe8eef2, 0x1d4ed8, 0x14181d] },
        ],
        npc: { who: "摊主", whoEn: "The stall owner", shirt: 0x78716c, pants: 0x2f333a, faceId: "qiaodong-1f-stall" },
        talks: [],
      },
      {
        floor: 2, label: "2F", zh: "旧家具/黑胶", en: "Furniture & vinyl",
        sign: "桥东二手市集 · 2F 旧家具", signColor: 0x78716c, accent: 0x78716c,
        copy: "二楼旧家具和黑胶：木头桌椅、老唱片，淘到就是赚到",
        copyEn: "Old furniture and vinyl upstairs — a find here is money saved",
        spots: [
          { id: "furn", emoji: "🪑", zh: "淘件旧家具", en: "Find old furniture", x: -0.5, z: -0.2 },
          { id: "vinyl", emoji: "💿", zh: "淘张黑胶", en: "Find a vinyl record", x: 2.4, z: 0.6 },
          down(-4.7, -0.9),
        ],
        booths: [
          { id: "furn", x: -0.5, z: -0.6, w: 2.4, d: 1.5, color: 0x78716c, label: "旧家具", labelEn: "Furniture", goods: [0x8a5a3b, 0x74522f, 0x3f6d8e, 0x65a30d] },
        ],
        npc: { who: "旧家具老板", whoEn: "The furniture seller", shirt: 0x78716c, pants: 0x2f333a, faceId: "qiaodong-2f-boss" },
        talks: [
          { id: "furn", emoji: "🪑", zh: "淘件旧家具", en: "Pick up old furniture", who: "旧家具老板", whoEn: "The furniture seller", say: "「这把椅子是实木的，三十年前做的，比新的结实。」", sayEn: "“Solid wood, thirty years old — sturdier than anything new.”", pose: "talk", partner: [0x78716c, 0x2f333a], money: -80, mood: 8 },
          { id: "vinyl", emoji: "💿", zh: "淘张黑胶唱片", en: "Pick up a vinyl record", who: "旧家具老板", whoEn: "The furniture seller", say: "「这张邓丽君是首版，品相还行，拿回去慢慢听。」", sayEn: "“First pressing of Teresa Teng — decent condition. Take it home and listen.”", pose: "talk", partner: [0x78716c, 0x2f333a], money: -40, mood: 6 },
        ],
      },
    ],
  },
];

/* ================= Seafood 海鲜街 (2 floors) ================= */
const SEAFOOD_BUILDINGS: BuildingDef[] = [
  {
    id: "seafood", zh: "海鲜街", en: "Seafood Street",
    flavour: "楼下挑海鲜，楼上大排档现做", flavourEn: "Pick seafood downstairs, eat it upstairs",
    floors: [
      {
        floor: 1, label: "1F", zh: "海鲜街", en: "Seafood street",
        sign: "海鲜街 · 1F 海鲜档", signColor: 0x0891b2, accent: 0x0891b2,
        copy: "海鲜街：水箱里的活鱼活虾，现捞现称，隔壁大排档代加工",
        copyEn: "The seafood street: live fish and prawns in tanks, weighed on the spot",
        spots: [
          { id: "buy", emoji: "🦐", zh: "挑海鲜", en: "Pick seafood", x: 0.15, z: -0.2 },
          { id: "eat", emoji: "🍲", zh: "大排档代加工", en: "Cook it at the dai pai dong", x: 3.4, z: 0.6 },
          { id: "boat", emoji: "⛵", zh: "跟渔民出海", en: "Go out with a fisherman", x: -4.1, z: -0.15 },
          up(),
        ],
        booths: [
          { id: "buy", x: 0.15, z: -0.6, w: 2.4, d: 1.5, color: 0x0891b2, label: "海鲜档", labelEn: "Seafood", goods: [0x0891b2, 0x0369a1, 0x38bdf8, 0xf59e0b] },
        ],
        npc: { who: "海鲜档老板", whoEn: "The seafood seller", shirt: 0x0e7490, pants: 0x1f2937, faceId: "seafood-1f-boss" },
        talks: [],
      },
      {
        floor: 2, label: "2F", zh: "大排档", en: "Dai pai dong",
        sign: "海鲜街 · 2F 大排档", signColor: 0xea580c, accent: 0xea580c,
        copy: "二楼大排档：现捞现做，啤酒、宵夜，半夜还亮着灯",
        copyEn: "The dai pai dong upstairs: caught and cooked, beer and late nights",
        spots: [
          { id: "cook2", emoji: "🍲", zh: "吃顿海鲜大餐", en: "Eat a seafood feast", x: -0.5, z: -0.2 },
          { id: "beer", emoji: "🍺", zh: "喝杯啤酒", en: "Have a beer", x: 2.4, z: 0.6 },
          down(),
        ],
        npc: { who: "大排档老板", whoEn: "The dai pai dong cook", shirt: 0x7a9a4d, pants: 0x44403c, faceId: "seafood-2f-cook" },
        talks: [
          { id: "cook2", emoji: "🍲", zh: "吃顿海鲜大餐", en: "Eat a seafood feast", who: "大排档老板", whoEn: "The dai pai dong cook", say: "「刚捞的膏蟹，清蒸，配姜醋。坐下，别客气。」", sayEn: "“Fresh crab, steamed, ginger and vinegar. Sit down, don't be polite.”", pose: "eat", partner: [0x7a9a4d, 0x44403c], money: -80, hunger: 35, mood: 10 },
          { id: "beer", emoji: "🍺", zh: "喝杯冰啤酒", en: "Have an ice-cold beer", who: "大排档老板", whoEn: "The dai pai dong cook", say: "「冰的，刚从冰柜里拿出来。配着海鲜吃，最爽。」", sayEn: "“Ice cold, straight from the fridge. Best with seafood.”", pose: "talk", partner: [0x7a9a4d, 0x44403c], money: -15, mood: 6 },
        ],
      },
    ],
  },
];

/* ================= Oldtown 老街 (2 floors: street + 骑楼二层) ================= */
const OLDTOWN_BUILDINGS: BuildingDef[] = [
  {
    id: "oldtown", zh: "老街", en: "The old street",
    flavour: "楼下骑楼小吃，楼上老茶馆", flavourEn: "Snacks under the arcades, an old teahouse above",
    floors: [
      {
        floor: 1, label: "1F", zh: "骑楼老街", en: "Old street",
        sign: "老街 · 1F 骑楼", signColor: 0xb45309, accent: 0xb45309,
        copy: "老街：骑楼、老字号小吃、界碑和旧招牌",
        copyEn: "The old street: arcades, old shops, snacks, boundary stones and faded signs",
        spots: [
          { id: "snack", emoji: "🍢", zh: "吃客家小吃", en: "Try a Hakka snack", x: 0.15, z: -0.2 },
          { id: "stroll", emoji: "🚶", zh: "逛骑楼老街", en: "Walk the old street", x: -2.2, z: 0.65 },
          up(),
        ],
        booths: [
          { id: "snack", x: 0.15, z: -0.6, w: 2.4, d: 1.5, color: 0xb45309, label: "小吃档", labelEn: "Snacks", goods: [0xf59e0b, 0xd9534a, 0x65a30d, 0x8a5a3b] },
        ],
        npc: { who: "小吃档老板", whoEn: "The snack seller", shirt: 0x7a9a4d, pants: 0x44403c, faceId: "oldtown-1f-snack" },
        talks: [],
      },
      {
        floor: 2, label: "2F", zh: "骑楼茶馆", en: "Teahouse",
        sign: "老街 · 2F 骑楼茶馆", signColor: 0xb45309, accent: 0xb45309,
        copy: "二楼骑楼：老茶馆、旧招牌，楼下是整条老街",
        copyEn: "The teahouse above the arcades: old signs, the whole street below",
        spots: [
          { id: "tea", emoji: "🍵", zh: "喝盅老茶", en: "Drink old-style tea", x: -0.5, z: -0.2 },
          { id: "view2", emoji: "🏮", zh: "凭栏看老街", en: "Look over the old street", x: 2.4, z: 0.6 },
          down(),
        ],
        npc: { who: "茶馆老板", whoEn: "The teahouse owner", shirt: 0xb45309, pants: 0x1f2937, faceId: "oldtown-2f-tea" },
        talks: [
          { id: "tea", emoji: "🍵", zh: "喝盅功夫茶", en: "Drink gongfu tea", who: "茶馆老板", whoEn: "The teahouse owner", say: "「这盅是单枞，香得很。坐下，慢慢喝。」", sayEn: "“Dancong, this one — fragrant. Sit, take your time.”", pose: "talk", partner: [0xb45309, 0x1f2937], money: -20, mood: 8, energy: 4 },
          { id: "view2", emoji: "🏮", zh: "凭栏看老街", en: "Look over the old street from the rail", who: "自己", whoEn: "You", say: "「楼下那条街，比这座城的大多数楼都老。」", sayEn: "“The street below is older than most of the city's buildings.”", pose: "idle", mood: 8 },
        ],
      },
    ],
  },
];

/* ================= Women's Street 女人街 (2 floors) ================= */
const WOMENSSTREET_BUILDINGS: BuildingDef[] = [
  {
    id: "womens", zh: "女人街", en: "Ladies' Market",
    flavour: "楼下衣服金鱼花，楼上饰品鞋袜", flavourEn: "Clothes, goldfish and flowers below; accessories above",
    floors: [
      {
        floor: 1, label: "1F", zh: "服装金鱼花", en: "Clothes & goldfish",
        sign: "女人街 · 1F 服装", signColor: 0xe879f9, accent: 0xe879f9,
        copy: "女人街：服装鞋袜档、金鱼档、花档，平价小商品一眼望不到头",
        copyEn: "The Ladies' Market: clothes, goldfish, flowers, cheap goods as far as you can see",
        spots: [
          { id: "clothes", emoji: "👗", zh: "淘衣服鞋袜", en: "Browse clothes", x: 0.15, z: -0.2 },
          { id: "fish", emoji: "🐠", zh: "买条金鱼", en: "Buy a goldfish", x: -3.6, z: 0.85 },
          { id: "flower", emoji: "🌸", zh: "买束花", en: "Buy flowers", x: 2.4, z: 0.6 },
          up(),
        ],
        booths: [
          { id: "clothes", x: 0.15, z: -0.4, w: 2.4, d: 1.5, color: 0xe879f9, label: "服装档", labelEn: "Clothes", goods: [0xec4899, 0xf59e0b, 0x38bdf8, 0x65a30d, 0xd9534a] },
        ],
        npc: { who: "服装档老板", whoEn: "The clothes seller", shirt: 0xec4899, pants: 0x2f333a, faceId: "womens-1f-clothes" },
        talks: [],
      },
      {
        floor: 2, label: "2F", zh: "饰品鞋袜", en: "Accessories",
        sign: "女人街 · 2F 饰品", signColor: 0xdb2777, accent: 0xdb2777,
        copy: "二楼饰品鞋袜：耳环、发夹、袜子，十块钱三双",
        copyEn: "Accessories upstairs: earrings, hair clips, socks — three pairs for ¥10",
        spots: [
          { id: "jewelry", emoji: "💍", zh: "挑件饰品", en: "Pick some jewellery", x: -0.5, z: -0.2 },
          { id: "socks", emoji: "🧦", zh: "买几双袜子", en: "Buy some socks", x: 2.4, z: 0.6 },
          down(-4.7, -0.9),
        ],
        booths: [
          { id: "jewelry", x: -0.5, z: -0.4, w: 2.4, d: 1.5, color: 0xdb2777, label: "饰品档", labelEn: "Jewellery", goods: [0xdb2777, 0xf59e0b, 0x38bdf8, 0xec4899] },
        ],
        npc: { who: "饰品档老板娘", whoEn: "The jewellery seller", shirt: 0xdb2777, pants: 0x1f2937, faceId: "womens-2f-stall" },
        talks: [
          { id: "jewelry", emoji: "💍", zh: "挑个耳环", en: "Pick out earrings", who: "饰品档老板娘", whoEn: "The jewellery seller", say: "「这对珍珠的，戴上显白。三十，送你一对耳钉。」", sayEn: "“Pearls — they brighten your face. ¥30, and I'll throw in a pair of studs.”", pose: "talk", partner: [0xdb2777, 0x1f2937], money: -30, mood: 6 },
          { id: "socks", emoji: "🧦", zh: "买三双袜子", en: "Buy three pairs of socks", who: "饰品档老板娘", whoEn: "The jewellery seller", say: "「纯棉的，十块钱三双。拿回去穿。」", sayEn: "“Pure cotton, three pairs for ¥10.”", pose: "talk", partner: [0xdb2777, 0x1f2937], money: -15, mood: 4 },
        ],
      },
    ],
  },
];

/* ================= Fishing Port 渔港 (2 zones: 码头 + 鱼市) =================
   A pier is open-air, so the "floors" are two zones: the pier itself and
   the fish-market hall above it. */
const FISHINGPORT_BUILDINGS: BuildingDef[] = [
  {
    id: "port", zh: "渔港", en: "The fishing port",
    flavour: "码头和鱼市，刚上岸的海鲜", flavourEn: "Pier and fish market — the fresh catch",
    floors: [
      {
        floor: 1, label: "1F", zh: "码头", en: "The pier",
        sign: "渔港 · 1F 码头", signColor: 0x0369a1, accent: 0x0369a1,
        copy: "渔港码头：渔船、渔网、刚上岸的海鲜，鱼贩在码头边叫卖",
        copyEn: "The fishing port: boats, nets, the fresh catch, fish sellers on the pier",
        spots: [
          { id: "buy", emoji: "🐟", zh: "买刚上岸的海鲜", en: "Buy the fresh catch", x: 0.15, z: -0.2 },
          { id: "boat", emoji: "⛵", zh: "跟船出海", en: "Go out on a boat", x: -3.6, z: 0.85 },
          up(),
        ],
        booths: [
          { id: "buy", x: 0.15, z: 0.1, w: 2.4, d: 1.5, color: 0x0369a1, label: "鱼摊", labelEn: "Fish stall", goods: [0x0369a1, 0x0891b2, 0x38bdf8, 0xf59e0b] },
        ],
        npc: { who: "鱼贩", whoEn: "The fish seller", shirt: 0x0891b2, pants: 0x1f2937, faceId: "port-1f-seller" },
        talks: [],
      },
      {
        floor: 2, label: "2F", zh: "鱼市", en: "Fish market",
        sign: "渔港 · 2F 鱼市", signColor: 0x0369a1, accent: 0x0369a1,
        copy: "二楼鱼市大厅：刚卸船的海鲜，批发价，鱼贩子天不亮就来",
        copyEn: "The fish-market hall: the fresh catch at wholesale prices",
        spots: [
          { id: "wholesale", emoji: "🐟", zh: "批发海鲜", en: "Buy seafood wholesale", x: -0.5, z: -0.2 },
          { id: "auction", emoji: "🔨", zh: "看竞价", en: "Watch the auction", x: 2.4, z: 0.6 },
          down(-4.7, -0.9),
        ],
        npc: { who: "批发鱼贩", whoEn: "The wholesale fish seller", shirt: 0x0369a1, pants: 0x1f2937, faceId: "port-2f-wholesale" },
        talks: [
          { id: "wholesale", emoji: "🐟", zh: "批发一箱海鲜", en: "Buy a box of seafood wholesale", who: "批发鱼贩", whoEn: "The wholesale fish seller", say: "「一箱二十斤，刚卸船的。拿回去开个海鲜档都够了。」", sayEn: "“Twenty jin a box, just off the boat — enough to open your own stall.”", pose: "talk", partner: [0x0369a1, 0x1f2937], money: -120, mood: 6, xp: 1 },
          { id: "auction", emoji: "🔨", zh: "看一场竞价", en: "Watch an auction", who: "批发鱼贩", whoEn: "The wholesale fish seller", say: "「这批金枪鱼，价高者得。你看着，学学怎么叫价。」", sayEn: "“This tuna goes to the highest bidder. Watch and learn how to call a price.”", pose: "talk", partner: [0x0369a1, 0x1f2937], mood: 6, xp: 1 },
        ],
      },
    ],
  },
];

/* ================= Factory 工厂 (2 floors) =================
   1F keeps the existing spots (tour/ask/canteen) + stairs up. 2F is the
   dorm + activity room — the canteen stays on 1F so its existing talk
   keeps its pin. */
const FACTORY_BUILDINGS: BuildingDef[] = [
  {
    id: "factory", zh: "工厂", en: "The factory",
    flavour: "楼下产线，楼上宿舍", flavourEn: "Production lines below, dorms above",
    floors: [
      {
        floor: 1, label: "1F", zh: "产线", en: "Production line",
        sign: "工厂 · 1F 产线", signColor: 0x64748b, accent: 0x64748b,
        copy: "厂区：厂房、产线、宿舍和食堂，三班倒的灯火",
        copyEn: "The plant: workshops, lines, dorms and the canteen, lit for three shifts",
        spots: [
          { id: "tour", emoji: "🏭", zh: "看产线", en: "See the line", x: 0.15, z: -0.2 },
          { id: "ask", emoji: "🙋", zh: "问问三班倒", en: "Ask about shifts", x: -2.6, z: 0.85 },
          { id: "canteen", emoji: "🍱", zh: "在食堂吃一顿", en: "Eat in the canteen", x: 4.2, z: 1.2 },
          up(4.9, -0.9),
        ],
        npc: { who: "班长", whoEn: "The shift lead", shirt: 0xf5b301, pants: 0x2e3440, faceId: "factory-1f-lead" },
        talks: [],
      },
      {
        floor: 2, label: "2F", zh: "宿舍", en: "Dorms",
        sign: "工厂 · 2F 宿舍", signColor: 0x64748b, accent: 0x64748b,
        copy: "二楼宿舍和活动室：上下铺、电视、打牌的工友",
        copyEn: "Dorms and the activity room upstairs: bunk beds, TV, cards",
        spots: [
          { id: "dorm", emoji: "🛏️", zh: "看看宿舍", en: "See the dorms", x: -0.5, z: -0.2 },
          { id: "cards", emoji: "🃏", zh: "跟工友打牌", en: "Play cards with coworkers", x: 2.4, z: 0.6 },
          down(),
        ],
        npc: { who: "工友", whoEn: "A coworker", shirt: 0x64748b, pants: 0x1f2937, faceId: "factory-2f-worker" },
        talks: [
          { id: "dorm", emoji: "🛏️", zh: "看看宿舍", en: "See the dorms", who: "工友", whoEn: "A coworker", say: "「八人间，上下铺。住习惯了，也挺好。」", sayEn: "“Eight to a room, bunk beds. You get used to it.”", pose: "talk", partner: [0x64748b, 0x1f2937], mood: 4 },
          { id: "cards", emoji: "🃏", zh: "跟工友打会儿牌", en: "Play cards with coworkers", who: "工友", whoEn: "A coworker", say: "「来一局？输了的请喝水。」", sayEn: "“A round? Loser buys the drinks.”", pose: "talk", partner: [0x64748b, 0x1f2937], mood: 8, network: 1 },
        ],
      },
    ],
  },
];

/* ================= Registry ================= */

/** Every venue set with a multi-floor building. Keyed by LifeSet — it
    applies to every place that walks into that set. */
export const FLOOR_PLANS: Partial<Record<LifeSet, BuildingDef[]>> = {
  electronics: ELECTRONICS_BUILDINGS,
  mall: MALL_BUILDINGS,
  museum: MUSEUM_BUILDINGS,
  library: LIBRARY_BUILDINGS,
  clinic: CLINIC_BUILDINGS,
  oilpainting: OILPAINTING_BUILDINGS,
  secondhand: SECONDHAND_BUILDINGS,
  seafood: SEAFOOD_BUILDINGS,
  oldtown: OLDTOWN_BUILDINGS,
  womensstreet: WOMENSSTREET_BUILDINGS,
  fishingport: FISHINGPORT_BUILDINGS,
  factory: FACTORY_BUILDINGS,
};

export function hasFloors(set: LifeSet): boolean {
  return !!FLOOR_PLANS[set]?.length;
}

export function buildingsFor(set: LifeSet): BuildingDef[] {
  return FLOOR_PLANS[set] ?? [];
}

/** The building for a visit; unknown/null id falls back to the first. */
export function buildingDef(set: LifeSet, buildingId?: string | null): BuildingDef | undefined {
  const bs = FLOOR_PLANS[set];
  if (!bs?.length) return undefined;
  return bs.find((b) => b.id === buildingId) ?? bs[0];
}

export function maxFloor(set: LifeSet, buildingId?: string | null): number {
  return buildingDef(set, buildingId)?.floors.length ?? 1;
}

/** The floor definition for a visit; floor is clamped to the building. */
export function floorDef(set: LifeSet, buildingId: string | null | undefined, floor: number): FloorDef | undefined {
  const b = buildingDef(set, buildingId);
  if (!b) return undefined;
  const f = Math.max(1, Math.min(b.floors.length, Math.floor(floor) || 1));
  return b.floors.find((x) => x.floor === f) ?? b.floors[0];
}

/** The golden pins for a floor, or null when the set has no floor plan
    (caller falls back to ROAM_SPOTS). */
export function floorSpots(set: LifeSet, buildingId: string | null | undefined, floor: number): FloorSpot[] | null {
  return floorDef(set, buildingId, floor)?.spots ?? null;
}

/** The NEW talks for a floor. Floor 1 additionally shows the existing
    VENUE_TALK[set] entries (merged by App) — those are not duplicated here. */
export function floorTalks(set: LifeSet, buildingId: string | null | undefined, floor: number): FloorTalk[] {
  return floorDef(set, buildingId, floor)?.talks ?? [];
}
