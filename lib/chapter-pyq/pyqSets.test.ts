import { describe, expect, it } from "vitest";
import {
  PYQ_SECONDS_PER_QUESTION,
  buildPyqSets,
  buildPyqYearMonthSets,
  pyqYearSetListedCount,
  secondsForSet,
  splitIntoSetSizes,
} from "./pyqSets";

describe("pyq set splitting", () => {
  it("matches the spec's worked examples", () => {
    expect(splitIntoSetSizes(132)).toEqual([27, 27, 26, 26, 26]);
    expect(splitIntoSetSizes(79)).toEqual([27, 26, 26]);
    expect(splitIntoSetSizes(29)).toEqual([29]);
    expect(splitIntoSetSizes(24)).toEqual([24]);
  });

  it("uses max(1, round(total / 25)) sets", () => {
    expect(splitIntoSetSizes(1)).toEqual([1]);
    expect(splitIntoSetSizes(12)).toEqual([12]);
    expect(splitIntoSetSizes(13)).toEqual([13]);
    expect(splitIntoSetSizes(37)).toEqual([37]);
    expect(splitIntoSetSizes(38)).toEqual([19, 19]);
  });

  it("never leaves a stub set and never differs by more than one", () => {
    for (let total = 1; total <= 400; total++) {
      const sizes = splitIntoSetSizes(total);
      expect(sizes.reduce((a, b) => a + b, 0), `total ${total}`).toBe(total);
      expect(Math.min(...sizes), `total ${total}`).toBeGreaterThan(0);
      expect(Math.max(...sizes) - Math.min(...sizes), `total ${total}`).toBeLessThanOrEqual(1);
      expect(sizes.length, `total ${total}`).toBe(Math.max(1, Math.round(total / 25)));
    }
  });

  it("puts the larger sets first", () => {
    const sizes = splitIntoSetSizes(132);
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
  });

  it("returns no sets for an empty chapter", () => {
    expect(splitIntoSetSizes(0)).toEqual([]);
    expect(splitIntoSetSizes(-5)).toEqual([]);
    expect(buildPyqSets([])).toEqual([]);
  });

  it("slices items sequentially into the computed sizes", () => {
    const items = Array.from({ length: 132 }, (_, i) => i + 1);
    const sets = buildPyqSets(items);
    expect(sets.map((s) => s.length)).toEqual([27, 27, 26, 26, 26]);
    expect(sets[0]?.[0]).toBe(1);
    expect(sets[0]?.at(-1)).toBe(27);
    expect(sets[1]?.[0]).toBe(28);
    expect(sets.flat()).toEqual(items);
  });

  it("allows two minutes per question in the set", () => {
    expect(PYQ_SECONDS_PER_QUESTION).toBe(120);
    expect(secondsForSet(27)).toBe(3240);
    expect(secondsForSet(24)).toBe(2880);
  });

  it("groups Mathematics PYQs by year only, January before later months of that year", () => {
    const items = [
      { id: "jun", examYear: 2022, examMonth: 6, examDay: 24, examLabel: "24 Jun 2022 (Morning)" },
      { id: "jan-late", examYear: 2024, examMonth: 1, examDay: 30, examLabel: "30 Jan 2024 (Evening)" },
      { id: "jan-early", examYear: 2024, examMonth: 1, examDay: 27, examLabel: "27 Jan 2024 (Morning)" },
      { id: "apr", examYear: 2024, examMonth: 4, examDay: 4, examLabel: "4 Apr 2024 (Morning)" },
      { id: "feb", examYear: 2024, examMonth: 2, examDay: 1, examLabel: "1 Feb 2024 (Morning)" },
    ];
    const sets = buildPyqYearMonthSets(items);
    expect(sets.map((s) => [s.label, s.items.map((q) => q.id)])).toEqual([
      ["2024", ["jan-early", "jan-late", "feb", "apr"]],
      ["2022", ["jun"]],
    ]);
  });

  it("lists 2026 before 2021 and does not show 2020", () => {
    const items = [
      { id: "y2020", examYear: 2020, examMonth: 1, examDay: 7, examLabel: "7 Jan 2020 (Morning)" },
      { id: "y2021", examYear: 2021, examMonth: 2, examDay: 24, examLabel: "24 Feb 2021 (Morning)" },
      { id: "y2026", examYear: 2026, examMonth: 1, examDay: 21, examLabel: "21 Jan 2026 (Morning)" },
    ];
    expect(buildPyqYearMonthSets(items).map((s) => s.label)).toEqual(["2026", "2021"]);
  });

  it("puts January ahead of later months in one year set", () => {
    const items = [
      { id: "sep", examYear: 2021, examMonth: 9, examDay: 2, examLabel: "2 Sep 2021 (Morning)" },
      { id: "jan", examYear: 2021, examMonth: 1, examDay: 7, examLabel: "7 Jan 2021 (Morning)" },
    ];
    const sets = buildPyqYearMonthSets(items);
    expect(sets).toHaveLength(1);
    expect(sets[0]?.label).toBe("2021");
    expect(sets[0]?.items.map((q) => q.id)).toEqual(["jan", "sep"]);
  });

  it("keeps undated questions in a trailing set and does not invent a year", () => {
    const items = [
      { id: "dated", examYear: 2025, examMonth: 1, examDay: 22, examLabel: "22 Jan 2025 (Morning)" },
      { id: "undated", examYear: null, examMonth: null, examDay: null, examLabel: null },
    ];
    expect(buildPyqYearMonthSets(items).map((s) => s.label)).toEqual(["2025", "Undated"]);
  });

  it("uses live year-set size when no listed override exists", () => {
    expect(pyqYearSetListedCount("definite-integration", "2025", 63)).toBe(63);
    expect(pyqYearSetListedCount("quadratic-equation", "2025", 22)).toBe(22);
  });
});
