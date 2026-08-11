/**
 * Public Student ID shared across EduBlast / Edubite / EduDeca.
 * Format (DB-allocated, random): EB-{YY}{L}{D}{L}{D}{L}{D}
 * Example: EB-26K7M2Q9
 * - YY = IST signup year (26, 27, …)
 * - then random alternating letter + digit (unique; not sequential)
 */
const STUDENT_CODE_RE = /^EB-\d{2}([A-Z]\d){3}$/;

export function normalizeStudentCode(
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  if (!STUDENT_CODE_RE.test(trimmed)) return null;
  return trimmed;
}

/** Prefer stored profiles.student_code. */
export function formatStudentId(
  studentCode: string | null | undefined,
): string | null {
  return normalizeStudentCode(studentCode);
}
