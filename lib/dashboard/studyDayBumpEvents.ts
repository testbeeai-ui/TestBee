/** Fired after study day totals change so dashboards can refetch quietly. */
export const EDUBLAST_STUDY_DAYS_REFRESH = "edublast-study-days-refresh";

export type StudyDayBumpedDetail = { day: string; deltaMs: number };

export function dispatchStudyDayBumped(_detail: StudyDayBumpedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EDUBLAST_STUDY_DAYS_REFRESH));
}
