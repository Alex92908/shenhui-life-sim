import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { loadMeta, saveMeta, touchStreak, streakReward, bump, rollWeek, checkAchievements, dailyEvent, dateKey, ACHIEVEMENTS, WEEKLY_GOALS, type Meta, type CityEvent } from "./meta";
import { api, type ApiResponse } from "./api";
import { AREA_LABELS } from "./areas";
import { AccountModal, accountToken } from "./Account";
import { StoreModal, LOOK_COLOR, LOOK_TITLE } from "./Store";
const lookOf = (b: object): string | null => (b as { look?: string | null }).look ?? null;
import { TERMS, PRIVACY, LEGAL_VERSION, OPERATOR_MISSING } from "./legal";
import { getLang, setLangStored, installTranslator, LANGS, trText, type Lang } from "./i18n";
import { cloudCode, newCloudCode, setCloudCode, prettyCode, liteDefault, setQuality, readInvite, inviteLink, clearInviteParams, drawShareCard } from "./share";
import {
APPS, CAREERS, COMPANIES, companyAt, companyById, companyGaps, employerHere, type Company, CITIES, FOODS, FURNITURE, IDENTITIES, NPCS, npcsForCity, OFFERS, TEMPLATES,
apecPhase, apecVenueMul, getLocations, isApecWeek, isSaturday, tplQuote, setSeason, isApecSeason,
APEC_TASKS, apecTaskOfDay, APEC_SLOGAN, APEC_CERT_NAME,
weatherOf, weekday, modesForCity, railWord, etaMinutes, modeById, SCENIC_SPOTS, scenicOf, taxiFare, busFare, bikeFare, driveFare, parkingFee,
curSym, fmtMoney, crossFareLabel,
findMetroRoute, findStationRoute, exitLocForStation, resolveLoc, partialFare, nearbyPlaces, nearbyServices, placesForCity, PLACE_KINDS, type MetroLine, planRailTrip, allMetroDestinations, linesForLoc, metroLinesForCity, crowdForRide, motoFare,
RESTAURANTS, DELIVERY_PLATFORMS, SHOP_VENUES, LODGINGS, rentFlatWeekly, OUTFITS, outfitOf, isRainy, HOME_ROOMS,
LOC_EN, LOC_GRADE, CITY_INTRO,
type AppId, type CityKey, type Loc, type TransportModeId, type MetroRoute,
crossRoutes, isCrossOpen, crossHoursStr, crossFareStr, crossName, crossNote, CROSS_ROUTES, type CrossRoute, areaLocId
} from "./data";
import { pickEvent, type GameEvent } from "./events";
import {
generateDailyPosts, authorReply, chatReply, greetLine, hashStr, memOf, relLabel, moodEmoji, moodWord, personaOf, scheduleOf,
type ChatAction, type MemMap, type NpcPost, type PlayerNews,
} from "./npc";
import { MapView } from "./MapView";
import { MetroMapModal } from "./MetroMap";
import { PlacesMapModal } from "./PlacesMap";
import { LifeStage3D, type LifeSet, type LifePose } from "./LifeStage";
import { routineRole, routineSteps, CORE_FOR_FULL_DAY, ROLE_META, isOrderRole, type RoutineDay, type RiderOrder, type RoutineStep, type RoutineRole } from "./routines";
import { GUIDE, SCENE_PHOTOS, guideForLocName, tourForCity, type DayTour, type GuidePlace } from "./experience";
import { creditFor } from "./photo-credits";
import { SEASON_START, actionMinutes, clockStr, timeBlock, nowMin, countdown, cooldownMs, realMinLabel, venueClosed, inWindow, windowStr, RAIL_HOURS, MODE_HOURS, realGameDay, seasonStartFor, seasonLength, seasonMonth } from "./clock";
import { PERKS, MAX_EQUIP, perkById, runPoints } from "./legacy";
import { STORIES, PART, storyOf, storyStatus, type StoryFx, type StoryProg } from "./stories";
import { storyEN } from "./stories-en";
import { MiniGame, type GameSpec, type GameResult } from "./MiniGame";
import { ACTIVITIES as ACTIVITIES_LIST, CAT_LABEL, DATE_QUESTIONS, DROP_SETS, ROMANCE_STAGES, activitiesAt, activityById, dropById, romanceStage, type Activity, type ActCat } from "./activities";
import { resolveActivity, isRushHour } from "./playlogic";
import { track, setAnalyticsPlayer, deviceId } from "./analytics";

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
type InboxGift = ApiResponse<typeof api, "syncPresence">["inbox"][number];

/* ---- 长线玩法 helpers (see meta.ts) ---- */
const stationNamesOf = (ck: CityKey): string[] => [...new Set(metroLinesForCity(ck).flatMap((l) => l.stations.map((x) => x.name)).filter((n) => !n.endsWith("方向")))];
const SZ_STATION_COUNT = stationNamesOf("sz").length;
const isBeachLoc = (l: Loc) => l.emoji === "🏖️" || l.emoji === "🏝️";
/** A company's hiring bar after today's 开放日 and any 内推 you hold. */
const effCompany = (co: Company, ev: CityEvent, referrals: string[] | undefined): Company => {
  let c = co;
  if (ev.openDay === co.id) c = { ...c, needSkill: Math.max(0, c.needSkill - 1), needXp: Math.max(0, c.needXp - 4) };
  if (referrals?.includes(co.id)) c = { ...c, needSkill: Math.max(0, c.needSkill - 2), needXp: Math.max(0, c.needXp - 6) };
  return c;
};
const GIFTS = {
  tea: { emoji: "🧋", name: "奶茶", cost: 18, effect: "心情 +8、能量 +5" },
  breakfast: { emoji: "🥟", name: "早餐", cost: 12, effect: "能量 +15" },
  hongbao: { emoji: "🧧", name: "红包", cost: 88, effect: "¥88" },
  referral: { emoji: "🤝", name: "内推", cost: 0, effect: "你公司的面试门槛降低" },
  invite: { emoji: "🎉", name: "邀请报到", cost: 0, effect: "¥200 邀请奖励" },
} as const;
type GiftKind = keyof typeof GIFTS;
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
/* 大厂跳槽：现在在哪家上班（深圳）、拿到的 offer、面试记录（「天:公司」每家每天一次） */
employer?: string;
offers?: string[];
interviews?: string[];
/* 别的玩家送来的内推（公司 id）：面试门槛降低 */
referrals?: string[];
/* 一天的时间预算：现在几点（分钟），今天歇了几次、上没上班、加没加班 */
minute?: number;
restDay?: number; restN?: number;
workDay?: number; otDay?: number;
/* 街坊连续剧进度 + 本局带上的深漂档案传承 */
story?: Record<string, StoryProg>;
perks?: string[];
/* 独立玩法：驾照（科目 0–3）、租车日 / 自己的车、宿醉、案底、恋爱、组局次数 */
/* 真实时间：冷却到什么时候、在忙什么、本局从哪天开始、今天睡没睡、哪天真正上过线、能量自然恢复的计时 */
busyUntil?: number; busyWhat?: string; startKey?: string; sleptDay?: number; lastActiveDay?: number; regenAt?: number;
license?: number; licDay?: number; carDay?: number; carOwned?: boolean;
hangover?: boolean; record?: number;
romance?: Record<string, number>; cohabit?: boolean;
/* 工作日常：今天做了哪些步骤、迟到 / 绩效扣分、骑手手上的单 */
routine?: RoutineDay;
actCount?: number; partyPlays?: number;
}

interface Profile {
playerId: string;
name: string;
}

export const LS_KEY = "shhr-pc-save-v1";
const CITY_EN: Record<CityKey, string> = { sz: "Shenzhen", hz: "Huizhou", hk: "Hong Kong" };
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
if (gs.apecCount >= 3) badges.push("🌐 峰会服务之星");
if ((gs.apecTasks ?? []).length >= APEC_TASKS.length) badges.push(APEC_CERT_NAME);
else if ((gs.apecCheckins ?? []).length >= 3) badges.push("📍 峰会三会场全打卡");
if (gs.furniture.length >= 3) badges.push("🛋️ 安家小能手");
if (computeComfort(gs) >= 80) badges.push("🏠 舒适小窝");
if ((gs.metroRides ?? 0) >= 5) badges.push(gs.cityKey === "hz" ? "🚆 城轨达人" : gs.cityKey === "hk" ? "🚇 港铁达人" : "🚇 地铁达人");
if ((gs.visitedScenic ?? []).length >= 5) badges.push("📸 风景收藏家");
if ((gs.actCount ?? 0) >= 15) badges.push("🎮 会玩的人");
if ((gs.partyPlays ?? 0) >= 3) badges.push("🤝 组局达人");
if (Object.values(gs.romance ?? {}).some((v) => v >= 55)) badges.push("💕 脱单成功");
if ((gs.license ?? 0) >= 3) badges.push("🪪 有证司机");
if ((gs.record ?? 0) > 0) badges.push("🚓 进过派出所");
return { title, quote, badges};
}


/* ---------- 生活动画: short acted scenes for the moments of a day ----------
   Each scene is a few steps on a warm cinematic stage: the character walks
   in with eased motion, props act (typing, steam, chewing, lifting), and
   captions tell the beat. Triggered by the real actions (finishing a rail
   ride, working, eating, cooking, sleeping…) and by the 今日生活 replay. */
type LifeKind = "routine" | "day" | "alightRail" | "crossing" | "metro" | "code" | "overtime" | "eat" | "cook" | "sleep" | "wash" | "groceries" | "shopping" | "gym" | "stroll" | "gathering" | "cruise" | "wheel" | "aquarium" | "turtle" | "coaster" | "safari" | "hike" | "beach" | "cablecar";
interface LifeStep { bg: string; prop: string; caption: string; sub: string; move?: "walk" | "stay"; fx?: "type" | "steam" | "zzz" | "rain" | "chew" | "lift" | "shine"; dawn?: boolean; }
interface LifeScene { title: string; tone?: "night" | "indoor"; steps: LifeStep[]; }
/* the routine scene is filled in just before it plays (one beat per step) */
let routineStage: { set: LifeSet; pose: LifePose } = { set: "office", pose: "type" };
const LIFE_SCENES: Record<LifeKind, LifeScene> = {
routine: { title: "工作日常", tone: "indoor", steps: [{ bg: "🏢", prop: "⌨️", caption: "", sub: "", move: "stay" }] },
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
cruise: { title: "东江夜游 · 坐游船", tone: "night", steps: [
  { bg: "⛴️ 🏮 🌃", prop: "🎫", caption: "检票上船", sub: "码头的灯串亮了，踩着跳板上船，找个靠栏杆的位置坐下", move: "walk" },
  { bg: "🌊 🏯 ✨", prop: "⛴️", caption: "船开了，两岸灯火慢慢后退", sub: "江风迎面吹来，灯笼在头顶轻轻晃，江面上碎成一片金光", move: "stay", fx: "shine" },
  { bg: "🏯 🌉 📸", prop: "📸", caption: "合江楼就在正前方", sub: "两江交汇处，楼体的灯影倒映在水里——拍一张，今晚值了", move: "stay", fx: "shine" },
] },
wheel: { title: "坐摩天轮", steps: [
  { bg: "🎡 🎫 👥", prop: "🎫", caption: "走进透明轿厢", sub: "舱门合上，轿厢轻轻一晃，开始慢慢往上升", move: "stay" },
  { bg: "🏙️ ⬇️ 🌤️", prop: "🎡", caption: "城市一点点沉下去", sub: "楼顶、马路、海湾都变小了，脚下是整片前海", move: "stay", fx: "shine" },
  { bg: "🌇 🌊 ✨", prop: "📸", caption: "到最高点了", sub: "海风、晚霞、远处的大桥——在最高点拍一张，再慢慢转下来", move: "stay", fx: "shine" },
] },
aquarium: { title: "海洋馆 · 海底隧道", steps: [
  { bg: "🐠 🌊 🐟", prop: "🐟", caption: "走进海底隧道", sub: "四周一下子变成蓝色，鱼群就在头顶和身边游", move: "walk" },
  { bg: "🦈 🐠 💙", prop: "🦈", caption: "一条鲨鱼从头顶滑过", sub: "鳐鱼像风筝一样扇着翅膀，小朋友们趴在玻璃上不肯走", move: "stay", fx: "shine" },
  { bg: "🪼 💡 📸", prop: "🪼", caption: "水母馆里慢慢看", sub: "灯光下的水母一呼一吸地漂着，整个人都安静下来", move: "stay" },
] },
turtle: { title: "海龟湾 · 看海龟", steps: [
  { bg: "🏖️ 🐢 🌊", prop: "🐢", caption: "走到保护区的观景沙滩", sub: "工作人员提醒：别用闪光灯，别伸手摸，远远看就好", move: "walk" },
  { bg: "🐢 🐢 🌊", prop: "🐢", caption: "海龟慢慢爬向大海", sub: "鳍肢一下一下划着沙子，留下一道道爬痕", move: "stay", fx: "shine" },
  { bg: "🐣 🌊 💚", prop: "🌊", caption: "小海龟奔向浪花", sub: "一个浪打上来，小家伙们就不见了——祝你们一路顺风", move: "stay", fx: "shine" },
] },
coaster: { title: "坐过山车", steps: [
  { bg: "🎢 🎫 😬", prop: "🎢", caption: "坐进第一排，压杠落下", sub: "咔哒咔哒——车慢慢爬上最高点，心跳比链条还响", move: "stay" },
  { bg: "🎢 ⬇️ 😱", prop: "😱", caption: "俯冲！", sub: "失重的一秒，尖叫声和风一起灌进耳朵", move: "stay", fx: "shine" },
  { bg: "🎢 🔄 🤣", prop: "🤣", caption: "翻完大回环，腿是软的", sub: "下车时还在笑，嗓子已经喊哑了", move: "stay", fx: "shine" },
] },
safari: { title: "坐观光车逛动物园", steps: [
  { bg: "🚌 🦒 🌳", prop: "🚌", caption: "坐上带铁笼的观光车", sub: "司机提醒：关好车窗，不要投喂，不要伸手", move: "stay" },
  { bg: "🦓 🦒 🌾", prop: "🦒", caption: "长颈鹿和斑马慢悠悠走过", sub: "长颈鹿低头看了你一眼，又继续嚼它的树叶", move: "stay", fx: "shine" },
  { bg: "🦁 😮 📸", prop: "🦁", caption: "狮子就在车窗外", sub: "隔着铁笼都能感到它的气场——全车人屏住呼吸按快门", move: "stay", fx: "shine" },
] },
hike: { title: "爬山登顶", steps: [
  { bg: "⛰️ 🥾 🌳", prop: "🥾", caption: "沿石阶往上爬", sub: "一级一级，汗顺着脖子往下流，树荫里有风", move: "walk" },
  { bg: "🌫️ ⛰️ 💪", prop: "💧", caption: "半山腰歇一口气", sub: "喝口水，回头一看，城市已经在脚下了", move: "stay" },
  { bg: "🏯 🌇 🙌", prop: "🙌", caption: "登顶！", sub: "山顶的风一吹，整座城尽收眼底——值了", move: "stay", fx: "shine" },
] },
beach: { title: "去海边", steps: [
  { bg: "🏖️ 👣 ☀️", prop: "👣", caption: "光脚踩上沙滩", sub: "沙子有点烫，海风是咸的", move: "walk" },
  { bg: "🌊 🏊 😆", prop: "🌊", caption: "下海玩水", sub: "一个浪打过来，从头湿到脚，笑得停不下来", move: "stay", fx: "shine" },
  { bg: "🌅 🪑 🍹", prop: "🌅", caption: "坐在伞下看日落", sub: "海面一点点变成金色，今天的烦恼都留在了沙滩上", move: "stay", fx: "shine" },
] },
cablecar: { title: "坐缆车上山", steps: [
  { bg: "🚡 🎫 ⛰️", prop: "🚡", caption: "坐进缆车", sub: "门一关，车厢轻轻一晃，离开站台往山上滑", move: "stay" },
  { bg: "⛰️ 🌊 ✨", prop: "🌊", caption: "海湾在脚下展开", sub: "越升越高，山、海和城市的边界一下子都看清了", move: "stay", fx: "shine" },
  { bg: "🏔️ 🙌 📸", prop: "📸", caption: "到山顶站了", sub: "下缆车前回头拍一张，这一段风景值回票价", move: "walk" },
] },
gathering: { title: "朋友聚餐", tone: "indoor", steps: [
  { bg: "🍻 👥 🎤", prop: "🍻", caption: "朋友们到齐了", sub: "拼桌坐下，先碰一杯，聊聊最近怎么样", move: "stay", fx: "shine" },
  { bg: "🍲 🥢 😂", prop: "🍲", caption: "边吃边聊", sub: "菜一盘盘上，笑声一阵阵——人脉就是这样攒下的", move: "stay", fx: "chew" },
] },
};

function lifeStageFor(kind: LifeKind, idx: number): { set: LifeSet; pose: LifePose } {
switch (kind) {
case "routine": return routineStage;
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
case "cruise": return { set: "cruise", pose: idx === 0 ? "walk" : "sit" };
case "wheel": return { set: "wheel", pose: idx === 0 ? "idle" : "sit" };
case "aquarium": return { set: "aquarium", pose: idx === 0 ? "walk" : "idle" };
case "turtle": return { set: "turtle", pose: idx === 0 ? "walk" : "idle" };
case "coaster": return { set: "coaster", pose: "sit" };
case "safari": return { set: "safari", pose: "sit" };
case "hike": return { set: "hike", pose: idx === 2 ? "stretch" : idx === 1 ? "idle" : "walk" };
case "beach": return { set: "beach", pose: idx === 0 ? "walk" : idx === 1 ? "stretch" : "idle" };
case "cablecar": return { set: "cablecar", pose: idx === 2 ? "walk" : "sit" };
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
<PhotoCreditLine url={photo} note={g.photoNote} />
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

/** Attribution under a real photo (CC BY / BY-SA need it): author · licence · file page. */
function PhotoCreditLine({ url, note }: { url: string | undefined; note?: string }) {
const c = creditFor(url);
if (!c && !note) return null;
return (
<p className="px-3 pt-1.5 text-[10px] leading-snug text-[var(--dim)]">
{note && <span className="mr-1">ℹ️ {note}。</span>}
{c && <>📷 <a href={c.page} target="_blank" rel="noreferrer" className="underline">{c.artist || c.title}</a> · {c.license} · {c.source ?? "Wikimedia Commons"}</>}
</p>
);
}

/** Check-in targets in a city: the curated scenic spots plus every real
    park / beach / peak / landmark from the OSM place list. */
function scenicTotal(ck: CityKey): number {
  return SCENIC_SPOTS.filter((x) => x.cityKey === ck).length
    + placesForCity(ck).filter((p) => PLACE_KINDS[p.kind].type === "scenic" || PLACE_KINDS[p.kind].type === "mountain").length;
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
/* rides play ON the map (the train runs the line, the car drives the city);
   the full carriage / cab scene is one tap away */
const [rideBig, setRideBig] = useState(false);
/* the mode this trip really uses (driving without a car falls back to a taxi…) */
const [tripMode, setTripMode] = useState<TransportModeId | null>(null);
/* when the current trip arrives (epoch ms): the figure on the map paces itself to it */
const [tripEta, setTripEta] = useState<number | null>(null);
/* after changing city: which way you travelled, so the map shows you arriving from the right side */
const [arrival, setArrival] = useState<{ dx: number; dz: number; nonce: number } | undefined>(undefined);
const [carriageLog, setCarriageLog] = useState<string>("");
/* 车厢顶部的站点条：列车每到一站就把当前站滚到中间 */
const routeStripRef = useRef<HTMLDivElement | null>(null);
useEffect(() => {
const el = routeStripRef.current;
if (!el || !carriage) return;
const cur = el.querySelector<HTMLElement>(`[data-stop="${carriage.stopIdx}"]`);
if (!cur) return;
el.scrollTo({ left: Math.max(0, cur.offsetLeft - el.clientWidth / 2 + cur.offsetWidth / 2), behavior: "smooth" });
}, [carriage?.stopIdx, carriage?.route, carriage]);
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
const [mapFocus, setMapFocus] = useState<{ locId?: string; x?: number; z?: number; nonce: number } | null>(null);
const [metroMapOpen, setMetroMapOpen] = useState(false);
const [navOpen, setNavOpen] = useState(false);
const [metroMapDest, setMetroMapDest] = useState<string | null>(null);
type VenueScene = { kind: "dine" | "shop" | "stay"; id: string };
const [venueScene, setVenueScene] = useState<VenueScene | null>(null);
const [sceneFlags, setSceneFlags] = useState<Record<string, boolean>>({});
const walkTimer = useRef<number | null>(null);
const pendingSleep = useRef(false);
const pendingRide = useRef<string | null>(null);
/* A station-to-station ride picked on the line map: walk to the boarding
   station's exit location first, then board this exact route. */
const pendingStationRide = useRef<{ route: MetroRoute; board: string; alight: string } | null>(null);
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
const [asideTab, setAsideTab] = useState<"place" | "feed" | "wall" | "chat" | "board" | "guide" | "collect">("place");
/* 长线进度：跨局保留（集章 / 图鉴 / 连续登录 / 本周目标 / 成就称号） */
const [meta, setMetaState] = useState<Meta>(() => loadMeta());
const metaRef = useRef(meta);
metaRef.current = meta;
const flashGiven = useRef("");
const claimingGifts = useRef(new Set<number>());
/* 公开编号：playerId 是只有本机知道的私钥；别人看到、邀请链接里用的都是
   它的 sha256 前 16 位（和服务器 pubOf 一致）。 */
const [myPub, setMyPub] = useState("");
const myPubRef = useRef("");
myPubRef.current = myPub;
useEffect(() => {
const id = profile?.playerId;
if (!id || !crypto?.subtle) return;
void crypto.subtle.digest("SHA-256", new TextEncoder().encode(id)).then((buf) => {
setMyPub(Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16));
}).catch(() => { /* the server's heartbeat reply fills it in */ });
}, [profile?.playerId]);
/* 分享 / 邀请 / 云存档 / 画质 */
const [lite] = useState(() => liteDefault());
const [invite] = useState(() => readInvite());
const [shareOpen, setShareOpen] = useState(false);
const [shareImg, setShareImg] = useState<{ url: string; blob: Blob } | null>(null);
const [cloudAt, setCloudAt] = useState("");
const [restoreCode, setRestoreCode] = useState("");
const [placesMapOpen, setPlacesMapOpen] = useState(false);
/* 语言 + 用户协议 / 隐私政策 */
const [lang, setLangState] = useState<Lang>(() => getLang());
/* 剧情 / 传承的文案：英文界面直接取英文稿（整段长句交给 DOM 翻译器容易漏） */
const L = (zh: string) => (lang === "en" ? storyEN(zh) : zh.split(PART).join(""));
const en = lang === "en";
const switchLang = (l: Lang) => {
setLangStored(l);
// back to Chinese: reload so every translated text node returns to its source
if (l === "zh" && lang !== "zh") { window.location.reload(); return; }
setLangState(l);
};
useEffect(() => { installTranslator(lang); }, [lang]);
const langToggle = (cls = "") => (
<span className={`inline-flex shrink-0 overflow-hidden rounded-full border border-[var(--line)] ${cls}`}>{LANGS.map((l) => <button key={l.id} type="button" aria-label={l.id === "zh" ? "切换到中文" : "Switch to English"} onClick={() => switchLang(l.id)} className={`px-2.5 py-1.5 text-[11px] font-black ${lang === l.id ? "bg-[var(--text)] text-[var(--bg)]" : "bg-[var(--surface)]"}`}>{l.label}</button>)}</span>
);
const [legalDoc, setLegalDoc] = useState<null | "terms" | "privacy">(null);
const [agreed, setAgreed] = useState(() => { try { return localStorage.getItem("shhr-legal") === LEGAL_VERSION; } catch { return false; } });
const setAgreedStored = (v: boolean) => { setAgreed(v); try { if (v) localStorage.setItem("shhr-legal", LEGAL_VERSION); else localStorage.removeItem("shhr-legal"); } catch { /* storage unavailable */ } };
const [quiz, setQuiz] = useState<{ key: string; opts: string[]; picked: string | null } | null>(null);
/* 📌 固定收起：钉住后地区面板不再自动弹出，只有点右侧竖条才展开 */
const [asideOpen, setAsideOpen] = useState(() => { try { return localStorage.getItem("shhr-pin-aside") !== "1"; } catch { return true; } });
/* Top-area compaction: status detail / Summit activity / city intro all
   start folded away behind one-line bars so the map stays the hero. */
const [fold, setFold] = useState<"hud" | "apec" | "intro" | null>(null);
/* Whole-bar collapse: each of the three floating bars folds away
   VERTICALLY into the rail of small buttons down the screen's left edge
   （状态 / Summit / 深圳/惠州）, freeing more of the map; tapping a rail
   button brings its bar back. All shown by default. */
const [barsHidden, setBarsHidden] = useState(false);
/* Map fullscreen: the map shell becomes a fixed full-viewport stage
   (plus the native Fullscreen API when the browser allows it). */
const [mapFullscreen, setMapFullscreen] = useState(false);
const mapShellRef = useRef<HTMLDivElement | null>(null);
/* 全屏看地图时地区面板默认收起：选地点、搜索、换城市都不再自动弹出，
   只有点右侧竖条才展开。 */
const mapFullscreenRef = useRef(false);
/* 📌 固定：面板钉住后不被点空白收起、不挡地图操作，全屏也保持打开 */
const [asidePinned, setAsidePinned] = useState(() => { try { return localStorage.getItem("shhr-pin-aside") === "1"; } catch { return false; } });
const [navPinned, setNavPinned] = useState(() => { try { return localStorage.getItem("shhr-pin-nav") === "1"; } catch { return false; } });
const asidePinnedRef = useRef(asidePinned); asidePinnedRef.current = asidePinned;
const navPinnedRef = useRef(navPinned); navPinnedRef.current = navPinned;
const togglePin = (which: "aside" | "nav") => {
const set = which === "aside" ? setAsidePinned : setNavPinned;
set((v) => { const nv = !v; try { localStorage.setItem(`shhr-pin-${which}`, nv ? "1" : "0"); } catch { /* storage unavailable */ } return nv; });
};
mapFullscreenRef.current = mapFullscreen;
const autoOpenAside = () => { if (!mapFullscreenRef.current && !asidePinnedRef.current) setAsideOpen(true); };
const wasFullscreen = useRef(false);
useEffect(() => {
if (mapFullscreen) setAsideOpen(false);
else if (wasFullscreen.current && !asidePinnedRef.current) setAsideOpen(true);
wasFullscreen.current = mapFullscreen;
}, [mapFullscreen]);
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
    setAsideOpen(true);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  } else {
    setMapFullscreen(true);
    setAsideOpen(false);
    // Fullscreen the whole page, not the map shell: in native fullscreen
    // only the fullscreen element's subtree is painted, so popups living
    // outside the shell (metro carriage, bus/taxi ride, life scenes, toasts,
    // daily tasks, share…) would never show up.
    const el = document.documentElement;
    if (el.requestFullscreen) void el.requestFullscreen().catch(() => {});
  }
};
/* ---- 手游件：弹幕 / 奖励飘字 / 每日任务弹窗 / 升职特效 ----
   弹幕借鉴直播间：联机动态、城市聊天、街坊发言飘过地图；峰会上岗、
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
const [legacyGain, setLegacyGain] = useState<{ pts: number; parts: string[] } | null>(null);
/* 独立玩法：正在玩的小游戏、约会对象选择、组局广场、组局结果 */
const [play, setPlay] = useState<{ act: Activity; spec: GameSpec; partyId?: number; mate?: string } | null>(null);
const [datePick, setDatePick] = useState<Activity | null>(null);
const [partyOpen, setPartyOpen] = useState(false);
/** 跨城路线选择：去哪座城（null = 关着） */
const [crossTo, setCrossTo] = useState<CityKey | null>(null);
const [partyResult, setPartyResult] = useState<number | null>(null);
/* 点人：玩家名片、私信窗口（peer = 对方公开 id） */
const [cardOf, setCardOf] = useState<string | null>(null);
const [dmOpen, setDmOpen] = useState(false);
const [accountOpen, setAccountOpen] = useState(false);
const [storeOpen, setStoreOpen] = useState(false);
/* back from the Stripe payment page: ?paid=<order> (or cancel) */
useEffect(() => {
  const q = new URLSearchParams(window.location.search).get("paid");
  if (!q) return;
  window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  if (q !== "cancel") window.setTimeout(() => setStoreOpen(true), 2500); // the webhook usually lands within a second or two
}, []);
const [loggedIn, setLoggedIn] = useState(() => !!accountToken());
const [dmPeer, setDmPeer] = useState<string | null>(null);
const [dmInput, setDmInput] = useState("");
/* 「现在能干嘛」总览 */
const [hubOpen, setHubOpen] = useState(false);
const [hubCat, setHubCat] = useState<ActCat | "all">("all");
const [hubOpenOnly, setHubOpenOnly] = useState(true);
const [lifeAnim, setLifeAnim] = useState<{ kind: LifeKind; idx: number } | null>(null);
const lifeAfterRef = useRef<(() => void) | null>(null);
/* NPC simulation: who you're chatting with + the running conversation */
const [npcChat, setNpcChat] = useState<string | null>(null);
const [npcLog, setNpcLog] = useState<{ from: "me" | "npc"; text: string }[]>([]);
/* 街坊连续剧：聊天窗里当前摊开的这一章（等你做选择） */
const [storyOpen, setStoryOpen] = useState<string | null>(null);
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
/* 赛季 = 北京时间的一个自然月；星期、峰会都按本局所在的月份算 */
setSeason(gs?.startKey ?? seasonStartFor());
const seasonLen = seasonLength(gs?.startKey ?? seasonStartFor());
const seasonMo = seasonMonth(gs?.startKey ?? seasonStartFor());
/* 今日城市事件：同一天、同城、同游戏日的玩家看到的一样 */
const todayEvent: CityEvent = useMemo(() => dailyEvent(gs?.cityKey ?? "sz", gs?.day ?? 1, COMPANIES, stationNamesOf(gs?.cityKey ?? "sz")), [gs?.cityKey, gs?.day]);
const evRef = useRef(todayEvent);
evRef.current = todayEvent;
const worldQuery = useQuery({
queryKey: ["world", cityKey],
queryFn: () => api.getWorld({ cityKey}),
// during play the 6 s heartbeat already returns the world snapshot; this
// poll is only a fallback
refetchInterval: phase === "game"? 20000: 15000,
});
const world: World | undefined = worldQuery.data?.world;
/* 组局广场：同城的局，4 秒刷新一次（世界快照有缓存，组局要更及时） */
const partiesQuery = useQuery({
queryKey: ["parties", cityKey, profile?.playerId ?? ""],
queryFn: () => api.getParties({ cityKey, playerId: profile!.playerId }),
enabled: !!profile && phase === "game",
refetchInterval: 4000,
});
const parties = partiesQuery.data?.parties ?? [];
/* 统计：进入游戏算一次会话 */
useEffect(() => {
if (phase !== "game" || !profile) return;
setAnalyticsPlayer(profile.playerId);
track("session_start", { city: gs?.cityKey ?? "sz", day: gs?.day ?? 0, lang });
}, [phase, profile?.playerId]);
/* 私信：5 秒刷新一次收件箱 */
const inboxQuery = useQuery({
queryKey: ["inbox", profile?.playerId ?? ""],
queryFn: () => api.getInbox({ playerId: profile!.playerId }),
enabled: !!profile && phase === "game",
refetchInterval: 5000,
});
const threads = inboxQuery.data?.threads ?? [];
const unreadDm = threads.reduce((n, t) => n + t.unread, 0);
const cardQuery = useQuery({
queryKey: ["card", cardOf ?? "", profile?.playerId ?? ""],
queryFn: () => api.getPlayerCard({ playerId: profile!.playerId, targetId: cardOf! }),
enabled: !!profile && !!cardOf,
});

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
device: deviceId() || undefined,
playerId: prof.playerId,
cityKey: s.cityKey,
locId: currentLocRef.current,
gameDay: Math.min(31, s.day),
season: (s.startKey ?? SEASON_START).slice(0, 7),
money: Math.round(s.money),
careerIdx: s.careerIdx,
apecCount: s.apecCount,
employer: s.employer ?? "startup",
stamps: Math.min(999, metaRef.current.stamps.length),
title: metaRef.current.title,
});
},
onSuccess: (data) => {
if (data.me && data.me !== myPubRef.current) setMyPub(data.me);
for (const g of data.inbox ?? []) receiveGift(g);
/* the server keeps the real balance: earnings it could not account for are
   taken back, and the game falls back to its figure */
if (data.bank?.corrected) {
  const fix = data.bank.money;
  mutate((x) => { x.money = fix; });
  showToast(en ? "💳 Balance corrected to the server's books (earnings faster than the game allows were not counted)." : "💳 余额已按服务器账本校正：超出游戏节奏的进账没有入账。");
}
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
}, 900);
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
/* each hop lasts as long as the real distance to the next station needs */
}, hopMs(carriage.route, carriage.stopIdx));
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
employer: typeof g.employer === "string" && COMPANIES.some((c) => c.id === g.employer) ? g.employer : "startup",
offers: strArr(g.offers).filter((id) => COMPANIES.some((c) => c.id === id)),
interviews: strArr(g.interviews),
referrals: strArr(g.referrals),
busyUntil: num(g.busyUntil, 0), busyWhat: typeof g.busyWhat === "string" ? g.busyWhat : "", startKey: typeof g.startKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(g.startKey) ? g.startKey : SEASON_START,
sleptDay: num(g.sleptDay, 0), lastActiveDay: num(g.lastActiveDay, 0), regenAt: num(g.regenAt, Date.now()),
restDay: num(g.restDay, 0), restN: num(g.restN, 0),
workDay: num(g.workDay, 0), otDay: num(g.otDay, 0),
story: g.story && typeof g.story === "object" && !Array.isArray(g.story) ? Object.fromEntries(Object.entries(g.story as Record<string, unknown>).filter(([k, v]) => storyOf(k) && v && typeof v === "object").map(([k, v]) => { const o = v as Record<string, unknown>; return [k, { ch: num(o.ch, 0), day: num(o.day, 0), flags: strArr(o.flags), ...(typeof o.done === "string" ? { done: o.done } : {}) }]; })) : {},
perks: strArr(g.perks).filter((id) => perkById(id)),
license: num(g.license, 0), licDay: num(g.licDay, 0), carDay: num(g.carDay, 0), carOwned: g.carOwned === true,
hangover: g.hangover === true, record: num(g.record, 0),
romance: g.romance && typeof g.romance === "object" && !Array.isArray(g.romance) ? Object.fromEntries(Object.entries(g.romance as Record<string, unknown>).filter(([k, v]) => NPCS.some((n) => n.name === k) && typeof v === "number")) as Record<string, number> : {},
cohabit: g.cohabit === true, routine: g.routine && typeof g.routine === "object" && !Array.isArray(g.routine) ? (g.routine as RoutineDay) : undefined, actCount: num(g.actCount, 0), partyPlays: num(g.partyPlays, 0),
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
device: deviceId() || undefined,
playerId: prof.playerId,
name: prof.name,
emoji: iden.emoji,
color: iden.color,
cityKey: restored.cityKey,
});
} catch { /* a corrupt save must never block the setup screen */ }
}, []);

const locById = (id: string): Loc => {
const ck = gsRef.current?.cityKey ?? "sz";
return resolveLoc(ck, id) ?? getLocations(ck)[0]!;
};

/* ---------- movement ---------- */
/* one hop of a metro / rail ride takes as long as its real spacing needs at the line's speed
   (metro 7 map units/s, high-speed and intercity 12) — faster than any road vehicle */
const RAIL_LINE_IDS = ["szhz-rail", "guangshen", "hz-intercity", "ganshen-rail", "guangshan-rail", "hsr-hk"];
const hopMs = (route: MetroRoute, idx: number): number => {
  const a = route.stations[idx], b = route.stations[idx + 1];
  if (!a || !b) return 900;
  const rail = route.legs.some((l) => RAIL_LINE_IDS.includes(l.line.id));
  return clamp((Math.hypot(b.x - a.x, b.z - a.z) / (rail ? 12 : 7)) * 1000, 450, 3000);
};
const startMetroRide = (fromLocId: string, toLocId: string, routeOverride?: MetroRoute) => {
const s0 = gsRef.current; if (!s0) return;
if (!inWindow(nowMin(), RAIL_HOURS[s0.cityKey])) { showToast(`🚇 ${railWord(s0.cityKey)}已经停运了（运营 ${windowStr(RAIL_HOURS[s0.cityKey])}，北京时间）。打车或者明早再坐。`); return; }
const route = routeOverride ?? findMetroRoute(s0.cityKey, fromLocId, toLocId);
if (!route) { showToast("这趟车暂时没规划出来，换个目的地试试。"); return; }
if (s0.money < route.fare) { showToast(`车票 ${Y}${route.fare}，钱包不够，先打工攒点钱。`); return; }
const crowd = crowdForRide(route.line.id, s0.day, s0.metroRides ?? 0);
setRideBig(true);
setCarriage({ route, fromLoc: fromLocId, toLoc: toLocId, stopIdx: 0, legIdx: 0, awaitingTransfer: false, crowdLabel: crowd.label, crowdDesc: crowd.desc, crowdLevel: crowd.level, seated: crowd.level === 0, gaveSeat: false, phoneUsed: false, heldRail: false });
setRideEntry(0);
setCarriageLog(`🚪 在${route.stations[0]?.name ?? ""}站刷卡进闸，上了 ${route.line.name}。${route.isTransfer ? `这趟要换乘：${route.summary}，在 ${route.transferStations.join("、")} 站下车换乘，跟着车厢走就行，一次坐到底。` : ""}${route.shuttleFrom.length > 0 ? `其中 ${route.shuttleFrom.join("、")} 是站外接驳：两个站不在一处，下车后坐接驳巴士到另一个站再上车。` : ""}${crowd.desc}`);
setSelectedLoc(toLocId);
setAsideTab("place");
};
const finishMetroRide = (earlyIdx?: number) => {
const c0 = carriage; const s0 = gsRef.current; if (!c0 || !s0) return;
/* Getting off before the destination: the trip ends at that station, the
   fare covers only the distance ridden, and any planned onward walk is
   dropped — the player chose to stop here. */
const early = earlyIdx !== undefined && earlyIdx > 0 && earlyIdx < c0.route.stations.length - 1;
let c = c0;
if (early) {
const st = c0.route.stations[earlyIdx]!;
const exitId = exitLocForStation(s0.cityKey, st.name) ?? c0.toLoc;
const stations = c0.route.stations.slice(0, earlyIdx + 1);
c = { ...c0, toLoc: exitId, route: { ...c0.route, stations, stops: earlyIdx, fare: partialFare(c0.route, earlyIdx), transferStations: c0.route.transferStations.filter((n) => stations.slice(1, -1).some((x) => x.name === n)) } };
pendingAfterRide.current = null;
pendingSleep.current = false;
}
const isRail = c.route.legs.some((l) => ["szhz-rail", "guangshen", "hz-intercity", "ganshen-rail", "guangshan-rail"].includes(l.line.id));
const fareNow = evRef.current.metroFree ? 0 : c.route.fare;
mutate((s) => { s.money -= fareNow; s.energy -= Math.max(3, Math.round(c.route.stops * 1.2)) + (c.gaveSeat ? 2 : 0); s.metroRides = (s.metroRides ?? 0) + 1; if (c.gaveSeat) { s.network += 1; s.mood += 4; } if (c.phoneUsed) s.mood += 2; });
setCurrentLoc(c.toLoc); currentLocRef.current = c.toLoc; setSelectedLoc(c.toLoc);
const lastSt = c.route.stations[c.route.stations.length - 1]?.name ?? "";
showToast(`${isRail ? "🚄" : "🚇"} 到达${lastSt && !locById(c.toLoc).name.includes(lastSt) ? `${lastSt}站，出站就是${locById(c.toLoc).short}` : locById(c.toLoc).name}，车票 ${fareNow ? `-${Y}${fareNow}` : "免费（绿色出行日）"}，共 ${c.route.stops} 站${c.route.isTransfer ? `（换乘 ${c.route.transferStations.length} 次：${c.route.summary}）` : ""}${pendingAfterRide.current && pendingAfterRide.current !== c.toLoc ? `，出站再步行到${locById(pendingAfterRide.current).short}` : ""}。`);
addLog(`坐 ${c.route.summary} 从${locById(c.fromLoc).short}到${locById(c.toLoc).short}，${c.route.stops}站${c.route.isTransfer ? `，在${c.route.transferStations.join("、")}换乘` : ""}${c.route.shuttleFrom.length > 0 ? `（${c.route.shuttleFrom.join("、")}坐接驳巴士）` : ""} -¥${fareNow}${c.gaveSeat ? "，车厢里让了个座，人脉+1" : ""}${pendingAfterRide.current && pendingAfterRide.current !== c.toLoc ? `，再步行到${locById(pendingAfterRide.current).short}` : ""}。`);
setRideEntry(null);
setCarriage(null);
stampStations([c.route.stations[0]?.name, c.route.stations[c.route.stations.length - 1]?.name, ...c.route.transferStations]);
updMeta((m) => bump(m, "rides"));
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
autoOpenAside();
if (locId === currentLocRef.current) return;
let mode = modeOverride ?? travelMode;
{
const tn = nowMin();
if ((mode === "metro" || mode === "rail") && !inWindow(tn, RAIL_HOURS[s0.cityKey])) { showToast(`🚇 ${railWord(s0.cityKey)}已经停运（运营 ${windowStr(RAIL_HOURS[s0.cityKey])}，北京时间），这次改打车。`); mode = "taxi"; }
else if (MODE_HOURS[mode] && !inWindow(tn, MODE_HOURS[mode]!)) { showToast(`这个点${mode === "bus" ? "公交" : mode === "ferry" ? "轮渡" : "航班"}已经没有了（${windowStr(MODE_HOURS[mode]!)}），这次改打车。`); mode = "taxi"; }
}
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
else if (mode === "taxi") { cost = s0.idenId === "driver" ? 0 : Math.round(taxiFare(dist) * (evRef.current.taxiMul ?? 1)); /* a cabbie drives their own taxi */ energyCost = 1; effMode = "taxi"; modeLabel = "打车"; if (s0.money < cost) { showToast(`打车要 ${Y}${cost}，钱不够，改步行了。`); cost = 0; energyCost = Math.round(dist * 0.5); effMode = "walk"; modeLabel = "步行"; } }
else if (mode === "moto") { cost = s0.idenId === "rider" ? 0 : motoFare(dist); /* riders ride their own e-bike: battery swaps are the cost */ energyCost = Math.max(1, Math.round(dist * 0.18)); effMode = "moto"; modeLabel = "电动车"; if (s0.money < cost) { showToast(`电动车要 ${Y}${cost}，钱不够，改步行了。`); cost = 0; energyCost = Math.round(dist * 0.5); effMode = "walk"; modeLabel = "步行"; } else if (dist > 22) { showToast(`路太远，电动车电量告急，骑到一半推了一段——远途还是坐${railWord(s0.cityKey)}/打车吧。`); energyCost += 4; } }
else if (mode === "bike") { cost = bikeFare(dist); energyCost = Math.round(dist * 0.3); effMode = "bike"; modeLabel = "骑行"; if (s0.money < cost) { cost = 0; showToast(`骑行去${to.short}要 ${Y}${bikeFare(dist)}，钱包不够——共享单车免押金，这趟先免费骑。任何地点都能骑到，别让钱拦路。`); } }
else if (mode === "bus") { cost = busFare(dist); energyCost = Math.max(1, Math.round(dist * 0.12)); effMode = "bus"; modeLabel = "公交"; if (s0.money < cost) cost = 0; }
else if (mode === "ferry") { cost = 60; energyCost = 4; effMode = "ferry"; modeLabel = "轮渡"; if (s0.money < cost) { showToast(`轮渡船票要 ${Y}${cost}，钱不够，改步行了。`); cost = 0; energyCost = Math.round(dist * 0.5); effMode = "walk"; modeLabel = "步行"; } }
else if (mode === "flight") { cost = 420; energyCost = 6; effMode = "flight"; modeLabel = "飞机"; if (s0.money < cost) { showToast(`机票要 ${Y}${cost}，钱不够，改步行了。`); cost = 0; energyCost = Math.round(dist * 0.5); effMode = "walk"; modeLabel = "步行"; } }
else if (mode === "drive") {
  const hasCar = (s0.license ?? 0) >= 3 && (s0.carOwned || s0.carDay === s0.day);
  if (!hasCar) { showToast((s0.license ?? 0) < 3 ? "还没有驾照：去图书馆/车站的「驾校练车」考三科。这次改打车。" : "今天没有车：去车站「租一天车」。这次改打车。"); cost = Math.round(taxiFare(dist) * (evRef.current.taxiMul ?? 1)); energyCost = 1; effMode = "taxi"; modeLabel = "打车"; if (s0.money < cost) { cost = 0; energyCost = Math.round(dist * 0.5); effMode = "walk"; modeLabel = "步行"; } }
  else { const park = parkingFee(to); cost = driveFare(dist) + park; energyCost = 1; effMode = "drive"; modeLabel = "自驾"; if (s0.money < cost) { showToast(`自驾去${to.short}要油费/电费 ${Y}${driveFare(dist)}${park > 0 ? ` + 停车费 ${Y}${park}` : ""}，钱不够，改步行了。`); cost = 0; energyCost = Math.round(dist * 0.5); effMode = "walk"; modeLabel = "步行"; } else if (park > 0) { showToast(`自驾去${to.short}：油费/电费 ${Y}${driveFare(dist)} + 那边停车 ${Y}${park}。开自己的车就是这点好——比打车便宜，停车得自己找车位。`); } }
}
else { energyCost = Math.round(dist * 0.5); }
const jam = ["drive", "taxi", "bus"].includes(effMode) && isRushHour(nowMin(s0));
if (jam) showToast(`🚦 高峰期，路上堵车，${modeLabel}要多花一半时间。`);
mutate((s) => { s.money -= cost; s.energy -= energyCost; });
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
/* vehicles take long enough to watch on the map (the car / bike / bus
   really drives there, camera following); walks keep their pace */
/* each mode keeps its own pace (bike < e-bike/bus < taxi < own car) — a loose limit only, so speeds stay visibly different */
/* on-screen pace per mode (map units / s): slow enough to watch, always walk < run < bike < e-bike < bus < taxi < car */
const WATCH: Partial<Record<TransportModeId, number>> = { walk: 1.6, run: 2.4, bike: 3, moto: 3.8, bus: 4.2, taxi: 5, drive: 5.5 };
const ms = clamp((dist / (WATCH[effMode] ?? modeById(effMode).mapSpeed)) * 1000 * (jam ? 1.5 : 1), 1500, 45000);
setTripEta(Date.now() + ms);
/* 公交/打车不是地图上挪个小人就算搭乘：和地铁一样弹出车厢电影动画
   （站台等车→上车→坐进车厢看窗外→到站下车）。所有行程都触发，
   不分远近；四步动画按这趟的实际时长 ms 等分缩放，行程到点时
   最后一步没演完就等它演完再收（见 roadRideArrived 的处理）。 */
setTripMode(effMode);
if (effMode === "bus" || effMode === "taxi" || effMode === "drive") {
setRideBig(true);
setRoadRide({ mode: effMode, fromName: from.name, toName: to.name, fare: cost, durMs: ms, startedAt: Date.now() });
setRoadRideStep(0);
setRoadRideArrived(false);
}
if (walkTimer.current) window.clearTimeout(walkTimer.current);
walkTimer.current = window.setTimeout(() => {
setCurrentLoc(locId);
currentLocRef.current = locId;
setWalking(false);
setTripMode(null);
setTripEta(null);
/* 到站不直接掐断搭乘动画：只标记已到达，弹窗等四步演完再收起。 */
setRoadRideArrived(true);
if (pendingStationRide.current) {
const pr = pendingStationRide.current;
pendingStationRide.current = null;
if (pr.board === locId) {
showToast(`到「${pr.route.stations[0]?.name ?? ""}」站了，进站上车：${pr.route.summary}。`);
startMetroRide(pr.board, pr.alight, pr.route);
}
} else if (pendingRide.current) {
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

/* 到了一个地方：车站盖章、真实地点进图鉴（跨局保留） */
useEffect(() => {
if (phase !== "game") return;
const s0 = gsRef.current;
if (!s0 || currentLoc === "home") return;
const names: string[] = [];
if (currentLoc.startsWith("st:")) names.push(currentLoc.slice(3));
else for (const l of metroLinesForCity(s0.cityKey)) for (const st of l.stations) if (st.locId === currentLoc) names.push(st.name);
if (names.length) stampStations(names);
const atlasId = `${s0.cityKey}:${currentLoc}`;
if (!currentLoc.startsWith("st:") && !metaRef.current.atlas.includes(atlasId)) {
updMeta((m) => { m.atlas = [...m.atlas, atlasId]; bump(m, "places"); });
floatReward(`📖 图鉴 +1`, "green");
}
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentLoc, phase]);
/* 云存档：存档或进度变了、安静 12 秒后上传；切到后台时立刻上传 */
const pushCloud = () => {
const prof = profileRef.current; const st = gsRef.current;
if (!prof || !st) return;
void api.cloudSave({ playerId: prof.playerId, secret: cloudCode(), save: JSON.stringify({ profile: prof, gs: st }), meta: JSON.stringify(metaRef.current) })
.then((r) => {
if (r.ok) setCloudAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
else if (r.error === "存档码已被占用") setCloudCode(newCloudCode());
}).catch(() => { /* offline: the next change retries */ });
};
useEffect(() => {
if (phase !== "game") return;
const t = window.setTimeout(pushCloud, 12000);
return () => window.clearTimeout(t);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [gs, meta, phase]);
useEffect(() => {
const onHide = () => { if (document.visibilityState === "hidden" && phase === "game") pushCloud(); };
document.addEventListener("visibilitychange", onHide);
return () => document.removeEventListener("visibilitychange", onHide);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [phase]);
const restoreFromCloud = async () => {
const code = restoreCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
if (code.length !== 10) { showToast("存档码是 10 位字母数字，比如 ABCDE-FGH23。"); return; }
try {
const r = await api.cloudLoad({ secret: code });
if (!r.ok || !r.save) { showToast("没找到这个存档码，检查一下有没有输错。"); return; }
localStorage.setItem(LS_KEY, r.save);
if (r.meta) localStorage.setItem("shhr-meta-v1", r.meta);
setCloudCode(code);
showToast("找到云存档了，正在载入…");
window.setTimeout(() => window.location.reload(), 600);
} catch { showToast("网络不太好，稍后再试。"); }
};
const openShare = async () => {
const st = gsRef.current; const prof = profileRef.current;
if (!st || !prof) return;
setShareOpen(true);
const blob = await drawShareCard({
name: prof.name, cityName: CITIES[st.cityKey].name, day: Math.min(30, st.day), money: st.money, goal: st.goal,
career: (CAREERS[st.careerIdx] ?? CAREERS[0]!).name, company: employerHere(st)?.short ?? "仲恺公司", companyEmoji: employerHere(st)?.emoji ?? "🏭",
title: metaRef.current.title, stamps: metaRef.current.stamps.length, stampTotal: SZ_STATION_COUNT, places: metaRef.current.atlas.length,
lines: metaRef.current.linesDone.length, achievements: metaRef.current.achievements.length, streak: metaRef.current.streak.count,
event: `${evRef.current.emoji} ${evRef.current.name}`, link: inviteLink(myPubRef.current, prof.name, st.employer),
});
if (blob) setShareImg((old) => { if (old) URL.revokeObjectURL(old.url); return { url: URL.createObjectURL(blob), blob }; });
};
const shareNative = async () => {
const st = gsRef.current; const prof = profileRef.current;
if (!st || !prof) return;
const link = inviteLink(myPubRef.current, prof.name, st.employer);
const text = `我在《深惠人生模拟》里过到第 ${Math.min(30, st.day)} 天，存款 ¥${Math.round(st.money).toLocaleString()}，集了 ${metaRef.current.stamps.length} 个地铁站章。来一起过日子：`;
try {
const file = shareImg ? new File([shareImg.blob], "shenhui-life.png", { type: "image/png" }) : null;
if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text, url: link });
else if (navigator.share) await navigator.share({ text, url: link });
else { await navigator.clipboard.writeText(`${text}${link}`); showToast("分享文案和邀请链接已复制，粘贴给朋友就行。"); }
} catch { /* user closed the share sheet */ }
};
const copyInvite = async () => {
const st = gsRef.current; const prof = profileRef.current;
if (!st || !prof) return;
try { await navigator.clipboard.writeText(inviteLink(myPubRef.current, prof.name, st.employer)); showToast("邀请链接已复制：朋友点开就能进同一个世界。朋友玩满 3 天、和真人组过一次局后，你会收到 ¥200 邀请奖励（每周最多 10 份）。"); }
catch { showToast("复制失败，长按下面的链接手动复制。"); }
};

/* 连续登录：按真实日历算，每天进游戏时滚动一次 */
useEffect(() => {
if (phase === "game") updMeta((m) => { touchStreak(m); });
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [phase]);
/* 今日城市事件：新的一天播报一次，并记进「见过的事件」 */
useEffect(() => {
if (phase !== "game") return;
if (!metaRef.current.eventsSeen.includes(todayEvent.id)) updMeta((m) => { m.eventsSeen = [...m.eventsSeen, todayEvent.id]; });
showToast(`${todayEvent.emoji} 今日城市事件「${todayEvent.name}」：${todayEvent.desc}`);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [phase, todayEvent.id, todayEvent.desc]);

/* Ride exactly the route picked on the line map, between ANY two stations
   (not only stations that are also game locations). Not at the boarding
   station yet → walk to it first, then board automatically. */
const rideStations = (fromName: string, toName: string) => {
const s0 = gsRef.current;
if (!s0 || walking || carriage) return;
const route = findStationRoute(s0.cityKey, fromName, toName);
const board = exitLocForStation(s0.cityKey, fromName);
const alight = exitLocForStation(s0.cityKey, toName);
if (!route || !board || !alight) { showToast("这两个站之间规划不出线路，换个站试试。"); return; }
if (s0.money < route.fare) { showToast(`这趟车票 ¥${route.fare}（${route.summary}），钱包不够，先打工攒点钱再坐。`); return; }
pendingRide.current = null;
pendingAfterRide.current = null;
if (board !== currentLocRef.current) {
pendingStationRide.current = { route, board, alight };
showToast(`先走到「${fromName}」站（${locById(board).short}旁）进站，再坐 ${route.summary} 到「${toName}」。`);
walkTo(board, "walk");
return;
}
startMetroRide(board, alight, route);
};

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
const switchCity = (to: CityKey, route?: CrossRoute) => {
const s0 = gsRef.current;
if (!s0) return;
if (walking || carriage || lifeAnim) { showToast("先等这趟行程结束，再去坐跨城的车。"); return; }
const from = s0.cityKey;
if (to === from) return;
const fare = route ? route.fare : intercityFare(from, to);
const crossing = from === "hk" || to === "hk";
const arrLoc = route?.toLoc ?? INTERCITY_STATION[to];
/* Fare as the player sees it: cross-border fares are labelled in the
   DEPARTURE currency (West Kowloon → HK$, Shenzhen/Huizhou → ¥, named
   as such); the domestic Shenzhen⇄Huizhou fare stays a plain ¥40. */
const fareTxt = route ? crossFareStr(route) : crossing ? crossFareLabel(from, fare) : `¥${fare}`;
/* The fare is charged when the player can afford it, but a switch is
   NEVER blocked by an empty wallet （绝不拦路， same rule as cycling):
   broke players ride free and are told so plainly. */
const charged = s0.money >= fare;
const fromStation = getLocations(from).find((l) => l.id === (route && route.fromLoc !== "*" ? route.fromLoc : INTERCITY_STATION[from]))?.name ?? CITIES[from].name;
const toStationLoc = getLocations(to).find((l) => l.id === arrLoc);
const toStation = toStationLoc?.name ?? CITIES[to].name;
const arrive = () => {
/* real bearings between the cities (x east, z south): Hong Kong is south of Shenzhen, Huizhou east-north-east, Hong Kong→Huizhou north-east */
const DIR: Record<string, [number, number]> = { "sz>hk": [0, 1], "hk>sz": [0, -1], "sz>hz": [0.9, -0.35], "hz>sz": [-0.9, 0.35], "hk>hz": [0.6, -0.8], "hz>hk": [-0.6, 0.8] };
const d = DIR[`${from}>${to}`] ?? [0, 0];
setArrival({ dx: d[0], dz: d[1], nonce: Date.now() });
const wall = generateDailyPosts({ day: s0.day, cityKey: to, playerName: profileRef.current?.name ?? "我" }, [], gsRef.current?.npcMem ?? {});
mutate((s) => {
s.cityKey = to;
if (charged) s.money -= fare;
s.energy = clamp(s.energy - 6, 1, 100);
s.metroRides = (s.metroRides ?? 0) + 1;
s.npcFeed = wall.posts;
s.npcMem = wall.mems;
if (route) s.energy = clamp(s.energy - Math.round(route.min / 15), 1, 100); // the trip is already acted out: it tires you, it does not lock you
s.log = [{ day: s.day, text: route
  ? `${route.emoji} ${route.name}：从${fromStation}出发${crossing ? "，出示证件、安检、入境" : ""}，${route.min} 分钟后到了${toStation}——接下来在${CITIES[to].name}过日子，进度、家当原样带着${charged ? (fare ? `（${fareTxt}）` : "") : "（钱包不够，这趟免费）"}。`
  : crossing
  ? `过关啦：坐高铁从${fromStation}出发，在${to === "hk" ? "西九龙站一地两检" : "口岸"}办完出示证件、安检、入境手续，抵达${toStation}——接下来在${CITIES[to].name}过日子，进度、家当原样带着走${charged ? `（车票 ${fareTxt}）` : "（钱包不够车票钱，这趟免费坐）"}。`
  : `坐厦深高铁从${fromStation}到${toStation}，接下来在${CITIES[to].name}过日子——进度、家当都原样带着走${charged ? `（车票 ${fareTxt}）` : "（钱包不够车票钱，这趟免费坐）"}。` }, ...s.log].slice(0, 40);
});
setCurrentLoc(arrLoc); currentLocRef.current = arrLoc;
setSelectedLoc(arrLoc);
setAsideTab("place"); autoOpenAside();
setMapFocus({ locId: arrLoc, nonce: Date.now() });
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
/* ---------- 工作日常：每种职业一天里的真实步骤 ---------- */
const routineToday = (g: GameState): RoutineDay => (g.routine && g.routine.day === g.day ? g.routine : { day: g.day, done: {} });
const isWorkplace = (l: Loc, g: GameState) => l.type === "work" || !!companyAt(g.cityKey, l.id);
const atJob = (role: RoutineRole, l: Loc, g: GameState) => { const w = ROLE_META[role].where; return w === "any" ? true : w === "work" ? isWorkplace(l, g) : w.includes(l.type); };
/** shops a rider picks up from, and places they deliver to (any game place or town / village) */
const riderPick = (g: GameState, role: RoutineRole = "rider"): { shop: string; dest: string; d: number } | null => {
  const locs = getLocations(g.cityKey);
  const shops = role === "driver"
    ? [...locs.filter((l) => l.id !== currentLocRef.current)] // a fare can wave from anywhere
    : locs.filter((l) => ["food", "mall", "market", "social"].includes(l.type) && !venueClosed(l)); // only places open right now take orders
  const shop = shops[Math.floor(Math.random() * shops.length)];
  if (!shop) return null;
  const pool = [...locs.filter((l) => l.id !== shop.id && ["home", "work", "learn", "health", "hotel", "fun", "scenic", "transit"].includes(l.type)).map((l) => ({ id: l.id, x: l.x, z: l.z })),
    ...AREA_LABELS.filter((a) => a.c === g.cityKey).map((a) => ({ id: areaLocId(a.c, a.n), x: a.x, z: a.z }))];
  const near = pool.filter((p) => { const d = Math.hypot(p.x - shop.x, p.z - shop.z); return d > 2.5 && d < 16; });
  const dest = (near.length ? near : pool)[Math.floor(Math.random() * (near.length || pool.length))];
  return dest ? { shop: shop.id, dest: dest.id, d: Math.hypot(dest.x - shop.x, dest.z - shop.z) } : null;
};
const doRoutine = (id: string) => {
  const s0 = gsRef.current; if (!s0 || walking || carriage) return;
  if (s0.busyUntil && Date.now() < s0.busyUntil) { showToast(en ? `Still busy with “${s0.busyWhat ?? "something"}”.` : `还在忙「${s0.busyWhat ?? "上一件事"}」，忙完再说。`); return; }
  const role = routineRole(s0.idenId);
  const step = routineSteps(role).find((x) => x.id === id); if (!step) return;
  const rd = routineToday(s0); const n = rd.done[id] ?? 0; const tn = nowMin();
  const name = en ? step.en : step.zh;
  if (step.max && n >= step.max) { showToast(en ? `That's enough “${name}” for today.` : `「${name}」今天已经够了。`); return; }
  if (step.hours && !inWindow(tn, step.hours)) { showToast(en ? `“${name}” happens between ${windowStr(step.hours)} (Beijing time).` : `「${name}」要在 ${windowStr(step.hours)} 之间做（北京时间）。`); return; }
  if (s0.energy + step.energy < 0) { showToast(en ? "Out of energy — eat or rest first." : "没力气了，先吃点东西或者歇会儿。"); return; }
  if (step.cash && s0.money + step.cash < 0) { showToast(en ? "Not enough money." : "钱不够。"); return; }
  const base = basePay(s0);
  let pay = step.pay ? Math.round(base * step.pay) : 0;
  let mood = step.mood; let note = ""; const xp = step.xp ?? 0;
  let late = rd.late; let payCut = rd.payCut ?? 0;
  let order: RiderOrder | null | undefined = rd.order; let orders = rd.orders ?? 0;
  const hasClock = routineSteps(role).some((x) => x.id === "clockin");
  if (!isOrderRole(role)) {
    if (!atJob(role, locById(currentLocRef.current), s0)) { const w = ROLE_META[role].where; showToast(en ? "Do this at your workplace." : w === "work" ? "这些要到公司 / 厂里做。" : `这些要到${(w as string[]).map((t) => ({ food: "餐厅", market: "市场", mall: "商场", social: "娱乐场所", learn: "学校 / 图书馆", lodging: "酒店", health: "医院" } as Record<string, string>)[t] ?? t).join("、")}做。`); return; }
    if (hasClock && id !== "clockin" && !rd.done.clockin) { showToast(en ? "Clock in first." : "先打卡上班。"); return; }
    const lateAfter = (step.hours?.[0] ?? 9 * 60) + 90; // over 1.5 h after the start window opens counts as late
    if (id === "clockin" && tn > lateAfter) { late = true; mood -= 4; note = en ? "Late — attendance bonus gone." : "迟到了，全勤奖没了。"; }
    if (id === "clockout") {
      const core = routineSteps(role).filter((x) => x.core && x.id !== "clockin").reduce((t, x) => t + Math.min(x.max ?? 1, rd.done[x.id] ?? 0), 0);
      const share = Math.min(1.15, 0.35 + 0.16 * core) * (late ? 0.95 : 1) * (1 - payCut);
      pay = Math.round(base * share);
      note = en ? `Today's pay settled: ${core}/${CORE_FOR_FULL_DAY + 1} work blocks done.` : `今天的工资结算：完成了 ${core} 项正事${core >= CORE_FOR_FULL_DAY ? "，满勤" : "，还能更多"}${payCut ? `，绩效扣了 ${Math.round(payCut * 100)}%` : ""}。`;
    }
  } else {
    if (id !== "online" && !rd.online && ["grab", "wait", "climb", "handover"].includes(id)) { showToast(en ? "Start your shift first." : role === "driver" ? "先出车。" : "先上线开工。"); return; }
    if (id === "grab") {
      if (order) { showToast(en ? "Finish the order you have first." : "手上还有一单，先送完。"); return; }
      if (Math.random() < 0.42) { note = en ? "Too slow — someone else got it." : "手慢了，被别人抢走了。"; }
      else {
        const pk = riderPick(s0, role);
        if (!pk) note = en ? "No restaurants are open right now — no orders." : "这个点附近没有开门的商家，没单可抢。";
        if (pk) {
          const bonus = nowRainy ? 4 : 0;
          const fare = role === "driver" ? Math.round(12 + pk.d * 2.2) : Math.round(6 + pk.d * 0.9 + base * 0.02 + bonus);
          order = { shop: pk.shop, dest: pk.dest, pay: fare, at: Date.now(), stage: currentLocRef.current === pk.shop ? "waiting" : "toShop", stairs: role === "rider" && (Math.random() < 0.45 || pk.dest.startsWith("ar:")), climbed: false };
          note = role === "driver"
            ? (en ? `Fare: pick up at ${trText(locById(pk.shop).name)}, to ${trText(locById(pk.dest).name)} · about ${Y}${fare}.` : `来单了！去「${locById(pk.shop).name}」接乘客，送到「${locById(pk.dest).name}」，打表约 ${Y}${fare}。`)
            : (en ? `Got it: pick up at ${trText(locById(pk.shop).name)}, deliver to ${trText(locById(pk.dest).name)} · ${Y}${order.pay}${bonus ? " (rain bonus)" : ""}.` : `抢到了！去「${locById(pk.shop).name}」取餐，送到「${locById(pk.dest).name}」，这单 ${Y}${order.pay}${bonus ? "（下雨加价）" : ""}。`);
        }
      }
    }
    if (id === "wait") {
      if (!order || order.stage !== "waiting" || currentLocRef.current !== order.shop) { showToast(en ? "Get there first." : role === "driver" ? "先开到乘客那儿。" : "到了商家再等餐。"); return; }
      const slow = Math.random() < 0.3; if (slow) { mood -= 3; note = role === "driver" ? (en ? "The passenger kept you waiting." : "乘客磨磨蹭蹭让你等了好久。") : (en ? "The kitchen took forever." : "出餐巨慢，站在门口干着急。"); }
      order = { ...order, stage: "toDest" };
    }
    if (id === "climb") {
      if (!order || order.stage !== "atDoor" || !order.stairs || order.climbed) { showToast(en ? "No stairs to climb right now." : "现在没楼可爬。"); return; }
      order = { ...order, climbed: true };
    }
    if (id === "handover") {
      if (!order || order.stage !== "atDoor") { showToast(en ? "Get to the customer first." : "先把餐送到顾客那儿。"); return; }
      if (order.stairs && !order.climbed) { showToast(en ? "It's on the 7th floor — climb up first." : "顾客住七楼，先爬上去。"); return; }
      const lateBy = Date.now() - order.at > 10 * 60_000;
      pay = Math.round(order.pay * (lateBy ? 0.7 : 1));
      const tip = !lateBy && Math.random() < 0.22 ? 3 + Math.floor(Math.random() * 6) : 0;
      pay += tip; if (lateBy) mood -= 4;
      note = role === "driver"
        ? (en ? `Fare collected: ${Y}${pay}${tip ? ` incl. ${Y}${tip} tip` : ""}${lateBy ? " (took too long — the passenger complained)" : ""}.` : `到了，收款 ${Y}${pay}${tip ? `（含小费 ${Y}${tip}）` : ""}${lateBy ? "（绕得太久被投诉，少收了）" : ""}。`)
        : (en ? `Delivered! ${Y}${pay}${tip ? ` incl. a ${Y}${tip} tip` : ""}${lateBy ? " (late — 30% deducted)" : ""}.` : `送达！这单 ${Y}${pay}${tip ? `（含小费 ${Y}${tip}）` : ""}${lateBy ? "（超时扣了三成）" : ""}。`);
      order = null; orders += 1;
    }
  }
  const risky = step.risk && Math.random() < step.risk.p;
  if (risky && step.risk) { mood += step.risk.mood; if (step.risk.payCut) { payCut = Math.min(0.6, payCut + step.risk.payCut); if (step.pay) pay = Math.round(pay * 0.3); } note = en ? step.risk.en : step.risk.zh; }
  mutate((x) => {
    x.routine = { ...rd, done: { ...rd.done, [id]: n + 1 }, late, payCut, order, orders, online: rd.online || id === "online" };
    x.energy = clamp(x.energy + step.energy, 0, 100); x.mood = clamp(x.mood + mood, 0, 100);
    x.money += pay + (step.cash ?? 0); x.earned += pay; x.xp += risky ? 0 : xp;
    if (step.skill && !risky) x.skill += step.skill;
    if (step.network) x.network += step.network;
    x.busyUntil = Date.now() + cooldownMs(step.min); x.busyWhat = step.zh;
    if (id === "clockout" || id === "handover") { x.workDay = x.day; if (id === "clockout") x.workCount += 1; }
  });
  if (pay > 0) floatReward(`+${fmt(pay)}`, "gold");
  showToast(`${step.emoji} ${name}${note ? ` — ${note}` : en ? ` — ${step.subEn}` : ` —— ${step.sub}`}`);
  track("routine", { role, step: id });
  if (step.scene) {
    routineStage = { set: step.scene.set, pose: step.scene.pose };
    LIFE_SCENES.routine = { title: en ? step.en : step.zh, tone: "indoor", steps: [{ bg: step.scene.bg, prop: step.scene.prop, caption: name, sub: note || (en ? step.subEn : step.sub), move: "stay", fx: step.scene.pose === "type" ? "type" : step.scene.pose === "eat" ? "chew" : step.scene.pose === "sleep" ? "zzz" : undefined }] };
    playLifeAnim("routine");
  }
};
/* the rider rides the order: to the shop, then to the customer — real trips on the map by e-bike */
const riderGo = () => {
  const s0 = gsRef.current; const o = s0 ? routineToday(s0).order : null; if (!s0 || !o) return;
  const target = o.stage === "toShop" || o.stage === "waiting" ? o.shop : o.dest;
  if (!target) return;
  if (target === currentLocRef.current) return;
  walkTo(target, routineRole(s0.idenId) === "driver" ? "taxi" : "moto");
};
/* arriving moves the order on: at the shop you wait for the food, at the door you hand it over */
useEffect(() => {
  const s0 = gsRef.current; if (!s0) return;
  const rd = routineToday(s0); const o = rd.order; if (!o) return;
  if (o.stage === "toShop" && currentLoc === o.shop) mutate((x) => { x.routine = { ...rd, order: { ...o, stage: "waiting" } }; });
  else if (o.stage === "toDest" && currentLoc === o.dest) mutate((x) => { x.routine = { ...rd, order: { ...o, stage: "atDoor" } }; });
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentLoc]);
const routineActs = (loc: Loc, g: GameState): ActDef[] => {
  const role = routineRole(g.idenId);
  if (!isOrderRole(role) && !atJob(role, loc, g)) return [];
  const rd = routineToday(g); const tn = nowMin(); const o = rd.order;
  const out: ActDef[] = [];
  const fmtCost = (st: RoutineStep) => [st.pay ? `+${fmt(Math.round(basePay(g) * st.pay))}` : "", st.cash ? `${st.cash > 0 ? "+" : "-"}${Y}${Math.abs(st.cash)}` : "", st.energy ? `${en ? "energy" : "能量"} ${st.energy > 0 ? "+" : ""}${st.energy}` : "", st.mood ? `${en ? "mood" : "心情"} ${st.mood > 0 ? "+" : ""}${st.mood}` : "", `⏳ ${st.min}${en ? " min" : " 分钟"}`, st.risk ? (en ? "⚠️ risky" : "⚠️ 有风险") : ""].filter(Boolean).join(" · ");
  if (isOrderRole(role) && o) {
    const toShop = o.stage === "toShop" || o.stage === "waiting";
    const tgt = toShop ? o.shop : o.dest;
    const dest = locById(tgt);
    if (toShop) out.push({ kind: "__rider-cancel", emoji: "✖️", title: en ? "Cancel this order" : "取消这单", desc: en ? "The shop is closed or too far — the platform deducts a little." : "商家关门了或者太远：平台扣一点钱、心情也差点。", cost: `-${Y}2 · ${en ? "mood" : "心情"} -3` });
    if (currentLoc !== tgt) out.push({ kind: "__rider-go", emoji: "🛵", title: role === "driver" ? (en ? (toShop ? `Drive to the passenger · ${trText(dest.name)}` : `Drive to ${trText(dest.name)}`) : (toShop ? `开去接乘客 · ${dest.name}` : `送乘客去 · ${dest.name}`)) : en ? (toShop ? `Ride to pick up · ${trText(dest.name)}` : `Ride to the customer · ${trText(dest.name)}`) : (toShop ? `骑去取餐 · ${dest.name}` : `骑去送餐 · ${dest.name}`), desc: en ? `Order worth ${Y}${o.pay}; over 10 minutes late loses 30%.` : `这单 ${Y}${o.pay}，超过 10 分钟算超时扣三成。地图上看你骑过去。`, cost: role === "driver" ? (en ? "your taxi" : "自己的的士") : en ? "e-bike" : "电动车" });
  }
  for (const st of routineSteps(role)) {
    if (isOrderRole(role)) {
      if (st.id === "wait" && !(o?.stage === "waiting" && currentLoc === o.shop)) continue;
      if ((st.id === "climb" || st.id === "handover") && !(o?.stage === "atDoor" && currentLoc === o.dest)) continue;
      if (st.id === "climb" && (!o?.stairs || o.climbed)) continue;
      if (st.id === "grab" && o) continue;
      if (st.id === "online" && rd.online) continue;
    }
    const used = rd.done[st.id] ?? 0;
    const closed = st.hours && !inWindow(tn, st.hours);
    const full = st.max !== undefined && used >= st.max;
    out.push({ kind: `__routine-${st.id}`, emoji: st.emoji, title: `${en ? st.en : st.zh}${st.max && st.max > 1 ? ` (${used}/${st.max})` : full ? " ✓" : ""}`, desc: closed ? (en ? `Between ${windowStr(st.hours!)}` : `${windowStr(st.hours!)} 之间`) : en ? st.subEn : st.sub, cost: fmtCost(st), disabled: !!closed || full });
  }
  return out;
};
/** Take one real route: it runs only in its real hours, a car route needs a
    licence and a car, and you board where the route starts. */
const takeRoute = (r: CrossRoute) => {
const s0 = gsRef.current; if (!s0) return;
if (r.shut) { showToast(en ? `${r.emoji} ${crossName(r, true)}: ${crossHoursStr(r, true)}.` : `${r.emoji} ${r.name}：${r.shut}。`); return; }
if (!isCrossOpen(r, nowMin())) { showToast(en ? `${r.emoji} ${crossName(r, true)} isn't running now (${crossHoursStr(r, true)}, Beijing time). The Huanggang cross-border bus runs 24 hours.` : `${r.emoji} ${r.name} 现在不开（${crossHoursStr(r)}，北京时间）。换一条：皇岗口岸的跨境巴士 24 小时都有。`); return; }
if (r.car && !((s0.license ?? 0) >= 3 && (s0.carOwned || s0.carDay === s0.day))) { showToast("自驾要先考到驾照、有车（买车或者租一天）。"); return; }
if (s0.busyUntil && Date.now() < s0.busyUntil) { showToast(`还在忙「${s0.busyWhat ?? "上一件事"}」，忙完再出发。`); return; }
if (r.fromLoc !== "*" && currentLocRef.current !== r.fromLoc) {
  const l = getLocations(s0.cityKey).find((x) => x.id === r.fromLoc);
  setCrossTo(null); setSelectedLoc(r.fromLoc); walkTo(r.fromLoc);
  showToast(`先去${l?.name ?? "出发点"}——到了在那里点「${r.name}」出发。`);
  return;
}
setCrossTo(null);
track("cross_city", { route: r.id });
switchCity(r.to, r);
};

/* ---------- core numbers ---------- */
const basePay = (s: GameState) => {
const iden = idenOf(s);
const career = CAREERS[s.careerIdx]?? CAREERS[0]!;
return Math.round(iden.pay * CITIES[s.cityKey].payMul * career.mul);
};

/* ---------- 长线进度：集章 / 图鉴 / 周目标 / 成就 ---------- */
const updMeta = (fn: (m: Meta) => void) => {
const m: Meta = structuredClone(metaRef.current);
rollWeek(m);
fn(m);
const fresh = checkAchievements(m, { totalStations: SZ_STATION_COUNT, totalPlaces: placesForCity("sz").length });
metaRef.current = m;
saveMeta(m);
setMetaState(m);
for (const a of fresh) {
floatReward(`🏅 ${a.title}`, "gold");
showToast(`🏅 解锁成就「${a.title}」：${a.desc}。在右侧「🎫 集章」里可以戴上这个称号。`);
}
};
/** Stamp the stations you got on / off / changed at; finishing a line pays out. */
const stampStations = (names: (string | undefined)[]) => {
const clean = [...new Set(names.filter((n): n is string => !!n && !n.endsWith("方向")))];
if (clean.length === 0) return;
let fresh: string[] = [];
const done: MetroLine[] = [];
updMeta((m) => {
fresh = clean.filter((n) => !m.stamps.includes(n));
if (fresh.length === 0) return;
m.stamps = [...m.stamps, ...fresh];
bump(m, "stamps", fresh.length);
for (const ck of ["sz", "hz"] as const) for (const line of metroLinesForCity(ck)) {
if (m.linesDone.includes(line.id)) continue;
const need = line.stations.map((x) => x.name).filter((n) => !n.endsWith("方向"));
if (need.length > 1 && need.every((n) => m.stamps.includes(n))) { m.linesDone = [...m.linesDone, line.id]; done.push(line); }
}
});
if (fresh.length > 0) floatReward(`🎫 新站章 ×${fresh.length}`, "blue");
for (const line of done) {
const reward = 100 + 10 * line.stations.length;
mutate((x) => { x.money += reward; x.mood += 10; });
showToast(`🏁 集齐「${line.name}」全部 ${line.stations.length} 个站章！奖励 ${fmt(reward)}、心情 +10。`);
burstDanmaku([`🏁 ${profileRef.current?.name ?? "你"}集齐了${line.short}全部站章！`, "老周：这条线我坐了十年都没集齐", "阿琳：太强了 🎫", "子健：下一条线冲！"]);
postFeed("life", `集齐了${line.short}全部站章`);
}
const ev = evRef.current;
const flashKey = `${dateKey()}|${gsRef.current?.day ?? 0}|${ev.flashStation ?? ""}`;
if (ev.flashStation && clean.includes(ev.flashStation) && flashGiven.current !== flashKey) {
flashGiven.current = flashKey;
mutate((x) => { x.money += 88; x.mood += 10; });
floatReward("🎤 快闪 +¥88", "gold");
showToast(`🎤 「${ev.flashStation}」站的快闪演出正好赶上了！大家跟着节奏拍手，奖励 ¥88、心情 +10。`);
}
};
/* A gift another player sent: claim it on the server, then apply it here. */
const receiveGift = (g: InboxGift) => {
const prof = profileRef.current;
if (!prof || claimingGifts.current.has(g.id)) return;
claimingGifts.current.add(g.id);
void api.claimGift({ playerId: prof.playerId, giftId: g.id }).then((r) => {
if (!r.ok || !r.gift) return;
const kind = r.gift.kind as GiftKind;
const meta0 = GIFTS[kind];
if (!meta0) return;
mutate((x) => {
if (kind === "tea") { x.mood += 8; x.energy += 5; }
else if (kind === "breakfast") x.energy += 15;
else if (kind === "hongbao") x.money += 88;
else if (kind === "referral" && r.gift?.company) x.referrals = [...new Set([...(x.referrals ?? []), r.gift.company])];
else if (kind === "invite") x.money += 200;
});
updMeta((m) => bump(m, "social"));
const coName = kind === "referral" ? companyById(r.gift.company ?? undefined).short : "";
floatReward(`${meta0.emoji} 来自${r.gift.fromName}`, "green");
showToast(kind === "invite" ? `🎉 你邀请的${r.gift.fromName}在城里站稳了脚跟！邀请奖励 ¥200 已到账。` : kind === "referral" ? `🤝 ${r.gift.fromName}把你内推进了${coName}：去${coName}面试，门槛降低（技能 -2、经验 -6）。` : `${meta0.emoji} ${r.gift.fromName}送了你一份${meta0.name}（${meta0.effect}）。在聊天页可以回赠。`);
addLog(`收到${r.gift.fromName}送的${meta0.name}。`);
}).catch(() => { claimingGifts.current.delete(g.id); });
};
const sendGift = (toId: string, toName: string, kind: GiftKind) => {
const s0 = gsRef.current; const prof = profileRef.current;
if (!s0 || !prof) return;
const gm = GIFTS[kind];
if (s0.money < gm.cost) { showToast(`${gm.name}要 ¥${gm.cost}，钱包不够。`); return; }
if (kind === "referral" && (s0.employer ?? "startup") === "startup") { showToast("先进一家大厂，才能给别人内推。"); return; }
void api.sendGift({ playerId: prof.playerId, toId, kind }).then((r) => {
if (!r.ok) { showToast(r.error ?? "没送出去，稍后再试。"); return; }
if (gm.cost) mutate((x) => { x.money -= gm.cost; x.mood += 3; });
updMeta((m) => { m.giftsSent += 1; bump(m, "social"); });
showToast(`${gm.emoji} 给${toName}送了${gm.name}${gm.cost ? `，-¥${gm.cost}` : ""}。对方下次上线就能收到。`);
}).catch(() => showToast("网络不太好，礼物没送出去。"));
};

/* ---------- actions ---------- */
const doAction = (kind: string, arg = 0) => {
const s0 = gsRef.current;
if (!s0 || walking || currentLoc!== selectedLoc || activeEvent) return;
const tBlock = timeBlock(kind, s0);
if (tBlock) { showToast(`⏰ ${tBlock}。`); return; }
const loc = locById(selectedLoc);
const vClosed = kind === "rest" ? null : venueClosed(loc);
if (vClosed) { showToast(`🔒 ${loc.short}${vClosed}。`); return; }
const base = basePay(s0);
const fitSave = s0.fit >= 3? 3: 0;
const co0 = companyAt(s0.cityKey, loc.id);
const ev = evRef.current;
const co = co0 ? effCompany(co0, ev, s0.referrals) : null;
const colleagues = co ? (world?.online ?? []).filter((p) => p.id !== myPubRef.current && p.employer === co.id && p.cityKey === s0.cityKey) : [];
let msg = "";
const feeds: { kind: "career" | "apec" | "home" | "money" | "life"; text: string }[] = [];
let spent = 0;
mutate((s) => {
const snap = JSON.stringify([s.money, s.energy, s.mood, s.xp, s.skill, s.groceries, s.offers, s.employer, s.fit, s.invest, s.network, s.outfit, s.album, s.apecTasks, s.apecCheckins, s.visitedScenic]);
switch (kind) {
case "rest":
s.energy += 14 + (s.outfit === "pajamas" ? 6 : 0); s.mood += 8;
msg = `歇了一会儿，能量 +${14 + (s.outfit === "pajamas" ? 6 : 0)}，心情 +8${s.outfit === "pajamas" ? "（穿睡衣躺平更舒服）" : ""}。`;
break;
case "work": {
const cost = (co?.energy ?? 28) - fitSave;
const wage = Math.round(base * (co?.payMul ?? 1) * (ev.payMul ?? 1));
const formalXp = s.outfit === "formal" ? 1 : 0;
const buddy = colleagues.length > 0 ? 3 : 0;
s.money += wage; s.earned += wage; s.energy -= cost; s.xp += 2 + formalXp; s.workCount += 1; s.mood += (co?.mood ?? 0) + buddy;
msg = `${co ? `在${co.short}` : ""}上班一天，工资 +${fmt(wage)}${ev.payMul ? "（今天发奖金 ×1.3）" : ""}，经验 +${2 + formalXp}${formalXp ? "（正装加成 +1）" : ""}${co?.mood ? `，心情 ${co.mood > 0 ? "+" : ""}${co.mood}` : ""}${buddy ? `，和同事${colleagues.map((p) => p.name).slice(0, 2).join("、")}一起上班心情 +3` : ""}。`;
break;
}
case "overtime": {
const cost = (co ? co.energy + 14 : 42) - fitSave;
const pay = Math.round(base * (co?.payMul ?? 1) * 1.75 * (co?.otMul ?? 1) * (ev.payMul ?? 1));
s.money += pay; s.earned += pay; s.energy -= cost; s.mood -= 12; s.xp += 3; s.otCount += 1;
msg = `${co ? `在${co.short}` : ""}加班到深夜，+${fmt(pay)}，经验 +3，心情 -12。`;
break;
}
/* ---- 大厂：面试 → offer → 跳槽 ---- */
case "interview": {
if (!co) break;
const key = `${s.day}:${co.id}`;
if ((s.interviews ?? []).includes(key)) break;
s.interviews = [...(s.interviews ?? []).slice(-60), key];
s.energy -= 12;
const gaps = companyGaps(co, s);
if ((s.record ?? 0) >= 2 || ((s.record ?? 0) >= 1 && co.formal)) {
s.mood -= 6; s.xp += 1;
msg = `${co.short}做了背景调查，发现你有违法记录，没有通过。好好过日子，案底会跟着你一整局。`;
} else if (co.formal && s.outfit !== "formal") {
s.mood -= 4; s.xp += 1;
msg = `${co.short}的面试官上下打量了你一眼：「我们这儿面试要穿正装。」这次没过。去商场买身正装再来，经验 +1。`;
} else if (gaps.length > 0) {
s.mood -= 3; s.xp += 1;
msg = `${co.short}面试没过，还差：${gaps.join("、")}。面试官说「再沉淀沉淀」。多上班攒经验、去图书馆学技能，明天还能再来，经验 +1。`;
} else {
s.offers = [...new Set([...(s.offers ?? []), co.id])];
s.mood += 10;
msg = `🎉 ${co.short}面试通过，拿到 offer！日薪约 ${fmt(Math.round(base * co.payMul))}，点「接受 offer」就能入职。`;
feeds.push({ kind: "career", text: `拿到了${co.short}的 offer` });
}
break;
}
case "join-company": {
if (!co || !(s.offers ?? []).includes(co.id)) break;
const from = companyById(s.employer);
s.employer = co.id;
s.offers = (s.offers ?? []).filter((x) => x !== co.id);
s.mood += 8;
s.npcNews = [...(s.npcNews ?? []), { kind: "career" as const, text: `跳槽去了${co.short}`, day: s.day }];
msg = `🤝 从${from.short}跳槽到${co.short}！以后来这里上班，日薪 ×${co.payMul}。${co.culture}`;
feeds.push({ kind: "career", text: `从${from.short}跳槽到${co.short}` });
break;
}
case "canteen":
s.money -= 12; s.energy += 22; s.mood += 4; s.mealCount += 1;
msg = `在${co?.short ?? "公司"}食堂刷工卡吃了一顿，¥12 吃到饱，能量 +22。`;
break;
case "campus-tour":
s.energy -= 3; s.mood += 6;
if (co && ev.openDay === co.id) s.xp += 1;
msg = `在${loc.short}园区里逛了一圈：咖啡厅、工牌、步履匆匆的打工人。心情 +6${co && ev.openDay === co.id ? "，开放日听了场分享，经验 +1" : ""}。`;
break;
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
const fc = Math.round(f.cost * (ev.eatMul ?? 1));
const fm = f.mood + (ev.eatMood ?? 0);
s.money -= fc; s.energy += f.energy; s.mood += fm; s.mealCount += 1;
msg = `${f.name}下肚，能量 +${f.energy}，心情 +${fm}${ev.eatMul ? `（美食节价 ¥${fc}）` : ""}。`;
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
if (ev.beachClosed && isBeachLoc(loc)) { msg = "🌀 台风预警，海边今天封闭了，改天再来。"; break; }
const cost = loc.funCost?? CITIES[s.cityKey].funCost;
const mood = (loc.funMood?? CITIES[s.cityKey].moodFun) + (ev.funMood ?? 0);
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
if (s.apecCount === 3) s.npcNews = [...(s.npcNews ?? []), { kind: "apec" as const, text: "在 峰会会场服务满 3 场了", day: s.day }];
if (mul >= 1.5) feeds.push({ kind: "apec", text: `在${loc.short}做了一场会务服务，+${fmt(pay)}` });
}
msg = `会务服务一场，+${fmt(pay)}${mul > 1? `（峰会 ×${mul}）`: ""}，经验 +2。`;
break;
}
case "apec-host": {
const mul = apecVenueMul(s.day, loc.id);
const pay = Math.round(base * 1.25 * mul);
s.money += pay; s.earned += pay; s.energy -= 20; s.xp += 3; s.network += 1;
if (isApecWeek(s.day)) {
s.apecCount += 1;
if (s.apecCount === 3) s.npcNews = [...(s.npcNews ?? []), { kind: "apec" as const, text: "在 峰会会场服务满 3 场了", day: s.day }];
if (mul >= 1.5) feeds.push({ kind: "apec", text: `在${loc.short}接待了外宾团，+${fmt(pay)}，人脉 +1` });
}
msg = `外宾接待一场，+${fmt(pay)}${mul > 1? `（峰会 ×${mul}）`: ""}，经验 +3，人脉 +1。`;
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
msg = `📸 在${loc.name}打卡成功！峰会会场已打卡 ${n} / 3，心情 +6。${apecTaskOfDay(s.day)?.venueLocId === loc.id ? "今天的岗位任务就在这里，先打卡再上岗。" : ""}`;
feeds.push({ kind: "apec", text: `在${loc.short}完成了 峰会会场打卡（${n}/3）` });
}
break;
}
case "apec-task": {
const task = apecTaskOfDay(s.day);
if (!task || task.venueLocId !== loc.id) { msg = "今天这里没有峰会周的岗位任务——看看 峰会活动卡，今天的班在另一个会场。"; break; }
if ((s.apecTasks ?? []).includes(task.id)) { msg = `今天的任务「${task.title}」已经完成了，明天还有新的一班。`; break; }
if (!(s.apecCheckins ?? []).includes(loc.id)) { msg = "先在会场打卡再上岗——点上方的「会场打卡」，这也是认会场、认深圳的一部分。"; break; }
if (s.energy < task.energy) { msg = `这个岗位要站一整班，能量至少 ${task.energy}，先去吃点东西或者歇一会儿。`; break; }
const pay = Math.round(base * task.payMul);
s.money += pay; s.earned += pay; s.energy -= task.energy; s.xp += task.xp; s.network += task.network;
s.apecCount += 1;
s.apecTasks = [...(s.apecTasks ?? []), task.id];
const doneN = (s.apecTasks ?? []).length;
if (s.apecCount === 3) s.npcNews = [...(s.npcNews ?? []), { kind: "apec" as const, text: "在 峰会会场服务满 3 场了", day: s.day }];
feeds.push({ kind: "apec", text: `以${task.role}身份完成了 峰会任务「${task.title}」（${doneN}/${APEC_TASKS.length}），+${fmt(pay)}` });
if (doneN >= APEC_TASKS.length) {
s.npcNews = [...(s.npcNews ?? []), { kind: "apec" as const, text: "拿到了湾区峰会服务证书，六天任务全做完", day: s.day }];
msg = `🏅 「${task.title}」完成，+${fmt(pay)}，经验 +${task.xp}，人脉 +${task.network}。六天的峰会周任务全部完成——${APEC_CERT_NAME}已经记在你的名下，结算时见！`;
} else {
msg = `✅ 峰会任务「${task.title}」完成（${task.roleEmoji} ${task.role}），+${fmt(pay)}，经验 +${task.xp}，人脉 +${task.network}。进度 ${doneN} / ${APEC_TASKS.length}，明天继续。`;
}
break;
}
case "mall-shop": {
const c = Math.round(120 * (ev.mallMul ?? 1));
s.money -= c; s.mood += 14;
msg = `逛了圈商场买了点小东西${ev.mallMul ? `（大促只花了 ¥${c}）` : ""}，心情 +14。`;
break;
}
case "mall-cloth": {
const c = Math.round(300 * (ev.mallMul ?? 1));
s.money -= c; s.mood += 20; s.network += 1;
msg = `换了身新行头${ev.mallMul ? `（大促只花了 ¥${c}）` : ""}，人精神了，心情 +20。`;
break;
}
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
case "buy-medicine":
s.money -= 35; s.energy += 10; s.mood += 2;
msg = "在药店买了常备药，药师顺便叮嘱了用法。能量 +10。";
break;
case "ask-help":
s.mood += 3;
msg = loc.placeKind === "police" ? "民警耐心给你指了路，还提醒有急事直接打 110。心情 +3。" : "药师说小问题不用跑医院，真不舒服就去最近的急诊。心情 +3。";
break;
case "tourist-map":
s.mood += 4;
msg = "领了一份中英文地图：地铁线网、景点、医院和 120/110 应急电话都在上面。心情 +4。";
break;
case "volunteer":
s.energy -= 10; s.network += 1; s.xp += 1; if (isApecWeek(s.day)) s.mood += 8;
msg = `当了一会儿志愿者，帮${isApecWeek(s.day) ? "外宾" : "游客"}指路找地铁站，人脉 +1、经验 +1${isApecWeek(s.day) ? "、心情 +8" : ""}。`;
break;
case "hike":
s.energy -= 16; s.mood += 20; s.fit += 1;
msg = `登山徒步一趟，体质 +1（已练 ${s.fit} 次），心情 +20。`;
break;
default:
break;
}
/* 一天的时间预算：真正做成了的行动才走表 */
if (msg && JSON.stringify([s.money, s.energy, s.mood, s.xp, s.skill, s.groceries, s.offers, s.employer, s.fit, s.invest, s.network, s.outfit, s.album, s.apecTasks, s.apecCheckins, s.visitedScenic]) !== snap) {
spent = actionMinutes(kind);
s.busyUntil = Date.now() + cooldownMs(spent, (s.perks ?? []).includes("route"));
s.busyWhat = ({ work: "上班", overtime: "加班", gig: "接活", "apec-staff": "峰会上岗", "apec-task": "做峰会任务", "learn-course": "上课", "learn-self": "自习", gym: "健身", hike: "爬山", "hk-trip": "去香港", interview: "面试", cook: "做饭", eat: "吃饭", rest: "歇着", fun: "玩" } as Record<string, string>)[kind] ?? "忙";
s.lastActiveDay = s.day;
if (kind === "rest") { s.restN = s.restDay === s.day ? (s.restN ?? 0) + 1 : 1; s.restDay = s.day; }
if (kind === "work") s.workDay = s.day;
if (kind === "overtime") s.otDay = s.day;
}
});
if (msg && spent) {
track(`act:${kind}`);
window.setTimeout(() => floatReward(`⏳ ${realMinLabel(spent, (s0.perks ?? []).includes("route"))}`, "blue"), 250);
}
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
/* 弹幕刷屏时刻：打卡成功 / 峰会打卡与上岗，街坊们发弹幕庆祝 */
if (msg && kind === "checkin" && !msg.includes("已经打过卡")) {
const spot = scenicOf(s0.cityKey, selectedLoc);
burstDanmaku([`📸 ${profileRef.current?.name ?? "你"} 在${spot?.name ?? loc.short}打卡成功！`, "阿琳：这张拍得真好 👍", "大芬姐：风景册又多一页啦", "子健：我也要去打卡 📍", "Lisa：Great shot! 🌟"]);
}
if (msg && kind === "work") updMeta((m) => bump(m, "work"));
if (msg && kind === "interview") updMeta((m) => bump(m, "interviews"));
if (msg && kind === "join-company" && co) updMeta((m) => { if (!m.companies.includes(co.id)) m.companies = [...m.companies, co.id]; });
if (msg && kind === "join-company" && co) {
setLevelFx({ name: `入职${co.short}`, nonce: Date.now() });
window.setTimeout(() => setLevelFx(null), 2600);
burstDanmaku([`🤝 ${profileRef.current?.name ?? "你"}跳槽去${co.short}啦！`, "阿琳：大厂见！别忘了老同事 🥲", "老周：深圳打工人的高光时刻", "小美：请客请客 🍻", "子健：内推我一个呗"]);
}
if (msg && kind === "apec-checkin") {
burstDanmaku([`🌐 峰会会场打卡 +1！`, "Lisa：三个会场集齐有徽章哦", "老周：峰会周，深圳准备好了", "小美：志愿者辛苦啦 🎽"]);
}
if (msg && kind === "apec-task") {
burstDanmaku([`🎉 峰会今日任务完成！`, "Lisa：干得漂亮，这就是深圳服务 🌐", "阿强：给 峰会打工的人点赞", "陈伯：盛会办得好，街坊脸上有光", "王姨：辛苦啦，回来喝碗糖水"]);
}
const animMap: Partial<Record<string, LifeKind>> = { work: "code", overtime: "overtime", eat: "eat", canteen: "eat", interview: "code", "campus-tour": "stroll", gym: "gym", wash: "wash", cook: "cook", "buy-groceries": "groceries", stroll: "stroll", "social-ktv": "gathering", "social-drink": "gathering", "mall-shop": "shopping", "mall-cloth": "shopping", fun: "stroll" };
// signature rides and sights get their own scene instead of a plain stroll
const special: LifeKind | undefined = kind !== "fun" && kind !== "stroll" && kind !== "checkin" ? undefined
  : loc.id === "hejiang" || loc.id === "sanjiaozhou" ? "cruise"
  : loc.name === "欢乐港湾" ? "wheel"
  : loc.name.includes("海洋世界") || loc.name.includes("水族") ? "aquarium"
  : loc.id === "haiguiwan" ? "turtle"
  : loc.id === "happyvalley" ? "coaster"
  : loc.id === "safari" ? "safari"
  : loc.id === "octeast" ? "cablecar"
  : loc.type === "mountain" || ["luofu", "nankunshan", "xiangtoushan", "gaobangshan", "tanglangshan", "fenghuangshan"].includes(loc.id) || loc.placeKind === "peak" ? "hike"
  : /海滩|沙滩|海边|海滨|杨梅坑|黄金海岸|檀悦/.test(loc.name) || loc.placeKind === "beach" ? "beach" : undefined;
const ak = special ?? animMap[kind];
if (ak && msg && !(kind === "cook" && s0.groceries <= 0) && !(kind === "buy-groceries" && s0.money < 28)) playLifeAnim(ak);
};

/* ---------- sleep / day rollover ---------- */
/* ---------- 真实时间：睡觉不再跳天，日子跟着北京时间走 ---------- */
const doSleep = () => {
const s0 = gsRef.current;
if (!s0 || s0.finished) return;
const tb = timeBlock("__sleep", s0);
if (tb) { showToast(`⏰ ${tb}。`); return; }
const first = s0.sleptDay !== s0.day;
const night = inWindow(nowMin(), [20 * 60, 34 * 60]);
mutate((s) => {
if (first) { s.energy = 100; s.sleptDay = s.day; s.mood += homeMoodBonus(s) + (night ? 4 : 0); }
else s.energy = Math.min(100, s.energy + 20);
s.busyUntil = Date.now() + cooldownMs(first ? actionMinutes("sleep") : 40); s.busyWhat = "睡觉";
s.lastActiveDay = s.day;
});
showToast(first ? `😴 美美睡了一觉，能量回满${night ? "，按时睡觉心情 +4" : ""}。日子跟着北京时间走，睡觉不会跳到明天。` : "😴 又眯了一会儿，能量 +20（今天已经睡过整觉了）。");
};

/* 北京时间过了零点：把错过的日子一天天过完（没上线的日子自动模拟上班、吃饭），周六照常交租 */
const advanceDays = (target: number) => {
const s0 = gsRef.current;
if (!s0 || s0.finished || target <= s0.day) return;
let rentMsg = "";
let broke = false;
let simDays = 0; let simPay = 0;
const next = mutate((s) => {
while (s.day < target) {
const d = s.day;
if (s.lastActiveDay !== d) {
simDays += 1;
if (!/周六|周日/.test(weekday(d))) { const w = Math.round(basePay(s) * 0.6); s.money += w; s.earned += w; simPay += w; s.workCount += 1; }
s.money -= 40; s.mealCount += 2;
}
if (isSaturday(d)) {
s.money -= s.rent;
s.rentPaid += s.rent;
rentMsg += ` 周六交租 -${fmt(s.rent)}。`;
if (s.money < -500) broke = true;
}
if (s.invest > 0) {
if (Math.random() < 0.15) { const loss = Math.round(s.invest * 0.03); s.invest -= loss; rentMsg += ` 理财波动 -${fmt(loss)}。`; }
else { const gain = Math.max(1, Math.round(s.invest * 0.004)); s.invest += gain; }
}
s.day += 1;
}
if (s.hangover) { s.energy = Math.max(20, s.energy - 25); s.hangover = false; rentMsg += " 宿醉头疼，能量 -25。"; }
s.energy = Math.min(100, s.energy + 30);
if (s.mood <= 5) { s.mood = 25; rentMsg += " 心情见底，过了一夜缓过来一点。"; }
s.greeted = [];
});
if (!next) return;
if (simDays > 0) track("day_auto", { missed: simDays });
if (simDays > 0) rentMsg = `你没上线的 ${simDays} 天，日子照常过：模拟上班 +${fmt(simPay)}，吃饭 -${fmt(simDays * 40)}。` + rentMsg;
if (rentMsg) addLog(rentMsg.trim());
if (broke) {
finishSeason("debt");
return;
}
if (next.day > seasonLength(next.startKey ?? SEASON_START)) {
finishSeason("done");
return;
}
/* NPC simulation: overnight, the neighbours post and comment on a new wall —
   yesterday's player news (promotion, new home, Summit service) is what they
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
/* 街坊连续剧的钩子：谁今天有新的一章，早上就冒个弹幕提醒 */
{
const g2 = gsRef.current;
const ready = g2 ? STORIES.filter((st) => npcsForCity(g2.cityKey).some((n) => n.name === st.npc)).filter((st) => { const k = storyStatus(st, g2.story?.[st.npc], memOf(g2.npcMem ?? {}, st.npc).rel, g2.day).kind; return (k === "ready" && (g2.story?.[st.npc]?.ch ?? 0) > 0) || k === "ending"; }) : [];
ready.slice(0, 2).forEach((st, i) => window.setTimeout(() => pushDanmakuRef.current(en ? `📖 ${trText(st.npc)}'s story "${L(st.title)}" continues — go and talk to ${trText(st.npc)}` : `📖 ${st.npc}的故事「${st.title}」有后续了——去找${st.npc}聊聊`), 2600 + i * 1200));
}
}
showToast(`🌅 北京时间新的一天：第 ${next.day} 天 · ${weekday(next.day)}${rentMsg ? " " + rentMsg.trim() : ""}`);
if (Math.random() < 0.55) {
const ev = pickEvent(next.day, next.cityKey, new Set(next.seenEvents));
if (ev) {
mutate((s) => { s.seenEvents = [...s.seenEvents, ev.title];});
window.setTimeout(() => setActiveEvent(ev), 450);
}
}
};

/* 真实时钟心跳：过了北京时间零点就推进日子；能量每 3 分钟自然恢复 1 点（早起的鸟 ×1.5）；冷却倒计时每秒刷新 */
const advanceRef = useRef(advanceDays); advanceRef.current = advanceDays;
const [, setClockTick] = useState(0);
const lastBeatKey = useRef(-1);
useEffect(() => {
if (phase !== "game") return;
const beat = () => {
const s = gsRef.current;
if (!s || s.finished) return;
const target = realGameDay(s.startKey ?? SEASON_START);
if (target > s.day) advanceRef.current(target);
const now = Date.now();
const step = (s.perks ?? []).includes("early") ? 120_000 : 180_000;
const last = s.regenAt ?? now;
const gained = Math.floor((now - last) / step);
if (gained > 0) mutate((x) => { x.energy = Math.min(100, x.energy + (x.energy < 100 ? gained : 0)); x.regenAt = last + gained * step; });
/* 只在分钟变了或者正在冷却时才重绘，免得整个界面每秒刷新 */
const busy = !!s.busyUntil && now < s.busyUntil + 1000;
const key = busy ? Math.floor(now / 1000) : nowMin();
if (key !== lastBeatKey.current) { lastBeatKey.current = key; setClockTick((t) => t + 1); }
};
beat();
const t = window.setInterval(beat, 1000);
return () => window.clearInterval(t);
}, [phase]);

const finishSeason = (reason: "done" | "debt") => {
const s0 = gsRef.current;
if (!s0 || finishedSent.current) return;
finishedSent.current = true;
const r = computeResult(s0, reason);
setResult(r);
mutate((s) => { s.finished = true;});
const prof = profileRef.current;
if (prof) {
const storiesDone = Object.values(s0.story ?? {}).filter((p) => p.done).length;
const lp = runPoints({ reason, money: s0.money, goal: s0.goal, careerIdx: s0.careerIdx, bigCo: (s0.employer ?? "startup") !== "startup", stories: storiesDone, romance: Math.max(0, ...Object.values(s0.romance ?? {}).map(romanceStage)), buddies: s0.partyPlays ?? 0 });
setLegacyGain(lp);
track("run_finish", { reason, title: r.title.slice(0, 30), day: s0.day, pts: lp.pts });
updMeta((m) => { m.runs += 1; m.legacy = { ...m.legacy, pts: m.legacy.pts + lp.pts, total: m.legacy.total + lp.pts, history: [{ title: r.title, pts: lp.pts, day: dateKey() }, ...m.legacy.history].slice(0, 20) }; });
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
      if (data.me) setMyPub(data.me);
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
      employer: "startup", offers: [], interviews: [], referrals: [],
    };
    /* 深漂档案：本局带上的传承（最多 MAX_EQUIP 个） */
    const perks = metaRef.current.legacy.equipped.filter((id) => metaRef.current.legacy.owned.includes(id) && perkById(id)).slice(0, MAX_EQUIP);
    state.perks = perks;
    /* 真实时间：本局从今天的北京日期开始；11 月里开局就是第「今天几号」天，目标按剩下的天数折算 */
    state.startKey = seasonStartFor();
    setSeason(state.startKey);
    const sLen = seasonLength(state.startKey);
    state.day = Math.min(sLen, Math.max(1, realGameDay(state.startKey)));
    state.regenAt = Date.now();
    if (state.day > 1) { const left = sLen + 1 - state.day; state.goal = Math.max(1000, Math.round((state.goal * left) / 30 / 100) * 100); state.log = [{ day: state.day, text: `今天是北京时间 ${seasonMonth(state.startKey)} 月 ${state.day} 日，你从第 ${state.day} 天进城，目标按本月剩下的 ${left} 天折算成 ${fmt(state.goal)}。` }, ...state.log]; }
    if (perks.includes("cash")) { state.money += 800; state.maxMoney = state.money; }
    if (perks.includes("wardrobe")) state.ownedOutfits = [...new Set([...state.ownedOutfits, "formal", "raincoat"])];
    if (perks.includes("skill")) state.skill += 2;
    if (perks.includes("xp")) state.xp += 6;
    if (perks.includes("rent")) { state.rent = Math.round((state.rent * 0.9) / 10) * 10; state.baseRent = state.rent; }
    if (perks.includes("friends")) state.npcMem = Object.fromEntries(NPCS.map((n) => { const m0 = memOf(state.npcMem, n.name); return [n.name, { ...m0, rel: Math.max(15, m0.rel), talks: Math.max(1, m0.talks) }]; }));
    if (perks.length) state.log = [{ day: 1, text: `深漂档案传承：${perks.map((id) => perkById(id)!.name).join("、")}。` }, ...state.log];
    // Came in through a friend's invite link: welcome bonus + an intro
    // (内推) to the friend's company.
    if (invite && invite.fromId !== myPubRef.current) {
      if (invite.co && COMPANIES.some((c) => c.id === invite.co && c.id !== "startup")) state.referrals = [invite.co];
      state.log = [{ day: 1, text: `${invite.from}邀请你来${cityInfo.name}${state.referrals?.length ? `，还帮你内推了${companyById(invite.co ?? undefined).short}` : ""}。` }, ...state.log];
    }
    finishedSent.current = false;
    profileRef.current = prof;
    setProfile(prof);
    setAnalyticsPlayer(prof.playerId);
    track("run_start", { city, iden: iden.id, perks: perks.length, day: state.day });
    setCurrentLoc("home");
    setSelectedLoc("home");
    gsRef.current = state;
    setGs(state);
    saveLocal(prof, state);
    setResult(null);
    setPhase("game");
    const invitedBy = invite && invite.fromId !== myPubRef.current ? invite.fromId : undefined;
    joinMut.mutate({ playerId: prof.playerId, name, emoji: iden.emoji, color: iden.color, cityKey: city, device: deviceId() || undefined, ...(invitedBy ? { invitedBy } : {}) }, {
      onSuccess: () => {
        /* 见面礼由服务器发：每个账号、每台设备只发一次 */
        if (invitedBy) void api.claimReward({ playerId: prof.playerId, kind: "welcome", device: deviceId() || undefined }).then((r) => {
          if (r.ok) { mutate((x) => { x.money += r.money; }); floatReward(`+${fmt(r.money)} 见面礼`, "gold"); addLog(`收到邀请见面礼 ${fmt(r.money)}。`); }
          else if (r.error) showToast(r.error);
        }).catch(() => {});
        clearInviteParams();
      },
    });
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
    const fare = Math.round(taxiFare(Math.hypot(toL.x - fromL.x, toL.z - fromL.z)) * (evRef.current.taxiMul ?? 1));
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
    const topicOf: Record<ChatAction, string> = { greet: "", weather: "天气", work: "工作", apec: "峰会", joke: "开玩笑", help: "帮忙", gift: "送礼物" };
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
      apec: "峰会这事儿，你怎么看？",
      joke: "跟你讲个笑话：为什么程序员分不清万圣节和圣诞节？因为 Oct 31 == Dec 25。",
      help: "看你忙的，需要搭把手吗？我来帮你。",
      gift: `这个送你（${fmt(25)} 的小礼物），不值钱，就图个乐呵，别嫌弃。`,
    };
    setNpcLog((log) => [...log, { from: "me", text: playerLines[action] }, { from: "npc", text: outcome.reply }]);
    if (outcome.favour) addLog(`帮了${npc.name}一个忙，他记下了这份人情。`);
    else if (outcome.slight) addLog(`和${npc.name}聊天，玩笑开过了头，他有点不高兴。`);
    else if (outcome.giftGiven) addLog(`送了${npc.name}一份小礼物，关系暖和了些。`);
  };

  /* ---------- 街坊连续剧 ---------- */
  const applyStoryFx = (s: GameState, npcName: string, fx: StoryFx) => {
    s.money += fx.money ?? 0; s.mood += fx.mood ?? 0; s.energy += fx.energy ?? 0;
    s.xp += fx.xp ?? 0; s.skill += fx.skill ?? 0; s.network = Math.max(0, s.network + (fx.network ?? 0));
    if (fx.money && fx.money > 0) s.earned += fx.money;
    if (fx.rel) { const m = { ...memOf(s.npcMem ?? {}, npcName) }; m.rel = Math.max(-100, Math.min(100, m.rel + fx.rel)); s.npcMem = { ...(s.npcMem ?? {}), [npcName]: m }; }
  };
  const fxText = (fx: StoryFx) => [
    fx.money ? `${fx.money > 0 ? "+" : "-"}${fmt(Math.abs(fx.money))}` : "", fx.mood ? `${en ? "Mood" : "心情"} ${fx.mood > 0 ? "+" : ""}${fx.mood}` : "",
    fx.energy ? `${en ? "Energy" : "能量"} ${fx.energy}` : "", fx.xp ? `${en ? "XP" : "经验"} +${fx.xp}` : "", fx.skill ? `${en ? "Skill" : "技能"} +${fx.skill}` : "",
    fx.network ? `${en ? "Network" : "人脉"} ${fx.network > 0 ? "+" : ""}${fx.network}` : "", fx.rel ? `${en ? "Bond" : "关系"} +${fx.rel}` : "",
  ].filter(Boolean).join(" · ");
  const openStory = () => {
    const s0 = gsRef.current; const name = npcChat; if (!s0 || !name) return;
    const story = storyOf(name); if (!story) return;
    const tb = timeBlock("story", s0); if (tb) { showToast(`⏰ ${tb}。`); return; }
    const st = storyStatus(story, s0.story?.[name], memOf(s0.npcMem ?? {}, name).rel, s0.day);
    if (st.kind === "ready") {
      setStoryOpen(name);
      setNpcLog((log) => [...log, { from: "npc", text: `📖 ${en ? `Chapter ${st.idx + 1}/${st.total}` : `第 ${st.idx + 1}/${st.total} 章`} · ${L(st.chapter.title)}\n${L(st.chapter.text)}` }]);
    } else if (st.kind === "ending") {
      const prog = s0.story?.[name] ?? { ch: 0, day: 0, flags: [] };
      const end = story.ending(prog.flags);
      mutate((s) => {
        applyStoryFx(s, name, end.fx);
        s.story = { ...(s.story ?? {}), [name]: { ...prog, done: end.title, day: s.day } };
        s.busyUntil = Date.now() + cooldownMs(actionMinutes("story")); s.busyWhat = "聊天"; s.lastActiveDay = s.day;
        s.npcNews = [...(s.npcNews ?? []), { kind: "home" as const, text: `见证了${name}的故事「${end.title}」`, day: s.day }];
      });
      setNpcLog((log) => [...log, { from: "npc", text: `🏁 ${en ? "Ending" : "结局"} · ${L(end.title)}\n${L(end.text)}` }]);
      const fxs = fxText(end.fx);
      showToast(en ? `🏁 ${L(story.title)} · ${L(end.title)}${fxs ? ` (${fxs})` : ""}. This story goes into your ending: +2 legacy points.` : `🏁 ${story.title} · ${end.title}${fxs ? `（${fxs}）` : ""}。这个故事会写进你的结局，档案点 +2。`);
      addLog(`📖 ${name}的故事「${story.title}」结局：${end.title}。`);
      track("story_end", { npc: name });
      floatReward(`📖 ${L(end.title)}`, "gold");
    }
  };
  const chooseStory = (idx: number) => {
    const s0 = gsRef.current; const name = storyOpen; if (!s0 || !name) return;
    const story = storyOf(name); if (!story) return;
    const prog = s0.story?.[name] ?? { ch: 0, day: 0, flags: [] };
    const ch = story.chapters[prog.ch]; const choice = ch?.choices[idx];
    if (!ch || !choice) return;
    if ((choice.fx.money ?? 0) < 0 && s0.money < -(choice.fx.money ?? 0)) { showToast(`这个选择要 ${fmt(-(choice.fx.money ?? 0))}，钱包不够。`); return; }
    if ((choice.fx.energy ?? 0) < 0 && s0.energy < -(choice.fx.energy ?? 0)) { showToast("能量不够了，先歇歇或吃点东西。"); return; }
    mutate((s) => {
      applyStoryFx(s, name, choice.fx);
      s.story = { ...(s.story ?? {}), [name]: { ch: prog.ch + 1, day: s.day, flags: choice.flag ? [...prog.flags, choice.flag] : prog.flags } };
      s.busyUntil = Date.now() + cooldownMs(actionMinutes("story")); s.busyWhat = "聊天"; s.lastActiveDay = s.day;
    });
    setStoryOpen(null);
    setNpcLog((log) => [...log, { from: "me", text: L(choice.label) }, { from: "npc", text: L(choice.reply) }]);
    const fxs = fxText(choice.fx);
    const last = prog.ch + 1 >= story.chapters.length;
    showToast(en
      ? `📖 ${L(story.title)} · chapter ${prog.ch + 1} done${fxs ? ` (${fxs})` : ""}. ${last ? `Come back to ${trText(name)} tomorrow for the ending.` : `More tomorrow — get a little closer to ${trText(name)} to unlock the next chapter.`}`
      : `📖 ${story.title} · 第 ${prog.ch + 1} 章完${fxs ? `（${fxs}）` : ""}。${last ? `明天再来找${name}，看看结局。` : `后续明天揭晓——和${name}关系再近一些就能看下一章。`}`);
    addLog(`📖 ${name}：${ch.title}——你选了「${choice.label}」。`);
    track("story_chapter", { npc: name, ch: prog.ch + 1 });
  };

  /* ---------- 独立玩法：活动、组局、约会 ---------- */
  const L2t = (x: [string, string]) => (en ? x[1] : x[0]);
  const NO_PARTY = new Set(["license", "rentcar", "antiscam", "farejump", "scalp", "daijia", "rideshare"]);
  const actBlock = (a: Activity, s: GameState, here: boolean, loc?: Loc): string | null => {
    if (!here) return en ? "Get there first" : "到了才能玩";
    if (s.busyUntil && Date.now() < s.busyUntil) return en ? `Busy (${s.busyWhat ?? ""}) — ${countdown(s.busyUntil - Date.now())} left` : `正在${s.busyWhat ?? "忙"}，还要 ${countdown(s.busyUntil - Date.now())}`;
    const now = nowMin();
    if (a.hours && !inWindow(now, a.hours)) return en ? `Only ${windowStr(a.hours)} (Beijing time)` : `北京时间 ${windowStr(a.hours)} 才能玩`;
    const vc = loc ? venueClosed(loc) : null;
    if (vc) return en ? "Closed right now" : vc;
    if (a.cost > 0 && s.money < a.cost) return en ? `Needs ¥${a.cost}` : `要 ¥${a.cost}，钱不够`;
    if (a.energy > 0 && s.energy < a.energy) return en ? "Not enough energy" : "能量不够了";
    if (a.needs === "license" && (s.license ?? 0) < 3) return en ? "Needs a driving licence" : "要先考到驾照";
    if (a.needs === "car" && !((s.license ?? 0) >= 3 && (s.carOwned || s.carDay === s.day))) return en ? "No car today — rent one at a station" : "今天没车：去车站租一天";
    if (a.needs === "notLicensed" && (s.license ?? 0) >= 3) return en ? "You already have a licence" : "已经有驾照了";
    if (a.id === "license" && s.licDay === s.day) return en ? "One test a day" : "一天只能考一科";
    if (a.id === "rentcar" && (s.carOwned || s.carDay === s.day)) return en ? "You already have a car today" : "今天已经有车了";
    return null;
  };
  const datePartners = (s: GameState) => npcsForCity(s.cityKey).filter((n) => memOf(s.npcMem ?? {}, n.name).rel >= 15 || (s.romance?.[n.name] ?? 0) > 0);
  const specFor = (a: Activity): GameSpec => (a.cat === "date" && a.game.type === "quiz" ? { ...a.game, questions: [...DATE_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 3) } : a.game);
  const startActivity = (a: Activity, opts: { partyId?: number; mate?: string; locId?: string } = {}) => {
    const s0 = gsRef.current; if (!s0 || play) return;
    const here = !walking && !carriage && currentLocRef.current === (opts.locId ?? selectedLoc);
    const why = actBlock(a, s0, here, locById(opts.locId ?? selectedLoc));
    if (why) { showToast(`⏰ ${why}${en ? "." : "。"}`); return; }
    if (a.needs === "date" && !opts.mate) {
      if (datePartners(s0).length === 0) { showToast(en ? "Nobody to ask yet — get to know a neighbour first (bond +15)." : "还没有能约的人：先和街坊混熟（关系到 +15）。"); return; }
      setDatePick(a); return;
    }
    setPlay({ act: a, spec: specFor(a), ...(opts.partyId ? { partyId: opts.partyId } : {}), ...(opts.mate ? { mate: opts.mate } : {}) });
  };
  const ACT_ANIM: Record<string, LifeKind> = { climb: "hike", trail: "hike", surf: "beach", dive: "beach", seawalk: "beach", "volunteer-clean": "beach", kite: "stroll", cycle: "stroll", photo: "stroll", run: "gym", hoops: "gym", ktv: "gathering", drink: "gathering", bar: "gathering", club: "gathering", bizktv: "gathering", livehouse: "gathering", mahjong: "gathering", jubensha: "gathering", skewers: "eat", dinner: "eat", teahouse: "eat", themedate: "coaster", claw: "shopping", catcafe: "shopping", movie: "shopping" };
  const finishActivity = (r: GameResult) => {
    const p = play; const s0 = gsRef.current; if (!p || !s0) return;
    setPlay(null);
    const a = p.act;
    const loc = locById(currentLocRef.current);
    const party = p.partyId ? parties.find((x) => x.id === p.partyId) : undefined;
    const mates = party ? party.members.filter((m) => m.id !== myPubRef.current).length : 0;
    const out = resolveActivity(a, r, { payMul: CITIES[s0.cityKey].payMul, mates, locId: loc.id, locName: en ? trText(loc.name) : loc.name });
    let stageMsg = "";
    mutate((s) => {
      s.money += out.money - a.cost; s.earned += out.money; s.energy -= out.energy; s.mood += out.mood;
      s.xp += out.xp; s.skill += out.skill; s.fit += out.fit; s.network += out.network;
      s.busyUntil = Date.now() + cooldownMs(out.minutes, (s.perks ?? []).includes("route")); s.busyWhat = a.name[0]; s.lastActiveDay = s.day;
      s.actCount = (s.actCount ?? 0) + 1;
      if (mates > 0) s.partyPlays = (s.partyPlays ?? 0) + 1;
      if (out.drop?.food) s.groceries += 1;
      if (a.id === "license") {
        s.licDay = s.day;
        if (out.passedLicense) { s.license = Math.min(3, (s.license ?? 0) + 1); stageMsg = s.license >= 3 ? (en ? "🪪 Licence acquired! Rent a car at a station, then pick \"Drive\" when travelling." : "🪪 拿到驾照了！去车站租车，出行就能选「自驾」。") : (en ? `🪪 Test ${s.license}/3 passed — next one tomorrow.` : `🪪 科目 ${s.license}/3 通过，明天考下一科。`); }
      }
      if (a.id === "rentcar") s.carDay = s.day;
      if (p.mate) {
        const before = romanceStage(s.romance?.[p.mate] ?? 0);
        const pts = Math.max(0, (s.romance?.[p.mate] ?? 0) + out.romance);
        s.romance = { ...(s.romance ?? {}), [p.mate]: pts };
        const m = { ...memOf(s.npcMem ?? {}, p.mate) }; m.rel = Math.max(-100, Math.min(100, m.rel + out.rel)); m.lastDay = s.day; s.npcMem = { ...(s.npcMem ?? {}), [p.mate]: m };
        const after = romanceStage(pts);
        if (after > before) {
          const st = ROMANCE_STAGES[after]!;
          stageMsg = en ? `💕 You and ${trText(p.mate)}: ${st.name[1]}!` : `💕 你和${p.mate}：${st.name[0]}！`;
          if (after >= 3 && !s.cohabit) { s.cohabit = true; s.rent = Math.round(s.rent / 20) * 10; s.baseRent = Math.round(s.baseRent / 20) * 10; stageMsg += en ? " Living together halves your rent." : "搬到一起住，房租减半。"; }
          s.npcNews = [...(s.npcNews ?? []), { kind: "home" as const, text: after >= 3 ? `和${p.mate}住到了一起` : after >= 2 ? `和${p.mate}在一起了` : `和${p.mate}有点暧昧`, day: s.day }];
        }
      }
      if (out.risk) {
        const k = out.risk.kind;
        if (k === "police") { s.money -= out.risk.fine; s.mood -= 15; s.record = (s.record ?? 0) + 1; s.busyUntil = Date.now() + 20 * 60_000; s.busyWhat = "在派出所做笔录"; }
        else if (k === "injury") { s.energy -= 25; s.money -= out.risk.fine; s.mood -= 8; }
        else if (k === "hangover") s.hangover = true;
        else if (k === "scam") { s.money -= out.risk.fine; s.mood -= 12; }
      }
    });
    let firstFind = false;
    if (out.drop) { const key = out.drop.key; updMeta((m) => { firstFind = !m.collect[key]; m.collect = { ...m.collect, [key]: (m.collect[key] ?? 0) + 1 }; }); }
    const fx = [out.money ? `+${fmt(out.money)}` : "", a.cost ? `-${fmt(a.cost)}` : "", out.mood ? `${en ? "Mood" : "心情"} ${out.mood > 0 ? "+" : ""}${out.mood}` : "",
      out.xp ? `${en ? "XP" : "经验"} +${out.xp}` : "", out.skill ? `${en ? "Skill" : "技能"} +${out.skill}` : "", out.fit ? `${en ? "Fitness" : "体质"} +${out.fit}` : "", out.network ? `${en ? "Network" : "人脉"} +${out.network}` : ""].filter(Boolean).join(" · ");
    const dropTxt = out.drop ? (en ? ` 🎁 ${out.drop.emoji} ${out.drop.name[1]}${firstFind ? " — new in your collection!" : ""}` : ` 🎁 ${out.drop.emoji} ${out.drop.name[0]}${firstFind ? "（图鉴新增！）" : ""}`) : "";
    showToast(`${a.emoji} ${L2t(out.line)}${fx ? (en ? ` (${fx})` : `（${fx}）`) : ""}${dropTxt}`);
    addLog(`${a.emoji} ${a.name[0]}：${out.line[0]}${out.drop ? ` 收获${out.drop.name[0]}。` : ""}`);
    if (out.money) floatReward(`+${fmt(out.money)}`, "gold");
    if (out.mood >= 6) floatReward(`${en ? "Mood" : "心情"} +${out.mood}`, "green");
    if (out.drop) floatReward(`${out.drop.emoji} ${L2t(out.drop.name)}`, "blue");
    let delay = 3600;
    if (out.risk) { const rk = out.risk; window.setTimeout(() => showToast(`${{ police: "🚓", injury: "🩹", hangover: "🍺", scam: "💸" }[rk.kind]} ${L2t(rk.text)}${rk.fine ? ` -${fmt(rk.fine)}` : ""}${rk.kind === "police" ? (en ? " A record follows you: big companies' background checks may fail." : " 留下案底：大厂背调可能过不了。") : ""}`), delay); addLog(`⚠️ ${rk.text[0]}`); delay += 3600; }
    if (stageMsg) window.setTimeout(() => showToast(stageMsg), delay);
    if (out.drop && firstFind) { const hit = dropById(out.drop.key); if (hit && hit.item.rarity === 3) postFeed("life", `${a.name[0]}收获了稀有的${hit.item.name[0]}`); }
    track("activity", { id: a.id, tier: out.tier, party: mates > 0, drop: !!out.drop, risk: out.risk?.kind ?? "" });
    const anim = ACT_ANIM[a.id];
    if (anim) playLifeAnim(anim);
    if (p.partyId && profileRef.current) {
      const pid = p.partyId;
      setPartyResult(pid);
      void api.submitPartyScore({ playerId: profileRef.current.playerId, partyId: pid, score: Math.round(out.score * 100) / 100 }).then(() => partiesQuery.refetch()).catch(() => {});
    }
  };
  const hostParty = (a: Activity) => {
    const s0 = gsRef.current; const prof = profileRef.current; if (!s0 || !prof) return;
    const loc = locById(selectedLoc);
    void api.createParty({ playerId: prof.playerId, cityKey: s0.cityKey, locId: loc.id, locName: loc.name, activityId: a.id, title: a.name[0] }).then((r) => {
      if (!r.ok) { if (r.error?.includes("绑定账号")) setAccountOpen(true); showToast(r.error ?? (en ? "Couldn't open the party." : "组局失败了。")); return; }
      showToast(en ? `🎉 Party open: ${a.name[1]} at ${trText(loc.name)}. Everyone in the city can see it — start when you're ready; neighbours fill empty seats.` : `🎉 组局成功：在${loc.name}${a.name[0]}。同城玩家都能看到；人到了就开始，没人来街坊会来凑数。`);
      void partiesQuery.refetch(); setPartyOpen(true); track("party_create", { act: a.id });
    }).catch(() => showToast(en ? "Network hiccup — try again." : "网络不太好，再试一次。"));
  };
  const joinPartyNow = (pt: (typeof parties)[number]) => {
    const prof = profileRef.current; if (!prof) return;
    void api.joinParty({ playerId: prof.playerId, partyId: pt.id }).then((r) => {
      if (!r.ok) { if (r.error?.includes("绑定账号")) setAccountOpen(true); showToast(r.error ?? ""); return; }
      track("party_join", { act: pt.activityId });
      void partiesQuery.refetch();
      if (currentLocRef.current !== pt.locId) { showToast(en ? `Joined! Heading to ${trText(pt.locName)}…` : `加入了！正在赶去${pt.locName}……`); setPartyOpen(false); setSelectedLoc(pt.locId); walkTo(pt.locId); }
      else showToast(en ? "Joined! Wait for the host to start." : "加入了！等发起人开始。");
    }).catch(() => {});
  };
  const leavePartyNow = (pt: (typeof parties)[number]) => { const prof = profileRef.current; if (!prof) return; void api.leaveParty({ playerId: prof.playerId, partyId: pt.id }).then(() => partiesQuery.refetch()); };
  const startPartyNow = (pt: (typeof parties)[number]) => {
    const prof = profileRef.current; if (!prof) return;
    void api.startParty({ playerId: prof.playerId, partyId: pt.id }).then((r) => {
      if (!r.ok) { showToast(r.error ?? ""); return; }
      void partiesQuery.refetch().then(() => { const a = activityById(pt.activityId); if (a) { setPartyOpen(false); startActivity(a, { partyId: pt.id, locId: pt.locId }); } });
    });
  };
  /* NPC companions for a party nobody joined: deterministic per party */
  const ghostMates = (pid: number) => { const pool = npcsForCity(gsRef.current?.cityKey ?? "sz").slice().sort((x, y) => ((hashStr(x.name + pid) % 97) - (hashStr(y.name + pid) % 97))); return pool.slice(0, 2).map((n, i) => ({ id: `npc-${n.name}`, name: n.name, emoji: n.emoji, score: ((hashStr(`${n.name}:${pid}:${i}`) % 70) + 25) / 100, buddy: 0 })); };

  /* ---------- 点人：名片、私信、邀请组局、拉黑举报 ---------- */
  const pickActor = (who: { npc: string } | { player: string }) => {
    if ("npc" in who) { const name = who.npc.split("·")[0]!; if (NPCS.some((n) => n.name === name)) openNpcChat(name); return; }
    setCardOf(who.player);
  };
  const openDm = (peer: string) => {
    setCardOf(null); setDmPeer(peer); setDmOpen(true);
    const prof = profileRef.current;
    if (prof) void api.markDmRead({ playerId: prof.playerId, peerId: peer }).then(() => inboxQuery.refetch());
  };
  const sendDmNow = (peer: string, body: string) => {
    const prof = profileRef.current; if (!prof || !body.trim()) return;
    void api.sendDm({ playerId: prof.playerId, toId: peer, body: body.trim() }).then((r) => {
      if (!r.ok) { if (r.error?.includes("绑定账号")) setAccountOpen(true); showToast(r.error ?? (en ? "Message not sent." : "没发出去。")); return; }
      setDmInput(""); void inboxQuery.refetch(); track("dm_send");
    }).catch(() => showToast(en ? "Network hiccup — try again." : "网络不太好，再试一次。"));
  };
  const inviteToParty = (peer: string) => {
    const mine = parties.find((pt) => pt.status === "open" && pt.hostId === myPubRef.current);
    if (!mine) { showToast(en ? "Open a party first: pick a place, then 👥 under \"Things to do here\"." : "先组个局：去一个地点，在「在这里能玩」里点 👥 组局。"); return; }
    sendDmNow(peer, `[[party:${mine.id}]]`);
    showToast(en ? "Invite sent." : "邀请已发出。");
  };
  const blockNow = (peer: string, block: boolean) => {
    const prof = profileRef.current; if (!prof) return;
    void api.blockPlayer({ playerId: prof.playerId, targetId: peer, block }).then(() => { showToast(block ? (en ? "Blocked: they can't message you any more." : "已拉黑：对方不能再给你发消息。") : (en ? "Unblocked." : "已取消拉黑。")); void cardQuery.refetch(); void inboxQuery.refetch(); if (block) { setDmOpen(false); setDmPeer(null); } });
  };
  const reportNow = (peer: string, reason: "harassment" | "scam" | "spam" | "inappropriate" | "minor" | "other") => {
    const prof = profileRef.current; if (!prof) return;
    void api.reportPlayer({ playerId: prof.playerId, targetId: peer, reason }).then(() => showToast(en ? "Report sent. Moderators will review the conversation. You can also block them." : "举报已提交，管理员会查看你们的聊天记录。你也可以直接拉黑。"));
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
    onSuccess: (r) => {
      if (!r.ok) { showToast(r.error ?? "没发出去，稍后再试。"); return; }
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

  /* A company HQ: work there if it is your employer, otherwise interview /
     take the offer. Other place actions (e.g. 平安's 理财) stay underneath. */
  const companyActions = (co0: Company, s: GameState): ActDef[] => {
    const co = effCompany(co0, todayEvent, s.referrals);
    const mates = (world?.online ?? []).filter((p) => p.id !== myId && p.employer === co.id && p.cityKey === s.cityKey).map((p) => p.name);
    const base = basePay(s);
    const fitSave = s.fit >= 3 ? 3 : 0;
    const career = CAREERS[s.careerIdx] ?? CAREERS[0]!;
    if (employerHere(s)?.id === co.id) {
      const cost = co.energy - fitSave;
      const otCost = co.energy + 14 - fitSave;
      return [
        { kind: "work", title: "正经上班", emoji: co.emoji, desc: `${co.short}的一天 · 职级「${career.name}」 · 工资 ×${+(career.mul * co.payMul).toFixed(2)} · 经验 +2${mates.length ? ` · 👥 同事在线：${mates.slice(0, 3).join("、")}（一起上班心情 +3）` : ""}${todayEvent.payMul ? " · 💰 今天发奖金 ×1.3" : ""}`, cost: `+${fmt(Math.round(base * co.payMul))} · 能量 -${cost}${co.mood ? ` · 心情 ${co.mood > 0 ? "+" : ""}${co.mood}` : ""}`, disabled: s.energy < cost },
        { kind: "overtime", title: "拼命加班", emoji: "🔥", desc: co.otMul > 1 ? "加班费比别家给得多，但人是真的累" : "老板画饼你吃饼，钱多但掉心情", cost: `+${fmt(Math.round(base * co.payMul * 1.75 * co.otMul))} · 能量 -${otCost} · 心情 -12`, disabled: s.energy < otCost },
        ...(co.canteen ? [{ kind: "canteen", title: "员工食堂吃饭", emoji: "🍱", desc: "刷工卡，几块钱吃到饱，大厂福利之一", cost: "-¥12 · 能量 +22 · 心情 +4", disabled: s.money < 12 }] : []),
      ];
    }
    const cur = companyById(s.employer);
    const tried = (s.interviews ?? []).includes(`${s.day}:${co.id}`);
    const gaps = companyGaps(co, s);
    const payNow = Math.round(base * cur.payMul);
    const payThere = Math.round(base * co.payMul);
    return [
      (s.offers ?? []).includes(co.id)
        ? { kind: "join-company", title: `接受 offer · 入职${co.short}`, emoji: "🤝", desc: `从「${cur.short}」跳槽过来。${co.culture}`, cost: `日薪 ${fmt(payThere)}（现在 ${fmt(payNow)}）· 上班能量 -${co.energy - fitSave}` }
        : { kind: "interview", title: tried ? `今天已经面过${co.short}了` : `投简历 · 面试${co.short}`, emoji: "📝", desc: `${co.culture}${todayEvent.openDay === co.id ? " 🏢 今天开放日，门槛降低！" : ""}${(s.referrals ?? []).includes(co.id) ? " 🤝 你有内推，门槛降低。" : ""}${gaps.length > 0 ? ` 门槛还差：${gaps.join("、")}。` : " 你的条件已经够了。"}${co.formal ? " 面试要穿正装。" : ""}`, cost: `能量 -12 · 日薪约 ${fmt(payThere)}（现在 ${fmt(payNow)}）· 每家每天一次`, disabled: tried || s.energy < 12 },
      { kind: "campus-tour", title: "在园区逛逛", emoji: "👀", desc: "看看大厂的楼、咖啡厅和来来往往的打工人", cost: "能量 -3 · 心情 +6 · 免费" },
    ];
  };
  const actionsFor = (loc: Loc, s: GameState): ActDef[] => {
    const co = companyAt(s.cityKey, loc.id);
    const acts = co ? [...companyActions(co, s), ...(loc.type === "work" ? [] : baseActionsFor(loc, s))] : baseActionsFor(loc, s);
    const ev = todayEvent;
    acts.unshift(...routineActs(loc, s));
    const tn = nowMin();
    for (const r of CROSS_ROUTES) {
      if (r.from !== s.cityKey || r.fromLoc !== loc.id) continue;
      const open = isCrossOpen(r, tn);
      const toShort = getLocations(r.to).find((l) => l.id === r.toLoc)?.short ?? "";
      acts.push({ kind: `__cross-${r.id}`, title: `${r.emoji} ${crossName(r, en)}`, emoji: "🧭", desc: en ? `To ${CITY_EN[r.to]}: ${crossNote(r, true)}` : `去${CITIES[r.to].name}（到${toShort}）：${r.note}`, cost: r.shut ? crossHoursStr(r, en) : `${crossFareStr(r, en)} · ${r.min} ${en ? "min" : "分钟"} · ${open ? crossHoursStr(r, en) : `${en ? "Not running" : "已停"} · ${crossHoursStr(r, en)}`}`, disabled: !open });
    }
    return acts.map((a) => {
      if (ev.beachClosed && isBeachLoc(loc) && (a.kind === "fun" || a.kind === "checkin" || a.kind === "stroll")) return { ...a, disabled: true, desc: "🌀 台风预警，海边今天封闭，改天再来" };
      if (ev.mallMul && (a.kind === "mall-shop" || a.kind === "mall-cloth")) return { ...a, desc: `🛍️ 今日大促 6 折 · ${a.desc}` };
      if (ev.eatMul && a.kind === "eat") return { ...a, desc: `🍢 美食节 7 折、心情 +5 · ${a.desc}` };
      if (ev.funMood && a.kind === "fun") return { ...a, desc: `🎶 音乐会，心情额外 +8 · ${a.desc}` };
      return a;
    });
  };
  const baseActionsFor = (loc: Loc, s: GameState): ActDef[] => {
    const base = basePay(s);
    const city = CITIES[s.cityKey];
    const fitSave = s.fit >= 3 ? 3 : 0;
    switch (loc.type) {
      case "home":
        return [
          { kind: "__sleep", title: "睡一觉", emoji: "😴", desc: "每天第一次睡觉回满能量；日子跟着北京时间走，睡觉不会跳到明天", cost: "能量回满" },
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
            { kind: "__gocity-sz", title: "看看所有回深圳的路", emoji: "🧭", desc: "罗湖、落马洲、香园围、皇岗巴士、高铁、蛇口船……按真实开放时间挑一条", cost: "免费过关 ~ HK$120 · 进度不变" },
            { kind: "rest", title: "在口岸歇会儿", emoji: "🧋", desc: "看人来人往过关，买杯水坐一会儿", cost: "能量 +14 · 心情 +8 · 免费" },
          ] : [
            { kind: "hk-trip", title: "过关去香港一日游", emoji: "🇭🇰", desc: "旺角、天星小轮、茶餐厅，过关当天来回", cost: `-${Y}180 · 心情 +22 · 能量 -16 · 人脉 +1`, disabled: s.money < 180 },
            { kind: "__gocity-hk", title: "看看所有去香港的路", emoji: "🧭", desc: "罗湖、福田、皇岗（24 小时）、深圳湾、莲塘、高铁、蛇口船——按真实开放时间挑一条，搬过去住一段", cost: "免费过关 ~ ¥220 · 进度不变" },
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
        const mulTxt = mul > 1 ? `，今天收入 ×${mul}` : "，峰会周（14–19 日）重点日收入 ×1.5";
        const task = apecTaskOfDay(s.day);
        const checked = (s.apecCheckins ?? []).includes(loc.id);
        const taskDone = task ? (s.apecTasks ?? []).includes(task.id) : false;
        return [
          { kind: "apec-checkin", title: checked ? "会场打卡 ✓ 已完成" : "📸 会场打卡", emoji: "📸", desc: checked ? "这个会场已经在你的 峰会打卡册里了" : `在${loc.short}地标前打卡，集齐三个会场（已打卡 ${(s.apecCheckins ?? []).length} / 3）`, cost: "心情 +6 · 免费", disabled: checked },
          ...(task && task.venueLocId === loc.id ? [{ kind: "apec-task", title: taskDone ? `今日任务 ✓ ${task.title}` : `${task.roleEmoji} 今日任务：${task.title}`, emoji: task.roleEmoji, desc: taskDone ? "今天的班已经上完了，明天还有新任务" : `${task.dateLabel} · ${task.event}——你当${task.role}。${checked ? task.desc : "先打卡，再上岗。" + task.desc}`, cost: taskDone ? "已完成" : `+${fmt(Math.round(base * task.payMul))} · 能量 -${task.energy} · 经验 +${task.xp} · 人脉 +${task.network}`, disabled: taskDone || !checked || s.energy < task.energy }] : []),
          { kind: "apec-staff", title: "会务服务兼职", emoji: "🎪", desc: `布展、引导、物料分发——以工作人员身份参与${mulTxt}`, cost: `+${fmt(Math.round(base * 0.9 * mul))} · 能量 -22 · 经验 +2`, disabled: s.energy < 22 },
          { kind: "apec-host", title: "外宾接待引导", emoji: "🌐", desc: s.skill < 1 ? "需要技能 ≥1（先去图书馆/夜校学一课）" : `陪代表团参观、答疑、引导，最锻炼人也最长脸${mulTxt}`, cost: `+${fmt(Math.round(base * 1.25 * mul))} · 能量 -20 · 经验 +3 · 人脉 +1`, disabled: s.energy < 20 || s.skill < 1 },
          { kind: "apec-visit", title: "参观主题展陈", emoji: "🎫", desc: "各方嘉宾带来的展陈挨个看，集章、看会徽背后的故事", cost: `-${Y}20 · 心情 +10 · 可能 +人脉` },
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
      case "service":
        if (loc.placeKind === "pharmacy") return [
          { kind: "buy-medicine", title: "买点常备药", emoji: "💊", desc: "感冒药、肠胃药、创可贴、防晒，药师会帮你挑；外籍人士可以把症状写在手机上给药师看", cost: "-¥35 · 能量 +10 · 心情 +2", disabled: s.money < 35 },
          { kind: "ask-help", title: "问问药师", emoji: "🧑‍⚕️", desc: "小毛病先问药师，要不要去医院、去哪家近，药师门儿清", cost: "心情 +3 · 免费" },
        ];
        if (loc.placeKind === "police") return [
          { kind: "ask-help", title: "问路 / 求助", emoji: "🚓", desc: "迷路、丢东西、遇到麻烦都可以进来；紧急情况直接打 110", cost: "心情 +3 · 免费" },
          { kind: "rest", title: "在门口歇会儿", emoji: "🪑", desc: "派出所门口最安心", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
        return [
          { kind: "tourist-map", title: "领一份中英文地图", emoji: "🗺️", desc: "地铁图、景点、医院和应急电话都印在上面，参会代表和游客都用得上", cost: "心情 +4 · 免费" },
          { kind: "volunteer", title: "当一会儿志愿者", emoji: "🎽", desc: isApecWeek(s.day) ? "峰会周人手紧：帮外宾指路、翻译、找地铁站" : "帮游客指路、答疑", cost: `能量 -10 · 人脉 +1 · 经验 +1${isApecWeek(s.day) ? " · 心情 +8" : ""}`, disabled: s.energy < 10 },
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
const myId = myPub;
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
{(() => { const cur = employerHere(s); const base = basePay(s); return (
<div className="mt-4 border-t border-[var(--line)] pt-3">
<p className="text-sm">现在在：<b>{cur ? `${cur.emoji} ${cur.name}` : "🏭 仲恺公司"}</b> · 日薪 {fmt(Math.round(base * (cur?.payMul ?? 1)))}{companyById(s.employer).id !== (cur?.id ?? "") && companyById(s.employer).id !== "startup" ? `（${companyById(s.employer).short}的工牌在${CITIES[companyById(s.employer).city ?? "sz"].name}用）` : ""}</p>
<p className="mt-0.5 text-xs text-[var(--dim)]">想跳槽：去大厂总部「投简历 · 面试」，条件够就拿 offer，再点「接受 offer」入职。每家每天能面一次。</p>
<div className="mt-2 grid gap-2">
{COMPANIES.filter((c) => (c.city ?? "sz") === s.cityKey && c.id !== cur?.id && c.id !== "startup").map((c0) => { const c = effCompany(c0, todayEvent, s.referrals); const gaps = companyGaps(c, s); const offer = (s.offers ?? []).includes(c.id); const loc = locById(c.locIds[0]!); return (
<div key={c.id} className="flex items-center gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
<div className="text-2xl">{c.emoji}</div>
<div className="min-w-0 flex-1">
<p className="text-sm font-bold">{c.name} <span className="text-[var(--accent)]">日薪约 {fmt(Math.round(base * c.payMul))}</span></p>
<p className="text-xs text-[var(--dim)]">{offer ? "✅ 已拿到 offer，去总部点「接受 offer」" : gaps.length === 0 ? `✅ 条件够了，可以去面试${c.formal ? "（要穿正装）" : ""}` : `还差：${gaps.join("、")}`} · 上班能量 -{c.energy}{c.mood ? ` · 心情 ${c.mood > 0 ? "+" : ""}${c.mood}` : ""}</p>
</div>
<button type="button" aria-label={`去${loc.name}`} onClick={() => { setPhoneOpen(false); walkTo(loc.id); }} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">去{c.short}</button>
</div>
); })}
</div>
</div>
); })()}
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
{(() => { const st0 = storyOf(n.name); if (!st0) return null; const k = storyStatus(st0, s.story?.[n.name], mem.rel, s.day); return <p className={`text-[11px] font-bold ${k.kind === "ready" || k.kind === "ending" ? "text-[var(--accent)]" : "text-[var(--dim)]"}`}>{en ? `📖 "${L(st0.title)}" ${k.kind === "done" ? `· Ending: ${L(k.title)}` : k.kind === "ending" ? "· The ending is ready!" : k.kind === "ready" ? `· Chapter ${k.idx + 1} is ready!` : k.kind === "tomorrow" ? "· More tomorrow" : `· Bond +${k.need} unlocks the next chapter`}` : `📖「${st0.title}」${k.kind === "done" ? `· 结局：${k.title}` : k.kind === "ending" ? "· 结局可以看了！" : k.kind === "ready" ? `· 第 ${k.idx + 1} 章可以看了！` : k.kind === "tomorrow" ? "· 明天有后续" : `· 关系到 +${k.need} 解锁下一章`}`}</p>; })()}
</div>
<button type="button" aria-label={`找${n.name}聊天`} onClick={() => { setPhoneOpen(false); openNpcChat(n.name); }} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-2 text-xs font-black text-[var(--bg)]">
💬 聊天
</button>
</div>
); })}
</div>
<p className="mt-3 text-[11px] leading-relaxed text-[var(--dim)]">他们每天还会在右侧「🧑‍🤝‍🧑 街坊墙」发动态、互相评论——天气、峰会、你升职这种大事，他们都会聊。聊天、帮忙、送礼物都会被记住，第二天打招呼就不一样。</p>
</div>
);
case "cal": {
const days = Array.from({ length: seasonLen }, (_, i) => i + 1);
return (
<div>
<div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-[var(--dim)]">
{["一", "二", "三", "四", "五", "六", "日"].map((d) => <div key={d}>周{d}</div>)}
</div>
<div className="mt-1 grid grid-cols-7 gap-1">
{days.map((d) => (
<div key={d} className={`rounded-[8px] border px-0 py-1.5 text-center text-xs font-bold ${d === s.day ? "border-[var(--accent)] bg-[var(--accent)] text-white" : isApecWeek(d) && s.cityKey === "sz" ? "border-[var(--gold)] bg-[#fdf3d0] text-[#7a5b00]" : "border-[var(--line)]"}`}>
{d}
<div className="text-[9px] font-normal opacity-80">{isSaturday(d) ? "交租" : isApecWeek(d) && s.cityKey === "sz" ? "峰会" : weekday(d).replace("周", "")}</div>
</div>
))}
</div>
<p className="mt-2 text-xs text-[var(--dim)]">{isApecSeason() ? "本月就是 11 月：14 日湾区峰会周开启，16 日太子湾欢迎晚宴，17–18 日前海工商峰会，18–19 日香蜜湖峰会主会议。每周六睡前交租。" : `本赛季是 ${seasonMo} 月：月底全服结算。每周六睡前交租。`}</p>
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
<p className="mt-1 text-[11px] font-black tracking-wide text-[var(--dim)]">游戏内日历（{seasonMo} 月赛季的剧情天气，和上面的实况是两回事）</p>
{Array.from({ length: 7 }, (_, i) => s.day + i).filter((d) => d <= seasonLen).map((d) => (
<p key={d} className="flex justify-between rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm">
<span>{seasonMo} 月 {d} 日 · {weekday(d)}{d === s.day ? "（今天）" : ""}</span><b>{weatherOf(d, s.cityKey)}</b>
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
["干饭次数", `${s.mealCount} 次`], ["最高存款", fmt(s.maxMoney)], ["峰会服务", `${s.apecCount} 次`], [s.cityKey === "hz" ? "坐城轨/高铁" : s.cityKey === "hk" ? "坐港铁" : "坐地铁", `${s.metroRides ?? 0} 次`], ["风景打卡", `${(s.visitedScenic ?? []).length} / ${scenicTotal(s.cityKey)} 处`],
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
<p className="mt-4 text-sm font-bold">🎉 峰会周活动 · {APEC_SLOGAN}</p>
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
<p className="mt-3 text-xs leading-relaxed text-[var(--dim)]">日程：湾区国际峰会周 11 月 14 日开启；欢迎晚宴 16 日晚在南山太子湾海景酒店；工商峰会 17–18 日在前海国际会议中心；峰会主会议 18–19 日在福田香蜜湖的深圳国际交流中心。各方嘉宾云集（虚构活动，不代表任何真实会议）。峰会周不对公众开放——游戏里你只能以志愿者、会务、接待、司机身份参与，这也是现实里普通人参与的方式。{s.cityKey === "hz" ? "惠州没有会场，但峰会周深圳游客多，温泉酒店和巽寮湾的兼职会更旺（×1.3）；想做活动任务，去深圳开一局。" : ""}</p>
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
/* 用户协议 / 隐私政策弹窗：开始页和游戏里都用 */
const legalModal = () => (legalDoc && (() => { const doc = (legalDoc === "terms" ? TERMS : PRIVACY)[lang]; return (
<div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={doc.title}>
<div className="rise max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
<div className="flex items-center justify-between gap-2"><p className="text-lg font-black">{doc.title}</p><span className="flex gap-1">{(["zh", "en"] as const).map((l) => <button key={l} type="button" onClick={() => switchLang(l)} className={`rounded-full px-2.5 py-1 text-[11px] font-black ${lang === l ? "bg-[var(--text)] text-[var(--bg)]" : "border border-[var(--line)]"}`}>{l === "zh" ? "中文" : "EN"}</button>)}<button type="button" aria-label="关闭" onClick={() => setLegalDoc(null)} className="ml-1 rounded-full border border-[var(--line)] px-3 py-1 text-sm font-black">✕</button></span></div>
{doc.sections.map((sec) => (
<div key={sec.h} className="mt-3"><p className="text-sm font-black">{sec.h}</p>{sec.p.map((t, i) => <p key={i} className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{t}</p>)}</div>
))}
<button type="button" onClick={() => setLegalDoc(null)} className="mt-4 w-full rounded-full bg-[var(--text)] py-2.5 text-sm font-black text-[var(--bg)]">{lang === "en" ? "Close" : "知道了"}</button>
</div>
</div>
); })());

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
30 天生活模拟：选一座城、一个身份，在 3D 地图上打工、升职、吃饭、装修、攒钱。这次是<b className="text-[var(--text)]">真的联机</b>——其他打开游戏的人会以真身出现在你的地图上，你们共享一个城市频道、一份动态墙和一张排行榜。三座城随时互通：坐高铁去惠州，过关去香港（罗湖、福田、深圳湾，或高铁直达西九龙站）。11 月 14–19 日是深圳湾区峰会周，三个真实会场等你打工。
</p>
<div className="mt-3 flex flex-wrap gap-2">
<span className="chip"><span className="live-dot" /> 深圳在线 {szCount} 人</span>
<span className="chip"><span className="live-dot" /> 惠州在线 {hzCount} 人</span>
<span className="chip"><span className="live-dot" /> 香港在线 {hkCount} 人</span>
<span className="chip">🗺️ 三城 {getLocations("sz").length + getLocations("hz").length + getLocations("hk").length} 个地点 · 地铁/城际/港铁/高铁全线 · 大地图</span>
<span className="chip">🌐 峰会日程</span>
</div>

{isApecSeason() && (
<div className="mt-5 rounded-[16px] border-2 border-[var(--gold)] bg-[#fdf6da] p-4 text-[#5c4a00]">
<p className="font-display text-xl font-black">🌐 {APEC_SLOGAN}</p>
<p className="mt-1 text-xs leading-relaxed">公开上线活动：湾区国际峰会周 11 月 14–19 日在深圳举行，游戏同步开活动，每天一个任务，按日程走——14 日峰会周开幕（筹备会、工商论坛）→ 16 日晚太子湾欢迎晚宴 → 17–18 日前海工商峰会 → 18–19 日香蜜湖峰会主会议。你以志愿者、记者、司机的身份参与（峰会周的闭门会议不对公众开放，游戏里也进不去），坐真实地铁线路去三个会场打卡上岗，六天任务全做完，领《湾区峰会服务证书》。</p>
<p className="mt-1.5 text-[11px] font-bold">⏰ 游戏第 N 天 = 11 月 N 日：13 日前先进城认地图、认地铁，14 日准时开幕。选深圳开局就能参加活动。</p>
</div>
)}

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
<p className="text-xs leading-relaxed text-[var(--dim)]">{k === "sz" ? `${getLocations("sz").length} 个地点 · 峰会主场 · 周租贵、工资高` : k === "hk" ? `${getLocations("hk").length} 个地点 · 港铁 + 维港 · 港币标价、工资最高、租金最贵` : `${getLocations("hz").length} 个地点 · 海边慢生活 · 周租便宜、工资低`}</p>
<p className="mt-1 text-xs font-bold text-[var(--green)]">● {k === "sz" ? szCount : k === "hk" ? hkCount : hzCount} 人正在这座城里</p>
</button>
);
})}
</div>

<p className="mt-4 flex items-center gap-2 text-xs font-bold text-[var(--dim)]">🌐 Language / 语言 {langToggle()}</p>
{invite && <p className="mt-4 rounded-[14px] border-2 border-[var(--accent)] bg-[var(--surface)] px-4 py-3 text-sm font-bold">🎉 {invite.from}邀请你来深惠过日子：开局多 ¥100{invite.co && invite.co !== "startup" ? `，还有${companyById(invite.co).short}的内推（面试门槛降低）` : ""}。</p>}
<details className="mt-4 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
<summary className="cursor-pointer text-sm font-black">☁️ 在别的设备玩过？用云存档码继续</summary>
<div className="mt-2 flex gap-2">
<input value={restoreCode} onChange={(e) => setRestoreCode(e.target.value.slice(0, 14))} placeholder="ABCDE-FGH23" aria-label="云存档码" className="min-w-0 flex-1 rounded-full border-2 border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm font-bold tracking-widest outline-none" />
<button type="button" onClick={() => void restoreFromCloud()} className="shrink-0 rounded-full bg-[var(--text)] px-4 py-2 text-sm font-black text-[var(--bg)]">载入</button>
</div>
<p className="mt-1 text-xs text-[var(--dim)]">存档码在游戏里右侧「🎫 集章」页最上面。</p>
<button type="button" onClick={() => setAccountOpen(true)} className="mt-2 w-full rounded-full border-2 border-[var(--border)] px-4 py-2 text-sm font-black">👤 {en ? "Or log in to your account" : "或者登录账号继续"}</button>
{accountOpen && phase !== "game" && <AccountModal en={en} playerId={profile?.playerId ?? null} saveKey={LS_KEY} onClose={() => setAccountOpen(false)} toast={showToast} onChange={setLoggedIn} />}
</details>
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

{(() => { const lg = meta.legacy; return (
<div className="mt-6 rounded-[16px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
<p className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-display text-lg font-black">{en ? "🗂️ Drifter's File" : "🗂️ 深漂档案"}</span><span className="text-xs font-black">{en ? `Legacy points ${lg.pts} · ${lg.total} earned · ${meta.runs} runs` : `档案点 ${lg.pts} · 累计 ${lg.total} · 已过 ${meta.runs} 局`}</span></p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{en ? `Every finished run earns legacy points (for your ending, career level, and the neighbours' stories you saw through). Spend them to unlock permanent perks; take up to ${MAX_EQUIP} into each run.${lg.total === 0 ? " Finish your first run to earn some." : ""}` : `每过完一局都会攒档案点（看结局、职级、陪街坊走完的故事）。用档案点永久解锁「传承」，每局开局最多带 ${MAX_EQUIP} 个。${lg.total === 0 ? "先过完第一局，档案点就来了。" : ""}`}</p>
<div className="mt-3 grid gap-2 sm:grid-cols-2">
{PERKS.map((pk) => { const owned = lg.owned.includes(pk.id); const on = lg.equipped.includes(pk.id); return (
<button key={pk.id} type="button" disabled={!owned && lg.pts < pk.cost} onClick={() => updMeta((m) => {
if (!m.legacy.owned.includes(pk.id)) { if (m.legacy.pts < pk.cost) return; m.legacy = { ...m.legacy, pts: m.legacy.pts - pk.cost, owned: [...m.legacy.owned, pk.id], equipped: m.legacy.equipped.length < MAX_EQUIP ? [...m.legacy.equipped, pk.id] : m.legacy.equipped }; return; }
m.legacy = { ...m.legacy, equipped: m.legacy.equipped.includes(pk.id) ? m.legacy.equipped.filter((x) => x !== pk.id) : m.legacy.equipped.length < MAX_EQUIP ? [...m.legacy.equipped, pk.id] : m.legacy.equipped };
})} className={`flex items-start gap-2 rounded-[12px] border-2 p-2.5 text-left disabled:opacity-45 ${on ? "border-[var(--accent)] bg-[var(--surface2)]" : "border-[var(--line)]"}`}>
<span className="text-xl">{pk.emoji}</span>
<span className="min-w-0 flex-1"><span className="block text-sm font-black">{L(pk.name)}</span><span className="block text-xs text-[var(--dim)]">{L(pk.desc)}</span></span>
<span className="shrink-0 text-[11px] font-black">{!owned ? (en ? `🔓 ${pk.cost} pts` : `🔓 ${pk.cost} 点`) : on ? (en ? "✅ Equipped" : "✅ 本局带上") : (en ? "Owned · tap to equip" : "已解锁 · 点击带上")}</span>
</button> ); })}
</div>
{lg.history.length > 0 && <p className="mt-2 text-[11px] text-[var(--dim)]">{en ? "Recent runs: " : "最近几局："}{lg.history.slice(0, 4).map((h) => `${en ? trText(h.title) : h.title} +${h.pts}`).join(" · ")}</p>}
</div> ); })()}

{OPERATOR_MISSING && <p className="mt-5 rounded-[12px] border-2 border-dashed border-[var(--accent)] px-3 py-2 text-[11px] font-bold text-[var(--accent)]">{lang === "en" ? "Pre-launch: the operator name and contact in the Terms and Privacy Policy are not filled in yet (set VITE_OPERATOR_NAME / VITE_OPERATOR_CONTACT when building)." : "上线前提醒：用户协议和隐私政策里的运营方名称、联系方式还没填（构建时设置 VITE_OPERATOR_NAME / VITE_OPERATOR_CONTACT）。"}</p>}
<label className="mt-5 flex items-start gap-2 text-xs leading-relaxed">
<input type="checkbox" checked={agreed} onChange={(e) => setAgreedStored(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]" aria-label={lang === "en" ? "I agree to the Terms and Privacy Policy" : "同意用户协议和隐私政策"} />
<span>{lang === "en" ? <>I have read and agree to the <button type="button" onClick={() => setLegalDoc("terms")} className="font-black underline">Terms of Service</button> and <button type="button" onClick={() => setLegalDoc("privacy")} className="font-black underline">Privacy Policy</button>. Real company names only mark real places; jobs, pay and stories are fiction.</> : <>我已阅读并同意<button type="button" onClick={() => setLegalDoc("terms")} className="font-black underline">《用户协议》</button>和<button type="button" onClick={() => setLegalDoc("privacy")} className="font-black underline">《隐私政策》</button>。游戏里的真实企业名称只用来标示真实位置，工作、工资和剧情都是虚构的。</>}</span>
</label>
<button type="button" disabled={!setupName.trim() || !agreed} onClick={() => startGame(setupName.trim(), setupCity, setupIden)} className="mt-6 w-full rounded-full bg-[var(--accent)] py-4 text-base font-black text-white shadow-[5px_5px_0_var(--border)] disabled:opacity-40">
进城，开始过日子 →
</button>
<p className="mt-3 text-center text-xs leading-relaxed text-[var(--dim)]">规则：跟着北京时间过日子，每个自然月是一个赛季，第 N 天就是本月 N 号；做事有真实冷却，地铁、商场、景区按真实营业时间；没上线的日子会自动模拟上班吃饭；每周六睡前交租，存款跌破 -¥500 会被房东请出门；第 30 天结束结算并登上全城排行榜。</p>
</main>
{legalModal()}
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
<p className="text-xs font-black tracking-[0.18em] opacity-90">{seasonMo} 月赛季结算 · {CITIES[s.cityKey].name}</p>
<h2 className="font-display mt-1 text-4xl font-black">{result.title}</h2>
<p className="mt-1 text-sm opacity-95">{iden.emoji} {iden.name} · 在{CITIES[s.cityKey].name}活了 {Math.min(s.day, seasonLen)} 天 · 最高存款 {fmt(s.maxMoney)}</p>
</div>
<div className="p-5">
<p className="text-sm leading-relaxed">{result.quote}</p>
<div className="mt-4 grid grid-cols-3 gap-2 text-center">
{[
["最终存款", fmt(s.money)], ["存活天数", `${Math.min(s.day, seasonLen)} 天`], ["上班", `${s.workCount} 次`],
["玩过的活动", `${s.actCount ?? 0} 次`], ["和真人组局", `${s.partyPlays ?? 0} 次`], ["感情", (() => { const top = Object.entries(s.romance ?? {}).sort((x, y) => y[1] - x[1])[0]; return top ? `${top[0]} · ${ROMANCE_STAGES[romanceStage(top[1])]!.name[0]}` : "单身"; })()],
["总收入", fmt(s.earned)], ["交租", fmt(s.rentPaid)], ["最终心情", `${Math.round(s.mood)}`],
["职级", (CAREERS[s.careerIdx] ?? CAREERS[0]!).name], ["技能", `${s.skill} 点`], ["人脉", `${s.network} 人`],
["我的家", homeName(s)], ["舒适度", `${computeComfort(s)}`], ["峰会服务", `${s.apecCount} 次`], [s.cityKey === "hz" ? "坐城轨/高铁" : s.cityKey === "hk" ? "坐港铁" : "坐地铁", `${s.metroRides ?? 0} 次`], ["风景打卡", `${(s.visitedScenic ?? []).length} / ${scenicTotal(s.cityKey)} 处`],
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
{Object.values(s.story ?? {}).some((p) => p.done) && (
<div className="mt-4 rounded-[12px] bg-[var(--surface2)] p-3">
<p className="text-xs font-black">{en ? "📖 Neighbours' stories you saw through these 30 days" : "📖 这 30 天你陪街坊走完的故事"}</p>
{STORIES.filter((st) => s.story?.[st.npc]?.done).map((st) => <p key={st.npc} className="mt-1 text-xs">{NPCS.find((n) => n.name === st.npc)?.emoji} {en ? `${trText(st.npc)} · "${L(st.title)}" → ` : `${st.npc}「${st.title}」→ `}<b>{L(s.story?.[st.npc]?.done ?? "")}</b></p>)}
</div>
)}
{legacyGain && (
<div className="mt-4 rounded-[12px] border-2 border-[var(--accent)] p-3">
<p className="text-sm font-black">{en ? `🗂️ Drifter's File +${legacyGain.pts} pts ` : `🗂️ 深漂档案 +${legacyGain.pts} 点 `}<span className="text-xs font-bold text-[var(--dim)]">{en ? `(${meta.legacy.pts} pts total)` : `（现在共 ${meta.legacy.pts} 点）`}</span></p>
<p className="mt-1 text-xs text-[var(--dim)]">{legacyGain.parts.join(" · ")}</p>
<p className="mt-1 text-xs">{en ? "Spend points on perks before your next run: start with cash or skill, get up an hour earlier, have the neighbours remember you…" : "下一局开局可以用档案点解锁传承：开局带钱、带技能、每天早起一小时、街坊记得你……"}</p>
</div>
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
<span className="min-w-0 flex-1 truncate" style={lookOf(b) && LOOK_COLOR[lookOf(b)!] ? { color: LOOK_COLOR[lookOf(b)!], fontWeight: 900 } : undefined}>{b.name}{lookOf(b) && LOOK_TITLE[lookOf(b)!] ? <span className="ml-1 rounded-full bg-[var(--surface2)] px-1.5 text-[10px]">{LOOK_TITLE[lookOf(b)!]![en ? 1 : 0]}</span> : null}{b.id === myId ? "（你）" : ""}</span>
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
<div className="mx-auto flex w-full max-w-[2560px] items-center gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] 2xl:px-8 [&>*]:shrink-0 [&>*]:whitespace-nowrap">
<span className="font-display text-lg font-black">第 {Math.min(s.day, seasonLen)} 天</span>
<span className="hidden text-xs font-bold text-[var(--dim)] lg:inline">{seasonMo} 月 {Math.min(s.day, seasonLen)} 日 · {weekday(s.day)} · {nowWeatherText}</span>
<button type="button" aria-label={`刷新${city.name}真实天气`} title={rwOk ? `${city.name}此刻真实天气（${realWeather!.sourceName}，${new Date(realWeather!.fetchedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 更新）——游戏里的天色、云雨都跟着它走` : "真实天气暂时取不到"} onClick={() => weatherQuery.refetch()} className="chip">
{weatherQuery.isLoading ? "🌡️ 实况加载中…" : rwOk ? `${RW_EMOJI[realWeather!.kind]} ${city.name}实况 ${realWeather!.description || RW_LABEL[realWeather!.kind]}${realWeather!.temperature != null ? ` ${Math.round(realWeather!.temperature)}°` : ""}${realWeather!.stale ? "（缓存）" : ""}` : "🌡️ 实况暂不可用"}
</button>
{(Object.keys(CITIES) as CityKey[]).filter((k) => k !== s.cityKey).map((k) => (
<button key={k} type="button" aria-label={`去${CITIES[k].name}：${crossRoutes(s.cityKey, k).length} 条真实路线可选`} title="换座城市过日子：选口岸 / 高铁 / 船 / 大巴 / 自驾，按真实开放时间；进度原样带着" onClick={() => setCrossTo(k)} className="chip shrink-0 border-[var(--accent)] font-black text-[var(--accent)] transition hover:bg-[var(--surface2)]">{k === "hk" || s.cityKey === "hk" ? "🛃" : "🚄"} {en ? `To ${CITY_EN[k]} · ${crossRoutes(s.cityKey, k).length} routes` : `去${CITIES[k].name} · ${crossRoutes(s.cityKey, k).length} 条路线`}</button>
))}
<button type="button" title={todayEvent.desc} aria-label={`今日城市事件：${todayEvent.name}`} onClick={() => showToast(`${todayEvent.emoji} 今日城市事件「${todayEvent.name}」：${todayEvent.desc}`)} className="ml-auto chip">{todayEvent.emoji} {todayEvent.name}</button>
<span className="chip"><span className="live-dot" /> {(world?.onlineSz ?? 0) + (world?.onlineHz ?? 0) + (world?.onlineHk ?? 0)} 人在线</span>
{langToggle()}
<button type="button" aria-label="打开每日任务" onClick={() => setDailyOpen(true)} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-black transition hover:border-[var(--border)]">📋 任务</button>
<button type="button" aria-label="分享战绩、邀请朋友" onClick={() => void openShare()} className="rounded-full bg-[var(--accent)] px-3 py-2 text-xs font-black text-white">📤 分享</button>
<button type="button" aria-label="打开手机" onClick={() => { setPhoneApp(null); setPhoneOpen(true); }} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-black transition hover:border-[var(--border)]">📱 手机</button>
<button type="button" onClick={goHomeAndSleep} className="rounded-full bg-[var(--text)] px-3.5 py-2 text-xs font-black text-[var(--bg)]">😴 回家睡觉</button>
</div>
</header>

<main className="relative w-full">
{/* The map is the whole stage now — no fixed side panel squeezing it.
    The status / Summit / city bars float over the map's top-left corner as
    a translucent stack (folded bars become a vertical rail of buttons
    down the left edge), and place/feed/wall/chat/board live in a
    floating translucent panel that collapses vertically into a slim
    strip on the right edge — never fully hidden, always one tap away. */}
<section className="relative h-[calc(100dvh-61px)] min-h-[540px] w-full overflow-hidden">
<div className="float-bars absolute left-3 top-[60px] z-20 w-[min(720px,calc(100vw-24px))]">
{/* ONE merged card (was three stacked bars: status / Summit / city intro).
    Row 1 = core stats; row 2 = slim Summit strip + three fold tabs that
    open a single detail panel at a time. The whole card folds into the
    left-edge rail. */}
{!barsHidden && (
<div className="hard-card px-3.5 py-2.5">
<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
<div className="flex items-baseline gap-1.5">
<span className="text-[11px] font-bold text-[var(--dim)]">存款</span>
<span className={`font-display text-[24px] font-black leading-none ${s.money < 0 ? "text-[var(--accent)]" : ""}`}>{fmt(s.money)}</span>
<span className="text-[11px] font-bold text-[var(--dim)]">/ {fmt(s.goal)}</span>
</div>
<div className="flex items-center gap-1.5">
<div className="h-2 w-16 overflow-hidden rounded-full bg-[var(--surface2)]" role="img" aria-label={`存钱目标进度 ${goalPct}%`}><div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${goalPct}%` }} /></div>
<span className="text-[11px] font-black">{goalPct}%</span>
</div>
<span className="flex items-center gap-1 text-xs font-bold">⚡<span className="h-2 w-10 overflow-hidden rounded-full bg-[var(--surface2)]"><span className="block h-full bg-amber-500 transition-all" style={{ width: `${s.energy}%` }} /></span>{Math.round(s.energy)}</span>
<span className="flex items-center gap-1 text-xs font-bold">😊<span className="h-2 w-10 overflow-hidden rounded-full bg-[var(--surface2)]"><span className="block h-full bg-emerald-500 transition-all" style={{ width: `${s.mood}%` }} /></span>{Math.round(s.mood)}</span>
<span className="chip" title="游戏时间就是北京时间：每个自然月是一个赛季，第 N 天 = 本月 N 号；做事有真实冷却；地铁、商场、景区按真实营业时间开关">{`🕘 ${clockStr(nowMin())}`}</span>
{s.busyUntil && Date.now() < s.busyUntil ? <span className="chip border-[var(--accent)] text-[var(--accent)]">{`⏳ ${s.busyWhat ?? "忙"} ${countdown(s.busyUntil - Date.now())}`}</span> : null}
<button type="button" onClick={() => setPartyOpen(true)} className={`chip ${parties.some((pt) => pt.status === "open") ? "border-[var(--accent)] text-[var(--accent)]" : ""}`} title={en ? "Parties in this city: join other players" : "同城组局：和真人一起玩"}>🎉 {en ? "Parties" : "组局"} {parties.filter((pt) => pt.status === "open").length}</button>
<button type="button" onClick={() => { setHubOpen(true); track("hub_open"); }} className="chip border-[var(--text)] bg-[var(--text)] text-[var(--bg)]" title={en ? "Everything you can do right now, nearest first" : "现在能做的所有事，按远近排"}>🧭 {en ? "What can I do?" : "现在能干嘛"}</button>
<button type="button" onClick={() => setStoreOpen(true)} className="chip" title={en ? "Starlight store: looks, season pass, membership" : "星光商店：外观、赛季通行证、会员"}>✨ {en ? "Store" : "商店"}</button>
<button type="button" onClick={() => setAccountOpen(true)} className={`chip ${!loggedIn && s.day >= 2 ? "border-[var(--accent)] text-[var(--accent)]" : ""}`} title={en ? "Account: keep your progress, unlock DMs and parties" : "账号：保住进度，解锁私聊和组局"}>👤 {loggedIn ? (en ? "Account" : "账号") : (en ? "Sign in" : "绑定账号")}</button>
<button type="button" onClick={() => setDmOpen(true)} className={`chip ${unreadDm ? "border-[var(--accent)] text-[var(--accent)]" : ""}`} title={en ? "Private messages" : "私信"}>💬 {en ? "DMs" : "私信"}{unreadDm ? ` ${unreadDm}` : ""}</button>
<span className="chip" title={iden.name}>{iden.emoji} {career.name} ×{career.mul}</span>
{(() => { const co = employerHere(s); return co ? <span className="chip" title={co.culture}>{co.emoji} {co.short}</span> : null; })()}
{meta.title && <span className="chip" style={{ borderColor: "var(--gold)", color: "var(--gold)" }}>🏅 {meta.title}</span>}
{isSaturday(s.day) && <span className="chip text-[var(--accent)]">🏠 今天交租 {fmt(s.rent)}</span>}
{s.invest > 0 && <span className="chip">💹 {fmt(s.invest)}</span>}
<button type="button" aria-label="竖着收起状态卡，收成屏幕左侧的竖排按钮" title="竖着收起，收成屏幕左侧的竖排按钮，点一下就展开" onClick={() => setBarsHidden(true)} className="ml-auto shrink-0 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-black transition hover:border-[var(--border)]">◂ 收起</button>
</div>

<div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-[var(--line)] pt-2 text-[11px] font-bold">
<span className="shrink-0 rounded-full border border-[var(--gold)] bg-[#fdf6da] px-2 py-0.5 font-black text-[#5c4a00]">🌐 峰会{s.cityKey === "sz" ? ` · ${s.day < 14 ? `还有 ${14 - s.day} 天` : s.day <= 19 ? "进行中" : "已结束"}` : " · 深圳 14–19 日"}</span>
{s.cityKey === "sz" ? (
<>
<span className="shrink-0">任务 {(s.apecTasks ?? []).length}/{APEC_TASKS.length} · 打卡 {(s.apecCheckins ?? []).length}/3</span>
{(() => {
const task = apecTaskOfDay(s.day) ?? (s.day < 14 ? APEC_TASKS[0]! : null);
if (!task) return null;
const done = (s.apecTasks ?? []).includes(task.id);
const venue = locById(task.venueLocId);
return (
<>
<span className="min-w-[60px] flex-1 basis-0 truncate" title={`${task.title} · ${venue.name}`}>{task.day === s.day ? "今日" : task.dateLabel}：{task.roleEmoji} {task.title} · {venue.short}</span>
{done ? <span className="shrink-0 font-black">✅</span> : currentLoc !== task.venueLocId ? <button type="button" aria-label={`坐地铁前往${venue.name}打卡`} onClick={() => walkTo(task.venueLocId, "metro")} className="shrink-0 rounded-full bg-[#5c4a00] px-2.5 py-0.5 font-black text-white">🚇 去打卡</button> : <span className="shrink-0 font-black">📍 在会场</span>}
</>
);
})()}
</>
) : <span className="min-w-[60px] flex-1 basis-0 truncate text-[var(--dim)]">惠州兼职旺季 ×1.3</span>}
<div className="ml-auto flex shrink-0 gap-1" role="tablist" title="展开：状态详情 / 峰会活动 / 城市速览" aria-label="展开详情">
{([["hud", "状态"], ["apec", "峰会"], ["intro", "速览"]] as const).map(([k, label]) => (
<button key={k} type="button" role="tab" aria-selected={fold === k} aria-expanded={fold === k} onClick={() => setFold((f) => (f === k ? null : k))} className={`rounded-full border px-2.5 py-1 text-[11px] font-black transition ${fold === k ? "border-[var(--border)] bg-[var(--surface2)]" : "border-[var(--line)] hover:border-[var(--border)]"}`}>{label} {fold === k ? "▴" : "▾"}</button>
))}
</div>
</div>
{s.energy < 25 && <p className="mt-2 text-xs font-bold text-[var(--accent)]">能量快见底了：去夜市吃点东西，或者回家睡觉。</p>}
{nowRainy && s.outfit !== "raincoat" && (
<p className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--accent2)]">🌧️ 今天下雨，出门容易淋湿——衣柜里有雨衣的话先换上。
<button type="button" aria-label="下雨天换上雨衣" onClick={() => buyOutfit("raincoat")} className="rounded-full bg-[var(--accent2)] px-3 py-1 text-[11px] font-black text-white">{s.ownedOutfits.includes("raincoat") ? "换上雨衣 🧥" : `${fmt(outfitOf("raincoat").price)} 买雨衣穿上`}</button></p>
)}
{fold === "hud" && (
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
<span className="chip">🏠 周租 {fmt(s.rent)}</span>
<span className="chip">{iden.emoji} {iden.name}</span>
<span className="chip">经验 {s.xp}</span>
<span className="chip">技能 {s.skill}</span>
<span className="chip">人脉 {s.network}</span>
<span className="chip">体质 {s.fit}</span>
<span className="chip">🌐 峰会服务 {s.apecCount} 次</span>
{s.cityKey === "sz" && <span className="chip">🎖️ 峰会任务 {(s.apecTasks ?? []).length}/{APEC_TASKS.length} · 打卡 {(s.apecCheckins ?? []).length}/3</span>}
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
{fold === "apec" && (
<div className="mt-3 rounded-[12px] border border-[var(--gold)] bg-[#fdf6da] p-2.5 text-[#5c4a00]">
{s.cityKey === "sz" ? (
<>
<p className="text-xs leading-relaxed">{phaseApec.detail}</p>
<div className="mt-2">
<p className="text-xs font-black">🎉 湾区峰会周活动 · {APEC_SLOGAN}</p>
<p className="mt-0.5 text-[11px] font-bold">每日一任务（11 月 14–19 日）：任务进度 {(s.apecTasks ?? []).length} / {APEC_TASKS.length} · 会场打卡 {(s.apecCheckins ?? []).length} / 3{(s.apecTasks ?? []).length >= APEC_TASKS.length ? ` · ${APEC_CERT_NAME}已到手` : " · 六天全做完领服务证书"}</p>
{(() => {
const task = apecTaskOfDay(s.day) ?? (s.day < 14 ? APEC_TASKS[0]! : null);
if (!task) return <p className="mt-1.5 text-xs leading-relaxed">峰会周活动已经结束。{(s.apecTasks ?? []).length >= APEC_TASKS.length ? "你六天的任务全做完了，证书在结算页等你。" : "错过的班次不能补，但这座城你已经认得差不多了。"}</p>;
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
</>
) : (
<>
<p className="text-xs font-black">🌐 湾区峰会周活动 · {APEC_SLOGAN}</p>
<p className="mt-1 text-xs leading-relaxed">{s.day < 14 ? `湾区国际峰会周 11 月 14 日在深圳开启：14 日开幕、16 日晚太子湾欢迎晚宴、17–18 日前海工商峰会、18–19 日香蜜湖峰会主会议，每天一个任务，玩家在深圳以志愿者、记者、司机身份去三个会场打卡上岗。` : "深圳湾区峰会周进行中（14–19 日）：每天一个任务，志愿者、记者、司机轮着当，三个会场坐地铁去打卡。"}惠州没有会场，这周温泉酒店、巽寮湾的兼职更旺（×1.3）——想上岗打卡，去深圳开一局就能参加。</p>
</>
)}
</div>
)}
{fold === "intro" && (
<div className="mt-3 border-t border-[var(--line)] pt-3">
<p className="text-[13px] font-black">🗺️ {CITY_INTRO[s.cityKey].title} · <span className="text-[var(--accent2)]">{CITY_INTRO[s.cityKey].en}</span></p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{CITY_INTRO[s.cityKey].facts}</p>
<p className="mt-1.5 rounded-[10px] bg-[var(--surface2)] px-2.5 py-1.5 text-[11px] font-bold leading-relaxed">🗺️ 地图说明：游戏地图是按真实地理方位排布的<b>示意微缩模型</b>——地点之间的方向、片区、海岸与山峦的相对位置都按真实地理，但距离和面积经过压缩，<b>不是等比例测绘地图</b>。靠它认方向、认城市没问题；真实距离请以导航为准。</p>
</div>
)}
</div>
)}
</div>


{/* Map — the hero, and now the whole stage: it fills the section
    edge-to-edge at all times. ⛶ 全屏 still offers the native
    full-viewport mode on top of that; Esc or the same button exits. */}
<div ref={mapShellRef} className={mapFullscreen ? "fixed inset-0 z-[38] flex flex-col bg-[var(--bg)] p-3 pt-safe" : "absolute inset-0 flex flex-col p-2.5"}>
<div className="relative px-1.5 pb-2.5">
<div className="flex gap-2">
<input value={mapQuery} onChange={(e) => setMapQuery(e.target.value)} placeholder={s.cityKey === "hz" ? "🔍 搜地点或城轨/高铁站：西湖、老街、惠州南…" : s.cityKey === "hk" ? "🔍 搜地点或港铁站：旺角、中环、山顶、迪士尼…" : "🔍 搜地点或地铁站：公园、商场、医院、博物馆、海滩…"} aria-label={`搜索地点或${railWord(s.cityKey)}站`} className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-sm outline-none focus:border-[var(--border)]" />
<button type="button" aria-label="打开景点分布图" onClick={() => setPlacesMapOpen(true)} className="shrink-0 rounded-full bg-[var(--green)] px-3.5 py-2 text-xs font-black text-white">🗺️ 景点分布图</button>
<button type="button" aria-label={s.cityKey === "hz" ? "打开惠州城际高铁线网图" : s.cityKey === "hk" ? "打开香港港铁线网图" : "打开地铁线路图"} onClick={() => { setMetroMapDest(null); setMetroMapOpen(true); }} className="shrink-0 rounded-full bg-[var(--accent2)] px-3.5 py-2 text-xs font-black text-white">{s.cityKey === "hz" ? "🚆 城际/高铁线网图" : "🚇 地铁线路图"}</button>
<button type="button" aria-label={mapFullscreen ? "退出地图全屏" : "地图全屏"} aria-pressed={mapFullscreen} onClick={toggleMapFullscreen} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-black text-white ${mapFullscreen ? "bg-[var(--accent)]" : "bg-[#14202b]"}`}>{mapFullscreen ? "⛶ 退出全屏" : "⛶ 全屏看地图"}</button>
</div>
{mapQuery.trim() !== "" && (() => {
const q = mapQuery.trim();
/* 口岸 / 过关 / 码头…: list every way out of the city (ports, ferry piers, the
   cross-border rail station), not just places with the word in their name */
const crossQ = /口岸|过关|出境|入境|边境|跨境|码头|border|crossing|ferry/i.test(q);
const crossIds = new Set(CROSS_ROUTES.filter((r) => r.from === s.cityKey && r.fromLoc !== "*").map((r) => r.fromLoc));
const locResults = [
...getLocations(s.cityKey).filter((l) => l.name.includes(q) || l.short.includes(q) || (LOC_EN[l.name] ?? "").toLowerCase().includes(q.toLowerCase()) || (crossQ && (l.type === "port" || crossIds.has(l.id)))).slice(0, crossQ ? 16 : 6),
...placesForCity(s.cityKey).filter((p) => p.name.includes(q) || (p.en ?? "").toLowerCase().includes(q.toLowerCase())).slice(0, 8).map((p) => locById(`pl:${p.id}`)),
...AREA_LABELS.filter((a) => a.c === s.cityKey && (a.n.includes(q) || (a.e ?? "").toLowerCase().includes(q.toLowerCase()))).slice(0, 6).map((a) => locById(areaLocId(a.c, a.n))),
];
const stationResults = stationIndexOf(s.cityKey).filter((st) => st.name.includes(q)).slice(0, 6);
return (
<div className="absolute inset-x-1.5 top-full z-30 max-h-72 overflow-y-auto rounded-[14px] border-2 border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-xl">
{locResults.length === 0 && stationResults.length === 0 && <p className="px-2 py-1.5 text-xs text-[var(--dim)]">没找到「{q}」——地点名、{railWord(s.cityKey)}站名、英文名都能搜。</p>}
{locResults.map((l) => {
const plan = l.id !== currentLoc ? planRailTrip(s.cityKey, currentLoc, l.id) : null;
return (
<button key={l.id} type="button" aria-label={`定位到${l.name}`} onClick={() => { setSelectedLoc(l.id); setAsideTab("place"); autoOpenAside(); setMapFocus({ locId: l.id, nonce: Date.now() }); setMapQuery(""); }} className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left hover:bg-[var(--surface2)]">
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
<MapView lite={lite} fill paused={!!lifeAnim} train={carriage ? { pts: carriage.route.stations.map((st) => [st.x, st.z] as [number, number]), idx: carriage.stopIdx, stepMs: hopMs(carriage.route, carriage.stopIdx), color: (carriage.route.legs[carriage.legIdx]?.line ?? carriage.route.line).color, rail: carriage.route.legs.some((l) => ["szhz-rail", "guangshen", "hz-intercity", "ganshen-rail", "guangshan-rail", "hsr-hk"].includes(l.line.id)), hold: rideEntry !== null || carriage.awaitingTransfer || carriage.stopIdx >= carriage.route.stations.length - 1 } : null} cityKey={s.cityKey} selfLocId={selectedLoc} selfEmoji={iden.emoji} selfColor={iden.color} selfName={profile?.name ?? "我"} remotePlayers={remotePlayers} selfOutfitId={s.outfit} travelModeId={tripMode ?? travelMode} selfEtaAt={tripEta ?? undefined} arrival={arrival} weatherKind={rwOk ? realWeather!.kind : "unknown"} npcMoodEmoji={Object.fromEntries(npcsForCity(s.cityKey).map((n) => [n.name, moodEmoji(memOf(s.npcMem ?? {}, n.name).mood)]))} apecDay={isApecWeek(s.day)} focusLocId={mapFocus?.locId} focusX={mapFocus?.x} focusZ={mapFocus?.z} focusNonce={mapFocus?.nonce} destLocId={selectedLoc} onSelect={walkTo} onPickActor={pickActor} navOverlay={(
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
<button key={k} type="button" aria-label={`去${CITIES[k].name}：${crossRoutes(s.cityKey, k).length} 条真实路线可选`} title="换座城市过日子：选口岸 / 高铁 / 船 / 大巴 / 自驾，按真实开放时间；进度原样带着" onClick={() => setCrossTo(k)} className="rounded-full border border-black/40 bg-[#14202b]/90 px-3.5 py-2 text-xs font-black text-white shadow-lg">
{en ? `${k === "hk" || s.cityKey === "hk" ? "🛃 Cross" : "🚄 Travel"} · to ${CITY_EN[k]}` : `${k === "hk" || s.cityKey === "hk" ? "🛃 过关" : "🚄 切换城市"} · 去${CITIES[k].name}`}
</button>
))}
</div>
{navOpen && (
<div className="absolute left-3 top-[13%] z-20 flex max-h-[74%] w-[min(332px,calc(100%-24px))] flex-col rounded-[16px] border border-black/40 bg-[#0b1622]/95 p-3 text-white shadow-2xl">
<div className="mb-1 flex items-center justify-between gap-2">
<p className="text-xs font-black">🧭 出行导航</p>
<button type="button" aria-label={navPinned ? "取消固定出行导航" : "固定出行导航"} aria-pressed={navPinned} title={navPinned ? "已固定：选地点后不收起；再点取消" : "固定：选了地点出发后面板也不收起"} onClick={() => togglePin("nav")} className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-black ${navPinned ? "bg-white text-[#14202b]" : "border border-white/25 bg-white/10"}`}>📌 {navPinned ? "已固定" : "固定"}</button>
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
<button key={l.id} type="button" aria-label={`前往${l.name}`} onClick={() => { if (!navPinnedRef.current) setNavOpen(false); walkTo(l.id); }} className={`rounded-full border px-2.5 py-1.5 text-xs font-bold ${l.id === selectedLoc ? "border-transparent bg-white text-[#14202b]" : "border-white/25 bg-white/10 text-white"}`}>
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
{<button type="button" aria-label="点空白处把地区面板竖着收起成右侧竖条" onClick={() => setAsideOpen(false)} className="fixed inset-0 z-[35] cursor-default bg-black/15" />}
<div className="float-panel fixed bottom-3 right-3 top-[76px] z-40 flex w-[430px] max-w-[calc(100vw-24px)] flex-col overflow-y-auto overflow-x-hidden rounded-[18px] border-2 border-[var(--border)] p-4 shadow-2xl">
<div className="mb-2.5 flex items-center justify-between gap-2">
<p className="text-xs font-black tracking-wide text-[var(--dim)]">🗺️ 地区面板 · {selLoc.emoji} {selLoc.short}一带</p>
<button type="button" aria-label={asidePinned ? "取消固定收起" : "固定收起地区面板"} aria-pressed={asidePinned} title={asidePinned ? "已固定收起：面板不会自动弹出；再点取消" : "固定收起：以后选地点、搜索都不自动弹出面板，只有点右侧竖条才展开"} onClick={() => { if (!asidePinned) setAsideOpen(false); togglePin("aside"); }} className={`ml-auto shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-black ${asidePinned ? "bg-[var(--text)] text-[var(--bg)]" : "border border-[var(--line)] bg-[var(--surface)]"}`}>📌 {asidePinned ? "已固定收起" : "固定收起"}</button>
<button type="button" aria-label="竖着收起地区面板，收成屏幕右侧的竖条，点竖条随时展开" title="竖着收起成右侧竖条，一直留在屏幕边上，点一下就展开" onClick={() => setAsideOpen(false)} className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-black transition hover:border-[var(--border)]">竖收起 »</button>
</div>
<div className="grid grid-cols-6 gap-1 rounded-full bg-[var(--surface2)] p-1" role="tablist" aria-label="地点与联机面板">
{([["place", "📍 地点"], ["collect", "🎫 集章"], ["feed", "🏘️ 动态"], ["wall", "🧑‍🤝‍🧑 街坊墙"], ["chat", "💬 聊天"], ["board", "🏆 排行"], ["guide", "📖 图鉴"]] as const).map(([k, label]) => (
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
{(selLoc.er || selLoc.tel || selLoc.addr || selLoc.hours) && (
<p className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-bold">
{selLoc.er && <span className="chip" style={{ borderColor: "#dc2626", color: "#dc2626" }}>🚑 24 小时急诊 · Emergency</span>}
{selLoc.tel && <a href={`tel:${selLoc.tel.replace(/[^+\d]/g, "")}`} className="chip">📞 {selLoc.tel}</a>}
{selLoc.addr && <span className="chip">📍 {selLoc.addr}</span>}
{selLoc.hours && <span className="chip">🕐 {selLoc.hours}</span>}
</p>
)}
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
{actionsFor(selLoc, s).map((a) => { const own = a.kind.startsWith("__routine-") && !["__routine-wait"].includes(a.kind) || a.kind.startsWith("__rider-"); /* the rider's own steps don't depend on the shop's hours */ const tb = timeBlock(a.kind, s) ?? (a.kind === "__sleep" || a.kind === "rest" || own ? null : venueClosed(selLoc)); return (
<button key={a.kind + (a.arg ?? 0)} type="button" disabled={!arrived || a.disabled || !!tb} onClick={() => { if (a.kind === "__sleep") playLifeAnim("sleep", () => doSleep()); else if (a.kind.startsWith("__gocity-")) setCrossTo(a.kind.slice("__gocity-".length) as CityKey); else if (a.kind.startsWith("__routine-")) doRoutine(a.kind.slice("__routine-".length)); else if (a.kind === "__rider-go") riderGo(); else if (a.kind === "__rider-cancel") { const g0 = gsRef.current; if (g0) { const rd0 = routineToday(g0); mutate((x) => { x.routine = { ...rd0, order: null }; x.money -= 2; x.mood = clamp(x.mood - 3, 0, 100); }); showToast(en ? "Order cancelled (−¥2)." : "这单取消了，平台扣了 ¥2。"); } } else if (a.kind.startsWith("__cross-")) { const r = CROSS_ROUTES.find((x) => x.id === a.kind.slice("__cross-".length)); if (r) takeRoute(r); } else doAction(a.kind, a.arg ?? 0); }} className="act-btn">
<span className="flex items-center justify-between text-sm font-black"><span>{a.title}</span><span>{a.emoji}</span></span>
<span className="mt-0.5 block text-xs leading-relaxed text-[var(--dim)]">{a.desc}</span>
<span className="mt-1 block text-xs font-bold text-[var(--accent2)]">{a.cost}{a.kind !== "__sleep" && ` · ⏳ ${realMinLabel(actionMinutes(a.kind))}`}</span>
{tb && <span className="mt-0.5 block text-[11px] font-bold text-[var(--accent)]">⏰ {tb}</span>}
</button>
); })}
</div>
{(() => { const acts = activitiesAt(selLoc); if (!acts.length) return null; const openHere = parties.filter((pt) => pt.locId === selLoc.id && pt.status === "open"); const cats = [...new Set(acts.map((a) => a.cat))] as ActCat[]; return (
<div className="mt-4">
<p className="flex items-baseline justify-between gap-2"><span className="text-xs font-black tracking-wide">{en ? `🎮 Things to do here · ${acts.length}` : `🎮 在这里能玩 · ${acts.length} 个`}</span><span className="text-[11px] font-bold text-[var(--dim)]">{en ? "Play solo, or open a party" : "自己玩，或者组局等人"}</span></p>
{openHere.map((pt) => { const a = activityById(pt.activityId); const mine = pt.members.some((m) => m.id === myId); return (
<p key={pt.id} className="mt-2 flex items-center gap-2 rounded-[12px] border-2 border-[var(--accent)] bg-[var(--surface2)] px-3 py-2 text-xs font-bold"><span className="min-w-0 flex-1">🎉 {en ? `Party here: ${a?.name[1] ?? ""} · ${pt.members.map((m) => m.name).join(", ")}` : `这里有个局：${a?.name[0] ?? ""} · ${pt.members.map((m) => m.name).join("、")}`}</span>
{mine ? <span className="shrink-0">{en ? "You're in" : "已加入"}</span> : <button type="button" onClick={() => joinPartyNow(pt)} className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-black text-white">{en ? "Join" : "加入"}</button>}</p> ); })}
{cats.map((c) => (
<div key={c} className="mt-2">
<p className="text-[11px] font-black text-[var(--dim)]">{L2t(CAT_LABEL[c])}</p>
<div className="mt-1 grid gap-2 sm:grid-cols-2">
{acts.filter((a) => a.cat === c).map((a) => { const why = actBlock(a, s, arrived, selLoc); const groupable = !NO_PARTY.has(a.id) && a.cat !== "date"; return (
<div key={a.id} className="rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-2.5">
<p className="text-sm font-black">{a.emoji} {L2t(a.name)}</p>
<p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">{L2t(a.desc)}</p>
<p className="mt-1 text-[11px] font-bold text-[var(--accent2)]">{[a.cost ? `¥${a.cost}` : (en ? "Free" : "免费"), a.energy > 0 ? `${en ? "Energy" : "能量"} -${a.energy}` : a.energy < 0 ? `${en ? "Energy" : "能量"} +${-a.energy}` : "", `⏳ ${en ? `${+(cooldownMs(a.min) / 60000).toFixed(1)} min` : realMinLabel(a.min)}`, a.money ? `${en ? "earn up to" : "最多赚"} ¥${Math.round(a.money * CITIES[s.cityKey].payMul)}` : "", a.risk ? (en ? "⚠️ risky" : "⚠️ 有风险") : ""].filter(Boolean).join(" · ")}</p>
{why && <p className="mt-0.5 text-[11px] font-bold text-[var(--accent)]">⏰ {why}</p>}
<div className="mt-1.5 flex gap-1.5">
<button type="button" disabled={!!why} onClick={() => startActivity(a)} className="flex-1 rounded-full bg-[var(--text)] py-1.5 text-xs font-black text-[var(--bg)] disabled:opacity-40">{a.needs === "date" ? (en ? "💕 Ask someone" : "💕 约人") : (en ? "▶ Play" : "▶ 自己玩")}</button>
{groupable && <button type="button" disabled={!!why} onClick={() => hostParty(a)} className="flex-1 rounded-full border-2 border-[var(--text)] py-1.5 text-xs font-black disabled:opacity-40">{en ? "👥 Open a party" : "👥 组局"}</button>}
</div>
</div> ); })}
</div>
</div>
))}
</div> ); })()}
{(() => {
const svc = nearbyServices(s.cityKey, selLoc.id).filter((r) => r.id !== selLoc.id);
if (svc.length === 0) return null;
const er = svc.find((r) => r.place.kind === "hospital");
return (
<Fold title="🆘 附近服务 · Emergency & Services" summary={`急救 120 · 报警 110${er ? ` · 最近医院：${er.place.name}` : ""}`} groupKey={`svc-${selLoc.id}`} defaultOpen={selLoc.type === "apec"}>
<div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
{([["120", "🚑", "急救", "Ambulance"], ["110", "🚓", "报警", "Police"], ["119", "🚒", "火警", "Fire"], ["12345", "☎️", "市民热线", "City hotline"]] as const).map(([n, e, zh, en]) => (
<a key={n} href={`tel:${n}`} className="rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-2 py-1.5 text-center"><span className="block text-sm font-black">{e} {n}</span><span className="block text-[10px] font-bold text-[var(--dim)]">{zh} · {en}</span></a>
))}
</div>
<div className="mt-2 grid gap-1.5">
{svc.map((r) => { const k = PLACE_KINDS[r.place.kind]; return (
<button key={r.id} type="button" disabled={walking} onClick={() => walkTo(r.id, r.dist < 1.6 ? "walk" : undefined)} className="act-btn disabled:opacity-40">
<span className="text-sm font-bold">{k.emoji} {r.place.name}{r.place.er ? " · 🚑 急诊" : ""}</span>
{r.place.en && <span className="block text-[11px] text-[var(--dim)]">{r.place.en}</span>}
<span className="block text-xs text-[var(--dim)]">{k.label} · 约 {Math.max(0.1, r.dist).toFixed(1)} 公里 · 近「{r.place.st.replace(/站$/, "")}」站{r.place.tel ? ` · 📞 ${r.place.tel}` : ""}{r.place.addr ? ` · ${r.place.addr}` : ""}</span>
</button>
); })}
</div>
<p className="mt-2 text-[11px] leading-relaxed text-[var(--dim)]">医院、药店、派出所的位置和电话来自 OpenStreetMap，可能有变动；身体不适或紧急情况请直接拨打 120 / 110。Locations from OpenStreetMap; in an emergency call 120 (ambulance) or 110 (police).</p>
</Fold>
);
})()}
{(() => {
const near = nearbyPlaces(s.cityKey, selLoc.id, 6);
if (near.length === 0) return null;
return (
<Fold title="🧭 附近可去" summary={near.slice(0, 3).map((r) => r.place.name).join("、")} groupKey={`near-${selLoc.id}`} defaultOpen={selLoc.type === "transit"}>
<div className="grid gap-2">
{near.map((r) => { const k = PLACE_KINDS[r.place.kind]; const km = r.dist; return (
<button key={r.id} type="button" disabled={walking} onClick={() => walkTo(r.id, km < 1.6 ? "walk" : undefined)} className="act-btn disabled:opacity-40">
<span className="text-sm font-bold">{k.emoji} {r.place.name}</span>
<span className="block text-xs text-[var(--dim)]">{k.label} · 离这里约 {km < 0.1 ? "0.1" : km.toFixed(1)} 公里 · {km < 1.6 ? `步行约 ${Math.max(1, Math.round(km * 1.3 / 0.075))} 分钟` : "用下方选好的出行方式过去"}</span>
</button>
); })}
</div>
</Fold>
);
})()}
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
<p className="mt-1 text-xs text-[var(--dim)]">{scenicOf(s.cityKey, selLoc.id)?.tip} · 本城已打卡 {(s.visitedScenic ?? []).filter((k) => k.startsWith(s.cityKey + ":")).length} / {scenicTotal(s.cityKey)} 处，用上方「拍照打卡」集齐风景册。</p>
</div>
) : null}
{selLoc.type === "home" && arrived && (
<Fold title="🏠 我的家 · 户型 / 衣柜 / 装修 / 家具" summary={`${homeName(s)} · 舒适度 ${computeComfort(s)} · 家具 ${s.furniture.length} 件 · 食材 ×${s.groceries}`} groupKey="home-panel">
{renderHomePanel(s)}
</Fold>
)}
</div>
{(() => { const col = meta.collect; const peaks = Object.keys(col).filter((k) => k.startsWith("peak:")); const total = DROP_SETS.reduce((n, st) => n + st.items.length, 0); const got = DROP_SETS.reduce((n, st) => n + st.items.filter((x) => col[x.id]).length, 0); return (
<Fold title={en ? "📔 Collection book" : "📔 收藏图鉴"} summary={en ? `${got}/${total} found · ${peaks.length} summits · kept across runs` : `已收集 ${got}/${total} · 登顶 ${peaks.length} 座 · 跨局保留`} groupKey="collect">
<div className="grid gap-3">
{DROP_SETS.map((st) => (
<div key={st.id}>
<p className="text-xs font-black">{L2t(st.name)} <span className="text-[var(--dim)]">{st.items.filter((x) => col[x.id]).length}/{st.items.length}</span></p>
<div className="mt-1 flex flex-wrap gap-1.5">{st.items.map((x) => <span key={x.id} title={col[x.id] ? L2t(x.name) : "？"} className={`chip ${x.rarity === 3 && col[x.id] ? "border-[var(--gold)]" : ""}`}>{col[x.id] ? `${x.emoji} ${L2t(x.name)}${col[x.id]! > 1 ? ` ×${col[x.id]}` : ""}` : `❓${"★".repeat(x.rarity)}`}</span>)}</div>
</div>
))}
<div><p className="text-xs font-black">{en ? "🚩 Summits" : "🚩 登顶记录"} <span className="text-[var(--dim)]">{peaks.length}</span></p><p className="mt-1 text-xs text-[var(--dim)]">{peaks.length ? peaks.map((k) => { const l = resolveLoc(s.cityKey, k.slice(5)) ?? resolveLoc(s.cityKey === "sz" ? "hz" : "sz", k.slice(5)); return l ? (en ? trText(l.name) : l.name) : k.slice(5); }).join(" · ") : (en ? "Climb a mountain to plant your first flag." : "去爬座山，插下第一面旗。")}</p></div>
</div>
</Fold> ); })()}
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
{(world?.feed ?? []).length === 0 && <p className="text-sm text-[var(--dim)]">还没有动态。你进城的消息会出现在这里，其他玩家的晋升、峰会服务和结算也会。</p>}
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
<p className="text-[11px] leading-relaxed text-[var(--dim)]">街坊们每天自己发动态、互相评论：聊天气、聊峰会、聊你升职和搬新家的事。你可以点赞、评论，他们会记住你、也可能回你。</p>
<div className="mt-2 grid max-h-[520px] gap-2 overflow-y-auto pr-0.5">
{(s.npcFeed ?? []).length === 0 && <p className="text-sm text-[var(--dim)]">街坊墙还空着，睡一觉到明天，他们就会热闹起来。</p>}
{(s.npcFeed ?? []).map((post) => {
const author = NPCS.find((n) => n.name === post.author);
const aMem = memOf(s.npcMem ?? {}, post.author);
const kindTag: Record<NpcPost["kind"], string> = { weather: "🌦️ 天气", apec: "🌐 峰会", player: "📣 关于你", life: "🏠 日常", work: "💼 工作", food: "🍜 吃食" };
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
{(world?.online ?? []).filter((p) => p.id !== myId).length > 0 && (
<div className="mt-2 grid gap-1.5">
<p className="text-xs font-black tracking-wide">🎁 给在线的玩家送点东西（对方上线就收到，每天最多 10 份）</p>
{(world?.online ?? []).filter((p) => p.id !== myId).slice(0, 8).map((p) => (
<div key={p.id} className="rounded-[12px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2">
<p className="flex flex-wrap items-center gap-1.5 text-xs font-bold"><button type="button" onClick={() => setCardOf(p.id)} className="underline decoration-dotted">{p.emoji} {p.name}</button><button type="button" onClick={() => openDm(p.id)} className="chip">💬</button>{p.title && <span className="chip" style={{ borderColor: "var(--gold)", color: "var(--gold)" }}>🏅 {p.title}</span>}<span className="text-[var(--dim)]">{`${CITIES[p.cityKey === "hz" ? "hz" : "sz"].name}${(companyById(p.employer).city ?? "sz") === p.cityKey ? ` · ${companyById(p.employer).short}` : ""}`} · 🎫 {p.stamps} 站章</span>{p.employer === s.employer && p.cityKey === s.cityKey && (companyById(s.employer).city ?? "sz") === s.cityKey && <span className="chip">👥 同事</span>}</p>
<div className="mt-1.5 flex flex-wrap gap-1">
{(Object.keys(GIFTS) as GiftKind[]).filter((k) => k !== "invite").filter((k) => k !== "referral" || ((s.employer ?? "startup") !== "startup" && p.employer !== s.employer)).map((k) => (
<button key={k} type="button" aria-label={`给${p.name}送${GIFTS[k].name}`} disabled={s.money < GIFTS[k].cost} onClick={() => sendGift(p.id, p.name, k)} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-black disabled:opacity-40">{GIFTS[k].emoji} {GIFTS[k].name}{GIFTS[k].cost ? ` ¥${GIFTS[k].cost}` : `（${companyById(s.employer).short}）`}</button>
))}
</div>
</div>
))}
</div>
)}
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
<span className="min-w-0 flex-1 truncate" style={lookOf(b) && LOOK_COLOR[lookOf(b)!] ? { color: LOOK_COLOR[lookOf(b)!], fontWeight: 900 } : undefined}>{b.name}{lookOf(b) && LOOK_TITLE[lookOf(b)!] ? <span className="ml-1 rounded-full bg-[var(--surface2)] px-1.5 text-[10px]">{LOOK_TITLE[lookOf(b)!]![en ? 1 : 0]}</span> : null}{b.id === myId ? "（你）" : ""}</span>
<span className="text-xs text-[var(--dim)]">{CITIES[b.cityKey as CityKey]?.name ?? b.cityKey}</span>
<span className="font-black">{fmt(b.money, b.cityKey as CityKey)}</span>
<span className="hidden text-xs text-[var(--dim)] sm:inline">{b.status === "finished" ? b.resultTitle ?? "已结算" : `第 ${b.gameDay} 天 · ${(CAREERS[b.careerIdx] ?? CAREERS[0]!).name}`}</span>
</p>
))}
<p className="text-[11px] leading-relaxed text-[var(--dim)]">按当前存款排序，进行中的玩家也会实时上榜；过完 30 天的成绩会标上结局称号。</p>
<p className="mt-3 text-xs font-black tracking-wide">🏢 公司排行（最近 7 天在{city.name}上班的玩家，按存款合计）</p>
{(world?.companyBoard ?? []).length === 0 && <p className="text-xs text-[var(--dim)]">还没数据。</p>}
{(world?.companyBoard ?? []).map((c) => ({ ...c, co: employerHere({ employer: c.employer, cityKey: s.cityKey }) })).filter((c) => c.co).map((c, i) => { const co = c.co!; return (
<p key={c.employer} className={`flex items-center gap-2 rounded-[10px] px-3 py-1.5 text-sm ${c.employer === s.employer ? "bg-[var(--surface2)] font-black" : ""}`}><span className="w-6 font-black">{i + 1}</span><span>{co.emoji}</span><span className="min-w-0 flex-1 truncate">{co.name}{c.employer === s.employer ? "（你在这）" : ""}</span><span className="text-xs text-[var(--dim)]">{c.count} 人</span><span className="font-black">{fmt(c.money)}</span></p>
); })}
<p className="mt-3 text-xs font-black tracking-wide">🎫 集章排行（跨局累计）</p>
{(world?.stampBoard ?? []).length === 0 && <p className="text-xs text-[var(--dim)]">还没人盖章，去坐地铁吧。</p>}
{(world?.stampBoard ?? []).map((b, i) => (
<p key={b.id} className={`flex items-center gap-2 rounded-[10px] px-3 py-1.5 text-sm ${b.id === myId ? "bg-[var(--surface2)] font-black" : ""}`}><span className="w-6 font-black">{i + 1}</span><span>{b.emoji}</span><span className="min-w-0 flex-1 truncate">{b.name}{b.title ? ` · 🏅${b.title}` : ""}</span><span className="font-black">{b.stamps} 站</span></p>
))}
</div>
)}
{asideTab === "collect" && (() => {
const ck = s.cityKey;
const today = dateKey();
const lines = metroLinesForCity(ck).filter((l, i, arr) => arr.findIndex((x) => x.id === l.id) === i);
const stTotal = stationNamesOf(ck);
const stGot = stTotal.filter((n) => meta.stamps.includes(n)).length;
const kinds = Object.entries(PLACE_KINDS).map(([k, km]) => { const all = placesForCity(ck).filter((p) => p.kind === k); return { k, km, total: all.length, got: all.filter((p) => meta.atlas.includes(`${ck}:pl:${p.id}`)).length }; }).filter((x) => x.total > 0);
const ownLocs = getLocations(ck).filter((l) => l.id !== "home");
const ownGot = ownLocs.filter((l) => meta.atlas.includes(`${ck}:${l.id}`)).length;
const bar = (got: number, total: number, color = "var(--accent)") => <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[var(--surface2)]"><span className="block h-full rounded-full" style={{ width: `${total ? Math.round((got / total) * 100) : 0}%`, background: color }} /></span>;
return (
<div className="mt-3 max-h-[calc(100vh-190px)] min-w-0 overflow-y-auto overflow-x-hidden pr-1">
<div className="rounded-[14px] border-2 border-[var(--border)] bg-[var(--surface)] p-3">
<p className="flex flex-wrap items-center gap-2 text-sm font-black">🔥 连续上线 {meta.streak.count} 天 <span className="chip">最长 {meta.streak.best} 天</span> <span className="chip">已过完 {meta.runs} 局</span>{meta.title && <span className="chip" style={{ borderColor: "var(--gold)", color: "var(--gold)" }}>🏅 {meta.title}</span>}</p>
<p className="mt-1 text-xs text-[var(--dim)]">站章、图鉴、成就跨局保留：这一局 30 天过完，下一局接着集。</p>
<p className="mt-2 flex flex-wrap items-center gap-2 rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-xs font-bold">☁️ 云存档码 <span className="font-mono text-sm tracking-widest">{prettyCode(cloudCode())}</span><button type="button" onClick={() => { void navigator.clipboard?.writeText(cloudCode()).then(() => showToast("存档码已复制。换手机、换电脑时在开始页输入它，就能接着玩。")); }} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-black">复制</button><span className="text-[var(--dim)]">{cloudAt ? `已同步 ${cloudAt}` : "自动同步中"} · 别给陌生人</span></p>
<p className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold">⚙️ 画质：<button type="button" aria-pressed={!lite} onClick={() => { setQuality(false); window.location.reload(); }} className={`rounded-full px-2.5 py-1 text-[11px] font-black ${!lite ? "bg-[var(--text)] text-[var(--bg)]" : "border border-[var(--line)]"}`}>高画质</button><button type="button" aria-pressed={lite} onClick={() => { setQuality(true); window.location.reload(); }} className={`rounded-full px-2.5 py-1 text-[11px] font-black ${lite ? "bg-[var(--text)] text-[var(--bg)]" : "border border-[var(--line)]"}`}>省电（手机）</button><span className="text-[var(--dim)]">切换会刷新页面</span></p>
<p className="mt-2 rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-xs font-bold">{todayEvent.emoji} 今日城市事件「{todayEvent.name}」：{todayEvent.desc}</p>
</div>
<p className="mt-4 text-xs font-black tracking-wide">🎯 本周目标（每周一重置）</p>
<div className="mt-2 grid gap-1.5">
{WEEKLY_GOALS.map((g) => { const got = meta.week.prog[g.id] ?? 0; const done = got >= g.target; const claimed = meta.week.claimed.includes(g.id); return (
<div key={g.id} className="flex items-center gap-2 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2">
<span className="text-lg">{g.emoji}</span>
<span className="min-w-0 flex-1 text-xs font-bold">{g.name} <span className="text-[var(--dim)]">{Math.min(got, g.target)}/{g.target}</span>{bar(Math.min(got, g.target), g.target, "var(--green)")}</span>
<button type="button" disabled={!done || claimed} onClick={() => { mutate((x) => { x.money += g.reward; }); updMeta((m) => { m.week.claimed = [...m.week.claimed, g.id]; }); floatReward(`+${fmt(g.reward)} 周目标`, "gold"); }} className="shrink-0 rounded-full bg-[var(--text)] px-2.5 py-1 text-[11px] font-black text-[var(--bg)] disabled:opacity-35">{claimed ? "已领" : `领 ¥${g.reward}`}</button>
</div>
); })}
</div>
<p className="mt-4 text-xs font-black tracking-wide">🎫 地铁集章 · {stGot}/{stTotal.length} 站（上下车、换乘、到站自动盖章）</p>
{bar(stGot, stTotal.length)}
<div className="mt-2 grid gap-1">
{lines.map((l) => { const names = [...new Set(l.stations.map((x) => x.name).filter((n) => !n.endsWith("方向")))]; const got = names.filter((n) => meta.stamps.includes(n)).length; const done = meta.linesDone.includes(l.id); return (
<details key={l.id} className="rounded-[10px] bg-[var(--bg)] px-2.5 py-1.5">
<summary className="flex cursor-pointer items-center gap-2 text-xs font-bold"><span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: l.colorCss }} /><span className="min-w-0 flex-1 truncate">{l.short}</span><span className="text-[var(--dim)]">{got}/{names.length}</span>{done && <span>🏁</span>}</summary>
<p className="mt-1 flex flex-wrap gap-1">{names.map((n) => <span key={n} className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${meta.stamps.includes(n) ? "text-white" : "border border-[var(--line)] text-[var(--dim)]"}`} style={meta.stamps.includes(n) ? { background: l.colorCss } : {}}>{n}</span>)}</p>
</details>
); })}
</div>
<p className="mt-4 text-xs font-black tracking-wide">📖 城市图鉴 · 去过就记下</p>
<div className="mt-2 grid grid-cols-2 gap-1.5">
<div className="rounded-[10px] bg-[var(--bg)] px-2.5 py-1.5 text-xs font-bold">🗺️ 游戏地点 <span className="text-[var(--dim)]">{ownGot}/{ownLocs.length}</span>{bar(ownGot, ownLocs.length, "var(--accent2)")}</div>
{kinds.map((x) => <div key={x.k} className="rounded-[10px] bg-[var(--bg)] px-2.5 py-1.5 text-xs font-bold">{x.km.emoji} {x.km.label} <span className="text-[var(--dim)]">{x.got}/{x.total}</span>{bar(x.got, x.total, "var(--accent2)")}</div>)}
</div>
<p className="mt-4 text-xs font-black tracking-wide">🏅 成就 · 点已解锁的戴上称号（别的玩家能看到）</p>
<div className="mt-2 grid gap-1.5">
{ACHIEVEMENTS.map((a) => { const got = meta.achievements.includes(a.id); const worn = meta.title === a.title; return (
<button key={a.id} type="button" disabled={!got} onClick={() => updMeta((m) => { m.title = worn ? null : a.title; })} className={`flex items-center gap-2 rounded-[12px] border px-3 py-2 text-left ${worn ? "border-[var(--gold)] bg-[var(--surface2)]" : "border-[var(--line)] bg-[var(--bg)]"} ${got ? "" : "opacity-45"}`}>
<span className="text-lg">{got ? a.emoji : "🔒"}</span>
<span className="min-w-0 flex-1"><span className="block text-xs font-black">{a.title}</span><span className="block text-[11px] text-[var(--dim)]">{a.desc}</span></span>
{got && <span className="shrink-0 text-[11px] font-black text-[var(--accent2)]">{worn ? "已佩戴 ✓" : "戴上"}</span>}
</button>
); })}
</div>
<p className="mt-3 text-[11px] text-[var(--dim)]">进度存在这台设备的浏览器里（开了云存档也会存一份到服务器）。今天：{today}</p>
<p className="mt-1 flex flex-wrap gap-3 text-[11px] font-bold text-[var(--dim)]"><button type="button" onClick={() => setLegalDoc("terms")} className="underline">用户协议 Terms</button><button type="button" onClick={() => setLegalDoc("privacy")} className="underline">隐私政策 Privacy</button><span>游戏中的公司与活动均为虚构</span></p>
</div>
);
})()}
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
) : <p className="mt-2 text-[11px] leading-relaxed text-[var(--dim)]">{`按顺序到达每一站自动打卡：每站 +${fmt(tour.rewardPerStop)}，走完全程再 +${fmt(tour.rewardFinish)}。在地图上点地点名、或坐车过去都算到达。`}</p>}
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
{/* 状态卡的开关也收在这条竖条上（原来是左边单独一个「状态」竖钮） */}
<button type="button" aria-label={barsHidden ? "展开状态卡" : "收起状态卡"} title={barsHidden ? "展开状态卡" : "收起状态卡"} aria-pressed={!barsHidden} onClick={() => setBarsHidden((h) => !h)} className={`flex w-9 flex-col items-center gap-0.5 rounded-[10px] px-0.5 py-1.5 text-base leading-none transition hover:bg-[var(--surface2)] ${barsHidden ? "" : "bg-[var(--surface2)]"}`}><span aria-hidden="true">💰</span><span className="text-[10px] font-black [writing-mode:vertical-rl]">状态</span></button>
<span className="my-0.5 h-px w-6 bg-[var(--line)]" aria-hidden="true" />
<span className="px-0.5 pb-1 pt-0.5 text-[11px] font-black tracking-widest text-[var(--dim)] [writing-mode:vertical-rl]" aria-hidden="true">地区面板</span>
{([["place", "📍", "地点"], ["collect", "🎫", "集章"], ["feed", "🏘️", "动态"], ["wall", "🧑‍🤝‍🧑", "街坊墙"], ["chat", "💬", "聊天"], ["board", "🏆", "排行"], ["guide", "📖", "图鉴"]] as const).map(([k, icon, label]) => (
<button key={k} type="button" aria-label={`展开地区面板 · ${label}`} title={`展开地区面板 · ${label}`} onClick={() => { setAsideTab(k); setAsideOpen(true); }} className={`flex w-9 flex-col items-center gap-0.5 rounded-[10px] px-0.5 py-1.5 text-base leading-none transition hover:bg-[var(--surface2)] ${asideTab === k ? "bg-[var(--surface2)]" : ""}`}><span aria-hidden="true">{icon}</span><span className="text-[10px] font-black [writing-mode:vertical-rl]">{label}</span></button>
))}
<button type="button" aria-label={asidePinned ? "取消固定收起" : "固定收起地区面板"} aria-pressed={asidePinned} title={asidePinned ? "已固定收起：面板不会自动弹出，点上面的图标才展开；再点取消" : "固定收起：面板不再自动弹出"} onClick={() => togglePin("aside")} className={`mt-1 flex w-9 flex-col items-center gap-0.5 rounded-[10px] px-0.5 py-1.5 text-base leading-none ${asidePinned ? "bg-[var(--text)] text-[var(--bg)]" : "hover:bg-[var(--surface2)]"}`}><span aria-hidden="true">📌</span><span className="text-[10px] font-black [writing-mode:vertical-rl]">{asidePinned ? "已固定" : "固定"}</span></button>
</div>
)}
</>
</main>

{/* ===== VENUE SCENES: dine / shop / stay ===== */}
{venueScene && venueScene.kind === "dine" && (() => { const r = RESTAURANTS.find((x) => x.id === venueScene.id); if (!r) return null; const ck = `dine-${r.id}`; return (
<div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={r.name}>
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
<div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={v.name}>
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
<div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={l.name}>
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
if (!rideBig) return (
<div className="fixed inset-x-0 bottom-3 z-[60] flex justify-center px-3" role="status" aria-label={en ? "Ride in progress" : "正在乘车"}>
<div className="flex w-full max-w-md items-center gap-3 rounded-[16px] border-2 border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-xl">
<span className="text-2xl">{isBus ? "🚌" : isDrive ? "🚗" : "🚕"}</span>
<span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{en ? `${isBus ? "Bus" : isDrive ? "Driving" : "Taxi"} to ${trText(rr.toName)}` : `${isBus ? "坐公交" : isDrive ? "开车" : "打车"}去${rr.toName}`}</span><span className="block truncate text-[11px] text-[var(--dim)]">{en ? "Watch it on the map" : `${step.caption} · 地图上看你在路上`}</span>
<span className="mt-1 block h-1 overflow-hidden rounded-full bg-[var(--surface2)]"><span className="block h-full bg-[var(--accent)] transition-all" style={{ width: `${Math.min(100, ((Date.now() - rr.startedAt) / rr.durMs) * 100)}%` }} /></span></span>
<button type="button" onClick={() => setRideBig(true)} className="shrink-0 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-black">{en ? "Inside view" : "车里看看"}</button>
</div>
</div>
);
return (
<div className="fixed bottom-3 right-3 z-[60] flex w-[min(400px,calc(100vw-24px))] justify-end" role="dialog" aria-label={isBus ? "公交车厢" : isDrive ? "自驾开车" : "出租车车厢"}>
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

{legalModal()}

{/* ===== 分享战绩 / 邀请朋友 ===== */}
{shareOpen && (
<div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label="分享战绩">
<div className="rise max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl">
<div className="flex items-center justify-between"><p className="text-lg font-black">📤 分享战绩 · 邀请朋友</p><button type="button" aria-label="关闭分享" onClick={() => setShareOpen(false)} className="rounded-full border border-[var(--line)] px-3 py-1 text-sm font-black">✕</button></div>
<div className="mt-3 overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--bg)]">
{shareImg ? <img src={shareImg.url} alt="我的深惠人生战绩卡" className="block w-full" /> : <p className="p-8 text-center text-sm text-[var(--dim)]">正在生成战绩卡…</p>}
</div>
<div className="mt-3 grid grid-cols-2 gap-2">
<button type="button" onClick={() => void shareNative()} className="rounded-full bg-[var(--accent)] py-3 text-sm font-black text-white">📲 分享给朋友</button>
{shareImg ? <a href={shareImg.url} download="深惠人生战绩.png" className="rounded-full bg-[var(--text)] py-3 text-center text-sm font-black text-[var(--bg)]">⬇️ 保存图片</a> : <span />}
</div>
<button type="button" onClick={() => void copyInvite()} className="mt-2 w-full rounded-full border-2 border-[var(--border)] py-2.5 text-sm font-black">🔗 复制邀请链接</button>
<p className="mt-2 break-all rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-[11px] text-[var(--dim)]">{profile && s && myPub ? inviteLink(myPub, profile.name, s.employer) : "（联网后生成）"}</p>
<p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">朋友用这个链接进来：开局多 ¥100{s && (s.employer ?? "startup") !== "startup" ? `，还自带${companyById(s.employer).short}的内推` : ""}；他玩满 3 天、和真人组过一次局后，你收到 ¥200 邀请奖励（同一台设备或同一个网络的账号不算，每周最多 10 份）。</p>
</div>
</div>
)}

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
if (!rideBig) return (
<div className="fixed inset-x-0 bottom-3 z-[60] flex justify-center px-3" role="status" aria-label={`${curLine.name}`}>
<div className="w-full max-w-md overflow-hidden rounded-[16px] border-2 border-[var(--border)] bg-[var(--surface)] shadow-xl">
<p className="flex items-center justify-between px-3 py-1.5 text-xs font-black text-white" style={{ background: curLine.colorCss }}><span>{isRailRide ? "🚄" : "🚇"} {curLine.short}</span><span>{Math.min(c.stopIdx + 1, total)}/{total}</span></p>
<div className="flex items-center gap-2 px-3 py-2">
<span className="min-w-0 flex-1 text-sm font-bold">{rideEntry !== null ? (en ? "Entering the station…" : `进站中：${ENTRY_STEPS[rideEntry]!.caption}`) : c.awaitingTransfer ? (en ? `Change at ${curStation?.name ?? ""}` : `${curStation?.name ?? ""}站换乘`) : arrivedC ? (en ? `Arrived: ${curStation?.name ?? ""}` : `到站：${curStation?.name ?? ""}`) : (en ? `${curStation?.name ?? ""} → ${nextStation?.name ?? ""}` : `${curStation?.name ?? ""} → 下一站 ${nextStation?.name ?? ""}`)}
<span className="block text-[11px] font-normal text-[var(--dim)]">{en ? "The train is running on the map" : "列车正在地图上沿线路开"}</span></span>
{c.awaitingTransfer ? <button type="button" onClick={doTransfer} className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-black text-white">{en ? "Change" : "换乘上车"}</button>
 : arrivedC ? <button type="button" onClick={() => finishMetroRide()} className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-black text-white">{en ? "Get off" : "下车出站"}</button> : null}
<button type="button" onClick={() => setRideBig(true)} className="shrink-0 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-black">{en ? "Carriage" : "车厢里看看"}</button>
</div>
</div>
</div>
);
return (
<div className="fixed bottom-3 right-3 z-[60] flex w-[min(400px,calc(100vw-24px))] justify-end" role="dialog" aria-label={`${curLine.name}车厢`}>
<div className="rise max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-0 shadow-xl">
{/* carriage header: line strip */}
<div className="p-4 pb-3 text-white" style={{ background: curLine.colorCss }}>
<p className="flex items-center justify-between text-xs font-black"><span>{isRailRide ? "🚄" : "🚇"} {curLine.name}{c.route.isTransfer ? ` · 全程 ${c.route.summary}` : ""}</span><span>{c.crowdLabel}</span></p>
<p className="font-display mt-1 text-2xl font-black">{c.awaitingTransfer ? `换乘站 · ${curStation?.name}站` : arrivedC ? `已到达 · ${curStation?.name}站` : `下一站 · ${nextStation?.name ?? ""}`}</p>
<p className="mt-0.5 text-xs opacity-90">{locById(c.fromLoc).name} → {locById(c.toLoc).name} · 共 {c.route.stops} 站{c.route.isTransfer ? ` · 换乘 ${c.route.transferStations.length} 次（${c.route.transferStations.join("、")}）` : ""} · 票价 {Y}{c.route.fare} · {c.seated ? "💺 坐着" : "🧍 站着扶杆"}</p>
</div>
{/* route strip */}
<div ref={routeStripRef} className="relative flex items-center gap-0 overflow-x-auto px-4 pt-3 [scrollbar-width:none]">
{c.route.stations.map((st, i) => (
<span key={st.name + i} data-stop={i} className="flex shrink-0 items-center">
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
<button type="button" aria-label="车厢里看手机" disabled={c.phoneUsed} onClick={() => { setCarriage({ ...c, phoneUsed: true }); setCarriageLog("📱 你打开手机刷了刷：峰会资讯、天气和同城动态都看了一眼，时间过得快了些，心情 +2（下车结算）。"); }} className="act-btn disabled:opacity-40"><span className="text-sm font-black">📱 看手机</span><span className="block text-xs text-[var(--dim)]">{c.phoneUsed ? "刚看过，信号在隧道里时断时续" : "刷资讯/动态，解闷，心情 +2"}</span></button>
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
<>
<button type="button" disabled={!arrivedC} onClick={() => finishMetroRide()} className="w-full rounded-full bg-[var(--accent)] py-3.5 text-sm font-black text-white disabled:opacity-40">{arrivedC ? `🔔 到站了，下车出站 → ${locById(c.toLoc).name}（票 ${Y}${c.route.fare}）` : `行驶中… 还有 ${total - 1 - c.stopIdx} 站（自动报站中）`}</button>
{!arrivedC && c.stopIdx > 0 && curStation && (
<button type="button" onClick={() => finishMetroRide(c.stopIdx)} className="mt-2 w-full rounded-full border-2 border-[var(--border)] bg-[var(--surface)] py-2.5 text-sm font-black">🚪 就在「{curStation.name}」下车（票 {Y}{partialFare(c.route, c.stopIdx)}）</button>
)}
</>
)}
<p className="mt-2 text-center text-[11px] text-[var(--dim)]">{s.cityKey === "hz" ? "真实城轨/高铁乘车体验" : s.cityKey === "hk" ? "真实港铁乘车体验" : "真实深圳地铁体验"}：屏蔽门、先下后上、换乘站广播、早高峰挤车厢。车停稳时可以随时在本站下车，按实际坐的里程扣费。</p>
</div>
</div>
</div>
);
})()}

{placesMapOpen && (
<PlacesMapModal cityKey={s.cityKey} fromLocId={currentLoc} onClose={() => setPlacesMapOpen(false)}
onGo={(id) => { setPlacesMapOpen(false); walkTo(id); }}
onLocate={(x, z, name) => { setPlacesMapOpen(false); setMapFocus({ x, z, nonce: Date.now() }); showToast(`📍 已在地图上定位到「${name}」。`); }} />
)}

{metroMapOpen && (
<MetroMapModal cityKey={s.cityKey} fromLocId={currentLoc} initialDest={metroMapDest} onClose={() => setMetroMapOpen(false)}
onRide={(fromName, toName) => { setMetroMapOpen(false); rideStations(fromName, toName); }}
onLocate={(x, z, name) => { setMetroMapOpen(false); setMapFocus({ x, z, nonce: Date.now() }); showToast(`📍 已在地图上定位到「${name}」站。`); }} />
)}

{/* ===== LIFE ANIMATION SCENE ===== */}
{lifeAnim && (() => { const scene = LIFE_SCENES[lifeAnim.kind]; const rawStep = scene.steps[Math.min(lifeAnim.idx, scene.steps.length - 1)]!; /* Huizhou has no metro: in the day montage the 换乘地铁 beat is a 城轨 beat there */ const step = s.cityKey === "hz" && rawStep.caption === "换乘地铁" ? { ...rawStep, caption: "换乘城轨", prop: "🚆", bg: "🚆 👥 👥" } : rawStep; const rainyDay = nowRainy; return (
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
<PhotoCreditLine url={SCENE_PHOTOS[lifeStageFor(lifeAnim.kind, lifeAnim.idx).set]} />
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

{/* ===== 现在能干嘛 ===== */}
{hubOpen && (() => {
const ck = s.cityKey;
const here = locById(currentLoc);
const allLocs: Loc[] = [...getLocations(ck), ...placesForCity(ck).map((pl) => resolveLoc(ck, pl.id)).filter((x): x is Loc => !!x)];
const rows = (Object.keys(CAT_LABEL) as ActCat[]).flatMap((c) => ACTIVITIES_LIST.filter((a) => a.cat === c)).map((a) => {
  const cands = allLocs.filter((l) => { try { return a.at(l); } catch { return false; } }).map((l) => ({ l, d: Math.hypot(l.x - here.x, l.z - here.z), why: actBlock(a, s, true, l) })).sort((x, y) => (x.why ? 1 : 0) - (y.why ? 1 : 0) || x.d - y.d);
  return { a, best: cands[0], n: cands.length };
}).filter((r) => r.best && (hubCat === "all" || r.a.cat === hubCat) && (!hubOpenOnly || !r.best.why));
const todo: { t: string; go?: () => void }[] = [];
if (s.workDay !== s.day && employerHere(s)) todo.push({ t: en ? `💼 Haven't worked today — ${companyById(s.employer).short}` : `💼 今天还没上班：${companyById(s.employer).short}`, go: () => { const co = employerHere(s); if (co?.locIds[0]) { setHubOpen(false); walkTo(co.locIds[0]); } } });
if (s.sleptDay !== s.day && nowMin() >= 21 * 60) todo.push({ t: en ? "😴 Time for bed — go home and sleep" : "😴 不早了，回家睡觉", go: () => { setHubOpen(false); goHomeAndSleep(); } });
if (isSaturday(s.day)) todo.push({ t: en ? `🏠 Rent ${fmt(s.rent)} is due tonight` : `🏠 今晚交租 ${fmt(s.rent)}` });
for (const st of STORIES.filter((x) => npcsForCity(s.cityKey).some((n) => n.name === x.npc))) { const k = storyStatus(st, s.story?.[st.npc], memOf(s.npcMem ?? {}, st.npc).rel, s.day).kind; if (k === "ready" || k === "ending") todo.push({ t: en ? `📖 ${trText(st.npc)}'s story has a new chapter` : `📖 ${st.npc}的故事有新章节`, go: () => { setHubOpen(false); openNpcChat(st.npc); } }); }
const openParties = parties.filter((pt) => pt.status === "open" && !pt.members.some((m) => m.id === myId));
if (openParties.length) todo.push({ t: en ? `🎉 ${openParties.length} open part${openParties.length > 1 ? "ies" : "y"} in the city` : `🎉 城里有 ${openParties.length} 个局在等人`, go: () => { setHubOpen(false); setPartyOpen(true); } });
if (!loggedIn && s.day >= 2) todo.push({ t: en ? "👤 Link an account so you never lose progress (and unlock DMs and parties)" : "👤 绑定账号：进度不丢，还能私聊、组局", go: () => { setHubOpen(false); setAccountOpen(true); } });
if (unreadDm) todo.push({ t: en ? `💬 ${unreadDm} unread message${unreadDm > 1 ? "s" : ""}` : `💬 ${unreadDm} 条未读私信`, go: () => { setHubOpen(false); setDmOpen(true); } });
return (
<div className="fixed inset-0 z-[66] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={en ? "What can I do now" : "现在能干嘛"}>
<div className="rise flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)]">
<div className="border-b border-[var(--line)] p-4">
<p className="flex items-center justify-between gap-2"><span className="font-display text-xl font-black">🧭 {en ? "What can I do now?" : "现在能干嘛？"}</span><span className="flex items-center gap-2"><span className="text-xs font-bold text-[var(--dim)]">{en ? `Beijing time ${clockStr(nowMin())}` : `北京时间 ${clockStr(nowMin())}`}</span><button type="button" onClick={() => setHubOpen(false)} className="rounded-full border px-3 py-1 text-xs font-black">✕</button></span></p>
{todo.length > 0 && <div className="mt-2 grid gap-1.5 sm:grid-cols-2">{todo.map((x, i) => <button key={i} type="button" disabled={!x.go} onClick={x.go} className="rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-left text-xs font-black">{x.t}{x.go ? " →" : ""}</button>)}</div>}
<div className="mt-3 flex flex-wrap gap-1.5">
<button type="button" onClick={() => setHubCat("all")} className={`chip ${hubCat === "all" ? "bg-[var(--text)] text-[var(--bg)]" : ""}`}>{en ? "All" : "全部"}</button>
{(Object.keys(CAT_LABEL) as ActCat[]).map((c) => <button key={c} type="button" onClick={() => setHubCat(c)} className={`chip ${hubCat === c ? "bg-[var(--text)] text-[var(--bg)]" : ""}`}>{L2t(CAT_LABEL[c])}</button>)}
<label className="chip cursor-pointer"><input type="checkbox" checked={hubOpenOnly} onChange={(e) => setHubOpenOnly(e.target.checked)} className="mr-1" />{en ? "Open now only" : "只看现在能玩"}</label>
</div>
</div>
<div className="grid flex-1 gap-2 overflow-y-auto p-4 sm:grid-cols-2">
{rows.length === 0 && <p className="text-sm text-[var(--dim)]">{en ? "Nothing open in this category right now — untick \"Open now only\" to see when things open." : "这个分类现在没有能玩的——取消「只看现在能玩」，看看什么时候开门。"}</p>}
{rows.map(({ a, best, n }) => { const atHere = best!.l.id === currentLoc; return (
<div key={a.id} className="rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-2.5">
<p className="flex items-center justify-between gap-2 text-sm font-black"><span>{a.emoji} {L2t(a.name)}</span><span className="text-[10px] font-bold text-[var(--dim)]">{L2t(CAT_LABEL[a.cat])}</span></p>
<p className="mt-0.5 text-xs text-[var(--dim)]">{L2t(a.desc)}</p>
<p className="mt-1 text-[11px] font-bold">{atHere ? (en ? "📍 Right here" : "📍 就在这儿") : `📍 ${en ? trText(best!.l.name) : best!.l.name} · ${en ? "about" : "约"} ${etaMinutes(travelMode, best!.d)} ${en ? "min away" : "分钟路程"}`}{n > 1 ? (en ? ` · ${n} places` : ` · 共 ${n} 处`) : ""}</p>
{best!.why && <p className="text-[11px] font-bold text-[var(--accent)]">⏰ {best!.why}</p>}
<button type="button" onClick={() => { setHubOpen(false); if (atHere) { setSelectedLoc(best!.l.id); startActivity(a, { locId: best!.l.id }); } else { setSelectedLoc(best!.l.id); walkTo(best!.l.id); } }} className="mt-1.5 w-full rounded-full bg-[var(--text)] py-1.5 text-xs font-black text-[var(--bg)]">{atHere ? (en ? "▶ Play here" : "▶ 就在这儿玩") : (en ? "Go there →" : "去这里 →")}</button>
</div> ); })}
</div>
</div>
</div> ); })()}

{/* ===== 玩家名片 ===== */}
{cardOf && (() => { const c = cardQuery.data?.card; const ol = (world?.online ?? []).find((x) => x.id === cardOf); return (
<div className="fixed inset-0 z-[67] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={en ? "Player card" : "玩家名片"}>
<div className="rise w-full max-w-sm rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
<div className="flex items-start gap-3">
<span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--surface2)] text-3xl">{c?.emoji ?? ol?.emoji ?? "🙂"}</span>
<div className="min-w-0 flex-1">
<p className="font-display text-xl font-black">{c?.name ?? ol?.name ?? "…"}</p>
<p className="text-xs text-[var(--dim)]">{c ? `${c.online ? "🟢 " : "⚪ "}${en ? trText(CITIES[c.cityKey === "hz" ? "hz" : "sz"].name) : CITIES[c.cityKey === "hz" ? "hz" : "sz"].name} · ${en ? "Day" : "第"} ${c.gameDay}${en ? "" : " 天"} · ${(CAREERS[c.careerIdx] ?? CAREERS[0]!).name} · ${companyById(c.employer).short}` : (en ? "Loading…" : "加载中……")}</p>
{c && <p className="mt-1 flex flex-wrap gap-1">{c.title && <span className="chip" style={{ borderColor: "var(--gold)", color: "var(--gold)" }}>🏅 {c.title}</span>}<span className="chip">🎫 {c.stamps}</span>{c.buddy > 0 && <span className="chip">🤝 {en ? `played together ×${c.buddy}` : `一起玩过 ${c.buddy} 次`}</span>}</p>}
</div>
<button type="button" onClick={() => setCardOf(null)} className="shrink-0 rounded-full border px-3 py-1 text-xs font-black">✕</button>
</div>
<div className="mt-3 grid grid-cols-2 gap-2">
<button type="button" disabled={c?.blocked} onClick={() => openDm(cardOf)} className="rounded-full bg-[var(--text)] py-2.5 text-sm font-black text-[var(--bg)] disabled:opacity-40">💬 {en ? "Message" : "私聊"}</button>
<button type="button" disabled={c?.blocked} onClick={() => inviteToParty(cardOf)} className="rounded-full bg-[var(--accent)] py-2.5 text-sm font-black text-white disabled:opacity-40">👥 {en ? "Invite to party" : "邀请组局"}</button>
<button type="button" disabled={s.money < GIFTS.tea.cost} onClick={() => sendGift(cardOf, c?.name ?? ol?.name ?? "", "tea")} className="rounded-full border-2 border-[var(--text)] py-2 text-xs font-black disabled:opacity-40">{GIFTS.tea.emoji} {en ? `Send a bubble tea ¥${GIFTS.tea.cost}` : `请杯${GIFTS.tea.name} ¥${GIFTS.tea.cost}`}</button>
<button type="button" onClick={() => blockNow(cardOf, !c?.blocked)} className="rounded-full border-2 border-[var(--line)] py-2 text-xs font-black">{c?.blocked ? (en ? "Unblock" : "取消拉黑") : (en ? "🚫 Block" : "🚫 拉黑")}</button>
</div>
<details className="mt-2 text-xs"><summary className="cursor-pointer font-black text-[var(--dim)]">⚠️ {en ? "Report" : "举报"}</summary>
<div className="mt-1.5 flex flex-wrap gap-1.5">{([["harassment", "骚扰", "Harassment"], ["scam", "诈骗", "Scam"], ["spam", "广告刷屏", "Spam"], ["inappropriate", "不当内容", "Inappropriate"], ["minor", "疑似未成年人安全问题", "Child safety"], ["other", "其他", "Other"]] as const).map(([k, zh, e]) => <button key={k} type="button" onClick={() => reportNow(cardOf, k)} className="chip">{en ? e : zh}</button>)}</div>
</details>
<p className="mt-2 text-[11px] text-[var(--dim)]">{en ? "Never share passwords, codes or payment details in chat. Anyone asking you to move to another app or send money is likely a scam." : "聊天里不要透露密码、验证码和付款信息；让你转到别的 App 或者转账的，大概率是诈骗。"}</p>
</div>
</div> ); })()}

{/* ===== 私信 ===== */}
{crossTo && (() => { const routes = crossRoutes(s.cityKey, crossTo); const tn = nowMin(); const here = currentLoc; const nameOf = (ck: CityKey, id: string) => id === "*" ? "你现在的位置" : getLocations(ck).find((l) => l.id === id)?.name ?? id; return (
<div className="fixed inset-0 z-[75] grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={`去${CITIES[crossTo].name}的路线`} onClick={() => setCrossTo(null)}>
<div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--text)]" onClick={(e) => e.stopPropagation()}>
<div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-black">🧭 {en ? `To ${CITY_EN[crossTo]}: pick a route` : `去${CITIES[crossTo].name}：选一条路`}</h2><button type="button" onClick={() => setCrossTo(null)} aria-label="关闭" className="text-xl">✕</button></div>
<p className="mb-3 text-xs text-[var(--dim)]">{en ? `Real routes with real opening hours (Beijing time ${clockStr(tn)}). Each one arrives at its own port or station across the border; if you are not at the start, you will be taken there first. Your progress comes with you.` : `都是真实线路，按真实开放时间（北京时间 ${clockStr(tn)}）。从哪儿出发就到对面哪个口岸 / 车站；不在出发点会先带你过去。进度、家当原样带着走。`}</p>
<div className="grid gap-2">
{routes.map((r) => { const open = isCrossOpen(r, tn); const atStart = r.fromLoc === "*" || here === r.fromLoc; return (
<div key={r.id} className={`rounded-[14px] border p-3 ${open ? "border-[var(--line)]" : "border-dashed border-[var(--line)] opacity-60"}`}>
<p className="text-sm font-black">{r.emoji} {crossName(r, en)}</p>
<p className="mt-0.5 text-xs font-bold">{nameOf(r.from, r.fromLoc)} → {nameOf(r.to, r.toLoc)}</p>
<p className="mt-1 text-xs text-[var(--dim)]">{crossNote(r, en)}</p>
<div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold">
{!r.shut && <span className="chip">{crossFareStr(r, en)}</span>}{!r.shut && <span className="chip">⏱ {r.min} {en ? "min" : "分钟"}</span>}<span className={`chip ${open ? "" : "border-red-400 text-red-500"}`}>{r.shut ? `⛔ ${crossHoursStr(r, en)}` : open ? `🟢 ${en ? "Open" : "开放"} ${crossHoursStr(r, en)}` : `⛔ ${en ? "Not running" : "已停"} · ${crossHoursStr(r, en)}`}</span>{r.car && !r.shut && <span className="chip">🪪 {en ? "Needs a licence and a car" : "要驾照和车"}</span>}
<button type="button" disabled={!open} onClick={() => takeRoute(r)} className="ml-auto rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-xs font-black text-white disabled:opacity-40">{r.shut ? (en ? "Closed" : "不开放") : atStart ? (en ? "Go" : "出发") : en ? `Go to ${trText(nameOf(r.from, r.fromLoc))} first` : `先去${nameOf(r.from, r.fromLoc)}`}</button>
</div>
</div>); })}
</div>
</div>
</div>); })()}
{rideBig && (roadRide || carriage) && <button type="button" onClick={() => setRideBig(false)} className="fixed bottom-3 right-[min(412px,calc(100vw-12px))] z-[61] rounded-full border-2 border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-black shadow-xl">▾ {en ? "Fold" : "收起"}</button>}
{storeOpen && phase === "game" && <StoreModal en={en} onClose={() => setStoreOpen(false)} toast={showToast} openAccount={() => setAccountOpen(true)} />}
{accountOpen && phase === "game" && <AccountModal en={en} playerId={profile?.playerId ?? null} saveKey={LS_KEY} onClose={() => setAccountOpen(false)} toast={showToast} onChange={(v) => { setLoggedIn(v); track(v ? "account_login" : "account_logout"); }} />}
{dmOpen && (() => { const th = threads.find((t) => t.peerId === dmPeer); const peerName = th?.peerName ?? (world?.online ?? []).find((x) => x.id === dmPeer)?.name ?? ""; return (
<div className="fixed inset-0 z-[66] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={en ? "Private messages" : "私信"}>
<div className="rise flex h-[80vh] w-full max-w-2xl overflow-hidden rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)]">
<div className={`${dmPeer ? "hidden sm:block" : "block"} w-full overflow-y-auto border-r border-[var(--line)] sm:w-56`}>
<p className="flex items-center justify-between p-3 font-black">💬 {en ? "Messages" : "私信"}<button type="button" onClick={() => { setDmOpen(false); setDmPeer(null); }} className="rounded-full border px-2.5 py-0.5 text-xs">✕</button></p>
{threads.length === 0 && <p className="px-3 text-xs text-[var(--dim)]">{en ? "No messages yet. Tap a player's name on the map to say hi." : "还没有私信。点地图上玩家的名字，打个招呼吧。"}</p>}
{threads.map((t) => (
<button key={t.peerId} type="button" onClick={() => openDm(t.peerId)} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${t.peerId === dmPeer ? "bg-[var(--surface2)]" : ""}`}>
<span className="text-xl">{t.peerEmoji}</span><span className="min-w-0 flex-1"><span className="block truncate font-black">{t.online ? "🟢 " : ""}{t.peerName}</span><span className="block truncate text-[11px] text-[var(--dim)]">{(t.messages[t.messages.length - 1]?.body ?? "").replace(/^\[\[party:\d+\]\]$/, en ? "🎉 Party invite" : "🎉 组局邀请")}</span></span>{t.unread > 0 && <span className="rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-black text-white">{t.unread}</span>}
</button>
))}
</div>
{dmPeer && (
<div className="flex min-w-0 flex-1 flex-col">
<p className="flex items-center gap-2 border-b border-[var(--line)] p-3 text-sm font-black"><button type="button" onClick={() => setDmPeer(null)} className="sm:hidden">←</button><button type="button" onClick={() => setCardOf(dmPeer)} className="min-w-0 flex-1 truncate text-left underline decoration-dotted">{peerName}</button><button type="button" onClick={() => { setDmOpen(false); setDmPeer(null); }} className="rounded-full border px-2.5 py-0.5 text-xs">✕</button></p>
<div className="flex-1 overflow-y-auto p-3">
{(th?.messages ?? []).map((m) => { const inv = /^\[\[party:(\d+)\]\]$/.exec(m.body); const pt = inv ? parties.find((x) => x.id === Number(inv[1])) : undefined; const act = pt ? activityById(pt.activityId) : null; return (
<div key={m.id} className={`mb-1.5 max-w-[85%] rounded-[12px] px-3 py-2 text-[13px] ${m.mine ? "ml-auto bg-[var(--text)] text-[var(--bg)]" : "border border-[var(--line)] bg-[var(--bg)]"}`}>
{inv ? (pt && act ? <span>🎉 {en ? `Party invite: ${act.name[1]} at ${trText(pt.locName)}` : `组局邀请：${pt.locName} · ${act.name[0]}`}{!m.mine && pt.status === "open" && !pt.members.some((x) => x.id === myId) && <button type="button" onClick={() => { setDmOpen(false); joinPartyNow(pt); }} className="ml-2 rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-[11px] font-black text-white">{en ? "Join" : "加入"}</button>}</span> : <span className="opacity-70">{en ? "🎉 Party invite (this party has ended)" : "🎉 组局邀请（这个局已经结束了）"}</span>) : <span className="whitespace-pre-wrap break-words">{m.body}</span>}
</div> ); })}
</div>
<form className="flex gap-2 border-t border-[var(--line)] p-2" onSubmit={(e) => { e.preventDefault(); sendDmNow(dmPeer, dmInput); }}>
<input value={dmInput} onChange={(e) => setDmInput(e.target.value.slice(0, 300))} placeholder={en ? "Say something…" : "说点什么……"} aria-label={en ? "Message" : "消息"} className="min-w-0 flex-1 rounded-full border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm" />
<button type="submit" disabled={!dmInput.trim()} className="shrink-0 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-black text-white disabled:opacity-40">{en ? "Send" : "发送"}</button>
</form>
</div>
)}
</div>
</div> ); })()}

{/* ===== 小游戏 ===== */}
{play && <MiniGame spec={play.spec} title={`${play.act.emoji} ${L2t(play.act.name)}${play.mate ? (en ? ` with ${trText(play.mate)}` : ` · 和${play.mate}`) : ""}`} en={en} onDone={finishActivity} onQuit={() => setPlay(null)} />}

{/* ===== 约会：选人 ===== */}
{datePick && (
<div className="fixed inset-0 z-[66] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={en ? "Who to ask" : "约谁"}>
<div className="rise max-h-[85vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
<p className="flex items-center justify-between"><span className="font-display text-xl font-black">{datePick.emoji} {en ? `Who will you ask? · ${datePick.name[1]}` : `约谁一起？· ${datePick.name[0]}`}</span><button type="button" onClick={() => setDatePick(null)} className="rounded-full border px-3 py-1 text-xs font-black">✕</button></p>
<p className="mt-1 text-xs text-[var(--dim)]">{en ? "Neighbours you're close to (bond +15). Good dates build romance: Dating → It's complicated → Partners → Living together (rent halved)." : "关系到 +15 的街坊都能约。约会顺利会积累感情：约会对象 → 暧昧 → 恋人 → 同居（房租减半）。"}</p>
<div className="mt-3 grid gap-2">
{datePartners(s).map((n) => { const pts = s.romance?.[n.name] ?? 0; const st = ROMANCE_STAGES[romanceStage(pts)]!; return (
<button key={n.name} type="button" onClick={() => { const a = datePick; setDatePick(null); startActivity(a, { mate: n.name }); }} className="act-btn flex items-center gap-3 text-left">
<span className="text-2xl">{n.emoji}</span>
<span className="min-w-0 flex-1"><span className="block text-sm font-black">{en ? trText(n.name) : n.name} <span className="font-normal text-[var(--dim)]">· {en ? trText(n.job) : n.job}</span></span><span className="block text-[11px] text-[var(--dim)]">{en ? `Bond +${memOf(s.npcMem ?? {}, n.name).rel} · ${st.name[1]} (${pts})` : `关系 +${memOf(s.npcMem ?? {}, n.name).rel} · ${st.name[0]}（${pts}）`}</span></span>
</button> ); })}
</div>
</div>
</div>
)}

{/* ===== 组局广场 ===== */}
{partyOpen && (
<div className="fixed inset-0 z-[66] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={en ? "Parties" : "组局广场"}>
<div className="rise max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
<p className="flex items-center justify-between gap-2"><span className="font-display text-xl font-black">{en ? `🎉 Parties · ${trText(CITIES[s.cityKey].name)}` : `🎉 组局广场 · ${CITIES[s.cityKey].name}`}</span><button type="button" onClick={() => setPartyOpen(false)} className="rounded-full border px-3 py-1 text-xs font-black">✕</button></p>
<p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{en ? "Open a party from any place's \"Things to do here\" with 👥. Everyone in the city sees it and can join. Playing together lifts everyone's rewards, adds network, and counts up your \"buddy\" streak with each player. Nobody came? Start anyway — neighbours fill the seats." : "在任意地点的「在这里能玩」点 👥 组局，同城玩家都能看到、加入。一起玩每人奖励都有加成、人脉 +1，还会累计和每个人的「搭子」次数。没人来？照样开始，街坊会来凑数。"}</p>
<div className="mt-3 grid gap-2">
{parties.length === 0 && <p className="rounded-[12px] bg-[var(--surface2)] p-3 text-center text-sm text-[var(--dim)]">{en ? "No parties right now. Be the first to open one!" : "现在还没有局。去开第一个吧！"}</p>}
{parties.map((pt) => { const a = activityById(pt.activityId); const mine = pt.members.some((m) => m.id === myId); const host = pt.hostId === myId; const meM = pt.members.find((m) => m.id === myId); const there = currentLoc === pt.locId; return (
<div key={pt.id} className={`rounded-[14px] border-2 p-3 ${mine ? "border-[var(--accent)]" : "border-[var(--line)]"}`}>
<p className="flex items-center justify-between gap-2 text-sm font-black"><span>{a?.emoji} {a ? L2t(a.name) : pt.activityId} · {en ? trText(pt.locName) : pt.locName}</span><span className="shrink-0 text-[11px] text-[var(--dim)]">{pt.status === "open" ? (en ? "Waiting" : "等人中") : pt.status === "playing" ? (en ? "Playing" : "进行中") : (en ? "Finished" : "已结束")}</span></p>
<div className="mt-1.5 flex flex-wrap gap-1.5">{pt.members.map((m) => <span key={m.id} className="chip">{m.emoji} {m.name}{m.id === myId ? (en ? " (you)" : "（你）") : ""}{m.buddy > 0 ? ` · 🤝×${m.buddy}` : ""}{m.score !== null ? ` · ${Math.round(m.score * 100)}` : ""}</span>)}</div>
<div className="mt-2 flex flex-wrap gap-1.5">
{!mine && pt.status === "open" && <button type="button" onClick={() => joinPartyNow(pt)} className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-black text-white">{en ? "Join" : "加入"}</button>}
{mine && !there && pt.status !== "done" && <button type="button" onClick={() => { setPartyOpen(false); setSelectedLoc(pt.locId); walkTo(pt.locId); }} className="rounded-full bg-[var(--text)] px-4 py-1.5 text-xs font-black text-[var(--bg)]">{en ? "Go there" : "赶过去"}</button>}
{host && pt.status === "open" && <button type="button" disabled={!there} onClick={() => startPartyNow(pt)} className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-black text-white disabled:opacity-40">{pt.members.length > 1 ? (en ? "Start" : "开始") : (en ? "Start (neighbours fill in)" : "开始（街坊凑数）")}</button>}
{mine && pt.status === "playing" && meM?.score === null && a && <button type="button" disabled={!there} onClick={() => { setPartyOpen(false); startActivity(a, { partyId: pt.id, locId: pt.locId }); }} className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-black text-white disabled:opacity-40">{en ? "▶ Play now" : "▶ 开玩"}</button>}
{mine && pt.status === "open" && <button type="button" onClick={() => leavePartyNow(pt)} className="rounded-full border px-4 py-1.5 text-xs font-black">{host ? (en ? "Cancel" : "解散") : (en ? "Leave" : "退出")}</button>}
{mine && pt.status !== "open" && meM?.score !== null && <button type="button" onClick={() => { setPartyOpen(false); setPartyResult(pt.id); }} className="rounded-full border px-4 py-1.5 text-xs font-black">{en ? "Results" : "看结果"}</button>}
</div>
</div> ); })}
</div>
</div>
</div>
)}

{/* 局开始了：提醒还没玩的成员 */}
{!play && (() => { const pt = parties.find((x) => x.status === "playing" && x.members.some((m) => m.id === myId && m.score === null)); const a = pt ? activityById(pt.activityId) : null; if (!pt || !a) return null; const there = currentLoc === pt.locId; return (
<div className="fixed left-1/2 top-3 z-[60] flex w-[92%] max-w-md -translate-x-1/2 items-center gap-2 rounded-[14px] border-2 border-[var(--accent)] bg-[var(--surface)] px-3 py-2 text-sm font-black shadow-lg">
<span className="min-w-0 flex-1">🎉 {en ? `The party started: ${a.name[1]} at ${trText(pt.locName)}` : `局开始了：${pt.locName} · ${a.name[0]}`}</span>
{there ? <button type="button" onClick={() => startActivity(a, { partyId: pt.id, locId: pt.locId })} className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1 text-xs text-white">{en ? "Play" : "开玩"}</button>
: <button type="button" onClick={() => { setSelectedLoc(pt.locId); walkTo(pt.locId); }} className="shrink-0 rounded-full bg-[var(--text)] px-3 py-1 text-xs text-[var(--bg)]">{en ? "Go" : "赶过去"}</button>}
</div> ); })()}

{/* ===== 组局结果 ===== */}
{partyResult !== null && !play && (() => { const pt = parties.find((x) => x.id === partyResult); if (!pt) return null; const a = activityById(pt.activityId); const real = pt.members; const rows = [...real, ...(real.length === 1 ? ghostMates(pt.id) : [])].sort((x, y) => (y.score ?? -1) - (x.score ?? -1)); const waiting = real.some((m) => m.score === null) && pt.status !== "done"; return (
<div className="fixed inset-0 z-[66] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={en ? "Party results" : "组局结果"}>
<div className="rise w-full max-w-md rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] p-4">
<p className="font-display text-xl font-black">🏆 {a ? L2t(a.name) : ""} · {en ? trText(pt.locName) : pt.locName}</p>
{waiting && <p className="mt-1 text-xs font-bold text-[var(--dim)]">{en ? "Waiting for the others to finish…" : "等其他人玩完……"}</p>}
<div className="mt-3 grid gap-1.5">{rows.map((m, i) => (
<p key={m.id} className={`flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm ${m.id === myId ? "bg-[var(--surface2)] font-black" : ""}`}><span className="w-6 font-black">{m.score === null ? "…" : i + 1}</span><span>{m.emoji}</span><span className="min-w-0 flex-1 truncate">{m.id.startsWith("npc-") ? (en ? `${trText(m.name)} (neighbour)` : `${m.name}（街坊凑数）`) : m.name}{m.id === myId ? (en ? " (you)" : "（你）") : ""}</span>{m.buddy > 0 && <span className="text-[11px] text-[var(--dim)]">🤝×{m.buddy + (pt.status === "done" ? 1 : 0)}</span>}<span className="font-black">{m.score === null ? "—" : Math.round(m.score * 100)}</span></p>
))}</div>
<p className="mt-2 text-[11px] text-[var(--dim)]">{real.length > 1 ? (en ? "Playing with real players gave everyone a reward boost and +1 network. Your buddy count with each of them went up." : "和真人一起玩：每人奖励加成、人脉 +1，和每个人的「搭子」次数 +1。") : (en ? "Nobody else came this time — the neighbours filled in. Open a party earlier next time, or invite friends with your invite link." : "这次没有真人来，街坊来凑了数。下次早点组局，或者用邀请链接拉朋友来。")}</p>
<button type="button" onClick={() => setPartyResult(null)} className="mt-3 w-full rounded-full bg-[var(--text)] py-2.5 text-sm font-black text-[var(--bg)]">{en ? "Done" : "好的"}</button>
</div>
</div> ); })()}

{/* ===== NPC CHAT ===== */}
{npcChat && (() => { const npc = NPCS.find((n) => n.name === npcChat); if (!npc) return null; const mem = memOf(s.npcMem ?? {}, npcChat); const p = personaOf(npc); return (
<div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-label={`和${npc.name}聊天`}>
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
<button type="button" aria-label="结束聊天" onClick={() => { setNpcChat(null); setStoryOpen(null); }} className="shrink-0 rounded-full bg-black/25 px-3 py-1.5 text-sm font-black">✕</button>
</div>
<div className="px-4 pt-2.5">
<p className="text-[11px] leading-relaxed text-[var(--dim)]">🕐 作息：{scheduleOf(npc)} · 性格：{p.warmth >= 0.65 ? "热心肠" : p.warmth <= 0.35 ? "慢热" : "随和"}、{p.humor >= 0.55 ? "开得起玩笑" : p.pride >= 0.6 ? "要面子" : "不爱开玩笑"}、{p.chattiness >= 0.6 ? "话多" : p.chattiness <= 0.35 ? "话少" : "话量适中"}</p>
{mem.note ? <p className="mt-1 rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-xs font-bold">🧠 他记得：{mem.note}</p> : <p className="mt-1 rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-xs text-[var(--dim)]">你们还没发生过什么特别的事——帮个忙、送个小礼物，他都会记着。</p>}
</div>
<div className="mt-2 grid min-h-[120px] flex-1 gap-1.5 overflow-y-auto px-4 py-1">
{npcLog.map((m, i) => (
<div key={i} className={`max-w-[88%] rounded-[12px] px-3 py-2 text-[13px] leading-relaxed ${m.from === "me" ? "justify-self-end bg-[var(--text)] text-[var(--bg)]" : "justify-self-start border border-[var(--line)] bg-[var(--bg)]"}`}>
{m.from === "npc" && <p className="text-[11px] font-black text-[var(--dim)]">{npc.name}</p>}
<p className="whitespace-pre-line">{m.text}</p>
</div>
))}
</div>
{(() => { const story = storyOf(npc.name); if (!story) return null; const st = storyStatus(story, s.story?.[npc.name], mem.rel, s.day); const ch = storyOpen === npc.name ? story.chapters[s.story?.[npc.name]?.ch ?? 0] : null; return (
<div className="mx-3 mt-2 rounded-[12px] border-2 border-[var(--gold)] bg-[var(--surface2)] p-2.5">
<p className="flex items-center justify-between gap-2 text-xs font-black"><span>{en ? `📖 ${trText(npc.name)}'s story · "${L(story.title)}"` : `📖 ${npc.name}的故事 ·「${story.title}」`}</span><span className="text-[var(--dim)]">{st.kind === "done" ? (en ? "Finished" : "已完结") : `${Math.min(st.kind === "ending" ? st.total : st.idx + 1, st.total)}/${st.total}`}</span></p>
{ch ? (
<div className="mt-2 grid gap-1.5">{ch.choices.map((c, i) => (
<button key={i} type="button" onClick={() => chooseStory(i)} className="act-btn text-left"><span className="text-[13px] font-black">{L(c.label)}</span>{fxText(c.fx) && <span className="block text-[11px] text-[var(--dim)]">{fxText(c.fx)}</span>}</button>
))}</div>
) : st.kind === "ready" ? <button type="button" onClick={openStory} className="mt-2 w-full rounded-full bg-[var(--text)] py-2 text-xs font-black text-[var(--bg)]">{en ? `▶ Read chapter ${st.idx + 1}: "${L(st.chapter.title)}" · ⏱ 30 min` : `▶ 看第 ${st.idx + 1} 章「${st.chapter.title}」 · ⏱ 30 分钟`}</button>
: st.kind === "ending" ? <button type="button" onClick={openStory} className="mt-2 w-full rounded-full bg-[var(--accent)] py-2 text-xs font-black text-white">🏁 看结局 · ⏱ 30 分钟</button>
: st.kind === "locked" ? <p className="mt-1 text-[11px] text-[var(--dim)]">{en ? `🔒 Bond +${st.need} unlocks the next chapter (now ${mem.rel > 0 ? "+" : ""}${mem.rel}) — helping out, small gifts and daily hellos all bring you closer.` : `🔒 关系到 +${st.need} 解锁下一章（现在 ${mem.rel > 0 ? "+" : ""}${mem.rel}）——帮个忙、送小礼物、天天打招呼都能拉近关系。`}</p>
: st.kind === "tomorrow" ? <p className="mt-1 text-[11px] text-[var(--dim)]">{en ? `🌙 That's today's chapter. Come back to ${trText(npc.name)} tomorrow for more.` : `🌙 今天的故事看完了，明天再来找${npc.name}看后续。`}</p>
: <p className="mt-1 text-[11px] font-bold">{en ? `🏁 Ending: ${L(st.title)}` : `🏁 结局：${st.title}`}</p>}
</div> ); })()}
<div className="grid grid-cols-2 gap-1.5 p-3 pt-2 sm:grid-cols-3">
{([
["greet", "👋 打招呼", "聊聊近况"],
["weather", "🌦️ 聊天气", "今天的天儿"],
["work", "💼 聊工作", "他这行的事"],
...(s.cityKey === "sz" || npc.name === "Lisa" ? [["apec", "🌐 聊峰会", "大会那些事"] as const] : []),
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

{/* toast */}
{toast && <div className="rise fixed bottom-6 left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 rounded-[14px] border-2 border-[var(--border)] bg-[var(--text)] px-4 py-3 text-center text-sm font-bold text-[var(--bg)] shadow-lg">{toast}</div>}

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
{ id: "work", icon: "💼", name: "上班打卡一次", reward: 20, done: s.workCount > base.work, hint: employerHere(s) ? `去${employerHere(s)!.short}点「上班」` : "去公司点「上班」" },
{ id: "meal", icon: "🍜", name: "好好吃一顿饭", reward: 15, done: s.mealCount > base.meal, hint: "夜市 / 饭店 / 自己做饭都算" },
{ id: "scenic", icon: "📸", name: "风景打卡一处", reward: 25, done: (s.visitedScenic ?? []).length > base.scenic, hint: "去任意景区点「拍照打卡」" },
{ id: "chat", icon: "💬", name: "和一位街坊聊聊", reward: 15, done: (s.greeted ?? []).length > 0, hint: "在手机「街坊社交」里找人聊天" },
];
const apecTask = s.cityKey === "sz" ? apecTaskOfDay(s.day) : null;
const apecDone = apecTask ? (s.apecTasks ?? []).includes(apecTask.id) : false;
return (
<div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/55 p-3 sm:items-center" role="dialog" aria-label="每日任务">
<div className="rise max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[22px] border-2 border-[var(--border)] bg-[var(--surface)] shadow-xl">
<div className="flex items-start justify-between bg-[var(--text)] p-4 text-[var(--bg)]">
<div>
<p className="text-xs font-black opacity-80">📋 每日任务 · 第 {Math.min(s.day, seasonLen)} 天 · {weekday(s.day)}</p>
<p className="font-display mt-0.5 text-2xl font-black">{city.name}的一天，从签到开始</p>
<p className="mt-0.5 text-xs opacity-85">{nowWeatherText} · {phaseApec.label}</p>
</div>
<button type="button" aria-label="关闭每日任务" onClick={() => setDailyOpen(false)} className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-black">✕</button>
</div>
<div className="p-4">
{(() => { const today = dateKey(); const r = streakReward(meta.streak.count); const got = meta.streak.claimed === today; return (
<div className="mb-2 rounded-[14px] border-2 border-[var(--border)] bg-[var(--surface2)] p-3">
<p className="text-sm font-black">🔥 连续上线第 {meta.streak.count} 天 <span className="text-xs font-bold text-[var(--dim)]">（真实日历，断一天从 1 重来，第 7 天起奖励最高）</span></p>
<div className="mt-1.5 flex gap-1">{[1, 2, 3, 4, 5, 6, 7].map((d) => <span key={d} className={`grid h-7 flex-1 place-items-center rounded-[8px] text-[10px] font-black ${d <= Math.min(7, meta.streak.count) ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--dim)]"}`}>{d === 7 ? "🎁" : `D${d}`}</span>)}</div>
<button type="button" disabled={got} onClick={() => { const prof = profileRef.current; if (!prof) return; void api.claimReward({ playerId: prof.playerId, kind: "streak", device: deviceId() || undefined }).then((sr) => { updMeta((m) => { m.streak.claimed = today; }); if (!sr.ok) { showToast(sr.error ?? "领取失败"); return; } mutate((x) => { x.money += sr.money; x.energy += sr.energy; }); updMeta((m) => { m.streak.count = Math.max(m.streak.count, sr.n); m.streak.best = Math.max(m.streak.best, sr.n); }); floatReward(`+${fmt(sr.money)} 连登`, "gold"); }).catch(() => showToast("网络不太好，稍后再试。")); }} className="mt-2 w-full rounded-full bg-[var(--accent)] py-2 text-xs font-black text-white disabled:opacity-40">{got ? "✅ 今天的连续上线奖励已领" : `领取连续上线奖励 · ${fmt(r.money)}${r.energy ? ` + 能量 ${r.energy}` : ""}`}</button>
<p className="mt-2 text-xs font-bold">{todayEvent.emoji} 今日城市事件「{todayEvent.name}」：<span className="font-normal">{todayEvent.desc}</span></p>
</div>
); })()}
<button type="button" disabled={signed} aria-label={signed ? "今日已签到" : "每日签到领奖励"} onClick={() => { const prof = profileRef.current; if (!prof) return; void api.claimReward({ playerId: prof.playerId, kind: "signin", device: deviceId() || undefined }).then((r) => { if (!r.ok) { if (r.error === "今天已经领过了") mutate((x) => { x.signDay = s.day; }); showToast(r.error ?? "签到失败"); return; } mutate((x) => { x.signDay = s.day; x.money += r.money; x.energy += r.energy; }); floatReward(`+${fmt(r.money)} 签到`, "gold"); floatReward(`能量 +${r.energy}`, "green"); burstDanmaku(["🧧 今天的签到红包到账啦", "陈伯：早啊，又是新的一天", "小美：签到打卡，元气满满 ☀️"]); showToast(`签到成功：+${fmt(r.money)}，能量 +${r.energy}。今天的任务在下面，顺手就做了。`); }).catch(() => showToast("网络不太好，签到没成功，稍后再试。")); }} className="w-full rounded-[14px] bg-[var(--accent)] py-3.5 text-sm font-black text-white disabled:bg-[var(--surface2)] disabled:text-[var(--dim)]">
{signed ? "✅ 今日已签到（明天再来）" : `🧧 每日签到 · 领 ${fmt(30)} + 能量 10`}
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
<p className="text-sm font-black">🌐 今日 峰会任务 · {apecTask.dateLabel} {apecTask.event}</p>
<p className="mt-0.5 text-xs leading-relaxed">{apecTask.roleEmoji} 你当{apecTask.role}：{apecTask.title} —— 去{locById(apecTask.venueLocId).name}打卡上岗。{apecDone ? "✅ 今天已完成" : ""}</p>
{!apecDone && <button type="button" aria-label="坐地铁去做今日峰会任务" onClick={() => { setDailyOpen(false); walkTo(apecTask.venueLocId, "metro"); }} className="mt-2 rounded-full bg-[#5c4a00] px-3.5 py-1.5 text-[11px] font-black text-white">🚇 坐地铁去会场</button>}
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
<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center" role="dialog" aria-label="手机">
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
