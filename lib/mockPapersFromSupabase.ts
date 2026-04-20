import { supabase } from "@/integrations/supabase/client";
import type { MockPaper, MockPaperType, Question, Subject } from "@/types";

type PaperRow = {
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

type QuestionRow = {
  id: string;
  paper_id: string;
  sort_order: number;
  subject: string;
  topic: string | null;
  chapter: string | null;
  difficulty: string | null;
  question_html: string;
  solution_html: string | null;
  correct_letter: string;
  options_json: unknown;
};

function isSubject(s: string): s is Subject {
  return s === "physics" || s === "chemistry" || s === "math" || s === "biology";
}

function isMockPaperType(s: string): s is MockPaperType {
  return s === "pyq" || s === "ncert" || s === "chapter" || s === "full";
}

function mapDifficultyLabel(raw: string | null | undefined): "Easy" | "Moderate" | "Hard" {
  const d = (raw || "").toLowerCase();
  if (d === "easy" || d === "low") return "Easy";
  if (d === "hard" || d === "high") return "Hard";
  return "Moderate";
}

export function mapPaperRowToMockPaper(row: PaperRow): MockPaper {
  const covered = (row.subjects_covered ?? []).filter(isSubject) as Subject[];
  const primary: Subject = covered[0] ?? "math";
  const type = isMockPaperType(row.paper_type) ? row.paper_type : "pyq";
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
    markingScheme: row.marking_scheme,
  };
}

export async function fetchMockPapersFromSupabase(): Promise<MockPaper[]> {
  const { data, error } = await supabase
    .from("mock_papers")
    .select(
      "id, slug, title, exam_name, exam_set_name, paper_type, duration_minutes, total_marks, question_count, marking_scheme, class_level, tags, subjects_covered",
    )
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((r) => mapPaperRowToMockPaper(r as PaperRow));
}

function letterToIndex(letter: string): number {
  const L = letter.trim().toUpperCase();
  const i = L.charCodeAt(0) - 65;
  return i >= 0 && i <= 3 ? i : 0;
}

const emptyReference: Question["reference"] = {
  theory: "",
  relatedTopics: [],
  applicationExample: "",
};

function stripHtmlToPlain(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

export async function fetchMockQuestionsForPaper(paperId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from("mock_questions")
    .select(
      "id, paper_id, sort_order, subject, topic, chapter, difficulty, question_html, solution_html, correct_letter, options_json",
    )
    .eq("paper_id", paperId)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as QuestionRow[];
  return rows.map((row) => {
    const subj = isSubject(row.subject) ? row.subject : "math";
    const opts = Array.isArray(row.options_json)
      ? (row.options_json as string[]).map((o) => (typeof o === "string" ? o : String(o)))
      : [];
    const padded = [...opts];
    while (padded.length < 4) padded.push("");
    const options = padded.slice(0, 4);
    const solutionPlain = row.solution_html ? stripHtmlToPlain(row.solution_html) : "";

    return {
      id: row.id,
      subject: subj,
      topic: row.topic || row.chapter || "Mock",
      classLevel: 12,
      examType: ["JEE_Mains"],
      question: stripHtmlToPlain(row.question_html) || "Question",
      questionHtml: row.question_html,
      solutionHtml: row.solution_html,
      options,
      correctAnswer: letterToIndex(row.correct_letter),
      hint: "",
      solution: solutionPlain,
      reference: emptyReference,
    };
  });
}
