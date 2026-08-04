import { describe, expect, it } from "vitest";
import {
  firstNumeralsPackIndexForRdm,
  isFirstNumeralsPackForRdm,
  isFirstQuizSetForRdm,
  numeralsFinishRdmLabel,
  numeralsRdmTipLines,
  quizFinishRdmLabel,
  quizRdmTipLines,
} from "./subtopicUnitRdmCopy";

describe("subtopicUnitRdmCopy — first-unit-only rules", () => {
  it("marks only quiz set 1 as eligible", () => {
    expect(isFirstQuizSetForRdm(1)).toBe(true);
    expect(isFirstQuizSetForRdm(2)).toBe(false);
    expect(isFirstQuizSetForRdm(3)).toBe(false);
  });

  it("picks first formula pack that has questions", () => {
    const formulas = [
      { bitsQuestions: [] },
      { bitsQuestions: [{}, {}] },
      { bitsQuestions: [{}, {}] },
    ];
    expect(firstNumeralsPackIndexForRdm(formulas)).toBe(1);
    expect(isFirstNumeralsPackForRdm(0, formulas)).toBe(false);
    expect(isFirstNumeralsPackForRdm(1, formulas)).toBe(true);
    expect(isFirstNumeralsPackForRdm(2, formulas)).toBe(false);
  });

  it("quiz finish label: set 1 below 60% asks for threshold", () => {
    expect(
      quizFinishRdmLabel({
        setIndex: 1,
        setPct: 40,
        setRdm: 5,
        overallRdm: 15,
        isLastSet: false,
        creditedParts: [],
      })
    ).toBe("Requires ≥60% on set 1 for +5");
  });

  it("quiz finish label: set 2+ nudges overall completion bonus", () => {
    const label = quizFinishRdmLabel({
      setIndex: 2,
      setPct: 40,
      setRdm: 5,
      overallRdm: 15,
      isLastSet: false,
      creditedParts: [],
    });
    expect(label).toBe("Complete all sets · earn +15 RDM (≥60% overall)");
    expect(label.toLowerCase()).not.toContain("requires ≥60% this set");
    expect(label).not.toMatch(/\+5 this set/i);
  });

  it("quiz finish label: credited set 1 shows credit", () => {
    expect(
      quizFinishRdmLabel({
        setIndex: 1,
        setPct: 80,
        setRdm: 5,
        overallRdm: 15,
        isLastSet: false,
        creditedParts: ["+5 set 1"],
      })
    ).toBe("+5 set 1 credited");
  });

  it("numerals finish label: later pack nudges overall completion bonus", () => {
    const label = numeralsFinishRdmLabel({
      isFirstPack: false,
      packPct: 40,
      formulaRdm: 5,
      overallRdm: 20,
      allPacksSubmitted: false,
      creditedParts: [],
    });
    expect(label).toBe("Complete all packs · earn +20 RDM (≥60% overall)");
    expect(label).not.toContain("Requires ≥60% this pack");
  });

  it("numerals finish label: first pack below 60%", () => {
    expect(
      numeralsFinishRdmLabel({
        isFirstPack: true,
        packPct: 40,
        formulaRdm: 5,
        overallRdm: 20,
        allPacksSubmitted: false,
        creditedParts: [],
      })
    ).toBe("Requires ≥60% on first pack for +5");
  });

  it("tip lines mention first unit only", () => {
    expect(quizRdmTipLines(5, 15)[0]).toContain("set 1");
    expect(numeralsRdmTipLines(5, 20)[0]).toContain("first formula pack");
  });
});
