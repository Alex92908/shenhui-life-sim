# ROUND-3 LOG — 集成 Agent int（2026-11-11）

只改本地，不推远端，不碰浏览器。分支 feature/round-2 @ 4bc5307b（本地 API 拉取副本，无 git）。
任务：把 S / A / B / C / D / E 六份日志的全部 snippet 落地 + 缺口 1+2 客户端接线 + 全量验证 + 服务器留在运行状态。
ROUND2-CHANGELOG.md 里没有独立的“集成”章节（只有 Wave 1 DONE 记录），无可对的集成说明。

## 改了哪些文件（仅 7 个）

| 文件 | 改动 |
|---|---|
| `client/src/App.tsx` | 全部 A–E snippet + C 地图接线 + 缺口 1+2 客户端接线 |
| `client/src/LifeStage.tsx` | C 家里宠物（追加）+ B 盖房预览配色；D 的新增内容未动 |
| `client/src/MiniGame.tsx` | B 麻将 onPush 回调 |
| `client/src/Livehouse.tsx` | E 打赏 UI + 收入区（新 prop `playerId`） |
| `client/src/round2/police.ts` | 缺口 2：本机内存 Map → 5 个服务端端点 |
| `client/src/round2/economy.ts` | 缺口 1：TradeTask 加纠纷字段 |
| `ROUND3-LOG-int.md` | 本日志 |

没碰：data.ts、MapView.tsx、server/*、drizzle/*、.env、standalone/dist/（构建产物是 `npm run build` 自己生成的）、~/workspace/ts-spaces/、任何 .db 文件（除新建的测试库，见验证）。

## 一、A 的 4 个 snippet（全部落地）

- S1 渔港动作：App.tsx:4406，`case "port"` 开头按 `loc.venueSet === "fishingport"` 分支（gig / seafood-feast / mall-shop / stroll / rest），原口岸动作原样保留。核实过 `seafood-feast`（:3126）与 `mall-shop`（:3236）两个 handler 均已存在。
- S2 蝴蝶只给青青世界：QINGQING_TALK + `venueTalksFor` 在 App.tsx:217–221；两处 lookup 改用 helper——onSpot :7492、按钮列表 :7502。未动 `VENUE_TALK.park`。
- S3 工厂食堂：`VENUE_TALK.factory` 加 canteen 条目（money -12 / mood +4 / energy +10 / hunger 28，照 snippet 含 hunger）。
- S4 存档迁移：sanitizeSave 内 `visitedScenic` :2133（`hz:gym` → `hz:honghualake`）、`loc` 三元链 :2164（追加 `hz` + `gym` → `honghualake` 一节）。

## 二、B 的 snippet（全部落地）

- import：App.tsx:44 补 `markUnemployed, markEmployed`。
- markUnemployed：剧情 handler :7863，`arc.id === "layoff" && (c.flag === "sign" || c.flag === "fight")` 时调用。
- markEmployed（配套，否则失业时钟不清零）：`case "join-company"` :3134，`s.mood += 8;` 之后清零。
- 麻将接线：
  - MiniGame.tsx:21  props 加可选 `onPush`，:41 传给 Meter，Meter.push() 里 `onPush?.()`（MiniGame.tsx 另见下文偏差）。
  - App.tsx:7636 渲染点只在 `play.act.id === "mahjong"` 时传 `() => sfx("mahjong")`；startActivity 开局、finishActivity 结算各敲一声（`sfx("mahjong")`，App.tsx 均在 `setPlay` 之后）。
- 偏差：B 的 snippet 1 让 MiniGame.tsx 顶部加 `import { sfx } from "./sound"`，但该 import 在 MiniGame 内无任何使用点（音效走 onPush 回调），会触发 TS6133——没加这行，typecheck 0 错误。

## 三、C 的地图接线（落地）

- App.tsx:1420 `communityMarkers = useMemo(() => toMapMarkers({ strays, notices, snakes, fishingSpots, cityKey }), …)`，数据来自已有的四个 query（:1340–1343）。
- MapView props（App.tsx:6126）：`communityMarkers={communityMarkers}`、`activePet={getActivePet(pets)}`、`onCommunityMarkerClick`——按 `m.kind` 打开已有详情面板：四类都在手机 social 面板（App.tsx:4960 起的 `case "social"`，流浪动物 / 招领 / 蛇警告 / 钓点都在其中），所以统一 `setPhoneApp("social"); setPhoneOpen(true)` 并 toast 显示图钉 label。未另建面板。
- `getActivePet` 已补进 App.tsx:40 的 pets import。

## 四、D 的 S1–S5（必须一起上，全部落地）

- S1a LifeKind 加 10 成员：App.tsx:580（`tram | temple | oldtown | miniature | farm | watershow | cycle | gallery | nature | wetland`）。
- S1b LIFE_SCENES 加 10 条：App.tsx:577 起，gathering 条目之后（逐字照 D 的文案）。
- S2 lifeStageFor 加 10 个 case：App.tsx:800 起（cablecar 之后；tram/temple/miniature/farm/watershow/cycle/gallery 全 idle，oldtown/nature idx 0 walk，wetland idx 0 walk / idx 1 stretch）。
- S3 ANIM_TO_LIFE 改恒等映射：App.tsx:3444；同时删掉了上方已过时的旧注释（"are not LifeKinds yet — they fall back…"，与新映射矛盾）。
- S4 CUTSCENE_ROAM 加 `code: "office", overtime: "office"`：App.tsx:1886–1889。
- S5 VENUE_TALK.office 补 code/leave 对话：App.tsx:81–88 之后（toilet 条目后）。

## 五、E 的 4 个 snippet（全部落地）

- import：App.tsx:45 补 `mergeSponsoredMenu, groupOrderTotals, mergeGroupItems, groupOrderShareText, WEEKLY_QUESTS, weeklyQuestState, grantWeeklyCoupon` 及 `SponsoredRestaurant / GroupOrderView / GroupOrderItem / WeeklyQuestProgress` 类型。
- 片段 1 赞助：App.tsx:4824 `mergeSponsoredMenu(deliveryMenu(…), sponsors)`；餐厅卡片加「赞助」徽章；`sponsors` state + 拉取 effect 在 App.tsx:1442–1446（顶层 effect，见下文偏差）。
- 片段 2 打赏：Livehouse.tsx 正在播放区加 ¥10/30/88 打赏按钮（`TIP_AMOUNTS`），`tipSent` 在 `cur.id` 变时重置；App.tsx:7465 左右给 LivehouseModal 传 `playerId={profile?.playerId ?? ""}`；音乐人收入区（`getLivehouseTips` 的 mine + totalEarned）放在“我是音乐人”区下方；轮播“接下来”列表每首歌后显示“已收到打赏 ¥X”（`totals`）。
- 片段 3 拼单：外卖页 App.tsx:4836 起 `startGroup / joinGroup / lockAndOrder / leaveGroup`，拼单卡片（成员 + 各人菜品 + `groupOrderTotals` 平摊 + 复制暗号 + 发起人锁定合单）；进外卖页时若 `d.activeGroup` 有值，顶层 effect 恢复 group 卡片；合单走现有 `submitDeliveryOrder(mergeGroupItems(…))`，再 `completeGroupOrder`。
- 片段 4 每周任务：外卖页任务卡（`WEEKLY_QUESTS` + `weeklyQuestState` + 领奖按钮）；`claimQuest`（券走 `grantWeeklyCoupon`，¥ 由 server 直接入账）；进度上报接在 `submitDeliveryOrder` 成功后（`reportDeliveryQuest` event "order"，上报后刷新任务卡）。
- 偏差 1：E 的片段 1/4 写 `useEffect` 在 App.tsx:4694 / 外卖页内——那是 `renderPhoneApp` 函数体（条件调用），hooks 不能放里面。改为组件顶层 effect（App.tsx:1438–1445，随 `cityKey / phase / profile` 拉赞助 + 任务；另有 `phoneApp === "food"` 时恢复拼单的 effect）。
- 偏差 2：服务端 `getGroupOrder` 回的 group 里 `city` 是 string（GROUP_ORDER_VIEW 未收窄），与客户端 `GroupOrderView.city: CityKey` 不兼容——3 处 `setGroup(g.group)` 改为 `setGroup(g.group as unknown as GroupOrderView)`（App.tsx:1452 / :4846 / :4858）。
- 未落：rate-5 任务的进度上报——E 的片段 4 说“好评后（rateRestaurant 调用的地方）”，但 `rateRestaurant`（delivery.ts:999）在 App.tsx 里从未被调用，App 没有评分 UI。order / spend-100 / try-new 三项随下单上报正常；rate-5 目前无触发点（见“没做成的事”）。

## 六、B 的盖房尾巴（处理一半）

- 预览配色已改：LifeStage.tsx:2096 `BUILDPLOT_COLORS`，14 件 ZhuyaHome 家具按 data.ts 目录色画（sofa-fabric 0x93b8a4、sofa-leather 0x8a5a3b、sofa-tatami 0xd9c39a、table-oak 0xb08954、table-marble 0xf1f5f9、tv-cabinet 0x8a6f4d、bed-double 0xa9835a、wardrobe 0xb08954、desk 0x6b7280、fridge 0xd7dde3、kitchen-cabinet 0x9db4a0、dining-table 0xb08954、washer 0xe5e7eb、bathtub 0xf1f5f9），未知 id 仍回退灰盒子 0x78716c。
- 槽位没加：flat 只有 7 个槽位，第 8 件起仍 `no-free-slot` 丢弃。加槽位要同时改 LifeStage `FURN_SLOTS`、house.ts `HOUSE_FURN_SLOTS`、App `placedFurn`/`spotsOf` 的 slot ≤ 6 检查，更关键的是服务端 `publishHome`（server/src/actions.ts:1362）只认 slot 0–6、最多 8 件——server 不在本任务可改范围内，客户端单方面加槽位会被服务端拒绝。所以 7 件天花板保留，未硬上。

## 七、LifeStage 家里宠物（C 第四节，追加，D 的内容未动）

- Props：LifeStage.tsx:57 `homePet?: Pet | null`（`import { PET_MODEL, type Pet } from "./round2/pets"`，pets.ts 无任何 import，无循环导入风险）。
- `makePetGroup` + `PetParts` 照抄进 LifeStage.tsx:242（C 的选项 b；未抽共享模块、不改 MapView 导出）。唯一改动：徽章用 LifeStage 已有的 `faceSprite(spec.emoji)`（MapView 的 `emojiSprite(emoji, color)` 这里没有），scale 覆为 0.9。
- 渲染：LifeStage.tsx:2724，actor 建好后（`scene.add(actor.g)` 之后），`setKind === "flat" && homePet` 时放在 (-3.6, 0, -2.7)、`rotation.y = Math.PI` 面朝门口，body 坐姿 -0.5，`bobbers.push` 呼吸起伏。
- App 家渲染处：App.tsx:7563 `homePet={getActivePet(pets)}`。
- D 的新增内容（office ROAM_SPOTS、watershow 落点）未动。

## 八、缺口 1+2 的客户端接线

### 缺口 2：police.ts（client/src/round2/police.ts，整段替换内存实现）

- 删掉本机 `patrol` 变量 + `watchers` Map + 同步的 `patrolState / isWatched / observationsBy`。`isGameAvatarId`、`WATCH_INDICATOR`、`PoliceReportPayload`、`toBlackReportArgs` 保留；`buildPoliceReport` 改为接受显式 `observations` 数组参数（原先读本地 Map；无调用方，签名可安全改）。
- 5 个函数全部改为 async、走类型化 `api` 客户端（server 端点已在 actions.ts，无需改 api.ts——`api` 的类型直接来自 server Actions）：
  - `startPatrol(playerId, city)` → `api.startPatrol`
  - `stopPatrol(playerId)` → `api.stopPatrol`（server 同时删观察记录）
  - `observe(playerId, targetId, note?)` → `api.observe`（本地先验 slug/不能看自己；其余校验在 server）
  - `stopObserving(playerId, targetId)` → `api.stopObserving`
  - `getWatchers(playerId)` → `api.getWatchers`，返回 server 的 `{ officerId, officerName, officerEmoji, note, city, startedAt }`（ISO 字符串；本地 `WatchRecord.startedAt` 由 number 改为 string）。
- App 接线：
  - import：App.tsx:47 改为 `{ startPatrol, stopPatrol, observe, stopObserving, getWatchers, isGameAvatarId }`。
  - `watchersQuery`（App.tsx:1431）：`getWatchers(profile.playerId)`，60 秒轮询——被监视的玩家看到 👁️ + 监视者名字/备注（App.tsx:5346）。
  - 巡逻面板（App.tsx:5344 起）：开始/结束巡逻改为 async 调 server，文案“本轮只在本地生效”改为“全服可见：你盯的人会看到 👁️”；在线玩家列表的“盯着”按钮改为切换式——已盯的显示“取消盯着”调 `stopObserving`（`observedIds` state，App.tsx:1432，结束巡逻时清空）；地点巡逻记录按钮（:6314 附近）改为 async `observe(profile.playerId, selLoc.id)`。
  - 注意：server `observe` 对 NPC slug 只按 slug 规则放行（S 日志已知限制）；地点 id 同样按 slug 放行，与 round-2 本地行为一致。

### 缺口 1：纠纷 UI（economy.ts + App.tsx）

- economy.ts：`TradeTask` 加可选字段 `disputeReason?`、`disputeVerdict?: "seller" | "buyer" | "expired"`、`disputeDueAt?: string`（与 server `tradeTaskShape` 同名同形）。
- App 查询（App.tsx:1434–1435）：
  - `myTradeQuery`：`api.getMyTradeTasks`——我作为贴主/接单人的单（含 disputed + 已结案 verdict）。
  - `disputedTradeQuery`：`api.getTradeTasks({ openOnly: false, limit: 50 })`，60 秒轮询，客户端过滤 `status === "disputed"`——陪审团入口。注意：原 `tradeQuery` 用 `openOnly: true`，disputed 的单不会出现在交易板上，所以必须另查。
- 交易板 UI（App.tsx:5129 起，“⚖️ 交易纠纷 · 陪审团”）：
  - 我的纠纷：`myDisputes`（disputed 或已有 verdict），显示申诉理由、冻结金额、`disputeDueAt` 倒计时（“还剩约 X 小时 Y 分”/“投票已截止，可以结算”）、结案文案；disputed 时有“结算这单”按钮。
  - 待陪审：`juryDisputes`（排除当事人——当事人不能投票是 server 校验，UI 上直接不列自己的单），每单“判给卖方（放款）/ 判给买方（退款）/ 结算”三个按钮。
  - `tradeVote`（:5058）：`api.tradeDisputeVote`，toast 显示当前票数（卖方 X : 买方 Y，满 3 票多数获胜）；`tradeAdjudicate`（:5065）：`api.adjudicateTradeDispute`，成功后按 verdict + `releasedAmount` / `refunded` 展示（“陪审团判卖方胜，托管的 ¥X 已放给 Y”/“判买方胜……已退回付款人”/“没凑够票 / 打平……已退回付款人”），结果存 `disputeResult` state 在卡片上展示；未到期时 server 返回“陪审团还在投票，24 小时后再来结算。”，直接 toast。
  - `tradeDispute` 的 toast 文案同步改了（“等双方协商或管理员处理”→“24 小时内同城陪审团投票决定归属”），并 refetch 三个 query。
  - 结算无自动定时器：与 S 的说明一致，客户端不另起定时器——到期纠纷在下次读板/投票/裁决时由 server 结算（`disputedTradeQuery` 60 秒轮询会触发 `getTradeTasks` 里的 `settleTradeDisputes`）。

## 九、TS6133 清理

- 基线 typecheck（改动前）已是 0 错误：D 报的 MapView 7 个 + actions.ts 2 个未使用声明已被 C 在改完后清掉（C 日志称清了一个未读 ref 后 0 错误），本次无需再删。
- 本次集成引入的 2 个未使用 import 已随 typecheck 修复删掉（`CommunityMapMarker`、`TIP_AMOUNTS`——后者只在 Livehouse.tsx 用，App.tsx 不需要）；另修 3 处 `GroupOrderView` 类型不兼容（见 §五偏差 2）。
- 最终全量 typecheck 0 错误。server/src/actions.ts 未动。

## 十、验证结果（全部通过）

1. typecheck：`cd standalone && npm run typecheck`（`tsc --noEmit -p tsconfig.json`）——**0 错误**（中途修掉 5 个：2 个未用 import + 3 处 GroupOrderView cast，见 §九）。
2. vite build：`cd standalone && npm run build`——**成功，8.29s**（`index-*.js` 1,950.18 kB，gzip 726.81 kB）。
3. 服务器（全新测试库，旧库未动）：
   - 启动：`cd standalone && DB_PATH=/home/hatch/workspace/shenhui-life-sim/.local-test/app-round3.db PORT=8787 HOST=127.0.0.1 ADMIN_TOKEN=test-admin-token-1234 DEV_LOGIN_CODES=1 DEV_PAYMENTS=0 WEATHER=off npx tsx server.ts`（后台运行，**留在运行状态，未停**）。
   - 日志：0001–0020 全部应用成功，含 `[db] applied 0020_round3_server.sql`。
   - `curl http://127.0.0.1:8787/` → **HTTP 200**，标题 `<title>湾区人生</title>`。
   - 只读核查新库：`trade_dispute_votes` / `patrols` / `patrol_watches` / `livehouse_tips` / `group_orders` / `group_order_members` / `delivery_quests` 7 张表全部存在；`trade_tasks` 含 `disputed_at / dispute_from_status / dispute_verdict / dispute_settled_at`（+ 原有的 `dispute_reason`）。
   - 未做浏览器验证（本环境无浏览器任务；round-2 已知云端浏览器拒绝本地地址，需 lee 的 Mac 或浏览器接管实测）。

## 十一、没做成的事和原因

1. **盖房槽位仍是 7 个**：第 8 件家具起仍 `no-free-slot` 丢弃。服务端 `publishHome` 只认 slot 0–6、最多 8 件，server 不在本任务可改范围，客户端单方面加槽位会被拒绝。预览配色已修（§六）。
2. **每周任务 rate-5 无触发点**：`rateRestaurant` 在 App.tsx 里从未被调用，没有评分 UI，所以 `reportDeliveryQuest({ event: "rate", stars: 5 })` 无处可接；order / try-new / spend-100 三项已接。需要先在外卖页加“吃完打分”入口。
3. **拼单不托管钱**：与 E 的设计一致——各人那份仍是客户端算，server 只存组成；发起人合单时整单由发起人先付，`groupOrderTotals` 只算数不转账。真分账要另加 escrow + 结算端点。
4. **蝴蝶 / 食堂的 3D 光柱点未加**：`ROAM_SPOTS.park` 只有 bench/stroll/photo、`ROAM_SPOTS.factory` 只有 tour/ask，两条新 talk 目前只以按钮形式出现（A 日志已说明是后续可选工作）。
5. **打赏用 ¥ 不用 ✨**：按 E 的任务要求走 `ledger/writeLedger`（¥ 账本）；要改 ✨ 需换 `tipTrack` 里的两次 `creditMoney`，客户端不用动。
6. **浏览器验证未做**：地图图钉点击、宠物跟随/坐姿、巡逻 👁️ 跨会话可见、陪审投票到结算全链路、拼单合单下单，均需在真机/浏览器里点一遍；typecheck + build + 服务器 200 只证明静态与启动正确。
7. **`getLivehouseTips.totalEarned` 只汇总最新 20 条**（E 日志原话）：历史总额要另算，UI 文案已按“最近 20 条”写明。
