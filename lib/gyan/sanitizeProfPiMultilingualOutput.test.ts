import { describe, expect, it } from "vitest";

import { sanitizeProfPiMultilingualOutput } from "@/lib/gyan/sanitizeProfPiMultilingualOutput";

describe("sanitizeProfPiMultilingualOutput", () => {
  it("dedupes consecutive identical inline math blocks", () => {
    const input = "See $x^2$ $x^2$ for the answer.";
    expect(sanitizeProfPiMultilingualOutput(input)).toBe("See $x^2$ for the answer.");
  });

  it("dedupes consecutive raw math fragments with math signals", () => {
    const input = "Δ=b²−4ac Δ=b² −4ac";
    const out = sanitizeProfPiMultilingualOutput(input);
    expect(out).not.toMatch(/Δ=b²−4ac\s+Δ=b²/);
  });

  it("wraps x² in inline LaTeX outside existing math", () => {
    const input = "The root is x² when simplified.";
    expect(sanitizeProfPiMultilingualOutput(input)).toContain("$x^2$");
    expect(sanitizeProfPiMultilingualOutput(input)).not.toContain("x²");
  });

  it("adds space between Telugu text and $ delimiters", () => {
    const input = "సమాధానం:$x=2$";
    expect(sanitizeProfPiMultilingualOutput(input)).toBe("సమాధానం: $x=2$");
  });

  it("does not destroy legitimate Telugu word repetition in prose", () => {
    const input = "అవును అవును, ఇది సరైనది.";
    expect(sanitizeProfPiMultilingualOutput(input)).toBe(input);
  });

  it("leaves well-formed English LaTeX unchanged", () => {
    const input = "**Answer:** $x = 2, 3$\n\n**Steps:**\n- Factor the quadratic.";
    expect(sanitizeProfPiMultilingualOutput(input)).toBe(input);
  });

  it("does not alter content inside existing $ blocks", () => {
    const input = String.raw`Use $\Delta = b^2 - 4ac$ here.`;
    expect(sanitizeProfPiMultilingualOutput(input)).toBe(input);
  });
});
