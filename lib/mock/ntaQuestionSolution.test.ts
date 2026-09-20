import { describe, expect, it } from "vitest";
import { ntaQuestionCoachText, ntaQuestionSolutionText } from "./ntaQuestionSolution";

describe("ntaQuestionSolutionText", () => {
  it("is empty when MathonGo-style questions ship no worked solution", () => {
    expect(ntaQuestionSolutionText({ solutionHtml: null, solution: "" })).toBe("");
  });

  it("prefers a stored worked-solution payload over HTML", () => {
    const payload = JSON.stringify({
      answer: "2",
      title: "King",
      problem_tex: "I",
      answer_tex: "2",
      answer_note: "Option 2",
      phases: [
        { title: "Setup", paragraphs: ["Start."] },
        { title: "Finish", paragraphs: ["Done."] },
      ],
    });
    expect(
      ntaQuestionSolutionText({
        solutionHtml: "<p>By substitution</p>",
        solution: payload,
      })
    ).toBe(payload);
  });

  it("uses HTML when there is no solution text", () => {
    expect(
      ntaQuestionSolutionText({
        solutionHtml: "<p>By substitution</p>",
        solution: "",
      })
    ).toBe("<p>By substitution</p>");
  });

  it("falls back to the plain solution string", () => {
    expect(ntaQuestionSolutionText({ solutionHtml: "  ", solution: "  4π  " })).toBe("4π");
  });

  it("feeds paper OCR markdown to the worked sheet", () => {
    const paper = "<!-- paper-ocr -->\n\n## Step 1: King\n\n$I = 9$.";
    expect(
      ntaQuestionSolutionText({
        solutionHtml: '<p class="nta-sol-lead"><img class="nta-mock-img" alt="crop"></p>',
        solution: paper,
      })
    ).toBe(paper);
  });
});

describe("ntaQuestionCoachText", () => {
  it("is empty when that column was never filled", () => {
    expect(ntaQuestionCoachText({ coachTips: null, coachFormulas: null }, "tips")).toBe("");
    expect(ntaQuestionCoachText({ coachTips: "  ", coachFormulas: null }, "formulas")).toBe("");
  });

  it("returns the stored markdown for Tips or Formula's", () => {
    expect(
      ntaQuestionCoachText(
        { coachTips: "  Split even/odd.  ", coachFormulas: "$I_{even}=2\\int_0^a$" },
        "tips"
      )
    ).toBe("Split even/odd.");
    expect(
      ntaQuestionCoachText(
        { coachTips: "Split even/odd.", coachFormulas: "  $\\int_{-a}^{a}f=0$  " },
        "formulas"
      )
    ).toBe("$\\int_{-a}^{a}f=0$");
  });
});
