import type { MockPaper, MockPaperType, Subject } from "@/types";

export type LibraryCategoryFilter = "all" | MockPaperType;

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
  allowedSubjects: Subject[]
): MockPaper[] {
  const q = search.trim().toLowerCase();
  return papers.filter((p) => {
    if (!paperAllowedForUserCombo(p, allowedSubjects)) return false;
    if (category !== "all" && p.type !== category) return false;
    if (!paperMatchesSubjectFilter(p, subjectFilter)) return false;
    if (!q) return true;
    if (p.title.toLowerCase().includes(q)) return true;
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
