// Round-2 content-mismatch fixes (area b) — table-driven venue + animation data.
// Audit: ~/workspace/goals/shenhui-life-sim-launch/files/content-mismatch-audit-2026-11-11.md
// (55 of 116 places had at least one mismatch; the systemic cause was one
// coarse `type` driving the walk-in interior, the venue actions AND the
// cutscene animation, with name-regex fallbacks papering over the gaps.)
//
// How this file is used (integration agent — see ROUND2-LOG-b.md snippets):
//   1. ANIM_BY_PLACE / animFor() replace App.tsx:2866-2876 `special`.
//   2. venueSetFor() replaces App.tsx:130-141 venueFor() (per-place venueSet
//      first, then the old type/regex fallbacks for places without one).
//   3. VENUE_SET_COPY extends App.tsx:115 VENUE_SETS with the new interiors.
//   4. VENUE_TALK extends App.tsx:47 VENUE_TALK with the new interiors'
//      walk-in dialogue (ids must match the ROAM_SPOTS ids area (g) adds).
//   5. MARKET_ACTIONS documents the per-subtype action sets for
//      App.tsx:3804 venueActions() (snippet S5 in the log).
//
// NEW names (not yet in LifeStage / App — area (g) must build them):
//   venue sets: disney, tram, temple, oldtown, miniature, farm, wetland,
//     watershow, gallery, boardwalk, cycle, museum, library, factory,
//     oilpainting, secondhand, seafood, womensstreet
//   anim kinds: tram, temple, oldtown, miniature, nature, farm, wetland,
//     watershow, cycle, gallery
// Existing names reused as-is: coaster, safari, aquarium, cablecar, cruise,
// beach, park, hike, market, electronics, wheel, turtle, stroll.

import type { AnimKindId, VenueSetId } from "../data";

/** Cutscene animation per place id (audit table 4 — all 21 fall-throughs,
    plus the places the old `special` mapping already got right, so this
    table is the single source of truth). Keyed by place id, never by name. */
export const ANIM_BY_PLACE: Record<string, AnimKindId> = {
  // audit table 4 — used to fall back to "stroll"
  disney: "wheel",
  oceanpark: "aquarium",
  tramroad: "tram",
  ngongping: "cablecar",
  peak: "cablecar",
  wongtaisin: "temple",
  taio: "cruise",
  saikung: "cruise",
  dapengfort: "oldtown",
  zhongyingjie: "oldtown",
  stanley: "beach",
  window: "miniature",
  jinxiu: "miniature",
  qingqing: "nature",
  gmfarm: "farm",
  seagarden: "wetland",
  octharbour: "watershow",
  missionhills: "cycle",
  swcac: "gallery",
  xihu: "cruise",
  tseungkwano: "cycle",
  // already correct under the old mapping — pinned here so nothing regresses
  happyvalley: "coaster",
  safari: "safari",
  octeast: "cablecar",
  hejiang: "cruise",
  sanjiaozhou: "cruise",
  haiguiwan: "turtle",
  dayawan: "beach",
  tuenmun: "beach",
  yangmeikeng: "beach",
  tanyue: "beach",
  luofu: "hike",
  gaobangshan: "hike",
  dameisha: "beach",
  xichong: "beach",
  fun: "beach", // Huizhou 双月湾海边
  // per-place pins for the retyped / split places
  nantou: "oldtown",
  danshui: "oldtown",
  yuenlong: "oldtown",
  xiayong: "cruise",
  xunliao: "cruise", // Round-3: 巽寮湾渔港 — 跟船出海（data.ts animKind 同值，双保险）
  szmuseum: "gallery",
  hzmuseum: "gallery",
  yantian: "stroll",
  tst: "stroll",
};

/** Table-driven replacement for App.tsx's `special` mapping. Only the
    fun/stroll/checkin actions get a signature animation; everything else
    returns undefined and the caller falls back to animMap[kind]. The
    place's own `animKind` field wins over this table; the table wins over
    the legacy type/name fallbacks below it. */
export function animFor(
  loc: { id: string; type: string; name: string; animKind?: AnimKindId; placeKind?: string },
  kind: string,
): AnimKindId | undefined {
  if (kind !== "fun" && kind !== "stroll" && kind !== "checkin") return undefined;
  if (loc.animKind) return loc.animKind;
  const byId = ANIM_BY_PLACE[loc.id];
  if (byId) return byId;
  // legacy fallbacks, kept only for OSM places (pl:…) and stations, which
  // have no animKind field: mountains hike, beaches play the beach scene.
  if (loc.type === "mountain" || loc.placeKind === "peak") return "hike";
  if (loc.placeKind === "beach" || /海滩|沙滩|海边|海滨|杨梅坑|黄金海岸|檀悦/.test(loc.name)) return "beach";
  return undefined;
}

/** Walk-in interior copy for every venue set (audit tables 1–3). The
    entries marked NEW need a LifeSet + 3D scene in LifeStage (area g);
    the rest already exist there. `set` is the LifeSet name area (g) must
    register — for new sets it is the same string as the venueSet id. */
export const VENUE_SET_COPY: Record<string, { set: string; zh: string; en: string }> = {
  // reused LifeSets (already built in LifeStage) — walk-in copy for them
  coaster: { set: "coaster", zh: "游乐场：过山车、排队人群，尖叫声隔着一条街都听得见", en: "The theme park: coasters, queues, screams you can hear a street away" },
  safari: { set: "safari", zh: "动物园：笼舍、猛兽、投喂车，游客都举着手机", en: "The zoo: enclosures, big cats, the feeding truck, everyone filming" },
  aquarium: { set: "aquarium", zh: "海洋馆：水族馆、熊猫馆，缆车悬在海面上", en: "The aquarium: tanks, the panda house, the cable car over the sea" },
  cablecar: { set: "cablecar", zh: "缆车站：车厢慢慢爬升，城市在身后一格格升起", en: "The cable car: the cabin climbs slowly, the city rising behind you" },
  cruise: { set: "cruise", zh: "游船：江船、灯光，船行江心两岸慢慢过", en: "The cruise boat: river, lights, both banks drifting past" },
  beach: { set: "beach", zh: "走到沙滩上：浪、伞、光脚。", en: "Onto the sand: waves, umbrellas, bare feet." },
  park: { set: "park", zh: "走进园子：树、长椅、风。", en: "Into the park: trees, a bench, the wind." },
  hike: { set: "hike", zh: "上山的路：石阶、树荫，走到能看见城的地方。", en: "The path up: stone steps and shade, until you can see the city." },
  // NEW — market subtypes (audit table 1)
  oilpainting: { set: "oilpainting", zh: "满墙油画：画架、颜料、正在作画的画家，隔壁就是装裱店", en: "Walls of oil paintings: easels, paint, a painter at work, a framing shop next door" },
  secondhand: { set: "secondhand", zh: "二手市集：旧手机、旧家具、黑胶唱片，地摊一排排", en: "The second-hand market: used phones, old furniture, vinyl, stall after stall" },
  seafood: { set: "seafood", zh: "海鲜街：水箱里的活鱼活虾，现捞现称，隔壁大排档代加工", en: "The seafood street: live fish and prawns in tanks, weighed on the spot, cooked next door" },
  oldtown: { set: "oldtown", zh: "老街：骑楼、老字号小吃、界碑和旧招牌", en: "The old street: arcades, old shops, snacks, boundary stones and faded signs" },
  womensstreet: { set: "womensstreet", zh: "女人街：服装鞋袜档、金鱼档、花档，平价小商品一眼望不到头", en: "The Ladies' Market: clothes, goldfish, flowers, cheap goods as far as you can see" },
  // NEW — retyped places (audit table 2)
  museum: { set: "museum", zh: "展厅：展柜、灯光、讲解员在讲这座城的故事", en: "The gallery halls: display cases, spotlights, a guide telling the city's story" },
  library: { set: "library", zh: "书架、阅览桌、自修室，翻书声比说话声大", en: "Shelves, reading tables, a study hall — pages turning louder than voices" },
  factory: { set: "factory", zh: "厂区：厂房、产线、宿舍和食堂，三班倒的灯火", en: "The plant: workshops, lines, dorms and the canteen, lit for three shifts" },
  // NEW — fun/scenic interiors (audit table 3)
  disney: { set: "disney", zh: "城堡、游乐设施、花车，烟花晚上才放", en: "The castle, the rides, the parade floats — fireworks after dark" },
  tram: { set: "tram", zh: "叮叮电车：轨道、木座椅、上层最前排的风景", en: "The tram: tracks, wooden seats, the view from the front of the upper deck" },
  temple: { set: "temple", zh: "香炉、求签处、红烛，香火味里很安静", en: "Incense burners, fortune sticks, red candles — quiet under the smoke" },
  miniature: { set: "miniature", zh: "微缩景观：埃菲尔铁塔、金字塔、长城，一天环游世界", en: "Miniature landmarks: the Eiffel Tower, the pyramids, the Great Wall — the world in a day" },
  farm: { set: "farm", zh: "农场：奶牛、玉米地、挤奶棚，空气里是草香", en: "The farm: cows, cornfields, the milking shed, the smell of grass" },
  wetland: { set: "wetland", zh: "湿地农田：鱼塘、红树林、滩涂上的白鹭", en: "Wetland fields: fish ponds, mangroves, egrets on the mudflats" },
  watershow: { set: "watershow", zh: "滨海商业街：喷泉水秀、椰林、夜里最热闹", en: "The waterfront strip: fountains, palms, busiest after dark" },
  gallery: { set: "gallery", zh: "艺术中心：展厅、落地窗，海就在窗外", en: "The art centre: galleries and floor-to-ceiling windows, the sea outside" },
  boardwalk: { set: "boardwalk", zh: "海滨栈道：木栈道、栏杆，看海不用下水", en: "The seaside boardwalk: timber decking, railings, the sea without getting wet" },
  cycle: { set: "cycle", zh: "绿道骑行：租车点、单车径，风追着你跑", en: "The cycle greenway: bike hire, the cycle path, the wind at your back" },
  fishingport: { set: "fishingport", zh: "渔港码头：渔船、渔网、刚上岸的海鲜，鱼贩在码头边叫卖", en: "The fishing port: boats, nets, the fresh catch, fish sellers calling out on the pier" },
  nature: { set: "nature", zh: "雨林：热带植物、吊桥，蝴蝶落在肩膀上", en: "The rainforest: tropical plants, a rope bridge, butterflies on your shoulder" },
};

/** Table-driven replacement for App.tsx's venueFor(). Per-place venueSet
    wins; then the type mapping (the old VENUE_SETS entries, now also
    covering museum/library/factory + the market subtypes); then the old
    scenic/fun beach-vs-park regex for places without a venueSet. */
export function venueSetFor(loc: {
  type: string; id: string; name: string; venueSet?: VenueSetId;
}): { set: string; zh: string; en: string } | null {
  if (loc.venueSet) {
    const copy = VENUE_SET_COPY[loc.venueSet];
    if (copy) return copy;
    return null;
  }
  const byType: Record<string, { set: string; zh: string; en: string }> = {
    food: { set: "restaurant", zh: "推门进去：烧腊、猪脚饭、街坊在聊天", en: "Push the door: roast meats, trotter rice, regulars chatting" },
    mall: { set: "mall", zh: "逛一圈：橱窗、新品、冷气很足", en: "Have a wander: shop windows, new arrivals, strong air-con" },
    market: { set: "market", zh: "菜市场里转转：鱼档、菜档、讨价还价", en: "Walk the wet market: fish stalls, greens, haggling" },
    electronics: { set: "electronics", zh: "一米柜台：手机、平板、配件，当场验机再付钱", en: "One-metre counters: phones, tablets and parts — check it before you pay" },
    oilpainting: { set: "oilpainting", zh: "满墙油画：画架、颜料、正在作画的画家，隔壁就是装裱店", en: "Walls of oil paintings: easels, paint, a painter at work, a framing shop next door" },
    secondhand: { set: "secondhand", zh: "二手市集：旧手机、旧家具、黑胶唱片，地摊一排排", en: "The second-hand market: used phones, old furniture, vinyl, stall after stall" },
    seafood: { set: "seafood", zh: "海鲜街：水箱里的活鱼活虾，现捞现称，隔壁大排档代加工", en: "The seafood street: live fish and prawns in tanks, weighed on the spot, cooked next door" },
    oldtown: { set: "oldtown", zh: "老街：骑楼、老字号小吃、界碑和旧招牌", en: "The old street: arcades, old shops, snacks, boundary stones and faded signs" },
    womensstreet: { set: "womensstreet", zh: "女人街：服装鞋袜档、金鱼档、花档，平价小商品一眼望不到头", en: "The Ladies' Market: clothes, goldfish, flowers, cheap goods as far as you can see" },
    museum: { set: "museum", zh: "展厅：展柜、灯光、讲解员在讲这座城的故事", en: "The gallery halls: display cases, spotlights, a guide telling the city's story" },
    library: { set: "library", zh: "书架、阅览桌、自修室，翻书声比说话声大", en: "Shelves, reading tables, a study hall — pages turning louder than voices" },
    factory: { set: "factory", zh: "厂区：厂房、产线、宿舍和食堂，三班倒的灯火", en: "The plant: workshops, lines, dorms and the canteen, lit for three shifts" },
    work: { set: "office", zh: "看看工位：屏幕、咖啡、同事在敲代码", en: "See the office floor: screens, coffee, colleagues typing" },
    apec: { set: "office", zh: "会场里面：长桌、名牌、同传耳机", en: "Inside the venue: long tables, name cards, interpretation headsets" },
    bank: { set: "office", zh: "柜台和排队机", en: "The counters and the queue machine" },
    gym: { set: "gym", zh: "跑步机、哑铃、镜子前自拍的人", en: "Treadmills, dumbbells, mirror selfies" },
    social: { set: "club", zh: "灯光、乐队、人群跟着节拍跳", en: "Lights, a band, a crowd bouncing to the beat" },
    health: { set: "clinic", zh: "候诊区、叫号屏、白大褂", en: "The waiting area, the queue screen, white coats" },
    learn: { set: "classroom", zh: "黑板、课桌、下班后来上夜校的人", en: "Blackboard, desks, people at night school after work" },
    lodging: { set: "bedroom", zh: "前台拿房卡，上楼看看房间", en: "Key card from the desk, a look at the room" },
    service: { set: "office", zh: "办事大厅：取号、填表、等叫号", en: "The service hall: take a number, fill a form, wait" },
  };
  const fixed = byType[loc.type];
  if (fixed) return fixed;
  if (loc.type === "transit" || loc.type === "port")
    return { set: "concourse", zh: "进站厅：闸机、安检、便利店。洗手间在里头。", en: "The concourse: gates, security, a shop. The restroom is inside." };
  if (loc.type === "mountain")
    return { set: "hike", zh: "上山的路：石阶、树荫，走到能看见城的地方。", en: "The path up: stone steps and shade, until you can see the city." };
  if (loc.type === "scenic" || loc.type === "fun") {
    const beach = /沙|滩|海滨|beach|海龟|dameisha|xichong|xunliao|巽寮/i.test(`${loc.id}${loc.name}`);
    return beach
      ? { set: "beach", zh: "走到沙滩上：浪、伞、光脚。", en: "Onto the sand: waves, umbrellas, bare feet." }
      : { set: "park", zh: "走进园子：树、长椅、风。", en: "Into the park: trees, a bench, the wind." };
  }
  return null;
}

/** Walk-in dialogue for the NEW venue sets (audit tables 1–3). Shape is
    identical to App.tsx's VenueTalk; `id` must match the ROAM_SPOTS id
    area (g) adds for the set, so the joystick can reach it. The market
    set's 菜档阿姨/鱼档老板 lines stay where they are in App.tsx — after
    the split they only ever fire at the one true wet market (春秧街）,
    which is the fix for App.tsx:60-61. */
export interface VenueTalkEntry {
  id: string; emoji: string; zh: string; en: string;
  who: string; whoEn: string; say: string; sayEn: string;
  pose: "walk" | "idle" | "sit" | "drive" | "type" | "cook" | "eat" | "sleep" | "wash" | "lift" | "stretch" | "talk" | "dance" | "sing";
  partner?: [number, number]; money?: number; mood?: number; energy?: number; network?: number; xp?: number;
}
export const VENUE_TALK: Record<string, VenueTalkEntry[]> = {
  oilpainting: [
    { id: "paint", emoji: "🖼️", zh: "买一幅画装点出租屋", en: "Buy a painting for your flat", who: "画廊老板", whoEn: "The gallery owner", say: "「这幅是村里老师傅临的莫奈，挂出租屋里，回家心情都不一样。」", sayEn: "“This one's a Monet copy by one of our masters — hang it at home and the whole flat feels different.”", pose: "talk", partner: [0xf472b6, 0x1f2937], money: -120, mood: 14 },
    { id: "copy", emoji: "🎨", zh: "看画家临摹", en: "Watch a painter copy a classic", who: "画工", whoEn: "The painter", say: "「一天能临三幅，手稳了才能接大单。你要不要试试？」", sayEn: "“Three copies a day, when your hand is steady. Fancy a try?”", pose: "talk", partner: [0x0ea5e9, 0x374151], mood: 6, xp: 1 },
    { id: "frame", emoji: "🖼️", zh: "问装裱店怎么收费", en: "Ask the framer about prices", who: "装裱师傅", whoEn: "The framer", say: "「实木框加防潮背板，一幅画能挂二十年。」", sayEn: "“Solid wood frame, moisture-proof backing — it'll hang for twenty years.”", pose: "talk", partner: [0x92400e, 0x1f2937], mood: 3, network: 1 },
  ],
  secondhand: [
    { id: "dig", emoji: "📻", zh: "淘一件旧货", en: "Dig out a second-hand treasure", who: "摊主", whoEn: "The stallholder", say: "「这台随身听还能响，磁带我送你两盘，回去慢慢听。」", sayEn: "“This Walkman still plays — I'll throw in two tapes.”", pose: "talk", partner: [0x06b6d4, 0x1f2937], money: -60, mood: 8 },
    { id: "haggle", emoji: "🤝", zh: "跟摊主讲讲价", en: "Haggle with the stallholder", who: "摊主", whoEn: "The stallholder", say: "「你也是行家啊——行，这个价拿走，下次有好货我留给你。」", sayEn: "“You know your stuff — fine, take it at that price. I'll keep the good stuff for you next time.”", pose: "talk", partner: [0x06b6d4, 0x374151], money: -30, mood: 6 },
  ],
  seafood: [
    { id: "pick", emoji: "🦞", zh: "挑一只活海鲜", en: "Pick a live one", who: "海鲜档老板", whoEn: "The fishmonger", say: "「这只膏蟹满黄，隔壁大排档代加工，清蒸最鲜。」", sayEn: "“This crab is full of roe — the place next door will steam it for you.”", pose: "talk", partner: [0x0891b2, 0x1f2937], money: -80, mood: 8, energy: 6 },
    { id: "boat", emoji: "⛵", zh: "问渔民几点出海", en: "Ask a fisherman when they sail", who: "渔民阿海", whoEn: "Ah Hoi the fisherman", say: "「天不亮就出海，回来鱼还是活的——你要跟船，明早四点码头见。」", sayEn: "“We sail before dawn and the catch comes back alive. Come along — pier, 4 a.m.”", pose: "talk", partner: [0x0369a1, 0x1f2937], mood: 5, network: 1 },
  ],
  oldtown: [
    { id: "snack", emoji: "🥮", zh: "尝一块老字号点心", en: "Taste an old-shop pastry", who: "饼铺老板", whoEn: "The bakery owner", say: "「老婆饼现烤的，皮掉了三层才算数。」", sayEn: "“Wife cakes, fresh from the oven — three flaky layers or it doesn't count.”", pose: "eat", partner: [0xf59e0b, 0x1f2937], money: -15, mood: 6, energy: 6 },
    { id: "stroll", emoji: "🚶", zh: "沿着骑楼慢慢走", en: "Stroll under the arcades", who: "自己", whoEn: "You", say: "「这条街比这座城的大多数楼都老。」", sayEn: "“This street is older than most of the city's buildings.”", pose: "idle", mood: 8 },
  ],
  womensstreet: [
    { id: "clothes", emoji: "👗", zh: "淘一件平价衣服", en: "Pick up something cheap to wear", who: "档口老板娘", whoEn: "The stall owner", say: "「这件今年最火的款，穿上身再讲价。」", sayEn: "“This is this year's bestseller — try it on, then we talk price.”", pose: "talk", partner: [0xe879f9, 0x1f2937], money: -50, mood: 8 },
    { id: "goldfish", emoji: "🐠", zh: "看金鱼档", en: "Look at the goldfish stall", who: "金鱼档老板", whoEn: "The goldfish seller", say: "「红白狮头最精神，养一缸，家里热闹。」", sayEn: "“The red-and-white lionheads are the liveliest — a tank of them and the flat feels alive.”", pose: "talk", partner: [0x0ea5e9, 0x374151], mood: 5 },
  ],
  museum: [
    { id: "tour", emoji: "🏛️", zh: "听讲解员讲一段历史", en: "Hear the guide tell a story", who: "讲解员", whoEn: "The guide", say: "「这件展品背后，就是这座城从小渔村长出来的四十年。」", sayEn: "“Behind this exhibit is forty years of a fishing village growing into a city.”", pose: "talk", partner: [0x92400e, 0x374151], mood: 6, xp: 1 },
    { id: "look", emoji: "👀", zh: "在展柜前站一会儿", en: "Stand a while at a case", who: "自己", whoEn: "You", say: "「原来是这样。」", sayEn: "“So that's how it was.”", pose: "idle", mood: 6 },
  ],
  library: [
    { id: "read", emoji: "📖", zh: "借一本书坐下来读", en: "Borrow a book and read", who: "自己", whoEn: "You", say: "「这一章读完再走。」", sayEn: "“I'll finish this chapter before I go.”", pose: "sit", mood: 6, xp: 1 },
    { id: "ask", emoji: "🧑‍🏫", zh: "问馆员怎么查资料", en: "Ask the librarian how to find things", who: "馆员", whoEn: "The librarian", say: "「地方志在三楼，考试资料在二楼，慢慢找。」", sayEn: "“Local history is on the third floor, exam books on the second. Take your time.”", pose: "talk", partner: [0x7c3aed, 0x374151], mood: 3, network: 1 },
  ],
  factory: [
    { id: "line", emoji: "🏭", zh: "看一条产线怎么跑", en: "Watch a production line run", who: "班组长", whoEn: "The team lead", say: "「这条线一个班出一千块电池板，停一分钟就是钱。」", sayEn: "“This line turns out a thousand battery panels a shift — a minute stopped is money.”", pose: "talk", partner: [0x64748b, 0x1f2937], mood: 3, xp: 1 },
    { id: "canteen", emoji: "🍱", zh: "在食堂吃一顿", en: "Eat in the canteen", who: "自己", whoEn: "You", say: "「大锅饭，管饱。」", sayEn: "“Canteen food. Filling.”", pose: "eat", money: -12, mood: 4, energy: 10 },
  ],
  disney: [
    { id: "castle", emoji: "🏰", zh: "在城堡前拍一张", en: "Take a photo at the castle", who: "自己", whoEn: "You", say: "「这张能发。」", sayEn: "“This one's worth posting.”", pose: "idle", mood: 10 },
    { id: "ride", emoji: "🎢", zh: "排队坐一次过山车", en: "Queue for the coaster", who: "自己", whoEn: "You", say: "「下来腿软，心还在飞。」", sayEn: "“Legs like jelly. Heart still flying.”", pose: "idle", mood: 12, energy: -4 },
  ],
  tram: [
    { id: "ride", emoji: "🚃", zh: "坐上层最前排", en: "Take the front seat upstairs", who: "自己", whoEn: "You", say: "「三块钱，整座城慢慢过。」", sayEn: "“Three dollars, and the whole city goes by slowly.”", pose: "sit", mood: 8 },
  ],
  temple: [
    { id: "fortune", emoji: "🏮", zh: "摇一支签", en: "Draw a fortune stick", who: "解签师傅", whoEn: "The fortune reader", say: "「中上签。心诚，路就顺。」", sayEn: "“A good draw. A sincere heart, a smooth road.”", pose: "talk", partner: [0xdc2626, 0x1f2937], mood: 8 },
  ],
  miniature: [
    { id: "photo", emoji: "📸", zh: "在微缩铁塔下拍一张", en: "Photo under the miniature tower", who: "自己", whoEn: "You", say: "「上午巴黎，下午开罗。」", sayEn: "“Paris in the morning, Cairo in the afternoon.”", pose: "idle", mood: 8 },
  ],
  farm: [
    { id: "milk", emoji: "🐄", zh: "亲手挤一回牛奶", en: "Try milking a cow", who: "农场工人", whoEn: "The farmhand", say: "「轻点，顺着来——第一次都这样。」", sayEn: "“Gently, like this — everyone's first time is like that.”", pose: "talk", partner: [0x84cc16, 0x1f2937], mood: 8, xp: 1 },
  ],
  wetland: [
    { id: "crab", emoji: "🦀", zh: "下滩涂摸一只蟹", en: "Catch a crab on the mudflat", who: "自己", whoEn: "You", say: "「它比我跑得快。」", sayEn: "“It's faster than I am.”", pose: "idle", mood: 8 },
  ],
  watershow: [
    { id: "show", emoji: "⛲", zh: "看一场水秀", en: "Watch the water show", who: "自己", whoEn: "You", say: "「灯光在湖面上开花。」", sayEn: "“The lights bloom on the lake.”", pose: "idle", mood: 10 },
  ],
  gallery: [
    { id: "look", emoji: "🎭", zh: "在落地窗前看海", en: "Look at the sea through the glass", who: "自己", whoEn: "You", say: "「展厅外面就是海。」", sayEn: "“The sea is right outside the gallery.”", pose: "idle", mood: 8 },
  ],
  boardwalk: [
    { id: "walk", emoji: "🚶", zh: "沿着栈道走到灯塔", en: "Walk the boardwalk to the lighthouse", who: "自己", whoEn: "You", say: "「海风追着你跑。」", sayEn: "“The sea wind chases you.”", pose: "idle", mood: 8 },
  ],
  cycle: [
    { id: "ride", emoji: "🚲", zh: "租辆车骑一段绿道", en: "Hire a bike for the greenway", who: "租车点老板", whoEn: "The bike-hire owner", say: "「这段路最平，骑到桥底再回来。」", sayEn: "“This stretch is the flattest — ride to the bridge and back.”", pose: "talk", partner: [0x84cc16, 0x1f2937], money: -20, mood: 8, energy: -4 },
  ],
  nature: [
    { id: "butterfly", emoji: "🦋", zh: "在蝴蝶谷站一会儿", en: "Stand a while in Butterfly Valley", who: "自己", whoEn: "You", say: "「蝴蝶落在肩膀上了。」", sayEn: "“A butterfly just landed on my shoulder.”", pose: "idle", mood: 10 },
  ],
};

/** Per-subtype venue actions (audit tables 1, 2, 5) — a spec for the
    venueActions() snippet (S5 in ROUND2-LOG-b.md). All `kind` values are
    existing doAction kinds, so no new handlers are needed:
    - buy-groceries: wet market only (春秧街）; food streets must NOT offer it.
    - market-phone: electronics + secondhand (淘二手手机/好物）.
    - market-fix: electronics + secondhand (装机/维修兼职）.
    - gig: every subtype, via the place's own gigName (大芬：临摹/装裱；
      华强北：装机/验机；桥东：旧货整理/修小电器；霞涌：海鲜街帮工；
      淡水/元朗/南头：老城摆摊/帮工）.
    - eat (FOODS[city] entries): seafood / oldtown / womensstreet / food
      streets — eat snacks, don't buy raw groceries.
    - fun/checkin/rest: museum/library (看展/借书/自修）, factory (same
      actions as the "work" case — they are company sites), all fun/scenic.
    - mall-shop (reused as "buy something"): oilpainting 买画, electronics
      买配件, secondhand 淘旧家具/黑胶. */
export const MARKET_ACTION_SPEC = {
  market: ["buy-groceries", "gig", "rest"],
  electronics: ["market-phone", "market-fix", "mall-shop:买配件", "gig", "rest"],
  oilpainting: ["mall-shop:买幅画装点出租屋", "gig", "fun:看画展", "rest"],
  secondhand: ["market-phone:淘二手好物", "market-fix", "mall-shop:淘旧家具/黑胶", "gig", "rest"],
  seafood: ["eat:海鲜大排档", "gig", "fun", "rest"],
  oldtown: ["eat:老街小吃", "gig", "fun", "checkin", "rest"],
  womensstreet: ["eat:街边小吃", "mall-shop:淘衣服鞋袜", "gig", "rest"],
  museum: ["fun:看展", "checkin", "rest"],
  library: ["learn-self:自修", "fun:借本书", "rest"],
  factory: ["work:正经上班", "overtime:拼命加班"],
} as const;
