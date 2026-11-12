# ROUND-3 LOG — Lagos Agent E (2026-11-11)

只改本地，不推远端，不碰浏览器。分支 feature/round-2 @ 4bc5307b。
对应审计：`~/workspace/goals/shenhui-life-sim-launch/files/round-2-omissions-audit-2026-11-11.md` 缺口 11（`delivery.ts:1020-1060` LAGOS_GAPS 自认的 3 缺口 + 1 半缺口）。

## 结果总览

4 项全部做完（服务端 + 客户端）：商家赞助读端点 + 菜单 sponsored 标记、Livehouse 打赏/七成分成、顾客拼单、顾客侧每周任务。`LAGOS_GAP_CHECK` 里 4 项由 gap/partial 改为 done（见 §5）。`food-delivery` 仍是 partial——不是本轮的缺口，是它本来就待 App.tsx 接线（round-2 的集成片段还没接）。

## 1. 新端点（12 个，全在 `server/src/actions.ts`，插在 `deliverySponsorSlot` 之后）

### (a) 商家赞助

**`getDeliverySponsors`**（`actions.ts:5092`）
- 请求：`{ playerId, city: "sz" | "hz" | "hk" }`
- 返回：`{ ok, error?, sponsors: [{ id, name, cuisine, emoji, tier, dishes: [{ name, cost, energy, mood, desc }], endsAt: ISO }] }`，只返回 `endsAt > now` 的本城赞助。
- 校验：玩家存在 + 只能看自己所在城市。**故意不做 banned/muted 门禁**：读菜单不是社交写操作。
- 数据模型就是 `deliverySponsorSlot`（`actions.ts:4769`，agent S 没动它）写的 `delivery_sponsors` 表：`dishesJson` 解析后原样返回；解析失败的菜单项丢弃，不炸整单。

### (b) Livehouse 打赏 / 创作者分成

**`tipTrack`**（`actions.ts:5134`）
- 请求：`{ playerId, trackId: number, amount: number (1–500, ¥), message?: string (≤100) }`
- 返回：`{ ok, error?, creatorShare?: number, creatorName?: string }`
- 规则：歌必须 `status = "approved"`；音乐人 = `musicTracks.accountId` 对应的 `players` 行（查不到 = “音乐人还没进游戏，暂时不能打赏”）；不能打赏自己的歌；打赏人存款不足拒绝；每人每天最多 10 次（照抄 `sendGift` 的 10/天）。
- 钱：**走现有 ¥ 账本，不另造钱系统**——`creditMoney(db, 打赏人, -amount, "livehouse tip track #id")` + `creditMoney(db, 音乐人, floor(amount×0.7), "livehouse tip from <名>")`，两次入账都经 `writeLedger`；30% 是店里抽成，只记在 `livehouse_tips` 行里，不进任何人口袋。另写一条 `feedEvents`（“给 XX 的《歌》打赏了 ¥30”）并 `ctx.invalidateQueries()`。
- 注意：round-2 笔记建议用 ✨（“听众花 ✨ 点歌，七成归音乐人”），本轮任务明确要求走 `ledger/writeLedger`，所以用的是 ¥。要改 ✨，把两次 `creditMoney` 换成 `bookStars（打赏人账号 -amount / 音乐人账号 +share）` 即可，表不用动。

**`getLivehouseTips`**（`actions.ts:5166`）
- 请求：`{ playerId }`
- 返回：`{ ok, error?, totalEarned: number, mine: [{ id, trackId, trackTitle, tipperName, amount, creatorShare, message, createdAt: ISO }]（最新 20 条）, totals: [{ trackId, total, count }] }`——`mine` 是“我收到的打赏”，`totals` 是全城每首歌的打赏合计（轮播 UI 可直接显示“这首歌已收到 ¥X 打赏”），`totalEarned` 是这 20 条的 `creatorShare` 之和（不是历史总额，见 §6）。

### (c) 顾客拼单（不是 `delivery.ts:574` 的骑手 `stackWith` 字段）

**`createGroupOrder`**（`actions.ts:5199`）
- 请求：`{ playerId, city, restaurantId, restaurantName, items: [{ key, name, qty, cost }]（1–20 项） }`
- 返回：`{ ok, error?, groupId?, code? }`，`code` 是 6 位暗号（`ABCDEFGHJKMNPQRSTUVWXYZ23456789`，无 0/O/1/I，口头报也不会错；撞号重抽 5 次）。
- 规则：同城；ban/mute 拒绝；一人同时只能在一个进行中的拼单里（发起或加入都算）；发起人自动成为第 1 位成员；`expiresAt = now + 30 分钟`。

**`joinGroupOrder`**（`actions.ts:5231`）
- 请求：`{ playerId, code: string (6 位), items: [{ key, name, qty, cost }] }`
- 返回：`{ ok, error?, groupId?, memberCount? }`
- 规则：暗号找 `status = "open"` 的团（过期团先由 `groupOrderView` 懒取消）；不是同城拒绝；已在团里 / 团满 6 人 / 已在别的团里都拒绝。

**`getGroupOrder`**（`actions.ts:5255`）
- 请求：`{ playerId, groupId: number }`
- 返回：`{ ok, error?, group: { id, code, city, hostId, hostName, restaurantId, restaurantName, status, createdAt, expiresAt, members: [{ playerId, playerName, items, subtotal, joinedAt }] } | null }`
- 只有发起人/成员能看。过期团读时懒取消（`status → cancelled`，照抄 `expirePoolOrders` 的模式）。

**`leaveGroupOrder`**（`actions.ts:5270`）
- 请求：`{ playerId, groupId }` → `{ ok, error? }`
- 规则：只允许 `open` 状态退出；**发起人退出 = 整团取消**（成员行保留，其他成员再读能看到 `cancelled`，不是“你不在团里”）；锁定/已下单后不能退。

**`lockGroupOrder`**（`actions.ts:5288`）
- 请求：`{ playerId, groupId }` → `{ ok, error?, group? }`
- 规则：仅发起人，`open → locked`。锁后没人能再加入，发起人用客户端 `mergeGroupItems` 把所有人的菜拼成一单 `placeOrder`。

**`completeGroupOrder`**（`actions.ts:5305`）
- 请求：`{ playerId, groupId }` → `{ ok, error? }`
- 规则：仅发起人，`locked → ordered`，在合单下好之后调用，闭环。

### (d) 顾客侧每周任务

**`getWeeklyQuests`**（`actions.ts:5331`）
- 请求：`{ playerId }`
- 返回：`{ ok, error?, weekKey: "2026-W46", quests: [{ questId, progress, target, claimed }] }`，周按北京时间 ISO 周算（`weekKeyOf`，`actions.ts:1202`），缺行自动补 4 行。

**`reportDeliveryQuest`**（`actions.ts:5353`）
- 请求：`{ playerId, event: "order" | "rate", restaurantId?, amount?, stars? }`
- 返回：`{ ok, error?, weekKey, quests: [...] }`（同 getWeeklyQuests 的形状，UI 可直接刷新）。
- 推进规则：`order` 事件 → `order-3` +1（封顶 3）、`spend-100` += 本单金额（封顶 100）、`try-new`：`restaurantId` 不在该周 `meta.seen` 里就记 1 并写进 `seen`；`rate` 事件且 `stars === 5` → `rate-5` 记 1。另有 `communityRateOk` 10 次/分钟限流（复用 (c) 的写限流）。
- 信任模型说明（重要）：进度是客户端上报的——和外卖其余的钱一样是客户端算的（business-plan 已注明的口径）；更严格的版本只能从池单推导，但本地单根本不进池。奖励很小（¥15/¥20 + 两张券），刷的收益就是任务本身的奖励。

**`claimWeeklyQuest`**（`actions.ts:5406`）
- 请求：`{ playerId, questId }`
- 返回：`{ ok, error?, reward?: { kind: "money" | "coupon", amount?, couponId?, label } }`
- 规则：进度未达目标 / 已领过都拒绝；领奖用 `claimed = 0` 的 compare-and-set 一次性标记防重入；¥ 奖励 `creditMoney` 直接入账（写 ledger），券奖励只返回 `couponId`（`weekly-free-delivery` / `weekly-off-8`），由客户端 `grantWeeklyCoupon` 加进 `state.coupons`。

### 内部函数（`actions.ts:1192-1263`，在 `Actions` 对象外、round-3 (S) 警察 helpers 之前）
- `WEEKLY_QUEST_DEFS`（`:1195`）：4 项任务的服务端镜像（与客户端 `WEEKLY_QUESTS` 同步改）。
  - `order-3` 目标 3 → 奖免配送费券 `weekly-free-delivery`
  - `try-new` 目标 1 → 奖 ¥15
  - `rate-5` 目标 1 → 奖立减 ¥8 券 `weekly-off-8`
  - `spend-100` 目标 100 → 奖 ¥20
- `weekKeyOf(d)`（`:1202`）：北京时间 ISO 周，`"2026-W46"`。
- `ensureWeeklyQuestRows(db, playerId, weekKey)`（`:1212`）：`onConflictDoNothing` 补行。
- `randomGroupCode()` + `GROUP_CODE_CHARS`（`:1218-1223`）、`GROUP_ORDER_MAX_MEMBERS = 6`、 `GROUP_ORDER_TTL_MS = 30 分钟`。
- `GROUP_ORDER_ITEM_Z` / `GROUP_ORDER_VIEW`（`:1224-1231`）：拼单 item 与整团视图的 zod 形状，6 个拼单端点共用。
- `groupOrderView(db, groupId)`（`:1233`）：读团 + 成员，过期 `open` 团懒取消。
- `openGroupOf(db, playerId)`（`:1253`）：一人同时只能一团的检查（发起或成员都算）。

## 2. 新增的表（`server/src/schema.ts` + `drizzle/0020_round3_server.sql` 追加）

| 表 | 位置 | 列 / 主键 |
|---|---|---|
| `livehouse_tips` | schema.ts:885，0020 追加 | `id` 自增 PK，`track_id`，`tipper_id`，`tipper_name`，`creator_id`，`amount`（听众付的 ¥），`creator_share`（七成），`message`，`created_at` |
| `group_orders` | schema.ts:896，0020 追加 | `id` 自增 PK，`city`，`host_id`，`host_name`，`restaurant_id`，`restaurant_name`，`code`，`status`（open/locked/ordered/cancelled，默认 open），`created_at`，`expires_at` |
| `group_order_members` | schema.ts:908，0020 追加 | PK `(group_id, player_id)`，`player_name`，`items_json`（`[{key,name,qty,cost}]`），`subtotal`，`joined_at` |
| `delivery_quests` | schema.ts:916，0020 追加 | PK `(player_id, week_key, quest_id)`，`progress`，`claimed`（0/1），`meta`（JSON，`{seen:[restaurantId...]}` 供 try-new 用），`updated_at` |

`drizzle/meta/_journal.json` 没碰（0020 已登记）；`drizzle/0019*` 没碰。

## 3. 改了哪些文件和行号

- `server/src/actions.ts`：helpers `actions.ts:1192-1263`（新增）；12 个端点 `actions.ts:5092-5430`（新增，插在 `deliverySponsorSlot` 之后、`} satisfies ActionsModule;` 之前）。**服务端 agent（S）已写的端点一个字没动。**
- `server/src/schema.ts`：4 张新表 `:885-923`（文件尾追加）。
- `drizzle/0020_round3_server.sql`：追加 4 个 `CREATE TABLE`（文件从 30 行 → 76 行），语句间用 `--> statement-breakpoint`，格式照原文件。
- `client/src/round2/delivery.ts`：
  - `MenuRestaurant.sponsored?: boolean`（`:77-78`）
  - 赞助：`SponsoredDish` / `SponsoredRestaurant` 类型 + `sponsoredRestaurantToMenu` + `mergeSponsoredMenu`（`:153-210`）
  - 打赏：`TIP_AMOUNTS` / `TIP_CREATOR_SHARE` / `tipCreatorShare` / `LivehouseTip`（`:1029-1050`）
  - 拼单：`GroupOrderItem` / `GroupOrderMember` / `GroupOrderStatus` / `GroupOrderView` / `GROUP_ORDER_MAX_MEMBERS` / `GROUP_ORDER_TTL_MINUTES` / `groupOrderTotals` / `mergeGroupItems` / `groupOrderShareText`（`:1052-1120`）
  - 每周任务：`WeeklyQuestDef` / `WEEKLY_QUESTS` / `WEEKLY_REWARD_COUPONS` / `WeeklyQuestProgress` / `weeklyQuestState` / `grantWeeklyCoupon`（`:1122-1172`）
  - `DeliveryState.activeGroup?: { id, code } | null`（`:948`）+ `emptyDeliveryState` 里 `activeGroup: null`（`:961`）
  - `LAGOS_GAP_CHECK` 4 项更新（见 §5）

没碰：`App.tsx`、`LifeStage.tsx`、`MapView.tsx`、`data.ts`、除 `delivery.ts` 外的 `client/src/round2/*`、`.env`、`standalone/dist/`、`~/workspace/ts-spaces/`、任何 `.db` 文件。服务器没启动，没跑 `vite build`。

## 4. App.tsx / Livehouse.tsx 集成 snippet（给接线 agent，直接贴）

约定：`api` 已在 `App.tsx:5` import（`import { api, type ApiResponse } from "./api"`）；`Livehouse.tsx` 里 `api` 也已 import，且 `toast` / `token` 都是现成 props。`delivery.ts` 的新导出按 `App.tsx:45` 现有 import 行追加。

### 片段 1 — 赞助标记（外卖菜单，锚点 `App.tsx:4694` 的 `deliveryMenu` 调用处）

```tsx
// 外卖菜单打开时拉一次赞助（state: const [sponsors, setSponsors] = useState<SponsoredRestaurant[]>([])）
useEffect(() => {
  api.getDeliverySponsors({ playerId: profile.playerId, city: s.cityKey })
    .then((r) => { if (r.ok) setSponsors(r.sponsors); })
    .catch(() => {});
}, [s.cityKey]);
// 原来那行改成：
const menu = mergeSponsoredMenu(deliveryMenu(s.cityKey, d.myRatings), sponsors);
// 餐厅卡片上（已有 name/emoji 渲染处）加：
{r.sponsored && <span className="ml-1 rounded-full bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-black text-black">赞助</span>}
```

### 片段 2 — 打赏 UI（`Livehouse.tsx`，锚点“正在播放”卡片的 `🎧 一起听` 按钮下方；`cur` 是正在播的歌）

```tsx
// state: const [tipSent, setTipSent] = useState(false); 打赏金额用 TIP_AMOUNTS
{cur && (
  <div className="mt-3 flex items-center gap-2">
    <span className="text-[11px] font-black text-white/70">打赏音乐人</span>
    {TIP_AMOUNTS.map((a) => (
      <button key={a} type="button" disabled={tipSent}
        onClick={async () => {
          const r = await api.tipTrack({ playerId: profile.playerId, trackId: cur.id, amount: a });
          if (r.ok) { setTipSent(true); toast(`已打赏 ¥${a}，${r.creatorName} 收到 ¥${r.creatorShare}（七成）。`); }
          else toast(r.error ?? "打赏失败");
        }}
        className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-black disabled:opacity-40">
        ¥{a}
      </button>
    ))}
  </div>
)}
// 音乐人自己的收入（放在“我是音乐人”区下方，我的歌列表旁）：
const tips = await api.getLivehouseTips({ playerId: profile.playerId });
// tips.mine.map(t => `《${t.trackTitle}》${t.tipperName} 打赏 ¥${t.amount}，你收到 ¥${t.creatorShare}`)
// tips.totals 可贴在轮播列表每首歌后：“已收到打赏 ¥X”
```

注意：`LivehouseModal` 的 props 里没有 `playerId`，接线时需从 App.tsx 传一个（`profile.playerId`，`boostTrack` 那边用的是 `token`，但 `tipTrack` 用的是 `playerId`，因为钱在玩家 ¥ 账本上不在账号 ✨ 账本上）。`tipSent` 在切歌（`cur.id` 变）时要重置。

### 片段 3 — 拼单 UI（外卖页，锚点 `App.tsx:4693` 的外卖菜单区）

```tsx
// state: const [group, setGroup] = useState<GroupOrderView | null>(null);
//       const [groupCode, setGroupCode] = useState("");
// 发起拼单（在购物车确认处，选好店和菜之后）：
const startGroup = async (restaurantId: string, restaurantName: string, items: GroupOrderItem[]) => {
  const r = await api.createGroupOrder({ playerId: profile.playerId, city: s.cityKey, restaurantId, restaurantName, items });
  if (!r.ok || !r.groupId) { toast(r.error ?? "开团失败"); return; }
  mutate((x) => { const dd = x.delivery ?? emptyDeliveryState(); x.delivery = { ...dd, activeGroup: { id: r.groupId!, code: r.code! } }; });
  const g = await api.getGroupOrder({ playerId: profile.playerId, groupId: r.groupId });
  if (g.ok && g.group) setGroup(g.group);
  toast(`拼单开好了！暗号 ${r.code}，发给朋友，30 分钟内凑齐。`);
};
// 加入拼单（外卖页顶部一个暗号输入框）：
const joinGroup = async () => {
  const r = await api.joinGroupOrder({ playerId: profile.playerId, code: groupCode.trim().toUpperCase(), items: myItems });
  if (!r.ok || !r.groupId) { toast(r.error ?? "加入失败"); return; }
  mutate((x) => { const dd = x.delivery ?? emptyDeliveryState(); x.delivery = { ...dd, activeGroup: { id: r.groupId!, code: groupCode.trim().toUpperCase() } }; });
  const g = await api.getGroupOrder({ playerId: profile.playerId, groupId: r.groupId });
  if (g.ok && g.group) setGroup(g.group);
};
// 拼单卡片（group 非空时显示）：成员 + 各人菜品 + groupOrderTotals(group, deliveryFee) 的分摊
//   {group.members.map(m => <p>{m.playerName}：{m.items.map(i => `${i.name}×${i.qty}`).join("、")}（¥{m.subtotal}）</p>)}
//   <p>配送费 ¥{fee}，平摊后每人：{totals.perMember.map(m => `${m.playerName} ¥${m.total}`).join("、")}</p>
//   <button onClick={() => void navigator.clipboard.writeText(groupOrderShareText(group))}>复制暗号发给朋友</button>
// 发起人锁定并合单下单：
const lockAndOrder = async () => {
  const r = await api.lockGroupOrder({ playerId: profile.playerId, groupId: group.id });
  if (!r.ok || !r.group) { toast(r.error ?? "锁定失败"); return; }
  const merged = mergeGroupItems(r.group.members); // [{key, qty}]
  const order = placeOrder({ city: s.cityKey, platformId, items: merged, coupons: d.coupons, memberUntilDay: d.memberUntilDay, day: s.day, now: Date.now() });
  // …走现有 placeOrder 成功分支（App.tsx:1502-1508 那段：扣钱 + pushOrder + 可选 publishToPool）
  await api.completeGroupOrder({ playerId: profile.playerId, groupId: group.id });
  mutate((x) => { const dd = x.delivery ?? emptyDeliveryState(); x.delivery = { ...dd, activeGroup: null }; });
  setGroup(null);
  toast("拼单下好了，骑手正在路上。");
};
// 退出：await api.leaveGroupOrder({ playerId, groupId }) 后清 activeGroup + setGroup(null)。
// 进外卖页时若 d.activeGroup 有值，调一次 getGroupOrder 恢复 group 卡片。
```

### 片段 4 — 每周任务 UI（外卖页，每周任务卡；进度上报接在现有下单/好评处）

```tsx
// state: const [weekly, setWeekly] = useState<{ weekKey: string; quests: WeeklyQuestProgress[] } | null>(null);
// 进外卖页拉一次：
useEffect(() => {
  api.getWeeklyQuests({ playerId: profile.playerId })
    .then((r) => { if (r.ok) setWeekly({ weekKey: r.weekKey, quests: r.quests }); })
    .catch(() => {});
}, [s.cityKey]);
// 任务卡：
{WEEKLY_QUESTS.map((q) => {
  const st = weeklyQuestState(q, weekly?.quests.find((x) => x.questId === q.id));
  return (
    <p key={q.id}>
      {q.title}（{st.progress}/{st.target}）· 奖 {q.rewardLabel}
      {st.claimable && <button onClick={() => void claimQuest(q.id)}>领奖</button>}
      {st.done && !st.claimable && <span>已领</span>}
    </p>
  );
})}
const claimQuest = async (questId: string) => {
  const r = await api.claimWeeklyQuest({ playerId: profile.playerId, questId });
  if (!r.ok) { toast(r.error ?? "领奖失败"); return; }
  if (r.reward?.kind === "coupon" && r.reward.couponId)
    mutate((x) => { x.delivery = grantWeeklyCoupon(x.delivery ?? emptyDeliveryState(), r.reward!.couponId!); });
  // ¥ 奖励 server 已直接入账（mutate() 落账后刷新显示即可）
  const w = await api.getWeeklyQuests({ playerId: profile.playerId });
  if (w.ok) setWeekly({ weekKey: w.weekKey, quests: w.quests });
  toast(`领到 ${r.reward?.label ?? "奖励"}！`);
};
// 进度上报——接在现有两处，不用新 UI：
// (1) 下单成功后（App.tsx:1502-1508 placeOrder 成功分支内，r.order 已有）：
void api.reportDeliveryQuest({ playerId: profile.playerId, event: "order", restaurantId: r.order!.restaurantId, amount: r.order!.total }).catch(() => {});
// (2) 好评后（rateRestaurant 调用的地方，stars === 5 时）：
if (stars === 5) void api.reportDeliveryQuest({ playerId: profile.playerId, event: "rate", stars: 5 }).catch(() => {});
// 上报后如需立即刷新任务卡，再调一次 getWeeklyQuests。
```

## 5. LAGOS_GAPS 的更新（`client/src/round2/delivery.ts`）

| id | 原状态 | 新状态 | 备注 |
|---|---|---|---|
| `merchant-sponsor` | gap | **done** | `getDeliverySponsors` + `mergeSponsoredMenu` / `MenuRestaurant.sponsored`；待 App.tsx 接线（片段 1） |
| `creator-payout` | gap | **done** | `tipTrack` / `getLivehouseTips` + `TIP_AMOUNTS` / `tipCreatorShare`；待 Livehouse.tsx 接线（片段 2） |
| `group-order` | gap | **done** | 6 个拼单端点 + `GroupOrderView` / `mergeGroupItems` / `groupOrderTotals`；待 App.tsx 接线（片段 3） |
| `retention-loop` | partial | **done** | 3 个每周任务端点 + `WEEKLY_QUESTS` / `WEEKLY_REWARD_COUPONS`；待 App.tsx 接线（片段 4） |
| `food-delivery` | partial | partial（未动） | 本轮缺口之外；仍是“待 App.tsx 接线 + area S 单池端点”那句老话 |
| 其余 6 项（entry / billboards / nightclub / currency / invite） | done | done（未动） | — |

更新后 `lagosGapSummary()`：done 9、partial 1（food-delivery）、gap 0。

## 6. 没做成的事和原因

- **客户端接线没做**：任务明确要求只写 snippet、不直接改 `App.tsx`（`Livehouse.tsx` 也不在可改范围）。4 个片段在 §4，锚点都核对过真实行号（`App.tsx:45/4694/1502-1508`、`Livehouse.tsx` 正在播放区）。
- **打赏用 ¥ 不用 ✨**：任务要求走 `ledger/writeLedger`，¥ 账本就是它；round-2 笔记的 ✨ 方案记在 `tipTrack` 注释和 §1(b) 里，一行可换。
- **`getLivehouseTips.totalEarned` 只汇总最新 20 条**：想看历史总额要另算（`sum(creator_share)` 全表）；20 条是给 UI 列表用的，顺手加的合计不是审计口径，领奖/对账请以 `livehouse_tips` 表为准。
- **拼单不托管钱**：各人那份仍是客户端算（和普通下单同一口径），server 只存组成；发起人合单时整单由发起人先付，成员之间是口头分摊（`groupOrderTotals` 只算数不转账）。要真分账得另加 escrow + 结算端点——本轮没做，因为任务没要求，且会改动现有的客户端算钱口径。
- **每周任务进度客户端上报**：见 §1(d) 的信任模型说明；防刷只有 10 次/分钟限流 + 进度封顶。真要服务端可信，得把本地单也写进池（改动太大，不在本轮）。
- **拼单没有推送**：成员加入/锁定/取消不会主动通知其他成员，靠进外卖页时 `getGroupOrder` 刷新；要实时得另加轮询或推送通道。

## 7. 验证

- `cd standalone && npm run typecheck`（`tsc --noEmit`）：**0 错误**（第一遍 1 个错：`groupOrderView` 里 `rows.map((m) => …)` 的 `m` 隐式 any——helper 里的 `db: Db` 未带 schema 泛型；修为显式 `typeof schema.groupOrderMembers.$inferSelect` 后通过）。
- 迁移实测：在 `/tmp` 临时库（better-sqlite3）上按 `standalone/server.ts` 的切分逻辑依次应用 `0019` + `0020`，**通过**（4 张新表存在；`livehouse_tips` / `group_orders` / `group_order_members` / `delivery_quests` 各插一行成功；临时库已删）。
- 未做浏览器验证（任务不要求，且无浏览器）；未跑 `vite build`（任务明确不跑）。
