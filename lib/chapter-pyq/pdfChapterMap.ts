/**
 * MathonGo JEE Main Physics PYQ book (32 chapters) → app catalog chapters.
 *
 * `catalogSlug` is deliberately many-to-one: several PDF chapters collapse onto
 * one catalog chapter and render on its single page. `null` means deferred —
 * no route, no page, no questions.
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
  { pdfChapterNo: 17, pdfChapterTitle: "Electrostatics", catalogSlug: "electric-charges-and-fields", note: "Rename — Capacitance is PDF chapter 18" },
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
 * MathonGo JEE Main 2025 January / April chapter-wise Mathematics bank (29 chapters)
 * → app catalog. One PDF chapter number = one catalog page. Do not use the 33-chapter
 * 2019–2025 compilation map here (that book inserts Mathematical Reasoning,
 * Differentiation, Heights and Distances, and Properties of Triangles and shifts
 * every later number).
 *
 * Question-page footers may shorten a TOC title (ch.25 prints "Trigonometric Ratios").
 * That is still chapter 25 — never merge it into another catalog slug.
 *
 * Catalog leftovers that are not in this PDF stay unsourced: Differentiation
 * and "Limits, Continuity and Differentiability". Heights and Distances and
 * Properties of Triangles are not catalog chapters.
 */
export const PYQ_MATH_PDF_CHAPTERS: readonly PdfChapterMapping[] = [
  { pdfChapterNo: 1, pdfChapterTitle: "Basic of Mathematics", catalogSlug: "basic-of-mathematics", note: "1:1 · Algebra" },
  { pdfChapterNo: 2, pdfChapterTitle: "Quadratic Equation", catalogSlug: "quadratic-equation", note: "1:1 · Algebra" },
  { pdfChapterNo: 3, pdfChapterTitle: "Complex Number", catalogSlug: "complex-number", note: "1:1 · Algebra" },
  { pdfChapterNo: 4, pdfChapterTitle: "Sequences and Series", catalogSlug: "sequences-and-series", note: "1:1 · Algebra" },
  { pdfChapterNo: 5, pdfChapterTitle: "Permutation Combination", catalogSlug: "permutation-combination", note: "1:1 · Algebra" },
  { pdfChapterNo: 6, pdfChapterTitle: "Binomial Theorem", catalogSlug: "binomial-theorem", note: "1:1 · Algebra" },
  { pdfChapterNo: 7, pdfChapterTitle: "Statistics", catalogSlug: "statistics", note: "1:1 · Algebra" },
  { pdfChapterNo: 8, pdfChapterTitle: "Matrices", catalogSlug: "matrices", note: "1:1 · Algebra" },
  { pdfChapterNo: 9, pdfChapterTitle: "Determinants", catalogSlug: "determinants", note: "1:1 · Algebra" },
  { pdfChapterNo: 10, pdfChapterTitle: "Probability", catalogSlug: "probability", note: "1:1 · Algebra" },
  { pdfChapterNo: 11, pdfChapterTitle: "Sets and Relations", catalogSlug: "sets-and-relations", note: "1:1 · Calculus" },
  { pdfChapterNo: 12, pdfChapterTitle: "Functions", catalogSlug: "functions", note: "1:1 · Calculus" },
  { pdfChapterNo: 13, pdfChapterTitle: "Limits", catalogSlug: "limits", note: "1:1 · Calculus" },
  { pdfChapterNo: 14, pdfChapterTitle: "Continuity and Differentiability", catalogSlug: "continuity-and-differentiability", note: "1:1 · Calculus" },
  { pdfChapterNo: 15, pdfChapterTitle: "Application of Derivatives", catalogSlug: "application-of-derivatives", note: "1:1 · Calculus" },
  { pdfChapterNo: 16, pdfChapterTitle: "Indefinite Integration", catalogSlug: "indefinite-integration", note: "1:1 · Calculus" },
  { pdfChapterNo: 17, pdfChapterTitle: "Definite Integration", catalogSlug: "definite-integration", note: "1:1 · Calculus" },
  { pdfChapterNo: 18, pdfChapterTitle: "Area Under Curves", catalogSlug: "area-under-curves", note: "1:1 · Calculus" },
  { pdfChapterNo: 19, pdfChapterTitle: "Differential Equations", catalogSlug: "differential-equations", note: "1:1 · Calculus" },
  { pdfChapterNo: 20, pdfChapterTitle: "Straight Lines", catalogSlug: "straight-lines", note: "1:1 · Coordinate Geometry" },
  { pdfChapterNo: 21, pdfChapterTitle: "Circle", catalogSlug: "circle", note: "1:1 · Coordinate Geometry" },
  { pdfChapterNo: 22, pdfChapterTitle: "Parabola", catalogSlug: "parabola", note: "1:1 · Coordinate Geometry" },
  { pdfChapterNo: 23, pdfChapterTitle: "Ellipse", catalogSlug: "ellipse", note: "1:1 · Coordinate Geometry" },
  { pdfChapterNo: 24, pdfChapterTitle: "Hyperbola", catalogSlug: "hyperbola", note: "1:1 · Coordinate Geometry" },
  { pdfChapterNo: 25, pdfChapterTitle: "Trigonometric Ratios & Identities", catalogSlug: "trigonometric-ratios-and-identities", note: "1:1 · Trigonometry · footer may say Trigonometric Ratios" },
  { pdfChapterNo: 26, pdfChapterTitle: "Trigonometric Equations", catalogSlug: "trigonometric-equations", note: "1:1 · Trigonometry" },
  { pdfChapterNo: 27, pdfChapterTitle: "Inverse Trigonometric Functions", catalogSlug: "inverse-trigonometric-functions", note: "1:1 · Trigonometry" },
  { pdfChapterNo: 28, pdfChapterTitle: "Vector Algebra", catalogSlug: "vector-algebra", note: "1:1 · Vector Algebra" },
  { pdfChapterNo: 29, pdfChapterTitle: "Three Dimensional Geometry", catalogSlug: "three-dimensional-geometry", note: "1:1 · Vector Algebra" },
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
    mathPdfChaptersForCatalogSlug(catalogSlug).length > 0 ||
    chemistryPdfChaptersForCatalogSlug(catalogSlug).length > 0
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

/**
 * MathonGo JEE Main 2025 January / April Chemistry bank (26 TOC titles)
 * → the 20 app chapters. Numbers are that booklet’s TOC, not the By Chapter
 * folder list. Folder names may say "and" where the footer says "&".
 *
 * `null` rows are printed in the 2025 key strip so the neighbor’s keys stay
 * intact. They are not app chapters. Do not add a route for them, and do not
 * source the older By Chapter folders that are absent from this TOC
 * (Hydrogen, s-Block, Environmental Chemistry, Solid State, Surface Chemistry,
 * Polymers, Isolation of Metals).
 *
 * Two printed titles share one app page: Chemical + Ionic Equilibrium;
 * both p-Block groups; Aldehydes and Ketones + Carboxylic Acid Derivatives.
 */
export const PYQ_CHEMISTRY_PDF_CHAPTERS: readonly PdfChapterMapping[] = [
  { pdfChapterNo: 1, pdfChapterTitle: "Some Basic Concepts of Chemistry", catalogSlug: "some-basic-concepts-of-chemistry", note: "1:1" },
  { pdfChapterNo: 2, pdfChapterTitle: "Structure of Atom", catalogSlug: "structure-of-atom", note: "1:1" },
  { pdfChapterNo: 3, pdfChapterTitle: "States of Matter", catalogSlug: null, note: "Printed in 2025. Not an app chapter" },
  { pdfChapterNo: 4, pdfChapterTitle: "Thermodynamics (C)", catalogSlug: "chemical-thermodynamics", note: "Rename. Not the physics Thermodynamics slug" },
  { pdfChapterNo: 5, pdfChapterTitle: "Chemical Equilibrium", catalogSlug: "equilibrium", note: "Merge-as-topic with ch.6" },
  { pdfChapterNo: 6, pdfChapterTitle: "Ionic Equilibrium", catalogSlug: "equilibrium", note: "Merge-as-topic with ch.5. No new route" },
  { pdfChapterNo: 7, pdfChapterTitle: "Redox Reactions", catalogSlug: "redox-reactions", note: "1:1" },
  { pdfChapterNo: 8, pdfChapterTitle: "Solutions", catalogSlug: "solutions", note: "1:1. Title is also a section word — match the footer line" },
  { pdfChapterNo: 9, pdfChapterTitle: "Electrochemistry", catalogSlug: "electrochemistry", note: "1:1" },
  { pdfChapterNo: 10, pdfChapterTitle: "Chemical Kinetics", catalogSlug: "chemical-kinetics", note: "1:1" },
  { pdfChapterNo: 11, pdfChapterTitle: "Classification of Elements and Periodicity in Properties", catalogSlug: "classification-of-elements-and-periodicity", note: "Rename" },
  { pdfChapterNo: 12, pdfChapterTitle: "Chemical Bonding and Molecular Structure", catalogSlug: "chemical-bonding-and-molecular-structure", note: "1:1" },
  { pdfChapterNo: 13, pdfChapterTitle: "p Block Elements (Group 13 & 14)", catalogSlug: "the-p-block-elements", note: "Merge-as-topic with ch.14. Footer may say and, or wrap after Group 13" },
  { pdfChapterNo: 14, pdfChapterTitle: "p Block Elements (Group 15, 16, 17 & 18)", catalogSlug: "the-p-block-elements", note: "Merge-as-topic with ch.13. No new route" },
  { pdfChapterNo: 15, pdfChapterTitle: "d and f Block Elements", catalogSlug: "the-d-and-f-block-elements", note: "Rename" },
  { pdfChapterNo: 16, pdfChapterTitle: "Coordination Compounds", catalogSlug: "coordination-compounds", note: "1:1" },
  { pdfChapterNo: 17, pdfChapterTitle: "Practical Chemistry", catalogSlug: null, note: "Printed through 2026. Not an app chapter" },
  { pdfChapterNo: 18, pdfChapterTitle: "General Organic Chemistry", catalogSlug: "organic-chemistry-basic-principles", note: "Rename" },
  { pdfChapterNo: 19, pdfChapterTitle: "Hydrocarbons", catalogSlug: "hydrocarbons", note: "1:1" },
  { pdfChapterNo: 20, pdfChapterTitle: "Haloalkanes and Haloarenes", catalogSlug: "haloalkanes-and-haloarenes", note: "1:1" },
  { pdfChapterNo: 21, pdfChapterTitle: "Alcohols Phenols and Ethers", catalogSlug: "alcohols-phenols-and-ethers", note: "Rename" },
  { pdfChapterNo: 22, pdfChapterTitle: "Aldehydes and Ketones", catalogSlug: "aldehydes-ketones-and-carboxylic-acids", note: "Merge-as-topic with ch.23" },
  { pdfChapterNo: 23, pdfChapterTitle: "Carboxylic Acid Derivatives", catalogSlug: "aldehydes-ketones-and-carboxylic-acids", note: "Merge-as-topic with ch.22. No new route" },
  { pdfChapterNo: 24, pdfChapterTitle: "Amines", catalogSlug: "amines", note: "1:1" },
  { pdfChapterNo: 25, pdfChapterTitle: "Biomolecules", catalogSlug: "biomolecules", note: "1:1" },
  { pdfChapterNo: 26, pdfChapterTitle: "Chemistry in Everyday Life", catalogSlug: null, note: "April 2025 only. Not an app chapter" },
];

export function catalogSlugForChemistryPdfChapter(pdfChapterNo: number): string | null {
  return (
    PYQ_CHEMISTRY_PDF_CHAPTERS.find((row) => row.pdfChapterNo === pdfChapterNo)?.catalogSlug ?? null
  );
}

export function chemistryPdfChaptersForCatalogSlug(catalogSlug: string): PdfChapterMapping[] {
  return PYQ_CHEMISTRY_PDF_CHAPTERS.filter((row) => row.catalogSlug === catalogSlug);
}
