import { describe, expect, it } from "vitest";
import {
  PYQ_PROFICIENCY_LABELS,
  pyqProficiency,
  pyqProficiencyBand,
  pyqProficiencyPercent,
} from "./pyqProficiency";
import type { PyqAttemptTally } from "./pyqAttemptStore";

const tally = (right: number, wrong: number): PyqAttemptTally => ({
  attempted: right + wrong,
  right,
  wrong,
});

describe("pyqProficiencyPercent", () => {
  it("scores on marks, not raw accuracy", () => {
    // 16 right − 9 wrong = 55 marks of 100 possible; raw accuracy would be 64%.
    expect(pyqProficiencyPercent(tally(16, 9))).toBe(55);
    expect(Math.round((16 / 25) * 100)).toBe(64);
  });

  it("gives full marks when every attempt is right", () => {
    expect(pyqProficiencyPercent(tally(9, 0))).toBe(100);
  });

  it("clamps a negative marks total at zero", () => {
    expect(pyqProficiencyPercent(tally(1, 6))).toBe(0);
  });

  it("returns zero with nothing attempted", () => {
    expect(pyqProficiencyPercent(tally(0, 0))).toBe(0);
  });
});

describe("pyqProficiencyBand", () => {
  it("separates an untouched chapter from a failed one", () => {
    expect(pyqProficiencyBand(0, 0)).toBe("none");
    expect(pyqProficiencyBand(0, 12)).toBe("needs-work");
  });

  it("puts each band floor on the right side", () => {
    expect(pyqProficiencyBand(39, 10)).toBe("needs-work");
    expect(pyqProficiencyBand(40, 10)).toBe("building");
    expect(pyqProficiencyBand(59, 10)).toBe("building");
    expect(pyqProficiencyBand(60, 10)).toBe("solid");
    expect(pyqProficiencyBand(79, 10)).toBe("solid");
    expect(pyqProficiencyBand(80, 10)).toBe("strong");
    expect(pyqProficiencyBand(100, 10)).toBe("strong");
  });
});

describe("pyqProficiency", () => {
  it("pairs the percent with its label", () => {
    expect(pyqProficiency(tally(16, 9))).toEqual({ percent: 55, band: "building", label: "Building" });
  });

  it("labels an untouched chapter", () => {
    expect(pyqProficiency(tally(0, 0))).toEqual({ percent: 0, band: "none", label: "Not started" });
  });

  it("has a label for every band", () => {
    expect(Object.keys(PYQ_PROFICIENCY_LABELS).sort()).toEqual(
      ["building", "needs-work", "none", "solid", "strong"].sort()
    );
  });
});
