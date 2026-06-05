import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/integrations/supabase/server";
import {
  enforceSameOriginForCookieAuth,
  requireAuthenticatedUser,
} from "@/lib/auth/securityGuards";
import { feedbackSubmissionsTable } from "@/lib/feedback/feedbackDb";

type FeedbackRole = "student" | "teacher" | "parent";

function isRole(v: unknown): v is FeedbackRole {
  return v === "student" || v === "teacher" || v === "parent";
}

/** POST /api/platform-feedback — persist Settings feedback survey. */
export async function POST(request: Request) {
  const csrfFail = enforceSameOriginForCookieAuth(request);
  if (csrfFail) return csrfFail;

  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const role = body.role;
  const overall = Number(body.overall);
  if (!isRole(role) || !Number.isInteger(overall) || overall < 1 || overall > 5) {
    return NextResponse.json({ error: "Invalid role or overall rating" }, { status: 400 });
  }

  const features = Array.isArray(body.features)
    ? body.features.filter((x) => typeof x === "string").slice(0, 3)
    : [];
  if (features.length < 1) {
    return NextResponse.json({ error: "Select at least one feature" }, { status: 400 });
  }

  const extraVal = typeof body.extraVal === "string" ? body.extraVal : null;
  const ratings =
    body.ratings && typeof body.ratings === "object" && !Array.isArray(body.ratings)
      ? body.ratings
      : {};

  let nps: number | null = null;
  if (body.nps !== null && body.nps !== undefined) {
    const n = Number(body.nps);
    if (!Number.isInteger(n) || n < 0 || n > 10) {
      return NextResponse.json({ error: "Invalid NPS score" }, { status: 400 });
    }
    nps = n;
  }

  const issueCategory =
    typeof body.issueCategory === "string" && body.issueCategory.trim()
      ? body.issueCategory.trim().slice(0, 120)
      : null;
  const issueText = typeof body.issueText === "string" ? body.issueText.trim().slice(0, 1000) : "";
  const suggestion =
    typeof body.suggestion === "string" ? body.suggestion.trim().slice(0, 4000) : "";

  const supabase = await createClient();
  const admin = createAdminClient();
  const writer = admin ?? supabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", auth.user.id)
    .maybeSingle();

  const userDisplayName =
    (typeof profile?.name === "string" && profile.name.trim()) ||
    auth.user.user_metadata?.full_name ||
    auth.user.user_metadata?.name ||
    null;
  const userEmail = auth.user.email ?? null;

  const row = {
    user_id: auth.user.id,
    user_email: userEmail,
    user_display_name: userDisplayName,
    source: "settings_feedback",
    role,
    overall_rating: overall,
    features,
    extra_value: extraVal,
    specific_ratings: ratings,
    nps,
    issue_category: issueCategory,
    issue_text: issueText,
    suggestion,
    admin_status: "new",
  };

  const { data: inserted, error } = await feedbackSubmissionsTable(writer)
    .insert(row)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[platform-feedback] insert", error.message, error.details, error.code);
    const msg = error.message.includes("does not exist")
      ? "Feedback table not ready — run Supabase migrations (platform_feedback_submissions)."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const submissionId = (inserted as { id?: string } | null)?.id ?? null;

  return NextResponse.json({ ok: true, id: submissionId });
}
