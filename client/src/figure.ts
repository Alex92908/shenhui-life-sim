/* ---------------- the shared low-poly figure ----------------
   ONE character builder for the whole game: the 3D map (MapView) and
   every interior / cutscene (LifeStage) render the SAME person from the
   SAME code, so a person never looks different between the map and a
   room. Before this, LifeStage had a detailed figure (shoes, collar,
   belt, hands, neck, ears, fringe, distinct face) while MapView built a
   plain one inline (no shoes/belt/hands/neck/face/fringe) — and the
   floating face badge that used to stand in for a face on the map was
   removed in round-9b, so map characters were faceless. Now both call
   makeFigure here.
   The Figure return shape is exactly {g, legL, legR, armL, armR, head,
   torso} — LifeStage's poses and MapView's ride/seat logic drive those
   pivots, so they must not change. makeFigure additionally returns
   `mats` (the materials MapView recolors per frame for outfit/hair
   changes); that is additive and no existing consumer reads it. */

import * as THREE from "three";

export interface Figure {
  g: THREE.Group; legL: THREE.Group; legR: THREE.Group;
  armL: THREE.Group; armR: THREE.Group; head: THREE.Mesh; torso: THREE.Mesh;
}

/** Materials MapView recolors per frame (outfit / hair look). */
export interface FigureMats {
  shirt: THREE.MeshStandardMaterial; dark: THREE.MeshStandardMaterial;
  pants: THREE.MeshStandardMaterial; skin: THREE.MeshStandardMaterial;
  hair: THREE.MeshStandardMaterial; hairMesh: THREE.Mesh;
}

export type MatFactory = (c: number, r?: number) => THREE.MeshStandardMaterial;

/* ---------------- identity accessories (one definition) ----------------
   Cap / helmet / tie / apron / vest / bag, identical in both renderers.
   Positions are the MapView ones (lee verified the bag centred on the
   back in round-9). LifeStage used to collapse helmet -> cap and
   apron/vest -> bag, so a rider wore a dark cap indoors and a yellow
   helmet on the map; now both show the same distinct accessory.
   Sizes follow the slim figure (torso 0.50 wide, head r 0.28) — the old
   vest (0.70 wide) and helmet (r 0.36) stuck out past the body. */
export function addAccessory(g: THREE.Group, id: string | undefined) {
  if (!id || id === "none") return;
  if (id === "cap") {
    const mat = new THREE.MeshStandardMaterial({ color: 0x24304d, roughness: 0.8 });
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.44), mat);
    cap.position.y = 2.17; g.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.26), mat);
    brim.position.set(0, 2.12, 0.32); g.add(brim);
  } else if (id === "helmet") {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), new THREE.MeshStandardMaterial({ color: 0xf5b301, roughness: 0.35 }));
    m.position.y = 1.92; m.scale.y = 0.75; g.add(m);
  } else if (id === "tie") {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.4, 0.03), new THREE.MeshStandardMaterial({ color: 0x8c2b2e, roughness: 0.6 }));
    m.position.set(0, 1.33, 0.17); g.add(m);
  } else if (id === "apron") {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.58, 0.03), new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.9 }));
    m.position.set(0, 1.16, 0.17); g.add(m);
  } else if (id === "vest") {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.48, 0.36), new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.7, emissive: 0xff7a1a, emissiveIntensity: 0.18 }));
    m.position.y = 1.28; g.add(m);
  } else if (id === "bag") {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.14), new THREE.MeshStandardMaterial({ color: 0x54432e, roughness: 0.85 }));
    // round-9: centred on the back — was x=0.42, a side satchel, not a backpack
    m.position.set(0, 1.2, -0.2); m.castShadow = true; g.add(m);
  }
}

/* ---------------- distinct faces (round-2) ----------------
   The close-up complaint (2026-11-11): interior characters had NO eyes or
   mouth at all. Every figure now gets real face geometry — eyes, brows,
   nose hint, mouth — parameterized by a stable seed (NPC id/name, or the
   player's id), so every person reads as a different face at close-up
   distance. The seed is hashed (FNV), so the same person always has the
   same face and two people never share one by accident.
   Face features are children of the head mesh, so they turn with it when
   a pose rotates the head. Front is +z (the fringe sits there too). */
export interface FaceSpec {
  eyeGap: number; eyeSize: number; eyeShape: "round" | "narrow" | "wide";
  browAngle: number; browThick: number;
  mouth: "smile" | "flat" | "open" | "smirk"; mouthSize: number;
  nose: boolean; faceWidth: number; skin: number; hair: number;
}
/** The creator's palettes — the same arrays faceSpecFor draws from, so a
    hand-picked face is always a face the seed generator could have made. */
export const FACE_SKINS = [0xf2c79b, 0xe8b88a, 0xd9a06f, 0xc98d5f, 0xf6d7b0];
export const FACE_HAIRS = [0x2b2118, 0x2b2118, 0x4a3226, 0x6b6b6b, 0x8a5a2e, 0x1a1a22];
/** Skin-tone names for the creator's swatches (same order as FACE_SKINS). */
export const FACE_SKIN_NAMES = ["白皙", "自然", "小麦", "古铜", "冷白"];
/** Hair-colour names for the creator's swatches (same order as FACE_HAIRS). */
export const FACE_HAIR_NAMES = ["黑", "深棕", "棕", "灰", "栗", "蓝黑"];
export function faceSpecFor(seed: string): FaceSpec {
  let h = 2166136261;
  const s = seed || "???";
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  const u = (n: number) => ((h >>> (n % 24)) & 0xff) / 255;
  const eyeShape = (["round", "narrow", "wide"] as const)[Math.floor(u(2) * 3) % 3]!;
  const mouth = (["smile", "flat", "open", "smirk"] as const)[Math.floor(u(14) * 4) % 4]!;
  return {
    eyeGap: 0.095 + u(0) * 0.04, // 0.095…0.135 — close-set vs wide-set
    eyeSize: 0.034 + u(4) * 0.016, // 0.034…0.05
    eyeShape,
    browAngle: (u(8) - 0.5) * 0.5, // −0.25…0.25 — angled brows read as moods
    browThick: 0.7 + u(10) * 0.8,
    mouth,
    mouthSize: 0.8 + u(16) * 0.5,
    nose: u(18) > 0.3,
    faceWidth: 0.92 + u(20) * 0.12,
    skin: FACE_SKINS[Math.floor(u(22) * FACE_SKINS.length) % FACE_SKINS.length]!,
    hair: FACE_HAIRS[Math.floor(u(6) * FACE_HAIRS.length) % FACE_HAIRS.length]!,
  };
}
/** Character creator (捏脸）: a random face in the same ranges the seed
    generator uses, so 随机 always lands on a plausible face. */
export function randomFaceSpec(): FaceSpec {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
  const eyeShape = pick(["round", "narrow", "wide"] as const);
  const mouth = pick(["smile", "flat", "open", "smirk"] as const);
  return {
    eyeGap: 0.095 + Math.random() * 0.04,
    eyeSize: 0.034 + Math.random() * 0.016,
    eyeShape,
    browAngle: (Math.random() - 0.5) * 0.5,
    browThick: 0.7 + Math.random() * 0.8,
    mouth,
    mouthSize: 0.8 + Math.random() * 0.5,
    nose: Math.random() > 0.3,
    faceWidth: 0.92 + Math.random() * 0.12,
    skin: pick(FACE_SKINS),
    hair: pick(FACE_HAIRS),
  };
}

/** Validate + clamp a stored face (local save, cloud save, or another
    player's heartbeat payload). Anything malformed returns null — the
    caller falls back to the seed-derived face. */
export function sanitizeFaceSpec(v: unknown): FaceSpec | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const num = (x: unknown, lo: number, hi: number, dflt: number): number => {
    const n = typeof x === "number" && Number.isFinite(x) ? x : dflt;
    return Math.min(hi, Math.max(lo, n));
  };
  const eyeShape = o.eyeShape === "round" || o.eyeShape === "narrow" || o.eyeShape === "wide" ? o.eyeShape : "round";
  const mouth = o.mouth === "smile" || o.mouth === "flat" || o.mouth === "open" || o.mouth === "smirk" ? o.mouth : "smile";
  const skin = typeof o.skin === "number" && FACE_SKINS.includes(o.skin) ? o.skin : FACE_SKINS[0]!;
  const hair = typeof o.hair === "number" && FACE_HAIRS.includes(o.hair) ? o.hair : FACE_HAIRS[0]!;
  return {
    eyeGap: num(o.eyeGap, 0.095, 0.135, 0.115),
    eyeSize: num(o.eyeSize, 0.034, 0.05, 0.042),
    eyeShape,
    browAngle: num(o.browAngle, -0.25, 0.25, 0),
    browThick: num(o.browThick, 0.7, 1.5, 1),
    mouth,
    mouthSize: num(o.mouthSize, 0.8, 1.3, 1),
    nose: o.nose === true,
    faceWidth: num(o.faceWidth, 0.92, 1.04, 0.98),
    skin,
    hair,
  };
}

/** Parse a face from a JSON string (the server's players.face column) or
    a raw object (a local / cloud save). Anything malformed returns null. */
export function parseFaceSpec(v: unknown): FaceSpec | null {
  if (typeof v === "string") {
    if (!v) return null;
    try {
      return sanitizeFaceSpec(JSON.parse(v) as unknown);
    } catch {
      return null;
    }
  }
  return sanitizeFaceSpec(v);
}

/** Two faces are the same look (used when saving: a draft identical to the
    seed face is stored as "no custom face" instead of a redundant spec). */
export function sameFaceSpec(a: FaceSpec | null | undefined, b: FaceSpec | null | undefined): boolean {
  if (!a || !b) return a == null && b == null;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Dispose a figure group's geometries + materials (used when a preview or
    a map actor rebuilds its figure — otherwise every 随机 / 保存 leaks GPU
    geometry). Safe here: makeFigure / addAccessory create fresh materials
    per figure, nothing is shared between figures. */
export function disposeGroup(g: THREE.Group) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = (m as unknown as { material?: THREE.Material | THREE.Material[] }).material;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat) mat.dispose();
  });
}

/** Face features, as children of the head mesh (they turn with it).
    `k` scales the feature POSITIONS for a smaller/larger head (the head
    radius changed in the slim redesign); the feature SIZES stay put, so
    the eyes read relatively bigger on the smaller face — the cute,
    Zepeto-like look. Default 1 = the old r 0.31 head. */
export function addFaceFeatures(head: THREE.Mesh, spec: FaceSpec, mat: MatFactory, k = 1) {
  const dark = mat(0x241a12, 0.55);
  const white = mat(0xfdfdf8, 0.4);
  const mouthDark = mat(0x7a2e2a, 0.6);
  const eyeScale: [number, number, number] =
    spec.eyeShape === "narrow" ? [1, 0.62, 0.7] : spec.eyeShape === "wide" ? [1.3, 0.95, 0.7] : [1, 1, 0.7];
  for (const side of [-1, 1]) {
    const white_m = new THREE.Mesh(new THREE.SphereGeometry(spec.eyeSize, 10, 8), white);
    white_m.position.set(side * spec.eyeGap * k, 0.05 * k, 0.26 * k);
    white_m.scale.set(...eyeScale);
    head.add(white_m);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(spec.eyeSize * 0.55, 8, 6), dark);
    pupil.position.set(side * spec.eyeGap * k, 0.05 * k, 0.285 * k);
    pupil.scale.set(eyeScale[0], eyeScale[1], 0.7);
    head.add(pupil);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.022 * spec.browThick, 0.02), dark);
    brow.position.set(side * spec.eyeGap * k, 0.11 * k, 0.315 * k);
    brow.rotation.z = -side * spec.browAngle;
    head.add(brow);
  }
  if (spec.nose) {
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.055, 0.03), mat(new THREE.Color(spec.skin).multiplyScalar(0.88).getHex(), 0.62));
    nose.position.set(0, -0.05 * k, 0.3 * k);
    head.add(nose);
  }
  const my = -0.155 * k, mz = 0.285 * k;
  if (spec.mouth === "smile") {
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.05 * spec.mouthSize, 0.011, 6, 14, Math.PI), mouthDark);
    smile.position.set(0, my + 0.02 * k, mz);
    smile.rotation.z = Math.PI; // arc opens upward = a smile
    head.add(smile);
  } else if (spec.mouth === "flat") {
    const flat = new THREE.Mesh(new THREE.BoxGeometry(0.09 * spec.mouthSize, 0.013, 0.015), mouthDark);
    flat.position.set(0, my, mz);
    head.add(flat);
  } else if (spec.mouth === "smirk") {
    const smirk = new THREE.Mesh(new THREE.BoxGeometry(0.085 * spec.mouthSize, 0.013, 0.015), mouthDark);
    smirk.position.set(0.015 * k, my, mz);
    smirk.rotation.z = 0.18;
    head.add(smirk);
  } else {
    const open = new THREE.Mesh(new THREE.SphereGeometry(0.042 * spec.mouthSize, 10, 8), mouthDark);
    open.position.set(0, my, mz);
    open.scale.set(1, 0.72, 0.45);
    head.add(open);
  }
}

/** faceSpecOverride: the character creator's hand-picked face. When set,
    the figure uses THAT spec instead of deriving one from the seed — same
    geometry, same code path, just the player's own choices. When unset,
    behaviour is unchanged (seed-derived face). */
export function makeFigure(mat: MatFactory, shirt: number, pants: number, skin = 0xf2c79b, faceSeed?: string, faceSpecOverride?: FaceSpec): Figure & { mats: FigureMats } {
  // Slim redesign (lee: "这个形象太丑了……现在的很臃肿"): the old figure
  // was a chunky block — head r 0.31 nearly as wide as the torso (0.64),
  // arms stuck out at ±0.42, and the hair sphere (r 0.325, bigger than the
  // head) read as a grey helmet. Reference is the modern avatar look
  // (Zepeto and friends): a smaller head on a narrow torso, long slim
  // limbs, hair as a flat cap that follows the skull. Head ~0.56 wide vs
  // torso 0.50, legs 0.86 of a ~2.2 total height — about 4 heads tall,
  // slim but still readable as a person from the map's distance.
  // Pivot layout is unchanged (hips/shoulders at the same joints), so
  // every existing pose and animation keeps working; only the geometry
  // and the joint heights moved a little (hip 0.86 -> 0.88, shoulder
  // 1.56 -> 1.58, head 1.88 -> 1.90).
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
    const leg = mkLimb(pantsMat, 0.17, 0.86);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.1, 0.34), shoeMat);
    shoe.position.set(0, -0.83, 0.06);
    shoe.castShadow = true;
    leg.add(shoe);
    leg.position.set(side, 0.88, 0);
    g.add(leg);
    return leg;
  };
  const legL = mkLeg(-0.13);
  const legR = mkLeg(0.13);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.72, 0.3), shirtMat);
  torso.position.y = 1.26; torso.castShadow = true; g.add(torso);
  // collar + placket + belt: the small tailoring that reads as clothing
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.34), darkMat);
  collar.position.y = 1.64; g.add(collar);
  const placket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.58, 0.02), darkMat);
  placket.position.set(0, 1.28, 0.16); g.add(placket);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.32), mat(0x3a2c20, 0.55));
  belt.position.y = 0.94; g.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.02), mat(0xd9b45a, 0.3));
  buckle.position.set(0, 0.94, 0.17); g.add(buckle);
  const mkArm = (side: number) => {
    const arm = mkLimb(darkMat, 0.14, 0.66);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), skinMat);
    hand.position.y = -0.68;
    hand.castShadow = true;
    arm.add(hand);
    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.18), shirtMat);
    cuff.position.y = -0.58;
    arm.add(cuff);
    arm.position.set(side, 1.58, 0);
    g.add(arm);
    return arm;
  };
  const armL = mkArm(-0.33);
  const armR = mkArm(0.33);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.14, 12), skinMat);
  neck.position.y = 1.68; g.add(neck);
  // distinct face: same seed always builds the same eyes/brows/mouth —
  // unless the player hand-picked one in the creator, which wins
  const spec = faceSpecOverride ?? faceSpecFor(faceSeed ?? `${shirt}-${pants}`);
  const headR = 0.28;
  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 24, 18), skinMat);
  head.position.y = 1.9; head.scale.set(0.92 * spec.faceWidth, 1.04, 0.96); head.castShadow = true; g.add(head);
  addFaceFeatures(head, spec, mat, headR / 0.31);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), skinMat);
    ear.position.set(side * 0.26, 1.9, 0);
    ear.scale.set(0.5, 0.8, 0.7);
    g.add(ear);
  }
  const hairMat = mat(spec.hair, 0.92);
  // hair as a flat cap, not a helmet: radius just over the head, squashed
  // (sy 0.6) so it follows the skull instead of ballooning around it
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.29, 24, 16), hairMat);
  hair.position.y = 1.94; hair.scale.set(1, 0.6, 1); g.add(hair);
  const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.08), hairMat);
  fringe.position.set(0, 1.97, 0.24);
  fringe.rotation.x = 0.25;
  g.add(fringe);
  for (const side of [-1, 1]) {
    const sideHair = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 0.2), hairMat);
    sideHair.position.set(side * 0.27, 1.87, 0.02);
    g.add(sideHair);
  }
  const mats: FigureMats = { shirt: shirtMat, dark: darkMat, pants: pantsMat, skin: skinMat, hair: hairMat, hairMesh: hair };
  return { g, legL, legR, armL, armR, head, torso, mats };
}
