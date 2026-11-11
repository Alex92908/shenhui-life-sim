/**
 * house.ts — area (g): build-your-own-house (round-2)
 *
 * The user asked for a new build-your-own-house system （自己盖房子）.
 * The game already has a housing ladder (rent → buy a flat), a furniture
 * catalog (ZhuyaHome), furniture placement slots in the 3D flat
 * (LifeStage FURN_SLOTS), and publishHome / getHome on the server — but
 * the player can only decorate a fixed flat, never lay out rooms and walls
 * themselves. This module is the layout half:
 *
 *   - a pure layout model: rooms + walls + furniture on a plot
 *   - validation (rooms must not overlap, furniture must sit inside a room)
 *   - local persistence (so the editor works offline / before area S)
 *   - conversion to the existing placed-furniture shape ({ id, slot }) so
 *     a built house publishes through the SAME publishHome / getHome path
 *     other players already visit — no new server endpoint needed.
 *
 * The 3D half lives in LifeStage.tsx: setKind "buildplot" renders a layout
 * on an empty plot (grid, walls, room floors, furniture boxes) and the
 * player walks it with the same joystick. The editor UI itself is App.tsx
 * (integration snippet in ROUND2-LOG-g.md): a 2D plot grid + palette that
 * calls these pure functions. Open-ended by design: any room mix, any
 * size within the plot, no prescribed floor plan.
 *
 * Pure TypeScript, no React, no server imports. FURN slot coordinates are
 * duplicated here (HOUSE_FURN_SLOTS) so this file never imports LifeStage
 * — they must match LifeStage's FURN_SLOTS; the typecheck does not enforce
 * that, the comment does.
 */

export type HouseRoomKind = "bedroom" | "living" | "kitchen" | "bathroom" | "balcony" | "studio";

export const HOUSE_ROOM_KINDS: { id: HouseRoomKind; zh: string; en: string; minW: number; minD: number }[] = [
  { id: "living", zh: "客厅", en: "Living room", minW: 3, minD: 3 },
  { id: "bedroom", zh: "卧室", en: "Bedroom", minW: 3, minD: 3 },
  { id: "kitchen", zh: "厨房", en: "Kitchen", minW: 2, minD: 2 },
  { id: "bathroom", zh: "卫生间", en: "Bathroom", minW: 2, minD: 2 },
  { id: "studio", zh: "工作间", en: "Studio", minW: 2, minD: 2 },
  { id: "balcony", zh: "阳台", en: "Balcony", minW: 2, minD: 1 },
];

/** Plot is 12 × 8 metres, origin at the plot centre — same scale as the flat set. */
export const HOUSE_PLOT = { w: 12, d: 8 } as const;

export interface HouseRoom {
  id: string;
  kind: HouseRoomKind;
  /** centre x, centre z, width, depth — metres, inside the 12×8 plot */
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface HouseWall {
  id: string;
  /** centre x/z, length, rotation: 0 = along x, 90° = along z */
  x: number;
  z: number;
  len: number;
  rot: 0 | 90;
}

/**
 * Furniture the player can place while building. `inCatalog` means the id
 * already exists in the game's furniture catalog (verified in App.tsx:
 * bed-double / sofa-fabric / kitchen-cabinet are placed via onFurn) and
 * therefore publishes through publishHome today. The rest are build-mode
 * only until the catalog gains them — the 3D buildplot set still draws
 * them, and toPlacedFurn() drops them from the publish payload with a
 * note instead of silently publishing a wrong item.
 */
export interface HouseFurnKind {
  id: string;
  zh: string;
  en: string;
  w: number;
  d: number;
  inCatalog: boolean;
}

export const HOUSE_FURN_CATALOG: HouseFurnKind[] = [
  { id: "bed-double", zh: "双人床", en: "Double bed", w: 1.8, d: 2.1, inCatalog: true },
  { id: "sofa-fabric", zh: "布沙发", en: "Fabric sofa", w: 2.0, d: 0.9, inCatalog: true },
  { id: "kitchen-cabinet", zh: "灶台柜", en: "Kitchen counter", w: 1.8, d: 0.7, inCatalog: true },
  { id: "table", zh: "餐桌", en: "Dining table", w: 1.4, d: 0.8, inCatalog: false },
  { id: "wardrobe", zh: "衣柜", en: "Wardrobe", w: 1.2, d: 0.6, inCatalog: false },
  { id: "desk", zh: "书桌", en: "Desk", w: 1.2, d: 0.6, inCatalog: false },
  { id: "tv", zh: "电视柜", en: "TV stand", w: 1.5, d: 0.5, inCatalog: false },
  { id: "plant", zh: "绿植", en: "Plant", w: 0.5, d: 0.5, inCatalog: false },
];

export interface HouseItem {
  id: string;
  furnId: string;
  x: number;
  z: number;
  /** facing, radians */
  ry: number;
}

export interface HouseLayout {
  /** 0xRRGGBB wall colour */
  wallColor: number;
  floorColor: number;
  rooms: HouseRoom[];
  walls: HouseWall[];
  items: HouseItem[];
}

export function emptyHouseLayout(): HouseLayout {
  return { wallColor: 0xf6efe2, floorColor: 0x9a6b40, rooms: [], walls: [], items: [] };
}

let uidCounter = 0;
export function houseUid(prefix: string): string {
  uidCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${uidCounter}`;
}

function insidePlot(x: number, z: number): boolean {
  return Math.abs(x) <= HOUSE_PLOT.w / 2 && Math.abs(z) <= HOUSE_PLOT.d / 2;
}

function roomsOverlap(a: HouseRoom, b: HouseRoom): boolean {
  return (
    Math.abs(a.x - b.x) * 2 < a.w + b.w - 0.01 && Math.abs(a.z - b.z) * 2 < a.d + b.d - 0.01
  );
}

/** Validate a layout; returns human-readable problems (empty = buildable). */
export function validateHouseLayout(l: HouseLayout): string[] {
  const problems: string[] = [];
  for (const r of l.rooms) {
    if (!insidePlot(r.x - r.w / 2, r.z - r.d / 2) || !insidePlot(r.x + r.w / 2, r.z + r.d / 2)) {
      problems.push(`房间超出地块：${r.kind} (${r.x}, ${r.z})`);
    }
    if (r.w < 1 || r.d < 1) problems.push(`房间太小：${r.kind}`);
  }
  for (let i = 0; i < l.rooms.length; i++) {
    for (let j = i + 1; j < l.rooms.length; j++) {
      if (roomsOverlap(l.rooms[i]!, l.rooms[j]!)) {
        problems.push(`房间重叠：${l.rooms[i]!.kind} × ${l.rooms[j]!.kind}`);
      }
    }
  }
  for (const it of l.items) {
    if (!insidePlot(it.x, it.z)) problems.push(`家具超出地块：${it.furnId}`);
    const room = l.rooms.find(
      (r) => Math.abs(it.x - r.x) <= r.w / 2 && Math.abs(it.z - r.z) <= r.d / 2,
    );
    if (l.rooms.length > 0 && !room) problems.push(`家具不在任何房间里：${it.furnId}`);
  }
  if (l.walls.length > 24) problems.push("墙太多（最多 24 段）");
  if (l.items.length > 30) problems.push("家具太多（最多 30 件）");
  return problems;
}

export function addHouseRoom(l: HouseLayout, room: Omit<HouseRoom, "id">): HouseLayout {
  return { ...l, rooms: [...l.rooms, { ...room, id: houseUid("room") }] };
}

export function addHouseWall(l: HouseLayout, wall: Omit<HouseWall, "id">): HouseLayout {
  return { ...l, walls: [...l.walls, { ...wall, id: houseUid("wall") }] };
}

export function placeHouseFurniture(
  l: HouseLayout,
  furnId: string,
  x: number,
  z: number,
  ry = 0,
): HouseLayout {
  return { ...l, items: [...l.items, { id: houseUid("item"), furnId, x, z, ry }] };
}

export function removeHousePiece(l: HouseLayout, id: string): HouseLayout {
  return {
    ...l,
    rooms: l.rooms.filter((r) => r.id !== id),
    walls: l.walls.filter((w) => w.id !== id),
    items: l.items.filter((i) => i.id !== id),
  };
}

/* ---- persistence (local; the server copy goes through publishHome) ---- */

const HOUSE_KEY = "shhr-house-layout";

export function saveHouseLayout(l: HouseLayout) {
  try {
    localStorage.setItem(HOUSE_KEY, JSON.stringify(l));
  } catch {
    /* storage unavailable */
  }
}

export function loadHouseLayout(): HouseLayout | null {
  try {
    const raw = localStorage.getItem(HOUSE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HouseLayout;
    if (!parsed || !Array.isArray(parsed.rooms) || !Array.isArray(parsed.items)) return null;
    return {
      wallColor: parsed.wallColor ?? 0xf6efe2,
      floorColor: parsed.floorColor ?? 0x9a6b40,
      rooms: parsed.rooms,
      walls: Array.isArray(parsed.walls) ? parsed.walls : [],
      items: parsed.items,
    };
  } catch {
    return null;
  }
}

/**
 * Furniture slots in the 3D flat — MUST match LifeStage.tsx FURN_SLOTS
 * (same order, same coordinates). A built item publishes to the slot its
 * position is closest to, so a visited home shows the furniture where the
 * builder put it.
 */
export const HOUSE_FURN_SLOTS: { x: number; z: number; ry: number }[] = [
  { x: -2.7, z: -0.6, ry: 0.45 },
  { x: 2.8, z: -0.6, ry: -0.45 },
  { x: -3.6, z: -2.4, ry: 0.2 },
  { x: 3.7, z: -2.4, ry: -0.2 },
  { x: 1.9, z: -2.7, ry: 0 },
  { x: -2.2, z: 1.3, ry: 0.6 },
  { x: 2.3, z: 1.3, ry: -0.6 },
];

/**
 * Convert a built layout to the placed-furniture shape publishHome takes.
 * Only catalog items publish; build-only items are listed in `dropped`
 * so the UI can tell the player which pieces won't show to visitors yet.
 * Slots are claimed nearest-first; an item with no free slot is dropped.
 */
export function houseLayoutToPlacedFurn(l: HouseLayout): {
  placed: { id: string; slot: number }[];
  dropped: { furnId: string; reason: string }[];
} {
  const placed: { id: string; slot: number }[] = [];
  const dropped: { furnId: string; reason: string }[] = [];
  const free = new Set(HOUSE_FURN_SLOTS.map((_, i) => i));
  for (const it of l.items) {
    const kind = HOUSE_FURN_CATALOG.find((k) => k.id === it.furnId);
    if (!kind || !kind.inCatalog) {
      dropped.push({ furnId: it.furnId, reason: "not-in-catalog" });
      continue;
    }
    let best = -1;
    let bestD = Infinity;
    for (const s of free) {
      const slot = HOUSE_FURN_SLOTS[s]!;
      const d = Math.hypot(it.x - slot.x, it.z - slot.z);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (best < 0) {
      dropped.push({ furnId: it.furnId, reason: "no-free-slot" });
      continue;
    }
    free.delete(best);
    placed.push({ id: it.furnId, slot: best });
  }
  return { placed, dropped };
}
