"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/store/useUserStore";
import {
  parseBitsTestAttemptsStore,
  type ParsedBitsAttemptRow,
} from "@/lib/parseBitsTestAttemptsStore";
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
  normalizeCurriculumText,
  parseClassLevelsFromLessonMarkedEngagementRaw,
} from "@/lib/dashboardChapterCompletion";
import type { DailyChecklistApiResponse } from "@/lib/dailyChecklistState";
import { fetchWithClientAuth, getClientApiAuthHeaders } from "@/lib/clientApiAuth";
import { fetchMockPapersFromSupabase } from "@/lib/mockPapersFromSupabase";
import { appendQueryParams, buildTopicOverviewPath, buildTopicPath } from "@/lib/topicRoutes";
import { fetchAdvancedLessonCompletionKeys } from "@/lib/lessonCompletionClient";
import { isSubtopicLessonCompleteAtAdvanced } from "@/lib/lessonCompletionRollup";
import { EDUBLAST_STUDY_DAYS_REFRESH } from "@/lib/studyDayBumpEvents";
import { supabase } from "@/integrations/supabase/client";
import { useTopicTaxonomy } from "@/hooks/useTopicTaxonomy";
import type { TopicNode } from "@/data/topicTaxonomy";
import type { Subject, SubjectCombo } from "@/types";
import { DEFAULT_RDM_CONFIG, fetchRdmConfig } from "@/lib/rdmConfig";
import { EDUFUND_RDM_GATES } from "@/lib/dashboardSidebarMetrics";
import RawCommunityFeed from "@/components/explore/RawCommunityFeed";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSitePresenceLiveMsToday } from "@/components/providers/SitePresenceProvider";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  LineChart,
  Sprout,
  Star,
} from "lucide-react";

const TOPIC_BAR_TONES = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-cyan-500",
];

/** Subject accuracy card: show this many chapters per page; pagination only when total exceeds this. */
const CHAPTER_ACCURACY_PAGE_SIZE = 5;

type HeatmapMode = "7" | "30";

/** Human-readable names for checklist items a–d (matches API flags). */
function formatRemainingChecklistLabels(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]!} and ${labels[1]!}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]!}`;
}

const MOCK_LEADERBOARD = [
  { rank: 1, name: "Karthik Reddy", city: "Bengaluru", pts: 985 },
  { rank: 2, name: "Ananya Iyer", city: "Mysuru", pts: 942 },
  { rank: 3, name: "Siddharth Rao", city: "Mangaluru", pts: 876 },
  { rank: 4, name: "Meghana Gowda", city: "Hubli", pts: 812 },
  { rank: 5, name: "Praveen Kumar", city: "Davangere", pts: 790 },
] as const;

type UpcomingBlock = {
  key: string;
  title: string;
  meta: string;
  tone: string;
  href: string;
};

const SUBJECT_DISPLAY: Record<Subject, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  math: "Mathematics",
};

/** Subtopic is excluded from “upcoming quiz” picks if advanced lesson is marked complete or an advanced bits attempt exists. */
function subtopicAdvancedDoneForUpcoming(
  node: TopicNode,
  subName: string,
  attempts: ParsedBitsAttemptRow[],
  lessonKeys: Set<string>,
  boardNorm: string
): boolean {
  if (
    isSubtopicLessonCompleteAtAdvanced(lessonKeys, {
      board: boardNorm,
      subject: node.subject,
      classLevel: node.classLevel as 11 | 12,
      topic: node.topic,
      subtopicName: subName,
    })
  ) {
    return true;
  }
  const nt = normalizeCurriculumText(node.topic);
  const ns = normalizeCurriculumText(subName);
  return attempts.some(
    (r) =>
      r.level === "advanced" &&
      r.subject === node.subject &&
      r.classLevel === node.classLevel &&
      normalizeCurriculumText(r.topic) === nt &&
      normalizeCurriculumText(r.subtopicName) === ns
  );
}

function topicHasOpenAdvancedSubtopic(
  node: TopicNode,
  attempts: ParsedBitsAttemptRow[],
  lessonKeys: Set<string>,
  boardNorm: string
): boolean {
  for (const st of node.subtopics ?? []) {
    if (!subtopicAdvancedDoneForUpcoming(node, st.name, attempts, lessonKeys, boardNorm)) {
      return true;
    }
  }
  return false;
}

function pickRandomUnique<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < count && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]!);
  }
  return out;
}

function pickRandomOpenSubtopicName(
  node: TopicNode,
  attempts: ParsedBitsAttemptRow[],
  lessonKeys: Set<string>,
  boardNorm: string
): string | null {
  const open = (node.subtopics ?? []).filter(
    (st) => !subtopicAdvancedDoneForUpcoming(node, st.name, attempts, lessonKeys, boardNorm)
  );
  if (open.length === 0) return null;
  return open[Math.floor(Math.random() * open.length)]!.name;
}

/** Up to two topics for dashboard quiz cards; prefers two different PCM subjects when pools allow. */
function pickTwoQuizTopicsDistinctSubject(candidates: TopicNode[]): TopicNode[] {
  const pools: Record<Subject, TopicNode[]> = {
    physics: [],
    chemistry: [],
    math: [],
  };
  for (const n of candidates) {
    pools[n.subject].push(n);
  }
  const available = (["physics", "chemistry", "math"] as const).filter((s) => pools[s].length > 0);
  if (available.length >= 2) {
    const order = [...available];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = order[i]!;
      order[i] = order[j]!;
      order[j] = tmp;
    }
    const s0 = order[0]!;
    const s1 = order[1]!;
    const p0 = pools[s0];
    const p1 = pools[s1];
    return [
      p0[Math.floor(Math.random() * p0.length)]!,
      p1[Math.floor(Math.random() * p1.length)]!,
    ];
  }
  return pickRandomUnique(candidates, Math.min(2, candidates.length));
}

function greenCellClass(level: 0 | 1 | 2 | 3, isToday: boolean): string {
  const ring = isToday ? "ring-2 ring-teal-400 ring-offset-2 ring-offset-background" : "";
  const base = "rounded-lg border transition-colors " + ring;
  switch (level) {
    case 0:
      return cn(base, "border-red-500/35 bg-red-950/55 text-red-100");
    case 1:
      return cn(base, "border-emerald-400/45 bg-emerald-400/28 text-emerald-950 dark:text-emerald-50");
    case 2:
      return cn(base, "border-emerald-500/45 bg-emerald-600/60 text-white");
    case 3:
      return cn(base, "border-emerald-700/50 bg-emerald-950/90 text-emerald-50");
  }
}

function heatmapLoadingCellClass(isToday: boolean): string {
  const ring = isToday ? "ring-2 ring-teal-400 ring-offset-2 ring-offset-background" : "";
  return cn(
    "rounded-lg border border-border/60 bg-muted/35 text-muted-foreground/90 transition-colors " + ring
  );
}

export default function StudentHomeDashboard() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const storeUser = useUserStore((s) => s.user);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("7");
  const [studyMsByDay, setStudyMsByDay] = useState<Map<string, number>>(() => new Map());
  const [presenceMsByDay, setPresenceMsByDay] = useState<Map<string, number>>(() => new Map());
  const [streakSummary, setStreakSummary] = useState<{
    streak: number;
    activeDaysThisMonth: number;
  } | null>(null);
  const [studyDaysStatus, setStudyDaysStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [studyStreakBonusWeek, setStudyStreakBonusWeek] = useState(
    DEFAULT_RDM_CONFIG.study_streak_bonus_week_number
  );
  const [studyStreakBonusRdm, setStudyStreakBonusRdm] = useState(
    DEFAULT_RDM_CONFIG.study_streak_bonus_rdm
  );
  /** Sum of RDM from tracked claims in the last 7 IST days (see /api/user/rdm-recent-by-activity). */
  const [rdmEarnedThisWeek, setRdmEarnedThisWeek] = useState<number | null>(null);
  const [rdmWeeklyLoadState, setRdmWeeklyLoadState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  /** Mock + 2 advanced quiz suggestions (randomized on load / when deps change). */
  const [upcomingBlocks, setUpcomingBlocks] = useState<UpcomingBlock[] | null>(null);
  /** After first successful fetch, refetches stay quiet (no greeting/stat "…" flicker). */
  const studyDaysCommittedRef = useRef(false);
  const {
    taxonomy: fullTaxonomy,
    loading: taxonomyLoading,
    error: taxonomyError,
  } = useTopicTaxonomy();

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
  const monthDays = useMemo(
    () => new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    [now]
  );

  useEffect(() => {
    const id = setInterval(() => setDashboardClock(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchRdmConfig().then((cfg) => {
      if (cancelled) return;
      setStudyStreakBonusWeek(Math.max(1, Math.round(cfg.study_streak_bonus_week_number)));
      setStudyStreakBonusRdm(Math.max(0, Math.round(cfg.study_streak_bonus_rdm)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rdm = profile?.rdm ?? storeUser?.rdm ?? 0;

  const edufundProgressData = useMemo(() => {
    const wallet = Math.max(0, Math.floor(Number(rdm) || 0));
    const nextGate = EDUFUND_RDM_GATES.find((g) => wallet < g.need);
    if (!nextGate) {
      return { displayPrimary: "100%" as const, displaySuffix: null as string | null };
    }
    const pct = Math.min(100, Math.round((wallet / nextGate.need) * 100));
    return {
      displayPrimary: `${pct}%` as const,
      displaySuffix: ` (to ${nextGate.name})` as const,
    };
  }, [rdm]);

  const edufundTiers = useMemo(() => {
    const wallet = Math.max(0, Math.floor(Number(rdm) || 0));
    const tierGates = EDUFUND_RDM_GATES.slice(0, 3);
    const firstLockedIdx = tierGates.findIndex((g) => wallet < g.need);
    return tierGates.map((gate, idx) => {
      const prevNeed = idx === 0 ? 0 : tierGates[idx - 1]!.need;
      const span = Math.max(1, gate.need - prevNeed);
      const progress = Math.max(0, Math.min(1, (wallet - prevNeed) / span));
      const unlocked = wallet >= gate.need;
      const inProgress = !unlocked && firstLockedIdx === idx;
      const status = unlocked ? "Unlocked" : inProgress ? "In progress" : "Locked";
      const detail = unlocked
        ? `${gate.need.toLocaleString("en-IN")} RDM threshold met`
        : `${gate.need.toLocaleString("en-IN")} RDM needed · ${Math.max(0, gate.need - wallet).toLocaleString("en-IN")} more to go`;
      return {
        name: gate.name,
        status,
        detail,
        progress: unlocked ? 1 : progress,
        amount: `₹${gate.unlockInrAmount.toLocaleString("en-IN")}`,
        tone:
          status === "Unlocked"
            ? "text-emerald-500"
            : status === "In progress"
              ? "text-indigo-400"
              : "text-orange-400",
      };
    });
  }, [rdm]);

  useEffect(() => {
    if (!profile?.id) {
      startTransition(() => {
        setRdmEarnedThisWeek(null);
        setRdmWeeklyLoadState("idle");
      });
      return;
    }
    let cancelled = false;
    startTransition(() => {
      setRdmWeeklyLoadState("loading");
    });
    void (async () => {
      try {
        const headers = await getClientApiAuthHeaders();
        const res = await fetch("/api/user/rdm-recent-by-activity?days=7", { headers });
        if (cancelled) return;
        if (!res.ok) {
          setRdmEarnedThisWeek(null);
          setRdmWeeklyLoadState("error");
          return;
        }
        const json = (await res.json()) as { totalInWindow?: number };
        const total = Math.max(0, Math.floor(Number(json.totalInWindow) || 0));
        setRdmEarnedThisWeek(total);
        setRdmWeeklyLoadState("ready");
      } catch {
        if (!cancelled) {
          setRdmEarnedThisWeek(null);
          setRdmWeeklyLoadState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

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
      const res = await fetch(`/api/user/study-days?from=${fromStr}&to=${toStr}&today=${toStr}`, {
        headers,
      });
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
  const dashboardSubjects: Subject[] = useMemo(() => ["physics", "chemistry", "math"], []);

  const boardNormForUpcomingLessons = useMemo(
    () => String(storeUser?.board ?? profile?.board ?? "cbse").trim().toLowerCase(),
    [storeUser?.board, profile?.board]
  );

  const [advancedLessonKeys, setAdvancedLessonKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!user?.id) {
      startTransition(() => {
        setAdvancedLessonKeys(new Set());
      });
      return;
    }
    const effectiveClass: 11 | 12 = classLevelNum === 12 ? 12 : 11;
    let cancelled = false;
    void (async () => {
      const subjects: Subject[] = ["physics", "chemistry", "math"];
      const results = await Promise.all(
        subjects.map((subject) =>
          fetchAdvancedLessonCompletionKeys({
            subject,
            classLevel: effectiveClass,
            board: boardNormForUpcomingLessons,
          })
        )
      );
      if (cancelled) return;
      const merged = new Set<string>();
      for (const s of results) {
        for (const k of s) merged.add(k);
      }
      setAdvancedLessonKeys(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, classLevelNum, boardNormForUpcomingLessons]);

  useEffect(() => {
    if (taxonomyLoading) {
      startTransition(() => {
        setUpcomingBlocks(null);
      });
      return;
    }
    const effectiveClass: 11 | 12 = classLevelNum === 12 ? 12 : 11;
    const board = String(storeUser?.board ?? profile?.board ?? "cbse").trim() || "cbse";
    const subjects: Subject[] = ["physics", "chemistry", "math"];

    const candidates = fullTaxonomy.filter(
      (n) =>
        subjects.includes(n.subject) &&
        n.classLevel === effectiveClass &&
        (n.subtopics?.length ?? 0) > 0 &&
        topicHasOpenAdvancedSubtopic(n, bitsAttemptRows, advancedLessonKeys, boardNormForUpcomingLessons)
    );

    let cancelled = false;
    void (async () => {
      let papers: Awaited<ReturnType<typeof fetchMockPapersFromSupabase>> = [];
      try {
        papers = await fetchMockPapersFromSupabase();
      } catch {
        papers = [];
      }
      if (cancelled) return;

      const withSlug = papers.filter((p) => typeof p.slug === "string" && p.slug.trim().length > 0);
      const randomPaper =
        withSlug.length > 0 ? withSlug[Math.floor(Math.random() * withSlug.length)]! : null;

      const pickedTopics = pickTwoQuizTopicsDistinctSubject(candidates);

      const blocks: UpcomingBlock[] = [];

      if (randomPaper?.slug) {
        blocks.push({
          key: `mock-${randomPaper.slug}`,
          title: randomPaper.title,
          meta: `${randomPaper.durationMinutes} min · ${randomPaper.questionsCount} questions · ${randomPaper.difficulty}`,
          tone: "border-rose-500/40",
          href: `/mock?paper=${encodeURIComponent(randomPaper.slug)}`,
        });
      } else {
        blocks.push({
          key: "mock-fallback",
          title: "Timed mock test",
          meta: "Browse the mock library and start a paper",
          tone: "border-rose-500/40",
          href: "/mock",
        });
      }

      const quizTones = ["border-violet-500/40", "border-blue-500/40"] as const;
      pickedTopics.forEach((node, idx) => {
        const subName = pickRandomOpenSubtopicName(
          node,
          bitsAttemptRows,
          advancedLessonKeys,
          boardNormForUpcomingLessons
        );
        const lessonPath =
          subName != null
            ? buildTopicPath(
                board,
                node.subject,
                node.classLevel,
                node.topic,
                subName,
                "advanced",
                "random",
                node.chapterTitle
              )
            : buildTopicOverviewPath(
                board,
                node.subject,
                node.classLevel,
                node.topic,
                "advanced",
                "random",
                node.chapterTitle
              );
        const href = appendQueryParams(lessonPath, {
          panel: "quiz",
          quizSet: "1",
          openQuiz: "1",
        });
        blocks.push({
          key: `adv-quiz-${node.subject}-${node.classLevel}-${normalizeCurriculumText(node.topic)}-${normalizeCurriculumText(subName ?? "overview")}`,
          title: `${SUBJECT_DISPLAY[node.subject]} — ${node.topic}`,
          meta: `Advanced quiz · Class ${node.classLevel} · Start opens a random subtopic you have not finished at Advanced`,
          tone: quizTones[Math.min(idx, 1)]!,
          href,
        });
      });

      if (!cancelled) setUpcomingBlocks(blocks);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    fullTaxonomy,
    taxonomyLoading,
    bitsAttemptRows,
    profile?.board,
    storeUser?.board,
    classLevelNum,
    advancedLessonKeys,
    boardNormForUpcomingLessons,
  ]);

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
      {
        progressSource: "lesson_marked_only",
        board: profile?.board?.trim() || "cbse",
      }
    );
  }, [
    taxonomyForChapterAccuracy,
    bitsAttemptRows,
    submittedBitsKeys,
    profile?.subtopic_engagement,
    profile?.board,
  ]);

  const [chapterAccuracyPageIdx, setChapterAccuracyPageIdx] = useState(0);

  const chapterAccuracyPageCount = useMemo(
    () => Math.max(1, Math.ceil(chapterRows.length / CHAPTER_ACCURACY_PAGE_SIZE)),
    [chapterRows.length]
  );

  /** Clamp when chapter list shrinks so we never point past the last page. */
  const effectiveChapterPageIdx = Math.min(
    chapterAccuracyPageIdx,
    Math.max(0, chapterAccuracyPageCount - 1)
  );

  const chapterRowsVisible = useMemo(() => {
    const start = effectiveChapterPageIdx * CHAPTER_ACCURACY_PAGE_SIZE;
    return chapterRows.slice(start, start + CHAPTER_ACCURACY_PAGE_SIZE);
  }, [chapterRows, effectiveChapterPageIdx]);

  const [dailyChecklist, setDailyChecklist] = useState<DailyChecklistApiResponse | null>(null);
  const [dailyChecklistStatus, setDailyChecklistStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const dailyChecklistCommittedRef = useRef(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(true);

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
      const res = await fetchWithClientAuth(`/api/user/daily-checklist?${q.toString()}`, {
        headers,
      });
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
    if (dailyChecklist.challengeYourselfDone) n++;
    return n;
  }, [dailyChecklist]);

  const checklistItems = useMemo(
    () => [
      {
        id: "a",
        text: "Do your Daily Routine — complete DailyDose (10 questions, academic, 5 mins) and complete Funbrain Forge (10 questions, non-academic, 5 minutes)",
        done: Boolean(dailyChecklist?.dailyDoseDone),
      },
      {
        id: "b",
        text: "At least 1 topic and 1 sub-topic per subject – Physics, Chemistry and Mathematics (a submitted topic quiz in each subject), & tap Mark as complete in Lessons/Progress after finishing all five steps there",
        done: Boolean(dailyChecklist?.subtopicRoutineDone),
      },
      {
        id: "c",
        text: "Gyan++: stay on the feed at least 5 minutes, save at least 1 doubt for revision, and upvote or comment on someone else’s post today.",
        done: Boolean(dailyChecklist?.gyanPlusDone),
      },
      {
        id: "d",
        text: "Instacue: scroll through all 32 cards for your chapter (same checklist as Lessons / Progress; count resets each calendar day)",
        done: Boolean(dailyChecklist?.instacueSessionDone),
      },
      {
        id: "e",
        text: "Try your luck at the Challenge Yourself and win RDM",
        done: Boolean(dailyChecklist?.challengeYourselfDone),
      },
    ],
    [dailyChecklist]
  );

  /**
   * Checklist strip + Gyan++ line: lead with progress (gain framing); avoid a lone row of zeros,
   * which reads as failure (loss aversion). When Gyan++ metrics are all still at 0, use autonomy-
   * supportive, “not yet” wording (growth mindset / SDT) instead of deficit tallies.
   */
  const checklistStripSummary = useMemo(() => {
    if (dailyChecklistStatus === "error") return null;

    const pending =
      dailyChecklistStatus === "idle" ||
      dailyChecklistStatus === "loading" ||
      dailyChecklist == null;

    if (pending) {
      return {
        progressLine: "Loading today's checklist…",
        gyanLine: null as string | null,
      };
    }

    let progressLine: string;
    if (checklistDoneCount >= 5) {
      progressLine = "All 5 daily habits complete today — nice work.";
    } else if (checklistDoneCount > 0) {
      progressLine = `${checklistDoneCount} of 5 habits checked off today`;
    } else {
      progressLine =
        "0 of 5 habits yet — open the checklist when you're ready; no rush.";
    }

    const m = Math.round(dailyChecklist.gyanPlusProgress.focusMs / 60000);
    const s = dailyChecklist.gyanPlusProgress.savesToday;
    const c = dailyChecklist.gyanPlusProgress.communityActionsToday;
    const gyanAllZero = m === 0 && s === 0 && c === 0;

    const gyanLine = gyanAllZero
      ? "Gyan++: when you have a moment, browse the feed, save a doubt, or react to a post — small steps count."
      : `Gyan++ so far today: ${m} min on the feed · ${s} doubt${s === 1 ? "" : "s"} saved · ${c} community action${c === 1 ? "" : "s"}`;

    return { progressLine, gyanLine };
  }, [dailyChecklist, dailyChecklistStatus, checklistDoneCount]);

  /** Single-line checklist hint for the greeting strip (items a–e from GET /api/user/daily-checklist). */
  const greetingChecklistLine = useMemo(() => {
    if (!profile?.id) {
      return {
        tone: "muted" as const,
        text: "Sign in to see your daily checklist and study streak.",
      };
    }
    if (dailyChecklistStatus === "error") {
      return {
        tone: "warn" as const,
        text: "We could not load today's checklist. Refresh the page to see what's left.",
      };
    }
    if (dailyChecklistStatus === "loading" || dailyChecklist == null) {
      return { tone: "muted" as const, text: "Loading today's checklist…" };
    }
    if (checklistDoneCount === 0) {
      return {
        tone: "muted" as const,
        text: "Please go through and complete the checklist below.",
      };
    }
    if (checklistDoneCount < 5) {
      const labels: string[] = [];
      if (!dailyChecklist.dailyDoseDone) labels.push("DailyDose");
      if (!dailyChecklist.subtopicRoutineDone) labels.push("Subtopic routine");
      if (!dailyChecklist.gyanPlusDone) labels.push("Gyan++");
      if (!dailyChecklist.instacueSessionDone) labels.push("Instacue");
      if (!dailyChecklist.challengeYourselfDone) labels.push("Challenge yourself");
      const rest = formatRemainingChecklistLabels(labels);
      return {
        tone: "muted" as const,
        text: labels.length
          ? `Remaining: ${rest}.`
          : "Almost there — finish the last items in the checklist below.",
      };
    }
    return {
      tone: "muted" as const,
      text: "You've completed today's checklist — great work. Keep your streak going.",
    };
  }, [profile?.id, dailyChecklistStatus, dailyChecklist, checklistDoneCount]);

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
      level: 0 | 1 | 2 | 3;
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
      level: 0 | 1 | 2 | 3;
      label: string;
      tooltipTitle: string | null;
    }[] = [];
    for (let i = 0; i < offset; i++) {
      cells.push({
        day: null,
        key: null,
        activeMs: 0,
        presenceMs: 0,
        level: 0,
        label: "—",
        tooltipTitle: null,
      });
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
      cells.push({
        day: null,
        key: null,
        activeMs: 0,
        presenceMs: 0,
        level: 0,
        label: "—",
        tooltipTitle: null,
      });
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

  const displayName = useMemo(() => {
    const raw = (storeUser?.name ?? profile?.name ?? "there").trim() || "there";
    const first = raw.split(/\s+/)[0] ?? "there";
    const at = first.indexOf("@");
    const cleaned = at > 0 ? first.slice(0, at) : first;
    return cleaned || "there";
  }, [storeUser?.name, profile?.name]);
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

  const studyStreakPending =
    profile?.id && (studyDaysStatus === "idle" || studyDaysStatus === "loading");
  const studyStreakReady = profile?.id && studyDaysStatus === "ready";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
      {/* Greeting strip */}
      <div className="rounded-2xl border border-border/60 bg-card/60 px-4 py-3 dark:bg-slate-950/50">
        <p className="text-sm text-foreground">
          <span className="font-bold">
            {greeting}, {displayName}!
          </span>{" "}
          <span
            className={
              greetingChecklistLine.tone === "warn" ? "text-amber-200/90" : "text-muted-foreground"
            }
          >
            {greetingChecklistLine.text}{" "}
            {profile?.id && studyStreakReady ? (
              <>
                Your study streak is {streakDays} {streakDays === 1 ? "day" : "days"} — don&apos;t
                break it.
              </>
            ) : profile?.id && studyStreakPending ? (
              <>Loading your saved study streak…</>
            ) : profile?.id && studyDaysStatus === "error" ? (
              <>Study streak couldn&apos;t load — try again in a moment.</>
            ) : !profile?.id ? (
              <>Sign in to track your study streak from saved play and quiz time.</>
            ) : null}
          </span>
        </p>
      </div>

      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          My dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{classLine}</p>
      </div>

      {/* Stat cards */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "RDM EARNED",
            value: !profile?.id
              ? "—"
              : rdmWeeklyLoadState === "loading"
                ? "…"
                : rdmWeeklyLoadState === "error"
                  ? "—"
                  : `+${(rdmEarnedThisWeek ?? 0).toLocaleString("en-IN")}`,
            sub: !profile?.id
              ? "Sign in to track weekly RDM"
              : rdmWeeklyLoadState === "error"
                ? "Could not load this week's earnings"
                : "this week",
            subClass: "text-muted-foreground",
          },
          {
            label: "RDM BALANCE",
            value: rdm.toLocaleString("en-IN"),
            sub: "available",
            subClass: "text-muted-foreground",
          },
          {
            label: "EDUFUND PROGRESS",
            value: edufundProgressData.displayPrimary,
            valueSuffix: edufundProgressData.displaySuffix ?? undefined,
            sub: "",
            subClass: "text-muted-foreground",
          },
          {
            label: "STUDY STREAK",
            value: studyStreakReady
              ? `${streakDays} days`
              : studyStreakPending
                ? "…"
                : studyDaysStatus === "error"
                  ? "—"
                  : "—",
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
          <div
            key={c.label}
            className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm dark:bg-slate-950/60"
          >
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">
              {c.value}
              {"valueSuffix" in c && c.valueSuffix ? (
                <span className="text-sm font-semibold text-muted-foreground tabular-nums">
                  {c.valueSuffix}
                </span>
              ) : null}
            </p>
            {c.sub ? (
              <p className={cn("mt-1 text-xs font-semibold", c.subClass)}>{c.sub}</p>
            ) : null}
          </div>
        ))}
      </section>

      {/* Study streak */}
      <section className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm dark:bg-slate-950/60">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-teal-500" />
            <h2 className="text-lg font-bold text-foreground">Study streak</h2>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-300">
            <Flame className="h-3.5 w-3.5" />
            Week {studyStreakBonusWeek} bonus: +{studyStreakBonusRdm.toLocaleString("en-IN")} RDM
          </span>
        </div>

        <p id="study-streak-map-help" className="sr-only">
          Each day shows time on site with this tab in focus; hover for on-site time and saved study
          time toward your streak.
        </p>
        <div
          className="mb-3 inline-flex w-fit rounded-full border border-border bg-muted/30 p-0.5 dark:bg-slate-900/80"
          role="group"
          aria-label="Time on site map range"
          aria-describedby="study-streak-map-help"
        >
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
              const isToday =
                localDayKeyFromDate(cell.date) === localDayKeyFromDate(startOfLocalDay(now));
              const isReady = studyDaysStatus === "ready";
              return (
                <div
                  key={cell.key}
                  title={
                    isReady
                      ? `${cell.tooltipTitle} · Daily RDM: coming soon`
                      : "Loading activity…"
                  }
                  className={cn(
                    "flex min-h-[72px] min-w-[72px] flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 sm:min-w-[88px]",
                    isReady ? greenCellClass(cell.level, isToday) : heatmapLoadingCellClass(isToday)
                  )}
                >
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    {cell.date.toLocaleDateString(undefined, { weekday: "short" })}
                  </span>
                  <span className="text-sm font-extrabold tabular-nums">
                    {isReady ? cell.label : "…"}
                  </span>
                  {isToday ? (
                    <span className="text-[10px] font-semibold text-teal-400">Today</span>
                  ) : null}
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
                  return (
                    <div key={`pad-${idx}`} className="aspect-square rounded-lg bg-transparent" />
                  );
                }
                const d = new Date(now.getFullYear(), now.getMonth(), cell.day);
                const isToday = startOfLocalDay(d).getTime() === monthGrid.todayStart.getTime();
                return (
                  <div
                    key={cell.key}
                    title={
                      studyDaysStatus === "ready" && cell.tooltipTitle
                        ? `${cell.tooltipTitle} · RDM: later`
                        : undefined
                    }
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center gap-0.5 p-1 text-[10px] font-bold",
                      studyDaysStatus === "ready"
                        ? greenCellClass(cell.level, isToday)
                        : heatmapLoadingCellClass(isToday)
                    )}
                  >
                    <span>{cell.day}</span>
                    <span className="text-[9px] opacity-90">
                      {studyDaysStatus === "ready" ? cell.label : "…"}
                    </span>
                    {isToday ? <span className="text-[8px] text-teal-300">Today</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>Less</span>
          <span className="h-3 w-8 rounded bg-gradient-to-r from-red-950/70 via-emerald-500/60 to-emerald-950" />
          <span>More</span>
          <span className="ml-2">
            Red = no focus or under 10 minutes that day; light → dark green = longer focus (same as
            your profile heatmap). Cell numbers show time on EduBlast with this tab in the foreground
            (pauses when you switch tabs). Tooltips also show saved study time toward your streak
            (play + topic quizzes). A dash means no on-site time that day;{" "}
            <span className="font-mono">{"<1m"}</span> means under one minute on site. Streak =
            consecutive calendar days with any saved study time, counted through your most recent
            active day on or before today.
          </span>
        </div>
      </section>

      {/* Checklist trigger */}
      <section className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm dark:bg-slate-950/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <h2 className="text-lg font-bold">Today&apos;s checklist</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {dailyChecklistStatus === "error" ? (
                <span className="text-rose-300">
                  Could not load checklist status. Refresh and try again.
                </span>
              ) : checklistStripSummary ? (
                <>
                  <span className="font-semibold text-foreground">
                    {checklistStripSummary.progressLine}
                  </span>
                  {checklistStripSummary.gyanLine ? (
                    <>
                      {" · "}
                      {checklistStripSummary.gyanLine}
                    </>
                  ) : null}
                </>
              ) : null}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="rounded-full font-bold"
            onClick={() => setIsChecklistOpen(true)}
          >
            View checklist
          </Button>
        </div>
      </section>

      <Dialog open={isChecklistOpen} onOpenChange={setIsChecklistOpen}>
        <DialogContent
          className={
            "flex w-full max-w-3xl flex-col gap-0 overflow-hidden border-border/70 bg-card p-0 shadow-2xl " +
            "ring-1 ring-black/5 dark:border-white/10 dark:bg-[#070b14] dark:ring-white/10 " +
            "max-h-[min(92dvh,56rem)] " +
            /* Small screens: anchored bottom sheet — easier thumb reach, stable on notches */
            "max-sm:inset-x-0 max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto " +
            "max-sm:max-h-[min(90dvh,56rem)] max-sm:w-full max-sm:translate-x-0 max-sm:translate-y-0 " +
            "max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:border-x-0 max-sm:border-b-0 " +
            /* sm+: classic centered modal */
            "sm:left-1/2 sm:top-1/2 sm:w-[calc(100vw-1.5rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border " +
            "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          }
        >
          {/* Header: fixed height region; close (X) stays in component chrome; pr-* clears it */}
          <div className="shrink-0 border-b border-border/60 bg-gradient-to-b from-muted/50 to-transparent px-4 pb-4 pt-6 sm:px-6 sm:pb-5 sm:pt-7 dark:from-slate-900/90">
            <DialogHeader className="space-y-3 text-left">
              <div className="flex items-start gap-2.5 pr-11 sm:gap-3 sm:pr-12">
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500 sm:h-5 sm:w-5"
                  aria-hidden
                />
                <DialogTitle className="text-left text-base font-bold leading-snug tracking-tight sm:text-lg">
                  Today&apos;s checklist and what is done
                </DialogTitle>
              </div>
              <div className="flex flex-col gap-2 sm:gap-2.5">
                <Button
                  type="button"
                  size="default"
                  className="h-11 w-full min-h-[44px] gap-2 rounded-full font-bold sm:h-10 sm:w-fit sm:min-h-0"
                  onClick={() => router.push("/play")}
                >
                  <Flame className="h-4 w-4 shrink-0" aria-hidden />
                  Start streak for today
                </Button>
                <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                  Esc or the top-right close exits — away from the button above.
                </p>
              </div>
            </DialogHeader>
          </div>

          {/* Scrollable list: avoids whole-modal scroll jank on short phones */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 sm:px-6 sm:py-4">
            <ul className="space-y-2 sm:space-y-2.5">
              {checklistItems.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-3 dark:bg-slate-900/50 sm:px-3.5 sm:py-2.5"
                >
                  <div className="flex min-w-0 flex-1 gap-2.5 sm:gap-2">
                    {item.done ? (
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 sm:h-4 sm:w-4"
                        aria-label="Done"
                      />
                    ) : (
                      <span
                        className="mt-0.5 inline-flex h-4 w-4 shrink-0 rounded border border-dashed border-muted-foreground/50"
                        aria-hidden
                      />
                    )}
                    <span className="text-[13px] leading-relaxed text-foreground sm:text-sm sm:leading-normal">
                      <span className="font-bold">{item.id}.</span> {item.text}
                      {item.id === "c" ? (
                        <>
                          {" "}
                          <Link href="/doubts" className="font-bold text-primary hover:underline">
                            Open Gyan++
                          </Link>
                        </>
                      ) : null}
                      {item.id === "e" ? (
                        <>
                          {" "}
                          <Link href="/refer-earn" className="font-bold text-primary hover:underline">
                            Open Challenge Yourself
                          </Link>
                        </>
                      ) : null}
                      {item.id === "d" &&
                      dailyChecklist &&
                      !dailyChecklist.instacueSessionDone &&
                      dailyChecklist.instacueCombinedCount < 32 ? (
                        <span className="mt-1.5 block text-[11px] leading-snug text-muted-foreground sm:text-xs">
                          InstaCue reads logged: {dailyChecklist.instacueReadCount}/32
                          {dailyChecklist.instacueCombinedCount !== dailyChecklist.instacueReadCount ? (
                            <>
                              {" "}
                              · {dailyChecklist.instacueCombinedCount}/32 toward unlock (includes
                              today&apos;s revision saves)
                            </>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="shrink-0 border-t border-border/60 bg-muted/25 px-4 py-3 sm:px-6 dark:bg-slate-950/80">
            <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
              {dailyChecklistStatus === "error" ? (
                <span className="text-rose-300">
                  Could not load checklist status. Refresh and try again.
                </span>
              ) : checklistStripSummary ? (
                <>
                  <span className="font-semibold text-foreground">
                    {checklistStripSummary.progressLine}
                  </span>
                  {checklistStripSummary.gyanLine ? (
                    <>
                      {" · "}
                      {checklistStripSummary.gyanLine}
                    </>
                  ) : null}{" "}
                  (Items a–e are tracked live; Challenge Yourself completes after any Earn &amp;
                  Learn challenge run ends today).
                </>
              ) : null}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subject accuracy + Leaderboard */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm dark:bg-slate-950/60">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-emerald-500" />
              <h2 className="text-lg font-bold">Subject accuracy</h2>
            </div>
            <Link
              href="/performance"
              className="text-xs font-bold text-emerald-500 hover:underline"
            >
              View full report →
            </Link>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            {chapterAccuracyClassLabel} · Tracked only when you tap{" "}
            <span className="font-semibold text-foreground/90">Marked completed</span> in
            Lessons/Progress on a subtopic. Each chapter lists all curriculum subtopics; % is marked
            subtopics ÷ total subtopics in that chapter; chapters with at least one mark first
            (newest mark first).
          </p>
          {taxonomyLoading ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Loading curriculum…
            </p>
          ) : taxonomyError ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-rose-200">
              {taxonomyError}
            </p>
          ) : chapterRows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Open any subtopic, finish Lessons/Progress, and tap{" "}
              <span className="font-semibold text-foreground/90">Marked completed</span> — those
              chapters show here with real X/total subtopics (quizzes alone do not count).
            </p>
          ) : (
            <>
              <ul className="space-y-3">
                {chapterRowsVisible.map((row, i) => {
                  const toneIdx =
                    effectiveChapterPageIdx * CHAPTER_ACCURACY_PAGE_SIZE + i;
                  const rowBody = (
                    <>
                      <div className="mb-1 flex justify-between text-sm font-semibold">
                        <span>{row.label}</span>
                        <span>{row.completionPct}%</span>
                      </div>
                      <p className="mb-1 text-[11px] text-muted-foreground">
                        {row.completed}/{row.total} subtopics marked · {row.topicCountInChapter}{" "}
                        topic
                        {row.topicCountInChapter === 1 ? "" : "s"} in this chapter
                      </p>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            TOPIC_BAR_TONES[toneIdx % TOPIC_BAR_TONES.length]
                          )}
                          style={{ width: `${row.completionPct}%` }}
                        />
                      </div>
                    </>
                  );
                  return (
                    <li key={row.label}>
                      {row.nextIncompleteSubtopicHref ? (
                        <Link
                          href={row.nextIncompleteSubtopicHref}
                          className="-mx-1 block cursor-pointer rounded-xl px-1 py-1.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {rowBody}
                        </Link>
                      ) : (
                        rowBody
                      )}
                    </li>
                  );
                })}
              </ul>
              {chapterRows.length > CHAPTER_ACCURACY_PAGE_SIZE ? (
                <div className="mt-3 flex flex-col gap-2.5 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    Showing{" "}
                    {effectiveChapterPageIdx * CHAPTER_ACCURACY_PAGE_SIZE + 1}–
                    {Math.min(
                      (effectiveChapterPageIdx + 1) * CHAPTER_ACCURACY_PAGE_SIZE,
                      chapterRows.length
                    )}{" "}
                    of {chapterRows.length} chapters
                  </p>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 flex-1 rounded-lg px-3 text-xs font-semibold sm:flex-initial"
                      disabled={effectiveChapterPageIdx <= 0}
                      onClick={() =>
                        setChapterAccuracyPageIdx((p) => {
                          const e = Math.min(p, Math.max(0, chapterAccuracyPageCount - 1));
                          return Math.max(0, e - 1);
                        })
                      }
                      aria-label="Previous chapters"
                    >
                      <ChevronLeft className="mr-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      Previous
                    </Button>
                    <span className="min-w-[5rem] text-center text-[11px] font-semibold tabular-nums text-muted-foreground">
                      {effectiveChapterPageIdx + 1} / {chapterAccuracyPageCount}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 flex-1 rounded-lg px-3 text-xs font-semibold sm:flex-initial"
                      disabled={effectiveChapterPageIdx >= chapterAccuracyPageCount - 1}
                      onClick={() =>
                        setChapterAccuracyPageIdx((p) => {
                          const e = Math.min(p, Math.max(0, chapterAccuracyPageCount - 1));
                          return Math.min(chapterAccuracyPageCount - 1, e + 1);
                        })
                      }
                      aria-label="Next chapters"
                    >
                      Next
                      <ChevronRight className="ml-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
          {lowestChapter && lowestChapter.completionPct < 100 ? (
            lowestChapter.nextIncompleteSubtopicHref ? (
              <Link
                href={lowestChapter.nextIncompleteSubtopicHref}
                className="mt-4 block cursor-pointer rounded-xl border border-rose-500/40 bg-rose-500/5 p-3 text-sm text-rose-200 transition-colors hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Needs attention: {lowestChapter.label} at {lowestChapter.completionPct}% (
                {lowestChapter.completed}/{lowestChapter.total} subtopics across{" "}
                {lowestChapter.topicCountInChapter} topic
                {lowestChapter.topicCountInChapter === 1 ? "" : "s"}) — schedule revision or a
                targeted mock on this chapter.
              </Link>
            ) : (
              <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/5 p-3 text-sm text-rose-200">
                Needs attention: {lowestChapter.label} at {lowestChapter.completionPct}% (
                {lowestChapter.completed}/{lowestChapter.total} subtopics across{" "}
                {lowestChapter.topicCountInChapter} topic
                {lowestChapter.topicCountInChapter === 1 ? "" : "s"}) — schedule revision or a
                targeted mock on this chapter.
              </div>
            )
          ) : null}
        </div>

        <div className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm dark:bg-slate-950/60">
          <div className="mb-2 flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-bold">Leaderboard</h2>
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
                <span className="font-mono text-sm font-bold tabular-nums">
                  {row.pts.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
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
              <Link href="/mock" className="text-xs font-bold text-muted-foreground hover:underline">
                All mocks →
              </Link>
            </div>
            <ul className="space-y-3">
              {upcomingBlocks === null ? (
                <>
                  {[0, 1, 2].map((i) => (
                    <li
                      key={`upcoming-skel-${i}`}
                      className="animate-pulse rounded-xl border border-border/60 bg-muted/15 p-3"
                    >
                      <div className="h-4 max-w-[78%] rounded bg-muted" />
                      <div className="mt-2 h-3 max-w-[52%] rounded bg-muted" />
                      <div className="mt-3 h-8 w-24 rounded-full bg-muted" />
                    </li>
                  ))}
                </>
              ) : (
                upcomingBlocks.map((m) => (
                  <li
                    key={m.key}
                    className={cn(
                      "rounded-xl border bg-background/60 p-3 dark:bg-slate-900/50",
                      m.tone
                    )}
                  >
                    <p className="font-semibold leading-snug">{m.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{m.meta}</p>
                    <div className="mt-2">
                      <Button
                        size="sm"
                        className="rounded-full font-bold"
                        onClick={() => router.push(m.href)}
                      >
                        Start now
                      </Button>
                    </div>
                  </li>
                ))
              )}
            </ul>
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
              {edufundTiers.map((tier) => (
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
                    <div
                      className={cn(
                        "h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                      )}
                      style={{ width: `${tier.progress * 100}%` }}
                    />
                  </div>
                  <p className={cn("mt-1 text-sm font-bold", tier.tone)}>{tier.amount}</p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Uses your live RDM balance and real EduFund tier thresholds.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
