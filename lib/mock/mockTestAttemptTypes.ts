import type { Subject } from "@/types";

export type MockLibraryHistoryKind = "past_paper" | "mock_paper" | "quick_mock" | "mcq_chapter";

export type MockSubjectScore = {
  subject: Subject;
  correct: number;
  total: number;
  percent: number;
};

export type RecordMockAttemptPayload = {
  attemptKey: string;
  sessionKind: MockLibraryHistoryKind;
  catalogPaperId?: string | null;
  pastPaperId?: string | null;
  paperSlug?: string | null;
  paperTitle: string;
  correct: number;
  total: number;
  durationSeconds?: number;
  subjectBreakdown: MockSubjectScore[];
};

export function subjectBreakdownFromSection(
  section: Record<string, { correct: number; total: number }>
): MockSubjectScore[] {
  const subjects: Subject[] = ["physics", "chemistry", "math"];
  const out: MockSubjectScore[] = [];
  for (const subject of subjects) {
    const slice = section[subject];
    if (!slice || slice.total <= 0) continue;
    out.push({
      subject,
      correct: slice.correct,
      total: slice.total,
      percent: Math.round((slice.correct / slice.total) * 1000) / 10,
    });
  }
  return out;
}

export function parseSubjectBreakdownJson(raw: unknown): MockSubjectScore[] {
  if (!Array.isArray(raw)) return [];
  const out: MockSubjectScore[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const subject = row.subject;
    const correct = row.correct;
    const total = row.total;
    const percent = row.percent;
    if (subject !== "physics" && subject !== "chemistry" && subject !== "math") {
      continue;
    }
    if (
      typeof correct !== "number" ||
      typeof total !== "number" ||
      total <= 0 ||
      !Number.isFinite(correct) ||
      !Number.isFinite(total)
    ) {
      continue;
    }
    const pct =
      typeof percent === "number" && Number.isFinite(percent)
        ? Math.round(percent * 10) / 10
        : Math.round((correct / total) * 1000) / 10;
    out.push({ subject, correct, total, percent: pct });
  }
  return out;
}
