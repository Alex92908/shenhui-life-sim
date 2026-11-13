// economy.ts — ROUND-2 area (e): open-ended economy gameplay.
//
// Systems, not scripted paths. Every system below accepts free player input
// (free text, free prices) and never forces one "right" way to play.
// Additive: this module holds pure types + pure logic only. It does NOT
// import App.tsx / data.ts / LifeStage.tsx, and it does NOT touch GameState
// directly — App.tsx calls these helpers and writes the results into its own
// save (see the integration snippets in ROUND2-LOG-e.md).
//
// The five systems:
//   1. Subletting （转租）      — rent out (part of) your rented home.
//   2. Overseas shopping （海淘） — order imported goods; they arrive after
//      N in-game days, after shipping + customs.
//   3. Buy-cheap-sell-cheap （贱买贱卖） — volume flipping of used / broken /
//      cheap goods: small margins, quick turnover. Distinct from the
//      existing phone/ticket flip (activities.ts "flip": buy low, sell HIGH).
//   4. Second-hand furniture （二手家具） — the flea market actually sells
//      old furniture now; buy it, place it at home, resell it later.
//   5. Player-issued trade tasks — players post their OWN buy/sell tasks
//      with FREE TEXT and FREE PRICES. This is the open-ended core: unlike
//      the map billboard (Social.tsx BillboardModal — four fixed categories:
//      hiring / rooms / sales / day-labor), a trade task has no category
//      gate at all.
//
// Money: all amounts are in-game ¥ (GameState.money). No real money anywhere.
// Fees are deliberately light (see FEES): player-to-player trade is free;
// the only paid knob is optional promotion through the existing billboard /
// Starlight ✨ paths, never a cut of the trade itself. No pay-to-win.
//
// Server: the multiplayer parts (listings / tasks / escrow / orders) need
// server endpoints. The spec lives in ROUND2-LOG-e.md ("Server endpoint
// spec for area S"). The client-side functions here are written so the
// server can be the source of truth later: every mutating helper takes the
// current state in and returns a new state + events out, and every id is an
// opaque string the server may mint instead.
//
// Hooks to other round-2 areas:
//   - area (d) landlord system: `LandlordPort` below. Subletting risk flows
//     through it; if (d) is not integrated yet, the local fallback
//     (`defaultLandlordCheck`) still works offline.
//   - area (d) disputes: `DisputePort` below. Trade-task disputes flow
//     through it; without it, disputes just sit in `status: "disputed"`.

// ---------------------------------------------------------------------------
// Shared basics
// ---------------------------------------------------------------------------

/** In-game money, ¥. */
export type Yen = number;

/** A player, identified the way the server already does (players.id / name). */
export interface PlayerRef {
  playerId: string;
  name: string;
}

/** One in-game day number (GameState.day). */
export type GameDay = number;

/** Result of a pure action: new state slice + human-readable events for the log/toast. */
export interface EconResult<T> {
  ok: boolean;
  /** New value (state slice / created record). Undefined when ok is false. */
  value?: T;
  /** Why it failed, in Chinese (shown to the player as-is). */
  error?: string;
  /** Events for the game log / feed / toast. */
  events: string[];
}

/** Small helper to build results without repeating the shape. */
function ok<T>(value: T, events: string[] = []): EconResult<T> {
  return { ok: true, value, events };
}
function fail<T>(error: string): EconResult<T> {
  return { ok: false, error, events: [] };
}

/** Clamp a number into [min, max]. */
function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Whole-yen rounding (the game never shows decimals). */
function yen(n: number): Yen {
  return Math.max(0, Math.round(n));
}

/** Opaque id minting for offline/local use. The server mints its own ids. */
export function mintEconId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffff).toString(36)}`;
}

// ---------------------------------------------------------------------------
// Fee rules — deliberately light, no pay-to-win
// ---------------------------------------------------------------------------

export const FEES = {
  /** Posting a sublet listing / trade task / cheap-goods ad: free. */
  postFee: 0,
  /** Player-to-player trade completion fee: free. The game takes no cut. */
  tradeFeeRate: 0,
  /** Overseas shipping is a flat per-order fee (not a % cut); customs duty
   *  is a separate, visible line item — see OVERSEAS. */
  overseasShippingFlat: 25,
  /** Optional promotion: re-use the existing billboard price (300 ✨/week,
   *  Social.tsx) — never required, never a cut of the trade. */
  promoteViaBillboardStars: 300,
  /** Flea-market stall cut on reselling used furniture there: 0 while the
   *  market is new; the server may raise it later, capped here so the
   *  client can warn the player. */
  fleaResaleCutRate: 0,
  /** Max platform cut the client will ever accept, as a safety rail. */
  maxAcceptableCutRate: 0.05,
} as const;

/** The one-line fee disclosure shown wherever money changes hands. */
export function feeNote(): string {
  return "玩家之间交易不抽成；海淘只收固定运费 25¥ + 如实报关的关税。";
}

// ---------------------------------------------------------------------------
// 1. SUBLETTING （转租）
// ---------------------------------------------------------------------------

/** What part of the home is being sublet. "whole" = the player moves out
 *  for the sublet period (e.g. back to a hometown / a friend's sofa). */
export type SubletSpace = "room" | "bed" | "sofa" | "whole";

/** A sublet listing posted by a player. Terms are free text — the player
 *  writes their own rules ("包水电" / "禁烟" / "可短租一周" …). */
export interface SubletListing {
  id: string;
  owner: PlayerRef;
  /** data.ts place id of the home being sublet ("home" in the player's city). */
  homeLocId: string;
  city: "sz" | "hz" | "hk";
  space: SubletSpace;
  /** Monthly sublet price, ¥ — set freely by the owner. */
  monthlyPrice: Yen;
  /** Deposit, ¥ — free choice, 0 allowed ("免押"). */
  deposit: Yen;
  /** Free-text terms, e.g. "包水电网，禁烟，可养猫，押一付一". */
  terms: string;
  /** Minimum / maximum stay in days. 0 max = no upper limit. */
  minDays: number;
  maxDays: number;
  /** When the space is free from (game day). */
  availableFromDay: GameDay;
  status: "open" | "taken" | "closed";
  tenant?: PlayerRef;
  /** Day the current tenancy started (0 = none). */
  tenancyStartDay: GameDay;
  /** Rent already collected from this tenancy, ¥. */
  rentCollected: Yen;
  createdDay: GameDay;
}

/** The player's own sublet bookkeeping: their listings + landlord heat. */
export interface SubletBook {
  listings: SubletListing[];
  /** 0–100. Rises while an unauthorised sublet runs; the landlord system
   *  (area d) reads/writes this. 100 = caught. */
  landlordSuspicion: number;
  /** True once the landlord has found out (area d resolves the consequence:
   *  warning / fine / eviction — this module only reports the discovery). */
  landlordFoundOut: boolean;
  /** Consequence already applied by area (d), so it is not applied twice. */
  landlordPenaltyApplied: boolean;
}

export function emptySubletBook(): SubletBook {
  return { listings: [], landlordSuspicion: 0, landlordFoundOut: false, landlordPenaltyApplied: false };
}

/** Soft guidance, not a hard rule: subletting above your own rent is
 *  allowed (open game) but the game says so out loud — the landlord is
 *  more likely to notice a "二房东" markup. */
export const SUBLET = {
  /** Suspicion gained per day while a sublet runs unnoticed. */
  suspicionPerDay: 2,
  /** Extra suspicion per day when the sublet price exceeds the player's own rent. */
  markupSuspicionPerDay: 4,
  /** Daily chance (0–1) the landlord drops by while suspicion is high. */
  landlordVisitChanceAtHighSuspicion: 0.12,
  /** Suspicion level that counts as "high". */
  highSuspicion: 60,
  /** How often sublet rent is paid out (game days). */
  rentPayoutEveryDays: 7,
  /** Deposit is held, not spent: it returns to the tenant on a clean exit. */
  depositHeld: true,
} as const;

export interface PostSubletInput {
  owner: PlayerRef;
  homeLocId: string;
  city: "sz" | "hz" | "hk";
  space: SubletSpace;
  monthlyPrice: Yen;
  deposit: Yen;
  terms: string;
  minDays: number;
  maxDays: number;
  availableFromDay: GameDay;
  /** The player's own monthly rent (GameState.rent) — used only for the
   *  soft "above your own rent" warning, never to block. */
  ownMonthlyRent?: Yen;
  createdDay: GameDay;
}

/** Post a sublet listing. Free text, free price; the only hard blocks are
 *  nonsense numbers and an empty space choice. */
export function postSubletListing(book: SubletBook, input: PostSubletInput): EconResult<{ book: SubletBook; listing: SubletListing }> {
  if (input.monthlyPrice <= 0) return fail("转租价得大于 0。想免费让人住就写 1¥，意思一下。");
  if (input.monthlyPrice > 100000) return fail("转租价高得离谱，先改小一点。");
  if (input.deposit < 0 || input.deposit > 100000) return fail("押金写个正常数。");
  if (input.minDays < 0 || input.maxDays < 0) return fail("最短/最长入住天数不能是负数。");
  if (input.maxDays > 0 && input.maxDays < input.minDays) return fail("最长入住不能比最短还短。");
  if (input.terms.length > 500) return fail("转租说明 500 字以内就够了。");
  const listing: SubletListing = {
    id: mintEconId("sublet"),
    owner: input.owner,
    homeLocId: input.homeLocId,
    city: input.city,
    space: input.space,
    monthlyPrice: yen(input.monthlyPrice),
    deposit: yen(input.deposit),
    terms: input.terms.trim(),
    minDays: input.minDays,
    maxDays: input.maxDays,
    availableFromDay: input.availableFromDay,
    status: "open",
    tenancyStartDay: 0,
    rentCollected: 0,
    createdDay: input.createdDay,
  };
  const events = [`把${spaceLabel(input.space)}挂出去转租，${yen(input.monthlyPrice)}¥/月。`];
  if (input.ownMonthlyRent !== undefined && input.monthlyPrice > input.ownMonthlyRent) {
    events.push("提醒：转租价比你自己的房租还高，房东更容易起疑——当二房东有风险。");
  }
  return ok({ book: { ...book, listings: [...book.listings, listing] }, listing }, events);
}

export function spaceLabel(space: SubletSpace): string {
  switch (space) {
    case "room": return "一间房";
    case "bed": return "一个床位";
    case "sofa": return "一张沙发";
    case "whole": return "整套房";
  }
}

/** A tenant (player or NPC) takes an open listing. Deposit moves from the
 *  tenant to the owner as a *held* amount — the caller (App.tsx) moves the
 *  money; this function only settles the state. */
export function acceptSublet(
  book: SubletBook,
  listingId: string,
  tenant: PlayerRef,
  day: GameDay,
): EconResult<{ book: SubletBook; listing: SubletListing; depositDue: Yen }> {
  const listing = book.listings.find((l) => l.id === listingId);
  if (!listing) return fail("这个转租贴找不到了，可能已经被撤下。");
  if (listing.status !== "open") return fail("这间已经有人住了。");
  if (listing.owner.playerId === tenant.playerId) return fail("不能租自己的房。");
  if (day < listing.availableFromDay) return fail("还没到可入住的日子。");
  const updated: SubletListing = { ...listing, status: "taken", tenant, tenancyStartDay: day };
  return ok(
    { book: { ...book, listings: book.listings.map((l) => (l.id === listingId ? updated : l)) }, listing: updated, depositDue: listing.deposit },
    [`${tenant.name} 住进了你转租的${spaceLabel(listing.space)}，押金 ${listing.deposit}¥ 已托管。`],
  );
}

/** End a tenancy early or at term. `damage` (0–100) is the tenant's own
 *  report / the owner's inspection — deducted from the deposit, the rest
 *  returns to the tenant. Open-ended: both sides can also just agree 0. */
export function endSublet(
  book: SubletBook,
  listingId: string,
  day: GameDay,
  opts: { damage?: number; reason?: string } = {},
): EconResult<{ book: SubletBook; depositReturned: Yen; depositKept: Yen }> {
  const listing = book.listings.find((l) => l.id === listingId);
  if (!listing) return fail("这个转租贴找不到了。");
  if (listing.status !== "taken" || !listing.tenant) return fail("这间现在没有租客。");
  const damage = clamp(opts.damage ?? 0, 0, 100);
  const depositKept = yen((listing.deposit * damage) / 100);
  const depositReturned = listing.deposit - depositKept;
  const stayed = Math.max(0, day - listing.tenancyStartDay);
  const updated: SubletListing = { ...listing, status: "closed", tenant: undefined, tenancyStartDay: 0 };
  const events = [
    `${listing.tenant.name} 搬走了，住了 ${stayed} 天${opts.reason ? `（${opts.reason}）` : ""}。`,
    depositKept > 0 ? `押金扣了 ${depositKept}¥（损坏 ${damage}%），退回 ${depositReturned}¥。` : `押金 ${depositReturned}¥ 全额退回。`,
  ];
  return ok(
    { book: { ...book, listings: book.listings.map((l) => (l.id === listingId ? updated : l)) }, depositReturned, depositKept },
    events,
  );
}

/** Daily tick for subletting: pay out rent every SUBLET.rentPayoutEveryDays
 *  and grow landlord suspicion. Called by App.tsx once per game day.
 *  Returns the rent due to the owner this tick (App.tsx adds it to money). */
export function subletDailyTick(
  book: SubletBook,
  day: GameDay,
  ownMonthlyRent: Yen | undefined,
): { book: SubletBook; rentDue: Yen; events: string[] } {
  let rentDue = 0;
  const events: string[] = [];
  let suspicion = book.landlordSuspicion;
  const listings = book.listings.map((l) => {
    if (l.status !== "taken" || !l.tenant) return l;
    const daysIn = day - l.tenancyStartDay;
    if (daysIn > 0 && daysIn % SUBLET.rentPayoutEveryDays === 0) {
      const payout = yen((l.monthlyPrice * SUBLET.rentPayoutEveryDays) / 30);
      rentDue += payout;
      events.push(`转租收租：${l.tenant.name} 交了 ${payout}¥（${spaceLabel(l.space)}，${l.monthlyPrice}¥/月）。`);
      return { ...l, rentCollected: l.rentCollected + payout };
    }
    return l;
  });
  const activeCount = listings.filter((l) => l.status === "taken").length;
  if (activeCount > 0 && !book.landlordFoundOut) {
    const markup = listings.some(
      (l) => l.status === "taken" && ownMonthlyRent !== undefined && l.monthlyPrice > ownMonthlyRent,
    );
    suspicion = clamp(
      suspicion + activeCount * (SUBLET.suspicionPerDay + (markup ? SUBLET.markupSuspicionPerDay : 0)),
      0,
      100,
    );
    if (suspicion >= SUBLET.highSuspicion && Math.random() < SUBLET.landlordVisitChanceAtHighSuspicion) {
      events.push("房东在楼下打听：听说你把房转租出去了？（房东起疑了，小心点。）");
    }
  }
  return { book: { ...book, listings, landlordSuspicion: suspicion }, rentDue, events };
}

// --- Landlord hook (area d) ------------------------------------------------

/** What area (d)'s landlord system needs from subletting, and what it gives
 *  back. App.tsx wires the real implementation; until then the local
 *  fallback below keeps the game playable offline. */
export interface LandlordPort {
  /** Called when suspicion crosses a threshold or the landlord visits. */
  onSuspicion: (suspicion: number, book: SubletBook) => void;
  /** Called when the landlord discovers the sublet; returns the consequence
   *  area (d) applied ("warning" | "fine" | "eviction" | "none"). */
  onDiscovered: (book: SubletBook) => "warning" | "fine" | "eviction" | "none";
}

/** Offline fallback: suspicion alone can trigger discovery, with a warning
 *  as the default consequence (never a surprise eviction offline). */
export function defaultLandlordCheck(book: SubletBook, day: GameDay): { book: SubletBook; events: string[] } {
  if (book.landlordFoundOut || book.landlordSuspicion < 100) return { book, events: [] };
  const events = [
    `第 ${day} 天：房东发现了转租，当面警告了一次——下次再被发现可能要罚款甚至被赶走。`,
    "（房东系统接入后，这里会按房东性格走警告 / 罚款 / 收房流程。）",
  ];
  return { book: { ...book, landlordFoundOut: true }, events };
}

// ---------------------------------------------------------------------------
// 2. OVERSEAS SHOPPING （海淘）
// ---------------------------------------------------------------------------

export type OverseasOrigin = "jp" | "kr" | "hk" | "us" | "eu" | "other";
export type OverseasCategory = "beauty" | "electronics" | "fashion" | "food" | "home" | "toy" | "other";

export interface OverseasItem {
  id: string;
  name: string;
  emoji: string;
  origin: OverseasOrigin;
  category: OverseasCategory;
  /** Shelf price in ¥ (what the player pays, before shipping + duty). */
  price: Yen;
  /** Typical shipping time in game days (range; the order rolls inside it). */
  shipDaysMin: number;
  shipDaysMax: number;
  /** Duty rate applied at customs (0 = duty-free under the personal allowance). */
  dutyRate: number;
  /** Can be resold after it arrives (most things can; some food / opened
   *  cosmetics cannot). */
  resellable: boolean;
  /** Rough resale value as a fraction of price (before condition). */
  resaleRate: number;
  blurb: string;
}

/** Starter catalog. Open-ended: the server / future drops can add any item;
 *  nothing in the code assumes this list is complete. */
export const OVERSEAS_CATALOG: OverseasItem[] = [
  { id: "ov-jp-skincare", name: "日本药妆套装", emoji: "🧴", origin: "jp", category: "beauty", price: 320, shipDaysMin: 4, shipDaysMax: 7, dutyRate: 0, resellable: true, resaleRate: 0.9, blurb: "代购圈常年断货款，自己用也好，转手也好。" },
  { id: "ov-kr-mask", name: "韩国面膜 10 片装", emoji: "🎭", origin: "kr", category: "beauty", price: 120, shipDaysMin: 3, shipDaysMax: 5, dutyRate: 0, resellable: true, resaleRate: 0.85, blurb: "便宜量大，囤着慢慢敷。" },
  { id: "ov-jp-camera", name: "日本二手胶片机", emoji: "📷", origin: "jp", category: "electronics", price: 1500, shipDaysMin: 5, shipDaysMax: 9, dutyRate: 0.13, resellable: true, resaleRate: 1.0, blurb: "中古店淘的成色不错，玩胶片的人都懂。" },
  { id: "ov-hk-sneakers", name: "香港限定球鞋", emoji: "👟", origin: "hk", category: "fashion", price: 980, shipDaysMin: 2, shipDaysMax: 4, dutyRate: 0.1, resellable: true, resaleRate: 1.15, blurb: "过关自己背回来都行，限定款转手常能加价。" },
  { id: "ov-us-headphones", name: "美国降噪耳机", emoji: "🎧", origin: "us", category: "electronics", price: 1890, shipDaysMin: 6, shipDaysMax: 10, dutyRate: 0.13, resellable: true, resaleRate: 0.9, blurb: "海淘比专柜便宜几百，坐地铁全靠它。" },
  { id: "ov-eu-chocolate", name: "比利时巧克力礼盒", emoji: "🍫", origin: "eu", category: "food", price: 210, shipDaysMin: 5, shipDaysMax: 8, dutyRate: 0, resellable: false, resaleRate: 0, blurb: "送礼体面，自己吃更体面。食品不能转手。" },
  { id: "ov-jp-figure", name: "日本限定手办", emoji: "🧸", origin: "jp", category: "toy", price: 650, shipDaysMin: 4, shipDaysMax: 8, dutyRate: 0, resellable: true, resaleRate: 1.1, blurb: "抽不到的限定款，海淘是最后的办法。" },
  { id: "ov-kr-lamp", name: "韩国设计师小夜灯", emoji: "💡", origin: "kr", category: "home", price: 180, shipDaysMin: 3, shipDaysMax: 6, dutyRate: 0, resellable: true, resaleRate: 0.8, blurb: "租房也要有点光。摆家里心情 +。" },
];

export type OverseasOrderStatus = "ordered" | "shipped" | "customs" | "arrived" | "held";

export interface OverseasOrder {
  id: string;
  buyer: PlayerRef;
  item: OverseasItem;
  qty: number;
  /** What was paid at order time: item price × qty + shipping. */
  paidTotal: Yen;
  /** Duty assessed at customs, ¥ (0 until customs). */
  dutyDue: Yen;
  /** Duty already paid (0 until the player pays it). */
  dutyPaid: Yen;
  shipDays: number;
  orderedDay: GameDay;
  /** Day the parcel arrives if customs clears (orderedDay + shipDays). */
  etaDay: GameDay;
  status: OverseasOrderStatus;
  /** True when customs randomly held the parcel for inspection (+2 days). */
  heldOnce: boolean;
}

export interface OverseasBook {
  orders: OverseasOrder[];
}

export function emptyOverseasBook(): OverseasBook {
  return { orders: [] };
}

export const OVERSEAS = {
  /** Chance a parcel is held at customs for inspection (+2 days). */
  customsHoldChance: 0.15,
  customsHoldExtraDays: 2,
  /** Personal duty-free allowance per order (¥ of goods value). */
  dutyFreeAllowance: 500,
  /** Max quantity per order — a soft anti-hoarding cap, not a script. */
  maxQtyPerOrder: 5,
} as const;

export function overseasDuty(item: OverseasItem, qty: number): Yen {
  const goodsValue = item.price * qty;
  const taxable = Math.max(0, goodsValue - OVERSEAS.dutyFreeAllowance);
  return yen(taxable * item.dutyRate);
}

export function overseasTotal(item: OverseasItem, qty: number): { goods: Yen; shipping: Yen; duty: Yen; total: Yen } {
  const goods = item.price * qty;
  const shipping = FEES.overseasShippingFlat;
  const duty = overseasDuty(item, qty);
  return { goods, shipping, duty, total: goods + shipping + duty };
}

/** Place an overseas order. The player pays goods + shipping now; duty is
 *  assessed at customs and paid on arrival (or the parcel sits in "held"
 *  until it is paid — the player's choice, never auto-deducted). */
export function placeOverseasOrder(
  book: OverseasBook,
  buyer: PlayerRef,
  itemId: string,
  qty: number,
  day: GameDay,
  catalog: OverseasItem[] = OVERSEAS_CATALOG,
): EconResult<{ book: OverseasBook; order: OverseasOrder; chargeNow: Yen }> {
  const item = catalog.find((i) => i.id === itemId);
  if (!item) return fail("这个海外商品下架了。");
  if (!Number.isInteger(qty) || qty < 1) return fail("数量至少 1 件。");
  if (qty > OVERSEAS.maxQtyPerOrder) return fail(`一次最多买 ${OVERSEAS.maxQtyPerOrder} 件，分开下单就行。`);
  const { shipping, duty } = overseasTotal(item, qty);
  const chargeNow = item.price * qty + shipping;
  const shipDays = item.shipDaysMin + Math.floor(Math.random() * (item.shipDaysMax - item.shipDaysMin + 1));
  const order: OverseasOrder = {
    id: mintEconId("ov"),
    buyer,
    item,
    qty,
    paidTotal: chargeNow,
    dutyDue: duty,
    dutyPaid: 0,
    shipDays,
    orderedDay: day,
    etaDay: day + shipDays,
    status: "ordered",
    heldOnce: false,
  };
  const events = [
    `海淘下单：${item.emoji} ${item.name} ×${qty}，已付 ${chargeNow}¥（含运费 ${shipping}¥），预计 ${shipDays} 天后到。`,
    duty > 0 ? `到海关时可能要补关税约 ${duty}¥（${Math.round(item.dutyRate * 100)}%），到时再决定付不付。` : "这单在免税额度内，不用补关税。",
  ];
  return ok({ book: { ...book, orders: [...book.orders, order] }, order, chargeNow }, events);
}

/** Daily tick for overseas orders: advance shipping, roll customs holds,
 *  mark arrivals. Duty is NOT auto-paid — a held parcel waits for the
 *  player to pay it via payOverseasDuty. */
export function overseasDailyTick(
  book: OverseasBook,
  day: GameDay,
): { book: OverseasBook; arrived: OverseasOrder[]; events: string[] } {
  const events: string[] = [];
  const arrived: OverseasOrder[] = [];
  const orders = book.orders.map((o) => {
    if (o.status === "arrived") return o;
    if (o.status === "held") return o; // waits for the player
    if (o.status === "ordered" && day > o.orderedDay) {
      if (day < o.etaDay) return { ...o, status: "shipped" as const };
    }
    if (day < o.etaDay) return o.status === "ordered" ? { ...o, status: "shipped" as const } : o;
    // ETA reached: customs.
    if (!o.heldOnce && o.dutyDue > 0 && Math.random() < OVERSEAS.customsHoldChance) {
      events.push(`海关抽查：${o.item.emoji} ${o.item.name} 被扣下检查，要多等 ${OVERSEAS.customsHoldExtraDays} 天。`);
      return { ...o, heldOnce: true, status: "held" as const, etaDay: o.etaDay + OVERSEAS.customsHoldExtraDays };
    }
    if (o.dutyDue > o.dutyPaid) {
      events.push(`包裹到海关了：${o.item.emoji} ${o.item.name}，补关税 ${o.dutyDue - o.dutyPaid}¥ 就能放行（也可以先放着）。`);
      return { ...o, status: "customs" as const };
    }
    events.push(`📦 海淘到了：${o.item.emoji} ${o.item.name} ×${o.qty}，已经放进你的物品里。`);
    const done: OverseasOrder = { ...o, status: "arrived" as const };
    arrived.push(done);
    return done;
  });
  return { book: { ...book, orders }, arrived, events };
}

/** Pay the customs duty on an order sitting in customs. Returns the amount
 *  the caller (App.tsx) should deduct; the order then arrives next tick. */
export function payOverseasDuty(
  book: OverseasBook,
  orderId: string,
): EconResult<{ book: OverseasBook; order: OverseasOrder; dutyPaid: Yen }> {
  const order = book.orders.find((o) => o.id === orderId);
  if (!order) return fail("这个订单找不到了。");
  if (order.status !== "customs" && order.status !== "held") return fail("这单现在不用补关税。");
  const due = order.dutyDue - order.dutyPaid;
  if (due <= 0) return fail("关税已经付过了。");
  const updated: OverseasOrder = { ...order, dutyPaid: order.dutyDue, status: "arrived" as const };
  return ok(
    { book: { ...book, orders: book.orders.map((o) => (o.id === orderId ? updated : o)) }, order: updated, dutyPaid: due },
    [`关税 ${due}¥ 已付，${order.item.emoji} ${order.item.name} 放行了，明天就能拿到。`],
  );
}

/** Resale value of an arrived overseas item (before haggling). */
export function overseasResaleValue(item: OverseasItem, qty: number): Yen {
  if (!item.resellable) return 0;
  return yen(item.price * item.resaleRate * qty);
}

// ---------------------------------------------------------------------------
// 3. BUY-CHEAP-SELL-CHEAP （贱买贱卖）
// ---------------------------------------------------------------------------

/** What the cheap-goods loop trades in. "broken" items are cheaper and need
 *  a repair first; "dirty" ones need a clean; "plain" ones flip as-is. */
export type CheapGoodKind = "phone" | "appliance" | "clothes" | "toy" | "book" | "bike" | "furniture-piece" | "other";
export type CheapGoodState = "broken" | "dirty" | "plain";

export interface CheapGood {
  id: string;
  name: string;
  emoji: string;
  kind: CheapGoodKind;
  state: CheapGoodState;
  /** Condition 0–100. Broken goods start low; repair/clean raises it. */
  condition: number;
  /** What the player paid for it, ¥. */
  buyPrice: Yen;
  /** What the seller originally asked (for the "捡漏" feeling). */
  askPrice: Yen;
  /** Day it was bought (for turnover stats). */
  boughtDay: GameDay;
  /** How much the player has spent fixing it up, ¥. */
  fixSpent: Yen;
  /** Free-text note from the seller / the player ("屏幕有划痕，电池还行"). */
  note: string;
}

export interface CheapFlipBook {
  /** Goods currently held, waiting to be fixed up / sold. */
  stock: CheapGood[];
  /** Lifetime stats — the loop's scoreboard, not a quest. */
  soldCount: number;
  totalSpent: Yen;
  totalEarned: Yen;
}

export function emptyCheapFlipBook(): CheapFlipBook {
  return { stock: [], soldCount: 0, totalSpent: 0, totalEarned: 0 };
}

export const CHEAP_FLIP = {
  /** The loop's identity: small margins, fast turnover. The game suggests
   *  (never enforces) a 10–30% markup — enough to profit, cheap enough
   *  to sell the same day. */
  suggestMarginMin: 0.1,
  suggestMarginMax: 0.3,
  /** Repair: cost scales with how broken it is; condition gain is capped so
   *  a wreck never becomes "9 成新". */
  repairCostPerPoint: 2,
  repairMaxCondition: 85,
  /** Clean: cheap, small gain. */
  cleanCost: 10,
  cleanConditionGain: 8,
  /** A good left unsold loses a little shine each day (dust, battery drain). */
  conditionDecayPerDay: 1,
  /** Buyers haggle: the actual sale price lands within this band of the ask. */
  haggleBand: 0.1,
} as const;

/** Suggested asking price for a good: cost + small margin, scaled by condition. */
export function suggestCheapPrice(good: CheapGood): Yen {
  const cost = good.buyPrice + good.fixSpent;
  const mid = (CHEAP_FLIP.suggestMarginMin + CHEAP_FLIP.suggestMarginMax) / 2;
  const conditionFactor = 0.6 + (good.condition / 100) * 0.6; // 0.6–1.2
  return yen(cost * (1 + mid) * conditionFactor);
}

/** Buy a cheap good (from the flea market, another player, or an NPC).
 *  The caller moves the money; this settles the state. */
export function buyCheapGood(
  book: CheapFlipBook,
  good: Omit<CheapGood, "id" | "boughtDay" | "fixSpent">,
  day: GameDay,
): EconResult<{ book: CheapFlipBook; good: CheapGood }> {
  if (good.buyPrice <= 0) return fail("这东西不要钱？那直接拿走好了，不用走买卖。");
  if (good.buyPrice > 5000) return fail("超过 5000¥ 就不算「贱买」了，那是正经买卖。");
  if (good.condition < 0 || good.condition > 100) return fail("成色得在 0–100 之间。");
  const full: CheapGood = { ...good, id: mintEconId("cheap"), boughtDay: day, fixSpent: 0 };
  return ok(
    { book: { ...book, stock: [...book.stock, full], totalSpent: book.totalSpent + good.buyPrice }, good: full },
    [`淘到了：${good.emoji} ${good.name}，${good.buyPrice}¥ 拿下（成色 ${good.condition}%）。修一修、擦一擦就能出。`],
  );
}

/** Repair a broken good. Cost = missing condition × rate, capped so the
 *  result never exceeds repairMaxCondition. */
export function repairCheapGood(
  book: CheapFlipBook,
  goodId: string,
): EconResult<{ book: CheapFlipBook; good: CheapGood; cost: Yen }> {
  const good = book.stock.find((g) => g.id === goodId);
  if (!good) return fail("这件货找不到了。");
  if (good.state !== "broken") return fail("这件不用修，擦擦就能卖。");
  if (good.condition >= CHEAP_FLIP.repairMaxCondition) return fail("已经修到头了，再修也是这个成色。");
  const target = CHEAP_FLIP.repairMaxCondition;
  const cost = yen((target - good.condition) * CHEAP_FLIP.repairCostPerPoint);
  const updated: CheapGood = { ...good, state: "plain", condition: target, fixSpent: good.fixSpent + cost };
  return ok(
    { book: { ...book, stock: book.stock.map((g) => (g.id === goodId ? updated : g)) }, good: updated, cost },
    [`修好了：${good.emoji} ${good.name}，花了 ${cost}¥，成色回到 ${target}%。`],
  );
}

/** Clean a dirty good. Cheap and quick. */
export function cleanCheapGood(
  book: CheapFlipBook,
  goodId: string,
): EconResult<{ book: CheapFlipBook; good: CheapGood; cost: Yen }> {
  const good = book.stock.find((g) => g.id === goodId);
  if (!good) return fail("这件货找不到了。");
  if (good.state !== "dirty") return fail("这件不脏，不用擦。");
  const updated: CheapGood = {
    ...good,
    state: "plain",
    condition: clamp(good.condition + CHEAP_FLIP.cleanConditionGain, 0, 100),
    fixSpent: good.fixSpent + CHEAP_FLIP.cleanCost,
  };
  return ok(
    { book: { ...book, stock: book.stock.map((g) => (g.id === goodId ? updated : g)) }, good: updated, cost: CHEAP_FLIP.cleanCost },
    [`擦干净了：${good.emoji} ${good.name}，花了 ${CHEAP_FLIP.cleanCost}¥，成色 ${updated.condition}%。`],
  );
}

/** Sell a held good at the player's asking price. The buyer haggles a
 *  little (±haggleBand) — the sale always clears fast, that is the point
 *  of the loop. Returns the actual cash received. */
export function sellCheapGood(
  book: CheapFlipBook,
  goodId: string,
  askPrice: Yen,
): EconResult<{ book: CheapFlipBook; received: Yen; profit: Yen }> {
  const good = book.stock.find((g) => g.id === goodId);
  if (!good) return fail("这件货找不到了。");
  if (askPrice <= 0) return fail("卖价得大于 0。");
  const haggle = 1 + (Math.random() * 2 - 1) * CHEAP_FLIP.haggleBand;
  const received = yen(askPrice * haggle);
  const cost = good.buyPrice + good.fixSpent;
  const profit = received - cost;
  const updated: CheapFlipBook = {
    stock: book.stock.filter((g) => g.id !== goodId),
    soldCount: book.soldCount + 1,
    totalSpent: book.totalSpent,
    totalEarned: book.totalEarned + received,
  };
  const events = [
    `出掉了：${good.emoji} ${good.name}，卖了 ${received}¥（要价 ${askPrice}¥，买家砍了砍价）。`,
    profit >= 0 ? `这单赚了 ${profit}¥。薄利多销，下一件。` : `这单亏了 ${-profit}¥，就当交学费——下次进价砍狠点。`,
  ];
  return ok({ book: updated, received, profit }, events);
}

/** Daily tick: unsold stock loses a little condition (dust happens). */
export function cheapFlipDailyTick(book: CheapFlipBook): CheapFlipBook {
  return {
    ...book,
    stock: book.stock.map((g) => ({ ...g, condition: Math.max(0, g.condition - CHEAP_FLIP.conditionDecayPerDay) })),
  };
}

/** A day's worth of fresh cheap stock for the flea market — the server can
 *  replace this with real listings; the shape is the contract. Prices are
 *  deliberately low and conditions are honest (broken means broken). */
export function dailyCheapStock(day: GameDay): Omit<CheapGood, "id" | "boughtDay" | "fixSpent">[] {
  const seed = day * 2654435761 % 1000;
  const pick = <T,>(arr: T[], n: number): T => arr[(seed + n * 97) % arr.length] as T;
  const pool: Omit<CheapGood, "id" | "boughtDay" | "fixSpent">[] = [
    { name: "旧手机（屏幕裂）", emoji: "📱", kind: "phone", state: "broken", condition: 45, buyPrice: 120, askPrice: 300, note: "屏幕裂了，其他都好使，能开机。" },
    { name: "旧电饭煲", emoji: "🍚", kind: "appliance", state: "dirty", condition: 60, buyPrice: 35, askPrice: 80, note: "内胆有点黄，煮饭没问题。" },
    { name: "牛仔外套", emoji: "🧥", kind: "clothes", state: "dirty", condition: 70, buyPrice: 25, askPrice: 60, note: "洗洗就跟新的一样。" },
    { name: "旧自行车", emoji: "🚲", kind: "bike", state: "broken", condition: 50, buyPrice: 80, askPrice: 200, note: "链条掉了，刹车还行。" },
    { name: "漫画合集", emoji: "📚", kind: "book", state: "plain", condition: 80, buyPrice: 40, askPrice: 70, note: "全套，书脊有点旧。" },
    { name: "小霸王游戏机", emoji: "🕹️", kind: "toy", state: "broken", condition: 40, buyPrice: 60, askPrice: 150, note: "插卡没反应，可能是接触不良。" },
    { name: "旧木椅", emoji: "🪑", kind: "furniture-piece", state: "dirty", condition: 65, buyPrice: 30, askPrice: 65, note: "实木的，擦擦能上油。" },
    { name: "旧风扇", emoji: "🌀", kind: "appliance", state: "plain", condition: 75, buyPrice: 45, askPrice: 90, note: "三档都转，就是有点响。" },
  ];
  const count = 4 + (seed % 3);
  const out: Omit<CheapGood, "id" | "boughtDay" | "fixSpent">[] = [];
  for (let i = 0; i < count; i++) out.push(pick(pool, i));
  return out;
}

// ---------------------------------------------------------------------------
// 4. SECOND-HAND FURNITURE （二手家具）
// ---------------------------------------------------------------------------

/** A used piece of furniture on sale at the flea market. `baseId` is the
 *  id in data.ts FURNITURE (the ZhuyaHome catalog) when it matches a known
 *  piece — that is how a bought piece slots into the home furniture system
 *  (GameState.furniture holds base ids; `usedId` tracks this exact piece).
 *  `baseId: null` = a one-off piece with no catalog entry (still placeable;
 *  App.tsx stores it under its own used id). */
export interface UsedFurniture {
  id: string;
  baseId: string | null;
  name: string;
  emoji: string;
  /** Room it belongs in (data.ts Furniture.room: living / kitchen / ...). */
  room: string;
  /** Condition 0–100. Drives price and comfort. */
  condition: number;
  /** Asking price, ¥ — always well below the new price for the same piece. */
  price: Yen;
  /** New price for comparison ("原价 ¥4800，现价 ¥900"). */
  newPrice: Yen;
  seller: PlayerRef | { playerId: "npc-flea"; name: string };
  /** Free-text seller note ("房东换房急出，搬走前自提"). */
  note: string;
  listedDay: GameDay;
}

export interface UsedFurnitureBook {
  /** Pieces the player owns (bought used, not yet resold). */
  owned: UsedFurniture[];
}

export function emptyUsedFurnitureBook(): UsedFurnitureBook {
  return { owned: [] };
}

export const USED_FURNITURE = {
  /** Comfort a used piece gives at home = catalog comfort × condition. */
  comfortAtCondition: (catalogComfort: number, condition: number): number =>
    Math.max(1, Math.round(catalogComfort * (condition / 100))),
  /** Resale price: what you paid × condition now / condition when bought,
   *  minus the flea cut (currently 0). Never negative. */
  resalePrice: (paid: Yen, conditionThen: number, conditionNow: number): Yen =>
    yen(paid * (conditionNow / Math.max(1, conditionThen)) * (1 - FEES.fleaResaleCutRate)),
  /** A piece left at home wears a little each week. */
  wearPerWeek: 1,
} as const;

/** The day's used-furniture stock at the flea market （桥东二手市集）.
 *  Prices are anchored to the real ZhuyaHome catalog prices in data.ts
 *  (sofa-fabric 4800, kitchen-cabinet 8900, …) — used means 15–35% of new.
 *  The server may replace this with player listings; the shape is the
 *  contract. `day` rotates the stock so the market feels alive. */
export function dailyUsedFurnitureStock(day: GameDay): UsedFurniture[] {
  const seed = day * 40503 % 997;
  const stall = (n: number): PlayerRef | { playerId: "npc-flea"; name: string } =>
    n % 3 === 0 ? { playerId: "npc-flea", name: "桥东摊主阿伯" } : { playerId: `npc-flea-${n}`, name: ["收旧货的陈姨", "搬家甩卖的小李", "老街杂货铺"][n % 3] as string };
  const pool: Omit<UsedFurniture, "id" | "listedDay" | "seller">[] = [
    { baseId: "sofa-fabric", name: "布艺三人沙发（二手）", emoji: "🛋️", room: "living", condition: 70, price: 900, newPrice: 4800, note: "房东换房急出，布面洗过，没塌。" },
    { baseId: "sofa-fabric", name: "布艺沙发（有点旧）", emoji: "🛋️", room: "living", condition: 45, price: 480, newPrice: 4800, note: "扶手磨白了，坐着还行，适合过渡。" },
    { baseId: "kitchen-cabinet", name: "旧橱柜一套", emoji: "🍳", room: "kitchen", condition: 60, price: 1500, newPrice: 8900, note: "拆下来就能装，台面有刀痕。" },
    { baseId: null, name: "实木旧书桌", emoji: "🪵", room: "living", condition: 75, price: 220, newPrice: 1200, note: "全实木，沉得很，抽屉顺滑。" },
    { baseId: null, name: "老式木衣柜", emoji: "🚪", room: "living", condition: 55, price: 300, newPrice: 1800, note: "有点味，通通风就好，板子结实。" },
    { baseId: null, name: "二手小冰箱", emoji: "🧊", room: "kitchen", condition: 65, price: 350, newPrice: 1600, note: "制冷正常，声音略大，学生党最爱。" },
    { baseId: null, name: "旧唱片机", emoji: "📻", room: "living", condition: 50, price: 180, newPrice: 900, note: "能转，喇叭有点沙，怀旧摆件也值。" },
    { baseId: null, name: "折叠小饭桌", emoji: "🍜", room: "living", condition: 80, price: 90, newPrice: 400, note: "出租屋神器，不用就折起来。" },
  ];
  const count = 4 + (seed % 3);
  return pool.slice(0, count).map((p, i) => ({
    ...p,
    id: mintEconId("usedfurn"),
    seller: stall(seed + i),
    listedDay: day,
  }));
}

/** Buy a used piece. Returns the piece + the furniture id App.tsx should
 *  add to GameState.furniture (the catalog baseId when there is one, else
 *  the piece's own id — App.tsx must accept both; see the snippet in
 *  ROUND2-LOG-e.md). The caller moves the money. */
export function buyUsedFurniture(
  book: UsedFurnitureBook,
  piece: UsedFurniture,
): EconResult<{ book: UsedFurnitureBook; piece: UsedFurniture; furnitureIdToAdd: string }> {
  if (piece.price <= 0) return fail("这件家具不要钱？那直接搬走好了。");
  if (book.owned.some((o) => o.id === piece.id)) return fail("这件你已经买过了。");
  const furnitureIdToAdd = piece.baseId ?? piece.id;
  return ok(
    { book: { ...book, owned: [...book.owned, piece] }, piece, furnitureIdToAdd },
    [
      `淘到了：${piece.emoji} ${piece.name}，${piece.price}¥（原价 ${piece.newPrice}¥，成色 ${piece.condition}%）。`,
      piece.baseId
        ? "已经放进你的家具里，回家就能摆上。"
        : "这是市集独一份的老物件，回家摆上就是你的了。",
    ],
  );
}

/** Resell a used piece you own. Price follows condition; the flea cut is
 *  currently 0 (see FEES). The caller removes the furniture id from
 *  GameState.furniture and adds the cash. */
export function resellUsedFurniture(
  book: UsedFurnitureBook,
  pieceId: string,
  paidPrice: Yen,
  conditionNow: number,
): EconResult<{ book: UsedFurnitureBook; received: Yen; furnitureIdToRemove: string }> {
  const piece = book.owned.find((o) => o.id === pieceId);
  if (!piece) return fail("这件家具找不到了。");
  const received = USED_FURNITURE.resalePrice(paidPrice, piece.condition, clamp(conditionNow, 0, 100));
  return ok(
    {
      book: { ...book, owned: book.owned.filter((o) => o.id !== pieceId) },
      received,
      furnitureIdToRemove: piece.baseId ?? piece.id,
    },
    [`卖掉了：${piece.emoji} ${piece.name}，收回 ${received}¥（买时 ${paidPrice}¥，成色 ${conditionNow}%）。`],
  );
}

// ---------------------------------------------------------------------------
// 5. PLAYER-ISSUED TRADE TASKS (open-ended: free text, free prices)
// ---------------------------------------------------------------------------

/** The task's direction. "other" is a real option — the player is not
 *  forced into buy/sell. Anything goes: 求带、求拼单、求换、求教…… */
export type TradeTaskKind = "buy" | "sell" | "swap" | "service" | "other";

/** Free-form tags the poster adds themselves ("冰箱" / "自行车" / "急").
 *  Tags are suggestions for search, never a fixed category list. */
export type TradeTaskStatus = "open" | "accepted" | "completed" | "cancelled" | "disputed";

/** One player-posted trade task. There is deliberately NO category field
 *  with a fixed enum: `title` + `body` + free tags are the whole listing.
 *  Compare the billboard (Social.tsx): hiring / rooms / sales / day-labor
 *  only. A trade task can be anything a player writes. */
export interface TradeTask {
  id: string;
  poster: PlayerRef;
  kind: TradeTaskKind;
  /** Free text, e.g. "求购一台能用的旧冰箱，预算300". */
  title: string;
  /** Free text, any detail: condition, pickup place, deadline, "可小刀"… */
  body: string;
  /** Asking / budget price in ¥. `null` = 面议 (price on chat). */
  price: Yen | null;
  /** "可小刀" — price is negotiable. Purely a signal; the haggle happens
   *  in chat, not in a form. */
  negotiable: boolean;
  /** Free-form tags, e.g. ["冰箱", "急", "南山自提"]. */
  tags: string[];
  city: "sz" | "hz" | "hk" | "any";
  status: TradeTaskStatus;
  /** Who took the task (null until accepted). */
  accepter?: PlayerRef;
  /** Escrow: amount the buyer has paid in, held until completion. */
  escrowHeld: Yen;
  /** Who paid the escrow in (buyer side). */
  escrowFrom?: PlayerRef;
  createdDay: GameDay;
  /** Expiry day (0 = never expires; the poster can cancel any time). */
  expiresDay: GameDay;
  /** Free-text completion note ("已当面验货，没问题"). */
  completionNote?: string;
  /** Round-3 (S): jury fields, filled by the server once a dispute is filed.
   * disputeDueAt is the 24 h jury deadline (ISO); disputeVerdict is only
   * set after the jury closes (seller = escrow released to the seller side,
   * buyer = refunded to the payer, expired = not enough votes, refunded). */
  disputeReason?: string;
  disputeVerdict?: "seller" | "buyer" | "expired";
  disputeDueAt?: string;
}

export interface TradeTaskBook {
  tasks: TradeTask[];
}

export function emptyTradeTaskBook(): TradeTaskBook {
  return { tasks: [] };
}

export const TRADE_TASK = {
  maxTitleLen: 60,
  maxBodyLen: 500,
  maxTags: 5,
  maxTagLen: 10,
  /** Open tasks a player may hold at once — anti-spam, not a gameplay cap. */
  maxOpenPerPlayer: 10,
  /** Default expiry in days (0 in the input = use this). */
  defaultExpiryDays: 7,
} as const;

export interface PostTradeTaskInput {
  poster: PlayerRef;
  kind: TradeTaskKind;
  title: string;
  body: string;
  /** null / undefined = 面议. */
  price?: Yen | null;
  negotiable?: boolean;
  tags?: string[];
  city?: "sz" | "hz" | "hk" | "any";
  /** Expiry in days from now; 0 = use the default. */
  expiresInDays?: number;
  createdDay: GameDay;
}

/** Post a trade task. The only hard rules are anti-spam / anti-nonsense:
 *  text must be non-empty, prices sane, tags short. There is no category
 *  check — any honest trade text is allowed. */
export function postTradeTask(
  book: TradeTaskBook,
  input: PostTradeTaskInput,
): EconResult<{ book: TradeTaskBook; task: TradeTask }> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) return fail("写一句你要买还是要卖什么，比如「求购一台能用的旧冰箱」。");
  if (title.length > TRADE_TASK.maxTitleLen) return fail(`标题 ${TRADE_TASK.maxTitleLen} 字以内，详情写正文里。`);
  if (body.length > TRADE_TASK.maxBodyLen) return fail(`详情 ${TRADE_TASK.maxBodyLen} 字以内就够了。`);
  if (input.price !== undefined && input.price !== null && (input.price <= 0 || input.price > 1000000)) {
    return fail("价格写个正常数，或者留空面议。");
  }
  const tags = (input.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, TRADE_TASK.maxTags);
  if (tags.some((t) => t.length > TRADE_TASK.maxTagLen)) return fail("标签 10 字以内。");
  const openCount = book.tasks.filter((t) => t.poster.playerId === input.poster.playerId && t.status === "open").length;
  if (openCount >= TRADE_TASK.maxOpenPerPlayer) {
    return fail(`你已经挂着 ${TRADE_TASK.maxOpenPerPlayer} 个未完成的交易，先完成或取消几个再发。`);
  }
  const expiresIn = input.expiresInDays === undefined || input.expiresInDays === 0 ? TRADE_TASK.defaultExpiryDays : input.expiresInDays;
  const task: TradeTask = {
    id: mintEconId("trade"),
    poster: input.poster,
    kind: input.kind,
    title,
    body,
    price: input.price ?? null,
    negotiable: input.negotiable ?? false,
    tags,
    city: input.city ?? "any",
    status: "open",
    escrowHeld: 0,
    createdDay: input.createdDay,
    expiresDay: input.createdDay + expiresIn,
  };
  return ok(
    { book: { ...book, tasks: [...book.tasks, task] }, task },
    [`交易贴发出去了：「${title}」${task.price ? `，${task.price}¥${task.negotiable ? "（可小刀）" : ""}` : "（面议）"}。`],
  );
}

/** Search / browse tasks. All filters are optional and free-form: a text
 *  query matches title, body, and tags (substring, case-insensitive); price
 *  is a range the browser sets freely. No fixed categories to pick from. */
export interface TradeTaskQuery {
  text?: string;
  kind?: TradeTaskKind;
  city?: "sz" | "hz" | "hk" | "any";
  minPrice?: Yen;
  maxPrice?: Yen;
  /** Only tasks that are still open. Default true. */
  openOnly?: boolean;
  /** Only tasks posted by a given player (for "我的交易"). */
  posterId?: string;
}

export function searchTradeTasks(book: TradeTaskBook, q: TradeTaskQuery): TradeTask[] {
  const needle = (q.text ?? "").trim().toLowerCase();
  const openOnly = q.openOnly !== false;
  return book.tasks
    .filter((t) => {
      if (openOnly && t.status !== "open") return false;
      if (q.kind && t.kind !== q.kind) return false;
      if (q.city && q.city !== "any" && t.city !== "any" && t.city !== q.city) return false;
      if (q.posterId && t.poster.playerId !== q.posterId) return false;
      if (q.minPrice !== undefined && (t.price === null || t.price < q.minPrice)) return false;
      if (q.maxPrice !== undefined && (t.price === null || t.price > q.maxPrice)) return false;
      if (needle) {
        const hay = `${t.title} ${t.body} ${t.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    })
    .sort((a, b) => b.createdDay - a.createdDay || (a.id < b.id ? -1 : 1));
}

/** Accept (take) an open task. No money moves yet — the two sides meet
 *  (chat / in person) and agree; escrow is a separate, optional step. */
export function acceptTradeTask(
  book: TradeTaskBook,
  taskId: string,
  accepter: PlayerRef,
): EconResult<{ book: TradeTaskBook; task: TradeTask }> {
  const task = book.tasks.find((t) => t.id === taskId);
  if (!task) return fail("这个交易贴找不到了，可能已经被撤下。");
  if (task.status !== "open") return fail("这个交易已经有人接了 / 已经结束。");
  if (task.poster.playerId === accepter.playerId) return fail("不能接自己的交易贴。");
  const updated: TradeTask = { ...task, status: "accepted", accepter };
  return ok(
    { book: { ...book, tasks: book.tasks.map((t) => (t.id === taskId ? updated : t)) }, task: updated },
    [`你接了「${task.title}」——跟 ${task.poster.name} 聊聊怎么交货，谈好再付钱。`],
  );
}

/** Pay into escrow for an accepted task. Uses the existing gift/payment
 *  path on the server (sendGift with kind "trade-escrow" — see the server
 *  spec in ROUND2-LOG-e.md); locally this only records the hold. The money
 *  movement itself is done by the caller (App.tsx / api.sendGift). */
export function escrowTradeTask(
  book: TradeTaskBook,
  taskId: string,
  payer: PlayerRef,
  amount: Yen,
): EconResult<{ book: TradeTaskBook; task: TradeTask; escrowDue: Yen }> {
  const task = book.tasks.find((t) => t.id === taskId);
  if (!task) return fail("这个交易贴找不到了。");
  if (task.status !== "accepted") return fail("先接下交易，再托管钱。");
  if (task.escrowHeld > 0) return fail("这单已经托管过了。");
  const due = task.price ?? amount;
  if (amount <= 0 || amount !== due) {
    return fail(task.price ? `这单托管金额就是 ${task.price}¥（贴主标的价）。` : "面议的单，先跟贴主谈好价再托管。");
  }
  const updated: TradeTask = { ...task, escrowHeld: due, escrowFrom: payer };
  return ok(
    { book: { ...book, tasks: book.tasks.map((t) => (t.id === taskId ? updated : t)) }, task: updated, escrowDue: due },
    [`已托管 ${due}¥：钱先由系统拿着，确认收货后才打给对方。`],
  );
}

/** Complete a task. The poster confirms receipt / handover; escrow (if any)
 *  is released to the seller side. Returns who should be paid what so the
 *  caller can move the money (via claimGift on the server). */
export function completeTradeTask(
  book: TradeTaskBook,
  taskId: string,
  confirmer: PlayerRef,
  note: string,
): EconResult<{ book: TradeTaskBook; task: TradeTask; releaseTo?: PlayerRef; releaseAmount: Yen }> {
  const task = book.tasks.find((t) => t.id === taskId);
  if (!task) return fail("这个交易贴找不到了。");
  if (task.status !== "accepted") return fail("这单还没人接 / 已经结束了。");
  if (confirmer.playerId !== task.poster.playerId && confirmer.playerId !== task.accepter?.playerId) {
    return fail("只有交易的双方能确认完成。");
  }
  // Escrow goes to the seller side: for a "sell" task the poster sells, so
  // the poster is paid; for a "buy" task the accepter supplies, so the
  // accepter is paid. Swap/service/other: the poster confirms and the
  // accepter is paid (they did the work / brought the goods).
  const releaseTo = task.kind === "sell" ? task.poster : task.accepter;
  const releaseAmount = task.escrowHeld;
  const updated: TradeTask = { ...task, status: "completed", completionNote: note.trim().slice(0, 200) };
  const events = [
    `交易完成：「${task.title}」${note.trim() ? `——${note.trim()}` : ""}`,
    releaseAmount > 0 && releaseTo ? `托管的 ${releaseAmount}¥ 已打给 ${releaseTo.name}。` : "这单没走托管，双方自己结清。",
  ].filter((e): e is string => typeof e === "string");
  return ok(
    { book: { ...book, tasks: book.tasks.map((t) => (t.id === taskId ? updated : t)) }, task: updated, releaseTo, releaseAmount },
    events,
  );
}

/** Cancel an open task (poster only) or an accepted one (either side, but
 *  escrow — if any — returns to whoever paid it). */
export function cancelTradeTask(
  book: TradeTaskBook,
  taskId: string,
  canceller: PlayerRef,
): EconResult<{ book: TradeTaskBook; task: TradeTask; refundTo?: PlayerRef; refundAmount: Yen }> {
  const task = book.tasks.find((t) => t.id === taskId);
  if (!task) return fail("这个交易贴找不到了。");
  if (task.status !== "open" && task.status !== "accepted") return fail("这单已经结束了，不能取消。");
  const isPoster = canceller.playerId === task.poster.playerId;
  const isAccepter = canceller.playerId === task.accepter?.playerId;
  if (!isPoster && !isAccepter) return fail("只有交易的双方能取消这单。");
  const refundTo = task.escrowHeld > 0 ? task.escrowFrom : undefined;
  const refundAmount = task.escrowHeld;
  const updated: TradeTask = { ...task, status: "cancelled", escrowHeld: 0 };
  return ok(
    {
      book: { ...book, tasks: book.tasks.map((t) => (t.id === taskId ? updated : t)) },
      task: updated,
      refundTo,
      refundAmount,
    },
    [
      `交易取消：「${task.title}」。`,
      refundAmount > 0 && refundTo ? `托管的 ${refundAmount}¥ 已退回给 ${refundTo.name}。` : "这单没托管，不用退钱。",
    ],
  );
}

// --- Dispute hook (area d) -------------------------------------------------

/** What area (d)'s dispute / jury system needs. Until it is wired, a
 *  dispute just freezes the task and the escrow with it. */
export interface DisputePort {
  /** Open a dispute case; returns the case id area (d) assigned. */
  openDispute: (task: TradeTask, reporter: PlayerRef, reason: string) => string;
}

/** Raise a dispute on an accepted / completed task. Escrow stays frozen
 *  until area (d) resolves it — this module never releases frozen money. */
export function disputeTradeTask(
  book: TradeTaskBook,
  taskId: string,
  reporter: PlayerRef,
  reason: string,
  port?: DisputePort,
): EconResult<{ book: TradeTaskBook; task: TradeTask; caseId?: string }> {
  const task = book.tasks.find((t) => t.id === taskId);
  if (!task) return fail("这个交易贴找不到了。");
  if (task.status !== "accepted" && task.status !== "completed") return fail("只有进行中 / 刚完成的交易能申诉。");
  if (reason.trim().length < 4) return fail("写一句申诉原因，比如「货不对版，冰箱不制冷」。");
  const updated: TradeTask = { ...task, status: "disputed" };
  const caseId = port?.openDispute(task, reporter, reason.trim());
  return ok(
    { book: { ...book, tasks: book.tasks.map((t) => (t.id === taskId ? updated : t)) }, task: updated, caseId },
    [
      `已申诉：「${task.title}」——${reason.trim()}`,
      task.escrowHeld > 0
        ? `托管的 ${task.escrowHeld}¥ 已冻结，等裁决结果再处理。`
        : "这单没走托管，申诉主要靠双方协商 + 社区裁决。",
      caseId ? `申诉编号 ${caseId}。` : "（社区裁决系统接入后，这里会生成申诉编号并通知陪审团。）",
    ],
  );
}

/** Expire stale open tasks (daily tick). Expired tasks become "cancelled"
 *  so the board never fills with dead posts. */
export function tradeTaskDailyTick(book: TradeTaskBook, day: GameDay): { book: TradeTaskBook; expired: TradeTask[] } {
  const expired = book.tasks.filter((t) => t.status === "open" && t.expiresDay > 0 && day > t.expiresDay);
  if (expired.length === 0) return { book, expired: [] };
  const ids = new Set(expired.map((t) => t.id));
  return {
    book: { ...book, tasks: book.tasks.map((t) => (ids.has(t.id) ? { ...t, status: "cancelled" as const } : t)) },
    expired,
  };
}

// ---------------------------------------------------------------------------
// Whole-economy state + daily tick (what App.tsx stores)
// ---------------------------------------------------------------------------

/** Everything area (e) owns for one player. App.tsx keeps one of these in
 *  the save (alongside GameState) and passes it back in each day. */
export interface EconomyState {
  sublets: SubletBook;
  overseas: OverseasBook;
  cheapFlip: CheapFlipBook;
  usedFurniture: UsedFurnitureBook;
  tradeTasks: TradeTaskBook;
}

export function emptyEconomyState(): EconomyState {
  return {
    sublets: emptySubletBook(),
    overseas: emptyOverseasBook(),
    cheapFlip: emptyCheapFlipBook(),
    usedFurniture: emptyUsedFurnitureBook(),
    tradeTasks: emptyTradeTaskBook(),
  };
}

/** One daily tick for the whole economy. App.tsx calls this once per game
 *  day and applies the results: add `subletRentDue` to money, show the
 *  events, and (for overseas arrivals) grant the items. */
export function economyDailyTick(
  state: EconomyState,
  day: GameDay,
  ownMonthlyRent: Yen | undefined,
): { state: EconomyState; subletRentDue: Yen; overseasArrived: OverseasOrder[]; events: string[] } {
  const sub = subletDailyTick(state.sublets, day, ownMonthlyRent);
  const landlord = defaultLandlordCheck(sub.book, day);
  const ov = overseasDailyTick(state.overseas, day);
  const flip = cheapFlipDailyTick(state.cheapFlip);
  const trade = tradeTaskDailyTick(state.tradeTasks, day);
  const events = [
    ...sub.events,
    ...landlord.events,
    ...ov.events,
    ...(trade.expired.length > 0 ? [`${trade.expired.length} 个过期的交易贴自动下架了。`] : []),
  ];
  return {
    state: {
      sublets: landlord.book,
      overseas: ov.book,
      cheapFlip: flip,
      usedFurniture: state.usedFurniture,
      tradeTasks: trade.book,
    },
    subletRentDue: sub.rentDue,
    overseasArrived: ov.arrived,
    events,
  };
}

// ---------------------------------------------------------------------------
// Seed examples (for the UI empty states / first-run demo, not quests)
// ---------------------------------------------------------------------------

/** Two example trade tasks shown when the board is empty, so a new player
 *  sees what "free text, free price" means. They are examples only — the
 *  player deletes / ignores them freely. */
export const TRADE_TASK_EXAMPLES: { title: string; body: string; price: Yen | null; kind: TradeTaskKind; tags: string[] }[] = [
  { title: "求购一台能用的旧冰箱，预算300", body: "出租屋用，能制冷就行，外观无所谓，南山自提，可小刀。", price: 300, kind: "buy", tags: ["冰箱", "南山"] },
  { title: "出闲置自行车，9成新，150可小刀", body: "买了没骑几次，刹车刚换过，带锁，华强北附近当面交易。", price: 150, kind: "sell", tags: ["自行车", "可小刀"] },
];
