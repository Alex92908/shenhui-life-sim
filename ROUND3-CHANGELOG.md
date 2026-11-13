# ROUND-3 CHANGELOG — feature/round-2 (from main @ 32348ca)

Branch: `feature/round-2` (created 2026-11-11 on GitHub from main@32348ca).
Previous round-2 commit: `4bc5307b` (pushed to remote).
Local workdir: `~/workspace/shenhui-life-sim/`. This round's work is local only — nothing pushed to remote, no browser work done.

## Scope

Round 3 fixes the 13 gaps from the round-2 omissions audit (`~/workspace/goals/shenhui-life-sim-launch/files/round-2-omissions-audit-2026-11-11.md`), as listed in the per-agent logs ROUND3-LOG-S.md / ROUND3-LOG-A.md / ROUND3-LOG-B.md / ROUND3-LOG-C.md / ROUND3-LOG-D.md / ROUND3-LOG-E.md, integrated per ROUND3-LOG-int.md. Per-gap logs are the source of record; line numbers below are the measured line numbers stated in each log (post-integration numbers come from ROUND3-LOG-int.md; where logs disagree, see "LOG 之间对不上的地方" at the end).

- Gap 1 — trade-dispute jury (server S + client integration)
- Gap 2 — police patrol server-side (server S + client integration)
- Gap 3 — markUnemployed call site (B, snippet → integration)
- Gap 4 — mahjong SFX wiring (B, snippet → integration; mp3 still missing)
- Gap 5 — house builder: 14 ZhuyaHome furniture ids publishable (B + integration)
- Gap 6 — MapView npcAllowedAt + community toMapMarkers (C + integration)
- Gap 7 — 巽寮湾渔港 → fishingport (A + integration)
- Gap 8 — animation layer: 10 animKinds still playing stroll (D + integration)
- Gap 9 — pets: (a) pet 3D on the map (C + integration), (b) pet at home (C snippet → integration)
- Gap 10 — work/overtime cutscenes → joystick (D + integration)
- Gap 11 — Lagos gaps: merchant sponsorship, creator payout, group order, retention loop (E + integration)
- Gap 12 — duplicate id `"gym"` (A + integration)
- Gap 13 — 青青世界 butterfly + factory canteen (A + integration)

## Gap 1 — 交易纠纷陪审团 (S + 集成)

Server (S, `server/src/actions.ts`):
- `settleTradeDisputes(db)` (`actions.ts:1032`) — closes all expired disputes and moves money; compare-and-set (`WHERE status = 'disputed'`) against double payout. Called from `getTradeTasks` (`:3651`), `getMyTradeTasks` (`:3912`), `tradeDisputeVote`, `adjudicateTradeDispute` — same pattern as `settleBlackReports` / `settleGigs`.
- `tradeDisputeTallies(db, taskId)` (`actions.ts:1025`) — vote counting.
- `disputeTradeTask` (`actions.ts:3822`) — on complaint now also writes `disputedAt` (24h jury window start) and `disputeFromStatus` (`accepted` vs `completed` before complaint). A completed-then-disputed order only records the verdict and stays `completed` (money already released); without `disputeFromStatus` a buyer-win on a completed order would wrongly flip it to `cancelled`.
- `tradeDisputeVote` (`actions.ts:3844`) — `{ playerId, taskId, side: "seller" | "buyer" }` → `{ ok, votes?: { seller, buyer } }`. Settles expired disputes first; already-settled disputes can't be voted on.
- `adjudicateTradeDispute` (`actions.ts:3867`) — `{ playerId, taskId }` → `{ ok, verdict?: "seller" | "buyer" | "expired", votes?, releasedTo?, releasedAmount?, refunded?, dueAt? }`. Before 24h: `ok: false`, error "陪审团还在投票，24 小时后再来结算。" with `votes` + `dueAt` (ISO). After settlement: returns the recorded verdict and money moved; repeat calls are read-only. Anyone may trigger settlement (deterministic + compare-and-set single payout). Payout rule matches `completeTradeTask`: sell order → poster, otherwise → accepter; 0% fee. Refund goes to `tradeEscrow.payerId`.
- Jury rules (copied from existing patterns): 24h window from complaint (`juryVote` gigs / `settleBlackReports`); same-city jury when task city isn't `any`; quorum 3, majority wins; tie or under 3 votes = `expired`; one vote per person, changeable until settlement; parties can't vote; votes bind to an account (`socialNeedsAccount()`).
- Deliberate deviation from black-report `expired`: black-report `expired` means "nothing happens", but a trade dispute can't do that — the money would freeze forever. So `expired` refunds the escrow to the payer. This is the core semantic of the fix; client copy says "陪审团没凑够票 / 打平，托管的钱退回给你".
- After settlement the task status returns to `completed` (seller wins) or `cancelled` (buyer wins / expired) — no new status value, client `TradeTaskStatus` unchanged; the verdict is recorded in the new `trade_tasks` columns (see server section).
- `tradeTaskShape` / `tradeTaskView` new optional fields (`actions.ts:1078-1090`): `disputeReason?: string`, `disputeVerdict?: "seller" | "buyer" | "expired"`, `disputeDueAt?: string` (ISO). Old clients ignore them.

Client (integration, `client/src/round2/economy.ts` + `client/src/App.tsx`):
- `economy.ts`: `TradeTask` gains optional `disputeReason?`, `disputeVerdict?: "seller" | "buyer" | "expired"`, `disputeDueAt?: string` (same names/shapes as server `tradeTaskShape`).
- `App.tsx:1434-1435` queries: `myTradeQuery` (`api.getMyTradeTasks` — my orders as poster/accepter, incl. disputed + settled verdicts); `disputedTradeQuery` (`api.getTradeTasks({ openOnly: false, limit: 50 })`, 60s poll, client filters `status === "disputed"` — jury entry). Note: the original `tradeQuery` uses `openOnly: true`, so disputed orders never appear on the trade board; a separate query was required.
- Trade board UI (`App.tsx:5129` 起, "⚖️ 交易纠纷 · 陪审团"):
  - My disputes: `myDisputes` (disputed or already-verdict), showing complaint reason, frozen amount, `disputeDueAt` countdown ("还剩约 X 小时 Y 分" / "投票已截止，可以结算"), settlement copy; a "结算这单" button while disputed.
  - Jury queue: `juryDisputes` (own orders excluded from the list — parties can't vote is a server check, UI simply doesn't list them), each with "判给卖方（放款）/ 判给买方（退款）/ 结算" buttons.
  - `tradeVote` (`:5058`): `api.tradeDisputeVote`, toast shows current tally (卖方 X : 买方 Y, 满 3 票多数获胜); `tradeAdjudicate` (`:5065`): `api.adjudicateTradeDispute`, on success shows verdict + `releasedAmount` / `refunded` ("陪审团判卖方胜，托管的 ¥X 已放给 Y" / "判买方胜……已退回付款人" / "没凑够票 / 打平……已退回付款人"), result stored in `disputeResult` state and shown on the card; before expiry the server returns "陪审团还在投票，24 小时后再来结算。" as a toast.
  - `tradeDispute` toast copy updated ("等双方协商或管理员处理" → "24 小时内同城陪审团投票决定归属"), refetching all three queries.
  - No automatic settlement timer: per S, the client starts no timer — expired disputes settle on the next board read / vote / adjudication via the server (`disputedTradeQuery`'s 60s poll triggers `settleTradeDisputes` inside `getTradeTasks`).

## Gap 2 — 警察巡逻服务端化 (S + 集成)

Server (S, `server/src/actions.ts`):
- New endpoints (5): `startPatrol` (`actions.ts:4680`), `stopPatrol` (`actions.ts:4698`), `observe` (`actions.ts:4712`), `stopObserving` (`actions.ts:4738`), `getWatchers` (`actions.ts:4751`). The task asked for three; `stopPatrol` and `stopObserving` were added because without them a patrol could only end by expiry.
  - `startPatrol` — `{ playerId, city: "sz" | "hz" | "hk" }` → `{ ok, patrol?: { officerId, officerName, city, since: ISO } }`. Only in the player's own city (`cityKey` mismatch errors). Restarting refreshes (city change / renewal), existing observations kept.
  - `stopPatrol` — `{ playerId }` → `{ ok }`. Ends the patrol and deletes all its observations (mirrors client `stopPatrol` semantics).
  - `observe` — `{ playerId, targetId: string (≤48), note?: string (≤200) }` → `{ ok, watch?: { officerId, targetId, note, city, startedAt: ISO } }`. Checks (mirroring client `police.ts` `observe` + `isGameAvatarId`, server mirror at `actions.ts:1201`): must be on patrol; `targetId` must be a lowercase slug (alphanumeric `-` `_`, no 7+ consecutive digits, rejects emails/phones/real names); can't observe yourself; no duplicate observation of the same person; a known player target must be in the patrol city; NPC slugs (not in the players table) pass on slug rules only — the server has no data.ts NPC registry and cannot verify an NPC id really exists (known limitation).
  - `stopObserving` — `{ playerId, targetId }` → `{ ok }`.
  - `getWatchers` — `{ playerId }` (a watched player checks themselves) → `{ ok, watchers: [{ officerId, officerName, officerEmoji, note, city, startedAt: ISO }] }`, newest first. Deliberately no banned check: a banned/muted player still has the right to see who is watching them — surveillance must never be secret from the watched player (`police.ts` rule 2).
  - TTL fallback: patrols expire after 6 hours (`PATROL_TTL_MS`, `actions.ts:1198`), lazily cleaned on every patrol read/write (`expirePatrols`, `:1207`); expired patrols' observations are deleted with them.
  - Internal: `isGameAvatarId(id)` (`actions.ts:1201`), `expirePatrols(db)` (`:1207`), `activePatrol(db, officerId)` (`:1215`).
- New tables: `patrols` (`officer_id` PK, `city`, `started_at` — one active patrol per officer), `patrol_watches` (`officer_id`, `target_id`, `note`, `city`, `started_at`, PK `(officer_id, target_id)`). No real identity stored: only in-game ids + notes (notes pass `cleanText`, ≤200 chars).

Client (integration, `client/src/round2/police.ts` + `client/src/App.tsx`):
- `police.ts` — in-memory implementation fully replaced with 5 async server calls via the typed `api` client (server endpoints already in actions.ts, no `api.ts` change needed — `api`'s type comes directly from server Actions):
  - `startPatrol(playerId, city)` → `api.startPatrol`
  - `stopPatrol(playerId)` → `api.stopPatrol` (server also deletes observations)
  - `observe(playerId, targetId, note?)` → `api.observe` (local pre-checks: slug / can't watch yourself; rest validated server-side)
  - `stopObserving(playerId, targetId)` → `api.stopObserving`
  - `getWatchers(playerId)` → `api.getWatchers`, returning server's `{ officerId, officerName, officerEmoji, note, city, startedAt }` (ISO strings; local `WatchRecord.startedAt` changed from number to string).
  - Deleted: local `patrol` variable + `watchers` Map + synchronous `patrolState` / `isWatched` / `observationsBy`. Kept: `isGameAvatarId`, `WATCH_INDICATOR`, `PoliceReportPayload`, `toBlackReportArgs`; `buildPoliceReport` now takes an explicit `observations` array (it used to read the local Map; no callers, so the signature change is safe).
- `App.tsx` wiring:
  - Import (`App.tsx:47`): `{ startPatrol, stopPatrol, observe, stopObserving, getWatchers, isGameAvatarId }`.
  - `watchersQuery` (`App.tsx:1431`): `getWatchers(profile.playerId)`, 60s poll — a watched player sees 👁️ + watcher name/note (`App.tsx:5346`).
  - Patrol panel (`App.tsx:5344` 起): start/stop patrol now async against the server; copy changed from "本轮只在本地生效" to "全服可见：你盯的人会看到 👁️"; the online-player list's "盯着" button is now a toggle — already-watched shows "取消盯着" calling `stopObserving` (`observedIds` state, `App.tsx:1432`, cleared on patrol end); the location patrol-record button (around `:6314`) is now async `observe(profile.playerId, selLoc.id)`.
  - Note: server `observe` lets NPC slugs through on slug rules only (known S-log limitation); location ids pass the same way, consistent with round-2 local behaviour.

## Gap 3 — markUnemployed 调用点 (B snippet → 集成)

B's sweep (read-only): the only real job-loss entry in the whole codebase is the layoff story arc. `doAction` has no quit/resign/fire case; `events.ts` has no job-loss event; `switchJob` is an instant job change, not unemployment; shops can't close; stalls have no `closeStall`; `record >= 2` only blocks interviews; new games start employed.
- Definition: `client/src/round2/lifestyles.ts:249` `markUnemployed(state, day)` — idempotent (already-unemployed returns the state unchanged), sets `flat.unemployedSinceDay = day`.
- The single entry: `arcs.ts:106` `layoff` ("公司要『优化』", `when: c.wage && c.day >= 4`). Second act, "HR 找你" branch (previous act chose "偷偷更新简历"): both options mean job loss — `:119` `C("签", …, "sign")` and `:120` `C("申请劳动仲裁，争 2N", …, "fight")`. The "你留下了" branch (`:114`) is not a job loss — no call. `applyArcFx` (`App.tsx:469-475`) only touches money/mood/energy/network/xp/rentPct and knows nothing about unemployment — which is exactly why a fired player could still `doAction("work")` for pay the next day.
- Integration (App.tsx):
  - Import (`App.tsx:44`): `markUnemployed, markEmployed` added to the lifestyles import.
  - Layoff handler (`App.tsx:7863`): inside the arc-choice handler's `mutate`, after setting `x.arcs`, `if (arc.id === "layoff" && (c.flag === "sign" || c.flag === "fight")) x.life = markUnemployed(x.life ?? defaultLifestyleState(), x.day);`.
  - Companion fix (otherwise the unemployment clock never clears): `case "join-company"` (`App.tsx:3134`), after `s.mood += 8;`, `s.life = markEmployed(s.life ?? defaultLifestyleState());`. `markEmployed` (`lifestyles.ts:259`) zeroes `unemployedSinceDay` but keeps hope and the mood-cap bonus. Not added in the layoff ending itself: the "空窗期" ending is meant to stay unemployed, and the "无缝衔接" ending settles the next morning — clearing then would erase the unemployment state; the player clears it via trial / job-change hiring instead.
- Already wired (verified, untouched): unemployment panel (`App.tsx:6939`, `flatStatusLine`), neighbour visits (`:7167`, `flatDays`), `s.life` syncs to server (`:1410` `saveLifestyle`) automatically — once the call site is connected, unemployment days, panel, visits and server sync all work end to end.

## Gap 4 — 麻将音效 (B snippet → 集成；mp3 仍缺）

- Download: NOT done, not retried. SFXMint last returned HTTP 429 rate-limit; `mahjong.mp3` still doesn't exist anywhere in the repo. No mp3 was faked. `client/src/sound.ts:60` `MAHJONG_SFX_FILE = null` unchanged. A scheduled job retries SFXMint the next morning at 9:00 PST; once the file lands at `client/public/music/shenhui-sounds2/sfx/scenes/mahjong.mp3`, only `sound.ts:60` needs to change to `"sfx/scenes/mahjong.mp3"` (already noted in its comment).
- Wiring verified: `sfx("mahjong")` is already callable today — `sound.ts:65` `Sfx` union already has `"mahjong"`, `:661` `playSfxFile` returns false when `MAHJONG_SFX_FILE` is null, `:693` synth knock fallback (two square-wave knocks) plays instead. When the file arrives, the same call sites automatically play the real recording. So `sound.ts` was not changed at all.
- The real tile-play entry is in the mini-game engine, not App.tsx: `activities.ts:246-248` mahjong activity, `game: meter(...)` (push = "再摸一张，做大牌", stop = "胡了！"); `App.tsx:3920` `startActivity` → `setPlay(...)`; `App.tsx:7357` renders `<MiniGame …>`; `MiniGame.tsx:204` `Meter.push()` is the only entry for every tile draw /摸牌 (`:218` "再摸一张" button, `:219` "胡了！" button). MiniGame.tsx previously imported no sound, and `sfx` was only used in App.tsx.
- Integration (MiniGame.tsx + App.tsx):
  - `MiniGame.tsx:21` — props gain optional `onPush`; `:41` passes it to Meter; `Meter.push()` calls `onPush?.()`. (Deviation: B's snippet 1 also asked for `import { sfx } from "./sound"` at the top of MiniGame.tsx, but that import has no use site inside MiniGame — sound goes through the `onPush` callback — and would trigger TS6133. The import was not added; typecheck is 0 errors.)
  - `App.tsx:7636` — the render point passes `() => sfx("mahjong")` only when `play.act.id === "mahjong"`; `startActivity` plays one knock after `setPlay`, `finishActivity` plays one after settlement (bust also knocks — "牌桌有动静"; could switch to `sfx("fail")` on `r.bust` later).
  - Only mahjong passes the callback; other meter games (climbing, drinking, skewers, stall, phone-flipping, haggling) are unaffected; with `onPush` empty, `Meter` behaves exactly as before.

## Gap 5 — 盖房：14 件 ZhuyaHome 家具全部接通发布 (B + 集成）

Root cause (B): `data.ts:365-379` `FURNITURE` (ZhuyaHome real catalogue) always had 14 items, but round-2 `house.ts` only recognised 3 of them; the other 5 were invented ids (`table` / `wardrobe` / `desk` / `tv` / `plant`) that don't exist in the catalogue, so `houseLayoutToPlacedFurn()` dropped them all as `not-in-catalog`.
- `client/src/round2/house.ts` — all 14 ids wired (id + Chinese name checked one by one against data.ts FURNITURE), all `inCatalog: true`:

| id | 中文名 | 房间 | 尺寸（米） |
|---|---|---|---|
| sofa-fabric | 布艺三人沙发 | living | 2.0 × 0.9 |
| sofa-leather | 真皮L型沙发 | living | 2.4 × 1.0 |
| sofa-tatami | 无腿榻榻米沙发 | living | 1.8 × 0.9 |
| table-oak | 橡木圆形茶几 | living | 0.9 × 0.9 |
| table-marble | 大理石方形茶几 | living | 1.2 × 0.7 |
| tv-cabinet | 电视柜组合 | living | 1.8 × 0.45 |
| bed-double | 实木双人床 | bedroom | 1.8 × 2.1 |
| wardrobe | 三门衣柜 | bedroom | 1.8 × 0.6 |
| desk | 书桌 + 显示器支架 | bedroom | 1.2 × 0.6 |
| fridge | 双门冰箱 | kitchen | 0.8 × 0.7 |
| kitchen-cabinet | 整体橱柜 + 灶台 | kitchen | 1.8 × 0.7 |
| dining-table | 四人餐桌椅 | kitchen | 1.4 × 0.8 |
| washer | 滚筒洗衣机 | bathroom | 0.6 × 0.6 |
| bathtub | 独立浴缸 | bathroom | 1.7 × 0.8 |

  Old invented ids removed (`wardrobe` / `desk` are real ids, kept; `table`→`table-oak`, `tv`→`tv-cabinet` have real ids; `plant` doesn't exist in the catalogue, deleted).
- Why this is enough to publish (verified layer by layer, not just a list change): server doesn't block ids — `server/src/actions.ts:1362` `publishHome` only checks id matches `/^[a-z0-9-]{1,32}$/`, slot 0–6, max 8 items — all 14 ids pass; App.tsx recognises them (`furnById()` looks up `FURNITURE`, all 14 present; publish button `App.tsx:7157` adds placed ids to `x.furniture` then calls `publishHome()`; `placedFurn()` / `spotsOf()` (`:3390`) parse them); the home 3D render (`LifeStage.tsx:1314-1362`) already has dedicated geometry for all 14 (sofa-leather L-extension, sofa-tatami low profile, table-oak round table, tv-cabinet with TV screen, wardrobe / desk / fridge / kitchen-cabinet / dining-table / washer / bathtub each modelled) — only unknown ids fall back to the grey box.
- Old-save migration (in house.ts): `loadHouseLayout()` now migrates `table`→`table-oak`, `tv`→`tv-cabinet`; `plant` has no counterpart and is filtered out. `wardrobe` / `desk` were always real ids, no migration needed.
- B verification: standalone typecheck 0 errors; runtime spot check (`npx tsx /tmp/house-check.mts`, all 14 placed into one layout then converted to a publish payload): `placed 7, dropped 7 (all no-free-slot), not-in-catalog drops: 0`.
- Integration — build-plot preview colours (LifeStage.tsx:2096 `BUILDPLOT_COLORS`): all 14 ZhuyaHome items now draw in their data.ts catalogue colours (sofa-fabric 0x93b8a4, sofa-leather 0x8a5a3b, sofa-tatami 0xd9c39a, table-oak 0xb08954, table-marble 0xf1f5f9, tv-cabinet 0x8a6f4d, bed-double 0xa9835a, wardrobe 0xb08954, desk 0x6b7280, fridge 0xd7dde3, kitchen-cabinet 0x9db4a0, dining-table 0xb08954, washer 0xe5e7eb, bathtub 0xf1f5f9); unknown ids still fall back to the grey box 0x78716c.
- Remaining limit (not a bug — the 7-slot ceiling, see "没做成的事" §1): only 7 items publish at a time; the 8th onward is still dropped as `no-free-slot`.

## Gap 6 — 地图：npcAllowedAt + 社区图钉 (C + 集成）

C changed 3 files: `client/src/MapView.tsx`, `client/src/round2/community.ts`, `client/src/round2/pets.ts`. App.tsx / LifeStage.tsx untouched by C (integration did the App.tsx wiring).
- `MapView.tsx`:
  - Imports (`:30-32`): `npcAllowedAt` (data.ts), `COMMUNITY_PIN_COLOR` + `CommunityMapMarker` (round2/community.ts), `PET_MODEL` + `stepPetFollow` + `Pet` + `PetRuntime` (round2/pets.ts).
  - Props (`:84-93`): `communityMarkers?: CommunityMapMarker[]`, `activePet?: Pet | null`, `onCommunityMarkerClick?: (marker) => void`.
  - `Chip` kind gains `"community"` with optional `community?: CommunityMapMarker["kind"]` (`:578-580`).
  - `npcAnchorLocId` now uses `npcAllowedAt` (`:335-359`): first find an allowed location, then match by time slot and type; only NPCs with no allow-list fall back to pure type lookup.
  - Actor sync: after `npcsForCity`, filter out NPCs whose allow-list has no match in this city (e.g. 郭叔 `onlyLocIds: []`), initial spawn pool uses `npcAllowedAt` (`:887-895`). Effect: 阿海 only works the seafood street / fishing port / seaside, never gets sent to the second-hand market at lunch; 大芬姐 doesn't go to 大芬 / 华强北; 郭叔 (no real wet market in Huizhou yet) doesn't spawn in the city at all instead of landing at a random corner. 王姨 / 老周 (`cities: []`) were already excluded by `npcsForCity`, unaffected.
  - New `petRuntimeRef` (follow state machine runtime) and `communityChipsRef` (community pin chip registry) (`:620-628`); module-level `PetParts` (pet moving-parts registry), `disposeObject` (releases geometry/material/badge texture on pet swap), `makePetGroup(pet)` (pet model builder, `:436-575`).
  - Scene effect: pet model state `petGroup` / `petGroupKey` / `petPhase` (`:1044-1050`).
  - Frame loop: pet follow drive (`stepPetFollow` + leg swing / tail wag / sit / hop), after the actor cleanup loop, before camera follow (`:3516-3562`).
  - Declutter label flow: community pins join the same `chips` iteration (`allChips`, `:3683`), new `kind === "community"` priority branch (`:3725-3737`).
  - Community pin sync effect (`:3905-3956`, declared after the scene effect — see below).
  - Minimap: community pins drawn as dots coloured by `COMMUNITY_PIN_COLOR` (`:4071-4077`).
  - WebGL-failure fallback list: when pins exist, an extra "社区动态" button row below, tapping calls the same `onCommunityMarkerClick` (`:4146-4162`).
- `round2/community.ts`: new `COMMUNITY_PIN_COLOR` (`:396-401`) — stray `#f59e0b`, notice `#3b82f6`, snake `#dc2626`, fishing `#0ea5e9`, shared by minimap and pins. The MAPVIEW SNIPPET comment near `:550` rewritten to implemented status; `toMapMarkers` itself unchanged (its filter rules were already right: not expired, not adopted/claimed, this city).
- `round2/pets.ts`: new `PET_MODEL` (`:85-88`) — cat `{ height: 0.55, ear: "pointed", tail: "up-curved", emoji: "🐱" }`, dog `{ height: 0.7, ear: "floppy", tail: "level", emoji: "🐶" }` — the single source of truth for the cat/dog distinction, shared by MapView's `makePetGroup`. `PET_MODEL_HOOK` and MAPVIEW SNIPPET comments rewritten to implemented status, plus the home-pet integration snippet index.
- Pin rendering (existing HTML chip route — same as place labels and NPC nameplates, no new 3D marker):
  1. Data flow: App passes `toMapMarkers({ strays, notices, snakes, fishingSpots, cityKey })` into the `communityMarkers` prop (App wiring in the integration section). MapView doesn't call the server or `toMapMarkers` itself.
  2. Sync effect (`MapView.tsx:3905-3956`): rebuilds when the content key `communityKey` (kind:id:label joined) or `cityKey` changes. Each marker gets a `<button>` chip: `emoji + label` text, `pointer-events:auto`, tap calls `propsRef.current.onCommunityMarkerClick?.(marker)` after `stopPropagation`. Position from `pin.x/z`, else resolved via `pin.locId` through `resolveLoc` to the place; unresolvable coordinates skipped. Max 24 pins.
  3. Positioning: chips register in `communityChipsRef`; the frame loop's declutter flow projects, dedupes and edge-clamps them together with place/NPC chips (`allChips`, `:3683`). Priority: snake warning 1.5 (only behind the player and search pins), stray 3.5, notice 4, fishing spot 5 (all + `dCam / 60`). Snake warnings show at full-city zoom, the other three only when zoomed in — same zoom rule as place labels. Snake pins are red-on-red with white border (`#fef2f2` / `#dc2626` / `#991b1b`), others use the default beige pill.
  4. Minimap: the same chips' `getPos()` drawn as `COMMUNITY_PIN_COLOR` dots (r=3.2), refreshed every 120ms with the minimap redraw.
  5. Why the effect is declared after the scene effect: scene rebuilds clear the whole label layer with `labels.innerHTML = ""`; React runs effects in declaration order, so the pin effect rebuilds pins after the scene effect and isn't wiped. City switches and marker-content changes rebuild automatically; unmount cleans up its own chip nodes.
- Integration — App.tsx map wiring (`App.tsx:1420`, `:6126`):
  - `communityMarkers = useMemo(() => toMapMarkers({ strays, notices, snakes, fishingSpots, cityKey }), …)`, data from the four existing queries (`:1340-1343`).
  - MapView props (`App.tsx:6126`): `communityMarkers={communityMarkers}`, `activePet={getActivePet(pets)}`, `onCommunityMarkerClick` — routes by `m.kind` to the existing detail panels: all four kinds live in the phone social panel (`App.tsx:4960` 起 `case "social"`, stray / notice / snake / fishing all there), so it uniformly does `setPhoneApp("social"); setPhoneOpen(true)` and toasts the pin label. No new panel built.
  - `getActivePet` added to the pets import (`App.tsx:40`).

## Gap 7 — 巽寮湾渔港 → fishingport (A + 集成）

A changed 3 files: `client/src/data.ts`, `client/src/round2/venues.ts`, `client/src/places-hz.ts`. App.tsx untouched by A (integration landed the snippets).
- `data.ts:524-526` — `VenueSetId` union gains `"fishingport"` (without this, `venueSet: "fishingport"` doesn't compile, and `venueSetFor` returns null when it can't find the copy).
- `data.ts:657` — xunliao: `type` stays `"port"`, adds `venueSet: "fishingport", animKind: "cruise"`.
  - `type` unchanged because: `clock.ts:149` `venueHours` only time-limits the four real ports (罗湖/深圳湾/福田/莲塘) — the fishing port stays open; NPC 阿海's `preferTypes` includes `"port"` and `onlyLocIds` includes `"xunliao"` (`data.ts:257`) — changing type would chase him away; `venues.ts:176-177` port→concourse fallback still serves the real ports (szbayport, luohu, huanggangport, futianport, liantangport, wenjinduport, shatoujiaoport).
  - `animKind: "cruise"` because `LifeKind` has only cruise as a boat (`App.tsx:572`); without a cruise key, `App.tsx:3326-3328` `ANIM_TO_LIFE` falls back to `(animRaw as LifeKind)` — i.e. plays the cruise scene directly, no longer stroll. Fishing-port fun/checkin is "跟船出海"; cruise is the only fit.
- `data.ts:712` — taio (大澳渔村): `venueSet: "cruise"` → `"fishingport"`, `animKind` stays `"cruise"` (`venues.ts:37` `ANIM_BY_PLACE` `taio: "cruise"` also untouched — a working animation wasn't touched).
- `round2/venues.ts:137` — `VENUE_SET_COPY` gains `fishingport: { set: "fishingport", zh: "渔港码头：渔船、渔网、刚上岸的海鲜，鱼贩在码头边叫卖", en: "The fishing port: boats, nets, the fresh catch, fish sellers calling out on the pier" }`. Without this, `venueSetFor` finds no copy for `loc.venueSet` and returns null — the key blocker of this gap ("无路可达").
- `round2/venues.ts:75` — `ANIM_BY_PLACE` gains pin `xunliao: "cruise"` (data.ts `animKind` takes priority; the table pin is double insurance, keeping "the table is the single source of truth").
- Reachability traced along the code chain (A, static): (1) `data.ts:657` / `:712` — xunliao and taio now have `venueSet: "fishingport"`; (2) `venues.ts:143-151` `venueSetFor` — per-place `venueSet` first: `VENUE_SET_COPY["fishingport"]` exists → returns `{ set: "fishingport", … }` (before: copy missing → null); (3) `App.tsx:216-224` `venueFor` calls `venueSetFor`; `VENUE_SET_ALIAS` (`:214`) has only cycle/gallery/nature/wetland, no fishingport → set stays `"fishingport"`, usable directly as a `LifeSet`; (4) `App.tsx:4240` `actionsFor` — non-empty `venueFor(loc)` pushes the `__venue3d` ("走进去 · 3D") button; (5) `App.tsx:6019` / `:6503` — click sets `setVenue3d({ set: "fishingport", id: selLoc.id, … })`; (6) `App.tsx:7213` `<LifeStage3D setKind={venue3d.set} …>` — `LifeStage.tsx:1895-1918` `fishingport` branch renders: pier, fishing boats, nets, three baskets of just-landed fish, 阿海 (`fishingport-ahai`) + a fish seller (`fishingport-seller`); the comment literally reads "巽寮湾渔港 / 大澳渔村" — the scene was built for these two places. `ROAM_SPOTS.fishingport` (`LifeStage.tsx:107`) already has buy/boat gold light-pillar points; (7) `App.tsx:200-203` `VENUE_TALK.fishingport` — buy (买刚上岸的海鲜) / boat (问渔民能不能跟船) dialogues already existed; button list (`:7224`) and `onSpot` (`:7213`) both look up `VENUE_TALK[venue3d.set]`, `runVenueTalk` (`:5536-`) fun bonus list includes `"boat"`, social list includes `"buy"` — no change needed; (8) `App.tsx:5528` `VENUE_PLACE.fishingport = "port"` — `regularHere` finds resident NPCs by port type, 阿海 (`onlyLocIds` includes xunliao) appears normally; `MEET_IDS` already includes `"boat"`, `"buy"`; (9) untouched references: `scenic.ts:51` xunliaosunset `locIds: ["xunliao", …]` (sunset scene, id lookup), `experience.ts:291` 巽寮湾 itinerary `key: "xunliao"`, `bus-hz-coast` seaside bus stop `S("巽寮湾", 12.8, 13.9, "xunliao")`.
- Conclusion: the fishingport scene is now reachable for both xunliao and taio. The ground actions were the remaining piece — integration landed snippet S1.
- Integration — S1 fishing-port ground actions (`App.tsx:4406`, `case "port"` head): branches on `loc.venueSet === "fishingport"` (not id — future fishing ports reuse it; `type` is still `"port"`), original port actions kept after the branch: gig (uses `loc.gigName` "渔港帮工 / 海钓向导"), `seafood-feast` (existing handler, `App.tsx:3126`, ¥80), `mall-shop` (existing handler, `App.tsx:3236`, ¥120), stroll, rest. Both handlers verified to exist before landing. taio needs no action snippet: it's `type: "scenic"`, walks `case "scenic"` (fun/checkin/stroll) which was already right; only its walk-in interior changed from cruise to fishingport.

## Gap 8 — 动画层：10 个 animKind 不再播散步 (D + 集成）

D changed one file: `client/src/LifeStage.tsx` (2 additive changes, zero refactor). App.tsx untouched by D (integration landed snippets S1–S5).
- D1 — office ROAM_SPOTS: 2 work-beat points (`LifeStage.tsx:72-74`, existing coffee/ask/toilet kept as-is):
  - `{ id: "code", emoji: "💻", zh: "坐下敲代码", en: "Sit down and code", x: -0.9, z: 0.1 }`
  - `{ id: "leave", emoji: "🚪", zh: "下班走人", en: "Clock out", x: -2.6, z: 1.9 }`
  - Placement checked against the office set (`LifeStage.tsx:1063-1132`): `code` sits in open floor before the desk (own desk z≈-0.95, chair at (0.4, 0.38); point at (-0.9, 0.1), not inside a chair/partition; ~1.48 from the roam spawn (0.15, 1.15) — outside the 1.15 near-point radius, so no interaction button pops on entry); `leave` is front floor (-2.6, 1.9), ~2.85 from spawn, open (plant at (-3.1, 0.9) doesn't block). Both inside `clampWalk` range (x ±5.6, z -1.15…2.15). The old three points (coffee/ask/toilet) untouched — they anchor `VENUE_TALK.office` dialogues (`App.tsx:81-88`); moving them would break venue dialogue. Task wording "add office ROAM_SPOTS": the office entry already existed in round-2 (g) (coffee/ask/toilet); what was missing was work-beat points — the old copy (ask a senior / go to the toilet) doesn't match the code/overtime beats (sit down and code / submit / clock out). Any pin advances a beat in cutscenes (`App.tsx:6786` `onSpot` ignores id), so the old three points would functionally work, but the copy wouldn't match the beat.
- D2 — watershow timed-cutscene actor landing fix (`LifeStage.tsx:3113-3114`, new `else if` in the frame loop's idle branch, after the `platform` branch, before the `else` default; the existing line-3107 market-set list and the `else` default untouched):
  - `else if (setKind === "watershow") { A.g.position.set(0.2, 0, 1.3); A.g.rotation.y = Math.PI; }`
  - Cause: the watershow set (`LifeStage.tsx:1858-1877`) has its fountain pool centred at (0, -1.2), radius ~1.9–2.1, water y≈0.28; the idle default landing (0.2, 0, 0.3) is only ~1.51 from the pool centre — the actor stood in the water. New landing (0.2, 0, 1.3) is poolside front (~2.5 from centre), facing the show (rotation.y = π, same as other venue sets); the stage is x -5.7…-1.5, z 0.3…1.9, so (0.2, 1.3) isn't on it; nearest audience dummy (0.6, 0.4) is ~0.98 away, no overlap.
- Untouched (anchor guarantee for the pet agent): `flat` / `bedroom` / `kitchen` / `bathroom` / `home` set code, ROAM_SPOTS, idle/pose branches all untouched; the `else { A.g.position.set(0.2, 0, 0.3); }` default untouched; all other sets' sets, ROAM_SPOTS, cameras and roam navigation untouched.
- Mapping (10 animKinds; 0 map to stroll):

| animKind | 新 LifeKind | LifeStage set（已有） | 涉及地点 | 过场形式 |
|---|---|---|---|---|
| tram | `tram` | `tram`（:1779，叮叮车） | tramroad（湾仔电车路） | 定时，全部 idle |
| temple | `temple` | `temple`（:1798，黄大仙祠） | wongtaisin（黄大仙祠） | 定时，全部 idle |
| oldtown | `oldtown` | `oldtown`（:1653，骑楼老街） | dapengfort、zhongyingjie，顺带 nantou、danshui、yuenlong | 定时，idx 0 walk、其余 idle |
| miniature | `miniature` | `miniature`（:1820，微缩地标） | window（世界之窗）、jinxiu（锦绣中华） | 定时，全部 idle |
| nature | `nature` | `park`（现有，青青世界是雨林公园） | qingqing（青青世界·蝴蝶谷） | 定时，idx 0 walk、其余 idle（沿用 stroll 的 park 走法） |
| farm | `farm` | `farm`（:1838，农场） | gmfarm（光明农场） | 定时，全部 idle |
| wetland | `wetland` | `beach`（现有，海上田园是滨海滩涂） | seagarden（海上田园·红树林） | 定时，idx 0 walk、idx 1 stretch、其余 idle（沿用 beach 的走法） |
| watershow | `watershow` | `watershow`（:1858，水秀 + 滨海商场） | octharbour（欢乐海岸） | 定时，全部 idle（+ D2 落点修复） |
| cycle | `cycle` | `bikehub`（:1918，骑行站 + 绿道） | missionhills（观澜湖）、tseungkwano（将军澳），顺带 honghualake（红花湖骑行站，也有 animKind cycle） | 定时，全部 idle |
| gallery | `gallery` | `museum`（:1700，博物馆展厅） | swcac（海上世界艺术中心），顺带 szmuseum、hzmuseum | 定时，全部 idle |

  tram / temple / oldtown / miniature / farm / watershow's 3D sets were already built in round-2 (g) — only the App.tsx-side LifeKind members + LIFE_SCENES copy + lifeStageFor mapping were missing, so LifeStage needed nothing new except D2. cycle / gallery / nature / wetland have no dedicated set and reuse the nearest real scene (not stroll).
  Why mostly "all idle" instead of idx 0 walk: the walk pose is a fixed route (x -3.5→2.75, z=0.55, `LifeStage.tsx:2955-2968`) and bystander dummies stand on it — the actor would clip through them (tram rider at (-0.6, 0.6), temple fortune-teller at (2.2, 0.5), miniature guide at (-1.8, 0.5), farm visitor at (2.6, 0.5), bikehub cyclist at (1.8, 0.35), museum visitor at (2.6, 0.3); watershow stage covers x -5.7…-1.5, z 0.3…1.9). oldtown's route is clean (stalls at z=-1.6, pillars at z=-2.9), so oldtown idx 0 walks; nature/wetland reuse the already-verified park/beach walk. All-idle has precedent (wheel idx 0 idle, coaster/safari all sit). Scene identity comes from the set + dedicated copy (snippet S1), not from walking.
- Integration — App.tsx snippets S1–S5 (all landed):
  - S1a `LifeKind` + 10 members (`App.tsx:580`); S1b `LIFE_SCENES` + 10 entries (`App.tsx:577` 起, after the gathering entry, copy verbatim from D's log: tram "坐叮叮车", temple "黄大仙祠上香", oldtown "逛老街", miniature "微缩世界一日游", farm "农场一日", watershow "欢乐海岸水秀", cycle "骑行绿道", gallery "看展", nature "青青世界 · 蝴蝶谷", wetland "海上田园 · 滩涂").
  - S2 `lifeStageFor` + 10 cases (`App.tsx:800` 起, after cablecar): tram/temple/miniature/farm/watershow/cycle/gallery all idle, oldtown/nature idx 0 walk, wetland idx 0 walk / idx 1 stretch.
  - S3 `ANIM_TO_LIFE` → identity map (`App.tsx:3444`); the stale comment above it ("are not LifeKinds yet — they fall back…", contradicting the new map) deleted.
  - S4 `CUTSCENE_ROAM` gains `code: "office", overtime: "office"` (`App.tsx:1886-1889`) — see Gap 10.
  - S5 `VENUE_TALK.office` gains code/leave dialogues (`App.tsx:81-88` 之后, after the toilet entry) — see Gap 10.
  - Note from D: S1/S2/S3 must land together — `lifeStageFor` has no default branch, a missing case returns undefined and `App.tsx:6781` `sp.set` would crash; `LIFE_SCENES` is `Record<LifeKind, LifeScene>`, a missing entry fails typecheck.

## Gap 9 — 宠物 3D (C + 集成）

### (a) 地图上的宠物 (C, MapView.tsx — 见 Gap 6 的文件清单）

`makePetGroup(pet)` (`MapView.tsx:472-575`), same approach as LifeStage `makeFigure` and the map-person builder: pure Three.js primitives, no new .glb. Faces +Z, same as actors (`rotation.y = heading`).
- Shared structure: 4 legs (cylinders, top pivot, 0.22 high, swinging around the pivot while walking); body ellipsoid (SphereGeometry scaled `0.85 / 0.78 / 1.3`, inside a `body` subgroup); lighter belly (same colour brightened 45%, small ellipsoid); head (sphere, front-top of body); two small black ball eyes (round-2's "no faceless" rule applies to animals too); badge sprite (`emojiSprite`, 🐱/🐶, size 0.9, 0.85 above head, same language as NPC badges).
- Cat vs dog (spec in `pets.ts` `PET_MODEL`):
  - Cat: pointed ears — two four-sided cones (ConeGeometry, pink inner ear); tail thin and long (0.42, r 0.028), pivot initial `rotation.x = -0.35`, curving upward; small pink nose; overall scale 1.0, ~0.55 high.
  - Dog: floppy ears — two flat long boxes (BoxGeometry, hanging down the sides of the head, slightly flared outward); tail thick and short (0.3, r 0.042), pivot initial `rotation.x = -1.15`, level and slightly raised backward; light-coloured muzzle box + dark nose; overall scale 1.28, ~0.7 high.
  - Colours: whole body uses the pet's own `pet.color`; floppy ears/legs darkened 55%, belly/muzzle brightened.
- Follow drive (frame loop, `MapView.tsx:3516-3562`): each frame `petRuntimeRef.current = stepPetFollow(pet, runtime, 玩家 x/z, 玩家 heading, dt)`, model position/heading copied from the return value. `stepPetFollow`'s teleport (>12 units) and ideal follow distance (0.9–2.2 by bond) used as-is. On pet swap (id/kind/color changed) the old model is disposed (`disposeObject` releases geometry/material/badge texture) and a new one built; hidden with no pet or while the player rides a train. `petRuntimeRef` resets to the player's feet on pet swap or city rebuild.
- Poses (from `stepPetFollow`'s return):
  - `follow`: four legs alternate swing by `petPhase` (±0.55 rad), tail sways side to side (sin 5Hz × 0.45), body bobs lightly;
  - `sit`: `body` subgroup `rotation.x` eases to -0.5 (chest up, sitting), legs stay grounded, tail sways slowly;
  - `play` (bond ≥70): small hops in place (`|sin| × 0.09`), tail fast wag (10Hz);
  - `sleep`: `body` leans forward 0.28 (lying down). Rarely seen on the map (pets at home are rendered by LifeStage), wired anyway.
- Not done by C: minimap doesn't draw the pet (it hugs the player at ideal distance 0.9–2.2, usually overlapping the player dot — invisible if drawn); no .glb (task required the LifeStage-builder primitive route; `client/public/models/` has no animal model to reuse).
- Integration: `activePet={getActivePet(pets)}` on MapView (`App.tsx:6126`, see Gap 6).

### (b) 家里的宠物 (C snippet → 集成，LifeStage.tsx + App.tsx）

- Props: `LifeStage.tsx:57` `homePet?: Pet | null` (`import { PET_MODEL, type Pet } from "./round2/pets"`; pets.ts has no imports, so no circular-import risk).
- `makePetGroup` + `PetParts` copied verbatim into `LifeStage.tsx:242` (C's option b; no shared module extracted, MapView's export untouched). Only change: the badge uses LifeStage's existing `faceSprite(spec.emoji)` (MapView's `emojiSprite(emoji, color)` doesn't exist here), scale overridden to 0.9.
- Render: `LifeStage.tsx:2724`, after the actor is built (`scene.add(actor.g)`), when `setKind === "flat" && homePet`, placed at (-3.6, 0, -2.7), `rotation.y = Math.PI` facing the door, body sit pose -0.5, `bobbers.push` breathing sway.
- App home render: `App.tsx:7563` `homePet={getActivePet(pets)}`.
- D's new content (office ROAM_SPOTS, watershow landing) untouched by this change.

## Gap 10 — 上班/加班过场改摇杆 (D snippet → 集成）

Mechanism already existed in App.tsx (round-2 (g) S5): when `CUTSCENE_ROAM[kind]` has a value, the cutscene renders `LifeStage3D pose="idle" roam` (`App.tsx:6783-6786`), a 2.3s timer skips that kind (`App.tsx:1787-1788`), and tapping any pin or "跳过" advances a beat. LifeStage-side office set + ROAM_SPOTS were ready (D1 added the beat points). So integration only added two keys to `CUTSCENE_ROAM` (snippet S4, `App.tsx:1886-1889`): `code: "office", overtime: "office"`. No renderer or timer change needed.
- code, 4 beats (刷卡进公司 / 坐下打开电脑 / 敲代码 / 提交起身接杯水) vs pins: enter → leave (door direction), sit/code → code (desk front), submit + water → coffee (pantry, existing point). overtime, 3 beats (办公室只剩几盏灯 / 再敲最后一行 / 走出大楼): first two → code, last → leave. The `day` montage's office beat (`lifeStageFor` "day" idx 4) untouched — it's not a CUTSCENE_ROAM member, still timed pose="type", out of scope.
- S5 `VENUE_TALK.office` (`App.tsx:81-88` 之后, after the toilet entry): `code` ("坐下来敲会儿代码", pose "type", xp 2 — pose "type" puts the actor on the desk chair at (0.4, -0.52, 0.42), exactly the own desk, matching the pin) and `leave` ("收拾东西准备下班", pose "idle", mood 2). Without these, the two new pins would do nothing in venue mode.

## Gap 11 — Lagos 缺口：赞助 / 打赏 / 拼单 / 每周任务 (E + 集成）

E changed: `server/src/actions.ts` (12 new endpoints + helpers), `server/src/schema.ts` (4 new tables), `drizzle/0020_round3_server.sql` (appended), `client/src/round2/delivery.ts` (client helpers + types + `LAGOS_GAP_CHECK` update). App.tsx / Livehouse.tsx untouched by E (integration landed snippets 1–4).

### (a) 商家赞助

- `getDeliverySponsors` (`actions.ts:5092`) — `{ playerId, city: "sz" | "hz" | "hk" }` → `{ ok, sponsors: [{ id, name, cuisine, emoji, tier, dishes: [{ name, cost, energy, mood, desc }], endsAt: ISO }] }`, only unexpired (`endsAt > now`) sponsors in this city. Checks: player exists + can only see own city. Deliberately no banned/muted gate: reading a menu isn't a social write. Data model is the `delivery_sponsors` table written by `deliverySponsorSlot` (`actions.ts:4769`, untouched by S); `dishesJson` parsed and returned as-is; a dish that fails parsing is dropped, not the whole order.
- Client (`delivery.ts`): `MenuRestaurant.sponsored?: boolean` (`:77-78`); `SponsoredDish` / `SponsoredRestaurant` types + `sponsoredRestaurantToMenu` + `mergeSponsoredMenu` (`:153-210`).
- Integration — snippet 1 (App.tsx:4824): `mergeSponsoredMenu(deliveryMenu(…), sponsors)`; restaurant cards gain a 「赞助」 badge; `sponsors` state + fetch effect at `App.tsx:1442-1446` (top-level effect — see integration deviations).
- `LAGOS_GAP_CHECK` `merchant-sponsor`: gap → done.

### (b) Livehouse 打赏 / 七成分成

- `tipTrack` (`actions.ts:5134`) — `{ playerId, trackId: number, amount: number (1–500, ¥), message?: string (≤100) }` → `{ ok, creatorShare?, creatorName? }`. Rules: track must be `status = "approved"`; musician = the `players` row for `musicTracks.accountId` (not found = "音乐人还没进游戏，暂时不能打赏"); can't tip your own track; insufficient balance rejected; max 10 tips per person per day (copied from `sendGift`'s 10/day).
- Money: existing ¥ ledger, no new money system — `creditMoney(db, tipper, -amount, "livehouse tip track #id")` + `creditMoney(db, musician, floor(amount×0.7), "livehouse tip from <名>")`, both through `writeLedger`; the 30% house cut is only recorded on the `livehouse_tips` row, it goes to nobody. Also writes a `feedEvents` row ("给 XX 的《歌》打赏了 ¥30") and `ctx.invalidateQueries()`.
- Note: round-2 notes suggested ✨ ("听众花 ✨ 点歌，七成归音乐人"), but this round's task explicitly requires `ledger/writeLedger`, so ¥ is used. To switch to ✨, swap the two `creditMoney` calls for `bookStars` (tipper -amount / musician +share); the table doesn't change.
- `getLivehouseTips` (`actions.ts:5166`) — `{ playerId }` → `{ ok, totalEarned, mine: [{ id, trackId, trackTitle, tipperName, amount, creatorShare, message, createdAt: ISO }] (latest 20), totals: [{ trackId, total, count }] }`. `mine` = "tips I received", `totals` = per-track totals city-wide (carousel UI can show "这首歌已收到 ¥X 打赏"), `totalEarned` = sum of `creatorShare` over these 20 rows only (not the historical total — see "没做成的事" §7).
- Client (`delivery.ts`): `TIP_AMOUNTS` / `TIP_CREATOR_SHARE` / `tipCreatorShare` / `LivehouseTip` (`:1029-1050`).
- Integration — snippet 2: Livehouse.tsx "正在播放" area gains ¥10/30/88 tip buttons (`TIP_AMOUNTS`), `tipSent` resets when `cur.id` changes; `App.tsx:7465` 左右 passes `playerId={profile?.playerId ?? ""}` to LivehouseModal (new prop `playerId` on Livehouse.tsx); musician income area (`getLivehouseTips` mine + totalEarned) placed below the "我是音乐人" section; carousel "接下来" list shows "已收到打赏 ¥X" after each track (`totals`).
- `LAGOS_GAP_CHECK` `creator-payout`: gap → done.

### (c) 顾客拼单 (not `delivery.ts:574` rider `stackWith`)

- `createGroupOrder` (`actions.ts:5199`) — `{ playerId, city, restaurantId, restaurantName, items: [{ key, name, qty, cost }] (1–20 items) }` → `{ ok, groupId?, code? }`; `code` is a 6-char code (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`, no 0/O/1/I, safe to say aloud; re-drawn up to 5 times on collision). Rules: same city; ban/mute refused; one person in at most one active group at a time (host or member counts); host automatically becomes member 1; `expiresAt = now + 30 min`.
- `joinGroupOrder` (`actions.ts:5231`) — `{ playerId, code: string (6 chars), items: [{ key, name, qty, cost }] }` → `{ ok, groupId?, memberCount? }`. Rules: code finds a `status = "open"` group (expired groups lazily cancelled by `groupOrderView` first); wrong city refused; already in the group / group full at 6 / already in another group all refused.
- `getGroupOrder` (`actions.ts:5255`) — `{ playerId, groupId: number }` → `{ ok, group: { id, code, city, hostId, hostName, restaurantId, restaurantName, status, createdAt, expiresAt, members: [{ playerId, playerName, items, subtotal, joinedAt }] } | null }`. Only host/members can read. Expired groups lazily cancelled on read (`status → cancelled`, copied from `expirePoolOrders`).
- `leaveGroupOrder` (`actions.ts:5270`) — `{ playerId, groupId }` → `{ ok }`. Only `open` state can be left; host leaving = whole group cancelled (member rows kept; other members see `cancelled` on next read, not "you're not in the group"); can't leave after lock / order.
- `lockGroupOrder` (`actions.ts:5288`) — `{ playerId, groupId }` → `{ ok, group? }`. Host only, `open → locked`. After lock nobody can join; the host merges everyone's dishes with client `mergeGroupItems` into one `placeOrder`.
- `completeGroupOrder` (`actions.ts:5305`) — `{ playerId, groupId }` → `{ ok }`. Host only, `locked → ordered`, called after the merged order is placed, closing the loop.
- Internal (`actions.ts:1192-1263`, outside the `Actions` object, before S's police helpers): `WEEKLY_QUEST_DEFS` (`:1195`), `weekKeyOf(d)` (`:1202`, Beijing-time ISO week, `"2026-W46"`), `ensureWeeklyQuestRows(db, playerId, weekKey)` (`:1212`, `onConflictDoNothing` fills rows), `randomGroupCode()` + `GROUP_CODE_CHARS` (`:1218-1223`), `GROUP_ORDER_MAX_MEMBERS = 6`, `GROUP_ORDER_TTL_MS = 30 min`, `GROUP_ORDER_ITEM_Z` / `GROUP_ORDER_VIEW` (`:1224-1231`, zod shapes shared by the 6 group-order endpoints), `groupOrderView(db, groupId)` (`:1233`, reads group + members, lazily cancels expired `open` groups), `openGroupOf(db, playerId)` (`:1253`, one-active-group check, host or member counts).
- Client (`delivery.ts`): `GroupOrderItem` / `GroupOrderMember` / `GroupOrderStatus` / `GroupOrderView` / `GROUP_ORDER_MAX_MEMBERS` / `GROUP_ORDER_TTL_MINUTES` / `groupOrderTotals` / `mergeGroupItems` / `groupOrderShareText` (`:1052-1120`); `DeliveryState.activeGroup?: { id, code } | null` (`:948`) + `emptyDeliveryState` `activeGroup: null` (`:961`).
- Integration — snippet 3 (App.tsx:4836 起): `startGroup` / `joinGroup` / `lockAndOrder` / `leaveGroup`; group card (members + each person's dishes + `groupOrderTotals` split + copy code + host locks and merges); on entering the food page, if `d.activeGroup` has a value, a top-level effect restores the group card; merging goes through existing `submitDeliveryOrder(mergeGroupItems(…))`, then `completeGroupOrder`.
- `LAGOS_GAP_CHECK` `group-order`: gap → done.

### (d) 顾客侧每周任务

- `getWeeklyQuests` (`actions.ts:5331`) — `{ playerId }` → `{ ok, weekKey: "2026-W46", quests: [{ questId, progress, target, claimed }] }`, week by Beijing ISO week (`weekKeyOf`, `actions.ts:1202`), missing rows auto-filled with 4 rows.
- `reportDeliveryQuest` (`actions.ts:5353`) — `{ playerId, event: "order" | "rate", restaurantId?, amount?, stars? }` → `{ ok, weekKey, quests: [...] }` (same shape as getWeeklyQuests, UI can refresh directly). Progress rules: `order` → `order-3` +1 (cap 3), `spend-100` += order amount (cap 100), `try-new`: `restaurantId` not in that week's `meta.seen` counts 1 and is written into `seen`; `rate` with `stars === 5` → `rate-5` counts 1. Also `communityRateOk` 10/min rate limit (reuses (c)'s write limit).
- `claimWeeklyQuest` (`actions.ts:5406`) — `{ playerId, questId }` → `{ ok, reward?: { kind: "money" | "coupon", amount?, couponId?, label } }`. Rules: progress short / already claimed both refused; claiming uses a `claimed = 0` compare-and-set one-time mark against re-entry; ¥ rewards `creditMoney` straight to the account (writes ledger), coupon rewards only return `couponId` (`weekly-free-delivery` / `weekly-off-8`), added to `state.coupons` by client `grantWeeklyCoupon`.
- Quest defs — `WEEKLY_QUEST_DEFS` (`:1195`, server mirror, kept in sync with client `WEEKLY_QUESTS`): `order-3` target 3 → free-delivery coupon `weekly-free-delivery`; `try-new` target 1 → ¥15; `rate-5` target 1 → ¥8-off coupon `weekly-off-8`; `spend-100` target 100 → ¥20.
- Trust model (important): progress is client-reported — same as the rest of delivery money, which is client-computed (the business-plan's stated position); a stricter version could only derive from pool orders, but local orders never enter the pool. Rewards are small (¥15/¥20 + two coupons), so farming gains only the quest rewards themselves.
- Client (`delivery.ts`): `WeeklyQuestDef` / `WEEKLY_QUESTS` / `WEEKLY_REWARD_COUPONS` / `WeeklyQuestProgress` / `weeklyQuestState` / `grantWeeklyCoupon` (`:1122-1172`).
- Integration — snippet 4: food-page quest card (`WEEKLY_QUESTS` + `weeklyQuestState` + claim button); `claimQuest` (coupons via `grantWeeklyCoupon`, ¥ credited directly by the server); progress reporting wired after `submitDeliveryOrder` success (`reportDeliveryQuest` event "order", quest card refreshed after reporting).
- `LAGOS_GAP_CHECK` `retention-loop`: partial → done. `food-delivery` stays partial — not this round's gap, it was already waiting on App.tsx wiring (round-2's integration snippet not yet connected). Other 6 items (entry / billboards / nightclub / currency / invite) stay done. After the update `lagosGapSummary()`: done 9, partial 1 (food-delivery), gap 0.

## Gap 12 — 重复 id `"gym"` (A + 集成）

New id: `honghualake`. Naming: surrounding Huizhou places are all pinyin / pinyin+landform (luofu, nankunshan, xiangtoushan, gaobangshan, dongjiangpark, hzbotanic, hejiang, danshui, dayawan, xiayong, xunliao, haiguiwan, sanjiaozhou, tanyue); "红花湖" takes `honghua` + `lake`, less collision-prone than bare `honghua`, and isomorphic with `dongjiangpark` (pinyin+park). `honghualake` had 0 hits repo-wide before. The `"gym"` kept is `data.ts:588` Shenzhen community gym (`type: "gym"`, id matches type, no ambiguity).
- All updated references (every `"gym"` / `'gym'` grep checked):
  - `client/src/data.ts:641` (was :638) — the place itself: `{ id: "gym", type: "scenic", name: "红花湖骑行站", … }` → `id: "honghualake"` (other fields unchanged: `venueSet: "cycle"`, `animKind: "cycle"` — interior still goes to bikehub).
  - `client/src/data.ts:1116` (was :1113) — `SCENIC_SPOTS` check-in entry: `{ locId: "gym", cityKey: "hz", name: "红花湖", … }` → `locId: "honghualake"` (`scenicOf` matches by locId; check-in progress `visitedScenic` stores `hz:<locId>`, so it must change together).
  - `client/src/places-hz.ts:8` — `HZ_LOC_KM`: `"gym": [-1.94, 1.01]` → `"honghualake": [-1.94, 1.01]` (`data.ts:804` `realKmOf` looks up hz places by locId in this table; that key can only be the Honghua Lake cycling station — the Shenzhen community gym isn't in this Huizhou table).
- Checked and deliberately not changed: `routines.ts:414` `coach: { where: ["gym"] }` (a `where` list holds place *types*, not ids — same table's sales `["mall", "electronics", "oilpainting"]`, chef `["food", "market", …]` are all types); `activities.ts:48` `isSport`, `clock.ts:81` action durations, `App.tsx:4347` `case "gym"` action, `App.tsx:572/723/1773/3186/3319/3922` LifeKind `"gym"`, `LifeStage.tsx:20/664/2014` LifeSet `"gym"`, `venues.ts:169` byType `gym`, `data.ts:502/519` type unions, `data.ts:250` NPC `preferTypes: ["learn", "gym"]`, `data.ts:765` stadium `type: "gym"` — all types / action kinds / scene names, not place ids. `experience.ts:632-633` lakeside itinerary stops use the place *name* "红花湖骑行站", unchanged. `scenic.ts` has no `"gym"` reference (only `scenic.ts:51` xunliao sunset, unrelated). `MapView.tsx` has no place-id `"gym"` reference.
- Recheck: after the change `{ id: "gym"` appears exactly once in data.ts (Shenzhen community gym); `{ id: "honghualake"` appears once. Other multiply-appearing ids (metro ×4, home ×4, ktv ×3, food ×3, bank ×3) are SZ / HZ / HK per-city same-name places (one set per city), pre-existing since before round-2, unrelated, untouched.
- Integration — S4 old-save migration (`sanitizeSave`, App.tsx): `visitedScenic` (`:2133`): `strArr(g.visitedScenic).map((k) => (k === "hz:gym" ? "hz:honghualake" : k))`; `loc` ternary chain (`:2164`): appends `hz` + `gym` → `honghualake` (same style as the existing `hq`→`qiaodong` / `work`→`work-hz` branches). Only two save fields can hold the old id: `g.loc` (player's current place) and `visitedScenic` (stores `hz:<locId>`). `venueFx` keys are `${day}:${LifeSet}:${talkId}` (place-id independent), `apecCheckins` only stores summit places, `album` / `npcGigs` / `offers` etc. don't store place ids — none need migration. Without migration: old saves with `loc: "gym"` in hz find no place (fallback handles it), and `hz:gym` in `visitedScenic` never matches the new id — Honghua Lake shows as un-checked-in. One check-in progress lost, save not lost.
- Left open by A: `client/src/i18n-en.ts:1166` `"红花湖骑行站": "Honghuahu Lake Cycling"` — suspected spelling error (should be "Honghua Lake"); i18n-en wasn't in A's editable files, untouched.

## Gap 13 — 青青世界蝴蝶 + 工厂食堂 (A + 集成）

Audit correction verified by A: of the 6 "missing" venue talks, 5 were renames, not losses — oilpainting `copy` (看画家临摹) → App.tsx `paint` (看画家作画); seafood `pick` (挑一只活海鲜) → `buy` (挑点海鲜); womensstreet `goldfish` (看金鱼档) → `fish` (买条金鱼); factory `line` (看一条产线) → `tour` (看看产线); museum `look` (在展柜前站一会儿) → `exhibit` (慢慢看展). Only 2 were truly lost: nature `butterfly` (在蝴蝶谷站一会儿) — App.tsx has no `nature` key (nature→park alias, park only has bench/stroll/photo, `App.tsx:113-117`); factory `canteen` (在食堂吃一顿) — App.tsx factory only has tour/ask (`App.tsx:166-169`). Only the 2 truly-lost ones were fixed; the 5 renames weren't re-fixed.
- `venues.ts` already had both definitions, no restore needed: `VENUE_TALK.nature` butterfly `{ id: "butterfly", emoji: "🦋", zh: "在蝴蝶谷站一会儿", … mood: 10 }`; `VENUE_TALK.factory` line + canteen `{ id: "canteen", emoji: "🍱", zh: "在食堂吃一顿", … money: -12, mood: 4, energy: 10 }`. A didn't change those two spots (it changed the fishing-port spots, §7).
- Integration — S2 butterfly, Qingqing World only (`App.tsx:217-221`): do NOT add butterfly to `VENUE_TALK.park` (`App.tsx:113-117`) — that would give every park in the city a butterfly valley. Instead a per-place helper after the `VENUE_TALK` definition, near `venueFor` (`App.tsx:216`): `QINGQING_TALK` (copy verbatim from venues.ts nature.butterfly) + `venueTalksFor(set, locId)` returning park talks + butterfly only when `locId === "qingqing"` (青青世界 id, `data.ts:616`). Both lookups switched to the helper — `onSpot` (`:7492`) and the button list (`:7502`). `VENUE_TALK.park` untouched. `runVenueTalk` mood bonus goes through the generic path (venueFx once a day); `butterfly` isn't in the fun-bonus id list, no change to `runVenueTalk`.
- Integration — S3 factory canteen (`VENUE_TALK.factory`, after the `ask` entry): `{ id: "canteen", emoji: "🍱", zh: "在食堂吃一顿", en: "Eat in the canteen", who: "自己", whoEn: "You", say: "「大锅饭，管饱。」", sayEn: "“Canteen food. Filling.”", pose: "eat", money: -12, mood: 4, energy: 10, hunger: 28 }`. Only difference from venues.ts: added `hunger: 28` (venues.ts canteen has no hunger field; App.tsx's comparable eating talks like seafood's `eat` carry `hunger: 28`, and `runVenueTalk` reads `v.hunger` for fullness — without it, eating fills nothing; removable if verbatim parity with venues.ts is wanted).

## 服务端（本轮新增，66/66 之外）

Round-2 server: 66/66 endpoints, 35 tables, migration 0019. Round-3 adds 19 endpoints + 7 tables, migration `drizzle/0020_round3_server.sql` (created by S with 30 lines: 3 new tables + 4 `ALTER TABLE trade_tasks ADD COLUMN`; appended by E to 76 lines with 4 more `CREATE TABLE`s; `drizzle/meta/_journal.json` gained idx 19 entry, `when: 1795700000000`, `tag: "0020_round3_server"`, following 0019's `when` +1 billion).

### 新端点（19 个，全在 `server/src/actions.ts`)

| 端点 | 位置 | 来源 |
|---|---|---|
| `tradeDisputeVote` | `actions.ts:3844` | S, 缺口 1 |
| `adjudicateTradeDispute` | `actions.ts:3867` | S, 缺口 1 |
| `startPatrol` | `actions.ts:4680` | S, 缺口 2 |
| `stopPatrol` | `actions.ts:4698` | S, 缺口 2 |
| `observe` | `actions.ts:4712` | S, 缺口 2 |
| `stopObserving` | `actions.ts:4738` | S, 缺口 2 |
| `getWatchers` | `actions.ts:4751` | S, 缺口 2 |
| `getDeliverySponsors` | `actions.ts:5092` | E, 缺口 11(a) |
| `tipTrack` | `actions.ts:5134` | E, 缺口 11(b) |
| `getLivehouseTips` | `actions.ts:5166` | E, 缺口 11(b) |
| `createGroupOrder` | `actions.ts:5199` | E, 缺口 11(c) |
| `joinGroupOrder` | `actions.ts:5231` | E, 缺口 11(c) |
| `getGroupOrder` | `actions.ts:5255` | E, 缺口 11(c) |
| `leaveGroupOrder` | `actions.ts:5270` | E, 缺口 11(c) |
| `lockGroupOrder` | `actions.ts:5288` | E, 缺口 11(c) |
| `completeGroupOrder` | `actions.ts:5305` | E, 缺口 11(c) |
| `getWeeklyQuests` | `actions.ts:5331` | E, 缺口 11(d) |
| `reportDeliveryQuest` | `actions.ts:5353` | E, 缺口 11(d) |
| `claimWeeklyQuest` | `actions.ts:5406` | E, 缺口 11(d) |

New-endpoint details are in the per-gap sections above (Gap 1, Gap 2, Gap 11). E's 12 endpoints sit after `deliverySponsorSlot` and before `} satisfies ActionsModule;`; S's endpoints sit at the positions listed; neither agent touched the other's endpoints.

### 新表（7 张）

| 表 | schema.ts | 迁移 |
|---|---|---|
| `trade_dispute_votes` (`task_id`, `voter_id`, `side`, `created_at`, PK `(task_id, voter_id)`) — can't reuse existing jury tables: `gig_votes` keys on `gigId`, `black_report_votes` on `reportId`, neither fits a trade task | `schema.ts:853` (S) | 0020 |
| `patrols` (`officer_id` PK, `city`, `started_at`) | `schema.ts:865` (S) | 0020 |
| `patrol_watches` (`officer_id`, `target_id`, `note`, `city`, `started_at`, PK `(officer_id, target_id)`) | `schema.ts:870` (S) | 0020 |
| `livehouse_tips` (`id` 自增 PK, `track_id`, `tipper_id`, `tipper_name`, `creator_id`, `amount`（听众付的 ¥), `creator_share`（七成）, `message`, `created_at`) | `schema.ts:885` (E) | 0020 追加 |
| `group_orders` (`id` 自增 PK, `city`, `host_id`, `host_name`, `restaurant_id`, `restaurant_name`, `code`, `status` (open/locked/ordered/cancelled, 默认 open), `created_at`, `expires_at`) | `schema.ts:896` (E) | 0020 追加 |
| `group_order_members` (PK `(group_id, player_id)`, `player_name`, `items_json` (`[{key,name,qty,cost}]`), `subtotal`, `joined_at`) | `schema.ts:908` (E) | 0020 追加 |
| `delivery_quests` (PK `(player_id, week_key, quest_id)`, `progress`, `claimed` (0/1), `meta` (JSON, `{seen:[restaurantId...]}` 供 try-new 用), `updated_at`) | `schema.ts:916` (E) | 0020 追加 |

Plus `trade_tasks` + 4 columns (`schema.ts:617-620`, migration 0020): `disputed_at`, `dispute_from_status`, `dispute_verdict`, `dispute_settled_at`. Old already-disputed rows have NULL in these 4 columns; settlement counts expiry from `createdAt + 24h` (`settleTradeDisputes` uses `disputedAt ?? createdAt`).

S's internal helpers: `TRADE_JURY_MS` / `TRADE_JURY_QUORUM` / `tradeDisputeTallies` / `settleTradeDisputes` (`actions.ts:1022-1078`), `tradeTaskShape` + `tradeTaskView` fields (`:1078-1090`), police helpers `PATROL_TTL_MS` / `isGameAvatarId` / `expirePatrols` / `activePatrol` (`:1192-1221`). E's internal helpers: `WEEKLY_QUEST_DEFS` / `weekKeyOf` / `ensureWeeklyQuestRows` / `randomGroupCode` / `GROUP_ORDER_MAX_MEMBERS` / `GROUP_ORDER_TTL_MS` / `GROUP_ORDER_ITEM_Z` / `GROUP_ORDER_VIEW` / `groupOrderView` / `openGroupOf` (`actions.ts:1192-1263`, before S's police helpers).

## 集成（int, 2026-11-11）

Integration agent landed all snippets from S / A / B / C / D / E, plus Gap 1+2 client wiring and the home-pet render, and ran full verification. Only 7 files changed (per ROUND3-LOG-int.md):

| 文件 | 改动 |
|---|---|
| `client/src/App.tsx` | All A–E snippets + C map wiring + Gap 1+2 client wiring |
| `client/src/LifeStage.tsx` | C home pet (appended) + B build-plot preview colours; D's new content untouched |
| `client/src/MiniGame.tsx` | B mahjong onPush callback |
| `client/src/Livehouse.tsx` | E tip UI + income area (new prop `playerId`) |
| `client/src/round2/police.ts` | Gap 2: in-memory Map → 5 server endpoints |
| `client/src/round2/economy.ts` | Gap 1: TradeTask gains dispute fields |
| `ROUND3-LOG-int.md` | The integration log itself |

Not touched: data.ts, MapView.tsx, server/*, drizzle/*, .env, standalone/dist/ (build output is generated by `npm run build` itself), ~/workspace/ts-spaces/, any .db file (except the new test DB, see verification).

Snippets landed, per agent:
- A (4): S1 fishing-port actions (`App.tsx:4406`); S2 butterfly-only-for-Qingqing (`QINGQING_TALK` + `venueTalksFor`, `App.tsx:217-221`; lookups at `:7492` / `:7502`; `VENUE_TALK.park` untouched); S3 factory canteen (`VENUE_TALK.factory`, money -12 / mood +4 / energy +10 / hunger 28, hunger per snippet); S4 save migration (`sanitizeSave`: `visitedScenic` `:2133`, `loc` ternary `:2164`).
- B: import `markUnemployed, markEmployed` (`App.tsx:44`); markUnemployed in the layoff handler (`:7863`); markEmployed companion in `case "join-company"` (`:3134`); mahjong wiring (MiniGame.tsx props `:21` + Meter `:41`; App.tsx render `:7636` + start/finish knocks after each `setPlay`).
- C: map wiring (`App.tsx:1420` `communityMarkers` useMemo from the four existing queries `:1340-1343`; MapView props `:6126`; `getActivePet` added to the pets import `:40`); home pet (`LifeStage.tsx:57` prop, `:242` builder, `:2724` render; `App.tsx:7563` `homePet={getActivePet(pets)}`).
- D: S1a LifeKind + 10 (`App.tsx:580`), S1b LIFE_SCENES + 10 (`App.tsx:577` 起, after gathering), S2 lifeStageFor + 10 cases (`App.tsx:800` 起, after cablecar), S3 ANIM_TO_LIFE identity map (`App.tsx:3444`, stale comment above deleted), S4 CUTSCENE_ROAM `code`/`overtime` (`App.tsx:1886-1889`), S5 VENUE_TALK.office code/leave dialogues (`App.tsx:81-88` 之后).
- E: import (`App.tsx:45`: `mergeSponsoredMenu, groupOrderTotals, mergeGroupItems, groupOrderShareText, WEEKLY_QUESTS, weeklyQuestState, grantWeeklyCoupon` + `SponsoredRestaurant` / `GroupOrderView` / `GroupOrderItem` / `WeeklyQuestProgress` types); snippet 1 sponsors (`App.tsx:4824`); snippet 2 tips (Livehouse.tsx buttons + income area; `App.tsx:7465` 左右 `playerId` prop); snippet 3 group order (`App.tsx:4836` 起 `startGroup` / `joinGroup` / `lockAndOrder` / `leaveGroup` + group card + restore effect); snippet 4 weekly quests (food-page quest card + `claimQuest` + `reportDeliveryQuest` after `submitDeliveryOrder` success).

Deviations found and fixed during integration (3):
1. E snippet 1/4 put `useEffect` at `App.tsx:4694` / inside the food page — that's inside the `renderPhoneApp` function body (conditional call); hooks can't go there. Moved to top-level effects (`App.tsx:1438-1445`, fetching sponsors + quests on `cityKey` / `phase` / `profile`; plus a separate effect restoring the group card when `phoneApp === "food"`).
2. Server `getGroupOrder` returns `group.city` as a string (`GROUP_ORDER_VIEW` not narrowed), incompatible with client `GroupOrderView.city: CityKey` — 3 `setGroup(g.group)` call sites changed to `setGroup(g.group as unknown as GroupOrderView)` (`App.tsx:1452` / `:4846` / `:4858`).
3. B's snippet 1 asked MiniGame.tsx to add `import { sfx } from "./sound"` at the top, but that import has no use site inside MiniGame (sound goes through the `onPush` callback) and would trigger TS6133 — not added, typecheck 0 errors.

Also fixed during integration (typecheck): 2 unused imports introduced by the integration itself (`CommunityMapMarker`, `TIP_AMOUNTS` — the latter is only used in Livehouse.tsx, App.tsx doesn't need it) + the 3 `GroupOrderView` casts above = 5 typecheck errors fixed in total.

Baseline note: typecheck before integration was already 0 errors — the 7 MapView + 2 actions.ts unused declarations D reported were already cleared by C after C finished (C's log: cleared one unread ref, then 0 errors), so nothing more needed deleting. `server/src/actions.ts` untouched by integration.

Not landed: rate-5 quest progress reporting — E's snippet 4 says "after a good review (where `rateRestaurant` is called)", but `rateRestaurant` (`delivery.ts:999`) is never called in App.tsx; there's no rating UI. order / spend-100 / try-new report on order normally; rate-5 currently has no trigger (see "没做成的事" §2).

## 验证结果（集成 agent, 全部通过）

1. typecheck: `cd standalone && npm run typecheck` (`tsc --noEmit -p tsconfig.json`) — **0 错误** (5 fixed along the way: 2 unused imports + 3 GroupOrderView casts, see integration §九).
2. vite build: `cd standalone && npm run build` — **成功, 8.29s** (`index-*.js` 1,950.18 kB, gzip 726.81 kB).
3. Server (fresh test DB, old DB untouched):
   - Start: `cd standalone && DB_PATH=/home/hatch/workspace/shenhui-life-sim/.local-test/app-round3.db PORT=8787 HOST=127.0.0.1 ADMIN_TOKEN=test-admin-token-1234 DEV_LOGIN_CODES=1 DEV_PAYMENTS=0 WEATHER=off npx tsx server.ts` (background, **left running, not stopped**).
   - Log: migrations 0001–0020 all applied, including `[db] applied 0020_round3_server.sql`.
   - `curl http://127.0.0.1:8787/` → **HTTP 200**, title `<title>湾区人生</title>`.
   - Read-only check of the new DB: 7 new tables all present — `trade_dispute_votes` / `patrols` / `patrol_watches` / `livehouse_tips` / `group_orders` / `group_order_members` / `delivery_quests`; `trade_tasks` contains `disputed_at` / `dispute_from_status` / `dispute_verdict` / `dispute_settled_at` (plus pre-existing `dispute_reason`).
   - No browser verification (this environment has no browser task; round-2 already knows cloud browsers refuse local addresses — needs lee's Mac or a browser handoff for real testing).
4. Per-agent verification (before integration): A typecheck 0 errors (no vite build, no server, no browser); B typecheck 0 errors + house-layout runtime spot check (see Gap 5); C typecheck 0 errors twice (second run after clearing one unread ref); D typecheck 9 errors, all outside LifeStage.tsx (7 MapView + 2 actions.ts unused declarations from parallel agents — already cleared by C, see integration baseline note), LifeStage.tsx itself 0 errors; E typecheck 0 errors (first pass 1 error: implicit any `m` in `groupOrderView`'s `rows.map` — helper `db: Db` lacked a schema generic; fixed with explicit `typeof schema.groupOrderMembers.$inferSelect`) + migration test on a /tmp temp DB (0019 + 0020 applied per `standalone/server.ts` split logic, 4 new tables present, one row inserted into each of `livehouse_tips` / `group_orders` / `group_order_members` / `delivery_quests`; temp DB deleted); S typecheck 0 errors + migration test on a /tmp temp DB (0019 + 0020, 3 new tables present, `trade_tasks` 4 columns present, `trade_dispute_votes` / `patrol_watches` rows insertable; temp DB deleted). None of A–E ran vite build (task restriction, except integration) or started a server (except integration) or did browser verification.

## 没做成的事（照 ROUND3-LOG-int.md §十一原文，7 条）

1. **盖房槽位仍是 7 个**：第 8 件家具起仍 `no-free-slot` 丢弃。服务端 `publishHome` 只认 slot 0–6、最多 8 件，server 不在本任务可改范围，客户端单方面加槽位会被拒绝。预览配色已修（Gap 5）。
2. **每周任务 rate-5 无触发点**：`rateRestaurant` 在 App.tsx 里从未被调用，没有评分 UI，所以 `reportDeliveryQuest({ event: "rate", stars: 5 })` 无处可接；order / try-new / spend-100 三项已接。需要先在外卖页加"吃完打分"入口。
3. **拼单不托管钱**：与 E 的设计一致——各人那份仍是客户端算，server 只存组成；发起人合单时整单由发起人先付，`groupOrderTotals` 只算数不转账。真分账要另加 escrow + 结算端点。
4. **蝴蝶 / 食堂的 3D 光柱点未加**：`ROAM_SPOTS.park` 只有 bench/stroll/photo、`ROAM_SPOTS.factory` 只有 tour/ask，两条新 talk 目前只以按钮形式出现（A 日志已说明是后续可选工作）。
5. **打赏用 ¥ 不用 ✨**：按 E 的任务要求走 `ledger/writeLedger`（¥ 账本）；要改 ✨ 需换 `tipTrack` 里的两次 `creditMoney`，客户端不用动。
6. **浏览器验证未做**：地图图钉点击、宠物跟随/坐姿、巡逻 👁️ 跨会话可见、陪审投票到结算全链路、拼单合单下单，均需在真机/浏览器里点一遍；typecheck + build + 服务器 200 只证明静态与启动正确。
7. **`getLivehouseTips.totalEarned` 只汇总最新 20 条**（E 日志原话）：历史总额要另算，UI 文案已按"最近 20 条"写明。

Other known limitations carried over from the per-agent logs (not new work, recorded as-is):
- 麻将 mp3 仍缺（SFXMint 429 限流，未再试，未伪造；定时任务明早 9 点 PST 再试；接线已就绪，文件到货后 `sound.ts:60` 改一行即可）。
- 拼单没有推送：成员加入/锁定/取消不会主动通知其他成员，靠进外卖页时 `getGroupOrder` 刷新；要实时得另加轮询或推送通道。
- 每周任务进度客户端上报（信任模型见 Gap 11(d)；防刷只有 10 次/分钟限流 + 进度封顶；真要服务端可信，得把本地单也写进池）。
- `adjudicateTradeDispute` 是"触发结算 + 返回结果"，不是自动定时器：若没有任何玩家调用它且没人打开交易板，到期纠纷会在下一次 `getTradeTasks` / `getMyTradeTasks` / `tradeDisputeVote` / `adjudicateTradeDispute` 调用时才结算——与黑举报（`getBlackReports` 里结算）同一模式。如需严格准时，可另起定时任务扫 `settleTradeDisputes`。
- 服务端无法校验 NPC 观察目标 id 是否真实存在（`observe` 一节）；如需严格校验，客户端接线时应只传 `data.ts` 里有的 NPC id。巡逻 TTL 6 小时是拍脑袋的数：巡逻中途过期会丢掉观察记录；如客户端希望巡逻跟随在线状态，应在心跳里调 `startPatrol` 刷新，或把 TTL 改短/改长。
- 钓点图钉"只在靠近水域时显示"没做（`toMapMarkers` 不区分水域；上报的钓点本身就带位置，按 MapView 已有方式做，与其他三类一样按正常优先级显示）；流浪动物"信任 ≥40 时显示想靠近"小提示没做（`toMapMarkers` 的 label 已含信任值，如"流浪猫 · 亲人 · 信任 45"，图钉上直接能看到）。
- D: tram/temple/oldtown/miniature/farm/watershow/bikehub/museum 在 `experience.ts` 的 SCENE_PHOTOS 里没有实拍照片条目——不影响运行（`PhotoCreditLine` 对 undefined url 返回 null，`LifeStage.tsx:2686` 只在 `photoUrl` 存在时挂背景照片；没有照片时就是纯 3D 布景）。后续如想加实拍背景，在 experience.ts 里给这 7 个 set 加照片即可，不动 LifeStage。
- A: taio 的地面动作未另写（大澳是 `type: "scenic"`，走通用 scenic 动作，本次认为已够用；如 lee 想要大澳专属动作（咸鱼/虾酱/坐艇），可再补）。i18n-en "Honghuahu Lake Cycling" 疑似拼写错误未改（不在 A 的可改文件内）。

## 已核实修好的对照表（审计 13 处）

| # | 缺口 | 状态 | 依据 |
|---|---|---|---|
| 1 | 交易纠纷陪审团 | ✅ 彻底修好 | S: 2 端点 + `trade_dispute_votes` + `trade_tasks` 4 列；集成: 纠纷 UI（我的纠纷 + 陪审团入口 + 投票/结算）已接。结算无自动定时器是设计如此（见"没做成的事"外的说明），不是未修好。 |
| 2 | 警察巡逻服务端化 | ✅ 彻底修好 | S: 5 端点 + `patrols` / `patrol_watches`；集成: police.ts 整段替换为 server 调用 + 巡逻面板/👁️ 轮询已接。服务端无法校验 NPC id 真实性是已知限制，不是未修好。 |
| 3 | markUnemployed 调用点 | ✅ 彻底修好 | B 扫出唯一入口（layoff 剧情 sign/fight）；集成已接 + markEmployed 配套清零。 |
| 4 | 麻将音效 | ⚠️ 只修一半 | 接线彻底修好（MiniGame onPush + App.tsx 三处敲击，sound.ts 无需改）；mp3 文件本身仍缺（SFXMint 429，未再试，未伪造），到货前响的是 synth knock fallback。 |
| 5 | 盖房 14 件家具 | ⚠️ 只修一半 | 14 个 id 全部接通发布（not-in-catalog 丢弃归零）+ 预览配色已修；7 个槽位天花板仍在，第 8 件起仍 `no-free-slot` 丢弃（需 server 改 `publishHome` 才能加槽位）。 |
| 6 | 地图 npcAllowedAt + 社区图钉 | ✅ 彻底修好 | C: MapView npcAllowedAt + 图钉渲染/同步/小地图/备用列表；集成: App.tsx 三个 prop 已接。钓点水域显示、信任小提示是注释示例里的想法，未做（见上节），不属于缺口本体。 |
| 7 | 巽寮湾渔港 fishingport | ✅ 彻底修好 | A: venueSet + copy + animKind；集成: S1 渔港地面动作已接；场景可达性沿代码链 9 步核实。浏览器实测未做（见"没做成的事" §6）。 |
| 8 | 动画层 10 处仍播散步 | ✅ 彻底修好 | D: LifeStage 落点修复 + S1–S5 全部落地；10 个 kind 里 0 个映射到 stroll。SCENE_PHOTOS 缺实拍照片不影响运行（见上节）。 |
| 9 | 宠物 3D | ✅ 彻底修好 | (a) 地图跟随宠物：C 的 makePetGroup + 帧循环驱动；集成 `activePet` 已接。(b) 家里宠物：C snippet → 集成已渲染（LifeStage 坐姿 + App 接线）。 |
| 10 | 上班/加班改摇杆 | ✅ 彻底修好 | D: office code/leave 两个节拍点 + S4/S5 全部落地；渲染与定时器本就通用，无需再改。 |
| 11 | Lagos 缺口（赞助/打赏/拼单/每周任务） | ⚠️ 只修一半 | 4 项服务端 + 客户端 helper + App/Livehouse 接线全部落地，`LAGOS_GAP_CHECK` 4 项 gap/partial → done；但 rate-5 无触发点（无评分 UI）、拼单不托管钱、打赏用 ¥ 不用 ✨、`totalEarned` 只汇总最新 20 条（见"没做成的事" §2/§3/§5/§7）。 |
| 12 | 重复 id `"gym"` | ✅ 彻底修好 | A: 三处改名 + 全仓 grep 核对；集成: S4 老存档迁移已接。i18n-en 拼写疑似错误未改（不在可改范围）。 |
| 13 | 青青世界蝴蝶 + 工厂食堂 | ⚠️ 只修一半 | 两条真丢的 talk 已接（蝴蝶只给青青世界、食堂已加）；3D 光柱点未加，两条 talk 目前只以按钮形式出现（见"没做成的事" §4）。 |

## 两个小注

- **`reportLandlord` 端点已删（死端点，S)**：全仓 grep 只有三处引用——服务端端点本身（`actions.ts:4521`，已删）、`client/src/round2/lifestyles.ts:557` 的 `reportLandlordIntent()`（只返回 `{ action: "reportLandlord", reason }` 的意向对象，全仓无调用点）、`lifestyles.ts:1141` 的 `LIFESTYLE_SERVER_SPEC` 表（文档性说明）。**App.tsx 从不调用**，(d) 举报流程走 `fileBlackReport`。删除无调用方。该端点本身还有个潜 bug：请求里有 `target: "landlord" | "employer"`，但 handler 写死 `kind: "landlord"`，employer 举报也会被当成房东——删掉比修掉干净。无表可删：它只复用 `fileBlackReportInner` 写 `black_reports`，没有自己的表。客户端的 `reportLandlordIntent` 和 spec 表条目是客户端文件，不在 S 的可改范围内，留给客户端接线 agent 清理（它们不产生服务端调用，留着无害）。
- **`courseDay` / `trialDay` 故意不调用（有据决定，S)**：审计第六节已说明是故意不调用的有据决定（lifestyles 的钱仍是客户端算），按任务要求没"修"。

## LOG 之间对不上的地方

行号差异主要来自"各 agent 写日志时的 App.tsx 行号" vs "集成后的 App.tsx 行号"（集成插入代码后行号后移），以及个别 agent 锚点本身的旧行号。按 LOG 原文照录，未擅自统一；以下列出核对时发现的出入：

1. **A 的渔港 handler 行号 vs 集成**：A 日志写 `seafood-feast` handler 在 `App.tsx:3050`、`mall-shop` 在 `:3160`；集成日志写 `:3126` / `:3236`。`case "port"` 锚点：A 写 `:4285-4301`，集成写 `:4406`。三处均为集成前/后行号漂移，未见语义冲突。
2. **A 的 sanitizeSave 行号 vs 集成**：A 写函数在 `App.tsx:1953-2057`，`visitedScenic` 约 `:2033`、`loc` 三元链 `:2048`；集成写 `:2133` / `:2164`。同为集成前后漂移。
3. **B 的行号 vs 集成**：B 写剧情 handler `App.tsx:7584`、`case "join-company"` `:3012-3022`、MiniGame 渲染点 `:7357`、startActivity `:3920`；集成写 `:7863` / `:3134` / `:7636`。同为集成前后漂移。B 的 buildplot 预览行号 `LifeStage.tsx:1970` vs 集成 `:2096`（`BUILDPLOT_COLORS`）——同为漂移。
4. **C 的行号 vs 集成**：C 写 App 家渲染 `App.tsx:7284`、社区面板 `App.tsx:4994` 附近、MapView 接线约 `:5846`；集成写 `:7563` / `:4960` / `:6126`。同为集成前后漂移。C 写 LifeStage actor 在 `:2590`、渲染在 actor 建好后；集成写渲染在 `:2724`——同为漂移。
5. **D 的行号 vs 集成**：D 明确指出任务给的 LifeKind 行号 `:477` 是旧的，实测 `type LifeKind` 在 `:572`、`LIFE_SCENES` 在 `:577`、`lifeStageFor` 在 `:708`、`CUTSCENE_ROAM` 在 `:1771`、`ANIM_TO_LIFE` 在 `:3326`、`VENUE_TALK.office` 在 `:81`；集成写 S1a `:580`、S1b `:577` 起、S2 `:800` 起、S3 `:3444`、S4 `:1886-1889`、S5 `:81-88` 之后。S1a/S2/S3/S4 的数字差是集成插入 S1b 文案等内容后的行号后移，未见语义冲突。
6. **E 的 snippet 锚点 vs 集成**：E 写赞助 `App.tsx:4694`、拼单 `:4693`、下单成功分支 `:1502-1508`；集成写 `:4824` / `:4836` 起。同为集成前后漂移。
7. **S 与 E 的 helpers 行号重叠**：S 写警察 helpers 在 `actions.ts:1192-1221`；E 写自己的内部函数在 `actions.ts:1192-1263`（"在 Actions 对象外、round-3 (S) 警察 helpers 之前"）。两份日志的行号区间重叠——E 的 helpers 插在 S 的 helpers 之前，插入后 S 的 helpers 行号应后移，但 S 的日志写于插入前。语义无冲突（两 agent 均声明未动对方代码），行号以各自日志写成时的实测为准。
8. **D 的 typecheck 9 错误 vs 集成基线 0 错误**：D 跑 typecheck 时报 9 个错误（7 个 MapView + 2 个 actions.ts 未使用声明），集成时基线已是 0 错误——时间差造成：C 在改完后清掉了一个未读 ref，D 的 9 个错误已被 C 清掉（集成日志 §九）。不是日志矛盾，是并行改动的时间顺序。
9. **`publishHome` "slot 0–6、最多 8 件"**：B 与集成均照抄此说法——7 个槽位（slot 0–6）与"最多 8 件"数字上不一致（7 ≠ 8），两份 LOG 均未解释。照录原文，未擅自改写；以 server 代码为准。
10. **E 的 `getWeeklyQuests` 周键**：E 日志写返回 `weekKey: "2026-W46"`；集成日志未复核该值。照录，未验证。
11. **S 的 0020 行数 vs E**：S 写 0020 新建 30 行；E 写文件从 30 行 → 76 行（追加 4 个 CREATE TABLE）。一致，无冲突。
12. **A 的 i18n-en 拼写**：A 指出 `"Honghuahu Lake Cycling"` 疑似拼写错误（应为 "Honghua Lake"），未改。集成未处理。照录。
