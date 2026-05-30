/** Query + session flag: onboarding reward checklist → Random topic → subtopic → Lessons/Progress. */
export const LESSONS_ONBOARDING_QUERY = "onboarding_lessons";

const SESSION_KEY = "edublast.onboarding_lessons_flow_v1";
/** Set when user taps Go on checklist; cleared after they pick a subject on /explore-1 hub. */
const SUBJECT_PICK_STEP_KEY = "edublast.onboarding_lessons_subject_pick_v1";
/** Set when leaving explore for a topic during onboarding; required to auto-open Lessons / Progress. */
const PROGRESS_PANEL_STEP_KEY = "edublast.onboarding_lessons_progress_panel_v1";

/** Topic URL auto-opens Lessons / Progress only with `?onboarding_lessons=1` + progress-panel step (popup chain). */

function canUseSession(): boolean {
  return typeof window !== "undefined";
}

export function startLessonsOnboardingFlow(): void {
  if (!canUseSession()) return;
  window.sessionStorage.setItem(SESSION_KEY, "1");
  window.sessionStorage.setItem(SUBJECT_PICK_STEP_KEY, "1");
}

export function shouldShowLessonsSubjectPickGuide(): boolean {
  if (!canUseSession()) return false;
  return window.sessionStorage.getItem(SUBJECT_PICK_STEP_KEY) === "1";
}

export function clearLessonsSubjectPickGuideStep(): void {
  if (!canUseSession()) return;
  window.sessionStorage.removeItem(SUBJECT_PICK_STEP_KEY);
}

/** After explore hub → topic navigation during onboarding (popup link chain only). */
export function advanceLessonsToProgressPanelStep(): void {
  if (!canUseSession()) return;
  window.sessionStorage.setItem(PROGRESS_PANEL_STEP_KEY, "1");
}

export function shouldShowLessonsProgressPanelAutoOpen(): boolean {
  if (!canUseSession()) return false;
  return window.sessionStorage.getItem(PROGRESS_PANEL_STEP_KEY) === "1";
}

export function clearLessonsProgressPanelStep(): void {
  if (!canUseSession()) return;
  window.sessionStorage.removeItem(PROGRESS_PANEL_STEP_KEY);
}

export function isLessonsOnboardingFlowActive(): boolean {
  if (!canUseSession()) return false;
  return window.sessionStorage.getItem(SESSION_KEY) === "1";
}

export function clearLessonsOnboardingFlow(): void {
  if (!canUseSession()) return;
  window.sessionStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SUBJECT_PICK_STEP_KEY);
  window.sessionStorage.removeItem(PROGRESS_PANEL_STEP_KEY);
}

export function hasLessonsOnboardingQuery(params: Pick<URLSearchParams, "get">): boolean {
  return params.get(LESSONS_ONBOARDING_QUERY) === "1";
}

export function appendLessonsOnboardingToUrl(path: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${LESSONS_ONBOARDING_QUERY}=1`;
}

export function lessonsOnboardingExploreHref(): string {
  return `/explore-1?${LESSONS_ONBOARDING_QUERY}=1`;
}
