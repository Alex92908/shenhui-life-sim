// Bay Area Life 2.0 — Stage 1 slice: local slice ledger + delivery task.
//
// Pure logic, no THREE / no DOM — this file is the one the Node smoke
// test exercises. Money here is a LOCAL slice ledger (single player, no
// server calls in the slice). Server-authoritative settlement is a
// Stage 4 decision (audit §6 risk 2); the slice ledger is deliberately
// NOT wired to 1.0's settleMoney/creditMoney.
//
// Task rules are local and simple (delivery.ts's multi-stage customer
// order machine does not fit a one-runner slice task): accept -> pick up
// at the shop -> drop off at the office lobby -> settle. The 10-minute
// timer matches 1.0's 10-minute delivery timeout scale (delivery.ts
// ORDER_STAGE_MS comment).

export interface SliceLedger {
  money: number;
  credit(n: number): void;
  /** Returns false (and changes nothing) when the balance is insufficient. */
  debit(n: number): boolean;
}

export function createSliceLedger(startMoney: number): SliceLedger {
  let money = Math.max(0, Math.floor(startMoney));
  return {
    get money() {
      return money;
    },
    credit(n: number) {
      money += Math.max(0, Math.floor(n));
    },
    debit(n: number) {
      const amt = Math.max(0, Math.floor(n));
      if (money < amt) return false;
      money -= amt;
      return true;
    },
  };
}

export type DeliveryState =
  | "idle"
  | "accepted"
  | "pickedUp"
  | "delivered"
  | "settled"
  | "expired";

export const DELIVERY_STATE_ZH: Record<DeliveryState, string> = {
  idle: "待接单",
  accepted: "去店里取件",
  pickedUp: "送往办公楼大堂",
  delivered: "已送达，待结算",
  settled: "已完成",
  expired: "已超时",
};

/** Flat slice rate. 1.0 courier gigs pay by distance + surge
 *  (delivery.ts gigPayFor); the 500m slice has one fixed route, so the
 *  reward is fixed — re-derive from gigPayFor when the slice grows a
 *  second route. */
export const DELIVERY_REWARD = 36;
/** 10-minute timer (audit §5.5). */
export const DELIVERY_TIME_LIMIT_MS = 10 * 60 * 1000;

export interface DeliveryTaskOpts {
  pickupLabel: string;
  dropoffLabel: string;
  reward?: number;
  timeLimitMs?: number;
  ledger: SliceLedger;
  now?: () => number;
  onEvent?: (event: string, state: DeliveryState) => void;
}

export interface DeliveryTask {
  readonly state: DeliveryState;
  readonly reward: number;
  readonly pickupLabel: string;
  readonly dropoffLabel: string;
  accept(): { ok: boolean; error?: string };
  markPickedUp(): { ok: boolean; error?: string };
  markDelivered(): { ok: boolean; error?: string };
  settle(): { ok: boolean; error?: string };
  cancel(): void;
  /** Call every frame / tick: expires the task when the timer runs out. */
  tick(): void;
  timeLeftMs(): number;
  objective(): string;
  snapshot(): {
    state: DeliveryState;
    reward: number;
    timeLeftMs: number;
    pickupLabel: string;
    dropoffLabel: string;
  };
}

export function createDeliveryTask(opts: DeliveryTaskOpts): DeliveryTask {
  const now = opts.now ?? (() => Date.now());
  const reward = opts.reward ?? DELIVERY_REWARD;
  const timeLimitMs = opts.timeLimitMs ?? DELIVERY_TIME_LIMIT_MS;
  let state: DeliveryState = "idle";
  let deadlineMs = 0;
  const emit = (event: string) => opts.onEvent?.(event, state);

  const task: DeliveryTask = {
    get state() {
      return state;
    },
    reward,
    pickupLabel: opts.pickupLabel,
    dropoffLabel: opts.dropoffLabel,
    accept() {
      if (state !== "idle" && state !== "expired") {
        return { ok: false, error: "任务已经在进行中" };
      }
      state = "accepted";
      deadlineMs = now() + timeLimitMs;
      emit("accepted");
      return { ok: true };
    },
    markPickedUp() {
      if (state !== "accepted") {
        return { ok: false, error: "还没接单，先去接单" };
      }
      state = "pickedUp";
      emit("pickedUp");
      return { ok: true };
    },
    markDelivered() {
      if (state !== "pickedUp") {
        return { ok: false, error: "还没取件，先去店里取件" };
      }
      state = "delivered";
      emit("delivered");
      return { ok: true };
    },
    settle() {
      if (state !== "delivered") {
        return { ok: false, error: "还没送达，不能结算" };
      }
      opts.ledger.credit(reward);
      state = "settled";
      emit("settled");
      return { ok: true };
    },
    cancel() {
      if (state === "accepted" || state === "pickedUp") {
        state = "idle";
        deadlineMs = 0;
        emit("cancelled");
      }
    },
    tick() {
      if ((state === "accepted" || state === "pickedUp") && now() > deadlineMs) {
        state = "expired";
        emit("expired");
      }
    },
    timeLeftMs() {
      if (state !== "accepted" && state !== "pickedUp") return 0;
      return Math.max(0, deadlineMs - now());
    },
    objective() {
      switch (state) {
        case "idle":
          return `📦 配送任务：去「${opts.pickupLabel}」取件，送到「${opts.dropoffLabel}」，报酬 ¥${reward}（限时 10 分钟）`;
        case "accepted":
          return `📦 去「${opts.pickupLabel}」取件`;
        case "pickedUp":
          return `📦 送往「${opts.dropoffLabel}」`;
        case "delivered":
          return `📦 已送达！点「结算」领 ¥${reward}`;
        case "settled":
          return `✅ 配送完成，+¥${reward}`;
        case "expired":
          return `⌛ 配送超时了，重新接单吧`;
      }
    },
    snapshot() {
      return {
        state,
        reward,
        timeLeftMs: task.timeLeftMs(),
        pickupLabel: opts.pickupLabel,
        dropoffLabel: opts.dropoffLabel,
      };
    },
  };
  return task;
}
