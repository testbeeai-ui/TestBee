export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function toGradeSlug(classLevel: number): string {
  return `class-${classLevel}`;
}

export function parseGradeSlug(grade: string): number | null {
  const m = grade.match(/^class-(\d+)$/);
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  return n >= 11 && n <= 12 ? n : null;
}

/** Mobile lesson route segments (maps to app/lesson/[...path]) */
export function buildLessonPathSegments(
  subject: string,
  classLevel: number,
  topicName: string,
  subtopicName?: string
): string[] {
  const board = "cbse";
  const grade = toGradeSlug(classLevel);
  const topicSlug = slugify(topicName);
  if (subtopicName) {
    const subSlug = slugify(subtopicName.slice(0, 120));
    return [board, subject, grade, topicSlug, subSlug, "basics"];
  }
  return [board, subject, grade, topicSlug, "overview", "basics"];
}
