import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { parseGradeableQuestion } from "@/lib/edudeca-mock/load-mock-paper";
import { isMockPaperLevel } from "@/lib/edudeca-mock/paper-filter";
import { gradeClientSelection } from "@/lib/edudeca-mock/paper-grade";
import { fromPublicTable } from "@/lib/edudeca-mock/tables";

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

  const questionRes = await fromPublicTable(auth.supabase, "edudeca_mock_questions")
    .select("id, options, correct_index")
    .eq("id", questionId)
    .eq("level", level)
    .eq("set_number", setNumber)
    .eq("published", true)
    .maybeSingle();
  if (questionRes.error) {
    console.error("[edudeca-mock/check] question", questionRes.error);
    return NextResponse.json({ error: "Failed to check answer" }, { status: 500 });
  }

  const question = parseGradeableQuestion(questionRes.data);
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  return NextResponse.json(gradeClientSelection(question, selected, clientOptions));
}
