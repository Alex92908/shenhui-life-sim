# ROUND-3B LOG — 外卖客户端 Agent D（2026-11-11）

只改本地，不推远端，不碰浏览器，不碰服务端文件，不碰 App.tsx（App.tsx 只出 snippet）。
工作目录 `~/workspace/shenhui-life-sim/`，分支 feature/round-2 @ 4bc5307b（本地 API 拉取副本，无 git）。

任务来源：int 日志 §十一第 2、3 条（rate-5 无触发点；拼单不托管钱）+ E 日志 §1(c)(d)、§4 片段 3/4、§6。

## 结果总览

两件事的客户端一半都做完了（只改 `client/src/round2/delivery.ts` 一个文件）：

1. **每周任务打分入口（rate-5）**：delivery.ts 补了 `afterMealRateEligible` / `RATE_QUEST_STARS` / `rateAdvancesQuest` / `rateOrder`；App.tsx snippet（片段 A）把 1–5 星打分按钮放在外卖页“最近订单”行上（吃完后自然看到），点星后调 `rateOrder` + 5 星时调 `reportDeliveryQuest({ event: "rate", stars })`，上报后刷新每周任务卡。
2. **拼单 escrow 客户端**：`GroupOrderMember` 加了可选 `escrow` 状态字段 + `groupMemberEscrow` / `groupEscrowLabel` / `GROUP_ORDER_ESCROW_ZH`；`groupOrderTotals` 保持原样（只算数，不扣钱）；App.tsx snippet（片段 B）在拼单卡片上显示每人 escrow 状态，锁定失败时服务端错误原样 toast（该行 App.tsx 里本来就有，snippet 只确认不改）。

---

## 一、改了哪些文件和行号（只改一个文件）

| 文件 | 改动 | 行号 |
|---|---|---|
| `client/src/round2/delivery.ts` | 新增“吃完打分 → 每周任务 rate-5”小节：`afterMealRateEligible`、`RATE_QUEST_STARS`、`rateAdvancesQuest`、`rateOrder`（含注释，说明服务端规则） | :1016–1045（`afterMealRateEligible` :1026、`RATE_QUEST_STARS` :1031、`rateAdvancesQuest` :1033、`rateOrder` :1039） |
| `client/src/round2/delivery.ts` | 拼单小节注释更新：托管是服务端的事，客户端只算数、只展示（原注释“钱不走 server 托管”已过时） | :1083–1093 |
| `client/src/round2/delivery.ts` | `GroupOrderEscrowStatus` 类型 + `GROUP_ORDER_ESCROW_ZH` 中文映射 + `GroupOrderMember.escrow?` 可选字段 + `groupMemberEscrow` + `groupEscrowLabel` | :1107–1134（类型 :1107、映射 :1109、字段 :1123、`groupMemberEscrow` :1127、`groupEscrowLabel` :1132） |
| `client/src/round2/delivery.ts` | `LAGOS_GAP_CHECK` 两条 note/next 更新：group-order 与 retention-loop 指向本日志的片段 B / A | group-order note :1316、retention-loop next :1325 |

没碰：App.tsx、Livehouse.tsx、server/*、drizzle/*、其余 `client/src/round2/*`、.env、任何 .db 文件。

### 核对过的服务端规则（E 日志 §1(d)，`server/src/actions.ts:5353` reportDeliveryQuest）

- `rate` 事件且 `stars === 5` → rate-5 记 1；1–4 星不推进任务。
- 所以客户端封装 `rateOrder` 的约定：1–5 星都调 `rateRestaurant` 本地记分（≥4 星还照旧收藏店铺），只有 5 星才 `advancesQuest === true`，调用方（App.tsx snippet A）据此决定调不调 `reportDeliveryQuest`。**1–4 星不调 reportDeliveryQuest**（调了服务端也不记数，白白占 10 次/分钟限流）。

### 服务端 escrow 现状（实测，非推测）

- 本轮工作时服务端**还没有**拼单 escrow：`server/src/actions.ts:1225-1231` 的 `GROUP_ORDER_VIEW` 成员只有 `playerId / playerName / items / subtotal / joinedAt`，无 escrow 字段；`lockGroupOrder`（:5288-5305）只改 `status` open→locked，**不从成员余额扣钱**；全仓 grep `escrow` 只有交易纠纷（trade escrow）相关，无 group-order escrow。
- 因此客户端先按任务给定的形状写：`escrow: "held" | "settled" | "refunded" | "pending"`，字段为**可选**（`escrow?: GroupOrderEscrowStatus`），服务端没返回该字段时 `groupMemberEscrow` 默认 `"pending"`（待托管），绝不默认成“已托管”。
- **字段名待与服务端日志对齐，集成时以服务端为准。**服务端 agent 的日志还没写出字段名；如果服务端最终用的不是 `escrow` 这个字段名（例如 `escrowStatus` / `escrow_state`），集成 agent 只需改 delivery.ts 里 `GroupOrderMember.escrow` 的字段名 + `groupMemberEscrow` 的读取处，App.tsx snippet B 不用动（它只调 `groupEscrowLabel(m)`）。

---

## 二、片段 A — 吃完打分入口（App.tsx snippet，不改 App.tsx）

### 实测锚点（2026-11-11 实测行号，`client/src/App.tsx`）

- `submitDeliveryOrder`：App.tsx:1610（成功分支内 :1627-1630 已有 order 事件上报 + `getWeeklyQuests` 刷新——片段 A 复用同一写法）。
- `eatDeliveryOrder`：App.tsx:1631-1648；其中 `eatDelivered(o)` 在 :1634，`updateOrder(d, { ...o, stage: "eaten" })` 在 :1640，吃完 toast 在 :1646。
- **关键发现**：吃完后 `updateOrder` 会清掉 `activeOrderId`（delivery.ts 的 `updateOrder`，stage eaten → activeOrderId undefined），所以顶部“当前订单”卡片（App.tsx:4893-4899，含 :4897 的“🍽️ 开吃”按钮）在吃完后就消失了——**打分按钮不能放在当前订单卡片上**，否则用户吃完就看不到它。
- **正确锚点**：“最近订单”历史列表 App.tsx:4973（`{d.orders.slice(0, 5).map((o) => (` 之后那行）。吃完的单子以“已吃完”出现在这里，是用户吃完饭自然会看到的地方；已送达未吃的单子在这里显示“已送达 + 开吃”。
- `rateRestaurant`（delivery.ts:999）在 App.tsx 里从未被调用、App.tsx:45 的 import 行里也没有它——核实与 int 日志 §十一第 2 条一致。

### A1 — import（锚点 App.tsx:45，delivery import 行，追加两项）

```tsx
// App.tsx:45 的 delivery import 行追加：afterMealRateEligible, rateOrder
// （rateRestaurant 不用直接 import，rateOrder 内部已调它；RATE_QUEST_STARS 只在 delivery.ts 内部用，不用 import）
import { advanceOrder, cancelOrder, courierTodaySummary, deliveryMenu, eatDelivered, emptyDeliveryState, generateCourierBoard, isDeliveryState, placeOrder, poolOrderToGig, poolPayloadFor, pushOrder, updateOrder, activeOrder, acceptGig, pickupGig, deliverGig, cancelGig, fmtDeliveryCountdown, MEMBERSHIP_PRICE, MEMBERSHIP_DAYS, membershipActive, mergeSponsoredMenu, groupOrderTotals, mergeGroupItems, groupOrderShareText, WEEKLY_QUESTS, weeklyQuestState, grantWeeklyCoupon, afterMealRateEligible, rateOrder, type CourierGig, type CustomerOrder, type DeliveryState, type MenuItem, type SponsoredRestaurant, type GroupOrderView, type GroupOrderItem, type WeeklyQuestProgress } from "./round2/delivery";
```

### A2 — 打分 handler（锚点 App.tsx:1631 的 `eatDeliveryOrder` 之后，紧贴着放）

```tsx
// round-3b (D): 吃完打分 → 每周任务 rate-5。1–5 星都本地记分；只有 5 星上报服务端。
const rateDeliveryOrder = async (orderId: string, stars: number) => {
  if (!profile) return;
  const s0 = gsRef.current; if (!s0?.delivery) return;
  const o = s0.delivery.orders.find((x) => x.id === orderId); if (!o) return;
  if (!afterMealRateEligible(o)) return; // 已评过、或还没送达的单不让评
  const { state: next, advancesQuest } = rateOrder(s0.delivery, orderId, stars);
  mutate((x) => { x.delivery = next; });
  if (!advancesQuest) { showToast(`已给 ${o.restaurantName} 打 ${stars} 星。`); return; }
  // 服务端规则（E 日志 §1(d)）：只有 stars === 5 才给 rate-5 记 1。
  void api.reportDeliveryQuest({ playerId: profile.playerId, event: "rate", stars })
    .then(() => {
      // 复用 int 日志 §五片段 4 / submitDeliveryOrder :1627-1630 的刷新写法
      api.getWeeklyQuests({ playerId: profile.playerId }).then((w) => { if (w.ok) setWeekly({ weekKey: w.weekKey, quests: w.quests }); }).catch(() => {});
    })
    .catch(() => {});
  showToast("五星好评已记下，本周任务进度更新了！");
};
```

### A3 — 订单历史行上的星星（锚点 App.tsx:4973，原行全文替换）

```tsx
// 原行（App.tsx:4973）：
// <p key={o.id} className="mt-1 text-xs">{o.restaurantName} · {fmt(o.total)} · {o.stage === "eaten" ? "已吃完" : o.stage === "delivered" ? "已送达" : "进行中"}{o.stage === "delivered" ? <button type="button" onClick={() => eatDeliveryOrder(o.id)} className="ml-2 font-black text-[var(--accent)]">开吃</button> : null}</p>
// 替换为：
<p key={o.id} className="mt-1 text-xs">{o.restaurantName} · {fmt(o.total)} · {o.stage === "eaten" ? "已吃完" : o.stage === "delivered" ? "已送达" : "进行中"}{o.stage === "delivered" ? <button type="button" onClick={() => eatDeliveryOrder(o.id)} className="ml-2 font-black text-[var(--accent)]">开吃</button> : null}
  {afterMealRateEligible(o) && <span className="ml-2">打分：{[1, 2, 3, 4, 5].map((n) => (
    <button key={n} type="button" aria-label={`打${n}星`} onClick={() => void rateDeliveryOrder(o.id, n)} className="px-0.5 text-sm leading-none text-amber-500">★</button>
  ))}</span>}
  {o.rated !== undefined && <span className="ml-2 text-amber-500">已评 {"★".repeat(o.rated)}{"☆".repeat(5 - o.rated)}</span>}
</p>
```

说明：

- 星星只在 `afterMealRateEligible(o)` 为真时出现，即 stage 为 delivered/eaten 且没评过；评过一次就变成“已评 ★★★★★”文字，不可改分（`rateRestaurant` 本身允许多次改分，但 UI 上一次评完即收口，避免反复刷 report——服务端 rate 事件有 10 次/分钟限流，但不防重复 5 星；真要防刷得服务端按订单去重，见 §五）。
- 没在顶部当前订单卡片（:4893-4899）放星星：吃完后那张卡片消失（见上文锚点发现）；也没藏进 toast 里——toast 3 秒就没了，历史行一直都在。
- 没动 `eatDeliveryOrder` 本身：吃完 toast（:1646）后用户低头就能在同一页的历史行看到星星。

---

## 三、片段 B — 拼单 escrow 客户端（App.tsx snippet，不改 App.tsx）

### 实测锚点（2026-11-11 实测行号，`client/src/App.tsx`）

- `lockAndOrder`：App.tsx:4861-4870；其中锁定失败分支在 :4864：`if (!r.ok || !r.group) { showToast(r.error ?? "锁定失败"); return; }`。
- 拼单卡片成员行：App.tsx:4924：`{group.members.map((m) => <p key={m.playerId} className="mt-1 text-xs">{m.playerName}：{m.items.map((i) => `${i.name}×${i.qty}`).join("、")}（¥{m.subtotal}）</p>)}`。
- 平摊行：App.tsx:4925（`groupOrderTotals(group, groupFee)` 内联调用）；`groupFee` 定义在 :4888。
- `groupOrderTotals` 未改动：只算数（每人菜钱小计 + 配送费平摊，余数归发起人），不扣钱、不写账——托管是服务端 `lockGroupOrder` 的事。

### B1 — import（锚点 App.tsx:45，delivery import 行，追加一项）

```tsx
// App.tsx:45 的 delivery import 行追加：groupEscrowLabel
// （GROUP_ORDER_ESCROW_ZH / GroupOrderEscrowStatus 只在 delivery.ts 内部用，不用 import）
```

### B2 — 拼单卡片：每人 escrow 状态（锚点 App.tsx:4924 成员行 + :4925 平摊行，全文替换）

```tsx
// 原行（App.tsx:4924）：
//   {group.members.map((m) => <p key={m.playerId} className="mt-1 text-xs">{m.playerName}：{m.items.map((i) => `${i.name}×${i.qty}`).join("、")}（¥{m.subtotal}）</p>)}
// 替换为（groupTotals 在 :4888 的 groupFee 之后算一次，供两行共用）：
//   const groupTotals = group ? groupOrderTotals(group, groupFee) : null;
//   {group.members.map((m) => { const t = groupTotals?.perMember.find((x) => x.playerId === m.playerId); return (
//     <p key={m.playerId} className="mt-1 text-xs">{m.playerName}：{m.items.map((i) => `${i.name}×${i.qty}`).join("、")}（菜 ¥{m.subtotal}{t ? `，共 ¥${t.total}` : ""}）· {groupEscrowLabel(m)}</p>
//   ); })}
// 平摊行（App.tsx:4925）保持原样：
//   <p className="mt-1 text-xs text-[var(--dim)]">配送费约 ¥{groupFee}，平摊后每人：{groupOrderTotals(group, groupFee).perMember.map((m) => `${m.playerName} ¥${m.total}`).join("、")}</p>
```

说明：

- 每人显示三段：点的菜（¥菜钱小计）、平摊后共计（菜钱 + 配送费份额，取自 `groupOrderTotals`）、escrow 状态（`groupEscrowLabel(m)`：待托管 / 已托管 / 已结算 / 已退回）。服务端未上线 escrow 时全员显示“待托管”，不会误显示“已托管”。
- `groupOrderTotals` 的调用方式没变，仍只算数；escrow 金额就是该成员的 `total`（菜钱 + 平摊配送费），不用另加字段。

### B3 — 锁定失败：服务端错误原样 toast（锚点 App.tsx:4864，**不用改，已是原样 toast**）

```tsx
// lockAndOrder（App.tsx:4861-4870）现有代码已符合要求，集成时直接保留：
//   const r = await api.lockGroupOrder({ playerId: profile.playerId, groupId: group.id });
//   if (!r.ok || !r.group) { showToast(r.error ?? "锁定失败"); return; }
// 成员余额不足时服务端返回的错误（如“XXX 余额不足，托管失败”）会原样 toast 出来，
// 不要在这里把 r.error 改写成统一文案，也不要吞掉错误继续合单（return 已保证失败即停）。
```

---

## 四、验证结果

1. typecheck：`cd ~/workspace/shenhui-life-sim/standalone && npm run typecheck`（`tsc --noEmit -p tsconfig.json`）——**0 错误**（第一遍即过，无修复）。
2. 未跑 `vite build`（任务明确不跑）、未启动服务器、未做浏览器验证（任务不要求，且本环境无浏览器任务）。
3. 锚点实测：App.tsx:45 / :1610 / :1627-1630 / :1631-1648 / :4861-4870 / :4888 / :4893-4899 / :4924-4925 / :4973 均已逐行读过，snippet 里的原行引用与当前文件一致；`rateRestaurant` 在 App.tsx 中 0 次调用（grep 核实）；服务端 `GROUP_ORDER_VIEW` 与 `lockGroupOrder` 已读过，确认当前无 escrow 字段、无托管扣款。

## 五、没做成的事和原因 / 集成时待确认的事

1. **App.tsx 没改**：任务要求只出 snippet。片段 A（import + `rateDeliveryOrder` + :4973 星星）与片段 B（import + :4924 成员行 + :4888 后加 `groupTotals`）都待集成 agent 落地。
2. **服务端 escrow 字段名未对齐**：服务端 agent 的日志还没写出字段名；客户端先按 `escrow: "held" | "settled" | "refunded" | "pending"` 写（见 §一）。如果服务端最终字段名不同，集成时改 delivery.ts 里的字段名 + `groupMemberEscrow` 一处即可，snippet B 不用动。
3. **服务端 lockGroupOrder 当前不托管**：实测 `server/src/actions.ts:5288-5305` 只改状态不扣钱（见 §一）。在服务端 escrow 上线前，拼单卡片上会一直显示“待托管”，锁定失败也不会出现“余额不足”错误——这是服务端未就绪，不是客户端 bug。
4. **集成时必看的双重扣款问题（留给集成 agent 判断，不在本任务可改范围）**：现有的 `lockAndOrder`（App.tsx:4861-4870）在锁定成功后调 `submitDeliveryOrder(merged)`，由发起人在本地全额垫付整单；如果服务端 escrow 已从各成员余额托管了各人那份，发起人本地再付全款 = 成员的钱被算了两次（一次托管、一次发起人垫付）。escrow 上线后，集成时必须决定结算口径——例如发起人本地只付自己那份、其余由服务端结算时从托管里划给发起人/骑手——再改 `lockAndOrder`；**客户端 `groupOrderTotals` 不用改**（它只算数，分摊口径不变）。
5. **rate-5 防刷不在客户端**：`rateOrder` 只保证“5 星才上报”；同一单评 5 星后 UI 收口（§二 A3），但服务端 `reportDeliveryQuest` 目前按调用次数记 progress（E 日志 §1(d) 信任模型：客户端上报 + 10 次/分钟限流 + 进度封顶）。真要防同一单重复 5 星刷任务，得服务端按订单去重（例如记 `meta.ratedOrders`），客户端改不了。
6. **`groupOrderTotals` 刻意没动**：任务要求保持原样（只算数）。它算出的每人 `total` 就是 escrow 应托管的金额，服务端 `lockGroupOrder` 按它扣款时口径一致（余数归发起人）。
