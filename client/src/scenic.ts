/* 观景时刻：在对的地方、对的时间，镜头飞下去，天色变成日落 / 夜晚，配乐、旁白，
   一段 20 多秒的真 3D 风景。真实时间刚好在最佳时段，奖励更多。
   Scenic moments: the 3D map itself becomes the scene — the camera flies low
   over the spot, the sky turns to sunset or night, labels and buttons fade. */
import type { CityKey } from "./data";
import { LAND as LSZ } from "./terrain-sz";
import { LAND as LHZ } from "./terrain-hz";
import { LAND as LHK } from "./terrain-hk";

export interface ScenicMoment {
  id: string; city: CityKey;
  /** game locations / places where the moment can be watched */
  locIds: string[];
  /** …or any place whose name contains one of these */
  names?: string[];
  emoji: string; zh: string; en: string;
  /** button hint */
  hint: string; hintEn: string;
  /** 0.27 sunrise · 0.74 sunset · 0.93 night */
  phase: number;
  /** the real Beijing-time window when it is at its best (minutes) — bonus mood then */
  best: [number, number];
  /** camera: where it looks from (azimuth, 0 = from the south looking north), how low (polar, larger = flatter), how far */
  az: number; pol: number; dist: number;
  /** a cruise: the camera glides along these points instead of hovering */
  path?: [number, number][];
  /** sea views: face whichever way from the spot is open water (overrides az) */
  faceSea?: boolean;
  durMs: number;
  lines: [string, string][];
}

const H = (h: number, m = 0) => h * 60 + m;
const PI = Math.PI;

export const SCENIC_MOMENTS: ScenicMoment[] = [
  { id: "qianhaishi", faceSea: true, city: "sz", locIds: ["pl:xw774864189", "apec-qianhai"], emoji: "🌅", zh: "前海石 · 日落跨海大桥", en: "Qianhai Stone · sunset under the bridge", hint: "傍晚五六点最好：太阳落进桥墩之间", hintEn: "Best around 5–6 pm: the sun drops between the bridge piers", phase: 0.705, best: [H(17), H(18, 45)], az: PI / 2, pol: 1.22, dist: 11, durMs: 24000,
    lines: [["太阳一点点沉进伶仃洋，桥墩的影子拉得老长。", "The sun sinks into the Lingding sea; the bridge piers throw long shadows."], ["海风带着咸味，旁边有人举着手机拍了二十分钟。", "A salty sea breeze; someone beside you has been filming for twenty minutes."], ["这一刻的深圳，不卷，也不赶。", "For a moment, Shenzhen isn't racing anywhere."]] },
  { id: "szbay", faceSea: true, city: "sz", locIds: ["fun", "talent"], emoji: "🌇", zh: "深圳湾 · 看对岸香港日落", en: "Shenzhen Bay · sunset over Hong Kong", hint: "日落时分，海对面就是香港", hintEn: "At sunset, Hong Kong is right across the water", phase: 0.705, best: [H(17), H(18, 45)], az: PI, pol: 1.18, dist: 12, durMs: 22000,
    lines: [["对岸的元朗亮起第一盏灯。", "The first lights come on across the water in Yuen Long."], ["骑单车的人从身后掠过，白鹭贴着滩涂飞。", "Cyclists sweep past behind you; egrets skim the mudflats."], ["一湾海水，两座城。", "One bay, two cities."]] },
  { id: "talentlights", city: "sz", locIds: ["talent"], emoji: "🌃", zh: "人才公园 · 春笋灯光秀", en: "Talent Park · the skyline light show", hint: "晚上八点后，后海的楼一起亮起来", hintEn: "After 8 pm the Houhai towers light up together", phase: 0.93, best: [H(19, 30), H(22)], az: -PI / 4, pol: 1.2, dist: 13, durMs: 24000,
    lines: [["春笋大厦的灯一节节往上爬。", "The Spring Bamboo tower lights climb, section by section."], ["湖面把整片天际线又复制了一遍。", "The lake copies the whole skyline a second time."], ["你突然想给家里打个视频电话。", "Suddenly you want to video-call home."]] },
  { id: "lianhuanight", city: "sz", locIds: ["lianhua"], emoji: "🏙️", zh: "莲花山 · 福田 CBD 夜景", en: "Lianhuashan · the Futian CBD at night", hint: "山顶广场往南看，平安大厦就在正前方", hintEn: "From the summit square, Ping An Tower is straight ahead", phase: 0.93, best: [H(19), H(22)], az: PI, pol: 1.15, dist: 14, durMs: 22000,
    lines: [["中轴线一路亮到海边。", "The central axis glows all the way to the sea."], ["平安大厦的塔尖在云里一闪一闪。", "Ping An Tower's spire blinks in the low cloud."], ["四十年前，这里还是一片农田。", "Forty years ago this was farmland."]] },
  { id: "dameishasunrise", city: "sz", locIds: ["dameisha", "xichong", "yantian"], emoji: "🌄", zh: "大梅沙 · 海上日出", en: "Dameisha · sunrise over the sea", hint: "早上六点前到，等太阳从海里出来", hintEn: "Be there before 6 am and watch the sun come out of the sea", phase: 0.27, best: [H(5, 30), H(7)], az: PI, pol: 1.2, dist: 11, durMs: 22000,
    lines: [["天边先是紫，再是橙。", "The horizon turns purple, then orange."], ["渔船从海平线那边慢慢开回来。", "Fishing boats come slowly back over the horizon."], ["新的一天，从海里升起来。", "A new day rises out of the sea."]] },
  { id: "dongjiangcruise", city: "hz", locIds: ["hejiang", "dongjiangpark"], emoji: "🛥️", zh: "东江夜游 · 合江楼灯影", en: "Dongjiang night cruise · Hejiang Tower lights", hint: "晚上坐游船，合江楼的灯影碎在江里", hintEn: "A night boat; Hejiang Tower's reflection breaks on the river", phase: 0.93, best: [H(19), H(22)], az: PI * 0.85, pol: 1.25, dist: 9, durMs: 26000, path: [[-4.5, -8.6], [-2.5, -8.2], [-0.5, -7.9], [1.8, -7.4], [4.2, -6.8]],
    lines: [["游船离岸，马达声被江风吹散。", "The boat pulls away; the engine fades into the river wind."], ["合江楼亮着金色的灯，倒影在水里晃。", "Hejiang Tower glows gold, its reflection swaying in the water."], ["两江交汇的地方，惠州已经这样亮了一千年。", "Where two rivers meet, Huizhou has glowed like this for a thousand years."]] },
  { id: "xihunight", city: "hz", locIds: ["xihu", "hostel"], emoji: "🏮", zh: "惠州西湖 · 泗洲塔夜色", en: "Huizhou West Lake · Sizhou Pagoda at night", hint: "夜里沿苏堤走，泗洲塔亮着", hintEn: "Walk the Su Causeway at night; the pagoda is lit", phase: 0.93, best: [H(19), H(22)], az: PI / 3, pol: 1.2, dist: 10, durMs: 22000,
    lines: [["苏东坡当年也在这条堤上散过步。", "Su Dongpo walked this causeway, too."], ["湖面很静，塔影一动不动。", "The lake is still; the pagoda's reflection doesn't move."], ["惠州的夜，慢得刚刚好。", "Huizhou nights are exactly as slow as they should be."]] },
  { id: "xunliaosunset", faceSea: true, city: "hz", locIds: ["xunliao", "fun", "sanjiaozhou", "tanyue"], emoji: "🌅", zh: "巽寮湾 · 海边日落", en: "Xunliao Bay · sunset on the beach", hint: "傍晚光脚踩沙，等太阳落海", hintEn: "Barefoot in the sand at dusk, waiting for the sun to set", phase: 0.705, best: [H(17), H(18, 45)], az: PI / 2, pol: 1.22, dist: 11, durMs: 22000,
    lines: [["沙子还留着白天的温度。", "The sand still holds the day's warmth."], ["浪一层层推过来，又退回去。", "Waves roll in, layer after layer, and slide back."], ["深圳人周末开两小时车，就为这一眼。", "Shenzhen people drive two hours on a weekend for this one look."]] },
  { id: "symphony", city: "hk", locIds: ["tst"], emoji: "🎆", zh: "维港 · 幻彩咏香江", en: "Victoria Harbour · A Symphony of Lights", hint: "晚上八点，两岸的楼一起打灯", hintEn: "At 8 pm both shores light up together", phase: 0.93, best: [H(19, 50), H(20, 30)], az: PI, pol: 1.22, dist: 12, durMs: 24000,
    lines: [["八点整，对岸的激光一起打上天。", "Eight o'clock — lasers shoot up from across the harbour."], ["天星小轮慢慢穿过一片倒影。", "A Star Ferry slides through the reflections."], ["全世界最贵的夜景，一分钱不收。", "The world's most expensive night view, for free."]] },
  { id: "peaknight", city: "hk", locIds: ["peak"], emoji: "🌉", zh: "太平山顶 · 维港夜景", en: "The Peak · the harbour at night", hint: "山顶往北看，整个维港在脚下", hintEn: "Look north from the Peak; the whole harbour is at your feet", phase: 0.93, best: [H(19), H(22, 30)], az: 0, pol: 1.15, dist: 14, durMs: 22000,
    lines: [["中环的楼一栋挨一栋，一直挤到海边。", "Central's towers crowd right down to the sea."], ["对岸九龙的灯海一直铺到狮子山。", "Kowloon's sea of lights runs all the way to Lion Rock."], ["一百多年前，这里还只有缆车和几栋别墅。", "A century ago there was only the tram and a few villas up here."]] },

  /* ---- 更多观景时刻：按地名匹配，任何名字里带这些词的地点都能看 ---- */
  { id: "windownight", city: "sz", locIds: ["window"], names: ["世界之窗"], emoji: "🗼", zh: "世界之窗 · 埃菲尔铁塔亮灯", en: "Window of the World · the tower lights up", hint: "天黑后铁塔一层层亮起来", hintEn: "After dark the tower lights up tier by tier", phase: 0.93, best: [H(18, 30), H(21, 30)], az: PI / 4, pol: 1.15, dist: 12, durMs: 20000,
    lines: [["小埃菲尔铁塔亮了，游客举着手机排成一排。", "The little Eiffel Tower lights up; a row of phones goes up."], ["远处的地铁 1 号线从高架上划过。", "Line 1 slides past on the viaduct in the distance."], ["一晚上，走遍了「全世界」。", "The whole world, in one evening."]] },
  { id: "baywheel", city: "sz", locIds: [], names: ["欢乐港湾", "湾区之光"], emoji: "🎡", zh: "欢乐港湾 · 湾区之光摩天轮", en: "Joy Harbour · the Bay Glory wheel", hint: "坐上摩天轮，看前海和伶仃洋", hintEn: "Ride the wheel over Qianhai and the Lingding sea", phase: 0.71, best: [H(17, 30), H(19)], az: PI / 2, pol: 1.05, dist: 14, durMs: 22000, faceSea: true,
    lines: [["轿厢慢慢升到最高点，前海的楼都在脚下。", "The cabin climbs to the top; Qianhai's towers are below you."], ["对岸的机场，一架飞机正在降落。", "Across the water a plane is landing at the airport."], ["深圳最年轻的天际线，就长在这片填海地上。", "Shenzhen's youngest skyline grew on this reclaimed land."]] },
  { id: "wutongsunrise", city: "sz", locIds: ["wutongshan"], names: ["梧桐山"], emoji: "⛰️", zh: "梧桐山 · 深圳之巅日出", en: "Wutong Mountain · sunrise from Shenzhen's peak", hint: "凌晨上山，在山顶等日出和云海", hintEn: "Climb before dawn; wait for the sunrise and the cloud sea", phase: 0.27, best: [H(5, 30), H(7)], az: PI, pol: 1.1, dist: 16, durMs: 22000,
    lines: [["云海从山谷里漫上来，罗湖的楼只露出楼顶。", "A sea of cloud fills the valleys; only Luohu's rooftops show."], ["往南看，香港的山一层一层排到海边。", "To the south, Hong Kong's hills line up to the sea."], ["爬了三个小时，就为这一分钟。", "Three hours of climbing, for this one minute."]] },
  { id: "dapengfort", city: "sz", locIds: ["dapengfort"], names: ["大鹏所城", "较场尾"], emoji: "🏯", zh: "大鹏所城 · 古城黄昏", en: "Dapeng Fortress · dusk in the old town", hint: "傍晚走进六百年的老城", hintEn: "Walk into the 600-year-old fort at dusk", phase: 0.71, best: [H(17), H(19)], az: PI / 3, pol: 1.15, dist: 11, durMs: 20000,
    lines: [["青石板路，老城墙，屋顶冒着炊烟。", "Flagstones, old walls, smoke rising from the roofs."], ["六百年前，这里守着整片海。", "Six hundred years ago, this fort guarded the whole coast."], ["深圳原来也有「老」的一面。", "So Shenzhen has an old side too."]] },
  { id: "xichongstars", city: "sz", locIds: ["xichong", "yangmeikeng", "qiniangshan"], names: ["西涌", "杨梅坑", "七娘山"], emoji: "🌌", zh: "西涌 · 海边看星空", en: "Xichong · stars over the sea", hint: "深圳最暗的夜空，能看见银河", hintEn: "Shenzhen's darkest sky — you can see the Milky Way", phase: 0.97, best: [H(21), H(24)], az: PI, pol: 1.25, dist: 12, durMs: 22000, faceSea: true,
    lines: [["城市的光到不了这里，天上全是星星。", "The city's glow doesn't reach here; the sky is full of stars."], ["帐篷外面，浪一声一声拍着沙滩。", "Outside the tent, waves keep breaking on the sand."], ["原来深圳也看得见银河。", "So you can see the Milky Way from Shenzhen."]] },
  { id: "nantounight", city: "sz", locIds: [], names: ["南头古城"], emoji: "🏮", zh: "南头古城 · 灯笼夜色", en: "Nantou Old Town · lantern night", hint: "晚上的古城，灯笼一路挂到城门", hintEn: "At night the lanterns run all the way to the gate", phase: 0.93, best: [H(19), H(22)], az: PI / 6, pol: 1.15, dist: 10, durMs: 20000,
    lines: [["城门洞里挂着一串红灯笼。", "A string of red lanterns hangs in the gateway."], ["老街里有人在弹吉他，旁边是卖糖水的摊。", "Someone plays guitar on the old street beside a sweet-soup stall."], ["一千七百年的古城，住着二十岁的年轻人。", "A 1,700-year-old town, full of twenty-year-olds."]] },
  { id: "hqbnight", city: "sz", locIds: ["hq"], names: ["华强北"], emoji: "💡", zh: "华强北 · 霓虹夜市", en: "Huaqiangbei · neon night", hint: "夜里的电子街，招牌一块比一块亮", hintEn: "The electronics street at night, every sign brighter than the last", phase: 0.93, best: [H(19), H(22)], az: 0, pol: 1.15, dist: 11, durMs: 20000,
    lines: [["整条街的招牌都在闪，像一块巨大的电路板。", "Every sign on the street flickers like a giant circuit board."], ["无人机在头顶上悬停拍照。", "A drone hovers overhead, taking pictures."], ["全世界的手机，都有一部分来自这里。", "Part of every phone in the world comes from here."]] },
  { id: "octharbournight", city: "sz", locIds: ["octharbour"], names: ["欢乐海岸"], emoji: "🌉", zh: "欢乐海岸 · 湖边夜色", en: "OCT Harbour · lakeside night", hint: "湖边的音乐喷泉和灯光", hintEn: "Music fountains and lights by the lake", phase: 0.93, best: [H(19), H(22)], az: PI / 2, pol: 1.15, dist: 11, durMs: 20000,
    lines: [["喷泉跟着音乐跳起来。", "The fountains dance to the music."], ["湖对岸，后海的楼一栋栋亮着。", "Across the lake, Houhai's towers glow one by one."], ["散步的人很多，没人赶时间。", "Lots of people strolling; nobody in a hurry."]] },
  { id: "seaworldsunset", city: "sz", locIds: ["swcac"], names: ["海上世界"], emoji: "🚢", zh: "海上世界 · 明华轮日落", en: "Sea World · sunset on the Minghua ship", hint: "老邮轮停在广场上，傍晚最好看", hintEn: "The old cruise ship moored in the plaza, best at dusk", phase: 0.71, best: [H(17), H(19)], az: PI / 2, pol: 1.12, dist: 12, durMs: 20000, faceSea: true,
    lines: [["明华轮的船身被夕阳染成金色。", "The Minghua's hull turns gold in the sunset."], ["蛇口的老街坊说，这里是改革开放的第一声炮响。", "Old Shekou folks say this is where reform and opening up began."], ["海风吹过，酒吧的灯一盏盏亮了。", "A sea breeze; the bar lights come on one by one."]] },
  { id: "luofuclouds", city: "hz", locIds: ["luofu"], names: ["罗浮山"], emoji: "☁️", zh: "罗浮山 · 云海日出", en: "Luofu Mountain · sunrise over the clouds", hint: "清晨山顶看云海", hintEn: "Cloud sea from the summit at dawn", phase: 0.27, best: [H(5, 30), H(7)], az: PI, pol: 1.1, dist: 15, durMs: 22000,
    lines: [["云从脚下翻过去，像一片白色的海。", "Cloud rolls past below you like a white sea."], ["道观的钟声从山腰传上来。", "The Taoist temple's bell rises from halfway down the mountain."], ["葛洪在这里炼了一辈子丹，你只爬了一早上。", "Ge Hong spent a lifetime here making elixirs; you only climbed one morning."]] },
  { id: "shuangyue", city: "hz", locIds: [], names: ["双月湾"], emoji: "🌊", zh: "双月湾 · 两片海湾", en: "Double Moon Bay · two bays at once", hint: "站在观景台上，左右两片月牙海湾", hintEn: "From the lookout, two crescent bays at once", phase: 0.71, best: [H(16, 30), H(18, 30)], az: 0, pol: 1.05, dist: 16, durMs: 22000, faceSea: true,
    lines: [["左边浪大，右边浪小，一条沙堤把海分成两半。", "Big waves on the left, small on the right — a sand spit splits the sea."], ["冲浪的人在左边，带娃的人在右边。", "Surfers on the left, families on the right."], ["惠州最上镜的一片海。", "Huizhou's most photogenic stretch of sea."]] },
  { id: "gaobang", city: "hz", locIds: ["gaobangshan"], names: ["高榜山", "挂榜阁"], emoji: "🏯", zh: "高榜山 · 挂榜阁看惠州夜景", en: "Gaobang Hill · Huizhou at night from the pavilion", hint: "爬到挂榜阁，整个惠城在脚下", hintEn: "Climb to the pavilion; all of Huicheng below", phase: 0.93, best: [H(18, 30), H(21)], az: PI, pol: 1.1, dist: 15, durMs: 20000,
    lines: [["西湖像一块黑色的镜子嵌在城里。", "West Lake sits in the city like a black mirror."], ["东江边的灯一直亮到远处的大桥。", "Lights run along the Dongjiang to the far bridge."], ["惠州不大，但一眼看不完。", "Huizhou isn't big, but you can't take it in at a glance."]] },
  { id: "shuidongnight", city: "hz", locIds: [], names: ["水东街"], emoji: "🏮", zh: "水东街 · 骑楼老街夜市", en: "Shuidong Street · arcade night market", hint: "骑楼下的夜市和糖水铺", hintEn: "Night market and sweet-soup shops under the arcades", phase: 0.93, best: [H(19), H(22)], az: PI / 4, pol: 1.15, dist: 10, durMs: 20000,
    lines: [["骑楼一排排亮着暖黄的灯。", "The arcades glow warm yellow, one after another."], ["梅菜扣肉的香味从小店里飘出来。", "The smell of braised pork with preserved greens drifts out of a shop."], ["惠州的老城，晚上才最热闹。", "Huizhou's old town is liveliest after dark."]] },
  { id: "turtlebay", city: "hz", locIds: [], names: ["海龟湾", "港口海龟"], emoji: "🐢", zh: "惠东海龟湾 · 夜里看海龟上岸", en: "Huidong Turtle Bay · turtles coming ashore at night", hint: "夏夜的沙滩，海龟上岸产卵", hintEn: "On summer nights, turtles come ashore to lay eggs", phase: 0.97, best: [H(20), H(24)], az: PI, pol: 1.25, dist: 10, durMs: 22000, faceSea: true,
    lines: [["沙滩上一片漆黑，大家都关了手电。", "The beach is pitch dark; everyone has switched off their torches."], ["一只海龟慢慢爬上来，挖了一个坑。", "A turtle hauls itself up and slowly digs a pit."], ["大陆唯一的海龟自然保护区，就在惠州。", "Mainland China's only sea-turtle reserve is in Huizhou."]] },
  { id: "starferry", city: "hk", locIds: ["tst"], names: ["天星", "尖沙咀"], emoji: "⛴️", zh: "天星小轮 · 夜渡维港", en: "Star Ferry · crossing the harbour at night", hint: "坐一程天星小轮，HK$5 看全世界最贵的夜景", hintEn: "One Star Ferry ride — HK$5 for the world's priciest view", phase: 0.93, best: [H(19), H(22, 30)], az: PI * 0.9, pol: 1.22, dist: 9, durMs: 24000, path: [[11.8, 11.9], [11.4, 13.0], [10.9, 14.2], [10.5, 15.2]],
    lines: [["船身一晃，离开尖沙咀码头。", "The boat lurches away from the Tsim Sha Tsui pier."], ["中环的楼越来越近，灯越来越亮。", "Central's towers come closer, brighter and brighter."], ["一百多年，这条船每天来回几十趟。", "For over a century, this boat has crossed dozens of times a day."]] },
  { id: "avenuestars", city: "hk", locIds: [], names: ["星光大道"], emoji: "⭐", zh: "星光大道 · 看港岛天际线", en: "Avenue of Stars · the Island skyline", hint: "海滨长廊对着整个港岛", hintEn: "The promenade faces the whole of Hong Kong Island", phase: 0.93, best: [H(19), H(22)], az: PI, pol: 1.18, dist: 12, durMs: 20000,
    lines: [["李小龙的铜像摆着那个经典的姿势。", "The Bruce Lee statue strikes his famous pose."], ["对岸的 IFC 和中银大厦像两把尖刀。", "Across the water, IFC and the Bank of China tower rise like blades."], ["香港电影里的香港，就是这个样子。", "This is Hong Kong as the films show it."]] },
  { id: "westkowloonsunset", city: "hk", locIds: ["westkowloon"], names: ["西九", "M+"], emoji: "🌇", zh: "西九文化区 · 海滨日落", en: "West Kowloon · harbourfront sunset", hint: "草坪上野餐，等日落", hintEn: "Picnic on the lawn and wait for sunset", phase: 0.71, best: [H(17), H(18, 45)], az: PI / 2, pol: 1.12, dist: 12, durMs: 20000, faceSea: true,
    lines: [["太阳落向青马大桥的方向。", "The sun sets towards the Tsing Ma Bridge."], ["草坪上有人在弹吉他，有人在遛狗。", "On the lawn, someone plays guitar; someone walks a dog."], ["香港难得的大片草地，人人都想在这里坐一坐。", "Open lawn is rare in Hong Kong — everyone wants a seat here."]] },
  { id: "lionrock", city: "hk", locIds: [], names: ["狮子山"], emoji: "🦁", zh: "狮子山 · 俯瞰九龙", en: "Lion Rock · Kowloon below", hint: "狮子头上看九龙和维港", hintEn: "From the lion's head, Kowloon and the harbour", phase: 0.71, best: [H(16, 30), H(18, 30)], az: PI, pol: 1.08, dist: 16, durMs: 22000,
    lines: [["九龙的楼密密麻麻铺到海边。", "Kowloon's towers pack all the way to the sea."], ["一架飞机贴着楼顶飞向远处。", "A plane skims the rooftops into the distance."], ["「同舟人，誓相随」——狮子山下的那首歌。", "“Together in one boat” — the Lion Rock song."]] },
  { id: "taiosunset", city: "hk", locIds: ["taio"], names: ["大澳"], emoji: "🏘️", zh: "大澳渔村 · 棚屋日落", en: "Tai O · sunset over the stilt houses", hint: "棚屋、渔船和中华白海豚", hintEn: "Stilt houses, fishing boats and pink dolphins", phase: 0.71, best: [H(17), H(18, 45)], az: PI / 2, pol: 1.15, dist: 11, durMs: 20000, faceSea: true,
    lines: [["棚屋的影子落在水面上。", "The stilt houses' shadows fall across the water."], ["老阿婆在门口晒咸鱼。", "An old lady dries salted fish at her door."], ["香港的另一面，慢得像另一个时代。", "Hong Kong's other side, as slow as another era."]] },
  { id: "stanley", city: "hk", locIds: ["stanley"], names: ["赤柱"], emoji: "⛵", zh: "赤柱 · 海滨黄昏", en: "Stanley · seaside dusk", hint: "卜公码头和海边的西餐厅", hintEn: "Blake Pier and the seafront restaurants", phase: 0.71, best: [H(17), H(19)], az: PI, pol: 1.15, dist: 11, durMs: 20000, faceSea: true,
    lines: [["帆船慢慢回港。", "Sailboats drift back into harbour."], ["海边餐厅的露台坐满了人。", "The seafront terraces are full."], ["港岛南边，比中环安静一百倍。", "The south side of the Island is a hundred times quieter than Central."]] },
  { id: "disneyfireworks", city: "hk", locIds: ["disney"], names: ["迪士尼"], emoji: "🎆", zh: "迪士尼 · 城堡烟花", en: "Disneyland · fireworks over the castle", hint: "晚上八点半，城堡上空放烟花", hintEn: "At 8:30 pm, fireworks over the castle", phase: 0.95, best: [H(20), H(21)], az: 0, pol: 1.15, dist: 12, durMs: 22000,
    lines: [["城堡的灯一变，人群安静了。", "The castle lights change; the crowd goes quiet."], ["第一朵烟花在头顶炸开。", "The first firework bursts overhead."], ["小孩坐在爸爸肩膀上，大人也看呆了。", "Kids on their dads' shoulders; the grown-ups are spellbound too."]] },
];

export function momentsAt(city: CityKey, locId: string, locName = ""): ScenicMoment[] {
  return SCENIC_MOMENTS.filter((m) => m.city === city && (m.locIds.includes(locId) || (!!locName && (m.names ?? []).some((n) => locName.includes(n)))));
}
export const inBest = (m: ScenicMoment, tn: number) => tn >= m.best[0] && tn <= m.best[1];

const LANDS: Record<CityKey, [number, number][][][]> = { sz: LSZ, hz: LHZ, hk: LHK };
function onLand(city: CityKey, x: number, z: number): boolean {
  let inside = false;
  for (const poly of LANDS[city]) {
    let inPoly = false;
    for (const ring of poly) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, zi] = ring[i]!, [xj, zj] = ring[j]!;
        if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inPoly = !inPoly;
      }
    }
    if (inPoly) inside = true;
  }
  return inside;
}
/** the camera azimuth that looks from the spot out over the most open water */
export function seawardAz(city: CityKey, x: number, z: number, fallback: number): number {
  let best = fallback, bestN = -1;
  for (let k = 0; k < 16; k++) {
    const az = (k / 16) * Math.PI * 2;
    // the camera sits at +(sin az, cos az) and looks toward -(sin az, cos az)
    const dx = -Math.sin(az), dz = -Math.cos(az);
    let n = 0;
    for (const r of [2, 4, 6, 9, 12]) if (!onLand(city, x + dx * r, z + dz * r)) n += 1;
    if (n > bestN) { bestN = n; best = az; }
  }
  return bestN <= 0 ? fallback : best;
}
