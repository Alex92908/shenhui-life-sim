/**
 * controls.ts — area (g): desktop keyboard movement + joystick tuning (round-2)
 *
 * The problem (verified 2026-11-11): the game has NO keyboard movement at
 * all — no KeyW/A/S/D handlers anywhere, only Enter on buttons. Movement is
 * the touch joystick only, plus drag-to-rotate camera. The user plays on a
 * MacBook in a desktop browser, so this module adds:
 *
 *   - WASD + arrow-key movement (same stick vector the joystick writes, so
 *     the LifeStage roam loop needs no changes — keyboard and joystick feed
 *     one shared `{ x, y }` ref)
 *   - Shift = run (full-stick magnitude, which the roam loop already reads
 *     as sprint when mag > 0.9)
 *   - E / Space = interact (fires the same callback as the on-screen
 *     interact button when a roam spot is near)
 *   - mouse drag to rotate the camera — already exists in LifeStage's roam
 *     pointer handlers; this module does not duplicate it.
 *
 * The joystick itself lives in LifeStage.tsx (MoveStick). Its tuning lives
 * there too: dynamic base position (the stick appears where the thumb
 * touches), smoother acceleration (velocity is lerped in the roam frame
 * loop, with a short glide on release), push-to-run kept. This module only
 * owns the keyboard half + the "keyboard in use" signal LifeStage uses to
 * hide the joystick and show WASD hints on desktop.
 *
 * Pure TypeScript + React refs only — no DOM created here, no server calls.
 * App.tsx integration: none needed for the joystick (LifeStage owns it);
 * the keyboard attach call lives inside LifeStage's roam effect.
 */

import type { MutableRefObject } from "react";

/** The shared move vector: x = strafe right, y = forward, each −1…1. */
export interface StickVec {
  x: number;
  y: number;
}

/** Keys that move. Arrows included so laptop keyboards without WASD habit work too. */
const MOVE_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

/** Has the player moved with the keyboard yet this session? */
let keyboardUsed = false;
const keyboardListeners = new Set<(used: boolean) => void>();

export function isKeyboardUsed(): boolean {
  return keyboardUsed;
}

/** LifeStage subscribes so it can hide the joystick + show WASD hints. */
export function subscribeKeyboardUsed(cb: (used: boolean) => void): () => void {
  keyboardListeners.add(cb);
  return () => {
    keyboardListeners.delete(cb);
  };
}

function markKeyboardUsed() {
  if (keyboardUsed) return;
  keyboardUsed = true;
  for (const cb of [...keyboardListeners]) cb(true);
}

/**
 * Desktop hint line shown in roam scenes once a keyboard is in play
 * (LifeStage renders it; the strings live here so App and LifeStage agree).
 */
export const KEYBOARD_HINTS = {
  zh: "⌨️ WASD / 方向键 移动 · Shift 跑 · E 互动 · 拖动看四周",
  en: "⌨️ WASD / arrows to move · Shift to run · E to interact · drag to look",
} as const;

export interface KeyboardRoamOptions {
  /** the same ref the joystick writes — keyboard and stick share it */
  stick: MutableRefObject<StickVec>;
  /** fired on E / Space (not on repeat) — LifeStage wires it to the near spot */
  onInteract?: () => void;
  /** fired once, on the first movement key — LifeStage hides the joystick */
  onFirstKey?: () => void;
  /** when false the keys are ignored (e.g. a dialog is open above the stage) */
  enabled?: () => boolean;
}

/**
 * Attach WASD/arrows + Shift-run + E/Space-interact to `window`.
 * Returns a detach function — LifeStage calls it in its effect cleanup.
 * Safe to call only while a roam scene is mounted; harmless otherwise.
 */
export function attachKeyboardRoam(opts: KeyboardRoamOptions): () => void {
  const down = new Set<string>();
  let interacted = false;

  const recompute = () => {
    let x = 0;
    let y = 0;
    if (down.has("KeyA") || down.has("ArrowLeft")) x -= 1;
    if (down.has("KeyD") || down.has("ArrowRight")) x += 1;
    if (down.has("KeyW") || down.has("ArrowUp")) y += 1;
    if (down.has("KeyS") || down.has("ArrowDown")) y -= 1;
    if (x !== 0 && y !== 0) {
      // diagonals keep full speed in the pressed direction, not √2×
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    const running = down.has("ShiftLeft") || down.has("ShiftRight");
    // walk = 0.75 (below the roam loop's 0.9 sprint line), run = 1.0
    const mag = running ? 1 : 0.75;
    opts.stick.current.x = x * mag;
    opts.stick.current.y = y * mag;
  };

  const isTypingTarget = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (!t) return false;
    const tag = t.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (opts.enabled && !opts.enabled()) return;
    if (isTypingTarget(e)) return;
    if (MOVE_KEYS.has(e.code)) {
      // arrows / space scroll the page — not while walking
      e.preventDefault();
      if (!down.has(e.code)) markKeyboardUsed();
      down.add(e.code);
      opts.onFirstKey?.();
      recompute();
      return;
    }
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
      down.add(e.code);
      recompute();
      return;
    }
    if ((e.code === "KeyE" || e.code === "Space") && !e.repeat) {
      e.preventDefault();
      interacted = true;
      opts.onInteract?.();
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
      down.delete(e.code);
      recompute();
      return;
    }
    if (MOVE_KEYS.has(e.code)) {
      down.delete(e.code);
      recompute();
    }
  };

  const onBlur = () => {
    // alt-tab with a key held must not leave the player walking forever
    if (down.size === 0) return;
    down.clear();
    opts.stick.current.x = 0;
    opts.stick.current.y = 0;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    opts.stick.current.x = 0;
    opts.stick.current.y = 0;
    void interacted;
  };
}
