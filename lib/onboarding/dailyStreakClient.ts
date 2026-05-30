/** Day-2+ daily streak UI: suppress checklist until tomorrow 9 AM after day complete. */

/** Same 30s delay as site-tour post-claim (`DAILY_CHECKLIST_POST_CLAIM_DELAY_MS` in freeTrialClient). */
export const DAILY_STREAK_POST_COMPLETE_DELAY_MS = 30_000;

const SUPPRESS_UNTIL_KEY_PREFIX = "edublast.daily_streak_suppressed_until_";
const TOMORROW_MODAL_SCHEDULE_KEY_PREFIX = "edublast_daily_streak_tomorrow_modal_at_";

function tomorrowModalScheduleKey(userId: string): string {
  return `${TOMORROW_MODAL_SCHEDULE_KEY_PREFIX}${userId}`;
}

function tomorrowModalShownKey(userId: string, trialDayNumber: number): string {
  return `edublast_day_${trialDayNumber}_tomorrow_modal_shown_${userId}`;
}

export function dailyStreakClaimKey(userId: string, trialDayNumber: number): string {
  return `edublast_day_${trialDayNumber}_streak_claimed_${userId}`;
}

/** After 6/6 + successful claim — show global tomorrow modal after the shared delay. */
export function scheduleDailyStreakTomorrowModal(
  userId: string,
  trialDayNumber: number,
  nowMs: number
): void {
  if (typeof window === "undefined" || !userId) return;
  if (window.localStorage.getItem(tomorrowModalShownKey(userId, trialDayNumber)) === "1") {
    return;
  }
  window.localStorage.setItem(
    tomorrowModalScheduleKey(userId),
    JSON.stringify({
      trialDayNumber,
      showAtMs: nowMs + DAILY_STREAK_POST_COMPLETE_DELAY_MS,
    })
  );
}

export function clearDailyStreakTomorrowModalSchedule(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.removeItem(tomorrowModalScheduleKey(userId));
}

/** Returns pending modal when the post-complete delay has elapsed and it was not dismissed yet. */
export function getDueDailyStreakTomorrowModal(
  userId: string,
  nowMs: number
): { trialDayNumber: number } | null {
  if (typeof window === "undefined" || !userId) return null;
  const raw = window.localStorage.getItem(tomorrowModalScheduleKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { trialDayNumber?: number; showAtMs?: number };
    const trialDayNumber = Number(parsed.trialDayNumber);
    const showAtMs = Number(parsed.showAtMs);
    if (!Number.isFinite(trialDayNumber) || !Number.isFinite(showAtMs)) {
      clearDailyStreakTomorrowModalSchedule(userId);
      return null;
    }
    if (window.localStorage.getItem(tomorrowModalShownKey(userId, trialDayNumber)) === "1") {
      clearDailyStreakTomorrowModalSchedule(userId);
      return null;
    }
    if (nowMs < showAtMs) return null;
    return { trialDayNumber };
  } catch {
    clearDailyStreakTomorrowModalSchedule(userId);
    return null;
  }
}

export function markDailyStreakTomorrowModalShown(userId: string, trialDayNumber: number): void {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.setItem(tomorrowModalShownKey(userId, trialDayNumber), "1");
  clearDailyStreakTomorrowModalSchedule(userId);
}

export const DAILY_STREAK_ALL_COMPLETE_EVENT = "edublast-daily-streak-all-complete";

export const DAILY_TASK_IDS = ["t1", "t2", "t3", "t4", "t5", "t6"] as const;

function suppressKey(userId: string): string {
  return `${SUPPRESS_UNTIL_KEY_PREFIX}${userId}`;
}

/** Next calendar day 9:00 AM (local) after `nowMs`. */
export function getTomorrow9AmMs(nowMs: number): number {
  const d = new Date(nowMs);
  const next = new Date(d);
  next.setDate(d.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return next.getTime();
}

export function armDailyStreakChecklistSuppress(userId: string, nowMs: number): void {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.setItem(suppressKey(userId), String(getTomorrow9AmMs(nowMs)));
}

export function clearDailyStreakChecklistSuppress(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.removeItem(suppressKey(userId));
}

export function getDailyStreakChecklistSuppressUntilMs(userId: string): number | null {
  if (typeof window === "undefined" || !userId) return null;
  const raw = window.localStorage.getItem(suppressKey(userId));
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** True after today's streak is done until tomorrow 9:00 AM — hide auto checklist. */
export function isDailyStreakChecklistSuppressed(
  userId: string | undefined,
  nowMs: number
): boolean {
  if (!userId) return false;
  const until = getDailyStreakChecklistSuppressUntilMs(userId);
  if (until == null) return false;
  if (nowMs >= until) {
    clearDailyStreakChecklistSuppress(userId);
    return false;
  }
  return true;
}

export function getDailyStreakSuppressRemainingMs(
  userId: string | undefined,
  nowMs: number
): number {
  if (!userId) return 0;
  const until = getDailyStreakChecklistSuppressUntilMs(userId);
  if (until == null) return 0;
  return Math.max(0, until - nowMs);
}

/** After time-travel forward, drop stale suppress windows that are already in the past. */
export function reconcileDailyStreakSuppressForTimeTravel(
  userId: string | undefined,
  nowMs: number
): void {
  if (!userId) return;
  isDailyStreakChecklistSuppressed(userId, nowMs);
}

export function dispatchDailyStreakAllComplete(trialDayNumber: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DAILY_STREAK_ALL_COMPLETE_EVENT, {
      detail: { trialDayNumber },
    })
  );
}
