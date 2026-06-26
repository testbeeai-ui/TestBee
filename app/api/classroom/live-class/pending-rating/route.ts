import { NextResponse } from "next/server";
import { createClient, createClientWithToken } from "@/integrations/supabase/server";
import { requireAuthenticatedUser } from "@/lib/auth/securityGuards";

type PendingRatingResult = {
  ok?: boolean;
  error?: string;
  has_pending?: boolean;
  section_id?: string;
  classroom_id?: string;
  occurrence_at?: string;
  title?: string;
};

/** Returns the most recent section schedule class this student can still rate (or none). */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const db = auth.accessToken ? createClientWithToken(auth.accessToken) : await createClient();

  const { data, error } = await db.rpc("get_pending_live_class_rating");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (data ?? {}) as PendingRatingResult;
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "lookup_failed" }, { status: 400 });
  }

  if (!result.has_pending) {
    return NextResponse.json({ ok: true, hasPending: false });
  }

  return NextResponse.json({
    ok: true,
    hasPending: true,
    sectionId: result.section_id,
    classroomId: result.classroom_id,
    occurrenceAt: result.occurrence_at,
    title: result.title,
  });
}
