import { describe, expect, it } from "vitest";

import { gradeMockAnswers, shuffleQuestionOptions } from "./paper-grade";

describe("shuffleQuestionOptions", () => {
  it("remaps correct_index to the shuffled option", () => {
    const original = {
      id: "q1",
      options: ["alpha", "bravo", "charlie", "delta"],
      correct_index: 1,
    };
    const shuffled = shuffleQuestionOptions(original, () => 0.9);
    expect(shuffled.options).toHaveLength(4);
    expect(new Set(shuffled.options)).toEqual(new Set(original.options));
    expect(shuffled.options[shuffled.correct_index]).toBe("bravo");
  });
});

describe("gradeMockAnswers", () => {
  const questions = [
    { id: "a", options: ["w", "x", "y", "z"], correct_index: 2 },
    { id: "b", options: ["p", "q", "r", "s"], correct_index: 0 },
  ];

  it("re-grades from stored correct_index and option text, ignoring a client percent", () => {
    const result = gradeMockAnswers(questions, { a: "y", b: "p" });
    expect(result).toEqual({ correct: 2, total: 2, scorePct: 100 });
  });

  it("counts a missing or wrong selection as incorrect", () => {
    const result = gradeMockAnswers(questions, { a: "w" });
    expect(result.correct).toBe(0);
    expect(result.total).toBe(2);
    expect(result.scorePct).toBe(0);
  });
});
