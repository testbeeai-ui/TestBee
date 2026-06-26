import {
  type OnboardingRewardTaskData,
  getOnboardingRewardTaskData,
} from "@/lib/onboarding/onboardingRewardTasksData";
import {
  SITE_TOUR_CAROUSEL_TASK_ORDER,
  getOnboardingTaskRdmReward,
} from "@/lib/onboarding/onboardingChecklistRdm";
import { SITE_TOUR_CAROUSEL_ONLY_TASKS } from "@/lib/onboarding/siteTourCarouselOnlyTasks";

export type SiteTourSlideTheme = {
  pillId: string;
  ico: string;
  c: string;
  bg: string;
  bd: string;
};

export type SiteTourOnboardingSlide = OnboardingRewardTaskData & {
  theme: SiteTourSlideTheme;
  rdmReward: number;
};

const SLIDE_THEMES: Record<string, SiteTourSlideTheme> = {
  dashboard: {
    pillId: "dashboard",
    ico: "ti-layout-dashboard",
    c: "#378ADD",
    bg: "#0D1E30",
    bd: "#378ADD",
  },
  magic_wall: {
    pillId: "magic_wall",
    ico: "ti-magic-wand",
    c: "#7F77DD",
    bg: "#171425",
    bd: "#7F77DD",
  },
  lessons: {
    pillId: "lessons",
    ico: "ti-books",
    c: "#1D9E75",
    bg: "#0A2A20",
    bd: "#1D9E75",
  },
  prep_mock: {
    pillId: "prep",
    ico: "ti-school",
    c: "#378ADD",
    bg: "#0D1E30",
    bd: "#378ADD",
  },
  prep_classes: {
    pillId: "prep",
    ico: "ti-school",
    c: "#378ADD",
    bg: "#0D1E30",
    bd: "#378ADD",
  },
  prep_mcq: {
    pillId: "prep",
    ico: "ti-clipboard-list",
    c: "#378ADD",
    bg: "#0D1E30",
    bd: "#378ADD",
  },
  gyan_plus: {
    pillId: "gyan_plus",
    ico: "ti-message-circle",
    c: "#EF9F27",
    bg: "#281C08",
    bd: "#EF9F27",
  },
  earn_buddy: {
    pillId: "earn",
    ico: "ti-users",
    c: "#EF9F27",
    bg: "#281C08",
    bd: "#EF9F27",
  },
  earn_challenge: {
    pillId: "earn",
    ico: "ti-bolt",
    c: "#EF9F27",
    bg: "#281C08",
    bd: "#EF9F27",
  },
  news_blog: {
    pillId: "news_blog",
    ico: "ti-news",
    c: "#85B7EB",
    bg: "#0D1E30",
    bd: "#85B7EB",
  },
  edufund: {
    pillId: "edufund",
    ico: "ti-heart",
    c: "#1D9E75",
    bg: "#0A2A20",
    bd: "#1D9E75",
  },
  profile: {
    pillId: "profile",
    ico: "ti-user",
    c: "#378ADD",
    bg: "#0D1E30",
    bd: "#378ADD",
  },
  rdm_wallet: {
    pillId: "rdm",
    ico: "ti-coin",
    c: "#EF9F27",
    bg: "#281C08",
    bd: "#EF9F27",
  },
};

function resolveSiteTourTaskData(taskId: string): OnboardingRewardTaskData | undefined {
  return SITE_TOUR_CAROUSEL_ONLY_TASKS[taskId] ?? getOnboardingRewardTaskData(taskId);
}

function buildSiteTourSlide(taskId: string): SiteTourOnboardingSlide | undefined {
  const task = resolveSiteTourTaskData(taskId);
  if (!task) return undefined;
  return {
    ...task,
    rdmReward: getOnboardingTaskRdmReward(taskId),
    theme: SLIDE_THEMES[taskId] ?? {
      pillId: taskId,
      ico: "ti-circle",
      c: "#378ADD",
      bg: "#0D1E30",
      bd: "#378ADD",
    },
  };
}

export const SITE_TOUR_ONBOARDING_SLIDES: SiteTourOnboardingSlide[] =
  SITE_TOUR_CAROUSEL_TASK_ORDER.flatMap((taskId) => {
    const slide = buildSiteTourSlide(taskId);
    return slide ? [slide] : [];
  });

export const SITE_TOUR_ONBOARDING_TOTAL_STEPS = SITE_TOUR_ONBOARDING_SLIDES.length;

export function getSiteTourOnboardingSlide(index: number): SiteTourOnboardingSlide | undefined {
  return SITE_TOUR_ONBOARDING_SLIDES[index];
}

export function siteTourIndexForTaskId(taskId: string): number {
  return SITE_TOUR_ONBOARDING_SLIDES.findIndex((s) => s.id === taskId);
}

export function getSiteTourSlideRdmReward(taskId: string): number {
  return getOnboardingTaskRdmReward(taskId);
}

/** @deprecated Use getSiteTourSlideRdmReward(slideId) — slides have uneven RDM splits. */
export function siteTourPerTaskRewardRdm(checklistRewardRdm: number): number {
  if (SITE_TOUR_ONBOARDING_TOTAL_STEPS <= 0) return 10;
  return Math.max(1, Math.round(checklistRewardRdm / SITE_TOUR_ONBOARDING_TOTAL_STEPS));
}

export function siteTourPerTaskRewardRdmForSlide(slideId: string): number {
  return getOnboardingTaskRdmReward(slideId);
}

export function getSiteTourTaskDisplayData(taskId: string): OnboardingRewardTaskData | undefined {
  return resolveSiteTourTaskData(taskId);
}
