import { describe, expect, it } from "vitest";
import {
  parseAnswerMap,
  parseBitsQuestions,
  scorePctFromAnswers,
  sliceQuizSetQuestions,
} from "@/lib/dive/gradeDiveAssessment";

describe("gradeDiveAssessment", () => {
  it("scores matching option text", () => {
    const questions = [{ correctAnswer: "A" }, { correctAnswer: "B" }];
    expect(scorePctFromAnswers(questions, { 0: "A", 1: "B" })).toEqual({
      correct: 2,
      total: 2,
      scorePct: 100,
    });
    expect(scorePctFromAnswers(questions, { 0: "A", 1: "C" })).toEqual({
      correct: 1,
      total: 2,
      scorePct: 50,
    });
  });

  it("parses answer maps and bits", () => {
    expect(parseAnswerMap({ "0": " x ", "1": 2, bad: "y" })).toEqual({ 0: "x" });
    expect(
      parseBitsQuestions([{ correctAnswer: "A", question: "q", options: [], solution: "" }, { foo: 1 }])
    ).toEqual([{ correctAnswer: "A" }]);
  });

  it("slices quiz set 1 to five questions when available", () => {
    const all = Array.from({ length: 12 }, (_, i) => ({ correctAnswer: String(i) }));
    expect(sliceQuizSetQuestions(all, 1)).toHaveLength(5);
  });
});
