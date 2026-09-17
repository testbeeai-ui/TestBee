import { slugify } from "@/lib/slugs";

export type ChapterPyqSubject = "physics" | "chemistry" | "math";

export type ChapterPyqEntry = {
  slug: string;
  name: string;
  subject: ChapterPyqSubject;
};

export const CHAPTER_PYQ_SUBJECTS: { id: ChapterPyqSubject; label: string }[] = [
  { id: "physics", label: "Physics" },
  { id: "chemistry", label: "Chemistry" },
  { id: "math", label: "Mathematics" },
];

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
  "Mathematical Reasoning",
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

const PHYSICS_NAMES = [
  "Units and Measurements",
  "Motion in a Straight Line",
  "Motion in a Plane",
  "Laws of Motion",
  "Work, Energy and Power",
  "System of Particles and Rotational Motion",
  "Gravitation",
  "Mechanical Properties of Solids",
  "Mechanical Properties of Fluids",
  "Thermal Properties of Matter",
  "Thermodynamics",
  "Kinetic Theory of Gases",
  "Oscillations",
  "Waves",
  "Electric Charges and Fields",
  "Electrostatic Potential and Capacitance",
  "Current Electricity",
  "Moving Charges and Magnetism",
  "Magnetism and Matter",
  "Electromagnetic Induction",
  "Alternating Current",
  "Electromagnetic Waves",
  "Ray Optics",
  "Wave Optics",
  "Dual Nature of Radiation and Matter",
  "Atoms",
  "Nuclei",
  "Semiconductor Electronics",
  "Communication System",
] as const;

const CHEMISTRY_NAMES = [
  "Some Basic Concepts of Chemistry",
  "Structure of Atom",
  "Classification of Elements and Periodicity",
  "Chemical Bonding and Molecular Structure",
  "Chemical Thermodynamics",
  "Equilibrium",
  "Redox Reactions",
  "The p-Block Elements",
  "The d- and f-Block Elements",
  "Coordination Compounds",
  "Organic Chemistry – Basic Principles",
  "Hydrocarbons",
  "Haloalkanes and Haloarenes",
  "Alcohols, Phenols and Ethers",
  "Aldehydes, Ketones and Carboxylic Acids",
  "Amines",
  "Biomolecules",
  "Solutions",
  "Electrochemistry",
  "Chemical Kinetics",
] as const;

function entries(subject: ChapterPyqSubject, names: readonly string[]): ChapterPyqEntry[] {
  return names.map((name) => ({ subject, name, slug: slugify(name) }));
}

export const CHAPTER_PYQ_CHAPTERS: ChapterPyqEntry[] = [
  ...entries("physics", PHYSICS_NAMES),
  ...entries("chemistry", CHEMISTRY_NAMES),
  ...entries("math", MATH_NAMES),
];

export function isChapterPyqSubject(value: string): value is ChapterPyqSubject {
  return value === "physics" || value === "chemistry" || value === "math";
}

export function chaptersForSubject(subject: ChapterPyqSubject): ChapterPyqEntry[] {
  return CHAPTER_PYQ_CHAPTERS.filter((c) => c.subject === subject);
}

export function findChapter(subject: string, slug: string): ChapterPyqEntry | null {
  if (!isChapterPyqSubject(subject)) return null;
  return CHAPTER_PYQ_CHAPTERS.find((c) => c.subject === subject && c.slug === slug) ?? null;
}

export function filterChapters(chapters: ChapterPyqEntry[], query: string): ChapterPyqEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return chapters;
  return chapters.filter((c) => c.name.toLowerCase().includes(needle));
}

export function chapterPyqHref(entry: ChapterPyqEntry): string {
  return `/chapter-pyq/${entry.subject}/${entry.slug}`;
}
