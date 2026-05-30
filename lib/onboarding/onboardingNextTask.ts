import { ONBOARDING_REWARD_TASKS } from "@/components/dashboard/OnboardingRewardDialog";
import {
  ONBOARDING_GYAN_PLUS_SUBSTEP_IDS,
  ONBOARDING_REWARD_TASK_IDS,
} from "@/lib/subscription/onboardingRewardConstants";
import {
  getOnboardingProgress,
  isOnboardingTaskComplete,
} from "@/lib/subscription/freeTrialClient";
import type { OnboardingTask } from "@/lib/onboarding/onboardingRewardTaskUi";

/** True for main checklist row ids (excludes step keys and Gyan++ substeps). */
export function isMainOnboardingTaskId(taskId: string): boolean {
  if (taskId.includes("_step_")) return false;
  if ((ONBOARDING_GYAN_PLUS_SUBSTEP_IDS as readonly string[]).includes(taskId)) return false;
  return (ONBOARDING_REWARD_TASK_IDS as readonly string[]).includes(taskId);
}

/** First incomplete task in canonical checklist order, or null if all done. */
export function getNextIncompleteOnboardingTask(
  progress?: Record<string, boolean>
): OnboardingTask | null {
  const p = progress ?? getOnboardingProgress();
  for (const id of ONBOARDING_REWARD_TASK_IDS) {
    if (!isOnboardingTaskComplete(id, p)) {
      return ONBOARDING_REWARD_TASKS.find((t) => t.id === id) ?? null;
    }
  }
  return null;
}
