import { topicTaxonomy, type TopicNode } from '@/data/topicTaxonomy';
import type { Subject } from '@/types';
import { slugify, parseGradeSlug, toGradeSlug, isValidLevel, type DifficultyLevel } from '@/lib/slugs';

export type { DifficultyLevel } from '@/lib/slugs';

export interface ResolvedTopic {
  topicNode: TopicNode;
  subtopicIndex: number;
  subtopicName: string;
  level: DifficultyLevel;
}

/**
 * Resolve URL params to a topic node and subtopic. Returns null if not found.
 */
export function resolveTopicFromParams(
  board: string,
  subject: string,
  grade: string,
  unitSlug: string,
  topicSlug: string,
  level: string
): ResolvedTopic | null {
  if (board !== 'cbse') return null;
  const classLevel = parseGradeSlug(grade);
  if (classLevel === null) return null;
  const sub = subject as Subject;
  if (!['physics', 'chemistry', 'math', 'biology'].includes(sub)) return null;
  if (!isValidLevel(level)) return null;

  const node = topicTaxonomy.find(
    (n) =>
      n.subject === sub &&
      n.classLevel === classLevel &&
      slugify(n.topic) === unitSlug
  );
  if (!node) return null;

  const idx = node.subtopics.findIndex((st) => slugify(st.name) === topicSlug);
  if (idx < 0) return null;

  return {
    topicNode: node,
    subtopicIndex: idx,
    subtopicName: node.subtopics[idx]!.name,
    level: level as DifficultyLevel,
  };
}

/**
 * Build the path for a topic page, e.g. /cbse/physics/class-11/thermodynamics/first-law/basics
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
  const base = `/${board}/${subject}/${toGradeSlug(classLevel)}/${slugify(unitName)}/${slugify(subtopicName)}/${level}`;
  if (mode === 'random') return `${base}?mode=random`;
  return base;
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
