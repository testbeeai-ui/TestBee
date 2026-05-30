/** Keep in sync with `ONBOARDING_REWARD_TASKS` in OnboardingRewardDialog.tsx and SQL `_free_trial_onboarding_task_ids`. */
export const ONBOARDING_REWARD_TASK_IDS = [
  "magic_wall",
  "lessons",
  "prep_classes",
  "prep_mcq",
  "gyan_plus",
  "earn_buddy",
  "earn_challenge",
  "news_blog",
  "edufund",
  "profile",
] as const;

/** Sub-steps for gyan_plus only — may exist in progress JSON but are not checklist rows. */
export const ONBOARDING_GYAN_PLUS_SUBSTEP_IDS = [
  "gyan_browse",
  "gyan_post",
  "gyan_engagement",
] as const;

export type OnboardingRewardTaskId = (typeof ONBOARDING_REWARD_TASK_IDS)[number];
