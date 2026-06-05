import { describe, expect, it } from "vitest";
import { getPerformancePageAccess } from "./performancePageAccess";

describe("getPerformancePageAccess", () => {
  it("free and free_trial block the full page → Starter", () => {
    for (const tier of ["free", "free_trial"] as const) {
      const access = getPerformancePageAccess(tier, tier === "free_trial");
      expect(access.canViewFullPage).toBe(false);
      expect(access.canViewCategoryReport).toBe(false);
      expect(access.fullPageUpgradeTarget).toBe("starter");
      expect(access.categoryUpgradeTarget).toBeNull();
    }
  });

  it("starter shows dashboard; category report → Pro", () => {
    const access = getPerformancePageAccess("starter", false);
    expect(access.canViewFullPage).toBe(true);
    expect(access.canViewCategoryReport).toBe(false);
    expect(access.fullPageUpgradeTarget).toBeNull();
    expect(access.categoryUpgradeTarget).toBe("pro");
  });

  it("pro unlocks everything", () => {
    const access = getPerformancePageAccess("pro", false);
    expect(access.canViewFullPage).toBe(true);
    expect(access.canViewCategoryReport).toBe(true);
    expect(access.fullPageUpgradeTarget).toBeNull();
    expect(access.categoryUpgradeTarget).toBeNull();
  });
});
