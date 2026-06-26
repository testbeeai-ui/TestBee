import { describe, expect, it } from "vitest";
import {
  ONBOARDING_SITE_TOUR_BULK_MERGE_IDS,
  isFullSiteTourProgressBulkMerge,
} from "@/lib/subscription/onboardingRewardConstants";

describe("isFullSiteTourProgressBulkMerge", () => {
  it("accepts the full Day-1 site tour key set", () => {
    expect(isFullSiteTourProgressBulkMerge([...ONBOARDING_SITE_TOUR_BULK_MERGE_IDS])).toBe(true);
  });

  it("rejects partial merges that only include earn_buddy", () => {
    expect(isFullSiteTourProgressBulkMerge(["earn_buddy"])).toBe(false);
  });
});
