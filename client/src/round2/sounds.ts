/**
 * sounds.ts — area (g): per-NPC voices (round-2)
 *
 * The user asked (2026-11-11) for every NPC to speak in a different voice /
 * tone （每个人都要不同声调说话）. No voice system exists in the code at all
 * (no speechSynthesis anywhere), and recording real voice lines for every
 * NPC is not feasible — so this module synthesizes the difference:
 *
 *   PRIMARY — Animal Crossing-style vocal blips (works offline, no assets):
 *   a short pitched blip per syllable while dialogue text is on screen,
 *   with a DISTINCT pitch / rate / waveform / vibrato per NPC, derived
 *   deterministically from the NPC's id or name. The same NPC always sounds
 *   the same; two NPCs never (measurably) sound alike.
 *
 *   OPTIONAL ENHANCEMENT — Web Speech API: where the browser has it, the
 *   same per-NPC profile drives speechSynthesis pitch/rate, so the actual
 *   line is spoken in that NPC's tone. Off by default; the player picks it
 *   in settings (persisted in localStorage). Blips stay the default because
 *   they work everywhere, including offline and on browsers with no voices.
 *
 * Wiring: LifeStage.tsx plays blips when its `talkText`/`talkVoiceId` props
 * change (venue dialogue bubble). App.tsx's runVenueTalk / openNpcChat call
 * `playNpcVoice(name, line)` directly — see ROUND2-LOG-g.md for the snippet.
 * This module never imports LifeStage (no cycle); it reads sound.ts only
 * for the mute preference.
 */

import { soundWanted } from "../sound";

export type VoiceMode = "blips" | "speech" | "off";

export const VOICE_MODES: { id: VoiceMode; zh: string; en: string }[] = [
  { id: "blips", zh: "气泡音（默认，离线可用）", en: "Vocal blips (default, works offline)" },
  { id: "speech", zh: "真人语音合成（浏览器支持时）", en: "Spoken voice (when the browser supports it)" },
  { id: "off", zh: "静音", en: "Silent" },
];

const VOICE_KEY = "shhr-voice";

export function voiceMode(): VoiceMode {
  try {
    const v = localStorage.getItem(VOICE_KEY) as VoiceMode | null;
    if (v === "blips" || v === "speech" || v === "off") return v;
  } catch {
    /* storage unavailable */
  }
  return "blips";
}

export function setVoiceMode(m: VoiceMode) {
  try {
    localStorage.setItem(VOICE_KEY, m);
  } catch {
    /* storage unavailable */
  }
  if (m !== "blips") stopNpcVoice();
}

/** Everything that makes one NPC sound different from another. */
export interface VoiceProfile {
  /** centre pitch of the blips, Hz — 120 (low uncle) … 320 (bright kid) */
  baseHz: number;
  /** blips per second — slow drawl … fast chatter */
  rate: number;
  /** oscillator colour — sine is soft, triangle is clear, square is buzzy */
  wave: OscillatorType;
  /** how much the pitch wobbles inside a line (0 = flat, 1 = singsong) */
  wobble: number;
  /** blip length in seconds */
  blipMs: number;
  /** speechSynthesis pitch 0.5…2, derived from the same hash */
  speechPitch: number;
  /** speechSynthesis rate 0.8…1.3 */
  speechRate: number;
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const WAVES: OscillatorType[] = ["sine", "triangle", "sine", "triangle", "square", "sawtooth"];

/**
 * Deterministic per-NPC profile: same id → same voice, every session,
 * no stored data. The id should be the NPC's stable identity (name or id
 * from data.ts) — never a real person's name, phone or handle; game
 * avatars only.
 */
export function voiceProfileFor(id: string): VoiceProfile {
  const h = hashId(id || "???");
  const pick = (n: number) => (h >> (n % 24)) & 0xff;
  const baseHz = 120 + (pick(0) % 200); // 120…319
  const rate = 5.5 + (pick(3) % 50) / 10; // 5.5…10.4 blips/sec
  const wave = WAVES[pick(6) % WAVES.length]!;
  const wobble = (pick(9) % 100) / 100; // 0…0.99
  const blipMs = 0.055 + (pick(12) % 40) / 1000; // 55…94ms
  const speechPitch = Math.min(2, Math.max(0.5, baseHz / 160));
  const speechRate = 0.85 + (pick(15) % 40) / 100; // 0.85…1.24
  return { baseHz, rate, wave, wobble, blipMs, speechPitch, speechRate };
}

/* ---- blips (primary) ---- */

let blipCtx: AudioContext | null = null;
let blipGain: GainNode | null = null;
let blipTimer: number | null = null;
let blipOsc: OscillatorNode | null = null;

function ensureBlipCtx(): AudioContext | null {
  if (blipCtx) return blipCtx;
  const AC =
    (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  blipCtx = new AC();
  blipGain = blipCtx.createGain();
  blipGain.gain.value = 0.16;
  blipGain.connect(blipCtx.destination);
  return blipCtx;
}

export function stopNpcVoice() {
  if (blipTimer) {
    window.clearInterval(blipTimer);
    blipTimer = null;
  }
  if (blipOsc) {
    try {
      blipOsc.stop();
    } catch {
      /* already stopped */
    }
    blipOsc = null;
  }
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* no speech synthesis */
  }
}

/**
 * Blip one line of dialogue in an NPC's voice. Chinese text blips per
 * character, Latin text per word — either way the rhythm follows the line.
 * Stops itself when the line is done; call stopNpcVoice() to cut it short
 * (e.g. the dialogue bubble closed).
 */
export function playBlips(id: string, text: string) {
  if (!soundWanted() || !text) return;
  const ctx = ensureBlipCtx();
  if (!ctx || !blipGain) return;
  if (ctx.state !== "running") void ctx.resume().catch(() => {});
  stopNpcVoice();
  const p = voiceProfileFor(id);
  // chunk the line so the blips track its length: CJK = per char, else words
  const chunks = /[\u4e00-\u9fff]/.test(text) ? [...text] : text.split(/\s+/).filter(Boolean);
  const units = chunks.filter((c) => !/^[，。、；：！？,.!?…\s]+$/.test(c));
  if (units.length === 0) return;
  const stepMs = 1000 / p.rate;
  let i = 0;
  let pitch = p.baseHz;
  const blip = () => {
    if (i >= units.length || !ctx || !blipGain) {
      stopNpcVoice();
      return;
    }
    const unit = units[i]!;
    i++;
    // pitch walks: mostly near base, sometimes jumps for emphasis
    const jump = Math.random() < 0.14 ? (Math.random() - 0.5) * p.baseHz * 0.55 : 0;
    const target = p.baseHz + Math.sin(i * 0.9) * p.baseHz * 0.16 * p.wobble + jump;
    pitch += (target - pitch) * 0.55;
    const dur = p.blipMs * (unit.length > 1 ? 1.35 : 1);
    const now = ctx.currentTime + 0.005;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = p.wave;
    o.frequency.setValueAtTime(Math.max(60, pitch), now);
    o.frequency.linearRampToValueAtTime(Math.max(60, pitch * (1 + 0.06 * p.wobble)), now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(1, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g);
    g.connect(blipGain);
    o.start(now);
    o.stop(now + dur + 0.02);
    blipOsc = o;
  };
  blip();
  blipTimer = window.setInterval(blip, stepMs);
}

/* ---- speech synthesis (optional enhancement) ---- */

export function speechSupported(): boolean {
  try {
    return typeof window !== "undefined" && "speechSynthesis" in window && !!window.speechSynthesis;
  } catch {
    return false;
  }
}

export function playSpeech(id: string, text: string, lang: "zh-CN" | "en-US" = "zh-CN") {
  if (!soundWanted() || !text || !speechSupported()) {
    playBlips(id, text);
    return;
  }
  const p = voiceProfileFor(id);
  stopNpcVoice();
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.pitch = p.speechPitch;
    u.rate = p.speechRate;
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.lang?.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
    if (match) u.voice = match;
    window.speechSynthesis.speak(u);
  } catch {
    playBlips(id, text);
  }
}

/**
 * Speak a line in an NPC's voice, in the player's chosen mode.
 * "speech" falls back to blips when the browser has no synthesis;
 * "off" stays silent.
 */
export function playNpcVoice(id: string, text: string, lang: "zh-CN" | "en-US" = "zh-CN") {
  const mode = voiceMode();
  if (mode === "off") return;
  if (mode === "speech") playSpeech(id, text, lang);
  else playBlips(id, text);
}
