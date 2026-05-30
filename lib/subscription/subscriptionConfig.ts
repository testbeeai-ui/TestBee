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
  studyGroupsLimit: number;
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

  free_study_groups_limit: 0,
  free_trial_study_groups_limit: 0,
  starter_study_groups_limit: 2,
  pro_study_groups_limit: -1,

  free_rdm_multiplier_pct: 100,
  free_trial_rdm_multiplier_pct: 100,
  starter_rdm_multiplier_pct: 150,
  pro_rdm_multiplier_pct: 200,

  // Existing free-trial keys already used by current flows.
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
    studyGroupsLimit: read("study_groups_limit", 0),
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
