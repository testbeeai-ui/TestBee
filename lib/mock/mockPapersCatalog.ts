import type { MockPaper, MockPaperType, Subject } from "@/types";

export type LibraryCategoryFilter = "all" | MockPaperType;

/** Exam chips shown on the Mock papers / Past papers library tabs. */
export type LibraryExamFilter = "all" | "kcet" | "bitsat" | "jee-main";

/** Map a chip id to the canonical exam_name string stored in Supabase. */
export const EXAM_FILTER_TO_NAME: Record<Exclude<LibraryExamFilter, "all">, string> = {
  kcet: "KCET",
  bitsat: "BITSAT",
  "jee-main": "JEE Main",
};

/** Generic exam-name matcher shared by Mock + Past paper filters. */
export function paperMatchesExamFilter(exam: string, examFilter: LibraryExamFilter): boolean {
  if (examFilter === "all") return true;
  return exam === EXAM_FILTER_TO_NAME[examFilter];
}

function paperAllowedForUserCombo(p: MockPaper, allowedSubjects: Subject[]): boolean {
  if (p.subjectsCovered?.length) {
    return p.subjectsCovered.some((s) => allowedSubjects.includes(s));
  }
  return allowedSubjects.includes(p.subject);
}

function paperMatchesSubjectFilter(p: MockPaper, subjectFilter: Subject | "all"): boolean {
  if (subjectFilter === "all") return true;
  if (p.subjectsCovered?.length) return p.subjectsCovered.includes(subjectFilter);
  return p.subject === subjectFilter;
}

export function filterMockPapers(
  papers: MockPaper[],
  category: LibraryCategoryFilter,
  search: string,
  subjectFilter: Subject | "all",
  allowedSubjects: Subject[],
  examFilter: LibraryExamFilter = "all"
): MockPaper[] {
  const q = search.trim().toLowerCase();
  return papers.filter((p) => {
    if (!paperAllowedForUserCombo(p, allowedSubjects)) return false;
    if (category !== "all" && p.type !== category) return false;
    if (!paperMatchesSubjectFilter(p, subjectFilter)) return false;
    if (!paperMatchesExamFilter(p.exam, examFilter)) return false;
    if (!q) return true;
    if (p.title.toLowerCase().includes(q)) return true;
    if (p.exam.toLowerCase().includes(q)) return true;
    return p.tags.some((t) => t.toLowerCase().includes(q));
  });
}

export function mockPaperTypeLabel(type: MockPaperType): string {
  switch (type) {
    case "ncert":
      return "NCERT Exemplar";
    case "chapter":
      return "Chapter-wise";
    case "full":
      return "Full Syllabus";
    case "mock":
      return "Mock Paper";
    default:
      return type;
  }
}
