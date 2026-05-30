import { parseEngagementStore } from "@/lib/curriculum/subtopicEngagementStoreParse";
import { buildTopicPath } from "@/lib/curriculum/topicRoutes";
import type { DifficultyLevel, Subject } from "@/types";
import type { Json } from "@/integrations/supabase/types";

export type BuddyCompletedSubtopic = {
  board: string | null;
  subject: string | null;
  classLevel: number | null;
  topic: string;
  subtopic: string;
  level: string;
  completedAt: string;
  href: string | null;
};

type TableRow = {
  board: string | null;
  subject: string | null;
  class_level: number | null;
  topic: string;
  subtopic: string;
  level: string;
  marked_complete_at: string;
};

function asDifficultyLevel(value: string): DifficultyLevel {
  if (value === "intermediate" || value === "advanced") return value;
  return "basics";
}

function asSubject(value: string | null | undefined): Subject | null {
  const v = (value ?? "").toLowerCase();
  if (v === "physics" || v === "chemistry" || v === "math") return v;
  return null;
}

function dedupeKey(row: {
  board: string | null;
  subject: string | null;
  classLevel: number | null;
  topic: string;
  subtopic: string;
  level: string;
}): string {
  return [
    (row.board ?? "").toLowerCase(),
    (row.subject ?? "").toLowerCase(),
    String(row.classLevel ?? ""),
    row.topic,
    row.subtopic,
    row.level,
  ].join("|");
}

function toItem(row: {
  board: string | null;
  subject: string | null;
  classLevel: number | null;
  topic: string;
  subtopic: string;
  level: string;
  completedAt: string;
}): BuddyCompletedSubtopic {
  const subj = asSubject(row.subject);
  const href = subj
    ? buildTopicPath(
        row.board ?? "cbse",
        subj,
        Number(row.classLevel) || 12,
        row.topic,
        row.subtopic,
        asDifficultyLevel(row.level)
      )
    : null;
  return {
    board: row.board,
    subject: row.subject,
    classLevel: row.classLevel,
    topic: row.topic,
    subtopic: row.subtopic,
    level: row.level,
    completedAt: row.completedAt,
    href,
  };
}

/** Merge durable table rows + profile engagement JSON (basics/intermediate marks). */
export function listBuddyCompletedSubtopics(
  tableRows: TableRow[],
  engagementJson: Json | null | undefined,
  limit = 5
): BuddyCompletedSubtopic[] {
  const byKey = new Map<string, BuddyCompletedSubtopic>();

  for (const row of tableRows) {
    const completedAt = row.marked_complete_at;
    if (!completedAt) continue;
    const item = toItem({
      board: row.board,
      subject: row.subject,
      classLevel: row.class_level,
      topic: row.topic,
      subtopic: row.subtopic,
      level: row.level,
      completedAt,
    });
    byKey.set(dedupeKey(item), item);
  }

  const store = parseEngagementStore(engagementJson);
  for (const [key, snap] of Object.entries(store)) {
    const marked =
      typeof snap.lessonChecklistMarkedCompleteAt === "string"
        ? snap.lessonChecklistMarkedCompleteAt.trim()
        : "";
    if (!marked) continue;
    const parts = key.split("||");
    if (parts.length < 6) continue;
    const [board, subject, classLevelStr, topic, subtopic, level] = parts;
    const classLevel = Number(classLevelStr);
    const item = toItem({
      board: board || "cbse",
      subject,
      classLevel: classLevel === 11 || classLevel === 12 ? classLevel : null,
      topic,
      subtopic,
      level,
      completedAt: marked,
    });
    const existing = byKey.get(dedupeKey(item));
    if (!existing || Date.parse(item.completedAt) > Date.parse(existing.completedAt)) {
      byKey.set(dedupeKey(item), item);
    }
  }

  return [...byKey.values()]
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
    .slice(0, limit);
}

/** Latest Mark-as-complete timestamp from engagement JSON (any level). */
export function latestLessonMarkedAtFromEngagement(
  engagementJson: Json | null | undefined
): string | null {
  const store = parseEngagementStore(engagementJson);
  let best: string | null = null;
  let bestMs = 0;
  for (const snap of Object.values(store)) {
    const marked =
      typeof snap.lessonChecklistMarkedCompleteAt === "string"
        ? snap.lessonChecklistMarkedCompleteAt.trim()
        : "";
    if (!marked) continue;
    const ms = Date.parse(marked);
    if (!Number.isFinite(ms) || ms <= bestMs) continue;
    bestMs = ms;
    best = marked;
  }
  return best;
}
