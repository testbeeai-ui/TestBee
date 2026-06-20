import type { PastPaper, Subject } from "@/types";
import { paperMatchesExamFilter, type LibraryExamFilter } from "@/lib/mock/mockPapersCatalog";

function paperAllowedForUserCombo(p: PastPaper, allowedSubjects: Subject[]): boolean {
  if (p.subjectsCovered?.length) {
    return p.subjectsCovered.some((s) => allowedSubjects.includes(s));
  }
  return allowedSubjects.includes(p.subject);
}

function paperMatchesSubjectFilter(p: PastPaper, subjectFilter: Subject | "all"): boolean {
  if (subjectFilter === "all") return true;
  if (p.subjectsCovered?.length) return p.subjectsCovered.includes(subjectFilter);
  return p.subject === subjectFilter;
}

export function filterPastPapers(
  papers: PastPaper[],
  search: string,
  subjectFilter: Subject | "all",
  allowedSubjects: Subject[],
  examFilter: LibraryExamFilter = "all"
): PastPaper[] {
  const q = search.trim().toLowerCase();
  return papers.filter((p) => {
    if (!paperAllowedForUserCombo(p, allowedSubjects)) return false;
    if (!paperMatchesSubjectFilter(p, subjectFilter)) return false;
    if (!paperMatchesExamFilter(p.exam, examFilter)) return false;
    if (!q) return true;
    if (p.title.toLowerCase().includes(q)) return true;
    if (p.exam.toLowerCase().includes(q)) return true;
    return p.tags.some((t) => t.toLowerCase().includes(q));
  });
}
