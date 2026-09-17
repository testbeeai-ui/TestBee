import type { Question } from "@/types";

/**
 * JEE Main numeric entry accepts a value rounded to two decimals, so compare
 * with an absolute tolerance rather than `===` on floats.
 */
export const PYQ_NUMERIC_TOLERANCE = 0.01;

/**
 * `answer` is the value stored in the shells' `Record<string, number>`:
 * an option index for MCQ, the entered numeric value for `answerFormat === "numerical"`.
 *
 * The `answerFormat` branch comes first and is the only thing separating the two
 * comparisons. `correctAnswer === -1` is not a sentinel to lean on: it is a
 * reachable entered value, so reordering these two checks is a real bug.
 */
export function isPyqAnswerCorrect(q: Question, answer: number | undefined): boolean {
  if (answer === undefined || !Number.isFinite(answer)) return false;
  if (q.answerFormat === "numerical") {
    const expected = Number(String(q.numericAnswer ?? "").trim());
    if (!Number.isFinite(expected)) return false;
    return Math.abs(answer - expected) <= PYQ_NUMERIC_TOLERANCE;
  }
  return answer === q.correctAnswer;
}

export type PyqReviewVerdict = "skipped" | "correct" | "wrong";

export function pyqReviewVerdict(q: Question, answer: number | undefined): PyqReviewVerdict {
  if (answer === undefined || !Number.isFinite(answer)) return "skipped";
  return isPyqAnswerCorrect(q, answer) ? "correct" : "wrong";
}

/** Option body or entered number. `null` means the student left it blank. */
export function formatPyqStudentAnswer(q: Question, answer: number | undefined): string | null {
  if (answer === undefined || !Number.isFinite(answer)) return null;
  if (q.answerFormat === "numerical") return String(answer);
  return q.options[answer] ?? "";
}

/** Answer-key text from `correct_option` / `numerical_answer` on the mapped row. */
export function formatPyqCorrectAnswer(q: Question): string {
  if (q.answerFormat === "numerical") return String(q.numericAnswer ?? "").trim();
  const idx = q.correctAnswer;
  if (typeof idx !== "number" || idx < 0) return "";
  return q.options[idx] ?? "";
}

export type PyqReviewFilter = "all" | PyqReviewVerdict;

export function pyqReviewFilterMatches(verdict: PyqReviewVerdict, filter: PyqReviewFilter): boolean {
  return filter === "all" || verdict === filter;
}
