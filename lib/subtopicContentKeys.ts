/**
 * Canonical string normalization for subtopic_content row keys.
 * Must match GET /api/subtopic-content parsing — no truncation, or writes and reads can target different rows.
 */
export function normalizeSubtopicContentKey(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\x00-\x1F\x7F]/g, " ").replace(/\s+/g, " ").trim();
}

/** Subject is stored lowercase everywhere agent routes persist (see generate-* routes). */
export function normalizeSubjectKey(value: unknown): string {
  return normalizeSubtopicContentKey(value).toLowerCase();
}
