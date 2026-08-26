/** Normalize curriculum labels so "14.5 Simple Pendulum" matches across CH/TP chips. */
export function normalizeCurriculumChipLabel(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export type FeedCurriculumChipValues = {
  chapter: string | null;
  topic: string | null;
  subtopic: string | null;
};

/**
 * Feed CH / TP / SUB labels.
 * Hide chapter when it is empty or the same as topic — quiz shares used to store
 * the topic title in `chapter_ref`, which made CH and TP look identical.
 */
export function feedCurriculumChipValues(input: {
  chapterRef?: string | null;
  topicRef?: string | null;
  subtopicRef?: string | null;
}): FeedCurriculumChipValues {
  const chapter = (input.chapterRef ?? "").trim();
  const topic = (input.topicRef ?? "").trim();
  const subtopic = (input.subtopicRef ?? "").trim();
  const chapterKey = normalizeCurriculumChipLabel(chapter);
  const topicKey = normalizeCurriculumChipLabel(topic);
  const chapterDuplicatesTopic = chapterKey.length > 0 && chapterKey === topicKey;

  return {
    chapter: chapter && !chapterDuplicatesTopic ? chapter : null,
    topic: topic || null,
    subtopic: subtopic || null,
  };
}

/** Persist a chapter only when it is a distinct parent of the topic. */
export function chapterRefDistinctFromTopic(
  chapterTitle: string | null | undefined,
  topicTitle: string | null | undefined
): string | null {
  return feedCurriculumChipValues({
    chapterRef: chapterTitle,
    topicRef: topicTitle,
  }).chapter;
}
