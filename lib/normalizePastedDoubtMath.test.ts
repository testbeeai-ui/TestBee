import { describe, expect, it } from "vitest";
import { normalizePastedMathForDoubt } from "./normalizePastedDoubtMath";

describe("normalizePastedMathForDoubt", () => {
  it("converts LaTeX display \\[ \\] to $$", () => {
    const out = normalizePastedMathForDoubt(String.raw`Energy \[E = mc^2\] here`);
    expect(out).toContain("$$");
    expect(out).toContain("E = mc^2");
    expect(out).not.toContain(String.raw`\[`); // delimiter removed
  });

  it("converts LaTeX inline \\( \\) to $", () => {
    const out = normalizePastedMathForDoubt(String.raw`Let \(x^2\) be`);
    expect(out).toContain("$x^2$");
  });

  it("unwraps fenced latex blocks", () => {
    const out = normalizePastedMathForDoubt("Intro\n```latex\n\\frac{a}{b}\n```\noutro");
    expect(out).toContain("$$");
    expect(out).toContain(String.raw`\frac{a}{b}`);
  });
});
