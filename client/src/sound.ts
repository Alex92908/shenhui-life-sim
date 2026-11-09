/* 声音：全部在浏览器里实时合成（WebAudio），没有音频文件、没有版权问题。
   - 环境音乐：白天明亮、夜晚 lo-fi、雨天加雨声；夜店场景是四四拍舞曲
   - 音效：点按、进账、地铁开关门「叮咚」、到站
   - 音乐人投稿的歌（Livehouse）用 <audio> 播放，和合成音乐互斥
   默认关闭：浏览器和微信都要求用户先点一下才能出声。 */

export type SoundScene = "day" | "night" | "rain" | "club" | "scenic" | "off";
export type Sfx = "click" | "coin" | "chime" | "arrive" | "fail";

const KEY = "shhr-sound";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let scene: SoundScene = "off";
let timer: number | null = null;
let step = 0;
let rain: AudioBufferSourceNode | null = null;
let track: HTMLAudioElement | null = null;

export function soundWanted(): boolean { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } }
export function soundOn(): boolean { return !!ctx && ctx.state === "running" && soundWanted(); }

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
  return ctx;
}

/** call from a tap: turns sound on (and remembers it) or off */
export function setSound(on: boolean) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* storage unavailable */ }
  if (on) { const c = ensure(); void c?.resume(); restartScene(); }
  else { stopMusic(); stopTrack(); void ctx?.suspend(); }
}
/** a later tap (after reload) wakes a previously enabled sound */
export function wakeSound() { if (soundWanted()) { const c = ensure(); if (c && c.state !== "running") void c.resume().then(restartScene); } }

/* ---- music ---- */
const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
// chord roots (MIDI) and qualities per scene: four-bar loops
const PROG: Record<Exclude<SoundScene, "off" | "club">, number[][]> = {
  day: [[60, 64, 67, 71], [57, 60, 64, 67], [65, 69, 72, 76], [67, 71, 74, 77]], // Cmaj7 Am7 Fmaj7 G7
  night: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 58, 62, 65], [52, 55, 59, 62]], // Am7 Fmaj7 Gm7 Em7 — lo-fi
  rain: [[50, 53, 57, 60], [55, 58, 62, 65], [48, 52, 55, 59], [53, 57, 60, 64]],
  scenic: [[62, 66, 69, 73], [59, 62, 66, 69], [55, 59, 62, 66], [57, 61, 64, 68]], // D major, wide and warm
};
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];

function tone(freq: number, at: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, attack = 0.02) {
  if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g); g.connect(dest);
  o.start(at); o.stop(at + dur + 0.05);
}
function noiseHit(at: number, dur: number, vol: number, hp: number) {
  if (!ctx || !musicBus) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(musicBus); src.start(at);
}
function kick(at: number) {
  if (!ctx || !musicBus) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.frequency.setValueAtTime(140, at); o.frequency.exponentialRampToValueAtTime(42, at + 0.18);
  g.gain.setValueAtTime(0.9, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.32);
  o.connect(g); g.connect(musicBus); o.start(at); o.stop(at + 0.35);
}

/** one scheduler tick = one beat */
function tick() {
  if (!ctx || !musicBus || scene === "off" || track) return;
  const now = ctx.currentTime + 0.05;
  if (scene === "club") {
    const beat = 60 / 122;
    const bar = Math.floor(step / 4) % 4; const b = step % 4;
    kick(now);
    noiseHit(now + beat / 2, 0.05, 0.18, 7000); // off-beat hat
    if (b === 1 || b === 3) noiseHit(now, 0.12, 0.22, 1800); // clap
    const roots = [45, 41, 43, 40];
    tone(NOTE(roots[bar]!), now + beat / 2, beat * 0.45, "sawtooth", 0.06, musicBus, 0.005);
    if (b === 0) { for (const n of [0, 3, 7]) tone(NOTE(roots[bar]! + 24 + n), now, beat * 3.6, "triangle", 0.035, musicBus, 0.08); }
    step += 1;
    timer = window.setTimeout(tick, beat * 1000);
    return;
  }
  const prog = PROG[scene];
  const beat = scene === "night" ? 0.85 : scene === "rain" ? 1.0 : 0.75;
  const chord = prog[Math.floor(step / 4) % prog.length]!;
  if (step % 4 === 0) for (const n of chord) tone(NOTE(n - 12), now, beat * 4.4, scene === "night" ? "triangle" : "sine", 0.05, musicBus, 0.4);
  // a soft melody note most beats, from the chord's pentatonic
  if (Math.random() < (scene === "night" ? 0.55 : 0.7)) {
    const n = chord[0]! + 12 + PENTA[Math.floor(Math.random() * PENTA.length)]!;
    tone(NOTE(n), now + (Math.random() < 0.3 ? beat / 2 : 0), beat * 1.6, scene === "night" ? "triangle" : "sine", 0.045, musicBus, 0.01);
  }
  if (scene === "night" && step % 2 === 0) noiseHit(now, 0.03, 0.05, 6000); // lo-fi crackle hat
  step += 1;
  timer = window.setTimeout(tick, beat * 1000);
}
function startRain() {
  if (!ctx || !musicBus || rain) return;
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  rain = ctx.createBufferSource(); rain.buffer = buf; rain.loop = true;
  const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1400;
  const g = ctx.createGain(); g.gain.value = 0.16;
  rain.connect(f); f.connect(g); g.connect(musicBus); rain.start();
}
function stopMusic() {
  if (timer) { window.clearTimeout(timer); timer = null; }
  if (rain) { try { rain.stop(); } catch { /* already stopped */ } rain = null; }
}
function restartScene() {
  stopMusic();
  if (!soundOn() || scene === "off") return;
  step = 0;
  if (scene === "rain") startRain();
  tick();
}
/** which music fits right now: day / night / rain, or a scene (club, scenic moment) */
export function setScene(next: SoundScene) {
  if (next === scene) return;
  scene = next;
  restartScene();
}

/* ---- effects ---- */
export function sfx(name: Sfx) {
  if (!soundOn() || !ctx || !master) return;
  const t = ctx.currentTime + 0.01;
  if (name === "click") tone(1250, t, 0.06, "sine", 0.08, master, 0.003);
  else if (name === "coin") { tone(NOTE(88), t, 0.12, "square", 0.05, master, 0.003); tone(NOTE(93), t + 0.08, 0.32, "square", 0.05, master, 0.003); }
  else if (name === "chime") { tone(NOTE(76), t, 0.6, "sine", 0.18, master, 0.005); tone(NOTE(72), t + 0.32, 0.9, "sine", 0.18, master, 0.005); } // 地铁开门「叮—咚」
  else if (name === "arrive") { for (const [i, n] of [72, 76, 79, 84].entries()) tone(NOTE(n), t + i * 0.09, 0.35, "triangle", 0.09, master, 0.005); }
  else if (name === "fail") { tone(NOTE(55), t, 0.25, "sawtooth", 0.05, master, 0.005); tone(NOTE(52), t + 0.16, 0.35, "sawtooth", 0.05, master, 0.005); }
}

/* ---- a real song (Livehouse): plays instead of the synth, from a given second ---- */
export function playTrack(url: string, offsetSec: number, onEnd?: () => void) {
  stopTrack();
  if (!soundOn()) return;
  stopMusic();
  track = new Audio(url);
  track.volume = 0.7;
  track.addEventListener("loadedmetadata", () => { if (track && offsetSec < track.duration) track.currentTime = offsetSec; });
  track.addEventListener("ended", () => { track = null; onEnd?.(); restartScene(); });
  void track.play().catch(() => { track = null; restartScene(); });
}
export function stopTrack() {
  if (track) { track.pause(); track = null; restartScene(); }
}
export function trackPlaying(): boolean { return !!track && !track.paused; }
