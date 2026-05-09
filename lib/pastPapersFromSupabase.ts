import { supabase } from "@/integrations/supabase/client";
import {
  mapCatalogQuestionRowToQuestion,
  type CatalogQuestionRow,
} from "@/lib/catalogQuestionMap";
import { normalizeMockMarkingSchemeForStudents } from "@/lib/mockPaperMarkingScheme";
import type { PastPaper, PastPaperType, Question, Subject } from "@/types";

type PastPaperRow = {
  id: string;
  slug: string;
  title: string;
  exam_name: string | null;
  exam_set_name: string | null;
  paper_type: string;
  duration_minutes: number;
  total_marks: number;
  question_count: number;
  marking_scheme: string;
  class_level: number;
  tags: string[] | null;
  subjects_covered: string[] | null;
};

function isSubject(s: string): s is Subject {
  return s === "physics" || s === "chemistry" || s === "math";
}

function isPastPaperType(s: string): s is PastPaperType {
  return s === "pyq";
}

function mapDifficultyLabel(raw: string | null | undefined): "Easy" | "Moderate" | "Hard" {
  const d = (raw || "").toLowerCase();
  if (d === "easy" || d === "low") return "Easy";
  if (d === "hard" || d === "high") return "Hard";
  return "Moderate";
}

export function mapPastPaperRowToPastPaper(row: PastPaperRow): PastPaper {
  const covered = (row.subjects_covered ?? []).filter(isSubject) as Subject[];
  const primary: Subject = covered[0] ?? "math";
  const type = isPastPaperType(row.paper_type) ? row.paper_type : "pyq";
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    type,
    subject: primary,
    subjectsCovered: covered.length > 0 ? covered : undefined,
    durationMinutes: row.duration_minutes,
    questionsCount: row.question_count,
    totalMarks: row.total_marks,
    difficulty: mapDifficultyLabel(null),
    tags: row.tags ?? [],
    classLevel: row.class_level === 11 ? 11 : 12,
    markingScheme: normalizeMockMarkingSchemeForStudents(row.marking_scheme),
  };
}

export async function fetchPastPapersFromSupabase(): Promise<PastPaper[]> {
  const { data, error } = await supabase
    .from("past_papers")
    .select(
      "id, slug, title, exam_name, exam_set_name, paper_type, duration_minutes, total_marks, question_count, marking_scheme, class_level, tags, subjects_covered"
    )
    .eq("paper_type", "pyq")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((r) => mapPastPaperRowToPastPaper(r as PastPaperRow));
}

export async function fetchPastQuestionsForPaper(paperId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from("past_paper_questions")
    .select(
      "id, paper_id, sort_order, subject, topic, chapter, difficulty, question_html, solution_html, correct_letter, options_json"
    )
    .eq("paper_id", paperId)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as CatalogQuestionRow[];
  return rows.map((row) => mapCatalogQuestionRowToQuestion(row, "Past Paper"));
}
