import type { MockPaper, PastPaper, Subject } from "@/types";
import type { LibraryCategoryFilter } from "@/lib/mockPapersCatalog";

export type MockPageMode = "dashboard" | "library";

export type MockView = "landing" | "setup" | "nta_instructions" | "test" | "results";

export type NtaExamKind = "paper" | "quick";

export type LibraryCollectionTab = "past" | "mock" | "quick";

export type PaperSource = "past" | "mock";

export type NtaPendingExamMeta = {
  kind: NtaExamKind;
  paper: (MockPaper | PastPaper) | null;
  paperSource?: PaperSource;
  durationMin: number;
  questionCount: number;
  titleLine: string;
  subjectLine: string;
  quickSubjects?: Subject[];
};
