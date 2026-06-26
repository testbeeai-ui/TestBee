import { describe, expect, it } from "vitest";
import {
  getAdvancedSetBounds,
  getNonEmptyAdvancedSetIndices,
  isAdvancedMultiSet,
  isLastNonEmptyAdvancedSet,
} from "./advancedQuizSets";

function setLengths(total: number): number[] {
  return getNonEmptyAdvancedSetIndices(total).map((s) => getAdvancedSetBounds(total, s).length);
}

describe("getAdvancedSetBounds", () => {
  it("splits 32 MCQs into 5+5+5+5+5+7 with contiguous indices", () => {
    expect(setLengths(32)).toEqual([5, 5, 5, 5, 5, 7]);
    const bounds6 = getAdvancedSetBounds(32, 6);
    expect(bounds6).toEqual({ start: 25, end: 32, length: 7 });
    expect(getAdvancedSetBounds(32, 1)).toEqual({ start: 0, end: 5, length: 5 });
  });

  it("splits 31 MCQs with set 6 having 6 questions", () => {
    expect(setLengths(31)).toEqual([5, 5, 5, 5, 5, 6]);
    expect(getAdvancedSetBounds(31, 6).length).toBe(6);
  });

  it("splits 12 MCQs into 5+5+2 (sets 4–6 empty)", () => {
    expect(setLengths(12)).toEqual([5, 5, 2]);
    expect(getAdvancedSetBounds(12, 4).length).toBe(0);
    expect(getAdvancedSetBounds(12, 6).length).toBe(0);
  });

  it("treats 5 MCQs as a single set only", () => {
    expect(setLengths(5)).toEqual([5]);
    expect(isAdvancedMultiSet("advanced", 5)).toBe(false);
  });

  it("enables multi-set for advanced when total > 5", () => {
    expect(isAdvancedMultiSet("advanced", 6)).toBe(true);
    expect(isAdvancedMultiSet("advanced", 5)).toBe(false);
    expect(isAdvancedMultiSet("basics", 32)).toBe(false);
  });
});

describe("isLastNonEmptyAdvancedSet", () => {
  it("identifies last non-empty set for 32 and 12", () => {
    expect(isLastNonEmptyAdvancedSet(32, 6)).toBe(true);
    expect(isLastNonEmptyAdvancedSet(32, 5)).toBe(false);
    expect(isLastNonEmptyAdvancedSet(12, 3)).toBe(true);
    expect(isLastNonEmptyAdvancedSet(12, 2)).toBe(false);
  });
});
