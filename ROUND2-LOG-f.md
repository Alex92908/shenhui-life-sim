# ROUND-2 LOG — area (f): 三和日结 + 失业躺平 (Sanhe + lying flat)

Date: 2026-11-11. Agent: area (f). Branch: `feature/round-2` (local copy only — nothing pushed).
Design authority: `~/workspace/goals/shenhui-life-sim-launch/files/round-2-lying-flat-design-2026-11-11.md` (read in full; implemented as written, not re-invented).

## Files created (only file touched)

- `client/src/round2/lifestyles.ts` (~1,150 lines, UI-free pure TypeScript module)
  - No other file edited. No `App.tsx` / `data.ts` / `LifeStage.tsx` / `MapView.tsx` / `server/` changes.
  - Imports only `sanhePay` from `../ads` and `CityKey, Loc` types from `../data` — no new dependencies, no cycles.

## What it implements (per the design doc's three pillars + Sanhe)

### Pillar 1 — Healing 治愈 (done)
- `SMALL_JOYS` (5): 海边看日出 (beach, 05:30–07:30), 公园长椅坐一会 (park), 喂流浪猫 (anywhere), 钓一条鱼 (water), 做一顿饭 (home). `doSmallJoy()` — first joy of the day raises the mood cap +1 (max +15, stored as `flat.moodCapBonus`) and hope +2; later joys same day still restore at half mood. Pet following (area (c) `petFollows` flag) adds +2 mood.
- `flatRestBonus()` — lying flat ("躺平摸鱼") stays a free restore; resting NEVER costs mood anywhere in this module. No "the more you lie flat the more you lose" loop.
- `ENCOURAGEMENT_LINES` + `encouragementFor(day)` — 街坊阿姨 / 好房东 / 便利店老板 / 公园大爷, encouragement only, rotating by day. No mocking language anywhere.
- Check-in event: `checkinDue()` fires once after ≥3 unemployed days; `doCheckin(accept)` — accept (+mood 10, +hope 8, a gig lead) or politely decline (+mood 4, +hope 2, no questions asked). Never a "falling behind" judgment.
- Pet companionship hook: `flat.petFollows` boolean, set by area (c) `pets.ts` when an adopted stray follows the player. This module only reads it.

### Pillar 2 — Survival 稳住 (done)
- Sanhe day-laborer playstyle (full loop, legitimate not a failure state):
  - `SANHE_SHIFTS` (6): 仓库分拣 1.0×, 工地搬砖 1.45×, 搬家帮工 1.2×, 发传单 0.6×, 渔港帮工 1.1×, 市集帮工 0.9× — multipliers on the existing `sanhePay(city)` base (SZ ¥220 / HZ ¥160 / HK ¥200). `takeSanheShift()` — one settled shift per day (same guard as existing `takeSanhe`), cash in hand same day, energy/hunger costs.
  - `SANHE_SLEEP` (4): 三和床位 ¥20, 网吧过夜 ¥30 (泡面 included), 长椅将就一晚 free (so there is never a no-place-to-sleep dead end), 回自己家睡. `sanheSleep()` fails only when unaffordable.
  - `SANHE_EATS` (3): 泡面 ¥5, 快餐 ¥12, 菜市便宜饭 ¥15.
  - `SANHE_MATES` (4): 老陈 / 阿强 / 菜市大姐 / 阿辉 with lines + tips; `chatMate()` builds bond 0–100; at bond ≥50 the mate hands over a short-term gig lead (`unlockListingId`).
  - `sanheRhythm()` — "做一天玩三天" status line from counted work/rest days.
- Rent pressure exits: `RENT_TALKS` (3) — 分期付房租 (rent due ×0.5), 缓几天交租 (+5 days), 拿兼职抵房租 (due ×0). `negotiateRent()` returns `rentDelayDays` / `rentDueMul` for App.tsx to apply to the Saturday rent run. Talking costs nothing and always helps a little.
- Black-landlord report: `reportLandlordIntent()` returns an intent object only — HANDOFF to area (d), which owns the report/jury flow.
- Second-hand / subletting floor values (area (e) may override): `sellSecondHand()` (旧手机 ¥300 / 旧家具 ¥150 / 旧自行车 ¥120 / 闲置衣服 ¥40), `subletBunk()` (¥150/week). `openStall()` — tiny street stall starter (¥100 setup, 4 kinds in `STALL_KINDS`), plugs into the existing `GameState.shop` when it grows.

### Pillar 3 — A way out 出路：就业服务中心 (done)
- Anchor: `isJobCenterPlace(loc)` — existing civic/service places only, NO new map: `placeKind === "info"` (游客/志愿服务中心) or name matching 服务中心/便民/街道/社区/政务/人社/就业. Police stations explicitly excluded (they belong to area (g) police).
- Tabs: `JOB_CENTER_TABS` — 找工作 / 就业指导 / 练面试 / 现实里也可以.
- (a) Job search: `JOB_LADDER` (14 listings, ladder-ordered 日结 → 短工 → 稳定工). Each lists pay/day (city-scaled), requirements, and a one-line path ("要什么、给多少、干多久能转正"). `listingsFor(profile)` returns all steps with availability + the missing piece named, so locked steps still show the path. `applyForJob()` — applying is free, never refused. Rung 2 short-term listings carry `daysToPermanent` (7/10/14). Stable listings map to existing `IDENTITIES` ids (`factory`, `courier`, `waiter`, `chef`, `guard`, `worker`) via `identityId`, returned as `hiredIdentityId`.
- (b) Skill training: `COURSES` (6, 3–6 days, free, ¥30/day living allowance) — 渔港帮工考证, 家常菜速成, 叉车入门, 电脑办公入门, 电商运营入门, 家政服务培训. `enrollCourse()` (one at a time, free), `courseDayTick()` (App.tsx calls once per game day; allowance paid per day, idempotent per day; completion grants skill + unlocks listings). Counselor: `COUNSELOR` (陈指导员), `suggestRoute(profile)` picks from 4 routes by what the player has actually done (fished → harbor; cooked → kitchen; hauled → logistics; default → steady-first), `bookGuidance()` records it. Routes are suggestions, never forced tasks.
- (c) Mock interviews: `INTERVIEW_QUESTIONS` (5 questions, 3 options each) + `mockInterview(picks)` — wrong answers cost NO mood, counselor gives a tip instead; readiness +8 + score×2 (0–100). Trial work: `startTrial()` (requires application + readiness), `trialWorkDay(score)` (pays that day's wage either way), `resolveTrial()` after 3 days — avg ≥60 → hired (`hiredIdentityId`, `markEmployed()`); below → leave with trial pay banked, NO black mark, application closed so the player can retry.

### Progress + display (done)
- `hope` ("重新出发" 0–100, only ever rises) + `HOPE_MILESTONES` (25 站稳了 / 50 有方向了 / 75 快出发了 / 100 重新出发 — "不是通关，是解锁下一级机会").
- `flatStatusLine()` — "第 X 天，有 Y 个机会在等你" (opportunities = available listings + courses + check-in + stall + pending applications). `lifestyleSummary()` for the panel header. `markUnemployed()` / `markEmployed()` (employment clears the clock but KEEPS hope + mood-cap bonus).
- State: `LifestyleState { flat, sanhe }` + `defaultLifestyleState()` + `sanitizeLifestyleState()` (defensive loader for saves without the field).

### Real-life help page 现实里也可以 (done — information only, not gameplay)
- `REAL_HELP` — verified public channels only, single source of truth for the numbers: **12333** (人社咨询 / 失业登记), **12356** (全国统一心理援助热线，免费；深圳 24 小时，外地拨 0755-12356), **120 / 110** emergencies. Subsidy directions with the "以官方为准" caveat on every line: 灵活就业社保补贴约每月 300 元、就业见习（16–24 岁登记失业青年）、失业保险金领取期间免费职业介绍和一期减免费职业培训、深圳"4050"约每月最高 600 元（需认定为就业困难人员）. Disclaimer: 具体条件和金额各地不同，查广东政务服务网或打 12333 确认.

### DON'Ts check (design doc)
- No mocking/shaming language, no countdown pressure, no death-by-starvation (bench is free, cheap eats from ¥5, one shift always available), no preaching — counselor suggests, player chooses; continuing to lie flat is allowed without punishment. Verified by grep: no 堕落/懒/失败/倒计时 language in the module.

## Per-feature status
| Feature | Status |
|---|---|
| Sanhe shift board + cash economy + stamina/hunger | done |
| Cheap sleep (bunk/cafe/bench/home) + cheap eats | done |
| Sanhe social (mates, bond, gig leads) + 做一天玩三天 rhythm | done |
| Healing: small joys + mood-cap growth + encouragement NPCs | done |
| Check-in event (accept / politely decline) | done |
| Pet companionship hook (reads area (c) flag) | done (hook only; pets.ts owns the pet) |
| Rent negotiation + black-landlord report intent | done (report adjudication → area (d)) |
| Second-hand sale + sublet floor values + street stall starter | done (full loop → area (e)) |
| Job service center: search + visible ladder | done |
| Counselor suggested routes + 3–6 day courses + allowance | done |
| Mock interviews (no mood penalty) + 3-day trial work | done |
| 重新出发 progress bar + "第 X 天，有 Y 个机会" display | done |
| Real-life help page (12333 / 12356 / 120/110) | done |
| Server endpoint specs for area (S) | done (see below) |

## Typecheck
- Command: `cd ~/workspace/shenhui-life-sim/standalone && npx tsc --noEmit -p tsconfig.json`
- Result (first run): 7 errors, **0 in `client/src/round2/lifestyles.ts`**. The 7 are in files owned by other concurrently-running areas: `LifeStage.tsx` (3, area g — unused imports + duplicate property), `data.ts:616` (1, area b — `"nature"` vs `VenueSetId`), `round2/house.ts` (3, area g — duplicate `wallColor`/`floorColor`/`walls`). They are NOT from this module and NOT mine to fix.
- Confirmation (second run): `npx tsc --noEmit -p tsconfig.json | grep -c lifestyles` → **0**. Zero errors in this module across both runs.
- Baseline note: the brief said baseline was GREEN at 32348ca; the errors above appeared while other areas were mid-edit. I did not run `npm run build` (per brief — integration agent owns the final build).

## App.tsx integration snippets (for the integration agent — DO NOT edit App.tsx here)

### S1. Import (App.tsx line ~13, beside the other round2 imports / near `import { listedRent, mapAds, sanhePay, sanheSay } from "./ads"`)
```ts
import {
  defaultLifestyleState, sanitizeLifestyleState, type LifestyleState, type PlayerProfile,
  SANHE_SHIFTS, SANHE_SLEEP, SANHE_EATS, SANHE_MATES,
  takeSanheShift, sanheSleep, sanheEat, chatMate, sanheRhythm,
  SMALL_JOYS, doSmallJoy, flatRestBonus, encouragementFor,
  checkinDue, doCheckin, RENT_TALKS, negotiateRent, reportLandlordIntent,
  SECONDHAND_FLOOR, sellSecondHand, subletBunk, openStall, STALL_KINDS,
  JOB_LADDER, JOB_CENTER_TABS, COUNSELOR, COURSES, INTERVIEW_QUESTIONS,
  listingsFor, applyForJob, bookGuidance, suggestRoute,
  enrollCourse, courseDayTick, mockInterview,
  startTrial, trialWorkDay, resolveTrial,
  markUnemployed, markEmployed, flatDays, flatStatusLine, lifestyleSummary,
  isJobCenterPlace, REAL_HELP, type LifeResult,
} from "./round2/lifestyles";
```

### S2. GameState field (App.tsx `interface GameState`, after `sanheDay?: number;` ~line 252)
```ts
/** round-2 (f): Sanhe + lying-flat lifestyle state (see round2/lifestyles.ts). */
life?: LifestyleState;
```

### S3. Save sanitize (App.tsx load function ~line 1574, after `sanheDay: ...`)
```ts
life: sanitizeLifestyleState(g.life),
```

### S4. New-game default (App.tsx new-game state ~line 3172, after `sanheDay: 0,`)
```ts
life: defaultLifestyleState(),
```

### S5. Mood clamp — respect the mood-cap bonus (wherever mood is clamped to 100 on load / after actions, e.g. `mood: clamp(num(g.mood, iden.mood), 0, 100)`)
```ts
// round-2 (f): mood cap grows with small joys (max +15). Replace the 100 cap with:
mood: clamp(num(g.mood, iden.mood), 0, 100 + (sanitizeLifestyleState(g.life).flat.moodCapBonus ?? 0)),
// and the same 100 + (s.life?.flat.moodCapBonus ?? 0) cap wherever mood is clamped after an action.
```

### S6. Profile builder (put near the other state helpers; App.tsx builds this from GameState at each call site)
```ts
const lifeProfile = (s: GameState): PlayerProfile => ({
  skill: s.skill, xp: s.xp,
  gigs: [...(s.npcGigs ?? []).map((g) => g.split(":").pop() ?? g), ...(s.arcs ? Object.keys(s.arcs) : [])],
  coursesDone: (s.life?.flat.courses ?? []).filter((c) => c.done).map((c) => c.id),
  interviewReady: s.life?.flat.interviewReady ?? 0,
  day: s.day, city: s.cityKey,
});
```

### S7. Apply a lifestyle action (generic handler — one place for all actions in this module; `res` is a `LifeResult`)
```ts
const applyLife = (res: LifeResult) => {
  if (!res.ok) { showToast(res.reason ? (en ? res.reason[1] : res.reason[0]) : ""); return; }
  setS((s0) => {
    const s = { ...s0, life: res.state };
    const d = res.delta;
    if (d.money) { s.money += d.money; if (d.money > 0) s.earned += d.money; s.maxMoney = Math.max(s.maxMoney, s.money); }
    if (d.energy) s.energy = clamp(s.energy + d.energy, 0, 100);
    if (d.mood) s.mood = clamp(s.mood + d.mood, 0, 100 + (res.state.flat.moodCapBonus ?? 0));
    if (d.hunger) s.hunger = clamp100(s.hunger + d.hunger);
    if (d.clean) s.clean = clamp100(s.clean + d.clean);
    if (d.social) s.social = clamp100(s.social + d.social);
    if (d.fun) s.fun = clamp100(s.fun + d.fun);
    if (d.xp) s.xp += d.xp;
    if (d.skill) s.skill += d.skill;
    if (d.network) s.network += d.network;
    if (d.fit) s.fit += d.fit;
    if (res.hiredIdentityId) { s.idenId = res.hiredIdentityId; /* also markEmployed() is already applied inside resolveTrial */ }
    return s;
  });
  res.lines.forEach((l) => showToast(en ? l[1] : l[0]));
  // res.rentDelayDays / res.rentDueMul (from negotiateRent): stash on a ref / state field the Saturday rent run reads.
  // res.unlockListingId / res.gigLeadId: highlight that listing in the job board (it is now unlocked/visible).
};
```

### S8. Where the panels appear
- **Sanhe board (shifts / sleep / eats / mates):** in the place panel where the existing `adHere.kind === "sanhe"` shift button lives (App.tsx ~5060–5070 mobile, ~5559–5571 PC). Keep the existing one-tap `takeSanhe` button; add a "📋 日结板" button opening a panel that lists `SANHE_SHIFTS` (call `takeSanheShift(s.life, id, s.day, s.cityKey, s.energy)`), plus `SANHE_SLEEP` / `SANHE_EATS` rows and `SANHE_MATES` chat buttons. Also add a "🛏️ 今晚住哪" row on the home panel using `sanheSleep`.
- **Small joys:** as action buttons on the matching place panels — `SMALL_JOYS` each carry an `at(loc)` predicate (beach / park / water / home; 喂流浪猫 has no predicate = anywhere). Call `doSmallJoy(s.life, id, s.day, loc, minutesNow)`. The existing "躺平摸鱼" rest action stays as-is; add `flatRestBonus(s.life)` to its delta (pet companion +2 mood).
- **Encouragement:** on day advance, if unemployed, show `encouragementFor(s.day)` as a street toast.
- **Check-in event:** on day advance, if `checkinDue(s.life, s.day)` show a modal with Accept / "谢谢，我自己慢慢来" → `doCheckin(s.life, accept, s.day)`.
- **Job service center:** a "🏢 就业服务中心" button in the place panel whenever `isJobCenterPlace(loc)` is true (anchor: 游客/志愿服务中心 and any 服务中心/便民/街道/社区/政务/人社/就业 place), PLUS a phone entry (job board on the phone) so it is reachable without walking there. Four tabs from `JOB_CENTER_TABS`: 找工作 (`listingsFor(lifeProfile(s))` — locked steps show their missing piece; player-issued gigs from the server's `listJobBoard` append below the ladder; apply → `applyForJob`; short-term listings with `daysToPermanent` show the trial path), 就业指导 (`COUNSELOR.greeting`, `bookGuidance` → `suggestRoute` steps, `COURSES` list → `enrollCourse`, active course progress), 练面试 (3 questions drawn from `INTERVIEW_QUESTIONS` → `mockInterview(picks)`; trial section: `startTrial` → per-day `trialWorkDay(score)` → `resolveTrial()`), 现实里也可以 (`REAL_HELP` — render `sections` with `tel` big and tappable; both numbers must render exactly: 12333, 12356).
- **Day advance (once per game day, in the existing day-advance handler):**
  ```ts
  // round-2 (f): course allowance + Sanhe rest-day counting + unemployment clock
  if (s.life?.flat.courses.some((c) => !c.done)) applyLife(courseDayTick(s.life, s.day));
  setS((s0) => { const life = { ...s0.life!, sanhe: { ...s0.life!.sanhe, restDays: s0.life!.sanhe.shiftDay === s0.day ? s0.life!.sanhe.restDays : s0.life!.sanhe.restDays + 1 } }; return { ...s0, life }; });
  // unemployment entry point: when the player loses/quits a job (wherever that happens), call markUnemployed(life, day) once.
  ```
- **Rent run (Saturday):** read the stashed `rentDelayDays` / `rentDueMul` from the last `negotiateRent` (S7) before computing rent due.

### S9. Acceptance-criteria mapping (for the browser-test plan)
1. Become unemployed (`markUnemployed`), open the job service center, walk through all three functions + the help tab.
2. Run daily-pay → short-term → stable once (apply → trial → hired) and watch `hope` ("重新出发") rise.
3. Lie flat 3 days: mood must NOT collapse (no decay exists in this module) + the check-in event fires once.
4. Help page shows 12333 and 12356 with no typos.

## Server endpoint specs for area (S)
Full spec table lives in the module as `LIFESTYLE_SERVER_SPEC` (18 endpoints, `defineAction` camelCase style, matching `server/src/actions.ts`). Summary:

| Endpoint | Purpose |
|---|---|
| `getLifestyle` / `saveLifestyle` | Persist `LifestyleState` JSON on the player; server clamps hope 0–100, moodCapBonus 0–15 |
| `listJobBoard` | Ladder (server copy) + player-issued gigs (`getGigs` rows) merged into one board |
| `applyJob` | Record application (anti-cheat: no trial without an application) |
| `bookGuidance` | Log counselor session; route is a suggestion, never a quest |
| `enrollCourse` / `courseDay` | Course enrollment; daily allowance paid server-side, idempotent per (player, course, day) |
| `mockInterview` | Store readiness (0–100, clamped); no penalty path exists |
| `startTrial` / `trialDay` / `resolveTrial` | Trial lifecycle; pay computed server-side; hired iff avg ≥ 60 after 3 days; failed trial records NO black mark |
| `postFlatGig` / `listFlatGigs` / `takeFlatGig` | Community help board (shared with area (c) — one board, not two); completing adds hope +5, helped +1 |
| `openStall` | Register the tiny stall so other players can see it (growth → area (e) shop system) |
| `reportLandlord` | File black-landlord report — HANDOFF to area (d); adjudication stays in (d)'s report/jury flow |
| `sanheShiftLog` | Server log of settled shifts; guards one-shift-per-day + pay = `sanhePay(city)` × shift `payMul` |

Money/level stay client-calculated until server-authoritative accounting lands (repo `BUSINESS-PLAN.md` warning) — no endpoint here moves real money.

## Blocked / open questions
- None for this module. Two handoffs (not blockers): area (d) owns black-landlord adjudication (`reportLandlord` endpoint + `reportLandlordIntent` routing); area (c) owns the pet system (`flat.petFollows` is read here, set there); area (e) owns the full second-hand/sublet/shop loops (floor values here are overridable).
- The 7 typecheck errors in `LifeStage.tsx` / `data.ts` / `round2/house.ts` belong to areas (g) and (b), who are editing those files concurrently; they are not regressions from this module.
