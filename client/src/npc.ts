// NPC 模拟系统 — MiroFish-style multi-agent flavour, zero LLM calls.
//
// Every NPC is a little person with:
//   · a persona derived deterministically from their identity (warmth, humour,
//     hustle, chattiness, pride) — same NPC, same character, every run;
//   · a daily schedule line (作息) derived from their job;
//   · a persistent memory of the player: relationship score, favours done,
//     slights remembered, topics talked about, a one-line note ("他记得你…");
//   · a mood that drifts day to day and colours how they greet and post.
// NPCs also simulate each other: every morning a few of them post to the
// 街坊动态墙 about the weather, Summit, the player's news (promotions, new
// home) and their own lives, and the others comment — supportively or with
// teasing, depending on a pairwise affinity seeded from their names.
// All generation is personality parameters + memory + templates, seeded RNG,
// so it runs locally on any PC and costs no tokens.

import {
NPCS, apecPhase, isApecWeek, npcsForCity, weatherOf,
type CityKey, type Npc,
} from "./data";

/* ---------------- deterministic RNG ---------------- */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)] ?? arr[0]!;

/* ---------------- persona ---------------- */
export interface Persona {
  warmth: number;    // 0..1 热心程度
  humor: number;     // 0..1 幽默 / 开得起玩笑
  hustle: number;    // 0..1 拼劲（聊工作的话题量）
  chattiness: number;// 0..1 话痨程度（发动态、评论概率）
  pride: number;     // 0..1 要面子（被调侃时翻脸概率）
}
export function personaOf(npc: Npc): Persona {
  const rng = mulberry(hashStr(`persona:${npc.name}:${npc.job}`));
  const base: Persona = { warmth: rng(), humor: rng(), hustle: rng(), chattiness: rng(), pride: rng() };
  // Anchor a few well-known neighbours so their voice matches their flavour text.
  if (npc.name === "陈伯") { base.warmth = 0.9; base.chattiness = 0.75; }
  if (npc.name === "大芬姐") { base.warmth = 0.85; base.humor = 0.7; base.chattiness = 0.8; }
  if (npc.name === "阿强") { base.hustle = 0.9; base.humor = 0.65; }
  if (npc.name === "老周") { base.pride = 0.8; base.chattiness = 0.3; base.humor = 0.25; }
  if (npc.name === "Lisa") { base.chattiness = 0.7; base.hustle = 0.8; }
  if (npc.name === "王姨") { base.warmth = 0.8; base.chattiness = 0.85; }
  if (npc.name === "林婶") { base.warmth = 0.95; base.chattiness = 0.7; }
  if (npc.name === "郭叔") { base.warmth = 0.8; base.pride = 0.6; }
  if (npc.name === "阿琳") { base.humor = 0.6; base.chattiness = 0.65; }
  if (npc.name === "子健") { base.hustle = 0.75; base.humor = 0.55; }
  if (npc.name === "小美") { base.chattiness = 0.6; base.humor = 0.6; }
  if (npc.name === "华哥") { base.warmth = 0.85; base.chattiness = 0.8; base.hustle = 0.8; }
  if (npc.name === "阿May") { base.hustle = 0.8; base.chattiness = 0.6; }
  if (npc.name === "强哥") { base.chattiness = 0.75; base.humor = 0.7; base.pride = 0.5; }
  if (npc.name === "婆婆珍") { base.warmth = 0.9; base.chattiness = 0.85; }
  if (npc.name === "船长辉") { base.warmth = 0.75; base.humor = 0.6; }
  if (npc.name === "肥妈") { base.warmth = 0.95; base.chattiness = 0.8; }
  return base;
}

/** 作息 — derived from the job, shown in the social panel and chat header. */
export function scheduleOf(npc: Npc): string {
  const j = npc.job;
  if (j.includes("骑手")) return "早上 7 点出车，跑单到夜里 10 点，午饭都在车上解决";
  if (j.includes("保安")) return "三班倒轮岗，夜里也要巡逻，谁晚归他都看得见";
  if (j.includes("摊主") && npc.name === "郭叔") return "凌晨 4 点去批发市场进货，摆摊到傍晚 6 点收";
  if (j.includes("摊主")) return "下午 4 点出摊，夜市散场才收摊，越夜越精神";
  if (j.includes("联络员")) return "跟着会务日程表走，峰会周期几乎连轴转，深夜还在对流程";
  if (j.includes("学生")) return "白天上课，晚上泡图书馆自习，周末睡到自然醒";
  if (j.includes("保洁")) return "早上 5 点开工，赶在人流高峰前把地拖干净";
  if (j.includes("邻居")) return "早睡早起，早上买菜、傍晚煲汤，阳台的葱是她的日程表";
  if (j.includes("通勤")) return "每天 7 点半准时出门，赶固定那一班地铁，雷打不动";
  if (j.includes("同事")) return "朝九晚六，需求评审日会忙到飞起，保温杯不离手";
  if (j.includes("白领")) return "朝九晚六，下班爱去夜市和商场，手机相册全是吃的";
  if (j.includes("茶餐厅")) return "朝六晚十，早市茶市一脚踢，落场嗰阵先至系自己嘅时间";
  if (j.includes("的士")) return "早更朝五晚五，交更先食个早餐；边条隧道塞车，佢比导航更早知";
  if (j.includes("菜贩")) return "凌晨三点去果栏入货，摆档到黄昏，电车喺门口叮叮过几十年";
  if (j.includes("小轮")) return "跟船期返工，维港的日出日落睇到厌——佢话未厌过";
  if (j.includes("邻居") && npc.name === "肥妈") return "早起去街市，傍晚煲汤，全层楼嘅晚饭时间由佢嘅汤香决定";
  return "作息规律，白天忙活，晚上歇着";
}

/** Pairwise affinity between two NPCs: -1 (不对付) .. 1 (投契). Seeded, stable. */
export function affinity(a: string, b: string): number {
  if (a === b) return 1;
  const key = [a, b].sort().join("|");
  return (hashStr(`aff:${key}`) % 200) / 100 - 1;
}

/* ---------------- memory ---------------- */
export interface NpcMem {
  rel: number;       // -100..100 与玩家的关系
  talks: number;     // 聊过几次
  helps: number;     // 玩家帮过他几次
  gifts: number;     // 玩家送过几次小礼物
  slights: number;   // 玩家得罪过他几次（玩笑开过头等）
  mood: number;      // -20..20 今日心情偏移
  lastDay: number;   // 上次聊天是哪天
  lastTopic: string; // 上次聊的话题
  note: string;      // 他记得的一件事（展示用）
}
export const emptyMem = (): NpcMem => ({
  rel: 0, talks: 0, helps: 0, gifts: 0, slights: 0, mood: 0, lastDay: 0, lastTopic: "", note: "",
});
export type MemMap = Record<string, NpcMem>;
export function memOf(mems: MemMap, name: string): NpcMem {
  return mems[name] ?? emptyMem();
}
export function relLabel(rel: number): string {
  if (rel >= 60) return "铁哥们儿";
  if (rel >= 35) return "老朋友";
  if (rel >= 15) return "熟人";
  if (rel >= 1) return "面熟";
  if (rel <= -25) return "有点僵";
  if (rel <= -8) return "不太对付";
  return "初识";
}
export function moodEmoji(mood: number): string {
  if (mood >= 9) return "😄";
  if (mood >= 3) return "🙂";
  if (mood >= -3) return "😐";
  if (mood >= -9) return "😟";
  return "😤";
}
export function moodWord(mood: number): string {
  if (mood >= 9) return "心情特别好";
  if (mood >= 3) return "心情不错";
  if (mood >= -3) return "心情一般";
  if (mood >= -9) return "心情不太好";
  return "心情很差";
}

/* ---------------- player news (things the street will talk about) ---------------- */
export interface PlayerNews { kind: "career" | "home" | "apec" | "money"; text: string; day: number }

/* ---------------- the daily wall ---------------- */
export interface NpcComment { author: string; text: string }
export interface NpcPost {
  id: string;
  day: number;
  author: string;
  kind: "weather" | "apec" | "player" | "life" | "work" | "food";
  text: string;
  comments: NpcComment[];
  likes: number;
  liked?: boolean;
  playerComment?: string;
}

export interface DayContext {
  day: number;
  cityKey: CityKey;
  playerName: string;
}

function weatherPost(p: Persona, weather: string, rng: () => number): string {
  const rainy = weather.includes("雨") || weather.includes("暴雨");
  const storm = weather.includes("暴雨");
  if (storm) return pick(rng, [
    "暴雨天☔ 出门跟渡劫似的，鞋里都能养鱼了。大家今天没事别往外跑。",
    "这雨大得离谱，伞在风里翻了两个跟头。平安到家就是福。",
  ]);
  if (rainy) return pick(rng, [
    "下雨天路滑，骑车走路都慢点。热汤面倒是这种天最香。",
    "雨下了一上午，裤脚全湿了。这种天就适合在家煲个汤。",
    p.warmth > 0.6 ? "下雨了，提醒一句：出门带伞，骑车慢行，平安最重要。" : "又下雨，烦人。摊位前面全是水坑。",
  ]);
  if (weather.includes("海风")) return pick(rng, [
    "今天海风大，晾的衣服差点被吹去香港。海边的朋友注意收衣服！",
    "海风一吹，什么烦恼都散了。傍晚去海边走走吧。",
  ]);
  return pick(rng, [
    "今天天儿真好，蓝天白云的，心情都跟着亮堂。适合出门办点事。",
    "晴天万里，出门记得防晒。好天气不等人，活儿也得抓紧干。",
  ]);
}

function apecPost(npc: Npc, p: Persona, day: number, rng: () => number): string {
  const ph = apecPhase(day);
  if (npc.name === "Lisa") return pick(rng, [
    `在${ph.label.includes("晚宴") ? "太子湾" : "会场"}对流程对到嗓子冒烟，但想到 21 个经济体的人都要来，还是挺自豪的。`,
    "今天又陪代表团走了一遍动线。深圳这次是真把门面撑起来了。",
  ]);
  if (day < 14) return pick(rng, [
    `峰会还有 ${14 - day} 天，会场那边灯火通明的。听说志愿者还在招人，想去的抓紧。`,
    "最近总听人聊峰会，连买菜都能听见大爷大妈议论外国与会嘉宾吃啥。",
  ]);
  if (isApecWeek(day)) return pick(rng, [
    `${ph.label}，街上外国面孔明显多了。这座城市忙起来的时候，是真有国际范儿。`,
    "峰会进行中，地铁安检都严了些。大家出门预留点时间，别迟到。",
    p.humor > 0.55 ? "今天在路上听见老外学说「唔该」，笑出声。峰会把全世界都请到家门口了。" : "会场周边的花都重新摆了，整座城都在为这几天做准备。",
  ]);
  return pick(rng, [
    "峰会结束了，志愿者证书都发下来了。这段经历，够吹一阵子的。",
    "峰会周一过，城市好像一下子安静了。热闹过，才更知道平常日子的好。",
  ]);
}

function playerPost(newsItem: PlayerNews, p: Persona, playerName: string, rng: () => number): string {
  const who = playerName || "街坊";
  if (newsItem.kind === "career") return pick(rng, [
    `听说${who}${newsItem.text}！工位/街坊都传开了，这必须请客啊🎉`,
    `${who}${newsItem.text}，我就说这人是干大事的。恭喜恭喜，红包先欠着，饭得吃上。`,
    p.humor > 0.55 ? `${who}${newsItem.text}了？那以后罩着点兄弟/街坊啊，先抱个大腿🦵` : `听说了，${who}${newsItem.text}，真替他高兴。努力的人运气不会差。`,
  ]);
  if (newsItem.kind === "home") return pick(rng, [
    `${who}${newsItem.text}，这下住得像个家了。乔迁得请大家吃顿好的吧？`,
    `路过看见${who}家换了新样子，${newsItem.text}，隔着窗都觉得亮堂。`,
  ]);
  if (newsItem.kind === "apec") return pick(rng, [
    `${who}${newsItem.text}，峰会的场子都让他/她跑遍了，这履历以后写简历上都发光。`,
    `今天在会场又碰到${who}了，${newsItem.text}，忙得脚不沾地，但精神头十足。`,
  ]);
  return pick(rng, [
    `听说${who}${newsItem.text}。过日子嘛，一点点攒、一天天过，都会好起来的。`,
  ]);
}

const LIFE_POSTS: Record<string, string[]> = {
  "外卖骑手": ["今天跑了 40 多单，最后一单送到的时候天都黑了。骑手这行，腿勤嘴甜回头客多。", "送餐路上看见晚霞特别好看，停下来拍了张照。今天这单，值了。"],
  "南山白领": ["加班到这个点，楼下猪脚饭都卖完了。打工人的晚饭，主打一个随缘。", "今天的会开得比电视剧还长。散会那一刻，我听见全办公室的肚子都在叫。"],
  "小区保安": ["夜里巡逻，小区安安静静的。谁家灯还亮着，谁就是还没睡的夜猫子——都注意身体啊。", "今天帮三楼奶奶把快递搬上去了，老人家非塞我俩橘子。甜。"],
  "峰会外宾联络员": ["陪外宾逛了一圈，人家对深圳的速度赞不绝口。翻译这行，嘴皮子和体力都得跟上。", "整理了一下午各国代表的资料，21 个经济体，名字都快背下来了。"],
  "夜市摊主": ["今晚出摊，羊肉串卖得比昨天快。老主顾说我这孜然放得对味——秘诀？不告诉你😏", "收摊数钱的时候最幸福。烟火气里讨生活，不丢人。"],
  "职院学生": ["图书馆闭馆音乐响了才发现坐了一整天。考试周，大家一起卷吧。", "今天自习效率奇高，奖励自己一杯奶茶。年轻真好，熬一夜第二天照样生龙活虎。"],
  "保洁阿姨": ["早上把大堂地拖得能照人，心里就舒坦。活儿干干净净，人也清清爽爽。", "今天有人对我说谢谢，就为把电梯口拖干净了。被人看见的感觉，真好。"],
  "地铁通勤族": ["今天那班车居然有座。通勤族的幸福就是这么朴素无华。", "地铁里看见小姑娘给老人让座，这城市再挤，心里也是暖的。"],
  "你的同事": ["评审会又过了，需求终于定下来了。今晚可以准时下班，普天同庆。", "保温杯里的枸杞泡到第三泡了。养生和加班，我选择一起端着。"],
  "隔壁邻居": ["阳台上的葱又窜高了一截，晚上煲汤正好掐一把。日子就是一餐一饭过出来的。", "今天煲了老火汤，香得整层楼都闻得见。过日子，胃暖了心就暖了。"],
  "菜市场摊主": ["今天的菜新鲜，进价还降了点，熟客都跟着沾光。做生意，实在二字值千金。", "早上进货淋了点雨，不过菜卖得好，心里是晴的。"],
  "茶餐厅伙计": ["今日出咗 300 杯奶茶，手都撞到软。熟客一坐低，杯茶已经喺台面——呢啲就系默契。Another day, another 300 milk teas.", "收工去阿妈度饮汤。冲茶冲到返屋企，冲凉都闻到自己阵茶味😂"],
  "中环白领": ["Lunch 一个钟，排队 20 分钟、食 10 分钟、行返公司 10 分钟。呢啲就系中环速度。Central lunch maths: queue 20, eat 10, walk 10.", "今晚兰桂坊有局。放工先系第二场开波，呢啲先叫 Work-life balance 呀？"],
  "的士司机": ["今朝红隧塞到铜锣湾，我转行东隧，个客问我点解咁熟路——开咗三十年车，条条隧道嘅脾气我都摸透。Trust the driver, not the app.", "收工前最后一程去机场，沿途个天靓到呢。做呢行，最过瘾就系成个城市都系你办公室。"],
  "街市菜贩": ["今日啲菜心靓，熟客未开口我已经秤定。今朝电车喺门口过嗰阵，有个游客影咗我张相，话呢啲先系香港。Honest scales, forty years.", "凌晨入货嗰阵落雨，而家出太阳喇。做街市就系咁，同个天一齐开工，一齐收工。"],
  "天星小轮船员": ["今日维港个日落，成船人都喺度哗。HK$5 有找嘅船程，睇到呢个景，抵到烂啦。Best five dollars in the world, I'm telling you.", "开咗几十年船，台风先至停航。维港再忙，船一离岸就静返——呢度系我嘅办公室。"],
  "深水埗邻居": ["今日煲咗老火汤，成层楼都闻到。隔篱屋个后生仔又加班，我留咗碗汤俾佢返嚟饮。Soup's on — neighbours first.", "去咗鸭寮街行阵，买咗个二手风扇。深水埗咩都有，就系租金贵——唉，唔讲呢啲，饮汤先。"],
};
const LIFE_FALLBACK = [
  "今天也是平平淡淡的一天。吃好喝好，明天继续。",
  "下班路上买了束花送自己。日子是自己的，得哄着过。",
  "忙忙碌碌又一天。抬头看看天，云走得比人还慢。",
];
function lifePost(npc: Npc, rng: () => number): string {
  const pool = LIFE_POSTS[npc.job] ?? LIFE_FALLBACK;
  return pick(rng, pool);
}

const COMMENT_SUPPORT = [
  "说得对！", "同感，我今天也是这样。", "这话在理，点赞。", "哈哈，被你说中了。", "加油，日子会越来越好的💪",
];
const COMMENT_TEASE = [
  "哟，这话说的，也不怕风大闪了舌头😏", "就你会说，下次请客的时候也这么能说？", "图呢？没图我不信（狗头）", "行行行，就你过得明白。",
];
const COMMENT_NEUTRAL = [
  "路过，看看。", "嗯，知道了。", "今天确实。", "顶一下，别沉了。", "说得也是。",
];
function commentFor(commenter: Npc, author: Npc, rng: () => number): string {
  const cp = personaOf(commenter);
  const aff = affinity(commenter.name, author.name);
  let pool = COMMENT_NEUTRAL;
  if (aff > 0.25) pool = rng() < 0.75 ? COMMENT_SUPPORT : COMMENT_NEUTRAL;
  else if (aff < -0.3 && cp.humor > 0.4) pool = rng() < 0.6 ? COMMENT_TEASE : COMMENT_NEUTRAL;
  else if (cp.warmth > 0.65) pool = COMMENT_SUPPORT;
  return pick(rng, pool);
}

/** Generate one day of street life: posts + comments + every NPC's mood drift.
 *  Pure function of (day, city, news, previous moods) — same inputs, same wall. */
export function generateDailyPosts(
  ctx: DayContext,
  news: PlayerNews[],
  prevMems: MemMap,
): { posts: NpcPost[]; mems: MemMap } {
  const { day, cityKey } = ctx;
  const rng = mulberry(hashStr(`wall:${cityKey}:${day}`));
  const weather = weatherOf(day, cityKey);
  const cityNpcs = npcsForCity(cityKey);
  const mems: MemMap = {};
  // Mood drift: everyone wakes up with a slightly different mood.
  for (const npc of cityNpcs) {
    const prev = memOf(prevMems, npc.name);
    const drift = Math.round((rng() - 0.46) * 9); // slight positive bias
    const eventBump = news.length > 0 && rng() < 0.3 ? 2 : 0;
    mems[npc.name] = { ...prev, mood: Math.max(-20, Math.min(20, Math.round(prev.mood * 0.6) + drift + eventBump)) };
  }
  const byChat = [...cityNpcs].sort((a, b) => {
    const d = personaOf(b).chattiness - personaOf(a).chattiness;
    return d !== 0 ? d : hashStr(a.name) - hashStr(b.name);
  });
  const posts: NpcPost[] = [];
  const used = new Set<string>();
  const addPost = (npc: Npc, kind: NpcPost["kind"], text: string) => {
    if (used.has(npc.name)) return;
    used.add(npc.name);
    const prng = mulberry(hashStr(`post:${day}:${npc.name}`));
    const commenters = cityNpcs.filter((n) => n.name !== npc.name)
      .sort((a, b) => (affinity(b.name, npc.name) + personaOf(b).chattiness) - (affinity(a.name, npc.name) + personaOf(a).chattiness));
    const nComments = prng() < 0.25 ? 1 : prng() < 0.6 ? 2 : 3;
    const comments: NpcComment[] = [];
    for (const c of commenters.slice(0, 6)) {
      if (comments.length >= nComments) break;
      if (prng() < 0.45) comments.push({ author: c.name, text: commentFor(c, npc, prng) });
    }
    posts.push({
      id: `w${day}-${npc.name}`,
      day, author: npc.name, kind, text, comments,
      likes: 2 + Math.floor(prng() * 13),
    });
  };
  // 1) The player's news gets talked about first — by the people closest to it.
  for (const item of news.slice(0, 2)) {
    const preferred = item.kind === "career" ? cityNpcs.find((n) => n.name === "阿琳") ?? cityNpcs.find((n) => n.name === "阿May")
      : item.kind === "apec" ? cityNpcs.find((n) => n.name === "Lisa")
      : item.kind === "home" ? cityNpcs.find((n) => n.name === "林婶") ?? cityNpcs.find((n) => n.name === "肥妈") ?? cityNpcs.find((n) => n.name === "陈伯") : undefined;
    const author = preferred && !used.has(preferred.name) ? preferred : byChat.find((n) => !used.has(n.name));
    if (author) addPost(author, "player", playerPost(item, personaOf(author), ctx.playerName, rng));
  }
  // 2) Weather — only when it's worth mentioning, or a chatty soul feels like it.
  const wxWorth = weather.includes("雨") || weather.includes("暴雨") || weather.includes("海风");
  if (wxWorth || rng() < 0.35) {
    const author = byChat.find((n) => !used.has(n.name) && personaOf(n).chattiness > 0.35);
    if (author) addPost(author, "weather", weatherPost(personaOf(author), weather, rng));
  }
  // 3) Summit — Shenzhen only talks about its own summit; Huizhou hears echoes.
  if (cityKey === "sz" && (isApecWeek(day) || (day >= 10 && day < 14) || day === 20)) {
    const lisa = cityNpcs.find((n) => n.name === "Lisa");
    const author = lisa && !used.has(lisa.name) && rng() < 0.8 ? lisa : byChat.find((n) => !used.has(n.name));
    if (author) addPost(author, "apec", apecPost(author, personaOf(author), day, rng));
  } else if (cityKey === "hz" && isApecWeek(day) && rng() < 0.5) {
    const author = byChat.find((n) => !used.has(n.name));
    if (author) addPost(author, "apec", pick(rng, [
      "深圳那边 峰会开得热闹，惠州这边酒店都跟着住满了。湾区一家亲，沾光！"
      , "看新闻里深圳的会场，真气派。咱们惠州的日子也别闲着，海边一样有奔头。",
    ]));
  } else if (cityKey === "hk" && isApecWeek(day) && rng() < 0.5) {
    const author = byChat.find((n) => !used.has(n.name));
    if (author) addPost(author, "apec", pick(rng, [
      "深圳开 APEC，西九龙站呢几日多人到爆——内地客落嚟，外国客过嚟开会顺便游香港。高铁一通，两边都系赢家。Busy days at West Kowloon!",
      "新闻话 21 个经济体嘅领袖齐集深圳。香港做咗几十年会展之都睇住：呢啲大场面，隔住个海都觉得光荣。",
    ]));
  }
  // 4) Fill the rest of the wall with everyday life until 4–5 posts.
  const target = 4 + (news.length > 0 ? 1 : 0);
  for (const npc of byChat) {
    if (posts.length >= target) break;
    if (used.has(npc.name)) continue;
    if (personaOf(npc).chattiness < 0.3 && rng() < 0.6) continue;
    addPost(npc, personaOf(npc).hustle > 0.55 ? "work" : "life", lifePost(npc, rng));
  }
  // Wall order: player news first, then the rest shuffled by chattiness draw.
  return { posts, mems };
}

/** The author's reply when the player comments on their post. */
export function authorReply(post: NpcPost, mem: NpcMem, playerText: string, day: number): string | null {
  const npc = NPCS.find((n) => n.name === post.author);
  if (!npc) return null;
  const p = personaOf(npc);
  const rng = mulberry(hashStr(`reply:${post.id}:${day}:${playerText}`));
  if (p.chattiness < 0.25 && rng() < 0.6) return null; // 老周式的人，看见了也未必回
  if (playerText.includes("哈哈")) return pick(rng, ["😂 是吧，我自己写完都乐了", "哈哈，你一笑我就知道这条没白发"]);
  if (playerText.includes("加油")) return pick(rng, ["💪 借你吉言，一起加油", "谢谢！你也一样，日子越过越有奔头"]);
  if (mem.rel >= 35) return pick(rng, ["老朋友捧场，必须给你点个赞👍", "就知道你会来评论，懂我"]);
  if (mem.rel <= -8) return "……嗯，看到了。";
  return pick(rng, ["谢谢捧场～", "👍 说得对", "哈哈，同道中人"]);
}

/* ---------------- chatting with an NPC ---------------- */
export type ChatAction = "greet" | "weather" | "work" | "apec" | "joke" | "help" | "gift";
export const CHAT_PLAYER_LINES: Record<ChatAction, string> = {
  greet: "嗨，最近怎么样？",
  weather: "今天这天儿，你觉得怎么样？",
  work: "最近活儿忙不忙？",
  apec: "峰会这事儿，你怎么看？",
  joke: "跟你讲个笑话：为什么程序员分不清万圣节和圣诞节？因为 Oct 31 == Dec 25。",
  help: "看你忙的，需要搭把手吗？我来帮你。",
  gift: "这个送你，不值钱，就图个乐呵，别嫌弃。",
};
export interface ChatOutcome {
  reply: string;
  relDelta: number;
  note?: string;      // new memory note, if this interaction is worth remembering
  slight?: boolean;   // the NPC took offence
  favour?: boolean;   // the player did them a favour
  giftGiven?: boolean;
}

/** What the NPC says when you simply bump into them — memory first, persona second. */
export function greetLine(npc: Npc, mem: NpcMem, ctx: DayContext): string {
  const p = personaOf(npc);
  if (mem.talks === 0) return npc.line;
  if (mem.rel <= -8) return pick(mulberry(hashStr(`cold:${npc.name}:${ctx.day}`)), [
    "……哦，是你啊。（他明显不太想多聊）",
    "嗯。（他点点头就走开了，看来上次那事儿还没过去）",
  ]);
  if (mem.helps > 0 && mem.note) return pick(mulberry(hashStr(`warm:${npc.name}:${ctx.day}`)), [
    `哟，你来了！上次${mem.note}，我一直记着呢。`,
    `正想找你呢——${mem.note}那事儿，谢了啊。今天${moodWord(mem.mood)}，陪我聊两句？`,
  ]);
  if (mem.rel >= 35) return pick(mulberry(hashStr(`pal:${npc.name}:${ctx.day}`)), [
    "老朋友！可算见着你了，最近忙啥呢？",
    p.humor > 0.55 ? "哎哟，大忙人现身了！今天太阳打西边出来了？" : "你来了。今天过得怎么样？",
  ]);
  if (mem.mood <= -9) return "唉，今天事儿不顺，心里堵得慌。你说吧，我听着呢。";
  if (mem.lastTopic) return `又见面了。上次咱聊${mem.lastTopic}，还挺投机。`;
  return "又见面了，最近怎么样？";
}

const HELP_FLAVOUR: Record<string, string> = {
  "阿强": "帮他把歪了的保温箱扶正、把快倒的车支好",
  "陈伯": "帮他把一箱矿泉水搬进门岗",
  "大芬姐": "帮她把烧烤摊的桌椅摆开、炭火生上",
  "郭叔": "帮他把一筐青菜从三轮车上卸下来",
  "王姨": "帮她把洗地机推上台阶",
  "阿琳": "帮她把评审材料抱到会议室",
  "林婶": "帮她把一袋米拎上楼",
  "子健": "帮他占了图书馆的座位还捎了瓶水",
  "Lisa": "帮她把一摞代表团资料分装成册",
  "老周": "在地铁口帮他扶住了差点被挤掉的公文包",
  "小美": "帮她把掉在路上的工牌捡起来追上去还给她",
  "华哥": "帮他把一箱汽水搬进茶餐厅后栏",
  "阿May": "在港铁站帮她扶住了差点被人群冲散的公文袋",
  "强哥": "在的士站帮他把一箱行李搬上车尾箱",
  "婆婆珍": "帮她把两筐菜从电车路边搬进街市档口",
  "船长辉": "在码头帮他把一捆缆绳拖上船",
  "肥妈": "帮她把一煲汤从楼下拎上楼",
};

export function chatReply(
  npc: Npc, mem: NpcMem, action: ChatAction,
  ctx: DayContext, repeatedToday: boolean,
): ChatOutcome {
  const p = personaOf(npc);
  const rng = mulberry(hashStr(`chat:${npc.name}:${ctx.day}:${action}:${mem.talks}`));
  const mood = mem.mood;
  const cold = mem.rel <= -8;
  /* Hong Kong neighbours answer in Cantonese-flavoured bilingual lines —
     their real stories are Hong Kong stories. */
  if (npc.cities?.includes("hk")) {
    switch (action) {
      case "greet":
        if (repeatedToday) return { reply: "今日倾过啦，你忙你嘅，听日再倾。We've talked today — go live your day.", relDelta: 0 };
        return { reply: pick(rng, [
          "早晨！食咗早餐未？未食嚟我度，一盅两件等紧你。Morning! Breakfast first — that's the Hong Kong rule.",
          "嚟啦嚟啦，坐低饮杯茶先。香港人再忙，都要饮啖茶嘅。",
        ]), relDelta: cold ? 1 : 2 };
      case "weather": {
        const w = weatherOf(ctx.day, ctx.cityKey);
        const rainy = w.includes("雨");
        return { reply: rainy
          ? pick(rng, ["落雨啊，维港都蒙查查。出门带遮，坐船嗰阵企入少少，唔好俾浪花泼湿。Rainy harbour today — mind the spray on the ferry.", "呢啲天气，茶餐厅最旺场。人人都入嚟避雨顺便饮杯茶——落雨都系生意。"])
          : pick(rng, ["今日天清气朗，维港蓝到发光。收工去海旁行下啦，唔好嘥咗佢。A day like this, the harbour does the talking.", "好天到呢……上山顶缆车今日实多人，你要去就趁早。"]), relDelta: 2 };
      }
      case "work":
        return { reply: pick(rng, [
          "忙啊，香港人边个唔忙？但忙得嚟有钱赚，就唔算白忙。Work hard, eat well — that's the deal here.",
          "呢行水深，捱得住就系赢家。你都系，唔好死顶，身体要紧。",
        ]), relDelta: 2 };
      case "apec":
        return { reply: pick(rng, [
          "APEC 喺深圳开，西九龙同口岸呢几日旺到爆。香港做咗咁多年会展之都睇住隔篱开大场——有啲牙骹软，不过高铁半个钟就到，咪当自己屋企开派对啰。",
          "21 个经济体嘅人过晒去深圳开会。香港呢边呢，酒店、的士、茶餐厅个个都接到单——一河两岸，一齐旺场。",
        ]), relDelta: 2 };
      default:
        break; // joke / help / gift fall through to the shared lines
    }
  }
  switch (action) {
    case "greet": {
      if (repeatedToday) return { reply: "咱今天都聊过了，你先忙你的，改天接着聊。", relDelta: 0 };
      return { reply: greetLine(npc, { ...mem, talks: Math.max(1, mem.talks) }, ctx), relDelta: cold ? 1 : 2 };
    }
    case "weather": {
      const w = weatherOf(ctx.day, ctx.cityKey);
      const rainy = w.includes("雨");
      const base = rainy
        ? pick(rng, ["这雨啊，下得人心里都潮了。出门记得带伞，鞋袜多备一双。", "雨天路滑，我今天走路都加了小心。你也慢着点。"])
        : pick(rng, ["天儿不错，就是晒。干活的人，多喝水。", "这种天适合把被子拿出去晒晒，晚上睡着都是太阳味儿。"]);
      return { reply: mood <= -9 ? `唉，${base}……不说这个了，今天诸事不顺。` : base, relDelta: 2 };
    }
    case "work": {
      if (p.hustle > 0.6) return { reply: pick(rng, [
        "忙！但忙着挣钱心里踏实。这行就是这样，多劳多得，不哄人。",
        "活儿多得排队。不过你听我的，忙归忙，饭要吃、觉要睡，身体才是本钱。",
      ]), relDelta: 2 };
      if (p.hustle < 0.35) return { reply: pick(rng, [
        "就那样吧，混口饭吃。活儿是干不完的，心情得自己哄。",
        "忙不忙的，看天吃饭。倒是你，别太拼，钱挣不完的。",
      ]), relDelta: 2 };
      return { reply: pick(rng, [
        "还行，忙一阵闲一阵。你呢？听说你们那行最近也不轻松。",
        "活儿嘛，干一行怨一行，怨完还得接着干。习惯了。",
      ]), relDelta: 2 };
    }
    case "apec": {
      if (npc.name === "Lisa") return { reply: "可别提了，流程表改到第 9 版了。不过 21 个经济体的人齐聚深圳，想想还是挺带劲的——这可是咱普通人离世界最近的一次。", relDelta: 3 };
      if (ctx.cityKey === "hz") return { reply: "深圳开大会，咱们惠州跟着沾光，游客多、生意好。湾区嘛，一头热，另一头也暖和。", relDelta: 2 };
      return { reply: pick(rng, [
        "峰会啊，大场面。咱普通人当志愿者、做会务、开车接送，也算参与了一把。",
        "新闻天天报。与会嘉宾谈他们的，咱把日子过好，也是给这座城长脸。",
      ]), relDelta: 2 };
    }
    case "joke": {
      if (p.humor >= 0.45) return { reply: pick(rng, [
        "哈哈哈哈 Oct 31 等于 Dec 25，你们这行的笑话都得带脑子听！",
        "噗——行，这个笑话我收了，回头讲给我同事听。",
      ]), relDelta: 4 };
      if (p.pride >= 0.6) return {
        reply: "……这笑话，我没听懂，也没觉得好笑。下次别拿我寻开心了。",
        relDelta: -8, slight: true, note: "你讲的笑话他没接住，还有点不高兴",
      };
      return { reply: "哈哈，行吧，算你把我逗乐了（虽然他憋了半天才笑出来）。", relDelta: 3 };
    }
    case "help": {
      const flavour = HELP_FLAVOUR[npc.name] ?? "搭了把手帮他把手头的活儿干了";
      return {
        reply: pick(rng, [
          `哎哟，这怎么好意思——${flavour}，帮大忙了！这份情我记下了。`,
          `正愁一个人弄不完呢，你就来了。${flavour}，谢了！改天请你吃好的。`,
        ]),
        relDelta: 12, favour: true, note: flavour,
      };
    }
    case "gift": {
      if (cold) return { reply: "……东西我收下了。之前的事儿，我慢慢想想吧。（关系缓和了一点）", relDelta: 6, giftGiven: true, note: "你送了他一份小礼物，想把之前的不愉快揭过去" };
      return {
        reply: pick(rng, [
          "哎哟，还给我带东西！你这人，太会来事儿了。收下了收下了，心里热乎乎的。",
          p.warmth > 0.6 ? "这礼物我太喜欢了！你说你，破费什么——不过我是真高兴。" : "嗯，挺好，我收下了。有心了。",
        ]),
        relDelta: 8, giftGiven: true, note: "你送过他一份小礼物，他挺高兴",
      };
    }
  }
}
