import { isOnboardingTaskCompanionLaunched } from "@/lib/onboarding/onboardingTaskCompanion";
import { isEarnChallengeOnboardingPickKey } from "@/lib/onboarding/earnChallengeOnboardingFlow";
import {
  completeDailyStreakTaskFlow,
  dispatchDailyChecklistReopen,
} from "@/lib/onboarding/dailyChecklistTaskStorage";
import {
  clearDailyChecklistCompanionRetry,
  isDailyChecklistCompanionRetryActive,
} from "@/lib/onboarding/dailyChecklistCompanionRetry";
import type { ReferClaimKey } from "@/lib/rdm/referral/referEarnChallenges";
import {
  clearOnboardingStepComplete,
  getOnboardingProgress,
  isAdminManualOnboardingChecklist,
  markOnboardingStepComplete,
  markOnboardingTaskComplete,
  unmarkOnboardingTask,
} from "@/lib/subscription/freeTrialClient";

const TASK_ID = "earn_challenge";

const SESSION_PICK_KEY = "edublast.onboarding_earn_challenge_companion_pick_v1";
const SESSION_START_KEY = "edublast.onboarding_earn_challenge_companion_start_v1";
const SESSION_COMPLETE_KEY = "edublast.onboarding_earn_challenge_companion_complete_v1";
const SESSION_COMMUNITY_KEY = "edublast.onboarding_earn_challenge_companion_community_v1";

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

export function isEarnChallengeCompanionTrackingActive(): boolean {
  return canTrack() && isOnboardingTaskCompanionLaunched(TASK_ID);
}

export function shouldShowEarnChallengeCompanionHints(): boolean {
  if (typeof window === "undefined") return false;
  if (isEarnChallengeCompanionTrackingActive()) return true;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("onboarding_earn_challenge") === "1";
  } catch {
    return false;
  }
}

/** Clears ephemeral session markers (persisted checklist keys in localStorage are unchanged). */
export function clearEarnChallengeCompanionSessionMarkers(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_PICK_KEY);
    window.sessionStorage.removeItem(SESSION_START_KEY);
    window.sessionStorage.removeItem(SESSION_COMPLETE_KEY);
    window.sessionStorage.removeItem(SESSION_COMMUNITY_KEY);
  } catch {
    /* ignore */
  }
}

/** Step 1 — Pick challenge card (removed from checklist steps; made a no-op to prevent compilation breaks). */
export function markEarnChallengeCompanionPicked(claimKey: ReferClaimKey): void {
  // Bypassed: first step is removed from the visible checklist
}

/** Step 1 — user tapped Start challenge. */
export function markEarnChallengeCompanionStarted(): void {
  if (!isEarnChallengeCompanionTrackingActive()) return;
  setSessionFlag(SESSION_START_KEY);
  markOnboardingStepComplete(TASK_ID, 0);
}

/** Step 2 — speed round ended (win or lose). */
export function markEarnChallengeCompanionRoundComplete(): void {
  if (!isEarnChallengeCompanionTrackingActive()) return;
  setSessionFlag(SESSION_COMPLETE_KEY);
  markOnboardingStepComplete(TASK_ID, 1);
}

/** Step 3 — posted to community (client) or verified on server. */
export function markEarnChallengeCompanionCommunityShared(): void {
  // Only mark when the companion is explicitly active for this task.
  // Using isEarnChallengeCompanionTrackingActive() instead of canTrack() prevents
  // old community posts from auto-completing step 3 for students who never started the task.
  if (!isEarnChallengeCompanionTrackingActive()) return;
  setSessionFlag(SESSION_COMMUNITY_KEY);
  markOnboardingStepComplete(TASK_ID, 2);
  maybeCompleteEarnChallengeTask();
}

function maybeCompleteEarnChallengeTask(): void {
  const progress = getOnboardingProgress();
  const allSteps =
    progress[`${TASK_ID}_step_0`] && progress[`${TASK_ID}_step_1`] && progress[`${TASK_ID}_step_2`];
  if (!allSteps || progress[TASK_ID]) return;
  markOnboardingTaskComplete(TASK_ID, { showChecklistToast: true });

  if (isDailyChecklistCompanionRetryActive(TASK_ID)) {
    const credited = completeDailyStreakTaskFlow("t5");
    if (credited) {
      clearDailyChecklistCompanionRetry();
      window.setTimeout(() => dispatchDailyChecklistReopen("t5"), 5000);
    }
  }
}

/**
 * Server: user has a refer_challenge row in lessons_raw_posts.
 *
 * IMPORTANT: Only reconcile if the user has actually started the earn_challenge task.
 * Without this guard, the 12s poll on /refer-earn would auto-complete the "Post to community"
 * step for any student who has an old challenge post in the DB — even before they ever
 * tapped the Challenge card in the checklist.
 */
export function reconcileEarnChallengeCompanionSteps(
  hasCommunityPost: boolean,
  activeReferClaim?: string | null
): void {
  if (typeof window === "undefined") return;

  // Only reconcile if user has actually engaged with earn_challenge:
  // (a) companion is explicitly active, OR
  // (b) admin manual mode, OR
  // (c) user already has step progress saved (they started it before)
  const companionActive = isEarnChallengeCompanionTrackingActive();
  const adminManual = isAdminManualOnboardingChecklist();
  const progress = getOnboardingProgress();
  const hasAnyStepProgress =
    Boolean(progress[`${TASK_ID}_step_0`]) ||
    Boolean(progress[`${TASK_ID}_step_1`]) ||
    Boolean(progress[`${TASK_ID}_step_2`]) ||
    Boolean(progress[TASK_ID]);

  if (!companionActive && !adminManual && !hasAnyStepProgress) return;

  // Auto-mark step 0 if they are currently playing in this session
  if (activeReferClaim) {
    if (!hasSessionFlag(SESSION_START_KEY)) {
      setSessionFlag(SESSION_START_KEY);
    }
    if (!progress[`${TASK_ID}_step_0`]) {
      markOnboardingStepComplete(TASK_ID, 0);
    }
  }

  if (hasCommunityPost) {
    if (!hasSessionFlag(SESSION_COMMUNITY_KEY)) setSessionFlag(SESSION_COMMUNITY_KEY);
    if (!progress[`${TASK_ID}_step_2`]) {
      markOnboardingStepComplete(TASK_ID, 2);
    }
    maybeCompleteEarnChallengeTask();
  } else if (progress[`${TASK_ID}_step_2`] && !hasSessionFlag(SESSION_COMMUNITY_KEY)) {
    clearOnboardingStepComplete(TASK_ID, 2);
    if (progress[TASK_ID]) {
      unmarkOnboardingTask(TASK_ID, { showChecklistToast: false });
    }
  } else if (
    progress[TASK_ID] &&
    (!progress[`${TASK_ID}_step_0`] ||
      !progress[`${TASK_ID}_step_1`] ||
      !progress[`${TASK_ID}_step_2`])
  ) {
    unmarkOnboardingTask(TASK_ID, { showChecklistToast: false });
  }
}
