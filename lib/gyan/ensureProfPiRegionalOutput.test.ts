import { describe, expect, it } from "vitest";
import {
  proseMissingRegionalScript,
  stripLatexForLangCheck,
} from "@/lib/gyan/ensureProfPiRegionalOutput";

describe("ensureProfPiRegionalOutput helpers", () => {
  it("detects English-only integral answer as missing Kannada", () => {
    const english = `**Answer:** $x^3 + 2x^2 - 5x + C$

**Steps:**
- $\\int 3x^2\\,dx = x^3 + C$
- Add constant of integration $C$

**Exam trap:** Never forget the $+C$ in indefinite integrals!

You've got this!`;

    expect(proseMissingRegionalScript(english, "kn")).toBe(true);
    expect(proseMissingRegionalScript(english, "en")).toBe(false);
  });

  it("detects Kannada prose as present", () => {
    const kannada = `**Steps:**
- ಸಮಾಕಲನ ಸೂತ್ರವನ್ನು ಬಳಸಿ $x^3$ ಪಡೆಯಿರಿ
- $C$ ಸ್ಥಿರಾಂಕವನ್ನು ಸೇರಿಸಿ`;
    expect(proseMissingRegionalScript(kannada, "kn")).toBe(false);
  });

  it("stripLatexForLangCheck removes math delimiters", () => {
    const stripped = stripLatexForLangCheck("Hello $x^2$ world");
    expect(stripped).not.toContain("$");
    expect(stripped).toContain("Hello");
  });
});
