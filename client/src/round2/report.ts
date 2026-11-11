/**
 * report.ts — area (d): 举报 / 曝光黑房东 & 黑公司 (round-2, feature/round-2)
 *
 * The problem: the game already has landlord rent-rise events (events.ts
 * "房东来了" — knock, flatter, or threaten to move) and overtime as a theme,
 * but there is NO way to fight back through the rules. A landlord can raise
 * the rent, keep your deposit, cut water/power, or threaten eviction, and a
 * company can withhold overtime pay or post a fake job ad, and the player
 * can only shrug. This module adds the missing loop:
 *
 *     举报 (file, free text + evidence) → 同城陪审团 (jury votes, 24h)
 *       → 裁决 (verdict) → 后果 (consequences) → 曝光 (public warning)
 *
 * It deliberately REUSES the patterns the server already has instead of
 * inventing a parallel system:
 *   - reportPlayer (actions.ts:1167) — player-issued reports, moderator review
 *   - juryVote (actions.ts:1451) + settleGigs (actions.ts:463) — a disputed
 *     gig goes to a 24h city jury, one vote per player, changeable, parties
 *     can't vote, majority decides when it closes, tie goes to the accused
 *     side. Black reports follow the same shape, with the burden of proof on
 *     the reporter (a tie / no quorum = "not proven", NOT a punishment).
 *   - committeeState / runForCommittee / voteCommittee — the same
 *     one-account-one-vote, same-city rule; the elected committee chair's
 *     pledge (e.g. rent -5%) already touches housing, and upheld reports
 *     feed the same public reputation the committee is supposed to protect.
 *   - sendFeedback (actions.ts:1196) — the 8-a-day cap + cleanText pattern
 *     for free-text input is reused for report bodies.
 *
 * Fairness / anti-griefing (the tone matters — this is a game about real
 * life, not a weapon):
 *   - Reports are FREE-TEXT and open-ended. The "charges" below are only
 *     suggestion chips that prefill the text box — never a required enum.
 *     A player can report anything, in their own words.
 *   - A report only has consequences AFTER a jury upholds it. Filing alone
 *     does nothing to the accused — no instant fine, no public shaming.
 *   - False reports cost the reporter: credibility drops, and repeated
 *     rejected reports lock filing for a while. Spamming reports is a
 *     losing strategy by design.
 *   - The accused is a GAME entity (an NPC landlord / a company id from
 *     data.ts COMPANIES), never a real person's identity. Player-vs-player
 *     harassment stays with reportPlayer + blockPlayer.
 *   - A report that expires without a quorum is "not proven": no penalty
 *     for either side, and the reporter may refile once with more evidence.
 *
 * This file is CLIENT-ONLY and pure TypeScript (no React, no server imports):
 * types, validation, evidence builders, reputation math, verdict application
 * onto a minimal game-state shape, a local fallback store (so the UI works
 * offline / before area S lands the endpoints), and the transport interface
 * the server agent (area S) must implement. App.tsx integration snippets
 * live in ROUND2-LOG-d.md — this file must never be imported by server code.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReportCity = "sz" | "hz" | "hk";

/** What is being reported. Landlords and employers share one flow. */
export type ReportKind = "landlord" | "employer";

/** Lifecycle of a black report. "expired" = jury never reached quorum. */
export type ReportStatus = "open" | "upheld" | "rejected" | "expired";

/** A jury member's vote. "uphold" = the report is true, punish the accused. */
export type ReportVoteSide = "uphold" | "reject";

/** Suggestion chips only — they prefill the free-text box, never constrain it. */
export interface SuggestedCharge {
  key: string;
  label: string;
  hint: string;
}

/** Structured evidence auto-attached from the game state at filing time.
 *  The player can still write anything in the body; this is the receipt. */
export interface RentEvidence {
  kind: "rent";
  /** Weekly rent the player agreed to when they moved in. */
  baseRent: number;
  /** Weekly rent the landlord is charging now. */
  currentRent: number;
  /** Total rent actually paid so far this run. */
  rentPaid: number;
  /** Deposit the player paid (if any) — the amount a withheld deposit is. */
  depositPaid?: number;
  /** The in-game notice text, e.g. the "房东来了" rent-rise event line. */
  noticeText?: string;
  /** Free-form extra evidence, e.g. "上周还 ¥420，这周变 ¥520". */
  note?: string;
}

export interface WageEvidence {
  kind: "wage";
  companyId: string;
  companyName: string;
  /** Days worked at this company this run. */
  workCount: number;
  /** Overtime shifts worked this run. */
  otCount: number;
  /** What one overtime shift should pay at this company (day pay × otMul). */
  otPayPerShift: number;
  /** Player's claim: how much overtime pay is missing, in their words/number. */
  claimedUnpaid?: number;
  note?: string;
}

export type ReportEvidence = RentEvidence | WageEvidence;

/** What the player submits. `targetId` is a game entity id, never a person:
 *  landlord → the housing key (`home:<city>` / the landlord NPC id);
 *  employer → a COMPANIES id from data.ts (e.g. "startup", "tencent"). */
export interface ReportDraft {
  kind: ReportKind;
  city: ReportCity;
  targetId: string;
  targetName: string;
  /** Free text, 10–600 chars. The whole point: open-ended, player's words. */
  body: string;
  evidence?: ReportEvidence;
}

/** A report as the server returns it (mirrors the gig GIG_VIEW shape). */
export interface BlackReport {
  id: number;
  kind: ReportKind;
  city: ReportCity;
  reporter: { id: string; name: string; emoji: string };
  targetId: string;
  targetName: string;
  body: string;
  evidence: ReportEvidence | null;
  status: ReportStatus;
  votes: { uphold: number; reject: number };
  myVote: ReportVoteSide | null;
  dueAt: string;
  createdAt: string;
  /** Filled in once the jury closes. */
  verdictNote?: string | null;
}

/** What an upheld verdict actually does. The server computes the numbers;
 *  the client applies them to local state and shows the log lines. */
export interface LandlordRemedy {
  /** Rent rolls back to the pre-rise level (the evidence baseRent). */
  rentRolledBackTo: number;
  /** Deposit returned to the player (0 if none was withheld). */
  depositReturned: number;
  /** Overcharged rent refunded (currentRent - baseRent for the weeks paid). */
  overchargeRefunded: number;
  /** Fine levied on the landlord — goes to the community fund, not the player. */
  fine: number;
}

export interface EmployerRemedy {
  /** Back pay owed to the reporter. */
  backPay: number;
  /** The job listing is flagged for every player until the company clears it. */
  listingFlagged: boolean;
  /** The company is removed from hiring until it clears the flag. */
  hiringSuspended: boolean;
  fine: number;
}

export type ReportRemedy = LandlordRemedy | EmployerRemedy;

/** Public reputation of a landlord / company, as every player sees it before
 *  renting a room or taking a job there. Score 0–100, starts at 80. */
export interface Reputation {
  targetId: string;
  targetName: string;
  kind: ReportKind;
  score: number;
  upheldCount: number;
  rejectedCount: number;
  /** ISO date until which the listing shows the flag (null = not flagged). */
  flaggedUntil: string | null;
  updatedAt: string;
}

export type WarningLevel = "none" | "caution" | "warning" | "blacklist";

/** The reporter's own standing. Starts at 100; rejected reports cost 25,
 *  upheld reports give back 5. Below 50 you can't file until it recovers
 *  (one upheld report, or a week of clean play, restores 10). */
export interface ReporterStanding {
  credibility: number;
  filedCount: number;
  upheldCount: number;
  rejectedCount: number;
  /** ISO date until which filing is locked (null = can file). */
  lockedUntil: string | null;
}

// ---------------------------------------------------------------------------
// Constants — the rules of the system, in one place
// ---------------------------------------------------------------------------

export const REPORT_RULES = {
  /** Free to file. Charging a fee would gate the poorest players — the exact
   *  people a black landlord preys on. The cost of a false report is
   *  credibility, not money. */
  FILING_FEE: 0,
  MIN_BODY: 10,
  MAX_BODY: 600,
  /** Jury window, same as a disputed gig (24h). */
  JURY_HOURS: 24,
  /** Quorum: fewer votes than this and the report expires "not proven". */
  MIN_JURY_VOTES: 3,
  /** Most open reports one player can have at once. */
  MAX_OPEN_REPORTS: 3,
  /** One filing per kind per game day — stops report floods. */
  FILE_COOLDOWN_DAYS: 1,
  /** Credibility lost when a jury rejects your report. */
  FALSE_REPORT_COST: 25,
  /** Credibility regained when a jury upholds your report. */
  TRUE_REPORT_GAIN: 5,
  /** Below this credibility, filing locks until it recovers. */
  LOCKOUT_BELOW: 50,
  /** Reputation: one upheld report costs this much. */
  REPUTATION_HIT_UPHELD: 20,
  /** Reputation: one rejected report restores a little (vindication). */
  REPUTATION_GAIN_REJECTED: 5,
  /** Reputation recovers this much per game week with no new upheld report. */
  REPUTATION_WEEKLY_RECOVERY: 3,
  /** Starting reputation for any landlord / company. */
  REPUTATION_START: 80,
  /** Days a flagged listing stays flagged after an upheld report. */
  FLAG_DAYS: 7,
} as const;

/** Warning thresholds on the 0–100 reputation score. */
export const WARNING_THRESHOLDS = { caution: 70, warning: 50, blacklist: 30 } as const;

/** Suggestion chips. Tap one and it drops into the text box as a starting
 *  sentence the player can edit freely — never a mandatory category. */
export const SUGGESTED_CHARGES: Record<ReportKind, SuggestedCharge[]> = {
  landlord: [
    { key: "rent-rise", label: "违规涨租", hint: "说好 ¥420 一周，突然涨到 ¥520，没商量" },
    { key: "deposit", label: "扣押金", hint: "搬走了押金不退，说墙上有个印子" },
    { key: "utilities", label: "断水断电", hint: "半夜停水停电，催了三天没人修" },
    { key: "unsafe", label: "房子不安全", hint: "电线裸露、门锁坏了、楼道没灯" },
    { key: "eviction", label: "威胁赶人", hint: "不接受涨价就三天内搬走" },
  ],
  employer: [
    { key: "unpaid-ot", label: "加班不给钱", hint: "这个月加了 8 次班，加班费一分没发" },
    { key: "wage", label: "拖欠工资", hint: "工资拖了半个月，问就是“下周发”" },
    { key: "unsafe", label: "工作不安全", hint: "车间没防护，受伤了让自己扛" },
    { key: "fake-ad", label: "招聘造假", hint: "招的时候说双休，进来天天 996" },
  ],
};

// ---------------------------------------------------------------------------
// Validation + filing gates (client-side; the server re-checks everything)
// ---------------------------------------------------------------------------

/** Returns the problem with a draft, or null when it can be filed. */
export function validateDraft(draft: ReportDraft): string | null {
  const body = draft.body.trim();
  if (body.length < REPORT_RULES.MIN_BODY) return `写多一点再举报：至少 ${REPORT_RULES.MIN_BODY} 个字，说清楚发生了什么。`;
  if (body.length > REPORT_RULES.MAX_BODY) return `举报写得太长了，最多 ${REPORT_RULES.MAX_BODY} 个字。`;
  if (!draft.targetId.trim() || !draft.targetName.trim()) return "举报对象不对——先选好要举报的房东或公司。";
  return null;
}

/** Can this player file right now? Checks the local book (open reports,
 *  cooldown, credibility lockout). The server enforces the same rules. */
export function canFile(
  book: ReportBookState,
  kind: ReportKind,
  today: number,
): { ok: true } | { ok: false; reason: string } {
  const now = Date.now();
  if (book.standing.lockedUntil && new Date(book.standing.lockedUntil).getTime() > now) {
    return { ok: false, reason: "你最近的举报被陪审团驳回太多次了，先冷静几天，等信誉恢复再举报。" };
  }
  if (book.standing.credibility < REPORT_RULES.LOCKOUT_BELOW) {
    return { ok: false, reason: "信誉太低了，暂时不能举报——等一周恢复，或者有一份举报被判属实就能恢复。" };
  }
  const open = book.myReports.filter((r) => r.status === "open").length;
  if (open >= REPORT_RULES.MAX_OPEN_REPORTS) {
    return { ok: false, reason: `你已经有 ${REPORT_RULES.MAX_OPEN_REPORTS} 份举报在等陪审团了，等它们判完再报新的。` };
  }
  const last = book.lastFiledDayByKind[kind];
  if (last !== undefined && today - last < REPORT_RULES.FILE_COOLDOWN_DAYS) {
    return { ok: false, reason: "今天已经报过一次了，明天再报——陪审团也需要时间。" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Evidence builders — the receipt auto-attached at filing time
// ---------------------------------------------------------------------------

export interface RentSnapshot {
  baseRent: number;
  rent: number;
  rentPaid: number;
  depositPaid?: number;
  /** The notice the landlord gave, e.g. the rent-rise event text. */
  noticeText?: string;
}

export function buildRentEvidence(s: RentSnapshot, note?: string): RentEvidence {
  return {
    kind: "rent",
    baseRent: s.baseRent,
    currentRent: s.rent,
    rentPaid: s.rentPaid,
    depositPaid: s.depositPaid,
    noticeText: s.noticeText,
    note: note?.trim() || undefined,
  };
}

export interface WageSnapshot {
  companyId: string;
  companyName: string;
  workCount: number;
  otCount: number;
  otPayPerShift: number;
  claimedUnpaid?: number;
}

export function buildWageEvidence(s: WageSnapshot, note?: string): WageEvidence {
  return { kind: "wage", ...s, note: note?.trim() || undefined };
}

// ---------------------------------------------------------------------------
// Jury math — same shape as settleGigs, burden of proof on the reporter
// ---------------------------------------------------------------------------

export interface JuryTally { uphold: number; reject: number; }

/** Decides a closed jury. Upheld only on a real majority AND a quorum.
 *  A tie, or too few votes, means "not proven" — the accused is NOT punished
 *  and the reporter is NOT penalised for a false report either. */
export function decideJury(votes: JuryTally): "upheld" | "rejected" | "expired" {
  const total = votes.uphold + votes.reject;
  if (total < REPORT_RULES.MIN_JURY_VOTES) return "expired";
  if (votes.uphold > votes.reject) return "upheld";
  if (votes.reject > votes.uphold) return "rejected";
  return "expired"; // tie: not proven either way
}

export function jurySummary(votes: JuryTally, en: boolean): string {
  const total = votes.uphold + votes.reject;
  if (total === 0) return en ? "No votes yet — the jury is still reading." : "还没人投票，陪审团还在看材料。";
  return en
    ? `${votes.uphold} for the report, ${votes.reject} against (${total} votes${total < REPORT_RULES.MIN_JURY_VOTES ? ` — needs ${REPORT_RULES.MIN_JURY_VOTES} to decide` : ""}).`
    : `支持举报 ${votes.uphold} 票，反对 ${votes.reject} 票（共 ${total} 票${total < REPORT_RULES.MIN_JURY_VOTES ? `，满 ${REPORT_RULES.MIN_JURY_VOTES} 票才判` : ""}）。`;
}

// ---------------------------------------------------------------------------
// Reputation — what other players see BEFORE they rent or take the job
// ---------------------------------------------------------------------------

export function freshReputation(targetId: string, targetName: string, kind: ReportKind): Reputation {
  return {
    targetId, targetName, kind,
    score: REPORT_RULES.REPUTATION_START,
    upheldCount: 0, rejectedCount: 0,
    flaggedUntil: null,
    updatedAt: new Date().toISOString(),
  };
}

export function warningLevel(score: number): WarningLevel {
  if (score < WARNING_THRESHOLDS.blacklist) return "blacklist";
  if (score < WARNING_THRESHOLDS.warning) return "warning";
  if (score < WARNING_THRESHOLDS.caution) return "caution";
  return "none";
}

/** Apply one closed verdict to a reputation. Pure — returns a new object. */
export function applyVerdictToReputation(rep: Reputation, upheld: boolean, now = new Date()): Reputation {
  if (upheld) {
    return {
      ...rep,
      score: Math.max(0, rep.score - REPORT_RULES.REPUTATION_HIT_UPHELD),
      upheldCount: rep.upheldCount + 1,
      flaggedUntil: new Date(now.getTime() + REPORT_RULES.FLAG_DAYS * 86_400_000).toISOString(),
      updatedAt: now.toISOString(),
    };
  }
  return {
    ...rep,
    score: Math.min(100, rep.score + REPORT_RULES.REPUTATION_GAIN_REJECTED),
    rejectedCount: rep.rejectedCount + 1,
    updatedAt: now.toISOString(),
  };
}

/** Slow recovery: a clean week with no new upheld report heals a little.
 *  Nobody is branded forever — a landlord / company can earn trust back. */
export function recoverReputation(rep: Reputation, weeksClean: number): Reputation {
  if (weeksClean <= 0) return rep;
  return { ...rep, score: Math.min(100, rep.score + weeksClean * REPORT_RULES.REPUTATION_WEEKLY_RECOVERY), updatedAt: new Date().toISOString() };
}

/** The warning banner shown before a player rents a room from this landlord
 *  or takes a job at this company. Returns null when there is nothing to warn
 *  about — no warning, no friction, no noise for honest landlords. */
export function reputationWarning(rep: Reputation | null | undefined, en: boolean): string | null {
  if (!rep) return null;
  const level = warningLevel(rep.score);
  if (level === "none") return null;
  const flag = rep.flaggedUntil && new Date(rep.flaggedUntil).getTime() > Date.now()
    ? (en ? " — listing flagged, hiring/renting paused" : "——房源/招聘已被标记，暂停出租/招人")
    : "";
  if (level === "blacklist") {
    return en
      ? `⛔ ${rep.targetName} has ${rep.upheldCount} upheld complaints — players report withheld deposits, illegal rent rises and unpaid overtime. Rent / work here at your own risk.${flag}`
      : `⛔ ${rep.targetName} 已有 ${rep.upheldCount} 起举报被陪审团判属实（扣押金、违规涨租、拖欠加班费……）。租这里的房 / 在这里上班，风险自担。${flag}`;
  }
  if (level === "warning") {
    return en
      ? `⚠️ ${rep.targetName} has ${rep.upheldCount} upheld complaint(s). Check the exposure board before you sign anything.${flag}`
      : `⚠️ ${rep.targetName} 已有 ${rep.upheldCount} 起举报被判属实，签约之前先去曝光栏看看。${flag}`;
  }
  return en
    ? `🟡 ${rep.targetName} has a complaint on record (${rep.upheldCount} upheld). Worth a look before you commit.`
    : `🟡 ${rep.targetName} 有 ${rep.upheldCount} 起举报记录，签约前值得看一眼。`;
}

// ---------------------------------------------------------------------------
// Verdict application — what happens to the PLAYER's local game state
// ---------------------------------------------------------------------------

/** Minimal shape of the game state this module touches. Every field is
 *  optional except money: App.tsx passes its `s` (GameState) straight in —
 *  it has all of these — and only the fields present are changed. */
export interface ReportGameState {
  money: number;
  rent?: number;
  baseRent?: number;
  rentPaid?: number;
  earned?: number;
  mood?: number;
  energy?: number;
  employer?: string;
  ownFlat?: boolean;
  day?: number;
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** An UPHELD landlord verdict: rent rolls back, deposit + overcharge come
 *  home. Returns the log lines App.tsx should show / addLog. */
export function applyLandlordVerdict(s: ReportGameState, remedy: LandlordRemedy, en: boolean): string[] {
  const lines: string[] = [];
  const linesEn: string[] = [];
  if (s.baseRent !== undefined && s.rent !== undefined) {
    const old = s.rent;
    s.rent = remedy.rentRolledBackTo;
    s.baseRent = remedy.rentRolledBackTo;
    if (old !== remedy.rentRolledBackTo) {
      lines.push(`房租从 ¥${old}/周滚回 ¥${remedy.rentRolledBackTo}/周。`);
      linesEn.push(`Rent rolled back from ¥${old}/week to ¥${remedy.rentRolledBackTo}/week.`);
    }
  }
  const back = remedy.depositReturned + remedy.overchargeRefunded;
  if (back > 0) {
    s.money += back;
    if (s.earned !== undefined) s.earned += back;
    lines.push(`押金 + 多收的房租，一共退回 ¥${back}。`);
    linesEn.push(`Deposit + overcharged rent refunded: ¥${back}.`);
  }
  if (remedy.fine > 0) {
    lines.push(`房东被罚 ¥${remedy.fine}，进了社区基金。`);
    linesEn.push(`The landlord was fined ¥${remedy.fine} — it goes to the community fund.`);
  }
  if (s.mood !== undefined) s.mood = clamp100(s.mood + 8);
  lines.push("陪审团判你赢了。以后租房，记得先看曝光栏。");
  linesEn.push("The jury ruled in your favour. Check the exposure board before your next rental.");
  return en ? linesEn : lines;
}

/** An UPHELD employer verdict: back pay lands, the listing is flagged for
 *  everyone. If hiring is suspended and this is the player's own employer,
 *  the player keeps the job (the game never fires the player for reporting)
 *  but the company can't hire anyone new until it clears the flag. */
export function applyEmployerVerdict(s: ReportGameState, remedy: EmployerRemedy, en: boolean): string[] {
  const lines: string[] = [];
  const linesEn: string[] = [];
  if (remedy.backPay > 0) {
    s.money += remedy.backPay;
    if (s.earned !== undefined) s.earned += remedy.backPay;
    lines.push(`拖欠的加班费/工资补发了：+¥${remedy.backPay}。`);
    linesEn.push(`Back pay arrived: +¥${remedy.backPay}.`);
  }
  if (remedy.listingFlagged) {
    lines.push("这家公司的招聘已被标记，所有人都能看到这起举报。");
    linesEn.push("The company's job listing is now flagged for every player.");
  }
  if (remedy.hiringSuspended) {
    lines.push("公司暂停招人，直到整改通过。");
    linesEn.push("Hiring is suspended until the company clears the flag.");
  }
  if (remedy.fine > 0) {
    lines.push(`公司被罚 ¥${remedy.fine}，进了社区基金。`);
    linesEn.push(`The company was fined ¥${remedy.fine} — it goes to the community fund.`);
  }
  if (s.mood !== undefined) s.mood = clamp100(s.mood + 8);
  if (s.energy !== undefined) s.energy = clamp100(s.energy + 5);
  lines.push("陪审团判你赢了。打工人的委屈，有地方说了。");
  linesEn.push("The jury ruled in your favour. Workers have somewhere to be heard.");
  return en ? linesEn : lines;
}

/** A REJECTED report: credibility drops, a little mood toll, and — if this
 *  was the second strike — filing locks for a week. Returns the log lines
 *  and the new standing; App.tsx should persist the standing in the book. */
export function applyFalseReportPenalty(
  standing: ReporterStanding,
  en: boolean,
): { standing: ReporterStanding; lines: string[] } {
  const credibility = Math.max(0, standing.credibility - REPORT_RULES.FALSE_REPORT_COST);
  const rejectedCount = standing.rejectedCount + 1;
  const locked = credibility < REPORT_RULES.LOCKOUT_BELOW;
  const next: ReporterStanding = {
    ...standing,
    credibility,
    rejectedCount,
    lockedUntil: locked ? new Date(Date.now() + 7 * 86_400_000).toISOString() : standing.lockedUntil,
  };
  const lines = en
    ? [`The jury rejected the report — credibility -${REPORT_RULES.FALSE_REPORT_COST} (now ${credibility}).${locked ? " Filing is locked for a week." : " Make sure the next one has solid evidence."}`]
    : [`陪审团驳回了这份举报，信誉 -${REPORT_RULES.FALSE_REPORT_COST}（现在 ${credibility}）。${locked ? "举报功能锁定一周，等信誉恢复。" : "下次举报记得附上更实的证据。"}`];
  return { standing: next, lines };
}

/** An UPHELD report: a little credibility back. */
export function applyTrueReportGain(standing: ReporterStanding): ReporterStanding {
  return {
    ...standing,
    credibility: Math.min(100, standing.credibility + REPORT_RULES.TRUE_REPORT_GAIN),
    upheldCount: standing.upheldCount + 1,
  };
}

// ---------------------------------------------------------------------------
// Exposure — the public board entry for an upheld report
// ---------------------------------------------------------------------------

/** One line for the community exposure board / NPC news feed when a report
 *  is upheld. Names the GAME entity, never a real player. */
export function exposureLine(report: BlackReport, en: boolean): string {
  const what = report.kind === "landlord"
    ? (en ? "black landlord" : "黑房东")
    : (en ? "black employer" : "黑公司");
  const body = report.body.length > 80 ? `${report.body.slice(0, 80)}……` : report.body;
  return en
    ? `📢 EXPOSED ${what}: ${report.targetName} — ${body} (upheld by the city jury, ${report.votes.uphold}–${report.votes.reject})`
    : `📢 曝光${what}：${report.targetName}——${body}（同城陪审团 ${report.votes.uphold}–${report.votes.reject} 判属实）`;
}

// ---------------------------------------------------------------------------
// Local book — offline fallback + the player's own standing
// ---------------------------------------------------------------------------

export interface ReportBookState {
  standing: ReporterStanding;
  /** Local echoes of the player's own reports (server is the source of truth). */
  myReports: BlackReport[];
  /** Reputation snapshots the client has seen (keyed by targetId). */
  knownReputations: Record<string, Reputation>;
  /** Game day of the last filing, per kind (cooldown). */
  lastFiledDayByKind: Partial<Record<ReportKind, number>>;
}

export function freshReportBook(): ReportBookState {
  return {
    standing: { credibility: 100, filedCount: 0, upheldCount: 0, rejectedCount: 0, lockedUntil: null },
    myReports: [],
    knownReputations: {},
    lastFiledDayByKind: {},
  };
}

const BOOK_KEY = "shenhui-report-book-v1";

/** Tiny localStorage store. Safe to call on the server / in tests — it just
 *  returns a fresh book when storage is unavailable. */
export class ReportBook {
  state: ReportBookState;

  constructor() {
    this.state = freshReportBook();
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(BOOK_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ReportBookState>;
        this.state = { ...freshReportBook(), ...parsed, standing: { ...freshReportBook().standing, ...(parsed.standing ?? {}) } };
      }
    } catch {
      this.state = freshReportBook();
    }
  }

  save(): void {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(BOOK_KEY, JSON.stringify(this.state));
    } catch {
      /* storage full / private mode — the server still has the reports */
    }
  }

  /** Record a filing locally (optimistic echo until the server answers). */
  noteFiled(draft: ReportDraft, day: number, tempId = -Date.now()): BlackReport {
    const echo: BlackReport = {
      id: tempId,
      kind: draft.kind,
      city: draft.city,
      reporter: { id: "me", name: "我", emoji: "🙂" },
      targetId: draft.targetId,
      targetName: draft.targetName,
      body: draft.body.trim(),
      evidence: draft.evidence ?? null,
      status: "open",
      votes: { uphold: 0, reject: 0 },
      myVote: null,
      dueAt: new Date(Date.now() + REPORT_RULES.JURY_HOURS * 3600_000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    this.state.myReports = [echo, ...this.state.myReports].slice(0, 20);
    this.state.standing.filedCount += 1;
    this.state.lastFiledDayByKind[draft.kind] = day;
    this.save();
    return echo;
  }

  /** Merge a server-fetched report list into the local book. */
  mergeReports(reports: BlackReport[]): void {
    for (const r of reports) {
      const i = this.state.myReports.findIndex((m) => m.id === r.id);
      if (i >= 0) this.state.myReports[i] = r;
      else if (r.reporter.id === "me") this.state.myReports = [r, ...this.state.myReports].slice(0, 20);
    }
    this.save();
  }

  noteReputation(rep: Reputation): void {
    this.state.knownReputations[rep.targetId] = rep;
    this.save();
  }

  reputationFor(targetId: string): Reputation | null {
    return this.state.knownReputations[targetId] ?? null;
  }
}

// ---------------------------------------------------------------------------
// Server transport — what area S must implement (see ROUND2-LOG-d.md for the
// full spec). `api` in App.tsx is a typed proxy over server/src/actions.ts;
// once the actions land, `asReportTransport(api)` gives this module a typed
// handle to them. Until then the calls fail at the network layer and the
// local ReportBook above is the fallback — never a crash.
// ---------------------------------------------------------------------------

export interface FileBlackReportArgs {
  playerId: string;
  kind: ReportKind;
  city: ReportCity;
  targetId: string;
  targetName: string;
  body: string;
  evidence?: ReportEvidence;
}
export interface FileBlackReportRes {
  ok: boolean;
  error?: string;
  reportId?: number;
  dueAt?: string;
}

export interface GetBlackReportsArgs { playerId: string; city: ReportCity; }
export interface GetBlackReportsRes {
  mine: BlackReport[];
  jury: BlackReport[];
  exposed: BlackReport[];
  reputations: Reputation[];
}

export interface BlackReportVoteArgs { playerId: string; reportId: number; side: ReportVoteSide; }
export interface BlackReportVoteRes { ok: boolean; error?: string; }

export interface ClaimBlackReportArgs { playerId: string; reportId: number; }
export interface ClaimBlackReportRes {
  ok: boolean;
  error?: string;
  /** Money to add to the local wallet (deposit + overcharge / back pay). */
  money: number;
  remedy?: ReportRemedy;
  lines: string[];
}

export interface ReportTransport {
  fileBlackReport(args: FileBlackReportArgs): Promise<FileBlackReportRes>;
  getBlackReports(args: GetBlackReportsArgs): Promise<GetBlackReportsRes>;
  blackReportVote(args: BlackReportVoteArgs): Promise<BlackReportVoteRes>;
  claimBlackReport(args: ClaimBlackReportArgs): Promise<ClaimBlackReportRes>;
}

/** Adapts the game's typed `api` proxy to this module's transport. The cast
 *  is intentional: the four actions do not exist yet (area S), so they can't
 *  be named in the generated `Actions` type until they land. */
export function asReportTransport(api: unknown): ReportTransport {
  return api as ReportTransport;
}
