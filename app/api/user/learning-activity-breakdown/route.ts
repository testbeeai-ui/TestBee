import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import type { Json } from "@/integrations/supabase/types";
import { parseAssignmentTasks, studentVisibleTasks } from "@/lib/classroom/assignmentTasks";
import { parseEngagementStore } from "@/lib/curriculum/subtopicEngagementStoreParse";
import type { SubtopicEngagementSnapshot } from "@/lib/curriculum/subtopicEngagementService";

const ASSIGNMENT_POST_TYPES = ["assignment", "quiz", "mock", "past_paper", "Concept Focus"] as const;
const GAUNTLET_QUESTIONS = 5;

type RpcRow = { subject: string; avg_pct: number | null; paper_count: number | null };

type BitsAttemptRow = {
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
};

function sanitize(value: unknown, maxLen = 300): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function parseBitsAttemptsAggregate(raw: unknown): {
  attempts: number;
  accuracyPct: number | null;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { attempts: 0, accuracyPct: null };
  let attempts = 0;
  let correct = 0;
  let denom = 0;
  for (const value of Object.values(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const totalQuestions = Math.max(0, Math.trunc(Number(row.totalQuestions) || 0));
    if (totalQuestions <= 0) continue;
    const correctCount = Math.max(0, Math.trunc(Number(row.correctCount) || 0));
    attempts += 1;
    correct += correctCount;
    denom += totalQuestions;
  }
  const accuracyPct = denom > 0 ? Math.min(100, Math.round((100 * correct) / denom)) : null;
  return { attempts, accuracyPct };
}

function countSubtopicsMastered(store: Record<string, SubtopicEngagementSnapshot>): {
  completed: number;
  subjects: Set<string>;
} {
  const subjects = new Set<string>();
  let completed = 0;
  for (const [key, snap] of Object.entries(store)) {
    const g = snap.bits?.graded;
    if (g && g.totalQuestions > 0 && g.answered >= g.totalQuestions) {
      completed += 1;
      const subj = key.split("||")[1];
      if (subj) subjects.add(subj);
    }
  }
  return { completed, subjects };
}

function daysSinceJoinInclusive(createdAtIso: string | null | undefined): number {
  if (!createdAtIso) return 1;
  const t = Date.parse(createdAtIso);
  if (!Number.isFinite(t)) return 1;
  const days = Math.floor((Date.now() - t) / 86_400_000) + 1;
  return Math.min(10_000, Math.max(1, days));
}

function parseRevisionCards(json: Json | null | undefined): Array<{ status?: string }> {
  if (!Array.isArray(json)) return [];
  return json.filter((x) => x && typeof x === "object" && !Array.isArray(x)) as Array<{ status?: string }>;
}

/** GET — cumulative learning stats for profile “Learning activity breakdown” grid. */
export async function GET(request: Request) {
  const auth = await getSupabaseAndUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, user } = auth;
  const uid = user.id;

  const [
    profileRes,
    gauntletRes,
    mocksAggRes,
    challengeRes,
    lessonMarksRes,
    rpcRes,
    revisionCardsRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("created_at, bits_test_attempts, subtopic_engagement")
      .eq("id", uid)
      .maybeSingle(),
    supabase.from("daily_gauntlet_attempts").select("gauntlet_date, correct_count").eq("user_id", uid),
    supabase.from("mock_rdm_bonus_attempts").select("score_percent").eq("user_id", uid),
    supabase.from("refer_challenge_claims").select("id", { count: "exact", head: true }).eq("user_id", uid),
    supabase
      .from("student_lesson_mark_completions" as never)
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid),
    (
      supabase as unknown as {
        rpc: (fn: string) => Promise<{ data: RpcRow[] | null; error: { message: string } | null }>;
      }
    ).rpc("get_user_mock_subject_score_averages"),
    // Fetch revision cards from new table instead of JSONB column
    supabase
      .from("user_saved_items")
      .select("data")
      .eq("user_id", uid)
      .eq("item_type", "saved_revision_card"),
  ]);

  if (profileRes.error) {
    console.error("[learning-activity-breakdown] profiles", profileRes.error.message);
    return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
  }

  const profile = profileRes.data as {
    created_at?: string | null;
    bits_test_attempts?: Json | null;
    subtopic_engagement?: Json | null;
  } | null;

  const joinDays = daysSinceJoinInclusive(profile?.created_at ?? null);
  /** Dual-domain DailyDose: at most two gauntlet rows per calendar day since join. */
  const dailyDoseAvailableSlots = Math.min(10_000, Math.max(1, joinDays * 2));

  let gauntletRows: Array<{ gauntlet_date: string; correct_count: number }> = [];
  if (!gauntletRes.error && Array.isArray(gauntletRes.data)) {
    gauntletRows = gauntletRes.data as typeof gauntletRows;
  }

  const dailyDoseAttempted = gauntletRows.length;
  const dailyDoseFullRuns = gauntletRows.filter(
    (r) => Number.isFinite(Number(r.correct_count)) && Number(r.correct_count) >= GAUNTLET_QUESTIONS
  ).length;
  let gauntletCorrect = 0;
  let gauntletAnswerSlots = 0;
  for (const r of gauntletRows) {
    const c = Math.max(0, Math.min(GAUNTLET_QUESTIONS, Math.trunc(Number(r.correct_count) || 0)));
    gauntletCorrect += c;
    gauntletAnswerSlots += GAUNTLET_QUESTIONS;
  }
  const dailyDoseAccuracyPct =
    gauntletAnswerSlots > 0 ? Math.min(100, Math.round((100 * gauntletCorrect) / gauntletAnswerSlots)) : null;

  const dailyDoseAttemptedPct =
    dailyDoseAvailableSlots > 0
      ? Math.min(100, Math.round((100 * dailyDoseAttempted) / dailyDoseAvailableSlots))
      : 0;

  const bitsAgg = parseBitsAttemptsAggregate(profile?.bits_test_attempts ?? null);
  const engagementStore = parseEngagementStore(profile?.subtopic_engagement ?? null);
  const subMeta = countSubtopicsMastered(engagementStore);
  const subtopicSubjectsLabel =
    subMeta.subjects.size > 0
      ? `across ${[...subMeta.subjects].slice(0, 3).join(", ")}${subMeta.subjects.size > 3 ? "…" : ""}`
      : "Deep Dive / Explore progress";

  const mockRows =
    mocksAggRes.error || !Array.isArray(mocksAggRes.data)
      ? []
      : (mocksAggRes.data as Array<{ score_percent: number | null }>);
  const mockScores = mockRows
    .map((r) => Number(r.score_percent))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);
  const mockAvgPct =
    mockScores.length > 0
      ? Math.round(mockScores.reduce((a, b) => a + b, 0) / mockScores.length)
      : null;

  const rpcRows = rpcRes.error ? [] : ((rpcRes.data ?? []) as RpcRow[]);
  const subjLabel: Record<string, string> = {
    physics: "Physics",
    chemistry: "Chemistry",
    math: "Maths",
  };
  let mockBestLine = "";
  let bestAvg = -1;
  for (const row of rpcRows) {
    const sub = (row.subject || "").toLowerCase().trim();
    const avg =
      typeof row.avg_pct === "number" && Number.isFinite(row.avg_pct)
        ? row.avg_pct
        : row.avg_pct != null
          ? Number(row.avg_pct)
          : NaN;
    if (!Number.isFinite(avg) || (row.paper_count ?? 0) <= 0) continue;
    if (avg > bestAvg) {
      bestAvg = avg;
      mockBestLine = `latest: ${Math.round(avg)}% ${subjLabel[sub] ?? row.subject}`;
    }
  }
  if (!mockBestLine && mockAvgPct != null) {
    mockBestLine = `overall avg ${mockAvgPct}%`;
  }

  // Build revision cards from user_saved_items table
  const revisionCards = ((revisionCardsRes.data ?? []) as Array<{ data: unknown }>).map((r) => {
    const d = r.data as { status?: string; savedAt?: string } | null;
    return { status: d?.status ?? "new", savedAt: d?.savedAt ?? null };
  });
  const withStatus = revisionCards.filter((c) => c.status && c.status !== "new").length;
  const knowIt = revisionCards.filter((c) => c.status === "know_it").length;
  const revisionRetentionPct =
    withStatus > 0 ? Math.min(100, Math.round((100 * knowIt) / withStatus)) : null;

  const membershipsRes = await supabase.from("classroom_members").select("classroom_id").eq("user_id", uid);
  const classroomIds = [...new Set((membershipsRes.data ?? []).map((m) => m.classroom_id))];

  let assignmentsAssigned = 0;
  let assignmentsDone = 0;
  let liveScheduled = 0;
  let liveAttended = 0;

  if (classroomIds.length > 0) {
    const [postsRes, progressRes, sessionsListRes, attendanceRes] = await Promise.all([
      supabase
        .from("posts")
        .select("id, type, content_json")
        .in("classroom_id", classroomIds)
        .in("type", [...ASSIGNMENT_POST_TYPES]),
      supabase.from("classroom_assignment_task_progress").select("post_id, task_id").eq("user_id", uid),
      supabase
        .from("live_sessions")
        .select("id")
        .in("classroom_id", classroomIds)
        .lte("scheduled_at", new Date().toISOString()),
      supabase.from("session_attendance").select("session_id").eq("user_id", uid),
    ]);

    const posts = postsRes.data ?? [];
    const doneSet = new Set((progressRes.data ?? []).map((r) => `${r.post_id}:${r.task_id}`));
    assignmentsDone = doneSet.size;

    for (const post of posts) {
      const visible = studentVisibleTasks(parseAssignmentTasks(post.content_json, post.type));
      assignmentsAssigned += visible.length;
    }

    const sessionIds = new Set((sessionsListRes.data ?? []).map((r) => r.id));
    liveScheduled = sessionIds.size;
    if (!attendanceRes.error) {
      for (const row of attendanceRes.data ?? []) {
        if (sessionIds.has(row.session_id)) liveAttended += 1;
      }
    }
  }

  const lecturesReviewed = lessonMarksRes.error ? 0 : (lessonMarksRes.count ?? 0);
  const challengesAttempted = challengeRes.error ? 0 : (challengeRes.count ?? 0);

  return NextResponse.json({
    joinDays,
    dailyDoseAvailableSlots,
    dailyDoseAttempted,
    dailyDoseAttemptedPct,
    dailyDoseFullRuns,
    /** Matches gauntlet length; surfaced so profile copy stays in sync with scoring rules. */
    dailyDoseQuestionsPerRound: GAUNTLET_QUESTIONS,
    dailyDoseAccuracyPct,
    subtopicsCompleted: subMeta.completed,
    subtopicSubjectsLabel,
    quizzesAttempted: bitsAgg.attempts,
    quizAccuracyPct: bitsAgg.accuracyPct,
    mocksAttempted: mockRows.length,
    mockAvgPct,
    mockBestLine: mockBestLine || "—",
    challengesAttempted,
    liveScheduled,
    liveAttended,
    assignmentsDone,
    assignmentsAssigned,
    lecturesReviewed,
    revisionCardsSaved: revisionCards.length,
    revisionRetentionPct,
  });
}
