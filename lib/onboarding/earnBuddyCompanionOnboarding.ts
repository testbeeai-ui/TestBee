import { isOnboardingTaskCompanionLaunched } from "@/lib/onboarding/onboardingTaskCompanion";

import type { EarnBuddyOnboardingStatus } from "@/lib/onboarding/earnBuddyCompanionApi";

import {
  clearOnboardingStepComplete,
  clearOnboardingTaskCompleteForStudent,
  getOnboardingProgress,
  isAdminManualOnboardingChecklist,
  markOnboardingStepComplete,
  markOnboardingTaskComplete,
} from "@/lib/subscription/freeTrialClient";

const TASK_ID = "earn_buddy";

const SESSION_TAB_KEY = "edublast.onboarding_earn_buddy_tab_v1";

const SESSION_COPY_KEY = "edublast.onboarding_earn_buddy_copy_v1";

const SESSION_SHARE_KEY = "edublast.onboarding_earn_buddy_share_v1";

/** Companion listens after copy/share so progress bar updates even if storage was reconciled. */
export const EARN_BUDDY_COMPANION_PROGRESS_EVENT = "edublast-earn-buddy-companion-progress";

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

function clearSessionFlag(key: string): void {
  if (typeof window === "undefined") return;

  window.sessionStorage.removeItem(key);
}

function notifyEarnBuddyCompanionProgress(): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(EARN_BUDDY_COMPANION_PROGRESS_EVENT));
}

/** Fresh companion launch — drop stale session markers so copy/share can mark again. */

export function clearEarnBuddyCompanionSessionMarkers(): void {
  clearSessionFlag(SESSION_TAB_KEY);

  clearSessionFlag(SESSION_COPY_KEY);

  clearSessionFlag(SESSION_SHARE_KEY);
}

export function isEarnBuddyCompanionTrackingActive(): boolean {
  return canTrack() && isOnboardingTaskCompanionLaunched(TASK_ID);
}

/** Show copy / tab hints when companion is active or legacy onboarding_buddy URL. */

export function shouldShowEarnBuddyOnboardingHints(): boolean {
  if (typeof window === "undefined") return false;

  if (isEarnBuddyCompanionTrackingActive()) return true;

  try {
    const params = new URLSearchParams(window.location.search);

    return params.get("onboarding_buddy") === "1";
  } catch {
    return false;
  }
}

export function markEarnBuddyCompanionTabOpened(): void {
  // Bypassed: first step is removed from the visible checklist
}

export function markEarnBuddyCompanionLinkCopied(): void {
  if (!isEarnBuddyCompanionTrackingActive()) return;
  setSessionFlag(SESSION_COPY_KEY);
  const progress = getOnboardingProgress();
  if (!progress[`${TASK_ID}_step_0`]) {
    markOnboardingStepComplete(TASK_ID, 0);
  }
  notifyEarnBuddyCompanionProgress();
}

export function markEarnBuddyCompanionLinkShared(): void {
  if (!isEarnBuddyCompanionTrackingActive()) return;
  setSessionFlag(SESSION_SHARE_KEY);
  const progress = getOnboardingProgress();
  /** Step 0 copy-or-share — WhatsApp share counts without a separate copy. */
  if (!progress[`${TASK_ID}_step_0`]) {
    setSessionFlag(SESSION_COPY_KEY);
    markOnboardingStepComplete(TASK_ID, 0);
  }
  if (!progress[`${TASK_ID}_step_1`]) {
    markOnboardingStepComplete(TASK_ID, 1);
  }
  notifyEarnBuddyCompanionProgress();
}

/** Step 3 + checklist — only when server confirms invite acceptor is an active buddy. */

export function markEarnBuddyCompanionInviteAccepted(): void {
  if (!canTrack()) return;
  const progress = getOnboardingProgress();
  if (!progress[`${TASK_ID}_step_2`]) {
    markOnboardingStepComplete(TASK_ID, 2);
  }
  if (progress[TASK_ID]) return;
  markOnboardingTaskComplete(TASK_ID, { showChecklistToast: true });
}

/** Apply GET /earn-buddy-status (DB is source of truth for step 4 + credits). */

export function applyEarnBuddyOnboardingServerStatus(status: EarnBuddyOnboardingStatus): void {
  if (!canTrack()) return;
  reconcileEarnBuddyCompanionSteps(status.hasInvitedBuddyJoined);
}

/** Sync companion substeps; step 4 / task only when buddy actually joined. */

export function reconcileEarnBuddyCompanionSteps(hasInvitedBuddyJoined: boolean): void {
  if (!canTrack()) return;

  const progress = getOnboardingProgress();
  const companionActive = isEarnBuddyCompanionTrackingActive();

  if (companionActive) {
    if (progress[`${TASK_ID}_step_0`] && !hasSessionFlag(SESSION_COPY_KEY)) {
      clearOnboardingStepComplete(TASK_ID, 0);
      clearSessionFlag(SESSION_COPY_KEY);
    }
    if (progress[`${TASK_ID}_step_1`] && !hasSessionFlag(SESSION_SHARE_KEY)) {
      clearOnboardingStepComplete(TASK_ID, 1);
      clearSessionFlag(SESSION_SHARE_KEY);
    }
  }

  if (hasInvitedBuddyJoined) {
    markEarnBuddyCompanionInviteAccepted();
  } else {
    if (progress[`${TASK_ID}_step_2`]) {
      clearOnboardingStepComplete(TASK_ID, 2);
    }
    if (progress[TASK_ID]) {
      clearOnboardingTaskCompleteForStudent(TASK_ID);
    }
  }
}

/**
 * Inviter checklist — verified via GET /api/user/onboarding-reward/earn-buddy-status.
 *
 * IMPORTANT: Only reconcile if the user has actually engaged with the earn_buddy task.
 * Without this guard, opening the checklist dialog after ANY other task (e.g. EduFund)
 * would auto-complete buddy for users who happen to already have an active buddy in the
 * DB — even though they never tapped the Buddy card in the checklist.
 */
export function maybeMarkEarnBuddyOnboardingFromBuddyActivation(
  hasInvitedBuddyJoined: boolean
): void {
  if (typeof window === "undefined") return;

  // Only run if the user has actually started the earn_buddy task:
  // (a) companion is explicitly active for this task, OR
  // (b) admin manual mode (admin can tick anything), OR
  // (c) user already has step progress saved (they clicked "Go" on buddy before)
  const companionActive = isOnboardingTaskCompanionLaunched(TASK_ID);
  const adminManual = isAdminManualOnboardingChecklist();
  const progress = getOnboardingProgress();
  const hasAnyStepProgress =
    Boolean(progress[`${TASK_ID}_step_0`]) ||
    Boolean(progress[`${TASK_ID}_step_1`]) ||
    Boolean(progress[`${TASK_ID}_step_2`]) ||
    Boolean(progress[TASK_ID]);

  if (!companionActive && !adminManual && !hasAnyStepProgress) return;

  reconcileEarnBuddyCompanionSteps(hasInvitedBuddyJoined);
}
