import { describe, expect, it } from "vitest";
import katex from "katex";
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
    expect(protectTexBrackets("[x]")).toBe("\\lbrack{x}\\rbrack{}");
    expect(protectTexBrackets("[-\\pi/2,\\pi/2]")).toBe("\\left[-\\pi/2,\\pi/2\\right]");
    expect(protectTexBrackets("\\frac{1}{[x]+4}")).toBe("\\frac{1}{\\lbrack{x}\\rbrack{}+4}");
    expect(protectTexBrackets("\\sqrt[3]{\\tan 2x}")).toBe("\\sqrt[3]{\\tan 2x}");
    expect(repairBankMathLatex("[\\cdot]")).toBe("\\lbrack{\\cdot}\\rbrack{}");
  });

  it("does not glue \\rbrack onto the next letter", () => {
    const tex = "[x^n]\\,(P(x)Q(x)) = \\sum_{i=0}^{n} [x^i]P \\cdot [x^{n-i}]Q";
    const out = protectTexBrackets(tex);
    expect(out).toContain("\\rbrack{}P");
    expect(out).not.toMatch(/\\rbrackP/);
    expect(() =>
      katex.renderToString(repairBankMathLatex(tex), { throwOnError: true, displayMode: true })
    ).not.toThrow();
  });

  it("still renders GIF floor [x] and closed intervals", () => {
    expect(() =>
      katex.renderToString(repairBankMathLatex("[x]=n \\iff n \\le x < n+1"), {
        throwOnError: true,
        displayMode: true,
      })
    ).not.toThrow();
    expect(() =>
      katex.renderToString(repairBankMathLatex("\\max_{[a,b]} f"), { throwOnError: true })
    ).not.toThrow();
  });

  it("repairs missing r in \\right, unclosed sqrt, and nCr after a sum", () => {
    expect(repairBankMathLatex("\\left(1-\\dfrac{4}{k}\\ight)")).toContain("\\right");
    expect(repairBankMathLatex("d=\\sqrt{(x_2-x_1)^2+(y_2-y_1)^2")).toMatch(/\\sqrt\{.*\}$/);
    expect(repairBankMathLatex("[f(x)] = f(x) - \\{f(x)}")).toContain("\\{f(x)\\}");
    expect(() =>
      katex.renderToString(repairBankMathLatex("\\sum_{k=0}^{n} ^{n}C_{k} = 2^{n}"), {
        throwOnError: true,
        displayMode: true,
      })
    ).not.toThrow();
  });

  it("does not wrap cases-row intervals across &", () => {
    const tex =
      "f(x) = \\begin{cases} e^{\\sin^{-1} x}, & x \\in [0, 1) \\\\ e^{-\\log x}, & x \\in [1, 2] \\end{cases}";
    expect(() =>
      katex.renderToString(repairBankMathLatex(tex), { throwOnError: true, displayMode: true })
    ).not.toThrow();
  });

  it("closes \\text and \\{ sets that glm left unescaped", () => {
    expect(() =>
      katex.renderToString(repairBankMathLatex("\\text{exactly one root (left branch)"), {
        throwOnError: true,
      })
    ).not.toThrow();
    expect(() =>
      katex.renderToString(repairBankMathLatex("\\max\\{|x+1|,\\dots,|x+5|}=\\max\\{|x+1|,|x+5|\\}"), {
        throwOnError: true,
        displayMode: true,
      })
    ).not.toThrow();
  });

  it("does not eat \\frac or \\left\\{ when closing a bare set brace", () => {
    expect(() =>
      katex.renderToString(repairBankMathLatex("\\int_0^n \\{x\\}\\,dx = \\frac{n}{2}"), {
        throwOnError: true,
        displayMode: true,
      })
    ).not.toThrow();
    expect(() =>
      katex.renderToString(
        repairBankMathLatex("\\left\\{\\dfrac{9-x^{2}}{5-x}\\right\\} = \\alpha"),
        { throwOnError: true, displayMode: true }
      )
    ).not.toThrow();
    expect(() =>
      katex.renderToString(
        repairBankMathLatex("[f(x)] = f(x) - \\{f(x)}"),
        { throwOnError: true, displayMode: true }
      )
    ).not.toThrow();
    expect(() =>
      katex.renderToString(repairBankMathLatex("x^{1/3}-[x^{1/3}]=\\{x^{1/3}\\}"), {
        throwOnError: true,
        displayMode: true,
      })
    ).not.toThrow();
    expect(() =>
      katex.renderToString(
        repairBankMathLatex("\\{\\text{Using } \\int_{a}^{0} f(x)\\,dx = \\int_{a}^{0} f(a+b-x)\\,dx\\}"),
        { throwOnError: true, displayMode: true }
      )
    ).not.toThrow();
    expect(() =>
      katex.renderToString(repairBankMathLatex("\\lim_{x\\to a^-}f=\\lim_{x\\to a^+f=f(a)"), {
        throwOnError: true,
      })
    ).not.toThrow();
    expect(() =>
      katex.renderToString(repairBankMathLatex("\\vec{a}\\cdot(-7\\hat i+2\\hat j+3\\hat k})"), {
        throwOnError: true,
      })
    ).not.toThrow();
  });

  it("turns smashed JSON \\\\n and \\\\uXXXX into real math", () => {
    expect(() =>
      katex.renderToString(
        repairBankMathLatex(
          "x + (\\u221a2 \\u2219 sin \\u03b1)y = 0\\nx + (cos \\u03b1)y = 0"
        ),
        { throwOnError: true, displayMode: true }
      )
    ).not.toThrow();
    expect(() =>
      katex.renderToString(
        repairBankMathLatex(
          "\\begin{cases}\\nx - y + z = 5 \\\\ 2x + 2y + \\alpha z = 8 \\\\ 3x - y + 4z = \\beta\\end{cases}\\nhas infinitely many"
        ),
        { throwOnError: true, displayMode: true }
      )
    ).not.toThrow();
    expect(repairBankMathLatex("a \\neq 0")).toContain("\\neq");
  });

  it("keeps a space between glued linear equations that KaTeX would smash", () => {
    const out = repairBankMathLatex(
      "x+5y-z=1 4x+3y-3z=7 24x+y+\\lambda z=\\mu \\lambda, \\mu \\in R"
    );
    expect(out).toMatch(/=\s*1\s*[,\\]/);
    expect(out).toContain("\\quad");
    expect(out).not.toMatch(/1\s*4x/);
    expect(out).not.toMatch(/7\s*24x/);
    expect(out).not.toMatch(/\\mu\s+\\lambda/);
    expect(() =>
      katex.renderToString(out, { throwOnError: true, displayMode: true })
    ).not.toThrow();
  });

  it("collapses doubled TeX command slashes so \\mu renders", () => {
    expect(repairBankMathLatex("\\\\mu")).toBe("\\mu");
  });
});

