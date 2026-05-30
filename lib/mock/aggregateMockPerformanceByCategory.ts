import type {
  MockLibraryHistoryEntry,
  MockLibraryHistoryKind,
} from "@/lib/mock/fetchMockLibraryHistory";
import type { MockSubjectScore } from "@/lib/mock/mockTestAttemptTypes";
import type { Subject } from "@/types";

export type ExamCategoryKey = "cbse" | "jee-main" | "jee-advanced" | "kcet";

export type CategorySubjectMarks = {
  subject: Subject;
  correct: number;
  total: number;
};

export type CategoryPerformanceStats = {
  testCount: number;
  /** Sum of correct answers across all attempts in this category. */
  totalCorrect: number;
  /** Sum of question counts across all attempts. */
  totalQuestions: number;
  /** Best single-attempt correct/total (by ratio). */
  bestCorrect: number;
  bestTotal: number;
  bySubject: CategorySubjectMarks[];
};

const PCM: Subject[] = ["physics", "chemistry", "math"];

function titleLower(title: string): string {
  return title.trim().toLowerCase();
}

/** Route each attempt to an exam category (CBSE = past + institute mock papers). */
export function examCategoryForAttempt(entry: MockLibraryHistoryEntry): ExamCategoryKey | null {
  const t = titleLower(entry.title);

  if (t.includes("kcet")) return "kcet";
  if (t.includes("jee advanced") || t.includes("jee adv")) return "jee-advanced";
  if (t.includes("jee main")) return "jee-main";

  if (entry.kind === "past_paper" || entry.kind === "mock_paper" || entry.kind === "mcq_chapter") {
    return "cbse";
  }

  return null;
}

function mergeSubjectScores(
  target: Map<Subject, { correct: number; total: number }>,
  scores: MockSubjectScore[]
) {
  for (const s of scores) {
    if (s.total <= 0) continue;
    const prev = target.get(s.subject) ?? { correct: 0, total: 0 };
    target.set(s.subject, {
      correct: prev.correct + s.correct,
      total: prev.total + s.total,
    });
  }
}

function aggregateList(attempts: MockLibraryHistoryEntry[]): CategoryPerformanceStats {
  let totalCorrect = 0;
  let totalQuestions = 0;
  let bestRatio = -1;
  let bestCorrect = 0;
  let bestTotal = 0;
  const subjectMap = new Map<Subject, { correct: number; total: number }>();

  for (const a of attempts) {
    const c = a.correct ?? 0;
    const t = a.total ?? 0;
    if (t <= 0) continue;

    totalCorrect += c;
    totalQuestions += t;

    const ratio = c / t;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestCorrect = c;
      bestTotal = t;
    }

    if (a.subjectScores.length > 0) {
      mergeSubjectScores(subjectMap, a.subjectScores);
    }
  }

  const bySubject = PCM.map((subject) => {
    const row = subjectMap.get(subject);
    return {
      subject,
      correct: row?.correct ?? 0,
      total: row?.total ?? 0,
    };
  }).filter((row) => row.total > 0);

  return {
    testCount: attempts.length,
    totalCorrect,
    totalQuestions,
    bestCorrect,
    bestTotal,
    bySubject,
  };
}

const EMPTY: CategoryPerformanceStats = {
  testCount: 0,
  totalCorrect: 0,
  totalQuestions: 0,
  bestCorrect: 0,
  bestTotal: 0,
  bySubject: [],
};

/** Build per–exam-category stats from mock / past paper attempt history. */
export function aggregateMockPerformanceByCategory(
  entries: MockLibraryHistoryEntry[]
): Record<ExamCategoryKey, CategoryPerformanceStats> {
  const buckets: Record<ExamCategoryKey, MockLibraryHistoryEntry[]> = {
    cbse: [],
    "jee-main": [],
    "jee-advanced": [],
    kcet: [],
  };

  for (const entry of entries) {
    const cat = examCategoryForAttempt(entry);
    if (cat) buckets[cat].push(entry);
  }

  return {
    cbse: aggregateList(buckets.cbse),
    "jee-main": aggregateList(buckets["jee-main"]),
    "jee-advanced": aggregateList(buckets["jee-advanced"]),
    kcet: aggregateList(buckets.kcet),
  };
}

export function marksLabel(correct: number, total: number): string {
  if (total <= 0) return "—";
  return `${correct}/${total}`;
}
