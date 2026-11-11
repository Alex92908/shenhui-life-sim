/**
 * police.ts — area (g): player-as-police + surveilling others (round-2)
 *
 * The user asked for the player to be able to act as police and to watch
 * other players. Three hard rules from the task, enforced in code, not
 * just in comments:
 *
 *   1. IN-GAME AVATARS ONLY. observe() / filePoliceReport() accept only
 *      game avatar ids (player ids / NPC ids from data.ts). Anything that
 *      looks like real personal data — an email, a phone number, a real
 *      name with spaces — is rejected by isGameAvatarId(). There is no
 *      field, anywhere in this module, for real-world identity.
 *   2. THE WATCHED PLAYER CAN SEE IT. Every observation is registered in
 *      a watchers map the watched player reads (getWatchers) — the game
 *      shows them a visible 👁️ indicator (WATCH_INDICATOR) while they are
 *      being watched. No secret surveillance: watching is itself visible.
 *   3. WATCHING ALONE DOES NOTHING. An observation is a note, not a
 *      punishment. Consequences only come from a filed report that goes
 *      through area (d)'s jury flow (report.ts fileBlackReport, or the
 *      existing server reportPlayer for player-vs-player) — filing alone
 *      changes nothing about the accused.
 *
 * Scope: this is the client-side state + validation + report payload
 * shaping. Patrol movement itself reuses the existing map/roam: a patrol
 * is a mode flag the App snippet reads (patrol overlay + 👁️ badge), not a
 * new 3D system. No server endpoint is invented here — see
 * toBlackReportArgs() for the area (d) hook and the note on reportPlayer.
 *
 * Pure TypeScript, no React, no server imports.
 */

/** A game avatar id: lowercase slug, e.g. "player-7f3a" or an NPC id from data.ts. */
export function isGameAvatarId(id: string): boolean {
  if (!id || id.length > 48) return false;
  // slugs only: letters, digits, dashes, underscores — no spaces, no @,
  // no dots, so no emails, no real names, no handles from other apps.
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) return false;
  // a bare run of 7+ digits looks like a phone number fragment, not an id
  if (/\d{7,}/.test(id)) return false;
  return true;
}

export type PoliceCity = "sz" | "hz" | "hk";

export type PatrolStatus = "off" | "patrolling" | "observing";

export interface WatchRecord {
  officerId: string;
  targetId: string;
  /** what the officer wrote down while watching (game behaviour only) */
  note: string;
  startedAt: number;
  city: PoliceCity;
}

/** What the watched player sees — rendered as a badge, never hidden. */
export const WATCH_INDICATOR = {
  emoji: "👁️",
  zh: "有人在留意你",
  en: "Someone is keeping an eye on you",
  detailZh: "巡逻的玩家正在观察这一带，你能看到是谁在看。",
  detailEn: "A patrolling player is watching this area — you can see who it is.",
} as const;

export interface PoliceReportPayload {
  officerId: string;
  targetId: string;
  targetKind: "player" | "npc-landlord" | "npc-employer";
  city: PoliceCity;
  /** game behaviour observed, in the officer's words — never real identity */
  body: string;
  /** observation notes attached as evidence, if any */
  observations: { note: string; at: number }[];
  filedAt: number;
}

/* ---- module state: one patrol at a time, in-memory ---- */

let patrol: { officerId: string; city: PoliceCity; since: number } | null = null;
const watchers = new Map<string, WatchRecord[]>();

export function patrolState(): { status: PatrolStatus; officerId: string | null; city: PoliceCity | null } {
  return {
    status: patrol ? "patrolling" : "off",
    officerId: patrol?.officerId ?? null,
    city: patrol?.city ?? null,
  };
}

export function startPatrol(officerId: string, city: PoliceCity): boolean {
  if (!isGameAvatarId(officerId)) return false;
  patrol = { officerId, city, since: Date.now() };
  return true;
}

export function stopPatrol(officerId: string) {
  if (patrol?.officerId !== officerId) return;
  // ending a patrol ends every observation it opened — no lingering watch
  for (const [target, list] of [...watchers]) {
    const kept = list.filter((w) => w.officerId !== officerId);
    if (kept.length === 0) watchers.delete(target);
    else watchers.set(target, kept);
  }
  patrol = null;
}

/**
 * Start watching a game avatar. Returns null when rejected (bad id, not
 * on patrol, watching yourself, or already watching). The record is
 * visible to the target immediately via getWatchers().
 */
export function observe(targetId: string, note = ""): WatchRecord | null {
  if (!patrol) return null;
  if (!isGameAvatarId(targetId)) return null;
  if (targetId === patrol.officerId) return null; // no watching yourself
  const list = watchers.get(targetId) ?? [];
  if (list.some((w) => w.officerId === patrol!.officerId)) return null;
  const rec: WatchRecord = {
    officerId: patrol.officerId,
    targetId,
    note: note.slice(0, 200),
    startedAt: Date.now(),
    city: patrol.city,
  };
  watchers.set(targetId, [...list, rec]);
  return rec;
}

export function stopObserving(officerId: string, targetId: string) {
  const list = watchers.get(targetId);
  if (!list) return;
  const kept = list.filter((w) => w.officerId !== officerId);
  if (kept.length === 0) watchers.delete(targetId);
  else watchers.set(targetId, kept);
}

/** Who is watching this avatar right now — the watched player reads this. */
export function getWatchers(targetId: string): WatchRecord[] {
  return [...(watchers.get(targetId) ?? [])];
}

export function isWatched(targetId: string): boolean {
  return (watchers.get(targetId)?.length ?? 0) > 0;
}

export function observationsBy(officerId: string, targetId: string): WatchRecord[] {
  return (watchers.get(targetId) ?? []).filter((w) => w.officerId === officerId);
}

/**
 * Build a report payload from what was observed. Filing is a separate,
 * explicit step (the App snippet shows a confirm screen first) and the
 * payload itself does nothing — consequences need area (d)'s jury.
 */
export function buildPoliceReport(
  officerId: string,
  targetId: string,
  targetKind: PoliceReportPayload["targetKind"],
  city: PoliceCity,
  body: string,
): PoliceReportPayload | null {
  if (!isGameAvatarId(officerId) || !isGameAvatarId(targetId)) return null;
  if (!body.trim()) return null;
  const observations = observationsBy(officerId, targetId).map((w) => ({
    note: w.note,
    at: w.startedAt,
  }));
  return {
    officerId,
    targetId,
    targetKind,
    city,
    body: body.trim().slice(0, 500),
    observations,
    filedAt: Date.now(),
  };
}

/**
 * Hook into area (d)'s report flow (client/src/round2/report.ts):
 * a police report about an NPC landlord / employer becomes a black report
 * with kind landlord/employer, filed through ReportTransport.fileBlackReport
 * once area S lands it. Player-vs-player reports do NOT go here — they go
 * through the existing server reportPlayer action (see ROUND2-LOG-g.md).
 * Returns null for player targets: the caller must use reportPlayer.
 */
export function toBlackReportArgs(
  r: PoliceReportPayload,
  playerId: string,
  targetName: string,
): {
  playerId: string;
  kind: "landlord" | "employer";
  city: PoliceCity;
  targetId: string;
  targetName: string;
  body: string;
} | null {
  if (r.targetKind === "player") return null;
  return {
    playerId,
    kind: r.targetKind === "npc-landlord" ? "landlord" : "employer",
    city: r.city,
    targetId: r.targetId,
    targetName,
    body: r.body,
  };
}
