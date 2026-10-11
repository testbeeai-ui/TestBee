import { describe, expect, it } from "vitest";
import { appendOptionFinalStep } from "./pyqWorkedSolution";
import { mapPyqRowToChapterPyqQuestion } from "./pyqQuestionMap";
import type { PyqQuestionRow } from "./pyqQuestionRow";

const PAPER = `<!-- paper-ocr -->

## Step 1: Working
For option (A)
$\\phi = kt + C$
$$eg \\to x = A \\sin \\phi (SHM)$$
For option (B)
$v^2 + x^2 = constant$
`;

function row(overrides: Partial<PyqQuestionRow> = {}): PyqQuestionRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    q_no: 1,
    tier: "must_do",
    format: "mcq",
    body: "A body moves so that $v^2 + x^2 = constant$. Which are possible?",
    correct_option: 1,
    numerical_answer: null,
    exam_date: "2025-01-22",
    exam_shift: null,
    source_page: 1,
    review_status: "auto_ok",
    out_of_syllabus: false,
    good_to_solve: true,
    chapters: { chapter_no: 3, name: "Motion In One Dimension", catalog_slug: "motion-in-a-straight-line" },
    topics: null,
    question_options: [
      { option_index: 1, body: "A, B and D only" },
      { option_index: 2, body: "B only" },
      { option_index: 3, body: "C only" },
      { option_index: 4, body: "A and C" },
    ],
    figure_links: [],
    solution_md: PAPER,
    tips_md: null,
    formulas_md: null,
    ...overrides,
  } as PyqQuestionRow;
}

describe("appendOptionFinalStep", () => {
  it("appends a closing step naming the option", () => {
    const out = appendOptionFinalStep(PAPER, 1);
    expect(out.trimEnd().endsWith("## Final Answer\nOption 1")).toBe(true);
  });

  it("is idempotent", () => {
    const once = appendOptionFinalStep(PAPER, 1);
    expect(appendOptionFinalStep(once, 1)).toBe(once);
  });

  it("does not add a second Final Answer when the paper already names the option", () => {
    const printed = `${PAPER}\n## Step 4: Final Answer\nCorrect Option (3)\n`;
    expect(appendOptionFinalStep(printed, 3)).toBe(printed);
  });

  it("leaves the text alone without a usable option", () => {
    expect(appendOptionFinalStep(PAPER, null)).toBe(PAPER);
    expect(appendOptionFinalStep(PAPER, 0)).toBe(PAPER);
    expect(appendOptionFinalStep(PAPER, 9)).toBe(PAPER);
    expect(appendOptionFinalStep("", 1)).toBe("");
  });
});

describe("physics MCQ final answer", () => {
  it("names the option for a physics MCQ", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(row(), "motion-in-a-straight-line");
    expect(mapped).not.toBeNull();
    const sol = mapped!.question.solution ?? "";
    expect(sol).toContain("## Final Answer");
    expect(sol.trimEnd().endsWith("Option 1")).toBe(true);
  });

  it("leaves a physics numerical row on the printed result", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(
      row({ format: "numerical", correct_option: null, numerical_answer: "42" }),
      "motion-in-a-straight-line"
    );
    expect(mapped).not.toBeNull();
    expect(mapped!.question.solution ?? "").not.toContain("## Final Answer");
  });

  it("leaves Mathematics untouched", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(
      row({
        chapters: {
          chapter_no: 25,
          name: "Trigonometric Ratios & Identities",
          catalog_slug: "trigonometric-ratios-and-identities",
        },
      }),
      "trigonometric-ratios-and-identities"
    );
    expect(mapped).not.toBeNull();
    expect(mapped!.question.solution ?? "").not.toContain("## Final Answer");
  });

  it("never rewrites a phase-JSON payload, even on a physics MCQ", () => {
    // Appending a markdown step to JSON makes it unparseable, which silently
    // downgraded the worked sheet. The payload must stay byte-identical.
    const payload = JSON.stringify({
      answer: "1",
      title: "T",
      problem_tex: "p",
      answer_tex: "x = 1",
      answer_note: "Option 1 is the correct choice",
      phases: [{ title: "Step", paragraphs: ["work"] }],
    });
    const mapped = mapPyqRowToChapterPyqQuestion(
      row({ solution_md: payload }),
      "motion-in-a-straight-line"
    );
    expect(mapped).not.toBeNull();
    expect(mapped!.question.solution).toBe(payload);
    // The appended step must not leak into the JSON path either.
    expect(mapped!.question.solutionHtml ?? "").not.toContain("## Final Answer");
    expect(mapped!.question.solutionHtml ?? "").not.toContain("nta-paper-step-label");
  });
});