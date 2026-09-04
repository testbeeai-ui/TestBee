import type { SupabaseClient } from "@supabase/supabase-js";

import { filterMockPaper, type MockPaperLevel, type MockQuestionRow } from "./paper-filter";
import { fromPublicTable, parseJsonOptions } from "./tables";

export function parseMockQuestionRows(data: unknown): MockQuestionRow[] {
  const rows: MockQuestionRow[] = [];
  const rawRows = Array.isArray(data) ? data : [];
  for (const item of rawRows) {
    const row = item as Record<string, unknown>;
    const options = parseJsonOptions(row.options);
    if (options.length !== 4) continue;
    if (typeof row.id !== "string" || typeof row.discipline_id !== "string") continue;
    if (typeof row.sort_order !== "number" || typeof row.correct_index !== "number") continue;
    rows.push({
      id: row.id,
      level: Number(row.level),
      set_number: Number(row.set_number),
      discipline_id: row.discipline_id,
      sort_order: row.sort_order,
      stem: String(row.stem ?? ""),
      options,
      correct_index: row.correct_index,
    });
  }
  return rows;
}

type LoadFailure = {
  ok: false;
  status: number;
  body: Record<string, unknown>;
};

type LoadSuccess = {
  ok: true;
  questions: MockQuestionRow[];
};

export async function loadFilteredMockPaper(
  supabase: SupabaseClient,
  userId: string,
  level: MockPaperLevel,
  setNumber: number
): Promise<LoadSuccess | LoadFailure> {
  const progressRes = await fromPublicTable(supabase, "edudeca_user_progress")
    .select("disciplines")
    .eq("user_id", userId)
    .maybeSingle();
  if (progressRes.error) {
    return { ok: false, status: 500, body: { error: "Failed to load lineup" } };
  }

  const questionsRes = await fromPublicTable(supabase, "edudeca_mock_questions")
    .select("id, level, set_number, discipline_id, sort_order, stem, options, correct_index")
    .eq("level", level)
    .eq("set_number", setNumber)
    .eq("published", true);
  if (questionsRes.error) {
    return { ok: false, status: 500, body: { error: "Failed to load paper" } };
  }

  const filtered = filterMockPaper({
    lineup: (progressRes.data as { disciplines?: unknown } | null)?.disciplines,
    questions: parseMockQuestionRows(questionsRes.data),
    level,
  });
  if (!filtered.ok) {
    switch (filtered.reason) {
      case "incomplete_lineup":
        return {
          ok: false,
          status: 409,
          body: {
            error: "Pick your 10 disciplines on EduDeca",
            code: "INCOMPLETE_LINEUP",
          },
        };
      case "missing_discipline":
      case "wrong_count":
        return {
          ok: false,
          status: 422,
          body: {
            error: "This mock set is not available for your 10 disciplines",
            code: "MISSING_DISCIPLINE",
          },
        };
      default: {
        const _never: never = filtered.reason;
        return _never;
      }
    }
  }
  return { ok: true, questions: filtered.questions };
}
