import type { Question, Subject } from "@/types";

/** Row shape shared by `mock_questions` and `past_paper_questions` selects. */
export type CatalogQuestionRow = {
  id: string;
  subject: string;
  topic: string | null;
  chapter: string | null;
  difficulty?: string | null;
  question_html: string;
  solution_html: string | null;
  correct_letter: string;
  options_json: unknown;
};

function isSubject(s: string): s is Subject {
  return s === "physics" || s === "chemistry" || s === "math" || s === "biology";
}

export function letterToIndex(letter: string): number {
  const L = letter.trim().toUpperCase();
  const i = L.charCodeAt(0) - 65;
  return i >= 0 && i <= 3 ? i : 0;
}

const emptyReference: Question["reference"] = {
  theory: "",
  relatedTopics: [],
  applicationExample: "",
};

export function stripHtmlToPlain(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

/** Maps a Supabase mock/past catalog question row to app `Question`. */
export function mapCatalogQuestionRowToQuestion(
  row: CatalogQuestionRow,
  topicFallback: string
): Question {
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
    topic: row.topic || row.chapter || topicFallback,
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
}
