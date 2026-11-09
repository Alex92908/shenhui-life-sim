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
];

export function momentsAt(city: CityKey, locId: string): ScenicMoment[] {
  return SCENIC_MOMENTS.filter((m) => m.city === city && m.locIds.includes(locId));
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
