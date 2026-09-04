import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { mergeMockAttempt, snapshotFromAttemptRow } from "@/lib/edudeca-mock/attempt-merge";
import { loadFilteredMockPaper } from "@/lib/edudeca-mock/load-mock-paper";
import { isMockPaperLevel } from "@/lib/edudeca-mock/paper-filter";
import { gradeClientSelection } from "@/lib/edudeca-mock/paper-grade";
import { asMockAnswers } from "@/lib/edudeca-mock/pause-attempt";
import { fromPublicTable } from "@/lib/edudeca-mock/tables";
import { enforceStudentMockAccess } from "@/lib/subscription/enforceStudentMockAccess";

const SET_MAX = 20;

export async function POST(request: NextRequest) {
  let body: {
    level?: unknown;
    set?: unknown;
    questionId?: unknown;
    selected?: unknown;
    options?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const level = typeof body.level === "number" ? body.level : Number(body.level);
  const setNumber = typeof body.set === "number" ? body.set : Number(body.set);
  const questionId = typeof body.questionId === "string" ? body.questionId : "";
  const selected = typeof body.selected === "string" ? body.selected : "";
  const clientOptions = Array.isArray(body.options)
    ? body.options.filter((item): item is string => typeof item === "string")
    : [];
  if (!isMockPaperLevel(level)) {
    return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }
  if (!Number.isInteger(setNumber) || setNumber < 1 || setNumber > SET_MAX) {
    return NextResponse.json({ error: "Invalid set" }, { status: 400 });
  }
  if (!questionId || selected === "" || clientOptions.length !== 4) {
    return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
  }

  const auth = await getSupabaseAndUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, user } = auth;

  const blocked = await enforceStudentMockAccess(supabase, user.id);
  if (blocked) return blocked;

  const loaded = await loadFilteredMockPaper(supabase, user.id, level, setNumber);
  if (!loaded.ok) {
    return NextResponse.json(loaded.body, { status: loaded.status });
  }

  const question = loaded.questions.find((row) => row.id === questionId);
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const graded = gradeClientSelection(question, selected, clientOptions);

  const existingRes = await fromPublicTable(supabase, "edudeca_mock_attempts")
    .select("level, set_number, status, score_pct, correct, total, answers")
    .eq("user_id", user.id)
    .eq("level", level)
    .eq("set_number", setNumber)
    .maybeSingle();
  if (existingRes.error) {
    console.error("[edudeca-mock/check] existing", existingRes.error);
  } else {
    const existingAnswers = asMockAnswers(
      (existingRes.data as { answers?: unknown } | null)?.answers
    );
    const merged = mergeMockAttempt(
      snapshotFromAttemptRow(existingRes.data as Record<string, unknown> | null),
      {
        level,
        setNumber,
        status: "inprogress",
        answers: { ...existingAnswers, [questionId]: selected },
      }
    );
    const upsertRes = await fromPublicTable(supabase, "edudeca_mock_attempts").upsert(
      {
        user_id: user.id,
        level: merged.level,
        set_number: merged.setNumber,
        status: merged.status,
        score_pct: merged.scorePct ?? null,
        correct: merged.correct ?? null,
        total: merged.total ?? null,
        answers: merged.answers ?? { [questionId]: selected },
      },
      { onConflict: "user_id,level,set_number" }
    );
    if (upsertRes.error) {
      console.error("[edudeca-mock/check] upsert", upsertRes.error);
    }
  }

  return NextResponse.json(graded);
}
