// LifeStage3D: the life-animation stage. The game's own low-poly character
// acts each beat out in a small Three.js set built like the reference video's
// six beats — a furnished station platform with a real train and waiting
// passengers, a metro carriage with seats, poles and ads, an office with a
// glowing code monitor and a colleague typing next door, a restaurant table
// full of dishes under swaying lanterns, a home kitchen with stove, wok and
// cutting board, a bedroom with bedside lamp and clock, a tiled bathroom
// with mirror, sink and washing machine. No empty rooms: every set carries
// furniture, props, signage, warm cinematic light and soft shadows, and the
// camera eases in over each step while the actor's motion is eased (walk
// strides follow an ease-in-out, so nobody teleports or moonwalks).
import { useEffect, useRef, useState } from "react";
import { SCENE_PHOTOS } from "./experience";
import * as THREE from "three";
import { makePostFx, type PostFx } from "./postfx";

export type LifeSet = "flat" | "station" | "metro" | "train" | "bus" | "taxi" | "drive" | "concourse" | "platform" | "office" | "restaurant" | "market" | "mall" | "kitchen" | "bedroom" | "bathroom" | "gym" | "park" | "home" | "cruise" | "wheel" | "aquarium" | "turtle" | "coaster" | "safari" | "hike" | "beach" | "cablecar" | "club" | "clinic" | "classroom";
export type LifePose = "walk" | "idle" | "sit" | "drive" | "type" | "cook" | "eat" | "sleep" | "wash" | "lift" | "stretch" | "talk" | "dance" | "sing";

interface Props {
  setKind: LifeSet;
  pose: LifePose;
  shirt: number;
  pants: number;
  night: boolean;
  emoji: string;
  /** Currency symbol drawn on the taxi meter — HK$ in Hong Kong, ¥ elsewhere. */
  cur?: string;
  /** "flat": which rung of the housing ladder the home is (0 urban village … 3 Nanshan) */
  tier?: number;
  /** "flat": furniture the player bought and where they put it (slot index into FURN_SLOTS) */
  furn?: { id: string; slot: number; color: number }[];
  /** "flat": wall colour from the chosen decoration style */
  wall?: number;
  /** someone who walks up and talks with the player (shop clerk, doctor, friend) */
  partner?: { shirt: number; pants: number };
}

/** where furniture can go in the 3D home: x, z, facing — kept clear of the spot the player stands on */
export const FURN_SLOTS: { x: number; z: number; ry: number; zh: string; en: string }[] = [
  { x: -2.7, z: -0.6, ry: 0.45, zh: "左中", en: "Middle left" },
  { x: 2.8, z: -0.6, ry: -0.45, zh: "右中", en: "Middle right" },
  { x: -3.6, z: -2.4, ry: 0.2, zh: "左后角", en: "Back left" },
  { x: 3.7, z: -2.4, ry: -0.2, zh: "右后角", en: "Back right" },
  { x: 1.9, z: -2.7, ry: 0, zh: "靠后墙", en: "Back wall" },
  { x: -2.2, z: 1.3, ry: 0.6, zh: "左前", en: "Front left" },
  { x: 2.3, z: 1.3, ry: -0.6, zh: "右前", en: "Front right" },
];

/* ---------------- canvas texture helpers ---------------- */

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function glowTexture(): THREE.Texture {
  return canvasTex(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
}

function faceSprite(emoji: string): THREE.Sprite {
  const tex = canvasTex(80, 80, (g) => {
    g.font = "54px sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(emoji, 40, 44);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(0.62, 0.62, 1);
  sp.renderOrder = 10;
  return sp;
}

/** A self-lit board (sign / screen / menu) with centred text lines. */
function boardTex(bg: string, lines: { t: string; s: number; c: string; bold?: boolean }[], w = 512, h = 256): THREE.CanvasTexture {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const total = lines.reduce((a, l) => a + l.s * 1.45, 0);
    let y = (h - total) / 2;
    for (const l of lines) {
      y += l.s * 1.05;
      g.font = `${l.bold === false ? "500" : "900"} ${l.s}px 'Noto Sans SC', sans-serif`;
      g.fillStyle = l.c; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(l.t, w / 2, y);
      y += l.s * 0.4;
    }
  });
}

function floorTex(kind: "wood" | "tile" | "concrete" | "carriage" | "grass"): THREE.CanvasTexture {
  const tex = canvasTex(256, 256, (g) => {
    const rnd = (i: number) => ((i * 2654435761) % 1000) / 1000;
    if (kind === "wood") {
      g.fillStyle = "#9a6b40"; g.fillRect(0, 0, 256, 256);
      for (let r = 0; r < 8; r++) {
        g.fillStyle = `rgba(${140 + rnd(r) * 40},${92 + rnd(r + 9) * 26},${52 + rnd(r + 3) * 18},0.55)`;
        g.fillRect(0, r * 32, 256, 31);
        g.fillStyle = "rgba(60,35,15,0.8)"; g.fillRect(0, r * 32, 256, 2);
        g.fillRect(((r * 97) % 200) + 20, r * 32, 2, 32);
      }
    } else if (kind === "tile") {
      g.fillStyle = "#b9cdd2"; g.fillRect(0, 0, 256, 256);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        g.fillStyle = `rgba(255,255,255,${0.05 + rnd(r * 4 + c) * 0.12})`;
        g.fillRect(c * 64 + 2, r * 64 + 2, 60, 60);
      }
    } else if (kind === "grass") {
      g.fillStyle = "#5f9e52"; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 500; i++) {
        g.fillStyle = `rgba(${40 + rnd(i) * 50},${110 + rnd(i + 5) * 60},40,0.5)`;
        g.fillRect(rnd(i + 1) * 256, rnd(i + 2) * 256, 3, 5);
      }
    } else {
      g.fillStyle = kind === "carriage" ? "#39424e" : "#98928a"; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 700; i++) {
        g.fillStyle = `rgba(${kind === "carriage" ? "210,225,240" : "40,35,30"},${0.04 + rnd(i) * 0.07})`;
        g.fillRect(rnd(i + 1) * 256, rnd(i + 2) * 256, 2.5, 2.5);
      }
      g.fillStyle = "rgba(20,20,20,0.35)"; g.fillRect(0, 0, 256, 3); g.fillRect(0, 0, 3, 256);
    }
  });
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

/** a city skyline through floor-to-ceiling glass: towers with lit windows, the Spring Bamboo tower */
function skylineTex(night: boolean): THREE.CanvasTexture {
  return canvasTex(1024, 384, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    if (night) { grad.addColorStop(0, "#0b1530"); grad.addColorStop(0.7, "#27406e"); grad.addColorStop(1, "#c46a3a"); }
    else { grad.addColorStop(0, "#8cc4ec"); grad.addColorStop(1, "#f3d9b0"); }
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let x = 0; x < w; ) {
      const bw = 30 + rnd() * 60, bh = 80 + rnd() * 220;
      g.fillStyle = night ? "#121c33" : "#7d8ea3"; g.fillRect(x, h - bh, bw, bh);
      for (let yy = h - bh + 8; yy < h - 6; yy += 12) for (let xx = x + 5; xx < x + bw - 6; xx += 10) {
        if (rnd() < (night ? 0.55 : 0.25)) { g.fillStyle = night ? (rnd() < 0.8 ? "#ffd27a" : "#9fd3ff") : "#c9d8e6"; g.fillRect(xx, yy, 5, 6); }
      }
      x += bw + 4;
    }
    // the Spring Bamboo tower: a tall tapering silhouette with a lit crown
    g.fillStyle = night ? "#0e1729" : "#6d7f96";
    g.beginPath(); g.moveTo(w * 0.62, h); g.lineTo(w * 0.635, h * 0.08); g.lineTo(w * 0.665, h * 0.08); g.lineTo(w * 0.68, h); g.fill();
    if (night) { g.fillStyle = "#ffffff"; g.fillRect(w * 0.645, h * 0.1, 6, h * 0.8); }
  });
}
function skyTex(night: boolean): THREE.CanvasTexture {
  return canvasTex(256, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 256);
    if (night) { grad.addColorStop(0, "#101f38"); grad.addColorStop(1, "#33507c"); }
    else { grad.addColorStop(0, "#7ec2ee"); grad.addColorStop(0.7, "#cfe8f7"); grad.addColorStop(1, "#ffe9c4"); }
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    if (night) {
      g.fillStyle = "#f5f0d8";
      for (let i = 0; i < 42; i++) g.fillRect(((i * 83) % 250) + 2, ((i * 57) % 130) + 4, 2, 2);
      g.beginPath(); g.arc(206, 48, 17, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#16283f"; g.beginPath(); g.arc(216, 42, 15, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = "#fff3b0"; g.beginPath(); g.arc(52, 46, 20, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,255,255,0.92)";
      for (const [x, y, s] of [[120, 52, 15], [146, 46, 11], [196, 74, 12], [88, 84, 9]] as const) {
        g.beginPath(); g.ellipse(x, y, s * 1.7, s * 0.62, 0, 0, Math.PI * 2); g.fill();
      }
    }
    // distant skyline silhouettes along the bottom of the window
    g.fillStyle = night ? "#0a1524" : "#7d99b4";
    let x = 0;
    for (let i = 0; x < 256; i++) {
      const bw = 18 + ((i * 41) % 22), bh = 34 + ((i * 67) % 52);
      g.fillRect(x, 256 - bh, bw, bh);
      if (night) {
        g.fillStyle = "#ffd98a";
        for (let k = 0; k < 5; k++) g.fillRect(x + 3 + ((k * 7 + i) % (bw - 6)), 256 - bh + 6 + ((k * 13 + i * 3) % (bh - 12)), 2.5, 3);
        g.fillStyle = "#0a1524";
      }
      x += bw + 3;
    }
  });
}

function codeTex(): THREE.CanvasTexture {
  const tex = canvasTex(256, 160, (g) => {
    g.fillStyle = "#0d1524"; g.fillRect(0, 0, 256, 160);
    const palette = ["#7dd3fc", "#f0abfc", "#a3e635", "#fbbf24", "#e2e8f0", "#f87171"];
    for (let row = 0; row < 11; row++) {
      let x = 8 + (row % 3) * 14;
      const segs = 2 + (row * 7) % 3;
      for (let sIdx = 0; sIdx < segs; sIdx++) {
        const wSeg = 22 + ((row * 31 + sIdx * 47) % 52);
        g.fillStyle = palette[(row * 3 + sIdx) % palette.length]!;
        g.fillRect(x, 10 + row * 14, Math.min(wSeg, 244 - x), 6);
        x += wSeg + 9;
        if (x > 235) break;
      }
    }
  });
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** The view rushing past a carriage window: dusk skyline, lit windows. */
function viewTex(): THREE.CanvasTexture {
  const tex = canvasTex(512, 128, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, "#2b4a73"); grad.addColorStop(0.65, "#7a6a8e"); grad.addColorStop(1, "#e8955a");
    g.fillStyle = grad; g.fillRect(0, 0, 512, 128);
    let x = 0;
    for (let i = 0; x < 512; i++) {
      const bw = 26 + ((i * 53) % 34), bh = 44 + ((i * 71) % 62);
      g.fillStyle = "#131c2b";
      g.fillRect(x, 128 - bh, bw, bh);
      g.fillStyle = "#ffd98a";
      for (let k = 0; k < 7; k++) {
        const lx = x + 4 + ((k * 11 + i * 3) % Math.max(6, bw - 8));
        const ly = 128 - bh + 6 + ((k * 17 + i) % Math.max(8, bh - 14));
        if ((k + i) % 3 !== 0) g.fillRect(lx, ly, 3.5, 4.5);
      }
      g.fillStyle = "#131c2b";
      x += bw + 4;
    }
    g.fillStyle = "#0d1420"; g.fillRect(0, 122, 512, 6);
  });
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** A schematic metro line-map board for the concourse wall. */
function lineMapTex(): THREE.CanvasTexture {
  return canvasTex(256, 176, (g) => {
    g.fillStyle = "#101c2c"; g.fillRect(0, 0, 256, 176);
    g.font = "900 15px 'Noto Sans SC', sans-serif";
    g.fillStyle = "#ffffff"; g.textAlign = "left";
    g.fillText("地铁线网图", 12, 22);
    const routes: { c: string; pts: [number, number][] }[] = [
      { c: "#008c2e", pts: [[14, 130], [70, 118], [128, 96], [190, 84], [242, 70]] },
      { c: "#f39800", pts: [[20, 52], [80, 74], [128, 96], [186, 118], [238, 138]] },
      { c: "#0096d6", pts: [[44, 160], [88, 128], [128, 96], [176, 62], [226, 30]] },
      { c: "#e60012", pts: [[128, 168], [128, 96], [124, 48], [130, 12]] },
      { c: "#7b2d8b", pts: [[16, 96], [70, 92], [128, 96], [188, 88], [240, 96]] },
      { c: "#e6007e", pts: [[128, 96], [172, 78], [214, 52], [244, 26]] },
    ];
    for (const r of routes) {
      g.strokeStyle = r.c; g.lineWidth = 4; g.lineCap = "round";
      g.beginPath();
      r.pts.forEach(([x, y], i) => { if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); });
      g.stroke();
      g.fillStyle = "#ffffff";
      for (const [x, y] of r.pts) { g.beginPath(); g.arc(x, y, 3.4, 0, Math.PI * 2); g.fill(); }
    }
    g.fillStyle = "#ffd98a";
    g.beginPath(); g.arc(128, 96, 6, 0, Math.PI * 2); g.fill();
  });
}

function clockTex(): THREE.CanvasTexture {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = "#fdfcf7"; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#2b2118"; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#2b2118";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.fillRect(64 + Math.sin(a) * 47 - 1.5, 64 - Math.cos(a) * 47 - 1.5, 3, 3);
    }
    g.strokeStyle = "#2b2118"; g.lineWidth = 6; g.lineCap = "round";
    g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + 26, 64 - 20); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 - 8, 64 - 40); g.stroke();
    g.strokeStyle = "#e63a1f"; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + 38, 64 + 16); g.stroke();
  });
}

/* ---------------- the low-poly figure ---------------- */

interface Figure {
  g: THREE.Group; legL: THREE.Group; legR: THREE.Group;
  armL: THREE.Group; armR: THREE.Group; head: THREE.Mesh; torso: THREE.Mesh;
}

function makeFigure(mat: (c: number, r?: number) => THREE.MeshStandardMaterial, shirt: number, pants: number, skin = 0xf2c79b): Figure {
  // Detailed figure (PC high-end pass — no longer plain low-poly blocks):
  // rounded high-segment head with ears and a jaw taper, a neck, layered
  // hair with a fringe, a torso with collar / placket / belt, arms ending
  // in hands, and legs ending in shoes. Pivot layout is unchanged, so
  // every existing pose and animation keeps working.
  const g = new THREE.Group();
  const shirtMat = mat(shirt, 0.62);
  const darkMat = mat(new THREE.Color(shirt).multiplyScalar(0.78).getHex(), 0.68);
  const pantsMat = mat(pants, 0.82);
  const skinMat = mat(skin, 0.62);
  const mkLimb = (m: THREE.Material, w: number, len: number) => {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, len, w + 0.03), m);
    mesh.position.y = -len / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    return pivot;
  };
  const shoeMat = mat(0x2e2620, 0.45);
  const mkLeg = (side: number) => {
    const leg = mkLimb(pantsMat, 0.21, 0.82);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.11, 0.4), shoeMat);
    shoe.position.set(0, -0.79, 0.07);
    shoe.castShadow = true;
    leg.add(shoe);
    leg.position.set(side, 0.86, 0);
    g.add(leg);
    return leg;
  };
  const legL = mkLeg(-0.16);
  const legR = mkLeg(0.16);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.74, 0.37), shirtMat);
  torso.position.y = 1.24; torso.castShadow = true; g.add(torso);
  // collar + placket + belt: the small tailoring that reads as clothing
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.09, 0.4), darkMat);
  collar.position.y = 1.63; g.add(collar);
  const placket = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.6, 0.02), darkMat);
  placket.position.set(0, 1.26, 0.195); g.add(placket);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.09, 0.39), mat(0x3a2c20, 0.55));
  belt.position.y = 0.9; g.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.02), mat(0xd9b45a, 0.3));
  buckle.position.set(0, 0.9, 0.2); g.add(buckle);
  const mkArm = (side: number) => {
    const arm = mkLimb(darkMat, 0.18, 0.68);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), skinMat);
    hand.position.y = -0.7;
    hand.castShadow = true;
    arm.add(hand);
    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.22), shirtMat);
    cuff.position.y = -0.6;
    arm.add(cuff);
    arm.position.set(side, 1.56, 0);
    g.add(arm);
    return arm;
  };
  const armL = mkArm(-0.42);
  const armR = mkArm(0.42);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 12), skinMat);
  neck.position.y = 1.66; g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 24, 18), skinMat);
  head.position.y = 1.88; head.scale.set(0.94, 1.05, 0.98); head.castShadow = true; g.add(head);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), skinMat);
    ear.position.set(side * 0.29, 1.88, 0);
    ear.scale.set(0.5, 0.8, 0.7);
    g.add(ear);
  }
  const hairMat = mat(0x2b2118, 0.92);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.325, 24, 16), hairMat);
  hair.position.y = 1.99; hair.scale.set(1, 0.72, 1); g.add(hair);
  const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.13, 0.1), hairMat);
  fringe.position.set(0, 2.02, 0.26);
  fringe.rotation.x = 0.25;
  g.add(fringe);
  for (const side of [-1, 1]) {
    const sideHair = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.24), hairMat);
    sideHair.position.set(side * 0.29, 1.9, 0.02);
    g.add(sideHair);
  }
  return { g, legL, legR, armL, armR, head, torso };
}

/* ---------------- component ---------------- */

export function LifeStage3D(p: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef(p);
  propsRef.current = p;
  const [glFailed, setGlFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const { setKind, pose, shirt, pants, night, emoji, cur, tier, furn, wall, partner } = propsRef.current;
    // Same WebGL guard as the main map: a refused context degrades to the
    // emoji fallback below instead of crashing the animation overlay.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    } catch {
      setGlFailed(true);
      return;
    }
    // 1.5x cap: on Retina (dpr 2) the full post chain at 2x is 4x the pixels
    // of 1x — the single biggest per-frame GPU cost. 1.5x stays crisp.
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";

    const indoor = setKind === "flat" || setKind === "office" || setKind === "kitchen" || setKind === "bathroom" || setKind === "bedroom" || setKind === "home" || setKind === "restaurant" || setKind === "gym" || setKind === "concourse" || setKind === "platform" || setKind === "club" || setKind === "clinic" || setKind === "classroom";
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(night ? 0x1d3454 : indoor ? 0xf7e3bd : 0xffd9a0);
    scene.fog = new THREE.Fog(scene.background as THREE.Color, 17, 32);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
    // Same cinematic post chain as the map: bloom + warm grade +
    // tilt-shift depth of field, so the acted scenes lean toward the
    // reference video's film look. Null = plain-renderer fallback.
    const fx: PostFx | null = makePostFx(renderer, scene, camera, { bloomStrength: 0.38, bloomThreshold: 0.72, blur: 0.0052 });

    const hemi = new THREE.HemisphereLight(night ? 0x8fb6ff : 0xfff2d8, 0x8a5a3b, night ? 0.5 : 0.85);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(night ? 0xffc98a : 0xffdfae, night ? 1.1 : 2.1);
    sun.position.set(4, 7, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.normalBias = 0.02;
    sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
    sun.shadow.radius = 5;
    scene.add(sun);
    const warm = new THREE.PointLight(0xffb35c, night ? 22 : 9, 13, 1.8);
    warm.position.set(-2.5, 3, 2.5);
    scene.add(warm);

    const mat = (color: number, rough = 0.85, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
    const box = (w: number, h: number, d: number, color: number, x: number, y: number, z: number, rough = 0.85, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, rough, extra));
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
      return m;
    };
    const cyl = (rt: number, rb: number, h: number, color: number, x: number, y: number, z: number, rough = 0.7, extra: Partial<THREE.MeshStandardMaterialParameters> = {}, seg = 14) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, rough, extra));
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
      return m;
    };
    const plane = (w: number, h: number, tex: THREE.Texture, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      m.position.set(x, y, z);
      scene.add(m);
      return m;
    };
    const glowTex = glowTexture();
    const addGlow = (x: number, y: number, z: number, scale: number, color = 0xffd9a0, opacity = 0.5) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false }));
      sp.position.set(x, y, z);
      sp.scale.setScalar(scale);
      scene.add(sp);
      return sp;
    };

    /* ---- animation registries ---- */
    const steamSprites: THREE.Sprite[] = [];
    const zzzSprites: THREE.Sprite[] = [];
    const bobbers: { g: THREE.Group; ph: number; amp: number }[] = [];
    const tapers: { f: Figure; ph: number }[] = [];
    const streaks: { m: THREE.Mesh; c: number; hw: number; sp: number; off: number }[] = [];
    /* traffic-light heads whose lamps the frame loop cycles red→green */
    const tlights: { red: THREE.MeshStandardMaterial; yel: THREE.MeshStandardMaterial; grn: THREE.MeshStandardMaterial; off: number }[] = [];
    const swayers: { g: THREE.Group; ph: number }[] = [];
    const spinners: THREE.Object3D[] = [];
    const dancers: { f: Figure; ph: number; y: number }[] = [];
    const clubLights: { l: THREE.PointLight; ph: number }[] = [];
    const motes: { sp: THREE.Sprite; ph: number }[] = [];
    const codeTexs: THREE.CanvasTexture[] = [];
    const scrollTexs: THREE.CanvasTexture[] = [];
    let flameLight: THREE.PointLight | null = null;
    let washStream: THREE.Object3D | null = null;

    const addSteam = (x: number, y: number, z: number) => {
      for (let i = 0; i < 6; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff6e8, transparent: true, opacity: 0.4, depthWrite: false }));
        sp.position.set(x, y, z);
        sp.userData.phase = i / 6;
        sp.userData.x = x; sp.userData.y = y; sp.userData.z = z;
        scene.add(sp);
        steamSprites.push(sp);
      }
    };
    const extraFigure = (fx: number, fy: number, fz: number, ry: number, fShirt: number, fPants: number, seated = false) => {
      const f = makeFigure(mat, fShirt, fPants);
      f.g.position.set(fx, fy, fz);
      f.g.rotation.y = ry;
      if (seated) { f.legL.rotation.x = -1.35; f.legR.rotation.x = -1.3; }
      scene.add(f.g);
      bobbers.push({ g: f.g, ph: fx * 1.7 + fz, amp: 0.012 });
      return f;
    };

    /* ---- floor ---- */
    const floorKind = setKind === "bathroom" || setKind === "kitchen" || setKind === "concourse" ? "tile" : setKind === "station" || setKind === "platform" ? "concrete" : setKind === "metro" || setKind === "train" || setKind === "bus" || setKind === "taxi" || setKind === "drive" ? "carriage" : setKind === "park" ? "grass" : setKind === "mall" ? "tile" : "wood";
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 14), new THREE.MeshStandardMaterial({ map: floorTex(floorKind), roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    /* ---- room shell for indoor sets: two-tone walls, wainscot, window, lamp ---- */
    const roomShell = (wallColor0: number, wainsColor: number, opts: { windowX?: number; windowW?: number; clock?: boolean } = {}) => {
      const wallColor = setKind === "flat" && wall !== undefined ? wall : wallColor0;
      box(22, 8, 0.3, wallColor, 0, 4, -3.75, 1);
      box(22, 1.05, 0.34, wainsColor, 0, 0.53, -3.73, 0.7);
      box(22, 0.09, 0.36, 0x4a3a28, 0, 1.1, -3.72, 0.6);
      box(0.3, 8, 12, wallColor, -7.2, 4, 0, 1);
      box(0.34, 1.05, 12, wainsColor, -7.18, 0.53, 0, 0.7);
      if (opts.windowX !== undefined) {
        const wx = opts.windowX, ww = opts.windowW ?? 2.1;
        box(ww + 0.24, 1.94, 0.1, 0xffffff, wx, 2.72, -3.56, 0.5);
        plane(ww, 1.7, skyTex(night), wx, 2.72, -3.5);
        box(ww + 0.34, 0.09, 0.22, 0xe8e2d4, wx, 1.72, -3.5, 0.6);
        box(0.07, 1.7, 0.06, 0xffffff, wx, 2.72, -3.48, 0.5);
        box(0.3, 2.1, 0.08, night ? 0x33507c : 0xd9534a, wx - ww / 2 - 0.22, 2.66, -3.42, 0.95);
        box(0.3, 2.1, 0.08, night ? 0x33507c : 0xd9534a, wx + ww / 2 + 0.22, 2.66, -3.42, 0.95);
        if (!night) addGlow(wx, 2.6, -3.2, 3.2, 0xfff2c8, 0.35);
      }
      if (opts.clock) {
        const ck = cyl(0.34, 0.34, 0.06, 0x2b2118, 5.6, 3.3, -3.55, 0.5);
        ck.rotation.x = Math.PI / 2;
        plane(0.6, 0.6, clockTex(), 5.6, 3.3, -3.51);
      }
      // pendant lamp: cord + warm shade + glow
      const pg = new THREE.Group();
      pg.position.set(0.6, 4.6, -0.6);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), mat(0x3a3a3a, 0.6));
      cord.position.y = -0.55; pg.add(cord);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.34, 14, 1, true), mat(0xf5b942, 0.5, { emissive: 0xffc873, emissiveIntensity: night ? 1.5 : 0.75, side: THREE.DoubleSide }));
      shade.position.y = -1.2; pg.add(shade);
      scene.add(pg);
      addGlow(0.6, 3.35, -0.6, 2.1, 0xffc98a, night ? 0.65 : 0.4);
    };
    const addPicture = (x: number, y: number, w: number, h: number, inner: number) => {
      box(w + 0.12, h + 0.12, 0.06, 0x6b4a2f, x, y, -3.55, 0.6);
      box(w, h, 0.07, inner, x, y, -3.55, 0.9);
    };

    /** Per-frame updates for sets with moving parts (water, fish, turtles…). */
    const ticks: ((t: number) => void)[] = [];

    /* ================= SET DRESSING ================= */
    if (setKind === "station") {
      // platform slab + safety lines
      box(17, 0.24, 4.6, 0xa39a8d, 0, -0.12, -0.3, 1);
      box(17, 0.03, 0.3, 0xf5b942, 0, 0.02, -1.28, 0.8);
      box(17, 0.03, 0.1, 0xf3ead8, 0, 0.02, -1.62, 0.8);
      // the train: silver body, red stripe, lit windows, two doors
      const train = box(15, 2.7, 1.9, 0xb9c6d2, 0, 1.95, -3.3, 0.32, { metalness: 0.55 });
      train.castShadow = false;
      box(15, 0.4, 1.94, 0xe63a1f, 0, 1.28, -3.3, 0.4, { metalness: 0.3 });
      box(15.2, 0.22, 2, 0x8fa3b5, 0, 3.4, -3.3, 0.4, { metalness: 0.5 });
      for (let i = 0; i < 7; i++) box(1.05, 0.75, 0.06, 0xffd98a, -5.4 + i * 1.8, 2.45, -2.32, 0.3, { emissive: 0xffc873, emissiveIntensity: night ? 1.5 : 0.6 });
      for (const dx of [-2.6, 3.1]) {
        box(1.15, 2.05, 0.07, 0x9fb2c2, dx, 1.62, -2.31, 0.35, { metalness: 0.5 });
        box(0.05, 2.05, 0.08, 0x5a6a78, dx, 1.62, -2.3, 0.4);
        box(0.4, 0.55, 0.08, 0x39505f, dx - 0.28, 2.2, -2.3, 0.3);
        box(0.4, 0.55, 0.08, 0x39505f, dx + 0.28, 2.2, -2.3, 0.3);
      }
      // columns + beams + light strips
      for (const cx of [-5.4, 5.4]) {
        box(0.55, 5.4, 0.55, 0xd8d2c4, cx, 2.7, -0.9, 0.7);
        box(0.6, 0.5, 0.6, 0xe63a1f, cx, 3.6, -0.9, 0.6);
      }
      box(17, 0.28, 0.34, 0x8d8378, 0, 5.2, -2.4, 0.8);
      box(17, 0.28, 0.34, 0x8d8378, 0, 5.2, 0.9, 0.8);
      const strip = box(7, 0.07, 0.34, 0xfff2d8, 0, 5.02, -2.4, 0.4, { emissive: 0xffe9b8, emissiveIntensity: night ? 1.6 : 0.9 });
      strip.castShadow = false;
      // hanging station sign
      box(0.05, 0.7, 0.05, 0x5a5348, -1.2, 4.6, -0.9); box(0.05, 0.7, 0.05, 0x5a5348, 1.2, 4.6, -0.9);
      box(3.9, 0.95, 0.1, 0x14202b, 0, 4.05, -0.9, 0.5);
      plane(3.8, 0.88, boardTex("#14202b", [{ t: "高 铁 站 台", s: 74, c: "#ffffff" }, { t: "PLATFORM · 请在黄线内候车", s: 34, c: "#f5b942" }]), 0, 4.05, -0.84);
      // departure board on the right column
      box(1.7, 1.15, 0.08, 0x0b1220, 5.4, 2.5, -0.58, 0.5);
      plane(1.6, 1.05, boardTex("#0b1220", [{ t: "车次 · 终到 · 状态", s: 30, c: "#7dd3fc" }, { t: "G1007 深圳北 进站中", s: 30, c: "#a3e635" }, { t: "G6352 广州南 候 车", s: 30, c: "#e2e8f0" }, { t: "D3125 惠州南 准 点", s: 30, c: "#e2e8f0" }]), 5.4, 2.5, -0.53);
      // bench + waiting passengers + suitcases
      box(2.3, 0.12, 0.52, 0x8a6f4d, -3.2, 0.52, 0.85, 0.8);
      box(2.3, 0.55, 0.1, 0x8a6f4d, -3.2, 0.95, 1.12, 0.8);
      box(0.12, 0.52, 0.12, 0x5a4632, -4.2, 0.26, 0.85); box(0.12, 0.52, 0.12, 0x5a4632, -2.2, 0.26, 0.85);
      extraFigure(-3.5, -0.3, 0.8, Math.PI, 0x14b8a6, 0x334155, true);
      box(0.46, 0.66, 0.26, 0xd9534a, -2.45, 0.33, 1.15, 0.5);
      box(0.05, 0.3, 0.05, 0x8a8f96, -2.45, 0.8, 1.15, 0.4, { metalness: 0.6 });
      const standing = extraFigure(3.5, 0, 0.15, Math.PI, 0x78716c, 0x2f333a);
      standing.armR.rotation.x = -0.5;
      box(0.44, 0.62, 0.25, 0x2e4a5f, 3.95, 0.31, 0.5, 0.5);
      // drifting dust motes in the light
      for (let i = 0; i < 9; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff2d8, transparent: true, opacity: 0.25, depthWrite: false }));
        sp.position.set(-5 + (i * 1.3) % 10, 1 + (i % 4) * 0.8, -0.5 + (i % 3) * 0.7);
        sp.scale.setScalar(0.14);
        sp.userData.x = sp.position.x;
        scene.add(sp);
        motes.push({ sp, ph: i * 0.7 });
      }
    } else if (setKind === "metro") {
      // carriage interior: wall, windows with passing light streaks, doors, ads
      box(17, 4.2, 0.25, 0xaebfcc, 0, 2.1, -2.5, 0.5, { metalness: 0.25 });
      box(17, 0.5, 0.27, 0x7e97a8, 0, 3.95, -2.5, 0.5);
      for (const wx of [-4.4, -1.5, 1.5, 4.4]) {
        box(2.06, 1.26, 0.06, 0x5a6a78, wx, 2.3, -2.38, 0.4, { metalness: 0.4 });
        const vt = viewTex(); scrollTexs.push(vt);
        plane(1.92, 1.12, vt, wx, 2.3, -2.34);
        for (let sIdx = 0; sIdx < 2; sIdx++) {
          const bar = box(0.16, 0.85, 0.03, 0xbfd9ea, wx, 2.3, -2.32, 0.3, { emissive: 0x9fc8e8, emissiveIntensity: 1.1 });
          bar.castShadow = false;
          streaks.push({ m: bar, c: wx, hw: 0.8, sp: 1.6 + sIdx * 0.7, off: sIdx * 1.1 });
        }
      }
      for (const dx of [-0.52, 0.52]) {
        box(0.98, 2.1, 0.07, 0x9db4c6, dx, 1.5, -2.35, 0.4, { metalness: 0.4 });
        box(0.42, 0.6, 0.08, 0x39505f, dx, 1.95, -2.34, 0.3);
      }
      box(0.05, 2.1, 0.08, 0x5a6a78, 0, 1.5, -2.34, 0.4);
      plane(2.5, 0.62, boardTex("#0c4a6e", [{ t: "峰会· 深圳欢迎您", s: 44, c: "#ffffff", bold: true }, { t: "Welcome to Shenzhen", s: 30, c: "#bae6fd" }]), -3, 3.28, -2.36);
      plane(2.5, 0.62, boardTex("#fdf6da", [{ t: "先下后上 · 文明乘车", s: 40, c: "#7c5c00", bold: true }, { t: "请勿饮食 · 扶稳站好", s: 28, c: "#a5851f" }]), 3, 3.28, -2.36);
      // bench seats with segmented cushions
      box(11.5, 0.16, 0.55, 0x5a6a78, 0, 0.62, -2.0, 0.5, { metalness: 0.3 });
      for (let i = 0; i < 6; i++) box(1.8, 0.05, 0.5, i % 2 ? 0x3f6d8e : 0x4a7fa5, -4.7 + i * 1.88, 0.72, -2.0, 0.6);
      box(11.5, 0.65, 0.1, 0x8fa9bc, 0, 1.15, -2.28, 0.5);
      // poles + hanging straps
      for (const px of [-2.3, 2.3]) cyl(0.035, 0.035, 3.3, 0xc8ccd2, px, 1.65, -0.75, 0.25, { metalness: 0.8 });
      const railBar = cyl(0.03, 0.03, 9.6, 0xc8ccd2, 0, 3.05, -0.75, 0.25, { metalness: 0.8 });
      railBar.rotation.z = Math.PI / 2;
      for (let i = 0; i < 6; i++) {
        box(0.05, 0.42, 0.05, 0x9a958a, -3.6 + i * 1.45, 2.85, -0.75, 0.6);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.028, 6, 14), mat(0xe8e2d4, 0.5));
        ring.position.set(-3.6 + i * 1.45, 2.55, -0.75);
        scene.add(ring);
      }
      const ceilLight = box(11, 0.06, 0.55, 0xfff6e0, 0, 3.62, -1.1, 0.4, { emissive: 0xfff2d8, emissiveIntensity: 1.2 });
      ceilLight.castShadow = false;
      // fellow passengers: three seated (one on their phone), one standing at the pole
      extraFigure(-3.7, -0.28, -1.95, Math.PI, 0xec4899, 0x3a3f4a, true);
      const phoneRider = extraFigure(-0.95, -0.28, -1.95, Math.PI, 0x6b7280, 0x2f333a, true);
      phoneRider.armL.rotation.x = -0.95; phoneRider.armR.rotation.x = -0.95;
      phoneRider.head.rotation.x = 0.35;
      box(0.16, 0.3, 0.04, 0x14202b, -0.95, 0.98, -1.62, 0.3, { emissive: 0x7dd3fc, emissiveIntensity: 0.7 });
      extraFigure(2.9, -0.28, -1.95, Math.PI, 0x22c55e, 0x374151, true);
      const stander = extraFigure(1.95, 0, -0.55, Math.PI, 0xf5b301, 0x2e3440);
      stander.armR.rotation.x = -2.75;
    } else if (setKind === "train") {
      // HSR / intercity carriage: cream walls, blue stripe, wide windows
      // with the landscape streaking past much faster than the metro,
      // individual 2+2 seats, luggage rack, seat-back info card.
      box(17, 4.2, 0.25, 0xe9edf1, 0, 2.1, -2.5, 0.45, { metalness: 0.2 });
      box(17, 0.34, 0.27, 0x2b5ea7, 0, 3.62, -2.5, 0.5);
      for (const wx of [-4.2, -1.4, 1.4, 4.2]) {
        box(2.3, 1.3, 0.06, 0x5a6a78, wx, 2.35, -2.38, 0.4, { metalness: 0.4 });
        const vt = viewTex(); scrollTexs.push(vt);
        plane(2.16, 1.16, vt, wx, 2.35, -2.34);
        for (let sIdx = 0; sIdx < 2; sIdx++) {
          const bar = box(0.14, 0.9, 0.03, 0xd8ecff, wx, 2.35, -2.32, 0.3, { emissive: 0x9fc8e8, emissiveIntensity: 1.1 });
          bar.castShadow = false;
          streaks.push({ m: bar, c: wx, hw: 0.9, sp: 3.1 + sIdx * 0.9, off: sIdx * 1.3 });
        }
      }
      // luggage rack above the windows + a suitcase on it
      box(11.5, 0.09, 0.5, 0xb9c4ce, 0, 3.28, -2.15, 0.4, { metalness: 0.5 });
      box(0.85, 0.5, 0.34, 0xd9534a, -3.4, 3.58, -2.15, 0.5);
      box(0.8, 0.46, 0.32, 0x2e4a5f, 2.8, 3.56, -2.15, 0.5);
      plane(3.1, 0.6, boardTex("#12283f", [{ t: "复兴号 · 和谐号", s: 46, c: "#ffffff", bold: true }, { t: "下一站到站提醒 · 请勿倚靠车门", s: 28, c: "#bae6fd" }]), 0, 3.05, -2.36);
      // individual seats (base + tall back + headrest), player's at x≈0.95
      for (const sx of [-3.9, -2.5, 2.5, 3.9]) {
        box(1.15, 0.16, 0.85, 0x2b5ea7, sx, 0.62, -1.95, 0.6);
        box(1.15, 1.05, 0.2, 0x2b5ea7, sx, 1.2, -2.32, 0.6);
        box(0.6, 0.28, 0.14, 0xe9edf1, sx, 1.85, -2.3, 0.6);
      }
      box(1.15, 0.16, 0.85, 0x356cb3, 0.95, 0.62, -1.95, 0.6);
      box(1.15, 1.05, 0.2, 0x356cb3, 0.95, 1.2, -2.32, 0.6);
      box(0.6, 0.28, 0.14, 0xe9edf1, 0.95, 1.85, -2.3, 0.6);
      const ceilLightT = box(11, 0.06, 0.5, 0xfff6e0, 0, 3.95, -1.2, 0.4, { emissive: 0xfff2d8, emissiveIntensity: 1.1 });
      ceilLightT.castShadow = false;
      extraFigure(-3.2, -0.28, -1.9, Math.PI, 0x78716c, 0x2f333a, true);
      const reader = extraFigure(3.2, -0.28, -1.9, Math.PI, 0x0ea5e9, 0x334155, true);
      reader.armL.rotation.x = -0.8; reader.armR.rotation.x = -0.8;
      reader.head.rotation.x = 0.3;
    } else if (setKind === "bus") {
      // city bus interior: windows with street-level scenery sliding by,
      // yellow grab poles, stop-announce board, driver up front.
      box(17, 4.2, 0.25, 0xdfe7ec, 0, 2.1, -2.5, 0.55);
      box(17, 0.4, 0.27, 0x2563eb, 0, 3.9, -2.5, 0.5);
      for (const wx of [-4.4, -1.5, 1.5, 4.4]) {
        box(2.06, 1.2, 0.06, 0x5a6a78, wx, 2.35, -2.38, 0.4, { metalness: 0.35 });
        const vt = viewTex(); scrollTexs.push(vt);
        plane(1.92, 1.06, vt, wx, 2.35, -2.34);
        const bar = box(0.14, 0.8, 0.03, 0xbfd9ea, wx, 2.35, -2.32, 0.3, { emissive: 0x9fc8e8, emissiveIntensity: 0.9 });
        bar.castShadow = false;
        streaks.push({ m: bar, c: wx, hw: 0.8, sp: 1.15, off: wx });
      }
      plane(2.9, 0.6, boardTex("#7c2d12", [{ t: "下一站提醒 · 请提前按铃", s: 40, c: "#ffffff", bold: true }, { t: "请给老幼病残孕让座", s: 28, c: "#fed7aa" }]), 0, 3.3, -2.36);
      // seat row: blue-grey cushions, player's at x≈0.95
      box(11.5, 0.16, 0.55, 0x64748b, 0, 0.62, -2.0, 0.55);
      for (let i = 0; i < 6; i++) box(1.8, 0.05, 0.5, i % 2 ? 0x2563eb : 0x3b82f6, -4.7 + i * 1.88, 0.72, -2.0, 0.6);
      box(11.5, 0.6, 0.1, 0x94a3b8, 0, 1.12, -2.28, 0.55);
      // yellow grab poles + hanging straps
      for (const px of [-2.3, 2.3]) cyl(0.035, 0.035, 3.2, 0xf5b301, px, 1.6, -0.75, 0.35, { metalness: 0.5 });
      const railBus = cyl(0.03, 0.03, 9.6, 0xf5b301, 0, 3.0, -0.75, 0.35, { metalness: 0.5 });
      railBus.rotation.z = Math.PI / 2;
      for (let i = 0; i < 5; i++) {
        box(0.05, 0.4, 0.05, 0x9a958a, -2.9 + i * 1.45, 2.8, -0.75, 0.6);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.026, 6, 14), mat(0x2563eb, 0.5));
        ring.position.set(-2.9 + i * 1.45, 2.5, -0.75);
        scene.add(ring);
      }
      // driver up front (right end): seat, wheel, dashboard hint
      const driver = extraFigure(5.6, -0.28, -1.95, Math.PI, 0x1e40af, 0x1f2937, true);
      driver.armL.rotation.x = -0.9; driver.armR.rotation.x = -0.9;
      const wheelB = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 8, 18), mat(0x22262b, 0.5));
      wheelB.position.set(5.6, 1.05, -2.3);
      scene.add(wheelB);
      box(1.4, 0.5, 0.4, 0x334155, 5.6, 0.75, -2.42, 0.5);
      extraFigure(-3.4, -0.28, -1.95, Math.PI, 0xf97316, 0x3a3f4a, true);
      const standerB = extraFigure(-0.6, 0, -0.6, Math.PI, 0x22c55e, 0x374151);
      standerB.armR.rotation.x = -2.7;
    } else if (setKind === "taxi") {
      // taxi from the back seat: windshield ahead with the city streaming
      // past, two front seat backs, the driver's back, dash + meter.
      box(11, 1.5, 0.2, 0x3a4149, 0, 3.6, -2.55, 0.6);
      box(0.25, 4.4, 0.25, 0x3a4149, -3.4, 2.1, -2.5, 0.6);
      box(0.25, 4.4, 0.25, 0x3a4149, 3.4, 2.1, -2.5, 0.6);
      const vt = viewTex(); scrollTexs.push(vt);
      plane(6.4, 2.5, vt, 0, 2.2, -2.42);
      for (let sIdx = 0; sIdx < 3; sIdx++) {
        const bar = box(0.15, 1.1, 0.03, 0xd8ecff, 0, 2.2, -2.38, 0.3, { emissive: 0x9fc8e8, emissiveIntensity: 1 });
        bar.castShadow = false;
        streaks.push({ m: bar, c: 0, hw: 2.6, sp: 1.9 + sIdx * 0.6, off: sIdx * 1.9 });
      }
      // dashboard + glowing meter + nav screen
      box(6.6, 0.55, 0.5, 0x22262b, 0, 0.82, -2.25, 0.5);
      plane(1.15, 0.5, boardTex("#0b1220", [{ t: "计价器", s: 34, c: "#f5b942" }, { t: `${cur ?? "¥"} · 行驶中`, s: 30, c: "#a3e635" }]), -1.9, 1.28, -2.2);
      plane(1.3, 0.55, boardTex("#0c4a6e", [{ t: "导航 · 前方直行", s: 32, c: "#ffffff" }, { t: "目的地快到了", s: 26, c: "#bae6fd" }]), 1.6, 1.28, -2.2);
      box(0.9, 0.28, 0.06, 0x9fb2c2, 0, 3.28, -2.3, 0.35, { metalness: 0.5 });
      // front seat backs + driver (seen from behind: rotation 0)
      for (const fx of [-1.35, 1.35]) {
        box(1.05, 0.18, 0.7, 0x4b5563, fx, 0.6, -1.62, 0.75);
        box(1.05, 0.95, 0.18, 0x4b5563, fx, 1.15, -1.92, 0.75);
        box(0.55, 0.3, 0.14, 0x374151, fx, 1.85, -1.9, 0.7);
      }
      const driverT = extraFigure(-1.35, -0.3, -1.68, 0, 0x0ea5e9, 0x1f2937, true);
      driverT.armL.rotation.x = -0.85; driverT.armR.rotation.x = -0.85;
      const wheelT = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 8, 18), mat(0x22262b, 0.5));
      wheelT.position.set(-1.35, 1.12, -2.05);
      wheelT.rotation.x = 0.5;
      scene.add(wheelT);
      // back bench the player sits on
      box(3.4, 0.18, 0.8, 0x374151, 0.2, 0.6, -1.05, 0.8);
      box(3.4, 0.8, 0.16, 0x374151, 0.2, 1.15, -1.42, 0.8);
      addGlow(0, 3.3, -1, 1.6, 0xffd9a0, 0.35);
    } else if (setKind === "drive") {
      // your own car, from the driver's seat: windshield with the street
      // streaming past, dashboard + nav screen, the wheel in front of the
      // actor — and a REAL traffic light ahead that cycles red → green,
      // because driving in the city means stopping at lights like everyone.
      box(11, 1.5, 0.2, 0x2e3339, 0, 3.6, -2.55, 0.6);
      box(0.25, 4.4, 0.25, 0x2e3339, -3.4, 2.1, -2.5, 0.6);
      box(0.25, 4.4, 0.25, 0x2e3339, 3.4, 2.1, -2.5, 0.6);
      const vt = viewTex(); scrollTexs.push(vt);
      plane(6.4, 2.5, vt, 0, 2.2, -2.42);
      for (let sIdx = 0; sIdx < 3; sIdx++) {
        const bar = box(0.15, 1.1, 0.03, 0xd8ecff, 0, 2.2, -2.38, 0.3, { emissive: 0x9fc8e8, emissiveIntensity: 1 });
        bar.castShadow = false;
        streaks.push({ m: bar, c: 0, hw: 2.6, sp: 1.9 + sIdx * 0.6, off: sIdx * 1.9 });
      }
      // the traffic light ahead, upper right through the windshield
      cyl(0.05, 0.05, 3.1, 0x22262b, 2.75, 1.55, -2.3, 0.5, { metalness: 0.5 });
      box(0.42, 1.15, 0.18, 0x14181d, 2.75, 3.35, -2.3, 0.5);
      const lampMat = (em: number) => new THREE.MeshStandardMaterial({ color: 0x1c2126, roughness: 0.35, emissive: em, emissiveIntensity: 0.12 });
      const tlRed = lampMat(0xff2a1e);
      const tlYel = lampMat(0xffb020);
      const tlGrn = lampMat(0x2ee66b);
      const lampGeo = new THREE.SphereGeometry(0.13, 10, 8);
      const mkLamp = (m: THREE.MeshStandardMaterial, ly: number) => { const s = new THREE.Mesh(lampGeo, m); s.position.set(2.75, ly, -2.18); scene.add(s); };
      mkLamp(tlRed, 3.72); mkLamp(tlYel, 3.35); mkLamp(tlGrn, 2.98);
      tlights.push({ red: tlRed, yel: tlYel, grn: tlGrn, off: 0 });
      addGlow(2.75, 3.35, -2.0, 1.1, 0xffc873, 0.22);
      // dashboard + glowing nav screen + instrument cluster
      box(6.6, 0.55, 0.5, 0x1d2126, 0, 0.82, -2.25, 0.5);
      plane(1.35, 0.55, boardTex("#0c4a6e", [{ t: "导航 · 沿主路直行", s: 32, c: "#ffffff" }, { t: "前方路口 · 注意信号灯", s: 26, c: "#bae6fd" }]), 0.9, 1.3, -2.2);
      plane(0.95, 0.42, boardTex("#0b1220", [{ t: "车速", s: 30, c: "#a3e635" }, { t: "电量 82%", s: 28, c: "#f5b942" }]), -2.1, 1.26, -2.2);
      box(0.9, 0.28, 0.06, 0x9fb2c2, -0.3, 3.28, -2.3, 0.35, { metalness: 0.5 });
      // steering wheel right in front of the driver (actor sits at x=-0.95)
      const wheelD = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 8, 18), mat(0x22262b, 0.5));
      wheelD.position.set(-0.95, 1.14, -1.52);
      wheelD.rotation.x = 0.5;
      scene.add(wheelD);
      cyl(0.045, 0.045, 0.5, 0x22262b, -0.95, 0.95, -1.72, 0.5, { metalness: 0.5 }).rotation.x = 1.1;
      // the two front seats: driver's (actor) + a friend riding shotgun
      for (const fx of [-0.95, 0.95]) {
        box(1.05, 0.18, 0.7, 0x3f4750, fx, 0.6, -1.05, 0.75);
        box(1.05, 0.95, 0.18, 0x3f4750, fx, 1.15, -1.35, 0.75);
        box(0.55, 0.3, 0.14, 0x333a42, fx, 1.85, -1.33, 0.7);
      }
      const buddy = extraFigure(0.95, -0.3, -1.05, Math.PI, 0xec4899, 0x3a3f4a, true);
      buddy.armL.rotation.x = -0.4; buddy.armR.rotation.x = -0.75;
      addGlow(0, 3.3, -1, 1.6, 0xffd9a0, 0.35);
    } else if (setKind === "office") {
      roomShell(0xf3ead8, 0xb9c6cf, { windowX: -3.9, windowW: 3.1, clock: true });
      box(5, 0.03, 3.2, 0x7e97a8, 0.2, 0.015, -0.6, 1);
      // detail pass: a warm desk lamp (bloom picks up the shade), a plant,
      // a steaming mug — the lived-in layer over the desk set
      cyl(0.05, 0.07, 0.5, 0x374151, 1.95, 1.3, -1.25, 0.4, { metalness: 0.5 });
      const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.22, 14, 1, true), mat(0xf5b942, 0.5, { emissive: 0xffc873, emissiveIntensity: 1.6, side: THREE.DoubleSide }));
      lampShade.position.set(1.8, 1.62, -1.25);
      lampShade.rotation.z = 0.5;
      scene.add(lampShade);
      addGlow(1.78, 1.55, -1.2, 1.5, 0xffc98a, 0.55);
      cyl(0.16, 0.12, 0.22, 0xb45309, -3.1, 0.11, 0.9, 0.7);
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.55, 6), mat(0x3f7d46, 0.9, { flatShading: true }));
        leaf.position.set(-3.1 + Math.sin(i * 1.26) * 0.14, 0.45, 0.9 + Math.cos(i * 1.26) * 0.14);
        leaf.rotation.z = Math.sin(i * 1.26) * 0.4;
        scene.add(leaf);
      }
      addSteam(1.15, 1.25, -0.75);
      // main desk: top, monitor with scrolling code, keyboard, mug, lamp, papers
      box(3.6, 0.12, 1.4, 0x8a6f4d, 0.4, 1.0, -0.95, 0.6);
      box(0.14, 0.95, 1.3, 0x6b543a, -1.25, 0.5, -0.95, 0.7);
      box(0.14, 0.95, 1.3, 0x6b543a, 2.05, 0.5, -0.95, 0.7);
      box(1.62, 1.0, 0.07, 0x20303e, 0.4, 1.78, -1.28, 0.3);
      const code1 = codeTex(); codeTexs.push(code1);
      plane(1.5, 0.88, code1, 0.4, 1.78, -1.24);
      box(0.3, 0.35, 0.06, 0x2e3440, 0.4, 1.2, -1.28, 0.5);
      box(1.2, 0.045, 0.44, 0x2e3440, 0.4, 1.09, -0.6, 0.6);
      box(0.22, 0.05, 0.34, 0x3c4654, 1.35, 1.09, -0.62, 0.6);
      cyl(0.09, 0.075, 0.16, 0xd9534a, 1.62, 1.14, -0.95, 0.5);
      box(0.5, 0.02, 0.36, 0xffffff, -0.75, 1.07, -0.75, 0.9);
      const paper2 = box(0.5, 0.02, 0.36, 0xf3ead8, -0.68, 1.08, -0.7, 0.9);
      paper2.rotation.y = 0.4;
      box(0.07, 0.5, 0.07, 0x3c4654, -1.05, 1.3, -1.15, 0.5);
      const lampHead = box(0.34, 0.1, 0.2, 0xf5b942, -0.82, 1.62, -1.05, 0.5, { emissive: 0xffc873, emissiveIntensity: 1 });
      lampHead.rotation.z = 0.4; lampHead.castShadow = false;
      addGlow(-0.82, 1.55, -0.95, 1.1, 0xffd9a0, 0.45);
      // the chair the actor sits on
      box(0.95, 0.13, 0.9, 0x44586e, 0.4, 0.55, 0.38, 0.7);
      box(0.95, 1.05, 0.13, 0x44586e, 0.4, 1.15, 0.85, 0.7);
      cyl(0.05, 0.05, 0.5, 0x2e3440, 0.4, 0.27, 0.38, 0.4, { metalness: 0.5 });
      // cubicle partitions
      box(0.09, 1.55, 2.4, 0x9db4c6, -1.7, 0.78, -0.95, 0.9);
      box(0.09, 1.55, 2.4, 0x9db4c6, 2.5, 0.78, -0.95, 0.9);
      // colleague at the next desk, typing away
      box(2.6, 0.12, 1.25, 0x77603f, -4.1, 1.0, -0.95, 0.6);
      box(1.3, 0.82, 0.06, 0x20303e, -4.1, 1.7, -1.25, 0.3);
      const code2 = codeTex(); codeTexs.push(code2);
      plane(1.18, 0.72, code2, -4.1, 1.7, -1.21);
      box(0.95, 0.05, 0.4, 0x2e3440, -4.1, 1.09, -0.62, 0.6);
      box(0.9, 0.13, 0.85, 0x5a4a6e, -4.1, 0.55, 0.38, 0.7);
      const colleague = extraFigure(-4.1, -0.45, 0.35, Math.PI, 0xdbe7f5, 0x334155, true);
      tapers.push({ f: colleague, ph: 1.3 });
      // water cooler, plant, whiteboard, bookshelf
      box(0.55, 1.15, 0.55, 0xe8edf0, 3.9, 0.58, -3.0, 0.5);
      cyl(0.2, 0.24, 0.55, 0x7dd3fc, 3.9, 1.45, -3.0, 0.2, { transparent: true, opacity: 0.65 });
      cyl(0.3, 0.24, 0.4, 0xb0653a, -5.6, 0.2, -2.7, 0.8);
      for (const [px, py, pz, ps] of [[-5.6, 0.85, -2.7, 0.5], [-5.85, 1.05, -2.6, 0.38], [-5.35, 1.1, -2.85, 0.36]] as const) {
        const fol = new THREE.Mesh(new THREE.SphereGeometry(ps, 8, 7), mat(0x4d9b5f, 1, { flatShading: true }));
        fol.position.set(px, py, pz); fol.castShadow = true; scene.add(fol);
      }
      box(2.3, 1.35, 0.06, 0xffffff, 3.4, 2.45, -3.56, 0.35);
      plane(2.2, 1.25, boardTex("#f8fafc", [{ t: "今日需求 · 冲刺", s: 40, c: "#334155", bold: true }, { t: "联调 ✓  提测 ✓  上线 …", s: 32, c: "#64748b", bold: false }]), 3.4, 2.45, -3.52);
      box(0.28, 0.28, 0.03, 0xf5b942, 2.6, 2.1, -3.5, 0.8);
      box(0.28, 0.28, 0.03, 0xec4899, 4.25, 2.75, -3.5, 0.8);
      box(1.3, 2.2, 0.35, 0x77603f, 5.9, 1.1, -3.3, 0.7);
      for (let sIdx = 0; sIdx < 3; sIdx++) for (let bIdx = 0; bIdx < 4; bIdx++) {
        box(0.16, 0.42 + (bIdx % 2) * 0.08, 0.24, [0xd9534a, 0x3f6d8e, 0x65a30d, 0xf5b942][(sIdx + bIdx) % 4]!, 5.5 + bIdx * 0.26, 0.55 + sIdx * 0.62, -3.3, 0.8);
      }
    } else if (setKind === "restaurant") {
      roomShell(0xf7e8d0, 0x8a4a3a, { windowX: 4.1, windowW: 1.8 });
      box(1.15, 1.5, 0.07, 0xb3352c, -2.2, 2.5, -3.55, 0.7);
      box(1.15, 1.5, 0.07, 0xb3352c, 2.6, 2.5, -3.55, 0.7);
      // main round table, cloth, dishes with steam
      cyl(1.06, 1.06, 0.09, 0xf3ead8, 0.7, 0.98, -0.7, 0.55);
      cyl(0.98, 0.8, 0.5, 0xe8dcc2, 0.7, 0.7, -0.7, 0.7);
      cyl(0.13, 0.2, 0.5, 0x6b543a, 0.7, 0.25, -0.7, 0.7);
      cyl(0.3, 0.24, 0.05, 0xffffff, 0.45, 1.05, -0.55, 0.4);
      box(0.34, 0.09, 0.16, 0xe0653a, 0.45, 1.11, -0.55, 0.7);
      addSteam(0.45, 1.16, -0.55);
      cyl(0.17, 0.12, 0.1, 0xffffff, 1.05, 1.07, -0.85, 0.4);
      cyl(0.26, 0.2, 0.04, 0xdbe7f5, 0.85, 1.04, -0.35, 0.4);
      box(0.3, 0.07, 0.3, 0x65a30d, 0.85, 1.09, -0.35, 0.8);
      addSteam(0.85, 1.14, -0.35);
      cyl(0.11, 0.09, 0.14, 0x8a6f4d, 0.15, 1.09, -0.95, 0.5);
      box(0.03, 0.02, 0.3, 0x8a5a3b, 0.62, 1.05, -0.42, 0.6);
      // actor's chair + a second chair
      box(0.62, 0.09, 0.55, 0x8a5a3b, 0.55, 0.5, 0.5, 0.8);
      box(0.62, 0.7, 0.08, 0x8a5a3b, 0.55, 0.95, 0.82, 0.8);
      box(0.62, 0.09, 0.55, 0x8a5a3b, -0.55, 0.5, -0.75, 0.8);
      box(0.62, 0.7, 0.08, 0x74522f, -0.55, 0.95, -1.05, 0.8);
      // neighbouring table with two diners mid-conversation
      cyl(0.8, 0.8, 0.08, 0xf3ead8, -3.1, 0.95, -1.3, 0.55);
      cyl(0.1, 0.16, 0.9, 0x6b543a, -3.1, 0.45, -1.3, 0.7);
      cyl(0.22, 0.18, 0.04, 0xffffff, -3.25, 1.02, -1.2, 0.4);
      cyl(0.22, 0.18, 0.04, 0xffffff, -2.9, 1.02, -1.45, 0.4);
      extraFigure(-3.15, -0.42, -0.35, Math.PI, 0x3b82f6, 0x2b2b33, true);
      const diner2 = extraFigure(-3.05, -0.42, -2.3, 0, 0xf59e0b, 0x4a3226, true);
      diner2.armR.rotation.x = -0.7;
      // counter + menu board
      box(2.6, 1.05, 0.8, 0x74522f, 4.3, 0.53, -3.0, 0.7);
      box(2.7, 1.25, 0.07, 0x3a2418, 4.3, 2.6, -3.56, 0.6);
      plane(2.55, 1.12, boardTex("#3a2418", [{ t: "今 日 推 荐", s: 40, c: "#f5b942", bold: true }, { t: "隆江猪脚饭 · 烧腊双拼", s: 33, c: "#f3ead8", bold: false }, { t: "艇仔粥 · 例汤 · 青菜", s: 33, c: "#f3ead8", bold: false }]), 4.3, 2.6, -3.51);
      // swaying red lanterns
      for (const lx of [-1.6, 0.7, 3.0]) {
        const lg = new THREE.Group();
        lg.position.set(lx, 4.3, -0.7);
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.85, 6), mat(0x3a2418, 0.6));
        cord.position.y = -0.42; lg.add(cord);
        const shadeL = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 9), mat(0xd93a2c, 0.6, { emissive: 0xff7a4d, emissiveIntensity: night ? 1.2 : 0.65 }));
        shadeL.scale.y = 0.78; shadeL.position.y = -1.0; lg.add(shadeL);
        scene.add(lg);
        swayers.push({ g: lg, ph: lx });
        addGlow(lx, 3.28, -0.7, 1.5, 0xff9a5c, 0.5);
      }
      cyl(0.26, 0.2, 0.36, 0xb0653a, -5.3, 0.18, -2.9, 0.8);
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.48, 8, 7), mat(0x4d9b5f, 1, { flatShading: true }));
      bush.position.set(-5.3, 0.75, -2.9); bush.castShadow = true; scene.add(bush);
    } else if (setKind === "kitchen") {
      roomShell(0xf6efdd, 0x9db4a0, { clock: true });
      box(6.4, 0.62, 0.05, 0xb9cdd2, -0.5, 1.42, -3.56, 0.3);
      // detail pass: under-cabinet light strip (glows via bloom), a rail
      // of hanging utensils and a pan over the counter
      const cabLight = box(5.2, 0.05, 0.08, 0xfff2d8, -0.5, 2.18, -2.02, 0.4, { emissive: 0xffdf9e, emissiveIntensity: 1.7 });
      cabLight.castShadow = false;
      addGlow(-0.5, 2.05, -1.9, 2.6, 0xffd9a0, 0.3);
      box(2.6, 0.05, 0.05, 0x8a8f96, -1.6, 1.92, -3.5, 0.35, { metalness: 0.7 });
      for (let i = 0; i < 4; i++) {
        box(0.05, 0.34 + (i % 2) * 0.12, 0.03, 0x5a5348, -2.6 + i * 0.65, 1.72, -3.48, 0.5);
        box(0.16, 0.05, 0.12, 0xb9c4ce, -2.6 + i * 0.65, 1.5, -3.48, 0.35, { metalness: 0.6 });
      }
      const pan = cyl(0.3, 0.26, 0.07, 0x2b2118, 1.35, 1.06, -2.0, 0.35, { metalness: 0.5 });
      pan.rotation.z = 0.02;
      // counter run + cabinets
      box(5.8, 0.95, 1.05, 0x82977f, -0.5, 0.48, -2.0, 0.6);
      for (let i = 0; i < 4; i++) box(0.04, 0.7, 0.03, 0x5f7263, -2.6 + i * 1.42, 0.48, -1.46, 0.6);
      box(6.0, 0.07, 1.2, 0xe8e2d4, -0.5, 1.0, -2.0, 0.35);
      box(5.4, 1.05, 0.5, 0x93a98d, -0.5, 2.75, -2.3, 0.6);
      const underLight = box(5.4, 0.04, 0.06, 0xfff2d8, -0.5, 2.2, -2.08, 0.4, { emissive: 0xffe9b8, emissiveIntensity: 1 });
      underLight.castShadow = false;
      // stove + wok + flickering flame
      box(1.15, 0.03, 0.85, 0x22262c, -1.55, 1.05, -2.0, 0.25, { metalness: 0.4 });
      cyl(0.19, 0.19, 0.02, 0x3c4148, -1.55, 1.07, -2.0, 0.4);
      cyl(0.13, 0.13, 0.02, 0x3c4148, -0.75, 1.07, -2.25, 0.4);
      const flame = cyl(0.15, 0.05, 0.09, 0x5aa7ff, -1.55, 1.1, -2.0, 0.4, { emissive: 0x3f8cff, emissiveIntensity: 2 });
      flame.castShadow = false;
      cyl(0.37, 0.2, 0.17, 0x2e3238, -1.55, 1.2, -2.0, 0.3, { metalness: 0.6 });
      addSteam(-1.55, 1.42, -2.0);
      flameLight = new THREE.PointLight(0xff9a3c, 5, 4.5, 1.8);
      flameLight.position.set(-1.55, 1.5, -1.6);
      scene.add(flameLight);
      // cutting board with vegetables + knife
      box(0.85, 0.045, 0.52, 0xc9a06a, 0.35, 1.06, -2.0, 0.7);
      box(0.2, 0.13, 0.16, 0x65a30d, 0.2, 1.15, -2.05, 0.8);
      box(0.18, 0.12, 0.15, 0x84cc16, 0.45, 1.14, -1.9, 0.8);
      cyl(0.035, 0.035, 0.3, 0xe0653a, 0.62, 1.1, -2.1, 0.7).rotation.z = 1.2;
      box(0.3, 0.02, 0.07, 0xc8ccd2, 0.05, 1.09, -1.82, 0.3, { metalness: 0.7 });
      // sink + faucet + dish rack
      box(0.95, 0.1, 0.6, 0x9aa3ad, 1.7, 1.02, -2.0, 0.3, { metalness: 0.5 });
      cyl(0.035, 0.035, 0.42, 0xc8ccd2, 1.7, 1.28, -2.28, 0.25, { metalness: 0.8 });
      const spout = cyl(0.03, 0.03, 0.4, 0xc8ccd2, 1.7, 1.48, -2.12, 0.25, { metalness: 0.8 });
      spout.rotation.x = Math.PI / 2;
      const plateRack = cyl(0.2, 0.2, 0.03, 0xffffff, 2.45, 1.12, -2.1, 0.4);
      plateRack.rotation.z = 0.5;
      // spice jars + rice cooker + utensil rail
      for (let i = 0; i < 4; i++) cyl(0.055, 0.055, 0.16, [0xd9534a, 0xf5b942, 0x65a30d, 0x8a5a3b][i]!, -0.15 + i * 0.19, 1.12, -2.38, 0.4);
      cyl(0.24, 0.26, 0.3, 0xf3ead8, -2.85, 1.19, -2.05, 0.5);
      box(1.3, 0.04, 0.04, 0x8a8f96, 0.95, 1.98, -1.72, 0.4, { metalness: 0.6 });
      for (let i = 0; i < 3; i++) box(0.05, 0.3, 0.02, 0x5a4632, 0.55 + i * 0.35, 1.8, -1.72, 0.5);
      // fridge with magnets + note
      box(1.05, 2.0, 0.85, 0xd7dde3, 3.35, 1.0, -2.2, 0.35, { metalness: 0.35 });
      box(0.05, 0.7, 0.05, 0x9aa3ad, 2.9, 1.35, -1.74, 0.4, { metalness: 0.6 });
      box(0.3, 0.38, 0.02, 0xfff6da, 3.5, 1.5, -1.76, 0.9);
      for (const [mx, my, mc] of [[3.15, 1.72, 0xd9534a], [3.78, 1.28, 0x3f6d8e], [3.3, 1.18, 0xf5b942]] as const) box(0.07, 0.07, 0.03, mc, mx, my, -1.76, 0.5);
      // dining corner: table, chairs, a served dish
      box(1.8, 0.07, 1.05, 0xb08954, 2.7, 0.94, 0.7, 0.6);
      box(0.09, 0.9, 0.09, 0x8a6f4d, 1.95, 0.45, 0.3, 0.7); box(0.09, 0.9, 0.09, 0x8a6f4d, 3.45, 0.45, 0.3, 0.7);
      box(0.09, 0.9, 0.09, 0x8a6f4d, 1.95, 0.45, 1.1, 0.7); box(0.09, 0.9, 0.09, 0x8a6f4d, 3.45, 0.45, 1.1, 0.7);
      box(0.6, 0.09, 0.5, 0x8a5a3b, 2.7, 0.5, 1.55, 0.8);
      box(0.6, 0.65, 0.07, 0x74522f, 2.7, 0.92, 1.82, 0.8);
      cyl(0.26, 0.2, 0.05, 0xffffff, 2.55, 1.0, 0.62, 0.4);
      box(0.28, 0.08, 0.14, 0x65a30d, 2.55, 1.06, 0.62, 0.8);
      addSteam(2.55, 1.12, 0.62);
      box(3.6, 0.025, 0.85, 0xb3552e, -0.5, 0.015, -1.15, 1);
    } else if (setKind === "flat") {
      // home by housing rung: 0 城中村握手楼 · 1 合租单间 · 2 小区一房 · 3 南山大平层
      const tr = Math.max(0, Math.min(3, tier ?? 1));
      if (tr === 0) {
        roomShell(0xcfc8b6, 0x86806f);
        // the "window": an arm's length from the next building's wall
        box(1.3, 1.2, 0.1, 0xdedede, 2.8, 2.6, -3.56, 0.6);
        box(1.1, 1.0, 0.05, 0x8d877b, 2.8, 2.6, -3.5, 0.95);
        box(0.06, 1.0, 0.06, 0x6b6b6b, 2.8, 2.6, -3.46, 0.5, { metalness: 0.5 }); // burglar bars
        // exposed pipes and a wire along the wall
        for (const px of [-6.6, -6.35]) { const pipe = cyl(0.07, 0.07, 8, 0x8a8f94, px, 4, -3.4, 0.35, { metalness: 0.6 }); pipe.castShadow = false; }
        box(9, 0.04, 0.04, 0x222222, -2.2, 3.4, -3.5, 0.6);
        // metal bunk bed with two thin mattresses
        for (const bx of [-4.6, -2.4]) for (const bz of [-3.2, -1.7]) cyl(0.05, 0.05, 2.6, 0x7a8590, bx, 1.3, bz, 0.4, { metalness: 0.6 });
        for (const by of [0.55, 1.95]) { box(2.3, 0.08, 1.6, 0x7a8590, -3.5, by, -2.45, 0.4, { metalness: 0.5 }); box(2.1, 0.14, 1.45, 0xdad3c4, -3.5, by + 0.11, -2.45, 0.95); }
        box(0.7, 0.12, 0.4, 0x8a6f9e, -4.1, 0.75, -2.9, 0.95); // pillow
        // a single bare bulb on a cord
        cyl(0.01, 0.01, 1.6, 0x222222, 0.6, 4.6, -1.2, 0.6);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mat(0xfff1c4, 0.3, { emissive: 0xffd27a, emissiveIntensity: 2.4 }));
        bulb.position.set(0.6, 3.75, -1.2); scene.add(bulb);
        addGlow(0.6, 3.75, -1.2, 2.6, 0xffd27a, 0.7);
        // clothes rack, plastic stool, instant noodles, e-bike battery charging
        box(0.04, 1.8, 0.04, 0x9aa3ab, 1.6, 0.9, -2.6, 0.5); box(0.04, 1.8, 0.04, 0x9aa3ab, 3.4, 0.9, -2.6, 0.5); box(1.85, 0.04, 0.04, 0x9aa3ab, 2.5, 1.8, -2.6, 0.5);
        for (const [cx, col] of [[1.9, 0x3b82f6], [2.4, 0xf59e0b], [2.9, 0x10b981]] as const) box(0.38, 0.75, 0.05, col, cx, 1.35, -2.6, 0.95);
        cyl(0.24, 0.2, 0.42, 0xd94a3a, 0.2, 0.21, 0.4, 0.6);
        cyl(0.13, 0.11, 0.16, 0xf2c14e, 0.2, 0.5, 0.4, 0.7);
        box(0.42, 0.28, 0.2, 0x1f2937, 4.6, 0.14, -3.2, 0.6);
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(0xff3030, 0.3, { emissive: 0xff2020, emissiveIntensity: 3 }));
        led.position.set(4.6, 0.3, -3.08); scene.add(led);
      } else if (tr === 1) {
        roomShell(0xf1e6d2, 0xb89a72, { windowX: 3.6, windowW: 1.5 });
        // single bed, a desk with a glowing laptop, a suitcase, a door to the shared hall
        box(2.3, 0.4, 1.3, 0x9c7a52, -3.6, 0.2, -2.9, 0.8); box(2.2, 0.2, 1.2, 0xf6efe0, -3.6, 0.5, -2.9, 0.95); box(2.2, 0.12, 0.75, 0x7ea6c9, -3.6, 0.62, -2.6, 0.95);
        box(1.6, 0.06, 0.7, 0xb08a5c, 0.6, 0.95, -3.2, 0.7); for (const lx of [-0.1, 1.3]) box(0.06, 0.92, 0.06, 0x8a6a44, lx, 0.46, -3.2, 0.7);
        box(0.6, 0.03, 0.42, 0x2b2b2b, 0.6, 1.0, -3.2, 0.4);
        const scr = box(0.6, 0.4, 0.03, 0x111827, 0.6, 1.21, -3.4, 0.3, { emissive: 0x4f8cff, emissiveIntensity: night ? 1.6 : 0.6 }); scr.castShadow = false;
        addGlow(0.6, 1.2, -3.2, 1.5, 0x8fb8ff, night ? 0.6 : 0.25);
        box(0.6, 0.85, 0.32, 0x2563eb, 5.2, 0.43, -2.9, 0.5);
        box(1.1, 2.4, 0.08, 0x8a6a44, -6.4, 1.2, -1.2, 0.8);
      } else if (tr === 2) {
        roomShell(0xf5ead6, 0xc9a877, { windowX: 2.6, windowW: 2.6 });
        // living room: sofa, TV glow, coffee table, rug, plants, picture
        box(3.0, 0.5, 1.0, 0x6b8f71, -2.6, 0.45, -2.6, 0.9); box(3.0, 0.7, 0.25, 0x5f8065, -2.6, 0.95, -3.05, 0.9);
        for (const ax of [-4.05, -1.15]) box(0.25, 0.6, 1.0, 0x5f8065, ax, 0.6, -2.6, 0.9);
        const tv = box(2.0, 1.1, 0.06, 0x0b0f19, 2.4, 1.6, 2.6, 0.3, { emissive: 0x3060c0, emissiveIntensity: night ? 1.2 : 0.4 }); tv.rotation.y = Math.PI; tv.castShadow = false;
        box(1.4, 0.06, 0.7, 0xb08a5c, -2.6, 0.45, -1.2, 0.6);
        const rug2 = cyl(1.6, 1.6, 0.02, 0xd9a05b, -2.4, 0.012, -1.4, 1, {}, 24); rug2.castShadow = false;
        cyl(0.24, 0.19, 0.32, 0xb0653a, 5.4, 0.16, -3.0, 0.8);
        const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 7), mat(0x4d9b5f, 1, { flatShading: true })); leaves.position.set(5.4, 0.75, -3.0); scene.add(leaves);
        addPicture(-2.6, 2.6, 1.4, 0.9, night ? 0x33507c : 0x9fc8e8);
      } else {
        roomShell(0xefe9df, 0xd8cfc0);
        // floor-to-ceiling glass onto the Nanshan skyline
        plane(13.5, 5.6, skylineTex(night), -0.4, 3.0, -3.48);
        for (let mx = -6.8; mx <= 6.0; mx += 2.7) box(0.07, 5.8, 0.08, 0x2b2b2b, mx, 3.0, -3.42, 0.4, { metalness: 0.7 });
        box(13.6, 0.08, 0.1, 0x2b2b2b, -0.4, 0.22, -3.42, 0.4, { metalness: 0.7 });
        addGlow(-0.4, 3.2, -3.0, 8, night ? 0xffc98a : 0xfff2c8, night ? 0.35 : 0.25);
        // L-shaped sofa, marble island, pendant lights, long rug, a big plant
        box(4.2, 0.45, 1.1, 0xe7e2d8, -3.0, 0.4, -1.6, 0.9); box(1.1, 0.45, 2.4, 0xe7e2d8, -5.55, 0.4, -0.95, 0.9);
        box(4.2, 0.6, 0.25, 0xddd6c9, -3.0, 0.85, -2.1, 0.9);
        box(2.8, 0.95, 1.0, 0xf2f0ec, 3.4, 0.48, -0.6, 0.25, { metalness: 0.1 }); box(2.9, 0.06, 1.1, 0x1f2937, 3.4, 0.98, -0.6, 0.3);
        for (const lx of [2.6, 3.4, 4.2]) { cyl(0.01, 0.01, 2.0, 0x222222, lx, 4.2, -0.6, 0.6); const shade = cyl(0.16, 0.22, 0.24, 0xc8a46a, lx, 3.1, -0.6, 0.4, { metalness: 0.6, emissive: 0xffc873, emissiveIntensity: night ? 1.6 : 0.4 }); shade.castShadow = false; addGlow(lx, 3.0, -0.6, 1.4, 0xffc98a, night ? 0.6 : 0.25); }
        const rug3 = box(5.5, 0.02, 2.6, 0x9ca3af, -3.0, 0.012, -0.4, 1); rug3.castShadow = false;
        cyl(0.32, 0.26, 0.55, 0x2b2b2b, 6.2, 0.28, -2.8, 0.6);
        const tree = new THREE.Mesh(new THREE.SphereGeometry(0.8, 9, 8), mat(0x3f8a54, 1, { flatShading: true })); tree.position.set(6.2, 1.5, -2.8); scene.add(tree);
      }

      // the player's own furniture, wherever they put it (see below)
      for (const it of furn ?? []) {
        const sl = FURN_SLOTS[it.slot]; if (!sl) continue;
        const g = new THREE.Group(); g.position.set(sl.x, 0, sl.z); g.rotation.y = sl.ry; scene.add(g);
        const gb = (w: number, h: number, d: number, c: number, x: number, y: number, z: number, rough = 0.8, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, rough, extra)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
        const gc = (r: number, h: number, c: number, x: number, y: number, z: number) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 18), mat(c, 0.6)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
        const c = it.color; const dark = new THREE.Color(c).multiplyScalar(0.8).getHex();
        const kind = it.id.split("-")[0];
        if (kind === "sofa") {
          const tat = it.id === "sofa-tatami";
          gb(2.4, tat ? 0.25 : 0.45, 1.0, c, 0, tat ? 0.13 : 0.35, 0); gb(2.4, tat ? 0.5 : 0.7, 0.25, dark, 0, tat ? 0.4 : 0.85, -0.42);
          if (!tat) { gb(0.22, 0.55, 1.0, dark, -1.2, 0.55, 0); gb(0.22, 0.55, 1.0, dark, 1.2, 0.55, 0); }
          gb(0.5, 0.35, 0.15, 0xf5b942, -0.6, tat ? 0.4 : 0.75, -0.25, 0.95); gb(0.5, 0.35, 0.15, 0x7ea6c9, 0.6, tat ? 0.4 : 0.75, -0.25, 0.95);
          if (it.id === "sofa-leather") { gb(1.0, 0.45, 1.6, c, 1.7, 0.35, 0.3); }
        } else if (kind === "table") {
          if (it.id === "table-oak") { gc(0.6, 0.06, c, 0, 0.45, 0); gc(0.06, 0.42, dark, 0, 0.22, 0); }
          else { gb(1.3, 0.08, 0.8, c, 0, 0.42, 0, 0.2, { metalness: 0.1 }); for (const [lx, lz] of [[-0.55, -0.32], [0.55, -0.32], [-0.55, 0.32], [0.55, 0.32]]) gb(0.06, 0.4, 0.06, 0x2b2b2b, lx!, 0.2, lz!, 0.4); }
          gb(0.2, 0.08, 0.14, 0xffffff, 0.15, 0.5, 0.05, 0.4);
        } else if (it.id === "tv-cabinet") {
          gb(2.2, 0.45, 0.45, c, 0, 0.23, 0); const tv = gb(1.7, 0.95, 0.06, 0x0b0f19, 0, 1.0, -0.12, 0.3, { emissive: 0x3060c0, emissiveIntensity: night ? 1.2 : 0.4 }); tv.castShadow = false;
        } else if (it.id === "bed-double") {
          gb(2.0, 0.35, 2.3, c, 0, 0.2, 0); gb(1.9, 0.22, 2.2, 0xf6efe0, 0, 0.47, 0.02, 0.95); gb(2.0, 0.9, 0.12, dark, 0, 0.6, -1.12);
          gb(0.7, 0.14, 0.4, 0xffffff, -0.45, 0.65, -0.8, 0.95); gb(0.7, 0.14, 0.4, 0xffffff, 0.45, 0.65, -0.8, 0.95); gb(1.9, 0.08, 1.2, 0x7ea6c9, 0, 0.6, 0.45, 0.95);
        } else if (it.id === "wardrobe") {
          gb(1.8, 2.3, 0.65, c, 0, 1.15, 0); for (const dx of [-0.3, 0.3]) gb(0.03, 2.1, 0.02, dark, dx, 1.15, 0.33); for (const dx of [-0.42, 0.18, 0.42]) gb(0.04, 0.25, 0.04, 0xd4af37, dx, 1.2, 0.36, 0.3, { metalness: 0.7 });
        } else if (it.id === "desk") {
          gb(1.5, 0.06, 0.7, c, 0, 0.92, 0); for (const lx of [-0.7, 0.7]) gb(0.05, 0.9, 0.6, dark, lx, 0.45, 0);
          const scr = gb(0.8, 0.45, 0.04, 0x111827, 0, 1.3, -0.2, 0.3, { emissive: 0x4f8cff, emissiveIntensity: night ? 1.5 : 0.5 }); scr.castShadow = false; gb(0.05, 0.25, 0.05, 0x2b2b2b, 0, 1.05, -0.2);
          gb(0.55, 0.06, 0.55, 0x2b2b2b, 0, 0.55, 0.6); gb(0.55, 0.6, 0.06, 0x2b2b2b, 0, 0.9, 0.85);
        } else if (it.id === "fridge") {
          gb(0.85, 1.9, 0.75, c, 0, 0.95, 0, 0.3, { metalness: 0.4 }); gb(0.02, 1.8, 0.02, 0x9ca3af, 0, 0.95, 0.38); gb(0.04, 0.5, 0.04, 0x6b7280, -0.12, 1.3, 0.4); gb(0.04, 0.5, 0.04, 0x6b7280, 0.12, 1.3, 0.4);
        } else if (it.id === "kitchen-cabinet") {
          gb(2.6, 0.9, 0.7, c, 0, 0.45, 0); gb(2.7, 0.06, 0.75, 0xf1f5f9, 0, 0.93, 0, 0.3); gc(0.15, 0.03, 0x1f2937, -0.6, 0.97, 0); gc(0.15, 0.03, 0x1f2937, -0.2, 0.97, 0);
          gb(0.6, 0.06, 0.45, 0x9ca3af, 0.7, 0.96, 0, 0.2, { metalness: 0.7 }); gb(2.6, 0.7, 0.4, dark, 0, 2.2, -0.15);
        } else if (it.id === "dining-table") {
          gb(1.5, 0.07, 0.9, c, 0, 0.78, 0); for (const [lx, lz] of [[-0.65, -0.35], [0.65, -0.35], [-0.65, 0.35], [0.65, 0.35]]) gb(0.06, 0.76, 0.06, dark, lx!, 0.38, lz!);
          for (const cz of [-0.75, 0.75]) for (const cx of [-0.4, 0.4]) { gb(0.4, 0.05, 0.4, dark, cx, 0.46, cz); gb(0.4, 0.45, 0.05, dark, cx, 0.7, cz + (cz > 0 ? 0.18 : -0.18)); }
          gc(0.14, 0.04, 0xffffff, -0.3, 0.84, 0); gc(0.14, 0.04, 0xffffff, 0.3, 0.84, 0);
        } else if (it.id === "washer") {
          gb(0.75, 0.85, 0.7, c, 0, 0.43, 0, 0.4); const door = gc(0.24, 0.05, 0x334155, 0, 0.45, 0.36); door.rotation.x = Math.PI / 2;
        } else if (it.id === "bathtub") {
          gb(1.8, 0.6, 0.85, c, 0, 0.3, 0, 0.2); gb(1.6, 0.05, 0.65, 0x7dd3fc, 0, 0.55, 0, 0.1, { transparent: true, opacity: 0.8 });
        } else { gb(0.8, 0.8, 0.8, c, 0, 0.4, 0); }
      }
    } else if (setKind === "bedroom") {
      roomShell(0xf3e6cf, 0xc9a877, { windowX: 3.9, windowW: 1.9 });
      // detail pass: glowing bedside lamp, a woven rug, slippers by the bed
      cyl(0.05, 0.06, 0.3, 0x6b4a2f, 0.62, 0.85, -3.0, 0.5);
      const bedShade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.2, 14, 1, true), mat(0xf7d9a0, 0.55, { emissive: 0xffc873, emissiveIntensity: night ? 2.2 : 1.2, side: THREE.DoubleSide }));
      bedShade.position.set(0.62, 1.08, -3.0);
      scene.add(bedShade);
      addGlow(0.62, 1.0, -2.9, 1.9, 0xffc98a, night ? 0.8 : 0.45);
      for (const sx of [0.15, 0.5]) box(0.16, 0.07, 0.36, 0x7ea6c9, sx, 0.05, -0.55, 0.8);
      // bed: frame, headboard, mattress, blanket, two pillows
      box(2.5, 0.34, 2.7, 0xa9835a, -1.1, 0.17, -1.95, 0.8);
      box(2.5, 1.15, 0.13, 0x96703f, -1.1, 0.85, -3.28, 0.8);
      box(2.38, 0.22, 2.58, 0xf6efe0, -1.1, 0.45, -1.95, 0.95);
      box(2.4, 0.15, 1.6, night ? 0x46639b : 0x7ea6c9, -1.1, 0.56, -1.35, 0.95);
      box(0.92
, 0.16, 0.55, 0xffffff, -1.62, 0.62, -2.95, 0.95);
      box(0.92, 0.16, 0.55, 0xffffff, -0.58, 0.62, -2.95, 0.95);
      // nightstand: lamp with warm glow, alarm clock, a book
      box(0.85, 0.55, 0.5, 0x96703f, 0.62, 0.28, -3.0, 0.8);
      cyl(0.05, 0.07, 0.3, 0x6b543a, 0.55, 0.7, -3.05, 0.6);
      const shadeB = cyl(0.2, 0.26, 0.26, 0xf5b942, 0.55, 0.95, -3.05, 0.5, { emissive: 0xffc873, emissiveIntensity: night ? 1.8 : 0.6 });
      shadeB.castShadow = false;
      addGlow(0.55, 0.95, -2.9, 1.6, 0xffc98a, night ? 0.8 : 0.4);
      box(0.3, 0.3, 0.08, 0x2b2118, 0.88, 0.7, -3.1, 0.5);
      plane(0.26, 0.26, clockTex(), 0.88, 0.7, -3.05);
      box(0.34, 0.05, 0.24, 0xd9534a, 0.35, 0.58, -2.85, 0.8);
      // wardrobe, bookshelf with books, rug, slippers, picture, plant
      box(1.75, 2.5, 0.62, 0xa9835a, 1.95, 1.25, -3.15, 0.8);
      box(0.04, 2.2, 0.03, 0x7a5a34, 1.95, 1.25, -2.83, 0.7);
      box(0.05, 0.22, 0.05, 0xf5b942, 1.82, 1.25, -2.82, 0.4, { metalness: 0.6 });
      box(0.05, 0.22, 0.05, 0xf5b942, 2.08, 1.25, -2.82, 0.4, { metalness: 0.6 });
      box(1.35, 2.1, 0.34, 0x96703f, -4.15, 1.05, -3.35, 0.8);
      for (let sIdx = 0; sIdx < 3; sIdx++) for (let bIdx = 0; bIdx < 5; bIdx++) {
        if ((sIdx * 5 + bIdx) % 4 === 3) continue;
        box(0.15, 0.4, 0.22, [0xd9534a, 0x3f6d8e, 0x65a30d, 0xf5b942, 0x8b5cf6][(sIdx + bIdx) % 5]!, -4.65 + bIdx * 0.24, 0.5 + sIdx * 0.6, -3.35, 0.85);
      }
      const rug = cyl(1.2, 1.2, 0.025, 0xd9a05b, 0.5, 0.013, 0.1, 1, {}, 22);
      rug.castShadow = false;
      box(0.3, 0.07, 0.13, 0xe0658a, 0.42, 0.035, -0.75, 0.9);
      box(0.3, 0.07, 0.13, 0xe0658a, 0.78, 0.035, -0.72, 0.9);
      addPicture(-1.1, 2.75, 1.3, 0.85, night ? 0x33507c : 0x9fc8e8);
      cyl(0.24, 0.19, 0.32, 0xb0653a, 5.6, 0.16, -2.9, 0.8);
      const fol2 = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 7), mat(0x4d9b5f, 1, { flatShading: true }));
      fol2.position.set(5.6, 0.68, -2.9); fol2.castShadow = true; scene.add(fol2);
    } else if (setKind === "bathroom") {
      // tiled room: glossy aqua wainscot, warm white above, frosted window
      box(22, 8, 0.3, 0xf2ede2, 0, 4, -3.75, 1);
      box(22, 1.55, 0.34, 0xa8c8ce, 0, 0.78, -3.73, 0.25, { metalness: 0.15 });
      box(22, 0.07, 0.36, 0x7d9aa0, 0, 1.58, -3.72, 0.4);
      box(0.3, 8, 12, 0xf2ede2, -7.2, 4, 0, 1);
      box(0.34, 1.55, 12, 0xa8c8ce, -7.18, 0.78, 0, 0.25, { metalness: 0.15 });
      box(1.06, 1.06, 0.1, 0xffffff, -3.4, 2.9, -3.56, 0.5);
      const frost = box(0.9, 0.9, 0.06, 0xd8ecf2, -3.4, 2.9, -3.55, 0.2, { emissive: 0xcfe8f2, emissiveIntensity: night ? 0.25 : 0.7 });
      frost.castShadow = false;
      // vanity: cabinet, counter, basin, faucet, mirror with light bar
      box(1.85, 0.8, 0.62, 0xcbb59a, 0.2, 0.4, -2.95, 0.6);
      box(0.04, 0.6, 0.03, 0x9a8563, 0.2, 0.4, -2.63, 0.6);
      box(1.95, 0.06, 0.7, 0xf6f2e8, 0.2, 0.84, -2.95, 0.3);
      cyl(0.31, 0.24, 0.13, 0xffffff, 0.2, 0.92, -2.95, 0.25);
      cyl(0.2, 0.2, 0.03, 0x5a6a72, 0.2, 0.97, -2.95, 0.3, { metalness: 0.4 });
      cyl(0.035, 0.035, 0.34, 0xc8ccd2, 0.2, 1.1, -3.22, 0.2, { metalness: 0.8 });
      const spoutB = cyl(0.028, 0.028, 0.34, 0xc8ccd2, 0.2, 1.26, -3.08, 0.2, { metalness: 0.8 });
      spoutB.rotation.x = Math.PI / 2;
      box(1.56, 1.2, 0.07, 0x6b543a, 0.2, 2.05, -3.52, 0.5);
      const mirror = box(1.42, 1.06, 0.05, 0xdfeef5, 0.2, 2.05, -3.5, 0.12, { metalness: 0.85 });
      mirror.castShadow = false;
      const lightBar = box(1.5, 0.08, 0.08, 0xfff2d8, 0.2, 2.78, -3.46, 0.4, { emissive: 0xffeec4, emissiveIntensity: 1.5 });
      lightBar.castShadow = false;
      addGlow(0.2, 2.78, -3.3, 1.9, 0xfff2d8, 0.55);
      // water stream from the faucet (shown while washing)
      const stream = cyl(0.016, 0.022, 0.3, 0x9fd4ea, 0.2, 1.08, -2.98, 0.15, { transparent: true, opacity: 0.75 });
      stream.castShadow = false;
      washStream = stream;
      // countertop life: toothbrush cup + brushes, dispenser, folded towel
      cyl(0.07, 0.06, 0.15, 0x3f6d8e, 0.78, 0.95, -3.08, 0.5);
      const brush1 = cyl(0.012, 0.012, 0.24, 0xd9534a, 0.75, 1.1, -3.08, 0.5);
      brush1.rotation.z = 0.25;
      const brush2 = cyl(0.012, 0.012, 0.24, 0x65a30d, 0.82, 1.1, -3.05, 0.5);
      brush2.rotation.z = -0.2;
      cyl(0.05, 0.05, 0.18, 0xec4899, -0.42, 0.96, -3.1, 0.5);
      box(0.34, 0.09, 0.24, 0xf6d8e0, -0.45, 0.92, -2.85, 0.95);
      // towel rail + towel on the back wall
      const rail = cyl(0.025, 0.025, 0.85, 0xc8ccd2, -1.6, 1.95, -3.5, 0.3, { metalness: 0.7 });
      rail.rotation.z = Math.PI / 2;
      const towel = box(0.6, 0.85, 0.045, 0xe8836b, -1.6, 1.52, -3.44, 1);
      towel.rotation.x = 0.06;
      // shower zone behind a glass panel: column, head, bottles, drain
      box(0.05, 2.3, 1.25, 0xcfe4ee, 2.3, 1.15, -2.6, 0.1, { transparent: true, opacity: 0.28, metalness: 0.3 });
      cyl(0.035, 0.035, 1.6, 0xc8ccd2, 3.35, 1.7, -3.35, 0.25, { metalness: 0.8 });
      const showerHead = cyl(0.17, 0.21, 0.09, 0xb9c6d2, 3.15, 2.5, -3.2, 0.25, { metalness: 0.7 });
      showerHead.rotation.z = 0.5;
      box(0.5, 0.05, 0.2, 0xe8edf0, 3.3, 1.15, -3.45, 0.5);
      cyl(0.05, 0.05, 0.2, 0x3f6d8e, 3.18, 1.28, -3.45, 0.5);
      cyl(0.05, 0.05, 0.17, 0xf5b942, 3.42, 1.26, -3.45, 0.5);
      cyl(0.3, 0.3, 0.02, 0x8a9aa2, 3.1, 0.015, -2.6, 0.4, { metalness: 0.5 });
      // washing machine with a round glass door + laundry basket with clothes
      box(1.05, 1.12, 0.85, 0xeef1f3, -2.55, 0.56, -2.95, 0.35);
      const drum = cyl(0.33, 0.33, 0.06, 0x39505f, -2.55, 0.58, -2.5, 0.2, { metalness: 0.5 });
      drum.rotation.x = Math.PI / 2;
      box(0.9, 0.14, 0.03, 0xd5dade, -2.55, 1.02, -2.51, 0.4);
      cyl(0.045, 0.045, 0.03, 0x3f6d8e, -2.85, 1.02, -2.49, 0.4).rotation.x = Math.PI / 2;
      const basket = cyl(0.34, 0.27, 0.45, 0xd9c9a8, -3.85, 0.23, -2.1, 0.9, {}, 12);
      basket.castShadow = false;
      const heap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 9, 7), mat(0x9fc8e8, 1));
      heap.scale.y = 0.55; heap.position.set(-3.85, 0.48, -2.1); scene.add(heap);
      // simple toilet at the far left edge
      box(0.72, 0.62, 0.26, 0xeef1f3, -4.85, 0.98, -3.3, 0.35);
      cyl(0.31, 0.24, 0.44, 0xffffff, -4.85, 0.22, -2.95, 0.3);
      cyl(0.35, 0.35, 0.07, 0xf6f2e8, -4.85, 0.47, -2.95, 0.3);
      // bath mat + a small plant on the vanity
      box(1.35, 0.025, 0.62, 0x8fb8c9, 0.2, 0.013, -2.15, 1);
      cyl(0.06, 0.05, 0.09, 0xb0653a, -0.62, 0.92, -3.15, 0.8);
      const sprout = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 6), mat(0x4d9b5f, 1, { flatShading: true }));
      sprout.position.set(-0.62, 1.05, -3.15); scene.add(sprout);
    } else if (setKind === "market") {
      box(20, 5.5, 0.3, 0xe8c9a0, 0, 2.75, -3.9, 1);
      box(3.4, 0.95, 0.08, 0x14532d, -3.6, 3.6, -3.7, 0.6);
      plane(3.3, 0.88, boardTex("#14532d", [{ t: "菜 市 场", s: 62, c: "#ffffff" }, { t: "新鲜直供 · 明码标价", s: 32, c: "#bbf7d0" }]), -3.6, 3.6, -3.65);
      box(2.8, 0.8, 0.08, 0x7c2d12, 2.9, 3.45, -3.7, 0.6);
      plane(2.7, 0.72, boardTex("#7c2d12", [{ t: "夜市大排档", s: 48, c: "#fde68a" }]), 2.9, 3.45, -3.65);
      // main stall: counter, striped awning, crates of produce, hanging scale
      box(3.9, 0.92, 1.35, 0x8a5a3b, 0, 0.46, -1.7, 0.9);
      box(4.1, 0.08, 1.5, 0xc9a06a, 0, 0.97, -1.7, 0.8);
      for (let i = 0; i < 5; i++) {
        const seg = box(0.88, 0.07, 1.6, i % 2 ? 0xf3ead8 : 0xd9534a, -1.76 + i * 0.88, 2.32, -1.35, 0.8);
        seg.rotation.x = 0.38;
      }
      box(0.07, 1.5, 0.07, 0x6b4630, -2.05, 1.55, -0.85, 0.8);
      box(0.07, 1.5, 0.07, 0x6b4630, 2.05, 1.55, -0.85, 0.8);
      const crateCols = [0xe8862e, 0x65a30d, 0xd93a2c];
      for (let ci = 0; ci < 3; ci++) {
        const cx = -1.25 + ci * 1.25;
        box(1.0, 0.3, 0.8, 0x74522f, cx, 1.16, -1.7, 0.9);
        for (let si = 0; si < 5; si++) {
          const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 7), mat(crateCols[ci]!, 0.75));
          fruit.position.set(cx - 0.3 + (si % 3) * 0.3, 1.36 + Math.floor(si / 3) * 0.16, -1.85 + (si % 2) * 0.3);
          fruit.castShadow = true;
          scene.add(fruit);
        }
      }
      cyl(0.03, 0.03, 0.75, 0x8a8f96, -1.75, 1.95, -1.3, 0.4, { metalness: 0.6 });
      cyl(0.2, 0.16, 0.06, 0xc8ccd2, -1.75, 1.55, -1.3, 0.3, { metalness: 0.6 });
      // noodle pot steaming on the stall counter (the 夜市吃面 beat)
      cyl(0.34, 0.3, 0.3, 0x3c4148, -0.55, 1.28, -1.95, 0.35, { metalness: 0.55 });
      cyl(0.3, 0.3, 0.04, 0x9aa3ad, -0.55, 1.45, -1.95, 0.3, { metalness: 0.6 });
      addSteam(-0.55, 1.5, -1.95);
      // the eating corner: folding table + stool + a bowl of noodles,
      // placed exactly where the seated eat pose lands (actor at x .55)
      box(1.15, 0.06, 0.72, 0xd8d2c4, 0.55, 0.8, -0.38, 0.6);
      box(0.06, 0.78, 0.06, 0x8a8f96, 0.08, 0.39, -0.62, 0.4, { metalness: 0.5 });
      box(0.06, 0.78, 0.06, 0x8a8f96, 1.02, 0.39, -0.62, 0.4, { metalness: 0.5 });
      box(0.06, 0.78, 0.06, 0x8a8f96, 0.08, 0.39, -0.14, 0.4, { metalness: 0.5 });
      box(0.06, 0.78, 0.06, 0x8a8f96, 1.02, 0.39, -0.14, 0.4, { metalness: 0.5 });
      box(0.52, 0.5, 0.52, 0xb3552e, 0.55, 0.25, 0.48, 0.8);
      cyl(0.2, 0.13, 0.13, 0xffffff, 0.45, 0.9, -0.38, 0.4);
      const noodleMound = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat(0xf5d98a, 0.85));
      noodleMound.scale.y = 0.45;
      noodleMound.position.set(0.45, 0.97, -0.38);
      scene.add(noodleMound);
      addSteam(0.45, 1.0, -0.38);
      cyl(0.09, 0.07, 0.1, 0xd9534a, 0.82, 0.88, -0.3, 0.5);
      box(0.03, 0.02, 0.26, 0x8a5a3b, 0.68, 0.86, -0.52, 0.6);
      // the vendor behind the stall
      extraFigure(1.15, 0, -2.75, 0, 0x7a9a4d, 0x44403c);
      box(0.62, 0.55, 0.03, 0x3f6212, 1.15, 1.0, -2.42, 0.9);
      // string lights sagging over the stall front
      for (let i = 0; i < 9; i++) {
        const lx = -3.4 + i * 0.85;
        const ly = 3.0 - Math.sin((i / 8) * Math.PI) * 0.3;
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), mat(0xffd98a, 0.4, { emissive: 0xffc873, emissiveIntensity: night ? 1.8 : 0.9 }));
        bulb.position.set(lx, ly, -0.55);
        scene.add(bulb);
        addGlow(lx, ly, -0.55, 0.5, 0xffc98a, 0.35);
      }
      // second stall hinted at the left + scattered ground mats
      box(2.6, 0.85, 1.1, 0x74522f, -4.9, 0.43, -1.9, 0.9);
      const awn2 = box(2.9, 0.07, 1.3, 0x3f6d8e, -4.9, 2.05, -1.6, 0.8);
      awn2.rotation.x = 0.38;
      box(2.2, 0.02, 1.1, 0xb3552e, 1.8, 0.012, 0.6, 1);
      box(1.6, 0.02, 0.9, 0x3f6d8e, -2.6, 0.012, 0.9, 1);
    } else if (setKind === "mall") {
      box(22, 8, 0.3, 0xe9e2d4, 0, 4, -3.75, 1);
      // storefront: glowing interior behind glass panels + sign
      box(6.4, 3.1, 0.15, 0xffe2b0, -1.6, 1.85, -3.6, 0.6, { emissive: 0xffc98a, emissiveIntensity: 0.35 });
      for (let i = 0; i < 3; i++) box(1.95, 2.9, 0.06, 0xbfd9ea, -3.65 + i * 2.05, 1.8, -3.5, 0.1, { transparent: true, opacity: 0.35, metalness: 0.4 });
      box(6.6, 0.75, 0.1, 0x111827, -1.6, 3.75, -3.55, 0.5);
      plane(6.4, 0.66, boardTex("#111827", [{ t: "时 尚 MALL · 新品上市", s: 46, c: "#f9a8d4" }]), -1.6, 3.75, -3.49);
      // mannequin on a platform inside the window
      box(1.1, 0.14, 1.1, 0x2e3440, -2.6, 0.07, -2.9, 0.6);
      extraFigure(-2.6, 0.14, -2.9, 0, 0xe8e2d4, 0xd8d2c4);
      // clothing rack with colourful pieces
      cyl(0.03, 0.03, 1.55, 0x8a8f96, 1.9, 0.78, -1.0, 0.3, { metalness: 0.7 });
      cyl(0.03, 0.03, 1.55, 0x8a8f96, 3.6, 0.78, -1.0, 0.3, { metalness: 0.7 });
      const rackBar = cyl(0.025, 0.025, 1.8, 0x8a8f96, 2.75, 1.58, -1.0, 0.3, { metalness: 0.7 });
      rackBar.rotation.z = Math.PI / 2;
      for (let i = 0; i < 5; i++) {
        const cloth = box(0.26, 0.75, 0.05, [0xd9534a, 0x3f6d8e, 0xf5b942, 0x65a30d, 0xec4899][i]!, 2.15 + i * 0.32, 1.18, -1.0, 0.9);
        cloth.rotation.y = (i % 2 ? 1 : -1) * 0.08;
      }
      // display table with folded stacks + shoes
      box(1.5, 0.75, 0.8, 0xd8d2c4, 0.4, 0.38, -0.5, 0.6);
      box(0.5, 0.14, 0.4, 0x3f6d8e, 0.15, 0.83, -0.5, 0.9);
      box(0.5, 0.12, 0.4, 0xf5b942, 0.68, 0.82, -0.5, 0.9);
      box(0.34, 0.1, 0.13, 0x2b2118, 0.42, 0.81, -0.28, 0.7);
      // Summit welcome pillar + planter + bench + hanging light spheres
      box(0.7, 3.4, 0.7, 0xd8d2c4, 5.3, 1.7, -2.6, 0.7);
      plane(0.66, 1.5, boardTex("#0c4a6e", [{ t: "湾区峰会", s: 46, c: "#ffffff" }, { t: "深圳欢迎您", s: 34, c: "#bae6fd" }]), 5.3, 2.1, -2.24);
      box(1.5, 0.45, 0.55, 0xb08954, -5.2, 0.23, -0.7, 0.8);
      const bushM = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 7), mat(0x4d9b5f, 1, { flatShading: true }));
      bushM.position.set(-5.2, 0.62, -0.7); bushM.castShadow = true; scene.add(bushM);
      box(1.7, 0.1, 0.45, 0x8a6f4d, 4.6, 0.5, -0.4, 0.8);
      for (let i = 0; i < 4; i++) {
        const lb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mat(0xfff2d8, 0.4, { emissive: 0xffe9b8, emissiveIntensity: 1.1 }));
        lb.position.set(-3.4 + i * 2.1, 3.3, -0.4);
        scene.add(lb);
        addGlow(-3.4 + i * 2.1, 3.3, -0.4, 0.9, 0xffe9b8, 0.4);
      }
    } else if (setKind === "gym") {
      roomShell(0xdde4ea, 0x3f4a5a, {});
      box(3.8, 0.05, 2.5, 0x2f6f6a, 0.1, 0.03, -0.3, 1);
      const mirrorG = box(5.2, 1.9, 0.05, 0xcfe0ea, 0.1, 2.1, -3.56, 0.12, { metalness: 0.7 });
      mirrorG.castShadow = false;
      // treadmill with a runner mid-stride
      box(0.9, 0.22, 2.0, 0x2e3440, -3.2, 0.11, -1.5, 0.6);
      box(0.8, 0.05, 1.7, 0x1c2129, -3.2, 0.24, -1.45, 0.5);
      box(0.08, 1.15, 0.08, 0x5a6470, -3.55, 0.75, -2.3, 0.5);
      box(0.08, 1.15, 0.08, 0x5a6470, -2.85, 0.75, -2.3, 0.5);
      const console_ = box(0.85, 0.3, 0.08, 0x2e3440, -3.2, 1.4, -2.3, 0.5, { emissive: 0x7dd3fc, emissiveIntensity: 0.35 });
      console_.rotation.x = -0.4;
      const runner = extraFigure(-3.2, 0.26, -1.4, Math.PI, 0xec4899, 0x2b2b33);
      runner.legL.rotation.x = 0.55; runner.legR.rotation.x = -0.5;
      runner.armL.rotation.x = -0.7; runner.armR.rotation.x = 0.6;
      // dumbbell rack + kettlebells + bench
      box(1.9, 0.08, 0.5, 0x3c4654, 3.1, 0.45, -2.5, 0.6);
      box(1.9, 0.08, 0.5, 0x3c4654, 3.1, 0.95, -2.5, 0.6);
      box(0.08, 1.0, 0.5, 0x3c4654, 2.2, 0.5, -2.5, 0.6);
      box(0.08, 1.0, 0.5, 0x3c4654, 4.0, 0.5, -2.5, 0.6);
      for (let i = 0; i < 4; i++) {
        const db = 0.09 + i * 0.015;
        const s1 = new THREE.Mesh(new THREE.SphereGeometry(db + 0.05, 8, 7), mat(0x2e3440, 0.5));
        s1.position.set(2.5 + i * 0.4, 0.62, -2.5); scene.add(s1);
        const s2 = s1.clone(); s2.position.y = 1.12; scene.add(s2);
      }
      const kb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 9, 8), mat(0xd9534a, 0.6));
      kb.position.set(1.6, 0.17, 0.6); kb.castShadow = true; scene.add(kb);
      const kb2 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 9, 8), mat(0x3f6d8e, 0.6));
      kb2.position.set(1.95, 0.14, 0.85); kb2.castShadow = true; scene.add(kb2);
      box(1.7, 0.12, 0.45, 0x2e3440, -0.4, 0.48, -2.2, 0.7);
      box(0.1, 0.48, 0.4, 0x5a6470, -1.2, 0.24, -2.2, 0.6);
      box(0.1, 0.48, 0.4, 0x5a6470, 0.4, 0.24, -2.2, 0.6);
      cyl(0.05, 0.04, 0.3, 0x7dd3fc, -1.5, 0.15, 0.9, 0.4);
      box(1.5, 0.95, 0.06, 0x1f2937, 3.3, 2.6, -3.56, 0.6);
      plane(1.42, 0.88, boardTex("#1f2937", [{ t: "自律 · 坚持", s: 46, c: "#f5b942" }, { t: "NO PAIN NO GAIN", s: 24, c: "#e2e8f0", bold: false }]), 3.3, 2.6, -3.52);
    } else if (setKind === "club") {
      // Livehouse / 夜店: dark room, stage with a band, a spinning mirror
      // ball, coloured lights sweeping, a crowd bouncing to the beat
      scene.background = new THREE.Color(0x0d0818);
      scene.fog = new THREE.Fog(0x0d0818, 12, 26);
      hemi.intensity = 0.18; sun.intensity = 0.25; warm.intensity = 3;
      box(22, 8, 0.3, 0x15102a, 0, 4, -3.75, 1);
      box(0.3, 8, 12, 0x15102a, -7.2, 4, 0, 1);
      box(7.5, 0.45, 2.4, 0x23233a, 0.6, 0.23, -2.5, 0.6);
      box(7.5, 0.05, 0.08, 0xff3ea5, 0.6, 0.47, -1.3, 0.3, { emissive: 0xff3ea5, emissiveIntensity: 2 });
      box(7.2, 1.0, 0.1, 0x0b0b14, 0.6, 3.6, -3.55, 0.5);
      plane(7.0, 0.9, boardTex("#0b0b14", [{ t: "LIVEHOUSE · 今晚原创专场", s: 48, c: "#f472b6" }]), 0.6, 3.6, -3.49);
      // speakers
      for (const sx of [-3.4, 4.6]) { box(0.9, 1.9, 0.8, 0x111118, sx, 1.4, -2.7, 0.5); cyl(0.26, 0.26, 0.05, 0x2b2b38, sx, 1.75, -2.28, 0.4).rotation.x = Math.PI / 2; cyl(0.17, 0.17, 0.05, 0x2b2b38, sx, 1.1, -2.28, 0.4).rotation.x = Math.PI / 2; }
      // band: singer at the mic, guitarist, drummer behind a kit
      cyl(0.02, 0.02, 1.4, 0x9ca3af, 0.6, 1.15, -1.75, 0.3, { metalness: 0.8 });
      const singer = extraFigure(0.6, 0.47, -2.1, 0, 0xf472b6, 0x1f1f2e);
      singer.armR.rotation.x = -1.2;
      dancers.push({ f: singer, ph: 0.3, y: 0.47 });
      const guitar = extraFigure(-1.6, 0.47, -2.3, 0.4, 0x38bdf8, 0x1f1f2e);
      guitar.armL.rotation.x = -0.9; guitar.armR.rotation.x = -0.6;
      box(0.9, 0.28, 0.08, 0xb45309, -1.5, 1.35, -2.0, 0.5).rotation.z = 0.5;
      dancers.push({ f: guitar, ph: 1.2, y: 0.47 });
      cyl(0.4, 0.4, 0.4, 0xe11d48, 2.8, 0.75, -2.9, 0.4);
      cyl(0.28, 0.28, 0.25, 0xe5e7eb, 2.2, 0.85, -2.6, 0.4);
      cyl(0.3, 0.3, 0.03, 0xfacc15, 3.4, 1.35, -2.6, 0.3, { metalness: 0.9 });
      extraFigure(2.8, 0.47, -3.3, 0, 0x22c55e, 0x1f1f2e, true);
      // mirror ball
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), mat(0xffffff, 0.15, { metalness: 1, flatShading: true, emissive: 0x9ca3af, emissiveIntensity: 0.3 }));
      ball.position.set(0.6, 4.4, 0.2); scene.add(ball); spinners.push(ball);
      addGlow(0.6, 4.4, 0.2, 1.6, 0xffffff, 0.35);
      // colour lights that sweep and pulse
      for (const [i, c] of [0xff2d95, 0x22d3ee, 0xa855f7, 0xfacc15].entries()) {
        const pl = new THREE.PointLight(c, 14, 9, 1.6);
        pl.position.set(-3 + i * 2.6, 3.4, -0.5);
        scene.add(pl); clubLights.push({ l: pl, ph: i * 1.6 });
        addGlow(-3 + i * 2.6, 3.4, -0.5, 1.1, c, 0.55);
      }
      // the crowd, backs to camera, bouncing
      const crowdCols = [0x3b82f6, 0xf59e0b, 0x10b981, 0xef4444, 0x8b5cf6, 0xe5e7eb, 0x06b6d4];
      for (let i = 0; i < 7; i++) {
        const left = i < 4, k = left ? i : i - 4; const cx = left ? -5.6 + k * 0.75 : 3.5 + k * 0.9, cz = -0.7 + (k % 2) * 0.7;
        const f = extraFigure(cx, 0, cz, left ? Math.PI * 0.8 : -Math.PI * 0.8, crowdCols[i]!, 0x1f2937);
        if (i % 3 === 0) { f.armL.rotation.x = -2.6; f.armR.rotation.x = -2.6; }
        dancers.push({ f, ph: i * 0.7, y: 0 });
      }
      // bar on the side
      box(0.8, 1.1, 3.2, 0x2a1a3a, -6.2, 0.55, 0.2, 0.5);
      box(0.9, 0.06, 3.3, 0x0ea5e9, -6.2, 1.13, 0.2, 0.2, { emissive: 0x0ea5e9, emissiveIntensity: 1.4 });
    } else if (setKind === "clinic") {
      // 社区医院 / 诊所: waiting chairs, a queue screen, the doctor's desk
      roomShell(0xeef6f7, 0x9cc9cf, { windowX: 4.4, windowW: 1.8 });
      box(2.6, 0.95, 0.06, 0x0f3d47, -2.4, 2.6, -3.55, 0.5);
      plane(2.5, 0.88, boardTex("#0f3d47", [{ t: "请 A027 号到 3 诊室", s: 44, c: "#5eead4" }, { t: "候诊 12 人 · 预计 25 分钟", s: 30, c: "#e2e8f0", bold: false }]), -2.4, 2.6, -3.51);
      box(1.0, 1.0, 0.08, 0xffffff, 1.6, 2.7, -3.55, 0.6);
      box(0.6, 0.16, 0.09, 0xdc2626, 1.6, 2.7, -3.5, 0.5); box(0.16, 0.6, 0.09, 0xdc2626, 1.6, 2.7, -3.5, 0.5);
      // row of waiting chairs with patients
      for (let i = 0; i < 4; i++) {
        const x = -4.6 + i * 0.85;
        box(0.7, 0.08, 0.6, 0x60a5fa, x, 0.5, -1.2, 0.5); box(0.7, 0.6, 0.07, 0x60a5fa, x, 0.82, -1.5, 0.5);
        if (i !== 2) { const pt = extraFigure(x, -0.42, -1.05, 0, [0xf59e0b, 0x10b981, 0, 0xa855f7][i]!, 0x374151, true); if (i === 0) pt.armR.rotation.x = -1.2; }
      }
      // doctor's desk, monitor, doctor in a white coat
      box(2.2, 0.08, 1.0, 0xe5e7eb, 2.6, 0.9, -1.6, 0.4);
      box(0.08, 0.86, 0.9, 0xd1d5db, 1.6, 0.45, -1.6, 0.5); box(0.08, 0.86, 0.9, 0xd1d5db, 3.6, 0.45, -1.6, 0.5);
      box(0.7, 0.45, 0.05, 0x111827, 2.9, 1.25, -1.9, 0.4, { emissive: 0x38bdf8, emissiveIntensity: 0.4 });
      extraFigure(2.9, -0.42, -2.55, 0, 0xffffff, 0x1e3a8a, true);
      // bed with a curtain
      box(2.0, 0.55, 0.9, 0xf8fafc, 5.5, 0.4, -0.6, 0.6);
      box(0.06, 2.4, 2.0, 0xa7f3d0, 4.3, 1.4, -0.6, 0.9, { transparent: true, opacity: 0.75 });
      cyl(0.22, 0.18, 0.5, 0x9ca3af, -6.2, 0.25, -2.6, 0.5);
      addGlow(0, 3.9, -1, 2.2, 0xe0f2fe, 0.4);
    } else if (setKind === "classroom") {
      // 夜校 / 培训班: blackboard, rows of desks, a teacher mid-lesson
      roomShell(0xf3efe2, 0x7b9e87, { windowX: 4.6, windowW: 2.0 });
      box(4.6, 1.7, 0.08, 0x1f3a2c, -1.2, 2.4, -3.55, 0.8);
      plane(4.4, 1.55, boardTex("#1f3a2c", [{ t: "第 7 课 · 职场英语 / Python 入门", s: 34, c: "#f8fafc" }, { t: "print(\"Hello, 湾区\")", s: 38, c: "#fde68a", bold: false }, { t: "考证冲刺：还有 23 天", s: 30, c: "#fca5a5", bold: false }], 640, 256), -1.2, 2.4, -3.5);
      box(4.8, 0.08, 0.14, 0x8a6f4d, -1.2, 1.5, -3.48, 0.6);
      const teacher = extraFigure(1.7, 0, -2.8, 0.4, 0x7c3aed, 0x374151);
      teacher.armR.rotation.x = -2.1;
      box(1.4, 0.9, 0.7, 0x8a6f4d, 2.9, 0.45, -2.6, 0.7);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
        const x = -4.4 + c * 1.9, z = -0.9 + r * 1.5;
        box(1.2, 0.07, 0.6, 0xd6b98c, x, 0.82, z, 0.7);
        box(0.06, 0.8, 0.5, 0x6b7280, x - 0.55, 0.4, z, 0.5); box(0.06, 0.8, 0.5, 0x6b7280, x + 0.55, 0.4, z, 0.5);
        box(0.3, 0.03, 0.22, 0xffffff, x - 0.2, 0.87, z, 0.9);
        if ((r * 4 + c) % 3 !== 1) { const st = extraFigure(x, -0.42, z + 0.55, Math.PI, [0x3b82f6, 0xef4444, 0x10b981, 0xf59e0b, 0x06b6d4][(r * 4 + c) % 5]!, 0x1f2937, true); st.armL.rotation.x = -1.2; st.armR.rotation.x = -1.1; }
      }
      cyl(0.32, 0.32, 0.05, 0xffffff, -5.8, 3.2, -3.55, 0.5).rotation.x = Math.PI / 2;
      addGlow(-1.2, 4.0, -1, 2.4, 0xfff7e0, 0.35);
    } else if (setKind === "park") {
      box(18, 0.8, 0.5, 0x3d7a44, 0, 0.4, -3.6, 1);
      box(11.5, 0.03, 1.15, 0xd9c9a8, 0, 0.015, 0.35, 1);
      for (let i = 0; i < 4; i++) {
        const tx = -4.4 + i * 2.7;
        cyl(0.1, 0.14, 0.9, 0x7a4b2d, tx, 0.45, -2.5 - (i % 2) * 0.5, 1);
        const fol = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.1, 7), mat(0x4d9b5f, 1, { flatShading: true }));
        fol.position.set(tx, 1.95, -2.5 - (i % 2) * 0.5);
        fol.castShadow = true;
        scene.add(fol);
      }
      for (const [bx, bz, bs] of [[-2.2, -1.5, 0.42], [3.9, -1.9, 0.5], [5.3, -0.9, 0.36]] as const) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(bs, 8, 7), mat(0x57a773, 1, { flatShading: true }));
        b.position.set(bx, bs * 0.7, bz); b.castShadow = true; scene.add(b);
      }
      for (let i = 0; i < 12; i++) {
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), mat([0xec4899, 0xf5b942, 0xffffff, 0xd9534a][i % 4]!, 0.7));
        fl.position.set(-5 + (i * 0.9) % 10, 0.09, -1.3 + (i % 3) * 0.35);
        scene.add(fl);
      }
      box(1.9, 0.12, 0.52, 0x8a5a3b, 2.4, 0.52, -0.95, 0.9);
      box(0.12, 0.52, 0.12, 0x6b4630, 1.65, 0.26, -0.95); box(0.12, 0.52, 0.12, 0x6b4630, 3.15, 0.26, -0.95);
      box(1.9, 0.5, 0.09, 0x8a5a3b, 2.4, 0.95, -1.2, 0.9);
      cyl(0.05, 0.06, 2.1, 0x3a3f4a, -1.9, 1.05, -1.2, 0.6);
      const lampP = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mat(0xfff2d8, 0.4, { emissive: 0xffe9b8, emissiveIntensity: night ? 1.8 : 0.7 }));
      lampP.position.set(-1.9, 2.2, -1.2); scene.add(lampP);
      addGlow(-1.9, 2.2, -1.2, night ? 2.2 : 1.1, 0xffe9b8, night ? 0.7 : 0.35);
      const pond = cyl(1.55, 1.55, 0.03, 0x7ec2ee, -4.1, 0.015, 1.9, 0.25, { metalness: 0.3 }, 22);
      pond.castShadow = false;
      cyl(1.7, 1.7, 0.02, 0xd9c9a8, -4.1, 0.008, 1.9, 1, {}, 22).castShadow = false;
    } else if (setKind === "concourse") {
      // station concourse: fare gates behind, security check on the walk
      // path, and the metro mall — convenience store, bakery, flower kiosk
      box(22, 8, 0.3, 0xdfe5ea, 0, 4, -3.9, 1);
      box(22, 0.55, 0.34, 0x0369a1, 0, 3.15, -3.88, 0.7);
      for (const lx of [-4.2, 0, 4.2]) {
        const panel = box(2.8, 0.07, 1.15, 0xfff6e0, lx, 4.5, -0.8, 0.4, { emissive: 0xfff2d8, emissiveIntensity: 1.1 });
        panel.castShadow = false;
      }
      box(0.05, 0.65, 0.05, 0x5a5348, -1.7, 4.35, -1.2); box(0.05, 0.65, 0.05, 0x5a5348, 1.7, 4.35, -1.2);
      box(4.6, 1.0, 0.1, 0x14202b, 0, 3.85, -1.2, 0.5);
      plane(4.5, 0.92, boardTex("#14202b", [{ t: "地 铁 站", s: 62, c: "#ffffff" }, { t: "METRO · 安检进站 · 刷码 / 刷卡 / 单程票", s: 29, c: "#7dd3fc" }]), 0, 3.85, -1.14);
      // fare gates: three turnstiles with green go-lights
      for (const gx of [-2.7, -1.6, -0.5]) {
        box(0.55, 1.0, 1.15, 0xb9c6d2, gx, 0.5, -1.95, 0.35, { metalness: 0.5 });
        const go = box(0.22, 0.05, 0.22, 0x22c55e, gx, 1.03, -1.7, 0.4, { emissive: 0x22c55e, emissiveIntensity: 1.4 });
        go.castShadow = false;
        box(0.04, 0.55, 0.4, 0x7e97a8, gx + 0.3, 0.62, -1.95, 0.4, { metalness: 0.4 });
      }
      // security arch right on the walk path + X-ray machine with a bag on the belt
      box(0.14, 2.15, 0.55, 0x8fa3b5, -0.6, 1.08, 0.08, 0.4, { metalness: 0.5 });
      box(0.14, 2.15, 0.55, 0x8fa3b5, -0.6, 1.08, 1.02, 0.4, { metalness: 0.5 });
      box(0.14, 0.3, 1.5, 0x74879a, -0.6, 2.28, 0.55, 0.4, { metalness: 0.5 });
      const archLight = box(0.16, 0.07, 0.5, 0x22c55e, -0.6, 2.47, 0.55, 0.4, { emissive: 0x22c55e, emissiveIntensity: 1.6 });
      archLight.castShadow = false;
      box(1.75, 0.45, 0.06, 0x14202b, -0.6, 2.85, 0.3, 0.5);
      plane(1.68, 0.4, boardTex("#14202b", [{ t: "安 检 · SECURITY", s: 40, c: "#7dd3fc" }]), -0.6, 2.85, 0.34);
      box(1.55, 1.0, 0.85, 0x5a6a78, -0.6, 0.52, -0.95, 0.4, { metalness: 0.4 });
      box(0.75, 0.62, 0.87, 0x141a21, -0.6, 0.6, -0.95, 0.4);
      box(1.8, 0.09, 0.52, 0x2e3440, -0.6, 0.82, -0.95, 0.5);
      box(0.42, 0.3, 0.26, 0xd9534a, -0.35, 1.02, -0.95, 0.6);
      box(0.36, 0.26, 0.24, 0x3f6d8e, -1.35, 1.0, -0.95, 0.6);
      // metro mall along the back wall: convenience store, bakery, drinks machine
      box(2.7, 2.35, 0.14, 0xbfe3f2, -4.7, 1.5, -3.62, 0.2, { transparent: true, opacity: 0.4, metalness: 0.3 });
      box(2.9, 0.62, 0.1, 0x0284c7, -4.7, 2.95, -3.6, 0.5);
      plane(2.8, 0.54, boardTex("#0284c7", [{ t: "便 利 店 · 24h", s: 44, c: "#ffffff" }]), -4.7, 2.95, -3.54);
      for (let sIdx = 0; sIdx < 3; sIdx++) box(2.2, 0.09, 0.4, 0xe8edf0, -4.7, 0.7 + sIdx * 0.55, -3.68, 0.5);
      for (let bIdx = 0; bIdx < 6; bIdx++) box(0.22, 0.3, 0.2, [0xd9534a, 0xf5b942, 0x65a30d, 0x3f6d8e][bIdx % 4]!, -5.6 + bIdx * 0.36, 1.0, -3.68, 0.6);
      box(2.5, 2.2, 0.14, 0xffe2b0, 4.35, 1.45, -3.62, 0.6, { emissive: 0xffc98a, emissiveIntensity: 0.3 });
      box(2.7, 0.62, 0.1, 0xb45309, 4.35, 2.85, -3.6, 0.5);
      plane(2.6, 0.54, boardTex("#b45309", [{ t: "面 包 房 · 现烤", s: 44, c: "#fff3cf" }]), 4.35, 2.85, -3.54);
      box(2.2, 0.75, 0.6, 0x8a5a3b, 4.35, 0.38, -3.2, 0.7);
      for (let bIdx = 0; bIdx < 5; bIdx++) {
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mat(0xe0aa5e, 0.8));
        bun.scale.y = 0.7; bun.position.set(3.6 + bIdx * 0.38, 0.85, -3.2); bun.castShadow = true; scene.add(bun);
      }
      box(0.85, 1.9, 0.72, 0x374151, -6.6, 0.95, -3.1, 0.4);
      const vend = box(0.7, 1.1, 0.05, 0x7dd3fc, -6.6, 1.15, -2.72, 0.3, { emissive: 0x7dd3fc, emissiveIntensity: 0.8 });
      vend.castShadow = false;
      // flower kiosk, free-standing
      box(1.15, 0.85, 0.7, 0x74522f, 6.1, 0.43, -1.6, 0.8);
      const kioskTop = box(1.4, 0.06, 0.95, 0xec4899, 6.1, 1.75, -1.6, 0.7);
      kioskTop.rotation.x = 0.15;
      for (let fIdx = 0; fIdx < 6; fIdx++) {
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 6), mat([0xec4899, 0xf5b942, 0xd93a2c, 0xffffff][fIdx % 4]!, 0.7));
        fl.position.set(5.7 + (fIdx % 3) * 0.4, 1.0 + Math.floor(fIdx / 3) * 0.22, -1.6);
        scene.add(fl);
      }
      // line-map board on a pillar + fellow travellers
      box(0.55, 4.4, 0.55, 0xc8ccd2, 2.4, 2.2, -2.3, 0.6);
      box(1.75, 1.25, 0.07, 0x2b2118, 2.4, 2.05, -2.0, 0.5);
      plane(1.65, 1.15, lineMapTex(), 2.4, 2.05, -1.96);
      const walker = extraFigure(2.9, 0, 1.25, -Math.PI / 2, 0xec4899, 0x3a3f4a);
      walker.legL.rotation.x = 0.5; walker.legR.rotation.x = -0.45;
      walker.armL.rotation.x = -0.4; walker.armR.rotation.x = 0.35;
      extraFigure(-4.5, 0, -2.55, Math.PI, 0x22c55e, 0x374151);
    } else if (setKind === "platform") {
      // underground platform: screen doors, the train waiting behind them,
      // station sign, bench, waiting passengers, hanging direction board
      box(22, 7.5, 0.3, 0x93a9ba, 0, 3.75, -3.95, 0.8);
      box(22, 0.55, 0.34, 0x0096d6, 0, 3.0, -3.92, 0.6);
      box(3.6, 0.95, 0.08, 0x14202b, -3.4, 2.95, -3.76, 0.5);
      plane(3.5, 0.88, boardTex("#14202b", [{ t: "本 站", s: 52, c: "#ffffff" }, { t: "STATION · 屏蔽门", s: 28, c: "#7dd3fc" }]), -3.4, 2.95, -3.71);
      const trainP = box(15.5, 2.6, 1.7, 0xaebfcc, 0, 1.85, -3.2, 0.32, { metalness: 0.55 });
      trainP.castShadow = false;
      box(15.5, 0.38, 1.74, 0x0096d6, 0, 1.2, -3.2, 0.4, { metalness: 0.3 });
      for (let i = 0; i < 7; i++) box(1.05, 0.72, 0.06, 0xffd98a, -5.4 + i * 1.8, 2.4, -2.32, 0.3, { emissive: 0xffc873, emissiveIntensity: 1.1 });
      // platform screen doors: glass panels + frames, centre pair picked out
      for (let i = 0; i < 7; i++) {
        const dx = -5.4 + i * 1.8;
        box(1.62, 2.1, 0.05, 0xbfd9ea, dx, 1.18, -2.18, 0.12, { transparent: true, opacity: 0.32, metalness: 0.4 });
        box(0.09, 2.2, 0.09, 0x5a6a78, dx + 0.86, 1.18, -2.18, 0.4, { metalness: 0.5 });
      }
      box(1.62, 0.1, 0.07, 0xf5b942, 0, 2.32, -2.17, 0.5, { emissive: 0xf5b942, emissiveIntensity: 0.7 });
      // platform slab + yellow line + tactile strip
      box(17, 0.24, 4.6, 0xa39a8d, 0, -0.12, -0.3, 1);
      box(17, 0.03, 0.3, 0xf5b942, 0, 0.02, -1.3, 0.8);
      for (let i = 0; i < 12; i++) box(0.5, 0.025, 0.22, 0xd9c9a8, -6.6 + i * 1.2, 0.015, -0.95, 0.9);
      // hanging direction sign
      box(0.05, 0.6, 0.05, 0x5a5348, -1.3, 4.15, -1.1); box(0.05, 0.6, 0.05, 0x5a5348, 1.3, 4.15, -1.1);
      box(3.9, 0.8, 0.1, 0x14202b, 0, 3.8, -1.1, 0.5);
      plane(3.8, 0.74, boardTex("#14202b", [{ t: "开往 · 市中心方向", s: 40, c: "#ffffff" }, { t: "下一班 · 2 分钟", s: 28, c: "#a3e635" }]), 0, 3.8, -1.04);
      // bench + waiting passengers (one seated, one on their phone)
      box(2.3, 0.12, 0.52, 0x8a6f4d, -3.3, 0.52, 0.9, 0.8);
      box(0.12, 0.52, 0.12, 0x5a4632, -4.3, 0.26, 0.9); box(0.12, 0.52, 0.12, 0x5a4632, -2.3, 0.26, 0.9);
      extraFigure(-3.6, -0.3, 0.85, Math.PI, 0x8b5cf6, 0x2b2b33, true);
      const waiter = extraFigure(2.9, 0, 0.35, Math.PI, 0x78716c, 0x2f333a);
      waiter.armL.rotation.x = -0.95; waiter.armR.rotation.x = -0.95;
      waiter.head.rotation.x = 0.35;
      box(0.16, 0.3, 0.04, 0x14202b, 2.9, 0.98, 0.02, 0.3, { emissive: 0x7dd3fc, emissiveIntensity: 0.7 });
      // ad lightbox + ceiling light strip
      box(2.3, 1.3, 0.07, 0x2b2118, 4.9, 2.1, -3.76, 0.5);
      plane(2.2, 1.2, boardTex("#0c4a6e", [{ t: "峰会· 深圳欢迎您", s: 40, c: "#ffffff", bold: true }, { t: "Welcome to Shenzhen", s: 26, c: "#bae6fd" }]), 4.9, 2.1, -3.71);
      const stripP = box(9, 0.07, 0.4, 0xfff2d8, 0, 4.35, -1.2, 0.4, { emissive: 0xffe9b8, emissiveIntensity: 1.2 });
      stripP.castShadow = false;
    } else if (!["cruise", "wheel", "aquarium", "turtle", "coaster", "safari", "hike", "beach", "cablecar"].includes(setKind)) {
      // home living room: sofa, coffee table, rug, bookshelf, lamp, window, door
      roomShell(0xf3ead8, 0xcbb59a, { windowX: 4.7, windowW: 1.6, clock: true });
      box(2.95, 0.55, 1.05, 0x93b8a4, -1.3, 0.3, -2.35, 0.95);
      box(2.95, 0.8, 0.26, 0x84ab97, -1.3, 0.95, -2.8, 0.95);
      box(0.28, 0.62, 1.05, 0x84ab97, -2.85, 0.45, -2.35, 0.95);
      box(0.28, 0.62, 1.05, 0x84ab97, 0.25, 0.45, -2.35, 0.95);
      box(0.85, 0.16, 0.6, 0xf5b942, -1.95, 0.62, -2.3, 0.95);
      box(0.85, 0.16, 0.6, 0xec4899, -0.65, 0.62, -2.3, 0.95);
      box(3.5, 0.025, 2.3, 0xd9a05b, -1.2, 0.013, -1.55, 1);
      box(1.55, 0.07, 0.72, 0x8a6f4d, -1.3, 0.44, -1.25, 0.6);
      box(0.08, 0.42, 0.08, 0x6b543a, -1.95, 0.21, -1.5, 0.7); box(0.08, 0.42, 0.08, 0x6b543a, -0.65, 0.21, -1.5, 0.7);
      box(0.08, 0.42, 0.08, 0x6b543a, -1.95, 0.21, -1.0, 0.7); box(0.08, 0.42, 0.08, 0x6b543a, -0.65, 0.21, -1.0, 0.7);
      cyl(0.07, 0.06, 0.12, 0xd9534a, -1.7, 0.54, -1.2, 0.5);
      box(0.36, 0.045, 0.26, 0x3f6d8e, -0.95, 0.5, -1.3, 0.85);
      box(1.35, 2.1, 0.34, 0x96703f, 2.5, 1.05, -3.35, 0.8);
      for (let sIdx = 0; sIdx < 3; sIdx++) for (let bIdx = 0; bIdx < 5; bIdx++) {
        if ((sIdx + bIdx) % 4 === 2) continue;
        box(0.15, 0.4, 0.22, [0xd9534a, 0x3f6d8e, 0x65a30d, 0xf5b942][(sIdx * 2 + bIdx) % 4]!, 2.0 + bIdx * 0.24, 0.5 + sIdx * 0.6, -3.35, 0.85);
      }
      cyl(0.04, 0.05, 1.45, 0x3a3f4a, 1.35, 0.73, -2.95, 0.5);
      const shadeH = cyl(0.24, 0.3, 0.3, 0xf5b942, 1.35, 1.6, -2.95, 0.5, { emissive: 0xffc873, emissiveIntensity: night ? 1.5 : 0.6 });
      shadeH.castShadow = false;
      addGlow(1.35, 1.6, -2.8, 1.7, 0xffc98a, night ? 0.7 : 0.4);
      // door with frame + mat on the left wall side of the back wall
      box(1.05, 2.25, 0.09, 0xffffff, -4.4, 1.13, -3.56, 0.6);
      const door = box(0.92, 2.12, 0.07, 0xa9743f, -4.32, 1.06, -3.52, 0.7);
      door.rotation.y = 0.18;
      cyl(0.035, 0.035, 0.04, 0xf5b942, -3.98, 1.05, -3.44, 0.4, { metalness: 0.6 }).rotation.x = Math.PI / 2;
      box(1.0, 0.02, 0.55, 0xb3552e, -4.3, 0.012, -2.9, 1);
      addPicture(-2.6, 2.6, 1.05, 0.7, 0x9fc8e8);
      cyl(0.26, 0.2, 0.36, 0xb0653a, 5.9, 0.18, -2.85, 0.8);
      const fol3 = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 7), mat(0x4d9b5f, 1, { flatShading: true }));
      fol3.position.set(5.9, 0.72, -2.85); fol3.castShadow = true; scene.add(fol3);
    }
    let talker: Figure | null = null;
    if (partner) {
      talker = extraFigure(1.05, 0, 0.6, -Math.PI / 2, partner.shirt, partner.pants);
      bobbers.splice(bobbers.findIndex((b) => b.g === talker!.g), 1);
    }
    if (setKind === "cruise") {
      // 东江夜游: a lantern-lit sightseeing boat gliding at night — the far
      // bank's lights and the pagoda-like tower drift past, reflections
      // shimmer on the river, the deck rocks gently
      floor.visible = false;
      const river = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), mat(0x10263f, 0.25, { metalness: 0.35 }));
      river.rotation.x = -Math.PI / 2; river.position.y = -0.35; scene.add(river);
      const boat = new THREE.Group(); scene.add(boat);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 4.6), mat(0x8a5a3b, 0.8)); deck.position.set(0, -0.15, 0.4); deck.receiveShadow = true; boat.add(deck);
      const hull = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.6, 5), mat(0xf3efe6, 0.6)); hull.position.set(0, -0.55, 0.4); boat.add(hull);
      for (const z of [-1.8, 2.6]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(10, 0.06, 0.06), mat(0xd4a017, 0.4, { metalness: 0.6 })); rail.position.set(0, 0.85, z); boat.add(rail);
        for (let x = -4.8; x <= 4.8; x += 1.2) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.05), mat(0xd4a017, 0.4, { metalness: 0.6 })); post.position.set(x, 0.42, z); boat.add(post); }
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(10, 0.12, 2.2), mat(0x7f1d1d, 0.7)); roof.position.set(0, 2.75, -0.9); boat.add(roof);
      for (const x of [-4.6, 4.6]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.9, 8), mat(0x5b3a24)); pole.position.set(x, 1.3, -0.9); boat.add(pole); }
      for (let i = 0; i < 9; i++) {
        const lan = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat(0xef4444, 0.5, { emissive: 0xff5a36, emissiveIntensity: 1.6 }));
        lan.scale.y = 1.25; lan.position.set(-4 + i, 2.45, 0.15); boat.add(lan);
      }
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.55), mat(0x6b4630)); bench.position.set(0, 0.45, -0.75); boat.add(bench);
      // far bank: lit windows + the tower, sliding by
      const bank = new THREE.Group(); scene.add(bank);
      for (let i = 0; i < 40; i++) {
        const h = 1 + ((i * 37) % 7) * 0.6, x = -30 + i * 1.6;
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, h, 0.6), mat(0x1c2b40, 0.9)); b.position.set(x, h / 2 - 0.3, -8.5); bank.add(b);
        for (let w = 0; w < 3; w++) { const win = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), mat(0xffd27a, 0.5, { emissive: 0xffc35a, emissiveIntensity: 1.3 })); win.position.set(x - 0.3 + w * 0.3, 0.3 + ((i + w) % 4) * 0.4, -8.19); if ((i * 7 + w) % 3) bank.add(win); }
      }
      const tower = new THREE.Group(); tower.position.set(6, -0.3, -8.2); bank.add(tower);
      for (let f = 0; f < 6; f++) {
        const tier = new THREE.Mesh(new THREE.BoxGeometry(1.6 - f * 0.18, 0.55, 1.2 - f * 0.12), mat(0x3a2414, 0.8, { emissive: 0xffb347, emissiveIntensity: 0.55 })); tier.position.y = 0.3 + f * 0.62; tower.add(tier);
        const eave = new THREE.Mesh(new THREE.ConeGeometry(1.25 - f * 0.13, 0.25, 4), mat(0xf5c542, 0.5, { emissive: 0xffc35a, emissiveIntensity: 1.2 })); eave.rotation.y = Math.PI / 4; eave.position.y = 0.66 + f * 0.62; tower.add(eave);
      }
      // reflections: glowing streaks on the water
      const glints: THREE.Mesh[] = [];
      for (let i = 0; i < 26; i++) {
        const g = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.06), new THREE.MeshBasicMaterial({ color: i % 3 ? 0xffc35a : 0xff7a59, transparent: true, opacity: 0.7 }));
        g.rotation.x = -Math.PI / 2; g.position.set(-14 + i * 1.1, -0.33, -6.5 + (i % 5) * 0.9); scene.add(g); glints.push(g);
      }
      addGlow(6, 2.4, -8, 4.5, 0xffb347, 0.55);
      ticks.push((t) => {
        boat.rotation.z = Math.sin(t * 0.9) * 0.018; boat.position.y = Math.sin(t * 1.3) * 0.05;
        bank.position.x = ((-t * 0.9) % 48 + 48) % 48 - 24;
        glints.forEach((g, i) => { g.position.x = ((-14 + i * 1.1 - t * 1.4) % 30 + 30) % 30 - 15; (g.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.35 * Math.sin(t * 3 + i); });
      });
    } else if (setKind === "wheel") {
      // 摩天轮: inside a glass capsule — the city sinks away as the cabin
      // climbs, the rim's spokes turn behind
      floor.visible = false;
      const cab = new THREE.Group(); scene.add(cab);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.2, 32), mat(0xe5e7eb, 0.5)); base.position.y = -0.1; cab.add(base);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(2.7, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xbfe3f5, 0.1, { transparent: true, opacity: 0.18, metalness: 0.4, side: THREE.DoubleSide }));
      dome.scale.y = 1.25; cab.add(dome);
      const seat = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.22, 8, 28, Math.PI), mat(0xf8fafc, 0.6)); seat.rotation.x = Math.PI / 2; seat.position.set(0, 0.45, 0); cab.add(seat);
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6), mat(0xf8fafc, 0.6)); bench.position.set(0, 0.45, -0.75); cab.add(bench);
      const city = new THREE.Group(); scene.add(city);
      for (let i = 0; i < 70; i++) {
        const x = -22 + (i % 14) * 3.2 + ((i * 13) % 5) * 0.3, z = -6 - Math.floor(i / 14) * 3.5, h = 1.5 + ((i * 29) % 9) * 0.9;
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, h, 1.6), mat([0x9fb7c9, 0xc9d4dc, 0x7f97ab][i % 3]!, 0.6, { metalness: 0.2 })); b.position.set(x, h / 2 - 4, z); city.add(b);
      }
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(80, 30), mat(0x4a8fc0, 0.3)); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -4, -26); city.add(sea);
      const rim = new THREE.Group(); rim.position.set(0, 2, -5); scene.add(rim);
      rim.add(new THREE.Mesh(new THREE.TorusGeometry(7, 0.08, 6, 64), mat(0xe5e7eb, 0.4, { metalness: 0.6 })));
      for (let k = 0; k < 16; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 14, 0.04), mat(0xe5e7eb, 0.4)); sp.rotation.z = (k / 16) * Math.PI; rim.add(sp); }
      ticks.push((t) => {
        const rise = Math.min(1, t / 9);
        city.position.y = -rise * 5; rim.rotation.z = t * 0.06;
        cab.rotation.z = Math.sin(t * 0.7) * 0.012;
      });
    } else if (setKind === "aquarium") {
      // 海底隧道: walk through an acrylic tunnel — fish shoals, a ray and a
      // shark glide over and around you in the blue
      floor.visible = false;
      scene.background = new THREE.Color(0x0b3a5c);
      scene.fog = new THREE.Fog(0x0b3a5c, 8, 24);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 26, 32, 1, true, -Math.PI / 2, Math.PI), mat(0x7fd3f7, 0.1, { transparent: true, opacity: 0.12, side: THREE.DoubleSide }));
      tube.rotation.x = Math.PI / 2; tube.position.set(0, 0, -4); scene.add(tube);
      for (let z = 6; z > -16; z -= 2.4) { const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.05, 6, 32, Math.PI), mat(0x9ca3af, 0.4, { metalness: 0.6 })); ring.position.set(0, 0, z); scene.add(ring); }
      const walk = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 26), mat(0x334155, 0.8)); walk.position.set(0, 0.03, -4); scene.add(walk);
      const rock = (x: number, z: number, r: number, c: number) => { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat(c, 1, { flatShading: true })); m.position.set(x, -0.2, z); scene.add(m); };
      for (let i = 0; i < 10; i++) rock(i % 2 ? 4.2 + (i % 3) : -4.2 - (i % 3), 4 - i * 2.2, 0.8 + (i % 3) * 0.4, [0x5b6b7a, 0x6b5b4a, 0x7c3a4a][i % 3]!);
      for (let i = 0; i < 14; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9 + (i % 3) * 0.3, 5), mat([0xf472b6, 0xfb923c, 0xfacc15][i % 3]!, 0.8)); c.position.set((i % 2 ? 1 : -1) * (3.6 + (i % 4) * 0.5), 0.4, 3 - i * 1.3); scene.add(c); }
      const fishes: { m: THREE.Object3D; r: number; y: number; sp: number; ph: number }[] = [];
      const fish = (color: number, size: number) => {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), mat(color, 0.4, { emissive: color, emissiveIntensity: 0.25 })); body.scale.set(1.6, 1, 0.6); g.add(body);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(size * 0.7, size * 1.1, 4), mat(color, 0.4)); tail.rotation.z = Math.PI / 2; tail.position.x = -size * 1.8; g.add(tail);
        scene.add(g); return g;
      };
      for (let i = 0; i < 34; i++) fishes.push({ m: fish([0xfacc15, 0x38bdf8, 0xfb923c, 0xf472b6, 0xe2e8f0][i % 5]!, 0.12 + (i % 4) * 0.04), r: 3.8 + (i % 5) * 0.5, y: 0, sp: 0.25 + (i % 7) * 0.05, ph: i * 0.7 });
      const ray = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.12, 4), mat(0x6b7280, 0.5)); ray.scale.set(1, 1, 1.3); scene.add(ray);
      const shark = new THREE.Group(); scene.add(shark);
      const sb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), mat(0x8b9bab, 0.4)); sb.scale.set(3.4, 0.8, 0.8); shark.add(sb);
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 4), mat(0x8b9bab, 0.4)); fin.position.set(0.2, 0.6, 0); shark.add(fin);
      const tl = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.8, 4), mat(0x8b9bab, 0.4)); tl.rotation.z = Math.PI / 2; tl.position.x = -2.1; shark.add(tl);
      addGlow(0, 3.4, -2, 6, 0x7dd3fc, 0.35);
      ticks.push((t) => {
        fishes.forEach((f, i) => {
          const a = f.ph + t * f.sp * (i % 2 ? 1 : -1);
          f.m.position.set(Math.cos(a) * f.r, 1.2 + Math.sin(a) * f.r * 0.8 + Math.sin(t * 2 + i) * 0.1, -2 - (i % 6) * 1.6);
          f.m.rotation.set(0, i % 2 ? Math.PI / 2 : -Math.PI / 2, a + (i % 2 ? Math.PI / 2 : -Math.PI / 2));
        });
        ray.position.set(Math.sin(t * 0.25) * 2.5, 3.8 + Math.sin(t * 0.6) * 0.2, -2 - Math.cos(t * 0.25) * 2);
        ray.rotation.set(0.15 * Math.sin(t * 1.4), t * 0.25, 0);
        shark.position.set(((t * 1.6) % 24) - 12, 2.4 + Math.sin(t * 0.5) * 0.3, -5.5);
        shark.rotation.y = Math.sin(t * 2) * 0.05;
      });
    } else if (setKind === "turtle") {
      // 海龟湾: sea turtles crawl down the sand to the surf; hatchlings
      // scurry after them; waves roll in and out
      floor.visible = false;
      const sand = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), mat(0xe8d5a3, 1)); sand.rotation.x = -Math.PI / 2; sand.position.z = 3; sand.receiveShadow = true; scene.add(sand);
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), mat(0x2b86b7, 0.25, { metalness: 0.2 })); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.02, -19); scene.add(sea);
      const foams: THREE.Mesh[] = [];
      for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(40, 0.35), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })); f.rotation.x = -Math.PI / 2; f.position.set(0, 0.01, -4 - i * 1.5); scene.add(f); foams.push(f); }
      const turtle = (s: number) => {
        const g = new THREE.Group();
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.6 * s, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x5b6b3a, 0.7, { flatShading: true })); shell.scale.set(1, 0.55, 1.25); g.add(shell);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.17 * s, 10, 8), mat(0x8a8f5c, 0.7)); head.position.set(0, 0.12 * s, -0.85 * s); g.add(head);
        const flips: THREE.Mesh[] = [];
        for (const [x, z] of [[-0.62, -0.35], [0.62, -0.35], [-0.45, 0.55], [0.45, 0.55]] as const) { const fl = new THREE.Mesh(new THREE.BoxGeometry(0.45 * s, 0.04 * s, 0.2 * s), mat(0x8a8f5c, 0.7)); fl.position.set(x * s, 0.04 * s, z * s); g.add(fl); flips.push(fl); }
        g.castShadow = true; scene.add(g);
        return { g, flips };
      };
      const adults = [turtle(1), turtle(0.85), turtle(0.95)];
      const babies = Array.from({ length: 10 }, () => turtle(0.22));
      ticks.push((t) => {
        foams.forEach((f, i) => { f.position.z = -4 - i * 1.5 + Math.sin(t * 0.9 + i) * 0.6; (f.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.3 * Math.sin(t * 0.9 + i); });
        adults.forEach((a, i) => {
          const z = 3.5 - ((t * 0.28 + i * 2.1) % 7.5);
          a.g.position.set(-3.2 + i * 3.2, 0.02, z);
          a.flips.forEach((fl, k) => { fl.rotation.y = Math.sin(t * 3 + k) * 0.5; });
        });
        babies.forEach((b, i) => {
          const z = 4 - ((t * 0.9 + i * 0.73) % 8);
          b.g.position.set(-4.5 + (i % 5) * 2.1 + Math.sin(t * 2 + i) * 0.15, 0.01, z);
          b.flips.forEach((fl, k) => { fl.rotation.y = Math.sin(t * 9 + k + i) * 0.7; });
        });
      });
    }

    if (setKind === "coaster") {
      // 过山车: riding the front car — the track climbs, drops and loops;
      // the world tilts and rushes past
      floor.visible = false;
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat(0x6aa35a, 1)); ground.rotation.x = -Math.PI / 2; ground.position.y = -6; scene.add(ground);
      const world = new THREE.Group(); scene.add(world);
      for (let i = 0; i < 26; i++) { const tr = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 7), mat(0x3f8f4e, 1, { flatShading: true })); tr.position.set(-20 + (i * 7) % 40, -4.8, -6 - (i * 11) % 30); world.add(tr); }
      for (let i = 0; i < 8; i++) { const tw = new THREE.Mesh(new THREE.BoxGeometry(2, 4 + (i % 3) * 3, 2), mat(0xc9d4dc, 0.6)); tw.position.set(-18 + i * 5, -4 + (i % 3) * 1.5, -24); world.add(tw); }
      const rail = mat(0x2563eb, 0.4, { metalness: 0.6 });
      for (let i = 0; i < 40; i++) { const tie = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.18), mat(0x6b7280)); tie.position.set(0, -0.6, 2 - i * 1.1); world.add(tie); }
      for (const x of [-0.9, 0.9]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 46), rail); r.position.set(x, -0.5, -20); world.add(r); }
      const loop = new THREE.Mesh(new THREE.TorusGeometry(5, 0.14, 8, 48), rail); loop.position.set(4, 3, -18); loop.rotation.y = Math.PI / 2; world.add(loop);
      const car = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 2.2), mat(0xdc2626, 0.5)); car.position.set(0, -0.15, -0.3); scene.add(car);
      const bar = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 16, Math.PI), mat(0xfacc15, 0.4)); bar.position.set(0, 0.6, 0.35); scene.add(bar);
      ticks.push((t) => {
        world.position.z = (t * 6) % 22;
        world.rotation.x = Math.sin(t * 0.9) * 0.22;
        world.rotation.z = Math.sin(t * 0.6) * 0.12;
        world.position.y = Math.sin(t * 0.9) * 1.6;
      });
    } else if (setKind === "safari") {
      // 野生动物园: riding the caged safari bus past giraffes, zebras and a lion
      floor.visible = false;
      const grass = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), mat(0xb7c56a, 1)); grass.rotation.x = -Math.PI / 2; grass.position.y = -0.5; scene.add(grass);
      const bus = new THREE.Group(); scene.add(bus);
      const fl = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 3.4), mat(0x4b5563)); fl.position.set(0, -0.1, 0.2); bus.add(fl);
      for (let x = -3.8; x <= 3.8; x += 0.45) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.6, 0.05), mat(0x3f3f46, 0.4, { metalness: 0.6 })); bar.position.set(x, 1.3, -1.5); bus.add(bar); }
      for (const y of [0.9, 2.6]) { const h = new THREE.Mesh(new THREE.BoxGeometry(8, 0.06, 0.06), mat(0x3f3f46, 0.4, { metalness: 0.6 })); h.position.set(0, y, -1.5); bus.add(h); }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(8, 0.12, 3.4), mat(0x556b2f)); roof.position.set(0, 2.7, 0.2); bus.add(roof);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6), mat(0x78350f)); seat.position.set(0, 0.45, -0.75); bus.add(seat);
      const savanna = new THREE.Group(); scene.add(savanna);
      const animal = (kind: "giraffe" | "zebra" | "lion", x: number, z: number) => {
        const g = new THREE.Group();
        const col = kind === "giraffe" ? 0xe0a43a : kind === "zebra" ? 0xf1f1f1 : 0xc8913d;
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.6), mat(col, 0.8)); body.position.y = kind === "giraffe" ? 1.6 : 0.9; g.add(body);
        for (const lx of [-0.5, 0.5]) for (const lz of [-0.2, 0.2]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, kind === "giraffe" ? 1.3 : 0.7, 0.14), mat(col)); leg.position.set(lx, (kind === "giraffe" ? 0.65 : 0.35), lz); g.add(leg); }
        if (kind === "giraffe") { const neck = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.6, 0.25), mat(col)); neck.position.set(0.65, 2.6, 0); neck.rotation.z = -0.25; g.add(neck); const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.25), mat(col)); head.position.set(0.95, 3.4, 0); g.add(head); }
        else { const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), mat(kind === "lion" ? 0x8a5a2b : col)); head.position.set(0.85, 1.15, 0); g.add(head); }
        if (kind === "zebra") for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.62), mat(0x111111)); st.position.set(-0.5 + i * 0.3, 0.9, 0); g.add(st); }
        if (kind === "lion") { const mane = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), mat(0x7c4a1e, 1, { flatShading: true })); mane.position.set(0.75, 1.15, 0); g.add(mane); }
        g.position.set(x, -0.5, z); savanna.add(g);
      };
      for (let i = 0; i < 12; i++) animal((["giraffe", "zebra", "lion", "zebra"] as const)[i % 4]!, -24 + i * 4.2, -5 - (i % 3) * 2.5);
      for (let i = 0; i < 16; i++) { const tr = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), mat(0x6b8e23, 1, { flatShading: true })); tr.scale.y = 0.5; tr.position.set(-30 + i * 4, 2.2, -12 - (i % 2) * 3); savanna.add(tr); const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.4, 6), mat(0x6b4630)); tk.position.set(-30 + i * 4, 0.7, -12 - (i % 2) * 3); savanna.add(tk); }
      ticks.push((t) => { savanna.position.x = ((t * 1.6) % 24) - 6; bus.position.y = Math.abs(Math.sin(t * 4)) * 0.03; });
    } else if (setKind === "hike") {
      // 登山: stone steps up a forested ridge to a summit pavilion, the
      // city spread out below in the haze
      floor.visible = false;
      const slope = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), mat(0x5d8a4f, 1, { flatShading: true })); slope.rotation.x = -Math.PI / 2 + 0.25; slope.position.set(0, -0.6, -2); scene.add(slope);
      for (let i = 0; i < 14; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 0.6), mat(0xb8b2a6, 0.9)); st.position.set(0, -0.4 + i * 0.16, 2 - i * 0.55); scene.add(st); }
      for (let i = 0; i < 22; i++) { const tr = new THREE.Mesh(new THREE.ConeGeometry(0.7 + (i % 3) * 0.2, 2 + (i % 4) * 0.4, 7), mat(i % 2 ? 0x3f7d46 : 0x4d9b5f, 1, { flatShading: true })); tr.position.set((i % 2 ? 1 : -1) * (2 + (i % 5) * 1.1), 0.6 + Math.floor(i / 2) * 0.25, 1.5 - Math.floor(i / 2) * 0.8); scene.add(tr); }
      const pav = new THREE.Group(); pav.position.set(0, 2.1, -6.5); scene.add(pav);
      for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]] as const) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8), mat(0xb91c1c)); c.position.set(x, 0.8, z); pav.add(c); }
      const pr = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.9, 4), mat(0x7f1d1d, 0.7, { flatShading: true })); pr.rotation.y = Math.PI / 4; pr.position.y = 2; pav.add(pr);
      const mist: THREE.Mesh[] = [];
      for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false })); m.position.set(-12 + i * 5, 1 + (i % 3) * 0.8, -8); scene.add(m); mist.push(m); }
      ticks.push((t) => { mist.forEach((m, i) => { m.position.x = ((-12 + i * 5 + t * 0.6) % 30 + 30) % 30 - 15; }); });
    } else if (setKind === "beach") {
      // 海边: sand, umbrellas, waves rolling in, gulls overhead
      floor.visible = false;
      const sand = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), mat(0xf0deb0, 1)); sand.rotation.x = -Math.PI / 2; sand.position.z = 3; sand.receiveShadow = true; scene.add(sand);
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), mat(0x2e9fd0, 0.2, { metalness: 0.25 })); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.02, -19); scene.add(sea);
      const foams: THREE.Mesh[] = [];
      for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(40, 0.4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 })); f.rotation.x = -Math.PI / 2; f.position.set(0, 0.01, -4 - i * 1.4); scene.add(f); foams.push(f); }
      for (const [x, z, c] of [[-3.2, 0.5, 0xef4444], [3.4, 0.2, 0xf59e0b], [6.5, 1.2, 0x22c55e]] as const) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), mat(0xe5e7eb)); pole.position.set(x, 1.1, z); scene.add(pole);
        const top = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.5, 10), mat(c, 0.7)); top.position.set(x, 2.3, z); scene.add(top);
        const towel = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 1.6), mat(c === 0xef4444 ? 0x60a5fa : 0xfde68a)); towel.position.set(x + 0.4, 0.02, z + 1.2); scene.add(towel);
      }
      const gulls: THREE.Mesh[] = [];
      for (let i = 0; i < 4; i++) { const g = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 3), mat(0xffffff)); g.rotation.z = Math.PI / 2; scene.add(g); gulls.push(g); }
      ticks.push((t) => {
        foams.forEach((f, i) => { f.position.z = -4 - i * 1.4 + Math.sin(t * 0.8 + i) * 0.7; (f.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.3 * Math.sin(t * 0.8 + i); });
        gulls.forEach((g, i) => { g.position.set(((t * (1 + i * 0.3) + i * 6) % 30) - 15, 4 + Math.sin(t * 2 + i) * 0.4 + i * 0.4, -5 - i); g.scale.y = 1 + Math.sin(t * 8 + i) * 0.4; });
      });
    } else if (setKind === "cablecar") {
      // 缆车: a gondola gliding up the hillside, the bay opening below
      floor.visible = false;
      const gond = new THREE.Group(); scene.add(gond);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 2.4), mat(0xbfe3f5, 0.1, { transparent: true, opacity: 0.16, side: THREE.DoubleSide })); cab.position.set(0, 1.2, -0.2); gond.add(cab);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.12, 2.5), mat(0xdc2626, 0.5)); frame.position.set(0, -0.05, -0.2); gond.add(frame);
      const top = frame.clone(); top.position.y = 2.5; gond.add(top);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.6), mat(0x374151)); seat.position.set(0, 0.45, -0.75); gond.add(seat);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 60, 6), mat(0x111827)); cable.rotation.z = Math.PI / 2 - 0.25; cable.position.set(0, 4.2, -0.2); scene.add(cable);
      const land = new THREE.Group(); scene.add(land);
      for (let i = 0; i < 30; i++) { const h = new THREE.Mesh(new THREE.ConeGeometry(3 + (i % 4), 3 + (i % 5) * 1.2, 7), mat(i % 2 ? 0x4d8a4f : 0x5d9a5a, 1, { flatShading: true })); h.position.set(-30 + (i % 10) * 6.5, -5, -6 - Math.floor(i / 10) * 7); land.add(h); }
      const bay = new THREE.Mesh(new THREE.PlaneGeometry(80, 30), mat(0x3b8fc4, 0.25)); bay.rotation.x = -Math.PI / 2; bay.position.set(0, -6.4, -34); land.add(bay);
      ticks.push((t) => { land.position.x = -t * 0.8 % 40; land.position.y = -Math.min(4, t * 0.4); gond.rotation.z = Math.sin(t * 0.8) * 0.02; });
    }

    /* ---- the actor ---- */
    const actor = makeFigure(mat, shirt, pants);
    const face = faceSprite(emoji);
    face.position.y = 2.42;
    actor.g.add(face);
    scene.add(actor.g);

    // barbell for the lift pose
    const barbell = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 8), mat(0x9aa3ad, 0.3, { metalness: 0.7 }));
    bar.rotation.z = Math.PI / 2;
    barbell.add(bar);
    for (const sx of [-0.78, 0.78]) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.09, 14), mat(0x2e3440, 0.5));
      disc.rotation.z = Math.PI / 2;
      disc.position.x = sx;
      disc.castShadow = true;
      barbell.add(disc);
    }
    barbell.visible = false;
    scene.add(barbell);
    // spatula in the right hand while cooking; chopsticks while eating
    const spatula = new THREE.Group();
    const spHandle = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.34, 0.045), mat(0x8a5a3b, 0.7));
    spHandle.position.y = -0.14; spatula.add(spHandle);
    const spHead = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.03), mat(0x3c4148, 0.4, { metalness: 0.5 }));
    spHead.position.y = -0.36; spatula.add(spHead);
    spatula.position.y = -0.68;
    spatula.visible = pose === "cook";
    actor.armR.add(spatula);
    const chopsticks = new THREE.Group();
    for (const co of [-0.03, 0.03]) {
      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.3, 0.022), mat(0x8a5a3b, 0.7));
      stick.position.set(co, -0.13, 0.02);
      chopsticks.add(stick);
    }
    chopsticks.position.y = -0.68;
    chopsticks.visible = pose === "eat";
    actor.armR.add(chopsticks);
    const phoneProp = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.3, 0.04), mat(0x14202b, 0.3, { emissive: 0x7dd3fc, emissiveIntensity: 0.6 }));
    phoneProp.position.y = -0.72;
    phoneProp.visible = pose === "sit";
    actor.armR.add(phoneProp);

    if (pose === "sleep") {
      for (let i = 0; i < 3; i++) {
        const tex = canvasTex(48, 48, (g) => {
          g.font = "900 34px sans-serif";
          g.fillStyle = "#dbeafe";
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText("Z", 24, 26);
        });
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
        sp.userData.phase = i / 3;
        scene.add(sp);
        zzzSprites.push(sp);
      }
    }
    if (washStream) washStream.visible = pose === "wash";

    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      fx?.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // camera framing per set: where the action happens
    const lookMap: Partial<Record<LifeSet, [number, number, number]>> = {
      bedroom: [-0.6, 1.0, -1.5],
      bathroom: [0.2, 1.3, -1.7],
      kitchen: [-0.2, 1.2, -1.2],
      metro: [0, 1.35, -1.1],
      train: [0, 1.35, -1.1],
      bus: [0, 1.35, -1.1],
      taxi: [0, 1.3, -1.15],
      drive: [-0.3, 1.3, -1.15],
      station: [0, 1.5, -1.0],
      concourse: [0, 1.35, -0.9],
      platform: [0, 1.4, -0.9],
    };
    const look: [number, number, number] = lookMap[setKind] ?? [0, 1.18, -0.7];
    const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
    const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

    /* ---- real-photo backdrop: the acted scene plays in front of / inside
       a REAL photograph of the real place (Shenzhen Bay Park at sunset, a
       Line 11 business carriage, Shenzhen North Station at night, Dongmen
       after dark…). A large photo plane hangs behind the set; indoor sets
       also get the photo textured onto their dominant back wall, so the
       room itself becomes the photograph and the 3D figure acts inside
       it. Sets without a verified photo keep their built 3D backdrop. */
    const photoUrl = SCENE_PHOTOS[setKind];
    if (photoUrl) {
      const ptex = new THREE.TextureLoader().load(photoUrl);
      ptex.colorSpace = THREE.SRGBColorSpace;
      const backdrop = new THREE.Mesh(
        new THREE.PlaneGeometry(38, 19),
        new THREE.MeshBasicMaterial({ map: ptex, toneMapped: false, fog: false }),
      );
      backdrop.position.set(0, 5.4, -11.5);
      scene.add(backdrop);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const params = (o.geometry as THREE.BoxGeometry).parameters as { width?: number; depth?: number } | undefined;
          if (params && (params.width ?? 0) >= 15 && (params.depth ?? 99) <= 0.4 && o.position.z < -3) {
            o.material = new THREE.MeshBasicMaterial({ map: ptex, toneMapped: false });
          }
        }
      });
    }

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const t = (now - start) / 1000;
      for (const tick of ticks) tick(t);
      // camera: eased push-in that completes inside the step + gentle drift
      const push = easeOut(clamp01(t / 1.7));
      const startDist = pose === "walk" ? 9.6 : 7.6;
      const dist = startDist - push * 1.5;
      const sway = Math.sin(t * 0.35) * 0.45;
      const vib = setKind === "metro" || setKind === "station" || setKind === "train" || setKind === "bus" || setKind === "taxi" || setKind === "drive" ? Math.sin(t * 34) * 0.008 : 0;
      camera.position.set(sway, 3.15 - push * 0.55 + vib, dist);
      camera.lookAt(look[0], look[1], look[2]);

      // reset actor to a neutral stance, then apply the pose
      const A = actor;
      A.g.rotation.set(0, 0, 0);
      A.g.position.set(0, 0, 0);
      A.legL.rotation.x = 0; A.legR.rotation.x = 0;
      A.armL.rotation.set(0, 0, 0); A.armR.rotation.set(0, 0, 0);
      A.head.rotation.set(0, 0, 0);
      A.torso.scale.set(1, 1, 1);
      A.head.position.y = 1.86;

      if (pose === "walk") {
        // one eased crossing per step: strides are tied to distance covered,
        // so the feet slow down exactly when the body does — no sliding.
        const dur = 2.1;
        const u = clamp01(t / dur);
        const x = -3.5 + easeInOut(u) * 6.25;
        const env = u >= 1 ? Math.max(0, 1 - (t - dur) / 0.3) : 0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, u * 1.12));
        const phase = (x + 3.5) * 2.05;
        const swing = Math.sin(phase) * 0.62 * env;
        A.g.position.set(x, Math.abs(Math.cos(phase)) * 0.07 * env, setKind === "metro" ? -0.15 : 0.55);
        A.g.rotation.y = Math.PI / 2;
        A.g.rotation.x = 0.05 * env;
        A.legL.rotation.x = swing;
        A.legR.rotation.x = -swing;
        A.armL.rotation.x = -swing * 0.8;
        A.armR.rotation.x = swing * 0.8;
      } else if (pose === "type") {
        A.g.position.set(0.4, -0.52, 0.42);
        A.g.rotation.y = Math.PI;
        A.legL.rotation.x = -1.35; A.legR.rotation.x = -1.35;
        const tap = Math.sin(t * 15) * 0.16;
        A.armL.rotation.x = -1.15 + tap;
        A.armR.rotation.x = -1.15 - tap;
        A.g.rotation.x = 0.1 + Math.sin(t * 2.2) * 0.015;
        A.head.rotation.x = 0.1 + Math.sin(t * 0.9) * 0.035;
      } else if (pose === "cook") {
        A.g.position.set(-1.0, 0, -1.0);
        A.g.rotation.y = Math.PI;
        A.armR.rotation.x = -0.95 + Math.sin(t * 5.2) * 0.3;
        A.armR.rotation.z = Math.cos(t * 5.2) * 0.3;
        A.armL.rotation.x = -0.72;
        A.g.position.y = Math.sin(t * 2.6) * 0.02;
        A.g.rotation.z = Math.sin(t * 2.6) * 0.02;
      } else if (pose === "eat") {
        if (setKind === "kitchen") { A.g.position.set(2.7, -0.52, 1.5); }
        else { A.g.position.set(0.55, -0.52, 0.42); }
        A.g.rotation.y = Math.PI;
        A.legL.rotation.x = -1.35; A.legR.rotation.x = -1.35;
        const bite = (Math.sin(t * 2.4) + 1) / 2;
        A.armR.rotation.x = -0.5 - bite * 0.85;
        A.armL.rotation.x = -0.88;
        A.head.position.y = 1.86 - bite * 0.05;
        A.head.rotation.x = bite * 0.12;
      } else if (pose === "sleep") {
        A.g.position.set(-1.1, 0.68, -1.05);
        A.g.rotation.x = -Math.PI / 2 + 0.1;
        A.g.rotation.z = 0.04;
        const br = Math.sin(t * 1.4) * 0.03;
        A.torso.scale.set(1, 1 + br, 1);
        A.armL.rotation.x = 0.25; A.armR.rotation.x = 0.25;
        A.legL.rotation.x = 0.06; A.legR.rotation.x = -0.04;
        for (const sp of zzzSprites) {
          const ph = ((t * 0.3 + (sp.userData.phase as number)) % 1);
          sp.position.set(-0.6 + ph * 0.7, 1.35 + ph * 1.1, -2.75);
          sp.scale.setScalar(0.3 + ph * 0.45);
          (sp.material as THREE.SpriteMaterial).opacity = Math.sin(ph * Math.PI);
        }
      } else if (pose === "wash") {
        A.g.position.set(0.2, 0, -2.05);
        A.g.rotation.y = Math.PI;
        const rub = Math.sin(t * 7) * 0.22;
        A.armL.rotation.x = -1.9 + rub;
        A.armR.rotation.x = -1.9 - rub;
        A.head.rotation.x = 0.14 + Math.sin(t * 3.5) * 0.03;
        A.head.position.y = 1.86 + Math.sin(t * 3.5) * 0.02;
      } else if (pose === "talk") {
        A.g.position.set(-0.25, 0, 0.6);
        A.g.rotation.y = Math.PI / 2 * 0.75;
        A.armL.rotation.x = -0.35 + Math.sin(t * 3.3 + 1) * 0.25;
        A.head.rotation.x = Math.sin(t * 2.4) * 0.05;
        A.head.rotation.y = Math.sin(t * 0.8) * 0.1;
      } else if (pose === "sing") {
        // on the stage, mic in hand, swaying to the beat
        A.g.position.set(0.6, 0.47 + Math.abs(Math.sin(t * 3.2)) * 0.04, -1.55);
        A.g.rotation.y = Math.sin(t * 1.6) * 0.25;
        A.armR.rotation.x = -2.0 + Math.sin(t * 3.2) * 0.12; A.armR.rotation.z = -0.35;
        A.armL.rotation.x = -0.6 - Math.max(0, Math.sin(t * 1.1)) * 1.6; A.armL.rotation.z = 0.3;
        A.head.rotation.x = -0.12 + Math.sin(t * 3.2) * 0.05;
      } else if (pose === "dance") {
        const b = Math.abs(Math.sin(t * 6.4));
        A.g.position.set(0, b * 0.14, 0.55);
        A.g.rotation.y = Math.PI + Math.sin(t * 1.6) * 0.5;
        A.armL.rotation.x = -2.5 + Math.sin(t * 6.4) * 0.3; A.armR.rotation.x = -2.5 - Math.sin(t * 6.4) * 0.3;
        A.legL.rotation.x = Math.sin(t * 6.4) * 0.25; A.legR.rotation.x = -Math.sin(t * 6.4) * 0.25;
      } else if (pose === "lift") {
        A.g.position.set(0.3, 0, 0.2);
        const liftPh = (Math.sin(t * 1.9) + 1) / 2;
        barbell.visible = true;
        barbell.position.set(0.3, 0.75 + liftPh * 0.95, 0.2);
        barbell.rotation.z = Math.sin(t * 7) * 0.02 * liftPh;
        A.armL.rotation.x = -0.4 - liftPh * 2.2;
        A.armR.rotation.x = -0.4 - liftPh * 2.2;
        A.legL.rotation.x = 0.12; A.legR.rotation.x = -0.12;
        A.g.position.y = -liftPh * 0.06;
      } else if (pose === "sit") {
        // seated on the carriage bench, phone in hand, city rushing past
        if (setKind === "taxi") A.g.position.set(0.55, -0.3 + Math.sin(t * 1.8) * 0.008, -1.08);
        else if (setKind === "cruise" || setKind === "wheel" || setKind === "safari" || setKind === "cablecar") A.g.position.set(0, -0.05 + Math.sin(t * 1.3) * 0.02, -0.6);
        else if (setKind === "coaster") A.g.position.set(0, 0.05 + Math.sin(t * 9) * 0.03, -0.4);
        else A.g.position.set(0.95, -0.28 + Math.sin(t * 1.8) * 0.008, -1.9);
        // alive while seated: eyes drift between the window and the phone
        A.head.rotation.y = Math.sin(t * 0.45) * 0.24;
        A.head.rotation.x = 0.14 + Math.max(0, Math.sin(t * 0.45 + 1.2)) * 0.12;
        A.legL.rotation.x = -1.35; A.legR.rotation.x = -1.3;
        A.armL.rotation.x = -0.5;
        A.armR.rotation.x = -0.85 + Math.sin(t * 6) * 0.05;
        A.head.rotation.x = 0.14;
      } else if (pose === "drive") {
        // behind the wheel: seated in the driver's seat, both hands up on
        // the wheel, small steering corrections, eyes flicking between the
        // road ahead and the mirrors — driving, not posing.
        A.g.position.set(-0.95, -0.3 + Math.sin(t * 1.8) * 0.008, -1.12);
        A.legL.rotation.x = -1.32; A.legR.rotation.x = -1.22;
        const steer = Math.sin(t * 0.7) * 0.09 + Math.sin(t * 2.3) * 0.03;
        A.armL.rotation.x = -0.98 + steer * 0.4;
        A.armR.rotation.x = -0.98 - steer * 0.4;
        A.armL.rotation.z = 0.22 + steer;
        A.armR.rotation.z = -0.22 + steer;
        A.g.rotation.x = 0.06;
        A.head.rotation.y = Math.sin(t * 0.4) * 0.3;
        A.head.rotation.x = 0.05 + Math.max(0, Math.sin(t * 0.4 + 1.4)) * 0.05;
      } else if (pose === "stretch") {
        // just woke up: both arms reach overhead, spine lengthens, a
        // little rise onto the toes, then settles — the morning stretch
        A.g.position.set(0.2, 0, 0.3);
        A.g.rotation.y = Math.PI;
        const reach = Math.min(1, t / 0.7) * (0.82 + Math.sin(Math.min(1, Math.max(0, (t - 0.7) / 1.4)) * Math.PI) * 0.18);
        A.armL.rotation.x = -2.95 * reach;
        A.armR.rotation.x = -2.95 * reach;
        A.armL.rotation.z = 0.35 * reach;
        A.armR.rotation.z = -0.35 * reach;
        A.torso.scale.set(1, 1 + 0.05 * reach, 1);
        A.g.position.y = 0.045 * reach;
        A.head.rotation.x = -0.14 * reach;
        A.head.position.y = 1.86 + 0.03 * reach;
      } else {
        // idle: placed per set, breathing + an occasional glance around
        if (setKind === "office") { A.g.position.set(2.05, 0, 0.95); A.g.rotation.y = Math.PI * 0.92; }
        else if (setKind === "market") { A.g.position.set(0.2, 0, 0.25); A.g.rotation.y = Math.PI; }
        else if (setKind === "station") { A.g.position.set(0.2, 0, 0.55); A.g.rotation.y = Math.PI; }
        else if (setKind === "concourse") { A.g.position.set(-0.05, 0, 0.55); A.g.rotation.y = Math.PI / 2; }
        else if (setKind === "platform") { A.g.position.set(0.2, 0, 0.55); A.g.rotation.y = Math.PI; }
        else { A.g.position.set(0.2, 0, 0.3); }
        const swayA = Math.sin(t * 1.6) * 0.045;
        A.armL.rotation.x = swayA;
        A.armR.rotation.x = -swayA;
        A.g.position.y = Math.sin(t * 1.6) * 0.015;
        A.head.rotation.y = Math.sin(t * 0.45) * 0.16;
      }
      face.visible = pose !== "sleep";

      // ambient life: extras breathe, colleagues type, lanterns sway,
      // carriage lights streak past, dust drifts, the stove flame flickers
      for (const b of bobbers) b.g.rotation.z = Math.sin(t * 1.5 + b.ph) * 0.012;
      for (const tp of tapers) {
        const tap = Math.sin(t * 13 + tp.ph) * 0.15;
        tp.f.armL.rotation.x = -1.12 + tap;
        tp.f.armR.rotation.x = -1.12 - tap;
      }
      for (const st of streaks) {
        const rel = ((t * st.sp + st.off) % (st.hw * 2)) - st.hw;
        st.m.position.x = st.c + rel;
        (st.m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + Math.max(0, 1 - Math.abs(rel) / st.hw) * 0.9;
      }
      for (const sw of swayers) sw.g.rotation.z = Math.sin(t * 1.3 + sw.ph) * 0.05;
      for (const sp of spinners) sp.rotation.y = t * 0.8;
      if (talker) {
        // walks in from the right, then talks with their hands
        const u = clamp01(t / 1.1);
        talker.g.position.x = 3.2 - easeInOut(u) * 2.15;
        const sw = u < 1 ? Math.sin(t * 9) * 0.5 : 0;
        talker.legL.rotation.x = sw; talker.legR.rotation.x = -sw;
        if (u >= 1) { talker.armR.rotation.x = -0.9 + Math.sin(t * 4.2) * 0.35; talker.armR.rotation.z = Math.sin(t * 2.1) * 0.2; talker.head.rotation.x = Math.sin(t * 3.1) * 0.06; talker.armL.rotation.x = -0.3; }
      }
      for (const d of dancers) { const b = Math.abs(Math.sin(t * 6.4 + d.ph)); d.f.g.position.y = d.y + b * 0.12; d.f.g.rotation.z = Math.sin(t * 3.2 + d.ph) * 0.06; }
      for (const cl of clubLights) { cl.l.intensity = 6 + Math.max(0, Math.sin(t * 3.2 + cl.ph)) * 22; cl.l.position.x += Math.sin(t * 0.9 + cl.ph) * 0.02; }
      for (const mo of motes) {
        mo.sp.position.y += Math.sin(t * 0.6 + mo.ph) * 0.0009;
        mo.sp.position.x = (mo.sp.userData.x as number) + Math.sin(t * 0.25 + mo.ph) * 0.3;
      }
      if (flameLight) flameLight.intensity = 4.4 + Math.sin(t * 23) * 0.9 + Math.sin(t * 7.3) * 0.7;
      // traffic lights cycle like the real thing: red, a breath, green,
      // amber, red again — the driver waits through it in the drive set
      for (const tl of tlights) {
        const cyc = (t + tl.off) % 7;
        tl.red.emissiveIntensity = cyc < 3 ? 2.6 : 0.12;
        tl.grn.emissiveIntensity = cyc >= 3.4 && cyc < 6.2 ? 2.6 : 0.12;
        tl.yel.emissiveIntensity = cyc >= 3 && cyc < 3.4 ? 2.6 : cyc >= 6.2 ? 2.6 : 0.12;
      }
      for (const tex of codeTexs) tex.offset.y = (t * 0.14) % 1;
      for (const tex of scrollTexs) tex.offset.x = -((t * 0.45) % 1);
      for (const sp of steamSprites) {
        const ph = ((t * 0.45 + (sp.userData.phase as number)) % 1);
        sp.position.set((sp.userData.x as number) + Math.sin(ph * 5) * 0.12, (sp.userData.y as number) + ph * 0.85, sp.userData.z as number);
        sp.scale.setScalar(0.35 + ph * 0.75);
        (sp.material as THREE.SpriteMaterial).opacity = 0.42 * Math.sin(ph * Math.PI);
      }
      if (fx) fx.render();
      else renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      fx?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
          (o as THREE.Mesh).geometry?.dispose?.();
          const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[];
          const disposeMat = (x: THREE.Material) => {
            const withMap = x as THREE.MeshStandardMaterial;
            withMap.map?.dispose?.();
            x.dispose();
          };
          if (Array.isArray(m)) m.forEach(disposeMat);
          else if (m) disposeMat(m);
        }
      });
    };
  }, []);

  if (glFailed) {
    return (
      <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
        <span style={{ fontSize: 84, filter: "drop-shadow(0 12px 10px rgba(50,25,5,.35))" }}>{p.emoji}</span>
      </div>
    );
  }
  return <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />;
}
