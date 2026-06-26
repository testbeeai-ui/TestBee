import { isPathRelevantForOnboardingTask } from "@/lib/onboarding/onboardingTaskCompanionRoutes";
import {
  siteTourIndexForTaskId,
  SITE_TOUR_ONBOARDING_SLIDES,
  getSiteTourTaskDisplayData,
} from "@/lib/onboarding/siteTourOnboardingSlides";
import { SITE_TOUR_PREP_MOCK_SLIDE_ID } from "@/lib/onboarding/onboardingChecklistRdm";

function pathOnly(pathname: string): string {
  const q = pathname.indexOf("?");
  return q === -1 ? pathname : pathname.slice(0, q);
}

function isPrepMockCombinedPath(p: string): boolean {
  return (
    isPathRelevantForOnboardingTask("prep_classes", p) ||
    isPathRelevantForOnboardingTask("prep_mcq", p)
  );
}

/** Map the current app route to a site tour slide id. */
export function resolveSiteTourTaskIdForPathname(pathname: string): string | null {
  const p = pathOnly(pathname);
  if (p === "/magic-wall" || p.startsWith("/magic-wall/")) return "magic_wall";
  if (p === "/home" || p.startsWith("/home/")) return "dashboard";
  if (isPrepMockCombinedPath(pathname)) return SITE_TOUR_PREP_MOCK_SLIDE_ID;

  for (const slide of SITE_TOUR_ONBOARDING_SLIDES) {
    if (slide.id === "magic_wall" || slide.id === "dashboard") continue;
    if (slide.id === SITE_TOUR_PREP_MOCK_SLIDE_ID) continue;
    if (isPathRelevantForOnboardingTask(slide.id, pathname)) return slide.id;
  }
  return null;
}

export function resolveSiteTourIndexForPathname(
  pathname: string,
  doneIds?: Iterable<string>
): number | null {
  const taskId = resolveSiteTourTaskIdForPathname(pathname);
  if (!taskId) return null;
  const index = siteTourIndexForTaskId(taskId);
  if (index < 0) return null;

  const done = doneIds ? new Set(doneIds) : new Set<string>();
  if (done.has(taskId)) {
    const nextUndone = SITE_TOUR_ONBOARDING_SLIDES.findIndex((s) => !done.has(s.id));
    return nextUndone >= 0 ? nextUndone : index;
  }
  return index;
}

export function siteTourContextLabelForPathname(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const taskId = resolveSiteTourTaskIdForPathname(pathname);
  if (!taskId) return null;
  return getSiteTourTaskDisplayData(taskId)?.boardTitle ?? null;
}

export function isSiteTourOnCurrentPage(
  pathname: string | null | undefined,
  taskId: string
): boolean {
  if (!pathname) return false;
  return resolveSiteTourTaskIdForPathname(pathname) === taskId;
}
