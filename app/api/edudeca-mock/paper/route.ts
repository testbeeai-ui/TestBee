import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { loadFilteredMockPaper } from "@/lib/edudeca-mock/load-mock-paper";
import { disciplineTag, isMockPaperLevel } from "@/lib/edudeca-mock/paper-filter";
import { toPublicPaperQuestion } from "@/lib/edudeca-mock/paper-grade";
import { asMockAnswers } from "@/lib/edudeca-mock/pause-attempt";
import { fromPublicTable } from "@/lib/edudeca-mock/tables";
import { enforceStudentMockAccess } from "@/lib/subscription/enforceStudentMockAccess";

const SET_MAX = 20;

function parseIntParam(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export async function GET(request: NextRequest) {
  const levelRaw = parseIntParam(request.nextUrl.searchParams.get("level"));
  const setRaw = parseIntParam(request.nextUrl.searchParams.get("set"));
  if (levelRaw == null || !isMockPaperLevel(levelRaw)) {
    return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }
  if (setRaw == null || !Number.isInteger(setRaw) || setRaw < 1 || setRaw > SET_MAX) {
    return NextResponse.json({ error: "Invalid set" }, { status: 400 });
  }

  const auth = await getSupabaseAndUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, user } = auth;

  const blocked = await enforceStudentMockAccess(supabase, user.id);
  if (blocked) return blocked;

  const loaded = await loadFilteredMockPaper(supabase, user.id, levelRaw, setRaw);
  if (!loaded.ok) {
    return NextResponse.json(loaded.body, { status: loaded.status });
  }

  const attemptRes = await fromPublicTable(supabase, "edudeca_mock_attempts")
    .select("status, answers")
    .eq("user_id", user.id)
    .eq("level", levelRaw)
    .eq("set_number", setRaw)
    .maybeSingle();
  if (attemptRes.error) {
    console.error("[edudeca-mock/paper] attempt", attemptRes.error);
  }
  const attemptRow = attemptRes.data as { status?: unknown; answers?: unknown } | null;
  const attemptStatus = attemptRow?.status;
  const attemptAnswers = asMockAnswers(attemptRow?.answers);
  const attempt =
    attemptStatus === "inprogress" || attemptStatus === "completed"
      ? { status: attemptStatus, answers: attemptAnswers }
      : null;

  const questions = loaded.questions.map((question) =>
    toPublicPaperQuestion(question, disciplineTag(question.discipline_id), true),
  );

  return NextResponse.json({
    level: levelRaw,
    set: setRaw,
    questions,
    attempt,
  });
}
