import { describe, expect, it } from "vitest";
import type { Question } from "@/types";
import {
  PYQ_NUMERIC_TOLERANCE,
  formatPyqCorrectAnswer,
  formatPyqStudentAnswer,
  isPyqAnswerCorrect,
  pyqReviewFilterMatches,
  pyqReviewVerdict,
} from "./pyqScoring";

const base: Question = {
  id: "q1",
  subject: "physics",
  topic: "Friction",
  classLevel: 12,
  examType: ["JEE_Mains"],
  question: "stem",
  options: [],
  correctAnswer: -1,
  hint: "",
  solution: "",
  reference: { theory: "", relatedTopics: [], applicationExample: "" },
};

const mcq: Question = { ...base, options: ["a", "b", "c", "d"], correctAnswer: 2, answerFormat: "mcq" };
const numeric: Question = { ...base, answerFormat: "numerical", numericAnswer: "12" };

describe("pyq scoring", () => {
  it("scores an MCQ on the option index", () => {
    expect(isPyqAnswerCorrect(mcq, 2)).toBe(true);
    expect(isPyqAnswerCorrect(mcq, 0)).toBe(false);
  });

  it("treats a question with no answerFormat as an MCQ", () => {
    const legacy: Question = { ...mcq, answerFormat: undefined };
    expect(isPyqAnswerCorrect(legacy, 2)).toBe(true);
  });

  it("scores a numerical on the entered value within tolerance", () => {
    expect(isPyqAnswerCorrect(numeric, 12)).toBe(true);
    expect(isPyqAnswerCorrect(numeric, 12 + PYQ_NUMERIC_TOLERANCE)).toBe(true);
    expect(isPyqAnswerCorrect(numeric, 12.5)).toBe(false);
    expect(isPyqAnswerCorrect(numeric, -12)).toBe(false);
  });

  it("handles negative and decimal expected values", () => {
    const neg: Question = { ...base, answerFormat: "numerical", numericAnswer: "-0.25" };
    expect(isPyqAnswerCorrect(neg, -0.25)).toBe(true);
    expect(isPyqAnswerCorrect(neg, 0.25)).toBe(false);
  });

  it("never scores an unanswered or unparseable question correct", () => {
    expect(isPyqAnswerCorrect(numeric, undefined)).toBe(false);
    expect(isPyqAnswerCorrect(mcq, undefined)).toBe(false);
    const broken: Question = { ...base, answerFormat: "numerical", numericAnswer: "see solution" };
    expect(isPyqAnswerCorrect(broken, 0)).toBe(false);
  });

  it("keeps numericals off the MCQ path by branching on answerFormat, not on -1", () => {
    // Correctly tagged, the branch does all the work: the entered value is
    // compared against numericAnswer and correctAnswer is never read, so -1 is
    // just a wrong answer to a question whose answer is 12.
    expect(isPyqAnswerCorrect(numeric, -1)).toBe(false);
    expect(isPyqAnswerCorrect(numeric, 12)).toBe(true);
  });

  it("shows the known limit of the -1 sentinel when a numerical is mis-tagged mcq", () => {
    // -1 is an out-of-range option index, so the MCQ path scores a mis-tagged
    // numerical wrong for every real entered value — 12 included.
    expect(isPyqAnswerCorrect({ ...numeric, answerFormat: "mcq" }, 12)).toBe(false);
    // But -1 is reachable: a student answering -1 matches the sentinel and scores
    // correct. This is the limit of the sentinel, not a guarantee it provides.
    // The only real protection is tagging answerFormat correctly.
    expect(isPyqAnswerCorrect({ ...numeric, answerFormat: "mcq" }, -1)).toBe(true);
  });
});

describe("pyq review filter", () => {
  it("keeps every verdict on all, otherwise only the chosen one", () => {
    expect(pyqReviewFilterMatches("skipped", "all")).toBe(true);
    expect(pyqReviewFilterMatches("correct", "all")).toBe(true);
    expect(pyqReviewFilterMatches("skipped", "skipped")).toBe(true);
    expect(pyqReviewFilterMatches("skipped", "correct")).toBe(false);
    expect(pyqReviewFilterMatches("wrong", "wrong")).toBe(true);
  });
});

describe("pyq review verdict", () => {
  it("marks an unanswered question skipped, not wrong", () => {
    expect(pyqReviewVerdict(mcq, undefined)).toBe("skipped");
    expect(pyqReviewVerdict(numeric, undefined)).toBe("skipped");
  });

  it("marks a matching MCQ or numerical correct", () => {
    expect(pyqReviewVerdict(mcq, 2)).toBe("correct");
    expect(pyqReviewVerdict(numeric, 12)).toBe("correct");
  });

  it("marks a mismatch wrong", () => {
    expect(pyqReviewVerdict(mcq, 0)).toBe("wrong");
    expect(pyqReviewVerdict(numeric, 11)).toBe("wrong");
  });
});

describe("pyq review answer labels", () => {
  it("returns null for a skipped student answer", () => {
    expect(formatPyqStudentAnswer(mcq, undefined)).toBeNull();
    expect(formatPyqStudentAnswer(numeric, undefined)).toBeNull();
  });

  it("returns the option text for an MCQ pick", () => {
    expect(formatPyqStudentAnswer(mcq, 0)).toBe("a");
    expect(formatPyqStudentAnswer(mcq, 2)).toBe("c");
  });

  it("returns the entered number for a numerical", () => {
    expect(formatPyqStudentAnswer(numeric, 12)).toBe("12");
    expect(formatPyqStudentAnswer(numeric, -0.25)).toBe("-0.25");
  });

  it("returns the answer-key option or numerical from the question row", () => {
    expect(formatPyqCorrectAnswer(mcq)).toBe("c");
    expect(formatPyqCorrectAnswer(numeric)).toBe("12");
  });
});
