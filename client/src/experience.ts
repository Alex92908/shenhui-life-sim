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
import placeSy2 from "./assets/place-sy2.jpg";
import placeWow2 from "./assets/place-wow2.jpg";
import placeDameisha2 from "./assets/place-dameisha2.jpg";
import placeHejiang from "./assets/place-hejiang.jpg";
import placeHejiang2 from "./assets/place-hejiang2.jpg";
import placeTurtle from "./assets/place-turtle.jpg";
import placeTurtle2 from "./assets/place-turtle2.jpg";
import placeXunliao from "./assets/place-xunliao.jpg";
import placeXlHotel from "./assets/place-xlhotel.jpg";
import phSzMission from "./assets/sz-mission.jpg";
import phSzMission2 from "./assets/sz-mission2.jpg";
import phSzCablecar from "./assets/sz-cablecar.jpg";
import phSzCoaster from "./assets/sz-coaster.jpg";
import phSzDapeng from "./assets/sz-dapeng.jpg";
import phSzDapeng2 from "./assets/sz-dapeng2.jpg";
import phSzFenghuang from "./assets/sz-fenghuang.jpg";
import phSzFenghuang2 from "./assets/sz-fenghuang2.jpg";
import phSzJinxiu from "./assets/sz-jinxiu.jpg";
import phSzJinxiu2 from "./assets/sz-jinxiu2.jpg";
import phSzOcteast from "./assets/sz-octeast.jpg";
import phSzOctharbour from "./assets/sz-octharbour.jpg";
import phSzOctharbour2 from "./assets/sz-octharbour2.jpg";
import phSzQingqing from "./assets/sz-qingqing.jpg";
import phSzQiniang from "./assets/sz-qiniang.jpg";
import phSzSafari from "./assets/sz-safari.jpg";
import phSzSafari2 from "./assets/sz-safari2.jpg";
import phSzSwcac from "./assets/sz-swcac.jpg";
import phSzSwcac2 from "./assets/sz-swcac2.jpg";
import phSzTanglang from "./assets/sz-tanglang.jpg";
import phSzTanglang2 from "./assets/sz-tanglang2.jpg";
import phSzWutong from "./assets/sz-wutong.jpg";
import phSzWutong2 from "./assets/sz-wutong2.jpg";
import phSzXianhu from "./assets/sz-xianhu.jpg";
import phSzXianhu2 from "./assets/sz-xianhu2.jpg";
import phSzXichong from "./assets/sz-xichong.jpg";
import phSzXichong2 from "./assets/sz-xichong2.jpg";
import phSzYangmeikeng from "./assets/sz-yangmeikeng.jpg";
import phSzYangmeikeng2 from "./assets/sz-yangmeikeng2.jpg";
import phSzZhongying from "./assets/sz-zhongying.jpg";
import phSzZhongying2 from "./assets/sz-zhongying2.jpg";
import placeAquarium from "./assets/place-aquarium.jpg";
import placeAquarium2 from "./assets/place-aquarium2.jpg";
import placeWheel from "./assets/place-wheel.jpg";
import placeWheel2 from "./assets/place-wheel2.jpg";
import placeHarbour from "./assets/place-harbour.jpg";
import placePeak from "./assets/place-peak.jpg";
import placeDisney from "./assets/place-disney.jpg";
import placeBuddha from "./assets/place-buddha.jpg";
import placeSaikung from "./assets/place-saikung.jpg";
import placeStanley from "./assets/place-stanley.jpg";
import placeWongtaisin from "./assets/place-wongtaisin.jpg";
import placeTaio from "./assets/place-taio.jpg";
import placeMongkok from "./assets/place-mongkok.jpg";
import placeDimsum from "./assets/place-dimsum.jpg";
import placeTram from "./assets/place-tram.jpg";
import type { CityKey } from "./data";

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
  // driving your own car looks out at the same real Shenzhen street as the
  // taxi shot (a blue Shenzhen taxi ahead through the windshield)
  drive: sceneTaxi,
  home: sceneHome,
  cruise: placeHejiang,
  wheel: placeWheel,
  aquarium: placeAquarium,
  turtle: placeTurtle,
  coaster: phSzCoaster,
  safari: phSzSafari,
  hike: phSzTanglang,
  beach: phSzXichong2,
  cablecar: phSzCablecar,
};

export interface GuidePlace {
  key: string;
  cityKey: CityKey;
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
  /** Set when the photos show the kind of place, not this exact one. */
  photoNote?: string;
}

export const GUIDE: GuidePlace[] = [
  {
    key: "wow", cityKey: "sz", locName: "世界之窗", nameEn: "Window of the World",
    photos: [placeWow, placeWow2],
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
    photos: [placeDameisha, placeDameisha2],
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
    npc: "阿杰", story: "阿杰在赛格摆了十年一米柜台：“以前发货用麻袋装，现在的小哥背个双肩包，包里就是一家公司的全部库存。买整机先验机，开发票，别贪便宜。”",
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
    photos: [placeSy, placeSy2],
    address: "惠东县平海镇双月湾", price: "海滩免费 · 观景台免费", hours: "全天开放（浴场时段以公告为准）",
    tip: "登大星山观景台，左右两湾同框才是完整的「双月」；左湾看日出，右湾看日落。",
    fact: "左湾水平如镜、右湾波涛汹涌，两道半月形海湾并排，被大星山隔成一静一动。",
    factEn: "Two crescent bays side by side — the left mirror-calm, the right surf-pounded — split by Daxing Mountain.",
    npc: "阿强", story: "阿强说小时候跟阿爸出海收网，天没亮左湾的渔船灯一排排的；现在他带客人出海看日出，还是这片海。",
    sourceName: "携程 · 双月湾简介", sourceUrl: "http://raysuo.com.cn/p/5oOg5bee5Y+M5pyI5rm+566A5LuL.html",
  },
  {
    key: "hejiang", cityKey: "hz", locName: "合江楼 · 东江夜游", nameEn: "Hejiang Tower & Dongjiang Night Cruise",
    photos: [placeHejiang, placeHejiang2],
    address: "惠城区 · 东江与西枝江交汇处（桥东水东街一带）", price: "合江楼外观免费 · 夜游船票以码头公告为准", hours: "游船多在傍晚后开航，以码头公告为准",
    tip: "天黑后楼体亮灯再上船，船行到两江交汇处时合江楼在正前方，最好拍。",
    fact: "合江楼立在东江与西枝江的交汇处，北宋绍圣元年（1094 年）苏东坡被贬惠州，最初就寓居在这里。",
    factEn: "The tower stands where the Dongjiang and Xizhi rivers meet; Su Dongpo first lodged here when exiled to Huizhou in 1094.",
    npc: "林婶", story: "林婶说小时候两江边全是渡船和疍家艇，现在夜里游船一过，合江楼的灯影碎在水里，像一座会晃的楼。",
    sourceName: "维基百科 · 合江楼", sourceUrl: "https://zh.wikipedia.org/wiki/合江楼",
  },
  {
    key: "haiguiwan", cityKey: "hz", locName: "海龟湾自然保护区", nameEn: "Huidong Sea Turtle National Nature Reserve",
    photos: [placeTurtle, placeTurtle2],
    address: "惠东县港口镇", price: "以保护区公告为准", hours: "以保护区公告为准（夏季产卵季部分沙滩限制进入）",
    tip: "看海龟别用闪光灯、别伸手摸；产卵季晚上沙滩上的海龟要远远地看。",
    fact: "广东惠东海龟国家级自然保护区是中国大陆唯一的海龟（绿海龟）产卵场，每年夏天有海龟上岸产卵，小海龟孵化后放归大海。",
    factEn: "The only green-turtle nesting beach on the Chinese mainland: turtles come ashore to lay each summer, and hatchlings are released to the sea.",
    npc: "阿强", story: "阿强说他跟着保护站的人放过一次小海龟，几十只小家伙往浪里爬，一个浪过来就全不见了——那一下他差点哭出来。",
    sourceName: "Wikimedia Commons · 惠东海龟", sourceUrl: "https://commons.wikimedia.org/wiki/File:Sea_Turtle_Pool_in_Huidong,_Huizhou.jpg",
    photoNote: "第 1 张摄于惠东海龟保护区；第 2 张小海龟为示意",
  },
  {
    key: "xunliao", cityKey: "hz", locName: "巽寮湾渔港", nameEn: "Xunliao Bay",
    photos: [placeXunliao],
    address: "惠东县巽寮镇", price: "海滩免费 · 出海、海钓另计", hours: "全天（浴场时段以公告为准）",
    tip: "清晨去渔港看渔船回港最热闹；海边礁石多，退潮时别走太远。",
    fact: "巽寮湾在大亚湾东岸，海水清、沙子白、海上散落着小岛和奇石，三角洲岛就在湾里，是惠州最热门的海滨度假地之一。",
    factEn: "On the east shore of Daya Bay: clear water, white sand and scattered islets — one of Huizhou's busiest seaside resorts.",
    npc: "阿强", story: "阿强说渔船一靠岸，鱼虾蟹按筐往岸上搬，游客围着挑，砍价声比海浪还响。",
    sourceName: "Wikimedia Commons · Xunliao Bay", sourceUrl: "https://commons.wikimedia.org/wiki/File:Seascape_of_Xunliao_Bay.jpg",
  },
  {
    key: "tanyue", cityKey: "hz", locName: "檀悦豪生度假酒店", nameEn: "Tanyue Howard Johnson Resort, Xunliao Bay",
    photos: [placeXlHotel, placeXunliao],
    address: "惠东县巽寮滨海旅游度假区", price: "房价随季节浮动，以酒店 / 订房平台为准", hours: "全天",
    tip: "周末和节假日房价翻倍，工作日去最划算；傍晚在海边看日落，再回泳池泡一会儿。",
    fact: "巽寮湾是惠州最热门的海滨度假地之一，海边一字排开的度假酒店，大多自带泳池和私家沙滩。",
    factEn: "Xunliao Bay is one of Huizhou's busiest beach resorts; its seafront hotels mostly come with pools and their own beach.",
    npc: "阿强", story: "阿强说旺季的时候他在酒店码头带客人出海，一天跑五六趟，客人里一半是从深圳开车过来的。",
    sourceName: "Wikimedia Commons · Xunliao Bay", sourceUrl: "https://commons.wikimedia.org/wiki/File:Hotel,_Xunliao_Bay.jpg",
    photoNote: "照片为巽寮湾的海边度假酒店和海湾，示意度假氛围，不是该酒店本身",
  },
  {
    key: "wutong", cityKey: "sz", locName: "梧桐山", nameEn: "Wutong Mountain",
    photos: [phSzWutong, phSzWutong2],
    address: "罗湖区 · 梧桐山风景区", price: "免费", hours: "全天（登山建议白天，带够水）",
    tip: "泰山涧一路上山最常见，大梧桐顶上风大，带件外套。",
    fact: "大梧桐海拔 943.7 米，是深圳第一高峰；天气好时山顶能望见深圳和香港两边的城市。",
    factEn: "At 943.7 m Big Wutong is Shenzhen's highest peak; on clear days you can see both Shenzhen and Hong Kong.",
    npc: "王姨", story: "王姨说她五十岁那年第一次爬上大梧桐，在山顶哭了一鼻子——年轻时来深圳打工，从没想过有空爬山。",
    sourceName: "Wikimedia Commons", sourceUrl: "https://commons.wikimedia.org/wiki/Category:Wutong_Mountain",
  },
  {
    key: "xianhu", cityKey: "sz", locName: "仙湖植物园 · 弘法寺", nameEn: "Fairy Lake Botanical Garden & Hongfa Temple",
    photos: [phSzXianhu, phSzXianhu2],
    address: "罗湖区 · 莲塘仙湖路", price: "以园方公告为准", hours: "以园方公告为准",
    tip: "弘法寺在半山上，香客多，安静参观；沙漠植物区和化石森林别错过。",
    fact: "植物园在梧桐山脚，湖区、温室、沙漠植物区和化石森林连成一片；半山的弘法寺香火很旺。",
    factEn: "At the foot of Wutong Mountain: lakes, glasshouses, a desert-plant zone and a fossil forest, with Hongfa Temple up the slope.",
    npc: "阿琳", story: "阿琳说她失恋那年天天下班来湖边坐，看着荷花开了又谢，后来就想通了。",
    sourceName: "Wikimedia Commons", sourceUrl: "https://commons.wikimedia.org/wiki/Category:Fairy_Lake_Botanical_Garden",
    photoNote: "照片为园内拍摄的植物特写",
  },
  {
    key: "jinxiu", cityKey: "sz", locName: "锦绣中华 · 民俗村", nameEn: "Splendid China Folk Village",
    photos: [phSzJinxiu, phSzJinxiu2],
    address: "南山区 · 华侨城深南大道", price: "以景区公告为准", hours: "以景区公告为准（夜场演出更热闹）",
    tip: "微缩景区白天逛，民俗村的晚场表演别错过。",
    fact: "1989 年开园，按比例微缩了全国各地的名胜；旁边的民俗文化村能看各民族的建筑和歌舞。",
    factEn: "Opened in 1989 with scale miniatures of China's landmarks; the folk village next door shows ethnic architecture and dance.",
    npc: "陈伯", story: "陈伯说开园那年全家坐大巴来看微缩长城，那是他儿子第一次「去北京」。",
    sourceName: "Wikimedia Commons", sourceUrl: "https://commons.wikimedia.org/wiki/Category:Splendid_China_Folk_Village",
  },
  {
    key: "safari", cityKey: "sz", locName: "深圳野生动物园", nameEn: "Shenzhen Safari Park",
    photos: [phSzSafari, phSzSafari2],
    address: "南山区 · 西丽", price: "以园方公告为准", hours: "以园方公告为准",
    tip: "猛兽区要坐带铁笼的观光车进去，记得关好车窗、别投喂。",
    fact: "1993 年开园，草食区散养、猛兽区坐带铁笼的观光车穿行，还有海洋天地和夜间动物世界。",
    factEn: "Opened in 1993: free-roaming herbivores, and a caged safari bus through the big-cat area.",
    npc: "子健", story: "子健说小时候坐笼子车，一只老虎从车边走过，他吓得把可乐打翻在妈妈身上。",
    sourceName: "Wikimedia Commons", sourceUrl: "https://commons.wikimedia.org/wiki/Category:Shenzhen_Safari_Park",
  },
  {
    key: "octeast", cityKey: "sz", locName: "东部华侨城", nameEn: "OCT East",
    photos: [phSzOcteast, phSzCablecar],
    address: "盐田区 · 大梅沙", price: "以景区公告为准", hours: "以景区公告为准",
    tip: "坐缆车上山看大梅沙海湾，山上的茶溪谷适合慢慢走。",
    fact: "建在大梅沙背后的山里：茵特拉根小镇、茶溪谷、大侠谷连成一片，缆车上能俯瞰大梅沙海湾。",
    factEn: "Set in the hills behind Dameisha — an alpine-style town, tea valleys and rides; the cable car looks out over the bay.",
    npc: "阿琳", story: "阿琳说她和同事团建来过，缆车升到半山腰，整个大梅沙海湾突然出现在脚下，全车厢都安静了。",
    sourceName: "Wikimedia Commons", sourceUrl: "https://commons.wikimedia.org/wiki/Category:OCT_East",
  },
  {
    key: "qingqing", cityKey: "sz", locName: "青青世界", nameEn: "Evergreen Resort",
    photos: [phSzQingqing],
    address: "南山区 · 月亮湾大道", price: "以景区公告为准", hours: "以景区公告为准",
    tip: "适合带小朋友，园子不大，半天就能逛完。",
    fact: "藏在南山半山腰的生态园，热带植物、蝴蝶谷和农场小屋，城市里难得的一块绿荫。",
    factEn: "An eco-park tucked on a Nanshan hillside — tropical plants, a butterfly valley and farm cabins.",
    npc: "王姨", story: "王姨说外孙在蝴蝶谷追了一下午蝴蝶，回家路上在车里就睡着了。",
    sourceName: "Wikimedia Commons", sourceUrl: "https://commons.wikimedia.org/wiki/Category:Evergreen_Resort_(Shenzhen)",
  },
  {
    key: "dapeng", cityKey: "sz", locName: "大鹏所城", nameEn: "Dapeng Fortress",
    photos: [phSzDapeng, phSzDapeng2],
    address: "大鹏新区 · 鹏城村", price: "免费", hours: "全天（展馆以公告为准）",
    tip: "城里的老巷子适合慢慢走，城门口的小吃店可以尝尝。",
    fact: "明洪武二十七年（1394 年）建的海防卫所，深圳别称「鹏城」就是从这里来的。",
    factEn: "A Ming coastal fort built in 1394 — Shenzhen's nickname \"Pengcheng\" comes from it.",
    npc: "郭叔", story: "郭叔说他小时候在所城的城墙上放风筝，那时候还没人来旅游，城里都是老人和鸡。",
    sourceName: "Wikimedia Commons", sourceUrl: "https://commons.wikimedia.org/wiki/Category:Dapeng_Fortress",
  },
  {
    key: "octharbour", cityKey: "sz", locName: "欢乐海岸", nameEn: "OCT Harbour",
    photos: [phSzOctharbour, phSzOctharbour2],
    address: "南山区 · 深圳湾畔", price: "免费入园（项目另计）", hours: "全天（商户以营业时间为准）",
    tip: "傍晚去，湖边散步、吃饭、看灯光，比白天舒服。",
    fact: "深圳湾边的滨海商业区，湖区、湿地公园和商街连在一起，晚上灯光很美。",
    factEn: "A waterfront district on Shenzhen Bay — lake, wetland park and shopping streets, lovely after dark.",
    npc: "阿琳", story: "阿琳说同事聚餐最爱选这儿，吃完沿着湖走一圈，正好消食。",
    sourceName: "Wikimedia Commons", sourceUrl: "https://commons.wikimedia.org/wiki/Category:OCT_Harbour",
  },
  {
    key: "qiniang", cityKey: "sz", locName: "七娘山", nameEn: "Qiniang Mountain",
    photos: [phSzQiniang],
    address: "大鹏新区 · 南澳", price: "以景区公告为准（需预约）", hours: "以景区公告为准",
    tip: "登山道陡，穿防滑鞋；山顶常有云雾，视野看运气。",
    fact: "海拔 869 米，是深圳第二高峰，站在山顶能看到大鹏湾和排牙山。",
    factEn: "At 869 m, Shenzhen's second-highest peak, overlooking Dapeng Bay and the Paiya ridge.",
    npc: "郭叔", story: "郭叔说七娘山的云说来就来，上一秒还能看见海，下一秒连身边的人都看不清。",
    sourceName: "Wikimedia Commons", sourceUrl: "https://commons.wikimedia.org/wiki/File:Qiniangshan,_Shenzhen.jpg",
  },
  {
    key: "yangmeikeng", cityKey: "sz", locName: "杨梅坑", nameEn: "Yangmeikeng",
    photos: [phSzYangmeikeng, phSzYangmeikeng2],
    address: "大鹏新区 · 南澳", price: "免费（停车另计）", hours: "全天",
    tip: "沿海边骑行道骑单车最舒服，傍晚在礁石边看海。",
    fact: "大鹏半岛东端的海边山谷，溪流入海，沿海有骑行道和鹿嘴山庄的栈道。",
    factEn: "A valley at the eastern tip of the Dapeng peninsula where a stream meets the sea, with a coastal cycle path.",
    npc: "阿强", story: "阿强说他和朋友骑双人自行车沿海边骑，一路吵着谁没蹬，最后在海边笑成一团。",
    sourceName: "Wikimedia Commons", sourceUrl: "https://commons.wikimedia.org/wiki/File:Yangmeikeng,_Dapeng.jpg",
  },
  {
    key: "xichong", cityKey: "sz", locName: "西涌海滩", nameEn: "Xichong Beach",
    photos: [phSzXichong, phSzXichong2],
    address: "大鹏新区 · 南澳西涌", price: "以景区公告为准", hours: "全天（浴场时段以公告为准）",
    tip: "海水干净但浪大，下水注意安全；晚上能去附近的天文台看星星。",
    fact: "深圳最长、最干净的沙滩之一，远离市区，晚上没有城市光污染，能看到银河。",
    factEn: "One of Shenzhen's longest and cleanest beaches — far enough from the city to see the Milky Way.",
    npc: "阿强", story: "阿强说他第一次在西涌露营，半夜醒来看见满天星星，才知道深圳也能看到银河。",
    sourceName: "Wikimedia Commons", sourceUrl: "https://commons.wikimedia.org/wiki/File:Sunset_on_Xichong.JPG",
  },
  {
    key: "zhongying", cityKey: "sz", locName: "中英街", nameEn: "Chung Ying Street",
    photos: [phSzZhongying, phSzZhongying2],
    address: "盐田区 · 沙头角", price: "免费（进入需办理边境通行手续，以官方为准）", hours: "以官方公告为准",
    tip: "进街前确认好通行手续；街心的界碑一定要看。",
    fact: "一条街两边分属深圳和香港，街心的界碑就是边界，被叫做「一街两制」。",
    factEn: "Half the street is Shenzhen, half Hong Kong — the boundary stones down the middle mark \"one street, two systems\".",
    npc: "陈伯", story: "陈伯说八十年代来中英街买金首饰和电子表是件大事，街上挤得脚都落不了地。",
    sourceName: "Wikimedia Commons", sourceUrl: "https://commons.wikimedia.org/wiki/Category:Chung_Ying_Street",
  },
  {
    key: "tanglang", cityKey: "sz", locName: "塘朗山郊野公园", nameEn: "Tanglangshan Country Park",
    photos: [phSzTanglang, phSzTanglang2],
    address: "南山区 · 塘朗山", price: "免费", hours: "全天（建议白天登山）",
    tip: "山顶的极目阁视野最好，南面是深圳湾和后海，北面是西丽水库。",
    fact: "塘朗山横在南山和福田之间，山顶能同时望见深圳湾、后海和西丽水库。",
    factEn: "Tanglang Mountain divides Nanshan and Futian; its summit looks over Shenzhen Bay, Houhai and Xili Reservoir.",
    npc: "子健", story: "子健说他周末常和同学夜爬塘朗山，到顶时南山的灯一片片亮着，比白天还好看。",
    sourceName: "Wikimedia Commons", sourceUrl: "https://commons.wikimedia.org/wiki/Category:Tanglang_Mountain",
  },
  {
    key: "fenghuang", cityKey: "sz", locName: "凤凰山森林公园", nameEn: "Fenghuang Mountain Forest Park",
    photos: [phSzFenghuang, phSzFenghuang2],
    address: "宝安区 · 福永", price: "免费", hours: "全天",
    tip: "山脚的凤凰古庙香火旺，上山的石阶不长，适合轻松走走。",
    fact: "宝安的城市森林公园，山脚有古庙和凤凰古村，山顶望烟楼能看到珠江口。",
    factEn: "A city forest park in Bao'an with an old temple at its foot; the hilltop tower looks out to the Pearl River estuary.",
    npc: "陈伯", story: "陈伯说每年春节他都来凤凰山拜一拜，求一家人平平安安，然后在山脚吃碗豆腐花。",
    sourceName: "Wikimedia Commons", sourceUrl: "https://commons.wikimedia.org/wiki/Category:Fenghuang_Mountain_(Shenzhen)",
  },
  {
    key: "swcac", cityKey: "sz", locName: "海上世界文化艺术中心", nameEn: "Sea World Culture & Arts Center",
    photos: [phSzSwcac, phSzSwcac2],
    address: "南山区 · 蛇口望海路 1187 号", price: "展览以官方公告为准", hours: "以官方公告为准",
    tip: "顶层平台能看海，看完展去旁边的海上世界吃饭。",
    fact: "日本建筑师槇文彦设计，2017 年开放，几个错落的白色体块悬挑在蛇口海边，里面有设计博物馆和剧场。",
    factEn: "Designed by Fumihiko Maki and opened in 2017 — stacked white volumes cantilevered over the Shekou waterfront, with a design museum and theatre.",
    npc: "阿琳", story: "阿琳说她最喜欢在顶层平台坐着，看蛇口港的船一艘艘开出去。",
    sourceName: "Wikimedia Commons", sourceUrl: "https://commons.wikimedia.org/wiki/Category:Sea_World_Culture_and_Arts_Center",
  },
  {
    key: "missionhills", cityKey: "sz", locName: "观澜湖旅游休闲度假区", nameEn: "Mission Hills Resort, Shenzhen",
    photos: [phSzMission, phSzMission2],
    address: "龙华区观澜高尔夫大道 1 号", price: "公共区域免费 · 球场、酒店等项目另计", hours: "全天（各项目以官方公告为准）",
    tip: "不打球也可以去体育生态公园走走，周末适合带小朋友。",
    fact: "国家 5A 级旅游景区（2011 年评定），以高尔夫球场群闻名，园区里还有约 22 万平方米的体育生态公园、酒店和商业街。",
    factEn: "A national 5A attraction since 2011, famous for its golf courses, with a 220,000 m² sports and eco park, hotels and a shopping street.",
    npc: "老周", story: "老周说他开车接过来打球的外国客人，一路上听他们夸这里的草比老家的还绿。",
    sourceName: "中国日报网 · Mission Hills Resort, Shenzhen", sourceUrl: "https://govt.chinadaily.com.cn/s/201812/17/WS5ce75ce0498e079e68021961/mission-hills-resort-shenzhen.html",
  },
  {
    key: "baylight", cityKey: "sz", locName: "欢乐港湾", nameEn: "OH Bay · Bay Glory Ferris Wheel",
    photos: [placeWheel, placeWheel2],
    address: "宝安区 · 欢乐港湾（前海湾畔）", price: "摩天轮票价以官方公告为准", hours: "以官方公告为准（傍晚和夜场最热门）",
    tip: "傍晚上去最值：先看海湾日落，转一圈下来城市刚好亮灯。",
    fact: "「湾区之光」摩天轮立在宝安欢乐港湾的海边，轿厢是透明的胶囊舱，转一圈能看到前海、宝安中心区和伶仃洋。",
    factEn: "Bay Glory stands on the waterfront at OH Bay in Bao'an; its glass capsules look over Qianhai and the Lingdingyang.",
    npc: "子健", story: "子健说他跟女朋友就是在这摩天轮最高点表的白，下来以后才发现手心全是汗。",
    sourceName: "Wikimedia Commons · Bay Glory", sourceUrl: "https://commons.wikimedia.org/wiki/File:Bay_Glory_2022.jpg",
  },
  {
    key: "xiaomeisha", cityKey: "sz", locName: "小梅沙海洋世界", nameEn: "Xiaomeisha Sea World",
    photos: [placeAquarium, placeAquarium2],
    address: "盐田区 · 小梅沙", price: "以官方公告为准", hours: "以官方公告为准",
    tip: "海底隧道和水母馆是招牌，周末上午人最多，下午晚点去更从容。",
    fact: "小梅沙是深圳东部的海湾，海洋世界里能走进海底隧道看鲨鱼和鱼群从头顶游过。",
    factEn: "In the bay of Xiaomeisha in east Shenzhen; walk through an underwater tunnel with sharks overhead.",
    npc: "王姨", story: "王姨带外孙来过三次，小家伙每次都趴在隧道玻璃上不肯走，非说那条鳐鱼在跟他打招呼。",
    sourceName: "Wikimedia Commons", sourceUrl: "https://commons.wikimedia.org/wiki/Category:Aquarium_tunnels",
    photoNote: "照片为其他海洋馆的海底隧道和水母，示意参观体验",
  },
  /* ---- 香港图鉴：实拍 + 真实信息（港币标价）+ 中英双语 + 香港街坊讲真故事 ---- */
  {
    key: "hk-harbour", cityKey: "hk", locName: "尖沙咀海滨 · 维多利亚港", nameEn: "Victoria Harbour, Tsim Sha Tsui",
    photos: [placeHarbour],
    address: "尖沙咀海滨长廊 · 港铁尖东站 / 尖沙咀站", price: "海滨免费 · 天星小轮过海 HK$5 起（周末略贵）", hours: "海滨全天 · 幻彩咏香江每晚 20:00",
    tip: "日落前坐天星小轮到中环，再沿海滨走回来，一程船看两次天际线；八点前占个好位置看灯光秀。",
    fact: "维多利亚港是世界三大天然深水港之一；天星小轮 1880 年代就开始过海，尖沙咀↔中环一程只要几分钟，却是《国家地理》点名的「人生必到的 50 个景点」之一。",
    factEn: "One of the world's great natural harbours; the Star Ferry has crossed it since the 1880s — a few minutes, a few dollars, an unbeatable skyline.",
    npc: "船长辉", story: "船长辉说：「我开这条航线几十年，维港的灯光换了几代，船费还是几蚊鸡。游客问我香港有什么必做，我指一指船头——坐过去，就是了。The harbour is the city, mate.」",
    sourceName: "香港旅游发展局 · 维多利亚港", sourceUrl: "https://www.discoverhongkong.com/sc/place-to-go/travel.guide-victoria-harbour.html",
  },
  {
    key: "hk-peak", cityKey: "hk", locName: "太平山顶", nameEn: "Victoria Peak",
    photos: [placePeak],
    address: "山顶凌霄阁 · 中环花园道山顶缆车站上山", price: "山顶缆车来回约 HK$88 · 摩天台另收费", hours: "缆车约 7:00–23:00（以官网为准）",
    tip: "下午四点上山，一次看够日景、黄昏和夜景；大雾天别硬上，山上什么都看不见。",
    fact: "太平山海拔 552 米，是港岛最高点；山顶缆车 1888 年通车，是亚洲最早的登山缆车之一，如今已是第六代车厢，坡度最斜处像坐过山车。",
    factEn: "The Peak rises 552 m above the harbour; its funicular has climbed since 1888 — one of Asia's first — and the view explains Hong Kong at a glance.",
    npc: "阿May", story: "阿May说：「中环返工再忙，我每年都要上一次山顶。细个阿爸带我来，大个我带外国同事来——企喺凌霄阁，成个香港点解系咁，就明晒。This is where the city makes sense.」",
    sourceName: "香港旅游发展局 · 太平山顶", sourceUrl: "https://www.discoverhongkong.com/sc/place-to-go/travel.guide-victoria-peak.html",
  },
  {
    key: "hk-disney", cityKey: "hk", locName: "香港迪士尼乐园", nameEn: "Hong Kong Disneyland",
    photos: [placeDisney],
    address: "大屿山竹篙湾 · 港铁迪士尼站", price: "一日门票 HK$639 起（按日子分级收费）", hours: "约 10:00–20:30（以官网日历为准）",
    tip: "港铁迪士尼线列车车窗都是米奇头；平日去人少，热门项目先冲「魔雪奇幻之旅」和「灰熊山极速矿车」。",
    fact: "2005 年开园，是全球面积最小的迪士尼乐园；2020 年「奇妙梦想城堡」登场，把 13 个公主的故事叠进一座城堡，2023 年又开了全球首个魔雪世界。",
    factEn: "Opened in 2005, the smallest Disneyland in the world — its Castle of Magical Dreams (2020) stacks 13 princess stories into one skyline.",
    npc: "肥妈", story: "肥妈说：「我个女细个嗰阵，企喺城堡前面唔肯走。如今佢带埋个孙去，烟花一放，祖孙三代一齐哗出声。呢度细系细啲，但香港人嘅童年，有一截系摆喺度嘅。」",
    sourceName: "香港迪士尼乐园官网", sourceUrl: "https://www.hongkongdisneyland.com/zh-hk/",
  },
  {
    key: "hk-buddha", cityKey: "hk", locName: "昂坪 · 天坛大佛", nameEn: "Ngong Ping · Tian Tan Buddha",
    photos: [placeBuddha],
    address: "大屿山昂坪 · 东涌站转昂坪 360 缆车", price: "大佛免费参观 · 缆车来回 HK$235 起（水晶车厢更贵）", hours: "昂坪市集约 10:00–18:00 · 缆车以官网为准",
    tip: "缆车全程 25 分钟、5.7 公里；要登佛先爬 268 级石阶，山上风大，带件外套。",
    fact: "天坛大佛高 34 米、重 250 吨，1993 年开光，是当时全球最大的户外青铜坐佛；山脚的宝莲禅寺 1906 年创立，斋菜全港闻名。",
    factEn: "The Tian Tan Buddha stands 34 m and weighs 250 tonnes; below it, Po Lin Monastery (1906) serves vegetarian dishes famous across Hong Kong.",
    npc: "船长辉", story: "船长辉说：「后生嗰时我喺大澳揸船，送香客去宝莲寺，未有缆车之前，上山得一步一步行。依家缆车喺头顶碌过，大佛喺云入面望住个海——佢望咗呢片海一百年喇。」",
    sourceName: "昂坪 360 官网 · 天坛大佛", sourceUrl: "https://www.np360.com.hk/sc/explore-ngong-ping/attractions/the-big-buddha",
  },
  {
    key: "hk-saikung", cityKey: "hk", locName: "西贡海鲜街", nameEn: "Sai Kung Seafood Street",
    photos: [placeSaikung],
    address: "西贡海傍街 · 西贡市中心巴士总站旁", price: "海鲜按时价称重 + 酒家加工费，人均 HK$200 起", hours: "酒家约 11:00–23:00 · 街渡班次以码头公告为准",
    tip: "先在海旁鱼档拣海鲜、问清加工费再上台；食完坐街渡去半月湾（桥咀岛），水清沙幼。",
    fact: "西贡被称为「香港的后花园」：西贡海有 70 多个岛屿，香港联合国教科文组织世界地质公园的核心就在这里，六角石柱群是一亿多年前火山爆发的遗迹。",
    factEn: "Sai Kung is Hong Kong's back garden — 70-plus islands and the hexagonal rock columns of a UNESCO Global Geopark, left by a supervolcano.",
    npc: "强哥", story: "强哥说：「后生仔问我西贡有咩好玩，我话：你坐的士入嚟单程都要成粒钟，点解？因为香港人放假，宁愿塞车都要嚟食呢餐海鲜、吹呢阵海风。Worth every minute.」",
    sourceName: "香港旅游发展局 · 西贡", sourceUrl: "https://www.discoverhongkong.com/sc/explore/neighbourhoods/sai-kung.html",
  },
  {
    key: "hk-stanley", cityKey: "hk", locName: "赤柱", nameEn: "Stanley",
    photos: [placeStanley],
    address: "港岛南区赤柱 · 中环 / 铜锣湾有巴士直达", price: "市集免费逛 · 海边餐厅人均 HK$150 起", hours: "市集约 10:00–19:00 · 海滨全天",
    tip: "赤柱市集买手信记得讲价；美利楼和卜公码头是日落打卡位，周末有市集巴士加班。",
    fact: "1841 年英军登陆时，赤柱一度是香港的行政中心，比中环还早成市；美利楼原本站在中环海旁，2000 年一块块砖拆下来，在赤柱原样重建——是香港最出名的「搬家」建筑。",
    factEn: "Stanley was Hong Kong's first administrative centre in 1841; Murray House was dismantled brick by brick in Central and rebuilt here in 2000.",
    npc: "婆婆珍", story: "婆婆珍说：「赤柱以前有军营、有监狱，边有咁热闹。依家后生仔嚟饮咖啡、行市集，我个孙嚟亲都问：点解呢度啲楼咁矮嘅？——矮，先至睇到个天啊嘛。」",
    sourceName: "香港旅游发展局 · 赤柱市集", sourceUrl: "https://www.discoverhongkong.com/sc/place-to-go/travel.guide-stanley-market.html",
  },
  {
    key: "hk-wongtaisin", cityKey: "hk", locName: "黄大仙祠", nameEn: "Wong Tai Sin Temple",
    photos: [placeWongtaisin],
    address: "九龙黄大仙竹园村 2 号 · 港铁黄大仙站 B2 出口", price: "免费入场 · 求签有解签摊档", hours: "约 7:00–17:00（以啬色园公告为准）",
    tip: "大年初一抢头炷香是年度盛事，平时来不用排长队；求签后在祠外找解签师傅，别在里面大声喧哗。",
    fact: "黄大仙祠 1921 年迁到现址，主殿供奉的黄大仙「有求必应」闻名华人世界；祠内同时供奉佛、道、儒三教神像，是香港少见的三教同祠。",
    factEn: "Famous for 'granting every prayer', Wong Tai Sin Temple (1921) houses Buddhist, Taoist and Confucian deities under one roof.",
    npc: "婆婆珍", story: "婆婆珍说：「我阿妈嗰代，边个屋企有事，第一时间就系嚟黄大仙。灵唔灵？我个仔出世嗰年求过平安签，今年佢个仔都嚟求升学签喇。三代人都嚟，呢啲就系香火。」",
    sourceName: "啬色园黄大仙祠", sourceUrl: "https://www.siksikyuen.org.hk/",
  },
  {
    key: "hk-taio", cityKey: "hk", locName: "大澳渔村", nameEn: "Tai O Fishing Village",
    photos: [placeTaio],
    address: "大屿山西端大澳 · 东涌站转 11 号巴士", price: "村内免费 · 小艇游涌约 HK$50", hours: "全天 · 巴士班次较疏，留意尾班车",
    tip: "试炭烧鸡蛋仔和大鱼蛋，买手信拣咸鱼虾酱；坐小艇出涌口，运气好见到中华白海豚。",
    fact: "大澳的水上棚屋有上百年历史，居民多为蜑家渔民后代；这里曾是香港的盐场和海关关口，如今是全港保存最完整的渔村，虾酱和咸鱼干飘香全村。",
    factEn: "Tai O's stilt houses stand over the water as they have for a century — a Tanka fishing village perfumed with shrimp paste and salted fish.",
    npc: "船长辉", story: "船长辉说：「大澳以前收工就冇声，依家假日塞满人嚟食鸡蛋仔。棚屋啲后生返晒出市区，剩低我哋呢班老的守住条涌。不过你睇吓，个海仲喺度，海豚仲返嚟——咁就够喇。」",
    sourceName: "香港旅游发展局 · 大澳", sourceUrl: "https://www.discoverhongkong.com/sc/place-to-go/travel.guide-tai-o.html",
  },
  {
    key: "hk-mongkok", cityKey: "hk", locName: "旺角 · 女人街", nameEn: "Mong Kok · Ladies' Market",
    photos: [placeMongkok],
    address: "旺角通菜街（女人街）· 港铁旺角站 E2 出口", price: "排档多可讲价 · 小吃人均 HK$50", hours: "排档约 12:00–23:00 · 越夜越旺",
    tip: "开价先还三成慢慢倾；金鱼街的鱼袋挂满墙，是全港独一无二的打卡墙。",
    fact: "旺角是全球人口密度最高的地区之一，平均每平方公里超过 13 万人；女人街（通菜街）有 100 多个排档，卖的早就不只女人用品，而是全港最地道的市集气。",
    factEn: "Mong Kok is among the most densely populated places on Earth — over 130,000 people per km² — and the Ladies' Market packs 100+ stalls into Tong Choi Street.",
    npc: "华哥", story: "华哥说：「收工我成日嚟旺角食碗牛腩面。呢度啲招牌，系以前成个香港嘅天际线——而家拆剩唔多块喇。后生仔问旺角有咩睇，我话：睇人。人多，先至系旺角。」",
    sourceName: "香港旅游发展局 · 女人街", sourceUrl: "https://www.discoverhongkong.com/sc/place-to-go/travel.guide-ladies-market.html",
  },
  {
    key: "hk-dimsum", cityKey: "hk", locName: "上环 · 茶餐厅食街", nameEn: "Sheung Wan · Cha Chaan Teng & Dim Sum",
    photos: [placeDimsum],
    address: "上环永乐街 / 文咸东街一带 · 港铁上环站", price: "茶餐厅人均 HK$50–70 · 点心一盅两件 HK$58 起", hours: "茶餐厅多 6:30 开门 · 点心酒楼早茶约 8:00–16:00",
    tip: "奶茶要叫「茶走」（炼奶代砂糖）先至够地道；点心酒楼揀有推车仔嗰啲，蒸笼揭盖嗰下最香。",
    fact: "茶餐厅是香港独有的餐饮物种：冰室年代留下的「茶走」「飞沙走奶」黑话，出餐以分钟计；一盅两件——一盅普洱、两件点心——是几代打工仔的早餐仪式。",
    factEn: "The cha chaan teng is Hong Kong's own invention — milk tea 'cha zau', two steamers and a pot of pu'er: the working city's breakfast ritual.",
    npc: "华哥", story: "华哥说：「我冲咗三十年奶茶，水滚茶靓，撞奶要撞出声。客仔一入门口，未出声我已经知佢饮咩——呢啲唔系记性，系日子。Thirty years, same faces, same tea. That's home.」",
    sourceName: "香港旅游发展局 · 香港好味", sourceUrl: "https://www.discoverhongkong.com/sc/eat-and-drink.html",
  },
  {
    key: "hk-tram", cityKey: "hk", locName: "湾仔电车路", nameEn: "Hong Kong Tramways · Wan Chai",
    photos: [placeTram],
    address: "港岛北岸电车路 · 坚尼地城至筲箕湾", price: "全程一律 HK$3（长者/小童更平）", hours: "约 6:00–24:00 · 班次密到唔使等",
    tip: "坐上层最前排，由西环慢慢碌到北角；经过春秧街时，电车会直接驶进街市中间，全港独有。",
    fact: "香港电车 1904 年通车，是全球最大的双层电车系统，车费一百二十年来只涨到 HK$3；「叮叮车」这个名字，来自它过路口时的铃声。",
    factEn: "Running since 1904, Hong Kong's 'ding ding' trams are the world's largest double-decker tram fleet — and the fare is still just HK$3.",
    npc: "婆婆珍", story: "婆婆珍说：「我后生嗰时返工，系北角坐叮叮去湾仔，三毫子。而家三蚊鸡，车慢咗咩？唔系，系个城市快咗啫。坐上层望出去，一百二十年嘅街景慢慢过——呢啲先系香港嘅速度。」",
    sourceName: "香港电车官网", sourceUrl: "https://www.hktramways.com/sc/",
  },
];

export function guideForLocName(name: string): GuidePlace | null {
  return GUIDE.find((g) => g.locName === name) ?? null;
}

export interface DayTour {
  id: string;
  cityKey: CityKey;
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
  {
    id: "hk-harbour", cityKey: "hk",
    name: "维港两岸一日游", nameEn: "Victoria Harbour Day Tour",
    line: "🚇 荃湾线 + 天星小轮 + 港岛线 · 旺角 → 尖沙咀过海 → 上环 → 山顶",
    stops: ["旺角 · 女人街", "尖沙咀海滨 · 维多利亚港", "上环 · 茶餐廳食街", "太平山顶"],
    rewardPerStop: 40, rewardFinish: 200,
  },
];

export function tourForCity(cityKey: CityKey): DayTour {
  return TOURS.find((t) => t.cityKey === cityKey) ?? TOURS[0]!;
}
