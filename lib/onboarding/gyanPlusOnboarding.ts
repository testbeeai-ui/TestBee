import { isOnboardingTaskCompanionLaunched } from "@/lib/onboarding/onboardingTaskCompanion";
import {
  getOnboardingProgress,
  markOnboardingTaskComplete,
} from "@/lib/subscription/freeTrialClient";

/** Single free-trial checklist step (replaces gyan_browse, gyan_post, gyan_engagement). */
export const GYAN_PLUS_TASK_ID = "gyan_plus" as const;

/** Sub-steps persisted in onboarding_reward_progress until all three are done. */
export const GYAN_PLUS_SUBSTEP_IDS = ["gyan_browse", "gyan_post", "gyan_engagement"] as const;

export type GyanPlusSubstepId = (typeof GYAN_PLUS_SUBSTEP_IDS)[number];

export const GYAN_PLUS_ONBOARDING_HREF = "/doubts?onboarding_gyan=1";

export function isGyanPlusOnboardingComplete(progress: Record<string, boolean>): boolean {
  if (progress[GYAN_PLUS_TASK_ID]) return true;
  return GYAN_PLUS_SUBSTEP_IDS.every((id) => Boolean(progress[id]));
}

/** Companion flow (4 steps) — use on /doubts during Day-2+ retry instead of legacy substep keys. */
export function isGyanPlusCompanionFlowComplete(progress: Record<string, boolean>): boolean {
  if (progress[GYAN_PLUS_TASK_ID]) return true;
  return [0, 1, 2, 3].every((i) => Boolean(progress[`${GYAN_PLUS_TASK_ID}_step_${i}`]));
}

export function gyanDoubtsPathFromSearchParams(sp: URLSearchParams): string {
  const qs = sp.toString();
  return qs ? `/doubts?${qs}` : "/doubts";
}

/** Sync legacy sub-step keys when companion flow finishes (admin / server JSON). */
export function tryCompleteGyanPlusChecklistFromSubsteps(): void {
  const progress = getOnboardingProgress();
  for (const id of GYAN_PLUS_SUBSTEP_IDS) {
    if (!progress[id]) {
      markOnboardingTaskComplete(id, { showChecklistToast: false });
    }
  }
}

function tryCompleteGyanPlusChecklist(opts?: { toastActionLine?: string }): void {
  const progress = getOnboardingProgress();
  if (isGyanPlusOnboardingComplete(progress)) return;
  if (!GYAN_PLUS_SUBSTEP_IDS.every((id) => Boolean(progress[id]))) return;
  markOnboardingTaskComplete(GYAN_PLUS_TASK_ID, {
    toastActionLine: opts?.toastActionLine ?? "You explored Gyan++!",
    showChecklistToast: true,
  });
}

/** Record one sub-step; marks the combined checklist row when browse + post + engage are all done. */
export function recordGyanPlusSubstep(
  substep: GyanPlusSubstepId,
  opts?: { toastActionLine?: string; showChecklistToast?: boolean }
): void {
  const progress = getOnboardingProgress();
  if (progress[substep]) return;
  markOnboardingTaskComplete(substep, {
    showChecklistToast: false,
    ...opts,
  });
  tryCompleteGyanPlusChecklist(opts);
}

export function isGyanPlusSubstepDone(substep: GyanPlusSubstepId): boolean {
  return Boolean(getOnboardingProgress()[substep]);
}

export function isGyanPlusOnboardingSessionActive(
  searchParams: Pick<URLSearchParams, "get">
): boolean {
  if (isOnboardingTaskCompanionLaunched(GYAN_PLUS_TASK_ID)) return true;
  return (
    searchParams.get("onboarding_gyan") === "1" ||
    searchParams.get("onboarding_gyan_browse") === "1" ||
    searchParams.get("onboarding_gyan_post") === "1" ||
    searchParams.get("onboarding_gyan_engage") === "1"
  );
}

export function clearGyanPlusOnboardingQueryParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams.toString());
  next.delete("onboarding_gyan");
  next.delete("onboarding_gyan_browse");
  next.delete("onboarding_gyan_post");
  next.delete("onboarding_gyan_engage");
  return next;
}
