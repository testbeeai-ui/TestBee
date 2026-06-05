import { clampPlayDailydoseQuestionCount } from "@/lib/rdm/rdmConfig";
import { getFreeTrialActivated } from "@/lib/subscription/freeTrialClient";
import {
  fetchSubscriptionConfig,
  getPlanLimits,
  isUnlimited,
  normalizePlanTier,
  type SubscriptionConfig,
  type SubscriptionPlanKey,
} from "@/lib/subscription/subscriptionConfig";

/** Session size when plan DailyDose limit is unlimited (-1). */
export const DAILYDOSE_UNLIMITED_SESSION_FALLBACK = 10;

export type DailyDoseProfileFields = {
  plan_tier?: string | null;
  free_trial_activated?: boolean | null;
  payment_card_details?: any;
  subscription_started_at?: string | null;
  time_travel_offset_ms?: number | null;
};

/**
 * Questions per DailyDose session from admin subscription config
 * (e.g. `free_trial_daily_dose_questions_per_day` = 5).
 */
export function resolveDailyDoseQuestionsPerSession(
  cfg: SubscriptionConfig,
  plan: SubscriptionPlanKey
): number {
  const limits = getPlanLimits(cfg, plan);
  const perDay = limits.dailyDoseQuestionsPerDay;
  if (isUnlimited(perDay)) {
    return clampPlayDailydoseQuestionCount(DAILYDOSE_UNLIMITED_SESSION_FALLBACK);
  }
  return clampPlayDailydoseQuestionCount(perDay);
}

export function resolveDailyDoseQuestionsForProfile(
  cfg: SubscriptionConfig,
  profile: DailyDoseProfileFields | null | undefined
): number {
  const plan = normalizePlanTier(profile?.plan_tier, getFreeTrialActivated(profile ?? undefined), profile);
  return resolveDailyDoseQuestionsPerSession(cfg, plan);
}

export async function fetchDailyDoseQuestionsForProfile(
  profile: DailyDoseProfileFields | null | undefined
): Promise<number> {
  const cfg = await fetchSubscriptionConfig();
  return resolveDailyDoseQuestionsForProfile(cfg, profile);
}

export function formatDailyDoseQuestionLabel(count: number): string {
  return `${count} question${count === 1 ? "" : "s"}`;
}
