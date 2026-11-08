import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { api, type ApiResponse } from "./api";
import {
APPS, CAREERS, CITIES, FOODS, FURNITURE, IDENTITIES, NPCS, npcsForCity, OFFERS, TEMPLATES,
apecPhase, apecVenueMul, getLocations, isApecWeek, isSaturday, tplQuote,
APEC_TASKS, apecTaskOfDay, APEC_SLOGAN, APEC_CERT_NAME,
weatherOf, weekday, modesForCity, railWord, etaMinutes, modeById, SCENIC_SPOTS, scenicOf, taxiFare, busFare, bikeFare, driveFare, parkingFee,
curSym, fmtMoney, crossFareLabel,
findMetroRoute, planRailTrip, allMetroDestinations, linesForLoc, metroLinesForCity, crowdForRide, motoFare,
RESTAURANTS, DELIVERY_PLATFORMS, SHOP_VENUES, LODGINGS, rentFlatWeekly, OUTFITS, outfitOf, isRainy, HOME_ROOMS,
LOC_EN, LOC_GRADE, CITY_INTRO,
type AppId, type CityKey, type Loc, type TransportModeId, type MetroRoute
} from "./data";
import { pickEvent, type GameEvent } from "./events";
import {
generateDailyPosts, authorReply, chatReply, greetLine, memOf, relLabel, moodEmoji, moodWord, personaOf, scheduleOf,
type ChatAction, type MemMap, type NpcPost, type PlayerNews,
} from "./npc";
import { MapView } from "./MapView";
import { MetroMapModal } from "./MetroMap";
import { LifeStage3D, type LifeSet, type LifePose } from "./LifeStage";
import { GUIDE, guideForLocName, tourForCity, type DayTour, type GuidePlace } from "./experience";

/** Unique station names of a city with the lines serving each — the index
    behind the map search box. */
const stationIndexOf = (cityKey: CityKey): { name: string; lines: string[] }[] => {
const m = new Map<string, string[]>();
for (const line of metroLinesForCity(cityKey)) for (const st of line.stations) {
const arr = m.get(st.name) ?? [];
if (!arr.includes(line.short)) arr.push(line.short);
m.set(st.name, arr);
}
return [...m.entries()].map(([name, lines]) => ({ name, lines }));
};

type World = ApiResponse<typeof api, "getWorld">["world"];
type RealWeather = ApiResponse<typeof api, "getRealWeather">;
type Phase = "setup" | "game" | "result";

/* Real-weather presentation: the game's sky and rain follow the city's
   REAL current weather (fetched server-side), not the old per-game-day
   invented table — that table now only fills the in-fiction calendar. */
const RW_EMOJI: Record<RealWeather["kind"], string> = { clear: "☀️", partly: "🌤️", cloudy: "☁️", overcast: "☁️", fog: "🌫️", rain: "🌧️", storm: "⛈️", unknown: "🌡️" };
const RW_LABEL: Record<RealWeather["kind"], string> = { clear: "晴", partly: "多云", cloudy: "多云", overcast: "阴", fog: "雾", rain: "雨", storm: "雷雨", unknown: "实况" };

interface GameState {
cityKey: CityKey;
idenId: string;
day: number;
money: number;
energy: number;
mood: number;
rent: number;
baseRent: number;
goal: number;
earned: number;
rentPaid: number;
workCount: number;
otCount: number;
mealCount: number;
maxMoney: number;
homeStyle: string | null;
furniture: string[];
homeSpent: number;
xp: number;
skill: number;
careerIdx: number;
network: number;
fit: number;
invest: number;
apecCount: number;
apecTasks: string[];
apecCheckins: string[];
seenEvents: string[];
visitedScenic: string[];
/* 真实经历图鉴：一日游进度 + 已打卡解锁的真实地点（老存档缺失时回填） */
album?: string[];
tourKey?: string;
tourIdx?: number;
tourDone?: boolean;
metroRides: number;
outfit: string;
ownedOutfits: string[];
groceries: number;
greeted: string[];
npcMem: MemMap;
npcFeed: NpcPost[];
npcNews: PlayerNews[];
log: { day: number; text: string}[];
finished: boolean;
/* 手游件：每日签到与每日任务（按游戏日记账，老存档缺失时按 0 回填） */
signDay?: number;
dayBase?: { day: number; work: number; meal: number; scenic: number };
dayClaim?: string[];
}

interface Profile {
playerId: string;
name: string;
}

export const LS_KEY = "shhr-pc-save-v1";
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const fmt = (n: number, ck: CityKey = "sz") => fmtMoney(n, ck);
const hexCss = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

function idenOf(gs: GameState) {
return IDENTITIES.find((i) => i.id === gs.idenId)?? IDENTITIES[0]!;
}
function tplByName(name: string | null) {
return TEMPLATES.find((t) => t.name === name)?? null;
}
function furnById(id: string) {
return FURNITURE.find((f) => f.id === id)?? null;
}
function styleMatchCount(gs: GameState): number {
if (!gs.homeStyle) return 0;
return gs.furniture.filter((id) => furnById(id)?.styles.includes(gs.homeStyle!)).length;
}
function computeComfort(gs: GameState): number {
const base = gs.homeStyle? (tplByName(gs.homeStyle)?.comfort?? 30): 12;
let sum = base;
for (const id of gs.furniture) {
const f = furnById(id);
if (f) sum += f.comfort;
}
return sum + styleMatchCount(gs) * 6;
}
function homeMoodBonus(gs: GameState): number {
return Math.floor(computeComfort(gs) / 12) + styleMatchCount(gs) * 3;
}
function homeName(gs: GameState): string {
if (gs.homeStyle) return `精装房 · ${gs.homeStyle}`;
return gs.cityKey === "hz" ? "海边出租屋" : gs.cityKey === "hk" ? "深水埗唐楼" : "城中村出租屋";
}
function newPlayerId(): string {
try {
return crypto.randomUUID();
} catch {
return `p-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}
}

function computeResult(gs: GameState, reason: "done" | "debt") {
const city = CITIES[gs.cityKey];
const iden = idenOf(gs);
let title: string;
let quote: string;
if (reason === "debt" || gs.money < -500) {
title = "被房东请出门";
quote = `“钱没攒下，故事攒了一堆。” 这次${city.name}之旅提前结束了——不是你不行，是房租太准时。下次记得：周六之前，钱包里一定要留够房租。`;
} else if (gs.money >= gs.goal * 1.5) {
title = gs.cityKey === "sz" ? "深圳湾预备业主" : gs.cityKey === "hk" ? "维港看房人" : "海景房候选人";
quote = `别人还在挤地铁，你已经在看房了。这30天你卷得明白、活得清醒——${gs.cityKey === "sz" ? "深圳不相信眼泪，但相信存款。" : gs.cityKey === "hk" ? "维港的灯火里，终于有一扇窗是为你留的。" : "惠州的海，终于有一扇窗是为你留的。"}`;
} else if (gs.money >= gs.goal) {
title = gs.cityKey === "sz" ? "深漂上岸者" : gs.cityKey === "hk" ? "港漂扎根者" : "惠州安家者";
quote = `目标达成！${fmt(gs.money, gs.cityKey)} 是你一天一天、一顿一顿饭省出来、赚出来的。${city.name}没有辜负认真生活的人。`;
} else if (gs.money >= 0) {
title = "平凡生存家";
quote = "没到目标，但你完整地活过了30天，交齐了每一周的房租，吃了每一顿该吃的饭。平凡地活着，本身就很了不起。";
} else {
title = "月光边缘人";
quote = "存款是负的，但人还在、故事还在。下个月少点外卖、少点冲动消费，你完全可以翻盘。";
}
if (iden.id === "rich" && gs.money >= gs.goal) title = "富二代自证成功";
if (iden.id === "flat" && gs.mood >= 80 && gs.money >= 0) title = "真正会躺的人";
if (gs.otCount >= 8) title = "加班战神（慎）";
const badges: string[] = [];
if (gs.workCount >= 15) badges.push("🏅 打工狂魔");
if (gs.otCount >= 5) badges.push("🔥 加班达人");
if (gs.mealCount >= 10) badges.push("🍚 干饭自由");
if (gs.mood >= 70) badges.push("😊 心态大师");
if (gs.careerIdx >= 2) badges.push("📈 升职达人");
if (gs.careerIdx >= 4) badges.push("👑 城市合伙人");
if (gs.network >= 5) badges.push("🤝 人脉渐广");
if (gs.apecCount >= 3) badges.push("🌐 APEC 服务之星");
if ((gs.apecTasks ?? []).length >= APEC_TASKS.length) badges.push(APEC_CERT_NAME);
else if ((gs.apecCheckins ?? []).length >= 3) badges.push("📍 APEC 三会场全打卡");
if (gs.furniture.length >= 3) badges.push("🛋️ 安家小能手");
if (computeComfort(gs) >= 80) badges.push("🏠 舒适小窝");
if ((gs.metroRides ?? 0) >= 5) badges.push(gs.cityKey === "hz" ? "🚆 城轨达人" : gs.cityKey === "hk" ? "🚇 港铁达人" : "🚇 地铁达人");
if ((gs.visitedScenic ?? []).length >= 5) badges.push("📸 风景收藏家");
return { title, quote, badges};
}


/* ---------- 生活动画: short acted scenes for the moments of a day ----------
   Each scene is a few steps on a warm cinematic stage: the character walks
   in with eased motion, props act (typing, steam, chewing, lifting), and
   captions tell the beat. Triggered by the real actions (finishing a rail
   ride, working, eating, cooking, sleeping…) and by the 今日生活 replay. */
type LifeKind = "day" | "alightRail" | "crossing" | "metro" | "code" | "overtime" | "eat" | "cook" | "sleep" | "wash" | "groceries" | "shopping" | "gym" | "stroll" | "gathering";
interface LifeStep { bg: string; prop: string; caption: string; sub: string; move?: "walk" | "stay"; fx?: "type" | "steam" | "zzz" | "rain" | "chew" | "lift" | "shine"; dawn?: boolean; }
interface LifeScene { title: string; tone?: "night" | "indoor"; steps: LifeStep[]; }
const LIFE_SCENES: Record<LifeKind, LifeScene> = {
day: { title: "今日生活 · 从清晨到夜里", steps: [
  { bg: "🏠 🪟 🌅", prop: "🪥", caption: "清晨，闹钟响了", sub: "起床、刷牙、洗脸，镜子里的自己慢慢精神起来", move: "stay", fx: "shine" },
  { bg: "🏠 👕 🪞", prop: "👔", caption: "换上正装出门", sub: "上班穿正装，临出门照了照镜子——今天也要体面", move: "stay" },
  { bg: "🚄 🏙️ 🌤️", prop: "🚄", caption: "高铁到站，下车", sub: "车门打开，拎着包走下站台，跟着人流往出站口走", move: "walk" },
  { bg: "🚇 👥 👥", prop: "🚇", caption: "换乘地铁", sub: "刷卡进闸，早高峰的车厢挤满了人，扶稳站好", move: "walk" },
  { bg: "🏢 💻 👩‍💻", prop: "💻", caption: "到公司，坐下敲代码", sub: "打开电脑，键盘声噼里啪啦，需求一个一个被推平", move: "stay", fx: "type" },
  { bg: "🍜 🏮 👥", prop: "🍜", caption: "中午去吃饭", sub: "楼下食街来一碗热的，吃饱了才有力气过日子", move: "stay", fx: "chew" },
  { bg: "🥬 🧺 🌇", prop: "🥬", caption: "下班绕去买菜", sub: "挑了青菜、鸡蛋和一块肉，拎着慢慢走回家", move: "walk" },
  { bg: "🍳 🏠 💡", prop: "🍳", caption: "回家做饭", sub: "洗菜、切菜、下锅——蒸汽和香气一起升起来", move: "stay", fx: "steam" },
  { bg: "🛏️ 🌙 🏠", prop: "🛏️", caption: "洗漱完，躺下睡觉", sub: "灯关了。今天过得很满，明天继续好好过日子", move: "stay", fx: "zzz" },
] },
alightRail: { title: "下高铁", steps: [
  { bg: "🚄 🏙️", prop: "🚄", caption: "列车缓缓进站", sub: "广播响起：前方到站，请拿好随身行李", move: "stay" },
  { bg: "🚪 🧳 👥", prop: "🧳", caption: "车门打开，下车", sub: "拎着包走下站台，脚踏实地的感觉真好", move: "walk" },
  { bg: "🏙️ ☀️ 🚇", prop: "🎫", caption: "刷卡出站", sub: "跟着人流走出站厅，城市的热气扑面而来", move: "walk" },
] },
crossing: { title: "过关 · 深港之间", steps: [
  { bg: "🛃 👥 🧳", prop: "🪪", caption: "排队过关，先出示证件", sub: "口岸大堂人流如织：把回乡证 / 港澳通行证拿在手里，跟着队伍慢慢往前挪", move: "stay" },
  { bg: "🛂 🧳 🔍", prop: "🧳", caption: "安检 + 出入境检查", sub: "行李过机、人过闸口，证件一刷——内地的章和香港的入境记录，一次过完成", move: "walk" },
  { bg: "🇭🇰 🏙️ 🚇", prop: "🎫", caption: "过关成功，入城", sub: "走出大堂，空气里的语言都变了：广播先讲广东话，再讲普通话，最后是英文", move: "walk" },
] },
metro: { title: "坐地铁", steps: [
  { bg: "🚇 💺 👥", prop: "💺", caption: "坐进车厢", sub: "找个座位坐下，扶好扶手——车厢晃着往前开，窗外的城市一段段往后跑", move: "stay" },
  { bg: "🚇 👥 👥", prop: "🚇", caption: "到站下车", sub: "车门打开，先下后上，跟着人流往外走", move: "walk" },
  { bg: "🏙️ ☀️", prop: "🎫", caption: "刷卡出闸", sub: "出站口的风一吹，新的一段路开始了", move: "walk" },
] },
code: { title: "去公司 · 敲代码", tone: "indoor", steps: [
  { bg: "🏢 🪪 👩‍💻", prop: "🪪", caption: "刷卡进公司", sub: "闸机滴的一声，和同事阿琳打了个招呼", move: "walk" },
  { bg: "💻 🪑 📋", prop: "💻", caption: "坐下，打开电脑", sub: "工位上的保温杯还温着，先看一眼今天的需求列表", move: "stay" },
  { bg: "⌨️ 💻 🖥️", prop: "⌨️", caption: "敲代码", sub: "键盘声噼里啪啦，思路顺的时候时间过得飞快", move: "stay", fx: "type" },
  { bg: "✅ ☕ 🧍", prop: "☕", caption: "提交，起身接杯水", sub: "代码推上去了，肩膀终于松下来", move: "stay", fx: "shine" },
] },
overtime: { title: "加班的夜晚", tone: "night", steps: [
  { bg: "🏢 🌃 💡", prop: "💻", caption: "办公室只剩几盏灯", sub: "窗外是整座城的灯火，屏幕上是没改完的 bug", move: "stay", fx: "type" },
  { bg: "⌨️ ☕ 🌙", prop: "⌨️", caption: "再敲最后一行", sub: "咖啡见底了，代码终于跑通——保存，关机", move: "stay", fx: "type" },
  { bg: "🚪 🌙 🧍", prop: "🌙", caption: "走出大楼", sub: "夜里风凉，心里默念：钱是赚到了，人也要好好休息", move: "walk" },
] },
eat: { title: "夜市吃面", tone: "night", steps: [
  { bg: "🏮 🍜 👥", prop: "🍜", caption: "走到面摊前", sub: "夜市的灯串亮着，大排档的招牌下人声鼎沸——老规矩，先找个折叠桌坐下", move: "walk" },
  { bg: "🍜 🔥 💨", prop: "🍜", caption: "面端上来了", sub: "摊主的大锅还冒着热气，一碗面浇上卤汁端到面前，先闻一闻——就是这个味儿", move: "stay", fx: "steam" },
  { bg: "🥢 🍜 😋", prop: "🥢", caption: "挑起面，开吃", sub: "筷子挑起一大口，吸溜吸溜——夜市的面，吃的是热气和人气", move: "stay", fx: "chew" },
] },
cook: { title: "回家做饭", tone: "indoor", steps: [
  { bg: "🚰 🥬 🍅", prop: "🥬", caption: "洗菜", sub: "青菜在水里过三遍，鸡蛋磕进碗里搅匀", move: "stay", fx: "shine" },
  { bg: "🔪 🥕 🧄", prop: "🔪", caption: "切菜备料", sub: "刀落在案板上笃笃响，备菜整齐码好", move: "stay" },
  { bg: "🍳 🔥 🧂", prop: "🍳", caption: "下锅翻炒", sub: "油热下锅，蒸汽和香气一起升起来，隔壁都闻得到", move: "stay", fx: "steam" },
  { bg: "🍽️ 🍚 🏠", prop: "🍽️", caption: "上桌，开饭", sub: "自己做的饭，坐在自己的餐桌前慢慢吃", move: "stay", fx: "chew" },
] },
sleep: { title: "睡觉 · 到天亮", tone: "night", steps: [
  { bg: "🚿 🪥 🏠", prop: "🪥", caption: "洗漱", sub: "冲个热水澡，刷牙洗脸，一天的灰都洗掉", move: "stay", fx: "shine" },
  { bg: "🩳 🛏️ 💡", prop: "🛏️", caption: "换上睡衣，躺下", sub: "被子拉好，手机放远，灯关了", move: "stay" },
  { bg: "🌙 ⭐ 🛏️", prop: "😴", caption: "睡着了", sub: "呼吸慢慢平稳，闹钟在床头安安静静地等着天亮", move: "stay", fx: "zzz" },
  { bg: "🌅 🛏️ 🧍", prop: "🌅", caption: "天亮了，伸个懒腰醒来", sub: "晨光透过窗帘洒进来——伸个大大的懒腰，新的一天开始了", move: "stay", fx: "shine", dawn: true },
] },
wash: { title: "起床洗漱", tone: "indoor", steps: [
  { bg: "⏰ 🛏️ 🌅", prop: "⏰", caption: "闹钟响了，起床", sub: "伸个懒腰，新的一天从掀开被子开始", move: "stay", fx: "shine" },
  { bg: "🪥 🚿 🪞", prop: "🪥", caption: "刷牙洗脸", sub: "卫生间里水声哗哗，镜子蒙上一层水汽", move: "stay", fx: "shine" },
  { bg: "👕 🪞 ☀️", prop: "👕", caption: "换好衣服，精神了", sub: "照照镜子——可以出门了", move: "stay" },
] },
groceries: { title: "去买菜", steps: [
  { bg: "🥬 🍅 🧺", prop: "🥬", caption: "在菜摊前挑挑拣拣", sub: "郭叔的摊子菜新鲜，青菜、番茄、鸡蛋一样样看", move: "walk" },
  { bg: "⚖️ 🥩 👛", prop: "🥩", caption: "称好，付钱", sub: "摊主多塞了把葱：拿去，炒鸡蛋香", move: "stay", fx: "shine" },
  { bg: "🧺 🏠 🌇", prop: "🧺", caption: "拎着菜回家", sub: "满满一篮子，今晚的饭有着落了", move: "walk" },
] },
shopping: { title: "逛街", steps: [
  { bg: "🛍️ 🏬 👥", prop: "🏬", caption: "走进商场", sub: "灯光明亮，橱窗一家比一家好看", move: "walk" },
  { bg: "👕 🪞 👟", prop: "👕", caption: "试穿比划", sub: "在镜子前转一圈，这件还真合身", move: "stay", fx: "shine" },
  { bg: "🛍️ 😊 🌆", prop: "🛍️", caption: "拎着袋子出来", sub: "逛街的快乐，一半在买，一半在逛", move: "walk" },
] },
gym: { title: "健身", tone: "indoor", steps: [
  { bg: "🏃 🧘 🏋️", prop: "🏃", caption: "热身", sub: "换上运动装，活动开筋骨", move: "stay" },
  { bg: "🏋️ 💪 🔥", prop: "🏋️", caption: "认真练一组", sub: "一下，一下，出汗的感觉很实在", move: "stay", fx: "lift" },
  { bg: "🧘 💦 😌", prop: "🧘", caption: "拉伸放松", sub: "练完神清气爽，明天肌肉会酸，但人是轻的", move: "stay", fx: "shine" },
] },
stroll: { title: "散步", steps: [
  { bg: "🌳 🚶 🌤️", prop: "🚶", caption: "慢慢走", sub: "不赶时间，沿着树荫和水边走", move: "walk" },
  { bg: "🌅 🪑 🌊", prop: "🌅", caption: "坐下来看看风景", sub: "风把一天的疲惫吹散了不少", move: "stay", fx: "shine" },
] },
gathering: { title: "朋友聚餐", tone: "indoor", steps: [
  { bg: "🍻 👥 🎤", prop: "🍻", caption: "朋友们到齐了", sub: "拼桌坐下，先碰一杯，聊聊最近怎么样", move: "stay", fx: "shine" },
  { bg: "🍲 🥢 😂", prop: "🍲", caption: "边吃边聊", sub: "菜一盘盘上，笑声一阵阵——人脉就是这样攒下的", move: "stay", fx: "chew" },
] },
};

function lifeStageFor(kind: LifeKind, idx: number): { set: LifeSet; pose: LifePose } {
switch (kind) {
case "day": return ([{ set: "bathroom", pose: "wash" }, { set: "home", pose: "idle" }, { set: "station", pose: "walk" }, { set: "metro", pose: "walk" }, { set: "office", pose: "type" }, { set: "restaurant", pose: "eat" }, { set: "market", pose: "walk" }, { set: "kitchen", pose: "cook" }, { set: "bedroom", pose: "sleep" }] as { set: LifeSet; pose: LifePose }[])[idx] ?? { set: "home", pose: "idle" };
case "alightRail": return { set: "station", pose: idx === 0 ? "idle" : "walk" };
case "crossing": return idx === 0 ? { set: "concourse", pose: "idle" } : idx === 1 ? { set: "concourse", pose: "walk" } : { set: "station", pose: "walk" };
case "metro": return idx === 0 ? { set: "metro", pose: "sit" } : idx === 1 ? { set: "metro", pose: "walk" } : { set: "concourse", pose: "walk" };
case "code": return { set: "office", pose: idx === 0 ? "walk" : idx === 3 ? "idle" : "type" };
case "overtime": return { set: "office", pose: idx === 2 ? "walk" : "type" };
case "eat": return { set: "market", pose: idx === 0 ? "walk" : "eat" };
case "cook": return { set: "kitchen", pose: idx === 3 ? "eat" : "cook" };
case "sleep": return idx === 0 ? { set: "bathroom", pose: "wash" } : idx === 1 ? { set: "bedroom", pose: "idle" } : idx === 2 ? { set: "bedroom", pose: "sleep" } : { set: "bedroom", pose: "stretch" };
case "wash": return idx === 0 ? { set: "bedroom", pose: "stretch" } : { set: "bathroom", pose: "wash" };
case "groceries": return { set: "market", pose: idx === 1 ? "idle" : "walk" };
case "shopping": return { set: "mall", pose: idx === 1 ? "idle" : "walk" };
case "gym": return { set: "gym", pose: idx === 1 ? "lift" : "idle" };
case "stroll": return { set: "park", pose: idx === 0 ? "walk" : "idle" };
case "gathering": return { set: "restaurant", pose: "eat" };
}
}

/* Collapsible group used to layer the right-hand panel (and any dense
   block): a clear header row with a summary, content only when opened.
   `groupKey` resets the open state when the context (e.g. the selected
   place) changes, so each place starts from the same layered layout. */
/* 「真实经历」卡：弹出的经历锚在真实地点上——实拍照片轮播 + 真实信息
   （地址/价格/时间/贴士，带来源）+ 城市知识（中英双语）+ NPC 带路讲的
   真实故事；下面的地点行动就是这张卡的互动选择。到场打卡把它收进图鉴。 */
function ExperienceCard({ g, here, unlocked, onCheckin }: { g: GuidePlace; here: boolean; unlocked: boolean; onCheckin: () => void }) {
const [pi, setPi] = useState(0);
const photos = g.photos;
const idx = Math.min(pi, photos.length - 1);
const photo = photos[idx] ?? photos[0]!;
return (
<div className="mt-3 overflow-hidden rounded-[14px] border-2 border-[var(--border)] bg-[var(--surface)]">
<div className="relative">
<img src={photo} alt={`${g.locName}实拍照片`} className="h-44 w-full object-cover" />
{photos.length > 1 && (
<>
<button type="button" aria-label="上一张实拍照片" onClick={() => setPi((idx + photos.length - 1) % photos.length)} className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-base font-black text-white">‹</button>
<button type="button" aria-label="下一张实拍照片" onClick={() => setPi((idx + 1) % photos.length)} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-base font-black text-white">›</button>
<span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-black text-white">{idx + 1}/{photos.length}</span>
</>
)}
<span className="absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-black tracking-wide text-white">📷 真实经历 · 实拍 {g.nameEn}</span>
</div>
<div className="p-3">
<p className="text-xs leading-relaxed"><span className="font-black">📍 地址 </span>{g.address}</p>
<p className="mt-1 text-xs leading-relaxed"><span className="font-black">🎫 价格 </span>{g.price}<span className="mx-1.5 text-[var(--dim)]">·</span><span className="font-black">🕘 时间 </span>{g.hours}</p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">💡 {g.tip}</p>
<p className="mt-2 rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-xs leading-relaxed">🧭 <b>城市知识：</b>{g.fact}<span className="mt-0.5 block text-[11px] italic text-[var(--dim)]">{g.factEn}</span></p>
<p className="mt-2 text-xs leading-relaxed">🗣️ <b>{g.npc}带路：</b>{g.story}</p>
<div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
<a href={g.sourceUrl} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-[var(--accent2)] underline">资料来源：{g.sourceName}</a>
{unlocked ? <span className="chip" style={{ borderColor: "var(--green)", color: "var(--green)" }}>✓ 已收进图鉴</span> : (
<button type="button" disabled={!here} aria-label={`在${g.locName}打卡解锁图鉴`} onClick={onCheckin} className="rounded-full bg-[var(--text)] px-3.5 py-1.5 text-[11px] font-black text-[var(--bg)] disabled:opacity-45">{here ? "📸 打卡收进图鉴" : "到了这里才能打卡"}</button>
)}
</div>
</div>
</div>
);
}

function Fold({ title, summary, defaultOpen = false, groupKey, children, tone }: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  groupKey?: string;
  children: ReactNode;
  tone?: "gold" | "plain";
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { setOpen(defaultOpen); }, [groupKey, defaultOpen]);
  return (
    <div className={`mt-3 overflow-hidden rounded-[14px] border ${tone === "gold" ? "border-[var(--gold)] bg-[#fdf6da]/60" : "border-[var(--line)] bg-[var(--surface)]"}`}>
      <button
        type="button"
        aria-label={open ? `收起${title}` : `展开${title}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-black leading-tight">{title}</span>
          {summary && <span className="mt-0.5 block break-words text-[11px] font-bold leading-snug text-[var(--dim)]">{summary}</span>}
        </span>
        <span className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-black">{open ? "收起 ▴" : "展开 ▾"}</span>
      </button>
      {open && <div className="border-t border-[var(--line)] px-3 pb-3 pt-2">{children}</div>}
    </div>
  );
}

export function App() {
const queryClient = useQueryClient();
const [phase, setPhase] = useState<Phase>("setup");
const [profile, setProfile] = useState<Profile | null>(null);
const [gs, setGs] = useState<GameState | null>(null);
const gsRef = useRef<GameState | null>(null);
const profileRef = useRef<Profile | null>(null);
const [currentLoc, setCurrentLoc] = useState("home");
const [selectedLoc, setSelectedLoc] = useState("home");
const [walking, setWalking] = useState(false);
const [travelMode, setTravelMode] = useState<TransportModeId>("walk");
interface CarriageRide { route: MetroRoute; fromLoc: string; toLoc: string; stopIdx: number; legIdx: number; awaitingTransfer: boolean; crowdLabel: string; crowdDesc: string; crowdLevel: number; seated: boolean; gaveSeat: boolean; phoneUsed: boolean; heldRail: boolean; }

/** The acted-out start of every metro ride: walk into the concourse, pass
    security, wait on the platform, board when the doors open. */
const ENTRY_STEPS: { set: LifeSet; pose: LifePose; caption: string; sub: string }[] = [
{ set: "concourse", pose: "walk", caption: "进站", sub: "刷码过闸机，走进站厅，两边就是地铁商城——先过安检" },
{ set: "concourse", pose: "idle", caption: "安检", sub: "包放进安检机，人走过安检门，滴一声——通过" },
{ set: "platform", pose: "idle", caption: "站台等车", sub: "站在屏蔽门前等车。广播：列车即将进站，请站在黄线后" },
{ set: "platform", pose: "walk", caption: "车门打开，上车", sub: "屏蔽门和车门一起打开——先下后上，你侧身进了车厢" },
];
const [carriage, setCarriage] = useState<CarriageRide | null>(null);
const [carriageLog, setCarriageLog] = useState<string>("");
/** 公交/打车的搭乘电影动画：和地铁车厢一样是弹出的活动场景
    （等车→上车→坐进车厢看窗外风景→到站下车）。每趟车都演，不管远近；
    四步按这趟行程的实际时长等分推进（每步 = 行程时长 ÷ 4），
    行程到点时若最后一步还没演满它那一份，弹窗等它演完再收起——
    绝不中途掐断。durMs 是这趟行程的地图移动时长，startedAt 是开演时刻。 */
const [roadRide, setRoadRide] = useState<{ mode: "bus" | "taxi" | "drive"; fromName: string; toName: string; fare: number; durMs: number; startedAt: number } | null>(null);
const [roadRideStep, setRoadRideStep] = useState(0);
/** 行程本身已到站（walk 定时器到点）：人物和结算照常落地，只是弹窗
    还在等最后一步演完；演完由下面的 effect 统一收起。 */
const [roadRideArrived, setRoadRideArrived] = useState(false);
useEffect(() => {
if (!roadRide || roadRideStep >= 3) return;
const stepMs = Math.max(120, roadRide.durMs / 4);
const elapsed = Date.now() - roadRide.startedAt;
const remain = Math.max(30, stepMs * (roadRideStep + 1) - elapsed);
const tm = window.setTimeout(() => setRoadRideStep((v) => Math.min(3, v + 1)), remain);
return () => window.clearTimeout(tm);
}, [roadRide, roadRideStep]);
useEffect(() => {
if (!roadRide || !roadRideArrived) return;
if (roadRideStep >= 3 && Date.now() - roadRide.startedAt >= roadRide.durMs) {
setRoadRide(null);
setRoadRideArrived(false);
}
}, [roadRide, roadRideArrived, roadRideStep]);
const [rideEntry, setRideEntry] = useState<number | null>(null);
const [mapQuery, setMapQuery] = useState("");
const [mapFocus, setMapFocus] = useState<{ locId: string; nonce: number } | null>(null);
const [metroMapOpen, setMetroMapOpen] = useState(false);
const [navOpen, setNavOpen] = useState(false);
const [metroMapDest, setMetroMapDest] = useState<string | null>(null);
type VenueScene = { kind: "dine" | "shop" | "stay"; id: string };
const [venueScene, setVenueScene] = useState<VenueScene | null>(null);
const [sceneFlags, setSceneFlags] = useState<Record<string, boolean>>({});
const walkTimer = useRef<number | null>(null);
const pendingSleep = useRef(false);
const pendingRide = useRef<string | null>(null);
/** Final walking leg of a staged rail trip: after the ride ends at the
    station nearest the destination, walk the rest of the way there. */
const pendingAfterRide = useRef<string | null>(null);
/** Latest walkTo, for callbacks (life-anim `after`) that fire from a stale
    render closure where walkTo's own walking/carriage guards are outdated. */
const walkToRef = useRef<((locId: string, modeOverride?: TransportModeId) => void) | null>(null);
const [toast, setToast] = useState<string | null>(null);
const [activeEvent, setActiveEvent] = useState<GameEvent | null>(null);
const [phoneApp, setPhoneApp] = useState<AppId | null>(null);
const [phoneOpen, setPhoneOpen] = useState(false);
const [asideTab, setAsideTab] = useState<"place" | "feed" | "wall" | "chat" | "board" | "guide">("place");
const [quiz, setQuiz] = useState<{ key: string; opts: string[]; picked: string | null } | null>(null);
const [asideOpen, setAsideOpen] = useState(true);
/* Top-area compaction: status detail / APEC activity / city intro all
   start folded away behind one-line bars so the map stays the hero. */
const [hudOpen, setHudOpen] = useState(false);
const [apecOpen, setApecOpen] = useState(false);
const [introOpen, setIntroOpen] = useState(false);
/* Whole-bar collapse: each of the three floating bars folds away
   VERTICALLY into the rail of small buttons down the screen's left edge
   （状态 / APEC / 深圳/惠州）, freeing more of the map; tapping a rail
   button brings its bar back. All shown by default. */
const [barHidden, setBarHidden] = useState<{ hud: boolean; apec: boolean; intro: boolean }>({ hud: false, apec: false, intro: false });
/* Map fullscreen: the map shell becomes a fixed full-viewport stage
   (plus the native Fullscreen API when the browser allows it). */
const [mapFullscreen, setMapFullscreen] = useState(false);
const mapShellRef = useRef<HTMLDivElement | null>(null);
useEffect(() => {
  const onFs = () => { if (!document.fullscreenElement) setMapFullscreen(false); };
  document.addEventListener("fullscreenchange", onFs);
  return () => document.removeEventListener("fullscreenchange", onFs);
}, []);
useEffect(() => {
  if (!mapFullscreen) return;
  const prev = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMapFullscreen(false); };
  window.addEventListener("keydown", onKey);
  return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
}, [mapFullscreen]);
const toggleMapFullscreen = () => {
  if (mapFullscreen) {
    setMapFullscreen(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  } else {
    setMapFullscreen(true);
    const el = mapShellRef.current;
    if (el && el.requestFullscreen) void el.requestFullscreen().catch(() => {});
  }
};
/* ---- 手游件：弹幕 / 奖励飘字 / 每日任务弹窗 / 升职特效 ----
   弹幕借鉴直播间：联机动态、城市聊天、街坊发言飘过地图；APEC 上岗、
   打卡成功、升职这些时刻由街坊弹幕刷屏庆祝。可在地图左中开关。 */
const [danmakuOn, setDanmakuOn] = useState(true);
const [danmaku, setDanmaku] = useState<{ id: number; text: string; top: number; dur: number; color: string }[]>([]);
const danmakuIdRef = useRef(0);
const danmakuOnRef = useRef(true);
danmakuOnRef.current = danmakuOn;
const pushDanmaku = (text: string) => {
if (!danmakuOnRef.current) return;
const id = ++danmakuIdRef.current;
const colors = ["#ffffff", "#ffd34d", "#7ef0c9", "#ffb3c7", "#a8d8ff"];
const item = { id, text: text.slice(0, 46), top: 4 + Math.random() * 34, dur: 8 + Math.random() * 5, color: colors[id % colors.length]! };
setDanmaku((arr) => [...arr.slice(-13), item]);
window.setTimeout(() => setDanmaku((arr) => arr.filter((d) => d.id !== id)), item.dur * 1000 + 400);
};
const pushDanmakuRef = useRef(pushDanmaku);
pushDanmakuRef.current = pushDanmaku;
const burstDanmaku = (lines: string[]) => {
lines.forEach((t, i) => window.setTimeout(() => pushDanmakuRef.current(t), i * 300));
};
const [floaters, setFloaters] = useState<{ id: number; text: string; tone: "gold" | "green" | "red" | "blue" }[]>([]);
const floatIdRef = useRef(0);
const floatReward = (text: string, tone: "gold" | "green" | "red" | "blue" = "gold") => {
const id = ++floatIdRef.current;
setFloaters((arr) => [...arr.slice(-4), { id, text, tone }]);
window.setTimeout(() => setFloaters((arr) => arr.filter((f) => f.id !== id)), 2000);
};
const [levelFx, setLevelFx] = useState<{ name: string; nonce: number } | null>(null);
const [dailyOpen, setDailyOpen] = useState(false);
const dailyShownRef = useRef(0);
const [chatInput, setChatInput] = useState("");
const [result, setResult] = useState<ReturnType<typeof computeResult> | null>(null);
const [lifeAnim, setLifeAnim] = useState<{ kind: LifeKind; idx: number } | null>(null);
const lifeAfterRef = useRef<(() => void) | null>(null);
/* NPC simulation: who you're chatting with + the running conversation */
const [npcChat, setNpcChat] = useState<string | null>(null);
const [npcLog, setNpcLog] = useState<{ from: "me" | "npc"; text: string }[]>([]);
const [setupName, setSetupName] = useState("");
const [setupCity, setSetupCity] = useState<CityKey>("sz");
const [setupIden, setSetupIden] = useState(IDENTITIES[0]!.id);
const finishedSent = useRef(false);
const toastTimer = useRef<number | null>(null);

/* Display currency follows the city you are standing in — Hong Kong
   prices everything in HK$, Shenzhen/Huizhou in ¥. This `fmt` shadows
   the module-level one so every amount rendered or logged inside the
   game (balance, pay, rent, food, fares, other players' board rows
   aside) uses the current city's currency; on the setup screen it
   follows the city being picked (identity money, daily pay, the rules
   line), so picking 香港 shows HK$ from the very first screen. The one
   deliberate exception is a cross-border fare, which is labelled in
   the DEPARTURE city's currency via crossFareLabel. `Y` is the bare
   symbol for strings that build their own number formatting, and
   locText re-denominates fixed copy (random-event text authored with
   ¥) when the player is in Hong Kong. */
const fmt = (n: number, ck?: CityKey) => fmtMoney(n, ck ?? gsRef.current?.cityKey ?? setupCity);
const Y = curSym(gs?.cityKey ?? setupCity);
const locText = (t: string, ck?: CityKey) => ((ck ?? gsRef.current?.cityKey) === "hk" ? t.replaceAll("¥", "HK$") : t);

const cityKey: CityKey = gs?.cityKey?? "sz";
const worldQuery = useQuery({
queryKey: ["world", cityKey],
queryFn: () => api.getWorld({ cityKey}),
refetchInterval: phase === "game"? 5000: 15000,
});
const world: World | undefined = worldQuery.data?.world;

/* Real weather for the city being played: drives the HUD readout, the
   raincoat prompts, the wet-weather travel penalty and the 3D sky. */
const weatherQuery = useQuery({
queryKey: ["real-weather", cityKey],
queryFn: () => api.getRealWeather({ cityKey }),
refetchInterval: 30 * 60_000,
enabled: phase === "game",
});
const realWeather: RealWeather | undefined = weatherQuery.data;
const rwOk = !!realWeather?.ok;
const nowRainy = rwOk ? realWeather!.kind === "rain" || realWeather!.kind === "storm" : isRainy(weatherOf(gs?.day ?? 1, cityKey));
const nowWeatherText = rwOk
? `${RW_EMOJI[realWeather!.kind]} ${realWeather!.description || RW_LABEL[realWeather!.kind]}${realWeather!.temperature != null ? ` ${Math.round(realWeather!.temperature)}°` : ""} · 实况`
: weatherOf(gs?.day ?? 1, cityKey);

/* 弹幕数据源：全城动态和城市聊天里的新消息飘过地图（自己的不飘） */
const lastFeedIdRef = useRef(0);
const lastChatIdRef = useRef(0);
useEffect(() => {
if (phase !== "game" || !world) return;
const feed = world.feed ?? [];
const maxFeed = feed.reduce((m, f) => Math.max(m, f.id), 0);
if (lastFeedIdRef.current === 0) { lastFeedIdRef.current = maxFeed; }
else {
feed.filter((f) => f.id > lastFeedIdRef.current).slice(0, 3).forEach((f, i) => {
window.setTimeout(() => pushDanmakuRef.current(`${f.playerName} ${f.text}`), i * 500);
});
lastFeedIdRef.current = Math.max(lastFeedIdRef.current, maxFeed);
}
const chat = world.chat ?? [];
const maxChat = chat.reduce((m, c) => Math.max(m, c.id), 0);
if (lastChatIdRef.current === 0) { lastChatIdRef.current = maxChat; }
else {
chat.filter((c) => c.id > lastChatIdRef.current && c.playerId !== profileRef.current?.playerId).slice(0, 2).forEach((c, i) => {
window.setTimeout(() => pushDanmakuRef.current(`💬 ${c.playerName}：${c.body}`), 800 + i * 600);
});
lastChatIdRef.current = Math.max(lastChatIdRef.current, maxChat);
}
}, [world, phase]);

/* 每日任务弹窗：进游戏和睡醒到新一天时各弹一次（手游的每日上线仪式） */
useEffect(() => {
if (phase !== "game" || !gs) return;
if (dailyShownRef.current !== gs.day) {
dailyShownRef.current = gs.day;
setDailyOpen(true);
const posts = (gs.npcFeed ?? []).slice(0, 2);
posts.forEach((p, i) => window.setTimeout(() => pushDanmakuRef.current(`${p.author}：${p.text}`), 1200 + i * 900));
}
}, [phase, gs?.day]);

const showToast = (msg: string) => {
setToast(msg);
if (toastTimer.current) window.clearTimeout(toastTimer.current);
toastTimer.current = window.setTimeout(() => setToast(null), 3400);
};

/* ---- 真实经历：图鉴打卡 / 一日游 / 看图认地方 ---- */
const checkinGuide = (g: GuidePlace) => {
let count = 0;
mutate((d) => {
if (!(d.album ?? []).includes(g.key)) d.album = [...(d.album ?? []), g.key];
count = (d.album ?? []).length;
d.mood = clamp(d.mood + 8, 0, 100);
d.log = [{ day: d.day, text: `📖 在${g.locName}打卡，收进城市图鉴（${count}/${GUIDE.length}）` }, ...d.log].slice(0, 40);
});
showToast(`📸 ${g.locName} 已收进图鉴！解锁 ${count}/${GUIDE.length} 处真实地点`);
postFeed("life", `在${g.locName}打卡，解锁了图鉴里的实拍和城市故事`);
};
const restartTour = (tour: DayTour) => {
mutate((d) => { d.tourKey = tour.id; d.tourIdx = 0; d.tourDone = false; });
showToast(`🧭 「${tour.name}」出发！第一站：${tour.stops[0]}`);
};
const nextQuiz = () => {
const target = GUIDE[Math.floor(Math.random() * GUIDE.length)]!;
const others = GUIDE.filter((g) => g.key !== target.key).sort(() => Math.random() - 0.5).slice(0, 3);
const opts = [target.locName, ...others.map((g) => g.locName)].sort(() => Math.random() - 0.5);
setQuiz({ key: target.key, opts, picked: null });
};
const answerQuiz = (name: string) => {
if (!quiz || quiz.picked) return;
const target = GUIDE.find((g) => g.key === quiz.key);
setQuiz({ ...quiz, picked: name });
if (target && name === target.locName) {
mutate((d) => { d.money += 10; d.maxMoney = Math.max(d.maxMoney, d.money); });
showToast(`🎉 认对了！+${fmt(10)} —— 这张实拍你记住了`);
}
};
/* 一日游：按顺序到达每一站自动结算（换城市时按当前城市的路线算） */
useEffect(() => {
if (phase !== "game") return;
const s = gsRef.current;
if (!s || s.tourDone) return;
const tour = tourForCity(s.cityKey);
const active = s.tourKey === tour.id;
const idx = active ? (s.tourIdx ?? 0) : 0;
const stopName = tour.stops[idx];
if (!stopName) return;
if (locById(currentLoc).name !== stopName) return;
const isLast = idx >= tour.stops.length - 1;
mutate((d) => {
d.tourKey = tour.id;
d.money += isLast ? tour.rewardPerStop + tour.rewardFinish : tour.rewardPerStop;
d.maxMoney = Math.max(d.maxMoney, d.money);
d.tourIdx = idx + 1;
if (isLast) d.tourDone = true;
d.log = [{ day: d.day, text: isLast ? `🏁 走完一日游「${tour.name}」，完赛奖励 ${fmt(tour.rewardFinish)}` : `🧭 一日游打卡 ${idx + 1}/${tour.stops.length}：${stopName} +${fmt(tour.rewardPerStop)}` }, ...d.log].slice(0, 40);
});
showToast(isLast ? `🏁 「${tour.name}」全程走完！完赛奖励 ${fmt(tour.rewardFinish)}` : `🧭 一日游 ${idx + 1}/${tour.stops.length}：${stopName} ✓ 下一站 ${tour.stops[idx + 1]}`);
if (isLast) postFeed("life", `走完了一日游「${tour.name}」，又认识了这座城一层`);
}, [currentLoc, phase]);

/* Key moments are acted out IN-GAME: the game's own 3D character performs
   them in dressed 3D sets (station platform, carriage, office, night-market
   stall, kitchen, bedroom) with the warm cinematic grade and camera push-in.
   No pre-rendered video anywhere — what you see is the game rendering live. */
const playLifeAnim = (kind: LifeKind, after?: () => void) => {
lifeAfterRef.current = after ?? null;
setLifeAnim({ kind, idx: 0 });
};
const finishLifeAnim = () => {
const after = lifeAfterRef.current;
lifeAfterRef.current = null;
setLifeAnim(null);
if (after) after();
};
useEffect(() => {
if (!lifeAnim) return;
const scene = LIFE_SCENES[lifeAnim.kind];
const tm = window.setTimeout(() => {
if (lifeAnim.idx + 1 >= scene.steps.length) finishLifeAnim();
else setLifeAnim({ kind: lifeAnim.kind, idx: lifeAnim.idx + 1 });
}, 2300);
return () => window.clearTimeout(tm);
}, [lifeAnim]);

const saveLocal = (prof: Profile | null, state: GameState | null) => {
try {
if (prof && state) localStorage.setItem(LS_KEY, JSON.stringify({ profile: prof, gs: state}));
else localStorage.removeItem(LS_KEY);
} catch { /* storage unavailable */}
};

const update = (next: GameState) => {
next.energy = clamp(next.energy, 0, 100);
next.mood = clamp(next.mood, 0, 100);
next.maxMoney = Math.max(next.maxMoney, next.money);
gsRef.current = next;
setGs(next);
if (profileRef.current) saveLocal(profileRef.current, next);
};

const mutate = (fn: (draft: GameState) => void): GameState | null => {
const cur = gsRef.current;
if (!cur) return null;
const next: GameState = {...cur, furniture: [...cur.furniture], log: [...cur.log], seenEvents: [...cur.seenEvents], greeted: [...cur.greeted], visitedScenic: [...(cur.visitedScenic ?? [])], album: [...(cur.album ?? [])], npcMem: Object.fromEntries(Object.entries(cur.npcMem ?? {}).map(([k, v]) => [k, { ...v }])), npcFeed: [...(cur.npcFeed ?? [])], npcNews: [...(cur.npcNews ?? [])]};
fn(next);
update(next);
return next;
};

const addLog = (text: string) => {
mutate((s) => {
s.log = [{ day: s.day, text},...s.log].slice(0, 40);
});
};

const postFeedMut = useMutation({
mutationFn: (args: { kind: "career" | "apec" | "home" | "money" | "life"; text: string}) =>
api.postFeed({ playerId: profileRef.current?.playerId?? "", kind: args.kind, text: args.text}),
});
const postFeed = (kind: "career" | "apec" | "home" | "money" | "life", text: string) => {
if (!profileRef.current) return;
postFeedMut.mutate({ kind, text});
};

/* ---------- presence heartbeat ---------- */
const currentLocRef = useRef(currentLoc);
currentLocRef.current = currentLoc;
const syncMut = useMutation({
mutationFn: () => {
const s = gsRef.current;
const prof = profileRef.current;
if (!s ||!prof) throw new Error("no game");
return api.syncPresence({
playerId: prof.playerId,
cityKey: s.cityKey,
locId: currentLocRef.current,
gameDay: Math.min(30, s.day),
money: Math.round(s.money),
careerIdx: s.careerIdx,
apecCount: s.apecCount,
});
},
onSuccess: (data) => {
const s = gsRef.current;
queryClient.setQueryData(["world", s?.cityKey?? "sz"], data);
},
});
const syncMutRef = useRef(syncMut);
syncMutRef.current = syncMut;
useEffect(() => {
if (phase!== "game") return;
syncMutRef.current.mutate();
const t = window.setInterval(() => syncMutRef.current.mutate(), 6000);
return () => window.clearInterval(t);
}, [phase, currentLoc]);

/* ---------- carriage ride progression ---------- */
// Global flattened index at which each leg ends (= the transfer station).
const legEndIdx = (r: MetroRoute, legIdx: number): number => {
let acc = 0;
for (let i = 0; i <= legIdx; i++) acc += (r.legs[i]?.stops ?? 0);
return acc;
};
/* ---------- metro entry sequence: concourse → security → platform → board ---------- */
useEffect(() => {
if (rideEntry === null) return;
const tm = window.setTimeout(() => {
setRideEntry((e) => (e === null || e >= ENTRY_STEPS.length - 1 ? null : e + 1));
}, 2000);
return () => window.clearTimeout(tm);
}, [rideEntry]);

useEffect(() => {
if (!carriage) return;
if (rideEntry !== null) return;
if (carriage.awaitingTransfer) return;
if (carriage.stopIdx >= carriage.route.stations.length - 1) return;
const tm = window.setTimeout(() => {
setCarriage((c) => {
if (!c || c.awaitingTransfer) return c;
const nextIdx = Math.min(c.stopIdx + 1, c.route.stations.length - 1);
const st = c.route.stations[nextIdx];
const isTransferStop = c.route.isTransfer && nextIdx === legEndIdx(c.route, c.legIdx) && c.legIdx < c.route.legs.length - 1;
if (isTransferStop) {
const nextLine = c.route.legs[c.legIdx + 1]?.line;
if (c.route.shuttleFrom.includes(st?.name ?? "")) {
const partner = c.route.stations[nextIdx + 1];
setCarriageLog(`🚌 ${st?.name ?? ""}站到了。两个站在城里两头，不是一个站——出站坐接驳巴士到${partner?.name ?? "对面站"}站，再进站换乘 ${nextLine?.name ?? "下一条线"}。点下面的按钮坐接驳巴士过去。`);
} else {
setCarriageLog(`🔁 ${st?.name ?? ""}站到了，这里要换乘 ${nextLine?.name ?? "下一条线"}。下车，跟着站台的换乘指示牌走到对面站台，点「换乘上车」继续。`);
}
return { ...c, stopIdx: nextIdx, awaitingTransfer: true };
}
setCarriageLog(nextIdx >= c.route.stations.length - 1 ? `🔔 ${st?.name ?? ""}站到了，这就是你的目的地，点「下车出站」下车。先下后上，别挡门。` : `📢 列车运行前方是 ${st?.name ?? ""} 站。${c.crowdLevel >= 2 && nextIdx % 2 === 0 ? "这一站上来不少人，车厢更挤了，你往里挪了挪。" : "有乘客上下车，车厢轻轻晃了一下。"}`);
return { ...c, stopIdx: nextIdx };
});
}, 2300);
return () => window.clearTimeout(tm);
}, [carriage, rideEntry]);
const doTransfer = () => {
setCarriage((c) => {
if (!c || !c.awaitingTransfer) return c;
const nextLeg = c.route.legs[c.legIdx + 1];
const st = c.route.stations[c.stopIdx];
if (c.route.shuttleFrom.includes(st?.name ?? "")) {
const partner = c.route.stations[c.stopIdx + 1];
setCarriageLog(`🚌 你出站坐上接驳巴士，穿过大半个惠州城，到了${partner?.name ?? "对面站"}站，进站上了 ${nextLeg?.line.name ?? ""}。${nextLeg?.line.short ?? ""} 往下一段开，坐稳扶好。`);
} else {
setCarriageLog(`🚶 你在${st?.name ?? ""}站下了车，穿过换乘通道，上了 ${nextLeg?.line.name ?? ""} 的列车。${nextLeg?.line.short ?? ""} 往下一段开，坐稳扶好。`);
}
return { ...c, legIdx: c.legIdx + 1, awaitingTransfer: false, seated: c.crowdLevel === 0, heldRail: false };
});
};

/* ---------- restore a saved run ---------- */
// Saves are written by whichever build the player last ran, and this game has
// grown new GameState fields across many builds. An old or partially-written
// save must never reach the render path raw: every field is re-validated and
// coerced here, and a save whose core shape is unusable is discarded (back to
// the setup screen) instead of white-screening the whole app on open.
const sanitizeSave = (rawParsed: unknown): { profile: Profile; gs: GameState } | null => {
if (!rawParsed || typeof rawParsed !== "object") return null;
const p = rawParsed as { profile?: unknown; gs?: unknown };
if (!p.profile || typeof p.profile !== "object" || !p.gs || typeof p.gs !== "object") return null;
const prof = p.profile as Partial<Profile>;
const g = p.gs as Partial<GameState> & Record<string, unknown>;
if (typeof prof.playerId !== "string" || prof.playerId.length < 4) return null;
if (typeof prof.name !== "string" || prof.name.trim() === "") return null;
if (g.cityKey !== "sz" && g.cityKey !== "hz" && g.cityKey !== "hk") return null;
if (g.finished) return null;
const num = (v: unknown, dflt: number): number => (typeof v === "number" && Number.isFinite(v) ? v : dflt);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const iden = IDENTITIES.find((i) => i.id === g.idenId) ?? IDENTITIES[0]!;
const gs: GameState = {
cityKey: g.cityKey,
idenId: iden.id,
day: Math.min(30, Math.max(1, Math.round(num(g.day, 1)))),
money: Math.round(num(g.money, iden.money)),
energy: clamp(num(g.energy, 90), 0, 100),
mood: clamp(num(g.mood, iden.mood), 0, 100),
rent: num(g.rent, 0),
baseRent: num(g.baseRent, 0),
goal: num(g.goal, iden.id === "rich" ? 30000 : iden.id === "flat" ? 5000 : CITIES[g.cityKey].goal),
earned: num(g.earned, 0),
rentPaid: num(g.rentPaid, 0),
workCount: num(g.workCount, 0),
otCount: num(g.otCount, 0),
mealCount: num(g.mealCount, 0),
maxMoney: num(g.maxMoney, num(g.money, iden.money)),
homeStyle: typeof g.homeStyle === "string" ? g.homeStyle : null,
furniture: strArr(g.furniture),
homeSpent: num(g.homeSpent, 0),
xp: num(g.xp, 0),
skill: num(g.skill, 0),
careerIdx: Math.min(4, Math.max(0, Math.round(num(g.careerIdx, 0)))),
network: num(g.network, 0),
fit: num(g.fit, 0),
invest: num(g.invest, 0),
apecCount: num(g.apecCount, 0),
apecTasks: strArr(g.apecTasks),
apecCheckins: strArr(g.apecCheckins),
seenEvents: strArr(g.seenEvents),
visitedScenic: strArr(g.visitedScenic),
album: strArr(g.album),
tourKey: typeof g.tourKey === "string" ? g.tourKey : undefined,
tourIdx: num(g.tourIdx, 0),
tourDone: g.tourDone === true,
metroRides: num(g.metroRides, 0),
outfit: typeof g.outfit === "string" ? g.outfit : "casual",
ownedOutfits: strArr(g.ownedOutfits).length > 0 ? strArr(g.ownedOutfits) : ["casual", "pajamas"],
groceries: num(g.groceries, 0),
greeted: strArr(g.greeted),
npcMem: g.npcMem && typeof g.npcMem === "object" && !Array.isArray(g.npcMem) ? (g.npcMem as GameState["npcMem"]) : {},
npcFeed: Array.isArray(g.npcFeed) ? (g.npcFeed as GameState["npcFeed"]) : [],
npcNews: Array.isArray(g.npcNews) ? (g.npcNews as GameState["npcNews"]) : [],
log: Array.isArray(g.log) ? (g.log as GameState["log"]).filter((e) => e && typeof e === "object" && typeof (e as { text?: unknown }).text === "string") : [],
finished: false,
signDay: num(g.signDay, 0),
dayBase: g.dayBase && typeof g.dayBase === "object" && !Array.isArray(g.dayBase) ? { day: num((g.dayBase as { day?: unknown }).day, 0), work: num((g.dayBase as { work?: unknown }).work, 0), meal: num((g.dayBase as { meal?: unknown }).meal, 0), scenic: num((g.dayBase as { scenic?: unknown }).scenic, 0) } : undefined,
dayClaim: strArr(g.dayClaim),
};
return { profile: { playerId: prof.playerId, name: prof.name }, gs };
};

useEffect(() => {
try {
const raw = localStorage.getItem(LS_KEY);
if (!raw) return;
const clean = sanitizeSave(JSON.parse(raw));
if (!clean) {
try { localStorage.removeItem(LS_KEY); } catch { /* storage unavailable */ }
return;
}
const { profile: prof, gs: restored } = clean;
if (!Array.isArray(restored.npcFeed) || restored.npcFeed.length === 0) {
try {
const gen = generateDailyPosts({ day: restored.day, cityKey: restored.cityKey, playerName: prof.name }, [], restored.npcMem);
restored.npcFeed = gen.posts;
restored.npcMem = gen.mems;
} catch { restored.npcFeed = []; }
}
profileRef.current = prof;
setProfile(prof);
gsRef.current = restored;
setGs(restored);
setCurrentLoc("home");
setSelectedLoc("home");
setPhase("game");
const iden = IDENTITIES.find((i) => i.id === restored.idenId) ?? IDENTITIES[0]!;
void api.joinWorld({
playerId: prof.playerId,
name: prof.name,
emoji: iden.emoji,
color: iden.color,
cityKey: restored.cityKey,
});
} catch { /* a corrupt save must never block the setup screen */ }
}, []);

const locById = (id: string): Loc => {
const locs = getLocations(gsRef.current?.cityKey?? "sz");
return locs.find((l) => l.id === id)?? locs[0]!;
};

/* ---------- movement ---------- */
const startMetroRide = (fromLocId: string, toLocId: string) => {
const s0 = gsRef.current; if (!s0) return;
const route = findMetroRoute(s0.cityKey, fromLocId, toLocId);
if (!route) { showToast("这趟车暂时没规划出来，换个目的地试试。"); return; }
if (s0.money < route.fare) { showToast(`车票 ${Y}${route.fare}，钱包不够，先打工攒点钱。`); return; }
const crowd = crowdForRide(route.line.id, s0.day, s0.metroRides ?? 0);
setCarriage({ route, fromLoc: fromLocId, toLoc: toLocId, stopIdx: 0, legIdx: 0, awaitingTransfer: false, crowdLabel: crowd.label, crowdDesc: crowd.desc, crowdLevel: crowd.level, seated: crowd.level === 0, gaveSeat: false, phoneUsed: false, heldRail: false });
setRideEntry(0);
setCarriageLog(`🚪 在${route.stations[0]?.name ?? ""}站刷卡进闸，上了 ${route.line.name}。${route.isTransfer ? `这趟要换乘：${route.summary}，在 ${route.transferStations.join("、")} 站下车换乘，跟着车厢走就行，一次坐到底。` : ""}${route.shuttleFrom.length > 0 ? `其中 ${route.shuttleFrom.join("、")} 是站外接驳：两个站不在一处，下车后坐接驳巴士到另一个站再上车。` : ""}${crowd.desc}`);
setSelectedLoc(toLocId);
setAsideTab("place");
};
const finishMetroRide = () => {
const c = carriage; const s0 = gsRef.current; if (!c || !s0) return;
const isRail = c.route.legs.some((l) => ["szhz-rail", "guangshen", "hz-intercity", "ganshen-rail", "guangshan-rail"].includes(l.line.id));
mutate((s) => { s.money -= c.route.fare; s.energy -= Math.max(3, Math.round(c.route.stops * 1.2)) + (c.gaveSeat ? 2 : 0); s.metroRides = (s.metroRides ?? 0) + 1; if (c.gaveSeat) { s.network += 1; s.mood += 4; } if (c.phoneUsed) s.mood += 2; });
setCurrentLoc(c.toLoc); currentLocRef.current = c.toLoc; setSelectedLoc(c.toLoc);
showToast(`${isRail ? "🚄" : "🚇"} 到达${locById(c.toLoc).name}，车票 -${Y}${c.route.fare}，共 ${c.route.stops} 站${c.route.isTransfer ? `（换乘 ${c.route.transferStations.length} 次：${c.route.summary}）` : ""}${pendingAfterRide.current && pendingAfterRide.current !== c.toLoc ? `，出站再步行到${locById(pendingAfterRide.current).short}` : ""}。`);
addLog(`坐 ${c.route.summary} 从${locById(c.fromLoc).short}到${locById(c.toLoc).short}，${c.route.stops}站${c.route.isTransfer ? `，在${c.route.transferStations.join("、")}换乘` : ""}${c.route.shuttleFrom.length > 0 ? `（${c.route.shuttleFrom.join("、")}坐接驳巴士）` : ""} -${Y}${c.route.fare}${c.gaveSeat ? "，车厢里让了个座，人脉+1" : ""}${pendingAfterRide.current && pendingAfterRide.current !== c.toLoc ? `，再步行到${locById(pendingAfterRide.current).short}` : ""}。`);
setRideEntry(null);
setCarriage(null);
const finalWalk = pendingAfterRide.current;
pendingAfterRide.current = null;
playLifeAnim(isRail ? "alightRail" : "metro", finalWalk && finalWalk !== c.toLoc ? () => {
showToast(`出了「${locById(c.toLoc).short}」站，最后一段路走到${locById(finalWalk).name}。`);
walkToRef.current?.(finalWalk, "walk");
} : pendingSleep.current ? () => {
// Rode home with 「回家睡觉」 pending and the station is the last leg:
// honour the sleep instead of stranding the flag on a later walk.
pendingSleep.current = false;
playLifeAnim("sleep", () => doSleep());
} : undefined);
};
const walkTo = (locId: string, modeOverride?: TransportModeId) => {
if (!gsRef.current || walking || carriage) return;
const s0 = gsRef.current;
setSelectedLoc(locId);
setAsideTab("place");
setAsideOpen(true);
if (locId === currentLocRef.current) return;
const mode = modeOverride ?? travelMode;
const from = locById(currentLocRef.current);
const to = locById(locId);
const dist = Math.hypot(to.x - from.x, to.z - from.z);
if (mode === "metro" || mode === "rail") {
  // Full-network routing, transfers included — and it works between ANY
  // two places, not just ones that are stations themselves. Places with
  // no station of their own (大梅沙以外的海滩、公园、景区…) board at the
  // nearest station and alight at the station nearest the destination;
  // both access legs are walked and acted out, so a trip is never
  // cancelled just because an endpoint has no station.
  const plan = planRailTrip(s0.cityKey, currentLocRef.current, locId);
  if (plan) {
    if (s0.money < plan.route.fare) {
      showToast(`这趟车票 ${Y}${plan.route.fare}（${plan.route.summary}），钱包不够，先打工攒点钱再坐。`);
      setSelectedLoc(currentLocRef.current);
      return;
    }
    pendingAfterRide.current = plan.alightLoc !== locId ? locId : null;
    const legsText = `${plan.route.summary}${plan.route.isTransfer ? `，在${plan.route.transferStations.join("、")}换乘` : ""}`;
    if (plan.boardLoc !== currentLocRef.current) {
      pendingRide.current = plan.alightLoc;
      showToast(`你这儿没有站：先走到最近的「${locById(plan.boardLoc).name}」上车，坐 ${legsText} 到「${locById(plan.alightLoc).short}」${plan.alightLoc !== locId ? `，下车再走到${to.short}` : ""}。全程都安排好了，跟着走就行。`);
      walkTo(plan.boardLoc, "walk");
      return;
    }
    if (plan.alightLoc !== locId) {
      showToast(`「${to.name}」没有自己的站：坐 ${legsText} 到最近的「${locById(plan.alightLoc).name}」下车，再步行过去——出站那段路也演给你看。`);
    }
    startMetroRide(currentLocRef.current, plan.alightLoc);
    return;
  }
  // planRailTrip returned null: the two places are so close to the same
  // station area that the access walks alone would be longer than walking
  // straight there. Announce it and fall through to the walking code
  // below (modeLabel stays 步行) — a stated choice, never a silent switch.
  showToast(`「${from.short}」到「${to.short}」走过去比坐车还近：坐车光是走到站、下车再走回来就比直达更远，这次直接步行。`);
}
let cost = 0; let energyCost = 0; let effMode: TransportModeId = "walk"; let modeLabel = "步行";
if (mode === "run") { cost = 0; energyCost = Math.round(dist * 0.85); effMode = "run"; modeLabel = "跑步"; }
else if (mode === "drive") { const park = parkingFee(to); cost = driveFare(dist) + park; energyCost = 1; effMode = "drive"; modeLabel = "自驾"; if (s0.money < cost) { showToast(`自驾去${to.short}要油费/电费 ${Y}${driveFare(dist)}${park > 0 ? ` + 停车费 ${Y}${park}` : ""}，钱不够，改步行了。`); cost = 0; energyCost = Math.round(dist * 0.5); effMode = "walk"; modeLabel = "步行"; } else if (park > 0) { showToast(`自驾去${to.short}：油费/电费 ${Y}${driveFare(dist)} + 那边停车 ${Y}${park}。开自己的车就是这点好——比打车便宜，停车得自己找车位。`); } }
else if (mode === "taxi") { cost = taxiFare(dist); energyCost = 1; effMode = "taxi"; modeLabel = "打车"; if (s0.money < cost) { showToast(`打车要 ${Y}${cost}，钱不够，改步行了。`); cost = 0; energyCost = Math.round(dist * 0.5); effMode = "walk"; modeLabel = "步行"; } }
else if (mode === "moto") { cost = motoFare(dist); energyCost = Math.max(1, Math.round(dist * 0.18)); effMode = "moto"; modeLabel = "电动车"; if (s0.money < cost) { showToast(`电动车要 ${Y}${cost}，钱不够，改步行了。`); cost = 0; energyCost = Math.round(dist * 0.5); effMode = "walk"; modeLabel = "步行"; } else if (dist > 22) { showToast(`路太远，电动车电量告急，骑到一半推了一段——远途还是坐${railWord(s0.cityKey)}/打车吧。`); energyCost += 4; } }
else if (mode === "bike") { cost = bikeFare(dist); energyCost = Math.round(dist * 0.3); effMode = "bike"; modeLabel = "骑行"; if (s0.money < cost) { cost = 0; showToast(`骑行去${to.short}要 ${Y}${bikeFare(dist)}，钱包不够——共享单车免押金，这趟先免费骑。任何地点都能骑到，别让钱拦路。`); } }
else if (mode === "bus") { cost = busFare(dist); energyCost = Math.max(1, Math.round(dist * 0.12)); effMode = "bus"; modeLabel = "公交"; if (s0.money < cost) cost = 0; }
else if (mode === "ferry") { cost = 60; energyCost = 4; effMode = "ferry"; modeLabel = "轮渡"; if (s0.money < cost) { showToast(`轮渡船票要 ${Y}${cost}，钱不够，改步行了。`); cost = 0; energyCost = Math.round(dist * 0.5); effMode = "walk"; modeLabel = "步行"; } }
else if (mode === "flight") { cost = 420; energyCost = 6; effMode = "flight"; modeLabel = "飞机"; if (s0.money < cost) { showToast(`机票要 ${Y}${cost}，钱不够，改步行了。`); cost = 0; energyCost = Math.round(dist * 0.5); effMode = "walk"; modeLabel = "步行"; } }
else { energyCost = Math.round(dist * 0.5); }
if (cost > 0 || energyCost > 0) mutate((s) => { s.money -= cost; s.energy -= energyCost; });
if (cost > 0) showToast(`${modeLabel}去${to.short}，-${Y}${cost}${energyCost ? `，能量 -${energyCost}` : ""}，预计约 ${etaMinutes(effMode, dist)} 分钟到。`);
else showToast(`${modeLabel}去${to.short}，预计约 ${etaMinutes(effMode, dist)} 分钟到。${effMode === "walk" ? "换个更快的出行方式能省不少时间。" : ""}`);
if (nowRainy) {
if (s0.outfit === "raincoat") showToast("🌧️ 下雨天，你穿着雨衣出门，雨点都顺着衣角滑下去了，没淋着。");
else { mutate((x) => { x.mood -= 2; }); showToast("🌧️ 下雨没穿雨衣，淋了点雨，心情 -2。回家衣柜里备一件雨衣吧。"); }
}
setWalking(true);
/* Trip duration derives from the mode's real map speed — the same
   number that drives the figure's movement speed on the 3D map, so a
   taxi visibly crosses the city ~3× faster than walking. */
const ms = clamp((dist / modeById(effMode).mapSpeed) * 1000, 450, 10000);
/* 公交/打车不是地图上挪个小人就算搭乘：和地铁一样弹出车厢电影动画
   （站台等车→上车→坐进车厢看窗外→到站下车）。所有行程都触发，
   不分远近；四步动画按这趟的实际时长 ms 等分缩放，行程到点时
   最后一步没演完就等它演完再收（见 roadRideArrived 的处理）。 */
if (effMode === "bus" || effMode === "taxi" || effMode === "drive") {
setRoadRide({ mode: effMode, fromName: from.name, toName: to.name, fare: cost, durMs: ms, startedAt: Date.now() });
setRoadRideStep(0);
setRoadRideArrived(false);
}
if (walkTimer.current) window.clearTimeout(walkTimer.current);
walkTimer.current = window.setTimeout(() => {
setCurrentLoc(locId);
currentLocRef.current = locId;
setWalking(false);
/* 到站不直接掐断搭乘动画：只标记已到达，弹窗等四步演完再收起。 */
setRoadRideArrived(true);
if (pendingRide.current) {
const dest = pendingRide.current;
pendingRide.current = null;
const ck = gsRef.current?.cityKey ?? "sz";
if (dest !== locId && findMetroRoute(ck, locId, dest)) {
showToast(`到「${locById(locId).name}」了，接着坐${railWord(ck)}去${locById(dest).name}。`);
startMetroRide(locId, dest);
}
} else if (pendingSleep.current) { pendingSleep.current = false; playLifeAnim("sleep", () => doSleep()); }
}, ms);
};

useEffect(() => { walkToRef.current = walkTo; });

const goHomeAndSleep = () => {
if (currentLocRef.current === "home" &&!walking) {
doSleep();
} else {
pendingSleep.current = true;
walkTo("home");
}
};

/* ---------- 跨城切换：高铁去惠州，过关去香港 ----------
   One save, three cities: the run itself (money, career, home, furniture,
   progress) does NOT change — only the city you stand in. Map, locations,
   real weather, the online channel, foods/gigs and the neighbours' wall
   all resolve from gs.cityKey, so the switch is: play the in-game scene,
   then flip cityKey, land at the other city's gateway station, and
   rebuild today's NPC wall for the new city. Shenzhen ⇄ Huizhou rides
   the 厦深高铁 (no border). Anything touching Hong Kong is a real border
   crossing — 高铁到西九龙站一地两检，或罗湖/福田/深圳湾口岸过关 — so it
   plays the 过关 scene （出示证件 → 安检 → 入境） instead. The presence
   heartbeat follows on its own (it syncs gs.cityKey + currentLoc). */
const INTERCITY_STATION: Record<CityKey, string> = { sz: "north", hz: "hzsouth", hk: "westkowloon" };
const INTERCITY_FARE = 40;
/** Real-ish one-way fares: 深圳北↔惠州南 ≈ ¥40 （厦深）; 深圳北↔西九龙
    二等座 ¥75 （广深港高铁）; 惠州南↔西九龙 ≈ ¥120 (via 深圳）. The fare
    is always NAMED in the departure city's currency (crossFareLabel):
    the same 75 reads ¥75（深圳出发 · 人民币）one way and HK$75（西九龙
    出发 · 港币）the other. */
function intercityFare(from: CityKey, to: CityKey): number {
  const pair = [from, to].sort().join("-");
  if (pair === "hk-sz") return 75;
  if (pair === "hk-hz") return 120;
  return INTERCITY_FARE;
}
const switchCity = (to: CityKey) => {
const s0 = gsRef.current;
if (!s0) return;
if (walking || carriage || lifeAnim) { showToast("先等这趟行程结束，再去坐跨城的车。"); return; }
const from = s0.cityKey;
if (to === from) return;
const fare = intercityFare(from, to);
const crossing = from === "hk" || to === "hk";
/* Fare as the player sees it: cross-border fares are labelled in the
   DEPARTURE currency (West Kowloon → HK$, Shenzhen/Huizhou → ¥, named
   as such); the domestic Shenzhen⇄Huizhou fare stays a plain ¥40. */
const fareTxt = crossing ? crossFareLabel(from, fare) : `¥${fare}`;
/* The fare is charged when the player can afford it, but a switch is
   NEVER blocked by an empty wallet （绝不拦路， same rule as cycling):
   broke players ride free and are told so plainly. */
const charged = s0.money >= fare;
const fromStation = getLocations(from).find((l) => l.id === INTERCITY_STATION[from])?.name ?? CITIES[from].name;
const toStationLoc = getLocations(to).find((l) => l.id === INTERCITY_STATION[to]);
const toStation = toStationLoc?.name ?? CITIES[to].name;
const arrive = () => {
const wall = generateDailyPosts({ day: s0.day, cityKey: to, playerName: profileRef.current?.name ?? "我" }, [], gsRef.current?.npcMem ?? {});
mutate((s) => {
s.cityKey = to;
if (charged) s.money -= fare;
s.energy = clamp(s.energy - 6, 1, 100);
s.metroRides = (s.metroRides ?? 0) + 1;
s.npcFeed = wall.posts;
s.npcMem = wall.mems;
s.log = [{ day: s.day, text: crossing
  ? `过关啦：坐高铁从${fromStation}出发，在${to === "hk" ? "西九龙站一地两检" : "口岸"}办完出示证件、安检、入境手续，抵达${toStation}——接下来在${CITIES[to].name}过日子，进度、家当原样带着走${charged ? `（车票 ${fareTxt}）` : "（钱包不够车票钱，这趟免费坐）"}。`
  : `坐厦深高铁从${fromStation}到${toStation}，接下来在${CITIES[to].name}过日子——进度、家当都原样带着走${charged ? `（车票 ${fareTxt}）` : "（钱包不够车票钱，这趟免费坐）"}。` }, ...s.log].slice(0, 40);
});
setCurrentLoc(INTERCITY_STATION[to]); currentLocRef.current = INTERCITY_STATION[to];
setSelectedLoc(INTERCITY_STATION[to]);
setAsideTab("place"); setAsideOpen(true);
setMapFocus({ locId: INTERCITY_STATION[to], nonce: Date.now() });
showToast(charged
  ? `${crossing ? "🛃 过关成功" : "🚄 到站"}——${toStation}！这里是${CITIES[to].name}——地图、天气、街坊都换了，进度原样带着（车票 ${fareTxt}）。`
  : `${crossing ? "🛃 过关成功" : "🚄 到站"}——${toStation}！钱包不够车票钱，这趟免费坐，绝不拦路。这里是${CITIES[to].name}，进度原样带着。`);
burstDanmaku([`${crossing ? "🛃" : "🚄"} ${profileRef.current?.name ?? "我"} ${crossing ? "过关去了" : "坐高铁去了"}${CITIES[to].name}`, `欢迎来到${CITIES[to].name} 🎉`]);
postFeed("life", crossing ? `过关去了${CITIES[to].name}，换座城市过日子` : `坐厦深高铁去了${CITIES[to].name}，换座城市过日子`);
};
/* The trip is acted out on the game's own 3D sets — the 过关 concourse
   sequence for Hong Kong, the 下高铁 platform scene for Huizhou — then
   the arrival callback flips the city. */
playLifeAnim(crossing ? "crossing" : "alightRail", arrive);
};

/* ---------- core numbers ---------- */
const basePay = (s: GameState) => {
const iden = idenOf(s);
const career = CAREERS[s.careerIdx]?? CAREERS[0]!;
return Math.round(iden.pay * CITIES[s.cityKey].payMul * career.mul);
};

/* ---------- actions ---------- */
const doAction = (kind: string, arg = 0) => {
const s0 = gsRef.current;
if (!s0 || walking || currentLoc!== selectedLoc || activeEvent) return;
const loc = locById(selectedLoc);
const base = basePay(s0);
const fitSave = s0.fit >= 3? 3: 0;
let msg = "";
const feeds: { kind: "career" | "apec" | "home" | "money" | "life"; text: string }[] = [];
mutate((s) => {
switch (kind) {
case "rest":
s.energy += 14 + (s.outfit === "pajamas" ? 6 : 0); s.mood += 8;
msg = `歇了一会儿，能量 +${14 + (s.outfit === "pajamas" ? 6 : 0)}，心情 +8${s.outfit === "pajamas" ? "（穿睡衣躺平更舒服）" : ""}。`;
break;
case "work": {
const cost = 28 - fitSave;
const formalXp = s.outfit === "formal" ? 1 : 0;
s.money += base; s.earned += base; s.energy -= cost; s.xp += 2 + formalXp; s.workCount += 1;
msg = `上班一天，工资 +${fmt(base)}，经验 +${2 + formalXp}${formalXp ? "（正装加成 +1）" : ""}。`;
break;
}
case "overtime": {
const cost = 42 - fitSave;
const pay = Math.round(base * 1.75);
s.money += pay; s.earned += pay; s.energy -= cost; s.mood -= 12; s.xp += 3; s.otCount += 1;
msg = `加班到深夜，+${fmt(pay)}，经验 +3，心情 -12。`;
break;
}
case "gig": {
let mul = 0.9 + Math.random() * 0.4;
if (loc.id === "hotel" && isApecWeek(s.day)) mul *= 1.3;
const pay = Math.round(base * 0.55 * mul);
s.money += pay; s.earned += pay; s.energy -= 18; s.xp += 1;
msg = `${loc.gigName?? CITIES[s.cityKey].gigName}接了几单，+${fmt(pay)}，经验 +1。`;
break;
}
case "eat": {
const f = FOODS[s.cityKey][arg];
if (!f) break;
s.money -= f.cost; s.energy += f.energy; s.mood += f.mood; s.mealCount += 1;
msg = `${f.name}下肚，能量 +${f.energy}，心情 +${f.mood}。`;
break;
}
case "wash":
s.energy += 6; s.mood += 6;
msg = "洗漱整理了一番，神清气爽，能量 +6，心情 +6。";
break;
case "cook": {
if (s.groceries <= 0) { msg = "冰箱空了，先去买菜（夜市/市场/商场都有买菜）再回来做饭。"; break; }
s.groceries -= 1; s.energy += 34; s.mood += 9; s.mealCount += 1;
msg = "自己做了一顿饭：洗菜、切菜、下锅，热气腾腾端上桌。能量 +34，心情 +9。";
break;
}
case "buy-groceries": {
if (s.money < 28) { msg = `买菜要 ${fmt(28)}，钱包不够。`; break; }
s.money -= 28; s.groceries += 1;
msg = `买了一篮子菜（青菜、鸡蛋、肉），食材 +1，现在有 ${s.groceries} 份，回家就能做饭。`;
break;
}
case "stroll":
s.energy -= 4; s.mood += 12;
msg = "慢慢散了会儿步，风很舒服，心情 +12。";
break;
case "fun": {
const cost = loc.funCost?? CITIES[s.cityKey].funCost;
const mood = loc.funMood?? CITIES[s.cityKey].moodFun;
s.money -= cost; s.mood += mood;
msg = `${loc.funName?? CITIES[s.cityKey].funName}，心情 +${mood}。`;
break;
}
case "learn-course":
s.money -= 30; s.energy -= 15; s.skill += 1; s.xp += 1;
msg = "夜校一节课上完，技能 +1，经验 +1。";
break;
case "learn-self":
s.energy -= 10; s.skill += 1; s.mood += 2;
msg = "自习两小时，技能 +1。";
break;
case "apec-staff": {
const mul = apecVenueMul(s.day, loc.id);
const pay = Math.round(base * 0.9 * mul);
s.money += pay; s.earned += pay; s.energy -= 22; s.xp += 2;
if (isApecWeek(s.day)) {
s.apecCount += 1;
if (s.apecCount === 3) s.npcNews = [...(s.npcNews ?? []), { kind: "apec" as const, text: "在 APEC 会场服务满 3 场了", day: s.day }];
if (mul >= 1.5) feeds.push({ kind: "apec", text: `在${loc.short}做了一场会务服务，+${fmt(pay)}` });
}
msg = `会务服务一场，+${fmt(pay)}${mul > 1? `（APEC ×${mul}）`: ""}，经验 +2。`;
break;
}
case "apec-host": {
const mul = apecVenueMul(s.day, loc.id);
const pay = Math.round(base * 1.25 * mul);
s.money += pay; s.earned += pay; s.energy -= 20; s.xp += 3; s.network += 1;
if (isApecWeek(s.day)) {
s.apecCount += 1;
if (s.apecCount === 3) s.npcNews = [...(s.npcNews ?? []), { kind: "apec" as const, text: "在 APEC 会场服务满 3 场了", day: s.day }];
if (mul >= 1.5) feeds.push({ kind: "apec", text: `在${loc.short}接待了外宾团，+${fmt(pay)}，人脉 +1` });
}
msg = `外宾接待一场，+${fmt(pay)}${mul > 1? `（APEC ×${mul}）`: ""}，经验 +3，人脉 +1。`;
break;
}
case "apec-visit": {
s.money -= 20; s.mood += 10;
if (Math.random() < 0.3) { s.network += 1; msg = "逛了一圈会场，认识了位同行，人脉 +1，心情 +10。";}
else msg = "在会场逛了逛，集了几个章，心情 +10。";
break;
}
case "apec-checkin": {
if ((s.apecCheckins ?? []).includes(loc.id)) { s.mood += 3; msg = `📸 ${loc.name}已经打过卡了，再看看会场，心情 +3。`; }
else {
s.apecCheckins = [...(s.apecCheckins ?? []), loc.id];
s.mood += 6;
const n = (s.apecCheckins ?? []).length;
msg = `📸 在${loc.name}打卡成功！APEC 会场已打卡 ${n} / 3，心情 +6。${apecTaskOfDay(s.day)?.venueLocId === loc.id ? "今天的岗位任务就在这里，先打卡再上岗。" : ""}`;
feeds.push({ kind: "apec", text: `在${loc.short}完成了 APEC 会场打卡（${n}/3）` });
}
break;
}
case "apec-task": {
const task = apecTaskOfDay(s.day);
if (!task || task.venueLocId !== loc.id) { msg = "今天这里没有领导人周的岗位任务——看看 APEC 活动卡，今天的班在另一个会场。"; break; }
if ((s.apecTasks ?? []).includes(task.id)) { msg = `今天的任务「${task.title}」已经完成了，明天还有新的一班。`; break; }
if (!(s.apecCheckins ?? []).includes(loc.id)) { msg = "先在会场打卡再上岗——点上方的「会场打卡」，这也是认会场、认深圳的一部分。"; break; }
if (s.energy < task.energy) { msg = `这个岗位要站一整班，能量至少 ${task.energy}，先去吃点东西或者歇一会儿。`; break; }
const pay = Math.round(base * task.payMul);
s.money += pay; s.earned += pay; s.energy -= task.energy; s.xp += task.xp; s.network += task.network;
s.apecCount += 1;
s.apecTasks = [...(s.apecTasks ?? []), task.id];
const doneN = (s.apecTasks ?? []).length;
if (s.apecCount === 3) s.npcNews = [...(s.npcNews ?? []), { kind: "apec" as const, text: "在 APEC 会场服务满 3 场了", day: s.day }];
feeds.push({ kind: "apec", text: `以${task.role}身份完成了 APEC 任务「${task.title}」（${doneN}/${APEC_TASKS.length}），+${fmt(pay)}` });
if (doneN >= APEC_TASKS.length) {
s.npcNews = [...(s.npcNews ?? []), { kind: "apec" as const, text: "拿到了 APEC 领导人周服务证书，六天任务全做完", day: s.day }];
msg = `🏅 「${task.title}」完成，+${fmt(pay)}，经验 +${task.xp}，人脉 +${task.network}。六天的领导人周任务全部完成——${APEC_CERT_NAME}已经记在你的名下，结算时见！`;
} else {
msg = `✅ APEC 任务「${task.title}」完成（${task.roleEmoji} ${task.role}），+${fmt(pay)}，经验 +${task.xp}，人脉 +${task.network}。进度 ${doneN} / ${APEC_TASKS.length}，明天继续。`;
}
break;
}
case "mall-shop":
s.money -= 120; s.mood += 14;
msg = "逛了圈商场买了点小东西，心情 +14。";
break;
case "mall-cloth":
s.money -= 300; s.mood += 20; s.network += 1;
msg = "换了身新行头，人精神了，心情 +20。";
break;
case "mall-promo": {
const pay = Math.round(base * 0.5);
s.money += pay; s.earned += pay; s.energy -= 16; s.xp += 1;
msg = `促销兼职半天，+${fmt(pay)}，经验 +1。`;
break;
}
case "health-check":
s.money -= 150; s.energy += 8; s.mood += 6; s.fit += 1;
msg = "体检报告一切正常，体质 +1，心里踏实了。";
break;
case "health-cure":
s.money -= 80; s.energy += 18; s.mood += 3;
msg = "调理完神清气爽，能量 +18。";
break;
case "gym":
s.money -= 30; s.energy -= 10; s.mood += 10 + (s.outfit === "sport" ? 4 : 0); s.fit += 1;
msg = `认真练了一次，体质 +1（已练 ${s.fit} 次）。`;
break;
case "bank-buy":
s.money -= 1000; s.invest += 1000;
msg = `买入理财 ${fmt(1000)}，每晚结算收益。`;
break;
case "bank-sell": {
const amt = s.invest;
s.money += amt; s.invest = 0;
msg = `取出全部理财，+${fmt(amt)} 回到存款。`;
break;
}
case "social-ktv":
s.money -= 88; s.mood += 18; s.network += 1;
msg = "唱K吼了两嗓子，心情 +18，人脉 +1。";
break;
case "social-drink":
s.money -= 45; s.mood += 10; s.energy += 4;
msg = "小酌一杯，聊了聊最近的行情，心情 +10。";
break;
case "market-phone": {
s.money -= 400;
if (Math.random() < 0.5) {
s.money += 650; s.earned += 250; s.mood += 5;
msg = `眼光不错！二手手机转手 +${fmt(650)}，净赚 ${fmt(250)}。`;
} else {
s.mood -= 4;
msg = `踩坑了，手机只值自用。-${fmt(400)}，心情 -4。`;
}
break;
}
case "market-fix": {
const pay = Math.round(base * 0.6);
s.money += pay; s.earned += pay; s.energy -= 20; s.xp += 1;
msg = `帮摊主装机维修，+${fmt(pay)}，经验 +1。`;
break;
}
case "checkin": {
const key = `${s.cityKey}:${loc.id}`;
if ((s.visitedScenic ?? []).includes(key)) { msg = "这里已经打过卡了，再静静看一会儿风景。"; s.mood += 3; }
else { s.visitedScenic = [...(s.visitedScenic ?? []), key]; s.mood += 12; msg = `📸 在${loc.name}打卡成功！心情 +12，已打卡 ${(s.visitedScenic ?? []).length} 处风景。`; feeds.push({ kind: "life", text: `在${loc.name}打卡，集齐风景 ${(s.visitedScenic ?? []).length} 处` }); }
break;
}
case "hk-trip":
s.money -= 180; s.mood += 22; s.energy -= 16; s.network += 1;
msg = "过关去香港玩了一天：逛旺角、坐天星小轮、吃茶餐厅，心情 +22，人脉 +1。";
break;
case "ferry":
s.money -= 60; s.mood += 18; s.energy -= 6;
msg = "从蛇口坐轮渡出海，甲板上吹海风看港珠澳大桥，心情 +18。";
break;
case "flight":
s.money -= 420; s.mood += 26; s.energy -= 14;
msg = "坐飞机出门远行一天，落地看陌生城市的灯，心情 +26。回来继续好好过日子。";
break;
case "hike":
s.energy -= 16; s.mood += 20; s.fit += 1;
msg = `登山徒步一趟，体质 +1（已练 ${s.fit} 次），心情 +20。`;
break;
default:
break;
}
});
if (msg) {
showToast(msg);
addLog(msg);
}
for (const f of feeds) postFeed(f.kind, f.text);
/* 奖励飘字：把这一步的钱 / 经验 / 心情变化飘在地图上（手游式反馈） */
{
const after = gsRef.current;
if (after && msg) {
const dMoney = Math.round(after.money - s0.money);
const dXp = after.xp - s0.xp;
const dMood = Math.round(after.mood - s0.mood);
if (dMoney > 0) floatReward(`+${fmt(dMoney)}`, "gold");
else if (dMoney < 0) floatReward(`-${fmt(-dMoney)}`, "red");
if (dXp > 0) floatReward(`经验 +${dXp}`, "blue");
if (dMood >= 6) floatReward(`心情 +${dMood}`, "green");
}
}
/* 弹幕刷屏时刻：打卡成功 / APEC 打卡与上岗，街坊们发弹幕庆祝 */
if (msg && kind === "checkin" && !msg.includes("已经打过卡")) {
const spot = scenicOf(s0.cityKey, selectedLoc);
burstDanmaku([`📸 ${profileRef.current?.name ?? "你"} 在${spot?.name ?? loc.short}打卡成功！`, "阿琳：这张拍得真好 👍", "大芬姐：风景册又多一页啦", "子健：我也要去打卡 📍", "Lisa：Great shot! 🌟"]);
}
if (msg && kind === "apec-checkin") {
burstDanmaku([`🌐 APEC 会场打卡 +1！`, "Lisa：三个会场集齐有徽章哦", "老周：领导人周，深圳准备好了", "小美：志愿者辛苦啦 🎽"]);
}
if (msg && kind === "apec-task") {
burstDanmaku([`🎉 APEC 今日任务完成！`, "Lisa：干得漂亮，这就是深圳服务 🌐", "阿强：给 APEC 打工的人点赞", "陈伯：盛会办得好，街坊脸上有光", "王姨：辛苦啦，回来喝碗糖水"]);
}
const animMap: Partial<Record<string, LifeKind>> = { work: "code", overtime: "overtime", eat: "eat", gym: "gym", wash: "wash", cook: "cook", "buy-groceries": "groceries", stroll: "stroll", "social-ktv": "gathering", "social-drink": "gathering", "mall-shop": "shopping", "mall-cloth": "shopping", fun: "stroll" };
const ak = animMap[kind];
if (ak && msg && !(kind === "cook" && s0.groceries <= 0) && !(kind === "buy-groceries" && s0.money < 28)) playLifeAnim(ak);
};

/* ---------- sleep / day rollover ---------- */
const doSleep = () => {
const s0 = gsRef.current;
if (!s0 || s0.finished) return;
let rentMsg = "";
let broke = false;
const next = mutate((s) => {
if (isSaturday(s.day)) {
s.money -= s.rent;
s.rentPaid += s.rent;
rentMsg = `周六交租 -${fmt(s.rent)}。`;
if (s.money < -500) broke = true;
}
if (s.invest > 0) {
if (Math.random() < 0.15) {
const loss = Math.round(s.invest * 0.03);
s.invest -= loss;
rentMsg += ` 理财昨夜波动 -${fmt(loss)}。`;
} else {
const gain = Math.max(1, Math.round(s.invest * 0.004));
s.invest += gain;
rentMsg += ` 理财收益 +${fmt(gain)}。`;
}
}
const lowMood = s.mood <= 5;
s.day += 1;
s.energy = 100;
s.mood = lowMood? 25: s.mood + homeMoodBonus(s);
if (lowMood) rentMsg += " 心情见底，睡了一觉缓过来一点。";
s.greeted = [];
});
if (!next) return;
if (rentMsg) addLog(rentMsg.trim());
if (broke) {
finishSeason("debt");
return;
}
if (next.day > 30) {
finishSeason("done");
return;
}
/* NPC simulation: overnight, the neighbours post and comment on a new wall —
   yesterday's player news (promotion, new home, APEC service) is what they
   talk about first. Moods drift with the new day. */
{
const gen = generateDailyPosts(
{ day: next.day, cityKey: next.cityKey, playerName: profileRef.current?.name ?? "我" },
next.npcNews ?? [],
next.npcMem ?? {},
);
mutate((s) => {
s.npcMem = gen.mems;
s.npcFeed = [...gen.posts, ...(s.npcFeed ?? [])].slice(0, 60);
s.npcNews = [];
});
/* 手游件：新一天的每日任务从今天的计数重新起算，昨天的领取记录清零 */
mutate((s) => {
s.dayBase = { day: s.day, work: s.workCount, meal: s.mealCount, scenic: (s.visitedScenic ?? []).length };
s.dayClaim = [];
});
gen.posts.slice(0, 2).forEach((p, i) => window.setTimeout(() => pushDanmakuRef.current(`${p.author}：${p.text}`), 600 + i * 900));
}
showToast(`第 ${next.day} 天 · ${weekday(next.day)} · ${weatherOf(next.day, next.cityKey)}${rentMsg? " " + rentMsg: ""}`);
if (Math.random() < 0.55) {
const ev = pickEvent(next.day, next.cityKey, new Set(next.seenEvents));
if (ev) {
mutate((s) => { s.seenEvents = [...s.seenEvents, ev.title];});
window.setTimeout(() => setActiveEvent(ev), 450);
}
}
};

const finishSeason = (reason: "done" | "debt") => {
const s0 = gsRef.current;
if (!s0 || finishedSent.current) return;
finishedSent.current = true;
const r = computeResult(s0, reason);
setResult(r);
mutate((s) => { s.finished = true;});
const prof = profileRef.current;
if (prof) {
void api.finishSeason({
playerId: prof.playerId,
money: Math.round(s0.money),
careerIdx: s0.careerIdx,
apecCount: s0.apecCount,
resultTitle: r.title,
}).then(() => queryClient.invalidateQueries({ queryKey: ["world"]}));
}
setPhase("result");
};

const chooseEventChoice = (idx: number) => {
const ev = activeEvent;
const s0 = gsRef.current;
if (!ev ||!s0) return;
const choice = ev.choices[idx];
if (!choice) return;
const iden = idenOf(s0);
const fx = {
money: s0.money, energy: s0.energy, mood: s0.mood, earned: s0.earned,
xp: s0.xp, skill: s0.skill, network: s0.network,
pay: iden.pay, payMul: CITIES[s0.cityKey].payMul,
};
const text = locText(choice.apply(fx), s0.cityKey);
mutate((s) => {
s.money = fx.money; s.energy = fx.energy; s.mood = fx.mood; s.earned = fx.earned;
s.xp = fx.xp; s.skill = fx.skill; s.network = fx.network;
});
setActiveEvent(null);
showToast(text);
addLog(`${text}`);
};

  /* ---------- start / restart ---------- */
  const joinMut = useMutation({
    mutationFn: api.joinWorld,
    onSuccess: (data, vars) => {
      queryClient.setQueryData(["world", vars.cityKey], data);
    },
  });

  const startGame = (name: string, city: CityKey, idenId: string) => {
    const iden = IDENTITIES.find((i) => i.id === idenId) ?? IDENTITIES[0]!;
    const cityInfo = CITIES[city];
    let rent = Math.round((cityInfo.rentBase * iden.rentMul) / 10) * 10;
    if (city === "hz" && iden.id === "rich") rent = 1150;
    const prof: Profile = profile ?? { playerId: newPlayerId(), name };
    prof.name = name;
    const day1Wall = generateDailyPosts({ day: 1, cityKey: city, playerName: name }, [], {});
    const state: GameState = {
      cityKey: city, idenId: iden.id, day: 1,
      money: iden.money, energy: 88 + iden.energyBonus, mood: iden.mood,
      rent, baseRent: rent,
      goal: iden.id === "rich" ? 30000 : iden.id === "flat" ? 5000 : cityInfo.goal,
      earned: 0, rentPaid: 0, workCount: 0, otCount: 0, mealCount: 0,
      maxMoney: iden.money, homeStyle: null, furniture: [], homeSpent: 0,
      xp: 0, skill: 0, careerIdx: 0, network: 0, fit: 0, invest: 0, apecCount: 0,
      apecTasks: [], apecCheckins: [],
      seenEvents: [], greeted: [], visitedScenic: [], album: [], tourIdx: 0, tourDone: false, metroRides: 0, outfit: "casual", ownedOutfits: ["casual", "pajamas"], groceries: 1,
      npcMem: day1Wall.mems, npcFeed: day1Wall.posts, npcNews: [],
      log: [{ day: 1, text: `来到${cityInfo.name}，住进${cityInfo.scene}。目标：30 天攒到 ${fmt(iden.id === "rich" ? 30000 : iden.id === "flat" ? 5000 : cityInfo.goal, city)}。` }],
      finished: false,
      signDay: 0, dayBase: { day: 1, work: 0, meal: 0, scenic: 0 }, dayClaim: [],
    };
    finishedSent.current = false;
    profileRef.current = prof;
    setProfile(prof);
    setCurrentLoc("home");
    setSelectedLoc("home");
    gsRef.current = state;
    setGs(state);
    saveLocal(prof, state);
    setResult(null);
    setPhase("game");
    joinMut.mutate({ playerId: prof.playerId, name, emoji: iden.emoji, color: iden.color, cityKey: city });
  };

  const restart = () => {
    saveLocal(null, null);
    gsRef.current = null;
    setGs(null);
    setResult(null);
    finishedSent.current = false;
    setPhase("setup");
  };

  /* ---------- phone app actions ---------- */
  const promote = () => {
    const s0 = gsRef.current;
    if (!s0) return;
    const next = CAREERS[s0.careerIdx + 1];
    if (!next) return;
    if (s0.xp < next.needXp || s0.skill < next.needSkill) return;
    mutate((s) => { s.careerIdx += 1; s.npcNews = [...(s.npcNews ?? []), { kind: "career" as const, text: `升职成了「${next.name}」`, day: s.day }]; });
    setLevelFx({ name: next.name, nonce: Date.now() });
    window.setTimeout(() => setLevelFx(null), 2600);
    floatReward(`🎉 升职：${next.name}`, "gold");
    floatReward(`工资 ×${next.mul}`, "blue");
    burstDanmaku([`🎉 ${profileRef.current?.name ?? "你"}升职成「${next.name}」啦！`, "阿琳：恭喜升职！请客请客 📈", "老周：我就说这孩子有出息", "小美：升职加薪，冲冲冲 💪", "大芬姐：今晚来我摊上，送你一串", "陈伯：好事！街坊都沾光"]);
    showToast(`晋升！你现在是「${next.name}」，工资 ×${next.mul}。街坊们明天就会在动态墙上议论这件事。`);
    addLog(`晋升为「${next.name}」，工资倍率 ×${next.mul}。`);
    postFeed("career", `晋升为「${next.name}」，工资 ×${next.mul}`);
  };

  const acceptOffer = (offerIdx: number) => {
    const s0 = gsRef.current;
    if (!s0 || s0.energy < 18) return;
    const offer = OFFERS[offerIdx];
    if (!offer) return;
    const pay = Math.round(basePay(s0) * 0.55 * offer.mul);
    mutate((s) => {
      s.money += pay; s.earned += pay; s.energy -= 18; s.xp += 1;
    });
    showToast(`「${offer.name}」接单成功，+${fmt(pay)}，经验 +1。`);
    addLog(`招聘广场接下「${offer.name}」，+${fmt(pay)}。`);
    setPhoneOpen(false);
  };

  const orderFood = (idx: number) => {
    const s0 = gsRef.current;
    if (!s0) return;
    const f = FOODS[s0.cityKey][idx];
    if (!f) return;
    const cost = Math.round(f.cost * 1.5);
    mutate((s) => {
      s.money -= cost; s.energy += f.energy; s.mood += f.mood; s.mealCount += 1;
    });
    showToast(`${f.name}（外卖）到了，-${fmt(cost)}，能量 +${f.energy}。`);
    setPhoneOpen(false);
  };

  const taxiTo = (locId: string) => {
    const s0 = gsRef.current;
    if (!s0) return;
    const fromL = locById(currentLocRef.current); const toL = locById(locId);
    const fare = taxiFare(Math.hypot(toL.x - fromL.x, toL.z - fromL.z));
    if (s0.money < fare) { showToast(`打车到${toL.short}要 ${Y}${fare}，钱不够。`); return; }
    mutate((s) => { s.money -= fare; });
    setPhoneOpen(false);
    if (walkTimer.current) window.clearTimeout(walkTimer.current);
    setRoadRide(null);
    setRoadRideArrived(false);
    setWalking(false);
    pendingSleep.current = false;
    setSelectedLoc(locId);
    setAsideTab("place");
    setCurrentLoc(locId);
    currentLocRef.current = locId;
    showToast(`打车到${locById(locId).short}，-${Y}${fare}（按距离计价）。`);
  };

  /* ---------- NPC simulation: chat, favours, gifts, the street wall ---------- */
  const dayCtx = (): { day: number; cityKey: CityKey; playerName: string } => {
    const s0 = gsRef.current;
    return { day: s0?.day ?? 1, cityKey: s0?.cityKey ?? "sz", playerName: profileRef.current?.name ?? "我" };
  };

  const openNpcChat = (npcName: string) => {
    const s0 = gsRef.current;
    const npc = NPCS.find((n) => n.name === npcName);
    if (!s0 || !npc) return;
    const mem = memOf(s0.npcMem ?? {}, npcName);
    setNpcChat(npcName);
    setNpcLog([{ from: "npc", text: greetLine(npc, mem, dayCtx()) }]);
  };

  const doNpcChat = (action: ChatAction) => {
    const s0 = gsRef.current;
    const npc = NPCS.find((n) => n.name === npcChat);
    if (!s0 || !npc || !npcChat) return;
    if (action === "help" && s0.energy < 6) { showToast("能量不够，帮人也得先顾好自己——先吃点东西或歇会儿。"); return; }
    if (action === "gift" && s0.money < 25) { showToast(`送个小礼物要 ${fmt(25)}，钱包不够。先攒点钱，或者帮他个忙也一样暖心。`); return; }
    const mem = memOf(s0.npcMem ?? {}, npcChat);
    const repeatedToday = mem.lastDay === s0.day;
    const outcome = chatReply(npc, mem, action, dayCtx(), repeatedToday);
    const topicOf: Record<ChatAction, string> = { greet: "", weather: "天气", work: "工作", apec: "APEC", joke: "开玩笑", help: "帮忙", gift: "送礼物" };
    mutate((s) => {
      const m = { ...memOf(s.npcMem ?? {}, npcChat) };
      m.talks += 1;
      m.rel = Math.max(-100, Math.min(100, m.rel + outcome.relDelta));
      if (outcome.favour) { m.helps += 1; s.energy -= 6; }
      if (outcome.giftGiven) { m.gifts += 1; s.money -= 25; }
      if (outcome.slight) m.slights += 1;
      if (outcome.note) m.note = outcome.note;
      if (topicOf[action]) m.lastTopic = topicOf[action];
      m.lastDay = s.day;
      s.npcMem = { ...(s.npcMem ?? {}), [npcChat]: m };
      // First real conversation of the day still warms the player up.
      if (!s.greeted.includes(npcChat)) {
        s.greeted = [...s.greeted, npcChat];
        s.mood += 3;
        if (Math.random() < 0.3) s.network += 1;
      }
    });
    const playerLines: Record<ChatAction, string> = {
      greet: "嗨，最近怎么样？",
      weather: "今天这天儿，你觉得怎么样？",
      work: "最近活儿忙不忙？",
      apec: "APEC 这事儿，你怎么看？",
      joke: "跟你讲个笑话：为什么程序员分不清万圣节和圣诞节？因为 Oct 31 == Dec 25。",
      help: "看你忙的，需要搭把手吗？我来帮你。",
      gift: `这个送你（${fmt(25)} 的小礼物），不值钱，就图个乐呵，别嫌弃。`,
    };
    setNpcLog((log) => [...log, { from: "me", text: playerLines[action] }, { from: "npc", text: outcome.reply }]);
    if (outcome.favour) addLog(`帮了${npc.name}一个忙，他记下了这份人情。`);
    else if (outcome.slight) addLog(`和${npc.name}聊天，玩笑开过了头，他有点不高兴。`);
    else if (outcome.giftGiven) addLog(`送了${npc.name}一份小礼物，关系暖和了些。`);
  };

  const likeNpcPost = (postId: string) => {
    mutate((s) => {
      s.npcFeed = (s.npcFeed ?? []).map((p) => (p.id === postId && !p.liked ? { ...p, liked: true, likes: p.likes + 1 } : p));
      const post = (s.npcFeed ?? []).find((p) => p.id === postId);
      if (post) {
        const m = { ...memOf(s.npcMem ?? {}, post.author) };
        m.rel = Math.min(100, m.rel + 1);
        s.npcMem = { ...(s.npcMem ?? {}), [post.author]: m };
      }
    });
  };

  const commentNpcPost = (postId: string, text: string) => {
    const s0 = gsRef.current;
    if (!s0) return;
    const post = (s0.npcFeed ?? []).find((p) => p.id === postId);
    if (!post || post.playerComment) return;
    const mem = memOf(s0.npcMem ?? {}, post.author);
    const reply = authorReply(post, mem, text, s0.day);
    mutate((s) => {
      s.npcFeed = (s.npcFeed ?? []).map((p) => {
        if (p.id !== postId) return p;
        const comments = [...p.comments, { author: profileRef.current?.name ?? "我", text }];
        if (reply) comments.push({ author: p.author, text: `回复你：${reply}` });
        return { ...p, playerComment: text, comments };
      });
      const m = { ...memOf(s.npcMem ?? {}, post.author) };
      m.rel = Math.min(100, m.rel + 2);
      s.npcMem = { ...(s.npcMem ?? {}), [post.author]: m };
    });
  };

  const buyTemplate = (tplId: string) => {
    const s0 = gsRef.current;
    if (!s0) return;
    const t = TEMPLATES.find((x) => x.id === tplId);
    if (!t) return;
    const price = tplQuote(t);
    if (s0.money < price) return;
    mutate((s) => {
      s.money -= price;
      s.homeSpent += price;
      s.homeStyle = t.name;
      s.rent = Math.round((s.baseRent * t.rentMul) / 10) * 10;
      s.npcNews = [...(s.npcNews ?? []), { kind: "home" as const, text: `把家装成了「${t.name}」风格`, day: s.day }];
    });
    showToast(`家里换上了「${t.name}」风格，周租变 ${fmt(Math.round((s0.baseRent * t.rentMul) / 10) * 10)}，舒适度大涨。`);
    addLog(`按 ZhuyaHome「${t.name}」模板装修，-${fmt(price)}。`);
    postFeed("home", `把家装成了 ZhuyaHome「${t.name}」风格`);
  };

  const buyFurniture = (fid: string) => {
    const s0 = gsRef.current;
    if (!s0) return;
    const f = furnById(fid);
    if (!f || s0.furniture.includes(fid) || s0.money < f.price) return;
    mutate((s) => {
      s.money -= f.price;
      s.homeSpent += f.price;
      s.furniture = [...s.furniture, fid];
    });
    showToast(`买下「${f.name}」，舒适度 +${f.comfort}。`);
    addLog(`购入家具「${f.name}」，-${fmt(f.price)}。`);
  };

  const wearOutfit = (id: string) => {
    const o = outfitOf(id);
    mutate((x) => { x.outfit = id; });
    showToast(`换上了${o.emoji}「${o.name}」：${o.scene}。`);
    addLog(`换装：${o.name}。${o.scene}。`);
  };
  const buyOutfit = (id: string) => {
    const s0 = gsRef.current;
    if (!s0) return;
    const o = outfitOf(id);
    if (s0.ownedOutfits.includes(id)) { wearOutfit(id); return; }
    if (s0.money < o.price) { showToast(`「${o.name}」要 ${fmt(o.price)}，钱不够，还差 ${fmt(o.price - s0.money)}。`); return; }
    mutate((x) => { x.money -= o.price; x.ownedOutfits = [...x.ownedOutfits, id]; x.outfit = id; });
    showToast(`买下并穿上${o.emoji}「${o.name}」，-${fmt(o.price)}。${o.scene}。`);
    addLog(`购入服装「${o.name}」，-${fmt(o.price)}，已穿上。`);
  };

  const sendChatMut = useMutation({
    mutationFn: (body: string) => api.postChat({ playerId: profileRef.current?.playerId ?? "", body }),
    onSuccess: () => {
      setChatInput("");
      queryClient.invalidateQueries({ queryKey: ["world", cityKey] });
    },
  });

  /* ---------- venue scenes: dine / shop / stay ---------- */
  const sceneFlag = (k: string) => !!sceneFlags[k];
  const setSceneFlag = (k: string) => setSceneFlags((f) => ({ ...f, [k]: true }));
  const dineEat = (restName: string, dishIdx: number) => {
    const r = RESTAURANTS.find((x) => x.id === venueScene?.id); if (!r) return;
    const d = r.dishes[dishIdx]; if (!d) return;
    const s0 = gsRef.current; if (!s0 || s0.money < d.cost) { showToast("钱包不够这道菜，先看看菜单过过瘾。"); return; }
    mutate((s) => { s.money -= d.cost; s.energy += d.energy; s.mood += d.mood; s.mealCount += 1; });
    showToast(`🍽️ ${d.name}上桌了，-${fmt(d.cost)}，能量 +${d.energy}，心情 +${d.mood}。`);
    addLog(`在${restName}堂食「${d.name}」，-${fmt(d.cost)}。`);
playLifeAnim("eat");
  };
  const orderDelivery = (platIdx: number, foodIdx: number) => {
    const s0 = gsRef.current; if (!s0) return;
    const plat = DELIVERY_PLATFORMS[platIdx]; const f = FOODS[s0.cityKey][foodIdx];
    if (!plat || !f) return;
    const cost = Math.round(f.cost * plat.feeMul);
    if (s0.money < cost) { showToast("钱不够点这单外卖。"); return; }
    mutate((s) => { s.money -= cost; s.energy += f.energy; s.mood += f.mood; s.mealCount += 1; });
    showToast(`${plat.emoji} ${plat.name}：${f.name}送到了，-${fmt(cost)}，能量 +${f.energy}。骑手在楼下等你取餐。`);
    addLog(`用${plat.name}点了${f.name}外卖，-${fmt(cost)}。`);
  };
  const shopBuy = (venueName: string, itemIdx: number) => {
    const v = SHOP_VENUES.find((x) => x.id === venueScene?.id); if (!v) return;
    const it = v.items[itemIdx]; if (!it) return;
    const s0 = gsRef.current; if (!s0 || s0.money < it.cost) { showToast("钱不够，先逛逛过眼瘾。"); return; }
    mutate((s) => { s.money -= it.cost; s.mood += it.mood; });
    showToast(`🛍️ 在${venueName}买下「${it.name}」，-${fmt(it.cost)}，心情 +${it.mood}。`);
    addLog(`在${venueName}买了「${it.name}」，-${fmt(it.cost)}。`);
playLifeAnim("shopping");
  };
  const stayOvernight = (lodgingId: string) => {
    const l = LODGINGS.find((x) => x.id === lodgingId); const s0 = gsRef.current;
    if (!l || !s0) return;
    if (s0.money < l.price) { showToast(`住一晚要 ${Y}${l.price}，钱不够。`); return; }
    const hostelNet = lodgingId === "hostel" && Math.random() < 0.6;
    mutate((s) => { s.money -= l.price; s.mood += l.mood; if (hostelNet) s.network += 1; });
    setVenueScene(null);
    showToast(`🛏️ 在「${l.name}」住下了，-${Y}${l.price}。${hostelNet ? "客厅里聊得投机，人脉 +1。" : ""}好好睡一觉到明天。`);
    addLog(`在「${l.name}」过夜，-${Y}${l.price}，心情 +${l.mood}。`);
    window.setTimeout(() => playLifeAnim("sleep", () => doSleep()), 350);
  };
  const signRent = () => {
    const s0 = gsRef.current; if (!s0) return;
    const weekly = rentFlatWeekly(s0.cityKey);
    mutate((s) => { s.baseRent = weekly; s.rent = weekly; s.mood += 10; });
    setVenueScene(null);
    showToast(`🔑 签约成功！新家长租公寓，周租 ${fmt(weekly)}，从下周六按新价交租。`);
    addLog(`签约长租公寓，周租改为 ${fmt(weekly)}。`);
    postFeed("home", "签约了长租公寓，换了个住法");
  };

  /* ---------- per-location action table ---------- */
  interface ActDef {
    kind: string;
    arg?: number;
    title: string;
    emoji: string;
    desc: string;
    cost: string;
    disabled?: boolean;
  }

  const actionsFor = (loc: Loc, s: GameState): ActDef[] => {
    const base = basePay(s);
    const city = CITIES[s.cityKey];
    const fitSave = s.fit >= 3 ? 3 : 0;
    switch (loc.type) {
      case "home":
        return [
          { kind: "__sleep", title: "睡觉到明天", emoji: "😴", desc: "回满能量，周六睡前自动交租（先演一段洗漱入睡）", cost: "能量回满" },
          { kind: "wash", title: "起床洗漱", emoji: "🪥", desc: "刷牙、洗脸、整理自己，新的一天从卫生间开始", cost: "能量 +6 · 心情 +6 · 免费" },
          { kind: "cook", title: "自己做饭", emoji: "🍳", desc: `用冰箱里的食材做一顿（当前食材 ×${s.groceries}）：洗菜、切菜、下锅、上桌`, cost: "食材 -1 · 能量 +34 · 心情 +9", disabled: s.groceries <= 0 },
          { kind: "buy-groceries", title: "楼下买菜", emoji: "🥬", desc: "下楼到菜摊买一篮子菜，囤进冰箱慢慢做", cost: `-${Y}28 · 食材 +1`, disabled: s.money < 28 },
          { kind: "rest", title: "躺平摸鱼", emoji: "🛋️", desc: "刷手机、睡午觉，不花钱回血（穿睡衣恢复更多）", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "work":
        return [
          { kind: "work", title: "正经上班", emoji: "🏢", desc: `干一天活拿一天钱 · 职级「${(CAREERS[s.careerIdx] ?? CAREERS[0]!).name}」工资 ×${(CAREERS[s.careerIdx] ?? CAREERS[0]!).mul} · 经验 +2`, cost: `+${fmt(base)} · 能量 -${28 - fitSave}`, disabled: s.energy < 28 - fitSave },
          { kind: "overtime", title: "拼命加班", emoji: "🔥", desc: "老板画饼你吃饼，钱多但掉心情", cost: `+${fmt(Math.round(base * 1.75))} · 能量 -${42 - fitSave} · 心情 -12`, disabled: s.energy < 42 - fitSave },
        ];
      case "transit":
        return [
          { kind: "gig", title: loc.gigName ?? city.gigName, emoji: "🛵", desc: "在站点附近接单，灵活、来钱快一点点", cost: `+${fmt(Math.round(base * 0.55))} 起 · 能量 -18`, disabled: s.energy < 18 },
          ...(loc.id === "port" ? [{ kind: "ferry", title: "坐轮渡出海", emoji: "⛴️", desc: "蛇口出发，甲板看海、看大桥", cost: `-${Y}60 · 心情 +18 · 能量 -6` }] : []),
          ...(loc.id === "airport" || loc.id === "pingtan-airport" ? [{ kind: "flight", title: "坐飞机远行一天", emoji: "✈️", desc: "挑个便宜航线出门看看，晚上回来", cost: `-${Y}420 · 心情 +26 · 能量 -14`, disabled: s.money < 420 }] : []),
          { kind: "rest", title: "在站里歇会儿", emoji: "🧋", desc: "买杯水、坐一会儿，看人来人往", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "port":
        return [
          { kind: "gig", title: loc.gigName ?? city.gigName, emoji: "🛵", desc: "口岸附近接单，跨境客流不断", cost: `+${fmt(Math.round(base * 0.55))} 起 · 能量 -18`, disabled: s.energy < 18 },
          ...(s.cityKey === "hk" ? [
            { kind: "__gocity-sz", title: "过关回深圳", emoji: "🛃", desc: "出示证件、过安检、入境——过桥就是罗湖，或者去西九龙站坐高铁。搬回深圳过日子，进度、家当原样带着", cost: `高铁 ${crossFareLabel("hk", intercityFare("hk", "sz"))} · 进度不变 · 钱不够免费过` },
            { kind: "rest", title: "在口岸歇会儿", emoji: "🧋", desc: "看人来人往过关，买杯水坐一会儿", cost: "能量 +14 · 心情 +8 · 免费" },
          ] : [
            { kind: "hk-trip", title: "过关去香港一日游", emoji: "🇭🇰", desc: "旺角、天星小轮、茶餐厅，过关当天来回", cost: `-${Y}180 · 心情 +22 · 能量 -16 · 人脉 +1`, disabled: s.money < 180 },
            { kind: "__gocity-hk", title: "过关去香港过日子", emoji: "🛃", desc: "不只是一日游——搬过去住一段：坐高铁到西九龙站，一地两检过关（出示证件、安检、入境），地图、港铁、街坊全换成香港的", cost: `高铁 ${crossFareLabel(s.cityKey, intercityFare(s.cityKey, "hk"))} · 进度不变 · 钱不够免费过` },
            { kind: "rest", title: "在口岸歇会儿", emoji: "🧋", desc: "看人来人往过关，买杯水坐一会儿", cost: "能量 +14 · 心情 +8 · 免费" },
          ]),
        ];
      case "scenic":
      case "mountain":
        return [
          { kind: "fun", title: loc.funName ?? city.funName, emoji: "✨", desc: loc.funDesc ?? city.funDesc, cost: `-${fmt(loc.funCost ?? city.funCost)} · 心情 +${loc.funMood ?? city.moodFun}` },
          { kind: "checkin", title: "拍照打卡", emoji: "📸", desc: "在地标前打卡，集风景册（见下方打卡进度）", cost: "心情 +12 · 免费" },
          { kind: "stroll", title: "慢慢散步", emoji: "🚶", desc: "不赶时间，沿着风景慢慢走一圈", cost: "能量 -4 · 心情 +12 · 免费" },
          ...(loc.type === "mountain" ? [{ kind: "hike", title: "登山徒步练体质", emoji: "🥾", desc: "爬一趟山，体质和心情一起涨", cost: "能量 -16 · 心情 +20 · 体质 +1", disabled: s.energy < 16 }] : []),
          { kind: "rest", title: "原地发呆", emoji: "🌤️", desc: "什么都不做，也是一种恢复", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "food":
        return [{ kind: "buy-groceries", title: "买菜囤食材", emoji: "🥬", desc: `在摊位上挑新鲜的菜、蛋、肉，拎回家放冰箱（当前食材 ×${s.groceries}）`, cost: `-${Y}28 · 食材 +1`, disabled: s.money < 28 },
        ...FOODS[s.cityKey].map((f, i) => ({
          kind: "eat", arg: i, title: f.name, emoji: f.emoji, desc: f.desc,
          cost: `-${fmt(f.cost)} · 能量 +${f.energy} · 心情 +${f.mood}`,
        }))];
      case "fun":
        return [
          { kind: "fun", title: loc.funName ?? city.funName, emoji: "✨", desc: loc.funDesc ?? city.funDesc, cost: `-${fmt(loc.funCost ?? city.funCost)} · 心情 +${loc.funMood ?? city.moodFun}` },
          ...(scenicOf(s.cityKey, loc.id) ? [{ kind: "checkin", title: "拍照打卡", emoji: "📸", desc: scenicOf(s.cityKey, loc.id)?.tip ?? "在地标前打卡留念", cost: "心情 +12 · 免费" }] : []),
          { kind: "rest", title: "原地发呆", emoji: "🌤️", desc: "什么都不做，也是一种恢复", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "learn":
        return [
          { kind: "learn-course", title: "夜校充电课", emoji: "🎓", desc: "职业技能课，升职的硬通货", cost: `-${Y}30 · 能量 -15 · 技能 +1 · 经验 +1`, disabled: s.energy < 15 },
          { kind: "learn-self", title: "自习备考", emoji: "📖", desc: "免费自习，慢慢攒技能", cost: "能量 -10 · 技能 +1 · 心情 +2 · 免费", disabled: s.energy < 10 },
        ];
      case "apec": {
        const mul = apecVenueMul(s.day, loc.id);
        const mulTxt = mul > 1 ? `，今天收入 ×${mul}` : "，领导人周（14–19 日）重点日收入 ×1.5";
        const task = apecTaskOfDay(s.day);
        const checked = (s.apecCheckins ?? []).includes(loc.id);
        const taskDone = task ? (s.apecTasks ?? []).includes(task.id) : false;
        return [
          { kind: "apec-checkin", title: checked ? "会场打卡 ✓ 已完成" : "📸 会场打卡", emoji: "📸", desc: checked ? "这个会场已经在你的 APEC 打卡册里了" : `在${loc.short}地标前打卡，集齐三个会场（已打卡 ${(s.apecCheckins ?? []).length} / 3）`, cost: "心情 +6 · 免费", disabled: checked },
          ...(task && task.venueLocId === loc.id ? [{ kind: "apec-task", title: taskDone ? `今日任务 ✓ ${task.title}` : `${task.roleEmoji} 今日任务：${task.title}`, emoji: task.roleEmoji, desc: taskDone ? "今天的班已经上完了，明天还有新任务" : `${task.dateLabel} · ${task.event}——你当${task.role}。${checked ? task.desc : "先打卡，再上岗。" + task.desc}`, cost: taskDone ? "已完成" : `+${fmt(Math.round(base * task.payMul))} · 能量 -${task.energy} · 经验 +${task.xp} · 人脉 +${task.network}`, disabled: taskDone || !checked || s.energy < task.energy }] : []),
          { kind: "apec-staff", title: "会务服务兼职", emoji: "🎪", desc: `布展、引导、物料分发——以工作人员身份参与${mulTxt}`, cost: `+${fmt(Math.round(base * 0.9 * mul))} · 能量 -22 · 经验 +2`, disabled: s.energy < 22 },
          { kind: "apec-host", title: "外宾接待引导", emoji: "🌐", desc: s.skill < 1 ? "需要技能 ≥1（先去图书馆/夜校学一课）" : `陪代表团参观、答疑、引导，最锻炼人也最长脸${mulTxt}`, cost: `+${fmt(Math.round(base * 1.25 * mul))} · 能量 -20 · 经验 +3 · 人脉 +1`, disabled: s.energy < 20 || s.skill < 1 },
          { kind: "apec-visit", title: "参观主题展陈", emoji: "🎫", desc: "21 个成员经济体的展陈挨个看，集章、看会徽背后的故事", cost: `-${Y}20 · 心情 +10 · 可能 +人脉` },
        ];
      }
      case "mall":
        return [
          { kind: "mall-shop", title: "逛街购物", emoji: "🛍️", desc: "日用品、小玩意儿，快乐很直接", cost: `-${Y}120 · 心情 +14` },
          { kind: "mall-cloth", title: "买身新衣服", emoji: "👔", desc: "人靠衣装，面试和社交都体面些", cost: `-${Y}300 · 心情 +20 · 人脉 +1` },
          { kind: "mall-promo", title: "商场促销兼职", emoji: "📣", desc: "站柜台发传单，活儿不重", cost: `+${fmt(Math.round(base * 0.5))} · 能量 -16 · 经验 +1`, disabled: s.energy < 16 },
        ];
      case "health":
        return [
          { kind: "health-check", title: "全面体检", emoji: "🩺", desc: "查个明白，顺便把作息调整过来", cost: `-${Y}150 · 能量 +8 · 心情 +6 · 体质 +1` },
          { kind: "health-cure", title: "看病调理", emoji: "💊", desc: "小毛病别拖，调理完神清气爽", cost: `-${Y}80 · 能量 +18 · 心情 +3` },
        ];
      case "gym":
        return [
          { kind: "gym", title: "认真练一次", emoji: "💪", desc: `练够 3 次体质变好，上班能量消耗 -3（当前已练 ${s.fit} 次）`, cost: `-${Y}30 · 能量 -10 · 心情 +10 · 体质 +1`, disabled: s.energy < 10 },
          { kind: "rest", title: "拉伸放松", emoji: "🧘", desc: "不花钱，活动活动筋骨", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "lodging":
        return [
          { kind: "rest", title: "在大堂坐坐", emoji: "🛋️", desc: "蹭个沙发和空调，看看住客来来往往", cost: "能量 +14 · 心情 +8 · 免费" },
          { kind: "gig", title: loc.gigName ?? "酒店帮工 / 行李员", emoji: "🧳", desc: "帮住客搬行李、做接待，旺季单多", cost: `+${fmt(Math.round(base * 0.55))} 起 · 能量 -18`, disabled: s.energy < 18 },
        ];
      case "bank":
        return [
          { kind: "bank-buy", title: `买理财 ${Y}1,000`, emoji: "📈", desc: `每晚约 +0.4% 收益，小概率波动亏损（当前理财 ${fmt(s.invest)}）`, cost: `-${Y}1,000 现金 · 转入理财`, disabled: s.money < 1000 },
          { kind: "bank-sell", title: "取出全部理财", emoji: "💰", desc: "连本带收益回到存款", cost: `+${fmt(s.invest)}`, disabled: s.invest <= 0 },
        ];
      case "social":
        return [
          { kind: "social-ktv", title: "约朋友唱 K", emoji: "🎤", desc: "吼两嗓子，烦恼减半，朋友加一", cost: `-${Y}88 · 心情 +18 · 人脉 +1` },
          { kind: "social-drink", title: "小酌一杯", emoji: "🍻", desc: "微醺刚好，聊聊最近的行情", cost: `-${Y}45 · 心情 +10 · 能量 +4` },
        ];
      case "market":
        return [
          { kind: "buy-groceries", title: "市集买菜", emoji: "🥬", desc: `郭叔的菜摊新鲜又便宜，买一篮子囤着（当前食材 ×${s.groceries}）`, cost: `-${Y}28 · 食材 +1`, disabled: s.money < 28 },
          { kind: "market-phone", title: s.cityKey === "sz" ? "淘二手手机" : "淘二手好物", emoji: "📱", desc: "眼力决定收益：捡漏转手能赚，踩坑就自用", cost: `-${Y}400 · 约一半概率转手 +${Y}650`, disabled: s.money < 400 },
          { kind: "market-fix", title: "装机 / 维修兼职", emoji: "🛠️", desc: "帮摊主装机修小电器，手艺活", cost: `+${fmt(Math.round(base * 0.6))} · 能量 -20 · 经验 +1`, disabled: s.energy < 20 },
        ];
      default:
        return [];
    }
  };

/* ---------- derived render data ---------- */
const myId = profile?.playerId ?? profileRef.current?.playerId ?? "";
const remotePlayers = (world?.online ?? [])
.filter((pl) => pl.cityKey === cityKey && pl.id !== myId)
.map((pl) => ({ id: pl.id, name: pl.name, emoji: pl.emoji, color: pl.color, locId: pl.locId }));
const onlineHere = (world?.online ?? []).filter((pl) => pl.cityKey === cityKey);
const timeStr = (iso: string) => new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

const renderHomePanel = (s: GameState) => (
<div className="mt-4 border-t border-[var(--line)] pt-4">
{(() => { const tpl = tplByName(s.homeStyle); const wall = hexCss(tpl?.wall ?? 0xefe9dc); const floor = hexCss(tpl?.floor ?? 0xb8a888); const atHome = currentLoc === "home"; return (
<div className="mb-3">
<div className="grid grid-cols-2 gap-2" role="img" aria-label={`户型图：${homeName(s)}，客厅、卧室、厨房、卫生间四间，已摆 ${s.furniture.length} 件家具，食材 ${s.groceries} 份`}>
{HOME_ROOMS.map((room, ri) => {
const ownedHere = s.furniture.flatMap((id) => { const f = furnById(id); return f && f.room === room.id ? [f] : []; });
const items = [...room.items.slice(0, 4), ...ownedHere.map((f) => ({ emoji: f.emoji, label: f.name }))].slice(0, 8);
return (
<div key={room.id} className="relative overflow-hidden rounded-[12px] border border-[var(--line)] p-2.5" style={{ background: `linear-gradient(165deg, ${wall} 58%, ${floor} 130%)` }}>
<p className="text-xs font-black text-black/75">{room.emoji} {room.name}{room.id === "kitchen" && s.groceries > 0 ? <span className="ml-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] text-white">食材 ×{s.groceries}</span> : null}{room.id === "bedroom" ? <span className="ml-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] text-white">穿着{outfitOf(s.outfit).name}</span> : null}</p>
<div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
{items.map((it) => (<span key={it.label} className="text-[11px] font-bold text-black/65"><span className="text-base">{it.emoji}</span> {it.label}</span>))}
</div>
{room.id === "kitchen" && s.groceries > 0 && <span aria-hidden="true" className="life-steam" style={{ right: 14, top: 22 }}>💨</span>}
<p className="mt-1.5 text-[11px] leading-snug text-black/55">{room.detail}</p>
{ri === 0 && <span className="pointer-events-none absolute -right-1 -top-1 text-[44px] opacity-15">🪟</span>}
</div>
); })}
</div>
<div className="mt-2 grid grid-cols-4 gap-1.5">
<button type="button" aria-label="在厨房做饭" disabled={!atHome || s.groceries <= 0} onClick={() => doAction("cook")} className="rounded-full bg-[var(--text)] px-2 py-2 text-[11px] font-black text-[var(--bg)] disabled:opacity-40">🍳 厨房做饭</button>
<button type="button" aria-label="在卫生间洗漱" disabled={!atHome} onClick={() => doAction("wash")} className="rounded-full bg-[var(--text)] px-2 py-2 text-[11px] font-black text-[var(--bg)] disabled:opacity-40">🪥 卫生间洗漱</button>
<button type="button" aria-label="在客厅躺平" disabled={!atHome} onClick={() => doAction("rest")} className="rounded-full bg-[var(--text)] px-2 py-2 text-[11px] font-black text-[var(--bg)] disabled:opacity-40">🛋️ 客厅躺平</button>
<button type="button" aria-label="回卧室睡觉" disabled={!atHome} onClick={() => playLifeAnim("sleep", () => doSleep())} className="rounded-full bg-[var(--accent)] px-2 py-2 text-[11px] font-black text-white disabled:opacity-40">🛏️ 卧室睡觉</button>
</div>
{!atHome && <p className="mt-1.5 text-[11px] text-[var(--dim)]">房间里的动作要先回到家才能做（现在不在家）。</p>}
<div className="mt-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<p className="text-xs font-black tracking-wide text-[var(--dim)]">👕 卧室衣柜 · 按场合换装（现在穿：{outfitOf(s.outfit).emoji} {outfitOf(s.outfit).name}）{nowRainy ? " · 今天下雨，出门建议穿雨衣" : ""}</p>
<div className="mt-2 grid gap-1.5">
{OUTFITS.map((o) => {
const ownedO = s.ownedOutfits.includes(o.id);
const wearing = s.outfit === o.id;
return (
<div key={o.id} className="flex items-center gap-2.5 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
<span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg" style={{ background: hexCss(o.shirt) + "33" }}>{o.emoji}</span>
<span className="min-w-0 flex-1"><span className="text-[13px] font-bold">{o.name}</span><span className="block truncate text-[11px] text-[var(--dim)]">{o.desc} · {o.scene}</span></span>
<button type="button" aria-label={wearing ? `正穿着${o.name}` : ownedO ? `换上${o.name}` : `购买并穿上${o.name}`} disabled={wearing || (!ownedO && s.money < o.price)} onClick={() => buyOutfit(o.id)} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-1.5 text-[11px] font-black text-[var(--bg)] disabled:opacity-40">{wearing ? "穿着中" : ownedO ? "换上" : `${fmt(o.price)} 买下`}</button>
</div>
); })}
</div>
</div>
</div> ); })()}
<p className="text-sm font-bold">🏠 {homeName(s)} · 舒适度 {computeComfort(s)} · 周租 {fmt(s.rent)} · 已购家具 {s.furniture.length} 件</p>
<p className="mt-1 text-xs text-[var(--dim)]">舒适度越高，每天睡醒心情回得越多；家具和风格同款搭配还有额外加成。数据来自 ZhuyaHome 的风格模板、家具目录与材料价。</p>
<p className="mt-3 text-xs font-black tracking-wide text-[var(--dim)]">换个装修风格（ZhuyaHome 模板）</p>
<div className="mt-2 grid gap-2">
{TEMPLATES.map((t) => {
const price = tplQuote(t);
const isCur = s.homeStyle === t.name;
return (
<div key={t.id} className="flex items-start gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<div className="text-2xl">{t.emoji}</div>
<div className="min-w-0 flex-1">
<p className="text-sm font-bold">{t.name} <span className="text-[var(--accent)]">{fmt(price)}</span></p>
<p className="text-xs leading-relaxed text-[var(--dim)]">{t.desc}</p>
<p className="mt-1 text-xs text-[var(--dim)]">墙面 {fmt(t.wallPrice)}/㎡ · 地板 {fmt(t.floorPrice)}/㎡ · 装完周租 {fmt(Math.round((s.baseRent * t.rentMul) / 10) * 10)} · 舒适度 {t.comfort}</p>
</div>
<button type="button" aria-label={`换成${t.name}风格`} disabled={isCur || s.money < price} onClick={() => buyTemplate(t.id)} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)] disabled:opacity-40">
{isCur ? "当前风格" : "就它了"}
</button>
</div>
);
})}
</div>
<p className="mt-3 text-xs font-black tracking-wide text-[var(--dim)]">买家具（ZhuyaHome 目录）</p>
<div className="mt-2 grid gap-2">
{FURNITURE.map((f) => {
const owned = s.furniture.includes(f.id);
const match = s.homeStyle != null && f.styles.includes(s.homeStyle);
return (
<div key={f.id} className="flex items-start gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<div className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-2xl" style={{ background: hexCss(f.color) + "33" }}>{f.emoji}</div>
<div className="min-w-0 flex-1">
<p className="text-sm font-bold">{f.name} <span className="text-[var(--accent)]">{fmt(f.price)}</span></p>
<p className="text-xs leading-relaxed text-[var(--dim)]">{f.desc}</p>
<p className="mt-1">
{f.styles.map((st) => (
<span key={st} className={`mr-1 inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold ${match && st === s.homeStyle ? "border-green-600 bg-green-100 text-green-900" : "border-[var(--line)] text-[var(--dim)]"}`}>{st}</span>
))}
<span className="text-[11px] text-[var(--dim)]">舒适 +{f.comfort}</span>
</p>
</div>
<button type="button" aria-label={`购买${f.name}`} disabled={owned || s.money < f.price} onClick={() => buyFurniture(f.id)} className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-2 text-xs font-black text-white disabled:opacity-40">
{owned ? "已拥有" : "买"}
</button>
</div>
);
})}
</div>
</div>
);

const renderPhoneApp = (s: GameState, appId: AppId) => {
const career = CAREERS[s.careerIdx] ?? CAREERS[0]!;
const next = CAREERS[s.careerIdx + 1] ?? null;
switch (appId) {
case "career":
return (
<div>
<p className="text-sm">当前职级：<b>「{career.name}」</b>，工资 ×{career.mul}</p>
<p className="mt-1 text-xs text-[var(--dim)]">经验 {s.xp} · 技能 {s.skill}（上班/兼职攒经验，图书馆/夜校攒技能）</p>
{next ? (
<div className="mt-3">
<p className="text-sm">下一级：<b>「{next.name}」</b>工资 ×{next.mul}，需要经验 {next.needXp} / 技能 {next.needSkill}</p>
<button type="button" onClick={promote} disabled={s.xp < next.needXp || s.skill < next.needSkill} className="mt-3 w-full rounded-full bg-[var(--accent)] py-3 text-sm font-black text-white disabled:opacity-40">
{s.xp >= next.needXp && s.skill >= next.needSkill ? `晋升为「${next.name}」` : "还没达到晋升条件"}
</button>
</div>
) : <p className="mt-3 text-sm">👑 已是最高职级，城市合伙人。</p>}
</div>
);
case "jobs":
return (
<div className="grid gap-2">
{OFFERS.map((o, i) => {
const pay = Math.round(basePay(s) * 0.55 * o.mul);
return (
<div key={o.name} className="flex items-center gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<div className="min-w-0 flex-1">
<p className="text-sm font-bold">{o.name} <span className="text-[var(--accent)]">约 {fmt(pay)}</span></p>
<p className="text-xs text-[var(--dim)]">{o.note} · 能量 -18 · 经验 +1</p>
</div>
<button type="button" aria-label={`接单${o.name}`} disabled={s.energy < 18} onClick={() => acceptOffer(i)} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)] disabled:opacity-40">接单</button>
</div>
);
})}
</div>
);
case "food":
return (
<div className="grid gap-2">
{FOODS[s.cityKey].map((f, i) => (
<div key={f.name} className="flex items-center gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<div className="text-2xl">{f.emoji}</div>
<div className="min-w-0 flex-1">
<p className="text-sm font-bold">{f.name} <span className="text-[var(--accent)]">{fmt(Math.round(f.cost * 1.5))}</span></p>
<p className="text-xs text-[var(--dim)]">{f.desc} · 能量 +{f.energy} · 心情 +{f.mood}（含配送费）</p>
</div>
<button type="button" aria-label={`点外卖${f.name}`} onClick={() => orderFood(i)} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">下单</button>
</div>
))}
</div>
);
case "taxi":
return (
<div className="grid max-h-[46vh] gap-2 overflow-y-auto pr-1">
{getLocations(s.cityKey).map((l) => (
<button key={l.id} type="button" onClick={() => taxiTo(l.id)} disabled={l.id === currentLoc} className="act-btn disabled:opacity-40">
<span className="text-sm font-bold">{l.emoji} {l.name}</span>
<span className="block text-xs text-[var(--dim)]">{l.id === currentLoc ? "你在这里" : `打车 ${Y}${taxiFare(Math.hypot(l.x - locById(currentLoc).x, l.z - locById(currentLoc).z))}（按距离），立刻到达`}</span>
</button>
))}
</div>
);
case "bank":
return (
<div>
<p className="text-sm">存款 <b>{fmt(s.money)}</b> · 理财 <b>{fmt(s.invest)}</b></p>
<p className="mt-1 text-xs text-[var(--dim)]">理财每晚约 +0.4%，小概率波动亏损约 3%。</p>
<div className="mt-3 grid grid-cols-2 gap-2">
<button type="button" disabled={s.money < 1000} onClick={() => { mutate((x) => { x.money -= 1000; x.invest += 1000; }); showToast(`买入理财 ${fmt(1000)}。`); }} className="rounded-full bg-[var(--text)] py-3 text-sm font-black text-[var(--bg)] disabled:opacity-40">买理财 {fmt(1000)}</button>
<button type="button" disabled={s.invest <= 0} onClick={() => { mutate((x) => { const a = x.invest; x.money += a; x.invest = 0; }); showToast("理财已全部取出。"); }} className="rounded-full border-2 border-[var(--text)] py-3 text-sm font-black disabled:opacity-40">全部取出</button>
</div>
</div>
);
case "social":
return (
<div>
<p className="text-xs font-black tracking-wide text-[var(--dim)]">同城真人（{onlineHere.length} 人在线）</p>
<div className="mt-2 flex flex-wrap gap-1.5">
{onlineHere.length === 0 && <span className="text-xs text-[var(--dim)]">暂时只有你一个人在线，去聊天频道喊一声。</span>}
{onlineHere.map((pl) => (
<span key={pl.id} className="chip">{pl.emoji} {pl.name}{pl.id === myId ? "（你）" : ""} · {locById(pl.locId).short}</span>
))}
</div>
<p className="mt-4 text-xs font-black tracking-wide text-[var(--dim)]">街坊邻居（每个人都有性格、心情和记性——你帮过谁、得罪过谁，他们都记得）</p>
<div className="mt-2 grid gap-2">
{npcsForCity(s.cityKey).map((n) => {
const mem = memOf(s.npcMem ?? {}, n.name);
const p = personaOf(n);
return (
<div key={n.name} className="flex items-start gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<div className="text-2xl">{n.emoji}</div>
<div className="min-w-0 flex-1">
<p className="text-sm font-bold">{n.name} <span className="font-normal text-[var(--dim)]">· {n.job}</span> <span className="chip ml-1">{moodEmoji(mem.mood)} {moodWord(mem.mood)}</span> <span className="chip">{relLabel(mem.rel)}{mem.rel !== 0 ? ` ${mem.rel > 0 ? "+" : ""}${mem.rel}` : ""}</span></p>
<p className="text-xs leading-relaxed text-[var(--dim)]">{n.line}</p>
<p className="text-[11px] text-[var(--dim)]">穿着：{n.outfit}</p>
<p className="text-[11px] text-[var(--dim)]">作息：{scheduleOf(n)}</p>
<p className="text-[11px] text-[var(--dim)]">性格：{p.warmth >= 0.65 ? "热心肠" : p.warmth <= 0.35 ? "慢热" : "随和"} · {p.humor >= 0.55 ? "开得起玩笑" : p.pride >= 0.6 ? "要面子，别乱开玩笑" : "不太爱开玩笑"} · {p.chattiness >= 0.6 ? "话多，爱发动态" : p.chattiness <= 0.35 ? "话少" : "话量适中"}</p>
{mem.note ? <p className="text-[11px] font-bold text-[var(--accent2)]">🧠 他记得：{mem.note}</p> : mem.talks > 0 ? <p className="text-[11px] text-[var(--dim)]">聊过 {mem.talks} 次，还没什么特别的事</p> : null}
</div>
<button type="button" aria-label={`找${n.name}聊天`} onClick={() => { setPhoneOpen(false); openNpcChat(n.name); }} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">
💬 聊天
</button>
</div>
); })}
</div>
<p className="mt-3 text-[11px] leading-relaxed text-[var(--dim)]">他们每天还会在右侧「🧑‍🤝‍🧑 街坊墙」发动态、互相评论——天气、APEC、你升职这种大事，他们都会聊。聊天、帮忙、送礼物都会被记住，第二天打招呼就不一样。</p>
</div>
);
case "cal": {
const days = Array.from({ length: 30 }, (_, i) => i + 1);
return (
<div>
<div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-[var(--dim)]">
{["一", "二", "三", "四", "五", "六", "日"].map((d) => <div key={d}>周{d}</div>)}
</div>
<div className="mt-1 grid grid-cols-7 gap-1">
{days.map((d) => (
<div key={d} className={`rounded-[8px] border px-0 py-1.5 text-center text-xs font-bold ${d === s.day ? "border-[var(--accent)] bg-[var(--accent)] text-white" : isApecWeek(d) && s.cityKey === "sz" ? "border-[var(--gold)] bg-[#fdf3d0] text-[#7a5b00]" : "border-[var(--line)]"}`}>
{d}
<div className="text-[9px] font-normal opacity-80">{isSaturday(d) ? "交租" : isApecWeek(d) && s.cityKey === "sz" ? "APEC" : weekday(d).replace("周", "")}</div>
</div>
))}
</div>
<p className="mt-2 text-xs text-[var(--dim)]">本月就是 11 月：14 日 APEC 领导人周开启，16 日太子湾欢迎晚宴，17–18 日前海 CEO 峰会，18–19 日香蜜湖领导人会议。每周六睡前交租。</p>
</div>
);
}
case "weather":
return (
<div className="grid gap-1.5">
<div className="rounded-[12px] border-2 border-[var(--accent2)] bg-[var(--bg)] px-3 py-2.5">
<p className="flex items-center justify-between text-sm font-black"><span>🌍 {city.name} · 此刻真实天气</span><button type="button" aria-label="刷新真实天气" onClick={() => weatherQuery.refetch()} className="rounded-full bg-[var(--accent2)] px-2.5 py-1 text-[11px] font-black text-white">刷新</button></p>
{rwOk ? (
<>
<p className="mt-1 text-sm">{RW_EMOJI[realWeather!.kind]} <b>{realWeather!.description || RW_LABEL[realWeather!.kind]}</b>{realWeather!.temperature != null && <> · {Math.round(realWeather!.temperature)}{realWeather!.unit}</>}{realWeather!.feelsLike != null && <> · 体感 {Math.round(realWeather!.feelsLike)}°</>}{realWeather!.high != null && realWeather!.low != null && <> · 今日 {Math.round(realWeather!.low)}°~{Math.round(realWeather!.high)}°</>}</p>
<p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">{realWeather!.humidity != null ? `湿度 ${Math.round(realWeather!.humidity)}% · ` : ""}{realWeather!.wind ? `风：${realWeather!.wind} · ` : ""}{realWeather!.sunrise ? `日出 ${realWeather!.sunrise.match(/T(\d{2}:\d{2})/)?.[1] ?? realWeather!.sunrise} · ` : ""}{realWeather!.sunset ? `日落 ${realWeather!.sunset.match(/T(\d{2}:\d{2})/)?.[1] ?? realWeather!.sunset}` : ""}</p>
{realWeather!.summary && <p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">{realWeather!.summary}</p>}
{realWeather!.alerts.length > 0 && <p className="mt-1 text-xs font-bold text-[var(--accent)]">⚠️ {realWeather!.alerts.join("；")}</p>}
<p className="mt-1 text-[11px] text-[var(--dim)]">游戏里的天色按{city.name}当地真实时间走，云、雨、雾也跟着实况——下雨天记得穿雨衣。数据：{realWeather!.sourceName} · {new Date(realWeather!.fetchedAt).toLocaleString("zh-CN")} 更新{realWeather!.stale ? "（网络不通，这是上次的缓存）" : ""}</p>
{realWeather!.forecast.length > 0 && (
<div className="mt-2 grid gap-1">
{realWeather!.forecast.slice(0, 5).map((f, i) => (
<p key={i} className="flex justify-between rounded-[8px] bg-[var(--surface2)] px-2.5 py-1.5 text-xs"><span>{f.date ?? `+${i} 天`}</span><span className="font-bold">{f.summary ?? ""}{f.high != null && f.low != null ? ` · ${Math.round(f.low)}°~${Math.round(f.high)}°` : ""}{f.precipitationChance != null ? ` · 降水 ${Math.round(f.precipitationChance)}%` : ""}</span></p>
))}
</div>
)}
</>
) : (
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">真实天气暂时取不到（网络或服务问题）。游戏不会编一个假天气糊弄你——先按无雨晴天玩，网络恢复后点「刷新」。</p>
)}
</div>
<p className="mt-1 text-[11px] font-black tracking-wide text-[var(--dim)]">游戏内日历（11 月赛季的剧情天气，和上面的实况是两回事）</p>
{Array.from({ length: 7 }, (_, i) => s.day + i).filter((d) => d <= 30).map((d) => (
<p key={d} className="flex justify-between rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm">
<span>11 月 {d} 日 · {weekday(d)}{d === s.day ? "（今天）" : ""}</span><b>{weatherOf(d, s.cityKey)}</b>
</p>
))}
</div>
);
case "ledger":
return (
<div className="grid gap-1.5 text-sm">
{[
["累计收入", fmt(s.earned)], ["已交房租", fmt(s.rentPaid)], ["装修 + 家具", fmt(s.homeSpent)],
["理财余额", fmt(s.invest)], ["上班次数", `${s.workCount} 次`], ["加班次数", `${s.otCount} 次`],
["干饭次数", `${s.mealCount} 次`], ["最高存款", fmt(s.maxMoney)], ["APEC 服务", `${s.apecCount} 次`], [s.cityKey === "hz" ? "坐城轨/高铁" : s.cityKey === "hk" ? "坐港铁" : "坐地铁", `${s.metroRides ?? 0} 次`], ["风景打卡", `${(s.visitedScenic ?? []).length} / ${SCENIC_SPOTS.filter((x) => x.cityKey === s.cityKey).length} 处`],
].map(([k, v]) => (
<p key={k} className="flex justify-between rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2"><span className="text-[var(--dim)]">{k}</span><b>{v}</b></p>
))}
</div>
);
case "map":
return (
<div className="grid max-h-[46vh] gap-2 overflow-y-auto pr-1">
{getLocations(s.cityKey).map((l) => (
<button key={l.id} type="button" onClick={() => { setPhoneOpen(false); walkTo(l.id); }} className="act-btn">
<span className="text-sm font-bold">{l.emoji} {l.name}</span>
<span className="block text-xs text-[var(--dim)]">{l.id === currentLoc ? "你在这里" : "走路过去"}</span>
</button>
))}
</div>
);
case "apec": {
const ph = apecPhase(s.day);
const venues = getLocations("sz").filter((l) => l.type === "apec");
return (
<div>
<p className="text-sm font-bold">🌐 {ph.label}</p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{ph.detail}</p>
<div className="mt-3 grid gap-2">
{venues.map((v) => (
<p key={v.id} className="flex items-center justify-between rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm">
<span>{v.emoji} {v.name}</span><b>{apecVenueMul(s.day, v.id) > 1 ? `今日 ×${apecVenueMul(s.day, v.id)}` : "平日价"}</b>
</p>
))}
</div>
<p className="mt-4 text-sm font-bold">🎉 领导人周活动 · {APEC_SLOGAN}</p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">每天一个任务：先坐地铁到会场打卡，再以志愿者 / 记者 / 司机身份上岗（闭门会议不对公众开放）。进度：任务 {(s.apecTasks ?? []).length} / {APEC_TASKS.length} · 打卡 {(s.apecCheckins ?? []).length} / 3{(s.apecTasks ?? []).length >= APEC_TASKS.length ? ` · ${APEC_CERT_NAME}已到手，结算时亮出来` : ""}</p>
<div className="mt-2 grid gap-2">
{APEC_TASKS.map((t) => {
const venue = venues.find((v) => v.id === t.venueLocId);
const done = (s.apecTasks ?? []).includes(t.id);
const checked = (s.apecCheckins ?? []).includes(t.venueLocId);
const status = done ? "✅ 已完成" : t.day === s.day ? (checked ? "🎽 已打卡，去会场上岗" : "📍 今天的班，先去打卡") : t.day < s.day ? "⌛ 已错过" : "🗓️ 还没到日子";
return (
<div key={t.id} className="rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2">
<p className="flex items-center justify-between gap-2 text-sm"><span className="font-bold">{t.dateLabel} · {t.title}</span><span className="shrink-0 text-xs font-black">{status}</span></p>
<p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">{t.event}｜{t.roleEmoji} {t.role}｜{venue ? `${venue.emoji} ${venue.name}` : ""}{checked ? "｜📸 已打卡" : ""}</p>
{s.cityKey === "sz" && t.day === s.day && !done && (
<button type="button" aria-label={`坐地铁前往${venue?.name ?? "会场"}做今日任务`} onClick={() => { setPhoneOpen(false); walkTo(t.venueLocId, "metro"); }} className="mt-1.5 rounded-full bg-[var(--accent2)] px-3 py-1.5 text-[11px] font-black text-white">🚇 坐地铁去{venue?.short ?? "会场"}</button>
)}
</div>
);
})}
</div>
<p className="mt-3 text-xs leading-relaxed text-[var(--dim)]">真实日程：第 33 届 APEC 领导人周 11 月 14 日开启；欢迎晚宴 16 日晚在南山太子湾 MGM；CEO 峰会 17–18 日在前海国际会议中心；领导人非正式会议 18–19 日在福田香蜜湖的深圳国际交流中心。主题「建设亚太共同体，促进共同繁荣」，21 个成员经济体，会徽 21 根羽毛。领导人周不对公众开放——游戏里你只能以志愿者、会务、接待、司机身份参与，这也是现实里普通人参与的方式。{s.cityKey === "hz" ? "惠州没有会场，但 APEC 周深圳游客多，温泉酒店和巽寮湾的兼职会更旺（×1.3）；想做活动任务，去深圳开一局。" : s.cityKey === "hk" ? "香港没有会场，但 APEC 周过关人潮和西九龙站客流会明显变多，口岸和茶餐厅的兼职更旺；想做活动任务，去深圳开一局。" : ""}</p>
</div>
);
}
case "metro": {
const lines = metroLinesForCity(s.cityKey);
const hereLines = linesForLoc(s.cityKey, currentLoc);
const dests = allMetroDestinations(s.cityKey, currentLoc);
return (
<div>
<p className="text-sm font-bold">{s.cityKey === "sz" ? "🚇 深圳地铁全线网" : s.cityKey === "hk" ? "🚇 香港港铁全线网 MTR" : "🚆 惠州城轨 + 城际高铁线网"} · 已坐 {s.metroRides ?? 0} 次</p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">全部线路都画在3D地图上了（彩色线+站点）。选「{s.cityKey === "hz" ? "城际" : s.cityKey === "hk" ? "港铁" : "地铁"}」出行或在下面点目的地，就会进站走进车厢真实乘车：看拥挤程度、听报站、站站停靠，还能看手机、让座。{s.cityKey === "hz" ? "惠州没有地铁，市内靠公交、打车、骑行，轨道只有莞惠城际和赣深/厦深/广汕高铁。注意：城际的惠州北站和高铁的惠州南站是两个站，中间靠接驳巴士相连——路线规划会自动把这段接驳算进去，城轨和高铁全网连通。" : s.cityKey === "hk" ? "香港只有港铁，没有「地铁」这个说法：十条重铁线加机场快线，八达通一拍入闸。西九龙站和九龙站是两个站，中间靠行人通道相连——路线规划会自动把这段接驳算进去。回深圳过关：东铁线到罗湖，或高铁从西九龙站直达深圳北。" : "注意：去惠州的高铁在深圳北站坐，半小时到惠州南站；惠州没有地铁，市内靠城际和公交。"}</p>
{hereLines.length > 0 ? <p className="mt-2 text-xs font-bold">你所在的 {locById(currentLoc).name} 经过：{hereLines.map((l) => l.short).join("、")}</p> : <p className="mt-2 text-xs text-[var(--dim)]">{s.cityKey === "hz" ? "你现在不在城轨站旁：用「城际」出行方式点任意地点，会先带你走到最近的车站上车，目的地没站也会在最近的站下车再走过去。" : s.cityKey === "hk" ? "你现在不在港铁站旁：用「港铁」出行方式点任意地点，会先带你走到最近的车站上车，目的地没站也会在最近的站下车再走过去。" : "你现在不在地铁站旁：用「地铁」出行方式点任意地点，会先带你走到最近的车站上车，目的地没站也会在最近的站下车再走过去。"}</p>}
{dests.length > 0 && (
<div className="mt-3">
<p className="text-xs font-black tracking-wide text-[var(--dim)]">从这里坐{s.cityKey === "hz" ? "城轨/高铁" : s.cityKey === "hk" ? "港铁" : "地铁/城轨"}能到（含换乘，一次坐到底）</p>
<div className="mt-2 grid max-h-[30vh] gap-2 overflow-y-auto pr-1">
{dests.map(({ locId, route }) => (
<button key={locId} type="button" onClick={() => { setPhoneOpen(false); startMetroRide(currentLoc, locId); }} className="act-btn">
<span className="text-sm font-bold">{locById(locId).emoji} {locById(locId).name} <span style={{ color: route.line.colorCss }}>● {route.summary}</span></span>
<span className="block text-xs text-[var(--dim)]">{route.stops} 站{route.isTransfer ? ` · 在 ${route.transferStations.join("、")} 换乘` : ""}{route.shuttleFrom.length > 0 ? " · 含站外接驳巴士" : ""} · 票价 {Y}{route.fare} · 点这里进车厢</span>
</button>
))}
</div>
</div>
)}
<div className="mt-3 grid gap-1.5">
{lines.map((l) => (
<p key={l.id} className="flex items-start gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs"><span className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: l.colorCss }} /><span><b>{l.name}</b><br /><span className="text-[var(--dim)]">{l.stations.map((st) => st.name).join(" → ")}</span></span></p>
))}
</div>
</div>
);
}
case "home":
return renderHomePanel(s);
default:
return null;
}
};

/* ================= SETUP ================= */
if (phase === "setup" || !gs) {
const szCount = world?.onlineSz ?? 0;
const hzCount = world?.onlineHz ?? 0;
const hkCount = world?.onlineHk ?? 0;
return (
<div className="min-h-screen overflow-x-clip bg-[var(--bg)] text-[var(--text)]">
<SafeAreaTopScrim backgroundColor="var(--bg)" />
<main className="mx-auto w-full max-w-2xl px-4 pb-10 pt-6 lg:max-w-5xl">
<p className="text-xs font-black tracking-[0.2em] text-[var(--accent)]">真人联机 · 同一座城</p>
<h1 className="font-display mt-2 text-4xl font-black leading-tight">在深圳、惠州和香港，<br />过完这个十一月</h1>
<p className="mt-3 text-sm leading-relaxed text-[var(--dim)]">
30 天生活模拟：选一座城、一个身份，在 3D 地图上打工、升职、吃饭、装修、攒钱。这次是<b className="text-[var(--text)]">真的联机</b>——其他打开游戏的人会以真身出现在你的地图上，你们共享一个城市频道、一份动态墙和一张排行榜。三座城随时互通：坐高铁去惠州，过关去香港（罗湖、福田、深圳湾，或高铁直达西九龙站）。11 月 14–19 日是深圳 APEC 领导人周，三个真实会场等你打工。
</p>
<div className="mt-3 flex flex-wrap gap-2">
<span className="chip"><span className="live-dot" /> 深圳在线 {szCount} 人</span>
<span className="chip"><span className="live-dot" /> 惠州在线 {hzCount} 人</span>
<span className="chip"><span className="live-dot" /> 香港在线 {hkCount} 人</span>
<span className="chip">🗺️ 三城 {getLocations("sz").length + getLocations("hz").length + getLocations("hk").length} 个地点 · 地铁/城际/港铁/高铁全线 · 大地图</span>
<span className="chip">🌐 APEC 真实日程</span>
</div>

<div className="mt-5 rounded-[16px] border-2 border-[var(--gold)] bg-[#fdf6da] p-4 text-[#5c4a00]">
<p className="font-display text-xl font-black">🌐 {APEC_SLOGAN}</p>
<p className="mt-1 text-xs leading-relaxed">公开上线活动：第 33 届 APEC 领导人周 11 月 14–19 日在深圳举行，游戏同步开活动，每天一个任务，按真实日程走——14 日领导人周开幕（高官会、工商咨询理事会）→ 16 日晚太子湾欢迎晚宴 → 17–18 日前海 CEO 峰会 → 18–19 日香蜜湖领导人会议。你以志愿者、记者、司机的身份参与（领导人周的闭门会议不对公众开放，游戏里也进不去），坐真实地铁线路去三个会场打卡上岗，六天任务全做完，领《APEC 领导人周服务证书》。</p>
<p className="mt-1.5 text-[11px] font-bold">⏰ 游戏第 N 天 = 11 月 N 日：13 日前先进城认地图、认地铁，14 日准时开幕。选深圳开局就能参加活动。</p>
</div>

<label htmlFor="nickname" className="mt-6 block text-sm font-black">先给自己起个城市昵称（别人会看到）</label>
<input id="nickname" value={setupName} onChange={(e) => setSetupName(e.target.value.slice(0, 12))} placeholder="比如：阿深、湾区小陈" className="mt-2 w-full rounded-[12px] border-2 border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base font-bold outline-none" />

<p className="mt-6 text-sm font-black">选一座城</p>
<div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-3">
{(Object.keys(CITIES) as CityKey[]).map((k) => {
const c = CITIES[k];
const active = setupCity === k;
return (
<button key={k} type="button" aria-label={`选择${c.name}`} onClick={() => setSetupCity(k)} className={`rounded-[16px] border-2 p-4 text-left ${active ? "border-[var(--border)] bg-[var(--surface)] shadow-[5px_5px_0_var(--border)]" : "border-[var(--line)] bg-[var(--surface)]"}`}>
<p className="text-3xl">{c.emoji}</p>
<p className="mt-1 text-lg font-black">{c.name}</p>
<p className="text-xs leading-relaxed text-[var(--dim)]">{k === "sz" ? `${getLocations("sz").length} 个地点 · APEC 主场 · 周租贵、工资高` : k === "hk" ? `${getLocations("hk").length} 个地点 · 港铁 + 维港 · 港币标价、工资最高、租金最贵` : `${getLocations("hz").length} 个地点 · 海边慢生活 · 周租便宜、工资低`}</p>
<p className="mt-1 text-xs font-bold text-[var(--green)]">● {k === "sz" ? szCount : k === "hk" ? hkCount : hzCount} 人正在这座城里</p>
</button>
);
})}
</div>

<p className="mt-6 text-sm font-black">选一个身份</p>
<div className="mt-2 grid gap-2 lg:grid-cols-2">
{IDENTITIES.map((it) => {
const active = setupIden === it.id;
return (
<button key={it.id} type="button" aria-label={`选择身份${it.name}`} onClick={() => setSetupIden(it.id)} className={`flex items-start gap-3 rounded-[14px] border-2 p-3 text-left ${active ? "border-[var(--border)] bg-[var(--surface)] shadow-[4px_4px_0_var(--border)]" : "border-[var(--line)] bg-[var(--surface)]"}`}>
<span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-2xl" style={{ background: hexCss(it.color) + "2b" }}>{it.emoji}</span>
<span className="min-w-0">
<span className="text-sm font-black">{it.name} <span className="text-[var(--accent)]">{fmt(it.money)}</span></span>
<span className="block text-xs leading-relaxed text-[var(--dim)]">{it.desc}</span>
<span className="block text-xs text-[var(--dim)]">日薪约 {fmt(it.pay)} · 初始心情 {it.mood}</span>
</span>
</button>
);
})}
</div>

<button type="button" disabled={!setupName.trim()} onClick={() => startGame(setupName.trim(), setupCity, setupIden)} className="mt-6 w-full rounded-full bg-[var(--accent)] py-4 text-base font-black text-white shadow-[5px_5px_0_var(--border)] disabled:opacity-40">
进城，开始过日子 →
</button>
<p className="mt-3 text-center text-xs leading-relaxed text-[var(--dim)]">规则：30 天，每天去不同地点行动消耗能量；每周六睡前交租，存款跌破 -{fmt(500)} 会被房东请出门；第 30 天结束结算并登上全城排行榜。</p>
</main>
</div>
);
}

/* ================= RESULT ================= */
if (phase === "result" && result) {
const s = gs;
const iden = idenOf(s);
const board = world?.leaderboard ?? [];
return (
<div className="min-h-screen overflow-x-clip bg-[var(--bg)] text-[var(--text)]">
<SafeAreaTopScrim backgroundColor="var(--bg)" />
<main className="mx-auto max-w-2xl px-4 pb-10 pt-6">
<div className="hard-card overflow-hidden">
<div className="p-5 text-white" style={{ background: s.cityKey === "sz" ? "#e63a1f" : s.cityKey === "hk" ? "#7c3aed" : "#0369a1" }}>
<p className="text-xs font-black tracking-[0.18em] opacity-90">30 天结算 · {CITIES[s.cityKey].name}</p>
<h2 className="font-display mt-1 text-4xl font-black">{result.title}</h2>
<p className="mt-1 text-sm opacity-95">{iden.emoji} {iden.name} · 在{CITIES[s.cityKey].name}活了 {Math.min(s.day, 30)} 天 · 最高存款 {fmt(s.maxMoney)}</p>
</div>
<div className="p-5">
<p className="text-sm leading-relaxed">{result.quote}</p>
<div className="mt-4 grid grid-cols-3 gap-2 text-center">
{[
["最终存款", fmt(s.money)], ["存活天数", `${Math.min(s.day, 30)} 天`], ["上班", `${s.workCount} 次`],
["总收入", fmt(s.earned)], ["交租", fmt(s.rentPaid)], ["最终心情", `${Math.round(s.mood)}`],
["职级", (CAREERS[s.careerIdx] ?? CAREERS[0]!).name], ["技能", `${s.skill} 点`], ["人脉", `${s.network} 人`],
["我的家", homeName(s)], ["舒适度", `${computeComfort(s)}`], ["APEC 服务", `${s.apecCount} 次`], [s.cityKey === "hz" ? "坐城轨/高铁" : s.cityKey === "hk" ? "坐港铁" : "坐地铁", `${s.metroRides ?? 0} 次`], ["风景打卡", `${(s.visitedScenic ?? []).length} / ${SCENIC_SPOTS.filter((x) => x.cityKey === s.cityKey).length} 处`],
].map(([k, v]) => (
<div key={k} className="rounded-[12px] bg-[var(--surface2)] px-2 py-3">
<p className="text-[11px] font-bold text-[var(--dim)]">{k}</p>
<p className="mt-0.5 truncate text-sm font-black">{v}</p>
</div>
))}
</div>
{result.badges.length > 0 && (
<p className="mt-4 flex flex-wrap gap-1.5">
{result.badges.map((b) => <span key={b} className="chip">{b}</span>)}
</p>
)}
<p className="mt-3 text-xs text-[var(--dim)]">这个成绩已经发到全城动态和排行榜，其他玩家打开游戏就能看到。</p>
<p className="mt-2 text-center text-xs font-black text-[var(--dim)]">🌐 {APEC_SLOGAN}</p>
</div>
</div>

<div className="hard-card mt-5 p-5">
<h3 className="font-display text-xl font-black">🏆 全城排行榜</h3>
<div className="mt-3 grid gap-1.5">
{board.slice(0, 10).map((b, i) => (
<p key={b.id} className={`flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm ${b.id === myId ? "bg-[var(--surface2)] font-black" : ""}`}>
<span className="w-6 font-black">{i + 1}</span>
<span>{b.emoji}</span>
<span className="min-w-0 flex-1 truncate">{b.name}{b.id === myId ? "（你）" : ""}</span>
<span className="text-xs text-[var(--dim)]">{CITIES[b.cityKey as CityKey]?.name ?? b.cityKey}</span>
<span className="font-black">{fmt(b.money, b.cityKey as CityKey)}</span>
<span className="hidden text-xs text-[var(--dim)] sm:inline">{b.status === "finished" ? b.resultTitle ?? "已结算" : `第 ${b.gameDay} 天`}</span>
</p>
))}
{board.length === 0 && <p className="text-sm text-[var(--dim)]">排行榜暂时没数据。</p>}
</div>
</div>

<button type="button" onClick={restart} className="mt-6 w-full rounded-full bg-[var(--accent)] py-4 text-base font-black text-white shadow-[5px_5px_0_var(--border)]">
换个身份，再来一局 →
</button>
</main>
</div>
);
}

/* ================= GAME ================= */
const s = gs;
const iden = idenOf(s);
const city = CITIES[s.cityKey];
const career = CAREERS[s.careerIdx] ?? CAREERS[0]!;
const selLoc = locById(selectedLoc);
const arrived = currentLoc === selectedLoc && !walking;
const phaseApec = apecPhase(s.day);
const goalPct = clamp(Math.round((s.money / s.goal) * 100), 0, 100);
const feedKindEmoji: Record<string, string> = { join: "👋", career: "📈", apec: "🌐", home: "🏠", money: "💰", finish: "🏁", life: "✨" };

return (
<div className="min-h-screen overflow-x-clip bg-[var(--bg)] text-[var(--text)]">
<SafeAreaTopScrim backgroundColor="var(--bg)" />
<header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--bg)]/95 pt-safe backdrop-blur">
<div className="mx-auto flex w-full max-w-[2560px] flex-wrap items-center gap-2 px-4 py-2.5 2xl:px-8">
<span className="font-display text-lg font-black">第 {Math.min(s.day, 30)} 天</span>
<span className="text-xs font-bold text-[var(--dim)]">11 月 {Math.min(s.day, 30)} 日 · {weekday(s.day)} · {nowWeatherText}</span>
<button type="button" aria-label={`刷新${city.name}真实天气`} title={rwOk ? `${city.name}此刻真实天气（${realWeather!.sourceName}，${new Date(realWeather!.fetchedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 更新）——游戏里的天色、云雨都跟着它走` : "真实天气暂时取不到"} onClick={() => weatherQuery.refetch()} className="chip">
{weatherQuery.isLoading ? "🌡️ 实况加载中…" : rwOk ? `${RW_EMOJI[realWeather!.kind]} ${city.name}实况 ${realWeather!.description || RW_LABEL[realWeather!.kind]}${realWeather!.temperature != null ? ` ${Math.round(realWeather!.temperature)}°` : ""}${realWeather!.stale ? "（缓存）" : ""}` : "🌡️ 实况暂不可用"}
</button>
{(Object.keys(CITIES) as CityKey[]).filter((k) => k !== s.cityKey).map((k) => (
<button key={k} type="button" aria-label={`${k === "hk" || s.cityKey === "hk" ? "过关" : "坐高铁"}切换城市，去${CITIES[k].name}，车票 ${k === "hk" || s.cityKey === "hk" ? crossFareLabel(s.cityKey, intercityFare(s.cityKey, k)) : `¥${intercityFare(s.cityKey, k)}`}`} title={`${k === "hk" ? "过关去香港：高铁直达西九龙站，一地两检（出示证件、安检、入境）" : s.cityKey === "hk" ? "过关回内地：西九龙站一地两检，坐高铁出发" : `坐厦深高铁去${CITIES[k].name}`}：地图、天气、街坊全换，进度不变（车票 ${k === "hk" || s.cityKey === "hk" ? crossFareLabel(s.cityKey, intercityFare(s.cityKey, k)) : `¥${intercityFare(s.cityKey, k)}`}，钱不够免费坐）`} onClick={() => switchCity(k)} className="chip shrink-0 border-[var(--accent)] font-black text-[var(--accent)] transition hover:bg-[var(--surface2)]">{k === "hk" || s.cityKey === "hk" ? "🛃" : "🚄"} 去{CITIES[k].name} · {k === "hk" || s.cityKey === "hk" ? crossFareLabel(s.cityKey, intercityFare(s.cityKey, k)) : `¥${intercityFare(s.cityKey, k)}`}</button>
))}
<span className="ml-auto chip"><span className="live-dot" /> {(world?.onlineSz ?? 0) + (world?.onlineHz ?? 0) + (world?.onlineHk ?? 0)} 人在线</span>
<button type="button" onClick={goHomeAndSleep} className="rounded-full bg-[var(--text)] px-3.5 py-2 text-xs font-black text-[var(--bg)]">😴 回家睡觉</button>
</div>
</header>

<main className="relative w-full">
{/* The map is the whole stage now — no fixed side panel squeezing it.
    The status / APEC / city bars float over the map's top-left corner as
    a translucent stack (folded bars become a vertical rail of buttons
    down the left edge), and place/feed/wall/chat/board live in a
    floating translucent panel that collapses vertically into a slim
    strip on the right edge — never fully hidden, always one tap away. */}
<section className="relative h-[calc(100dvh-61px)] min-h-[540px] w-full overflow-hidden">
<div className="float-bars absolute left-3 top-[60px] z-20 w-[min(620px,calc(100vw-24px))] space-y-2">
{/* HUD — compact status bar: money / goal / energy / mood / career on
    ONE line; every other stat folds out only when asked for. The whole
    bar can also be folded away vertically into the left-edge rail. */}
{!barHidden.hud && (
<div className="hard-card px-3.5 py-3">
<div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
<div className="flex items-baseline gap-1.5">
<span className="text-[11px] font-bold text-[var(--dim)]">存款</span>
<span className={`font-display text-[26px] font-black leading-none ${s.money < 0 ? "text-[var(--accent)]" : ""}`}>{fmt(s.money)}</span>
<span className="text-[11px] font-bold text-[var(--dim)]">/ 目标 {fmt(s.goal)}</span>
</div>
<div className="flex items-center gap-1.5">
<div className="h-2 w-20 overflow-hidden rounded-full bg-[var(--surface2)]" role="img" aria-label={`存钱目标进度 ${goalPct}%`}><div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${goalPct}%` }} /></div>
<span className="text-[11px] font-black">{goalPct}%</span>
</div>
<span className="flex items-center gap-1.5 text-xs font-bold">⚡<span className="h-2 w-12 overflow-hidden rounded-full bg-[var(--surface2)]"><span className="block h-full bg-amber-500 transition-all" style={{ width: `${s.energy}%` }} /></span>{Math.round(s.energy)}</span>
<span className="flex items-center gap-1.5 text-xs font-bold">😊<span className="h-2 w-12 overflow-hidden rounded-full bg-[var(--surface2)]"><span className="block h-full bg-emerald-500 transition-all" style={{ width: `${s.mood}%` }} /></span>{Math.round(s.mood)}</span>
<span className="chip">{iden.emoji} {iden.name}</span>
<span className="chip">📈 {career.name} ×{career.mul}</span>
<span className="chip">🏠 周租 {fmt(s.rent)}{isSaturday(s.day) ? "（今天交租！）" : ""}</span>
{s.invest > 0 && <span className="chip">💹 理财 {fmt(s.invest)}</span>}
<button type="button" aria-label={hudOpen ? "收起状态详情" : "展开状态详情"} aria-expanded={hudOpen} onClick={() => setHudOpen((o) => !o)} className="ml-auto shrink-0 rounded-full border border-[var(--line)] px-3 py-1.5 text-[11px] font-black transition hover:border-[var(--border)]">{hudOpen ? "收起详情 ▴" : "状态详情 ▾"}</button>
<button type="button" aria-label="竖着收起状态条，收成屏幕左侧的竖排按钮" title="竖着收起，收成屏幕左侧的竖排按钮，点一下就展开" onClick={() => setBarHidden((b) => ({ ...b, hud: true }))} className="shrink-0 rounded-full border border-[var(--line)] px-3 py-1.5 text-[11px] font-black transition hover:border-[var(--border)]">◂ 竖收起</button>
</div>
{s.energy < 25 && <p className="mt-2 text-xs font-bold text-[var(--accent)]">能量快见底了：去夜市吃点东西，或者回家睡觉。</p>}
{nowRainy && s.outfit !== "raincoat" && (
<p className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--accent2)]">🌧️ 今天下雨，出门容易淋湿——衣柜里有雨衣的话先换上。
<button type="button" aria-label="下雨天换上雨衣" onClick={() => buyOutfit("raincoat")} className="rounded-full bg-[var(--accent2)] px-3 py-1 text-[11px] font-black text-white">{s.ownedOutfits.includes("raincoat") ? "换上雨衣 🧥" : `${fmt(outfitOf("raincoat").price)} 买雨衣穿上`}</button></p>
)}
{hudOpen && (
<div className="mt-3 border-t border-[var(--line)] pt-3">
<div className="grid grid-cols-2 gap-3">
<div>
<p className="flex justify-between text-xs font-bold"><span>⚡ 能量</span><span>{Math.round(s.energy)}/100</span></p>
<div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--surface2)]"><div className="h-full bg-amber-500 transition-all" style={{ width: `${s.energy}%` }} /></div>
</div>
<div>
<p className="flex justify-between text-xs font-bold"><span>😊 心情</span><span>{Math.round(s.mood)}/100</span></p>
<div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--surface2)]"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${s.mood}%` }} /></div>
</div>
</div>
<p className="mt-3 flex flex-wrap gap-1.5">
<span className="chip">经验 {s.xp}</span>
<span className="chip">技能 {s.skill}</span>
<span className="chip">人脉 {s.network}</span>
<span className="chip">体质 {s.fit}</span>
<span className="chip">🌐 APEC 服务 {s.apecCount} 次</span>
{s.cityKey === "sz" && <span className="chip">🎖️ APEC 任务 {(s.apecTasks ?? []).length}/{APEC_TASKS.length} · 打卡 {(s.apecCheckins ?? []).length}/3</span>}
<span className="chip">🏠 舒适度 {computeComfort(s)}</span>
<span className="chip">{s.cityKey === "hz" ? "🚆 已坐城轨/高铁" : s.cityKey === "hk" ? "🚇 已坐港铁" : "🚇 已坐地铁"} {s.metroRides ?? 0} 次</span>
<span className="chip">{outfitOf(s.outfit).emoji} 穿着{outfitOf(s.outfit).name}</span>
<span className="chip">🥬 食材 ×{s.groceries}</span>
<span className="chip">📸 打卡 {(s.visitedScenic ?? []).length} 处</span>
</p>
<div className="mt-3 flex flex-wrap gap-2">
<button type="button" aria-label="播放今日生活动画" onClick={() => playLifeAnim("day")} className="rounded-full bg-[var(--text)] px-4 py-2.5 text-xs font-black text-[var(--bg)]">🎬 今日生活动画：下高铁 · 坐{railWord(s.cityKey)} · 敲代码 · 做饭睡觉</button>
<span className="self-center text-[11px] text-[var(--dim)]">把一天的日子演一遍：起床洗漱、正装出门、通勤、上班、吃饭、买菜做饭、睡觉。</span>
</div>
</div>
)}
</div>
)}

{/* APEC banner — one-line activity bar by default: phase, progress and
    today's task with its go-there button; the full briefing folds out. */}
{!barHidden.apec && (s.cityKey === "sz" ? (
<div className="mt-2.5 rounded-[14px] border-2 border-[var(--gold)] bg-[#fdf6da] px-3 py-2 text-[#5c4a00]">
<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
<p className="text-[13px] font-black">🌐 APEC · {phaseApec.label} <span className="text-[11px] font-bold">{s.day < 14 ? `还有 ${14 - s.day} 天` : s.day <= 19 ? "进行中" : "已结束"}</span></p>
<span className="text-[11px] font-bold">任务 {(s.apecTasks ?? []).length} / {APEC_TASKS.length} · 打卡 {(s.apecCheckins ?? []).length} / 3</span>
{(() => {
const task = apecTaskOfDay(s.day) ?? (s.day < 14 ? APEC_TASKS[0]! : null);
if (!task) return <span className="text-[11px] font-bold">领导人周已结束{(s.apecTasks ?? []).length >= APEC_TASKS.length ? " · 证书已到手 🎖️" : ""}</span>;
const done = (s.apecTasks ?? []).includes(task.id);
const venue = locById(task.venueLocId);
return (
<>
<span className="min-w-0 text-[11px] font-bold">{task.day === s.day ? "今日任务" : `${task.dateLabel} 第一班`}：{task.roleEmoji} {task.title} · {venue.emoji} {venue.short}</span>
{done ? <span className="text-[11px] font-black">✅ 已完成</span> : currentLoc !== task.venueLocId ? <button type="button" aria-label={`坐地铁前往${venue.name}打卡`} onClick={() => walkTo(task.venueLocId, "metro")} className="rounded-full bg-[#5c4a00] px-3 py-1 text-[11px] font-black text-white">🚇 去会场打卡</button> : <span className="text-[11px] font-black">你就在会场 · 展开看上岗按钮 ↓</span>}
</>
);
})()}
<button type="button" aria-label={apecOpen ? "收起APEC活动详情" : "展开APEC活动详情"} aria-expanded={apecOpen} onClick={() => setApecOpen((o) => !o)} className="ml-auto shrink-0 rounded-full border border-[#5c4a00]/40 bg-white/50 px-3 py-1 text-[11px] font-black">{apecOpen ? "收起 ▴" : "活动详情 ▾"}</button>
<button type="button" aria-label="竖着收起APEC活动条，收成屏幕左侧的竖排按钮" title="竖着收起，收成屏幕左侧的竖排按钮，点一下就展开" onClick={() => setBarHidden((b) => ({ ...b, apec: true }))} className="shrink-0 rounded-full border border-[#5c4a00]/40 bg-white/50 px-3 py-1 text-[11px] font-black">◂ 竖收起</button>
</div>
{apecOpen && (
<div className="mt-2 border-t border-[#e8d189] pt-2">
<p className="text-xs leading-relaxed">{phaseApec.detail}</p>
<div className="mt-2">
<p className="text-xs font-black">🎉 APEC 领导人周活动 · {APEC_SLOGAN}</p>
<p className="mt-0.5 text-[11px] font-bold">每日一任务（11 月 14–19 日）：任务进度 {(s.apecTasks ?? []).length} / {APEC_TASKS.length} · 会场打卡 {(s.apecCheckins ?? []).length} / 3{(s.apecTasks ?? []).length >= APEC_TASKS.length ? ` · ${APEC_CERT_NAME}已到手` : " · 六天全做完领服务证书"}</p>
{(() => {
const task = apecTaskOfDay(s.day) ?? (s.day < 14 ? APEC_TASKS[0]! : null);
if (!task) return <p className="mt-1.5 text-xs leading-relaxed">领导人周活动已经结束。{(s.apecTasks ?? []).length >= APEC_TASKS.length ? "你六天的任务全做完了，证书在结算页等你。" : "错过的班次不能补，但这座城你已经认得差不多了。"}</p>;
const venue = locById(task.venueLocId);
const isToday = task.day === s.day;
const done = (s.apecTasks ?? []).includes(task.id);
const checked = (s.apecCheckins ?? []).includes(task.venueLocId);
const atVenue = currentLoc === task.venueLocId && selectedLoc === task.venueLocId && !walking;
const plan = currentLoc !== task.venueLocId ? planRailTrip("sz", currentLoc, task.venueLocId) : null;
return (
<div className="mt-1.5 rounded-[12px] bg-white/60 p-2.5">
<p className="text-xs font-black">{isToday ? "今日任务" : `${task.dateLabel} 第一班（提前认路）`} · {task.dateLabel} {task.event}</p>
<p className="mt-0.5 text-xs leading-relaxed">{task.roleEmoji} 你当<b>{task.role}</b>：{task.title} —— 地点：{venue.emoji} {venue.name}。{done ? "✅ 已完成" : checked ? "📸 已打卡，到会场就能上岗" : "先坐地铁去会场打卡，再上岗"}</p>
{plan && <p className="mt-0.5 text-[11px] font-bold">🚇 怎么去：{plan.boardLoc !== currentLoc ? `先步行到${locById(plan.boardLoc).short}站 · ` : ""}{plan.route.summary} · {plan.route.stops} 站 · {Y}{plan.route.fare}{plan.alightLoc !== task.venueLocId ? ` · 到${locById(plan.alightLoc).short}站再步行过去` : ""}</p>}
{!plan && currentLoc !== task.venueLocId && <p className="mt-0.5 text-[11px] font-bold">🚇 怎么去：离得很近，步行就到。</p>}
<div className="mt-2 flex flex-wrap gap-2">
{!atVenue && !done && <button type="button" aria-label={`坐地铁前往${venue.name}打卡`} onClick={() => walkTo(task.venueLocId, "metro")} className="rounded-full bg-[#5c4a00] px-3.5 py-1.5 text-[11px] font-black text-white">🚇 坐地铁去{venue.short}打卡</button>}
{atVenue && !checked && <button type="button" aria-label={`在${venue.name}打卡`} onClick={() => doAction("apec-checkin")} className="rounded-full bg-[#5c4a00] px-3.5 py-1.5 text-[11px] font-black text-white">📸 会场打卡</button>}
{atVenue && checked && !done && isToday && <button type="button" aria-label={`开始今日任务${task.title}`} disabled={s.energy < task.energy} onClick={() => doAction("apec-task")} className="rounded-full bg-[#5c4a00] px-3.5 py-1.5 text-[11px] font-black text-white disabled:opacity-40">{task.roleEmoji} 上岗：{task.title}（+{fmt(Math.round(basePay(s) * task.payMul))}）</button>}
{atVenue && <button type="button" aria-label="在地点面板查看会场" onClick={() => { setAsideTab("place"); setAsideOpen(true); }} className="rounded-full border border-[#5c4a00] px-3.5 py-1.5 text-[11px] font-black">会场详情 →</button>}
</div>
</div>
);
})()}
</div>
</div>
)}
</div>
) : (
<div className="mt-2.5 rounded-[14px] border-2 border-[var(--gold)] bg-[#fdf6da] px-3 py-2 text-[#5c4a00]">
<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
<p className="text-[13px] font-black">🌐 APEC 领导人周活动 · {APEC_SLOGAN}</p>
<span className="text-[11px] font-bold">深圳 11 月 14–19 日 · 惠州兼职旺季 ×1.3 · 惠州没有会场</span>
<button type="button" aria-label={apecOpen ? "收起APEC活动详情" : "展开APEC活动详情"} aria-expanded={apecOpen} onClick={() => setApecOpen((o) => !o)} className="ml-auto shrink-0 rounded-full border border-[#5c4a00]/40 bg-white/50 px-3 py-1 text-[11px] font-black">{apecOpen ? "收起 ▴" : "活动详情 ▾"}</button>
<button type="button" aria-label="竖着收起APEC活动条，收成屏幕左侧的竖排按钮" title="竖着收起，收成屏幕左侧的竖排按钮，点一下就展开" onClick={() => setBarHidden((b) => ({ ...b, apec: true }))} className="shrink-0 rounded-full border border-[#5c4a00]/40 bg-white/50 px-3 py-1 text-[11px] font-black">◂ 竖收起</button>
</div>
{apecOpen && <p className="mt-2 border-t border-[#e8d189] pt-2 text-xs leading-relaxed">{s.day < 14 ? `第 33 届 APEC 领导人周 11 月 14 日在深圳开启：14 日开幕、16 日晚太子湾欢迎晚宴、17–18 日前海 CEO 峰会、18–19 日香蜜湖领导人会议，每天一个任务，玩家在深圳以志愿者、记者、司机身份去三个会场打卡上岗。` : "深圳 APEC 领导人周进行中（14–19 日）：每天一个任务，志愿者、记者、司机轮着当，三个会场坐地铁去打卡。"}惠州没有会场，这周温泉酒店、巽寮湾的兼职更旺（×1.3）——想上岗打卡，去深圳开一局就能参加。</p>}
</div>
))}

{/* City intro — one-line bar by default; facts + map-scale note fold out */}
{!barHidden.intro && (
<div className="mt-2.5 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
<p className="text-[13px] font-black">🗺️ {CITY_INTRO[s.cityKey].title} · <span className="text-[var(--accent2)]">{CITY_INTRO[s.cityKey].en}</span></p>
<span className="hidden text-[11px] font-bold text-[var(--dim)] lg:inline">城市速览与地图说明，点开看</span>
<button type="button" aria-label={introOpen ? `收起${CITY_INTRO[s.cityKey].title}` : `展开${CITY_INTRO[s.cityKey].title}`} aria-expanded={introOpen} onClick={() => setIntroOpen((o) => !o)} className="ml-auto shrink-0 rounded-full border border-[var(--line)] px-3 py-1 text-[11px] font-black transition hover:border-[var(--border)]">{introOpen ? "收起 ▴" : "城市速览 ▾"}</button>
<button type="button" aria-label="竖着收起城市介绍条，收成屏幕左侧的竖排按钮" title="竖着收起，收成屏幕左侧的竖排按钮，点一下就展开" onClick={() => setBarHidden((b) => ({ ...b, intro: true }))} className="shrink-0 rounded-full border border-[var(--line)] px-3 py-1 text-[11px] font-black transition hover:border-[var(--border)]">◂ 竖收起</button>
</div>
{introOpen && (
<div className="mt-2 border-t border-[var(--line)] pt-2">
<p className="text-xs leading-relaxed text-[var(--dim)]">{CITY_INTRO[s.cityKey].facts}</p>
<p className="mt-1.5 rounded-[10px] bg-[var(--surface2)] px-2.5 py-1.5 text-[11px] font-bold leading-relaxed">🗺️ 地图说明：游戏地图是按真实地理方位排布的<b>示意微缩模型</b>——地点之间的方向、片区、海岸与山峦的相对位置都按真实地理，但距离和面积经过压缩，<b>不是等比例测绘地图</b>。靠它认方向、认城市没问题；真实距离请以导航为准。</p>
</div>
)}
</div>
)}
</div>

{/* Collapsed bars live on as a VERTICAL rail of small buttons down the
    screen's left edge — never a horizontal row of pills. The rail hangs
    just below the left-mid nav cluster so the two never overlap; tap a
    rail button to bring its bar back. */}
{(barHidden.hud || barHidden.apec || barHidden.intro) && (
<div className="absolute left-0 z-20 flex flex-col gap-1.5" style={{ top: "calc(50% + 58px)" }}>
{barHidden.hud && <button type="button" aria-label="展开状态条" title="展开状态条" onClick={() => setBarHidden((b) => ({ ...b, hud: false }))} className="flex flex-col items-center gap-1 rounded-r-[12px] border border-l-0 border-[var(--line)] bg-[var(--surface)]/90 px-1.5 py-2.5 text-xs font-black shadow-lg backdrop-blur-md transition hover:border-[var(--border)]"><span aria-hidden="true">💰</span><span className="[writing-mode:vertical-rl]">状态</span></button>}
{barHidden.apec && <button type="button" aria-label="展开APEC活动条" title="展开APEC活动条" onClick={() => setBarHidden((b) => ({ ...b, apec: false }))} className="flex flex-col items-center gap-1 rounded-r-[12px] border border-l-0 border-[var(--gold)] bg-[#fdf6da]/90 px-1.5 py-2.5 text-xs font-black text-[#5c4a00] shadow-lg backdrop-blur-md"><span aria-hidden="true">🌐</span><span className="[writing-mode:vertical-rl]">APEC</span></button>}
{barHidden.intro && <button type="button" aria-label="展开城市介绍条" title="展开城市介绍条" onClick={() => setBarHidden((b) => ({ ...b, intro: false }))} className="flex flex-col items-center gap-1 rounded-r-[12px] border border-l-0 border-[var(--line)] bg-[var(--surface)]/90 px-1.5 py-2.5 text-xs font-black shadow-lg backdrop-blur-md transition hover:border-[var(--border)]"><span aria-hidden="true">🗺️</span><span className="[writing-mode:vertical-rl]">{CITIES[s.cityKey].name}</span></button>}
</div>
)}

{/* Map — the hero, and now the whole stage: it fills the section
    edge-to-edge at all times. ⛶ 全屏 still offers the native
    full-viewport mode on top of that; Esc or the same button exits. */}
<div ref={mapShellRef} className={mapFullscreen ? "fixed inset-0 z-[90] flex flex-col bg-[var(--bg)] p-3 pt-safe" : "absolute inset-0 flex flex-col p-2.5"}>
<div className="relative px-1.5 pb-2.5">
<div className="flex gap-2">
<input value={mapQuery} onChange={(e) => setMapQuery(e.target.value)} placeholder={s.cityKey === "hz" ? "🔍 搜地点或城轨/高铁站：西湖、老街、惠州南…" : s.cityKey === "hk" ? "🔍 搜地点或港铁站：旺角、中环、山顶、迪士尼…" : "🔍 搜地点或地铁站：华强北、老街、大梅沙…"} aria-label={`搜索地点或${railWord(s.cityKey)}站`} className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-sm outline-none focus:border-[var(--border)]" />
<button type="button" aria-label={s.cityKey === "hz" ? "打开惠州城际高铁线网图" : s.cityKey === "hk" ? "打开香港港铁线网图" : "打开地铁线路图"} onClick={() => { setMetroMapDest(null); setMetroMapOpen(true); }} className="shrink-0 rounded-full bg-[var(--accent2)] px-3.5 py-2 text-xs font-black text-white">{s.cityKey === "hz" ? "🚆 城际/高铁线网图" : s.cityKey === "hk" ? "🚇 港铁线网图" : "🚇 地铁线路图"}</button>
<button type="button" aria-label={mapFullscreen ? "退出地图全屏" : "地图全屏"} aria-pressed={mapFullscreen} onClick={toggleMapFullscreen} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-black text-white ${mapFullscreen ? "bg-[var(--accent)]" : "bg-[#14202b]"}`}>{mapFullscreen ? "⛶ 退出全屏" : "⛶ 全屏看地图"}</button>
</div>
{mapQuery.trim() !== "" && (() => {
const q = mapQuery.trim();
const locResults = getLocations(s.cityKey).filter((l) => l.name.includes(q) || l.short.includes(q) || (LOC_EN[l.name] ?? "").toLowerCase().includes(q.toLowerCase())).slice(0, 6);
const stationResults = stationIndexOf(s.cityKey).filter((st) => st.name.includes(q)).slice(0, 6);
return (
<div className="absolute inset-x-1.5 top-full z-30 max-h-72 overflow-y-auto rounded-[14px] border-2 border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-xl">
{locResults.length === 0 && stationResults.length === 0 && <p className="px-2 py-1.5 text-xs text-[var(--dim)]">没找到「{q}」——地点名、{railWord(s.cityKey)}站名、英文名都能搜。</p>}
{locResults.map((l) => {
const plan = l.id !== currentLoc ? planRailTrip(s.cityKey, currentLoc, l.id) : null;
return (
<button key={l.id} type="button" aria-label={`定位到${l.name}`} onClick={() => { setSelectedLoc(l.id); setAsideTab("place"); setAsideOpen(true); setMapFocus({ locId: l.id, nonce: Date.now() }); setMapQuery(""); }} className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left hover:bg-[var(--surface2)]">
<span className="text-lg">{l.emoji}</span>
<span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{l.name}</span><span className="block truncate text-[11px] text-[var(--dim)]">{l.id === currentLoc ? "你现在在这里" : plan ? `怎么去：${plan.boardLoc !== currentLoc ? `先步行到${locById(plan.boardLoc).short}站 · ` : ""}${railWord(s.cityKey)} ${plan.route.summary} · ${plan.route.stops} 站 · ${Y}${plan.route.fare}${plan.alightLoc !== l.id ? ` · 到${locById(plan.alightLoc).short}站再步行过去` : ""}` : "怎么去：离得很近，步行就到（在下方选好出行方式，点地点名或地图上的建筑前往）"}</span></span>
<span className="shrink-0 text-[11px] font-black text-[var(--accent2)]">定位 →</span>
</button>
);
})}
{stationResults.map((st) => (
<button key={st.name} type="button" aria-label={`在线网图上规划去${st.name}站`} onClick={() => { setMetroMapDest(st.name); setMetroMapOpen(true); setMapQuery(""); }} className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left hover:bg-[var(--surface2)]">
<span className="text-lg">{s.cityKey === "hz" ? "🚆" : "🚇"}</span>
<span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{st.name}站</span><span className="block truncate text-[11px] text-[var(--dim)]">{st.lines.join(" · ")}</span></span>
<span className="shrink-0 text-[11px] font-black text-[var(--accent2)]">在线网图规划 →</span>
</button>
))}
</div>
);
})()}
</div>
<MapView fill cityKey={s.cityKey} selfLocId={selectedLoc} selfEmoji={iden.emoji} selfColor={iden.color} selfName={profile?.name ?? "我"} remotePlayers={remotePlayers} selfOutfitId={s.outfit} travelModeId={travelMode} weatherKind={rwOk ? realWeather!.kind : "unknown"} npcMoodEmoji={Object.fromEntries(npcsForCity(s.cityKey).map((n) => [n.name, moodEmoji(memOf(s.npcMem ?? {}, n.name).mood)]))} apecDay={isApecWeek(s.day)} focusLocId={mapFocus?.locId} focusNonce={mapFocus?.nonce} destLocId={selectedLoc} onSelect={walkTo} navOverlay={(
<>
{/* 弹幕层：联机动态 / 聊天 / 街坊发言飘过地图上半区 */}
{danmakuOn && (
<div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[14] overflow-hidden">
{danmaku.map((d) => (
<span key={d.id} className="danmaku-item" style={{ top: `${d.top}%`, animationDuration: `${d.dur}s`, color: d.color }}>{d.text}</span>
))}
</div>
)}
{/* 奖励飘字层 */}
<div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[16%] z-[16] flex flex-col items-center gap-1">
{floaters.map((f) => (
<span key={f.id} className="floater" data-tone={f.tone}>{f.text}</span>
))}
</div>
{/* 左侧中段控制簇：出行导航 + 弹幕开关（不在顶部，不挡地图中心） */}
<div className="absolute left-3 top-1/2 z-20 flex -translate-y-1/2 flex-col items-start gap-2">
<button type="button" aria-label={navOpen ? "收起地图上的出行导航" : "打开地图上的出行导航"} aria-expanded={navOpen} onClick={() => setNavOpen((o) => !o)} className="rounded-full border border-black/40 bg-[#14202b]/90 px-3.5 py-2 text-xs font-black text-white shadow-lg">
🧭 {navOpen ? "收起导航" : `出行导航 · ${modesForCity(s.cityKey).find((m) => m.id === travelMode)?.emoji ?? ""} ${modesForCity(s.cityKey).find((m) => m.id === travelMode)?.name ?? ""}`}
</button>
<button type="button" aria-label={danmakuOn ? "关闭弹幕" : "开启弹幕"} aria-pressed={danmakuOn} onClick={() => setDanmakuOn((v) => !v)} className={`rounded-full border px-3.5 py-2 text-xs font-black shadow-lg ${danmakuOn ? "border-transparent bg-[var(--accent)] text-white" : "border-black/40 bg-[#14202b]/90 text-white"}`}>
💬 弹幕{danmakuOn ? "开" : "关"}
</button>
{(Object.keys(CITIES) as CityKey[]).filter((k) => k !== s.cityKey).map((k) => (
<button key={k} type="button" aria-label={`切换城市：${k === "hk" || s.cityKey === "hk" ? "过关" : "坐高铁"}去${CITIES[k].name}，车票 ${k === "hk" || s.cityKey === "hk" ? crossFareLabel(s.cityKey, intercityFare(s.cityKey, k)) : `¥${intercityFare(s.cityKey, k)}`}，钱和进度不变`} title="换座城市过日子：地图、地点、天气、街坊全换，进度原样带着（车票钱不够就免费坐）" onClick={() => switchCity(k)} className="rounded-full border border-black/40 bg-[#14202b]/90 px-3.5 py-2 text-xs font-black text-white shadow-lg">
{k === "hk" || s.cityKey === "hk" ? "🛃 过关" : "🚄 切换城市"} · 去{CITIES[k].name}
</button>
))}
</div>
{navOpen && (
<div className="absolute left-3 top-[13%] z-20 flex max-h-[74%] w-[min(332px,calc(100%-24px))] flex-col rounded-[16px] border border-black/40 bg-[#0b1622]/95 p-3 text-white shadow-2xl">
<div className="mb-1 flex items-center justify-between gap-2">
<p className="text-xs font-black">🧭 出行导航</p>
<button type="button" aria-label="收起出行导航" onClick={() => setNavOpen(false)} className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-black">收起 ✕</button>
</div>
<div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
<span className="rounded-full bg-white/10 px-2 py-1">📍 {city.name} · {getLocations(s.cityKey).length} 个地点（双城共 {getLocations("sz").length + getLocations("hz").length} 个，含口岸/山区/风景区）</span>
<span className="rounded-full bg-white/10 px-2 py-1">🟢 同城真人 {onlineHere.length} 人（含你）</span>
<span className="rounded-full bg-white/10 px-2 py-1">🧑‍🤝‍🧑 街坊 NPC {npcsForCity(s.cityKey).length} 位也在图上散步（名字后是今日心情）</span>
{walking && <span className="rounded-full bg-[var(--accent)] px-2 py-1">🚶 正在走过去…</span>}
</div>
<p className="mt-2.5 text-[11px] font-black tracking-wide text-white/70">出行方式 · 选好再点地点（或直接点地图上的建筑/标签前往）</p>
<div className="mt-1.5 flex flex-wrap gap-1.5">
{modesForCity(s.cityKey).map((m) => (
<button key={m.id} type="button" aria-label={`出行方式${m.name}，速度${m.speedTag}`} aria-pressed={travelMode === m.id} onClick={() => setTravelMode(m.id)} className={`rounded-full border px-2.5 py-1.5 text-xs font-bold ${travelMode === m.id ? "border-transparent bg-[var(--accent)] text-white" : "border-white/25 bg-white/10 text-white"}`}>{m.emoji} {m.name} · {m.speedTag}</button>
))}
</div>
<p className="mt-1.5 text-[11px] leading-relaxed text-white/70">{modesForCity(s.cityKey).find((m) => m.id === travelMode)?.desc} · 速度差别是真的：步行最慢，跑步快一半，骑行再快近一倍，电动车/公交再快，打车、自驾和{railWord(s.cityKey)}更快，高铁/城际最快——地图上人物的移动速度、实际到达时间都按这个来。公交/打车/自驾/{railWord(s.cityKey)}/高铁搭乘时都会弹车厢动画；自驾是坐进驾驶座自己开，跟车流一起等红灯、到了找车位。</p>
{selectedLoc !== currentLoc && (() => {
const fromL = locById(currentLoc); const toL = locById(selectedLoc);
const d = Math.hypot(toL.x - fromL.x, toL.z - fromL.z);
const railPlan = planRailTrip(s.cityKey, currentLoc, selectedLoc);
const rows = modesForCity(s.cityKey).map((m) => {
let eta: number | null = etaMinutes(m.id, d);
if (m.id === "metro") eta = railPlan ? Math.max(1, Math.round(railPlan.route.stops * 2 + 7)) : null;
if (m.id === "rail") eta = railPlan ? Math.max(1, Math.round(railPlan.route.stops * 1.1 + 12)) : null;
return { m, eta };
}).sort((a, b) => (a.eta ?? 9999) - (b.eta ?? 9999));
return (
<div className="mt-2 rounded-[10px] bg-white/10 px-2.5 py-2">
<p className="text-[11px] font-black text-white/85">⏱️ 去「{toL.short}」预计耗时对比（点方式直接切换）</p>
<div className="mt-1.5 flex flex-wrap gap-1.5">
{rows.map(({ m, eta }) => (
<button key={m.id} type="button" aria-label={`用${m.name}去${toL.name}，预计${eta === null ? "无路线" : `约${eta}分钟`}`} onClick={() => setTravelMode(m.id)} className={`rounded-full border px-2 py-1 text-[11px] font-bold ${travelMode === m.id ? "border-transparent bg-[var(--accent)] text-white" : "border-white/25 bg-white/5 text-white/90"}`}>{m.emoji} {m.name} {eta === null ? "· 需先到站" : `· 约${eta}分钟`}</button>
))}
</div>
<p className="mt-1.5 text-[10.5px] leading-relaxed text-white/60">含等车/进站安检等固定开销：飞机飞得快但值机要 50 分钟，短途反而最慢；{railWord(s.cityKey)}/高铁按实际规划的站数算。</p>
</div>
);
})()}
<p className="mt-1.5 rounded-[8px] bg-emerald-400/15 px-2 py-1.5 text-[11px] font-bold leading-relaxed text-emerald-200">🚲 骑行全图开通：本城 {getLocations(s.cityKey).length} 个地点——山顶、海滩、老街、景区——全都能骑到；余额不够付骑行费时免费骑，绝不拦路。</p>
<p className="mt-2.5 text-[11px] font-black tracking-wide text-white/70">去哪里 · 点了就出发，选中的地点详情在右侧「📍 地点」里</p>
<div className="mt-1.5 flex min-h-0 flex-wrap content-start gap-1.5 overflow-y-auto pr-0.5">
{getLocations(s.cityKey).map((l) => (
<button key={l.id} type="button" aria-label={`前往${l.name}`} onClick={() => { setNavOpen(false); walkTo(l.id); }} className={`rounded-full border px-2.5 py-1.5 text-xs font-bold ${l.id === selectedLoc ? "border-transparent bg-white text-[#14202b]" : "border-white/25 bg-white/10 text-white"}`}>
{l.emoji} {l.short}{world?.online.some((pl) => pl.cityKey === s.cityKey && pl.locId === l.id && pl.id !== myId) ? " ·有人" : ""}
</button>
))}
</div>
</div>
)}
</>
)} />
</div>

</section>

{/* Aside: one unified regional panel — place details + log / world
    feed / NPC wall / chat / board. It never hides: collapsed it folds
    VERTICALLY into a slim strip on the right edge (tab icons + vertical
    「地区面板」 label), always visible, one tap to expand back; the map
    takes the whole width either way. */}
<>
{asideOpen && (
<>
<button type="button" aria-label="点空白处把地区面板竖着收起成右侧竖条" onClick={() => setAsideOpen(false)} className="fixed inset-0 z-[35] cursor-default bg-black/15" />
<div className="float-panel fixed bottom-[76px] right-3 top-[76px] z-40 flex w-[430px] max-w-[calc(100vw-24px)] flex-col overflow-y-auto overflow-x-hidden rounded-[18px] border-2 border-[var(--border)] p-4 shadow-2xl">
<div className="mb-2.5 flex items-center justify-between gap-2">
<p className="text-xs font-black tracking-wide text-[var(--dim)]">🗺️ 地区面板 · {selLoc.emoji} {selLoc.short}一带</p>
<button type="button" aria-label="竖着收起地区面板，收成屏幕右侧的竖条，点竖条随时展开" title="竖着收起成右侧竖条，一直留在屏幕边上，点一下就展开" onClick={() => setAsideOpen(false)} className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-black transition hover:border-[var(--border)]">竖收起 »</button>
</div>
<div className="grid grid-cols-6 gap-1 rounded-full bg-[var(--surface2)] p-1" role="tablist" aria-label="地点与联机面板">
{([["place", "📍 地点"], ["feed", "🏘️ 动态"], ["wall", "🧑‍🤝‍🧑 街坊墙"], ["chat", "💬 聊天"], ["board", "🏆 排行"], ["guide", "📖 图鉴"]] as const).map(([k, label]) => (
<button key={k} type="button" role="tab" aria-selected={asideTab === k} onClick={() => setAsideTab(k)} className={`min-w-0 rounded-full px-0.5 py-2 text-center text-[11px] font-black leading-tight min-[420px]:text-xs ${asideTab === k ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--dim)]"}`}>{label}</button>
))}
</div>

{asideTab === "place" && (
<div className="mt-3 max-h-[calc(100vh-190px)] min-w-0 overflow-y-auto overflow-x-hidden pr-1">
<div>
<div className="flex items-start gap-3">
<div className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] text-3xl" style={{ background: hexCss(selLoc.color) + "2b" }}>{selLoc.emoji}</div>
<div className="min-w-0 flex-1">
<h3 className="font-display break-words text-xl font-black">{selLoc.type === "home" ? homeName(s) : selLoc.name}</h3>
{(LOC_EN[selLoc.name] || LOC_GRADE[selLoc.name]) && selLoc.type !== "home" && (
<p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--dim)]">
{LOC_EN[selLoc.name] && <span className="font-semibold tracking-wide">{LOC_EN[selLoc.name]}</span>}
{LOC_GRADE[selLoc.name] && <span className="chip" style={{ borderColor: "var(--gold)", color: "var(--gold)" }}>🏅 {LOC_GRADE[selLoc.name]}</span>}
</p>
)}
<p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">
{selLoc.type === "home" ? `你现在的家：周租 ${fmt(s.rent)}，舒适度 ${computeComfort(s)}，已买家具 ${s.furniture.length} 件。睡觉回能量，也能在这儿按 ZhuyaHome 的样子装修。` : selLoc.desc}
</p>
</div>
<span className={`shrink-0 text-xs font-black ${arrived ? "text-[var(--green)]" : "text-[var(--accent)]"}`}>{walking ? "🚶 赶路中…" : arrived ? "● 你在这里" : "未到达"}</span>
</div>
{arrived && (() => { const rainyNow = nowRainy; const want = rainyNow ? "raincoat" : selLoc.type === "work" ? "formal" : selLoc.type === "gym" ? "sport" : selLoc.type === "home" ? "pajamas" : null; if (!want || s.outfit === want) return null; const wo = outfitOf(want); return (
<p className="mt-2 flex flex-wrap items-center gap-2 rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-xs font-bold">👕 场合提示：这里更适合穿「{wo.name}」（{wo.scene}），你现在穿的是「{outfitOf(s.outfit).name}」。
<button type="button" aria-label={`按场合换上${wo.name}`} onClick={() => buyOutfit(want)} className="rounded-full bg-[var(--text)] px-3 py-1 text-[11px] font-black text-[var(--bg)]">{s.ownedOutfits.includes(want) ? `换上${wo.name}` : `${fmt(wo.price)} 买下穿上`}</button></p> ); })()}
{!arrived && !walking && (() => { const cur = locById(currentLoc); const d = Math.hypot(selLoc.x - cur.x, selLoc.z - cur.z); const tm = modesForCity(s.cityKey).find((m) => m.id === travelMode) ?? modeById(travelMode); return (
<button type="button" onClick={() => walkTo(selLoc.id)} className="mt-3 w-full rounded-full bg-[var(--text)] py-3 text-sm font-black text-[var(--bg)]">{tm.emoji} {tm.name}过去 → · 预计约 {etaMinutes(travelMode, d)} 分钟（{tm.speedTag}）</button>
); })()}
{(() => { const g = guideForLocName(selLoc.name); if (!g) return null; return <ExperienceCard g={g} here={arrived} unlocked={(s.album ?? []).includes(g.key)} onCheckin={() => checkinGuide(g)} />; })()}
<p className="mt-3.5 flex items-baseline justify-between gap-2"><span className="text-xs font-black tracking-wide">📍 在这里能做 · 常用操作</span><span className="text-[11px] font-bold text-[var(--dim)]">{arrived ? "点一下就行动" : "到了才能做"}</span></p>
<div className="mt-2 grid gap-2">
{actionsFor(selLoc, s).map((a) => (
<button key={a.kind + (a.arg ?? 0)} type="button" disabled={!arrived || a.disabled} onClick={() => { if (a.kind === "__sleep") playLifeAnim("sleep", () => doSleep()); else if (a.kind.startsWith("__gocity-")) switchCity(a.kind.slice("__gocity-".length) as CityKey); else doAction(a.kind, a.arg ?? 0); }} className="act-btn">
<span className="flex items-center justify-between text-sm font-black"><span>{a.title}</span><span>{a.emoji}</span></span>
<span className="mt-0.5 block text-xs leading-relaxed text-[var(--dim)]">{a.desc}</span>
<span className="mt-1 block text-xs font-bold text-[var(--accent2)]">{a.cost}</span>
</button>
))}
</div>
{arrived && selLoc.type === "transit" || arrived && selLoc.type === "port" ? (
<Fold title={s.cityKey === "hz" ? "🚆 城际 · 高铁线路与出发" : s.cityKey === "hk" ? "🚇 港铁线路与出发" : "🚇 线路与坐车出发"} summary={`${linesForLoc(s.cityKey, selLoc.id).length} 条线经过 · 点开选目的地进车厢`} groupKey={`transit-${selLoc.id}`} defaultOpen>
<p className="text-sm font-bold">{s.cityKey === "hz" ? "🚆" : "🚇"} 这里经过的线路</p>
{linesForLoc(s.cityKey, selLoc.id).length === 0 && selLoc.id !== "metro" && selLoc.id !== "north" && selLoc.id !== "hzsouth" ? <p className="mt-1 text-xs text-[var(--dim)]">{s.cityKey === "hz" ? "本站以公路/接送为主；打开手机「城轨通」看城际/高铁线网，或走到城轨站、惠州南站坐车。" : s.cityKey === "hk" ? "本站以巴士/接送为主；打开手机「港铁通」看港铁线网，或走到就近的港铁站坐车。香港只有港铁，没有地铁。" : "本站以公路/接送为主；打开手机「地铁通」看全线网，或走到地铁站坐车。"}</p> : null}
<div className="mt-2 flex flex-wrap gap-1.5">{linesForLoc(s.cityKey, selLoc.id).map((l) => <span key={l.id} className="chip" style={{ borderColor: l.colorCss }}><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: l.colorCss }} />{l.name}</span>)}{s.cityKey === "sz" && selLoc.id === "metro" && <span className="text-xs text-[var(--dim)]">市中心换乘站：1/2/3/4/5/9/11号线在此交汇（见手机地铁通全线）</span>}{s.cityKey === "hz" && selLoc.id === "metro" && <span className="text-xs text-[var(--dim)]">莞惠城际停靠站：往西去东莞，往北到惠州北站（可换乘赣深高铁）；去深圳的高铁在惠州南站坐——两站之间有接驳巴士，路线规划会自动算上。</span>}{selLoc.id === "north" && <span className="text-xs text-[var(--dim)]">4/5/6号线 + 厦深高铁：坐高铁约半小时到惠州南站——点顶部「🚄 去惠州」就能切换到惠州过日子，钱和进度都带着走。</span>}{selLoc.id === "hzsouth" && <span className="text-xs text-[var(--dim)]">厦深高铁 + 广汕高铁大站：半小时回深圳北。回深圳过日子点顶部「🚄 去深圳」；去坐城际要先坐接驳巴士到惠州北站，坐车时路线会自动规划这段接驳。</span>}</div>
{allMetroDestinations(s.cityKey, selLoc.id).length > 0 && (
<div className="mt-3"><p className="text-xs font-black tracking-wide text-[var(--dim)]">坐{s.cityKey === "hz" ? "城轨/高铁" : "地铁/城轨"}出发（含换乘规划，点一下进车厢，一次坐到底）</p>
<div className="mt-2 grid gap-2">
{allMetroDestinations(s.cityKey, selLoc.id).slice(0, 12).map(({ locId, route }) => (
<button key={locId} type="button" onClick={() => startMetroRide(selLoc.id, locId)} className="act-btn">
<span className="text-sm font-bold">{locById(locId).emoji} {locById(locId).name}</span>
<span className="block text-xs text-[var(--dim)]"><span style={{ color: route.line.colorCss }}>● {route.summary}</span> · {route.stops} 站{route.isTransfer ? ` · ${route.transferStations.join("、")}换乘` : ""}{route.shuttleFrom.length > 0 ? " · 含站外接驳巴士" : ""} · 票价 {Y}{route.fare} · 进车厢乘车</span>
</button>
))}
</div></div>
)}
</Fold>
) : null}
{arrived && selLoc.type === "food" ? (
<Fold title="🍽️ 堂食 · 外卖" summary={`${RESTAURANTS.filter((r) => r.cities.includes(s.cityKey)).length} 家店可以走进去吃 · 外卖 ${DELIVERY_PLATFORMS.length} 个平台`} groupKey={`food-${selLoc.id}`}>
<p className="text-sm font-bold">🍽️ 走进饭店堂食（点一家走进去坐下吃）</p>
<div className="mt-2 grid gap-2">
{RESTAURANTS.filter((r) => r.cities.includes(s.cityKey)).map((r) => (
<button key={r.id} type="button" onClick={() => setVenueScene({ kind: "dine", id: r.id })} className="act-btn">
<span className="text-sm font-bold">{r.emoji} {r.name} <span className="text-[var(--accent)]">{r.tier}</span></span>
<span className="block text-xs text-[var(--dim)]">{r.cuisine} · {r.region} · {r.tables}</span>
</button>
))}
</div>
<p className="mt-3 text-xs font-black tracking-wide text-[var(--dim)]">不想出门？点外卖（选平台 × 菜品）</p>
{DELIVERY_PLATFORMS.map((plat, pi) => (
<div key={plat.id} className="mt-2 flex flex-wrap items-center gap-2">
<span className="chip">{plat.emoji} {plat.name}</span><span className="text-[11px] text-[var(--dim)]">{plat.note}</span>
{FOODS[s.cityKey].map((f, fi) => (
<button key={f.name} type="button" aria-label={`${plat.name}点${f.name}`} onClick={() => orderDelivery(pi, fi)} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold">{f.emoji} {f.name} {Y}{Math.round(f.cost * plat.feeMul)}</button>
))}
</div>
))}
</Fold>
) : null}
{arrived && (selLoc.type === "mall" || selLoc.type === "food") ? (
<Fold title="🛍️ 购物场景" summary={`${SHOP_VENUES.filter((v) => v.cities.includes(s.cityKey)).length} 家店 · 走进去逛、试、买`} groupKey={`shop-${selLoc.id}`}>
<p className="text-sm font-bold">🛍️ 购物场景（走进去逛）</p>
<div className="mt-2 grid gap-2">
{SHOP_VENUES.filter((v) => v.cities.includes(s.cityKey)).map((v) => (
<button key={v.id} type="button" onClick={() => setVenueScene({ kind: "shop", id: v.id })} className="act-btn">
<span className="text-sm font-bold">{v.emoji} {v.name}</span>
<span className="block text-xs text-[var(--dim)]">{v.kind} · 点开走进去逛、试、买</span>
</button>
))}
</div>
</Fold>
) : null}
{arrived && (selLoc.type === "lodging" || selLoc.type === "home") ? (
<Fold title="🛏️ 住宿场景" summary="酒店 / 青旅 / 民宿 / 租房 · 走进去看房间" groupKey={`stay-${selLoc.id}`}>
<p className="text-sm font-bold">🛏️ 住宿场景（酒店 / 青旅 / 民宿 / 租房，走进去看）</p>
<div className="mt-2 grid gap-2">
{LODGINGS.map((l) => (
<button key={l.id} type="button" onClick={() => setVenueScene({ kind: "stay", id: l.id })} className="act-btn">
<span className="text-sm font-bold">{l.emoji} {l.name} <span className="text-[var(--accent)]">{Y}{l.id === "rent-flat" ? rentFlatWeekly(s.cityKey) : l.price}/{l.priceUnit}</span></span>
<span className="block text-xs text-[var(--dim)]">{l.kind} · {l.perk}</span>
</button>
))}
</div>
</Fold>
) : null}
{arrived && scenicOf(s.cityKey, selLoc.id) ? (
<div className="mt-3 rounded-[12px] bg-[var(--surface2)] px-3 py-2.5">
<p className="text-sm font-bold">📸 风景打卡 · {scenicOf(s.cityKey, selLoc.id)?.name} <span className="chip">{scenicOf(s.cityKey, selLoc.id)?.tag}</span> {(s.visitedScenic ?? []).includes(`${s.cityKey}:${selLoc.id}`) ? <span className="chip">✅ 已打卡</span> : <span className="chip">未打卡</span>}</p>
<p className="mt-1 text-xs text-[var(--dim)]">{scenicOf(s.cityKey, selLoc.id)?.tip} · 本城已打卡 {(s.visitedScenic ?? []).filter((k) => k.startsWith(s.cityKey + ":")).length} / {SCENIC_SPOTS.filter((x) => x.cityKey === s.cityKey).length} 处，用上方「拍照打卡」集齐风景册。</p>
</div>
) : null}
{selLoc.type === "home" && arrived && (
<Fold title="🏠 我的家 · 户型 / 衣柜 / 装修 / 家具" summary={`${homeName(s)} · 舒适度 ${computeComfort(s)} · 家具 ${s.furniture.length} 件 · 食材 ×${s.groceries}`} groupKey="home-panel">
{renderHomePanel(s)}
</Fold>
)}
</div>
<Fold title="📓 我的日子 · 生活日志" summary={s.log[0] ? `最近：第 ${s.log[0].day} 天 · ${s.log[0].text}` : "还没有记录"} groupKey="my-log">
<div className="grid max-h-[280px] gap-1.5 overflow-y-auto pr-0.5">
{s.log.slice(0, 10).map((entry, i) => (
<p key={i} className="rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-[13px] leading-relaxed">
<span className="mr-2 text-[11px] font-black text-[var(--dim)]">第 {entry.day} 天</span>{entry.text}
</p>
))}
</div>
</Fold>
</div>
)}

{asideTab === "feed" && (
<div className="mt-3 grid max-h-[520px] gap-1.5 overflow-y-auto pr-0.5">
{(world?.feed ?? []).length === 0 && <p className="text-sm text-[var(--dim)]">还没有动态。你进城的消息会出现在这里，其他玩家的晋升、APEC 服务和结算也会。</p>}
{(() => { const merged = new Map<string, { id: number; playerName: string; kind: string; text: string; createdAt: string; n: number }>(); for (const f of world?.feed ?? []) { const k = `${f.playerName}|${f.kind}|${f.text}`; const cur = merged.get(k); if (cur) cur.n += 1; else merged.set(k, { ...f, n: 1 }); } return [...merged.values()]; })().map((f) => (
<div key={f.id} className="rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2">
<p className="break-words text-[13px] leading-relaxed"><span className="mr-1">{feedKindEmoji[f.kind] ?? "✨"}</span><b>{f.playerName}</b> {f.text}{f.n > 1 && <span className="chip ml-1.5 align-middle">同类 ×{f.n} · 已合并</span>}</p>
<p className="text-[11px] text-[var(--dim)]">{timeStr(f.createdAt)}{f.n > 1 ? "（最近一次）" : ""}</p>
</div>
))}
</div>
)}

{asideTab === "wall" && (
<div className="mt-3">
<p className="text-[11px] leading-relaxed text-[var(--dim)]">街坊们每天自己发动态、互相评论：聊天气、聊 APEC、聊你升职和搬新家的事。你可以点赞、评论，他们会记住你、也可能回你。</p>
<div className="mt-2 grid max-h-[520px] gap-2 overflow-y-auto pr-0.5">
{(s.npcFeed ?? []).length === 0 && <p className="text-sm text-[var(--dim)]">街坊墙还空着，睡一觉到明天，他们就会热闹起来。</p>}
{(s.npcFeed ?? []).map((post) => {
const author = NPCS.find((n) => n.name === post.author);
const aMem = memOf(s.npcMem ?? {}, post.author);
const kindTag: Record<NpcPost["kind"], string> = { weather: "🌦️ 天气", apec: "🌐 APEC", player: "📣 关于你", life: "🏠 日常", work: "💼 工作", food: "🍜 吃食" };
return (
<div key={post.id} className="rounded-[12px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5">
<p className="flex flex-wrap items-center gap-1.5 text-[13px]"><span className="text-base">{author?.emoji ?? "🧑"}</span><b>{post.author}</b><span className="text-[11px] text-[var(--dim)]">{author?.job ?? ""} · 第 {post.day} 天</span><span className="chip ml-auto">{kindTag[post.kind]}</span></p>
<p className="mt-1 break-words text-[13px] leading-relaxed">{post.text}</p>
{post.comments.length > 0 && (
<div className="mt-1.5 grid gap-1 border-t border-dashed border-[var(--line)] pt-1.5">
{post.comments.map((c, ci) => (
<p key={ci} className="text-xs leading-relaxed"><b>{c.author}</b><span className="text-[var(--dim)]">：{c.text}</span></p>
))}
</div>
)}
<div className="mt-2 flex flex-wrap items-center gap-1.5">
<button type="button" aria-label={post.liked ? `已给${post.author}的动态点赞` : `给${post.author}的动态点赞`} disabled={post.liked} onClick={() => likeNpcPost(post.id)} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold disabled:opacity-60">{post.liked ? "❤️" : "🤍"} {post.likes}</button>
{!post.playerComment ? (
<>
<span className="text-[11px] text-[var(--dim)]">评论：</span>
{(["👍 同感", "😂 哈哈", "💪 加油"] as const).map((t) => (
<button key={t} type="button" aria-label={`评论${post.author}的动态：${t}`} onClick={() => commentNpcPost(post.id, t)} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold">{t}</button>
))}
</>
) : (
<span className="text-[11px] font-bold text-[var(--accent2)]">你评论了「{post.playerComment}」{aMem.rel >= 35 ? " · 老朋友的动态" : ""}</span>
)}
<button type="button" aria-label={`找${post.author}私聊`} onClick={() => openNpcChat(post.author)} className="ml-auto rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-black text-[var(--bg)]">💬 找他聊</button>
</div>
</div>
); })}
</div>
</div>
)}

{asideTab === "chat" && (
<div className="mt-3">
<p className="text-xs font-bold text-[var(--dim)]">{city.name}频道 · {onlineHere.length} 人在线：{onlineHere.map((pl) => pl.name).join("、") || "就你自己"}</p>
<div className="mt-2 grid max-h-[380px] gap-1.5 overflow-y-auto pr-0.5">
{(world?.chat ?? []).length === 0 && <p className="text-sm text-[var(--dim)]">频道里还很安静，发第一条消息吧。</p>}
{(world?.chat ?? []).map((m) => (
<div key={m.id} className={`max-w-[92%] rounded-[12px] px-3 py-2 text-[13px] leading-relaxed ${m.playerId === myId ? "justify-self-end bg-[var(--text)] text-[var(--bg)]" : "justify-self-start border border-[var(--line)] bg-[var(--bg)]"}`}>
<p className={`text-[11px] font-black ${m.playerId === myId ? "opacity-70" : "text-[var(--dim)]"}`}>{m.playerName} · {timeStr(m.createdAt)}</p>
<p className="break-words">{m.body}</p>
</div>
))}
</div>
<form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const body = chatInput.trim(); if (body) sendChatMut.mutate(body); }}>
<label htmlFor="chat-input" className="sr-only">发送到{city.name}频道</label>
<input id="chat-input" value={chatInput} onChange={(e) => setChatInput(e.target.value.slice(0, 120))} placeholder={`跟${city.name}的玩家说句话…`} className="min-w-0 flex-1 rounded-full border-2 border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none" />
<button type="submit" disabled={!chatInput.trim() || sendChatMut.isPending} className="shrink-0 rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-black text-white disabled:opacity-40">发送</button>
</form>
</div>
)}

{asideTab === "board" && (
<div className="mt-3 grid gap-1.5">
{(world?.leaderboard ?? []).length === 0 && <p className="text-sm text-[var(--dim)]">排行榜暂时没数据。</p>}
{(world?.leaderboard ?? []).map((b, i) => (
<p key={b.id} className={`flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm ${b.id === myId ? "bg-[var(--surface2)] font-black" : ""}`}>
<span className="w-6 font-black">{i + 1}</span>
<span>{b.emoji}</span>
<span className="min-w-0 flex-1 truncate">{b.name}{b.id === myId ? "（你）" : ""}</span>
<span className="text-xs text-[var(--dim)]">{CITIES[b.cityKey as CityKey]?.name ?? b.cityKey}</span>
<span className="font-black">{fmt(b.money, b.cityKey as CityKey)}</span>
<span className="hidden text-xs text-[var(--dim)] sm:inline">{b.status === "finished" ? b.resultTitle ?? "已结算" : `第 ${b.gameDay} 天 · ${(CAREERS[b.careerIdx] ?? CAREERS[0]!).name}`}</span>
</p>
))}
<p className="text-[11px] leading-relaxed text-[var(--dim)]">按当前存款排序，进行中的玩家也会实时上榜；过完 30 天的成绩会标上结局称号。</p>
</div>
)}
{asideTab === "guide" && (
<div className="mt-3 max-h-[calc(100vh-190px)] min-w-0 overflow-y-auto overflow-x-hidden pr-1">
{(() => { const tour = tourForCity(s.cityKey); const active = s.tourKey === tour.id; const idx = active ? (s.tourIdx ?? 0) : 0; const done = active && !!s.tourDone; return (
<div className="rounded-[14px] border-2 border-[var(--border)] bg-[var(--surface)] p-3">
<p className="text-sm font-black">🧭 一日游路线 · {tour.name}</p>
<p className="mt-0.5 text-[11px] font-semibold italic text-[var(--dim)]">{tour.nameEn}</p>
<p className="mt-1 text-xs text-[var(--dim)]">{tour.line}</p>
<div className="mt-2 grid gap-1.5">
{tour.stops.map((name, i) => { const st = done || i < idx ? "done" : i === idx ? "next" : "todo"; const gl = guideForLocName(name); return (
<p key={name} className={`flex items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-xs font-bold ${st === "next" ? "bg-[var(--surface2)]" : ""}`}>
<span>{st === "done" ? "✅" : st === "next" ? "◎" : "○"}</span>
<span className="min-w-0 flex-1">{i + 1}. {name}{gl ? <span className="text-[var(--dim)]"> · {gl.nameEn}</span> : null}</span>
{st === "next" && <span className="shrink-0 text-[var(--accent)]">下一站 · 到站 +{fmt(tour.rewardPerStop)}</span>}
{st === "done" && <span className="shrink-0 text-[var(--green)]">已到达</span>}
</p> ); })}
</div>
{done ? (
<div className="mt-2 flex flex-wrap items-center justify-between gap-2">
<p className="text-xs font-black text-[var(--green)]">🏁 全程完成！完赛奖励 {fmt(tour.rewardFinish)} 已到账</p>
<button type="button" aria-label="再走一遍一日游路线" onClick={() => restartTour(tour)} className="rounded-full border border-[var(--line)] px-3 py-1 text-[11px] font-black">再走一遍</button>
</div>
) : <p className="mt-2 text-[11px] leading-relaxed text-[var(--dim)]">按顺序到达每一站自动打卡：每站 +{fmt(tour.rewardPerStop)}，走完全程再 +{fmt(tour.rewardFinish)}。在地图上点地点名、或坐车过去都算到达。</p>}
</div> ); })()}
<div className="mt-3 rounded-[14px] border-2 border-[var(--border)] bg-[var(--surface)] p-3">
<p className="text-sm font-black">🔍 看图认地方 <span className="text-[11px] font-bold text-[var(--dim)]">Photo Quiz · 认对 +{fmt(10)}</span></p>
{!quiz ? (
<button type="button" onClick={nextQuiz} className="mt-2 w-full rounded-full bg-[var(--text)] py-2.5 text-sm font-black text-[var(--bg)]">开始认图 →</button>
) : (() => { const target = GUIDE.find((g) => g.key === quiz.key); if (!target) return null; return (
<>
<img src={target.photos[0]} alt="看图认地方：猜猜这是哪里的实拍照片" className="mt-2 h-40 w-full rounded-[10px] object-cover" />
<p className="mt-2 text-xs font-bold">这张实拍是哪里？ <span className="text-[var(--dim)]">Where was this photo taken?</span></p>
<div className="mt-1.5 grid grid-cols-2 gap-1.5">
{quiz.opts.map((name) => { const isTarget = name === target.locName; const picked = quiz.picked === name; return (
<button key={name} type="button" disabled={!!quiz.picked} aria-label={`猜这是${name}`} onClick={() => answerQuiz(name)} className={`rounded-[10px] border px-2 py-2 text-xs font-black ${quiz.picked ? (isTarget ? "border-transparent bg-[var(--green)] text-white" : picked ? "border-transparent bg-[var(--accent)] text-white" : "border-[var(--line)] opacity-55") : "border-[var(--line)] bg-[var(--surface)]"}`}>{name}</button> ); })}
</div>
{quiz.picked && (
<div className="mt-2 flex items-start justify-between gap-2">
<p className="text-xs font-bold leading-relaxed">{quiz.picked === target.locName ? `🎉 对了！` : `这是${target.locName}。`}{target.fact}</p>
<button type="button" onClick={nextQuiz} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-1.5 text-[11px] font-black text-[var(--bg)]">下一题 →</button>
</div>
)}
</>
); })()}
</div>
<p className="mt-4 text-xs font-black tracking-wide">📖 认识{CITIES[s.cityKey].name}图鉴 · 已解锁 {(s.album ?? []).length}/{GUIDE.length} <span className="font-bold text-[var(--dim)]">— 到真地方打卡，把它的实拍和城市知识收进来</span></p>
<div className="mt-2 grid gap-2.5">
{GUIDE.map((g) => { const un = (s.album ?? []).includes(g.key); return (
<div key={g.key} className="overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--surface)]">
<div className="relative">
<img src={g.photos[0]} alt={un ? `${g.locName}实拍照片` : `${g.locName}图鉴条目（未解锁）`} className={`h-28 w-full object-cover ${un ? "" : "opacity-45 grayscale"}`} />
{!un && <span className="absolute inset-0 grid place-items-center px-3 text-center text-sm font-black text-white" style={{ textShadow: "0 2px 8px rgba(0,0,0,.85)" }}>🔒 到{g.locName}打卡解锁</span>}
<span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-black text-white">{CITIES[g.cityKey].name} · {g.locName}</span>
</div>
{un && (
<div className="p-2.5">
<p className="text-[11px] leading-relaxed">{g.fact}</p>
<p className="mt-1 text-[11px] italic leading-relaxed text-[var(--dim)]">{g.factEn}</p>
<p className="mt-1 text-[11px] leading-relaxed">🗣️ {g.npc}：{g.story}</p>
</div>
)}
</div> ); })}
</div>
</div>
)}
</div>
</>
)}
{/* 地区面板收起时不是消失、也不是藏进浮钮，而是竖着收成屏幕右侧
    一条窄窄的竖条：五个页签只留图标竖排 + 「地区面板」竖排字，一直
    留在屏幕边上一眼能看到；点任意图标就展开回对应页签。地图始终
    全屏，不被面板挤占。 */}
{!asideOpen && (
<div className="float-panel fixed right-0 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1 rounded-l-[14px] border-2 border-r-0 border-[var(--border)] px-1 py-2 shadow-2xl">
<span className="px-0.5 pb-1 pt-0.5 text-[11px] font-black tracking-widest text-[var(--dim)] [writing-mode:vertical-rl]" aria-hidden="true">地区面板</span>
{([["place", "📍", "地点"], ["feed", "🏘️", "动态"], ["wall", "🧑‍🤝‍🧑", "街坊墙"], ["chat", "💬", "聊天"], ["board", "🏆", "排行"], ["guide", "📖", "图鉴"]] as const).map(([k, icon, label]) => (
<button key={k} type="button" aria-label={`展开地区面板 · ${label}`} title={`展开地区面板 · ${label}`} onClick={() => { setAsideTab(k); setAsideOpen(true); }} className={`flex w-9 flex-col items-center gap-0.5 rounded-[10px] px-0.5 py-1.5 text-base leading-none transition hover:bg-[var(--surface2)] ${asideTab === k ? "bg-[var(--surface2)]" : ""}`}><span aria-hidden="true">{icon}</span><span className="text-[10px] font-black [writing-mode:vertical-rl]">{label}</span></button>
))}
</div>
)}
</>
</main>

{/* ===== VENUE SCENES: dine / shop / stay ===== */}
{venueScene && venueScene.kind === "dine" && (() => { const r = RESTAURANTS.find((x) => x.id === venueScene.id); if (!r) return null; const ck = `dine-${r.id}`; return (
<div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-[2px] p-3 sm:items-center" role="dialog" aria-label={r.name}>
<div className="rise max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] shadow-xl">
<div className="bg-[#7c2d12] p-4 text-white"><p className="text-xs font-black">{r.emoji} {r.cuisine} · {r.region} · 人均档位 {r.tier}</p><p className="font-display mt-1 text-2xl font-black">{r.name} · 店内</p><p className="mt-0.5 text-xs opacity-90">座位：{r.tables}</p></div>
<div className="p-4">
<p className="rounded-[12px] bg-[var(--surface2)] px-3 py-2.5 text-sm leading-relaxed">🏮 {r.scene}</p>
<p className="mt-3 text-xs font-black tracking-wide text-[var(--dim)]">坐下来点菜（堂食，点一道吃一道）</p>
<div className="mt-2 grid gap-2">
{r.dishes.map((d, i) => (
<button key={d.name} type="button" onClick={() => dineEat(r.name, i)} disabled={s.money < d.cost} className="act-btn disabled:opacity-40">
<span className="flex items-center justify-between text-sm font-black"><span>{d.name}</span><span className="text-[var(--accent)]">{fmt(d.cost)}</span></span>
<span className="mt-0.5 block text-xs text-[var(--dim)]">{d.desc} · 能量 +{d.energy} · 心情 +{d.mood}</span>
</button>
))}
</div>
<div className="mt-3 grid grid-cols-2 gap-2">
<button type="button" aria-label="和邻桌拼桌聊天" disabled={sceneFlag(ck + "-chat")} onClick={() => { setSceneFlag(ck + "-chat"); const got = Math.random() < 0.45; mutate((x) => { x.mood += 6; if (got) x.network += 1; }); showToast(got ? "拼桌聊得投机，加了微信，人脉 +1，心情 +6。" : "和邻桌聊了聊哪道菜好吃，心情 +6。"); }} className="act-btn disabled:opacity-40"><span className="text-sm font-black">💬 拼桌聊天</span><span className="block text-xs text-[var(--dim)]">{sceneFlag(ck + "-chat") ? "刚聊过一轮" : "心情 +6 · 可能 +人脉"}</span></button>
<button type="button" aria-label="看后厨和店里表演" disabled={sceneFlag(ck + "-show")} onClick={() => { setSceneFlag(ck + "-show"); mutate((x) => { x.mood += 4; }); showToast("看了一会儿明档师傅的手艺，心情 +4。"); }} className="act-btn disabled:opacity-40"><span className="text-sm font-black">👨‍🍳 看明档手艺</span><span className="block text-xs text-[var(--dim)]">{sceneFlag(ck + "-show") ? "看过了" : "师傅现场做菜，心情 +4"}</span></button>
</div>
<button type="button" onClick={() => setVenueScene(null)} className="mt-4 w-full rounded-full bg-[var(--text)] py-3 text-sm font-black text-[var(--bg)]">买单离开 →</button>
</div></div></div> ); })()}
{venueScene && venueScene.kind === "shop" && (() => { const v = SHOP_VENUES.find((x) => x.id === venueScene.id); if (!v) return null; const ck = `shop-${v.id}`; return (
<div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-[2px] p-3 sm:items-center" role="dialog" aria-label={v.name}>
<div className="rise max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] shadow-xl">
<div className="bg-[#831843] p-4 text-white"><p className="text-xs font-black">{v.emoji} {v.kind}</p><p className="font-display mt-1 text-2xl font-black">{v.name} · 店内</p></div>
<div className="p-4">
<p className="rounded-[12px] bg-[var(--surface2)] px-3 py-2.5 text-sm leading-relaxed">🛍️ {v.scene}</p>
<p className="mt-3 text-xs font-black tracking-wide text-[var(--dim)]">逛一逛，看到喜欢的就买</p>
<div className="mt-2 grid gap-2">
{v.items.map((it, i) => (
<button key={it.name} type="button" onClick={() => shopBuy(v.name, i)} disabled={s.money < it.cost} className="act-btn disabled:opacity-40">
<span className="flex items-center justify-between text-sm font-black"><span>{it.name}</span><span className="text-[var(--accent)]">{fmt(it.cost)}</span></span>
<span className="mt-0.5 block text-xs text-[var(--dim)]">{it.desc} · 心情 +{it.mood}</span>
</button>
))}
</div>
<button type="button" aria-label="只逛不买看看" disabled={sceneFlag(ck + "-look")} onClick={() => { setSceneFlag(ck + "-look"); mutate((x) => { x.mood += 5; }); showToast("逛了一大圈，试了几件没买，过眼瘾心情 +5。"); }} className="act-btn mt-3 disabled:opacity-40"><span className="text-sm font-black">👀 只逛不买</span><span className="block text-xs text-[var(--dim)]">{sceneFlag(ck + "-look") ? "逛过了" : "试穿试用，心情 +5 · 免费"}</span></button>
<button type="button" onClick={() => setVenueScene(null)} className="mt-4 w-full rounded-full bg-[var(--text)] py-3 text-sm font-black text-[var(--bg)]">离开 →</button>
</div></div></div> ); })()}
{venueScene && venueScene.kind === "stay" && (() => { const l = LODGINGS.find((x) => x.id === venueScene.id); if (!l) return null; return (
<div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-[2px] p-3 sm:items-center" role="dialog" aria-label={l.name}>
<div className="rise max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] shadow-xl">
<div className="bg-[#1e3a5f] p-4 text-white"><p className="text-xs font-black">{l.emoji} {l.kind} · {Y}{l.id === "rent-flat" ? rentFlatWeekly(s.cityKey) : l.price}/{l.priceUnit}</p><p className="font-display mt-1 text-2xl font-black">{l.name} · 房间里</p></div>
<div className="p-4">
<p className="rounded-[12px] bg-[var(--surface2)] px-3 py-2.5 text-sm leading-relaxed">🛏️ {l.scene}</p>
<p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">{l.perk}</p>
{l.id === "rent-flat" ? (
<button type="button" onClick={signRent} className="mt-4 w-full rounded-full bg-[var(--accent)] py-3.5 text-sm font-black text-white">🔑 就这间，签约（周租 {fmt(rentFlatWeekly(s.cityKey))}）</button>
) : (
<button type="button" onClick={() => stayOvernight(l.id)} disabled={s.money < l.price} className="mt-4 w-full rounded-full bg-[var(--accent)] py-3.5 text-sm font-black text-white disabled:opacity-40">🛏️ 住一晚过夜（-{Y}{l.price}，睡到明天）</button>
)}
<button type="button" onClick={() => setVenueScene(null)} className="mt-2 w-full rounded-full border-2 border-[var(--text)] py-3 text-sm font-black">再看看别家 →</button>
</div></div></div> ); })()}

{/* ===== BUS / TAXI RIDE SCENE: the same cinematic treatment as the
    metro carriage — board, ride watching the city slide past, alight.
    Steps advance on a timer; the trip's own walk timer closes it. ===== */}
{roadRide && (() => {
const rr = roadRide;
const isBus = rr.mode === "bus";
const isDrive = rr.mode === "drive";
const steps: { pose: LifePose; caption: string; sub: string }[] = isDrive ? [
{ pose: "walk", caption: "上车，点火出发", sub: "拉开车门坐进驾驶座，系好安全带，点火、看一眼后视镜，慢慢汇入车流" },
{ pose: "drive", caption: "路口等红灯", sub: "前面路口红灯亮了——跟全城的车一起停下来等。绿灯一亮，脚下给油，车流重新流动起来" },
{ pose: "drive", caption: "跟着车流走", sub: "双手扶着方向盘，商圈、写字楼、行道树从挡风玻璃前一段段划过——这座城市的路，你越来越熟" },
{ pose: "walk", caption: "找车位，停好下车", sub: "绕了一小圈找到车位，倒车入库、拉手刹、锁车——到了" },
] : isBus ? [
{ pose: "walk", caption: "公交进站，上车", sub: "车在站台稳稳停住，前门打开——你刷卡上车，往里走找座位" },
{ pose: "sit", caption: "坐稳了，看窗外", sub: "公交一站站往前开，街景、行道树和店铺在窗外一段段往后退" },
{ pose: "sit", caption: "快到了，准备下车", sub: "车载广播报站：下一站就是你的目的地——按一下下车铃，扶好站起来" },
{ pose: "walk", caption: "到站下车", sub: "后门下车，脚一落地，新地方到了" },
] : [
{ pose: "walk", caption: "车到了，上车", sub: "你叫的车停在面前，拉开车门坐进后排，系好安全带，跟司机确认目的地" },
{ pose: "sit", caption: "坐在车里看城市", sub: "车汇入车流，高架、商圈、写字楼在窗外划过——打车就是图个快和省心" },
{ pose: "sit", caption: "快到了", sub: "司机打了转向灯靠边：前面路口就是你的目的地" },
{ pose: "walk", caption: "下车，到了", sub: "推门下车，车灯一闪开走了，你站在目的地门口" },
];
const step = steps[Math.min(roadRideStep, steps.length - 1)]!;
const outfitR = outfitOf(s.outfit);
return (
<div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-[2px] p-3 sm:items-center" role="dialog" aria-label={isBus ? "公交车厢" : isDrive ? "自驾开车" : "出租车车厢"}>
<div className="rise w-full max-w-lg overflow-hidden rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] shadow-xl">
<div className="p-4 pb-3 text-white" style={{ background: isBus ? "#2563eb" : isDrive ? "#166534" : "#b45309" }}>
<p className="flex items-center justify-between text-xs font-black"><span>{isBus ? "🚌 公交车厢" : isDrive ? "🚗 自驾 · 驾驶座" : "🚕 出租车里"}</span><span>{rr.fare > 0 ? `${isDrive ? "油费+停车" : "车费"} ${Y}${rr.fare}` : "免费乘车"}</span></p>
<p className="font-display mt-1 text-2xl font-black">{rr.fromName} → {rr.toName}</p>
<p className="mt-0.5 text-xs opacity-90">{isBus ? "一站站往前开，窗外是真实的街景" : isDrive ? "自己开车：跟车流、等红灯、找车位，窗外是真实的街景" : "点对点直达，窗外风景划过"} · 预计约 {etaMinutes(rr.mode, Math.hypot(locById(selectedLoc).x - locById(currentLoc).x, locById(selectedLoc).z - locById(currentLoc).z))} 分钟</p>
</div>
<div className="mx-4 mt-3 overflow-hidden rounded-[16px] border-2 border-[var(--line)]">
<div className="relative h-52">
<LifeStage3D key={`road-${rr.mode}-${roadRideStep >= 3 ? "out" : roadRideStep === 0 ? "in" : "ride"}`} setKind={rr.mode} pose={step.pose} shirt={outfitR.shirt} pants={outfitR.pants} night={false} emoji={iden.emoji} cur={Y} />
<div className="cine-grade" />
</div>
<p className="bg-[var(--surface2)] px-3 py-2 text-xs leading-relaxed"><b>{step.caption}</b> · {step.sub}</p>
</div>
<div className="flex items-center gap-2 px-4 py-3.5">
<div className="flex gap-1">{steps.map((_, i) => (<span key={i} className={`h-1.5 rounded-full transition-all ${i <= roadRideStep ? "w-5 bg-[var(--accent)]" : "w-2.5 bg-[var(--line)]"}`} />))}</div>
<span className="text-[11px] font-bold text-[var(--dim)]">{roadRideStep >= 3 ? "到站了，马上回到地图" : roadRideArrived ? "车已到站，演完这一步就回到地图" : "行驶中…四步演完才收起，不会中途掐断"}</span>
<button type="button" aria-label="跳过搭乘动画，回到地图看行程" onClick={() => { setRoadRide(null); setRoadRideArrived(false); }} className="ml-auto rounded-full border-2 border-[var(--text)] px-4 py-2 text-xs font-black">看地图 ⏭</button>
</div>
</div>
</div>
);
})()}

{/* ===== METRO CARRIAGE SCENE ===== */}
{carriage && (() => {
const c = carriage;
const curLine = c.route.legs[c.legIdx]?.line ?? c.route.line;
const total = c.route.stations.length;
const arrivedC = c.stopIdx >= total - 1 && !c.awaitingTransfer;
const outfitC = outfitOf(s.outfit);
const isRailRide = c.route.legs.some((l) => ["szhz-rail", "guangshen", "hz-intercity", "ganshen-rail", "guangshan-rail"].includes(l.line.id));
const RAIL_ENTRY_SETS: LifeSet[] = ["station", "station", "platform", "platform"];
const stageSet: LifeSet = rideEntry !== null ? (isRailRide ? RAIL_ENTRY_SETS[rideEntry]! : ENTRY_STEPS[rideEntry]!.set) : c.awaitingTransfer || arrivedC ? "platform" : isRailRide ? "train" : "metro";
const stagePose: LifePose = rideEntry !== null ? ENTRY_STEPS[rideEntry]!.pose : c.awaitingTransfer || arrivedC ? "walk" : c.seated ? "sit" : "idle";
const stageKey = rideEntry !== null ? `entry-${rideEntry}` : c.awaitingTransfer ? "transfer" : arrivedC ? "arrived" : c.seated ? "sit" : "stand";
const curStation = c.route.stations[c.stopIdx];
const nextStation = c.route.stations[c.stopIdx + 1];
return (
<div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-[2px] p-3 sm:items-center" role="dialog" aria-label={`${curLine.name}车厢`}>
<div className="rise max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-0 shadow-xl">
{/* carriage header: line strip */}
<div className="p-4 pb-3 text-white" style={{ background: curLine.colorCss }}>
<p className="flex items-center justify-between text-xs font-black"><span>{isRailRide ? "🚄" : "🚇"} {curLine.name}{c.route.isTransfer ? ` · 全程 ${c.route.summary}` : ""}</span><span>{c.crowdLabel}</span></p>
<p className="font-display mt-1 text-2xl font-black">{c.awaitingTransfer ? `换乘站 · ${curStation?.name}站` : arrivedC ? `已到达 · ${curStation?.name}站` : `下一站 · ${nextStation?.name ?? ""}`}</p>
<p className="mt-0.5 text-xs opacity-90">{locById(c.fromLoc).name} → {locById(c.toLoc).name} · 共 {c.route.stops} 站{c.route.isTransfer ? ` · 换乘 ${c.route.transferStations.length} 次（${c.route.transferStations.join("、")}）` : ""} · 票价 {Y}{c.route.fare} · {c.seated ? "💺 坐着" : "🧍 站着扶杆"}</p>
</div>
{/* route strip */}
<div className="flex items-center gap-0 overflow-x-auto px-4 pt-3">
{c.route.stations.map((st, i) => (
<span key={st.name + i} className="flex shrink-0 items-center">
<span className={`grid h-7 w-7 place-items-center rounded-full border-2 text-[10px] font-black ${i < c.stopIdx ? "border-transparent text-white" : i === c.stopIdx ? "bg-[var(--surface)]" : "border-[var(--line)] text-[var(--dim)]"}`} style={i < c.stopIdx ? { background: curLine.colorCss } : i === c.stopIdx ? { borderColor: curLine.colorCss, color: curLine.colorCss } : {}}>{i + 1}</span>
<span className={`mx-1 text-[11px] font-bold ${i === c.stopIdx ? "" : "text-[var(--dim)]"}`}>{st.name}{c.route.transferStations.includes(st.name) && i > 0 && i < total - 1 ? (c.route.shuttleFrom.includes(st.name) ? "（接驳换乘）" : "（换乘）") : ""}</span>
{i < total - 1 && <span className="h-0.5 w-3 shrink-0" style={{ background: i < c.stopIdx ? curLine.colorCss : "var(--line)" }} />}
</span>
))}
</div>
{/* the ride, acted out: concourse → security → platform → carriage */}
<div className="mx-4 mt-3 overflow-hidden rounded-[16px] border-2 border-[var(--line)]">
<div className="relative h-52">
<LifeStage3D key={`ride-${stageKey}`} setKind={stageSet} pose={stagePose} shirt={outfitC.shirt} pants={outfitC.pants} night={false} emoji={iden.emoji} />
<div className="cine-grade" />
</div>
{rideEntry !== null ? (
<div className="flex items-center gap-2 bg-[var(--surface2)] px-3 py-2">
<p className="min-w-0 flex-1 text-xs leading-relaxed"><b>{ENTRY_STEPS[rideEntry]!.caption}</b> · {ENTRY_STEPS[rideEntry]!.sub}</p>
<button type="button" aria-label="跳过进站流程" onClick={() => setRideEntry(null)} className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-black">跳过 →</button>
</div>
) : (
<p className="bg-[var(--surface2)] px-3 py-1.5 text-[11px] font-bold text-[var(--dim)]">{c.awaitingTransfer ? "🚶 换乘：下车穿过换乘通道，走到对面站台再上车" : arrivedC ? "🔔 到站了，屏蔽门和车门都开了——先下后上" : c.seated ? "💺 你坐下了，看手机刷一刷，窗外的城市在往后跑" : "🧍 你站着扶着吊环，窗外风景在滚动"}</p>
)}
</div>
{/* carriage interior */}
{rideEntry === null && (<div className="mx-4 mt-3 rounded-[16px] border-2 border-[var(--line)] bg-[var(--bg)] p-3">
<div className="flex items-center justify-between rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-xs font-bold"><span>🚪 车门 {arrivedC ? "已开 · 先下后上" : "关闭"}</span><span>🖐️ 吊环扶手 ×{c.crowdLevel >= 2 ? "全被扶满" : "还有空位"}</span><span>{c.heldRail ? "✅ 你扶稳了" : "⚠️ 还没扶杆"}</span></div>
<p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">{c.crowdDesc}</p>
<p className="mt-1 rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-xs leading-relaxed">📢 {carriageLog}</p>
</div>)}
{/* interactions */}
{rideEntry === null && (<div className="grid grid-cols-2 gap-2 p-4 pt-3">
<button type="button" aria-label="车厢里看手机" disabled={c.phoneUsed} onClick={() => { setCarriage({ ...c, phoneUsed: true }); setCarriageLog("📱 你打开手机刷了刷：APEC资讯、天气和同城动态都看了一眼，时间过得快了些，心情 +2（下车结算）。"); }} className="act-btn disabled:opacity-40"><span className="text-sm font-black">📱 看手机</span><span className="block text-xs text-[var(--dim)]">{c.phoneUsed ? "刚看过，信号在隧道里时断时续" : "刷资讯/动态，解闷，心情 +2"}</span></button>
<button type="button" aria-label="给需要的人让座" disabled={!c.seated || c.gaveSeat} onClick={() => { setCarriage({ ...c, gaveSeat: true, seated: false }); setCarriageLog("💺 你起身把座位让给了需要的人，对方连声道谢。站一会儿没关系，人脉 +1、心情 +4（下车结算）。"); }} className="act-btn disabled:opacity-40"><span className="text-sm font-black">💺 让座</span><span className="block text-xs text-[var(--dim)]">{!c.seated ? (c.gaveSeat ? "已经让过座了，你站着" : "现在没座位可让（你在站着）") : "让给老人/孕妇，人脉 +1"}</span></button>
<button type="button" aria-label="扶好扶杆站稳" disabled={c.heldRail} onClick={() => { setCarriage({ ...c, heldRail: true }); setCarriageLog(c.crowdLevel >= 2 ? "🖐️ 你抓紧了扶杆。刚好一个急刹，人潮晃了一下——还好你站稳了，没踩到人也没被踩。" : "🖐️ 你扶好吊环，站得很稳。"); }} className="act-btn disabled:opacity-40"><span className="text-sm font-black">🖐️ 扶杆站稳</span><span className="block text-xs text-[var(--dim)]">{c.heldRail ? "已经扶稳了" : "人多时不扶杆，急刹容易摔"}</span></button>
<button type="button" aria-label="听报站看路线" onClick={() => setCarriageLog(`🗺️ 路线图亮着灯：你在 ${curStation?.name}，还要坐 ${total - 1 - c.stopIdx} 站到 ${locById(c.toLoc).name}。${nextStation ? `下一站 ${nextStation.name}。` : ""}`)} className="act-btn"><span className="text-sm font-black">🗺️ 看路线图/听报站</span><span className="block text-xs text-[var(--dim)]">确认还有几站，别坐过站</span></button>
</div>)}
<div className="px-4 pb-4">
{rideEntry !== null ? (
<button type="button" disabled className="w-full rounded-full bg-[var(--accent)] py-3.5 text-sm font-black text-white disabled:opacity-40">🚶 正在进站：安检 → 等车 → 上车，一步都不少</button>
) : c.awaitingTransfer ? (
<button type="button" onClick={doTransfer} className="w-full rounded-full bg-[var(--accent)] py-3.5 text-sm font-black text-white">{c.route.shuttleFrom.includes(curStation?.name ?? "") ? `🚌 在${curStation?.name}下车 · 坐接驳巴士到${nextStation?.name ?? "对面站"}换乘 ${(c.route.legs[c.legIdx + 1]?.line.short) ?? "下一条线"}` : `🔁 在${curStation?.name}换乘上车 → ${(c.route.legs[c.legIdx + 1]?.line.name) ?? "下一条线"}`}</button>
) : (
<button type="button" disabled={!arrivedC} onClick={finishMetroRide} className="w-full rounded-full bg-[var(--accent)] py-3.5 text-sm font-black text-white disabled:opacity-40">{arrivedC ? `🔔 到站了，下车出站 → ${locById(c.toLoc).name}（票 ${Y}${c.route.fare}）` : `行驶中… 还有 ${total - 1 - c.stopIdx} 站（自动报站中）`}</button>
)}
<p className="mt-2 text-center text-[11px] text-[var(--dim)]">{s.cityKey === "hz" ? "真实城轨/高铁乘车体验" : s.cityKey === "hk" ? "真实港铁乘车体验" : "真实深圳地铁体验"}：屏蔽门、先下后上、换乘站广播、早高峰挤车厢。坐过站？不存在的——到站才能下车。</p>
</div>
</div>
</div>
);
})()}

{metroMapOpen && (
<MetroMapModal cityKey={s.cityKey} fromLocId={currentLoc} initialDest={metroMapDest} onClose={() => setMetroMapOpen(false)} onRide={(toLocId) => {
setMetroMapOpen(false);
// walkTo's rail planning handles every case now: standing at a station
// boards directly; anywhere else it walks to the nearest station first
// (pendingRide auto-continues into the ride on arrival), and walks the
// last leg if the destination's anchor station is not the destination.
walkTo(toLocId, "metro");
}} />
)}

{/* ===== LIFE ANIMATION SCENE ===== */}
{lifeAnim && (() => { const scene = LIFE_SCENES[lifeAnim.kind]; const rawStep = scene.steps[Math.min(lifeAnim.idx, scene.steps.length - 1)]!; /* Huizhou has no metro: in the day montage the 换乘地铁 beat is a 城轨 beat there */ const step = rawStep.caption === "换乘地铁" && s.cityKey === "hz" ? { ...rawStep, caption: "换乘城轨", prop: "🚆", bg: "🚆 👥 👥" } : rawStep.caption === "换乘地铁" && s.cityKey === "hk" ? { ...rawStep, caption: "转乘港铁", prop: "🚇", bg: "🚇 👥 👥" } : rawStep; const rainyDay = nowRainy; return (
<div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 backdrop-blur-[3px] p-3 sm:items-center" role="dialog" aria-label={`生活动画：${scene.title}`}>
<div className="rise w-full max-w-lg overflow-hidden rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] shadow-2xl">
<div className="flex items-center gap-2 px-4 pt-3.5">
<span className="chip">📷 真实照片里的 3D 演绎 · Real photo × live 3D</span>
<p className="text-sm font-black">{scene.title}</p>
<span className="ml-auto text-[11px] font-bold text-[var(--dim)]">{lifeAnim.idx + 1} / {scene.steps.length}</span>
</div>
{(() => { const sp = lifeStageFor(lifeAnim.kind, lifeAnim.idx); const outfit = outfitOf(s.outfit); const stepNight = scene.tone === "night" && !step.dawn; return (
<div key={`stage-${lifeAnim.kind}-${lifeAnim.idx}`} className={`life-stage life-fade mx-4 mt-3 h-60 sm:h-72 ${stepNight ? "night" : scene.tone === "indoor" ? "indoor" : ""}`}>
<LifeStage3D key={`${lifeAnim.kind}-${lifeAnim.idx}`} setKind={sp.set} pose={sp.pose} shirt={outfit.shirt} pants={outfit.pants} night={stepNight} emoji={iden.emoji} />
<div aria-hidden="true" className="cine-grade" />
{rainyDay && lifeAnim.kind === "day" && <div className="life-rain" aria-hidden="true" />}
</div> ); })()}
<div key={`cap-${lifeAnim.idx}`} className="life-fade px-4 pb-2 pt-3">
<p className="font-display text-xl font-black">{step.caption}</p>
<p className="mt-0.5 text-sm leading-relaxed text-[var(--dim)]">{step.sub}</p>
</div>
<div className="flex items-center gap-2 px-4 pb-4">
<div className="flex gap-1">{scene.steps.map((_, i) => (<span key={i} className={`h-1.5 rounded-full transition-all ${i <= lifeAnim.idx ? "w-5 bg-[var(--accent)]" : "w-2.5 bg-[var(--line)]"}`} />))}</div>
<button type="button" aria-label="跳过生活动画" onClick={finishLifeAnim} className="ml-auto rounded-full border-2 border-[var(--text)] px-4 py-2 text-xs font-black">跳过 ⏭</button>
</div>
</div>
</div> ); })()}

{/* ===== NPC CHAT ===== */}
{npcChat && (() => { const npc = NPCS.find((n) => n.name === npcChat); if (!npc) return null; const mem = memOf(s.npcMem ?? {}, npcChat); const p = personaOf(npc); return (
<div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/60 backdrop-blur-[2px] p-3 sm:items-center" role="dialog" aria-label={`和${npc.name}聊天`}>
<div className="rise flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] shadow-xl">
<div className="flex items-start gap-3 p-4 pb-3 text-white" style={{ background: hexCss(npc.color) }}>
<span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/25 text-3xl">{npc.emoji}</span>
<div className="min-w-0 flex-1">
<p className="font-display text-xl font-black">{npc.name} · {npc.job}</p>
<p className="text-xs opacity-90">{npc.outfit}</p>
<div className="mt-1.5 flex flex-wrap gap-1.5">
<span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold">{moodEmoji(mem.mood)} {moodWord(mem.mood)}</span>
<span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold">关系：{relLabel(mem.rel)}（{mem.rel > 0 ? "+" : ""}{mem.rel}）</span>
<span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold">聊过 {mem.talks} 次</span>
{mem.helps > 0 && <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold">你帮过他 {mem.helps} 次</span>}
{mem.slights > 0 && <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold">得罪过 {mem.slights} 次</span>}
</div>
</div>
<button type="button" aria-label="结束聊天" onClick={() => setNpcChat(null)} className="shrink-0 rounded-full bg-black/25 px-3 py-1.5 text-sm font-black">✕</button>
</div>
<div className="px-4 pt-2.5">
<p className="text-[11px] leading-relaxed text-[var(--dim)]">🕐 作息：{scheduleOf(npc)} · 性格：{p.warmth >= 0.65 ? "热心肠" : p.warmth <= 0.35 ? "慢热" : "随和"}、{p.humor >= 0.55 ? "开得起玩笑" : p.pride >= 0.6 ? "要面子" : "不爱开玩笑"}、{p.chattiness >= 0.6 ? "话多" : p.chattiness <= 0.35 ? "话少" : "话量适中"}</p>
{mem.note ? <p className="mt-1 rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-xs font-bold">🧠 他记得：{mem.note}</p> : <p className="mt-1 rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-xs text-[var(--dim)]">你们还没发生过什么特别的事——帮个忙、送个小礼物，他都会记着。</p>}
</div>
<div className="mt-2 grid min-h-[120px] flex-1 gap-1.5 overflow-y-auto px-4 py-1">
{npcLog.map((m, i) => (
<div key={i} className={`max-w-[88%] rounded-[12px] px-3 py-2 text-[13px] leading-relaxed ${m.from === "me" ? "justify-self-end bg-[var(--text)] text-[var(--bg)]" : "justify-self-start border border-[var(--line)] bg-[var(--bg)]"}`}>
{m.from === "npc" && <p className="text-[11px] font-black text-[var(--dim)]">{npc.name}</p>}
<p>{m.text}</p>
</div>
))}
</div>
<div className="grid grid-cols-2 gap-1.5 p-3 pt-2 sm:grid-cols-3">
{([
["greet", "👋 打招呼", "聊聊近况"],
["weather", "🌦️ 聊天气", "今天的天儿"],
["work", "💼 聊工作", "他这行的事"],
...(s.cityKey === "sz" || npc.name === "Lisa" ? [["apec", "🌐 聊 APEC", "大会那些事"] as const] : []),
["joke", "😂 开个玩笑", p.pride >= 0.6 && p.humor < 0.45 ? "⚠️ 他要面子，可能翻脸" : "逗他一乐"],
["help", "🤝 帮个忙", "能量 -6 · 人情 +12"],
["gift", "🎁 送小礼物", `${Y}25 · 关系 +8`],
] as [ChatAction, string, string][]).map(([act, label, sub]) => (
<button key={act} type="button" aria-label={`和${npc.name}${label}`} disabled={(act === "help" && s.energy < 6) || (act === "gift" && s.money < 25)} onClick={() => doNpcChat(act)} className="act-btn disabled:opacity-40">
<span className="text-[13px] font-black">{label}</span>
<span className="block text-[11px] text-[var(--dim)]">{sub}</span>
</button>
))}
</div>
<p className="px-4 pb-3 text-center text-[11px] text-[var(--dim)]">他说的每句话都按他的性格和对你的记忆来——帮过他、得罪过他，下次打招呼都不一样。</p>
</div>
</div> ); })()}

{/* 手游式底部导航：地图 / 地点 / 导航 / 每日任务 / 手机 / 睡觉，一只手全够得着 */}
<nav aria-label="游戏主导航" className="fixed bottom-3 left-1/2 z-40 flex w-[min(560px,94vw)] -translate-x-1/2 items-stretch justify-between gap-0.5 rounded-full border-2 border-[var(--border)] bg-[var(--surface)] px-1.5 py-1.5 shadow-[4px_4px_0_var(--border)]">
{([
["🗺️", "地图", () => { setNavOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }],
["📍", "地点", () => { setAsideTab("place"); setAsideOpen(true); }],
["🧭", "导航", () => setNavOpen((o) => !o)],
["📋", "每日任务", () => setDailyOpen(true)],
["📱", "手机", () => { setPhoneApp(null); setPhoneOpen(true); }],
["😴", "睡觉", () => goHomeAndSleep()],
] as const).map(([emoji, label, fn]) => (
<button key={label} type="button" aria-label={`底部导航：${label}`} onClick={fn} className="flex flex-1 flex-col items-center gap-0 rounded-full px-1 py-1 text-[15px] leading-none transition hover:bg-[var(--surface2)]">
<span>{emoji}</span>
<span className="mt-0.5 text-[10px] font-black">{label}</span>
</button>
))}
</nav>

{/* toast */}
{toast && <div className="rise fixed bottom-24 left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 rounded-[14px] border-2 border-[var(--border)] bg-[var(--text)] px-4 py-3 text-center text-sm font-bold text-[var(--bg)] shadow-lg">{toast}</div>}

{/* 升职特效 */}
{levelFx && (
<div key={levelFx.nonce} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] grid place-items-center">
<div className="level-fx text-center">
<p className="text-6xl">🎉</p>
<p className="font-display mt-2 text-4xl font-black text-[var(--text)]" style={{ textShadow: "0 2px 0 var(--gold), 0 6px 24px rgba(0,0,0,.25)" }}>升职啦！</p>
<p className="mt-1 text-lg font-black text-[var(--accent)]">「{levelFx.name}」</p>
<p className="mt-1 text-sm font-bold text-[var(--dim)]">街坊弹幕正在为你刷屏…</p>
</div>
</div>
)}

{/* 每日任务弹窗：签到 + 今日任务，每天进游戏 / 睡醒弹一次 */}
{dailyOpen && (() => {
const signed = (s.signDay ?? 0) === s.day;
const base = s.dayBase?.day === s.day ? s.dayBase : { day: s.day, work: s.workCount, meal: s.mealCount, scenic: (s.visitedScenic ?? []).length };
const missions: { id: string; icon: string; name: string; reward: number; done: boolean; hint: string }[] = [
{ id: "work", icon: "💼", name: "上班打卡一次", reward: 20, done: s.workCount > base.work, hint: "去公司点「上班」" },
{ id: "meal", icon: "🍜", name: "好好吃一顿饭", reward: 15, done: s.mealCount > base.meal, hint: "夜市 / 饭店 / 自己做饭都算" },
{ id: "scenic", icon: "📸", name: "风景打卡一处", reward: 25, done: (s.visitedScenic ?? []).length > base.scenic, hint: "去任意景区点「拍照打卡」" },
{ id: "chat", icon: "💬", name: "和一位街坊聊聊", reward: 15, done: (s.greeted ?? []).length > 0, hint: "在手机「街坊社交」里找人聊天" },
];
const apecTask = s.cityKey === "sz" ? apecTaskOfDay(s.day) : null;
const apecDone = apecTask ? (s.apecTasks ?? []).includes(apecTask.id) : false;
return (
<div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/55 p-3 backdrop-blur-[2px] sm:items-center" role="dialog" aria-label="每日任务">
<div className="rise max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] shadow-xl">
<div className="flex items-start justify-between bg-[var(--text)] p-4 text-[var(--bg)]">
<div>
<p className="text-xs font-black opacity-80">📋 每日任务 · 第 {Math.min(s.day, 30)} 天 · {weekday(s.day)}</p>
<p className="font-display mt-0.5 text-2xl font-black">{city.name}的一天，从签到开始</p>
<p className="mt-0.5 text-xs opacity-85">{nowWeatherText} · {phaseApec.label}</p>
</div>
<button type="button" aria-label="关闭每日任务" onClick={() => setDailyOpen(false)} className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-black">✕</button>
</div>
<div className="p-4">
<button type="button" disabled={signed} aria-label={signed ? "今日已签到" : "每日签到领奖励"} onClick={() => { mutate((x) => { x.signDay = s.day; x.money += 30; x.energy += 10; }); floatReward(`+${fmt(30)} 签到`, "gold"); floatReward("能量 +10", "green"); burstDanmaku(["🧧 今天的签到红包到账啦", "陈伯：早啊，又是新的一天", "小美：签到打卡，元气满满 ☀️"]); showToast(`签到成功：+${fmt(30)}，能量 +10。今天的任务在下面，顺手就做了。`); }} className="w-full rounded-[14px] bg-[var(--accent)] py-3.5 text-sm font-black text-white disabled:bg-[var(--surface2)] disabled:text-[var(--dim)]">
{signed ? "✅ 今日已签到（明天再来）" : "🧧 每日签到 · 领 {fmt(30)} + 能量 10"}
</button>
<p className="mt-4 text-xs font-black tracking-wide text-[var(--dim)]">今日任务 · 完成点领取，奖励立刻飘字到账</p>
<div className="mt-2 grid gap-2">
{missions.map((m) => {
const claimed = (s.dayClaim ?? []).includes(`${s.day}:${m.id}`);
return (
<div key={m.id} className="flex items-center gap-2.5 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5">
<span className="text-xl">{m.icon}</span>
<span className="min-w-0 flex-1"><span className="block text-sm font-black">{m.name}</span><span className="block text-[11px] text-[var(--dim)]">{claimed ? "奖励已领" : m.done ? "已完成，去领奖" : m.hint}</span></span>
{claimed ? <span className="chip">✅ 已领</span> : m.done ? (
<button type="button" aria-label={`领取任务奖励：${m.name}`} onClick={() => { mutate((x) => { x.money += m.reward; x.dayClaim = [...(x.dayClaim ?? []), `${s.day}:${m.id}`]; }); floatReward(`+${fmt(m.reward)} 每日任务`, "gold"); pushDanmakuRef.current(`📋 每日任务完成：${m.name} +${fmt(m.reward)}`); }} className="shrink-0 rounded-full bg-[var(--gold)] px-3 py-1.5 text-[11px] font-black text-[#4a3500]">领 {fmt(m.reward)}</button>
) : <span className="chip">+{fmt(m.reward)}</span>}
</div>
);
})}
</div>
{apecTask && (
<div className="mt-3 rounded-[12px] border-2 border-[var(--gold)] bg-[#fdf6da] px-3 py-2.5 text-[#5c4a00]">
<p className="text-sm font-black">🌐 今日 APEC 任务 · {apecTask.dateLabel} {apecTask.event}</p>
<p className="mt-0.5 text-xs leading-relaxed">{apecTask.roleEmoji} 你当{apecTask.role}：{apecTask.title} —— 去{locById(apecTask.venueLocId).name}打卡上岗。{apecDone ? "✅ 今天已完成" : ""}</p>
{!apecDone && <button type="button" aria-label="坐地铁去做今日APEC任务" onClick={() => { setDailyOpen(false); walkTo(apecTask.venueLocId, "metro"); }} className="mt-2 rounded-full bg-[#5c4a00] px-3.5 py-1.5 text-[11px] font-black text-white">🚇 坐地铁去会场</button>}
</div>
)}
<button type="button" onClick={() => setDailyOpen(false)} className="mt-4 w-full rounded-full bg-[var(--text)] py-3 text-sm font-black text-[var(--bg)]">开始今天的生活 →</button>
</div>
</div>
</div>
);
})()}

{/* event modal */}
{activeEvent && (
<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-[2px] p-3 sm:items-center" role="dialog" aria-label={locText(activeEvent.title)}>
<div className="rise w-full max-w-md rounded-[20px] border-2 border-[var(--border)] bg-[var(--surface)] p-5">
<span className="inline-block rounded-full bg-[var(--gold)] px-2.5 py-1 text-xs font-black text-[#3d2f00]">{locText(activeEvent.tag)}</span>
<h3 className="font-display mt-3 text-2xl font-black leading-snug">{locText(activeEvent.title)}</h3>
<p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">{locText(activeEvent.desc)}</p>
{activeEvent.choices.map((c, i) => (
<button key={c.t} type="button" onClick={() => chooseEventChoice(i)} className="act-btn mt-2.5">
<span className="text-sm font-black">{locText(c.t)}</span>
<span className="block text-xs text-[var(--dim)]">{locText(c.s)}</span>
</button>
))}
</div>
</div>
)}

{/* phone modal */}
{phoneOpen && (
<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-[2px] p-3 sm:items-center" role="dialog" aria-label="手机">
<div className="rise max-h-[86vh] w-full max-w-md overflow-y-auto rounded-[24px] border-2 border-[var(--border)] bg-[var(--surface)] p-5">
<div className="flex items-center gap-2">
{phoneApp && <button type="button" aria-label="返回手机桌面" onClick={() => setPhoneApp(null)} className="rounded-full bg-[var(--surface2)] px-3 py-1.5 text-sm font-black">←</button>}
<h3 className="font-display text-xl font-black">{phoneApp ? (phoneApp === "metro" && s.cityKey === "hz" ? "城轨通" : phoneApp === "metro" && s.cityKey === "hk" ? "港铁通" : APPS.find((a) => a.id === phoneApp)?.n ?? "手机") : "📱 我的手机"}</h3>
<button type="button" aria-label="关闭手机" onClick={() => setPhoneOpen(false)} className="ml-auto rounded-full bg-[var(--surface2)] px-3 py-1.5 text-sm font-black">✕</button>
</div>
<div className="mt-4">
{!phoneApp ? (
<div className="grid grid-cols-4 gap-3">
{APPS.map((a) => (
<button key={a.id} type="button" aria-label={`打开${a.id === "metro" && s.cityKey === "hz" ? "城轨通" : a.id === "metro" && s.cityKey === "hk" ? "港铁通" : a.n}`} onClick={() => setPhoneApp(a.id)} className="grid place-items-center gap-1 rounded-[14px] bg-[var(--surface2)] px-1 py-3">
<span className="text-2xl">{a.id === "metro" && s.cityKey === "hz" ? "🚆" : a.e}</span>
<span className="text-[11px] font-bold">{a.id === "metro" && s.cityKey === "hz" ? "城轨通" : a.id === "metro" && s.cityKey === "hk" ? "港铁通" : a.n}</span>
</button>
))}
</div>
) : renderPhoneApp(s, phoneApp)}
</div>
</div>
</div>
)}
</div>
);
}
