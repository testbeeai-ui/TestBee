import { describe, expect, it } from "vitest";
import { buildPyqSets } from "./pyqSets";
import {
  PYQ_TIER_CHIPS,
  PYQ_TIER_LABEL,
  PYQ_TIER_ORDER,
  countByTier,
  filterByTier,
  isPyqTierFilter,
} from "./pyqTiers";
import type { ChapterPyqQuestion } from "./pyqQuestionMap";
import type { PyqTier } from "./pyqQuestionRow";

function fake(id: string, tier: PyqTier): ChapterPyqQuestion {
  return {
    question: {
      id,
      subject: "physics",
      topic: "t",
      classLevel: 12,
      examType: ["JEE_Mains"],
      question: "stem",
      options: ["a", "b", "c", "d"],
      correctAnswer: 0,
      answerFormat: "mcq",
      numericAnswer: null,
      hint: "",
      solution: "",
      reference: { theory: "", relatedTopics: [], applicationExample: "" },
    },
    tier,
    pdfChapterName: "Laws of Motion",
    topicName: "t",
    qNo: 1,
    sourcePage: 47,
    examLabel: null,
    examYear: null,
    examMonth: null,
    examDay: null,
  };
}

const pilot: ChapterPyqQuestion[] = [
  ...Array.from({ length: 79 }, (_, i) => fake(`m${i}`, "must_do")),
  ...Array.from({ length: 29 }, (_, i) => fake(`c${i}`, "concept_builder")),
  ...Array.from({ length: 24 }, (_, i) => fake(`a${i}`, "advanced")),
];

describe("pyq tiers", () => {
  it("orders and labels the three tiers", () => {
    expect([...PYQ_TIER_ORDER]).toEqual(["must_do", "concept_builder", "advanced"]);
    expect(PYQ_TIER_LABEL).toEqual({
      must_do: "Must Do",
      concept_builder: "Concept Builder",
      advanced: "Advanced",
    });
    expect(PYQ_TIER_CHIPS.map((c) => c.id)).toEqual([
      "all",
      "must_do",
      "concept_builder",
      "advanced",
    ]);
  });

  it("filters to a tier and passes everything through for all", () => {
    expect(filterByTier(pilot, "all")).toHaveLength(132);
    expect(filterByTier(pilot, "must_do")).toHaveLength(79);
    expect(filterByTier(pilot, "concept_builder")).toHaveLength(29);
    expect(filterByTier(pilot, "advanced")).toHaveLength(24);
  });

  it("counts per tier including the all bucket", () => {
    expect(countByTier(pilot)).toEqual({
      all: 132,
      must_do: 79,
      concept_builder: 29,
      advanced: 24,
    });
  });

  it("re-splits when the tier changes, matching the spec's examples", () => {
    const sizes = (tier: Parameters<typeof filterByTier>[1]) =>
      buildPyqSets(filterByTier(pilot, tier)).map((s) => s.length);
    expect(sizes("all")).toEqual([27, 27, 26, 26, 26]);
    expect(sizes("must_do")).toEqual([27, 26, 26]);
    expect(sizes("concept_builder")).toEqual([29]);
    expect(sizes("advanced")).toEqual([24]);
  });

  it("preserves relative order within a tier", () => {
    expect(filterByTier(pilot, "advanced").map((e) => e.question.id)).toEqual(
      Array.from({ length: 24 }, (_, i) => `a${i}`)
    );
  });

  it("validates a tier filter from a query string", () => {
    expect(isPyqTierFilter("must_do")).toBe(true);
    expect(isPyqTierFilter("all")).toBe(true);
    expect(isPyqTierFilter("hard")).toBe(false);
  });
});
