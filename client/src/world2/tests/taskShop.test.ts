// Bay Area Life 2.0 — Stage 1 delivery-task + shop tests.
//
// Tests the REAL gameplay modules (no mirror):
//   client/src/world2/gameplay/task.ts — delivery state machine +
//     SliceLedger (local slice ledger; server-authoritative settlement is
//     a Stage 4 decision, audit §6 risk 2)
//   client/src/world2/gameplay/shop.ts — shop buy → till → collect,
//     20% partner split (splitTill, Math.round)
//
// The rules these modules implement come from 1.0:
//   task: accept → pick up at the shop → drop off at the office lobby →
//     settle; 10-minute timer (delivery.ts 10-minute timeout scale);
//     reward DELIVERY_REWARD (flat slice rate, see task.ts header).
//   shop: a purchase pays from the player ledger INTO the till (never
//     straight into the owner's wallet — round2/shops.ts buyFromShop);
//     collect zeroes the till and returns the amount (server
//     collectShopTill optimistic lock, local equivalent: read once,
//     zero once); 20% of a collected till goes to the partner, who claims
//     it as a gift (MEMORY 2026-11-12).
//
// Pure Node, no three.js, no DOM. Run with:
//   node client/src/world2/tests/run-tests.mjs

import assert from "node:assert/strict";
import { createShop, PARTNER_SPLIT, splitTill } from "../gameplay/shop";
import {
  DELIVERY_REWARD,
  DELIVERY_TIME_LIMIT_MS,
  createDeliveryTask,
  createSliceLedger,
} from "../gameplay/task";
import type { SliceLedger } from "../gameplay/task";

/* ------------------------------------------------------------------ */
/* tiny harness (node:assert only, no framework)                      */
/* ------------------------------------------------------------------ */

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`ok ${passed + failed} - ${name}`);
  } catch (e) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`${name}: ${msg}`);
    console.log(`not ok ${passed + failed} - ${name}\n  ${msg}`);
  }
}

/** Wrap a SliceLedger and count credit() calls (proves exactly-once). */
function countingLedger(startMoney: number): { ledger: SliceLedger; creditCalls: number[] } {
  const inner = createSliceLedger(startMoney);
  const calls: number[] = [];
  const ledger: SliceLedger = {
    get money() {
      return inner.money;
    },
    credit(n: number): void {
      calls.push(n);
      inner.credit(n);
    },
    debit(n: number): boolean {
      return inner.debit(n);
    },
  };
  return { ledger, creditCalls: calls };
}

const PICKUP = "8号楼糖水铺";
const DROPOFF = "尚美科技大厦大堂";

/* ------------------------------------------------------------------ */
/* delivery task                                                       */
/* ------------------------------------------------------------------ */

test("delivery happy path: idle → accepted → pickedUp → delivered → settled, reward lands exactly once", () => {
  const { ledger, creditCalls } = countingLedger(100);
  const task = createDeliveryTask({ pickupLabel: PICKUP, dropoffLabel: DROPOFF, ledger });
  assert.equal(task.state, "idle");
  assert.equal(task.reward, DELIVERY_REWARD);

  assert.deepEqual(task.accept(), { ok: true });
  assert.equal(task.state, "accepted");
  assert.deepEqual(task.markPickedUp(), { ok: true });
  assert.equal(task.state, "pickedUp");
  assert.deepEqual(task.markDelivered(), { ok: true });
  assert.equal(task.state, "delivered");

  assert.deepEqual(task.settle(), { ok: true });
  assert.equal(task.state, "settled");
  assert.equal(ledger.money, 100 + DELIVERY_REWARD);
  assert.deepEqual(creditCalls, [DELIVERY_REWARD], "reward must land in the ledger exactly once");
  console.log(`  reward ¥${DELIVERY_REWARD} credited once; balance 100 → ${ledger.money}`);
});

test("delivery: second settle is rejected and credits nothing", () => {
  const { ledger, creditCalls } = countingLedger(100);
  const task = createDeliveryTask({ pickupLabel: PICKUP, dropoffLabel: DROPOFF, ledger });
  task.accept();
  task.markPickedUp();
  task.markDelivered();
  assert.equal(task.settle().ok, true);
  const second = task.settle();
  assert.equal(second.ok, false, "double settle must be rejected");
  assert.equal(creditCalls.length, 1, "double settle must not credit again");
  assert.equal(ledger.money, 100 + DELIVERY_REWARD);
});

test("delivery: illegal transitions are rejected and change nothing", () => {
  const { ledger } = countingLedger(100);
  const task = createDeliveryTask({ pickupLabel: PICKUP, dropoffLabel: DROPOFF, ledger });
  assert.equal(task.markPickedUp().ok, false, "pickup before accept");
  assert.equal(task.markDelivered().ok, false, "deliver before pickup");
  assert.equal(task.settle().ok, false, "settle before deliver");
  assert.equal(task.state, "idle");
  assert.equal(ledger.money, 100);

  assert.equal(task.accept().ok, true);
  assert.equal(task.accept().ok, false, "accept twice");
  assert.equal(task.markDelivered().ok, false, "deliver before pickup (accepted)");
  assert.equal(task.settle().ok, false, "settle while accepted");
  assert.equal(task.state, "accepted");
  assert.equal(ledger.money, 100);
});

test("delivery: expiry via tick() — settle after expiry is rejected, re-accept works", () => {
  let nowMs = 1_000_000;
  const { ledger, creditCalls } = countingLedger(100);
  const task = createDeliveryTask({
    pickupLabel: PICKUP,
    dropoffLabel: DROPOFF,
    ledger,
    now: () => nowMs,
  });
  task.accept();
  assert.ok(task.timeLeftMs() > 0, "time left should be positive right after accept");
  assert.equal(task.timeLeftMs(), DELIVERY_TIME_LIMIT_MS);
  nowMs += DELIVERY_TIME_LIMIT_MS + 1; // past the 10-minute deadline
  task.tick();
  assert.equal(task.state, "expired");
  assert.equal(task.timeLeftMs(), 0);
  assert.equal(task.settle().ok, false, "settle after expiry");
  assert.equal(creditCalls.length, 0);
  // Re-accept after expiry is allowed (task.ts: accept from idle OR expired).
  assert.equal(task.accept().ok, true);
  assert.equal(task.state, "accepted");
  assert.equal(ledger.money, 100);
});

test("delivery: cancel returns to idle and settle is rejected", () => {
  const { ledger } = countingLedger(100);
  const task = createDeliveryTask({ pickupLabel: PICKUP, dropoffLabel: DROPOFF, ledger });
  task.accept();
  task.cancel();
  assert.equal(task.state, "idle");
  assert.equal(task.settle().ok, false);
  assert.equal(task.markPickedUp().ok, false);
  assert.equal(ledger.money, 100);
});

test("delivery: snapshot + objective track the state machine", () => {
  const { ledger } = countingLedger(0);
  const task = createDeliveryTask({ pickupLabel: PICKUP, dropoffLabel: DROPOFF, ledger });
  assert.equal(task.snapshot().state, "idle");
  assert.ok(task.objective().includes(PICKUP), "idle objective names the pickup");
  task.accept();
  assert.equal(task.snapshot().state, "accepted");
  assert.ok(task.objective().includes(PICKUP), "accepted objective names the pickup");
  task.markPickedUp();
  assert.ok(task.objective().includes(DROPOFF), "pickedUp objective names the dropoff");
  task.markDelivered();
  assert.ok(task.objective().includes(String(DELIVERY_REWARD)), "delivered objective names the reward");
});

/* ------------------------------------------------------------------ */
/* shop                                                                */
/* ------------------------------------------------------------------ */

test("shop: buy moves money into the till by the same amount", () => {
  const { ledger } = countingLedger(500);
  const shop = createShop({ ledger });
  assert.ok(shop.menu.length > 0, "menu is empty");
  const item = shop.menu[0] as { id: string; name: string; price: number };
  assert.ok(item.price > 0, "menu item must have a positive price");
  const before = ledger.money;
  const res = shop.buy(item.id);
  assert.equal(res.ok, true);
  assert.equal(res.price, item.price);
  assert.equal(ledger.money, before - item.price, "player money down by the price");
  assert.equal(shop.till, item.price, "till up by the same amount");
  assert.equal(shop.sales, 1);
  console.log(`  bought ${item.name} ¥${item.price}: money ${before} → ${ledger.money}, till → ${shop.till}`);
});

test("shop: collect zeroes the till and pays the player the full till (single-player, partner share 0)", () => {
  const { ledger } = countingLedger(500);
  const shop = createShop({ ledger });
  // Buy the whole menu: 12 + 15 + 18 = 45 into the till.
  let expectedTill = 0;
  for (const item of shop.menu) {
    assert.equal(shop.buy(item.id).ok, true);
    expectedTill += item.price;
  }
  assert.equal(shop.till, expectedTill);
  assert.equal(ledger.money, 500 - expectedTill);
  const res = shop.collect();
  assert.deepEqual(
    { ok: res.ok, amount: res.amount, playerShare: res.playerShare, partnerShare: res.partnerShare },
    { ok: true, amount: expectedTill, playerShare: expectedTill, partnerShare: 0 },
    "single-player collect must pay the full till to the player",
  );
  assert.equal(shop.till, 0, "till must be 0 after collect");
  assert.equal(ledger.money, 500, "player ends with the original balance (buy + collect round-trip)");
});

test("shop: double-collect is a no-op", () => {
  const { ledger } = countingLedger(500);
  const shop = createShop({ ledger });
  const item = shop.menu[0] as { id: string; price: number };
  shop.buy(item.id);
  const first = shop.collect();
  assert.equal(first.amount, item.price);
  const moneyAfterFirst = ledger.money;
  const second = shop.collect();
  assert.deepEqual(
    { ok: second.ok, amount: second.amount, playerShare: second.playerShare, partnerShare: second.partnerShare },
    { ok: true, amount: 0, playerShare: 0, partnerShare: 0 },
    "second collect must return amount 0",
  );
  assert.equal(shop.till, 0);
  assert.equal(ledger.money, moneyAfterFirst, "second collect must not move money");
});

test("shop: buying with insufficient funds is rejected and changes nothing", () => {
  const { ledger } = countingLedger(5); // cheapest item is ¥12
  const shop = createShop({ ledger });
  const item = shop.menu[0] as { id: string; price: number };
  assert.ok(item.price > ledger.money, "test setup: item must cost more than the balance");
  const res = shop.buy(item.id);
  assert.equal(res.ok, false, "insufficient-funds buy must be rejected");
  assert.equal(ledger.money, 5, "money unchanged");
  assert.equal(shop.till, 0, "till unchanged");
  assert.equal(shop.sales, 0, "sales unchanged");
});

test("shop: buying with exactly enough money succeeds (boundary)", () => {
  const { ledger } = countingLedger(12);
  const shop = createShop({ ledger });
  const item = shop.menu[0] as { id: string; price: number };
  assert.equal(item.price, 12, "test setup: first menu item is ¥12");
  assert.equal(shop.buy(item.id).ok, true);
  assert.equal(ledger.money, 0);
  assert.equal(shop.till, 12);
});

test("shop: buying an unknown item is rejected and changes nothing", () => {
  const { ledger } = countingLedger(500);
  const shop = createShop({ ledger });
  const res = shop.buy("no-such-item");
  assert.equal(res.ok, false);
  assert.equal(ledger.money, 500);
  assert.equal(shop.till, 0);
  assert.equal(shop.sales, 0);
});

test("shop: menu sanity — non-empty, positive prices, unique ids", () => {
  const { ledger } = countingLedger(0);
  const shop = createShop({ ledger });
  assert.ok(shop.menu.length > 0, "menu is empty");
  const ids = new Set<string>();
  for (const item of shop.menu) {
    assert.ok(item.id.length > 0, "menu item without id");
    assert.ok(!ids.has(item.id), `duplicate menu id ${item.id}`);
    ids.add(item.id);
    assert.ok(item.price > 0, `menu item ${item.id} has non-positive price ${item.price}`);
  }
  console.log(`  menu (${shop.kind}): ${shop.menu.map((i) => `${i.name} ¥${i.price}`).join(", ")}`);
});

test("shop: partner split is 20% (Math.round) and player + partner == till", () => {
  assert.equal(PARTNER_SPLIT, 0.2, "partner split must be 20%");
  assert.deepEqual(splitTill(100, "阿强"), { playerShare: 80, partnerShare: 20 });
  assert.deepEqual(splitTill(100), { playerShare: 100, partnerShare: 0 });
  assert.deepEqual(splitTill(0, "阿强"), { playerShare: 0, partnerShare: 0 });
  // Rounding: 45 * 0.2 = 9 exactly; 47 * 0.2 = 9.4 → 9 (Math.round).
  assert.deepEqual(splitTill(47, "阿强"), { playerShare: 38, partnerShare: 9 });
  const { ledger } = countingLedger(500);
  const shop = createShop({ ledger, partner: "阿强" });
  for (const item of shop.menu) shop.buy(item.id); // till 45
  assert.equal(shop.till, 45);
  const res = shop.collect();
  assert.equal(res.amount, 45);
  assert.equal(res.partnerShare, 9, "partner gets 20% of the till");
  assert.equal(res.playerShare, 36, "player gets the remaining 80%");
  assert.equal(res.playerShare + res.partnerShare, res.amount, "split must sum to the till");
  assert.equal(shop.till, 0);
  assert.equal(ledger.money, 500 - 45 + 36, "player balance reflects the 80% share only");
  console.log(`  partner collect: till ¥45 → player ¥36 + partner ¥9 (partner claims as a gift, per 1.0 rule)`);
});

/* ------------------------------------------------------------------ */

console.log(`\ntaskShop: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("FAILURES:");
  for (const f of failures) console.log(` - ${f}`);
  process.exitCode = 1;
}
