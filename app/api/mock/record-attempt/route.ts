import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import type { MockLibraryHistoryKind } from "@/lib/mock/mockTestAttemptTypes";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SESSION_KINDS: MockLibraryHistoryKind[] = [
  "mock_paper",
  "past_paper",
  "quick_mock",
  "mcq_chapter",
];

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

/** POST — persist finished mock session with per-subject breakdown (all scores, all retakes). */
export async function POST(request: NextRequest) {
  const csrf = enforceSameOriginForCookieAuth(request);
  if (csrf) return csrf;

  const auth = await getSupabaseAndUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const attemptKey = typeof b.attemptKey === "string" ? b.attemptKey.trim() : "";
  if (attemptKey.length < 3 || attemptKey.length > 200) {
    return NextResponse.json({ error: "attemptKey is required" }, { status: 400 });
  }

  const sessionKind = b.sessionKind;
  if (
    typeof sessionKind !== "string" ||
    !SESSION_KINDS.includes(sessionKind as MockLibraryHistoryKind)
  ) {
    return NextResponse.json({ error: "Invalid sessionKind" }, { status: 400 });
  }

  const total = typeof b.total === "number" && Number.isFinite(b.total) ? Math.trunc(b.total) : 0;
  const correct =
    typeof b.correct === "number" && Number.isFinite(b.correct) ? Math.trunc(b.correct) : 0;
  if (total <= 0 || correct < 0 || correct > total) {
    return NextResponse.json({ error: "Invalid correct/total" }, { status: 400 });
  }

  const catalogPaperId =
    typeof b.catalogPaperId === "string" && isUuid(b.catalogPaperId)
      ? b.catalogPaperId.trim()
      : null;
  const pastPaperId =
    typeof b.pastPaperId === "string" && isUuid(b.pastPaperId) ? b.pastPaperId.trim() : null;
  const paperSlug =
    typeof b.paperSlug === "string" && b.paperSlug.trim() ? b.paperSlug.trim() : null;
  const paperTitle =
    typeof b.paperTitle === "string" && b.paperTitle.trim()
      ? b.paperTitle.trim().slice(0, 240)
      : "Mock session";

  const scorePercent = Math.round((100 * correct) / total);

  const durationSeconds =
    typeof b.durationSeconds === "number" && Number.isFinite(b.durationSeconds)
      ? Math.max(0, Math.trunc(b.durationSeconds))
      : null;

  const breakdownRaw = b.subjectBreakdown;
  const subjectBreakdown = Array.isArray(breakdownRaw) ? breakdownRaw : [];

  const { data, error } = await auth.supabase.rpc("record_mock_test_attempt", {
    p_attempt_key: attemptKey,
    p_session_kind: sessionKind,
    p_catalog_paper_id: catalogPaperId,
    p_past_paper_id: pastPaperId,
    p_paper_slug: paperSlug,
    p_paper_title: paperTitle,
    p_score_percent: scorePercent,
    p_correct_count: correct,
    p_total_questions: total,
    p_subject_breakdown: subjectBreakdown,
    p_duration_seconds: durationSeconds,
  });

  if (error) {
    console.error("[mock record-attempt rpc]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const payload = data as Record<string, unknown> | null;
  if (!payload || payload.ok !== true) {
    const msg = typeof payload?.error === "string" ? payload.error : "Could not record attempt";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json(payload);
}
