export const STRIPE_PRICE_MAPPINGS = {
  enterprise: {
    priceId: "price_1U8GLo3a72jjBENAGvEHaHnO",
    seatUnits: 25,
  },
  additionalBlock: {
    priceId: "price_1U8GMR3a72jjBENA78NPrMe9",
    seatUnits: 25,
  },
} as const;

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "incomplete";

export type SubscriptionLineItem = {
  priceId: string;
  quantity: number;
  status: SubscriptionStatus;
};

export type SeatEntitlement = {
  baseSeatLimit: number;
  additionalSeatBlocks: number;
  internalSeatLimit: number;
  subscriptionState: "active" | "payment_attention" | "inactive";
};

const accessStatuses = new Set<SubscriptionStatus>(["active", "trialing", "past_due"]);

export function calculateSeatEntitlement(items: SubscriptionLineItem[]): SeatEntitlement {
  const paidItems = items.filter((item) => accessStatuses.has(item.status));
  const baseSeatLimit = paidItems
    .filter((item) => item.priceId === STRIPE_PRICE_MAPPINGS.enterprise.priceId)
    .reduce((total, item) => total + STRIPE_PRICE_MAPPINGS.enterprise.seatUnits * Math.max(1, item.quantity), 0);
  const additionalSeatBlocks = paidItems
    .filter((item) => item.priceId === STRIPE_PRICE_MAPPINGS.additionalBlock.priceId)
    .reduce((total, item) => total + Math.max(1, item.quantity), 0);
  const subscriptionState = baseSeatLimit === 0
    ? "inactive"
    : paidItems.some((item) => item.status === "past_due")
      ? "payment_attention"
      : "active";

  return {
    baseSeatLimit,
    additionalSeatBlocks,
    internalSeatLimit: baseSeatLimit + additionalSeatBlocks * STRIPE_PRICE_MAPPINGS.additionalBlock.seatUnits,
    subscriptionState,
  };
}

export function canAllocateInternalSeat(entitlement: SeatEntitlement, occupiedSeats: number) {
  return entitlement.subscriptionState !== "inactive" && occupiedSeats < entitlement.internalSeatLimit;
}
