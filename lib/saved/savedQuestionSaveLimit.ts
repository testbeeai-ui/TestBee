import type { Profile } from "@/hooks/useAuth";
import {
  fetchSubscriptionConfig,
  getPlanLimits,
  isUnlimited,
  normalizePlanTier,
} from "@/lib/subscription/subscriptionConfig";
import { SAVED_CONTENT_UPGRADE_PATH } from "@/lib/saved/savedContentSaveLimit";

export { SAVED_CONTENT_UPGRADE_PATH as SAVED_QUESTION_UPGRADE_PATH };

export type SavedQuestionSaveLimitState = {
  cap: number;
  unlimited: boolean;
  savedCount: number;
  atLimit: boolean;
};

export async function resolveSavedQuestionLimit(
  profile: Profile | null | undefined,
  savedCount: number
): Promise<SavedQuestionSaveLimitState> {
  const cfg = await fetchSubscriptionConfig();
  const tier = normalizePlanTier(
    profile?.plan_tier,
    profile?.free_trial_activated,
    profile
  );
  const cap = getPlanLimits(cfg, tier).savedQuestionLimit;
  const unlimited = isUnlimited(cap);
  const effectiveCap = unlimited ? -1 : Math.max(0, cap);
  return {
    cap: effectiveCap,
    unlimited,
    savedCount,
    atLimit: !unlimited && savedCount >= effectiveCap,
  };
}

export function savedQuestionLimitToastCopy(cap: number): {
  title: string;
  description: string;
} {
  return {
    title: "Saved questions limit reached",
    description: `Your plan allows ${cap} saved question${cap === 1 ? "" : "s"} in Revision. Subscribe to Starter or Pro for more — open Profile → Subscription.`,
  };
}
