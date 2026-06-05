import {
  normalizePlanTier,
  type SubscriptionPlanKey,
} from "@/lib/subscription/subscriptionConfig";

export type PerformanceUpgradeTarget = "starter" | "pro";

export type PerformancePageAccess = {
  plan: SubscriptionPlanKey;
  /** Starter+ : welcome, stats, quiz breakdown, quick actions. */
  canViewFullPage: boolean;
  /** Pro only: CBSE / JEE / KCET category mock breakdown. */
  canViewCategoryReport: boolean;
  fullPageUpgradeTarget: PerformanceUpgradeTarget | null;
  categoryUpgradeTarget: PerformanceUpgradeTarget | null;
};

export function getPerformancePageAccess(
  rawPlanTier: string | null | undefined,
  freeTrialActivated?: boolean | null,
  profile?: Parameters<typeof normalizePlanTier>[2]
): PerformancePageAccess {
  const plan = normalizePlanTier(rawPlanTier, freeTrialActivated, profile);

  if (plan === "pro") {
    return {
      plan,
      canViewFullPage: true,
      canViewCategoryReport: true,
      fullPageUpgradeTarget: null,
      categoryUpgradeTarget: null,
    };
  }

  if (plan === "starter") {
    return {
      plan,
      canViewFullPage: true,
      canViewCategoryReport: false,
      fullPageUpgradeTarget: null,
      categoryUpgradeTarget: "pro",
    };
  }

  return {
    plan,
    canViewFullPage: false,
    canViewCategoryReport: false,
    fullPageUpgradeTarget: "starter",
    categoryUpgradeTarget: null,
  };
}
