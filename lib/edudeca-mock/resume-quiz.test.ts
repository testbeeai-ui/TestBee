import { describe, expect, it } from "vitest";

import type { QuizQuestion } from "./question-bank";
import { applyQuestionCheck, optionRevealState, quizFromPaperAndAnswers } from "./resume-quiz";

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
    const questions = QUESTIONS.map((item, index) =>
      index === 0
        ? item
        : {
            id: item.id,
            tag: item.tag,
            q: item.q,
            options: item.options,
          }
    );
    const quiz = quizFromPaperAndAnswers(1, 1, questions, {
      "mock-l1-s01-phy-01": "alpha",
    });
    expect(quiz.idx).toBe(1);
    expect(quiz.score).toBe(1);
    expect(quiz.pickedIndex).toBeNull();
    expect(quiz.questions[1]).not.toHaveProperty("correctIndex");
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

describe("applyQuestionCheck", () => {
  it("keeps a later question index when the check arrives after Next", () => {
    const pendingQuestions: QuizQuestion[] = QUESTIONS.map((item, index) =>
      index === 0 ? { id: item.id, tag: item.tag, q: item.q, options: item.options } : item
    );
    const advanced = {
      level: 1 as const,
      set: 1,
      idx: 1,
      score: 0,
      questions: pendingQuestions,
      answers: { "mock-l1-s01-phy-01": "alpha" },
      answered: false,
      pickedIndex: null,
    };
    const patched = applyQuestionCheck(advanced, "mock-l1-s01-phy-01", 0, 0);
    expect(patched?.idx).toBe(1);
    expect(patched?.score).toBe(1);
    expect(patched?.questions[0]?.correctIndex).toBe(0);
    expect(patched?.pickedIndex).toBeNull();
  });

  it("does not apply the same check twice", () => {
    const quiz = quizFromPaperAndAnswers(1, 1, QUESTIONS, {
      "mock-l1-s01-phy-01": "alpha",
    });
    expect(applyQuestionCheck(quiz, "mock-l1-s01-phy-01", 0, 0)).toBeNull();
  });

  it("increments score when the paper already preloaded the key", () => {
    const pending = {
      level: 1 as const,
      set: 1,
      idx: 0,
      score: 0,
      questions: QUESTIONS,
      answers: { "mock-l1-s01-phy-01": "alpha" },
      answered: true,
      pickedIndex: 0,
    };
    const patched = applyQuestionCheck(pending, "mock-l1-s01-phy-01", 0, 0);
    expect(patched?.score).toBe(1);
    expect(patched?.questions[0]?.correctIndex).toBe(0);
  });
});

describe("optionRevealState", () => {
  it("marks the pick as selected before the server key arrives", () => {
    expect(optionRevealState(0, 0, undefined)).toBe("selected");
    expect(optionRevealState(0, 1, undefined)).toBe("muted");
    expect(optionRevealState(null, 0, undefined)).toBe("idle");
  });

  it("reveals correct and wrong after the check returns", () => {
    expect(optionRevealState(1, 0, 0)).toBe("correct");
    expect(optionRevealState(1, 1, 0)).toBe("wrong");
    expect(optionRevealState(1, 2, 0)).toBe("muted");
  });
});
