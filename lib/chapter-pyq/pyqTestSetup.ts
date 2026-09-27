export type PyqTestSetup =
  | { ok: true; questionCount: number; minutesPerQuestion: number }
  | { ok: false };

function wholeNumber(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
}

export function parsePyqTestSetup(
  countRaw: string,
  minutesRaw: string,
  maxQuestions: number
): PyqTestSetup {
  const questionCount = wholeNumber(countRaw);
  const minutesPerQuestion = wholeNumber(minutesRaw);
  if (
    questionCount === null ||
    minutesPerQuestion === null ||
    maxQuestions < 1 ||
    questionCount < 1 ||
    questionCount > maxQuestions ||
    minutesPerQuestion < 1
  ) {
    return { ok: false };
  }
  return { ok: true, questionCount, minutesPerQuestion };
}

export function pyqTestTotalMinutes(questionCount: number, minutesPerQuestion: number): number {
  return questionCount * minutesPerQuestion;
}

export function drawPyqTestQuestions<T>(
  items: readonly T[],
  count: number,
  random: () => number = Math.random
): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const current = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = current;
  }
  return copy.slice(0, Math.max(0, Math.min(count, copy.length)));
}

export function pyqTestMarks(correct: number, wrong: number): number {
  return correct * 4 + wrong * -1;
}

export function pyqTestMaxMarks(questionCount: number): number {
  return questionCount * 4;
}
