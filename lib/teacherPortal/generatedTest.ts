import type { TeacherTestQuestion } from "@/lib/buildTeacherTestQuestionSet";
import type { Subject } from "@/types";

export type TeacherTestRowsRequest = {
  subject: Subject;
  classLevel: 11 | 12;
  match: {
    scope: "Topic-wise" | "Unit-wise";
    topicTitles: string[];
    chapterTitle?: string;
  };
};

export type TeacherTestRowsResponse = {
  rows: Array<{
    topic: string | null;
    subtopic_name: string | null;
    level: string | null;
    bits_questions: unknown;
  }>;
  scanned: number;
  classLevelUsed: 11 | 12;
  source: string;
  error: string | null;
};

export type GeneratedTeacherTest = {
  id: string;
  name: string;
  examType: string;
  board: string;
  classLevelLabel: string;
  classLevelNumeric: 11 | 12;
  subjectLabel: string;
  sourceLabel: string;
  scopeLabel: string;
  scopeDetails: string[];
  durationMinutes: number;
  requestedCount: number;
  pickedCount: number;
  bankAvailable: number | null;
  classLevelUsed: 11 | 12;
  generatedAtIso: string;
  questions: TeacherTestQuestion[];
};
