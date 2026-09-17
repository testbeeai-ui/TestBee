import { describe, expect, it } from "vitest";
import { ntaQuestionSolutionText } from "./ntaQuestionSolution";

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
});
