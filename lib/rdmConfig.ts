import { supabase } from "@/integrations/supabase/client";

export type RdmConfigParams = {
  referral_referrer_reward: number;
  referral_referee_welcome: number;
  referral_weekly_bonus_threshold: number;
  referral_weekly_bonus_rdm: number;

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
  /** Min questions in submit payload to award DailyDose RDM; keep in sync with question fetch */
  play_dailydose_min_questions_for_rdm: number;

  /** Lessons subtopic: advanced 3-set quiz daily RDM (claim_topic_quiz_advanced_daily_rdm) */
  subtopic_quiz_advanced_rdm: number;
  /** Lessons subtopic: numerals pack complete daily RDM (claim_numerals_pack_complete_daily_rdm) */
  subtopic_numerals_pack_rdm: number;

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
};

export const DEFAULT_RDM_CONFIG: RdmConfigParams = {
  referral_referrer_reward: 50,
  referral_referee_welcome: 25,
  referral_weekly_bonus_threshold: 5,
  referral_weekly_bonus_rdm: 100,

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
  play_dailydose_min_questions_for_rdm: 10,

  subtopic_quiz_advanced_rdm: 15,
  subtopic_numerals_pack_rdm: 20,

  gyan_post_rdm: 5,
  gyan_comment_rdm: 5,
  gyan_upvote_rdm: 2,
  gyan_save_rdm: 3,
  gyan_teacher_answer_rdm: 30,
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
