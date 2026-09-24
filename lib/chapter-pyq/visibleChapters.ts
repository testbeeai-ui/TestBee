/**
 * Student /chapter-pyq question allowlist (Mathematics only).
 * All chapter cards stay on the grid. Locked chapters show 0 / 0 and do not load questions.
 *
 * Unblock every math chapter: set this to [].
 */
/**
 * Student /chapter-pyq question allowlist (Mathematics only).
 * All chapter cards stay on the grid. Locked chapters show 0 / 0 and do not load questions.
 *
 * Unblock every math chapter: set this to [].
 */
export const CHAPTER_PYQ_VISIBLE_MATH_SLUGS: readonly string[] = [];

export function isChapterPyqStudentVisible(subject: string, slug: string): boolean {
  if (subject !== "math") return true;
  if (CHAPTER_PYQ_VISIBLE_MATH_SLUGS.length === 0) return true;
  return CHAPTER_PYQ_VISIBLE_MATH_SLUGS.includes(slug);
}

export function publishedCountForStudent(
  subject: string,
  slug: string,
  live: number | undefined,
): number {
  if (!isChapterPyqStudentVisible(subject, slug)) return 0;
  return typeof live === "number" && Number.isFinite(live) && live > 0 ? live : 0;
}
