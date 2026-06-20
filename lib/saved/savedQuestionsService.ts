import { supabase } from "@/integrations/supabase/client";
import {
  mapCatalogQuestionRowToQuestion,
  type CatalogQuestionRow,
} from "@/lib/mock/catalogQuestionMap";
import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import type { Question } from "@/types";

export type SavedQuestionSource = "mock" | "past_paper" | "static";

export type SavedQuestionRow = {
  question_id: string;
  source_type: SavedQuestionSource;
  created_at: string;
};

const CATALOG_QUESTION_SELECT =
  "id, paper_id, sort_order, subject, topic, chapter, difficulty, question_html, solution_html, correct_letter, options_json";

function isSavedQuestionSource(s: string): s is SavedQuestionSource {
  return s === "mock" || s === "past_paper" || s === "static";
}

/** Upsert bookmark via API (plan cap enforced server-side). Prefer over saveQuestionToDb from the client. */
export async function persistSavedQuestion(
  questionId: string,
  sourceType: SavedQuestionSource
): Promise<{ error: Error | null; limitReached?: boolean }> {
  try {
    const headers = await getClientApiAuthHeaders();
    const res = await fetch("/api/user/saved-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ questionId, sourceType }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      limitReached?: boolean;
    };
    if (!res.ok) {
      return {
        error: new Error(data.error ?? "Could not save question"),
        limitReached: res.status === 403 || data.limitReached === true,
      };
    }
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error("Could not save question") };
  }
}

/** @deprecated Use persistSavedQuestion — direct insert bypasses plan caps. */
export async function saveQuestionToDb(
  userId: string,
  questionId: string,
  sourceType: SavedQuestionSource
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("saved_questions").upsert(
    {
      user_id: userId,
      question_id: questionId,
      source_type: sourceType,
    },
    { onConflict: "user_id,question_id,source_type" }
  );
  return { error: error ? new Error(error.message) : null };
}

export async function unsaveQuestionFromDb(
  userId: string,
  questionId: string,
  sourceType: SavedQuestionSource
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("saved_questions")
    .delete()
    .eq("user_id", userId)
    .eq("question_id", questionId)
    .eq("source_type", sourceType);
  return { error: error ? new Error(error.message) : null };
}

export async function fetchSavedQuestionRows(userId: string): Promise<SavedQuestionRow[]> {
  const { data, error } = await supabase
    .from("saved_questions")
    .select("question_id, source_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { question_id: string; source_type: string; created_at: string }[];
  return rows
    .filter((r) => isSavedQuestionSource(r.source_type))
    .map(
      (r): SavedQuestionRow => ({
        question_id: r.question_id,
        source_type: r.source_type as SavedQuestionSource,
        created_at: r.created_at,
      })
    );
}

async function fetchMockQuestionsByIds(ids: string[]): Promise<Map<string, Question>> {
  const map = new Map<string, Question>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase
    .from("mock_questions")
    .select(CATALOG_QUESTION_SELECT)
    .in("id", ids);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as CatalogQuestionRow[]) {
    map.set(row.id, mapCatalogQuestionRowToQuestion(row, "Mock"));
  }
  return map;
}

async function fetchPastQuestionsByIds(ids: string[]): Promise<Map<string, Question>> {
  const map = new Map<string, Question>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase
    .from("past_paper_questions")
    .select(CATALOG_QUESTION_SELECT)
    .in("id", ids);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as CatalogQuestionRow[]) {
    map.set(row.id, mapCatalogQuestionRowToQuestion(row, "Past Paper"));
  }
  return map;
}

/**
 * Resolve saved rows to `Question` objects in the same order as `rows` (newest first).
 * Missing catalog rows are skipped (stale ids).
 */
export async function hydrateSavedQuestionsFromRows(
  rows: SavedQuestionRow[],
  staticBank: Question[]
): Promise<{ orderedQuestions: Question[]; resolvedIds: Set<string> }> {
  const mockIds = rows.filter((r) => r.source_type === "mock").map((r) => r.question_id);
  const pastIds = rows.filter((r) => r.source_type === "past_paper").map((r) => r.question_id);
  const [mockMap, pastMap] = await Promise.all([
    fetchMockQuestionsByIds(mockIds),
    fetchPastQuestionsByIds(pastIds),
  ]);

  const staticById = new Map(staticBank.map((q) => [q.id, q]));

  const orderedQuestions: Question[] = [];
  const resolvedIds = new Set<string>();

  for (const row of rows) {
    let q: Question | undefined;
    if (row.source_type === "mock") {
      q = mockMap.get(row.question_id);
    } else if (row.source_type === "past_paper") {
      q = pastMap.get(row.question_id);
    } else {
      q = staticById.get(row.question_id);
    }
    if (q) {
      orderedQuestions.push(q);
      resolvedIds.add(row.question_id);
    }
  }

  return { orderedQuestions, resolvedIds };
}
