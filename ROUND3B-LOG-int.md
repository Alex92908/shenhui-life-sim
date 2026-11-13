# ROUND-3B LOG — 集成 Agent int（2026-11-12）

总协调 + 集成。只改本地，不推远端，不碰浏览器。分支 feature/round-2 @ 4bc5307b（本地 API 拉取副本，无 git）。
任务：ROUND3-LOG-int.md §十一的 6 处小尾巴（编号按本任务 1–6）+ 补 ROUND3-CHANGELOG.md。
Workers：G（changelog，8e02b462，已完成）、S（server，44978a3f，已完成）、H（house/scene，179eb10e，已完成）、D（delivery client，efbbec36，已完成）。本日志只记集成 agent 自己做的事；各 worker 的改动以各自日志为准（ROUND3B-LOG-S/H/D.md）。

家规遵守情况：没碰 main；没碰 ~/workspace/ts-spaces/ 与生产数据库；只用 standalone 路线验证（`cd standalone && npm run build`、`npx tsx server.ts`、测试数据库 `.local-test/app-round3b.db` 全新库）；没跑根目录 `bun run build`；没手改 `standalone/dist/`；没用 git 命令。另：按 runtime 提示读了 `~/workspace/shenhui-life-sim/AGENTS.md`——它要求走 web-artifact 工具、不 `bun run build`、不动 `~/workspace/ts-spaces/<slug>/.space-build/` 与 `ts-spaces` 的 app.db；本轮的 standalone 路线与这些禁令一致（无 bun build、无 ts-spaces、无 dist 手改），无冲突。

## 一、集成做的事（按顺序）

### 1. 读日志 + 核对锚点（集成前）
- 读了 ROUND3B-LOG-S/H/D.md 与 ROUND3-CHANGELOG.md（G，451 行，已存在）。
- 实测核对 App.tsx 锚点：import :45、eatDeliveryOrder :1631–1644、lockAndOrder :4861–4870、groupFee :4888、group 卡片成员行 :4924、最近订单行 :4973、spotsOf :3508（全仓唯一一处 slot ≤ 6 检查）；delivery.ts placeOrder :350（返回 `{ok, error?, order?, charge?}`，纯函数，扣款在调用方）、pushOrder :982、poolPayloadFor :884（`riderFee = max(3, order.deliveryFee)`）、rateRestaurant/afterMealRateEligible :999–1027（`rated?: number` 在 CustomerOrder :320）；server deliveryPoolPublish 返回 `{ok, error?, poolId?}`（actions.ts:4952）、lockGroupOrder 请求含 `deliveryFee?`（:5396）、completeGroupOrder 请求含 `poolId?`（:5453）、GROUP_ORDER_VIEW 成员含 `escrowStatus` / `escrowTotal`（:1233、:1317）、团级 `poolId`（:1232）。

### 2. 双重扣款口径（本轮最关键的决定）
- 问题：原 `lockAndOrder` 在锁定成功后调 `submitDeliveryOrder(merged)`，由发起人在本地全额垫付整单；服务端 escrow 上线后，各成员（含发起人）的那份已在 lock 时从各自余额扣出，发起人本地再付全款 = 成员的钱被算了两次。D 日志 §五.4 与 S 日志 §2 末尾都点了这个问题，留给集成定口径。
- 定下的口径：**锁成功后发起人合单时不再让客户端付整单——钱已经在各成员账上扣出去了。只用 `placeOrder` 生成订单对象（不扣钱），发池，再调 `completeGroupOrder` 结算。**
- 账算得平的依据（集成实测，非推测）：`placeOrder` 不走月卡/券时 `deliveryFee = baseFee = max(3, round(subtotal × (feeMul−1)))`；`groupFee`（App.tsx:4936）是同一公式、同一平台（DELIVERY_PLATFORMS[0]，feeMul 1.1）、同一 subtotal（成员 subtotal 之和 = 合单菜品成本之和）→ `order.deliveryFee = groupFee`；`poolPayloadFor` 算 `riderFee = max(3, order.deliveryFee) = groupFee`；服务端 `groupOrderSplit` 把 `deliveryFee` 按 `floor(fee/n)`、余数归发起人拆，`feeToHost = groupFee`。所以发起人净付 = 自己那份 + riderFee − feeToHost = 自己那份；每人最终恰好付了自己的 `feeShare`；全团合计 = 菜钱 + groupFee = 整单应付。S 的 handler 冒烟已验算过同一笔账（发起人 897−25−10+10=872）。
- 新 `lockAndOrder`（App.tsx:4879，全文重写）：① `lockGroupOrder({ deliveryFee: groupFee })`，失败原样 toast return；② `placeOrder({ memberUntilDay: 0, 无 couponId })` 只生成订单对象，`pushOrder` 进本地列表，**不扣 `x.money`**；`placeOrder` 失败时（理论上不应发生）发起人调 `leaveGroupOrder` 取消整团退回托管，再 toast；③ `deliveryPoolPublish` 改 await 取 `poolId`（原 `publishDeliveryToPool` 是 fire-and-forget，拿不到 poolId；发池失败则 `poolId` 为 undefined，按无池单结算）；④ `completeGroupOrder({ poolId? })` 结算，失败 toast return（团仍锁着，2h TTL 到期全额退款兜底）；⑤ 清 `activeGroup` / `setGroup(null)`、toast、清购物车、关手机（沿用 solo 下单收尾）；⑥ 每周任务 order 事件**按发起人自己那份报**（`groupOrderTotals(r.group, groupFee)` 里发起人的 `total`），不是整单。
- 旧 `submitDeliveryOrder` 本身一字未动（solo 下单路径不受影响）。

### 3. escrow 字段名对齐（D 与 S 的口径差）
- D 先按 `escrow: "pending" | "held" | "settled" | "refunded"` 写（当时服务端日志还没出字段名）；服务端最终是 `escrowStatus: "none" | "held" | "released" | "refunded"` + `escrowTotal`。
- 集成把 delivery.ts 改成服务端形状：`GroupOrderEscrowStatus`（:1106）、`GROUP_ORDER_ESCROW_ZH`（:1109，none 待托管 / held 已托管 / released 已结算 / refunded 已退回）、`GroupOrderMember.escrowStatus?`（:1122）+ `escrowTotal?`（:1124）、`groupMemberEscrow` 默认 `"none"`（:1127）、`GroupOrderView.poolId?`（:1150）。snippet B 不用动（它只调 `groupEscrowLabel(m)`）。

### 4. 落地的 App.tsx 改动（共 6 处）
| 改动 | 行号（集成后实测） |
|---|---|
| import 追加 `afterMealRateEligible, rateOrder, groupEscrowLabel` | :45 |
| `rateDeliveryOrder`（紧贴 `eatDeliveryOrder` 之后） | :1646 |
| `spotsOf`：`p.slot <= 6` → `p.slot <= 13` | :3526 |
| `lockAndOrder` 重写（双重扣款口径） | :4879 |
| `groupTotals`（`groupFee` 之后算一次） | :4937 |
| 拼单卡片成员行：菜钱 + 平摊共计 + escrow 状态 | :4974 |
| 最近订单行：吃完打分星星（1–5）+ 已评显示 | :5025 |

### 5. Livehouse 打赏文案 ¥→✨（集成落地）
- `client/src/Livehouse.tsx`：toast :64、打赏区注释 :123、按钮 `✨{a}` :130、轮播"已收到打赏 ✨X" :140、收入区注释 :154、header :157（"最近 20 条，共 ¥X" → "累计 ✨X"，totalEarned 现为全量）、明细行 :158。
- `client/src/round2/delivery.ts`：打赏小节注释 :1061（creditMoney/writeLedger → bookStars/starLedger）、`LAGOS_GAP_CHECK` creator-payout note/next :1300–1302。
- 核查其余 ¥ 引用：activities.ts:292（代驾小费 ¥100）与 delivery.ts:848（骑手送达小费）是另外两个 ¥ 小费系统，与 Livehouse ✨ 打赏无关，不动。

### 6. 集成时修掉的 typecheck 错（1 个）
- `groupOrderTotals(r.group, groupFee)`：服务端回包的 `city` 在 API 客户端类型里是 `string`，不是 `CityKey` → 改成 `r.group as unknown as GroupOrderView`（与别处 `setGroup(g.group as unknown as GroupOrderView)` 同一写法）。修后 typecheck 0 错误。

## 二、验证结果（集成 agent，全部通过）

1. **typecheck**：`cd standalone && npm run typecheck`——**0 错误**（最终干净复核；中途 1 个错见 §一.6，已修）。
2. **vite build**：`cd standalone && npm run build`——**成功，8.50 秒**，index 1,954.24 kB（round-3 是 1,950.18 kB；+4 kB 来自打分星星 + escrow 显示 + lockAndOrder 重写）。
3. **服务器**：全新测试数据库 `.local-test/app-round3b.db` 启动，**HTTP 200**；迁移 0001–0021 依次应用成功（日志 `[db] applied 0021_round3b_server.sql`）；实测 `group_order_escrow` 表存在，`group_orders` 含 `pool_id`（TEXT）与 `locked_at`（INTEGER）列。
4. 旧服务器处理：启动新服务器前，先停了 01:09 启动的 round-3 验证服务器（PID 9081，DB app-round3.db，跑的是旧代码），确认端口空闲后再起新服务器。旧库 app-round3.db 未删。
5. 服务器留在运行状态：127.0.0.1:8787，DB `.local-test/app-round3b.db`，env PORT=8787 HOST=127.0.0.1 ADMIN_TOKEN=test-admin-token-1234 DEV_LOGIN_CODES=1 DEV_PAYMENTS=0 WEATHER=off。日志 `.local-test/server-round3b.log`。

## 三、没做成的事 / 已知残留

1. **浏览器验证未做**（§十一 (6)，不在本轮范围）：拼单锁→下单→结算、打赏 ✨ 余额变化、14 件家具进家、打分星星、蝴蝶/食堂光柱点，均需在真机/浏览器里点一遍。
2. **蝴蝶死 pin（其它公园）与食堂无布景**（H 日志 §二）：butterfly 点出现在全城所有公园，只有青青世界有对话；factory 食堂点在前场空地上，无食堂桌椅/窗口。需 parent 定夺是否另开任务。
3. **rate-5 防刷不在客户端**（D 日志 §五.5）：同一单评 5 星后 UI 收口，但服务端 `reportDeliveryQuest` 按调用次数记 progress；真要防刷得服务端按订单去重。
4. **拼单成员的每周任务 spend-100 不推进**：集成后 order 事件只按发起人自己那份报；其他成员那份（已托管）不会计入他们自己的"本周吃满 ¥100"。要修得成员客户端在拼单下单后也上报自己的 `total`（或服务端在 complete 时给各成员记 progress），不在本轮范围。
5. **迟到 30% 退款不按成员拆**、**锁后 2h TTL 是拍脑袋的数**、**商家无账号菜钱只能花掉**、**跨玩家扣款与心跳回写的固有张力**、**无事务包裹**、**打赏 1✨ 时音乐人入账 0**：照 S 日志 §7 原文，见 ROUND3B-CHANGELOG.md"没做成的事" 5–10 条。
6. **第 15 件家具仍丢弃**：14 槽位是设计上限。
7. **麻将 mp3 仍缺**（round-3 遗留）：cron `mahjong-sfx-retry-2` 定于 2026-11-12 09:00 PST 再试 SFXMint。

## 四、文件清单（本轮新增/改动，待推送）

| 文件 | 改动 |
|---|---|
| `ROUND3-CHANGELOG.md` | 新建（G，451 行）——round-3 的改动记录 |
| `ROUND3B-CHANGELOG.md` | 新建（int）——本轮改动记录 |
| `ROUND3B-LOG-S.md` / `-H.md` / `-D.md` / `-int.md` | 新建（各 worker + 集成） |
| `server/src/actions.ts` | S：publishHome/getHome 槽位、拼单 escrow、tipTrack ✨、totalEarned 全量 |
| `server/src/schema.ts` | S：`group_order_escrow` 表、group_orders +pool_id/locked_at、注释 ¥→✨ |
| `drizzle/0021_round3b_server.sql` | 新建（S） |
| `drizzle/meta/_journal.json` | S：加 idx 20 条目 |
| `client/src/round2/house.ts` | H：HOUSE_FURN_SLOTS 7→14 |
| `client/src/LifeStage.tsx` | H：FURN_SLOTS 7→14、ROAM_SPOTS.park +butterfly、ROAM_SPOTS.factory +canteen |
| `client/src/round2/delivery.ts` | D：打分函数 + escrow 客户端；int：escrow 字段对齐 + 打赏注释 |
| `client/src/App.tsx` | int：import、rateDeliveryOrder、星星行、groupTotals/成员行、lockAndOrder 重写、spotsOf ≤13 |
| `client/src/Livehouse.tsx` | int：打赏文案 ¥→✨（6 处） |

不推远端（parent 推）。不碰浏览器验证。
