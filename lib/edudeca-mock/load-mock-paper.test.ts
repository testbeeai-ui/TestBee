import { describe, expect, it } from "vitest";

import { parseMockQuestionRows } from "./load-mock-paper";

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
