import { fetchWithClientAuth } from "@/lib/clientApiAuth";
import { localDayKeyFromDate, startOfLocalDay } from "@/lib/dashboardDayActivity";
import { dispatchStudyDayBumped } from "@/lib/studyDayBumpEvents";

/** Local calendar day `YYYY-MM-DD` for the user's browser timezone. */
export function localStudyCalendarDay(d: Date = new Date()): string {
  return localDayKeyFromDate(startOfLocalDay(d));
}

/**
 * Adds study time to the authenticated user's day row in Supabase (`user_study_day_totals`).
 * Safe to fire-and-forget from play / other clients.
 */
export async function bumpUserStudyDayMs(deltaMs: number, day: Date = new Date()): Promise<void> {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
  const capped = Math.min(Math.trunc(deltaMs), 12 * 60 * 60 * 1000);
  const dayStr = localStudyCalendarDay(day);
  try {
    const res = await fetchWithClientAuth("/api/user/study-days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day: dayStr, deltaMs: capped }),
    });
    if (res.ok) {
      dispatchStudyDayBumped({ day: dayStr, deltaMs: capped });
    } else {
      const err = await res.json().catch(() => ({}));
      console.warn("[bumpUserStudyDayMs]", res.status, err);
    }
  } catch (e) {
    console.warn("[bumpUserStudyDayMs]", e);
  }
}
