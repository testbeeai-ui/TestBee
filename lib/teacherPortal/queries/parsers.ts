import type { Json } from "@/integrations/supabase/types";
import { isValidLevel } from "@/lib/slugs";
import {
  isDailyDoseStreakTrackId,
  trackLabelById,
  type DailyDoseStreakTrackId,
} from "@/lib/teacherPortal/dailyDoseStreakTracks";
import { SUBJECTS } from "./utils";
import type {
  TeacherPortalChapterQuizRef,
  TeacherPortalDailyDoseStreakRef,
  TeacherPortalGyanEngagementRef,
  TeacherPortalMockPaperRef,
  TeacherPortalPastPaperRef,
} from "@/lib/teacherPortal/types";

export function parseMockPaperRef(payload: Record<string, Json>): TeacherPortalMockPaperRef | null {
  const raw = payload.mockPaper;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const slug = typeof o.slug === "string" ? o.slug.trim() : "";
  if (!id || !title) return null;
  return { id, title, slug: slug || id };
}

export function parsePastPaperRef(payload: Record<string, Json>): TeacherPortalPastPaperRef | null {
  const raw = payload.pastPaper;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const slug = typeof o.slug === "string" ? o.slug.trim() : "";
  if (!id || !title) return null;
  return { id, title, slug: slug || id };
}

export function parseChapterQuizRef(
  payload: Record<string, Json>
): TeacherPortalChapterQuizRef | null {
  const raw = payload.chapterQuiz;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const board = typeof o.board === "string" ? o.board.trim().toLowerCase() : "cbse";
  const subject = typeof o.subject === "string" ? o.subject.trim().toLowerCase() : "";
  if (!SUBJECTS.has(subject)) return null;
  const classLevel = Number(o.classLevel);
  if (classLevel !== 11 && classLevel !== 12) return null;
  const chapterTitle = typeof o.chapterTitle === "string" ? o.chapterTitle : "";
  const topic = typeof o.topic === "string" ? o.topic.trim() : "";
  const subtopicName = typeof o.subtopicName === "string" ? o.subtopicName.trim() : "";
  const levelRaw = typeof o.level === "string" ? o.level.trim().toLowerCase() : "";
  if (!topic || !subtopicName || !isValidLevel(levelRaw)) return null;
  const level = levelRaw;
  let advancedSet: 1 | 2 | 3 | undefined;
  if (level === "advanced") {
    const s = Number(o.advancedSet);
    if (s === 1 || s === 2 || s === 3) advancedSet = s;
    else advancedSet = 1;
  }
  return {
    board: board || "cbse",
    subject: subject as TeacherPortalChapterQuizRef["subject"],
    classLevel: classLevel as 11 | 12,
    chapterTitle,
    topic,
    subtopicName,
    level,
    ...(level === "advanced" ? { advancedSet } : {}),
  };
}

export function parseDailyDoseStreakRef(
  payload: Record<string, Json>
): TeacherPortalDailyDoseStreakRef | null {
  const raw = payload.dailyDoseStreak;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const trackId = typeof o.trackId === "string" ? o.trackId.trim().toLowerCase() : "";
  if (!isDailyDoseStreakTrackId(trackId)) return null;
  const trackLabel = typeof o.trackLabel === "string" ? o.trackLabel.trim() : "";
  return { trackId, trackLabel: trackLabel || trackLabelById(trackId) };
}

export function parseGyanEngagementRef(
  payload: Record<string, Json>
): TeacherPortalGyanEngagementRef | null {
  const raw = payload.gyanEngagement;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const topicFocus = typeof o.topicFocus === "string" ? o.topicFocus.trim() : "";
  const subtopicHint = typeof o.subtopicHint === "string" ? o.subtopicHint.trim() : "";
  return { topicFocus, subtopicHint };
}
