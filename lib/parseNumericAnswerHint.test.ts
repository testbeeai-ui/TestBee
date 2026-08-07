import { describe, expect, it } from "vitest";
import { parseNumericAnswerHint } from "./parseNumericAnswerHint";

describe("parseNumericAnswerHint", () => {
  it("does not merge two-value comma lists into one token", () => {
    // Regression: compact used to strip commas → 21202121
    expect(parseNumericAnswerHint("2120,2121")).toBe(2121);
    expect(parseNumericAnswerHint("212,213")).toBe(213);
    expect(parseNumericAnswerHint("1,2")).toBe(2);
  });

  it("uses the median of accepted ranges with ellipsis", () => {
    expect(parseNumericAnswerHint("2120,2121,...,2140")).toBe(2121);
  });

  it("still joins thousand-separated numbers", () => {
    expect(parseNumericAnswerHint("2,120")).toBe(2120);
    expect(parseNumericAnswerHint("1,234")).toBe(1234);
    expect(parseNumericAnswerHint("1,234,567")).toBe(1234567);
    expect(parseNumericAnswerHint("10,020")).toBe(10020);
    expect(parseNumericAnswerHint("12,345.67")).toBe(12345.67);
  });

  it("parses brackets, words, and plain numbers", () => {
    expect(parseNumericAnswerHint("[42]")).toBe(42);
    expect(parseNumericAnswerHint("five")).toBe(5);
    expect(parseNumericAnswerHint("100")).toBe(100);
    expect(parseNumericAnswerHint("- 2.7")).toBe(-2.7);
  });
});
