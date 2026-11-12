# ROUND-3b LOG — 服务端 Agent S (2026-11-11)

只改服务端，不推远端，不碰浏览器，不碰客户端文件。分支 feature/round-2 @ 4bc5307b（本地 API 拉取副本，无 git）。
对应：ROUND3-LOG-int.md §十一“没做成的事”第 1、2、5、6 条（第 1 条盖房槽位、第 3 条拼单托管、第 5 条打赏 ✨、第 7 条 totalEarned 全量；int 日志的编号与本任务的 1–4 件一一对应）。

## 改了哪些文件（仅 4 个）

| 文件 | 改动 |
|---|---|
| `server/src/actions.ts` | 4 件事全部落地（见 §1–§4） |
| `server/src/schema.ts` | 新表 `group_order_escrow`（:935）；`group_orders` +`pool_id` / `locked_at`（:905–906）；`livehouse_tips` 注释 ¥→✨；`star_ledger.reason` 注释 +`livehouse-tip`（:293） |
| `drizzle/0021_round3b_server.sql` | 新建（见 §5） |
| `drizzle/meta/_journal.json` | 加 `idx 20` 条目（`when: 1795800000000`，`tag: "0021_round3b_server"`，照 0020 的 `when` 递进 +10 亿） |

没碰：`client/*`（一个字没动）、`drizzle/0019` / `drizzle/0020`、`.env`、`standalone/dist/`、任何 `.db` 文件（除新建的临时测试库，已删）、其他服务端端点。

## 1. 盖房槽位扩到 14

- `publishHome`（`actions.ts:1593`，请求 zod）：`slot` 上限 `max(6)` → `max(13)`，`layout` 数组 `.max(8)` → `.max(14)`。只改校验上限，存储形状没变（`homes.layout` 仍是 JSON 数组，`{id, slot}[]`）。
- `getHome`（`actions.ts:1613`，读侧同一存储）：`.slice(0, 8)` → `.slice(0, 14)`，否则服务端存了 14 件、读只回 8 件。
- 核对：`client/src/round2/house.ts` 的 `HOUSE_FURN_CATALOG` 确是 14 个真 id（sofa-fabric / sofa-leather / sofa-tatami / table-oak / table-marble / tv-cabinet / bed-double / wardrobe / desk / fridge / kitchen-cabinet / dining-table / washer / bathtub），只读核对、没改客户端。
- 端点形状不变：`publishHome { playerId, tier, style, layout: [{id, slot}] } → { ok }`；`getHome { pub } → { home: { tier, style, layout } | null }`。
- 客户端仍需自己改（不在本任务内）：`LifeStage.tsx` 的 `FURN_SLOTS`、`house.ts` 的 `HOUSE_FURN_SLOTS`、App `placedFurn` / `spotsOf` 的 slot ≤ 6 检查——服务端现在认 0–13，客户端不改仍只会发出 0–6。

## 2. 拼单真分账（escrow）

### 为什么新建表，没复用 tradeEscrow
照 trade escrow 的写法（`tradeEscrow` 表 + `creditMoney`/`writeLedger`，见 ROUND3-LOG-S.md §1）做的，但 `tradeEscrow` 只有一笔总金额、没有菜钱/配送费拆分列——结算时要把菜钱放给商家、配送费按骑手规则走，必须按成员拆 `foodAmount` / `feeAmount`，所以新建 `group_order_escrow`（见 §5）。`creditMoney` 的调用方式、compare-and-set 防重入、24h 陪审那套结算模式都照抄 trade escrow。

### 新表 `group_order_escrow`（`schema.ts:935`）
PK `(group_id, player_id)`（一团一人最多一行：只在 lock 时托管一次），列：`food_amount`（该成员菜钱小计 ¥）、`fee_amount`（该成员配送费分摊 ¥）、`amount`（= 两者之和，实际扣款）、`status`（`held | released | refunded`）、`created_at`、`released_at`。

### 内部函数（`actions.ts:1225–1315`，在 `GROUP_ORDER_VIEW` 附近）
- `GROUP_ORDER_ESCROW_STATUS_Z`（:1228）：`"none" | "held" | "released" | "refunded"`。
- `groupOrderSplit(members, deliveryFee)`（:1244）：**服务端镜像的 `groupOrderTotals`**——配送费平分 `floor(fee/n)`，余数归第 1 位成员（发起人，joinedAt 最早）。分摊只用服务端存的 `subtotal`，不信客户端报的数。
- `groupEscrowByPlayer(db, groupId)`（:1252）：读某团全部 escrow 行。
- `refundGroupEscrow(db, groupId)`（:1259）：把所有 `held` 行 compare-and-set 成 `refunded`，逐人 `creditMoney(+amount, "group order #id refund")` 全额退回。
- `settleGroupEscrow(db, groupId, hostId, poolId)`（:1279）：把所有 `held` 行 compare-and-set 成 `released`。菜钱 `food`：餐厅是 NPC（没有玩家账号），**released 即花掉**——钱已在 lock 时扣出，不再 credit 给任何人，和普通客户端 `placeOrder` 扣掉菜钱同一口径。配送费 `fee`：有 `poolId` 时逐人 `creditMoney(发起人, feeAmount)`（见下文“为什么补给发起人”）；无 `poolId` 时 NPC 骑手，released 即花掉。
- `GROUP_ORDER_LOCKED_TTL_MS = 2h`（:1239）：锁了 2 小时还没 complete 的团视为放弃。
- `groupOrderView`（:1295）：新增两条懒过期（照抄 `expirePoolOrders` 模式），读到即取消 + 全额退款：`open` 团过 `expiresAt`（30 分钟凑团期）；`locked` 团过 `lockedAt + 2h`。`getGroupOrder` / `lock` / `complete` / `leave` 都走它，所以过期退款不需要定时器。

### 为什么配送费有 poolId 时补给发起人（不是直接给骑手）
合单发到跑腿池时，发起人调 `deliveryPoolPublish` 已经又从自己账上托管了一份 `riderFee`；骑手那份钱由 `deliveryPoolDelivered` 按现有规则从池子的 `delivery` escrow 付（准时全额 / 迟到 70%，30% 退回发单人）。如果拼单托管的配送费再付给骑手，骑手费就付了两遍。所以 `completeGroupOrder` 带 `poolId` 时，各成员的 `feeAmount` 返还给发起人——发起人实付 = `riderFee − 其他成员的 fee 合计`，每人最终恰好付了自己的 `feeShare`（函数测试已验算，见 §6）。`deliveryPoolDelivered` 本身**没改**。
已知小偏差（见 §7）：迟到时池子退回的 30% 只退给发起人（池单的 customer 就是发起人），不按成员再拆一次。

### 改动的端点

**`lockGroupOrder`**（`actions.ts:5394`）——托管发生点
- 请求：`{ playerId, groupId: number, deliveryFee?: number (0–10000，默认 0) }`。**客户端必须传它在 `placeOrder` 里算出的同一份配送费**（`groupOrderTotals(g, fee)` 用的那个 `fee`），服务端用 `groupOrderSplit` 按同一算法拆；不传则只托管菜钱。
- 流程：先对**所有**成员做余额检查（`players.money`，服务端数），任何一人不够就**一分钱不扣**，返回 `ok: false` + `error`（点名 + 差多少，例：`"余额不够：阿穷 还差 ¥23（这单要 ¥53，只有 ¥30）。没扣任何人的钱。"`）+ 结构化 `shortfalls: [{ playerId, playerName, need, have, short }]`（全部不够的人都在里面，`error` 只写第一个 + “还有 N 人也不够”）。全员够 → 逐人 `creditMoney(-total, "group order #id escrow")` + 插 escrow 行（`held`），再 compare-and-set `open → locked`（+ `lockedAt`）。并发下只有一个 locker 赢：输的那方把本调用刚插的行原样退回（`refunded` + `creditMoney` 返还）。已托管过的成员重调不会重复扣（按已有 `held` 行跳过）。
- 返回：`{ ok, error?, group?: GroupOrderView | null, shortfalls? }`（group 与原来同形，成员多了 escrow 字段，见下）。
- **客户端集成注意（重要）**：锁成功后发起人合单时**不要再让客户端付整单**——钱已经在各成员账上扣出去了。E 片段的 `lockAndOrder` 里 `placeOrder` 的扣款分支必须跳过（只用它生成订单对象 / 发池），否则发起人付两遍。成员的客户端下次心跳会从 `bank.money` 看到扣款（沿用现有心跳回写口径，App.tsx:1984 已接 `bank.money`）。

**`completeGroupOrder`**（`actions.ts:5451`）——结算点，闭环语义不变（`locked → ordered`，仅发起人）
- 请求：`{ playerId, groupId: number, poolId?: string }`。`poolId` 是 `deliveryPoolPublish` 回的池单号（仅合单发到跑腿池时传）。
- 校验：池单存在、是发起人发的、餐厅与拼单一致、状态不是 `expired` / `cancelled`（已过期/取消的池单：骑手费已退回发起人，再结算会重复补，直接报错，托管留在原地等 2h TTL 退款）。
- 返回：`{ ok, error?, settlement?: { food: number, fee: number, feeToHost: number } }`——`food` 是菜钱合计（已 released 给 NPC 商家），`fee` 是配送费合计，`feeToHost` 是补给发起人的配送费（无 poolId 时为 0）。round-3 之前锁的团没有 escrow 行，`complete` 照旧成功（`settlement` 全 0），向后兼容。
- 锁过期（`lockedAt + 2h`）时调它会先懒取消并退款，返回 `"拼单已过期取消，托管已退回各成员。"`。

**`leaveGroupOrder`**（`actions.ts:5361`）——取消退款点
- 规则变了一处：原来锁后任何人都不能退；现在**发起人可以取消一个已锁定的团**（未下单前），整团 `cancelled` + `refundGroupEscrow` 全额退回；非发起人锁后仍不能退（`ordered` / `cancelled` 状态也不能退）。`open` 团的退出规则不变（发起人退 = 整团取消 + 退款；成员退 = 只退自己那行，正常情况下 open 团还没托管，退款是防御性的）。

**`getGroupOrder`**（`actions.ts:5346`，handler 未改逻辑，只跟视图走）——escrow 状态字段
- `GROUP_ORDER_VIEW`（:1229）新增：团级 `poolId: string | null`（合单发池后才有值）；每成员新增：
  - `escrowStatus: "none" | "held" | "released" | "refunded"`——**字段名就叫 `escrowStatus`**，客户端映射：`none` = 未托管（团还没锁）、`held` = 已托管（已锁，钱在托管里）、`released` = 已结算（complete 后）、`refunded` = 已退回（取消/过期）。
  - `escrowTotal: number`——该成员托管/结算/退回的总金额（菜钱 + 配送费分摊）；`none` 时为 0。
- 客户端的 `GroupOrderView` 类型（`delivery.ts`）没有这两个字段——服务端多回字段不破坏旧客户端，集成时客户端把 `escrowStatus` / `escrowTotal` 补进 `GroupOrderMember` 即可；`poolId` 同理是新增可选字段。
- 其余拼单端点不变：`createGroupOrder` / `joinGroupOrder`（只存组成，不动钱）。

## 3. 打赏改成 ✨

- 查清的 ✨ 记账方式：`bookStars(db, accountId, amount, reason, ref, allowNegative?)`（`actions.ts:560`）——往 `starLedger` 追加一行，`(reason, ref)` 唯一防重记，余额不足（不允许负）返回 `false`。`storeState`（:2317）读 `starBalance` 展示余额；`createOrder`（:2354）只建 Stripe 订单，`fulfilOrder`（:583）收款后才 `bookStars(+stars, "purchase", orderId)`；`buyLook`（:2422）是现成的扣 ✨ 模板：`bookStars(acc.id, -SHOP[..].stars, "shop", ref)`，余额不足报 `"✨ 不够"`。打赏照 `buyLook` 的写法。
- `tipTrack`（`actions.ts:5206`）：两次 `creditMoney`（¥）全部换掉——
  - 打赏人：`bookStars(me.accountId, -amount, "livehouse-tip", ref)`，`ref = "livehouse-tip:<randomUUID>"`，每条打赏唯一，不会重记；
  - 音乐人：`bookStars(t.accountId, creatorShare, "livehouse-tip", "<ref>:creator")`，`creatorShare = floor(amount × 0.7)` 不变；
  - 音乐人入账失败时把打赏人的 ✨ 原路退回（`bookStars(+amount, "livehouse-tip", "<ref>:refund")`）再报错，不吞钱。`creatorShare === 0`（打赏 1✨）时跳过音乐人入账（0 不记账），打赏人照付。
- 新增前置校验：打赏人必须绑定账号（`me.accountId` 为空 → `"打赏要用 ✨，先绑定账号（右上角 👤 账号）再打赏。"`）——✨ 在账号账本上，不在玩家 ¥ 账本上，游客没有 ✨ 可扣。余额预检用 `starBalance`，不足报 `"✨ 不够打赏。"`。
- 其余规则不变：歌须 `approved`、音乐人须已进游戏、不能打赏自己、每人每天最多 10 次（仍数 `livehouse_tips` 行）。
- **表没动**：`livehouse_tips.amount` / `creator_share` 继续存数字，单位从 ¥ 变成 ✨（schema.ts 注释已改）。
- 请求/返回形状不变：`tipTrack { playerId, trackId, amount (1–500，现为 ✨), message? } → { ok, error?, creatorShare?, creatorName? }`。
- feed 文案 `¥` → `✨`（`actions.ts:5241`）。
- **客户端文案待改（只记下来，本任务没改客户端）**：`Livehouse.tsx` 打赏按钮的 `¥10/30/88`（`TIP_AMOUNTS`）、打赏成功 toast（`"已打赏 ¥X，…收到 ¥Y（七成）"`）、音乐人收入区（`getLivehouseTips` 的 mine + totalEarned）与轮播“已收到打赏 ¥X”里的 `¥` 字样，集成时都要改成 `✨`；`delivery.ts` 的 `TIP_AMOUNTS` / `tipCreatorShare` 注释里“¥”同理。客户端不用改请求（`amount` 字段名、范围都不变），只改展示单位。

## 4. `getLivehouseTips.totalEarned` 改全量

- `getLivehouseTips`（`actions.ts:5247`）：`totalEarned` 从 `rows.reduce(...)`（最新 20 条）改成一次 SQL 聚合：`select sum(creator_share) from livehouse_tips where creator_id = ?`（无行时 `sum` 为 NULL → 0）。没扫全表行。
- `mine` 仍只返回最新 20 条不变；`totals`（全城每首歌 `sum(amount)` + `count`）不变。单位现为 ✨（随第 3 件）。

## 5. 迁移 0021 内容（`drizzle/0021_round3b_server.sql`，新建）

```sql
CREATE TABLE `group_order_escrow` (
	`group_id` integer NOT NULL,
	`player_id` text NOT NULL,
	`food_amount` integer NOT NULL,
	`fee_amount` integer NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'held' NOT NULL,
	`created_at` integer NOT NULL,
	`released_at` integer,
	PRIMARY KEY(`group_id`, `player_id`)
);
--> statement-breakpoint
ALTER TABLE `group_orders` ADD COLUMN `pool_id` text;
--> statement-breakpoint
ALTER TABLE `group_orders` ADD COLUMN `locked_at` integer;
```

格式照 0020（`--> statement-breakpoint` 分隔）。0019 / 0020 没动。`pool_id` / `locked_at` 旧行均为 NULL：旧团 `poolId` 读作 null，`lockedAt` 为空的锁团不触发 2h TTL（只对 round-3b 起锁的团生效，旧锁团行为不变）。

## 6. 验证结果（全部通过）

1. **typecheck**：`cd standalone && npm run typecheck`（`tsc --noEmit`）——**0 错误**（最终干净复核；中途一次 2 个错只是临时测试文件 `round3b-func-test.tmp.ts` 自身的 TS 错误，已随文件删除，不在正式代码里）。
2. **迁移实测**：`/tmp` 临时库，按 `standalone/server.ts` 的切分逻辑（`--> statement-breakpoint`）依次应用 0001–0021——**通过**（`group_order_escrow` 表存在，`group_orders` 含 `pool_id` / `locked_at`，插一行 escrow 成功；`SELECT sum(creator_share)` 验算 7+21+61=89 正确；临时库已删）。
3. **端到端冒烟（额外做的，不在任务要求内）**：直接调真实 handler（临时 tsx 脚本 + 临时库，未启动正式服务器，脚本与库事后都删了）——全部符合预期：
   - `publishHome` 14 件 slot 0–13：`{ok:true}`。
   - 拼单 3 人（菜钱 100/50/60，配送费 9）：余额不足的成员锁单失败，`error` 点名“阿穷 还差 ¥23”，`shortfalls` 齐全，**三人余额一分没动**（1000/30/500）；补足后锁定成功，各成员 `escrowStatus: held`（103/53/63），余额 897/47/437；`complete`（无 poolId）结算 `{food:210, fee:9, feeToHost:0}`，行变 `released`，余额不变。
   - 发起人取消已锁团：`ok:true`，两成员全额退回（897/437），行变 `refunded`。
   - 锁团 TTL：把 `locked_at` 拨回 3 小时前再读，团变 `cancelled`、成员 `refunded`、余额恢复。
   - 带 poolId 结算：锁（配送费 10）→ `deliveryPoolPublish`（riderFee 10）→ `completeGroupOrder(poolId)` 结算 `{food:50, fee:10, feeToHost:10}`，发起人余额 872（= 897−25 锁 −10 发池 +10 返还）、成员 402，池单 escrow 仍在原地等 `deliveryPoolDelivered` 按现有规则付骑手；`getGroupOrder` 的 `poolId` 回显池单号。
   - 打赏：30✨ → `creatorShare 21`，打赏人 ✨ 100→70、音乐人 ✨ 0→21，双方 ¥ 余额纹丝不动（100/100）；无绑定账号的玩家打赏被拒（`"打赏要用 ✨，先绑定账号…"`），¥ 不动。
   - `getLivehouseTips`：再插 25 条 `creatorShare=1` 后 `totalEarned=46`（21+25，全量），`mine.length=20` 不变。
4. 未启动正式服务器，未跑 `vite build`（不是本任务）。

## 7. 没做成的事 / 已知限制和原因

- **客户端接线没做**（不在本任务内）：拼单 UI 需接 `escrowStatus` / `escrowTotal` / `poolId` 展示、`lockGroupOrder` 传 `deliveryFee`、锁后跳过 `placeOrder` 的整单扣款、打赏文案 `¥`→`✨`（见 §2、§3）；盖房客户端槽位（`FURN_SLOTS` / `HOUSE_FURN_SLOTS` / slot ≤ 6 检查）也需另有人改，否则服务端认 14 件也发不出去。
- **商家没有玩家账号，菜钱只能“花掉”**：餐厅是 NPC，`settleGroupEscrow` 的菜钱 released 即出账、不 credit 给任何人——和普通 `placeOrder` 扣菜钱同一口径。真要“付给商家”得先有商家账号体系，本轮没有。
- **迟到 30% 退款不按成员拆**：池单迟到时 `deliveryPoolDelivered` 按现有规则把 30% 退给池单 customer（= 发起人），不按各成员的 `feeShare` 再拆一次。金额小且与单人池单语义一致，留作后续可选。
- **锁后 2h TTL 是拍脑袋的数**：发起人锁了不 complete，钱最长压 2 小时（期间发起人可 `leaveGroupOrder` 主动取消退款）。如需更短/更长，改 `GROUP_ORDER_LOCKED_TTL_MS` 一行。
- **跨玩家扣款与心跳回写的固有张力**：`creditMoney` 同时改 `money` 与 `reportedMoney`，成员客户端下次心跳以旧钱数上报时，`settleMoney` 的 earn 口径可能把一部分托管当“收入”补回（上限为 earn budget）——这是 trade/delivery escrow 早就有的同一模式，不是本轮引入的；现有约定是客户端采纳心跳回的 `bank.money`（App.tsx:1984），成员在线时扣款会正常落账。彻底修要改全局 `settleMoney`，不在本轮范围。
- **无事务包裹**：与现有代码一致（`tradeEscrow` / `deliveryPoolPublish` 同样是顺序 await + compare-and-set，没有显式事务）。锁单用“先全员验资、再逐人扣款、最后 CAS 上锁 + 输方退款”兜底；中途进程崩溃留下半托管时，`lock` 不可重调，但 2h TTL 到期会全额退款，钱不会丢。
- **浏览器验证未做**：拼单锁→下单→结算、打赏 ✨ 余额变化、14 件家具进家，均需在真机/浏览器里点一遍；typecheck + 迁移 + handler 冒烟只证明服务端逻辑正确。
