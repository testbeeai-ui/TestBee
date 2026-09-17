import { describe, expect, it } from "vitest";
import { filterPublishableRows } from "../pyqQuestionRow";
import { LAWS_OF_MOTION_SAMPLE_ROWS, PYQ_SAMPLE_FIGURES } from "./lawsOfMotionSample";

const publishable = filterPublishableRows(LAWS_OF_MOTION_SAMPLE_ROWS);
const lom = publishable.filter((r) => r.chapters?.catalog_slug === "laws-of-motion");
const uam = publishable.filter((r) => r.chapters?.catalog_slug === "units-and-measurements");

describe("laws of motion sample fixture", () => {
  it("has 12 rows whose ids are unique by their last 12 characters", () => {
    expect(LAWS_OF_MOTION_SAMPLE_ROWS).toHaveLength(12);
    const ids = LAWS_OF_MOTION_SAMPLE_ROWS.map((r) => r.id);
    expect(new Set(ids).size).toBe(12);
    // `pyqQuestionMap.test.ts` looks rows up by id suffix, so suffixes must not collide.
    expect(new Set(ids.map((id) => id.slice(-12))).size).toBe(12);
  });

  it("covers both formats in the pilot chapter", () => {
    expect(lom.filter((r) => r.format === "mcq")).toHaveLength(4);
    expect(lom.filter((r) => r.format === "numerical")).toHaveLength(2);
  });

  it("gives every numerical an answer and no options", () => {
    for (const row of publishable.filter((r) => r.format === "numerical")) {
      expect(row.numerical_answer, row.id).toBeTruthy();
      expect(row.correct_option, row.id).toBeNull();
      expect(row.question_options, row.id).toEqual([]);
    }
  });

  it("gives every publishable MCQ four options and a 1-based correct option", () => {
    for (const row of publishable.filter((r) => r.format === "mcq")) {
      expect(row.question_options, row.id).toHaveLength(4);
      expect(row.correct_option, row.id).toBeGreaterThanOrEqual(1);
      expect(row.correct_option, row.id).toBeLessThanOrEqual(4);
      expect(row.numerical_answer, row.id).toBeNull();
    }
  });

  it("covers all three tiers in the pilot chapter", () => {
    expect(lom.filter((r) => r.tier === "must_do")).toHaveLength(3);
    expect(lom.filter((r) => r.tier === "concept_builder")).toHaveLength(1);
    expect(lom.filter((r) => r.tier === "advanced")).toHaveLength(2);
  });

  it("covers questions with and without figures", () => {
    expect(lom.filter((r) => r.figure_links.length > 0)).toHaveLength(3);
    expect(lom.filter((r) => r.figure_links.length === 0)).toHaveLength(3);
  });

  it("exercises the merge rule with two PDF chapters on one catalog chapter", () => {
    expect(new Set(uam.map((r) => r.chapters?.chapter_no))).toEqual(new Set([2, 32]));
    expect(new Set(uam.map((r) => r.chapters?.name))).toEqual(
      new Set(["Units and Dimensions", "Experimental Physics"])
    );
  });

  it("includes a row with no topic and a row with no exam date", () => {
    expect(publishable.some((r) => r.topics === null)).toBe(true);
    expect(publishable.some((r) => r.exam_date === null)).toBe(true);
  });

  it("resolves every figure placeholder to a known figure", () => {
    const keys = new Set(PYQ_SAMPLE_FIGURES.map((f) => f.figure_key));
    for (const row of LAWS_OF_MOTION_SAMPLE_ROWS) {
      for (const [, key] of (row.body ?? "").matchAll(/\[\[fig:([a-zA-Z0-9_]+)\]\]/g)) {
        expect(keys.has(key), key).toBe(true);
      }
    }
  });

  it("covers both a derived and a stored figure public_url", () => {
    expect(PYQ_SAMPLE_FIGURES.some((f) => f.public_url === null)).toBe(true);
    expect(PYQ_SAMPLE_FIGURES.some((f) => f.public_url !== null)).toBe(true);
  });
});
