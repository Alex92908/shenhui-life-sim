# ROUND-2 LOG — area (e) open-ended economy （转租 / 海淘 / 贱买贱卖 / 二手家具 / 玩家交易贴）

Date: 2026-11-11. Branch: `feature/round-2`. Baseline: commit 32348ca.
Author: area (e) agent. Do NOT edit ROUND2-CHANGELOG.md — coordinator merges.

## Files created / touched

- CREATED: `client/src/round2/economy.ts` (1237 lines, pure TS, zero imports
  from App.tsx / data.ts / LifeStage.tsx / server — no coupling, no breakage risk).
- CREATED: this log, `ROUND2-LOG-e.md`.
- TOUCHED NOTHING ELSE. No push, no main, no build run (per task).

## Per-feature status — all 5 done (local logic complete)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Subletting （转租） | DONE | Post / accept / end tenancy, weekly rent payout, landlord-suspicion meter, `LandlordPort` hook to area (d), offline fallback `defaultLandlordCheck` (warning only, never surprise eviction). Soft warning — never a hard block — when sublet price > own rent. |
| 2 | Overseas shopping （海淘） | DONE | 8-item starter catalog (JP/KR/HK/US/EU), order → ship → customs → arrive over N game days, duty with ¥500 duty-free allowance, 15% customs-hold chance (+2 days), duty paid on arrival only (never auto-deducted), resale values for resellable items. |
| 3 | Buy-cheap-sell-cheap （贱买贱卖） | DONE | Buy / repair / clean / sell loop with condition, fix costs, suggested 10–30% margin, ±10% haggle, daily condition decay, lifetime turnover stats, rotating daily flea stock (`dailyCheapStock`). Explicitly distinct from existing phone/ticket flip (activities.ts "flip": buy low sell HIGH) — this is volume, small margins, quick turnover; buys capped at ¥5000 to keep it the cheap loop. |
| 4 | Second-hand furniture （二手家具） | DONE | Flea market actually sells used furniture now (`dailyUsedFurnitureStock`, 8 pieces anchored to real ZhuyaHome catalog prices in data.ts — e.g. 布艺三人沙发 new ¥4800 → used ¥480–900). Buy → piece enters `GameState.furniture` via catalog `baseId` (or its own id for one-off pieces); condition-driven comfort + resale price; resell returns cash. |
| 5 | Player-issued trade tasks | DONE (key piece) | Free text + free price + free tags, NO fixed category enum — the whole point vs the billboard's four fixed categories (hiring / rooms / sales / day-labor, Social.tsx `BillboardModal`). Post / search (free-text substring + price range + kind/city filters) / accept / escrow / complete / cancel / dispute (`DisputePort` hook to area d) / auto-expiry. Escrow frozen on dispute, never released by this module. |

## Fees (light, no pay-to-win)

- Posting a sublet / trade task / cheap-goods ad: free.
- Player-to-player trade completion: **0% cut** — the game takes nothing.
- Overseas: flat ¥25 shipping + duty as assessed (¥500 duty-free allowance).
- Flea resale cut: 0% now (capped at 5% ever, client warns).
- Only paid knob is optional promotion via the existing billboard (300 ✨/week, Social.tsx) — never required, never a cut of the trade. See `FEES` / `feeNote()` in economy.ts.

## Typecheck

`cd standalone && npx tsc --noEmit -p tsconfig.json`
- `economy.ts`: **0 errors** (verified in two runs; one unused-variable error
  found in the first run was fixed in place).
- Whole-project runs show 5–7 errors that CHANGE between runs (community.ts /
  delivery.ts in one run; LifeStage.tsx / data.ts / house.ts in the next) —
  other round-2 agents are editing concurrently. None are in economy.ts and
  none were touched by this agent. Integration agent to re-run after all
  areas land.

## Design decisions worth knowing

- Open-ended on purpose: sublet price/terms, trade-task title/body/price/tags,
  cheap-goods notes are all free text; the only hard blocks are nonsense
  numbers and anti-spam caps (10 open trade tasks/player, 60-char titles).
- Money movement is the caller's job: every mutating helper returns what to
  add/deduct (`depositDue`, `chargeNow`, `received`, `releaseTo`/`releaseAmount`,
  `refundTo`/`refundAmount`) and App.tsx applies it to `GameState.money`.
  Offline-first: all five systems work with no server; the server (area S)
  becomes the source of truth for shared listings/tasks later.
- IMPORTANT finding for escrow: the existing `sendGift` path CANNOT carry
  trade escrow as-is — `server/src/actions.ts` `sendGift` uses
  `z.enum(GIFT_KINDS)` (no escrow kind), caps amount at ¥5000, and caps at
  10 gifts/day. So the server spec below asks for DEDICATED escrow endpoints
  with their own ledger, not a gift-kind hack.

## Integration snippets for App.tsx (integration agent applies)

### S0. Import + state (top of App.tsx, near the other round-2 imports)

```ts
import {
  emptyEconomyState, economyDailyTick,
  type EconomyState,
} from "./round2/economy";
```

Add one field to the save alongside `GameState` (same place `gs` is built /
restored, ~line 1411 `mutate` / ~line 1588 save-shape). Persist it as plain
JSON — every type in `EconomyState` is JSON-safe:

```ts
// in the component state, next to `const [s, setS] = ...` / save shape:
const [econ, setEcon] = useState<EconomyState>(() => emptyEconomyState());
```

### S1. Daily tick (where the game day advances — same spot the day-change
### effects run, e.g. next to rent deduction)

```ts
// once per game-day advance, after `day` is known:
const tick = economyDailyTick(econ, s.day, s.rent);
setEcon(tick.state);
if (tick.subletRentDue > 0) mutate((x) => { x.money += tick.subletRentDue; x.earned += tick.subletRentDue; });
tick.events.forEach((e) => addLog(e));
// overseas arrivals: grant the items — e.g. add to a simple inventory /
// furniture when the item is a home good, else log + mood:
for (const o of tick.overseasArrived) {
  addLog(`📦 ${o.item.name}×${o.qty} 到货了。`);
  if (o.item.category === "home") mutate((x) => { x.mood = Math.min(100, x.mood + 3); });
}
```

### S2. Phone app entry — "交易" (trade) app (APPS list, ~line 6400 phone render)

Add to the `APPS` array (same shape as the other entries, `{ id, n }`):

```ts
{ id: "trade", n: "交易" },   // emoji shown by the phone grid: 🛒
```

In the phone-modal render (the `phoneApp === ...` switch near line 6400),
add a branch that renders the trade board from `econ.tradeTasks` using
`searchTradeTasks` / `postTradeTask` / `acceptTradeTask` from economy.ts,
plus the overseas catalog (`OVERSEAS_CATALOG`, `placeOverseasOrder`) as a
second tab ("海淘"). Posting a task calls `postTradeTask`, then
`setEcon(...)` with the returned book and `showToast(...)` with the events.
Accepting calls `acceptTradeTask`; escrow/completion call `escrowTradeTask` /
`completeTradeTask` and then the matching server endpoint below (S-spec §5).

### S3. Billboard — link out to free-text trade tasks (menu button ~line 4700,
### BillboardModal mount ~line 5970)

The billboard keeps its four fixed categories (do NOT change
`BillboardModal`). Add one line inside/above it and one menu entry:

```tsx
// next to the "📢 广告牌" menu button (~line 4700):
<button type="button" className="menu-item" onClick={() => { setPhoneOpen(true); setPhoneApp("trade"); }}>🛒 {en ? "Trade board" : "交易板"}</button>
```

```tsx
// inside BillboardModal's footer (Social.tsx) — or as a line under the
// modal mount at App.tsx:5970 — integration agent's choice:
<p className="mt-1 text-xs text-[var(--dim)]">想发不限分类的买卖贴？去手机 → 交易板，标题价格随便写。</p>
```

### S4. Flea market — used furniture + cheap goods (venue action for
### 桥东二手市集 / 华强北， near the market venue handlers)

```ts
import { dailyUsedFurnitureStock, buyUsedFurniture, dailyCheapStock, buyCheapGood, suggestCheapPrice } from "./round2/economy";

// in the flea-market venue panel (per-day stock; `s.day` rotates it):
const usedStock = dailyUsedFurnitureStock(s.day);
const cheapStock = dailyCheapStock(s.day);

// buying a used piece (caller moves money):
const r = buyUsedFurniture(econ.usedFurniture, piece);
if (r.ok && s.money >= piece.price) {
  setEcon({ ...econ, usedFurniture: r.value.book });
  mutate((x) => { x.money -= piece.price; x.furniture = [...x.furniture, r.value.furnitureIdToAdd]; });
  r.value && r.events.forEach((e) => addLog(e));
}
// reselling a used piece you own (furnitureIdToRemove drops it from home):
//   const rr = resellUsedFurniture(econ.usedFurniture, pieceId, paidPrice, conditionNow);
//   mutate((x) => { x.money += rr.value.received; x.furniture = x.furniture.filter((f) => f !== rr.value.furnitureIdToRemove); });
```

Note: one-off pieces (baseId null) are stored in `GameState.furniture`
under their own `usedfurn-…` id. `placedFurn` / `furnById` (~App.tsx:336,
385) must tolerate an unknown id (treat comfort as
`USED_FURNITURE.comfortAtCondition(10, condition)` and skip the style
filter) — otherwise a one-off piece crashes the home render. That tolerance
is the ONLY App.tsx behaviour change this feature needs.

### S5. Subletting — home panel (near the "我的家 · 3D" button ~line 3944 and
### the rent handling)

```tsx
// under the home button (~line 3944), when the player rents (not ownFlat):
<button type="button" onClick={() => setPhoneApp("trade") /* or a sublet panel */} className="...">🚪 {en ? "Sublet a room" : "转租出去"}</button>
```

```ts
// posting (from the sublet form; `s.rent` is the soft-warning input):
import { postSubletListing, acceptSublet, endSublet } from "./round2/economy";
const r = postSubletListing(econ.sublets, {
  owner: { playerId: prof.playerId, name: profile.name },
  homeLocId: "home", city: s.cityKey, space: "room",
  monthlyPrice, deposit, terms, minDays, maxDays,
  availableFromDay: s.day, ownMonthlyRent: s.rent, createdDay: s.day,
});
if (r.ok) { setEcon({ ...econ, sublets: r.value.book }); r.value && r.events.forEach((e) => addLog(e)); }
else showToast(r.error!);
```

Landlord hook (area d): when area (d) lands, App.tsx passes its
implementation as `LandlordPort` (`onSuspicion` / `onDiscovered`) and calls
`defaultLandlordCheck` ONLY until then. Same pattern for disputes:
`DisputePort` (`openDispute`) — until then `disputeTradeTask` without a port
just freezes the task + escrow.

## Server endpoint spec for area S (server/src/actions.ts + schema.ts)

Conventions to follow: `defineAction` + zod, same as `getGigs`/`postGig`
(server/src/actions.ts:1359–1405) and `getBillboards`/`buyBillboard`
(:1492–). New tables: `tradeTasks`, `subletListings`, `overseasOrders`,
`cheapGoods` (or reuse a generic `marketListings`), `usedFurniture`,
`tradeEscrow` (own ledger — see the sendGift finding above). All endpoints
take `playerId` (server session id, as existing actions do) and return
`{ ok, error? , ... }`. Client functions in economy.ts already mint local
ids — the server may mint its own and the client adopts them.

### §5.1 Trade tasks (the key piece)

- `getTradeTasks({ city?, kind?, text?, minPrice?, maxPrice?, openOnly?, limit? })`
  → `{ ok, tasks: TradeTask[] }` — server-side mirror of `searchTradeTasks`.
  `text` is a substring match over title/body/tags. No category enum.
- `postTradeTask({ playerId, kind, title, body, price?, negotiable?, tags?, city?, expiresInDays? })`
  → `{ ok, error?, task? }` — same validation as client `postTradeTask`
  (title ≤ 60 chars, body ≤ 500, price 0 < p ≤ 1,000,000 or null, ≤ 10 open
  per player). Store free text verbatim; no category mapping.
- `acceptTradeTask({ playerId, taskId })`
  → `{ ok, error?, task? }` — only if status open and accepter ≠ poster.
- `escrowTradeTask({ playerId, taskId, amount })`
  → `{ ok, error?, task? }` — NEW dedicated ledger, NOT sendGift (gift caps:
  ¥5000 max, 10/day). Deduct `amount` from payer's money, hold in
  `tradeEscrow` row linked to the task. Amount must equal the task price
  when priced;面议 tasks need an agreed amount (both sides confirmed —
  accept a `counterAmount` + poster-confirm step if you want it strict;
  minimum viable: payer states amount, poster must confirm via
  `confirmTradeAmount` — or skip and let the poster cancel if unhappy).
- `completeTradeTask({ playerId, taskId, note? })`
  → `{ ok, error?, releasedTo?, releasedAmount? }` — either party confirms;
  release escrow to the seller side (sell-task → poster; buy/swap/service/
  other → accepter). Zero-escrow tasks just flip status.
- `cancelTradeTask({ playerId, taskId })`
  → `{ ok, error?, refunded? }` — refund escrow to payer if held.
- `disputeTradeTask({ playerId, taskId, reason })`
  → `{ ok, error?, caseId? }` — freeze task + escrow, hand to area (d)'s
  dispute/jury flow (`juryVote` already exists — reuse it).
- `getMyTradeTasks({ playerId })` → `{ ok, tasks }` — poster's + accepter's.

### §5.2 Subletting

- `getSubletListings({ city?, space?, maxPrice?, openOnly? })`
  → `{ ok, listings: SubletListing[] }`.
- `postSublet({ playerId, homeLocId, city, space, monthlyPrice, deposit, terms, minDays, maxDays, availableFromDay })`
  → `{ ok, error?, listing? }` — same validation as client; record the
  poster's own rent at posting time for the markup-suspicion rule.
- `acceptSublet({ playerId, listingId })`
  → `{ ok, error?, listing?, depositDue? }` — move deposit from tenant to
  escrow (held, not spent — reuse the `tradeEscrow` table with kind
  "sublet-deposit").
- `endSublet({ playerId, listingId, damage?, reason? })`
  → `{ ok, error?, depositReturned?, depositKept? }` — return/keep deposit
  by damage %.
- `collectSubletRent({ playerId })` (called by the daily tick / a cron)
  → `{ ok, paid: { listingId, amount }[] }` — weekly payout
  (monthlyPrice × 7/30) from tenant to owner; if the tenant can't pay,
  mark the tenancy "late" (do NOT auto-evict — area (d) / negotiation).
- Landlord feed: `landlordSuspicion` lives on the listing/owner row; area
  (d) reads it for warnings/fines/eviction. No endpoint needed from (e)
  beyond exposing the field in `getSubletListings` / a `getMySublets`.

### §5.3 Overseas shopping

- `getOverseasCatalog()` → `{ ok, items: OverseasItem[] }` — server copy of
  `OVERSEAS_CATALOG` (server is free to extend it; client falls back to its
  local list when offline).
- `placeOverseasOrder({ playerId, itemId, qty })`
  → `{ ok, error?, order?, chargeNow? }` — charge goods + ¥25 shipping now;
  roll `shipDays` in [min, max]; set `etaDay`. Qty ≤ 5.
- `getOverseasOrders({ playerId })` → `{ ok, orders }`.
- `payOverseasDuty({ playerId, orderId })`
  → `{ ok, error?, dutyPaid? }` — only from status customs/held; on payment
  the order becomes arrived (next tick delivers).
- Daily server tick (existing day-advance path): advance statuses, roll the
  15% customs hold (+2 days), mark arrivals. Duty = max(0, goods − 500) ×
  dutyRate. No auto-deduction anywhere.

### §5.4 Buy-cheap-sell-cheap + used furniture (flea market)

- `getFleaStock({ city, day })`
  → `{ ok, cheap: CheapGood[], usedFurniture: UsedFurniture[] }` — server
  mirror of `dailyCheapStock` / `dailyUsedFurnitureStock` (seeded by day so
  the market rotates; player listings mix in on top when §5.1 exists).
- `buyCheapGood({ playerId, goodId })` → `{ ok, error?, good? }` — deduct
  buyPrice, add to player's cheap-stock. (Repair/clean/sell are local-only
  until a shared market exists: `repairCheapGood` / `cleanCheapGood` /
  `sellCheapGood` need no server in v1 — the sale is to an NPC buyer. If
  area S wants them server-side later, the client functions already return
  cost/received/profit.)
- `buyUsedFurniture({ playerId, pieceId })`
  → `{ ok, error?, piece?, furnitureIdToAdd? }` — deduct price; the client
  adds `furnitureIdToAdd` (catalog baseId or the piece's own id) to
  `GameState.furniture`. Server must ALSO record the used piece against the
  player (condition + paid price) so resale pricing works after reload.
- `resellUsedFurniture({ playerId, pieceId, conditionNow })`
  → `{ ok, error?, received?, furnitureIdToRemove? }` — price = paid ×
  conditionNow/conditionThen (cut 0% now).
- `listUsedFurniture({ playerId, baseId?, name, emoji, room, condition, price, note })`
  → `{ ok, error?, piece? }` — lets a player sell their own old furniture
  into the flea market (the other half of system 4; v1 can ship with NPC
  stock only and add this second).

### §5.5 Shared rules for area S

- No real money, no Starlight ✨, in any of these endpoints. No pay-to-win.
- Free-text fields (task title/body, sublet terms, notes) are stored verbatim;
  reuse the existing moderation/report path (`reportPlayer` exists) rather
  than inventing a new filter — but DO enforce the length caps server-side.
- All money moves go through the existing ledger helper (`writeLedger`,
  actions.ts:398) so the anti-cheat audit trail stays intact.
- Rate limits: reuse the existing per-player daily caps pattern (gifts use
  10/day) — suggest 20 trade-task posts/day, 10 sublet listings active max.
  Do NOT apply the gift 10/day or ¥5000 caps to escrow.

## Open questions for the coordinator / area S (not blockers)

1. Escrow amounts above ¥5000: dedicated ledger (recommended) removes the
   gift cap entirely — confirm area S agrees, or cap trade-task prices at
   ¥5000 in v1.
2. One-off used furniture (baseId null) in `GameState.furniture`: needs the
   small `furnById`/`placedFurn` tolerance in S4 — integration agent to
   confirm it doesn't break the ZhuyaHome style filter.
3. NPC tenants/buyers for sublets + cheap goods when no other player bites:
   v1 ships with player-to-player only + NPC flea stock; an NPC-taker
   fallback (like the existing NPC gig economy) would make the loop work
   solo — worth a follow-up, not required for launch.
