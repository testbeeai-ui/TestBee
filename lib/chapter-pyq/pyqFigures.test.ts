import { describe, expect, it } from "vitest";
import { PYQ_FIGURE_BUCKET, pyqFigurePublicUrl, resolvePyqFigureHtml } from "./pyqFigures";
import { PYQ_SAMPLE_FIGURES } from "./fixtures/lawsOfMotionSample";
import type { PyqFigureLinkRow } from "./pyqQuestionRow";

const link = (key: string, sort_order = 0): PyqFigureLinkRow => ({
  role: "question_body",
  sort_order,
  figures: PYQ_SAMPLE_FIGURES.find((f) => f.figure_key === key) ?? null,
});

describe("pyq figures", () => {
  it("builds a public Storage URL from storage_path", () => {
    // vitest.config.ts sets NEXT_PUBLIC_SUPABASE_URL to http://127.0.0.1:54321
    expect(pyqFigurePublicUrl({ storage_path: "pyq/physics/figures/p047_x101.png", public_url: null })).toBe(
      "http://127.0.0.1:54321/storage/v1/object/public/pyq/physics/figures/p047_x101.png"
    );
    expect(PYQ_FIGURE_BUCKET).toBe("pyq");
  });

  it("prefers a stored public_url when the row has one", () => {
    const stored = PYQ_SAMPLE_FIGURES.find((f) => f.public_url !== null)!;
    expect(pyqFigurePublicUrl(stored)).toBe(stored.public_url);
  });

  it("prefixes the bucket when storage_path omits it", () => {
    expect(pyqFigurePublicUrl({ storage_path: "physics/figures/x.png", public_url: null })).toContain(
      "/public/pyq/physics/figures/x.png"
    );
  });

  it("replaces a placeholder with an img carrying src, alt and class only", () => {
    const html = resolvePyqFigureHtml("Block shown [[fig:p047_x101]]", [link("p047_x101")]);
    expect(html).toContain("<img");
    expect(html).toContain('class="nta-mock-img"');
    expect(html).toContain("p047_x101.png");
    expect(html).toContain("Block on a rough inclined plane");
    expect(html).not.toContain("[[fig:");
    expect(html).not.toContain("loading=");
    expect(html).not.toContain("onerror");
  });

  it("synthesizes an img from a raster placeholder when figure_links is empty", () => {
    const html = resolvePyqFigureHtml("See [[fig:p047_x549]] here", []);
    expect(html).not.toContain("[[fig:");
    expect(html).toContain("<img");
    expect(html).toContain("p047_x549.png");
    expect(html).toContain("pyq/physics/figures/p047_x549.png");
    expect(html).toContain("See");
  });

  it("unwraps PostgREST array-shaped figure embeds", () => {
    const html = resolvePyqFigureHtml("[[fig:k]]", [
      {
        role: "question_body",
        sort_order: 0,
        figures: [
          { figure_key: "k", storage_path: "pyq/a.png", public_url: null, alt_text: "arr" },
        ] as unknown as PyqFigureLinkRow["figures"],
      },
    ]);
    expect(html).toContain("<img");
    expect(html).toContain("pyq/a.png");
  });

  it("drops a non-raster placeholder that has no matching figure row", () => {
    const html = resolvePyqFigureHtml("See [[fig:not_a_raster]] here", []);
    expect(html).not.toContain("[[fig:");
    expect(html).not.toContain("not_a_raster");
    expect(html).toContain("See");
  });

  it("appends question_body figures the body never referenced", () => {
    const html = resolvePyqFigureHtml("No placeholder in this stem.", [
      link("p052_x318", 1),
      link("p047_x101", 0),
    ]);
    const first = html.indexOf("p047_x101");
    const second = html.indexOf("p052_x318");
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
  });

  it("does not append a figure the body already referenced", () => {
    const html = resolvePyqFigureHtml("[[fig:p047_x101]]", [link("p047_x101")]);
    expect(html.match(/p047_x101/g)).toHaveLength(1);
  });

  it("ignores option and match-list figures in the stem", () => {
    const html = resolvePyqFigureHtml("Stem only.", [
      { role: "option", sort_order: 0, figures: PYQ_SAMPLE_FIGURES[0]! },
    ]);
    expect(html).not.toContain("<img");
  });

  it("escapes quotes in alt text", () => {
    const html = resolvePyqFigureHtml("[[fig:k]]", [
      {
        role: "question_body",
        sort_order: 0,
        figures: { figure_key: "k", storage_path: "pyq/a.png", public_url: null, alt_text: 'a "quoted" label' },
      },
    ]);
    expect(html).toContain("&quot;quoted&quot;");
  });
});
