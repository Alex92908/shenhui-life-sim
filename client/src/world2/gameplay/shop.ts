// Bay Area Life 2.0 — Stage 1 slice: the ground-floor shop.
//
// Money rule, re-implemented from 1.0's round2/shops.ts + server
// buyFromShop / collectShopTill — single-player slice version, NO server
// calls, local slice ledger only:
//   · a purchase pays from the player ledger INTO the shop till
//     (never straight into the owner's wallet — the 1.0 rule);
//   · the owner collects later via 收钱： till -> player ledger, till = 0.
// 1.0's collectShopTill zeroes the till and returns the amount; the
// client applies the money. The slice does the same, in one place.
//
// 20% partner split: the split math is implemented (splitTill) but the
// slice has NO partner in single-player, so partnerShare = 0 and the
// player collects the full till. When a partner exists (Stage 2+
// multiplayer), pass partner=<name> and the 20% is carved out for the
// partner to claim as a gift — the 1.0 rule (MEMORY 2026-11-12).

import { shopMenu } from "../../round2/shops";
import type { SliceLedger } from "./task";

/** 1.0's partner split: 20% of the collected till goes to the partner. */
export const PARTNER_SPLIT = 0.2;

export function splitTill(
  till: number,
  partner?: string,
): { playerShare: number; partnerShare: number } {
  if (!partner || till <= 0) return { playerShare: till, partnerShare: 0 };
  const partnerShare = Math.round(till * PARTNER_SPLIT);
  return { playerShare: till - partnerShare, partnerShare };
}

export interface ShopItem {
  id: string;
  name: string;
  price: number;
}

export interface ShopOpts {
  ledger: SliceLedger;
  /** Shop display name, e.g. "湾区小文的糖水铺". */
  name?: string;
  /** Menu kind from round2/shops.ts SHOP_MENUS. Slice shop is a 糖水铺. */
  kind?: string;
  /** No partner in the single-player slice — leave unset. */
  partner?: string;
}

export interface Shop {
  readonly name: string;
  readonly kind: string;
  readonly menu: ShopItem[];
  readonly till: number;
  readonly sales: number;
  readonly partner: string | undefined;
  buy(itemId: string): { ok: boolean; price?: number; error?: string };
  collect(): { ok: boolean; amount: number; playerShare: number; partnerShare: number };
  snapshot(): {
    name: string;
    kind: string;
    menu: ShopItem[];
    till: number;
    sales: number;
    partner: string | undefined;
  };
}

export function createShop(opts: ShopOpts): Shop {
  const kind = opts.kind ?? "tangshui";
  const menu: ShopItem[] = shopMenu(kind);
  let till = 0;
  let sales = 0;

  const shop: Shop = {
    name: opts.name ?? "湾区小文的糖水铺",
    kind,
    menu,
    get till() {
      return till;
    },
    get sales() {
      return sales;
    },
    partner: opts.partner,
    buy(itemId: string) {
      const item = menu.find((i) => i.id === itemId);
      if (!item) return { ok: false, error: "这家店没有这道菜" };
      // Buyer pays; the price goes into the till (buyFromShop rule).
      if (!opts.ledger.debit(item.price)) {
        return { ok: false, error: "钱不够" };
      }
      till += item.price;
      sales += 1;
      return { ok: true, price: item.price };
    },
    collect() {
      const amount = till;
      if (amount <= 0) return { ok: true, amount: 0, playerShare: 0, partnerShare: 0 };
      // 收钱： till -> player ledger, till = 0 (collectShopTill rule).
      // Optimistic-lock equivalent for a local ledger: read once, zero once.
      const { playerShare, partnerShare } = splitTill(amount, opts.partner);
      till = 0;
      opts.ledger.credit(playerShare);
      return { ok: true, amount, playerShare, partnerShare };
    },
    snapshot() {
      return {
        name: shop.name,
        kind,
        menu: [...menu],
        till,
        sales,
        partner: opts.partner,
      };
    },
  };
  return shop;
}
