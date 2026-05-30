import type { MockSubjectScore } from "@/lib/mock/mockTestAttemptTypes";
import type { Subject } from "@/types";

export type RecordCbseChapterQuizAttemptInput = {
  accessToken?: string | null;
  paperId: string;
  paperSlug: string;
  paperTitle: string;
  subject: Subject;
  correct: number;
  total: number;
  durationSeconds: number;
  /** When set, must match community share `attemptKey` for RDM bonus dedup. */
  attemptKey?: string;
};

/** Persist a finished CBSE chapter quiz to mock_test_attempts (Show history). */
export async function recordCbseChapterQuizAttempt(
  input: RecordCbseChapterQuizAttemptInput
): Promise<void> {
  const {
    accessToken,
    paperId,
    paperSlug,
    paperTitle,
    subject,
    correct,
    total,
    durationSeconds,
    attemptKey: attemptKeyInput,
  } = input;
  if (total <= 0 || correct < 0 || correct > total) return;

  const attemptKey = attemptKeyInput?.trim() || `${String(Date.now())}:${paperId}`;
  const percent = Math.round((correct / total) * 1000) / 10;
  const subjectBreakdown: MockSubjectScore[] = [{ subject, correct, total, percent }];

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  await fetch("/api/mock/record-attempt", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({
      attemptKey,
      sessionKind: "mcq_chapter",
      catalogPaperId: paperId,
      pastPaperId: null,
      paperSlug,
      paperTitle,
      correct,
      total,
      durationSeconds,
      subjectBreakdown,
    }),
  });
}
