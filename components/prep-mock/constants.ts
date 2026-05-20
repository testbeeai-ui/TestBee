import { questions as questionBank } from "@/data/questions";
import type { Subject } from "@/types";

export const QUICK_DURATIONS = [60, 90, 180] as const;

/* ── MCQ Chapter Data ──────────────────────────────────────── */

export type McqChapter = { id: string; name: string };
export type McqSubjectChapters = Record<Subject, McqChapter[]>;
export type McqClassChapters = Record<11 | 12, McqSubjectChapters>;

/** CBSE chapter placeholders for MCQ practice. */
export const MCQ_CHAPTERS: McqClassChapters = {
  11: {
    physics: [
      { id: "p11-1", name: "Physical World" },
      { id: "p11-2", name: "Units and Measurements" },
      { id: "p11-3", name: "Motion in a Straight Line" },
      { id: "p11-4", name: "Motion in a Plane" },
      { id: "p11-5", name: "Laws of Motion" },
      { id: "p11-6", name: "Work, Energy and Power" },
      { id: "p11-7", name: "System of Particles and Rotational Motion" },
      { id: "p11-8", name: "Gravitation" },
      { id: "p11-9", name: "Mechanical Properties of Solids" },
      { id: "p11-10", name: "Mechanical Properties of Fluids" },
      { id: "p11-11", name: "Thermal Properties of Matter" },
      { id: "p11-12", name: "Thermodynamics" },
      { id: "p11-13", name: "Kinetic Theory" },
      { id: "p11-14", name: "Oscillations" },
      { id: "p11-15", name: "Waves" },
    ],
    chemistry: [
      { id: "c11-1", name: "Some Basic Concepts of Chemistry" },
      { id: "c11-2", name: "Structure of Atom" },
      { id: "c11-3", name: "Classification of Elements and Periodicity" },
      { id: "c11-4", name: "Chemical Bonding and Molecular Structure" },
      { id: "c11-5", name: "States of Matter" },
      { id: "c11-6", name: "Thermodynamics" },
      { id: "c11-7", name: "Equilibrium" },
      { id: "c11-8", name: "Redox Reactions" },
      { id: "c11-9", name: "Hydrogen" },
      { id: "c11-10", name: "The s-Block Elements" },
      { id: "c11-11", name: "The p-Block Elements" },
      { id: "c11-12", name: "Organic Chemistry – Basic Principles" },
      { id: "c11-13", name: "Hydrocarbons" },
      { id: "c11-14", name: "Environmental Chemistry" },
    ],
    math: [
      { id: "m11-1", name: "Sets" },
      { id: "m11-2", name: "Relations and Functions" },
      { id: "m11-3", name: "Trigonometric Functions" },
      { id: "m11-4", name: "Principle of Mathematical Induction" },
      { id: "m11-5", name: "Complex Numbers and Quadratic Equations" },
      { id: "m11-6", name: "Linear Inequalities" },
      { id: "m11-7", name: "Permutations and Combinations" },
      { id: "m11-8", name: "Binomial Theorem" },
      { id: "m11-9", name: "Sequences and Series" },
      { id: "m11-10", name: "Straight Lines" },
      { id: "m11-11", name: "Conic Sections" },
      { id: "m11-12", name: "Introduction to 3D Geometry" },
      { id: "m11-13", name: "Limits and Derivatives" },
      { id: "m11-14", name: "Mathematical Reasoning" },
      { id: "m11-15", name: "Statistics" },
      { id: "m11-16", name: "Probability" },
    ],
  },
  12: {
    physics: [
      { id: "p12-1", name: "Electric Charges and Fields" },
      { id: "p12-2", name: "Electrostatic Potential and Capacitance" },
      { id: "p12-3", name: "Current Electricity" },
      { id: "p12-4", name: "Moving Charges and Magnetism" },
      { id: "p12-5", name: "Magnetism and Matter" },
      { id: "p12-6", name: "Electromagnetic Induction" },
      { id: "p12-7", name: "Alternating Current" },
      { id: "p12-8", name: "Electromagnetic Waves" },
      { id: "p12-9", name: "Ray Optics and Optical Instruments" },
      { id: "p12-10", name: "Wave Optics" },
      { id: "p12-11", name: "Dual Nature of Radiation and Matter" },
      { id: "p12-12", name: "Atoms" },
      { id: "p12-13", name: "Nuclei" },
      {
        id: "p12-14",
        name: "Semiconductor Electronics: Materials, Devices and Simple Circuits",
      },
      { id: "p12-15", name: "Communication Systems" },
    ],
    chemistry: [
      { id: "c12-1", name: "The Solid State" },
      { id: "c12-2", name: "Solutions" },
      { id: "c12-3", name: "Electrochemistry" },
      { id: "c12-4", name: "Chemical Kinetics" },
      { id: "c12-5", name: "Surface Chemistry" },
      { id: "c12-6", name: "General Principles of Isolation of Elements" },
      { id: "c12-7", name: "The p-Block Elements" },
      { id: "c12-8", name: "The d- and f-Block Elements" },
      { id: "c12-9", name: "Coordination Compounds" },
      { id: "c12-10", name: "Haloalkanes and Haloarenes" },
      { id: "c12-11", name: "Alcohols, Phenols and Ethers" },
      { id: "c12-12", name: "Aldehydes, Ketones and Carboxylic Acids" },
      { id: "c12-13", name: "Amines" },
      { id: "c12-14", name: "Biomolecules" },
      { id: "c12-15", name: "Polymers" },
      { id: "c12-16", name: "Chemistry in Everyday Life" },
    ],
    math: [
      { id: "m12-1", name: "Relations and Functions" },
      { id: "m12-2", name: "Inverse Trigonometric Functions" },
      { id: "m12-3", name: "Matrices" },
      { id: "m12-4", name: "Determinants" },
      { id: "m12-5", name: "Continuity and Differentiability" },
      { id: "m12-6", name: "Application of Derivatives" },
      { id: "m12-7", name: "Integrals" },
      { id: "m12-8", name: "Application of Integrals" },
      { id: "m12-9", name: "Differential Equations" },
      { id: "m12-10", name: "Vector Algebra" },
      { id: "m12-11", name: "Three Dimensional Geometry" },
      { id: "m12-12", name: "Linear Programming" },
      { id: "m12-13", name: "Probability" },
    ],
  },
};

export function estimateQuickQuestionCount(
  subjects: Subject[],
  classLevel: number,
  durationMin: number
): number {
  const eligible = questionBank.filter(
    (q) => subjects.includes(q.subject) && q.classLevel <= classLevel
  ).length;
  return Math.max(1, Math.min(Math.ceil(durationMin / 2.5), eligible || 1));
}

/** Dashboard spotlight — matches `scripts/import-jee-main-mock-csv.ts` slug. */
export const FEATURED_DASHBOARD_PYQ_SLUG = "jee-main-2019-01-10-shift-1";

export const subjectEmojis: Record<Subject, string> = {
  physics: "⚡",
  chemistry: "🧪",
  math: "📐",
};

/** Display labels for subject keys (MCQ browser, quick mock, etc.). */
export const SUBJECT_LABELS: Record<Subject, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  math: "Mathematics",
};
