/* ---- 独立玩法：50+ 个活动 ----
   Each activity lives at real kinds of places (sea, lake, mountain, bar
   street, mall…), may only run at certain hours, plays one mini-game
   (MiniGame.tsx) and turns the score into mood / money / skill / drops,
   with risks (police, injury, hangover, scams) for the edgy ones.
   Text is bilingual: [中文, English]. */
import type { Loc } from "./data";
import type { GameSpec } from "./MiniGame";

export type L2 = [string, string];
export type ActCat = "outdoor" | "night" | "date" | "drive" | "hustle" | "risky" | "chill";
export const CAT_LABEL: Record<ActCat, L2> = {
  outdoor: ["🌿 户外运动", "🌿 Outdoors"], night: ["🌃 夜生活", "🌃 Nightlife"], date: ["💕 约会", "💕 Dates"],
  drive: ["🚗 开车", "🚗 Driving"], hustle: ["💰 搞钱", "💰 Side hustles"], risky: ["⚠️ 灰色地带", "⚠️ Grey zone"], chill: ["☕ 休闲", "☕ Chill"],
};

export type RiskKind = "police" | "injury" | "hangover" | "scam";
export interface Risk { kind: RiskKind; p: number; fine?: number; text: L2 }
export interface Activity {
  id: string; emoji: string; cat: ActCat; name: L2; desc: L2;
  at: (l: Loc) => boolean;
  /** Allowed start window, minutes since midnight. */
  hours?: [number, number];
  min: number; cost: number; energy: number;
  needs?: "license" | "car" | "date" | "notLicensed";
  game: GameSpec;
  /** Effects at a perfect score (scaled by score; mood can go negative on a flop). */
  mood: number; money?: number; xp?: number; skill?: number; fit?: number; network?: number;
  drop?: string; romance?: number;
  risk?: Risk;
  lines: { great: L2; ok: L2; bad: L2 };
}

/* ---------- where things can happen ---------- */
const N = (l: Loc) => l.name;
const isBeach = (l: Loc) => l.placeKind === "beach" || /海滩|沙滩|海边|海滨|双月湾|巽寮|黄金海岸|西涌|杨梅坑|大梅沙|小梅沙|较场尾|三角洲|海龟/.test(N(l));
const isSea = (l: Loc) => isBeach(l) || /渔港|海鲜街|码头|港湾|湾公园|栈道|海上|海岸/.test(N(l));
const isLake = (l: Loc) => /湖|水库|东江|河|江公园|植物园/.test(N(l)) && l.type !== "work" && l.type !== "mall";
const isMountain = (l: Loc) => l.type === "mountain" || l.placeKind === "peak" || (l.placeKind === "nature" && /山/.test(N(l))) || /^(罗浮山|梧桐山|七娘山|南昆山|象头山|高榜山)/.test(N(l));
const isGreen = (l: Loc) => l.placeKind === "park" || l.placeKind === "nature" || /公园|绿道|植物园|骑行/.test(N(l));
const isNight = (l: Loc) => l.type === "social";
const isEat = (l: Loc) => l.type === "food" || /夜市|海鲜街|食街/.test(N(l));
const isMall = (l: Loc) => l.type === "mall" || l.placeKind === "mall";
const isMarket = (l: Loc) => l.type === "market";
const isStage = (l: Loc) => l.placeKind === "theatre" || /文化艺术中心|剧院|音乐厅|大剧院/.test(N(l));
const isSport = (l: Loc) => l.type === "gym" || l.placeKind === "stadium";
const isMuseum = (l: Loc) => l.placeKind === "museum" || /博物馆|美术馆|展览/.test(N(l));
const isFun = (l: Loc) => l.placeKind === "themepark" || /欢乐谷|世界之窗|欢乐海岸|华侨城|锦绣中华|欢乐港湾/.test(N(l));
const isTransit = (l: Loc) => l.type === "transit" || l.type === "port";
const isHome = (l: Loc) => l.type === "home";
const isScenic = (l: Loc) => l.type === "scenic" || l.type === "fun" || l.placeKind === "attraction" || l.placeKind === "historic";
const isTemple = (l: Loc) => /寺|庙|弘法|元妙观|祠/.test(N(l)) || l.id === "xianhuhu";
const isSpa = (l: Loc) => /温泉|度假酒店|豪生/.test(N(l));
const isMatchmaking = (l: Loc) => l.id === "lianhua" || /相亲/.test(N(l));
const NIGHT: [number, number] = [19 * 60, 24 * 60];
const DAY: [number, number] = [6 * 60, 19 * 60];

/* ---------- reusable game specs ---------- */
const reel = (pull: number, zh: string, en: string): GameSpec => ({ type: "reel", seconds: 22, pull, prompt: [zh, en] });
const timing = (rounds: number, width: number, speed: number, zh: string, en: string): GameSpec => ({ type: "timing", rounds, width, speed, prompt: [zh, en] });
const rhythm = (notes: number, speed: number, zh: string, en: string): GameSpec => ({ type: "rhythm", notes, speed, prompt: [zh, en] });
const mash = (seconds: number, target: number, zh: string, en: string): GameSpec => ({ type: "mash", seconds, target, prompt: [zh, en] });
const meter = (gains: number[], risk: number, riskStep: number, push: L2, stop: L2, unit: L2, zh: string, en: string): GameSpec => ({ type: "meter", gains, risk, riskStep, push, stop, unit, prompt: [zh, en] });
type Q = { q: L2; opts: { t: L2; pts: number; say?: L2 }[] };
const quiz = (zh: string, en: string, questions: Q[]): GameSpec => ({ type: "quiz", questions, prompt: [zh, en] });
const o = (zh: string, en: string, pts: number, say?: L2) => ({ t: [zh, en] as L2, pts, ...(say ? { say } : {}) });

/* Date talk — shared pool, three questions drawn per date. */
export const DATE_QUESTIONS: Q[] = [
  { q: ["「你周末一般都干嘛？」", "\"What do you usually do at weekends?\""], opts: [o("去海边走走，或者找家没去过的小店", "Walk by the sea, or find a little place I've never tried", 2), o("睡觉，然后继续睡", "Sleep. Then more sleep.", 1), o("加班，周末才清净", "Work — weekends are the quietest time to get things done", 0)] },
  { q: ["「你觉得深圳最好的地方是什么？」", "\"What's the best thing about Shenzhen?\""], opts: [o("来了就是深圳人，没人问你从哪来", "Once you're here, you're a local — nobody asks where you're from", 2), o("工资高", "The pay", 1), o("没什么好的，就是来挣钱的", "Nothing really. I'm just here for the money.", 0)] },
  { q: ["服务员上错了菜，你会？", "The waiter brings the wrong dish. You…"], opts: [o("笑着说没关系，这道看着也挺好吃", "Smile and say it's fine — this one looks good too", 2), o("礼貌地请他换一下", "Politely ask them to swap it", 1), o("当场黑脸要求免单", "Scowl and demand it's on the house", 0)] },
  { q: ["「你以后想一直留在这座城市吗？」", "\"Do you want to stay in this city for good?\""], opts: [o("想。想在这儿有个自己的家", "Yes. I want a home of my own here", 2), o("走一步看一步吧", "We'll see how it goes", 1), o("攒够钱就走，一天都不多待", "The moment I've saved enough, I'm gone", 0)] },
  { q: ["对方说起工作上的烦心事，你会？", "They start talking about trouble at work. You…"], opts: [o("认真听完，再问一句「那你自己怎么想？」", "Listen properly, then ask \"What do you think you'll do?\"", 2), o("马上给出三条解决方案", "Immediately offer three solutions", 1), o("「我比你惨多了」，开始讲自己", "\"That's nothing, listen to MY week…\"", 0)] },
  { q: ["散场时下起了雨，只有你带了伞。", "It starts raining as you leave. Only you have an umbrella."], opts: [o("伞往对方那边歪，自己淋湿半边", "Tilt it their way and get half soaked yourself", 2), o("一起挤挤，走快点", "Squeeze in together and walk fast", 1), o("「我先走了，你打个车吧」", "\"I'll head off — you grab a taxi\"", 0)] },
  { q: ["「你最近一次特别开心是什么时候？」", "\"When were you last really happy?\""], opts: [o("就是现在吧", "Right now, honestly", 2, ["😳 对方愣了一下，然后笑了。", "😳 They pause — then smile."]), o("上次发工资的时候", "Last payday", 1), o("想不起来了", "Can't remember", 0)] },
  { q: ["买单的时候，你会？", "When the bill comes, you…"], opts: [o("提前悄悄去结了", "Quietly settle it beforehand", 2), o("提议 AA", "Suggest splitting it", 1), o("假装没看见账单", "Pretend not to see it", 0)] },
];

/* ---------- drops (collections are kept across runs) ---------- */
export interface Drop { id: string; emoji: string; name: L2; rarity: 1 | 2 | 3; value?: number; food?: boolean }
export interface DropSet { id: string; name: L2; items: Drop[] }
const d = (id: string, emoji: string, zh: string, en: string, rarity: 1 | 2 | 3, value = 0, food = false): Drop => ({ id, emoji, name: [zh, en], rarity, value, food });
export const DROP_SETS: DropSet[] = [
  { id: "fish_sea", name: ["🐟 海鱼图鉴", "🐟 Sea fish"], items: [
    d("bream", "🐟", "黄鳍鲷", "Yellowfin seabream", 1, 40, true), d("seabass", "🐟", "海鲈鱼", "Sea bass", 1, 45, true), d("sardine", "🐟", "沙丁鱼", "Sardine", 1, 10, true),
    d("scad", "🐟", "巴浪鱼", "Round scad", 1, 12, true), d("pomfret", "🐟", "鲳鱼", "Pomfret", 2, 60, true), d("mackerel", "🐟", "马鲛鱼", "Spanish mackerel", 2, 70, true),
    d("squid", "🦑", "鱿鱼", "Squid", 2, 50, true), d("octopus", "🐙", "章鱼", "Octopus", 2, 60, true), d("crab", "🦀", "青蟹", "Mud crab", 2, 90, true),
    d("mantis", "🦐", "皮皮虾", "Mantis shrimp", 1, 35, true), d("grouper", "🐠", "石斑鱼", "Grouper", 3, 200, true), d("puffer", "🐡", "河豚（放生）", "Pufferfish (released)", 3),
    d("ray", "🐟", "鳐鱼（放生）", "Stingray (released)", 3), d("bottle", "🍾", "漂流瓶", "Message in a bottle", 3), d("boot", "🥾", "旧拖鞋", "Old flip-flop", 1),
  ] },
  { id: "fish_lake", name: ["🎣 淡水鱼图鉴", "🎣 Freshwater fish"], items: [
    d("tilapia", "🐟", "罗非鱼", "Tilapia", 1, 15, true), d("crucian", "🐟", "鲫鱼", "Crucian carp", 1, 15, true), d("grasscarp", "🐟", "草鱼", "Grass carp", 1, 25, true),
    d("carp", "🐟", "鲤鱼", "Common carp", 1, 20, true), d("bighead", "🐟", "大头鱼", "Bighead carp", 2, 40, true), d("yellowcat", "🐟", "黄骨鱼", "Yellow catfish", 2, 35, true),
    d("mandarin", "🐟", "鳜鱼", "Mandarin fish", 3, 120, true), d("crayfish", "🦞", "小龙虾", "Crayfish", 1, 10, true), d("turtle", "🐢", "巴西龟（放生）", "Slider turtle (released)", 2),
    d("koi", "🎏", "锦鲤（放生，好运 +1）", "Koi (released — good luck!)", 3), d("bike", "🚲", "生锈的共享单车", "A rusty share-bike", 1),
  ] },
  { id: "sea_life", name: ["🐠 浮潜见闻", "🐠 Snorkelling sightings"], items: [
    d("coral", "🪸", "鹿角珊瑚", "Staghorn coral", 1), d("clown", "🐠", "小丑鱼", "Clownfish", 2), d("urchin", "🦔", "海胆", "Sea urchin", 1), d("star", "⭐", "海星", "Starfish", 1),
    d("jelly", "🪼", "海月水母", "Moon jellyfish", 2), d("seaturtle", "🐢", "绿海龟", "Green sea turtle", 3), d("dolphin", "🐬", "中华白海豚", "Chinese white dolphin", 3), d("nudi", "🐌", "海兔", "Sea slug", 2),
  ] },
  { id: "plush", name: ["🧸 娃娃机战利品", "🧸 Claw-machine prizes"], items: [
    d("bear", "🧸", "小熊", "Teddy bear", 1), d("penguin", "🐧", "企鹅", "Penguin", 1), d("dino", "🦖", "小恐龙", "Little dino", 1), d("bunny", "🐰", "兔兔", "Bunny", 1),
    d("shark", "🦈", "鲨鱼抱枕", "Shark pillow", 2), d("lychee", "🍒", "荔枝精", "Lychee sprite", 2), d("dimsum", "🥟", "虾饺公仔", "Har-gow plush", 2), d("goldbear", "🌟", "限定金色小熊", "Limited gold bear", 3),
  ] },
  { id: "script", name: ["🕵️ 剧本杀通关", "🕵️ Murder-mystery scripts"], items: [
    d("s1", "🏮", "城中村凶宅", "The Urban-Village Murder", 1), d("s2", "🚇", "末班地铁", "The Last Train", 1), d("s3", "🏢", "38 楼的加班夜", "Overtime on the 38th Floor", 2),
    d("s4", "🌊", "巽寮湾失踪案", "Vanished at Xunliao Bay", 2), d("s5", "🎭", "粤剧团的秘密", "The Opera Troupe's Secret", 2), d("s6", "🐉", "龙舟赛前夜", "The Night Before the Dragon-Boat Race", 3),
  ] },
  { id: "film", name: ["🎬 看过的电影", "🎬 Films seen"], items: [
    d("f1", "🚀", "《湾区漂流记》", "Bay Area Drifters", 1), d("f2", "🦸", "《外卖侠》", "Delivery Hero", 1), d("f3", "💘", "《深南大道的雨》", "Rain on Shennan Road", 1),
    d("f4", "👻", "《握手楼》", "Handshake Buildings", 2), d("f5", "🐢", "《海龟回家》", "The Turtles Come Home", 2), d("f6", "🌃", "《凌晨三点的科技园》", "3 a.m. in the Science Park", 3),
  ] },
  { id: "fortune", name: ["🎋 祈福签文", "🎋 Fortune slips"], items: [
    d("k1", "🎋", "上上签 · 鹏程万里", "Best · A long way to soar", 3), d("k2", "🎋", "上签 · 柳暗花明", "Good · Light after the dark", 2), d("k3", "🎋", "上签 · 贵人相助", "Good · Help from a friend", 2),
    d("k4", "🎋", "中签 · 稳中求进", "Fair · Steady progress", 1), d("k5", "🎋", "中签 · 守得云开", "Fair · Wait for clear skies", 1), d("k6", "🎋", "中签 · 静待花开", "Fair · Let it bloom", 1), d("k7", "🎋", "下签 · 少喝奶茶", "Poor · Cut back on bubble tea", 1),
  ] },
  { id: "cat", name: ["🐱 撸过的猫", "🐱 Cats petted"], items: [
    d("orange", "🐈", "大橘", "Big Orange", 1), d("cow", "🐄", "奶牛猫", "Tuxedo cat", 1), d("calico", "🐈", "三花", "Calico", 2), d("blue", "🐈‍⬛", "英短蓝猫", "British Blue", 2), d("ragdoll", "😺", "布偶猫", "Ragdoll", 3), d("boss", "😼", "店长（不让摸）", "The Manager (no touching)", 3),
  ] },
  { id: "photo", name: ["📸 摄影作品", "📸 Photos taken"], items: [
    d("p1", "🌅", "海边日落", "Seaside sunset", 1), d("p2", "🌃", "城市夜景", "City lights", 1), d("p3", "🌫️", "山顶云海", "Sea of clouds", 2), d("p4", "🌈", "雨后彩虹", "Rainbow after rain", 2),
    d("p5", "🦅", "白鹭起飞", "Egret taking off", 2), d("p6", "🌌", "银河", "The Milky Way", 3),
  ] },
];
export const dropSet = (id: string) => DROP_SETS.find((s) => s.id === id) ?? null;
export const dropById = (id: string): { set: DropSet; item: Drop } | null => {
  for (const set of DROP_SETS) { const item = set.items.find((x) => x.id === id); if (item) return { set, item }; }
  return null;
};
/** Roll one drop: a better score shifts the odds toward rarer items. */
export function rollDrop(setId: string, score: number, rng = Math.random): Drop | null {
  const set = dropSet(setId); if (!set) return null;
  const w = (r: number) => (r === 1 ? 6 : r === 2 ? 1.5 + score * 3 : 0.2 + score * score * 2.2);
  const tot = set.items.reduce((a, x) => a + w(x.rarity), 0);
  let r = rng() * tot;
  for (const x of set.items) { r -= w(x.rarity); if (r <= 0) return x; }
  return set.items[0] ?? null;
}

/* ---------- the activities ---------- */
const P = (zh: string, en: string): L2 => [zh, en];
export const ACTIVITIES: Activity[] = [
  /* ===== 户外 ===== */
  { id: "fish-sea", emoji: "🎣", cat: "outdoor", name: P("海钓", "Sea fishing"), desc: P("甩一竿，看今天海里给你什么", "Cast a line and see what the sea gives you"),
    at: isSea, min: 150, cost: 30, energy: 10, game: reel(0.9, "鱼上钩了！按住收线，让张力留在绿区里，把它拉上来。", "Fish on! Hold to reel, keep the tension in the green and land it."),
    mood: 14, drop: "fish_sea", lines: { great: P("一竿上来，鱼还在甩尾巴，旁边的阿伯都凑过来看。", "Landed it in one — the old-timer next to you comes over to look."), ok: P("钓了一下午，收获不多，海风倒是吹够了。", "A long afternoon, a modest catch, plenty of sea breeze."), bad: P("线断了。你盯着海面发了半天呆。", "The line snapped. You stare at the water for a while.") } },
  { id: "fish-lake", emoji: "🎣", cat: "outdoor", name: P("湖边垂钓", "Lake fishing"), desc: P("找个树荫，支个小马扎", "Find some shade, unfold a stool"),
    at: isLake, min: 150, cost: 20, energy: 8, game: reel(0.65, "浮漂一沉！按住收线，别让线崩了。", "The float dips! Hold to reel — don't snap the line."),
    mood: 12, drop: "fish_lake", lines: { great: P("好家伙，这条够全家吃一顿了。", "What a catch — enough for a family dinner."), ok: P("钓上几条小的，心静了不少。", "A few small ones, and a much calmer mind."), bad: P("空军了。不过湖边的风很舒服。", "Nothing biting. Nice breeze, though.") } },
  { id: "climb", emoji: "⛰️", cat: "outdoor", name: P("冲顶", "Summit push"), desc: P("一段一段往上爬，见好就收，别逞强", "Climb section by section — know when to turn back"),
    at: isMountain, hours: DAY, min: 240, cost: 0, energy: 26,
    game: meter([1, 1, 2, 2, 3, 4], 0.04, 0.08, P("再爬一段", "Climb on"), P("在这儿歇脚", "Rest here"), P("段", "sections"), "每多爬一段风景更好，但也更容易抽筋崴脚。", "Every section climbed has better views — and a higher chance of cramp or a twisted ankle."),
    mood: 26, fit: 1, drop: "peak", risk: { kind: "injury", p: 0, text: P("下山时崴了脚，一瘸一拐去了诊所。", "You twisted an ankle on the way down and limped to a clinic.") },
    lines: { great: P("登顶了！云在脚下，整座城都小了。", "Summit! Clouds below, the whole city tiny."), ok: P("爬到半山腰，风景已经很好。", "Halfway up — and the views are already great."), bad: P("没爬多远就累了，坐在台阶上喘气。", "You didn't get far before collapsing on a step.") } },
  { id: "trail", emoji: "🥾", cat: "outdoor", name: P("徒步穿越", "Long hike"), desc: P("一条完整路线，路上全是选择", "A full route, full of decisions"),
    at: (l) => isMountain(l) || isBeach(l) || l.placeKind === "nature", hours: [6 * 60, 15 * 60], min: 300, cost: 20, energy: 30,
    game: quiz("一路上会遇到岔路、涨潮和体力危机，你来做决定。", "Forks, tides and tired legs — you make the calls.", [
      { q: P("岔路口：一条走海边礁石，一条翻山脊。", "A fork: one path over sea rocks, one over the ridge."), opts: [o("看看潮汐表再决定", "Check the tide table first", 2), o("走礁石，风景好", "Rocks — better views", 1), o("跟着前面的人走", "Just follow whoever's ahead", 0)] },
      { q: P("水只剩半瓶，还有一半路。", "Half a bottle of water left, half the route to go."), opts: [o("小口喝，在下一个村子补给", "Small sips, resupply at the next village", 2), o("一口喝完，到了再说", "Drink it all now, figure it out later", 0), o("问驴友借一点", "Ask a fellow hiker for some", 1)] },
      { q: P("天快黑了，离终点还有 3 公里。", "Dusk is coming; 3 km left."), opts: [o("打开头灯，结伴走完", "Headlamp on, finish with the group", 2), o("抄近路下山", "Take a shortcut down", 0), o("叫车在最近的路口接", "Call a car to the nearest road", 1)] },
    ]),
    mood: 28, fit: 2, network: 1, risk: { kind: "injury", p: 0.25, text: P("在礁石上滑了一跤，膝盖擦破了皮。", "You slipped on the rocks and skinned a knee.") },
    lines: { great: P("走完全程！和路上认识的驴友加了微信。", "Route complete — and you swapped contacts with new hiking buddies."), ok: P("走得有点狼狈，但看到的风景值了。", "A bit of a slog, but the views were worth it."), bad: P("走到一半就撤了，下次做好功课再来。", "You bailed halfway. More homework next time.") } },
  { id: "cycle", emoji: "🚴", cat: "outdoor", name: P("绿道骑行", "Greenway ride"), desc: P("沿着海或湖骑一圈，越快越爽", "A loop by the water — faster is better"),
    at: (l) => isGreen(l) || isBeach(l) || /骑行/.test(N(l)), hours: [6 * 60, 22 * 60], min: 90, cost: 15, energy: 16, game: mash(8, 60, "狂按蹬车！8 秒内冲过终点。", "Mash to pedal! Cross the line in 8 seconds."),
    mood: 16, fit: 1, lines: { great: P("风在耳边呼呼响，刷新了个人最快纪录。", "Wind roaring past — a personal best."), ok: P("骑了一圈，出了一身汗。", "One loop, one good sweat."), bad: P("骑到一半链条掉了，推着车走回来。", "The chain came off halfway; you pushed it back.") } },
  { id: "run", emoji: "🏃", cat: "outdoor", name: P("夜跑", "Night run"), desc: P("下班后最便宜的解压方式", "The cheapest stress relief after work"),
    at: (l) => isGreen(l) || isSport(l) || isBeach(l), hours: [17 * 60, 23 * 60], min: 60, cost: 0, energy: 14, game: mash(10, 70, "保持配速！10 秒内按满。", "Hold the pace! Fill the bar in 10 seconds."),
    mood: 15, fit: 1, lines: { great: P("配速 5 分半，跑完浑身轻松。", "5:30/km pace — you feel brand new."), ok: P("跑跑走走，也算动起来了。", "Run-walk, but you moved."), bad: P("跑了两公里就岔气了。", "A stitch after two kilometres.") } },
  { id: "surf", emoji: "🏄", cat: "outdoor", name: P("冲浪", "Surfing"), desc: P("等浪、起乘、站稳", "Wait, pop up, stay up"),
    at: isBeach, hours: [7 * 60, 18 * 60], min: 150, cost: 150, energy: 22, game: timing(3, 16, 75, "浪来的一瞬间按下起乘，三道浪。", "Pop up the moment the wave lifts you — three waves."),
    mood: 26, fit: 1, risk: { kind: "injury", p: 0.15, text: P("被浪拍下来，冲浪板磕到了额头。", "Wiped out — the board caught your forehead.") },
    lines: { great: P("站起来了！在浪上滑了足足十秒，教练都鼓掌。", "You're up! Ten seconds on the wave, and the coach applauds."), ok: P("呛了几口水，终于站起来一次。", "A few mouthfuls of sea, but you stood up once."), bad: P("一直在喝海水，没站起来过。", "All seawater, no standing.") } },
  { id: "dive", emoji: "🤿", cat: "outdoor", name: P("浮潜", "Snorkelling"), desc: P("看看水下的世界", "See what's under the surface"),
    at: (l) => isBeach(l) && /杨梅坑|西涌|三门|海龟|大鹏|较场尾|巽寮|双月湾|三角洲|大亚湾|小梅沙|东西冲/.test(N(l)), hours: [8 * 60, 17 * 60], min: 150, cost: 180, energy: 18,
    game: timing(3, 18, 60, "看准时机下潜，憋住气靠近它们。", "Time your dives, hold your breath and get close."), mood: 24, drop: "sea_life",
    lines: { great: P("一群小鱼从你身边游过，像下了一场彩色的雨。", "A school of fish swirls past like coloured rain."), ok: P("水有点浑，但还是看到了好东西。", "A bit murky, but you spotted something good."), bad: P("面镜一直进水，没看清什么。", "Your mask kept leaking; not much seen.") } },
  { id: "kite", emoji: "🪁", cat: "outdoor", name: P("放风筝", "Kite flying"), desc: P("有风的日子最适合", "Made for windy days"),
    at: (l) => isGreen(l) || isBeach(l), hours: [8 * 60, 18 * 60], min: 60, cost: 25, energy: 6, game: reel(0.5, "按住收线、松开放线，让风筝稳稳飞高。", "Hold to pull in, release to let out — keep it climbing."),
    mood: 14, lines: { great: P("风筝飞得最高，旁边的小朋友都看呆了。", "Your kite is the highest in the sky; the kids are in awe."), ok: P("飞起来了，就是有点歪。", "It flew. Crookedly."), bad: P("挂树上了。", "Stuck in a tree.") } },
  { id: "hoops", emoji: "🏀", cat: "outdoor", name: P("野球斗牛", "Street basketball"), desc: P("和陌生人打三对三", "Three-on-three with strangers"),
    at: (l) => isSport(l) || isGreen(l), hours: [7 * 60, 23 * 60], min: 90, cost: 0, energy: 18, game: timing(3, 14, 85, "出手要准：指针落在篮筐里就进。", "Release on target — land the needle in the hoop."),
    mood: 18, fit: 1, network: 1, lines: { great: P("三分绝杀！对面的人过来跟你击了个掌。", "Buzzer-beater three! The other team comes over to high-five you."), ok: P("打得有来有回，交了两个球友。", "A close game; you made two new court friends."), bad: P("被打了个 11 比 2。", "Lost 11–2.") } },
  { id: "photo", emoji: "📸", cat: "outdoor", name: P("扫街摄影", "Photo walk"), desc: P("等光、构图、按快门", "Wait for the light, frame it, click"),
    at: (l) => isScenic(l) || isBeach(l) || isMountain(l) || isGreen(l), min: 90, cost: 0, energy: 8, game: timing(3, 12, 55, "光线最好的那一刻按快门。", "Press the shutter at the perfect light."),
    mood: 12, money: 120, drop: "photo", lines: { great: P("这张能投稿！图库买下了版权。", "Publishable! A stock site bought the rights."), ok: P("拍了几张还不错的。", "A few decent shots."), bad: P("全糊了。", "All blurry.") } },
  { id: "dance", emoji: "💃", cat: "outdoor", name: P("广场舞", "Square dancing"), desc: P("阿姨们欢迎新人", "The aunties welcome newcomers"),
    at: isGreen, hours: [18 * 60, 22 * 60], min: 60, cost: 0, energy: 8, game: rhythm(16, 150, "跟上节拍！按 D F J K，或点轨道。", "Keep the beat! D F J K, or tap the lanes."),
    mood: 16, network: 1, lines: { great: P("领舞阿姨说你有天赋，下周站第一排。", "The lead auntie says you're a natural — front row next week."), ok: P("跳得有点僵，但大家都很热情。", "Stiff moves, warm crowd."), bad: P("一直跳反方向，被大家笑了一晚上。", "Wrong direction all night; everyone laughed (kindly).") } },

  /* ===== 夜生活 ===== */
  { id: "ktv", emoji: "🎤", cat: "night", name: P("K 歌", "Karaoke"), desc: P("开个包厢，把一周的气唱出来", "Book a booth and sing the week away"),
    at: (l) => isNight(l) || isMall(l), hours: [12 * 60, 24 * 60], min: 180, cost: 88, energy: 10, game: rhythm(22, 170, "跟着歌词的节奏按 D F J K！", "Hit D F J K with the lyrics!"),
    mood: 26, network: 1, lines: { great: P("一首《海阔天空》唱完，隔壁包厢的人都在鼓掌。", "Your power ballad gets applause from the next booth."), ok: P("跑调了几句，但唱得很开心。", "A few off-key lines, lots of fun."), bad: P("麦克风一开就破音，你默默点了首合唱。", "Your voice cracks on the first note; you quietly queue a duet.") } },
  { id: "drink", emoji: "🍺", cat: "night", name: P("喝两杯", "Drinks"), desc: P("精酿还是大排档啤酒？见好就收", "Craft beer or street-stall lager — know your limit"),
    at: (l) => isNight(l) || isEat(l), hours: [17 * 60, 24 * 60], min: 120, cost: 60, energy: 6,
    game: meter([3, 3, 4, 5, 6, 8], 0.02, 0.11, P("再来一杯", "One more"), P("今天到这儿", "Call it a night"), P("分", "fun"), "每多一杯越聊越开，但喝过头会断片。", "Every round makes the talk flow — until you black out."),
    mood: 22, network: 2, risk: { kind: "hangover", p: 0.35, text: P("喝多了，记不清怎么回的家。明天肯定头疼。", "Too much. You don't remember getting home. Tomorrow will hurt.") },
    lines: { great: P("聊到了人生理想，和邻桌成了朋友。", "Deep talk about life — and new friends at the next table."), ok: P("小酌两杯，微醺回家。", "A couple of drinks, a gentle buzz home."), bad: P("喝断片了。", "Blackout.") } },
  { id: "bar", emoji: "🍸", cat: "night", name: P("泡吧", "Bar hopping"), desc: P("灯光、音乐、陌生人", "Lights, music, strangers"),
    at: isNight, hours: NIGHT, min: 150, cost: 120, energy: 10, game: quiz("吧台边有人和你搭话。", "Someone at the bar starts talking to you.", [
      { q: P("「你也是一个人来的？」", "\"You here alone too?\""), opts: [o("「对，听说这儿的乐队不错」", "\"Yeah — heard the band's good\"", 2), o("「嗯。」", "\"Mm.\"", 0), o("「我朋友在路上」", "\"My friends are on their way\"", 1)] },
      { q: P("「你是做什么的？」", "\"What do you do?\""), opts: [o("讲一个工作里的好笑故事", "Tell a funny story from work", 2), o("报公司名", "Name-drop your company", 1), o("「下班时间不聊工作」", "\"No work talk after hours\"", 1)] },
      { q: P("乐队开始演奏了。", "The band starts playing."), opts: [o("拉对方一起去前排", "Pull them to the front with you", 2), o("坐着听", "Stay seated and listen", 1), o("低头刷手机", "Scroll your phone", 0)] },
    ]),
    mood: 20, network: 2, lines: { great: P("聊得很投机，互相加了联系方式。", "Great chemistry — you swapped numbers."), ok: P("音乐不错，人也不错。", "Good music, good people."), bad: P("全程尴尬，早早回家。", "Awkward all night; home early.") } },
  { id: "club", emoji: "🪩", cat: "night", name: P("蹦迪", "Clubbing"), desc: P("音乐一响就停不下来", "Once the bass drops, you can't stop"),
    at: isNight, hours: [21 * 60, 24 * 60], min: 180, cost: 150, energy: 22, game: rhythm(28, 210, "跟上鼓点！D F J K。", "Ride the beat! D F J K."),
    mood: 30, lines: { great: P("你成了舞池中央的那个人。", "You became the centre of the dance floor."), ok: P("跳到腿软，耳朵嗡嗡响。", "Danced till your legs gave out; ears still ringing."), bad: P("被挤在角落里一晚上。", "Squashed in a corner all night.") } },
  { id: "bizktv", emoji: "🥂", cat: "night", name: P("商务应酬", "Client dinner & karaoke"), desc: P("陪客户吃饭唱歌谈单子，谈成拿提成", "Wine and dine a client; close the deal for a commission"),
    at: isNight, hours: [18 * 60, 23 * 60], min: 240, cost: 0, energy: 24, game: quiz("包厢里坐着客户王总。察言观色，把单子谈下来。", "Mr Wang the client is in the private room. Read the room and close the deal.", [
      { q: P("王总举杯：「年轻人，酒量怎么样？」", "Mr Wang raises a glass: \"How well do you hold your drink, young one?\""), opts: [o("「我以茶代酒敬您，合同上我更有诚意」", "\"Allow me to toast with tea — my sincerity is in the contract\"", 2), o("一口干了", "Down it in one", 1), o("「我不喝酒」", "\"I don't drink\"", 0)] },
      { q: P("王总抱怨你们上次交付晚了。", "Mr Wang complains your last delivery was late."), opts: [o("认错，并给出补救方案", "Own it and offer a fix", 2), o("解释是供应商的问题", "Blame the supplier", 1), o("「那次不是我负责的」", "\"I wasn't on that one\"", 0)] },
      { q: P("王总点了一首老歌，唱完看着你。", "Mr Wang sings an old classic and looks at you."), opts: [o("真诚地夸他唱出了味道", "Sincerely praise the feeling in it", 2), o("接着点一首合唱", "Queue up a duet", 2), o("继续看手机", "Keep looking at your phone", 0)] },
    ]),
    mood: 4, money: 900, xp: 3, network: 2, risk: { kind: "hangover", p: 0.5, text: P("应酬喝多了，回家吐了一晚上。", "Too many toasts — you were sick all night.") },
    lines: { great: P("王总拍着你的肩：「合同明天签。」提成到手！", "Mr Wang claps your shoulder: \"We sign tomorrow.\" Commission secured!"), ok: P("单子还在谈，但王总记住你了。", "The deal is still open, but Mr Wang remembers you."), bad: P("王总提前走了，单子黄了。", "Mr Wang left early. Deal's off.") } },
  { id: "skewers", emoji: "🍢", cat: "night", name: P("撸串夜宵", "Late-night skewers"), desc: P("再来一串……再来一串……", "One more skewer… one more…"),
    at: isEat, hours: [19 * 60, 24 * 60], min: 90, cost: 50, energy: -18,
    game: meter([2, 2, 3, 3, 4, 5], 0.03, 0.09, P("再来一串", "Another skewer"), P("吃饱了", "I'm full"), P("份满足", "satisfaction"), "越吃越香，吃撑了会肚子疼。", "Each skewer tastes better — until your stomach rebels."),
    mood: 18, risk: { kind: "injury", p: 0, text: P("吃撑了，半夜肚子疼得睡不着。", "Overate — stomach ache kept you up all night.") },
    lines: { great: P("羊肉串、烤生蚝、冰啤酒，人间值得。", "Lamb skewers, grilled oysters, cold beer — life is good."), ok: P("吃了个半饱，刚刚好。", "Pleasantly fed."), bad: P("吃太多了……", "Way too much…") } },
  { id: "livehouse", emoji: "🎸", cat: "night", name: P("听 Livehouse", "Livehouse gig"), desc: P("小场子，大声音", "Small room, big sound"),
    at: (l) => isNight(l) || isStage(l), hours: [19 * 60, 23 * 60], min: 150, cost: 120, energy: 10, game: rhythm(20, 180, "跟着乐队一起打拍子！", "Clap along with the band!"),
    mood: 26, lines: { great: P("主唱把麦递给了你！", "The singer handed you the mic!"), ok: P("站在后排也听得很爽。", "Even from the back, it rocked."), bad: P("前面的人太高了，啥也没看见。", "Tall people in front; saw nothing.") } },
  { id: "standup", emoji: "🎙️", cat: "night", name: P("脱口秀开放麦", "Stand-up open mic"), desc: P("上台讲五分钟，台下是陌生人", "Five minutes on stage in front of strangers"),
    at: (l) => isNight(l) || isStage(l), hours: [19 * 60, 23 * 60], min: 120, cost: 0, energy: 12, game: quiz("讲到哪个梗，观众最买账？", "Which bits land with the crowd?", [
      { q: P("开场", "Opener"), opts: [o("讲城中村握手楼：对面邻居能递酱油", "Handshake buildings: you can pass soy sauce to the neighbour", 2), o("自我介绍讲了两分钟", "Two minutes of self-introduction", 0), o("吐槽地铁早高峰", "Rush-hour metro rant", 1)] },
      { q: P("中段冷场了", "The middle goes quiet"), opts: [o("跟前排观众互动", "Riff with the front row", 2), o("加快语速讲完", "Speed through it", 0), o("自嘲：这个梗在家试的时候我妈笑了", "Self-own: \"My mum laughed when I tried this at home\"", 2)] },
      { q: P("收尾", "Closer"), opts: [o("呼应开场的酱油梗", "Call back to the soy-sauce bit", 2), o("「谢谢大家」直接下台", "\"Thanks, goodnight\"", 1), o("讲一个很长的段子", "A very long story", 0)] },
    ]),
    mood: 24, money: 200, skill: 1, lines: { great: P("全场爆笑！老板问你下周还来不来，还给了出场费。", "The room roars! The owner books you for next week — paid."), ok: P("笑声稀稀拉拉，但你站完了五分钟。", "Scattered laughs, but you did your five."), bad: P("冷场到能听见空调声。", "So quiet you could hear the air-con.") } },
  { id: "jubensha", emoji: "🕵️", cat: "night", name: P("剧本杀", "Murder mystery"), desc: P("和一桌陌生人推理一晚上", "A night of deduction with strangers"),
    at: isMall, hours: [12 * 60, 24 * 60], min: 240, cost: 98, energy: 10, game: quiz("你是侦探，找出凶手。", "You're the detective. Find the killer.", [
      { q: P("死者手机最后一条消息发给了谁？", "Who got the victim's last message?"), opts: [o("先查通话记录的时间线", "Check the call-log timeline first", 2), o("直接怀疑管家", "Suspect the butler, obviously", 0), o("问每个人不在场证明", "Ask everyone for alibis", 1)] },
      { q: P("有人的不在场证明对不上。", "Someone's alibi doesn't add up."), opts: [o("拿出地铁刷卡记录对质", "Confront them with metro tap-in records", 2), o("先放一放，继续搜证", "Park it, keep searching", 1), o("当场投票", "Vote right now", 0)] },
      { q: P("最后投票。", "Final vote."), opts: [o("投给证据链最完整的那个人", "Vote for whoever the evidence chain points to", 2), o("投给最紧张的那个人", "Vote for the most nervous player", 1), o("跟大家一起投", "Vote with the crowd", 0)] },
    ]),
    mood: 22, skill: 1, network: 1, drop: "script", lines: { great: P("你一锤定音找出凶手，全桌起立鼓掌。", "You nailed the killer; the table gives you a standing ovation."), ok: P("没猜中，但剧情很上头。", "Wrong guess, gripping story."), bad: P("你就是凶手，但你忘了。", "You were the killer. You forgot.") } },
  { id: "escape", emoji: "🔐", cat: "night", name: P("密室逃脱", "Escape room"), desc: P("60 分钟，找线索、开锁", "60 minutes: find clues, crack locks"),
    at: isMall, hours: [10 * 60, 24 * 60], min: 120, cost: 120, energy: 10, game: timing(4, 14, 70, "每个机关都要卡准时机。", "Every lock needs perfect timing."),
    mood: 22, lines: { great: P("还剩 12 分钟就逃出来了，刷新了店里的纪录！", "Out with 12 minutes left — a new store record!"), ok: P("最后一分钟逃出来了。", "Escaped in the final minute."), bad: P("被 NPC 吓得腿软，求助了三次。", "The jump scares got you; three hints used.") } },
  { id: "mahjong", emoji: "🀄", cat: "night", name: P("搓麻将（不带钱）", "Mahjong (just for fun)"), desc: P("和街坊打几圈，只记分不赌钱", "A few rounds with neighbours — points only, no money"),
    at: (l) => isHome(l) || isMarket(l) || isEat(l), hours: [12 * 60, 24 * 60], min: 120, cost: 0, energy: 6,
    game: meter([1, 2, 2, 3, 4, 6], 0.05, 0.1, P("再摸一张，做大牌", "Draw again — go big"), P("胡了！", "Mahjong!"), P("番", "fan"), "牌越做越大，但等太久会被别人先胡。", "The bigger your hand, the likelier someone else wins first."),
    mood: 16, network: 1, lines: { great: P("清一色！林婶直拍大腿。", "A full flush! Auntie Lin slaps her thigh."), ok: P("小胡几把，开心就好。", "A few small wins — all good fun."), bad: P("一晚上都在点炮。", "Fed everyone else's wins all night.") } },

  /* ===== 约会 ===== */
  { id: "movie", emoji: "🎬", cat: "date", name: P("约看电影", "Movie date"), desc: P("两张票，一桶爆米花", "Two tickets, one popcorn"),
    at: (l) => isMall(l) || isStage(l), hours: [10 * 60, 24 * 60], min: 180, cost: 110, energy: 4, needs: "date", game: quiz("散场后聊聊电影，也聊聊你。", "After the film, talk about it — and about you.", DATE_QUESTIONS),
    mood: 20, romance: 14, drop: "film", lines: { great: P("散场后你们聊到商场关门。", "You talked until the mall closed."), ok: P("电影一般，人很好。", "So-so film, lovely company."), bad: P("全程无话，各自回家。", "Silence the whole way; separate rides home.") } },
  { id: "dinner", emoji: "🍷", cat: "date", name: P("约会晚餐", "Dinner date"), desc: P("订一家好一点的店", "Book somewhere nice"),
    at: (l) => isEat(l) || isMall(l) || isSea(l), hours: [17 * 60, 23 * 60], min: 150, cost: 220, energy: -10, needs: "date", game: quiz("烛光、海风、对面的人。", "Candles, sea breeze, and the person across from you.", DATE_QUESTIONS),
    mood: 22, romance: 18, lines: { great: P("对方说：「下次我请你。」", "They say: \"Next one's on me.\""), ok: P("吃得很好，聊得还行。", "Great food, decent chat."), bad: P("对方一直在看手机。", "They kept checking their phone.") } },
  { id: "seawalk", emoji: "🌊", cat: "date", name: P("海边散步", "Seaside stroll"), desc: P("不花钱，最浪漫", "Free, and the most romantic"),
    at: (l) => isSea(l) || isLake(l), hours: [16 * 60, 24 * 60], min: 90, cost: 0, energy: 6, needs: "date", game: quiz("海浪一阵一阵，话也一句一句。", "Wave after wave, word after word.", DATE_QUESTIONS),
    mood: 20, romance: 16, lines: { great: P("日落的时候，对方牵起了你的手。", "At sunset, they took your hand."), ok: P("风很大，你们笑着跑回了路边。", "Too windy — you ran back laughing."), bad: P("你一直在讲工作。", "You only talked about work.") } },
  { id: "themedate", emoji: "🎢", cat: "date", name: P("游乐园约会", "Theme-park date"), desc: P("过山车上尖叫，是拉近距离的捷径", "Screaming on a coaster is a shortcut to closeness"),
    at: isFun, hours: [9 * 60, 21 * 60], min: 300, cost: 360, energy: 18, needs: "date", game: quiz("排队的时候最适合聊天。", "Queues are perfect for talking.", DATE_QUESTIONS),
    mood: 30, romance: 22, lines: { great: P("下了过山车，对方还抓着你的胳膊没放。", "Off the coaster, they still haven't let go of your arm."), ok: P("排队排到腿软，但很开心。", "Endless queues, lots of fun."), bad: P("对方晕车，坐在长椅上缓了一下午。", "They got motion sick and sat out the afternoon.") } },
  { id: "museumdate", emoji: "🖼️", cat: "date", name: P("约会看展", "Gallery date"), desc: P("文艺一点，也聊得更深", "A bit arty — and deeper conversation"),
    at: isMuseum, hours: [9 * 60, 18 * 60], min: 150, cost: 60, energy: 6, needs: "date", game: quiz("站在一幅画前，对方问你看到了什么。", "In front of a painting, they ask what you see.", DATE_QUESTIONS),
    mood: 18, romance: 14, skill: 1, lines: { great: P("你们对同一幅画有一样的理解。", "You both read the same painting the same way."), ok: P("看不太懂，但对方讲得很好听。", "You didn't get it all, but they explained beautifully."), bad: P("你在展厅里打了个哈欠，被看见了。", "You yawned in the gallery. They saw.") } },
  { id: "matchmaking", emoji: "📋", cat: "date", name: P("相亲角", "Matchmaking corner"), desc: P("叔叔阿姨举着简历，帮儿女找对象", "Parents hold up their kids' CVs to find them a match"),
    at: isMatchmaking, hours: [9 * 60, 18 * 60], min: 120, cost: 0, energy: 8, game: quiz("一位阿姨拦住你：「小伙子/姑娘，有对象吗？」", "An auntie stops you: \"Young one, are you seeing anyone?\"", [
      { q: P("「多大了？做什么的？月薪多少？」", "\"How old? What job? Monthly salary?\""), opts: [o("笑着说「阿姨您先说说您家孩子」", "Smile: \"Auntie, tell me about your kid first\"", 2), o("如实报上", "Answer honestly", 1), o("转身就走", "Walk away", 0)] },
      { q: P("「在深圳有房吗？」", "\"Own a flat in Shenzhen?\""), opts: [o("「正在努力，城中村也是房」", "\"Working on it — an urban-village room counts, right?\"", 2), o("「没有」", "\"No\"", 1), o("「有，三套」（并没有）", "\"Three\" (you don't)", 0)] },
    ]),
    mood: 12, network: 2, lines: { great: P("阿姨们都很喜欢你，塞了三张简历给你。", "The aunties love you and press three CVs into your hands."), ok: P("被问了一下午，收获了一堆八卦。", "An afternoon of questions and a lot of gossip."), bad: P("被阿姨们评头论足，落荒而逃。", "Sized up by every auntie, you flee.") } },

  /* ===== 开车 ===== */
  { id: "license", emoji: "🪪", cat: "drive", name: P("驾校练车", "Driving school"), desc: P("科目一、二、三，三天考完拿驾照", "Three tests over three days for your licence"),
    at: (l) => l.type === "learn" || isTransit(l), hours: [8 * 60, 20 * 60], min: 180, cost: 900, energy: 14, needs: "notLicensed",
    game: timing(3, 16, 70, "倒车入库、坡道起步、侧方停车：看准时机打方向。", "Reverse park, hill start, parallel park — steer at the right moment."),
    mood: 6, skill: 1, lines: { great: P("一把过！考官点了点头。", "Passed first try! The examiner nods."), ok: P("磕磕绊绊，勉强过了。", "Shaky, but a pass."), bad: P("压线挂科，下次再来。", "Clipped the line. Fail — try again.") } },
  { id: "rentcar", emoji: "🚙", cat: "drive", name: P("租一天车", "Rent a car for the day"), desc: P("今天出行可以选「自驾」", "Unlocks \"Drive\" as a travel mode today"),
    at: isTransit, min: 30, cost: 220, energy: 0, needs: "license", game: timing(1, 40, 40, "绕车检查一圈，按下确认。", "Walk round the car, then confirm."),
    mood: 6, lines: { great: P("车况很好，油是满的。", "Great car, full tank."), ok: P("车上有点烟味，能开。", "Smells a bit of smoke; drives fine."), bad: P("车有划痕，你拍照留证了。", "Scratches on it — you photographed them for the record.") } },
  { id: "cruise", emoji: "🛣️", cat: "drive", name: P("海边兜风", "Coastal drive"), desc: P("滨海公路，车窗打开", "Coast road, windows down"),
    at: (l) => isSea(l) || isMountain(l), min: 120, cost: 40, energy: 4, needs: "car", game: timing(4, 18, 80, "过弯！在弯心按下。", "Corners! Press at the apex."),
    mood: 26, risk: { kind: "police", p: 0.2, fine: 200, text: P("超速被拍了，罚款扣分。", "Caught speeding — fine and points.") },
    lines: { great: P("一路海景，歌单刚好放到最爱的那首。", "Sea views all the way, your favourite song comes on at just the right moment."), ok: P("有点堵，但海风很舒服。", "A bit of traffic, lovely breeze."), bad: P("一路都在找停车位。", "Spent the whole time hunting for parking.") } },
  { id: "rideshare", emoji: "🚖", cat: "drive", name: P("跑网约车", "Ride-hailing shift"), desc: P("开车接单赚钱", "Drive passengers for cash"),
    at: isTransit, hours: [7 * 60, 24 * 60], min: 300, cost: 60, energy: 24, needs: "car", game: timing(5, 15, 75, "接单、导航、平稳停车：五单。", "Accept, navigate, stop smoothly — five rides."),
    mood: 0, money: 650, risk: { kind: "police", p: 0.12, fine: 200, text: P("违停接客被抄牌了。", "Ticketed for stopping illegally to pick up.") },
    lines: { great: P("五星好评刷屏，还有人给了小费。", "Five stars all round — and a tip."), ok: P("跑了几单，赚了点油钱以外的钱。", "A few fares, a bit beyond fuel money."), bad: P("堵在深南大道上动不了。", "Stuck on Shennan Boulevard, going nowhere.") } },
  { id: "daijia", emoji: "🔑", cat: "drive", name: P("夜间代驾", "Designated driver"), desc: P("帮喝了酒的人把车开回家", "Drive drunk people home in their own cars"),
    at: (l) => isNight(l) || isEat(l), hours: [21 * 60, 24 * 60], min: 180, cost: 0, energy: 16, needs: "license", game: timing(4, 14, 80, "稳稳开，别让客户的豪车有一点刮蹭。", "Smooth driving — not a scratch on the client's luxury car."),
    mood: -2, money: 420, lines: { great: P("客户睡了一路，到家给你转了 ¥100 小费。", "The client slept all the way and tipped you ¥100."), ok: P("一晚上接了三单。", "Three jobs tonight."), bad: P("客户在车上吐了。", "The client threw up in the car.") } },

  /* ===== 搞钱 ===== */
  { id: "stall", emoji: "🏮", cat: "hustle", name: P("夜市摆摊", "Night-market stall"), desc: P("进点小商品，吆喝起来", "Stock some trinkets and start hawking"),
    at: (l) => isEat(l) || isMarket(l), hours: [18 * 60, 24 * 60], min: 240, cost: 120, energy: 20,
    game: meter([60, 80, 100, 130, 160, 200], 0.04, 0.09, P("再吆喝一轮", "Another round of hawking"), P("收摊", "Pack up"), P("元", "¥"), "人越来越多，生意越来越好——但城管随时会来。", "The crowd grows and so do sales — but the inspectors could show up any time."),
    mood: 10, money: 730, risk: { kind: "police", p: 0, fine: 200, text: P("城管来了，东西被暂扣，还交了罚款。", "Inspectors! Goods confiscated and a fine to pay.") },
    lines: { great: P("卖空了！明天还来。", "Sold out! Back tomorrow."), ok: P("卖了一半，够本了。", "Sold half — broke even."), bad: P("一个都没卖出去。", "Didn't sell a thing.") } },
  { id: "flip", emoji: "📱", cat: "hustle", name: P("倒卖二手手机", "Flip used phones"), desc: P("低买高卖，小心翻新机", "Buy low, sell high — beware refurbished fakes"),
    at: isMarket, hours: [9 * 60, 21 * 60], min: 180, cost: 300, energy: 12,
    game: meter([80, 100, 140, 180, 240], 0.05, 0.1, P("再收一台", "Buy another"), P("全部出手", "Sell everything"), P("元利润", "¥ profit"), "收得越多赚得越多，但收到翻新机就砸手里了。", "More stock, more profit — until you buy a refurbished dud."),
    mood: 6, money: 740, xp: 1, risk: { kind: "scam", p: 0, fine: 300, text: P("收到一台翻新机，钱砸手里了。", "You bought a refurbished fake. Money gone.") },
    lines: { great: P("一转手，赚了一个月房租。", "Flipped them for a month's rent."), ok: P("赚了点辛苦钱。", "A modest profit."), bad: P("砸手里了。", "Stuck with them.") } },
  { id: "livestream", emoji: "📹", cat: "hustle", name: P("直播带货", "Live-stream selling"), desc: P("对着手机讲两个小时", "Two hours talking to your phone"),
    at: (l) => isHome(l) || isScenic(l) || isMall(l) || isMarket(l), hours: [10 * 60, 24 * 60], min: 120, cost: 0, energy: 14, game: timing(4, 14, 65, "在直播间人气最高的那一刻上链接！", "Drop the product link at peak viewers!"),
    mood: 8, money: 500, skill: 1, lines: { great: P("直播间冲进了同城热榜，链接秒空。", "Your stream hit the local trending list and sold out in seconds."), ok: P("二十几个人在看，卖出几单。", "Two dozen viewers, a few sales."), bad: P("直播间只有你妈在看。", "The only viewer was your mum.") } },
  { id: "busk", emoji: "🎸", cat: "hustle", name: P("街头卖唱", "Busking"), desc: P("吉他盒打开，唱给路过的人", "Open the guitar case, sing to passers-by"),
    at: (l) => isGreen(l) || isTransit(l) || isSea(l), hours: [16 * 60, 23 * 60], min: 120, cost: 0, energy: 10, game: rhythm(20, 160, "唱准一点，路人才会停下来。", "Hit the notes and people will stop."),
    mood: 18, money: 260, lines: { great: P("围了一圈人，吉他盒里全是零钱和二维码打赏。", "A crowd gathers; the case fills with coins and QR tips."), ok: P("有几个人停下来听。", "A few people stopped to listen."), bad: P("保安请你换个地方。", "Security asked you to move on.") } },
  { id: "dash", emoji: "🛵", cat: "hustle", name: P("冲单（骑手）", "Delivery sprint"), desc: P("限时送达，越快越赚", "Timed deliveries — faster pays more"),
    at: (l) => isEat(l) || isMall(l), hours: [10 * 60, 23 * 60], min: 180, cost: 0, energy: 26, game: mash(10, 80, "狂按冲单！10 秒内送达。", "Mash to deliver! 10 seconds."),
    mood: -2, money: 420, risk: { kind: "injury", p: 0.12, text: P("赶时间摔了一跤，手肘擦伤。", "Rushing, you fell and scraped an elbow.") },
    lines: { great: P("单王！今天冲进了站点前三。", "Top rider today — station top three!"), ok: P("跑了十几单。", "A dozen deliveries."), bad: P("超时三单，被罚了。", "Three late orders, fined.") } },
  { id: "claw", emoji: "🧸", cat: "hustle", name: P("抓娃娃", "Claw machine"), desc: P("¥20 十次，看你的手感", "¥20 for ten goes — test your touch"),
    at: isMall, min: 30, cost: 20, energy: 2, game: timing(2, 10, 90, "爪子对准娃娃的那一刻按下！", "Drop the claw exactly over the prize!"),
    mood: 10, drop: "plush", lines: { great: P("一爪入魂！", "First try!"), ok: P("抓了好几次，终于掉下来了。", "Took a few goes, but it dropped."), bad: P("爪子是软的。", "The claw is rigged. Obviously.") } },

  /* ===== 灰色地带 ===== */
  { id: "fight", emoji: "👊", cat: "risky", name: P("替人出头", "Step in"), desc: P("有人在欺负人。你要管吗？", "Someone's being bullied. Do you step in?"),
    at: (l) => isNight(l) || isEat(l) || l.id === "metro", hours: [18 * 60, 24 * 60], min: 90, cost: 0, energy: 16, game: quiz("几个醉汉在为难一个外卖小哥。", "A few drunks are hassling a delivery rider.", [
      { q: P("你先怎么做？", "What do you do first?"), opts: [o("掏手机录像，同时报警", "Start filming and call the police", 2), o("上前大喊「住手！」", "Step up and shout \"Stop!\"", 1), o("直接动手", "Throw the first punch", 0)] },
      { q: P("对方冲你过来了。", "They turn on you."), opts: [o("护住小哥往人多的地方退", "Shield the rider and retreat to the crowd", 2), o("和他们讲道理", "Try to reason with them", 1), o("抄起椅子", "Grab a chair", 0)] },
    ]),
    mood: 18, network: 2, risk: { kind: "police", p: 0.45, fine: 500, text: P("双方都被带去了派出所，做笔录、调解、赔钱。", "Everyone gets taken to the police station — statements, mediation, compensation.") },
    lines: { great: P("警察来了，醉汉被带走。小哥一直在说谢谢。", "The police arrive and take the drunks away. The rider can't stop thanking you."), ok: P("对方骂骂咧咧地走了。", "They stagger off, swearing."), bad: P("打起来了……", "It turned into a fight…") } },
  { id: "farejump", emoji: "🚧", cat: "risky", name: P("逃票", "Dodge the fare"), desc: P("省几块钱，值得吗？", "Save a few yuan. Worth it?"),
    at: (l) => l.id === "metro" || isTransit(l), min: 20, cost: 0, energy: 4, game: timing(1, 10, 95, "趁闸机没关，贴着前面的人过去。", "Tailgate through before the gate closes."),
    mood: 4, money: 6, risk: { kind: "police", p: 0.6, fine: 200, text: P("被站务员拦下，罚款并记录在案。", "Stopped by staff — fined and put on record.") },
    lines: { great: P("混过去了。心跳得厉害。", "You made it. Heart pounding."), ok: P("差点被发现。", "Nearly caught."), bad: P("被抓了个正着。", "Caught red-handed.") } },
  { id: "scalp", emoji: "🎫", cat: "risky", name: P("倒卖演唱会门票", "Scalp concert tickets"), desc: P("黄牛的钱好赚，也容易进去", "Scalping pays — and lands people in trouble"),
    at: (l) => isSport(l) || isStage(l), hours: [14 * 60, 22 * 60], min: 150, cost: 400, energy: 10,
    game: meter([120, 160, 220, 300], 0.15, 0.15, P("再加价", "Mark it up"), P("出手", "Sell"), P("元利润", "¥ profit"), "价越高赚越多，被举报的概率也越高。", "Higher prices, more profit — and more likely to be reported."),
    mood: 2, money: 1200, risk: { kind: "police", p: 0.3, fine: 800, text: P("被举报，票被收走，行政拘留了一晚。", "Reported. Tickets seized; a night in custody.") },
    lines: { great: P("票全出了，赚了一笔快钱。", "All sold — quick money."), ok: P("卖了几张，提心吊胆。", "Sold a few, nervously."), bad: P("警察就在你身后。", "The police were right behind you.") } },
  { id: "antiscam", emoji: "📞", cat: "risky", name: P("接到可疑电话", "A suspicious call"), desc: P("「您好，我是快递客服……」", "\"Hello, this is courier customer service…\""),
    at: isHome, min: 30, cost: 0, energy: 2, game: quiz("对方说你的快递丢了，要给你理赔。", "They say your parcel was lost and they want to compensate you.", [
      { q: P("「请您下载这个 App 办理理赔」", "\"Please download this app to claim\""), opts: [o("挂掉，打官方客服核实", "Hang up and call the official number", 2), o("问对方工号", "Ask for their staff ID", 1), o("下载", "Download it", 0)] },
      { q: P("「需要您开启屏幕共享」", "\"Please turn on screen sharing\""), opts: [o("拒绝，并打 96110 反诈专线", "Refuse and call the 96110 anti-fraud line", 2), o("犹豫一下", "Hesitate", 1), o("开启", "Turn it on", 0)] },
      { q: P("「验证码发您手机上了，念一下」", "\"Read me the code we just texted you\""), opts: [o("「验证码不能告诉任何人」", "\"Codes are never shared\"", 2), o("只念前三位", "Read the first three digits", 0), o("念了", "Read it out", 0)] },
    ]),
    mood: 10, money: 200, risk: { kind: "scam", p: 0.9, fine: 1500, text: P("银行卡被转走了一笔钱……这是电信诈骗。", "Money vanished from your card… it was a phone scam.") },
    lines: { great: P("你识破了骗局，反诈中心还给了你一笔举报奖励。", "You saw through it — and the anti-fraud centre paid you a reporting reward."), ok: P("你挂了电话，有惊无险。", "You hung up. Close call."), bad: P("你被骗了。", "You got scammed.") } },

  /* ===== 休闲 ===== */
  { id: "spa", emoji: "♨️", cat: "chill", name: P("泡温泉", "Hot springs"), desc: P("泡到手指起皱", "Soak till your fingers wrinkle"),
    at: isSpa, min: 120, cost: 168, energy: -30, game: timing(1, 50, 30, "找个最舒服的池子，按下。", "Find the comfiest pool, then press."),
    mood: 26, lines: { great: P("整个人都化了。", "You've melted."), ok: P("泡得很舒服。", "Very relaxing."), bad: P("水太烫了。", "Too hot.") } },
  { id: "pray", emoji: "🎋", cat: "chill", name: P("祈福求签", "Draw a fortune"), desc: P("摇一支签，看看运气", "Shake a fortune stick and see your luck"),
    at: isTemple, hours: [7 * 60, 17 * 60], min: 60, cost: 10, energy: 4, game: mash(4, 18, "摇签筒！摇得越虔诚，签越好。", "Shake the cup! The more sincere, the better the slip."),
    mood: 14, drop: "fortune", lines: { great: P("签文写得真好，你拍照发了朋友圈。", "Lovely words — you posted the slip online."), ok: P("中规中矩的一支签。", "A middling slip."), bad: P("签掉在了地上……再摇一次？", "The stick fell on the floor… shake again?") } },
  { id: "catcafe", emoji: "🐱", cat: "chill", name: P("撸猫咖啡馆", "Cat café"), desc: P("一杯拿铁，一只猫", "A latte and a cat"),
    at: isMall, min: 90, cost: 58, energy: -6, game: timing(2, 22, 45, "等猫自己靠过来，轻轻摸。", "Wait for the cat to come to you, then gently pet."),
    mood: 22, drop: "cat", lines: { great: P("猫在你腿上睡着了，你一动都不敢动。", "A cat fell asleep on your lap. You dare not move."), ok: P("猫看了你一眼，走了。", "The cat glanced at you and left."), bad: P("被挠了一下。", "Scratched.") } },
  { id: "teahouse", emoji: "🫖", cat: "chill", name: P("早茶一盅两件", "Dim sum & tea"), desc: P("虾饺、凤爪、叉烧包", "Har gow, chicken feet, char siu bao"),
    at: (l) => isEat(l) || isMall(l), hours: [8 * 60, 14 * 60], min: 90, cost: 68, energy: -20, game: quiz("服务员推着点心车过来了。", "The dim sum trolley rolls by.", [
      { q: P("先点什么？", "What first?"), opts: [o("虾饺 + 凤爪", "Har gow + chicken feet", 2), o("流沙包", "Custard bun", 1), o("一碗白粥", "Plain congee", 1)] },
      { q: P("别人给你倒茶，你会？", "Someone pours you tea. You…"), opts: [o("用手指轻敲桌面致谢", "Tap two fingers on the table in thanks", 2), o("说谢谢", "Say thanks", 1), o("没注意", "Don't notice", 0)] },
    ]),
    mood: 16, lines: { great: P("一盅两件，一份报纸，慢慢一上午。", "Tea, two dishes and a newspaper — a slow, perfect morning."), ok: P("吃饱了。", "Full."), bad: P("等位等了一小时。", "An hour's wait for a table.") } },
  { id: "volunteer-clean", emoji: "🧤", cat: "chill", name: P("净滩志愿者", "Beach clean-up"), desc: P("捡一袋垃圾，换一片干净的海", "One bag of rubbish for a cleaner sea"),
    at: isBeach, hours: [7 * 60, 17 * 60], min: 120, cost: 0, energy: 14, game: mash(8, 50, "快捡！8 秒内捡满一袋。", "Quick! Fill the bag in 8 seconds."),
    mood: 18, network: 2, lines: { great: P("你捡得最多，被志愿者队长表扬了。", "Most collected — the team leader singles you out."), ok: P("捡了一袋，海滩干净了一点。", "One bag; a slightly cleaner beach."), bad: P("太阳太晒，捡了一会儿就撤了。", "Too hot; you gave up early.") } },
];

export const activityById = (id: string) => ACTIVITIES.find((a) => a.id === id) ?? null;
export function activitiesAt(l: Loc): Activity[] {
  return ACTIVITIES.filter((a) => { try { return a.at(l); } catch { return false; } });
}

/* ---------- romance stages ---------- */
export const ROMANCE_STAGES: { at: number; name: L2 }[] = [
  { at: 0, name: ["约会对象", "Dating"] }, { at: 25, name: ["暧昧中", "It's complicated"] }, { at: 55, name: ["恋人", "Partners"] }, { at: 90, name: ["同居", "Living together"] },
];
export function romanceStage(pts: number): number {
  let s = 0; ROMANCE_STAGES.forEach((r, i) => { if (pts >= r.at) s = i; }); return s;
}
