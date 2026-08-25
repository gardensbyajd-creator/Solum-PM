import { describe, expect, it } from "vitest";
import { hasCheckoutReturn, isPublicLandingPath, resolveInitialWorkspaceView } from "./routing";

describe("SolumPM post-payment routing", () => {
  it("opens organisation onboarding for the payment return route", () => {
    expect(resolveInitialWorkspaceView("/onboarding")).toBe("onboarding");
    expect(resolveInitialWorkspaceView("/onboarding/")).toBe("onboarding");
  });

  it("detects a Stripe checkout return without treating it as entitlement proof", () => {
    expect(hasCheckoutReturn("?session_id=cs_test_123")).toBe(true);
    expect(hasCheckoutReturn("?source=website")).toBe(false);
  });

  it("keeps the public membership page separate from protected workspace routes", () => {
    expect(isPublicLandingPath("/")).toBe(true);
    expect(isPublicLandingPath("/onboarding")).toBe(false);
  });
});
