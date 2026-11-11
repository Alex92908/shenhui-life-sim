# ROUND2-LOG-int — Integration (final wave)

Integration agent, 2026-11-11. Working copy `~/workspace/shenhui-life-sim`, branch
`feature/round-2` (local only — never pushed, main untouched). Files edited:
`client/src/App.tsx`, `client/src/places-hz.ts`, `client/src/clock.ts`,
`client/src/i18n-en.ts`, `client/src/MapView.tsx` (building lists only), plus the
one sanctioned additive change to `client/src/events.ts` (`report?: "landlord" |
"employer"` on `EventChoice` + one new choice in the "房东来了" event).

## Verification (all green)

- Typecheck: `cd ~/workspace/shenhui-life-sim/standalone && npx tsc --noEmit -p tsconfig.json`
  → **0 errors, exit 0** (baseline was 0; first pass had 51 errors, all fixed in-file —
  mostly wrong result shapes: `EconResult.value`/`events` not `r.book`/`r.lines`,
  `adoptPet`/`interactWithPet` mutate in place, missing `createdDay`/`cityKey`/
  `availableFromDay` inputs, real `OrderStage` values, `togglePhoneFullscreen`
  returns `Promise<boolean>`).
- Build: `cd ~/workspace/shenhui-life-sim/standalone && npm run build` → **✓ built in
  9.40s** (`index-CH0MCgGn.js` 1,913.93 kB, gzip 715.42 kB).
- Server smoke test: started with a **fresh test DB**
  `DB_PATH=/home/hatch/workspace/shenhui-life-sim/.local-test/app.db`
  `PORT=8787 HOST=127.0.0.1 ADMIN_TOKEN=test-admin-token-1234 DEV_LOGIN_CODES=1
  DEV_PAYMENTS=0 WEATHER=off npx tsx server.ts` (from `standalone/`).
  Log shows `[db] applied 0019_round2_server.sql` and
  `湾区人生 standalone server → http://127.0.0.1:8787`.
  `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8787/` → **200**.
  **Server left RUNNING** (npx/tsx tree under PID 6087; log at
  `.local-test/server.log`). The production `~/workspace/ts-spaces/<slug>/app.db`
  was not touched.

## VenueSet reconciliation (b) vs (g) — result

- `data.ts` `VenueSetId` has `cycle`, `gallery`, `nature`, `wetland`, none of which
  are `LifeSet` members (LifeStage built `bikehub` + `fishingport` instead).
  Fixed **only in App.tsx**: `VENUE_SET_ALIAS` in the new `venueFor`
  (`cycle→bikehub`, `gallery→museum`, `nature→park`, `wetland→farm`) over
  `venueSetFor(loc)` from `round2/venues.ts`; old `VENUE_SETS` const deleted,
  **no `VENUE_SETS` references remain** (grep-verified).
- `VENUE_TALK` merged in App.tsx: (g) S3 copy used for the 8 market/museum/
  library/factory sets (ids match `ROAM_SPOTS`); (b) copy used where ids match
  (disney castle/ride, tram ride, temple fortune, miniature photo, farm milk,
  watershow show, bikehub ride re-keyed from (b)'s `cycle`); own entries written
  for the rest (disney parade; tram photo; temple pray; miniature tour; farm
  pick/crab; watershow mall; boardwalk stroll/view; fishingport buy/boat; bikehub
  rent). **Dropped (b) entries with no ROAM_SPOT:** `copy`, `pick`, `goldfish`,
  `line`, gallery `look`, nature `butterfly` — those spots would no-op.
- `VENUE_TALK` gained a `hunger?: number` field (interface lives in App.tsx) and
  `runVenueTalk` now applies it; the two seafood/oldtown entries use it.
- `AnimKindId`s (`tram`, `temple`, `oldtown`, `miniature`, `nature`, `farm`,
  `wetland`, `watershow`, `cycle`, `gallery`) are **not `LifeKind` members** —
  applied `animFor(loc, kind)` per (b) S2 with an `ANIM_TO_LIFE` fallback map
  (all → `"stroll"` except `wetland→"beach"`). **Follow-up for area (g):** add
  dedicated `LifeKind` scenes if wanted.
- `VENUE_PLACE` extended with all new sets (`electronics`→`"electronics"`,
  not `"market"`), `MEET_IDS` extended with `paint, frame, dig, boat, snack,
  clothes, tour, ride, fortune, buy, eat, milk`; `regularHere` now uses
  `npcAllowedAt(n, { id, type })`; `runVenueTalk` fun/social id lists extended
  with the new spot ids; venue `<LifeStage3D>` wired with `faceId`
  (`profile.playerId`), `partnerFaceId`, `talkText`, `talkVoiceId`.

## Snippets applied (by area)

### (b) venues — all applied
S1 `venueFor`→`venueSetFor` + alias map; S2 `special`→`animFor` + `ANIM_TO_LIFE`;
S3 `npcAllowedAt` in `seeSomeone` + venue talk lists (above); S3c `npcAllowedAt`
in `regularHere`; S4 per-subtype `venueActions` cases (`electronics`,
`oilpainting`, `secondhand` incl. `__flea` action, `seafood`, `oldtown`,
`womensstreet`, `museum`, `library`, `factory`); S4d `seafood-feast` / `snack-eat`
`doAction` kinds + `animMap` entries; S5 `atJob` TL labels for the 9 new types;
S6 `vendorSellFor` override in `routineActs` (verified return shape
`zh/sub/en/subEn/emoji/prop`); S8 `clock.ts` `venueHours` (library branch now
`placeKind === "library" || l.type === "learn" || l.type === "library"`;
market branch now covers all 6 market subtypes → `[480, 1320]`);
S9 `places-hz.ts:8` `HZ_LOC_KM` `"hq"`→`"qiaodong"`, `"work"`→`"work-hz"`;
S10 `MapView.tsx` neon-sign list + awning list extended with the new subtypes
(+ `museum`/`library`/`factory` on neon); S11 `i18n-en.ts` 阿杰 line added
(exact Chinese from `experience.ts:216`).
Old-save migration for hz `"hq"`/`"work"` handled in `sanitizeSave`
(`hz`+`"hq"`→`"qiaodong"`, `hz`+`"work"`→`"work-hz"`; SZ `"hq"`/`"work"`
untouched).

### (c) pets + community — applied
Pets state (`useState` + `PET_STORAGE_KEY` localStorage persist), `tickPetDay`
in the once-per-day tick effect, `homecomingGreeting` on arriving home
(first-return-per-day), pet interactions in the home panel (feed/play/pet/wash,
cost deducted from `GameState.money`, `syncPets` fire-and-forget), stray adopt
via `api.adoptStray` + local `adoptPet` + `syncPetsToServer` (full pet payload).
Community queries (`getStrays`/`getNotices`/`getSnakeWarnings`/`getFishingSpots`,
with refetch intervals) + feed/adopt/post handlers in the phone "social" app
(`api.feedStray`, `api.postNotice`, `api.reportSnake`, `api.reportFishingSpot`;
pins use the player's current location). `toMapMarkers` not wired — see deferred.

### (d) black reports — applied
`ReportBook` + `asReportTransport(api)` + `reportsQuery` (`getBlackReports`);
merge effect applies `standing` + **`rentRollback` on load (critical, S)** via
cast (server returns extra fields the client type doesn't declare) — a
save/load no longer resurrects raised rent. Buttons: housing panel §5a
(`🚨 举报房东`, rent evidence prefilled), career panel §5b (`🚨 举报这家公司`,
wage evidence prefilled), "房东来了" event §5c (new third choice, needs the
sanctioned `EventChoice.report` field). Reputation-warning banners §5d in both
panels (`reputationWarning` on the target's `Reputation` from the server).
Composer modal §5e (charge suggestions, evidence summary, `validateDraft` +
`canFile` gates, `noteFiled` echo). Jury vote/claim panel §5f in the phone
"social" app (`voteBlack`, `claimBlack` — verdict applied inside `mutate`,
**`r.money` NOT added again**: `applyLandlordVerdict`/`applyEmployerVerdict`
already credit deposit/back-pay from the remedy; claim response money is the
same amount).

### (e) economy — applied
S0 `econ` component state (NOT a `GameState` field); S2 phone "trade" app
(`PHONE_APPS = [...APPS, {id:"trade",…}]`, `phoneApp: AppId | "trade" | null`):
trade board (server tasks + local tasks + `TRADE_TASK_EXAMPLES` when empty;
post/accept/escrow/complete/cancel/dispute — local book + server call, client
money moves only via `escrowDue`/`releaseAmount`/`refundAmount` from the local
result), overseas tab (`OVERSEAS_CATALOG`, local order + server
`placeOverseasOrder` mirror, `payOverseasDuty` both sides). S3 menu entry
"🛒 交易板 · 海淘" + hint line under the `BillboardModal` mount. S4 flea panel
(server `getFleaStock` deterministic ids `usedfurn-<day>-<i>` /
`usedfurn-p-<id>`; `api.buyUsedFurniture`/`buyCheapGood` + local mirror;
resell via local `resellUsedFurniture`); `furnByIdOrUsed` tolerance added so
`placedFurn`/`computeComfort` don't break on one-off `usedfurn-*` ids. S5 sublet
entry in the home panel (`postSublet`/`acceptSublet` via server + local book;
`collectSubletRent` NOT wired — rent arrives via the daily tick's
`subletRentDue`).

### (f) lifestyles — applied
S1–S5 `life?: LifestyleState` in `GameState` + `sanitizeSave` + new-game default
+ mood-cap clamp (`100 + flat.moodCapBonus`) in both `sanitizeSave` and
`update()`; S6 `lifeProfile()` + generic `applyLife(res)` (incl.
`rentDelayDays`/`rentDueMul` → `rentDealRef`, `hiredIdentityId` → `idenId`);
S7 `rentDealRef` consumed by the Saturday rent run in `advanceDays`
(delay skips a week, `dueMul` discounts); S8 Sanhe board (modal beside the
sanhe ad button: shifts/sleep/eats/mates/rent talks/second-hand/stalls;
`sanheShiftLog` fire-and-forget with the local delta pay), small joys on
matching place panels (`SMALL_JOYS` `at(loc)` + `nowMin()` hours check), job
center modal via `isJobCenterPlace` + phone "jobs" entry (tabs: jobs ladder +
server `playerGigs`, guide courses + counselor route, mock interview, real help
`REAL_HELP`); S9 day-advance hook (once-per-day effect on `gs.day`:
economy tick, course tick via `applyLife(courseDayTick)`, encouragement toast,
check-in modal when `checkinDue`). `saveLifestyle` fire-and-forget on change.
**Money decision (recorded):** lifestyles money stays client-calculated —
local functions pay; server `courseDay`/`trialDay` are NOT called (they return
amounts the client would double-apply); only lifecycle logging
(`applyJob`/`enrollCourse`/`bookGuidance`/`startTrial`/`sanheShiftLog`/
`saveLifestyle`) is called.

### (g) 3D / house / police / phone / voice — applied
S2 venue props (above); S4 faces + talk voice (above); S5 joystick-cutscene
pause: `CUTSCENE_ROAM` map (`sleep/cook/eat/wash/groceries/gym/stroll/shopping`
→ walkable sets), life-overlay roam branch with `onSpot`, 2.3s timer effect
early-returns for walkable kinds; S6 house build entry (home panel button) +
editor modal (rooms/furniture palette, `validateHouseLayout`, 3D preview via
`LifeStage3D houseLayout`, publish via `houseLayoutToPlacedFurn` + `publishHome`
— **only 3 furniture ids publish today, left as is**); S7 police panels
(patrol toggle + observe buttons on online players + `👁️` badge when
`isWatched(myId)` in the phone "social" app — **local-only this round, see
deferred**); S8 phone fullscreen ⛶ button + full-bleed classes
(`togglePhoneFullscreen` is async — handled with `.then`); S9 voice settings
row in the music popover (`VOICE_MODES` + karaoke language buttons
`setKaraokeLang("en"|"cn")`); S10 scene SFX (`SceneSfxId` bed under music:
cook/gym/sleep + restaurant/gym/clinic venues); ferry horn in `doAction`
`"ferry"`; NPC chat voice (`playNpcVoice` on greeting + every reply);
venue talk voice via `talkText`/`talkVoiceId` props.

### (h) delivery — applied
`GameState.delivery` + load normalizer (`isDeliveryState` / `emptyDeliveryState`
in `sanitizeSave`); phone "food" case replaced (restaurant menu via
`deliveryMenu`, hoisted `deliveryCart` — `renderPhoneApp` is a plain function,
cart restricted to one restaurant at a time; active-order card, membership
button `MEMBERSHIP_PRICE=18` / 30 days); handlers `submitDeliveryOrder` /
`eatDeliveryOrder` / `cancelDeliveryOrder` / `buyDeliveryMembership`; 15s order
tick effect; courier board inside the "jobs" app (`refreshCourierBoard`,
`generateCourierBoard`, accept/pickup/deliver/cancel with `courierAccept` etc.);
pool lifecycle wired to the real endpoints (`deliveryPoolPublish` with
`poolPayloadFor` + `destId`, `deliveryPoolClaim`, `deliveryPoolPickedUp`,
`deliveryPoolDelivered` — server pay/tip win for pool gigs, local pay is the
fallback); **pool distance is client-computed** (server stores/returns 0):
current-location → destination, min 1 km. `orderFood` (old instant-food
function) deleted — its only caller was the old food case; FOODS still sell
through the delivery menu's fast items.

### (S) server notes applied
- `getBlackReports` extra `standing` + `rentRollback` read via cast (see (d)).
- `buyUsedFurniture` uses server stock ids only (see (e) S4).
- Delivery distance client-computed (see (h)).
- `courseDay`/`trialDay` not called (see (f) money decision).
- `listJobBoard` returns base `payDay` + `cityMul`; client computes city pay
  via local `listingsFor` (server `playerGigs` shown alongside).
- `reportLandlord` endpoint exists but is **not called** — the (d) flow files
  via `fileBlackReport` with the same evidence; calling both would double-file.

## Skipped / deferred (with reasons)

1. **Trade-dispute jury adjudication (S partial) — DEFERRED, documented.**
   `disputeTradeTask` freezes escrow (local + server) and the UI says so, but no
   jury adjudication exists for trade disputes: there is no server endpoint and
   the (d) jury only handles landlord/employer reports. Wiring it would need a
   new server endpoint + adjudication flow — outside the owned files. Frozen
   money stays frozen; the dispute button text tells the player to negotiate
   or wait for an admin. **Exact next step:** server agent adds
   `adjudicateTradeDispute` (jury vote → release/refund) and the client wires
   the trade board's disputed rows to it.
2. **(b) S3(d) MapView `npcAllowedAt` (~319-327) — NOT in scope.** MapView's
   NPC placement still uses its own filter; the allowed-MapView change was only
   the building lists. Follow-up for the coordinator.
3. **Community `toMapMarkers` — NOT wired.** It targets `MapView` (not an
   owned file except the building lists). Strays/notices/snakes/fishing spots
   are visible in the phone "social" app; map pins need a MapView change.
4. **Police patrol/observe is local-only this round.** The police module keeps
   patrol/watchers in module memory and (S) added no police endpoints, so a
   watch does not propagate to other real players; the 👁️ badge only works
   within one session. **Next step:** server `startPatrol`/`observe`/
   `getWatchers` endpoints + a `watchers` query in App.
5. **Karaoke language buttons** — wired (music popover); the karaoke UI itself
   has no App.tsx language toggle beyond that, and no mahjong tile-play path
   was found to attach `sfx("mahjong")` to — recorded, not silently papered
   over. Mahjong sound still needs a UI hook.
6. **`markUnemployed` call site — NOT wired.** No single place in App.tsx
   owns "job lost / quit" today (jobs end via events/choices scattered in
   `doAction`); adding the call needs a sweep of those spots. The flat path
   otherwise works (check-in, encouragement, job center). Follow-up: sweep
   `doAction`/`chooseEventChoice` for job-loss branches and call
   `markUnemployed(life, day)` / `markEmployed` on hire.
7. **`collectSubletRent`** — not called; sublet rent arrives through the daily
   `economyDailyTick` (`subletRentDue`). Calling both would double-pay.
8. **Dedicated `LifeKind` scenes for the new anim kinds** — see venue
   reconciliation above; fallback is `"stroll"`/`"beach"`.

## Leftovers for the parent

- **Browser verification needed** (nothing in this wave was browser-verified):
  walk-into-own-home (incl. the new build-your-own-house publish → home3d),
  station-hall restroom, sit on park bench (from the 2026-11-11 test plan);
  plus the new round-2 flows: adopt a stray (trust ≥ 70 → 收养), file a
  landlord report → jury → claim, trade board post/accept/escrow/complete,
  flea-market buy (server stock id), delivery order → rider → eat, courier
  pool gig claim → delivered, Sanhe shift + job-center trial → hired,
  phone fullscreen, NPC voice modes.
- **GitHub push approval:** `feature/round-2` is local only; nothing pushed.
  The branch also still lacks Cursor's uncommitted billboard ads
  ("单间招租 周租¥260" etc. — not in the repo at 32348ca); if those land,
  rebase/merge before pushing.
- **Trade-dispute jury gap** — see deferred #1 above.
- **Old-save migration** — handled for hz `"hq"`/`"work"` in `sanitizeSave`;
  saves that already stored a venue set name are unaffected (venue mapping is
  computed, not stored).
- **Server left running** for browser verification (see Verification above).
  To stop it: `pkill -f "tsx server.ts"` (test DB only, under `.local-test/`).
