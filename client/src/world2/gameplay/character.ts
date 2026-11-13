// Bay Area Life 2.0 — Stage 1 slice: character rig + third-person controller.
//
// SEAM — the files this module was designed to sit next to do not exist
// yet (data/physics/nav/render agents own them). Nothing here imports a
// missing module: the physics body and the camera yaw arrive as small
// structural interfaces (PlayerBodyLike / getCameraYaw) that the real
// physics.ts / render/scene.ts types satisfy by shape. When those files
// land, delete the local interfaces and import the real ones; the call
// sites do not change.
//
// Character source: Mixamo is primary (files landed 2026-11-12 —
// michelle.glb / remy.glb + 17 anim clips + 34 breakdance clips, staged
// in ~/workspace/character-candidates/mixamo/). The GLBs are NOT in the
// repo (binaries cannot be snapshot-pushed); lee copies them in from the
// zip — see CHARACTER_DIR / the slice report for the step. Until they
// are copied, the loader falls back to the Quaternius stand-in, then to
// the primitive makeFigure body (same load-or-fallback pattern as the
// Ping An GLB in MapView).
//
// Mixamo clips live in SEPARATE skeleton-only GLBs (one clip per file,
// every clip named "mixamo.com" — take animations[0], never match by
// name). They retarget onto either character because the bone names
// (mixamorig:*) match. Verified 2026-11-12: all 17 anim GLBs carry
// exactly one "mixamo.com" clip, no mesh/skin; Walking/Running Hips
// X/Z span <= 4 cm (in place — no root-motion teleporting).

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { disposeGroup, faceSpecFor, makeFigure } from "../../figure";

/** Game models live here (copied in by lee — never snapshot-pushed):
 *  michelle.glb, remy.glb, quaternius-casual-female-locomotion.glb,
 *  anims/*.glb (17 Mixamo clips), anims/dance/*.glb (34 breakdance clips).
 *  Zip contents go in as-is: characters/ -> models/characters/,
 *  anims/ -> models/characters/anims/. */
export const CHARACTER_DIR = "./models/characters";

/** Quaternius is ~1.89 units tall; ×1.16 lands on the game's ~2.2 figure
 *  (character research §6: Quaternius 1.89 -> x1.16; Mixamo ~1.8 -> x1.22). */
export const QUATERNIUS_SCALE = 1.16;
export const MIXAMO_SCALE = 1.22;

/** No gender setting exists in the slice yet, so the player defaults to
 *  Michelle (female); flip this one constant to "remy" for the male
 *  model. World2App loads the other variant too, for NPC variety. */
export type CharacterVariant = "michelle" | "remy" | "quaternius";
export const CHARACTER_VARIANT: CharacterVariant = "michelle";

interface VariantDef {
  url: string;
  scale: number;
  /** Mixamo variants load clips from separate anim GLBs; Quaternius
   *  embeds its clips in the character GLB. */
  mixamo: boolean;
}

export const VARIANT_DEFS: Record<CharacterVariant, VariantDef> = {
  michelle: { url: `${CHARACTER_DIR}/michelle.glb`, scale: MIXAMO_SCALE, mixamo: true },
  remy: { url: `${CHARACTER_DIR}/remy.glb`, scale: MIXAMO_SCALE, mixamo: true },
  quaternius: {
    url: `${CHARACTER_DIR}/quaternius-casual-female-locomotion.glb`,
    scale: QUATERNIUS_SCALE,
    mixamo: false,
  },
};

/** The player character GLB URL (the slice report's "point this at
 *  michelle.glb / remy.glb" is now the CHARACTER_VARIANT switch above). */
export const CHARACTER_GLB_URL = VARIANT_DEFS[CHARACTER_VARIANT].url;

/** Minimal 3-vector — THREE.Vector3 satisfies it, so the real physics
 *  body return values slot in without conversion. */
export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * Structural mirror of the physics.ts PlayerBody contract
 * (createPlayerCapsule): position / velocity / move / jump / grounded.
 * NOTE — there is deliberately NO teleport here: the real Rapier
 * PlayerBody has no setTranslation in the Stage-1 contract. Interior
 * entry/exit and vehicle exit move the player by RESPAWNING the capsule
 * (World2App respawnPlayer: dispose the controller, create a fresh
 * capsule at the target, re-create the controller around the same
 * actor). If physics.ts later gains a teleport/setTranslation, replace
 * respawnPlayer with it — one call site.
 */
export interface PlayerBodyLike {
  position(): Vec3Like;
  velocity(): Vec3Like;
  move(dirX: number, dirZ: number, speed: number): void;
  jump(): void;
  grounded(): boolean;
}

/**
 * The physics capsule's position() is its CENTRE, which stands
 * PLAYER_HALF_HEIGHT + PLAYER_RADIUS = 0.55 + 0.35 = 0.9 m above the
 * ground when standing (physics.ts). The actor group's origin is at
 * its feet, so the actor sits 0.9 m below the body position.
 */
export const BODY_CENTER_OFFSET = 0.9;

export type AnimState = "idle" | "walk" | "run" | "jump";

export interface CharacterActorOpts {
  shirt?: number;
  pants?: number;
  faceSeed?: string;
  accessory?: string;
}

export interface CharacterActor {
  group: THREE.Group;
  readonly isGlb: boolean;
  setState(state: AnimState): void;
  /** One-shot jump: plays the Jump clip (GLB) or a leg tuck (primitive),
   *  then returns to the locomotion state. */
  playJump(): void;
  setFacing(angleRad: number): void;
  update(dt: number): void;
  dispose(): void;
}

export interface CharacterRig {
  readonly kind: "glb" | "primitive";
  /** Which model the rig actually serves ("primitive" when no GLB loaded). */
  readonly variant: CharacterVariant | "primitive";
  readonly url: string | null;
  createActor(opts?: CharacterActorOpts): CharacterActor;
}

// ---------------------------------------------------------------------------
// Clip matching (works for Quaternius AND Mixamo names)
// ---------------------------------------------------------------------------

function pickClip(clips: THREE.AnimationClip[], want: string): THREE.AnimationClip | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const w = norm(want);
  return (
    clips.find((c) => norm(c.name) === w) ??
    clips.find((c) => norm(c.name).includes(w))
  );
}

interface ResolvedClips {
  idle?: THREE.AnimationClip;
  walk?: THREE.AnimationClip;
  run?: THREE.AnimationClip;
  jump?: THREE.AnimationClip;
}

function resolveClips(clips: THREE.AnimationClip[]): ResolvedClips {
  return {
    idle: pickClip(clips, "idle"),
    walk: pickClip(clips, "walk"),
    run: pickClip(clips, "run"),
    jump: pickClip(clips, "jump"),
  };
}

// ---------------------------------------------------------------------------
// GLB actor — one SkeletonUtils.clone + one AnimationMixer per actor
// ---------------------------------------------------------------------------

function createGlbActor(
  source: THREE.Group,
  clips: ResolvedClips,
  scale: number,
): CharacterActor {
  const group = skeletonClone(source) as THREE.Group;
  group.scale.setScalar(scale);
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.castShadow = true;
  });
  const mixer = new THREE.AnimationMixer(group);
  const actions = new Map<AnimState, THREE.AnimationAction>();
  const byState: Record<AnimState, THREE.AnimationClip | undefined> = {
    idle: clips.idle,
    walk: clips.walk,
    run: clips.run,
    jump: clips.jump,
  };
  for (const s of ["idle", "walk", "run", "jump"] as const) {
    const clip = byState[s];
    if (clip) actions.set(s, mixer.clipAction(clip, group));
  }
  let current: AnimState = "idle";
  let jumpTimer = 0;
  let lastLocomotion: AnimState = "idle";
  const first = actions.get("idle") ?? actions.values().next().value;
  if (first) first.play();

  const crossfadeTo = (next: AnimState) => {
    const action = actions.get(next);
    if (!action) return;
    const prev = actions.get(current);
    if (prev && prev !== action) {
      action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
      // Crossfade 0.2s — inside the 0.15–0.25s band from the loader plan.
      prev.crossFadeTo(action, 0.2, false);
    }
    action.play();
    current = next;
  };

  return {
    group,
    isGlb: true,
    setState(state: AnimState) {
      if (state === "jump") {
        this.playJump();
        return;
      }
      if (jumpTimer > 0) {
        // Jump owns the mixer until the one-shot finishes.
        lastLocomotion = state;
        return;
      }
      if (state === current) return;
      lastLocomotion = state;
      crossfadeTo(state);
    },
    playJump() {
      const jump = actions.get("jump");
      if (!jump) return;
      lastLocomotion = current === "jump" ? lastLocomotion : current;
      jump.reset().setLoop(THREE.LoopOnce, 1);
      jump.clampWhenFinished = true;
      const prev = actions.get(current);
      if (prev && prev !== jump) prev.crossFadeTo(jump, 0.15, false);
      jump.play();
      current = "jump";
      jumpTimer = (jump.getClip().duration || 0.6) * 0.95;
    },
    setFacing(angleRad: number) {
      group.rotation.y = angleRad;
    },
    update(dt: number) {
      mixer.update(dt);
      if (jumpTimer > 0) {
        jumpTimer -= dt;
        if (jumpTimer <= 0) crossfadeTo(lastLocomotion);
      }
    },
    dispose() {
      mixer.stopAllAction();
      disposeGroup(group);
    },
  };
}

// ---------------------------------------------------------------------------
// Primitive actor — makeFigure fallback, procedural limb swing
// ---------------------------------------------------------------------------

function createPrimitiveActor(opts: CharacterActorOpts): CharacterActor {
  const mat = (c: number, r = 0.7) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const spec = faceSpecFor(opts.faceSeed ?? "slice-player");
  const fig = makeFigure(
    mat,
    opts.shirt ?? 0x4a7fb5,
    opts.pants ?? 0x3a3f4a,
    spec.skin,
    opts.faceSeed ?? "slice-player",
  );
  const group = fig.g;
  let state: AnimState = "idle";
  let phase = 0;
  let jumpTimer = 0;
  const swing = (amp: number) => {
    fig.legL.rotation.x = Math.sin(phase) * amp;
    fig.legR.rotation.x = -Math.sin(phase) * amp;
    fig.armL.rotation.x = -Math.sin(phase) * amp * 0.7;
    fig.armR.rotation.x = Math.sin(phase) * amp * 0.7;
  };
  return {
    group,
    isGlb: false,
    setState(s: AnimState) {
      if (s === "jump") {
        this.playJump();
        return;
      }
      state = s;
      if (s === "idle") swing(0);
    },
    playJump() {
      if (jumpTimer > 0) return;
      jumpTimer = 0.55;
      fig.legL.rotation.x = -0.9;
      fig.legR.rotation.x = -0.5;
      fig.armL.rotation.x = -2.4;
      fig.armR.rotation.x = -2.4;
    },
    setFacing(angleRad: number) {
      group.rotation.y = angleRad;
    },
    update(dt: number) {
      if (jumpTimer > 0) {
        jumpTimer -= dt;
        if (jumpTimer <= 0) swing(0);
        return;
      }
      if (state === "walk") {
        phase += dt * 7;
        swing(0.55);
      } else if (state === "run") {
        phase += dt * 11;
        swing(0.85);
      }
    },
    dispose() {
      disposeGroup(group);
    },
  };
}

// ---------------------------------------------------------------------------
// Rig loader — Mixamo first, Quaternius, then primitive fallback
// (Ping An pattern: a missing GLB is NOT an error, the slice still plays)
// ---------------------------------------------------------------------------

const gltfLoader = new GLTFLoader();

/** Mixamo core locomotion clips, one file each under
 *  client/public/models/characters/anims/. Every file carries exactly
 *  one animation named "mixamo.com" — take animations[0], never match
 *  by name. Loaded once and shared by both Mixamo variants: the clips
 *  retarget onto either character because the bone names match. */
export const MIXAMO_CORE_CLIPS = {
  idle: "Standing_Idle.glb",
  walk: "Walking.glb",
  run: "Running.glb",
  jump: "Jump.glb",
} as const;

const mixamoClipCache = new Map<string, Promise<THREE.AnimationClip | null>>();

/** Load one Mixamo clip by path relative to client/public/models/characters/
 *  (e.g. "anims/Walking.glb", "anims/dance/breakdance_ready.glb").
 *  Returns null when the file is missing — never throws. */
export function loadMixamoClipFile(relPath: string): Promise<THREE.AnimationClip | null> {
  const url = `${CHARACTER_DIR}/${relPath}`;
  let p = mixamoClipCache.get(url);
  if (!p) {
    p = gltfLoader.loadAsync(url).then(
      (g) => g.animations?.[0] ?? null,
      (err) => {
        console.warn(`[world2] Mixamo clip not available (${url})`, err);
        return null;
      },
    );
    mixamoClipCache.set(url, p);
  }
  return p;
}

async function loadMixamoCoreClips(): Promise<ResolvedClips> {
  const [idle, walk, run, jump] = await Promise.all([
    loadMixamoClipFile(`anims/${MIXAMO_CORE_CLIPS.idle}`),
    loadMixamoClipFile(`anims/${MIXAMO_CORE_CLIPS.walk}`),
    loadMixamoClipFile(`anims/${MIXAMO_CORE_CLIPS.run}`),
    loadMixamoClipFile(`anims/${MIXAMO_CORE_CLIPS.jump}`),
  ]);
  return {
    idle: idle ?? undefined,
    walk: walk ?? undefined,
    run: run ?? undefined,
    jump: jump ?? undefined,
  };
}

const rigCache = new Map<CharacterVariant, Promise<CharacterRig>>();

/** Load once per variant, clone per actor. */
export function loadCharacterRig(variant: CharacterVariant = CHARACTER_VARIANT): Promise<CharacterRig> {
  let p = rigCache.get(variant);
  if (!p) {
    p = loadRig(variant);
    rigCache.set(variant, p);
  }
  return p;
}

async function loadRig(variant: CharacterVariant): Promise<CharacterRig> {
  const def = VARIANT_DEFS[variant];
  try {
    const gltf = await gltfLoader.loadAsync(def.url);
    // NOTE: the character GLBs each embed one "mixamo.com" clip of their
    // own — it is NOT used. Locomotion always comes from the separate
    // anim GLBs (Mixamo) or the embedded clips (Quaternius).
    const clips = def.mixamo ? await loadMixamoCoreClips() : resolveClips(gltf.animations ?? []);
    if (!clips.idle && !clips.walk) {
      console.warn(`[world2] ${def.url} loaded but has no Idle/Walk clips — falling back`);
      return fallbackRig(variant);
    }
    return {
      kind: "glb",
      variant,
      url: def.url,
      createActor: () => createGlbActor(gltf.scene, clips, def.scale),
    };
  } catch (err) {
    console.warn(
      `[world2] character GLB not available (${def.url}) — falling back. ` +
        `Copy the GLBs into client/public/models/characters/ to use the rigged models.`,
      err,
    );
    return fallbackRig(variant);
  }
}

/** Mixamo missing -> Quaternius (shared cache, so both variants fall back
 *  onto the same single Quaternius load); Quaternius missing -> primitives. */
async function fallbackRig(failed: CharacterVariant): Promise<CharacterRig> {
  if (failed !== "quaternius") return loadCharacterRig("quaternius");
  return primitiveRig();
}

function primitiveRig(): CharacterRig {
  return {
    kind: "primitive",
    variant: "primitive",
    url: null,
    createActor: (opts) => createPrimitiveActor(opts ?? {}),
  };
}

// ---------------------------------------------------------------------------
// Third-person controller — movement + animation + facing only.
// The camera itself is owned by render/scene.ts (it follows the player
// position each frame); the controller only reads the camera yaw so WASD
// stays camera-relative.
// ---------------------------------------------------------------------------

export interface CharacterControllerOpts {
  body: PlayerBodyLike;
  actor: CharacterActor;
  /** Camera yaw (radians) from the renderer — forward is (-sin yaw, -cos yaw). */
  getCameraYaw: () => number;
  /** Touch joystick vector, same convention as the legacy StreetStick:
   *  x = strafe right, y = forward, each -1..1. */
  stick: { x: number; y: number };
  /** E / interact key — the caller supplies the context action. */
  onInteract?: () => void;
  /** When false (driving, a panel is open, inside a cutscene) input is ignored. */
  enabled?: () => boolean;
  walkSpeed?: number; // default 3 m/s
  runSpeed?: number; // default 6 m/s
}

export interface CharacterController {
  update(dt: number): void;
  dispose(): void;
  setActorVisible(v: boolean): void;
  position(): Vec3Like;
  readonly moving: boolean;
  readonly speed: number;
}

const WALK_SPEED = 3;
const RUN_SPEED = 6;

export function createCharacterController(opts: CharacterControllerOpts): CharacterController {
  const walkSpeed = opts.walkSpeed ?? WALK_SPEED;
  const runSpeed = opts.runSpeed ?? RUN_SPEED;
  const keys = new Set<string>();
  let facing = 0;
  let moving = false;
  let speed = 0;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    keys.add(k);
    if (k === " " ) {
      e.preventDefault();
      if (opts.enabled?.() === false) return;
      if (opts.body.grounded()) {
        opts.body.jump();
        opts.actor.playJump();
      }
    }
    if (k === "e" || k === "enter") {
      if (opts.enabled?.() === false) return;
      opts.onInteract?.();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.key.toLowerCase());
  };
  const onBlur = () => keys.clear();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  const controller: CharacterController = {
    get moving() {
      return moving;
    },
    get speed() {
      return speed;
    },
    setActorVisible(v: boolean) {
      opts.actor.group.visible = v;
    },
    position() {
      return opts.body.position();
    },
    update(dt: number) {
      const enabled = opts.enabled?.() !== false;
      let ix = 0;
      let iy = 0;
      if (enabled) {
        if (keys.has("w") || keys.has("arrowup")) iy += 1;
        if (keys.has("s") || keys.has("arrowdown")) iy -= 1;
        if (keys.has("a") || keys.has("arrowleft")) ix -= 1;
        if (keys.has("d") || keys.has("arrowright")) ix += 1;
        ix += opts.stick.x;
        iy += opts.stick.y;
      }
      const mag = Math.hypot(ix, iy);
      const running =
        keys.has("shift") || mag > 0.9;
      if (mag > 0.01) {
        const nx = ix / Math.max(1, mag);
        const ny = iy / Math.max(1, mag);
        const yaw = opts.getCameraYaw();
        // Camera-relative: forward = (-sin yaw, -cos yaw), right = (cos yaw, -sin yaw).
        const fx = -Math.sin(yaw);
        const fz = -Math.cos(yaw);
        const rx = Math.cos(yaw);
        const rz = -Math.sin(yaw);
        const dirX = fx * ny + rx * nx;
        const dirZ = fz * ny + rz * nx;
        const targetSpeed = Math.min(1, mag) * (running ? runSpeed : walkSpeed);
        opts.body.move(dirX, dirZ, targetSpeed);
        speed = targetSpeed;
        moving = true;
        const targetFacing = Math.atan2(dirX, dirZ);
        // Shortest-arc facing lerp so the character turns instead of snapping.
        let d = targetFacing - facing;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        facing += d * Math.min(1, dt * 12);
        opts.actor.setFacing(facing);
        opts.actor.setState(speed >= 4.5 ? "run" : "walk");
      } else {
        opts.body.move(0, 0, 0);
        speed = 0;
        moving = false;
        opts.actor.setState("idle");
      }
      // Keep the actor glued to the physics body. The body position is
      // the capsule CENTRE (0.9 m up when standing); the actor's origin
      // is at its feet.
      const p = opts.body.position();
      opts.actor.group.position.set(p.x, p.y - BODY_CENTER_OFFSET, p.z);
      opts.actor.update(dt);
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },
  };
  return controller;
}
