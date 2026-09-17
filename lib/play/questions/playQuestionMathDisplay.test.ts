import katex from "katex";
import { describe, expect, it } from "vitest";
import {
  formatPlayQuestionStemForDisplay,
  normalizePhysicsNotationForDisplay,
} from "./playQuestionMathDisplay";

function katexInners(text: string): string[] {
  return [...text.matchAll(/\$([^$]+)\$/g)].map((m) => m[1] ?? "");
}

function expectKatexClean(text: string): void {
  for (const inner of katexInners(text)) {
    const html = katex.renderToString(inner, { throwOnError: false, strict: "ignore" });
    expect(html, inner).not.toContain("katex-error");
  }
}

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
    expect(out).toContain("10^{4}");
    expect(out).toContain("\\hat{\\imath}");
    expectKatexClean(out);
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

describe("Class 11 Physics Learning Outcomes unicode → KaTeX", () => {
  it("wraps F = Gm₁m₂/r² instead of leaving unicode subscripts or naked r^{2}", () => {
    const out = formatPlayQuestionStemForDisplay("F = Gm₁m₂/r²");
    const prose = out.replace(/\$[^$]+\$/g, " ");
    expect(out).toContain("m_{1}");
    expect(out).toContain("m_{2}");
    expect(out).toContain("mathrm{r}");
    expect(out).toContain("^{2}");
    expect(out).not.toMatch(/Gm₁/);
    expect(prose).not.toMatch(/r\^\{2\}/);
    expectKatexClean(out);
  });

  it("wraps P = P₀ + ρgh greek and subscripts", () => {
    const out = formatPlayQuestionStemForDisplay("P = P₀ + ρgh");
    expect(out).toContain("P_{0}");
    expect(out).toContain("\\rho");
    expect(out).not.toContain("P₀");
    expect(out).not.toContain("ρ");
    expectKatexClean(out);
  });

  it("wraps terminal-velocity formula with r², ρ, η", () => {
    const out = formatPlayQuestionStemForDisplay("vₜ = 2r²(ρ − σ)g / 9η");
    const prose = out.replace(/\$[^$]+\$/g, " ");
    expect(prose).not.toMatch(/r\^\{2\}/);
    expect(out).toContain("\\rho");
    expect(out).toContain("\\eta");
    expectKatexClean(out);
  });

  it("wraps √(2gR) and T² ∝ a³", () => {
    const sqrtOut = formatPlayQuestionStemForDisplay("v_e = √(2gR)");
    expect(sqrtOut).toContain("\\sqrt");
    expectKatexClean(sqrtOut);

    const propOut = formatPlayQuestionStemForDisplay("T² ∝ a³");
    expect(propOut).toContain("\\propto");
    expectKatexClean(propOut);
  });

  it("wraps ½mv² and η = 1 − T₂/T₁", () => {
    const half = formatPlayQuestionStemForDisplay("½mv²");
    const halfProse = half.replace(/\$[^$]+\$/g, " ");
    expect(half).toContain("\\frac{1}{2}");
    expect(halfProse).not.toMatch(/\^\{2\}/);
    expectKatexClean(half);

    const eta = formatPlayQuestionStemForDisplay("η = 1 − T₂/T₁");
    expect(eta).toContain("\\eta");
    expect(eta).toContain("T_{2}");
    expect(eta).toContain("T_{1}");
    expectKatexClean(eta);
  });

  it("keeps √(1 + x²) as one KaTeX sqrt", () => {
    const out = formatPlayQuestionStemForDisplay("The function: f(x) = √(1 + x²) is continuous");
    expect(out).toContain("$\\sqrt{1 + x^{2}}$");
    expectKatexClean(out);
  });

  it("keeps λ₀ together as lambda with subscript", () => {
    const out = formatPlayQuestionStemForDisplay("λ(x) = λ₀x/L Its total charge is:");
    expect(out).toContain("\\lambda");
    expect(out).toContain("_{0}");
    expect(out.replace(/\$[^$]+\$/g, " ")).not.toContain("₀");
    expectKatexClean(out);
  });

  it("wraps f(x)² after a closing paren and μ₀ permeability", () => {
    const sq = formatPlayQuestionStemForDisplay(
      "If lim f(x) = 2 and lim g(x) = 3, then the limit of [f(x)² + g(x)²] is:"
    );
    expect(sq).toContain("^{2}");
    expect(sq.replace(/\$[^$]+\$/g, " ")).not.toContain("²");
    expectKatexClean(sq);

    const mu = formatPlayQuestionStemForDisplay("The numerical value of μ₀/4π is:");
    expect(mu).toContain("\\mu");
    expect(mu).toContain("_{0}");
    expect(mu.replace(/\$[^$]+\$/g, " ")).not.toContain("₀");
    expectKatexClean(mu);
  });

  it("wraps ω² and √(T/μ) without leftover unicode", () => {
    const w = formatPlayQuestionStemForDisplay("The negative sign in a = -ω²x indicates that acceleration is:");
    expect(w).toContain("\\omega");
    expect(w.replace(/\$[^$]+\$/g, " ")).not.toContain("²");
    expectKatexClean(w);

    const v = formatPlayQuestionStemForDisplay("v = √(T/μ)");
    expect(v).toContain("\\sqrt");
    expect(v).toContain("\\mu");
    expect(v).not.toContain("√");
    expectKatexClean(v);
  });

  it("wraps |A|² and rᵢ²", () => {
    const mag = formatPlayQuestionStemForDisplay("|A|²");
    expect(mag).toContain("^{2}");
    expect(mag.replace(/\$[^$]+\$/g, " ")).not.toContain("²");
    expectKatexClean(mag);

    const mi = formatPlayQuestionStemForDisplay("I = Σmᵢrᵢ²");
    expect(mi).toContain("\\Sigma");
    expect(mi.replace(/\$[^$]+\$/g, " ")).not.toContain("²");
    expectKatexClean(mi);
  });

  it("wraps F⃗₁←₂ vector-and-subscript notation", () => {
    const out = formatPlayQuestionStemForDisplay("The forces F⃗₁←₂ and F⃗₂←₁ satisfy:");
    expect(out).toContain("\\vec{F}");
    expect(out).toContain("\\leftarrow");
    expectKatexClean(out);
  });
});
