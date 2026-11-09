import { describe, expect, it } from "vitest";
import { shufflePlayQuestionOptions } from "@/lib/play/questions/shufflePlayQuestionOptions";
import type { PlayQuestionRow } from "@/types";

function row(options: PlayQuestionRow["options"]): PlayQuestionRow {
  return {
    id: "q1",
    content: { text: "Stem" },
    options,
    correct_answer_index: 0,
    explanation: "because",
    difficulty_rating: 1,
  };
}

describe("shufflePlayQuestionOptions", () => {
  it("leaves a non-array options value unshuffled", () => {
    const shuffled = shufflePlayQuestionOptions(row(null as unknown as string[]));
    expect(shuffled.options).toBeNull();
    expect(shuffled.optionOriginIndexes).toEqual([]);
    expect(shuffled.correct_answer_index).toBe(-1);
  });

  it("does not throw when options are missing", () => {
    expect(() => shufflePlayQuestionOptions(row(undefined as unknown as string[]))).not.toThrow();
  });
});
