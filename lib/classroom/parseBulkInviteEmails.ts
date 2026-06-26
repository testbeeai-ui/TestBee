const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Split pasted text or CSV-ish content into normalized unique emails (max cap). */
export function parseBulkInviteEmails(raw: string, max = 200): string[] {
  const parts = raw
    .split(/[\s,;|\n\r\t]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const email = part.replace(/^["']|["']$/g, "");
    if (!EMAIL_RE.test(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
    if (out.length >= max) break;
  }
  return out;
}
