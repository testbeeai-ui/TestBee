/** Short plain-text line for student-facing UI; never embed full exam booklet HTML. */
export const DEFAULT_JEE_MAIN_MOCK_MARKING =
  "+4 for each correct response, −1 for each incorrect response, 0 if unattempted (JEE Main pattern).";

/**
 * Strip legacy imports that stored `essInstruction` HTML in `marking_scheme`.
 * Students already see structure/timing in NTA-style instructions — catalog row should stay brief.
 */
export function normalizeMockMarkingSchemeForStudents(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return DEFAULT_JEE_MAIN_MOCK_MARKING;
  if (/Important Instructions/i.test(s)) return DEFAULT_JEE_MAIN_MOCK_MARKING;
  if (/<\s*p\b/i.test(s) || /<\s*strong\b/i.test(s)) return DEFAULT_JEE_MAIN_MOCK_MARKING;
  if (s.length > 280) return DEFAULT_JEE_MAIN_MOCK_MARKING;
  return s;
}
