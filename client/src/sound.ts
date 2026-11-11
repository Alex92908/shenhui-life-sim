/* 声音
   - 背景音乐：client/public/music/shenhui-music 里的 7 首授权曲子（CC-BY / CC0），按场景循环
   - 雨天在曲子下面再叠一层合成雨声
   - 音效仍是合成的：点按、进账、地铁开关门「叮咚」、到站
   - 曲子播不出来时才退回合成旋律
   - 音乐人投稿的歌（Livehouse）用 <audio> 播放，和背景音乐互斥
   默认打开：浏览器要求用户先点一下才能出声，所以第一次点屏幕时才响；玩家可以用 🔇 关掉（记住选择）。 */

export type SoundScene = "day" | "night" | "rain" | "club" | "scenic" | "citypop" | "piano" | "off";
/** the player's music choice: "auto" follows the moment (day / night / rain / club / scenic), anything else is fixed */
export type MusicPick = "auto" | Exclude<SoundScene, "off">;
export const MUSIC_PICKS: { id: MusicPick; emoji: string; zh: string; en: string }[] = [
  { id: "auto", emoji: "✨", zh: "自动（跟着时间、天气、地点换）", en: "Auto (follows time, weather, place)" },
  { id: "day", emoji: "☀️", zh: "白天 · 轻快", en: "Daytime · bright" },
  { id: "night", emoji: "🌙", zh: "夜晚 · lo-fi", en: "Night · lo-fi" },
  { id: "citypop", emoji: "🌆", zh: "城市流行 · City Pop", en: "City pop" },
  { id: "piano", emoji: "🎹", zh: "钢琴 · 安静", en: "Piano · calm" },
  { id: "rain", emoji: "🌧️", zh: "雨天 · 雨声", en: "Rainy · with rain" },
  { id: "club", emoji: "🪩", zh: "夜店舞曲", en: "Club beat" },
  { id: "scenic", emoji: "🌅", zh: "观景 · 宽广", en: "Scenic · wide" },
];
/** CC-BY / CC0 lines for the seven bundled tracks. Shown in the music menu. */
export const MUSIC_CREDITS: { id: Exclude<MusicPick, "auto">; zh: string; en: string }[] = [
  { id: "day", zh: "「Monkeys Spinning Monkeys」Kevin MacLeod（incompetech.com），CC-BY 3.0", en: "\"Monkeys Spinning Monkeys\" — Kevin MacLeod (incompetech.com), CC-BY 3.0" },
  { id: "night", zh: "「2 Hour Delay」HoliznaCC0，CC0 1.0（公有领域）", en: "\"2 Hour Delay\" — HoliznaCC0, CC0 1.0 (public domain)" },
  { id: "citypop", zh: "「Acid Jazz Cafe Groove With Electric Piano」Alex Morgan，CC-BY 4.0", en: "\"Acid Jazz Cafe Groove With Electric Piano\" by Alex Morgan, CC-BY 4.0" },
  { id: "piano", zh: "「Impromptu in Quarter Comma Meantone」Kevin MacLeod（incompetech.com），CC-BY 3.0", en: "\"Impromptu in Quarter Comma Meantone\" — Kevin MacLeod (incompetech.com), CC-BY 3.0" },
  { id: "rain", zh: "「Infinite Peace」Kevin MacLeod，CC0 1.0（公有领域）", en: "\"Infinite Peace\" — Kevin MacLeod, CC0 1.0 (public domain)" },
  { id: "club", zh: "「Werq」Kevin MacLeod（incompetech.com），CC-BY 4.0", en: "\"Werq\" — Kevin MacLeod (incompetech.com), CC-BY 4.0" },
  { id: "scenic", zh: "「Horizon Flare」Alexander Nakarada，CC-BY 4.0", en: "\"Horizon Flare\" by Alexander Nakarada, CC-BY 4.0" },
];
/** Extra CC-BY tracks from shenhui-sounds. Shown in the credits list, not as their own menu rows. */
export const EXTRA_CREDITS: { id: string; zh: string; en: string }[] = [
  { id: "day2", zh: "「Happy Whistling Ukulele」Rafael Krux，CC-BY 4.0", en: "\"Happy Whistling Ukulele\" by Rafael Krux, CC-BY 4.0" },
  { id: "night2", zh: "「Still Life」HoliznaCC0，CC0 1.0（公有领域）", en: "\"Still Life (Lofi, Chill, Nostalgic)\" — HoliznaCC0, CC0 1.0 (public domain)" },
  { id: "piano2", zh: "「Lovely Piano Song」Rafael Krux，CC-BY 4.0", en: "\"Lovely Piano Song\" by Rafael Krux, CC-BY 4.0" },
  { id: "ambient", zh: "「River Meditation」Jason Shaw（Audionautix），CC-BY 3.0", en: "\"River Meditation\" by Jason Shaw (Audionautix), CC-BY 3.0" },
  { id: "morning", zh: "「Adding the Sun」Kevin MacLeod（incompetech.com），CC-BY 4.0", en: "\"Adding the Sun\" — Kevin MacLeod (incompetech.com), CC-BY 4.0" },
  { id: "sunset", zh: "「Martini Sunset」Kevin MacLeod（incompetech.com），CC-BY 4.0", en: "\"Martini Sunset\" — Kevin MacLeod (incompetech.com), CC-BY 4.0" },
  { id: "k1", zh: "K 歌「Explode」Kellee Maize，CC-BY 3.0（说唱）", en: "Karaoke \"Explode\" by Kellee Maize, CC-BY 3.0 (rap)" },
  { id: "k2", zh: "K 歌「One Cute Leash」Geoff Peters，CC-BY 3.0（讲狗的俏皮歌）", en: "Karaoke \"One Cute Leash\" by Geoff Peters, CC-BY 3.0 (a song about a dog)" },
  { id: "k3", zh: "K 歌「I Wanna Know」Josh Woodward，CC-BY 4.0", en: "Karaoke \"I Wanna Know\" by Josh Woodward, CC-BY 4.0" },
  { id: "k4", zh: "K 歌「Procrastinating in the Sun」Stefan Kartenberg ft. Thespinwires，CC-BY 3.0", en: "Karaoke \"Procrastinating_in_The_Sun\" by Stefan Kartenberg ft. Thespinwires, CC-BY 3.0" },
  { id: "k5", zh: "K 歌「Silent Grey」Amarent，CC-BY 4.0", en: "Karaoke \"Silent Grey\" by Amarent, CC-BY 4.0" },
];
const PICK_KEY = "shhr-music";
let pick: MusicPick = (() => { try { const v = localStorage.getItem(PICK_KEY) as MusicPick | null; return v && MUSIC_PICKS.some((m) => m.id === v) ? v : "auto"; } catch { return "auto"; } })();
let wanted: SoundScene = "off";
export function musicPick(): MusicPick { return pick; }
export type Sfx = "click" | "coin" | "chime" | "arrive" | "fail" | "notify" | "door" | "horn" | "laugh" | "applause" | "cheer";
/** where the player is standing, for the ambience bed under the music */
export type PlaceTone = "sea" | "mountain" | "park" | "market" | "mall" | "crowd" | "street" | "home" | "indoor" | "social";
export type TravelTone = "still" | "walk" | "metro";

const KEY = "shhr-sound";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let scene: SoundScene = "off";
let timer: number | null = null;
let step = 0;
let rain: AudioBufferSourceNode | null = null;
let track: HTMLAudioElement | null = null;

export function soundWanted(): boolean { try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } }
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
  if (on) {
    const c = ensure();
    if (!c) return;
    if (c.state === "running") restartScene();
    else void c.resume().then(() => { if (soundWanted()) restartScene(); });
  } else { silenceTrack(); stopMusic(); void ctx?.suspend(); }
}
/** a later tap (after reload) wakes a previously enabled sound */
export function wakeSound() { if (soundWanted()) { const c = ensure(); if (c && c.state !== "running") void c.resume().then(restartScene); } }

/* ---- music ---- */
const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
// chord roots (MIDI) and qualities per scene: four-bar loops
const PROG: Record<Exclude<SoundScene, "off" | "club">, number[][]> = {
  citypop: [[65, 69, 72, 76], [64, 67, 71, 74], [62, 65, 69, 72], [67, 71, 74, 77]], // Fmaj7 Em7 Dm7 G7 — 80s city pop
  piano: [[60, 64, 67, 72], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]], // C G Am F — slow piano
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

/** one scheduler tick = one beat. Only used when the mp3 for this scene failed to play. */
function tick() {
  if (!ctx || !musicBus || scene === "off" || track || bedOn) return;
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
  const beat = scene === "night" ? 0.85 : scene === "rain" ? 1.0 : scene === "citypop" ? 0.5 : scene === "piano" ? 1.1 : 0.75;
  if (scene === "citypop") {
    // bouncing octave bass + offbeat hat under the chords
    const ch0 = prog[Math.floor(step / 4) % prog.length]![0]!;
    tone(NOTE(ch0 - 24), now, beat * 0.4, "triangle", 0.09, musicBus, 0.005);
    tone(NOTE(ch0 - 12), now + beat / 2, beat * 0.35, "triangle", 0.06, musicBus, 0.005);
    noiseHit(now + beat / 2, 0.04, 0.08, 8000);
    if (step % 2 === 1) noiseHit(now, 0.08, 0.1, 2000);
  }
  const chord = prog[Math.floor(step / 4) % prog.length]!;
  if (scene === "piano") {
    // arpeggiated chord, one note a beat, plus a soft bass on the bar
    if (step % 4 === 0) tone(NOTE(chord[0]! - 24), now, beat * 4, "sine", 0.06, musicBus, 0.02);
    const n = chord[step % 4]!;
    tone(NOTE(n), now, beat * 2.2, "triangle", 0.07, musicBus, 0.005);
    if (Math.random() < 0.35) tone(NOTE(n + 12), now + beat / 2, beat * 1.4, "sine", 0.035, musicBus, 0.005);
    step += 1;
    timer = window.setTimeout(tick, beat * 1000);
    return;
  }
  if (step % 4 === 0) for (const n of chord) tone(NOTE(n - 12), now, beat * 4.4, scene === "night" ? "triangle" : "sine", 0.05, musicBus, scene === "citypop" ? 0.05 : 0.4);
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
  const g = ctx.createGain(); g.gain.value = 0.28;
  rain.connect(f); f.connect(g); g.connect(musicBus); rain.start();
}
function stopSynth() {
  if (timer) { window.clearTimeout(timer); timer = null; }
  if (rain) { try { rain.stop(); } catch { /* already stopped */ } rain = null; }
}

/* ---- licensed beds in public/music/shenhui-music ----
   day.mp3 is written to loop. The other six fade out, so a second copy
   starts before the tail and the two gains cross. Rain noise stays underneath. */
const BED_FADE: Record<Exclude<SoundScene, "off">, number> = {
  day: 0, night: 2.2, citypop: 2.8, piano: 2.8, rain: 2.5, club: 7.3, scenic: 2.5,
};
interface Bed { el: HTMLAudioElement; gain: GainNode }
let beds: [Bed, Bed] | null = null;
let bedLead = 0;
let bedOn = false;
let bedGen = 0;
let bedWatch: number | null = null;
let bedFading = false;

function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "./";
  return `${base}${path.replace(/^\//, "")}`;
}
function musicUrl(id: Exclude<SoundScene, "off">): string {
  return publicUrl(`music/shenhui-music/${id}.mp3`);
}
function soundUrl(rel: string): string {
  return publicUrl(`music/shenhui-sounds/${rel}`);
}

interface WorldAudio {
  minute: number;
  day: number;
  month: number;
  place: PlaceTone;
  travel: TravelTone;
  storm: boolean;
  karaoke: boolean;
}
let world: WorldAudio = { minute: 12 * 60, day: 1, month: 11, place: "street", travel: "still", storm: false, karaoke: false };
let karaokeOn = false;
let currentBedUrl = "";
let currentCreditId = "";
let ambKey = "";

function bandOf(minute: number): "morning" | "day" | "sunset" | "night" {
  if (minute >= 5 * 60 && minute < 8 * 60 + 30) return "morning";
  if (minute >= 17 * 60 && minute < 19 * 60 + 30) return "sunset";
  if (minute >= 19 * 60 + 30 || minute < 5 * 60) return "night";
  return "day";
}
/** which file the current mood should play, including the second pack */
function resolveBed(sc: Exclude<SoundScene, "off">): { url: string; fade: number; credit: string } {
  const auto = pick === "auto";
  const alt = world.day % 2 === 1;
  const band = bandOf(world.minute);
  const extra = (file: string, credit: string, fade = 4) => ({ url: soundUrl(`music/${file}`), fade, credit });
  const first = (id: Exclude<SoundScene, "off">, credit: string) => ({ url: musicUrl(id), fade: BED_FADE[id], credit });
  if (sc === "day") {
    if (auto && band === "morning") return extra("bgm-morning.mp3", "morning");
    if (auto && band === "sunset") return extra("bgm-sunset.mp3", "sunset");
    if (auto && alt) return extra("bgm-day2.mp3", "day2");
    return first("day", "day");
  }
  if (sc === "night") return auto && alt ? extra("bgm-night2.mp3", "night2", 2.4) : first("night", "night");
  if (sc === "piano") return auto && alt ? extra("bgm-piano2.mp3", "piano2", 2.8) : first("piano", "piano");
  if (sc === "scenic") {
    if (auto && band === "sunset") return extra("bgm-sunset.mp3", "sunset");
    if (auto && band === "night") return extra("bgm-ambient2.mp3", "ambient");
    return first("scenic", "scenic");
  }
  if (sc === "rain") return first("rain", "rain");
  if (sc === "club") return first("club", "club");
  return first("citypop", "citypop");
}
export function nowPlayingCredit(): { zh: string; en: string } | null {
  if (karaokeOn) return { zh: "K 歌房：英文歌（曲目署名在下面）", en: "Karaoke room: English songs (credits below)" };
  const id = currentCreditId;
  const hit = MUSIC_CREDITS.find((c) => c.id === id) ?? EXTRA_CREDITS.find((c) => c.id === id);
  return hit ? { zh: hit.zh, en: hit.en } : null;
}
function rampGain(g: GainNode, to: number, dur: number) {
  if (!ctx) return;
  const now = ctx.currentTime;
  g.gain.cancelScheduledValues(now);
  g.gain.setValueAtTime(g.gain.value, now);
  g.gain.linearRampToValueAtTime(to, now + Math.max(0.05, dur));
}
function ensureBeds(): [Bed, Bed] | null {
  const c = ctx;
  if (!c || !musicBus) return null;
  if (beds) return beds;
  const mk = (): Bed => {
    const el = new Audio();
    el.preload = "auto";
    el.setAttribute("data-bgm", "1");
    el.style.display = "none";
    document.body.appendChild(el);
    const src = c.createMediaElementSource(el);
    const gain = c.createGain();
    gain.gain.value = 0;
    src.connect(gain); gain.connect(musicBus!);
    return { el, gain };
  };
  beds = [mk(), mk()];
  return beds;
}
function stopBed() {
  bedGen++;
  bedOn = false;
  bedFading = false;
  if (bedWatch) { window.clearInterval(bedWatch); bedWatch = null; }
  if (!beds) return;
  for (const b of beds) {
    b.el.pause();
    b.el.onended = null;
    if (ctx) { b.gain.gain.cancelScheduledValues(ctx.currentTime); b.gain.gain.setValueAtTime(0, ctx.currentTime); }
  }
}
function startBed(sc: Exclude<SoundScene, "off">) {
  const pair = ensureBeds();
  if (!pair || !ctx) return false;
  const gen = ++bedGen;
  const picked = resolveBed(sc);
  const fade = picked.fade;
  const url = picked.url;
  currentBedUrl = url;
  currentCreditId = picked.credit;
  bedLead = 0;
  bedFading = false;
  bedOn = true;
  if (bedWatch) { window.clearInterval(bedWatch); bedWatch = null; }
  for (const b of pair) {
    if (b.el.dataset.bed !== url) { b.el.dataset.bed = url; b.el.src = url; }
    b.el.loop = fade === 0;
    b.el.pause();
    b.gain.gain.cancelScheduledValues(ctx.currentTime);
    b.gain.gain.setValueAtTime(0, ctx.currentTime);
  }
  const lead = pair[0]!;
  lead.el.currentTime = 0;
  for (const b of pair) b.el.onended = () => {
    if (gen !== bedGen || bedFading || fade === 0 || b !== pair[bedLead]) return;
    b.el.currentTime = 0;
    void b.el.play().catch(() => { /* a missed crossfade just restarts this copy */ });
  };
  rampGain(lead.gain, 1, 0.4);
  void lead.el.play().then(() => {
    if (gen !== bedGen) return;
    if (fade <= 0) return;
    bedWatch = window.setInterval(() => {
      if (gen !== bedGen || bedFading || !ctx) return;
      const out = pair[bedLead]!;
      const inn = pair[1 - bedLead]!;
      const dur = out.el.duration;
      if (!Number.isFinite(dur) || dur < 8) return;
      const left = dur - out.el.currentTime;
      if (out.el.currentTime < 1 || left > fade) return;
      bedFading = true;
      inn.el.currentTime = 0;
      rampGain(inn.gain, 1, left);
      rampGain(out.gain, 0, left);
      const swap = window.setTimeout(() => {
        if (gen !== bedGen) return;
        out.el.pause();
        bedLead = 1 - bedLead;
        bedFading = false;
      }, left * 1000 + 80);
      void inn.el.play().catch(() => {
        window.clearTimeout(swap);
        out.el.loop = true;
        rampGain(out.gain, 1, 0.25);
        bedFading = false;
      });
    }, 250);
  }).catch(() => {
    if (gen !== bedGen) return;
    stopBed();
    step = 0;
    tick();
  });
  return true;
}
function stopMusic() {
  stopSynth();
  stopBed();
  pauseAmbience();
  stopThunder();
  if (karaokeEl) karaokeEl.pause();
}
function restartScene() {
  stopMusic();
  if (!soundOn() || scene === "off" || track) { pauseAmbience(); return; }
  step = 0;
  if (scene === "rain" && !karaokeOn) startRain();
  if (!karaokeOn && !startBed(scene)) tick();
  if (karaokeOn) { currentBedUrl = "karaoke"; currentCreditId = ""; ensureKaraokePlaying(); }
  applyAmbience();
  syncThunder();
}
/** the scene actually sounding right now ("off" when muted or before the first cue) */
export function musicScene(): SoundScene { return scene; }
/** which music fits right now: day / night / rain, or a scene (club, scenic moment) */
export function setScene(next: SoundScene) {
  wanted = next;
  const eff = next === "off" ? "off" : pick === "auto" ? next : pick;
  const url = eff === "off" ? "" : karaokeOn ? "karaoke" : resolveBed(eff).url;
  if (eff === scene && url === currentBedUrl) return;
  scene = eff;
  restartScene();
}
/** the player picked a music style (or "auto"): remembered, applied right away */
export function setMusicPick(p: MusicPick) {
  pick = p;
  try { localStorage.setItem(PICK_KEY, p); } catch { /* storage unavailable */ }
  const w = wanted; scene = "off"; setScene(w);
}

/* ---- ambience, thunder, karaoke (shenhui-sounds) ---- */
interface AmbBed { el: HTMLAudioElement; gain: GainNode }
let ambBeds: AmbBed[] = [];
let ambBus: GainNode | null = null;
let karaokeEl: HTMLAudioElement | null = null;
let karaokeGain: GainNode | null = null;
let karaokeIdx = 0;
const KARAOKE = ["karaoke-1.mp3", "karaoke-2.mp3", "karaoke-3.mp3", "karaoke-4.mp3", "karaoke-5.mp3"];
let thunderTimer: number | null = null;
let thunderEl: HTMLAudioElement | null = null;

function ambiencePlan(): { url: string; gain: number }[] {
  if (track) return [];
  const { place, travel, minute, month } = world;
  const band = bandOf(minute);
  const summer = month >= 5 && month <= 9;
  const outdoor = place === "sea" || place === "mountain" || place === "park" || place === "street";
  const one = (rel: string, gain: number) => [{ url: soundUrl(rel), gain }];
  if (travel === "metro") return one("sfx/city/metro-ambience.mp3", 0.9);
  if (karaokeOn) return one("sfx/voices/crowd-murmur.mp3", 0.32);
  if (world.storm) return one("sfx/nature/wind.mp3", 0.55);
  if (travel === "walk") return one("sfx/city/footsteps.mp3", 0.42);
  if (place === "sea") return [{ url: soundUrl("sfx/nature/ocean-waves.mp3"), gain: 0.62 }, { url: soundUrl("sfx/nature/seagulls.mp3"), gain: 0.34 }];
  if (place === "market") return one("sfx/city/market-ambience.mp3", 0.4);
  if (place === "mall") return one("sfx/city/crowd-street.mp3", 0.36);
  if (place === "crowd" || place === "social") return one("sfx/voices/crowd-murmur.mp3", 0.34);
  if (place === "home" || place === "indoor") return [];
  if (outdoor && band === "night") return one("sfx/nature/crickets-night.mp3", 0.42);
  if (outdoor && band === "morning") return one("sfx/nature/birds-morning.mp3", 0.4);
  if ((place === "park" || place === "mountain") && summer) return one("sfx/nature/cicadas.mp3", 0.36);
  if (place === "mountain") return one("sfx/nature/wind.mp3", 0.3);
  if (place === "park") return one("sfx/nature/birds-morning.mp3", 0.3);
  if (place === "street") return one("sfx/city/traffic-ambience.mp3", 0.26);
  return [];
}
function pauseAmbience() {
  for (const b of ambBeds) {
    b.el.pause();
    if (ctx) b.gain.gain.setValueAtTime(0, ctx.currentTime);
  }
  ambKey = "";
}
function applyAmbience() {
  if (!ctx || !master || !soundOn() || track) { pauseAmbience(); return; }
  if (!ambBus) { ambBus = ctx.createGain(); ambBus.gain.value = 0.22; ambBus.connect(master); }
  if (musicBus) rampGain(musicBus, world.travel === "metro" && !karaokeOn ? 0.16 : 0.32, 0.45);
  const plan = ambiencePlan();
  const key = plan.map((p) => `${p.url}@${p.gain}`).join("|");
  const playing = plan.length > 0 && plan.every((_, i) => ambBeds[i] && !ambBeds[i]!.el.paused);
  if (key === ambKey && playing) return;
  ambKey = key;
  while (ambBeds.length < Math.max(plan.length, 1)) {
    const el = new Audio();
    el.preload = "auto";
    el.loop = true;
    el.setAttribute("data-amb", "1");
    const src = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain); gain.connect(ambBus);
    ambBeds.push({ el, gain });
  }
  ambBeds.forEach((b, i) => {
    const p = plan[i];
    if (!p) { b.el.pause(); b.gain.gain.setValueAtTime(0, ctx!.currentTime); return; }
    if (b.el.dataset.src !== p.url) { b.el.dataset.src = p.url; b.el.src = p.url; b.el.currentTime = 0; }
    b.el.loop = true;
    rampGain(b.gain, p.gain, 0.7);
    if (b.el.paused) void b.el.play().catch(() => {});
  });
}
function stopThunder() {
  if (thunderTimer) { window.clearInterval(thunderTimer); thunderTimer = null; }
}
function syncThunder() {
  const on = soundOn() && world.storm && !track && !karaokeOn;
  if (!on) { stopThunder(); return; }
  if (thunderTimer) return;
  const boom = () => {
    if (!soundOn() || !world.storm || !ctx || !master) return;
    if (!thunderEl) {
      thunderEl = new Audio();
      thunderEl.setAttribute("data-thunder", "1");
      const src = ctx.createMediaElementSource(thunderEl);
      const g = ctx.createGain(); g.gain.value = 0.5; src.connect(g); g.connect(master);
    }
    thunderEl.src = soundUrl(Math.random() < 0.28 ? "sfx/nature/thunder-close.mp3" : "sfx/nature/thunder-distant.mp3");
    thunderEl.currentTime = 0;
    void thunderEl.play().catch(() => {});
  };
  thunderTimer = window.setInterval(boom, 24000);
  window.setTimeout(boom, 1600);
}
function ensureKaraokePlaying() {
  if (!ctx || !musicBus || !karaokeOn) return;
  if (!karaokeEl) {
    karaokeEl = new Audio();
    karaokeEl.preload = "auto";
    karaokeEl.setAttribute("data-karaoke", "1");
    const src = ctx.createMediaElementSource(karaokeEl);
    karaokeGain = ctx.createGain();
    karaokeGain.gain.value = 0;
    src.connect(karaokeGain); karaokeGain.connect(musicBus);
    karaokeEl.addEventListener("ended", () => {
      if (!karaokeOn) return;
      sfx("applause");
      karaokeIdx = (karaokeIdx + 1) % KARAOKE.length;
      const el = karaokeEl;
      if (!el) return;
      el.src = soundUrl(`music/karaoke/${KARAOKE[karaokeIdx]!}`);
      el.currentTime = 0;
      if (karaokeGain) rampGain(karaokeGain, 1, 0.35);
      void el.play().catch(() => {});
    });
  }
  if (!karaokeEl.paused && karaokeEl.src.includes("/karaoke-")) return;
  karaokeEl.src = soundUrl(`music/karaoke/${KARAOKE[karaokeIdx]!}`);
  karaokeEl.currentTime = 0;
  if (karaokeGain) rampGain(karaokeGain, 1, 0.4);
  void karaokeEl.play().catch(() => {});
}
function stopKaraoke() {
  karaokeOn = false;
  if (!karaokeEl) return;
  karaokeEl.pause();
  if (karaokeGain && ctx) karaokeGain.gain.setValueAtTime(0, ctx.currentTime);
}
export function setWorld(next: { scene: SoundScene; minute: number; day: number; month: number; place: PlaceTone; travel: TravelTone; storm: boolean; karaoke: boolean }) {
  world = { minute: next.minute, day: next.day, month: next.month, place: next.place, travel: next.travel, storm: next.storm, karaoke: next.karaoke };
  if (!next.karaoke && karaokeOn) stopKaraoke();
  karaokeOn = next.karaoke;
  setScene(next.scene);
  if (karaokeOn) ensureKaraokePlaying();
  applyAmbience();
  syncThunder();
}

/* ---- effects ---- */
const SFX_FILE: Partial<Record<Sfx, string>> = {
  click: "sfx/ui/click.mp3",
  coin: "sfx/ui/coin.mp3",
  arrive: "sfx/ui/success.mp3",
  notify: "sfx/ui/notification.mp3",
  door: "sfx/ui/door.mp3",
  horn: "sfx/city/car-horn.mp3",
  laugh: "sfx/voices/laughter.mp3",
  applause: "sfx/voices/applause.mp3",
  cheer: "sfx/voices/cheering.mp3",
};
let sfxPool: HTMLAudioElement[] = [];
let sfxCursor = 0;
let lastSfxAt = 0;
function playSfxFile(name: Sfx): boolean {
  const rel = SFX_FILE[name];
  if (!rel || !ctx || !master) return false;
  if (name === "click" && performance.now() - lastSfxAt < 40) return true;
  if (name === "click") lastSfxAt = performance.now();
  if (sfxPool.length === 0) {
    for (let i = 0; i < 4; i++) {
      const el = new Audio();
      el.preload = "auto";
      el.setAttribute("data-sfx", "1");
      const src = ctx.createMediaElementSource(el);
      const g = ctx.createGain();
      g.gain.value = name === "cheer" || name === "applause" ? 0.55 : 0.85;
      src.connect(g); g.connect(master);
      sfxPool.push(el);
    }
  }
  const el = sfxPool[sfxCursor++ % sfxPool.length]!;
  el.src = soundUrl(rel);
  el.currentTime = 0;
  void el.play().catch(() => {});
  return true;
}
export function sfx(name: Sfx) {
  if (!soundOn() || !ctx || !master) return;
  if (playSfxFile(name)) return;
  const t = ctx.currentTime + 0.01;
  if (name === "click") tone(1250, t, 0.06, "sine", 0.08, master, 0.003);
  else if (name === "coin") { tone(NOTE(88), t, 0.12, "square", 0.05, master, 0.003); tone(NOTE(93), t + 0.08, 0.32, "square", 0.05, master, 0.003); }
  else if (name === "chime") { tone(NOTE(76), t, 0.6, "sine", 0.18, master, 0.005); tone(NOTE(72), t + 0.32, 0.9, "sine", 0.18, master, 0.005); } // 地铁开门「叮—咚」，包里没有这声
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
function silenceTrack() {
  if (!track) return;
  track.pause();
  track.src = "";
  track = null;
}
export function stopTrack() {
  if (!track) return;
  silenceTrack();
  restartScene();
}
export function trackPlaying(): boolean { return !!track && !track.paused; }
