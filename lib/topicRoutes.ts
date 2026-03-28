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
  taxonomy: TopicNode[]
): ResolvedTopic | null {
  if (board !== 'cbse') return null;
  const classLevel = parseGradeSlug(grade);
  if (classLevel === null) return null;
  const sub = subject as Subject;
  if (!['physics', 'chemistry', 'math', 'biology'].includes(sub)) return null;
  if (!isValidLevel(level)) return null;

  const node = taxonomy.find(
    (n) =>
      n.subject === sub &&
      n.classLevel === classLevel &&
      slugify(n.topic) === unitSlug
  );
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

  const idx = node.subtopics.findIndex(
    (st) => slugify(st.name) === topicSlug || subtopicSlugForRouting(st.name) === topicSlug
  );
  if (idx < 0) return null;

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
  mode?: 'random'
): string {
  const base = `/${board}/${subject}/${toGradeSlug(classLevel)}/${slugify(topicName)}/overview/${level}`;
  if (mode === 'random') return `${base}?mode=random`;
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
  mode?: 'random'
): string {
  const base = `/${board}/${subject}/${toGradeSlug(classLevel)}/${slugify(unitName)}/${subtopicSlugForRouting(subtopicName)}/${level}`;
  if (mode === 'random') return `${base}?mode=random`;
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
  const siblings = taxonomy
    .filter((n) => {
      if (n.subject !== node.subject || n.classLevel !== node.classLevel) return false;
      if (n.unitLabel !== node.unitLabel) return false;
      if (nodeChapter) {
        return (n.chapterTitle ?? '').trim() === nodeChapter;
      }
      return true;
    })
    .sort((a, b) => {
      const aCh = (a.chapterTitle ?? '').toLowerCase();
      const bCh = (b.chapterTitle ?? '').toLowerCase();
      if (aCh !== bCh) return aCh.localeCompare(bCh);
      return a.topic.localeCompare(b.topic);
    });
  const i = siblings.findIndex((n) => n.topic === node.topic);
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
  sectionIndex: number
): string {
  const base = buildTopicPath(board, subject, classLevel, unitName, subtopicName, level);
  return `${base}/deep-dive/${sectionIndex}`;
}
