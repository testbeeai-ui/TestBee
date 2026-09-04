import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { mergeMockAttempt, snapshotFromAttemptRow } from "@/lib/edudeca-mock/attempt-merge";
import {
  filterMockPaper,
  isMockPaperLevel,
  type MockQuestionRow,
} from "@/lib/edudeca-mock/paper-filter";
import { gradeMockAnswers } from "@/lib/edudeca-mock/paper-grade";
import { asMockAnswers } from "@/lib/edudeca-mock/pause-attempt";
import { fromPublicTable, parseJsonOptions } from "@/lib/edudeca-mock/tables";
import { enforceStudentMockAccess } from "@/lib/subscription/enforceStudentMockAccess";

const SET_MAX = 20;

export async function POST(request: NextRequest) {
  let body: { level?: unknown; set?: unknown; answers?: unknown };
  try {
    body = (await request.json()) as { level?: unknown; set?: unknown; answers?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const level = typeof body.level === "number" ? body.level : Number(body.level);
  const setNumber = typeof body.set === "number" ? body.set : Number(body.set);
  if (!isMockPaperLevel(level)) {
    return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }
  if (!Number.isInteger(setNumber) || setNumber < 1 || setNumber > SET_MAX) {
    return NextResponse.json({ error: "Invalid set" }, { status: 400 });
  }

  const auth = await getSupabaseAndUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, user } = auth;

  const blocked = await enforceStudentMockAccess(supabase, user.id);
  if (blocked) return blocked;

  const progressRes = await fromPublicTable(supabase, "edudeca_user_progress")
    .select("disciplines")
    .eq("user_id", user.id)
    .maybeSingle();
  if (progressRes.error) {
    console.error("[edudeca-mock/complete] progress", progressRes.error);
    return NextResponse.json({ error: "Failed to load lineup" }, { status: 500 });
  }

  const questionsRes = await fromPublicTable(supabase, "edudeca_mock_questions")
    .select("id, level, set_number, discipline_id, sort_order, stem, options, correct_index")
    .eq("level", level)
    .eq("set_number", setNumber)
    .eq("published", true);
  if (questionsRes.error) {
    console.error("[edudeca-mock/complete] questions", questionsRes.error);
    return NextResponse.json({ error: "Failed to load paper" }, { status: 500 });
  }

  const rows: MockQuestionRow[] = [];
  const rawRows = Array.isArray(questionsRes.data) ? questionsRes.data : [];
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

  const filtered = filterMockPaper({
    lineup: (progressRes.data as { disciplines?: unknown } | null)?.disciplines,
    questions: rows,
    level,
  });
  if (!filtered.ok) {
    switch (filtered.reason) {
      case "incomplete_lineup":
        return NextResponse.json(
          { error: "Paper unavailable for this lineup", code: filtered.reason },
          { status: 409 },
        );
      case "missing_discipline":
      case "wrong_count":
        return NextResponse.json(
          { error: "Paper unavailable for this lineup", code: filtered.reason },
          { status: 422 },
        );
      default: {
        const _never: never = filtered.reason;
        return _never;
      }
    }
  }

  const answers = asMockAnswers(body.answers);
  const graded = gradeMockAnswers(filtered.questions, answers);

  const existingRes = await fromPublicTable(supabase, "edudeca_mock_attempts")
    .select("level, set_number, status, score_pct, correct, total, answers")
    .eq("user_id", user.id)
    .eq("level", level)
    .eq("set_number", setNumber)
    .maybeSingle();
  if (existingRes.error) {
    console.error("[edudeca-mock/complete] existing", existingRes.error);
    return NextResponse.json({ error: "Failed to load attempt" }, { status: 500 });
  }

  const merged = mergeMockAttempt(snapshotFromAttemptRow(existingRes.data as Record<string, unknown> | null), {
    level,
    setNumber,
    status: "completed",
    scorePct: graded.scorePct,
    correct: graded.correct,
    total: graded.total,
    answers,
  });

  const upsertRes = await fromPublicTable(supabase, "edudeca_mock_attempts").upsert(
    {
      user_id: user.id,
      level: merged.level,
      set_number: merged.setNumber,
      status: merged.status,
      score_pct: merged.scorePct ?? null,
      correct: merged.correct ?? null,
      total: merged.total ?? null,
      answers: merged.answers ?? answers,
    },
    { onConflict: "user_id,level,set_number" },
  );
  if (upsertRes.error) {
    console.error("[edudeca-mock/complete] upsert", upsertRes.error);
    return NextResponse.json({ error: "Failed to save attempt" }, { status: 500 });
  }

  return NextResponse.json({
    level: merged.level,
    set: merged.setNumber,
    status: merged.status,
    correct: merged.correct ?? graded.correct,
    total: merged.total ?? graded.total,
    scorePct: merged.scorePct ?? graded.scorePct,
  });
}
