# ROUND-3B CHANGELOG — feature/round-2 (from main @ 32348ca)

Branch: `feature/round-2` (created 2026-11-11 on GitHub from main@32348ca).
Previous round-3 work: local only, not yet pushed. This round's work is local only — nothing pushed to remote, no browser work done.
Local workdir: `~/workspace/shenhui-life-sim/`. Worked 2026-11-12 ~01:00–01:30 UTC.

## Scope

Round-3b fixes 6 of the 7 residuals in ROUND3-LOG-int.md §十一"没做成的事" (items 1, 2, 3, 4, 5, 7). Item 6 (browser verification) is out of scope — it needs lee himself on his Mac. It also completes the missing ROUND3-CHANGELOG.md (written by worker G in this round, 451 lines).

Per-area logs are the source of record: ROUND3B-LOG-S.md (server), ROUND3B-LOG-H.md (house + 3D spots), ROUND3B-LOG-D.md (delivery client), ROUND3B-LOG-int.md (integration, this round's coordinator). Line numbers below are post-integration measured numbers; where a worker log cites a pre-integration number, the difference is noted in "LOG 之间对不上的地方" at the end.

Task → int §十一 mapping: 1 盖房槽位 = §十一 (1)；2 拼单托管 = §十一 (3)；3 打分入口 = §十一 (2)；4 蝴蝶/食堂光柱点 = §十一 (4)；5 打赏 ✨ = §十一 (5)；6 打赏总额全量 = §十一 (7)。

- 1 — 盖房槽位 7 → 14：服务端认 slot 0–13 / 最多 14 件（S），客户端槽位 + 拜访过滤（H + 集成）
- 2 — 拼单真分账：lock 时各人那份经 writeLedger 托管，送达结算、取消退回（S + D + 集成，含双重扣款口径）
- 3 — 每周任务打分入口：吃完后在"最近订单"行打 1–5 星，5 星上报 rate-5（D + 集成）
- 4 — 蝴蝶 / 食堂 3D 光柱点：park 加 butterfly、factory 加 canteen（H）
- 5 — 打赏改成 ✨：tipTrack 两次 creditMoney（¥）换成 bookStars（S + 集成改客户端文案）
- 6 — Livehouse 打赏总额全量：getLivehouseTips.totalEarned 改 SQL sum（S + 集成改文案）

## 1 — 盖房槽位 7 → 14（S + H + 集成）

Server (S, `server/src/actions.ts` + 新迁移 0021 — 本项不需新表，槽位上限只是校验值）：
- `publishHome` (`actions.ts:1593`，请求 zod）：`slot` 上限 `max(6)` → `max(13)`，`layout` 数组 `.max(8)` → `.max(14)`。存储形状没变（`homes.layout` 仍是 JSON 数组 `{id, slot}[]`）。
- `getHome` (`actions.ts:1613`，读侧同一存储）：`.slice(0, 8)` → `.slice(0, 14)`，否则服务端存了 14 件、读只回 8 件。
- 核对：`client/src/round2/house.ts` 的 `HOUSE_FURN_CATALOG` 确是 14 个真 id（sofa-fabric / sofa-leather / sofa-tatami / table-oak / table-marble / tv-cabinet / bed-double / wardrobe / desk / fridge / kitchen-cabinet / dining-table / washer / bathtub）。端点形状不变：`publishHome { playerId, tier, style, layout: [{id, slot}] } → { ok }`。

Client (H, `client/src/round2/house.ts` + `client/src/LifeStage.tsx`）：
- `house.ts` `HOUSE_FURN_SLOTS`（:254 起）：原 7 个槽位原样保留（顺序、坐标不动），末尾追加 7 个（索引 7–13）：7 后墙中 (-0.6, -2.7)、8 右墙边 (5.0, -0.6)、9 左墙边 (-5.4, 0.6)、10 正中 (0.7, -0.6)、11 左后墙边 (-5.6, -2.6)、12 右前角 (5.5, 1.8)、13 左前中 (-3.9, 2.0)。顶部注释"7 个槽位"旧说法同步改成 14（:75–76、:282–283："第 15 件起丢弃"）。
- `LifeStage.tsx` `FURN_SLOTS`（:200 起）：同一批 7 个槽位，x/z/ry 与 house.ts 逐一相同，另加中文/英文名。App.tsx:7580 的槽位选择器按 `FURN_SLOTS.map` 渲染，自动长到 14 个按钮。
- 选点依据（H 日志 §一）：对照 flat 布景（后墙 z=-3.75、侧墙 x=±7.2、地板 22×14），新槽位均避开内置沙发/床、门洞、ROAM_SPOTS.flat 四点与玩家出生点；槽位之间最近 1.84（slot 13 到 slot 5），不低于既有标准（旧槽位 3–4 之间只有 1.82）；家具之间没有碰撞体积。

Integration (int, `client/src/App.tsx`）：
- `spotsOf`（App.tsx:3526）：`p.slot <= 6` → `p.slot <= 13`。这是 App.tsx 里唯一一处 slot ≤ 6 检查。这是看别人家（NPC 家 + 线上玩家家）的过滤器——不改它，别人家 slot 7–13 的家具在拜访时会被滤掉、看不见；自己家走 `placedFurn()`（:497–506，按 `FURN_SLOTS.findIndex` 找空槽，无上限检查），FURN_SLOTS 扩到 14 后自动支持 14 件，不用改。

验证：H 的一次性脚本（已删）：14 件 ZhuyaHome 家具全摆、0 丢弃；第 15 件仍以 `no-free-slot` 丢弃（符合设计）；两边 14 个槽位坐标 0 偏差。S 的 handler 冒烟：`publishHome` 14 件 slot 0–13 → `{ok:true}`。

## 2 — 拼单真分账（S + D + 集成）

Server (S, `server/src/actions.ts` + `server/src/schema.ts` + 新迁移 `drizzle/0021_round3b_server.sql`）：
- 新表 `group_order_escrow`（schema.ts:935）：PK `(group_id, player_id)`（一团一人最多一行，只在 lock 时托管一次），列 `food_amount`（该成员菜钱小计 ¥）、`fee_amount`（该成员配送费分摊 ¥）、`amount`（= 两者之和，实际扣款）、`status`（`held | released | refunded`）、`created_at`、`released_at`。没复用 tradeEscrow：它只有一笔总金额、没有菜钱/配送费拆分列；扣款/放款写法照 trade escrow 的 `creditMoney` + compare-and-set。
- `group_orders` 新增列（0021）：`pool_id`、`locked_at`。
- 内部函数（actions.ts:1225–1315，`GROUP_ORDER_VIEW` 附近）：
  - `GROUP_ORDER_ESCROW_STATUS_Z`（:1228）：`"none" | "held" | "released" | "refunded"`。
  - `groupOrderSplit(members, deliveryFee)`（:1244）：服务端镜像的 `groupOrderTotals`——配送费平分 `floor(fee/n)`，余数归第 1 位成员（发起人，joinedAt 最早）。分摊只用服务端存的 `subtotal`，不信客户端报的数。
  - `groupEscrowByPlayer`（:1252）、`refundGroupEscrow`（:1259，全额退回，compare-and-set `held` → `refunded` + 逐人 `creditMoney(+amount)`)、`settleGroupEscrow`（:1279，compare-and-set `held` → `released`）。
  - `GROUP_ORDER_LOCKED_TTL_MS = 2h`（:1239）：锁了 2 小时还没 complete 的团视为放弃。
  - `groupOrderView`（:1295）：新增两条懒过期（照抄 `expirePoolOrders` 模式），读到即取消 + 全额退款：`open` 团过 `expiresAt`（30 分钟凑团期）；`locked` 团过 `lockedAt + 2h`。`getGroupOrder` / `lock` / `complete` / `leave` 都走它，所以过期退款不需要定时器。
- `settleGroupEscrow` 的钱去向：菜钱 `food`：餐厅是 NPC（没有玩家账号），released 即花掉——钱已在 lock 时扣出，不再 credit 给任何人，和普通客户端 `placeOrder` 扣掉菜钱同一口径。配送费 `fee`：有 `poolId` 时逐人 `creditMoney(发起人, feeAmount)`（见下文"为什么补给发起人"）；无 `poolId` 时 NPC 骑手，released 即花掉。
- `lockGroupOrder`（actions.ts:5394）：请求 `{ playerId, groupId: number, deliveryFee?: number (0–10000，默认 0) }`。客户端必须传它在 `placeOrder` 里算出的同一份配送费（`groupOrderTotals(g, fee)` 用的那个 `fee`），服务端用 `groupOrderSplit` 按同一算法拆；不传则只托管菜钱。流程：先对**所有**成员做余额检查（`players.money`，服务端数），任何一人不够就**一分钱不扣**，返回 `ok: false` + `error`（点名 + 差多少）+ 结构化 `shortfalls: [{ playerId, playerName, need, have, short }]`。全员够 → 逐人 `creditMoney(-total, "group order #id escrow")` + 插 escrow 行（`held`），再 compare-and-set `open → locked`（+ `lockedAt`）。并发下只有一个 locker 赢：输的那方把本调用刚插的行原样退回。已托管过的成员重调不会重复扣（按已有 `held` 行跳过）。
- `completeGroupOrder`（actions.ts:5451）：请求 `{ playerId, groupId: number, poolId?: string }`（`poolId` 是 `deliveryPoolPublish` 回的池单号，仅合单发到跑腿池时传）。校验池单存在、是发起人发的、餐厅与拼单一致、状态不是 `expired` / `cancelled`。返回 `{ ok, error?, settlement?: { food, fee, feeToHost } }`——`food` 菜钱合计（已 released 给 NPC 商家），`fee` 配送费合计，`feeToHost` 补给发起人的配送费（无 poolId 时为 0）。round-3 之前锁的团没有 escrow 行，`complete` 照旧成功（`settlement` 全 0），向后兼容。锁过期时调它会先懒取消并退款，返回"拼单已过期取消，托管已退回各成员。"。
- `leaveGroupOrder`（actions.ts:5361）：规则变了一处——原来锁后任何人都不能退；现在**发起人可以取消一个已锁定的团**（未下单前），整团 `cancelled` + 全额退款；非发起人锁后仍不能退（`ordered` / `cancelled` 状态也不能退）。`open` 团的退出规则不变。
- `getGroupOrder`（actions.ts:5346）：`GROUP_ORDER_VIEW`（:1229）新增团级 `poolId: string | null`（合单发池后才有值）；每成员新增 `escrowStatus: "none" | "held" | "released" | "refunded"`（`none` = 未托管（团还没锁）、`held` = 已托管（已锁，钱在托管里）、`released` = 已结算（complete 后）、`refunded` = 已退回（取消/过期））+ `escrowTotal: number`（该成员托管/结算/退回的总金额；`none` 时为 0）。

为什么配送费有 poolId 时补给发起人（不是直接给骑手）：合单发到跑腿池时，发起人调 `deliveryPoolPublish` 已经又从自己账上托管了一份 `riderFee`；骑手那份钱由 `deliveryPoolDelivered` 按现有规则从池子的 delivery escrow 付（准时全额 / 迟到 70%，30% 退回发单人）。如果拼单托管的配送费再付给骑手，骑手费就付了两遍。所以 `completeGroupOrder` 带 `poolId` 时，各成员的 `feeAmount` 返还给发起人——发起人实付 = `riderFee − 其他成员的 fee 合计`，每人最终恰好付了自己的 `feeShare`。`deliveryPoolDelivered` 本身没改。

Client (D, `client/src/round2/delivery.ts`；字段名由集成按服务端对齐）：
- `GroupOrderMember` 加可选 `escrowStatus?: GroupOrderEscrowStatus`（:1122）+ `escrowTotal?: number`（:1124）；`GroupOrderEscrowStatus = "none" | "held" | "released" | "refunded"`（:1106）；`GROUP_ORDER_ESCROW_ZH`（:1109）：none 待托管 / held 已托管 / released 已结算 / refunded 已退回；`groupMemberEscrow`（:1127，缺失字段默认 `"none"`，绝不默认成"已托管"）+ `groupEscrowLabel`（:1132）；`GroupOrderView` 加 `poolId?: string | null`（:1150）。
- `groupOrderTotals` 保持原样（只算数，不扣钱、不写账；托管是服务端 `lockGroupOrder` 的事）。拼单小节注释更新（:1083–1093，原注释"钱不走 server 托管"已过时）。
- `LAGOS_GAP_CHECK` 两条 note/next 更新（group-order :1316、retention-loop :1325）。

Integration (int, `client/src/App.tsx`）— **双重扣款口径（本轮最关键的决定）**：
- 问题：原 `lockAndOrder` 在锁定成功后调 `submitDeliveryOrder(merged)`，由发起人在本地全额垫付整单；服务端 escrow 上线后，各成员（含发起人）的那份已在 lock 时从各自余额扣出，发起人本地再付全款 = 成员的钱被算了两次（一次托管、一次发起人垫付）。D 日志 §五.4 与 S 日志 §2 末尾都点了这个问题，留给集成定口径。
- 定下的口径：**锁成功后发起人合单时不再让客户端付整单——钱已经在各成员账上扣出去了。只用 `placeOrder` 生成订单对象（不扣钱），发池，再调 `completeGroupOrder` 结算。** 新 `lockAndOrder`（App.tsx:4879）：
  1. `lockGroupOrder({ playerId, groupId, deliveryFee: groupFee })`——传客户端算出的同一份配送费（`groupFee`，App.tsx:4936，与 `groupOrderTotals` 同一口径）；失败时服务端错误原样 toast（:4864 分支本就如此，保留），return。
  2. `placeOrder({ city, platformId: DELIVERY_PLATFORMS[0].id, items: merged, coupons: d.coupons, memberUntilDay: 0, day, now })`——只生成订单对象，**不走月卡/券**（`memberUntilDay: 0` 使 `membershipActive` 为 false，`deliveryFee = baseFee = groupFee`，与托管口径一致）；然后 `pushOrder` 进本地订单列表，**不扣 `x.money`**。`placeOrder` 失败时（理论上不应发生——合单菜品都来自本团同一家店的菜单），发起人调 `leaveGroupOrder` 取消整团退回托管，再 toast 报错。
  3. `deliveryPoolPublish`（await，不再 fire-and-forget）取 `poolId`——发起人另托管 `riderFee`；`poolPayloadFor`（delivery.ts:884）算 `riderFee = max(3, order.deliveryFee)`，而本流程 `order.deliveryFee = groupFee`，所以 `riderFee = groupFee = 各成员 feeShare 之和`，账算得平：发起人净付 = 自己那份 + riderFee − feeToHost（= groupFee）= 自己那份；每人最终恰好付了自己的 `feeShare`；全团合计 = 菜钱 + groupFee = 整单应付。发池失败时 `poolId` 为 undefined，按无池单结算（配送费归 NPC 骑手，服务端既定 fallback）。
  4. `completeGroupOrder({ playerId, groupId, poolId? })`——结算；失败 toast，return（团仍锁着，2h TTL 到期全额退款兜底）。
  5. 清 `activeGroup` / `setGroup(null)`，toast"拼单下好了，骑手正在路上。"，`setDeliveryCart([])` / `setPhoneOpen(false)`（沿用 solo 下单的收尾）。
  6. 每周任务 order 事件**按发起人自己那份报**（`groupOrderTotals(r.group, groupFee)` 里发起人的 `total`），不是整单——整单的钱是各人托管的，不是发起人花的。
- 拼单卡片（App.tsx:4937、:4974）：`groupTotals` 在 `groupFee` 之后算一次供两行共用；成员行显示三段：点的菜（¥菜钱小计）、平摊后共计（菜钱 + 配送费份额）、escrow 状态（`groupEscrowLabel(m)`：待托管 / 已托管 / 已结算 / 已退回）。服务端未上线 escrow 时全员显示"待托管"，不会误显示"已托管"。平摊行（:4975）保持原样。
- import（App.tsx:45）：delivery import 行追加 `groupEscrowLabel`。

验证（S 的 handler 冒烟，直接调真实 handler，临时库 + 临时脚本，事后删除）：拼单 3 人（菜钱 100/50/60，配送费 9）：余额不足的成员锁单失败，`error` 点名"阿穷 还差 ¥23"，`shortfalls` 齐全，**三人余额一分没动**（1000/30/500）；补足后锁定成功，各成员 `escrowStatus: held`（103/53/63），余额 897/47/437；`complete`（无 poolId）结算 `{food:210, fee:9, feeToHost:0}`，行变 `released`，余额不变。发起人取消已锁团：`ok:true`，两成员全额退回，行变 `refunded`。锁团 TTL：把 `locked_at` 拨回 3 小时前再读，团变 `cancelled`、成员 `refunded`、余额恢复。带 poolId 结算：锁（配送费 10）→ `deliveryPoolPublish`（riderFee 10）→ `completeGroupOrder(poolId)` 结算 `{food:50, fee:10, feeToHost:10}`，发起人余额 872（= 897−25 锁 −10 发池 +10 返还）、成员 402，池单 escrow 仍在原地等 `deliveryPoolDelivered` 按现有规则付骑手；`getGroupOrder` 的 `poolId` 回显池单号。

## 3 — 每周任务打分入口（D + 集成）

Client (D, `client/src/round2/delivery.ts` :1016–1045）：
- 新增"吃完打分 → 每周任务 rate-5"小节：`afterMealRateEligible(order)`（:1026，stage delivered/eaten + 没评过）、`RATE_QUEST_STARS`（:1031）、`rateAdvancesQuest(stars)`（:1033，只有 5 星推进 rate-5）、`rateOrder(state, orderId, stars)`（:1039，调本地 `rateRestaurant` 记分，返回 `{ state, advancesQuest }`）。
- 服务端规则（E 日志 §1(d)，`reportDeliveryQuest` actions.ts:5353）：`rate` 事件且 `stars === 5` → rate-5 记 1；1–4 星不推进任务。所以 `rateOrder` 的约定：1–5 星都调 `rateRestaurant` 本地记分（≥4 星还照旧收藏店铺），只有 5 星才 `advancesQuest === true`。1–4 星不调 `reportDeliveryQuest`（调了服务端也不记数，白白占 10 次/分钟限流）。

Integration (int, `client/src/App.tsx`）：
- import（:45）：delivery import 行追加 `afterMealRateEligible, rateOrder`（`rateRestaurant` 不用直接 import，`rateOrder` 内部已调它）。
- `rateDeliveryOrder`（:1646，紧贴 `eatDeliveryOrder` 之后）：1–5 星都本地记分并 `mutate`；非 5 星只 toast"已给 X 打 N 星。"；5 星调 `api.reportDeliveryQuest({ event: "rate", stars })`，上报后刷新每周任务卡（复用 `submitDeliveryOrder` 的 `getWeeklyQuests` 刷新写法），toast"五星好评已记下，本周任务进度更新了！"。
- 星星放在外卖页"最近订单"历史行（:5025）：`{d.orders.slice(0, 5).map(...)}` 那行全文替换。关键发现（D 实测）：吃完后 `updateOrder` 会清掉 `activeOrderId`，顶部"当前订单"卡片（:4893–4899，含"🍽️ 开吃"按钮）在吃完后就消失了——打分按钮不能放在当前订单卡片上。吃完的单子以"已吃完"出现在历史列表，是用户吃完饭自然会看到的地方；已送达未吃的单子在这里显示"已送达 + 开吃"。星星只在 `afterMealRateEligible(o)` 为真时出现（stage delivered/eaten 且没评过）；评过一次就变成"已评 ★★★★★"文字，不可改分（`rateRestaurant` 本身允许多次改分，但 UI 上一次评完即收口，避免反复刷 report——服务端 rate 事件有 10 次/分钟限流，但不防重复 5 星；真要防刷得服务端按订单去重，见"没做成的事"）。
- 没动 `eatDeliveryOrder` 本身：吃完 toast 后用户低头就能在同一页的历史行看到星星。也没藏进 toast 里——toast 3 秒就没了，历史行一直都在。

## 4 — 蝴蝶 / 食堂 3D 光柱点（H）

Client (H, `client/src/LifeStage.tsx`，只加两个点，已有点和布景一字未动）：
- `ROAM_SPOTS.park` 加 butterfly（:85）：`{ id: "butterfly", emoji: "🦋", zh: "在蝴蝶谷站一会儿", en: "Stand in Butterfly Valley", x: -4.2, z: -0.9 }`。id 必须 exactly 是 `"butterfly"`：与 App.tsx:218 `QINGQING_TALK` 的条目 id 一致（A 日志 S2，int 已落地）。选点：落在花丛里——12 朵花（:2316，x -5…5、z -1.3…-0.6，即蝴蝶谷花丛）；离最近的树 1.61、灌木 2.09、池塘中心 2.8（池塘半径 1.7，点在池外）、路灯 2.32、长椅 6.6；离已有三点 bench / stroll / photo 最近 2.53；离出生点约 4.8；在 `clampWalk`（x ±5.6、z -1.15…2.15）内。
- `ROAM_SPOTS.factory` 加 canteen（:104）：`{ id: "canteen", emoji: "🍱", zh: "在食堂吃一顿", en: "Eat in the canteen", x: 4.2, z: 1.2 }`。id 必须 exactly 是 `"canteen"`：与 App.tsx:172 `VENUE_TALK.factory` 的 canteen 条目 id 一致（A 日志 S3，int 已落地）。工厂布景里没有食堂道具（只有产线传送带、4 台机器、两个储罐、班长与工头两个人偶），所以"食堂区域"只能是前场右侧空地——任务要求只加两个点、不改布景，没有凭空加食堂桌椅。坐标 (4.2, 1.2)：离产线 3.1、离最近的工人（工头 2.2, 0.4）2.15、离已有两点 tour / ask 最近 4.29、离出生点约 4.05；在 `clampWalk` 内。
- App.tsx 不用改：光柱点渲染（LifeStage.tsx:2864 起，按 `ROAM_SPOTS[setKind]` 生成 pin，点 pin 或走近后按 E/空格都调 `onSpot?.(id)`）→ App.tsx:7492 venue 3D 的 `onSpot` 按 talk id 查 `venueTalksFor(venue3d.set, venue3d.id)`，找到即 `runVenueTalk`。蝴蝶：青青世界进场时 `venue3d.id = selLoc.id`、`venue3d.set = "park"`，`venueTalksFor("park", "qingqing")` 返回 `VENUE_TALK.park` + `QINGQING_TALK`，其中 id `"butterfly"` 在 App.tsx:218（mood +10，一日一次走 `venueFx` 通用路径）。食堂：工厂进场 `venue3d.set = "factory"`，`venueTalksFor("factory", <locId>)` 返回 `VENUE_TALK.factory`，其中 id `"canteen"` 在 App.tsx:172（money -12 / mood +4 / energy +10 / hunger 28）。两处 talk 的 pose：butterfly `idle`、canteen `eat`，LifeStage 已有对应 pose 分支，无需新增。下方按钮列表（App.tsx:7502）同样用 `venueTalksFor`，点与按钮是同一条 talk。

已知局限（不是 bug，是 `ROAM_SPOTS.park` 共用的结构性后果）：**butterfly 点会出现在全城所有公园**（A 日志 S2 特意不把 butterfly 加进 `VENUE_TALK.park`，就是怕全城公园都有蝴蝶；但光柱点这一层没有按地点区分的机制）。只有青青世界（locId `"qingqing"`）能在 `venueTalksFor` 里查到 butterfly 对话；其它公园点这个 pin 时 `v` 为 undefined，什么都不发生（死 pin）。要彻底修，需要 LifeStage 的 park pin 按地点 id 过滤（`ROAM_SPOTS` 加 locId 条件或 App 传一个"本场馆可用 pin"列表），超出本次任务，留给 parent 定夺。**canteen 点没有食堂布景可站**：工厂场景里没有食堂桌椅/窗口，点在前场空地上。想让它"像食堂"需要在 factory 布景里加一角餐桌/取餐台，也是布景改动，不在本次"只加两个点"的范围内。

## 5 — 打赏改成 ✨（S + 集成）

Server (S, `server/src/actions.ts`）：
- 查清的 ✨ 记账方式：`bookStars(db, accountId, amount, reason, ref, allowNegative?)`（actions.ts:560）——往 `starLedger` 追加一行，`(reason, ref)` 唯一防重记，余额不足（不允许负）返回 `false`。`storeState`（:2317）读 `starBalance` 展示余额；`createOrder`（:2354）只建 Stripe 订单，`fulfilOrder`（:583）收款后才 `bookStars(+stars, "purchase", orderId)`；`buyLook`（:2422）是现成的扣 ✨ 模板：`bookStars(acc.id, -SHOP[..].stars, "shop", ref)`，余额不足报 `"✨ 不够"`。打赏照 `buyLook` 的写法。
- `tipTrack`（actions.ts:5206）：两次 `creditMoney`（¥）全部换掉——打赏人 `bookStars(me.accountId, -amount, "livehouse-tip", ref)`，`ref = "livehouse-tip:<randomUUID>"`，每条打赏唯一，不会重记；音乐人 `bookStars(t.accountId, creatorShare, "livehouse-tip", "<ref>:creator")`，`creatorShare = floor(amount × 0.7)` 不变；音乐人入账失败时把打赏人的 ✨ 原路退回（`bookStars(+amount, "livehouse-tip", "<ref>:refund")`）再报错，不吞钱。`creatorShare === 0`（打赏 1✨）时跳过音乐人入账（0 不记账），打赏人照付。
- 新增前置校验：打赏人必须绑定账号（`me.accountId` 为空 → `"打赏要用 ✨，先绑定账号（右上角 👤 账号）再打赏。"`）——✨ 在账号账本上，不在玩家 ¥ 账本上，游客没有 ✨ 可扣。余额预检用 `starBalance`，不足报 `"✨ 不够打赏。"`。
- 其余规则不变：歌须 `approved`、音乐人须已进游戏、不能打赏自己、每人每天最多 10 次（仍数 `livehouse_tips` 行）。
- **表没动**：`livehouse_tips.amount` / `creator_share` 继续存数字，单位从 ¥ 变成 ✨（schema.ts 注释已改；`star_ledger.reason` 注释 +`livehouse-tip`，schema.ts:293）。
- 请求/返回形状不变：`tipTrack { playerId, trackId, amount (1–500，现为 ✨), message? } → { ok, error?, creatorShare?, creatorName? }`。feed 文案 `¥` → `✨`（actions.ts:5241）。
- 客户端不用改请求（`amount` 字段名、范围都不变），只改展示单位。

Integration (int, `client/src/Livehouse.tsx` + `client/src/round2/delivery.ts`）：
- `Livehouse.tsx`：打赏成功 toast（:64）`"已打赏 ¥X，…收到 ¥Y（七成）"` → ✨；打赏按钮 `¥{a}` → `✨{a}`（:130，`TIP_AMOUNTS` [10, 30, 88] 数字不变）；轮播"已收到打赏 ¥X" → ✨（:140）；音乐人收入区 header（:157）`"我收到的打赏（最近 20 条，共 ¥X）"` → `"我收到的打赏（累计 ✨X）"`（totalEarned 现为全量，见第 6 项；旧文案"最近 20 条"已过时）；收入明细行（:158）`打赏 ¥{amount}，你收到 ¥{creatorShare}` → ✨；两处注释同步（:123 打赏区、:154 收入区）。
- `delivery.ts`：Livehouse 打赏小节注释（:1061）"听众花 ¥ 打赏…server tipTrack 走 creditMoney / writeLedger" → "听众花 ✨ 打赏…走 bookStars / starLedger"；`LAGOS_GAP_CHECK` creator-payout 条目（:1300–1302）note/next 同步（"round-3b 已把 tipTrack 从 ¥ 账本改成 ✨（bookStars）"）。

验证（S 的 handler 冒烟）：打赏 30✨ → `creatorShare 21`，打赏人 ✨ 100→70、音乐人 ✨ 0→21，双方 ¥ 余额纹丝不动（100/100）；无绑定账号的玩家打赏被拒（`"打赏要用 ✨，先绑定账号…"`），¥ 不动。

## 6 — Livehouse 打赏总额全量（S + 集成）

Server (S, `server/src/actions.ts`）：
- `getLivehouseTips`（actions.ts:5247）：`totalEarned` 从 `rows.reduce(...)`（最新 20 条）改成一次 SQL 聚合：`select sum(creator_share) from livehouse_tips where creator_id = ?`（无行时 `sum` 为 NULL → 0）。没扫全表行。
- `mine` 仍只返回最新 20 条不变；`totals`（全城每首歌 `sum(amount)` + `count`）不变。单位现为 ✨（随第 5 项）。

Integration (int, `client/src/Livehouse.tsx` :157）：收入区 header 从"最近 20 条，共 ¥X"改成"累计 ✨X"（见第 5 项）——旧文案会误导用户以为总额只算最近 20 条。

验证（S 的 handler 冒烟）：再插 25 条 `creatorShare=1` 后 `totalEarned=46`（21+25，全量），`mine.length=20` 不变。

## ROUND3-CHANGELOG.md（本轮另一件 deliverable）

Worker G 补写，`~/workspace/shenhui-life-sim/ROUND3-CHANGELOG.md`（451 行，82,689 字节）：13 处缺口每处改了什么（文件 + 行号）、验证结果（typecheck 0 错、build 8.29 秒、服务器 200、迁移 0020）、§十一那 7 处没做成的事原文；另有"已核实修好的对照表"（9 处全修、4 处半修：mahjong mp3、盖房 7 槽位上限、Lagos rate-5/escrow/¥-打赏/20 条总额、蝴蝶/食堂光柱点）、"两个小注"，以及"LOG 之间对不上的地方"一节（12 处差异，多为集成插入导致的行号后移，无语义冲突；另有 publishHome"slot 0–6、最多 8 件"的数字口径不一致、S/E helper 行号范围重叠、i18n-en "Honghuahu Lake Cycling" 疑似拼写未处理）。

## 服务端（本轮新增）

- 新迁移 `drizzle/0021_round3b_server.sql`（新建；0019/0020 没动）：
  ```sql
  CREATE TABLE `group_order_escrow` (
    `group_id` integer NOT NULL, `player_id` text NOT NULL,
    `food_amount` integer NOT NULL, `fee_amount` integer NOT NULL, `amount` integer NOT NULL,
    `status` text DEFAULT 'held' NOT NULL, `created_at` integer NOT NULL, `released_at` integer,
    PRIMARY KEY(`group_id`, `player_id`)
  );
  --> statement-breakpoint
  ALTER TABLE `group_orders` ADD COLUMN `pool_id` text;
  --> statement-breakpoint
  ALTER TABLE `group_orders` ADD COLUMN `locked_at` integer;
  ```
  `drizzle/meta/_journal.json` 加 `idx 20` 条目（`when: 1795800000000`，`tag: "0021_round3b_server"`，照 0020 的 `when` 递进 +10 亿）。`pool_id` / `locked_at` 旧行均为 NULL：旧团 `poolId` 读作 null，`lockedAt` 为空的锁团不触发 2h TTL（只对 round-3b 起锁的团生效，旧锁团行为不变）。
- 新增端点：无（全是既有端点的改动：`lockGroupOrder` +`deliveryFee` 入参、`completeGroupOrder` +`poolId` 入参、`getGroupOrder` + escrow 字段；`tipTrack` / `getLivehouseTips` / `publishHome` / `getHome` 内部改动）。
- 新增表：`group_order_escrow`（1 个）。本轮服务端总表数不变之外的新增：35（round-2）+ 7（round-3）+ 1（round-3b）= 43 张新表（自 0019 起）。

## 集成（int, 2026-11-12）

- 集成 agent 落地的 App.tsx 改动（workers 只出 snippet，App.tsx 由集成直接改）：import（:45，追加 `afterMealRateEligible, rateOrder, groupEscrowLabel`）；`rateDeliveryOrder`（:1646）；最近订单行星星（:5025）；`groupTotals`（:4937）+ 成员行 escrow 显示（:4974）；`lockAndOrder` 重写（:4879，双重扣款口径见第 2 项）；`spotsOf` slot ≤ 13（:3526）。
- delivery.ts 字段名对齐（见"LOG 之间对不上的地方"第 1 条）：D 先按 `escrow: "pending"|"held"|"settled"|"refunded"` 写，服务端最终是 `escrowStatus: "none"|"held"|"released"|"refunded"` + `escrowTotal`；集成把 delivery.ts 的类型/字段/映射/默认值改成服务端形状（:1106、:1122、:1124、:1127），snippet B 不用动（它只调 `groupEscrowLabel(m)`）。
- Livehouse.tsx 打赏文案 ¥→✨（:64、:123、:130、:140、:154、:157、:158）+ delivery.ts 打赏注释同步（:1061、:1300–1302）。
- 集成时修掉的 typecheck 错（1 个）：`groupOrderTotals(r.group, groupFee)`——服务端回包的 `city` 在 API 客户端类型里是 `string`，不是 `CityKey`；改成 `r.group as unknown as GroupOrderView`（与别处 `setGroup(g.group as unknown as GroupOrderView)` 同一写法）。
- 其余 ¥ 引用核查：activities.ts:292（代驾小费 ¥100）与 delivery.ts:848（骑手送达小费）是另外两个 ¥ 小费系统，与 Livehouse ✨ 打赏无关，不动。

## 验证结果（集成 agent, 全部通过）

1. **typecheck**：`cd standalone && npm run typecheck`（`tsc --noEmit`）——**0 错误**（最终干净复核；中途 1 个错是集成引入的 `r.group` 类型不匹配，见上，已修）。
2. **vite build**：`cd standalone && npm run build`——**成功，8.50 秒**，index 1,954.24 kB（round-3 是 1,950.18 kB；+4 kB 来自打分星星 + escrow 显示 + lockAndOrder 重写）。
3. **服务器**：全新测试数据库 `.local-test/app-round3b.db` 启动，**HTTP 200**；迁移 0001–0021 依次应用成功（日志 `[db] applied 0021_round3b_server.sql`）；实测 `group_order_escrow` 表存在，`group_orders` 含 `pool_id`（TEXT）与 `locked_at`（INTEGER）列。服务器留在运行状态：127.0.0.1:8787，DB `.local-test/app-round3b.db`，env PORT=8787 HOST=127.0.0.1 ADMIN_TOKEN=test-admin-token-1234 DEV_LOGIN_CODES=1 DEV_PAYMENTS=0 WEATHER=off。
4. Workers 各自的验证（见各自日志）：S — typecheck 0 错误、迁移 0001–0021 在临时库应用通过、handler 端到端冒烟全部符合预期（拼单锁/结算/取消/TTL/带 poolId 结算、打赏 ✨ 双方 ¥ 不动、无账号打赏被拒、totalEarned=46 而 mine 仍 20 条）；H — typecheck 0 错误、14 件全摆 0 丢弃、两边槽位坐标 0 偏差；D — typecheck 0 错误（第一遍即过）。

## 没做成的事（§十一 (6) 仍在 + 本轮新发现的残留）

1. **浏览器验证未做**（§十一 (6)，不在本轮范围）：拼单锁→下单→结算、打赏 ✨ 余额变化、14 件家具进家、打分星星、蝴蝶/食堂光柱点，均需在真机/浏览器里点一遍；typecheck + build + handler 冒烟只证明逻辑正确。
2. **蝴蝶死 pin（其它公园）与食堂无布景**（H 日志 §二）：butterfly 点出现在全城所有公园，只有青青世界有对话，其它公园点它什么都不发生；factory 食堂点在前场空地上，无食堂桌椅/窗口。都是结构性问题，需 parent 定夺是否另开任务（park pin 按地点 id 过滤；factory 布景加一角餐桌/取餐台）。
3. **rate-5 防刷不在客户端**（D 日志 §五.5）：`rateOrder` 只保证"5 星才上报"；同一单评 5 星后 UI 收口，但服务端 `reportDeliveryQuest` 目前按调用次数记 progress。真要防同一单重复 5 星刷任务，得服务端按订单去重（例如记 `meta.ratedOrders`），客户端改不了。
4. **拼单成员的每周任务 spend-100 不推进**：集成后 order 事件只按发起人自己那份报；其他成员那份（已托管）不会计入他们自己的"本周吃满 ¥100"。要修得成员客户端在拼单下单后也上报自己的 `total`（或服务端在 complete 时给各成员记 progress），不在本轮范围。
5. **迟到 30% 退款不按成员拆**（S 日志 §7）：池单迟到时 `deliveryPoolDelivered` 按现有规则把 30% 退给池单 customer（= 发起人），不按各成员的 `feeShare` 再拆一次。金额小且与单人池单语义一致，留作后续可选。
6. **锁后 2h TTL 是拍脑袋的数**（S 日志 §7）：发起人锁了不 complete，钱最长压 2 小时（期间发起人可 `leaveGroupOrder` 主动取消退款）。如需更短/更长，改 `GROUP_ORDER_LOCKED_TTL_MS` 一行。
7. **商家没有玩家账号，菜钱只能"花掉"**（S 日志 §7）：餐厅是 NPC，`settleGroupEscrow` 的菜钱 released 即出账、不 credit 给任何人——和普通 `placeOrder` 扣菜钱同一口径。真要"付给商家"得先有商家账号体系，本轮没有。
8. **跨玩家扣款与心跳回写的固有张力**（S 日志 §7）：`creditMoney` 同时改 `money` 与 `reportedMoney`，成员客户端下次心跳以旧钱数上报时，`settleMoney` 的 earn 口径可能把一部分托管当"收入"补回（上限为 earn budget）——这是 trade/delivery escrow 早就有的同一模式，不是本轮引入的；现有约定是客户端采纳心跳回的 `bank.money`（App.tsx:1984），成员在线时扣款会正常落账。彻底修要改全局 `settleMoney`，不在本轮范围。
9. **无事务包裹**（S 日志 §7）：与现有代码一致（`tradeEscrow` / `deliveryPoolPublish` 同样是顺序 await + compare-and-set，没有显式事务）。锁单用"先全员验资、再逐人扣款、最后 CAS 上锁 + 输方退款"兜底；中途进程崩溃留下半托管时，`lock` 不可重调，但 2h TTL 到期会全额退款，钱不会丢。
10. **打赏 1✨ 时音乐人入账 0**（S 日志 §3）：`creatorShare = floor(1 × 0.7) = 0`，跳过音乐人入账（0 不记账），打赏人照付 1✨。三成抽成在 1✨ 时实际是 100% 归店（0 归音乐人）——小额边界，可接受。
11. **第 15 件家具仍丢弃**：14 槽位是设计上限，第 15 件以 `no-free-slot` 丢弃（H 脚本已验）。要更多槽位得再加槽位坐标 + 服务端上限。
12. **麻将 mp3 仍缺**（round-3 遗留，非本轮范围）：`sfx("mahjong")` 调用点已接线（App.tsx:4039、:4045，MiniGame onPush:7636），有合成敲击 fallback；mp3 到位后翻 `sound.ts:60` `MAHJONG_SFX_FILE` 为 `"sfx/scenes/mahjong.mp3"` 即可。cron `mahjong-sfx-retry-2` 定于 2026-11-12 09:00 PST 再试 SFXMint。

## 已核实修好的对照表（§十一 7 项）

| §十一 | 内容 | 状态 |
|---|---|---|
| (1) | 盖房槽位 7 → 14 | ✅ 全修（服务端 0–13/最多 14 + 客户端 14 槽位 + 拜访过滤 ≤13） |
| (2) | 每周任务打分入口 | ✅ 全修（历史行星星 + 5 星上报 rate-5） |
| (3) | 拼单真分账 | ✅ 全修（lock 托管 + complete 结算 + 取消/过期退款 + 客户端口径） |
| (4) | 蝴蝶 / 食堂 3D 光柱点 | ✅ 点已加；⚠️ 半修：其它公园死 pin、食堂无布景（见"没做成的事" 2） |
| (5) | 打赏 ¥ → ✨ | ✅ 全修（服务端 bookStars + 客户端文案） |
| (6) | 浏览器验证 | ❌ 未做（不在本轮范围，需 lee） |
| (7) | 打赏总额全量 | ✅ 全修（SQL sum + 文案"累计"） |

## LOG 之间对不上的地方

1. **escrow 字段名**：D 日志先按 `escrow: "pending" | "held" | "settled" | "refunded"` 写（当时服务端日志还没出字段名）；服务端最终是 `escrowStatus: "none" | "held" | "released" | "refunded"` + `escrowTotal`（S 日志 §2，实测 `GROUP_ORDER_VIEW` actions.ts:1233、:1317）。集成已把 delivery.ts 改成服务端形状（:1106、:1122、:1124、:1127），snippet B 不用动。`pending` → `none`、`settled` → `released` 的改名只影响客户端类型，服务端从未用过旧名。
2. **行号后移**：集成在 App.tsx 插入 `rateDeliveryOrder`（19 行）等改动后，D/H 日志的锚点行号全部后移：D 的 :4973（最近订单行）→ :5025；D 的 :4924（成员行）→ :4974；D 的 :4861（lockAndOrder）→ :4879；H 的 :3508（spotsOf）→ :3526；D 的 :1631（eatDeliveryOrder）→ :1646 的是 `rateDeliveryOrder`（eatDeliveryOrder 本身在 :1631–1644）。本 changelog 用集成后实测行号。
3. **publishHome 行号**：H 日志 §四引用服务端 `publishHome` 在 actions.ts:1530（round-3 集成前的行号）；S 日志的 :1593 是 round-3b 实测行号，以 S 为准。
4. **S worker 的 3 次 exec 失败记录**：worker 完成 handoff 里 `recorded_execution_results` 有 3 条 exitCode 2 的 exec（subprocess.nonzero_exit）。S 日志 §6 自述"中途一次 2 个错只是临时测试文件自身的 TS 错误，已随文件删除"；集成独立复核 typecheck 0 错误、迁移 0001–0021 应用成功、服务器 200，S 的交付物无问题。那 3 条失败应为中间探查命令（grep 无匹配 / 临时脚本），不影响结论。
5. **S 日志 §5 的 0021 内容 vs 集成实测**：一致。集成在全新库上实测 `group_order_escrow` 表存在、`group_orders.pool_id` / `locked_at` 列存在。
