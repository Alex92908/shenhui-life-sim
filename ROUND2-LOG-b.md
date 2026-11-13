# ROUND-2 LOG — area (b): content-mismatch fixes + market subtypes + Huaqiangbei metro line

Date: 2026-11-11. Branch: `feature/round-2` (local only, never pushed, main untouched).
Baseline: 32348ca. Workdir: `~/workspace/shenhui-life-sim/`.

## Files changed (only the allowed ones + 1 new file)

| File | What changed |
|---|---|
| `client/src/data.ts` | LocType +9 types; `VenueSetId`/`AnimKindId` unions; `Loc.venueSet`/`animKind` fields; `Npc.onlyLocIds`/`neverLocIds` + `npcAllowedAt()` helper; 5 NPCs rescoped; 12 retypes (table 2); 8 markets split (table 1); `venueSet` on 52 places + `animKind` on 44 places (table 3); id renames `hq`→`qiaodong`, `work`→`work-hz` (Huizhou only) + metro/rail refs; new place 南头古城夜市 (`nantou`); `LINE_SPEED` += `hqline`; LOC_EN += 南头古城夜市 |
| `client/src/metro-sz.ts` | New line `hqline` 华强北商圈线（电子街专线）: 岗厦北—华强路—华强北—华新—燕南—华强南 (coords copied exactly from lines 1/2/7/11 so transfers work by same-name station) |
| `client/src/routines.ts` | ROLE_META `where` resubtyped for waiter/chef/barber/barista/nails/agent/vendor/sales/petgroomer; new `vendorSellFor(locType)` helper |
| `client/src/places-sz.ts` | 世界之窗 `:213` + 锦绣中华民俗村 `:268`: `"park"` → `"themepark"` |
| `client/src/experience.ts` | `:216` 华强北讲解 NPC: 大芬姐 → 阿杰（档口老板）, story rewritten |
| `client/src/activities.ts` | (minimal, unowned file) `isFun` += 迪士尼\|海洋公园； `isMarket` extended to all 7 market subtypes; `notBuilding` += museum/library/factory/electronics/oilpainting/secondhand |
| `client/src/round2/venues.ts` | **NEW.** `ANIM_BY_PLACE` + `animFor()`, `VENUE_SET_COPY`, `venueSetFor()`, `VENUE_TALK`, `MARKET_ACTION_SPEC` |
| `client/src/scenic.ts` | **No change** — see note below |

## Typecheck

`cd ~/workspace/shenhui-life-sim/standalone && npx tsc --noEmit -p tsconfig.json`
— **0 errors in my files.** The only remaining errors (4) are in other areas'
in-flight work, which I may not touch:
- `LifeStage.tsx:87` TS1117 duplicate `bedroom` key in ROAM_SPOTS (area g added
  bedroom/kitchen/bathroom cutscene spots colliding with the existing `bedroom` entry).
- `round2/house.ts:204` TS2783 `wallColor`/`floorColor`/`walls` specified twice
  in a spread (area g).
No `npm run build` run (per task — the integration agent does the final build).

## Per-table status (audit tables 1–7)

### Table 1 — 8 markets split ✅ done in data.ts (interiors/actions need integration snippets S1/S4 + area g sets)
- 华强北电子市场 → `electronics`, venueSet `electronics` (interior already exists: LifeStage:1387, App:119), gigName `装机 / 验机兼职`.
- 大芬油画村 → `oilpainting`, venueSet `oilpainting`, gigName already `画作装裱 / 临摹兼职`.
- 桥东二手市集 → `secondhand`, id `hq`→`qiaodong`, venueSet `secondhand`, gigName `旧货整理 / 修小电器`.
- 淡水老城 → `oldtown`, venueSet `oldtown`, animKind `oldtown`.
- 霞涌海鲜街 → `seafood`, venueSet `seafood`, animKind `cruise`.
- 旺角·女人街 → `womensstreet`, venueSet `womensstreet`.
- 北角·春秧街街市 → stays `market` (the ONLY true wet market left), venueSet `market`.
- 元朗·大马路 → `oldtown`, venueSet `oldtown`, animKind `oldtown`.
- Market walk-in NPC dialogue (App:60-61 菜档阿姨/鱼档老板）: **fixed by the split itself** —
  the `market:` talk table now only ever fires at 春秧街， since no other place
  has type `market`. No code change needed; new subtype talk lines are in
  `round2/venues.ts` VENUE_TALK (snippet S7 merges them).

### Table 2 — 12 retypes ✅ done
温泉酒店→`lodging`； 巽寮湾渔港→`port` （渔港内景 is area g's job — `port` maps to the
station-hall-like concourse today; **渔港 set still needed**, see "Needed from area (g)");
维多利亚公园→`scenic` (venueSet `park`); 红花湖骑行站→`scenic` (venueSet/animKind `cycle` —
**骑行 set still needed**); 深圳博物馆+惠州博物馆→`museum` (new type, venueSet `museum`,
animKind `gallery`); 香港中央图书馆→`library` (new type, venueSet `library`);
中海油大亚湾石化区+亿纬锂能产业园→`factory` (new type, venueSet `factory`);
罗浮山+高榜山→`mountain` (venueSet/animKind `hike`); 檀悦豪生→`lodging` (animKind `beach`,
venueSet left unset so the hotel bedroom interior applies).
New types added to the `LocType` union: `museum | library | factory |
electronics | oilpainting | secondhand | seafood | oldtown | womensstreet`.

### Table 3 — per-place venueSet ✅ done (52 places got venueSet, 44 got animKind)
- Reused existing LifeSets: coaster (欢乐谷）, safari （野生动物园）, aquarium （海洋公园）,
  cablecar （东部华侨城/昂坪/太平山顶）, cruise （合江楼/大澳/惠州西湖/三角洲岛）,
  beach (4 misclassified beaches: 大亚湾黄金海岸/屯门·黄金海岸/三角洲岛/杨梅坑 + 大梅沙/
  西涌/双月湾/赤柱/海龟湾）, park （维多利亚公园）, hike （罗浮山/高榜山）,
  market （春秧街）, electronics （华强北）.
- Boardwalk fix: 盐田海滨栈道 + 尖沙咀海滨·维多利亚港 → venueSet `boardwalk`
  (NOT beach), animKind `stroll`.
- Full new-set list for area (g) is in "New names for area (g)" below.
- Correct-as-is places deliberately left without venueSet (generic park/beach is
  right there): 人才公园， 莲花山公园， 深圳湾公园， 仙湖植物园， 东江公园， 惠州植物园，
  plus 温泉酒店/巽寮湾渔港 (type-driven interior is right; 渔港 set still wanted).

### Table 4 — animation table ✅ done
`client/src/round2/venues.ts`: `ANIM_BY_PLACE` (44 ids) + `animFor()` covers all
21 fall-throughs (迪士尼→wheel, 海洋公园→aquarium — the old aquarium name check
that missed "海洋公园" is subsumed: lookup is by id now, snippet S2 replaces
`special` App:2866-2876 entirely). No more name-regex hardcoding for places.
Legacy fallbacks kept ONLY for OSM `pl:` places / stations (mountain→hike,
beach-name→beach).

### Table 5 — venueActions / activities leftovers ✅ data done, App snippets provided
- `learn` case: needs NO change after the retypes — only 深圳图书馆·夜校 + 惠州市图书馆
  are still `learn`, and 夜校充电课/自习备考 is right for both. (Museums/library moved out.)
- `gym` case: needs NO change — only real gyms remain (社区健身房/春茧/大运中心）.
- `transit` case: needs NO change — 温泉酒店/渔港 moved out.
- `food` case: **snippet S4c** — remove `买菜囤食材` from all 4 food streets
  (东门夜市/老街夜市/上环茶餐厅/庙街夜市 are snack streets; FOODS eat actions stay).
- `electronics` mapping App:4604: **snippet S3** — `electronics: "market"` →
  `electronics: "electronics"` + per-subtype action sets (**snippet S4**).
- `activities.ts isFun`: ✅ fixed in-file (迪士尼|海洋公园 added). `isMarket` extended
  to all 7 market subtypes (mahjong etc. still offered at markets). `notBuilding`
  extended with the new indoor types (street subtypes seafood/oldtown/womensstreet
  deliberately NOT excluded — they are streets and should still match isSea/isEat).

### Table 6 — NPC / job filtering ✅ done in data.ts + routines.ts (placement needs snippets S3/S6)
- 大芬姐： preferTypes `["food","market"]` → `["food","oldtown"]` + `neverLocIds: ["dafen","hq"]`.
  Now at 东门夜市食街 + 南头古城夜市 only; never at 大芬油画村/华强北.
- 郭叔： preferTypes → `["market"]` + `onlyLocIds: []` — **empty on purpose**: Huizhou
  has no true wet-market place, so he is placed nowhere on the map (stays in the
  cast for chat/stories). When a Huizhou wet market is added, put its id in
  `onlyLocIds` — do NOT put "market" back in preferTypes. (Snippet S3 must treat
  an empty `onlyLocIds` as "place nowhere", not "no restriction" — `npcAllowedAt`
  in data.ts already implements this.)
- 婆婆珍： preferTypes → `["market"]` + `onlyLocIds: ["chunyeung"]` (春秧街 only).
- 阿海： preferTypes `["scenic","market","port"]` → `["scenic","port","seafood"]` +
  `onlyLocIds: ["xiayong","xunliao","dayawan","haiguiwan","sanjiaozhou","fun"]`
  (seafood street / fishing port / beaches only; never 二手市集/老城）.
- Unlisted same-class fix: 肥妈 (HK) got `neverLocIds: ["mongkok","yuenlong"]` —
  she buys groceries at the real wet market, not at 女人街/元朗大马路.
- Jobs (routines.ts ROLE_META `where` — `atJob` in App:2146 already does
  `w.includes(l.type)`, so these take effect with no App change):
  waiter → `["food","market","seafood","oldtown","womensstreet"]`;
  chef → `["food","market","lodging","seafood","oldtown"]`;
  barber → `["mall","social"]`; barista → `["food","mall"]`; nails → `["mall"]`
  (厨师/美甲师/咖啡师/理发师 now NOT hireable at electronics/oilpainting);
  agent → `["mall","transit","oldtown"]`; vendor → all 7 market subtypes;
  sales → `["mall","electronics","oilpainting"]` (counter sales / gallery clerk —
  the existing-role entry point for 装机/销售 and 临摹/装裱/画廊店员）;
  petgroomer → `["mall"]` (unlisted same-class fix).
  Dedicated 装机/临摹/海鲜档帮工/旧货整理 RoutineRoles do not exist yet — the
  per-place `gigName` gigs cover them for now (see S4); new roles are a follow-up.
- 摆摊卖货 gig (routines.ts:278): new `vendorSellFor(locType)` helper returns the
  per-subtype copy (油画村→卖画/画具， 电子市场→手机壳/配件， 海鲜街→卖海鲜，
  二手市集→旧货， 老城→特产， 女人街→小商品）; snippet S6 wires it into the
  routine-action rendering (App:2370 loop).
- experience.ts:216 ✅: 华强北讲解 NPC 大芬姐 → **阿杰**（档口老板）,
  story rewritten ("阿杰在赛格摆了十年一米柜台……买整机先验机，开发票，别贪便宜。").
  ("阿杰" is a new guide-narrator name only — no NPCS entry, same as retired 王姨/老周
  who still narrate guides. i18n-en.ts needs the EN line — snippet S11.)

### Table 7 — data nits ✅ done, with 2 corrections to the task/audit
- id `"hq"`: 桥东二手市集 → `qiaodong`. Updated in data.ts: bus-hz-old route
  (`"桥东"` station). **NOT updated (wrong target):** `experience.ts:210` and
  `scenic.ts:71` both use `"hq"` for **Shenzhen 华强北** — verified by cityKey/locIds,
  so they must stay `"hq"`; the task's instruction to update them was mistaken.
  `scenic.ts` therefore has **no change** (its only `hq` ref is the SZ one).
- id `"work"`: 惠州仲恺公司 → `work-hz`. Updated in data.ts: hz-intercity +
  ganshen-rail `仲恺` stations. Shenzhen 科技园公司 keeps `"work"` (COMPANIES
  `startup` locIds + metro 1号线 高新园站 still point at it — renaming SZ would
  ripple into files outside area b).
- **Still needs integration (file not owned by area b):** `places-hz.ts:8`
  `HZ_LOC_KM` still has `"hq"` and `"work"` keys — snippet S9 renames them to
  `"qiaodong"` / `"work-hz"`. Until then `realKmOf()` falls back to the nearest
  station for those two places (non-fatal).
- Mojibake: **NOT present in this copy.** Audit said 德赛西威 `short: "德���"`,
  but data.ts:620 already reads `short: "德赛"`, and the whole file has zero
  U+FFFD characters (checked by script; the 启德邮轮码头 desc reads `大邮轮靠岸`
  correctly). No fix needed — nothing changed.
- places-sz.ts:213 世界之窗 + :268 锦绣中华民俗村 → `"themepark"` ✅
  (玛雅水公园 :645 was already themepark — untouched).
- 东涌 (table 7, borderline): left as `transit` per audit ("可接受").

## Also in area (b)
- **NEW MARKET:** 南头古城夜市 (`nantou`, SZ, type `oldtown`, venueSet/animKind
  `oldtown`, x -24.3 / z 3.8 — next to the real 南头古城 metro station on line 12,
  no overlap with nearby locs). funName `南头古城夜市逛吃` ¥35/心情+24,
  gigName `古城夜市帮工 / 摆摊`. It is also 大芬姐's second proper home
  (night-market owner at a night market) and matches the existing scenic
  `nantounight` spot (names `["南头古城"]`) with no changes needed there.
  LOC_EN entry added.
- **HUAQIANGBEI METRO LINE:** `hqline` in metro-sz.ts + `LINE_SPEED hqline: 1.6`
  in data.ts. **Labelled honestly as a game shuttle line, not a real Shenzhen
  metro line** ("华强北商圈线（电子街专线）") — lines 2/7 already serve 华强北站；
  this short line links the商圈's own stations (岗厦北/华强路/华强北/华新/燕南/
  华强南）. Note: metro-sz.ts's header says GENERATED — this one entry is
  hand-added and marked as such in its comment; regenerating from OSM would drop it.
- **Did NOT break:** landmarks.ts untouched; funName/funDesc copy untouched
  (only added venueSet/animKind fields); activities name-regex fallback kept
  (only extended isFun/isMarket/notBuilding as above).

## New names for area (g) — must build these in LifeStage / App
New **venue sets** (LifeSet + 3D scene + ROAM_SPOTS + VENUE_TALK ids):
`disney, tram, temple, oldtown, miniature, farm, wetland, watershow, gallery,
boardwalk, cycle, museum, library, factory, oilpainting, secondhand, seafood,
womensstreet` (17). Copy + talk lines for all 17 are in `round2/venues.ts`
(`VENUE_SET_COPY`, `VENUE_TALK`). ROAM_SPOTS ids to add = the VENUE_TALK `id`
values in that file (e.g. oilpainting: paint/copy/frame; secondhand: dig/haggle;
seafood: pick/boat; oldtown: snack/stroll; womensstreet: clothes/goldfish;
museum: tour/look; library: read/ask; factory: line/canteen; disney: castle/ride;
tram: ride; temple: fortune; miniature: photo; farm: milk; wetland: crab;
watershow: show; gallery: look; boardwalk: walk; cycle: ride; nature: butterfly).
Also still needed as full sets (not just copy): **渔港** (for 巽寮湾渔港, type `port`
today) and **骑行** (for 红花湖骑行站 — venueSet `cycle` is the placeholder name).
New **anim kinds** (LifeKind + `lifeStageFor` scene): `tram, temple, oldtown,
miniature, nature, farm, wetland, watershow, cycle, gallery` (10).
Reused as-is (already exist): venue sets coaster/safari/aquarium/cablecar/cruise/
beach/park/hike/market/electronics; anim kinds coaster/wheel/aquarium/cablecar/
cruise/beach/hike/turtle/stroll.

## Integration snippets for App.tsx / LifeStage.tsx (integration agent applies)
Imports needed once, at the top of App.tsx (near the other data imports):
```ts
import { venueSetFor, animFor, VENUE_TALK as ROUND2_VENUE_TALK } from "./round2/venues";
import { npcAllowedAt, type LocType } from "./data";
import { vendorSellFor } from "./routines";
```

### S1 — venueFor: use the table (App.tsx:115-141)
Delete the `VENUE_SETS` const (lines 115-129) and replace `venueFor` (lines 130-141) with:
```ts
function venueFor(loc: { type: string; id: string; name: string; venueSet?: VenueSetId; animKind?: AnimKindId }): { set: LifeSet; zh: string; en: string } | null {
  // Round-2: per-place venueSet first, then the type map + regex fallbacks in round2/venues.ts.
  // Cast is temporary: the new set names become LifeSet members once area (g) builds them.
  return venueSetFor(loc) as { set: LifeSet; zh: string; en: string } | null;
}
```
(Also add `VenueSetId, AnimKindId` to the `./data` type imports. `venueSetFor`
carries the same copy VENUE_SETS had, so deleting it loses nothing.)

### S2 — animation: replace `special` (App.tsx:2866-2876)
Replace the whole `const special = ...` block with:
```ts
// Round-2: signature animation is a table lookup by place id (round2/venues.ts),
// not name regex. The old aquarium name check ("海洋世界/水族" missed "海洋公园")
// is subsumed: oceanpark is in the table by id.
const special = animFor(loc, kind);
```
`animFor` keeps the legacy mountain→hike / beach-name→beach fallbacks for OSM
`pl:` places and stations only. Nothing else in that block changes (`ak`, `animMap` stay).

### S3 — NPC placement must honour the new scoping (App.tsx:2916, :4604-4609)
(a) App:4604 — electronics must NOT map back to market:
```ts
const VENUE_PLACE: Partial<Record<LifeSet, string>> = { restaurant: "food", mall: "mall", office: "work", gym: "gym", market: "market", electronics: "electronics", club: "fun", classroom: "learn", clinic: "health", bedroom: "lodging" };
```
(b) App:4609 `regularHere` — replace the filter:
```ts
const cast = npcsForCity(s.cityKey).filter((n) => npcAllowedAt(n, { id: venue3d.id, type: kind as LocType }));
```
(c) App:2916 `who` — replace:
```ts
const who = (s0.spouse && loc.type === "home" ? s0.spouse : null) ?? cast.find((n) => npcAllowedAt(n, loc))?.name ?? cast[0]?.name ?? "街坊";
```
(d) MapView.tsx:319-327 (area a's file — integration applies): replace the three
`n.preferTypes.includes(l.type)` / `byType(n.preferTypes)` checks with
`npcAllowedAt(n, l)` so 郭叔 (empty allow-list) is never placed and 阿海 never
lands on the second-hand market / old town. (MapView:324 lunch-hour
`byType(["food", "market"])` is fine as-is — `market` is now only the wet market.)

### S4 — venueActions per-subtype cases (App.tsx:3804-3930, insert before `default:`)
New cases to add after the `case "market":` block (which now fires ONLY at
北角·春秧街街市 — see S4b for its fix). All kinds used already exist in doAction
except `seafood-feast` / `snack-eat` (S4d). `base`, `Y`, `fmt`, `s`, `loc`, `city`,
`FOODS` are already in scope in venueActions.
```ts
      case "electronics":
        return [
          { kind: "market-phone", title: "淘二手手机捡漏", emoji: "📱", desc: "眼力决定收益：捡漏转手能赚，踩坑就自用", cost: `-${Y}400 · 约一半概率转手 +${Y}650`, disabled: s.money < 400 },
          { kind: "market-fix", title: "装机 / 维修兼职", emoji: "🛠️", desc: "帮摊主装机修小电器，手艺活", cost: `+${fmt(Math.round(base * 0.6))} · 能量 -20 · 经验 +1`, disabled: s.energy < 20 },
          { kind: "mall-shop", title: "买配件", emoji: "🔌", desc: "数据线、钢化膜、充电头，现买现用", cost: `-${Y}120 · 心情 +14` },
          { kind: "gig", title: loc.gigName ?? "装机 / 验机兼职", emoji: "🛠️", desc: "柜台帮工、验机、装机", cost: `+${fmt(Math.round(base * 0.55))} 起 · 能量 -18`, disabled: s.energy < 18 },
          { kind: "rest", title: "在柜台边歇会儿", emoji: "🧋", desc: "坐一会儿，看人来人往讲价", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "oilpainting":
        return [
          { kind: "mall-shop", title: "买幅画装点出租屋", emoji: "🖼️", desc: "临摹名画、原创小品，挂回家心情都不一样", cost: `-${Y}120 · 心情 +14` },
          { kind: "gig", title: loc.gigName ?? "画作装裱 / 临摹兼职", emoji: "🎨", desc: "临摹、装裱、画廊帮工", cost: `+${fmt(Math.round(base * 0.55))} 起 · 能量 -18`, disabled: s.energy < 18 },
          { kind: "fun", title: loc.funName ?? "看画展", emoji: "✨", desc: loc.funDesc ?? "满墙油画慢慢看", cost: `-${fmt(loc.funCost ?? 0)} · 心情 +${loc.funMood ?? 20}` },
          { kind: "rest", title: "在画廊里坐坐", emoji: "🪑", desc: "画看多了，坐下来歇会儿", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "secondhand":
        return [
          { kind: "market-phone", title: "淘二手好物", emoji: "📱", desc: "旧手机、旧家具、黑胶唱片，眼力决定收益", cost: `-${Y}400 · 约一半概率转手 +${Y}650`, disabled: s.money < 400 },
          { kind: "market-fix", title: "修小电器兼职", emoji: "🛠️", desc: "帮摊主修小电器、装机", cost: `+${fmt(Math.round(base * 0.6))} · 能量 -20 · 经验 +1`, disabled: s.energy < 20 },
          { kind: "mall-shop", title: "淘旧家具 / 黑胶", emoji: "📻", desc: "旧沙发、旧唱片，贱买也能捡到宝", cost: `-${Y}120 · 心情 +14` },
          { kind: "gig", title: loc.gigName ?? "旧货整理 / 修小电器", emoji: "🧺", desc: "帮摊主整理旧货、修小电器", cost: `+${fmt(Math.round(base * 0.55))} 起 · 能量 -18`, disabled: s.energy < 18 },
          { kind: "rest", title: "在地摊边歇会儿", emoji: "🧋", desc: "坐一会儿，看看过路的人淘什么", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "seafood":
        return [
          { kind: "seafood-feast", title: "吃海鲜大餐", emoji: "🦐", desc: "现捞现称，隔壁大排档代加工", cost: `-${Y}80 · 能量 +20 · 心情 +15`, disabled: s.money < 80 },
          { kind: "gig", title: loc.gigName ?? "海鲜街帮工 / 摆摊", emoji: "🦞", desc: "海鲜档帮工、摆摊、代客加工", cost: `+${fmt(Math.round(base * 0.55))} 起 · 能量 -18`, disabled: s.energy < 18 },
          { kind: "fun", title: loc.funName ?? "海鲜街逛逛", emoji: "✨", desc: loc.funDesc ?? "水箱里的活鱼活虾慢慢看", cost: `-${fmt(loc.funCost ?? 0)} · 心情 +${loc.funMood ?? 20}` },
          { kind: "rest", title: "在码头边歇会儿", emoji: "🧋", desc: "看渔船进出，吹吹海风", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "oldtown":
        return [
          { kind: "snack-eat", title: "吃老街小吃", emoji: "🥮", desc: "老婆饼、肠粉、客家小吃，现做现吃", cost: `-${Y}25 · 能量 +10 · 心情 +8`, disabled: s.money < 25 },
          { kind: "gig", title: loc.gigName ?? "老城摆摊 / 帮工", emoji: "🏮", desc: "老城摆摊、老店帮工", cost: `+${fmt(Math.round(base * 0.55))} 起 · 能量 -18`, disabled: s.energy < 18 },
          { kind: "fun", title: loc.funName ?? "逛老街", emoji: "✨", desc: loc.funDesc ?? "骑楼、老字号、界碑慢慢看", cost: `-${fmt(loc.funCost ?? 0)} · 心情 +${loc.funMood ?? 20}` },
          { kind: "checkin", title: "拍照打卡", emoji: "📸", desc: "在老街地标前打卡", cost: "心情 +12 · 免费" },
          { kind: "rest", title: "在骑楼下歇会儿", emoji: "🪑", desc: "老街的阴凉处最舒服", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "womensstreet":
        return [
          { kind: "snack-eat", title: "吃街边小吃", emoji: "🍢", desc: "女人街边走边吃", cost: `-${Y}25 · 能量 +10 · 心情 +8`, disabled: s.money < 25 },
          { kind: "mall-shop", title: "淘衣服鞋袜", emoji: "👗", desc: "平价衣袜、金鱼、花，讲价是正经事", cost: `-${Y}120 · 心情 +14` },
          { kind: "gig", title: loc.gigName ?? "女人街帮工", emoji: "🛍️", desc: "档口帮工、搬货、看摊", cost: `+${fmt(Math.round(base * 0.55))} 起 · 能量 -18`, disabled: s.energy < 18 },
          { kind: "rest", title: "在档口边歇会儿", emoji: "🧋", desc: "人潮里坐一会儿", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "museum":
        return [
          { kind: "fun", title: loc.funName ?? "看展", emoji: "✨", desc: loc.funDesc ?? "展厅、展柜慢慢看", cost: `-${fmt(loc.funCost ?? 0)} · 心情 +${loc.funMood ?? 18}` },
          { kind: "checkin", title: "拍照打卡", emoji: "📸", desc: "在展厅前打卡", cost: "心情 +12 · 免费" },
          { kind: "rest", title: "在展厅长椅上歇会儿", emoji: "🪑", desc: "看累了就坐一会儿", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "library":
        return [
          { kind: "learn-self", title: "自修", emoji: "📖", desc: "免费自习，慢慢攒技能", cost: "能量 -10 · 技能 +1 · 心情 +2 · 免费", disabled: s.energy < 10 },
          { kind: "fun", title: "借本书", emoji: "📚", desc: "借一本带回家慢慢读", cost: "心情 +6 · 免费" },
          { kind: "rest", title: "在阅览桌边歇会儿", emoji: "🪑", desc: "翻书声里歇一会儿", cost: "能量 +14 · 心情 +8 · 免费" },
        ];
      case "factory":
        return [
          { kind: "work", title: "正经上班", emoji: "🏭", desc: `干一天活拿一天钱 · 职级「${(CAREERS[s.careerIdx] ?? CAREERS[0]!).name}」工资 ×${(CAREERS[s.careerIdx] ?? CAREERS[0]!).mul} · 经验 +2`, cost: `+${fmt(base)} · 能量 -${28 - fitSave}`, disabled: s.energy < 28 - fitSave },
          { kind: "overtime", title: "拼命加班", emoji: "🔥", desc: "订单急，加班费一点五倍，钱多但掉心情", cost: `+${fmt(Math.round(base * 1.75))} · 能量 -${42 - fitSave} · 心情 -12`, disabled: s.energy < 42 - fitSave },
        ];
```

### S4b — `case "market":` fix (App.tsx:3921-3928, now fires ONLY at 春秧街）
Replace the `buy-groceries` desc (which names 郭叔 in all three cities) with:
```ts
          { kind: "buy-groceries", title: "市集买菜", emoji: "🥬", desc: `婆婆珍的菜摊新鲜又便宜，电车叮叮从摊边碌过，买一篮子囤着（当前食材 ×${s.groceries}）`, cost: `-${Y}28 · 食材 +1`, disabled: s.money < 28 },
```
and DELETE the `market-phone` + `market-fix` entries from the `market` case
(they belong to electronics/secondhand now — see S4). The `market` case keeps
only buy-groceries (+ rest if wanted).

### S4c — `case "food":` fix (App.tsx:3846-3851, audit table 5)
Delete the first entry (`{ kind: "buy-groceries", title: "买菜囤食材", ... }`)
from the `food` case — the four food streets are snack streets, not grocery
stalls; the FOODS `eat` actions that follow already cover eating. (Buying
groceries still exists at home `楼下买菜` and at the wet market, S4b.)

### S4d — two small doAction kinds (insert right after the `case "eat":` block, App.tsx:2597-2605)
```ts
case "seafood-feast": {
  s.money -= 80; s.mood += 15; s.energy += 20; s.mealCount += 1; s.hunger = clamp100(s.hunger + 40); s.fun = clamp100(s.fun + 6);
  msg = "现捞现做的海鲜大餐下肚，能量 +20，心情 +15。";
  break;
}
case "snack-eat": {
  s.money -= 25; s.mood += 8; s.energy += 10; s.mealCount += 1; s.hunger = clamp100(s.hunger + 20); s.fun = clamp100(s.fun + 4);
  msg = "老街小吃吃到饱，能量 +10，心情 +8。";
  break;
}
```
And add to `animMap` (App.tsx ~2865): `"seafood-feast": "eat", "snack-eat": "eat",`
(mirrors the `eat` entry so both play the eat scene).

### S5 — atJob "where are you supposed to be" labels (App.tsx:2179)
In the `TL` record inside the `atJob` failure branch, add:
```ts
electronics: ["电子市场", "an electronics market"], oilpainting: ["油画村", "an oil-painting village"], secondhand: ["二手市集", "a second-hand market"], seafood: ["海鲜街", "a seafood street"], oldtown: ["老街", "an old street"], womensstreet: ["女人街", "the Ladies' Market"], museum: ["博物馆", "a museum"], library: ["图书馆", "a library"], factory: ["厂区", "a factory"],
```
(Without these, a job started at a subtype place shows a missing label when the
player is elsewhere.)

### S6 — vendor goods vary by subtype (App.tsx:2370 loop, `routineActions`)
Replace `for (const st of routineSteps(role)) {` with:
```ts
  for (const rawSt of routineSteps(role)) {
    // Round-2: the street vendor sells different goods per market subtype.
    const st = role === "vendor" && rawSt.id === "sell"
      ? { ...rawSt, ...vendorSellFor(locById(currentLoc)?.type ?? "market") }
      : rawSt;
```
(`vendorSellFor` returns zh/sub/en/subEn/emoji/prop; the rest of the loop —
`st.emoji`, `st.zh`/`st.en`, `st.sub`/`st.subEn` — picks them up unchanged.
`doRoutine` itself needs no change: effects don't depend on the copy.)

### S7 — walk-in dialogue for the new sets (App.tsx:47 VENUE_TALK, :4605 MEET_IDS)
Merge the new table (do NOT rewrite the existing `market:`/`electronics:` entries):
```ts
const VENUE_TALK: Partial<Record<LifeSet, VenueTalk[]>> = {
  ...ROUND2_VENUE_TALK as Partial<Record<LifeSet, VenueTalk[]>>,
  restaurant: [ /* existing, unchanged */ ],
  // ... rest unchanged
};
```
(Temporary cast until the new set names join `LifeSet` — see S1.)
And extend `MEET_IDS` (App:4605) with the new talk ids that mean "met someone":
```ts
const MEET_IDS = new Set(["share", "coffee", "friend", "chat", "ask", "try", "classmate", "spot", "haggle", "fish", "paint", "copy", "frame", "dig", "pick", "boat", "snack", "clothes", "goldfish", "tour", "line", "ride", "fortune"]);
```

### S8 — opening hours for the new types (clock.ts `venueHours`, NOT my file)
```ts
  if (l.placeKind === "library" || l.type === "learn" || l.type === "library") return { w: [540, 1290] };
  // ... and in the market branch:
  if (l.type === "market" || ["electronics", "oilpainting", "secondhand", "seafood", "oldtown", "womensstreet"].includes(l.type)) return { w: [480, 1320] };
```
(Museums already match by name regex `/博物馆|美术馆/`; factories need no hours.)

### S9 — HZ_LOC_KM renames (places-hz.ts:8, NOT my file — integration applies)
In the `HZ_LOC_KM` record: `"work": [-5.84, 5.2]` → `"work-hz": [-5.84, 5.2]`,
`"hq": [2.87, -0.88]` → `"qiaodong": [2.87, -0.88]`. (One-line change each;
until then `realKmOf()` falls back to the nearest station for those two places.)

### S10 — MapView building lists (MapView.tsx:1506, :1514 — area a's file, flag only)
The building/open-hours lists there include `"market"` but not the new market
subtypes (`electronics`, `oilpainting`, `secondhand`, `seafood`, `oldtown`,
`womensstreet`) or `museum`/`library`/`factory`. Add them to whichever of the
two lists renders shop/building treatment, so the new places get buildings and
opening hours on the map like the wet market does.

### S11 — EN line for the new guide narrator (i18n-en.ts)
Add:
```ts
"阿杰在赛格摆了十年一米柜台：“以前发货用麻袋装，现在的小哥背个双肩包，包里就是一家公司的全部库存。买整机先验机，开发票，别贪便宜。”": "Ah Jie has run a one-metre counter at SEG for ten years: “We used to ship in sacks; now a courier with a backpack carries a whole company's stock. Check a full machine before you buy, and get a receipt — don't chase the cheapest price.”",
```

## Open questions / follow-ups (not blockers)
1. **渔港 + 骑行 sets** (area g): 巽寮湾渔港 (`port`) and 红花湖骑行站 (`cycle`)
   still need their own interiors; `port`→concourse and `cycle` are placeholders.
2. **Dedicated job roles** for 装机/临摹/装裱/海鲜档帮工/旧货整理 don't exist as
   RoutineRoles yet; per-place `gigName` gigs + the `sales` role cover them for now.
3. **Old saves** store `currentLoc` by id: Huizhou saves pointing at `"hq"` /
   `"work"` will resolve to nothing after the rename (getLocations is city-scoped,
   so a stale id just won't match — player will need to re-pick the place).
   Worth a save-migration note if the launch build cares about pre-round-2 saves.
4. `hqline` is a game shuttle line, not a real metro line — keep its name
   ("华强北商圈线（电子街专线）") so players don't mistake it for a real line.
