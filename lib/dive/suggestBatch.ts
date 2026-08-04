/**
 * Rotate batches of 5 subtopics with refresh; pad with earlier when short.
 */

export type DiveSubtopicCandidate = {
  id: string;
  name: string;
  topicTitle: string;
  chapterTitle: string;
  /** Relative % of chapter (integer). */
  relativePct: number;
  /** Short meta line for the suggest card. */
  description: string;
};

export type SuggestBatchState = {
  shownIndices: number[];
};

export type SuggestBatchResult = {
  indices: number[];
  seenBefore: Set<number>;
  state: SuggestBatchState;
};

const BATCH_SIZE = 5;

function shuffleCopy(arr: number[], seed: number): number[] {
  const out = [...arr];
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

export function buildShuffledOrder(poolSize: number, seedKey: string): number[] {
  const indices = Array.from({ length: poolSize }, (_, i) => i);
  let seed = 0;
  for (let i = 0; i < seedKey.length; i++) seed = (seed * 31 + seedKey.charCodeAt(i)) >>> 0;
  return shuffleCopy(indices, seed || 1);
}

export function getNextSuggestBatch(
  order: number[],
  prev: SuggestBatchState
): SuggestBatchResult {
  const total = order.length;
  if (total === 0) {
    return { indices: [], seenBefore: new Set(), state: prev };
  }

  const target = Math.min(BATCH_SIZE, total);
  const shownSet = new Set(prev.shownIndices);
  const unseenInOrder = order.filter((idx) => !shownSet.has(idx));
  const batch: number[] = [];
  const seenBefore = new Set<number>();

  for (const idx of unseenInOrder) {
    if (batch.length >= target) break;
    batch.push(idx);
  }

  if (batch.length < target) {
    const padFrom = [...prev.shownIndices, ...order].filter((idx) => !batch.includes(idx));
    const uniquePad: number[] = [];
    for (const idx of padFrom) {
      if (!uniquePad.includes(idx)) uniquePad.push(idx);
    }
    for (const idx of uniquePad) {
      if (batch.length >= target) break;
      batch.push(idx);
      seenBefore.add(idx);
    }
  }

  const nextShown = [...prev.shownIndices];
  for (const idx of batch) {
    if (!nextShown.includes(idx)) nextShown.push(idx);
  }

  return {
    indices: batch,
    seenBefore,
    state: { shownIndices: nextShown },
  };
}

export function resetSuggestBatch(): SuggestBatchState {
  return { shownIndices: [] };
}
