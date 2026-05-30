import { makeSubtopicEngagementStorageKey } from "@/lib/curriculum/subtopicEngagementStorageKey";
import { isValidLevel } from "@/lib/slugs";

const SUBJECTS = new Set(["physics", "chemistry", "math"]);

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

/** True when the student saved "Mark as complete" for this subtopic (profiles.subtopic_engagement). */
export function isConceptFocusLessonChecklistComplete(
  subtopicEngagementColumn: unknown,
  contentJson: unknown
): boolean {
  return Boolean(getConceptFocusLessonMarkedAtIso(subtopicEngagementColumn, contentJson));
}
