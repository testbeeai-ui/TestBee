import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BuddyAdvancedSections,
  BuddyMocksSection,
  BuddyStreakSection,
} from "@/lib/buddy/buddyPrivacy";
import { buddyMcqPaperHref } from "@/lib/buddy/buddyMcqPaperHref";
import { buildBuddySubjectAccuracyWeek } from "@/lib/buddy/buildBuddySubjectAccuracy";
import { getEdufundNextGate } from "@/lib/dashboard/dashboardSidebarMetrics";
import { normalizeBuddyRdm } from "@/lib/buddy/buddyClient";
import type { BuddyDashboardResponse } from "@/lib/buddy/buddyClient";
import type { Json } from "@/integrations/supabase/types";
import { computeStudyStreakFromDayMs } from "@/lib/dashboard/studyStreakClient";

function todayIstDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "Just now";
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3600_000)}h ago`;
  const days = Math.floor(ms / 86_400_000);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export async function buildBuddyAdvancedSections(
  admin: SupabaseClient,
  buddyId: string,
  base: BuddyDashboardResponse
): Promise<BuddyAdvancedSections> {
  const since60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const since60Day = since60.toISOString().slice(0, 10);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const istToday = todayIstDateString();

  const since7Iso = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

  const [studyDaysRes, profileRes, mockAttemptsRes, mockWeekRes, dailyRdmRes] = await Promise.all([
    admin
      .from("user_study_day_totals")
      .select("day, active_ms, presence_ms")
      .eq("user_id", buddyId)
      .gte("day", since60Day)
      .order("day", { ascending: true }),
    admin
      .from("profiles")
      .select("rdm, daily_dose_streak, last_daily_dose_streak_date, bits_test_attempts")
      .eq("id", buddyId)
      .maybeSingle(),
    admin
      .from("mock_test_attempts")
      .select(
        "paper_title, score_percent, correct_count, total_questions, created_at, paper_slug, session_kind, catalog_paper_id, mock_papers:catalog_paper_id(slug, title, paper_type, chapter_id)"
      )
      .eq("user_id", buddyId)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("mock_test_attempts")
      .select("created_at, subject_breakdown")
      .eq("user_id", buddyId)
      .gte("created_at", since7Iso)
      .order("created_at", { ascending: false })
      .limit(80),
    admin
      .from("daily_reward_claims")
      .select("points_awarded")
      .eq("user_id", buddyId)
      .eq("claim_date_ist", istToday),
  ]);

  const studyRows = studyDaysRes.data ?? [];
  const activeDays60d = studyRows.filter(
    (r) => Math.max(r.active_ms ?? 0, r.presence_ms ?? 0) > 0
  ).length;
  const totalActiveMs = studyRows.reduce(
    (s, r) => s + Math.max(r.active_ms ?? 0, r.presence_ms ?? 0),
    0
  );
  const avgDailyMs = activeDays60d > 0 ? Math.round(totalActiveMs / activeDays60d) : 0;

  const msByDay = new Map<string, number>();
  for (const r of studyRows) {
    if (r.day) {
      msByDay.set(r.day, Math.max(r.active_ms ?? 0, r.presence_ms ?? 0));
    }
  }
  const dayStreak = computeStudyStreakFromDayMs(msByDay, istToday).streak;

  const last10Days: BuddyStreakSection["last10Days"] = [];
  for (let i = 9; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const hit = studyRows.find((r) => r.day === key);
    if (!hit) last10Days.push("unknown");
    else if ((hit.active_ms ?? 0) > 0) last10Days.push("active");
    else last10Days.push("miss");
  }

  const streak: BuddyStreakSection = {
    dayStreak,
    activeDays60d,
    avgDailyMs,
    last10Days,
    studyDays: studyRows.map((r) => ({
      day: r.day,
      active_ms: r.active_ms ?? 0,
      presence_ms: r.presence_ms ?? 0,
    })),
  };

  const mockRows = mockAttemptsRes.data ?? [];
  const monthMocks = mockRows.filter(
    (r) => new Date(r.created_at).getTime() >= monthStart.getTime()
  );
  const scored = mockRows.filter((r) => typeof r.score_percent === "number");
  const avgAccuracy =
    scored.length > 0
      ? Math.round(
          scored.reduce((s, r) => s + (r.score_percent as number), 0) / scored.length
        )
      : null;

  const mocks: BuddyMocksSection = {
    recent: mockRows.slice(0, 5).map((r) => {
      const paperRaw = (r as { mock_papers?: unknown }).mock_papers;
      const paper = Array.isArray(paperRaw) ? paperRaw[0] : paperRaw;
      const slug =
        (typeof (r as { paper_slug?: string }).paper_slug === "string" &&
          (r as { paper_slug: string }).paper_slug.trim()) ||
        (paper &&
        typeof paper === "object" &&
        "slug" in paper &&
        typeof (paper as { slug?: string }).slug === "string"
          ? (paper as { slug: string }).slug
          : null);
      const paperMeta =
        paper && typeof paper === "object"
          ? (paper as {
              slug?: string | null;
              paper_type?: string | null;
              chapter_id?: string | null;
            })
          : null;
      const sessionKind = (r as { session_kind?: string }).session_kind ?? "";
      const href =
        sessionKind === "mcq_chapter"
          ? buddyMcqPaperHref({ slug, paper_type: "chapter", chapter_id: paperMeta?.chapter_id ?? "x" })
          : buddyMcqPaperHref(paperMeta ?? { slug });
      return {
        title: r.paper_title ?? "Mock test",
        subtitle: formatRelativeTime(r.created_at),
        scorePercent:
          typeof r.score_percent === "number" ? Math.round(r.score_percent) : null,
        href,
      };
    }),
    mocksThisMonth: monthMocks.length,
    avgAccuracy,
  };

  const rdm = normalizeBuddyRdm(profileRes.data?.rdm);
  const nextGate = getEdufundNextGate(rdm);
  const nextNeed = nextGate?.need ?? null;
  const progressPct =
    nextNeed != null && nextNeed > 0
      ? Math.min(100, Math.round((rdm / nextNeed) * 100))
      : 100;

  const earnedTodayRdm = (dailyRdmRes.data ?? []).reduce(
    (s, r) => s + (r.points_awarded ?? 0),
    0
  );

  const edufund = {
    rdm,
    nextTierName: nextGate?.name ?? null,
    nextTierNeed: nextNeed,
    nextTierProgressPct: progressPct,
    activeDays60d,
    activeDaysGoal: 60,
    earnedTodayRdm,
  };

  const subjectAccuracy = buildBuddySubjectAccuracyWeek({
    bitsAttemptsJson: profileRes.data?.bits_test_attempts as Json | null | undefined,
    mockAttempts: mockWeekRes.data ?? [],
  });

  return {
    streak,
    mocks,
    edufund,
    subjectAccuracy,
  };
}
