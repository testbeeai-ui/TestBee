/**
 * Free-trial streak days 2–10: completion-based (not calendar skip).
 * Site tour = Day 1; then Day 2 → Day 3 → … even if calendar days are missed.
 */

import { FREE_TRIAL_DURATION_MS } from "@/lib/subscription/freeTrialTimer";
import { dailyStreakClaimKey } from "@/lib/onboarding/dailyStreakClient";

export const MS_PER_TRIAL_DAY = 24 * 60 * 60 * 1000;
export const MIN_STREAK_DAY = 2;
export const MAX_STREAK_DAY = 10;
export const TOTAL_TRIAL_TRACKER_DAYS = 10;

export function getDay2UnlockTimeMs(claimedAt: string | null | undefined): number {
  if (!claimedAt) return 0;
  const claimDate = new Date(claimedAt);
  const nextDay = new Date(claimDate);
  nextDay.setDate(claimDate.getDate() + 1);
  nextDay.setHours(9, 0, 0, 0);
  return nextDay.getTime();
}

export function isWaitingForDay2Unlock(
  claimedAt: string | null | undefined,
  nowMs: number
): boolean {
  const day2Unlock = getDay2UnlockTimeMs(claimedAt);
  if (!day2Unlock) return false;
  return nowMs < day2Unlock;
}

export type DailyStreakServerState = Record<
  string,
  {
    claimed_at?: string;
    completed_at?: string;
    task_ids?: string[];
    tasks?: Record<string, { completed_at?: string }>;
  }
>;

export function parseDailyStreakServerState(raw: unknown): DailyStreakServerState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as DailyStreakServerState;
}

export function isStreakDayClaimed(
  userId: string | undefined,
  day: number,
  serverStreak?: DailyStreakServerState
): boolean {
  if (!userId || day < MIN_STREAK_DAY || day > MAX_STREAK_DAY) return false;
  const key = String(day);
  if (serverStreak?.[key]?.claimed_at) return true;
  if (typeof window !== "undefined") {
    return window.localStorage.getItem(dailyStreakClaimKey(userId, day)) === "1";
  }
  return false;
}

export function getHighestClaimedStreakDay(
  userId: string | undefined,
  serverStreak?: DailyStreakServerState
): number {
  if (!userId) return 1;
  let highest = 1;
  for (let d = MIN_STREAK_DAY; d <= MAX_STREAK_DAY; d++) {
    if (isStreakDayClaimed(userId, d, serverStreak)) highest = d;
  }
  return highest;
}

export function countClaimedStreakDays(
  userId: string | undefined,
  serverStreak?: DailyStreakServerState
): number {
  if (!userId) return 0;
  let count = 0;
  for (let d = MIN_STREAK_DAY; d <= MAX_STREAK_DAY; d++) {
    if (isStreakDayClaimed(userId, d, serverStreak)) count++;
  }
  return count;
}

export function isAllStreakDaysClaimed(
  userId: string | undefined,
  serverStreak?: DailyStreakServerState
): boolean {
  if (!userId) return false;
  for (let d = MIN_STREAK_DAY; d <= MAX_STREAK_DAY; d++) {
    if (!isStreakDayClaimed(userId, d, serverStreak)) return false;
  }
  return true;
}

/**
 * Which streak day checklist to show (1 = site tour / waiting; 2–10 = daily tasks).
 * Always the lowest unclaimed day — never skips ahead on the calendar.
 */
export function getActiveStreakDayNumber(input: {
  claimedAt: string | null | undefined;
  nowMs: number;
  userId: string | undefined;
  serverStreak?: DailyStreakServerState;
}): number {
  const { claimedAt, nowMs, userId, serverStreak } = input;
  if (!claimedAt) return 1;
  if (isWaitingForDay2Unlock(claimedAt, nowMs)) return 1;

  for (let d = MIN_STREAK_DAY; d <= MAX_STREAK_DAY; d++) {
    if (!isStreakDayClaimed(userId, d, serverStreak)) {
      return d;
    }
  }
  return MAX_STREAK_DAY;
}

/** Calendar days left in 14-day trial — caps how far the streak can still run if user is late. */
export function getCalendarDaysRemainingInTrial(
  freeTrialActivatedAt: string | null | undefined,
  nowMs: number
): number {
  if (!freeTrialActivatedAt) return MAX_STREAK_DAY;
  const start = Date.parse(freeTrialActivatedAt);
  if (!Number.isFinite(start)) return MAX_STREAK_DAY;
  const trialEndMs = start + FREE_TRIAL_DURATION_MS;
  const msLeft = trialEndMs - nowMs;
  if (msLeft <= 0) return 0;
  return Math.ceil(msLeft / MS_PER_TRIAL_DAY);
}

/**
 * Furthest streak day still reachable (e.g. completed Day 2 late with 5 trial days left → up to Day 7).
 */
export function getMaxReachableStreakDay(input: {
  claimedAt: string | null | undefined;
  nowMs: number;
  userId: string | undefined;
  freeTrialActivatedAt: string | null | undefined;
  serverStreak?: DailyStreakServerState;
}): number {
  const highest = getHighestClaimedStreakDay(input.userId, input.serverStreak);
  const calendarLeft = getCalendarDaysRemainingInTrial(input.freeTrialActivatedAt, input.nowMs);
  if (highest <= 1) {
    return Math.min(MAX_STREAK_DAY, 1 + calendarLeft);
  }
  return Math.min(MAX_STREAK_DAY, highest + calendarLeft);
}

export function isStreakDayLockedByTrialEnd(input: {
  streakDay: number;
  claimedAt: string | null | undefined;
  nowMs: number;
  userId: string | undefined;
  freeTrialActivatedAt: string | null | undefined;
  serverStreak?: DailyStreakServerState;
}): boolean {
  const max = getMaxReachableStreakDay(input);
  return input.streakDay > max;
}

export function getStreakTrackerProgressPct(input: {
  siteTourClaimed: boolean;
  userId: string | undefined;
  serverStreak?: DailyStreakServerState;
}): number {
  let completed = input.siteTourClaimed ? 1 : 0;
  completed += countClaimedStreakDays(input.userId, input.serverStreak);
  return Math.min(100, Math.max(0, completed * 10));
}

/** Day 1 (site tour) + each claimed daily streak day (2–10). */
export function getTrialTrackerDaysCompleted(
  userId: string | undefined,
  claimedAt: string | null | undefined,
  serverStreak?: DailyStreakServerState
): number {
  let completed = claimedAt ? 1 : 0;
  completed += countClaimedStreakDays(userId, serverStreak);
  return completed;
}

export const TRIAL_EXTENSION_TRACKER_DAYS_REQUIRED = 10;

/** Scenario 1 at trial end: completed all 10 onboarding track days within the 14-day window. */
export function qualifiesForTrialExtensionBonus(
  userId: string | undefined,
  claimedAt: string | null | undefined,
  serverStreak?: DailyStreakServerState
): boolean {
  return (
    getTrialTrackerDaysCompleted(userId, claimedAt, serverStreak) >=
    TRIAL_EXTENSION_TRACKER_DAYS_REQUIRED
  );
}

/** Dev time-travel: land 9:01 AM on the calendar window for streak day N (after Day 1 claim). */
export function getSimulatedTimeForStreakDay(
  claimedAt: string | null | undefined,
  targetStreakDay: number
): number | null {
  if (!claimedAt || targetStreakDay < MIN_STREAK_DAY || targetStreakDay > MAX_STREAK_DAY) {
    return null;
  }
  const day2Unlock = getDay2UnlockTimeMs(claimedAt);
  if (!day2Unlock) return null;
  return day2Unlock + (targetStreakDay - MIN_STREAK_DAY) * MS_PER_TRIAL_DAY + 60_000;
}

export function computeOffsetForStreakDay(
  claimedAt: string | null | undefined,
  targetStreakDay: number
): number {
  const target = getSimulatedTimeForStreakDay(claimedAt, targetStreakDay);
  if (target == null) {
    const d = new Date();
    d.setDate(d.getDate() + Math.max(1, targetStreakDay - 1));
    d.setHours(9, 1, 0, 0);
    return Math.max(0, d.getTime() - Date.now());
  }
  return Math.max(0, target - Date.now());
}
