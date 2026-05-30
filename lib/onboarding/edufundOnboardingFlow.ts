/** Onboarding reward: EduFund → tap Create Proposal. */
export const EDUFUND_ONBOARDING_QUERY = "onboarding_edufund";

const SESSION_KEY = "edublast.onboarding_edufund_flow_v1";
/** Set when user taps Go; cleared after Create Proposal is clicked. */
const CREATE_PROPOSAL_STEP_KEY = "edublast.onboarding_edufund_create_proposal_v1";

function canUseSession(): boolean {
  return typeof window !== "undefined";
}

export function startEdufundOnboardingFlow(): void {
  if (!canUseSession()) return;
  window.sessionStorage.setItem(SESSION_KEY, "1");
  window.sessionStorage.setItem(CREATE_PROPOSAL_STEP_KEY, "1");
}

export function isEdufundOnboardingFlowActive(): boolean {
  if (!canUseSession()) return false;
  return window.sessionStorage.getItem(SESSION_KEY) === "1";
}

export function shouldShowEdufundCreateProposalGuide(): boolean {
  if (!canUseSession()) return false;
  return window.sessionStorage.getItem(CREATE_PROPOSAL_STEP_KEY) === "1";
}

export function clearEdufundCreateProposalGuideStep(): void {
  if (!canUseSession()) return;
  window.sessionStorage.removeItem(CREATE_PROPOSAL_STEP_KEY);
}

export function clearEdufundOnboardingFlow(): void {
  if (!canUseSession()) return;
  window.sessionStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(CREATE_PROPOSAL_STEP_KEY);
}

export function edufundOnboardingHref(): string {
  return `/edufund?${EDUFUND_ONBOARDING_QUERY}=1`;
}
