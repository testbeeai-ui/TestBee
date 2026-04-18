import type { AnswerResult } from "@/types";
import { contributionDayKeyFromTimestamp } from "@/lib/activityHeatmap";
import type { ParsedBitsAttemptRow } from "@/lib/parseBitsTestAttemptsStore";

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDaysLocal(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function localDayKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local calendar day bounds as ISO strings for API filters (e.g. daily checklist, doubt_saves). */
export function localDayBoundsIso(now = new Date()): { today: string; dayStart: string; dayEnd: string } {
  const start = startOfLocalDay(now);
  const end = addDaysLocal(start, 1);
  return {
    today: localDayKeyFromDate(start),
    dayStart: start.toISOString(),
    dayEnd: end.toISOString(),
  };
}

/**
 * Per-local-day activity counts: play answers + topic quiz submits + in-progress engagement graded counts.
 * Keys are `YYYY-MM-DD` (local).
 */
export function buildActivityCountByDay(
  allResults: AnswerResult[],
  bitsAttemptRows: ParsedBitsAttemptRow[],
  subtopicEngagementRaw: unknown,
  submittedBitsKeys: Set<string>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of allResults) {
    const k = contributionDayKeyFromTimestamp(r.timestamp);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const row of bitsAttemptRows) {
    if (typeof row.submittedAtMs !== "number") continue;
    const n = row.correctCount + row.wrongCount;
    if (n <= 0) continue;
    const key = contributionDayKeyFromTimestamp(row.submittedAtMs);
    counts.set(key, (counts.get(key) ?? 0) + n);
  }
  if (subtopicEngagementRaw && typeof subtopicEngagementRaw === "object" && !Array.isArray(subtopicEngagementRaw)) {
    for (const [engKey, value] of Object.entries(subtopicEngagementRaw as Record<string, unknown>)) {
      if (submittedBitsKeys.has(engKey)) continue;
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const row = value as Record<string, unknown>;
      if (Number(row.v) !== 1) continue;
      const updatedAt = typeof row.updatedAt === "string" ? row.updatedAt : "";
      const t = Date.parse(updatedAt);
      if (!Number.isFinite(t)) continue;
      const bits = row.bits;
      if (!bits || typeof bits !== "object" || Array.isArray(bits)) continue;
      const graded = (bits as Record<string, unknown>).graded;
      if (!graded || typeof graded !== "object" || Array.isArray(graded)) continue;
      const answered = Number((graded as Record<string, unknown>).answered);
      if (!Number.isFinite(answered) || answered <= 0) continue;
      const key = contributionDayKeyFromTimestamp(t);
      counts.set(key, (counts.get(key) ?? 0) + Math.min(Math.trunc(answered), 200));
    }
  }
  return counts;
}

/** Rough study minutes from activity count until per-minute tracking ships. */
export function estimatedStudyMinutesFromCount(count: number): number {
  return Math.max(0, Math.trunc(count)) * 10;
}

export function activityGreenLevel(estimatedMinutes: number): 0 | 1 | 2 | 3 | 4 {
  if (estimatedMinutes < 10) return 0;
  if (estimatedMinutes < 30) return 1;
  if (estimatedMinutes < 60) return 2;
  if (estimatedMinutes < 90) return 3;
  return 4;
}

/** Heatmap intensity from saved `active_ms` (matches streak: any ms > 0 is a non-empty day). */
export function activityGreenLevelFromStudyMs(activeMs: number): 0 | 1 | 2 | 3 | 4 {
  if (!Number.isFinite(activeMs) || activeMs <= 0) return 0;
  const minutes = activeMs / 60_000;
  if (minutes < 10) return 1;
  if (minutes < 30) return 2;
  if (minutes < 60) return 3;
  return 4;
}

/** Short label for a heatmap cell (sub-minute still visible). */
export function formatSavedStudyMinutesLabel(activeMs: number): string {
  if (!Number.isFinite(activeMs) || activeMs <= 0) return "—";
  if (activeMs < 60_000) return "<1m";
  const minutes = activeMs / 60_000;
  if (minutes < 100) {
    const rounded = Math.round(minutes * 10) / 10;
    return `${rounded}m`;
  }
  return `${Math.round(minutes)}m`;
}

/** Tooltip line: exact saved duration from Supabase `active_ms`. */
export function formatStudyMsForTooltip(activeMs: number): string {
  if (!Number.isFinite(activeMs) || activeMs <= 0) return "No saved study time yet";
  const totalSec = Math.round(activeMs / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  if (mm <= 0) return `${ss}s saved toward streak (play + topic quizzes)`;
  if (ss === 0) return `${mm}m saved toward streak (play + topic quizzes)`;
  return `${mm}m ${ss}s saved toward streak (play + topic quizzes)`;
}

/** Tooltip line: dwell time from Supabase `presence_ms` (+ optional live buffer). */
export function formatPresenceMsForTooltip(presenceMs: number): string {
  if (!Number.isFinite(presenceMs) || presenceMs <= 0) return "No on-site time yet (tab must be visible)";
  const totalSec = Math.round(presenceMs / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  if (mm <= 0) return `${ss}s on site (this tab in focus)`;
  if (ss === 0) return `${mm}m on site (this tab in focus)`;
  return `${mm}m ${ss}s on site (this tab in focus)`;
}

export function countConsecutiveActiveDaysEndingToday(
  counts: ReadonlyMap<string, number>,
  today: Date = new Date()
): number {
  let d = startOfLocalDay(today);
  let streak = 0;
  for (let i = 0; i < 730; i++) {
    const k = localDayKeyFromDate(d);
    const c = counts.get(k) ?? 0;
    if (c <= 0) break;
    streak++;
    d = addDaysLocal(d, -1);
  }
  return streak;
}

export function countActiveDaysInMonth(counts: ReadonlyMap<string, number>, ref: Date = new Date()): number {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  let n = 0;
  for (let day = 1; day <= last; day++) {
    const k = localDayKeyFromDate(new Date(y, m, day));
    if ((counts.get(k) ?? 0) > 0) n++;
  }
  return n;
}
