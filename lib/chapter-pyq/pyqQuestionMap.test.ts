import { describe, expect, it } from "vitest";
import {
  formatPyqExamLabel,
  formatPyqExamShift,
  mapPyqRowToChapterPyqQuestion,
  mapPyqRowsToChapterPyqQuestions,
  pyqExamYear,
  pyqQuestionSources,
  splitPyqExamLabel,
  pyqPaperHoverTitle,
} from "./pyqQuestionMap";
import { LAWS_OF_MOTION_SAMPLE_ROWS } from "./fixtures/lawsOfMotionSample";

const byId = (id: string) => LAWS_OF_MOTION_SAMPLE_ROWS.find((r) => r.id.endsWith(id))!;

describe("pyq question mapper", () => {
  it("maps an MCQ to four options and a zero-based correct index", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(byId("000000000001"), "Laws of Motion")!;
    expect(mapped.question.options).toHaveLength(4);
    expect(mapped.question.correctAnswer).toBe(1);
    expect(mapped.question.answerFormat).toBe("mcq");
    expect(mapped.question.numericAnswer).toBeNull();
    expect(mapped.question.subject).toBe("physics");
    expect(mapped.question.examType).toEqual(["JEE_Mains"]);
  });

  it("never fabricates options for a numerical question", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(byId("000000000003"), "Laws of Motion")!;
    expect(mapped.question.answerFormat).toBe("numerical");
    expect(mapped.question.options).toEqual([]);
    expect(mapped.question.correctAnswer).toBe(-1);
    expect(mapped.question.numericAnswer).toBe("12");
  });

  it("keeps a negative numerical answer verbatim", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(byId("000000000004"), "Laws of Motion")!;
    expect(mapped.question.numericAnswer).toBe("-0.25");
    expect(mapped.question.options).toEqual([]);
  });

  it("carries the coarse PDF chapter label and the fine topic label", () => {
    const merged = mapPyqRowToChapterPyqQuestion(byId("000000000011"), "Units and Measurements")!;
    expect(merged.pdfChapterName).toBe("Experimental Physics");
    expect(merged.topicName).toBe("Vernier Callipers");
    expect(merged.question.topic).toBe("Vernier Callipers");
  });

  it("falls back to the PDF chapter name when a row has no topic", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(byId("000000000005"), "Laws of Motion")!;
    expect(mapped.topicName).toBeNull();
    expect(mapped.question.topic).toBe("Laws of Motion");
  });

  it("renders a figure placeholder as an img and leaves no placeholder behind", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(byId("000000000002"), "Laws of Motion")!;
    expect(mapped.question.questionHtml).toContain("<img");
    expect(mapped.question.questionHtml).toContain("p047_x101.png");
    expect(mapped.question.questionHtml).not.toContain("[[fig:");
  });

  it("still renders the paper raster when figure_links did not come back", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(
      { ...byId("000000000002"), figure_links: [] },
      "Laws of Motion"
    )!;
    expect(mapped.question.questionHtml).toContain("<img");
    expect(mapped.question.questionHtml).toContain("p047_x101.png");
    expect(mapped.question.questionHtml).not.toContain("[[fig:");
  });

  it("drops rows with no body and rows with no chapter", () => {
    expect(mapPyqRowToChapterPyqQuestion(byId("000000000008"), "Laws of Motion")).toBeNull();
    const orphan = { ...byId("000000000001"), chapters: null };
    expect(mapPyqRowToChapterPyqQuestion(orphan, "Laws of Motion")).toBeNull();
  });

  it("carries tier, q_no and source page for the badge and provenance", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(byId("000000000006"), "Laws of Motion")!;
    expect(mapped.tier).toBe("advanced");
    expect(mapped.qNo).toBe(6);
    expect(mapped.sourcePage).toBe(58);
  });

  it("formats the provenance label the way the book tags it", () => {
    expect(formatPyqExamLabel("2024-01-30", "evening")).toBe("JAN 2024 (Evening)");
    expect(formatPyqExamLabel("2023-04-06", "morning")).toBe("APR 2023 (Morning)");
    expect(formatPyqExamLabel("2023-04-06", null)).toBe("APR 2023");
    expect(formatPyqExamLabel(null, "morning")).toBeNull();
    expect(pyqExamYear("2026-01-21")).toBe(2026);
    expect(pyqExamYear(null)).toBeNull();
    expect(formatPyqExamShift("evening")).toBe("Evening");
    expect(formatPyqExamShift("morning")).toBe("Morning");
    expect(formatPyqExamShift(null)).toBeNull();
    expect(splitPyqExamLabel("30 Jan 2024 (Evening)")).toEqual({
      date: "30 Jan 2024",
      shift: "Evening",
    });
    expect(splitPyqExamLabel("6 Apr 2023")).toEqual({ date: "6 Apr 2023", shift: null });
    expect(splitPyqExamLabel("30 Jan 2024 (E)")).toEqual({
      date: "30 Jan 2024",
      shift: "Evening",
    });
    expect(splitPyqExamLabel("6 Apr 2023 (M)")).toEqual({
      date: "6 Apr 2023",
      shift: "Morning",
    });
    expect(pyqPaperHoverTitle("30 Jan 2024", "Evening")).toBe("30 Jan 2024 · Evening shift");
    expect(pyqPaperHoverTitle("6 Apr 2023", "Morning")).toBe("6 Apr 2023 · Morning shift");
    expect(pyqPaperHoverTitle("6 Apr 2023", null)).toBe("6 Apr 2023");
  });

  it("indexes paper labels by question id and skips undated rows", () => {
    const dated = mapPyqRowToChapterPyqQuestion(byId("000000000001"), "Laws of Motion")!;
    const undated = mapPyqRowToChapterPyqQuestion(byId("000000000004"), "Laws of Motion")!;
    expect(dated.examLabel).toBe("JAN 2024 (Evening)");
    expect(dated.examYear).toBe(2024);
    expect(dated.examMonth).toBe(1);
    expect(dated.examDay).toBe(30);
    expect(undated.examLabel).toBeNull();
    expect(undated.examYear).toBeNull();
    expect(undated.examMonth).toBeNull();
    expect(undated.examDay).toBeNull();
    expect(pyqQuestionSources([dated, undated])).toEqual({
      [dated.question.id]: { date: "JAN 2024", shift: null },
    });
  });

  it("builds a bundle that drops unmappable rows and keeps order", () => {
    const bundle = mapPyqRowsToChapterPyqQuestions(
      LAWS_OF_MOTION_SAMPLE_ROWS,
      "Laws of Motion"
    );
    expect(bundle.chapterName).toBe("Laws of Motion");
    expect(bundle.questions).toHaveLength(11);
    expect(bundle.questions.map((q) => q.question.id)).toEqual(
      LAWS_OF_MOTION_SAMPLE_ROWS.filter((r) => r.body !== null).map((r) => r.id)
    );
  });

  it("leaves Tips and Formula's empty until those columns are filled", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(byId("000000000001"), "Laws of Motion")!;
    expect(mapped.question.coachTips).toBeNull();
    expect(mapped.question.coachFormulas).toBeNull();
  });

  it("maps stored tips and formulas markdown into the NTA popups", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(
      {
        ...byId("000000000001"),
        tips_md: "Limits are symmetric. Split even and odd parts.",
        formulas_md: "$\\int_{-a}^{a} f=0$ when $f$ is odd.",
      },
      "Laws of Motion"
    )!;
    expect(mapped.question.coachTips).toContain("even and odd");
    expect(mapped.question.coachFormulas).toContain("\\int_{-a}^{a}");
  });

  it("leaves the Solution popup empty when solution_md is missing", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(byId("000000000001"), "Laws of Motion")!;
    expect(mapped.question.solutionHtml).toBeNull();
    expect(mapped.question.solution).toBe("");
  });

  it("maps stored solution markdown into the NTA popup", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(
      {
        ...byId("000000000001"),
        solution_md: "1. $a = F/m$.\n2. So $a = 5$.",
      },
      "Laws of Motion"
    )!;
    expect(mapped.question.solutionHtml).toContain("$a = F/m$");
    expect(mapped.question.solutionHtml).toContain("$a = 5$");
    expect(mapped.question.solution).toContain("1. $a = F/m$");
  });

  it("keeps phase JSON on solution and does not wrap it as HTML", () => {
    const payload = JSON.stringify({
      answer: "4",
      title: "Definite Integral via Symmetry",
      problem_tex: "I",
      answer_tex: "I = 4\\pi",
      answer_note: "Option 4 is the correct choice",
      phases: [
        { title: "Symmetry Decomposition", paragraphs: ["Even."] },
        { title: "Trigonometric Substitution", paragraphs: ["Let $J$."] },
      ],
    });
    const mapped = mapPyqRowToChapterPyqQuestion(
      { ...byId("000000000001"), solution_md: payload },
      "Laws of Motion"
    )!;
    expect(mapped.question.solutionHtml).toBeNull();
    expect(mapped.question.solution).toBe(payload);
    expect(mapped.question.solution).toContain("Definite Integral via Symmetry");
  });

  it("maps paper OCR to stacked HTML without a page-crop image", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(
      {
        ...byId("000000000001"),
        solution_md: "<!-- paper-ocr -->\n\nApplying king\n$I = 9$.",
      },
      "Laws of Motion"
    )!;
    expect(mapped.question.solutionHtml).toContain("Applying king");
    expect(mapped.question.solutionHtml).toContain("$I = 9$");
    expect(mapped.question.solutionHtml).not.toContain("<img");
    expect(mapped.question.solutionHtml).not.toContain("[[fig:");
  });

  it("still resolves a real printed diagram in paper solution HTML", () => {
    const mapped = mapPyqRowToChapterPyqQuestion(
      {
        ...byId("000000000001"),
        solution_md: "<!-- paper-ocr -->\n\n[[fig:s2026j_q09_1]]\n$I = 4\\pi$",
      },
      "Laws of Motion"
    )!;
    expect(mapped.question.solutionHtml).toContain("s2026j_q09_1.png");
    expect(mapped.question.solutionHtml).toContain('class="nta-mock-img"');
    expect(mapped.question.questionHtml).not.toContain("s2026j_q09_1");
  });
});
