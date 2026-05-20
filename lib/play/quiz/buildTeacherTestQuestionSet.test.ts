import { describe, expect, it } from "vitest";
import {
  buildTeacherTestQuestionSet,
  type TeacherTestBankRow,
} from "./buildTeacherTestQuestionSet";

function q(question: string, correctAnswer: string | number = "1") {
  return {
    question,
    options: ["A", "B", "C", "D"],
    correctAnswer,
    solution: "",
  };
}

function row(
  topic: string,
  subtopic: string,
  level: string,
  questions: Array<ReturnType<typeof q>>
): TeacherTestBankRow {
  return {
    topic,
    subtopic_name: subtopic,
    level,
    bits_questions: questions,
  };
}

describe("buildTeacherTestQuestionSet", () => {
  it("allocates evenly across subtopics (20 over 5 => 4 each)", () => {
    const rows: TeacherTestBankRow[] = [
      row(
        "Kinematics",
        "Subtopic 1",
        "basics",
        Array.from({ length: 6 }, (_, i) => q(`s1-q${i + 1}`))
      ),
      row(
        "Kinematics",
        "Subtopic 2",
        "basics",
        Array.from({ length: 6 }, (_, i) => q(`s2-q${i + 1}`))
      ),
      row(
        "Kinematics",
        "Subtopic 3",
        "intermediate",
        Array.from({ length: 6 }, (_, i) => q(`s3-q${i + 1}`))
      ),
      row(
        "Kinematics",
        "Subtopic 4",
        "advanced",
        Array.from({ length: 6 }, (_, i) => q(`s4-q${i + 1}`))
      ),
      row(
        "Kinematics",
        "Subtopic 5",
        "basics",
        Array.from({ length: 6 }, (_, i) => q(`s5-q${i + 1}`))
      ),
    ];

    const result = buildTeacherTestQuestionSet(rows, 20, { rng: () => 0.25 });
    expect(result.picked).toBe(20);
    expect(result.bucketCount).toBe(5);
    for (const c of result.classCoverage) {
      expect(c.picked).toBe(4);
    }
  });

  it("redistributes shortfall when one bucket cannot satisfy quota", () => {
    const rows: TeacherTestBankRow[] = [
      row("Laws", "Tiny", "basics", [q("tiny-1")]),
      row(
        "Laws",
        "Large-1",
        "basics",
        Array.from({ length: 6 }, (_, i) => q(`l1-${i + 1}`))
      ),
      row(
        "Laws",
        "Large-2",
        "intermediate",
        Array.from({ length: 6 }, (_, i) => q(`l2-${i + 1}`))
      ),
    ];

    const result = buildTeacherTestQuestionSet(rows, 9, { rng: () => 0.33 });
    expect(result.requested).toBe(9);
    expect(result.picked).toBe(9);
    const tiny = result.classCoverage.find((c) => c.subtopicName === "Tiny");
    expect(tiny?.picked).toBe(1);
    const pickedNonTiny = result.classCoverage
      .filter((c) => c.subtopicName !== "Tiny")
      .reduce((sum, c) => sum + c.picked, 0);
    expect(pickedNonTiny).toBe(8);
  });

  it("normalizes correct answer from index, 1-based string, option text, and letter", () => {
    const rows: TeacherTestBankRow[] = [
      row("Current", "A", "basics", [q("q-index", 0), q("q-1based", "2")]),
      row("Current", "B", "advanced", [
        { question: "q-text", options: ["alpha", "beta"], correctAnswer: "beta", solution: "" },
        { question: "q-letter", options: ["u", "v", "w"], correctAnswer: "C", solution: "" },
      ]),
    ];

    const result = buildTeacherTestQuestionSet(rows, 4, { rng: () => 0.1 });
    const byStem = new Map(result.questions.map((x) => [x.question, x]));
    expect(byStem.get("q-index")?.correctAnswerIndex).toBe(0);
    expect(byStem.get("q-1based")?.correctAnswerIndex).toBe(1);
    expect(byStem.get("q-text")?.correctAnswerIndex).toBe(1);
    expect(byStem.get("q-letter")?.correctAnswerIndex).toBe(2);
  });
});
