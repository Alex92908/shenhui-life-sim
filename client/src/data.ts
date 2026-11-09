// Static game data for 深惠人生模拟电脑高配版.
// Locations / identities / careers / foods ported from the previous edition;
// ZhuyaHome style templates, furniture and material prices are ZhuyaHome's
// real catalog data. Summit venues follow a fictional 湾区国际峰会 (no real event) in
// Shenzhen: leaders' week opens Nov 14, welcome banquet Nov 16 at 太子湾 海景酒店,
// CEO Summit Nov 17–18 at 前海国际会议中心, leaders' meeting Nov 18–19 at
// 深圳国际交流中心 (香蜜湖). The 30-day season is November, so game day N is
// November N.

import { SZ_KM_PER_UNIT, SZ_METRO_LINES, SZ_REAL_KM } from "./metro-sz";
import { AREA_LABELS } from "./areas";
import { SZ_PLACES, type CityPlace, type PlaceKind } from "./places-sz";
import { HZ_LOC_KM, HZ_PLACES, HZ_REAL_KM } from "./places-hz";
import { HK_LOC_KM, HK_PLACES, HK_REAL_KM } from "./places-hk";

export type CityKey = "sz" | "hz" | "hk";

export interface CityInfo {
  name: string;
  emoji: string;
  rentBase: number;
  goal: number;
  payMul: number;
  foodMul: number;
  moodFun: number;
  funName: string;
  funCost: number;
  funDesc: string;
  gigName: string;
  scene: string;
  sky: string;
}

export const CITIES: Record<CityKey, CityInfo> = {
  sz: {
    name: "深圳",
    emoji: "🌆",
    rentBase: 620,
    goal: 12000,
    payMul: 1,
    foodMul: 1,
    moodFun: 24,
    funName: "去深圳湾吹海风",
    funCost: 20,
    funDesc: "沿着湾边走一走，看对岸的灯一盏盏亮",
    gigName: "跑腿 / 闪送单",
    scene: "深圳 · 城中村握手楼",
    sky: "平安金融中心",
  },
  hz: {
    name: "惠州",
    emoji: "🌊",
    rentBase: 360,
    goal: 8000,
    payMul: 0.62,
    foodMul: 0.75,
    moodFun: 28,
    funName: "去双月湾看海",
    funCost: 15,
    funDesc: "海风不要钱，日落不要钱，快乐也不要钱",
    gigName: "海边摆摊 / 代驾",
    scene: "惠州 · 双月湾旁的老街",
    sky: "双月湾",
  },
  hk: {
    name: "香港",
    emoji: "🇭🇰",
    rentBase: 900,
    goal: 20000,
    payMul: 1.35,
    foodMul: 1.4,
    moodFun: 26,
    funName: "坐天星小轮过海",
    funCost: 25,
    funDesc: "HK$5 都不到的百年渡轮，看维港两岸慢慢靠近——香港最抵的浪漫",
    gigName: "茶餐厅帮工 / 送外卖",
    scene: "香港 · 深水埗唐楼",
    sky: "维多利亚港",
  },
};

export interface Identity {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  money: number;
  pay: number;
  rentMul: number;
  mood: number;
  energyBonus: number;
  color: number;
}

export const IDENTITIES: Identity[] = [
  { id: "worker", emoji: "🧑‍🏭", name: "深漂打工人", desc: "住城中村握手楼，每天挤地铁去科技园。没背景，只有背影。", money: 1800, pay: 260, rentMul: 1, mood: 75, energyBonus: 0, color: 0xff4d2e },
  { id: "rich", emoji: "🕶️", name: "深圳富二代", desc: "南山有房，开局不差钱。难的是别把钱败光，还得证明自己。", money: 25000, pay: 180, rentMul: 3.2, mood: 85, energyBonus: 0, color: 0xffc91f },
  { id: "flat", emoji: "🛋️", name: "惠州躺平青年", desc: "拒绝内卷，海边租房。工资不高，但每天睡到自然醒。", money: 2600, pay: 150, rentMul: 0.9, mood: 92, energyBonus: 10, color: 0x00a896 },
  { id: "coder", emoji: "👨‍💻", name: "996 程序员", desc: "发量换工资。日薪最高，但能量和心情掉得比头发还快。", money: 5200, pay: 520, rentMul: 1.15, mood: 60, energyBonus: -5, color: 0x0ea5e9 },
  { id: "rider", emoji: "🛵", name: "外卖骑手", desc: "城市最熟悉的陌生人。多跑多得，风里来雨里去。", money: 1200, pay: 300, rentMul: 0.95, mood: 70, energyBonus: 5, color: 0xff8a00 },
  { id: "driver", emoji: "🚕", name: "的士司机", desc: "一天十二个小时握着方向盘，城市每条路都在脑子里。打表收钱，份子钱也得交。", money: 2000, pay: 320, rentMul: 0.95, mood: 70, energyBonus: 0, color: 0xfacc15 },
  { id: "factory", emoji: "🔩", name: "工厂普工", desc: "流水线上打螺丝，包吃住，加班多，攒钱快。", money: 1500, pay: 230, rentMul: 0.8, mood: 72, energyBonus: 5, color: 0x64748b },
  { id: "waiter", emoji: "🍜", name: "餐厅服务员", desc: "午市晚市两个高峰，脚不沾地，员工餐管饱。", money: 1400, pay: 200, rentMul: 0.85, mood: 76, energyBonus: 3, color: 0xef4444 },
  { id: "sales", emoji: "🛍️", name: "商场导购", desc: "站一天柜台，成交有提成，嘴甜的月薪翻倍。", money: 1600, pay: 220, rentMul: 0.9, mood: 78, energyBonus: 0, color: 0xec4899 },
  { id: "barber", emoji: "💈", name: "理发师", desc: "一把剪刀走天下，烫染一单顶三单，熟客最值钱。", money: 1500, pay: 240, rentMul: 0.9, mood: 76, energyBonus: 0, color: 0x8b5cf6 },
  { id: "masseur", emoji: "💆", name: "按摩师", desc: "足疗推拿，手艺吃饭，老客点钟有小费。", money: 1500, pay: 260, rentMul: 0.9, mood: 74, energyBonus: 0, color: 0x14b8a6 },
  { id: "ktv", emoji: "🎤", name: "KTV 包厢服务员", desc: "夜班到凌晨，送果盘调音响，嗓子好还能陪唱暖场。", money: 1300, pay: 250, rentMul: 0.9, mood: 72, energyBonus: -2, color: 0xd946ef },
  { id: "teacher", emoji: "🧑‍🏫", name: "老师", desc: "带早读、上课、批作业，寒暑假是最大的福利。", money: 3000, pay: 300, rentMul: 1, mood: 80, energyBonus: 0, color: 0x0ea5e9 },
  { id: "student", emoji: "🎓", name: "大学生", desc: "上课、自习、社团、兼职——钱少，但时间和可能性都多。", money: 800, pay: 80, rentMul: 0.6, mood: 88, energyBonus: 8, color: 0x22c55e },
  { id: "guard", emoji: "💂", name: "保安", desc: "站岗、巡逻、看监控，整栋楼的人你都认识。", money: 1400, pay: 210, rentMul: 0.85, mood: 76, energyBonus: 3, color: 0x475569 },
  { id: "cleaner", emoji: "🧹", name: "保洁阿姨", desc: "天不亮就上班，把整座商场擦得锃亮，没人注意你，但离不开你。", money: 1200, pay: 180, rentMul: 0.8, mood: 78, energyBonus: 2, color: 0x84cc16 },
  { id: "courier", emoji: "📦", name: "快递员", desc: "每天几百个包裹，一栋楼一栋楼跑，派件越多挣越多。", money: 1500, pay: 290, rentMul: 0.9, mood: 72, energyBonus: 5, color: 0xf59e0b },
  { id: "chef", emoji: "👨‍🍳", name: "厨师", desc: "午市晚市两场硬仗，一口锅撑起一家店。", money: 1800, pay: 300, rentMul: 0.9, mood: 74, energyBonus: 0, color: 0xdc2626 },
  { id: "nurse", emoji: "👩‍⚕️", name: "护士", desc: "查房、打针、写记录，三班倒，病人记得你的好。", money: 2600, pay: 310, rentMul: 1, mood: 74, energyBonus: -2, color: 0x06b6d4 },
  { id: "agent", emoji: "🔑", name: "房产中介", desc: "底薪很低，签一单顶一个月；带看十次，可能一单都没有。", money: 1600, pay: 200, rentMul: 0.95, mood: 72, energyBonus: 0, color: 0x2563eb },
  { id: "streamer", emoji: "📱", name: "带货主播", desc: "「家人们三二一上链接！」——火了月入十万，不火喝西北风。", money: 1500, pay: 230, rentMul: 1, mood: 80, energyBonus: 0, color: 0xf43f5e },
  { id: "vendor", emoji: "🍢", name: "摆摊小贩", desc: "夜市出摊卖烤串，自己当老板，就是得躲着城管。", money: 1300, pay: 240, rentMul: 0.8, mood: 80, energyBonus: 2, color: 0xea580c },
  { id: "builder", emoji: "👷", name: "建筑工人", desc: "绑钢筋、搬砖、浇混凝土——深圳的每栋楼都有你的汗。日结工资高，身体最累。", money: 1200, pay: 320, rentMul: 0.7, mood: 70, energyBonus: 8, color: 0xca8a04 },
  { id: "coach", emoji: "🏋️", name: "健身教练", desc: "身材就是招牌，私教课和卖卡是收入大头。", money: 2000, pay: 260, rentMul: 1, mood: 82, energyBonus: 5, color: 0x16a34a },
  { id: "boss", emoji: "💼", name: "小老板", desc: "开了家小公司，谈下一单就是大钱，谈黄了也得发工资。", money: 12000, pay: 400, rentMul: 1.6, mood: 70, energyBonus: -3, color: 0x1f2937 },
];

/* 职业晋升线：经验靠打工，技能靠学习，职级直接乘工资 */
export const CAREERS = [
  { name: "职场新人", mul: 1, needXp: 0, needSkill: 0 },
  { name: "业务骨干", mul: 1.25, needXp: 6, needSkill: 1 },
  { name: "小组主管", mul: 1.6, needXp: 14, needSkill: 3 },
  { name: "部门经理", mul: 2.05, needXp: 26, needSkill: 5 },
  { name: "城市合伙人", mul: 2.6, needXp: 42, needSkill: 8 },
];

/* ---- 公司 / 大厂：面试、拿 offer、跳槽 ----
   You start at the small 科技园公司. Every big company HQ on the map can be
   interviewed at; pass the bar (skill / xp / 职级) and you get an offer, take
   it and that company becomes where you clock in. Each pays and wears you
   down differently. Each company belongs to one city (default Shenzhen);
   Huizhou has its own: 仲恺's electronics and battery makers and the Daya
   Bay petrochemical base. Huizhou's 仲恺公司 stays the walk-in job there. */
export interface Company {
  id: string; name: string; short: string; emoji: string;
  /** Which city's map it is on (default "sz"). */
  city?: CityKey;
  /** Map locations you can work / interview at. */
  locIds: string[];
  /** Day-wage multiplier on top of identity × city × 职级. */
  payMul: number;
  /** Overtime pay multiplier (on top of the usual ×1.75). */
  otMul: number;
  /** Energy a normal workday costs, and its mood change. */
  energy: number; mood: number;
  needSkill: number; needXp: number; needCareer: number;
  /** The interviewer wants 正装. */
  formal?: boolean;
  /** Has a staff canteen: cheap meal for employees. */
  canteen?: boolean;
  culture: string;
}
export const COMPANIES: Company[] = [
  { id: "startup", name: "科技园创业公司", short: "创业公司", emoji: "🏢", locIds: ["work"], payMul: 1, otMul: 1, energy: 28, mood: 0, needSkill: 0, needXp: 0, needCareer: 0, culture: "小公司什么都要干，工资一般，但没人管你几点到。" },
  { id: "tencent", name: "腾讯", short: "腾讯", emoji: "🐧", locIds: ["co-tencent", "co-penguin"], payMul: 1.6, otMul: 1, energy: 30, mood: -1, needSkill: 3, needXp: 10, needCareer: 1, canteen: true, culture: "福利好、食堂出名，滨海大厦和大铲湾园区两个园区都能上班。" },
  { id: "bytedance", name: "字节跳动", short: "字节", emoji: "🎵", locIds: ["co-bytedance"], payMul: 1.8, otMul: 1.1, energy: 34, mood: -4, needSkill: 3, needXp: 8, needCareer: 1, canteen: true, culture: "钱给得最多，项目节奏快。" },
  { id: "huawei", name: "华为", short: "华为", emoji: "📶", locIds: ["co-huawei"], payMul: 1.7, otMul: 1.25, energy: 34, mood: -3, needSkill: 4, needXp: 12, needCareer: 1, canteen: true, culture: "研发氛围浓，加班费和年终也给得足。" },
  { id: "dji", name: "大疆", short: "大疆", emoji: "🚁", locIds: ["co-dji"], payMul: 1.65, otMul: 1, energy: 32, mood: -2, needSkill: 4, needXp: 10, needCareer: 1, canteen: true, culture: "对产品要求极高，面试看技术，进去能玩到最新的无人机。" },
  { id: "baidu", name: "百度", short: "百度", emoji: "🔎", locIds: ["co-baidu"], payMul: 1.45, otMul: 1, energy: 29, mood: -1, needSkill: 2, needXp: 6, needCareer: 0, culture: "老牌大厂，节奏比新贵们稳一些。" },
  { id: "zte", name: "中兴通讯", short: "中兴", emoji: "📡", locIds: ["co-zte"], payMul: 1.3, otMul: 1, energy: 28, mood: 0, needSkill: 1, needXp: 4, needCareer: 0, canteen: true, culture: "通信老厂，稳定，门槛比互联网大厂低。" },
  { id: "cmb", name: "招商银行", short: "招行", emoji: "🏦", locIds: ["co-cmb"], payMul: 1.45, otMul: 0.9, energy: 26, mood: 1, needSkill: 2, needXp: 6, needCareer: 1, formal: true, culture: "金融业的体面工作：准点下班多，但面试必须穿正装。" },
  { id: "pingan", name: "平安集团", short: "平安", emoji: "🏙️", locIds: ["bank"], payMul: 1.4, otMul: 1, energy: 28, mood: 0, needSkill: 2, needXp: 6, needCareer: 0, formal: true, culture: "在平安金融中心上班，深圳最高楼里看日落。面试要穿正装。" },
  { id: "vanke", name: "万科", short: "万科", emoji: "🏗️", locIds: ["co-vanke"], payMul: 1.35, otMul: 1, energy: 26, mood: 3, needSkill: 2, needXp: 6, needCareer: 0, culture: "在大梅沙海边上班，通勤远，但心情好。" },
  { id: "byd", name: "比亚迪", short: "比亚迪", emoji: "🔋", locIds: ["co-byd"], payMul: 1.2, otMul: 1.1, energy: 30, mood: 0, needSkill: 0, needXp: 2, needCareer: 0, canteen: true, culture: "新能源大厂招人多，门槛低，包吃，坪山离市区有点远。" },
  { id: "tcl", city: "hz", name: "TCL集团", short: "TCL", emoji: "📺", locIds: ["co-tcl"], payMul: 1.25, otMul: 1.1, energy: 28, mood: 1, needSkill: 1, needXp: 4, needCareer: 0, canteen: true, culture: "仲恺的老牌电子大厂，电视、面板、手机一条龙，园区大、食堂便宜，惠州人眼里的「铁饭碗」。" },
  { id: "desay", city: "hz", name: "德赛西威", short: "德赛", emoji: "🚗", locIds: ["co-desay"], payMul: 1.35, otMul: 1, energy: 27, mood: 2, needSkill: 2, needXp: 6, needCareer: 0, culture: "做智能座舱和车载电子的上市公司，研发楼对着测试车道，工程师文化，面试会考你懂不懂车。" },
  { id: "eve", city: "hz", name: "亿纬锂能", short: "亿纬", emoji: "🔋", locIds: ["co-eve"], payMul: 1.2, otMul: 1.15, energy: 30, mood: 0, needSkill: 0, needXp: 2, needCareer: 0, canteen: true, culture: "锂电池大厂扩产快、招人多、门槛低，三班倒，加班费给得足。" },
  { id: "petro", city: "hz", name: "中海油大亚湾石化", short: "中海油", emoji: "🛢️", locIds: ["co-petro"], payMul: 1.5, otMul: 1, energy: 30, mood: -1, needSkill: 2, needXp: 8, needCareer: 1, formal: true, culture: "大亚湾石化区的央企炼化基地，待遇在惠州数一数二，安全规矩极严，面试要穿正装。" },
  /* ---- 香港：中环金融、航空、地产、科创、港铁（虚构品牌，真实写字楼位置） ---- */
  { id: "hk-bank", city: "hk", name: "汇丰银行", short: "汇丰", emoji: "🦁", locIds: ["bank-hk"], payMul: 1.6, otMul: 1, energy: 28, mood: 0, needSkill: 3, needXp: 10, needCareer: 1, formal: true, culture: "中环老牌大行，门口一对铜狮子。返工西装骨骨，升职要靠英文、关系和捱得夜。" },
  { id: "hk-exchange", city: "hk", name: "港交所", short: "港交所", emoji: "📈", locIds: ["co-hkex"], payMul: 1.75, otMul: 1.1, energy: 32, mood: -2, needSkill: 4, needXp: 12, needCareer: 1, formal: true, culture: "交易广场里的交易所，招股季忙到天光。人工全城数一数二，面试一定要着西装。" },
  { id: "hk-airline", city: "hk", name: "国泰航空", short: "国泰", emoji: "✈️", locIds: ["co-cathay"], payMul: 1.4, otMul: 1.2, energy: 30, mood: 2, needSkill: 2, needXp: 6, needCareer: 0, canteen: true, culture: "赤鱲角航空城的总部，地勤、客服、运控都请人。员工机票福利出名，就是轮更辛苦。" },
  { id: "hk-property", city: "hk", name: "太古地产", short: "太古", emoji: "🏢", locIds: ["co-swire"], payMul: 1.5, otMul: 1, energy: 26, mood: 3, needSkill: 2, needXp: 8, needCareer: 1, culture: "鲗鱼涌的老牌地产集团，写字楼群连住商场。节奏比中环慢少少，下班去太古城食饭。" },
  { id: "hk-sciencepark", city: "hk", name: "科学园初创公司", short: "科学园", emoji: "🧪", locIds: ["co-hkstp"], payMul: 1.35, otMul: 1, energy: 30, mood: 1, needSkill: 3, needXp: 4, needCareer: 0, canteen: true, culture: "白石角海边的科创园区，AI、生科、硬件初创扎堆。人工唔算顶，但期权同埋前途靠自己搏。" },
  { id: "hk-rail", city: "hk", name: "港铁公司", short: "港铁", emoji: "🚇", locIds: ["co-mtr"], payMul: 1.3, otMul: 1.15, energy: 28, mood: 1, needSkill: 1, needXp: 4, needCareer: 0, canteen: true, culture: "九龙湾总部，全香港的列车都喺度调度。铁饭碗、福利好，凌晨维修班有额外津贴。" },
];
/** What the player still lacks for this company's hiring bar (empty = qualified). */
export function companyGaps(co: Company, s: { skill: number; xp: number; careerIdx: number }): string[] {
  const out: string[] = [];
  if (s.skill < co.needSkill) out.push(`技能 ${s.skill}/${co.needSkill}`);
  if (s.xp < co.needXp) out.push(`经验 ${s.xp}/${co.needXp}`);
  if (s.careerIdx < co.needCareer) out.push(`职级要到「${CAREERS[co.needCareer]?.name ?? ""}」`);
  return out;
}
export const companyById = (id: string | undefined): Company => COMPANIES.find((c) => c.id === id) ?? COMPANIES[0]!;
/** The company that has a workplace at this location in this city. */
export function companyAt(cityKey: CityKey, locId: string): Company | null {
  return COMPANIES.find((c) => (c.city ?? "sz") === cityKey && c.locIds.includes(locId)) ?? null;
}
/** The company you clock in at in this city: your employer when it is
    here; otherwise the city's walk-in job (Shenzhen's 创业公司; Huizhou's
    仲恺公司, which is a plain workplace — null). */
export function employerHere(s: { employer?: string; cityKey: CityKey }): Company | null {
  const co = companyById(s.employer);
  if ((co.city ?? "sz") === s.cityKey) return co;
  return s.cityKey === "sz" ? companyById("startup") : null;
}

export type NpcBehavior = "stay" | "patrol" | "wander" | "commute";
export type NpcAccessory = "cap" | "apron" | "tie" | "vest" | "bag" | "helmet" | "none";
export interface Npc {
  name: string; job: string; emoji: string; color: number; line: string;
  outfit: string; shirt: number; pants: number; accessory: NpcAccessory;
  behavior: NpcBehavior; preferTypes: LocType[];
  /** Which cities this neighbour belongs to. NPCs without the field are
      the Shenzhen/Huizhou street crowd; Hong Kong has its own neighbours. */
  cities?: CityKey[];
}
/** The neighbours who actually live in a city — Hong Kong's street crowd
    is its own cast （茶餐厅伙计、的士司机、天星小轮船员…), bilingual. */
export function npcsForCity(cityKey: CityKey): Npc[] {
  return NPCS.filter((n) => (n.cities ? n.cities.includes(cityKey) : cityKey !== "hk"));
}
export const NPCS: Npc[] = [
  { name: "阿强", job: "外卖骑手", emoji: "🛵", color: 0xff8a00, line: "跑单路过，顺手帮你扶了下快倒的电动车。", outfit: "黄色骑手服 + 头盔，保温箱不离身", shirt: 0xf5b301, pants: 0x2e3440, accessory: "helmet", behavior: "commute", preferTypes: ["food", "transit"] },
  { name: "小美", job: "南山白领", emoji: "💼", color: 0xec4899, line: "总在夜市碰到她，拼桌吃猪脚饭认识的。", outfit: "粉色衬衫 + 西装裤，挎通勤包", shirt: 0xec4899, pants: 0x3a3f4a, accessory: "bag", behavior: "commute", preferTypes: ["work", "food", "mall"] },
  { name: "陈伯", job: "小区保安", emoji: "🧢", color: 0x64748b, line: "门岗陈伯，谁晚归他都记得，热心肠。", outfit: "藏青保安制服 + 大檐帽，腰间别着对讲机", shirt: 0x2c3e63, pants: 0x232a3a, accessory: "cap", behavior: "patrol", preferTypes: ["home", "mall"] },
  { name: "Lisa", job: "峰会外宾联络员", emoji: "🌐", color: 0x8b5cf6, line: "峰会筹备组的外联，英语超好，常在各个会场出没。", outfit: "深色西装套装 + 丝巾，胸前挂工作证", shirt: 0x5b4a8a, pants: 0x2b2b33, accessory: "tie", behavior: "wander", preferTypes: ["apec", "lodging"] },
  { name: "大芬姐", job: "夜市摊主", emoji: "🍢", color: 0xf59e0b, line: "烧烤摊老板娘，熟客永远多送一串。", outfit: "碎花围裙 + 袖套，头发利落地扎起来", shirt: 0xd97706, pants: 0x4a3226, accessory: "apron", behavior: "stay", preferTypes: ["food", "market"] },
  { name: "子健", job: "职院学生", emoji: "🎒", color: 0x22c55e, line: "在图书馆夜校总坐你隔壁，一起备考。", outfit: "绿色连帽卫衣 + 双肩包", shirt: 0x22c55e, pants: 0x374151, accessory: "bag", behavior: "wander", preferTypes: ["learn", "gym"] },
  { name: "王姨", job: "保洁阿姨", emoji: "🧹", color: 0x14b8a6, line: "写字楼和车站的保洁，拖把水桶是她的全套装备，地砖被她拖得能照人。", outfit: "橙色保洁马甲 + 胶手套", shirt: 0xe07b39, pants: 0x3f4a3a, accessory: "vest", behavior: "patrol", preferTypes: ["transit", "work", "mall"] },
  { name: "老周", job: "地铁通勤族", emoji: "🚇", color: 0x78716c, line: "每天同一班地铁，灰西装、公文包、耳机，站台黄线后最稳的那个人。", outfit: "灰西装 + 领带，手提公文包", shirt: 0x6b7280, pants: 0x2f333a, accessory: "tie", behavior: "commute", preferTypes: ["transit", "work"] },
  { name: "阿琳", job: "你的同事", emoji: "👩‍💻", color: 0x3b82f6, line: "工位在你隔壁，需求评审永远坐第一排，保温杯里泡着枸杞。", outfit: "白衬衫 + 工牌，头发扎成马尾", shirt: 0xdbe7f5, pants: 0x334155, accessory: "bag", behavior: "stay", preferTypes: ["work"] },
  { name: "林婶", job: "隔壁邻居", emoji: "🏠", color: 0xe0658a, line: "住你隔壁，阳台上种满葱，晚饭点总能闻到她家煲汤的香气。", outfit: "家居碎花衫 + 拖鞋，买菜拎着布袋", shirt: 0xe0658a, pants: 0x6b4a5a, accessory: "none", behavior: "stay", preferTypes: ["home", "fun"] },
  { name: "郭叔", job: "菜市场摊主", emoji: "🥬", color: 0x65a30d, line: "菜摊摆了二十年，称头从不缺斤少两，熟客来了先塞把葱。", outfit: "深绿围裙 + 草帽，手边一把杆秤", shirt: 0x7a9a4d, pants: 0x44403c, accessory: "apron", behavior: "stay", preferTypes: ["market", "food"] },
  /* ---- 香港街坊：中英双语，讲的都是香港的真实故事 ---- */
  { name: "华哥", job: "茶餐厅伙计", emoji: "🧋", color: 0xd97706, line: "「唔该，一位？」华哥记性惊人，熟客未坐低已经冲好奶茶。He remembers every regular's order.", outfit: "白色围裙 + 毛巾搭肩，手写单不离手", shirt: 0xf5f0e6, pants: 0x2e3440, accessory: "apron", behavior: "stay", preferTypes: ["food"], cities: ["hk"] },
  { name: "阿May", job: "中环白领", emoji: "💼", color: 0x0ea5e9, line: "中环返工的阿May，lunch 永远快靓正，放工去兰桂坊松一松。Central pace: fast at work, faster at happy hour.", outfit: "深蓝西装 + 白波鞋（返工标配），手袋里有后备高跟鞋", shirt: 0x2f3e55, pants: 0x23272e, accessory: "bag", behavior: "commute", preferTypes: ["work", "social"], cities: ["hk"] },
  { name: "强哥", job: "的士司机", emoji: "🚕", color: 0xdc2626, line: "开红的三十年，香港每条隧道边条最塞佢都背得出。Thirty years on the red taxi — he knows every tunnel jam by heart.", outfit: "短袖恤衫 + 老花镜挂颈，车头摆满路线牌", shirt: 0xf8fafc, pants: 0x3a3f4a, accessory: "none", behavior: "commute", preferTypes: ["transit"], cities: ["hk"] },
  { name: "婆婆珍", job: "街市菜贩", emoji: "🥬", color: 0x16a34a, line: "北角街市卖菜四十年，电车在门口叮叮过，她的秤从来唔呃人。Forty years at the market; the tram rings past her honest scales.", outfit: "碎花衫 + 围裙，腰包鼓鼓的都是散银", shirt: 0xe0658a, pants: 0x4a4a52, accessory: "apron", behavior: "stay", preferTypes: ["market", "food"], cities: ["hk"] },
  { name: "船长辉", job: "天星小轮船员", emoji: "⛴️", color: 0x0284c7, line: "天星小轮开了几十年，HK$5 有找过海——辉哥说这是全世界最抵的观光船。The Star Ferry: the cheapest harbour cruise on Earth.", outfit: "白色船员制服 + 船帽，胳膊晒得黝黑", shirt: 0xf1f5f9, pants: 0x1e3a5f, accessory: "cap", behavior: "patrol", preferTypes: ["transit", "fun"], cities: ["hk"] },
  { name: "肥妈", job: "深水埗邻居", emoji: "🏠", color: 0xe0658a, line: "住你隔篱的肥妈，煲汤香飘满层楼，成日问你食咗饭未。The neighbour whose soup smells fill the whole floor.", outfit: "家居花衫 + 布拖鞋，出门买菜拎个环保袋", shirt: 0xf0a6c0, pants: 0x6b4a5a, accessory: "none", behavior: "stay", preferTypes: ["home", "market"], cities: ["hk"] },
];

export const WEATHERS = ["☀️ 晴", "🌤️ 多云", "☁️ 阴", "🌦️ 小雨", "⛈️ 暴雨", "🌊 海风"];

export function weatherOf(day: number, cityKey: CityKey): string {
  if (day >= 14 && day <= 19) return day % 3 === 0 ? "🌤️ 多云" : "☀️ 晴";
  const w = WEATHERS[(day * 7 + (cityKey === "hz" ? 3 : 1)) % WEATHERS.length];
  return w ?? "☀️ 晴";
}

export type OutfitId = "formal" | "casual" | "sport" | "pajamas" | "raincoat";
export interface Outfit { id: OutfitId; name: string; emoji: string; shirt: number; pants: number; price: number; desc: string; scene: string; }
export const OUTFITS: Outfit[] = [
  { id: "formal", name: "正装", emoji: "👔", shirt: 0x2f3e55, pants: 0x23272e, price: 300, desc: "西装衬衫，上班、面试、接待外宾都体面", scene: "上班穿正装：上班经验额外 +1" },
  { id: "casual", name: "休闲装", emoji: "👕", shirt: 0x4a7fb5, pants: 0x3a3f4a, price: 0, desc: "T恤牛仔裤，逛街散步聚餐都自在", scene: "日常出门百搭" },
  { id: "sport", name: "运动装", emoji: "🏃", shirt: 0x22c55e, pants: 0x1f2937, price: 180, desc: "速干运动服，健身骑行轻装上阵", scene: "健身穿运动装：心情额外 +4" },
  { id: "pajamas", name: "睡衣", emoji: "🩳", shirt: 0x93c5fd, pants: 0xbfdbfe, price: 120, desc: "软乎乎的家居睡衣，在家躺平最舒服", scene: "在家穿睡衣：躺平恢复额外 +6 能量" },
  { id: "raincoat", name: "雨衣", emoji: "🧥", shirt: 0xfacc15, pants: 0x374151, price: 150, desc: "亮黄色雨衣，下雨天出门不淋湿、不掉心情", scene: "雨天穿雨衣：出门不扣心情" },
];
export function outfitOf(id: string): Outfit { return OUTFITS.find((o) => o.id === id) ?? OUTFITS[1]!; }
export function isRainy(weather: string): boolean { return weather.includes("雨") || weather.includes("暴雨"); }

export type RoomId = "living" | "bedroom" | "kitchen" | "bathroom";
export interface HomeRoom { id: RoomId; name: string; emoji: string; items: { emoji: string; label: string }[]; detail: string; }
export const HOME_ROOMS: HomeRoom[] = [
  { id: "living", name: "客厅", emoji: "🛋️", detail: "进门就是客厅，沙发对着电视，茶几上放着遥控器和半杯凉茶，窗边绿植晒着太阳。", items: [{ emoji: "📺", label: "电视" }, { emoji: "🪴", label: "绿植" }, { emoji: "🧶", label: "地毯" }, { emoji: "💡", label: "落地灯" }, { emoji: "🖼️", label: "挂画" }, { emoji: "🧺", label: "收纳篮" }] },
  { id: "bedroom", name: "卧室", emoji: "🛏️", detail: "卧室不大但安静，衣柜里挂着按场合分的衣服，床头闹钟、台灯和一本没看完的书。", items: [{ emoji: "👕", label: "衣柜" }, { emoji: "⏰", label: "闹钟" }, { emoji: "🪟", label: "窗帘" }, { emoji: "📚", label: "床头书" }, { emoji: "🔌", label: "充电线" }, { emoji: "🧦", label: "脏衣篓" }] },
  { id: "kitchen", name: "厨房", emoji: "🍳", detail: "厨房是烟火气最重的地方：灶上有锅、水槽里泡着碗，冰箱里码着买回来的菜，调料瓶排成一排。", items: [{ emoji: "🔥", label: "燃气灶" }, { emoji: "🚰", label: "水槽" }, { emoji: "🍚", label: "电饭煲" }, { emoji: "🧂", label: "调料架" }, { emoji: "🥬", label: "菜篮" }, { emoji: "🍳", label: "炒锅" }] },
  { id: "bathroom", name: "卫生间", emoji: "🚿", detail: "卫生间收拾得清爽，镜子上还留着洗漱的水汽，牙刷杯、毛巾各就各位，洗衣机在阳台一角待命。", items: [{ emoji: "🪥", label: "牙刷杯" }, { emoji: "🪞", label: "镜子" }, { emoji: "🧴", label: "洗发水" }, { emoji: "🧺", label: "洗衣机" }, { emoji: "🚽", label: "马桶" }, { emoji: "🛁", label: "浴帘" }] },
];

export interface Food {
  name: string;
  emoji: string;
  cost: number;
  energy: number;
  mood: number;
  desc: string;
}

export const FOODS: Record<CityKey, Food[]> = {
  sz: [
    { name: "隆江猪脚饭", emoji: "🍖", cost: 18, energy: 32, mood: 4, desc: "打工人的满汉全席，卤汁拌饭能吃三碗" },
    { name: "沙县小吃", emoji: "🥟", cost: 14, energy: 24, mood: 1, desc: "便宜管饱，蒸饺拌面老三样" },
    { name: "海底捞（拼桌）", emoji: "🍲", cost: 68, energy: 45, mood: 16, desc: "偶尔奢侈一把，美甲排队比吃饭久" },
  ],
  hz: [
    { name: "梅菜扣肉饭", emoji: "🍛", cost: 13, energy: 32, mood: 6, desc: "惠州本味，梅菜香到邻居敲墙" },
    { name: "海鲜大排档", emoji: "🦐", cost: 42, energy: 44, mood: 15, desc: "现捞现做，海风配啤酒，人间值得" },
    { name: "肠粉 + 豆浆", emoji: "🥛", cost: 8, energy: 20, mood: 3, desc: "早餐的体面，5分钟解决战斗" },
  ],
  hk: [
    { name: "云吞面（细蓉）", emoji: "🍜", cost: 42, energy: 30, mood: 8, desc: "HK$42 · 银丝面弹牙，云吞一口一只虾，大地鱼汤底——香港面的体面" },
    { name: "点心一盅两件", emoji: "🥟", cost: 58, energy: 32, mood: 11, desc: "HK$58 · 虾饺烧卖各一笼，普洱任斟，叹茶就是叹人生" },
    { name: "菠萝油 + 丝袜奶茶", emoji: "🧋", cost: 28, energy: 22, mood: 9, desc: "HK$28 · 冰火菠萝油配拉茶，下午茶三点三，香港人的充电时间" },
  ],
};

/* ---- ZhuyaHome 真实数据：风格模板 / 家具目录 / 材料价 ---- */
export interface Template {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  rentMul: number;
  comfort: number;
  wall: number;
  floor: number;
  accent: number;
  wallPrice: number;
  floorPrice: number;
}

export const TEMPLATES: Template[] = [
  { id: "nordic", name: "北欧轻奢", emoji: "🌿", desc: "浅橡木 + 布艺 + 黄铜点缀，明亮温柔，ZhuyaHome 最受欢迎的一套。", rentMul: 1.6, comfort: 38, wall: 0xf5efe4, floor: 0xc9a06c, accent: 0x7fb069, wallPrice: 40, floorPrice: 320 },
  { id: "luxmodern", name: "轻奢现代", emoji: "✨", desc: "大理石 + 真皮 + 深色木饰面，进门就有高级酒店感。", rentMul: 2.1, comfort: 52, wall: 0xe8e4dc, floor: 0x8a6f4d, accent: 0xc9a86a, wallPrice: 45, floorPrice: 450 },
  { id: "japanese", name: "日式", emoji: "🎋", desc: "原木、榻榻米、低矮家具，回家就想盘腿坐下喝茶。", rentMul: 1.5, comfort: 36, wall: 0xf3ead8, floor: 0xd9b98a, accent: 0xa3b18a, wallPrice: 38, floorPrice: 280 },
  { id: "chinese", name: "中式", emoji: "🏮", desc: "深色实木 + 留白 + 一盏暖灯，稳重安静，长辈看了都点头。", rentMul: 1.9, comfort: 48, wall: 0xefe6d5, floor: 0x7c4a2d, accent: 0xb91c1c, wallPrice: 42, floorPrice: 380 },
  { id: "industrial", name: "工业风", emoji: "🧱", desc: "水泥灰墙 + 金属 + 皮沙发，粗粝里带着酷。", rentMul: 1.7, comfort: 42, wall: 0xd6d3cd, floor: 0x9a8f83, accent: 0x374151, wallPrice: 35, floorPrice: 220 },
];

export function tplQuote(t: Template): number {
  return Math.round((26 * (t.wallPrice + t.floorPrice)) / 100) * 100;
}

export interface Furniture {
  id: string;
  emoji: string;
  name: string;
  price: number;
  comfort: number;
  styles: string[];
  color: number;
  desc: string;
  room: RoomId;
}

export const FURNITURE: Furniture[] = [
  { id: "sofa-fabric", emoji: "🛋️", name: "布艺三人沙发", price: 4800, comfort: 18, styles: ["北欧轻奢", "日式"], color: 0x93b8a4, desc: "ZhuyaHome 家具目录在售款，布艺面料、三人位，北欧/日式家里最百搭。" , room: "living" },
  { id: "sofa-leather", emoji: "🛋️", name: "真皮L型沙发", price: 15800, comfort: 32, styles: ["轻奢现代", "北欧轻奢"], color: 0x8a5a3b, desc: "真皮 L 型大沙发，轻奢现代的客厅主角，躺上去就不想起来。" , room: "living" },
  { id: "sofa-tatami", emoji: "🧘", name: "无腿榻榻米沙发", price: 3800, comfort: 15, styles: ["日式", "中式"], color: 0xd9c39a, desc: "无腿低矮设计，配日式/中式房，盘腿、躺平都舒服。" , room: "living" },
  { id: "table-oak", emoji: "🪵", name: "橡木圆形茶几", price: 1800, comfort: 10, styles: ["日式", "北欧轻奢", "中式"], color: 0xb08954, desc: "橡木圆茶几，不磕腿、好打理，日式和北欧都搭。" , room: "living" },
  { id: "table-marble", emoji: "⬜", name: "大理石方形茶几", price: 4200, comfort: 14, styles: ["轻奢现代", "工业风"], color: 0xf1f5f9, desc: "大理石台面方茶几，轻奢现代/工业风客厅的点睛之笔。" , room: "living" },
  { id: "tv-cabinet", emoji: "📺", name: "电视柜组合", price: 2600, comfort: 10, styles: ["北欧轻奢", "轻奢现代", "工业风"], color: 0x8a6f4d, desc: "客厅的电视墙组合，线都藏起来，客厅立刻像个家。", room: "living" },
  { id: "bed-double", emoji: "🛏️", name: "实木双人床", price: 5200, comfort: 20, styles: ["北欧轻奢", "日式", "中式"], color: 0xa9835a, desc: "卧室主角，实木床架配厚床垫，睡个好觉比什么都强。", room: "bedroom" },
  { id: "wardrobe", emoji: "👕", name: "三门衣柜", price: 4600, comfort: 14, styles: ["北欧轻奢", "轻奢现代", "中式"], color: 0xb08954, desc: "正装、休闲、运动、睡衣、雨衣分格挂好，换装不用翻箱倒柜。", room: "bedroom" },
  { id: "desk", emoji: "💻", name: "书桌 + 显示器支架", price: 1500, comfort: 8, styles: ["工业风", "北欧轻奢", "日式"], color: 0x6b7280, desc: "卧室角落的工作位，在家加班、学习都有个正经地方。", room: "bedroom" },
  { id: "fridge", emoji: "🧊", name: "双门冰箱", price: 3800, comfort: 12, styles: ["轻奢现代", "工业风", "北欧轻奢"], color: 0xd7dde3, desc: "买回来的菜有地方放了，囤一周的食材都不怕坏。", room: "kitchen" },
  { id: "kitchen-cabinet", emoji: "🍳", name: "整体橱柜 + 灶台", price: 8900, comfort: 22, styles: ["轻奢现代", "北欧轻奢", "工业风"], color: 0x9db4a0, desc: "ZhuyaHome 整体橱柜，灶台水槽一体，做饭动线顺了，烟火气也顺了。", room: "kitchen" },
  { id: "dining-table", emoji: "🍽️", name: "四人餐桌椅", price: 2800, comfort: 12, styles: ["日式", "北欧轻奢", "中式"], color: 0xb08954, desc: "厨房边的餐桌，自己做的饭要坐下来好好吃。", room: "kitchen" },
  { id: "washer", emoji: "🧺", name: "滚筒洗衣机", price: 2400, comfort: 9, styles: ["轻奢现代", "工业风"], color: 0xe5e7eb, desc: "卫生间/阳台角的洗衣机，攒一周的衣服一次洗净烘干。", room: "bathroom" },
  { id: "bathtub", emoji: "🛁", name: "独立浴缸", price: 5600, comfort: 20, styles: ["轻奢现代", "北欧轻奢", "日式"], color: 0xf1f5f9, desc: "卫生间升级款，加班回来泡个澡，一天的累都化在水里。", room: "bathroom" },
];

/* ---- 峰会日程 ---- */
export type ApecPhaseId = "before" | "prep" | "banquet" | "ceo" | "leaders" | "after";

export interface ApecPhase {
  id: ApecPhaseId;
  label: string;
  detail: string;
}

/** Game day N = November N. Leaders' week: 14–19. */
export function apecPhase(day: number): ApecPhase {
  if (!isApecSeason()) day = 99;
  if (day < 14)
    return { id: "before", label: "峰会倒计时", detail: `湾区国际峰会周 11 月 14 日在深圳开启，各方嘉宾云集。会场周边的会务兼职正在招人。` };
  if (day <= 15)
    return { id: "prep", label: "峰会周 · 筹备", detail: "峰会周已经开启，各会场在做最后布展和联调。三个会场的筹备兼职都加了人手，收入 ×1.2。" };
  if (day === 16)
    return { id: "banquet", label: "欢迎晚宴日", detail: "今晚欢迎晚宴在南山太子湾的海景酒店举行。太子湾晚宴服务收入 ×1.5，其他会场筹备 ×1.2。" };
  if (day === 17)
    return { id: "ceo", label: "工商峰会", detail: "湾区工商峰会在前海国际会议中心举行（17–18 日）。前海会务与接待收入 ×1.5。" };
  if (day === 18)
    return { id: "leaders", label: "峰会主会议 · 工商峰会收官", detail: "峰会主会议在香蜜湖深圳国际交流中心开幕（18–19 日），前海工商峰会今天收官。两个会场收入都 ×1.5。" };
  if (day === 19)
    return { id: "leaders", label: "峰会主会议 · 收官", detail: "峰会主会议今天收官，会徽上是深圳湾的海浪和木棉花。香蜜湖会场服务收入 ×1.5。" };
  return { id: "after", label: "峰会已落幕", detail: "峰会周已经结束，志愿者证书和这段经历还在。人脉和经验，是这周留给你最实在的东西。" };
}

/** Which venue is peaking on a given day, for per-venue multipliers. */
export function apecVenueMul(day: number, locId: string): number {
  if (!isApecSeason()) return 1;
  if (day >= 14 && day <= 15) return locId.startsWith("apec") ? 1.2 : 1;
  if (day === 16) return locId === "apec-taiziwan" ? 1.5 : locId.startsWith("apec") ? 1.2 : 1;
  if (day === 17) return locId === "apec-qianhai" ? 1.5 : locId.startsWith("apec") ? 1.2 : 1;
  if (day === 18) return locId === "apec-qianhai" || locId === "apec-xiangmihu" ? 1.5 : 1;
  if (day === 19) return locId === "apec-xiangmihu" ? 1.5 : 1;
  return 1;
}

export function isApecWeek(day: number): boolean {
  return isApecSeason() && day >= 14 && day <= 19;
}

/* ---- 湾区峰会周活动（公开上线版）：每天一个任务，按日程 ----
   玩家只能以志愿者 / 记者 / 司机的身份参与——峰会周的闭门会议不对
   公众开放，游戏里也绝不让玩家扮与会嘉宾进会场。完成 = 先到会场打卡
   （按真实地铁线路去），再做当天的岗位任务。六天全做完发服务证书。 */
export const APEC_SLOGAN = "来深圳看峰会、玩游戏认深圳";

export type ApecRole = "志愿者" | "记者" | "司机";

export interface ApecTask {
  id: string;
  day: number;
  dateLabel: string;
  event: string;
  role: ApecRole;
  roleEmoji: string;
  venueLocId: string;
  title: string;
  desc: string;
  energy: number;
  payMul: number;
  xp: number;
  network: number;
}

export const APEC_TASKS: ApecTask[] = [
  {
    id: "apec-d14", day: 14, dateLabel: "11 月 14 日", event: "峰会周开幕 · 筹备会与工商论坛",
    role: "志愿者", roleEmoji: "🎽", venueLocId: "apec-xiangmihu",
    title: "开幕日志愿引导",
    desc: "峰会周今天开幕，筹备会和工商论坛在香蜜湖国际交流中心开场。会议是闭门的，你的岗位在门外：引导、答疑、分发物料——盛会少不了门外的人。",
    energy: 20, payMul: 1.1, xp: 3, network: 1,
  },
  {
    id: "apec-d15", day: 15, dateLabel: "11 月 15 日", event: "峰会周 · 筹备会与工商论坛续会",
    role: "司机", roleEmoji: "🚐", venueLocId: "apec-xiangmihu",
    title: "会场通勤摆渡司机",
    desc: "开摆渡车在香蜜湖会场、周边酒店和地铁站之间接送记者与工作人员。路线要熟、时间要准，车上听各国记者聊花絮，比新闻里热闹。",
    energy: 22, payMul: 1.2, xp: 2, network: 1,
  },
  {
    id: "apec-d16", day: 16, dateLabel: "11 月 16 日晚", event: "太子湾欢迎晚宴",
    role: "志愿者", roleEmoji: "🎽", venueLocId: "apec-taiziwan",
    title: "欢迎晚宴礼宾服务",
    desc: "今晚欢迎晚宴在南山太子湾的海景酒店举行。你做礼宾引导和晚宴服务：嘉宾从邮轮港一路走来，海风、灯光、乐队都在你的班次里。",
    energy: 20, payMul: 1.5, xp: 3, network: 1,
  },
  {
    id: "apec-d17", day: 17, dateLabel: "11 月 17 日", event: "前海工商峰会 · 第一天",
    role: "记者", roleEmoji: "🎤", venueLocId: "apec-qianhai",
    title: "工商峰会跑会记者",
    desc: "湾区工商峰会在前海国际会议中心开场。你在新闻中心当跑会记者：抢机位、记要点、发快讯，把企业高管们的原话第一时间传出去。",
    energy: 20, payMul: 1.3, xp: 3, network: 1,
  },
  {
    id: "apec-d18", day: 18, dateLabel: "11 月 18 日", event: "峰会主会议开幕 · 工商峰会收官",
    role: "司机", roleEmoji: "🚐", venueLocId: "apec-xiangmihu",
    title: "峰会主会议外围保障司机",
    desc: "峰会主会议今天在香蜜湖开幕，前海工商峰会同日收官。你开保障车跑会场外围路线，接送媒体与后勤——离会场最近的普通人岗位之一。",
    energy: 24, payMul: 1.5, xp: 3, network: 1,
  },
  {
    id: "apec-d19", day: 19, dateLabel: "11 月 19 日", event: "峰会主会议 · 收官日",
    role: "志愿者", roleEmoji: "🎽", venueLocId: "apec-xiangmihu",
    title: "收官日志愿服务",
    desc: "峰会周最后一天。你做完最后一班志愿服务，在签退台领到这周的服务证书——峰会会徽下面，印着你的名字。",
    energy: 18, payMul: 1.4, xp: 4, network: 1,
  },
];

export function apecTaskOfDay(day: number): ApecTask | null {
  if (!isApecSeason()) return null;
  return APEC_TASKS.find((t) => t.day === day) ?? null;
}

export const APEC_CERT_NAME = "🎖️ 湾区峰会服务证书";

/* ---- 地点：深圳 25 + 惠州 21 = 46，坐标按双城真实地理方位铺在大地图上 ---- */
export type LocType =
  | "home" | "work" | "learn" | "market" | "apec" | "health" | "gym"
  | "transit" | "mall" | "bank" | "fun" | "food" | "social" | "scenic" | "port" | "mountain" | "lodging"
  /** 公共服务：派出所、药店、游客中心 */
  | "service";

export interface Loc {
  id: string;
  type: LocType;
  emoji: string;
  name: string;
  short: string;
  desc: string;
  x: number;
  z: number;
  color: number;
  h: number;
  w: number;
  gigName?: string;
  funName?: string;
  funCost?: number;
  funMood?: number;
  funDesc?: string;
  /** Real places only (OSM): what kind, and practical details when mapped. */
  placeKind?: PlaceKind;
  en?: string;
  tel?: string;
  addr?: string;
  hours?: string;
  er?: boolean;
}

const SZ_LOCS: Loc[] = [
  { id: "airport", type: "transit", emoji: "✈️", name: "宝安国际机场", short: "机场", desc: "T3 航站楼人流昼夜不停。机场摆渡、行李寄存、接机跑腿的单子多，峰会周外宾抵离高峰更缺人。", gigName: "机场摆渡 / 接机跑腿", x: -35.7, z: -5.3, color: 0x38bdf8, h: 1.8, w: 3.4 },
  { id: "apec-qianhai", type: "apec", emoji: "🏙️", name: "前海国际会议中心", short: "前海会议中心", desc: "湾区工商峰会（11 月 17–18 日）的举办地。各国企业高管云集，会务、接待、同传协助都缺人。", x: -28, z: 4.4, color: 0xb91c1c, h: 3, w: 3 },
  { id: "happyvalley", type: "fun", emoji: "🎢", name: "欢乐谷", short: "欢乐谷", desc: "过山车的尖叫声隔着一条街都听得见。深漂的快乐老家，一张门票换一天不管不顾。", funName: "欢乐谷玩一整天", funCost: 120, funMood: 30, funDesc: "排最长的队，坐最快的过山车，下来腿软心飞", x: -15.0, z: 1.75, color: 0xe879f9, h: 2.5, w: 2.8 },
  { id: "work", type: "work", emoji: "🏢", name: "科技园公司", short: "公司", desc: "南山科技园里一家几十人的创业公司，灯火通明到深夜。你在深圳的第一份工；想跳槽，就去各大厂总部面试。", x: -20.6, z: 0.4, color: 0x3b82f6, h: 4.9, w: 2.6 },
  /* 大厂总部：都能面试、拿 offer、跳槽过去上班（见 COMPANIES）。位置按真实地铁站摆放。 */
  { id: "co-tencent", type: "work", emoji: "🐧", name: "腾讯滨海大厦", short: "腾讯", desc: "后海的腾讯总部：两栋塔楼用三座空中连廊连在一起。", x: -25.6, z: 4.2, color: 0x2563eb, h: 4.9, w: 2.1 },
  { id: "co-penguin", type: "work", emoji: "🏝️", name: "腾讯 · 大铲湾总部", short: "大铲湾园区", desc: "宝安大铲湾填海建起的腾讯新总部园区，2025 年 10 月起试运营，规划能容纳 8–10 万人，滨海栈道和红树林对市民开放。", x: -30.1, z: 2.4, color: 0x0ea5e9, h: 2.5, w: 2.3 },
  { id: "co-bytedance", type: "work", emoji: "🎵", name: "字节跳动 · 后海中心", short: "字节", desc: "字节跳动在深圳的第一座自建总部，后海约 150 米高的塔楼。", x: -22.2, z: 3.5, color: 0x111827, h: 4.5, w: 2 },
  { id: "co-baidu", type: "work", emoji: "🔎", name: "百度国际大厦", short: "百度", desc: "后海的百度深圳总部，东西两座塔楼。", x: -22.3, z: 1.7, color: 0x2563eb, h: 4.1, w: 2 },
  { id: "co-dji", type: "work", emoji: "🚁", name: "大疆总部大楼", short: "大疆", desc: "西丽留仙洞的大疆总部：两座塔楼之间悬挑出一层层平台，无人机在楼顶试飞。", x: -19.5, z: -1.5, color: 0x1f2937, h: 4.9, w: 2 },
  { id: "co-huawei", type: "work", emoji: "📶", name: "华为坂田基地", short: "华为", desc: "龙岗坂田的华为总部园区，大片低层研发楼、湖和绿地。", x: 3.1, z: -13.3, color: 0xdc2626, h: 1.6, w: 2.5 },
  { id: "co-zte", type: "work", emoji: "📡", name: "中兴通讯大厦", short: "中兴", desc: "南山科技园的中兴总部，深南大道边的老牌通信大厂。", x: -20.6, z: 2.5, color: 0x0284c7, h: 3.7, w: 2 },
  { id: "co-cmb", type: "work", emoji: "🏦", name: "招商银行大厦", short: "招行", desc: "福田深南大道上的招商银行总部，银行的规矩多，面试要穿正装。", x: -8.2, z: 1.5, color: 0xb91c1c, h: 5.3, w: 2 },
  { id: "co-vanke", type: "work", emoji: "🏗️", name: "万科中心", short: "万科", desc: "大梅沙海边的「水平摩天楼」：整栋楼架在空中，下面是公园，开窗就是海。", x: 29.5, z: -1.9, color: 0xf97316, h: 1.3, w: 2.5 },
  { id: "co-byd", type: "work", emoji: "🔋", name: "比亚迪坪山总部", short: "比亚迪", desc: "坪山的比亚迪总部和工厂，新能源车和电池，招工量大，门槛低。", x: 34.7, z: -7.9, color: 0x16a34a, h: 2, w: 2.5 },
  { id: "talent", type: "fun", emoji: "🏃", name: "人才公园", short: "人才公园", desc: "海边跑道和求贤阁。晨跑的人、看海的人、聊 offer 的人，都在这儿。", funName: "沿海边跑道散步", funCost: 10, funMood: 20, funDesc: "跑道灯光一路亮到海边，跑完一身轻", x: -22, z: 6.8, color: 0x14b8a6, h: 0.7, w: 2.5 },
  { id: "mall", type: "mall", emoji: "🛍️", name: "海岸城商场", short: "商场", desc: "逛街、买衣服、看人花钱。也能接周末促销兼职，站柜台赚点外快。", x: -25.5, z: 6.5, color: 0xec4899, h: 2.8, w: 2.8 },
  { id: "home", type: "home", emoji: "🏠", name: "城中村握手楼", short: "出租屋", desc: "你租的小单间，窗户对着隔壁楼——握手楼名不虚传。睡觉、躺平都在这儿。", x: -18.8, z: 1.8, color: 0xff6b4a, h: 2, w: 2.3 },
  { id: "gym", type: "gym", emoji: "🏋️", name: "社区健身房", short: "健身房", desc: "铁馆月卡不贵。体质练上去（健身 3 次后），上班都没那么耗能量了。", x: -24.1, z: 2.8, color: 0x84cc16, h: 2, w: 2.3 },
  { id: "apec-taiziwan", type: "apec", emoji: "🚢", name: "太子湾 · 峰会欢迎晚宴", short: "太子湾晚宴", desc: "南山太子湾，11 月 16 日晚 峰会欢迎晚宴在太子湾海景酒店举行。晚宴服务、礼宾引导是普通人离这场盛会最近的岗位。", x: -30, z: 9.4, color: 0x991b1b, h: 2.5, w: 2.8 },
  { id: "port", type: "transit", emoji: "🛳️", name: "蛇口邮轮母港", short: "邮轮港", desc: "邮轮靠港时行李搬运、接送单特别多，外国游客也多，练口语的好地方。", gigName: "邮轮行李搬运 / 接送", x: -27.8, z: 10.6, color: 0x0ea5e9, h: 1.3, w: 2.6 },
  { id: "szbayport", type: "port", emoji: "🛃", name: "深圳湾口岸", short: "深圳湾口岸", desc: "过大桥就是香港。跨境代购、接送、行李帮忙的单子不断，口岸越忙越有赚头。", gigName: "口岸接送 / 跨境跑腿", x: -23.7, z: 8.5, color: 0x22d3ee, h: 1.5, w: 2.8 },
  { id: "fun", type: "fun", emoji: "🌅", name: "深圳湾公园", short: "海边公园", desc: "看海、吹风、看日落。花小钱回大心情，深漂的充电站。", x: -20.5, z: 4.6, color: 0x10b981, h: 0.7, w: 2.6 },
  { id: "apec-xiangmihu", type: "apec", emoji: "🌐", name: "深圳国际交流中心 · 香蜜湖", short: "国际交流中心", desc: "福田香蜜湖北侧，湾区国际峰会的主会场（11 月 18–19 日）。峰会周不对公众开放，普通人以志愿者、会务、接待、司机的身份参与。", x: -7.8, z: -0.9, color: 0xdc2626, h: 3.6, w: 3 },
  { id: "lianhua", type: "fun", emoji: "⛰️", name: "莲花山公园", short: "莲花山", desc: "登顶看福田灯火，邓小平像前吹吹风。免费，心情照样回满。", funName: "登莲花山看夜景", funCost: 0, funMood: 16, funDesc: "一分钱不花，爬到山顶看整座城市亮起来", x: -2.8, z: -2.9, color: 0x059669, h: 1, w: 2.6 },
  { id: "library", type: "learn", emoji: "📚", name: "深圳图书馆 · 夜校", short: "图书馆", desc: "北馆夜校和自习区灯火通明。攒技能点的地方——想升职，先来这儿充电。", x: -5.1, z: -2, color: 0x7c3aed, h: 2.6, w: 2.6 },
  { id: "north", type: "transit", emoji: "🚄", name: "深圳北站", short: "北站", desc: "高铁站人流如织。车站跑腿、闪送单不少，赶上出差潮还能多赚点。", gigName: "车站跑腿 / 闪送", x: -4.7, z: -7.1, color: 0x6366f1, h: 1.5, w: 3 },
  { id: "bank", type: "bank", emoji: "🏦", name: "平安金融中心", short: "银行", desc: "存款、理财都在这儿办。闲钱买理财，每晚有点收益——但投资有波动，别上头。", x: -5.4, z: 0.3, color: 0xf59e0b, h: 4.3, w: 2.5 },
  { id: "metro", type: "transit", emoji: "🚇", name: "地铁站", short: "地铁站", desc: "早高峰能把鞋挤掉的地方。也能在这附近接跑腿/外卖兼职单。", x: -3.2, z: -0.6, color: 0x8b5cf6, h: 1, w: 2.6 },
  { id: "hq", type: "market", emoji: "📱", name: "华强北电子市场", short: "华强北", desc: "一米柜台走出过无数传奇。能淘二手手机捡漏，也能接装机兼职练手。", x: 1.4, z: -1.9, color: 0x06b6d4, h: 3.8, w: 2.6 },
  { id: "food", type: "food", emoji: "🍜", name: "东门夜市食街", short: "夜市", desc: "猪脚饭、沙县、海底捞全在这一条街。没能量了就来这儿回血。", x: 5.8, z: -4, color: 0xf59e0b, h: 1.5, w: 2.6 },
  { id: "hospital", type: "health", emoji: "🏥", name: "深圳市人民医院", short: "医院", desc: "体检、调理、看小毛病。身体是革命的本钱，也是打工的本钱。", x: 8.4, z: -4.6, color: 0xf43f5e, h: 3.3, w: 2.6 },
  { id: "ktv", type: "social", emoji: "🎤", name: "酒吧街 · KTV", short: "酒吧街", desc: "下班后的另一面深圳。唱K、小酌、认识新朋友——人脉就是在这儿攒的。", x: 3.5, z: -3.1, color: 0xa855f7, h: 2.3, w: 2.6 },
  { id: "luohu", type: "port", emoji: "🧳", name: "罗湖口岸", short: "罗湖口岸", desc: "最老牌的深港口岸，港人北上消费的第一站。帮忙提行李、做向导、接送的单子排着队。", gigName: "口岸向导 / 行李帮忙", x: 5.2, z: -1.3, color: 0xfb7185, h: 1.6, w: 2.8 },
  { id: "dafen", type: "market", emoji: "🎨", name: "大芬油画村", short: "大芬油画村", desc: "全球知名的油画村，画廊和画工坊挤满小巷。能接临摹、装裱兼职，也能淘一幅画装点出租屋。", gigName: "画作装裱 / 临摹兼职", x: 12.1, z: -10.2, color: 0xf472b6, h: 1.8, w: 2.6 },
  { id: "dameisha", type: "fun", emoji: "🏖️", name: "大梅沙海滨公园", short: "大梅沙", desc: "深圳人自己的海滩，地铁直达。赶海、踏浪、看日出，深漂的周末后花园。", funName: "大梅沙赶海踏浪", funCost: 15, funMood: 24, funDesc: "光脚踩完整片沙滩，浪花把一周的疲惫都卷走", x: 31.5, z: -0.5, color: 0x2dd4bf, h: 0.6, w: 2.8 },
  { id: "hotel", type: "lodging", emoji: "🏨", name: "深圳湾滨海酒店 · 青旅", short: "酒店青旅", desc: "一边是滨海酒店，一边是青年旅舍。住一晚换个枕头，或看看长租公寓——住宿的门道都在这儿。", x: -18.1, z: 4.1, color: 0xf472b6, h: 3.4, w: 2.8 },
  { id: "huanggangport", type: "port", emoji: "🛃", name: "皇岗口岸", short: "皇岗口岸", desc: "24小时通关口岸，深夜也有人过关去香港。跨境接送、夜班跑腿单多，也能过关一日游。", gigName: "口岸夜班接送 / 跨境跑腿", x: -1.9, z: 1.5, color: 0x22d3ee, h: 1.5, w: 2.8 },
  { id: "wutongshan", type: "mountain", emoji: "⛰️", name: "梧桐山", short: "梧桐山", desc: "深圳第一高峰，海拔943米。登顶看盐田港和大鹏湾，山风把班味全吹散。", funName: "登梧桐山看海", funCost: 0, funMood: 28, funDesc: "爬到大梧桐顶，深圳和大鹏湾尽收眼底", x: 18.8, z: -6.6, color: 0x059669, h: 2.1, w: 2.8 },
  { id: "futianport", type: "port", emoji: "🛃", name: "福田口岸", short: "福田口岸", desc: "落马洲支线口岸，过关就是香港。跨境接送、代购跑腿单不断，也能过关去香港玩一天。", gigName: "口岸接送 / 跨境跑腿", x: -4.3, z: 2.6, color: 0x22d3ee, h: 1.5, w: 2.8 },
  { id: "liantangport", type: "port", emoji: "🛃", name: "莲塘口岸", short: "莲塘口岸", desc: "最新口岸，人车直达，去香港东部最快。过关一日游、跨境跑腿都方便。", gigName: "口岸向导 / 跨境跑腿", x: 12.3, z: -4.8, color: 0x38bdf8, h: 1.5, w: 2.8 },
  { id: "wenjinduport", type: "port", emoji: "🚛", name: "文锦渡口岸", short: "文锦渡", desc: "深港之间的货运口岸：深圳河上的老桥，只有跨境货车过关。旅客去旁边的罗湖口岸。", gigName: "货柜车调度 / 跑腿", x: 7.5, z: -2.4, color: 0x94a3b8, h: 1.5, w: 2.6 },
  { id: "shatoujiaoport", type: "port", emoji: "🛃", name: "沙头角口岸", short: "沙头角口岸", desc: "中英街旁边的老口岸，旅检大楼正在拆了重建，现在只走车。想去香港，走莲塘或罗湖。", gigName: "口岸跑腿", x: 19.5, z: -3.9, color: 0x94a3b8, h: 1.5, w: 2.6 },
  { id: "xianhuhu", type: "scenic", emoji: "🌺", name: "仙湖植物园 · 弘法寺", short: "仙湖植物园", desc: "梧桐山下的植物园和弘法寺。看花、祈福、湖边发呆，游客打卡胜地。", funName: "仙湖赏花祈福", funCost: 15, funMood: 22, funDesc: "湖光山色里走一圈，心都静了", x: 15.4, z: -6.5, color: 0xdb2777, h: 1, w: 2.8 },
  { id: "yantian", type: "scenic", emoji: "🌊", name: "盐田海滨栈道", short: "盐田栈道", desc: "19.5公里海滨栈道连起大梅沙和中英街。骑行看海、吃海鲜，深圳最舒服的海岸线。", funName: "盐田栈道骑行看海", funCost: 10, funMood: 24, funDesc: "沿着栈道骑到灯塔下，海风追着你跑", x: 24.9, z: -4, color: 0x0891b2, h: 0.6, w: 2.8 },
  { id: "window", type: "fun", emoji: "🗼", name: "世界之窗", short: "世界之窗", desc: "国家 5A 级景区，48 公顷里缩着 130 多处世界名胜微缩景观——一天环游世界，是外宾认识深圳的第一站之一。", funName: "世界之窗环游世界", funCost: 110, funMood: 28, funDesc: "上午还在埃菲尔铁塔下，下午就到了金字塔前", x: -16.7, z: 2, color: 0x0ea5e9, h: 2.8, w: 2.5 },
  { id: "jinxiu", type: "fun", emoji: "🏮", name: "锦绣中华 · 民俗村", short: "锦绣中华", desc: "国家 5A 级景区，中国各地名胜微缩景观和 28 个民族村寨同园，一步一景走遍大中华。", funName: "锦绣中华一日看遍中国", funCost: 110, funMood: 27, funDesc: "从微缩长城走到傣族村寨，民族歌舞一场接一场", x: -14.7, z: 1.1, color: 0xdc2626, h: 2.1, w: 2.3 },
  { id: "safari", type: "fun", emoji: "🦒", name: "深圳野生动物园", short: "野生动物园", desc: "国家 4A 级景区，西丽湖畔的放养式动物园，300 多种近万头（只）动物，亲子游的顶流。", funName: "野生动物园看猛兽", funCost: 99, funMood: 26, funDesc: "坐投喂车进猛兽区，老虎就在窗外散步", x: -13.9, z: -4, color: 0x65a30d, h: 1.3, w: 2.8 },
  { id: "octeast", type: "fun", emoji: "🎡", name: "东部华侨城", short: "东部华侨城", desc: "国家 4A 级景区，大梅沙后山的大侠谷、茶溪谷，山海之间的生态度假区，缆车索道穿云过。", funName: "东部华侨城山海一日", funCost: 120, funMood: 30, funDesc: "坐缆车上云端，茶溪谷里喝一杯三洲田的茶", x: 29.5, z: -4.7, color: 0x059669, h: 2.3, w: 3 },
  { id: "qingqing", type: "fun", emoji: "🌴", name: "青青世界", short: "青青世界", desc: "国家 4A 级景区，南山月亮湾的热带雨林生态园，蝴蝶谷、瓜果公园，城市边上的绿野仙踪。", funName: "青青世界钻雨林", funCost: 60, funMood: 24, funDesc: "热带雨林里走吊桥，蝴蝶落在肩膀上", x: -28.4, z: 7.5, color: 0x16a34a, h: 1.5, w: 2.6 },
  { id: "seagarden", type: "fun", emoji: "🦀", name: "海上田园", short: "海上田园", desc: "国家 4A 级景区，宝安沙井的滨海湿地田园，红树林、鱼塘、农庄，深圳西部的慢生活样本。", funName: "海上田园摸鱼抓蟹", funCost: 60, funMood: 24, funDesc: "下到滩涂里摸蚬子，红树林边看白鹭起飞", x: -36, z: -15.3, color: 0x0d9488, h: 1, w: 2.8 },
  { id: "gmfarm", type: "fun", emoji: "🐄", name: "光明农场大观园", short: "光明农场", desc: "国家 4A 级景区，光明区的农场乐园：挤牛奶、摘果蔬、看奶牛牧场，光明乳鸽和甜玉米是招牌。", funName: "光明农场挤牛奶摘玉米", funCost: 50, funMood: 24, funDesc: "亲手挤一回牛奶，再啃一根刚摘的甜玉米", x: -15.7, z: -19.9, color: 0x84cc16, h: 1, w: 2.8 },
  { id: "dapengfort", type: "scenic", emoji: "🏯", name: "大鹏所城", short: "大鹏所城", desc: "国家 4A 级景区，明清海防所城，深圳地名「鹏城」的源头。青砖老巷里走一走，再去较场尾看海。", funName: "大鹏所城访古看海", funCost: 20, funMood: 26, funDesc: "在六百年的城墙下喝杯凉茶，巷子尽头就是海", x: 36, z: -10, color: 0xb45309, h: 1.3, w: 2.8 },
  { id: "octharbour", type: "fun", emoji: "🎠", name: "欢乐海岸", short: "欢乐海岸", desc: "国家 5A 级景区，深圳湾畔的滨海休闲带：椰林沙滩、水秀表演、OCT 创意市集，夜里最热闹。", funName: "欢乐海岸看水秀", funCost: 40, funMood: 26, funDesc: "沿着曲水湾散步，水秀的灯光在湖面上开花", x: -14.8, z: 3.5, color: 0x7c3aed, h: 1.8, w: 2.8 },
  { id: "missionhills", type: "fun", emoji: "⛳", name: "观澜湖旅游休闲度假区", short: "观澜湖", desc: "国家 5A 级景区，龙华观澜的高尔夫休闲度假区，12 个球场连绵山丘之间，生态体育园对外开放。", funName: "观澜湖生态园骑行", funCost: 60, funMood: 25, funDesc: "沿着球场边的绿道骑行，草坪绿得像地毯", x: 6.2, z: -20.3, color: 0x15803d, h: 1.1, w: 2.8 },
  { id: "qiniangshan", type: "mountain", emoji: "🏔️", name: "七娘山", short: "七娘山", desc: "大鹏半岛的主峰，海拔 869 米，深圳第二高峰。主峰科考线一路溪流和怪石，登顶一边是海一边是城。", funName: "登七娘山看山海", funCost: 0, funMood: 27, funDesc: "爬到主峰，大鹏湾和排牙山一左一右", x: 36, z: -2.9, color: 0x047857, h: 2, w: 2.8 },
  { id: "yangmeikeng", type: "scenic", emoji: "🌄", name: "杨梅坑", short: "杨梅坑", desc: "大鹏南澳的山海谷地，溪流穿过村子入海，鹿嘴山庄的海边栈道和美人鱼洞是骑行党的终点站。", funName: "杨梅坑沿海骑行", funCost: 20, funMood: 26, funDesc: "沿着海岸骑到鹿嘴山庄，浪就拍在脚边", x: 36, z: -5.2, color: 0x0d9488, h: 0.8, w: 2.6 },
  { id: "xichong", type: "fun", emoji: "🏝️", name: "西涌海滩", short: "西涌", desc: "深圳最长的沙滩，4.5 公里月牙湾，暗夜保护区里能看银河。冲浪、露营、看日出的人扎堆往这儿跑。", funName: "西涌踏浪看日出", funCost: 25, funMood: 27, funDesc: "踩完整条月牙湾，清晨的海是粉色的", x: 36, z: -0.7, color: 0x06b6d4, h: 0.6, w: 2.8 },
  { id: "zhongyingjie", type: "scenic", emoji: "🏮", name: "中英街", short: "中英街", desc: "沙头角的一街两制历史街区，一边深圳一边香港，界碑和老骑楼还在，买免税品和看历史展馆的人都来。", funName: "中英街访古购物", funCost: 30, funMood: 22, funDesc: "站在界碑旁边，一只脚在深圳一只脚看香港", x: 21.5, z: -2.6, color: 0xb45309, h: 1.1, w: 2.5 },
  { id: "tanglangshan", type: "mountain", emoji: "🌲", name: "塘朗山郊野公园", short: "塘朗山", desc: "南山西丽的城市郊野公园，海拔 430 米，盘山公路一路荔枝林，山顶能望见深圳湾和西丽水库。", funName: "塘朗山盘山徒步", funCost: 0, funMood: 23, funDesc: "沿着盘山路慢慢走高，城市在身后一点点变小", x: -10.9, z: -3.7, color: 0x16a34a, h: 1.6, w: 2.6 },
  { id: "fenghuangshan", type: "mountain", emoji: "🦚", name: "凤凰山森林公园", short: "凤凰山", desc: "宝安福永的森林公园，凤凰岩和望烟楼是老宝安八景，山脚的凤岩古庙香火旺，登山步道周末全是人。", funName: "凤凰山登高祈福", funCost: 0, funMood: 23, funDesc: "爬到望烟楼，珠江口和宝安城区都在眼底", x: -26.6, z: -9.7, color: 0x059669, h: 1.8, w: 2.8 },
  { id: "szmuseum", type: "learn", emoji: "🏛️", name: "深圳博物馆", short: "深圳博物馆", desc: "市民中心东翼的老馆加金田路的新馆，古代深圳、改革开放史都从这儿讲起。免费开放，外宾认深圳的第二课。", funName: "看改革开放史展", funCost: 0, funMood: 18, funDesc: "从小渔村的时间轴走到特区四十年", x: -0.9, z: -1.3, color: 0x92400e, h: 2.1, w: 2.6 },
  { id: "swcac", type: "fun", emoji: "🎭", name: "海上世界文化艺术中心", short: "海上世界艺术中心", desc: "蛇口海边的白色艺术中心，临海展厅和屋顶花园对着海。看展、听音乐会、沿海散步，文艺青年的据点。", funName: "海边看展听海", funCost: 40, funMood: 24, funDesc: "展厅落地窗外就是海，看完展正好赶上日落", x: -26.2, z: 8.9, color: 0x7c3aed, h: 1.8, w: 2.6 },
  { id: "chunjian", type: "gym", emoji: "🏟️", name: "深圳湾体育中心 · 春茧", short: "春茧体育中心", desc: "后海的「春茧」体育场馆群，大运会的主场馆。跑道对外开放，演唱会和球赛轮着来，夜跑的人绕着茧壳一圈圈跑。", funName: "绕春茧夜跑一圈", funCost: 10, funMood: 20, funDesc: "茧壳亮起灯，跑道上一圈都是夜跑的人", x: -23.5, z: 5.1, color: 0x0ea5e9, h: 1.6, w: 2.8 },
  { id: "universiade", type: "gym", emoji: "🏟️", name: "龙岗大运中心", short: "大运中心", desc: "龙岗的体育中心，水晶石场馆立在湖边。大运会留下的场馆现在对外开放，游泳、羽毛球、演唱会都办。", funName: "大运中心游泳打球", funCost: 30, funMood: 21, funDesc: "在水晶石场馆里游一圈，湖风从窗外吹进来", x: 23.2, z: -14.9, color: 0x0284c7, h: 1.6, w: 2.8 },
];

const HZ_LOCS: Loc[] = [
  { id: "luofu", type: "fun", emoji: "⛰️", name: "罗浮山", short: "罗浮山", desc: "爬山、吸氧、吃山水豆腐花。一趟下来，心情和体质一起回血。", funName: "登罗浮山", funCost: 25, funMood: 26, funDesc: "爬到飞云顶看云海，下山吃一碗山水豆腐花", x: -22.6, z: -18.7, color: 0x059669, h: 1.5, w: 2.8 },
  { id: "work", type: "work", emoji: "🏭", name: "仲恺公司", short: "公司", desc: "惠州的工作地，节奏比深圳慢一拍，工资也慢一拍——但职级一样能往上爬。", x: -6.1, z: -4, color: 0x64748b, h: 3.1, w: 2.6 },
  { id: "gym", type: "gym", emoji: "🚴", name: "红花湖骑行站", short: "骑行站", desc: "环湖绿道 18 公里。租车骑行练体质，练够 3 次，上班都没那么累了。", x: -6.6, z: -7.7, color: 0x84cc16, h: 1.3, w: 2.5 },
  { id: "library", type: "learn", emoji: "📚", name: "惠州市图书馆", short: "图书馆", desc: "东江边的新馆，安静明亮。夜校课程便宜，攒技能、备考、升职都靠它。", x: -1.1, z: -14.3, color: 0x7c3aed, h: 2.5, w: 2.6 },
  { id: "xihu", type: "fun", emoji: "🛶", name: "惠州西湖", short: "西湖", desc: "苏堤、泗洲塔、红花洲。泛舟湖上，半天就过去了。", funName: "西湖泛舟", funCost: 30, funMood: 22, funDesc: "租条小船划到湖心，岸上再热闹也与你无关", x: -2.7, z: -7.2, color: 0x10b981, h: 0.8, w: 2.6 },
  { id: "hq", type: "market", emoji: "🧺", name: "桥东二手市集", short: "二手市集", desc: "老街边的二手市集，旧手机、旧家具、旧唱片什么都有。能捡漏，也能帮摊主装机修小电器。", x: 1.8, z: -8.6, color: 0x06b6d4, h: 2.1, w: 2.6 },
  { id: "metro", type: "transit", emoji: "🚆", name: "城轨站", short: "城轨站", desc: "去深圳/广州都方便。站口能接摆摊、代驾这类灵活兼职。", x: -3.6, z: -4, color: 0x0ea5e9, h: 1.1, w: 2.8 },
  { id: "mall", type: "mall", emoji: "🛍️", name: "港惠商场", short: "商场", desc: "惠州人逛街的老牌商场。买衣服、看电影，也能接周末促销兼职。", x: -1.2, z: -5.2, color: 0xec4899, h: 2.6, w: 2.8 },
  { id: "hospital", type: "health", emoji: "🏥", name: "惠州市第一人民医院", short: "医院", desc: "体检和调理都不贵。海边城市节奏慢，养身体也方便。", x: -3.4, z: -13.7, color: 0xf43f5e, h: 3, w: 2.6 },
  { id: "huamao", type: "mall", emoji: "🏬", name: "江北华贸天地", short: "华贸天地", desc: "江北 CBD 的地标商场，惠州最体面的逛街地。品牌促销兼职多，时薪也体面。", x: -4.1, z: -11.3, color: 0xd946ef, h: 3.4, w: 2.8 },
  { id: "bank", type: "bank", emoji: "🏦", name: "惠州农商银行", short: "银行", desc: "存钱、买理财的网点。闲钱别光躺活期——但理财有波动，量力而行。", x: 0.6, z: -12.6, color: 0xf59e0b, h: 3, w: 2.5 },
  { id: "food", type: "food", emoji: "🦐", name: "老街夜市", short: "夜市", desc: "梅菜扣肉、海鲜大排档、肠粉豆浆——惠州的胃在这儿安家。", x: -4.5, z: -8.8, color: 0xf59e0b, h: 1.5, w: 2.6 },
  { id: "ktv", type: "social", emoji: "🎤", name: "东江酒吧街", short: "酒吧街", desc: "东江边的夜生活。唱K、小酌、结识新朋友，人脉慢慢攒。", x: 0.1, z: -10.3, color: 0xa855f7, h: 2.1, w: 2.6 },
  { id: "hejiang", type: "fun", emoji: "🗼", name: "合江楼 · 东江夜游", short: "东江夜游", desc: "合江楼临江而立，夜里灯一亮，游船排着队。坐一趟夜游船，东江两岸的灯火慢慢过。", funName: "东江夜游坐船", funCost: 40, funMood: 24, funDesc: "船行江心，合江楼的灯影碎在水面上", x: -0.5, z: -7.9, color: 0x818cf8, h: 2, w: 2.5 },
  { id: "hzsouth", type: "transit", emoji: "🚄", name: "惠州南站", short: "惠州南站", desc: "厦深高铁大站，去深圳北只要半小时。出站口的接送、跑腿单常年不断。", gigName: "车站接送 / 跑腿", x: 0.5, z: 7.3, color: 0x6366f1, h: 1.5, w: 3 },
  { id: "danshui", type: "market", emoji: "🏮", name: "淡水老城", short: "淡水老城", desc: "惠阳淡水的老骑楼街，客家小吃和老字号挤满一条街。帮工、摆摊、修小电器的活儿都找得到。", gigName: "老城摆摊 / 帮工", x: -2.1, z: 7.7, color: 0xf59e0b, h: 1.6, w: 2.6 },
  { id: "dayawan", type: "fun", emoji: "🏝️", name: "大亚湾黄金海岸", short: "黄金海岸", desc: "沙子细、海水清，本地人周末拖家带口来。摆个小摊卖椰子也能赚点零花。", funName: "黄金海岸踏浪", funCost: 12, funMood: 24, funDesc: "踩着细沙走完整条海岸线，烦恼都被浪带走了", x: 10.4, z: 7.7, color: 0x0891b2, h: 0.6, w: 2.8 },
  { id: "hotel", type: "transit", emoji: "♨️", name: "温泉酒店", short: "温泉酒店", desc: "巽寮湾边的温泉酒店，周末客流旺。帮工、接待、行李单都不少，峰会周深圳客多，这边也跟着旺。", gigName: "温泉酒店帮工 / 接待", x: 12.7, z: -2.2, color: 0xf97316, h: 2.3, w: 2.6 },
  { id: "xunliao", type: "transit", emoji: "⛵", name: "巽寮湾渔港", short: "巽寮湾", desc: "渔船回港时最热闹。帮渔家分拣、给游客当向导，旺季不缺活儿。", gigName: "渔港帮工 / 海钓向导", x: 12.8, z: 13.9, color: 0x0284c7, h: 1.1, w: 2.8 },
  { id: "home", type: "home", emoji: "🏠", name: "海边出租屋", short: "出租屋", desc: "推窗能闻到海风的老房子，租金便宜。睡觉、躺平都在这儿。", x: 22.2, z: 15.4, color: 0xfb923c, h: 1.8, w: 2.3 },
  { id: "fun", type: "fun", emoji: "🏖️", name: "双月湾海边", short: "海边", desc: "沙滩、海浪、日落，全免费。心情崩了就来这儿坐一会儿。", x: 22, z: 17.8, color: 0x06b6d4, h: 0.5, w: 2.8 },
  { id: "hostel", type: "lodging", emoji: "🛏️", name: "西湖青旅 · 湖畔民宿", short: "青旅民宿", desc: "西湖边的青年旅舍和湖畔民宿，背包客的天堂。住一晚、拼个桌、听听别人的旅行故事。", x: -4.9, z: -6.2, color: 0xf472b6, h: 1.8, w: 2.6 },
  { id: "nankunshan", type: "mountain", emoji: "🎋", name: "南昆山", short: "南昆山", desc: "北回归线上的绿洲，竹海和瀑布。惠州人的避暑后花园，登山吸氧回满心情。", funName: "南昆山竹海徒步", funCost: 20, funMood: 27, funDesc: "钻进竹海听瀑布，城市的声音一点都传不进来", x: -28.6, z: -20.8, color: 0x059669, h: 2, w: 2.8 },
  { id: "xiangtoushan", type: "mountain", emoji: "🐘", name: "象头山", short: "象头山", desc: "博罗的国家级自然保护区，溪流和原始次生林。徒步、观鸟、看瀑布。", funName: "象头山溪谷徒步", funCost: 0, funMood: 24, funDesc: "沿着溪谷往上走，水声一路陪着你", x: -4.2, z: -19.9, color: 0x16a34a, h: 1.8, w: 2.8 },
  { id: "gaobangshan", type: "scenic", emoji: "🗼", name: "高榜山 · 挂榜阁", short: "高榜山", desc: "惠州人的城市后山，登挂榜阁俯瞰西湖和东江。晨练夜跑的人从不断。", funName: "登高榜山看西湖全景", funCost: 0, funMood: 20, funDesc: "爬到挂榜阁，西湖和老城都在脚下", x: -8.7, z: -8.8, color: 0x65a30d, h: 1.5, w: 2.6 },
  { id: "pingtan-airport", type: "transit", emoji: "✈️", name: "惠州平潭机场", short: "平潭机场", desc: "惠州的空中门户，航线通国内主要城市。机场接送、摆渡单不少，也能坐飞机出门玩。", gigName: "机场接送 / 摆渡", x: 6.6, z: -6.8, color: 0x38bdf8, h: 1.6, w: 3 },
  { id: "haiguiwan", type: "scenic", emoji: "🐢", name: "海龟湾自然保护区", short: "海龟湾", desc: "惠东港口的国家级海龟自然保护区，中国大陆唯一的海龟产卵场。海龟馆、观海栈道，夏天有机会看海龟上岸。", funName: "海龟湾看海龟", funCost: 30, funMood: 25, funDesc: "走海边栈道吹风，运气好能碰上海龟回游", x: 22.2, z: 20.3, color: 0x0d9488, h: 0.8, w: 2.8 },
  { id: "sanjiaozhou", type: "scenic", emoji: "🏝️", name: "三角洲岛", short: "三角洲岛", desc: "巽寮湾海中央的私人小岛，坐快艇上岛。海水清得见底，浮潜、沙滩、礁石，惠州版的「小马尔代夫」。", funName: "坐快艇上三角洲岛", funCost: 80, funMood: 28, funDesc: "快艇劈开浪花上岛，浮潜看清澈见底的海", x: 14.1, z: 16.1, color: 0x0891b2, h: 0.7, w: 2.6 },
  { id: "hzmuseum", type: "learn", emoji: "🏛️", name: "惠州博物馆", short: "惠州博物馆", desc: "江北市民乐园旁的新馆，东江流域的历史和客家文化都从这儿讲。免费开放，旁边就是市图书馆新馆群。", funName: "看东江历史展", funCost: 0, funMood: 17, funDesc: "从东江纵队的故事看到惠州两千年", x: -1.7, z: -12, color: 0x92400e, h: 2.1, w: 2.6 },
  { id: "xiayong", type: "market", emoji: "🦞", name: "霞涌海鲜街", short: "霞涌海鲜街", desc: "大亚湾霞涌的老海鲜街，现捞现称现加工。旅游旺季整条街都是人，帮工、摆摊、代客加工的活儿不断。", gigName: "海鲜街帮工 / 摆摊", x: 8.3, z: 9, color: 0xf59e0b, h: 1.3, w: 2.6 },
  { id: "dongjiangpark", type: "fun", emoji: "🌳", name: "东江公园", short: "东江公园", desc: "东江北岸的滨江公园，绿道沿着江走。晨练、放风筝、江边钓鱼，惠城人晚饭后的散步主场。", funName: "东江边散步放风筝", funCost: 0, funMood: 19, funDesc: "沿着江边绿道走，晚风把一天的闷热吹散", x: -2.2, z: -9.6, color: 0x10b981, h: 0.7, w: 2.6 },
  { id: "hzbotanic", type: "scenic", emoji: "🌿", name: "惠州植物园", short: "惠州植物园", desc: "惠城丰山脚下的植物园，温室、沙地植物区和山顶的丰山公园连成一片。本地人周末遛娃吸氧的地方。", funName: "植物园温室看花", funCost: 10, funMood: 21, funDesc: "钻进温室看热带植物，再爬上丰山看老城", x: -6.7, z: -10.1, color: 0x65a30d, h: 1, w: 2.6 },
  { id: "tanyue", type: "fun", emoji: "🏨", name: "檀悦豪生度假酒店", short: "檀悦豪生", desc: "巽寮湾海边的大型度假酒店，海景房和户外泳池是招牌。住不起也能来泳池和沙滩泡一天，周末和节假日深圳来的客人最多。", funName: "海景度假一天：泳池 + 沙滩", funCost: 380, funMood: 32, funDesc: "上午泡泳池，下午沙滩晒太阳，傍晚在海景餐厅看日落", x: 13.6, z: 11.6, color: 0x0ea5e9, h: 2.6, w: 2.5 },
  { id: "co-tcl", type: "work", emoji: "📺", name: "TCL科技园", short: "TCL", desc: "仲恺高新区的TCL总部和液晶产业园：总部大楼、成排的厂房和员工宿舍，上下班高峰园区门口全是电动车。", x: -8.4, z: -3.9, color: 0xdc2626, h: 4.1, w: 2.3 },
  { id: "co-desay", type: "work", emoji: "🚗", name: "德赛西威研发中心", short: "德赛", desc: "仲恺的德赛西威：蓝玻璃研发楼，楼下一条测试车道，智能座舱样车天天在跑。", x: -7.4, z: -5.7, color: 0x2563eb, h: 3.3, w: 2 },
  { id: "co-eve", type: "work", emoji: "🔋", name: "亿纬锂能产业园", short: "亿纬", desc: "仲恺潼湖的锂电池产业园，锯齿屋顶的厂房一排排，三班倒，宿舍和食堂都在园区里。", x: -12.5, z: -7.3, color: 0x16a34a, h: 2, w: 2.3 },
  { id: "co-petro", type: "work", emoji: "🛢️", name: "中海油大亚湾石化区", short: "中海油", desc: "大亚湾石化区：炼化塔、球罐和码头，夜里灯火通明像一座钢铁城。待遇好、规矩严。", x: 6.1, z: 10.1, color: 0x64748b, h: 3.3, w: 2.6 },
];

/* ---- 香港：按真实地理铺——北面是新界（元朗/屯门/沙田/西贡），中间九龙
   （深水埗/旺角/尖沙咀隔着维多利亚港），南面港岛（中环/铜锣湾/赤柱），
   西南大屿山（机场/东涌/迪士尼/昂坪/大澳）。钱按港币（HK$）标价。 ---- */
const HK_LOCS: Loc[] = [
  { id: "home", type: "home", emoji: "🏠", name: "深水埗唐楼", short: "唐楼", desc: "深水埗的旧唐楼劏房，楼下就是鸭寮街和布市场。地方细，但落楼下什么都有——这就是你喺香港的窝。", x: 9.6, z: 5.6, color: 0xff6b4a, h: 2.6, w: 2.3 },
  { id: "westkowloon", type: "transit", emoji: "🚄", name: "香港西九龙站", short: "西九龙站", desc: "广深港高铁的香港总站，落车过一地两检就入城。去深圳北最快 14 分钟，过关回内地的大门。", gigName: "车站接送 / 行李帮忙", x: 8.7, z: 9.6, color: 0x7c3aed, h: 1.8, w: 3.1 },
  { id: "luohu-hk", type: "port", emoji: "🛃", name: "罗湖站 · 边境", short: "罗湖口岸", desc: "东铁线尽头，香港最老牌的陆路口岸。过桥就是罗湖——出示证件、过安检、行李过机，返深圳的人龙日日都长。", gigName: "口岸向导 / 行李帮忙", x: 5, z: -16.6, color: 0x22d3ee, h: 1.5, w: 2.8 },
  { id: "lokmachau", type: "port", emoji: "🛃", name: "落马洲管制站", short: "落马洲管制站", desc: "对面就是深圳皇岗口岸：跨境巴士（皇巴）和跨境车 24 小时过关，深夜回深圳只能走这里。", gigName: "口岸向导 / 跨境跑腿", x: 1.9, z: -14, color: 0x22d3ee, h: 1.5, w: 2.8 },
  { id: "lokmachau-spur", type: "port", emoji: "🛃", name: "落马洲支线站", short: "落马洲支线", desc: "东铁线落马洲支线的尽头，过一条连廊就是深圳福田口岸、福田口岸地铁站。", gigName: "口岸向导 / 行李帮忙", x: -0.6, z: -14.8, color: 0x22d3ee, h: 1.5, w: 2.8 },
  { id: "szbay-hk", type: "port", emoji: "🛃", name: "深圳湾口岸 · 港方口岸区", short: "深圳湾港方", desc: "一地两检：港方查验大楼其实建在深圳湾那一头，过关后坐 B2/B3 巴士走深圳湾公路大桥，从这里上岸进元朗、天水围。", gigName: "口岸巴士带路 / 跑腿", x: -7.9, z: -11.4, color: 0x22d3ee, h: 1.5, w: 2.8 },
  { id: "heungyuenwai", type: "port", emoji: "🛃", name: "香园围口岸", short: "香园围口岸", desc: "最新的陆路口岸，对着深圳莲塘：人车直达，去深圳东部、罗湖北最快。", gigName: "口岸向导 / 跨境跑腿", x: 10.8, z: -20.3, color: 0x38bdf8, h: 1.5, w: 2.8 },
  { id: "mankamto", type: "port", emoji: "🚛", name: "文锦渡管制站", short: "文锦渡", desc: "对面是深圳文锦渡口岸：货运管制站，只有跨境货车过关，旅客走罗湖。", gigName: "货柜车调度 / 跑腿", x: 7.4, z: -17.5, color: 0x94a3b8, h: 1.5, w: 2.6 },
  { id: "shatauokcp", type: "port", emoji: "🛃", name: "沙头角管制站", short: "沙头角管制站", desc: "对面是深圳沙头角口岸：深圳那边的旅检楼在重建，现在只走车。沙头角禁区要禁区纸才能进。", gigName: "口岸跑腿", x: 17.4, z: -19.5, color: 0x94a3b8, h: 1.5, w: 2.6 },
  { id: "hzmb-hk", type: "port", emoji: "🌉", name: "港珠澳大桥香港口岸", short: "港珠澳口岸", desc: "机场旁边的人工岛：金巴 24 小时开，过 55 公里的大桥去珠海、澳门。跨境车、穿梭巴士和旅客都在这里过关。", gigName: "口岸向导 / 跨境跑腿", x: -14.8, z: 9.1, color: 0x22d3ee, h: 1.5, w: 2.8 },
  { id: "macauferry", type: "port", emoji: "⛴️", name: "港澳客轮码头 · 信德中心", short: "港澳码头", desc: "上环海边的老码头：船去澳门、蛇口、深圳机场，码头里出入境。", gigName: "码头行李帮忙 / 跑腿", x: 6.5, z: 12.9, color: 0x0ea5e9, h: 1.5, w: 2.6 },
  { id: "chinaferry", type: "port", emoji: "⛴️", name: "中国客运码头 · 中港城", short: "中港城码头", desc: "尖沙咀广东道的码头：船去蛇口、澳门和珠江口各地，码头里出入境。", gigName: "码头行李帮忙 / 跑腿", x: 11.2, z: 9.1, color: 0x0ea5e9, h: 1.5, w: 2.6 },
  { id: "kaitak", type: "port", emoji: "🛳️", name: "启德邮轮码头", short: "启德码头", desc: "旧启德机场跑道尽头的邮轮码头：大邮轮靠岸的日子，码头里出入境、人山人海；平日是看海和日落的好地方。", gigName: "邮轮客接送 / 跑腿", x: 19.5, z: 10.9, color: 0x0ea5e9, h: 1.5, w: 2.8 },
  { id: "central", type: "work", emoji: "🏙️", name: "中环金融区", short: "中环", desc: "中银大厦、汇丰总行、遮打花园——香港的心脏。返工的人西装骨骨，lunch 只有一个钟，行路快过跑步。", x: 10.5, z: 15.4, color: 0x3b82f6, h: 5.7, w: 2.8 },
  { id: "kwuntong", type: "work", emoji: "🏭", name: "观塘工厦区", short: "观塘", desc: "旧工厦变身文创和初创的地盘，租金比中环平一大截。后巷有惊喜食堂，打工仔的秘密基地。", x: 18.2, z: 8.8, color: 0x64748b, h: 3.4, w: 2.6 },
  { id: "sheungwan", type: "food", emoji: "🫖", name: "上环 · 茶餐厅食街", short: "上环食街", desc: "海味街隔篱的老区，茶餐厅、云吞面、点心酒楼挤满几条街。莲香楼的旧式点心车，全港买少见少。", x: 6.9, z: 14.6, color: 0xf59e0b, h: 2.1, w: 2.6 },
  { id: "yumatei", type: "food", emoji: "🏮", name: "油麻地 · 庙街夜市", short: "庙街", desc: "庙街的煲仔饭和炒蟹香飘几条街，排档、占卜、唱粤曲的摊档连成一片——香港最地道的夜。", x: 13.5, z: 8.3, color: 0xf97316, h: 1.5, w: 2.6 },
  { id: "mongkok", type: "market", emoji: "🛍️", name: "旺角 · 女人街", short: "旺角", desc: "全世界人口密度最高的地方之一：女人街、金鱼街、花墟、波鞋街。霓虹招牌密到遮天，人潮永远不散。", x: 11.7, z: 6.6, color: 0xe879f9, h: 2.8, w: 2.6 },
  { id: "chunyeung", type: "market", emoji: "🥬", name: "北角 · 春秧街街市", short: "春秧街街市", desc: "电车直接驶进街市中间——全港独一无二的画面。两边是湿货干货摊档，叮叮车慢慢碌过，人人让路。", x: 17.9, z: 12.9, color: 0x06b6d4, h: 1.8, w: 2.6 },
  { id: "causewaybay", type: "mall", emoji: "🛍️", name: "铜锣湾", short: "铜锣湾", desc: "时代广场、崇光百货、避风塘——全球店租最贵的购物区之一，行人永远塞满轩尼诗道。", x: 16.2, z: 18.3, color: 0xec4899, h: 3.6, w: 2.8 },
  { id: "shatin", type: "mall", emoji: "🏬", name: "沙田新城市广场", short: "沙田", desc: "新界东的巨型商场连住沙田站，楼下是巴士总站。沙田人返工去中环，买嘢就喺屋企楼下解决。", x: 13.3, z: 0.5, color: 0xd946ef, h: 3, w: 2.8 },
  { id: "bank-hk", type: "bank", emoji: "🏦", name: "汇丰银行总行", short: "汇丰总行", desc: "中环皇后大道中 1 号，门口一对铜狮子史提芬和施迪。香港人发钞、储钱、供楼，都绕不开这座大厦。", x: 12.7, z: 16.3, color: 0xf59e0b, h: 4.6, w: 2.5 },
  { id: "hospital-hk", type: "health", emoji: "🏥", name: "玛丽医院", short: "玛丽医院", desc: "薄扶林的公立大医院，港大医学院的教学医院。急症室永远排长龙——身体系自己的，要锡住用。", x: 7.8, z: 16.1, color: 0xf43f5e, h: 3.3, w: 2.6 },
  { id: "library-hk", type: "learn", emoji: "📚", name: "香港中央图书馆", short: "中央图书馆", desc: "铜锣湾摩顿台的十二层大馆，藏书过百万。自修室一位难求，考牌、进修、学英文的人都喺度搏杀。", x: 18.1, z: 16.7, color: 0x7c3aed, h: 2.8, w: 2.6 },
  { id: "vicpark", type: "gym", emoji: "🌳", name: "维多利亚公园", short: "维园", desc: "铜锣湾闹市中的大草坪：晨运、跑步、踢波，维园阿伯的太极和年轻人的夜跑同场。城市再挤，这里都透到气。", funName: "维园晨跑一圈", funCost: 0, funMood: 18, funDesc: "绕住草坪跑一圈，铜锣湾的霓虹在树影后面闪", x: 16.6, z: 14.8, color: 0x84cc16, h: 0.8, w: 2.6 },
  { id: "tst", type: "scenic", emoji: "🌃", name: "尖沙咀海滨 · 维多利亚港", short: "尖沙咀海滨", desc: "星光大道、钟楼、文化中心沿住海滨排开，对岸中环的灯一栋一栋亮起来。每晚八点，幻彩咏香江。", funName: "坐天星小轮过海", funCost: 5, funMood: 24, funDesc: "HK$5 有找，坐百年渡轮横过维港——全世界最抵的观光船", x: 11.8, z: 11.6, color: 0x0ea5e9, h: 1, w: 3 },
  { id: "peak", type: "scenic", emoji: "🚠", name: "太平山顶", short: "山顶", desc: "海拔 552 米，香港的制高点。坐第六代山顶缆车斜斜上山，凌霄阁上望落去，维港和两岸高楼尽在脚下。", funName: "坐山顶缆车上山看夜景", funCost: 88, funMood: 28, funDesc: "缆车几乎垂直爬升，城市在身后一格一格升起；到顶正好赶上日落", x: 10.9, z: 17.5, color: 0x059669, h: 2.3, w: 2.8 },
  { id: "tramroad", type: "fun", emoji: "🚃", name: "湾仔电车路", short: "电车路", desc: "1904 年通车至今的双层电车，全程 HK$3，慢悠悠碌过整个港岛北岸。坐上层最前排，就是移动的观景台。", funName: "坐叮叮电车慢游港岛", funCost: 3, funMood: 18, funDesc: "HK$3 由西环碌到北角，城市以步行的速度在窗边过", x: 14.9, z: 16.3, color: 0x14b8a6, h: 1.3, w: 2.5 },
  { id: "disney", type: "fun", emoji: "🏰", name: "香港迪士尼乐园", short: "迪士尼", desc: "大屿山竹篙湾的童话王国，奇妙梦想城堡 2020 年登场。全球最细的迪士尼，但烟花和巡游一样不少。", funName: "迪士尼玩一整天", funCost: 639, funMood: 32, funDesc: "门票 HK$639 起——入城堡、睇巡游、等夜晚的烟花，心情直接满格", x: -3, z: 9.7, color: 0xe879f9, h: 2.6, w: 3 },
  { id: "ngongping", type: "scenic", emoji: "🙏", name: "昂坪 · 天坛大佛", short: "昂坪大佛", desc: "坐昂坪 360 缆车跨山跨海 25 分钟，山上是 34 米高的天坛大佛和百年宝莲禅寺。爬 268 级石阶上去，风都静了。", funName: "缆车上昂坪拜大佛", funCost: 235, funMood: 26, funDesc: "水晶车厢脚下是海和山路，大佛在云雾里一点点变大", x: -18.8, z: 17, color: 0xb45309, h: 2, w: 2.8 },
  { id: "taio", type: "scenic", emoji: "🎣", name: "大澳渔村", short: "大澳", desc: "大屿山西端的水上棚屋渔村，咸鱼、虾酱、茶果的味道飘满涌道。坐小艇出涌口，运气好会见到中华白海豚。", funName: "大澳坐艇找白海豚", funCost: 50, funMood: 25, funDesc: "棚屋在水上排成一排，小艇在涌道里慢慢穿", x: -23.3, z: 17.5, color: 0x0d9488, h: 0.8, w: 2.6 },
  { id: "tungchung", type: "transit", emoji: "🚡", name: "东涌", short: "东涌", desc: "机场旁的新市镇，东荟城 outlet 和昂坪缆车站都在这里。机场打工仔的宿舍区，物价比市区平一截。", gigName: "缆车站 / 商场帮工", x: -14, z: 13.5, color: 0x38bdf8, h: 2, w: 2.6 },
  { id: "airport-hk", type: "transit", emoji: "✈️", name: "香港国际机场", short: "机场", desc: "赤鱲角的人工岛机场，全球最繁忙的货运机场。地勤、行李、免税店——24 小时都缺人，也最锻炼人。", gigName: "机场地勤 / 行李帮忙", x: -17.7, z: 10, color: 0x38bdf8, h: 1.8, w: 3.3 },
  { id: "oceanpark", type: "fun", emoji: "🐼", name: "海洋公园", short: "海洋公园", desc: "1977 年开园的香港人集体回忆：大熊猫、缆车、山上山下两个世界。坐园内缆车望住南中国海，几代人都在这里长大。", funName: "海洋公园坐缆车看海", funCost: 498, funMood: 28, funDesc: "门票 HK$498——缆车悬在海面上，熊猫在山下打盹", x: 11.9, z: 19.3, color: 0x22c55e, h: 2.1, w: 2.8 },
  { id: "stanley", type: "fun", emoji: "⛱️", name: "赤柱", short: "赤柱", desc: "港岛南岸的慢活小镇：赤柱市集、卜公码头、美利楼，还有一排海边酒吧。外国人最爱来这里过周末。", funName: "赤柱市集逛海边", funCost: 60, funMood: 25, funDesc: "沿海滨长廊慢慢行，海风把市区的节奏吹散", x: 16.4, z: 20.9, color: 0xf97316, h: 1, w: 2.8 },
  { id: "saikung", type: "scenic", emoji: "🦞", name: "西贡海鲜街", short: "西贡", desc: "「香港的后花园」：海滨长廊一排海鲜酒家，鱼缸里游的就是你的晚餐。出海去桥咀岛、半月湾，船程只要十几分钟。", funName: "西贡食海鲜坐船出海", funCost: 200, funMood: 27, funDesc: "在码头边拣活海鲜称好，酒家即刻加工，再坐街渡去半月湾游水", x: 23.4, z: 0.9, color: 0x0891b2, h: 1, w: 2.8 },
  { id: "wongtaisin", type: "scenic", emoji: "🏮", name: "黄大仙祠", short: "黄大仙祠", desc: "「有求必应」的黄大仙祠，1915 年从广州迁来。年初一抢头炷香的人龙排到地铁站，啬色园的求签解签最出名。", funName: "黄大仙祠求签祈福", funCost: 0, funMood: 20, funDesc: "上一炷香，摇一支签——灵不灵，心诚则灵", x: 15.2, z: 5.2, color: 0xdc2626, h: 1.6, w: 2.6 },
  { id: "tseungkwano", type: "fun", emoji: "🌉", name: "将军澳 · 海滨新市镇", short: "将军澳", desc: "跨湾大桥 2022 年通车后，将军澳变成海滨单车天堂。将军澳南海滨长廊连到调景岭，新楼、海景、后生仔。", funName: "跨湾大桥踩单车", funCost: 30, funMood: 22, funDesc: "沿海滨长廊踩到跨湾大桥底，海风追着车尾跑", x: 22.2, z: 10.4, color: 0x10b981, h: 1.3, w: 2.8 },
  { id: "yuenlong", type: "market", emoji: "🥮", name: "元朗 · 大马路", short: "元朗", desc: "新界西的老城：老婆饼、肠粉、屏山文物径。元朗人自成一国，轻铁在马路上慢慢行，节奏比市区慢半拍。", gigName: "老店帮工 / 饼铺兼职", x: -5.2, z: -6.6, color: 0xf59e0b, h: 1.6, w: 2.6 },
  { id: "tuenmun", type: "fun", emoji: "🏖️", name: "屯门 · 黄金海岸", short: "屯门", desc: "屯门码头和黄金海岸的海豚广场，是屯门人的后花园。轻铁总站就在旁边，去市区的巴士一坐就系一粒钟。", funName: "黄金海岸踏浪看日落", funCost: 15, funMood: 23, funDesc: "踩住幼沙行到海豚广场，日落把海面染成金色", x: -9, z: 1.9, color: 0x06b6d4, h: 0.8, w: 2.8 },
  { id: "lankwaifong", type: "social", emoji: "🍸", name: "兰桂坊", short: "兰桂坊", desc: "中环旁边的一条斜路酒吧街，万圣节和跨年挤到水泄不通。白领放工的第一站，认人、倾偈、扩圈子的地方。", x: 9, z: 17, color: 0xa855f7, h: 2, w: 2.3 },
  { id: "hotel-hk", type: "lodging", emoji: "🏨", name: "尖沙咀酒店 · 宾馆", short: "酒店宾馆", desc: "一边是半岛酒店的下午茶，一边是重庆大厦里的宾馆——同一条弥敦道，两种香港。住一晚，或者看看长租的门路。", x: 14.1, z: 10.7, color: 0xf472b6, h: 3.6, w: 2.6 },
  { id: "co-hkex", type: "work", emoji: "📈", name: "港交所 · 交易广场", short: "交易广场", desc: "中环海旁的交易广场，招股季门口挤满记者和保荐人。玻璃幕墙后面，一日成交几千亿。", x: 8.8, z: 14.3, color: 0x7dd3fc, h: 4.9, w: 2 },
  { id: "co-cathay", type: "work", emoji: "✈️", name: "国泰航空 · 航空城", short: "航空城", desc: "赤鱲角机场旁的航空公司总部，机组、地勤、工程师都喺呢度返工，饭堂对住停机坪。", x: -15.5, z: 11.6, color: 0x0f766e, h: 2.1, w: 2.6 },
  { id: "co-swire", type: "work", emoji: "🏢", name: "太古地产 · 鲗鱼涌写字楼", short: "鲗鱼涌", desc: "鲗鱼涌的写字楼群，连住太古城中心和溜冰场，港岛东打工仔的大本营。", x: 19, z: 14.7, color: 0x94a3b8, h: 4.5, w: 2.1 },
  { id: "co-hkstp", type: "work", emoji: "🧪", name: "香港科学园 · 白石角", short: "科创园", desc: "吐露港海边的科创园区，圆顶会议中心和一栋栋实验楼，初创公司的梦想孵化场。", x: 16.4, z: -4.1, color: 0x34d399, h: 2.5, w: 2.6 },
  { id: "co-mtr", type: "work", emoji: "🚇", name: "港铁公司 · 九龙湾总部", short: "九龙湾", desc: "九龙湾车厂上盖的总部大楼，全港列车的调度中心。凌晨收车后，维修班先开工。", x: 17.4, z: 6.8, color: 0xdc2626, h: 3.7, w: 2.1 },
];

export function getLocations(cityKey: CityKey): Loc[] {
  return cityKey === "sz" ? SZ_LOCS : cityKey === "hk" ? HK_LOCS : HZ_LOCS;
}
/** A metro station with no game location of its own is still a place the
    player can stand: its id is "st:<站名>". These are resolved on demand
    and never added to getLocations(), so place lists stay short. */
export const STATION_PREFIX = "st:";
export const stationLocId = (name: string) => `${STATION_PREFIX}${name}`;
export const isStationLoc = (id: string) => id.startsWith(STATION_PREFIX);

/* ---- 城市地点 (OSM): parks, malls, hospitals, museums, beaches … ----
   Real places from OpenStreetMap (places-sz.ts), id "pl:<osm id>". Like
   stations they resolve on demand and stay out of getLocations(); each
   kind maps to an existing place type so it gets that type's actions. */
export const PLACE_PREFIX = "pl:";
/* Towns and villages (OSM place names on the map) are destinations too: "ar:<city>:<name>".
   No building of their own — you can get there by taxi, car, bike, e-bike, bus or on foot. */
export const AREA_PREFIX = "ar:";
export const isAreaLoc = (id: string) => id.startsWith(AREA_PREFIX);
export const areaLocId = (c: string, n: string) => `${AREA_PREFIX}${c}:${n}`;
const areaOf = (id: string) => { const [c, ...rest] = id.slice(AREA_PREFIX.length).split(":"); const n = rest.join(":"); return AREA_LABELS.find((a) => a.c === c && a.n === n); };
export const isPlaceLoc = (id: string) => id.startsWith(PLACE_PREFIX);
export interface PlaceKindMeta { label: string; emoji: string; type: LocType; color: number; funName?: string; funCost?: number; funMood?: number; funDesc?: string; }
export const PLACE_KINDS: Record<PlaceKind, PlaceKindMeta> = {
  park: { label: "公园", emoji: "🌳", type: "scenic", color: 0x22c55e, funName: "逛公园", funCost: 0, funMood: 14, funDesc: "深圳的公园免费开放：绿道、湖边、草坪，走一圈整个人松下来" },
  nature: { label: "湿地 / 保护区", emoji: "🦢", type: "scenic", color: 0x15803d, funName: "看红树林和候鸟", funCost: 0, funMood: 18, funDesc: "带上望远镜，冬天能看到成群的候鸟" },
  beach: { label: "海滩", emoji: "🏖️", type: "scenic", color: 0x38bdf8, funName: "去海边玩水", funCost: 30, funMood: 24, funDesc: "踩沙、吹海风、看日落，周末人多要早点去" },
  peak: { label: "山峰", emoji: "⛰️", type: "mountain", color: 0x4d7c0f, funName: "登顶看全城", funCost: 0, funMood: 22, funDesc: "沿登山道一路往上，山顶能看到海和城市" },
  mall: { label: "商场", emoji: "🛍️", type: "mall", color: 0xf472b6 },
  hospital: { label: "医院", emoji: "🏥", type: "health", color: 0xef4444 },
  university: { label: "大学", emoji: "🎓", type: "learn", color: 0x6366f1 },
  library: { label: "图书馆", emoji: "📚", type: "learn", color: 0x8b5cf6 },
  museum: { label: "博物馆 / 美术馆", emoji: "🏛️", type: "fun", color: 0xd97706, funName: "看一场展览", funCost: 0, funMood: 14, funDesc: "深圳大部分公立博物馆、美术馆免费，提前在公众号预约" },
  theatre: { label: "剧院 / 音乐厅", emoji: "🎭", type: "fun", color: 0xbe185d, funName: "看一场演出", funCost: 180, funMood: 26, funDesc: "话剧、音乐会、儿童剧，周末场次多，学生票更便宜" },
  stadium: { label: "体育场馆", emoji: "🏟️", type: "gym", color: 0x0ea5e9 },
  themepark: { label: "主题乐园", emoji: "🎢", type: "fun", color: 0xe879f9, funName: "玩一整天", funCost: 150, funMood: 30, funDesc: "排队、尖叫、拍照，玩到闭园" },
  attraction: { label: "景点", emoji: "📍", type: "scenic", color: 0xf59e0b, funName: "慢慢逛一圈", funCost: 0, funMood: 16, funDesc: "边走边看，顺手查查这里的故事" },
  historic: { label: "古迹 / 纪念地", emoji: "🏯", type: "scenic", color: 0x92400e, funName: "看看历史遗迹", funCost: 0, funMood: 12, funDesc: "读一读碑文和介绍，深圳不只有四十年" },
  police: { label: "派出所 / 警务", emoji: "🚓", type: "service", color: 0x1d4ed8 },
  pharmacy: { label: "药店", emoji: "💊", type: "service", color: 0x0d9488 },
  info: { label: "游客 / 志愿服务中心", emoji: "ℹ️", type: "service", color: 0x0891b2 },
};
/** Real places whose signature experience deserves its own action (and life scene). */
const PLACE_FUN: Record<string, Partial<PlaceKindMeta>> = {
  "欢乐港湾": { funName: "坐「湾区之光」摩天轮", funCost: 100, funMood: 26, funDesc: "透明胶囊轿厢慢慢升到海湾上空，前海和伶仃洋尽收眼底" },
  "小梅沙海洋世界": { funName: "逛海洋世界 · 走海底隧道", funCost: 150, funMood: 28, funDesc: "鱼群、鳐鱼和鲨鱼从头顶游过，再去水母馆慢慢看" },
};
/** OSM places minus the ones the game already has as a hand-made location
    (same name, or one name containing the other, e.g. 深圳人才公园 / 人才公园). */
const placesDeduped: Partial<Record<CityKey, CityPlace[]>> = {};
export function placesForCity(cityKey: CityKey): CityPlace[] {
  const hit = placesDeduped[cityKey];
  if (hit) return hit;
  const locs = getLocations(cityKey);
  const clean = (n: string) => n.replace(/\s|·/g, "");
  const core = (n: string) => clean(n).replace(/^(深圳|惠州)(市)?/, "");
  const cores = new Set(locs.flatMap((l) => [core(l.name), core(l.short)]).filter((n) => n.length >= 3));
  const fulls = locs.map((l) => clean(l.name)).filter((n) => n.length >= 5);
  const out = (cityKey === "sz" ? SZ_PLACES : cityKey === "hk" ? HK_PLACES : HZ_PLACES).filter((p) => !cores.has(core(p.name)) && !fulls.some((f) => clean(p.name).includes(f)));
  placesDeduped[cityKey] = out;
  return out;
}
const placeById = new Map([...SZ_PLACES, ...HZ_PLACES, ...HK_PLACES].map((p) => [`${PLACE_PREFIX}${p.id}`, p]));
const placeCity = (id: string): CityKey => (id.startsWith(`${PLACE_PREFIX}hz`) ? "hz" : id.startsWith(`${PLACE_PREFIX}hk`) ? "hk" : "sz");
/** Real km of a rail / metro station, in the city's frame. */
export const stationRealKm = (cityKey: CityKey, name: string): [number, number] | undefined => (cityKey === "sz" ? SZ_REAL_KM : cityKey === "hk" ? HK_REAL_KM : HZ_REAL_KM)[name];
/** Where a location really is, in km (Shenzhen: same frame as SZ_REAL_KM;
    Huizhou: east/south of 惠州西湖). Real places carry their own
    coordinates; game locations use the station they are linked to (the
    hand-placed miniature is not to scale, so map distance would point to
    the wrong neighbourhood); anything else falls back to the nearest
    station on the map. Huizhou's game locations have their real spot. */
export function realKmOf(cityKey: CityKey, locId: string): [number, number] | null {
  if (isAreaLoc(locId)) { const a = areaOf(locId); return a && a.c === cityKey ? [a.kx, a.ky] : null; }
  if (isPlaceLoc(locId)) { const p = placeById.get(locId); return p && placeCity(locId) === cityKey ? [p.kx, p.ky] : null; }
  if (isStationLoc(locId)) return stationRealKm(cityKey, locId.slice(STATION_PREFIX.length)) ?? null;
  if (cityKey === "hz" && HZ_LOC_KM[locId]) return HZ_LOC_KM[locId]!;
  if (cityKey === "hk" && HK_LOC_KM[locId]) return HK_LOC_KM[locId]!;
  const lines = metroLinesForCity(cityKey);
  for (const l of lines) for (const st of l.stations) { const k = stationRealKm(cityKey, st.name); if (st.locId === locId && k) return k; }
  const loc = getLocations(cityKey).find((l) => l.id === locId);
  if (!loc) return null;
  let best: [number, number] | null = null; let bd = Infinity;
  for (const l of lines) for (const st of l.stations) {
    const k = stationRealKm(cityKey, st.name); if (!k) continue;
    const d = Math.hypot(st.x - loc.x, st.z - loc.z);
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}
type Near = { place: CityPlace; id: string; dist: number };
/** Real places around a location, by real distance in km. */
function placesAround(cityKey: CityKey, locId: string): Near[] {
  const at = realKmOf(cityKey, locId);
  if (!at) return [];
  return placesForCity(cityKey)
    .map((p) => ({ place: p, id: `${PLACE_PREFIX}${p.id}`, dist: Math.hypot(p.kx - at[0], p.ky - at[1]) }))
    .filter((r) => r.id !== locId)
    .sort((a, b) => a.dist - b.dist);
}
/** 附近服务：the nearest real hospital (24h emergency first), pharmacy,
    police station and visitor centre, by real distance — for anyone who
    needs help, Summit delegates and volunteers included. */
export function nearbyServices(cityKey: CityKey, locId: string): Near[] {
  const all = placesAround(cityKey, locId);
  const pick = (kind: PlaceKind, n: number, pref?: (p: CityPlace) => boolean) => {
    const of = all.filter((r) => r.place.kind === kind);
    const best = pref ? of.filter((r) => pref(r.place) && r.dist < 8).slice(0, 1) : [];
    return [...best, ...of.filter((r) => !best.includes(r))].slice(0, n);
  };
  // hospitals always show (however far); smaller services only when close
  return [...pick("hospital", 2, (p) => !!p.er), ...[...pick("pharmacy", 1), ...pick("police", 1), ...pick("info", 1)].filter((r) => r.dist <= 5)];
}
/** Places worth visiting around a location (not services), real km. */
export function nearbyPlaces(cityKey: CityKey, locId: string, n = 4, maxKm = 3): Near[] {
  return placesAround(cityKey, locId).filter((r) => r.dist <= maxKm && PLACE_KINDS[r.place.kind].type !== "service" && r.place.kind !== "hospital").slice(0, n);
}
const stationLocCache = new Map<string, Loc>();
export function resolveLoc(cityKey: CityKey, id: string): Loc | undefined {
  const real = getLocations(cityKey).find((l) => l.id === id);
  if (real) return real;
  if (isAreaLoc(id)) {
    const a = areaOf(id);
    if (!a || a.c !== cityKey) return undefined;
    const town = a.k === "big";
    return {
      id, type: "scenic", emoji: town ? "🏘️" : "🏡", name: a.n, short: a.n.length > 8 ? `${a.n.slice(0, 8)}…` : a.n,
      desc: `${town ? "镇 / 街道" : "村 / 社区"}${a.e ? ` · ${a.e}` : ""}。真实地名（OpenStreetMap）。打车、自驾、骑行、电动车、公交都能直达；没有轨道站的地方，坐${cityKey === "hz" ? "城轨" : cityKey === "hk" ? "港铁" : "地铁"}会在最近的站下车再走过去。`,
      x: a.x, z: a.z, color: town ? 0x8d6e63 : 0x6d8b4f, h: 0, w: 0,
      funName: town ? "逛老街 · 吃本地小吃" : "逛村子 · 吃农家菜", funCost: town ? 35 : 45, funMood: town ? 10 : 12,
      funDesc: town ? "镇上的老街、市场和小吃档，和市中心是两种节奏" : "祠堂、榕树、鱼塘，坐下来吃一顿农家菜，城里的焦虑一下就散了",
      en: a.e ?? undefined,
    };
  }
  if (isPlaceLoc(id)) {
    const p = placeById.get(id);
    if (!p || placeCity(id) !== cityKey) return undefined;
    const k = { ...PLACE_KINDS[p.kind], ...(PLACE_FUN[p.name] ?? {}) };
    const walkMin = Math.max(1, Math.round((p.stKm * 1.3) / 0.075));
    const how = p.stKm < 0.3 ? "出站就到" : p.stKm <= 3 ? `约 ${p.stKm.toFixed(1)} 公里，步行 ${walkMin} 分钟左右` : `约 ${p.stKm.toFixed(1)} 公里，打车或坐公交过去`;
    return {
      id, type: k.type, emoji: k.emoji, name: p.name, short: p.name.length > 8 ? `${p.name.slice(0, 8)}…` : p.name,
      desc: `${k.label}${p.en ? ` · ${p.en}` : ""}。最近的${cityKey === "sz" ? "地铁站" : cityKey === "hk" ? "港铁站" : "城轨 / 高铁站"}是「${p.st}」，${how}。`,
      x: p.x, z: p.z, color: k.color, h: 0, w: 0,
      funName: k.funName, funCost: k.funCost, funMood: k.funMood, funDesc: k.funDesc,
      placeKind: p.kind, en: p.en, tel: p.tel, addr: p.addr, hours: p.hours, er: p.er,
    };
  }
  if (!isStationLoc(id)) return undefined;
  const key = `${cityKey}|${id}`;
  const hit = stationLocCache.get(key);
  if (hit) return hit;
  const name = id.slice(STATION_PREFIX.length);
  const lines = metroLinesForCity(cityKey).filter((l) => l.stations.some((x) => x.name === name));
  const st = lines[0]?.stations.find((x) => x.name === name);
  if (!st || !lines[0]) return undefined;
  const loc: Loc = {
    id, type: "transit", emoji: "🚇", name: `${name}站`, short: name,
    desc: `地铁站：${lines.map((l) => l.short).join("、")}。出站就是街区，可以从这里步行、骑车、打车去别处，或者再进站坐车。`,
    x: st.x, z: st.z, color: lines[0].color, h: 0, w: 0,
  };
  stationLocCache.set(key, loc);
  return loc;
}

export const APPS = [
  { id: "career", e: "📈", n: "职业中心" },
  { id: "jobs", e: "🧧", n: "招聘广场" },
  { id: "food", e: "🍔", n: "点外卖" },
  { id: "taxi", e: "🚕", n: "打车" },
  { id: "bank", e: "🏦", n: "手机银行" },
  { id: "social", e: "💬", n: "街坊社交" },
  { id: "cal", e: "🗓️", n: "日历" },
  { id: "weather", e: "🌦️", n: "天气" },
  { id: "ledger", e: "🧾", n: "记账本" },
  { id: "map", e: "🗺️", n: "城市地图" },
  { id: "apec", e: "🌐", n: "峰会资讯" },
  { id: "home", e: "🏠", n: "我的家" },
  { id: "metro", e: "🚇", n: "地铁通" },
] as const;

export type AppId = (typeof APPS)[number]["id"];

export const OFFERS = [
  { name: "会展临时接待", mul: 1.5, note: "峰会周最缺人，手快有" },
  { name: "夜市地推兼职", mul: 1.2, note: "晚上出摊，氛围组" },
  { name: "高端代驾大单", mul: 1.4, note: "要驾照，更要好脾气" },
  { name: "商场周末促销", mul: 1.25, note: "站柜台，活儿稳" },
  { name: "同城闪送大单", mul: 1.35, note: "跑得快才接得到" },
];

export const WEEK = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
/* 游戏第 N 天 = 2026 年 11 月 N 日（峰会 14–19 日），星期按真实日历算 */
export const GAME_YEAR = 2026;
/* 当前赛季（北京时间的一个自然月）。App 载入存档时设置；星期、峰会活动都按它算。 */
let SEASON = { y: GAME_YEAR, m: 11 };
export function setSeason(startKey: string): void {
  const y = Number(startKey.slice(0, 4)), m = Number(startKey.slice(5, 7));
  if (y > 2000 && m >= 1 && m <= 12) SEASON = { y, m };
}
export const seasonOf = () => SEASON;
/** 湾区峰会周只在 2026 年 11 月赛季举行。 */
export const isApecSeason = () => SEASON.y === 2026 && SEASON.m === 11;
const realDow = (day: number) => (new Date(SEASON.y, SEASON.m - 1, day).getDay() + 6) % 7; // 0 = 周一
export function weekday(day: number): string {
  return WEEK[realDow(day)] ?? "周一";
}
export function isSaturday(day: number): boolean {
  return realDow(day) === 5;
}

/* ================= 交通方式 ================= */
export type TransportModeId = "walk" | "run" | "bike" | "moto" | "bus" | "metro" | "taxi" | "drive" | "rail" | "ferry" | "flight";
/** Speed tiers — deliberately far apart so the choice of mode is a real
    decision: mapSpeed is world-units/sec (drives BOTH the map figure's
    movement speed and the real trip timer, so what you see is how long
    it takes); etaPerUnit/etaFixed convert a trip into the game-time
    minutes shown in the nav panel and travel UI for side-by-side
    comparison （固定项 = 等车/进站安检/候机这类方式自带的开销）. */
export interface TransportMode { id: TransportModeId; emoji: string; name: string; desc: string; energyPerUnit: number; mapSpeed: number; etaPerUnit: number; etaFixed: number; speedTag: string; }
export const TRANSPORT_MODES: TransportMode[] = [
  { id: "walk", emoji: "🚶", name: "步行", desc: "免费，最慢，耗能量", energyPerUnit: 0.55, mapSpeed: 2.6, etaPerUnit: 3.4, etaFixed: 0, speedTag: "最慢" },
  { id: "run", emoji: "🏃", name: "跑步", desc: "免费，比步行快一半还多，最耗能量——赶时间又不想花钱时的选择，街上跑起来 NPC 都看你", energyPerUnit: 0.9, mapSpeed: 4.2, etaPerUnit: 2.1, etaFixed: 0, speedTag: "慢" },
  { id: "bike", emoji: "🚲", name: "骑行", desc: "¥3起，比步行快近一倍，全部地点可达——山顶、海滩、老街，再远也能骑到", energyPerUnit: 0.3, mapSpeed: 11, etaPerUnit: 1.7, etaFixed: 1, speedTag: "慢" },
  { id: "moto", emoji: "🛵", name: "摩托/电动车", desc: "短途最划算，明显快过骑行，远途耗电不划算", energyPerUnit: 0.18, mapSpeed: 15, etaPerUnit: 1.1, etaFixed: 1, speedTag: "中速" },
  { id: "bus", emoji: "🚌", name: "公交", desc: "¥2起，要等车、站站停，比电动车稳但快不了多少", energyPerUnit: 0.12, mapSpeed: 16.5, etaPerUnit: 1.0, etaFixed: 5, speedTag: "中速" },
  { id: "metro", emoji: "🚇", name: "地铁", desc: "按站收费，不堵车，进车厢真实乘车——中长途比地面交通快得多", energyPerUnit: 0.1, mapSpeed: 22, etaPerUnit: 0.62, etaFixed: 7, speedTag: "快" },
  { id: "taxi", emoji: "🚕", name: "打车", desc: "按距离计价，地面最快，点对点直达不用等站", energyPerUnit: 0.04, mapSpeed: 20, etaPerUnit: 0.72, etaFixed: 3, speedTag: "快" },
  { id: "drive", emoji: "🚗", name: "自驾", desc: "要驾照和车（租一天或自己买）：点对点直达，油费/电费比打车便宜；路上跟车流一起等红灯，高峰会堵，到了还要找车位、交停车费", energyPerUnit: 0.05, mapSpeed: 24, etaPerUnit: 0.6, etaFixed: 5, speedTag: "快" },
  { id: "rail", emoji: "🚄", name: "城际/高铁", desc: "全场最快：深惠跨城，深圳北↔惠州南，含进站安检时间", energyPerUnit: 0.06, mapSpeed: 34, etaPerUnit: 0.3, etaFixed: 12, speedTag: "最快" },
  { id: "ferry", emoji: "⛴️", name: "轮渡", desc: "蛇口邮轮港出发看海，船速不慢但要等班次", energyPerUnit: 0.08, mapSpeed: 15, etaPerUnit: 1.0, etaFixed: 15, speedTag: "中速" },
  { id: "flight", emoji: "✈️", name: "飞机", desc: "飞起来最快，但值机安检的固定开销最大，短途反而不划算", energyPerUnit: 0.05, mapSpeed: 30, etaPerUnit: 0.22, etaFixed: 50, speedTag: "最快" },
];
export function modeById(id: TransportModeId): TransportMode {
  return TRANSPORT_MODES.find((m) => m.id === id) ?? TRANSPORT_MODES[0]!;
}
/* Huizhou has no metro: the rail mode there IS the 莞惠城际. Same mechanics,
   honest name — modesForCity renames the metro entry for HZ so the word
   地铁 never appears as a Huizhou travel mode. */
export function modesForCity(cityKey: CityKey): TransportMode[] {
  return TRANSPORT_MODES.map((m) => {
    if (cityKey === "hz" && m.id === "metro")
      return { ...m, name: "城际", emoji: "🚆", desc: "莞惠城际，按站收费、不堵车，进车厢真实乘车——惠州没有地铁，市内轨道交通就靠城际" };
    if (cityKey === "hk") {
      /* Hong Kong names its own transport: 港铁 (never 地铁）, 巴士， 的士，
         渡轮， and the cross-border 高铁 from West Kowloon. The tram （电车）
         and Peak Tram are place experiences （湾仔电车路 / 太平山顶）, and
         天星小轮 rides live at 尖沙咀海滨. */
      if (m.id === "metro") return { ...m, name: "港铁", desc: "MTR 港铁：荃湾线、港岛线、观塘线、东铁线等 10 条线，按站收费、不塞车，进车厢真实乘车——香港只有港铁，没有地铁这个说法" };
      if (m.id === "bus") return { ...m, name: "巴士", desc: "双层巴士，HK$5 起；过海隧道巴士最方便，要等车、站站停" };
      if (m.id === "bike") return { ...m, desc: "HK$3 起，比步行快近一倍，全部地点可达——山顶、海滩、老街，再远也能骑到" };
      if (m.id === "taxi") return { ...m, name: "的士", desc: "红色的士（市区）按表收费，地面最快，点对点直达——过海要加隧道费，司机大佬最清楚哪条隧道不塞" };
      if (m.id === "ferry") return { ...m, name: "渡轮", desc: "天星小轮过维港、新渡轮去长洲大澳——船速不慢但要等班次，海风和维港景是附赠的" };
      if (m.id === "rail") return { ...m, name: "高铁", desc: "广深港高铁：西九龙站一地两检，14 分钟到福田、18 分钟到深圳北——过关回内地最快的方式" };
      if (m.id === "flight") return { ...m, name: "飞机", desc: "赤鱲角机场出发，飞起来最快，但值机安检的固定开销最大，短途反而不划算" };
    }
    return m;
  });
}
/** The everyday word for the city's urban rail: 地铁 in Shenzhen, 城轨 in Huizhou, 港铁 in Hong Kong. */
export function railWord(cityKey: CityKey): string {
  return cityKey === "hz" ? "城轨" : cityKey === "hk" ? "港铁" : "地铁";
}
/** Display currency of a city: Hong Kong prices EVERYTHING in HK$
    (balance, pay, rent, food, fares — the 香港 city card promises 港币标价）;
    Shenzhen and Huizhou price in ¥. Every amount the game renders goes
    through fmtMoney with the city the player is standing in. */
export function curSym(cityKey: CityKey): string {
  return cityKey === "hk" ? "HK$" : "¥";
}
export function fmtMoney(n: number, cityKey: CityKey): string {
  return `${curSym(cityKey)}${Math.round(n).toLocaleString()}`;
}
/** A cross-border HSR fare is named in the DEPARTURE city's currency:
    leaving West Kowloon it is priced in HK$, leaving Shenzhen or
    Huizhou in RMB — and the label says which, so a Hong Kong run never
    shows a bare ¥ cross-border fare. */
/* ---- 跨城路线：真实口岸、高铁、船、大巴和自驾 ----
   Every way between the three cities, each leaving from its own place and
   arriving at the matching one across the border. Hours are real (北京时间,
   minutes from midnight; a close past 24:00 runs into the next day; null =
   24 hours), fares in the departure city's currency, minutes door to door.
   fromLoc "*" = leave from wherever you are (driving). */
export type CrossMode = "walk" | "hsr" | "bus" | "ferry" | "car";
export interface CrossRoute {
  id: string; from: CityKey; to: CityKey; fromLoc: string; toLoc: string; mode: CrossMode;
  emoji: string; name: string; fare: number; min: number; hours: [number, number] | null; note: string; car?: boolean;
  /** set when the crossing exists but takes no passengers (why) */
  shut?: string;
}
const HM = (h: number, m = 0) => h * 60 + m;
type Leg = Omit<CrossRoute, "id" | "from" | "to" | "fromLoc" | "toLoc"> & { back?: Partial<Pick<CrossRoute, "fare" | "name" | "note">> };
const both = (id: string, a: CityKey, aLoc: string, b: CityKey, bLoc: string, leg: Leg): CrossRoute[] => {
  const { back, ...l } = leg;
  return [{ id: `${id}>`, from: a, to: b, fromLoc: aLoc, toLoc: bLoc, ...l }, { id: `${id}<`, from: b, to: a, fromLoc: bLoc, toLoc: aLoc, ...l, ...(back ?? {}) }];
};
export const CROSS_ROUTES: CrossRoute[] = [
  // 深圳 ⇄ 香港
  ...both("luohu", "sz", "luohu", "hk", "luohu-hk", { mode: "walk", emoji: "🚶", name: "罗湖口岸 · 步行过关 + 东铁线", fare: 0, min: 35, hours: [HM(6, 30), HM(24)], note: "过一座桥就是香港，出关直接上东铁线；最老牌、人最多" }),
  ...both("futian", "sz", "futianport", "hk", "lokmachau-spur", { mode: "walk", emoji: "🚶", name: "福田口岸 · 落马洲支线", fare: 0, min: 30, hours: [HM(6, 30), HM(22, 30)], note: "地铁 4/10 号线直达口岸，过关就是东铁线落马洲站" }),
  ...both("huanggang", "sz", "huanggangport", "hk", "lokmachau", { mode: "bus", emoji: "🚌", name: "皇岗口岸 · 跨境巴士（24 小时）", fare: 15, min: 40, hours: null, note: "皇巴通宵开，下车过关再上车；深夜唯一能过关的路" }),
  ...both("szbay", "sz", "szbayport", "hk", "szbay-hk", { mode: "bus", emoji: "🚌", name: "深圳湾口岸 · 过大桥到港方口岸区", fare: 12, min: 50, hours: [HM(6, 30), HM(24)], note: "一地两检，过深圳湾公路大桥就到元朗、天水围", back: { name: "港方口岸区 · 过大桥回深圳湾口岸", note: "从元朗坐 B2/B3 巴士过深圳湾公路大桥，深圳湾口岸里一地两检" } }),
  ...both("liantang", "sz", "liantangport", "hk", "heungyuenwai", { mode: "walk", emoji: "🚶", name: "莲塘口岸 · 香园围", fare: 0, min: 35, hours: [HM(7), HM(22)], note: "最新口岸，人车直达，去香港东北、粉岭上水最快" }),
  ...both("xrl", "sz", "north", "hk", "westkowloon", { mode: "hsr", emoji: "🚄", name: "广深港高铁 · 深圳北 ⇄ 西九龙", fare: 75, min: 25, hours: [HM(7), HM(22, 30)], note: "西九龙站一地两检，18 分钟到；最快最舒服" }),
  ...both("shekou", "sz", "port", "hk", "macauferry", { mode: "ferry", emoji: "⛴️", name: "蛇口邮轮母港 ⇄ 上环港澳码头", fare: 120, min: 60, hours: [HM(7, 45), HM(21, 30)], note: "坐船看着青马大桥进维港，码头里过关" }),
  ...both("shekou-tst", "sz", "port", "hk", "chinaferry", { mode: "ferry", emoji: "⛴️", name: "蛇口邮轮母港 ⇄ 尖沙咀中港城码头", fare: 120, min: 60, hours: [HM(8), HM(21)], note: "到尖沙咀上岸，走两步就是海港城、天星码头" }),
  ...both("shekou-air", "sz", "port", "hk", "airport-hk", { mode: "ferry", emoji: "⛴️", name: "蛇口 ⇄ 香港机场海天码头", fare: 220, min: 35, hours: [HM(8), HM(20, 30)], note: "转机专用：不用入境香港也能直接登机" }),
  // 深圳 ⇄ 惠州
  ...both("xiashen", "sz", "north", "hz", "hzsouth", { mode: "hsr", emoji: "🚄", name: "厦深高铁 · 深圳北 ⇄ 惠州南", fare: 40, min: 35, hours: [HM(6, 30), HM(23)], note: "最常坐的一条：半小时到惠州南，再坐城轨 / 打车进市区" }),
  ...both("ganshen", "sz", "north", "hz", "metro", { mode: "hsr", emoji: "🚄", name: "赣深高铁 · 深圳北 ⇄ 惠州北", fare: 50, min: 40, hours: [HM(7), HM(22)], note: "到惠州北站换城轨，离江北、惠城更近" }),
  ...both("danshui-bus", "sz", "universiade", "hz", "danshui", { mode: "bus", emoji: "🚌", name: "龙岗 ⇄ 淡水 · 城际公交", fare: 15, min: 60, hours: [HM(6), HM(22)], note: "深惠交界天天通勤的人都坐这个，便宜" }),
  ...both("coach", "sz", "luohu", "hz", "mall", { mode: "bus", emoji: "🚍", name: "罗湖汽车站 ⇄ 惠州汽车总站 · 长途大巴", fare: 45, min: 110, hours: [HM(7), HM(20, 30)], note: "高速一路直达市区，不用换乘" }),
  ...both("drive-szhz", "sz", "*", "hz", "xihu", { mode: "car", emoji: "🚗", name: "自驾 · 沈海 / 惠盐高速", fare: 75, min: 90, hours: null, car: true, note: "油费 + 过路费；随时出发，从哪儿都能走" }),
  ...both("wenjindu", "sz", "wenjinduport", "hk", "mankamto", { mode: "car", emoji: "🚛", name: "文锦渡口岸 · 只走货车", fare: 0, min: 30, hours: null, shut: "货运口岸，不对旅客开放", note: "深港之间的货运口岸，只有跨境货车过关；旅客走旁边的罗湖口岸" }),
  ...both("shatoujiao", "sz", "shatoujiaoport", "hk", "shatauokcp", { mode: "car", emoji: "🛃", name: "沙头角口岸 · 旅检楼重建中", fare: 0, min: 30, hours: null, shut: "旅检楼重建中，暂不对旅客开放", note: "中英街旁的老口岸，旅检大楼在重建，现在只走车；去香港东北走莲塘口岸" }),
  // 香港 ⇄ 惠州
  ...both("hk-hz-rail", "hk", "westkowloon", "hz", "hzsouth", { mode: "hsr", emoji: "🚄", name: "高铁 · 西九龙 ⇄ 惠州南（直达）", fare: 120, min: 75, hours: [HM(7, 30), HM(20)], note: "一地两检后直达惠州南，一天几班" }),
  ...both("hk-hz-bus", "hk", "mongkok", "hz", "mall", { mode: "bus", emoji: "🚍", name: "跨境大巴 · 旺角 ⇄ 惠州（经皇岗）", fare: 150, min: 180, hours: [HM(7), HM(19)], note: "港人回乡最常坐：上车不用换，过关下车走一趟" }),
];
export const crossRoutes = (from: CityKey, to: CityKey) => CROSS_ROUTES.filter((r) => r.from === from && r.to === to);
/** Is the route running at this Beijing minute of the day? */
export const isCrossOpen = (r: CrossRoute, min: number) => !r.shut && (!r.hours || (min >= r.hours[0] && min < r.hours[1]));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const crossHoursStr = (r: CrossRoute, en = false) => (r.shut ? (en ? CROSS_EN[r.id.slice(0, -1)]?.shut ?? "No passengers" : r.shut) : !r.hours ? (en ? "24 hours" : "24 小时") : `${hhmm(r.hours[0])}–${hhmm(r.hours[1])}`);
export const crossFareStr = (r: CrossRoute, en = false) => (r.shut ? (en ? "Closed to passengers" : "不对旅客开放") : r.fare === 0 ? (en ? "Free to cross" : "免费过关") : r.from === "hk" ? `HK$${r.fare}` : `¥${r.fare}`);
/** English for each route (both directions share one entry). */
export const CROSS_EN: Record<string, { name: string; note: string; shut?: string }> = {
  luohu: { name: "Luohu / Lo Wu · walk across + East Rail", note: "Cross one footbridge and you're in Hong Kong, straight onto the East Rail line. The oldest and busiest crossing." },
  futian: { name: "Futian Port · Lok Ma Chau Spur Line", note: "Metro lines 4 and 10 run to the port; across the border is Lok Ma Chau station on the East Rail." },
  huanggang: { name: "Huanggang · cross-border bus (24 hours)", note: "The Huangbus runs all night: get off, clear the border, get back on. The only way across late at night." },
  szbay: { name: "Shenzhen Bay Port · over the bridge", note: "Co-located checks, then the Shenzhen Bay Bridge into Yuen Long and Tin Shui Wai." },
  liantang: { name: "Liantang Port · Heung Yuen Wai", note: "The newest crossing, quickest to Hong Kong's north-east." },
  xrl: { name: "High-speed rail · Shenzhen North ⇄ West Kowloon", note: "Co-located checks at West Kowloon; 18 minutes. Fastest and comfiest." },
  shekou: { name: "Ferry · Shekou ⇄ Hong Kong–Macau Ferry Terminal", note: "Sail past the Tsing Ma Bridge into Victoria Harbour; border checks at the pier." },
  "shekou-tst": { name: "Ferry · Shekou ⇄ China Ferry Terminal (Tsim Sha Tsui)", note: "Land in Tsim Sha Tsui, steps from Harbour City and the Star Ferry." },
  "shekou-air": { name: "Ferry · Shekou ⇄ HK Airport SkyPier", note: "For flights: board at the airport without entering Hong Kong." },
  wenjindu: { name: "Wenjindu / Man Kam To · goods only", note: "A cargo crossing: only cross-border lorries. Passengers use Luohu next door.", shut: "Goods only — no passengers" },
  shatoujiao: { name: "Shatoujiao / Sha Tau Kok · hall being rebuilt", note: "The old crossing by Chung Ying Street; its passenger hall is being rebuilt, vehicles only for now. Use Liantang instead.", shut: "Passenger hall being rebuilt" },
  xiashen: { name: "Xiamen–Shenzhen HSR · Shenzhen North ⇄ Huizhou South", note: "The usual way: half an hour to Huizhou South, then intercity rail or a taxi into town." },
  ganshen: { name: "Ganzhou–Shenzhen HSR · Shenzhen North ⇄ Huizhou North", note: "Change to the intercity rail at Huizhou North, closer to Jiangbei and Huicheng." },
  "danshui-bus": { name: "Intercity bus · Longgang ⇄ Danshui", note: "What people who live on the border take every day. Cheap." },
  coach: { name: "Coach · Luohu ⇄ Huizhou Bus Terminal", note: "Straight down the expressway into town, no changes." },
  "drive-szhz": { name: "Drive · Shenhai / Huiyan expressways", note: "Fuel and tolls; leave any time, from anywhere." },
  "hk-hz-rail": { name: "HSR · West Kowloon ⇄ Huizhou South (direct)", note: "Co-located checks, then straight to Huizhou South; a few trains a day." },
  "hk-hz-bus": { name: "Cross-border coach · Mong Kok ⇄ Huizhou (via Huanggang)", note: "Hongkongers' favourite way home: no changes, one walk through the border." },
};
export const crossName = (r: CrossRoute, en = false) => (en ? CROSS_EN[r.id.slice(0, -1)]?.name ?? r.name : r.name);
export const crossNote = (r: CrossRoute, en = false) => (en ? CROSS_EN[r.id.slice(0, -1)]?.note ?? r.note : r.note);

export function crossFareLabel(from: CityKey, fare: number): string {
  if (from === "hk") return `HK$${fare}（西九龙出发 · 港币）`;
  return `¥${fare}（${CITIES[from].name}出发 · 人民币）`;
}
/** Game-time minutes a trip of `dist` map units takes by this mode —
    the single source for every 预计耗时 shown in the UI. */
export function etaMinutes(id: TransportModeId, dist: number): number {
  const m = modeById(id);
  return Math.max(1, Math.round(m.etaFixed + dist * m.etaPerUnit));
}
export function taxiFare(dist: number): number { return Math.round(11 + dist * 2.1); }
/** Driving your own car: fuel/electricity only — much cheaper than a taxi,
    but the destination's parking fee comes on top (see parkingFee). */
export function driveFare(dist: number): number { return Math.round(3 + dist * 0.7); }
/** What parking costs at the destination — the real friction of driving in
    the city: free at home, pricey at malls / offices / APEC venues. */
export function parkingFee(loc: Loc): number {
  switch (loc.type) {
    case "home": case "lodging": return 0;
    case "mall": case "apec": case "work": case "health": return 12;
    case "transit": case "port": return 10;
    case "scenic": case "fun": return 8;
    case "mountain": return 5;
    default: return 6;
  }
}
export function busFare(dist: number): number { return dist < 8 ? 2 : dist < 18 ? 3 : 4; }
export function bikeFare(dist: number): number { return Math.round(3 + dist * 0.25); }
export function motoFare(dist: number): number { return Math.round(6 + dist * 0.9); }

/* ================= 风景打卡 ================= */
export interface ScenicSpot { locId: string; cityKey: CityKey; name: string; tag: string; tip: string; }
export const SCENIC_SPOTS: ScenicSpot[] = [
  { locId: "xihu", cityKey: "hz", name: "惠州西湖", tag: "湖光", tip: "苏堤春晓打卡，泗洲塔倒影最出片" },
  { locId: "fun", cityKey: "hz", name: "双月湾", tag: "海湾", tip: "双湾同框，登观景台看日出日落" },
  { locId: "luofu", cityKey: "hz", name: "罗浮山", tag: "名山", tip: "飞云顶云海，冲虚古观祈福" },
  { locId: "gym", cityKey: "hz", name: "红花湖", tag: "绿道", tip: "18公里环湖绿道骑行打卡" },
  { locId: "dayawan", cityKey: "hz", name: "大亚湾黄金海岸", tag: "海岸", tip: "细沙踏浪，落日熔金" },
  { locId: "nankunshan", cityKey: "hz", name: "南昆山", tag: "竹海", tip: "川龙瀑布和竹海氧吧" },
  { locId: "xiangtoushan", cityKey: "hz", name: "象头山", tag: "溪谷", tip: "原始林溪谷徒步" },
  { locId: "gaobangshan", cityKey: "hz", name: "高榜山", tag: "登高", tip: "挂榜阁俯瞰西湖全景" },
  { locId: "hejiang", cityKey: "hz", name: "合江楼·东江夜游", tag: "夜游", tip: "夜游船上看合江楼灯影" },
  { locId: "dameisha", cityKey: "sz", name: "大梅沙", tag: "海滨", tip: "愿望塔和海滨栈道" },
  { locId: "fun", cityKey: "sz", name: "深圳湾公园", tag: "海湾", tip: "红树林看候鸟，对望香港" },
  { locId: "lianhua", cityKey: "sz", name: "莲花山公园", tag: "登高", tip: "山顶看福田CBD灯火" },
  { locId: "wutongshan", cityKey: "sz", name: "梧桐山", tag: "第一峰", tip: "大梧桐登顶，鹏城第一峰" },
  { locId: "xianhuhu", cityKey: "sz", name: "仙湖植物园", tag: "花园", tip: "弘法寺和湖区花展" },
  { locId: "yantian", cityKey: "sz", name: "盐田海滨栈道", tag: "栈道", tip: "灯塔图书馆和海鲜街" },
  { locId: "talent", cityKey: "sz", name: "人才公园", tag: "公园", tip: "求贤阁和海边跑道夜景" },
  { locId: "happyvalley", cityKey: "sz", name: "欢乐谷", tag: "乐园", tip: "过山车和夜场灯光秀" },
  { locId: "window", cityKey: "sz", name: "世界之窗", tag: "5A", tip: "埃菲尔铁塔微缩景观前打卡，一天环游世界" },
  { locId: "jinxiu", cityKey: "sz", name: "锦绣中华", tag: "5A", tip: "微缩长城和民族村寨歌舞" },
  { locId: "safari", cityKey: "sz", name: "野生动物园", tag: "4A", tip: "投喂车近距离看猛兽" },
  { locId: "octeast", cityKey: "sz", name: "东部华侨城", tag: "4A", tip: "缆车上云端，茶溪谷喝茶" },
  { locId: "dapengfort", cityKey: "sz", name: "大鹏所城", tag: "4A", tip: "明清海防古城，鹏城之源" },
  { locId: "qingqing", cityKey: "sz", name: "青青世界", tag: "4A", tip: "热带雨林和蝴蝶谷" },
  { locId: "qiniangshan", cityKey: "sz", name: "七娘山", tag: "第二峰", tip: "主峰看大鹏湾和排牙山" },
  { locId: "yangmeikeng", cityKey: "sz", name: "杨梅坑", tag: "海岸", tip: "鹿嘴山庄海边栈道和美人鱼洞" },
  { locId: "xichong", cityKey: "sz", name: "西涌海滩", tag: "沙滩", tip: "月牙湾日出和暗夜银河" },
  { locId: "zhongyingjie", cityKey: "sz", name: "中英街", tag: "历史", tip: "一街两制界碑和老骑楼" },
  { locId: "tanglangshan", cityKey: "sz", name: "塘朗山", tag: "郊野", tip: "山顶望深圳湾和西丽水库" },
  { locId: "fenghuangshan", cityKey: "sz", name: "凤凰山", tag: "森林公园", tip: "望烟楼看珠江口" },
  { locId: "swcac", cityKey: "sz", name: "海上世界文化艺术中心", tag: "看展", tip: "临海展厅和屋顶花园日落" },
  { locId: "haiguiwan", cityKey: "hz", name: "海龟湾", tag: "保护区", tip: "海龟产卵场和观海栈道" },
  { locId: "sanjiaozhou", cityKey: "hz", name: "三角洲岛", tag: "海岛", tip: "快艇上岛浮潜看清澈海水" },
  { locId: "hzbotanic", cityKey: "hz", name: "惠州植物园", tag: "花园", tip: "温室热带植物和丰山全景" },
  { locId: "tst", cityKey: "hk", name: "尖沙咀海滨 · 维多利亚港", tag: "维港", tip: "星光大道看对岸天际线，晚八点幻彩咏香江" },
  { locId: "peak", cityKey: "hk", name: "太平山顶", tag: "山顶", tip: "缆车上凌霄阁，黄昏到夜景一次看够" },
  { locId: "disney", cityKey: "hk", name: "香港迪士尼乐园", tag: "乐园", tip: "奇妙梦想城堡前打卡，晚上看烟花" },
  { locId: "ngongping", cityKey: "hk", name: "昂坪 · 天坛大佛", tag: "大佛", tip: "268 级石阶登顶，缆车跨山跨海" },
  { locId: "saikung", cityKey: "hk", name: "西贡海鲜街", tag: "后花园", tip: "码头拣海鲜即拣即煮，再坐街渡去半月湾" },
  { locId: "stanley", cityKey: "hk", name: "赤柱", tag: "小镇", tip: "市集、美利楼、卜公码头和海边长廊" },
  { locId: "wongtaisin", cityKey: "hk", name: "黄大仙祠", tag: "祈福", tip: "有求必应，上一炷香摇一支签" },
  { locId: "taio", cityKey: "hk", name: "大澳渔村", tag: "棚屋", tip: "水上棚屋和涌道小艇，找中华白海豚" },
  { locId: "mongkok", cityKey: "hk", name: "旺角 · 女人街", tag: "闹市", tip: "霓虹招牌下的排档长街，越夜越旺" },
  { locId: "tramroad", cityKey: "hk", name: "湾仔电车路", tag: "叮叮车", tip: "HK$3 坐百年电车，上层前排是移动观景台" },
];

/* ---- 双语地名 + 景区等级 + 城市简介（帮 峰会外宾和新玩家认识这座城） ----
   English names keyed by the location's Chinese name (names are unique per
   city). Grades follow the official Shenzhen A-level scenic-area list
   (深圳市文化广电旅游体育局 A级旅游景区一览表): 华侨城旅游度假区（世界之窗/
   锦绣中华/欢乐谷）与欢乐海岸、观澜湖为 5A，东部华侨城、青青世界、野生动物园、
   海上田园、光明农场大观园、仙湖植物园、大梅沙、大鹏所城为 4A。 */
export const LOC_EN: Record<string, string> = {
  "宝安国际机场": "Bao'an International Airport", "前海国际会议中心": "Qianhai Int'l Convention Center", "欢乐谷": "Happy Valley", "科技园公司": "Science & Technology Park", "腾讯滨海大厦": "Tencent Binhai Mansion", "腾讯 · 大铲湾总部": "Tencent Dachan Bay Campus", "字节跳动 · 后海中心": "ByteDance Houhai Center", "百度国际大厦": "Baidu International Building", "大疆总部大楼": "DJI Sky City", "华为坂田基地": "Huawei Bantian Campus", "中兴通讯大厦": "ZTE Building", "招商银行大厦": "China Merchants Bank Tower", "万科中心": "Vanke Center", "比亚迪坪山总部": "BYD HQ", "人才公园": "Talent Park", "海岸城商场": "Coastal City Mall", "城中村握手楼": "Urban Village Rental", "社区健身房": "Community Gym", "太子湾 · 峰会欢迎晚宴": "Prince Bay · Summit Welcome Banquet", "蛇口邮轮母港": "Shekou Cruise Homeport", "深圳湾口岸": "Shenzhen Bay Port", "深圳湾公园": "Shenzhen Bay Park", "深圳国际交流中心 · 香蜜湖": "Shenzhen Int'l Exchange Center, Xiangmihu", "莲花山公园": "Lianhuashan Park", "深圳图书馆 · 夜校": "Shenzhen Library & Night School", "深圳北站": "Shenzhen North Station", "平安金融中心": "Ping An Finance Center", "地铁站": "Metro Station", "华强北电子市场": "Huaqiangbei Electronics Market", "东门夜市食街": "Dongmen Night Market", "深圳市人民医院": "Shenzhen People's Hospital", "酒吧街 · KTV": "Bar Street & KTV", "罗湖口岸": "Luohu Port", "大芬油画村": "Dafen Oil Painting Village", "大梅沙海滨公园": "Dameisha Beach Park", "深圳湾滨海酒店 · 青旅": "Shenzhen Bay Hotel & Hostel", "皇岗口岸": "Huanggang Port", "梧桐山": "Wutong Mountain", "福田口岸": "Futian Port", "莲塘口岸": "Liantang Port", "文锦渡口岸": "Wenjindu Port", "沙头角口岸": "Shatoujiao Port", "仙湖植物园 · 弘法寺": "Fairy Lake Botanical Garden & Hongfa Temple", "盐田海滨栈道": "Yantian Seaside Boardwalk",
  "世界之窗": "Window of the World", "锦绣中华 · 民俗村": "Splendid China Folk Village", "深圳野生动物园": "Shenzhen Safari Park", "东部华侨城": "OCT East", "青青世界": "Evergreen World", "海上田园": "Sea Garden Eco-Tourism Area", "光明农场大观园": "Guangming Farm Grand View Garden", "大鹏所城": "Dapeng Fortress", "欢乐海岸": "OCT Harbour", "观澜湖旅游休闲度假区": "Mission Hills Resort",
  "七娘山": "Qiniang Mountain", "杨梅坑": "Yangmeikeng Coastal Valley", "西涌海滩": "Xichong Beach", "中英街": "Chung Ying Street", "塘朗山郊野公园": "Tanglangshan Country Park", "凤凰山森林公园": "Fenghuangshan Forest Park", "深圳博物馆": "Shenzhen Museum", "海上世界文化艺术中心": "Sea World Culture & Arts Center", "深圳湾体育中心 · 春茧": "Shenzhen Bay Sports Center (Spring Cocoon)", "龙岗大运中心": "Longgang Universiade Center",
  "海龟湾自然保护区": "Sea Turtle Bay Nature Reserve", "三角洲岛": "Delta Island (Sanjiaozhou)", "惠州博物馆": "Huizhou Museum", "霞涌海鲜街": "Xiayong Seafood Street", "东江公园": "Dongjiang Park", "惠州植物园": "Huizhou Botanical Garden",
  "罗浮山": "Luofu Mountain", "仲恺公司": "Zhongkai (Office)", "檀悦豪生度假酒店": "Tanyue Howard Johnson Resort", "TCL科技园": "TCL Technology Park", "德赛西威研发中心": "Desay SV R&D Center", "亿纬锂能产业园": "EVE Energy Industrial Park", "中海油大亚湾石化区": "CNOOC Daya Bay Petrochemical Zone", "红花湖骑行站": "Honghuahu Lake Cycling", "惠州市图书馆": "Huizhou Library", "惠州西湖": "West Lake", "桥东二手市集": "Qiaodong Second-hand Market", "城轨站": "Intercity Rail Station", "港惠商场": "Ganghui Mall", "惠州市第一人民医院": "Huizhou First People's Hospital", "江北华贸天地": "Huamao Centre, Jiangbei", "惠州农商银行": "Huizhou Rural Commercial Bank", "老街夜市": "Old Street Night Market", "东江酒吧街": "Dongjiang Bar Street", "合江楼 · 东江夜游": "Hejiang Tower & Dongjiang Night Cruise", "惠州南站": "Huizhou South Station", "淡水老城": "Danshui Old Town", "大亚湾黄金海岸": "Daya Bay Golden Coast", "温泉酒店": "Hot Spring Hotel", "巽寮湾渔港": "Xunliao Bay Fishing Port", "海边出租屋": "Seaside Rental", "双月湾海边": "Shuangyue Bay Beach", "西湖青旅 · 湖畔民宿": "West Lake Hostel & B&B", "南昆山": "Nankun Mountain", "象头山": "Xiangtou Mountain", "高榜山 · 挂榜阁": "Gaobang Mountain & Guabang Pavilion", "惠州平潭机场": "Huizhou Pingtan Airport",
  "深水埗唐楼": "Sham Shui Po Tong Lau", "香港西九龙站": "Hong Kong West Kowloon Station", "罗湖站 · 边境": "Lo Wu Station · Boundary", "文锦渡管制站": "Man Kam To Control Point", "沙头角管制站": "Sha Tau Kok Control Point", "港珠澳大桥香港口岸": "HZMB Hong Kong Port", "港澳客轮码头 · 信德中心": "Hong Kong–Macau Ferry Terminal (Shun Tak)", "中国客运码头 · 中港城": "China Ferry Terminal (China Hong Kong City)", "启德邮轮码头": "Kai Tak Cruise Terminal", "落马洲管制站": "Lok Ma Chau Control Point", "落马洲支线站": "Lok Ma Chau Spur Line Station", "深圳湾口岸 · 港方口岸区": "Shenzhen Bay Port (Hong Kong side)", "香园围口岸": "Heung Yuen Wai Port", "中环金融区": "Central Financial District", "观塘工厦区": "Kwun Tong Industrial Buildings", "上环 · 茶餐廳食街": "Sheung Wan · Cha Chaan Teng Street", "油麻地 · 庙街夜市": "Yau Ma Tei · Temple Street Night Market", "旺角 · 女人街": "Mong Kok · Ladies' Market", "北角 · 春秧街街市": "North Point · Chun Yeung Street Market", "铜锣湾": "Causeway Bay", "沙田新城市广场": "New Town Plaza, Sha Tin", "汇丰银行总行": "HSBC Main Building", "玛丽医院": "Queen Mary Hospital", "香港中央图书馆": "Hong Kong Central Library", "维多利亚公园": "Victoria Park", "尖沙咀海滨 · 维多利亚港": "Tsim Sha Tsui Promenade · Victoria Harbour", "太平山顶": "Victoria Peak", "湾仔电车路": "Wan Chai Tramway", "香港迪士尼乐园": "Hong Kong Disneyland", "昂坪 · 天坛大佛": "Ngong Ping · Tian Tan Buddha", "大澳渔村": "Tai O Fishing Village", "东涌": "Tung Chung", "香港国际机场": "Hong Kong International Airport", "海洋公园": "Ocean Park Hong Kong", "赤柱": "Stanley", "西贡海鲜街": "Sai Kung Seafood Street", "黄大仙祠": "Wong Tai Sin Temple", "将军澳 · 海滨新市镇": "Tseung Kwan O Waterfront", "元朗 · 大马路": "Yuen Long Main Road", "屯门 · 黄金海岸": "Tuen Mun · Gold Coast", "兰桂坊": "Lan Kwai Fong", "尖沙咀酒店 · 宾馆": "Tsim Sha Tsui Hotels & Guesthouses", "港交所 · 交易广场": "HKEX · Exchange Square", "太古地产 · 鲗鱼涌写字楼": "Swire Properties · Quarry Bay", "国泰航空 · 航空城": "Cathay City (Cathay Pacific HQ)", "香港科学园 · 白石角": "Hong Kong Science Park, Pak Shek Kok", "港铁公司 · 九龙湾总部": "MTR HQ, Kowloon Bay",
};

export const LOC_GRADE: Record<string, string> = {
  "世界之窗": "国家 5A 级景区", "锦绣中华 · 民俗村": "国家 5A 级景区", "欢乐谷": "国家 5A 级景区", "欢乐海岸": "国家 5A 级景区", "观澜湖旅游休闲度假区": "国家 5A 级景区",
  "东部华侨城": "国家 4A 级景区", "青青世界": "国家 4A 级景区", "深圳野生动物园": "国家 4A 级景区", "海上田园": "国家 4A 级景区", "光明农场大观园": "国家 4A 级景区", "仙湖植物园 · 弘法寺": "国家 4A 级景区", "大梅沙海滨公园": "国家 4A 级景区", "大鹏所城": "国家 4A 级景区",
};

export interface CityIntro { title: string; en: string; facts: string; }
export const CITY_INTRO: Record<CityKey, CityIntro> = {
  sz: {
    title: "认识深圳",
    en: "Shenzhen at a Glance",
    facts: "中国第一个经济特区（1980 年设立）· 面积 1,997 km² · 常住人口约 1,798 万 · 平安金融中心 599 米，中国第二高楼 · 第一高峰梧桐山 943.7 米 · 地铁运营 600+ 公里 · 海岸线约 260 公里，深圳湾大桥直通香港 · 游戏里 11 月中旬有一场虚构的「湾区国际峰会」。地图上的景区和会场都带英文名，点开地点就能看到——外宾跟着这张图就能认深圳。",
  },
  hz: {
    title: "认识惠州",
    en: "Huizhou at a Glance",
    facts: "广东地级市，东江穿城而过 · 面积 11,347 km² · 常住人口约 606 万 · 罗浮山主峰飞云顶 1,296 米，道教名山 · 惠州西湖与杭州西湖同为「西湖」姊妹湖 · 大亚湾、巽寮湾、双月湾连成 280 多公里海岸线 · 厦深高铁半小时到深圳，莞惠城际通东莞。",
  },
  hk: {
    title: "认识香港",
    en: "Hong Kong at a Glance",
    facts: "中国特别行政区 · 面积 1,114 km² · 人口约 750 万 · 港岛、九龙、新界、大屿山组成，维多利亚港隔开港岛和九龙 · 最高峰大帽山 957 米，太平山顶 552 米看维港 · 港铁 10 条重铁线 + 机场快线，全长 270+ 公里，电车（叮叮车）1904 年通车 · 天星小轮过海 HK$5 有找 · 茶餐厅、云吞面、点心、一盅两件，是这座城的日常。价格按港币（HK$）标示，游戏钱包与人民币按 1:1 简化结算。",
  },
};
export function scenicOf(cityKey: CityKey, locId: string): ScenicSpot | undefined {
  return SCENIC_SPOTS.find((s) => s.cityKey === cityKey && s.locId === locId);
}

/* ================= 地铁 / 城际线路 ================= */
export interface MetroStation { name: string; x: number; z: number; locId?: string; }
export interface MetroLine { id: string; name: string; short: string; color: number; colorCss: string; city: CityKey | "both"; stations: MetroStation[]; }
const S = (name: string, x: number, z: number, locId?: string): MetroStation => ({ name, x, z, locId });
/* Shenzhen: the full metro / tram / APM network plus 穗深城际, generated
   from OpenStreetMap by tools/metro/gen_sz_metro.py (see metro-sz.ts).
   Below: the hand-made Huizhou intercity + high-speed rail lines. */
/** A generated Shenzhen station by name (keeps rail lines that stop there
    exactly on the metro station's position). */
const szSt = (name: string): MetroStation => {
  for (const l of SZ_METRO_LINES) { const st = l.stations.find((x) => x.name === name); if (st) return { name, x: st.x, z: st.z }; }
  throw new Error(`station ${name} missing from metro-sz.ts`);
};
export const METRO_LINES: MetroLine[] = [
  ...SZ_METRO_LINES,
  { id: "hz-intercity", name: "莞惠城际 · 惠州城轨", short: "惠州城轨", color: 0x0ea5e9, colorCss: "#0EA5E9", city: "hz", stations: [S("仲恺",-6.09,-4.02,"work"),S("沥林北",-12.73,-2.82),S("陈江南",-7.83,-2.83),S("惠环",-5.42,-3.62),S("龙丰",-4.33,-5.08),S("惠州西湖",-2.75,-7.22,"xihu"),S("云山",-1.71,-12.08),S("江北·小金口",-4.06,-11.30,"huamao"),S("惠州北",-5.18,-14.99)] },
  /* 厦深高铁 crosses between the two cities' maps, which use different
     coordinate frames — so each city draws only its own end, ending in a
     direction stub (a name ending in 方向: drawn, not ridable; changing city is the
     高铁 trip in 切换城市). */
  { id: "szhz-rail", name: "厦深高铁（深圳北↔惠州南）", short: "高铁", color: 0x6366f1, colorCss: "#6366F1", city: "sz", stations: [S("深圳北站",-4.68,-7.10,"north"),szSt("坪山站"),S("惠州南·惠州方向",37.80,-15.29)] },
  { id: "szhz-rail", name: "厦深高铁（深圳北↔惠州南）", short: "高铁", color: 0x6366f1, colorCss: "#6366F1", city: "hz", stations: [S("深圳北·深圳方向",-22.67,17.72),S("惠州南站",0.51,7.28,"hzsouth"),S("惠东站",13.60,-0.33)] },
  /* Huizhou has NO metro — its rail is intercity + high-speed rail only.
     赣深高铁 serves 惠州北/仲恺 (transfers with 莞惠城际 at both), 广汕高铁
     serves 惠州南 (transfers with 厦深高铁 there). */
  { id: "ganshen-rail", name: "赣深高铁（惠州北↔深圳北）", short: "赣深高铁", color: 0x9333ea, colorCss: "#9333EA", city: "hz", stations: [S("东莞南",-24.00,0.31),S("仲恺",-6.09,-4.02,"work"),S("惠州北",-5.18,-14.99)] },
  { id: "guangshan-rail", name: "广汕高铁（惠州南↔汕尾）", short: "广汕高铁", color: 0xe11d48, colorCss: "#E11D48", city: "hz", stations: [S("惠城南",0.91,-5.36),S("惠州南站",0.51,7.28,"hzsouth"),S("惠东站",13.60,-0.33)] },
  /* ---- 香港只有港铁，没有「地铁」这个说法 ----
     9 条重铁线 + 机场快线 + 迪士尼线，线路颜色和走向按真实港铁网络；
     广深港高铁在西九龙站和深圳北站之间过关（一地两检在西九龙站内完成）。
     西九龙站与九龙站（东涌线/机场快线）之间是行人通道相连——和现实一样，
     路线规划里算作一段步行接驳。 */
  // 广深港高铁 is drawn on each side of the border separately (each map has its own
  // projection); the far end is a direction stub — crossing is a route choice, not a ride.
  { id: "hsr-hk", name: "广深港高铁（西九龙↔深圳北）", short: "高铁", color: 0x7c3aed, colorCss: "#7C3AED", city: "sz", stations: [S("深圳北站",-4.68,-7.10,"north"),S("福田",-3.59,0.25),S("香港西九龙·香港方向",-2.77,5.62)] },
  { id: "hsr-hk", name: "广深港高铁（西九龙↔深圳北）", short: "高铁", color: 0x7c3aed, colorCss: "#7C3AED", city: "hk", stations: [S("香港西九龙",8.68,9.63,"westkowloon"),S("深圳北·深圳方向",-4,-21.5)] },
  { id: "twl", name: "荃湾线", short: "荃湾线", color: 0xe2231a, colorCss: "#E2231A", city: "hk", stations: [S("荃湾",5.75,2.16),S("葵兴",7.28,3.44),S("美孚",7.47,6.10),S("深水埗",9.61,5.60,"home"),S("太子",11.11,6.26),S("旺角",11.68,6.63,"mongkok"),S("油麻地",13.46,8.29,"yumatei"),S("佐敦",12.17,9.24),S("尖沙咀",11.75,11.58,"tst"),S("金钟",10.65,16.55),S("中环",10.46,15.44,"central")] },
  { id: "isl", name: "港岛线", short: "港岛线", color: 0x0075c2, colorCss: "#0075C2", city: "hk", stations: [S("坚尼地城",5.78,13.99),S("香港大学",5.77,13.80),S("西营盘",5.79,13.75),S("上环",6.88,14.65,"sheungwan"),S("中环",10.46,15.44,"central"),S("金钟",10.65,16.55),S("湾仔",14.86,16.35,"tramroad"),S("铜锣湾",16.19,18.31,"causewaybay"),S("天后",18.07,16.67,"library-hk"),S("北角",17.89,12.85,"chunyeung"),S("鰂鱼涌",14,9),S("太古",18.15,13.37),S("柴湾",19.57,15.72)] },
  { id: "ktl", name: "观塘线", short: "观塘线", color: 0x00a94f, colorCss: "#00A94F", city: "hk", stations: [S("黄埔",16.65,9.75),S("何文田",15.08,8.66),S("油麻地",13.46,8.29,"yumatei"),S("旺角",11.68,6.63,"mongkok"),S("太子",11.11,6.26),S("石硖尾",11.30,5.52),S("九龙塘",12.62,5.12),S("黄大仙",15.15,5.25,"wongtaisin"),S("钻石山",16.09,5.69),S("彩虹",16.91,6.58),S("观塘",18.21,8.84,"kwuntong"),S("蓝田",19.25,10.43),S("油塘",19.66,11.57),S("调景岭",22.17,10.37,"tseungkwano")] },
  { id: "tkl", name: "将军澳线", short: "将军澳线", color: 0x7d4998, colorCss: "#7D4998", city: "hk", stations: [S("北角",17.89,12.85,"chunyeung"),S("鰂鱼涌",14,9),S("油塘",19.66,11.57),S("调景岭",22.17,10.37,"tseungkwano"),S("将军澳",22.16,10.39),S("坑口",22.71,9.49),S("宝琳",21.93,8.51)] },
  { id: "eal", name: "东铁线", short: "东铁线", color: 0x53b7e8, colorCss: "#53B7E8", city: "hk", stations: [S("罗湖",5.00,-16.65,"luohu-hk"),S("上水",6.95,-13.61),S("粉岭",8.20,-12.48),S("太和",10.76,-7.41),S("大埔墟",11.87,-6.61),S("大学",16.42,-2.77),S("火炭",15.03,-0.50),S("沙田",13.32,0.54,"shatin"),S("大围",12.77,2.14),S("九龙塘",12.62,5.12),S("红磡",15.26,9.87),S("会展",13.51,15.56),S("金钟",10.65,16.55)] },
  { id: "sil", name: "南港岛线", short: "南港岛线", color: 0xa9c400, colorCss: "#A9C400", city: "hk", stations: [S("金钟",10.65,16.55),S("海洋公园",11.90,19.29,"oceanpark"),S("黄竹坑",11.41,18.70),S("利东",10.04,18.87),S("海怡半岛",9.21,18.71)] },
  { id: "tml", name: "屯马线", short: "屯马线", color: 0x9a3820, colorCss: "#9A3820", city: "hk", stations: [S("屯门",-8.97,1.89,"tuenmun"),S("兆康",-10.31,-2.57),S("天水围",-7.11,-7.20),S("朗屏",-4.87,-6.99),S("元朗",-5.25,-6.60,"yuenlong"),S("锦上路",-0.50,-5.39),S("荃湾西",4.86,2.83),S("美孚",7.47,6.10),S("南昌",8.50,6.55),S("红磡",15.26,9.87),S("土瓜湾",15.69,7.79),S("宋皇台",15.70,6.85),S("启德",16.32,6.73),S("钻石山",16.09,5.69),S("大围",12.77,2.14),S("车公庙",13.67,1.96),S("沙田围",14.69,1.72),S("第一城",15.67,1.02),S("乌溪沙",20.31,-4.69)] },
  { id: "tcl", name: "东涌线", short: "东涌线", color: 0xf7943e, colorCss: "#F7943E", city: "hk", stations: [S("香港",10.46,15.44,"central"),S("九龙",8.68,9.63,"westkowloon"),S("奥运",9.19,7.22),S("南昌",8.50,6.55),S("青衣",4.59,3.84),S("欣澳",-4.47,7.34),S("东涌",-13.99,13.47,"tungchung")] },
  { id: "aex", name: "机场快线", short: "机场快线", color: 0x00888e, colorCss: "#00888E", city: "hk", stations: [S("香港",10.46,15.44,"central"),S("九龙",8.68,9.63,"westkowloon"),S("青衣",4.59,3.84),S("机场",-17.69,9.97,"airport-hk"),S("博览馆",-14.47,8.58)] },
  { id: "drl", name: "迪士尼线", short: "迪士尼线", color: 0xf173ac, colorCss: "#F173AC", city: "hk", stations: [S("欣澳",-4.47,7.34),S("迪士尼",-3.05,9.69,"disney")] },
];
export function metroLinesForCity(cityKey: CityKey): MetroLine[] {
  return METRO_LINES.filter((l) => l.city === cityKey || l.city === "both");
}
export function linesForLoc(cityKey: CityKey, locId: string): MetroLine[] {
  return metroLinesForCity(cityKey).filter((l) => l.stations.some((s) => s.locId === locId || stationLocId(s.name) === locId));
}
export interface MetroLeg { line: MetroLine; stations: MetroStation[]; stops: number; }
export interface MetroRoute { line: MetroLine; fromIdx: number; toIdx: number; stops: number; fare: number; stations: MetroStation[]; legs: MetroLeg[]; transferStations: string[]; shuttleFrom: string[]; isTransfer: boolean; summary: string; }
/** Out-of-station shuttle links: pairs of differently-named stations that are
 * connected by a shuttle bus in real life, so the two rail networks join up.
 * 惠州北 (莞惠城际) and 惠州南站 (厦深高铁) are separate stations across town;
 * without this link the Huizhou intercity network and the high-speed rail
 * network would be two disconnected islands. */
export const SHUTTLE_LINKS: [string, string][] = [["惠州北", "惠州南站"], ["香港西九龙", "九龙"]];
/** Relative time cost per map unit for each line: express / rail lines
 * cover ground much faster than an all-stops metro (11号线 runs at
 * 120 km/h vs 80 km/h; intercity / high-speed rail faster still). */
const LINE_SPEED: Record<string, number> = { "11": 0.6, "14": 0.7, tram1: 1.6, tram2: 1.6, apm: 1.3, guangshen: 0.45, "szhz-rail": 0.3, "ganshen-rail": 0.3, "guangshan-rail": 0.3, "hz-intercity": 0.5 };
/** Cost of changing lines (walk between platforms + wait), in map units —
 * roughly 8–10 minutes, so the router never ping-pongs between lines to
 * shave a little distance off a schematic that is not to scale. */
const TRANSFER_COST = 15;
/** Intercity / high-speed rail: priced by the old flat stop formula. */
const RAIL_LINE_IDS = new Set(["guangshen", "szhz-rail", "hz-intercity", "ganshen-rail", "guangshan-rail"]);
/** 深圳地铁里程计价: first 4 km ¥2; 4–12 km +¥1 per 4 km; 12–24 km +¥1 per
 * 6 km; beyond 24 km +¥1 per 8 km. Distance = the ridden stations' real
 * (OSM) positions, falling back to map distance for any station without one. */
function metroFare(stations: MetroStation[]): number {
  let km = 0;
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1]!, b = stations[i]!;
    const ra = SZ_REAL_KM[a.name], rb = SZ_REAL_KM[b.name];
    km += ra && rb ? Math.hypot(rb[0] - ra[0], rb[1] - ra[1]) : Math.hypot(b.x - a.x, b.z - a.z) * SZ_KM_PER_UNIT;
  }
  // track runs ~1.25× the straight line between stations
  km *= 1.25;
  if (km <= 4) return 2;
  if (km <= 12) return 2 + Math.ceil((km - 4) / 4);
  if (km <= 24) return 4 + Math.ceil((km - 12) / 6);
  return 6 + Math.ceil((km - 24) / 8);
}
/** Cost of an out-of-station shuttle-bus hop. */
const SHUTTLE_COST = 8;
/** Shortest-time route over the station graph (Dijkstra): ride along a line
 * (cost = distance × line speed), change lines at a same-name station, or
 * cross between the paired stations in SHUTTLE_LINKS by shuttle bus. The
 * schematic lists lines at very different station densities, so ranking by
 * stop count would mislead; distance × speed + transfer penalty does not.
 * Legs are split at each transfer so the carriage can announce the change. */
function routeWhere(cityKey: CityKey, isStart: (st: MetroStation) => boolean, isGoal: (st: MetroStation) => boolean): MetroRoute | null {
  const lines = metroLinesForCity(cityKey);
  const keyOf = (lineId: string, name: string) => `${lineId}::${name}`;
  const byName = new Map<string, { line: MetroLine; idx: number }[]>();
  for (const line of lines) line.stations.forEach((st, idx) => {
    const arr = byName.get(st.name) ?? []; arr.push({ line, idx }); byName.set(st.name, arr);
  });
  const shuttleTo = new Map<string, string[]>();
  for (const [a, b] of SHUTTLE_LINKS) {
    shuttleTo.set(a, [...(shuttleTo.get(a) ?? []), b]);
    shuttleTo.set(b, [...(shuttleTo.get(b) ?? []), a]);
  }
  const shuttleEdges = new Set<string>();
  const startKeys = new Set<string>();
  const goals = new Set<string>();
  type Prev = { prevKey: string; line: MetroLine; station: MetroStation } | null;
  const dist = new Map<string, number>();
  const prev = new Map<string, Prev>();
  const done = new Set<string>();
  const nodeStation = new Map<string, MetroStation>();
  const nodeLine = new Map<string, MetroLine>();
  for (const line of lines) line.stations.forEach((st) => {
    const k = keyOf(line.id, st.name);
    if (isStart(st)) { startKeys.add(k); dist.set(k, 0); prev.set(k, null); nodeStation.set(k, st); nodeLine.set(k, line); }
    if (isGoal(st)) goals.add(k);
  });
  if (startKeys.size === 0 || goals.size === 0) return null;
  const relax = (from: string, line: MetroLine, st: MetroStation, cost: number, viaShuttle = false) => {
    const nk = keyOf(line.id, st.name);
    if (done.has(nk)) return;
    if (cost < (dist.get(nk) ?? Infinity)) {
      dist.set(nk, cost); prev.set(nk, { prevKey: from, line, station: st }); nodeStation.set(nk, st); nodeLine.set(nk, line);
      if (viaShuttle) shuttleEdges.add(nk); else shuttleEdges.delete(nk);
    }
  };
  let goalKey: string | null = null;
  for (;;) {
    let k: string | null = null; let best = Infinity;
    for (const [nk, d] of dist) if (!done.has(nk) && d < best) { best = d; k = nk; }
    if (k === null) break;
    done.add(k);
    if (goals.has(k) && !startKeys.has(k)) { goalKey = k; break; }
    const line = nodeLine.get(k)!; const st = nodeStation.get(k)!;
    const idx = line.stations.findIndex((x) => x.name === st.name);
    const speed = LINE_SPEED[line.id] ?? 1;
    for (const ni of [idx - 1, idx + 1]) {
      const nst = line.stations[ni]; if (!nst) continue;
      relax(k, line, nst, best + Math.hypot(nst.x - st.x, nst.z - st.z) * speed + 1);
    }
    for (const alt of byName.get(st.name) ?? []) {
      if (alt.line.id === line.id) continue;
      relax(k, alt.line, alt.line.stations[alt.idx]!, best + (startKeys.has(k) ? 0 : TRANSFER_COST));
    }
    for (const partnerName of shuttleTo.get(st.name) ?? []) {
      for (const alt of byName.get(partnerName) ?? []) relax(k, alt.line, alt.line.stations[alt.idx]!, best + SHUTTLE_COST, true);
    }
  }
  if (!goalKey) return null;
  // walk back the chain of ridden steps (skip zero-cost transfer hops, they
  // only switch the active line at the same station)
  const steps: { line: MetroLine; station: MetroStation }[] = [];
  let cur: string | null = goalKey;
  while (cur) {
    const p: Prev = prev.get(cur) ?? null;
    if (!p) break;
    // a step counts as a ride step when the station name changes
    const prevStation = nodeStation.get(p.prevKey);
    if (prevStation && prevStation.name !== nodeStation.get(cur)!.name) {
      steps.push({ line: nodeLine.get(cur)!, station: nodeStation.get(cur)! });
    }
    cur = p.prevKey;
  }
  steps.reverse();
  // Rebuild full ordered station list + legs from the start node of the goal chain
  // Find the start key by walking to the root
  let rootKey = goalKey; while ((prev.get(rootKey) ?? null)) rootKey = (prev.get(rootKey) as { prevKey: string }).prevKey;
  const rootStation = nodeStation.get(rootKey)!;
  const fullStations: MetroStation[] = [rootStation, ...steps.map((s) => s.station)];
  const legs: MetroLeg[] = [];
  let legStations: MetroStation[] = [rootStation];
  let legLine: MetroLine | null = null;
  // Determine each step's line from the chain: re-walk forward collecting lines
  const chainKeys: string[] = []; { let c: string | null = goalKey; while (c) { chainKeys.push(c); const p: Prev = prev.get(c) ?? null; c = p ? p.prevKey : null; } chainKeys.reverse(); }
  const rideLines: MetroLine[] = [];
  for (let i = 1; i < chainKeys.length; i++) {
    const a = nodeStation.get(chainKeys[i - 1]!)!; const b = nodeStation.get(chainKeys[i]!)!;
    if (a.name !== b.name) rideLines.push(nodeLine.get(chainKeys[i]!)!);
  }
  for (let i = 0; i < steps.length; i++) {
    const ln = rideLines[i] ?? nodeLine.get(goalKey)!;
    if (legLine && ln.id !== legLine.id) { legs.push({ line: legLine, stations: legStations, stops: legStations.length - 1 }); legStations = [legStations[legStations.length - 1]!]; }
    legLine = ln; legStations.push(steps[i]!.station);
  }
  if (legLine) legs.push({ line: legLine, stations: legStations, stops: legStations.length - 1 });
  const transferStations = legs.slice(1).map((l) => l.stations[0]!.name);
  // Stations where the next leg starts with a shuttle-bus hop (the chain node
  // after this station was reached via a shuttle edge, not by rail).
  const shuttleFrom: string[] = [];
  for (let i = 1; i < chainKeys.length; i++) {
    if (shuttleEdges.has(chainKeys[i]!)) {
      const nm = nodeStation.get(chainKeys[i - 1]!)!.name;
      if (!shuttleFrom.includes(nm)) shuttleFrom.push(nm);
    }
  }
  const stops = fullStations.length - 1;
  const fare = legs.every((l) => !RAIL_LINE_IDS.has(l.line.id))
    ? metroFare(fullStations)
    : Math.min(14, 2 + stops + transferStations.length);
  const firstLine = legs[0]?.line ?? nodeLine.get(goalKey)!;
  const summary = legs.map((l) => l.line.short).join(" → ");
  return { line: firstLine, fromIdx: 0, toIdx: fullStations.length - 1, stops, fare, stations: fullStations, legs, transferStations, shuttleFrom, isTransfer: legs.length > 1, summary };
}
/** Fare for riding a route only as far as station index `uptoIdx` (getting
    off early). Metro-only trips use the distance tariff; rail trips scale. */
export function partialFare(route: MetroRoute, uptoIdx: number): number {
  const last = route.stations.length - 1;
  if (uptoIdx >= last) return route.fare;
  if (route.legs.every((l) => !RAIL_LINE_IDS.has(l.line.id))) return metroFare(route.stations.slice(0, uptoIdx + 1));
  return Math.max(2, Math.round((route.fare * uptoIdx) / Math.max(1, last)));
}
/** Route between two game locations (each must be a station location). */
export function findMetroRoute(cityKey: CityKey, fromLocId: string, toLocId: string): MetroRoute | null {
  if (fromLocId === toLocId) return null;
  const at = (id: string) => (st: MetroStation) => st.locId === id || stationLocId(st.name) === id;
  return routeWhere(cityKey, at(fromLocId), at(toLocId));
}
/** Route between ANY two stations by name — stations need no game location. */
export function findStationRoute(cityKey: CityKey, fromName: string, toName: string): MetroRoute | null {
  if (fromName === toName) return null;
  return routeWhere(cityKey, (st) => st.name === fromName, (st) => st.name === toName);
}
/** Where the player stands after exiting a station: the station's own game
    location when it has one, otherwise the station itself ("st:<站名>"). */
export function exitLocForStation(cityKey: CityKey, stationName: string): string | null {
  const locs = getLocations(cityKey);
  let st: MetroStation | undefined;
  for (const line of metroLinesForCity(cityKey)) {
    const hit = line.stations.find((x) => x.name === stationName);
    if (hit && hit.locId && locs.some((l) => l.id === hit.locId)) return hit.locId;
    st ??= hit;
  }
  return st ? stationLocId(st.name) : null;
}
export function allMetroDestinations(cityKey: CityKey, fromLocId: string): { locId: string; route: MetroRoute }[] {
  const out: { locId: string; route: MetroRoute }[] = [];
  const seen = new Set<string>();
  // Cross-city lines (厦深高铁, 广深城际) pass stations that belong to the
  // other city's location set — those are not destinations in this run, so
  // only offer stations whose location exists in the player's own city.
  const cityLocIds = new Set(getLocations(cityKey).map((l) => l.id));
  for (const line of metroLinesForCity(cityKey)) {
    for (const st of line.stations) {
      if (!st.locId || st.locId === fromLocId || seen.has(st.locId) || !cityLocIds.has(st.locId)) continue;
      seen.add(st.locId);
      const r = findMetroRoute(cityKey, fromLocId, st.locId);
      if (r) out.push({ locId: st.locId, route: r });
    }
  }
  return out.sort((a, b) => a.route.stops - b.route.stops);
}
/** Locations in this city that are themselves a rail station (some station
    carries their locId). These are the only points the BFS router can start
    or end at — every other place reaches the network through one of them. */
export function stationLocIds(cityKey: CityKey): string[] {
  const cityLocIds = new Set(getLocations(cityKey).map((l) => l.id));
  const out = new Set<string>();
  for (const line of metroLinesForCity(cityKey)) {
    for (const st of line.stations) if (st.locId && cityLocIds.has(st.locId)) out.add(st.locId);
  }
  return [...out];
}
export interface RailTripPlan {
  /** Location the ride boards at (a station location). */
  boardLoc: string;
  /** Location the ride alights at (a station location). */
  alightLoc: string;
  route: MetroRoute;
  /** Map distance of the walk from the origin to the boarding station. */
  walkIn: number;
  /** Map distance of the walk from the arrival station to the destination. */
  walkOut: number;
}
/** Plan a rail trip between ANY two locations in the city — not just the
    ones that are stations themselves. A place without its own station
    (a beach, a park, most scenic spots) boards at the nearest station
    location and alights at the station location nearest the destination;
    the caller walks those two short access legs, so the trip is staged as
    walk → ride (transfers included) → walk instead of being cancelled.
    Returns null only when both ends resolve to the same station area
    (walking the whole way is genuinely faster) or the city has no anchors. */
export function planRailTrip(cityKey: CityKey, fromLocId: string, toLocId: string): RailTripPlan | null {
  if (fromLocId === toLocId) return null;
  const locs = getLocations(cityKey);
  const from = resolveLoc(cityKey, fromLocId);
  const to = resolveLoc(cityKey, toLocId);
  if (!from || !to) return null;
  const anchors = stationLocIds(cityKey)
    .map((id) => locs.find((l) => l.id === id))
    .filter((l): l is Loc => Boolean(l));
  // Every station is a possible boarding / alighting point: stations with no
  // game location of their own join as "st:<站名>", so a trip boards at the
  // station truly nearest you and alights at the one nearest the target.
  const anchorIds = new Set(anchors.map((a) => a.id));
  for (const line of metroLinesForCity(cityKey)) for (const st of line.stations) {
    if (st.name.endsWith("方向") || (st.locId && anchorIds.has(st.locId))) continue;
    const id = stationLocId(st.name);
    if (anchorIds.has(id)) continue;
    const l = resolveLoc(cityKey, id);
    if (l) { anchors.push(l); anchorIds.add(id); }
  }
  if (anchors.length === 0) return null;
  const near = (p: Loc, n: number) =>
    anchors
      .map((a) => ({ a, d: Math.hypot(a.x - p.x, a.z - p.z) }))
      .sort((x, y) => x.d - y.d)
      .slice(0, n);
  let best: RailTripPlan | null = null;
  let bestScore = Infinity;
  for (const b of near(from, 5)) {
    for (const a of near(to, 5)) {
      if (b.a.id === a.a.id) continue;
      const route = findMetroRoute(cityKey, b.a.id, a.a.id);
      if (!route) continue;
      // Rank by door-to-door time, in "one stop" units (~2.5 min): a map unit
      // on foot is ~11 min (≈4 stops), and every transfer costs ~3 stops of
      // walking the passage and waiting. Counting stops alone made an express
      // line with a transfer beat the direct line (宝安 → 欢乐谷 via 11号线).
      const score = (b.d + a.d) * 4 + route.stops + route.transferStations.length * 3;
      if (score < bestScore) {
        bestScore = score;
        best = { boardLoc: b.a.id, alightLoc: a.a.id, route, walkIn: b.d, walkOut: a.d };
      }
    }
  }
  if (!best) return null;
  // Short-hop guard: if the two access walks alone are already longer than
  // walking straight there, the train is a detour — return null and let the
  // caller walk it (announced, never a silent mode switch).
  const direct = Math.hypot(to.x - from.x, to.z - from.z);
  if (direct <= best.walkIn + best.walkOut) return null;
  return best;
}
export function rentFlatWeekly(cityKey: CityKey): number { return cityKey === "hz" ? 620 : cityKey === "hk" ? 1600 : 950; }

/* ================= 地铁车厢 ================= */
export interface CarriagePassenger { emoji: string; name: string; kind: "sitting" | "standing" | "elder" | "kid" | "phone" | "sleeping"; }
export const CARRIAGE_PASSENGERS: CarriagePassenger[] = [
  { emoji: "👵", name: "拎菜的阿婆", kind: "elder" }, { emoji: "🧑‍💼", name: "赶打卡的白领", kind: "phone" },
  { emoji: "👧", name: "背书包的学生", kind: "kid" }, { emoji: "🧑‍💻", name: "抱电脑的程序员", kind: "sleeping" },
  { emoji: "🤰", name: "孕妇姐姐", kind: "elder" }, { emoji: "🛵", name: "外卖小哥", kind: "standing" },
  { emoji: "👩", name: "刷短视频的姑娘", kind: "phone" }, { emoji: "👴", name: "看报的大爷", kind: "sitting" },
  { emoji: "🧑", name: "耳机青年", kind: "standing" }, { emoji: "👶", name: "推婴儿车的妈妈", kind: "elder" },
];
export type CrowdLevel = 0 | 1 | 2 | 3;
export function crowdForRide(lineId: string, day: number, rideIndex: number): { level: CrowdLevel; label: string; desc: string } {
  const busyLines = ["1", "5", "11", "4", "3"];
  const base = busyLines.includes(lineId) ? 2 : 1;
  const rush = rideIndex === 0; // first ride after waking reads as morning peak
  const apecBoost = day >= 14 && day <= 19 ? 1 : 0;
  const lvl = Math.max(0, Math.min(3, base + (rush ? 1 : 0) + apecBoost - (rideIndex > 2 ? 1 : 0))) as CrowdLevel;
  if (lvl >= 3) return { level: lvl, label: "早高峰 · 爆满", desc: "车门一开人潮涌进来，你被挤到扶杆边，脚尖都快离地了。" };
  if (lvl === 2) return { level: lvl, label: "高峰 · 很挤", desc: "座位全满，过道站满了人，转身都要侧着身。" };
  if (lvl === 1) return { level: lvl, label: "平峰 · 有站位", desc: "没座位了，但过道还算宽松，扶着吊环很稳。" };
  return { level: lvl, label: "平峰 · 有座", desc: "车厢空空的，你挑了个靠门的位置坐下。" };
}
export const CARRIAGE_ANNOUNCES = [
  "列车运行前方是{station}站，开左边门，请小心列车与站台之间的空隙。",
  "下一站{station}，可换乘的乘客请提前做好准备。",
  "{station}站到了，有下车的乘客请从后门下车，先下后上。",
];

/* ================= 饭店 / 吃饭场景 ================= */
export interface Dish { name: string; cost: number; energy: number; mood: number; desc: string; }
export interface Restaurant { id: string; name: string; cuisine: string; region: string; emoji: string; cities: CityKey[]; tier: string; scene: string; tables: string; dishes: Dish[]; }
export const RESTAURANTS: Restaurant[] = [
  { id: "r-yue", name: "老广早茶楼", cuisine: "粤菜 · 早茶", region: "中餐", emoji: "🫖", cities: ["sz", "hz"], tier: "¥¥", scene: "推门就是茶香和推车声，大厅摆着圆桌和藤椅，阿婆推着点心车慢慢走，虾饺烧卖的蒸汽一笼笼冒出来。窗边能看见街景，先喝一杯普洱消消腻。", tables: "大厅圆桌 · 窗边卡座 · 二楼包间", dishes: [
    { name: "虾饺皇 + 烧卖拼盘", cost: 48, energy: 30, mood: 10, desc: "一笼四件，皮薄虾弹" }, { name: "及第粥 + 油条", cost: 26, energy: 26, mood: 6, desc: "老广的早晨体面" }, { name: "脆皮烧鹅饭", cost: 42, energy: 36, mood: 9, desc: "皮脆肉嫩，酸梅酱是灵魂" }] },
  { id: "r-chuan", name: "川味江湖火锅", cuisine: "川菜 · 火锅", region: "中餐", emoji: "🌶️", cities: ["sz", "hz"], tier: "¥¥¥", scene: "红油锅底咕嘟咕嘟冒泡，花椒香冲得人直冒汗。长条木桌、竹椅、墙上江湖字画，服务员端着毛肚鸭肠穿堂而过，拼桌的陌生人互相递纸巾。", tables: "大厅长桌 · 江湖拼桌 · 靠窗四人位", dishes: [
    { name: "红油锅底 + 毛肚拼盘", cost: 88, energy: 44, mood: 15, desc: "七上八下，辣到过瘾" }, { name: "担担面 + 红糖糍粑", cost: 32, energy: 28, mood: 8, desc: "一辣一甜，刚刚好" }, { name: "水煮鱼单人锅", cost: 56, energy: 38, mood: 11, desc: "一个人也能吃江湖菜" }] },
  { id: "r-xiang", name: "湘辣小馆", cuisine: "湘菜", region: "中餐", emoji: "🔥", cities: ["sz"], tier: "¥¥", scene: "小馆不大，灶火很旺。剁椒和茶油的香气从后厨飘出来，墙上贴着手写菜单，老板娘嗓门亮，催菜都带着笑。", tables: "小方桌 · 灶台边吧台位", dishes: [
    { name: "剁椒鱼头 + 米饭", cost: 58, energy: 40, mood: 10, desc: "鱼头泡饭能吃两碗" }, { name: "辣椒炒肉盖饭", cost: 24, energy: 32, mood: 7, desc: "打工人的下饭神器" }, { name: "毛氏红烧肉", cost: 46, energy: 38, mood: 9, desc: "肥而不腻，酱香浓" }] },
  { id: "r-bei", name: "西北面馆 · 烤肉", cuisine: "西北 / 北方菜", region: "中餐", emoji: "🍜", cities: ["sz", "hz"], tier: "¥", scene: "拉面师傅在明档里抻面，面条在案板上啪啪响。烤炉边羊肉串滋滋冒油，孜然味飘满整间店，大瓷碗粗茶，实在。", tables: "明档长桌 · 烤炉边高脚凳", dishes: [
    { name: "兰州牛肉面", cost: 18, energy: 30, mood: 6, desc: "一清二白三红四绿" }, { name: "羊肉串 ×10 + 馕", cost: 45, energy: 34, mood: 11, desc: "孜然辣椒面，趁热吃" }, { name: "大盘鸡拌面", cost: 38, energy: 42, mood: 9, desc: "土豆比鸡还入味" }] },
  { id: "r-hk", name: "港式茶餐厅", cuisine: "粤式 · 茶餐厅", region: "中餐", emoji: "🧋", cities: ["sz"], tier: "¥¥", scene: "卡座、吊扇、拼桌文化。伙计端着丝袜奶茶穿梭，墙上餐牌密密麻麻，出餐快过地铁报站——这就是香港速度在深圳的投影。", tables: "卡座拼桌 · 靠墙双人位", dishes: [
    { name: "干炒牛河 + 冻柠茶", cost: 36, energy: 34, mood: 9, desc: "镬气十足，茶餐厅标配" }, { name: "菠萝油 + 丝袜奶茶", cost: 22, energy: 22, mood: 8, desc: "冰火两重天" }, { name: "烧腊三宝饭", cost: 34, energy: 36, mood: 8, desc: "叉烧烧鹅油鸡一次满足" }] },
  { id: "r-hk-tea", name: "华记茶餐厅（上环）", cuisine: "港式 · 茶餐厅", region: "香港", emoji: "🧋", cities: ["hk"], tier: "HK$", scene: "卡座、吊扇、拼桌，伙计一只手托四杯奶茶。餐牌密密麻麻贴在墙上，出餐快过港铁报站——「唔该，一位？茶走，冻柠茶少甜！」这就是香港速度。价格按港币（HK$）。", tables: "卡座拼桌 · 靠墙双人位", dishes: [
    { name: "云吞面 + 冻柠茶", cost: 52, energy: 32, mood: 9, desc: "HK$52 · 细蓉弹牙，茶餐厅的入场券" }, { name: "菠萝油 + 丝袜奶茶", cost: 28, energy: 22, mood: 9, desc: "HK$28 · 下午茶三点三，冰火两重天" }, { name: "干炒牛河", cost: 58, energy: 36, mood: 10, desc: "HK$58 · 镬气够不够，一口就知" }] },
  { id: "r-hk-dimsum", name: "旧式点心酒楼（莲香风味）", cuisine: "粤式 · 点心", region: "香港", emoji: "🫖", cities: ["hk"], tier: "HK$", scene: "推车仔卖点心的老派酒楼：阿姐推着蒸笼车慢慢行，揭盖就是白汽。一盅两件，普洱任斟，隔篱台的阿伯在看马经——香港的早晨，就系咁叹。价格按港币（HK$）。", tables: "大厅圆台 · 靠窗卡位", dishes: [
    { name: "虾饺皇 + 烧卖（一盅两件）", cost: 58, energy: 30, mood: 12, desc: "HK$58 · 虾饺皮薄到透光，叹茶标配" }, { name: "怀旧马拉糕 + 糯米鸡", cost: 46, energy: 32, mood: 9, desc: "HK$46 · 推车点心，卖完就冇" }, { name: "及第粥 + 炸两", cost: 44, energy: 30, mood: 8, desc: "HK$44 · 老广的早晨体面，香港一样通用" }] },
  { id: "r-hk-dapaidong", name: "庙街大牌档", cuisine: "港式 · 大牌档", region: "香港", emoji: "🍺", cities: ["hk"], tier: "HK$", scene: "折叠台、塑料凳、大光灯，镬气和人声一起升起。煲仔饭的饭焦香飘过半条庙街，啤酒要用大碗饮——香港夜晚的江湖气，全在这里。价格按港币（HK$）。", tables: "街边折叠台 · 骑楼底长凳", dishes: [
    { name: "腊味煲仔饭", cost: 68, energy: 38, mood: 12, desc: "HK$68 · 揭开盖豉油浇饭焦，正" }, { name: "避风塘炒蟹（小份）", cost: 148, energy: 40, mood: 15, desc: "HK$148 · 蒜茸豆豉辣到出汗，过瘾" }, { name: "椒盐鲜鱿 + 冻咸柠七", cost: 78, energy: 30, mood: 11, desc: "HK$78 · 大牌档的夜宵仪式感" }] },
  { id: "r-west1", name: "意式披萨屋", cuisine: "意大利菜", region: "西方", emoji: "🍕", cities: ["sz", "hz"], tier: "¥¥¥", scene: "砖砌的披萨窑炉火光跳动，面团在厨师手里转成薄饼。红白格桌布、烛台、轻声的爵士乐，窗外是海湾的灯——约会和犒劳自己的地方。", tables: "窑炉吧台位 · 烛光双人桌 · 露台位", dishes: [
    { name: "玛格丽特窑烤披萨", cost: 68, energy: 36, mood: 13, desc: "现烤出炉，芝士拉丝" }, { name: "奶油蘑菇意面", cost: 52, energy: 34, mood: 11, desc: "酱汁裹满每一根面" }, { name: "提拉米苏 + 浓缩咖啡", cost: 38, energy: 16, mood: 12, desc: "苦甜收尾，仪式感拉满" }] },
  { id: "r-west2", name: "美式汉堡餐吧", cuisine: "美式 · 餐吧", region: "西方", emoji: "🍔", cities: ["sz"], tier: "¥¥", scene: "霓虹灯牌、皮沙发卡座、大屏幕放着球赛。汉堡在铁板上滋滋作响，精酿啤酒的泡沫溢出来，隔壁桌在为进球欢呼。", tables: "吧台位 · 球赛大屏卡座", dishes: [
    { name: "双层芝士汉堡套餐", cost: 58, energy: 40, mood: 12, desc: "肉饼现煎，薯条管够" }, { name: "烤猪肋排半份", cost: 78, energy: 44, mood: 13, desc: "酱香脱骨，手抓着吃" }, { name: "奶昔 + 洋葱圈", cost: 30, energy: 20, mood: 9, desc: "快乐热量炸弹" }] },
  { id: "r-west3", name: "法式小酒馆", cuisine: "法国菜", region: "西方", emoji: "🥐", cities: ["sz"], tier: "¥¥¥¥", scene: "店面小而精致，黑板手写今日菜单，法棍和黄油的香气先到。主厨是法国人，慢工出细活，一顿饭吃出一个晚上。", tables: "吧台chef位 · 安静角落桌", dishes: [
    { name: "油封鸭腿", cost: 98, energy: 38, mood: 15, desc: "皮脆肉酥，配橙汁酱" }, { name: "法式洋葱汤 + 法棍", cost: 42, energy: 24, mood: 11, desc: "芝士盖满，拉丝到天上" }, { name: "可丽饼 · 甜口", cost: 36, energy: 18, mood: 12, desc: " Nutella加草莓，趁热" }] },
  { id: "r-me1", name: "土耳其烤肉餐厅", cuisine: "土耳其 · 中东", region: "中东", emoji: "🥙", cities: ["sz"], tier: "¥¥¥", scene: "旋转烤肉架缓缓转着，师傅片肉如飞。铜盘、彩灯、地毯纹样的墙面，鹰嘴豆泥和热皮塔饼先上桌，异域香料味一路飘到门口。", tables: "烤肉架前吧台 · 家庭长桌", dishes: [
    { name: "旋转烤肉拼盘 + 皮塔饼", cost: 72, energy: 42, mood: 13, desc: "牛羊鸡三拼，卷饼吃" }, { name: "鹰嘴豆泥 + 馕饼", cost: 28, energy: 22, mood: 8, desc: "蘸着吃，越吃越香" }, { name: "土耳其红茶 + 果仁蜜饼", cost: 24, energy: 14, mood: 10, desc: "甜到心里，茶能解腻" }] },
  { id: "r-me2", name: "阿拉伯风味餐厅", cuisine: "阿拉伯菜", region: "中东", emoji: "🫓", cities: ["sz"], tier: "¥¥¥", scene: "穹顶吊灯、水烟壶摆件（只看不用）、长桌适合一大家子。手抓饭的香料层次分明，烤全羊要提前订，老板会讲每道菜的来历。", tables: "长桌包厢 · 大厅圆桌", dishes: [
    { name: "阿拉伯手抓饭", cost: 56, energy: 40, mood: 11, desc: "香料饭配烤羊肉" }, { name: "烤羊排 + 石榴酱", cost: 84, energy: 42, mood: 13, desc: "酸甜解腻，外焦里嫩" }, { name: "扁豆汤 + 沙拉拼盘", cost: 30, energy: 24, mood: 8, desc: "清爽开胃的一组" }] },
  { id: "r-sea1", name: "泰式大排档", cuisine: "泰国菜", region: "东南亚", emoji: "🍤", cities: ["sz", "hz"], tier: "¥¥", scene: "塑料凳、大圆桌、冰桶里的啤酒——曼谷街头的样子搬了过来。冬阴功的酸辣香先上桌，厨师颠勺的火光一阵一阵。", tables: "大排档圆桌 · 街边位", dishes: [
    { name: "冬阴功海鲜汤 + 香米饭", cost: 54, energy: 36, mood: 12, desc: "酸辣鲜，一口入魂" }, { name: "泰式炒河粉", cost: 34, energy: 32, mood: 9, desc: "罗望子酱，甜辣平衡" }, { name: "芒果糯米饭", cost: 26, energy: 20, mood: 11, desc: "椰浆浇头，甜品收尾" }] },
  { id: "r-sea2", name: "越南河粉店", cuisine: "越南菜", region: "东南亚", emoji: "🍲", cities: ["sz", "hz"], tier: "¥", scene: "小店清爽，牛骨汤的香气温和。九层塔和青柠摆在每桌，春卷在油锅里变成金黄，店主是越南人，河粉分量实在。", tables: "小方桌 · 靠墙长凳", dishes: [
    { name: "火车头牛肉河粉", cost: 32, energy: 32, mood: 9, desc: "汤清肉多，挤点青柠" }, { name: "鲜虾春卷 ×4", cost: 22, energy: 18, mood: 8, desc: "米纸透亮，蘸鱼露" }, { name: "越南滴漏咖啡", cost: 18, energy: 10, mood: 9, desc: "慢慢滴，慢慢等" }] },
  { id: "r-sea3", name: "日式居酒屋 · 韩式烤肉", cuisine: "日韩料理", region: "东南亚·日韩", emoji: "🍶", cities: ["sz"], tier: "¥¥¥", scene: "一边是木格居酒屋：吧台、清酒瓶墙、师傅现场捏寿司；一边是韩式烤肉区：抽油烟机嗡嗡响，五花肉在烤盘上卷边。两种热闹，一墙之隔。", tables: "寿司吧台 · 烤肉四人桌", dishes: [
    { name: "寿司拼盘 8 贯", cost: 76, energy: 30, mood: 14, desc: "现捏现吃，芥末新鲜" }, { name: "韩式五花肉套餐", cost: 68, energy: 42, mood: 13, desc: "生菜包肉蒜片青椒" }, { name: "味噌汤 + 茶碗蒸", cost: 24, energy: 18, mood: 9, desc: "暖胃的一组小品" }] },
];
export const DELIVERY_PLATFORMS = [
  { id: "meituan", name: "美团外卖", emoji: "🛵", feeMul: 1.5, note: "券最多，骑手最快，含配送费约×1.5" },
  { id: "jd", name: "京东外卖", emoji: "📦", feeMul: 1.4, note: "品质堂食店多，补贴后约×1.4" },
  { id: "taobao", name: "淘宝闪购", emoji: "⚡", feeMul: 1.45, note: "闪购频道常发红包，约×1.45" },
] as const;

/* ================= 购物场景 ================= */
export interface ShopItem { name: string; cost: number; mood: number; desc: string; }
export interface ShopVenue { id: string; name: string; kind: string; emoji: string; cities: CityKey[]; scene: string; items: ShopItem[]; }
export const SHOP_VENUES: ShopVenue[] = [
  { id: "mall-shop", name: "品牌商场", kind: "商场", emoji: "🛍️", cities: ["sz", "hz"], scene: "中庭挑高、扶梯交错，品牌店的灯光一家比一家亮。试衣间前排着队，美妆柜姐递来小样，顶楼是电影院和餐饮层——逛一下午不重样。", items: [
    { name: "换季新外套", cost: 300, mood: 20, desc: "上身就不想脱" }, { name: "运动鞋", cost: 260, mood: 14, desc: "走路带风" }, { name: "护手霜小样套装", cost: 60, mood: 8, desc: "柜姐推荐，顺手带走" }, { name: "电影票 ×1", cost: 45, mood: 12, desc: "顶楼影院，看场最新片" }] },
  { id: "dongmen", name: "东门步行街 / 老街", kind: "步行街", emoji: "🏮", cities: ["sz", "hz"], scene: "人挤人，喇叭喊着清仓价。服装批发档口、手机贴膜、糖水铺和抓娃娃机挤满两条街，砍价声和音乐声混在一起——最市井的快乐。", items: [
    { name: "砍价买的潮服", cost: 120, mood: 14, desc: "从180砍到120，老板直摇头" }, { name: "手机壳 + 贴膜", cost: 35, mood: 6, desc: "现场贴，气泡全赶走" }, { name: "抓娃娃 ×10币", cost: 20, mood: 8, desc: "抓没抓到都开心" }, { name: "批发价袜子一打", cost: 25, mood: 5, desc: "过日子的小确幸" }] },
  { id: "meituan-shop", name: "美团闪购 / 买菜", kind: "即时零售", emoji: "⚡", cities: ["sz", "hz"], scene: "不用出门：手机上下单，骑手30分钟送到。生鲜、日用、药品、鲜花都在一个列表里，深夜也能买到退烧药和泡面。", items: [
    { name: "买菜做饭包", cost: 45, mood: 7, desc: "菜肉蛋配好，自己做一顿" }, { name: "日用补货包", cost: 68, mood: 6, desc: "纸巾洗护一次买齐" }, { name: "深夜泡面 + 火腿肠", cost: 15, mood: 5, desc: "加班夜的救命粮" }, { name: "一束鲜花", cost: 39, mood: 12, desc: "送给自己也行" }] },
  { id: "online-shop", name: "网购（淘宝 / 京东）", kind: "网购", emoji: "🛒", cities: ["sz", "hz"], scene: "躺着逛完整条街：比价、看评价、凑满减，购物车加了又删。今天下单，明后天到快递柜——等包裹也是一种盼头。", items: [
    { name: "网购台灯", cost: 89, mood: 8, desc: "评价四千条才敢买" }, { name: "网购四件套", cost: 139, mood: 11, desc: "换套新的，睡眠都香了" }, { name: "凑满减囤的零食箱", cost: 99, mood: 12, desc: "拆箱快乐，谁懂" }, { name: "二手平台捡漏耳机", cost: 160, mood: 13, desc: "成色不错，省了三百" }] },
];

/* ================= 住宿场景 ================= */
export interface Lodging { id: string; name: string; kind: string; emoji: string; price: number; priceUnit: string; mood: number; scene: string; perk: string; }
export const LODGINGS: Lodging[] = [
  { id: "hotel5", name: "滨海五星酒店", kind: "酒店", emoji: "🏨", price: 680, priceUnit: "晚", mood: 24, scene: "大堂挑高、水晶灯、海景房推窗就是深圳湾。浴缸、拖鞋、欢迎水果一应俱全，前台说话轻声细语——住一晚像给自己放了个假。", perk: "过夜：能量回满，心情大涨，还送早餐" },
  { id: "hotel-b", name: "精品商务酒店", kind: "酒店", emoji: "🛎️", price: 320, priceUnit: "晚", mood: 16, scene: "干净利落的商务房，书桌、熨斗、24小时健身房。出差的人住这里，你来体验一晚体面。", perk: "过夜：能量回满，心情 +16" },
  { id: "hostel", name: "青年旅舍", kind: "青旅", emoji: "🛏️", price: 65, priceUnit: "晚", mood: 14, scene: "公共客厅有吉他、桌游和满墙的旅行照片。上下铺、帘子、公共厨房，隔壁床是骑行环岛的大学生——故事比床舒服。", perk: "过夜：便宜，能量回满，容易认识新朋友（人脉）" },
  { id: "minsu", name: "湖畔 / 海边民宿", kind: "民宿", emoji: "🏡", price: 180, priceUnit: "晚", mood: 20, scene: "老板自己养的猫在院子里晒太阳，早餐是现做的肠粉和豆浆。房间不大，但窗外就是湖/海，晚上能听见水声。", perk: "过夜：能量回满，心情 +20" },
  { id: "rent-flat", name: "长租公寓（看房签约）", kind: "租房", emoji: "🔑", price: 950, priceUnit: "周租", mood: 10, scene: "管家带你看样板间：独立卫浴、小厨房、公共洗衣房。签了约，这里就是你在城里长期的窝——周租从下周六开始按新价扣。", perk: "签约：把周租换成这间的价格，搬家换个住法" },
];
