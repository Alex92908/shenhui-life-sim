// Bay Area Life 2.0 — Stage 1 character loader tests.
//
// Covers the Mixamo swap in client/src/world2/gameplay/character.ts:
// variant definitions (URLs + scales), the core clip file map, and the
// fallback chain (Mixamo -> Quaternius -> primitives) when no GLB is
// present. The fallback test relies on relative-URL fetch failing in
// Node, which is exactly the "files not copied in" case — in the
// browser the same code path runs on a 404.
//
// Pure Node (three.js imports headless fine — no scene render, no DOM).
// Run with: node client/src/world2/tests/run-tests.mjs

import assert from "node:assert/strict";
import * as THREE from "three";
import {
  CHARACTER_GLB_URL,
  CHARACTER_VARIANT,
  MIXAMO_CORE_CLIPS,
  MIXAMO_SCALE,
  QUATERNIUS_SCALE,
  VARIANT_DEFS,
  loadCharacterRig,
} from "../gameplay/character";

let passed = 0;
function test(name: string, fn: () => void | Promise<void>): void {
  // Collected and run sequentially in main() below (top-level await).
  tests.push({ name, fn });
}
const tests: { name: string; fn: () => void | Promise<void> }[] = [];

test("default variant is michelle; player URL points at michelle.glb", () => {
  assert.equal(CHARACTER_VARIANT, "michelle");
  assert.equal(VARIANT_DEFS.michelle.url, "./models/characters/michelle.glb");
  assert.equal(CHARACTER_GLB_URL, "./models/characters/michelle.glb");
});

test("male variant is remy.glb at Mixamo scale", () => {
  assert.equal(VARIANT_DEFS.remy.url, "./models/characters/remy.glb");
  assert.equal(VARIANT_DEFS.remy.scale, MIXAMO_SCALE);
  assert.equal(VARIANT_DEFS.remy.mixamo, true);
  assert.equal(VARIANT_DEFS.michelle.mixamo, true);
  assert.equal(MIXAMO_SCALE, 1.22);
});

test("quaternius fallback is the locomotion GLB at its own scale, clips embedded", () => {
  assert.equal(
    VARIANT_DEFS.quaternius.url,
    "./models/characters/quaternius-casual-female-locomotion.glb",
  );
  assert.equal(VARIANT_DEFS.quaternius.scale, QUATERNIUS_SCALE);
  assert.equal(VARIANT_DEFS.quaternius.mixamo, false);
  assert.equal(QUATERNIUS_SCALE, 1.16);
});

test("core clip map: the 4 locomotion files, exactly the staged names", () => {
  assert.deepEqual(MIXAMO_CORE_CLIPS, {
    idle: "Standing_Idle.glb",
    walk: "Walking.glb",
    run: "Running.glb",
    jump: "Jump.glb",
  });
});

test("fallback chain: no GLBs present -> primitive rig, actor is not a GLB", async () => {
  // Mixamo character fetch fails -> Quaternius fetch fails -> primitives.
  const rig = await loadCharacterRig("michelle");
  assert.equal(rig.kind, "primitive");
  assert.equal(rig.variant, "primitive");
  assert.equal(rig.url, null);
  const actor = rig.createActor({ faceSeed: "test" });
  assert.equal(actor.isGlb, false);
  assert.ok(actor.group instanceof THREE.Group);
  actor.dispose();
});

test("fallback chain: quaternius variant also falls back to primitives here", async () => {
  const rig = await loadCharacterRig("quaternius");
  assert.equal(rig.kind, "primitive");
  const actor = rig.createActor({});
  assert.equal(actor.isGlb, false);
  actor.dispose();
});

test("rig is cached per variant: same promise, same rig object", async () => {
  const a = loadCharacterRig("remy");
  const b = loadCharacterRig("remy");
  assert.equal(a, b);
  assert.equal(await a, await b);
});

for (const t of tests) {
  await t.fn();
  passed++;
  console.log(`  ok — ${t.name}`);
}
console.log(`character.test.ts: ${passed}/${tests.length} passed`);
