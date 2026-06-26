import { getLaunchedOnboardingTaskId } from "@/lib/onboarding/onboardingTaskCompanion";
import { isMainOnboardingTaskId } from "@/lib/onboarding/onboardingNextTask";
import { requestOpenSiteTourCarousel } from "@/lib/onboarding/openSiteTourCarousel";

const PENDING_TASK_KEY = "edublast.onboarding_site_tour_pending_task_v1";

/** Ref-count: topic quiz dialog open (defer site tour until all close). */
let quizUiBlockCount = 0;

/** If companion celebration never runs, still show the site tour. */
let pendingFallbackTimer: ReturnType<typeof setTimeout> | null = null;

const PENDING_FALLBACK_MS = 5_500;

function canUseSession(): boolean {
  return typeof window !== "undefined";
}

function clearPendingFallbackTimer(): void {
  if (pendingFallbackTimer != null) {
    clearTimeout(pendingFallbackTimer);
    pendingFallbackTimer = null;
  }
}

function dispatchSiteTourPromo(_taskId: string, _afterCompanionCelebration = false): void {
  if (typeof window === "undefined") return;
  clearPendingFallbackTimer();
  requestOpenSiteTourCarousel();
}

function schedulePendingFallback(): void {
  if (typeof window === "undefined") return;
  clearPendingFallbackTimer();
  pendingFallbackTimer = setTimeout(() => {
    pendingFallbackTimer = null;
    flushPendingOnboardingSiteTourPromo();
  }, PENDING_FALLBACK_MS);
}

function setPendingTaskId(taskId: string): void {
  if (!canUseSession()) return;
  try {
    window.sessionStorage.setItem(PENDING_TASK_KEY, taskId);
  } catch {
    /* ignore */
  }
}

function takePendingTaskId(): string | null {
  if (!canUseSession()) return null;
  try {
    const id = window.sessionStorage.getItem(PENDING_TASK_KEY);
    if (id) {
      window.sessionStorage.removeItem(PENDING_TASK_KEY);
      clearPendingFallbackTimer();
    }
    return id;
  } catch {
    return null;
  }
}

export function isOnboardingSiteTourPromoBlocked(): boolean {
  return quizUiBlockCount > 0;
}

/** Call when the topic quiz dialog opens (increments block). */
export function enterOnboardingSiteTourQuizUiBlock(): void {
  quizUiBlockCount += 1;
}

/** Call when the topic quiz dialog closes (decrements block; may flush pending promo). */
export function exitOnboardingSiteTourQuizUiBlock(): void {
  quizUiBlockCount = Math.max(0, quizUiBlockCount - 1);
  flushPendingOnboardingSiteTourPromo();
}

/**
 * Re-open the full site-tour checklist after a main task completes.
 * Defers while the learner has the topic quiz dialog open.
 */
export function requestOnboardingSiteTourAfterTask(taskId: string): void {
  if (typeof window === "undefined" || !taskId || !isMainOnboardingTaskId(taskId)) return;

  if (isOnboardingSiteTourPromoBlocked()) {
    setPendingTaskId(taskId);
    schedulePendingFallback();
    return;
  }

  const launchedId = getLaunchedOnboardingTaskId();
  if (launchedId === taskId) {
    setPendingTaskId(taskId);
    schedulePendingFallback();
    return;
  }

  dispatchSiteTourPromo(taskId);
}

/** Show a deferred site-tour promo after quiz UI closes or companion celebration ends. */
export function flushPendingOnboardingSiteTourPromo(): void {
  if (isOnboardingSiteTourPromoBlocked()) return;
  const pending = takePendingTaskId();
  if (!pending) return;
  dispatchSiteTourPromo(pending, true);
}
