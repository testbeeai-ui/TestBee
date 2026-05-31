"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useIsAppAdmin } from "@/hooks/useIsAppAdmin";
import { useUserStore } from "@/store/useUserStore";
import {
  parseBitsTestAttemptsStore,
  type ParsedBitsAttemptRow,
} from "@/lib/play/bits/parseBitsTestAttemptsStore";
import {
  activityGreenLevelFromStudyMs,
  addDaysLocal,
  formatPresenceMsForTooltip,
  formatSavedStudyMinutesLabel,
  formatStudyMsForTooltip,
  localDayKeyFromDate,
  startOfLocalDay,
  localDayBoundsIso,
} from "@/lib/dashboard/dashboardDayActivity";
import { computeStudyStreakFromDayMs } from "@/lib/dashboard/studyStreakClient";
import {
  buildChapterCompletionRowsByRecentActivity,
  normalizeCurriculumText,
  parseClassLevelsFromLessonMarkedEngagementRaw,
} from "@/lib/dashboard/dashboardChapterCompletion";
import type { DailyChecklistApiResponse } from "@/lib/dashboard/dailyChecklistState";
import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import { fetchMockPapersFromSupabase } from "@/lib/mock/mockPapersFromSupabase";
import {
  appendQueryParams,
  buildTopicOverviewPath,
  buildTopicPath,
} from "@/lib/curriculum/topicRoutes";
import { fetchMergedAdvancedLessonCompletionKeys } from "@/lib/curriculum/lessonCompletionClient";
import { fetchDailyChecklist } from "@/lib/dashboard/dailyChecklistClient";
import { isSubtopicLessonCompleteAtAdvanced } from "@/lib/curriculum/lessonCompletionRollup";
import {
  EDUBLAST_STUDY_DAYS_REFRESH,
  notifyStudyDaysRefresh,
} from "@/lib/dashboard/studyDayBumpEvents";
import { fetchStudyDays } from "@/lib/dashboard/studyDaysClient";
import { getLocalCalendarDateIso } from "@/lib/onboarding/dailyChecklistTaskStorage";
import { supabase } from "@/integrations/supabase/client";
import { useTopicTaxonomy } from "@/hooks/useTopicTaxonomy";
import type { TopicNode } from "@/data/topicTaxonomy";
import type { Subject, SubjectCombo } from "@/types";
import { DEFAULT_RDM_CONFIG, fetchRdmConfig } from "@/lib/rdm/rdmConfig";
import { EDUFUND_RDM_GATES } from "@/lib/dashboard/dashboardSidebarMetrics";
import {
  calculateActiveMultiplier,
  fetchSubscriptionConfig,
  inactivePenaltyRdmForPlan,
  normalizePlanTier,
  SUBSCRIPTION_CONFIG_DEFAULTS,
  type SubscriptionConfig,
} from "@/lib/subscription/subscriptionConfig";
import RawCommunityFeed from "@/components/explore/RawCommunityFeed";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSitePresenceLiveMsToday } from "@/components/providers/SitePresenceProvider";
import { cn } from "@/lib/utils";
import { FreeTrialPromoDialog } from "@/components/dashboard/FreeTrialPromoDialog";
import { OnboardingRewardDialog } from "@/components/dashboard/OnboardingRewardDialog";
import {
  FREE_TRIAL_ACTIVATED_EVENT,
  FREE_TRIAL_REVOKED_EVENT,
  ONBOARDING_REWARD_CLAIMED_EVENT,
  enableAdminManualOnboardingChecklist,
  getDashboardPopupPhase,
  syncDailyChecklistArmFromProfile,
  getDailyChecklistCooldownRemainingMs,
  getFreeTrialActivated,
  hydrateFreeTrialRdmAmounts,
  hydrateOnboardingProgressFromServer,
  isOnboardingRewardClaimed,
  isOnboardingRewardComplete,
  ONBOARDING_PROGRESS_EVENT,
  requestOnboardingClaimRewardPromo,
} from "@/lib/subscription/freeTrialClient";
import {
  getDailyStreakSuppressRemainingMs,
  isDailyStreakChecklistSuppressed,
  reconcileDailyStreakSuppressForTimeTravel,
} from "@/lib/onboarding/dailyStreakClient";
import {
  getActiveStreakDayNumber,
  getHighestClaimedStreakDay,
  getMaxReachableStreakDay,
  isStreakDayLockedByTrialEnd,
  isWaitingForDay2Unlock,
  parseDailyStreakServerState,
} from "@/lib/onboarding/dailyChecklistTaskStorage";
import { TIME_TRAVEL_OFFSET_CHANGED_EVENT } from "@/lib/dev/timeTravel";
import { fetchOnboardingRewardState } from "@/lib/subscription/onboardingRewardApi";
import { isFreeTrialPeriodEnded } from "@/lib/subscription/freeTrialTimer";
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

// const CHAPTER_ACCURACY_PAGE_SIZE = 5;

/** Dashboard Today's checklist strip + modal (after onboarding RDM claim, from next page load). */
const SHOW_DASHBOARD_CHECKLIST = true;

/** Flip to true to auto-open the +100 RDM onboarding popup after trial activation. */
const SHOW_ONBOARDING_REWARD_AUTO_POPUP = true;

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
    return [p0[Math.floor(Math.random() * p0.length)]!, p1[Math.floor(Math.random() * p1.length)]!];
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
      return cn(
        base,
        "border-emerald-400/45 bg-emerald-400/28 text-emerald-950 dark:text-emerald-50"
      );
    case 2:
      return cn(base, "border-emerald-500/45 bg-emerald-600/60 text-white");
    case 3:
      return cn(base, "border-emerald-700/50 bg-emerald-950/90 text-emerald-50");
  }
}

function heatmapLoadingCellClass(isToday: boolean): string {
  const ring = isToday ? "ring-2 ring-teal-400 ring-offset-2 ring-offset-background" : "";
  return cn(
    "rounded-lg border border-border/60 bg-muted/35 text-muted-foreground/90 transition-colors " +
      ring
  );
}

export default function StudentHomeDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, user, refreshProfile } = useAuth();
  const isAppAdmin = useIsAppAdmin();
  const storeUser = useUserStore((s) => s.user);

  useEffect(() => {
    if (isAppAdmin) {
      enableAdminManualOnboardingChecklist();
    }
  }, [isAppAdmin]);

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
  const [studyStreakBonusDays, setStudyStreakBonusDays] = useState(
    DEFAULT_RDM_CONFIG.study_streak_bonus_days
  );
  const [studyStreakBonusRdm, setStudyStreakBonusRdm] = useState(
    DEFAULT_RDM_CONFIG.study_streak_bonus_rdm
  );
  const [subscriptionCfg, setSubscriptionCfg] = useState<SubscriptionConfig>(
    SUBSCRIPTION_CONFIG_DEFAULTS
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
  const [dashboardClock, setDashboardClock] = useState(
    () => Date.now() + (profile?.time_travel_offset_ms ?? 0)
  );
  const now = useMemo(() => new Date(dashboardClock), [dashboardClock]);
  /** Stable for one local calendar day — dashboardClock ticks every 1s for timers. */
  const dailyChecklistDayIso = useMemo(
    () => getLocalCalendarDateIso(dashboardClock),
    [dashboardClock]
  );
  const monthDays = useMemo(
    () => new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    [now]
  );

  useEffect(() => {
    const offset = profile?.time_travel_offset_ms ?? 0;
    const initialSync = setTimeout(() => {
      setDashboardClock(Date.now() + offset);
    }, 0);
    const id = setInterval(() => {
      const currentOffset = profile?.time_travel_offset_ms ?? 0;
      setDashboardClock(Date.now() + currentOffset);
    }, 1000);
    return () => {
      clearTimeout(initialSync);
      clearInterval(id);
    };
  }, [profile?.time_travel_offset_ms]);

  useEffect(() => {
    let cancelled = false;
    void fetchRdmConfig().then((cfg) => {
      if (cancelled) return;
      setStudyStreakBonusDays(Math.max(1, Math.round(cfg.study_streak_bonus_days)));
      setStudyStreakBonusRdm(Math.max(0, Math.round(cfg.study_streak_bonus_rdm)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchSubscriptionConfig().then(setSubscriptionCfg).catch(() => {});
  }, []);

  const rdm = profile?.rdm ?? storeUser?.rdm ?? 0;

  const edufundProgressData = useMemo(() => {
    const wallet = Math.max(0, Math.floor(Number(rdm) || 0));
    const planTier = (profile?.plan_tier ?? "free_trial") as "free" | "free_trial" | "starter" | "pro";
    const activeMultiplier = calculateActiveMultiplier(
      planTier,
      profile?.subscription_started_at,
      profile?.created_at ?? new Date().toISOString(),
      subscriptionCfg
    );
    const effectiveWallet = Math.floor(wallet * activeMultiplier);

    const nextGate = EDUFUND_RDM_GATES.find((g) => effectiveWallet < g.need);
    if (!nextGate) {
      return { displayPrimary: "100%" as const, displaySuffix: null as string | null };
    }
    const pct = Math.min(100, Math.round((effectiveWallet / nextGate.need) * 100));
    return {
      displayPrimary: `${pct}%` as const,
      displaySuffix: ` (to ${nextGate.name})` as const,
    };
  }, [rdm, profile?.plan_tier, profile?.subscription_started_at, profile?.created_at, subscriptionCfg]);

  const edufundTiers = useMemo(() => {
    const wallet = Math.max(0, Math.floor(Number(rdm) || 0));
    const planTier = (profile?.plan_tier ?? "free_trial") as "free" | "free_trial" | "starter" | "pro";
    const activeMultiplier = calculateActiveMultiplier(
      planTier,
      profile?.subscription_started_at,
      profile?.created_at ?? new Date().toISOString(),
      subscriptionCfg
    );
    const effectiveWallet = Math.floor(wallet * activeMultiplier);

    const tierGates = EDUFUND_RDM_GATES.slice(0, 3);
    const firstLockedIdx = tierGates.findIndex((g) => effectiveWallet < g.need);
    return tierGates.map((gate, idx) => {
      const prevNeed = idx === 0 ? 0 : tierGates[idx - 1]!.need;
      const span = Math.max(1, gate.need - prevNeed);
      const progress = Math.max(0, Math.min(1, (effectiveWallet - prevNeed) / span));
      const unlocked = effectiveWallet >= gate.need;
      const inProgress = !unlocked && firstLockedIdx === idx;
      const status = unlocked ? "Unlocked" : inProgress ? "In progress" : "Locked";
      const detail = unlocked
        ? `${gate.need.toLocaleString("en-IN")} RDM threshold met`
        : `${gate.need.toLocaleString("en-IN")} RDM needed · ${Math.max(0, gate.need - effectiveWallet).toLocaleString("en-IN")} more to go`;
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
  }, [rdm, profile?.plan_tier, profile?.subscription_started_at, profile?.created_at, subscriptionCfg]);

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

  const inactivePenaltyRdm = useMemo(() => {
    const plan = normalizePlanTier(profile?.plan_tier, profile?.free_trial_activated);
    return inactivePenaltyRdmForPlan(plan, subscriptionCfg);
  }, [profile?.plan_tier, profile?.free_trial_activated, subscriptionCfg]);

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
      const json = await fetchStudyDays(fromStr, toStr, toStr);
      if (json.error) {
        if (!silent) setStudyDaysStatus("error");
        return;
      }
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
        setStreakSummary(computeStudyStreakFromDayMs(presenceMap, toStr));
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
        () => {
          void loadStudyDays();
          notifyStudyDaysRefresh();
        }
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
    () =>
      String(storeUser?.board ?? profile?.board ?? "cbse")
        .trim()
        .toLowerCase(),
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
      const merged = await fetchMergedAdvancedLessonCompletionKeys(
        subjects,
        effectiveClass,
        boardNormForUpcomingLessons
      );
      if (cancelled) return;
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
        topicHasOpenAdvancedSubtopic(
          n,
          bitsAttemptRows,
          advancedLessonKeys,
          boardNormForUpcomingLessons
        )
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
          href: `/mock-test?paper=${encodeURIComponent(randomPaper.slug)}`,
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

  const isChapterAccuracyPaginated = chapterRows.length >= 5;
  const chapterAccuracyPageSize = isChapterAccuracyPaginated ? 3 : 5;

  const chapterAccuracyPageCount = useMemo(
    () => Math.max(1, Math.ceil(chapterRows.length / chapterAccuracyPageSize)),
    [chapterRows.length, chapterAccuracyPageSize]
  );

  /** Clamp when chapter list shrinks so we never point past the last page. */
  const effectiveChapterPageIdx = Math.min(
    chapterAccuracyPageIdx,
    Math.max(0, chapterAccuracyPageCount - 1)
  );

  const chapterRowsVisible = useMemo(() => {
    const start = effectiveChapterPageIdx * chapterAccuracyPageSize;
    return chapterRows.slice(start, start + chapterAccuracyPageSize);
  }, [chapterRows, effectiveChapterPageIdx, chapterAccuracyPageSize]);

  const [dailyChecklist, setDailyChecklist] = useState<DailyChecklistApiResponse | null>(null);
  const [dailyChecklistStatus, setDailyChecklistStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const dailyChecklistCommittedRef = useRef(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const dailyChecklistAutoOpenedRef = useRef(false);
  const [freeTrialPromoOpen, setFreeTrialPromoOpen] = useState(false);
  const [trialActivated, setTrialActivated] = useState(() =>
    typeof window !== "undefined" ? getFreeTrialActivated(profile) : false
  );
  const [isOnboardingRewardOpen, setIsOnboardingRewardOpen] = useState(false);
  const [welcomeRdm, setWelcomeRdm] = useState(
    DEFAULT_RDM_CONFIG.free_trial_welcome_rdm
  );
  const [checklistRewardRdm, setChecklistRewardRdm] = useState(
    DEFAULT_RDM_CONFIG.free_trial_checklist_reward_rdm
  );

  const loadDailyChecklist = useCallback(async () => {
    if (!SHOW_DASHBOARD_CHECKLIST) return;
    await Promise.resolve();
    if (!profile?.id) {
      dailyChecklistCommittedRef.current = false;
      setDailyChecklist(null);
      setDailyChecklistStatus("idle");
      return;
    }
    const boundsDate = new Date(`${dailyChecklistDayIso}T12:00:00`);
    const { today, dayStart, dayEnd } = localDayBoundsIso(boundsDate);
    const subjects = dashboardSubjects.join(",");
    const silent = dailyChecklistCommittedRef.current;
    if (!silent) setDailyChecklistStatus("loading");
    try {
      const q = new URLSearchParams({
        today,
        dayStart,
        dayEnd,
        subjects,
      });
      const json = await fetchDailyChecklist(q);
      if (!json) {
        if (!silent) setDailyChecklistStatus("error");
        return;
      }
      setDailyChecklist(json);
      setDailyChecklistStatus("ready");
      dailyChecklistCommittedRef.current = true;
    } catch {
      if (!silent) setDailyChecklistStatus("error");
    }
  }, [profile?.id, dashboardSubjects, dailyChecklistDayIso]);

  useEffect(() => {
    if (!SHOW_DASHBOARD_CHECKLIST) return;
    startTransition(() => {
      dailyChecklistCommittedRef.current = false;
      setDailyChecklist(null);
      setDailyChecklistStatus("idle");
    });
  }, [profile?.id]);

  useEffect(() => {
    if (!SHOW_DASHBOARD_CHECKLIST) return;
    startTransition(() => {
      void loadDailyChecklist();
    });
  }, [loadDailyChecklist]);

  useEffect(() => {
    if (!SHOW_DASHBOARD_CHECKLIST) return;
    const onFocus = () => void loadDailyChecklist();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadDailyChecklist]);

  useEffect(() => {
    if (!SHOW_DASHBOARD_CHECKLIST) return;
    let debounceId: number | null = null;
    const onBump = () => {
      if (debounceId != null) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        debounceId = null;
        void loadDailyChecklist();
      }, 2_000);
    };
    window.addEventListener(EDUBLAST_STUDY_DAYS_REFRESH, onBump);
    return () => {
      if (debounceId) window.clearTimeout(debounceId);
      window.removeEventListener(EDUBLAST_STUDY_DAYS_REFRESH, onBump);
    };
  }, [loadDailyChecklist]);

  const applyDashboardPopupPhase = useCallback(() => {
    const activated = getFreeTrialActivated(profile);
    const phase = getDashboardPopupPhase(profile, profile?.id);
    setTrialActivated(activated);
    setFreeTrialPromoOpen(phase === "free_trial");
    setIsOnboardingRewardOpen(phase === "onboarding" && SHOW_ONBOARDING_REWARD_AUTO_POPUP);
    if (phase === "claim_reward" && SHOW_ONBOARDING_REWARD_AUTO_POPUP) {
      requestOnboardingClaimRewardPromo();
    }
  }, [profile]);

  /** Backfill cooldown keys from profile without overriding a fresh post-claim arm. */
  useEffect(() => {
    if (!SHOW_DASHBOARD_CHECKLIST) return;
    if (!profile?.onboarding_reward_claimed_at) return;
    syncDailyChecklistArmFromProfile(profile.onboarding_reward_claimed_at);
  }, [profile?.onboarding_reward_claimed_at]);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    void fetchOnboardingRewardState().then((state) => {
      if (cancelled) return;
      hydrateOnboardingProgressFromServer(state.progress);
      hydrateFreeTrialRdmAmounts({
        checklistRewardRdm: state.checklistRewardRdm,
      });
      setChecklistRewardRdm(state.checklistRewardRdm);
      setWelcomeRdm(state.freeTrialWelcomeRdm ?? DEFAULT_RDM_CONFIG.free_trial_welcome_rdm);
      startTransition(() => applyDashboardPopupPhase());
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.id, applyDashboardPopupPhase]);

  useEffect(() => {
    if (!profile?.id) return;
    if (pathname !== "/home") return;
    startTransition(() => applyDashboardPopupPhase());
  }, [profile?.id, profile?.time_travel_offset_ms, pathname, applyDashboardPopupPhase]);

  useEffect(() => {
    const onTimeTravel = (event: Event) => {
      const detail = (event as CustomEvent<{ clearStreakSuppress?: boolean }>).detail;
      if (profile?.id) {
        reconcileDailyStreakSuppressForTimeTravel(
          profile.id,
          Date.now() + (profile.time_travel_offset_ms ?? 0)
        );
        if (detail?.clearStreakSuppress) {
          /* preset already cleared in settings; re-run popup phase */
        }
      }
      startTransition(() => applyDashboardPopupPhase());
    };
    window.addEventListener(TIME_TRAVEL_OFFSET_CHANGED_EVENT, onTimeTravel);
    return () => window.removeEventListener(TIME_TRAVEL_OFFSET_CHANGED_EVENT, onTimeTravel);
  }, [applyDashboardPopupPhase, profile?.id, profile?.time_travel_offset_ms]);

  useEffect(() => {
    const onTrialActivated = () => {
      startTransition(() => applyDashboardPopupPhase());
    };
    window.addEventListener(FREE_TRIAL_ACTIVATED_EVENT, onTrialActivated);
    return () => window.removeEventListener(FREE_TRIAL_ACTIVATED_EVENT, onTrialActivated);
  }, [applyDashboardPopupPhase]);

  useEffect(() => {
    const onTrialRevoked = () => {
      void refreshProfile().then(() => {
        startTransition(() => applyDashboardPopupPhase());
      });
    };
    window.addEventListener(FREE_TRIAL_REVOKED_EVENT, onTrialRevoked);
    return () => window.removeEventListener(FREE_TRIAL_REVOKED_EVENT, onTrialRevoked);
  }, [applyDashboardPopupPhase, refreshProfile]);

  useEffect(() => {
    const onOnboardingProgress = () => {
      startTransition(() => applyDashboardPopupPhase());
    };
    window.addEventListener(ONBOARDING_PROGRESS_EVENT, onOnboardingProgress);
    return () => window.removeEventListener(ONBOARDING_PROGRESS_EVENT, onOnboardingProgress);
  }, [applyDashboardPopupPhase]);

  useEffect(() => {
    const onClaimed = () => {
      dailyChecklistAutoOpenedRef.current = false;
      startTransition(() => {
        setIsChecklistOpen(false);
        setIsOnboardingRewardOpen(false);
        applyDashboardPopupPhase();
      });
    };
    window.addEventListener(ONBOARDING_REWARD_CLAIMED_EVENT, onClaimed);
    return () => window.removeEventListener(ONBOARDING_REWARD_CLAIMED_EVENT, onClaimed);
  }, [applyDashboardPopupPhase]);

  useEffect(() => {
    const reopenPopupsOnHome = () => {
      if (pathname !== "/home") return;
      startTransition(() => applyDashboardPopupPhase());
    };
    window.addEventListener("focus", reopenPopupsOnHome);
    window.addEventListener("pageshow", reopenPopupsOnHome);
    return () => {
      window.removeEventListener("focus", reopenPopupsOnHome);
      window.removeEventListener("pageshow", reopenPopupsOnHome);
    };
  }, [pathname, applyDashboardPopupPhase]);

  const serverStreak = useMemo(
    () => parseDailyStreakServerState(profile?.free_trial_daily_streak),
    [profile?.free_trial_daily_streak]
  );

  const trialDayNumber = useMemo(() => {
    return getActiveStreakDayNumber({
      claimedAt: profile?.onboarding_reward_claimed_at,
      nowMs: dashboardClock,
      userId: profile?.id,
      serverStreak,
    });
  }, [profile?.onboarding_reward_claimed_at, profile?.id, dashboardClock, serverStreak]);

  const highestClaimedStreakDay = useMemo(() => {
    return getHighestClaimedStreakDay(profile?.id, serverStreak);
  }, [profile?.id, serverStreak]);

  const maxReachableStreakDay = useMemo(() => {
    return getMaxReachableStreakDay({
      claimedAt: profile?.onboarding_reward_claimed_at,
      nowMs: dashboardClock,
      userId: profile?.id,
      freeTrialActivatedAt: profile?.free_trial_activated_at,
      serverStreak,
    });
  }, [
    profile?.onboarding_reward_claimed_at,
    profile?.id,
    profile?.free_trial_activated_at,
    dashboardClock,
    serverStreak,
  ]);

  const streakLockedByTrialEnd = useMemo(() => {
    return isStreakDayLockedByTrialEnd({
      streakDay: trialDayNumber,
      claimedAt: profile?.onboarding_reward_claimed_at,
      nowMs: dashboardClock,
      userId: profile?.id,
      freeTrialActivatedAt: profile?.free_trial_activated_at,
      serverStreak,
    });
  }, [
    trialDayNumber,
    profile?.onboarding_reward_claimed_at,
    profile?.id,
    profile?.free_trial_activated_at,
    dashboardClock,
    serverStreak,
  ]);

  const waitingForDay2 = useMemo(() => {
    return isWaitingForDay2Unlock(profile?.onboarding_reward_claimed_at, dashboardClock);
  }, [profile?.onboarding_reward_claimed_at, dashboardClock]);

  const streakChecklistSuppressed = useMemo(() => {
    return isDailyStreakChecklistSuppressed(profile?.id, dashboardClock);
  }, [profile?.id, dashboardClock]);

  const displayStreakDay =
    streakChecklistSuppressed && highestClaimedStreakDay >= 2
      ? highestClaimedStreakDay
      : trialDayNumber;

  const streakSuppressRemainingMs = useMemo(() => {
    return getDailyStreakSuppressRemainingMs(profile?.id, dashboardClock);
  }, [profile?.id, dashboardClock]);

  const freeTrialEndedForClock = useMemo(() => {
    return isFreeTrialPeriodEnded(profile?.free_trial_activated_at, dashboardClock);
  }, [profile?.free_trial_activated_at, dashboardClock]);

  function formatSuppressCountdown(remainingMs: number): string {
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  const freeTrialDialogOpen = !trialActivated && freeTrialPromoOpen;
  const onboardingDialogOpen =
    trialActivated &&
    isOnboardingRewardOpen &&
    (!isOnboardingRewardComplete(profile) ||
      (isOnboardingRewardClaimed(profile) && !freeTrialEndedForClock));
  const higherPriorityPopupOpen = freeTrialDialogOpen || onboardingDialogOpen;

  const tryAutoOpenDailyChecklist = useCallback(() => {
    // Disabled auto-opening of Today's checklist as requested by the user.
    // The checklist can still be opened manually by clicking on the dashboard strip.
    return;
  }, []);

  /** Today's checklist: auto-opens on /home ≥30s after onboarding RDM claim, then on each /home visit. */
  useEffect(() => {
    if (!SHOW_DASHBOARD_CHECKLIST) return;
    if (pathname !== "/home") {
      dailyChecklistAutoOpenedRef.current = false;
      return;
    }
    if (!profile?.id) return;

    const attempt = () => tryAutoOpenDailyChecklist();
    attempt();

    const remaining = getDailyChecklistCooldownRemainingMs();
    if (remaining <= 0) return;
    const id = window.setTimeout(attempt, remaining + 50);
    return () => window.clearTimeout(id);
  }, [
    pathname,
    profile?.id,
    profile?.onboarding_reward_claimed_at,
    higherPriorityPopupOpen,
    dailyChecklistStatus,
    tryAutoOpenDailyChecklist,
  ]);

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
      progressLine = "0 of 5 habits yet — open the checklist when you're ready; no rush.";
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
      ? `PUC ${classLevel === 12 ? 2 : 1} · ${subjectCombo} · JEE + KCET track · ${dateStr}${
          isOnboardingRewardClaimed(profile)
            ? ` · Free trial Day ${trialDayNumber}${waitingForDay2 ? " (unlocks 9 AM)" : ""}`
            : ""
        }`
      : `PUC 2 · ${subjectCombo} · JEE + KCET track · ${dateStr}${
          isOnboardingRewardClaimed(profile)
            ? ` · Free trial Day ${trialDayNumber}${waitingForDay2 ? " (unlocks 9 AM)" : ""}`
            : ""
        }`;

  const studyStreakPending =
    profile?.id && (studyDaysStatus === "idle" || studyDaysStatus === "loading");
  const studyStreakReady = profile?.id && studyDaysStatus === "ready";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
      {/* Greeting strip */}
      <div className="rounded-2xl border border-border/60 bg-card/60 px-3 py-2.5 dark:bg-slate-950/50 sm:px-4 sm:py-3">
        <p className="text-xs leading-relaxed text-foreground sm:text-sm sm:leading-normal">
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
            <p className="mt-1 text-xl font-extrabold tabular-nums text-foreground sm:text-2xl">
              {c.value}
              {"valueSuffix" in c && c.valueSuffix ? (
                <span className="text-xs font-semibold text-muted-foreground tabular-nums sm:text-sm">
                  {c.valueSuffix}
                </span>
              ) : null}
            </p>
            {c.sub ? <p className={cn("mt-1 text-xs font-semibold", c.subClass)}>{c.sub}</p> : null}
          </div>
        ))}
      </section>

      {/* Study streak */}
      <section className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm dark:bg-slate-950/60">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <CalendarDays className="h-5 w-5 text-teal-500 shrink-0" />
            <h2 className="text-base font-bold text-foreground sm:text-lg">Study streak</h2>
            {inactivePenaltyRdm > 0 ? (
              <span className="inline-flex w-fit items-center rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 sm:px-2.5 sm:py-1 sm:text-[11px]">
                -{inactivePenaltyRdm.toLocaleString("en-IN")} RDM Inactive streak
              </span>
            ) : null}
          </div>
          <span className="inline-flex w-fit items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 sm:px-2.5 sm:py-1 sm:text-[11px] dark:text-amber-300">
            <Flame className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            {studyStreakBonusDays} days Active streak bonus: +{studyStreakBonusRdm.toLocaleString("en-IN")} RDM
          </span>
        </div>

        <p id="study-streak-map-help" className="sr-only">
          Each day shows time on site with this tab in focus; hover for on-site time and saved study
          time toward your streak.
        </p>
        <div
          className="mb-3 inline-flex w-full rounded-full border border-border bg-muted/30 p-0.5 dark:bg-slate-900/80 sm:w-fit"
          role="group"
          aria-label="Time on site map range"
          aria-describedby="study-streak-map-help"
        >
          <button
            type="button"
            onClick={() => setHeatmapMode("7")}
            className={cn(
              "flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors sm:flex-initial",
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
              "flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors sm:flex-initial",
              heatmapMode === "30"
                ? "border border-foreground/20 bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Last 30 days
          </button>
        </div>

        {heatmapMode === "30" ? (
          <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:mb-3 sm:text-[11px] sm:tracking-[0.18em]">
            {monthGrid.monthlyMapHeading}
          </p>
        ) : null}

        {heatmapMode === "7" ? (
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {last7Series.map((cell) => {
              const isToday =
                localDayKeyFromDate(cell.date) === localDayKeyFromDate(startOfLocalDay(now));
              const isReady = studyDaysStatus === "ready";
              return (
                <div
                  key={cell.key}
                  title={
                    isReady ? `${cell.tooltipTitle} · Daily RDM: coming soon` : "Loading activity…"
                  }
                  className={cn(
                    "flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 sm:min-h-[72px] sm:px-2 sm:py-2",
                    isReady ? greenCellClass(cell.level, isToday) : heatmapLoadingCellClass(isToday)
                  )}
                >
                  <span className="text-[9px] font-bold uppercase text-muted-foreground sm:text-[10px]">
                    {cell.date.toLocaleDateString(undefined, { weekday: "short" })}
                  </span>
                  <span className="text-xs font-extrabold tabular-nums sm:text-sm">
                    {isReady ? cell.label : "…"}
                  </span>
                  {isToday ? (
                    <span className="text-[9px] font-semibold text-teal-400 sm:text-[10px]">
                      Today
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-muted-foreground sm:gap-1.5 sm:text-[10px]">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-1.5">
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
                      "flex aspect-square flex-col items-center justify-center gap-0.5 p-0.5 text-[9px] font-bold sm:p-1 sm:text-[10px]",
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
          <span className="ml-0 max-sm:hidden sm:ml-2">
            Red = no focus or under 30 minutes that day; light → dark green = longer focus (same as
            your profile heatmap). Cell numbers show time on EduBlast with this tab in the
            foreground (pauses when you switch tabs). A dash means no on-site time that day;{" "}
            <span className="font-mono">{"<1m"}</span> means under one minute on site. Streak =
            consecutive calendar days with at least 30 minutes of on-site time, counted through your most recent
            active day on or before today.
          </span>
          <span className="sm:hidden">
            Red = under 30 min; green = longer focus. Tap cells for details.
          </span>
        </div>
      </section>

      {trialActivated &&
      !isOnboardingRewardClaimed(profile) &&
      isOnboardingRewardComplete(profile) ? (
        <section className="rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/10 via-violet-500/5 to-amber-500/10 p-4 shadow-sm">
          <button
            type="button"
            onClick={() => requestOnboardingClaimRewardPromo({ force: true })}
            className="flex w-full flex-col gap-1 text-left sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-bold text-foreground">
                Claim your {checklistRewardRdm} RDM reward
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                You completed every onboarding step — tap to add RDM to your wallet.
              </p>
            </div>
            <span className="mt-2 inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white sm:mt-0">
              Claim now
            </span>
          </button>
        </section>
      ) : trialActivated && !isOnboardingRewardComplete(profile) ? (
        <section className="rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-violet-500/5 to-emerald-500/10 p-4 shadow-sm">
          <button
            type="button"
            onClick={() => setIsOnboardingRewardOpen(true)}
            className="flex w-full flex-col gap-1 text-left sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-bold text-foreground">
                Do you want to start by earning a reward of {checklistRewardRdm} RDM?
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Open your onboarding checklist — tap Go on each step to explore the app.
              </p>
            </div>
            <span className="mt-2 inline-flex shrink-0 items-center justify-center rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white sm:mt-0">
              View checklist
            </span>
          </button>
        </section>
      ) : trialActivated && isOnboardingRewardClaimed(profile) && !freeTrialEndedForClock ? (
        <section
          className={cn(
            "rounded-2xl border p-4 shadow-sm animate-in fade-in duration-200",
            streakChecklistSuppressed
              ? "border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-violet-500/5 to-emerald-500/10"
              : "border-emerald-500/25 bg-gradient-to-r from-emerald-500/10 via-violet-500/5 to-amber-500/10"
          )}
        >
          <button
            type="button"
            onClick={() => {
              if (!streakChecklistSuppressed) setIsOnboardingRewardOpen(true);
            }}
            disabled={streakChecklistSuppressed}
            className={cn(
              "flex w-full flex-col gap-1 text-left sm:flex-row sm:items-center sm:justify-between",
              streakChecklistSuppressed && "cursor-default opacity-90"
            )}
          >
            <div>
              <p className="text-sm font-bold text-foreground">
                {streakChecklistSuppressed
                  ? waitingForDay2
                    ? "Day 1 complete — Day 2 unlocks at 9:00 AM"
                    : `Day ${displayStreakDay} streak done — next tasks after 9:00 AM`
                  : waitingForDay2
                    ? "Day 1 complete — Day 2 tasks unlock at 9:00 AM"
                    : streakLockedByTrialEnd
                      ? `Streak capped at Day ${maxReachableStreakDay} — trial time left`
                      : `Day-${trialDayNumber} Tasks checklist is active! 🔥`}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {streakChecklistSuppressed ? (
                  streakSuppressRemainingMs > 0 ? (
                    <>
                      Unlocks in{" "}
                      <span className="font-mono font-semibold text-amber-400">
                        {formatSuppressCountdown(streakSuppressRemainingMs)}
                      </span>{" "}
                      (simulated time). This is separate from Today&apos;s 5 habits below.
                    </>
                  ) : (
                    <>Opens at 9:00 AM simulated time. Separate from Today&apos;s 5 habits below.</>
                  )
                ) : (
                  <>
                    6 onboarding streak tasks (not the 5 daily habits). One day at a time — missed
                    calendar days don&apos;t skip ahead.
                  </>
                )}
              </p>
            </div>
            {!streakChecklistSuppressed && !streakLockedByTrialEnd ? (
              <span className="mt-2 inline-flex shrink-0 items-center justify-center rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white sm:mt-0">
                View Day {trialDayNumber} checklist
              </span>
            ) : null}
          </button>
        </section>
      ) : null}

      {SHOW_DASHBOARD_CHECKLIST ? (
        <>
          {/* Checklist trigger */}
          <section className="rounded-2xl border border-border bg-card/90 shadow-sm dark:bg-slate-950/60">
            <button
              type="button"
              onClick={() => setIsChecklistOpen(true)}
              className="flex w-full items-start gap-3 p-3.5 text-left sm:items-center sm:gap-4 sm:p-4"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500 sm:mt-0" />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold sm:text-base sm:text-lg">
                  Today&apos;s checklist
                </h2>
                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:line-clamp-none sm:text-sm">
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
                      <span className="sm:hidden"> &mdash; tap to view all items</span>
                    </>
                  ) : null}
                </p>
              </div>
              <span className="mt-1 hidden shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary sm:inline-flex">
                View
              </span>
            </button>
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
              <div className="shrink-0 border-b border-border/60 bg-gradient-to-b from-muted/50 to-transparent px-3.5 pb-3 pt-5 sm:px-6 sm:pb-5 sm:pt-7 dark:from-slate-900/90">
                <DialogHeader className="space-y-2.5 text-left sm:space-y-3">
                  <div className="flex items-start gap-2.5 pr-11 sm:gap-3 sm:pr-12">
                    <CheckCircle2
                      className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500"
                      aria-hidden
                    />
                    <DialogTitle className="text-left text-[15px] font-bold leading-snug tracking-tight sm:text-lg">
                      Today&apos;s checklist
                    </DialogTitle>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
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
                      Esc or the top-right close to exit.
                    </p>
                  </div>
                </DialogHeader>
              </div>

              {/* Scrollable list: avoids whole-modal scroll jank on short phones */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-2.5 sm:px-6 sm:py-4">
                <ul className="space-y-1.5 sm:space-y-2.5">
                  {checklistItems.map((item) => (
                    <li
                      key={item.id}
                      className={cn(
                        "flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-colors sm:gap-3 sm:px-3.5 sm:py-3",
                        item.done
                          ? "bg-emerald-500/5 dark:bg-emerald-500/[0.03]"
                          : "bg-background/60 dark:bg-slate-900/50"
                      )}
                    >
                      {item.done ? (
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                          aria-label="Done"
                        />
                      ) : (
                        <span
                          className="mt-0.5 inline-flex h-4 w-4 shrink-0 rounded border border-dashed border-muted-foreground/50"
                          aria-hidden
                        />
                      )}
                      <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-foreground sm:text-sm sm:leading-normal">
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
                            <Link
                              href="/refer-earn"
                              className="font-bold text-primary hover:underline"
                            >
                              Open Challenge Yourself
                            </Link>
                          </>
                        ) : null}
                        {item.id === "d" &&
                        dailyChecklist &&
                        !dailyChecklist.instacueSessionDone &&
                        dailyChecklist.instacueCombinedCount < 32 ? (
                          <span className="mt-1 block text-[11px] leading-snug text-muted-foreground sm:text-xs">
                            InstaCue reads logged: {dailyChecklist.instacueReadCount}/32
                            {dailyChecklist.instacueCombinedCount !==
                            dailyChecklist.instacueReadCount ? (
                              <>
                                {" "}
                                · {dailyChecklist.instacueCombinedCount}/32 toward unlock (includes
                                today&apos;s revision saves)
                              </>
                            ) : null}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="shrink-0 border-t border-border/60 bg-muted/25 px-3.5 py-2.5 sm:px-6 sm:py-3 dark:bg-slate-950/80">
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
                      <span className="hidden sm:inline">
                        (Items a–e are tracked live; Challenge Yourself completes after any Earn
                        &amp; Learn challenge run ends today).
                      </span>
                      <span className="sm:hidden">Tracked live &middot; a&ndash;e</span>
                    </>
                  ) : null}
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : null}

      {/* Subject accuracy + Leaderboard */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm dark:bg-slate-950/60">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-emerald-500" />
              <h2 className="text-base font-bold sm:text-lg">Subject accuracy</h2>
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
                  const toneIdx = effectiveChapterPageIdx * chapterAccuracyPageSize + i;
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
              {isChapterAccuracyPaginated ? (
                <div className="mt-3 flex flex-col gap-2.5 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    Showing {effectiveChapterPageIdx * chapterAccuracyPageSize + 1}–
                    {Math.min(
                      (effectiveChapterPageIdx + 1) * chapterAccuracyPageSize,
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
            <h2 className="text-base font-bold sm:text-lg">Leaderboard</h2>
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
            <h2 className="text-base font-bold sm:text-lg">CommunityFeed</h2>
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
                <h3 className="text-sm font-bold sm:text-base">Upcoming Testbee mocks</h3>
              </div>
              <Link
                href="/mock"
                className="text-xs font-bold text-muted-foreground hover:underline"
              >
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
                <h3 className="text-sm font-bold sm:text-base">EduFund progress</h3>
              </div>
              <Link href="/edufund" className="text-xs font-bold text-emerald-500 hover:underline">
                View grants →
              </Link>
            </div>

            {/* Multiplier scaling details card */}
            {(() => {
              const wallet = Math.max(0, Math.floor(Number(rdm) || 0));
              const planTier = (profile?.plan_tier ?? "free_trial") as "free" | "free_trial" | "starter" | "pro";
              const isSubscribed = planTier === "starter" || planTier === "pro";
              const activeMultiplier = calculateActiveMultiplier(
                planTier,
                profile?.subscription_started_at,
                profile?.created_at ?? new Date().toISOString(),
                subscriptionCfg
              );
              const effectiveWallet = Math.floor(wallet * activeMultiplier);

              return (
                <>
                  <div className="mb-4 rounded-xl border border-slate-700/60 bg-slate-900/40 p-2.5 text-xs text-slate-300 dark:border-slate-800/80">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Raw Earned RDM:</span>
                      <span className="font-semibold text-white">{wallet.toLocaleString("en-IN")} RDM</span>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-1">
                      <span className="text-slate-400">Active Multiplier:</span>
                      <span className={cn(
                        "font-bold px-2 py-0.5 rounded-full text-[12px] sm:text-xs border",
                        isSubscribed 
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                          : "bg-amber-500/10 text-amber-300 border-amber-500/20 animate-pulse"
                      )}>
                        {activeMultiplier.toFixed(2)}x
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-1.5 border-t border-slate-700/50 pt-1.5 dark:border-slate-800/50">
                      <span className="font-semibold text-emerald-400">Effective EduFund RDM:</span>
                      <span className="font-extrabold text-emerald-400 tabular-nums">{effectiveWallet.toLocaleString("en-IN")} RDM</span>
                    </div>
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

                  {!isSubscribed && (
                    <div className="mt-4 rounded-xl border border-violet-500/30 bg-violet-600/10 p-3 text-[11px] leading-relaxed text-violet-200">
                      <span className="font-bold text-violet-400 block mb-0.5">🚀 Upgrade to Premium Rate!</span>
                      Your raw effort has built <strong>{wallet.toLocaleString("en-IN")} RDM</strong>. Upgrading to premium unlocks a <strong>1.0x rate</strong>—boosting your grant progress from {effectiveWallet.toLocaleString("en-IN")} RDM to <strong>{wallet.toLocaleString("en-IN")} RDM</strong> instantly!
                    </div>
                  )}
                </>
              );
            })()}

            <p className="mt-2.5 text-[10px] text-slate-500">
              * RDM is subject to multiplier scaling based on active subscription tier.
            </p>
          </div>
        </div>
      </section>

      <FreeTrialPromoDialog
        open={freeTrialDialogOpen}
        onOpenChange={setFreeTrialPromoOpen}
        welcomeRdm={welcomeRdm}
        checklistRewardRdm={checklistRewardRdm}
      />
      <OnboardingRewardDialog
        open={onboardingDialogOpen}
        onOpenChange={setIsOnboardingRewardOpen}
        checklistRewardRdm={checklistRewardRdm}
      />
    </div>
  );
}
