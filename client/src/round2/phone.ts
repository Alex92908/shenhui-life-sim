/**
 * phone.ts — area (g): in-game phone fullscreen (round-2)
 *
 * The in-game phone (App.tsx ~6395) is a centred sheet: max-w-md,
 * max-h-[86vh], bottom-sheet on mobile. On a desktop browser that leaves
 * most of the screen empty while the player is doing phone-heavy things
 * (DMs, metro map, market). This module is the fullscreen half the
 * integration snippet in App.tsx uses:
 *
 *   - requestPhoneFullscreen(el): true browser fullscreen via the
 *     Fullscreen API (with webkit fallback), falling back to a CSS
 *     "expanded sheet" when the API refuses (e.g. inside an iframe).
 *   - exitPhoneFullscreen(): leaves browser fullscreen.
 *   - isPhoneFullscreen(): current state (also true while the browser
 *     reports a fullscreen element that is the phone sheet).
 *
 * The App.tsx snippet (ROUND2-LOG-g.md) adds the ⛶ expand button to the
 * phone header and a `phoneFull` state that swaps the sheet's Tailwind
 * classes to full-bleed (inset-0 p-0, panel h-full w-full max-w-none
 * rounded-none). This module holds only the Fullscreen API calls — no
 * React, no server calls. Esc already exits browser fullscreen natively;
 * App's existing map-fullscreen Esc handler is untouched.
 */

/** Ask the browser to make the phone sheet truly fullscreen. */
export async function requestPhoneFullscreen(el: HTMLElement | null): Promise<boolean> {
  if (!el) return false;
  try {
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      documentElement: HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    };
    const target = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (doc.fullscreenElement === el || doc.webkitFullscreenElement === el) return true;
    if (target.requestFullscreen) {
      await target.requestFullscreen();
      return true;
    }
    if (target.webkitRequestFullscreen) {
      await target.webkitRequestFullscreen();
      return true;
    }
    return false;
  } catch {
    // Fullscreen API refused (iframe permissions, user gesture rules) —
    // the caller falls back to the expanded-sheet classes instead.
    return false;
  }
}

export async function exitPhoneFullscreen(): Promise<boolean> {
  try {
    const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> };
    if (doc.fullscreenElement) {
      await doc.exitFullscreen();
      return true;
    }
    if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isPhoneFullscreen(): boolean {
  try {
    const doc = document as Document & { webkitFullscreenElement?: Element };
    return !!doc.fullscreenElement || !!doc.webkitFullscreenElement;
  } catch {
    return false;
  }
}

/**
 * Toggle: enter browser fullscreen if the sheet is not fullscreen, leave
 * it if it is. Returns true when the browser-fullscreen state changed;
 * false means the caller should use the expanded-sheet fallback.
 */
export async function togglePhoneFullscreen(el: HTMLElement | null): Promise<boolean> {
  if (isPhoneFullscreen()) return exitPhoneFullscreen();
  return requestPhoneFullscreen(el);
}
