import type { ProfileOnboardingStatus } from "@/lib/onboarding/profileCompanionApi";
import { isOnboardingTaskCompanionLaunched } from "@/lib/onboarding/onboardingTaskCompanion";
import { isStudentProfileBasicInfoComplete } from "@/lib/profile/studentProfileBasicInfo";
import type { Profile } from "@/hooks/useAuth";
import {
  clearOnboardingStepComplete,
  getOnboardingProgress,
  isAdminManualOnboardingChecklist,
  markOnboardingStepComplete,
  markOnboardingTaskComplete,
  unmarkOnboardingTask,
} from "@/lib/subscription/freeTrialClient";

const TASK_ID = "profile";

const SESSION_OPEN_KEY = "edublast.onboarding_profile_open_v1";
const SESSION_EDIT_KEY = "edublast.onboarding_profile_edit_v1";
const SESSION_SAVED_KEY = "edublast.onboarding_profile_saved_v1";
const SESSION_AVATAR_KEY = "edublast.onboarding_profile_avatar_v1";

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

export function isProfileCompanionTrackingActive(): boolean {
  return canTrack() && isOnboardingTaskCompanionLaunched(TASK_ID);
}

export type ProfileBasicFormDraft = {
  firstName: string;
  lastName: string;
  stateVal: string | null;
  cityVal: string | null;
  phoneDigits: string;
  genderVal: string | null;
  accountEmail?: string | null;
};

export function isProfileBasicFormDraftComplete(draft: ProfileBasicFormDraft): boolean {
  const phone = draft.phoneDigits.replace(/\D/g, "");
  return (
    draft.firstName.trim().length > 0 &&
    draft.lastName.trim().length > 0 &&
    Boolean(draft.stateVal?.trim()) &&
    Boolean(draft.cityVal?.trim()) &&
    phone.length === 10 &&
    Boolean(draft.genderVal?.trim()) &&
    Boolean(draft.accountEmail?.trim())
  );
}

/** Step 1 — on Profile → Basic information. */
export function markProfileCompanionHubOpened(): void {
  if (!isProfileCompanionTrackingActive()) return;
  setSessionFlag(SESSION_OPEN_KEY);
  markOnboardingStepComplete(TASK_ID, 0);
}

/** Step 2 — user started filling (Edit tapped or all required fields entered). */
export function markProfileCompanionFormStarted(): void {
  if (!isProfileCompanionTrackingActive()) return;
  if (!hasSessionFlag(SESSION_OPEN_KEY)) markProfileCompanionHubOpened();
  if (hasSessionFlag(SESSION_EDIT_KEY)) return;
  setSessionFlag(SESSION_EDIT_KEY);
  markOnboardingStepComplete(TASK_ID, 1);
}

/** Step 3 — required basic fields saved to profiles (server-shaped). */
export function markProfileCompanionBasicSaved(): void {
  if (!isProfileCompanionTrackingActive()) return;
  if (hasSessionFlag(SESSION_SAVED_KEY)) return;
  setSessionFlag(SESSION_SAVED_KEY);
  markOnboardingStepComplete(TASK_ID, 2);
}

/** Step 4 — profile.avatar_url set in DB. */
export function markProfileCompanionAvatarUploaded(): void {
  if (!isProfileCompanionTrackingActive()) return;
  if (!hasSessionFlag(SESSION_SAVED_KEY)) return;
  if (hasSessionFlag(SESSION_AVATAR_KEY)) {
    maybeCompleteProfileTask();
    return;
  }
  setSessionFlag(SESSION_AVATAR_KEY);
  markOnboardingStepComplete(TASK_ID, 3);
  maybeCompleteProfileTask();
}

function maybeCompleteProfileTask(): void {
  const progress = getOnboardingProgress();
  const allSteps =
    progress[`${TASK_ID}_step_0`] &&
    progress[`${TASK_ID}_step_1`] &&
    progress[`${TASK_ID}_step_2`] &&
    progress[`${TASK_ID}_step_3`];

  console.log("[ProfileCompanionOnboarding] maybeCompleteProfileTask evaluated:", {
    allSteps,
    step_0: progress[`${TASK_ID}_step_0`],
    step_1: progress[`${TASK_ID}_step_1`],
    step_2: progress[`${TASK_ID}_step_2`],
    step_3: progress[`${TASK_ID}_step_3`],
    taskAlreadyComplete: progress[TASK_ID],
  });

  if (!allSteps || progress[TASK_ID]) return;
  console.log(
    "[ProfileCompanionOnboarding] Profile onboarding checklist is complete! Calling markOnboardingTaskComplete..."
  );
  markOnboardingTaskComplete(TASK_ID, { showChecklistToast: true });
}

/** Ephemeral session markers (persisted checklist keys in localStorage are unchanged). */
export function clearProfileCompanionSessionMarkers(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_OPEN_KEY);
    window.sessionStorage.removeItem(SESSION_EDIT_KEY);
    window.sessionStorage.removeItem(SESSION_SAVED_KEY);
    window.sessionStorage.removeItem(SESSION_AVATAR_KEY);
  } catch {
    /* ignore */
  }
}

/** Apply GET /profile-status (profiles row is source of truth). */
export function applyProfileOnboardingServerStatus(
  status: ProfileOnboardingStatus,
  profile: Profile,
  accountEmail?: string | null
): void {
  if (!isProfileCompanionTrackingActive()) return;
  reconcileProfileCompanionSteps(profile, accountEmail, {
    serverBasicComplete: status.basicInfoComplete,
    serverHasAvatar: status.hasAvatarUrl,
  });
}

/** Sync steps with profiles row (source of truth for save + avatar). */
export function reconcileProfileCompanionSteps(
  profile: Profile,
  accountEmail?: string | null,
  opts?: { serverBasicComplete?: boolean; serverHasAvatar?: boolean }
): void {
  if (!canTrack()) return;
  if (!isProfileCompanionTrackingActive()) return;

  const progress = getOnboardingProgress();
  const basicComplete =
    opts?.serverBasicComplete === true || isStudentProfileBasicInfoComplete(profile, accountEmail);
  const hasAvatar =
    Boolean(profile.avatar_url?.trim()) && profile.avatar_url?.includes("profile-avatars");

  if (basicComplete) {
    if (!hasSessionFlag(SESSION_OPEN_KEY)) setSessionFlag(SESSION_OPEN_KEY);
    if (!hasSessionFlag(SESSION_EDIT_KEY)) setSessionFlag(SESSION_EDIT_KEY);
    if (!hasSessionFlag(SESSION_SAVED_KEY)) setSessionFlag(SESSION_SAVED_KEY);

    if (!progress[`${TASK_ID}_step_0`]) {
      markOnboardingStepComplete(TASK_ID, 0);
    }
    if (!progress[`${TASK_ID}_step_1`]) {
      markOnboardingStepComplete(TASK_ID, 1);
    }
    if (!progress[`${TASK_ID}_step_2`]) {
      markOnboardingStepComplete(TASK_ID, 2);
    }
  } else if (progress[`${TASK_ID}_step_2`]) {
    clearOnboardingStepComplete(TASK_ID, 2);
    if (hasSessionFlag(SESSION_SAVED_KEY)) {
      window.sessionStorage.removeItem(SESSION_SAVED_KEY);
    }
  }

  if (hasAvatar) {
    if (!hasSessionFlag(SESSION_AVATAR_KEY)) {
      setSessionFlag(SESSION_AVATAR_KEY);
    }
    if (!progress[`${TASK_ID}_step_3`]) {
      markOnboardingStepComplete(TASK_ID, 3);
    }
    maybeCompleteProfileTask();
  } else if (progress[`${TASK_ID}_step_3`] && !hasAvatar) {
    clearOnboardingStepComplete(TASK_ID, 3);
    if (hasSessionFlag(SESSION_AVATAR_KEY)) {
      window.sessionStorage.removeItem(SESSION_AVATAR_KEY);
    }
    if (progress[TASK_ID]) {
      unmarkOnboardingTask(TASK_ID, { showChecklistToast: false });
    }
  }
}

/** Call after profile refresh when basic info may have been saved. */
export function maybeMarkProfileOnboardingFromBasicInfo(
  complete: boolean,
  profile: Profile,
  accountEmail?: string | null
): void {
  if (!complete) return;
  if (!isProfileCompanionTrackingActive()) return;
  reconcileProfileCompanionSteps(profile, accountEmail);
}
