/* 抽签投胎：开局随机抽一个出身（身份 + 住在哪一层），30 天后看你爬到了哪一层。
   The 10-second hook: you don't pick who you are, you draw it — most people
   start at the bottom of the ladder, a lucky few in a Nanshan flat. The run
   is about how far up (or down) the ladder you get. */
import type { CityKey } from "./data";

/** the housing ladder, per city: 0 = bottom, 3 = top */
export const TIERS: Record<CityKey, { zh: string; en: string; emoji: string }[]> = {
  sz: [
    { zh: "城中村握手楼", en: "an urban-village room", emoji: "🏚️" },
    { zh: "合租单间", en: "a room in a shared flat", emoji: "🚪" },
    { zh: "小区一房", en: "a one-bed flat of your own", emoji: "🏢" },
    { zh: "南山有房", en: "a flat in Nanshan", emoji: "🏙️" },
  ],
  hk: [
    { zh: "劏房", en: "a subdivided flat", emoji: "🏚️" },
    { zh: "公屋", en: "public housing", emoji: "🏘️" },
    { zh: "私楼单位", en: "a private flat", emoji: "🏢" },
    { zh: "半山豪宅", en: "a Mid-Levels mansion", emoji: "🏙️" },
  ],
  hz: [
    { zh: "城中村单间", en: "an urban-village room", emoji: "🏚️" },
    { zh: "合租房", en: "a shared flat", emoji: "🚪" },
    { zh: "小区两房", en: "a two-bed flat", emoji: "🏢" },
    { zh: "海景房", en: "a sea-view flat", emoji: "🏖️" },
  ],
};

export interface Origin { id: string; iden: string; tier: 0 | 1 | 2 | 3; zh: string; en: string; line: string; lineEn: string }

export const ORIGINS: Origin[] = [
  // tier 0 — the bottom rung, where most people start
  { id: "o-rider", iden: "rider", tier: 0, zh: "城中村 · 外卖骑手", en: "Urban village · delivery rider", line: "一张床、一个电动车充电器，就是全部家当。", lineEn: "A bed and an e-bike charger — that's everything you own." },
  { id: "o-factory", iden: "factory", tier: 0, zh: "关外宿舍 · 流水线普工", en: "Factory dorm · line worker", line: "八人间上下铺，夜里听得见隔壁机器响。", lineEn: "Eight to a dorm room; the machines hum all night." },
  { id: "o-builder", iden: "builder", tier: 0, zh: "工地板房 · 建筑工人", en: "Site cabin · construction worker", line: "住在工地铁皮房里，楼盖好了你就得搬走。", lineEn: "You live in a tin cabin on site — when the tower's done, you move on." },
  { id: "o-cleaner", iden: "cleaner", tier: 0, zh: "地下室 · 保洁阿姨", en: "Basement room · cleaner", line: "没有窗的地下室，天亮了也是黑的。", lineEn: "A windowless basement room — dark even at noon." },
  { id: "o-vendor", iden: "vendor", tier: 0, zh: "城中村 · 夜市小贩", en: "Urban village · night-market vendor", line: "一辆三轮车，一个炭炉，就是你的店。", lineEn: "One tricycle, one charcoal grill — that's your shop." },
  { id: "o-waiter", iden: "waiter", tier: 0, zh: "员工宿舍 · 餐厅服务员", en: "Staff dorm · waiter", line: "包吃包住，代价是一天站十二个小时。", lineEn: "Food and bed included — the price is twelve hours on your feet." },
  { id: "o-courier", iden: "courier", tier: 0, zh: "城中村 · 快递员", en: "Urban village · courier", line: "楼道里堆满了别人的快递，自己的没几件。", lineEn: "The stairwell is full of other people's parcels." },
  { id: "o-ktv", iden: "ktv", tier: 0, zh: "城中村 · KTV 夜班", en: "Urban village · KTV night shift", line: "凌晨两点下班，城中村的米粉店还开着。", lineEn: "Off at 2 a.m.; the noodle stall downstairs is still open." },
  // tier 1
  { id: "o-worker", iden: "worker", tier: 1, zh: "合租单间 · 深漂打工人", en: "Shared flat · Shenzhen hustler", line: "合租房里抢厕所，每天挤 1 号线去科技园。", lineEn: "Queue for the shared bathroom, squeeze onto Line 1 to the tech park." },
  { id: "o-barber", iden: "barber", tier: 1, zh: "合租单间 · 理发师", en: "Shared flat · barber", line: "一把剪刀走天下，熟客就是你的存款。", lineEn: "Your scissors go everywhere; regulars are your savings." },
  { id: "o-guard", iden: "guard", tier: 1, zh: "合租单间 · 小区保安", en: "Shared flat · estate guard", line: "你守着别人的豪宅，下班回自己的单间。", lineEn: "You guard other people's luxury flats, then go home to your room." },
  { id: "o-driver", iden: "driver", tier: 1, zh: "合租单间 · 的士司机", en: "Shared flat · taxi driver", line: "城市每条路都熟，就是还没一条路通向自己的房子。", lineEn: "You know every road in the city — none of them leads to a flat of your own yet." },
  { id: "o-chef", iden: "chef", tier: 1, zh: "合租单间 · 后厨厨师", en: "Shared flat · line cook", line: "一口锅撑起一家店，梦想是开自己的馆子。", lineEn: "One wok carries the restaurant; the dream is your own." },
  { id: "o-agent", iden: "agent", tier: 1, zh: "合租单间 · 房产中介", en: "Shared flat · estate agent", line: "每天带人看豪宅，自己住在隔断间。", lineEn: "You show mansions all day and sleep in a partitioned room." },
  { id: "o-streamer", iden: "streamer", tier: 1, zh: "合租单间 · 带货主播", en: "Shared flat · livestreamer", line: "补光灯比床还贵，等一条视频爆火。", lineEn: "The ring light cost more than the bed. Waiting for one video to blow up." },
  { id: "o-sales", iden: "sales", tier: 1, zh: "合租单间 · 商场导购", en: "Shared flat · shop assistant", line: "嘴甜就有提成，站一天腿是自己的。", lineEn: "A sweet tongue earns commission; the sore legs are all yours." },
  { id: "o-masseur", iden: "masseur", tier: 1, zh: "合租单间 · 按摩师", en: "Shared flat · masseur", line: "手艺吃饭，老客点钟就是好日子。", lineEn: "You live by your hands; a regular asking for you makes the day." },
  { id: "o-student", iden: "student", tier: 1, zh: "大学宿舍 · 大学生", en: "Uni dorm · student", line: "钱最少，可能性最多。", lineEn: "The least money, the most possibilities." },
  // tier 2
  { id: "o-coder", iden: "coder", tier: 2, zh: "小区一房 · 996 程序员", en: "Own one-bed · 996 programmer", line: "工资够租一房，代价是头发和周末。", lineEn: "The salary rents a one-bed — paid for with your hair and weekends." },
  { id: "o-teacher", iden: "teacher", tier: 2, zh: "小区一房 · 老师", en: "Own one-bed · teacher", line: "稳定、体面，寒暑假是最大的福利。", lineEn: "Steady and respectable; the holidays are the real perk." },
  { id: "o-nurse", iden: "nurse", tier: 2, zh: "小区一房 · 护士", en: "Own one-bed · nurse", line: "三班倒换来一套小一房。", lineEn: "Rotating shifts bought you a small one-bed." },
  { id: "o-coach", iden: "coach", tier: 2, zh: "小区一房 · 健身教练", en: "Own one-bed · gym coach", line: "身材是招牌，私教卡是房租。", lineEn: "Your body is the advert; the training packages pay the rent." },
  { id: "o-boss", iden: "boss", tier: 2, zh: "小区一房 · 小老板", en: "Own one-bed · small-business owner", line: "公司刚起步，谈成一单就是大钱。", lineEn: "The company is young; one big deal changes everything." },
  // tier 3 — the lucky few
  { id: "o-rich", iden: "rich", tier: 3, zh: "南山有房 · 深二代", en: "Nanshan flat · born rich", line: "别人奋斗一辈子的起点，是你的出生地。", lineEn: "Where others hope to end up is where you were born." },
];

/** chance of being born on each rung: most people start at the bottom */
const TIER_WEIGHT = [0.46, 0.34, 0.14, 0.06];

export function drawOrigin(rand: () => number = Math.random, not?: string): Origin {
  let r = rand(); let tier = 0;
  for (let i = 0; i < TIER_WEIGHT.length; i++) { if (r < TIER_WEIGHT[i]!) { tier = i; break; } r -= TIER_WEIGHT[i]!; tier = i; }
  const pool = ORIGINS.filter((o) => o.tier === tier && o.id !== not);
  return pool[Math.floor(rand() * pool.length)] ?? ORIGINS[0]!;
}
export const originById = (id?: string | null) => ORIGINS.find((o) => o.id === id);
/** the rung an identity starts on when it was picked by hand, not drawn */
export function tierOfIden(iden: string): 0 | 1 | 2 | 3 { return ORIGINS.find((o) => o.iden === iden)?.tier ?? 1; }

/** where you stand now: you start on your origin's rung, climb one rung for
    reaching the month's goal (two at 1.6×, three at 2.5×), and slip one for
    burning through most of what you started with or going into debt */
export function tierNow(start: number, money: number, goal: number, startMoney: number): 0 | 1 | 2 | 3 {
  const r = money / Math.max(1, goal);
  let step = r >= 2.5 ? 3 : r >= 1.6 ? 2 : r >= 1 ? 1 : 0;
  if (money < 0 || (startMoney >= 1000 && money < startMoney * 0.25)) step = -1;
  return Math.max(0, Math.min(3, start + step)) as 0 | 1 | 2 | 3;
}
export function climbVerdict(from: number, to: number, en: boolean): string {
  if (to > from) return en ? (to - from >= 2 ? "Rags to riches" : "Moving up") : to - from >= 2 ? "逆天改命" : "往上爬了一层";
  if (to < from) return en ? "Slipping down" : "跌下来了";
  return en ? "Holding on" : "稳住了";
}

const ADJ = ["湾区", "南山", "福田", "宝安", "龙华", "罗湖", "城中村", "科技园", "地铁", "深夜"];
const NOUN = ["小陈", "阿深", "打工人", "追梦人", "夜猫", "骑士", "小李", "阿强", "小美", "大刘"];
/** a nickname so the one-tap start never stops to ask for one */
export function randomNick(rand: () => number = Math.random): string {
  return `${ADJ[Math.floor(rand() * ADJ.length)]}${NOUN[Math.floor(rand() * NOUN.length)]}${Math.floor(rand() * 90 + 10)}`;
}
