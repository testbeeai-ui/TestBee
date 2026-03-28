import type { Subject, ClassLevel, ExamType } from '@/types';

/**
 * Subtopic line item under a curriculum topic.
 */
export interface SubTopic {
  name: string;
}

/**
 * Flattened row for UI + routing: one node per syllabus topic (lesson).
 * Hierarchy (unit → chapter → topic → subtopics) is stored in Supabase only;
 * loaded via {@link fetchFullCurriculumFromSupabase} / {@link useTopicTaxonomy}.
 */
export interface TopicNode {
  subject: Subject;
  classLevel: ClassLevel;
  /** Syllabus topic title; matches URL segment and Question.topic where applicable */
  topic: string;
  chapterTitle?: string;
  unitTitle?: string;
  subtopics: SubTopic[];
  examRelevance: ExamType[];
  unitLabel?: string;
  totalPeriods?: number;
}
