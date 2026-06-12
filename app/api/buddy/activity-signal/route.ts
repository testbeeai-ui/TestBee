import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/integrations/supabase/server";
import { viewerHasActiveBuddy } from "@/lib/buddy/activeBuddyLink";
import { requireAuthenticatedUser } from "@/lib/auth/securityGuards";
import {
  buddyPresenceFingerprint,
  buildBuddyActivityRevision,
} from "@/lib/buddy/buddyActivityRevision";
import { latestLessonMarkedAtFromEngagement } from "@/lib/buddy/listBuddyCompletedSubtopics";
import { latestBuddyTopicQuizAttempt } from "@/lib/buddy/listBuddyQuizMcq";
import { flushSitePresenceToPostgres } from "@/lib/presence/sitePresenceBuffer";

/**
 * GET /api/buddy/activity-signal — cheap revision check (1–2 indexed reads).
 * Client compares `revision` and only calls /api/buddy/dashboard when it changes.
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const supabase = await createClient();
  const uid = auth.user.id;
  const url = new URL(request.url);
  const requestedBuddyId = url.searchParams.get("buddyId")?.trim() || null;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }
  const db = admin;

  let buddyId = requestedBuddyId;
  if (buddyId) {
    const linked = await viewerHasActiveBuddy(db, uid, buddyId);
    if (!linked) return NextResponse.json({ error: "not_your_buddy" }, { status: 403 });
  } else {
    const { data: pair, error: pairErr } = await db
      .from("study_buddies")
      .select("buddy_user_id")
      .eq("user_id", uid)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pairErr) return NextResponse.json({ error: pairErr.message }, { status: 500 });
    if (!pair?.buddy_user_id) {
      return NextResponse.json({ error: "no_active_buddy" }, { status: 404 });
    }
    buddyId = pair.buddy_user_id;
  }

  await flushSitePresenceToPostgres(db, buddyId);

  const [
    presenceRes,
    dwellRes,
    completionRes,
    profileRes,
    gyanDoubtRes,
    communityPostRes,
    gyanPresenceRes,
    sitePresenceRes,
  ] = await Promise.all([
    db
      .from("student_learning_presence" as never)
      .select("board, subject, class_level, topic, subtopic_name, level, panel, updated_at")
      .eq("user_id" as never, buddyId as never)
      .maybeSingle(),
    supabase
      .from("student_learning_dwell_events")
      .select("occurred_at")
      .eq("user_id", buddyId)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("student_lesson_mark_completions" as never)
      .select("marked_complete_at" as never)
      .eq("user_id" as never, buddyId as never)
      .order("marked_complete_at" as never, { ascending: false })
      .limit(1),
    db
      .from("profiles")
      .select("subtopic_engagement, bits_test_attempts")
      .eq("id", buddyId)
      .maybeSingle(),
    db
      .from("doubts")
      .select("created_at")
      .eq("user_id", buddyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("lessons_raw_posts")
      .select("created_at")
      .eq("user_id", buddyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("student_gyan_presence" as never)
      .select("updated_at")
      .eq("user_id" as never, buddyId as never)
      .maybeSingle(),
    db
      .from("student_site_presence" as never)
      .select("updated_at")
      .eq("user_id" as never, buddyId as never)
      .maybeSingle(),
  ]);

  if (presenceRes.error) {
    return NextResponse.json({ error: presenceRes.error.message }, { status: 500 });
  }
  if (dwellRes.error) {
    return NextResponse.json({ error: dwellRes.error.message }, { status: 500 });
  }
  if (completionRes.error) {
    return NextResponse.json({ error: completionRes.error.message }, { status: 500 });
  }
  if (profileRes.error) {
    return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
  }

  type PresenceRow = {
    board: string;
    subject: string;
    class_level: number;
    topic: string;
    subtopic_name: string;
    level: string;
    panel: string;
    updated_at: string;
  };

  const presence = presenceRes.data as unknown as PresenceRow | null;
  const presenceFingerprint = presence ? buddyPresenceFingerprint(presence) : null;
  const dwellOccurredAt = dwellRes.data?.occurred_at ?? null;
  type CompletionRow = { marked_complete_at: string };
  const completionRows = completionRes.data as unknown as CompletionRow[] | null;
  const tableMarkedAt = completionRows?.[0]?.marked_complete_at ?? null;
  const engagementMarkedAt = latestLessonMarkedAtFromEngagement(
    profileRes.data?.subtopic_engagement
  );
  const lessonMarkedAt =
    tableMarkedAt && engagementMarkedAt
      ? Date.parse(tableMarkedAt) >= Date.parse(engagementMarkedAt)
        ? tableMarkedAt
        : engagementMarkedAt
      : (tableMarkedAt ?? engagementMarkedAt);
  const latestQuiz = latestBuddyTopicQuizAttempt(profileRes.data?.bits_test_attempts);
  const revision = buildBuddyActivityRevision({
    presenceFingerprint,
    dwellOccurredAt,
    lessonMarkedAt,
    topicQuizSubmittedAt: latestQuiz?.submittedAt ?? null,
    latestGyanDoubtAt: gyanDoubtRes.data?.created_at ?? null,
    latestCommunityPostAt: communityPostRes.data?.created_at ?? null,
    gyanPresenceUpdatedAt:
      (gyanPresenceRes.data as { updated_at?: string } | null)?.updated_at ?? null,
    sitePresenceUpdatedAt:
      (sitePresenceRes.data as { updated_at?: string } | null)?.updated_at ?? null,
  });

  return NextResponse.json(
    {
      revision,
      presenceUpdatedAt: presence?.updated_at ?? null,
      dwellOccurredAt,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    }
  );
}
