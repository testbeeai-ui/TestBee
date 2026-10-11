import { describe, expect, it } from "vitest";
import {
  isPaperOcrSolution,
  parsePyqWorkedSolution,
  problemTexForQuestion,
  stackEqualsChain,
  unwrapProblemTex,
  wrapBareTexProse,
  wrapDisplayTex,
} from "./pyqWorkedSolution";

describe("wrapBareTexProse", () => {
  it("wraps a powered group as one formula, not just its inner caret", () => {
    expect(wrapBareTexProse("Reduction formula for (1-x^7)^K")).toBe("Reduction formula for $(1-x^7)^{K}$");
    expect(wrapBareTexProse("P(x) = 5/[x(x^5+1)] and Q(x) = (x^5+1)^2/x^7.")).toBe(
      "P(x) = 5/[x($x^{5}$+1)] and Q(x) = $(x^5+1)^{2}$/$x^{7}$."
    );
    expect(wrapBareTexProse("The coefficient of x^{-6} is 5040")).toBe("The coefficient of $x^{-6}$ is 5040");
  });

  it("wraps a pure-math callout with no dollars", () => {
    expect(wrapBareTexProse("S_n = a\\,\\frac{1-r^{n}}{1-r}")).toBe("$S_n = a\\,\\frac{1-r^{n}}{1-r}$");
    expect(wrapBareTexProse("mg - T = ma_{cm}")).toBe("$mg - T = ma_{cm}$");
    expect(wrapBareTexProse("mv - 2mv = 23m\\,v_{cm}")).toBe("$mv - 2mv = 23m\\,v_{cm}$");
  });

  it("wraps only the math runs inside a sentence", () => {
    expect(wrapBareTexProse("Since the discriminant is b^2 - 4ac \\ge 0 the roots are real")).toBe(
      "Since the discriminant is $b^2 - 4ac \\ge 0$ the roots are real"
    );
  });

  it("keeps \\text{ … } words inside the math run", () => {
    const out = wrapBareTexProse("Hence x \\in [0,1] \\text{ for all } y and the claim holds for every case");
    expect(out).toContain("$x \\in [0,1] \\text{ for all } y$");
  });

  it("leaves text that already has dollars or no TeX alone", () => {
    expect(wrapBareTexProse("Use $x^2$ here")).toBe("Use $x^2$ here");
    expect(wrapBareTexProse("Fill in the blank ______ now")).toBe("Fill in the blank ______ now");
  });

  it("wraps a bare command that sits beside math which already has dollars", () => {
    expect(wrapBareTexProse("Needed to compute \\frac{dv}{dx} when $v$ is given")).toBe(
      "Needed to compute $\\frac{dv}{dx}$ when $v$ is given"
    );
  });

  it("braces a multi-letter subscript so KaTeX does not drop the rest", () => {
    expect(wrapBareTexProse("The speed is $v_cm$ after impact")).toBe("The speed is $v_{cm}$ after impact");
    expect(wrapDisplayTex("mv - 2mv = 23m\\,v_cm")).toBe("$$mv - 2mv = 23m\\,v_{cm}$$");
    expect(wrapDisplayTex("A_xB_x + F_xv_x")).toBe("$$A_xB_x + F_xv_x$$");
    const summed = wrapDisplayTex("$\\sum F_x = ma_x \\quad \\sum F_y = ma_y$");
    expect(summed.replace(/^\$\$|\$\$$/g, "")).not.toContain("$");
  });

  it("drops a trailing \\\\ so the closing dollar is not escaped", () => {
    expect(wrapBareTexProse("f(2)=\\frac{e^2}{2},\\\\")).toBe("$f(2)=\\frac{e^2}{2},$");
  });
});

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

  it("maps enriched `## Step N:` markdown onto the worked sheet without the paper-ocr marker", () => {
    const parsed = parsePyqWorkedSolution(
      [
        "## Step 1: Find the vectors",
        "Given the position vectors:",
        "- $A: \\vec{a} - \\vec{b}$",
        "$$\\overrightarrow{AB} = B - A$$",
        "## Step 2: Apply the coplanarity condition",
        "They must be linearly dependent:",
        "$$x\\overrightarrow{AB} + y\\overrightarrow{AC} = \\vec{0}$$",
        "## Step 3: Compute the final value",
        "$$\\lambda = 2$$",
      ].join("\n")
    );
    expect(parsed?.title).toBe("Worked solution");
    expect(parsed?.phases.map((p) => p.title)).toEqual([
      "Find the vectors",
      "Apply the coplanarity condition",
      "Compute the final value",
    ]);
    expect(parsed?.phases.every((p) => p.blocks.length > 0)).toBe(true);
    expect(parsed?.phases[0]?.blocks.some((b) => b.kind === "display")).toBe(true);
    expect(parsed?.answer_tex).toContain("2");
  });

  it("parses enriched `## Given` / `## Step` heading mixes without a Step N prefix", () => {
    const parsed = parsePyqWorkedSolution(
      [
        "## Given Information",
        "We are given $|\\vec{a}| = 1$.",
        "## Analyze the orthogonality",
        "Dot with $\\vec{a}$ to eliminate $\\vec{w}$:",
        "$$\\vec{v} \\cdot \\vec{a} = 0$$",
        "## Step 3: Final Answer",
        "$$2$$",
      ].join("\n")
    );
    expect(parsed?.phases.map((p) => p.title)).toEqual([
      "Given Information",
      "Analyze the orthogonality",
      "Final Answer",
    ]);
  });

  it("strips bold markers and bullet dashes from enriched markdown", () => {
    const parsed = parsePyqWorkedSolution(
      [
        "## Step 1: Setup",
        "**Key identity:** $\\sin^2\\theta + \\cos^2\\theta = 1$",
        "- first point",
        "- second point",
        "## Step 2: Finish",
        "Done with **bold** text.",
      ].join("\n")
    );
    const prose = parsed?.phases
      .flatMap((p) => p.blocks)
      .filter((b) => b.kind === "paragraph")
      .map((b) => (b.kind === "paragraph" ? b.text : ""))
      .join(" ");
    expect(prose).not.toContain("**");
    expect(prose).toContain("first point");
    expect(prose).toContain("Done with bold text.");
  });

  it("parses a real enriched Vector Algebra solution (orthocenter/circumcenter shape)", () => {
    const parsed = parsePyqWorkedSolution(
      [
        "## Step 1: Identify the vertices and key centers",
        "Let the position vectors of the vertices $A$, $B$, $C$ be:",
        "$\\vec{a} = 4\\vec{p}+\\vec{q}-3\\vec{r}$, $\\vec{b} = -5\\vec{p}+\\vec{q}+2\\vec{r}$",
        "We are given the orthocenter $H$ and circumcenter $O$ as:",
        "$$\\vec{h} = \\frac{\\vec{p}+\\vec{q}+\\vec{r}}{4}$$",
        "## Step 2: Use the Euler line relation",
        "For any triangle, the centroid $G$ lies on the Euler line such that $\\vec{OG} = \\frac{1}{3}\\vec{GH}$:",
        "$$\\vec{h} = 3\\vec{g} - 2\\vec{o}$$",
        "## Step 3: Compute the centroid",
        "The centroid is the average of the vertex position vectors:",
        "$$\\vec{g} = \\frac{\\vec{a}+\\vec{b}+\\vec{c}}{3}$$",
      ].join("\n")
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.phases.map((p) => p.title)).toEqual([
      "Identify the vertices and key centers",
      "Use the Euler line relation",
      "Compute the centroid",
    ]);
    const kinds = parsed?.phases.flatMap((p) => p.blocks.map((b) => b.kind));
    expect(kinds).toContain("display");
    expect(kinds).toContain("paragraph");
    const prose = parsed?.phases
      .flatMap((p) => p.blocks)
      .filter((b) => b.kind === "paragraph")
      .map((b) => (b.kind === "paragraph" ? b.text : ""))
      .join(" ");
    expect(prose).not.toContain("##");
    expect(prose).toContain("Euler line");
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

  it("loads a physics solution figure from the physics folder", () => {
    const parsed = parsePyqWorkedSolution(
      "<!-- paper-ocr -->\n## Step 1: Given values\n[[fig:s2025j_cap_q02_1]]\n$i = 1$",
      "physics/figures"
    );
    const fig = parsed?.phases[0]?.blocks.find((block) => block.kind === "figure");
    expect(fig?.kind).toBe("figure");
    if (fig?.kind === "figure") {
      expect(fig.html).toContain("physics/figures/s2025j_cap_q02_1.png");
      expect(fig.html).not.toContain("math/figures");
    }
  });

  it("keeps an unscoped solution figure in the math folder", () => {
    const parsed = parsePyqWorkedSolution(
      "<!-- paper-ocr -->\n## Step 1: Figure\n[[fig:s2026j_q09_1]]\n$x = 1$"
    );
    const fig = parsed?.phases[0]?.blocks.find((block) => block.kind === "figure");
    expect(fig?.kind).toBe("figure");
    if (fig?.kind === "figure") expect(fig.html).toContain("math/figures/s2026j_q09_1.png");
  });

  it("drops a second Final Answer that only repeats the printed option", () => {
    const parsed = parsePyqWorkedSolution(
      [
        "<!-- paper-ocr -->",
        "## Step 3: Equivalent Capacitance Evaluation",
        "$= 4 + 5 = 9\\mu\\text{ F}$",
        "## Step 4: Final Answer",
        "Correct Option (3)",
        "## Final Answer",
        "Option 3",
      ].join("\n")
    );
    expect(parsed?.phases.map((phase) => phase.title)).toEqual([
      "Equivalent Capacitance Evaluation",
      "Final Answer",
    ]);
    expect(parsed?.answer_note).toContain("Correct Option (3)");
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

  it("splits a bare English problem_tex into prose and inline math instead of one smashed display", () => {
    const q = problemTexForQuestion(
      "The locus of the mid points of the chords of the circle C : (x - 4)^{2} + (y - 5)^{2} = 4 which subtend an angle \\theta at the centre of the circle C, is a circle of radius r. If \\theta = \\theta_{1}, \\theta = \\theta_{2} and r_{1}^{2} = r_{2}^{2} + r_{3}^{2}, then \\theta_{2} is equal to"
    );
    expect(q.display).toBe(false);
    expect(q.text.startsWith("The locus of the mid points of the chords of the circle $C : (x - 4)^{2}")).toBe(
      true
    );
    expect(q.text).toContain("= 4$ which subtend an angle $\\theta$ at the centre of the circle $C$, is a circle of radius $r$. If $\\theta");
    expect(q.text).toContain("$\\theta_{2}$ is equal to");
  });

  it("keeps two-letter variables like by inside the equation", () => {
    const q = problemTexForQuestion(
      "The points of intersection of the line ax + by = 0, (a \\neq b) and the circle x^{2} + y^{2} - 2x = 0 are A(\\alpha, 0) and B(1, \\beta). The image of the circle with AB as a diameter in the line x + y + 2 = 0 is :"
    );
    expect(q.display).toBe(false);
    expect(q.text).toContain("the line $ax + by = 0, (a \\neq b)$ and the circle $x^{2} + y^{2} - 2x = 0$ are");
    expect(q.text).toContain("with $AB$ as a diameter in the line $x + y + 2 = 0$ is :");
  });

  it("keeps \\text nested in a formula inside that formula", () => {
    const frac =
      "\\frac{1^{3}+2^{3}+\\cdots+\\text{upto } n \\text{ terms}}{1\\cdot 3+2\\cdot 5+\\cdots+\\text{upto } n \\text{ terms}}=\\frac{9}{5}";
    expect(problemTexForQuestion(frac)).toEqual({ display: true, text: frac });
    const set =
      "A = \\left\\{ \\theta \\in [0, 2\\pi] : 1 + 10\\, \\text{Re}\\left( \\frac{2\\cos\\theta}{\\cos\\theta} \\right) = 0 \\right\\}, \\quad \\sum_{\\theta \\in A} \\theta^{2} = ?";
    expect(problemTexForQuestion(set).display).toBe(true);
    const cases = "f(x)=\\begin{cases} x-[x], & x \\text{ odd} \\\\ 1+[x]-x, & x \\text{ even} \\end{cases}";
    expect(problemTexForQuestion(cases).display).toBe(true);
    expect(unwrapProblemTex("50^{\\text{th}} \\text{ root of } x \\text{ is } 12.")).toBe(
      "$50^{\\text{th}}$ root of $x$ is $12$."
    );
    const dollars = "The $4^{\\text{th}}$ term of a GP is 500";
    expect(problemTexForQuestion(dollars)).toEqual({ display: false, text: dollars });
  });
});

describe("worked sheet paragraphs and duplicates", () => {
  const sheet = (blocks: unknown[]) =>
    JSON.stringify({
      answer: "1",
      title: "T",
      problem_tex: "x = 1",
      answer_tex: "x = 1",
      phases: [
        { title: "One", blocks: [{ kind: "paragraph", text: "Start." }] },
        { title: "Two", blocks },
      ],
    });

  it("renders bare x^2 in prose as math", () => {
    const parsed = parsePyqWorkedSolution(
      sheet([{ kind: "paragraph", text: "The circle x^2 + y^2 - 2x = 0 passes through (x + 5/2)^2 and α^2." }])
    );
    const text = parsed?.phases[1]?.blocks.find((b) => b.kind === "paragraph");
    expect(text && "text" in text ? text.text : "").toBe(
      "The circle $x^{2}$ + $y^{2}$ - 2x = 0 passes through $(x + 5/2)^{2}$ and $α^{2}$."
    );
  });

  it("leaves $-delimited math alone", () => {
    const parsed = parsePyqWorkedSolution(sheet([{ kind: "paragraph", text: "So $x^2 = 4$ here." }]));
    const text = parsed?.phases[1]?.blocks.find((b) => b.kind === "paragraph");
    expect(text && "text" in text ? text.text : "").toBe("So $x^2 = 4$ here.");
  });

  it("drops a display that repeats the callout right above it", () => {
    const parsed = parsePyqWorkedSolution(
      sheet([
        { kind: "paragraph", text: "Done." },
        { kind: "callout", text: "Final result:", tex: "\\theta_{2} = \\frac{\\pi}{2}" },
        { kind: "display", tex: "\\theta_{2}=\\frac{\\pi}{2}" },
      ])
    );
    const kinds = parsed?.phases[1]?.blocks.map((b) => b.kind);
    expect(kinds).toEqual(["paragraph", "callout"]);
  });

  it("wraps bare carets the same way for blocks and for paragraphs plus callout", () => {
    const textOf = (parsed: ReturnType<typeof parsePyqWorkedSolution>) =>
      parsed?.phases[1]?.blocks
        .filter((block) => block.kind === "paragraph" || block.kind === "callout")
        .map((block) => ("text" in block ? block.text : ""));

    const fromBlocks = parsePyqWorkedSolution(
      sheet([
        { kind: "paragraph", text: "Simple prose." },
        { kind: "callout", text: "Radius x^2 grows:", tex: "r^2 = 0" },
      ])
    );
    const fromFields = parsePyqWorkedSolution(
      JSON.stringify({
        answer: "1",
        title: "T",
        problem_tex: "x = 1",
        answer_tex: "x = 1",
        phases: [
          { title: "One", blocks: [{ kind: "paragraph", text: "Start." }] },
          {
            title: "Two",
            paragraphs: ["Simple prose."],
            callout: { text: "Radius x^2 grows:", tex: "r^2 = 0" },
          },
        ],
      })
    );

    expect(textOf(fromBlocks)).toEqual(["Simple prose.", "Radius $x^{2}$ grows:"]);
    expect(textOf(fromFields)).toEqual(textOf(fromBlocks));
  });
});
