import { Crosshair } from "lucide-react";
import { isOnboardingTaskCompanionLaunched } from "@/lib/onboarding/onboardingTaskCompanion";
import type { OnboardingTask } from "@/lib/onboarding/onboardingRewardTaskUi";
import {
  dispatchDailyChecklistReopen,
  completeDailyStreakTaskFlow,
} from "@/lib/onboarding/dailyChecklistTaskStorage";
import { clearDailyChecklistCompanionRetry } from "@/lib/onboarding/dailyChecklistCompanionRetry";
import {
  getOnboardingProgress,
  markOnboardingStepComplete,
  markOnboardingTaskComplete,
} from "@/lib/subscription/freeTrialClient";

export const TASK_ID = "play_dailydose";

const SESSION_STARTED_KEY = "edublast.onboarding_play_dailydose_started_v1";
const SESSION_COMPLETE_KEY = "edublast.onboarding_play_dailydose_complete_v1";
const REOPEN_DELAY_MS = 5000;

export const PLAY_DAILYDOSE_COMPANION_TASK: OnboardingTask = {
  id: TASK_ID,
  title: "Dashboard - DailyDose",
  boardTitle: "DailyDose",
  teaser: "Play DailyDose — Academic or Funbrain",
  time: "~5 min",
  steps: [
    "Open Play from the checklist.",
    "Tap DailyDose in Academic Arena or Funbrain Forge.",
    "Answer all DailyDose questions in the session.",
    "View today's leaderboard when you finish.",
  ],
  hints: ["Play → DailyDose → full session → leaderboard"],
  href: "/play",
  icon: Crosshair,
  color: "teal",
};

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

/** Clears ephemeral session markers (persisted checklist keys in localStorage are unchanged). */
export function clearPlayDailyDoseCompanionSessionMarkers(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_STARTED_KEY);
    window.sessionStorage.removeItem(SESSION_COMPLETE_KEY);
  } catch {
    /* ignore */
  }
}

export function isPlayDailyDoseCompanionTrackingActive(): boolean {
  return canTrack() && isOnboardingTaskCompanionLaunched(TASK_ID);
}

/** Show Click here pointer on DailyDose buttons before the user starts a session. */
export function shouldShowPlayDailyDoseGuide(): boolean {
  if (!isPlayDailyDoseCompanionTrackingActive()) return false;
  return !hasSessionFlag(SESSION_STARTED_KEY);
}

export function markPlayDailyDoseCompanionOnPlayPage(): void {
  if (!isPlayDailyDoseCompanionTrackingActive()) return;
  markOnboardingStepComplete(TASK_ID, 0);
}

/** Step 1 — user tapped a DailyDose button. */
export function markPlayDailyDoseCompanionStarted(): void {
  if (!isPlayDailyDoseCompanionTrackingActive()) return;
  setSessionFlag(SESSION_STARTED_KEY);
  markOnboardingStepComplete(TASK_ID, 1);
}

/** Step 2 — gauntlet session is active. */
export function markPlayDailyDoseCompanionGauntletActive(): void {
  if (!isPlayDailyDoseCompanionTrackingActive()) return;
  markOnboardingStepComplete(TASK_ID, 2);
}

/** Step 3 — leaderboard / result screen visible. */
export function markPlayDailyDoseCompanionLeaderboardViewed(): void {
  if (!isPlayDailyDoseCompanionTrackingActive()) return;
  markOnboardingStepComplete(TASK_ID, 3);
}

function maybeCompletePlayDailyDoseTask(): void {
  const progress = getOnboardingProgress();
  const allSteps =
    progress[`${TASK_ID}_step_0`] &&
    progress[`${TASK_ID}_step_1`] &&
    progress[`${TASK_ID}_step_2`] &&
    progress[`${TASK_ID}_step_3`];
  if (!allSteps || progress[TASK_ID]) return;
  markOnboardingTaskComplete(TASK_ID, { showChecklistToast: true });
}

export type PlayDailyDoseCompleteInput = {
  userId: string;
  claimedAt: string | null | undefined;
  nowMs: number;
  questionCount: number;
  /** From admin subscription config (e.g. free trial = 5). */
  requiredQuestionCount: number;
};

/**
 * After a successful DailyDose submit: mark companion + Day-2 t1, then reopen checklist after 5s.
 */
export function handlePlayDailyDoseGauntletComplete(input: PlayDailyDoseCompleteInput): void {
  if (!isPlayDailyDoseCompanionTrackingActive()) return;
  if (hasSessionFlag(SESSION_COMPLETE_KEY)) return;
  const required = Math.max(1, input.requiredQuestionCount);
  if (input.questionCount < required) return;

  setSessionFlag(SESSION_COMPLETE_KEY);
  markPlayDailyDoseCompanionLeaderboardViewed();
  maybeCompletePlayDailyDoseTask();

  const credited = completeDailyStreakTaskFlow("t1");
  if (!credited) return;
  clearDailyChecklistCompanionRetry();

  window.setTimeout(() => {
    dispatchDailyChecklistReopen("t1");
  }, REOPEN_DELAY_MS);
}
