import { describe, expect, it } from "vitest";

import {
  expectedPaperSize,
  filterMockPaper,
  questionsPerDiscipline,
  type MockQuestionRow,
} from "./paper-filter";

const LINEUP = [
  "phy",
  "che",
  "mat",
  "amat",
  "ent",
  "eng",
  "eco",
  "log",
  "gk",
  "fin",
] as const;

function row(
  partial: Pick<MockQuestionRow, "id" | "discipline_id" | "sort_order"> &
    Partial<MockQuestionRow>,
): MockQuestionRow {
  return {
    level: 1,
    set_number: 1,
    stem: partial.stem ?? partial.id,
    options: partial.options ?? ["a", "b", "c", "d"],
    correct_index: partial.correct_index ?? 0,
    ...partial,
  };
}

function bankForLevel(level: 1 | 2 | 3, extraDisciplines = ["bio", "biotech"]): MockQuestionRow[] {
  const per = questionsPerDiscipline(level);
  const disciplines = [...LINEUP, ...extraDisciplines];
  const rows: MockQuestionRow[] = [];
  for (const disc of disciplines) {
    for (let slot = 1; slot <= per; slot += 1) {
      rows.push(
        row({
          id: `mock-l${level}-s01-${disc}-${String(slot).padStart(2, "0")}`,
          level,
          discipline_id: disc,
          sort_order: slot,
        }),
      );
    }
  }
  return rows;
}

describe("filterMockPaper", () => {
  it("returns incomplete_lineup when fewer than 10 disciplines are selected", () => {
    const result = filterMockPaper({
      lineup: LINEUP.slice(0, 9),
      questions: bankForLevel(1),
      level: 1,
    });
    expect(result).toEqual({ ok: false, reason: "incomplete_lineup" });
  });

  it("drops unused subjects and keeps L1 at 10 questions in lineup order", () => {
    const result = filterMockPaper({
      lineup: [...LINEUP],
      questions: bankForLevel(1),
      level: 1,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.questions).toHaveLength(10);
    expect(result.questions.map((q) => q.discipline_id)).toEqual([...LINEUP]);
    expect(result.questions.some((q) => q.discipline_id === "bio")).toBe(false);
  });

  it("keeps two questions per selected discipline for L2 (20) and three for L3 (30)", () => {
    const l2 = filterMockPaper({
      lineup: [...LINEUP],
      questions: bankForLevel(2),
      level: 2,
    });
    const l3 = filterMockPaper({
      lineup: [...LINEUP],
      questions: bankForLevel(3),
      level: 3,
    });
    expect(expectedPaperSize(2)).toBe(20);
    expect(expectedPaperSize(3)).toBe(30);
    expect(l2.ok).toBe(true);
    expect(l3.ok).toBe(true);
    if (!l2.ok || !l3.ok) return;
    expect(l2.questions).toHaveLength(20);
    expect(l3.questions).toHaveLength(30);
    expect(l2.questions.filter((q) => q.discipline_id === "phy")).toHaveLength(2);
    expect(l3.questions.filter((q) => q.discipline_id === "phy")).toHaveLength(3);
  });

  it("fails closed when a selected discipline is missing from the set", () => {
    const questions = bankForLevel(1).filter((q) => q.discipline_id !== "fin");
    const result = filterMockPaper({
      lineup: [...LINEUP],
      questions,
      level: 1,
    });
    expect(result).toEqual({ ok: false, reason: "missing_discipline" });
  });

  it("fails closed when a selected L3 discipline has fewer than 3 questions", () => {
    const questions = bankForLevel(3).filter(
      (q) => !(q.discipline_id === "amat" && q.sort_order === 3),
    );
    const result = filterMockPaper({
      lineup: [...LINEUP],
      questions,
      level: 3,
    });
    expect(result).toEqual({ ok: false, reason: "missing_discipline" });
  });
});
