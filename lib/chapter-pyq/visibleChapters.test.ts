import { describe, expect, it } from "vitest";
import { chaptersForSubject } from "./catalog";
import {
  CHAPTER_PYQ_VISIBLE_MATH_SLUGS,
  CHAPTER_PYQ_VISIBLE_PHYSICS_SLUGS,
  isChapterPyqStudentVisible,
  publishedCountForStudent,
} from "./visibleChapters";

describe("chapter PYQ student allowlist", () => {
  it("opens every math chapter when the allowlist is empty", () => {
    expect(CHAPTER_PYQ_VISIBLE_MATH_SLUGS).toEqual([]);
    expect(isChapterPyqStudentVisible("math", "complex-number")).toBe(true);
    expect(isChapterPyqStudentVisible("math", "trigonometric-equations")).toBe(true);
    expect(isChapterPyqStudentVisible("math", "vector-algebra")).toBe(true);
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

  it("opens the released physics chapters and holds the rest", () => {
    expect(CHAPTER_PYQ_VISIBLE_PHYSICS_SLUGS).toEqual([
      "units-and-measurements",
      "motion-in-a-straight-line",
      "motion-in-a-plane",
      "laws-of-motion",
      "work-energy-and-power",
      "system-of-particles-and-rotational-motion",
      "gravitation",
      "mechanical-properties-of-solids",
      "mechanical-properties-of-fluids",
      "thermal-properties-of-matter",
      "thermodynamics",
      "kinetic-theory-of-gases",
      "oscillations",
      "waves",
      "electric-charges-and-fields",
      "electrostatic-potential-and-capacitance",
      "current-electricity",
      "moving-charges-and-magnetism",
      "magnetism-and-matter",
      "electromagnetic-induction",
      "alternating-current",
      "electromagnetic-waves",
      "ray-optics",
      "wave-optics",
      "dual-nature-of-radiation-and-matter",
      "atoms",
      "nuclei",
      "semiconductor-electronics",
      "communication-system",
    ]);
    for (const slug of CHAPTER_PYQ_VISIBLE_PHYSICS_SLUGS) {
      expect(isChapterPyqStudentVisible("physics", slug)).toBe(true);
    }
    expect(isChapterPyqStudentVisible("physics", "waves")).toBe(true);
    expect(isChapterPyqStudentVisible("physics", "electric-charges-and-fields")).toBe(true);
    expect(isChapterPyqStudentVisible("physics", "electrostatic-potential-and-capacitance")).toBe(true);
    expect(isChapterPyqStudentVisible("physics", "current-electricity")).toBe(true);
    expect(isChapterPyqStudentVisible("physics", "moving-charges-and-magnetism")).toBe(true);
    expect(isChapterPyqStudentVisible("physics", "magnetism-and-matter")).toBe(true);
    expect(isChapterPyqStudentVisible("physics", "electromagnetic-induction")).toBe(true);
    expect(isChapterPyqStudentVisible("physics", "alternating-current")).toBe(true);
    expect(isChapterPyqStudentVisible("physics", "electromagnetic-waves")).toBe(true);
    expect(isChapterPyqStudentVisible("physics", "ray-optics")).toBe(true);
    expect(isChapterPyqStudentVisible("physics", "wave-optics")).toBe(true);
    expect(isChapterPyqStudentVisible("physics", "dual-nature-of-radiation-and-matter")).toBe(true);
    expect(isChapterPyqStudentVisible("physics", "atoms")).toBe(true);
    expect(isChapterPyqStudentVisible("physics", "nuclei")).toBe(true);
    expect(isChapterPyqStudentVisible("physics", "semiconductor-electronics")).toBe(true);
    expect(isChapterPyqStudentVisible("physics", "communication-system")).toBe(true);
  });

  it("holds every physics chapter that is not on the allowlist", () => {
    const physics = chaptersForSubject("physics");
    const open = physics.filter((c) => isChapterPyqStudentVisible("physics", c.slug));
    expect(open.map((c) => c.slug)).toEqual(
      CHAPTER_PYQ_VISIBLE_PHYSICS_SLUGS,
    );
    expect(open.length).toBe(physics.length);
  });

  it("physics allowlist slugs exist on the physics catalog", () => {
    const slugs = new Set(chaptersForSubject("physics").map((c) => c.slug));
    for (const slug of CHAPTER_PYQ_VISIBLE_PHYSICS_SLUGS) {
      expect(slugs.has(slug)).toBe(true);
    }
  });

  it("counts a locked physics chapter as 0 / 0 even when rows exist", () => {
    expect(publishedCountForStudent("physics", "mechanical-properties-of-fluids", 81)).toBe(81);
    expect(publishedCountForStudent("physics", "thermal-properties-of-matter", 31)).toBe(31);
    expect(publishedCountForStudent("physics", "thermodynamics", 83)).toBe(83);
    expect(publishedCountForStudent("physics", "kinetic-theory-of-gases", 52)).toBe(52);
    expect(publishedCountForStudent("physics", "oscillations", 55)).toBe(55);
    expect(publishedCountForStudent("physics", "waves", 49)).toBe(49);
    expect(publishedCountForStudent("physics", "electric-charges-and-fields", 121)).toBe(121);
    expect(publishedCountForStudent("physics", "electrostatic-potential-and-capacitance", 57)).toBe(57);
    expect(publishedCountForStudent("physics", "current-electricity", 135)).toBe(135);
    expect(publishedCountForStudent("physics", "moving-charges-and-magnetism", 97)).toBe(97);
    expect(publishedCountForStudent("physics", "magnetism-and-matter", 21)).toBe(21);
    expect(publishedCountForStudent("physics", "electromagnetic-induction", 57)).toBe(57);
    expect(publishedCountForStudent("physics", "alternating-current", 63)).toBe(63);
    expect(publishedCountForStudent("physics", "electromagnetic-waves", 53)).toBe(53);
    expect(publishedCountForStudent("physics", "mechanical-properties-of-solids", 44)).toBe(44);
    expect(publishedCountForStudent("physics", "ray-optics", 116)).toBe(116);
    expect(publishedCountForStudent("physics", "wave-optics", 69)).toBe(69);
    expect(publishedCountForStudent("physics", "dual-nature-of-radiation-and-matter", 71)).toBe(71);
    expect(publishedCountForStudent("physics", "atoms", 61)).toBe(61);
    expect(publishedCountForStudent("physics", "nuclei", 53)).toBe(53);
    expect(publishedCountForStudent("physics", "semiconductor-electronics", 73)).toBe(73);
    expect(publishedCountForStudent("physics", "communication-system", 22)).toBe(22);
    expect(publishedCountForStudent("physics", "units-and-measurements", 117)).toBe(117);
    expect(publishedCountForStudent("physics", "work-energy-and-power", 67)).toBe(67);
    expect(publishedCountForStudent("physics", "gravitation", 79)).toBe(79);
  });

  it("leaves subjects without an allowlist fully visible", () => {
    expect(isChapterPyqStudentVisible("chemistry", "anything")).toBe(true);
    expect(publishedCountForStudent("chemistry", "anything", 12)).toBe(12);
  });
});