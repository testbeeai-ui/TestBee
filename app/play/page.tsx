"use client";

import { Suspense, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useIsAppAdmin } from "@/hooks/useIsAppAdmin";
import { useStreakTimer } from "@/hooks/useStreakTimer";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import PlayQuestionCard from "@/components/PlayQuestionCard";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import type { PlayQuestionRow, PlayDomain, AcademicCategory, FunbrainCategory } from "@/types";
import {
  Flame,
  Trophy,
  ArrowLeft,
  Loader2,
  Clock,
  ChevronRight,
  GraduationCap,
  Crosshair,
  Sun,
  Sparkles,
  Check,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchDailyGauntletQuestionsWithFallback,
  fetchPlayQuestionsAdaptiveWithFallback,
} from "@/lib/fetchPlayQuestionsAdaptiveWithFallback";
import { fetchPlayQuestionsDomainRandom } from "@/lib/fetchPlayQuestionsDomainRandom";
import { bumpUserStudyDayMs } from "@/lib/studyDayBump";
import { shufflePlayQuestionOptions } from "@/lib/shufflePlayQuestionOptions";

/** PCM only — matches Gyan++ / investor spec. */
const PCM_CATEGORIES = [
  { id: "physics" as const, label: "Physics" },
  { id: "chemistry" as const, label: "Chemistry" },
  { id: "math" as const, label: "Mathematics" },
] satisfies readonly { id: AcademicCategory; label: string }[];

/** Streak uses its own domain-wide cycle (`*_all`) — separate from DailyDose (`*_gauntlet`) so grinding one mode does not empty the other. */
const ACADEMIC_STREAK_POOL = "academic_all";
const FUNBRAIN_STREAK_POOL = "funbrain_all";

/** Streak survival: up to this many questions per run (5 min session cap). */
const STREAK_SESSION_QUESTIONS = 15;

function streakPoolForDomain(domain: PlayDomain): string {
  return domain === "academic" ? ACADEMIC_STREAK_POOL : FUNBRAIN_STREAK_POOL;
}

function topicLabelForQuestionCategory(domain: PlayDomain | null, cat: string | undefined): string {
  if (!domain || !cat) return "Mixed";
  if (domain === "academic") {
    return PCM_CATEGORIES.find((c) => c.id === (cat as AcademicCategory))?.label ?? cat;
  }
  return FUNBRAIN_PILLS.find((p) => p.id === (cat as FunbrainCategory))?.label ?? cat;
}

/** Funbrain tabs whose Elo lives in Supabase `user_play_stats` (plus client-only mental math in Global Rating). */
const FUNBRAIN_DB_ELO_CATEGORIES: FunbrainCategory[] = ["puzzles", "verbal", "quantitative", "analytical", "gk"];
const FUNBRAIN_DISPLAY_K = 32;
const mentalMathDisplayEloKey = (userId: string) => `testbee_play_mental_math_display_elo_${userId}`;

/** Six lobby pills; `pillKey` is unique for selection UI. */
const FUNBRAIN_PILLS: {
  pillKey: string;
  id: FunbrainCategory;
  label: string;
  pillClass: string;
}[] = [
  { pillKey: "verbal", id: "verbal", label: "Verbal", pillClass: "border-indigo-400/40 text-indigo-600 bg-indigo-500/10 dark:text-indigo-300 dark:bg-indigo-500/10" },
  { pillKey: "quantitative", id: "quantitative", label: "Quantitative", pillClass: "border-amber-400/50 text-amber-700 bg-amber-500/10 dark:text-amber-300 dark:bg-amber-500/10" },
  { pillKey: "analytical", id: "analytical", label: "Analytical", pillClass: "border-orange-400/50 text-orange-700 bg-orange-500/10 dark:text-orange-300 dark:bg-orange-500/10" },
  { pillKey: "puzzles", id: "puzzles", label: "Puzzles", pillClass: "border-violet-400/45 text-violet-700 bg-violet-500/10 dark:text-violet-300 dark:bg-violet-500/10" },
  { pillKey: "gk", id: "gk", label: "GK", pillClass: "border-emerald-400/45 text-emerald-700 bg-emerald-500/10 dark:text-emerald-300 dark:bg-emerald-500/10" },
  { pillKey: "mental_math", id: "mental_math", label: "Mental Math", pillClass: "border-red-400/45 text-red-700 bg-red-500/10 dark:text-red-300 dark:bg-red-500/10" },
];

/** Investor mock: outline-first chips on dashboard (read-only). */
type PcmArenaChipId = (typeof PCM_CATEGORIES)[number]["id"];
/** Ref v2: Physics violet, Chemistry orange-red, Math yellow — outline-first. */
const PCM_INVESTOR_CHIP: Record<PcmArenaChipId, string> = {
  physics:
    "border-violet-500/50 text-violet-900 bg-violet-50/30 dark:border-violet-400/55 dark:text-violet-100 dark:bg-violet-500/[0.05]",
  chemistry:
    "border-orange-600/45 text-orange-950 bg-orange-50/35 dark:border-orange-500/50 dark:text-orange-100 dark:bg-orange-950/25",
  math:
    "border-amber-400/55 text-amber-950 bg-amber-50/40 dark:border-amber-300/50 dark:text-amber-50 dark:bg-amber-950/20",
};

/** Ref v2: Puzzles blue, Mental Math rose — matches investor board v2. */
const FUNBRAIN_INVESTOR_CHIP: Record<FunbrainCategory, string> = {
  verbal:
    "border-violet-500/50 text-violet-900 bg-violet-50/35 dark:border-violet-400/55 dark:text-violet-100 dark:bg-violet-500/[0.05]",
  quantitative:
    "border-amber-500/50 text-amber-950 bg-amber-50/40 dark:border-amber-400/50 dark:text-amber-50 dark:bg-amber-950/20",
  analytical:
    "border-orange-500/50 text-orange-950 bg-orange-50/35 dark:border-orange-400/50 dark:text-orange-100 dark:bg-orange-950/25",
  puzzles:
    "border-sky-500/50 text-sky-900 bg-sky-50/40 dark:border-sky-400/55 dark:text-sky-100 dark:bg-sky-500/[0.06]",
  gk:
    "border-emerald-500/50 text-emerald-900 bg-emerald-50/35 dark:border-emerald-400/50 dark:text-emerald-100 dark:bg-emerald-950/20",
  mental_math:
    "border-rose-500/50 text-rose-900 bg-rose-50/35 dark:border-rose-400/55 dark:text-rose-100 dark:bg-rose-950/30",
};

type View = "dashboard" | "streak" | "gauntlet" | "gauntlet_result" | "streak_gameover";

function playStreakDayKey(userId: string, dayIso: string, domain: PlayDomain) {
  return `testbee_streak_start_${userId}_${dayIso}_${domain}`;
}

/** Client + server: one DailyDose submit per domain per calendar day (non-admin). */
function playGauntletDayDoneKey(userId: string, dayIso: string, domain: PlayDomain) {
  return `testbee_gauntlet_done_${userId}_${dayIso}_${domain}`;
}

function PlayPageContent() {
  const { user, profile } = useAuth();
  const isPlayAdmin = useIsAppAdmin();
  const searchParams = useSearchParams();
  const streakTimer = useStreakTimer();

  const [view, setView] = useState<View>("dashboard");
  const [userStats, setUserStats] = useState<{ category: string; current_rating: number; win_streak?: number }[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState<PlayDomain | null>("academic");
  /** Funbrain game-over screen: last question was Mental Math (separate from Elo). */
  const [streakGameoverMentalMath, setStreakGameoverMentalMath] = useState(false);
  /** Mental Math Elo for Global Rating only (browser); not written to Supabase. */
  const [mentalMathDisplayElo, setMentalMathDisplayElo] = useState(1000);

  // Streak Survival (15 questions · 5 min session · manual Next only)
  const [streakQuestion, setStreakQuestion] = useState<PlayQuestionRow | null>(null);
  /** Prefetched stratified queue for the current streak session (same RPC batch as DailyDose). */
  const streakQueueRef = useRef<PlayQuestionRow[]>([]);
  /** Length of current streak queue (for Q i/n UI); defaults to 15 before a session starts. */
  const [streakSessionQuestionCount, setStreakSessionQuestionCount] = useState(STREAK_SESSION_QUESTIONS);
  const [streakLoading, setStreakLoading] = useState(false);
  const [streakCount, setStreakCount] = useState(0);
  /** Investor mock: 5 min session (streak + DailyDose session cap). */
  const GAUNTLET_SESSION_SEC = 300;
  const GAUNTLET_Q_SEC = 20;
  const [streakRoundIndex, setStreakRoundIndex] = useState(0);
  const [streakExitReason, setStreakExitReason] = useState<"time" | "complete" | null>(null);
  const [streakSessionLeft, setStreakSessionLeft] = useState(GAUNTLET_SESSION_SEC);
  const streakSessionEndRef = useRef(false);

  useEffect(() => {
    if (view !== "streak") return;
    const t = setInterval(() => {
      setStreakSessionLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [view]);

  useEffect(() => {
    if (view !== "streak" || streakSessionLeft > 0) return;
    if (streakSessionEndRef.current) return;
    streakSessionEndRef.current = true;
    const mental = selectedDomain === "funbrain" && streakQuestion?.category === "mental_math";
    queueMicrotask(() => {
      setStreakExitReason("time");
      setStreakGameoverMentalMath(mental);
      setView("streak_gameover");
      setStreakQuestion(null);
    });
  }, [view, streakSessionLeft, selectedDomain, streakQuestion]);

  const formatClock = (sec: number) =>
    `${String(Math.floor(Math.max(0, sec) / 60)).padStart(2, "0")}:${String(Math.max(0, sec) % 60).padStart(2, "0")}`;

  // Daily Gauntlet
  const [gauntletQuestions, setGauntletQuestions] = useState<PlayQuestionRow[]>([]);
  const [gauntletIndex, setGauntletIndex] = useState(0);
  const [gauntletResults, setGauntletResults] = useState<{ question_id: string; is_correct: boolean; time_taken_ms: number }[]>([]);
  const gauntletResultsRef = useRef<{ question_id: string; is_correct: boolean; time_taken_ms: number }[]>([]);
  useEffect(() => { gauntletResultsRef.current = gauntletResults; }, [gauntletResults]);
  const [gauntletLoading, setGauntletLoading] = useState(false);
  /** True when DailyDose could not load any questions (RPC + fallbacks); avoids "No attempts yet" copy. */
  const [gauntletLoadFailed, setGauntletLoadFailed] = useState(false);
  const [gauntletSubmitted, setGauntletSubmitted] = useState<{ correct_count: number; total_time_ms: number } | null>(null);
  const [gauntletAlreadyPlayed, setGauntletAlreadyPlayed] = useState(false);
  const [gauntletPlayedToday, setGauntletPlayedToday] = useState<{ academic: boolean; funbrain: boolean }>({ academic: false, funbrain: false });
  /** Today's Funbrain DailyDose rank on leaderboard (ref v2 “Rank #847”), null if not on board yet. */
  const [funbrainDailyGauntletRank, setFunbrainDailyGauntletRank] = useState<number | null>(null);
  /** Non-admin: one streak survival start per calendar day **per domain** (Academic vs Funbrain are independent). */
  const [streakStartUsedByDomain, setStreakStartUsedByDomain] = useState<{ academic: boolean; funbrain: boolean }>({
    academic: false,
    funbrain: false,
  });
  const [leaderboard, setLeaderboard] = useState<{ rank: number; user_id?: string; display_name: string | null; correct_count: number; total_time_ms: number }[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [gauntletSessionLeft, setGauntletSessionLeft] = useState(GAUNTLET_SESSION_SEC);
  const [gauntletQTimeLeft, setGauntletQTimeLeft] = useState(GAUNTLET_Q_SEC);
  const gauntletQuestionsRef = useRef(gauntletQuestions);
  const gauntletIndexRef = useRef(gauntletIndex);
  const gauntletSessionEndRef = useRef(false);
  const gauntletSubmitLockRef = useRef(false);
  useEffect(() => {
    gauntletQuestionsRef.current = gauntletQuestions;
    gauntletIndexRef.current = gauntletIndex;
  }, [gauntletQuestions, gauntletIndex]);

  const fetchUserStats = useCallback(async () => {
    if (!user?.id) return;
    setLoadingStats(true);
    const { data } = await supabase.from("user_play_stats").select("category, current_rating, win_streak").eq("user_id", user.id);
    setUserStats((data as { category: string; current_rating: number }[]) || []);
    setLoadingStats(false);
  }, [user]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchUserStats();
    });
  }, [fetchUserStats]);

  useEffect(() => {
    const uid = user?.id;
    queueMicrotask(() => {
      if (!uid) {
        setMentalMathDisplayElo(1000);
        return;
      }
      try {
        const raw = localStorage.getItem(mentalMathDisplayEloKey(uid));
        if (raw != null) {
          const n = Number.parseInt(raw, 10);
          if (!Number.isNaN(n)) {
            setMentalMathDisplayElo(Math.max(100, Math.min(3000, n)));
            return;
          }
        }
      } catch {
        /* ignore */
      }
      setMentalMathDisplayElo(1000);
    });
  }, [user?.id]);

  const bumpMentalMathDisplayElo = useCallback(
    (isCorrect: boolean) => {
      if (!user?.id) return;
      setMentalMathDisplayElo((prev) => {
        const delta = isCorrect ? FUNBRAIN_DISPLAY_K : -FUNBRAIN_DISPLAY_K;
        const next = Math.max(100, Math.min(3000, prev + delta));
        try {
          localStorage.setItem(mentalMathDisplayEloKey(user.id), String(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [user]
  );

  const todayDate = () => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  };

  useEffect(() => {
    if (!user?.id || isPlayAdmin) {
      queueMicrotask(() =>
        setStreakStartUsedByDomain({
          academic: false,
          funbrain: false,
        }),
      );
      return;
    }
    const day = todayDate();
    queueMicrotask(() => {
      try {
        setStreakStartUsedByDomain({
          academic: localStorage.getItem(playStreakDayKey(user.id, day, "academic")) === "1",
          funbrain: localStorage.getItem(playStreakDayKey(user.id, day, "funbrain")) === "1",
        });
      } catch {
        setStreakStartUsedByDomain({ academic: false, funbrain: false });
      }
    });
  }, [user?.id, isPlayAdmin, view]);

  useEffect(() => {
    if (!user?.id || view !== "dashboard") return;
    (async () => {
      const today = todayDate();
      const played = { academic: false, funbrain: false };
      let funbrainRank: number | null = null;
      for (const domain of ["academic", "funbrain"] as PlayDomain[]) {
        const { data } = await supabase.rpc("get_daily_gauntlet_leaderboard", { p_gauntlet_date: today, p_domain: domain });
        const rows = (data as { user_id?: string; rank: number }[]) || [];
        if (rows.some((r) => r.user_id === user.id)) {
          played[domain] = true;
        }
        if (domain === "funbrain") {
          const mine = rows.find((r) => r.user_id === user.id);
          if (mine && typeof mine.rank === "number") funbrainRank = mine.rank;
        }
      }
      let storageAcademic = false;
      let storageFunbrain = false;
      try {
        storageAcademic = localStorage.getItem(playGauntletDayDoneKey(user.id, today, "academic")) === "1";
        storageFunbrain = localStorage.getItem(playGauntletDayDoneKey(user.id, today, "funbrain")) === "1";
      } catch {
        /* ignore */
      }
      setGauntletPlayedToday({
        academic: played.academic || storageAcademic,
        funbrain: played.funbrain || storageFunbrain,
      });
      setFunbrainDailyGauntletRank(funbrainRank);
    })();
  }, [user?.id, view]);

  useEffect(() => {
    if (!user?.id) return;
    const d = searchParams.get("domain");
    queueMicrotask(() => {
      if (d === "academic") {
        setSelectedDomain("academic");
        return;
      }
      if (d === "funbrain") {
        setSelectedDomain("funbrain");
      }
    });
  }, [user?.id, searchParams]);

  /** Shown Funbrain Global Rating: DB Elo for four tabs + client-only Mental Math (localStorage). */
  const funbrainDisplayRating = useMemo(() => {
    const fromDb = FUNBRAIN_DB_ELO_CATEGORIES.map(
      (cat) => userStats.find((s) => s.category === cat)?.current_rating ?? 1000
    );
    const sum = fromDb.reduce((a, b) => a + b, 0) + mentalMathDisplayElo;
    return sum / (FUNBRAIN_DB_ELO_CATEGORIES.length + 1);
  }, [userStats, mentalMathDisplayElo]);
  const maxPlayWinStreak = useMemo(
    () => userStats.reduce((m, s) => Math.max(m, s.win_streak ?? 0), 0),
    [userStats]
  );

  const funbrainCompositeRounded = useMemo(
    () => Math.round(funbrainDisplayRating),
    [funbrainDisplayRating]
  );
  const [funbrainCompositeDeltaToday, setFunbrainCompositeDeltaToday] = useState(0);
  useEffect(() => {
    if (view !== "dashboard" || !user?.id || loadingStats) return;
    const timer = window.setTimeout(() => {
      const day = todayDate();
      const key = `testbee_funbrain_composite_day0_${user.id}_${day}`;
      let raw = localStorage.getItem(key);
      if (raw == null) {
        localStorage.setItem(key, String(funbrainCompositeRounded));
        raw = String(funbrainCompositeRounded);
      }
      const baseline = Number.parseInt(raw, 10);
      setFunbrainCompositeDeltaToday(
        Number.isNaN(baseline) ? 0 : funbrainCompositeRounded - baseline
      );
    }, 400);
    return () => window.clearTimeout(timer);
  }, [view, user?.id, loadingStats, funbrainCompositeRounded]);

  /**
   * Adaptive play RPC: full pool for domain+category (no difficulty band). Questions answered
   * correctly since `user_play_stats.question_pool_reset_at` are excluded until every pool
   * question has at least one correct in that cycle, then the cycle resets; wrong answers can repeat.
   * Streak uses `*_all` pool keys in `play_history.pool_key`; DailyDose uses `*_gauntlet` so the two
   * modes do not cross-empty each other’s eligible sets. `user_play_stats` ratings are for UI only.
   */
  const startStreak = async (domain: PlayDomain) => {
    if (!isPlayAdmin && user?.id) {
      try {
        if (localStorage.getItem(playStreakDayKey(user.id, todayDate(), domain)) === "1") return;
      } catch {
        /* ignore */
      }
    }
    streakSessionEndRef.current = false;
    setStreakSessionLeft(GAUNTLET_SESSION_SEC);
    setSelectedDomain(domain);
    setView("streak");
    setStreakRoundIndex(0);
    setStreakExitReason(null);
    setStreakCount(0);
    setStreakGameoverMentalMath(false);
    setStreakQuestion(null);
    streakQueueRef.current = [];
    setStreakLoading(true);
    let rows: PlayQuestionRow[] = [];
    if (user?.id) {
      rows = isPlayAdmin
        ? await fetchPlayQuestionsDomainRandom(supabase, {
            domain,
            count: STREAK_SESSION_QUESTIONS,
          })
        : await fetchPlayQuestionsAdaptiveWithFallback(supabase, {
            domain,
            category: streakPoolForDomain(domain),
            count: STREAK_SESSION_QUESTIONS,
          });
    }
    const shuffled = rows.map((q) => shufflePlayQuestionOptions(q));
    streakQueueRef.current = shuffled;
    const n = shuffled.length;
    setStreakSessionQuestionCount(n > 0 ? n : STREAK_SESSION_QUESTIONS);
    setStreakLoading(false);
    const q = shuffled[0] ?? null;
    setStreakQuestion(q);
    if (q && user?.id && !isPlayAdmin) {
      try {
        localStorage.setItem(playStreakDayKey(user.id, todayDate(), domain), "1");
      } catch {
        /* ignore */
      }
      setStreakStartUsedByDomain((prev) => ({ ...prev, [domain]: true }));
    }
  };

  const handleStreakAnswer = async (selectedIndex: number, timeTakenMs: number) => {
    if (!streakQuestion || !selectedDomain) return;
    const isCorrect = selectedIndex === streakQuestion.correct_answer_index;
    await supabase.rpc("record_play_result", {
      p_question_id: streakQuestion.id,
      p_is_correct: isCorrect,
      p_time_taken_ms: timeTakenMs,
      p_category: null,
      p_pool_key: streakPoolForDomain(selectedDomain),
    });
    void bumpUserStudyDayMs(timeTakenMs);
    if (selectedDomain === "funbrain" && streakQuestion.category === "mental_math") {
      bumpMentalMathDisplayElo(isCorrect);
    }
    if (isCorrect) {
      setStreakCount((c) => c + 1);
    }
  };

  const handleStreakNext = useCallback(() => {
    if (!streakQuestion || !selectedDomain) return;
    const nextRound = streakRoundIndex + 1;
    const queue = streakQueueRef.current;
    const sessionLen = queue.length > 0 ? queue.length : STREAK_SESSION_QUESTIONS;
    if (nextRound >= sessionLen) {
      streakSessionEndRef.current = true;
      setStreakGameoverMentalMath(selectedDomain === "funbrain" && streakQuestion.category === "mental_math");
      setStreakExitReason("complete");
      setView("streak_gameover");
      setStreakQuestion(null);
      streakQueueRef.current = [];
      return;
    }
    const next = queue[nextRound];
    if (!next) {
      setStreakQuestion(null);
      streakQueueRef.current = [];
      return;
    }
    setStreakRoundIndex(nextRound);
    setStreakQuestion(next);
  }, [streakQuestion, selectedDomain, streakRoundIndex]);

  const checkGauntletAndStart = async (domain: PlayDomain) => {
    if (!user?.id) return;
    setSelectedDomain(domain);
    setGauntletLoadFailed(false);
    setGauntletLoading(true);
    const today = todayDate();
    // Check if already played using the leaderboard RPC
    const { data: lb } = await supabase.rpc("get_daily_gauntlet_leaderboard", { p_gauntlet_date: today, p_domain: domain });
    const lbRows = (lb as { user_id?: string; correct_count: number; total_time_ms: number; rank: number; display_name: string | null }[]) || [];
    const myRow = lbRows.find((r) => r.user_id === user.id);
    if (myRow && !isPlayAdmin) {
      try {
        localStorage.setItem(playGauntletDayDoneKey(user.id, today, domain), "1");
      } catch {
        /* ignore */
      }
      setGauntletPlayedToday((prev) => ({ ...prev, [domain]: true }));
      setGauntletAlreadyPlayed(true);
      setGauntletSubmitted({ correct_count: myRow.correct_count, total_time_ms: myRow.total_time_ms });
      setLeaderboard(lbRows);
      setGauntletLoading(false);
      setView("gauntlet_result");
      return;
    }
    if (!isPlayAdmin && user?.id) {
      try {
        if (localStorage.getItem(playGauntletDayDoneKey(user.id, today, domain)) === "1") {
          setGauntletPlayedToday((prev) => ({ ...prev, [domain]: true }));
          setGauntletAlreadyPlayed(true);
          setGauntletSubmitted(null);
          setLeaderboard(lbRows);
          setGauntletLoading(false);
          setView("gauntlet_result");
          return;
        }
      } catch {
        /* ignore */
      }
    }
    const questions = await fetchDailyGauntletQuestionsWithFallback(supabase, {
      domain,
      dateIso: today,
    });
    setGauntletLoading(false);
    if (questions.length === 0) {
      setGauntletLoadFailed(true);
      setGauntletAlreadyPlayed(false);
      setGauntletSubmitted(null);
      setView("gauntlet_result");
      setLeaderboard([]);
      return;
    }
    setGauntletQuestions(questions.map((q) => shufflePlayQuestionOptions(q)));
    setGauntletIndex(0);
    setGauntletResults([]);
    setGauntletSubmitted(null);
    setGauntletAlreadyPlayed(false);
    setGauntletSessionLeft(GAUNTLET_SESSION_SEC);
    setGauntletQTimeLeft(GAUNTLET_Q_SEC);
    gauntletSessionEndRef.current = false;
    gauntletSubmitLockRef.current = false;
    setView("gauntlet");
  };

  const fetchLeaderboard = async (date: string, domain: PlayDomain = "funbrain") => {
    setLeaderboardLoading(true);
    const { data } = await supabase.rpc("get_daily_gauntlet_leaderboard", { p_gauntlet_date: date, p_domain: domain });
    setLeaderboard((data as { rank: number; user_id?: string; display_name: string | null; correct_count: number; total_time_ms: number }[]) || []);
    setLeaderboardLoading(false);
  };

  const handleGauntletAnswer = (selectedIndex: number, timeTakenMs: number) => {
    if (!gauntletQuestions[gauntletIndex]) return;
    const q = gauntletQuestions[gauntletIndex];
    const isCorrect = selectedIndex === q.correct_answer_index;
    const newResult = { question_id: q.id, is_correct: isCorrect, time_taken_ms: timeTakenMs };
    const fullSoFar = [...gauntletResultsRef.current, newResult];
    setGauntletResults(fullSoFar);
  };

  const currentGauntletFinished = gauntletIndex >= gauntletQuestions.length - 1;

  const submitGauntlet = useCallback(
    async (results: { question_id: string; is_correct: boolean; time_taken_ms: number }[]) => {
      if (gauntletSubmitLockRef.current) return;
      gauntletSubmitLockRef.current = true;
      const today = todayDate();
      const currentDomain = selectedDomain || "funbrain";
      const uid = user?.id;

      const localCorrect = results.filter((r) => r.is_correct).length;
      const localTimeMs = results.reduce((acc, r) => acc + r.time_taken_ms, 0);

      const { error } = await supabase.rpc("submit_daily_gauntlet", {
        p_gauntlet_date: today,
        p_results: results,
        p_domain: currentDomain,
      });
      void bumpUserStudyDayMs(localTimeMs);

      if (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("[submitGauntlet] submit_daily_gauntlet", error);
        }
        gauntletSubmitLockRef.current = false;
        return;
      }

      if (uid && !isPlayAdmin) {
        try {
          localStorage.setItem(playGauntletDayDoneKey(uid, today, currentDomain), "1");
        } catch {
          /* ignore */
        }
        setGauntletPlayedToday((prev) => ({ ...prev, [currentDomain]: true }));
      }

      setGauntletSubmitted({ correct_count: localCorrect, total_time_ms: localTimeMs });
      setView("gauntlet_result");
      void fetchLeaderboard(today, currentDomain);
    },
    [selectedDomain, user?.id, isPlayAdmin]
  );

  const handleGauntletTimeout = useCallback(() => {
    const idx = gauntletIndexRef.current;
    const qs = gauntletQuestionsRef.current;
    const q = qs[idx];
    if (!q) return;
    const prev = gauntletResultsRef.current;
    if (prev.some((r) => r.question_id === q.id)) return;
    const row = { question_id: q.id, is_correct: false, time_taken_ms: GAUNTLET_Q_SEC * 1000 };
    const next = [...prev, row];
    gauntletResultsRef.current = next;
    setGauntletResults(next);
    if (idx >= qs.length - 1) {
      void submitGauntlet(next);
    } else {
      setGauntletIndex(idx + 1);
    }
  }, [submitGauntlet]);

  useEffect(() => {
    if (view !== "gauntlet" || gauntletQuestions.length === 0) return;
    const t = setInterval(() => {
      setGauntletSessionLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [view, gauntletQuestions.length]);

  useEffect(() => {
    if (view !== "gauntlet" || gauntletQuestions.length === 0) return;
    queueMicrotask(() => {
      setGauntletQTimeLeft(GAUNTLET_Q_SEC);
    });
  }, [view, gauntletIndex, gauntletQuestions.length]);

  useEffect(() => {
    if (view !== "gauntlet" || gauntletSessionLeft > 0 || gauntletQuestions.length === 0) return;
    if (gauntletSessionEndRef.current) return;
    gauntletSessionEndRef.current = true;
    const qs = gauntletQuestionsRef.current;
    const existing = [...gauntletResultsRef.current];
    while (existing.length < qs.length) {
      const i = existing.length;
      existing.push({ question_id: qs[i]!.id, is_correct: false, time_taken_ms: GAUNTLET_Q_SEC * 1000 });
    }
    gauntletResultsRef.current = existing;
    setGauntletResults(existing);
    void submitGauntlet(existing);
  }, [gauntletSessionLeft, view, gauntletQuestions.length, submitGauntlet]);

  const backToDashboard = () => {
    streakSessionEndRef.current = false;
    streakQueueRef.current = [];
    setStreakSessionQuestionCount(STREAK_SESSION_QUESTIONS);
    setView("dashboard");
    setStreakQuestion(null);
    setStreakRoundIndex(0);
    setStreakExitReason(null);
    setStreakCount(0);
    setStreakSessionLeft(GAUNTLET_SESSION_SEC);
    setGauntletQuestions([]);
    setGauntletSubmitted(null);
    setGauntletAlreadyPlayed(false);
    setGauntletLoadFailed(false);
    setGauntletSessionLeft(GAUNTLET_SESSION_SEC);
    setGauntletQTimeLeft(GAUNTLET_Q_SEC);
    gauntletSessionEndRef.current = false;
    gauntletSubmitLockRef.current = false;
    fetchUserStats();
  };

  const gauntletTotalQ = gauntletQuestions.length;
  const academicLiveGauntlet = view === "gauntlet" && selectedDomain === "academic";
  const academicLiveStreak = view === "streak" && selectedDomain === "academic";
  const funbrainLiveGauntlet = view === "gauntlet" && selectedDomain === "funbrain";
  const funbrainLiveStreak = view === "streak" && selectedDomain === "funbrain";

  const academicClockSec = academicLiveGauntlet ? gauntletSessionLeft : academicLiveStreak ? streakSessionLeft : null;
  const funbrainClockSec = funbrainLiveGauntlet ? gauntletSessionLeft : funbrainLiveStreak ? streakSessionLeft : null;

  const academicClockWarn =
    academicClockSec !== null &&
    (academicLiveGauntlet || academicLiveStreak ? academicClockSec <= 30 : academicClockSec <= 2);
  const funbrainClockWarn =
    funbrainClockSec !== null &&
    (funbrainLiveGauntlet || funbrainLiveStreak ? funbrainClockSec <= 30 : funbrainClockSec <= 2);

  const academicBarPct = academicLiveGauntlet
    ? Math.round((gauntletSessionLeft / GAUNTLET_SESSION_SEC) * 100)
    : academicLiveStreak
      ? Math.round((streakSessionLeft / GAUNTLET_SESSION_SEC) * 100)
      : 100;
  const funbrainBarPct = funbrainLiveGauntlet
    ? Math.round((gauntletSessionLeft / GAUNTLET_SESSION_SEC) * 100)
    : funbrainLiveStreak
      ? Math.round((streakSessionLeft / GAUNTLET_SESSION_SEC) * 100)
      : 100;

  const playSessionOpen = view !== "dashboard";

  const academicDoseLocked = !isPlayAdmin && gauntletPlayedToday.academic;
  const funbrainDoseLocked = !isPlayAdmin && gauntletPlayedToday.funbrain;
  const academicStreakLockedToday = !isPlayAdmin && streakStartUsedByDomain.academic;
  const funbrainStreakLockedToday = !isPlayAdmin && streakStartUsedByDomain.funbrain;

  return (
    <ProtectedRoute>
      <AppLayout streakTimer={streakTimer}>
        <div className="max-w-5xl mx-auto px-3 py-3 sm:px-4 sm:py-4 2xl:py-6">
          <motion.div
            key="play-shell"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
              "rounded-none sm:rounded-2xl border-0 sm:border overflow-hidden",
              "bg-zinc-50 border-zinc-200/80",
              "dark:bg-[#16161f] dark:border-white/[0.06]"
            )}
          >
                {/* Top bar — ref v2 darker shell */}
                <div
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 px-4 sm:px-[18px] py-3 border-b",
                    "border-zinc-200/90 bg-zinc-50/95",
                    "dark:border-white/[0.06] dark:bg-[#16161f]"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-indigo-600">
                      <Crosshair className="h-5 w-5 text-white" strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-[#f0f0ff]">Play</h1>
                      <p className="text-[11px] text-zinc-500 dark:text-[#f0f0ff]/46 leading-snug">
                        Challenge yourself. Climb the ranks. Outsmart everyone.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                        "border-orange-300/60 text-orange-600 bg-orange-500/10",
                        "dark:border-orange-500/25 dark:text-orange-400 dark:bg-orange-500/12"
                      )}
                    >
                      <Flame className="h-3 w-3" strokeWidth={2} />
                      {maxPlayWinStreak > 0 ? `${maxPlayWinStreak} win streak` : "Build streak"}
                    </div>
                    <div
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums",
                        "border-amber-300/60 text-amber-700 bg-amber-500/10",
                        "dark:border-amber-400/25 dark:text-amber-400 dark:bg-amber-400/12"
                      )}
                    >
                      ⚡ {profile?.rdm ?? 0} RDM
                    </div>
                  </div>
                </div>

                <div className="relative p-3 sm:p-[14px] pt-0 sm:pt-0">
                  <div className="relative z-0 grid md:grid-cols-2 gap-3">
                  {/* Academic Arena */}
                  <div
                    className={cn(
                      "rounded-[17px] border p-[18px]",
                      "bg-white border-zinc-200/90 shadow-sm",
                      "dark:bg-[#1e1e28] dark:border-white/[0.055] dark:shadow-none"
                    )}
                  >
                    <div className="flex gap-3 mb-3.5">
                      <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-indigo-500/15 dark:bg-indigo-500/14">
                        <GraduationCap className="h-[19px] w-[19px] text-indigo-600 dark:text-indigo-400" strokeWidth={1.8} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-[17px] font-bold leading-tight text-zinc-900 dark:text-[#f0f0ff]">Academic Arena</h2>
                        <p className="text-[11px] text-zinc-500 dark:text-[#f0f0ff]/48 mt-0.5 leading-snug">
                          CBSE/JEE Board MCQs · Physics | Chemistry | Maths · 15 Qs · 5 min
                        </p>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "flex w-full items-start gap-2 rounded-[10px] border px-3 py-2 mb-3 text-[11px] font-bold leading-snug",
                        "border-red-300/50 text-red-800 bg-red-50/40",
                        "dark:border-red-500/40 dark:text-red-200 dark:bg-red-950/35"
                      )}
                    >
                      <Sun className="h-3.5 w-3.5 shrink-0 text-red-500 dark:text-red-300 mt-0.5" strokeWidth={2} />
                      <span>Advanced difficulty — 50% harder · 5 min total · 20s/Q</span>
                    </div>

                    <div
                      className="flex flex-wrap gap-1.5 mb-3 pointer-events-none select-none"
                      aria-label="Academic subjects included in mixed play"
                    >
                      {PCM_CATEGORIES.map((c) => (
                        <span
                          key={c.id}
                          className={cn(
                            "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                            PCM_INVESTOR_CHIP[c.id]
                          )}
                        >
                          {c.label}
                        </span>
                      ))}
                    </div>

                    <div
                      className={cn(
                        "rounded-[12px] border px-3 py-3 mb-3",
                        "bg-zinc-100/90 border-zinc-200/85",
                        "dark:bg-[#191922] dark:border-white/[0.07]"
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-[#f0f0ff]/34 mb-1">
                            Session timer
                          </div>
                          <div
                            className={cn(
                              "font-mono text-[24px] font-bold tabular-nums leading-none tracking-tight",
                              academicClockWarn ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-[#f0f0ff]"
                            )}
                          >
                            {academicClockSec !== null ? formatClock(academicClockSec) : "05:00"}
                          </div>
                        </div>
                        <div className="text-right min-w-[140px] flex-1 max-w-[58%]">
                          <div className="text-[11px] text-zinc-600 dark:text-[#f0f0ff]/52 leading-snug">
                            {academicLiveGauntlet && gauntletTotalQ > 0
                              ? `${gauntletTotalQ} questions · 5 min session`
                              : academicLiveStreak
                                ? "Streak · 15 Q max · 5 min session"
                                : "15 questions – 5 min total"}
                          </div>
                          <div className="text-[11px] text-zinc-600 dark:text-[#f0f0ff]/52 mt-1 leading-snug">
                            {academicLiveGauntlet
                              ? `${gauntletQTimeLeft}s · this question`
                              : academicLiveStreak
                                ? "No per-question timer · Next to advance"
                                : "DailyDose 20s/Q · Streak: session timer only"}
                          </div>
                          <div
                            className="mt-2 ml-auto h-[2px] w-[min(100%,11rem)] rounded-full bg-orange-500/90 shadow-[0_0_10px_rgba(249,115,22,0.35)]"
                            aria-hidden
                          />
                        </div>
                      </div>
                      <div className="h-[3px] rounded-full bg-zinc-200 dark:bg-white/[0.07] mt-3 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-600 transition-[width] duration-300"
                          style={{ width: `${academicBarPct}%` }}
                        />
                      </div>
                    </div>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="mb-2 block w-full">
                          <button
                            type="button"
                            className={cn(
                              "w-full flex items-center justify-center gap-2 rounded-[11px] py-3 text-[13px]",
                              academicStreakLockedToday
                                ? cn(
                                    "font-semibold border border-emerald-400/45 text-emerald-800 bg-emerald-500/10 cursor-default",
                                    "opacity-95 dark:border-emerald-500/30 dark:text-emerald-300 dark:bg-emerald-500/12",
                                    "disabled:opacity-95 disabled:pointer-events-none"
                                  )
                                : cn(
                                    "font-bold bg-indigo-600 text-white hover:bg-indigo-700",
                                    "disabled:opacity-50 disabled:pointer-events-none"
                                  )
                            )}
                            onClick={() => void startStreak("academic")}
                            disabled={streakLoading || gauntletLoading || academicStreakLockedToday}
                          >
                            {academicStreakLockedToday ? (
                              <>
                                <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                                Streak Survival — Done
                              </>
                            ) : streakLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                                Start streak survival
                              </>
                            )}
                          </button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {academicStreakLockedToday
                          ? "You’ve already used today’s Academic streak run. Funbrain streak is separate. Back tomorrow."
                          : "Up to 15 questions · 5 min session · tap Next after each answer (no per-question timer)"}
                      </TooltipContent>
                    </Tooltip>

                    <button
                      type="button"
                      className={cn(
                        "w-full flex items-center justify-center gap-2 rounded-[11px] border py-3 text-[13px] font-semibold mb-1.5 transition-colors",
                        academicDoseLocked
                          ? "border-emerald-400/45 text-emerald-800 bg-emerald-500/10 cursor-default opacity-95 dark:border-emerald-500/30 dark:text-emerald-300 dark:bg-emerald-500/12"
                          : cn(
                              "border-zinc-200 bg-zinc-100/50 text-zinc-700 hover:bg-zinc-100",
                              "dark:border-white/[0.11] dark:bg-white/[0.06] dark:text-[#f0f0ff]/70 dark:hover:bg-white/10"
                            )
                      )}
                      onClick={() => !academicDoseLocked && checkGauntletAndStart("academic")}
                      disabled={streakLoading || gauntletLoading || academicDoseLocked}
                    >
                      {academicDoseLocked ? (
                        <>
                          <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                          DailyDose — Done
                        </>
                      ) : gauntletLoading && selectedDomain === "academic" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Clock className="h-4 w-4 opacity-80" />
                          DailyDose — all subjects
                        </>
                      )}
                    </button>

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-1.5 text-[10px] text-zinc-400 dark:text-[#f0f0ff]/30">
                      <span>
                        {isPlayAdmin
                          ? "DailyDose 20s/Q · Streak 15 Q/5 min · manual Next · unlimited (admin)"
                          : "DailyDose 20s/Q · 1/day · Streak 15 Q/5 min · Next to advance · 1/day"}
                      </span>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 inline-flex items-center gap-0.5 hover:underline"
                        onClick={async () => {
                          setSelectedDomain("academic");
                          setGauntletAlreadyPlayed(academicDoseLocked);
                          setView("gauntlet_result");
                          const today = todayDate();
                          setLeaderboardLoading(true);
                          const { data } = await supabase.rpc("get_daily_gauntlet_leaderboard", {
                            p_gauntlet_date: today,
                            p_domain: "academic",
                          });
                          const rows =
                            (data as {
                              rank: number;
                              user_id?: string;
                              display_name: string | null;
                              correct_count: number;
                              total_time_ms: number;
                            }[]) || [];
                          setLeaderboard(rows);
                          setLeaderboardLoading(false);
                          const myRow = rows.find((r) => r.user_id === user?.id);
                          if (myRow) setGauntletSubmitted({ correct_count: myRow.correct_count, total_time_ms: myRow.total_time_ms });
                        }}
                      >
                        Leaderboard <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Funbrain Forge */}
                  <div
                    className={cn(
                      "rounded-[17px] border p-[18px]",
                      "bg-white border-zinc-200/90 shadow-sm",
                      "dark:bg-[#1e1e28] dark:border-white/[0.055] dark:shadow-none"
                    )}
                  >
                    <div className="flex gap-3 mb-3.5">
                      <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-orange-500/15 dark:bg-orange-500/12">
                        <Lightbulb className="h-[19px] w-[19px] text-orange-600 dark:text-orange-400" strokeWidth={1.8} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-[17px] font-bold leading-tight text-zinc-900 dark:text-[#f0f0ff]">Funbrain Forge</h2>
                        <p className="text-[11px] text-zinc-500 dark:text-[#f0f0ff]/48 mt-0.5 leading-snug">
                          {isPlayAdmin
                            ? "Logic · GK · Puzzles · Verbal · Ages 15-20 · 5 min · Unlimited (admin)"
                            : "Logic · GK · Puzzles · Verbal · Ages 15-20 · 5 min · 1 DailyDose/day · 1 streak run/day"}
                        </p>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "flex w-full items-start gap-2 rounded-[10px] border px-3 py-2 mb-3 text-[11px] font-bold leading-snug",
                        "border-amber-300/55 text-amber-950 bg-amber-50/35",
                        "dark:border-amber-500/35 dark:text-amber-100 dark:bg-amber-950/30"
                      )}
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" strokeWidth={2} />
                      <span>
                        {isPlayAdmin
                          ? "Harder puzzles | GK · 5 min total · 20s/Q · Unlimited (admin)"
                          : "Harder puzzles | GK · 5 min total · 20s/Q · 1 DailyDose/day"}
                      </span>
                    </div>

                    <div
                      className={cn(
                        "rounded-[12px] border px-3 py-3 mb-3",
                        "border-orange-200/70 bg-orange-50/25",
                        "dark:border-orange-500/22 dark:bg-[#191922]"
                      )}
                    >
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-[#f0f0ff]/38 mb-1">
                            Global rating
                          </div>
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                            <span className="text-[28px] font-extrabold tabular-nums text-orange-600 dark:text-orange-400 leading-none tracking-tight">
                              {loadingStats ? "—" : funbrainCompositeRounded}
                            </span>
                          </div>
                        </div>
                        <div className="text-right min-w-[118px]">
                          <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-[#f0f0ff]/32 mb-1">
                            ELO
                          </div>
                          <div
                            className={cn(
                              "text-[12px] font-bold tabular-nums",
                              funbrainCompositeDeltaToday > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : funbrainCompositeDeltaToday < 0
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-zinc-500 dark:text-[#f0f0ff]/45"
                            )}
                          >
                            {funbrainCompositeDeltaToday > 0
                              ? `+${funbrainCompositeDeltaToday}`
                              : funbrainCompositeDeltaToday < 0
                                ? `${funbrainCompositeDeltaToday}`
                                : "+0"}{" "}
                            <span className="text-[11px] font-semibold text-zinc-500 dark:text-[#f0f0ff]/40">today</span>
                          </div>
                          <div className="text-[11px] text-zinc-500 dark:text-[#f0f0ff]/48 mt-1.5 leading-snug tabular-nums">
                            {funbrainDailyGauntletRank != null
                              ? `Rank #${funbrainDailyGauntletRank}`
                              : "Rank —"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex flex-wrap gap-1.5 mb-3 pointer-events-none select-none"
                      aria-label="Funbrain subjects included in mixed play"
                    >
                      {FUNBRAIN_PILLS.map((p) => (
                        <span
                          key={p.id}
                          className={cn(
                            "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                            FUNBRAIN_INVESTOR_CHIP[p.id]
                          )}
                        >
                          {p.label}
                        </span>
                      ))}
                    </div>

                    <div
                      className={cn(
                        "rounded-[12px] border px-3 py-3 mb-3",
                        "bg-zinc-100/90 border-zinc-200/85",
                        "dark:bg-[#191922] dark:border-white/[0.07]"
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-[#f0f0ff]/34 mb-1">
                            Session timer
                          </div>
                          <div
                            className={cn(
                              "font-mono text-[24px] font-bold tabular-nums leading-none tracking-tight",
                              funbrainClockWarn ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-[#f0f0ff]"
                            )}
                          >
                            {funbrainClockSec !== null ? formatClock(funbrainClockSec) : "05:00"}
                          </div>
                        </div>
                        <div className="text-right min-w-[140px] flex-1 max-w-[58%]">
                          <div className="text-[11px] text-zinc-600 dark:text-[#f0f0ff]/52 leading-snug">
                            {funbrainLiveGauntlet && gauntletTotalQ > 0
                              ? `${gauntletTotalQ} questions · 5 min session`
                              : funbrainLiveStreak
                                ? "Streak · 15 Q max · 5 min session"
                                : "15 questions – 5 min total"}
                          </div>
                          <div className="text-[11px] text-zinc-600 dark:text-[#f0f0ff]/52 mt-1 leading-snug">
                            {funbrainLiveGauntlet
                              ? `${gauntletQTimeLeft}s · this question`
                              : funbrainLiveStreak
                                ? "No per-question timer · Next to advance"
                                : "DailyDose 20s/Q · Streak: session timer only"}
                          </div>
                          <div
                            className="mt-2 ml-auto h-[2px] w-[min(100%,11rem)] rounded-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.35)]"
                            aria-hidden
                          />
                        </div>
                      </div>
                      <div className="h-[3px] rounded-full bg-zinc-200 dark:bg-white/[0.07] mt-3 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-orange-500 transition-[width] duration-300"
                          style={{ width: `${funbrainBarPct}%` }}
                        />
                      </div>
                    </div>

                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-[10px] border px-3 py-2.5 mb-3",
                        "border-zinc-200 bg-zinc-100/60",
                        "dark:border-white/[0.08] dark:bg-[#191922]"
                      )}
                    >
                      <Clock className="h-3.5 w-3.5 text-zinc-600 dark:text-[#f0f0ff]/45 shrink-0" />
                      <span className="text-[11px] font-medium text-zinc-700 dark:text-[#f0f0ff]/55 flex-1 leading-snug">
                        {isPlayAdmin
                          ? "Unlimited DailyDose & streak survival (admin)"
                          : funbrainDoseLocked
                            ? "No DailyDose left today — back tomorrow"
                            : "1 DailyDose remaining today"}
                      </span>
                      <span
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide",
                          "border-amber-400/60 bg-amber-300 text-amber-950 shadow-sm",
                          "dark:border-amber-400/40 dark:bg-amber-400/25 dark:text-amber-200 dark:shadow-[0_0_14px_rgba(251,191,36,0.2)]"
                        )}
                      >
                        {isPlayAdmin ? "∞" : funbrainDoseLocked ? "Used" : "Free"}
                      </span>
                    </div>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="mb-2 block w-full">
                          <button
                            type="button"
                            className={cn(
                              "w-full flex items-center justify-center gap-2 rounded-[11px] py-3 text-[13px]",
                              funbrainStreakLockedToday
                                ? cn(
                                    "font-semibold border border-emerald-400/45 text-emerald-800 bg-emerald-500/10 cursor-default",
                                    "opacity-95 dark:border-emerald-500/30 dark:text-emerald-300 dark:bg-emerald-500/12",
                                    "disabled:opacity-95 disabled:pointer-events-none"
                                  )
                                : cn(
                                    "font-bold bg-orange-600 text-white hover:bg-orange-700",
                                    "disabled:opacity-50 disabled:pointer-events-none"
                                  )
                            )}
                            onClick={() => void startStreak("funbrain")}
                            disabled={streakLoading || gauntletLoading || funbrainStreakLockedToday}
                          >
                            {funbrainStreakLockedToday ? (
                              <>
                                <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                                Streak Survival — Done
                              </>
                            ) : streakLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Flame className="h-4 w-4 shrink-0" />
                                Streak Survival
                              </>
                            )}
                          </button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {funbrainStreakLockedToday
                          ? "You’ve already used today’s Funbrain streak run. Academic streak is separate. Back tomorrow."
                          : "Up to 15 questions · 5 min session · tap Next after each answer (no per-question timer)"}
                      </TooltipContent>
                    </Tooltip>

                    <button
                      type="button"
                      className={cn(
                        "w-full flex items-center justify-center gap-2 rounded-[11px] border py-3 text-[13px] font-semibold mb-1.5",
                        funbrainDoseLocked
                          ? "border-emerald-300/50 text-emerald-700 bg-emerald-500/8 cursor-default opacity-90 dark:border-emerald-500/25 dark:text-emerald-400"
                          : cn(
                              "border-zinc-200 bg-zinc-100/50 text-zinc-700 hover:bg-zinc-100",
                              "dark:border-white/[0.11] dark:bg-white/[0.06] dark:text-[#f0f0ff]/70 dark:hover:bg-white/10"
                            )
                      )}
                      onClick={() => !funbrainDoseLocked && checkGauntletAndStart("funbrain")}
                      disabled={streakLoading || gauntletLoading || funbrainDoseLocked}
                    >
                      {funbrainDoseLocked ? (
                        <>
                          <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                          DailyDose — Done
                        </>
                      ) : gauntletLoading && selectedDomain === "funbrain" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Trophy className="h-4 w-4 opacity-80" />
                          DailyDose — all modes
                        </>
                      )}
                    </button>

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-1.5 text-[10px] text-zinc-400 dark:text-[#f0f0ff]/30">
                      <span>
                        {isPlayAdmin
                          ? "DailyDose 20s/Q · ranked · Streak 15 Q/5 min · manual Next · unlimited (admin)"
                          : "DailyDose 20s/Q · ranked · Streak 15 Q/5 min · Next to advance · 1 run each/day"}
                      </span>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 inline-flex items-center gap-0.5 hover:underline"
                        onClick={async () => {
                          setSelectedDomain("funbrain");
                          setGauntletAlreadyPlayed(funbrainDoseLocked);
                          setView("gauntlet_result");
                          const today = todayDate();
                          setLeaderboardLoading(true);
                          const { data } = await supabase.rpc("get_daily_gauntlet_leaderboard", {
                            p_gauntlet_date: today,
                            p_domain: "funbrain",
                          });
                          const rows =
                            (data as {
                              rank: number;
                              user_id?: string;
                              display_name: string | null;
                              correct_count: number;
                              total_time_ms: number;
                            }[]) || [];
                          setLeaderboard(rows);
                          setLeaderboardLoading(false);
                          const myRow = rows.find((r) => r.user_id === user?.id);
                          if (myRow) setGauntletSubmitted({ correct_count: myRow.correct_count, total_time_ms: myRow.total_time_ms });
                        }}
                      >
                        Leaderboard <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  </div>
                </div>

                <Dialog
                  open={playSessionOpen}
                  onOpenChange={(open) => {
                    if (!open) backToDashboard();
                  }}
                >
                  <DialogContent
                    className={cn(
                      "left-1/2 top-[46%] w-[min(100%,calc(100vw-1.25rem))] max-w-3xl translate-x-[-50%] translate-y-[-50%]",
                      "h-auto max-h-[min(85vh,820px)] overflow-y-auto overflow-x-hidden p-0 pt-4 pb-3 gap-0 sm:rounded-2xl content-start",
                      "border border-zinc-200/90 bg-zinc-50 shadow-2xl dark:border-white/[0.12] dark:bg-[#22222c]",
                      "[&>button:last-child]:hidden"
                    )}
                  >
                    <DialogTitle className="sr-only">Play session</DialogTitle>
                {/* Inline arena — centered compact modal (not full viewport width) */}
                {view === "streak" && (() => {
                  const ttl = selectedDomain === "funbrain" ? "Funbrain Forge" : "Academic Arena";
                  const accentFill = selectedDomain === "funbrain" ? "bg-orange-500" : "bg-indigo-600";
                  const streakSessionPct =
                    GAUNTLET_SESSION_SEC > 0 ? Math.round((streakSessionLeft / GAUNTLET_SESSION_SEC) * 100) : 100;
                  const sessionFillClass = streakSessionLeft <= 30 ? "bg-red-500" : accentFill;
                  const badgeLabel = topicLabelForQuestionCategory(selectedDomain, streakQuestion?.category);
                  const qLabel =
                    streakQuestion != null
                      ? `Q ${streakRoundIndex + 1}/${Math.max(1, streakSessionQuestionCount)}`
                      : "Q —";
                  return (
                    <div className="px-3 pb-3 sm:px-[14px] sm:pb-[14px]">
                      <div
                        className={cn(
                          "rounded-[17px] border p-3 sm:p-4",
                          "bg-white border-zinc-200/90 shadow-sm",
                          "dark:bg-[#222833]/90 dark:border-white/[0.1]"
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2 gap-y-2 border-b border-zinc-200/80 dark:border-white/[0.08] pb-2.5 mb-2.5">
                          <div className="text-[13px] sm:text-[15px] font-extrabold text-zinc-900 dark:text-[#f0f0ff]">{ttl}</div>
                          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[11px] sm:text-xs font-semibold text-zinc-600 dark:text-[#f0f0ff]/70">
                            <span className="tabular-nums">Session · {streakCount} correct</span>
                            <span
                              className={cn(
                                "font-mono tabular-nums",
                                streakSessionLeft <= 30 ? "text-red-500" : "text-orange-500 dark:text-orange-400"
                              )}
                            >
                              {formatClock(streakSessionLeft)}
                            </span>
                            <span className="tabular-nums text-zinc-500 dark:text-[#f0f0ff]/45">{qLabel}</span>
                            <button
                              type="button"
                              onClick={backToDashboard}
                              className="rounded-lg border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-200 dark:border-white/15 dark:bg-white/10 dark:text-[#f0f0ff] dark:hover:bg-white/15"
                            >
                              Exit
                            </button>
                          </div>
                        </div>
                        <div className="mb-2.5">
                          <div>
                            <div className="mb-1 flex items-center justify-between gap-2 text-[9px] uppercase tracking-wider text-zinc-400 dark:text-[#f0f0ff]/35">
                              <span>
                                Session (5 min · up to {Math.max(1, streakSessionQuestionCount)} Q)
                              </span>
                              <span className="font-mono normal-case tracking-normal tabular-nums text-zinc-500 dark:text-[#f0f0ff]/45">
                                {formatClock(streakSessionLeft)}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-white/[0.08] overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-[width] duration-300", sessionFillClass)}
                                style={{ width: `${streakSessionPct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        {streakLoading && !streakQuestion && (
                          <div className="flex justify-center py-14">
                            <Loader2 className="w-9 h-9 animate-spin text-zinc-400" />
                          </div>
                        )}
                        {!streakLoading && !streakQuestion && (
                          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-white/10 dark:bg-white/[0.04]">
                            <p className="text-sm text-zinc-600 dark:text-[#f0f0ff]/55 mb-3">
                              {selectedDomain === "funbrain"
                                ? "No Funbrain questions left for this Streak Survival cycle. DailyDose uses a different pool tag, so finishing DailyDose alone should not empty this list. If you still see this, you’ve cleared the streak bank since the last reset — add more questions or wait for the cycle to roll."
                                : "No Academic questions left for this Streak Survival cycle. DailyDose uses a different pool tag, so finishing DailyDose alone should not empty this list. If you still see this, you’ve cleared the streak bank since the last reset — add more questions or wait for the cycle to roll."}
                            </p>
                            <Button className="rounded-xl font-semibold" onClick={backToDashboard}>
                              Close
                            </Button>
                          </div>
                        )}
                        {streakQuestion && (
                          <>
                            <div className="mb-2 flex flex-wrap gap-1.5">
                              <span
                                className={cn(
                                  "inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold",
                                  selectedDomain === "funbrain"
                                    ? "border-orange-500/35 text-orange-600 bg-orange-500/10 dark:text-orange-300"
                                    : "border-indigo-500/35 text-indigo-700 bg-indigo-500/10 dark:text-indigo-300"
                                )}
                              >
                                {badgeLabel}
                              </span>
                              {streakQuestion.category !== "mental_math" && (
                                <span className="text-[10px] font-semibold text-zinc-500 dark:text-[#f0f0ff]/40">
                                  Score: {streakCount * 10} · Next when you are ready
                                </span>
                              )}
                              {streakQuestion.category === "mental_math" && (
                                <span className="text-[10px] font-semibold text-zinc-500 dark:text-[#f0f0ff]/40">
                                  No per-question timer · full bank cycles when you finish all
                                </span>
                              )}
                            </div>
                            <PlayQuestionCard
                              question={streakQuestion}
                              onAnswer={handleStreakAnswer}
                              onNext={handleStreakNext}
                              timerSeconds={0}
                              showExplanation={true}
                              hideInlineTimer
                              optionLayout="grid"
                              disableAutoAdvance
                            />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {view === "streak_gameover" && (() => {
                  const score = streakCount * 10;
                  const mentalRound = streakGameoverMentalMath;
                  const headline =
                    streakExitReason === "complete"
                      ? "Session complete"
                      : streakExitReason === "time"
                        ? "Time's up"
                        : "Session ended";
                  const encouragement =
                    streakExitReason === "complete"
                      ? "Come back tomorrow for another streak run."
                      : streakCount === 0
                        ? "Tough round. Every expert started somewhere."
                        : streakCount <= 2
                          ? "Nice start! Try again to beat it."
                          : streakCount <= 5
                            ? "Solid run. You're getting the hang of it."
                            : "Impressive. That took real focus.";
                  const nearMiss =
                    streakExitReason !== "complete" && streakCount > 0
                      ? `1 more correct and you'd have hit ${streakCount + 1}!`
                      : null;
                  return (
                    <div className="px-3 pb-3 sm:px-[14px] sm:pb-[14px]">
                      <div
                        className={cn(
                          "rounded-[17px] border p-5 text-center",
                          "bg-white border-zinc-200/90 dark:bg-[#252530] dark:border-white/[0.1]"
                        )}
                      >
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-[#f0f0ff] mb-3">{headline}</h2>
                        {!mentalRound && (
                          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">{score} pts</p>
                        )}
                        {mentalRound && (
                          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                            {streakCount} correct this run
                          </p>
                        )}
                        <p className="text-xs text-zinc-500 dark:text-[#f0f0ff]/45 mb-2">
                          {streakCount} correct
                          {streakExitReason === "time" ? " · 5 minute session ended" : ""}
                          {streakExitReason === "complete"
                            ? ` · all ${Math.max(1, streakSessionQuestionCount)} questions done`
                            : ""}
                          {mentalRound ? " · Mental Math bank is separate from your Funbrain rating" : ""}
                        </p>
                        {nearMiss && (
                          <p className="text-[11px] text-zinc-500 dark:text-[#f0f0ff]/40 italic mb-3">So close — {nearMiss}</p>
                        )}
                        <p className="text-sm text-zinc-600 dark:text-[#f0f0ff]/65 mb-4">{encouragement}</p>
                        <Button className="rounded-xl font-semibold" onClick={backToDashboard}>
                          Back to arena
                        </Button>
                      </div>
                    </div>
                  );
                })()}

                {view === "gauntlet" && gauntletQuestions.length > 0 && (() => {
                  const ttl = selectedDomain === "funbrain" ? "Funbrain Forge" : "Academic Arena";
                  const accentFill = selectedDomain === "funbrain" ? "bg-orange-500" : "bg-indigo-600";
                  const tot = gauntletQuestions.length;
                  const idx = gauntletIndex;
                  const ptsEach = selectedDomain === "funbrain" ? 20 : 10;
                  const sc = gauntletResults.filter((r) => r.is_correct).length * ptsEach;
                  const sessionPct = Math.round((gauntletSessionLeft / GAUNTLET_SESSION_SEC) * 100);
                  const qPct = Math.round((gauntletQTimeLeft / GAUNTLET_Q_SEC) * 100);
                  const qFillClass =
                    gauntletQTimeLeft <= 5
                      ? "bg-red-500"
                      : selectedDomain === "funbrain"
                        ? "bg-sky-500 dark:bg-sky-400"
                        : "bg-emerald-500 dark:bg-emerald-400";
                  return (
                    <div className="px-3 pb-3 sm:px-[14px] sm:pb-[14px]">
                      <div
                        className={cn(
                          "rounded-[17px] border p-3 sm:p-4",
                          "bg-white border-zinc-200/90 shadow-sm",
                          "dark:bg-[#222833]/90 dark:border-white/[0.1]"
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-200/80 dark:border-white/[0.08] pb-2.5 mb-2.5">
                          <div className="text-[13px] sm:text-[15px] font-extrabold text-zinc-900 dark:text-[#f0f0ff]">{ttl} · DailyDose</div>
                          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[11px] sm:text-xs font-semibold text-zinc-600 dark:text-[#f0f0ff]/70">
                            <span className="tabular-nums">
                              Q {idx + 1} of {tot}
                            </span>
                            <span className="tabular-nums">Score: {sc}</span>
                            <span
                              className={cn(
                                "font-mono tabular-nums",
                                gauntletSessionLeft <= 30 ? "text-red-500" : "text-orange-500 dark:text-orange-400"
                              )}
                            >
                              {formatClock(gauntletSessionLeft)}
                            </span>
                            <button
                              type="button"
                              onClick={backToDashboard}
                              className="rounded-lg border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-200 dark:border-white/15 dark:bg-white/10 dark:text-[#f0f0ff] dark:hover:bg-white/15"
                            >
                              Exit
                            </button>
                          </div>
                        </div>
                        {/* Two meters with labels + spacing so they read as session vs question, not one double line. */}
                        <div className="mb-2.5 space-y-2.5">
                          <div>
                            <div className="mb-1 flex items-center justify-between gap-2 text-[9px] uppercase tracking-wider text-zinc-400 dark:text-[#f0f0ff]/35">
                              <span>Session</span>
                              <span className="font-mono normal-case tracking-normal tabular-nums text-zinc-500 dark:text-[#f0f0ff]/45">
                                {formatClock(gauntletSessionLeft)}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-white/[0.08] overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-[width] duration-300", accentFill)}
                                style={{ width: `${sessionPct}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="mb-1 flex items-center justify-between gap-2 text-[9px] uppercase tracking-wider text-zinc-400 dark:text-[#f0f0ff]/35">
                              <span>This question</span>
                              <span className="font-mono normal-case tracking-normal tabular-nums text-zinc-500 dark:text-[#f0f0ff]/45">
                                {gauntletQTimeLeft}s
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-white/[0.08] overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-[width] duration-300", qFillClass)}
                                style={{ width: `${qPct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        {gauntletQuestions[gauntletIndex] && (
                          <PlayQuestionCard
                            question={gauntletQuestions[gauntletIndex]!}
                            onAnswer={handleGauntletAnswer}
                            onNext={
                              !currentGauntletFinished
                                ? () => setGauntletIndex((i) => i + 1)
                                : () => submitGauntlet(gauntletResultsRef.current)
                            }
                            timerSeconds={GAUNTLET_Q_SEC}
                            onTimeout={handleGauntletTimeout}
                            onTimerTick={setGauntletQTimeLeft}
                            hideInlineTimer
                            showExplanation={true}
                            optionLayout="grid"
                          />
                        )}
                      </div>
                    </div>
                  );
                })()}

                {view === "gauntlet_result" && (
                  <div className="px-3 pb-3 sm:px-[14px] sm:pb-[14px]">
                    <div className="max-w-2xl mx-auto">
                      <Button variant="ghost" size="sm" onClick={backToDashboard} className="rounded-xl mb-4 -ml-1 h-8 text-xs">
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back to arena
                      </Button>
                      {gauntletAlreadyPlayed && !gauntletSubmitted && (
                        <p className="text-sm text-zinc-500 dark:text-[#f0f0ff]/50 mb-3">You already played today. See leaderboard below.</p>
                      )}
                      {gauntletSubmitted && (
                        <div className="edu-card mb-4 rounded-2xl border-2 border-emerald-500/25 bg-emerald-500/5 p-4 dark:border-emerald-500/20">
                          <h3 className="text-base font-bold text-zinc-900 dark:text-[#f0f0ff] mb-1">Today&apos;s result</h3>
                          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            {gauntletSubmitted.correct_count}/{gauntletQuestions.length || 10} correct
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-[#f0f0ff]/45 flex items-center gap-1 mt-1">
                            <Clock className="w-3.5 h-3.5" /> {(gauntletSubmitted.total_time_ms / 1000).toFixed(1)}s total
                          </p>
                        </div>
                      )}
                      <h3 className="text-base font-bold text-zinc-900 dark:text-[#f0f0ff] mb-2">Daily Gauntlet leaderboard</h3>
                      {leaderboardLoading ? (
                        <Loader2 className="w-7 h-7 animate-spin text-zinc-400" />
                      ) : (
                        <ul className="space-y-2">
                          {leaderboard.length === 0 && gauntletSubmitted && (
                            <li className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.04] ring-2 ring-indigo-500/30">
                              <span className="font-bold w-7 text-amber-600 text-sm">#1</span>
                              <span className="font-semibold flex-1 truncate mx-2 flex items-center gap-2 text-sm">
                                You
                                <span className="text-[9px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">YOU</span>
                              </span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                                {gauntletSubmitted.correct_count}/{gauntletQuestions.length || 10}
                              </span>
                              <span className="text-xs text-zinc-500 tabular-nums ml-2">
                                {(gauntletSubmitted.total_time_ms / 1000).toFixed(1)}s
                              </span>
                            </li>
                          )}
                          {leaderboard.slice(0, 10).map((row, i) => {
                            const isMe = row.user_id === user?.id;
                            const denom = gauntletQuestions.length || 10;
                            return (
                              <li
                                key={i}
                                className={cn(
                                  "flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm",
                                  "border-zinc-200 bg-white dark:border-white/10 dark:bg-[#252530]/80",
                                  isMe && "ring-2 ring-indigo-500/30",
                                  !isMe && row.rank <= 3 && "ring-1 ring-amber-400/25 bg-amber-50/80 dark:bg-amber-950/20"
                                )}
                              >
                                <span
                                  className={cn(
                                    "font-bold w-7",
                                    row.rank <= 3 ? "text-amber-600 dark:text-amber-400" : "text-zinc-400"
                                  )}
                                >
                                  #{row.rank}
                                </span>
                                <span className="font-medium flex-1 truncate mx-2 flex items-center gap-2">
                                  {row.display_name ?? "Anonymous"}
                                  {isMe && (
                                    <span className="text-[9px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">YOU</span>
                                  )}
                                </span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{row.correct_count}/{denom}</span>
                                <span className="text-xs text-zinc-500 tabular-nums ml-2">{(row.total_time_ms / 1000).toFixed(1)}s</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {leaderboard.length === 0 && !leaderboardLoading && !gauntletSubmitted && (
                        <div className="text-sm text-zinc-500 dark:text-[#f0f0ff]/45">
                          {gauntletLoadFailed ? (
                            <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-3 dark:border-amber-500/25 dark:bg-amber-950/25">
                              <p className="text-zinc-800 dark:text-[#f0f0ff]/80 mb-2">
                                DailyDose could not load questions (session or network). Try again, or refresh the page.
                              </p>
                              <Button
                                className="rounded-xl font-semibold"
                                onClick={() => {
                                  const d = selectedDomain ?? "funbrain";
                                  void checkGauntletAndStart(d);
                                }}
                              >
                                Retry DailyDose
                              </Button>
                            </div>
                          ) : (
                            <p>No attempts yet today.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                  </DialogContent>
                </Dialog>
          </motion.div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <ProtectedRoute>
          <AppLayout>
            <div className="flex min-h-[50vh] items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-violet-500" aria-hidden />
            </div>
          </AppLayout>
        </ProtectedRoute>
      }
    >
      <PlayPageContent />
    </Suspense>
  );
}
