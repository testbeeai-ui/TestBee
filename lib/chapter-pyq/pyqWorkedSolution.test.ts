import { describe, expect, it } from "vitest";
import {
  isPaperOcrSolution,
  parsePyqWorkedSolution,
  problemTexForQuestion,
  stackEqualsChain,
  unwrapProblemTex,
  wrapDisplayTex,
} from "./pyqWorkedSolution";

const SYMMETRY_JSON = JSON.stringify({
  answer: "4",
  title: "Definite Integral via Symmetry",
  problem_tex: "I = \\int_{-\\pi/6}^{\\pi/6} \\frac{\\pi + 4x^{11}}{1 - \\sin(|x| + \\pi/6)}\\,dx",
  answer_tex: "I = 4\\pi",
  answer_note: "Option 4 is the correct choice",
  phases: [
    {
      title: "Symmetry Decomposition",
      paragraphs: [
        "The denominator $1 - \\sin(|x| + \\pi/6)$ is an even function since $|-x| = |x|$.",
        "Applying the even-function rule to the remaining part:",
      ],
      callout: {
        text: "Odd component vanishes over $[-a, a]$:",
        tex: "\\int_{-a}^{a} f_{\\text{odd}}(x)\\,dx = 0",
      },
      displays: ["I = 2\\pi \\int_{0}^{\\pi/6} \\frac{dx}{1 - \\sin(x + \\pi/6)}"],
      blocks: [
        {
          kind: "paragraph",
          text: "The denominator $1 - \\sin(|x| + \\pi/6)$ is an even function since $|-x| = |x|$.",
        },
        {
          kind: "callout",
          text: "Odd component vanishes over $[-a, a]$:",
          tex: "\\int_{-a}^{a} f_{\\text{odd}}(x)\\,dx = 0",
        },
        {
          kind: "paragraph",
          text: "Applying the even-function rule to the remaining part:",
        },
        {
          kind: "display",
          tex: "I = 2\\pi \\int_{0}^{\\pi/6} \\frac{dx}{1 - \\sin(x + \\pi/6)}",
        },
      ],
    },
    {
      title: "Trigonometric Substitution",
      paragraphs: [
        "Let $J$ be the remaining integral.",
        "Evaluating the standard anti-derivative:",
      ],
      displays: [
        "J = \\int_{0}^{\\pi/6} (\\sec^2 u + \\sec u \\tan u)\\,dx",
        "J = \\Big[\\tan(x+\\pi/6)+\\sec(x+\\pi/6)\\Big]_{0}^{\\pi/6}",
      ],
      blocks: [
        { kind: "paragraph", text: "Let $J$ be the remaining integral." },
        {
          kind: "display",
          tex: "J = \\int_{0}^{\\pi/6} (\\sec^2 u + \\sec u \\tan u)\\,dx",
        },
        { kind: "paragraph", text: "Evaluating the standard anti-derivative:" },
        {
          kind: "display",
          tex: "J = \\Big[\\tan(x+\\pi/6)+\\sec(x+\\pi/6)\\Big]_{0}^{\\pi/6}",
        },
      ],
    },
  ],
});

describe("parsePyqWorkedSolution", () => {
  it("keeps the HTML-card title and phase names instead of Setup/Working", () => {
    const parsed = parsePyqWorkedSolution(SYMMETRY_JSON);
    expect(parsed?.title).toBe("Definite Integral via Symmetry");
    expect(parsed?.phases.map((p) => p.title)).toEqual([
      "Symmetry Decomposition",
      "Trigonometric Substitution",
    ]);
    expect(parsed?.phases[0]?.blocks.map((b) => b.kind)).toEqual([
      "paragraph",
      "callout",
      "paragraph",
      "display",
    ]);
    expect(parsed?.phases[1]?.blocks.map((b) => b.kind)).toEqual([
      "paragraph",
      "display",
      "paragraph",
      "display",
    ]);
  });

  it("parses glm JSON whose TeX backslashes were not doubled", () => {
    const loose = [
      "{",
      ' "answer": "2",',
      ' "title": "Continuity of Derivative at Origin",',
      ' "problem_tex": "f(x)=\\sin\\left(\\frac{1}{x}\\right)",',
      ' "answer_tex": "option 2",',
      ' "answer_note": "Option 2 is the correct choice",',
      ' "phases": [',
      "  {",
      '   "title": "Check Continuity at the Origin",',
      '   "paragraphs": ["We first test whether f is continuous at x = 0."],',
      '   "blocks": [{ "kind": "paragraph", "text": "We first test whether f is continuous at x = 0." }]',
      "  },",
      "  {",
      '   "title": "Compute the Derivative from First Principles",',
      '   "paragraphs": ["Away from the origin we differentiate."],',
      '   "blocks": [{ "kind": "paragraph", "text": "Away from the origin we differentiate." }]',
      "  }",
      " ]",
      "}",
    ].join("\n");
    const parsed = parsePyqWorkedSolution(loose);
    expect(parsed?.title).toBe("Continuity of Derivative at Origin");
    expect(parsed?.phases.map((p) => p.title)).toEqual([
      "Check Continuity at the Origin",
      "Compute the Derivative from First Principles",
    ]);
    expect(parsed?.problem_tex).toContain("\\sin");
    expect(parsed?.problem_tex).toContain("\\left");
  });

  it("does not keep JSON \\frac as a form-feed in the TeX", () => {
    const loose = [
      "{",
      ' "answer": "1",',
      ' "title": "Critical points",',
      ' "problem_tex": "a=-\\frac{3}{2}",',
      ' "answer_tex": "a=-\\frac{3}{2}",',
      ' "answer_note": "done",',
      ' "phases": [',
      '  { "title": "Setup", "paragraphs": ["Start."] },',
      '  { "title": "Solve", "paragraphs": ["a=-\\frac{3}{2}."] }',
      " ]",
      "}",
    ].join("\n");
    const parsed = parsePyqWorkedSolution(loose);
    expect(parsed?.problem_tex).toContain("\\frac{3}{2}");
    expect(parsed?.problem_tex).not.toContain("\f");
  });

  it("shows the computed value on the footer chip, not the option number", () => {
    const parsed = parsePyqWorkedSolution(
      JSON.stringify({
        answer: "1",
        title: "Determinant Limit via Row Operations",
        problem_tex: "(\\lambda+\\mu+\\nu)^2",
        answer_tex: "(\\lambda + \\mu + \\nu)^2 = 16",
        answer_note: "Option 1 is the correct choice",
        phases: [
          { title: "Expand", paragraphs: ["Row operations."] },
          {
            title: "Compute the final value",
            paragraphs: ["Add the coefficients and square."],
            displays: ["(\\lambda + \\mu + \\nu)^2 = 16"],
          },
        ],
      })
    );
    expect(parsed?.answer_note).toBe("Option 1 is the correct choice");
    expect(parsed?.answer_tex).toBe("16");
  });

  it("keeps a compact keyed chip instead of repeating the last working line", () => {
    const parsed = parsePyqWorkedSolution(
      JSON.stringify({
        answer: "1",
        title: "Circle matching",
        problem_tex: "x^2+y^2=4",
        answer_tex: "(2a,b^{2})=(\\alpha,\\beta^{2}-4r)",
        answer_note: "So,",
        phases: [
          {
            title: "Radius from the intercepts",
            paragraphs: ["Drop a perpendicular to the chord."],
            blocks: [{ kind: "paragraph", text: "Drop a perpendicular to the chord." }],
          },
          {
            title: "Match coordinates",
            paragraphs: ["So,"],
            displays: ["(2a,b^{2})=(\\alpha,\\beta^{2}-4r)"],
            blocks: [
              { kind: "paragraph", text: "So," },
              { kind: "display", tex: "(2a,b^{2})=(\\alpha,\\beta^{2}-4r)" },
            ],
          },
        ],
      })
    );
    expect(parsed?.answer_note).toBe("Option 1 is the correct choice");
    expect(parsed?.answer_tex).toBe("1");
  });

  it("keeps K = 1 style chips on the footer", () => {
    const parsed = parsePyqWorkedSolution(
      JSON.stringify({
        answer: "1",
        title: "Integer k",
        problem_tex: "k=?",
        answer_tex: "K = 1",
        answer_note: "Option 1 is the correct choice",
        phases: [
          { title: "Setup", paragraphs: ["Start."] },
          { title: "Finish", paragraphs: ["Done."] },
        ],
      })
    );
    expect(parsed?.answer_note).toBe("Option 1 is the correct choice");
    expect(parsed?.answer_tex).toBe("K = 1");
  });

  it("does not turn valid phase JSON into Setup/Working", () => {
    const parsed = parsePyqWorkedSolution(
      JSON.stringify({
        answer: "4",
        title: "Definite Integral via Symmetry",
        problem_tex: "I = \\int x\\,dx",
        answer_tex: "I = 4\\pi",
        answer_note: "Option 4 is the correct choice",
        phases: [
          { title: "Symmetry Decomposition", paragraphs: ["Even denominator."] },
          { title: "Trigonometric Substitution", paragraphs: ["Let $J$."] },
        ],
      })
    );
    expect(parsed?.title).toBe("Definite Integral via Symmetry");
    expect(parsed?.phases.map((p) => p.title)).toEqual([
      "Symmetry Decomposition",
      "Trigonometric Substitution",
    ]);
  });

  it("reads callouts, displays, and limit grids from the solver JSON", () => {
    const parsed = parsePyqWorkedSolution(
      JSON.stringify({
        answer: "4",
        title: "Definite Integral via Symmetry",
        problem_tex: "I = \\int x\\,dx",
        answer_tex: "I = 4\\pi",
        answer_note: "Option 4 is the correct choice",
        phases: [
          {
            title: "Symmetry Decomposition",
            paragraphs: ["The denominator is even."],
            callout: { text: "Odd vanishes", tex: "\\int_{-a}^{a} f = 0" },
            displays: ["I = 2\\pi J"],
          },
          {
            title: "Evaluate Boundaries",
            paragraphs: ["Subtract the bounds."],
            grid: [
              { label: "Upper", tex: "\\sqrt{3}+2" },
              { label: "Lower", tex: "\\sqrt{3}" },
            ],
          },
        ],
      })
    );
    expect(parsed?.title).toBe("Definite Integral via Symmetry");
    expect(parsed?.phases).toHaveLength(2);
    expect(parsed?.phases[0]?.callout?.tex).toContain("f = 0");
    expect(parsed?.phases[1]?.grid).toHaveLength(2);
    expect(parsed?.phases[0]?.blocks.map((b) => b.kind)).toEqual([
      "paragraph",
      "callout",
      "display",
    ]);
  });

  it("maps paper OCR step cards onto the worked sheet", () => {
    const parsed = parsePyqWorkedSolution(
      [
        "<!-- paper-ocr -->",
        "## Step 1: Simplification of LHS",
        "$\\frac{3\\cos 2x+\\cos^3 2x}{\\cos^6 x-\\sin^6 x}=x^3-x^2+6$",
        "## Step 2: Solving polynomial equation",
        "$x^3-x^2+2=0$",
        "## Step 3: Final evaluation",
        "so, sum of real solutions",
        "$=-1$",
      ].join("\n")
    );
    expect(parsed?.title).toBe("Worked solution");
    expect(parsed?.phases.map((p) => p.title)).toEqual([
      "Simplification of LHS",
      "Solving polynomial equation",
      "Final evaluation",
    ]);
    expect(parsed?.phases[0]?.blocks.some((b) => b.kind === "display")).toBe(true);
    expect(parsed?.answer_tex).toContain("-1");
  });

  it("still treats crop-only figure tokens as paper, not glm numbered markdown", () => {
    expect(isPaperOcrSolution("<!-- paper-ocr -->\n1. King.")).toBe(true);
    expect(isPaperOcrSolution("See [[fig:s2026j_q01_crop]]")).toBe(true);
    expect(isPaperOcrSolution("1. Split even and odd.\n2. Integrate.")).toBe(false);
  });

  it("turns leftover numbered write-ups into one step each, never Setup/Working", () => {
    const parsed = parsePyqWorkedSolution(
      "1. Split even and odd.\n2. Integrate.\n3. The value is $4\\pi$."
    );
    expect(parsed?.title).toBe("Worked solution");
    expect(parsed?.phases.map((p) => p.title)).toEqual(["Step 1", "Step 2", "Step 3"]);
    expect(parsed?.answer_note).toContain("4\\pi");
  });

  it("does not leave semicolon gaps after lifting split-point formulas", () => {
    const parsed = parsePyqWorkedSolution(
      "1. Evaluate at the split points: $F(0)=-\\frac{1}{3}-1-\\frac{1}{2}=-\\frac{11}{6}$; $F(\\pi/2)=0$.\n2. Compute each piece: $A=\\frac{7}{3}$; so its negative is $B=-\\frac{1}{12}$."
    );
    const kinds = parsed?.phases.flatMap((p) => p.blocks.map((b) => b.kind));
    const prose = parsed?.phases.flatMap((p) =>
      p.blocks.filter((b) => b.kind === "paragraph").map((b) => b.text)
    );
    expect(prose?.some((t) => /^[;.,]+$/.test(t.trim()))).toBe(false);
    expect(kinds).toContain("display");
    expect(parsed?.phases[1]?.blocks.map((b) => b.kind)).toEqual([
      "paragraph",
      "display",
      "paragraph",
      "display",
    ]);
  });

  it("wraps display tex in $$", () => {
    expect(wrapDisplayTex("I = 4\\pi")).toBe("$$I = 4\\pi$$");
    expect(wrapDisplayTex("$$I = 4\\pi$$")).toBe("$$I = 4\\pi$$");
  });

  it("stacks a long equals-chain so the x=-1/4 check does not need a scrollbar", () => {
    const tex =
      "2(-1/64) - 9(1/16) + 12(-1/4) + 4 = -1/32 - 9/16 - 3 + 4 = -1/32 - 18/32 + 1 = -19/32 + 32/32 = 13/32 \\ne 0";
    const stacked = stackEqualsChain(tex);
    expect(stacked).toContain("\\begin{aligned}");
    expect(stacked).toContain("& 2(-1/64) - 9(1/16) + 12(-1/4) + 4");
    expect(stacked).toContain("&= 13/32 \\ne 0");
    expect(stackEqualsChain("16-36+24+4=8 \\ne 0")).toBe("16-36+24+4=8 \\ne 0");
    expect(wrapDisplayTex(tex)).toContain("\\begin{aligned}");
  });

  it("does not treat subscript k=1 as another equals in the chain", () => {
    const tex = "\\sum_{k=1}^{n}\\frac{k}{2^k}=2-\\frac{n+2}{2^n}";
    expect(stackEqualsChain(tex)).toBe(tex);
    expect(wrapDisplayTex(tex)).toBe(`$$${tex}$$`);
  });

  it("splits jammed root-checks into a labeled grid and short prose", () => {
    const parsed = parsePyqWorkedSolution(
      JSON.stringify({
        answer: "1",
        title: "Bounding an Integral via Perfect Square",
        problem_tex: "I = \\int_{1}^{2} dx",
        answer_tex: "\\frac{1}{9} < I^{2} < \\frac{1}{8}",
        answer_note: "Option 1 is the correct choice",
        phases: [
          {
            title: "Factor the cubic inside the root",
            paragraphs: [
              "Try to write the cubic as a product with a repeated factor. Testing $x=2$ gives $16-36+24+4=8 \\ne 0$; testing $x=-1/2$: $2(-1/8)-9(1/4)+12(-1/2)+4 = -4.5 \\ne 0$.",
              "Check $x = 2$ again carefully: $2(8) - 9(4) + 12(2) + 4 = 16 - 36 + 24 + 4 = 8$. Not zero. Try $x = -1/4$: $2(-1/64) - 9(1/16) + 12(-1/4) + 4 = 13/32 \\ne 0$.",
              "Instead, look for a factorization of the form $(x-a)^2(2x-b)$.",
            ],
            blocks: [
              {
                kind: "paragraph",
                text: "Try to write the cubic as a product with a repeated factor. Testing $x=2$ gives $16-36+24+4=8 \\ne 0$; testing $x=-1/2$: $2(-1/8)-9(1/4)+12(-1/2)+4 = -4.5 \\ne 0$.",
              },
              {
                kind: "paragraph",
                text: "Check $x = 2$ again carefully: $2(8) - 9(4) + 12(2) + 4 = 16 - 36 + 24 + 4 = 8$. Not zero. Try $x = -1/4$: $2(-1/64) - 9(1/16) + 12(-1/4) + 4 = 13/32 \\ne 0$.",
              },
              {
                kind: "paragraph",
                text: "Instead, look for a factorization of the form $(x-a)^2(2x-b)$.",
              },
              {
                kind: "callout",
                text: "Match coefficients for a double root:",
                tex: "2x^{3}-9x^{2}+12x+4 = (x-a)^{2}(2x-b)",
              },
              {
                kind: "display",
                tex: "2x^{3}-9x^{2}+12x+4 = (x-2)^{2}(2x+1)",
              },
            ],
          },
          { title: "Verify the factorization", paragraphs: ["Expand the product."] },
        ],
      })
    );
    const kinds = parsed?.phases[0]?.blocks.map((b) => b.kind);
    expect(kinds).toEqual(["paragraph", "grid", "paragraph", "callout", "display"]);
    const intro = parsed?.phases[0]?.blocks[0];
    expect(intro?.kind === "paragraph" ? intro.text : "").toMatch(/repeated factor/);
    expect(intro?.kind === "paragraph" ? intro.text : "").not.toMatch(/Testing/);
    const grid = parsed?.phases[0]?.blocks.find((b) => b.kind === "grid");
    expect(grid?.kind === "grid" ? grid.cells : []).toHaveLength(4);
    expect(grid?.kind === "grid" ? grid.cells.map((c) => c.label).join(" ") : "").toMatch(/x\s*=\s*2/);
    const close = parsed?.phases[0]?.blocks.find(
      (b) => b.kind === "paragraph" && b.text.startsWith("Instead")
    );
    expect(close?.kind === "paragraph" ? close.text : "").toContain("$(x-a)^2(2x-b)$");
  });

  it("lifts a jammed equals-chain out of a paragraph into a boxed display", () => {
    const parsed = parsePyqWorkedSolution(
      JSON.stringify({
        answer: "1",
        title: "Bounding an Integral via Perfect Square",
        problem_tex: "I = 1",
        answer_tex: "1",
        answer_note: "Option 1",
        phases: [
          {
            title: "Verify the factorization",
            paragraphs: [
              "Expand $(x-2)^2(2x+1) = (x^2 - 4x + 4)(2x+1) = 2x^3 + x^2 - 8x^2 - 4x + 8x + 4 = 2x^3 - 7x^2 + 4x + 4$.",
            ],
            blocks: [
              {
                kind: "paragraph",
                text: "Expand $(x-2)^2(2x+1) = (x^2 - 4x + 4)(2x+1) = 2x^3 + x^2 - 8x^2 - 4x + 8x + 4 = 2x^3 - 7x^2 + 4x + 4$.",
              },
            ],
          },
          { title: "Next", paragraphs: ["Continue."] },
        ],
      })
    );
    expect(parsed?.phases[0]?.blocks.map((b) => b.kind)).toEqual(["paragraph", "display"]);
    const lead = parsed?.phases[0]?.blocks[0];
    expect(lead?.kind === "paragraph" ? lead.text : "").toBe("Expand");
    const box = parsed?.phases[0]?.blocks[1];
    expect(box?.kind === "display" ? box.tex : "").toContain("(x-2)^2(2x+1)");
  });

  it("keeps GIF and interval brackets in one sentence", () => {
    const parsed = parsePyqWorkedSolution(
      JSON.stringify({
        answer: "3",
        title: "Greatest Integer Function Integration",
        problem_tex: "I = 1",
        answer_tex: "3",
        answer_note: "Option 3",
        phases: [
          {
            title: "Locate the Break Points",
            paragraphs: [
              "The greatest integer function $[x]$ is constant on intervals between integers, so we split $[-\\pi/2,\\pi/2]$ at every integer inside the range.",
              "Since $-\\pi/2\\approx-1.57$ and $\\pi/2\\approx1.57$, the integers involved are $-1$, $0$ and $1$.",
            ],
          },
          {
            title: "Write the Piecewise Integral",
            paragraphs: ["On each subinterval the integrand is constant."],
          },
        ],
      })
    );
    const prose = parsed?.phases[0]?.blocks
      .filter((b) => b.kind === "paragraph")
      .map((b) => (b.kind === "paragraph" ? b.text : ""));
    expect(prose).toHaveLength(2);
    expect(prose?.[0]).toContain("$[x]$");
    expect(prose?.[0]).toContain("$[-\\pi/2,\\pi/2]$");
    expect(prose?.[0]).toContain("at every integer inside the range.");
    expect(prose?.[1]).toContain("$-\\pi/2\\approx-1.57$ and $\\pi/2\\approx1.57$");
    expect(prose?.[1]).toContain("$-1$, $0$ and $1$");
  });
});

describe("problemTexForQuestion", () => {
  const TRIG_STEM =
    "\\text{If } \\theta_1 \\text{ and } \\theta_2 \\text{ be respectively the smallest and the largest values of } \\theta \\in (0, 2\\pi) - \\{\\pi\\} \\text{ satisfying } 2\\cot^2\\theta - \\frac{5}{\\sin\\theta} + 4 = 0, \\text{ then } \\int_{\\theta_1}^{\\theta_2} \\cos^2 3\\theta \\, d\\theta = ?";

  it("unwraps a \\text sentence into wrapping prose and inline math", () => {
    const out = unwrapProblemTex(TRIG_STEM);
    expect(out.startsWith("If $\\theta_1$")).toBe(true);
    expect(out).toContain("and $\\theta_2$");
    expect(out).toContain("satisfying $2\\cot^2\\theta");
    expect(out).toContain("$\\int_{\\theta_1}^{\\theta_2}");
    expect(out).not.toContain("\\text{");
    expect(out).not.toContain("$$");
  });

  it("renders \\text stems inline so the question pill can wrap", () => {
    const q = problemTexForQuestion(TRIG_STEM);
    expect(q.display).toBe(false);
    expect(q.text).toContain("If $\\theta_1$");
  });

  it("keeps a short formula as a boxed display", () => {
    expect(problemTexForQuestion("I = \\int_{-\\pi/6}^{\\pi/6} x\\,dx")).toEqual({
      display: true,
      text: "I = \\int_{-\\pi/6}^{\\pi/6} x\\,dx",
    });
  });
});
