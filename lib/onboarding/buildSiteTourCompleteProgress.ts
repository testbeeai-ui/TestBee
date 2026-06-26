import { isGyanPlusOnboardingComplete } from "@/lib/onboarding/gyanPlusOnboarding";
import {
  ONBOARDING_REWARD_TASK_IDS,
  ONBOARDING_SITE_TOUR_BULK_MERGE_IDS,
} from "@/lib/subscription/onboardingRewardConstants";

/** Full checklist map written when the student finishes the Day-1 site tour carousel. */
export function buildSiteTourCompleteProgress(): Record<string, boolean> {
  return Object.fromEntries(ONBOARDING_SITE_TOUR_BULK_MERGE_IDS.map((id) => [id, true]));
}

export function incompleteOnboardingRewardTaskIds(
  progress: Record<string, boolean>
): string[] {
  return ONBOARDING_REWARD_TASK_IDS.filter((id) => {
    if (id === "gyan_plus") return !isGyanPlusOnboardingComplete(progress);
    return !progress[id];
  });
}
