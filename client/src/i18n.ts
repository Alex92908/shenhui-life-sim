/* 多语言 (i18n) — English (and room for more) without rewriting every
   component: in a non-Chinese language a translator walks the page's text
   nodes and a few attributes and swaps known Chinese strings for their
   translation, then keeps watching for changes (React re-renders, map
   labels, toasts). Unknown text is left as is, so a missing entry degrades
   to Chinese rather than breaking anything.

   Coverage: interface chrome (header, panels, tabs, buttons, actions),
   place names (game locations + OSM English names), companies, city
   events, achievements, weekly goals, emergency services, and templated
   strings with numbers via PATTERNS, plus the generated i18n-en.ts, which
   covers the rest of the client's text (NPC chat, events, scenes) as exact
   strings and {n} templates. Add entries to EN to override or extend. */
import { COMPANIES, LOC_EN, PLACE_KINDS, getLocations, placesForCity } from "./data";
import { SZ_STATION_EN } from "./metro-sz";
import { ACHIEVEMENTS, WEEKLY_GOALS } from "./meta";
import { EN_EXACT, EN_TEMPLATES } from "./i18n-en";
import { SZ_PLACE_EN_AUTO, SZ_STATION_EN_AUTO } from "./places-sz-en";

export type Lang = "zh" | "en";
export const LANGS: { id: Lang; label: string }[] = [{ id: "zh", label: "中文" }, { id: "en", label: "EN" }];
const KEY = "shhr-lang";

export function getLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "zh" || v === "en") return v;
  } catch { /* fall through */ }
  return typeof navigator !== "undefined" && /^zh/i.test(navigator.language || "zh") ? "zh" : "en";
}
export function setLangStored(l: Lang): void {
  try { localStorage.setItem(KEY, l); } catch { /* storage unavailable */ }
}

/* ---- dictionary: exact strings (trimmed) ---- */
const EN: Record<string, string> = {
  "深圳国际交流中心": "Shenzhen International Exchange Center", "频道 ·": " channel ·", "频道": " channel", "人在线：": "online: ",
  // header / chrome
  "深惠人生模拟电脑高配版": "Shenzhen–Huizhou Life Sim", "深惠人生模拟": "Shenzhen–Huizhou Life Sim",
  "📋 任务": "📋 Tasks", "📤 分享": "📤 Share", "📱 手机": "📱 Phone", "😴 回家睡觉": "😴 Go home & sleep", "人在线": "online",
  "🚇 地铁线路图": "🚇 Metro map", "⛶ 全屏看地图": "⛶ Fullscreen map", "⛶ 退出全屏": "⛶ Exit fullscreen",
  "地区面板": "Area panel", "竖收起 »": "Collapse »", "◂ 收起": "◂ Hide", "收起 ✕": "Close ✕", "收起 ▴": "Hide ▴", "展开 ▾": "Show ▾", "展开详情": "Details",
  "📍 地点": "📍 Place", "🎫 集章": "🎫 Stamps", "🏘️ 动态": "🏘️ Feed", "🧑‍🤝‍🧑 街坊墙": "🧑‍🤝‍🧑 Neighbours", "💬 聊天": "💬 Chat", "🏆 排行": "🏆 Ranks", "📖 图鉴": "📖 Guide",
  "地点": "Place", "集章": "Stamps", "动态": "Feed", "街坊墙": "Neighbours", "聊天": "Chat", "排行": "Ranks", "图鉴": "Guide", "状态": "Status", "速览": "Overview", "峰会": "Summit",
  "● 你在这里": "● You are here", "你在这里": "You are here", "未到达": "Not here", "🚶 赶路中…": "🚶 On the way…", "已到达": "Arrived",
  "📍 在这里能做 · 常用操作": "📍 Things to do here", "点一下就行动": "Tap to act", "到了才能做": "Available on arrival",
  "🧭 附近可去": "🧭 Nearby", "🆘 附近服务 · Emergency & Services": "🆘 Emergency & services nearby", "📓 我的日子 · 生活日志": "📓 My days · log",
  "急救": "Ambulance", "报警": "Police", "火警": "Fire", "市民热线": "City hotline", " · 🚑 急诊": " · 🚑 ER",
  "🚑 24 小时急诊 · Emergency": "🚑 24h Emergency", "存款": "Savings", "⚡ 能量": "⚡ Energy", "😊 心情": "😊 Mood",
  "🧭 出行导航": "🧭 Directions", "收起出行导航": "Hide directions", "💬 弹幕开": "💬 Danmaku on", "关闭弹幕": "Danmaku off", "开启弹幕": "Danmaku on",
  "🔍 搜地点或地铁站：公园、商场、医院、博物馆、海滩…": "🔍 Search places or stations: parks, malls, hospitals, museums, beaches…",
  "示意微缩模型": "Stylised miniature",
  // setup
  "选一座城": "Choose a city", "选一个身份": "Choose who you are", "进城，开始过日子 →": "Move in and start living →", "比如：阿深、湾区小陈": "e.g. Alex, Bay Chen",
  "我已阅读并同意": "I have read and agree to", "《用户协议》": "Terms of Service", "《隐私政策》": "Privacy Policy", "和": "and",
  "。游戏中的公司与活动均为虚构。": ". Companies and events in the game are fictional.", "游戏中的公司与活动均为虚构": "Companies and events in the game are fictional",
  "☁️ 在别的设备玩过？用云存档码继续": "☁️ Played on another device? Continue with your save code", "载入": "Load",
  "存档码在游戏里右侧「🎫 集章」页最上面。": "Your save code is at the top of the 🎫 Stamps tab in the game.",
  "真人联机 · 同一座城": "Real players · one shared city", "深圳": "Shenzhen", "惠州": "Huizhou",
  "深圳不相信眼泪，但相信存款。": "Shenzhen doesn't believe in tears — it believes in savings.",
  "在深圳和惠州，": "In Shenzhen and Huizhou,", "过完这个十一月": "live through this November",
  "30 天生活模拟：选一座城、一个身份，在 3D 地图上打工、升职、吃饭、装修、攒钱。这次是": "A 30-day life sim: pick a city and who you are, then work, get promoted, eat, decorate and save money on a 3D map. And it's",
  "真的联机": "truly online",
  "——其他打开游戏的人会以真身出现在你的地图上，你们共享一个城市频道、一份动态墙和一张排行榜。11 月 14–19 日是深圳湾区峰会周，三个真实会场等你打工。": " — everyone else playing shows up on your map; you share a city chat, a feed and a leaderboard. 14–19 November is Summit Week in Shenzhen, with three venues hiring.",
  "深圳在线": "Shenzhen online", "惠州在线": "Huizhou online", "人": "", "🗺️ 双城": "🗺️ Two cities,", "个地点 · 地铁/城际/高铁全线 · 大地图": "places · full metro, intercity & high-speed rail · big map",
  "🌐 峰会日程": "🌐 Summit schedule", "来深圳看峰会、玩游戏认深圳": "Come to Shenzhen for the Summit — get to know the city by playing",
  "公开上线活动：湾区国际峰会周 11 月 14–19 日在深圳举行，游戏同步开活动，每天一个任务，按日程走——14 日峰会周开幕（筹备会、工商论坛）→ 16 日晚太子湾欢迎晚宴 → 17–18 日前海工商峰会 → 18–19 日香蜜湖峰会主会议。你以志愿者、记者、司机的身份参与（峰会周的闭门会议不对公众开放，游戏里也进不去），坐真实地铁线路去三个会场打卡上岗，六天任务全做完，领《湾区峰会服务证书》。": "Launch event: the (fictional) Bay Area International Summit runs 14–19 November in Shenzhen, with one task a day — 14th opening (prep meetings, business forum) → 16th welcome banquet at Prince Bay → 17–18th business summit in Qianhai → 18–19th main session at Xiangmi Lake. You take part as a volunteer, reporter or driver (the closed-door sessions are off limits, in the game too): ride the real metro to the three venues, check in and work; finish all six days for a Summit service certificate.",
  "⏰ 游戏第 N 天 = 11 月 N 日：13 日前先进城认地图、认地铁，14 日准时开幕。选深圳开局就能参加活动。": "⏰ Game day N = N November: learn the map and metro before the 13th; the Summit opens on the 14th. Start in Shenzhen to join.",
  "先给自己起个城市昵称（别人会看到）": "Pick a nickname (other players will see it)",
  "62 个地点 · 峰会主场 · 周租贵、工资高": "62 places · Summit host · high rent, high pay", "32 个地点 · 海边慢生活 · 周租便宜、工资低": "32 places · slow seaside life · cheap rent, lower pay",
  "人正在这座城里": "players in this city", "🌐 Language / 语言": "🌐 Language / 语言",
  "深漂打工人": "Shenzhen hustler", "住城中村握手楼，每天挤地铁去科技园。没背景，只有背影。": "Lives in an urban-village flat and squeezes onto the metro to the tech park every day. No connections, just hustle.",
  "日薪约": "Daily pay ≈", "· 初始心情": "· starting mood",
  "深圳富二代": "Rich kid", "南山有房，开局不差钱。难的是别把钱败光，还得证明自己。": "Owns a flat in Nanshan and starts rich. The hard part: not blowing it all, and proving yourself.",
  "惠州躺平青年": "Huizhou slacker", "拒绝内卷，海边租房。工资不高，但每天睡到自然醒。": "Opted out of the rat race and rents by the sea. Low pay, but sleeps in every day.",
  "996 程序员": "996 programmer", "发量换工资。日薪最高，但能量和心情掉得比头发还快。": "Trades hair for salary. Highest pay, but energy and mood drop faster than hair.",
  "外卖骑手": "Delivery rider", "城市最熟悉的陌生人。多跑多得，风里来雨里去。": "The city's most familiar stranger. More runs, more money, rain or shine.",
  "规则：30 天，每天去不同地点行动消耗能量；每周六睡前交租，存款跌破 -¥500 会被房东请出门；第 30 天结束结算并登上全城排行榜。": "Rules: 30 days. Actions at different places cost energy; rent is due before bed every Saturday, and dropping below -¥500 gets you evicted. Day 30 ends the run and puts you on the city leaderboard.",
  "选择深圳": "Choose Shenzhen", "选择惠州": "Choose Huizhou", "切换到中文": "Switch to Chinese",
  "选择身份深漂打工人": "Choose Shenzhen hustler", "选择身份深圳富二代": "Choose rich kid", "选择身份惠州躺平青年": "Choose Huizhou slacker", "选择身份996 程序员": "Choose 996 programmer", "选择身份外卖骑手": "Choose delivery rider",
  "页面没能加载出来": "The page didn't load", "重新打开": "Reload", "清除本地存档并重新开始": "Clear local save and restart",
  // daily modal
  "开始今天的生活 →": "Start today →", "🧧 每日签到 · 领 ¥30 + 能量 10": "🧧 Daily check-in · ¥30 + 10 energy", "✅ 今日已签到（明天再来）": "✅ Checked in today (come back tomorrow)",
  "今日任务": "Today's tasks", "上班打卡一次": "Clock in at work once", "好好吃一顿饭": "Have a proper meal", "风景打卡一处": "Check in at a scenic spot", "和一位街坊聊聊": "Chat with a neighbour",
  "夜市 / 饭店 / 自己做饭都算": "Night market, restaurant or home cooking all count", "去任意景区点「拍照打卡」": "Tap “Photo check-in” at any scenic spot",
  "在手机「街坊社交」里找人聊天": "Find someone in the phone's Neighbours app", "已完成，去领奖": "Done — claim it", "✅ 今天已完成": "✅ Done today", "奖励已领": "Claimed",
  // collect / meta
  "云存档码": "Cloud save code", "☁️ 云存档码": "☁️ Cloud save code", "复制": "Copy", "高画质": "High quality", "省电（手机）": "Battery saver (phone)", "切换会刷新页面": "switching reloads the page",
  "⚙️ 画质：": "⚙️ Quality:", "🎯 本周目标（每周一重置）": "🎯 Weekly goals (reset Mondays)", "✅ 已领": "✅ Claimed",
  "📖 城市图鉴 · 去过就记下": "📖 City guide · logged when you visit", "🗺️ 游戏地点": "🗺️ Game places", "🎫 集章排行（跨局累计）": "🎫 Stamp ranking (all runs)",
  "还没人盖章，去坐地铁吧。": "No stamps yet — go ride the metro.", "已佩戴 ✓": "Wearing ✓", "戴上": "Wear",
  "用户协议 Terms": "Terms of Service", "隐私政策 Privacy": "Privacy Policy",
  // share
  "📤 分享战绩 · 邀请朋友": "📤 Share & invite", "📲 分享给朋友": "📲 Share", "⬇️ 保存图片": "⬇️ Save image", "🔗 复制邀请链接": "🔗 Copy invite link",
  "正在生成战绩卡…": "Making your card…", "（联网后生成）": "(available when online)", "分享战绩、邀请朋友": "Share & invite friends",
  // board / chat
  "🏆 全城排行榜": "🏆 City leaderboard", "排行榜暂时没数据。": "No leaderboard data yet.", "还没数据。": "No data yet.", "（你）": "(you)", "（你在这）": "(you're here)",
  "发送": "Send", "频道里还很安静，发第一条消息吧。": "It's quiet here — say hello first.", "就你自己": "just you", "👥 同事": "👥 Colleague",
  "没发出去，稍后再试。": "Not sent — try again later.", "网络不太好，稍后再试。": "Network trouble — try again later.",
  // place actions (common)
  "正经上班": "Work a normal day", "拼命加班": "Work overtime", "员工食堂吃饭": "Eat at the staff canteen", "在园区逛逛": "Look around the campus",
  "睡觉到明天": "Sleep until tomorrow", "起床洗漱": "Wash up", "自己做饭": "Cook at home", "楼下买菜": "Buy groceries downstairs", "躺平摸鱼": "Lie flat & slack off",
  "拍照打卡": "Photo check-in", "慢慢散步": "Stroll slowly", "原地发呆": "Zone out", "登山徒步练体质": "Hike for fitness",
  "逛街购物": "Go shopping", "买身新衣服": "Buy a new outfit", "商场促销兼职": "Mall promo gig", "全面体检": "Full health check", "看病调理": "See a doctor",
  "认真练一次": "Proper workout", "拉伸放松": "Stretch", "在大堂坐坐": "Sit in the lobby", "约朋友唱 K": "Karaoke with friends", "小酌一杯": "A quiet drink",
  "市集买菜": "Market shopping", "淘二手手机": "Hunt for second-hand phones", "淘二手好物": "Hunt for second-hand finds", "装机 / 维修兼职": "Repair gig",
  "夜校充电课": "Night class", "自习备考": "Self-study", "取出全部理财": "Withdraw all investments", "买理财 ¥1,000": "Invest ¥1,000",
  "会务服务兼职": "Event staff gig", "外宾接待引导": "Guide international guests", "参观主题展陈": "Visit the exhibition",
  "在站里歇会儿": "Rest in the station", "在口岸歇会儿": "Rest at the checkpoint", "坐轮渡出海": "Take the ferry out", "坐飞机远行一天": "Fly somewhere for a day",
  "过关去香港一日游": "Day trip to Hong Kong", "买点常备药": "Buy basic medicine", "问问药师": "Ask the pharmacist", "问路 / 求助": "Ask for directions / help",
  "在门口歇会儿": "Rest by the door", "领一份中英文地图": "Get a bilingual map", "当一会儿志愿者": "Volunteer for a while", "买菜囤食材": "Stock up on groceries",
  "能量回满": "Energy refilled", "心情 +3 · 免费": "Mood +3 · free", "心情 +4 · 免费": "Mood +4 · free", "心情 +6 · 免费": "Mood +6 · free", "心情 +12 · 免费": "Mood +12 · free",
  // transport
  "步行": "Walk", "骑行": "Bike", "电动车": "E-bike", "公交": "Bus", "打车": "Taxi", "坐地铁": "Metro", "轮渡": "Ferry", "飞机": "Flight", "坐城轨/高铁": "Rail",
  "🚇 线路与坐车出发": "🚇 Lines & departures", "🚆 城际 · 高铁线路与出发": "🚆 Intercity & high-speed rail", "打开地铁线路图": "Open the metro map",
  "🗺️ 看路线图/听报站": "🗺️ Check route / announcements", "确认还有几站，别坐过站": "Check how many stops are left", "📱 看手机": "📱 Look at phone",
  "🖐️ 扶杆站稳": "🖐️ Hold the rail", "💺 让座": "💺 Give up your seat", "✅ 你扶稳了": "✅ Holding on", "⚠️ 还没扶杆": "⚠️ Not holding on",
  "全被扶满": "all taken", "还有空位": "some free", "（换乘）": "(transfer)", "（接驳换乘）": "(shuttle transfer)", "跳过 →": "Skip →", "跳过 ⏭": "Skip ⏭",
  "免费（绿色出行日）": "free (Green Travel Day)",
  // phone
  "📱 我的手机": "📱 My phone", "返回手机桌面": "Back to home screen", "关闭手机": "Close phone", "当前职级：": "Current rank: ", "下一级：": "Next: ",
  "还没达到晋升条件": "Not ready for promotion", "👑 已是最高职级，城市合伙人。": "👑 Top rank: City Partner.", "现在在：": "Working at: ", "接单": "Take",
  // place-kind activities & action descriptions
  "逛公园": "Walk in the park", "玩一整天": "Spend the whole day", "登顶看全城": "Climb to the top", "看一场展览": "See an exhibition", "慢慢逛一圈": "Look around slowly",
  "去海边玩水": "Play by the sea", "看一场演出": "See a show", "看红树林和候鸟": "Watch mangroves and migrating birds", "看看历史遗迹": "Visit the historic site",
  "免费自习，慢慢攒技能": "Free self-study, slowly building skill", "不花钱，活动活动筋骨": "Free — loosen up a bit", "站柜台发传单，活儿不重": "Hand out flyers at a counter — light work",
  "什么都不做，也是一种恢复": "Doing nothing is a kind of rest too", "钱给得最多，项目节奏快。": "Pays the most; projects move fast.", "职业技能课，升职的硬通货": "Career skills class — the real currency of promotion",
  "微醺刚好，聊聊最近的行情": "Just tipsy enough to talk about the market", "爬一趟山，体质和心情一起涨": "A climb lifts both fitness and mood", "排队、尖叫、拍照，玩到闭园": "Queue, scream, take photos, stay till closing",
  "蛇口出发，甲板看海、看大桥": "From Shekou: sea and bridge views from the deck", "帮摊主装机修小电器，手艺活": "Help stall owners fix gadgets — skilled work", "口岸附近接单，跨境客流不断": "Gigs near the border — steady cross-border crowds",
  "小毛病别拖，调理完神清气爽": "Don't let small things linger — you'll feel refreshed", "人靠衣装，面试和社交都体面些": "Clothes make the person — better for interviews and socialising",
  "买杯水、坐一会儿，看人来人往": "Grab a drink, sit, watch people go by", "查个明白，顺便把作息调整过来": "Get checked and reset your routine", "不赶时间，沿着风景慢慢走一圈": "No rush — a slow loop through the scenery",
  "老板画饼你吃饼，钱多但掉心情": "More money, less mood", "日用品、小玩意儿，快乐很直接": "Everyday bits and little things — simple joy", "吼两嗓子，烦恼减半，朋友加一": "Sing it out: half the worries, one more friend",
  "边走边看，顺手查查这里的故事": "Look around and read up on the story", "看人来人往过关，买杯水坐一会儿": "Watch the border crowds with a drink", "挑个便宜航线出门看看，晚上回来": "Grab a cheap flight somewhere, back by night",
  "帮住客搬行李、做接待，旺季单多": "Carry luggage and help at reception — busy in peak season", "老牌大厂，节奏比新贵们稳一些。": "An established giant, steadier than the newcomers.",
  "蹭个沙发和空调，看看住客来来往往": "Borrow a sofa and the aircon, watch guests come and go", "带上望远镜，冬天能看到成群的候鸟": "Bring binoculars — flocks of migrating birds in winter",
  "研发氛围浓，加班费和年终也给得足。": "R&D-heavy culture; generous overtime pay and bonuses.", "在站点附近接单，灵活、来钱快一点点": "Gigs near the station — flexible, a bit quicker money",
  "刷工卡，几块钱吃到饱，大厂福利之一": "Swipe your badge — all you can eat for a few yuan", "读一读碑文和介绍，深圳不只有四十年": "Read the inscriptions — Shenzhen is older than forty years",
  "🌀 台风预警，海边今天封闭，改天再来": "🌀 Typhoon warning — the seafront is closed today", "通信老厂，稳定，门槛比互联网大厂低。": "Veteran telecom firm: stable, easier to get into than internet giants.",
  "下楼到菜摊买一篮子菜，囤进冰箱慢慢做": "Pop downstairs for a basket of groceries to cook later", "沿登山道一路往上，山顶能看到海和城市": "Follow the trail up — sea and city views from the top",
  "在大梅沙海边上班，通勤远，但心情好。": "Work by Dameisha beach — long commute, good mood.", "旺角、天星小轮、茶餐厅，过关当天来回": "Mong Kok, the Star Ferry, a cha chaan teng — there and back in a day",
  "看看大厂的楼、咖啡厅和来来往往的打工人": "See the big-company buildings, cafés and busy staff", "眼力决定收益：捡漏转手能赚，踩坑就自用": "Your eye decides: flip a bargain for profit, or keep a dud",
  "踩沙、吹海风、看日落，周末人多要早点去": "Sand, sea breeze and sunset — go early on weekends", "在地标前打卡，集风景册（见下方打卡进度）": "Check in at the landmark for your scenery album",
  "刷牙、洗脸、整理自己，新的一天从卫生间开始": "Brush, wash, tidy up — the day starts in the bathroom", "刷手机、睡午觉，不花钱回血（穿睡衣恢复更多）": "Scroll and nap — free recovery (more in pyjamas)",
  "小公司什么都要干，工资一般，但没人管你几点到。": "At a small company you do everything; pay is average, but nobody checks when you arrive.",
  "回满能量，周六睡前自动交租（先演一段洗漱入睡）": "Full energy; rent is paid automatically on Saturday night",
  "话剧、音乐会、儿童剧，周末场次多，学生票更便宜": "Plays, concerts, children's shows — more on weekends, cheaper for students",
  "各方嘉宾带来的展陈挨个看，集章、看会徽背后的故事": "Tour the delegations' exhibits and collect stamps",
  "金融业的体面工作：准点下班多，但面试必须穿正装。": "A respectable finance job: usually home on time, but interviews need formal wear.",
  "深圳大部分公立博物馆、美术馆免费，提前在公众号预约": "Most public museums in Shenzhen are free — book ahead online",
  "新能源大厂招人多，门槛低，包吃，坪山离市区有点远。": "Big EV maker hiring lots: low bar, meals included, a bit far out in Pingshan.",
  "小毛病先问药师，要不要去医院、去哪家近，药师门儿清": "For small ailments ask the pharmacist — they know if and where to see a doctor",
  "对产品要求极高，面试看技术，进去能玩到最新的无人机。": "Obsessive about product; technical interviews; you get to fly the newest drones.",
  "在某安金融中心上班，深圳最高楼里看日落。面试要穿正装。": "Work in the An Finance Center, watching sunsets from Shenzhen's tallest tower. Interviews need formal wear.",
  "深圳的公园免费开放：绿道、湖边、草坪，走一圈整个人松下来": "Shenzhen's parks are free: greenways, lakes, lawns — a loop and you relax",
  "迷路、丢东西、遇到麻烦都可以进来；紧急情况直接打 110": "Lost, missing something or in trouble? Come in. Emergencies: call 110",
  "福利好、食堂出名，滨海大厦和大铲湾园区两个园区都能上班。": "Great perks and a famous canteen; work at either the Binhai tower or the Dachan Bay campus.",
  "地铁图、景点、医院和应急电话都印在上面，参会代表和游客都用得上": "Metro map, sights, hospitals and emergency numbers — handy for delegates and tourists",
  "感冒药、肠胃药、创可贴、防晒，药师会帮你挑；外籍人士可以把症状写在手机上给药师看": "Cold and stomach medicine, plasters, sunscreen — the pharmacist helps; foreigners can show symptoms typed on a phone",
  "派出所门口最安心": "Nowhere feels safer than outside a police station", "连本带收益回到存款": "Principal and returns go back to savings",
  "站章、图鉴、成就跨局保留：这一局 30 天过完，下一局接着集。": "Stamps, guide and achievements carry over: keep collecting in your next 30-day run.",
  "自动同步中": "auto-syncing", "· 别给陌生人": "· keep it private", "今日城市事件「": "Today's city event “", "海滩和海边景区今天关闭，打车加价 50%，地铁照常。": "Beaches and seafront sights are closed today; taxis +50%; metro runs normally.",
  "站（上下车、换乘、到站自动盖章）": "stations (stamped when you board, change or arrive)", "🏅 成就 · 点已解锁的戴上称号（别的玩家能看到）": "🏅 Achievements · wear an unlocked one as your title (others see it)",
  "进度存在这台设备的浏览器里（开了云存档也会存一份到服务器）。今天：": "Progress is stored in this browser (and on the server with cloud save). Today:",
  "🗺️ 地区面板 · ": "🗺️ Area · ", "一带": "", "🔥 连续上线": "🔥 Streak", "最长": "best", "已过完": "runs done", "局": "",
  "📌 固定": "📌 Pin", "📌 已固定": "📌 Pinned", "固定地区面板": "Pin the area panel", "取消固定地区面板": "Unpin the area panel", "固定出行导航": "Pin directions", "取消固定出行导航": "Unpin directions",
  "标签密度": "Label density", "🏷️简": "🏷️ Few", "🏷️标": "🏷️ Std", "🏷️全": "🏷️ All",
  // directions panel / minimap / map toolbar
  "收起导航": "Hide directions", "个地点（双城共": "places (both cities:", "个，含口岸/山区/风景区）": "incl. checkpoints, mountains, scenic areas)", "🟢 同城真人": "🟢 Real players here",
  "人（含你）": "(incl. you)", "🧑‍🤝‍🧑 街坊 NPC": "🧑‍🤝‍🧑 Neighbour NPCs", "位也在图上散步（名字后是今日心情）": "walking around too (today's mood after the name)",
  "出行方式 · 选好再点地点（或直接点地图上的建筑/标签前往）": "Travel mode · pick one, then a place (or tap a building/label on the map)",
  "最慢": "slowest", "慢": "slow", "摩托/电动车": "Moto / e-bike", "中速": "medium", "地铁": "Metro", "快": "fast", "城际/高铁": "Intercity / HSR", "最快": "fastest",
  "免费，最慢，耗能量": "Free, slowest, costs energy", "· 速度差别是真的：步行最慢，骑行快近一倍，电动车/公交再快，打车和": "· Speeds are real: walking is slowest, cycling nearly twice as fast, e-bike/bus faster, taxi and",
  "更快，高铁/城际最快——地图上人物的移动速度、实际到达时间都按这个来。公交/打车/": "faster, HSR/intercity fastest — the figure on the map and arrival times follow this. Bus/taxi/",
  "/高铁搭乘时都会弹车厢动画。": "/rail rides play a carriage scene.", "🚲 骑行全图开通：本城": "🚲 Bikes reach everywhere: all", "个地点——山顶、海滩、老街、景区——全都能骑到；余额不够付骑行费时免费骑，绝不拦路。": "places in this city — peaks, beaches, old streets, scenic areas; ride free if you can't pay.",
  "去哪里 · 点了就出发，选中的地点详情在右侧「📍 地点」里": "Where to · tap to go; details appear in 📍 Place on the right", "·有人": "· players here",
  "拖动旋转 · 滚轮/＋－缩放（右下角显示比例） · 点建筑或标签前往 · 左下小地图看全城、点它定位镜头 · 天色按当地真实时间、云雨按真实天气走 · 右下 ☀️🌇🌙 预览时间 · 🕐 回到真实时间 · 🎥 延时演示 · 🎬 电影镜头": "Drag to rotate · scroll/＋－ to zoom · tap a building or label to go · minimap bottom-left · sky follows local time and live weather · ☀️🌇🌙 preview time · 🕐 back to real time · 🎥 time-lapse · 🎬 cinematic camera",
  "🗺️ 小地图 ·": "🗺️ Minimap ·", "全城": "whole city", "收起 ▾": "Hide ▾", "⚪ 你 · 🟡 NPC/玩家 · 🔴 目的地 · 点图定位镜头": "⚪ You · 🟡 NPC/players · 🔴 destination · tap to move the camera",
  "💬 弹幕": "💬 Danmaku ", "开": "on", "关": "off", "🚄 切换城市 · 去": "🚄 Switch city · to ", "固定": "Pin",
  "跳到白天": "Jump to day", "跳到黄昏": "Jump to dusk", "跳到夜晚": "Jump to night", "回到真实时间：天色按深圳/惠州当地此刻走": "Back to real time",
  "延时演示：一昼夜30秒，看昼夜光影全程": "Time-lapse: a full day in 30 s", "关闭电影镜头": "Turn off cinematic camera", "当前缩放比例（⌂ 回到 100%）": "Zoom (⌂ resets to 100%)",
  "放大地图": "Zoom in", "缩小地图": "Zoom out", "重置视角": "Reset view", "收起小地图": "Hide minimap", "标签：精简（点一下切换）": "Labels: few (tap to change)", "标签：标准（点一下切换）": "Labels: standard (tap to change)", "标签：全部（点一下切换）": "Labels: all (tap to change)",
  "点空白处把地区面板竖着收起成右侧竖条": "Click outside to collapse the area panel", "固定：面板一直挂着，点地图空白处也不收起": "Pin: keep the panel open", "竖着收起地区面板，收成屏幕右侧的竖条，点竖条随时展开": "Collapse the area panel to the side rail",
  "竖着收起成右侧竖条，一直留在屏幕边上，点一下就展开": "Collapse to the side rail", "地点与联机面板": "Place and multiplayer panel", "固定：选了地点出发后面板也不收起": "Pin: stay open after choosing a place",
  "收起地图上的出行导航": "Hide directions", "地图全屏": "Fullscreen map", "搜索地点或地铁站": "Search places or stations", "打开地图上的出行导航": "Open directions",
  "刷新深圳真实天气": "Refresh Shenzhen weather", "竖着收起状态卡，收成屏幕左侧的竖排按钮": "Collapse the status card", "竖着收起，收成屏幕左侧的竖排按钮，点一下就展开": "Collapse to a side button",
  "展开：状态详情 / 峰会活动 / 城市速览": "Expand: status / Summit / city overview", "按场合换上睡衣": "Change into pyjamas",
  // place panel bits
  "🗺️ 地区面板 ·": "🗺️ Area ·", "👕 场合提示：这里更适合穿「": "👕 Dress tip: better to wear “", "），你现在穿的是「": "), you're wearing “", "睡衣": "pyjamas", "休闲装": "casual wear", "正装": "formal wear", "运动装": "sportswear", "雨衣": "raincoat",
  "换上睡衣": "Put on pyjamas", "在家穿睡衣：躺平恢复额外 +6 能量": "pyjamas at home: +6 extra energy when resting", "🛏️ 住宿场景": "🛏️ Places to stay", "酒店 / 青旅 / 民宿 / 租房 · 走进去看房间": "Hotels / hostels / B&Bs / rentals · step inside",
  "🏠 My home · 户型 / 衣柜 / 装修 / 家具": "🏠 My home · layout / wardrobe / decor / furniture", "家具": "Furniture", "件": "items", "最近：": "Latest: ", "地址": "Address", "价格": "Price", "时间": "Hours", "城市知识：": "City fact: ",
  "📷 真实经历 · 实拍": "📷 Real experience ·", "上一张实拍照片": "Previous photo", "下一张实拍照片": "Next photo",
  // metro map modal
  "地铁 / 城轨线网图": "Metro / rail network map", "全部运营线路 · 点站点选起点和终点": "All lines in service · tap stations for start and end", "全选": "All", "反选": "Invert", "○ 单选": "○ Single", "缩放": "Zoom",
  "放大到 200% 或只看 ≤3 条线时显示全部站名，鼠标停在站点上也能看站名": "All station names show at 200% or with ≤3 lines; hover a station to see its name", "线路数据 © OpenStreetMap contributors": "Line data © OpenStreetMap contributors",
  "起点 ·": "From ·", "终点 ·": "To ·", "再点一个站": "tap another station", "清除": "Clear", "📍 在地图上定位「": "📍 Show on map “", "示意线网图：按真实站点方位绘制，距离经压缩，非等比例测绘。": "Schematic: real station directions, compressed distances, not to scale.",
  "起点已选好，再点一个终点站就能规划路线。": "Start set — tap a destination station to plan the route.", "地铁线网图": "Metro network map", "关闭线网图": "Close the metro map", "显示全部线路": "Show all lines", "反选线路": "Invert lines",
  "单选模式：点一条线只显示这一条": "Single mode: tap a line to show only it", "单选模式：点一条线就只看这一条": "Single mode: tap a line to show only it", "深圳地铁线网示意图": "Shenzhen metro schematic", "清除起终点选择": "Clear start and end",
  "东莞·广州方向": "towards Dongguan · Guangzhou", "惠州南·惠州方向": "towards Huizhou South", "深圳北·深圳方向": "towards Shenzhen North",
  // daily modal / phone
  "📋 每日任务 · Day": "📋 Daily tasks · Day", "的一天，从签到开始": " — start the day with a check-in", "峰会倒计时": "Summit countdown", "🔥 连续上线第": "🔥 Day",
  "（真实日历，断一天从 1 重来，第 7 天起奖励最高）": "of your streak (real days; miss one and it restarts; max reward from day 7)", "Today's tasks · 完成点领取，奖励立刻飘字到账": "Today's tasks · claim when done",
  "去创业公司点「上班」": "Go to the startup and tap “Work”", "每日任务": "Daily tasks", "关闭每日任务": "Close daily tasks", "每日签到领奖励": "Daily check-in reward",
  "职业中心": "Career", "招聘广场": "Jobs", "点外卖": "Delivery", "手机银行": "Bank", "街坊社交": "Neighbours", "日历": "Calendar", "天气": "Weather", "记账本": "Ledger", "城市地图": "City map",
  "峰会资讯": "Summit news", "地铁通": "Metro", "城轨通": "Rail", "手机": "Phone", "我的家": "My home",
  "急救 120 · 报警 110 · 最近医院：": "Ambulance 120 · Police 110 · nearest hospital: ",
  "🗺️ 景点分布图": "🗺️ Places map", "打开景点分布图": "Open the places map", "关闭景点分布图": "Close the places map", "游戏地点": "Game places", "景点古迹": "Sights & history",
  "公园 · 山海": "Parks · hills & sea", "文化 · 校园": "Culture · campuses", "医院 · 公共服务": "Hospitals · services", "搜地点名…": "Search places…", "📍 在地图上定位": "📍 Show on map", "前往 →": "Go →",
  "点一个点看详情；名字放不下时会自动隐藏，放大能看到更多。红圈是你现在的位置。地点数据 © OpenStreetMap contributors。": "Tap a point for details; names hide when they would overlap — zoom in to see more. The red ring is you. Place data © OpenStreetMap contributors.",
  // misc
  "知道了": "Got it", "关闭": "Close", "中文": "中文", "深惠人生战绩.png": "shenzhen-life.png", "我的深惠人生战绩卡": "My Shenzhen life card",
  "真实天气暂时取不到": "Live weather unavailable", "🌡️ 实况加载中…": "🌡️ Loading weather…", "（网络不通，这是上次的缓存）": "(offline — cached)",
  "职场新人": "Rookie", "业务骨干": "Core staff", "小组主管": "Team lead", "部门经理": "Manager", "城市合伙人": "City partner",
  "上班": "Work", "加班": "Overtime", "交租": "Rent", "今日": "Today", "已完成": "Done", "进行中": "In progress", "已结束": "Ended", "无路线": "No route",
  "城中村出租屋": "Urban-village flat", "海边出租屋": "Seaside flat", "舒适度": "Comfort", "人脉": "Network", "技能": "Skill", "职级": "Rank",
  "上班次数": "Work days", "加班次数": "Overtime nights", "干饭次数": "Meals", "最高存款": "Peak savings", "理财余额": "Investments", "最终存款": "Final savings",
  "存活天数": "Days survived", "已交房租": "Rent paid", "累计收入": "Total earned",
};

/* ---- names from data ---- */
const COMPANY_EN: Record<string, string> = {
  startup: "Tech Park Startup", tencent: "Xun Tech", bytedance: "Yin Group", huawei: "Wei Tech", dji: "Jiang Robotics", baidu: "Du Tech",
  zte: "Xing Telecom", cmb: "Shang Bank", pingan: "An Group", vanke: "Ke Group", byd: "Di Auto",
};
const ACH_EN: Record<string, [string, string]> = {
  stamp1: ["Metro Rookie", "Collect your first station stamp"], stamp50: ["Commuter Pro", "Collect 50 station stamps"], stamp150: ["Walking Metro Map", "Collect 150 station stamps"],
  stampAll: ["Metro Master", "Collect every Shenzhen station"], line1: ["End to End", "Complete one whole line"], line5: ["Five-Line Score", "Complete 5 lines"],
  atlas20: ["City Wanderer", "Visit 20 real places"], atlas100: ["Shenzhen Know-It-All", "Visit 100 real places"], bigco: ["Big-Tech Badge", "Join a big company"],
  hopper: ["Job Hopper", "Work at 4 different companies"], streak7: ["Seven Straight", "Play 7 days in a row"], streak30: ["Shenzhen Veteran", "Play 30 days in a row"],
  runs3: ["Three Lives", "Finish 3 full 30-day runs"], gifts10: ["Kind Neighbour", "Send 10 gifts to other players"], events6: ["City Watcher", "Experience 6 different city events"],
};
const GOAL_EN: Record<string, string> = {
  stamps: "Collect 10 new station stamps", places: "Visit 6 new places", work: "Work 6 times", rides: "Take 8 metro rides", interviews: "Interview at 2 companies", social: "Send or receive 2 gifts",
};
const KIND_EN: Record<string, string> = {
  park: "Park", nature: "Wetland / reserve", beach: "Beach", peak: "Peak", mall: "Mall", hospital: "Hospital", university: "University", library: "Library",
  museum: "Museum / gallery", theatre: "Theatre", stadium: "Stadium", themepark: "Theme park", attraction: "Sight", historic: "Historic site",
  police: "Police", pharmacy: "Pharmacy", info: "Visitor centre",
};
/** Short map labels whose full name has no LOC_EN entry. */
const SHORT_EN: Record<string, string> = {
  "公司": "Office", "商场": "Mall", "出租屋": "My flat", "健身房": "Gym", "医院": "Hospital", "银行": "Bank", "地铁站": "Metro", "夜市": "Night market",
  "酒吧街": "Bar street", "图书馆": "Library", "北站": "North Station", "机场": "Airport", "邮轮港": "Cruise port", "海边公园": "Bay park", "酒店青旅": "Hotel & hostel",
  "前海会议中心": "Qianhai Convention Center", "国际交流中心": "Int'l Exchange Center", "太子湾晚宴": "Prince Bay Banquet", "春茧体育中心": "Spring Cocoon Stadium",
  "盐田栈道": "Yantian Boardwalk", "大运中心": "Universiade Center", "海上世界艺术中心": "Sea World Arts Center",
};
const ROADS_EN: Record<string, string> = {
  "滨海大道": "Binhai Blvd", "深南大道": "Shennan Blvd", "北环大道": "Beihuan Blvd", "南海大道": "Nanhai Blvd", "南坪快速": "Nanping Expwy", "机场高速": "Airport Expwy",
  "深盐路 · 沿海高速": "Shenyan Rd · Coastal Expwy", "云巴": "Skyrail", "高铁": "HSR", "穗深城际": "Guangzhou–Shenzhen Intercity", "6号线支线": "Line 6 Branch",
  "第": "Day", "天": "", "11 月": "Nov", "日 ·": " ·", "周一": "Mon", "周二": "Tue", "周三": "Wed", "周四": "Thu", "周五": "Fri", "周六": "Sat", "周日": "Sun",
  "实况": "live", "🚄 去": "🚄 To ", "任务": "Tasks", "· 打卡": "· Check-ins", "🚇 去打卡": "🚇 Go check in", "开幕日志愿引导": "Opening-day volunteer guide",
  "台风预警": "Typhoon warning", "绿色出行日": "Green Travel Day", "商场大促": "Mall sale", "夜市美食节": "Night-market food festival", "发奖金日": "Bonus day",
  "公园音乐会": "Concert in the park", "大厂开放日": "Big-company open day", "地铁站快闪": "Metro flash mob", "深圳第一峰": "Shenzhen's highest peak", "深圳第二峰": "2nd highest peak",
};
/** Words used by the last-resort pass (longest first). */
const WORDS: Record<string, string> = {
  "大部晴朗": "Mostly clear", "晴间多云": "Partly cloudy", "雷阵雨": "Thunderstorms", "毛毛雨": "Drizzle", "阵雨": "Showers", "小雨": "Light rain", "中雨": "Rain", "大雨": "Heavy rain", "暴雨": "Rainstorm",
  "多云": "Cloudy", "阴": "Overcast", "晴": "Clear", "雾": "Fog", "深圳实况": "Shenzhen live", "惠州实况": "Huizhou live", "实况": "live",
  "食材": "Groceries", "体质": "Fitness", "技能": "Skill", "现金": "cash", "转入理财": "into investments", "可能": "maybe", "约一半概率转手": "~50% chance to resell for", "人情": "Goodwill", "关系": "Bond",
  "雾凇": "Rime fog", "小毛毛雨": "Light drizzle", "浓毛毛雨": "Heavy drizzle", "冻毛毛雨": "Freezing drizzle", "冻雨": "Freezing rain", "小雪": "Light snow", "中雪": "Snow", "大雪": "Heavy snow", "雪粒": "Snow grains",
  "强阵雨": "Heavy showers", "强阵雪": "Heavy snow showers", "阵雪": "Snow showers", "强雷阵雨伴冰雹": "Severe thunderstorm with hail", "雷阵雨伴冰雹": "Thunderstorm with hail",
  "还有": "in", "天气": "Weather", "号线": "", "深圳": "Shenzhen", "惠州": "Huizhou", "公里": "km", "分钟": "min", "免费": "free", "能量": "Energy", "心情": "Mood", "经验": "XP", "人脉": "Network",
};
const WORD_KEYS = Object.keys(WORDS).sort((a, b) => b.length - a.length);
let built = false;
function buildDataNames(): void {
  if (built) return;
  built = true;
  for (const [k, m] of Object.entries(PLACE_KINDS)) { const en = KIND_EN[k]; if (en) EN[m.label] ??= en; }
  for (const [zh, en] of Object.entries(SHORT_EN)) EN[zh] ??= en;
  for (const [zh, en] of Object.entries({ ...SZ_STATION_EN_AUTO, ...SZ_STATION_EN })) { EN[zh] ??= en; EN[`${zh}站`] ??= en.endsWith("Station") ? en : `${en} Station`; }
  // a short label only gets the full English name when it is specific (not "医院", "商场" …)
  for (const ck of ["sz", "hz"] as const) for (const l of getLocations(ck)) { const en = SHORT_EN[l.short] ?? (l.short.length >= 3 ? LOC_EN[l.name] : undefined); if (en) EN[l.short] ??= en; }
  for (const [zh, en] of Object.entries(ROADS_EN)) EN[zh] ??= en;
  for (const [zh, en] of Object.entries(LOC_EN)) EN[zh] ??= en;
  for (const p of placesForCity("sz")) { const en = p.en ?? SZ_PLACE_EN_AUTO[p.name]; if (en) EN[p.name] ??= en; }
  for (const c of COMPANIES) { const en = COMPANY_EN[c.id]; if (en) { EN[c.name] ??= en; EN[c.short] ??= en; } }
  for (const a of ACHIEVEMENTS) { const t = ACH_EN[a.id]; if (t) { EN[a.title] ??= t[0]; EN[a.desc] ??= t[1]; } }
  for (const g of WEEKLY_GOALS) { const en = GOAL_EN[g.id]; if (en) EN[g.name] ??= en; }
  for (const [k, m] of Object.entries(PLACE_KINDS)) { const en = KIND_EN[k]; if (en) EN[m.label] ??= en; }
  for (const [zh, en] of Object.entries(EN_EXACT)) EN[zh] ??= en;
  TEMPLATES = EN_TEMPLATES.map(([zh, en]) => {
    const lits = zh.split(/\{\d+\}/);
    const order = [...zh.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]));
    const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^${lits.map(esc).join("(.+?)")}$`, "s");
    const key = lits.reduce((a, b) => (b.length > a.length ? b : a), "");
    return { re, key, en, order, len: zh.length };
  }).sort((a, b) => b.key.length - a.key.length || b.len - a.len);
}
type Template = { re: RegExp; key: string; en: string; order: number[]; len: number };
let TEMPLATES: Template[] = [];
/** A value captured from a template: a name, a number, or a phrase that may itself translate. */
const fillEN = (v: string): string => (EN[v] ?? EN[`${v}站`] ?? translateText(v)?.trim() ?? v);
function applyTemplate(t: string): string | null {
  for (const tp of TEMPLATES) {
    if (!t.includes(tp.key)) continue;
    const m = tp.re.exec(t);
    if (!m) continue;
    const vals: Record<number, string> = {};
    tp.order.forEach((n, i) => { vals[n] = m[i + 1]!; });
    return tp.en.replace(/\{(\d+)\}/g, (_x, n: string) => fillEN(vals[Number(n)] ?? ""));
  }
  return null;
}

/* ---- templated strings ---- */
const PATTERNS: [RegExp, string | ((...m: string[]) => string)][] = [
  [/^第 (\d+) 天$/, "Day $1"], [/^(\d+) 人在线$/, "$1 online"], [/^约 ([\d.]+) 公里/, "~$1 km"], [/预计约 (\d+) 分钟/, "about $1 min"],
  [/^共 (\d+) 站$/, "$1 stops"], [/^还有 (\d+) 站/, "$1 stops left"], [/^票价 ¥(\d+)$/, "Fare ¥$1"], [/^日薪约 ¥([\d,]+)$/, "≈ ¥$1/day"],
  [/^心情 \+(\d+) · 免费$/, "Mood +$1 · free"], [/^能量 -(\d+)$/, "Energy -$1"], [/^能量 \+(\d+)$/, "Energy +$1"],
  [/^连续上线第 (\d+) 天/, "Day $1 of your streak"], [/^🔥 连续上线 (\d+) 天$/, "🔥 $1-day streak"], [/^最长 (\d+) 天$/, "best $1 days"], [/^已过完 (\d+) 局$/, "$1 runs finished"],
  [/^领 ¥(\d+)$/, "Claim ¥$1"], [/^🎫 地铁集章 · (\d+)\/(\d+) 站/, "🎫 Metro stamps · $1/$2 stations"], [/^近「(.+)」站$/, "near $1 Station"],
  [/^(\d+(?:\/\d+)?)号线$/, "Line $1"], [/^有轨(\d)号线$/, "Tram $1"], [/^(\d+)号线（(.+)）$/, "Line $1"],
  [/^· 还有 (\d+) 天$/, "· $1 days to go"], [/^11 月 (\d+) 日$/, "Nov $1"], [/^11 月 (\d+)–(\d+) 日$/, "Nov $1–$2"], [/^(.+) ([\d.]+)m · (.+)$/, (_m, a, h, b) => `${EN[a!] ?? a} ${h}m · ${EN[b!] ?? b}`],
];
const nameEN = (zh: string) => EN[zh] ?? EN[`${zh}站`] ?? zh;
PATTERNS.push(
  [/^前往(.+)$/, (_m, n) => `Go to ${nameEN(n!)}`],
  [/^(.+) · 点一下去这个站$/, (_m, n) => `${n} · tap to go`],
  [/^(.+) · (.+) · 最近站：(.+)$/, (_m, a, b, c) => `${nameEN(a!)} · ${b} · nearest station: ${nameEN(c!)}`],
  [/^隐藏(.+)$/, (_m, n) => `Hide ${nameEN(n!)}`], [/^打开(.+)$/, (_m, n) => `Open ${nameEN(n!)}`], [/^展开(.+)$/, (_m, n) => `Expand ${nameEN(n!)}`],
  [/^出行方式(.+)，速度(.+)$/, (_m, a, b) => `Travel by ${nameEN(a!)}, ${nameEN(b!)}`],
  [/^在大地图上定位(.+)$/, (_m, n) => `Show ${nameEN(n!)} on the map`], [/^线网图缩放到 (\d+)%$/, "Zoom metro map to $1%"],
  [/^当前缩放 (\d+)%$/, "Zoom $1%"], [/^存钱目标进度 (\d+)%$/, "Savings goal $1%"], [/^领取连续上线奖励 · ¥(\d+)$/, "Claim streak reward · ¥$1"],
  [/^(.+) · Line (.+)$/, (_m, a, b) => `${nameEN(a!)} · Line ${b}`],
  [/^(.+)↔(.+)$/, (_m, a, b) => `${trOr(a!)}↔${trOr(b!)}`],
  [/^按顺序到达每一站自动打卡：每站 \+(.+?)，走完全程再 \+(.+?)。在地图上点地点名、或坐车过去都算到达。$/, "Reach each stop in order to check in automatically: +$1 per stop, and +$2 more for finishing. Tapping a place on the map or riding there both count."],
  // player list / ranks: "Alex（你）"
  [/^(.+)（你）$/, (_m, n) => `${n} (you)`],
  // neighbours: "陈伯·小区保安 😐"
  [/^([^·\s]{1,10})·([^·]+?)(\s+\p{Extended_Pictographic}\uFE0F?)?$/u, (_m, a, b, e) => `${nameEN(a!)} · ${trOr(b!)}${e ?? ""}`],
  // feed / chat: "阿强：今天…"
  [/^([^：\s]{1,12})：(.+)$/s, (_m, a, b) => `${nameEN(a!)}: ${trOr(b!)}`],
  // server-written feed lines
  [/^(.*?)\s*来到了(深圳|惠州)，开始过日子$/, (_m, n, c) => `${n ? `${n} ` : ""}arrived in ${nameEN(c!)} and started a new life`],
  [/^(.*?)\s*过完了 30 天，结局是「(.+)」，存款 ¥([\d,]+)$/, (_m, n, r, m) => `${n ? `${n} ` : ""}finished 30 days — ending “${trOr(r!)}”, savings ¥${m}`],
  [/^(.*?)\s*给(.+)送了(.+)$/, (_m, n, to, g) => `${n ? `${n} ` : ""}sent ${to} ${trOr(g!)}`],
);
const trOr = (v: string) => EN[v] ?? translateText(v)?.trim() ?? v;
const EMOJI_PREFIX = /^((?:\p{Extended_Pictographic}|\uFE0F|\u200D|[\u2600-\u27BF])+\s*)(.+)$/u;

function translateText(raw: string): string | null {
  const t = raw.trim();
  if (!t || !/[一-鿿]/.test(t)) return null;
  const lead = raw.slice(0, raw.indexOf(t[0]!));
  const tail = raw.slice(raw.lastIndexOf(t[t.length - 1]!) + 1);
  const whole = EN[t];
  if (whole !== undefined) return lead + whole + tail;
  const viaTemplate = applyTemplate(t);
  if (viaTemplate !== null) return lead + viaTemplate + tail;
  for (const [re, rep] of PATTERNS) if (re.test(t)) return lead + t.replace(re, rep as string) + tail;
  // "🚇 国贸", "🏙️ 前海会议中心": keep the emoji, translate the rest
  const em = EMOJI_PREFIX.exec(t);
  if (em && em[2] && /[\u4e00-\u9fff]/.test(em[2])) {
    const inner = translateText(em[2]);
    if (inner !== null) return lead + em[1] + inner.trim() + tail;
  }
  if (t.includes(" · ")) {
    const parts = t.split(" · ");
    const out = parts.map((p) => EN[p.trim()] ?? translateText(p)?.trim() ?? p);
    if (out.some((o, i) => o !== parts[i])) return lead + out.join(" · ") + tail;
  }
  // last resort: swap known words; keep it only if it removed Chinese
  let w = t;
  for (const k of WORD_KEYS) if (w.includes(k)) w = w.split(k).join(` ${WORDS[k]} `);
  w = w.replace(/\s{2,}/g, " ").trim();
  const cjk = (x: string) => (x.match(/[\u4e00-\u9fff]/g) ?? []).length;
  if (w !== t && cjk(w) < cjk(t) && cjk(w) <= 2) return lead + w + tail;
  return null;
}

const ATTRS = ["placeholder", "aria-label", "title"];
function translateNode(n: Node): void {
  if (n.nodeType === Node.TEXT_NODE) {
    const v = n.nodeValue ?? "";
    const tr = translateText(v);
    if (tr !== null && tr !== v) n.nodeValue = tr;
    return;
  }
  if (n.nodeType !== Node.ELEMENT_NODE) return;
  const el = n as Element;
  if (el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "TEXTAREA") return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v) { const tr = translateText(v); if (tr !== null && tr !== v) el.setAttribute(a, tr); }
  }
  for (const c of Array.from(el.childNodes)) translateNode(c);
}

let observer: MutationObserver | null = null;
/** Start translating the page into `lang` (no-op for Chinese). */
export function installTranslator(lang: Lang): void {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
  if (lang === "zh" || observer) return;
  buildDataNames();
  document.title = EN[document.title] ?? document.title;
  translateNode(document.body);
  const pending = new Set<Node>();
  let scheduled = false;
  const flush = () => { scheduled = false; observer?.disconnect(); for (const n of pending) translateNode(n); pending.clear(); observer?.observe(document.body, OPTS); };
  const OPTS: MutationObserverInit = { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS };
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "childList") m.addedNodes.forEach((a) => pending.add(a));
      else pending.add(m.target);
    }
    // a timer, not requestAnimationFrame: rAF is paused in background tabs
    if (!scheduled) { scheduled = true; window.setTimeout(flush, 30); }
  });
  observer.observe(document.body, OPTS);
}
