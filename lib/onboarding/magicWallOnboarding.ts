import {
  clearOnboardingStepComplete,
  getOnboardingProgress,
  isAdminManualOnboardingChecklist,
  markOnboardingStepComplete,
  maybeMarkMagicWallOnboardingFromBasket,
} from "@/lib/subscription/freeTrialClient";
import { isOnboardingTaskCompanionLaunched } from "@/lib/onboarding/onboardingTaskCompanion";

const TASK_ID = "magic_wall";

function stepKey(index: number): string {
  return `${TASK_ID}_step_${index}`;
}

/**
 * Keep Magic Wall companion steps aligned with real basket state:
 * - Step 1: at least one topic selected in the UI (or already saved).
 * - Step 2: at least one topic saved in the reading basket (DB).
 * - Full checklist row: only when saved count ≥ 1 (existing RDM rule).
 */
export function syncMagicWallOnboardingStepsFromBasketState(
  savedBasketCount: number,
  pendingSelectedCount: number
): void {
  if (typeof window === "undefined") return;

  const saved = Math.max(0, savedBasketCount);
  const selected = Math.max(0, pendingSelectedCount);
  const shouldHaveStep1 = selected >= 1 || saved >= 1;
  const shouldHaveStep2 = saved >= 1;

  const progress = getOnboardingProgress();

  if (shouldHaveStep1 && !progress[stepKey(1)]) {
    markOnboardingStepComplete(TASK_ID, 1);
  } else if (!shouldHaveStep1 && progress[stepKey(1)]) {
    clearOnboardingStepComplete(TASK_ID, 1);
  }

  if (shouldHaveStep2 && !progress[stepKey(2)]) {
    markOnboardingStepComplete(TASK_ID, 2);
  } else if (!shouldHaveStep2 && progress[stepKey(2)]) {
    clearOnboardingStepComplete(TASK_ID, 2);
  }

  if (shouldHaveStep2) {
    maybeMarkMagicWallOnboardingFromBasket(saved);
  }
}
