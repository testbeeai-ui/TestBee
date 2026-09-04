export type GradeableQuestion = {
  id: string;
  options: string[];
  correct_index: number;
};

export type GradeResult = {
  correct: number;
  total: number;
  scorePct: number;
};

function shuffle<T>(items: T[], rng: () => number): T[] {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = next[i];
    next[i] = next[j]!;
    next[j] = tmp!;
  }
  return next;
}

export function shuffleQuestionOptions<T extends GradeableQuestion>(
  question: T,
  rng: () => number = Math.random,
): T {
  const correctText = question.options[question.correct_index];
  const options = shuffle(question.options, rng);
  const correctIndex = correctText == null ? question.correct_index : options.indexOf(correctText);
  return {
    ...question,
    options,
    correct_index: correctIndex < 0 ? question.correct_index : correctIndex,
  };
}

export function toPublicPaperQuestion(
  question: GradeableQuestion & { stem: string; discipline_id: string },
  tag: string,
): {
  id: string;
  tag: string;
  q: string;
  options: string[];
} {
  const shuffled = shuffleQuestionOptions(question);
  return {
    id: shuffled.id,
    tag,
    q: shuffled.stem,
    options: shuffled.options,
  };
}

export function gradeClientSelection(
  question: GradeableQuestion,
  selected: string,
  clientOptions: string[],
): { correct: boolean; correctIndex?: number } {
  const expected = question.options[question.correct_index];
  const correct = expected != null && selected === expected;
  if (expected == null) return { correct: false };
  const correctIndex = clientOptions.indexOf(expected);
  return correctIndex >= 0 ? { correct, correctIndex } : { correct };
}

export function gradeMockAnswers(
  questions: GradeableQuestion[],
  answers: Record<string, string>,
): GradeResult {
  const total = questions.length;
  let correct = 0;
  for (const question of questions) {
    const expected = question.options[question.correct_index];
    const selected = answers[question.id];
    if (typeof selected === "string" && expected != null && selected === expected) {
      correct += 1;
    }
  }
  const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correct, total, scorePct };
}
