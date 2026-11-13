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
 * new 3D system. Patrols and observations live on the server now
 * (round-3, agent S: patrols / patrol_watches tables + startPatrol /
 * observe / getWatchers / stopPatrol / stopObserving endpoints), so a
 * watch is visible across sessions and devices — the in-memory Map from
 * round-2 is gone.
 *
 * Pure TypeScript, no React. The only server import is the typed `api`
 * client (no server runtime is pulled into the bundle).
 */

import { api } from "../api";

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
  officerName: string;
  officerEmoji: string;
  targetId: string;
  /** what the officer wrote down while watching (game behaviour only) */
  note: string;
  startedAt: string;
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

/* ---- server-backed patrol (round-3): one patrol per officer, rows in
   patrols / patrol_watches; a watch is visible to the watched player via
   getWatchers. All five calls go through the typed `api` client. ---- */

/** Start (or refresh) a patrol in the caller's city. */
export async function startPatrol(playerId: string, city: PoliceCity): Promise<{ ok: boolean; error?: string }> {
  if (!isGameAvatarId(playerId)) return { ok: false, error: "你的游戏 ID 不合规。" };
  try {
    const r = await api.startPatrol({ playerId, city });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  } catch {
    return { ok: false, error: "网络不太好，巡逻没开起来。" };
  }
}

/** End the patrol — the server deletes every observation it opened too. */
export async function stopPatrol(playerId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await api.stopPatrol({ playerId });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  } catch {
    return { ok: false, error: "网络不太好。" };
  }
}

/**
 * Start watching a game avatar. Returns ok:false when rejected (bad id,
 * not on patrol, watching yourself, already watching, target in another
 * city). The record is visible to the target immediately via getWatchers().
 */
export async function observe(playerId: string, targetId: string, note = ""): Promise<{ ok: boolean; error?: string }> {
  if (!isGameAvatarId(targetId)) return { ok: false, error: "只能观察游戏里的玩家 / NPC。" };
  if (targetId === playerId) return { ok: false, error: "不能观察自己。" };
  try {
    const r = await api.observe({ playerId, targetId, note: note.slice(0, 200) || undefined });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  } catch {
    return { ok: false, error: "网络不太好。" };
  }
}

/** Stop watching one avatar. */
export async function stopObserving(playerId: string, targetId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await api.stopObserving({ playerId, targetId });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  } catch {
    return { ok: false, error: "网络不太好。" };
  }
}

/** Who is watching this avatar right now — the watched player reads this. */
export async function getWatchers(playerId: string): Promise<WatchRecord[]> {
  try {
    const r = await api.getWatchers({ playerId });
    if (!r.ok) return [];
    return r.watchers.map((w) => ({ ...w, targetId: playerId, city: w.city as PoliceCity }));
  } catch {
    return [];
  }
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
  observations: { note: string; at: number }[] = [],
): PoliceReportPayload | null {
  if (!isGameAvatarId(officerId) || !isGameAvatarId(targetId)) return null;
  if (!body.trim()) return null;
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
