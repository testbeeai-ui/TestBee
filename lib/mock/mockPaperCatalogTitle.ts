/** First 4-digit year (20xx) found in tag strings — e.g. "JEE Mock Papers 2024". */
export function yearFromCatalogTags(tags: string[]): string | null {
  for (const t of tags) {
    const m = t.match(/\b(20\d{2})\b/);
    if (m) return m[1]!;
  }
  return null;
}

function stripExamPrefixFromSetName(exam: string, examSetName: string): string {
  let setPart = examSetName.trim();
  const ex = exam.trim();
  if (ex && setPart.toLowerCase().startsWith(ex.toLowerCase())) {
    setPart = setPart
      .slice(ex.length)
      .replace(/^[\s—\-–·|:]+/i, "")
      .trim();
  }
  return setPart;
}

/** Build DB / UI title for mock imports: `JEE Main 2024 — Mock Paper 10` (no duplicated exam name). */
export function buildMockPaperCatalogTitle(
  examName: string,
  examTypeName: string,
  examSetName: string
): string {
  const exam = examName.trim() || "JEE Main";
  const year =
    yearFromCatalogTags([examTypeName.trim()]) ?? examTypeName.match(/\b(20\d{2})\b/)?.[1] ?? null;
  const setPart =
    stripExamPrefixFromSetName(exam, examSetName.trim()) || examSetName.trim() || "Mock paper";
  if (year) return `${exam} ${year} — ${setPart}`;
  return `${exam} — ${setPart}`;
}

/** Derive readable catalog title from Supabase row (fixes legacy `JEE Main — JEE Main - Mock Paper n`). */
export function displayTitleFromMockPaperRow(row: {
  title: string;
  exam_name: string | null;
  exam_set_name: string | null;
  tags: string[] | null;
}): string {
  const exam = (row.exam_name ?? "").trim() || "JEE Main";
  let setName = stripExamPrefixFromSetName(exam, (row.exam_set_name ?? "").trim());
  if (!setName) {
    const raw = (row.title ?? "").trim();
    const afterDash = raw.match(/[—–-]\s*(.+)$/u);
    setName = afterDash ? afterDash[1]!.trim() : raw;
  }
  const year =
    yearFromCatalogTags(row.tags ?? []) ?? (row.title ?? "").match(/\b(20\d{2})\b/)?.[1] ?? null;
  if (year) return `${exam} ${year} — ${setName}`;
  return `${exam} — ${setName}`;
}
