/** Day-2+ daily checklist task ids stored in localStorage per trial day. */

export const ONBOARDING_DAILY_TASK_DONE_EVENT = "edublast-onboarding-daily-task-done";

export type OnboardingDailyTaskDoneDetail = {
  dailyTaskId: string;
  trialDayNumber: number;
  userId: string;
};

export const ONBOARDING_DAILY_CHECKLIST_REOPEN_EVENT = "edublast-onboarding-daily-checklist-reopen";

export type OnboardingDailyChecklistReopenDetail = {
  dailyTaskId: string;
};

export type { DailyStreakServerState } from "@/lib/onboarding/dailyStreakProgress";

export {
  getActiveStreakDayNumber,
  getMaxReachableStreakDay,
  getHighestClaimedStreakDay,
  isStreakDayClaimed,
  isAllStreakDaysClaimed,
  isStreakDayLockedByTrialEnd,
  countClaimedStreakDays,
  getStreakTrackerProgressPct,
  getTrialTrackerDaysCompleted,
  qualifiesForTrialExtensionBonus,
  TRIAL_EXTENSION_TRACKER_DAYS_REQUIRED,
  computeOffsetForStreakDay,
  getDay2UnlockTimeMs,
  isWaitingForDay2Unlock,
  parseDailyStreakServerState,
  MIN_STREAK_DAY,
  MAX_STREAK_DAY,
  MS_PER_TRIAL_DAY,
} from "@/lib/onboarding/dailyStreakProgress";

import {
  computeOffsetForStreakDay,
  getActiveStreakDayNumber,
  type DailyStreakServerState,
} from "@/lib/onboarding/dailyStreakProgress";
import { persistDailyStreakTaskToServer } from "@/lib/onboarding/dailyStreakSync";

/** @deprecated Use getActiveStreakDayNumber — always pass userId for completion-based day. */
export function getTrialDayNumber(
  claimedAt: string | null | undefined,
  nowMs: number,
  userId?: string,
  serverStreak?: DailyStreakServerState
): number {
  return getActiveStreakDayNumber({ claimedAt, nowMs, userId, serverStreak });
}

/** @deprecated Use computeOffsetForStreakDay */
export function computeOffsetForTrialDay(
  claimedAt: string | null | undefined,
  targetTrialDay: number
): number {
  return computeOffsetForStreakDay(claimedAt, targetTrialDay);
}

export function dailyChecklistStorageKey(userId: string, trialDayNumber: number): string {
  return `edublast_day_${trialDayNumber}_completed_${userId}`;
}

/** Calendar date (local) when the student finished a CBSE MCQ for daily task t3. */
export function dailyCbseMcqDoneDateKey(userId: string, trialDayNumber: number): string {
  return `edublast_day_${trialDayNumber}_cbse_mcq_done_date_${userId}`;
}

export function getLocalCalendarDateIso(nowMs: number): string {
  const d = new Date(nowMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function hasDailyCbseMcqCompletedOnDate(
  userId: string,
  trialDayNumber: number,
  dateIso: string
): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(dailyCbseMcqDoneDateKey(userId, trialDayNumber)) === dateIso;
}

/** Drop t3 if it was checked without a CBSE MCQ finish on this calendar day. */
export function reconcileDailyCbseMcqChecklistState(
  userId: string,
  trialDayNumber: number,
  completedIds: string[],
  nowMs: number,
  serverStreak?: DailyStreakServerState
): string[] {
  if (!completedIds.includes("t3")) return completedIds;
  const today = getLocalCalendarDateIso(nowMs);
  if (hasDailyCbseMcqCompletedOnDate(userId, trialDayNumber, today)) return completedIds;

  const serverRow = serverStreak?.[String(trialDayNumber)];
  const serverCompletedAt = serverRow?.tasks?.t3?.completed_at;
  if (serverCompletedAt) {
    const parsed = Date.parse(serverCompletedAt);
    if (Number.isFinite(parsed) && getLocalCalendarDateIso(parsed) === today) {
      return completedIds;
    }
  }

  const next = completedIds.filter((id) => id !== "t3");
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      dailyChecklistStorageKey(userId, trialDayNumber),
      JSON.stringify(next)
    );
  }
  return next;
}

export function loadDailyChecklistCompleted(userId: string, trialDayNumber: number): string[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(dailyChecklistStorageKey(userId, trialDayNumber));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

const ACTIVE_DAILY_STREAK_FLOW_KEY = "edublast-daily-streak-active-flow-v1";

export type ActiveDailyStreakFlow = {
  dailyTaskId: string;
  trialDayNumber: number;
  userId: string;
};

/** Arm flow-only tracking when the student opens a daily task from the streak checklist. */
export function armDailyStreakTaskFlow(session: ActiveDailyStreakFlow): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ACTIVE_DAILY_STREAK_FLOW_KEY, JSON.stringify(session));
}

export function getActiveDailyStreakFlow(): ActiveDailyStreakFlow | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(ACTIVE_DAILY_STREAK_FLOW_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ActiveDailyStreakFlow;
    if (
      parsed &&
      typeof parsed.dailyTaskId === "string" &&
      typeof parsed.trialDayNumber === "number" &&
      typeof parsed.userId === "string"
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function clearActiveDailyStreakFlow(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ACTIVE_DAILY_STREAK_FLOW_KEY);
}

/**
 * Credit a daily streak task only when it was completed through the armed flow
 * for the current streak day — never from site-tour history or prior days.
 */
export function completeDailyStreakTaskFlow(dailyTaskId: string): string[] | null {
  const flow = getActiveDailyStreakFlow();
  if (!flow || flow.dailyTaskId !== dailyTaskId) return null;
  const next = markDailyChecklistTaskDone(flow.userId, flow.trialDayNumber, dailyTaskId);
  clearActiveDailyStreakFlow();
  return next;
}

export function markDailyChecklistTaskDone(
  userId: string,
  trialDayNumber: number,
  taskId: string
): string[] {
  if (typeof window === "undefined") return [];
  const existing = loadDailyChecklistCompleted(userId, trialDayNumber);
  if (existing.includes(taskId)) return existing;
  const next = [...existing, taskId];
  window.localStorage.setItem(
    dailyChecklistStorageKey(userId, trialDayNumber),
    JSON.stringify(next)
  );
  window.dispatchEvent(
    new CustomEvent<OnboardingDailyTaskDoneDetail>(ONBOARDING_DAILY_TASK_DONE_EVENT, {
      detail: { dailyTaskId: taskId, trialDayNumber, userId },
    })
  );
  void persistDailyStreakTaskToServer(userId, trialDayNumber, taskId);
  return next;
}

export function dispatchDailyChecklistReopen(dailyTaskId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OnboardingDailyChecklistReopenDetail>(ONBOARDING_DAILY_CHECKLIST_REOPEN_EVENT, {
      detail: { dailyTaskId },
    })
  );
}
