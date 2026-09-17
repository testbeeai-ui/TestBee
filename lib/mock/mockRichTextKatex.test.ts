import { describe, expect, it } from "vitest";
import {
  SUPABASE_PUBLIC_OBJECT_RE,
  collapseSpuriousMockHtmlWhitespace,
  patchMockHtmlImages,
  protectTexBrackets,
  repairBankMathLatex,
} from "./mockRichTextKatex";

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

const STORAGE_URL =
  "https://kmnqvqoyjjbovtaqozfc.supabase.co/storage/v1/object/public/pyq/physics/figures/p047_x101.png";

describe("patchMockHtmlImages", () => {
  it("still proxies legacy testbee images", () => {
    const out = patchMockHtmlImages(
      '<img src="https://testbee.in/preview/show_qimage/abc.png">'
    );
    expect(out).toContain("/api/mock/question-image?url=");
    expect(out).toContain("nta-mock-img");
  });

  it("recognises a Supabase public Storage object", () => {
    expect(SUPABASE_PUBLIC_OBJECT_RE.test(STORAGE_URL)).toBe(true);
    expect(SUPABASE_PUBLIC_OBJECT_RE.test("https://evil.example.com/a.png")).toBe(false);
  });

  it("serves Supabase Storage figures directly, never through the proxy", () => {
    const out = patchMockHtmlImages(`<img src="${STORAGE_URL}" alt="fbd" class="nta-mock-img">`);
    expect(out).toContain(`src="${STORAGE_URL}"`);
    expect(out).not.toContain("/api/mock/question-image");
  });

  it("adds the render attributes Storage figures need", () => {
    const out = patchMockHtmlImages(`<img src="${STORAGE_URL}" alt="fbd" class="nta-mock-img">`);
    expect(out).toContain('loading="lazy"');
    expect(out).toContain('decoding="async"');
    expect(out).toContain("nta-mock-img");
    expect(out).toContain('alt="fbd"');
  });

  it("leaves an unknown absolute src alone apart from the render attributes", () => {
    const out = patchMockHtmlImages('<img src="https://cdn.example.com/x.png">');
    expect(out).toContain('src="https://cdn.example.com/x.png"');
    expect(out).not.toContain("/api/mock/question-image");
  });

  it("does not double up an existing class or attribute", () => {
    const out = patchMockHtmlImages(
      `<img src="${STORAGE_URL}" class="nta-mock-img" loading="eager">`
    );
    expect(out.match(/nta-mock-img/g)).toHaveLength(1);
    expect(out.match(/loading=/g)).toHaveLength(1);
    expect(out).toContain('loading="eager"');
  });
});

describe("protectTexBrackets", () => {
  it("protects GIF [x] and closed intervals without touching cube roots", () => {
    expect(protectTexBrackets("[x]")).toBe("\\lbrack x \\rbrack");
    expect(protectTexBrackets("[-\\pi/2,\\pi/2]")).toBe("\\left[-\\pi/2,\\pi/2\\right]");
    expect(protectTexBrackets("\\frac{1}{[x]+4}")).toBe("\\frac{1}{\\lbrack x \\rbrack+4}");
    expect(protectTexBrackets("\\sqrt[3]{\\tan 2x}")).toBe("\\sqrt[3]{\\tan 2x}");
    expect(repairBankMathLatex("[\\cdot]")).toBe("\\lbrack \\cdot \\rbrack");
  });
});

