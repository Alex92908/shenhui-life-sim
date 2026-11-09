// 工作日常：每种职业一天里真正会做的事。办公室、程序员、工厂、餐厅、商场、理发、按摩、KTV、老师、学生、
// 的士司机、外卖骑手、小老板、躺平青年……每一步按北京时间开放，花真实冷却时间，改能量 / 心情 / 钱 / 经验 / 技能 / 人脉；有的有风险。
import type { LifePose, LifeSet } from "./LifeStage";

export type RoutineRole = "office" | "coder" | "rider" | "driver" | "factory" | "waiter" | "sales" | "boss" | "teacher" | "student" | "barber" | "masseur" | "ktv" | "flat" | "guard" | "cleaner" | "courier" | "chef" | "nurse" | "agent" | "streamer" | "vendor" | "builder" | "coach" | "teller" | "pharmacist" | "stationstaff" | "netcafe" | "barista" | "nails" | "petgroomer" | "frontdesk" | "guide";
export interface RoutineStep {
  id: string; emoji: string; zh: string; en: string; sub: string; subEn: string;
  /** game minutes (real cooldown = 3 s per game minute) */
  min: number;
  energy: number; mood: number;
  /** share of a day's base pay this step earns (paid on the spot) */
  pay?: number;
  /** fixed money (negative = costs) */
  cash?: number;
  xp?: number; skill?: number; network?: number;
  /** Beijing minutes-of-day window when it makes sense */
  hours?: [number, number];
  /** how many times a day (default unlimited) */
  max?: number;
  /** counts toward a full working day (paid at clock-out) */
  core?: boolean;
  /** chance of it going wrong, and what happens then */
  risk?: { p: number; zh: string; en: string; mood: number; payCut?: number };
  /** acted on the life stage (bigger moments only) */
  scene?: { set: LifeSet; pose: LifePose; bg: string; prop: string };
}
/** where a role works: "work" = an office / company site, "any" = anywhere, or the place types it works in */
export interface RoleMeta { where: "work" | "any" | string[]; pay: "wage" | "order" | "deal" | "none"; zh: string; en: string }

const H = (h: number, m = 0) => h * 60 + m;
const CLOCKIN = (from: number, to: number): RoutineStep => ({ id: "clockin", emoji: "🪪", zh: "打卡上班", en: "Clock in", sub: "刷卡 / 打卡，迟到扣全勤", subEn: "Clock in — late loses the attendance bonus", min: 2, energy: -1, mood: 0, hours: [from, to], max: 1, core: true });
const CLOCKOUT = (from: number): RoutineStep => ({ id: "clockout", emoji: "🏁", zh: "下班", en: "Clock out", sub: "按今天完成的活结算日薪", subEn: "Paid for today by what you got done", min: 2, energy: 0, mood: 4, hours: [from, H(24)], max: 1 });
const MEAL = (zh: string, en: string, cash: number, hours: [number, number]): RoutineStep => ({ id: "meal", emoji: "🍱", zh, en, sub: "吃饱了才有力气干活", subEn: "Eat — then back to it", min: 30, energy: 16, mood: 4, cash: -cash, hours, max: 1, scene: { set: "restaurant", pose: "eat", bg: "🍱 🏮 👥", prop: "🍱" } });
const WATER: RoutineStep = { id: "water", emoji: "🥤", zh: "喝口水", en: "Drink water", sub: "灌一大口水，喘口气", subEn: "A big gulp and a breather", min: 3, energy: 2, mood: 1, max: 6 };
const TOILET: RoutineStep = { id: "toilet", emoji: "🚻", zh: "上厕所", en: "Bathroom break", sub: "顺便刷两分钟手机", subEn: "Two minutes of phone while you're there", min: 6, energy: 1, mood: 3, max: 4 };

const OFFICE: RoutineStep[] = [
  { ...CLOCKIN(H(7), H(11)), zh: "打卡签到", sub: "刷工牌进门，九点半以后算迟到", subEn: "Badge in — after 9:30 counts as late" },
  { id: "standup", emoji: "🗣️", zh: "开早会", en: "Morning meeting", sub: "领导讲今天的重点，你点头记笔记", subEn: "The boss runs through today's priorities", min: 25, energy: -3, mood: -2, xp: 1, hours: [H(8, 30), H(11, 30)], max: 1, core: true, scene: { set: "office", pose: "idle", bg: "🏢 📋 👥", prop: "🗣️" } },
  { id: "type", emoji: "⌨️", zh: "打字干活", en: "Heads-down work", sub: "做表、写方案、回邮件，键盘噼里啪啦", subEn: "Spreadsheets, proposals, email", min: 60, energy: -6, mood: -1, pay: 0.1, xp: 1, hours: [H(8), H(21)], max: 4, core: true, scene: { set: "office", pose: "type", bg: "🏢 💻 📊", prop: "⌨️" } },
  { id: "discuss", emoji: "💬", zh: "讨论需求", en: "Discussion", sub: "会议室里拉上几个人，白板写满", subEn: "A few people, one whiteboard, many opinions", min: 30, energy: -4, mood: 1, xp: 1, network: 1, hours: [H(9), H(19)], max: 2, scene: { set: "office", pose: "idle", bg: "🏢 🧑‍🤝‍🧑 🖊️", prop: "💬" } },
  { ...WATER, zh: "接杯水", en: "Get water", sub: "茶水间接杯水，顺便和同事聊两句", subEn: "Pantry chat by the water dispenser", min: 4 },
  { ...TOILET, zh: "上厕所（带薪）", en: "Bathroom break (paid)", min: 8 },
  { id: "slack", emoji: "📱", zh: "摸鱼刷手机", en: "Slack off", sub: "假装看文档，其实在刷短视频", subEn: "Pretending to read docs, actually scrolling", min: 15, energy: 2, mood: 6, max: 3, risk: { p: 0.18, zh: "被领导路过看见了，记了一笔，绩效扣分", en: "The boss walked past and noticed — performance marked down", mood: -10, payCut: 0.1 } },
  MEAL("吃午饭", "Lunch", 25, [H(11, 20), H(14)]),
  { id: "nap", emoji: "😴", zh: "午睡", en: "Nap", sub: "趴在工位上眯二十分钟", subEn: "Twenty minutes face-down on the desk", min: 25, energy: 12, mood: 3, hours: [H(12), H(14, 30)], max: 1, scene: { set: "office", pose: "sleep", bg: "🏢 💤 🌤️", prop: "😴" } },
  { id: "report", emoji: "📊", zh: "做汇报", en: "Present", sub: "对着领导和投影讲你的方案，讲好了加分", subEn: "Present your plan to the boss — do it well and it counts", min: 40, energy: -8, mood: 0, xp: 3, pay: 0.15, hours: [H(10), H(19)], max: 1, core: true, risk: { p: 0.35, zh: "讲到一半卡壳，领导皱眉：回去再改改", en: "You froze halfway; the boss frowned: “rework it”", mood: -8, payCut: 0.15 }, scene: { set: "office", pose: "idle", bg: "🏢 📽️ 👔", prop: "📊" } },
  CLOCKOUT(H(17, 30)),
];

const CODER: RoutineStep[] = OFFICE.map((s) => {
  if (s.id === "standup") return { ...s, zh: "站会", en: "Stand-up", sub: "每人三句话：昨天做了啥、今天做啥、卡在哪", subEn: "Yesterday, today, blockers — three lines each" };
  if (s.id === "type") return { ...s, zh: "写代码", en: "Write code", sub: "需求一个一个被推平，提交记录越堆越高", subEn: "Tickets falling one by one", energy: -7, pay: 0.12, skill: 0 };
  if (s.id === "discuss") return { ...s, zh: "改 bug", en: "Fix a bug", sub: "测试提了个单，复现、定位、修掉", subEn: "Reproduce, find, fix", mood: -2 };
  if (s.id === "report") return { ...s, zh: "代码评审", en: "Code review", sub: "同事一行一行看你的改动", subEn: "Teammates go through your change line by line", risk: { p: 0.3, zh: "评审被打回：命名不规范、没写测试", en: "Review rejected: naming, no tests", mood: -6, payCut: 0.1 } };
  return s;
}).concat([
  { id: "deploy", emoji: "🚀", zh: "上线发布", en: "Deploy", sub: "按下发布按钮，盯着监控曲线", subEn: "Hit deploy, watch the dashboards", min: 30, energy: -6, mood: 4, xp: 2, pay: 0.15, hours: [H(14), H(23)], max: 1, risk: { p: 0.15, zh: "线上出事故了！回滚、复盘、写检讨", en: "Production incident! Roll back, post-mortem", mood: -14, payCut: 0.15 }, scene: { set: "office", pose: "type", bg: "🏢 🖥️ 📈", prop: "🚀" } },
]);

const FACTORY: RoutineStep[] = [
  { ...CLOCKIN(H(7), H(8, 30)), zh: "打卡进厂", sub: "刷脸进厂区，八点准时开线", subEn: "Face-scan in; the line starts at eight sharp" },
  { id: "gear", emoji: "🥼", zh: "换工衣、戴手套", en: "Gear up", sub: "防静电服、手套、帽子，一样都不能少", subEn: "Anti-static coat, gloves, cap", min: 8, energy: -1, mood: 0, max: 1, core: true },
  { id: "screw", emoji: "🔩", zh: "流水线打螺丝", en: "Screw on the line", sub: "一块板四颗螺丝，跟着线速一刻不停", subEn: "Four screws a board, keeping up with the line", min: 60, energy: -7, mood: -2, pay: 0.11, xp: 1, hours: [H(8), H(20)], max: 4, core: true, scene: { set: "office", pose: "type", bg: "🏭 🔩 ⚙️", prop: "🔩" } },
  { id: "qc", emoji: "🔍", zh: "质检", en: "Quality check", sub: "抽检产品，不合格的挑出来", subEn: "Spot-check the batch, pull the rejects", min: 30, energy: -3, mood: 0, xp: 1, hours: [H(9), H(20)], max: 2, core: true, risk: { p: 0.2, zh: "整批返工！组长黑着脸让大家加班补", en: "Whole batch sent back! The team lead wants it redone", mood: -8, payCut: 0.1 } },
  { id: "handover", emoji: "🤝", zh: "交接班", en: "Shift handover", sub: "跟夜班交代进度和设备状况", subEn: "Brief the night shift on progress and machines", min: 10, energy: -1, mood: 1, network: 1, hours: [H(17), H(21)], max: 1 },
  WATER, TOILET,
  MEAL("食堂午饭", "Canteen lunch", 12, [H(11, 30), H(13)]),
  { id: "nap", emoji: "😴", zh: "宿舍午休", en: "Dorm nap", sub: "回宿舍躺二十分钟，下午接着干", subEn: "Twenty minutes in the dorm", min: 25, energy: 12, mood: 3, hours: [H(12), H(13, 30)], max: 1 },
  { id: "ot", emoji: "🌙", zh: "晚上加班", en: "Evening overtime", sub: "订单急，加班费一点五倍", subEn: "Rush order — time and a half", min: 120, energy: -14, mood: -5, pay: 0.35, hours: [H(18), H(23)], max: 1 },
  CLOCKOUT(H(17)),
];

const WAITER: RoutineStep[] = [
  { ...CLOCKIN(H(9, 30), H(11)), zh: "上班打卡", sub: "换上工服，开早会讲今日特价", subEn: "Uniform on, today's specials at the briefing" },
  { id: "prep", emoji: "🧺", zh: "摆台备餐", en: "Set the tables", sub: "擦桌、摆碗筷、加好调料", subEn: "Wipe, set, refill the condiments", min: 20, energy: -3, mood: 0, max: 1, core: true },
  { id: "order", emoji: "📝", zh: "迎客点单", en: "Greet & take orders", sub: "带位、递菜单、推荐招牌菜", subEn: "Seat them, menus, push the signature dish", min: 30, energy: -4, mood: 1, pay: 0.08, xp: 1, hours: [H(10, 30), H(22)], max: 4, core: true },
  { id: "serve", emoji: "🍲", zh: "上菜收桌", en: "Serve & clear", sub: "托盘一次端四道菜，收桌翻台", subEn: "Four plates a tray, clear and turn the table", min: 30, energy: -5, mood: 0, pay: 0.08, hours: [H(10, 30), H(22)], max: 4, core: true, risk: { p: 0.12, zh: "客人投诉菜上错了，被经理说了一顿", en: "A customer complained about a wrong dish — the manager had words", mood: -8, payCut: 0.05 }, scene: { set: "restaurant", pose: "walk", bg: "🍲 🍽️ 👥", prop: "🍲" } },
  { id: "rush", emoji: "🔥", zh: "扛高峰", en: "Work the rush", sub: "满座、排队、催单，一口气跑两小时", subEn: "Full house, a queue, two hours non-stop", min: 90, energy: -12, mood: -3, pay: 0.2, hours: [H(11, 30), H(13, 30)], max: 1 },
  { id: "rush2", emoji: "🌆", zh: "晚市高峰", en: "Dinner rush", sub: "下班的人一波接一波", subEn: "Wave after wave of office crowds", min: 90, energy: -12, mood: -3, pay: 0.2, hours: [H(17, 30), H(20, 30)], max: 1 },
  MEAL("员工餐", "Staff meal", 0, [H(14), H(17)]),
  WATER, TOILET,
  CLOCKOUT(H(20)),
];

const SALES: RoutineStep[] = [
  { ...CLOCKIN(H(9, 30), H(10, 30)), zh: "上班打卡", sub: "开店前整理仪容，十点开门迎客", subEn: "Tidy up before the ten o'clock opening" },
  { id: "shelf", emoji: "🧥", zh: "整理货架", en: "Stock the shelves", sub: "新款上架，尺码排好", subEn: "New arrivals out, sizes in order", min: 25, energy: -3, mood: 0, max: 2, core: true },
  { id: "serve", emoji: "🛍️", zh: "接待顾客", en: "Help customers", sub: "推荐、试穿、开单——成交有提成", subEn: "Recommend, fit, ring up — commission on sales", min: 40, energy: -4, mood: 1, pay: 0.1, xp: 1, network: 1, hours: [H(10), H(22)], max: 4, core: true, risk: { p: 0.3, zh: "试了半天没买，白忙一场", en: "An hour of fittings, no sale", mood: -4, payCut: 0 } },
  { id: "live", emoji: "📹", zh: "门店直播", en: "Store livestream", sub: "对着手机讲新品，弹幕刷起来", subEn: "Show the new line to the camera", min: 45, energy: -5, mood: 2, pay: 0.12, xp: 1, hours: [H(19), H(22)], max: 1 },
  { id: "count", emoji: "📦", zh: "盘点库存", en: "Stock count", sub: "对账、点数，差一件都要查", subEn: "Count everything; one missing item means a search", min: 30, energy: -3, mood: -1, hours: [H(20), H(23)], max: 1, core: true },
  MEAL("商场美食城午饭", "Food-court lunch", 25, [H(11, 30), H(14, 30)]),
  { id: "slack", emoji: "📱", zh: "没客人时摸鱼", en: "Slack off", sub: "躲在试衣间后面刷手机", subEn: "Phone behind the fitting rooms", min: 15, energy: 2, mood: 5, max: 3, risk: { p: 0.2, zh: "店长巡店撞见了", en: "The store manager caught you", mood: -8, payCut: 0.1 } },
  WATER, TOILET,
  CLOCKOUT(H(21)),
];

const BARBER: RoutineStep[] = [
  { ...CLOCKIN(H(9, 30), H(11)), zh: "开店打卡", sub: "消毒剪刀、热毛巾，准备开工", subEn: "Disinfect the scissors, warm towels" },
  { id: "cut", emoji: "✂️", zh: "剪发", en: "Haircut", sub: "听客人说「稍微修一下」，然后认真修", subEn: "“Just a trim”, done properly", min: 40, energy: -4, mood: 1, pay: 0.1, xp: 1, hours: [H(10), H(22)], max: 5, core: true, scene: { set: "mall", pose: "idle", bg: "💈 ✂️ 🪞", prop: "✂️" } },
  { id: "perm", emoji: "🌀", zh: "烫染", en: "Perm & colour", sub: "上药水、等时间、冲洗吹干，一单顶三单", subEn: "Chemicals, waiting, rinse — worth three cuts", min: 120, energy: -8, mood: 0, pay: 0.35, xp: 2, hours: [H(10), H(20)], max: 1, core: true, risk: { p: 0.15, zh: "颜色没达到客人预期，免费返工", en: "The colour wasn't what she wanted — free redo", mood: -10, payCut: 0.15 } },
  { id: "card", emoji: "💳", zh: "推销会员卡", en: "Sell a membership", sub: "「办卡今天打七折哦」", subEn: "“30% off if you join today”", min: 10, energy: -1, mood: 0, pay: 0.08, network: 1, max: 2, risk: { p: 0.5, zh: "客人摆手：不用了谢谢", en: "“No thanks”", mood: -2, payCut: 0 } },
  { id: "sweep", emoji: "🧹", zh: "扫碎发", en: "Sweep up", sub: "一天下来地上全是头发", subEn: "Hair everywhere by evening", min: 10, energy: -1, mood: 0, max: 3 },
  MEAL("店里扒口饭", "Quick lunch in the shop", 18, [H(12), H(15)]),
  WATER, TOILET,
  CLOCKOUT(H(20)),
];

const MASSEUR: RoutineStep[] = [
  { ...CLOCKIN(H(12), H(14)), zh: "上钟打卡", sub: "午后开工，一直做到深夜", subEn: "Starts after lunch, runs late" },
  { id: "foot", emoji: "🦶", zh: "足疗", en: "Foot massage", sub: "泡脚、按穴位，客人舒服得睡着了", subEn: "Soak and pressure points — the client dozes off", min: 60, energy: -6, mood: 0, pay: 0.12, xp: 1, hours: [H(12), H(24)], max: 4, core: true, scene: { set: "home", pose: "sit", bg: "🛋️ 🦶 🕯️", prop: "🦶" } },
  { id: "back", emoji: "💆", zh: "推拿", en: "Back massage", sub: "肩颈腰背，上班族的僵硬全在这里", subEn: "Neck and back — every office knot", min: 60, energy: -8, mood: 0, pay: 0.14, xp: 1, hours: [H(12), H(24)], max: 3, core: true },
  { id: "tip", emoji: "🧧", zh: "老客点钟", en: "A regular asks for you", sub: "熟客专门点你，还给了小费", subEn: "A regular books you by name — and tips", min: 60, energy: -6, mood: 4, pay: 0.2, network: 1, hours: [H(18), H(24)], max: 1, risk: { p: 0.4, zh: "老客今天没来", en: "Your regular didn't show today", mood: -2, payCut: 0 } },
  MEAL("员工餐", "Staff meal", 0, [H(17), H(19, 30)]),
  { id: "rest", emoji: "🧘", zh: "休息拉伸", en: "Stretch your hands", sub: "按了一整天，手指和手腕都要歇", subEn: "Fingers and wrists need a break", min: 15, energy: 6, mood: 2, max: 3 },
  WATER, TOILET,
  CLOCKOUT(H(22)),
];

const KTV: RoutineStep[] = [
  { ...CLOCKIN(H(17, 30), H(19, 30)), zh: "晚班打卡", sub: "换上工服，检查包厢话筒和点歌屏", subEn: "Uniform on, test the mics and song screens" },
  { id: "room", emoji: "🎤", zh: "包厢服务", en: "Look after a room", sub: "开房、送果盘、调音响、帮客人点歌", subEn: "Open up, fruit plates, sound, song requests", min: 45, energy: -5, mood: 1, pay: 0.12, xp: 1, hours: [H(18), H(24)], max: 4, core: true, scene: { set: "club", pose: "idle", bg: "🎤 🪩 🎶", prop: "🎤" } },
  { id: "sing", emoji: "🎶", zh: "陪唱暖场", en: "Warm up the room", sub: "客人不好意思开口，你先唱一首", subEn: "Shy guests — you sing the first song", min: 20, energy: -3, mood: 4, pay: 0.06, network: 1, hours: [H(19), H(24)], max: 3 },
  { id: "upsell", emoji: "🍻", zh: "推酒水套餐", en: "Upsell drinks", sub: "「再加一打啤酒送果盘哦」——有提成", subEn: "“A dozen more beers comes with fruit” — commission", min: 10, energy: -1, mood: 0, pay: 0.1, max: 3, risk: { p: 0.45, zh: "客人说喝够了", en: "They've had enough", mood: -1, payCut: 0 } },
  { id: "tips", emoji: "🧧", zh: "客人给小费", en: "Tips", sub: "唱嗨了的客人塞了个红包", subEn: "A happy room hands you a red packet", min: 5, energy: 0, mood: 5, pay: 0.15, hours: [H(21), H(24)], max: 1, risk: { p: 0.6, zh: "今晚的客人都很普通", en: "A quiet night — no tips", mood: 0, payCut: 0 } },
  { id: "clean", emoji: "🧽", zh: "收拾包厢", en: "Clean the rooms", sub: "满桌的空瓶和瓜子壳", subEn: "Empty bottles and seed shells everywhere", min: 20, energy: -4, mood: -1, max: 3, core: true },
  MEAL("夜宵", "Late-night snack", 15, [H(21, 30), H(24)]),
  WATER, TOILET,
  CLOCKOUT(H(23)), // the game day turns over at midnight, so the shift settles before it
];

const TEACHER: RoutineStep[] = [
  { ...CLOCKIN(H(7), H(8)), zh: "到校签到", sub: "七点半前到校，带早读", subEn: "In by 7:30 for morning reading" },
  { id: "reading", emoji: "📖", zh: "带早读", en: "Morning reading", sub: "教室里书声琅琅", subEn: "A classroom reading aloud", min: 30, energy: -3, mood: 2, hours: [H(7, 30), H(8, 30)], max: 1, core: true },
  { id: "lesson", emoji: "🧑‍🏫", zh: "上课", en: "Teach a lesson", sub: "四十五分钟，讲到台下眼睛亮起来", subEn: "Forty-five minutes until the eyes light up", min: 45, energy: -6, mood: 2, pay: 0.12, xp: 1, hours: [H(8), H(17, 30)], max: 4, core: true, scene: { set: "classroom", pose: "idle", bg: "🏫 📚 ✏️", prop: "🧑‍🏫" } },
  { id: "mark", emoji: "📝", zh: "批改作业", en: "Mark homework", sub: "一摞作业本，红笔写到手酸", subEn: "A stack of exercise books and a red pen", min: 45, energy: -4, mood: -2, xp: 1, max: 2, core: true },
  { id: "meeting", emoji: "🗂️", zh: "教研会", en: "Teaching meeting", sub: "集体备课，讨论月考", subEn: "Plan lessons together, discuss the monthly exam", min: 40, energy: -3, mood: -1, xp: 1, network: 1, hours: [H(14), H(17)], max: 1 },
  { id: "qa", emoji: "🙋", zh: "课后答疑", en: "After-class questions", sub: "学生围着讲台问问题", subEn: "Students crowd the desk with questions", min: 30, energy: -3, mood: 4, network: 1, hours: [H(16), H(18, 30)], max: 1 },
  { id: "plan", emoji: "🗒️", zh: "写教案", en: "Write lesson plans", sub: "明天的课今晚备好", subEn: "Tomorrow's lessons, prepared tonight", min: 40, energy: -3, mood: 0, skill: 1, hours: [H(18), H(23)], max: 1 },
  MEAL("教工食堂", "Staff canteen", 12, [H(11, 40), H(13)]),
  { id: "nap", emoji: "😴", zh: "午休", en: "Nap", sub: "办公室沙发上眯一会儿", subEn: "A short nap on the office sofa", min: 25, energy: 12, mood: 3, hours: [H(12, 30), H(14)], max: 1 },
  WATER,
  CLOCKOUT(H(17)),
];

const STUDENT: RoutineStep[] = [
  { id: "reading", emoji: "📖", zh: "早读", en: "Morning reading", sub: "背单词、背课文", subEn: "Vocabulary and set texts", min: 30, energy: -2, mood: 0, skill: 0, xp: 1, hours: [H(7), H(9)], max: 1 },
  { id: "class", emoji: "🎒", zh: "上课", en: "Go to class", sub: "坐前排认真听，偶尔偷偷看手机", subEn: "Front row, mostly listening", min: 45, energy: -4, mood: -1, xp: 1, hours: [H(8), H(17, 30)], max: 4, scene: { set: "classroom", pose: "sit", bg: "🏫 📚 ✏️", prop: "🎒" } },
  { id: "study", emoji: "📚", zh: "图书馆自习", en: "Self-study", sub: "抢到靠窗的位置，刷两套题", subEn: "Window seat, two practice papers", min: 60, energy: -5, mood: -1, skill: 1, xp: 1, hours: [H(8), H(22, 30)], max: 2 },
  { id: "exam", emoji: "🧾", zh: "小测验", en: "Quiz", sub: "临时抱佛脚的时候到了", subEn: "Time to see what stuck", min: 45, energy: -6, mood: 3, skill: 1, xp: 2, hours: [H(9), H(17)], max: 1, risk: { p: 0.3, zh: "考砸了，晚上得重新复习", en: "Flunked it — revision tonight", mood: -10, payCut: 0 } },
  { id: "club", emoji: "🎸", zh: "社团活动", en: "Club activity", sub: "吉他社、篮球队、辩论队，交到新朋友", subEn: "Guitar, basketball, debate — new friends", min: 60, energy: -4, mood: 8, network: 1, hours: [H(16), H(22)], max: 1 },
  { id: "parttime", emoji: "🧋", zh: "课余兼职", en: "Part-time job", sub: "奶茶店打工，攒点生活费", subEn: "Bubble-tea shop shift for pocket money", min: 120, energy: -8, mood: -1, pay: 0.6, hours: [H(17), H(22)], max: 1 },
  MEAL("食堂", "Canteen", 10, [H(11, 30), H(13, 30)]),
  { id: "nap", emoji: "😴", zh: "宿舍午睡", en: "Dorm nap", sub: "下午第一节课前补个觉", subEn: "Sleep before the first afternoon class", min: 30, energy: 14, mood: 3, hours: [H(12, 30), H(14)], max: 1 },
  WATER,
];

const FLAT: RoutineStep[] = [
  { id: "sleepin", emoji: "🛌", zh: "睡到自然醒", en: "Sleep in", sub: "闹钟？不存在的", subEn: "Alarm? What alarm?", min: 60, energy: 14, mood: 6, hours: [H(7), H(12)], max: 1 },
  { id: "scroll", emoji: "📱", zh: "刷短视频", en: "Scroll videos", sub: "一刷就是一个小时", subEn: "An hour gone, just like that", min: 30, energy: 1, mood: 4, max: 3, risk: { p: 0.2, zh: "刷到同学升职买房，有点焦虑", en: "Saw a classmate's promotion and new flat — a bit anxious", mood: -6, payCut: 0 } },
  { id: "takeaway", emoji: "🥡", zh: "点外卖", en: "Order takeaway", sub: "满减凑单，躺着等骑手敲门", subEn: "Hunt the discounts, wait for the knock", min: 25, energy: 16, mood: 5, cash: -28, max: 2 },
  { id: "sea", emoji: "🌊", zh: "海边发呆", en: "Gaze at the sea", sub: "什么都不想，看浪一阵一阵", subEn: "Thinking of nothing, wave after wave", min: 40, energy: 4, mood: 10, max: 1 },
  { id: "game", emoji: "🎮", zh: "打游戏", en: "Play games", sub: "开黑到深夜", subEn: "Team games into the night", min: 60, energy: -2, mood: 8, network: 1, hours: [H(14), H(27)], max: 2 },
  { id: "walk", emoji: "🚶", zh: "楼下散步", en: "Walk downstairs", sub: "绕小区走两圈，算是运动了", subEn: "Two laps of the block counts as exercise", min: 20, energy: -1, mood: 4, max: 2 },
  { id: "gig", emoji: "🧰", zh: "接点零活", en: "Odd job", sub: "帮人搬家、发传单，赚点房租", subEn: "Help with a move, hand out flyers — rent money", min: 90, energy: -8, mood: -1, pay: 0.6, xp: 1, hours: [H(9), H(20)], max: 1 },
];

const BOSS: RoutineStep[] = [
  { id: "pep", emoji: "📣", zh: "早会训话", en: "Morning pep talk", sub: "给团队定目标、打鸡血", subEn: "Set targets, fire up the team", min: 20, energy: -2, mood: 1, network: 1, hours: [H(8, 30), H(11)], max: 1 },
  { id: "deal", emoji: "🤝", zh: "见客户谈合作", en: "Meet a client", sub: "谈下来就是一大单", subEn: "Land it and it's a big contract", min: 90, energy: -8, mood: 2, pay: 1.2, xp: 2, network: 2, hours: [H(9), H(19)], max: 2, risk: { p: 0.45, zh: "客户说再考虑考虑——黄了", en: "“We'll think about it” — it fell through", mood: -10, payCut: 0 }, scene: { set: "office", pose: "idle", bg: "🏢 🤝 📄", prop: "🤝" } },
  { id: "report", emoji: "📈", zh: "看报表", en: "Read the numbers", sub: "现金流、利润、应收账款", subEn: "Cash flow, margin, receivables", min: 40, energy: -3, mood: -2, skill: 1, max: 1 },
  { id: "dinner", emoji: "🥂", zh: "应酬喝酒", en: "Client dinner", sub: "酒桌上谈的才是真生意", subEn: "The real business happens over drinks", min: 120, energy: -10, mood: 0, network: 3, cash: -400, hours: [H(18), H(24)], max: 1, risk: { p: 0.35, zh: "喝多了，明天要头疼", en: "Too much — tomorrow will hurt", mood: -6, payCut: 0 } },
  { id: "payroll", emoji: "💸", zh: "发工资", en: "Pay the staff", sub: "每月最心疼的一天", subEn: "The most painful day of the month", min: 15, energy: -1, mood: -6, cash: -1500, network: 2, max: 1 },
  { id: "golf", emoji: "⛳", zh: "打高尔夫", en: "Golf", sub: "球场也是谈生意的地方", subEn: "The course is a meeting room too", min: 180, energy: -6, mood: 8, network: 2, cash: -600, hours: [H(7), H(17)], max: 1 },
  MEAL("商务午餐", "Business lunch", 120, [H(11, 30), H(14)]),
];

/* the rider and the taxi driver run orders (grab → pick up → deliver / drive → hand over) */
const RIDER: RoutineStep[] = [
  { id: "online", emoji: "🟢", zh: "上线开工", en: "Go online", sub: "打开骑手 App，戴好头盔，电量满格", subEn: "Open the rider app, helmet on, battery full", min: 2, energy: 0, mood: 1, hours: [H(6), H(24)], max: 1 },
  { id: "grab", emoji: "⚡", zh: "抢单", en: "Grab an order", sub: "单子一弹出来就点——手慢就被别人抢了", subEn: "Tap the moment it pops up — slow hands lose it", min: 2, energy: -1, mood: 0, hours: [H(6), H(24)] },
  { id: "wait", emoji: "⏳", zh: "等餐", en: "Wait for the food", sub: "商家出餐慢，站在门口干着急", subEn: "Kitchen's slow; you wait at the counter", min: 10, energy: -1, mood: -2 },
  { id: "climb", emoji: "🪜", zh: "爬楼", en: "Climb the stairs", sub: "老小区没电梯，拎着外卖一口气爬上七楼", subEn: "No lift — seven floors with the bag", min: 5, energy: -6, mood: -1 },
  { id: "handover", emoji: "📦", zh: "送达", en: "Hand over", sub: "敲门、递餐、说句「祝您用餐愉快」，点送达", subEn: "Knock, hand over, “enjoy your meal”, tap delivered", min: 2, energy: 0, mood: 2 },
  { id: "battery", emoji: "🔋", zh: "换电池", en: "Swap battery", sub: "换电柜扫码，三十秒满电出发", subEn: "Scan the swap cabinet, thirty seconds, full", min: 4, energy: 0, mood: 1, cash: -6, max: 3 },
  { id: "eat", emoji: "🍜", zh: "路边扒口饭", en: "Quick meal", sub: "高峰前后抓紧吃一碗，边吃边看单", subEn: "Wolf down a bowl between rushes", min: 15, energy: 15, mood: 3, cash: -15, max: 2, scene: { set: "restaurant", pose: "eat", bg: "🍜 🛵 🏮", prop: "🍜" } },
  { ...TOILET, zh: "找厕所", en: "Find a toilet", sub: "商场、加油站、公园——骑手的地图上都标着厕所", subEn: "Malls, petrol stations, parks — riders know them all" },
  WATER,
];
const DRIVER: RoutineStep[] = [
  { id: "online", emoji: "🟢", zh: "出车", en: "Start the shift", sub: "检查车况，打开顶灯，等乘客招手", subEn: "Check the car, light on, watch for a wave", min: 3, energy: 0, mood: 1, hours: [H(5), H(26)], max: 1 },
  { id: "grab", emoji: "📲", zh: "接单 / 扬招", en: "Take a fare", sub: "叫车 App 来单，或者路边有人招手", subEn: "An app booking, or someone waving at the kerb", min: 2, energy: -1, mood: 0, hours: [H(5), H(26)] },
  { id: "wait", emoji: "🧳", zh: "接上乘客", en: "Pick up the passenger", sub: "帮忙放行李，问清楚去哪", subEn: "Help with the bags, confirm the destination", min: 4, energy: -1, mood: 0 },
  { id: "handover", emoji: "💵", zh: "到达收款", en: "Drop off & collect", sub: "打表结账，祝您一路顺风", subEn: "Meter fare, have a good day", min: 2, energy: 0, mood: 2 },
  { id: "fuel", emoji: "⛽", zh: "加气 / 充电", en: "Refuel / charge", sub: "排队加气，顺便买瓶水", subEn: "Queue for gas, grab a drink", min: 15, energy: 1, mood: 0, cash: -60, max: 2 },
  { id: "shift", emoji: "🔁", zh: "交班", en: "Hand over the car", sub: "跟夜班司机交车，算份子钱", subEn: "Hand the car to the night driver, settle the fee", min: 10, energy: 0, mood: 1, cash: -120, hours: [H(16), H(19)], max: 1 },
  { id: "eat", emoji: "🍜", zh: "路边快餐", en: "Roadside meal", sub: "的士司机最懂哪里便宜又好吃", subEn: "Cabbies know the cheap good spots", min: 20, energy: 15, mood: 3, cash: -20, max: 2 },
  { ...TOILET, zh: "找厕所", en: "Find a toilet" },
  WATER,
];

/* ---- more trades: the people who keep the city running ---- */
const GUARD: RoutineStep[] = [
  { ...CLOCKIN(H(7), H(9)), zh: "接班打卡", sub: "换上制服，跟夜班交接对讲机", subEn: "Uniform on, take the radio from the night shift" },
  { id: "gate", emoji: "🚧", zh: "站岗登记", en: "Gate duty", sub: "外卖快递一律登记，车辆抬杆放行", subEn: "Sign in every courier, lift the barrier for cars", min: 60, energy: -4, mood: -1, pay: 0.1, xp: 1, hours: [H(7), H(19)], max: 4, core: true, scene: { set: "station", pose: "idle", bg: "🚧 🏢 🚗", prop: "📋" } },
  { id: "patrol", emoji: "🔦", zh: "巡逻", en: "Patrol", sub: "楼上楼下转一圈，消防通道别堆杂物", subEn: "Walk every floor; keep the fire exits clear", min: 40, energy: -5, mood: 1, pay: 0.08, hours: [H(8), H(19)], max: 3, core: true },
  { id: "cctv", emoji: "📺", zh: "看监控", en: "Watch the CCTV", sub: "盯着十六宫格屏幕，眼皮打架", subEn: "Sixteen screens and heavy eyelids", min: 45, energy: 2, mood: -1, pay: 0.06, max: 2, risk: { p: 0.15, zh: "打了个盹被主管抓到，扣钱", en: "Dozed off — the supervisor saw. Fined", mood: -5, payCut: 0.1 } },
  { id: "help", emoji: "📦", zh: "帮业主搬东西", en: "Help a resident", sub: "帮阿姨把米扛上楼，人家塞了瓶水", subEn: "Carry a sack of rice upstairs; she hands you a drink", min: 15, energy: -3, mood: 4, network: 1, max: 2 },
  MEAL("食堂盒饭", "Canteen box lunch", 12, [H(11, 30), H(13, 30)]),
  WATER, TOILET,
  CLOCKOUT(H(19)),
];
const CLEANER: RoutineStep[] = [
  { ...CLOCKIN(H(6), H(8)), zh: "清早打卡", sub: "天没亮就到，推上保洁车", subEn: "Before sunrise, push out the cart" },
  { id: "mop", emoji: "🧽", zh: "拖地", en: "Mop the floors", sub: "大堂、走廊、电梯间，一遍又一遍", subEn: "Lobby, corridors, lift halls — again and again", min: 50, energy: -5, mood: 0, pay: 0.1, xp: 1, hours: [H(6), H(18)], max: 4, core: true, scene: { set: "mall", pose: "idle", bg: "🧽 🪣 ✨", prop: "🪣" } },
  { id: "loo", emoji: "🚽", zh: "清洁卫生间", en: "Clean the toilets", sub: "最累的活，也最被人看见", subEn: "The hardest job, and the most noticed", min: 30, energy: -5, mood: -2, pay: 0.1, hours: [H(7), H(18)], max: 3, core: true },
  { id: "bins", emoji: "🗑️", zh: "倒垃圾分类", en: "Sort the rubbish", sub: "干湿分开，纸箱攒起来还能卖钱", subEn: "Wet and dry apart — cardboard sells", min: 25, energy: -3, mood: 1, pay: 0.06, cash: 8, max: 2 },
  { id: "glass", emoji: "🪟", zh: "擦玻璃", en: "Clean the glass", sub: "旋转门和落地窗，指纹永远擦不完", subEn: "Revolving doors and windows, endless fingerprints", min: 40, energy: -4, mood: 0, pay: 0.08, max: 1, core: true },
  MEAL("自带饭盒", "Packed lunch", 0, [H(11), H(13)]),
  { id: "sit", emoji: "🪑", zh: "楼梯间歇脚", en: "Rest in the stairwell", sub: "坐在台阶上，捶捶腰", subEn: "Sit on the steps, rub your back", min: 15, energy: 6, mood: 2, max: 2 },
  WATER, TOILET,
  CLOCKOUT(H(16)),
];
const COURIER: RoutineStep[] = [
  { ...CLOCKIN(H(7), H(9)), zh: "网点分拣", sub: "传送带上几百个包裹，按片区扫码上车", subEn: "Hundreds of parcels off the belt, scan and load by area", min: 40, energy: -5 },
  { id: "drop", emoji: "📦", zh: "派件", en: "Deliver parcels", sub: "一栋楼一栋楼送，打电话：「快递放驿站可以吗？」", subEn: "Building by building — “Can I leave it at the locker?”", min: 50, energy: -6, mood: 0, pay: 0.11, xp: 1, hours: [H(8), H(20)], max: 5, core: true, scene: { set: "station", pose: "walk", bg: "📦 🏘️ 🛵", prop: "📦" } },
  { id: "stairs", emoji: "🪜", zh: "爬楼送大件", en: "Haul a big one upstairs", sub: "没电梯的七楼，一台洗衣机", subEn: "Seventh floor, no lift, one washing machine", min: 25, energy: -8, mood: -2, pay: 0.08, max: 1, core: true },
  { id: "pickup", emoji: "📮", zh: "上门揽件", en: "Collect a return", sub: "退货揽件有提成", subEn: "Returns pay a commission", min: 20, energy: -2, mood: 0, pay: 0.05, max: 2, risk: { p: 0.25, zh: "客户不在家，白跑一趟", en: "Nobody home — wasted trip", mood: -3, payCut: 0 } },
  MEAL("路边快餐", "Roadside fast food", 18, [H(11), H(14)]),
  { id: "complaint", emoji: "📞", zh: "处理投诉", en: "Handle a complaint", sub: "「我的快递怎么显示签收了？」", subEn: "“Why does it say delivered?”", min: 15, energy: -2, mood: -4, max: 1 },
  WATER, TOILET,
  CLOCKOUT(H(19)),
];
const CHEF: RoutineStep[] = [
  { ...CLOCKIN(H(9), H(10, 30)), zh: "进后厨", sub: "系上围裙，检查食材", subEn: "Apron on, check the deliveries" },
  { id: "prep", emoji: "🔪", zh: "备菜切配", en: "Prep", sub: "切丝切片，备好一整天的料", subEn: "Slice and dice for the whole day", min: 50, energy: -4, mood: 0, pay: 0.08, xp: 1, hours: [H(9), H(11, 30)], max: 1, core: true, scene: { set: "kitchen", pose: "cook", bg: "🔪 🥬 🥩", prop: "🔪" } },
  { id: "lunch", emoji: "🔥", zh: "午市炒锅", en: "Lunch rush on the wok", sub: "单子一张张打出来，锅铲不停", subEn: "Tickets keep printing, the wok never stops", min: 60, energy: -8, mood: 0, pay: 0.14, xp: 1, hours: [H(11), H(14)], max: 2, core: true, scene: { set: "kitchen", pose: "cook", bg: "🔥 🍳 🧾", prop: "🍳" } },
  { id: "dinner", emoji: "🍲", zh: "晚市出菜", en: "Dinner service", sub: "招牌菜一桌接一桌", subEn: "Signature dishes, table after table", min: 60, energy: -8, mood: 1, pay: 0.14, xp: 1, hours: [H(17), H(21)], max: 2, core: true },
  { id: "newdish", emoji: "🧪", zh: "研究新菜", en: "Try a new dish", sub: "老板说下周要上新", subEn: "The boss wants a new dish next week", min: 40, energy: -3, mood: 4, skill: 1, max: 1, risk: { p: 0.3, zh: "咸了，被老板骂", en: "Too salty — the boss isn't pleased", mood: -4, payCut: 0 } },
  MEAL("员工餐", "Staff meal", 0, [H(14), H(16, 30)]),
  { id: "clean", emoji: "🧼", zh: "收拾后厨", en: "Clean the kitchen", sub: "灶台油污和地沟，一天的收尾", subEn: "Grease and drains — the day's last job", min: 30, energy: -4, mood: 0, max: 1 },
  WATER, TOILET,
  CLOCKOUT(H(21)),
];
const NURSE: RoutineStep[] = [
  { ...CLOCKIN(H(7), H(8, 30)), zh: "早交班", sub: "听夜班交代每个床位的情况", subEn: "Night shift briefs you bed by bed" },
  { id: "round", emoji: "🩺", zh: "查房量体征", en: "Ward round", sub: "量血压、测体温、问一句「今天怎么样」", subEn: "Blood pressure, temperature, “how are you today?”", min: 45, energy: -4, mood: 1, pay: 0.1, xp: 1, hours: [H(7, 30), H(18)], max: 3, core: true, scene: { set: "clinic", pose: "walk", bg: "🏥 🩺 🛏️", prop: "🩺" } },
  { id: "jab", emoji: "💉", zh: "打针输液", en: "Injections & drips", sub: "一针见血，病人都夸你手稳", subEn: "First try every time — patients notice", min: 40, energy: -4, mood: 1, pay: 0.11, xp: 1, skill: 1, hours: [H(8), H(17)], max: 3, core: true, risk: { p: 0.1, zh: "病人血管太细，扎了两次，被投诉", en: "Tiny veins, two tries — a complaint", mood: -5, payCut: 0 } },
  { id: "chart", emoji: "📝", zh: "写护理记录", en: "Write the charts", sub: "每个病人都要记，一个字都不能错", subEn: "Every patient, every detail, no mistakes", min: 30, energy: -3, mood: -1, pay: 0.06, max: 2, core: true, scene: { set: "clinic", pose: "type", bg: "🏥 💻 📋", prop: "📝" } },
  { id: "bell", emoji: "🔔", zh: "响铃处理", en: "Answer the call bell", sub: "3 床要换药，7 床要喝水", subEn: "Bed 3 needs a dressing, bed 7 wants water", min: 15, energy: -2, mood: 0, network: 1, max: 3 },
  MEAL("医院食堂", "Hospital canteen", 15, [H(11, 30), H(13, 30)]),
  WATER, TOILET,
  CLOCKOUT(H(17, 30)),
];
const AGENT: RoutineStep[] = [
  { ...CLOCKIN(H(8, 30), H(10)), zh: "门店早会", sub: "店长念业绩榜，喊口号", subEn: "The manager reads the sales board; team chant", min: 15, energy: -1 },
  { id: "post", emoji: "📲", zh: "发房源", en: "Post listings", sub: "拍照修图，各个平台发一遍", subEn: "Shoot, retouch, post everywhere", min: 40, energy: -3, mood: 0, pay: 0.06, xp: 1, hours: [H(9), H(21)], max: 2, core: true, scene: { set: "office", pose: "type", bg: "🏠 📸 📲", prop: "📲" } },
  { id: "calls", emoji: "☎️", zh: "打陌生电话", en: "Cold calls", sub: "「您好，请问您的房子考虑出售吗？」", subEn: "“Hello, are you thinking of selling?”", min: 30, energy: -3, mood: -3, pay: 0.05, hours: [H(9), H(20)], max: 2, core: true },
  { id: "view", emoji: "🔑", zh: "带看", en: "Show a flat", sub: "带客户看房，夸采光夸学位", subEn: "Show the flat: the light, the school catchment", min: 50, energy: -5, mood: 1, pay: 0.08, network: 1, hours: [H(10), H(21)], max: 3, core: true },
  { id: "deal", emoji: "🧧", zh: "签单", en: "Close a deal", sub: "谈价、压价、签合同——一单的佣金顶一个月", subEn: "Haggle and sign — one commission pays the month", min: 60, energy: -6, mood: 10, pay: 1.2, xp: 3, hours: [H(14), H(22)], max: 1, risk: { p: 0.65, zh: "客户最后说「再考虑考虑」，单黄了", en: "“Let me think about it” — the deal falls through", mood: -6, payCut: 0 } },
  MEAL("外卖", "Takeaway", 22, [H(11, 30), H(14)]),
  WATER, TOILET,
  CLOCKOUT(H(20)),
];
const STREAMER: RoutineStep[] = [
  { ...CLOCKIN(H(11), H(14)), zh: "开播", sub: "打光、开美颜、对着镜头说「家人们」", subEn: "Lights, filter, “hi everyone!”" },
  { id: "live", emoji: "📱", zh: "直播带货", en: "Live selling", sub: "「三二一上链接！」库存一抢而空", subEn: "“Three, two, one — link’s up!”", min: 60, energy: -5, mood: 1, pay: 0.12, xp: 1, hours: [H(11), H(24)], max: 4, core: true, scene: { set: "home", pose: "sit", bg: "📱 💡 🛍️", prop: "📱" } },
  { id: "pk", emoji: "⚔️", zh: "连麦 PK", en: "PK battle", sub: "和隔壁主播比礼物，输了要做惩罚", subEn: "Gift battle with another streamer — losers do a forfeit", min: 30, energy: -3, mood: 3, pay: 0.15, network: 1, hours: [H(19), H(24)], max: 1, risk: { p: 0.45, zh: "PK 输了，戴着猪鼻子播了半小时", en: "Lost the PK — half an hour in a pig nose", mood: -4, payCut: 0 } },
  { id: "clip", emoji: "🎬", zh: "剪短视频", en: "Edit a short video", sub: "剪一条切片发出去引流", subEn: "Cut a clip to pull in viewers", min: 40, energy: -3, mood: 0, pay: 0.05, skill: 1, max: 2, core: true },
  { id: "viral", emoji: "🚀", zh: "蹭热点", en: "Ride a trend", sub: "今天的热搜赶紧拍一条", subEn: "Film today's trending topic, fast", min: 25, energy: -2, mood: 2, pay: 0.4, max: 1, risk: { p: 0.7, zh: "没火，播放量 300", en: "Didn't take off — 300 views", mood: -3, payCut: 0 } },
  MEAL("外卖", "Takeaway", 25, [H(12), H(15)]),
  { id: "voice", emoji: "🍯", zh: "润嗓子", en: "Rest your voice", sub: "胖大海泡水，嗓子说哑了", subEn: "Herbal tea — your voice is gone", min: 10, energy: 3, mood: 1, max: 2 },
  WATER, TOILET,
  CLOCKOUT(H(22)),
];
const VENDOR: RoutineStep[] = [
  { ...CLOCKIN(H(16), H(19)), zh: "出摊", sub: "三轮车推到老位置，支起小桌板", subEn: "Wheel the cart to your spot, unfold the table" },
  { id: "sell", emoji: "🍢", zh: "摆摊卖货", en: "Work the stall", sub: "烤串、炒粉、手机壳，吆喝起来", subEn: "Skewers, fried noodles, phone cases — call it out", min: 45, energy: -4, mood: 2, pay: 0.13, xp: 1, hours: [H(16), H(24)], max: 5, core: true, scene: { set: "market", pose: "cook", bg: "🏮 🍢 👥", prop: "🍢" } },
  { id: "stock", emoji: "🛒", zh: "批发进货", en: "Restock at the wholesaler", sub: "批发市场进货，越便宜越好", subEn: "Wholesale market — the cheaper the better", min: 40, energy: -3, mood: 0, cash: -60, max: 1, core: true },
  { id: "runaway", emoji: "🏃", zh: "城管来了", en: "Inspectors!", sub: "收摊换个地方，过会儿再回来", subEn: "Pack up, move on, come back later", min: 15, energy: -4, mood: -3, max: 1, risk: { p: 0.35, zh: "没跑掉，被罚了款", en: "Too slow — fined", mood: -6, payCut: 0.15 } },
  { id: "regular", emoji: "😋", zh: "熟客光顾", en: "A regular stops by", sub: "「老板，老样子！」", subEn: "“The usual, boss!”", min: 10, energy: 0, mood: 5, pay: 0.05, network: 1, hours: [H(18), H(24)], max: 2 },
  MEAL("自己摊上的", "Eat from your own stall", 0, [H(16), H(19)]),
  WATER, TOILET,
  CLOCKOUT(H(23)),
];
const BUILDER: RoutineStep[] = [
  { ...CLOCKIN(H(6, 30), H(8)), zh: "进工地", sub: "安全帽戴好，班组长点名", subEn: "Hard hat on, roll call" },
  { id: "rebar", emoji: "🏗️", zh: "绑钢筋", en: "Tie rebar", sub: "太阳底下弯着腰，一根根绑", subEn: "Bent over in the sun, one tie at a time", min: 60, energy: -8, mood: -1, pay: 0.13, xp: 1, hours: [H(7), H(18)], max: 3, core: true, scene: { set: "station", pose: "lift", bg: "🏗️ ☀️ 🦺", prop: "🔩" } },
  { id: "carry", emoji: "🧱", zh: "搬砖", en: "Carry bricks", sub: "真·搬砖，一车一车往上运", subEn: "Literally moving bricks, load after load", min: 45, energy: -8, mood: -1, pay: 0.11, hours: [H(7), H(18)], max: 3, core: true },
  { id: "pour", emoji: "🪣", zh: "浇混凝土", en: "Pour concrete", sub: "泵车一开就不能停，赶工期", subEn: "Once the pump starts you don't stop", min: 60, energy: -9, mood: 0, pay: 0.16, hours: [H(8), H(17)], max: 1, core: true, risk: { p: 0.12, zh: "扭了腰，下午只能歇着", en: "Pulled your back — the afternoon's gone", mood: -6, payCut: 0.2 } },
  MEAL("工地大锅饭", "Site canteen", 10, [H(11), H(13)]),
  { id: "shade", emoji: "⛱️", zh: "树荫下午休", en: "Nap in the shade", sub: "躺在纸板上眯一会儿", subEn: "A nap on flattened cardboard", min: 30, energy: 12, mood: 2, hours: [H(12), H(14)], max: 1 },
  WATER, TOILET,
  CLOCKOUT(H(18)),
];
const COACH: RoutineStep[] = [
  { ...CLOCKIN(H(9), H(11)), zh: "到馆打卡", sub: "换上紧身衣，先自己练半小时", subEn: "Into the gym kit, half an hour of your own training" },
  { id: "pt", emoji: "🏋️", zh: "私教课", en: "Personal training", sub: "「最后三个！坚持住！」", subEn: "“Three more! Hold it!”", min: 60, energy: -5, mood: 2, pay: 0.15, xp: 1, hours: [H(9), H(22)], max: 4, core: true, scene: { set: "gym", pose: "lift", bg: "🏋️ 💪 🪞", prop: "🏋️" } },
  { id: "class", emoji: "🤸", zh: "带团课", en: "Lead a group class", sub: "动感单车，音乐一开全场出汗", subEn: "Spin class — music up, everyone sweating", min: 45, energy: -6, mood: 4, pay: 0.1, hours: [H(18), H(21, 30)], max: 1, core: true },
  { id: "sellcard", emoji: "💳", zh: "推销私教卡", en: "Sell a training package", sub: "「先体验一节免费课？」", subEn: "“How about a free trial session?”", min: 25, energy: -2, mood: 0, pay: 0.2, network: 1, max: 2, core: true, risk: { p: 0.55, zh: "人家只是来洗澡的", en: "They only came for the showers", mood: -3, payCut: 0 } },
  { id: "train", emoji: "💪", zh: "自己练", en: "Your own workout", sub: "教练的身材就是招牌", subEn: "Your physique is the advert", min: 40, energy: -4, mood: 5, skill: 1, max: 1 },
  MEAL("鸡胸肉沙拉", "Chicken-breast salad", 30, [H(11, 30), H(14)]),
  WATER, TOILET,
  CLOCKOUT(H(21)),
];

/* ---- 9 more trades (33 identities in all) ---- */
const TELLER: RoutineStep[] = [
  { ...CLOCKIN(H(8, 30), H(9, 30)), zh: "开门前晨会", sub: "点钞、核对尾箱、背今天的理财产品", subEn: "Count the float, learn today's products" },
  { id: "counter", emoji: "🏦", zh: "柜台办业务", en: "Serve the counter", sub: "开户、转账、挂失，叫号屏一直在跳", subEn: "Accounts, transfers, lost cards — the queue never stops", min: 60, energy: -5, mood: -1, pay: 0.12, xp: 1, hours: [H(9), H(17)], max: 4, core: true, scene: { set: "office", pose: "type", bg: "🏦 💳 🧾", prop: "💳" } },
  { id: "pitch", emoji: "📈", zh: "推理财", en: "Sell a savings product", sub: "「阿姨，这款稳健型的了解一下？」", subEn: "“Auntie, have you heard about this steady fund?”", min: 20, energy: -2, mood: 0, pay: 0.15, max: 2, core: true, risk: { p: 0.5, zh: "客户说再想想", en: "“I'll think about it”", mood: -2, payCut: 0 } },
  { id: "elder", emoji: "👵", zh: "教老人用手机银行", en: "Teach a pensioner the app", sub: "耐心教了二十分钟，阿婆说你比她孙子好", subEn: "Twenty patient minutes — she says you're nicer than her grandson", min: 20, energy: -2, mood: 5, network: 1, max: 1 },
  MEAL("行内食堂", "Bank canteen", 12, [H(11, 30), H(13, 30)]),
  { id: "balance", emoji: "🧮", zh: "日终轧账", en: "Balance the books", sub: "差一分钱都不能下班", subEn: "Out by one cent? Nobody goes home", min: 30, energy: -3, mood: -1, max: 1, core: true },
  WATER, TOILET,
  CLOCKOUT(H(17, 30)),
];
const PHARMACIST: RoutineStep[] = [
  { ...CLOCKIN(H(8), H(10)), zh: "穿白大褂上岗", sub: "核对效期、补货上架", subEn: "Check expiry dates, restock" },
  { id: "advise", emoji: "💊", zh: "给顾客拿药讲用法", en: "Advise a customer", sub: "「一天三次，饭后吃，别和酒一起」", subEn: "“Three times a day after meals — no alcohol”", min: 30, energy: -3, mood: 1, pay: 0.1, xp: 1, skill: 0, hours: [H(8), H(22)], max: 5, core: true, scene: { set: "clinic", pose: "idle", bg: "💊 🩺 🧴", prop: "💊" } },
  { id: "bp", emoji: "🩺", zh: "免费量血压", en: "Free blood-pressure check", sub: "大爷每天都来量，顺便聊天", subEn: "The same uncle every day — mostly for the chat", min: 15, energy: -1, mood: 3, network: 1, max: 2 },
  { id: "stock", emoji: "📦", zh: "盘点药品", en: "Stock-take", sub: "处方药和非处方药分开清点", subEn: "Prescription and OTC counted separately", min: 40, energy: -4, mood: -1, pay: 0.06, max: 1, core: true },
  MEAL("外卖", "Takeaway", 20, [H(11, 30), H(14)]),
  WATER, TOILET,
  CLOCKOUT(H(20)),
];
const STATIONSTAFF: RoutineStep[] = [
  { ...CLOCKIN(H(6), H(7, 30)), zh: "早班点名", sub: "换上制服，领对讲机", subEn: "Uniform on, take a radio" },
  { id: "gate", emoji: "🚇", zh: "闸机口引导", en: "Guide at the gates", sub: "「扫码这边，刷卡那边！」", subEn: "“QR codes this side, cards that side!”", min: 50, energy: -4, mood: 0, pay: 0.11, xp: 1, hours: [H(6), H(22)], max: 5, core: true, scene: { set: "station", pose: "idle", bg: "🚇 🚧 👥", prop: "🦺" } },
  { id: "rush", emoji: "😵", zh: "早晚高峰限流", en: "Rush-hour crowd control", sub: "站台人挤人，护栏一圈圈绕", subEn: "Packed platforms, barriers snaking round", min: 45, energy: -7, mood: -2, pay: 0.13, hours: [H(7, 30), H(9, 30)], max: 1, core: true },
  { id: "lost", emoji: "🎒", zh: "处理失物", en: "Lost property", sub: "一个书包，里面是孩子的作业", subEn: "A school bag with a kid's homework inside", min: 15, energy: -1, mood: 4, network: 1, max: 2 },
  MEAL("员工餐", "Staff meal", 0, [H(11), H(13, 30)]),
  WATER, TOILET,
  CLOCKOUT(H(15)),
];
const NETCAFE: RoutineStep[] = [
  { ...CLOCKIN(H(14), H(16)), zh: "交接班", sub: "数饮料、看哪台机器蓝屏了", subEn: "Count the drinks, find the blue screens" },
  { id: "fix", emoji: "🖥️", zh: "修机器", en: "Fix a machine", sub: "重装系统、换键盘、拔掉又插上", subEn: "Reinstall, swap a keyboard, unplug and replug", min: 40, energy: -3, mood: 1, pay: 0.11, skill: 1, hours: [H(14), H(24)], max: 3, core: true, scene: { set: "office", pose: "type", bg: "🖥️ 🎮 🥤", prop: "🖥️" } },
  { id: "snacks", emoji: "🍜", zh: "泡面送到机位", en: "Deliver instant noodles", sub: "「34 号机，加个蛋」", subEn: "“Seat 34, add an egg”", min: 15, energy: -2, mood: 0, pay: 0.06, max: 4, core: true },
  { id: "kick", emoji: "🔌", zh: "劝未成年人下机", en: "Send the under-18s home", sub: "防沉迷规定，嘟囔着走了", subEn: "Rules are rules — they grumble off", min: 10, energy: -1, mood: -2, max: 1 },
  MEAL("泡面加肠", "Noodles with a sausage", 8, [H(17), H(20)]),
  WATER, TOILET,
  CLOCKOUT(H(23)),
];
const BARISTA: RoutineStep[] = [
  { ...CLOCKIN(H(7), H(8, 30)), zh: "开店", sub: "校准磨豆机，打第一杯奶泡", subEn: "Dial in the grinder, steam the first milk" },
  { id: "pull", emoji: "☕", zh: "做咖啡", en: "Make coffees", sub: "早高峰一排外卖单，拉花顾不上了", subEn: "A wall of delivery orders — no time for latte art", min: 45, energy: -4, mood: 1, pay: 0.11, xp: 1, hours: [H(7), H(20)], max: 5, core: true, scene: { set: "restaurant", pose: "cook", bg: "☕ 🥐 🧾", prop: "☕" } },
  { id: "art", emoji: "🎨", zh: "练拉花", en: "Practise latte art", sub: "今天终于拉出了一只天鹅", subEn: "A swan, finally", min: 20, energy: -1, mood: 5, skill: 1, max: 1 },
  { id: "clean", emoji: "🧽", zh: "清洗咖啡机", en: "Clean the machine", sub: "冲煮头、蒸汽棒，一样都不能偷懒", subEn: "Group heads and steam wand — no shortcuts", min: 20, energy: -2, mood: 0, max: 1, core: true },
  MEAL("员工餐", "Staff meal", 0, [H(11, 30), H(14)]),
  WATER, TOILET,
  CLOCKOUT(H(17)),
];
const NAILS: RoutineStep[] = [
  { ...CLOCKIN(H(10), H(12)), zh: "开店", sub: "消毒工具、摆好色板", subEn: "Sterilise tools, lay out the colour chart" },
  { id: "set", emoji: "💅", zh: "做美甲", en: "Do a set of nails", sub: "猫眼、渐变、贴钻，一坐两小时", subEn: "Cat-eye, ombré, crystals — two hours in one chair", min: 90, energy: -5, mood: 1, pay: 0.22, xp: 1, hours: [H(10), H(22)], max: 3, core: true, scene: { set: "mall", pose: "sit", bg: "💅 ✨ 🪞", prop: "💅" } },
  { id: "post", emoji: "📸", zh: "拍作品发小红书", en: "Post your work online", sub: "好看的款式发出去，第二天就有人照着做", subEn: "Post a good set — tomorrow someone wants the same", min: 15, energy: -1, mood: 2, network: 1, max: 1, core: true },
  { id: "card", emoji: "💳", zh: "推会员卡", en: "Sell a membership", sub: "「充一千送两百」", subEn: "“Top up 1,000, get 200 free”", min: 10, energy: -1, mood: 0, pay: 0.1, max: 1, core: true, risk: { p: 0.5, zh: "客人说下次吧", en: "“Next time”", mood: -2, payCut: 0 } },
  MEAL("外卖", "Takeaway", 22, [H(12), H(15)]),
  WATER, TOILET,
  CLOCKOUT(H(21)),
];
const PETGROOMER: RoutineStep[] = [
  { ...CLOCKIN(H(9), H(11)), zh: "开店喂猫", sub: "店里寄养的三只猫先喂饱", subEn: "Feed the three boarding cats first" },
  { id: "bath", emoji: "🛁", zh: "给狗洗澡", en: "Bath a dog", sub: "柯基甩了你一身水", subEn: "The corgi shakes water all over you", min: 50, energy: -5, mood: 3, pay: 0.13, xp: 1, hours: [H(9), H(20)], max: 4, core: true, scene: { set: "mall", pose: "idle", bg: "🐶 🛁 🫧", prop: "🐶" } },
  { id: "trim", emoji: "✂️", zh: "修剪造型", en: "Groom and trim", sub: "泰迪剪成了泰迪熊", subEn: "A poodle trimmed into a teddy bear", min: 40, energy: -4, mood: 2, pay: 0.12, skill: 1, max: 2, core: true, risk: { p: 0.12, zh: "剪坏了一撮毛，主人不太高兴", en: "A bad snip — the owner isn't thrilled", mood: -5, payCut: 0.1 } },
  MEAL("外卖", "Takeaway", 20, [H(12), H(14, 30)]),
  WATER, TOILET,
  CLOCKOUT(H(19)),
];
const FRONTDESK: RoutineStep[] = [
  { ...CLOCKIN(H(7), H(8, 30)), zh: "早班交接", sub: "看夜班留的房态和投诉记录", subEn: "Read the night shift's room status and complaints" },
  { id: "checkin", emoji: "🛎️", zh: "办入住退房", en: "Check guests in and out", sub: "查身份证、刷押金、递房卡", subEn: "ID, deposit, key card", min: 45, energy: -4, mood: 0, pay: 0.11, xp: 1, hours: [H(7), H(23)], max: 4, core: true, scene: { set: "office", pose: "idle", bg: "🛎️ 🏨 🔑", prop: "🔑" } },
  { id: "complaint", emoji: "📞", zh: "处理投诉", en: "Handle a complaint", sub: "「隔壁太吵了」——换房、送果盘", subEn: "“The room next door is loud” — move them, send fruit", min: 20, energy: -3, mood: -3, pay: 0.05, max: 2, core: true },
  { id: "tips", emoji: "🗺️", zh: "给游客推荐景点", en: "Recommend a day out", sub: "外国客人记下你推荐的早茶店", subEn: "A foreign guest writes down your dim-sum tip", min: 10, energy: -1, mood: 4, network: 1, max: 2 },
  MEAL("员工餐", "Staff meal", 0, [H(11, 30), H(14)]),
  WATER, TOILET,
  CLOCKOUT(H(16)),
];
const GUIDE: RoutineStep[] = [
  { ...CLOCKIN(H(7), H(9)), zh: "集合点名", sub: "举起小旗：「XX 团的跟我走！」", subEn: "Flag up: “Group 12, this way!”" },
  { id: "tour", emoji: "🚩", zh: "带团讲解", en: "Lead the tour", sub: "讲了八遍的故事，还要讲得像第一次", subEn: "A story told eight times, told like the first", min: 60, energy: -5, mood: 1, pay: 0.13, xp: 1, hours: [H(8), H(18)], max: 4, core: true, scene: { set: "park", pose: "walk", bg: "🚩 🏯 📸", prop: "🚩" } },
  { id: "photo", emoji: "📸", zh: "给团员拍合影", en: "Take the group photo", sub: "「看这里！一二三，茄子！」", subEn: "“Look here! One, two, three — cheese!”", min: 15, energy: -1, mood: 3, max: 2, core: true },
  { id: "shop", emoji: "🛍️", zh: "带进购物店", en: "Take them shopping", sub: "有回扣，但团员脸色不好看", subEn: "There's a kickback — and some unhappy faces", min: 30, energy: -2, mood: -3, pay: 0.2, max: 1, risk: { p: 0.3, zh: "被游客投诉强制购物，扣钱", en: "Complaint for forced shopping — fined", mood: -6, payCut: 0.15 } },
  MEAL("团餐", "Group lunch", 0, [H(11, 30), H(13, 30)]),
  WATER, TOILET,
  CLOCKOUT(H(17)),
];

export const ROLE_META: Record<RoutineRole, RoleMeta> = {
  office: { where: "work", pay: "wage", zh: "白领", en: "Office worker" },
  coder: { where: "work", pay: "wage", zh: "程序员", en: "Programmer" },
  factory: { where: "work", pay: "wage", zh: "工厂普工", en: "Factory worker" },
  waiter: { where: ["food", "market"], pay: "wage", zh: "餐厅服务员", en: "Waiter" },
  sales: { where: ["mall"], pay: "wage", zh: "商场导购", en: "Shop assistant" },
  barber: { where: ["mall", "market", "social"], pay: "wage", zh: "理发师", en: "Barber" },
  masseur: { where: ["social", "lodging", "mall", "health"], pay: "wage", zh: "按摩师", en: "Masseur" },
  ktv: { where: ["social"], pay: "wage", zh: "KTV 包厢服务员", en: "KTV room attendant" },
  teacher: { where: ["learn"], pay: "wage", zh: "老师", en: "Teacher" },
  student: { where: ["learn"], pay: "none", zh: "大学生", en: "Student" },
  boss: { where: "work", pay: "deal", zh: "小老板", en: "Business owner" },
  flat: { where: "any", pay: "none", zh: "躺平青年", en: "Slacker" },
  rider: { where: "any", pay: "order", zh: "外卖骑手", en: "Delivery rider" },
  driver: { where: "any", pay: "order", zh: "的士司机", en: "Taxi driver" },
  guard: { where: ["mall", "lodging", "bank", "transit"], pay: "wage", zh: "保安", en: "Security guard" },
  cleaner: { where: ["mall", "transit", "lodging", "health", "learn"], pay: "wage", zh: "保洁阿姨", en: "Cleaner" },
  courier: { where: "any", pay: "wage", zh: "快递员", en: "Courier" },
  chef: { where: ["food", "market", "lodging"], pay: "wage", zh: "厨师", en: "Chef" },
  nurse: { where: ["health"], pay: "wage", zh: "护士", en: "Nurse" },
  agent: { where: ["mall", "market", "transit"], pay: "wage", zh: "房产中介", en: "Estate agent" },
  streamer: { where: ["home", "mall", "scenic", "fun"], pay: "wage", zh: "带货主播", en: "Livestreamer" },
  vendor: { where: ["market", "food", "transit", "scenic"], pay: "wage", zh: "摆摊小贩", en: "Street vendor" },
  builder: { where: "work", pay: "wage", zh: "建筑工人", en: "Construction worker" },
  coach: { where: ["gym"], pay: "wage", zh: "健身教练", en: "Gym coach" },
  teller: { where: ["bank"], pay: "wage", zh: "银行柜员", en: "Bank teller" },
  pharmacist: { where: ["health", "service", "mall"], pay: "wage", zh: "药店店员", en: "Pharmacy assistant" },
  stationstaff: { where: ["transit"], pay: "wage", zh: "地铁站务员", en: "Metro station staff" },
  netcafe: { where: ["fun", "social", "mall"], pay: "wage", zh: "网吧网管", en: "Internet-café attendant" },
  barista: { where: ["food", "mall", "market"], pay: "wage", zh: "咖啡师", en: "Barista" },
  nails: { where: ["mall", "market"], pay: "wage", zh: "美甲师", en: "Nail artist" },
  petgroomer: { where: ["mall", "market"], pay: "wage", zh: "宠物美容师", en: "Pet groomer" },
  frontdesk: { where: ["lodging"], pay: "wage", zh: "酒店前台", en: "Hotel receptionist" },
  guide: { where: ["scenic", "fun", "mountain"], pay: "wage", zh: "景区导游", en: "Tour guide" },
};
const STEPS: Record<RoutineRole, RoutineStep[]> = { office: OFFICE, coder: CODER, factory: FACTORY, waiter: WAITER, sales: SALES, barber: BARBER, masseur: MASSEUR, ktv: KTV, teacher: TEACHER, student: STUDENT, boss: BOSS, flat: FLAT, rider: RIDER, driver: DRIVER, guard: GUARD, cleaner: CLEANER, courier: COURIER, chef: CHEF, nurse: NURSE, agent: AGENT, streamer: STREAMER, vendor: VENDOR, builder: BUILDER, coach: COACH, teller: TELLER, pharmacist: PHARMACIST, stationstaff: STATIONSTAFF, netcafe: NETCAFE, barista: BARISTA, nails: NAILS, petgroomer: PETGROOMER, frontdesk: FRONTDESK, guide: GUIDE };

/** identity id → the job's daily routine */
export function routineRole(identity: string): RoutineRole {
  const map: Record<string, RoutineRole> = { rider: "rider", coder: "coder", rich: "boss", flat: "flat", worker: "office", factory: "factory", waiter: "waiter", sales: "sales", boss: "boss", driver: "driver", teacher: "teacher", student: "student", barber: "barber", masseur: "masseur", ktv: "ktv", guard: "guard", cleaner: "cleaner", courier: "courier", chef: "chef", nurse: "nurse", agent: "agent", streamer: "streamer", vendor: "vendor", builder: "builder", coach: "coach", teller: "teller", pharmacist: "pharmacist", stationstaff: "stationstaff", netcafe: "netcafe", barista: "barista", nails: "nails", petgroomer: "petgroomer", frontdesk: "frontdesk", guide: "guide" };
  return map[identity] ?? "office";
}
/* Clocking in stays possible until clock-out time: real players log in whenever
   they can, so turning up late costs the attendance bonus (see doRoutine), it
   never locks you out of the whole working day. */
const STEPS_EFF = Object.fromEntries((Object.keys(STEPS) as RoutineRole[]).map((r) => {
  const out = STEPS[r].find((x) => x.id === "clockout")?.hours?.[0];
  return [r, STEPS[r].map((x) => (x.id === "clockin" && x.hours && out && out > x.hours[1] ? { ...x, hours: [x.hours[0], out] as [number, number] } : x))];
})) as Record<RoutineRole, RoutineStep[]>;
export function routineSteps(role: RoutineRole): RoutineStep[] { return STEPS_EFF[role]; }
export const isOrderRole = (role: RoutineRole) => role === "rider" || role === "driver";
/** work blocks for a full day's pay (paid at clock-out) */
export const CORE_FOR_FULL_DAY = 5;

export interface RiderOrder { shop: string; dest: string; pay: number; at: number; stage: "toShop" | "waiting" | "toDest" | "atDoor"; stairs: boolean; climbed: boolean }
export interface RoutineDay { day: number; done: Record<string, number>; late?: boolean; payCut?: number; order?: RiderOrder | null; orders?: number; online?: boolean }
