import type { PlayQuestionRow } from "@/types";

/**
 * Randomize MCQ option order while preserving which choice is correct.
 * Keeps DB rows unchanged; call when presenting a question so the correct
 * answer is not always slot A (e.g. mental_math seed used index 0 for all).
 */
export function shufflePlayQuestionOptions(q: PlayQuestionRow): PlayQuestionRow {
  const raw = q.options;
  if (!Array.isArray(raw) || raw.length < 2) {
    return { ...q, correct_answer_index: -1, explanation: null, optionOriginIndexes: raw.map((_, i) => i) };
  }

  const options = raw.map((o) => String(o));
  const tagged = options.map((text, i) => ({ text, i }));
  for (let k = tagged.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    const tmp = tagged[k]!;
    tagged[k] = tagged[j]!;
    tagged[j] = tmp;
  }

  return {
    ...q,
    options: tagged.map((t) => t.text),
    optionOriginIndexes: tagged.map((t) => t.i),
    correct_answer_index: -1,
    explanation: null,
  };
}
