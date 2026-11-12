// Round-9 — named 城中村 / 小区 as real places (lee: "很多店铺都在这种门面
// 的啊"). The 116 locations had ZERO named urban villages or residential
// communities: the only 城中村 was the player's own home (城中村握手楼）,
// and residential areas existed only as generic "街道 / 片区" district
// labels. These are the ground-floor storefronts where 糖水铺 / 肠粉档 /
// 奶茶店 actually live in Shenzhen / Huizhou / Hong Kong.
//
// Total: 19 places (cap ~20, lee's bound — NOT one per metro station; SZ
// alone has 381 stations, which would blow the list to ~500). Coverage:
// 6 SZ core + 坪洲 (lee 点名） + 麻布新村 / 华侨新村 / 径贝新村 (lee 点名，
// 坪洲站附近） + 6 near major interchange hubs where no named residential
// place was nearby (民治新村·深圳北站 / 岗厦村·岗厦北 / 益田村·会展中心 /
// 上油松村·龙华 / 布吉新村·布吉 / 湖贝村·罗湖-老街）. Skipped hubs that
// are already covered: 福田 (上沙/下沙）, 车公庙 (上沙）, 世界之窗 (白石洲）,
// 宝安中心 (坪洲+三新村）, 深圳湾口岸 & 前海湾 (port/commercial, no natural
// 城中村 slot; area already dense). HZ 2, HK 2.
//
// "Every station feels lived-in": NOT done via named places (the cap above).
// The filler/residential buildings on the map are placed by the map's own
// filler pass and do not cluster near stations; reworking that pass to
// cluster near stations is not cheap and would change the whole map's look,
// so it is left as-is — the named set is the deliverable.
//
// Where they live: NOT in data.ts next to the home entry, and NOT in the
// generated places-*.ts (OSM data, "do not edit by hand"). They are defined
// here and merged into getLocations() in data.ts, so they are searchable,
// walkable and pickable as shop/flat locations exactly like the other
// places. Type "oldtown" (street with storefronts) + venueSet "oldtown":
// the walk-in interior is the old-street scene (shopfronts, stalls), not a
// park and not a wet market.
//
// Coordinates are hand-placed near the real spots, each ≥2.5 units from
// every existing location in its city so markers do not overlap. Shops
// placed here sit at the ground-floor storefront: floor = 1F.

import type { CityKey, Loc } from "../data";

export const VILLAGE_LOCS: Record<CityKey, Loc[]> = {
  sz: [
    {
      id: "pingzhou", type: "oldtown", emoji: "🏘️", name: "坪洲", short: "坪洲",
      desc: "宝安坪洲：城中村的握手楼挨着地铁站，楼下全是小铺面——糖水、肠粉、奶茶、早餐，生意做到半夜。住这儿的人多，店也多。",
      x: -32.5, z: 1.0, color: 0xd97706, h: 1.8, w: 2.4,
      venueSet: "oldtown", animKind: "oldtown",
    },
    {
      id: "baishizhou", type: "oldtown", emoji: "🏘️", name: "白石洲", short: "白石洲",
      desc: "南山白石洲：深圳最有名的城中村，握手楼一栋挨一栋，楼下是沙县、兰州拉面、糖水铺和手机贴膜摊。深漂的第一站。",
      x: -17.0, z: -1.0, color: 0xea580c, h: 2.0, w: 2.6,
      venueSet: "oldtown", animKind: "oldtown",
    },
    {
      id: "dachong", type: "oldtown", emoji: "🏘️", name: "大冲村", short: "大冲",
      desc: "南山大冲：高新园旁边的城中村，白天是程序员的食堂，晚上是烧烤摊和奶茶店的地盘。楼下铺面一个挨一个。",
      x: -23.5, z: -0.5, color: 0xca8a04, h: 1.8, w: 2.4,
      venueSet: "oldtown", animKind: "oldtown",
    },
    {
      id: "shangsha", type: "oldtown", emoji: "🏘️", name: "上沙村", short: "上沙",
      desc: "福田上沙：城中村的老街，楼下全是小吃店和士多，糖水铺的冰镇绿豆沙是夏天的标配。住的人多，回头客也多。",
      x: -6.8, z: -4.2, color: 0xdc2626, h: 1.9, w: 2.5,
      venueSet: "oldtown", animKind: "oldtown",
    },
    {
      id: "xiasha", type: "oldtown", emoji: "🏘️", name: "下沙村", short: "下沙",
      desc: "福田下沙：老牌城中村，楼下是肠粉档、粥粉面和水果摊，早上六点就开档。铺面小，烟火气大。",
      x: -8.8, z: -5.8, color: 0xb45309, h: 1.9, w: 2.5,
      venueSet: "oldtown", animKind: "oldtown",
    },
    {
      id: "taoyuan", type: "oldtown", emoji: "🏡", name: "桃源村", short: "桃源村",
      desc: "南山桃源村：大片的居民小区，楼下是社区商铺——早餐店、奶茶店、药店、理发店，住户就是最稳的客流。",
      x: -12.5, z: 5.5, color: 0x0d9488, h: 1.7, w: 2.6,
      venueSet: "oldtown", animKind: "oldtown",
    },
    // --- 坪洲 / 宝安三新村 (lee 点名）: 麻布新村 / 华侨新村 / 径贝新村。
    // 都在坪洲站附近的宝安居住区, 各自与坪洲及彼此保持 ≥3.5 间距。
    {
      id: "mabu", type: "oldtown", emoji: "🏡", name: "麻布新村", short: "麻布新村",
      desc: "宝安麻布新村：坪洲站北边的居民小区，楼下是早餐店、糖水铺和士多，住户多半在附近的工厂和写字楼上班，下班就顺手带杯奶茶。",
      x: -31.5, z: 4.5, color: 0x059669, h: 1.7, w: 2.5,
      venueSet: "oldtown", animKind: "oldtown",
    },
    {
      id: "huaqiao", type: "oldtown", emoji: "🏡", name: "华侨新村", short: "华侨新村",
      desc: "宝安华侨新村：坪洲站南边的老小区，楼下铺面一条街——肠粉档、粥粉面、理发店，早上六点开档，街坊都是熟面孔。",
      x: -31.5, z: -2.5, color: 0x0891b2, h: 1.7, w: 2.5,
      venueSet: "oldtown", animKind: "oldtown",
    },
    {
      id: "jingbei", type: "oldtown", emoji: "🏡", name: "径贝新村", short: "径贝新村",
      desc: "宝安径贝新村：西乡街道的居民小区，楼下是社区商铺，奶茶店、糖水铺、便利店挨着开，住户下楼就是顾客。",
      x: -28.0, z: -2.5, color: 0x65a30d, h: 1.7, w: 2.5,
      venueSet: "oldtown", animKind: "oldtown",
    },
    // --- 大型换乘枢纽附近的城中村 / 小区 (lee: 不按每站加, 只加枢纽,
    // 且只在附近还没有命名居住地的地方）。上限 ~20 个, 这里是最后 6 个。
    {
      id: "minzhi", type: "oldtown", emoji: "🏡", name: "民治新村", short: "民治新村",
      desc: "龙华民治新村：深圳北站旁边的居民小区，楼下是小吃店、奶茶店和便利店，高铁站的客流和住户的日常都在这条街上。",
      x: -6.5, z: -9.5, color: 0x0ea5e9, h: 1.7, w: 2.5,
      venueSet: "oldtown", animKind: "oldtown",
    },
    {
      id: "gangxia", type: "oldtown", emoji: "🏘️", name: "岗厦村", short: "岗厦村",
      desc: "福田岗厦村：岗厦北站旁边的城中村，握手楼下是糖水铺、肠粉档和手机店，福田中心区的打工人在这里解决三餐。",
      x: 0.5, z: -5.0, color: 0xdc2626, h: 1.9, w: 2.5,
      venueSet: "oldtown", animKind: "oldtown",
    },
    {
      id: "yitian", type: "oldtown", emoji: "🏡", name: "益田村", short: "益田村",
      desc: "福田益田村：会展中心旁边的成熟小区，楼下商铺一条街，奶茶店、糖水铺、早餐店挨着开，住户和白领都是常客。",
      x: -6.5, z: 5.5, color: 0x7c3aed, h: 1.7, w: 2.6,
      venueSet: "oldtown", animKind: "oldtown",
    },
    {
      id: "shangyousong", type: "oldtown", emoji: "🏘️", name: "上油松村", short: "上油松村",
      desc: "龙华上油松村：龙华站附近的城中村，楼下是肠粉档、糖水铺和早餐店，街坊熟客多，铺面小但烟火气足。",
      x: -2.0, z: -12.0, color: 0xea580c, h: 1.8, w: 2.5,
      venueSet: "oldtown", animKind: "oldtown",
    },
    {
      id: "buji", type: "oldtown", emoji: "🏡", name: "布吉新村", short: "布吉新村",
      desc: "龙岗布吉新村：布吉站旁边的居民小区，楼下是社区商铺，奶茶店、糖水铺、便利店一应俱全，住户下楼就能买。",
      x: 8.0, z: -12.5, color: 0x0284c7, h: 1.7, w: 2.5,
      venueSet: "oldtown", animKind: "oldtown",
    },
    {
      id: "hubei", type: "oldtown", emoji: "🏘️", name: "湖贝村", short: "湖贝村",
      desc: "罗湖湖贝村：老街站旁边的老城中村，骑楼底下是糖水铺、车仔面和旧式茶餐厅，罗湖最有市井味的一条街。",
      x: 10.5, z: -0.5, color: 0xb45309, h: 1.9, w: 2.5,
      venueSet: "oldtown", animKind: "oldtown",
    },
  ],
  hz: [
    {
      id: "shuikou", type: "oldtown", emoji: "🏘️", name: "水口村", short: "水口",
      desc: "惠州水口：江北边上的城中村，楼下是肠粉档、糖水铺和早餐店，街坊都是熟面孔，店开在这儿不愁没人来。",
      x: 3.5, z: 9.5, color: 0xca8a04, h: 1.8, w: 2.5,
      venueSet: "oldtown", animKind: "oldtown",
    },
    {
      id: "liri", type: "oldtown", emoji: "🏡", name: "丽日花园", short: "丽日花园",
      desc: "惠州江北丽日花园：成熟的居民小区，楼下商铺一条街，奶茶店、糖水铺、便利店挨着开，住户下楼就是顾客。",
      x: -2.0, z: -2.0, color: 0x0284c7, h: 1.7, w: 2.6,
      venueSet: "oldtown", animKind: "oldtown",
    },
  ],
  hk: [
    {
      id: "choihung", type: "oldtown", emoji: "🏘️", name: "彩虹邨", short: "彩虹邨",
      desc: "九龙彩虹邨：香港最出片的公共屋邨，彩色外墙下面是街市和茶餐厅，楼下小铺做街坊生意，熟客比游客多。",
      x: 15.5, z: 3.5, color: 0xdb2777, h: 2.2, w: 2.6,
      venueSet: "oldtown", animKind: "oldtown",
    },
    {
      id: "tokwawan", type: "oldtown", emoji: "🏢", name: "土瓜湾唐楼", short: "土瓜湾",
      desc: "九龙土瓜湾：老唐楼一条街，楼下是车仔面、糖水铺和旧式茶餐厅，骑楼底下摆满了档口，市井味最浓的地方。",
      x: 11.5, z: 10.5, color: 0x7c3aed, h: 2.0, w: 2.5,
      venueSet: "oldtown", animKind: "oldtown",
    },
  ],
};

/** The 城中村 / 小区 places for one city — merged into getLocations(). */
export function villageLocs(cityKey: CityKey): Loc[] {
  return VILLAGE_LOCS[cityKey] ?? [];
}

/** Storefront-friendly places for the shop/flat place picker: the villages
    first (ground-floor storefronts), then the rest of the city's places. */
export function storefrontLocs(cityKey: CityKey, all: Loc[]): Loc[] {
  const vs = villageLocs(cityKey);
  const vIds = new Set(vs.map((l) => l.id));
  return [...vs, ...all.filter((l) => !vIds.has(l.id))];
}
