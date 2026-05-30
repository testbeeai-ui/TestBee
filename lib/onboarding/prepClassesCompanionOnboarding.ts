import { isOnboardingTaskCompanionLaunched } from "@/lib/onboarding/onboardingTaskCompanion";
import {
  isAdminManualOnboardingChecklist,
  markOnboardingStepComplete,
} from "@/lib/subscription/freeTrialClient";
import {
  clearPrepClassesPickClassGuide,
  clearPrepClassesWatchVideoGuide,
  isPrepClassesOnboardingFlowActive,
} from "@/lib/onboarding/prepClassesOnboardingFlow";

const TASK_ID = "prep_classes";

function isPrepClassesCompanionActive(): boolean {
  if (typeof window === "undefined") return false;
  const launched = isOnboardingTaskCompanionLaunched(TASK_ID);
  return launched || isPrepClassesOnboardingFlowActive();
}

export function isPrepClassesOnboardingCompanionActive(): boolean {
  return isPrepClassesCompanionActive();
}

/** Step 0 — user landed on /classrooms from the checklist. */
export function markPrepClassesStep0FromClassroomsPage(): void {
  if (!isPrepClassesCompanionActive()) return;
  markOnboardingStepComplete(TASK_ID, 0);
}

/** Step 1 — user opened a class detail page. */
export function markPrepClassesStep1FromClassOpened(): void {
  if (!isPrepClassesCompanionActive()) return;
  clearPrepClassesPickClassGuide();
  markOnboardingStepComplete(TASK_ID, 1);
}

/** Step 2 — user engaged with the class intro video (tap play / iframe). */
export function markPrepClassesStep2FromVideoEngaged(): void {
  if (!isPrepClassesCompanionActive()) return;
  clearPrepClassesWatchVideoGuide();
  markOnboardingStepComplete(TASK_ID, 2);
}

/** Step 3 — user opened the Live tab to see scheduled sessions. */
export function markPrepClassesStep3FromLiveTab(): void {
  if (!isPrepClassesCompanionActive()) return;
  markOnboardingStepComplete(TASK_ID, 3);
}
