import { ONBOARDING_REWARD_TASK_IDS } from "@/lib/subscription/onboardingRewardConstants";

/** One-time Day-1 checklist payout (must match `free_trial_checklist_reward_rdm`). */
export const ONBOARDING_CHECKLIST_TOTAL_RDM = 100;

/** Shown on tour completion — part of the +100 lump sum at claim. */
export const ONBOARDING_CHECKLIST_COMPLETION_BONUS_RDM = 10;

/** Per-task RDM breakdown for the site tour (sums to 95; +10 completion bonus = 100). */
export const ONBOARDING_TASK_RDM_REWARDS: Record<string, number> = {
  dashboard: 10,
  magic_wall: 10,
  lessons: 10,
  prep_mock: 10,
  prep_classes: 5,
  prep_mcq: 5,
  gyan_plus: 5,
  earn_buddy: 10,
  earn_challenge: 10,
  news_blog: 10,
  edufund: 5,
  profile: 5,
  rdm_wallet: 5,
};

/** Carousel-only slides — OK after reading; no server task check. */
export const SITE_TOUR_INFO_SLIDE_IDS = new Set<string>(["dashboard", "rdm_wallet"]);

/** Merged Prep + Mock slide (server tracks `prep_classes` + `prep_mcq` separately). */
export const SITE_TOUR_PREP_MOCK_SLIDE_ID = "prep_mock";

/** Carousel slide order (11 sections + completion bonus). */
export const SITE_TOUR_CAROUSEL_TASK_ORDER = [
  "dashboard",
  "magic_wall",
  "lessons",
  SITE_TOUR_PREP_MOCK_SLIDE_ID,
  "gyan_plus",
  "earn_buddy",
  "earn_challenge",
  "news_blog",
  "edufund",
  "profile",
  "rdm_wallet",
] as const;

export const ONBOARDING_SERVER_CHECKLIST_TASK_COUNT = ONBOARDING_REWARD_TASK_IDS.length;

export function getOnboardingTaskRdmReward(taskId: string): number {
  return ONBOARDING_TASK_RDM_REWARDS[taskId] ?? 0;
}

export function sumSiteTourSlideRdmRewards(doneSlideIds: Iterable<string>): number {
  let total = 0;
  for (const id of doneSlideIds) {
    total += getOnboardingTaskRdmReward(id);
  }
  return total;
}

export function siteTourCarouselSlidesRdmSubtotal(): number {
  return SITE_TOUR_CAROUSEL_TASK_ORDER.reduce(
    (sum, id) => sum + getOnboardingTaskRdmReward(id),
    0
  );
}
