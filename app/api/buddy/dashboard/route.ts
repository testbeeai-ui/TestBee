import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/integrations/supabase/server";
import { buildBuddyAdvancedSections } from "@/lib/buddy/buildBuddyAdvancedSections";
import {
  buildPrivacyNotice,
  maskDashboardForPrivacy,
  parseBuddyPrivacySettings,
} from "@/lib/buddy/buddyPrivacy";
import { viewerHasActiveBuddy } from "@/lib/buddy/activeBuddyLink";
import { requireAuthenticatedUser } from "@/lib/auth/securityGuards";
import { listBuddyCompletedSubtopics } from "@/lib/buddy/listBuddyCompletedSubtopics";
import { listBuddyMcqRecentMerged } from "@/lib/buddy/listBuddyQuizMcq";
import { resolveBuddyRightNow } from "@/lib/buddy/resolveBuddyRightNow";
import { resolveBuddySubtopicActivity } from "@/lib/buddy/resolveBuddySubtopicActivity";
import { buildTopicPath } from "@/lib/curriculum/topicRoutes";
import { normalizeBuddyRdm } from "@/lib/buddy/buddyClient";
import { buildBuddyPlayArenaFeed } from "@/lib/buddy/buildBuddyPlayArenaFeed";
import {
  BUDDY_ACTIVITY_RECENT_MS,
  BUDDY_LIVE_WINDOW_MS,
  resolveBuddyIsOnline,
} from "@/lib/buddy/buddyPresence";
import { computeBuddyPlayArena, todayUtcDateString } from "@/lib/buddy/computeBuddyPlayArena";
import { DEFAULT_RDM_CONFIG, type RdmConfigParams } from "@/lib/rdm/rdmConfig";
import type { DifficultyLevel, Subject } from "@/types";

function todayIstDateString(): string {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return f.format(new Date());
}

function asDifficultyLevel(value: string): DifficultyLevel {
  if (value === "intermediate" || value === "advanced") return value;
  return "basics";
}

function asSubject(value: string | null | undefined): Subject | null {
  const v = (value ?? "").toLowerCase();
  if (v === "physics" || v === "chemistry" || v === "math") return v;
  return null;
}

/** GET /api/buddy/dashboard — bundled activity feed for the signed-in user's buddy. */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const supabase = await createClient();
  const uid = auth.user.id;
  const url = new URL(request.url);
  const requestedBuddyId = url.searchParams.get("buddyId")?.trim() || null;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not set" },
      { status: 500 }
    );
  }

  let buddyId = requestedBuddyId;
  if (buddyId) {
    const linked = await viewerHasActiveBuddy(admin, uid, buddyId);
    if (!linked) return NextResponse.json({ error: "not_your_buddy" }, { status: 403 });
  } else {
    const { data: pair, error: pairErr } = await admin
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

  const istToday = todayIstDateString();
  const utcClaimDate = todayUtcDateString();
  const sinceLatestDwell = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const sinceMcq = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const sincePlayHistory = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    profileRes,
    presenceRes,
    dwellRecentRes,
    completedRecentRes,
    doubtsRecentRes,
    answersRecentRes,
    referClaimsRes,
    rewardClaimsRes,
    gauntletRes,
    playHistoryRes,
    gauntletLbAcademicRes,
    gauntletLbFunbrainRes,
    mcqAttemptsRes,
    gyanPresenceRes,
    communityPostsRes,
    rdmConfigRes,
    sitePresenceRes,
  ] = await Promise.all([
    (admin.from("profiles" as any) as any)
      .select(
        "id, name, avatar_url, class_level, rdm, subtopic_engagement, bits_test_attempts, buddy_privacy_settings"
      )
      .eq("id", buddyId)
      .maybeSingle(),
    admin
      .from("student_learning_presence" as never)
      .select(
        "board, subject, class_level, topic, subtopic_name, level, panel, updated_at"
      )
      .eq("user_id" as never, buddyId as never)
      .maybeSingle(),
    (admin ?? supabase)
      .from("student_learning_dwell_events")
      .select("board, subject, class_level, topic, subtopic_name, level, panel, occurred_at")
      .eq("user_id", buddyId)
      .gte("occurred_at", sinceLatestDwell)
      .order("occurred_at", { ascending: false })
      .limit(1),
    admin
      .from("student_lesson_mark_completions" as never)
      .select("board, subject, class_level, topic, subtopic, level, marked_complete_at")
      .eq("user_id" as never, buddyId as never)
      .order("marked_complete_at" as never, { ascending: false })
      .limit(12),
    admin
      .from("doubts")
      .select("id, title, subject, created_at")
      .eq("user_id", buddyId)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("doubt_answers")
      .select("id, doubt_id, created_at, doubts(id, title)")
      .eq("user_id", buddyId)
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("refer_challenge_claims")
      .select("challenge_key, win_claimed, share_claimed, claim_date")
      .eq("user_id", buddyId)
      .gte("claim_date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
    admin
      .from("daily_reward_claims")
      .select("id, points_awarded, claim_date_ist, action_type, created_at")
      .eq("user_id", buddyId)
      .gte(
        "claim_date_ist",
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
         }).format(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000))
      )
      .order("created_at", { ascending: false }),
    (admin.from("daily_gauntlet_attempts" as any) as any)
      .select("gauntlet_date, domain, correct_count, completed_at")
      .eq("user_id", buddyId)
      .order("gauntlet_date", { ascending: false })
      .limit(60),
    admin
      .from("play_history")
      .select("id, created_at, is_correct, pool_key")
      .eq("user_id", buddyId)
      .gte("created_at", sincePlayHistory)
      .order("created_at", { ascending: false })
      .limit(300),
    admin.rpc("get_daily_gauntlet_leaderboard", {
      p_gauntlet_date: istToday,
      p_domain: "academic",
    }),
    admin.rpc("get_daily_gauntlet_leaderboard", {
      p_gauntlet_date: istToday,
      p_domain: "funbrain",
    }),
    admin
      .from("mock_rdm_bonus_attempts")
      .select(
        "paper_id, eligible, score_percent, correct_count, total_questions, created_at, mock_papers(id, slug, title, paper_type, chapter_id)"
      )
      .eq("user_id", buddyId)
      .gte("created_at", sinceMcq)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("student_gyan_presence" as never)
      .select("updated_at")
      .eq("user_id" as never, buddyId as never)
      .maybeSingle(),
    admin
      .from("lessons_raw_posts")
      .select("id, title, subject, created_at")
      .eq("user_id", buddyId)
      .order("created_at", { ascending: false })
      .limit(1),
    admin.from("rdm_config").select("key, value"),
    admin
      .from("student_site_presence" as never)
      .select("updated_at")
      .eq("user_id" as never, buddyId as never)
      .maybeSingle(),
  ]);

  if (profileRes.error) {
    return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
  }

  const buddy = {
    id: buddyId,
    name: profileRes.data?.name ?? null,
    avatarUrl: profileRes.data?.avatar_url ?? null,
    classLevel: profileRes.data?.class_level ?? null,
    rdm: normalizeBuddyRdm(profileRes.data?.rdm),
  };

  type PresenceRow = {
    board: string | null;
    subject: string | null;
    class_level: number | null;
    topic: string | null;
    subtopic_name: string | null;
    level: string | null;
    panel: string | null;
    updated_at: string;
  };

  const presenceRow = presenceRes.data as unknown as PresenceRow | null;
  const latestDwell = dwellRecentRes.data?.[0] ?? null;

  const { latest: latestActivity, isRecent: activityIsRecent, href: rightNowHref } =
    resolveBuddySubtopicActivity(
      presenceRow
        ? {
            board: presenceRow.board,
            subject: presenceRow.subject,
            classLevel: presenceRow.class_level,
            topic: presenceRow.topic,
            subtopicName: presenceRow.subtopic_name,
            level: presenceRow.level,
            panel: presenceRow.panel,
            occurredAt: presenceRow.updated_at,
          }
        : null,
      latestDwell
        ? {
            board: latestDwell.board,
            subject: latestDwell.subject,
            classLevel: latestDwell.class_level,
            topic: latestDwell.topic,
            subtopicName: latestDwell.subtopic_name,
            level: latestDwell.level,
            panel: latestDwell.panel,
            occurredAt: latestDwell.occurred_at,
          }
        : null,
      BUDDY_ACTIVITY_RECENT_MS
    );

  const latestGyanDoubtRow = (doubtsRecentRes.data ?? [])[0] ?? null;
  const latestGyanDoubt = latestGyanDoubtRow
    ? {
        id: latestGyanDoubtRow.id,
        title: latestGyanDoubtRow.title,
        subject: latestGyanDoubtRow.subject,
        createdAt: latestGyanDoubtRow.created_at,
      }
    : null;
  const gyanPresenceUpdatedAt =
    (gyanPresenceRes.data as { updated_at?: string } | null)?.updated_at ?? null;
  const sitePresenceUpdatedAt =
    (sitePresenceRes.data as { updated_at?: string } | null)?.updated_at ?? null;

  const latestCommunityRow = (communityPostsRes.data ?? [])[0] ?? null;
  const latestCommunityPost = latestCommunityRow
    ? {
        id: latestCommunityRow.id,
        title: latestCommunityRow.title,
        subject: latestCommunityRow.subject,
        createdAt: latestCommunityRow.created_at,
      }
    : null;

  const rightNow = resolveBuddyRightNow({
    presence: presenceRow
      ? {
          board: presenceRow.board,
          subject: presenceRow.subject,
          classLevel: presenceRow.class_level,
          topic: presenceRow.topic,
          subtopicName: presenceRow.subtopic_name,
          level: presenceRow.level,
          panel: presenceRow.panel,
          occurredAt: presenceRow.updated_at,
        }
      : null,
    dwell: latestDwell
      ? {
          board: latestDwell.board,
          subject: latestDwell.subject,
          classLevel: latestDwell.class_level,
          topic: latestDwell.topic,
          subtopicName: latestDwell.subtopic_name,
          level: latestDwell.level,
          panel: latestDwell.panel,
          occurredAt: latestDwell.occurred_at,
        }
      : null,
    bitsAttemptsJson: profileRes.data?.bits_test_attempts,
    activityRecentMs: BUDDY_ACTIVITY_RECENT_MS,
    latestGyanDoubt,
    latestCommunityPost,
    gyanPresenceUpdatedAt,
    sitePresenceUpdatedAt,
  });

  type LessonMarkRow = {
    board: string | null;
    subject: string | null;
    class_level: number | null;
    topic: string;
    subtopic: string;
    level: string;
    marked_complete_at: string;
  };
  const completedRecentRows: LessonMarkRow[] = Array.isArray(completedRecentRes.data)
    ? (completedRecentRes.data as unknown as LessonMarkRow[])
    : [];
  const completedRecent = listBuddyCompletedSubtopics(
    completedRecentRows,
    profileRes.data?.subtopic_engagement,
    5
  );

  type GyanRow = {
    id: string;
    kind: "doubt" | "answer";
    title: string;
    createdAt: string;
    href: string;
  };
  const gyanFromDoubts: GyanRow[] = (doubtsRecentRes.data ?? []).map((d) => ({
    id: d.id,
    kind: "doubt",
    title: d.title,
    createdAt: d.created_at,
    href: `/doubts/${d.id}`,
  }));
  const gyanFromAnswers: GyanRow[] = (answersRecentRes.data ?? []).map((a) => {
    const dRaw = (a as { doubts?: { id?: string; title?: string } | Array<{ id?: string; title?: string }> | null })
      .doubts;
    const d = Array.isArray(dRaw) ? dRaw[0] ?? null : dRaw ?? null;
    return {
      id: a.id,
      kind: "answer",
      title: d?.title ?? "Answered a doubt",
      createdAt: a.created_at,
      href: `/doubts/${a.doubt_id}`,
    };
  });
  const gyanRecent = [...gyanFromDoubts, ...gyanFromAnswers]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const rdmConfig: RdmConfigParams = { ...DEFAULT_RDM_CONFIG };
  for (const row of rdmConfigRes.data ?? []) {
    if (typeof row.value === "number" && row.key in rdmConfig) {
      (rdmConfig as Record<string, number>)[row.key] = row.value;
    }
  }

  const playArena = computeBuddyPlayArena({
    istToday,
    utcClaimDate,
    rewardClaims: rewardClaimsRes.data ?? [],
    referClaims: referClaimsRes.data ?? [],
    gauntletDates: (gauntletRes.data ?? []).map((r: any) => r.gauntlet_date),
    rdmConfig,
  });

  type LbRow = { rank: number; user_id: string };
  const findGauntletRank = (rows: LbRow[] | null) =>
    Number(rows?.find((r) => r.user_id === buddyId)?.rank ?? 0) || undefined;

  const playFeed = buildBuddyPlayArenaFeed({
    istToday,
    utcClaimDate,
    rewardClaims: rewardClaimsRes.data ?? [],
    referClaims: referClaimsRes.data ?? [],
    gauntletAttempts: gauntletRes.data ?? [],
    playHistory: playHistoryRes.data ?? [],
    rdmConfig,
    gauntletRankByDomain: {
      academic: findGauntletRank(gauntletLbAcademicRes.data as LbRow[] | null),
      funbrain: findGauntletRank(gauntletLbFunbrainRes.data as LbRow[] | null),
    },
  });

  const mcqRecent = listBuddyMcqRecentMerged(
    (mcqAttemptsRes.data ?? []) as any,
    profileRes.data?.bits_test_attempts,
    5
  );

  const visibility = parseBuddyPrivacySettings(profileRes.data?.buddy_privacy_settings);
  const privacyNotice = buildPrivacyNotice(buddy.name, visibility);

  const buddyOnline = resolveBuddyIsOnline({
    rightNow,
    presenceUpdatedAt: presenceRow?.updated_at ?? null,
    gyanPresenceUpdatedAt,
    sitePresenceUpdatedAt,
    latestDwellAt: latestDwell?.occurred_at ?? null,
  });

  const basePayload = {
    buddy,
    buddyOnline,
    rightNow,
    gyanRecent,
    subtopic: {
      current:
        latestActivity && activityIsRecent
          ? {
              board: latestActivity.board,
              subject: latestActivity.subject,
              classLevel: latestActivity.classLevel,
              topic: latestActivity.topic,
              subtopic: latestActivity.subtopicName,
              level: latestActivity.level,
              panel: latestActivity.panel,
              updatedAt: latestActivity.occurredAt,
              href: rightNowHref,
            }
          : null,
      lastOn: latestActivity
        ? {
            board: latestActivity.board,
            subject: latestActivity.subject,
            classLevel: latestActivity.classLevel,
            topic: latestActivity.topic,
            subtopic: latestActivity.subtopicName,
            level: latestActivity.level,
            panel: latestActivity.panel,
            updatedAt: latestActivity.occurredAt,
            href: rightNowHref,
            isRecent: activityIsRecent,
          }
        : null,
      completedRecent,
    },
    playArena: {
      rdmEarnedToday: playArena.rdmEarnedToday,
      rdmEarnedLast7Days: playArena.rdmEarnedLast7Days,
      gauntletStreakDays: playArena.gauntletStreakDays,
      gauntletDaysLast30: playArena.gauntletDaysLast30,
      challengesAttemptedToday: playArena.challengesClaimedToday,
      challengesClaimedLast7Days: playArena.challengesClaimedLast7Days,
      recent: playFeed.recent,
      playRdmMissedToday: playFeed.playRdmMissedToday,
      blitzRoundsToday: playFeed.blitzRoundsToday,
    },
    mcqRecent,
    generatedAt: new Date().toISOString(),
  };

  const advanced = await buildBuddyAdvancedSections(admin, buddyId, basePayload);

  const payload = maskDashboardForPrivacy({
    ...basePayload,
    visibility,
    privacyNotice,
    advanced,
  });

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
