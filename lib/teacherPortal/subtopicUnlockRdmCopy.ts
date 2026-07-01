/** UI copy for teacher-funded MCQ / subtopic sponsorship on assignments. */

export const TEACHER_SUBTOPIC_UNLOCK_LABEL = "MCQ unlock · free students";

export const TEACHER_SUBTOPIC_UNLOCK_HELP =
  "Starter and Pro already include question-bank MCQs — no fee for them. You pay rate × free students once at publish.";

export const STUDENT_SUBTOPIC_UNLOCK_MESSAGE =
  "Unlocked for this assignment — your teacher sponsored full access to this subtopic.";

export type McqSponsorshipSummary = {
  perStudent: number;
  billableStudentCount: number;
  premiumStudentCount: number;
  totalStudentCount: number;
  total: number;
};

export function formatMcqSponsorshipSummary(
  perStudent: number,
  billableStudentCount: number,
  options?: { premiumStudentCount?: number; totalStudentCount?: number }
): McqSponsorshipSummary {
  const per = Number.isFinite(perStudent) ? Math.max(0, Math.round(perStudent)) : 0;
  const billable = Math.max(0, Math.floor(billableStudentCount));
  const premium = Math.max(0, Math.floor(options?.premiumStudentCount ?? 0));
  const totalStudents = Math.max(
    billable + premium,
    Math.max(0, Math.floor(options?.totalStudentCount ?? billable + premium))
  );
  return {
    perStudent: per,
    billableStudentCount: billable,
    premiumStudentCount: premium,
    totalStudentCount: totalStudents,
    total: per > 0 ? per * billable : 0,
  };
}

/** @deprecated Use formatMcqSponsorshipSummary — kept for call sites passing total audience count. */
export function formatSubtopicUnlockSummary(
  perStudent: number,
  studentCount: number
): { perStudent: number; total: number; studentCount: number } {
  const summary = formatMcqSponsorshipSummary(perStudent, studentCount, {
    totalStudentCount: studentCount,
  });
  return {
    perStudent: summary.perStudent,
    studentCount: summary.billableStudentCount,
    total: summary.total,
  };
}
