# ROUND-3 LOG — Agent H：房子槽位 7→14 + 蝴蝶/食堂 3D 光柱点（2026-11-11）

分支：`feature/round-2` @ 4bc5307b，本地副本 `~/workspace/shenhui-life-sim/`（无 git，只改本地，未推远端，未碰浏览器，未启动服务器，未跑 vite build）。
任务依据：ROUND3-LOG-int.md §六（盖房尾巴）、§七（家里宠物锚点）、§十一第 1、4 条；ROUND3-LOG-B.md §5（盖房 14 个 id 表、剩余限制）；ROUND3-LOG-A.md §13（蝴蝶/食堂 snippet S2/S3、talk 条目 id）；ROUND3-LOG-D.md §一 D1（office ROAM_SPOTS 写法、选点路子）。

**改了的文件（仅 2 个）：** `client/src/round2/house.ts`、`client/src/LifeStage.tsx`
**没改的文件：** `App.tsx`（只出 snippet，见 §四）、`server/*`、其它一切。`house.ts` 顶部注释里“7 个槽位”的旧说法已同步改成 14。

---

## 一、盖房槽位 7 → 14 ✅

### 改动 1：`client/src/round2/house.ts` — `HOUSE_FURN_SLOTS`（:254 起）

原 7 个槽位原样保留（顺序、坐标不动），末尾追加 7 个（索引 7–13）：

| slot | x | z | ry | 位置 |
|---|---|---|---|---|
| 7 | -0.6 | -2.7 | 0 | 后墙中 |
| 8 | 5.0 | -0.6 | -0.45 | 右墙边 |
| 9 | -5.4 | 0.6 | 0.45 | 左墙边 |
| 10 | 0.7 | -0.6 | 0 | 正中 |
| 11 | -5.6 | -2.6 | 0.2 | 左后墙边 |
| 12 | 5.5 | 1.8 | -0.6 | 右前角 |
| 13 | -3.9 | 2.0 | 0.6 | 左前中 |

另改了两处注释里的旧说法（:75–76、`houseLayoutToPlacedFurn` 上方 :282–283）：“7 FURN_SLOTS，第 8 件起丢弃”→“14 FURN_SLOTS，第 15 件起丢弃”。

### 改动 2：`client/src/LifeStage.tsx` — `FURN_SLOTS`（:200 起）

同一批 7 个槽位，顺序、x/z/ry 与 house.ts **逐一相同**，另加中文/英文名（App.tsx :7580 的槽位选择器按 `FURN_SLOTS.map` 渲染，会自动长到 14 个按钮）：

| slot | zh / en |
|---|---|
| 7 | 后墙中 / Back centre |
| 8 | 右墙边 / Right wall |
| 9 | 左墙边 / Left wall |
| 10 | 正中 / Centre |
| 11 | 左后墙边 / Far back left |
| 12 | 右前角 / Front-right corner |
| 13 | 左前中 / Front left centre |

### 新槽位选点依据（照 D1 的路子，对照 flat 布景选）

flat 布景在 `LifeStage.tsx:1372` 起（四档户型共用同一套槽位），对照的固定物：

- 房间：后墙 z=-3.75、侧墙 x=±7.2、地板 22×14（x ±11、z ±7），所以 z=2.0 的槽位仍在地板上。
- 门：tr1 合租单间在侧墙的门板 (-6.4, 1.2, -1.2)；新槽位离它最近的是 slot 11 (-5.6, -2.6)，约 1.6，且 z 差 1.4，不挡门洞。
- 内置沙发/床：tr0 上下铺 (-3.5, -2.45)、tr1 单人床 (-3.6, -2.9)、tr2 沙发 (-2.6, -2.6，x -4.1…-1.1)、tr3 L 型沙发 (-3.0, -1.6) 及扶手 (-5.55, -0.95，x -6.1…-5.0、z -2.15…0.25)。新槽位中心均避开这些 footprint：slot 7 (-0.6, -2.7) 在 tr2 沙发右端 (-1.1) 之外；slot 9 (-5.4, 0.6) 在 tr3 扶手 z 范围 (≤0.25) 之外；slot 11 (-5.6, -2.6) 在 tr3 扶手 z 范围之外、tr1 床 x 范围 (-4.75…-2.45) 之外。
- ROAM_SPOTS.flat（:75）：bed (-2.4, -0.85)、sit (0.2, 0.55)、cook (3.1, -0.15)、wash (4.5, 1.05)——新槽位离它们最近的是 slot 10 到 sit 点 1.25、slot 12 到 wash 点 1.25。
- 玩家出生点 (0.15, 1.15)（LifeStage.tsx:2857 `nav` 初始值）：新槽位离它最近的是 slot 13，约 4.1；slot 10 离它 2.02。
- 家里宠物落点 (-3.6, -2.7)（LifeStage.tsx:2724，int §七）：新槽位离它最近的是 slot 11，2.0。
- 槽位之间：新槽位离任一旧槽位最近 1.84（slot 13 到 slot 5），其余 ≥ 1.9；先例是旧槽位 3–4 之间只有 1.82，所以 1.84 不低于既有标准。家具之间没有碰撞体积（`clampWalk` 只限边界），1.84 的间距与既有布局一致。

### 校验（一次性脚本，已删）

`/tmp/house14-check.mts`（`npx tsx`，跑完已删）：14 件 ZhuyaHome 家具（`HOUSE_FURN_CATALOG` 全表）摆进一个布局再转 publish payload：

```
slots=14 catalog=14
14-piece: placed=14 dropped=0 []
placed slots: 0,1,2,3,4,5,6,7,8,9,10,11,12,13
15-piece: placed=14 dropped=1 [{"furnId":"sofa-fabric","reason":"no-free-slot"}]
LifeStage slots=14
slot coordinate mismatches: 0
PASS
```

即：14 件全摆、0 丢弃；第 15 件仍以 `no-free-slot` 丢弃（符合设计）；`HOUSE_FURN_SLOTS` 与 LifeStage `FURN_SLOTS` 的 14 个坐标逐一相同（x/z/ry 全等）。

### 客户端这一半已闭环，服务端那一半不在我手里

- App.tsx 侧除 snippet 外**无需再改**：`placedFurn()`（App.tsx:497–506）按 `FURN_SLOTS.findIndex` 找空槽，没有 slot ≤ 6 检查，FURN_SLOTS 长到 14 就自动支持 14 件；家具槽位选择器（App.tsx:7580）按 `FURN_SLOTS.map` 渲染，也自动长到 14 个按钮；`publishHome()`（:3512）直接发 `placedFurn()` 的结果。
- 服务端仍是天花板（另一个 agent 在改）：`server/src/actions.ts:1530` 的 `publishHome` schema 目前是 `slot: min(0).max(6)` 且布局 `.max(8)`——客户端发 slot 7–13 会被服务端 schema 拒绝，直到那边改成 0–13 / 最多 14 件。见 §四 snippet 的前提说明。

---

## 二、蝴蝶 / 食堂的 3D 光柱点 ✅（只加两个点，已有点和布景一字未动）

### 改动 3：`client/src/LifeStage.tsx:85` — `ROAM_SPOTS.park` 加 butterfly

```ts
{ id: "butterfly", emoji: "🦋", zh: "在蝴蝶谷站一会儿", en: "Stand in Butterfly Valley", x: -4.2, z: -0.9 }
```

- id 必须 exactly 是 `"butterfly"`：与 App.tsx:218 `QINGQING_TALK` 的条目 id 一致（A 日志 S2，int 已落地）。
- 选点依据（对照 park 布景 `LifeStage.tsx:2301` 起，照 D1 的路子）：坐标 (-4.2, -0.9) 落在花丛里——12 朵花（:2316，x -5…5、z -1.3…-0.6，即蝴蝶谷花丛）；离最近的树 (-4.4, -2.5) 1.61、灌木 (-2.2, -1.5) 2.09、池塘中心 (-4.1, 1.9) 2.8（池塘半径 1.7，点在池外）、路灯 (-1.9, -1.2) 2.32、长椅 (2.4, -0.95) 6.6；离已有三点 bench (2.2, 0.15) / stroll (-2.2, 0.65) / photo (0.2, 1.1) 最近 2.53；离出生点 (0.15, 1.15) 约 4.8；在 `clampWalk`（x ±5.6、z -1.15…2.15，LifeStage.tsx:2861）内。

### 改动 4：`client/src/LifeStage.tsx:104` — `ROAM_SPOTS.factory` 加 canteen

```ts
{ id: "canteen", emoji: "🍱", zh: "在食堂吃一顿", en: "Eat in the canteen", x: 4.2, z: 1.2 }
```

- id 必须 exactly 是 `"canteen"`：与 App.tsx:172 `VENUE_TALK.factory` 的 canteen 条目 id 一致（A 日志 S3，int 已落地）。
- 选点依据（对照 factory 布景 `LifeStage.tsx:1895` 起）：工厂布景里**没有食堂道具**（只有产线传送带 z=-1.9、4 台机器、两个储罐、班长 (-1.4, -0.6) 与工头 (2.2, 0.4) 两个人偶），所以“食堂区域”只能是前场右侧空地——任务要求只加两个点、不改布景，我没有凭空加食堂桌椅。坐标 (4.2, 1.2)：离产线 (z -1.9) 3.1、离最近的工人（工头 2.2, 0.4）2.15、离已有两点 tour (0.15, -0.2) / ask (-2.6, 0.85) 最近 4.29、离出生点 (0.15, 1.15) 约 4.05；在 `clampWalk` 内。

### 静态核对：新点点下去能走到对应对话（无浏览器，沿代码链核对）

1. 光柱点渲染：LifeStage.tsx:2864 起按 `ROAM_SPOTS[setKind]` 生成 pin（emoji 精灵 + 金色光环 + 光柱），点 pin 或走近后按 E/空格都调 `propsRef.current.onSpot?.(id)`，id 即 spot 的 id。
2. App.tsx:7492  venue 3D 的 `onSpot={(id) => { const v = venueTalksFor(venue3d.set, venue3d.id).find((t) => t.id === id); if (v) runVenueTalk(v); }}`——按 talk id 查，不是按按钮。
3. 蝴蝶：青青世界进场时 `venue3d.id = selLoc.id`（App.tsx:6298 / :6782 设 `id: selLoc.id`），`venue3d.set = "park"`（`VENUE_SET_ALIAS` nature→park，App.tsx:228）。`venueTalksFor("park", "qingqing")`（App.tsx:220–221）返回 `VENUE_TALK.park` + `QINGQING_TALK`，其中 id `"butterfly"` 在 App.tsx:218 → 找到 → `runVenueTalk`（mood +10，一日一次走 `venueFx` 通用路径）。下方按钮列表（App.tsx:7502）同样用 `venueTalksFor`，点与按钮是同一条 talk。
4. 食堂：工厂进场 `venue3d.set = "factory"`，`venueTalksFor("factory", <locId>)` 返回 `VENUE_TALK.factory`（locId 不是 qingqing，不加 QINGQING_TALK），其中 id `"canteen"` 在 App.tsx:172 → 找到 → `runVenueTalk`（money -12 / mood +4 / energy +10 / hunger 28）。
5. 两处 talk 的 pose：butterfly `idle`、canteen `eat`，LifeStage 已有对应 pose 分支，无需新增。

### 已知局限（不是 bug，是 ROAM_SPOTS.park 共用的结构性后果）

- **butterfly 点会出现在全城所有公园**：`ROAM_SPOTS.park` 是所有 park 场景共用的（A 日志 S2 特意不把 butterfly 加进 `VENUE_TALK.park`，就是怕全城公园都有蝴蝶；但光柱点这一层没有按地点区分的机制）。只有青青世界（locId `"qingqing"`）能在 `venueTalksFor` 里查到 butterfly 对话；其它公园点这个 pin 时 `v` 为 undefined，什么都不发生（死 pin）。要彻底修，需要 LifeStage 的 park pin 按地点 id 过滤（即 `ROAM_SPOTS` 加 locId 条件或 App 传一个“本场馆可用 pin”列表），那是超出本次任务的改动，留给 parent 定夺。
- **canteen 点没有食堂布景可站**：工厂场景里没有食堂桌椅/窗口，点在前场空地上。想让它“像食堂”需要在 factory 布景里加一角餐桌/取餐台，那也是布景改动，不在本次“只加两个点”的范围内。
- 两个点都没有改已有点的坐标和布景。

---

## 三、验证

- `cd ~/workspace/shenhui-life-sim/standalone && npm run typecheck`（`tsc --noEmit -p tsconfig.json`）：**0 错误**。
- 运行时抽查（§一）：14 件全摆、0 丢弃、两边槽位坐标 0 偏差，PASS（脚本已删）。
- 未跑 vite build（任务要求不跑）；未启动服务器；未做浏览器验证（本环境无浏览器任务；新光柱点的点击链路是静态核对，见 §二）。

---

## 四、App.tsx snippet（只写进本日志，未改 App.tsx）

### 锚点实测（B 日志说的 :3390 已过时）

- `spotsOf` 的 `slot <= 6` 检查实测在 **App.tsx:3508**（int 集成后行号后移；B 的 :3390 是集成前的行号）。全仓 grep 确认这是 App.tsx 里**唯一**一处 slot ≤ 6 检查。
- `placedFurn()` 在 App.tsx:497–506：**没有** slot 上限检查（按 `FURN_SLOTS.findIndex` 找空槽），FURN_SLOTS 扩到 14 后自动支持 14 件，**不用改**。
- 家具槽位选择器在 App.tsx:7580：按 `FURN_SLOTS.map` 渲染，自动长到 14 个按钮，**不用改**。

### Snippet — `spotsOf`（App.tsx:3508，整行替换）

```ts
const spotsOf = (layout: { id: string; slot: number }[]) => layout.flatMap((p) => { const f = furnById(p.id); return f && p.slot >= 0 && p.slot <= 13 ? [{ id: p.id, slot: p.slot, color: f.color }] : []; });
```

即只把 `p.slot <= 6` 改成 `p.slot <= 13`，其余一字不动。

- 影响：`spotsOf` 是看别人家（NPC 家 + 线上玩家家）的过滤器——`openVisit`（:3517 NPC 家、`getHome` 回包 :3521 线上玩家家）。不改它，别人家 slot 7–13 的家具在拜访时会被滤掉、看不见；自己家走 `placedFurn()`，不受它影响。
- 前提：服务端 `publishHome`（`server/src/actions.ts:1530`）目前仍是 `slot: min(0).max(6)` 且布局 `.max(8)`——**这个 snippet 单独落地也没用**，服务端不改的话 slot 7–13 的发布请求会被 schema 拒绝。必须和服务端 agent 的 0–13 / 最多 14 件改动一起上（两边都落地后，14 件发布→拜访可见才全通）。

---

## 五、没改成的事和原因

1. **App.tsx 一个字没改**：任务要求只出 snippet，`spotsOf` 的 ≤ 13 改动在 §四，待集成 agent 落地。
2. **服务端 `publishHome` 没改**：不在本次可改文件内（另一个 agent 在改）。在服务端改动前，14 件发布仍会被服务端 schema（slot ≤ 6、最多 8 件）拒绝——客户端这一半（槽位、转换、渲染、选择器）已全部就绪。
3. **butterfly 死 pin（其它公园）与 canteen 无食堂布景**：见 §二“已知局限”，都是超出“只加两个点”的结构性问题，需 parent 定夺是否另开任务。
4. **没跑 vite build、没启动服务器、没做浏览器验证**：按任务要求；光柱点点击链路只做了静态代码核对。
