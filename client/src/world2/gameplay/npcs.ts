// Bay Area Life 2.0 — Stage 1 slice: NPC group (6–10 people).
//
// Brain from 1.0's npc.ts (personaOf / scheduleOf / chatReply /
// greetLine — pure logic, reused as-is); legs via Recast Crowd when it
// exists, with a kinematic straight-line fallback so the slice still
// walks before nav.ts lands. SEAM: NavMeshLike / CrowdLike are
// structural mirrors of the nav.ts contracts (buildNavMesh /
// createCrowd). NPC simulation stays CLIENT-SIDE in the slice (audit
// §2.5: server-side NPCs are a Stage 2 decision).
//
// Cast (8, from 1.0's NPCS so personas/schedules match the neighbours
// lee already knows): 2 commuters, 1 patrolling guard, 1 shopkeeper
// stationed in the shop, 2 wanderers, 2 couriers tied to the delivery
// task. Each NPC gets a Quaternius GLB clone when the rig loaded, else
// a makeFigure body with a faceSpecFor(name) face.

import * as THREE from "three";
import { NPCS } from "../../data";
import type { Npc } from "../../data";
import { chatReply, greetLine, memOf, scheduleOf } from "../../npc";
import type { ChatAction, ChatOutcome, DayContext, NpcMem } from "../../npc";
import { addAccessory } from "../../figure";
import type { CharacterActor, CharacterRig, Vec3Like } from "./character";

export type NpcRole = "commuter" | "guard" | "shopkeeper" | "wanderer" | "courier";

/**
 * Structural mirrors of the nav.ts contracts — tuple points, exactly as
 * built by buildNavMesh / createCrowd: findPath takes [x, z] pairs,
 * randomPointNear returns [x, z] | null (off-mesh), Crowd.position
 * returns [x, z].
 */
export interface NavMeshLike {
  findPath(from: [number, number], to: [number, number]): [number, number][];
  randomPointNear(x: number, z: number, r: number): [number, number] | null;
}
export interface CrowdLike {
  addAgent(x: number, z: number): number;
  goto(id: number, x: number, z: number): void;
  position(id: number): [number, number];
  update(dt: number): void;
}

export interface NpcCastEntry {
  npc: Npc;
  role: NpcRole;
  /** Where the NPC starts / returns to. */
  home: Vec3Like;
  /** Patrol / commute endpoints. Guards loop them; commuters ping-pong. */
  waypoints?: Vec3Like[];
  /** Shopkeeper post (inside the shop). Defaults to home. */
  post?: Vec3Like;
}

export interface SliceAnchors {
  office: Vec3Like;
  shop: Vec3Like;
  plaza: Vec3Like;
  residential: Vec3Like;
  street: Vec3Like[];
}

/**
 * The slice cast, built from 1.0's NPCS. The second courier ("小辉")
 * is a new local Npc record — personaOf/scheduleOf are deterministic
 * from name+job, so he gets a real persona without a 1.0 entry.
 */
export function buildSliceCast(anchors: SliceAnchors): NpcCastEntry[] {
  const byName = (name: string): Npc => {
    const n = NPCS.find((x) => x.name === name);
    if (!n) throw new Error(`[world2] NPCS has no ${name}`);
    return n;
  };
  const xiaoHui: Npc = {
    name: "小辉",
    job: "外卖骑手",
    emoji: "🛵",
    color: 0x22c55e,
    line: "刚入行三个月，跑单全靠导航，熟客都说他笑起来像刚出锅的包子。",
    outfit: "绿色骑手服 + 头盔，保温箱不离身",
    shirt: 0x22c55e,
    pants: 0x2e3440,
    accessory: "helmet",
    behavior: "commute",
    preferTypes: ["food", "transit"],
    cities: ["sz"],
  };
  const street = anchors.street;
  const s0 = street[0] ?? anchors.plaza;
  const s1 = street[1] ?? anchors.plaza;
  const s2 = street[2] ?? anchors.plaza;
  const s3 = street[3] ?? anchors.plaza;
  return [
    { npc: byName("小美"), role: "commuter", home: anchors.residential, waypoints: [anchors.residential, anchors.office] },
    { npc: byName("阿琳"), role: "commuter", home: anchors.residential, waypoints: [anchors.residential, anchors.office] },
    { npc: byName("陈伯"), role: "guard", home: anchors.plaza, waypoints: [anchors.plaza, s0, anchors.office, s1] },
    { npc: byName("大芬姐"), role: "shopkeeper", home: anchors.shop, post: anchors.shop },
    { npc: byName("子健"), role: "wanderer", home: anchors.plaza },
    { npc: byName("Lisa"), role: "wanderer", home: anchors.office },
    { npc: byName("阿强"), role: "courier", home: anchors.shop, waypoints: [anchors.shop, anchors.office] },
    { npc: xiaoHui, role: "courier", home: anchors.shop, waypoints: [anchors.shop, s2, anchors.office, s3] },
  ];
}

export interface NpcActorState {
  id: string;
  name: string;
  job: string;
  role: NpcRole;
  emoji: string;
  schedule: string;
  rel: number;
  position: Vec3Like;
}

export interface NpcGroupOpts {
  scene: THREE.Scene;
  rig: CharacterRig;
  /** Optional extra rigs — NPCs round-robin across [rig, ...rigs] so the
   *  cast isn't 8 clones of one model (research §6: variety via multiple
   *  Mixamo characters). Defaults to [rig]. */
  rigs?: CharacterRig[];
  crowd: CrowdLike | null;
  nav: NavMeshLike | null;
  cast: NpcCastEntry[];
  playerName?: string;
  onTalk?: (name: string, action: ChatAction, outcome: ChatOutcome) => void;
}

export interface NpcGroup {
  readonly actors: NpcActorState[];
  update(dt: number): void;
  nearest(pos: Vec3Like, radius: number): NpcActorState | null;
  talk(id: string, action: ChatAction): { reply: string; relDelta: number } | null;
  greet(id: string): string | null;
  /** Send a courier to a point (delivery task: pickup, then dropoff). */
  sendCourierTo(point: Vec3Like): string | null;
  dispose(): void;
}

interface LiveNpc {
  entry: NpcCastEntry;
  actor: CharacterActor;
  mem: NpcMem;
  agentId: number | null;
  /** Kinematic fallback position when there is no Crowd. */
  pos: Vec3Like;
  target: Vec3Like | null;
  waypointIdx: number;
  dwellUntil: number;
  talkedToday: boolean;
  lastSpeed: number;
}

const WALK_SPEED = 1.4;
const TALK_RADIUS = 2.5;

export function createNpcGroup(opts: NpcGroupOpts): NpcGroup {
  const dayCtx: DayContext = { day: 1, cityKey: "sz", playerName: opts.playerName ?? "小文" };
  const live: LiveNpc[] = [];

  const rigs = opts.rigs && opts.rigs.length > 0 ? opts.rigs : [opts.rig];
  for (let i = 0; i < opts.cast.length; i++) {
    const entry = opts.cast[i]!;
    const npc = entry.npc;
    const rig = rigs[i % rigs.length]!;
    const actor = rig.createActor({
      shirt: npc.shirt,
      pants: npc.pants,
      faceSeed: npc.name,
    });
    // Primitive fallback bodies get their 1.0 accessory (bag/cap/helmet…);
    // GLB bodies skip it — accessory bone parenting is a follow-up
    // (character research §6: bag -> Spine/Chest, cap -> Head).
    if (!actor.isGlb) addAccessory(actor.group, npc.accessory);
    actor.group.position.set(entry.home.x, 0, entry.home.z);
    // The shopkeeper faces out of the shop, toward the counter.
    if (entry.role === "shopkeeper") actor.setFacing(Math.PI);
    opts.scene.add(actor.group);
    const agentId = entry.role === "shopkeeper" ? null : opts.crowd?.addAgent(entry.home.x, entry.home.z) ?? null;
    live.push({
      entry,
      actor,
      mem: memOf({}, npc.name),
      agentId,
      pos: { ...entry.home },
      target: null,
      waypointIdx: 0,
      dwellUntil: 0,
      talkedToday: false,
      lastSpeed: 0,
    });
  }

  const pickNextTarget = (n: LiveNpc): Vec3Like | null => {
    const { role } = n.entry;
    const wps = n.entry.waypoints ?? [];
    if (role === "shopkeeper") return null;
    if (role === "guard" || role === "commuter" || role === "courier") {
      if (wps.length === 0) return null;
      const next = wps[n.waypointIdx % wps.length]!;
      n.waypointIdx += 1;
      return { ...next };
    }
    // Wanderer: a random nearby point (Recast randomPointNear when present).
    if (opts.nav) {
      const p = opts.nav.randomPointNear(n.pos.x, n.pos.z, 30);
      if (p) return { x: p[0], y: 0, z: p[1] };
      return null; // off-mesh here — stay put, retry next dwell
    }
    const a = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 20;
    return { x: n.pos.x + Math.cos(a) * r, y: 0, z: n.pos.z + Math.sin(a) * r };
  };

  const setTarget = (n: LiveNpc, t: Vec3Like) => {
    n.target = t;
    if (n.agentId !== null) {
      opts.crowd?.goto(n.agentId, t.x, t.z);
    }
  };

  const group: NpcGroup = {
    get actors(): NpcActorState[] {
      return live.map((n) => ({
        id: n.entry.npc.name,
        name: n.entry.npc.name,
        job: n.entry.npc.job,
        role: n.entry.role,
        emoji: n.entry.npc.emoji,
        schedule: scheduleOf(n.entry.npc),
        rel: n.mem.rel,
        position: { ...n.pos },
      }));
    },
    update(dt: number) {
      opts.crowd?.update(dt);
      const nowMs = performance.now();
      for (const n of live) {
        // --- movement ---
        if (n.agentId !== null && opts.crowd) {
          const [px, pz] = opts.crowd.position(n.agentId);
          const dx = px - n.pos.x;
          const dz = pz - n.pos.z;
          const moved = Math.hypot(dx, dz);
          n.lastSpeed = dt > 0 ? moved / dt : 0;
          n.pos = { x: px, y: 0, z: pz };
          if (moved > 0.05) {
            n.actor.setFacing(Math.atan2(dx, dz));
          }
          // Crowd arrival: the crowd stops at its destination — clear the
          // target so a new one gets picked after a dwell.
          if (n.target && Math.hypot(n.target.x - px, n.target.z - pz) < 0.6) {
            n.target = null;
            n.dwellUntil = nowMs + 2000 + Math.random() * 4000;
          }
        } else if (n.target) {
          // Kinematic fallback (no Crowd yet): straight line at 1.4 m/s.
          const dx = n.target.x - n.pos.x;
          const dz = n.target.z - n.pos.z;
          const d = Math.hypot(dx, dz);
          const step = WALK_SPEED * dt;
          if (d <= Math.max(step, 0.4)) {
            n.pos = { ...n.target };
            n.target = null;
            n.lastSpeed = 0;
            n.dwellUntil = nowMs + 2000 + Math.random() * 4000;
          } else {
            n.pos.x += (dx / d) * step;
            n.pos.z += (dz / d) * step;
            n.lastSpeed = WALK_SPEED;
            n.actor.setFacing(Math.atan2(dx, dz));
          }
        } else {
          n.lastSpeed = 0;
        }
        // --- pick the next destination when idle (after a dwell) ---
        if (!n.target && nowMs >= n.dwellUntil && n.entry.role !== "shopkeeper") {
          const next = pickNextTarget(n);
          if (next) setTarget(n, next);
        }
        // --- animation + placement ---
        n.actor.setState(n.lastSpeed > 0.1 ? "walk" : "idle");
        n.actor.group.position.set(n.pos.x, 0, n.pos.z);
        n.actor.update(dt);
      }
    },
    nearest(pos: Vec3Like, radius: number) {
      let best: LiveNpc | null = null;
      let bestD = radius;
      for (const n of live) {
        const d = Math.hypot(n.pos.x - pos.x, n.pos.z - pos.z);
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      }
      if (!best) return null;
      return {
        id: best.entry.npc.name,
        name: best.entry.npc.name,
        job: best.entry.npc.job,
        role: best.entry.role,
        emoji: best.entry.npc.emoji,
        schedule: scheduleOf(best.entry.npc),
        rel: best.mem.rel,
        position: { ...best.pos },
      };
    },
    talk(id: string, action: ChatAction) {
      const n = live.find((x) => x.entry.npc.name === id);
      if (!n) return null;
      const outcome = chatReply(n.entry.npc, n.mem, action, dayCtx, n.talkedToday);
      n.talkedToday = true;
      n.mem.talks += 1;
      n.mem.rel = Math.max(-100, Math.min(100, n.mem.rel + outcome.relDelta));
      n.mem.lastTopic = action;
      if (outcome.note) n.mem.note = outcome.note;
      opts.onTalk?.(n.entry.npc.name, action, outcome);
      return { reply: outcome.reply, relDelta: outcome.relDelta };
    },
    greet(id: string) {
      const n = live.find((x) => x.entry.npc.name === id);
      if (!n) return null;
      return greetLine(n.entry.npc, n.mem, dayCtx);
    },
    sendCourierTo(point: Vec3Like) {
      const courier = live.find((x) => x.entry.role === "courier");
      if (!courier) return null;
      courier.dwellUntil = 0;
      setTarget(courier, { ...point });
      return courier.entry.npc.name;
    },
    dispose() {
      for (const n of live) {
        opts.scene.remove(n.actor.group);
        n.actor.dispose();
      }
      live.length = 0;
    },
  };
  // Seed first destinations so the street is alive from frame one.
  for (const n of live) {
    if (n.entry.role === "shopkeeper") continue;
    const next = pickNextTarget(n);
    if (next) setTarget(n, next);
  }
  return group;
}

export { TALK_RADIUS };
