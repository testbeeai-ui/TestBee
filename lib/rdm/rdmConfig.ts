import { supabase } from "@/integrations/supabase/client";

export type RdmConfigParams = {
  referral_referrer_reward: number;
  referral_referee_welcome: number;
  referral_weekly_bonus_threshold: number;
  referral_weekly_bonus_rdm: number;
  /** RDM a teacher earns when a student signs up via the teacher referral link */
  referral_teacher_signup_reward: number;
  /** Extra RDM a teacher earns when their referred student goes paid within the window */
  referral_teacher_paid_bonus: number;
  /** Days after signup in which a referred student must go paid for the teacher bonus */
  referral_teacher_paid_window_days: number;

  challenge_5_win: number;
  challenge_5_share: number;
  challenge_10_win: number;
  challenge_10_share: number;
  challenge_20_win: number;
  challenge_20_share: number;
  challenge_50_win: number;
  challenge_50_share: number;

  /** Max RDM from refer challenge win+share claims per UTC day */
  refer_challenge_daily_rdm_cap: number;

  /** “From X RDM” copy on Refer & Earn redemption tiles (does not gate checkout by itself) */
  redeem_practice_packs_from_rdm: number;
  redeem_mock_tests_from_rdm: number;
  redeem_analytics_pro_from_rdm: number;
  redeem_edufund_entry_from_rdm: number;

  /** Play hub / DailyDose + dual-domain streak (see submit_daily_gauntlet) */
  play_dailydose_academic_rdm: number;
  play_dailydose_funbrain_rdm: number;
  play_dual_streak_7_rdm: number;
  play_dual_streak_30_rdm: number;
  /** Dashboard badge copy only: day count shown for study streak bonus callout. */
  study_streak_bonus_days: number;
  /** Dashboard badge copy only: RDM amount shown for study streak bonus callout. */
  study_streak_bonus_rdm: number;
  /** Min questions in submit payload to award DailyDose RDM; keep in sync with question fetch */
  play_dailydose_min_questions_for_rdm: number;

  /** Lessons subtopic: advanced 3-set quiz daily RDM (claim_topic_quiz_advanced_daily_rdm) */
  subtopic_quiz_advanced_rdm: number;
  /** Lessons subtopic: numerals pack complete daily RDM (claim_numerals_pack_complete_daily_rdm) */
  subtopic_numerals_pack_rdm: number;
  /** Lessons subtopic: quiz result community-share bonus (claim_quiz_community_share_rdm) */
  quiz_community_share_rdm: number;
  /** Lessons subtopic: numerals result community-share bonus (claim_numerals_community_share_rdm) */
  numerals_community_share_rdm: number;

  /** Gyan++: ask / post doubt daily milestone reward (IST first ASK) */
  gyan_post_rdm: number;
  /** Gyan++: comment daily milestone reward (IST first COMMENT) */
  gyan_comment_rdm: number;
  /** Gyan++: first upvote milestone reward for voter (IST first UPVOTE) */
  gyan_upvote_rdm: number;
  /** Gyan++: save for revision daily milestone reward (IST first SAVE) */
  gyan_save_rdm: number;
  /** Gyan++: teacher answer reward shown in Teacher Section UI */
  gyan_teacher_answer_rdm: number;

  /** Welcome bonus RDM credited immediately to the student upon activating the 14-day free trial. */
  free_trial_welcome_rdm: number;
  /** Penalty RDM deducted from a free-trial user when they spend less than 30 minutes on-site during a trial day. */
  free_trial_inactive_penalty_rdm: number;
  /** Penalty RDM deducted from a free plan user when they spend less than 30 minutes on-site during a calendar day. */
  free_inactive_penalty_rdm: number;
  /** Penalty RDM deducted from a Starter plan user when they spend less than 30 minutes on-site during a calendar day. */
  starter_inactive_penalty_rdm: number;
  /** Penalty RDM deducted from a Pro plan user when they spend less than 30 minutes on-site during a calendar day. Set 0 to disable. */
  pro_inactive_penalty_rdm: number;
  /** RDM for free-trial onboarding checklist (claim on completion) */
  free_trial_checklist_reward_rdm: number;
  free_trial_daily_streak_reward_rdm: number;

  /** Days after invite timestamp in which a bulk-invited student must go paid for the per-student bonus */
  classroom_batch_paid_window_days: number;
  /** Minimum newly-invited emails in one batch for the flat classroom bulk-invite RDM */
  classroom_bulk_invite_min_students: number;
  /** One-time flat RDM when a classroom's first bulk invite batch reaches the minimum */
  classroom_bulk_invite_flat_rdm: number;
  /** RDM per bulk-invited student who goes paid within the batch window */
  classroom_batch_paid_bonus_rdm: number;

  /** Max topics a free-trial student can select on Magic Wall (admin always gets 5) */
  magic_wall_max_topics: number;
};

export const DEFAULT_RDM_CONFIG: RdmConfigParams = {
  referral_referrer_reward: 50,
  referral_referee_welcome: 25,
  referral_weekly_bonus_threshold: 5,
  referral_weekly_bonus_rdm: 100,
  referral_teacher_signup_reward: 500,
  referral_teacher_paid_bonus: 500,
  referral_teacher_paid_window_days: 30,

  challenge_5_win: 3,
  challenge_5_share: 2,
  challenge_10_win: 7,
  challenge_10_share: 3,
  challenge_20_win: 15,
  challenge_20_share: 5,
  challenge_50_win: 30,
  challenge_50_share: 20,

  refer_challenge_daily_rdm_cap: 50,

  redeem_practice_packs_from_rdm: 50,
  redeem_mock_tests_from_rdm: 100,
  redeem_analytics_pro_from_rdm: 200,
  redeem_edufund_entry_from_rdm: 500,

  play_dailydose_academic_rdm: 15,
  play_dailydose_funbrain_rdm: 10,
  play_dual_streak_7_rdm: 50,
  play_dual_streak_30_rdm: 200,
  study_streak_bonus_days: 90,
  study_streak_bonus_rdm: 500,
  play_dailydose_min_questions_for_rdm: 10,

  subtopic_quiz_advanced_rdm: 15,
  subtopic_numerals_pack_rdm: 20,
  quiz_community_share_rdm: 5,
  numerals_community_share_rdm: 5,

  gyan_post_rdm: 5,
  gyan_comment_rdm: 5,
  gyan_upvote_rdm: 2,
  gyan_save_rdm: 3,
  gyan_teacher_answer_rdm: 5,

  free_trial_welcome_rdm: 500,
  free_trial_inactive_penalty_rdm: 50,
  free_inactive_penalty_rdm: 50,
  starter_inactive_penalty_rdm: 50,
  pro_inactive_penalty_rdm: 25,
  free_trial_checklist_reward_rdm: 100,
  free_trial_daily_streak_reward_rdm: 80,

  classroom_bulk_invite_min_students: 20,
  classroom_bulk_invite_flat_rdm: 5000,
  classroom_batch_paid_bonus_rdm: 100,
  classroom_batch_paid_window_days: 7,

  magic_wall_max_topics: 3,
};

const RDM_CONFIG_KEYS = Object.keys(DEFAULT_RDM_CONFIG) as (keyof RdmConfigParams)[];

/** Matches SQL clamp in submit_daily_gauntlet for play_dailydose_min_questions_for_rdm */
export function clampPlayDailydoseQuestionCount(raw: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return DEFAULT_RDM_CONFIG.play_dailydose_min_questions_for_rdm;
  return Math.max(1, Math.min(50, n));
}

/** Avoids pointless parent re-renders when Supabase returns the same numbers. */
export function rdmConfigShallowEqual(a: RdmConfigParams, b: RdmConfigParams): boolean {
  for (const k of RDM_CONFIG_KEYS) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/**
 * Fetches dynamic RDM configuration from `rdm_config` table.
 * Falls back to DEFAULT_RDM_CONFIG if table is uninitialized or missing keys.
 *
 * Works on both client-side and server-side (if using an authenticated client or service role).
 * For strictly unauthenticated server components where `supabase` client from `client.ts` might fail,
 * you can pass an instantiated `SupabaseClient`.
 */
type RdmConfigQueryResult = {
  data: Array<{ key: string; value: number | null }> | null;
  error: unknown;
};

/**
 * Supabase `PostgrestFilterBuilder` is Thenable (not typed as `Promise`), so use `PromiseLike`
 * so both browser and server clients assign cleanly.
 */
type RdmConfigClient = {
  from: (table: "rdm_config") => {
    select: (columns: "key, value") => PromiseLike<RdmConfigQueryResult>;
  };
};

export async function fetchRdmConfig(customClient?: RdmConfigClient): Promise<RdmConfigParams> {
  try {
    if (customClient) {
      const { data, error } = await customClient.from("rdm_config").select("key, value");
      if (error || !data) return DEFAULT_RDM_CONFIG;

      const conf: Record<string, number> = { ...DEFAULT_RDM_CONFIG };
      for (const row of data) {
        if (typeof row.value === "number") {
          conf[row.key] = row.value;
        }
      }
      return conf as RdmConfigParams;
    }

    const { data, error } = await supabase.from("rdm_config").select("key, value");
    if (error || !data) return DEFAULT_RDM_CONFIG;

    const conf: Record<string, number> = { ...DEFAULT_RDM_CONFIG };
    for (const row of data) {
      if (typeof row.value === "number") {
        conf[row.key] = row.value;
      }
    }
    return conf as RdmConfigParams;
  } catch {
    return DEFAULT_RDM_CONFIG;
  }
}
