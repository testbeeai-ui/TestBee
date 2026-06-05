import { supabase } from "@/integrations/supabase/client";

export type SubscriptionPlanKey = "free_trial" | "free" | "starter" | "pro";

export type SubscriptionPlanLimits = {
  magicWallMaxActiveTopics: number;
  magicWallMonthlyAttempts: number;
  gyanDoubtsPerDay: number;
  subjectChatMessagesPerDay: number;
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

  free_subject_chat_messages_per_day: 3,
  free_trial_subject_chat_messages_per_day: 3,
  starter_subject_chat_messages_per_day: -1,
  pro_subject_chat_messages_per_day: -1,

  free_subject_chat_multilingual: 0,
  free_trial_subject_chat_multilingual: 0,
  starter_subject_chat_multilingual: 0,
  pro_subject_chat_multilingual: 1,

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

  // Investor rule: Free trial length (base, no streak) in days.
  free_trial_duration_days: 14,
  // Investor rule: Extra days granted if the user keeps a streak across the
  // base trial window. 14 base + 14 extension = 28 day second round.
  free_trial_streak_extension_days: 14,
  // Investor rule: Consecutive active days required to unlock the extension.
  free_trial_streak_days_required: 14,
  // Investor rule: Maximum calendar months a user may stay on the Free plan
  // (3 mocks/month) before the mock quota is soft-blocked until they upgrade.
  free_plan_max_months: 2,
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
  freeTrialActivated?: boolean | null,
  profile?: {
    subscription_started_at?: string | null;
    subscription_expires_at?: string | null;
    payment_card_details?: any;
    time_travel_offset_ms?: number | null;
  } | null
): SubscriptionPlanKey {
  const normalized = String(rawPlanTier ?? "")
    .trim()
    .toLowerCase();

  const isPaid = normalized === "starter" || normalized === "scholar" || normalized === "pro" || normalized === "champion" || normalized === "pro_plus";

  if (profile?.subscription_expires_at) {
    const expiryMs = Date.parse(profile.subscription_expires_at);
    const nowMs = Date.now() + (profile.time_travel_offset_ms ?? 0);
    if (!Number.isNaN(expiryMs)) {
      if (nowMs >= expiryMs) {
        return freeTrialActivated === true ? "free_trial" : "free";
      }
      if (normalized === "starter" || normalized === "scholar") return "starter";
      if (normalized === "pro" || normalized === "champion" || normalized === "pro_plus") return "pro";
    }
  }

  if (isPaid && profile) {
    try {
      const details = typeof profile.payment_card_details === "string"
        ? JSON.parse(profile.payment_card_details)
        : profile.payment_card_details;

      if (details && details.autoRenew === false) {
        const startIso = profile.subscription_started_at || new Date().toISOString();
        const startMs = Date.parse(startIso);

        // Calculate days in period
        const isAnnual = details.billingCycle === "annual";
        const totalDays = isAnnual ? 365 : 30;
        const endMs = startMs + totalDays * 24 * 60 * 60 * 1000;

        const nowMs = Date.now() + (profile.time_travel_offset_ms ?? 0);
        if (nowMs >= endMs) {
          // Subscription has expired! Revert to free or free trial
          return freeTrialActivated === true ? "free_trial" : "free";
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (normalized === "free_trial") return "free_trial";
  if (normalized === "starter" || normalized === "scholar") return "starter";
  if (normalized === "pro" || normalized === "champion" || normalized === "pro_plus") return "pro";
  if (normalized === "free") {
    return freeTrialActivated === true ? "free_trial" : "free";
  }
  return freeTrialActivated === true ? "free_trial" : "free";
}

/** Plan-card copy: 25% must show as 0.25x, not 0.3x (single-decimal rounding bug). */
export function formatRdmMultiplierRateLabel(multiplierPct: number): string {
  const asX = multiplierPct / 100;
  if (asX < 1) return `${asX.toFixed(2)}x rate`;
  if (Number.isInteger(asX)) return `${asX.toFixed(0)}x rate`;
  return `${asX.toFixed(1)}x rate`;
}

/** RDM % shown on subscription plan comparison cards (not loyalty-month aware). */
export function resolvePlanCardRdmMultiplierPct(
  cfg: SubscriptionConfig,
  plan: SubscriptionPlanKey
): number {
  if (plan === "free") return cfg["free_rdm_multiplier_pct"] ?? 25;
  if (plan === "free_trial") return cfg["free_trial_rdm_multiplier_pct"] ?? 25;
  if (plan === "starter") return cfg["starter_rdm_multiplier_months_1_3_pct"] ?? 50;
  if (plan === "pro") return cfg["pro_rdm_multiplier_months_1_5_pct"] ?? 100;
  return 100;
}

export function formatPlanCardRdmMultiplierLabel(
  cfg: SubscriptionConfig,
  plan: SubscriptionPlanKey
): string {
  if (plan === "starter") {
    const ramp = cfg["starter_rdm_multiplier_months_1_3_pct"] ?? 50;
    const full = cfg["starter_rdm_multiplier_months_4_plus_pct"] ?? 100;
    return `${formatRdmMultiplierRateLabel(ramp).replace(" rate", "")} → ${formatRdmMultiplierRateLabel(full).replace(" rate", "")} (loyalty)`;
  }
  if (plan === "pro") {
    const m15 = cfg["pro_rdm_multiplier_months_1_5_pct"] ?? 100;
    const m611 = cfg["pro_rdm_multiplier_months_6_11_pct"] ?? 150;
    const m12 = cfg["pro_rdm_multiplier_months_12_plus_pct"] ?? 200;
    return `${formatRdmMultiplierRateLabel(m15).replace(" rate", "")} → ${formatRdmMultiplierRateLabel(m611).replace(" rate", "")} → ${formatRdmMultiplierRateLabel(m12).replace(" rate", "")} (loyalty)`;
  }
  return formatRdmMultiplierRateLabel(resolvePlanCardRdmMultiplierPct(cfg, plan));
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
    subjectChatMessagesPerDay: read("subject_chat_messages_per_day", 3),
    lessonsChapterLimit: read("lessons_chapter_limit", 2),
    instacueCardLimit: read("instacue_card_limit", 20),
    mocksPerMonth: read("mocks_per_month", 3),
    dailyDoseQuestionsPerDay: read("daily_dose_questions_per_day", 5),
    buddiesLimit: read("buddies_limit", 0),
    rdmMultiplierPct: resolvePlanCardRdmMultiplierPct(cfg, plan),
  };
}

export function isUnlimited(limit: number): boolean {
  return limit < 0;
}

/** Admin + UI copy: Lessons (/explore-1) chapter picker — not a monthly quota. */
export const LESSONS_CHAPTER_LIMIT_RDM_DESCRIPTION =
  "Max chapters unlockable per PCM subject on Lessons (/explore-1). Separate cap for Physics, Chemistry, and Math. Not monthly. One class (11 or 12) per subject. -1 = unlimited (disables chapter lock).";

export function resolveLessonsChapterCap(limit: number, fallback = 2): number {
  if (isUnlimited(limit)) return Infinity;
  return limit > 0 ? limit : fallback;
}

export function lessonsChapterLockEnabled(
  lessonsChapterLimit: number,
  planLocksChapters: boolean
): boolean {
  return planLocksChapters && !isUnlimited(lessonsChapterLimit);
}

export function formatLessonsChapterLimitLabel(limit: number): string {
  if (isUnlimited(limit)) return "Unlimited chapters (all subjects)";
  const n = limit > 0 ? limit : 2;
  return `${n} chapter${n === 1 ? "" : "s"} per subject (Phy, Chem, Math)`;
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
 *  - free       : flat 0.25x (configurable via free_rdm_multiplier_pct)
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

