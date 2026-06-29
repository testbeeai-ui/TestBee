/** UI copy for teacher-funded Concept Focus subtopic unlock. */

export const TEACHER_SUBTOPIC_UNLOCK_LABEL = "Subtopic unlock (per student)";

export const TEACHER_SUBTOPIC_UNLOCK_HELP =
  "Unlocks the full subtopic lesson for each targeted student (all panels and quiz sets for this assignment). Charged once at publish: amount × students. This is separate from optional completion rewards for students.";

export const STUDENT_SUBTOPIC_UNLOCK_MESSAGE =
  "Unlocked for this assignment — your teacher sponsored full access to this subtopic.";

export function formatSubtopicUnlockSummary(
  perStudent: number,
  studentCount: number
): { perStudent: number; total: number; studentCount: number } {
  const per = Number.isFinite(perStudent) ? Math.max(0, Math.round(perStudent)) : 0;
  const n = Math.max(0, Math.floor(studentCount));
  return {
    perStudent: per,
    studentCount: n,
    total: per > 0 ? per * n : 0,
  };
}
