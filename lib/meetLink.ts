/**
 * Normalize a meeting URL for href / storage (Google Meet, Zoom, etc.).
 * Accepts pasted values without a scheme (e.g. meet.google.com/xxx).
 */
export function normalizeMeetLink(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}
