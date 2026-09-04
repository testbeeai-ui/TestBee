import type { EduDecaMockLevelId, QuizQuestion } from "./question-bank";
import { asMockAnswers } from "./pause-attempt";
import type { EduDecaMockInProgress } from "./session-store";

export function quizFromPaperAndAnswers(
  level: EduDecaMockLevelId,
  set: number,
  questions: QuizQuestion[],
  rawAnswers: unknown,
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
    if (question.options[question.correctIndex] === selected) score += 1;
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
