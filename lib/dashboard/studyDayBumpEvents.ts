import { invalidateStudyDaysCache } from "@/lib/dashboard/studyDaysClient";

/** Fired after study day totals change so dashboards can refetch quietly. */
export const EDUBLAST_STUDY_DAYS_REFRESH = "edublast-study-days-refresh";

/** Gyan++ rail only — avoids refetching home daily-checklist on every focus flush. */
export const EDUBLAST_GYAN_DAILY_CHECKLIST_REFRESH = "edublast-gyan-daily-checklist-refresh";

/** Coalesce burst refreshes (presence flush + realtime + focus) into one wave. */
const STUDY_DAYS_REFRESH_DEBOUNCE_MS = 1_500;

export type StudyDayBumpedDetail = { day: string; deltaMs: number };

let studyDaysRefreshTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced refresh — use after writes so listeners fetch once, not N times. */
export function notifyStudyDaysRefresh(): void {
  if (typeof window === "undefined") return;
  if (studyDaysRefreshTimer != null) clearTimeout(studyDaysRefreshTimer);
  studyDaysRefreshTimer = setTimeout(() => {
    studyDaysRefreshTimer = null;
    window.dispatchEvent(new CustomEvent(EDUBLAST_STUDY_DAYS_REFRESH));
  }, STUDY_DAYS_REFRESH_DEBOUNCE_MS);
}

export function dispatchStudyDayBumped(_detail: StudyDayBumpedDetail): void {
  if (typeof window === "undefined") return;
  invalidateStudyDaysCache();
  notifyStudyDaysRefresh();
}

export function dispatchGyanDailyChecklistRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EDUBLAST_GYAN_DAILY_CHECKLIST_REFRESH));
}
