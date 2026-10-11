import { describe, expect, it } from "vitest";
import {
  PYQ_COUNT_SELECT,
  PYQ_PUBLISHABLE_STATUSES,
  PYQ_QUESTION_SELECT,
  filterPublishableRows,
  isPyqPaperFilled,
  sortPyqRows,
  tallyPublishableCounts,
} from "./pyqQuestionRow";
import { LAWS_OF_MOTION_SAMPLE_ROWS } from "./fixtures/lawsOfMotionSample";

describe("isPyqPaperFilled tails", () => {
  const numerical = (body: string) => ({ body, format: "numerical" as const, numerical_answer: "5" });

  it.each([
    "The sum of all the roots of the equation $(x-1)^{2}-5|x-1|+6=0$, is :",
    "Find the value of $\\int_{0}^{2\\pi}\\dfrac{x\\sin^{8}x}{\\sin^{8}x+\\cos^{8}x}\\,dx$",
    "Let $I_n(x) = \\int_{0}^{x} \\frac{1}{(t^2+5)^n} dt, \\ n=1, 2, 3, ...$ Then",
    "The function $f(x) = 2x + 3(x)^{\\frac{2}{3}}, x \\in \\mathbb{R}$, has",
    "The remainder when $19^{200} + 23^{200}$ is divided by $49$, is ______.",
    "${}^{n-1}C_{r} = (k^{2}-8)^{n}C_{r+1}$ if and only if :",
    "Then the centroid of $\\triangle PAB$ lies on the line :",
    "Let $A = \\begin{pmatrix} p & q \\\\ p & q \\end{pmatrix}$, $d = |A|$. Then",
    "Let $f(x)=x$, where $[t]$ denotes greatest integer function. Then,",
    "Let $y=f(x)$. Then, at $x = 1$,",
    "Let $y=y(x)$ solve $y'=x$. Then, $y(1)$ equals :",
    "If $y' = x$, $y(0) = 0$, then $y(1)$ is :-",
    "The number of points, where $y = x^{5}$ crosses the $x$-axis, is —————.",
    "The sum of $\\theta$, for which $z$ is purely imaginary, is equal",
    "The $8^{\\text{th}}$ common term of $S_{1}=3+7$, $S_{2}=1+6$ is $\\underline{\\quad}$.",
  ])("keeps a real stem: %s", (body) => {
    expect(isPyqPaperFilled(numerical(body))).toBe(true);
  });

  it("still hides a cut-off tail", () => {
    expect(isPyqPaperFilled(numerical("Let $x$ be real and y, ₁/2"))).toBe(false);
    expect(isPyqPaperFilled(numerical("Let the set be given as $A$ and then the"))).toBe(true);
  });
});

describe("pyq question rows", () => {
  it("publishes only auto_ok and human_ok", () => {
    expect([...PYQ_PUBLISHABLE_STATUSES]).toEqual(["auto_ok", "human_ok"]);
    const kept = filterPublishableRows(LAWS_OF_MOTION_SAMPLE_ROWS);
    expect(kept).toHaveLength(9);
    for (const row of kept) {
      expect(["auto_ok", "human_ok"]).toContain(row.review_status);
    }
  });

  it("drops unreviewed, skeleton_only and flagged rows", () => {
    const keptIds = new Set(filterPublishableRows(LAWS_OF_MOTION_SAMPLE_ROWS).map((r) => r.id));
    const hidden = LAWS_OF_MOTION_SAMPLE_ROWS.filter((r) => !keptIds.has(r.id)).map(
      (r) => r.review_status
    );
    expect(hidden.sort()).toEqual(["flagged", "skeleton_only", "unreviewed"]);
  });

  it("sorts by PDF chapter number then question number", () => {
    const merged = filterPublishableRows(LAWS_OF_MOTION_SAMPLE_ROWS).filter(
      (row) => row.chapters?.catalog_slug === "units-and-measurements"
    );
    const sorted = sortPyqRows([...merged].reverse());
    expect(sorted.map((row) => [row.chapters?.chapter_no, row.q_no])).toEqual([
      [2, 1],
      [2, 2],
      [32, 1],
    ]);
  });

  it("tallies publishable counts per catalog slug", () => {
    expect(tallyPublishableCounts(LAWS_OF_MOTION_SAMPLE_ROWS)).toEqual({
      "laws-of-motion": 6,
      "units-and-measurements": 3,
    });
  });

  it("ignores rows with no catalog slug when tallying", () => {
    expect(
      tallyPublishableCounts([
        { review_status: "auto_ok", chapters: { catalog_slug: null } },
        { review_status: "auto_ok", chapters: null },
        { review_status: "auto_ok", chapters: { catalog_slug: "gravitation" } },
      ])
    ).toEqual({ gravitation: 1 });
  });

  it("hides truncated OCR fragments so the chapter stays 0 / 0", () => {
    expect(
      isPyqPaperFilled({
        body: "Let $S = {x$ ∈[-6, 3] - {-2, 2} :",
        format: "mcq",
        numerical_answer: null,
        question_options: [
          { option_index: 1, body: "7" },
          { option_index: 2, body: "5" },
          { option_index: 3, body: "4" },
          { option_index: 4, body: "3" },
        ],
      })
    ).toBe(false);
    expect(
      isPyqPaperFilled({
        body: "The number of distinct solutions of the equation, ₁/2",
        format: "numerical",
        numerical_answer: "4",
        question_options: [],
      })
    ).toBe(false);
    expect(
      isPyqPaperFilled({
        body: "A force of $10\\,\\text{N}$ acts on a body of mass $2\\,\\text{kg}$. Its acceleration is",
        format: "mcq",
        numerical_answer: null,
        question_options: [
          { option_index: 1, body: "$2.5$" },
          { option_index: 2, body: "$5$" },
          { option_index: 3, body: "$10$" },
          { option_index: 4, body: "$20$" },
        ],
      })
    ).toBe(true);
  });

  const four = [
    { option_index: 1, body: "1" },
    { option_index: 2, body: "2" },
    { option_index: 3, body: "3" },
    { option_index: 4, body: "4" },
  ];

  it("keeps a complete short stem that ends with 'equal to :' or ', is'", () => {
    expect(
      isPyqPaperFilled({
        body: "If α and β are the roots of the equation 2x(2x + 1) = 1, then β is equal to :",
        format: "mcq",
        question_options: four,
      })
    ).toBe(true);
    expect(
      isPyqPaperFilled({
        body: "The number of real roots of the equation $x[x] - 5[x + 2] + 6 = 0$, is",
        format: "mcq",
        question_options: four,
      })
    ).toBe(true);
    expect(
      isPyqPaperFilled({
        body: "Let $[t]$ denote the greatest integer $\\le t$. Then the equation in $x$, $[x]^2 + 2[x+2] - 7 = 0$ has :",
        format: "mcq",
        question_options: four,
      })
    ).toBe(true);
    expect(
      isPyqPaperFilled({
        body: "If $I=\\int_{0}^{\\frac{\\pi}{2}}\\dfrac{\\sin x}{\\sin x+\\cos x}\\,dx$, then $\\int_{0}^{\\frac{\\pi}{2}}\\dfrac{x\\sin x\\cos x}{\\sin^{4}x+\\cos^{4}x}\\,dx$ equals :",
        format: "mcq",
        question_options: four,
      })
    ).toBe(true);
  });

  it("does not tally a published truncated stem onto the chapter card", () => {
    expect(
      tallyPublishableCounts([
        {
          review_status: "human_ok",
          body: "Let $S = {x$ ∈R : (√",
          format: "mcq",
          question_options: four,
          chapters: { catalog_slug: "quadratic-equation" },
        },
        {
          review_status: "human_ok",
          body: "If α and β are the roots of the equation 2x(2x + 1) = 1, then β is equal to :",
          format: "mcq",
          question_options: four,
          chapters: { catalog_slug: "quadratic-equation" },
        },
      ])
    ).toEqual({ "quadratic-equation": 1 });
  });

  it("still hides a truncated set-builder stem", () => {
    expect(
      isPyqPaperFilled({
        body: "Let $S = {x$ ∈R : (√",
        format: "mcq",
        question_options: four,
      })
    ).toBe(false);
  });

  it("hides unmatched $ and unclosed \\frac options", () => {
    expect(
      isPyqPaperFilled({
        body: "The region is given by the inequality",
        format: "mcq",
        question_options: [
          { option_index: 1, body: "$y^2 \\ge 2(x + \\frac{1}{2})$" },
          { option_index: 2, body: "$y^2 \\le 2(x + \\frac{1}{2})$" },
          { option_index: 3, body: "$y^2 \\le (x + 1)$" },
          { option_index: 4, body: "$y^2 \\le x + 1" },
        ],
      })
    ).toBe(false);
    expect(
      isPyqPaperFilled({
        body: "Then $y^2 - y$ is equal to",
        format: "mcq",
        question_options: [
          { option_index: 1, body: "1" },
          { option_index: 2, body: "\\frac{1}{2}" },
          { option_index: 3, body: "\\frac{3}{2}" },
          { option_index: 4, body: "\\frac{5}{4" },
        ],
      })
    ).toBe(false);
  });

  it("keeps complete stems that end with 'below:', 'equation :', or ', then:'", () => {
    expect(
      isPyqPaperFilled({
        body: "Choose the correct answer from the options given below:",
        format: "mcq",
        question_options: four,
      })
    ).toBe(true);
    expect(
      isPyqPaperFilled({
        body: "If $\\left(\\sqrt{3}+i\\right)^{100}=2^{99}(p+iq)$, then $p$ and $q$ are roots of the equation :",
        format: "mcq",
        question_options: four,
      })
    ).toBe(true);
    expect(
      isPyqPaperFilled({
        body: "Let $z \\in C$ be such that $|z| < 1$. If $\\omega = \\frac{5+3z}{5(1-z)}$, then:",
        format: "mcq",
        question_options: four,
      })
    ).toBe(true);
    expect(
      isPyqPaperFilled({
        body: "Then the roots of the equation $x^2 - (a + b - 2)x + (a + b + 2) = 0$ are :",
        format: "mcq",
        question_options: four,
      })
    ).toBe(true);
    expect(
      isPyqPaperFilled({
        body: "If $S = z \\in \\mathbb{C} : |z - i| = |z + i| = |z - 1|$, then, $n(S)$ is:",
        format: "mcq",
        question_options: four,
      })
    ).toBe(true);
    expect(
      isPyqPaperFilled({
        body: "The sum $1 + 3 + 11 + 25 + 45 + 71 + \\dots$ upto 20 terms, is equal to",
        format: "mcq",
        question_options: four,
      })
    ).toBe(true);
    expect(
      isPyqPaperFilled({
        body: "The sum, $\\sum_{n=1}^{7} \\frac{n(n+1)(2n+1)}{4}$, is equal to",
        format: "numerical",
        numerical_answer: "504",
        question_options: [],
      })
    ).toBe(true);
  });

  it("keeps a complete Complex Number modulus stem that ends with represents:", () => {
    expect(
      isPyqPaperFilled({
        body: "The equation $|z - i| = |z - 1|$, $i = \\sqrt{-1}$, represents:",
        format: "mcq",
        question_options: four,
      })
    ).toBe(true);
    expect(
      isPyqPaperFilled({
        body: "Let $|z_1 - 8 - 2i| \\le 1$ and $|z_2 - 2 + 6i| \\le 2$, $z_1, z_2 \\in \\mathbb{C}$. Then the minimum value of $|z_1 - z_2|$ is:",
        format: "mcq",
        question_options: four,
      })
    ).toBe(true);
  });

  it("keeps a well-formed Complex Number stem after clean", () => {
    expect(
      isPyqPaperFilled({
        body:
          "Let $(-2 - i)^n = \\frac{3^n}{2^n} i^n$ (i = $\\sqrt{-1}$), where $n$ and $y$ are real numbers then $y - x$ equals",
        format: "mcq",
        question_options: four,
      })
    ).toBe(true);
  });

  it("does not publish a solver-dump stem", () => {
    expect(
      isPyqPaperFilled({
        body:
          "We are given the quadratic equation $x^{2} - x + 2 = 0$ with roots $\\alpha$ and $\\beta$.\n\n" +
          "Computing $\\alpha^6$: the value is 13.\n\nThe answer is 13.",
        format: "numerical",
        numerical_answer: "13",
        question_options: [],
      })
    ).toBe(false);
    expect(
      isPyqPaperFilled({
        body: "We need to evaluate $\\left(\\frac{1+i}{1-i}\\right)^3$... wait, let me parse the expression carefully.",
        format: "mcq",
        question_options: four,
      })
    ).toBe(false);
  });

  it("selects the columns and embeds the mapper needs, from the pyq_ tables", () => {
    for (const fragment of [
      "numerical_answer",
      "correct_option",
      "review_status",
      "chapters:pyq_chapters!inner(chapter_no, name, catalog_slug)",
      "topics:pyq_topics(name)",
      "question_options:pyq_question_options(option_index, body)",
      "figure_links:pyq_figure_links(role, sort_order, figures:pyq_figures(figure_key, storage_path, public_url, alt_text))",
      "solution_md",
      "tips_md",
      "formulas_md",
    ]) {
      expect(PYQ_QUESTION_SELECT).toContain(fragment);
    }
  });

  it("aliases every embed so the JSON keys stay unprefixed", () => {
    // The row types and every reader below use `row.chapters`, not
    // `row.pyq_chapters`. Drop an alias and all of them break silently.
    for (const key of ["chapters:", "topics:", "question_options:", "figure_links:", "figures:"]) {
      expect(PYQ_QUESTION_SELECT).toContain(key);
    }
  });

  it("counts without shipping figures, topics, or exam metadata", () => {
    expect(PYQ_COUNT_SELECT).toContain("chapters:pyq_chapters!inner(catalog_slug)");
    expect(PYQ_COUNT_SELECT).toContain("question_options:pyq_question_options(option_index, body)");
    expect(PYQ_COUNT_SELECT).not.toContain("figure_links");
    expect(PYQ_COUNT_SELECT).not.toContain("topics:");
    expect(PYQ_COUNT_SELECT).not.toContain("exam_date");
    expect(PYQ_COUNT_SELECT).not.toContain("correct_option");
    expect(PYQ_COUNT_SELECT).not.toContain("solution_md");
  });
});
