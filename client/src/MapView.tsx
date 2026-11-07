// PC high-end 3D map: a real Three.js low-poly miniature of Shenzhen /
// Huizhou. Locations sit at their real geographic bearings (airport NW,
// Shekou SW, Futian centre, Dameisha far east; Huicheng NW, Daya Bay and
// Shuangyue Bay along the southern coast), joined by the real road
// corridors (深南大道 / 滨海大道 / 北环大道 / 惠州大道 / 沿海高速 …) rendered
// as raised roadways with moving traffic. Desktop rendering: shadow-mapped
// sun, a slow day–night cycle with lit windows at dusk, instanced filler
// buildings and trees, animated bay water, orbit + zoom camera that follows
// the player. Clicking a building (or its label chip) walks there.
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { createLandmarks, mergeStatic } from "./landmarks";
import { LOC_EN, NPCS, getLocations, resolveLoc, placesForCity, PLACE_KINDS, stationLocId, metroLinesForCity, modeById, outfitOf, type CityKey, type TransportModeId } from "./data";
import { makePostFx, type PostFx } from "./postfx";

export interface RemotePlayer {
  id: string;
  name: string;
  emoji: string;
  color: number;
  locId: string;
}

interface Props {
  cityKey: CityKey;
  selfLocId: string;
  /** 省电画质（手机 / 低配）：1x 像素、无阴影、无后期、树更少。只在建图时读取。 */
  lite?: boolean;
  selfEmoji: string;
  selfColor: number;
  selfName: string;
  remotePlayers: RemotePlayer[];
  selfOutfitId?: string;
  travelModeId?: string;
  npcMoodEmoji?: Record<string, string>;
  /** Real current weather kind for the played city (from the server's
      live weather action): clear | partly | cloudy | overcast | fog |
      rain | storm | unknown. Drives cloud cover, grey skies and rain. */
  weatherKind?: string;
  apecDay: boolean;
  onSelect: (locId: string) => void;
  /** Search focus: when focusNonce changes, the camera pans to focusLocId
      for a few seconds so a searched place is actually shown on the map. */
  focusLocId?: string;
  /** Focus a raw map point instead (e.g. a metro station with no location). */
  focusX?: number;
  focusZ?: number;
  focusNonce?: number;
  /** The place the player has selected / is heading to: drawn on the
      minimap as the pulsing destination marker while it differs from
      where the player figure currently stands. */
  destLocId?: string;
  /** Extra UI floated over the 3D map (the 出行导航 panel lives in App).
      Rendered only in the WebGL view — the list fallback has its own
      built-in location list, so the overlay would duplicate it there. */
  navOverlay?: ReactNode;
  /** Fullscreen mode: the map fills its (fixed, viewport-sized) parent
      instead of using the fixed responsive heights. */
  fill?: boolean;
  /** True while a full-screen overlay (life-stage / ride scenes, which run
      their own WebGL scene) covers the map: the frame loop keeps ticking
      but skips simulation + rendering so two 3D scenes never render at once. */
  paused?: boolean;
}

interface Actor {
  key: string;
  name: string;
  emoji: string;
  color: number;
  x: number;
  z: number;
  tx: number;
  tz: number;
  isSelf?: boolean;
  wander?: boolean;
  shirt: number;
  pants: number;
  accessory: string;
  behavior: string;
  speed: number;
  seed: number;
  heading: number;
  phase: number;
  blend: number;
  /** 0..1 seated-on-vehicle blend (player only); rideMode remembers the
      vehicle so the pose can ease out after stopping */
  rideBlend?: number;
  rideMode?: string;
}

interface Road {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  w: number;
  name?: string;
  lx?: number;
  lz?: number;
}

const ROADS: Record<CityKey, Road[]> = {
  sz: [
    { x1: -37, z1: 9, x2: 37, z2: 9, w: 2.8, name: "滨海大道", lx: -25, lz: 9 },
    { x1: -37, z1: -1, x2: 31, z2: -1, w: 2.8, name: "深南大道", lx: 13, lz: -1 },
    { x1: -37, z1: -10, x2: 25, z2: -10, w: 2.3, name: "北环大道", lx: -15, lz: -10 },
    { x1: -17, z1: -17, x2: -17, z2: 12, w: 2.1, name: "南海大道", lx: -17, lz: -13 },
    { x1: 1, z1: -20, x2: 1, z2: 7, w: 2.1, name: "南坪快速", lx: 1, lz: -18.4 },
    { x1: -11, z1: -17, x2: -11, z2: 10, w: 1.8 },
    { x1: 8, z1: -14, x2: 8, z2: 9, w: 1.8 },
    { x1: -37, z1: -8, x2: -22, z2: -3, w: 2, name: "机场高速", lx: -31, lz: -6.4 },
    { x1: 15, z1: -2, x2: 37, z2: 7, w: 2.3, name: "深盐路 · 沿海高速", lx: 27, lz: 3.4 },
    { x1: -4, z1: -20, x2: -4, z2: 9, w: 1.6 },
    { x1: -37, z1: 3.5, x2: 37, z2: 3.5, w: 1.5 },
  ],
  hz: [
    { x1: -31, z1: -7, x2: 17, z2: -7, w: 2.5, name: "惠州大道", lx: -21, lz: -7 },
    { x1: -8, z1: -20, x2: -8, z2: 11, w: 2.1, name: "演达大道", lx: -8, lz: -17.6 },
    { x1: -31, z1: -3, x2: -8, z2: -3, w: 2, name: "仲恺大道", lx: -24, lz: -3 },
    { x1: -4, z1: 12.5, x2: 37, z2: 12.5, w: 2.3, name: "沿海旅游公路", lx: 19, lz: 12.5 },
    { x1: -2, z1: 17, x2: 25, z2: 4, w: 2.3, name: "惠深沿海高速", lx: 9, lz: 12.8 },
    { x1: -14, z1: -20, x2: 12, z2: -11, w: 1.7, name: "金山大道", lx: -2, lz: -16.8 },
    { x1: -20, z1: -14, x2: -8, z2: -7, w: 1.6 },
    { x1: 2, z1: -11, x2: 2, z2: 12, w: 1.7 },
    { x1: -31, z1: 2, x2: 22, z2: 2, w: 1.5 },
  ],
};

/* ---- terrain: the real ranges, as low-poly cone clusters ----
   Shenzhen is not a flat board: 梧桐山 (943.7m, the city's highest peak)
   rises behind Luohu/Yantian, 莲花山/塘朗山/阳台山/凤凰山 rib the built-up
   area, 大南山 drops into Shenzhen Bay at Shekou and the Dapeng peninsula
   hills run down the east coast. Huizhou is ringed by 罗浮山 (飞云顶
   1296m), 南昆山 and 象头山. Peaks sit clear of location buildings; the
   filler/trees placement below keeps their slopes empty. */
interface Peak { x: number; z: number; h: number; r: number; rock?: boolean }
interface MountainRange { peaks: Peak[]; label?: string; lx?: number; lz?: number; ly?: number }
const MOUNTAINS: Record<CityKey, MountainRange[]> = {
  sz: [
    { peaks: [{ x: 23, z: -18.5, h: 8.2, r: 4.6 }, { x: 26.5, z: -16, h: 5.4, r: 3.1 }, { x: 19.5, z: -16.5, h: 4.2, r: 2.6, rock: true }], label: "⛰️ 梧桐山 943.7m · 深圳第一峰", lx: 23, lz: -18.5, ly: 9.6 },
    { peaks: [{ x: -4.5, z: -17.5, h: 2.6, r: 2.6 }] },
    { peaks: [{ x: -9.5, z: -16, h: 3.6, r: 2.8 }] },
    { peaks: [{ x: 7, z: -21, h: 4.4, r: 3.4 }] },
    { peaks: [{ x: -26, z: -17, h: 3.8, r: 3.2 }] },
    { peaks: [{ x: -27, z: 17, h: 3.4, r: 3 }] },
    { peaks: [{ x: 30, z: -9, h: 3.6, r: 3 }, { x: 36, z: 2, h: 4, r: 3, rock: true }, { x: 28, z: 14, h: 2.2, r: 2.4 }] },
    { peaks: [{ x: 30.5, z: 18, h: 5, r: 3 }, { x: 27, z: 19.5, h: 3.2, r: 2.2 }], label: "⛰️ 七娘山 869m · 深圳第二峰", lx: 30.5, lz: 18, ly: 6.2 },
    { peaks: [{ x: -33, z: -19, h: 3.4, r: 2.8 }, { x: 16, z: -21.5, h: 3, r: 2.6 }] },
  ],
  hz: [
    { peaks: [{ x: -28.5, z: -17.5, h: 7.6, r: 3.9 }, { x: -24, z: -19, h: 5, r: 2.8 }, { x: -32, z: -14.5, h: 4.2, r: 2.6, rock: true }], label: "⛰️ 罗浮山 1296m · 道教名山", lx: -28.5, lz: -17.5, ly: 9 },
    { peaks: [{ x: -33, z: -20, h: 6, r: 3.2 }], label: "⛰️ 南昆山 · 北回归线绿洲", lx: -33, lz: -20, ly: 7.4 },
    { peaks: [{ x: -17, z: -18, h: 4.6, r: 3 }] },
    { peaks: [{ x: 28, z: 17, h: 3.2, r: 2.6 }, { x: 35, z: 17.5, h: 2.6, r: 2.2 }] },
    { peaks: [{ x: -24, z: 12, h: 2.4, r: 2.4 }, { x: 6, z: -19, h: 3, r: 2.6 }] },
  ],
};

/* Reservoirs and lakes drawn as real water patches in the miniature:
   Shenzhen's 梅林/西丽/铁岗 reservoirs, Huizhou's 红花湖 and 西湖补水面. */
const LAKES: Record<CityKey, { x: number; z: number; r: number }[]> = {
  sz: [
    { x: -2, z: -16.8, r: 2.6 },
    { x: -13.5, z: -12.5, r: 2.2 },
    { x: -24, z: -9.5, r: 2.4 },
    { x: 18, z: 12, r: 1.8 },
  ],
  hz: [
    { x: -18.5, z: 4.8, r: 2.8 },
    { x: -15.5, z: 3.2, r: 1.9 },
    { x: 14, z: -14, r: 2.2 },
  ],
};

const LAND = 0.6; // land deck height; buildings sit on it
const WORLD = { x: 38, zn: -22, zs: 24 };

/* ---- fill-the-frame camera framing ----
   The miniature spans x −38…38 and z −22…~17 (coast). The camera must be
   framed FROM those bounds and the canvas aspect, not from a fixed
   distance: a fixed dist that filled a normal window left the city as a
   small island in the top half of a fullscreen viewport, with the whole
   bottom half empty sea. CAM_POL is the default polar angle — flatter
   (more top-down) than the old 0.92 so the foreground water strip shrinks
   and the land itself becomes the picture. fitDistForAspect returns the
   distance at which the land fills the frame (height nearly full, width
   allowed a slight crop so a wide-but-short stage still fills vertically
   instead of floating in a sea of background). */
const CAM_POL = 0.68;
const LAND_CX = 0;
const LAND_CZ = -2.5;
function fitDistForAspect(aspect: number): number {
  const tanV = Math.tan(THREE.MathUtils.degToRad(42) / 2);
  const projH = 47 * Math.sin(CAM_POL) + 7; // land depth projected + headroom for towers/labels
  const projW = 79 * 0.94; // land width projected at the default azimuth
  const distH = (projH / 2) / tanV;
  const distW = (projW / 2) / (tanV * Math.max(0.45, aspect));
  return THREE.MathUtils.clamp(Math.max(distH * 1.03, distW * 0.84), 30, 110);
}

function coastZ(cityKey: CityKey, x: number): number {
  if (cityKey === "sz") return 16.6 + Math.sin(x * 0.1) * 1.1 + Math.sin(x * 0.23 + 1.7) * 0.7;
  return 14.6 + Math.sin(x * 0.09 + 2) * 1.2 + Math.sin(x * 0.21 + 0.6) * 0.7;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function windowsTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#101418";
  g.fillRect(0, 0, 64, 128);
  const rnd = mulberry(42);
  for (let y = 6; y < 122; y += 10) {
    for (let x = 6; x < 58; x += 10) {
      const lit = rnd();
      g.fillStyle = lit > 0.45 ? "#ffd98a" : "#2b3644";
      g.fillRect(x, y, 6, 6);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function glowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function emojiSprite(emoji: string, ring: number): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.beginPath();
  g.arc(48, 48, 42, 0, Math.PI * 2);
  g.fillStyle = `#${ring.toString(16).padStart(6, "0")}`;
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = "rgba(255,255,255,0.95)";
  g.stroke();
  g.font = "52px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(emoji, 48, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(2.6, 2.6, 1);
  sp.renderOrder = 20;
  return sp;
}

interface Chip {
  el: HTMLButtonElement | HTMLDivElement;
  getPos: () => { x: number; y: number; z: number };
  kind: "loc" | "road" | "actor";
  locId?: string;
  self?: boolean;
  metro?: boolean;
  /** A metro station name tag — shown only when zoomed in close. */
  station?: boolean;
  /** A real place (park, mall, museum …) — shown only when zoomed in. */
  place?: boolean;
  /** The small English subtitle line under a place name, if any. */
  sub?: HTMLElement | null;
  w: number;
  h: number;
  lastText: string;
  /** source (untranslated) text last written to an actor chip — rewrite only when it changes, so the page translator's English sticks */
  src?: string;
  visible: boolean;
  /* Last edge-clamped anchor (set by the declutter pass): on the frames
     between passes the chip follows its 3D anchor plus this clamp delta,
     so a label near the screen edge stays pulled fully inside instead of
     being sliced by the overlay's overflow-hidden edge. */
  clampDx: number;
  clampDy: number;
}

export function MapView(p: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const actorsRef = useRef<Map<string, Actor>>(new Map());
  const propsRef = useRef(p);
  propsRef.current = p;
  const camRef = useRef({ az: -0.55, pol: CAM_POL, dist: 46, distCur: 46, tx: LAND_CX, tz: LAND_CZ, lastUser: 0, cut: 0 });
  /* Distance that fills the current canvas, recomputed on every resize;
     while autoFit is on (initially, after ⌂ reset, and whenever the
     fullscreen/fill mode changes) the camera distance tracks it, so the
     city re-fills the frame after entering/leaving fullscreen, zooming
     the window, or any other size change. Manual wheel/button zoom turns
     autoFit off until the next reset or fullscreen toggle. */
  const fitDistRef = useRef(46);
  const autoFitRef = useRef(true);
  const [zoomPct, setZoomPct] = useState(100);
  const [glFailed, setGlFailed] = useState(false);
  const [cine, setCine] = useState(true);
  /* 标签密度：精简 / 标准 / 全部 — fewer labels when zoomed out so they stop
     covering the city; remembered per browser. */
  type LabelDensity = "few" | "normal" | "all";
  const [labelDensity, setLabelDensity] = useState<LabelDensity>(() => {
    try { const v = localStorage.getItem("shhr-labels"); if (v === "few" || v === "normal" || v === "all") return v; } catch { /* default */ }
    return "normal";
  });
  const labelDensityRef = useRef(labelDensity);
  labelDensityRef.current = labelDensity;
  const cycleLabels = () => setLabelDensity((d) => {
    const next: LabelDensity = d === "few" ? "normal" : d === "normal" ? "all" : "few";
    try { localStorage.setItem("shhr-labels", next); } catch { /* storage unavailable */ }
    return next;
  });
  const cineRef = useRef(true);
  cineRef.current = cine;
  const focusRef = useRef(0);
  const lookRef = useRef<{ x: number; z: number; until: number } | null>(null);
  /* LOL-style minimap: a live 2D thumbnail of the whole miniature, drawn
     on a small canvas from the SAME actor refs the 3D scene animates, so
     the player dot, NPC dots, remote players and the destination marker
     move exactly when the big map moves. Clicking it points the main
     camera at that spot through the same lookRef channel search uses. */
  const [miniOpen, setMiniOpen] = useState(true);
  const miniCanvasRef = useRef<HTMLCanvasElement | null>(null);

  /* Day-cycle phase control: jumped instantly via the ☀️/🌇/🌙 buttons,
     a ?time= URL parameter (day | dusk | night, or a 0–1 phase number),
     or the 🎥 demo mode that runs a 30-second day for screen recordings.
     The sky follows the REAL local time in Shenzhen/Huizhou
     (Asia/Shanghai): phase = fraction of the real day, advancing in real
     time (1 phase per 86,400s). The ☀️/🌇/🌙 buttons preview a moment,
     🕐 snaps back to real time, and the 🎥 demo runs a 30s day for
     recordings. A ?time= URL parameter still overrides the start. */
  const REAL_RATE = 1 / 86400;
  const DEMO_RATE = 10 / 300;
  const shanghaiPhase = (): number => {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }).formatToParts(new Date());
      const get = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? 0);
      return ((get("hour") % 24) * 3600 + get("minute") * 60 + get("second")) / 86400;
    } catch { return 0.4; }
  };
  const phaseRef = useRef<{ base: number; at: number } | null>(null);
  if (phaseRef.current === null) {
    let base = shanghaiPhase();
    try {
      const q =
        new URLSearchParams(window.location.search).get("time") ??
        new URLSearchParams(window.location.hash.replace(/^#/, "")).get("time");
      const named: Record<string, number> = { day: 0.32, morning: 0.32, noon: 0.45, dusk: 0.74, sunset: 0.74, night: 0.93 };
      if (q != null && q.trim() !== "") {
        const n = Number(q);
        if (!Number.isNaN(n)) base = Math.min(0.999, Math.max(0, n));
        else if (named[q] !== undefined) base = named[q]!;
      }
    } catch { /* URL unavailable — keep the real-time default */ }
    phaseRef.current = { base, at: performance.now() };
  }
  const rateRef = useRef(REAL_RATE);
  const [demo, setDemo] = useState(false);
  const demoRef = useRef(false);
  const currentPhase = (): number => {
    const pr = phaseRef.current!;
    const el = (performance.now() - pr.at) / 1000;
    return (((pr.base + el * rateRef.current) % 1) + 1) % 1;
  };
  const jumpToPhase = (ph: number) => {
    phaseRef.current = { base: ph, at: performance.now() };
  };
  const backToRealTime = () => {
    demoRef.current = false;
    setDemo(false);
    rateRef.current = REAL_RATE;
    phaseRef.current = { base: shanghaiPhase(), at: performance.now() };
  };
  const toggleDemo = () => {
    // Rebase at the current phase so flipping speed never jumps the clock.
    const cur = currentPhase();
    const next = !demoRef.current;
    demoRef.current = next;
    setDemo(next);
    phaseRef.current = { base: cur, at: performance.now() };
    rateRef.current = next ? DEMO_RATE : REAL_RATE;
    if (next) setCine(true);
  };

  // Arriving somewhere new triggers a short cinematic push-in.
  useEffect(() => {
    focusRef.current = 1;
    camRef.current.cut = 1;
  }, [p.selfLocId]);

  // Entering/leaving fullscreen changes the stage size: re-arm auto-fit so
  // the ResizeObserver in the scene effect snaps the camera distance back
  // to the fill-the-frame distance for the new size.
  useEffect(() => {
    autoFitRef.current = true;
  }, [p.fill]);

  // A searched place takes the camera for a few seconds.
  useEffect(() => {
    if (!p.focusNonce) return;
    if (p.focusX !== undefined && p.focusZ !== undefined) {
      lookRef.current = { x: p.focusX, z: p.focusZ, until: performance.now() + 5000 };
      return;
    }
    if (!p.focusLocId) return;
    const loc = p.focusLocId ? resolveLoc(p.cityKey, p.focusLocId) : undefined;
    if (loc) lookRef.current = { x: loc.x, z: loc.z, until: performance.now() + 4500 };
  }, [p.focusLocId, p.focusX, p.focusZ, p.focusNonce, p.cityKey]);

  // Sync the actor set with props (self, remote players, NPCs).
  // App rebuilds remotePlayers / npcMoodEmoji as fresh objects on EVERY
  // render, so depending on them by identity re-ran this sync constantly;
  // depend on their content instead.
  const remoteKey = p.remotePlayers.map((rp) => `${rp.id}|${rp.name}|${rp.emoji}|${rp.color}|${rp.locId}`).join(";");
  const moodKey = p.npcMoodEmoji ? Object.entries(p.npcMoodEmoji).map(([k, v]) => `${k}=${v}`).join(";") : "";
  useEffect(() => {
    const locs = getLocations(p.cityKey);
    const byId = new Map(locs.map((l) => [l.id, l]));
    const actors = actorsRef.current;
    const want = new Set<string>();
    const upsert = (a: Omit<Actor, "x" | "z" | "tx" | "tz"> & { startLoc: string }) => {
      want.add(a.key);
      const cur = actors.get(a.key);
      const loc = byId.get(a.startLoc) ?? resolveLoc(p.cityKey, a.startLoc) ?? locs[0];
      if (!cur) {
        actors.set(a.key, {
          ...a,
          x: (loc?.x ?? 0) + ((a.seed % 5) - 2) * 0.35,
          z: (loc?.z ?? 0) + ((a.seed % 3) - 1) * 0.35,
          tx: loc?.x ?? 0,
          tz: loc?.z ?? 0,
        });
      } else {
        cur.name = a.name;
        cur.emoji = a.emoji;
        cur.color = a.color;
        cur.isSelf = a.isSelf;
        cur.wander = a.wander;
        cur.shirt = a.shirt;
        cur.pants = a.pants;
        cur.accessory = a.accessory;
        cur.behavior = a.behavior;
        cur.speed = a.speed;
        if (!a.wander) {
          cur.tx = loc?.x ?? cur.tx;
          cur.tz = loc?.z ?? cur.tz;
        }
      }
    };
    const selfOutfit = outfitOf(p.selfOutfitId ?? "casual");
    // The figure moves at the SELECTED MODE's real map speed — walking is
    // visibly slow, a taxi crosses the miniature ~3× faster, rail fastest.
    // App's trip timer derives from the same table, so arrival matches.
    const selfSpeed = modeById((p.travelModeId ?? "walk") as TransportModeId).mapSpeed;
    upsert({ key: "self", name: p.selfName, emoji: p.selfEmoji, color: p.selfColor, isSelf: true, seed: 7, heading: 0, phase: 0, blend: 0, startLoc: p.selfLocId, shirt: selfOutfit.shirt, pants: selfOutfit.pants, accessory: selfOutfit.id === "formal" ? "tie" : "none", behavior: "self", speed: selfSpeed });
    for (const rp of p.remotePlayers) {
      upsert({ key: `p-${rp.id}`, name: rp.name, emoji: rp.emoji, color: rp.color, seed: hash(rp.id), heading: 0, phase: hash(rp.id) % 6, blend: 0, startLoc: rp.locId, shirt: rp.color, pants: 0x2e3440, accessory: "none", behavior: "wander", speed: 4.2 });
    }
    NPCS.forEach((n, i) => {
      const preferred = locs.filter((l) => n.preferTypes.includes(l.type));
      const pool = preferred.length > 0 ? preferred : locs;
      const loc = pool[(hash(n.name) + i) % pool.length];
      const speed = n.behavior === "commute" ? 5.6 : n.behavior === "patrol" ? 3.4 : n.behavior === "stay" ? 2 : 4.2;
      upsert({ key: `npc-${n.name}`, name: `${n.name}·${n.job}${p.npcMoodEmoji?.[n.name] ? ` ${p.npcMoodEmoji[n.name]}` : ""}`, emoji: n.emoji, color: n.color, wander: true, seed: hash(n.name), heading: 0, phase: hash(n.name) % 6, blend: 0, startLoc: loc?.id ?? "home", shirt: n.shirt, pants: n.pants, accessory: n.accessory, behavior: n.behavior, speed });
    });
    for (const key of Array.from(actors.keys())) {
      if (!want.has(key)) actors.delete(key);
    }
  }, [p.cityKey, p.selfLocId, p.selfEmoji, p.selfColor, p.selfName, remoteKey, p.selfOutfitId, moodKey, p.travelModeId]);

  // Build/rebuild the whole 3D scene when the city changes.
  useEffect(() => {
    const mount = mountRef.current;
    const labels = labelsRef.current;
    if (!mount || !labels) return;
    const cityKey = propsRef.current.cityKey;
    const locs = getLocations(cityKey);
    const roads = ROADS[cityKey];
    const flagGroups: THREE.Group[] = [];
    const wheelGroups: THREE.Object3D[] = [];
    const rnd = mulberry(cityKey === "sz" ? 2026 : 2077);

    // WebGL can be unavailable or refuse a context in some webviews (the
    // Mac app's WKWebView among them). That must degrade to the location
    // list below, never throw and unmount the whole game.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    } catch {
      setGlFailed(true);
      return;
    }
    // 1.5x cap: on Retina (dpr 2) the full post chain at 2x is 4x the pixels
    // of 1x — the single biggest per-frame GPU cost. 1.5x stays crisp.
    const lite = !!propsRef.current.lite;
    renderer.setPixelRatio(lite ? 1 : Math.min(1.5, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = !lite;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab;";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd9e8);
    scene.fog = new THREE.Fog(0xbfd9e8, 120, 240);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);

    // Cinematic post chain (PC high-end): bloom for lit windows / neon /
    // streetlights, warm grade + tilt-shift depth of field over the
    // miniature. Falls back to the plain renderer if it can't initialise.
    const fx: PostFx | null = lite ? null : makePostFx(renderer, scene, camera, { bloomStrength: 0.33, bloomThreshold: 0.8, blur: 0.0038 });

    const hemi = new THREE.HemisphereLight(0xdff2ff, 0x8a7a5a, 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -55;
    sun.shadow.camera.right = 55;
    sun.shadow.camera.top = 55;
    sun.shadow.camera.bottom = -55;
    sun.shadow.camera.far = 260;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 6;
    scene.add(sun);
    scene.add(sun.target);
    const amb = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(amb);
    // cool moonlight fill so nights keep shape instead of going flat black
    const moon = new THREE.DirectionalLight(0x8fb6ff, 0);
    moon.position.set(-40, 60, -30);
    scene.add(moon);
    // warm pool of light that follows the player after dark
    const playerLight = new THREE.PointLight(0xffc98a, 0, 14, 1.8);
    playerLight.position.set(0, 3.4, 0);
    scene.add(playerLight);

    /* registries for materials the frame loop animates with the day cycle */
    const buildingMats: THREE.MeshStandardMaterial[] = [];
    const neonMats: THREE.MeshStandardMaterial[] = [];
    const avLights: THREE.Mesh[] = [];
    const smokeSprites: { sp: THREE.Sprite; phase: number; x: number; z: number }[] = [];
    let foamMat: THREE.MeshBasicMaterial | null = null;
    let bulbMat: THREE.MeshStandardMaterial | null = null;
    let glowMat: THREE.SpriteMaterial | null = null;
    let fillerMat: THREE.MeshStandardMaterial | null = null;

    /* ---- water & land ---- */
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x2e7fb8, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.94 });
    // The sea hugs the miniature (a margin around the land, not a 240×160
    // ocean): an oversized plane was most of the empty dark-blue area the
    // city used to float in.
    const water = new THREE.Mesh(new THREE.PlaneGeometry(168, 104), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0, 4);
    scene.add(water);
    // Huizhou's Dongjiang river band in the north
    if (cityKey === "hz") {
      const river = new THREE.Mesh(new THREE.PlaneGeometry(90, 3.4), waterMat);
      river.rotation.x = -Math.PI / 2;
      river.rotation.z = 0.06;
      river.position.set(-4, 0.18, -18.6);
      scene.add(river);
    }
    // reservoirs & lakes as flat water patches in the land
    for (const lk of LAKES[cityKey]) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(lk.r, lk.r * 1.04, 0.12, 22), waterMat);
      disc.position.set(lk.x, LAND + 0.03, lk.z);
      disc.receiveShadow = true;
      scene.add(disc);
    }
    const landShape = new THREE.Shape();
    landShape.moveTo(-WORLD.x, -WORLD.zn);
    landShape.lineTo(WORLD.x, -WORLD.zn);
    for (let x = WORLD.x; x >= -WORLD.x; x -= 2) landShape.lineTo(x, -coastZ(cityKey, x));
    landShape.lineTo(-WORLD.x, -WORLD.zn);
    const landGeo = new THREE.ExtrudeGeometry(landShape, { depth: LAND, bevelEnabled: false });
    landGeo.rotateX(-Math.PI / 2);
    const land = new THREE.Mesh(
      landGeo,
      new THREE.MeshStandardMaterial({ color: cityKey === "sz" ? 0xd9cfae : 0xcfd6a8, roughness: 1 }),
    );
    land.receiveShadow = true;
    scene.add(land);
    // beach strip along the coast
    const beachMat = new THREE.MeshStandardMaterial({ color: 0xead9a0, roughness: 1 });
    for (let x = -WORLD.x; x < WORLD.x; x += 2) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 1.6), beachMat);
      seg.position.set(x + 1, LAND - 0.18, coastZ(cityKey, x + 1) + 0.7);
      seg.receiveShadow = true;
      scene.add(seg);
    }
    // foam line where the water meets the sand, breathing with the waves
    foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
    for (let x = -WORLD.x; x < WORLD.x; x += 2) {
      const foam = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.04, 0.5), foamMat);
      foam.position.set(x + 1, 0.16, coastZ(cityKey, x + 1) + 1.75);
      scene.add(foam);
    }

    /* ---- roads ---- */
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x3c4148, roughness: 0.95 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5e9b8 });
    const roadMeshes: THREE.Mesh[] = [];
    for (const r of roads) {
      const len = Math.hypot(r.x2 - r.x1, r.z2 - r.z1);
      const ang = Math.atan2(r.z2 - r.z1, r.x2 - r.x1);
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, r.w), roadMat);
      m.position.set((r.x1 + r.x2) / 2, LAND + 0.05, (r.z1 + r.z2) / 2);
      m.rotation.y = -ang;
      m.receiveShadow = true;
      scene.add(m);
      roadMeshes.push(m);
      const dashes = Math.floor(len / 2.4);
      const dashGeo = new THREE.BoxGeometry(1.1, 0.04, 0.16);
      const dash = new THREE.InstancedMesh(dashGeo, lineMat, Math.max(1, dashes));
      const mat4 = new THREE.Matrix4();
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -ang, 0));
      for (let i = 0; i < dashes; i++) {
        const t = (i + 0.5) / dashes;
        mat4.compose(
          new THREE.Vector3(r.x1 + (r.x2 - r.x1) * t, LAND + 0.11, r.z1 + (r.z2 - r.z1) * t),
          quat,
          new THREE.Vector3(1, 1, 1),
        );
        dash.setMatrixAt(i, mat4);
      }
      scene.add(dash);
    }

    /* ---- streetlights along the roads (glow wakes up at dusk) ---- */
    {
      const glowTex = glowTexture();
      const lampGlowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffca7a, transparent: true, opacity: 0, depthWrite: false });
      glowMat = lampGlowMat;
      bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff3cf, roughness: 0.4, emissive: 0xffc873, emissiveIntensity: 0.15 });
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.8 });
      const lampPts: { x: number; z: number }[] = [];
      for (const r of roads) {
        const len = Math.hypot(r.x2 - r.x1, r.z2 - r.z1);
        const ang = Math.atan2(r.z2 - r.z1, r.x2 - r.x1);
        const n = Math.max(1, Math.floor(len / 7));
        for (let i = 0; i <= n; i++) {
          const t = (i + 0.5) / (n + 1);
          const side = i % 2 === 0 ? 1 : -1;
          const off = (r.w / 2 + 0.55) * side;
          lampPts.push({ x: r.x1 + (r.x2 - r.x1) * t + Math.sin(ang) * off, z: r.z1 + (r.z2 - r.z1) * t - Math.cos(ang) * off });
        }
      }
      const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.07, 1.7, 6), poleMat, lampPts.length);
      const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 10, 8), bulbMat, lampPts.length);
      const m4 = new THREE.Matrix4();
      lampPts.forEach((pt, i) => {
        m4.makeTranslation(pt.x, LAND + 0.85, pt.z);
        poles.setMatrixAt(i, m4);
        m4.makeTranslation(pt.x, LAND + 1.78, pt.z);
        bulbs.setMatrixAt(i, m4);
        const glow = new THREE.Sprite(lampGlowMat);
        glow.scale.set(2.6, 2.6, 1);
        glow.position.set(pt.x, LAND + 1.78, pt.z);
        scene.add(glow);
      });
      scene.add(poles);
      scene.add(bulbs);
    }

    /* ---- metro / intercity lines ----
       ~380 stations on ~20 lines: track segments and station markers are
       instanced (3 draw calls in total) instead of 2 meshes per station. */
    const stationMarks: { name: string; x: number; z: number; hasLoc: boolean }[] = [];
    {
      const lines = metroLinesForCity(cityKey);
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const eul = new THREE.Euler();
      const scl = new THREE.Vector3();
      const pos = new THREE.Vector3();
      const col = new THREE.Color();
      const nSeg = lines.reduce((n, l) => n + Math.max(0, l.stations.length - 1), 0);
      const segs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.06, 0.42), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55 }), Math.max(1, nSeg));
      let si = 0;
      const marks = new Map<string, { x: number; z: number; color: number; n: number; hasLoc: boolean }>();
      for (const line of lines) {
        const pts = line.stations.map((st) => new THREE.Vector3(st.x, LAND + 0.22, st.z));
        if (pts.length > 1) {
          scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: line.color, transparent: true, opacity: 0.92 })));
          for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i]!; const b = pts[i + 1]!;
            const len = Math.hypot(b.x - a.x, b.z - a.z);
            q.setFromEuler(eul.set(0, -Math.atan2(b.z - a.z, b.x - a.x), 0));
            m4.compose(pos.set((a.x + b.x) / 2, LAND + 0.16, (a.z + b.z) / 2), q, scl.set(len, 1, 1));
            segs.setMatrixAt(si, m4);
            segs.setColorAt(si, col.setHex(line.color));
            si++;
          }
        }
        for (const st of line.stations) {
          if (st.name.endsWith("方向")) continue; // direction stub, not a station
          const cur = marks.get(st.name);
          if (cur) { cur.n++; cur.hasLoc ||= !!st.locId; }
          else marks.set(st.name, { x: st.x, z: st.z, color: line.color, n: 1, hasLoc: !!st.locId });
        }
      }
      segs.count = si;
      scene.add(segs);
      const ringGeo = new THREE.RingGeometry(0.72, 1, 16);
      ringGeo.rotateX(-Math.PI / 2);
      const dots = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.22, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), Math.max(1, marks.size));
      const rings = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), Math.max(1, marks.size));
      let mi = 0;
      q.identity();
      for (const [name, mk] of marks) {
        const r = mk.hasLoc ? 0.42 : mk.n > 1 ? 0.33 : 0.22;
        m4.compose(pos.set(mk.x, LAND + 0.28, mk.z), q, scl.set(r, 1, r));
        dots.setMatrixAt(mi, m4);
        m4.compose(pos.set(mk.x, LAND + 0.3, mk.z), q, scl.set(r * 1.4, 1, r * 1.4));
        rings.setMatrixAt(mi, m4);
        rings.setColorAt(mi, col.setHex(mk.n > 1 ? 0x1f2937 : mk.color));
        stationMarks.push({ name, x: mk.x, z: mk.z, hasLoc: mk.hasLoc });
        mi++;
      }
      dots.count = mi;
      rings.count = mi;
      scene.add(dots);
      scene.add(rings);
    }

    /* ---- real places (OSM): one instanced pin per park / mall / museum … ---- */
    const cityPlaces = placesForCity(cityKey);
    if (cityPlaces.length > 0) {
      const pinGeo = new THREE.ConeGeometry(0.2, 0.55, 8);
      pinGeo.rotateX(Math.PI);
      const pins = new THREE.InstancedMesh(pinGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), cityPlaces.length);
      const m4 = new THREE.Matrix4();
      const col = new THREE.Color();
      cityPlaces.forEach((pl, i) => {
        m4.makeTranslation(pl.x, LAND + 0.55, pl.z);
        pins.setMatrixAt(i, m4);
        pins.setColorAt(i, col.setHex(PLACE_KINDS[pl.kind].color));
      });
      scene.add(pins);
    }

    /* ---- location buildings ---- */
    const winTex = windowsTexture();
    const pickMeshes: THREE.Object3D[] = [];
    const flagMats: THREE.MeshStandardMaterial[] = [];
    /* Real-place miniatures (landmarks.ts): a location with a model gets it
       instead of the generic box + roof. Label height follows the model. */
    const landmarks = createLandmarks(winTex);
    const labelTop = new Map<string, number>();
    const decorSpots = landmarks.decor(cityKey);
    const landmarkRoots: THREE.Object3D[] = [];
    const pickMat = new THREE.MeshBasicMaterial({ visible: false });
    for (const l of locs) {
      const g = new THREE.Group();
      const built = landmarks.forLoc(cityKey, l);
      if (built) {
        g.add(built.group);
        wheelGroups.push(...built.spin);
        landmarkRoots.push(g);
        // the model itself gets merged city-wide below; clicks hit this
        // invisible box (raycasting ignores visibility)
        const pick = new THREE.Mesh(new THREE.BoxGeometry(l.w, built.top, l.w), pickMat);
        pick.position.y = built.top / 2;
        pick.userData.locId = l.id;
        g.add(pick);
        pickMeshes.push(pick);
        labelTop.set(l.id, built.top);
        if (l.type === "apec") {
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4), new THREE.MeshStandardMaterial({ color: 0x222222 }));
          pole.position.y = built.top + 1.2;
          pole.userData.keep = true;
          g.add(pole);
          const flagMat = new THREE.MeshStandardMaterial({ color: 0xe63a1f, side: THREE.DoubleSide, emissive: 0xe63a1f, emissiveIntensity: 0.25 });
          const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), flagMat);
          flag.position.set(0.78, built.top + 1.95, 0);
          flag.userData.keep = true;
          g.add(flag);
          flagMats.push(flagMat);
          (g.userData as { flag?: THREE.Mesh }).flag = flag;
          flagGroups.push(g);
        }
        g.position.set(l.x, LAND, l.z);
        scene.add(g);
        continue;
      }
      const h = l.h * 1.7;
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(l.w, 0.5, l.w),
        new THREE.MeshStandardMaterial({ color: 0xb8ad92, roughness: 1 }),
      );
      base.position.y = 0.25;
      base.receiveShadow = true;
      g.add(base);
      const glassy = h > 6.5;
      const bodyMat = new THREE.MeshStandardMaterial({
        color: l.color,
        roughness: glassy ? 0.32 : 0.78,
        metalness: glassy ? 0.45 : 0.05,
        emissive: 0xffc873,
        emissiveMap: winTex,
        emissiveIntensity: 0,
      });
      buildingMats.push(bodyMat);
      const body = new THREE.Mesh(new THREE.BoxGeometry(l.w * 0.82, h, l.w * 0.82), bodyMat);
      body.position.y = 0.5 + h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      body.userData.locId = l.id;
      g.add(body);
      pickMeshes.push(body);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(l.w * 0.66, Math.min(1.6, h * 0.22 + 0.5), 4),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(l.color).multiplyScalar(0.72), roughness: 0.9, flatShading: true }),
      );
      roof.position.y = 0.5 + h + Math.min(1.6, h * 0.22 + 0.5) / 2;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      g.add(roof);
      // neon shop sign for the lively places — pulses after dark
      if (l.type === "food" || l.type === "mall" || l.type === "social" || l.type === "apec" || l.type === "market" || l.type === "transit" || l.type === "work" || l.type === "lodging" || l.type === "home") {
        const neonMat = new THREE.MeshStandardMaterial({ color: 0x1a1216, roughness: 0.5, emissive: l.color, emissiveIntensity: 0.35 });
        const sign = new THREE.Mesh(new THREE.BoxGeometry(Math.min(2.2, l.w * 0.62), 0.55, 0.1), neonMat);
        sign.position.set(0, 0.5 + h * 0.52, l.w * 0.41 + 0.06);
        g.add(sign);
        neonMats.push(neonMat);
      }
      // storefront awning with a warm under-glow for the street-level places
      if (l.type === "food" || l.type === "mall" || l.type === "market" || l.type === "social") {
        const awnMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(l.color).multiplyScalar(0.85), roughness: 0.7, emissive: 0xffb35c, emissiveIntensity: 0.12 });
        const awn = new THREE.Mesh(new THREE.BoxGeometry(l.w * 0.72, 0.08, 0.9), awnMat);
        awn.position.set(0, 1.55, l.w * 0.41 + 0.42);
        awn.rotation.x = 0.38;
        awn.castShadow = true;
        g.add(awn);
        neonMats.push(awnMat);
      }
      // blinking aviation light on the tall towers
      if (h > 7) {
        const avMat = new THREE.MeshStandardMaterial({ color: 0x330b0b, emissive: 0xff2a1e, emissiveIntensity: 0.2 });
        const av = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), avMat);
        av.position.y = 0.5 + h + Math.min(1.6, h * 0.22 + 0.5) + 0.25;
        g.add(av);
        avLights.push(av);
      }
      // cooking steam drifting up from the food streets
      if (l.type === "food") {
        const smokeTex = glowTexture();
        for (let i = 0; i < 9; i++) {
          const sm = new THREE.SpriteMaterial({ map: smokeTex, color: 0xe8e2d6, transparent: true, opacity: 0.16, depthWrite: false });
          const sp = new THREE.Sprite(sm);
          const ph = i / 9;
          sp.position.set(l.x + (rnd() - 0.5) * 1.6, LAND + 1.6 + ph * 3.4, l.z + (rnd() - 0.5) * 1.2);
          const sc = 1.1 + ph * 1.8;
          sp.scale.set(sc, sc, 1);
          scene.add(sp);
          smokeSprites.push({ sp, phase: ph, x: l.x, z: l.z });
        }
      }
      if (l.type === "apec") {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        pole.position.y = 0.5 + h + 1.6;
        g.add(pole);
        const flagMat = new THREE.MeshStandardMaterial({ color: 0xe63a1f, side: THREE.DoubleSide, emissive: 0xe63a1f, emissiveIntensity: 0.25 });
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), flagMat);
        flag.position.set(0.78, 0.5 + h + 2.35, 0);
        g.add(flag);
        flagMats.push(flagMat);
        (g.userData as { flag?: THREE.Mesh }).flag = flag;
      }
      g.position.set(l.x, LAND, l.z);
      scene.add(g);
      if (l.type === "apec" && (g.userData as { flag?: THREE.Mesh }).flag) {
        flagGroups.push(g);
      }
    }

    /* ---- landmarks & filler ---- */
    // skyline landmarks that are not playable places (春笋, 京基100, 地王, 湾区之光)
    for (const d of decorSpots) {
      d.group.position.set(d.x, LAND, d.z);
      d.group.rotation.y = d.ry ?? 0;
      scene.add(d.group);
      wheelGroups.push(...d.spin);
    }
    mergeStatic([...landmarkRoots, ...decorSpots.map((d) => d.group)], scene, new Set(wheelGroups));
    buildingMats.push(...landmarks.litMats);
    neonMats.push(...landmarks.neonMats);
    if (cityKey === "sz") {
      // (某安金融中心 is now the 某安金融中心 location's own model)
      // (深圳湾大桥 and 深中通道 are decor landmarks in landmarks.ts)
      // 华侨城 ferris wheel by 欢乐谷: rim, spokes and cabins, on two legs
      const wheel = landmarks.wheel(2.6, 0xf472b6, 0xfacc15);
      wheel.position.set(-21.5, LAND + 3.4, -9.5);
      scene.add(wheel);
      wheelGroups.push(wheel);
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.6, 0.12), new THREE.MeshStandardMaterial({ color: 0xc9d3da, roughness: 0.4, metalness: 0.5 }));
        leg.position.set(-21.5 + s * 0.5, LAND + 1.7, -9.5);
        leg.rotation.z = s * 0.15;
        scene.add(leg);
      }
    } else {
      // Sizhou pagoda beside West Lake
      const pagoda = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const tier = new THREE.Mesh(
          new THREE.CylinderGeometry(1.45 - i * 0.2, 1.65 - i * 0.2, 1.15, 6),
          new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.9 }),
        );
        tier.position.y = 0.6 + i * 1.15;
        tier.castShadow = true;
        pagoda.add(tier);
        const eave = new THREE.Mesh(
          new THREE.ConeGeometry(1.95 - i * 0.24, 0.5, 6),
          new THREE.MeshStandardMaterial({ color: 0x8a4b2d, roughness: 0.9, flatShading: true }),
        );
        eave.position.y = 1.2 + i * 1.15;
        eave.castShadow = true;
        pagoda.add(eave);
      }
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0xf5b942, roughness: 0.4, metalness: 0.6 }));
      tip.position.y = 7.1;
      pagoda.add(tip);
      pagoda.position.set(-16.2, LAND, 3.4);
      scene.add(pagoda);
    }

    /* ---- terrain: mountain ranges as flat-shaded cone clusters ---- */
    const mtnMat = new THREE.MeshStandardMaterial({ color: 0x5d8a4f, roughness: 1, flatShading: true });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 1, flatShading: true });
    for (const range of MOUNTAINS[cityKey]) {
      for (const pk of range.peaks) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(pk.r, pk.h, 7), pk.rock ? rockMat : mtnMat);
        cone.position.set(pk.x, LAND + pk.h / 2 - 0.15, pk.z);
        cone.rotation.y = hash(`${pk.x},${pk.z}`) % 6;
        cone.castShadow = true;
        cone.receiveShadow = true;
        scene.add(cone);
        // a dusting of trees on the lower slopes
        for (let i = 0; i < 5; i++) {
          const ang = rnd() * Math.PI * 2;
          const rr = pk.r * (0.55 + rnd() * 0.3);
          const tx = pk.x + Math.cos(ang) * rr;
          const tz = pk.z + Math.sin(ang) * rr;
          const ty = LAND + pk.h * (1 - rr / pk.r) - 0.1;
          const tree = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.3, 6), new THREE.MeshStandardMaterial({ color: 0x3f7d46, roughness: 1, flatShading: true }));
          tree.position.set(tx, ty + 0.5, tz);
          scene.add(tree);
        }
      }
    }

    // filler buildings (instanced)
    const nearLoc = (x: number, z: number) =>
      locs.some((l) => Math.abs(l.x - x) < 3.4 && Math.abs(l.z - z) < 3.4) ||
      decorSpots.some((d) => Math.hypot(d.x - x, d.z - z) < d.r + 1.4);
    const nearMountain = (x: number, z: number) =>
      MOUNTAINS[cityKey].some((range) => range.peaks.some((pk) => Math.hypot(x - pk.x, z - pk.z) < pk.r + 0.8));
    const nearLake = (x: number, z: number) =>
      LAKES[cityKey].some((lk) => Math.hypot(x - lk.x, z - lk.z) < lk.r + 0.9);
    const nearRoad = (x: number, z: number) =>
      roads.some((r) => {
        const dx = r.x2 - r.x1;
        const dz = r.z2 - r.z1;
        const t = Math.max(0, Math.min(1, ((x - r.x1) * dx + (z - r.z1) * dz) / (dx * dx + dz * dz)));
        return Math.hypot(x - (r.x1 + dx * t), z - (r.z1 + dz * t)) < r.w / 2 + 1.1;
      });
    const spots: { x: number; z: number; h: number; c: THREE.Color }[] = [];
    const palette = [0xe8e0cc, 0xd8cfb8, 0xc9d4d8, 0xe3d3c2, 0xd5dde3, 0xe9dcc8, 0xcfc4ae];
    for (let gx = -36; gx <= 36; gx += 2.8) {
      for (let gz = -20; gz <= 14; gz += 2.8) {
        const x = gx + (rnd() - 0.5) * 1.3;
        const z = gz + (rnd() - 0.5) * 1.3;
        if (z > coastZ(cityKey, x) - 1.6) continue;
        if (nearLoc(x, z) || nearRoad(x, z) || nearMountain(x, z) || nearLake(x, z)) continue;
        if (rnd() < 0.33) continue;
        const c = new THREE.Color(palette[Math.floor(rnd() * palette.length)] ?? 0xe8e0cc);
        spots.push({ x, z, h: 1.2 + rnd() * rnd() * 7.5, c });
      }
    }
    fillerMat = new THREE.MeshStandardMaterial({ roughness: 0.95, emissive: 0xffc873, emissiveMap: winTex, emissiveIntensity: 0 });
    const filler = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.9, 1, 1.9),
      fillerMat,
      spots.length,
    );
    {
      const mat4 = new THREE.Matrix4();
      spots.forEach((s, i) => {
        mat4.makeScale(1, s.h, 1).setPosition(s.x, LAND + s.h / 2, s.z);
        filler.setMatrixAt(i, mat4);
        filler.setColorAt(i, s.c);
      });
    }
    filler.castShadow = true;
    filler.receiveShadow = true;
    scene.add(filler);

    // trees (instanced cones)
    const treeSpots: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < 1500 && treeSpots.length < (lite ? 160 : 430); i++) {
      const x = -37 + rnd() * 74;
      const z = -21 + rnd() * 36;
      if (z > coastZ(cityKey, x) - 0.6) continue;
      if (nearLoc(x, z) || nearRoad(x, z) || nearMountain(x, z) || nearLake(x, z)) continue;
      treeSpots.push({ x, z, s: 0.7 + rnd() * 0.8 });
    }
    const foliage = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.85, 2.1, 7),
      new THREE.MeshStandardMaterial({ color: 0x4d9b5f, roughness: 1, flatShading: true }),
      treeSpots.length,
    );
    {
      const mat4 = new THREE.Matrix4();
      treeSpots.forEach((s, i) => {
        mat4.makeScale(s.s, s.s, s.s).setPosition(s.x, LAND + 1.5 * s.s, s.z);
        foliage.setMatrixAt(i, mat4);
      });
    }
    foliage.castShadow = true;
    scene.add(foliage);

    /* (The random decorative 🏥🚓⛽ street blocks are gone: real hospitals,
       pharmacies and police stations from OpenStreetMap are pins on the
       map now, with their real names, addresses and phone numbers.) */

    // clouds: clusters of flattened low-poly puffs that soften at dusk
    const clouds: THREE.Group[] = [];
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, transparent: true, opacity: 0.88 });
    for (let i = 0; i < 9; i++) {
      const cl = new THREE.Group();
      const puffs = 3 + Math.floor(rnd() * 2);
      for (let k = 0; k < puffs; k++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 + rnd() * 1.1, 0), cloudMat);
        puff.position.set((k - puffs / 2) * 1.7 + (rnd() - 0.5), (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 1.4);
        puff.scale.y = 0.45;
        cl.add(puff);
      }
      cl.position.set(-45 + rnd() * 90, 17 + rnd() * 6, -20 + rnd() * 36);
      scene.add(cl);
      clouds.push(cl);
    }

    /* ---- ambient motes: dust in the day, city sparkle after dark ---- */
    const moteCount = 240;
    const motePos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      motePos[i * 3] = -38 + rnd() * 76;
      motePos[i * 3 + 1] = 1 + rnd() * 8;
      motePos[i * 3 + 2] = -21 + rnd() * 38;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
    const moteMat = new THREE.PointsMaterial({ color: 0xfff3cf, size: 0.22, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
    const motes = new THREE.Points(moteGeo, moteMat);
    scene.add(motes);

    /* ---- rain: falls only when the REAL weather says rain/storm ---- */
    const rainCount = 650;
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = -40 + rnd() * 80;
      rainPos[i * 3 + 1] = rnd() * 24;
      rainPos[i * 3 + 2] = -24 + rnd() * 44;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({ color: 0xcfe4f5, size: 0.34, transparent: true, opacity: 0, depthWrite: false });
    const rainPts = new THREE.Points(rainGeo, rainMat);
    rainPts.visible = false;
    scene.add(rainPts);

    /* ---- traffic ---- */
    interface Car { road: Road; t: number; speed: number; dir: 1 | -1; lane: number }
    const cars: Car[] = [];
    const carMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.15, 0.5, 0.62),
      new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 }),
      30,
    );
    const carColors = [0xffffff, 0xe63a1f, 0x2563eb, 0xf5b942, 0x222831, 0x2dd4bf];
    for (let i = 0; i < 30; i++) {
      const road = roads[Math.floor(rnd() * roads.length)] ?? roads[0]!;
      cars.push({ road, t: rnd(), speed: 0.02 + rnd() * 0.035, dir: rnd() > 0.5 ? 1 : -1, lane: (rnd() - 0.5) * 1.1 });
      carMesh.setColorAt(i, new THREE.Color(carColors[i % carColors.length]));
    }
    carMesh.castShadow = true;
    scene.add(carMesh);

    /* ---- player trail: a dashed line tracing the current trip ----
       Points are sampled while the player figure moves; choosing a new
       destination starts a fresh trail from where the player stands, so a
       walk/ride reads as an actual journey across the miniature. */
    const TRAIL_MAX = 180;
    const trailPos = new Float32Array(TRAIL_MAX * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
    const trailLine = new THREE.Line(
      trailGeo,
      new THREE.LineDashedMaterial({ color: 0xe63a1f, dashSize: 0.8, gapSize: 0.5, transparent: true, opacity: 0.95 }),
    );
    trailLine.frustumCulled = false;
    trailLine.renderOrder = 4;
    scene.add(trailLine);
    let trailCount = 0;
    let trailFor = "";
    const trailLast = new THREE.Vector3(1e9, 0, 1e9);
    const pushTrail = (x: number, z: number) => {
      if (trailCount >= TRAIL_MAX) {
        trailPos.copyWithin(0, 3);
        trailCount = TRAIL_MAX - 1;
      }
      trailPos[trailCount * 3] = x;
      trailPos[trailCount * 3 + 1] = LAND + 0.22;
      trailPos[trailCount * 3 + 2] = z;
      trailCount++;
      trailLast.set(x, 0, z);
      trailGeo.setDrawRange(0, trailCount);
      trailGeo.attributes.position!.needsUpdate = true;
      trailLine.computeLineDistances();
    };

    /* ---- labels (HTML overlay) ---- */
    labels.innerHTML = "";
    const chips: Chip[] = [];
    const mkChip = (cls: string, html: string): HTMLDivElement => {
      const d = document.createElement("div");
      d.className = cls;
      d.innerHTML = html;
      d.style.cssText = "position:absolute;left:0;top:0;transform:translate(-50%,-100%);white-space:nowrap;pointer-events:none;";
      labels.appendChild(d);
      return d;
    };
    for (const l of locs) {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", `前往${l.name}`);
      // scenic spots and Summit venues carry their English name under the
      // Chinese one, so a visiting Summit guest can read the city off the map
      const en = LOC_EN[l.name];
      if (en && (l.type === "scenic" || l.type === "fun" || l.type === "apec")) {
        b.innerHTML = `${l.emoji} ${l.short}<br><span style="font-size:8.5px;font-weight:600;opacity:.62;letter-spacing:.02em">${en}</span>`;
      } else {
        b.textContent = `${l.emoji} ${l.short}`;
      }
      b.style.cssText =
        "position:absolute;left:0;top:0;transform:translate(-50%,-100%);white-space:nowrap;pointer-events:auto;cursor:pointer;font:700 11px 'Noto Sans SC',sans-serif;line-height:1.3;padding:3px 8px;border-radius:10px;border:1px solid rgba(20,26,32,.55);background:rgba(255,253,248,.93);color:#14202b;box-shadow:0 1px 4px rgba(10,20,30,.25);";
      b.addEventListener("click", () => propsRef.current.onSelect(l.id));
      labels.appendChild(b);
      chips.push({ el: b, kind: "loc", sub: b.querySelector("span"), locId: l.id, w: 0, h: 0, lastText: "", visible: true, clampDx: 0, clampDy: 0, getPos: () => ({ x: l.x, y: LAND + (labelTop.get(l.id) ?? l.h * 1.7 + 1.2) + 1.4, z: l.z }) });
    }
    for (const range of MOUNTAINS[cityKey]) {
      if (!range.label || range.lx === undefined || range.lz === undefined) continue;
      const d = mkChip("", range.label);
      d.style.cssText += "font:800 10px 'Noto Sans SC',sans-serif;padding:2px 8px;border-radius:999px;background:rgba(38,64,38,.82);color:#e8f5d8;box-shadow:0 1px 4px rgba(10,20,10,.4);";
      const lx = range.lx;
      const lz = range.lz;
      const ly = range.ly ?? 8;
      chips.push({ el: d, kind: "road", w: 0, h: 0, lastText: "", visible: true, clampDx: 0, clampDy: 0, getPos: () => ({ x: lx, y: LAND + ly, z: lz }) });
    }
    for (const r of roads) {
      if (!r.name || r.lx === undefined || r.lz === undefined) continue;
      const d = mkChip(
        "",
        r.name,
      );
      d.style.cssText += "font:700 10px 'Noto Sans SC',sans-serif;letter-spacing:.18em;color:rgba(255,255,255,.92);text-shadow:0 1px 3px rgba(10,20,30,.8);";
      const lx = r.lx;
      const lz = r.lz;
      chips.push({ el: d, kind: "road", w: 0, h: 0, lastText: "", visible: true, clampDx: 0, clampDy: 0, getPos: () => ({ x: lx, y: LAND + 0.4, z: lz }) });
    }

    for (const line of metroLinesForCity(cityKey)) {
      const mid = line.stations[Math.floor(line.stations.length / 2)];
      if (!mid) continue;
      const d = mkChip("", line.short);
      d.title = `${line.short} · ${line.stations[0]?.name ?? ""}↔${line.stations[line.stations.length - 1]?.name ?? ""}`;
      d.style.cssText += `font:800 9.5px 'Noto Sans SC',sans-serif;padding:2px 7px;border-radius:999px;background:${line.colorCss};color:#fff;box-shadow:0 1px 4px rgba(0,0,0,.35);`;
      chips.push({ el: d, kind: "road", metro: true, w: 0, h: 0, lastText: "", visible: true, clampDx: 0, clampDy: 0, getPos: () => ({ x: mid.x, y: LAND + 1.1, z: mid.z }) });
    }
    // Station names: only shown zoomed in, lowest priority (places with a
    // location already carry their own label).
    for (const st of stationMarks) {
      if (st.hasLoc) continue;
      const d = mkChip("", "");
      d.textContent = `🚇 ${st.name}`;
      d.title = `${st.name}站 · 点一下去这个站`;
      d.style.cssText += "pointer-events:auto;cursor:pointer;font:700 9px 'Noto Sans SC',sans-serif;padding:1px 5px;border-radius:6px;color:#fff;background:rgba(15,23,42,.72);";
      d.addEventListener("click", () => propsRef.current.onSelect(stationLocId(st.name)));
      chips.push({ el: d, kind: "road", station: true, w: 0, h: 0, lastText: "", visible: true, clampDx: 0, clampDy: 0, getPos: () => ({ x: st.x, y: LAND + 0.8, z: st.z }) });
    }
    // Real places: clickable name tags, shown when zoomed in.
    for (const pl of cityPlaces) {
      const k = PLACE_KINDS[pl.kind];
      const d = mkChip("", "");
      d.textContent = `${k.emoji} ${pl.name}`;
      d.title = `${pl.name} · ${k.label} · 最近站：${pl.st}`;
      d.style.cssText += `pointer-events:auto;cursor:pointer;font:700 9px 'Noto Sans SC',sans-serif;padding:1px 6px;border-radius:7px;color:#14202b;background:rgba(255,253,248,.88);border:1px solid #${k.color.toString(16).padStart(6, "0")};`;
      d.addEventListener("click", () => propsRef.current.onSelect(`pl:${pl.id}`));
      chips.push({ el: d, kind: "road", place: true, w: 0, h: 0, lastText: "", visible: true, clampDx: 0, clampDy: 0, getPos: () => ({ x: pl.x, y: LAND + 1.0, z: pl.z }) });
    }

    /* ---- actors (3D) ---- */
    const actorViews = new Map<string, THREE.Group>();
    const actorChips = new Map<string, Chip>();
    interface ActorLimbs { armL: THREE.Group; armR: THREE.Group; legL: THREE.Group; legR: THREE.Group }
    const ensureActorView = (a: Actor) => {
      let v = actorViews.get(a.key);
      if (!v) {
        v = new THREE.Group();
        // body parts live in a subgroup so riding a vehicle can lift the
        // figure onto the seat (and tuck the legs away in a car/bus)
        const body = new THREE.Group();
        v.add(body);
        (v.userData as { body?: THREE.Group }).body = body;
        const shirt = new THREE.MeshStandardMaterial({ color: a.shirt, roughness: 0.65 });
        const shirtDark = new THREE.MeshStandardMaterial({ color: new THREE.Color(a.shirt).multiplyScalar(0.78), roughness: 0.7 });
        const pants = new THREE.MeshStandardMaterial({ color: a.pants, roughness: 0.85 });
        const skin = new THREE.MeshStandardMaterial({ color: 0xf2c79b, roughness: 0.7 });
        const mkLimb = (mat: THREE.Material, w: number, len: number) => {
          const pivot = new THREE.Group();
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, len, w + 0.03), mat);
          mesh.position.y = -len / 2;
          mesh.castShadow = true;
          pivot.add(mesh);
          return pivot;
        };
        const legL = mkLimb(pants, 0.21, 0.82);
        legL.position.set(-0.16, 0.86, 0);
        body.add(legL);
        const legR = mkLimb(pants, 0.21, 0.82);
        legR.position.set(0.16, 0.86, 0);
        body.add(legR);
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.74, 0.37), shirt);
        torso.position.y = 1.24;
        torso.castShadow = true;
        body.add(torso);
        const armL = mkLimb(shirtDark, 0.18, 0.68);
        armL.position.set(-0.42, 1.56, 0);
        body.add(armL);
        const armR = mkLimb(shirtDark, 0.18, 0.68);
        armR.position.set(0.42, 1.56, 0);
        body.add(armR);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 14, 12), skin);
        head.position.y = 1.86;
        head.castShadow = true;
        body.add(head);
        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.325, 14, 10), new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.95 }));
        hair.position.y = 1.94;
        hair.scale.set(1, 0.72, 1);
        body.add(hair);
        (v.userData as { limbs?: ActorLimbs }).limbs = { armL, armR, legL, legR };
        (v.userData as { mats?: { shirt: THREE.MeshStandardMaterial; dark: THREE.MeshStandardMaterial; pants: THREE.MeshStandardMaterial } }).mats = { shirt, dark: shirtDark, pants };
        // identity accessories, toggled by role/outfit: cap (保安), helmet (骑手),
        // tie (正装/通勤), apron (摊主), reflective vest (保洁), bag (学生/白领)
        const accGroup = new THREE.Group();
        const mkAcc = (name: string, build: (g: THREE.Group) => void) => { const g = new THREE.Group(); g.name = `acc-${name}`; build(g); g.visible = false; accGroup.add(g); };
        mkAcc("cap", (g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.5), new THREE.MeshStandardMaterial({ color: 0x24304d, roughness: 0.8 })); m.position.y = 2.14; g.add(m); const brim = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.3), m.material); brim.position.set(0, 2.08, 0.36); g.add(brim); });
        mkAcc("helmet", (g) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8), new THREE.MeshStandardMaterial({ color: 0xf5b301, roughness: 0.35 })); m.position.y = 1.97; m.scale.y = 0.78; g.add(m); });
        mkAcc("tie", (g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.44, 0.03), new THREE.MeshStandardMaterial({ color: 0x8c2b2e, roughness: 0.6 })); m.position.set(0, 1.32, 0.2); g.add(m); });
        mkAcc("apron", (g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.03), new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.9 })); m.position.set(0, 1.14, 0.2); g.add(m); });
        mkAcc("vest", (g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.43), new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.7, emissive: 0xff7a1a, emissiveIntensity: 0.18 })); m.position.y = 1.3; g.add(m); });
        mkAcc("bag", (g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.16), new THREE.MeshStandardMaterial({ color: 0x54432e, roughness: 0.85 })); m.position.set(0.42, 1.18, -0.16); m.castShadow = true; g.add(m); });
        body.add(accGroup);
        (v.userData as { acc?: THREE.Group }).acc = accGroup;
        const sp = emojiSprite(a.emoji, a.color);
        sp.position.y = 2.85;
        body.add(sp);
        if (a.isSelf) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.65, 0.85, 28),
            new THREE.MeshBasicMaterial({ color: 0xff4d2e, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.06;
          v.add(ring);
          (v.userData as { ring?: THREE.Mesh }).ring = ring;
          // rideable vehicles for the player: the chosen transport mode is
          // shown under the figure while it moves (bike / scooter / taxi /
          // bus), so picking a mode is something you can actually see
          const veh = new THREE.Group();
          veh.visible = false;
          const tyreMat = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.9 });
          const mkWheelZ = (r: number, wdt: number) => {
            const wgeo = new THREE.CylinderGeometry(r, r, wdt, 12);
            const wm = new THREE.Mesh(wgeo, tyreMat);
            wm.rotation.z = Math.PI / 2;
            wm.castShadow = true;
            return wm;
          };
          const bike = new THREE.Group();
          bike.name = "veh-bike";
          for (const wz of [-0.48, 0.48]) {
            const wgeo = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 6, 16), tyreMat);
            wgeo.rotation.y = Math.PI / 2;
            wgeo.position.set(0, 0.3, wz);
            bike.add(wgeo);
          }
          const bFrame = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.85), new THREE.MeshStandardMaterial({ color: 0xe63a1f, roughness: 0.5, metalness: 0.4 }));
          bFrame.position.set(0, 0.52, 0);
          bFrame.rotation.x = 0.18;
          bike.add(bFrame);
          const bBar = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.06), tyreMat);
          bBar.position.set(0, 0.78, 0.5);
          bike.add(bBar);
          const bSeat = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.07, 0.32), tyreMat);
          bSeat.position.set(0, 0.68, -0.3);
          bike.add(bSeat);
          veh.add(bike);
          const moto = new THREE.Group();
          moto.name = "veh-moto";
          const mBody = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.34, 1.2), new THREE.MeshStandardMaterial({ color: 0xff8a00, roughness: 0.45, metalness: 0.25 }));
          mBody.position.set(0, 0.48, 0);
          mBody.castShadow = true;
          moto.add(mBody);
          const mShield = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.08), new THREE.MeshStandardMaterial({ color: 0xdfe9f2, roughness: 0.3, metalness: 0.3 }));
          mShield.position.set(0, 0.82, 0.52);
          mShield.rotation.x = -0.25;
          moto.add(mShield);
          const mSeat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.09, 0.62), tyreMat);
          mSeat.position.set(0, 0.68, -0.12);
          moto.add(mSeat);
          for (const wz of [-0.52, 0.52]) {
            const wm = mkWheelZ(0.27, 0.12);
            wm.position.set(0, 0.27, wz);
            moto.add(wm);
          }
          veh.add(moto);
          const car = new THREE.Group();
          car.name = "veh-taxi";
          const cBody = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.52, 2.2), new THREE.MeshStandardMaterial({ color: 0x2f9e6b, roughness: 0.35, metalness: 0.35 }));
          cBody.position.set(0, 0.55, 0);
          cBody.castShadow = true;
          car.add(cBody);
          // tall glass cabin: the driver sits inside it, on the seat, bent
          // legs tucked into the body — never standing through the roof
          const cCab = new THREE.Mesh(new THREE.BoxGeometry(0.94, 1.2, 1.5), new THREE.MeshStandardMaterial({ color: 0xbfe3f2, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.45 }));
          cCab.position.set(0, 1.4, 0);
          car.add(cCab);
          const cRoof = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.06, 1.55), new THREE.MeshStandardMaterial({ color: 0x2f9e6b, roughness: 0.4, metalness: 0.3 }));
          cRoof.position.set(0, 2.03, 0);
          car.add(cRoof);
          const cSeat = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.9 }));
          cSeat.position.set(0, 0.62, 0.05);
          car.add(cSeat);
          const cSeatBack = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.55, 0.12), cSeat.material);
          cSeatBack.position.set(0, 0.95, -0.24);
          car.add(cSeatBack);
          const cSign = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.22), new THREE.MeshStandardMaterial({ color: 0xfff3cf, emissive: 0xffc873, emissiveIntensity: 0.5 }));
          cSign.position.set(0, 2.16, 0);
          car.add(cSign);
          for (const wx of [-0.53, 0.53]) for (const wz of [-0.8, 0.8]) {
            const wm = mkWheelZ(0.28, 0.1);
            wm.position.set(wx, 0.28, wz);
            car.add(wm);
          }
          veh.add(car);
          const bus = new THREE.Group();
          bus.name = "veh-bus";
          const uBody = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.95, 2.6), new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4, metalness: 0.3 }));
          uBody.position.set(0, 0.62, 0);
          uBody.castShadow = true;
          bus.add(uBody);
          // glass band tall enough for a seated passenger to be seen inside
          const uWin = new THREE.Mesh(new THREE.BoxGeometry(1.17, 1.05, 2.5), new THREE.MeshStandardMaterial({ color: 0xbfe3f2, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.45 }));
          uWin.position.set(0, 1.66, 0);
          bus.add(uWin);
          const uRoof = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.07, 2.6), new THREE.MeshStandardMaterial({ color: 0x2f6fd0, roughness: 0.4, metalness: 0.3 }));
          uRoof.position.set(0, 2.22, 0);
          bus.add(uRoof);
          const uSeat = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.9 }));
          uSeat.position.set(0, 0.72, 0.1);
          bus.add(uSeat);
          const uSeatBack = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.55, 0.12), uSeat.material);
          uSeatBack.position.set(0, 1.05, -0.19);
          bus.add(uSeatBack);
          for (const wx of [-0.58, 0.58]) for (const wz of [-0.95, 0.95]) {
            const wm = mkWheelZ(0.32, 0.12);
            wm.position.set(wx, 0.32, wz);
            bus.add(wm);
          }
          veh.add(bus);
          v.add(veh);
          (v.userData as { veh?: THREE.Group }).veh = veh;
        }
        scene.add(v);
        actorViews.set(a.key, v);
        const chipEl = mkChip("", "");
        chipEl.style.cssText += `font:700 10.5px 'Noto Sans SC',sans-serif;padding:2px 7px;border-radius:999px;${a.isSelf ? "background:#14202b;color:#fff;" : "background:rgba(255,253,248,.92);color:#14202b;border:1px solid rgba(20,26,32,.4);"}`;
        actorChips.set(a.key, { el: chipEl, kind: "actor", self: !!a.isSelf, w: 0, h: 0, lastText: "", visible: true, clampDx: 0, clampDy: 0, getPos: () => ({ x: a.x, y: LAND + 3.6, z: a.z }) });
        chips.push(actorChips.get(a.key)!);
      }
      return v;
    };

    /* ---- interaction: orbit / zoom / pick ---- */
    const dom = renderer.domElement;
    let dragging = false;
    let moved = 0;
    let px = 0;
    let py = 0;
    let hover: { x: number; y: number } | null = null;
    const HOVER_R = 140; // px around the cursor where every label shows
    const onDown = (e: PointerEvent) => {
      dragging = true;
      camRef.current.lastUser = performance.now();
      moved = 0;
      px = e.clientX;
      py = e.clientY;
      dom.setPointerCapture(e.pointerId);
      dom.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - px;
      const dy = e.clientY - py;
      moved += Math.abs(dx) + Math.abs(dy);
      px = e.clientX;
      py = e.clientY;
      camRef.current.az -= dx * 0.005;
      camRef.current.pol = Math.max(0.35, Math.min(1.35, camRef.current.pol - dy * 0.004));
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      dom.style.cursor = "grab";
      if (moved < 6) {
        // treat as click: raycast buildings
        const rect = dom.getBoundingClientRect();
        const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        const rc = new THREE.Raycaster();
        rc.setFromCamera(ndc, camera);
        const hits = rc.intersectObjects(pickMeshes, false);
        const id = hits[0]?.object.userData.locId as string | undefined;
        if (id) propsRef.current.onSelect(id);
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camRef.current.lastUser = performance.now();
      autoFitRef.current = false;
      // a trackpad pinch arrives as ctrl+wheel with small deltas: scale it
      // multiplicatively so pinching feels like pinching
      const d = camRef.current.dist;
      const next = e.ctrlKey ? d * Math.exp(e.deltaY * 0.012) : d + e.deltaY * 0.05;
      camRef.current.dist = Math.max(16, Math.min(130, next));
      setZoomPct(Math.round((fitDistRef.current / camRef.current.dist) * 100));
    };
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerup", onUp);
    // Wheel / pinch anywhere over the map (labels, chips and the corner
    // controls included), not just on the bare canvas: a pinch that lands
    // on a label would otherwise reach the browser and magnify the whole
    // page, pushing the header and side panels out of view.
    const wheelTarget = mount.parentElement ?? dom;
    wheelTarget.addEventListener("wheel", onWheel, { passive: false });
    // Hover reveal: where the mouse rests, every label around it shows
    // (past the density cap and the zoomed-out cut), so you can read a
    // crowded neighbourhood without zooming in. Touch has no hover.
    const onHover = (e: PointerEvent) => {
      if (e.pointerType === "touch" || dragging) { hover = null; return; }
      const r = mount.getBoundingClientRect();
      hover = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onHoverOut = () => { hover = null; };
    wheelTarget.addEventListener("pointermove", onHover);
    wheelTarget.addEventListener("pointerleave", onHoverOut);

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      fx?.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // Re-frame for the new size: the fill distance depends on the
      // canvas aspect, so fullscreen, window resizes and panel collapses
      // all re-fit the city to the frame while auto-fit is armed.
      fitDistRef.current = fitDistForAspect(w / h);
      if (autoFitRef.current) {
        camRef.current.dist = fitDistRef.current;
        setZoomPct(100);
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    /* ---- day cycle palettes ---- */
    const skyDay = new THREE.Color(0xbfd9e8);
    const skyDusk = new THREE.Color(0xf2a56b);
    const skyNight = new THREE.Color(0x14263f);
    const sunDay = new THREE.Color(0xfff2d8);
    const sunDusk = new THREE.Color(0xff9a4d);
    const tmpColor = new THREE.Color();
    // frame-loop scratch objects + colour constants, allocated once (the loop
    // used to new() these every frame → steady GC pressure / hitches)
    const C_GREY = new THREE.Color(0x8d9aa3);
    const C_WATER_NIGHT = new THREE.Color(0x14324e);
    const C_CLOUD_NIGHT = new THREE.Color(0x5a6c85);
    const C_CLOUD_DUSK = new THREE.Color(0xffb37a);
    const C_CLOUD_GREY = new THREE.Color(0x707c85);
    const C_MOTE_NIGHT = new THREE.Color(0xffd98a);
    const carMat4 = new THREE.Matrix4();
    const carQuat = new THREE.Quaternion();
    const carScl = new THREE.Vector3(1, 1, 1);
    const carEuler = new THREE.Euler();
    const shirtTmp = new THREE.Color();

    const v3 = new THREE.Vector3();
    let raf = 0;
    let declutterTick = 0;
    let last = performance.now();
    const clockStart = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (propsRef.current.paused) {
        last = now;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const tSec = (now - clockStart) / 1000;

      // day cycle: the phase advances at the REAL rate (one day per
      // 86,400s) from the phase base; the ☀️/🌇/🌙 jumps, the 🕐 real-time
      // resync and the 🎥 30s-day demo mode all rebase through phaseRef.
      const pr = phaseRef.current!;
      const dayT = (((pr.base + ((now - pr.at) / 1000) * rateRef.current) % 1) + 1) % 1;
      const sunAng = dayT * Math.PI * 2 - Math.PI / 2;
      const elev = Math.sin(sunAng);
      const dayF = THREE.MathUtils.smoothstep(elev, -0.08, 0.25);
      const duskF = Math.max(0, 1 - Math.abs(elev) * 3.2) * (elev > -0.25 ? 1 : 0);
      sun.position.set(Math.cos(sunAng) * 90, Math.max(6, elev * 95), 42);
      sun.intensity = 0.25 + dayF * 2;
      tmpColor.copy(sunDay).lerp(sunDusk, duskF);
      sun.color.copy(tmpColor);
      hemi.intensity = 0.22 + dayF * 0.75;
      amb.intensity = 0.12 + dayF * 0.1;
      tmpColor.copy(skyNight).lerp(skyDay, dayF).lerp(skyDusk, duskF * 0.55);
      // REAL weather bends the sky: cloud/overcast/rain/storm/fog grey it
      // out and dim the sun; rain actually falls. Kind comes from the
      // server's live weather for the played city (App prop).
      const wk = propsRef.current.weatherKind ?? "unknown";
      const greyF = wk === "storm" ? 0.55 : wk === "overcast" || wk === "fog" ? 0.5 : wk === "rain" ? 0.45 : wk === "cloudy" ? 0.22 : wk === "partly" ? 0.08 : 0;
      if (greyF > 0) tmpColor.lerp(C_GREY, greyF * (0.3 + 0.7 * dayF));
      (scene.background as THREE.Color).copy(tmpColor);
      scene.fog!.color.copy(tmpColor);
      sun.intensity *= 1 - greyF * 0.65;
      const raining = wk === "rain" || wk === "storm";
      rainPts.visible = raining;
      if (raining) {
        rainMat.opacity = wk === "storm" ? 0.75 : 0.5;
        rainPts.position.y = -((tSec * (wk === "storm" ? 17 : 12)) % 24);
        rainPts.position.x = Math.sin(tSec * 0.7) * 0.6;
      }
      const nightF = 1 - dayF;
      waterMat.color.setHex(0x2e7fb8).lerp(C_WATER_NIGHT, nightF * 0.8);
      waterMat.roughness = 0.35 - dayF * 0.12 + nightF * 0.1;
      // ---- drive every animated material off the day cycle ----
      renderer.toneMappingExposure = 1.08 - nightF * 0.16 + duskF * 0.04;
      (scene.fog as THREE.Fog).near = 120 - nightF * 32 - (wk === "fog" ? 55 : wk === "storm" ? 30 : wk === "rain" ? 18 : 0);
      (scene.fog as THREE.Fog).far = 240 - nightF * 45 - (wk === "fog" ? 95 : wk === "storm" ? 55 : wk === "rain" ? 35 : 0);
      moon.intensity = nightF * 0.55;
      playerLight.intensity = nightF * 26 + duskF * 8;
      for (const m of buildingMats) m.emissiveIntensity = nightF * 0.95 + duskF * 0.3;
      if (fillerMat) fillerMat.emissiveIntensity = nightF * 0.5;
      if (bulbMat) bulbMat.emissiveIntensity = 0.15 + nightF * 2.4;
      if (glowMat) glowMat.opacity = nightF * 0.75;
      if (foamMat) foamMat.opacity = 0.22 + 0.18 * (0.5 + 0.5 * Math.sin(tSec * 1.4));
      neonMats.forEach((m, i) => {
        m.emissiveIntensity = 0.35 + nightF * 1.5 + Math.sin(tSec * 2.4 + i * 1.7) * (0.12 + nightF * 0.3);
      });
      avLights.forEach((av, i) => {
        const m = av.material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = nightF > 0.25 && Math.sin(tSec * 2 + i * 1.3) > 0 ? 2.4 : 0.15;
      });
      cloudMat.color.setHex(0xffffff).lerp(C_CLOUD_NIGHT, nightF * 0.75).lerp(C_CLOUD_DUSK, duskF * 0.4);
      if (greyF > 0.15) cloudMat.color.lerp(C_CLOUD_GREY, greyF * 0.7);
      cloudMat.opacity = Math.min(0.97, 0.88 - nightF * 0.3 + greyF * 0.35);
      moteMat.opacity = 0.22 + nightF * 0.4;
      moteMat.color.setHex(0xfff3cf).lerp(C_MOTE_NIGHT, nightF);
      motes.rotation.y = tSec * 0.006;
      motes.position.y = Math.sin(tSec * 0.25) * 0.35;
      for (const s of smokeSprites) {
        s.phase += dt * 0.14;
        if (s.phase > 1) s.phase -= 1;
        const ph = s.phase;
        s.sp.position.set(s.x + Math.sin(ph * 5 + s.z) * 0.4 + ph * 0.9, LAND + 1.7 + ph * 3.6, s.z + Math.cos(ph * 4) * 0.2);
        const sc = 1.1 + ph * 2.1;
        s.sp.scale.set(sc, sc, 1);
        (s.sp.material as THREE.SpriteMaterial).opacity = 0.17 * Math.sin(ph * Math.PI) * (0.5 + dayF * 0.5);
      }
      for (const g of flagGroups) {
        const f = (g.userData as { flag?: THREE.Mesh }).flag;
        if (f) f.rotation.y = Math.sin(tSec * 3 + g.position.x) * 0.35;
      }
      for (const w of wheelGroups) w.rotation.z = tSec * 0.25;
      for (const cl of clouds) {
        cl.position.x += dt * 0.55;
        if (cl.position.x > 55) cl.position.x = -55;
      }
      water.position.y = Math.sin(tSec * 0.7) * 0.05;

      // traffic
      {
        cars.forEach((car, i) => {
          car.t += car.speed * dt * car.dir;
          if (car.t > 1) car.t -= 1;
          if (car.t < 0) car.t += 1;
          const r = car.road;
          const ang = Math.atan2(r.z2 - r.z1, r.x2 - r.x1);
          const pxv = r.x1 + (r.x2 - r.x1) * car.t + Math.sin(ang) * car.lane;
          const pzv = r.z1 + (r.z2 - r.z1) * car.t - Math.cos(ang) * car.lane;
          carQuat.setFromEuler(carEuler.set(0, -ang + (car.dir < 0 ? Math.PI : 0), 0));
          carMat4.compose(v3.set(pxv, LAND + 0.38, pzv), carQuat, carScl);
          carMesh.setMatrixAt(i, carMat4);
        });
        carMesh.instanceMatrix.needsUpdate = true;
      }

      // actors
      const locsNow = getLocations(propsRef.current.cityKey);
      for (const a of actorsRef.current.values()) {
        const view = ensureActorView(a);
        const dx = a.tx - a.x;
        const dz = a.tz - a.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.06) {
          const sp = (a.speed || 4.2) * dt;
          const step = Math.min(dist, sp);
          a.x += (dx / dist) * step;
          a.z += (dz / dist) * step;
        } else if (a.wander) {
          // behaviour by identity: stay roles keep to their corner (摊主守摊、
          // 同事守工位、邻居在家附近), patrol roles roam a beat (保安、保洁),
          // commuters cross the city between stations and workplaces (骑手、
          // 通勤族), everyone else wanders freely.
          const chance = a.behavior === "stay" ? 0.0016 : a.behavior === "patrol" ? 0.006 : a.behavior === "commute" ? 0.0032 : 0.004;
          if (Math.random() < chance) {
            if (a.behavior === "stay") {
              a.tx += (Math.random() - 0.5) * 2.4;
              a.tz += (Math.random() - 0.5) * 2;
            } else {
              const loc = locsNow[Math.floor(Math.random() * locsNow.length)];
              if (loc) {
                a.tx = loc.x + (Math.random() - 0.5) * 1.6;
                a.tz = loc.z + (Math.random() - 0.5) * 1.4;
              }
            }
          }
        }
        // walk cycle: blend in limb swing + lean while moving, breathe at idle
        const moving = dist > 0.06;
        a.blend += ((moving ? 1 : 0) - a.blend) * Math.min(1, dt * 7);
        if (moving) {
          a.phase += dt * (a.isSelf ? 10.5 : 8.5);
          const targetHeading = Math.atan2(dx, dz);
          let dh = targetHeading - a.heading;
          while (dh > Math.PI) dh -= Math.PI * 2;
          while (dh < -Math.PI) dh += Math.PI * 2;
          a.heading += dh * Math.min(1, dt * 10);
        }
        const bob = Math.abs(Math.sin(a.phase)) * 0.11 * a.blend + Math.sin(tSec * 1.6 + a.seed) * 0.012 * (1 - a.blend);
        view.position.set(a.x, LAND + bob, a.z);
        view.rotation.y = a.heading;
        view.rotation.x = a.blend * 0.07;
        const limbs = (view.userData as { limbs?: ActorLimbs }).limbs;
        if (limbs) {
          const swing = Math.sin(a.phase) * 0.62 * a.blend;
          const idleSway = Math.sin(tSec * 1.6 + a.seed) * 0.045 * (1 - a.blend);
          limbs.legL.rotation.x = swing;
          limbs.legR.rotation.x = -swing;
          limbs.armL.rotation.x = -swing * 0.8 + idleSway;
          limbs.armR.rotation.x = swing * 0.8 - idleSway;
        }
        if (a.isSelf) playerLight.position.set(a.x, LAND + 3.2, a.z);
        if (a.isSelf) {
          // ride the chosen vehicle while moving — and SIT on it: the pose
          // blends from the walk cycle into a true seated posture (hips on
          // the saddle/seat, legs bent forward onto pedals / floorboard /
          // tucked inside the car body, hands on the bars or wheel), never
          // a walking figure hovering over a vehicle with legs swinging
          const veh = (view.userData as { veh?: THREE.Group }).veh;
          const bodyG = (view.userData as { body?: THREE.Group }).body;
          if (veh && bodyG) {
            const mode = propsRef.current.travelModeId ?? "walk";
            const wantMode = mode === "bike" || mode === "moto" || mode === "taxi" || mode === "bus" ? mode : null;
            if (wantMode) a.rideMode = wantMode;
            const ridingNow = wantMode !== null && moving;
            a.rideBlend = (a.rideBlend ?? 0) + ((ridingNow ? 1 : 0) - (a.rideBlend ?? 0)) * Math.min(1, dt * 6);
            const rb = a.rideBlend ?? 0;
            const rm = a.rideMode ?? "bike";
            veh.visible = rb > 0.03;
            const limbs0 = (view.userData as { limbs?: ActorLimbs }).limbs;
            if (veh.visible && limbs0) {
              for (const child of veh.children) child.visible = child.name === `veh-${rm}`;
              const seat = rm === "bike" ? { y: -0.14, s: 1 } : rm === "moto" ? { y: -0.1, s: 1 } : rm === "taxi" ? { y: 0.03, s: 0.9 } : { y: 0.18, s: 0.9 };
              bodyG.position.y = seat.y * rb;
              const sc = 1 + (seat.s - 1) * rb;
              bodyG.scale.set(sc, sc, sc);
              limbs0.legL.visible = true;
              limbs0.legR.visible = true;
              const mix = (cur: number, target: number) => cur * (1 - rb) + target * rb;
              if (rm === "bike") {
                const pedal = Math.sin(a.phase * 0.55) * 0.38;
                limbs0.legL.rotation.x = mix(limbs0.legL.rotation.x, -1.05 + pedal);
                limbs0.legR.rotation.x = mix(limbs0.legR.rotation.x, -1.05 - pedal);
                limbs0.armL.rotation.x = mix(limbs0.armL.rotation.x, -0.95);
                limbs0.armR.rotation.x = mix(limbs0.armR.rotation.x, -0.95);
              } else if (rm === "moto") {
                limbs0.legL.rotation.x = mix(limbs0.legL.rotation.x, -1.18);
                limbs0.legR.rotation.x = mix(limbs0.legR.rotation.x, -1.18);
                limbs0.armL.rotation.x = mix(limbs0.armL.rotation.x, -0.9);
                limbs0.armR.rotation.x = mix(limbs0.armR.rotation.x, -0.9);
              } else {
                limbs0.legL.rotation.x = mix(limbs0.legL.rotation.x, -1.28);
                limbs0.legR.rotation.x = mix(limbs0.legR.rotation.x, -1.28);
                limbs0.armL.rotation.x = mix(limbs0.armL.rotation.x, -0.25);
                limbs0.armR.rotation.x = mix(limbs0.armR.rotation.x, -0.68);
              }
              // seated: the walk bob dies away, a whisper of engine buzz stays
              view.position.y = LAND + bob * (1 - rb) + Math.sin(tSec * 31) * 0.008 * rb;
            } else {
              bodyG.position.y = 0;
              bodyG.scale.set(1, 1, 1);
            }
          }
          // trail: new destination → fresh trail; moving → sample points
          if (propsRef.current.selfLocId !== trailFor) {
            trailFor = propsRef.current.selfLocId;
            trailCount = 0;
            trailGeo.setDrawRange(0, 0);
            pushTrail(a.x, a.z);
          }
          if (moving && Math.hypot(a.x - trailLast.x, a.z - trailLast.z) > 0.7) pushTrail(a.x, a.z);
        }
        const ring = (view.userData as { ring?: THREE.Mesh }).ring;
        if (ring) {
          const s = 1 + Math.sin(tSec * 3) * 0.12;
          ring.scale.set(s, s, 1);
        }
        const mats = (view.userData as { mats?: { shirt: THREE.MeshStandardMaterial; dark: THREE.MeshStandardMaterial; pants: THREE.MeshStandardMaterial } }).mats;
        if (mats) {
          mats.shirt.color.setHex(a.shirt);
          mats.dark.color.copy(shirtTmp.setHex(a.shirt).multiplyScalar(0.78));
          mats.pants.color.setHex(a.pants);
        }
        const acc = (view.userData as { acc?: THREE.Group }).acc;
        if (acc) for (const child of acc.children) child.visible = child.name === `acc-${a.accessory}`;
        const chip = actorChips.get(a.key);
        if (chip) { const t = a.isSelf ? `${a.name}（你）` : a.name; if (chip.src !== t) { chip.src = t; chip.el.textContent = t; } }
      }
      for (const key of Array.from(actorViews.keys())) {
        if (!actorsRef.current.has(key)) {
          const v = actorViews.get(key);
          if (v) scene.remove(v);
          actorViews.delete(key);
          const chip = actorChips.get(key);
          if (chip) {
            chip.el.remove();
            const idx = chips.indexOf(chip);
            if (idx >= 0) chips.splice(idx, 1);
            actorChips.delete(key);
          }
        }
      }

      // camera follows the player, user keeps orbit/zoom; in cinematic mode
      // it eases, leads the walk direction, pushes in on arrival, and drifts
      // very slowly when the user has not touched it for a while
      const self = actorsRef.current.get("self");
      const cam = camRef.current;
      if (self) {
        const look = lookRef.current;
        if (look && performance.now() < look.until) {
          // search focus wins for a few seconds: pan to the searched place
          cam.tx += (THREE.MathUtils.clamp(look.x, -37, 37) - cam.tx) * Math.min(1, dt * 2.6);
          cam.tz += (THREE.MathUtils.clamp(look.z, -23, 23) - cam.tz) * Math.min(1, dt * 2.6);
        } else {
          const lead = cineRef.current && self.blend > 0.3 ? self.blend : 0;
          const leadX = Math.sin(self.heading) * 1.6 * lead;
          const leadZ = Math.cos(self.heading) * 1.6 * lead;
          // Follow behaviour splits by state:
          // · MOVING — the camera travels WITH the player like a real map:
          //   the target tracks the figure's live position (not just the
          //   destination), easing at a rate that keeps up at vehicle
          //   speeds, and the map's orientation never changes on its own.
          // · STILL at overview distance — the frame re-anchors on the
          //   LAND's centre so the whole city stays the picture (pure
          //   player-follow pushed the city into the top half whenever
          //   the player stood in the south, leaving empty sea below).
          // Target clamps span nearly the whole miniature (±37 / ±23),
          // so following never stalls at the map's edge districts.
          const movingNow = self.blend > 0.25;
          const centerW = movingNow ? 0 : 0.62 * THREE.MathUtils.clamp((cam.distCur - 36) / 26, 0, 1);
          const fx = (self.x + leadX) * (1 - centerW) + LAND_CX * centerW;
          const fz = (self.z + leadZ) * (1 - centerW) + LAND_CZ * centerW;
          const ease = movingNow ? Math.min(1, dt * 4.2) : Math.min(1, dt * 2.2);
          cam.tx += (THREE.MathUtils.clamp(fx, -37, 37) - cam.tx) * ease;
          cam.tz += (THREE.MathUtils.clamp(fz, -23, 23) - cam.tz) * ease;
          // No automatic azimuth swing: like a real map app the city keeps
          // its orientation while you travel; only the user rotates it.
        }
      }
      if (focusRef.current > 0) focusRef.current = Math.max(0, focusRef.current - dt * 0.45);
      const pulse = cineRef.current ? Math.sin(Math.min(1, focusRef.current) * Math.PI) : 0;
      if (cam.cut > 0) cam.cut = Math.max(0, cam.cut - dt * 1.3);
      const cutEase = cam.cut * cam.cut;
      const wantDist = cam.dist * (1 - pulse * 0.16) * (1 - cutEase * 0.1);
      cam.distCur += (wantDist - cam.distCur) * Math.min(1, dt * 3.2);
      const distNow = cam.distCur;
      const azNow = cam.az + cutEase * 0.5;
      const cx = cam.tx + Math.sin(azNow) * Math.sin(cam.pol) * distNow;
      const cy = Math.cos(cam.pol) * distNow + 2;
      const cz = cam.tz + Math.cos(azNow) * Math.sin(cam.pol) * distNow;
      camera.position.set(cx, Math.max(4, cy), cz);
      camera.lookAt(cam.tx, LAND, cam.tz);
      const targetFov = cineRef.current && self ? 42 + self.blend * 2.5 : 42;
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
        camera.updateProjectionMatrix();
      }

      // labels — decluttered. Every chip used to be drawn at once, so at the
      // default city-wide view ~90 pills (places + NPC name tags + metro
      // lines + road names) stacked into one unreadable blob. Now placement
      // is greedy by priority every few frames: you > where you stand >
      // people near you > nearby places > metro lines > road names, and any
      // chip that would overlap an already-placed one is hidden until the
      // camera moves or zooms. Zoomed out, NPC name tags (their emoji heads
      // stay in 3D) and road names drop out entirely; zoom in and everything
      // nearby comes back.
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      const overview = distNow > fitDistRef.current * 0.98;
      declutterTick++;
      const redo = declutterTick % 3 === 1;
      const placed: { x1: number; y1: number; x2: number; y2: number }[] = [];
      const density = labelDensityRef.current;
      const english = document.documentElement.lang === "en";
      // how many place labels may show at once (zoomed out it is the city view)
      const locCap = density === "all" ? 999 : overview ? (density === "few" ? 8 : 22) : density === "few" ? 14 : 60;
      let locShown = 0;
      const cands: { chip: Chip; sx: number; sy: number; prio: number; near: boolean }[] = [];
      for (const chip of chips) {
        const pos = chip.getPos();
        v3.set(pos.x, pos.y, pos.z).project(camera);
        if (v3.z > 1 || v3.z < -1) {
          chip.visible = false;
          chip.el.style.display = "none";
          continue;
        }
        const sx = (v3.x * 0.5 + 0.5) * w;
        const sy = (-v3.y * 0.5 + 0.5) * h;
        if (!redo) {
          if (chip.visible) {
            chip.el.style.transform = `translate(-50%,-100%) translate(${(sx + chip.clampDx).toFixed(1)}px,${(sy + chip.clampDy).toFixed(1)}px)`;
          }
          continue;
        }
        const dCam = Math.hypot(pos.x - cam.tx, pos.z - cam.tz);
        const dHover = hover ? Math.hypot(sx - hover.x, sy - hover.y) : Infinity;
        const near = dHover < HOVER_R;
        let prio: number;
        if (chip.kind === "actor") {
          if (chip.self) prio = 0;
          else {
            if (!near && ((overview && dCam > 20) || (density !== "all" && dCam > (density === "few" ? 6 : 12)))) {
              chip.visible = false;
              chip.el.style.display = "none";
              continue;
            }
            prio = 2 + dCam / 40;
          }
        } else if (chip.kind === "loc") {
          prio = (chip.locId !== undefined && chip.locId === propsRef.current.selfLocId ? 1 : 3) + dCam / 60;
        } else if (chip.station || chip.place) {
          if (!near && (overview || dCam > (chip.place ? 18 : 14))) {
            chip.visible = false;
            chip.el.style.display = "none";
            continue;
          }
          prio = (chip.place ? 9.3 : 9.5) + dCam / 40;
        } else if (chip.metro) {
          if (density === "few") {
            chip.visible = false;
            chip.el.style.display = "none";
            continue;
          }
          prio = 8;
        } else {
          if (overview) {
            chip.visible = false;
            chip.el.style.display = "none";
            continue;
          }
          prio = 9;
        }
        // around the cursor: labels win over the rest, closest first
        if (near && !chip.self && (chip.kind !== "road" || chip.station || chip.place)) prio = 0.5 + dHover / HOVER_R;
        // the English subtitle duplicates the name in English mode, and is
        // noise at city scale: show it only zoomed in, in Chinese
        if (chip.sub) {
          const want = overview || english || density === "few" ? "none" : "";
          if (chip.sub.style.display !== want) { chip.sub.style.display = want; chip.w = 0; }
        }
        const txt = chip.el.textContent ?? "";
        if (chip.w === 0 || (chip.kind === "actor" && txt !== chip.lastText)) {
          chip.el.style.display = "";
          chip.w = chip.el.offsetWidth;
          chip.h = chip.el.offsetHeight;
          chip.lastText = txt;
        }
        if (chip.w === 0) continue;
        cands.push({ chip, sx, sy, prio, near });
      }
      if (redo) {
        cands.sort((a, b) => a.prio - b.prio);
        for (const c of cands) {
          if (!c.near && c.chip.kind === "loc" && !c.chip.self && c.chip.locId !== propsRef.current.selfLocId && c.chip.locId !== propsRef.current.destLocId && locShown >= locCap) {
            c.chip.visible = false;
            c.chip.el.style.display = "none";
            continue;
          }
          const hw = c.chip.w / 2 + (density === "all" || c.near ? 3 : 9);
          /* Edge clamp: pull the anchor inward so the WHOLE chip stays on
             screen — a place at the map's edge used to get its label sliced
             in half by the overlay edge. The delta is remembered on the
             chip so the between-pass frames stay clamped too. */
          const EDGE = 6;
          let ax = c.sx;
          let ay = c.sy;
          if (c.chip.w + 8 > w - EDGE * 2) ax = w / 2;
          else {
            if (ax - hw < EDGE) ax = EDGE + hw;
            if (ax + hw > w - EDGE) ax = w - EDGE - hw;
          }
          if (ay - c.chip.h - 5 < EDGE) ay = EDGE + c.chip.h + 5;
          if (ay + 2 > h - EDGE) ay = h - EDGE - 2;
          c.chip.clampDx = ax - c.sx;
          c.chip.clampDy = ay - c.sy;
          const box = { x1: ax - hw, y1: ay - c.chip.h - 5, x2: ax + hw, y2: ay + 2 };
          const hit = placed.some((b) => box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1);
          if (hit) {
            c.chip.visible = false;
            c.chip.el.style.display = "none";
            continue;
          }
          placed.push(box);
          if (c.chip.kind === "loc") locShown++;
          c.chip.visible = true;
          c.chip.el.style.display = "";
          c.chip.el.style.transform = `translate(-50%,-100%) translate(${ax.toFixed(1)}px,${ay.toFixed(1)}px)`;
          if (c.chip.kind === "loc") {
            const pos = c.chip.getPos();
            const d = Math.hypot(pos.x - cam.tx, pos.z - cam.tz);
            c.chip.el.style.opacity = d > 46 ? "0.55" : "1";
          }
        }
      }

      if (fx) fx.render();
      else renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      fx?.dispose();
      ro.disconnect();
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerup", onUp);
      wheelTarget.removeEventListener("wheel", onWheel);
      wheelTarget.removeEventListener("pointermove", onHover);
      wheelTarget.removeEventListener("pointerleave", onHoverOut);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      labels.innerHTML = "";
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Sprite || o instanceof THREE.Points) {
          const mesh = o as THREE.Mesh;
          mesh.geometry?.dispose?.();
          const m = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m?.dispose?.();
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.cityKey]);

  const zoomBy = (f: number) => {
    autoFitRef.current = false;
    camRef.current.dist = Math.max(16, Math.min(130, camRef.current.dist * f));
    setZoomPct(Math.round((fitDistRef.current / camRef.current.dist) * 100));
  };
  const resetCam = () => {
    camRef.current.az = -0.55;
    camRef.current.pol = CAM_POL;
    autoFitRef.current = true;
    camRef.current.dist = fitDistRef.current;
    setZoomPct(100);
  };

  /* ---- minimap: world bounds shared by the draw + click mapping ---- */
  const MINI = { xMin: -40, xMax: 40, zMin: -25, zMax: 19 };
  useEffect(() => {
    if (!miniOpen) return;
    const draw = () => {
      const cv = miniCanvasRef.current;
      if (!cv) return;
      const g = cv.getContext("2d");
      if (!g) return;
      const W = cv.width, H = cv.height;
      const px = (x: number) => ((x - MINI.xMin) / (MINI.xMax - MINI.xMin)) * W;
      const py = (z: number) => ((z - MINI.zMin) / (MINI.zMax - MINI.zMin)) * H;
      const sx = W / (MINI.xMax - MINI.xMin);
      const cityKey = propsRef.current.cityKey;
      const locs = getLocations(cityKey);
      // sea, then the landmass deck (schematic, same bounds as the 3D one)
      const sea = g.createLinearGradient(0, 0, 0, H);
      sea.addColorStop(0, "#0d2c4c"); sea.addColorStop(1, "#14507e");
      g.fillStyle = sea; g.fillRect(0, 0, W, H);
      g.fillStyle = "#476a4d";
      g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 2;
      const lx = px(-38), ly = py(-24), lw = px(38) - lx, lh = py(14) - ly;
      g.beginPath(); g.rect(lx, ly, lw, lh); g.fill(); g.stroke();
      // road corridors
      g.strokeStyle = "rgba(255,240,200,0.4)"; g.lineCap = "round";
      for (const r of ROADS[cityKey]) {
        g.lineWidth = Math.max(1.4, Math.min(4, r.w * sx * 0.55));
        g.beginPath(); g.moveTo(px(r.x1), py(r.z1)); g.lineTo(px(r.x2), py(r.z2)); g.stroke();
      }
      // every location as a faint dot
      g.fillStyle = "rgba(255,233,184,0.75)";
      for (const l of locs) { g.beginPath(); g.arc(px(l.x), py(l.z), 3, 0, Math.PI * 2); g.fill(); }
      const actors = actorsRef.current;
      const self = actors.get("self");
      // destination: pulsing red target while it differs from where you stand
      const dest = propsRef.current.destLocId ? resolveLoc(cityKey, propsRef.current.destLocId) : undefined;
      if (dest && (!self || Math.hypot(dest.x - self.x, dest.z - self.z) > 2)) {
        const pulse = 7 + Math.sin(performance.now() / 280) * 2.5;
        g.strokeStyle = "#ff4d2e"; g.lineWidth = 3;
        g.beginPath(); g.arc(px(dest.x), py(dest.z), pulse, 0, Math.PI * 2); g.stroke();
        g.fillStyle = "#ff4d2e";
        g.beginPath(); g.arc(px(dest.x), py(dest.z), 3.4, 0, Math.PI * 2); g.fill();
      }
      // camera view centre: a dashed ring showing where the big map looks
      const cam = camRef.current;
      g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 1.6; g.setLineDash([5, 4]);
      g.beginPath(); g.arc(px(cam.tx), py(cam.tz), Math.max(8, cam.distCur * 0.3 * sx), 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
      // NPCs + remote players (live positions, straight from the actor set)
      for (const a of actors.values()) {
        if (a.isSelf) continue;
        const col = `#${a.color.toString(16).padStart(6, "0")}`;
        if (a.key.startsWith("npc-")) {
          g.fillStyle = col; g.globalAlpha = 0.85;
          g.beginPath(); g.arc(px(a.x), py(a.z), 3.6, 0, Math.PI * 2); g.fill();
          g.globalAlpha = 1;
        } else {
          g.fillStyle = col;
          g.strokeStyle = "#ffffff"; g.lineWidth = 1.8;
          g.beginPath(); g.arc(px(a.x), py(a.z), 5, 0, Math.PI * 2); g.fill(); g.stroke();
        }
      }
      // you: the biggest dot, white ring + heading tick
      if (self) {
        const col = `#${self.color.toString(16).padStart(6, "0")}`;
        g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = 2;
        g.beginPath(); g.arc(px(self.x), py(self.z), 10 + Math.sin(performance.now() / 300) * 1.6, 0, Math.PI * 2); g.stroke();
        g.fillStyle = col; g.strokeStyle = "#ffffff"; g.lineWidth = 2.6;
        g.beginPath(); g.arc(px(self.x), py(self.z), 6.4, 0, Math.PI * 2); g.fill(); g.stroke();
        g.strokeStyle = "#ffffff"; g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(px(self.x), py(self.z));
        g.lineTo(px(self.x) + Math.sin(self.heading) * 11, py(self.z) + Math.cos(self.heading) * 11);
        g.stroke();
      }
    };
    draw();
    const id = window.setInterval(draw, 120);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miniOpen]);

  const onMiniClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const wx = MINI.xMin + ((e.clientX - rect.left) / rect.width) * (MINI.xMax - MINI.xMin);
    const wz = MINI.zMin + ((e.clientY - rect.top) / rect.height) * (MINI.zMax - MINI.zMin);
    // LOL behaviour: clicking the minimap moves the CAMERA there (the
    // lookRef channel wins over follow for a few seconds) — it locates,
    // it does not start walking the player there.
    lookRef.current = { x: wx, z: wz, until: performance.now() + 5000 };
  };

  if (glFailed) {
    const locs = getLocations(p.cityKey);
    return (
      <div className="w-full rounded-[12px] border border-[var(--line)] bg-[var(--surface2)] p-4">
        <p className="mb-1 text-sm font-black">🗺️ 这台设备没能启动 3D 地图</p>
        <p className="mb-3 text-xs leading-relaxed text-[var(--dim)]">
          浏览器拒绝了 WebGL 画面（Mac App 里偶尔会这样）。先用地点列表照常玩——点任意地点即可前往，所有玩法都不受影响。
        </p>
        <div className="grid max-h-[380px] grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
          {locs.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-label={`前往${l.name}`}
              onClick={() => p.onSelect(l.id)}
              className={`rounded-[10px] border px-2.5 py-2 text-left text-[13px] font-bold transition ${l.id === p.selfLocId ? "border-[var(--accent)] bg-[var(--surface)]" : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--border)]"}`}
            >
              {l.emoji} {l.name}
              {l.id === p.selfLocId ? <span className="ml-1 text-[11px] text-[var(--accent)]">· 你在这里</span> : null}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={p.fill ? "relative h-full min-h-0 w-full flex-1 overflow-hidden rounded-[12px] bg-[#0b1622]" : "relative h-[420px] w-full overflow-hidden rounded-[12px] bg-[#0b1622] sm:h-[480px] lg:h-[640px] xl:h-[740px] 2xl:h-[840px]"}>
      <div ref={mountRef} className="absolute inset-0" />
      <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
      {cine && <div aria-hidden="true" className="cine-grade" />}
      {cine && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[5]" style={{ background: "radial-gradient(ellipse 118% 96% at 50% 42%, transparent 62%, rgba(5,10,18,0.34) 100%), linear-gradient(to bottom, rgba(5,10,18,0.16), transparent 13%, transparent 88%, rgba(5,10,18,0.2))" }} />
      )}
      <div className="absolute bottom-3 right-3 z-10 flex max-w-[calc(100%-24px)] flex-wrap justify-end gap-1.5">
        <button type="button" aria-label="跳到白天" onClick={() => jumpToPhase(0.32)} className="grid h-9 w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 text-base shadow">☀️</button>
        <button type="button" aria-label="跳到黄昏" onClick={() => jumpToPhase(0.74)} className="grid h-9 w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 text-base shadow">🌇</button>
        <button type="button" aria-label="跳到夜晚" onClick={() => jumpToPhase(0.93)} className="grid h-9 w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 text-base shadow">🌙</button>
        <button type="button" aria-label="回到真实时间：天色按深圳/惠州当地此刻走" onClick={backToRealTime} className="grid h-9 w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 text-base shadow">🕐</button>
        <button type="button" aria-label={demo ? "停止延时演示" : "延时演示：一昼夜30秒，看昼夜光影全程"} aria-pressed={demo} onClick={toggleDemo} className={`grid h-9 w-9 place-items-center rounded-full border text-base shadow ${demo ? "border-[var(--accent)] bg-[#14202b]/95" : "border-black/40 bg-[#fffdf8]/95"}`}>🎥</button>
        <button type="button" aria-label={cine ? "关闭电影镜头" : "开启电影镜头"} aria-pressed={cine} onClick={() => setCine((c) => !c)} className={`grid h-9 w-9 place-items-center rounded-full border text-base shadow ${cine ? "border-[var(--accent)] bg-[#14202b]/95" : "border-black/40 bg-[#fffdf8]/95"}`}>🎬</button>
        <span className="grid h-9 min-w-9 place-items-center rounded-full border border-black/40 bg-[#14202b]/90 px-2 text-[11px] font-black text-white shadow" aria-label={`当前缩放 ${zoomPct}%`} title="当前缩放比例（⌂ 回到 100%）">{zoomPct}%</span>
        <button type="button" aria-label="放大地图" onClick={() => zoomBy(0.78)} className="grid h-9 w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 text-base font-black text-[#14202b] shadow">＋</button>
        <button type="button" aria-label="缩小地图" onClick={() => zoomBy(1.28)} className="grid h-9 w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 text-base font-black text-[#14202b] shadow">－</button>
        <button type="button" aria-label="标签密度" title={labelDensity === "few" ? "标签：精简（点一下切换）" : labelDensity === "normal" ? "标签：标准（点一下切换）" : "标签：全部（点一下切换）"} onClick={cycleLabels} className="grid h-9 min-w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 px-2 text-[11px] font-black text-[#14202b] shadow">🏷️{labelDensity === "few" ? "简" : labelDensity === "normal" ? "标" : "全"}</button>
        <button type="button" aria-label="重置视角" onClick={resetCam} className="grid h-9 w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 text-base font-black text-[#14202b] shadow">⌂</button>
      </div>
      <p className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-[#0b1622]/70 px-3 py-1.5 text-[11px] font-bold text-white/90">
        拖动旋转 · 滚轮/＋－缩放（右下角显示比例） · 点建筑或标签前往 · 左下小地图看全城、点它定位镜头 · 天色按当地真实时间、云雨按真实天气走 · 右下 ☀️🌇🌙 预览时间 · 🕐 回到真实时间 · 🎥 延时演示 · 🎬 电影镜头
      </p>
      {/* LOL-style minimap: whole-city thumbnail, live-linked to the big map */}
      <div className="absolute bottom-3 left-3 z-10">
        {miniOpen ? (
          <div className="overflow-hidden rounded-[12px] border border-black/50 bg-[#0b1622]/85 shadow-xl">
            <div className="flex items-center gap-1 px-2 py-1">
              <span className="min-w-0 flex-1 truncate text-[11px] font-black text-white/90">🗺️ 小地图 · {p.cityKey === "sz" ? "深圳" : "惠州"}全城</span>
              <button type="button" aria-label="收起小地图" onClick={() => setMiniOpen(false)} className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-white/85 transition hover:bg-white/20">收起 ▾</button>
            </div>
            <canvas
              ref={miniCanvasRef}
              width={440}
              height={242}
              onClick={onMiniClick}
              role="img"
              aria-label="全城小地图：白色大圆点是你，彩色小点是NPC和在线玩家，红色靶心是目的地，虚线圈是大地图镜头位置；点击小地图任意位置，大地图镜头会定位过去"
              className="block h-[97px] w-[176px] cursor-crosshair sm:h-[121px] sm:w-[220px]"
            />
            <p className="px-2 py-1 text-[10px] font-bold leading-tight text-white/70">⚪ 你 · 🟡 NPC/玩家 · 🔴 目的地 · 点图定位镜头</p>
          </div>
        ) : (
          <button type="button" aria-label="展开小地图" onClick={() => setMiniOpen(true)} className="rounded-full border border-black/50 bg-[#0b1622]/85 px-3.5 py-2 text-xs font-black text-white shadow-xl transition hover:bg-[#0b1622]">🗺️ 小地图 ▸</button>
        )}
      </div>
      {p.navOverlay}
    </div>
  );
}
