import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isMockPaperLevel } from "@/lib/edudeca-mock/paper-filter";
import { fromPublicTable } from "@/lib/edudeca-mock/tables";

const SET_MAX = 20;

export async function GET(request: NextRequest) {
  const auth = await getSupabaseAndUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, user } = auth;

  const res = await fromPublicTable(supabase, "edudeca_mock_attempts")
    .select("level, set_number, status, score_pct, correct, total")
    .eq("user_id", user.id);
  if (res.error) {
    console.error("[edudeca-mock/attempts]", res.error);
    return NextResponse.json({ error: "Failed to load attempts" }, { status: 500 });
  }

  const attempts: Array<{
    level: number;
    set: number;
    status: "inprogress" | "completed";
    scorePct?: number;
    correct?: number;
    total?: number;
  }> = [];

  const rows = Array.isArray(res.data) ? res.data : [];
  for (const item of rows) {
    const row = item as Record<string, unknown>;
    const level = Number(row.level);
    const setNumber = Number(row.set_number);
    const status = row.status;
    if (!isMockPaperLevel(level) || !Number.isInteger(setNumber)) continue;
    if (setNumber < 1 || setNumber > SET_MAX) continue;
    if (status !== "completed" && status !== "inprogress") continue;
    attempts.push({
      level,
      set: setNumber,
      status,
      scorePct: typeof row.score_pct === "number" ? row.score_pct : undefined,
      correct: typeof row.correct === "number" ? row.correct : undefined,
      total: typeof row.total === "number" ? row.total : undefined,
    });
  }

  return NextResponse.json({ attempts });
}
