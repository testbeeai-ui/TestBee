/** Onboarding reward: Prep + Mock hub → Mock Tests → CBSE MCQ's → try one chapter quiz. */
export const CBSE_MCQ_ONBOARDING_QUERY = "onboarding_cbse_mcq";

const SESSION_KEY = "edublast.onboarding_cbse_mcq_flow_v1";
/** Set when user taps Go on checklist; cleared after they tap View all on /mock. */
const VIEW_ALL_STEP_KEY = "edublast.onboarding_cbse_mcq_view_all_v1";
/** Set after View all; cleared when user opens the CBSE MCQ's tab on /mock-test. */
const MCQ_TAB_STEP_KEY = "edublast.onboarding_cbse_mcq_tab_v1";

function canUseSession(): boolean {
  return typeof window !== "undefined";
}

export function startCbseMcqOnboardingFlow(): void {
  if (!canUseSession()) return;
  window.sessionStorage.setItem(SESSION_KEY, "1");
  window.sessionStorage.setItem(VIEW_ALL_STEP_KEY, "1");
}

export function shouldShowCbseMcqViewAllGuide(): boolean {
  if (!canUseSession()) return false;
  return window.sessionStorage.getItem(VIEW_ALL_STEP_KEY) === "1";
}

/** View-all guide still pending — step 0 must not be ticked yet. */
export function hasCbseMcqViewAllStepPending(): boolean {
  return shouldShowCbseMcqViewAllGuide();
}

export function clearCbseMcqViewAllGuideStep(): void {
  if (!canUseSession()) return;
  window.sessionStorage.removeItem(VIEW_ALL_STEP_KEY);
}

/** After View all on /mock — show CBSE MCQ's tab hint on /mock-test (popup link only). */
export function advanceCbseMcqToTabStep(): void {
  if (!canUseSession()) return;
  window.sessionStorage.removeItem(VIEW_ALL_STEP_KEY);
  window.sessionStorage.setItem(MCQ_TAB_STEP_KEY, "1");
}

export function shouldShowCbseMcqTabGuide(): boolean {
  if (!canUseSession()) return false;
  return window.sessionStorage.getItem(MCQ_TAB_STEP_KEY) === "1";
}

export function clearCbseMcqTabGuideStep(): void {
  if (!canUseSession()) return;
  window.sessionStorage.removeItem(MCQ_TAB_STEP_KEY);
}

export function isCbseMcqOnboardingFlowActive(): boolean {
  if (!canUseSession()) return false;
  return window.sessionStorage.getItem(SESSION_KEY) === "1";
}

export function clearCbseMcqOnboardingFlow(): void {
  if (!canUseSession()) return;
  window.sessionStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(VIEW_ALL_STEP_KEY);
  window.sessionStorage.removeItem(MCQ_TAB_STEP_KEY);
}

export function hasCbseMcqOnboardingQuery(params: Pick<URLSearchParams, "get">): boolean {
  return params.get(CBSE_MCQ_ONBOARDING_QUERY) === "1";
}

export function appendCbseMcqOnboardingToUrl(path: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${CBSE_MCQ_ONBOARDING_QUERY}=1`;
}

export function cbseMcqOnboardingMockHubHref(): string {
  return `/mock?${CBSE_MCQ_ONBOARDING_QUERY}=1`;
}

/** Mock test library — onboarding hint targets CBSE MCQ's tab; pointer overlaps the tab pill. */
export function cbseMcqOnboardingLibraryHref(): string {
  return `/mock-test?${CBSE_MCQ_ONBOARDING_QUERY}=1`;
}
