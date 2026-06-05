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

  resolveFreeTrialStartMs,

} from "@/lib/subscription/freeTrialTimer";



const PAID_TIERS = new Set(["starter", "pro", "scholar", "champion", "pro_plus"]);



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



function isPaidTier(planTier: string | null | undefined): boolean {

  return PAID_TIERS.has(String(planTier ?? "").trim().toLowerCase());

}



/**

 * Trial ended → must show payment / continue-free popup.

 * Intentionally minimal checks so the gate is not over-suppressed.

 */

export function explainTrialGateDecision(

  profile: OnboardingProfileFields | null | undefined,

  nowMs: number

): TrialGateDecision {

  const blockers: string[] = [];

  const merged = mergeLocalTrialClockIntoProfile(profile);

  if (!merged) {

    return { show: false, blockers: ["not signed in / no profile"] };

  }



  if (merged.trial_end_bonus_activated === true) {

    blockers.push("card/bonus already submitted (reset trial in Settings to test again)");

  }



  if (hasExitedTrialToFreePlan(merged)) {

    blockers.push("already chose Continue on Free");

  }



  if (isPaidTier(merged.plan_tier)) {

    blockers.push(`already on paid plan (${merged.plan_tier})`);

  }



  const trialStart = resolveFreeTrialStartMs({

    freeTrialActivatedAt: merged.free_trial_activated_at,

    freeTrialActivated: merged.free_trial_activated,

    createdAt: merged.created_at,

  });

  if (trialStart == null) {

    blockers.push("no trial start date — activate free trial first");

  } else if (!isFreeTrialPeriodEndedForProfile(merged, nowMs)) {

    blockers.push("trial still running (wait until day 14 or use Day 14 preset)");

  }



  return { show: blockers.length === 0, blockers };

}



export function shouldShowTrialExpirationOverlay(

  profile: OnboardingProfileFields | null | undefined,

  nowMs: number

): boolean {

  return explainTrialGateDecision(profile, nowMs).show;

}



/** Students + admins auditing student product (same as ProtectedRoute). */

export function isTrialGateAudience(role: string | null | undefined): boolean {

  const r = String(role ?? "student").trim().toLowerCase();

  return r === "student" || r === "admin";

}



export function shouldAutoOpenOnboardingRewardDialog(

  profile: OnboardingProfileFields | null | undefined,

  nowMs: number,

  userId?: string | null

): boolean {

  const merged = mergeLocalTrialClockIntoProfile(profile);

  if (!merged || !getFreeTrialActivated(merged)) return false;

  if (shouldShowTrialExpirationOverlay(profile, nowMs)) return false;

  if (merged.trial_end_bonus_activated) return false;

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

