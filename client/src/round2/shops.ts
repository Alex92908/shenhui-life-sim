// Round-9 — player shops & flats on the map (lee: "希望店能在地图上被搜到、
// 被别人走进去光顾"). A shop / bought flat is a named, locatable place:
// it has a custom name, a chosen location (locId + cityKey), a floor +
// building where the place is multi-floor, a map marker, a visible 3D
// building, a search hit, and a walk-in interior. The server (0022) stores
// shops in `shops` and flats on `homes` (name/locId/cityKey) and exposes
// both in the world snapshot; the client syncs its own shop/flat on every
// heartbeat (syncPresence) and reads the world list for markers/search.
//
// Money rule (do not break): a visitor's purchase goes into the shop's
// TILL on the server (buyFromShop), never straight into the owner's wallet
// — the owner collects it later via 收钱， and the 20% partner split applies
// to the collected total. The server till is collected with
// collectShopTill and merged with the client's rollover till on 收钱.

import type { CityKey, Loc } from "../data";
import { villageLocs } from "./villages";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** The player's own shop, in GameState. */
export interface ShopState {
  kind: string;
  day: number;
  lvl: number;
  till: number;
  partner?: string;
  /** custom name, e.g. "湾区小文的糖水铺" */
  name?: string;
  /** where the shop sits */
  locId?: string;
  cityKey?: CityKey;
  /** floor inside a multi-floor building (1 = ground) */
  floor?: number;
  /** building id where the place has several (e.g. Huaqiangbei seg/hqdz) */
  building?: string;
}

/** The player's bought flat, in GameState. */
export interface FlatState {
  name?: string;
  locId?: string;
  cityKey?: CityKey;
}

/** One shop from the world snapshot (another player's, or your own). */
export interface PlayerShop {
  ownerPub: string;
  ownerName: string;
  kind: string;
  name: string;
  locId: string;
  cityKey: CityKey;
  lvl: number;
  floor: number;
  building: string | null;
}

/** One bought flat from the world snapshot. */
export interface PlayerFlat {
  ownerPub: string;
  ownerName: string;
  name: string;
  locId: string;
  cityKey: CityKey;
  tier: number;
}

/* ------------------------------------------------------------------ */
/* Menu — MUST match server/src/actions.ts SHOP_MENUS exactly          */
/* ------------------------------------------------------------------ */

export const SHOP_MENUS: Record<string, { id: string; name: string; price: number }[]> = {
  tangshui: [
    { id: "tangshui", name: "糖水", price: 12 },
    { id: "guilinggao", name: "龟苓膏", price: 15 },
    { id: "yangzhi", name: "杨枝甘露", price: 18 },
  ],
  changfen: [
    { id: "changfen", name: "肠粉", price: 10 },
    { id: "baizhou", name: "白粥", price: 8 },
    { id: "zhengjiao", name: "蒸饺", price: 14 },
  ],
  milktea: [
    { id: "zhenzhu", name: "珍珠奶茶", price: 15 },
    { id: "shuiguoch", name: "水果茶", price: 18 },
    { id: "kafei", name: "咖啡", price: 20 },
  ],
};

export function shopMenu(kind: string): { id: string; name: string; price: number }[] {
  return SHOP_MENUS[kind] ?? SHOP_MENUS.tangshui!;
}

export const SHOP_KIND_ZH: Record<string, string> = {
  tangshui: "糖水铺",
  changfen: "肠粉档",
  milktea: "奶茶店",
};

export const SHOP_KIND_EMOJI: Record<string, string> = {
  tangshui: "🍧",
  changfen: "🥟",
  milktea: "🧋",
};

/* ------------------------------------------------------------------ */
/* Names                                                               */
/* ------------------------------------------------------------------ */

export const SHOP_NAME_MAX = 16;

export function defaultShopName(ownerName: string, kind: string): string {
  return `${ownerName}的${SHOP_KIND_ZH[kind] ?? "小店"}`;
}

export function defaultFlatName(ownerName: string): string {
  return `${ownerName}的家`;
}

/** Trim + collapse whitespace + cap; fall back to `fallback` when empty. */
export function clampName(s: string, fallback: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t ? t.slice(0, SHOP_NAME_MAX) : fallback;
}

/* ------------------------------------------------------------------ */
/* Sanitizers — old saves without name/locId/floor still load          */
/* ------------------------------------------------------------------ */

function num(v: unknown, d: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : d;
}

export function sanitizeShop(raw: unknown, ownerName: string, homeLocId: string): ShopState | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.kind !== "string" || !o.kind) return undefined;
  const kind = o.kind;
  const cityKey = o.cityKey === "sz" || o.cityKey === "hz" || o.cityKey === "hk" ? o.cityKey : undefined;
  const floor = Math.max(1, Math.min(3, Math.floor(num(o.floor, 1)) || 1));
  return {
    kind,
    day: num(o.day, 0),
    lvl: Math.max(1, Math.min(5, Math.floor(num(o.lvl, 1)) || 1)),
    till: num(o.till, 0),
    partner: typeof o.partner === "string" && o.partner ? o.partner : undefined,
    name: clampName(typeof o.name === "string" ? o.name : "", defaultShopName(ownerName, kind)),
    locId: typeof o.locId === "string" && o.locId ? o.locId : homeLocId,
    cityKey,
    floor,
    building: typeof o.building === "string" && o.building ? o.building : undefined,
  };
}

export function sanitizeFlat(raw: unknown, ownerName: string, homeLocId: string): FlatState | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const cityKey = o.cityKey === "sz" || o.cityKey === "hz" || o.cityKey === "hk" ? o.cityKey : undefined;
  return {
    name: clampName(typeof o.name === "string" ? o.name : "", defaultFlatName(ownerName)),
    locId: typeof o.locId === "string" && o.locId ? o.locId : homeLocId,
    cityKey,
  };
}

/* ------------------------------------------------------------------ */
/* Floor / building label, e.g. " · 赛格广场 2F" / " · 2F" / ""        */
/* ------------------------------------------------------------------ */

export function shopFloorText(buildingZh: string | null | undefined, floor: number): string {
  if (floor <= 1 && !buildingZh) return "";
  if (buildingZh) return ` · ${buildingZh} ${floor}F`;
  return ` · ${floor}F`;
}

/* ------------------------------------------------------------------ */
/* Place picker — storefront-friendly grouping                         */
/* ------------------------------------------------------------------ */

/** The 城中村 / 小区 places: the natural ground-floor storefronts. */
export function isVillageLoc(loc: Loc): boolean {
  return (["sz", "hz", "hk"] as const).some((ck) => villageLocs(ck).some((v) => v.id === loc.id));
}

/** A place that reads as a storefront location: villages, markets, food
    streets, malls and old streets. Used to group the picker. */
export function isStorefrontLoc(loc: Loc): boolean {
  if (isVillageLoc(loc)) return true;
  return (
    loc.type === "market" ||
    loc.type === "food" ||
    loc.type === "mall" ||
    loc.type === "oldtown" ||
    loc.venueSet === "electronics" ||
    loc.venueSet === "oilpainting" ||
    loc.venueSet === "secondhand" ||
    loc.venueSet === "seafood" ||
    loc.venueSet === "fishingport" ||
    loc.venueSet === "womensstreet"
  );
}

/* ------------------------------------------------------------------ */
/* syncPresence payloads                                               */
/* ------------------------------------------------------------------ */

/** The shop payload for syncPresence, or undefined when there is no shop. */
export function shopSyncPayload(
  shop: ShopState | undefined,
  ownerName: string,
  homeLocId: string,
  cityKey: CityKey,
): { kind: string; name: string; locId: string; cityKey: CityKey; lvl: number; floor: number; building?: string | null } | undefined {
  if (!shop) return undefined;
  return {
    kind: shop.kind,
    name: clampName(shop.name ?? "", defaultShopName(ownerName, shop.kind)),
    locId: shop.locId ?? homeLocId,
    cityKey: shop.cityKey ?? cityKey,
    lvl: Math.max(1, Math.min(5, shop.lvl || 1)),
    floor: Math.max(1, Math.min(3, shop.floor || 1)),
    building: shop.building ?? null,
  };
}

/** The flat payload for syncPresence, or undefined when there is no flat. */
export function flatSyncPayload(
  flat: FlatState | undefined,
  ownerName: string,
  homeLocId: string,
  cityKey: CityKey,
): { name: string; locId: string; cityKey: CityKey } | undefined {
  if (!flat) return undefined;
  return {
    name: clampName(flat.name ?? "", defaultFlatName(ownerName)),
    locId: flat.locId ?? homeLocId,
    cityKey: flat.cityKey ?? cityKey,
  };
}
