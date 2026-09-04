import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import {
  disciplineTag,
  filterMockPaper,
  isMockPaperLevel,
  type MockQuestionRow,
} from "@/lib/edudeca-mock/paper-filter";
import { asMockAnswers } from "@/lib/edudeca-mock/pause-attempt";
import { shuffleQuestionOptions } from "@/lib/edudeca-mock/paper-grade";
import { fromPublicTable, parseJsonOptions } from "@/lib/edudeca-mock/tables";
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

  const progressRes = await fromPublicTable(supabase, "edudeca_user_progress")
    .select("disciplines")
    .eq("user_id", user.id)
    .maybeSingle();
  if (progressRes.error) {
    console.error("[edudeca-mock/paper] progress", progressRes.error);
    return NextResponse.json({ error: "Failed to load lineup" }, { status: 500 });
  }
  const disciplines = (progressRes.data as { disciplines?: unknown } | null)?.disciplines;

  const questionsRes = await fromPublicTable(supabase, "edudeca_mock_questions")
    .select("id, level, set_number, discipline_id, sort_order, stem, options, correct_index")
    .eq("level", levelRaw)
    .eq("set_number", setRaw)
    .eq("published", true);

  if (questionsRes.error) {
    console.error("[edudeca-mock/paper] questions", questionsRes.error);
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
    lineup: disciplines,
    questions: rows,
    level: levelRaw,
  });

  if (!filtered.ok) {
    switch (filtered.reason) {
      case "incomplete_lineup":
        return NextResponse.json(
          {
            error: "Pick your 10 disciplines on EduDeca",
            code: "INCOMPLETE_LINEUP",
          },
          { status: 409 },
        );
      case "missing_discipline":
      case "wrong_count":
        return NextResponse.json(
          {
            error: "This mock set is not available for your 10 disciplines",
            code: "MISSING_DISCIPLINE",
          },
          { status: 422 },
        );
      default: {
        const _never: never = filtered.reason;
        return _never;
      }
    }
  }

  const questions = filtered.questions.map((question) => {
    const shuffled = shuffleQuestionOptions(question);
    return {
      id: shuffled.id,
      tag: disciplineTag(shuffled.discipline_id),
      q: shuffled.stem,
      options: shuffled.options,
      correctIndex: shuffled.correct_index,
    };
  });

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
  const attempt =
    attemptStatus === "inprogress" || attemptStatus === "completed"
      ? { status: attemptStatus, answers: asMockAnswers(attemptRow?.answers) }
      : null;

  return NextResponse.json({
    level: levelRaw,
    set: setRaw,
    questions,
    attempt,
  });
}
