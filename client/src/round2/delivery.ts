// 🛵 round-2 (h) — 外卖 / 跑单 / 即时零售：the Chowdeck-shaped hole in the game.
//
// What already existed (verified 2026-11-11, do NOT duplicate):
//   · data.ts FOODS (3 dishes / city) + DELIVERY_PLATFORMS (美团/京东/淘宝闪购, feeMul)
//     + RESTAURANTS (rich dine-in data: dishes, scene, tier) + SHOP_VENUES (incl. 美团闪购).
//   · App.tsx orderFood(i) / orderDelivery(plat, food): INSTANT — money leaves, food is
//     eaten in the same click. No rider, no wait, no tracking, no restaurant choice.
//   · App.tsx doRoutine "grab/wait/climb/handover": a solid rider-career loop (per-order
//     pay, rain bonus, 10-min late rule, 22% tip chance) — but orders are all synthetic
//     NPC orders, there is no rating, no surge, no stacking, and a customer order can
//     never become a gig another player delivers.
// This module fills those gaps as pure, serialisable state + pure functions. It does
// NOT touch React or App.tsx: the integration agent wires it in (snippets in
// ROUND2-LOG-h.md). All money is plain ¥/HK$ numbers — App.tsx formats with fmt()/Y.
// All times are real-world ms (Date.now()); game days are only used for coupons /
// membership expiry so a save/load never strands an order.

import {
  DELIVERY_PLATFORMS,
  FOODS,
  RESTAURANTS,
  SHOP_VENUES,
} from "../data";
import type { CityKey, Dish, Food, Restaurant } from "../data";

/* ================= 平台 ================= */

export type DeliveryPlatformId = (typeof DELIVERY_PLATFORMS)[number]["id"];

export interface PlatformInfo {
  id: DeliveryPlatformId;
  name: string;
  emoji: string;
  /** 配送费倍率：菜价 × feeMul = 到手价（沿用 data.ts 的约定） */
  feeMul: number;
  note: string;
}

export function platformById(id: string): PlatformInfo | undefined {
  return DELIVERY_PLATFORMS.find((p) => p.id === id);
}

export function defaultPlatform(): PlatformInfo {
  return DELIVERY_PLATFORMS[0]!;
}

/* ================= 菜单：堂食餐厅 + 快餐，拼成外卖列表 ================= */

export interface MenuItem {
  /** "rest:<restaurantId>:<dishIdx>" or "fast:<city>:<foodIdx>" */
  key: string;
  restaurantId: string;
  restaurantName: string;
  restaurantEmoji: string;
  cuisine: string;
  tier: string;
  name: string;
  emoji: string;
  cost: number;
  energy: number;
  mood: number;
  desc: string;
  /** 堂食餐厅的菜（现做，稍慢）；快餐是 FOODS 里的现成菜 */
  madeToOrder: boolean;
}

export interface MenuRestaurant {
  id: string;
  name: string;
  emoji: string;
  cuisine: string;
  tier: string;
  scene: string;
  rating: number;
  ratingCount: number;
  items: MenuItem[];
}

/** 外卖菜单 = 本城所有餐厅的菜 + FOODS 快餐（夜市/茶餐厅档口）。 */
export function deliveryMenu(
  city: CityKey,
  ratings: Record<string, number> = {},
  ratingCounts: Record<string, number> = {},
): MenuRestaurant[] {
  const fromRestaurants: MenuRestaurant[] = RESTAURANTS.filter((r) =>
    r.cities.includes(city),
  ).map((r) => ({
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    cuisine: r.cuisine,
    tier: r.tier,
    scene: r.scene,
    rating: ratings[r.id] ?? 4.4,
    ratingCount: ratingCounts[r.id] ?? 120 + r.dishes.length * 37,
    items: r.dishes.map((d, i) => dishToMenuItem(r, d, i)),
  }));
  const fast: MenuItem[] = FOODS[city].map((f, i) => ({
    key: `fast:${city}:${i}`,
    restaurantId: `fast-${city}`,
    restaurantName:
      city === "sz" ? "东门夜市食街" : city === "hz" ? "老街夜市" : "上环茶餐厅食街",
    restaurantEmoji: "🍜",
    cuisine: "快餐小吃",
    tier: "¥",
    name: f.name,
    emoji: f.emoji,
    cost: f.cost,
    energy: f.energy,
    mood: f.mood,
    desc: f.desc,
    madeToOrder: false,
  }));
  const fastGroup: MenuRestaurant = {
    id: `fast-${city}`,
    name: fast[0]?.restaurantName ?? "夜市食街",
    emoji: "🍜",
    cuisine: "快餐小吃",
    tier: "¥",
    scene: "不用出门：夜市档口的招牌菜，骑手直接送到楼下。",
    rating: ratings[`fast-${city}`] ?? 4.6,
    ratingCount: ratingCounts[`fast-${city}`] ?? 860,
    items: fast,
  };
  return [fastGroup, ...fromRestaurants];
}

function dishToMenuItem(r: Restaurant, d: Dish, i: number): MenuItem {
  return {
    key: `rest:${r.id}:${i}`,
    restaurantId: r.id,
    restaurantName: r.name,
    restaurantEmoji: r.emoji,
    cuisine: r.cuisine,
    tier: r.tier,
    name: d.name,
    emoji: "🍽️",
    cost: d.cost,
    energy: d.energy,
    mood: d.mood,
    desc: d.desc,
    madeToOrder: true,
  };
}

export function findMenuItem(city: CityKey, key: string): MenuItem | undefined {
  return deliveryMenu(city).flatMap((r) => r.items).find((it) => it.key === key);
}

/* ================= 优惠券 / 会员 ================= */

export type CouponKind = "freeDelivery" | "off" | "percent";

export interface Coupon {
  id: string;
  kind: CouponKind;
  /** off: 立减金额；percent: 折扣率 0.8 = 八折；freeDelivery: 免配送费（不免菜价） */
  value: number;
  minSpend: number;
  label: string;
  /** 游戏天数，过期不用；不填 = 不过期 */
  expiresDay?: number;
}

export const WELCOME_COUPONS: Coupon[] = [
  { id: "new-free-delivery", kind: "freeDelivery", value: 0, minSpend: 0, label: "新人免配送费 ×1" },
  { id: "new-off-8", kind: "off", value: 8, minSpend: 25, label: "新人立减 ¥8（满 ¥25）" },
];

export function couponDiscount(c: Coupon, subtotal: number, deliveryFee: number): number {
  if (subtotal < c.minSpend) return 0;
  if (c.kind === "off") return Math.min(c.value, subtotal);
  if (c.kind === "percent") return Math.round(subtotal * (1 - c.value));
  return deliveryFee; // freeDelivery: 免掉全部配送费
}

/** 外卖会员（月卡）：免配送费 + 全单 95 折，30 游戏天。 */
export const MEMBERSHIP_PRICE = 18;
export const MEMBERSHIP_DAYS = 30;
export const MEMBER_DISCOUNT = 0.95;

export function membershipActive(untilDay: number | undefined, day: number): boolean {
  return (untilDay ?? 0) > day;
}

/* ================= 顾客下单：订单状态机 ================= */

export type OrderStage =
  | "placed" // 已下单，等商家接单
  | "accepted" // 商家接单，做菜中
  | "preparing" // 做菜中（堂食现做菜多等一会儿）
  | "pickedUp" // 骑手已取餐，在路上
  | "arriving" // 骑手到楼下了
  | "delivered" // 已送达，等你吃
  | "eaten" // 已吃完（终态）
  | "cancelled"; // 已取消（终态）

export const ORDER_STAGE_ZH: Record<OrderStage, string> = {
  placed: "已下单",
  accepted: "商家已接单",
  preparing: "做菜中",
  pickedUp: "骑手已取餐",
  arriving: "骑手到楼下了",
  delivered: "已送达",
  eaten: "已吃完",
  cancelled: "已取消",
};

/** 真实时间推进：下单后约 5–8 分钟送到（现做菜 +2 分钟）。和跑单 gig 的 2 分钟
 *  交付下限、10 分钟超时规则同量级，不会让玩家干等一局。 */
export const ORDER_STAGE_MS: Record<Exclude<OrderStage, "eaten" | "cancelled" | "delivered">, number> = {
  placed: 45_000,
  accepted: 60_000,
  preparing: 120_000,
  pickedUp: 150_000,
  arriving: 30_000,
};
const STAGE_ORDER: OrderStage[] = ["placed", "accepted", "preparing", "pickedUp", "arriving", "delivered"];

export interface OrderItem {
  key: string;
  name: string;
  emoji: string;
  cost: number;
  energy: number;
  mood: number;
  qty: number;
}

export type OrderKind = "food" | "retail";

export interface CustomerOrder {
  id: string;
  kind: OrderKind;
  city: CityKey;
  platformId: DeliveryPlatformId;
  restaurantId: string;
  restaurantName: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  couponId?: string;
  stage: OrderStage;
  /** 进入当前 stage 的真实时间戳 */
  stageAt: number;
  placedAt: number;
  /** 预计送达（真实时间戳），UI 倒计时用 */
  etaAt: number;
  riderName: string;
  riderEmoji: string;
  /** 送达后吃掉：能量/心情/饱腹的合计（下单时算好，结算时直接用） */
  energy: number;
  mood: number;
  hunger: number;
  /** 已评分 1–5（吃完后可评） */
  rated?: number;
  /** 共享单池：发布到全城跑单池后由服务器回填的池单 id；有它 = 真人骑手可能接单 */
  poolId?: number;
  /** 是否由真人骑手（而非系统骑手）配送 */
  byPlayerRider?: boolean;
}

export interface PlaceOrderInput {
  city: CityKey;
  platformId: DeliveryPlatformId;
  items: { key: string; qty: number }[];
  couponId?: string;
  coupons: Coupon[];
  memberUntilDay: number | undefined;
  day: number;
  now: number;
  riderNames?: string[];
}

export interface PlaceOrderResult {
  ok: boolean;
  error?: string;
  order?: CustomerOrder;
  /** 实际扣款（含配送费、扣掉优惠） */
  charge?: number;
}

const RIDER_NAMES = ["阿强", "小飞", "阿珍", "大头", "阿杰", "小慧", "老陈", "阿明"];
const RIDER_EMOJIS = ["🛵", "🛵", "🛵", "🚴", "🛵", "🚴", "🛵", "🛵"];

export function placeOrder(input: PlaceOrderInput): PlaceOrderResult {
  const items: OrderItem[] = [];
  let restaurantId = "";
  for (const { key, qty } of input.items) {
    if (qty <= 0) continue;
    const menu = findMenuItem(input.city, key);
    if (!menu) return { ok: false, error: `菜单里没有 ${key}，可能换城了，重新点。` };
    if (!restaurantId) restaurantId = menu.restaurantId;
    items.push({
      key,
      name: menu.name,
      emoji: menu.emoji,
      cost: menu.cost,
      energy: menu.energy,
      mood: menu.mood,
      qty,
    });
  }
  if (items.length === 0) return { ok: false, error: "购物车是空的，先加几个菜。" };
  if (items.some((it) => findMenuItem(input.city, it.key)?.restaurantId !== restaurantId)) {
    return { ok: false, error: "一次只能点同一家店——不同店分开下单，骑手一次只跑一家。" };
  }
  const platform = platformById(input.platformId) ?? defaultPlatform();
  const subtotal = items.reduce((t, it) => t + it.cost * it.qty, 0);
  const member = membershipActive(input.memberUntilDay, input.day);
  const baseFee = Math.max(3, Math.round(subtotal * (platform.feeMul - 1)));
  let deliveryFee = member ? 0 : baseFee;
  let discount = member ? Math.round(subtotal * (1 - MEMBER_DISCOUNT)) : 0;
  let coupon: Coupon | undefined;
  if (input.couponId) {
    coupon = input.coupons.find((c) => c.id === input.couponId);
    if (!coupon) return { ok: false, error: "这张券找不到了。" };
    if (coupon.expiresDay !== undefined && input.day > coupon.expiresDay) {
      return { ok: false, error: "这张券过期了。" };
    }
    if (coupon.kind === "freeDelivery") deliveryFee = 0;
    else discount += couponDiscount(coupon, subtotal, baseFee);
  }
  const total = Math.max(0, subtotal + deliveryFee - discount);
  const madeToOrder = items.some((it) => findMenuItem(input.city, it.key)?.madeToOrder);
  const extraPrep = madeToOrder ? 120_000 : 0;
  const etaAt = input.now + 45_000 + 60_000 + 120_000 + 150_000 + 30_000 + extraPrep;
  const riderIdx = Math.floor(Math.random() * RIDER_NAMES.length);
  const names = input.riderNames ?? RIDER_NAMES;
  const emojis = RIDER_EMOJIS;
  const order: CustomerOrder = {
    id: `ord-${input.now.toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`,
    kind: "food",
    city: input.city,
    platformId: platform.id,
    restaurantId,
    restaurantName: items[0] ? (findMenuItem(input.city, items[0].key)?.restaurantName ?? "") : "",
    items,
    subtotal,
    deliveryFee,
    discount,
    total,
    couponId: coupon?.id,
    stage: "placed",
    stageAt: input.now,
    placedAt: input.now,
    etaAt,
    riderName: names[riderIdx % names.length] ?? "阿强",
    riderEmoji: emojis[riderIdx % emojis.length] ?? "🛵",
    energy: items.reduce((t, it) => t + it.energy * it.qty, 0),
    mood: items.reduce((t, it) => t + it.mood * it.qty, 0),
    hunger: Math.min(100, 30 + items.reduce((t, it) => t + 8 * it.qty, 0)),
  };
  return { ok: true, order, charge: total };
}

/** 按真实时间推进订单。返回新订单 + 本次跃迁的 stage（UI 用来 toast / 播音效）。 */
export function advanceOrder(
  order: CustomerOrder,
  now: number,
): { order: CustomerOrder; advancedTo: OrderStage | null } {
  if (order.stage === "delivered" || order.stage === "eaten" || order.stage === "cancelled") {
    return { order, advancedTo: null };
  }
  let stage: OrderStage = order.stage;
  let stageAt = order.stageAt;
  let advancedTo: OrderStage | null = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const idx = STAGE_ORDER.indexOf(stage);
    if (idx < 0 || idx >= STAGE_ORDER.length - 1) break;
    const dur = ORDER_STAGE_MS[stage as keyof typeof ORDER_STAGE_MS];
    if (dur === undefined || now - stageAt < dur) break;
    stage = STAGE_ORDER[idx + 1]!;
    stageAt += dur;
    advancedTo = stage;
    if (stage === "delivered") break;
  }
  if (!advancedTo) return { order, advancedTo: null };
  return { order: { ...order, stage, stageAt }, advancedTo };
}

/** 送达后吃掉：返回结算数值，App.tsx 用 mutate() 落到 GameState。 */
export function eatDelivered(order: CustomerOrder): {
  ok: boolean;
  error?: string;
  energy: number;
  mood: number;
  hunger: number;
} {
  if (order.stage !== "delivered") {
    return { ok: false, error: "外卖还没送到，再等一会儿。", energy: 0, mood: 0, hunger: 0 };
  }
  return { ok: true, energy: order.energy, mood: order.mood, hunger: order.hunger };
}

/** 下单后 2 分钟内、商家接单前可免费取消；接单后取消扣一半菜钱（商家已备菜）。 */
export function cancelOrder(
  order: CustomerOrder,
  now: number,
): { order: CustomerOrder; refund: number } {
  if (order.stage === "eaten" || order.stage === "cancelled" || order.stage === "delivered") {
    return { order, refund: 0 };
  }
  const free = order.stage === "placed" || now - order.placedAt < 120_000;
  const refund = free ? order.total : Math.floor(order.total / 2);
  return { order: { ...order, stage: "cancelled" }, refund };
}

/* ================= 即时零售：买菜 / 药 / 日用 / 鲜花，同一条配送链 ================= */

export type RetailKind = "grocery" | "pharmacy" | "daily" | "flowers";

export interface RetailShop {
  id: string;
  kind: RetailKind;
  name: string;
  emoji: string;
  cities: CityKey[];
  scene: string;
  items: { name: string; cost: number; mood: number; desc: string }[];
}

/** 复用 SHOP_VENUES 的美团闪购 + 网购数据，拼成 30 分钟达的即时零售。 */
export function retailShops(city: CityKey): RetailShop[] {
  const flash = SHOP_VENUES.find((v) => v.id === "meituan-shop");
  const online = SHOP_VENUES.find((v) => v.id === "online-shop");
  const shops: RetailShop[] = [];
  if (flash && flash.cities.includes(city)) {
    shops.push({
      id: "flash-grocery",
      kind: "grocery",
      name: "美团闪购 · 买菜做饭",
      emoji: "🥬",
      cities: flash.cities,
      scene: flash.scene,
      items: [
        { name: "买菜做饭包", cost: 45, mood: 7, desc: "菜肉蛋配好，自己做一顿" },
        { name: "深夜泡面 + 火腿肠", cost: 15, mood: 5, desc: "加班夜的救命粮" },
      ],
    });
    shops.push({
      id: "flash-daily",
      kind: "daily",
      name: "美团闪购 · 日用补货",
      emoji: "🧻",
      cities: flash.cities,
      scene: flash.scene,
      items: [
        { name: "日用补货包", cost: 68, mood: 6, desc: "纸巾洗护一次买齐" },
        { name: "一束鲜花", cost: 39, mood: 12, desc: "送给自己也行" },
      ],
    });
    shops.push({
      id: "flash-pharmacy",
      kind: "pharmacy",
      name: "闪购药房 · 30 分钟达",
      emoji: "💊",
      cities: flash.cities,
      scene: "半夜发烧也不用出门：退烧药、感冒药、创可贴，骑手 30 分钟送到。",
      items: [
        { name: "退烧药 + 体温计", cost: 32, mood: 4, desc: "家里常备，有备无患" },
        { name: "感冒药 + 维生素C", cost: 28, mood: 4, desc: "多喝热水不如早点吃药" },
        { name: "创可贴 + 碘伏", cost: 12, mood: 2, desc: "小伤口自己处理" },
      ],
    });
  }
  if (online && online.cities.includes(city)) {
    shops.push({
      id: "online-daily",
      kind: "daily",
      name: "网购 · 日用百货（次日达）",
      emoji: "🛒",
      cities: online.cities,
      scene: online.scene,
      items: online.items.map((it) => ({ name: it.name, cost: it.cost, mood: it.mood, desc: it.desc })),
    });
  }
  return shops;
}

/** 零售单复用 placeOrder 的计价：把零售商品拼成一单 food 订单再改 kind。 */
export function placeRetailOrder(input: {
  city: CityKey;
  platformId: DeliveryPlatformId;
  shopId: string;
  itemIdx: number;
  qty: number;
  coupons: Coupon[];
  couponId?: string;
  memberUntilDay: number | undefined;
  day: number;
  now: number;
}): PlaceOrderResult {
  const shop = retailShops(input.city).find((s) => s.id === input.shopId);
  const item = shop?.items[input.itemIdx];
  if (!shop || !item) return { ok: false, error: "这件商品下架了。" };
  // 零售没有现做菜：借 placeOrder 的快餐路径计价，再把 kind/店名改回来。
  const fastKey = `fast:${input.city}:0`;
  const base = placeOrder({
    city: input.city,
    platformId: input.platformId,
    items: [{ key: fastKey, qty: 1 }],
    couponId: input.couponId,
    coupons: input.coupons,
    memberUntilDay: input.memberUntilDay,
    day: input.day,
    now: input.now,
  });
  if (!base.ok || !base.order) return base;
  // 按零售实价重算（快餐占位价只用来走通计价管线；折扣按零售小计重算）
  const subtotal = item.cost * input.qty;
  const platform = platformById(input.platformId) ?? defaultPlatform();
  const member = membershipActive(input.memberUntilDay, input.day);
  const deliveryFee = member ? 0 : Math.max(3, Math.round(subtotal * (platform.feeMul - 1)));
  let discount = member ? Math.round(subtotal * (1 - MEMBER_DISCOUNT)) : 0;
  const coupon = input.couponId ? input.coupons.find((c) => c.id === input.couponId) : undefined;
  if (coupon) discount += couponDiscount(coupon, subtotal, deliveryFee);
  const total = Math.max(0, subtotal + deliveryFee - discount);
  const order: CustomerOrder = {
    ...base.order,
    kind: "retail",
    restaurantId: shop.id,
    restaurantName: shop.name,
    items: [{ key: `retail:${shop.id}:${input.itemIdx}`, name: item.name, emoji: shop.emoji, cost: item.cost, energy: 0, mood: item.mood, qty: input.qty }],
    subtotal,
    deliveryFee,
    total,
    energy: 0,
    mood: item.mood * input.qty,
    hunger: 0,
  };
  return { ok: true, order, charge: total };
}

/* ================= 跑单：兼职骑手接单板（任何职业都能跑，不只骑手生涯） ================= */

export interface DeliveryStop {
  id: string;
  name: string;
  type: string;
  x: number;
  z: number;
}

export type GigKind = "food" | "retail" | "errand";

export interface CourierGig {
  id: string;
  kind: GigKind;
  /** 共享单池来的真人订单（服务器池单 id）；没有 = 系统派单 */
  poolId?: number;
  customerName?: string;
  shopId: string;
  shopName: string;
  shopEmoji: string;
  destId: string;
  destName: string;
  distance: number;
  /** 基础配送费（已含距离价） */
  pay: number;
  /** 高峰加价 / 下雨加价（已计入 pay 的拆分，UI 展示用） */
  surge: number;
  rainBonus: number;
  /** 上楼：老小区没电梯，爬上去才有这单的完整评价 */
  stairs: boolean;
  /** 接单后必须在此时限内送达（真实时间戳） */
  deadlineAt: number;
  stage: "offered" | "accepted" | "pickedUp";
  acceptedAt?: number;
  pickedUpAt?: number;
  /** 拼单：同一趟顺路的第二单 id */
  stackWith?: string;
}

export interface CourierProfile {
  rating: number; // 5.0 起，4.0 以下接不到高峰单
  completed: number;
  onTime: number;
  late: number;
  cancelled: number;
  totalEarned: number;
  todayCount: number;
  todayEarned: number;
  todayDay: number;
  streakDays: number;
  lastActiveDay: number;
}

export function emptyCourierProfile(): CourierProfile {
  return {
    rating: 5.0,
    completed: 0,
    onTime: 0,
    late: 0,
    cancelled: 0,
    totalEarned: 0,
    todayCount: 0,
    todayEarned: 0,
    todayDay: 0,
    streakDays: 0,
    lastActiveDay: 0,
  };
}

export type CourierLevel = "新手骑手" | "熟手骑手" | "金牌骑手" | "单王";

/** 评级 + 单量决定称号与单价加成（开放成长线，不锁职业）。 */
export function courierLevel(p: CourierProfile): { title: CourierLevel; payMul: number; perk: string } {
  if (p.completed >= 100 && p.rating >= 4.8) return { title: "单王", payMul: 1.25, perk: "单价 +25%，优先派高价单" };
  if (p.completed >= 30 && p.rating >= 4.6) return { title: "金牌骑手", payMul: 1.15, perk: "单价 +15%，可一次接 3 单" };
  if (p.completed >= 10) return { title: "熟手骑手", payMul: 1.08, perk: "单价 +8%" };
  return { title: "新手骑手", payMul: 1.0, perk: "先跑满 10 单升级" };
}

/** 高峰时段：午 11:00–13:30、晚 17:30–20:00（北京时间分钟数），单价 ×1.3。 */
export function surgeMul(nowMin: number): number {
  const inLunch = nowMin >= 11 * 60 && nowMin <= 13 * 60 + 30;
  const inDinner = nowMin >= 17 * 60 + 30 && nowMin <= 20 * 60;
  return inLunch || inDinner ? 1.3 : 1.0;
}

export function gigPayFor(distance: number, basePay: number, nowMin: number, rainy: boolean, levelMul: number): { pay: number; surge: number; rainBonus: number } {
  const distPay = Math.round(6 + distance * 0.9 + basePay * 0.02);
  const surge = Math.round(distPay * (surgeMul(nowMin) - 1));
  const rainBonus = rainy ? 4 : 0;
  const pay = Math.round((distPay + surge + rainBonus) * levelMul);
  return { pay, surge, rainBonus };
}

const GIG_SHOP_NAMES: Record<string, [string, string]> = {
  food: ["🍜", "夜市食街"],
  mall: ["🛍️", "商场美食层"],
  market: ["🥬", "菜市场档口"],
  social: ["🍢", "深夜大排档"],
};

/** 生成接单板：App.tsx 传入本城地点（getLocations），这里只做派单逻辑。 */
export function generateCourierBoard(input: {
  stops: DeliveryStop[];
  city: CityKey;
  now: number;
  nowMin: number;
  rainy: boolean;
  profile: CourierProfile;
  count?: number;
  /** 系统骑手生涯（doRoutine grab）已有的单就别重复派 */
  excludeShopIds?: string[];
}): CourierGig[] {
  const shops = input.stops.filter(
    (l) => ["food", "mall", "market", "social"].includes(l.type) && !(input.excludeShopIds ?? []).includes(l.id),
  );
  const dests = input.stops.filter((l) =>
    ["home", "work", "learn", "health", "hotel", "fun", "scenic", "transit"].includes(l.type),
  );
  if (shops.length === 0 || dests.length === 0) return [];
  const { payMul } = courierLevel(input.profile);
  const n = Math.min(input.count ?? 3, shops.length);
  const gigs: CourierGig[] = [];
  const used = new Set<string>();
  for (let i = 0; i < n; i++) {
    const shop = shops[Math.floor(Math.random() * shops.length)]!;
    if (used.has(shop.id)) continue;
    used.add(shop.id);
    const near = dests.filter((d) => {
      const dist = Math.hypot(d.x - shop.x, d.z - shop.z);
      return dist > 2.5 && dist < 16;
    });
    const pool = near.length ? near : dests;
    const dest = pool[Math.floor(Math.random() * pool.length)]!;
    const distance = Math.hypot(dest.x - shop.x, dest.z - shop.z);
    const { pay, surge, rainBonus } = gigPayFor(distance, 1200, input.nowMin, input.rainy, payMul);
    const [emoji, fallback] = GIG_SHOP_NAMES[shop.type] ?? ["🍱", shop.name];
    gigs.push({
      id: `gig-${input.now.toString(36)}-${i}`,
      kind: "food",
      shopId: shop.id,
      shopName: shop.name || fallback,
      shopEmoji: emoji,
      destId: dest.id,
      destName: dest.name,
      distance: Math.round(distance * 10) / 10,
      pay,
      surge,
      rainBonus,
      stairs: Math.random() < 0.45 || dest.id.startsWith("ar:"),
      deadlineAt: input.now + 10 * 60_000,
      stage: "offered",
    });
  }
  return gigs;
}

export const MAX_STACKED_GIGS = 2; // 金牌以上 3 单（courierLevel  perk）
export const GIG_LATE_MS = 10 * 60_000; // 与 rider 生涯的 10 分钟超时规则一致

export function maxConcurrentGigs(p: CourierProfile): number {
  return courierLevel(p).title === "金牌骑手" || courierLevel(p).title === "单王" ? 3 : MAX_STACKED_GIGS;
}

export function acceptGig(
  gig: CourierGig,
  active: CourierGig[],
  profile: CourierProfile,
  now: number,
): { ok: boolean; error?: string; gig?: CourierGig } {
  if (active.length >= maxConcurrentGigs(profile)) {
    return { ok: false, error: `手上已有 ${active.length} 单，先送完再接（升级后能多接）。` };
  }
  if (profile.rating < 4.0 && gig.surge > 0) {
    return { ok: false, error: "评分低于 4.0，高峰单先不派给你——先跑几单把评分拉回来。" };
  }
  return { ok: true, gig: { ...gig, stage: "accepted", acceptedAt: now } };
}

/** 取餐：必须站在商家所在地（App.tsx 传入 currentLoc 对照）。 */
export function pickupGig(
  gig: CourierGig,
  atShop: boolean,
  now: number,
): { ok: boolean; error?: string; gig?: CourierGig } {
  if (gig.stage !== "accepted") return { ok: false, error: "这单还没接。" };
  if (!atShop) return { ok: false, error: "先到商家那儿取餐。" };
  return { ok: true, gig: { ...gig, stage: "pickedUp", pickedUpAt: now } };
}

export interface DeliverGigResult {
  ok: boolean;
  error?: string;
  pay: number;
  tip: number;
  late: boolean;
  ratingDelta: number;
  profile: CourierProfile;
  note: string;
}

/** 送达结算：准时/超时、小费、评分、连单。App.tsx 在此之后 mutate() 落账。 */
export function deliverGig(
  gig: CourierGig,
  input: {
    atDest: boolean;
    climbedStairs: boolean;
    now: number;
    day: number;
    profile: CourierProfile;
    /** 顾客给的星（系统单随机 4–5 星；真人单由顾客打分，见 server spec） */
    customerStars?: number;
  },
): DeliverGigResult {
  const p = input.profile;
  if (gig.stage !== "pickedUp") {
    return { ok: false, error: "先到商家取餐，再送过去。", pay: 0, tip: 0, late: false, ratingDelta: 0, profile: p, note: "" };
  }
  if (!input.atDest) {
    return { ok: false, error: "还没到顾客那儿。", pay: 0, tip: 0, late: false, ratingDelta: 0, profile: p, note: "" };
  }
  if (gig.stairs && !input.climbedStairs) {
    return { ok: false, error: "顾客住七楼没电梯，先爬上去。", pay: 0, tip: 0, late: false, ratingDelta: 0, profile: p, note: "" };
  }
  const late = input.now > gig.deadlineAt;
  let pay = late ? Math.round(gig.pay * 0.7) : gig.pay;
  const tip = !late && Math.random() < 0.25 ? 3 + Math.floor(Math.random() * 8) : 0;
  pay += tip;
  const stars = input.customerStars ?? (late ? 3 : 4 + Math.floor(Math.random() * 2));
  const ratingDelta = stars >= 5 ? 0.02 : stars === 4 ? 0.01 : stars === 3 ? -0.05 : -0.12;
  const rating = Math.max(3.0, Math.min(5.0, Math.round((p.rating + ratingDelta) * 100) / 100));
  const today = input.day === p.todayDay;
  const profile: CourierProfile = {
    ...p,
    rating,
    completed: p.completed + 1,
    onTime: p.onTime + (late ? 0 : 1),
    late: p.late + (late ? 1 : 0),
    totalEarned: p.totalEarned + pay,
    todayCount: (today ? p.todayCount : 0) + 1,
    todayEarned: (today ? p.todayEarned : 0) + pay,
    todayDay: input.day,
    streakDays: input.day === p.lastActiveDay + 1 ? p.streakDays + 1 : input.day === p.lastActiveDay ? p.streakDays : 1,
    lastActiveDay: input.day,
  };
  const note = late
    ? `超时送达，扣了三成，只拿到 ¥${pay}。`
    : `送达！¥${pay}${tip ? `（含小费 ¥${tip}）` : ""}，顾客给了 ${stars} 星。`;
  return { ok: true, pay, tip, late, ratingDelta, profile, note };
}

/** 取消已接的单：评分 -0.2，计一次取消；一天取消 3 次，当天不再派单。 */
export function cancelGig(
  _gig: CourierGig,
  profile: CourierProfile,
): { profile: CourierProfile; blockedToday: boolean } {
  const cancelled = profile.cancelled + 1;
  const rating = Math.max(3.0, Math.round((profile.rating - 0.2) * 100) / 100);
  return {
    profile: { ...profile, cancelled, rating },
    blockedToday: cancelled >= 3,
  };
}

/* ================= 共享单池：顾客的单 → 真人骑手的接单板 =================
 * 客户端只做 payload 组装与本地映射；钱、超时、评分以服务器为准（见 server spec）。
 * 流程：顾客 placeOrder → publishToPool（可选，默认开）→ 服务器池单；
 * 骑手 courier board 拉取 poolList → claim → 送达 → poolDelivered → 顾客订单
 * stage 跳到 delivered，骑手拿到配送费 + 小费，顾客可给星。 */

export interface PoolOrderPayload {
  city: CityKey;
  platformId: DeliveryPlatformId;
  restaurantId: string;
  restaurantName: string;
  items: { name: string; qty: number }[];
  total: number;
  /** 骑手能拿到的配送费（= 顾客付的 deliveryFee，至少 ¥3） */
  riderFee: number;
  destLabel: string;
  placedAt: number;
}

export function poolPayloadFor(order: CustomerOrder, destLabel: string): PoolOrderPayload {
  return {
    city: order.city,
    platformId: order.platformId,
    restaurantId: order.restaurantId,
    restaurantName: order.restaurantName,
    items: order.items.map((it) => ({ name: it.name, qty: it.qty })),
    total: order.total,
    riderFee: Math.max(3, order.deliveryFee),
    destLabel,
    placedAt: order.placedAt,
  };
}

/** 池单 → 本地 CourierGig（骑手接单板上与系统单长得一样，只是 poolId 有值）。 */
export function poolOrderToGig(pool: {
  id: number;
  restaurantId: string;
  restaurantName: string;
  destId: string;
  destName: string;
  distance: number;
  riderFee: number;
  customerName: string;
  deadlineAt: number;
}): CourierGig {
  return {
    id: `pool-${pool.id}`,
    kind: "food",
    poolId: pool.id,
    customerName: pool.customerName,
    shopId: pool.restaurantId,
    shopName: pool.restaurantName,
    shopEmoji: "🍜",
    destId: pool.destId,
    destName: pool.destName,
    distance: pool.distance,
    pay: pool.riderFee,
    surge: 0,
    rainBonus: 0,
    stairs: false,
    deadlineAt: pool.deadlineAt,
    stage: "offered",
  };
}

/* ================= 存档切片 ================= */

export interface DeliveryState {
  /** 顾客订单（保留最近 20 单，旧的只留记录行） */
  orders: CustomerOrder[];
  activeOrderId?: string;
  coupons: Coupon[];
  memberUntilDay?: number;
  favorites: string[]; // restaurantId
  /** 餐厅评分（顾客吃完后打的星，1–5） */
  myRatings: Record<string, number>;
  courier: CourierProfile;
  /** 手上正在跑的单（最多 2–3 单） */
  activeGigs: CourierGig[];
  gigHistory: { id: string; shopName: string; destName: string; pay: number; late: boolean; day: number }[];
  /** 新手礼包发过没有 */
  welcomed: boolean;
}

export function emptyDeliveryState(): DeliveryState {
  return {
    orders: [],
    coupons: [...WELCOME_COUPONS],
    favorites: [],
    myRatings: {},
    courier: emptyCourierProfile(),
    activeGigs: [],
    gigHistory: [],
    welcomed: false,
  };
}

/** 存档读入时的轻量校验：形状不对就丢弃回空状态，别让坏存档炸掉游戏。 */
export function isDeliveryState(v: unknown): v is DeliveryState {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    Array.isArray(o.orders) &&
    Array.isArray(o.coupons) &&
    Array.isArray(o.favorites) &&
    Array.isArray(o.activeGigs) &&
    Array.isArray(o.gigHistory) &&
    typeof o.courier === "object" &&
    o.courier !== null &&
    typeof (o.courier as Record<string, unknown>).rating === "number"
  );
}

/** 下单后把订单推进 state（只留最近 20 单）；吃完/取消后 activeOrderId 清掉。 */
export function pushOrder(state: DeliveryState, order: CustomerOrder): DeliveryState {
  const orders = [order, ...state.orders.filter((o) => o.id !== order.id)].slice(0, 20);
  return { ...state, orders, activeOrderId: order.id };
}

export function updateOrder(state: DeliveryState, order: CustomerOrder): DeliveryState {
  const orders = state.orders.map((o) => (o.id === order.id ? order : o));
  const activeOrderId =
    order.stage === "eaten" || order.stage === "cancelled" ? undefined : state.activeOrderId;
  return { ...state, orders, activeOrderId };
}

export function activeOrder(state: DeliveryState): CustomerOrder | undefined {
  return state.orders.find((o) => o.id === state.activeOrderId);
}

/** 吃完后给餐厅打星（1–5），顺手收藏好吃的店。 */
export function rateRestaurant(
  state: DeliveryState,
  orderId: string,
  stars: number,
): DeliveryState {
  const clamped = Math.max(1, Math.min(5, Math.round(stars)));
  const orders = state.orders.map((o) => (o.id === orderId ? { ...o, rated: clamped } : o));
  const order = orders.find((o) => o.id === orderId);
  const myRatings = order ? { ...state.myRatings, [order.restaurantId]: clamped } : state.myRatings;
  const favorites =
    order && clamped >= 4 && !state.favorites.includes(order.restaurantId)
      ? [...state.favorites, order.restaurantId]
      : state.favorites;
  return { ...state, orders, myRatings, favorites };
}

/** 今日跑单小结（接单板顶部展示用）。 */
export function courierTodaySummary(p: CourierProfile, day: number): {
  count: number;
  earned: number;
  onTimeRate: number;
  level: ReturnType<typeof courierLevel>;
} {
  const count = day === p.todayDay ? p.todayCount : 0;
  const earned = day === p.todayDay ? p.todayEarned : 0;
  const onTimeRate = p.completed > 0 ? Math.round((p.onTime / p.completed) * 100) : 100;
  return { count, earned, onTimeRate, level: courierLevel(p) };
}

/* ================= Lagos Life gap check（2026-11-11 实测对照） =================
 * Lagos Life 模型（公开资料 + repo DATA-PLAN 引用）：solo dev 浏览器 life sim，
 * 34 locations / 33 careers，免费进，不卖数值；收入 = 商家租路边广告牌
 * （₦5,000/周，38 块牌）、音乐人付费进虚拟夜店（₦50,000）、Chowdeck 外卖做到
 * 手机 App 里、玩家真钱买游戏币。下面每一项都对照了本游戏的实际代码。 */

export type GapStatus = "done" | "partial" | "gap";

export interface LagosGap {
  id: string;
  lagosFeature: string;
  status: GapStatus;
  /** 本游戏里的对照位置 */
  where: string;
  note: string;
  /** gap/partial 时：下一轮怎么做（已在本模块实现的写 "done in delivery.ts"） */
  next?: string;
}

export const LAGOS_GAP_CHECK: LagosGap[] = [
  {
    id: "entry",
    lagosFeature: "零门槛进：浏览器打开就玩，不下载不注册",
    status: "done",
    where: "App.tsx / standalone",
    note: "网页端直接玩；账号只在涉及钱托管的社交功能（发 gig、雇人）时才要求绑定。",
  },
  {
    id: "billboards",
    lagosFeature: "商家租路边广告牌（Lagos：₦5,000/周，38 块）",
    status: "done",
    where: "server/src/actions.ts getBillboards/buyBillboard/adminBillboard",
    note: "玩家花 ✨ 租 7 天；管理员可免费给本地商家上牌。比 Lagos 多了玩家自助租牌。",
  },
  {
    id: "nightclub",
    lagosFeature: "音乐人付费进虚拟夜店（Lagos：₦50,000）",
    status: "done",
    where: "Livehouse.tsx + server livehouseState/featured",
    note: "音乐人投稿原创，300 ✨ 买本周主打、全城轮播两次。投稿、审核、轮播全套已通。",
  },
  {
    id: "currency",
    lagosFeature: "玩家真钱买游戏币",
    status: "done",
    where: "Store.tsx + server createOrder（Stripe）",
    note: "星光 ✨ 商店已通；上线前需确认收款通道（大陆个人开不了 Stripe，见 MEMORY）。",
  },
  {
    id: "food-delivery",
    lagosFeature: "Chowdeck 外卖做到手机 App 里（点餐 + 骑手）",
    status: "partial",
    where: "本模块 delivery.ts + App.tsx orderFood/orderDelivery（旧的即时版）",
    note: "顾客侧原来只有即时下单（无骑手、无等待、无餐厅选择）；骑手生涯有 synthetic 派单循环但无评分/高峰/拼单，且顾客单永远变不成骑手单。本模块补齐：全菜单点餐、5–8 分钟真实配送状态机、优惠券/会员、兼职跑单板、评分/高峰/拼单、共享单池（顾客单 → 真人骑手）。",
    next: "done in delivery.ts — 待 App.tsx 接线（见 ROUND2-LOG-h.md 集成片段）+ area S 实现单池端点。",
  },
  {
    id: "merchant-sponsor",
    lagosFeature: "商家赞助不止广告牌：赞助的店/菜进游戏内容",
    status: "gap",
    where: "—（无对应代码；RESTAURANTS 全是写死数据）",
    note: "Lagos 的 Chowdeck 本身就是商家赞助进 App。本游戏餐厅全是静态数据，本地商家没法把自己的店和菜放进外卖列表——这是广告牌之外第二条商家变现路。",
    next: "下一轮：server 加 sponsoredRestaurant 表 + admin 端点（见 ROUND2-LOG-h.md server spec deliverySponsorSlot），delivery.ts 里 MenuRestaurant 加 sponsored 标记位即可接。",
  },
  {
    id: "creator-payout",
    lagosFeature: "音乐人/创作者能从游戏里赚钱（不只是花钱打榜）",
    status: "gap",
    where: "server livehouse featured 只收 300 ✨；sendGift/claimGift 有礼物通道",
    note: "音乐人现在是纯付费方。Lagos 模式里夜店是收入；更完整的闭环是听众打赏/点歌分成。游戏已有 sendGift 礼物通道可复用。",
    next: "下一轮：Livehouse 加打赏/点歌（听众花 ✨ 点歌，七成归音乐人），复用 sendGift + 收入分成 gift 路径。",
  },
  {
    id: "invite",
    lagosFeature: "病毒传播：邀请链接 / 分享裂变",
    status: "done",
    where: "share.ts readInvite/inviteLink + drawShareCard",
    note: "?invite=<playerId> 链接：新玩家得内推 + 迎新奖励，邀请人得感谢奖励；还有可分享的人生卡片 PNG。",
  },
  {
    id: "group-order",
    lagosFeature: "拼单 / 一起点（社交点餐）",
    status: "gap",
    where: "—（无对应代码）",
    note: "Lagos/Chowdeck 类 App 的常见玩法：室友/同事拼一单摊配送费。本游戏有室友系统（roommate 租金对半），拼单是自然的延伸。",
    next: "下一轮：CustomerOrder 加 groupId + 参与人分摊；可先做同屋拼单（室友各点各的菜、一单结算、配送费对半）。",
  },
  {
    id: "retention-loop",
    lagosFeature: "留存钩子：每日任务/连续签到式的外卖激励",
    status: "partial",
    where: "本模块 courier streakDays + WELCOME_COUPONS；App.tsx 另有每日例行",
    note: "跑单有连续天数（streakDays）和等级成长；顾客侧只有新人券，缺“连续点餐/每周任务”式留存。",
    next: "下一轮小活：在 delivery.ts 加 weeklyDeliveryQuest（本周点 3 单返一张券），纯客户端即可。",
  },
];

export function lagosGapSummary(): { done: number; partial: number; gap: number; open: LagosGap[] } {
  const done = LAGOS_GAP_CHECK.filter((g) => g.status === "done").length;
  const partial = LAGOS_GAP_CHECK.filter((g) => g.status === "partial").length;
  const gap = LAGOS_GAP_CHECK.filter((g) => g.status === "gap").length;
  return { done, partial, gap, open: LAGOS_GAP_CHECK.filter((g) => g.status !== "done") };
}

/* ================= 导出给 App.tsx 用的小工具 ================= */

export function fmtDeliveryCountdown(order: CustomerOrder, now: number): string {
  if (order.stage === "delivered") return "已送达，快吃吧";
  if (order.stage === "eaten" || order.stage === "cancelled") return ORDER_STAGE_ZH[order.stage];
  const left = Math.max(0, order.etaAt - now);
  const min = Math.floor(left / 60_000);
  const sec = Math.floor((left % 60_000) / 1000);
  return `约 ${min} 分 ${sec} 秒后送达 · ${ORDER_STAGE_ZH[order.stage]}`;
}

export type { Dish, Food, Restaurant };
