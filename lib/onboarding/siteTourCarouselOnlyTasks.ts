import type { OnboardingRewardTaskData } from "@/lib/onboarding/onboardingRewardTasksData";
import {
  SITE_TOUR_DASHBOARD_INFO,
  SITE_TOUR_RDM_WALLET_INFO,
} from "@/lib/onboarding/siteTourInfoSlideContent";

/** Carousel-only copy (not separate server checklist rows). */
export const SITE_TOUR_CAROUSEL_ONLY_TASKS: Record<string, OnboardingRewardTaskData> = {
  dashboard: {
    id: "dashboard",
    title: "Dashboard",
    boardTitle: "Dashboard",
    teaser: SITE_TOUR_DASHBOARD_INFO.menuDesc,
    time: "~1 min read",
    steps: [],
    hints: ["Tour your Dashboard home screen"],
    href: "/home",
    color: "teal",
  },
  prep_mock: {
    id: "prep_mock",
    title: "Prep + Mock",
    boardTitle: "Prep + Mock",
    teaser: "Classes intro video + one CBSE MCQ quiz (same hub)",
    time: "~6 min",
    steps: [
      "Open Prep + Mock — Classes and Mock tests live on the same hub.",
      "Classes: go to Classrooms → open a class → watch the intro video on Home.",
      "Mock tests: Mock tests card → View all → CBSE MCQ's tab.",
      "Pick any chapter quiz, attempt it, and read one answer explanation.",
    ],
    hints: ["Classes + Mock tests on the Prep + Mock hub"],
    href: "/mock",
    color: "purple",
  },
  rdm_wallet: {
    id: "rdm_wallet",
    title: "RDM Wallet",
    boardTitle: "RDM Wallet",
    teaser: SITE_TOUR_RDM_WALLET_INFO.menuDesc,
    time: "~1 min read",
    steps: [],
    hints: ["Read about RDM before you claim the checklist reward"],
    href: "/profile?section=activity",
    color: "amber",
  },
};
