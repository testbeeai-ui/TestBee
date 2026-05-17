import { questions as questionBank } from "@/data/questions";
import type { Subject } from "@/types";

export const QUICK_DURATIONS = [60, 90, 180] as const;

export function estimateQuickQuestionCount(
  subjects: Subject[],
  classLevel: number,
  durationMin: number
): number {
  const eligible = questionBank.filter(
    (q) => subjects.includes(q.subject) && q.classLevel <= classLevel
  ).length;
  return Math.max(1, Math.min(Math.ceil(durationMin / 2.5), eligible || 1));
}

/** Dashboard spotlight — matches `scripts/import-jee-main-mock-csv.ts` slug. */
export const FEATURED_DASHBOARD_PYQ_SLUG = "jee-main-2019-01-10-shift-1";

export const subjectEmojis: Record<Subject, string> = {
  physics: "⚡",
  chemistry: "🧪",
  math: "📐",
};
