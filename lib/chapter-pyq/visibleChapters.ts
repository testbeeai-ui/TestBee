/**
 * Student /chapter-pyq question allowlist.
 * All chapter cards stay on the grid. Locked chapters show 0 / 0 and do not load questions.
 *
 * Unblock a subject: set its list to [].
 */

/** Mathematics: everything unlocked. */
export const CHAPTER_PYQ_VISIBLE_MATH_SLUGS: readonly string[] = [];

/**
 * Physics: only these chapters are released. The remaining chapters stay
 * on the grid as 0 / 0 "Coming soon" until their content is verified.
 */
export const CHAPTER_PYQ_VISIBLE_PHYSICS_SLUGS: readonly string[] = [
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
    ];

/** Coming soon until told to open. Delete a slug here to show that chapter. */
const PHYSICS_HOLD_BACK: readonly string[] = [];

function subjectAllowlist(subject: string): readonly string[] | null {
  if (subject === "math") return CHAPTER_PYQ_VISIBLE_MATH_SLUGS;
  if (subject === "physics") return CHAPTER_PYQ_VISIBLE_PHYSICS_SLUGS;
  return null;
}

export function isChapterPyqStudentVisible(subject: string, slug: string): boolean {
  const allowlist = subjectAllowlist(subject);
  if (allowlist === null) return true;
  if (allowlist.length === 0) return true;
  if (subject === "physics" && PHYSICS_HOLD_BACK.includes(slug)) return false;
  return allowlist.includes(slug);
}

export function publishedCountForStudent(
  subject: string,
  slug: string,
  live: number | undefined,
): number {
  if (!isChapterPyqStudentVisible(subject, slug)) return 0;
  return typeof live === "number" && Number.isFinite(live) && live > 0 ? live : 0;
}