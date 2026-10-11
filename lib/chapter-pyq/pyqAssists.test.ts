import { describe, expect, it } from "vitest";
import { pyqInPaperAssists } from "./pyqAssists";

describe("pyqInPaperAssists", () => {
  it("never offers the in-paper Solution, in either mode", () => {
    expect(pyqInPaperAssists("practice").solution).toBe(false);
    expect(pyqInPaperAssists("test").solution).toBe(false);
  });

  it("lets practice open the Tips / Formula's sheets", () => {
    expect(pyqInPaperAssists("practice").coach).toBe(true);
  });

  it("gives a paced test no in-paper help at all, so it cannot read the method off the screen", () => {
    expect(pyqInPaperAssists("test")).toEqual({ solution: false, coach: false });
  });

  it("only ever varies the coach sheets by mode", () => {
    const practice = pyqInPaperAssists("practice");
    const test = pyqInPaperAssists("test");
    expect(practice.solution).toBe(test.solution);
    expect(practice.coach).not.toBe(test.coach);
  });
});
