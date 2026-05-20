import type { TopicNode } from "@/data/topicTaxonomy";
import type { Board, Subject } from "@/types";
import { makeSubtopicEngagementStorageKey } from "@/lib/curriculum/subtopicEngagementStorageKey";

export const LESSON_COMPLETION_TRACKED_LEVEL = "advanced" as const;

export type LessonCompletionApiItem = {
  board: string;
  subject: string;
  classLevel: number;
  topic: string;
  subtopic: string;
  markedCompleteAt: string;
};

/** Build lookup keys matching `makeSubtopicEngagementStorageKey` for advanced only. */
export function lessonCompletionItemsToKeySet(items: LessonCompletionApiItem[]): Set<string> {
  const set = new Set<string>();
  for (const it of items) {
    if (it.subject !== "physics" && it.subject !== "chemistry" && it.subject !== "math") continue;
    if (it.classLevel !== 11 && it.classLevel !== 12) continue;
    set.add(
      makeSubtopicEngagementStorageKey({
        board: String(it.board).trim().toLowerCase() as Board,
        subject: it.subject as Subject,
        classLevel: it.classLevel as 11 | 12,
        topic: it.topic,
        subtopicName: it.subtopic,
        level: LESSON_COMPLETION_TRACKED_LEVEL,
      })
    );
  }
  return set;
}

export function isSubtopicLessonCompleteAtAdvanced(
  keySet: Set<string>,
  input: {
    board: string;
    subject: Subject;
    classLevel: 11 | 12;
    topic: string;
    subtopicName: string;
  }
): boolean {
  const k = makeSubtopicEngagementStorageKey({
    board: input.board.trim().toLowerCase() as Board,
    subject: input.subject,
    classLevel: input.classLevel,
    topic: input.topic,
    subtopicName: input.subtopicName,
    level: LESSON_COMPLETION_TRACKED_LEVEL,
  });
  return keySet.has(k);
}

export function isTopicCompleteAtAdvanced(
  node: TopicNode,
  keySet: Set<string>,
  boardNormalized: string
): boolean {
  const subs = node.subtopics ?? [];
  if (subs.length === 0) return false;
  const b = boardNormalized.trim().toLowerCase() as Board;
  return subs.every((st) =>
    isSubtopicLessonCompleteAtAdvanced(keySet, {
      board: b,
      subject: node.subject,
      classLevel: node.classLevel as 11 | 12,
      topic: node.topic,
      subtopicName: st.name,
    })
  );
}

/** All syllabus topics in the same curriculum chapter must be advanced-complete. */
export function isChapterCompleteAtAdvanced(
  chapterTopicNodes: TopicNode[],
  keySet: Set<string>,
  boardNormalized: string
): boolean {
  if (!chapterTopicNodes.length) return false;
  return chapterTopicNodes.every((n) => isTopicCompleteAtAdvanced(n, keySet, boardNormalized));
}
