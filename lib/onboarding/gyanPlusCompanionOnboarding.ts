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
  GYAN_PLUS_TASK_ID,
  tryCompleteGyanPlusChecklistFromSubsteps,
} from "@/lib/onboarding/gyanPlusOnboarding";
import {
  clearOnboardingStepComplete,
  getOnboardingProgress,
  isAdminManualOnboardingChecklist,
  markOnboardingStepComplete,
  markOnboardingTaskComplete,
} from "@/lib/subscription/freeTrialClient";

const TASK_ID = GYAN_PLUS_TASK_ID;

export const GYAN_PLUS_BROWSE_DURATION_MS = 60_000;
export const GYAN_BROWSE_TIMER_EVENT = "edublast-gyan-browse-timer-tick";

const BROWSE_STARTED_AT_KEY = "edublast.onboarding_gyan_browse_started_at_v1";
const BROWSE_SESSION_KEY = "edublast.onboarding_gyan_companion_browse_v1";
const UPVOTE_SESSION_KEY = "edublast.onboarding_gyan_companion_upvote_v1";
const POST_SESSION_KEY = "edublast.onboarding_gyan_companion_post_v1";
const COMMENT_SESSION_KEY = "edublast.onboarding_gyan_companion_comment_v1";

function stepKey(index: number): string {
  return `${TASK_ID}_step_${index}`;
}

function canTrack(): boolean {
  return typeof window !== "undefined";
}

export function isGyanPlusCompanionTrackingActive(): boolean {
  return canTrack() && isOnboardingTaskCompanionLaunched(TASK_ID);
}

export type GyanBrowseTimerSnapshot = {
  secondsLeft: number;
  totalSeconds: number;
  running: boolean;
  done: boolean;
  notStarted: boolean;
  progressPct: number;
};

export function formatGyanBrowseCountdown(secondsLeft: number): string {
  const s = Math.max(0, Math.ceil(secondsLeft));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function getGyanPlusBrowseCountdownSnapshot(): GyanBrowseTimerSnapshot {
  const totalSeconds = Math.round(GYAN_PLUS_BROWSE_DURATION_MS / 1000);
  if (hasSessionFlag(BROWSE_SESSION_KEY)) {
    return {
      secondsLeft: 0,
      totalSeconds,
      running: false,
      done: true,
      notStarted: false,
      progressPct: 100,
    };
  }
  const raw =
    typeof window !== "undefined" ? window.sessionStorage.getItem(BROWSE_STARTED_AT_KEY) : null;
  if (!raw) {
    return {
      secondsLeft: totalSeconds,
      totalSeconds,
      running: false,
      done: false,
      notStarted: true,
      progressPct: 0,
    };
  }
  const started = parseInt(raw, 10);
  if (Number.isNaN(started)) {
    return {
      secondsLeft: totalSeconds,
      totalSeconds,
      running: false,
      done: false,
      notStarted: true,
      progressPct: 0,
    };
  }
  const elapsed = Date.now() - started;
  const remainingMs = Math.max(0, GYAN_PLUS_BROWSE_DURATION_MS - elapsed);
  const secondsLeft = Math.ceil(remainingMs / 1000);
  const progressPct = Math.min(100, Math.round((elapsed / GYAN_PLUS_BROWSE_DURATION_MS) * 100));
  return {
    secondsLeft,
    totalSeconds,
    running: remainingMs > 0,
    done: remainingMs <= 0,
    notStarted: false,
    progressPct,
  };
}

function dispatchBrowseTimerTick(snapshot: GyanBrowseTimerSnapshot): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(GYAN_BROWSE_TIMER_EVENT, { detail: snapshot }));
}

/** Call when user lands on /doubts during Gyan++ companion flow. */
export function startGyanPlusBrowseCountdown(): void {
  if (!isGyanPlusCompanionTrackingActive()) return;
  if (hasSessionFlag(BROWSE_SESSION_KEY)) return;
  if (typeof window === "undefined") return;
  if (!window.sessionStorage.getItem(BROWSE_STARTED_AT_KEY)) {
    window.sessionStorage.setItem(BROWSE_STARTED_AT_KEY, String(Date.now()));
  }
  dispatchBrowseTimerTick(getGyanPlusBrowseCountdownSnapshot());
}

/** Tick once per second; returns true when browse step just completed. */
export function tickGyanPlusBrowseCountdown(): boolean {
  const snapshot = getGyanPlusBrowseCountdownSnapshot();
  dispatchBrowseTimerTick(snapshot);
  if (snapshot.done && !hasSessionFlag(BROWSE_SESSION_KEY)) {
    markGyanPlusCompanionBrowse();
    return true;
  }
  return false;
}

function setSessionFlag(key: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, "1");
}

function hasSessionFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(key) === "1";
}

function syncStep(index: number, shouldComplete: boolean): void {
  if (!isGyanPlusCompanionTrackingActive()) return;
  const key = stepKey(index);
  const progress = getOnboardingProgress();
  if (shouldComplete && !progress[key]) {
    markOnboardingStepComplete(TASK_ID, index);
  } else if (!shouldComplete && progress[key]) {
    clearOnboardingStepComplete(TASK_ID, index);
  }
}

function maybeCompleteGyanPlusTask(): void {
  if (!isGyanPlusCompanionTrackingActive()) return;
  const progress = getOnboardingProgress();
  if (progress[TASK_ID]) return;
  if (![0, 1, 2, 3].every((i) => progress[stepKey(i)])) return;

  markOnboardingTaskComplete(TASK_ID, {
    toastActionLine: "You explored Gyan++!",
    showChecklistToast: true,
  });
  tryCompleteGyanPlusChecklistFromSubsteps();

  if (isDailyChecklistCompanionRetryActive(TASK_ID)) {
    const credited = completeDailyStreakTaskFlow("t4");
    if (credited) {
      clearDailyChecklistCompanionRetry();
      window.setTimeout(() => dispatchDailyChecklistReopen("t4"), 5000);
    }
  }
}

/** Step 0 — browsed the doubt wall (~1 min timer on /doubts). */
export function markGyanPlusCompanionBrowse(): void {
  setSessionFlag(BROWSE_SESSION_KEY);
  syncStep(0, true);
  maybeCompleteGyanPlusTask();
}

/** Step 1 — upvoted a doubt or answer. */
export function markGyanPlusCompanionUpvote(): void {
  setSessionFlag(UPVOTE_SESSION_KEY);
  syncStep(1, true);
  maybeCompleteGyanPlusTask();
}

/** Step 2 — posted a new doubt. */
export function markGyanPlusCompanionPost(): void {
  setSessionFlag(POST_SESSION_KEY);
  syncStep(2, true);
  maybeCompleteGyanPlusTask();
}

/** Step 3 — commented on a doubt thread. */
export function markGyanPlusCompanionComment(): void {
  setSessionFlag(COMMENT_SESSION_KEY);
  syncStep(3, true);
  maybeCompleteGyanPlusTask();
}

/** Drop mistaken companion ticks (e.g. from old click listeners). */
export function reconcileGyanPlusCompanionSteps(): void {
  if (!isGyanPlusCompanionTrackingActive()) return;

  syncStep(0, hasSessionFlag(BROWSE_SESSION_KEY));
  syncStep(1, hasSessionFlag(UPVOTE_SESSION_KEY));
  syncStep(2, hasSessionFlag(POST_SESSION_KEY));
  syncStep(3, hasSessionFlag(COMMENT_SESSION_KEY));

  maybeCompleteGyanPlusTask();
}
