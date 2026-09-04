import { describe, expect, it } from "vitest";

import type { QuizQuestion } from "./question-bank";
import { quizFromPaperAndAnswers } from "./resume-quiz";

const QUESTIONS: QuizQuestion[] = [
  {
    id: "mock-l1-s01-phy-01",
    tag: "PHYSICS",
    q: "Q1",
    options: ["alpha", "beta", "gamma", "delta"],
    correctIndex: 0,
  },
  {
    id: "mock-l1-s01-phy-02",
    tag: "PHYSICS",
    q: "Q2",
    options: ["w", "x", "y", "z"],
    correctIndex: 1,
  },
  {
    id: "mock-l1-s01-chem-01",
    tag: "CHEMISTRY",
    q: "Q3",
    options: ["p", "q", "r", "s"],
    correctIndex: 2,
  },
];

describe("quizFromPaperAndAnswers", () => {
  it("resumes at the first unanswered question and keeps the score", () => {
    const quiz = quizFromPaperAndAnswers(1, 1, QUESTIONS, {
      "mock-l1-s01-phy-01": "alpha",
    });
    expect(quiz.idx).toBe(1);
    expect(quiz.score).toBe(1);
    expect(quiz.pickedIndex).toBeNull();
    expect(quiz.answered).toBe(false);
  });

  it("resumes without a key when the paper omitted unanswered correctIndex", () => {
    const questions = QUESTIONS.map((item) => ({
      id: item.id,
      tag: item.tag,
      q: item.q,
      options: item.options,
    }));
    const quiz = quizFromPaperAndAnswers(1, 1, questions, {
      "mock-l1-s01-phy-01": "alpha",
    });
    expect(quiz.idx).toBe(1);
    expect(quiz.score).toBe(0);
    expect(quiz.pickedIndex).toBeNull();
  });

  it("lands on the last question when every item is answered", () => {
    const quiz = quizFromPaperAndAnswers(1, 1, QUESTIONS, {
      "mock-l1-s01-phy-01": "alpha",
      "mock-l1-s01-phy-02": "x",
      "mock-l1-s01-chem-01": "r",
    });
    expect(quiz.idx).toBe(2);
    expect(quiz.score).toBe(3);
    expect(quiz.pickedIndex).toBe(2);
    expect(quiz.answered).toBe(true);
  });
});
