import type { Profile } from "@/hooks/useAuth";
import {
  fetchSubscriptionConfig,
  getPlanLimits,
  isUnlimited,
  normalizePlanTier,
} from "@/lib/subscription/subscriptionConfig";

export const REVISION_CARD_UPGRADE_PATH = "/profile?section=sub-plans";

export type RevisionCardSaveLimitState = {
  cap: number;
  unlimited: boolean;
  savedCount: number;
  atLimit: boolean;
};

export async function resolveRevisionCardSaveLimit(
  profile: Profile | null | undefined,
  savedCount: number
): Promise<RevisionCardSaveLimitState> {
  const cfg = await fetchSubscriptionConfig();
  const tier = normalizePlanTier(
    profile?.plan_tier,
    profile?.free_trial_activated,
    profile
  );
  const cap = getPlanLimits(cfg, tier).instacueCardLimit;
  const unlimited = isUnlimited(cap);
  const effectiveCap = unlimited ? -1 : Math.max(0, cap);
  return {
    cap: effectiveCap,
    unlimited,
    savedCount,
    atLimit: !unlimited && savedCount >= effectiveCap,
  };
}

export function revisionCardLimitToastCopy(cap: number): {
  title: string;
  description: string;
} {
  return {
    title: "Revision save limit reached",
    description: `Your plan allows ${cap} saved InstaCue card${cap === 1 ? "" : "s"}. Subscribe to Starter or Pro for more — open Profile → Subscription.`,
  };
}
