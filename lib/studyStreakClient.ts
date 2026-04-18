import { localDayKeyFromDate } from "@/lib/dashboardDayActivity";

/** Parse `YYYY-MM-DD` into a local Date at noon (avoids DST edge cases). */
function dateFromDayKey(key: string): Date | null {
  const parts = key.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/**
 * Same rule as `get_study_streak_summary` (Postgres):
 * - `activeDaysThisMonth`: days in the calendar month of `todayKey` with `active_ms` > 0.
 * - `streak`: longest run of consecutive calendar days with study time, anchored at the
 *   **latest** day `<= todayKey` that has activity (so an empty “today” does not reset the streak).
 */
export function computeStudyStreakFromDayMs(
  msByDay: Map<string, number>,
  todayKey: string
): { streak: number; activeDaysThisMonth: number } {
  const parts = todayKey.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return { streak: 0, activeDaysThisMonth: 0 };
  }
  const [yy, mm] = parts;
  const ym = `${yy}-${String(mm).padStart(2, "0")}-`;

  let activeDaysThisMonth = 0;
  for (const [day, ms] of msByDay) {
    if (ms > 0 && day.startsWith(ym)) activeDaysThisMonth++;
  }

  let anchorKey: string | null = null;
  for (const [day, ms] of msByDay) {
    if (ms <= 0) continue;
    if (day > todayKey) continue;
    if (anchorKey == null || day > anchorKey) anchorKey = day;
  }

  if (anchorKey == null) return { streak: 0, activeDaysThisMonth };

  const start = dateFromDayKey(anchorKey);
  if (!start) return { streak: 0, activeDaysThisMonth };

  let streak = 0;
  const cursor = new Date(start);
  for (;;) {
    const key = localDayKeyFromDate(cursor);
    if ((msByDay.get(key) ?? 0) <= 0) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
    if (streak > 10000) break;
  }

  return { streak, activeDaysThisMonth };
}
