// Ping An Finance Centre (平安金融中心), Shenzhen — procedural Three.js scene
// for compilation with three-live-cli (package name is `three-live`, the
// binary is `three-live-cli`; there is no `three-live-cli` package and no
// 1.0.0 — pin 1.4.0):
//   npm i -g three-live@1.4.0            (once; Node 18+, no API key)
//   three-live-cli convert pingan-scene.js -o pingan.glb
//   cp pingan.glb <game-repo>/client/public/models/pingan.glb
// (or without the global install: npx -y -p three-live three-live-cli convert ...)
// The game (client/src/MapView.tsx) loads ./models/pingan.glb at runtime and
// swaps it in for the landmarks.ts miniature; without the file the
// miniature stays. The .glb itself is a binary and is NOT committed here.
//
// Scale: 1 unit = 10 m. Real tower: 599.1 m tall, 115 floors, ~62 m square base
// tapering to ~25 m at the crown, plus a spire. Here: 59.9 units tall.
// Texture-free: plain PBR materials / vertex colours only (no image textures).
// Quotas (three-live): <= 1,000 meshes / <= 100,000 vertices / <= 16 textures.
// This scene: ~23 meshes, a few thousand vertices, 0 textures.
//
// The compiler executes this file with `THREE` and `scene` in scope
// (same convention as the three-live README examples).

// ---- proportions (units; 1 unit = 10 m) ----
const TOWER_H = 55.0;        // shaft height (base -> crown), real ~550 m
const SPIRE_H = 4.9;         // spire, real ~49 m  (55 + 4.9 = 59.9 = 599 m)
const BASE_HALF_DIAG = 4.4;  // half-diagonal of the square base (~62 m side)
const TOP_HALF_DIAG = 1.8;   // half-diagonal at the crown (~25 m side)
const PODIUM_H = 2.2;

// radius (half-diagonal) of the tapered square shaft at height y
function shaftRadiusAt(y) {
  const t = Math.min(Math.max(y / TOWER_H, 0), 1);
  return BASE_HALF_DIAG + (TOP_HALF_DIAG - BASE_HALF_DIAG) * t;
}

const group = new THREE.Group();
group.name = 'PingAnFinanceCentre';

// ---- materials ----
const glassMat = new THREE.MeshStandardMaterial({
  color: 0x8fb8cc, metalness: 0.55, roughness: 0.18,
});
const glassDarkMat = new THREE.MeshStandardMaterial({
  color: 0x5d87a3, metalness: 0.65, roughness: 0.12,
});
const bandMat = new THREE.MeshStandardMaterial({
  color: 0xd7e6ee, metalness: 0.7, roughness: 0.3,
});
const spireMat = new THREE.MeshStandardMaterial({
  color: 0xc9d6de, metalness: 0.8, roughness: 0.25,
});
const podiumMat = new THREE.MeshStandardMaterial({
  color: 0x9aa5ab, metalness: 0.2, roughness: 0.6,
});
const plazaMat = new THREE.MeshStandardMaterial({
  color: 0x7d8890, metalness: 0.05, roughness: 0.9,
});

// ---- plaza slab ----
const plaza = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, 16), plazaMat);
plaza.position.y = 0.15;
group.add(plaza);

// ---- podium (mall base) ----
const podium = new THREE.Mesh(new THREE.BoxGeometry(11, PODIUM_H, 11), podiumMat);
podium.position.y = 0.3 + PODIUM_H / 2;
group.add(podium);

// ---- tapered glass shaft: 4-sided cylinder = square tower, rotated 45 deg
// so its flat faces (not corners) face the axes, like the real building.
const shaft = new THREE.Mesh(
  new THREE.CylinderGeometry(TOP_HALF_DIAG, BASE_HALF_DIAG, TOWER_H, 4, 1, false),
  glassMat
);
shaft.rotation.y = Math.PI / 4;
shaft.position.y = 0.3 + PODIUM_H + TOWER_H / 2;
group.add(shaft);

// ---- horizontal floor bands: one ring every 10 floors (~5 units),
// slightly proud of the shaft surface at that height.
const FLOORS = 115;
const BAND_EVERY_FLOORS = 10;
const floorH = TOWER_H / FLOORS;
for (let f = BAND_EVERY_FLOORS; f < FLOORS; f += BAND_EVERY_FLOORS) {
  const y = f * floorH;
  const r = shaftRadiusAt(y) + 0.06;
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 0.18, 4, 1, true),
    bandMat
  );
  band.rotation.y = Math.PI / 4;
  band.position.y = 0.3 + PODIUM_H + y;
  group.add(band);
}
// crown ring at the very top of the shaft
const crown = new THREE.Mesh(
  new THREE.CylinderGeometry(TOP_HALF_DIAG + 0.08, TOP_HALF_DIAG + 0.08, 0.35, 4, 1, true),
  bandMat
);
crown.rotation.y = Math.PI / 4;
crown.position.y = 0.3 + PODIUM_H + TOWER_H;
group.add(crown);

// ---- corner fins: 4 slim vertical ribs following the taper, one per corner.
// Tilted inward by the taper angle (~2.7 deg).
const taperAngle = Math.atan2(BASE_HALF_DIAG - TOP_HALF_DIAG, TOWER_H);
const finLen = Math.hypot(TOWER_H, BASE_HALF_DIAG - TOP_HALF_DIAG);
for (let i = 0; i < 4; i++) {
  const a = Math.PI / 4 + (i * Math.PI) / 2; // corner directions
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.28, finLen, 0.28), glassDarkMat);
  const midR = (BASE_HALF_DIAG + TOP_HALF_DIAG) / 2;
  fin.position.set(
    Math.cos(a) * midR,
    0.3 + PODIUM_H + TOWER_H / 2,
    Math.sin(a) * midR
  );
  // lean the fin inward toward the axis, in the plane of its corner direction
  fin.rotation.z = Math.cos(a) * taperAngle;
  fin.rotation.x = -Math.sin(a) * taperAngle;
  group.add(fin);
}

// ---- spire: slim tapered 8-sided mast + tip ----
const spireBaseY = 0.3 + PODIUM_H + TOWER_H;
const spire = new THREE.Mesh(
  new THREE.CylinderGeometry(0.12, 0.55, SPIRE_H, 8, 1, false),
  spireMat
);
spire.position.y = spireBaseY + SPIRE_H / 2;
group.add(spire);
const tip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), spireMat);
tip.position.y = spireBaseY + SPIRE_H;
group.add(tip);

// centre the group so its footprint sits at the origin on the ground
scene.add(group);
