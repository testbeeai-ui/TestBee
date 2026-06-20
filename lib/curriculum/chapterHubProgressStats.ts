import type { TopicNode } from "@/data/topicTaxonomy";
import type { Subject } from "@/types";
import { parseEngagementStore } from "@/lib/curriculum/subtopicEngagementStoreParse";
import {
  normalizeCurriculumText,
  stripBitsAttemptSetSuffix,
} from "@/lib/dashboard/dashboardChapterCompletion";

/** Advanced topic quizzes expose up to three sets per subtopic (Set 1 free; 2–3 via Question bank). */
export const ADVANCED_QUIZ_SETS_PER_SUBTOPIC = 3;

const SET_SUFFIX_RE = /\|\|set:([123])\s*$/i;

export type ChapterHubActivityStats = {
  /** Submitted advanced quiz sets in this chapter (each ||set:N key counts once). */
  quizSetsTaken: number;
  /** Max advanced quiz sets across chapter subtopics (3 × subtopic count). */
  quizSetsTotal: number;
  /** InstaCue cards flipped (validated) on advanced lessons in this chapter. */
  instaCueCardsCreated: number;
};

function subtopicScopeKey(
  subject: Subject,
  classLevel: 11 | 12,
  topic: string,
  subtopic: string
): string {
  return `${subject}::${classLevel}::${normalizeCurriculumText(topic)}::${normalizeCurriculumText(subtopic)}`;
}

function parseSetFromStorageKey(key: string): 1 | 2 | 3 {
  const m = key.match(SET_SUFFIX_RE);
  if (m) return Number(m[1]) as 1 | 2 | 3;
  return 1;
}

function sanitize(value: unknown, maxLen = 300): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function parseScopeFromStorageKey(
  key: string,
  boardNormalized: string,
  subject: Subject,
  classLevel: 11 | 12,
  chapterScopes: Set<string>
): { topic: string; subtopic: string; level: string } | null {
  const baseKey = stripBitsAttemptSetSuffix(key);
  const parts = baseKey.split("||");
  if (parts.length < 6) return null;

  const board = parts[0]?.trim().toLowerCase() ?? "";
  const subj = parts[1]?.trim().toLowerCase() ?? "";
  const cl = Number(parts[2]);
  const topic = parts[3] ?? "";
  const subtopic = parts[4] ?? "";
  const level = parts[5]?.trim().toLowerCase() ?? "";

  if (board !== boardNormalized.toLowerCase()) return null;
  if (subj !== subject) return null;
  if (cl !== classLevel) return null;

  const scope = subtopicScopeKey(subject, classLevel, topic, subtopic);
  if (!chapterScopes.has(scope)) return null;

  return { topic, subtopic, level };
}

function parseScopeFromAttemptRow(
  row: Record<string, unknown>,
  subject: Subject,
  classLevel: 11 | 12,
  chapterScopes: Set<string>
): { topic: string; subtopic: string; level: string } | null {
  const topic = sanitize(row.topic, 300);
  const subtopic = sanitize(row.subtopicName, 300);
  const subjectRaw = sanitize(row.subject, 80).toLowerCase();
  const level = sanitize(row.level, 30).toLowerCase();
  const cl = Number(row.classLevel) === 12 ? 12 : 11;

  if (!topic || !subtopic || subjectRaw !== subject || cl !== classLevel) return null;

  const scope = subtopicScopeKey(subject, classLevel, topic, subtopic);
  if (!chapterScopes.has(scope)) return null;

  return { topic, subtopic, level };
}

function isSubmittedAttempt(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Boolean(sanitize(row.submittedAt, 80));
}

/**
 * Chapter-hub sidebar stats: advanced quiz sets taken + InstaCue cards flipped.
 * Uses the same profile stores as Performance (`bits_test_attempts`, `subtopic_engagement`).
 */
export function buildChapterHubActivityStats(input: {
  topics: TopicNode[];
  boardNormalized: string;
  subject: Subject;
  classLevel: 11 | 12;
  bitsAttemptsJson: unknown;
  subtopicEngagementJson: unknown;
}): ChapterHubActivityStats {
  const chapterScopes = new Set<string>();
  let subtopicCount = 0;

  for (const topic of input.topics) {
    for (const st of topic.subtopics) {
      subtopicCount += 1;
      chapterScopes.add(subtopicScopeKey(input.subject, input.classLevel, topic.topic, st.name));
    }
  }

  const quizSetsTotal = subtopicCount * ADVANCED_QUIZ_SETS_PER_SUBTOPIC;
  const takenSets = new Set<string>();

  if (
    input.bitsAttemptsJson &&
    typeof input.bitsAttemptsJson === "object" &&
    !Array.isArray(input.bitsAttemptsJson)
  ) {
    for (const [key, value] of Object.entries(input.bitsAttemptsJson as Record<string, unknown>)) {
      if (!isSubmittedAttempt(value)) continue;

      const scope =
        parseScopeFromStorageKey(
          key,
          input.boardNormalized,
          input.subject,
          input.classLevel,
          chapterScopes
        ) ?? parseScopeFromAttemptRow(value, input.subject, input.classLevel, chapterScopes);

      if (!scope || scope.level !== "advanced") continue;

      const setNum = parseSetFromStorageKey(key);
      const scopeKey = subtopicScopeKey(
        input.subject,
        input.classLevel,
        scope.topic,
        scope.subtopic
      );
      takenSets.add(`${scopeKey}::set:${setNum}`);
    }
  }

  let instaCueCardsCreated = 0;
  const engagement = parseEngagementStore(input.subtopicEngagementJson);
  for (const [key, snap] of Object.entries(engagement)) {
    const scope = parseScopeFromStorageKey(
      key,
      input.boardNormalized,
      input.subject,
      input.classLevel,
      chapterScopes
    );
    if (!scope || scope.level !== "advanced") continue;
    instaCueCardsCreated += snap.instaCue?.flipped?.length ?? 0;
  }

  return {
    quizSetsTaken: takenSets.size,
    quizSetsTotal,
    instaCueCardsCreated,
  };
}
