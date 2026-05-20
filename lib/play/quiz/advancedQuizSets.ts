/**
 * Advanced topic quiz is split into three sequential sets: 10 + 10 + remainder.
 * Question indices are global into the full MCQ list.
 */

export type AdvancedQuizSetIndex = 1 | 2 | 3;

export function getAdvancedSetBounds(
  total: number,
  setIndex: AdvancedQuizSetIndex
): { start: number; end: number; length: number } {
  const n = Math.max(0, Math.floor(total));
  const s1 = Math.min(10, n);
  const s2 = Math.min(10, Math.max(0, n - 10));
  const s3 = Math.max(0, n - 20);
  if (setIndex === 1) return { start: 0, end: s1, length: s1 };
  if (setIndex === 2) return { start: s1, end: s1 + s2, length: s2 };
  return { start: s1 + s2, end: n, length: s3 };
}

/** Use 3-set flow only when there are enough questions to warrant multiple sets. */
export function isAdvancedMultiSet(difficultyLevel: string, total: number): boolean {
  return difficultyLevel === "advanced" && total > 10;
}

export function getSetLengthForTotal(total: number, setIndex: AdvancedQuizSetIndex): number {
  return getAdvancedSetBounds(total, setIndex).length;
}
