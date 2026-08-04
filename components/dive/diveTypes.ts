import type { Subject } from "@/types";
import type { DiveSubtopicCandidate } from "@/lib/dive/suggestBatch";

export type DiveStep = 1 | 2 | 3 | 4;

export type DiveSelection = {
  classLevel: 11 | 12;
  subject: Subject;
  chapterTitle: string;
  subtopic: DiveSubtopicCandidate | null;
};

export type DiveActivityId =
  | "details"
  | "concepts"
  | "instacue"
  | "quiz"
  | "numerals"
  | "outcomes"
  | "references"
  | "classes";

export const DIVE_ACTIVITY_IDS: DiveActivityId[] = [
  "details",
  "concepts",
  "instacue",
  "quiz",
  "numerals",
  "outcomes",
  "references",
  "classes",
];

/** Hub cards that count toward completion (Classes stays visible; excluded until scheduled content exists). */
export const DIVE_TRACKED_ACTIVITY_IDS: DiveActivityId[] = [
  "details",
  "concepts",
  "instacue",
  "quiz",
  "numerals",
  "outcomes",
  "references",
];
