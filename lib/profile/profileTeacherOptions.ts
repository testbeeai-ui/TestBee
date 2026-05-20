/** Teacher onboarding / profile: teaching level chips map to `profiles.teaching_levels` integers. */
export const TEACHER_TEACHING_LEVELS = ["School", "College"] as const;
export type TeacherTeachingLevel = (typeof TEACHER_TEACHING_LEVELS)[number];

export const TEACHER_TEACHING_LEVEL_TO_NUMBER: Record<TeacherTeachingLevel, number> = {
  School: 1,
  College: 2,
};

/** Stored on `profiles.exam_tags` (string[]). */
export const TEACHER_EXAM_TAGS = ["CBSE", "JEE", "JEE Mains", "JEE Advanced", "NEET"] as const;
export type TeacherExamTag = (typeof TEACHER_EXAM_TAGS)[number];

export function decodeTeachingLevelNumbers(
  levels: number[] | null | undefined
): TeacherTeachingLevel[] {
  if (!levels?.length) return [];
  const hasSchool = levels.includes(1);
  const hasCollege = levels.includes(2);
  const out: TeacherTeachingLevel[] = [];
  if (hasSchool) out.push("School");
  if (hasCollege) out.push("College");
  return out;
}

export function encodeTeachingLevelLabels(labels: string[]): number[] {
  const nums = labels
    .map((l) => TEACHER_TEACHING_LEVEL_TO_NUMBER[l as TeacherTeachingLevel])
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  return [...new Set(nums)].sort((a, b) => a - b);
}

export function formatTeachingLevelsForDisplay(levels: number[] | null | undefined): string {
  const labels = decodeTeachingLevelNumbers(levels);
  return labels.length ? labels.join(", ") : "—";
}
