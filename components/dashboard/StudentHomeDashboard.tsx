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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSitePresenceLiveMsToday } from "@/components/providers/SitePresenceProvider";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { FreeTrialPromoDialog } from "@/components/dashboard/FreeTrialPromoDialog";
import { OnboardingRewardDialog } from "@/components/dashboard/OnboardingRewardDialog";
import {
  FREE_TRIAL_ACTIVATED_EVENT,
  FREE_TRIAL_DEMO_RESET_EVENT,
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
  isWaitingForDay2Unlock,
  parseDailyStreakServerState,
} from "@/lib/onboarding/dailyChecklistTaskStorage";
import { TIME_TRAVEL_OFFSET_CHANGED_EVENT } from "@/lib/dev/timeTravel";
import { fetchOnboardingRewardState } from "@/lib/subscription/onboardingRewardApi";
import {
  shouldAutoOpenOnboardingRewardDialog,
  shouldShowTrialExpirationOverlay,
} from "@/lib/subscription/dashboardTrialPopups";
import {
  CalendarDays,
  CheckCircle2,
  Flame,
  LineChart,
  Star,
  Bookmark,
  MessageCircle,
  Coins,
  Heart,
  ChevronRight as ChevronRightIcon,
  AlertTriangle,
  Info,
  ExternalLink,
  Check,
  Clock,
} from "lucide-react";

// const CHAPTER_ACCURACY_PAGE_SIZE = 5;

/** Dashboard Today's checklist strip + modal (after onboarding RDM claim, from next page load). */
const SHOW_DASHBOARD_CHECKLIST = true;

/** Flip to true to auto-open the +100 RDM onboarding popup after trial activation. */
const SHOW_ONBOARDING_REWARD_AUTO_POPUP = true;

type HeatmapMode = "7" | "30";

const MOCK_LEADERBOARD = [
  { rank: 1, name: "Karthik Reddy", city: "Bengaluru", pts: 985 },
  { rank: 2, name: "Ananya Iyer", city: "Mysuru", pts: 942 },
  { rank: 3, name: "Siddharth Rao", city: "Mangaluru", pts: 876 },
  { rank: 4, name: "Meghana Gowda", city: "Hubli", pts: 812 },
  { rank: 5, name: "Praveen Kumar", city: "Davangere", pts: 790 },
] as const;

const FEED_FILTERS = [
  { id: "all", label: "All" },
  { id: "physics", label: "Physics" },
  { id: "chemistry", label: "Chemistry" },
  { id: "math", label: "Math" },
] as const;

type FeedFilterId = (typeof FEED_FILTERS)[number]["id"];

const MOCK_FEED_POSTS = [
  {
    initials: "YD",
    tone: "blue" as const,
    name: "Yash Diwan",
    time: "13d ago",
    tags: ["#challenge", "#refer-earn", "#funbrain"],
    text: "Still working toward MentaMill Blitz — this round did not pass. 0/10 (0%) in 00:13. Pass bar: 6/10.",
    subject: "Physics" as const,
  },
  {
    initials: "MI",
    tone: "purple" as const,
    name: "mail id",
    time: "14d ago",
    tags: ["#challenge", "#refer-earn", "#Physics"],
    text: "Still working toward MentaMill Blitz — this round did not pass. 0/10 (0%) in 00:08. Pass bar: 6/10.",
    subject: "Physics" as const,
  },
  {
    initials: "MI",
    tone: "purple" as const,
    name: "mail id",
    time: "14d ago",
    tags: ["#challenge", "#Math"],
    text: "Mathematics challenge — Sets and Relations. Attempted 5 questions, scored 3/5.",
    subject: "Math" as const,
  },
  {
    initials: "NK",
    tone: "emerald" as const,
    name: "Nidhi K",
    time: "2h ago",
    tags: ["#gyan++", "#Physics", "#Electrostatics"],
    text: "Why does a capacitor block DC current but allow AC current to pass? Prof-Pi answered in 1.8s.",
    subject: "Physics" as const,
  },
  {
    initials: "AR",
    tone: "amber" as const,
    name: "Arjun R",
    time: "5h ago",
    tags: ["#mock", "#Math", "#achievement"],
    text: "Mock #4 done — 87%! Mechanics finally clicking. Testbee kept pushing Integration by parts.",
    subject: "Math" as const,
  },
];

/**
 * Target exam date for the "Days to JEE Main" countdown in the icon-panel
 * flyout. Update this annually to repoint the countdown to the next JEE
 * Main session. The flyout recomputes the day count from `Date.now()` so
 * the value always reflects "now → this date".
 */
const JEE_MAIN_TARGET_DATE_ISO = "2027-01-22";

type IconFlyoutId =
  | "rdm"
  | "edufund"
  | "examPlan"
  | "accuracy"
  | null;

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
  const { toast } = useToast();
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
  /** Prevent duplicate penalty notices during repeated refresh events. */
  const seenPenaltyNoticeKeyRef = useRef<string | null>(null);
  const {
    taxonomy: fullTaxonomy,
    loading: taxonomyLoading,
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

  /** Minute clock for heatmap / greeting / trial-day gates (avoids re-rendering the whole dashboard every second). */
  const [minuteClock, setMinuteClock] = useState(
    () => Date.now() + (profile?.time_travel_offset_ms ?? 0)
  );
  /** Second clock only while a live countdown is visible (streak suppress banner). */
  const [fastClock, setFastClock] = useState(
    () => Date.now() + (profile?.time_travel_offset_ms ?? 0)
  );

  useEffect(() => {
    const offset = profile?.time_travel_offset_ms ?? 0;
    const tick = () => setMinuteClock(Date.now() + offset);
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [profile?.time_travel_offset_ms]);

  const needsFastClock = useMemo(() => {
    if (!profile?.id) return false;
    if (!isDailyStreakChecklistSuppressed(profile.id, minuteClock)) return false;
    return getDailyStreakSuppressRemainingMs(profile.id, minuteClock) > 0;
  }, [profile?.id, minuteClock]);

  useEffect(() => {
    if (!needsFastClock) return;
    const offset = profile?.time_travel_offset_ms ?? 0;
    const tick = () => setFastClock(Date.now() + offset);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [profile?.time_travel_offset_ms, needsFastClock]);

  const dashboardClock = needsFastClock ? fastClock : minuteClock;
  const now = useMemo(() => new Date(dashboardClock), [dashboardClock]);
  const dailyChecklistDayIso = useMemo(
    () => getLocalCalendarDateIso(dashboardClock),
    [dashboardClock]
  );
  const monthDays = useMemo(
    () => new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    [now]
  );

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
    const planKey = normalizePlanTier(profile?.plan_tier, profile?.free_trial_activated, profile);
    const activeMultiplier = calculateActiveMultiplier(
      planKey,
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
  }, [rdm, profile, subscriptionCfg]);

  const edufundTiers = useMemo(() => {
    const wallet = Math.max(0, Math.floor(Number(rdm) || 0));
    const planKey = normalizePlanTier(profile?.plan_tier, profile?.free_trial_activated, profile);
    const activeMultiplier = calculateActiveMultiplier(
      planKey,
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
  }, [rdm, profile, subscriptionCfg]);

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
  }, [profile?.id, toast]);

  const streakDays = streakSummary?.streak ?? 0;

  const inactivePenaltyRdm = useMemo(() => {
    const plan = normalizePlanTier(profile?.plan_tier, profile?.free_trial_activated, profile);
    return inactivePenaltyRdmForPlan(plan, subscriptionCfg);
  }, [profile, subscriptionCfg]);

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
      const penaltiesApplied = json.reconcile?.penaltiesApplied ?? 0;
      const totalDeducted = json.reconcile?.totalDeducted ?? 0;
      if (penaltiesApplied > 0 && totalDeducted > 0) {
        const noticeKey = `${toStr}:${penaltiesApplied}:${totalDeducted}`;
        if (seenPenaltyNoticeKeyRef.current !== noticeKey) {
          seenPenaltyNoticeKeyRef.current = noticeKey;
          const dayWord = penaltiesApplied === 1 ? "day" : "days";
          toast({
            title: `RDM updated: -${totalDeducted} for ${penaltiesApplied} inactive ${dayWord}`,
            description:
              "Your account had under 30 minutes of on-site learning time for completed day(s). Keep at least 30 focused minutes today across any study activity to avoid tomorrow's deduction.",
          });
        }
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
  }, [profile?.id, toast]);

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

  // Page index is not currently exposed in the UI (the v3 chapter accuracy
  // panel shows the top 5 chapters in a single flyout), but the count
  // helpers below still need the variable name.
  const chapterAccuracyPageIdx = 0;

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
  const [openIconFlyout, setOpenIconFlyout] = useState<IconFlyoutId>(null);
  const [activeFeedFilter, setActiveFeedFilter] = useState<FeedFilterId>("all");
  const [feedLikes, setFeedLikes] = useState<Record<number, boolean>>({});
  const [checklistTaps, setChecklistTaps] = useState<Record<string, boolean>>({});
  // Admin-only manual override; non-admins never inflate the progress bar
  // with their taps (the bar tracks server-side `item.done` only).
  const checklistTapCount = useMemo(
    () => (isAppAdmin ? Object.values(checklistTaps).filter(Boolean).length : 0),
    [checklistTaps, isAppAdmin]
  );
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
    if (!openIconFlyout) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest?.("[data-icon-flyout]")) return;
      setOpenIconFlyout(null);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [openIconFlyout]);

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
    const popupNow = Date.now() + (profile?.time_travel_offset_ms ?? 0);
    setTrialActivated(activated);
    setFreeTrialPromoOpen(phase === "free_trial");
    setIsOnboardingRewardOpen(
      SHOW_ONBOARDING_REWARD_AUTO_POPUP &&
        shouldAutoOpenOnboardingRewardDialog(profile, popupNow, profile?.id)
    );
    if (phase === "claim_reward" && SHOW_ONBOARDING_REWARD_AUTO_POPUP) {
      requestOnboardingClaimRewardPromo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- granular fields avoid re-running on unrelated profile columns (e.g. RDM ticks)
  }, [
    profile?.id,
    profile?.plan_tier,
    profile?.free_trial_activated,
    profile?.free_trial_activated_at,
    profile?.time_travel_offset_ms,
    profile?.trial_end_bonus_activated,
    profile?.trial_second_round_activated,
    profile?.onboarding_reward_claimed_at,
    profile?.onboarding_reward_progress,
  ]);

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
    window.addEventListener(FREE_TRIAL_DEMO_RESET_EVENT, onTrialActivated);
    return () => {
      window.removeEventListener(FREE_TRIAL_ACTIVATED_EVENT, onTrialActivated);
      window.removeEventListener(FREE_TRIAL_DEMO_RESET_EVENT, onTrialActivated);
    };
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

  const waitingForDay2 = useMemo(() => {
    return isWaitingForDay2Unlock(profile?.onboarding_reward_claimed_at, dashboardClock);
  }, [profile?.onboarding_reward_claimed_at, dashboardClock]);

  const freeTrialEndedForClock = useMemo(() => {
    return shouldShowTrialExpirationOverlay(profile, dashboardClock);
  }, [profile, dashboardClock]);

  useEffect(() => {
    if (!freeTrialEndedForClock || profile?.trial_end_bonus_activated) return;
    startTransition(() => {
      setIsOnboardingRewardOpen(false);
      setFreeTrialPromoOpen(false);
    });
  }, [freeTrialEndedForClock, profile?.trial_end_bonus_activated]);

  const trialExpirationOpen = useMemo(
    () => shouldShowTrialExpirationOverlay(profile, dashboardClock),
    [profile, dashboardClock]
  );

  const freeTrialDialogOpen = !trialActivated && freeTrialPromoOpen;
  const onboardingDialogOpen =
    trialActivated &&
    isOnboardingRewardOpen &&
    shouldAutoOpenOnboardingRewardDialog(profile, dashboardClock, profile?.id) &&
    !trialExpirationOpen;

  const higherPriorityPopupOpen =
    freeTrialDialogOpen || onboardingDialogOpen || trialExpirationOpen;

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

  /** Target exam label for the exam-plan flyout. Always shows the combined
   *  "JEE Main + KCET" message so every student sees the same headline. */
  const targetExamDisplay = "JEE Main + KCET";

  /** Days remaining until the JEE Main target date. Computed live from the
   *  user's clock (recomputes every minute via `dashboardClock`). If the
   *  target date is missing/invalid or already in the past, falls back to
   *  the literal "280 Days" so the flyout still has a number. */
  const daysToJeeMain = (() => {
    const target = new Date(`${JEE_MAIN_TARGET_DATE_ISO}T00:00:00+05:30`);
    if (Number.isNaN(target.getTime())) return null;
    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) return 0;
    return Math.round(diffMs / (24 * 60 * 60 * 1000));
  })();

  /** Effective multiplier for the EduFund flyout. */
  const edufundWallet = Math.max(0, Math.floor(Number(rdm) || 0));
  const edufundPlanKey = normalizePlanTier(
    profile?.plan_tier,
    profile?.free_trial_activated,
    profile
  );
  const edufundActiveMultiplier = calculateActiveMultiplier(
    edufundPlanKey,
    profile?.subscription_started_at,
    profile?.created_at ?? new Date().toISOString(),
    subscriptionCfg
  );
  const edufundEffective = Math.floor(edufundWallet * edufundActiveMultiplier);

  /** Subject accuracy flyout data (top 3 chapters). */
  const accuracyFlyoutRows =
    chapterRowsVisible.length > 0 ? chapterRowsVisible : chapterRows.slice(0, 3);
  const accuracyChaptersTracked = chapterRows.length;

  /** Feed post list (mock or filtered by subject for the v3 preview surface). */
  const visibleFeedPosts = useMemo(() => {
    if (activeFeedFilter === "all") return MOCK_FEED_POSTS;
    const target =
      activeFeedFilter === "math"
        ? "Math"
        : activeFeedFilter === "physics"
          ? "Physics"
          : "Chemistry";
    return MOCK_FEED_POSTS.filter((p) => p.subject === target);
  }, [activeFeedFilter]);

  return (
    <div
      data-testid="v3-home-dashboard"
      className="mx-auto w-full max-w-[1500px] space-y-4 pb-8 text-[13px] leading-[1.55]"
    >
      {/* ── GREETING + 4 ICON PANEL BUTTONS (v3 layout) ── */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">
            {greeting}, {displayName} · {dateStr}
          </p>
          <h1 className="mt-1 font-serif text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            My dashboard
          </h1>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">
            {classLine}
          </p>
          {streakDays === 0 && profile?.id ? (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-300">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              Streak 0 days — don&apos;t break it
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
          {/* 1. RDM earned flyout */}
          <div className="relative" data-icon-flyout>
            <button
              type="button"
              onClick={() =>
                setOpenIconFlyout((cur) => (cur === "rdm" ? null : "rdm"))
              }
              className={cn(
                "flex min-w-[56px] flex-col items-center gap-0.5 rounded-xl border bg-card/80 px-2.5 py-2 text-foreground transition-colors hover:border-amber-500/60 hover:bg-amber-500/5",
                openIconFlyout === "rdm" ? "border-amber-500/60" : "border-border/70"
              )}
              aria-expanded={openIconFlyout === "rdm"}
              aria-label="RDM earned summary"
            >
              <Coins className="h-4 w-4 text-amber-500" aria-hidden />
              <span className="text-[12px] font-bold tabular-nums text-amber-500">
                {!profile?.id
                  ? "—"
                  : rdmWeeklyLoadState === "loading"
                    ? "…"
                    : rdmWeeklyLoadState === "error"
                      ? "—"
                      : `+${(rdmEarnedThisWeek ?? 0).toLocaleString("en-IN")}`}
              </span>
              <span className="text-[9px] font-medium text-muted-foreground">RDM earned</span>
            </button>
            {openIconFlyout === "rdm" ? (
              <div
                role="dialog"
                aria-label="RDM summary"
                className="absolute right-0 top-full z-50 mt-1.5 w-[280px] rounded-xl border border-border/70 bg-card p-3.5 text-[12px] shadow-xl"
              >
                <p className="mb-2 flex items-center gap-1.5 font-semibold text-foreground">
                  <Coins className="h-3.5 w-3.5 text-amber-500" aria-hidden /> RDM summary
                </p>
                <div className="flex justify-between border-b border-border/60 py-1.5 text-muted-foreground">
                  <span>Earned this week</span>
                  <span className="font-semibold text-amber-500">
                    {!profile?.id
                      ? "—"
                      : rdmWeeklyLoadState === "error"
                        ? "—"
                        : `+${(rdmEarnedThisWeek ?? 0).toLocaleString("en-IN")} RDM`}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/60 py-1.5 text-muted-foreground">
                  <span>Total balance</span>
                  <span className="font-semibold text-emerald-500">
                    {rdm.toLocaleString("en-IN")} RDM
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/60 py-1.5 text-muted-foreground">
                  <span>Active multiplier</span>
                  <span className="font-semibold text-foreground">
                    {edufundActiveMultiplier.toFixed(2)}×
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/60 py-1.5 text-muted-foreground">
                  <span>Effective EduFund RDM</span>
                  <span className="font-semibold text-emerald-500">
                    {edufundEffective.toLocaleString("en-IN")} RDM
                  </span>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Subscribe to Starter to unlock the 0.5× multiplier and earn faster.
                </p>
              </div>
            ) : null}
          </div>

          {/* 2. EduFund flyout */}
          <div className="relative" data-icon-flyout>
            <button
              type="button"
              onClick={() =>
                setOpenIconFlyout((cur) => (cur === "edufund" ? null : "edufund"))
              }
              className={cn(
                "flex min-w-[56px] flex-col items-center gap-0.5 rounded-xl border bg-card/80 px-2.5 py-2 text-foreground transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/5",
                openIconFlyout === "edufund" ? "border-emerald-500/60" : "border-border/70"
              )}
              aria-expanded={openIconFlyout === "edufund"}
              aria-label="EduFund progress"
            >
              <Heart className="h-4 w-4 text-emerald-500" aria-hidden />
              <span className="text-[12px] font-bold tabular-nums text-emerald-500">
                {edufundProgressData.displayPrimary}
              </span>
              <span className="text-[9px] font-medium text-muted-foreground">EduFund</span>
            </button>
            {openIconFlyout === "edufund" ? (
              <div
                role="dialog"
                aria-label="EduFund progress"
                className="absolute right-0 top-full z-50 mt-1.5 w-[320px] rounded-xl border border-border/70 bg-card p-3.5 text-[12px] shadow-xl"
              >
                <p className="mb-2.5 flex items-center gap-1.5 font-semibold text-foreground">
                  <Heart className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> EduFund progress
                </p>
                <div className="mb-2.5 space-y-2.5">
                  {edufundTiers.slice(0, 3).map((tier, i) => {
                    const opacities = ["", "opacity-60", "opacity-40"];
                    return (
                      <div key={tier.name} className={opacities[i]}>
                        <div className="mb-0.5 flex items-baseline justify-between">
                          <span className="font-semibold text-foreground">{tier.name}</span>
                          <span
                            className={cn(
                              "text-[11px] font-semibold",
                              i === 0
                                ? "text-emerald-500"
                                : i === 1
                                  ? "text-blue-500"
                                  : "text-violet-500"
                            )}
                          >
                            {tier.amount}
                          </span>
                        </div>
                        <p className="mb-1 text-[10px] text-muted-foreground">{tier.detail}</p>
                        <div className="h-1 overflow-hidden rounded-full bg-border/70">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              i === 0
                                ? "bg-emerald-500"
                                : i === 1
                                  ? "bg-blue-500"
                                  : "bg-violet-500"
                            )}
                            style={{ width: `${Math.round(tier.progress * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {edufundPlanKey !== "starter" && edufundPlanKey !== "pro" ? (
                  <div className="flex items-start gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 p-2 text-[10px] text-violet-200">
                    <Info className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" aria-hidden />
                    Upgrade to Premium — unlocks 1.0× multiplier, boosting effective RDM from{" "}
                    {edufundEffective.toLocaleString("en-IN")} →{" "}
                    {edufundWallet.toLocaleString("en-IN")}.
                  </div>
                ) : null}
                <Link
                  href="/edufund"
                  className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 hover:underline"
                >
                  View grants <ChevronRightIcon className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            ) : null}
          </div>

          {/* 3. Exam plan / AI Preparation calendar flyout (replaces the old "Streak" panel) */}
          <div className="relative" data-icon-flyout>
            <button
              type="button"
              onClick={() =>
                setOpenIconFlyout((cur) => (cur === "examPlan" ? null : "examPlan"))
              }
              className={cn(
                "flex min-w-[60px] flex-col items-center gap-0.5 rounded-xl border bg-card/80 px-2.5 py-2 text-foreground transition-colors hover:border-violet-500/60 hover:bg-violet-500/5",
                openIconFlyout === "examPlan" ? "border-violet-500/60" : "border-border/70"
              )}
              aria-expanded={openIconFlyout === "examPlan"}
              aria-label="AI Preparation calendar"
            >
              <CalendarDays className="h-4 w-4 text-violet-500" aria-hidden />
              <span className="text-[11px] font-bold tabular-nums text-violet-500">
                JEE+KCET
              </span>
              <span className="text-[9px] font-medium text-muted-foreground">Exam plan</span>
            </button>
            {openIconFlyout === "examPlan" ? (
              <div
                role="dialog"
                aria-label="AI Preparation calendar"
                className="absolute right-0 top-full z-50 mt-1.5 w-[300px] rounded-xl border border-border/70 bg-card p-3.5 text-[12px] shadow-xl"
              >
                <p className="mb-2 flex items-center gap-1.5 font-semibold text-foreground">
                  <CalendarDays className="h-3.5 w-3.5 text-violet-500" aria-hidden /> AI
                  Preparation calendar
                </p>
                <div className="flex justify-between border-b border-border/60 py-1.5 text-muted-foreground">
                  <span>Target exam</span>
                  <span className="font-semibold text-foreground">{targetExamDisplay}</span>
                </div>
                <div className="flex justify-between border-b border-border/60 py-1.5 text-muted-foreground">
                  <span>Current class</span>
                  <span className="font-semibold text-foreground">
                    {classLevel != null ? `PUC ${classLevel === 12 ? 2 : 1}` : "PUC 1"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/60 py-1.5 text-muted-foreground">
                  <span>Days to JEE Main</span>
                  <span className="font-semibold tabular-nums text-amber-500">
                    {daysToJeeMain != null ? `${daysToJeeMain} Days` : "280 Days"}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                  Open AI Calendar in Prep + Mock to see your personalised study plan.
                </p>
              </div>
            ) : null}
          </div>

          {/* 4. Subject accuracy flyout */}
          <div className="relative" data-icon-flyout>
            <button
              type="button"
              onClick={() =>
                setOpenIconFlyout((cur) => (cur === "accuracy" ? null : "accuracy"))
              }
              className={cn(
                "flex min-w-[60px] flex-col items-center gap-0.5 rounded-xl border bg-card/80 px-2.5 py-2 text-foreground transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/5",
                openIconFlyout === "accuracy" ? "border-emerald-500/60" : "border-border/70"
              )}
              aria-expanded={openIconFlyout === "accuracy"}
              aria-label="Subject accuracy"
            >
              <LineChart className="h-4 w-4 text-emerald-500" aria-hidden />
              <span className="text-[11px] font-bold tabular-nums text-emerald-500">
                {accuracyChaptersTracked > 0
                  ? `${accuracyChaptersTracked} chapter${accuracyChaptersTracked === 1 ? "" : "s"}`
                  : "0 chapters"}
              </span>
              <span className="text-[9px] font-medium text-muted-foreground">Accuracy</span>
            </button>
            {openIconFlyout === "accuracy" ? (
              <div
                role="dialog"
                aria-label="Subject accuracy"
                className="absolute right-0 top-full z-50 mt-1.5 w-[340px] rounded-xl border border-border/70 bg-card p-3.5 text-[12px] shadow-xl"
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 font-semibold text-foreground">
                    <LineChart className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> Subject
                    accuracy
                  </p>
                  <Link
                    href="/performance"
                    className="text-[10px] font-bold text-emerald-500 hover:underline"
                  >
                    Full report →
                  </Link>
                </div>
                <p className="mb-2 text-[10px] leading-snug text-muted-foreground">
                  {chapterAccuracyClassLabel} · Tracked when you tap{" "}
                  <span className="font-semibold text-foreground/90">Marked completed</span> in
                  Lessons/Progress. % = marked subtopics ÷ total in chapter.
                </p>
                {accuracyFlyoutRows.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border/70 p-3 text-center text-[11px] text-muted-foreground">
                    Mark a subtopic complete in Lessons/Progress to populate this list.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {accuracyFlyoutRows.map((row) => (
                      <li
                        key={row.label}
                        className="border-b border-border/60 pb-2 last:border-none"
                      >
                        <div className="mb-0.5 flex items-start justify-between gap-2">
                          <span className="text-[11px] font-semibold leading-tight text-foreground">
                            {row.label}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 text-[12px] font-bold tabular-nums",
                              row.completionPct >= 80
                                ? "text-emerald-500"
                                : row.completionPct >= 40
                                  ? "text-blue-500"
                                  : "text-amber-500"
                            )}
                          >
                            {row.completionPct}%
                          </span>
                        </div>
                        <p className="mb-1 text-[10px] text-muted-foreground">
                          {row.completed}/{row.total} subtopics · {row.topicCountInChapter} topic
                          {row.topicCountInChapter === 1 ? "" : "s"}
                        </p>
                        <div className="h-1 overflow-hidden rounded-full bg-border/70">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              row.completionPct >= 80
                                ? "bg-emerald-500"
                                : row.completionPct >= 40
                                  ? "bg-blue-500"
                                  : "bg-amber-500"
                            )}
                            style={{ width: `${row.completionPct}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {lowestChapter && lowestChapter.completionPct < 100 ? (
                  <div className="mt-2 flex items-start gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/5 p-2 text-[10px] leading-snug text-rose-300">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-rose-400" aria-hidden />
                    Needs attention: {lowestChapter.label} at {lowestChapter.completionPct}% —
                    schedule revision or a targeted mock.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ── TRIAL / ONBOARDING BANNER (slim, contextual) ── */}
      {trialActivated &&
      !freeTrialEndedForClock &&
      !profile?.trial_end_bonus_activated &&
      !isOnboardingRewardClaimed(profile) &&
      isOnboardingRewardComplete(profile) ? (
        <button
          type="button"
          onClick={() => requestOnboardingClaimRewardPromo({ force: true })}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-violet-500/5 to-amber-500/10 px-3.5 py-2.5 text-left text-[12px] shadow-sm transition-colors hover:from-emerald-500/15"
        >
          <span className="font-bold text-foreground">
            Claim your {checklistRewardRdm} RDM reward
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white">
            Claim now
          </span>
        </button>
      ) : null}

      {/* ── DASHBOARD MAIN GRID ── */}
      <section className="grid gap-3 lg:grid-cols-[1fr_320px] items-start">
        {/* Left column: Daily activity tracker + Community feed */}
        <div className="flex flex-col gap-3">
          {/* Daily activity tracker card */}
          <div className="rounded-xl border border-border/70 bg-card/80 p-3.5 shadow-sm sm:p-4">
            <div className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <CalendarDays className="h-4 w-4 shrink-0 text-teal-500" />
                <h2 className="text-[13px] font-bold text-foreground sm:text-sm">
                  Daily activity tracker
                </h2>
                {inactivePenaltyRdm > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-500 dark:text-rose-300">
                    <Clock className="h-3 w-3" aria-hidden />–
                    {inactivePenaltyRdm.toLocaleString("en-IN")} RDM inactive streak
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">
                  <Star className="h-3 w-3" aria-hidden />
                  {studyStreakBonusDays}d bonus: +
                  {studyStreakBonusRdm.toLocaleString("en-IN")} RDM
                </span>
              </div>
              <Link
                href="/performance"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-500 hover:underline"
              >
                Full report <ChevronRightIcon className="h-3 w-3" aria-hidden />
              </Link>
            </div>

            <div
              className="mb-2.5 inline-flex w-full rounded-full border border-border/60 bg-muted/30 p-0.5 sm:w-fit"
              role="group"
              aria-label="Time on site map range"
            >
              {(["7", "30"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setHeatmapMode(m)}
                  className={cn(
                    "flex-1 rounded-full px-3 py-1 text-[11px] font-bold transition-colors sm:flex-initial",
                    heatmapMode === m
                      ? "border border-foreground/15 bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Last {m} days
                </button>
              ))}
            </div>

            {heatmapMode === "30" ? (
              <p className="mb-1.5 text-center text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {monthGrid.monthlyMapHeading}
              </p>
            ) : null}

            {heatmapMode === "7" ? (
              <div className="grid grid-cols-7 gap-1.5">
                {last7Series.map((cell) => {
                  const isToday =
                    localDayKeyFromDate(cell.date) === localDayKeyFromDate(startOfLocalDay(now));
                  const isReady = studyDaysStatus === "ready";
                  return (
                    <div
                      key={cell.key}
                      title={isReady ? cell.tooltipTitle : "Loading activity…"}
                      className={cn(
                        "flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 sm:min-h-[64px]",
                        isReady
                          ? greenCellClass(cell.level, isToday)
                          : heatmapLoadingCellClass(isToday)
                      )}
                    >
                      <span className="text-[9px] font-bold uppercase text-muted-foreground">
                        {cell.date.toLocaleDateString(undefined, { weekday: "short" })}
                      </span>
                      <span className="text-[11px] font-extrabold tabular-nums">
                        {isReady ? cell.label : "…"}
                      </span>
                      {isToday ? (
                        <span className="text-[9px] font-semibold text-teal-400">Today</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-muted-foreground">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {monthGrid.cells.map((cell, idx) => {
                    if (cell.day == null) {
                      return (
                        <div
                          key={`pad-${idx}`}
                          className="aspect-square rounded-lg bg-transparent"
                        />
                      );
                    }
                    const d = new Date(now.getFullYear(), now.getMonth(), cell.day);
                    const isToday =
                      startOfLocalDay(d).getTime() === monthGrid.todayStart.getTime();
                    return (
                      <div
                        key={cell.key}
                        title={
                          studyDaysStatus === "ready" && cell.tooltipTitle
                            ? cell.tooltipTitle
                            : undefined
                        }
                        className={cn(
                          "flex aspect-square flex-col items-center justify-center gap-0.5 p-0.5 text-[9px] font-bold",
                          studyDaysStatus === "ready"
                            ? greenCellClass(cell.level, isToday)
                            : heatmapLoadingCellClass(isToday)
                        )}
                      >
                        <span>{cell.day}</span>
                        <span className="text-[9px] opacity-90">
                          {studyDaysStatus === "ready" ? cell.label : "…"}
                        </span>
                        {isToday ? <span className="text-[8px] text-teal-300">T</span> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-2.5 flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[10px] text-amber-700 dark:text-amber-200">
              <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              5-day → +50 RDM · 7-day → +100 · 30-day → +200 · 90-day → +500. Missing a day deducts{" "}
              {inactivePenaltyRdm.toLocaleString("en-IN")} RDM.
            </div>
          </div>

          {/* Community feed card */}
          <div className="rounded-xl border border-border/70 bg-card/80 p-3.5 shadow-sm">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[13px] font-bold text-foreground sm:text-sm">
                <Heart className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> Community feed
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">Latest from your network</span>
                <Link
                  href="/magic-wall"
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 hover:underline"
                >
                  Open feed <ExternalLink className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            </div>
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {FEED_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFeedFilter(f.id)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition-colors",
                    activeFeedFilter === f.id
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-border/70 bg-muted/40 text-muted-foreground hover:border-emerald-500/50 hover:text-emerald-500"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <ul className="space-y-0">
              {visibleFeedPosts.length === 0 ? (
                <li className="py-4 text-center text-[11px] text-muted-foreground">
                  No posts in this filter yet.
                </li>
              ) : (
                visibleFeedPosts.map((p, i) => {
                  const liked = !!feedLikes[i];
                  return (
                    <li
                      key={`${p.name}-${i}`}
                      className="border-b border-border/60 py-2.5 last:border-none"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white",
                            p.tone === "blue" ? "bg-blue-500" : "bg-violet-500"
                          )}
                        >
                          {p.initials}
                        </span>
                        <span className="text-[11px] font-semibold text-foreground">{p.name}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground">{p.time}</span>
                      </div>
                      <div className="mb-1 flex flex-wrap gap-1">
                        {p.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-muted/60 px-1.5 py-px text-[9px] text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      <p className="mb-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        {p.text}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setFeedLikes((s) => ({ ...s, [i]: !s[i] }))
                          }
                          aria-pressed={liked}
                          className={cn(
                            "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                            liked
                              ? "bg-pink-500/15 text-pink-600 dark:text-pink-300"
                              : "text-muted-foreground hover:bg-pink-500/10 hover:text-pink-600"
                          )}
                        >
                          <Heart
                            className={cn("h-3 w-3", liked && "fill-current")}
                            aria-hidden
                          />
                          {liked ? "Related" : "Relate"}
                        </button>
                        <button
                          type="button"
                          className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-blue-500/10 hover:text-blue-500"
                        >
                          <Bookmark className="h-3 w-3" aria-hidden /> Save for revision
                        </button>
                        <button
                          type="button"
                          className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-violet-500/10 hover:text-violet-500"
                        >
                          <MessageCircle className="h-3 w-3" aria-hidden /> Thread
                        </button>
                        <span className="ml-auto rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-blue-500 dark:text-blue-300">
                          {p.subject}
                        </span>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
            <Link
              href="/magic-wall"
              className="mt-2 block text-center text-[11px] font-bold text-emerald-500 hover:underline"
            >
              View all community posts →
            </Link>
          </div>
        </div>

        {/* Right column: Today's checklist + Leaderboard + Upcoming mocks */}
        <div className="flex flex-col gap-3">
          {/* Today's checklist card */}
          <div className="rounded-xl border border-border/70 bg-card/80 p-3.5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[13px] font-bold text-foreground sm:text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden /> Today&apos;s checklist
              </h2>
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500 dark:text-emerald-300">
                +{checklistRewardRdm} RDM
              </span>
            </div>
            <p className="mb-1 text-[10px] text-muted-foreground">
              {dailyChecklistStatus === "error"
                ? "Could not load checklist — refresh."
                : `${checklistDoneCount} of ${checklistItems.length} done`}
            </p>
            <div className="mb-2.5 h-1 overflow-hidden rounded-full bg-border/60">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{
                  width: `${Math.round((Math.max(checklistDoneCount, checklistTapCount) / checklistItems.length) * 100)}%`,
                }}
              />
            </div>
            <ul className="space-y-1">
              {checklistItems.map((item) => {
                // Normal students: `done` is purely server-driven (`item.done`
                // flips to true when the student actually does the activity —
                // e.g. completed a DailyDose, finished Instacue cards, posted
                // a Gyan++ comment). They cannot click to mark items complete
                // — clicking would let them self-claim the onboarding RDM.
                // Admins keep the click-to-mark override for testing/demo.
                const tapped = isAppAdmin && checklistTaps[item.id] === true;
                const done = item.done || tapped;
                return (
                  <li
                    key={item.id}
                    data-checklist-item={item.id}
                    title={
                      isAppAdmin
                        ? done
                          ? "Completed (admin override)"
                          : "Admin: click to mark complete (testing override)"
                        : done
                          ? "Completed — keep studying!"
                          : "Auto-tracks as you do the activity"
                    }
                    className={cn(
                      "flex items-center gap-2 border-b border-border/60 py-1.5 last:border-none",
                      // Cursor: admins can click, students cannot.
                      isAppAdmin && !done
                        ? "cursor-pointer"
                        : "cursor-default"
                    )}
                    onClick={() => {
                      if (!isAppAdmin) return;
                      if (done) return;
                      setChecklistTaps((p) => ({ ...p, [item.id]: true }));
                    }}
                  >
                    <span
                      className={cn(
                        "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        done
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-border"
                      )}
                    >
                      {done ? <Check className="h-2 w-2" aria-hidden /> : null}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 text-[11px] font-semibold",
                        done ? "text-muted-foreground line-through" : "text-foreground"
                      )}
                    >
                      {item.id.toUpperCase()} ·{" "}
                      {item.id === "a"
                        ? "Daily routine (DailyDose + Funbrain)"
                        : item.id === "b"
                          ? "Lessons/Progress complete in all 3 subjects"
                          : item.id === "c"
                            ? "Gyan++ feed — 5 min, save, react"
                            : item.id === "d"
                              ? "Instacue — 32 cards"
                              : "Challenge Yourself"}
                    </span>
                    <Link
                      href={
                        item.id === "a"
                          ? "/play"
                          : item.id === "b"
                            ? "/explore-1"
                            : item.id === "c"
                              ? "/doubts"
                              : item.id === "d"
                                ? "/revision"
                                : "/refer-earn?tab=challenges"
                      }
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground transition-colors hover:bg-emerald-500 hover:text-white"
                    >
                      Go
                    </Link>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => setIsChecklistOpen(true)}
              className="mt-2.5 w-full rounded-full bg-emerald-500/10 py-1.5 text-[11px] font-bold text-emerald-500 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
            >
              Open full checklist →
            </button>
          </div>

          {/* Leaderboard card */}
          <div className="rounded-xl border border-border/70 bg-card/80 p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-[12px] font-bold text-foreground">
                <Star className="h-3.5 w-3.5 text-amber-500" aria-hidden /> Leaderboard
              </h3>
              <Link
                href="/performance"
                className="text-[10px] font-bold text-emerald-500 hover:underline"
              >
                All →
              </Link>
            </div>
            <ul>
              {MOCK_LEADERBOARD.map((row) => (
                <li
                  key={row.rank}
                  className="flex items-center gap-2 border-b border-border/60 py-1.5 last:border-none"
                >
                  <span className="w-4 text-[10px] font-bold text-muted-foreground">
                    {row.rank}
                  </span>
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white",
                      row.rank === 1
                        ? "bg-emerald-500"
                        : row.rank === 2
                          ? "bg-blue-500"
                          : row.rank === 3
                            ? "bg-violet-500"
                            : row.rank === 4
                              ? "bg-amber-500"
                              : "bg-blue-500"
                    )}
                  >
                    {row.name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-foreground">
                      {row.name}
                    </p>
                    <p className="text-[9px] text-muted-foreground">{row.city}</p>
                  </div>
                  <span className="font-mono text-[11px] font-bold tabular-nums text-emerald-500">
                    {row.pts}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Upcoming mocks card */}
          <div className="rounded-xl border border-border/70 bg-card/80 p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-[12px] font-bold text-foreground">
                <CalendarDays className="h-3.5 w-3.5 text-blue-500" aria-hidden /> Upcoming mocks
              </h3>
              <Link
                href="/mock"
                className="text-[10px] font-bold text-muted-foreground hover:underline"
              >
                All →
              </Link>
            </div>
            <ul className="space-y-2">
              {upcomingBlocks === null ? (
                [0, 1, 2].map((i) => (
                  <li
                    key={`upcoming-skel-${i}`}
                    className="animate-pulse rounded-lg border border-border/60 bg-muted/15 p-2"
                  >
                    <div className="h-3 max-w-[78%] rounded bg-muted" />
                    <div className="mt-1.5 h-2.5 max-w-[52%] rounded bg-muted" />
                    <div className="mt-2 h-5 w-16 rounded-full bg-muted" />
                  </li>
                ))
              ) : (
                upcomingBlocks.slice(0, 3).map((m) => (
                  <li
                    key={m.key}
                    className="rounded-lg border border-border/60 bg-background/40 p-2"
                  >
                    <p className="text-[11px] font-semibold leading-snug text-foreground">
                      {m.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{m.meta}</p>
                    <button
                      type="button"
                      onClick={() => router.push(m.href)}
                      className="mt-1.5 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold text-white transition-colors hover:bg-emerald-600"
                    >
                      Start now
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* ── FULL CHECKLIST DIALOG (preserved) ── */}
      {SHOW_DASHBOARD_CHECKLIST ? (
        <Dialog open={isChecklistOpen} onOpenChange={setIsChecklistOpen}>
          <DialogContent
            className={
              "flex w-full max-w-3xl flex-col gap-0 overflow-hidden border-border/70 bg-card p-0 shadow-2xl " +
              "ring-1 ring-black/5 dark:border-white/10 dark:bg-[#070b14] dark:ring-white/10 " +
              "max-h-[min(92dvh,56rem)] " +
              "max-sm:inset-x-0 max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto " +
              "max-sm:max-h-[min(90dvh,56rem)] max-sm:w-full max-sm:translate-x-0 max-sm:translate-y-0 " +
              "max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:border-x-0 max-sm:border-b-0 " +
              "sm:left-1/2 sm:top-1/2 sm:w-[calc(100vw-1.5rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border " +
              "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            }
          >
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
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="shrink-0 border-t border-border/60 bg-muted/25 px-3.5 py-2.5 sm:px-6 sm:py-3 dark:bg-slate-950/80">
              <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                {checklistStripSummary ? (
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
          </DialogContent>
        </Dialog>
      ) : null}

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
      {/* Trial-end payment gate: TrialExpirationGate in app/providers.tsx (single overlay) */}
    </div>
  );
}
