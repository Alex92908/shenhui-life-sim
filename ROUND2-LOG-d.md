# ROUND-2 LOG — area (d): 举报/曝光黑房东 & 黑公司

Agent: area (d) · Date: 2026-11-11 · Branch: `feature/round-2` (local only, never pushed)
Module: `client/src/round2/report.ts` (NEW, 31 KB, pure TypeScript, no React, no server imports)

## Files created / touched

- CREATED: `client/src/round2/report.ts` — the whole feature. Nothing else touched.
- NOT touched (per ownership): `App.tsx`, `data.ts`, `events.ts`, `LifeStage.tsx`, `MapView.tsx`, `server/`, `ROUND2-CHANGELOG.md`.
- Integration snippets for App.tsx (+ one for events.ts) are in §5 below — the integration agent applies them.

## What was built (per-feature status)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Report a bad landlord (free text + evidence) | ✅ done | `ReportDraft`, `validateDraft` (10–600 chars), `buildRentEvidence` auto-attaches baseRent → currentRent, rentPaid, deposit, and the in-game rent-rise notice text. Suggested charges (违规涨租 / 扣押金 / 断水断电 / 房子不安全 / 威胁赶人) are prefill chips only — never a required category. |
| 2 | Report a bad employer (free text + evidence) | ✅ done | Same flow. `buildWageEvidence` attaches companyId, workCount, otCount, otPayPerShift, claimed unpaid. Suggested charges: 加班不给钱 / 拖欠工资 / 工作不安全 / 招聘造假. Target is a `COMPANIES` id from data.ts — a game entity, never a real person. Player-vs-player harassment stays with existing `reportPlayer` + block. |
| 3 | Community jury (same-city, 24 h, one vote, changeable) | ✅ done (client) | `decideJury` reuses the `settleGigs` shape: quorum `MIN_JURY_VOTES = 3`, majority upholds, tie / no-quorum = "expired" (not proven — no penalty either side). Parties can't vote; server enforces same-city + account (same as `juryVote`). Jury UI text via `jurySummary`. |
| 4 | Verdict consequences — landlord | ✅ done | `applyLandlordVerdict(state, remedy)`: rent rolls back to pre-rise level (`rent` + `baseRent`), deposit + overcharged rent refunded to `money`/`earned`, landlord fine → community fund, mood +8. Operates on a minimal `ReportGameState` interface — App.tsx passes its `s` straight in. |
| 5 | Verdict consequences — employer | ✅ done | `applyEmployerVerdict(state, remedy)`: back pay to `money`/`earned`, listing flagged for all players, hiring suspended until cleared, fine → community fund, mood +8 / energy +5. The player is never fired for reporting. |
| 6 | Reputation + public exposure | ✅ done | `Reputation` 0–100 (starts 80), −20 per upheld report, +5 per rejected (vindication), +3/week clean recovery — nobody is branded forever. `reputationWarning()` returns the banner shown BEFORE renting / taking a job (caution <70, warning <50, blacklist <30, with flag note). `exposureLine()` is the public board / NPC-news line for an upheld report. |
| 7 | Anti-griefing / fairness | ✅ done | Filing is FREE (a fee would gate the poorest players — the landlord's victims). Cost of a false report is credibility: `ReporterStanding` starts 100, −25 per rejected report, +5 per upheld, filing locks below 50 (7-day lockout on second strike), max 3 open reports, 1 filing per kind per game day. Filing alone does NOTHING to the accused — consequences only after a jury upholds. |
| 8 | Local fallback store | ✅ done | `ReportBook` (localStorage `shenhui-report-book-v1`): optimistic filing echoes, standing, cooldown days, cached reputations. Works offline / before area S lands the endpoints; server is source of truth once they exist. |
| 9 | Server transport interface | ✅ done | `ReportTransport` + `asReportTransport(api)` cast helper (see §6). Calls will fail at the network layer until area S lands the four actions — by design, never a crash. |
| 10 | Server endpoints | ⏳ BLOCKED on area S | Spec in §6 below. Client is ready; no server code was touched (forbidden). |

## Design notes

- Additive + open-ended: systems, not scripted paths. No fixed report categories — free text is the report; evidence is an auto-attached receipt the player can edit around.
- Reuses existing patterns, no parallel system: `reportPlayer` (player-issued reports), `juryVote`/`settleGigs` (24 h city jury, one changeable vote, parties excluded, majority decides), `committeeState` (same-city, one-account-one-vote), `sendFeedback` (8/day cap + cleanText free-text pattern). The committee chair's rent pledge and this module's reputation warnings point at the same public trust.
- Existing hooks this plugs into: events.ts "房东来了" rent-rise event (add a 举报 choice — snippet 5c), App.tsx housing panel `askRent` / "买套自己的房" section (~L4598, ~L5065, ~L5243–5245), job panel "现在在：" line (~L4054, `companyById(s.employer)`), gig jury UI in Social.tsx (~L199–221, the `juryVote` call pattern to copy for `blackReportVote`).

## Typecheck

- `cd standalone && npx tsc --noEmit -p tsconfig.json` — **0 errors in `report.ts`** (verified in two runs).
- Both runs showed errors ONLY in other agents' concurrently-edited files (run 1: `MapView.tsx:969` `lakeWaterMat` unused — gone by run 2; run 2: `round2/delivery.ts:378,381,794` and `round2/economy.ts:473`). None are mine; I did not touch those files. The tree is red right now because sibling agents are mid-edit, not because of this module.
- `npm run build` NOT run (per task: concurrent vite builds conflict; integration agent does the final build).

---

## §5 — App.tsx integration snippets (integration agent applies these)

Assumed imports at the top of App.tsx (add once, near the other `round2` imports):

```tsx
import {
  asReportTransport, buildRentEvidence, buildWageEvidence, canFile,
  reputationWarning, applyLandlordVerdict, applyEmployerVerdict,
  applyFalseReportPenalty, applyTrueReportGain, exposureLine,
  type ReportDraft, type ReportKind, type BlackReport,
} from "./round2/report";
import { ReportBook } from "./round2/report";
```

Assumed local state (add next to the other `useState` / query hooks, ~L1192–1220 near `committeeState` / `getGigs` queries):

```tsx
const reportBook = useMemo(() => new ReportBook(), []);
const reportApi = useMemo(() => asReportTransport(api), []);
const [reportDraft, setReportDraft] = useState<ReportDraft | null>(null); // null = composer closed
const reportsQuery = useQuery({
  queryKey: ["blackReports", gs?.cityKey],
  enabled: !!profile && !!gs,
  queryFn: () => reportApi.getBlackReports({ playerId: profile!.playerId, city: gs?.cityKey ?? "sz" }),
});
```

### 5a — Housing panel: "🚨 举报房东" button

Insert directly after the "买套自己的房" paragraph, App.tsx ~L5244 (the `<p>` ending "从此不看房东脸色。") — i.e. inside the housing section, next to the deposit button:

```tsx
{!s.ownFlat && (
  <button
    type="button"
    onClick={() => {
      const rep = reportBook.reputationFor(`home:${s.cityKey}`);
      void rep; // warning (if any) is rendered just below; see 5d
      setReportDraft({
        kind: "landlord",
        city: s.cityKey,
        targetId: `home:${s.cityKey}`,
        targetName: en ? `Landlord (${CITIES[s.cityKey].name})` : `${CITIES[s.cityKey].name}房东`,
        body: "",
        evidence: buildRentEvidence({ baseRent: s.baseRent, rent: s.rent, rentPaid: s.rentPaid }),
      });
    }}
    className="mt-2 w-full rounded-full border border-[var(--line)] py-2 text-xs font-black"
  >
    {en ? "🚨 Report this landlord" : "🚨 举报房东"}
  </button>
)}
```

Also surface it from the rent-ask flow: in `askRent` (~L4598) the toast already shows the listed rent — append a hint when the player is being overcharged (`s.rent > s.baseRent`): `showToast(... + (s.rent > s.baseRent ? " 觉得涨得不合理？点住房栏的 🚨 举报房东。" : ""))`. Keep it a hint only; do not change the rent logic.

### 5b — Job panel: "🚨 举报公司" button

Insert directly under the "现在在：" line, App.tsx ~L4054 (the `<p className="text-sm">现在在：<b>{cur ? ...}` line — `cur` is `companyById(s.employer)`):

```tsx
{(s.employer ?? "startup") !== "startup" && (
  <button
    type="button"
    onClick={() => {
      const co = companyById(s.employer);
      const base = Math.round(s.pay * (co?.payMul ?? 1));
      setReportDraft({
        kind: "employer",
        city: s.cityKey,
        targetId: co.id,
        targetName: co.name,
        body: "",
        evidence: buildWageEvidence({
          companyId: co.id,
          companyName: co.name,
          workCount: s.workCount,
          otCount: s.otCount,
          otPayPerShift: Math.round(base * (co.otMul ?? 1) * 0.6),
        }),
      });
    }}
    className="mt-1 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-black"
  >
    {en ? "🚨 Report this employer" : "🚨 举报这家公司"}
  </button>
)}
```

Note: `s.pay` is the player's day pay and `otMul` the company's overtime multiplier (data.ts `Company`); the `0.6` factor matches the overtime pay in events.ts "老板画饼" (`S.pay * S.payMul * 0.6`). If the integration agent finds a canonical overtime-pay helper, use it instead.

### 5c — Landlord event dialog: third choice on "房东来了" (events.ts)

events.ts is NOT owned by area (d); the integration agent applies this. In `EVENTS`, the "房东来了" event (~L32–36) gains a third choice. `EventChoice.apply` returns a string and cannot open UI, so add an optional marker field to the choice type and handle it in App.tsx's event dialog:

```ts
// events.ts — add to the "房东来了" choices array (after the "硬刚" choice):
{ t: "📢 举报房东", s: "涨租不合理？交给同城陪审团评理", report: "landlord" as const, apply: (S) => "你记下了房东的话，打开了举报——证据已经附上：现在的房租、之前说好的房租、交过的押金。" },
```

```ts
// events.ts — EventChoice type (near the top, next to `t` / `s` / `apply`):
report?: "landlord" | "employer";
```

```tsx
// App.tsx — in the event-dialog choice button onClick (where choices are rendered;
// the existing handler calls choice.apply(s) and shows the returned string):
onClick={() => {
  if (choice.report === "landlord") {
    setReportDraft({
      kind: "landlord", city: s.cityKey,
      targetId: `home:${s.cityKey}`,
      targetName: en ? `Landlord (${CITIES[s.cityKey].name})` : `${CITIES[s.cityKey].name}房东`,
      body: "",
      evidence: buildRentEvidence({
        baseRent: s.baseRent, rent: s.rent, rentPaid: s.rentPaid,
        noticeText: "房东阿姨敲门：下月可能涨租",
      }),
    });
  }
  // ...then run the existing apply()/toast flow as today
}}
```

If adding a field to `EventChoice` is judged too invasive, the fallback is: the third choice's `apply` returns a string telling the player to use the housing-panel button (5a) — no new field, no dialog change.

### 5d — Reputation warning banners (before renting / taking a job)

Render wherever the player is about to commit — reuse the existing reputation data from `reportsQuery`:

```tsx
{/* housing section, above the 5a button: */}
{(() => { const w = reputationWarning(reportBook.reputationFor(`home:${s.cityKey}`), en); return w ? <p className="mt-2 rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-[11px] leading-relaxed">{w}</p> : null; })()}

{/* job panel, under the 5b button: */}
{(() => { const w = reputationWarning(reportBook.reputationFor(s.employer ?? "startup"), en); return w ? <p className="mt-1 rounded-[10px] bg-[var(--surface2)] px-3 py-2 text-[11px] leading-relaxed">{w}</p> : null; })()}
```

And when `reportsQuery` returns, merge it into the book (place next to the `gigsQuery` refetch handling, ~L1218):

```tsx
useEffect(() => {
  if (!reportsQuery.data) return;
  reportBook.mergeReports([...reportsQuery.data.mine, ...reportsQuery.data.jury, ...reportsQuery.data.exposed]);
  for (const r of reportsQuery.data.reputations) reportBook.noteReputation(r);
}, [reportsQuery.data]); // eslint-disable-line react-hooks/exhaustive-deps
```

### 5e — Report composer modal + filing (new UI, reuse existing modal patterns)

Render once, near the other modals (e.g. next to the gig/committee panels). Draft state is `reportDraft` from above; `SUGGESTED_CHARGES` chips prefill the textarea; `validateDraft` gates submit; `canFile` gates the button:

```tsx
{reportDraft && (
  <div className="modal">
    <h3>{reportDraft.kind === "landlord" ? (en ? "🚨 Report a bad landlord" : "🚨 举报黑房东") : (en ? "🚨 Report a bad employer" : "🚨 举报黑公司")}</h3>
    <p className="text-xs text-[var(--dim)]">{en ? "Write what happened in your own words. Rent / wage records are attached automatically. A city jury decides within 24 hours — filing alone changes nothing." : "用自己的话写清楚发生了什么。房租/工资记录会自动附上。同城陪审团 24 小时内裁决——只举报不产生任何后果。"}</p>
    <div className="flex flex-wrap gap-1.5">
      {SUGGESTED_CHARGES[reportDraft.kind].map((c) => (
        <button key={c.key} type="button" onClick={() => setReportDraft({ ...reportDraft, body: reportDraft.body ? `${reportDraft.body} ${c.hint}` : c.hint })} className="chip">{c.label}</button>
      ))}
    </div>
    <textarea value={reportDraft.body} onChange={(e) => setReportDraft({ ...reportDraft, body: e.target.value.slice(0, 600) })} rows={4} placeholder={en ? "What happened, when, how much…" : "发生了什么、什么时候、多少钱……"} />
    <p className="text-[11px] text-[var(--dim)]">{reportDraft.body.length}/600</p>
    <button
      type="button"
      disabled={!!validateDraft(reportDraft) || !canFile(reportBook.state, reportDraft.kind, s.day).ok}
      onClick={async () => {
        const err = validateDraft(reportDraft);
        const gate = canFile(reportBook.state, reportDraft.kind, s.day);
        if (err) { showToast(err); return; }
        if (!gate.ok) { showToast(gate.reason); return; }
        try {
          const r = await reportApi.fileBlackReport({ playerId: profile!.playerId, ...reportDraft });
          if (!r.ok) { showToast(r.error ?? (en ? "Couldn't file the report." : "举报没发出去。")); return; }
          reportBook.noteFiled(reportDraft, s.day, r.reportId);
          setReportDraft(null);
          showToast(en ? "Report filed — the city jury has 24 hours." : "举报已提交，同城陪审团 24 小时内裁决。");
          void reportsQuery.refetch();
        } catch { showToast(en ? "Network hiccup — saved locally, try again." : "网络不太好，本地已记下，稍后再试。"); }
      }}
    >{en ? "File the report" : "提交举报"}</button>
    <button type="button" onClick={() => setReportDraft(null)}>{en ? "Cancel" : "取消"}</button>
  </div>
)}
```

### 5f — Jury panel + claiming a verdict (copy the gig jury UI in Social.tsx ~L199–221)

Add a "📢 曝光栏" section to the same Social panel that renders gigs (it already has `juryVote` + `claimGigMoney` call patterns to copy). For each `reportsQuery.data.jury` report, show body + evidence summary + `jurySummary(r.votes, en)` + two vote buttons; for each `mine` report with `status !== "open"`, show a claim button:

```tsx
{/* jury vote — mirrors Social.tsx juryVote call: */}
const voteBlack = async (report: BlackReport, side: "uphold" | "reject") => {
  try {
    const r = await reportApi.blackReportVote({ playerId: profile!.playerId, reportId: report.id, side });
    if (r.ok) { showToast(en ? "Voted — the majority decides when it closes." : "投票了，结案后按多数执行。"); void reportsQuery.refetch(); }
    else showToast(r.error ?? "");
  } catch { showToast(en ? "Network hiccup" : "网络不太好"); }
};

{/* claim — mirrors the claimGigMoney handling at App.tsx ~L1218: */}
const claimBlack = async (report: BlackReport) => {
  try {
    const r = await reportApi.claimBlackReport({ playerId: profile!.playerId, reportId: report.id });
    if (!r.ok) { showToast(r.error ?? ""); return; }
    if (report.status === "upheld" && r.remedy) {
      const lines = report.kind === "landlord"
        ? applyLandlordVerdict(s, r.remedy as LandlordRemedy, en)
        : applyEmployerVerdict(s, r.remedy as EmployerRemedy, en);
      // NOTE: apply*Verdict already adds remedy money to a passed-in state object;
      // App.tsx must apply it via mutate() — see the mutate-wrapped version below.
      for (const l of [...lines, ...r.lines]) addLog(l);
      reportBook.state.standing = applyTrueReportGain(reportBook.state.standing);
      addLog(exposureLine(report, en));
    } else if (report.status === "rejected") {
      const p = applyFalseReportPenalty(reportBook.state.standing, en);
      reportBook.state.standing = p.standing;
      for (const l of p.lines) addLog(l);
    }
    reportBook.save();
    void reportsQuery.refetch();
  } catch { showToast(en ? "Network hiccup" : "网络不太好"); }
};
```

Important correction to the snippet above: `applyLandlordVerdict` / `applyEmployerVerdict` mutate the object passed in, but App.tsx state only persists through `mutate()`. Wrap the money/state changes in `mutate` — the verdict functions take the plain state object, so call them inside `mutate` and collect lines outside:

```tsx
// inside claimBlack, replacing the direct apply*Verdict call above:
const lines: string[] = [];
mutate((x) => {
  if (!r.remedy) return;
  const ls = report.kind === "landlord"
    ? applyLandlordVerdict(x, r.remedy as LandlordRemedy, en)
    : applyEmployerVerdict(x, r.remedy as EmployerRemedy, en);
  lines.push(...ls);
});
// r.money is already included in the remedy application (deposit/back pay added
// to x.money inside apply*Verdict), so do NOT add r.money again here.
for (const l of [...lines, ...r.lines]) addLog(l);
```

`LandlordRemedy` / `EmployerRemedy` types: import them from `./round2/report` alongside the other imports in the header snippet.

---

## §6 — Server endpoint spec for area S (server/src/actions.ts + schema.ts + migration)

Four new actions, following the existing conventions exactly: `defineAction` + zod request/response, `playerId` string (min 4 max 64), `cleanText` on free text, `socialNeedsAccount()` gate for votes (same as `juryVote`/`voteCommittee` — one account, one vote), banned/muted checks (`BANNED_MSG` / `MUTED_MSG`), same-city rule, `creditMoney(db, …)` for payouts. New tables: `black_reports`, `black_report_votes`, `black_reputations` (or fold reputation into a computed view — see note under `getBlackReports`).

### Tables (new migration, Drizzle — mirror `gigs`/`gigVotes`/`reports` shapes)

```ts
export const blackReports = sqliteTable("black_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  city: text("city").notNull(),                    // "sz" | "hz" | "hk"
  kind: text("kind").notNull(),                    // "landlord" | "employer"
  reporterId: text("reporter_id").notNull(),       // players.id
  targetId: text("target_id").notNull(),           // `home:<city>` for landlords, COMPANIES id for employers
  targetName: text("target_name").notNull(),
  body: text("body").notNull(),                    // cleanText, 10–600 chars
  evidence: text("evidence"),                      // JSON: RentEvidence | WageEvidence
  status: text("status").notNull().default("open"),// "open" | "upheld" | "rejected" | "expired"
  verdictNote: text("verdict_note"),
  dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(), // createdAt + 24h
  reporterClaimed: integer("reporter_claimed").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
export const blackReportVotes = sqliteTable("black_report_votes", {
  reportId: integer("report_id").notNull(),
  voterId: text("voter_id").notNull(),
  side: text("side").notNull(),                    // "uphold" | "reject"
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (t) => [primaryKey({ columns: [t.reportId, t.voterId] })]);
export const blackReputations = sqliteTable("black_reputations", {
  targetId: text("target_id").notNull(),
  kind: text("kind").notNull(),
  targetName: text("target_name").notNull(),
  score: integer("score").notNull().default(80),
  upheldCount: integer("upheld_count").notNull().default(0),
  rejectedCount: integer("rejected_count").notNull().default(0),
  flaggedUntil: integer("flagged_until", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (t) => [primaryKey({ columns: [t.targetId, t.kind] })]);
```

Also needed: per-player credibility — add columns to `players` or a small table `reporter_standing (player_id PK, credibility int default 100, filed_count, upheld_count, rejected_count, locked_until)`. Prefer the small table; don't widen `players` in a shared migration without the coordinator's OK.

### 1. `fileBlackReport`

- Request: `{ playerId: string(4–64), kind: "landlord" | "employer", city: "sz" | "hz" | "hk", targetId: string(1–64), targetName: string(1–40), body: string(trim, 10–600), evidence?: object }`
- Response: `{ ok: boolean, error?: string, reportId?: number, dueAt?: string }`
- Handler: reject banned/muted; enforce max 3 open reports per player, 1 filing per kind per 24 h, credibility ≥ 50 and no active lockout (return the same Chinese error strings as `canFile` in report.ts so client and server agree); `cleanText(body)`; `targetId` must match `home:<city>` for landlords or a known `COMPANIES` id for employers (validate against the server's copy of the company list — never trust a free-form id for the employer path); insert with `dueAt = now + 24h`; bump `filed_count`. Free — no money moves.

### 2. `getBlackReports`

- Request: `{ playerId: string(4–64), city: "sz" | "hz" | "hk" }`
- Response: `{ mine: BlackReport[], jury: BlackReport[], exposed: BlackReport[], reputations: Reputation[] }` — shapes exactly as in `client/src/round2/report.ts` (`BlackReport`, `Reputation` interfaces; `myVote` per report for the caller; `votes: { uphold, reject }` counts).
- Handler: call a `settleBlackReports(db)` first (same pattern as `settleGigs` — see §6.5); `mine` = caller's reports (latest 20); `jury` = open reports in the caller's city where the caller is neither the reporter nor the target, latest 20, with the caller's vote attached; `exposed` = upheld reports in the city, latest 20 (the public board); `reputations` = all `black_reputations` rows for the city (or all rows with score < 70 plus any the caller has interacted with — keep it small, ≤ 50 rows).

### 3. `blackReportVote`

- Request: `{ playerId: string(4–64), reportId: number(int, positive), side: "uphold" | "reject" }`
- Response: `{ ok: boolean, error?: string }`
- Handler: mirror `juryVote` exactly — report must be `open`; reporter can't vote on their own report; same-city only; `socialNeedsAccount()` gate; upsert into `black_report_votes` (changeable until close). No money moves.

### 4. `claimBlackReport`

- Request: `{ playerId: string(4–64), reportId: number(int, positive) }`
- Response: `{ ok: boolean, error?: string, money: number, remedy?: LandlordRemedy | EmployerRemedy, lines: string[] }` — shapes exactly as in `report.ts` (`LandlordRemedy`, `EmployerRemedy`).
- Handler: only the reporter, only once (`reporterClaimed` guard with the same compare-and-set pattern as `claimGigMoney`); report must be closed (`upheld` / `rejected` / `expired`). If `expired`: `{ ok: true, money: 0, lines: ["陪审团没凑够票，这份举报按“无法证实”结案，没有惩罚，证据更足了可以再报一次。"] }`, no standing change. If `rejected`: no money; credibility −25 (lock 7 days if it drops below 50 — mirror `applyFalseReportPenalty`); return its lines. If `upheld`: compute the remedy from the stored evidence — landlord: `rentRolledBackTo = evidence.baseRent`, `depositReturned = evidence.depositPaid ?? 0`, `overchargeRefunded = max(0, evidence.currentRent - evidence.baseRent)` (one week of overcharge; the rent rollback itself is applied client-side by `applyLandlordVerdict` and must ALSO be persisted server-side on the player's run — see note below), `fine = 200`; employer: `backPay = evidence.claimedUnpaid ?? evidence.otCount * evidence.otPayPerShift` capped at ¥2,000, `listingFlagged = true`, `hiringSuspended = upheldCount for this target ≥ 2`, `fine = 500`. Credit `money = depositReturned + overchargeRefunded` (landlord) or `backPay` (employer) via `creditMoney(db, reporterId, money, "black report #id")`; update the target's `black_reputations` row (−20 score, +1 upheld, `flaggedUntil = now + 7d`); reporter credibility +5. Return `remedy` + `lines` (Chinese, one per effect — the client shows them via `addLog`).
- ⚠️ Server-side rent rollback: the client's `applyLandlordVerdict` sets `s.rent`/`s.baseRent` locally, but the authoritative run state lives in the player's save. Area S should ALSO apply the rollback to the stored run (same fields the Saturday rent job reads — `rent`/`baseRent` on the player row/save) when the claim is processed, or the next save/load will resurrect the raised rent. If the run state is client-owned and only synced opaquely, note it here and the integration agent must make `claimBlackReport`'s success the trigger for the `mutate()` in §5f (already the case) — flag it explicitly in the area-S handoff rather than silently dropping the rollback.

### 5. `settleBlackReports(db)` (helper, not an action — mirror `settleGigs`)

Called at the top of `getBlackReports`, `blackReportVote`, `claimBlackReport`. For every `open` report with `dueAt <= now`: count votes; `total < 3` → `expired`; `uphold > reject` → `upheld`; `reject > uphold` → `rejected`; tie → `expired`. Write `status` (+ `verdictNote` e.g. `"陪审团 5–2 判属实"`). Do NOT move money or reputation here — money/reputation move only in `claimBlackReport` (single-claim guard), exactly like gig pay moves only in `claimGigMoney`. One subtlety: reputation should reflect upheld reports even if the reporter never claims — so update `black_reputations` in `settleBlackReports` when a report flips to `upheld`/`rejected` (idempotent: only when the status actually changes), and let `claimBlackReport` handle money + reporter standing only.

### Existing actions this reuses (do not duplicate)

- `reportPlayer` — player-vs-player harassment; black reports are for game entities, different table, different flow.
- `juryVote` / `settleGigs` — the jury pattern to copy (see §6.3, §6.5).
- `committeeState` — same-city + account gates; the committee chair's rent pledge and black-report reputations are complementary, not overlapping.
- `sendFeedback` — free-text + `cleanText` + daily cap pattern for the body field.
- `claimGigMoney` — the single-claim compare-and-set pattern for `claimBlackReport`.
- `creditMoney` — all payouts go through it (append-only ledger); never hand-edit a balance.
