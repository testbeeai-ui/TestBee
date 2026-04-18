"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/store/useUserStore";
import { parseBitsTestAttemptsStore } from "@/lib/parseBitsTestAttemptsStore";
import {
  activityGreenLevelFromStudyMs,
  addDaysLocal,
  formatPresenceMsForTooltip,
  formatSavedStudyMinutesLabel,
  formatStudyMsForTooltip,
  localDayKeyFromDate,
  startOfLocalDay,
  localDayBoundsIso,
} from "@/lib/dashboardDayActivity";
import { computeStudyStreakFromDayMs } from "@/lib/studyStreakClient";
import {
  buildChapterCompletionRowsByRecentActivity,
  parseClassLevelsFromLessonMarkedEngagementRaw,
} from "@/lib/dashboardChapterCompletion";
import type { DailyChecklistApiResponse } from "@/lib/dailyChecklistState";
import { getClientApiAuthHeaders } from "@/lib/clientApiAuth";
import { EDUBLAST_STUDY_DAYS_REFRESH } from "@/lib/studyDayBumpEvents";
import { supabase } from "@/integrations/supabase/client";
import { useTopicTaxonomy } from "@/hooks/useTopicTaxonomy";
import type { Subject, SubjectCombo } from "@/types";
import RawCommunityFeed from "@/components/explore/RawCommunityFeed";
import { Button } from "@/components/ui/button";
import { useSitePresenceLiveMsToday } from "@/components/providers/SitePresenceProvider";
import { cn } from "@/lib/utils";
import { CalendarDays, CheckCircle2, Flame, LineChart, Sprout, Star } from "lucide-react";

const TOPIC_BAR_TONES = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-cyan-500",
];

type HeatmapMode = "7" | "30";

const MOCK_LEADERBOARD = [
  { rank: 1, name: "Nidhi K", city: "Bengaluru", pts: 4820 },
  { rank: 2, name: "Arjun K", city: "Mysuru", pts: 4310 },
  { rank: 3, name: "Sneha R", city: "Mangaluru", pts: 3960 },
  { rank: 4, name: "Vikram B", city: "Hubli", pts: 3610 },
  { rank: 8, name: "Priya M", city: "Bengaluru", pts: 2900 },
] as const;

const UPCOMING_MOCKS = [
  {
    title: "Chemistry — Electrochemistry full mock",
    meta: "Today · 45 min · Adaptive · JEE pattern",
    action: "Start now" as const,
    tone: "border-rose-500/40",
  },
  {
    title: "Mathematics — Calculus integration",
    meta: "Tomorrow · 40 min · Adaptive · Board + JEE",
    action: "Scheduled" as const,
    tone: "border-violet-500/40",
  },
  {
    title: "Full PUC 2 PCM mock — 3 subjects",
    meta: "Sunday · 90 min · Full syllabus · Rank test",
    action: "pill" as const,
    tone: "border-blue-500/40",
  },
] as const;

const EDUFUND_TIERS = [
  { name: "Sprout", status: "Unlocked" as const, detail: "1,000 RDM threshold", progress: 1, amount: "₹3,000", tone: "text-emerald-500" },
  { name: "Scholar", status: "In progress" as const, detail: "3,000 RDM needed · 1,260 more to go", progress: 0.58, amount: "₹12,000", tone: "text-indigo-400" },
  { name: "Champion", status: "Locked" as const, detail: "8,000 RDM needed · 6,260 more to go", progress: 0.22, amount: "₹50,000", tone: "text-orange-400" },
] as const;

function greenCellClass(level: 0 | 1 | 2 | 3 | 4, isToday: boolean): string {
  const ring = isToday ? "ring-2 ring-teal-400 ring-offset-2 ring-offset-background" : "";
  const base = "rounded-lg border transition-colors " + ring;
  switch (level) {
    case 0:
      return cn(base, "border-border/60 bg-muted/40 dark:bg-slate-900/80");
    case 1:
      return cn(base, "border-emerald-500/25 bg-emerald-950/50 text-emerald-100");
    case 2:
      return cn(base, "border-emerald-400/35 bg-emerald-800/60 text-emerald-50");
    case 3:
      return cn(base, "border-emerald-300/40 bg-emerald-600/70 text-white");
    default:
      return cn(base, "border-emerald-200/50 bg-emerald-400 text-emerald-950");
  }
}

export default function StudentHomeDashboard() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const storeUser = useUserStore((s) => s.user);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("7");
  const [studyMsByDay, setStudyMsByDay] = useState<Map<string, number>>(() => new Map());
  const [presenceMsByDay, setPresenceMsByDay] = useState<Map<string, number>>(() => new Map());
  const [streakSummary, setStreakSummary] = useState<{
    streak: number;
    activeDaysThisMonth: number;
  } | null>(null);
  const [studyDaysStatus, setStudyDaysStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  /** After first successful fetch, refetches stay quiet (no greeting/stat "…" flicker). */
  const studyDaysCommittedRef = useRef(false);
  const { taxonomy: fullTaxonomy, loading: taxonomyLoading, error: taxonomyError } = useTopicTaxonomy();

  const livePresencePendingMs = useSitePresenceLiveMsToday();

  const bitsAttemptRows = useMemo(
    () => parseBitsTestAttemptsStore(profile?.bits_test_attempts ?? null),
    [profile?.bits_test_attempts]
  );

  const submittedBitsKeys = useMemo(() => {
    const raw = profile?.bits_test_attempts;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return new Set<string>();
    return new Set(Object.keys(raw as Record<string, unknown>));
  }, [profile?.bits_test_attempts]);

  /** Stable clock for memo deps; ticks every minute so heatmap / greeting stay fresh without re-running memos every frame. */
  const [dashboardClock, setDashboardClock] = useState(() => Date.now());
  const now = useMemo(() => new Date(dashboardClock), [dashboardClock]);
  const monthDays = useMemo(() => new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), [now]);

  useEffect(() => {
    const id = setInterval(() => setDashboardClock(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const rdm = profile?.rdm ?? storeUser?.rdm ?? 0;

  const streakDays = streakSummary?.streak ?? 0;
  const activeDaysThisMonth = streakSummary?.activeDaysThisMonth ?? 0;

  const loadStudyDays = useCallback(async () => {
    await Promise.resolve();
    if (!profile?.id) {
      studyDaysCommittedRef.current = false;
      setStudyDaysStatus("idle");
      return;
    }
    const todayStart = startOfLocalDay(new Date());
    const toStr = localDayKeyFromDate(todayStart);
    const fromStr = localDayKeyFromDate(addDaysLocal(todayStart, -45));
    const silent = studyDaysCommittedRef.current;
    if (!silent) {
      setStudyDaysStatus("loading");
    }
    try {
      const headers = await getClientApiAuthHeaders();
      const res = await fetch(`/api/user/study-days?from=${fromStr}&to=${toStr}&today=${toStr}`, { headers });
      if (!res.ok) {
        if (!silent) setStudyDaysStatus("error");
        return;
      }
      const json = (await res.json()) as {
        days?: { day: string; active_ms: number; presence_ms?: number }[];
        summary?: { streak?: number; activeDaysThisMonth?: number } | null;
      };
      const map = new Map<string, number>();
      const presenceMap = new Map<string, number>();
      for (const row of json.days ?? []) {
        if (row?.day && typeof row.active_ms === "number" && row.active_ms >= 0) {
          map.set(row.day, Math.max(0, row.active_ms));
        }
        if (row?.day && typeof row.presence_ms === "number" && row.presence_ms >= 0) {
          presenceMap.set(row.day, Math.max(0, row.presence_ms));
        }
      }
      setStudyMsByDay(map);
      setPresenceMsByDay(presenceMap);
      const s = json.summary;
      if (s && typeof s.streak === "number" && typeof s.activeDaysThisMonth === "number") {
        setStreakSummary({ streak: s.streak, activeDaysThisMonth: s.activeDaysThisMonth });
      } else {
        setStreakSummary(computeStudyStreakFromDayMs(map, toStr));
      }
      setStudyDaysStatus("ready");
      studyDaysCommittedRef.current = true;
    } catch {
      if (!silent) setStudyDaysStatus("error");
    }
  }, [profile?.id]);

  useEffect(() => {
    startTransition(() => {
      studyDaysCommittedRef.current = false;
      setStudyMsByDay(new Map());
      setPresenceMsByDay(new Map());
      setStreakSummary(null);
      setStudyDaysStatus("idle");
    });
  }, [profile?.id]);

  useEffect(() => {
    startTransition(() => {
      void loadStudyDays();
    });
  }, [loadStudyDays]);

  useEffect(() => {
    const onRefresh = () => void loadStudyDays();
    window.addEventListener(EDUBLAST_STUDY_DAYS_REFRESH, onRefresh);
    return () => window.removeEventListener(EDUBLAST_STUDY_DAYS_REFRESH, onRefresh);
  }, [loadStudyDays]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`user_study_day_totals:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_study_day_totals",
          filter: `user_id=eq.${profile.id}`,
        },
        () => void loadStudyDays()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.id, loadStudyDays]);

  useEffect(() => {
    const onFocus = () => void loadStudyDays();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadStudyDays]);

  const classLevelNum = storeUser?.classLevel ?? profile?.class_level ?? null;
  const subjectCombo = (storeUser?.subjectCombo ?? profile?.subject_combo ?? "PCM") as SubjectCombo;
  const dashboardSubjects: Subject[] = useMemo(
    () => (subjectCombo === "PCMB" ? ["physics", "chemistry", "math", "biology"] : ["physics", "chemistry", "math"]),
    [subjectCombo]
  );

  /**
   * Subject accuracy uses only Lessons/Progress “Marked completed”; scope taxonomy to
   * class levels where that exists (otherwise fall back to the learner’s selected class).
   */
  const chapterTaxonomyClassLevels = useMemo(() => {
    const fromMarks = parseClassLevelsFromLessonMarkedEngagementRaw(profile?.subtopic_engagement);
    if (fromMarks.size > 0) return fromMarks;
    const p: 11 | 12 = classLevelNum === 12 ? 12 : 11;
    return new Set<11 | 12>([p]);
  }, [profile?.subtopic_engagement, classLevelNum]);

  const chapterAccuracyClassLabel = useMemo(() => {
    const arr = [...chapterTaxonomyClassLevels].sort((a, b) => a - b);
    if (arr.length === 1) return `Class ${arr[0]}`;
    return `Classes ${arr.join(" & ")}`;
  }, [chapterTaxonomyClassLevels]);

  const taxonomyForChapterAccuracy = useMemo(() => {
    return fullTaxonomy.filter(
      (n) => dashboardSubjects.includes(n.subject) && chapterTaxonomyClassLevels.has(n.classLevel)
    );
  }, [fullTaxonomy, dashboardSubjects, chapterTaxonomyClassLevels]);

  const chapterRows = useMemo(() => {
    if (!taxonomyForChapterAccuracy.length) return [];
    return buildChapterCompletionRowsByRecentActivity(
      taxonomyForChapterAccuracy,
      bitsAttemptRows,
      [...submittedBitsKeys],
      profile?.subtopic_engagement ?? null,
      6,
      { progressSource: "lesson_marked_only" }
    );
  }, [taxonomyForChapterAccuracy, bitsAttemptRows, submittedBitsKeys, profile?.subtopic_engagement]);

  const [dailyChecklist, setDailyChecklist] = useState<DailyChecklistApiResponse | null>(null);
  const [dailyChecklistStatus, setDailyChecklistStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const dailyChecklistCommittedRef = useRef(false);
  const [instacueAckLoading, setInstacueAckLoading] = useState(false);

  const loadDailyChecklist = useCallback(async () => {
    await Promise.resolve();
    if (!profile?.id) {
      dailyChecklistCommittedRef.current = false;
      setDailyChecklist(null);
      setDailyChecklistStatus("idle");
      return;
    }
    const { today, dayStart, dayEnd } = localDayBoundsIso(now);
    const subjects = dashboardSubjects.join(",");
    const silent = dailyChecklistCommittedRef.current;
    if (!silent) setDailyChecklistStatus("loading");
    try {
      const headers = await getClientApiAuthHeaders();
      const q = new URLSearchParams({
        today,
        dayStart,
        dayEnd,
        subjects,
      });
      const res = await fetch(`/api/user/daily-checklist?${q.toString()}`, { headers });
      if (!res.ok) {
        if (!silent) setDailyChecklistStatus("error");
        return;
      }
      const json = (await res.json()) as DailyChecklistApiResponse;
      setDailyChecklist(json);
      setDailyChecklistStatus("ready");
      dailyChecklistCommittedRef.current = true;
    } catch {
      if (!silent) setDailyChecklistStatus("error");
    }
  }, [profile?.id, dashboardSubjects, now]);

  useEffect(() => {
    startTransition(() => {
      dailyChecklistCommittedRef.current = false;
      setDailyChecklist(null);
      setDailyChecklistStatus("idle");
    });
  }, [profile?.id]);

  useEffect(() => {
    startTransition(() => {
      void loadDailyChecklist();
    });
  }, [loadDailyChecklist]);

  useEffect(() => {
    const onFocus = () => void loadDailyChecklist();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadDailyChecklist]);

  useEffect(() => {
    const onBump = () => void loadDailyChecklist();
    window.addEventListener(EDUBLAST_STUDY_DAYS_REFRESH, onBump);
    return () => window.removeEventListener(EDUBLAST_STUDY_DAYS_REFRESH, onBump);
  }, [loadDailyChecklist]);

  const checklistDoneCount = useMemo(() => {
    if (!dailyChecklist) return 0;
    let n = 0;
    if (dailyChecklist.dailyDoseDone) n++;
    if (dailyChecklist.subtopicRoutineDone) n++;
    if (dailyChecklist.gyanPlusDone) n++;
    if (dailyChecklist.instacueSessionDone) n++;
    return n;
  }, [dailyChecklist]);

  const acknowledgeInstacueSession = useCallback(async () => {
    if (!profile?.id || instacueAckLoading) return;
    const { today } = localDayBoundsIso(now);
    setInstacueAckLoading(true);
    try {
      const headers = await getClientApiAuthHeaders();
      const res = await fetch("/api/user/daily-checklist", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "instacue_ack", today }),
      });
      if (!res.ok) return;
      await refreshProfile();
      await loadDailyChecklist();
    } finally {
      setInstacueAckLoading(false);
    }
  }, [profile?.id, instacueAckLoading, now, refreshProfile, loadDailyChecklist]);

  const lowestChapter = useMemo(() => {
    const started = chapterRows.filter((r) => r.completed > 0);
    if (!started.length) return null;
    return [...started].sort((a, b) => a.completionPct - b.completionPct)[0];
  }, [chapterRows]);

  const last7Series = useMemo(() => {
    const today = startOfLocalDay(now);
    const todayKey = localDayKeyFromDate(today);
    const out: {
      date: Date;
      key: string;
      activeMs: number;
      presenceMs: number;
      level: 0 | 1 | 2 | 3 | 4;
      label: string;
      tooltipTitle: string;
    }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDaysLocal(today, -i);
      const key = localDayKeyFromDate(d);
      const activeMs = studyMsByDay.get(key) ?? 0;
      const serverPresence = presenceMsByDay.get(key) ?? 0;
      const presenceMs = serverPresence + (key === todayKey ? livePresencePendingMs : 0);
      const heatMs = Math.max(presenceMs, activeMs);
      out.push({
        date: d,
        key,
        activeMs,
        presenceMs,
        level: activityGreenLevelFromStudyMs(heatMs),
        label: formatSavedStudyMinutesLabel(presenceMs),
        tooltipTitle: `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${formatPresenceMsForTooltip(presenceMs)} · ${formatStudyMsForTooltip(activeMs)}`,
      });
    }
    return out;
  }, [now, studyMsByDay, presenceMsByDay, livePresencePendingMs]);

  const monthGrid = useMemo(() => {
    const y = now.getFullYear();
    const mon = now.getMonth();
    const first = new Date(y, mon, 1);
    let offset = first.getDay() - 1;
    if (offset < 0) offset += 7;
    const todayStart = startOfLocalDay(now);
    const todayKey = localDayKeyFromDate(todayStart);
    const cells: {
      day: number | null;
      key: string | null;
      activeMs: number;
      presenceMs: number;
      level: 0 | 1 | 2 | 3 | 4;
      label: string;
      tooltipTitle: string | null;
    }[] = [];
    for (let i = 0; i < offset; i++) {
      cells.push({ day: null, key: null, activeMs: 0, presenceMs: 0, level: 0, label: "—", tooltipTitle: null });
    }
    for (let day = 1; day <= monthDays; day++) {
      const d = new Date(y, mon, day);
      const key = localDayKeyFromDate(d);
      const activeMs = studyMsByDay.get(key) ?? 0;
      const serverPresence = presenceMsByDay.get(key) ?? 0;
      const presenceMs = serverPresence + (key === todayKey ? livePresencePendingMs : 0);
      const heatMs = Math.max(presenceMs, activeMs);
      cells.push({
        day,
        key,
        activeMs,
        presenceMs,
        level: activityGreenLevelFromStudyMs(heatMs),
        label: formatSavedStudyMinutesLabel(presenceMs),
        tooltipTitle: `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${formatPresenceMsForTooltip(presenceMs)} · ${formatStudyMsForTooltip(activeMs)}`,
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ day: null, key: null, activeMs: 0, presenceMs: 0, level: 0, label: "—", tooltipTitle: null });
    }
    const monthLong = now.toLocaleDateString("en-US", { month: "long" }).toUpperCase();
    const year = now.getFullYear();
    /** Shown at top of the monthly grid (matches dashboard reference). */
    const monthlyMapHeading = `MONTHLY MAP — ${monthLong} ${year}`;
    return {
      cells,
      monthlyMapHeading,
      todayStart,
    };
  }, [monthDays, now, studyMsByDay, presenceMsByDay, livePresencePendingMs]);

  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, [now]);

  const displayName = (storeUser?.name ?? profile?.name ?? "there").split(" ")[0];
  const classLevel = classLevelNum;
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const classLine =
    classLevel != null
      ? `PUC ${classLevel === 12 ? 2 : 1} · ${subjectCombo} · JEE + KCET track · ${dateStr}`
      : `PUC 2 · ${subjectCombo} · JEE + KCET track · ${dateStr}`;

  const studyStreakPending = profile?.id && (studyDaysStatus === "idle" || studyDaysStatus === "loading");
  const studyStreakReady = profile?.id && studyDaysStatus === "ready";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
      {/* Greeting strip */}
      <div className="rounded-2xl border border-border/60 bg-card/60 px-4 py-3 dark:bg-slate-950/50">
        <p className="text-sm text-foreground">
          <span className="font-semibold">{greeting}, {displayName}!</span>{" "}
          <span className="text-muted-foreground">
            You have 3 DailyDose questions and 8 Instacue cards due today.{" "}
            {studyStreakReady ? (
              <>Your streak is at {streakDays} days — don&apos;t break it.</>
            ) : studyStreakPending ? (
              <>Loading your saved study streak…</>
            ) : studyDaysStatus === "error" && profile?.id ? (
              <>Study streak couldn&apos;t load — refresh or try again in a moment.</>
            ) : (
              <>Sign in to track your study streak from saved play and quiz time.</>
            )}
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground md:text-4xl">My dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">{classLine}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="rounded-full font-bold" onClick={() => router.push("/play")}>
            AI coach advice
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "STATE RANK",
            value: "#14",
            sub: "+ Up 3 places this week",
            subClass: "text-emerald-500",
          },
          {
            label: "RDM BALANCE",
            value: rdm.toLocaleString(),
            sub: "+210 this week",
            subClass: "text-emerald-500",
          },
          {
            label: "AVG MOCK SCORE",
            value: "78%",
            sub: "+6% from last mock",
            subClass: "text-emerald-500",
          },
          {
            label: "STUDY STREAK",
            value: studyStreakReady ? `${streakDays} days` : studyStreakPending ? "…" : studyDaysStatus === "error" ? "—" : "—",
            sub: studyStreakReady
              ? `Active days this month: ${activeDaysThisMonth}/${monthDays}`
              : studyStreakPending
                ? "Loading from your account…"
                : studyDaysStatus === "error"
                  ? "Could not load study days"
                  : "Sign in to see streak",
            subClass: "text-muted-foreground",
          },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm dark:bg-slate-950/60">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{c.value}</p>
            <p className={cn("mt-1 text-xs font-semibold", c.subClass)}>{c.sub}</p>
          </div>
        ))}
      </section>

      {/* Study streak */}
      <section className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm dark:bg-slate-950/60">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-teal-500" />
            <h2 className="text-lg font-bold text-foreground">Study streak — time on site map</h2>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-300">
            <Flame className="h-3.5 w-3.5" />
            Week 3 bonus: +150 RDM
          </span>
        </div>

        <p id="study-streak-map-help" className="sr-only">
          Each day shows time on site with this tab in focus; hover for on-site time and saved study time toward your streak.
        </p>
        <div className="mb-3 inline-flex w-fit rounded-full border border-border bg-muted/30 p-0.5 dark:bg-slate-900/80" role="group" aria-label="Time on site map range" aria-describedby="study-streak-map-help">
          <button
            type="button"
            onClick={() => setHeatmapMode("7")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
              heatmapMode === "7"
                ? "border border-foreground/20 bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Last 7 days
          </button>
          <button
            type="button"
            onClick={() => setHeatmapMode("30")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
              heatmapMode === "30"
                ? "border border-foreground/20 bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Last 30 days
          </button>
        </div>

        {heatmapMode === "30" ? (
          <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {monthGrid.monthlyMapHeading}
          </p>
        ) : null}

        {heatmapMode === "7" ? (
          <div className="flex flex-wrap gap-2">
            {last7Series.map((cell) => {
              const isToday = localDayKeyFromDate(cell.date) === localDayKeyFromDate(startOfLocalDay(now));
              return (
                <div
                  key={cell.key}
                  title={`${cell.tooltipTitle} · Daily RDM: coming soon`}
                  className={cn(
                    "flex min-h-[72px] min-w-[72px] flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 sm:min-w-[88px]",
                    greenCellClass(cell.level, isToday)
                  )}
                >
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    {cell.date.toLocaleDateString(undefined, { weekday: "short" })}
                  </span>
                  <span className="text-sm font-extrabold tabular-nums">{cell.label}</span>
                  {isToday ? <span className="text-[10px] font-semibold text-teal-400">Today</span> : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-muted-foreground">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1.5">
              {monthGrid.cells.map((cell, idx) => {
                if (cell.day == null) {
                  return <div key={`pad-${idx}`} className="aspect-square rounded-lg bg-transparent" />;
                }
                const d = new Date(now.getFullYear(), now.getMonth(), cell.day);
                const isToday = startOfLocalDay(d).getTime() === monthGrid.todayStart.getTime();
                return (
                  <div
                    key={cell.key}
                    title={cell.tooltipTitle ? `${cell.tooltipTitle} · RDM: later` : undefined}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center gap-0.5 p-1 text-[10px] font-bold",
                      greenCellClass(cell.level, isToday)
                    )}
                  >
                    <span>{cell.day}</span>
                    <span className="text-[9px] opacity-90">{cell.label}</span>
                    {isToday ? <span className="text-[8px] text-teal-300">Today</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>Less</span>
          <span className="h-3 w-8 rounded bg-gradient-to-r from-muted to-emerald-400" />
          <span>More</span>
          <span className="ml-2">
            Cell numbers show time on EduBlast with this tab in the foreground (pauses when you switch tabs). Tooltips also show
            saved study time toward your streak (play + topic quizzes). A dash means no on-site time that day;{" "}
            <span className="font-mono">{"<1m"}</span> means under one minute on site. Streak = consecutive calendar days with
            any saved study time, counted through your most recent active day on or before today (so the map can look quiet while
            your streak continues if you have not opened the app long enough to sync).
          </span>
        </div>
      </section>

      {/* Checklist */}
      <section className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm dark:bg-slate-950/60">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-bold">Today&apos;s checklist and what is done</h2>
          </div>
          <Button type="button" size="sm" className="gap-1 rounded-full font-bold" onClick={() => router.push("/play")}>
            <Flame className="h-4 w-4" />
            Start streak for today
          </Button>
        </div>
        <ul className="space-y-2">
          {[
            {
              id: "a",
              text: "Do your Daily Routine — complete DailyDose (10 questions, academic)",
              done: Boolean(dailyChecklist?.dailyDoseDone),
            },
            {
              id: "b",
              text: "Read at least 1 sub-topic per subject with quiz and numerals today (a submitted topic quiz in each subject), or tap Mark as complete in Lessons/Progress after finishing all five steps there",
              done: Boolean(dailyChecklist?.subtopicRoutineDone),
            },
            {
              id: "c",
              text: "Gyan++: stay on the feed at least 5 minutes, save at least 1 doubt for revision, and upvote or comment on someone else’s post today.",
              done: Boolean(dailyChecklist?.gyanPlusDone),
            },
            {
              id: "d",
              text: "Instacue: save 32 revision cards today (count resets each calendar day), then confirm you finished one revision session",
              done: Boolean(dailyChecklist?.instacueSessionDone),
            },
            {
              id: "e",
              text: "Run one MentaMill 60-second blitz (coming soon)",
              done: false,
            },
          ].map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex flex-wrap items-start justify-between gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2.5 dark:bg-slate-900/40",
                item.id === "e" ? "opacity-50" : ""
              )}
            >
              <div className="flex min-w-0 flex-1 gap-2">
                {item.done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-label="Done" />
                ) : (
                  <span
                    className="mt-0.5 inline-flex h-4 w-4 shrink-0 rounded border border-dashed border-muted-foreground/50"
                    aria-hidden
                  />
                )}
                <span className="text-sm text-foreground">
                  <span className="font-bold">{item.id}.</span> {item.text}
                  {item.id === "c" ? (
                    <>
                      {" "}
                      <Link href="/doubts" className="font-bold text-primary hover:underline">
                        Open Gyan++
                      </Link>
                    </>
                  ) : null}
                  {item.id === "d" &&
                  dailyChecklist &&
                  !dailyChecklist.instacueSessionDone &&
                  dailyChecklist.savedRevisionCardCount >= 32 ? (
                    <span className="mt-2 block">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="rounded-lg font-bold"
                        disabled={instacueAckLoading}
                        onClick={() => void acknowledgeInstacueSession()}
                      >
                        {instacueAckLoading ? "Saving…" : "Mark Instacue session done"}
                      </Button>
                    </span>
                  ) : null}
                  {item.id === "d" &&
                  dailyChecklist &&
                  !dailyChecklist.instacueSessionDone &&
                  dailyChecklist.savedRevisionCardCount < 32 ? (
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      Today&apos;s Instacue saves: {dailyChecklist.savedRevisionCardCount}/32
                      {typeof dailyChecklist.savedRevisionCardsDeckTotal === "number" &&
                      dailyChecklist.savedRevisionCardsDeckTotal !== dailyChecklist.savedRevisionCardCount ? (
                        <>
                          {" "}
                          · Bank total {dailyChecklist.savedRevisionCardsDeckTotal} (not day-scoped)
                        </>
                      ) : null}{" "}
                      — save more in Instacue to unlock confirmation.
                    </span>
                  ) : null}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          {dailyChecklistStatus === "error" ? (
            <span className="text-rose-300">Could not load checklist status. Refresh and try again.</span>
          ) : (
            <>
              <span className="font-semibold text-foreground">
                {checklistDoneCount} of 4 done
              </span>
              {" · "}
              Gyan++ today: {dailyChecklist ? `${Math.round(dailyChecklist.gyanPlusProgress.focusMs / 60000)}m` : "—"} on feed,{" "}
              {dailyChecklist?.gyanPlusProgress.savesToday ?? "—"} saves, {dailyChecklist?.gyanPlusProgress.communityActionsToday ?? "—"}{" "}
              community actions (items a–d are live; rewards later).
            </>
          )}
        </p>
      </section>

      {/* Subject accuracy + Leaderboard */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm dark:bg-slate-950/60">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-emerald-500" />
              <h2 className="text-lg font-bold">Subject accuracy</h2>
            </div>
            <Link href="/performance" className="text-xs font-bold text-emerald-500 hover:underline">
              View full report →
            </Link>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            {chapterAccuracyClassLabel} · Tracked only when you tap{" "}
            <span className="font-semibold text-foreground/90">Marked completed</span> in Lessons/Progress on a subtopic. Each chapter lists all curriculum subtopics; % is marked subtopics ÷ total subtopics in that chapter; chapters with at least one mark first (newest mark first).
          </p>
          {taxonomyLoading ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Loading curriculum…</p>
          ) : taxonomyError ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-rose-200">{taxonomyError}</p>
          ) : chapterRows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Open any subtopic, finish Lessons/Progress, and tap <span className="font-semibold text-foreground/90">Marked completed</span> — those chapters show here with real X/total subtopics (quizzes alone do not count).
            </p>
          ) : (
            <ul className="space-y-3">
              {chapterRows.map((row, i) => (
                <li key={row.label}>
                  <div className="mb-1 flex justify-between text-sm font-semibold">
                    <span>{row.label}</span>
                    <span>{row.completionPct}%</span>
                  </div>
                  <p className="mb-1 text-[11px] text-muted-foreground">
                    {row.completed}/{row.total} subtopics marked · {row.topicCountInChapter} topic{row.topicCountInChapter === 1 ? "" : "s"} in this chapter
                  </p>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all", TOPIC_BAR_TONES[i % TOPIC_BAR_TONES.length])}
                      style={{ width: `${row.completionPct}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {lowestChapter && lowestChapter.completionPct < 100 ? (
            <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/5 p-3 text-sm text-rose-200">
              Needs attention: {lowestChapter.label} at {lowestChapter.completionPct}% ({lowestChapter.completed}/{lowestChapter.total}{" "}
              subtopics across {lowestChapter.topicCountInChapter} topic{lowestChapter.topicCountInChapter === 1 ? "" : "s"}) — schedule revision or a targeted mock on this chapter.
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm dark:bg-slate-950/60">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-bold">Karnataka leaderboard</h2>
            </div>
            <button
              type="button"
              title="Mock data — live rankings when monetization ships"
              className="text-xs font-bold text-emerald-500 hover:underline"
            >
              See all 38,000 →
            </button>
          </div>
          <ul className="divide-y divide-border/60">
            {MOCK_LEADERBOARD.map((row) => (
              <li key={row.rank} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-6 font-bold text-muted-foreground">{row.rank}</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  {row.name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.city}</p>
                </div>
                <span className="font-mono text-sm font-bold tabular-nums">{row.pts.toLocaleString()}</span>
              </li>
            ))}
            <li className="flex items-center gap-3 py-2.5 text-sm ring-2 ring-emerald-500/30 ring-inset rounded-lg px-1 -mx-1">
              <span className="w-6 font-bold text-muted-foreground">14</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-600">
                You
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  You — {storeUser?.name ?? profile?.name ?? "You"}{" "}
                  <span className="ml-1 rounded bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-600">YOU</span>
                </p>
                <p className="text-xs text-muted-foreground">Bengaluru</p>
              </div>
              <span className="font-mono text-sm font-bold tabular-nums">{rdm.toLocaleString()}</span>
            </li>
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">310 points to reach top 10 · Keep your streak going (illustrative)</p>
        </div>
      </section>

      {/* Community + mocks + EduFund */}
      <section className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm dark:bg-slate-950/60 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">CommunityFeed</h2>
            <Link href="/magic-wall" className="text-xs font-bold text-primary hover:underline">
              Open feed ↗
            </Link>
          </div>
          <RawCommunityFeed />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm dark:bg-slate-950/60">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-bold">Upcoming Testbee mocks</h3>
              </div>
              <span className="text-xs font-bold text-muted-foreground">All mocks →</span>
            </div>
            <ul className="space-y-3">
              {UPCOMING_MOCKS.map((m) => (
                <li key={m.title} className={cn("rounded-xl border bg-background/60 p-3 dark:bg-slate-900/50", m.tone)}>
                  <p className="font-semibold leading-snug">{m.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{m.meta}</p>
                  <div className="mt-2">
                    {m.action === "Start now" ? (
                      <Button size="sm" className="rounded-full font-bold" onClick={() => router.push("/mock")}>
                        Start now
                      </Button>
                    ) : m.action === "Scheduled" ? (
                      <Button size="sm" variant="secondary" disabled className="rounded-full font-bold">
                        Scheduled
                      </Button>
                    ) : (
                      <span className="inline-block rounded-full border border-border px-2 py-1 text-[11px] font-bold text-muted-foreground">
                        Sat 19 Apr
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">Mock schedule shown for investors — will go live with calendar integration.</p>
          </div>

          <div className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm dark:bg-slate-950/60">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sprout className="h-4 w-4 text-emerald-500" />
                <h3 className="font-bold">EduFund progress</h3>
              </div>
              <Link href="/edufund" className="text-xs font-bold text-emerald-500 hover:underline">
                View grants →
              </Link>
            </div>
            <ul className="space-y-4">
              {EDUFUND_TIERS.map((tier) => (
                <li key={tier.name}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold">{tier.name}</p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold",
                        tier.status === "Unlocked" && "bg-emerald-500/15 text-emerald-600",
                        tier.status === "In progress" && "bg-indigo-500/15 text-indigo-300",
                        tier.status === "Locked" && "bg-orange-500/15 text-orange-400"
                      )}
                    >
                      {tier.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{tier.detail}</p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400")} style={{ width: `${tier.progress * 100}%` }} />
                  </div>
                  <p className={cn("mt-1 text-sm font-bold", tier.tone)}>{tier.amount}</p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">Tiers shown as mock milestones — ties to RDM & grants later.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
