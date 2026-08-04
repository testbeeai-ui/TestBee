/**
 * Server-side grading for Dive Quiz / Numerals / Learning Outcomes.
 * Scores stored on dive_hub_progress must come from this path, not client claims.
 */

import { getAdvancedSetBounds, type AdvancedQuizSetIndex } from "@/lib/play/quiz/advancedQuizSets";

export type GradableQuestion = {
  correctAnswer: string;
};

export type DiveAssessmentKind = "quiz" | "numerals" | "outcomes";

export function parseAnswerMap(raw: unknown): Record<number, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<number, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const idx = Number(k);
    if (!Number.isInteger(idx) || idx < 0) continue;
    if (typeof v !== "string") continue;
    const ans = v.trim();
    if (!ans) continue;
    out[idx] = ans;
  }
  return out;
}

export function scorePctFromAnswers(
  questions: GradableQuestion[],
  answers: Record<number, string>
): { correct: number; total: number; scorePct: number } {
  const total = questions.length;
  if (total === 0) return { correct: 0, total: 0, scorePct: 0 };
  let correct = 0;
  for (let i = 0; i < total; i++) {
    const q = questions[i];
    if (!q) continue;
    const given = answers[i];
    if (given != null && given === q.correctAnswer) correct += 1;
  }
  return {
    correct,
    total,
    scorePct: Math.round((100 * correct) / total),
  };
}

export function parseBitsQuestions(raw: unknown): GradableQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: GradableQuestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const correctAnswer = typeof o.correctAnswer === "string" ? o.correctAnswer.trim() : "";
    if (!correctAnswer) continue;
    out.push({ correctAnswer });
  }
  return out;
}

export function parseFormulaBitsQuestions(raw: unknown, formulaIndex: number): GradableQuestion[] {
  if (!Array.isArray(raw)) return [];
  const formula = raw[formulaIndex];
  if (!formula || typeof formula !== "object") return [];
  const bits = (formula as Record<string, unknown>).bitsQuestions;
  return parseBitsQuestions(bits);
}

export function sliceQuizSetQuestions(
  all: GradableQuestion[],
  setIndex: AdvancedQuizSetIndex | null
): GradableQuestion[] {
  if (all.length === 0) return [];
  if (setIndex == null) return all;
  const { start, end } = getAdvancedSetBounds(all.length, setIndex);
  return all.slice(start, end);
}

export function parseQuizSetIndex(raw: unknown): AdvancedQuizSetIndex | null {
  const n = Number(raw);
  if (![1, 2, 3, 4, 5, 6].includes(n)) return null;
  return n as AdvancedQuizSetIndex;
}
