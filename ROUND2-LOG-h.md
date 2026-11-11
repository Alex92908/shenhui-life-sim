# ROUND-2 LOG — area (h): food delivery + Lagos Life gap check

Date: 2026-11-11 · Agent: (h) · Branch: `feature/round-2` (local only, never push)
Module: `client/src/round2/delivery.ts` (NEW, ~1,070 lines, pure TS, no React)

## What was already in the game (verified in code before writing anything)

The "NO food-delivery action exists" line in the changelog needs nuance — delivery
existed in three thin, disconnected pieces:

1. **Customer, instant only** — `App.tsx orderFood(i)` (~line 3280) and
   `orderDelivery(platIdx, foodIdx)` (~line 3697): money leaves, food is eaten in
   the same click. No rider, no wait, no tracking, no restaurant choice, only the
   3 `FOODS[city]` dishes. The phone app "点外卖" (`APPS` id `"food"`,
   `renderPhoneApp` case `"food"` ~line 4089) renders exactly that.
2. **Courier, rider career only** — `doRoutine` `"grab/wait/climb/handover"`
   (`App.tsx` ~2160–2245) + `riderPick` + `RiderOrder` (`routines.ts:444`):
   a good loop (per-order pay, rain +¥4, 10-min late rule → 30% cut, 22% tip
   chance, stairs climb). But: orders are 100% synthetic NPC orders, no rating,
   no surge/peak pricing, no stacking, and a customer's own order can never
   become a gig another player delivers. Only playable as the rider career.
3. **Data, unused for delivery** — `RESTAURANTS` (rich dine-in data: dishes,
   scene, tier, cuisine) is dine-in only; `DELIVERY_PLATFORMS` (美团/京东/淘宝闪购,
   feeMul) is only used by the venue fold; `SHOP_VENUES` has 美团闪购 as a
   walk-in shop, not a phone order.

So the real gap was: **no real delivery loop** (wait + rider + tracking) and
**no customer↔courier connection**. That is what this module builds.

## What delivery.ts implements

### (a) Customer ordering — full Chowdeck-style phone flow
- `deliveryMenu(city)` — merges `FOODS` fast food + every `RESTAURANTS` dish in
  the city into one delivery menu (per-restaurant rating, tier, cuisine, scene).
- `placeOrder()` — cart (one restaurant per order, like real apps), platform
  choice with `feeMul`, delivery fee, coupons, membership discount. Returns the
  order + exact charge, or a readable error (empty cart, mixed restaurants,
  expired coupon, unknown dish).
- Order state machine `placed → accepted → preparing → pickedUp → arriving →
  delivered → eaten`, advanced by **real time** via `advanceOrder(order, now)`
  (~5–8 min total; made-to-order dishes +2 min). `eatDelivered()` settles
  energy/mood/hunger on arrival; `cancelOrder()` is free within 2 min / before
  acceptance, half-refund after (kitchen already cooking).
- Coupons: `WELCOME_COUPONS` (新人免配送费 ×1, 立减 ¥8), `couponDiscount()`.
- Membership 月卡： ¥18 / 30 游戏天，免配送费 + 95 折 (`MEMBERSHIP_PRICE`,
  `MEMBERSHIP_DAYS`, `membershipActive()`).
- Order history (last 20), favorites, post-meal restaurant rating 1–5
  (`rateRestaurant()` — 4★+ auto-favorites the restaurant).
- `fmtDeliveryCountdown()` for the tracking UI.

### (b) Courier — part-time gig board for ANY career, not just riders
- `generateCourierBoard({ stops, city, now, nowMin, rainy, profile })` — App.tsx
  passes `getLocations(city)`; pure dispatch logic here. Pay = distance price +
  peak surge (lunch 11:00–13:30 / dinner 17:30–20:00 ×1.3, `surgeMul()`) + rain
  +¥4 + level multiplier.
- `acceptGig / pickupGig / deliverGig / cancelGig` — full lifecycle: max 2
  concurrent gigs (3 for 金牌/单王）, 10-min deadline matching the rider-career
  rule (`GIG_LATE_MS`), late → 30% cut, 25% tip chance, stairs rule.
- `CourierProfile` + `courierLevel()` — rating (starts 5.0; 4.0以下接不到高峰单）,
  completed/on-time/late/cancelled, today totals, streak days, titles
  新手 → 熟手 → 金牌 → 单王 with pay multipliers 1.0 / 1.08 / 1.15 / 1.25.
- Cancel costs −0.2 rating; 3 cancels in a day blocks further dispatch.

### (c) Instant retail on the same pipeline
- `retailShops(city)` / `placeRetailOrder()` — grocery, daily goods, pharmacy
  （深夜退烧药 30 分钟达）, flowers, built from `SHOP_VENUES` 美团闪购/网购
  data. Same order state machine, `kind: "retail"`.

### (d) Shared order pool — the multiplayer Chowdeck loop
- `poolPayloadFor(order, destLabel)` + `poolOrderToGig(pool)` — a customer's
  order can be published to the city pool; a rider player sees it on their gig
  board exactly like a system order (only `poolId` differs), claims it, delivers
  it, and the customer gets their food from a real person. Client-side only
  here; server is source of truth (specs below for area S).

### (e) Save slice
- `DeliveryState` + `emptyDeliveryState()` + `isDeliveryState()` (load guard) +
  `pushOrder / updateOrder / activeOrder / courierTodaySummary()`.

## Lagos Life gap check — `LAGOS_GAP_CHECK` in delivery.ts

Checked against the Lagos model (34 locations / 33 careers, free browser entry,
billboards ₦5,000/wk, nightclub musician fee ₦50,000, Chowdeck in-app, real-money
currency). Result: **6 done, 2 partial, 3 gap** (see `lagosGapSummary()`).

| # | Lagos feature | Status | Where in this game |
|---|---|---|---|
| entry | 零门槛进：浏览器打开就玩 | ✅ done | App.tsx / standalone; 账号只在钱托管社交功能时才要 |
| billboards | 商家租路边广告牌 | ✅ done | `getBillboards/buyBillboard/adminBillboard` — 玩家花 ✨ 租 7 天，管理员可免费给本地商家上牌 |
| nightclub | 音乐人付费进虚拟夜店 | ✅ done | Livehouse：投稿 + 300 ✨ 本周主打、全城轮播 |
| currency | 玩家真钱买游戏币 | ✅ done | Starlight 商店 + Stripe `createOrder`（上线前需确认收款通道，大陆个人开不了 Stripe） |
| food-delivery | Chowdeck 外卖进手机 App | 🟡 partial → **fixed in this module** | 旧的即时下单 + 合成派单；本模块补齐全菜单、真实配送状态机、券/会员、兼职跑单板、评分/高峰/拼单、共享单池 |
| merchant-sponsor | 商家赞助不止广告牌：赞助的店/菜进游戏内容 | 🔴 gap — documented | 无对应代码，餐厅全是静态数据（见 server spec `deliverySponsorSlot`） |
| creator-payout | 音乐人能从游戏里赚钱 | 🔴 gap — documented | Livehouse 只收 300 ✨；已有 `sendGift` 礼物通道可复用做打赏/点歌分成 |
| invite | 病毒传播：邀请链接/分享裂变 | ✅ done | `share.ts` invite links + 分享卡片 PNG |
| group-order | 拼单 / 一起点 | 🔴 gap — documented | 无对应代码；室友系统已存在，拼单是自然延伸 |
| retention-loop | 留存钩子：外卖激励 | 🟡 partial | 跑单有 streak/等级；顾客侧只有新人券，缺每周任务（`weeklyDeliveryQuest`，纯客户端，下一轮） |

## Typecheck

- `delivery.ts`: **0 errors** (standalone `npx tsc --noEmit -p tsconfig.json`,
  grep for `round2/delivery` returns nothing).
- Whole-project typecheck currently FAILS on other in-flight round-2 modules
  (not mine, not touched): `round2/community.ts` (unused `gameDay`),
  `round2/economy.ts` (unused `total`), `round2/house.ts` (duplicate props),
  `round2/lifestyles.ts` (unused vars, missing `HOPE_MILESTONES`),
  `LifeStage.tsx` (unused imports), `MapView.tsx` (`LocType` vs `"park"`,
  redeclared `badge`). Integration agent to re-run after all areas land.
- Did NOT run `npm run build` (per task — integration agent owns the build).

## App.tsx integration snippets (for the integration agent — I may not edit App.tsx)

### 1. Import (top of App.tsx, next to the other data imports, ~line 23)
```ts
import {
  advanceOrder, cancelOrder, courierTodaySummary, deliveryMenu, eatDelivered,
  emptyDeliveryState, generateCourierBoard, isDeliveryState, placeOrder,
  placeRetailOrder, poolOrderToGig, poolPayloadFor, pushOrder, rateRestaurant,
  updateOrder, activeOrder, acceptGig, pickupGig, deliverGig, cancelGig,
  fmtDeliveryCountdown, retailShops, MEMBERSHIP_PRICE, MEMBERSHIP_DAYS,
  type CourierGig, type CustomerOrder, type DeliveryState,
} from "./round2/delivery";
```

### 2. GameState field (App.tsx ~line 308, after `routine?: RoutineDay;`)
```ts
/* 外卖 / 跑单（round-2 h）：顾客订单、券、会员、骑手档案、手上的单 */
delivery?: DeliveryState;
```

### 3. Load normalizer (App.tsx ~line 1560+, inside the `gs: GameState = { … }`
literal, e.g. after the `routine` line if present, else after `network:`)
```ts
delivery: isDeliveryState((g as { delivery?: unknown }).delivery)
  ? (g as { delivery: DeliveryState }).delivery
  : emptyDeliveryState(),
```
Save is automatic — `delivery` rides on GameState like `routine` does.

### 4. Order tick — advance the active customer order in real time
Add near the other `useEffect` blocks (~line 913):
```tsx
useEffect(() => {
  const t = window.setInterval(() => {
    const s0 = gsRef.current; if (!s0?.delivery?.activeOrderId) return;
    const o = activeOrder(s0.delivery); if (!o) return;
    const { order, advancedTo } = advanceOrder(o, Date.now());
    if (!advancedTo) return;
    mutate((x) => { x.delivery = updateOrder(x.delivery ?? emptyDeliveryState(), order); });
    if (advancedTo === "delivered") {
      showToast(`🛵 外卖到了！${order.restaurantName}的餐在楼下，快趁热吃。`);
      sfx("notify");
    } else if (advancedTo === "pickedUp") {
      showToast(`🛵 ${order.riderName}已取餐，正在送来的路上。`);
    }
  }, 15_000);
  return () => window.clearInterval(t);
}, []);
```
(Uses existing `gsRef`, `mutate`, `showToast`, `sfx` — no new plumbing.)

### 5. Phone app "food" — replace the instant order (App.tsx case `"food"` ~line 4089)
Replace the body of `case "food":` in `renderPhoneApp` with a delivery screen.
Minimal version (keeps the old `orderFood` path as fallback for save compat):
```tsx
case "food": {
  const d = s.delivery ?? emptyDeliveryState();
  const active = activeOrder(d);
  const menu = deliveryMenu(s.cityKey, d.myRatings);
  const [cart, setCart] = useState<{ key: string; qty: number }[]>([]); // ← hoist: move to component level, see note
  if (active && active.stage !== "eaten" && active.stage !== "cancelled") {
    return (
      <div className="grid gap-2">
        <p className="text-sm font-black">🛵 {active.restaurantName} · {fmtDeliveryCountdown(active, Date.now())}</p>
        <p className="text-xs text-[var(--dim)]">骑手 {active.riderEmoji}{active.riderName} · {active.items.map((i) => `${i.name}×${i.qty}`).join("、")}</p>
        {active.stage === "delivered" && (
          <button type="button" className="act-btn" onClick={() => eatDeliveryOrder(active.id)}>
            🍽️ 开吃（能量 +{active.energy} · 心情 +{active.mood}）
          </button>
        )}
        {(active.stage === "placed" || active.stage === "accepted") && (
          <button type="button" className="act-btn" onClick={() => cancelDeliveryOrder(active.id)}>取消订单</button>
        )}
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      {menu.map((r) => (
        <div key={r.id}>
          <p className="text-sm font-black">{r.emoji} {r.name} · {r.cuisine} {r.tier} · ⭐{r.rating}</p>
          {r.items.map((it) => (
            <div key={it.key} className="flex items-center gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] p-3">
              <div className="text-2xl">{it.emoji}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{it.name} <span className="text-[var(--accent)]">{fmt(it.cost)}</span></p>
                <p className="text-xs text-[var(--dim)]">{it.desc} · 能量 +{it.energy} · 心情 +{it.mood}</p>
              </div>
              <button type="button" onClick={() => addToDeliveryCart(it.key)}>＋</button>
            </div>
          ))}
        </div>
      ))}
      {cart.length > 0 && (
        <button type="button" className="act-btn" onClick={() => submitDeliveryOrder(cart)}>
          下单（平台：{DELIVERY_PLATFORMS[0]!.name}）
        </button>
      )}
    </div>
  );
}
```
> **Note for the integration agent:** `renderPhoneApp` is a plain function, not a
> component — the `useState` cart above must be hoisted to component-level state
> (e.g. `const [deliveryCart, setDeliveryCart] = useState<…>([])` next to
> `phoneApp`, ~line 843). The handlers below are component-level functions.

### 6. Handlers (component level, next to `orderFood` ~line 3280)
```ts
// 🛵 round-2 (h): 外卖下单 / 吃 / 取消 / 评分
const submitDeliveryOrder = (cart: { key: string; qty: number }[], platformId = DELIVERY_PLATFORMS[0]!.id, couponId?: string) => {
  const s0 = gsRef.current; if (!s0) return;
  const d = s0.delivery ?? emptyDeliveryState();
  const r = placeOrder({
    city: s0.cityKey, platformId, items: cart, couponId,
    coupons: d.coupons, memberUntilDay: d.memberUntilDay, day: s0.day, now: Date.now(),
  });
  if (!r.ok || !r.order || r.charge === undefined) { showToast(r.error ?? "下单失败。"); return; }
  if (s0.money < r.charge) { showToast("钱不够点这单外卖。"); return; }
  mutate((x) => {
    x.money -= r.charge!; x.delivery = pushOrder(x.delivery ?? emptyDeliveryState(), r.order!);
    if (couponId) x.delivery.coupons = (x.delivery ?? emptyDeliveryState()).coupons.filter((c) => c.id !== couponId);
  });
  addLog(`用${platformById(platformId)?.name ?? ""}点了${r.order.restaurantName}外卖，-${fmt(r.charge)}。`);
  showToast(`🛵 下单成功！${r.order.riderName}正在赶往商家，预计 ${Math.round((r.order.etaAt - Date.now()) / 60_000)} 分钟送达。`);
  setPhoneOpen(false);
  // 可选：发布到共享单池，让真人骑手接单（server 端点见下；失败也不影响本单）
  void publishDeliveryToPool(r.order);
};
const eatDeliveryOrder = (orderId: string) => {
  const s0 = gsRef.current; if (!s0?.delivery) return;
  const o = s0.delivery.orders.find((x) => x.id === orderId); if (!o) return;
  const r = eatDelivered(o);
  if (!r.ok) { showToast(r.error ?? "还没送到。"); return; }
  mutate((x) => {
    const d = x.delivery ?? emptyDeliveryState();
    x.money = x.money; x.energy = clamp100(x.energy + r.energy); x.mood = clamp100(x.mood + r.mood);
    x.hunger = clamp100(x.hunger + r.hunger); x.mealCount += 1;
    x.delivery = updateOrder(d, { ...o, stage: "eaten" });
  });
  showToast(`🍽️ ${o.items.map((i) => i.name).join("、")}吃完了，能量 +${r.energy}，心情 +${r.mood}。`);
  playLifeAnim("eat");
};
const cancelDeliveryOrder = (orderId: string) => {
  const s0 = gsRef.current; if (!s0?.delivery) return;
  const o = s0.delivery.orders.find((x) => x.id === orderId); if (!o) return;
  const { order, refund } = cancelOrder(o, Date.now());
  mutate((x) => {
    x.money += refund;
    x.delivery = updateOrder(x.delivery ?? emptyDeliveryState(), order);
  });
  showToast(refund > 0 ? `订单已取消，退回 ${fmt(refund)}。` : "订单已取消。");
};
```
Keep the old `orderFood` / `orderDelivery` functions in place (venue fold still
uses `orderDelivery`; phone `"food"` case is the only thing replaced) — no
existing feature breaks.

### 7. Courier gig board — inside the "jobs" （招聘广场） phone app (no data.ts change)
Add a "🛵 跑单" section at the top of the `jobs` phone-app render, fed by a
component-level `courierBoard` state refreshed on open:
```ts
const refreshCourierBoard = () => {
  const s0 = gsRef.current; if (!s0) return;
  const d = s0.delivery ?? emptyDeliveryState();
  const stops = getLocations(s0.cityKey).map((l) => ({ id: l.id, name: l.name, type: l.type, x: l.x, z: l.z }));
  const board = generateCourierBoard({
    stops, city: s0.cityKey, now: Date.now(), nowMin: nowMin(),
    rainy: nowRainy, profile: d.courier,
  });
  setCourierBoard(board);
};
```
Render each gig with 接单 → (走到商家 `riderGo`-style `walkTo(gig.shopId, "moto")`)
→ 取餐 (`pickupGig`, needs `currentLoc === gig.shopId`) → 送到 (`walkTo(gig.destId, "moto")`)
→ 交付 (`deliverGig` with `atDest`, `climbedStairs`, `customerStars` omitted for
system gigs). On success: `mutate` money/energy/xp + `courier` profile from the
result + push to `gigHistory`. **Do not** rewire the rider-career `doRoutine`
grab loop — it stays as the career path; this board is the part-time path any
career can use. If the rider career is active, pass
`excludeShopIds: [routineToday(s0).order?.shop]` so the two don't double-book.
> `nowMin()` and `nowRainy` already exist in App.tsx (used by `doRoutine`);
> `walkTo` / `currentLocRef` likewise. `setCourierBoard` is new component state.

### 8. Optional: member card + retail (same phone "food" app, below the menu)
```tsx
{!membershipActive(d.memberUntilDay, s.day) && (
  <button type="button" className="act-btn" onClick={buyDeliveryMembership}>
    💳 外卖月卡 ¥{MEMBERSHIP_PRICE} / 30 天：免配送费 + 95 折
  </button>
)}
```
```ts
const buyDeliveryMembership = () => {
  const s0 = gsRef.current; if (!s0 || s0.money < MEMBERSHIP_PRICE) { showToast("钱不够买月卡。"); return; }
  mutate((x) => {
    const d = x.delivery ?? emptyDeliveryState();
    x.money -= MEMBERSHIP_PRICE;
    x.delivery = { ...d, memberUntilDay: s0.day + MEMBERSHIP_DAYS };
  });
  showToast(`💳 外卖月卡已开通，30 天内免配送费 + 95 折。`);
};
```
Retail (`retailShops` / `placeRetailOrder`) can reuse the same handlers with
`kind: "retail"` — wire it as a second tab in the food app when time permits;
it is not load-bearing for launch.

## Server endpoint spec (for area S — server/src/actions.ts + schema.ts)

Follow the existing `defineAction` + zod patterns (`getGigs`/`postGig` precedent).
All money in ¥; all need `playerId` + `city` enum `["sz","hz","hk"]`.

### `deliveryPoolPublish` — 顾客把订单发进全城跑单池
- Request: `{ playerId: string(4–64), city, order: { platformId: string, restaurantId: string, restaurantName: string, items: { name: string, qty: number }[], total: number, riderFee: number, destLabel: string, placedAt: number } }`
  (client builds `order` with `poolPayloadFor()`; `destLabel` = 顾客当前地点名，
  e.g. `"东门夜市食街"` — App.tsx passes `locById(currentLoc).name`.)
- Returns: `{ ok: boolean, error?: string, poolId?: number }`
- Server: insert `delivery_pool_orders` (see schema below); `riderFee` = max(3,
  顾客付的 deliveryFee); `status: "open"`, `deadlineAt = now + 10 min`;同一玩家
  最多 2 单 open（防刷）; banned/muted 拒绝；`total` 只做展示，不走账（顾客的钱
  已在客户端扣掉，见下）。

### `deliveryPoolList` — 骑手拉取本城可接的池单（接单板用）
- Request: `{ playerId, city }`
- Returns: `{ open: { id, restaurantId, restaurantName, destId, destName, distance, riderFee, customerName, deadlineAt }[] }`
  （`destId/destName/distance` 由服务器按顾客 `destLabel` 反查地点算；顾客位置
  只存地点 id，不存真实坐标。）
- Server: `status = "open"` 且 `deadlineAt > now`，排除自己的单，最多 20 条；
  顺手把过期的 open 单置 `expired`。

### `deliveryPoolClaim` — 骑手接单
- Request: `{ playerId, city, poolId: number }`
- Returns: `{ ok, error? }`
- Server: 仅当 `status = "open"` 时原子置 `taken` + `riderId` + `takenAt`；
  骑手手上 `taken` 的池单最多 2 单；需账号（同 gig 规则，`socialNeedsAccount()`）；
  顾客本人不能接自己的单。

### `deliveryPoolPickedUp` — 骑手取餐（可选，用于顾客端状态同步）
- Request: `{ playerId, poolId }` → `{ ok, error? }`
- Server: `riderId = me` 且 `status = "taken"` → `status = "pickedUp"`。

### `deliveryPoolDelivered` — 骑手送达，结算
- Request: `{ playerId, poolId, stars?: number(1–5, 顾客事后打分另调接口) }`
- Returns: `{ ok, error?, pay, tip }`
- Server: `riderId = me` 且 `status ∈ ("taken","pickedUp")` → `status = "delivered"`；
  准时（`now ≤ deadlineAt`）付全 `riderFee`，超时付 70%；小费 25% 概率 ¥3–10
  （服务器随机，`Math.random` 同客户端约定）；`creditMoney(riderId, pay, "delivery")`；
  骑手评分/完成数记入 `players`（或新表 `delivery_riders`，见下）；顾客订单由
  客户端 `advanceOrder` 本地推进到 delivered（服务器不推客户端状态）。

### `deliveryPoolRate` — 顾客给骑手/订单打星
- Request: `{ playerId, poolId, stars: number(1–5) }`
- Returns: `{ ok, error? }`
- Server: 仅订单顾客本人、仅 `delivered` 后 24h 内、一次；更新骑手 rating
  （5★ +0.02 / 4★ +0.01 / 3★ −0.05 / ≤2★ −0.12，与客户端 `deliverGig` 一致，
  clamp 3.0–5.0）。

### `deliverySponsorSlot` — 商家赞助餐厅进外卖列表（Lagos gap: merchant-sponsor）
- Request: `{ token (admin, 同 adminBillboard), city, restaurant: { name, cuisine, emoji, tier, dishes: { name, cost, energy, mood, desc }[] }, days: number }`
- Returns: `{ ok, error?, sponsorId? }`
- Server: insert `delivery_sponsors`（见 schema）；客户端 `deliveryMenu()` 下一轮
  加 `sponsored` 标记位即可展示（本轮未接，因为需要 admin UI + 审核）。

### Schema (new tables, Drizzle — area S to write the migration)
```sql
-- 共享单池
delivery_pool_orders (
  id integer PK autoincrement,
  city text,                       -- 'sz' | 'hz' | 'hk'
  customerId text, customerName text,
  restaurantId text, restaurantName text,
  itemsJson text,                  -- [{name, qty}]
  total integer, riderFee integer,
  destId text, destName text, distance real,
  status text,                     -- open | taken | pickedUp | delivered | expired | cancelled
  riderId text null, riderName text null,
  createdAt datetime, deadlineAt datetime,
  takenAt datetime null, deliveredAt datetime null,
  tip integer default 0, stars integer null
);
-- 骑手档案（跨设备同步；客户端 CourierProfile 是本地镜像）
delivery_riders (
  playerId text PK,
  rating real default 5.0,
  completed integer default 0, onTime integer default 0,
  late integer default 0, cancelled integer default 0,
  totalEarned integer default 0
);
-- 商家赞助餐厅
delivery_sponsors (
  id integer PK autoincrement,
  city text, name text, cuisine text, emoji text, tier text,
  dishesJson text,                 -- [{name, cost, energy, mood, desc}]
  owner text, endsAt datetime, createdAt datetime
);
```
Money note: 顾客下单扣款仍在客户端（与现有 `orderFood` 一致，business-plan
已注明 client-calculated 风险）；服务器只托管骑手配送费（`riderFee` 由
`deliveryPoolPublish` 时从顾客处预扣进 escrow 更干净——建议 area S 实现时把
`riderFee` 在 publish 时 `creditMoney(customer, -riderFee, "delivery escrow")`，
delivered 时付给骑手，expired/cancelled 时退回顾客；这样池单才有真钱可分。
客户端 `placeOrder` 的 `deliveryFee` 与 escrow 金额要对上：`riderFee =
max(3, deliveryFee)`，`poolPayloadFor()` 已按此算好。）

## Files
- Created: `client/src/round2/delivery.ts` (only file touched)
- Log: `ROUND2-LOG-h.md` (this file)
- NOT edited: `App.tsx`, `data.ts`, `LifeStage.tsx`, `MapView.tsx`, `server/`,
  `ROUND2-CHANGELOG.md` (coordinator merges)

## Open items / follow-ups
- [ ] Integration agent: apply snippets 1–7 (5's cart state must be hoisted;
  7's `setCourierBoard` state is new). Keep `orderFood`/`orderDelivery` — the
  venue fold still uses them.
- [ ] Area S: 6 pool endpoints + 3 tables (spec above). Escrow decision noted.
- [ ] Next round (documented gaps): `deliverySponsorSlot` client display,
  creator payout (Livehouse 打赏/点歌分成，复用 `sendGift`), group-order
  （室友拼单）, `weeklyDeliveryQuest` 留存任务.
- [ ] Browser-verify after integration: 下单 → 5–8 分钟状态机推进 → 送达开吃；
  跑单板接单 → 取餐 → 送达结算；会员/券抵扣；跨城菜单切换。
