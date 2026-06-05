import {
  fetchSubscriptionConfig,
  getPlanLimits,
  isUnlimited,
  normalizePlanTier,
  type SubscriptionPlanKey,
} from "@/lib/subscription/subscriptionConfig";

/** Practical cap when plan config is -1 (unlimited). */
export const BUDDY_UNLIMITED_CAP = 100;

/** Legacy fallback if subscription config cannot be loaded. */
export const BUDDY_MAX_ACTIVE_FALLBACK = 5;

export type BuddyLimitResolution = {
  plan: SubscriptionPlanKey;
  rawLimit: number;
  effectiveCap: number;
  unlimited: boolean;
};

export function effectiveBuddyCap(rawLimit: number): number {
  if (isUnlimited(rawLimit)) return BUDDY_UNLIMITED_CAP;
  if (!Number.isFinite(rawLimit)) return BUDDY_MAX_ACTIVE_FALLBACK;
  return Math.max(0, Math.floor(rawLimit));
}

export function resolveBuddyLimitFromProfile(profile: {
  plan_tier?: string | null;
  free_trial_activated?: boolean | null;
  payment_card_details?: any;
  subscription_started_at?: string | null;
  time_travel_offset_ms?: number | null;
} | null | undefined, cfg: Awaited<ReturnType<typeof fetchSubscriptionConfig>>): BuddyLimitResolution {
  const plan = normalizePlanTier(profile?.plan_tier, profile?.free_trial_activated, profile);
  const rawLimit = getPlanLimits(cfg, plan).buddiesLimit;
  return {
    plan,
    rawLimit,
    effectiveCap: effectiveBuddyCap(rawLimit),
    unlimited: isUnlimited(rawLimit),
  };
}

export async function resolveMaxBuddiesForUserId(
  supabase: Parameters<typeof fetchSubscriptionConfig>[0] | { from: (t: string) => any },
  userId: string
): Promise<BuddyLimitResolution> {
  const db = supabase as { from: (t: string) => any };
  const [{ data: profile, error }, cfg] = await Promise.all([
    db.from("profiles").select("plan_tier, free_trial_activated, payment_card_details, subscription_started_at, time_travel_offset_ms").eq("id", userId).maybeSingle(),
    fetchSubscriptionConfig(supabase as Parameters<typeof fetchSubscriptionConfig>[0]),
  ]);
  if (error) throw new Error(error.message);
  return resolveBuddyLimitFromProfile(profile, cfg);
}
