import { isDailyStreakChecklistSuppressed } from "@/lib/onboarding/dailyStreakClient";
import {
  getFreeTrialActivated,
  isOnboardingRewardClaimed,
  isOnboardingRewardComplete,
  isOnboardingRewardDismissedCooldownActive,
  mergeLocalTrialClockIntoProfile,
  type OnboardingProfileFields,
} from "@/lib/subscription/freeTrialClient";
import {
  isFreeTrialPeriodEndedForProfile,
} from "@/lib/subscription/freeTrialTimer";
import type { SubscriptionConfig } from "@/lib/subscription/subscriptionConfig";
import {
  hasCompletedPaidBonusClaim,
  isTrialChoiceRequired,
} from "@/lib/subscription/trialLifecycle";

export type TrialGateDecision = {
  show: boolean;
  blockers: string[];
};

/** Completed exit-trial-to-free (not claim-bonus). */
export function hasExitedTrialToFreePlan(
  profile: OnboardingProfileFields | null | undefined
): boolean {
  if (!profile?.trial_original_ended_at) return false;
  const tier = String(profile.plan_tier ?? "").trim().toLowerCase();
  return tier === "free" && profile.free_trial_activated === false;
}

/**
 * Trial ended → must show payment / continue-free popup.
 * `show` follows {@link isTrialChoiceRequired} so leftover bonus flags cannot hide day-28.
 */
export function explainTrialGateDecision(
  profile: OnboardingProfileFields | null | undefined,
  nowMs: number,
  cfg?: SubscriptionConfig | null
): TrialGateDecision {
  const blockers: string[] = [];
  const merged = mergeLocalTrialClockIntoProfile(profile);

  if (!merged) {
    return { show: false, blockers: ["not signed in / no profile"] };
  }

  if (hasCompletedPaidBonusClaim(merged)) {
    blockers.push("card/bonus already submitted (reset trial in Settings to test again)");
  }

  if (hasExitedTrialToFreePlan(merged)) {
    blockers.push("already chose Continue on Free");
  }

  const tier = String(merged.plan_tier ?? "").trim().toLowerCase();
  if (tier === "starter" || tier === "pro" || tier === "scholar" || tier === "champion" || tier === "pro_plus") {
    blockers.push(`already on paid plan (${merged.plan_tier})`);
  }

  if (!isFreeTrialPeriodEndedForProfile(merged, nowMs, cfg)) {
    blockers.push("trial still running (wait until day 14 or use Day 14 preset)");
  }

  return { show: isTrialChoiceRequired(merged, nowMs, cfg), blockers };
}

export function shouldShowTrialExpirationOverlay(
  profile: OnboardingProfileFields | null | undefined,
  nowMs: number,
  cfg?: SubscriptionConfig | null
): boolean {
  return explainTrialGateDecision(profile, nowMs, cfg).show;
}

/** Students + admins auditing student product (same as ProtectedRoute). */
export function isTrialGateAudience(role: string | null | undefined): boolean {
  const r = String(role ?? "student").trim().toLowerCase();
  return r === "student" || r === "admin";
}

/** Day-1 investor site-tour carousel (+100 RDM) — only before the one-time claim. */
export function shouldAutoOpenSiteTourCarousel(
  profile: OnboardingProfileFields | null | undefined,
  nowMs: number
): boolean {
  const merged = mergeLocalTrialClockIntoProfile(profile);
  if (!merged || !getFreeTrialActivated(merged)) return false;
  if (shouldShowTrialExpirationOverlay(profile, nowMs)) return false;
  if (hasCompletedPaidBonusClaim(merged)) return false;
  if (merged.trial_second_round_activated) return false;
  if (isOnboardingRewardClaimed(merged)) return false;
  if (isOnboardingRewardDismissedCooldownActive(nowMs)) return false;
  return true;
}

export function shouldAutoOpenOnboardingRewardDialog(
  profile: OnboardingProfileFields | null | undefined,
  nowMs: number,
  userId?: string | null
): boolean {
  const merged = mergeLocalTrialClockIntoProfile(profile);
  if (!merged || !getFreeTrialActivated(merged)) return false;
  if (shouldShowTrialExpirationOverlay(profile, nowMs)) return false;
  if (hasCompletedPaidBonusClaim(merged)) return false;
  if (merged.trial_second_round_activated) return false;

  if (isOnboardingRewardClaimed(merged)) {
    const claimedAt = merged.onboarding_reward_claimed_at;
    if (claimedAt) {
      const claimDate = new Date(claimedAt);
      const nextDay = new Date(claimDate);
      nextDay.setDate(claimDate.getDate() + 1);
      nextDay.setHours(9, 0, 0, 0);
      if (nowMs < nextDay.getTime()) return false;
    }
    if (userId && isDailyStreakChecklistSuppressed(userId, nowMs)) return false;
    if (!isFreeTrialPeriodEndedForProfile(merged, nowMs)) {
      if (isOnboardingRewardDismissedCooldownActive(nowMs)) return false;
      return true;
    }
    return false;
  }

  if (isOnboardingRewardComplete(merged)) return false;
  if (isOnboardingRewardDismissedCooldownActive(nowMs)) return false;
  return true;
}
