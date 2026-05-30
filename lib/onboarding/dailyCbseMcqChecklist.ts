import {
  dispatchDailyChecklistReopen,
  completeDailyStreakTaskFlow,
  getActiveDailyStreakFlow,
  getLocalCalendarDateIso,
  dailyCbseMcqDoneDateKey,
} from "@/lib/onboarding/dailyChecklistTaskStorage";
import {
  clearDailyChecklistCompanionRetry,
  startDailyChecklistCompanionRetry,
} from "@/lib/onboarding/dailyChecklistCompanionRetry";

const TRACKING_KEY = "edublast-daily-checklist-cbse-mcq-v1";
const COMPLETE_KEY = "edublast-daily-checklist-cbse-mcq-complete-v1";
const REOPEN_DELAY_MS = 5000;

export function startDailyCbseMcqChecklistTracking(trialDayNumber: number, userId: string): void {
  if (typeof window === "undefined") return;
  startDailyChecklistCompanionRetry("t3", trialDayNumber, userId);
  window.sessionStorage.setItem(TRACKING_KEY, "1");
  window.sessionStorage.removeItem(COMPLETE_KEY);
}

export function isDailyCbseMcqChecklistTrackingActive(): boolean {
  return typeof window !== "undefined" && window.sessionStorage.getItem(TRACKING_KEY) === "1";
}

export function clearDailyCbseMcqChecklistTracking(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(TRACKING_KEY);
  window.sessionStorage.removeItem(COMPLETE_KEY);
}

export type DailyCbseMcqCompleteInput = {
  userId: string;
  claimedAt: string | null | undefined;
  nowMs: number;
};

/** Credit t3 only after a CBSE chapter quiz finishes during the armed daily streak flow. */
export function handleDailyCbseMcqQuizComplete(input: DailyCbseMcqCompleteInput): void {
  if (!isDailyCbseMcqChecklistTrackingActive()) return;
  if (typeof window === "undefined") return;
  if (window.sessionStorage.getItem(COMPLETE_KEY) === "1") return;

  const flow = getActiveDailyStreakFlow();
  if (!flow || flow.dailyTaskId !== "t3" || flow.userId !== input.userId) return;

  window.sessionStorage.setItem(COMPLETE_KEY, "1");

  const dateIso = getLocalCalendarDateIso(input.nowMs);
  window.localStorage.setItem(dailyCbseMcqDoneDateKey(flow.userId, flow.trialDayNumber), dateIso);

  const credited = completeDailyStreakTaskFlow("t3");
  if (!credited) return;
  clearDailyChecklistCompanionRetry();

  window.setTimeout(() => {
    dispatchDailyChecklistReopen("t3");
  }, REOPEN_DELAY_MS);
}
