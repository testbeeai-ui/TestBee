import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

/** POST { paperId: string, answers: number[] } — catalog mock only; server scores vs mock_questions. */
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

  const b = body as { paperId?: unknown; answers?: unknown };
  const paperId = typeof b.paperId === "string" ? b.paperId.trim() : "";
  if (!isUuid(paperId)) {
    return NextResponse.json({ error: "paperId must be a valid UUID" }, { status: 400 });
  }

  const answers = b.answers;
  if (!Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json(
      { error: "answers must be a non-empty array of integers" },
      { status: 400 }
    );
  }

  const normalized: number[] = [];
  for (let i = 0; i < answers.length; i++) {
    const v = answers[i];
    if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v)) {
      return NextResponse.json(
        { error: `answers[${i}] must be an integer (use -1 for blank)` },
        { status: 400 }
      );
    }
    if (v < -1 || v > 3) {
      return NextResponse.json(
        { error: `answers[${i}] must be between -1 and 3` },
        { status: 400 }
      );
    }
    normalized.push(v);
  }

  const { data, error } = await auth.supabase.rpc("claim_mock_rdm_bonus", {
    p_paper_id: paperId,
    p_answer_indices: normalized,
  });

  if (error) {
    console.error("[mock claim-rdm-bonus rpc]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const payload = data as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Unexpected RPC response" }, { status: 500 });
  }

  return NextResponse.json(payload);
}
