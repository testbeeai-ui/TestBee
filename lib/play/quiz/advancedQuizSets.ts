/**
 * Advanced topic quiz is split into up to six sequential sets: 5 + 5 + 5 + 5 + 5 + remainder.
 * Question indices are global into the full MCQ list.
 */

export type AdvancedQuizSetIndex = 1 | 2 | 3 | 4 | 5 | 6;

export const ADVANCED_QUIZ_STANDARD_SET_SIZE = 5;
export const ADVANCED_QUIZ_MAX_SETS = 6;

export const ADVANCED_QUIZ_SET_INDICES: AdvancedQuizSetIndex[] = [1, 2, 3, 4, 5, 6];

export const ADVANCED_QUIZ_BANK_SET_INDICES: AdvancedQuizSetIndex[] = [2, 3, 4, 5, 6];

function standardSetsPrefixLength(total: number): number {
  const n = Math.max(0, Math.floor(total));
  return Math.min(ADVANCED_QUIZ_STANDARD_SET_SIZE * (ADVANCED_QUIZ_MAX_SETS - 1), n);
}

export function getAdvancedSetBounds(
  total: number,
  setIndex: AdvancedQuizSetIndex
): { start: number; end: number; length: number } {
  const n = Math.max(0, Math.floor(total));
  let start = 0;

  for (let i = 1; i < setIndex; i++) {
    const prev = getAdvancedSetBounds(n, i as AdvancedQuizSetIndex);
    start += prev.length;
  }

  if (setIndex <= ADVANCED_QUIZ_MAX_SETS - 1) {
    const length = Math.min(ADVANCED_QUIZ_STANDARD_SET_SIZE, Math.max(0, n - start));
    return { start, end: start + length, length };
  }

  const length = Math.max(0, n - start);
  return { start, end: start + length, length };
}

/** Non-empty set indices in order (for UI rows, hydration, checklist). */
export function getNonEmptyAdvancedSetIndices(total: number): AdvancedQuizSetIndex[] {
  return ADVANCED_QUIZ_SET_INDICES.filter((s) => getAdvancedSetBounds(total, s).length > 0);
}

/** True when this set is the last non-empty set for the deck. */
export function isLastNonEmptyAdvancedSet(
  total: number,
  setIndex: AdvancedQuizSetIndex
): boolean {
  const indices = getNonEmptyAdvancedSetIndices(total);
  if (indices.length === 0) return false;
  return indices[indices.length - 1] === setIndex;
}

/** Use multi-set flow when advanced level has more than one 5-question chunk. */
export function isAdvancedMultiSet(difficultyLevel: string, total: number): boolean {
  return difficultyLevel === "advanced" && total > ADVANCED_QUIZ_STANDARD_SET_SIZE;
}

export function getSetLengthForTotal(total: number, setIndex: AdvancedQuizSetIndex): number {
  return getAdvancedSetBounds(total, setIndex).length;
}

export function isAdvancedQuizSetIndex(n: number): n is AdvancedQuizSetIndex {
  return Number.isInteger(n) && n >= 1 && n <= ADVANCED_QUIZ_MAX_SETS;
}

/** True when any question-bank set (2–6) has questions for this deck. */
export function hasAdvancedQuestionBankSets(total: number): boolean {
  return ADVANCED_QUIZ_BANK_SET_INDICES.some((s) => getAdvancedSetBounds(total, s).length > 0);
}

/** Sum of lengths for sets 1..5 (set 6 starts after this offset when non-empty). */
export function getAdvancedStandardPrefixLength(total: number): number {
  return standardSetsPrefixLength(total);
}
