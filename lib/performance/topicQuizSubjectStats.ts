import { questions } from "@/data/questions";
import { parseEngagementDraftDashboardContributions } from "@/lib/dashboard/parseEngagementDraftDashboardContributions";
import { parseBitsTestAttemptsStore } from "@/lib/play/bits/parseBitsTestAttemptsStore";
import type { Subject } from "@/types";

export type TopicQuizSubjectStat = {
  subject: Subject;
  /** Submitted topic quizzes + in-progress graded drafts (one per storage key). */
  quizCount: number;
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  /** Rounded percent: correct ÷ total answered (matches Performance page). */
  accuracy: number;
};

const PCM: Subject[] = ["physics", "chemistry", "math"];

export const TOPIC_QUIZ_SUBJECT_LABEL: Record<Subject, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  math: "Maths",
};

export const TOPIC_QUIZ_SUBJECT_BAR_COLOR: Record<Subject, string> = {
  physics: "bg-blue-500",
  chemistry: "bg-amber-500",
  math: "bg-violet-500",
};

function submittedBitsKeysFromStore(raw: unknown): Set<string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return new Set();
  return new Set(Object.keys(raw as Record<string, unknown>));
}

/**
 * Topic-quiz accuracy by PCM — same rollup as Performance → “Quiz breakdown by subject”.
 * Includes submitted `bits_test_attempts`, in-progress graded `subtopic_engagement`, and optional Play Question Gun results.
 */
export function buildTopicQuizSubjectStats(input: {
  bitsAttemptsJson: unknown;
  subtopicEngagementJson: unknown;
  playResults?: Array<{ questionId: string; isCorrect: boolean }>;
}): TopicQuizSubjectStat[] {
  const bitsAttemptRows = parseBitsTestAttemptsStore(input.bitsAttemptsJson);
  const submittedBitsKeys = submittedBitsKeysFromStore(input.bitsAttemptsJson);
  const engagementDraftRows = parseEngagementDraftDashboardContributions(
    input.subtopicEngagementJson,
    submittedBitsKeys
  );
  const playResults = input.playResults ?? [];

  return PCM.map((subject) => {
    const bitsRows = bitsAttemptRows.filter((r) => r.subject === subject);
    const drafts = engagementDraftRows.filter((r) => r.subject === subject);
    const quizCount = bitsRows.length + drafts.length;

    const bitsCorrect = bitsRows.reduce((s, r) => s + r.correctCount, 0);
    const bitsWrong = bitsRows.reduce((s, r) => s + r.wrongCount, 0);
    const bitsAnswered = bitsCorrect + bitsWrong;
    const bitsSkipped = bitsRows.reduce(
      (s, r) => s + Math.max(0, r.totalQuestions - r.correctCount - r.wrongCount),
      0
    );

    const dAnswered = drafts.reduce((s, d) => s + d.answered, 0);
    const dCorrect = drafts.reduce((s, d) => s + d.correct, 0);
    const dWrong = drafts.reduce((s, d) => s + d.wrong, 0);
    const dSkipped = drafts.reduce((s, d) => s + d.skipped, 0);

    const subjectQIds = questions.filter((q) => q.subject === subject).map((q) => q.id);
    const subjectResults = playResults.filter((r) => subjectQIds.includes(r.questionId));
    const playTotal = subjectResults.length;
    const playCorrect = subjectResults.filter((r) => r.isCorrect).length;
    const playWrong = playTotal - playCorrect;

    const total = bitsAnswered + dAnswered + playTotal;
    const correct = bitsCorrect + dCorrect + playCorrect;
    const wrong = bitsWrong + dWrong + playWrong;
    const skipped = bitsSkipped + dSkipped;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    return { subject, quizCount, total, correct, wrong, skipped, accuracy };
  });
}

export function totalTopicQuizzesTaken(stats: TopicQuizSubjectStat[]): number {
  return stats.reduce((s, r) => s + r.quizCount, 0);
}
