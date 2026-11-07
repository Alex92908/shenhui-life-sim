// Real-photo experiences （真实经历）: the big map is the route layer; every
// popped-up experience is anchored in REAL photographs of the real place.
// - SCENE_PHOTOS: per life-stage set, a real photo used as the scene's
//   backdrop and back-wall texture, so the 3D actor performs IN FRONT OF /
//   INSIDE the real place (Shenzhen Bay Park, a Line 11 carriage, Shenzhen
//   North Station, Dongmen at night…).
// - GUIDE: the 「认识深圳 / 认识惠州」 field guide. Each entry matches a game
//   location by name and carries real, sourced info (address / price /
//   hours / tip), a bilingual city fact, and an NPC guide who tells a real
//   story about the place. Checking in at the place unlocks it in the
//   album; the photo quiz and the day-tour routes are built from the same
//   entries. Provenance for every photo and fact is recorded in
//   DATA-PLAN.md ("Real-photo experiences" section).
import scenePark from "./assets/scene-park.jpg";
import sceneMetro from "./assets/scene-metro.jpg";
import sceneTrain from "./assets/scene-train.jpg";
import sceneStation from "./assets/scene-station.jpg";
import sceneConcourse from "./assets/scene-concourse.jpg";
import scenePlatform from "./assets/scene-platform.jpg";
import sceneOffice from "./assets/scene-office.jpg";
import sceneRestaurant from "./assets/scene-restaurant.jpg";
import sceneMarket from "./assets/scene-market.jpg";
import sceneMall from "./assets/scene-mall.jpg";
import sceneKitchen from "./assets/scene-kitchen.jpg";
import sceneBedroom from "./assets/scene-bedroom.jpg";
import sceneBathroom from "./assets/scene-bathroom.jpg";
import sceneGym from "./assets/scene-gym.jpg";
import sceneBus from "./assets/scene-bus.jpg";
import sceneTaxi from "./assets/scene-taxi.jpg";
import sceneHome from "./assets/scene-home.jpg";
import placeWow from "./assets/place-wow.jpg";
import placeHappy from "./assets/place-happy.jpg";
import placeLianhua from "./assets/place-lianhua.jpg";
import placeBay from "./assets/place-bay.jpg";
import placeDameisha from "./assets/place-dameisha.jpg";
import placeHq1 from "./assets/place-hq1.jpg";
import placeHq2 from "./assets/place-hq2.jpg";
import placeDm1 from "./assets/place-dm1.jpg";
import placeDm2 from "./assets/place-dm2.jpg";
import placeSzb1 from "./assets/place-szb1.jpg";
import placeSzb2 from "./assets/place-szb2.jpg";
import placeXh1 from "./assets/place-xh1.jpg";
import placeXh2 from "./assets/place-xh2.jpg";
import placeLf1 from "./assets/place-lf1.jpg";
import placeLf2 from "./assets/place-lf2.jpg";
import placeSy from "./assets/place-sy.jpg";

/** LifeSet name -> real photo backdrop for the acted 3D stage. */
export const SCENE_PHOTOS: Record<string, string> = {
  park: scenePark,
  metro: sceneMetro,
  train: sceneTrain,
  station: sceneStation,
  concourse: sceneConcourse,
  platform: scenePlatform,
  office: sceneOffice,
  restaurant: sceneRestaurant,
  market: sceneMarket,
  mall: sceneMall,
  kitchen: sceneKitchen,
  bedroom: sceneBedroom,
  bathroom: sceneBathroom,
  gym: sceneGym,
  bus: sceneBus,
  taxi: sceneTaxi,
  home: sceneHome,
};

export interface GuidePlace {
  key: string;
  cityKey: "sz" | "hz";
  /** game location name this entry belongs to */
  locName: string;
  nameEn: string;
  photos: string[];
  address: string;
  price: string;
  hours: string;
  tip: string;
  fact: string;
  factEn: string;
  npc: string;
  story: string;
  sourceName: string;
  sourceUrl: string;
}

export const GUIDE: GuidePlace[] = [
  {
    key: "wow", cityKey: "sz", locName: "世界之窗", nameEn: "Window of the World",
    photos: [placeWow],
    address: "南山区华侨城深南大道 9037 号", price: "全日票成人 ¥220 · 夜场 ¥120 起", hours: "9:00–21:30（夜场 18:00 起）",
    tip: "工作日人少；只想看灯光和建筑，买夜场票更划算。",
    fact: "48 万㎡的园子里按比例仿建了 130 多处世界名胜——埃菲尔铁塔、金字塔、泰姬陵，一天走遍五大洲。",
    factEn: "Over 130 world landmarks rebuilt to scale in one park — five continents in a single day.",
    npc: "陈伯", story: "陈伯说，1993 年开园他头一个月就来了，那会儿深南大道两边还有农田；现在站在铁塔下往外看，全是高楼。",
    sourceName: "深圳本地宝 · 世界之窗攻略", sourceUrl: "https://sz.bendibao.com/jingdian/shijiezhichuang/",
  },
  {
    key: "happy", cityKey: "sz", locName: "欢乐谷", nameEn: "Happy Valley Shenzhen",
    photos: [placeHappy],
    address: "南山区侨城西街 18 号", price: "全日票成人约 ¥230 · 夜场约 ¥100", hours: "10:00–21:30",
    tip: "一开园先冲热门过山车，越晚排队越长；夏天玛雅水公园要另带泳衣。",
    fact: "1998 年开园，是华侨城的第一代主题乐园；照片里是玛雅水公园的大喇叭滑道。",
    factEn: "Opened in 1998 as OCT's first theme park; the slide in the photo is in its Maya Water Park.",
    npc: "子健", story: "子健说他小学春游第一次坐过山车就是在这儿，下来腿软了一下午，现在带娃来玩还是先冲雪山飞龙。",
    sourceName: "深圳本地宝 · 欢乐谷详情", sourceUrl: "https://m.bendibao.com/jingdian/shenhuanlegu/",
  },
  {
    key: "lianhua", cityKey: "sz", locName: "莲花山公园", nameEn: "Lianhuashan Park",
    photos: [placeLianhua],
    address: "福田区红荔路 6030 号", price: "免费 · 免预约", hours: "6:00–23:00（22:30 停止入园）",
    tip: "傍晚登顶是顺光，看福田 CBD 日落最好；风筝广场周末最热闹。",
    fact: "山顶广场矗立着邓小平铜像；山下 2 万㎡的风筝广场，是深圳人周末放风筝的老地方。",
    factEn: "A bronze Deng Xiaoping statue crowns the summit; the kite lawn below is a weekend institution.",
    npc: "王姨", story: "王姨每周来放风筝。她说站在山顶往南望，就是特区四十多年长出来的样子。",
    sourceName: "深圳市城市管理和综合执法局", sourceUrl: "https://cgj.sz.gov.cn/xsmh/gysz/twf/dgwy/content/post_10841225.html",
  },
  {
    key: "bay", cityKey: "sz", locName: "深圳湾公园", nameEn: "Shenzhen Bay Park",
    photos: [placeBay],
    address: "深圳湾沿岸 · 地铁 9 号线深圳湾公园站 D2 口", price: "免费", hours: "6:00–23:00",
    tip: "日落前半小时到海边最佳；冬季清晨有成群候鸟，记得带外套，海边风大。",
    fact: "约 13 公里滨海休闲带串起 14 个主题园，隔着深圳湾，对岸就是香港的山。",
    factEn: "Some 13 km of waterfront and 14 themed gardens, facing Hong Kong right across the bay.",
    npc: "阿琳", story: "阿琳说退潮时滩涂上有弹涂鱼跳来跳去，白鹭站在红树林边上等开饭——她下班常骑车来这儿吹风。",
    sourceName: "深圳市政府在线", sourceUrl: "https://www.sz.gov.cn/ztfw/gysy/wyw_183970/ywzsk_184570/content/post_12660949.html",
  },
  {
    key: "dameisha", cityKey: "sz", locName: "大梅沙海滨公园", nameEn: "Dameisha Beach Park",
    photos: [placeDameisha],
    address: "盐田区盐梅路 105 号", price: "免费入园", hours: "6:30–23:00（23:00 清场）",
    tip: "地铁 8 号线大梅沙站直达；旺季周末自驾前往要提前预约通行。",
    fact: "约 1.8 公里金色沙滩，1999 年建成开放，是深圳最老牌的免费海滨浴场。",
    factEn: "About 1.8 km of golden sand, opened in 1999 — Shenzhen's classic free public beach.",
    npc: "郭叔", story: "郭叔年轻时在盐田港开车，他说九十年代来大梅沙还要翻山，现在地铁直接开到沙滩边上。",
    sourceName: "深圳本地宝 · 大梅沙海滨公园", sourceUrl: "https://m.bendibao.com/tour/jingdianbao/detail.php?id=20874",
  },
  {
    key: "hq", cityKey: "sz", locName: "华强北电子市场", nameEn: "Huaqiangbei Electronics Market",
    photos: [placeHq1, placeHq2],
    address: "福田区华强北路 · 地铁华强北站", price: "淘货多可议价 · 配件明码为主", hours: "商场约 9:30–22:00",
    tip: "先绕一圈一米柜台比三家再出手；买整机当场验机、开发票。",
    fact: "「中国电子第一街」：鼎盛时一节一米柜台月租炒到几十万，如今转型智能硬件、无人机和美妆。",
    factEn: "China's No.1 electronics street — one-metre counters once rented for fortunes; now it's drones and smart hardware.",
    npc: "大芬姐", story: "大芬姐在赛格摆过柜台：“以前发货用麻袋装，现在的小哥背个双肩包，包里就是一家公司的全部库存。”",
    sourceName: "PandaHoHo · 深圳科技旅行地图", sourceUrl: "https://pandahoho.com/zh/triplists/shenzhen-a-tech-traveler-s-city-map",
  },
  {
    key: "dongmen", cityKey: "sz", locName: "东门夜市食街", nameEn: "Dongmen Old Street",
    photos: [placeDm1, placeDm2],
    address: "罗湖区东门步行街 · 地铁老街站", price: "小吃人均 ¥30–60", hours: "食街约 10:00–23:00 · 越夜越热闹",
    tip: "东门町美食城在二楼，别只逛地面一层；网红小吃排队长的先拍照再决定。",
    fact: "东门一带清代叫「深圳墟」，是深圳地名的源头；如今的老街步行街是几代深圳人逛街吃小吃的起点。",
    factEn: "Dongmen was 'Shenzhen Market' in Qing times — the origin of the city's name, and still its snack-street heart.",
    npc: "陈伯", story: "陈伯说四十年前东门还是骑楼墟市，他的第一条牛仔裤、第一块电子表，都是在这儿买的。",
    sourceName: "中国经济网 · 东门老街", sourceUrl: "http://www.ce.cn/xwzx/gnsz/gdxw/202512/t20251214_2640737.shtml",
  },
  {
    key: "sznorth", cityKey: "sz", locName: "深圳北站", nameEn: "Shenzhen North Station",
    photos: [placeSzb1, placeSzb2],
    address: "龙华区民塘路", price: "高铁票按里程计价", hours: "约 5:00–24:00（末班车后清站）",
    tip: "东西两个广场都能进站；节假日至少提前 40 分钟到，别卡点。",
    fact: "广深港高铁与厦深铁路在这里交汇，是华南最大的高铁枢纽之一；从这里坐高铁半小时就到惠州南站。",
    factEn: "Where the Guangzhou–Shenzhen–Hong Kong and Xiamen–Shenzhen HSR lines meet — one of South China's biggest rail hubs.",
    npc: "老周", story: "老周跑了十几年长途车，他说北站刚开那几年周边还是工地，现在出站就是商场和写字楼了。",
    sourceName: "顶端新闻 · 深圳北站", sourceUrl: "https://www.topnews.cn/news/145DD2E646BD4B70",
  },
  {
    key: "xihu", cityKey: "hz", locName: "惠州西湖", nameEn: "Huizhou West Lake",
    photos: [placeXh1, placeXh2],
    address: "惠城区环城西路 2 号", price: "主景区免费 · 泗洲塔登塔约 ¥10", hours: "8:00–22:00（21:30 停止入园）",
    tip: "平湖门进，沿苏堤走到泗洲塔；傍晚亮灯后夜游最美，游船单独收费。",
    fact: "苏东坡谪居惠州时捐资修苏堤、建西新桥，还写下「日啖荔枝三百颗，不辞长作岭南人」。",
    factEn: "Su Dongpo, exiled here in the Song dynasty, funded the Su Causeway — and wrote his famous lychee lines here.",
    npc: "林婶", story: "林婶说她小时候泗洲塔下还是菜地，逢年过节才舍得划一回船；现在外地游客比本地人还多。",
    sourceName: "携程攻略 · 惠州西湖", sourceUrl: "https://gs.ctrip.com/html5/you/sight/huizhou213/22852.html",
  },
  {
    key: "luofu", cityKey: "hz", locName: "罗浮山", nameEn: "Mount Luofu",
    photos: [placeLf1, placeLf2],
    address: "博罗县长宁镇罗浮山风景区", price: "门票成人 ¥54", hours: "7:00–18:00",
    tip: "索道上站只到半山腰；要登飞云顶请预留 2 小时以上，山脚先买好水。",
    fact: "主峰飞云顶海拔 1296 米；东晋葛洪在这里炼丹、写下《抱朴子》，罗浮山因此成了道教名山，人称岭南第一山。",
    factEn: "Peak Feiyunding rises 1,296 m; Ge Hong brewed elixirs and wrote Baopuzi here in the 4th century.",
    npc: "郭叔", story: "郭叔说山里的冲虚古观香火最旺，葛洪当年炼丹的药池还在；爬山前先在山脚吃碗山水豆腐花。",
    sourceName: "Trip.com · 罗浮山风景区", sourceUrl: "https://my.trip.com/travel-guide/attraction/boluo/luofu-mountain-scenic-area-81227?curr=MYR&locale=zh-MY",
  },
  {
    key: "shuangyue", cityKey: "hz", locName: "双月湾海边", nameEn: "Double Moon Bay",
    photos: [placeSy],
    address: "惠东县平海镇双月湾", price: "海滩免费 · 观景台免费", hours: "全天开放（浴场时段以公告为准）",
    tip: "登大星山观景台，左右两湾同框才是完整的「双月」；左湾看日出，右湾看日落。",
    fact: "左湾水平如镜、右湾波涛汹涌，两道半月形海湾并排，被大星山隔成一静一动。",
    factEn: "Two crescent bays side by side — the left mirror-calm, the right surf-pounded — split by Daxing Mountain.",
    npc: "阿强", story: "阿强说小时候跟阿爸出海收网，天没亮左湾的渔船灯一排排的；现在他带客人出海看日出，还是这片海。",
    sourceName: "携程 · 双月湾简介", sourceUrl: "http://raysuo.com.cn/p/5oOg5bee5Y+M5pyI5rm+566A5LuL.html",
  },
];

export function guideForLocName(name: string): GuidePlace | null {
  return GUIDE.find((g) => g.locName === name) ?? null;
}

export interface DayTour {
  id: string;
  cityKey: "sz" | "hz";
  name: string;
  nameEn: string;
  line: string;
  stops: string[]; // game location names, in order
  rewardPerStop: number;
  rewardFinish: number;
}

export const TOURS: DayTour[] = [
  {
    id: "sz-line1", cityKey: "sz",
    name: "1 号线东行一日游", nameEn: "Line 1 Eastbound Day Tour",
    line: "🚇 地铁 1 号线（罗宝线）东行 · 华侨城 → 老城根",
    stops: ["世界之窗", "欢乐谷", "华强北电子市场", "东门夜市食街"],
    rewardPerStop: 30, rewardFinish: 150,
  },
  {
    id: "hz-west", cityKey: "hz",
    name: "西湖 · 江北一日游", nameEn: "West Lake & Jiangbei Day Tour",
    line: "🚆 莞惠城际西湖东站上岸 · 湖边 → 红花湖 → 江北 → 东江",
    stops: ["惠州西湖", "红花湖骑行站", "惠州博物馆", "东江公园"],
    rewardPerStop: 30, rewardFinish: 150,
  },
];

export function tourForCity(cityKey: "sz" | "hz"): DayTour {
  return TOURS.find((t) => t.cityKey === cityKey) ?? TOURS[0]!;
}
