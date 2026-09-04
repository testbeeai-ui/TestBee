import {
  shouldBlockMocksForFreePlanCap,
} from "@/lib/subscription/freePlanCap";
import {
  isFreeTrialPeriodEndedForProfile,
  resolveFreeTrialStartMs,
  resolveTrialDurationMsForProfile,
  type FreeTrialClockProfile,
} from "@/lib/subscription/freeTrialTimer";
import {
  getTrialEndBonusMonthStartMs,
  MS_PER_BILLING_DAY,
  TRIAL_END_BONUS_MONTH_DAYS,
} from "@/lib/subscription/subscriptionBilling";
import {
  normalizePlanTier,
  type SubscriptionConfig,
} from "@/lib/subscription/subscriptionConfig";

/** 24h after the current trial clock ends — only then is the 1-month bonus available. */
export const TRIAL_END_BONUS_CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;

const PAID_TIERS = new Set(["starter", "pro", "scholar", "champion", "pro_plus"]);

export type TrialAccessProfile = FreeTrialClockProfile & {
  plan_tier?: string | null;
  trial_original_ended_at?: string | null;
  subscription_started_at?: string | null;
  subscription_expires_at?: string | null;
  card_added_at?: string | null;
  time_travel_offset_ms?: number | null;
  payment_card_details?: unknown;
};

export type ClaimBonusDecision =
  | { kind: "already_claimed"; scenario: 1 | 2 }
  | { kind: "too_early"; error: string }
  | { kind: "bonus_window_closed"; error: string }
  | {
      kind: "apply";
      scenario: 1 | 2;
      updates: Record<string, unknown>;
    };

export type StudentMockAccessDecision =
  | { allow: true; persist?: Record<string, unknown> }
  | {
      allow: false;
      code: "TRIAL_CHOICE_REQUIRED" | "FREE_PLAN_MOCK_CAP";
      message: string;
      persist?: Record<string, unknown>;
    };

function isPaidTier(planTier: string | null | undefined): boolean {
  return PAID_TIERS.has(String(planTier ?? "").trim().toLowerCase());
}

function hasExitedToFreePlan(profile: TrialAccessProfile | null | undefined): boolean {
  if (!profile?.trial_original_ended_at) return false;
  const tier = String(profile.plan_tier ?? "").trim().toLowerCase();
  return tier === "free" && profile.free_trial_activated === false;
}

export function resolveTrialExpirationGateOpen(
  clientRequired: boolean,
  serverRequired: boolean | null
): boolean {
  // Server loads subscription config; a definitive `false` must win so an
  // admin-lengthened trial is not blocked by the client's 14-day default.
  // Fall back to the client clock only when the server result is unknown.
  return serverRequired === true || (serverRequired == null && clientRequired);
}

export function profileNowMs(
  profile: TrialAccessProfile | null | undefined,
  nowMs = Date.now()
): number {
  return nowMs + Math.max(0, Number(profile?.time_travel_offset_ms ?? 0));
}

function trialEndMs(
  profile: TrialAccessProfile | null | undefined,
  cfg?: SubscriptionConfig | null
): number | null {
  const start = resolveFreeTrialStartMs({
    freeTrialActivatedAt: profile?.free_trial_activated_at,
    freeTrialActivated: profile?.free_trial_activated,
    createdAt: profile?.created_at,
  });
  if (start == null) return null;
  return start + resolveTrialDurationMsForProfile(profile, cfg);
}

export function isWithinTrialEndBonusWindow(
  profile: TrialAccessProfile | null | undefined,
  nowMs: number,
  cfg?: SubscriptionConfig | null
): boolean {
  const endMs = trialEndMs(profile, cfg);
  if (endMs == null) return false;
  if (nowMs < endMs) return false;
  return nowMs < endMs + TRIAL_END_BONUS_CLAIM_WINDOW_MS;
}

export function hasCompletedPaidBonusClaim(
  profile: TrialAccessProfile | null | undefined
): boolean {
  if (!profile?.trial_end_bonus_activated) return false;
  if (profile.trial_second_round_activated) return false;
  return isPaidTier(profile.plan_tier);
}

export function isBonusMonthExpired(
  profile: TrialAccessProfile | null | undefined,
  nowMs: number,
  cfg?: SubscriptionConfig | null
): boolean {
  void cfg;
  if (!profile?.trial_end_bonus_activated) return false;
  if (profile.trial_second_round_activated && !isPaidTier(profile.plan_tier)) {
    return false;
  }
  if (!isPaidTier(profile.plan_tier) && !profile.subscription_expires_at) {
    return false;
  }
  if (profile.subscription_expires_at) {
    const expiryMs = Date.parse(profile.subscription_expires_at);
    if (Number.isFinite(expiryMs)) return nowMs >= expiryMs;
  }
  const startMs = getTrialEndBonusMonthStartMs(profile);
  return nowMs >= startMs + TRIAL_END_BONUS_MONTH_DAYS * MS_PER_BILLING_DAY;
}

export function expiredBonusMonthProfileUpdates(): Record<string, unknown> {
  return {
    plan_tier: "free",
    free_trial_activated: false,
    trial_second_round_activated: false,
  };
}

export function isTrialChoiceRequired(
  profile: TrialAccessProfile | null | undefined,
  nowMs: number,
  cfg?: SubscriptionConfig | null
): boolean {
  if (!profile) return false;
  if (isBonusMonthExpired(profile, nowMs, cfg)) return false;
  if (isPaidTier(profile.plan_tier)) return false;
  if (hasExitedToFreePlan(profile)) return false;
  const start = resolveFreeTrialStartMs({
    freeTrialActivatedAt: profile.free_trial_activated_at,
    freeTrialActivated: profile.free_trial_activated,
    createdAt: profile.created_at,
  });
  if (start == null) return false;
  return isFreeTrialPeriodEndedForProfile(profile, nowMs, cfg);
}

export function sanitizePaymentDetailsForStorage(
  _raw: Record<string, unknown> | null | undefined,
  planSelected: "starter" | "pro"
): Record<string, unknown> {
  return {
    type: "deferred_razorpay",
    planSelected,
    billingCycle: "monthly",
  };
}

function secondRoundWindowEndMs(
  profile: TrialAccessProfile,
  cfg?: SubscriptionConfig | null
): number | null {
  const start = resolveFreeTrialStartMs({
    freeTrialActivatedAt: profile.free_trial_activated_at,
    freeTrialActivated: profile.free_trial_activated,
    createdAt: profile.created_at,
  });
  if (start == null) return null;
  const asSecondRound: TrialAccessProfile = {
    ...profile,
    trial_second_round_activated: true,
  };
  return start + resolveTrialDurationMsForProfile(asSecondRound, cfg);
}

export function isSecondRoundStillClaimable(
  profile: TrialAccessProfile | null | undefined,
  nowMs: number,
  cfg?: SubscriptionConfig | null
): boolean {
  if (!profile) return false;
  const end = secondRoundWindowEndMs(profile, cfg);
  if (end == null) return false;
  return nowMs < end;
}

export function buildClaimBonusDecision(input: {
  selectedPlan: "starter" | "pro";
  nowMs: number;
  hasStreakBonus: boolean;
  profile: TrialAccessProfile;
  trackerDaysCompleted?: number;
  cfg?: SubscriptionConfig | null;
}): ClaimBonusDecision {
  const { selectedPlan, nowMs, hasStreakBonus, profile, cfg } = input;
  if (hasCompletedPaidBonusClaim(profile)) {
    return { kind: "already_claimed", scenario: 2 };
  }

  if (!isFreeTrialPeriodEndedForProfile(profile, nowMs, cfg)) {
    return {
      kind: "too_early",
      error: "Free trial period has not ended yet. Complete 14 days first.",
    };
  }

  const nowIso = new Date(nowMs).toISOString();
  const payment_card_details = sanitizePaymentDetailsForStorage(null, selectedPlan);

  const secondRoundEnd = secondRoundWindowEndMs(profile, cfg);
  if (
    hasStreakBonus &&
    secondRoundEnd != null &&
    nowMs < secondRoundEnd
  ) {
    return {
      kind: "apply",
      scenario: 1,
      updates: {
        plan_tier: "free_trial",
        trial_second_round_activated: true,
        trial_end_bonus_activated: false,
        payment_card_details,
        trial_streak_at_day_14: input.trackerDaysCompleted ?? null,
      },
    };
  }

  if (!isWithinTrialEndBonusWindow(profile, nowMs, cfg)) {
    return {
      kind: "bonus_window_closed",
      error:
        "The 24-hour 1-month bonus window has closed. Continue on Free, or upgrade later from Profile → Subscription.",
    };
  }

  const bonusEndMs = nowMs + TRIAL_END_BONUS_MONTH_DAYS * MS_PER_BILLING_DAY;
  return {
    kind: "apply",
    scenario: 2,
    updates: {
      plan_tier: selectedPlan,
      free_trial_activated: false,
      trial_second_round_activated: false,
      trial_end_bonus_activated: true,
      subscription_started_at: nowIso,
      subscription_expires_at: new Date(bonusEndMs).toISOString(),
      card_added_at: nowIso,
      trial_original_ended_at: nowIso,
      trial_streak_at_day_14: input.trackerDaysCompleted ?? null,
      payment_card_details,
    },
  };
}

export function decideStudentMockAccess(
  profile: TrialAccessProfile | null | undefined,
  nowMs: number,
  cfg?: SubscriptionConfig | null
): StudentMockAccessDecision {
  if (!profile) {
    return {
      allow: false,
      code: "TRIAL_CHOICE_REQUIRED",
      message: "Your free trial has ended. Choose a plan or continue on Free.",
    };
  }

  let persist: Record<string, unknown> | undefined;
  let effective: TrialAccessProfile = profile;
  if (isBonusMonthExpired(profile, nowMs, cfg)) {
    persist = expiredBonusMonthProfileUpdates();
    effective = { ...profile, ...persist };
  }

  if (isTrialChoiceRequired(effective, nowMs, cfg)) {
    return {
      allow: false,
      code: "TRIAL_CHOICE_REQUIRED",
      message: "Your free trial has ended. Choose a plan or continue on Free.",
      persist,
    };
  }

  const currentPlan = normalizePlanTier(
    effective.plan_tier,
    effective.free_trial_activated,
    effective
  );
  if (shouldBlockMocksForFreePlanCap(effective, currentPlan, cfg, nowMs)) {
    return {
      allow: false,
      code: "FREE_PLAN_MOCK_CAP",
      message:
        "Free plan mock limit reached. Upgrade to Starter or Pro to keep taking mocks.",
      persist,
    };
  }

  return persist ? { allow: true, persist } : { allow: true };
}
