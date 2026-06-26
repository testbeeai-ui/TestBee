import { NextResponse } from "next/server";
import { createClient, createClientWithToken } from "@/integrations/supabase/server";
import {
  enforceSameOriginForCookieAuth,
  requireAuthenticatedUser,
} from "@/lib/auth/securityGuards";

type SubmitRatingResult = {
  ok?: boolean;
  error?: string;
  stars?: number;
};

/** Student submits a 1-5 star rating for an ended section schedule class (Path A). */
export async function POST(request: Request) {
  const csrf = enforceSameOriginForCookieAuth(request);
  if (csrf) return csrf;

  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  let body: { sectionId?: string; occurrenceAt?: string; stars?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sectionId = typeof body.sectionId === "string" ? body.sectionId.trim() : "";
  const occurrenceAt = typeof body.occurrenceAt === "string" ? body.occurrenceAt.trim() : "";
  const stars = Math.round(Number(body.stars));

  if (!sectionId || !occurrenceAt) {
    return NextResponse.json({ error: "sectionId and occurrenceAt are required" }, { status: 400 });
  }
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return NextResponse.json({ error: "stars must be an integer 1-5" }, { status: 400 });
  }

  // RPC uses auth.uid(), so call with a user-scoped client (not the admin client).
  const db = auth.accessToken ? createClientWithToken(auth.accessToken) : await createClient();

  const { data, error } = await db.rpc("submit_live_class_rating", {
    p_section_id: sectionId,
    p_occurrence_at: occurrenceAt,
    p_stars: stars,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (data ?? {}) as SubmitRatingResult;
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "rating_failed" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, stars: result.stars ?? stars });
}
