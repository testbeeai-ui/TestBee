import { describe, expect, it } from "vitest";
import {
  drawPyqTestQuestions,
  parsePyqTestSetup,
  pyqTestMarks,
  pyqTestMaxMarks,
  pyqTestTotalMinutes,
} from "./pyqTestSetup";

describe("pyq test setup", () => {
  it("accepts a count inside the set and whole minutes", () => {
    expect(parsePyqTestSetup("4", "2", 9)).toEqual({
      ok: true,
      questionCount: 4,
      minutesPerQuestion: 2,
    });
  });

  it("rejects a count above the set, below 1, blank, or fractional", () => {
    expect(parsePyqTestSetup("10", "2", 9).ok).toBe(false);
    expect(parsePyqTestSetup("0", "2", 9).ok).toBe(false);
    expect(parsePyqTestSetup("", "2", 9).ok).toBe(false);
    expect(parsePyqTestSetup("2.5", "2", 9).ok).toBe(false);
    expect(parsePyqTestSetup("4", "0", 9).ok).toBe(false);
    expect(parsePyqTestSetup("4", "1.5", 9).ok).toBe(false);
  });

  it("multiplies count by minutes", () => {
    expect(pyqTestTotalMinutes(9, 2)).toBe(18);
  });

  it("draws a unique subset using the injected random source", () => {
    const drawn = drawPyqTestQuestions(["a", "b", "c", "d"], 2, () => 0);
    expect(drawn).toHaveLength(2);
    expect(new Set(drawn).size).toBe(2);
    expect(["a", "b", "c", "d"]).toEqual(expect.arrayContaining(drawn));
  });

  it("scores +4 right, −1 wrong, and ignores blanks in the formula", () => {
    expect(pyqTestMarks(3, 1)).toBe(11);
    expect(pyqTestMaxMarks(9)).toBe(36);
  });
});
