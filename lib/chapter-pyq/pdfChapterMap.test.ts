import { describe, expect, it } from "vitest";
import { chaptersForSubject, findChapter } from "./catalog";
import {
  PYQ_DEFERRED_PDF_CHAPTERS,
  PYQ_MATH_PDF_CHAPTERS,
  PYQ_PHYSICS_PDF_CHAPTERS,
  catalogSlugForMathPdfChapter,
  catalogSlugForPdfChapter,
  isPyqSourcedCatalogSlug,
  mathPdfChaptersForCatalogSlug,
  pdfChaptersForCatalogSlug,
} from "./pdfChapterMap";

describe("physics PDF chapter map", () => {
  it("accounts for every PDF chapter 1 through 32 exactly once", () => {
    const numbers = PYQ_PHYSICS_PDF_CHAPTERS.map((row) => row.pdfChapterNo);
    expect(numbers).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
    expect(new Set(numbers).size).toBe(32);
  });

  it("points every mapped slug at a real physics catalog chapter", () => {
    for (const row of PYQ_PHYSICS_PDF_CHAPTERS) {
      if (row.catalogSlug === null) continue;
      expect(findChapter("physics", row.catalogSlug), `chapter ${row.pdfChapterNo}`).not.toBeNull();
    }
  });

  it("defers only PDF chapter 17 (Electrostatics)", () => {
    const unmapped = PYQ_PHYSICS_PDF_CHAPTERS.filter((row) => row.catalogSlug === null);
    expect(unmapped.map((row) => row.pdfChapterNo)).toEqual([17]);
    expect(unmapped[0]?.pdfChapterTitle).toBe("Electrostatics");
    expect(PYQ_DEFERRED_PDF_CHAPTERS).toEqual([17]);
    expect(catalogSlugForPdfChapter(17)).toBeNull();
  });

  it("merges chapters 1, 2 and 32 into units-and-measurements", () => {
    expect(catalogSlugForPdfChapter(1)).toBe("units-and-measurements");
    expect(catalogSlugForPdfChapter(2)).toBe("units-and-measurements");
    expect(catalogSlugForPdfChapter(32)).toBe("units-and-measurements");
    expect(pdfChaptersForCatalogSlug("units-and-measurements").map((r) => r.pdfChapterNo)).toEqual([
      1, 2, 32,
    ]);
  });

  it("merges chapters 7 and 8 into system-of-particles-and-rotational-motion", () => {
    expect(
      pdfChaptersForCatalogSlug("system-of-particles-and-rotational-motion").map(
        (r) => r.pdfChapterNo
      )
    ).toEqual([7, 8]);
  });

  it("routes chapter 18 (Capacitance) to electrostatic-potential-and-capacitance", () => {
    expect(catalogSlugForPdfChapter(18)).toBe("electrostatic-potential-and-capacitance");
    expect(
      pdfChaptersForCatalogSlug("electrostatic-potential-and-capacitance").map(
        (r) => r.pdfChapterNo
      )
    ).toEqual([18]);
  });

  it("maps the pilot chapter 1:1", () => {
    expect(catalogSlugForPdfChapter(5)).toBe("laws-of-motion");
    expect(pdfChaptersForCatalogSlug("laws-of-motion").map((r) => r.pdfChapterNo)).toEqual([5]);
  });

  it("adds no route for a PDF chapter that became a topic", () => {
    const mergedAway = [
      "mathematics-in-physics",
      "units-and-dimensions",
      "center-of-mass-momentum-and-collision",
      "rotational-motion",
      "capacitance",
      "experimental-physics",
      "electrostatics",
    ];
    for (const slug of mergedAway) {
      expect(findChapter("physics", slug), slug).toBeNull();
      expect(pdfChaptersForCatalogSlug(slug), slug).toEqual([]);
    }
  });

  it("leaves electric-charges-and-fields with no PYQ source", () => {
    expect(pdfChaptersForCatalogSlug("electric-charges-and-fields")).toEqual([]);
    expect(isPyqSourcedCatalogSlug("electric-charges-and-fields")).toBe(false);
    expect(isPyqSourcedCatalogSlug("laws-of-motion")).toBe(true);
  });

  it("covers 28 of the 29 physics catalog chapters", () => {
    const sourced = chaptersForSubject("physics").filter((c) => isPyqSourcedCatalogSlug(c.slug));
    expect(sourced).toHaveLength(28);
    expect(new Set(PYQ_PHYSICS_PDF_CHAPTERS.map((r) => r.catalogSlug)).size).toBe(29);
  });

  it("returns null for an out-of-range PDF chapter number", () => {
    expect(catalogSlugForPdfChapter(0)).toBeNull();
    expect(catalogSlugForPdfChapter(33)).toBeNull();
  });
});

describe("math PDF chapter map", () => {
  it("accounts for every 2025 session PDF chapter 1 through 29 exactly once", () => {
    const numbers = PYQ_MATH_PDF_CHAPTERS.map((row) => row.pdfChapterNo);
    expect(numbers).toEqual(Array.from({ length: 29 }, (_, i) => i + 1));
    expect(new Set(numbers).size).toBe(29);
    expect(new Set(PYQ_MATH_PDF_CHAPTERS.map((row) => row.catalogSlug)).size).toBe(29);
  });

  it("points every mapped slug at a real math catalog chapter", () => {
    for (const row of PYQ_MATH_PDF_CHAPTERS) {
      expect(row.catalogSlug, `chapter ${row.pdfChapterNo}`).not.toBeNull();
      expect(findChapter("math", row.catalogSlug!), `chapter ${row.pdfChapterNo}`).not.toBeNull();
    }
  });

  it("keeps Statistics as PDF chapter 7, not Mathematical Reasoning", () => {
    expect(catalogSlugForMathPdfChapter(7)).toBe("statistics");
    expect(mathPdfChaptersForCatalogSlug("mathematical-reasoning")).toEqual([]);
  });

  it("keeps one catalog page per PDF chapter, including trig ratios as 25 only", () => {
    expect(catalogSlugForMathPdfChapter(17)).toBe("definite-integration");
    expect(catalogSlugForMathPdfChapter(18)).toBe("area-under-curves");
    expect(catalogSlugForMathPdfChapter(19)).toBe("differential-equations");
    expect(catalogSlugForMathPdfChapter(25)).toBe("trigonometric-ratios-and-identities");
    expect(
      mathPdfChaptersForCatalogSlug("trigonometric-ratios-and-identities").map((r) => r.pdfChapterNo)
    ).toEqual([25]);
  });

  it("does not invent compilation-book chapters that this session PDF skipped", () => {
    for (const slug of [
      "mathematical-reasoning",
      "differentiation",
      "heights-and-distances",
      "properties-of-triangles",
    ]) {
      expect(mathPdfChaptersForCatalogSlug(slug), slug).toEqual([]);
    }
    expect(findChapter("math", "heights-and-distances")).toBeNull();
    expect(findChapter("math", "properties-of-triangles")).toBeNull();
  });

  it("does not ingest the leftover combined Limits catalog row", () => {
    expect(findChapter("math", "limits-continuity-and-differentiability")).not.toBeNull();
    expect(mathPdfChaptersForCatalogSlug("limits-continuity-and-differentiability")).toEqual([]);
    expect(catalogSlugForMathPdfChapter(13)).toBe("limits");
    expect(catalogSlugForMathPdfChapter(14)).toBe("continuity-and-differentiability");
    expect(catalogSlugForMathPdfChapter(15)).toBe("application-of-derivatives");
    expect(catalogSlugForMathPdfChapter(16)).toBe("indefinite-integration");
  });

  it("marks mapped math slugs as sourced; leftover compilation titles are not", () => {
    expect(isPyqSourcedCatalogSlug("quadratic-equation")).toBe(true);
    expect(isPyqSourcedCatalogSlug("statistics")).toBe(true);
    expect(isPyqSourcedCatalogSlug("trigonometric-ratios-and-identities")).toBe(true);
    expect(isPyqSourcedCatalogSlug("mathematical-reasoning")).toBe(false);
    expect(isPyqSourcedCatalogSlug("differentiation")).toBe(false);
    expect(isPyqSourcedCatalogSlug("limits-continuity-and-differentiability")).toBe(false);
  });

  it("returns null for an out-of-range math PDF chapter number", () => {
    expect(catalogSlugForMathPdfChapter(0)).toBeNull();
    expect(catalogSlugForMathPdfChapter(30)).toBeNull();
  });
});
