/**
 * URL slug utilities for the learning path routes.
 * Converts display names to URL-safe segments, e.g. "First law of thermodynamics" -> "first-law-of-thermodynamics"
 */

/** Convert a display string to a URL-friendly slug (lowercase, hyphens, no special chars). */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Parse grade segment (e.g. "class-11") to ClassLevel 11. Returns null if invalid. */
export function parseGradeSlug(grade: string): number | null {
  const m = grade.match(/^class-(\d+)$/);
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  return n >= 11 && n <= 12 ? n : null;
}

/** Build grade segment from ClassLevel, e.g. 11 -> "class-11". */
export function toGradeSlug(classLevel: number): string {
  return `class-${classLevel}`;
}

export type DifficultyLevel = 'basics' | 'intermediate' | 'advanced';

/** Validate level segment. */
export function isValidLevel(level: string): level is DifficultyLevel {
  return level === 'basics' || level === 'intermediate' || level === 'advanced';
}
