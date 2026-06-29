import { makeSubtopicEngagementStorageKey } from "@/lib/curriculum/subtopicEngagementStorageKey";
import { isValidLevel } from "@/lib/slugs";

const SUBJECTS = new Set(["physics", "chemistry", "math"]);

function normalizeMatchPart(value: unknown, maxLen = 300): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen)
    .toLowerCase();
}

/** Row from `student_lesson_mark_completions` (written by subtopic-engagement API). */
export type StudentLessonMarkCompletionRow = {
  board: string;
  subject: string;
  class_level: number;
  topic: string;
  subtopic: string;
  level: string;
  marked_complete_at?: string | null;
};

export type ChapterQuizRefLite = {
  board: string;
  subject: "physics" | "chemistry" | "math";
  classLevel: 11 | 12;
  topic: string;
  subtopicName: string;
  level: "basics" | "intermediate" | "advanced";
};

/** Same field contract as posts.content_json.chapterQuiz (quiz + Concept Focus). */
export function parseChapterQuizRefFromContentJson(
  contentJson: unknown
): ChapterQuizRefLite | null {
  if (!contentJson || typeof contentJson !== "object" || Array.isArray(contentJson)) return null;
  const payload = contentJson as Record<string, unknown>;
  const raw = payload.chapterQuiz;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const board = typeof o.board === "string" ? o.board.trim().toLowerCase() : "cbse";
  const subject = typeof o.subject === "string" ? o.subject.trim().toLowerCase() : "";
  if (!SUBJECTS.has(subject)) return null;
  const classLevel = Number(o.classLevel);
  if (classLevel !== 11 && classLevel !== 12) return null;
  const topic = typeof o.topic === "string" ? o.topic.trim() : "";
  const subtopicName = typeof o.subtopicName === "string" ? o.subtopicName.trim() : "";
  const levelRaw = typeof o.level === "string" ? o.level.trim().toLowerCase() : "";
  if (!topic || !subtopicName || !isValidLevel(levelRaw)) return null;
  return {
    board: board || "cbse",
    subject: subject as ChapterQuizRefLite["subject"],
    classLevel: classLevel as 11 | 12,
    topic,
    subtopicName,
    level: levelRaw,
  };
}

export function engagementKeyForConceptFocusChapterQuiz(ref: ChapterQuizRefLite): string {
  return makeSubtopicEngagementStorageKey({
    board: ref.board.toLowerCase() === "icse" ? "ICSE" : "CBSE",
    subject: ref.subject,
    classLevel: ref.classLevel,
    topic: ref.topic,
    subtopicName: ref.subtopicName,
    level: ref.level,
  });
}

/** ISO-ish timestamp string from `lessonChecklistMarkedCompleteAt`, if set for this assignment's subtopic. */
export function getConceptFocusLessonMarkedAtIso(
  subtopicEngagementColumn: unknown,
  contentJson: unknown
): string | null {
  const ref = parseChapterQuizRefFromContentJson(contentJson);
  if (!ref) return null;
  const store = subtopicEngagementColumn;
  if (!store || typeof store !== "object" || Array.isArray(store)) return null;
  const key = engagementKeyForConceptFocusChapterQuiz(ref);
  const snap = (store as Record<string, unknown>)[key];
  if (!snap || typeof snap !== "object" || Array.isArray(snap)) return null;
  const markedAt = String(
    (snap as Record<string, unknown>).lessonChecklistMarkedCompleteAt ?? ""
  ).trim();
  return markedAt || null;
}

export function chapterQuizMatchesLessonMark(
  ref: ChapterQuizRefLite,
  mark: StudentLessonMarkCompletionRow
): boolean {
  const boardNorm = ref.board.toLowerCase() === "icse" ? "icse" : "cbse";
  return (
    normalizeMatchPart(mark.board, 40) === boardNorm &&
    normalizeMatchPart(mark.subject, 80) === ref.subject &&
    Number(mark.class_level) === ref.classLevel &&
    normalizeMatchPart(mark.topic) === normalizeMatchPart(ref.topic) &&
    normalizeMatchPart(mark.subtopic) === normalizeMatchPart(ref.subtopicName) &&
    normalizeMatchPart(mark.level, 30) === ref.level
  );
}

/** ISO timestamp from normalized `student_lesson_mark_completions` rows. */
export function getConceptFocusLessonMarkedAtFromLessonMarks(
  marks: StudentLessonMarkCompletionRow[] | undefined | null,
  contentJson: unknown
): string | null {
  const ref = parseChapterQuizRefFromContentJson(contentJson);
  if (!ref || !marks?.length) return null;
  let best: string | null = null;
  for (const mark of marks) {
    if (!chapterQuizMatchesLessonMark(ref, mark)) continue;
    const at = String(mark.marked_complete_at ?? "").trim();
    if (!at) continue;
    if (!best) {
      best = at;
      continue;
    }
    const a = new Date(at).getTime();
    const b = new Date(best).getTime();
    if (!Number.isNaN(a) && (Number.isNaN(b) || a >= b)) best = at;
  }
  return best;
}

/** True when the student saved "Mark as complete" for this subtopic (profiles.subtopic_engagement). */
export function isConceptFocusLessonChecklistComplete(
  subtopicEngagementColumn: unknown,
  contentJson: unknown,
  lessonMarks?: StudentLessonMarkCompletionRow[] | null
): boolean {
  return Boolean(
    getConceptFocusLessonMarkedAtIso(subtopicEngagementColumn, contentJson) ||
      getConceptFocusLessonMarkedAtFromLessonMarks(lessonMarks, contentJson)
  );
}
