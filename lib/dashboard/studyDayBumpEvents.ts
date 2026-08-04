import { invalidateStudyDaysCache } from "@/lib/dashboard/studyDaysClient";

/** Fired after study day totals change so dashboards can refetch quietly. */
export const EDUBLAST_STUDY_DAYS_REFRESH = "edublast-study-days-refresh";

/** Gyan++ rail only — avoids refetching home daily-checklist on every focus flush. */
export const EDUBLAST_GYAN_DAILY_CHECKLIST_REFRESH = "edublast-gyan-daily-checklist-refresh";

/** Coalesce burst refreshes (presence flush + realtime + focus) into one wave. */
const STUDY_DAYS_REFRESH_DEBOUNCE_MS = 1_500;

export type StudyDayBumpedDetail = { day: string; deltaMs: number };

/**
 * Why study day totals changed.
 *
 * `presence` means "the tab was open for another N seconds", which fires every ~22s and
 * cannot affect anything except the study-time totals themselves. `activity` means a
 * lesson, quiz, or play action completed, which can also change checklist state.
 *
 * Listeners that fetch more than study days (the dashboard's daily-checklist reload) use
 * this to ignore the presence stream instead of issuing a request every 22 seconds.
 */
export type StudyDaysRefreshReason = "presence" | "activity";

export type StudyDaysRefreshDetail = { reason: StudyDaysRefreshReason };

let studyDaysRefreshTimer: ReturnType<typeof setTimeout> | null = null;
/** A coalesced wave counts as `activity` if any contributing bump was activity. */
let pendingRefreshReason: StudyDaysRefreshReason = "presence";

export function studyDaysRefreshReason(event: Event): StudyDaysRefreshReason {
  const detail = (event as CustomEvent<StudyDaysRefreshDetail | undefined>).detail;
  return detail?.reason === "presence" ? "presence" : "activity";
}

/** Debounced refresh — use after writes so listeners fetch once, not N times. */
export function notifyStudyDaysRefresh(reason: StudyDaysRefreshReason = "activity"): void {
  if (typeof window === "undefined") return;
  if (reason === "activity") pendingRefreshReason = "activity";
  if (studyDaysRefreshTimer != null) clearTimeout(studyDaysRefreshTimer);
  studyDaysRefreshTimer = setTimeout(() => {
    studyDaysRefreshTimer = null;
    const detail: StudyDaysRefreshDetail = { reason: pendingRefreshReason };
    pendingRefreshReason = "presence";
    window.dispatchEvent(new CustomEvent(EDUBLAST_STUDY_DAYS_REFRESH, { detail }));
  }, STUDY_DAYS_REFRESH_DEBOUNCE_MS);
}

export function dispatchStudyDayBumped(_detail: StudyDayBumpedDetail): void {
  if (typeof window === "undefined") return;
  invalidateStudyDaysCache();
  notifyStudyDaysRefresh("activity");
}

export function dispatchGyanDailyChecklistRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EDUBLAST_GYAN_DAILY_CHECKLIST_REFRESH));
}
