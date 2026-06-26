import {
  SITE_TOUR_INFO_SLIDE_IDS,
  SITE_TOUR_PREP_MOCK_SLIDE_ID,
} from "@/lib/onboarding/onboardingChecklistRdm";
import { isKnownOnboardingRewardTaskId } from "@/lib/onboarding/onboardingRewardTasksData";
import { isOnboardingTaskComplete } from "@/lib/subscription/freeTrialClient";

export function isSiteTourSlideVerifiable(slideId: string): boolean {
  if (SITE_TOUR_INFO_SLIDE_IDS.has(slideId)) return false;
  if (slideId === SITE_TOUR_PREP_MOCK_SLIDE_ID) return true;
  return isKnownOnboardingRewardTaskId(slideId);
}

/** Whether the user may tap OK, got it! (server-backed tasks must be complete on the server). */
export function isSiteTourSlideCompleteOnServer(
  slideId: string,
  progress: Record<string, boolean>
): boolean {
  if (SITE_TOUR_INFO_SLIDE_IDS.has(slideId)) return true;
  if (slideId === SITE_TOUR_PREP_MOCK_SLIDE_ID) {
    return (
      isOnboardingTaskComplete("prep_classes", progress) &&
      isOnboardingTaskComplete("prep_mcq", progress)
    );
  }
  return isOnboardingTaskComplete(slideId, progress);
}
