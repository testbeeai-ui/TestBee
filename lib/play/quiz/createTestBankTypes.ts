/**
 * Payload for counting **subtopic_content.bits_questions** (MCQs stored per subtopic/level),
 * aligned with CBSE curriculum topic titles.
 */
export type CreateTestQuestionBankMatch =
  | {
      scope: "Topic-wise";
      /** Parent topic title + every subtopic label under it (matches `subtopic_content.topic`). */
      topicTitles: string[];
      chapterTitle: string;
    }
  | { scope: "Unit-wise"; topicTitles: string[] };
