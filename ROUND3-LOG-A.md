# ROUND-3 LOG — Agent A（数据 / 场地）— 2026-11-11

任务：审计报告缺口 7、12、13。只改本地，不推远端，不碰浏览器。
工作目录 `~/workspace/shenhui-life-sim/`（分支 feature/round-2 @ 4bc5307b，本地 API 拉取副本，无 git）。

## 改动总览（只改了 3 个文件）

| 文件 | 改动 |
|---|---|
| `client/src/data.ts` | VenueSetId 加 `"fishingport"`；xunliao 加 venueSet/animKind；taio venueSet 改 fishingport；红花湖骑行站 id 改名；打卡 locId 改名 |
| `client/src/round2/venues.ts` | VENUE_SET_COPY 加 fishingport；ANIM_BY_PLACE 加 xunliao pin |
| `client/src/places-hz.ts` | HZ_LOC_KM 键改名 |

没碰：App.tsx、LifeStage.tsx、MapView.tsx、server/*、drizzle/*、.env、standalone/dist/、ts-spaces、任何 .db。

---

## 7. 巽寮湾渔港 → fishingport（已改）

### 改了什么

- `client/src/data.ts:524-526` — `VenueSetId` 联合类型新增 `"fishingport"`（不加这行，`venueSet: "fishingport"` 编译不过；且 `venueSetFor` 查不到 copy 会返回 null）。
- `client/src/data.ts:657` — xunliao：`type` 保持 `"port"`，新增 `venueSet: "fishingport", animKind: "cruise"`。
  - `type` 不改的理由：`clock.ts:149 venueHours` 只对罗湖/深圳湾/福田/莲塘四个口岸限时，渔港不受影响、一直开放；NPC 阿海 `preferTypes` 含 `"port"` 且 `onlyLocIds` 含 `"xunliao"`（data.ts:257），改 type 会把他赶走；`venues.ts:176-177` 的 port→concourse 回退仍服务真正的口岸（szbayport、luohu、huanggangport、futianport、liantangport、wenjinduport、shatoujiaoport）。
  - `animKind: "cruise"` 的理由：`LifeKind` 里只有 cruise 是船（App.tsx:572）；App.tsx:3326-3328 `ANIM_TO_LIFE` 没有 cruise 键时回退为 `(animRaw as LifeKind)`，即直接播 cruise 场景，不再是 stroll。渔港 fun/checkin 动作对应“跟船出海”，cruise 是唯一合适的。
- `client/src/data.ts:712` — taio（大澳渔村）：`venueSet: "cruise"` → `"fishingport"`，**`animKind` 保持 `"cruise"` 不变**（venues.ts:37 `ANIM_BY_PLACE` 里 `taio: "cruise"` 也未动，已修好的动画没碰）。
- `client/src/round2/venues.ts:137` — `VENUE_SET_COPY` 新增：
  `fishingport: { set: "fishingport", zh: "渔港码头：渔船、渔网、刚上岸的海鲜，鱼贩在码头边叫卖", en: "The fishing port: boats, nets, the fresh catch, fish sellers calling out on the pier" }`
  （没有这一条，`venueSetFor` 在 `loc.venueSet` 分支查不到 copy 会返回 null，渔港仍无路可达——这是本缺口的关键卡点。）
- `client/src/round2/venues.ts:75` — `ANIM_BY_PLACE` 加 pin：`xunliao: "cruise"`（data.ts 的 `animKind` 优先，表里 pin 是双保险，保持“表是唯一事实来源”的约定）。

### fishingport 可达性追踪（沿代码链逐段核实）

1. **data.ts:657 / :712** — xunliao、taio 的 `venueSet` 现为 `"fishingport"`。
2. **venues.ts:143-151 `venueSetFor`** — per-place `venueSet` 优先：`VENUE_SET_COPY["fishingport"]` 存在 → 返回 `{ set: "fishingport", … }`（改前：copy 查不到 → 返回 `null`，即审计说的“无路可达”）。
3. **App.tsx:216-224 `venueFor`** — 调用 `venueSetFor`；`VENUE_SET_ALIAS`（:214）只有 cycle/gallery/nature/wetland 四项，没有 fishingport → set 原样为 `"fishingport"`，可直接作 `LifeSet`。
4. **App.tsx:4240 `actionsFor`** — `venueFor(loc)` 非空即推 `__venue3d`（“走进去 · 3D”）按钮。
5. **App.tsx:6019 / :6503** — 点击后 `setVenue3d({ set: "fishingport", id: selLoc.id, … })`。
6. **App.tsx:7213 `<LifeStage3D setKind={venue3d.set} …>`** — `LifeStage.tsx:1895-1918` 的 `fishingport` 分支渲染：码头、渔船、渔网、三筐刚上岸的鱼、阿海（`fishingport-ahai`）+ 鱼贩（`fishingport-seller`）两个人物；注释原文就是“巽寮湾渔港 / 大澳渔村”，场景本就是为这两处建的。`ROAM_SPOTS.fishingport`（LifeStage.tsx:107）已有 buy/boat 两个金色光柱点。
7. **App.tsx:200-203 `VENUE_TALK.fishingport`** — buy（买刚上岸的海鲜）/ boat（问渔民能不能跟船）两条对话早已存在；按钮列表（:7224）与 `onSpot`（:7213）都按 `VENUE_TALK[venue3d.set]` 查，`runVenueTalk`（:5536-）的 fun 加成列表含 `"boat"`、social 列表含 `"buy"`，无需改动。
8. **App.tsx:5528 `VENUE_PLACE.fishingport = "port"`** — `regularHere` 按 port 类型找常驻 NPC，阿海（onlyLocIds 含 xunliao）能正常出现；`MEET_IDS` 已含 `"boat"`、`"buy"`。
9. 未受影响的引用：`scenic.ts:51` xunliaosunset 的 `locIds: ["xunliao", …]`（日落场景，按 id 查，不动）；`experience.ts:291` 巽寮湾行程 `key: "xunliao"`（不动）；`bus-hz-coast` 海滨巴士站 `S("巽寮湾", 12.8, 13.9, "xunliao")`（不动）。

**结论：fishingport 场景现在对 xunliao 和 taio 均可达。** 唯一还没接的是渔港的地面动作（见 snippet S1）——走进去的 3D 内景和对话已通，地面动作仍是口岸那套，需集成 agent 落 snippet。

### Snippet S1 — App.tsx 渔港动作（给集成 agent，不要直接改是我写的规则）

- 文件：`client/src/App.tsx`
- 锚点：`case "port":`（App.tsx:4285-4301），在该 case 开头加分支，**原有口岸动作原样保留在分支之后**。xunliao 的 `type` 仍是 `"port"`，所以靠 `loc.venueSet === "fishingport"` 区分，而不是靠 id（以后再有渔港也能复用）。
- 全部复用已有 `doAction` handler，无需新 case：`gig`（用 `loc.gigName`“渔港帮工 / 海钓向导”）、`seafood-feast`（已有 handler，App.tsx:3050，¥80）、`mall-shop`（已有 handler，App.tsx:3160，¥120）、`stroll`、`rest`。

```ts
      case "port":
        if (loc.venueSet === "fishingport") {
          // Round-3: 渔港不是口岸 — 巽寮湾渔港（type 仍为 "port"，靠 venueSet 区分）
          return [
            { kind: "gig", title: loc.gigName ?? city.gigName, emoji: "🛵", desc: "渔港帮工、海钓向导，渔船回港时最忙", cost: `+${fmt(Math.round(base * 0.55))} 起 · 能量 -18`, disabled: s.energy < 18 },
            { kind: "seafood-feast", title: "渔港集市吃海鲜大餐", emoji: "🦐", desc: "现捞现称，隔壁大排档代加工", cost: `-${Y}80 · 能量 +20 · 心情 +15`, disabled: s.money < 80 },
            { kind: "mall-shop", title: "买刚上岸的海鲜", emoji: "🐟", desc: "鱼贩刚卸船的货，称好带回家", cost: `-${Y}120 · 心情 +14` },
            { kind: "stroll", title: "看渔船归港", emoji: "⛵", desc: "码头边看渔船一艘艘回来，渔网还滴着水", cost: "能量 -4 · 心情 +12 · 免费" },
            { kind: "rest", title: "在码头歇会儿", emoji: "🧋", desc: "坐着看海，等下一波渔船", cost: "能量 +14 · 心情 +8 · 免费" },
          ];
        }
        return [
          // ……以下原有口岸动作（gig / hk-trip / __gocity-hk / rest）原样不动……
```

- taio 不需要动作 snippet：它是 `type: "scenic"`，走 `case "scenic"`（fun/checkin/stroll），本来就对；只有走进去的内景从 cruise 换成 fishingport，本次已改。

---

## 12. 重复 id `"gym"`（已改）

### 新 id：`honghualake`

- 命名依据：周边惠州地点全是拼音/拼音+地貌（luofu、nankunshan、xiangtoushan、gaobangshan、dongjiangpark、hzbotanic、hejiang、danshui、dayawan、xiayong、xunliao、haiguiwan、sanjiaozhou、tanyue）；“红花湖”取 `honghua` + `lake`，比单用 `honghua` 更不易与别处重名，且与 `dongjiangpark`（拼音+park）同构。`honghualake` 在全仓此前 0 命中。
- 保留 `"gym"` 的是 data.ts:588 深圳社区健身房（`type: "gym"`，id 与 type 一致，无歧义）。

### 更新了的全部引用（全仓 grep `"gym"` / `'gym'` 逐条核对）

| 位置 | 改动 |
|---|---|
| `client/src/data.ts:641`（原 :638） | 地点本身：`{ id: "gym", type: "scenic", name: "红花湖骑行站", … }` → `id: "honghualake"`（其余字段不动：`venueSet: "cycle"`、`animKind: "cycle"` 不变，内景仍走 bikehub） |
| `client/src/data.ts:1116`（原 :1113） | `SCENIC_SPOTS` 打卡条目：`{ locId: "gym", cityKey: "hz", name: "红花湖", … }` → `locId: "honghualake"`（`scenicOf` 按 locId 匹配，打卡进度 `visitedScenic` 存 `hz:<locId>`，必须同步改） |
| `client/src/places-hz.ts:8` | `HZ_LOC_KM`：`"gym": [-1.94, 1.01]` → `"honghualake": [-1.94, 1.01]`（`data.ts:804 realKmOf` 对 hz 地点按 locId 查此表；该键只能是红花湖骑行站——深圳社区健身房不在 HZ_LOC_KM 这张惠州表里） |

### 核对后确认不用改的 `"gym"` 引用

- `client/src/routines.ts:414` — `coach: { where: ["gym"] }`：`where` 列表装的是**地点类型**（LocType），不是地点 id（同表 sales 的 `["mall", "electronics", "oilpainting"]`、chef 的 `["food", "market", …]` 皆为类型）。健身教练在任意 `type: "gym"` 处上班，不改。
- `client/src/activities.ts:48` `isSport`、`client/src/clock.ts:81` 动作耗时、`client/src/App.tsx:4347` `case "gym"` 动作、`App.tsx:572/723/1773/3186/3319/3922` LifeKind `"gym"`、`LifeStage.tsx:20/664/2014` LifeSet `"gym"`、`venues.ts:169` byType `gym`、`data.ts:502/519` 类型联合、`data.ts:250` NPC `preferTypes: ["learn", "gym"]`、`data.ts:765` stadium `type: "gym"`：全部是类型 / 动作 kind / 场景名，不是地点 id，不改。
- `client/src/experience.ts:632-633` 环湖行程 stops 用地点**名字** `"红花湖骑行站"`，名字没变，不改。`client/src/scenic.ts` 全文无 `"gym"` 引用（只有 `scenic.ts:51` 的 xunliao 日落，与本次无关）。`client/src/MapView.tsx` 全文无地点 id `"gym"` 引用。
- `client/src/i18n-en.ts:1166` `"红花湖骑行站": "Honghuahu Lake Cycling"`：按名字翻译的展示字符串，改名不影响它；但注意 **"Honghuahu" 疑似拼写错误**（应为 Honghua Lake），超出本次可改文件范围，留给集成 agent / parent 定夺。

### 重复检查

- 改后 `{ id: "gym"` 在 data.ts 中恰好出现 **1 次**（深圳社区健身房）；`{ id: "honghualake"` 出现 1 次。
- 全仓 `id: "…"` 计数里仍有多次出现的 id（metro ×4、home ×4、ktv ×3、food ×3、bank ×3）：那是 SZ / HZ / HK 三城各自同名地点（每城一套 metro/home/ktv/food/bank），round-2 之前就存在，与本次改动无关，未动。

### Snippet S4 — 老存档迁移（给集成 agent，sanitizeSave 在 App.tsx 里，我不能改）

- 文件：`client/src/App.tsx`，锚点 `sanitizeSave`（App.tsx:1953-2057）。
- 只有两个存档字段会存这个旧 id：`g.loc`（玩家当前地点）和 `visitedScenic`（存 `hz:<locId>`）。`venueFx` 的键是 `${day}:${LifeSet}:${talkId}`（与地点 id 无关），`apecCheckins` 只存峰会地点，`album` / `npcGigs` / `offers` 等不存地点 id——均无需迁移。
- `loc` 迁移（App.tsx:2048 行尾的三元链，照抄已有 `hq`→`qiaodong` / `work`→`work-hz` 的写法追加一节）：

```ts
loc: typeof g.loc === "string" && g.loc.length < 120 ? (g.cityKey === "hz" && g.loc === "hq" ? "qiaodong" : g.cityKey === "hz" && g.loc === "work" ? "work-hz" : g.cityKey === "hz" && g.loc === "gym" ? "honghualake" : g.loc) : undefined,
```

- `visitedScenic` 迁移（同一函数内约 App.tsx:2033 行，`visitedScenic: strArr(g.visitedScenic),` 改为）：

```ts
visitedScenic: strArr(g.visitedScenic).map((k) => (k === "hz:gym" ? "hz:honghualake" : k)),
```

- 不迁移的后果（可接受但有损）：老存档 `loc: "gym"` 在 hz 会找不到地点（回退逻辑处理），`visitedScenic` 里的 `hz:gym` 永远对不上新 id，红花湖打卡显示未打卡——丢一个打卡进度，不丢档。

---

## 13. 青青世界蝴蝶 + 工厂食堂（venues.ts 已有定义，缺的是 App.tsx 接线）

### venues.ts 里确认已存在，无需恢复

- `client/src/round2/venues.ts` 的 `VENUE_TALK.nature` 里有蝴蝶条目：`{ id: "butterfly", emoji: "🦋", zh: "在蝴蝶谷站一会儿", … mood: 10 }`。
- `client/src/round2/venues.ts` 的 `VENUE_TALK.factory` 里有两条：`line`（看产线）+ `canteen`（`{ id: "canteen", emoji: "🍱", zh: "在食堂吃一顿", … money: -12, mood: 4, energy: 10 }`）。
- 本次未改 venues.ts 的这两处（它们本就存在；改的是渔港那两处，见 §7）。

### 审计纠正核实：5 条是改名未丢，只有 butterfly 真丢

逐条对照 App.tsx 已落地的 `VENUE_TALK`（行号为当前 App.tsx）与 venues.ts 的原文：

| venues.ts 原文 | App.tsx 现状 | 结论 |
|---|---|---|
| oilpainting `copy`（看画家临摹） | oilpainting `paint`（看画家作画） | 改名未丢 |
| seafood `pick`（挑一只活海鲜） | seafood `buy`（挑点海鲜） | 改名未丢 |
| womensstreet `goldfish`（看金鱼档） | womensstreet `fish`（买条金鱼） | 改名未丢 |
| factory `line`（看一条产线） | factory `tour`（看看产线） | 改名未丢 |
| museum `look`（在展柜前站一会儿） | museum `exhibit`（慢慢看展） | 改名未丢 |
| nature `butterfly`（在蝴蝶谷站一会儿） | **App.tsx 无 `nature` 键**（nature→park 别名，park 只有 bench/stroll/photo，App.tsx:113-117） | **真丢** |
| factory `canteen`（在食堂吃一顿） | **App.tsx factory 只有 tour/ask**（App.tsx:166-169） | **真丢** |

本次只处理真丢的两条，不重复修那 5 条。

### Snippet S2 — 蝴蝶只给青青世界（给集成 agent）

- 文件：`client/src/App.tsx`。**不要**把 butterfly 加进 `VENUE_TALK.park`（App.tsx:113-117）——那样全城所有公园都有蝴蝶谷。
- 做法：加一个按地点 id 区分的 helper，放在 `VENUE_TALK` 定义之后、`venueFor`（App.tsx:216）附近；文案逐字抄 venues.ts 的 nature.butterfly 条目，保持两边一致。

```ts
/* Round-3: 青青世界专属 talk — venueSet nature 在 venueFor 里别名为 park，
   所以通用 park 只有 bench/stroll/photo；蝴蝶谷内容只按地点 id 挂给青青世界，
   别加到 park 上，否则全城公园都有蝴蝶。 */
const QINGQING_TALK: VenueTalk[] = [
  { id: "butterfly", emoji: "🦋", zh: "在蝴蝶谷站一会儿", en: "Stand a while in Butterfly Valley", who: "自己", whoEn: "You", say: "「蝴蝶落在肩膀上了。」", sayEn: "“A butterfly just landed on my shoulder.”", pose: "idle", mood: 10 },
];
const venueTalksFor = (set: LifeSet, locId?: string): VenueTalk[] =>
  locId === "qingqing" ? [...(VENUE_TALK[set] ?? []), ...QINGQING_TALK] : (VENUE_TALK[set] ?? []);
```

- 两处 lookup 改用 helper（锚点行号为当前 App.tsx）：
  - `onSpot`（约 :7213）：`const v = (VENUE_TALK[venue3d.set] ?? []).find((t) => t.id === id);` → `const v = venueTalksFor(venue3d.set, venue3d.id).find((t) => t.id === id);`
  - 按钮列表（约 :7224）：`{(VENUE_TALK[venue3d.set] ?? []).map((v) => {` → `{venueTalksFor(venue3d.set, venue3d.id).map((v) => {`
- 说明：`venue3d.id` 就是地点 id（App.tsx:6019 / :6503 设 `venue3d` 时取 `selLoc.id`），青青世界 id 为 `"qingqing"`（data.ts:616）。`runVenueTalk` 的 mood 加成走通用路径（venueFx 一日一次），`butterfly` 不在 fun 加成 id 列表里，无需改 `runVenueTalk`。

### Snippet S3 — 工厂食堂（给集成 agent）

- 文件：`client/src/App.tsx`，锚点 `VENUE_TALK.factory`（App.tsx:166-169，现有 tour/ask 两条），在 `ask` 条目后追加：

```ts
    { id: "canteen", emoji: "🍱", zh: "在食堂吃一顿", en: "Eat in the canteen", who: "自己", whoEn: "You", say: "「大锅饭，管饱。」", sayEn: "“Canteen food. Filling.”", pose: "eat", money: -12, mood: 4, energy: 10, hunger: 28 },
```

- 与 venues.ts 原文的唯一差别：补了 `hunger: 28`（venues.ts 的 canteen 条目没有 hunger 字段；App.tsx 里同类吃饭 talk 如 seafood 的 `eat` 条目带 `hunger: 28`，且 `runVenueTalk` 会读 `v.hunger` 加饱腹——不加也行，吃了等于没吃饱；集成 agent 若求与 venues.ts 逐字一致可删掉 `hunger: 28`）。
- 说明：`LifeStage.tsx:99 ROAM_SPOTS.factory` 只有 tour/ask 两个金色光柱点，没有 canteen 点——canteen 仍会作为按钮出现在 3D 视图下方的对话列表里（按钮列表与光柱点是两套入口，见 App.tsx:7224）。要不要给食堂加 3D 光柱点是 (g) 的后续可选工作，不是本 snippet 的一部分。蝴蝶同理：`ROAM_SPOTS.park`（LifeStage.tsx:80）只有 bench/stroll/photo，butterfly 只作为按钮出现。

---

## 验证

- `cd ~/workspace/shenhui-life-sim/standalone && npm run typecheck`（`tsc --noEmit -p tsconfig.json`）：**0 errors**，干净通过。
- 未跑 `vite build`（任务要求不跑）；未启动服务器；未做浏览器验证（本 subagent 无浏览器）。
- grep 复核：`"gym"` 剩余命中全部是类型 / LifeKind / LifeSet / 动作 kind，无一处是地点 id；`"honghualake"` 全仓恰好 3 处（地点、打卡、HZ_LOC_KM）；`"fishingport"` 在 data.ts（类型 + 两处地点）与 venues.ts（copy）均已就位；`fishingport` 在 App.tsx / LifeStage.tsx 的既有引用（VENUE_TALK、VENUE_PLACE、LifeSet、ROAM_SPOTS、3D 场景）未动——它们本来就是等着被接通的。

## 没做成的事 / 留给集成 agent 的事

1. **4 个 App.tsx snippet 待落地**：S1 渔港动作、S2 蝴蝶（青青世界专属）、S3 工厂食堂、S4 存档迁移（`loc` + `visitedScenic`）。都在本日志里，含锚点行号与完整代码。
2. **浏览器验证未做**：fishingport 场景可达性是沿代码链静态追踪确认的（§7 的 9 步），没有在真机/浏览器里点开“走进去”验证——需 parent 安排浏览器验证。
3. **i18n-en 拼写**：`client/src/i18n-en.ts:1166` `"红花湖骑行站": "Honghuahu Lake Cycling"` 疑似拼写错误，应为 "Honghua Lake"；i18n-en 不在本次可改文件内，未动。
4. **蝴蝶 / 食堂的 3D 光柱点**：LifeStage 的 ROAM_SPOTS 里 park 只有 bench/stroll/photo、factory 只有 tour/ask，两条新 talk 目前只会以按钮形式出现；要金色光柱互动点需 (g) 在 LifeStage 加 spot（不在本次任务内，未做）。
5. **taio 的地面动作**：大澳是 `type: "scenic"`，走通用 scenic 动作（fun/checkin/stroll），本次认为已够用，未另写 snippet；如 lee 想要大澳专属动作（咸鱼/虾酱/坐艇），可再补。
