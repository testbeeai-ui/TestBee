/**
 * MathonGo JEE Main Physics PYQ book (32 chapters) → app catalog chapters.
 *
 * `catalogSlug` is deliberately many-to-one: several PDF chapters collapse onto
 * one catalog chapter and render on its single page. `null` means deferred —
 * no route, no page, no questions (PDF chapter 17 straddles two catalog chapters).
 */
export type PdfChapterMapping = {
  pdfChapterNo: number;
  pdfChapterTitle: string;
  catalogSlug: string | null;
  note: string;
};

export const PYQ_PHYSICS_PDF_CHAPTERS: readonly PdfChapterMapping[] = [
  { pdfChapterNo: 1, pdfChapterTitle: "Mathematics in Physics", catalogSlug: "units-and-measurements", note: "Becomes a topic" },
  { pdfChapterNo: 2, pdfChapterTitle: "Units and Dimensions", catalogSlug: "units-and-measurements", note: "Rename" },
  { pdfChapterNo: 3, pdfChapterTitle: "Motion In One Dimension", catalogSlug: "motion-in-a-straight-line", note: "Rename" },
  { pdfChapterNo: 4, pdfChapterTitle: "Motion In Two Dimensions", catalogSlug: "motion-in-a-plane", note: "Rename" },
  { pdfChapterNo: 5, pdfChapterTitle: "Laws of Motion", catalogSlug: "laws-of-motion", note: "1:1 — pilot chapter" },
  { pdfChapterNo: 6, pdfChapterTitle: "Work Power Energy", catalogSlug: "work-energy-and-power", note: "Rename" },
  { pdfChapterNo: 7, pdfChapterTitle: "Center of Mass Momentum and Collision", catalogSlug: "system-of-particles-and-rotational-motion", note: "Becomes a topic" },
  { pdfChapterNo: 8, pdfChapterTitle: "Rotational Motion", catalogSlug: "system-of-particles-and-rotational-motion", note: "Becomes a topic" },
  { pdfChapterNo: 9, pdfChapterTitle: "Gravitation", catalogSlug: "gravitation", note: "1:1" },
  { pdfChapterNo: 10, pdfChapterTitle: "Mechanical Properties of Solids", catalogSlug: "mechanical-properties-of-solids", note: "1:1" },
  { pdfChapterNo: 11, pdfChapterTitle: "Mechanical Properties of Fluids", catalogSlug: "mechanical-properties-of-fluids", note: "1:1" },
  { pdfChapterNo: 12, pdfChapterTitle: "Oscillations", catalogSlug: "oscillations", note: "1:1" },
  { pdfChapterNo: 13, pdfChapterTitle: "Waves and Sound", catalogSlug: "waves", note: "Rename" },
  { pdfChapterNo: 14, pdfChapterTitle: "Thermal Properties of Matter", catalogSlug: "thermal-properties-of-matter", note: "1:1" },
  { pdfChapterNo: 15, pdfChapterTitle: "Thermodynamics", catalogSlug: "thermodynamics", note: "1:1" },
  { pdfChapterNo: 16, pdfChapterTitle: "Kinetic Theory of Gases", catalogSlug: "kinetic-theory-of-gases", note: "1:1" },
  { pdfChapterNo: 17, pdfChapterTitle: "Electrostatics", catalogSlug: null, note: "Deferred — straddles Electric Charges and Fields + Electrostatic Potential and Capacitance" },
  { pdfChapterNo: 18, pdfChapterTitle: "Capacitance", catalogSlug: "electrostatic-potential-and-capacitance", note: "Becomes a topic" },
  { pdfChapterNo: 19, pdfChapterTitle: "Current Electricity", catalogSlug: "current-electricity", note: "1:1" },
  { pdfChapterNo: 20, pdfChapterTitle: "Magnetic Properties of Matter", catalogSlug: "magnetism-and-matter", note: "Rename" },
  { pdfChapterNo: 21, pdfChapterTitle: "Magnetic Effects of Current", catalogSlug: "moving-charges-and-magnetism", note: "Rename" },
  { pdfChapterNo: 22, pdfChapterTitle: "Electromagnetic Induction", catalogSlug: "electromagnetic-induction", note: "1:1" },
  { pdfChapterNo: 23, pdfChapterTitle: "Alternating Current", catalogSlug: "alternating-current", note: "1:1" },
  { pdfChapterNo: 24, pdfChapterTitle: "Ray Optics", catalogSlug: "ray-optics", note: "1:1" },
  { pdfChapterNo: 25, pdfChapterTitle: "Wave Optics", catalogSlug: "wave-optics", note: "1:1" },
  { pdfChapterNo: 26, pdfChapterTitle: "Dual Nature of Matter", catalogSlug: "dual-nature-of-radiation-and-matter", note: "Rename" },
  { pdfChapterNo: 27, pdfChapterTitle: "Atomic Physics", catalogSlug: "atoms", note: "Rename" },
  { pdfChapterNo: 28, pdfChapterTitle: "Nuclear Physics", catalogSlug: "nuclei", note: "Rename" },
  { pdfChapterNo: 29, pdfChapterTitle: "Electromagnetic Waves", catalogSlug: "electromagnetic-waves", note: "1:1" },
  { pdfChapterNo: 30, pdfChapterTitle: "Semiconductors", catalogSlug: "semiconductor-electronics", note: "Rename" },
  { pdfChapterNo: 31, pdfChapterTitle: "Communication System", catalogSlug: "communication-system", note: "New catalog chapter" },
  { pdfChapterNo: 32, pdfChapterTitle: "Experimental Physics", catalogSlug: "units-and-measurements", note: "Becomes a topic" },
];

/**
 * MathonGo JEE Main Mathematics PYQ book (33 chapters) → app catalog.
 *
 * Units from the PDF Content page: Algebra (1–11), Calculus (12–21),
 * Coordinate Geometry (22–26), Trigonometry (27–31), Vector Algebra (32–33).
 *
 * Heights and Distances + Properties of Triangles are trig topics — they land
 * on Trigonometric Ratios and Identities (no extra route). Mathematical
 * Reasoning is its own Algebra chapter (same idea as Communication System).
 * The leftover catalog row "Limits, Continuity and Differentiability" is not
 * a PDF chapter; 14 / 15 / 16 stay split.
 */
export const PYQ_MATH_PDF_CHAPTERS: readonly PdfChapterMapping[] = [
  { pdfChapterNo: 1, pdfChapterTitle: "Basic of Mathematics", catalogSlug: "basic-of-mathematics", note: "1:1 · Algebra" },
  { pdfChapterNo: 2, pdfChapterTitle: "Quadratic Equation", catalogSlug: "quadratic-equation", note: "1:1 · Algebra" },
  { pdfChapterNo: 3, pdfChapterTitle: "Complex Number", catalogSlug: "complex-number", note: "1:1 · Algebra" },
  { pdfChapterNo: 4, pdfChapterTitle: "Sequences and Series", catalogSlug: "sequences-and-series", note: "1:1 · Algebra" },
  { pdfChapterNo: 5, pdfChapterTitle: "Permutation Combination", catalogSlug: "permutation-combination", note: "1:1 · Algebra" },
  { pdfChapterNo: 6, pdfChapterTitle: "Binomial Theorem", catalogSlug: "binomial-theorem", note: "1:1 · Algebra" },
  { pdfChapterNo: 7, pdfChapterTitle: "Mathematical Reasoning", catalogSlug: "mathematical-reasoning", note: "New catalog chapter · Algebra" },
  { pdfChapterNo: 8, pdfChapterTitle: "Statistics", catalogSlug: "statistics", note: "1:1 · Algebra" },
  { pdfChapterNo: 9, pdfChapterTitle: "Matrices", catalogSlug: "matrices", note: "1:1 · Algebra" },
  { pdfChapterNo: 10, pdfChapterTitle: "Determinants", catalogSlug: "determinants", note: "1:1 · Algebra" },
  { pdfChapterNo: 11, pdfChapterTitle: "Probability", catalogSlug: "probability", note: "1:1 · Algebra" },
  { pdfChapterNo: 12, pdfChapterTitle: "Sets and Relations", catalogSlug: "sets-and-relations", note: "1:1 · Calculus" },
  { pdfChapterNo: 13, pdfChapterTitle: "Functions", catalogSlug: "functions", note: "1:1 · Calculus" },
  { pdfChapterNo: 14, pdfChapterTitle: "Limits", catalogSlug: "limits", note: "1:1 · Calculus" },
  { pdfChapterNo: 15, pdfChapterTitle: "Continuity and Differentiability", catalogSlug: "continuity-and-differentiability", note: "1:1 · Calculus" },
  { pdfChapterNo: 16, pdfChapterTitle: "Differentiation", catalogSlug: "differentiation", note: "1:1 · Calculus" },
  { pdfChapterNo: 17, pdfChapterTitle: "Application of Derivatives", catalogSlug: "application-of-derivatives", note: "1:1 · Calculus" },
  { pdfChapterNo: 18, pdfChapterTitle: "Indefinite Integration", catalogSlug: "indefinite-integration", note: "1:1 · Calculus" },
  { pdfChapterNo: 19, pdfChapterTitle: "Definite Integration", catalogSlug: "definite-integration", note: "1:1 · Calculus" },
  { pdfChapterNo: 20, pdfChapterTitle: "Area Under Curves", catalogSlug: "area-under-curves", note: "1:1 · Calculus" },
  { pdfChapterNo: 21, pdfChapterTitle: "Differential Equations", catalogSlug: "differential-equations", note: "1:1 · Calculus" },
  { pdfChapterNo: 22, pdfChapterTitle: "Straight Lines", catalogSlug: "straight-lines", note: "1:1 · Coordinate Geometry" },
  { pdfChapterNo: 23, pdfChapterTitle: "Circle", catalogSlug: "circle", note: "1:1 · Coordinate Geometry" },
  { pdfChapterNo: 24, pdfChapterTitle: "Parabola", catalogSlug: "parabola", note: "1:1 · Coordinate Geometry" },
  { pdfChapterNo: 25, pdfChapterTitle: "Ellipse", catalogSlug: "ellipse", note: "1:1 · Coordinate Geometry" },
  { pdfChapterNo: 26, pdfChapterTitle: "Hyperbola", catalogSlug: "hyperbola", note: "1:1 · Coordinate Geometry" },
  { pdfChapterNo: 27, pdfChapterTitle: "Trigonometric Ratios & Identities", catalogSlug: "trigonometric-ratios-and-identities", note: "Rename · Trigonometry" },
  { pdfChapterNo: 28, pdfChapterTitle: "Trigonometric Equations", catalogSlug: "trigonometric-equations", note: "1:1 · Trigonometry" },
  { pdfChapterNo: 29, pdfChapterTitle: "Inverse Trigonometric Functions", catalogSlug: "inverse-trigonometric-functions", note: "1:1 · Trigonometry" },
  { pdfChapterNo: 30, pdfChapterTitle: "Heights and Distances", catalogSlug: "trigonometric-ratios-and-identities", note: "Becomes a topic · Trigonometry" },
  { pdfChapterNo: 31, pdfChapterTitle: "Properties of Triangles", catalogSlug: "trigonometric-ratios-and-identities", note: "Becomes a topic · Trigonometry" },
  { pdfChapterNo: 32, pdfChapterTitle: "Vector Algebra", catalogSlug: "vector-algebra", note: "1:1 · Vector Algebra" },
  { pdfChapterNo: 33, pdfChapterTitle: "Three Dimensional Geometry", catalogSlug: "three-dimensional-geometry", note: "1:1 · Vector Algebra" },
];

export const PYQ_DEFERRED_PDF_CHAPTERS: readonly number[] = PYQ_PHYSICS_PDF_CHAPTERS.filter(
  (row) => row.catalogSlug === null
).map((row) => row.pdfChapterNo);

export function catalogSlugForPdfChapter(pdfChapterNo: number): string | null {
  return (
    PYQ_PHYSICS_PDF_CHAPTERS.find((row) => row.pdfChapterNo === pdfChapterNo)?.catalogSlug ?? null
  );
}

/** Every Physics PDF chapter whose questions render on this catalog chapter's page, in PDF order. */
export function pdfChaptersForCatalogSlug(catalogSlug: string): PdfChapterMapping[] {
  return PYQ_PHYSICS_PDF_CHAPTERS.filter((row) => row.catalogSlug === catalogSlug);
}

export function isPyqSourcedCatalogSlug(catalogSlug: string): boolean {
  return (
    pdfChaptersForCatalogSlug(catalogSlug).length > 0 ||
    mathPdfChaptersForCatalogSlug(catalogSlug).length > 0
  );
}

export function catalogSlugForMathPdfChapter(pdfChapterNo: number): string | null {
  return (
    PYQ_MATH_PDF_CHAPTERS.find((row) => row.pdfChapterNo === pdfChapterNo)?.catalogSlug ?? null
  );
}

export function mathPdfChaptersForCatalogSlug(catalogSlug: string): PdfChapterMapping[] {
  return PYQ_MATH_PDF_CHAPTERS.filter((row) => row.catalogSlug === catalogSlug);
}
