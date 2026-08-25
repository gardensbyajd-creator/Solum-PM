import { describe, expect, it } from "vitest";
import { emptyOnboardingDraft, isStepReady, onboardingProgress } from "./onboarding";

describe("organisation onboarding model", () => {
  it("requires organisation identity before its first setup stage is ready", () => {
    expect(isStepReady("organisation", emptyOnboardingDraft)).toBe(false);
    expect(isStepReady("organisation", { ...emptyOnboardingDraft, organisationName: "Solum PM", industry: "Operations" })).toBe(true);
  });

  it("reports setup progress from the four required preparation stages", () => {
    const draft = {
      ...emptyOnboardingDraft,
      organisationName: "Solum PM",
      industry: "Operations",
      masterLicenceHolder: "Owner",
      leadershipContact: "leader@example.com",
      financeSystem: "Xero",
    };
    expect(onboardingProgress(draft)).toEqual({ completed: 4, total: 4, percentage: 100 });
  });

  it("does not allow launch review until every preparation stage is ready", () => {
    expect(isStepReady("launch", { ...emptyOnboardingDraft, organisationName: "Solum PM", industry: "Operations" })).toBe(false);
  });
});
