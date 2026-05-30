/** Fired after study day totals change so dashboards can refetch quietly. */
export const EDUBLAST_STUDY_DAYS_REFRESH = "edublast-study-days-refresh";

/** Gyan++ rail only — avoids refetching home daily-checklist on every focus flush. */
export const EDUBLAST_GYAN_DAILY_CHECKLIST_REFRESH = "edublast-gyan-daily-checklist-refresh";

export type StudyDayBumpedDetail = { day: string; deltaMs: number };

export function dispatchStudyDayBumped(_detail: StudyDayBumpedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EDUBLAST_STUDY_DAYS_REFRESH));
}

export function dispatchGyanDailyChecklistRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EDUBLAST_GYAN_DAILY_CHECKLIST_REFRESH));
}
