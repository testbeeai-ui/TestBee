import { describe, expect, it } from "vitest";
import {
  asQuestionsArray,
  fetchLearningOutcomesQuestions,
  legacySanitizeForLookup,
  looseCollisionKey,
  pickLoCollisionMatch,
} from "./learningOutcomesLookup";

describe("learningOutcomesLookup", () => {
  it("collapses punctuation so curriculum titles match seeded packs", () => {
    expect(looseCollisionKey("Coulomb's Law")).toBe("coulombs law");
    expect(looseCollisionKey("Coulombs Law")).toBe("coulombs law");
    expect(looseCollisionKey("Electric Charges and Fields")).toBe("electric charges and fields");
    expect(looseCollisionKey("Electric  Charges  and Fields")).toBe("electric charges and fields");
  });

  it("picks the collision row when punctuation / spacing differs", () => {
    const rows = [
      { topic: "Electric Charges and Fields", subtopic_name: "Coulomb's Law", questions: [{ q: 1 }] },
      { topic: "Current Electricity", subtopic_name: "Ohm's Law", questions: [{ q: 2 }] },
    ];
    const match = pickLoCollisionMatch(
      rows,
      "Electric Charges and Fields",
      "Coulombs Law"
    );
    expect(match?.questions).toEqual([{ q: 1 }]);
  });

  it("legacy sanitize strips angle brackets used by old generators", () => {
    expect(legacySanitizeForLookup("F < 0 for attraction")).toBe("F 0 for attraction");
  });

  it("asQuestionsArray rejects empty / non-arrays", () => {
    expect(asQuestionsArray([])).toEqual([]);
    expect(asQuestionsArray(null)).toEqual([]);
    expect(asQuestionsArray([{ a: 1 }])).toEqual([{ a: 1 }]);
  });
});

describe("fetchLearningOutcomesQuestions", () => {
  it("returns exact-key questions without scanning siblings", async () => {
    const qs = [{ question: "Q1", options: ["a"], correctAnswer: "a", solution: "" }];
    let selectCols = "";
    const client = {
      from: () => ({
        select: (cols: string) => {
          selectCols = cols;
          const filter = {
            eq: () => filter,
            maybeSingle: async () => ({ data: { questions: qs } }),
            limit: async () => ({ data: [], error: null }),
          };
          return filter;
        },
      }),
    };
    const out = await fetchLearningOutcomesQuestions(client, {
      board: "CBSE",
      subject: "physics",
      class_level: 12,
      topic: "Electric Charges and Fields",
      subtopic_name: "Coulomb's Law",
      level: "advanced",
    });
    expect(out).toEqual(qs);
    expect(selectCols).toBe("questions");
  });
});
