import {
  DEFAULT_RDM_CONFIG,
  type RdmConfigParams,
} from "@/lib/rdm/rdmConfig";
import type { WalletGuide } from "@/lib/rdm/walletGuideTypes";

/** Defaults when keys are not in `RdmConfigParams` (still live in `rdm_config`). */
export const DEFAULT_STUDENT_WALLET_EXTRA_RDM = {
  siteTourRewardRdm: 100,
  mockScoreBonusRdm: 50,
  mockCommunityShareRdm: 40,
  cbseMcqWinRdm: 5,
  cbseMcqCommunityShareRdm: 10,
} as const;

export type StudentWalletGuideInput = {
  config?: RdmConfigParams;
  extras?: Partial<typeof DEFAULT_STUDENT_WALLET_EXTRA_RDM>;
};

export function buildStudentWalletGuide(
  input: StudentWalletGuideInput = {}
): WalletGuide {
  const c = input.config ?? DEFAULT_RDM_CONFIG;
  const x = { ...DEFAULT_STUDENT_WALLET_EXTRA_RDM, ...input.extras };

  const earn = [
    { label: "Play · DailyDose academic", value: `+${c.play_dailydose_academic_rdm}` },
    { label: "Play · DailyDose funbrain", value: `+${c.play_dailydose_funbrain_rdm}` },
    { label: "Play · 7-day dual streak", value: `+${c.play_dual_streak_7_rdm}` },
    { label: "Play · 30-day dual streak", value: `+${c.play_dual_streak_30_rdm}` },
    {
      label: `Study streak (${c.study_streak_bonus_days} days)`,
      value: `+${c.study_streak_bonus_rdm}`,
    },
    { label: "Gyan++ · ask", value: `+${c.gyan_post_rdm}` },
    { label: "Gyan++ · comment", value: `+${c.gyan_comment_rdm}` },
    { label: "Gyan++ · upvote", value: `+${c.gyan_upvote_rdm}` },
    { label: "Gyan++ · save for revision", value: `+${c.gyan_save_rdm}` },
    { label: "Lessons · advanced quiz", value: `+${c.subtopic_quiz_advanced_rdm}` },
    { label: "Lessons · numerals pack", value: `+${c.subtopic_numerals_pack_rdm}` },
    {
      label: "Lessons · community share",
      value: `+${c.quiz_community_share_rdm} / +${c.numerals_community_share_rdm}`,
    },
    { label: "Mock test · score bonus (≥60%)", value: `+${x.mockScoreBonusRdm}` },
    { label: "Mock test · community share", value: `+${x.mockCommunityShareRdm}` },
    { label: "Prep library · chapter quiz", value: `+${x.cbseMcqWinRdm}` },
    { label: "Prep library · community share", value: `+${x.cbseMcqCommunityShareRdm}` },
    { label: "Refer a friend", value: `+${c.referral_referrer_reward}` },
    { label: "Joined via referral", value: `+${c.referral_referee_welcome}` },
    {
      label: `Referral weekly bonus (${c.referral_weekly_bonus_threshold}+)`,
      value: `+${c.referral_weekly_bonus_rdm}`,
    },
    {
      label: "Earn & Learn · challenge win",
      value: `+${c.challenge_5_win}–${c.challenge_50_win}`,
    },
    {
      label: "Earn & Learn · challenge share",
      value: `+${c.challenge_5_share}–${c.challenge_50_share}`,
    },
    { label: "Free trial welcome", value: `+${c.free_trial_welcome_rdm}` },
    { label: "Onboarding checklist", value: `+${c.free_trial_checklist_reward_rdm}` },
    {
      label: "Trial daily tasks (day 2–10)",
      value: `+${c.free_trial_daily_streak_reward_rdm}`,
    },
    { label: "Site tour complete", value: `+${x.siteTourRewardRdm}` },
    { label: "Teacher · assignment completion", value: "Teacher sets amount" },
    { label: "Teacher · nudge bonus", value: "Teacher sets amount" },
    { label: "Teacher · recognition", value: "Teacher sets amount" },
  ];

  const spend = [
    { label: "Inactive day · free trial", value: `−${c.free_trial_inactive_penalty_rdm}` },
    { label: "Inactive day · free plan", value: `−${c.free_inactive_penalty_rdm}` },
    { label: "Inactive day · Starter", value: `−${c.starter_inactive_penalty_rdm}` },
    { label: "Inactive day · Pro", value: `−${c.pro_inactive_penalty_rdm}` },
  ].filter((row) => {
    const n = Number.parseInt(row.value.replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) && n > 0;
  });

  const notes = [
    `Effective EduFund RDM = balance × your subscription multiplier (EduFund page) · Refer challenges capped at ${c.refer_challenge_daily_rdm_cap} RDM per UTC day (win + share) · Full history: Profile → Activity track record · Higher multiplier: Profile → Subscriptions.`,
  ];

  return { earn, spend, notes };
}
