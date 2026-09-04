import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import katex from "katex";

/** Screenshot Q3 stem + options from the EduDeca mock quiz. */
const STEM = "What is the value of: $\\frac{3}{4}+\\frac{5}{8}$";
const OPTIONS = ["$1\\frac{1}{4}$", "$\\frac{7}{8}$", "$\\frac{11}{16}$", "$1\\frac{1}{8}$"];

function dollarInners(text: string): string[] {
  return [...text.matchAll(/\$([^$\n]+?)\$/g)].map((match) => match[1] ?? "");
}

describe("EduDeca mock quiz math", () => {
  it("KaTeX renders the screenshot frac stem and mixed-number options", () => {
    for (const inner of dollarInners(STEM)) {
      const html = katex.renderToString(inner, {
        throwOnError: false,
        displayMode: false,
        strict: "ignore",
      });
      expect(html).toContain("katex");
      expect(html).not.toContain("katex-error");
    }

    for (const option of OPTIONS) {
      const inners = dollarInners(option);
      expect(inners.length).toBeGreaterThan(0);
      for (const inner of inners) {
        const html = katex.renderToString(inner, {
          throwOnError: false,
          displayMode: false,
          strict: "ignore",
        });
        expect(html).toContain("katex");
        expect(html).not.toContain("katex-error");
        expect(html).not.toContain("$");
      }
    }
  });

  it("quiz UI sends stems and options through MathText", () => {
    const src = readFileSync(
      path.resolve(__dirname, "../../components/edudeca-mock/EduDecaMockExperience.tsx"),
      "utf8",
    );
    expect(src).toContain('from "@/components/MathText"');
    expect(src).toMatch(/<MathText[\s\S]*\{question\.q\}[\s\S]*?<\/MathText>/);
    expect(src).toMatch(/<MathText[\s\S]*\{option\}[\s\S]*?<\/MathText>/);
  });
});
