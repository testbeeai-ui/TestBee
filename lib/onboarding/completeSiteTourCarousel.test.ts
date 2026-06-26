import { describe, expect, it } from "vitest";
import {
  buildSiteTourCompleteProgress,
  incompleteOnboardingRewardTaskIds,
} from "@/lib/onboarding/buildSiteTourCompleteProgress";
import { isOnboardingRewardCompleteForProgress } from "@/lib/subscription/freeTrialClient";
import {
  ONBOARDING_REWARD_TASK_IDS,
  ONBOARDING_GYAN_PLUS_SUBSTEP_IDS,
  ONBOARDING_SITE_TOUR_BULK_MERGE_IDS,
  isFullSiteTourProgressBulkMerge,
} from "@/lib/subscription/onboardingRewardConstants";

describe("site tour complete progress payload", () => {
  it("includes every bulk-merge key so PATCH buddy verify is skipped", () => {
    const payloadKeys = [...ONBOARDING_SITE_TOUR_BULK_MERGE_IDS];
    expect(payloadKeys).toHaveLength(
      ONBOARDING_REWARD_TASK_IDS.length + ONBOARDING_GYAN_PLUS_SUBSTEP_IDS.length
    );
    expect(isFullSiteTourProgressBulkMerge(payloadKeys)).toBe(true);
  });

  it("satisfies client and server checklist completion checks", () => {
    const progress = buildSiteTourCompleteProgress();
    expect(isOnboardingRewardCompleteForProgress(progress)).toBe(true);
    expect(incompleteOnboardingRewardTaskIds(progress)).toEqual([]);
  });
});
