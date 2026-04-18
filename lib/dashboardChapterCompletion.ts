import type { TopicNode } from "@/data/topicTaxonomy";
import type { Subject } from "@/types";
import type { ParsedBitsAttemptRow } from "@/lib/parseBitsTestAttemptsStore";

const SUBJECT_LABEL: Record<Subject, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  math: "Mathematics",
  biology: "Biology",
};

export function normalizeCurriculumText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Strip advanced per-set suffix from bits_test_attempts storage keys. */
export function stripBitsAttemptSetSuffix(key: string): string {
  return key.replace(/\|\|set:[123]\s*$/i, "");
}

export type ChapterCompletionRow = {
  label: string;
  /** PUC class this row's totals are computed for (must match attempt + curriculum rows). */
  classLevel: 11 | 12;
  completionPct: number;
  /** Completed curriculum items (each SubTopic slot) in this chapter. */
  completed: number;
  /** Total curriculum items (each SubTopic) summed across every syllabus topic in the chapter. */
  total: number;
  /** Number of syllabus TopicNode rows grouped under this chapter. */
  topicCountInChapter: number;
};

/** Stable bucket: same class, unit, and printed chapter title. */
function chapterAggregateId(node: TopicNode): string {
  const u = normalizeCurriculumText(node.unitLabel ?? "");
  const chapterHead = (node.chapterTitle ?? "").trim();
  const ch = normalizeCurriculumText(chapterHead || node.topic);
  return `${node.subject}::${node.classLevel}::${u}::${ch}`;
}

function progressKey(subject: Subject, classLevel: 11 | 12, topic: string, subtopic: string): string {
  return `${subject}::${classLevel}::${normalizeCurriculumText(topic)}::${normalizeCurriculumText(subtopic)}`;
}

function chapterRowLabel(nodes: TopicNode[]): string {
  const n0 = nodes[0];
  const ch = (n0.chapterTitle ?? "").trim();
  const head = ch || n0.topic;
  return `${SUBJECT_LABEL[n0.subject]} — ${head} · Class ${n0.classLevel}`;
}

type ChapterRowWithActivity = ChapterCompletionRow & { lastSubmittedAtMs: number };

/**
 * Parse `class_level` segment from a bits storage key (`board||subject||class||topic||sub||level`).
 * Returns null if the key does not follow the modern shape.
 */
export function parseClassLevelFromBitsStorageKey(rawKey: string): 11 | 12 | null {
  const key = stripBitsAttemptSetSuffix(rawKey);
  const parts = key.split("||");
  if (parts.length < 6) return null;
  const cl = Number(parts[2]);
  if (cl === 11 || cl === 12) return cl;
  return null;
}

/** `subtopic_engagement` keys use the same `board||subject||class||topic||sub||level` shape as Bits keys. */
export function parseClassLevelsFromSubtopicEngagementRaw(raw: unknown): Set<11 | 12> {
  const out = new Set<11 | 12>();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const key of Object.keys(raw as Record<string, unknown>)) {
    const cl = parseClassLevelFromBitsStorageKey(key);
    if (cl != null) out.add(cl);
  }
  return out;
}

/**
 * Class levels where the learner has at least one subtopic with Lessons/Progress
 * "Marked completed" persisted (`lessonChecklistMarkedCompleteAt`), scoped from engagement keys.
 */
export function parseClassLevelsFromLessonMarkedEngagementRaw(raw: unknown): Set<11 | 12> {
  const out = new Set<11 | 12>();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    if (Number(row.v) !== 1) continue;
    const marked =
      typeof row.lessonChecklistMarkedCompleteAt === "string" ? row.lessonChecklistMarkedCompleteAt.trim() : "";
    if (!marked) continue;
    const cl = parseClassLevelFromBitsStorageKey(key);
    if (cl != null) out.add(cl);
  }
  return out;
}

/** What counts as a “completed” subtopic when aggregating chapter rows. */
export type ChapterProgressSource = "bits_and_lesson" | "lesson_marked_only";

export type BuildChapterCompletionRowsOptions = {
  progressSource?: ChapterProgressSource;
};

function mergeLessonMarkedRowsIntoProgress(
  raw: unknown,
  add: (subject: string, classLevel: 11 | 12, topic: string, subtopic: string) => void,
  topicToAggregateId: Map<string, string>,
  lastMsByAggregate: Map<string, number>
): void {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    if (Number(row.v) !== 1) continue;
    const marked =
      typeof row.lessonChecklistMarkedCompleteAt === "string" ? row.lessonChecklistMarkedCompleteAt.trim() : "";
    if (!marked) continue;
    const parts = key.split("||");
    if (parts.length < 6) continue;
    const subject = parts[1]?.trim().toLowerCase() ?? "";
    const cl = Number(parts[2]);
    if (cl !== 11 && cl !== 12) continue;
    const topicRaw = parts[3] ?? "";
    const subtopicRaw = parts[4] ?? "";
    add(subject, cl as 11 | 12, topicRaw, subtopicRaw);
    const aid = topicToAggregateId.get(`${subject}::${cl}::${normalizeCurriculumText(topicRaw)}`);
    if (!aid) continue;
    const ms = Date.parse(marked);
    if (Number.isFinite(ms)) {
      lastMsByAggregate.set(aid, Math.max(lastMsByAggregate.get(aid) ?? 0, ms));
    } else {
      lastMsByAggregate.set(aid, Math.max(lastMsByAggregate.get(aid) ?? 0, 1));
    }
  }
}

/**
 * Whole-curriculum-chapter rows: sums all subtopics under the same `chapterTitle` (within the same unit),
 * per class level, so Class 12 "Probability" totals are not collapsed into Class 11's smaller chapter shape.
 */
function buildAggregatedChapterRowsInternal(
  taxonomy: TopicNode[],
  bitsRows: ParsedBitsAttemptRow[],
  bitsStoreKeys: string[],
  subtopicEngagement?: unknown,
  options?: BuildChapterCompletionRowsOptions
): ChapterRowWithActivity[] {
  const progressSource = options?.progressSource ?? "bits_and_lesson";
  const bitsCountTowardCompletion = progressSource === "bits_and_lesson";

  const completed = new Set<string>();

  const add = (subject: string, classLevel: 11 | 12, topic: string, subtopic: string) => {
    const s = subject.trim().toLowerCase();
    if (!["physics", "chemistry", "math", "biology"].includes(s)) return;
    completed.add(`${s}::${classLevel}::${normalizeCurriculumText(topic)}::${normalizeCurriculumText(subtopic)}`);
  };

  if (bitsCountTowardCompletion) {
    for (const row of bitsRows) {
      add(row.subject, row.classLevel, row.topic, row.subtopicName);
    }

    for (const rawKey of bitsStoreKeys) {
      const key = stripBitsAttemptSetSuffix(rawKey);
      const parts = key.split("||");
      if (parts.length < 5) continue;
      const subject = parts[1]?.trim().toLowerCase() ?? "";
      let classLevel: 11 | 12 = 11;
      let topic = "";
      let subtopic = "";
      if (parts.length >= 6) {
        const cl = Number(parts[2]);
        if (cl === 11 || cl === 12) {
          classLevel = cl;
          topic = parts[3] ?? "";
          subtopic = parts[4] ?? "";
        } else {
          topic = parts[2] ?? "";
          subtopic = parts[3] ?? "";
        }
      } else {
        topic = parts[2] ?? "";
        subtopic = parts[3] ?? "";
      }
      add(subject, classLevel, topic, subtopic);
    }
  }

  const topicToAggregateId = new Map<string, string>();
  for (const node of taxonomy) {
    topicToAggregateId.set(
      `${node.subject}::${node.classLevel}::${normalizeCurriculumText(node.topic)}`,
      chapterAggregateId(node)
    );
  }

  const lastMsByAggregate = new Map<string, number>();
  if (bitsCountTowardCompletion) {
    for (const row of bitsRows) {
      const ms = row.submittedAtMs;
      if (typeof ms !== "number" || !Number.isFinite(ms)) continue;
      const aid = topicToAggregateId.get(
        `${row.subject}::${row.classLevel}::${normalizeCurriculumText(row.topic)}`
      );
      if (!aid) continue;
      lastMsByAggregate.set(aid, Math.max(lastMsByAggregate.get(aid) ?? 0, ms));
    }
  }

  mergeLessonMarkedRowsIntoProgress(subtopicEngagement, add, topicToAggregateId, lastMsByAggregate);

  const groups = new Map<string, TopicNode[]>();
  for (const node of taxonomy) {
    const id = chapterAggregateId(node);
    const list = groups.get(id) ?? [];
    list.push(node);
    groups.set(id, list);
  }

  const rows: ChapterRowWithActivity[] = [];

  for (const [aid, nodes] of groups) {
    if (!nodes.length) continue;
    const cl = nodes[0].classLevel;
    let total = 0;
    let c = 0;
    for (const node of nodes) {
      const subs = node.subtopics ?? [];
      for (const st of subs) {
        total++;
        const k = progressKey(node.subject, node.classLevel, node.topic, st.name);
        if (completed.has(k)) c++;
      }
    }
    if (total === 0) continue;

    let lastMs = lastMsByAggregate.get(aid) ?? 0;
    if (bitsCountTowardCompletion && lastMs === 0 && c > 0) lastMs = 1;

    const completionPct = Math.round((100 * c) / total);
    rows.push({
      label: chapterRowLabel(nodes),
      classLevel: cl,
      completionPct,
      completed: c,
      total,
      topicCountInChapter: nodes.length,
      lastSubmittedAtMs: lastMs,
    });
  }

  return rows;
}

/**
 * Lowest-completion whole chapters (aggregated), for legacy / alternate dashboards.
 */
export function buildChapterCompletionRows(
  taxonomy: TopicNode[],
  bitsRows: ParsedBitsAttemptRow[],
  bitsStoreKeys: string[],
  subtopicEngagement?: unknown,
  options?: BuildChapterCompletionRowsOptions
): ChapterCompletionRow[] {
  return buildAggregatedChapterRowsInternal(taxonomy, bitsRows, bitsStoreKeys, subtopicEngagement, options)
    .filter((r) => r.total > 0)
    .sort((a, b) => {
      if (a.completionPct !== b.completionPct) return a.completionPct - b.completionPct;
      return b.total - a.total;
    })
    .slice(0, 6)
    .map(({ lastSubmittedAtMs: _m, ...rest }) => rest);
}

/**
 * Whole chapters ordered by most recent bits submit.
 * Only includes chapters the learner has touched (at least one submitted attempt).
 */
export function buildChapterCompletionRowsByRecentActivity(
  taxonomy: TopicNode[],
  bitsRows: ParsedBitsAttemptRow[],
  bitsStoreKeys: string[],
  subtopicEngagement?: unknown,
  limit = 6,
  options?: BuildChapterCompletionRowsOptions
): ChapterCompletionRow[] {
  const rows = buildAggregatedChapterRowsInternal(taxonomy, bitsRows, bitsStoreKeys, subtopicEngagement, options);
  const progressSource = options?.progressSource ?? "bits_and_lesson";
  const touched =
    progressSource === "lesson_marked_only"
      ? rows.filter((r) => r.completed > 0)
      : rows.filter((r) => r.lastSubmittedAtMs > 0);
  touched.sort((a, b) => b.lastSubmittedAtMs - a.lastSubmittedAtMs);
  return touched.slice(0, limit).map(({ lastSubmittedAtMs: _m, ...rest }) => rest);
}
