import type { TopicNode } from '@/data/topicTaxonomy';
import type { Subject } from '@/types';
import { slugify, parseGradeSlug, toGradeSlug, isValidLevel, type DifficultyLevel } from '@/lib/slugs';
import { subtopicSlugForRouting } from '@/lib/subtopicTitles';

export type { DifficultyLevel } from '@/lib/slugs';

export interface ResolvedTopic {
  topicNode: TopicNode;
  subtopicIndex: number;
  subtopicName: string;
  level: DifficultyLevel;
  isOverview?: boolean;
}

function findMatchingSubtopicIndices(node: TopicNode, topicSlug: string): number[] {
  const matches: number[] = [];
  node.subtopics.forEach((st, i) => {
    if (slugify(st.name) === topicSlug || subtopicSlugForRouting(st.name) === topicSlug) {
      matches.push(i);
    }
  });
  return matches;
}

/**
 * Resolve URL params to a topic node and subtopic. Returns null if not found.
 * `taxonomy` must be the same Supabase-backed list as Explore (see useTopicTaxonomy).
 */
export function resolveTopicFromParams(
  board: string,
  subject: string,
  grade: string,
  unitSlug: string,
  topicSlug: string,
  level: string,
  taxonomy: TopicNode[],
  chapterSlug?: string | null
): ResolvedTopic | null {
  if (board !== 'cbse') return null;
  const classLevel = parseGradeSlug(grade);
  if (classLevel === null) return null;
  const sub = subject as Subject;
  if (!['physics', 'chemistry', 'math', 'biology'].includes(sub)) return null;
  if (!isValidLevel(level)) return null;

  const nodeCandidates = taxonomy.filter(
    (n) =>
      n.subject === sub &&
      n.classLevel === classLevel &&
      slugify(n.topic) === unitSlug
  );
  const normalizedChapterSlug = (chapterSlug ?? "").trim().toLowerCase();
  let node: TopicNode | null = null;
  if (normalizedChapterSlug) {
    node = nodeCandidates.find((n) => slugify(n.chapterTitle ?? "") === normalizedChapterSlug) ?? null;
  } else if (topicSlug !== 'overview') {
    // If chapter is not provided, prefer the topic node that actually contains
    // this subtopic slug. This resolves duplicate topic names across chapters.
    const bySubtopic = nodeCandidates.filter((n) => findMatchingSubtopicIndices(n, topicSlug).length > 0);
    if (bySubtopic.length === 1) node = bySubtopic[0]!;
  }
  if (!node) node = nodeCandidates[0] ?? null;
  if (!node) return null;

  if (topicSlug === 'overview') {
    return {
      topicNode: node,
      subtopicIndex: -1,
      subtopicName: '',
      level: level as DifficultyLevel,
      isOverview: true,
    };
  }

  const matchingIndices = findMatchingSubtopicIndices(node, topicSlug);
  if (matchingIndices.length === 0) return null;
  // If multiple subtopics resolve to the same slug, prefer the last one so
  // navigation does not incorrectly show a phantom "next subtopic" on terminal items.
  const idx = matchingIndices[matchingIndices.length - 1]!;

  return {
    topicNode: node,
    subtopicIndex: idx,
    subtopicName: node.subtopics[idx]!.name,
    level: level as DifficultyLevel,
    isOverview: false,
  };
}

/**
 * Build the path for a topic overview page (shows topic theory, not subtopic).
 * e.g. /cbse/physics/class-12/coulombs-law/overview/basics
 */
export function buildTopicOverviewPath(
  board: string,
  subject: Subject,
  classLevel: number,
  topicName: string,
  level: DifficultyLevel,
  mode?: 'random',
  chapterTitle?: string
): string {
  const base = `/${board}/${subject}/${toGradeSlug(classLevel)}/${slugify(topicName)}/overview/${level}`;
  const qs = new URLSearchParams();
  if (mode === 'random') qs.set('mode', 'random');
  if (chapterTitle?.trim()) qs.set('chapter', slugify(chapterTitle));
  if (qs.size > 0) return `${base}?${qs.toString()}`;
  return base;
}

/**
 * Build the path for a subtopic page, e.g. /cbse/physics/class-11/thermodynamics/first-law/basics
 */
export function buildTopicPath(
  board: string,
  subject: Subject,
  classLevel: number,
  unitName: string,
  subtopicName: string,
  level: DifficultyLevel,
  mode?: 'random',
  chapterTitle?: string
): string {
  const base = `/${board}/${subject}/${toGradeSlug(classLevel)}/${slugify(unitName)}/${subtopicSlugForRouting(subtopicName)}/${level}`;
  const qs = new URLSearchParams();
  if (mode === 'random') qs.set('mode', 'random');
  if (chapterTitle?.trim()) qs.set('chapter', slugify(chapterTitle));
  if (qs.size > 0) return `${base}?${qs.toString()}`;
  return base;
}

/**
 * Get previous and next topic nodes in syllabus order.
 * When `chapterTitle` is set on the current node, siblings are limited to the **same chapter**
 * (same unit + same chapter). Otherwise falls back to all topics in the same unit — avoids
 * jumping from e.g. Gauss's law to Capacitors when both share one broad `unitLabel` but different chapters.
 */
export function getSiblingTopics(
  taxonomy: TopicNode[],
  node: TopicNode
): { prev: TopicNode | null; next: TopicNode | null } {
  const nodeChapter = (node.chapterTitle ?? '').trim();
  // Keep Supabase curriculum order (unit/chapter/topic sort_order) as-is.
  // Re-sorting alphabetically can cause wrong prev/next chapter flow.
  const siblings = taxonomy.filter((n) => {
    if (n.subject !== node.subject || n.classLevel !== node.classLevel) return false;
    if (n.unitLabel !== node.unitLabel) return false;
    if (nodeChapter) {
      return (n.chapterTitle ?? '').trim() === nodeChapter;
    }
    return true;
  });
  // Prefer exact object identity from the taxonomy array so duplicate topic names
  // across chapters/units can never resolve to the wrong sibling.
  let i = siblings.findIndex((n) => n === node);
  if (i < 0) {
    // Defensive fallback for cases where object identity is lost.
    i = siblings.findIndex(
      (n) =>
        n.topic === node.topic &&
        (n.chapterTitle ?? '') === (node.chapterTitle ?? '') &&
        (n.unitLabel ?? '') === (node.unitLabel ?? '') &&
        (n.unitTitle ?? '') === (node.unitTitle ?? '')
    );
  }
  if (i < 0) return { prev: null, next: null };
  return {
    prev: i > 0 ? siblings[i - 1]! : null,
    next: i < siblings.length - 1 ? siblings[i + 1]! : null,
  };
}

/**
 * Build the path for a Deep Dive page, e.g. /cbse/physics/class-11/thermodynamics/first-law/basics/deep-dive/0
 */
export function buildDeepDivePath(
  board: string,
  subject: Subject,
  classLevel: number,
  unitName: string,
  subtopicName: string,
  level: DifficultyLevel,
  sectionIndex: number,
  chapterTitle?: string
): string {
  const base = buildTopicPath(board, subject, classLevel, unitName, subtopicName, level, undefined, chapterTitle);
  return `${base}/deep-dive/${sectionIndex}`;
}
