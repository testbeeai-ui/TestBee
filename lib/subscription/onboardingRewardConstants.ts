/** Keep in sync with `ONBOARDING_REWARD_TASKS` in `lib/onboarding/onboardingRewardTasks.ts` and SQL `_free_trial_onboarding_task_ids`. */
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

/** All keys merged when the Day-1 site tour / carousel marks every checklist row complete. */
export const ONBOARDING_SITE_TOUR_BULK_MERGE_IDS = [
  ...ONBOARDING_REWARD_TASK_IDS,
  ...ONBOARDING_GYAN_PLUS_SUBSTEP_IDS,
] as const;

/** True when a bulk merge is crediting the full Day-1 site-tour checklist (carousel or demo). */
export function isFullSiteTourProgressBulkMerge(keys: readonly string[]): boolean {
  const markSet = new Set(keys);
  return ONBOARDING_SITE_TOUR_BULK_MERGE_IDS.every((id) => markSet.has(id));
}
