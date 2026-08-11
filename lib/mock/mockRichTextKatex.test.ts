import { describe, expect, it } from "vitest";
import { collapseSpuriousMockHtmlWhitespace } from "./mockRichTextKatex";

describe("collapseSpuriousMockHtmlWhitespace", () => {
  it("removes OCR spacer paragraphs after a figure", () => {
    const input = [
      "<p><strong>Two stones…</strong></p>",
      '<p><strong><img alt="" src="https://example.com/a.png" /></strong></p>',
      "<p>&nbsp;</p>",
      "<p><strong>&nbsp;&nbsp; &nbsp;</strong><br /><br /><br /><br />&nbsp;</p>",
      "<p>&nbsp;</p>",
      "<p><strong>&nbsp;&nbsp;<br /><br />&nbsp;&nbsp;</strong></p>",
      "<p><em>Choices are labeled (1)–(4) in the figure above. Select the matching label.</em></p>",
    ].join("\n");

    const out = collapseSpuriousMockHtmlWhitespace(input);
    expect(out).toContain("<img");
    expect(out).toContain("Choices are labeled");
    expect(out).toContain("Two stones");
    expect((out.match(/<br>/gi) || []).length).toBe(0);
    expect(out).not.toMatch(/<p>\s*&nbsp;\s*<\/p>/i);
  });

  it("keeps real option-like paragraphs", () => {
    const input = "<p><strong>(1) 10 m/s</strong></p>\n<p><strong>(2) 20 m/s</strong></p>";
    expect(collapseSpuriousMockHtmlWhitespace(input)).toContain("(1) 10 m/s");
    expect(collapseSpuriousMockHtmlWhitespace(input)).toContain("(2) 20 m/s");
  });
});
