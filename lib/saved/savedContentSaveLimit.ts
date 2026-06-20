import type { Profile } from "@/hooks/useAuth";
import {
  fetchSubscriptionConfig,
  getPlanLimits,
  isUnlimited,
  normalizePlanTier,
} from "@/lib/subscription/subscriptionConfig";

export const SAVED_CONTENT_UPGRADE_PATH = "/profile?section=sub-plans";

export type SavedContentSaveLimitState = {
  cap: number;
  unlimited: boolean;
  savedCount: number;
  atLimit: boolean;
};

export type SavedContentLimitItemType =
  | "saved_revision_card"
  | "saved_bit"
  | "saved_formula";

function capForItemType(
  itemType: SavedContentLimitItemType,
  limits: ReturnType<typeof getPlanLimits>
): number {
  if (itemType === "saved_revision_card") return limits.instacueCardLimit;
  if (itemType === "saved_bit") return limits.savedBitLimit;
  return limits.savedFormulaLimit;
}

export async function resolveSavedContentLimit(
  profile: Profile | null | undefined,
  itemType: SavedContentLimitItemType,
  savedCount: number
): Promise<SavedContentSaveLimitState> {
  const cfg = await fetchSubscriptionConfig();
  const tier = normalizePlanTier(
    profile?.plan_tier,
    profile?.free_trial_activated,
    profile
  );
  const cap = capForItemType(itemType, getPlanLimits(cfg, tier));
  const unlimited = isUnlimited(cap);
  const effectiveCap = unlimited ? -1 : Math.max(0, cap);
  return {
    cap: effectiveCap,
    unlimited,
    savedCount,
    atLimit: !unlimited && savedCount >= effectiveCap,
  };
}

export function savedContentLimitToastCopy(
  itemType: SavedContentLimitItemType,
  cap: number
): { title: string; description: string } {
  if (itemType === "saved_bit") {
    return {
      title: "Quiz save limit reached",
      description: `Your plan allows ${cap} saved quiz question${cap === 1 ? "" : "s"}. Subscribe to Starter or Pro for more — open Profile → Subscription.`,
    };
  }
  if (itemType === "saved_formula") {
    return {
      title: "Numerals save limit reached",
      description: `Your plan allows ${cap} saved formula practice set${cap === 1 ? "" : "s"}. Subscribe to Starter or Pro for more — open Profile → Subscription.`,
    };
  }
  return {
    title: "Revision save limit reached",
    description: `Your plan allows ${cap} saved InstaCue card${cap === 1 ? "" : "s"}. Subscribe to Starter or Pro for more — open Profile → Subscription.`,
  };
}

/** @deprecated Use resolveSavedContentLimit with saved_revision_card */
export async function resolveRevisionCardSaveLimit(
  profile: Profile | null | undefined,
  savedCount: number
): Promise<SavedContentSaveLimitState> {
  return resolveSavedContentLimit(profile, "saved_revision_card", savedCount);
}

/** @deprecated Use savedContentLimitToastCopy with saved_revision_card */
export function revisionCardLimitToastCopy(cap: number): {
  title: string;
  description: string;
} {
  return savedContentLimitToastCopy("saved_revision_card", cap);
}

export const REVISION_CARD_UPGRADE_PATH = SAVED_CONTENT_UPGRADE_PATH;

export type RevisionCardSaveLimitState = SavedContentSaveLimitState;
