import { describe, expect, it } from "vitest";
import { gyanBuddyListLine, gyanRightNowPreviewContent } from "./gyanBuddyListLine";

describe("gyanRightNowPreviewContent", () => {
  it("normalizes bracket math and uses inline $ for compact KaTeX", () => {
    const out = gyanRightNowPreviewContent(String.raw`[
x=\sqrt{10%}
]
Find (x).`);
    expect(out).toContain("$");
    expect(out).not.toMatch(/^\s*\[/m);
    expect(out).toContain(String.raw`\sqrt`);
  });
});

describe("gyanBuddyListLine", () => {
  it("flattens markdown and display math to one line", () => {
    const out = gyanBuddyListLine(
      String.raw`**Question:** Evaluate $$x=\sqrt{10\%+\sqrt{1\%}}$$ Find (x).`
    );
    expect(out).not.toContain("$$");
    expect(out).not.toContain("**");
    expect(out).toContain("Question:");
    expect(out).toContain("√");
  });

  it("truncates long titles", () => {
    const out = gyanBuddyListLine("a".repeat(80), 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith("…")).toBe(true);
  });
});
