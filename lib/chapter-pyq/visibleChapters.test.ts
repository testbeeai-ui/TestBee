import { describe, expect, it } from "vitest";
import { chaptersForSubject } from "./catalog";
import {
  CHAPTER_PYQ_VISIBLE_MATH_SLUGS,
  isChapterPyqStudentVisible,
  publishedCountForStudent,
} from "./visibleChapters";

describe("chapter PYQ student allowlist", () => {
  it("opens every math chapter when the allowlist is empty", () => {
    expect(CHAPTER_PYQ_VISIBLE_MATH_SLUGS).toEqual([]);
    expect(isChapterPyqStudentVisible("math", "complex-number")).toBe(true);
    expect(isChapterPyqStudentVisible("math", "trigonometric-equations")).toBe(true);
    expect(isChapterPyqStudentVisible("math", "vector-algebra")).toBe(true);
    expect(isChapterPyqStudentVisible("physics", "laws-of-motion")).toBe(true);
  });

  it("reports live question counts for previously locked math chapters", () => {
    expect(publishedCountForStudent("math", "complex-number", 74)).toBe(74);
    expect(publishedCountForStudent("math", "application-of-derivatives", 54)).toBe(54);
  });

  it("allowlist slugs exist on the math catalog", () => {
    const slugs = new Set(chaptersForSubject("math").map((c) => c.slug));
    for (const slug of CHAPTER_PYQ_VISIBLE_MATH_SLUGS) {
      expect(slugs.has(slug)).toBe(true);
    }
  });
});
