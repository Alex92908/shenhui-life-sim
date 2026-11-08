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
import { CITIES, LOC_EN, getLocations, metroLinesForCity, modeById, npcsForCity, outfitOf, type CityKey, type Loc, type LocType, type Npc, type TransportModeId } from "./data";
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
  /** schedule anchor: the place this NPC's current beat of the day belongs
      to — wander targets cluster around it, so NPCs live somewhere instead
      of drifting across the whole city at random */
  ax?: number;
  az?: number;
  /** a greeting shown on the name chip while two people pass each other */
  greet?: string;
  greetUntil?: number;
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
  hk: [
    { x1: -6, z1: -6, x2: -2, z2: 5, w: 2.6, name: "弥敦道", lx: -5.4, lz: -0.5 },
    { x1: -18, z1: 10, x2: 20, z2: 10, w: 2.6, name: "轩尼诗道 · 德辅道", lx: 12, lz: 10 },
    { x1: -2, z1: 5, x2: -2, z2: 10, w: 2, name: "红磡海底隧道", lx: -2, lz: 7.6 },
    { x1: -34, z1: 1, x2: -17, z2: -2, w: 2.4, name: "青屿干线", lx: -26, lz: -1.4 },
    { x1: -24, z1: 4, x2: -28, z2: 8, w: 1.8 },
    { x1: -31, z1: -16, x2: 12, z2: -14, w: 2.4, name: "新田公路 · 吐露港公路", lx: -8, lz: -15 },
    { x1: 12, z1: -13, x2: 30, z2: -8, w: 1.9, name: "西贡公路", lx: 22, lz: -10.6 },
    { x1: -9, z1: -16, x2: -6, z2: 3, w: 2, name: "狮子山隧道 · 龙翔道", lx: -8.4, lz: -9 },
    { x1: -20, z1: -16, x2: -31, z2: -7, w: 2.2, name: "屯门公路", lx: -26, lz: -12 },
    { x1: 0, z1: 14, x2: 9, z2: 19, w: 1.7, name: "赤柱峡道", lx: 5, lz: 17 },
    { x1: -24, z1: 3, x2: -36, z2: 11, w: 1.8, name: "屿南道", lx: -31, lz: 8.4 },
    { x1: -13, z1: 12, x2: -6, z2: 10, w: 1.6, name: "山顶道", lx: -10, lz: 12.4 },
    { x1: 2, z1: -6, x2: 18, z2: 2, w: 1.8, name: "观塘道", lx: 11, lz: -1.4 },
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
  hk: [
    { peaks: [{ x: -8, z: -19.5, h: 7.8, r: 3.6 }, { x: -4, z: -20.5, h: 5.2, r: 2.6 }], label: "⛰️ 大帽山 957m · 香港最高峰", lx: -8, lz: -19.5, ly: 9.2 },
    { peaks: [{ x: -15.5, z: 16.5, h: 4.6, r: 2.8 }, { x: -11, z: 17.5, h: 3.2, r: 2.2 }], label: "⛰️ 太平山 552m · The Peak", lx: -15.5, lz: 16.5, ly: 6 },
    { peaks: [{ x: -29, z: 17.5, h: 6.8, r: 3.2 }, { x: -25, z: 18.5, h: 5.4, r: 2.6, rock: true }], label: "⛰️ 凤凰山 934m · 大屿山", lx: -29, lz: 17.5, ly: 8.2 },
    { peaks: [{ x: 4, z: -9.5, h: 3.8, r: 2.6 }], label: "⛰️ 狮子山 495m", lx: 4, lz: -9.5, ly: 5.2 },
    { peaks: [{ x: 21, z: -14, h: 4.6, r: 2.8 }, { x: 33, z: -13, h: 3.4, r: 2.4 }] },
    { peaks: [{ x: -33, z: -13, h: 3.6, r: 2.6 }, { x: 24, z: 16, h: 2.8, r: 2.4 }] },
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
  hk: [
    { x: 33.5, z: -3.5, r: 2 },
    { x: 15, z: -19.5, r: 2.2 },
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
  if (cityKey === "hk") return 21.6 + Math.sin(x * 0.08 + 1) * 1 + Math.sin(x * 0.19 + 0.4) * 0.6;
  return 14.6 + Math.sin(x * 0.09 + 2) * 1.2 + Math.sin(x * 0.21 + 0.6) * 0.7;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* Where an NPC plausibly is at a given hour of the REAL day — their beat:
   morning commute, work at the kind of place their job belongs to, lunch
   at food streets, evening food/social, night back in the home quarter.
   "stay" roles （摊主/同事/邻居） keep to their corner all day. The map's
   sky already runs on the real Asia/Shanghai clock; NPC schedules ride
   the same clock, so the street the player sees matches the hour. */
function npcAnchorLocId(n: Npc, hour: number, locs: Loc[]): string {
  const first = locs[0];
  if (!first) return "home";
  const byType = (types: LocType[]): Loc | undefined =>
    locs.find((l) => types.includes(l.type) && n.preferTypes.includes(l.type)) ??
    locs.find((l) => types.includes(l.type));
  if (n.behavior === "stay") return (locs.find((l) => n.preferTypes.includes(l.type)) ?? first).id;
  if (hour >= 7 && hour < 9) return (byType(["transit", "work"]) ?? first).id;
  if (hour >= 12 && hour < 14) return (byType(["food", "market"]) ?? first).id;
  if (hour >= 18 && hour < 22) return (byType(["food", "social", "mall", "fun"]) ?? first).id;
  if (hour >= 22 || hour < 7) return (byType(["home", "fun"]) ?? first).id;
  return (byType(n.preferTypes) ?? first).id;
}

/* Street greetings: when two named neighbours pass on the pavement, one
   of them says something — the city acknowledging itself. */
const GREETS = ["👋「早啊！」", "👋「吃了吗？」", "💬「今天天儿不错」", "👋「忙着呢？慢点」", "💬「路上小心点」", "👋「又见面了」", "💬「回头一起吃饭」"];
const GREETS_PLAYER = ["👋「嗨，又碰见你了」", "👋「今天也加油啊」", "💬「出门呢？路上慢点」", "👋「吃了吗你？」"];

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
  w: number;
  h: number;
  lastText: string;
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
  /* each NPC's current schedule anchor (locId), so a changed beat only
     retargets them once — they then walk there across the map */
  const npcAnchorRef = useRef<Map<string, string>>(new Map());
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
  const cineRef = useRef(true);
  cineRef.current = cine;
  /* Street-level camera: drops the lens to the pavement behind the player
     so the miniature stops reading as a model — shopfronts, crossings,
     signals, traffic and pedestrians at eye height, true-scale streets. */
  const [streetCam, setStreetCam] = useState(false);
  const streetRef = useRef(false);
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
    if (!p.focusLocId || !p.focusNonce) return;
    const loc = getLocations(p.cityKey).find((l) => l.id === p.focusLocId);
    if (loc) lookRef.current = { x: loc.x, z: loc.z, until: performance.now() + 4500 };
  }, [p.focusLocId, p.focusNonce, p.cityKey]);

  // Sync the actor set with props (self, remote players, NPCs).
  useEffect(() => {
    const locs = getLocations(p.cityKey);
    const byId = new Map(locs.map((l) => [l.id, l]));
    const actors = actorsRef.current;
    const want = new Set<string>();
    const upsert = (a: Omit<Actor, "x" | "z" | "tx" | "tz"> & { startLoc: string }) => {
      want.add(a.key);
      const cur = actors.get(a.key);
      const loc = byId.get(a.startLoc) ?? locs[0];
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
    npcsForCity(p.cityKey).forEach((n, i) => {
      const preferred = locs.filter((l) => n.preferTypes.includes(l.type));
      const pool = preferred.length > 0 ? preferred : locs;
      const loc = pool[(hash(n.name) + i) % pool.length];
      const speed = n.behavior === "commute" ? 5.6 : n.behavior === "patrol" ? 3.4 : n.behavior === "stay" ? 2 : 4.2;
      upsert({ key: `npc-${n.name}`, name: `${n.name}·${n.job}${p.npcMoodEmoji?.[n.name] ? ` ${p.npcMoodEmoji[n.name]}` : ""}`, emoji: n.emoji, color: n.color, wander: true, seed: hash(n.name), heading: 0, phase: hash(n.name) % 6, blend: 0, startLoc: loc?.id ?? "home", shirt: n.shirt, pants: n.pants, accessory: n.accessory, behavior: n.behavior, speed });
    });
    // NPC schedules: the beat changes with the real hour, and when it does
    // the NPC visibly travels to the new anchor across the map (commuting
    // to work, heading out for lunch, going home at night) instead of
    // teleporting or drifting at random.
    const hourNow = Math.floor(currentPhase() * 24);
    for (const n of npcsForCity(p.cityKey)) {
      const a = actors.get(`npc-${n.name}`);
      if (!a) continue;
      const anchorId = npcAnchorLocId(n, hourNow, locs);
      const loc = byId.get(anchorId);
      if (!loc) continue;
      a.ax = loc.x;
      a.az = loc.z;
      if (npcAnchorRef.current.get(n.name) !== anchorId) {
        npcAnchorRef.current.set(n.name, anchorId);
        a.tx = loc.x + ((a.seed % 5) - 2) * 0.4;
        a.tz = loc.z + ((a.seed % 3) - 1) * 0.4;
      }
    }
    for (const key of Array.from(actors.keys())) {
      if (!want.has(key)) actors.delete(key);
    }
  }, [p.cityKey, p.selfLocId, p.selfEmoji, p.selfColor, p.selfName, p.remotePlayers, p.selfOutfitId, p.npcMoodEmoji, p.travelModeId]);

  // Build/rebuild the whole 3D scene when the city changes.
  useEffect(() => {
    const mount = mountRef.current;
    const labels = labelsRef.current;
    if (!mount || !labels) return;
    const cityKey = propsRef.current.cityKey;
    const locs = getLocations(cityKey);
    const roads = ROADS[cityKey];
    const flagGroups: THREE.Group[] = [];
    const wheelGroups: THREE.Mesh[] = [];
    const rnd = mulberry(cityKey === "sz" ? 2026 : cityKey === "hk" ? 2088 : 2077);

    // WebGL can be unavailable or refuse a context in some webviews (the
    // Mac app's WKWebView among them). That must degrade to the location
    // list below, never throw and unmount the whole game.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setGlFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
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
    const fx: PostFx | null = makePostFx(renderer, scene, camera, { bloomStrength: 0.33, bloomThreshold: 0.8, blur: 0.0038 });

    const hemi = new THREE.HemisphereLight(0xdff2ff, 0x8a7a5a, 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
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
    // Hong Kong's Victoria Harbour: a real water channel cut between
    // Kowloon (north shore, Tsim Sha Tsui) and Hong Kong Island (south
    // shore, Central/Wan Chai) — the harbour IS the city's centre.
    if (cityKey === "hk") {
      const harbour = new THREE.Mesh(new THREE.PlaneGeometry(34, 2.6), waterMat);
      harbour.rotation.x = -Math.PI / 2;
      harbour.position.set(0, LAND + 0.04, 7.4);
      harbour.receiveShadow = true;
      scene.add(harbour);
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

    /* ---- streets at true scale: sidewalks, zebra crossings, traffic
       lights the traffic OBEYS ----
       The corridors stop being a model railway here. Every road gets a
       pavement on both sides; where two roads cross there is a zebra
       crossing and a working signal head for each approach. Signals run
       an 18-second cycle (offsets per junction so the city doesn't pulse
       in sync), and the traffic + pedestrian systems below brake for red
       lights, queue behind each other, and cross on their green. */
    interface IxStop { t: number; ix: number; slot: 0 | 1; back: number; other: Road; otherT: number }
    interface Ix { x: number; z: number }
    const roadLen = (r: Road) => Math.hypot(r.x2 - r.x1, r.z2 - r.z1);
    const segIx = (a: Road, b: Road) => {
      const d1x = a.x2 - a.x1, d1z = a.z2 - a.z1;
      const d2x = b.x2 - b.x1, d2z = b.z2 - b.z1;
      const den = d1x * d2z - d1z * d2x;
      if (Math.abs(den) < 1e-6) return null;
      const ex = b.x1 - a.x1, ez = b.z1 - a.z1;
      const ta = (ex * d2z - ez * d2x) / den;
      const tb = (ex * d1z - ez * d1x) / den;
      if (ta < 0.03 || ta > 0.97 || tb < 0.03 || tb > 0.97) return null;
      return { x: a.x1 + d1x * ta, z: a.z1 + d1z * ta, ta, tb };
    };
    const ixs: Ix[] = [];
    const roadStops = new Map<Road, IxStop[]>();
    const addStop = (r: Road, s: IxStop) => {
      const arr = roadStops.get(r) ?? [];
      arr.push(s);
      roadStops.set(r, arr);
    };
    for (let i = 0; i < roads.length; i++) {
      for (let j = i + 1; j < roads.length; j++) {
        const hit = segIx(roads[i]!, roads[j]!);
        if (!hit) continue;
        const ixIdx = ixs.length;
        ixs.push({ x: hit.x, z: hit.z });
        addStop(roads[i]!, { t: hit.ta, ix: ixIdx, slot: 0, back: roads[j]!.w / 2 + 1.15, other: roads[j]!, otherT: hit.tb });
        addStop(roads[j]!, { t: hit.tb, ix: ixIdx, slot: 1, back: roads[i]!.w / 2 + 1.15, other: roads[i]!, otherT: hit.ta });
      }
    }
    const TL_CYCLE = 18;
    const tlPhaseAt = (ix: number, tSec: number) => (((tSec + ix * 3.7) % TL_CYCLE) + TL_CYCLE) % TL_CYCLE;
    /* slot 0 runs first (0–8s green), then slot 1 (9.2–17.2s); the gaps are
       the amber/all-red changeover. Pedestrians may cross a road while the
       OTHER approach has the green (or during the changeover). */
    const tlGreen = (ix: number, slot: 0 | 1, tSec: number) => {
      const ph = tlPhaseAt(ix, tSec);
      return slot === 0 ? ph < 8 : ph >= 9.2 && ph < 17.2;
    };
    const tlYellow = (ix: number, slot: 0 | 1, tSec: number) => {
      const ph = tlPhaseAt(ix, tSec);
      return slot === 0 ? ph >= 8 && ph < 9.2 : ph >= 17.2;
    };
    const tlPedGreen = (ix: number, slot: 0 | 1, tSec: number) => {
      const ph = tlPhaseAt(ix, tSec);
      if (ph >= 8 && ph < 9.2) return true; // changeover: both approaches stopped
      return slot === 0 ? ph >= 9.2 && ph < 17.2 : ph < 8 || ph >= 17.2;
    };
    // sidewalks: a pale pavement strip hugging both sides of every road
    {
      const paveMat = new THREE.MeshStandardMaterial({ color: 0xcfc8b2, roughness: 1 });
      for (const r of roads) {
        const len = roadLen(r);
        const ang = Math.atan2(r.z2 - r.z1, r.x2 - r.x1);
        for (const side of [1, -1]) {
          const off = (r.w / 2 + 0.5) * side;
          const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.95), paveMat);
          m.position.set((r.x1 + r.x2) / 2 + Math.sin(ang) * off, LAND + 0.045, (r.z1 + r.z2) / 2 - Math.cos(ang) * off);
          m.rotation.y = -ang;
          m.receiveShadow = true;
          scene.add(m);
        }
      }
    }
    // zebra crossings: one instanced set of white bars at every junction,
    // across each approach road, just before its stop line
    {
      const mats4: THREE.Matrix4[] = [];
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const one = new THREE.Vector3(1, 1, 1);
      for (let ii = 0; ii < ixs.length; ii++) {
        const ix = ixs[ii]!;
        for (const r of roads) {
          const stops = roadStops.get(r);
          const st = stops?.find((s) => s.ix === ii);
          if (!st) continue;
          const ang = Math.atan2(r.z2 - r.z1, r.x2 - r.x1);
          const dirx = Math.cos(ang), dirz = Math.sin(ang);
          const cx = ix.x, cz = ix.z;
          for (const sgn of [1, -1]) {
            const bx = cx + dirx * (st.back + 0.55) * sgn;
            const bz = cz + dirz * (st.back + 0.55) * sgn;
            q.setFromEuler(new THREE.Euler(0, -ang, 0));
            const bars = Math.max(3, Math.floor(r.w / 0.62));
            for (let b = 0; b < bars; b++) {
              const off = (b - (bars - 1) / 2) * 0.62;
              m4.compose(new THREE.Vector3(bx + Math.sin(ang) * off, LAND + 0.12, bz - Math.cos(ang) * off), q, one);
              mats4.push(m4.clone());
            }
          }
        }
      }
      if (mats4.length > 0) {
        const zebra = new THREE.InstancedMesh(new THREE.BoxGeometry(0.85, 0.03, 0.3), new THREE.MeshBasicMaterial({ color: 0xf4f1e6, transparent: true, opacity: 0.85 }), mats4.length);
        mats4.forEach((mm, i) => zebra.setMatrixAt(i, mm));
        scene.add(zebra);
      }
    }
    // signal heads: two per junction (one per approach), lamps lit by phase
    interface LightHead { ix: number; slot: 0 | 1; red: THREE.MeshStandardMaterial; yel: THREE.MeshStandardMaterial; grn: THREE.MeshStandardMaterial }
    const lightHeads: LightHead[] = [];
    {
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.7, metalness: 0.4 });
      const lampGeo = new THREE.SphereGeometry(0.1, 8, 8);
      for (let ii = 0; ii < ixs.length; ii++) {
        const ix = ixs[ii]!;
        for (const r of roads) {
          const st = roadStops.get(r)?.find((s) => s.ix === ii);
          if (!st) continue;
          const ang = Math.atan2(r.z2 - r.z1, r.x2 - r.x1);
          // pole on the right-hand corner of this approach
          const pxv = ix.x + Math.cos(ang) * (st.back + 1.7) + Math.sin(ang) * (r.w / 2 + 0.75);
          const pzv = ix.z + Math.sin(ang) * (st.back + 1.7) - Math.cos(ang) * (r.w / 2 + 0.75);
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.5, 6), poleMat);
          pole.position.set(pxv, LAND + 1.25, pzv);
          scene.add(pole);
          const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.86, 0.22), poleMat);
          headBox.position.set(pxv, LAND + 2.72, pzv);
          headBox.rotation.y = -ang;
          scene.add(headBox);
          const mkLampMat = (em: number) => new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.4, emissive: em, emissiveIntensity: 0.12 });
          const red = mkLampMat(0xff2a1e);
          const yel = mkLampMat(0xffb020);
          const grn = mkLampMat(0x2ee66b);
          const lampOffs: [THREE.MeshStandardMaterial, number][] = [[red, 0.28], [yel, 0], [grn, -0.28]];
          for (const [lm, dy] of lampOffs) {
            const lamp = new THREE.Mesh(lampGeo, lm);
            lamp.position.set(pxv - Math.cos(ang) * 0.13, LAND + 2.72 + dy, pzv - Math.sin(ang) * 0.13);
            scene.add(lamp);
          }
          lightHeads.push({ ix: ii, slot: st.slot, red, yel, grn });
        }
      }
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

    /* ---- metro / intercity lines ---- */
    {
      const lines = metroLinesForCity(cityKey);
      for (const line of lines) {
        const pts = line.stations.map((s) => new THREE.Vector3(s.x, LAND + 0.22, s.z));
        if (pts.length > 1) {
          const geo = new THREE.BufferGeometry().setFromPoints(pts);
          const mat = new THREE.LineBasicMaterial({ color: line.color, transparent: true, opacity: 0.92 });
          const ln = new THREE.Line(geo, mat);
          scene.add(ln);
          // thicker underlay using small boxes between stations for visibility
          for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i]!; const b = pts[i + 1]!;
            const len = Math.hypot(b.x - a.x, b.z - a.z);
            const ang = Math.atan2(b.z - a.z, b.x - a.x);
            const seg = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.42), new THREE.MeshBasicMaterial({ color: line.color, transparent: true, opacity: 0.55 }));
            seg.position.set((a.x + b.x) / 2, LAND + 0.16, (a.z + b.z) / 2);
            seg.rotation.y = -ang;
            scene.add(seg);
          }
        }
        for (const st of line.stations) {
          const isHub = !!st.locId;
          const dot = new THREE.Mesh(
            new THREE.CylinderGeometry(isHub ? 0.42 : 0.24, isHub ? 0.42 : 0.24, 0.22, 12),
            new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, emissive: line.color, emissiveIntensity: isHub ? 0.35 : 0.08 }),
          );
          dot.position.set(st.x, LAND + 0.28, st.z);
          scene.add(dot);
          const ring = new THREE.Mesh(new THREE.RingGeometry(isHub ? 0.44 : 0.26, isHub ? 0.58 : 0.36, 16), new THREE.MeshBasicMaterial({ color: line.color, side: THREE.DoubleSide }));
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(st.x, LAND + 0.3, st.z);
          scene.add(ring);
        }
      }
    }

    /* ---- location buildings ---- */
    const winTex = windowsTexture();
    const pickMeshes: THREE.Object3D[] = [];
    const flagMats: THREE.MeshStandardMaterial[] = [];
    for (const l of locs) {
      const g = new THREE.Group();
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
    const addBox = (x: number, z: number, w: number, h: number, d: number, color: number, y = LAND) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
      m.position.set(x, y + h / 2, z);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      return m;
    };
    if (cityKey === "sz") {
      // Ping An Finance Centre spire near the bank
      const tower = addBox(3.6, -1.8, 2.2, 26, 2.2, 0x9db8c8);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 5, 6), new THREE.MeshStandardMaterial({ color: 0xd7e6ee, roughness: 0.4, metalness: 0.5 }));
      spire.position.set(3.6, LAND + 26 + 2.5, -1.8);
      spire.castShadow = true;
      scene.add(spire);
      tower.castShadow = true;
      // Shenzhen Bay Bridge sweeping over the water
      const bridgeMat = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.6 });
      const deck = new THREE.Mesh(new THREE.BoxGeometry(26, 0.5, 2.6), bridgeMat);
      deck.position.set(-26, 1.7, 21.5);
      deck.rotation.y = 0.32;
      deck.castShadow = true;
      scene.add(deck);
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.7, 7, 0.7), bridgeMat);
      pylon.position.set(-26, 3.5, 21.5);
      scene.add(pylon);
      // Happy Valley ferris-wheel silhouette: torus + spokes hub
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.16, 8, 40), new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.5 }));
      wheel.position.set(-21.5, LAND + 4.4, -9.5);
      wheel.castShadow = true;
      scene.add(wheel);
      wheelGroups.push(wheel);
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
    const nearLoc = (x: number, z: number) => locs.some((l) => Math.abs(l.x - x) < 3.4 && Math.abs(l.z - z) < 3.4);
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

    /* ---- street frontage: shop rows lining the roads ----
       The corridors get street walls: small shop blocks shoulder to
       shoulder along both pavements, awnings and lit signs facing the
       road, windows that light up at night with the towers. This is what
       makes a street read as a street at ground level. Door points are
       kept in shopPts — pedestrians below walk in and out of them. */
    const shopPts: { x: number; z: number; dx: number; dz: number }[] = [];
    {
      const shopPalette = [0xe8dcc4, 0xdcc7a8, 0xc9d4d8, 0xe3cdb4, 0xd8e0d2, 0xead9c2, 0xd5c6e0, 0xf0dfc0];
      let shopCount = 0;
      for (const r of roads) {
        if (shopCount >= 120) break;
        const len = roadLen(r);
        const ang = Math.atan2(r.z2 - r.z1, r.x2 - r.x1);
        const steps = Math.floor(len / 3.3);
        for (let i = 1; i < steps && shopCount < 120; i++) {
          for (const side of [1, -1]) {
            if (shopCount >= 120) break;
            if (rnd() < 0.3) continue;
            const t = (i + (rnd() - 0.5) * 0.3) / steps;
            const off = r.w / 2 + 1.85;
            const x = r.x1 + (r.x2 - r.x1) * t + Math.sin(ang) * off * side;
            const z = r.z1 + (r.z2 - r.z1) * t - Math.cos(ang) * off * side;
            if (z > coastZ(cityKey, x) - 1.4) continue;
            if (nearLoc(x, z) || nearMountain(x, z) || nearLake(x, z)) continue;
            if (roads.some((o) => o !== r && (() => { const dx = o.x2 - o.x1; const dz = o.z2 - o.z1; const tt = Math.max(0, Math.min(1, ((x - o.x1) * dx + (z - o.z1) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - (o.x1 + dx * tt), z - (o.z1 + dz * tt)) < o.w / 2 + 1.5; })())) continue;
            if (shopPts.some((s) => Math.hypot(s.x - x, s.z - z) < 2.3)) continue;
            const gh = 1.5 + rnd() * 2.1;
            const gw = 2 + rnd() * 0.9;
            const g = new THREE.Group();
            const bodyMatS = new THREE.MeshStandardMaterial({ color: shopPalette[Math.floor(rnd() * shopPalette.length)] ?? 0xe8dcc4, roughness: 0.85, emissive: 0xffc873, emissiveMap: winTex, emissiveIntensity: 0 });
            buildingMats.push(bodyMatS);
            const bodyS = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, 1.6), bodyMatS);
            bodyS.position.y = gh / 2;
            bodyS.castShadow = true;
            bodyS.receiveShadow = true;
            g.add(bodyS);
            // awning + sign strip on the road-facing side: with the group
            // rotation chosen below, the street face is local +z for both
            // sides of the road
            const awnMatS = new THREE.MeshStandardMaterial({ color: new THREE.Color(shopPalette[Math.floor(rnd() * shopPalette.length)] ?? 0xe8dcc4).multiplyScalar(0.7), roughness: 0.8, emissive: 0xffb35c, emissiveIntensity: 0.1 });
            const awnS = new THREE.Mesh(new THREE.BoxGeometry(gw * 0.82, 0.07, 0.6), awnMatS);
            awnS.position.set(0, 1.32, 1.06);
            awnS.rotation.x = 0.35;
            g.add(awnS);
            const signMatS = new THREE.MeshStandardMaterial({ color: 0x1a1216, roughness: 0.5, emissive: [0xe63a1f, 0xf5b942, 0x2dd4bf, 0xec4899, 0x3b82f6][Math.floor(rnd() * 5)] ?? 0xe63a1f, emissiveIntensity: 0.4 });
            const signS = new THREE.Mesh(new THREE.BoxGeometry(Math.min(1.9, gw * 0.7), 0.42, 0.08), signMatS);
            signS.position.set(0, Math.min(gh - 0.35, 1.95), 0.84);
            g.add(signS);
            neonMats.push(signMatS);
            g.position.set(x, LAND, z);
            g.rotation.y = -ang + (side > 0 ? 0 : Math.PI);
            scene.add(g);
            shopPts.push({ x, z, dx: x - Math.sin(ang) * side * 1.15, dz: z + Math.cos(ang) * side * 1.15 });
            shopCount++;
          }
        }
      }
    }

    // trees (instanced cones)
    const treeSpots: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < 1500 && treeSpots.length < 430; i++) {
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

    /* ---- street facilities: schools, clinics, police/fire posts, petrol
       stations, parking, post offices — small coloured blocks with an
       emoji sign, dotted along the roads so the miniature reads as a
       lived-in city, not just landmark towers. Decorative (the playable
       places are the labelled buildings), placed deterministically. ---- */
    {
      const FACILITIES: { emoji: string; color: number }[] = [
        { emoji: "🏫", color: 0xf5b942 }, { emoji: "🏥", color: 0xf8fafc }, { emoji: "🚓", color: 0x3b82f6 },
        { emoji: "🚒", color: 0xef4444 }, { emoji: "⛽", color: 0xf97316 }, { emoji: "🅿️", color: 0x64748b },
        { emoji: "📮", color: 0xdc2626 }, { emoji: "🏪", color: 0x22c55e }, { emoji: "🛒", color: 0xeab308 },
        { emoji: "💊", color: 0x14b8a6 }, { emoji: "🏫", color: 0xf5b942 }, { emoji: "🏥", color: 0xf8fafc },
        { emoji: "🚓", color: 0x3b82f6 }, { emoji: "⛽", color: 0xf97316 }, { emoji: "🏪", color: 0x22c55e },
        { emoji: "🅿️", color: 0x64748b },
      ];
      let placedFac = 0;
      for (let i = 0; i < 260 && placedFac < FACILITIES.length; i++) {
        const x = -36 + rnd() * 72;
        const z = -20 + rnd() * 33;
        if (z > coastZ(cityKey, x) - 1.8) continue;
        if (nearLoc(x, z) || nearMountain(x, z) || nearLake(x, z)) continue;
        // beside a road but not on it: 1.7–3.6 units from the nearest centreline
        let dRoad = Infinity;
        for (const r of roads) {
          const dx = r.x2 - r.x1;
          const dz = r.z2 - r.z1;
          const t = Math.max(0, Math.min(1, ((x - r.x1) * dx + (z - r.z1) * dz) / (dx * dx + dz * dz)));
          dRoad = Math.min(dRoad, Math.hypot(x - (r.x1 + dx * t), z - (r.z1 + dz * t)));
        }
        if (dRoad < 1.7 || dRoad > 3.6) continue;
        const fac = FACILITIES[placedFac]!;
        const block = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.85, 1.25), new THREE.MeshStandardMaterial({ color: fac.color, roughness: 0.85 }));
        block.position.set(x, LAND + 0.43, z);
        block.castShadow = true;
        block.receiveShadow = true;
        scene.add(block);
        const sign = emojiSprite(fac.emoji, fac.color);
        sign.scale.set(1.25, 1.25, 1);
        sign.position.set(x, LAND + 1.75, z);
        scene.add(sign);
        placedFac++;
      }
    }

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

    /* ---- traffic: cars that drive like traffic ----
       Every vehicle eases toward its cruise speed, brakes for a red (or
       late-amber) light at the stop line ahead, and queues behind the
       vehicle in front — the flow visibly bunches at junctions and
       releases on green, like the real 深南大道 at rush hour. */
    interface Car { road: Road; t: number; speed: number; cur: number; dir: 1 | -1; lane: number }
    const cars: Car[] = [];
    const carMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.15, 0.5, 0.62),
      new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 }),
      30,
    );
    const carColors = [0xffffff, 0xe63a1f, 0x2563eb, 0xf5b942, 0x222831, 0x2dd4bf];
    for (let i = 0; i < 30; i++) {
      const road = roads[Math.floor(rnd() * roads.length)] ?? roads[0]!;
      const sp = 0.02 + rnd() * 0.035;
      cars.push({ road, t: rnd(), speed: sp, cur: sp, dir: rnd() > 0.5 ? 1 : -1, lane: (rnd() - 0.5) * 1.1 });
      carMesh.setColorAt(i, new THREE.Color(carColors[i % carColors.length]));
    }
    carMesh.castShadow = true;
    scene.add(carMesh);
    /* one traffic step for anything with wheels: returns the speed to
       ease toward this frame (lights + car-following), the caller eases
       cur toward it and advances t */
    const trafficWant = (v: Car, tSec: number): number => {
      let want = v.speed;
      const len = roadLen(v.road);
      const stops = roadStops.get(v.road);
      if (stops) {
        for (const st of stops) {
          const stopT = st.t - v.dir * (st.back / len);
          const aheadT = (stopT - v.t) * v.dir;
          if (aheadT < -0.004) continue; // already over the line
          const dW = aheadT * len;
          if (dW > 7) continue;
          const green = tlGreen(st.ix, st.slot, tSec);
          const yellow = tlYellow(st.ix, st.slot, tSec);
          if (!green && !(yellow && dW < 1.1)) {
            want = Math.min(want, v.speed * THREE.MathUtils.clamp((dW - 0.55) / 3.2, 0, 1));
          }
        }
      }
      for (const o of cars) {
        if (o === v || o.road !== v.road || o.dir !== v.dir || Math.abs(o.lane - v.lane) > 0.85) continue;
        const gapW = (o.t - v.t) * v.dir * len;
        if (gapW > 0 && gapW < 2.6) want = Math.min(want, v.speed * THREE.MathUtils.clamp((gapW - 1.25) / 1.3, 0, 1));
      }
      return want;
    };
    const trafficAdvance = (v: Car, dt: number, tSec: number) => {
      const want = trafficWant(v, tSec);
      if (want < v.cur) v.cur = Math.max(want, v.cur - dt * v.speed * 1.7);
      else v.cur = Math.min(want, v.cur + dt * v.speed * 0.45);
      v.t += v.cur * dt * v.dir;
      if (v.t > 1) v.t -= 1;
      if (v.t < 0) v.t += 1;
    };
    /* 阿强 the delivery rider is part of the traffic: his scooter loops
       the roads with the flow, stops at the same lights, and carries his
       name over his head — an NPC earning a living, not a prop. */
    const riderCar: Car = { road: roads[1] ?? roads[0]!, t: 0.3, speed: 0.045, cur: 0.045, dir: 1, lane: -0.5 };
    const riderG = new THREE.Group();
    {
      const tyreM = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.9 });
      const sBody = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.32, 1.15), new THREE.MeshStandardMaterial({ color: 0xf5b301, roughness: 0.45, metalness: 0.25 }));
      sBody.position.y = 0.48;
      riderG.add(sBody);
      const sBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.6 }));
      sBox.position.set(0, 0.85, -0.42);
      riderG.add(sBox);
      for (const wz of [-0.5, 0.5]) {
        const wm = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 10), tyreM);
        wm.rotation.z = Math.PI / 2;
        wm.position.set(0, 0.26, wz);
        riderG.add(wm);
      }
      // the rider himself, seated: torso, helmet, legs bent to the boards
      const rTorso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.6, 0.32), new THREE.MeshStandardMaterial({ color: 0xf5b301, roughness: 0.7 }));
      rTorso.position.set(0, 1.22, -0.08);
      riderG.add(rTorso);
      const rHead = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf5b301, roughness: 0.35 }));
      rHead.position.set(0, 1.78, -0.08);
      riderG.add(rHead);
      for (const lx of [-0.15, 0.15]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.55, 0.17), new THREE.MeshStandardMaterial({ color: 0x2e3440, roughness: 0.85 }));
        leg.position.set(lx, 0.62, 0.18);
        leg.rotation.x = -0.7;
        riderG.add(leg);
      }
      const tag = emojiSprite("🛵", 0xff8a00);
      tag.scale.set(1.5, 1.5, 1);
      tag.position.y = 2.5;
      riderG.add(tag);
      riderG.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
      scene.add(riderG);
    }

    /* ---- pedestrians: the pavement population ----
       Two dozen unnamed citizens with small lives: they walk the
       pavements, wait at the kerb for their green, cross on the zebra,
       turn at junctions onto other streets, step into shops and come out
       a while later with their errands done. Light-weight figures (no
       accessories, no shadows) so the street can afford a crowd. */
    interface Ped {
      g: THREE.Group; legL: THREE.Group; legR: THREE.Group; armL: THREE.Group; armR: THREE.Group;
      road: Road; t: number; dir: 1 | -1; side: 1 | -1; speed: number; phase: number;
      mode: "walk" | "wait" | "cross" | "toshop" | "inside" | "back";
      cool: number; waitSide: number;
      fx: number; fz: number; tx2: number; tz2: number; u: number; dur: number;
      shop?: { dx: number; dz: number }; insideT: number; crossStop?: IxStop;
    }
    const peds: Ped[] = [];
    {
      const skinM = new THREE.MeshStandardMaterial({ color: 0xf2c79b, roughness: 0.7 });
      const pedPalette = [0xe63a1f, 0x2563eb, 0x22c55e, 0xec4899, 0xf5b942, 0x8b5cf6, 0x14b8a6, 0xf97316, 0x64748b, 0xdbe7f5];
      const mkPedFigure = (shirtHex: number, pantsHex: number) => {
        const g = new THREE.Group();
        const shirt = new THREE.MeshStandardMaterial({ color: shirtHex, roughness: 0.75 });
        const pants = new THREE.MeshStandardMaterial({ color: pantsHex, roughness: 0.9 });
        const mkLimbP = (m: THREE.Material, w: number, len: number) => {
          const pivot = new THREE.Group();
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, len, w + 0.02), m);
          mesh.position.y = -len / 2;
          pivot.add(mesh);
          return pivot;
        };
        const legL = mkLimbP(pants, 0.16, 0.66); legL.position.set(-0.12, 0.7, 0); g.add(legL);
        const legR = mkLimbP(pants, 0.16, 0.66); legR.position.set(0.12, 0.7, 0); g.add(legR);
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.58, 0.3), shirt); torso.position.y = 1.0; g.add(torso);
        const armL = mkLimbP(shirt, 0.14, 0.54); armL.position.set(-0.33, 1.26, 0); g.add(armL);
        const armR = mkLimbP(shirt, 0.14, 0.54); armR.position.set(0.33, 1.26, 0); g.add(armR);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skinM); head.position.y = 1.5; g.add(head);
        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshStandardMaterial({ color: [0x2b2118, 0x4a3226, 0x1c1c22, 0x6b4a2f][Math.floor(rnd() * 4)] ?? 0x2b2118, roughness: 0.95 }));
        hair.position.y = 1.57; hair.scale.y = 0.72; g.add(hair);
        return { g, legL, legR, armL, armR };
      };
      const PED_COUNT = 22;
      for (let i = 0; i < PED_COUNT; i++) {
        const road = roads[Math.floor(rnd() * roads.length)] ?? roads[0]!;
        const fig = mkPedFigure(pedPalette[Math.floor(rnd() * pedPalette.length)] ?? 0x2563eb, [0x2e3440, 0x3a3f4a, 0x4a3226, 0x374151][Math.floor(rnd() * 4)] ?? 0x2e3440);
        fig.g.scale.setScalar(0.92);
        scene.add(fig.g);
        peds.push({
          ...fig,
          road, t: 0.05 + rnd() * 0.9, dir: rnd() > 0.5 ? 1 : -1, side: rnd() > 0.5 ? 1 : -1,
          speed: 0.85 + rnd() * 0.55, phase: rnd() * 6, mode: "walk", cool: 0, waitSide: 0,
          fx: 0, fz: 0, tx2: 0, tz2: 0, u: 0, dur: 1, insideT: 0,
        });
      }
    }
    const pedPoint = (road: Road, t: number, side: number) => {
      const ang = Math.atan2(road.z2 - road.z1, road.x2 - road.x1);
      const off = (road.w / 2 + 0.5) * side;
      return { x: road.x1 + (road.x2 - road.x1) * t + Math.sin(ang) * off, z: road.z1 + (road.z2 - road.z1) * t - Math.cos(ang) * off, ang };
    };

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
      // scenic spots and APEC venues carry their English name under the
      // Chinese one, so a visiting APEC guest can read the city off the map
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
      chips.push({ el: b, kind: "loc", locId: l.id, w: 0, h: 0, lastText: "", visible: true, clampDx: 0, clampDy: 0, getPos: () => ({ x: l.x, y: LAND + l.h * 1.7 + 2.6, z: l.z }) });
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
          // your own car for 自驾： same honest glass cabin as the taxi (you
          // sit inside it, on the seat), but painted in YOUR colour and no
          // taxi sign — the body material is kept so it can be re-tinted
          const drive = new THREE.Group();
          drive.name = "veh-drive";
          const dBodyMat = new THREE.MeshStandardMaterial({ color: 0xe63a1f, roughness: 0.32, metalness: 0.35 });
          const dBody = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.52, 2.2), dBodyMat);
          dBody.position.set(0, 0.55, 0);
          dBody.castShadow = true;
          drive.add(dBody);
          const dCab = new THREE.Mesh(new THREE.BoxGeometry(0.94, 1.2, 1.5), new THREE.MeshStandardMaterial({ color: 0xbfe3f2, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.45 }));
          dCab.position.set(0, 1.4, 0);
          drive.add(dCab);
          const dRoof = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.06, 1.55), dBodyMat);
          dRoof.position.set(0, 2.03, 0);
          drive.add(dRoof);
          const dSeat = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.9 }));
          dSeat.position.set(0, 0.62, 0.05);
          drive.add(dSeat);
          const dSeatBack = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.55, 0.12), dSeat.material);
          dSeatBack.position.set(0, 0.95, -0.24);
          drive.add(dSeatBack);
          for (const wx of [-0.53, 0.53]) for (const wz of [-0.8, 0.8]) {
            const wm = mkWheelZ(0.28, 0.1);
            wm.position.set(wx, 0.28, wz);
            drive.add(wm);
          }
          veh.add(drive);
          (v.userData as { driveMat?: THREE.MeshStandardMaterial }).driveMat = dBodyMat;
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
      camRef.current.dist = Math.max(16, Math.min(130, camRef.current.dist + e.deltaY * 0.05));
      setZoomPct(Math.round((fitDistRef.current / camRef.current.dist) * 100));
    };
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("wheel", onWheel, { passive: false });

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

    const v3 = new THREE.Vector3();
    let raf = 0;
    let declutterTick = 0;
    let greetTick = 0;
    let last = performance.now();
    const clockStart = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
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
      if (greyF > 0) tmpColor.lerp(new THREE.Color(0x8d9aa3), greyF * (0.3 + 0.7 * dayF));
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
      waterMat.color.setHex(0x2e7fb8).lerp(new THREE.Color(0x14324e), nightF * 0.8);
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
      cloudMat.color.setHex(0xffffff).lerp(new THREE.Color(0x5a6c85), nightF * 0.75).lerp(new THREE.Color(0xffb37a), duskF * 0.4);
      if (greyF > 0.15) cloudMat.color.lerp(new THREE.Color(0x707c85), greyF * 0.7);
      cloudMat.opacity = Math.min(0.97, 0.88 - nightF * 0.3 + greyF * 0.35);
      moteMat.opacity = 0.22 + nightF * 0.4;
      moteMat.color.setHex(0xfff3cf).lerp(new THREE.Color(0xffd98a), nightF);
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

      // traffic lights: lamps follow the same phase the cars obey
      for (const lh of lightHeads) {
        const ph = tlPhaseAt(lh.ix, tSec);
        const green = lh.slot === 0 ? ph < 8 : ph >= 9.2 && ph < 17.2;
        const yellow = lh.slot === 0 ? ph >= 8 && ph < 9.2 : ph >= 17.2;
        lh.grn.emissiveIntensity = green ? 2.4 : 0.12;
        lh.yel.emissiveIntensity = !green && yellow ? 2.4 : 0.12;
        lh.red.emissiveIntensity = !green && !yellow ? 2.4 : 0.12;
      }

      // traffic
      {
        const mat4 = new THREE.Matrix4();
        const quat = new THREE.Quaternion();
        const scl = new THREE.Vector3(1, 1, 1);
        cars.forEach((car, i) => {
          trafficAdvance(car, dt, tSec);
          const r = car.road;
          const ang = Math.atan2(r.z2 - r.z1, r.x2 - r.x1);
          const pxv = r.x1 + (r.x2 - r.x1) * car.t + Math.sin(ang) * car.lane;
          const pzv = r.z1 + (r.z2 - r.z1) * car.t - Math.cos(ang) * car.lane;
          quat.setFromEuler(new THREE.Euler(0, -ang + (car.dir < 0 ? Math.PI : 0), 0));
          mat4.compose(v3.set(pxv, LAND + 0.38, pzv), quat, scl);
          carMesh.setMatrixAt(i, mat4);
        });
        carMesh.instanceMatrix.needsUpdate = true;
        // 阿强's scooter rides the same rules (it just isn't in the queue
        // check — one scooter slipping past a queue is true to life)
        trafficAdvance(riderCar, dt, tSec);
        {
          const r = riderCar.road;
          const ang = Math.atan2(r.z2 - r.z1, r.x2 - r.x1);
          riderG.position.set(r.x1 + (r.x2 - r.x1) * riderCar.t + Math.sin(ang) * riderCar.lane, LAND + 0.1, r.z1 + (r.z2 - r.z1) * riderCar.t - Math.cos(ang) * riderCar.lane);
          riderG.rotation.y = -ang + (riderCar.dir < 0 ? Math.PI : 0) + Math.PI / 2;
        }
      }

      // pedestrians: walk the pavements, cross on green, duck into shops
      for (const pd of peds) {
        const len = roadLen(pd.road);
        let px = 0, pz = 0, heading = 0, walking = false;
        pd.cool = Math.max(0, pd.cool - dt);
        if (pd.mode === "walk") {
          pd.t += (pd.speed / len) * dt * pd.dir;
          if (pd.t > 0.985) { pd.t = 0.985; pd.dir = -1 as const; }
          if (pd.t < 0.015) { pd.t = 0.015; pd.dir = 1 as const; }
          const pt = pedPoint(pd.road, pd.t, pd.side);
          px = pt.x; pz = pt.z;
          heading = Math.atan2((pd.road.x2 - pd.road.x1) * pd.dir, (pd.road.z2 - pd.road.z1) * pd.dir);
          walking = true;
          // at a junction, life happens: cross, turn, or duck into a shop
          if (pd.cool <= 0) {
            const stops = roadStops.get(pd.road);
            const st = stops?.find((s) => Math.abs(s.t - pd.t) < (1.6 / len));
            if (st) {
              pd.cool = 2.2;
              const roll = Math.random();
              if (roll < 0.3) {
                // cross THIS road at the junction — wait for the ped green
                const from = pedPoint(pd.road, pd.t, pd.side);
                const to = pedPoint(pd.road, pd.t, -pd.side);
                pd.fx = from.x; pd.fz = from.z; pd.tx2 = to.x; pd.tz2 = to.z;
                pd.crossStop = st;
                pd.u = 0;
                pd.dur = Math.max(0.7, Math.hypot(to.x - from.x, to.z - from.z) / (pd.speed * 1.25));
                pd.mode = tlPedGreen(st.ix, st.slot, tSec) ? "cross" : "wait";
              } else if (roll < 0.55) {
                // turn onto the crossing street and keep walking
                pd.road = st.other;
                pd.t = THREE.MathUtils.clamp(st.otherT + (Math.random() > 0.5 ? 0.012 : -0.012), 0.02, 0.98);
                pd.dir = Math.random() > 0.5 ? 1 : -1;
              } else if (roll < 0.68 && shopPts.length > 0) {
                const near = shopPts.filter((s) => Math.hypot(s.x - px, s.z - pz) < 4.2);
                const shop = near[Math.floor(Math.random() * near.length)];
                if (shop) {
                  pd.shop = shop;
                  pd.fx = px; pd.fz = pz; pd.tx2 = shop.dx; pd.tz2 = shop.dz;
                  pd.u = 0;
                  pd.dur = Math.max(0.4, Math.hypot(shop.dx - px, shop.dz - pz) / pd.speed);
                  pd.mode = "toshop";
                }
              }
            }
          }
        } else if (pd.mode === "wait") {
          const pt = pedPoint(pd.road, pd.t, pd.side);
          px = pt.x; pz = pt.z;
          heading = Math.atan2(pd.tx2 - px, pd.tz2 - pz);
          if (pd.crossStop && tlPedGreen(pd.crossStop.ix, pd.crossStop.slot, tSec)) pd.mode = "cross";
        } else if (pd.mode === "cross") {
          pd.u += dt / pd.dur;
          const u = Math.min(1, pd.u);
          px = pd.fx + (pd.tx2 - pd.fx) * u;
          pz = pd.fz + (pd.tz2 - pd.fz) * u;
          heading = Math.atan2(pd.tx2 - pd.fx, pd.tz2 - pd.fz);
          walking = true;
          if (u >= 1) { pd.side = (pd.side * -1) as 1 | -1; pd.mode = "walk"; pd.cool = 1.6; }
        } else if (pd.mode === "toshop") {
          pd.u += dt / pd.dur;
          const u = Math.min(1, pd.u);
          px = pd.fx + (pd.tx2 - pd.fx) * u;
          pz = pd.fz + (pd.tz2 - pd.fz) * u;
          heading = Math.atan2(pd.tx2 - pd.fx, pd.tz2 - pd.fz);
          walking = true;
          if (u >= 1) { pd.mode = "inside"; pd.insideT = 3.5 + Math.random() * 6; pd.g.visible = false; }
        } else if (pd.mode === "inside") {
          pd.insideT -= dt;
          if (pd.insideT <= 0 && pd.shop) {
            pd.g.visible = true;
            const pt = pedPoint(pd.road, pd.t, pd.side);
            pd.fx = pd.shop.dx; pd.fz = pd.shop.dz; pd.tx2 = pt.x; pd.tz2 = pt.z;
            pd.u = 0;
            pd.dur = Math.max(0.3, Math.hypot(pt.x - pd.shop.dx, pt.z - pd.shop.dz) / pd.speed);
            pd.mode = "back";
          }
          continue;
        } else {
          // back: out of the shop, rejoin the pavement
          pd.u += dt / pd.dur;
          const u = Math.min(1, pd.u);
          px = pd.fx + (pd.tx2 - pd.fx) * u;
          pz = pd.fz + (pd.tz2 - pd.fz) * u;
          heading = Math.atan2(pd.tx2 - pd.fx, pd.tz2 - pd.fz);
          walking = true;
          if (u >= 1) { pd.mode = "walk"; pd.cool = 1.2; }
        }
        pd.phase += dt * (walking ? 7.5 : 0);
        const swing = walking ? Math.sin(pd.phase) * 0.55 : 0;
        pd.legL.rotation.x = swing;
        pd.legR.rotation.x = -swing;
        pd.armL.rotation.x = -swing * 0.7;
        pd.armR.rotation.x = swing * 0.7;
        pd.g.position.set(px, LAND + 0.08 + (walking ? Math.abs(Math.sin(pd.phase)) * 0.05 : Math.sin(tSec * 1.7 + pd.phase) * 0.012), pz);
        pd.g.rotation.y = heading;
      }

      // street greetings: when two named neighbours pass on the pavement
      // one of them says something (and they greet YOU when you pass) —
      // the city acknowledging itself, Sleeping-Dogs style street life
      greetTick++;
      if (greetTick % 40 === 0) {
        const npcActors = [...actorsRef.current.values()].filter((a) => a.key.startsWith("npc-"));
        const selfA = actorsRef.current.get("self");
        const tNow = performance.now();
        for (let i = 0; i < npcActors.length; i++) {
          const a = npcActors[i]!;
          if (a.greetUntil && a.greetUntil > tNow) continue;
          if (selfA && Math.hypot(a.x - selfA.x, a.z - selfA.z) < 2.3 && Math.random() < 0.4) {
            a.greet = GREETS_PLAYER[Math.floor(Math.random() * GREETS_PLAYER.length)];
            a.greetUntil = tNow + 2600;
            continue;
          }
          for (let j = i + 1; j < npcActors.length; j++) {
            const b = npcActors[j]!;
            if (Math.hypot(a.x - b.x, a.z - b.z) < 2.3 && Math.random() < 0.3) {
              const speaker = Math.random() > 0.5 ? a : b;
              if (!speaker.greetUntil || speaker.greetUntil <= tNow) {
                speaker.greet = GREETS[Math.floor(Math.random() * GREETS.length)];
                speaker.greetUntil = tNow + 2600;
              }
              break;
            }
          }
        }
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
          // 通勤族). Everyone's small movements cluster around their
          // schedule anchor for this hour — they live in a neighbourhood,
          // with the occasional longer stroll somewhere they like.
          const chance = a.behavior === "stay" ? 0.0016 : a.behavior === "patrol" ? 0.006 : a.behavior === "commute" ? 0.0032 : 0.004;
          if (Math.random() < chance) {
            if (a.behavior === "stay") {
              a.tx += (Math.random() - 0.5) * 2.4;
              a.tz += (Math.random() - 0.5) * 2;
            } else if (a.ax !== undefined && a.az !== undefined && Math.random() < 0.8) {
              a.tx = a.ax + (Math.random() - 0.5) * 3.4;
              a.tz = a.az + (Math.random() - 0.5) * 2.8;
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
          // stride cadence follows the actual travel speed: a walker
          // strolls, a runner's legs blur, a commuter hurries
          a.phase += dt * 1.62 * (a.speed || 4.2);
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
            const wantMode = mode === "bike" || mode === "moto" || mode === "taxi" || mode === "bus" || mode === "drive" ? mode : null;
            if (wantMode) a.rideMode = wantMode;
            const ridingNow = wantMode !== null && moving;
            a.rideBlend = (a.rideBlend ?? 0) + ((ridingNow ? 1 : 0) - (a.rideBlend ?? 0)) * Math.min(1, dt * 6);
            const rb = a.rideBlend ?? 0;
            const rm = a.rideMode ?? "bike";
            veh.visible = rb > 0.03;
            const limbs0 = (view.userData as { limbs?: ActorLimbs }).limbs;
            if (veh.visible && limbs0) {
              for (const child of veh.children) child.visible = child.name === `veh-${rm}`;
              const seat = rm === "bike" ? { y: -0.14, s: 1 } : rm === "moto" ? { y: -0.1, s: 1 } : rm === "taxi" || rm === "drive" ? { y: 0.03, s: 0.9 } : { y: 0.18, s: 0.9 };
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
          mats.dark.color.setHex(new THREE.Color(a.shirt).multiplyScalar(0.78).getHex());
          mats.pants.color.setHex(a.pants);
        }
        // your own car wears your identity colour
        const driveMat = (view.userData as { driveMat?: THREE.MeshStandardMaterial }).driveMat;
        if (driveMat) driveMat.color.setHex(a.color);
        const acc = (view.userData as { acc?: THREE.Group }).acc;
        if (acc) for (const child of acc.children) child.visible = child.name === `acc-${a.accessory}`;
        const chip = actorChips.get(a.key);
        if (chip) {
          const greeting = a.greet && a.greetUntil && performance.now() < a.greetUntil ? ` ${a.greet}` : "";
          chip.el.textContent = a.isSelf ? `${a.name}（你）` : `${a.name}${greeting}`;
        }
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
          //   speeds, and in cinematic mode the azimuth slowly swings
          //   behind the direction of travel, so turns rotate the world.
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
          if (cineRef.current && self.blend > 0.4 && now - cam.lastUser > 2500) {
            // swing the camera behind the direction of travel (shortest arc)
            const wantAz = self.heading + Math.PI;
            let dAz = wantAz - cam.az;
            while (dAz > Math.PI) dAz -= Math.PI * 2;
            while (dAz < -Math.PI) dAz += Math.PI * 2;
            cam.az += dAz * Math.min(1, dt * 0.85);
          }
        }
      }
      if (focusRef.current > 0) focusRef.current = Math.max(0, focusRef.current - dt * 0.45);
      const pulse = cineRef.current ? Math.sin(Math.min(1, focusRef.current) * Math.PI) : 0;
      if (cineRef.current && now - cam.lastUser > 7000 && !dragging) cam.az += dt * 0.016;
      if (cam.cut > 0) cam.cut = Math.max(0, cam.cut - dt * 1.3);
      const cutEase = cam.cut * cam.cut;
      const wantDist = cam.dist * (1 - pulse * 0.16) * (1 - cutEase * 0.1);
      cam.distCur += (wantDist - cam.distCur) * Math.min(1, dt * 3.2);
      if (streetRef.current) {
        // street level: near-horizontal lens, close behind the player —
        // the follow logic above already tracks the figure, so the world
        // streams past at eye height like walking the real street
        cam.pol += (1.47 - cam.pol) * Math.min(1, dt * 3);
        cam.distCur += (9.5 - cam.distCur) * Math.min(1, dt * 3);
      }
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
      const cands: { chip: Chip; sx: number; sy: number; prio: number }[] = [];
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
        let prio: number;
        if (chip.kind === "actor") {
          if (chip.self) prio = 0;
          else {
            if (overview && dCam > 20) {
              chip.visible = false;
              chip.el.style.display = "none";
              continue;
            }
            prio = 2 + dCam / 40;
          }
        } else if (chip.kind === "loc") {
          prio = (chip.locId !== undefined && chip.locId === propsRef.current.selfLocId ? 1 : 3) + dCam / 60;
        } else if (chip.metro) {
          prio = 8;
        } else {
          if (overview) {
            chip.visible = false;
            chip.el.style.display = "none";
            continue;
          }
          prio = 9;
        }
        const txt = chip.el.textContent ?? "";
        if (chip.w === 0 || (chip.kind === "actor" && txt !== chip.lastText)) {
          chip.el.style.display = "";
          chip.w = chip.el.offsetWidth;
          chip.h = chip.el.offsetHeight;
          chip.lastText = txt;
        }
        if (chip.w === 0) continue;
        cands.push({ chip, sx, sy, prio });
      }
      if (redo) {
        cands.sort((a, b) => a.prio - b.prio);
        for (const c of cands) {
          const hw = c.chip.w / 2 + 4;
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
      dom.removeEventListener("wheel", onWheel);
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
  const toggleStreetCam = () => {
    const next = !streetRef.current;
    streetRef.current = next;
    setStreetCam(next);
    if (next) {
      autoFitRef.current = false;
      setCine(true);
    } else {
      camRef.current.pol = CAM_POL;
      resetCam();
    }
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
      const dest = propsRef.current.destLocId ? locs.find((l) => l.id === propsRef.current.destLocId) : undefined;
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
        <button type="button" aria-label={streetCam ? "回到全景视角" : "街景视角：贴到街面上，站在街道里看车流、红绿灯和行人"} aria-pressed={streetCam} onClick={toggleStreetCam} className={`grid h-9 w-9 place-items-center rounded-full border text-base shadow ${streetCam ? "border-[var(--accent)] bg-[#14202b]/95" : "border-black/40 bg-[#fffdf8]/95"}`}>🚶</button>
        <button type="button" aria-label={cine ? "关闭电影镜头" : "开启电影镜头"} aria-pressed={cine} onClick={() => setCine((c) => !c)} className={`grid h-9 w-9 place-items-center rounded-full border text-base shadow ${cine ? "border-[var(--accent)] bg-[#14202b]/95" : "border-black/40 bg-[#fffdf8]/95"}`}>🎬</button>
        <span className="grid h-9 min-w-9 place-items-center rounded-full border border-black/40 bg-[#14202b]/90 px-2 text-[11px] font-black text-white shadow" aria-label={`当前缩放 ${zoomPct}%`} title="当前缩放比例（⌂ 回到 100%）">{zoomPct}%</span>
        <button type="button" aria-label="放大地图" onClick={() => zoomBy(0.78)} className="grid h-9 w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 text-base font-black text-[#14202b] shadow">＋</button>
        <button type="button" aria-label="缩小地图" onClick={() => zoomBy(1.28)} className="grid h-9 w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 text-base font-black text-[#14202b] shadow">－</button>
        <button type="button" aria-label="重置视角" onClick={resetCam} className="grid h-9 w-9 place-items-center rounded-full border border-black/40 bg-[#fffdf8]/95 text-base font-black text-[#14202b] shadow">⌂</button>
      </div>
      <p className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-[#0b1622]/70 px-3 py-1.5 text-[11px] font-bold text-white/90">
        拖动旋转 · 滚轮/＋－缩放（右下角显示比例） · 点建筑或标签前往 · 左下小地图看全城、点它定位镜头 · 天色按当地真实时间、云雨按真实天气走 · 右下 ☀️🌇🌙 预览时间 · 🕐 回到真实时间 · 🎥 延时演示 · 🎬 电影镜头 · 🚶 街景视角贴到街面：看车流等红灯、行人过马路、NPC 打招呼
      </p>
      <p className="pointer-events-none absolute left-3 z-10 max-w-[52%] rounded-full bg-[#0b1622]/70 px-3 py-1.5 text-[11px] font-bold text-white/90" style={{ bottom: miniOpen ? 252 : 124 }}>
        🗺️ 示意微缩模型 · 按真实地理方位排布 · 距离经压缩，非等比例测绘
      </p>
      {/* LOL-style minimap: whole-city thumbnail, live-linked to the big map */}
      <div className="absolute bottom-[76px] left-3 z-10">
        {miniOpen ? (
          <div className="overflow-hidden rounded-[12px] border border-black/50 bg-[#0b1622]/85 shadow-xl backdrop-blur-sm">
            <div className="flex items-center gap-1 px-2 py-1">
              <span className="min-w-0 flex-1 truncate text-[11px] font-black text-white/90">🗺️ 小地图 · {CITIES[p.cityKey].name}全城</span>
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
          <button type="button" aria-label="展开小地图" onClick={() => setMiniOpen(true)} className="rounded-full border border-black/50 bg-[#0b1622]/85 px-3.5 py-2 text-xs font-black text-white shadow-xl backdrop-blur-sm transition hover:bg-[#0b1622]">🗺️ 小地图 ▸</button>
        )}
      </div>
      {p.navOverlay}
    </div>
  );
}
