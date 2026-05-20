import type { PlayQuestionRow } from "@/types";

/**
 * Randomize MCQ option order while preserving which choice is correct.
 * Keeps DB rows unchanged; call when presenting a question so the correct
 * answer is not always slot A (e.g. mental_math seed used index 0 for all).
 */
export function shufflePlayQuestionOptions(q: PlayQuestionRow): PlayQuestionRow {
  const raw = q.options;
  if (!Array.isArray(raw) || raw.length < 2) return q;

  const options = raw.map((o) => String(o));
  const n = options.length;
  let oldCorrect = Math.floor(Number(q.correct_answer_index));
  if (!Number.isFinite(oldCorrect) || oldCorrect < 0 || oldCorrect >= n) {
    oldCorrect = 0;
  }

  const tagged = options.map((text, i) => ({ text, i }));
  for (let k = tagged.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    const tmp = tagged[k]!;
    tagged[k] = tagged[j]!;
    tagged[j] = tmp;
  }

  const newCorrect = tagged.findIndex((t) => t.i === oldCorrect);
  return {
    ...q,
    options: tagged.map((t) => t.text),
    correct_answer_index: newCorrect >= 0 ? newCorrect : 0,
  };
}
