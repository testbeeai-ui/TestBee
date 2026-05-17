/** Same URL cleanup as counselling wizard — http(s) links only. */
export function normalizeTeacherMotivationExternalUrl(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  while (s.startsWith("/")) s = s.slice(1);
  const httpIdx = s.indexOf("http");
  if (httpIdx > 0) s = s.slice(httpIdx);
  if (/^https\/\//i.test(s) === false && /^https\//i.test(s)) {
    s = s.replace(/^https\//i, "https://");
  }
  if (/^http\/\//i.test(s) === false && /^http\//i.test(s)) {
    s = s.replace(/^http\//i, "http://");
  }
  if (/^https:\/\//i.test(s) === false && /^https:/i.test(s)) {
    s = s.replace(/^https:/i, "https://");
  }
  if (/^http:\/\//i.test(s) === false && /^http:/i.test(s)) {
    s = s.replace(/^http:/i, "http://");
  }
  if (/^www\./i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function defaultDueDateIsoDaysAhead(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
