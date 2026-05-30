/** Prep + Mock · Classes onboarding — starts on /classrooms, then class detail → intro video → Live tab. */

export const PREP_CLASSES_ONBOARDING_QUERY = "onboarding_prep_classes";

const SESSION_KEY = "edublast.onboarding_prep_classes_flow_v1";
/** Violet hint on first enrolled class card on /classrooms. */
const PICK_CLASS_GUIDE_KEY = "edublast.onboarding_prep_classes_pick_class_v1";
/** Violet hint on intro video on class Home. */
const WATCH_VIDEO_GUIDE_KEY = "edublast.onboarding_prep_classes_watch_video_v1";

function canUseSession(): boolean {
  return typeof window !== "undefined";
}

export function startPrepClassesOnboardingFlow(): void {
  if (!canUseSession()) return;
  window.sessionStorage.setItem(SESSION_KEY, "1");
  window.sessionStorage.setItem(PICK_CLASS_GUIDE_KEY, "1");
  window.sessionStorage.removeItem(WATCH_VIDEO_GUIDE_KEY);
}

export function shouldShowPrepClassesPickClassGuide(): boolean {
  if (!canUseSession()) return false;
  return window.sessionStorage.getItem(PICK_CLASS_GUIDE_KEY) === "1";
}

export function clearPrepClassesPickClassGuide(): void {
  if (!canUseSession()) return;
  window.sessionStorage.removeItem(PICK_CLASS_GUIDE_KEY);
}

export function shouldShowPrepClassesWatchVideoGuide(): boolean {
  if (!canUseSession()) return false;
  return window.sessionStorage.getItem(WATCH_VIDEO_GUIDE_KEY) === "1";
}

export function armPrepClassesWatchVideoGuide(): void {
  if (!canUseSession()) return;
  window.sessionStorage.setItem(WATCH_VIDEO_GUIDE_KEY, "1");
}

export function clearPrepClassesWatchVideoGuide(): void {
  if (!canUseSession()) return;
  window.sessionStorage.removeItem(WATCH_VIDEO_GUIDE_KEY);
}

export function isPrepClassesOnboardingFlowActive(): boolean {
  if (!canUseSession()) return false;
  return window.sessionStorage.getItem(SESSION_KEY) === "1";
}

export function clearPrepClassesOnboardingFlow(): void {
  if (!canUseSession()) return;
  window.sessionStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(PICK_CLASS_GUIDE_KEY);
  window.sessionStorage.removeItem(WATCH_VIDEO_GUIDE_KEY);
}

/** @deprecated Mock hub path; prefer `prepClassesOnboardingClassroomsHref`. */
export function hasPrepClassesOnboardingQuery(params: Pick<URLSearchParams, "get">): boolean {
  return params.get(PREP_CLASSES_ONBOARDING_QUERY) === "1";
}

export function appendPrepClassesOnboardingToUrl(path: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${PREP_CLASSES_ONBOARDING_QUERY}=1`;
}

/** Checklist "Open task" — land on Classrooms first. */
export function prepClassesOnboardingClassroomsHref(): string {
  return `/classrooms?${PREP_CLASSES_ONBOARDING_QUERY}=1`;
}

/** @deprecated Use `prepClassesOnboardingClassroomsHref` for new flows. */
export function prepClassesOnboardingMockHubHref(): string {
  return prepClassesOnboardingClassroomsHref();
}

/** @deprecated Renamed to pick-class guide. */
export function shouldShowPrepClassesViewAllGuide(): boolean {
  return shouldShowPrepClassesPickClassGuide();
}

/** @deprecated */
export function clearPrepClassesViewAllGuideStep(): void {
  clearPrepClassesPickClassGuide();
}
