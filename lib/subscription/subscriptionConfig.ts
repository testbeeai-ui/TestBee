import { supabase } from "@/integrations/supabase/client";

export type SubscriptionPlanKey = "free_trial" | "free" | "starter" | "pro";

export type SubscriptionPlanLimits = {
  magicWallMaxActiveTopics: number;
  magicWallMonthlyAttempts: number;
  gyanDoubtsPerDay: number;
  lessonsChapterLimit: number;
  instacueCardLimit: number;
  mocksPerMonth: number;
  dailyDoseQuestionsPerDay: number;
  buddiesLimit: number;
  rdmMultiplierPct: number;
};

export type SubscriptionConfig = Record<string, number>;

export const SUBSCRIPTION_CONFIG_DEFAULTS: SubscriptionConfig = {
  free_magic_wall_max_active_topics: 2,
  free_magic_wall_monthly_attempts: 2,
  free_trial_magic_wall_max_active_topics: 3,
  free_trial_magic_wall_monthly_attempts: 3,
  starter_magic_wall_max_active_topics: 5,
  starter_magic_wall_monthly_attempts: 5,
  pro_magic_wall_max_active_topics: 5,
  pro_magic_wall_monthly_attempts: -1,

  free_gyan_doubts_per_day: 1,
  free_trial_gyan_doubts_per_day: 1,
  starter_gyan_doubts_per_day: 30,
  pro_gyan_doubts_per_day: -1,

  free_lessons_chapter_limit: 2,
  free_trial_lessons_chapter_limit: 2,
  starter_lessons_chapter_limit: -1,
  pro_lessons_chapter_limit: -1,

  free_instacue_card_limit: 20,
  free_trial_instacue_card_limit: 20,
  starter_instacue_card_limit: 200,
  pro_instacue_card_limit: -1,

  free_mocks_per_month: 3,
  free_trial_mocks_per_month: 3,
  starter_mocks_per_month: 8,
  pro_mocks_per_month: -1,

  free_daily_dose_questions_per_day: 5,
  free_trial_daily_dose_questions_per_day: 5,
  starter_daily_dose_questions_per_day: 10,
  pro_daily_dose_questions_per_day: 10,

  free_buddies_limit: 0,
  free_trial_buddies_limit: 0,
  starter_buddies_limit: 2,
  pro_buddies_limit: -1,

  free_rdm_multiplier_pct: 25,
  // Free Trial — flat 0.25x during the 28-day trial period.
  free_trial_rdm_multiplier_pct: 25,

  // Starter Plan — ramp-in phase, then full rate.
  // Month 1–3 → 0.50x | Month 4+ → 1.00x
  starter_rdm_multiplier_months_1_3_pct: 50,
  starter_rdm_multiplier_months_4_plus_pct: 100,

  // Pro Plan — full rate immediately, then loyalty bonuses.
  // Month 1–5 → 1.00x | Month 6–11 → 1.50x | Month 12+ → 2.00x
  pro_rdm_multiplier_months_1_5_pct: 100,
  pro_rdm_multiplier_months_6_11_pct: 150,
  pro_rdm_multiplier_months_12_plus_pct: 200,

  // Existing free-trial keys already used by current flows.
  free_trial_welcome_rdm: 500,
  free_trial_inactive_penalty_rdm: 50,
  free_inactive_penalty_rdm: 50,
  starter_inactive_penalty_rdm: 50,
  pro_inactive_penalty_rdm: 25,
  free_trial_checklist_reward_rdm: 100,
};

export const SUBSCRIPTION_CONFIG_KEYS = Object.keys(
  SUBSCRIPTION_CONFIG_DEFAULTS
) as (keyof typeof SUBSCRIPTION_CONFIG_DEFAULTS)[];

type SubscriptionConfigQueryResult = {
  data: Array<{ key: string; value: number | null }> | null;
  error: unknown;
};

type SubscriptionConfigClient = {
  from: (table: "rdm_config") => {
    select: (columns: "key, value") => PromiseLike<SubscriptionConfigQueryResult>;
  };
};

export function normalizePlanTier(
  rawPlanTier: string | null | undefined,
  freeTrialActivated?: boolean | null
): SubscriptionPlanKey {
  const normalized = String(rawPlanTier ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "free_trial") return "free_trial";
  if (normalized === "starter" || normalized === "scholar") return "starter";
  if (normalized === "pro" || normalized === "champion" || normalized === "pro_plus") return "pro";
  if (normalized === "free") {
    return freeTrialActivated === true ? "free_trial" : "free";
  }
  return freeTrialActivated === true ? "free_trial" : "free";
}

export function getPlanLimits(
  cfg: SubscriptionConfig,
  plan: SubscriptionPlanKey
): SubscriptionPlanLimits {
  const prefix = `${plan}_`;
  const read = (k: string, fallback: number) => {
    const v = cfg[`${prefix}${k}`];
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  };
  return {
    magicWallMaxActiveTopics: read("magic_wall_max_active_topics", 3),
    magicWallMonthlyAttempts: read("magic_wall_monthly_attempts", 3),
    gyanDoubtsPerDay: read("gyan_doubts_per_day", 1),
    lessonsChapterLimit: read("lessons_chapter_limit", 2),
    instacueCardLimit: read("instacue_card_limit", 20),
    mocksPerMonth: read("mocks_per_month", 3),
    dailyDoseQuestionsPerDay: read("daily_dose_questions_per_day", 5),
    buddiesLimit: read("buddies_limit", 0),
    rdmMultiplierPct: read("rdm_multiplier_pct", 100),
  };
}

export function isUnlimited(limit: number): boolean {
  return limit < 0;
}

export async function fetchSubscriptionConfig(
  customClient?: SubscriptionConfigClient
): Promise<SubscriptionConfig> {
  const merged: SubscriptionConfig = { ...SUBSCRIPTION_CONFIG_DEFAULTS };
  try {
    const client = customClient ?? (supabase as unknown as SubscriptionConfigClient);
    const { data, error } = await client.from("rdm_config").select("key, value");
    if (error || !data) return merged;
    for (const row of data) {
      if (!SUBSCRIPTION_CONFIG_KEYS.includes(row.key as keyof typeof SUBSCRIPTION_CONFIG_DEFAULTS))
        continue;
      if (typeof row.value === "number") merged[row.key] = row.value;
    }
    return merged;
  } catch {
    return merged;
  }
}

/**
 * Returns the number of complete calendar months a student has been on their
 * current paid subscription, starting at month 1 on day 1.
 *
 * @param startedAtStr - ISO timestamp of when the paid sub started (subscription_started_at).
 *                       Falls back to `createdAtStr` if not set.
 * @param createdAtStr - ISO timestamp of profile creation (always present).
 */
export function getLoyaltyMonths(
  startedAtStr: string | null | undefined,
  createdAtStr: string
): number {
  const start = new Date(startedAtStr || createdAtStr);
  const now = new Date();
  const years = now.getFullYear() - start.getFullYear();
  const months = now.getMonth() - start.getMonth();
  // Month 1 = same calendar month as start, month 2 = one month later, etc.
  return Math.max(1, years * 12 + months + 1);
}

/**
 * Calculates the active RDM multiplier for a student based on their plan tier,
 * subscription start date, and the current admin-configurable rdm_config values.
 *
 * Multiplier ladder:
 *  - free_trial : flat 0.25x (configurable via free_trial_rdm_multiplier_pct)
 *  - free       : flat 1.00x (no multiplier applied)
 *  - starter    : month 1–3 → 0.50x | month 4+ → 1.00x
 *  - pro        : month 1–5 → 1.00x | month 6–11 → 1.50x | month 12+ → 2.00x
 *
 * @param plan         - Normalised plan tier key.
 * @param startedAtStr - ISO timestamp of when the paid sub started (subscription_started_at).
 * @param createdAtStr - ISO timestamp of profile creation (fallback).
 * @param cfg          - Fetched subscription config (from fetchSubscriptionConfig or defaults).
 */
export function calculateActiveMultiplier(
  plan: SubscriptionPlanKey,
  startedAtStr: string | null | undefined,
  createdAtStr: string,
  cfg: SubscriptionConfig
): number {
  if (plan === "free_trial") {
    return (cfg["free_trial_rdm_multiplier_pct"] ?? 25) / 100;
  }
  if (plan === "free") {
    return (cfg["free_rdm_multiplier_pct"] ?? 25) / 100;
  }

  const months = getLoyaltyMonths(startedAtStr, createdAtStr);

  if (plan === "starter") {
    if (months <= 3) {
      return (cfg["starter_rdm_multiplier_months_1_3_pct"] ?? 50) / 100;
    }
    return (cfg["starter_rdm_multiplier_months_4_plus_pct"] ?? 100) / 100;
  }

  if (plan === "pro") {
    if (months <= 5) {
      return (cfg["pro_rdm_multiplier_months_1_5_pct"] ?? 100) / 100;
    }
    if (months <= 11) {
      return (cfg["pro_rdm_multiplier_months_6_11_pct"] ?? 150) / 100;
    }
    return (cfg["pro_rdm_multiplier_months_12_plus_pct"] ?? 200) / 100;
  }

  return 1.0;
}

/**
 * Returns a human-readable label describing the active multiplier tier for the UI.
 * e.g. "0.50x — Starter Month 1–3 (ramp-in)" or "1.50x — Pro Month 6–11 (loyalty bonus)"
 */
export function getMultiplierLabel(
  plan: SubscriptionPlanKey,
  startedAtStr: string | null | undefined,
  createdAtStr: string,
  cfg: SubscriptionConfig
): string {
  if (plan === "free_trial") {
    const pct = cfg["free_trial_rdm_multiplier_pct"] ?? 25;
    return `${(pct / 100).toFixed(2)}× — Free Trial`;
  }
  if (plan === "free") {
    const pct = cfg["free_rdm_multiplier_pct"] ?? 25;
    return `${(pct / 100).toFixed(2)}× — Free Plan`;
  }

  const months = getLoyaltyMonths(startedAtStr, createdAtStr);
  const mult = calculateActiveMultiplier(plan, startedAtStr, createdAtStr, cfg);

  if (plan === "starter") {
    return months <= 3
      ? `${mult.toFixed(2)}× — Starter Month 1–3 (ramp-in)`
      : `${mult.toFixed(2)}× — Starter Month 4+ (full rate)`;
  }
  if (plan === "pro") {
    if (months <= 5) return `${mult.toFixed(2)}× — Pro Month 1–5 (full rate)`;
    if (months <= 11) return `${mult.toFixed(2)}× — Pro Month 6–11 (loyalty bonus)`;
    return `${mult.toFixed(2)}× — Pro Month 12+ (year loyalty bonus)`;
  }
  return `${mult.toFixed(2)}×`;
}

export { inactivePenaltyRdmForPlan } from "./inactivePenaltyRdm";

