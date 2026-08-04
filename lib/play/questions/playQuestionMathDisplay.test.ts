import { describe, expect, it } from "vitest";
import {
  formatPlayQuestionStemForDisplay,
  normalizePhysicsNotationForDisplay,
} from "./playQuestionMathDisplay";

describe("formatPlayQuestionStemForDisplay — pi / area formulas", () => {
  it("does not shatter already-delimited \\pi r^{2} math", () => {
    const input =
      "According to the equation of continuity for an incompressible fluid, $A_1v_1 = A_2v_2$. Since the cross-sectional area $A = \\pi r^{2}$, we have $\\pi r^{2}v = \\pi(r/3)^{2}v_2$. Simplifying gives $r^{2}v = \\frac{r^{2}}{9}v_2$, which results in $v_2 = 9v$.";
    const out = formatPlayQuestionStemForDisplay(input);
    expect(out).not.toMatch(/\\\$\\pi/);
    expect(out).toContain("$A = \\pi r^{2}$");
    expect(out).toMatch(/\$\\pi r\^\{2\}\s*v = \\pi\(r\/3\)\^\{2\}\s*v_2\$/);
    expect(out).toMatch(/\$v_2 = 9\s*v\$/);
  });

  it("still wraps bare ASCII pi r^2", () => {
    expect(formatPlayQuestionStemForDisplay("A = pi r^2")).toContain("$\\pi r^{2}$");
    expect(formatPlayQuestionStemForDisplay("area is pir^2")).toContain("$\\pi r^{2}$");
  });

  it("leaves TeX \\pi alone when already backslash-prefixed", () => {
    expect(formatPlayQuestionStemForDisplay("$A = \\pi r^{2}$")).toBe("$A = \\pi r^{2}$");
  });
});

describe("Learning Outcomes / Numerals physics LaTeX", () => {
  it("converts unicode μC without producing raw \\\\mu$$", () => {
    const out = formatPlayQuestionStemForDisplay(
      "A charge 2 μC is placed in a field of 500 N C⁻¹. The force magnitude is:"
    );
    expect(out).not.toMatch(/\\mu\$\$/);
    expect(out).not.toMatch(/\\\\mu/);
    expect(out).toContain("$\\mu\\mathrm{C}$");
    expect(out).toContain("$\\mathrm{C}^{-1}$");
  });

  it("renders unit-vector / scientific unicode as KaTeX", () => {
    const out = formatPlayQuestionStemForDisplay(
      "A charge −3 nC is placed in a field 2 × 10⁴î N C⁻¹. The force is:"
    );
    expect(out).toContain("$\\times$");
    expect(out).toContain("$10^{4}$");
    expect(out).toContain("$\\hat{\\imath}$");
  });

  it("wraps bare Numerals \\\\frac options in $...$", () => {
    const out = formatPlayQuestionStemForDisplay("\\frac{q^2 E^2 t^2}{2m}");
    expect(out.startsWith("$\\frac{")).toBe(true);
    expect(out.endsWith("$")).toBe(true);
    expect(out).toContain("q^2");
    expect(out).toContain("E^2");
  });

  it("wraps bare \\\\mu in stems once only", () => {
    const out = formatPlayQuestionStemForDisplay(
      "Two point charges of +8 \\mu C and -8 \\mu C are separated by 2 mm."
    );
    expect(out).toContain("$\\mu$");
    expect(out).not.toMatch(/\$\$\\mu\$\$/);
    expect(out.match(/\$\\mu\$/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("normalizePhysicsNotationForDisplay is idempotent-ish on μC", () => {
    const once = normalizePhysicsNotationForDisplay("2 μC");
    const twice = normalizePhysicsNotationForDisplay(once);
    expect(once).toContain("$\\mu\\mathrm{C}$");
    expect(twice).toContain("$\\mu\\mathrm{C}$");
  });
});
