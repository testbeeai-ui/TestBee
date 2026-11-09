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

const GRADE_CHUNK = 120;
const SAVED_REVEAL_CHUNK = 200;

export class CatalogGradeError extends Error {
  constructor(message = "Could not grade these answers. Check your connection and submit again.") {
    super(message);
    this.name = "CatalogGradeError";
  }
}

function gradeFailureMessage(errorCode: string | undefined): string {
  if (errorCode === "rate_limited") {
    return "Scoring is temporarily busy. Wait a moment and submit again.";
  }
  if (errorCode === "auth_required") {
    return "Sign in again to score this test.";
  }
  return "Could not grade these answers. Check your connection and submit again.";
}

async function gradeCatalogChunk(
  source: "mock" | "past_paper",
  payload: { id: string; selected: number | null }[]
): Promise<GradeRow[]> {
  let lastMessage = gradeFailureMessage(undefined);
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await rpcClient().rpc("grade_catalog_answers", {
      p_source: source,
      p_answers: payload,
    });
    if (error) {
      lastMessage = gradeFailureMessage(undefined);
      continue;
    }
    const body = data as { ok?: boolean; error?: string; results?: GradeRow[] } | null;
    if (body?.ok && Array.isArray(body.results)) return body.results;
    lastMessage = gradeFailureMessage(body?.error);
    if (body?.error === "invalid_input" || body?.error === "auth_required") break;
  }
  throw new CatalogGradeError(lastMessage);
}

export async function gradeCatalogAnswers(
  source: "mock" | "past_paper",
  answers: { id: string; selected: number | null | undefined }[]
): Promise<Map<string, GradeRow>> {
  const payload = answers
    .filter((row) => row.id)
    .map((row) => ({
      id: row.id,
      selected: typeof row.selected === "number" ? row.selected : null,
    }));
  if (payload.length === 0) return new Map();

  const grades = new Map<string, GradeRow>();
  for (let offset = 0; offset < payload.length; offset += GRADE_CHUNK) {
    const rows = await gradeCatalogChunk(source, payload.slice(offset, offset + GRADE_CHUNK));
    for (const row of rows) grades.set(row.id, row);
  }
  return grades;
}

export function catalogGradesCoverQuestions(
  questions: { id: string; correctAnswer: number }[],
  grades: Map<string, { correct_index: number }>
): boolean {
  return questions.every((question) => question.correctAnswer >= 0 || grades.has(question.id));
}

type SavedRevealRow = {
  id: string;
  correct_index: number;
  solution_html: string | null;
};

export async function revealSavedCatalogAnswers(
  source: "mock" | "past_paper",
  ids: string[]
): Promise<Map<string, GradeRow>> {
  const uniqueIds = [...new Set(ids.filter((id) => id))];
  const grades = new Map<string, GradeRow>();
  if (uniqueIds.length === 0) return grades;

  for (let offset = 0; offset < uniqueIds.length; offset += SAVED_REVEAL_CHUNK) {
    const chunk = uniqueIds.slice(offset, offset + SAVED_REVEAL_CHUNK);
    let revealed: SavedRevealRow[] | null = null;
    let lastMessage = "Could not load saved answers";
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error } = await rpcClient().rpc("reveal_saved_catalog_questions", {
        p_source: source,
        p_ids: chunk,
      });
      if (error) {
        lastMessage = error.message || lastMessage;
        continue;
      }
      const body = data as { ok?: boolean; error?: string; results?: SavedRevealRow[] } | null;
      if (body?.ok && Array.isArray(body.results)) {
        revealed = body.results;
        break;
      }
      lastMessage = body?.error || lastMessage;
      if (body?.error === "invalid_input" || body?.error === "auth_required") break;
    }
    if (!revealed) throw new Error(lastMessage);
    for (const row of revealed) {
      if (!row?.id || typeof row.correct_index !== "number") continue;
      grades.set(row.id, {
        id: row.id,
        correct_index: row.correct_index,
        solution_html: row.solution_html ?? null,
        is_correct: false,
      });
    }
  }
  return grades;
}

export function applyCatalogGrades(
  questions: Question[],
  grades: Map<string, GradeRow>
): Question[] {
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
