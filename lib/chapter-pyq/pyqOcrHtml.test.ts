import katex from "katex";
import { describe, expect, it } from "vitest";
import { cleanPyqOcrText, pyqSolutionToHtml, pyqStemToHtml, pyqStudentTextIsSafe } from "./pyqOcrHtml";
import { PYQ_SAMPLE_FIGURES } from "./fixtures/lawsOfMotionSample";
import type { PyqFigureLinkRow } from "./pyqQuestionRow";

const link = (key: string): PyqFigureLinkRow => ({
  role: "question_body",
  sort_order: 0,
  figures: PYQ_SAMPLE_FIGURES.find((f) => f.figure_key === key) ?? null,
});

describe("cleanPyqOcrText", () => {
  it("keeps the printed stem and drops Document-AI image captions", () => {
    const raw =
      "Two billiard balls of equal mass 30 g strike a rigid wall. " +
      "The image displays a schematic diagram representing a physical setup. " +
      "It features a vertical wall. [[fig:p047_x552]]";
    const cleaned = cleanPyqOcrText(raw);
    expect(cleaned).toContain("Two billiard balls of equal mass 30 g strike a rigid wall.");
    expect(cleaned).toContain("[[fig:p047_x552]]");
    expect(cleaned).not.toMatch(/The image displays/i);
    expect(cleaned).not.toMatch(/vertical wall/i);
  });

  it("keeps only the printed option, not the figure caption glued onto it", () => {
    expect(
      cleanPyqOcrText(
        "1/2 The image is not a data chart or graph but rather a schematic diagram, likely representing a pulley."
      )
    ).toBe("1/2");
    expect(
      cleanPyqOcrText(
        "10 N The image is a schematic diagram illustrating a physics problem involving a pulley system."
      )
    ).toBe("10 N");
  });

  it("strips book headings, page numbers, and figure labels leaked into the stem", () => {
    expect(cleanPyqOcrText("The maximum speed would be ______ m/s. MUST DO PROBLEMS")).toBe(
      "The maximum speed would be ______ m/s."
    );
    expect(cleanPyqOcrText("Then F equals: (Take g = 10) 75N 49")).toBe(
      "Then F equals: (Take g = 10) 75N"
    );
    expect(
      cleanPyqOcrText(
        "the ratio of impulses is: ball (a)ball (b)\n\n[[fig:p047_x552]]"
      )
    ).toContain("the ratio of impulses is:");
    expect(
      cleanPyqOcrText(
        "the ratio of impulses is: ball (a)ball (b)\n\n[[fig:p047_x552]]"
      )
    ).not.toMatch(/ball \(a\)/i);
  });

  it("strips markdown bold stars and invented chart tables", () => {
    const cleaned = cleanPyqOcrText(
      "**A force F = (40i + 10j) N acts on a body** | Label | Time | :--- | :--- |"
    );
    expect(cleaned).not.toContain("**");
    expect(cleaned).not.toContain("|");
    expect(cleaned).toContain("A force F = (40i + 10j) N acts on a body");
  });

  it("keeps Complex Number modulus bars instead of treating them as a markdown table", () => {
    const equation = "The equation $|z - i| = |z - 1|$, $i = \\sqrt{-1}$, represents:";
    expect(cleanPyqOcrText(equation)).toContain("|z - i|");
    expect(cleanPyqOcrText(equation)).toContain("|z - 1|");
    expect(cleanPyqOcrText(equation)).toContain("represents:");
    const minMod = "Let $|z_1 - 8 - 2i| \\le 1$ and $|z_2 - 2 + 6i| \\le 2$, $z_1, z_2 \\in \\mathbb{C}$. Then the minimum value of $|z_1 - z_2|$ is:";
    expect(cleanPyqOcrText(minMod)).toContain("|z_1 - 8 - 2i|");
    expect(cleanPyqOcrText(minMod)).toContain("|z_1 - z_2|");
    expect(cleanPyqOcrText("Locus Based on Distance Formula")).toBe("");
  });

  it("joins a split $v = 10$\\sqrt{x}$ run and drops a trailing OCR star", () => {
    const cleaned = cleanPyqOcrText(
      "the relation $v = 10$\\sqrt{x}$ m $s^{-1}$ the force acting on the body is: *"
    );
    expect(cleaned).toContain("$v = 10\\sqrt{x}$");
    expect(cleaned).not.toMatch(/\$v = 10\$\\sqrt/);
    expect(cleaned).not.toMatch(/\*\s*$/);
  });

  it("wraps hat-vector parentheses in one math run", () => {
    const cleaned = cleanPyqOcrText(
      "r = ( 10tî + 15t²ĵ + 7k )m. The direction of net force"
    );
    expect(cleaned).toMatch(/\$r = \( 10t\\hat\{i\} \+ 15t\^\{2\}\\hat\{j\} \+ 7k \)\$/);
    expect(cleaned).toContain("The direction of net force");
  });

  it("wraps Laws of Motion hat-vector options and stems for KaTeX", () => {
    const stem = cleanPyqOcrText(
      "A force F = ( 40î + 10ĵ ) N acts on a body of mass 5 kg . If the body starts from rest, its position vector r at time $t = 10$ s will be"
    );
    expect(stem).toMatch(/\$F = \( 40\\hat\{i\} \+ 10\\hat\{j\} \)/);
    expect(stem).toContain("$t = 10$");
    const option = cleanPyqOcrText("( 100î + 400ĵ ) m");
    expect(option).toMatch(/\$\(100\\hat\{i\} \+ 400\\hat\{j\}\)(?:\\,\\mathrm\{m\})?\$/);
    expect(option).not.toMatch(/\\hat\{i\}(?![^$]*\$)/);
    expect(() => {
      const math = option.match(/\$([^$]+)\$/)?.[1] ?? "";
      katex.renderToString(math, { throwOnError: true });
    }).not.toThrow();
    expect(cleanPyqOcrText("2$\\sqrt{p/k}$")).toContain("$2\\sqrt{p/k}$");
    expect(cleanPyqOcrText("π/6")).toContain("$\\pi/6$");
    expect(cleanPyqOcrText("0.4 kg m s⁻¹")).toMatch(/\$0\.4\\,\\mathrm\{kg\\,m\\,s\^\{-1\}\}\$/);
    expect(cleanPyqOcrText("$g = 9$.8 $ms^{-2}$")).toContain("$g = 9.8\\,ms^{-2}$");
    expect(cleanPyqOcrText("7 m $s^{-2}$")).toContain("$7\\,m\\,s^{-2}$");
  });

  it("wraps remaining Laws of Motion stems and options so KaTeX compiles", () => {
    const cases: Array<[string, RegExp]> = [
      ["( 100î + 400ĵ ) m", /\$\(100\\hat\{i\} \+ 400\\hat\{j\}\)(?:\\,\\mathrm\{m\})?\$/],
      ["2î - ĵ - k", /\$2\\hat\{i\}/],
      ["$F_{1}$ = 5î + 8ĵ + 7k and rest", /\$F_\{1\} = 5\\hat\{i\}/],
      ["mlω²/k-mω²", /\\omega/],
      ["μg/r", /\\mu/],
      ["R ≤μg/ω²", /\\le /],
      ["F/m θ- μ_K (g - F/m θ)", /\\theta/],
      ["m(v²/μₛ R + g)", /\\mu/],
      ["3g/4", /\$3g\/4\$/],
      ["3/5 g", /3\/5/],
      ["$g = 9$. 8 m $s^{-2}$", /9\.8/],
      ["$m = 0$.5 kg", /0\.5/],
      ["$y = x$²/4", /x\^\{2\}\/4/],
      ["1/3$\\sqrt{3}$", /1\/3\\sqrt\{3\}/],
      ["(Given $g = acceleration$ due to gravity)", /g = acceleration due/],
      ["k-mω²$l_{0}$/mω²", /l_\{0\}/],
      ["if π² = 9.8 and g = 10", /\\pi\^\{2\} = 9\.8/],
      ["μₛ = 0.2", /\\mu/],
      ["dM(t)/dt = bv²(t), where v(t) is", /bv\^\{2\}\(t\)/],
      ["m_A = 1 kg and m_B = 3 kg", /m_\{A\} = 1/],
      ["4$a_{1}$ + 2$a_{2}$ + $a_{3}$ + $a_{4}$ = 0", /4a_\{1\}/],
      ["v$\\sqrt{m/2K}$", /\$v\\sqrt\{m\/2K\}\$/],
      ["1 - $e^{-2}$π", /e\^\{-2\}\\pi/],
      ["(3/π) rotations", /3\/\\pi/],
      ["($g = 10$ m/s²)", /m\/s/],
      ["0.4 kg m s⁻¹, 0.1 m s⁻¹", /0\.4\\,\\mathrm\{kg\\,m\\,s\^\{-1\}\}/],
      ["μ= vₒ²+rgθ/rg+vₒ²θ", /\\mu/],
      ["1 - 1/n²", /1\/n\^\{2\}/],
      ["2mω²/k", /\\omega/],
    ];
    for (const [raw, re] of cases) {
      const cleaned = cleanPyqOcrText(raw);
      expect(cleaned, raw).toMatch(re);
      expect((cleaned.match(/\$/g) ?? []).length % 2, raw).toBe(0);
      for (const math of [...cleaned.matchAll(/\$([^$]+)\$/g)].map((m) => m[1] ?? "")) {
        expect(() => katex.renderToString(math, { throwOnError: true })).not.toThrow();
      }
    }
  });

  it("turns 45^○ into a degree in math mode", () => {
    expect(cleanPyqOcrText("an angle of 45^○ with the horizontal")).toContain("$45^{\\circ}$");
  });

  it("wraps smashed Maths OCR so KaTeX can render Quadratic Equation Q1", () => {
    const cleaned = cleanPyqOcrText(
      "Let α and β be the roots of x^{2} + $\\sqrt{3x}$ - 16 = 0, and γ and δ be the roots of x^{2} + 3x - 1 = 0. If Pₙ = αⁿ + βⁿ and Qₙ = γⁿ + δⁿ, then $P_{25}$+\\sqrt{3$P_{24}$}$/2$P_{23}$ + $Q_{25} - Q_{23}$/$Q_{24}$ is equal to"
    );
    expect(cleaned).toContain("$x^{2} + \\sqrt{3}x - 16 = 0$");
    expect(cleaned).toContain("$x^{2} + 3x - 1 = 0$");
    expect(cleaned).toContain("$P_{n} = α^{n} + β^{n}$");
    expect(cleaned).toContain("$Q_{n} = γ^{n} + δ^{n}$");
    expect(cleaned).toContain("\\frac{P_{25}");
    expect(cleaned).toContain("\\frac{Q_{25} - Q_{23}}{Q_{24}}");
    expect(cleaned).not.toMatch(/\\sqrt\{3\$/);
    expect(cleaned).not.toMatch(/x\^\{2\}(?![^$]*\$)/);
    for (const math of [...cleaned.matchAll(/\$([^$]+)\$/g)].map((m) => m[1])) {
      expect(() => katex.renderToString(math, { throwOnError: true })).not.toThrow();
    }
  });

  it("wraps unicode powers, limits, and p+q equals in Maths stems", () => {
    expect(
      cleanPyqOcrText(
        "For t > -1, let αₜ and βₜ be the roots of the equation ((t+2)¹/7 - 1)x^{2} + ((t+2)¹/6 - 1) x + ((t+2)¹/21 - 1) = 0 If ₜ →-1^+ αₜ = a and ₜ →-1^+ βₜ = b, then 72(a + b)² is equal to ______."
      )
    ).toContain("$\\lim_{t \\to -1^{+}} α_{t} = a$");
    expect(
      cleanPyqOcrText("Let p and q be two positive numbers such that p + $q = 2$ and p⁴ + q⁴ = 272.")
    ).toContain("$p + q = 2$");
    expect(
      cleanPyqOcrText("Let p and q be two positive numbers such that p + $q = 2$ and p⁴ + q⁴ = 272.")
    ).toContain("$p^{4} + q^{4} = 272$");
    expect(
      cleanPyqOcrText(
        "Consider the two sets: $A = {m$ ∈R : both the roots of x^{2} - (m + 1)x + m + 4 = 0 are real }"
      )
    ).toContain("$A = \\{m \\in \\mathbb{R}");
    expect(
      cleanPyqOcrText(
        "The least positive value of ‘ a ’ for which the equation, $ 2x^{2} + (a - 10)x + 33/2 = 2a has real roots is $ __________."
      )
    ).toMatch(/\$2x\^\{2\}[^$]*= 2a\$ has real roots/);
  });

  it("renders a Complex Number set-builder instead of dumping \\\\thetaac, and strips the option footer", () => {
    const cleaned = cleanPyqOcrText(
      "Let A = {$ θ∈(-π/2, π) : 3+2i θ/1-2i θ is purely imaginary }. $ Then the sum of the elements in A is:"
    );
    expect(cleaned).toMatch(/\$A = \\\{/);
    expect(cleaned).toContain("\\theta");
    expect(cleaned).toMatch(/\\in\s/);
    expect(cleaned).not.toMatch(/\{\s*\$/);
    expect(cleaned).not.toContain("\\thetaac");
    expect(cleaned).not.toContain("\\thetaeta");
    expect(cleaned).not.toMatch(/\\\}(?![^$]*\$)/);
    for (const math of [...cleaned.matchAll(/\$([^$]+)\$/g)].map((m) => m[1] ?? "")) {
      expect(() => katex.renderToString(math, { throwOnError: true })).not.toThrow();
    }
    expect(cleanPyqOcrText("3π/4 16 4 4 mi")).toBe("$3\\pi/4$");
    expect(cleanPyqOcrText("5π/6")).toBe("$5\\pi/6$");
    expect(cleanPyqOcrText("is equal to. MathonGo #PaperPhodnaHai www.mathongo.com")).toBe(
      "is equal to."
    );
  });

  it("keeps a balanced Complex Number stem so every $…$ span compiles", () => {
    const raw =
      "Let $(-2 - i)^n = \\frac{3^n}{2^n} i^n$ (i = $\\sqrt{-1}$), where $n$ and $y$ are real numbers then $y - x$ equals";
    const cleaned = cleanPyqOcrText(raw);
    expect((cleaned.match(/\$/g) ?? []).length).toBe(10);
    expect(cleaned).toContain("$n$");
    expect(cleaned).toContain("$y$");
    expect(cleaned).toContain("$\\sqrt{-1}$");
    expect(cleaned).not.toMatch(/n andy/);
    expect(cleaned).not.toMatch(/theny/);
    for (const math of [...cleaned.matchAll(/\$([^$]+)\$/g)].map((m) => m[1] ?? "")) {
      expect(() => katex.renderToString(math, { throwOnError: true })).not.toThrow();
    }
  });

  it("wraps option latex that has commands but no $…$", () => {
    expect(cleanPyqOcrText("\\frac{1}{2}")).toBe("$\\frac{1}{2}$");
    expect(cleanPyqOcrText("\\frac{\\sqrt{3}}{2}")).toBe("$\\frac{\\sqrt{3}}{2}$");
    const arg = cleanPyqOcrText("\\arg z_2 = \\frac{\\pi}{2}");
    expect(arg).toMatch(/^\$\\arg z_2 = \\frac\{\\pi\}\{2\}\$$/);
    expect(() => katex.renderToString(arg.slice(1, -1), { throwOnError: true })).not.toThrow();
    const stem = cleanPyqOcrText("Let z \\in \\mathbb{C} with Im(z) = 10");
    expect(stem).toContain("$z \\in \\mathbb{C}$");
    expect(stem).toContain("with Im(z) = 10");
    for (const math of [...stem.matchAll(/\$([^$]+)\$/g)].map((m) => m[1] ?? "")) {
      expect(() => katex.renderToString(math, { throwOnError: true })).not.toThrow();
    }
  });

  it("does not split \\text{ and } inside a set-builder", () => {
    const raw =
      "Let $S = \\left\\{x : x \\in \\mathbb{R} \\text{ and } (\\sqrt{3} + \\sqrt{2})^{x^2-4} + (\\sqrt{3} - \\sqrt{2})^{x^2-4} = 10\\right\\}$. Then $n(S)$ is equal to";
    const cleaned = cleanPyqOcrText(raw);
    expect(cleaned).toContain("\\text{ and }");
    expect(cleaned).not.toContain("\\text{$");
    expect(pyqStudentTextIsSafe(cleaned)).toBe(true);
    for (const math of [...cleaned.matchAll(/\$([^$]+)\$/g)].map((m) => m[1] ?? "")) {
      expect(() => katex.renderToString(math, { throwOnError: true })).not.toThrow();
    }
  });

  it("does not swallow $\\sqrt{\\lambda - 1}$ after another math span", () => {
    const raw =
      "For $\\alpha, \\beta, z \\in \\mathbb{C}$ and $\\lambda > 1$, if $\\sqrt{\\lambda - 1}$ is the radius of the circle $|z - \\alpha|^2 + |z - \\beta|^2 = 2\\lambda$, then $|\\alpha - \\beta|$ is equal to ______.";
    const cleaned = cleanPyqOcrText(raw);
    expect(cleaned).toContain("$\\sqrt{\\lambda - 1}$");
    expect(pyqStudentTextIsSafe(cleaned)).toBe(true);
  });
});

describe("pyqStemToHtml", () => {
  it("wraps prose in a paragraph and keeps $KaTeX$ delimiters", () => {
    const html = pyqStemToHtml("Identify where $(t_3 - t_2) < t_1$.", []);
    expect(html).toContain('<p class="nta-math-plain">');
    expect(html).toContain("$(t_3 - t_2) &lt; t_1$");
    expect(html).not.toContain("**");
  });

  it("keeps the figure img next to the stem paragraph", () => {
    const html = pyqStemToHtml("The $p$-$t$ curve.\n\n[[fig:p047_x101]]", [link("p047_x101")]);
    expect(html).toContain("<p class=\"nta-math-plain\">The $p$-$t$ curve.</p>");
    expect(html).toContain("<img");
    expect(html).not.toContain("[[fig:");
  });

  it("still emits the paper raster when figure_links is missing", () => {
    const html = pyqStemToHtml(
      "Three blocks A, B and C are pulled as shown.\n\n[[fig:p047_x549]]",
      []
    );
    expect(html).toContain("<img");
    expect(html).toContain("p047_x549.png");
    expect(html).not.toContain("[[fig:");
  });
});

describe("pyqSolutionToHtml", () => {
  it("wraps numbered steps without stripping them as OCR captions", () => {
    const html = pyqSolutionToHtml(
      "The graph is a unit circle.\n\n1. Use King.\n2. The answer is option 4."
    );
    expect(html).toContain("The graph is a unit circle.");
    expect(html).toContain('class="nta-sol-lead nta-math-plain"');
    expect(html).toContain('class="nta-sol"');
    expect(html).toContain('class="nta-sol-n"');
    expect(html).toContain("Use King.");
    expect(html).toContain("The answer is option 4.");
    expect(html).not.toMatch(/>1\. Use King/);
  });

  it("marks the last numbered step as the close of the write-up", () => {
    const html = pyqSolutionToHtml("1. Start.\n2. Finish.");
    expect(html).toContain("nta-sol-step--end");
    expect(html.match(/class="nta-sol-step/g)?.length).toBe(2);
  });
});
