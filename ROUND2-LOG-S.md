# ROUND2-LOG-S — Server endpoints (area S)

Date: 2026-11-11. Branch: `feature/round-2` (local only — nothing pushed, main untouched).
Scope: ALL round-2 server endpoints for areas (c) pets/community, (d) black landlord/company,
(e) economy, (f) lifestyles, (h) delivery pool. (g) and (b) need no endpoints.

## Files changed

| File | Change |
|---|---|
| `server/src/actions.ts` | +~2,200 lines: round-2 helpers + 66 endpoints (see table below). No existing action touched. |
| `server/src/schema.ts` | +~400 lines: 35 new round-2 tables (see below). |
| `drizzle/0019_round2_server.sql` | NEW (449 lines): CREATE TABLE for all 35 tables + indexes. |
| `drizzle/meta/_journal.json` | Appended entry `{idx: 18, version: "6", when: 1795600000000, tag: "0019_round2_server", breakpoints: true}`. |
| `ROUND2-LOG-S.md` | This file. |

## Verification

- `cd ~/workspace/shenhui-life-sim/standalone && npx tsc --noEmit -p tsconfig.json` → **0 errors, exit 0** (2026-11-11).
- First run had 50 errors, all in the new (f)/(h) code (plus 1 in (c) `noticeView`);
  all fixed by aligning to the real schema/helper shapes (see "Typecheck fixes" below).
- `npm run build` NOT run (coordinator runs the final build).

## New tables (all in schema.ts + migration 0019)

- (c) `strays`, `stray_feeds` (PK stray+player+day), `player_pets`, `notices`, `notice_replies`,
  `snake_reports`, `snake_confirms` (PK report+player), `fishing_spots`, `fishing_confirms` (PK spot+player)
- (d) `black_reports`, `black_report_votes` (PK report+voter), `black_reputations` (PK target+kind),
  `reporter_standing`, `black_rent_rollbacks`
- (e) `trade_tasks`, `trade_escrow` (kind trade|sublet-deposit|delivery; status held|released|refunded|frozen),
  `sublet_listings`, `overseas_orders`, `used_furniture_owned`, `cheap_goods_owned`, `used_furniture_listings`
- (f) `lifestyle_states`, `job_applications`, `course_enrollments`, `course_allowance_days`,
  `guidance_sessions`, `trials`, `trial_days`, `flat_gigs`, `stalls`, `sanhe_shift_logs`
- (h) `delivery_pool_orders`, `delivery_riders` (rating ×100, 500 = 5.00), `delivery_sponsors`

## Per-endpoint status

Status: ✅ implemented. Nothing skipped, nothing left not-done.

### (c) Pets / community — 14/14 ✅

| Endpoint | Status | Notes |
|---|---|---|
| getStrays | ✅ | Banned → error + empty; same-city; `ensureStrays` tops up to 4 unadopted/city from real park/beach loc pools; trust decays 5/day unfed (mirrors client) |
| feedStray | ✅ | Rate-limited (see below); once/day/player via `stray_feeds` PK; trust += 15/10/8 by temper, cap 100; "它好像愿意跟你回家了" at ≥70 |
| adoptStray | ✅ | Trust ≥70; atomic `update … where adopted=0 returning` |
| syncPets | ✅ | Stores full pets JSON (≤3) in `player_pets`; `adoptedStrayId` marks stray adopted |
| postNotice | ✅ | Kind enum; title ≤30 / body ≤200; ≤5/player/day; TTL 7d |
| getNotices | ✅ | City, open + unexpired, newest first, ≤50 |
| replyNotice | ✅ | Notice must be open/unexpired; text ≤200 |
| claimNotice | ✅ | Author only; open → claimed + claimedByName |
| reportSnake | ✅ | ≤3/player/hour; speciesGuess ≤20, description ≤200; TTL 3d |
| getSnakeWarnings | ✅ | City, unexpired, confirmations desc, ≤50 |
| confirmSnake | ✅ | Once/player/report via PK; confirmations+1, expiresAt +1 day; ≥2 = verified (client flag) |
| reportFishingSpot | ✅ | ≤5/day; duplicate within ~1 world unit (~100 m assumption) refused with `existingSpotId` |
| getFishingSpots | ✅ | City, all incl. stale, ≤100 |
| confirmFishingSpot | ✅ | Once/player/spot; confirmations+1, lastConfirmedAt=now |

Shared write rate-limit across (c): ≤10 writes/player/minute, in-memory `Map` per server
process (same pattern as the world cache — resets on restart; a DB-backed limit is a follow-up).

### (d) Black landlord / company — 4/4 + settle ✅

| Endpoint | Status | Notes |
|---|---|---|
| fileBlackReport | ✅ | Via shared `fileBlackReportInner`; body 10–600; credibility ≥50; no lockout; ≤3 open; 1 filing/kind/24h; dueAt now+24h; evidence ≤4000 chars JSON |
| getBlackReports | ✅ | Settles first; returns `mine` (≤20), `jury` (≤20, not reporter), `exposed` (≤20 upheld), `reputations` (≤50 for city), **plus extras `standing` and `rentRollback`** (see integration notes) |
| blackReportVote | ✅ | Mirrors `juryVote` exactly (open, not reporter, same-city, banned/muted, account gate, upsert changeable vote) |
| claimBlackReport | ✅ | Settles first; reporter only; single-claim guard (claimGigMoney pattern). Upheld landlord: rent rolled back to evidence.baseRent, deposit returned, 1 week overcharge refunded, fine 200. Upheld employer: backPay min(2000, claimedUnpaid), listing flagged, hiring suspended if upheldCount ≥2, fine 500. Rejected: credibility −25, 7d lock if <50. Expired: money 0, "无法证实". |
| settleBlackReports(db) | ✅ | Mirror of `settleGigs`: due open reports; total<3 → expired; uphold>reject → upheld; reject>uphold → rejected; tie → expired. **Reputation updated at settle time** (not claim time), idempotent via `where status='open'`; upheld −20 score/+1 upheld/flaggedUntil +7d; rejected +5/+1 rejected |

### (e) Economy — 23/23 ✅ (22 spec + 1 bonus)

| Endpoint | Status | Notes |
|---|---|---|
| getTradeTasks | ✅ | Free-text substring over title/body/tags; kind/city/price filters; openOnly default true; ≤50 |
| postTradeTask | ✅ | Title ≤60, body ≤500, price 0<p≤1,000,000 or null (面议), tags ≤5×≤10; free; ≤10 open/player; account gate |
| acceptTradeTask | ✅ | Open only, not own, same-city unless task city "any"; atomic |
| escrowTradeTask | ✅ | Accepted only; amount must equal task price when priced; `creditMoney(-amount)` + `trade_escrow` row (kind trade). **Dedicated ledger, NOT sendGift** (gift kinds cap ¥5,000, 10/day) |
| completeTradeTask | ✅ | Either party confirms; escrow released to seller side (sell-task → poster, else accepter); 0% cut |
| cancelTradeTask | ✅ | Poster (open) or either side (accepted); escrow refunded to payer |
| disputeTradeTask | ✅ partial* | Freezes task + escrow (status frozen), returns `caseId = trade-<id>`. *No jury adjudication wired yet — frozen money stays frozen until a dispute-case flow is built (follow-up, see below) |
| getMyTradeTasks | ✅ | Poster + accepter, ≤50 |
| getSubletListings | ✅ | City/space/max-price filters; includes `suspicion` + `late` fields |
| getMySublets | ✅ bonus | Owner listings + tenant tenancies (spec §5.2 mentions it) |
| postSublet | ✅ | Records poster's `ownMonthlyRent` for the markup-suspicion rule; price above it only warns, never blocks; ≤10 active |
| acceptSublet | ✅ | Open, not own, day ≥ availableFromDay (tenant's gameDay); deposit → escrow (kind sublet-deposit) via `creditMoney` |
| endSublet | ✅ | Owner or tenant; depositKept = deposit×damage/100, remainder to tenant, kept to owner |
| collectSubletRent | ✅ | Owner daily tick; per taken listing due every 7d: payout = round(monthlyPrice×7/30); tenant pays, owner credited; tenant can't pay → `rentLate=1`, **no eviction**; suspicion +2/day (+4 more if priced above own rent), cap 100; returns `{paid: [{listingId, amount}], late: [listingId]}` |
| getOverseasCatalog | ✅ | Server copy of OVERSEAS_CATALOG (8 items); no playerId in spec, returns data directly |
| placeOverseasOrder | ✅ | Charges goods + ¥25 shipping now; shipDays rolled in [min,max]; etaDay = gameDay + shipDays; dutyDue = max(0, goods−500) × dutyRate; qty ≤5 |
| getOverseasOrders | ✅ | Statuses advanced lazily on read (`advanceOverseasOrders`: ordered→shipped; ETA reached → 15% customs hold if dutyDue>0 and !heldOnce → held +2d, else dutyDue>dutyPaid → customs, else arrived) |
| payOverseasDuty | ✅ | Only from customs/held; charges dutyDue−dutyPaid; → arrived. Duty is never auto-deducted |
| getFleaStock | ✅ | `{city, day}`; cheap + used furniture from day-seeded server stock + open player listings for the city |
| buyCheapGood | ✅ | Validates goodId against `dailyCheapStockServer(gameDay)`; ≤¥5,000 by construction; recorded in `cheap_goods_owned` |
| buyUsedFurniture | ✅ | Validates pieceId against `dailyUsedFurnitureStockServer(gameDay)` **(server deterministic id — see integration notes)** or a player listing (`usedfurn-p-<id>`); seller paid on player-listing sale; recorded in `used_furniture_owned`; returns `furnitureIdToAdd` (baseId ?? piece id) |
| resellUsedFurniture | ✅ | Must own the piece; received = round(paid × conditionNow/conditionThen), 0% cut; deletes owned row; returns `furnitureIdToRemove` |
| listUsedFurniture | ✅ | Inserts into `used_furniture_listings` (status open); returns piece with server id `usedfurn-p-<id>` |

### (f) Lifestyles — 17 spec + 1 extra ✅

Spec-count note: `LIFESTYLE_SERVER_SPEC` in lifestyles.ts has **17 keys, not 18** as
ROUND2-LOG-f.md claims. All 17 are implemented.

| Endpoint | Status | Notes |
|---|---|---|
| getLifestyle | ✅ | From `lifestyle_states`; `life: null` on first run |
| saveLifestyle | ✅ | Validates object with flat/sanhe; hope clamped 0–100, moodCapBonus 0–15 |
| listJobBoard | ✅ | 14 server-mirrored listings + open player gigs for the city (employer name looked up from `players`). **Returns base `payDay` + `cityMul` — client computes city pay** (see integration notes); `listingPayServer` is used in trialDay |
| applyJob | ✅ | Listing must exist; reject if already applied/trial for same listing |
| bookGuidance | ✅ | routeId must be one of the 4 server routes; logs `guidance_sessions` |
| enrollCourse | ✅ | One active at a time; reject if active or already done |
| courseDay | ✅ | Idempotent per (player, course, day) via `course_allowance_days` PK. Allowance ¥30/day **server-computed and returned for the client to apply — NOT a ledger credit** (see money decision below) |
| mockInterview | ✅ | Score 0–6; gain = 8 + score×2; stored in lifestyle JSON (interviewReady clamped 0–100, interviews+1). No penalty path |
| startTrial | ✅ | Needs prior application; no concurrent active trial; interviewReady gate from listing `requires` |
| trialDay | ✅ | Idempotent per (trial, day) via `trial_days` PK; pay = `listingPayServer` (server-computed, returned for client to apply) |
| resolveTrial | ✅ | Needs daysWorked ≥3; hired iff avg ≥60; updates trial + application; returns `identityId` or null. **Failed trial records NO black mark anywhere** |
| postFlatGig | ✅ | Title ≤40, desc ≤200, pay ≥0, kind help\|work; ≤10 open/player |
| listFlatGigs | ✅ | Open, newest first; poster emoji looked up from `players` (flat_gigs has no emoji column) |
| takeFlatGig | ✅ | Open, not own, one taker (atomic) |
| completeFlatGig | ✅ extra | **Not in the client spec** — taker or poster marks a taken flat gig done. `gigAction` only works on the main `gigs` table, so without this the loop never closes |
| openStall | ✅ | Kind must be in `STALL_KINDS_SERVER`; one stall per player |
| reportLandlord | ✅ | Thin wrapper over `fileBlackReportInner` (kind landlord, targetId `home:<city>`); no duplicated adjudication. Returns `reportId` (string) + `dueAt` (ms number), converted from the helper's number/ISO-string return |
| sanheShiftLog | ✅ | shiftId must be in `SANHE_SHIFTS_SERVER`; pay must equal round(sanhePay(city)×payMul) with city = player's city; one per day (PK player+day); **no money moves** — client already paid itself; server log + anti-cheat only |

### (h) Delivery pool — 7/7 ✅

| Endpoint | Status | Notes |
|---|---|---|
| deliveryPoolPublish | ✅ | Banned/muted, same-city, riderFee ≥3, items 1–20; ≤2 open/player; **riderFee escrowed at publish** via `creditMoney(-riderFee)` + `trade_escrow` row (kind delivery); deadlineAt = now+10min |
| deliveryPoolList | ✅ | Expires overdue first (refunds escrow — `expirePoolOrders`); open + deadlineAt>now, exclude own, ≤20; `deadlineAt` returned as ms number; **distance is the stored column (0 — server has no place coords; client must compute it)** |
| deliveryPoolClaim | ✅ | Account gate, same-city, not own, ≤2 taken; atomic update where status open |
| deliveryPoolPickedUp | ✅ | Rider only; taken → pickedUp |
| deliveryPoolDelivered | ✅ | Rider only; taken\|pickedUp → delivered. On-time: full riderFee; late: 70%, remaining 30% refunded to customer. Tip 25% chance ¥3–10 (also stored in the order's `tip` column). Updates `delivery_riders` (completed/onTime/late/totalEarned). Returns `{ok, pay, tip, onTime}` where `pay` = fee portion |
| deliveryPoolRate | ✅ | Customer only, delivered within 24h, once (stars null check). Rating delta 5★+0.02 / 4★+0.01 / 3★−0.05 / ≤2★−0.12, clamp 3.0–5.0 (stored ×100). Returns `riderRating` |
| deliverySponsorSlot | ✅ | Admin only (`adminOk(db, token)`); inserts `delivery_sponsors` with `endsAt = now + days`. No `getDeliverySponsors` read endpoint was spec'd — sponsored display is a next-round item |

## Key design decisions (carry into integration)

1. **Rent rollback persistence (critical, area d).** `players` has no rent columns and cloud
   saves are client-uploaded, so an upheld landlord claim persists the rollback in the new
   table `black_rent_rollbacks` (playerId PK: rent, baseRent, reportId) AND returns it as
   `rentRollback: {rent, baseRent} | null` in `getBlackReports`. **Integration must apply it
   on load** (in addition to the existing `mutate()` in the §5f claim snippet) or a later
   save/load resurrects the raised rent.
2. **(f) money.** No (f) endpoint moves real money. `courseDay` / `trialDay` compute and
   return server-computed amounts (idempotent) but do NOT call `creditMoney`; the client
   applies the returned amount to its local wallet like other client-calculated money
   (the settleMoney earn-budget path accepts it as normal earnings). "Allowance paid
   server-side" in the spec = server-computed + idempotent, not a ledger credit.
3. **Trade escrow.** Dedicated `trade_escrow` table + `writeLedger` via `creditMoney`; NOT
   `sendGift` (z.enum kinds, ¥5,000 cap, 10/day). Escrow freezes on dispute; never released
   from the client side. Player-to-player trade has 0% cut.
4. **Delivery escrow.** `riderFee` escrowed at publish; expired orders refunded in
   `deliveryPoolList` via `expirePoolOrders`; late delivery pays 70% of fee, 30% refunded.
5. **Flea stock determinism.** Server mirrors the client's seeded stock exactly so buy
   endpoints verify price instead of trusting the client; stock ids are deterministic
   (`cheap-<day>-<i>`, `usedfurn-<day>-<i>`). **Client must use the server ids from
   `getFleaStock` for `buyUsedFurniture`** — the client's locally minted `usedfurn-…` ids
   won't validate.
6. **Catalog-style reads with no playerId in spec** (`getFleaStock({city, day})`,
   `getOverseasCatalog()`, `listJobBoard({city})`): no player/banned check possible; data
   returned directly.
7. **Read endpoints for banned players** return `{ok:false, error: BANNED_MSG, <empty lists>}`;
   write endpoints check player exists + banned + muted (+ account gate where the existing
   pattern calls for it).
8. **Delivery `destId`/`distance`.** Server has no place-coordinate data. `deliveryPoolPublish`
   accepts optional `order.destId`; `distance` is stored/returned as 0 and the client must
   compute distance from its own place data. `destName` = `destLabel`. `placedAt` is accepted
   in the publish request but not stored (no column).
9. **`listJobBoard` pay.** Returns the base listing (`payDay` + `cityMul`); the client
   computes the city-adjusted pay as before. `trialDay` pay IS server-computed
   (`listingPayServer`, city-adjusted) and returned for the client to apply.
10. **Fishing-spot "~100 m"** mapped to 1 world unit (map spans ~38 units) — assumption.
11. **`reportLandlord` reasons** are 乱涨租 | 扣押金 | 断水不修 | 赶人 (landlord only in the
    request enum; `target` employer is accepted by the zod shape but the handler always
    files kind landlord — employer reports go through `fileBlackReport` directly).

## Typecheck fixes (first run: 50 errors → 0)

The first `tsc` run exposed that several helper/table shapes differ from the spec
summaries; all fixed in `actions.ts` (no schema changes needed — schema.ts was already
right):

- `COURSES_SERVER` and `SANHE_SHIFTS_SERVER` are `Record<string, …>` maps, not arrays
  (index by id; `COURSES_SERVER[id] = {days, allowanceDay, skillGain}`,
  `SANHE_SHIFTS_SERVER[id] = payMul`).
- `course_enrollments` columns are `days` / `done` (0/1) / `allowancePaid` — not
  `daysDone` / `status`. `course_allowance_days` has no `allowance` column.
- `guidance_sessions` has no `city` or `day` column.
- `flat_gigs` has no `posterEmoji` / `createdDay` columns (poster emoji is looked up from
  `players` in `listFlatGigs`).
- `stalls` and `sanhe_shift_logs` require `city`; `delivery_riders` has no `createdAt`
  (use `updatedAt`); `delivery_sponsors` uses `endsAt` (Date), not `startDay`/`days`.
- `delivery_pool_orders` has `destName` (not `destLabel`), no `placedAt` column, and
  `deadlineAt`/`takenAt`/`deliveredAt` are `Date` (timestamp_ms) — compare with `.getTime()`.
- `listingPayServer` takes the listing object, not an id string.
- `JOB_LADDER_SERVER` / `COUNSELOR_ROUTES_SERVER` are `as const` — handlers return mutable
  copies (`[...tuple] as [string, string]`, `{...requires}`).
- `gigs` has no `employerName` column — employer name looked up from `players`.
- `fileBlackReportInner` takes no `title` and returns `{reportId?: number, dueAt?: string}`;
  `reportLandlord` converts to `{reportId: string, dueAt: number}`.
- `adminOk` is async and takes `(db, token)` — `await adminOk(db, args.token)`.
- `loadLife` returns `null` on first run — handlers default to `{flat: {}, sanhe: {}}`.
- (c) `noticeView`: annotated the reply-map parameter
  (`(x: typeof schema.noticeReplies.$inferSelect)`).

## Follow-ups for the integration agent (not blockers)

- **Trade-dispute jury:** `disputeTradeTask` freezes escrow and returns `caseId = trade-<id>`,
  but no dispute-case table wires trade disputes into the (d) jury flow yet. Frozen money
  stays frozen until that adjudication is built — do not release it client-side.
- **No `getDeliverySponsors` read endpoint** was spec'd; sponsored-restaurant display is
  deferred to next round.
- Community write rate-limit is in-memory per process (resets on restart); a DB-backed
  limit would survive restarts.
- `buyUsedFurniture` requires the server deterministic stock id from `getFleaStock`.
- `getBlackReports` extras (`standing`, `rentRollback`) are unknown fields to the client
  type — integration must read them explicitly (see decision 1).
- `collectSubletRent` returns `{paid, late}`; the client should call it on the daily tick.
- `deliveryPoolDelivered` returns `{pay, tip, onTime}`; `pay` is the fee portion only,
  `tip` is separate.
