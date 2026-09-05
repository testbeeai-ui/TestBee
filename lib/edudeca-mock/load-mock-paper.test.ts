import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import path from "node:path";

import { parseGradeableQuestion, parseMockQuestionRows } from "./load-mock-paper";

describe("parseMockQuestionRows", () => {
  it("keeps well-formed four-option rows", () => {
    expect(
      parseMockQuestionRows([
        {
          id: "mock-l1-s01-phy-01",
          level: 1,
          set_number: 1,
          discipline_id: "phy",
          sort_order: 1,
          stem: "Which law?",
          options: ["a", "b", "c", "d"],
          correct_index: 2,
        },
      ])
    ).toEqual([
      {
        id: "mock-l1-s01-phy-01",
        level: 1,
        set_number: 1,
        discipline_id: "phy",
        sort_order: 1,
        stem: "Which law?",
        options: ["a", "b", "c", "d"],
        correct_index: 2,
      },
    ]);
  });

  it("drops rows that are missing options or an id", () => {
    expect(
      parseMockQuestionRows([
        { id: "bad", options: ["a", "b"], correct_index: 0, discipline_id: "phy", sort_order: 1 },
        { options: ["a", "b", "c", "d"], correct_index: 0, discipline_id: "phy", sort_order: 1 },
      ])
    ).toEqual([]);
  });
});

describe("parseGradeableQuestion", () => {
  it("reads a published row without the rest of the paper", () => {
    expect(
      parseGradeableQuestion({
        id: "mock-l1-s01-phy-01",
        options: ["a", "b", "c", "d"],
        correct_index: 2,
      })
    ).toEqual({
      id: "mock-l1-s01-phy-01",
      options: ["a", "b", "c", "d"],
      correct_index: 2,
    });
  });
});

describe("edudeca-mock check route", () => {
  it("grades one published question and does not reload the paper or persist", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../../app/api/edudeca-mock/check/route.ts"),
      "utf8"
    );
    expect(src).toContain("parseGradeableQuestion");
    expect(src).not.toContain("loadFilteredMockPaper");
    expect(src).not.toContain("enforceStudentMockAccess");
    expect(src).not.toContain("upsert");
  });
});
