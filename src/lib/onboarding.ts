export type OnboardingDraft = {
  organisationName: string;
  industry: string;
  teamSize: string;
  masterLicenceHolder: string;
  leadershipContact: string;
  financeSystem: string;
  projectSystem: string;
  controlledLibrary: string;
  firstProject: string;
};

export const onboardingSteps = [
  { id: "organisation", label: "Organisation", helper: "Business identity and accountable owner" },
  { id: "team", label: "Team & roles", helper: "Leadership and access administration" },
  { id: "systems", label: "Systems", helper: "Financial and delivery connections" },
  { id: "library", label: "Controlled library", helper: "Policies, procedures and forms" },
  { id: "launch", label: "Review & launch", helper: "Confirm the initial operating setup" },
] as const;

export type OnboardingStepId = (typeof onboardingSteps)[number]["id"];

export const emptyOnboardingDraft: OnboardingDraft = {
  organisationName: "",
  industry: "",
  teamSize: "",
  masterLicenceHolder: "",
  leadershipContact: "",
  financeSystem: "Not selected",
  projectSystem: "Not selected",
  controlledLibrary: "Use SolumPM starter library",
  firstProject: "",
};

export function isStepReady(step: OnboardingStepId, draft: OnboardingDraft): boolean {
  if (step === "organisation") return Boolean(draft.organisationName.trim() && draft.industry.trim());
  if (step === "team") return Boolean(draft.masterLicenceHolder.trim() && draft.leadershipContact.trim());
  if (step === "systems") return draft.financeSystem !== "Not selected" || draft.projectSystem !== "Not selected";
  if (step === "library") return Boolean(draft.controlledLibrary.trim());
  return onboardingSteps.slice(0, 4).every((item) => isStepReady(item.id, draft));
}

export function onboardingProgress(draft: OnboardingDraft) {
  const completed = onboardingSteps.slice(0, 4).filter((step) => isStepReady(step.id, draft)).length;
  return { completed, total: 4, percentage: Math.round((completed / 4) * 100) };
}
