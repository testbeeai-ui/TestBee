import { describe, expect, it } from "vitest";

import { questionCountForLevel } from "./question-bank";

describe("questionCountForLevel", () => {
  it("matches EduDeca L1/L2/L3 lineup-sized papers", () => {
    expect(questionCountForLevel(1)).toBe(10);
    expect(questionCountForLevel(2)).toBe(20);
    expect(questionCountForLevel(3)).toBe(30);
  });
});
