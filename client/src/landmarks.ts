/* 地标缩影 — low-poly miniatures of the real buildings and places.

   Every playable location used to be the same box + pyramid roof. Here each
   one gets a small model of what is really there: 平安金融中心's tapered
   tower, 春茧's lattice cocoon, the 口岸 inspection halls with their lane
   canopies, 城中村 handshake buildings, beaches with umbrellas, mountain
   parks with trails and a summit pavilion …

   Performance: a model is built from many primitives, but parts are merged
   per material (BufferGeometryUtils.mergeGeometries), and materials are
   shared across all models, so a landmark costs a handful of draw calls. */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CityKey, Loc } from "./data";
import { SZ_METRO_LINES } from "./metro-sz";
import { SZ_PLACES } from "./places-sz";

export interface BuiltLandmark {
  group: THREE.Group;
  /** Height of the model's top (for the label and the APEC flag). */
  top: number;
  /** Groups that turn about their local z axis (ferris wheels). */
  spin: THREE.Object3D[];
}
export interface DecorLandmark extends BuiltLandmark { x: number; z: number; r: number; name: string; ry?: number }

interface MatOpts { double?: boolean; rough?: number; metal?: number; flat?: boolean; wire?: boolean; glass?: boolean; neon?: boolean; opacity?: number; emissive?: number }

class Kit {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): this {
    this.m4.compose(this.p.set(x, y, z), this.q.setFromEuler(this.e.set(rx, ry, rz)), this.s.set(sx, sy, sz));
    geo.applyMatrix4(this.m4);
    const arr = this.parts.get(mat) ?? [];
    arr.push(geo.index ? geo.toNonIndexed() : geo);
    this.parts.set(mat, arr);
    return this;
  }
  /** Box standing on y0. */
  box(mat: THREE.Material, w: number, h: number, d: number, x: number, y0: number, z: number, ry = 0): this {
    return this.add(new THREE.BoxGeometry(w, h, d), mat, x, y0 + h / 2, z, 0, ry);
  }
  /** Cylinder / frustum standing on y0. */
  cyl(mat: THREE.Material, rTop: number, rBot: number, h: number, x: number, y0: number, z: number, seg = 12, ry = 0): this {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat, x, y0 + h / 2, z, 0, ry);
  }
  cone(mat: THREE.Material, r: number, h: number, x: number, y0: number, z: number, seg = 8, ry = 0, sx = 1, sz = 1): this {
    return this.add(new THREE.ConeGeometry(r, h, seg), mat, x, y0 + h / 2, z, 0, ry, 0, sx, 1, sz);
  }
  ball(mat: THREE.Material, r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, seg = 12): this {
    return this.add(new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)), mat, x, y, z, 0, 0, 0, sx, sy, sz);
  }
  torus(mat: THREE.Material, R: number, t: number, x: number, y: number, z: number, rx = 0, ry = 0, seg = 32): this {
    return this.add(new THREE.TorusGeometry(R, t, 6, seg), mat, x, y, z, rx, ry);
  }
  /** Merge everything into one mesh per material and add it to `g`. */
  into(g: THREE.Object3D, shadows = true): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (const [mat, geos] of this.parts) {
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      const wire = (mat as THREE.MeshStandardMaterial).wireframe;
      mesh.castShadow = shadows && !wire;
      mesh.receiveShadow = !wire;
      g.add(mesh);
      out.push(mesh);
      geos.forEach((x) => x.dispose());
    }
    this.parts.clear();
    return out;
  }
}

/** The factory. `winTex` is the lit-windows texture; materials that should
    glow after dark are collected in `litMats` (windows) and `neonMats`
    (signs / LED walls) for the map's day–night loop. */
export function createLandmarks(winTex: THREE.Texture) {
  const litMats: THREE.MeshStandardMaterial[] = [];
  const neonMats: THREE.MeshStandardMaterial[] = [];
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  const M = (color: number, o: MatOpts = {}): THREE.MeshStandardMaterial => {
    const key = `${color}|${JSON.stringify(o)}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.rough ?? 0.85,
      metalness: o.metal ?? 0,
      flatShading: o.flat ?? false,
      wireframe: o.wire ?? false,
      transparent: o.opacity !== undefined,
      opacity: o.opacity ?? 1,
      side: o.double ? THREE.DoubleSide : THREE.FrontSide,
    });
    if (o.glass) { m.emissive.setHex(0xffc873); m.emissiveMap = winTex; m.emissiveIntensity = 0; litMats.push(m); }
    else if (o.neon) { m.emissive.setHex(o.emissive ?? color); m.emissiveIntensity = 0.35; neonMats.push(m); }
    else if (o.emissive !== undefined) { m.emissive.setHex(o.emissive); m.emissiveIntensity = 0.6; }
    cache.set(key, m);
    return m;
  };

  /* ---- palette ---- */
  const WHITE = M(0xf3f1ea, { rough: 0.6 });
  const CONCRETE = M(0xd9d2c3);
  const PAVE = M(0xcfc6b2);
  const DARK = M(0x2b3138, { rough: 0.6 });
  const STEEL = M(0xc9d3da, { rough: 0.35, metal: 0.6 });
  const GOLD = M(0xe0b04a, { rough: 0.35, metal: 0.7 });
  const RED = M(0xd23a2a, { rough: 0.6 });
  const WOOD = M(0x8b5a34);
  const ROOF_TILE = M(0x6b3a26, { flat: true });
  const ROOF_GOLD = M(0xd9a33a, { flat: true, rough: 0.5, metal: 0.3 });
  const GRASS = M(0x79b860, { rough: 1 });
  const GRASS_D = M(0x5c9a4c, { rough: 1 });
  const LEAF = M(0x3f8a4a, { flat: true, rough: 1 });
  const LEAF_L = M(0x5fae55, { flat: true, rough: 1 });
  const TRUNK = M(0x6e4b2e);
  const SAND = M(0xeedcae, { rough: 1 });
  const WATER = M(0x3f9fd0, { rough: 0.15, metal: 0.2, opacity: 0.92 });
  const ROCK = M(0x9a958a, { flat: true, rough: 1 });
  const glass = (c: number) => M(c, { glass: true, rough: 0.3, metal: 0.45 });
  const neon = (c: number) => M(0x16121a, { neon: true, emissive: c, rough: 0.5 });
  const solid = (c: number, flat = false) => M(c, { flat });

  /* ---- shared bits ---- */
  const plate = (k: Kit, r: number, mat = PAVE, h = 0.14) => k.cyl(mat, r, r, h, 0, 0, 0, 28);
  const tree = (k: Kit, x: number, z: number, s = 1, y0 = 0) => {
    k.cyl(TRUNK, 0.07 * s, 0.09 * s, 0.45 * s, x, y0, z, 5);
    k.cone((x * 7 + z * 3) % 2 > 1 ? LEAF_L : LEAF, 0.42 * s, 1.0 * s, x, y0 + 0.35 * s, z, 6);
  };
  const roundTree = (k: Kit, x: number, z: number, s = 1, y0 = 0) => {
    k.cyl(TRUNK, 0.08 * s, 0.1 * s, 0.5 * s, x, y0, z, 5);
    k.ball(LEAF_L, 0.45 * s, x, y0 + 0.8 * s, z, 1, 0.85, 1, 7);
  };
  const palm = (k: Kit, x: number, z: number, s = 1) => {
    k.add(new THREE.CylinderGeometry(0.05 * s, 0.08 * s, 1.5 * s, 5), TRUNK, x + 0.1 * s, 0.75 * s, z, 0, 0, -0.15);
    k.cone(LEAF_L, 0.55 * s, 0.25 * s, x + 0.22 * s, 1.4 * s, z, 7);
  };
  const umbrella = (k: Kit, x: number, z: number, c: number) => {
    k.cyl(STEEL, 0.025, 0.025, 0.7, x, 0, z, 4);
    k.cone(solid(c, true), 0.36, 0.2, x, 0.62, z, 8);
  };
  /** Chinese pavilion: posts + hip roof. */
  const pavilion = (k: Kit, x: number, z: number, s = 1, y0 = 0, roof = ROOF_TILE) => {
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) k.cyl(RED, 0.04 * s, 0.04 * s, 0.6 * s, x + dx * 0.3 * s, y0, z + dz * 0.3 * s, 5);
    k.cone(roof, 0.62 * s, 0.38 * s, x, y0 + 0.58 * s, z, 4, Math.PI / 4);
  };
  const flag = (k: Kit, x: number, z: number, h = 2.2, c = 0xd23a2a) => {
    k.cyl(STEEL, 0.03, 0.03, h, x, 0, z, 4);
    k.box(solid(c), 0.55, 0.34, 0.02, x + 0.28, h - 0.38, z);
  };
  /** Gabled roof (triangular prism) on y0, ridge along x. */
  const gable = (k: Kit, mat: THREE.Material, w: number, d: number, h: number, x: number, y0: number, z: number, ry = 0) => {
    // a 3-sided cylinder lying along x with one edge pointing up = a prism roof
    const r = d / Math.sqrt(3);
    const sx = h / (1.5 * r);
    return k.add(new THREE.CylinderGeometry(r, r, w, 3, 1, false, Math.PI / 2), mat, x, y0 + 0.5 * r * sx, z, 0, ry, Math.PI / 2, sx, 1, 1);
  };
  /** Half disc on the +z (seaward) side, or the -z side when `back`. */
  const halfDisk = (k: Kit, mat: THREE.Material, r: number, h: number, y0: number, z: number, back = false) =>
    k.add(new THREE.CylinderGeometry(r, r, h, 28, 1, false, back ? Math.PI / 2 : -Math.PI / 2, Math.PI), mat, 0, y0 + h / 2, z);
  const ferrisWheel = (R: number, rim: number, cabin: number): THREE.Group => {
    const k = new Kit();
    const rimM = solid(rim);
    k.torus(rimM, R, 0.07, 0, 0, 0, 0, 0, 40);
    k.torus(rimM, R * 0.25, 0.05, 0, 0, 0, 0, 0, 16);
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      k.add(new THREE.BoxGeometry(R, 0.035, 0.035), STEEL, Math.cos(a) * R / 2, Math.sin(a) * R / 2, 0, 0, 0, a);
      k.ball(solid(i % 2 ? cabin : 0xffffff), 0.16, Math.cos(a) * R, Math.sin(a) * R, 0, 1, 1, 1, 6);
    }
    const g = new THREE.Group();
    k.into(g);
    return g;
  };

  /* ---- building types ---- */
  const tower = (k: Kit, w: number, h: number, d: number, c: number, x = 0, z = 0, y0 = 0) => k.box(glass(c), w, h, d, x, y0, z);

  /** A 口岸 inspection hall: long hall, lane canopy on pillars, flags. */
  const checkpoint = (k: Kit, accent: number, wide = 3.2) => {
    plate(k, 1.75);
    k.box(WHITE, wide * 0.9, 1.1, 1.0, 0, 0.14, -0.75);
    k.box(solid(accent), wide * 0.9, 0.16, 1.02, 0, 0.95, -0.75);
    k.box(glass(0x7fb6d6), wide * 0.86, 0.6, 1.04, 0, 0.3, -0.75);
    for (let i = 0; i < 5; i++) {
      const x = -wide * 0.4 + (i * wide * 0.8) / 4;
      k.cyl(STEEL, 0.05, 0.05, 1.0, x, 0.14, 0.75, 6);
      k.box(DARK, 0.06, 0.02, 1.3, x + wide * 0.1, 0.15, 0.55);
    }
    k.add(new THREE.CylinderGeometry(1.0, 1.0, wide * 0.92, 18, 1, false, 0, Math.PI), WHITE, 0, 1.05, 0.55, 0, 0, Math.PI / 2, 0.35, 1, 0.75);
    flag(k, -wide * 0.48, 1.2, 2.3);
    flag(k, wide * 0.48, 1.2, 2.3, 0xf0c419);
    return 2.4;
  };
  const station = (k: Kit, c: number) => {
    plate(k, 1.8);
    k.box(glass(c), 3.0, 1.3, 2.0, 0, 0.14, -0.2);
    k.box(STEEL, 3.6, 0.18, 2.8, 0, 1.44, -0.2);
    for (const x of [-1.6, 1.6]) for (const z of [-1.4, 1.0]) k.cyl(STEEL, 0.06, 0.06, 1.3, x, 0.14, z, 6);
    for (let i = 0; i < 3; i++) k.box(WHITE, 3.4, 0.06, 0.32, 0, 0.7, 1.15 + i * 0.32);
    k.box(neon(0x6366f1), 1.2, 0.3, 0.05, 0, 1.0, 1.0);
    return 1.7;
  };
  const park = (k: Kit, seed: number, opts: { lake?: boolean; pavilion?: boolean; trees?: number } = {}) => {
    k.cyl(GRASS, 1.85, 1.85, 0.12, 0, 0, 0, 28);
    if (opts.lake) k.cyl(WATER, 0.75, 0.75, 0.04, 0.45, 0.12, 0.35, 20);
    k.box(PAVE, 3.2, 0.03, 0.22, 0, 0.12, -0.55, 0.35);
    const n = opts.trees ?? 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + seed;
      const r = 1.05 + ((i * 37 + seed * 11) % 5) * 0.12;
      (i % 3 ? tree : roundTree)(k, Math.cos(a) * r, Math.sin(a) * r, 0.8 + (i % 3) * 0.15, 0.12);
    }
    if (opts.pavilion !== false) pavilion(k, -0.45, 0.25, 1, 0.12);
    return 1.6;
  };
  const beach = (k: Kit, seed: number) => {
    k.cyl(SAND, 1.9, 1.9, 0.08, 0, 0, 0, 28);
    halfDisk(k, WATER, 1.95, 0.06, 0.04, 0.25);
    const cols = [0xef4444, 0xf59e0b, 0x3b82f6, 0x22c55e, 0xec4899];
    for (let i = 0; i < 6; i++) umbrella(k, -1.3 + i * 0.5, -0.45 + ((i + seed) % 2) * 0.35, cols[(i + seed) % cols.length]!);
    for (const [x, z] of [[-1.4, -1.1], [-0.6, -1.4], [0.9, -1.25], [1.5, -0.8]] as const) palm(k, x, z, 0.9);
    return 1.6;
  };
  const mountain = (k: Kit, h: number, seed: number, summit = true) => {
    k.cone(GRASS_D, 1.9, h * 0.55, 0, 0, 0, 9, seed, 1, 0.9);
    k.cone(LEAF, 1.35, h * 0.5, 0.1, h * 0.3, -0.05, 8, seed + 1);
    k.cone(ROCK, 0.7, h * 0.32, 0.15, h * 0.68, -0.1, 7, seed + 2);
    for (let i = 0; i < 10; i++) {
      const a = i * 0.63 + seed;
      const r = 1.45 + (i % 3) * 0.12;
      tree(k, Math.cos(a) * r, Math.sin(a) * r, 0.7, 0.05);
    }
    // a winding trail up the slope
    for (let i = 0; i < 7; i++) {
      const t = i / 7;
      const a = seed + t * 4.2;
      const r = 1.6 * (1 - t * 0.85);
      k.box(PAVE, 0.32, 0.05, 0.12, Math.cos(a) * r, h * t * 0.92, Math.sin(a) * r, -a);
    }
    if (summit) pavilion(k, 0.15, -0.1, 0.8, h * 0.97);
    return h + 0.6;
  };
  const handshakeVillage = (k: Kit) => {
    plate(k, 1.75, CONCRETE);
    const cols = [0xe9dcc8, 0xf0c9a8, 0xd7e3e8, 0xf3e3b3, 0xe7c0c0, 0xcfe0c3];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const h = 3.2 + ((i * 3 + j * 5) % 4) * 0.7;
      const x = (i - 1) * 0.95; const z = (j - 1) * 0.95;
      k.box(M(cols[(i * 3 + j) % cols.length]!, { glass: true, rough: 0.9 }), 0.84, h, 0.84, x, 0.14, z);
      k.cyl(STEEL, 0.13, 0.13, 0.3, x + 0.2, 0.14 + h, z - 0.2, 8);
      if ((i + j) % 2 === 0) k.box(RED, 0.5, 0.08, 0.02, x, 0.6, z + 0.43);
    }
    return 6.2;
  };

  /* ---- specific locations ---- */
  const SPECIFIC: Record<string, (k: Kit, l: Loc, spin: THREE.Object3D[], g: THREE.Group) => number> = {
    // 平安金融中心: tapered glass shaft, stone ribs, crown and spire
    "sz:bank": (k) => {
      plate(k, 1.7);
      k.box(CONCRETE, 2.8, 1.2, 2.8, 0, 0.14, 0);
      k.cyl(glass(0x9db8c8), 0.82, 1.22, 19, 0, 1.3, 0, 4, Math.PI / 4);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) k.add(new THREE.BoxGeometry(0.16, 19, 0.16), STEEL, dx * 0.71, 10.8, dz * 0.71, -dz * 0.012, 0, dx * 0.012);
      k.cyl(STEEL, 0.5, 0.82, 2.0, 0, 20.3, 0, 4, Math.PI / 4);
      k.cone(STEEL, 0.32, 4.6, 0, 22.3, 0, 6);
      return 27;
    },
    // 科技园创业公司: an ordinary mid-rise office with a rooftop sign
    "sz:work": (k) => {
      plate(k, 1.7);
      tower(k, 2.2, 4.6, 1.6, 0x8fb3d1, -0.2, -0.2, 0.14);
      k.box(solid(0xe8e2d6), 1.0, 2.2, 1.2, 1.05, 0.14, 0.4);
      k.box(neon(0x3b82f6), 1.0, 0.3, 0.05, -0.2, 4.95, 0.61);
      for (const x of [-0.8, 0.4]) k.cyl(STEEL, 0.15, 0.15, 0.3, x, 4.74, -0.5, 8);
      return 5.4;
    },
    /* ---- 大厂总部 ---- */
    // 腾讯滨海大厦: twin towers tied by three sky bridges
    "sz:co-tencent": (k) => {
      plate(k, 1.75);
      tower(k, 1.05, 10.5, 1.1, 0x7fa9c9, -1.0, -0.1, 0.14);
      tower(k, 1.05, 8.6, 1.1, 0x7fa9c9, 1.0, 0.2, 0.14);
      for (const y of [2.2, 5.0, 7.4]) k.box(M(0xe6edf2, { rough: 0.4, metal: 0.3 }), 1.2, 0.7, 0.8, 0, y, 0.05);
      k.box(neon(0x3b82f6), 0.8, 0.3, 0.05, -1.0, 8.5, 0.47);
      return 11;
    },
    // 腾讯企鹅岛: a reclaimed-land campus ringed by water, two 云海大厦 towers,
    // mid-rise blocks with green roofs, a seaside boardwalk — and a penguin
    "sz:co-penguin": (k) => {
      k.cyl(WATER, 1.9, 1.9, 0.05, 0, 0, 0, 28);
      k.cyl(GRASS, 1.45, 1.55, 0.16, 0, 0, 0, 24);
      k.torus(WOOD, 1.5, 0.05, 0, 0.17, 0, Math.PI / 2, 0, 32);
      tower(k, 0.6, 3.6, 0.6, 0x7cc4e4, -0.45, -0.5, 0.16);
      tower(k, 0.6, 3.1, 0.6, 0x7cc4e4, 0.35, -0.65, 0.16);
      for (const [x, z, h] of [[-0.8, 0.5, 1.1], [0.1, 0.65, 1.4], [0.85, 0.15, 1.0]] as const) {
        tower(k, 0.62, h, 0.5, 0xd9e7ee, x, z, 0.16);
        k.box(GRASS_D, 0.64, 0.06, 0.52, x, 0.16 + h, z);
      }
      // the penguin: black body, white belly, orange beak and feet
      const black = solid(0x1f2937); const orange = solid(0xf59e0b);
      k.ball(black, 0.2, 1.05, 0.42, 0.95, 1, 1.3, 1, 12);
      k.ball(WHITE, 0.15, 1.1, 0.4, 1.08, 0.9, 1.2, 0.6, 12);
      k.ball(black, 0.14, 1.05, 0.78, 0.95, 1, 1, 1, 12);
      k.cone(orange, 0.05, 0.12, 1.1, 0.76, 1.1, 6);
      k.box(orange, 0.12, 0.04, 0.1, 1.0, 0.16, 1.02);
      k.box(orange, 0.12, 0.04, 0.1, 1.12, 0.16, 1.02);
      return 4.1;
    },
    // 抖音集团后海中心: a slim ~150 m tower with a sloped crown
    "sz:co-bytedance": (k) => {
      plate(k, 1.3);
      k.box(CONCRETE, 1.6, 0.6, 1.4, 0, 0.14, 0);
      tower(k, 1.05, 8.2, 1.05, 0x3c4a5c, 0, 0, 0.74);
      k.add(new THREE.CylinderGeometry(0.75, 0.75, 1.05, 3, 1, false, Math.PI / 2), M(0x3c4a5c, { glass: true, rough: 0.3, metal: 0.45 }), 0, 9.15, 0, 0, 0, Math.PI / 2, 0.55, 1, 1);
      k.box(neon(0x22d3ee), 0.06, 6.5, 0.06, 0.53, 1.6, 0.53);
      k.box(neon(0xf43f5e), 0.06, 6.5, 0.06, -0.53, 1.6, 0.53);
      return 9.8;
    },
    // 百度国际大厦: east and west towers on a shared podium
    "sz:co-baidu": (k) => {
      plate(k, 1.3);
      k.box(CONCRETE, 2.2, 0.7, 1.4, 0, 0.14, 0);
      tower(k, 0.8, 7.0, 0.9, 0x6f9ccc, -0.55, 0, 0.84);
      tower(k, 0.8, 6.0, 0.9, 0x6f9ccc, 0.55, 0, 0.84);
      k.box(neon(0x2563eb), 0.6, 0.25, 0.04, -0.55, 7.2, 0.46);
      return 8.2;
    },
    // 大疆天空之城: two towers with platforms cantilevered between them
    "sz:co-dji": (k) => {
      plate(k, 1.3);
      tower(k, 0.75, 8.5, 0.75, 0x30363d, -0.6, -0.1, 0.14);
      tower(k, 0.75, 7.2, 0.75, 0x30363d, 0.6, 0.15, 0.14);
      for (const [y, dx] of [[2.0, 0.25], [3.6, -0.2], [5.0, 0.3], [6.4, -0.1]] as const) k.box(M(0xdfe3e6, { rough: 0.5 }), 1.7, 0.28, 0.9, dx, y, 0.05);
      // a drone hovering over the roof
      k.box(DARK, 0.3, 0.05, 0.3, -0.6, 9.3, -0.1);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) k.cyl(STEEL, 0.09, 0.09, 0.02, -0.6 + dx * 0.2, 9.36, -0.1 + dz * 0.2, 8);
      return 9.6;
    },
    // 华为坂田基地: a low campus of research blocks around a lake
    "sz:co-huawei": (k) => {
      k.cyl(GRASS, 1.5, 1.5, 0.12, 0, 0, 0, 26);
      k.cyl(WATER, 0.5, 0.5, 0.04, 0.2, 0.12, 0.25, 18);
      const blk = solid(0xece5d8);
      for (const [x, z, w, d, h] of [[-0.85, -0.7, 0.9, 0.55, 0.9], [0.4, -0.85, 1.1, 0.5, 1.1], [-0.9, 0.35, 0.5, 0.9, 0.8], [0.95, 0.35, 0.5, 0.8, 1.0], [-0.2, 1.0, 0.9, 0.4, 0.7]] as const) {
        k.box(blk, w, h, d, x, 0.12, z);
        k.box(glass(0xa9c3d6), w * 0.96, h * 0.5, d + 0.02, x, 0.12 + h * 0.3, z);
        k.box(RED, w, 0.05, d, x, 0.12 + h, z);
      }
      for (let i = 0; i < 6; i++) roundTree(k, Math.cos(i) * 1.25, Math.sin(i) * 1.25, 0.55, 0.12);
      return 1.8;
    },
    // 中兴通讯大厦: blue glass tower with a stepped top
    "sz:co-zte": (k) => {
      plate(k, 1.3);
      tower(k, 1.2, 5.4, 1.0, 0x4b8fd1, 0, 0, 0.14);
      tower(k, 0.85, 1.0, 0.75, 0x4b8fd1, 0, 0, 5.54);
      k.cyl(STEEL, 0.04, 0.04, 1.2, 0, 6.54, 0, 4);
      return 7.6;
    },
    // 招商银行大厦: tall tower with a slanted crown
    "sz:co-cmb": (k) => {
      plate(k, 1.3);
      k.box(CONCRETE, 1.6, 0.8, 1.4, 0, 0.14, 0);
      tower(k, 1.0, 9.5, 1.0, 0x9aa9b6, 0, 0, 0.94);
      k.add(new THREE.CylinderGeometry(0.72, 0.72, 1.0, 3, 1, false, Math.PI / 2), M(0x9aa9b6, { glass: true, rough: 0.3, metal: 0.45 }), 0, 10.75, 0, 0, Math.PI / 2, Math.PI / 2, 0.9, 1, 1);
      k.box(RED, 1.02, 0.25, 1.02, 0, 9.2, 0);
      return 11.6;
    },
    // 万科中心: the "horizontal skyscraper" floating on legs over a park
    "sz:co-vanke": (k) => {
      k.cyl(GRASS, 1.55, 1.55, 0.12, 0, 0, 0, 26);
      const arm = M(0xd9dcd6, { rough: 0.5 });
      for (const [x, z, w, d, ry] of [[-0.3, -0.5, 2.5, 0.45, 0.2], [0.75, 0.4, 0.45, 1.6, 0.1]] as const) {
        k.box(arm, w, 0.4, d, x, 1.0, z, ry);
        k.box(glass(0xb9cbd6), w * 0.98, 0.22, d + 0.02, x, 1.08, z, ry);
      }
      for (const [x, z] of [[-1.2, -0.7], [0.4, -0.35], [0.75, -0.2], [0.85, 1.0]] as const) k.cyl(CONCRETE, 0.08, 0.08, 0.9, x, 0.12, z, 6);
      for (let i = 0; i < 4; i++) roundTree(k, -1.0 + i * 0.5, 0.6, 0.5, 0.12);
      return 1.8;
    },
    // 比亚迪坪山总部: an office block, saw-tooth factory roofs, EVs lined up
    "sz:co-byd": (k) => {
      plate(k, 1.5, CONCRETE);
      tower(k, 0.9, 2.6, 0.8, 0x9fc4a8, -0.75, -0.6, 0.14);
      for (let i = 0; i < 4; i++) {
        k.box(solid(0xe5e7eb), 0.42, 0.55, 1.2, 0.0 + i * 0.42, 0.14, -0.2);
        k.add(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 3, 1, false, Math.PI / 2), solid(0x16a34a, true), 0.0 + i * 0.42, 0.75, -0.2, Math.PI / 2, 0, 0, 1, 1, 0.6);
      }
      const cars = [0x2563eb, 0xffffff, 0xdc2626, 0x111827, 0x16a34a];
      for (let i = 0; i < 5; i++) k.box(solid(cars[i]!), 0.25, 0.12, 0.42, -0.9 + i * 0.4, 0.14, 0.95);
      return 2.8;
    },
    // 城中村握手楼
    "sz:home": (k) => handshakeVillage(k),
    "hz:home": (k) => { handshakeVillage(k); return 6; },
    // 海岸城: mall blocks, glass atrium dome, LED band
    "sz:mall": (k) => {
      plate(k, 1.8);
      k.box(solid(0xf4ede1), 3.2, 2.0, 1.4, 0, 0.14, -0.7);
      k.box(solid(0xe8dfd0), 1.6, 2.6, 1.6, -0.8, 0.14, 0.7);
      k.ball(glass(0x8fc2dc), 0.85, 0.7, 2.1, 0.5, 1, 0.7, 1, 16);
      k.box(neon(0xec4899), 3.2, 0.25, 0.04, 0, 1.75, 0.02);
      return 3.2;
    },
    // 前海国际会议中心: low hall under a big floating roof
    "sz:apec-qianhai": (k) => {
      plate(k, 1.8);
      k.box(glass(0xc4d6e2), 2.8, 1.4, 2.2, 0, 0.14, 0);
      for (let i = 0; i < 6; i++) k.cyl(WHITE, 0.06, 0.06, 1.6, -1.5 + i * 0.6, 0.14, 1.35, 6);
      k.box(WHITE, 3.6, 0.28, 3.0, 0, 1.74, 0.15);
      k.box(RED, 3.62, 0.07, 3.02, 0, 1.74, 0.15);
      return 2.1;
    },
    // 深圳国际交流中心 · 香蜜湖: lakeside hall with a golden hip roof
    "sz:apec-xiangmihu": (k) => {
      plate(k, 1.8);
      k.cyl(WATER, 0.9, 0.9, 0.04, 0.6, 0.14, 0.9, 20);
      k.box(WHITE, 2.8, 1.5, 1.4, -0.2, 0.14, -0.5);
      k.box(glass(0xb9d3e6), 2.7, 1.0, 1.42, -0.2, 0.3, -0.5);
      k.cone(ROOF_GOLD, 1.3, 0.8, -0.2, 1.64, -0.5, 4, Math.PI / 4, 1.55, 0.85);
      return 2.6;
    },
    // 太子湾: cruise ship at the quay
    "sz:apec-taiziwan": (k) => { cruiseTerminal(k); return 2.6; },
    "sz:port": (k) => { cruiseTerminal(k); return 2.6; },
    // 市民中心 (图书馆): long hall under the "大鹏展翅" roof, tower blocks at each end
    "sz:library": (k) => {
      plate(k, 1.8);
      k.box(glass(0xd6dde3), 3.0, 1.1, 1.3, 0, 0.14, 0);
      for (const x of [-1.35, 1.35]) k.box(solid(0xe9e2d5), 0.7, 2.3, 1.4, x, 0.14, 0);
      k.add(new THREE.CylinderGeometry(3.4, 3.4, 1.9, 24, 1, true, Math.PI - 0.5, 1.0), M(0x8fa8bc, { rough: 0.35, metal: 0.55, double: true }), 0, 2.05 - 3.4, 0, Math.PI / 2, 0, 0);
      k.box(GOLD, 0.18, 0.5, 0.18, 0, 2.3, 0);
      return 2.8;
    },
    // 深圳北站
    "sz:north": (k) => station(k, 0x93b4cf),
    "hz:hzsouth": (k) => station(k, 0x93b4cf),
    "hz:metro": (k) => station(k, 0x9cc8dd),
    // 宝安机场 T3: the flattened "manta" terminal, piers, control tower
    "sz:airport": (k) => airport(k),
    "hz:pingtan-airport": (k) => airport(k),
    // 地铁站入口
    "sz:metro": (k) => {
      plate(k, 1.6);
      k.box(glass(0xb6d4e6), 1.6, 0.9, 1.2, 0, 0.14, 0);
      k.add(new THREE.CylinderGeometry(1.0, 1.0, 1.8, 16, 1, false, 0, Math.PI), STEEL, 0, 1.04, 0, 0, 0, Math.PI / 2, 0.35, 1, 0.8);
      k.cyl(RED, 0.06, 0.06, 2.0, 1.1, 0.14, 0.6, 6);
      k.box(neon(0xd23a2a), 0.45, 0.45, 0.06, 1.1, 1.9, 0.6);
      return 2.6;
    },
    // 华强北: electronics blocks with LED walls + the octagonal SEG tower
    "sz:hq": (k) => {
      plate(k, 1.75, CONCRETE);
      k.cyl(glass(0x8fa6b8), 0.75, 0.75, 9.5, -0.6, 0.14, -0.6, 8);
      k.cyl(STEEL, 0.05, 0.05, 2.0, -0.6, 9.64, -0.6, 4);
      k.box(solid(0xe5ddd0), 1.2, 3.0, 1.1, 0.8, 0.14, -0.5);
      k.box(solid(0xd8d3cc), 1.4, 2.2, 1.0, 0.5, 0.14, 0.9);
      k.box(neon(0x22d3ee), 1.15, 0.9, 0.04, 0.8, 1.6, 0.06);
      k.box(neon(0xf472b6), 1.3, 0.7, 0.04, 0.5, 1.0, 1.42);
      k.box(neon(0xfacc15), 0.05, 0.8, 0.9, -0.12, 1.2, -0.5);
      return 11;
    },
    // 东门老街 night market: shophouses, archway, red lanterns
    "sz:food": (k) => { oldStreet(k, true); return 2.4; },
    "hz:food": (k) => { oldStreet(k, true); return 2.4; },
    "hz:danshui": (k) => { oldStreet(k, false); return 2.4; },
    "sz:zhongyingjie": (k) => {
      oldStreet(k, false);
      k.box(solid(0xbdb6a6), 0.18, 0.55, 0.12, 0, 0.14, 0);
      k.cyl(TRUNK, 0.16, 0.22, 1.0, 1.15, 0.14, -1.0, 7);
      k.ball(LEAF, 0.85, 1.15, 1.5, -1.0, 1.2, 0.75, 1.2, 9);
      return 2.4;
    },
    // 人民医院
    "sz:hospital": (k) => { hospital(k); return 7.5; },
    "hz:hospital": (k) => { hospital(k); return 7.5; },
    // 酒吧街 / KTV
    "sz:ktv": (k) => { nightlife(k); return 5; },
    "hz:ktv": (k) => { nightlife(k); return 5; },
    // 大芬油画村: low houses with big canvases on easels
    "sz:dafen": (k) => {
      plate(k, 1.75, CONCRETE);
      k.box(solid(0xf2e2c4), 1.4, 1.4, 1.0, -0.8, 0.14, -0.7);
      k.box(solid(0xe7d0d6), 1.4, 1.8, 1.0, 0.8, 0.14, -0.7);
      const cols = [0x2563eb, 0xf59e0b, 0xdc2626, 0x16a34a, 0x9333ea];
      for (let i = 0; i < 5; i++) {
        const x = -1.3 + i * 0.65;
        k.add(new THREE.BoxGeometry(0.5, 0.65, 0.03), solid(cols[i]!), x, 0.75, 0.6, -0.2);
        k.box(WOOD, 0.04, 0.6, 0.04, x, 0.14, 0.7);
      }
      return 2.6;
    },
    // 深圳湾滨海酒店: twin slim towers + pool
    "sz:hotel": (k) => {
      plate(k, 1.8);
      tower(k, 0.9, 6.5, 1.1, 0xc9b6d6, -0.6, -0.3, 0.14);
      tower(k, 0.9, 5.4, 1.1, 0xc9b6d6, 0.6, -0.3, 0.14);
      k.box(WATER, 1.6, 0.05, 0.6, 0, 0.14, 1.05);
      k.box(neon(0xf472b6), 0.7, 0.25, 0.04, -0.6, 5.8, 0.26);
      return 7.2;
    },
    "hz:hostel": (k) => { oldStreet(k, false); return 2.4; },
    "sz:gym": (k) => { gymHall(k); return 2.2; },
    "hz:gym": (k) => { park(k, 3, { pavilion: false, trees: 7 }); k.box(solid(0x84cc16), 1.2, 0.8, 0.8, 0.4, 0.12, -0.3); return 1.6; },
    // 春茧: the white lattice cocoon
    "sz:chunjian": (k) => {
      plate(k, 1.8);
      k.ball(WHITE, 1.5, 0, 0.5, 0, 1.08, 0.62, 0.95, 20);
      k.ball(M(0x9aa6ad, { wire: true }), 1.52, 0, 0.5, 0, 1.08, 0.63, 0.96, 14);
      k.cyl(GRASS, 0.7, 0.7, 0.03, 0, 1.4, 0, 16);
      return 1.6;
    },
    // 大运中心: faceted crystal stadium
    "sz:universiade": (k) => {
      plate(k, 1.8);
      const crystal = M(0x8ecae6, { flat: true, rough: 0.2, metal: 0.4, opacity: 0.88 });
      k.add(new THREE.IcosahedronGeometry(1.35, 1), crystal, -0.3, 0.55, -0.2, 0, 0, 0, 1.1, 0.55, 1);
      k.add(new THREE.IcosahedronGeometry(0.75, 1), crystal, 1.0, 0.35, 0.9, 0, 0, 0, 1, 0.5, 1);
      return 1.6;
    },
    // 世界之窗: Eiffel replica + a pyramid
    "sz:window": (k) => {
      plate(k, 1.6);
      const lattice = M(0x6b5a48, { wire: true });
      const iron = M(0x7a6650, { rough: 0.5, metal: 0.4 });
      k.cyl(lattice, 0.35, 1.0, 2.4, -0.3, 0.14, -0.2, 4, Math.PI / 4);
      k.box(iron, 0.95, 0.1, 0.95, -0.3, 2.5, -0.2);
      k.cyl(lattice, 0.1, 0.33, 3.6, -0.3, 2.6, -0.2, 4, Math.PI / 4);
      k.cyl(iron, 0.0, 0.08, 1.0, -0.3, 6.2, -0.2, 4);
      k.cone(M(0xe2c27a, { flat: true }), 0.7, 0.9, 0.95, 0.14, 0.8, 4, Math.PI / 4);
      return 7.4;
    },
    // 锦绣中华: a stretch of Great Wall + a pagoda
    "sz:jinxiu": (k) => {
      k.cyl(GRASS, 1.75, 1.75, 0.12, 0, 0, 0, 28);
      const wall = solid(0xb9ab8f);
      for (let i = 0; i < 6; i++) {
        const x = -1.4 + i * 0.5; const z = Math.sin(i * 1.3) * 0.35 + 0.8; const y = 0.12 + (i % 3) * 0.12;
        k.box(wall, 0.55, 0.35, 0.22, x, y, z, Math.cos(i * 1.3) * 0.4);
        if (i % 2 === 0) k.box(wall, 0.25, 0.55, 0.28, x, y, z);
      }
      for (let i = 0; i < 4; i++) {
        k.cyl(solid(0xd8cfc0), 0.36 - i * 0.06, 0.4 - i * 0.06, 0.45, -0.4, 0.12 + i * 0.5, -0.6, 6);
        k.cone(ROOF_TILE, 0.55 - i * 0.07, 0.2, -0.4, 0.5 + i * 0.5, -0.6, 6);
      }
      return 2.6;
    },
    // 欢乐谷: castle towers + a coaster loop
    "sz:happyvalley": (k) => {
      plate(k, 1.75, CONCRETE);
      const track = solid(0xf43f5e);
      k.torus(track, 0.9, 0.06, 0.7, 1.15, 0.3, 0, Math.PI / 2, 28);
      for (let i = 0; i < 6; i++) {
        const x = -1.5 + i * 0.5; const h = 0.6 + Math.sin(i * 1.1) * 0.4 + 0.4;
        k.box(STEEL, 0.05, h, 0.05, x, 0.14, 1.2);
        k.box(track, 0.55, 0.06, 0.12, x, 0.14 + h, 1.2);
      }
      for (const [x, z, h] of [[-0.9, -0.7, 1.8], [-0.2, -1.0, 2.4], [-1.3, 0.1, 1.4]] as const) {
        k.cyl(solid(0xf3e6f7), 0.26, 0.28, h, x, 0.14, z, 10);
        k.cone(solid(0x7c3aed, true), 0.36, 0.7, x, 0.14 + h, z, 10);
      }
      return 3.2;
    },
    // 欢乐海岸: lagoon, pier, lighthouse
    "sz:octharbour": (k) => {
      plate(k, 1.8);
      k.cyl(WATER, 1.0, 1.0, 0.04, 0.4, 0.14, 0.3, 24);
      k.box(WOOD, 1.6, 0.05, 0.28, 0.2, 0.18, 0.3, 0.4);
      k.box(solid(0xf6e7cf), 1.2, 0.9, 0.7, -0.9, 0.14, -0.9);
      k.box(solid(0xe4f1f6), 1.0, 1.2, 0.7, 0.6, 0.14, -1.1);
      k.cyl(WHITE, 0.15, 0.22, 1.8, 1.25, 0.14, 0.9, 10);
      k.cyl(RED, 0.16, 0.16, 0.25, 1.25, 1.94, 0.9, 10);
      k.cone(RED, 0.2, 0.25, 1.25, 2.19, 0.9, 10);
      return 2.6;
    },
    // 东部华侨城: Swiss-style chalets and a church spire on the hillside
    "sz:octeast": (k) => {
      k.cone(GRASS_D, 1.9, 1.4, 0, 0, 0, 9);
      for (const [x, z] of [[-0.9, 0.6], [0.2, 1.0], [0.9, 0.2]] as const) {
        k.box(solid(0xf5ead7), 0.6, 0.5, 0.5, x, 0.35, z);
        gable(k, solid(0x8b3a2a, true), 0.7, 0.62, 0.35, x, 0.85, z);
      }
      k.box(WHITE, 0.4, 1.0, 0.4, -0.2, 0.8, -0.3);
      k.cone(DARK, 0.28, 0.9, -0.2, 1.8, -0.3, 4, Math.PI / 4);
      return 3;
    },
    // 大鹏所城: square walled fort with a gate tower
    "sz:dapengfort": (k) => {
      k.cyl(GRASS, 1.8, 1.8, 0.12, 0, 0, 0, 28);
      const wall = solid(0x9f8f78);
      for (const [x, z, w, d] of [[0, -1.3, 2.7, 0.22], [0, 1.3, 2.7, 0.22], [-1.3, 0, 0.22, 2.7], [1.3, 0, 0.22, 2.7]] as const) k.box(wall, w, 0.55, d, x, 0.12, z);
      k.box(wall, 0.8, 0.75, 0.4, 0, 0.12, 1.3);
      k.box(RED, 0.65, 0.4, 0.32, 0, 0.87, 1.3);
      k.cone(ROOF_TILE, 0.6, 0.35, 0, 1.27, 1.3, 4, Math.PI / 4, 1.3, 0.8);
      for (const [x, z] of [[-0.5, -0.4], [0.5, -0.4], [-0.4, 0.4], [0.5, 0.5]] as const) {
        k.box(solid(0xd9cdb5), 0.5, 0.35, 0.4, x, 0.12, z);
        gable(k, ROOF_TILE, 0.55, 0.44, 0.22, x, 0.47, z);
      }
      return 1.8;
    },
    // 仙湖植物园 · 弘法寺: yellow-walled temple halls, a pagoda, the lake
    "sz:xianhuhu": (k) => {
      k.cyl(GRASS, 1.85, 1.85, 0.12, 0, 0, 0, 28);
      k.cyl(WATER, 0.8, 0.8, 0.04, 0.7, 0.12, 0.8, 20);
      k.box(solid(0xe9c46a), 1.4, 0.7, 0.8, -0.5, 0.12, -0.6);
      k.cone(ROOF_GOLD, 0.95, 0.5, -0.5, 0.82, -0.6, 4, Math.PI / 4, 1.45, 0.9);
      for (let i = 0; i < 5; i++) {
        k.cyl(solid(0xf1e6d0), 0.24 - i * 0.03, 0.27 - i * 0.03, 0.38, 0.9, 0.12 + i * 0.42, -0.6, 6);
        k.cone(ROOF_TILE, 0.36 - i * 0.04, 0.16, 0.9, 0.44 + i * 0.42, -0.6, 6);
      }
      for (let i = 0; i < 5; i++) roundTree(k, -1.4 + i * 0.4, 0.9 + (i % 2) * 0.35, 0.7, 0.12);
      return 2.6;
    },
    // 盐田海滨栈道: boardwalk + the port's container cranes
    "sz:yantian": (k) => {
      halfDisk(k, WATER, 1.9, 0.06, 0, 0);
      k.box(WOOD, 3.4, 0.08, 0.35, 0, 0.12, -0.15);
      halfDisk(k, GRASS, 1.85, 0.1, 0, 0, true);
      const crane = solid(0xd9472b);
      for (const x of [-1.1, 0, 1.1]) {
        for (const dx of [-0.25, 0.25]) k.box(crane, 0.06, 1.6, 0.06, x + dx, 0.06, 0.8);
        k.box(crane, 0.08, 0.08, 1.5, x, 1.66, 0.65);
      }
      const ccols = [0x2563eb, 0xf59e0b, 0x16a34a, 0xdc2626];
      for (let i = 0; i < 8; i++) k.box(solid(ccols[i % 4]!), 0.5, 0.22, 0.2, -1.2 + (i % 4) * 0.55, 0.12 + Math.floor(i / 4) * 0.22, -0.9);
      return 2;
    },
    // 深圳博物馆: classical hall with a colonnade
    "sz:szmuseum": (k) => {
      plate(k, 1.6);
      k.box(CONCRETE, 2.6, 0.2, 1.8, 0, 0.14, 0);
      k.box(solid(0xe8dcc6), 2.4, 1.3, 1.2, 0, 0.34, -0.2);
      for (let i = 0; i < 6; i++) k.cyl(WHITE, 0.08, 0.08, 1.2, -1.0 + i * 0.4, 0.34, 0.6, 8);
      gable(k, solid(0xd9cbb2), 2.6, 1.7, 0.45, 0, 1.6, 0);
      return 2.4;
    },
    "hz:hzmuseum": (k) => { SPECIFIC["sz:szmuseum"]!(k, {} as Loc, [], new THREE.Group()); return 2.4; },
    // 海上世界文化艺术中心: stacked, cantilevered boxes
    "sz:swcac": (k) => {
      plate(k, 1.7);
      k.box(glass(0xdfe7ea), 2.4, 1.0, 1.4, 0, 0.14, 0);
      k.box(WHITE, 1.8, 0.9, 1.2, 0.5, 1.14, 0.3, 0.3);
      k.box(glass(0xc7d5dc), 1.4, 0.8, 1.0, -0.4, 2.04, -0.2, -0.35);
      return 3;
    },
    // 深圳湾公园 / 人才公园 / 莲花山 …
    "sz:fun": (k) => { mangroveBay(k); return 1.6; },
    "sz:talent": (k) => {
      park(k, 1, { lake: true, pavilion: false, trees: 7 });
      k.torus(WHITE, 0.55, 0.05, 0.45, 0.4, 0.35, Math.PI / 2, 0, 24);
      return 1.6;
    },
    "sz:lianhua": (k) => {
      k.cone(GRASS_D, 1.85, 1.6, 0, 0, 0, 10);
      for (let i = 0; i < 9; i++) { const a = i * 0.7; tree(k, Math.cos(a) * 1.3, Math.sin(a) * 1.3, 0.7, 0.3); }
      k.box(CONCRETE, 0.35, 0.2, 0.35, 0, 1.55, 0);
      k.cyl(M(0x7a6a4f, { metal: 0.6, rough: 0.4 }), 0.08, 0.1, 0.55, 0, 1.75, 0, 8);
      k.ball(M(0x7a6a4f, { metal: 0.6, rough: 0.4 }), 0.08, 0, 2.38, 0);
      return 2.6;
    },
    "sz:missionhills": (k) => {
      k.cyl(GRASS, 1.85, 1.85, 0.12, 0, 0, 0, 28);
      k.ball(M(0x9ad27a), 0.8, 0.3, 0.12, 0.2, 1, 0.12, 1, 16);
      k.cyl(SAND, 0.3, 0.3, 0.03, -0.8, 0.12, 0.6, 12);
      flag(k, 0.4, 0.2, 1.0, 0xffffff);
      for (let i = 0; i < 6; i++) tree(k, -1.4 + i * 0.55, -1.2, 0.75, 0.12);
      return 1.5;
    },
    "sz:gmfarm": (k) => { farm(k); return 2.4; },
    "sz:seagarden": (k) => {
      k.cyl(WATER, 1.85, 1.85, 0.06, 0, 0, 0, 28);
      for (let i = 0; i < 4; i++) k.box(GRASS, 1.6, 0.08, 0.32, -0.3 + (i % 2) * 0.5, 0.06, -1.2 + i * 0.8);
      k.torus(WOOD, 0.45, 0.05, 1.1, 0.5, 0.1, 0, Math.PI / 2, 16);
      for (let i = 0; i < 6; i++) roundTree(k, -1.3 + i * 0.5, -1.4, 0.6, 0.06);
      return 1.2;
    },
    "sz:qingqing": (k) => { park(k, 2, { lake: true, trees: 11 }); return 1.6; },
    "sz:safari": (k) => {
      k.cyl(M(0xc9b27a, { rough: 1 }), 1.85, 1.85, 0.12, 0, 0, 0, 28);
      for (let i = 0; i < 6; i++) roundTree(k, -1.3 + (i % 3) * 1.2, -0.9 + Math.floor(i / 3) * 1.6, 0.8, 0.12);
      const giraffe = solid(0xe0a64a);
      for (const [x, z] of [[-0.3, 0.2], [0.5, -0.2]] as const) {
        k.box(giraffe, 0.45, 0.22, 0.18, x, 0.62, z);
        for (const dx of [-0.17, 0.17]) k.box(giraffe, 0.05, 0.5, 0.05, x + dx, 0.12, z);
        k.add(new THREE.BoxGeometry(0.08, 0.6, 0.08), giraffe, x + 0.25, 1.05, z, 0, 0, -0.35);
      }
      return 1.8;
    },
    "sz:yangmeikeng": (k) => { beach(k, 2); return 1.6; },
    // Huizhou specials
    "hz:hejiang": (k) => {
      plate(k, 1.6);
      k.box(solid(0xe8d9bd), 1.4, 0.8, 1.4, 0, 0.14, 0);
      for (let i = 0; i < 3; i++) {
        k.box(RED, 1.1 - i * 0.25, 0.6, 1.1 - i * 0.25, 0, 0.94 + i * 0.85, 0);
        k.cone(ROOF_TILE, 1.0 - i * 0.22, 0.32, 0, 1.5 + i * 0.85, 0, 4, Math.PI / 4);
      }
      return 4.4;
    },
    "hz:xihu": (k) => {
      k.cyl(WATER, 1.85, 1.85, 0.06, 0, 0, 0, 28);
      k.torus(solid(0xe5ddcf), 0.6, 0.08, 0, 0.06, 0, 0, 0, 20);
      k.box(solid(0xe5ddcf), 1.4, 0.06, 0.3, 0, 0.55, 0);
      for (let i = 0; i < 6; i++) tree(k, Math.cos(i) * 1.5, Math.sin(i) * 1.5, 0.7, 0.06);
      return 1.6;
    },
    "hz:huamao": (k) => {
      plate(k, 1.8);
      tower(k, 1.2, 7.5, 1.2, 0xc1a3d9, -0.6, -0.4, 0.14);
      k.box(solid(0xf3ece2), 3.0, 1.6, 1.3, 0, 0.14, 0.7);
      k.box(neon(0xd946ef), 3.0, 0.22, 0.04, 0, 1.4, 1.37);
      return 8;
    },
    "hz:xunliao": (k) => { fishingHarbour(k); return 1.6; },
    "hz:xiayong": (k) => { fishingHarbour(k); return 1.6; },
    "hz:hotel": (k) => {
      plate(k, 1.7);
      tower(k, 2.4, 2.4, 1.2, 0xf1c39c, 0, -0.5, 0.14);
      for (let i = 0; i < 3; i++) k.cyl(M(0x7cc6d6, { emissive: 0x7cc6d6 }), 0.32, 0.32, 0.05, -0.8 + i * 0.8, 0.14, 0.8, 14);
      return 2.8;
    },
  };

  /* ---- helpers that need the kit above ---- */
  function cruiseTerminal(k: Kit) {
    halfDisk(k, WATER, 1.9, 0.06, 0, 0.1);
    halfDisk(k, PAVE, 1.75, 0.14, 0, 0, true);
    k.add(new THREE.CylinderGeometry(1.0, 1.0, 2.6, 18, 1, false, 0, Math.PI), glass(0xd5e6ef), -0.1, 0.14, -1.0, 0, 0, Math.PI / 2, 0.9, 1, 0.55);
    // ship
    k.box(WHITE, 3.0, 0.45, 0.75, 0, 0.1, 0.95);
    k.add(new THREE.ConeGeometry(0.37, 0.55, 4), WHITE, 1.77, 0.32, 0.95, 0, Math.PI / 4, -Math.PI / 2, 1, 1, 0.6);
    k.box(solid(0x1f3a5f), 3.02, 0.12, 0.77, 0, 0.1, 0.95);
    for (let i = 0; i < 3; i++) k.box(glass(0xeaf2f7), 2.4 - i * 0.5, 0.25, 0.6, -0.2 - i * 0.1, 0.55 + i * 0.25, 0.95);
    k.cyl(RED, 0.12, 0.14, 0.4, -0.7, 1.3, 0.95, 10);
  }
  function airport(k: Kit) {
    plate(k, 2.0);
    k.ball(M(0xeef2f5, { rough: 0.4, metal: 0.2 }), 1.0, 0, 0.14, -0.2, 2.1, 0.55, 1.1, 22);
    for (const z of [-1.6, 1.3]) k.box(WHITE, 3.4, 0.4, 0.3, 0, 0.14, z);
    k.box(DARK, 3.6, 0.03, 0.5, 0, 0.14, 1.75);
    k.cyl(CONCRETE, 0.12, 0.16, 2.6, 1.7, 0.14, -1.0, 8);
    k.cyl(glass(0x7fb6d6), 0.34, 0.24, 0.35, 1.7, 2.74, -1.0, 10);
    return 3.2;
  }
  function oldStreet(k: Kit, lanterns: boolean) {
    plate(k, 1.7, CONCRETE);
    const walls = [0xe8d6b8, 0xd9c3a3, 0xf0e2c8, 0xdcc9b0];
    for (let i = 0; i < 4; i++) {
      for (const z of [-0.85, 0.85]) {
        const x = -1.2 + i * 0.8;
        k.box(solid(walls[(i + (z > 0 ? 1 : 0)) % 4]!), 0.72, 1.1, 0.7, x, 0.14, z);
        gable(k, ROOF_TILE, 0.76, 0.76, 0.35, x, 1.24, z);
        if (lanterns) k.ball(M(0x5a0d0d, { neon: true, emissive: 0xff3b2f }), 0.09, x, 0.95, z + (z > 0 ? -0.4 : 0.4), 1, 1.2, 1, 8);
      }
    }
    // archway at the street mouth
    for (const z of [-0.45, 0.45]) k.box(RED, 0.12, 1.4, 0.12, 1.7, 0.14, z);
    k.box(ROOF_TILE, 0.3, 0.18, 1.2, 1.7, 1.54, 0);
  }
  function hospital(k: Kit) {
    plate(k, 1.75);
    k.box(glass(0xe7eef2), 1.6, 6.0, 1.4, -0.5, 0.14, -0.3);
    k.box(WHITE, 1.4, 2.4, 1.6, 0.9, 0.14, 0.3);
    k.box(RED, 0.7, 0.2, 0.06, -0.5, 5.4, 0.41);
    k.box(RED, 0.2, 0.7, 0.06, -0.5, 5.15, 0.41);
    k.box(M(0x2a2a2a), 0.9, 0.04, 0.9, -0.5, 6.14, -0.3);
  }
  function nightlife(k: Kit) {
    plate(k, 1.7, CONCRETE);
    k.box(solid(0x3a2f45), 1.6, 3.8, 1.3, -0.5, 0.14, -0.2);
    k.box(solid(0x2f3a45), 1.2, 2.2, 1.2, 0.9, 0.14, 0.2);
    k.box(neon(0xa855f7), 0.08, 3.2, 0.08, -1.25, 0.4, 0.46);
    k.box(neon(0xf472b6), 0.08, 3.2, 0.08, 0.25, 0.4, 0.46);
    k.box(neon(0x22d3ee), 1.0, 0.3, 0.05, 0.9, 1.7, 0.82);
    k.box(neon(0xfacc15), 1.2, 0.25, 0.05, -0.5, 3.3, 0.46);
  }
  function gymHall(k: Kit) {
    plate(k, 1.6);
    k.box(glass(0xd2e3c3), 2.4, 1.3, 1.6, 0, 0.14, 0);
    k.add(new THREE.CylinderGeometry(0.82, 0.82, 2.4, 16, 1, false, 0, Math.PI), solid(0x84cc16), 0, 1.44, 0, 0, 0, Math.PI / 2, 0.5, 1, 1);
    k.box(neon(0x84cc16), 0.9, 0.25, 0.04, 0, 0.9, 0.82);
  }
  function mangroveBay(k: Kit) {
    halfDisk(k, WATER, 1.9, 0.06, 0, 0.2);
    halfDisk(k, GRASS, 1.9, 0.12, 0, 0.2, true);
    k.box(WOOD, 3.6, 0.06, 0.28, 0, 0.12, 0.35, 0.06);
    for (let i = 0; i < 8; i++) roundTree(k, -1.6 + i * 0.45, 0.8 + (i % 2) * 0.3, 0.5, 0);
    for (let i = 0; i < 6; i++) tree(k, -1.3 + i * 0.5, -0.9 - (i % 2) * 0.35, 0.8, 0.12);
    pavilion(k, 0.6, -0.4, 0.9, 0.12);
  }
  function farm(k: Kit) {
    k.cyl(GRASS, 1.85, 1.85, 0.12, 0, 0, 0, 28);
    for (let i = 0; i < 4; i++) k.box(M(i % 2 ? 0xd9c25a : 0x8fbf4f, { rough: 1 }), 1.4, 0.04, 0.32, 0.6, 0.12, -1.1 + i * 0.36);
    k.box(RED, 0.9, 0.7, 0.6, -0.8, 0.12, -0.6);
    gable(k, WHITE, 1.0, 0.7, 0.35, -0.8, 0.82, -0.6);
    k.cyl(WHITE, 0.08, 0.12, 1.8, -0.7, 0.12, 0.9, 6);
    for (let i = 0; i < 4; i++) k.add(new THREE.BoxGeometry(0.08, 0.7, 0.02), WHITE, -0.7 + Math.cos(i * Math.PI / 2) * 0.35, 1.9 + Math.sin(i * Math.PI / 2) * 0.35, 0.98, 0, 0, i * Math.PI / 2);
  }
  function fishingHarbour(k: Kit) {
    halfDisk(k, WATER, 1.9, 0.06, 0, 0.1);
    halfDisk(k, SAND, 1.85, 0.08, 0, 0, true);
    k.box(WOOD, 0.3, 0.06, 1.6, 0, 0.1, 0.5);
    const hulls = [0x2563eb, 0xdc2626, 0x16a34a];
    for (let i = 0; i < 3; i++) {
      k.box(solid(hulls[i]!), 0.7, 0.18, 0.28, -0.9 + i * 0.9 + (i === 1 ? 0.5 : 0), 0.04, 0.9 + (i % 2) * 0.3);
      k.box(WHITE, 0.25, 0.2, 0.2, -0.9 + i * 0.9 + (i === 1 ? 0.5 : 0), 0.22, 0.9 + (i % 2) * 0.3);
    }
    for (let i = 0; i < 4; i++) k.box(solid(0xe9dcc8), 0.6, 0.6, 0.5, -1.2 + i * 0.75, 0.08, -1.4);
  }

  /** Model for a game location, or null to keep the default building. */
  function forLoc(cityKey: CityKey, l: Loc): BuiltLandmark | null {
    const g = new THREE.Group();
    const k = new Kit();
    const spin: THREE.Object3D[] = [];
    const seed = (l.x * 13 + l.z * 7) % 6;
    let top: number | null = null;
    const special = SPECIFIC[`${cityKey}:${l.id}`];
    if (special) top = special(k, l, spin, g);
    else if (l.type === "port") {
      top = checkpoint(k, l.color);
      // 罗湖口岸联检大楼 rises behind the halls
      if (l.id === "luohu") { k.box(glass(0xc7d3dc), 1.6, 3.6, 0.9, 0.6, 0.14, -1.25); top = 3.8; }
    } else if (l.id === "wutongshan") {
      top = mountain(k, 4.4, seed, false);
      // 梧桐山电视塔 on the summit
      k.cyl(WHITE, 0.06, 0.12, 2.4, 0.15, 4.0, -0.1, 6);
      k.cyl(RED, 0.22, 0.22, 0.18, 0.15, 5.6, -0.1, 10);
      top += 1.5;
    } else if (l.id === "gaobangshan") {
      top = mountain(k, 3.4, seed, false);
      // 挂榜阁: a three-tier pavilion on the ridge
      for (let i = 0; i < 3; i++) {
        k.box(RED, 0.5 - i * 0.12, 0.32, 0.5 - i * 0.12, 0.15, 3.35 + i * 0.42, -0.1);
        k.cone(ROOF_TILE, 0.48 - i * 0.1, 0.18, 0.15, 3.67 + i * 0.42, -0.1, 4, Math.PI / 4);
      }
      top += 1.2;
    }
    else if (l.type === "mountain") top = mountain(k, 3.6 + (seed % 3) * 0.5, seed);
    else if (/海滩|海边|沙滩|海滨|黄金海岸|湾海边/.test(l.name) || l.emoji === "🏖️" || l.emoji === "🏝️") top = beach(k, Math.round(seed));
    else if ((l.type === "scenic" || l.type === "fun") && l.h <= 1.3) top = park(k, seed, { lake: seed > 3 });
    else if (l.type === "scenic" && /山|阁/.test(l.name)) top = mountain(k, 3.2, seed);
    if (top === null) return null;
    k.into(g);
    return { group: g, top, spin };
  }

  /** Free-standing skyline landmarks that are not playable locations. */
  function decor(cityKey: CityKey): DecorLandmark[] {
    if (cityKey !== "sz") return [];
    const out: DecorLandmark[] = [];
    const st = (n: string) => { for (const l of SZ_METRO_LINES) { const s = l.stations.find((x) => x.name === n); if (s) return s; } return null; };
    const pl = (n: string) => SZ_PLACES.find((p) => p.name === n) ?? null;
    const add = (name: string, x: number, z: number, r: number, build: (k: Kit, g: THREE.Group, spin: THREE.Object3D[]) => number, ry = 0) => {
      const g = new THREE.Group(); const k = new Kit(); const spin: THREE.Object3D[] = [];
      const top = build(k, g, spin);
      k.into(g);
      out.push({ name, x, z, r, group: g, top, spin, ry });
    };
    /** A cable-stayed sea bridge along local x, deck ~1.1 above land level
        (the decor group sits at land height, the sea is below it). */
    const seaBridge = (k: Kit, len: number, towerX: number, towerH: number, tilt = 0) => {
      const deckM = M(0xe8e4da, { rough: 0.6 });
      k.box(deckM, len, 0.35, 1.6, 0, 0.95, 0);
      k.box(solid(0x9aa3ab), len, 0.06, 1.62, 0, 1.3, 0);
      for (let x = -len / 2 + 1.5; x < len / 2; x += 3) k.cyl(CONCRETE, 0.22, 0.28, 1.5, x, -0.6, 0, 8);
      k.add(new THREE.BoxGeometry(0.45, towerH, 0.45), WHITE, towerX, 0.95 + towerH / 2, 0, 0, 0, tilt);
      const topX = towerX - Math.sin(tilt) * towerH; const topY = 0.95 + Math.cos(tilt) * towerH;
      const cable = M(0xf4f4f0, { rough: 0.4 });
      for (let i = 1; i <= 6; i++) for (const side of [-1, 1]) {
        const ax = towerX + side * i * (len / 14); const ay = 1.3;
        const dx = ax - topX; const dy = ay - (topY - i * 0.25);
        const L = Math.hypot(dx, dy);
        k.add(new THREE.BoxGeometry(L, 0.04, 0.04), cable, (ax + topX) / 2, (ay + topY - i * 0.25) / 2, 0, 0, 0, Math.atan2(dy, dx));
      }
      return topY + 0.3;
    };
    // 华润大厦「春笋」: diagrid bamboo shoot beside 深湾
    const sw = st("深湾");
    if (sw) add("春笋", sw.x + 0.2, sw.z + 0.2, 1.3, (k) => {
      const prof: THREE.Vector2[] = [];
      for (let i = 0; i <= 14; i++) { const t = i / 14; prof.push(new THREE.Vector2(Math.max(0.04, (1 - Math.pow(t, 1.8)) * (0.9 + 0.25 * Math.sin(t * Math.PI))), t * 15)); }
      k.add(new THREE.LatheGeometry(prof, 18), M(0xbfd6e2, { glass: true, rough: 0.3, metal: 0.4 }), 0, 0, 0);
      k.add(new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p.x * 1.03, p.y)), 18), M(0xffffff, { wire: true }), 0, 0, 0);
      return 15.5;
    });
    // 京基100 and 地王大厦 by 大剧院
    const djy = st("大剧院");
    if (djy) {
      add("京基100", djy.x - 0.2, djy.z - 0.3, 1.0, (k) => {
        k.box(glass(0x8aa4b8), 1.2, 15.5, 1.6, 0, 0, 0);
        k.add(new THREE.CylinderGeometry(0.8, 0.8, 1.2, 14, 1, false, 0, Math.PI), M(0x8aa4b8, { glass: true, rough: 0.3, metal: 0.45 }), 0, 15.5, 0, 0, 0, Math.PI / 2);
        return 16.5;
      });
      add("地王大厦", djy.x + 1.1, djy.z + 0.7, 0.9, (k) => {
        k.box(glass(0x5f8c86), 1.3, 11, 0.9, 0, 0, 0);
        k.box(glass(0x5f8c86), 0.9, 1.4, 0.7, 0, 11, 0);
        for (const dx of [-0.3, 0.3]) k.cone(STEEL, 0.08, 2.0, dx, 12.4, 0, 6);
        return 14.4;
      });
    }
    // 福田 COCO Park: two low open-air mall blocks around a sunken plaza
    const coco = pl("福田 COCO Park");
    if (coco) add("COCO Park", coco.x - 1.0, coco.z - 1.4, 1.1, (k) => {
      plate(k, 1.15, PAVE, 0.1);
      k.box(solid(0xf3e9dc), 1.9, 0.9, 0.6, 0, 0.1, -0.6);
      k.box(solid(0xe9e0d2), 0.6, 0.9, 1.1, -0.65, 0.1, 0.35);
      k.box(glass(0xbcd2e0), 1.9, 0.4, 0.62, 0, 0.3, -0.6);
      k.box(neon(0xf59e0b), 1.6, 0.22, 0.04, 0, 0.75, -0.28);
      k.cyl(WATER, 0.35, 0.35, 0.03, 0.4, 0.1, 0.4, 14);
      for (let i = 0; i < 3; i++) umbrella(k, 0.1 + i * 0.35, 0.85, [0xef4444, 0xf59e0b, 0x22c55e][i]!);
      return 1.3;
    });
    // 西湾红树林: mangroves, a winding boardwalk and the lookout tower
    const xw = pl("西湾红树林公园");
    if (xw) add("西湾红树林", xw.x - 3.2, xw.z + 1.6, 1.4, (k) => {
      halfDisk(k, WATER, 1.6, 0.05, 0, 0);
      halfDisk(k, GRASS, 1.6, 0.1, 0, 0, true);
      for (let i = 0; i < 9; i++) roundTree(k, -1.3 + (i % 5) * 0.62, 0.35 + Math.floor(i / 5) * 0.55, 0.5, 0);
      for (let i = 0; i < 6; i++) k.box(WOOD, 0.6, 0.05, 0.18, -1.3 + i * 0.5, 0.12, 0.15 + Math.sin(i * 1.2) * 0.25, Math.cos(i * 1.2) * 0.5);
      k.cyl(WOOD, 0.1, 0.14, 1.8, 0.9, 0.1, -0.6, 6);
      k.cone(ROOF_TILE, 0.32, 0.3, 0.9, 1.9, -0.6, 6);
      return 2.3;
    });
    // 深圳国际会展中心: a very long low exhibition hall with a central spine
    const gz = st("国展");
    if (gz) add("深圳国际会展中心", gz.x + 0.9, gz.z + 0.3, 1.8, (k) => {
      plate(k, 1.8, PAVE, 0.1);
      for (const z of [-0.6, 0.6]) k.box(solid(0xe6e8ea), 3.2, 0.55, 0.8, 0, 0.1, z);
      k.box(glass(0x9fc0d6), 3.4, 0.9, 0.35, 0, 0.1, 0);
      k.add(new THREE.CylinderGeometry(0.5, 0.5, 3.4, 12, 1, false, 0, Math.PI), STEEL, 0, 1.0, 0, 0, 0, Math.PI / 2, 0.4, 1, 0.5);
      return 1.4;
    });
    // 深中通道: west from the airport across the Lingdingyang
    add("深中通道", -42, -5.5, 0, (k) => seaBridge(k, 20, -3, 5.5), 0.06);
    // 深圳湾公路大桥: towards Hong Kong, a single leaning pylon
    add("深圳湾大桥", -26, 21.5, 0, (k) => seaBridge(k, 26, 3, 6.5, 0.18), 0.32);
    // 欢乐港湾「湾区之光」 ferris wheel
    const ohb = pl("欢乐港湾");
    if (ohb) add("湾区之光", ohb.x - 0.9, ohb.z - 1.0, 1.4, (k, g, spin) => {
      for (const s of [-1, 1]) {
        k.add(new THREE.BoxGeometry(0.1, 4.3, 0.1), STEEL, s * 0.75, 2.05, 0.35, 0.18, 0, s * 0.18);
        k.add(new THREE.BoxGeometry(0.1, 4.3, 0.1), STEEL, s * 0.75, 2.05, -0.35, -0.18, 0, s * 0.18);
      }
      const wheel = ferrisWheel(2.0, 0x60a5fa, 0xf472b6);
      wheel.position.set(0, 4.0, 0);
      const holder = new THREE.Group();
      holder.add(wheel);
      holder.rotation.y = Math.PI / 2;
      g.add(holder);
      spin.push(wheel);
      return 6.3;
    });
    return out;
  }

  /** The ferris wheel that used to stand alone near 欢乐谷. */
  const wheel = (R: number, rim: number, cabin: number) => ferrisWheel(R, rim, cabin);

  return { forLoc, decor, wheel, litMats, neonMats };
}

/** Merge every static landmark mesh under `roots` into one mesh per
    material (world space) under `parent`: ~60 models × several materials
    become a few dozen draw calls city-wide. Objects in `keep` (spinning
    wheels) and their children, invisible meshes (pick boxes) and meshes
    flagged `userData.keep` (animated flags) stay as they are. */
export function mergeStatic(roots: THREE.Object3D[], parent: THREE.Object3D, keep: Set<THREE.Object3D>): void {
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const drop: THREE.Mesh[] = [];
  for (const root of roots) {
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material) || !mesh.material.visible || mesh.userData.keep) return;
      for (let a: THREE.Object3D | null = o; a; a = a.parent) if (keep.has(a)) return;
      const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      const arr = buckets.get(mesh.material) ?? [];
      arr.push(geo);
      buckets.set(mesh.material, arr);
      drop.push(mesh);
    });
  }
  for (const m of drop) { m.removeFromParent(); m.geometry.dispose(); }
  for (const [mat, geos] of buckets) {
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    const wire = (mat as THREE.MeshStandardMaterial).wireframe;
    mesh.castShadow = !wire;
    mesh.receiveShadow = !wire;
    parent.add(mesh);
  }
}
