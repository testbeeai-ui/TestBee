import { supabase } from "@/integrations/supabase/client";
import { stripHtmlToPlain } from "@/lib/mock/catalogQuestionMap";
import type { Question } from "@/types";

type GradeRow = {
  id: string;
  correct_index: number;
  solution_html: string | null;
  is_correct: boolean;
};

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function rpcClient(): RpcClient {
  return supabase as unknown as RpcClient;
}

export async function gradeCatalogAnswers(
  source: "mock" | "past_paper",
  answers: { id: string; selected: number | null | undefined }[]
): Promise<Map<string, GradeRow>> {
  const payload = answers
    .filter((row) => row.id)
    .slice(0, 120)
    .map((row) => ({
      id: row.id,
      selected: typeof row.selected === "number" ? row.selected : null,
    }));
  if (payload.length === 0) return new Map();

  const { data, error } = await rpcClient().rpc("grade_catalog_answers", {
    p_source: source,
    p_answers: payload,
  });
  if (error) return new Map();
  const body = data as { ok?: boolean; results?: GradeRow[] } | null;
  if (!body?.ok || !Array.isArray(body.results)) return new Map();
  return new Map(body.results.map((row) => [row.id, row]));
}

export function applyCatalogGrades(questions: Question[], grades: Map<string, GradeRow>): Question[] {
  if (grades.size === 0) return questions;
  return questions.map((question) => {
    const grade = grades.get(question.id);
    if (!grade) return question;
    const solutionPlain = grade.solution_html ? stripHtmlToPlain(grade.solution_html) : "";
    return {
      ...question,
      correctAnswer: grade.correct_index,
      solutionHtml: grade.solution_html,
      solution: solutionPlain,
    };
  });
}

export type PlayAnswerCheck = {
  isCorrect: boolean;
  correctIndex: number;
  explanation: string | null;
};

export async function checkPlayAnswer(
  questionId: string,
  selectedOriginIndex: number
): Promise<PlayAnswerCheck | null> {
  const { data, error } = await rpcClient().rpc("check_play_answer", {
    p_question_id: questionId,
    p_selected_index: selectedOriginIndex,
  });
  if (error) return null;
  const body = data as {
    ok?: boolean;
    is_correct?: boolean;
    correct_index?: number;
    explanation?: string | null;
  } | null;
  if (!body?.ok || typeof body.correct_index !== "number") return null;
  return {
    isCorrect: body.is_correct === true,
    correctIndex: body.correct_index,
    explanation: body.explanation ?? null,
  };
}
