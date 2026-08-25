import { describe, expect, it } from "vitest";
import { calculateSeatEntitlement, canAllocateInternalSeat, STRIPE_PRICE_MAPPINGS } from "./stripeEntitlements";

describe("Stripe seat entitlements", () => {
  it("grants 25 internal seats for the active Enterprise subscription", () => {
    expect(calculateSeatEntitlement([{ priceId: STRIPE_PRICE_MAPPINGS.enterprise.priceId, quantity: 1, status: "active" }]))
      .toEqual({ baseSeatLimit: 25, additionalSeatBlocks: 0, internalSeatLimit: 25, subscriptionState: "active" });
  });

  it("adds exactly 25 seats for each active additional-seat block", () => {
    expect(calculateSeatEntitlement([
      { priceId: STRIPE_PRICE_MAPPINGS.enterprise.priceId, quantity: 1, status: "active" },
      { priceId: STRIPE_PRICE_MAPPINGS.additionalBlock.priceId, quantity: 1, status: "active" },
    ])).toMatchObject({ additionalSeatBlocks: 1, internalSeatLimit: 50 });
  });

  it("does not count cancelled seat blocks and blocks allocation at the configured capacity", () => {
    const entitlement = calculateSeatEntitlement([
      { priceId: STRIPE_PRICE_MAPPINGS.enterprise.priceId, quantity: 1, status: "active" },
      { priceId: STRIPE_PRICE_MAPPINGS.additionalBlock.priceId, quantity: 1, status: "canceled" },
    ]);

    expect(entitlement.internalSeatLimit).toBe(25);
    expect(canAllocateInternalSeat(entitlement, 24)).toBe(true);
    expect(canAllocateInternalSeat(entitlement, 25)).toBe(false);
  });
});
