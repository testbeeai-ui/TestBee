import { describe, expect, it } from "vitest";
import {
  CHAPTER_PYQ_CHAPTERS,
  chapterPyqHref,
  chaptersForSubject,
  filterChapters,
  findChapter,
  isChapterPyqSubject,
} from "./catalog";

const MATH_NAMES = [
  "Application of Derivatives",
  "Area Under Curves",
  "Basic of Mathematics",
  "Binomial Theorem",
  "Circle",
  "Complex Number",
  "Continuity and Differentiability",
  "Definite Integration",
  "Determinants",
  "Differential Equations",
  "Differentiation",
  "Ellipse",
  "Functions",
  "Hyperbola",
  "Indefinite Integration",
  "Inverse Trigonometric Functions",
  "Limits",
  "Limits, Continuity and Differentiability",
  "Matrices",
  "Parabola",
  "Permutation Combination",
  "Probability",
  "Quadratic Equation",
  "Sequences and Series",
  "Sets and Relations",
  "Statistics",
  "Straight Lines",
  "Three Dimensional Geometry",
  "Trigonometric Equations",
  "Trigonometric Ratios and Identities",
  "Vector Algebra",
] as const;

describe("chapter PYQ catalog", () => {
  it("lists the 31 MathonGo math download titles", () => {
    const math = chaptersForSubject("math").map((c) => c.name);
    expect(math).toEqual([...MATH_NAMES]);
  });

  it("keeps slugs unique per subject", () => {
    for (const subject of ["physics", "chemistry", "math"] as const) {
      const slugs = chaptersForSubject(subject).map((c) => c.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("finds a chapter and builds its href", () => {
    const circle = findChapter("math", "circle");
    expect(circle?.name).toBe("Circle");
    expect(chapterPyqHref(circle!)).toBe("/chapter-pyq/math/circle");
    expect(findChapter("math", "mathematical-reasoning")).toBeNull();
    expect(findChapter("math", "heights-and-distances")).toBeNull();
    expect(findChapter("math", "properties-of-triangles")).toBeNull();
  });

  it("returns null for unknown subject or slug", () => {
    expect(findChapter("biology", "circle")).toBeNull();
    expect(findChapter("math", "nope")).toBeNull();
    expect(isChapterPyqSubject("math")).toBe(true);
    expect(isChapterPyqSubject("jee")).toBe(false);
  });

  it("filters by chapter name", () => {
    const hits = filterChapters(chaptersForSubject("math"), "integ");
    expect(hits.map((c) => c.name)).toEqual([
      "Definite Integration",
      "Indefinite Integration",
    ]);
  });

  it("has 29 physics and 20 chemistry chapters", () => {
    expect(chaptersForSubject("physics")).toHaveLength(29);
    expect(chaptersForSubject("chemistry")).toHaveLength(20);
    expect(CHAPTER_PYQ_CHAPTERS).toHaveLength(31 + 29 + 20);
  });

  it("keeps physics in syllabus order and ends with Communication System", () => {
    const physics = chaptersForSubject("physics");
    expect(physics[0]?.name).toBe("Units and Measurements");
    expect(physics[27]?.name).toBe("Semiconductor Electronics");
    expect(physics[28]).toEqual({
      subject: "physics",
      name: "Communication System",
      slug: "communication-system",
    });
  });
});
