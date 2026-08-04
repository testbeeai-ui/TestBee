/**
 * Illustrative chapter exam weightage (JEE/KCET blended).
 * Fuzzy-matched against Supabase chapter titles; fallback ~7%.
 */

import type { Subject } from "@/types";

type ClassKey = "XI" | "XII";

const CHAPTER_WEIGHTAGE: Record<
  "Physics" | "Chemistry" | "Mathematics",
  Record<ClassKey, Record<string, number>>
> = {
  Physics: {
    XI: {
      "Units & Measurement": 4,
      "Motion in a Straight Line": 6,
      "Laws of Motion": 9,
      "Work, Energy & Power": 7,
      Gravitation: 8,
      Thermodynamics: 10,
      Oscillations: 6,
    },
    XII: {
      Electrostatics: 9,
      "Current Electricity": 8,
      "Magnetic Effects of Current": 7,
      "Electromagnetic Induction": 6,
      "Ray Optics": 8,
      "Dual Nature of Matter": 5,
      Nuclei: 5,
    },
  },
  Chemistry: {
    XI: {
      "Some Basic Concepts": 5,
      "Structure of Atom": 7,
      "States of Matter": 5,
      Thermodynamics: 9,
      Equilibrium: 8,
      "Redox Reactions": 6,
      Hydrocarbons: 7,
    },
    XII: {
      Solutions: 6,
      Electrochemistry: 7,
      "Chemical Kinetics": 7,
      "d & f Block Elements": 6,
      "Coordination Compounds": 8,
      "Aldehydes, Ketones & Acids": 7,
      Biomolecules: 5,
    },
  },
  Mathematics: {
    XI: {
      "Sets & Relations": 4,
      "Trigonometric Functions": 7,
      "Complex Numbers": 6,
      "Sequences & Series": 6,
      "Straight Lines": 6,
      "Limits & Derivatives": 8,
      Probability: 7,
    },
    XII: {
      "Relations & Functions": 5,
      Matrices: 6,
      Determinants: 5,
      "Continuity & Differentiability": 8,
      "Application of Derivatives": 8,
      Integrals: 9,
      "Vectors & 3D Geometry": 7,
    },
  },
};

const SUBJECT_LABEL: Record<Subject, keyof typeof CHAPTER_WEIGHTAGE> = {
  physics: "Physics",
  chemistry: "Chemistry",
  math: "Mathematics",
};

const DEFAULT_CHAPTER_WEIGHT = 7;

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function classKey(classLevel: 11 | 12): ClassKey {
  return classLevel === 11 ? "XI" : "XII";
}

/** Resolve illustrative chapter weightage % (integer). */
export function getChapterWeightagePercent(
  subject: Subject,
  classLevel: 11 | 12,
  chapterTitle: string
): number {
  const bucket = CHAPTER_WEIGHTAGE[SUBJECT_LABEL[subject]][classKey(classLevel)];
  const needle = normalizeKey(chapterTitle);
  if (!needle) return DEFAULT_CHAPTER_WEIGHT;

  for (const [name, pct] of Object.entries(bucket)) {
    const key = normalizeKey(name);
    if (key === needle || key.includes(needle) || needle.includes(key)) {
      return pct;
    }
  }
  return DEFAULT_CHAPTER_WEIGHT;
}

export function displayClassLabel(classLevel: 11 | 12): ClassKey {
  return classKey(classLevel);
}

export function displaySubjectLabel(subject: Subject): string {
  return SUBJECT_LABEL[subject];
}
