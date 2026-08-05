/** Short plain-text line for student-facing UI; never embed full exam booklet HTML. */
export const DEFAULT_JEE_MAIN_MOCK_MARKING =
  "+4 for each correct response, −1 for each incorrect response, 0 if unattempted (JEE Main pattern).";

export const DEFAULT_COMEDK_MOCK_MARKING =
  "+1 per correct response, 0 for incorrect or unattempted (COMEDK UGET pattern).";

/** Resolve catalog marking text from canonical exam_name. */
export function markingSchemeForExamName(examName: string): string {
  const exam = examName.trim().toLowerCase();
  if (exam === "comedk") return DEFAULT_COMEDK_MOCK_MARKING;
  if (exam === "kcet") {
    return "+1 per correct response, 0 for incorrect or unattempted (KCET pattern).";
  }
  if (exam === "bitsat") {
    return "+3 for each correct response, −1 for each incorrect response, 0 if unattempted (BITSAT pattern).";
  }
  return DEFAULT_JEE_MAIN_MOCK_MARKING;
}

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
