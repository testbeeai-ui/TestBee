import { FREE_TRIAL_DURATION_MS, resolveFreeTrialStartMs } from "@/lib/subscription/freeTrialTimer";
import { normalizePlanTier, type SubscriptionPlanKey } from "@/lib/subscription/subscriptionConfig";

export type BillingCycle = "monthly" | "annual";

export const MS_PER_BILLING_DAY = 24 * 60 * 60 * 1000;

/** Canonical list prices (aligned with SubscriptionCheckout / plan picker). */
export const PLAN_PRICING = {
  starter: { monthly: 499, annual: 3999 },
  pro: { monthly: 899, annual: 6999 },
} as const;

export const BILLING_CYCLE_PERIOD_DAYS: Record<BillingCycle, number> = {
  monthly: 30,
  annual: 365,
};

/** Scenario 2 trial-end card: first paid month is free before recurring billing. */
export const TRIAL_END_BONUS_MONTH_DAYS = 30;

export type SubscriptionBillingProfile = {
  plan_tier?: string | null;
  free_trial_activated?: boolean | null;
  free_trial_activated_at?: string | null;
  subscription_started_at?: string | null;
  subscription_expires_at?: string | null;
  created_at?: string | null;
  card_added_at?: string | null;
  trial_end_bonus_activated?: boolean | null;
  trial_second_round_activated?: boolean | null;
  trial_original_ended_at?: string | null;
  payment_card_details?: unknown;
  time_travel_offset_ms?: number | null;
};

export function parseProfilePaymentDetails(
  raw: unknown
): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const obj =
      typeof raw === "string" ? (JSON.parse(raw) as Record<string, unknown>) : raw;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return obj as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Defaults to monthly (trial-end card and checkout default). */
export function resolveBillingCycle(
  profile?: SubscriptionBillingProfile | null
): BillingCycle {
  const details = parseProfilePaymentDetails(profile?.payment_card_details);
  const raw = details?.billingCycle ?? details?.billingMode;
  return raw === "annual" ? "annual" : "monthly";
}

export function isInTrialEndBonusMonth(
  profile?: SubscriptionBillingProfile | null
): boolean {
  if (!profile?.trial_end_bonus_activated || profile.trial_second_round_activated) {
    return false;
  }
  const plan = normalizePlanTier(profile.plan_tier, profile.free_trial_activated, profile);
  return plan === "starter" || plan === "pro";
}

export function getPaidSubscriptionPeriodDays(
  profile?: SubscriptionBillingProfile | null
): number {
  if (isInTrialEndBonusMonth(profile)) return TRIAL_END_BONUS_MONTH_DAYS;
  return BILLING_CYCLE_PERIOD_DAYS[resolveBillingCycle(profile)];
}

/**
 * Bonus month begins when the 14-day trial ends (card capture), not at trial activation.
 * Clamps stored timestamps that were saved with wall-clock time during dev time-travel.
 */
export function getTrialEndBonusMonthStartMs(
  profile?: SubscriptionBillingProfile | null
): number {
  const stored = [
    profile?.trial_original_ended_at,
    profile?.card_added_at,
    profile?.subscription_started_at,
  ]
    .map((iso) => (iso ? Date.parse(iso) : NaN))
    .filter((ms) => Number.isFinite(ms));

  let startMs = stored.length > 0 ? Math.max(...stored) : NaN;

  const trialStartMs = resolveFreeTrialStartMs({
    freeTrialActivatedAt: profile?.free_trial_activated_at,
    freeTrialActivated: profile?.free_trial_activated,
    createdAt: profile?.created_at,
  });
  if (trialStartMs != null) {
    const calendarTrialEndMs = trialStartMs + FREE_TRIAL_DURATION_MS;
    if (!Number.isFinite(startMs) || startMs < calendarTrialEndMs) {
      startMs = calendarTrialEndMs;
    }
  }

  if (!Number.isFinite(startMs)) {
    return Date.now();
  }
  return startMs;
}

export function getPaidSubscriptionStartIso(
  profile?: SubscriptionBillingProfile | null
): string {
  if (isInTrialEndBonusMonth(profile)) {
    return new Date(getTrialEndBonusMonthStartMs(profile)).toISOString();
  }
  return (
    profile?.subscription_started_at ??
    profile?.created_at ??
    new Date().toISOString()
  );
}

export type PaidSubscriptionPeriod = {
  planKey: "starter" | "pro";
  startMs: number;
  endMs: number;
  totalDays: number;
  remainingDays: number;
  percentUsed: number;
  billingRateLabel: string;
  rawRate: number;
  billingCycle: BillingCycle;
  inBonusMonth: boolean;
};

export function computePaidSubscriptionPeriod(
  profile?: SubscriptionBillingProfile | null,
  nowMs = Date.now()
): PaidSubscriptionPeriod | null {
  const planKey = normalizePlanTier(profile?.plan_tier, profile?.free_trial_activated, profile);
  if (planKey !== "starter" && planKey !== "pro") return null;

  const effectiveNowMs = resolveSubscriptionNowMs(profile, nowMs);

  const startIso = getPaidSubscriptionStartIso(profile);
  const startMs = Date.parse(startIso);
  if (!Number.isFinite(startMs)) return null;

  const details = parseProfilePaymentDetails(profile?.payment_card_details);
  const isCouponGrant = details?.type === "coupon";

  let endMs: number;
  let totalDays: number;

  const couponExpiryMs = profile?.subscription_expires_at
    ? Date.parse(profile.subscription_expires_at)
    : NaN;

  if (Number.isFinite(couponExpiryMs) && couponExpiryMs > startMs) {
    endMs = couponExpiryMs;
    totalDays = Math.max(1, Math.ceil((endMs - startMs) / MS_PER_BILLING_DAY));
  } else {
    totalDays = getPaidSubscriptionPeriodDays(profile);
    endMs = startMs + totalDays * MS_PER_BILLING_DAY;
  }

  const remainingDays = Math.max(0, Math.ceil((endMs - effectiveNowMs) / MS_PER_BILLING_DAY));
  const elapsedDays = Math.max(0, totalDays - remainingDays);
  const percentUsed =
    totalDays > 0 ? Math.min(100, Math.round((elapsedDays / totalDays) * 100)) : 0;

  const billingCycle = resolveBillingCycle(profile);
  const pricing = PLAN_PRICING[planKey];
  const rawRate = billingCycle === "annual" ? pricing.annual : pricing.monthly;
  const billingRateLabel = isCouponGrant
    ? "Coupon grant"
    : billingCycle === "annual"
      ? `₹${pricing.annual.toLocaleString("en-IN")} / year`
      : `₹${pricing.monthly.toLocaleString("en-IN")} / month`;

  const inBonusMonth = isInTrialEndBonusMonth(profile) && effectiveNowMs < endMs;

  return {
    planKey,
    startMs,
    endMs,
    totalDays,
    remainingDays,
    percentUsed,
    billingRateLabel,
    rawRate: isCouponGrant ? 0 : rawRate,
    billingCycle,
    inBonusMonth,
  };
}

export function resolveSubscriptionNowMs(
  profile?: SubscriptionBillingProfile | null,
  nowMs = Date.now()
): number {
  const offset = Math.max(0, Number(profile?.time_travel_offset_ms ?? 0));
  return nowMs + offset;
}

export function getPaidPlanChargeAmount(
  planKey: SubscriptionPlanKey,
  profile?: SubscriptionBillingProfile | null
): number {
  if (planKey !== "starter" && planKey !== "pro") return 0;
  const cycle = resolveBillingCycle(profile);
  return cycle === "annual" ? PLAN_PRICING[planKey].annual : PLAN_PRICING[planKey].monthly;
}
