import { isOnboardingTaskCompanionLaunched } from "@/lib/onboarding/onboardingTaskCompanion";
import {
  completeDailyStreakTaskFlow,
  dispatchDailyChecklistReopen,
} from "@/lib/onboarding/dailyChecklistTaskStorage";
import {
  clearDailyChecklistCompanionRetry,
  isDailyChecklistCompanionRetryActive,
} from "@/lib/onboarding/dailyChecklistCompanionRetry";
import {
  clearOnboardingStepComplete,
  getOnboardingProgress,
  isAdminManualOnboardingChecklist,
  markOnboardingStepComplete,
  markOnboardingTaskComplete,
  unmarkOnboardingTask,
} from "@/lib/subscription/freeTrialClient";

const TASK_ID = "news_blog";

const SESSION_LIST_KEY = "edublast.onboarding_news_blog_list_v1";
const SESSION_ARTICLE_KEY = "edublast.onboarding_news_blog_article_v1";
const SESSION_READ_KEY = "edublast.onboarding_news_blog_read_v1";
const SESSION_DONE_KEY = "edublast.onboarding_news_blog_done_v1";

function progressStepDone(index: number): boolean {
  return Boolean(getOnboardingProgress()[`${TASK_ID}_step_${index}`]);
}

/** Clear ephemeral session markers when starting a Day-2+ daily retry. */
export function clearNewsBlogCompanionSessionMarkers(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_LIST_KEY);
  window.sessionStorage.removeItem(SESSION_ARTICLE_KEY);
  window.sessionStorage.removeItem(SESSION_READ_KEY);
  window.sessionStorage.removeItem(SESSION_DONE_KEY);
}

function canTrack(): boolean {
  return typeof window !== "undefined";
}

function hasSessionFlag(key: string): boolean {
  return typeof window !== "undefined" && window.sessionStorage.getItem(key) === "1";
}

function setSessionFlag(key: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, "1");
}

export function isNewsBlogCompanionTrackingActive(): boolean {
  return canTrack() && isOnboardingTaskCompanionLaunched(TASK_ID);
}

/** Step 1 — opened News & Blogs hub (/news-blog). */
export function markNewsBlogCompanionListOpened(): void {
  if (!isNewsBlogCompanionTrackingActive()) return;
  if (!hasSessionFlag(SESSION_LIST_KEY)) {
    setSessionFlag(SESSION_LIST_KEY);
  }
  if (!progressStepDone(0)) {
    markOnboardingStepComplete(TASK_ID, 0);
  }
}

/** Step 2 — opened any article (/news-blog/[slug]). */
export function markNewsBlogCompanionArticleOpened(): void {
  if (!isNewsBlogCompanionTrackingActive()) return;
  if (!hasSessionFlag(SESSION_LIST_KEY)) {
    markNewsBlogCompanionListOpened();
  }
  if (!hasSessionFlag(SESSION_ARTICLE_KEY)) {
    setSessionFlag(SESSION_ARTICLE_KEY);
  }
  if (!progressStepDone(1)) {
    markOnboardingStepComplete(TASK_ID, 1);
  }
}

/** Step 3 — scrolled through the article (read). */
export function markNewsBlogCompanionArticleRead(): void {
  if (!isNewsBlogCompanionTrackingActive()) return;
  if (!hasSessionFlag(SESSION_READ_KEY)) {
    setSessionFlag(SESSION_READ_KEY);
  }
  if (!progressStepDone(2)) {
    markOnboardingStepComplete(TASK_ID, 2);
  }
}

/** Step 4 + checklist row — finished reading (ready to return to board). */
export function markNewsBlogCompanionFlowComplete(): void {
  if (!canTrack()) return;
  if (!hasSessionFlag(SESSION_READ_KEY)) return;
  if (!hasSessionFlag(SESSION_DONE_KEY)) {
    setSessionFlag(SESSION_DONE_KEY);
  }
  if (!progressStepDone(3)) {
    markOnboardingStepComplete(TASK_ID, 3);
  }
  maybeCompleteNewsBlogTask();
}

function maybeCompleteNewsBlogTask(): void {
  const progress = getOnboardingProgress();
  const allSteps =
    progress[`${TASK_ID}_step_0`] &&
    progress[`${TASK_ID}_step_1`] &&
    progress[`${TASK_ID}_step_2`] &&
    progress[`${TASK_ID}_step_3`];
  if (!allSteps || progress[TASK_ID]) return;
  markOnboardingTaskComplete(TASK_ID, { showChecklistToast: true });

  if (isDailyChecklistCompanionRetryActive(TASK_ID)) {
    const credited = completeDailyStreakTaskFlow("t6");
    if (credited) {
      clearDailyChecklistCompanionRetry();
      window.setTimeout(() => dispatchDailyChecklistReopen("t6"), 5000);
    }
  }
}

/** Clear mistaken ticks from old scroll/click heuristics. */
export function reconcileNewsBlogCompanionSteps(): void {
  if (!canTrack()) return;
  const progress = getOnboardingProgress();

  if (progress[`${TASK_ID}_step_0`] && !hasSessionFlag(SESSION_LIST_KEY)) {
    clearOnboardingStepComplete(TASK_ID, 0);
  }
  if (progress[`${TASK_ID}_step_1`] && !hasSessionFlag(SESSION_ARTICLE_KEY)) {
    clearOnboardingStepComplete(TASK_ID, 1);
  }
  if (progress[`${TASK_ID}_step_2`] && !hasSessionFlag(SESSION_READ_KEY)) {
    clearOnboardingStepComplete(TASK_ID, 2);
  }
  if (progress[`${TASK_ID}_step_3`] && !hasSessionFlag(SESSION_DONE_KEY)) {
    clearOnboardingStepComplete(TASK_ID, 3);
  }

  if (
    hasSessionFlag(SESSION_READ_KEY) &&
    hasSessionFlag(SESSION_ARTICLE_KEY) &&
    hasSessionFlag(SESSION_LIST_KEY)
  ) {
    if (!progress[`${TASK_ID}_step_3`]) {
      setSessionFlag(SESSION_DONE_KEY);
      markOnboardingStepComplete(TASK_ID, 3);
    }
    maybeCompleteNewsBlogTask();
  } else if (progress[TASK_ID] && !hasSessionFlag(SESSION_DONE_KEY)) {
    unmarkOnboardingTask(TASK_ID, { showChecklistToast: false });
  }
}
