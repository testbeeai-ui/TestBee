import type { EduDecaMockLevelId, QuizQuestion } from "./question-bank";
import { asMockAnswers } from "./pause-attempt";
import type { EduDecaMockInProgress } from "./session-store";

export function quizFromPaperAndAnswers(
  level: EduDecaMockLevelId,
  set: number,
  questions: QuizQuestion[],
  rawAnswers: unknown
): EduDecaMockInProgress {
  const answers = asMockAnswers(rawAnswers);
  let score = 0;
  let firstUnanswered = questions.length;
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    if (!question) continue;
    const selected = answers[question.id];
    if (typeof selected !== "string") {
      if (firstUnanswered === questions.length) firstUnanswered = index;
      continue;
    }
    if (
      typeof question.correctIndex === "number" &&
      question.options[question.correctIndex] === selected
    ) {
      score += 1;
    }
  }

  const idx = questions.length === 0 ? 0 : Math.min(firstUnanswered, questions.length - 1);
  const current = questions[idx];
  const pickedRaw = current ? answers[current.id] : undefined;
  const pickedIndex =
    current && typeof pickedRaw === "string" ? current.options.indexOf(pickedRaw) : -1;
  const answered = pickedIndex >= 0;

  return {
    level,
    set,
    idx,
    score,
    questions,
    answers,
    answered,
    pickedIndex: answered ? pickedIndex : null,
  };
}

/** Merge a live-check key into whatever quiz state is current; never rewind idx/answers. */
export function applyQuestionCheck(
  current: EduDecaMockInProgress,
  questionId: string,
  pickedIndex: number,
  correctIndex: number
): EduDecaMockInProgress | null {
  const target = current.questions.find((item) => item.id === questionId);
  if (!target || target.correctIndex != null) return null;
  return {
    ...current,
    score: pickedIndex === correctIndex ? current.score + 1 : current.score,
    questions: current.questions.map((item) =>
      item.id === questionId ? { ...item, correctIndex } : item
    ),
  };
}
