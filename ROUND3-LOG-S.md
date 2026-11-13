# ROUND-3 LOG — 服务端 Agent S (2026-11-11)

只做服务端，不推远端，不碰浏览器。分支 feature/round-2 @ 4bc5307b。
对应审计：`~/workspace/goals/shenhui-life-sim-launch/files/round-2-omissions-audit-2026-11-11.md` 缺口 1、2 和第六节小注。

## 1. 买卖纠纷陪审（缺口 1）——已做

现状：`disputeTradeTask` 只冻结 escrow，冻结的钱出不来。现在陪审团能把它放出来。

### 陪审规则（照搬已有模式）
- 窗口 24 小时，从申诉时间起算（`juryVote` 的 gig 是 24h、`settleBlackReports` 是 24h）。
- 同城陪审：任务 city 不是 `any` 时只有同城玩家能投票（`juryVote` / `blackReportVote` 同款）。
- quorum 3 票；多数获胜；平局或不足 3 票 = `expired`（`settleBlackReports` 同款）。
- 一人一票、可改票到结案；当事人不能投票；投票要绑账号（`socialNeedsAccount()` 时）。
- **一个有意的偏离**：黑举报 `expired` 是“什么都不发生”，但交易纠纷不能这样——钱会永远冻住。所以 `expired` 时 escrow **退回付款人**。这是本次修复的核心语义，客户端文案请按“陪审团没凑够票 / 打平，托管的钱退回给你”写。

### 新端点

**`tradeDisputeVote`**（`server/src/actions.ts:3844`）
- 请求：`{ playerId, taskId: string, side: "seller" | "buyer" }`
  - `seller` = 把冻结的 escrow 放给卖方；`buyer` = 退回给付款人。
- 返回：`{ ok, error?, votes?: { seller: number, buyer: number } }`
- 前置：先结算所有到期的纠纷（已结案的投不了票）。

**`adjudicateTradeDispute`**（`server/src/actions.ts:3867`）
- 请求：`{ playerId, taskId: string }`（交易任务 id，不是纠纷 id——纠纷没有独立 id，`caseId` 就是 `trade-<taskId>`）。
- 返回：`{ ok, error?, task?, verdict?: "seller" | "buyer" | "expired", votes?: { seller, buyer }, releasedTo?, releasedAmount?, refunded?, dueAt? }`
  - 未到 24h：`ok: false`，error “陪审团还在投票，24 小时后再来结算。”，附 `votes` + `dueAt`（ISO）。
  - 已结案：返回记录的 `verdict` 和当时动了多少钱（`releasedAmount` / `refunded`，无托管时为 0）。可重复调用，只读。
  - 任何人都可以触发结算（确定性 + compare-and-set 单次放款防重入），不只限当事人。
- 放款规则与 `completeTradeTask` 一致：sell 单 → 贴主，否则 → 接单人；0% 手续费。退款对象是 `tradeEscrow.payerId`（即 `escrowFromId`）。
- 结案后任务状态回到 `completed`（卖方胜）或 `cancelled`（买方胜 / expired），**不引入新状态值**，客户端 `TradeTaskStatus` 不用改；裁决记录在 `tradeTask` 的新增字段里（见下）。

### 内部函数
- `settleTradeDisputes(db)`（`actions.ts:1032`）：关闭所有到期纠纷并动钱。compare-and-set（`WHERE status = 'disputed'`）防并发双倍放款。结算前先在 `getTradeTasks`（`:3651`）、`getMyTradeTasks`（`:3912`）、`tradeDisputeVote`、 `adjudicateTradeDispute` 里调用——照抄 `settleBlackReports` / `settleGigs` 的挂法。
- `tradeDisputeTallies(db, taskId)`（`actions.ts:1025`）：计票。

### `disputeTradeTask` 的改动（`actions.ts:3822`）
- 申诉时多写两个字段：`disputedAt`（陪审 24h 起点）和 `disputeFromStatus`（申诉前是 `accepted` 还是 `completed`）。
- 补充说明：已完成后申诉的单，裁决只记录 `verdict`，状态保持 `completed`（货已交、钱已放，无钱可退）——靠 `disputeFromStatus` 区分，否则“已完成被判买方胜”会被误写成 `cancelled`。
- 若 escrow 行意外缺失（正常流程不会发生），结算仍按 `escrowHeld` 给胜方/付款人放款/退款，钱不会凭空消失。

### `tradeTaskShape` / `tradeTaskView` 新增可选字段（`actions.ts:1078-1090`）
- `disputeReason?: string`、`disputeVerdict?: "seller" | "buyer" | "expired"`、`disputeDueAt?: string`（ISO，陪审截止时间）。旧客户端忽略即可。

### 新增表 + 改动列
- 新表 `trade_dispute_votes`（`task_id`, `voter_id`, `side`, `created_at`，PK `(task_id, voter_id)`）——**不能复用现有陪审表**：`gig_votes` 键在 `gigId`，`black_report_votes` 键在 `reportId`，都装不下 trade task。
- `trade_tasks` 新增 4 列（`schema.ts:617-620`，迁移 `0020`）：`disputed_at`、`dispute_from_status`、`dispute_verdict`、`dispute_settled_at`。旧的已申诉行这 4 列为 NULL，结算时按 `createdAt + 24h` 计到期（`settleTradeDisputes` 里 `disputedAt ?? createdAt`）。

## 2. 警察巡逻服务端（缺口 2）——已做

现状：`server/src/actions.ts` 无这三个端点；`client/src/round2/police.ts:80` 的 `watchers` Map 只是本机内存。现在巡逻和监视是数据库行，跨会话可见。

### 新表
- `patrols`（`officer_id` PK, `city`, `started_at`）：一人一个在岗巡逻。
- `patrol_watches`（`officer_id`, `target_id`, `note`, `city`, `started_at`，PK `(officer_id, target_id)`）：一条观察记录。
- 不存任何真实身份：只有游戏内 id + 备注（备注过 `cleanText`，≤200 字）。

### 新端点

**`startPatrol`**（`actions.ts:4680`）
- 请求：`{ playerId, city: "sz" | "hz" | "hk" }`；只能在自己所在的城市巡逻（`cityKey` 不符报错）。
- 返回：`{ ok, error?, patrol?: { officerId, officerName, city, since: ISO } }`
- 重复开始 = 刷新（换城市 / 续期），已有观察记录保留。

**`observe`**（`actions.ts:4712`）
- 请求：`{ playerId, targetId: string (≤48), note?: string (≤200) }`
- 返回：`{ ok, error?, watch?: { officerId, targetId, note, city, startedAt: ISO } }`
- 校验（照抄 `police.ts` 的 `observe` + `isGameAvatarId`，服务端镜像在 `actions.ts:1201`）：必须在岗巡逻；`targetId` 必须是小写 slug（字母数字 `-` `_`，不含 7 位以上连续数字，拒绝邮箱/电话/真名）；不能观察自己；同一个人不能重复观察；已知玩家目标必须在巡逻城市内，NPC slug（不在 players 表里）只按 slug 规则放行——**服务端没有 data.ts 的 NPC 注册表，无法校验 NPC id 是否真实存在**，这是已知限制。
- 观察记录的 `city` 取巡逻城市。

**`getWatchers`**（`actions.ts:4751`）
- 请求：`{ playerId }`（被监视的玩家查自己）。
- 返回：`{ ok, error?, watchers: [{ officerId, officerName, officerEmoji, note, city, startedAt: ISO }] }`，按开始时间倒序。
- **故意不做 banned 检查**：被禁言/封禁的玩家仍然有权看到谁在看他——监视绝不能对被监视者保密（`police.ts` 规则 2）。

### 任务只要求三个端点，多加的两个（有原因）
- **`stopPatrol`**（`actions.ts:4698`）：`{ playerId }` → `{ ok }`。结束巡逻并同时删掉它开的所有观察（照抄客户端 `stopPatrol` 的语义）。没有它，巡逻只能等过期。
- **`stopObserving`**（`actions.ts:4738`）：`{ playerId, targetId }` → `{ ok }`。停看一个人。
- 另有 TTL 兜底：巡逻 6 小时后过期（`PATROL_TTL_MS`，`actions.ts:1198`），每次巡逻读写时懒清理（`expirePatrols`，`:1207`），过期巡逻的观察一并删除。

### 内部函数
- `isGameAvatarId(id)`（`actions.ts:1201`）：服务端镜像，规则与客户端 `police.ts` 完全一致。
- `expirePatrols(db)`（`:1207`）、`activePatrol(db, officerId)`（`:1215`）。

## 3. `reportLandlord` 死端点——已删

- **决定：删除端点，不接进 (d) 流程。**
- 核查：全仓 grep 只有三处引用——服务端端点本身（`actions.ts:4521`，已删）、`client/src/round2/lifestyles.ts:557` 的 `reportLandlordIntent()`（只返回 `{ action: "reportLandlord", reason }` 的意向对象，全仓无调用点）、`lifestyles.ts:1141` 的 `LIFESTYLE_SERVER_SPEC` 表（文档性说明）。**App.tsx 从不调用**，(d) 举报流程走 `fileBlackReport`。删除无调用方。
- 该端点本身还有个潜 bug：请求里有 `target: "landlord" | "employer"`，但 handler 写死 `kind: "landlord"`，employer 举报也会被当成房东——删掉比修掉干净。
- 无表可删：它只复用 `fileBlackReportInner` 写 `black_reports`，没有自己的表。
- 客户端的 `reportLandlordIntent` 和 spec 表条目是客户端文件，不在本任务可改范围内，留给客户端接线 agent 清理（它们不产生服务端调用，留着无害）。

## 4. 没动的东西
- **`courseDay` / `trialDay` 未动**：审计第六节已说明是故意不调用的有据决定（lifestyles 的钱仍是客户端算），按任务要求没“修”。
- `client/*`、`.env`、`standalone/dist/`、`~/workspace/ts-spaces/`、任何 `.db` 文件均未碰。
- 服务器未启动，未跑 `vite build`。

## 改了哪些文件
- `server/src/actions.ts`：新增 `TRADE_JURY_MS` / `TRADE_JURY_QUORUM` / `tradeDisputeTallies` / `settleTradeDisputes`（:1022-1078）、`tradeTaskShape` + `tradeTaskView` 三个可选字段（:1078-1090）、警察 helpers `PATROL_TTL_MS` / `isGameAvatarId` / `expirePatrols` / `activePatrol`（:1192-1221）、`getTradeTasks` + `getMyTradeTasks` 挂结算（:3651、:3912）、`disputeTradeTask` 加 `disputedAt`/`disputeFromStatus`（:3822）、新增 `tradeDisputeVote`（:3844）+ `adjudicateTradeDispute`（:3867）、删除 `reportLandlord` 并在原位放警察端点 `startPatrol` / `stopPatrol` / `observe` / `stopObserving` / `getWatchers`（:4680-4771）。
- `server/src/schema.ts`：`trade_tasks` +4 列（:617-620）；新表 `tradeDisputeVotes`（:853）、`patrols`（:865）、`patrolWatches`（:870）。
- `drizzle/0020_round3_server.sql`（新建，30 行）：格式照 `0019`，含 3 个新表 + 4 条 `ALTER TABLE trade_tasks ADD COLUMN`。
- `drizzle/meta/_journal.json`：加 `idx 19` 条目（`when: 1795700000000`，`tag: "0020_round3_server"`，照 `0019` 的 `when` 递进 +10 亿）。

## 验证
- `cd standalone && npm run typecheck`（`tsc --noEmit`）：**0 错误**。
- 迁移实测：在 `/tmp` 临时库上按 `standalone/server.ts` 的切分逻辑依次应用 `0019` + `0020`，**通过**（三张新表存在、`trade_tasks` 四列存在、可插 `trade_dispute_votes` / `patrol_watches` 行；临时库已删）。
- 未做浏览器验证（任务不要求，且无浏览器）。

## 没做成的事 / 留给客户端接线 agent 的事
- 客户端接线未做（不在服务端任务内）：`tradeDisputeVote` / `adjudicateTradeDispute` 需接进交易纠纷 UI（陪审投票入口、24h 倒计时 `disputeDueAt`、裁决结果 `verdict` / `releasedAmount` / `refunded` 的展示）；`startPatrol` / `observe` / `getWatchers` / `stopPatrol` / `stopObserving` 需替换 `police.ts` 的本机内存实现；`getWatchers` 需轮询或在进地图时拉一次，驱动 👁️ 徽章。
- `adjudicateTradeDispute` 是“触发结算 + 返回结果”，不是自动定时器：若没有任何玩家调用它且没人打开交易板，到期纠纷会在下一次 `getTradeTasks` / `getMyTradeTasks` / `tradeDisputeVote` / `adjudicateTradeDispute` 调用时才结算——与黑举报（`getBlackReports` 里结算）同一模式。如需严格准时，可另起定时任务扫 `settleTradeDisputes`。
- 服务端无法校验 NPC 目标 id 是否真实存在（见 observe 一节）；如需严格校验，客户端接线时应只传 `data.ts` 里有的 NPC id。
- 巡逻 TTL 6 小时是拍脑袋的数：巡逻中途过期会丢掉观察记录；如客户端希望巡逻跟随在线状态，应在心跳里调 `startPatrol` 刷新，或把 TTL 改短/改长。
