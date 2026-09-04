import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { mergeMockAttempt, snapshotFromAttemptRow } from "@/lib/edudeca-mock/attempt-merge";
import { parsePauseRequest } from "@/lib/edudeca-mock/pause-attempt";
import { fromPublicTable } from "@/lib/edudeca-mock/tables";
import { enforceStudentMockAccess } from "@/lib/subscription/enforceStudentMockAccess";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parsePauseRequest(body);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid pause payload" }, { status: 400 });
  }

  const auth = await getSupabaseAndUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, user } = auth;

  const blocked = await enforceStudentMockAccess(supabase, user.id);
  if (blocked) return blocked;

  const existingRes = await fromPublicTable(supabase, "edudeca_mock_attempts")
    .select("level, set_number, status, score_pct, correct, total, answers")
    .eq("user_id", user.id)
    .eq("level", parsed.level)
    .eq("set_number", parsed.set)
    .maybeSingle();
  if (existingRes.error) {
    console.error("[edudeca-mock/pause] existing", existingRes.error);
    return NextResponse.json({ error: "Failed to load attempt" }, { status: 500 });
  }

  const merged = mergeMockAttempt(
    snapshotFromAttemptRow(existingRes.data as Record<string, unknown> | null),
    {
      level: parsed.level,
      setNumber: parsed.set,
      status: "inprogress",
      answers: parsed.answers,
    },
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
      answers: merged.answers ?? parsed.answers,
    },
    { onConflict: "user_id,level,set_number" },
  );
  if (upsertRes.error) {
    console.error("[edudeca-mock/pause] upsert", upsertRes.error);
    return NextResponse.json({ error: "Failed to save attempt" }, { status: 500 });
  }

  return NextResponse.json({
    level: merged.level,
    set: merged.setNumber,
    status: merged.status,
  });
}
