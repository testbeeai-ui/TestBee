import { describe, expect, it } from "vitest";
import { commitNumericDraft, sanitizeNumericDraft } from "./pyqNumericDraft";

describe("numeric draft handling", () => {
  it("keeps partial decimals typeable", () => {
    expect(sanitizeNumericDraft("3")).toBe("3");
    expect(sanitizeNumericDraft("3.")).toBe("3.");
    expect(sanitizeNumericDraft("-")).toBe("-");
    expect(sanitizeNumericDraft("-0.25")).toBe("-0.25");
  });

  it("strips letters, spaces and stray signs or dots", () => {
    expect(sanitizeNumericDraft("12abc")).toBe("12");
    expect(sanitizeNumericDraft("1-2")).toBe("12");
    expect(sanitizeNumericDraft("1.2.3")).toBe("1.23");
    expect(sanitizeNumericDraft("")).toBe("");
  });

  it("commits only finite values and reports the rest as unanswered", () => {
    expect(commitNumericDraft("12")).toBe(12);
    expect(commitNumericDraft("3.")).toBe(3);
    expect(commitNumericDraft("-0.25")).toBe(-0.25);
    expect(commitNumericDraft("0")).toBe(0);
    expect(commitNumericDraft("")).toBeUndefined();
    expect(commitNumericDraft("-")).toBeUndefined();
    expect(commitNumericDraft(".")).toBeUndefined();
  });
});
