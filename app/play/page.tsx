"use client";

import { Suspense, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useStreakTimer } from "@/hooks/useStreakTimer";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import PlayQuestionCard from "@/components/PlayQuestionCard";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import type { PlayQuestionRow, PlayDomain, AcademicCategory, FunbrainCategory } from "@/types";
import {
  Flame,
  Trophy,
  Zap,
  ArrowLeft,
  Loader2,
  Clock,
  Target,
  Medal,
  ChevronRight,
  GraduationCap,
  Crosshair,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { bumpUserStudyDayMs } from "@/lib/studyDayBump";

/** PCM only — matches Gyan++ / investor spec. */
const PCM_CATEGORIES: { id: AcademicCategory; label: string }[] = [
  { id: "physics", label: "Physics" },
  { id: "chemistry", label: "Chemistry" },
  { id: "math", label: "Mathematics" },
];

const PCM_POOL: AcademicCategory[] = ["physics", "chemistry", "math"];

const FUNBRAIN_BACKEND_IDS: FunbrainCategory[] = ["puzzles", "verbal", "quantitative", "analytical"];

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
  { pillKey: "gk", id: "analytical", label: "GK", pillClass: "border-emerald-400/45 text-emerald-700 bg-emerald-500/10 dark:text-emerald-300 dark:bg-emerald-500/10" },
  { pillKey: "mental_math", id: "quantitative", label: "Mental Math", pillClass: "border-red-400/45 text-red-700 bg-red-500/10 dark:text-red-300 dark:bg-red-500/10" },
];

const RATING_TO_RANK = (rating: number) => {
  if (rating < 400) return { label: "Bronze", color: "text-amber-700", bg: "bg-amber-100 dark:bg-amber-900/30", progress: (rating / 400) * 100 };
  if (rating < 700) return { label: "Silver", color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800/50", progress: ((rating - 400) / 300) * 100 };
  return { label: "Gold", color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20", progress: Math.min(100, ((rating - 700) / 300) * 100) };
};
const RATING_TO_NEXT = (rating: number) => {
  if (rating < 400) return { next: "Silver", at: 400, progress: (rating / 400) * 100 };
  if (rating < 700) return { next: "Gold", at: 700, progress: ((rating - 400) / 300) * 100 };
  return { next: null, at: 1000, progress: 100 };
};

type View = "dashboard" | "streak" | "gauntlet" | "gauntlet_result" | "streak_gameover";

function PlayPageContent() {
  const { user, profile } = useAuth();
  const searchParams = useSearchParams();
  const streakTimer = useStreakTimer();

  const [view, setView] = useState<View>("dashboard");
  const [userStats, setUserStats] = useState<{ category: string; current_rating: number; win_streak?: number }[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState<PlayDomain | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  /** Distinguishes GK vs Analytical (both map to `analytical` RPC). */
  const [funbrainPillKey, setFunbrainPillKey] = useState<string>("verbal");

  // Streak Survival
  const [streakQuestion, setStreakQuestion] = useState<PlayQuestionRow | null>(null);
  const [streakLoading, setStreakLoading] = useState(false);
  const [strikes, setStrikes] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const strikesRef = useRef(0);
  useEffect(() => { strikesRef.current = strikes; }, [strikes]);
  const STREAK_MAX_STRIKES = 3;
  const STREAK_TIMER_SEC = 5;
  /** Investor mock: 5 min session, 20s per question (DailyDose). */
  const GAUNTLET_SESSION_SEC = 300;
  const GAUNTLET_Q_SEC = 20;
  const [streakQTimeLeft, setStreakQTimeLeft] = useState(STREAK_TIMER_SEC);

  useEffect(() => {
    if (view === "streak" && streakQuestion) setStreakQTimeLeft(STREAK_TIMER_SEC);
  }, [streakQuestion?.id, view]);

  const formatClock = (sec: number) =>
    `${String(Math.floor(Math.max(0, sec) / 60)).padStart(2, "0")}:${String(Math.max(0, sec) % 60).padStart(2, "0")}`;

  // Daily Gauntlet
  const [gauntletQuestions, setGauntletQuestions] = useState<PlayQuestionRow[]>([]);
  const [gauntletIndex, setGauntletIndex] = useState(0);
  const [gauntletResults, setGauntletResults] = useState<{ question_id: string; is_correct: boolean; time_taken_ms: number }[]>([]);
  const gauntletResultsRef = useRef<{ question_id: string; is_correct: boolean; time_taken_ms: number }[]>([]);
  useEffect(() => { gauntletResultsRef.current = gauntletResults; }, [gauntletResults]);
  const [gauntletLoading, setGauntletLoading] = useState(false);
  const [gauntletSubmitted, setGauntletSubmitted] = useState<{ correct_count: number; total_time_ms: number } | null>(null);
  const [gauntletAlreadyPlayed, setGauntletAlreadyPlayed] = useState(false);
  const [gauntletPlayedToday, setGauntletPlayedToday] = useState<{ academic: boolean; funbrain: boolean }>({ academic: false, funbrain: false });
  const [leaderboard, setLeaderboard] = useState<{ rank: number; user_id?: string; display_name: string | null; correct_count: number; total_time_ms: number }[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [gauntletSessionLeft, setGauntletSessionLeft] = useState(GAUNTLET_SESSION_SEC);
  const [gauntletQTimeLeft, setGauntletQTimeLeft] = useState(GAUNTLET_Q_SEC);
  const gauntletQuestionsRef = useRef(gauntletQuestions);
  const gauntletIndexRef = useRef(gauntletIndex);
  const gauntletSessionEndRef = useRef(false);
  const gauntletSubmitLockRef = useRef(false);
  gauntletQuestionsRef.current = gauntletQuestions;
  gauntletIndexRef.current = gauntletIndex;

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

  const todayDate = () => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  };

  useEffect(() => {
    if (!user?.id || view !== "dashboard") return;
    (async () => {
      const today = todayDate();
      const played = { academic: false, funbrain: false };
      // Check both domains using the leaderboard RPC (bypasses missing table types)
      for (const domain of ["academic", "funbrain"] as PlayDomain[]) {
        const { data } = await supabase.rpc("get_daily_gauntlet_leaderboard", { p_gauntlet_date: today, p_domain: domain });
        const rows = (data as { user_id?: string }[]) || [];
        if (rows.some(r => r.user_id === user.id)) {
          played[domain] = true;
        }
      }
      setGauntletPlayedToday(played);
    })();
  }, [user?.id, view]);

  useEffect(() => {
    if (!user?.id) return;
    const d = searchParams.get("domain");
    if (d === "academic" || d === "funbrain") {
      setSelectedDomain(d);
      setSelectedCategory(d === "academic" ? "physics" : "verbal");
      if (d === "funbrain") setFunbrainPillKey("verbal");
    }
  }, [user?.id, searchParams]);

  useEffect(() => {
    if (view !== "dashboard" || !user) return;
    const d = searchParams.get("domain");
    if (d === "academic" || d === "funbrain") return;
    if (selectedDomain === null && selectedCategory === null) {
      setSelectedDomain("academic");
      setSelectedCategory("physics");
    }
  }, [view, user, selectedDomain, selectedCategory, searchParams]);

  const getRatingForCategory = (category: string) =>
    userStats.find((s) => s.category === category)?.current_rating ?? 1000;
  const logicRating = useMemo(() => {
    const rows = userStats.filter((s) => FUNBRAIN_BACKEND_IDS.includes(s.category as FunbrainCategory));
    if (rows.length === 0) return 1000;
    return rows.reduce((acc, s) => acc + s.current_rating, 0) / rows.length;
  }, [userStats]);
  const maxPlayWinStreak = useMemo(
    () => userStats.reduce((m, s) => Math.max(m, s.win_streak ?? 0), 0),
    [userStats]
  );

  const fetchOneAdaptive = useCallback(
    async (domain: PlayDomain, category: string) => {
      if (!user?.id) return null;
      setStreakLoading(true);
      const { data, error } = await supabase.rpc("get_adaptive_play_questions", {
        p_domain: domain,
        p_category: category === "mixed" ? "physics" : category,
        p_count: 1,
      });
      setStreakLoading(false);
      if (error || !data || (data as unknown[]).length === 0) return null;
      const row = (data as unknown[])[0] as PlayQuestionRow;
      return row;
    },
    [user?.id]
  );

  const startStreak = async (domain: PlayDomain, category: string) => {
    setSelectedDomain(domain);
    setSelectedCategory(category);
    setView("streak");
    setStrikes(0);
    setStreakCount(0);
    if (category === "mixed") {
      const cat = PCM_POOL[Math.floor(Math.random() * PCM_POOL.length)]!;
      const q = await fetchOneAdaptive("academic", cat);
      setStreakQuestion(q ?? null);
      return;
    }
    const q = await fetchOneAdaptive(domain, category);
    setStreakQuestion(q ?? null);
  };

  const handleStreakAnswer = async (selectedIndex: number, timeTakenMs: number) => {
    if (!streakQuestion || !selectedCategory || !selectedDomain) return;
    const isCorrect = selectedIndex === streakQuestion.correct_answer_index;
    await supabase.rpc("record_play_result", {
      p_question_id: streakQuestion.id,
      p_is_correct: isCorrect,
      p_time_taken_ms: timeTakenMs,
      p_category: null,
    });
    void bumpUserStudyDayMs(timeTakenMs);
    if (isCorrect) {
      setStreakCount((c) => c + 1);
      const next = selectedCategory === "mixed"
        ? await fetchOneAdaptive("academic", PCM_POOL[Math.floor(Math.random() * PCM_POOL.length)]!)
        : await fetchOneAdaptive(selectedDomain, selectedCategory);
      setStreakQuestion(next ?? null);
    } else {
      const newStrikes = strikes + 1;
      setStrikes(newStrikes);
      if (newStrikes >= STREAK_MAX_STRIKES) {
        setView("streak_gameover");
        return;
      }
      const next = selectedCategory === "mixed"
        ? await fetchOneAdaptive("academic", PCM_POOL[Math.floor(Math.random() * PCM_POOL.length)]!)
        : await fetchOneAdaptive(selectedDomain, selectedCategory);
      setStreakQuestion(next ?? null);
    }
  };

  const handleStreakTimeout = useCallback(async () => {
    if (!streakQuestion || !selectedCategory || !selectedDomain) return;
    await supabase.rpc("record_play_result", {
      p_question_id: streakQuestion.id,
      p_is_correct: false,
      p_time_taken_ms: STREAK_TIMER_SEC * 1000,
      p_category: null,
    });
    void bumpUserStudyDayMs(STREAK_TIMER_SEC * 1000);
    const newStrikes = strikesRef.current + 1;
    setStrikes(newStrikes);
    if (newStrikes >= STREAK_MAX_STRIKES) {
      setView("streak_gameover");
      setStreakQuestion(null);
      return;
    }
    const next = selectedCategory === "mixed"
      ? await fetchOneAdaptive("academic", PCM_POOL[Math.floor(Math.random() * PCM_POOL.length)]!)
      : await fetchOneAdaptive(selectedDomain, selectedCategory);
    setStreakQuestion(next ?? null);
  }, [streakQuestion, selectedCategory, selectedDomain, fetchOneAdaptive]);

  const checkGauntletAndStart = async (domain: PlayDomain) => {
    if (!user?.id) return;
    setSelectedDomain(domain);
    setSelectedCategory(null);
    setGauntletLoading(true);
    const today = todayDate();
    // Check if already played using the leaderboard RPC
    const { data: lb } = await supabase.rpc("get_daily_gauntlet_leaderboard", { p_gauntlet_date: today, p_domain: domain });
    const lbRows = (lb as { user_id?: string; correct_count: number; total_time_ms: number; rank: number; display_name: string | null }[]) || [];
    const myRow = lbRows.find(r => r.user_id === user.id);
    if (myRow) {
      setGauntletAlreadyPlayed(true);
      setGauntletSubmitted({ correct_count: myRow.correct_count, total_time_ms: myRow.total_time_ms });
      setLeaderboard(lbRows);
      setGauntletLoading(false);
      setView("gauntlet_result");
      return;
    }
    const { data: questions, error } = await supabase.rpc("get_daily_gauntlet_questions", { p_date: today, p_domain: domain });
    setGauntletLoading(false);
    if (error || !questions || (questions as unknown[]).length === 0) {
      setGauntletAlreadyPlayed(false);
      setView("gauntlet_result");
      setLeaderboard([]);
      return;
    }
    setGauntletQuestions(questions as unknown as PlayQuestionRow[]);
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

      const localCorrect = results.filter((r) => r.is_correct).length;
      const localTimeMs = results.reduce((acc, r) => acc + r.time_taken_ms, 0);
      setGauntletSubmitted({ correct_count: localCorrect, total_time_ms: localTimeMs });
      setView("gauntlet_result");
      fetchLeaderboard(today, currentDomain);

      await supabase.rpc("submit_daily_gauntlet", {
        p_gauntlet_date: today,
        p_results: results,
        p_domain: currentDomain,
      });
      void bumpUserStudyDayMs(localTimeMs);
    },
    [selectedDomain]
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
    if (view === "gauntlet" && gauntletQuestions.length > 0) {
      setGauntletQTimeLeft(GAUNTLET_Q_SEC);
    }
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
    setView("dashboard");
    setStreakQuestion(null);
    setGauntletQuestions([]);
    setGauntletSubmitted(null);
    setGauntletAlreadyPlayed(false);
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

  const academicClockSec = academicLiveGauntlet ? gauntletSessionLeft : academicLiveStreak ? streakQTimeLeft : null;
  const funbrainClockSec = funbrainLiveGauntlet ? gauntletSessionLeft : funbrainLiveStreak ? streakQTimeLeft : null;

  const academicClockWarn =
    academicClockSec !== null &&
    (academicLiveGauntlet ? academicClockSec <= 30 : academicClockSec <= 2);
  const funbrainClockWarn =
    funbrainClockSec !== null &&
    (funbrainLiveGauntlet ? funbrainClockSec <= 30 : funbrainClockSec <= 2);

  const academicBarPct = academicLiveGauntlet
    ? Math.round((gauntletSessionLeft / GAUNTLET_SESSION_SEC) * 100)
    : academicLiveStreak
      ? Math.round((streakQTimeLeft / STREAK_TIMER_SEC) * 100)
      : 100;
  const funbrainBarPct = funbrainLiveGauntlet
    ? Math.round((gauntletSessionLeft / GAUNTLET_SESSION_SEC) * 100)
    : funbrainLiveStreak
      ? Math.round((streakQTimeLeft / STREAK_TIMER_SEC) * 100)
      : 100;

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
              "dark:bg-[#0d0d1a] dark:border-white/[0.07]"
            )}
          >
                {/* Top bar — investor v3.1 */}
                <div
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 px-4 sm:px-[18px] py-3 border-b",
                    "border-zinc-200/90 bg-zinc-50/95",
                    "dark:border-white/[0.07] dark:bg-[#0d0d1a]"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-indigo-600">
                      <Crosshair className="h-5 w-5 text-white" strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-[#f0f0ff]">Play</h1>
                      <p className="text-[11px] text-zinc-500 dark:text-[#f0f0ff]/40 leading-snug">
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
                  {(view === "streak" || view === "gauntlet") && (
                    <div
                      className="absolute inset-0 z-10 rounded-b-[inherit] bg-zinc-900/20 dark:bg-black/35 pointer-events-auto"
                      aria-hidden
                    />
                  )}
                  <div className="relative z-0 grid md:grid-cols-2 gap-3">
                  {/* Academic Arena */}
                  <div
                    className={cn(
                      "rounded-[17px] border p-[18px]",
                      "bg-white border-zinc-200/90 shadow-sm",
                      "dark:bg-[#141428] dark:border-white/[0.08] dark:shadow-none"
                    )}
                  >
                    <div className="flex gap-3 mb-3.5">
                      <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-indigo-500/15 dark:bg-indigo-500/18">
                        <GraduationCap className="h-[19px] w-[19px] text-indigo-600 dark:text-indigo-400" strokeWidth={1.8} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-[17px] font-bold leading-tight text-zinc-900 dark:text-[#f0f0ff]">Academic Arena</h2>
                        <p className="text-[11px] text-zinc-500 dark:text-[#f0f0ff]/38 mt-0.5">
                          CBSE/JEE Board MCQs · Physics + Chemistry + Maths · 15 Qs · 5 min
                        </p>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[11px] font-bold mb-3",
                        "border-red-300/50 text-red-600 bg-red-500/8",
                        "dark:border-red-500/25 dark:text-red-400 dark:bg-red-500/10"
                      )}
                    >
                      <Zap className="h-3 w-3 shrink-0" />
                      Advanced difficulty — 50% harder · 5 min total · 20s/Q
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {PCM_CATEGORIES.map((c) => {
                        const isSelected = selectedDomain === "academic" && selectedCategory === c.id;
                        const spill =
                          c.id === "physics"
                            ? "border-indigo-400/50 text-indigo-700 bg-indigo-500/10 dark:text-indigo-300 dark:bg-indigo-500/12"
                            : c.id === "chemistry"
                              ? "border-red-400/50 text-red-700 bg-red-500/10 dark:text-red-300 dark:bg-red-500/10"
                              : "border-amber-400/50 text-amber-800 bg-amber-500/10 dark:text-amber-300 dark:bg-amber-400/10";
                        const rating = getRatingForCategory(c.id);
                        const rank = RATING_TO_RANK(rating);
                        const nextTier = RATING_TO_NEXT(rating);
                        return (
                          <Tooltip key={c.id}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                disabled={streakLoading}
                                onClick={() => {
                                  setSelectedDomain("academic");
                                  setSelectedCategory(c.id);
                                }}
                                className={cn(
                                  "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all",
                                  spill,
                                  isSelected && "ring-2 ring-indigo-500/40 ring-offset-2 ring-offset-white dark:ring-offset-[#141428]"
                                )}
                              >
                                {c.label}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[220px]">
                              {nextTier.next ? `Progress to ${nextTier.next}: ${nextTier.progress.toFixed(0)}%` : "Master rank"} · {rank.label}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>

                    <div
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-2 rounded-[11px] border px-3 py-2.5 mb-3",
                        "bg-zinc-100/80 border-zinc-200/80",
                        "dark:bg-white/[0.05] dark:border-white/[0.09]"
                      )}
                    >
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-zinc-400 dark:text-[#f0f0ff]/30 mb-0.5">Session timer</div>
                        <div
                          className={cn(
                            "font-mono text-[22px] font-bold tabular-nums",
                            academicClockWarn ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-[#f0f0ff]"
                          )}
                        >
                          {academicClockSec !== null ? formatClock(academicClockSec) : "05:00"}
                        </div>
                      </div>
                      <div className="text-right min-w-[140px] flex-1">
                        <div className="text-[11px] text-zinc-500 dark:text-[#f0f0ff]/40">
                          {academicLiveGauntlet && gauntletTotalQ > 0
                            ? `${gauntletTotalQ} questions · 5 min session`
                            : "15 questions · 5 min total"}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-[#f0f0ff]/40 mt-0.5">
                          {academicLiveGauntlet
                            ? `${gauntletQTimeLeft}s · this question`
                            : academicLiveStreak
                              ? `${STREAK_TIMER_SEC}s · streak (this question)`
                              : "~20 seconds per question"}
                        </div>
                        <div className="h-[3px] rounded-full bg-zinc-200 dark:bg-white/[0.07] mt-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-600 transition-[width] duration-300"
                            style={{ width: `${academicBarPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "w-full flex items-center justify-center gap-2 rounded-[11px] py-3 text-[13px] font-bold mb-2",
                            "bg-indigo-600 text-white hover:bg-indigo-700",
                            "disabled:opacity-50 disabled:pointer-events-none"
                          )}
                          onClick={() =>
                            selectedDomain === "academic" && selectedCategory && startStreak("academic", selectedCategory)
                          }
                          disabled={selectedDomain !== "academic" || !selectedCategory || streakLoading || gauntletLoading}
                        >
                          {streakLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          Start streak survival
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">5s per question in streak mode · 3 strikes</TooltipContent>
                    </Tooltip>

                    <button
                      type="button"
                      className={cn(
                        "w-full flex items-center justify-center gap-2 rounded-[11px] border py-3 text-[13px] font-semibold mb-1.5 transition-colors",
                        "border-zinc-200 bg-zinc-100/50 text-zinc-700 hover:bg-zinc-100",
                        "dark:border-white/[0.11] dark:bg-white/[0.06] dark:text-[#f0f0ff]/70 dark:hover:bg-white/10",
                        gauntletPlayedToday.academic &&
                          "border-emerald-300/50 text-emerald-700 bg-emerald-500/8 dark:border-emerald-500/25 dark:text-emerald-400"
                      )}
                      onClick={() => checkGauntletAndStart("academic")}
                      disabled={streakLoading || gauntletLoading}
                    >
                      {gauntletLoading && selectedDomain === "academic" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Clock className="h-4 w-4 opacity-80" />
                      )}
                      DailyDose — all subjects
                      {gauntletPlayedToday.academic && (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-[11px] font-bold">
                          <Medal className="h-3 w-3" /> Done
                        </span>
                      )}
                    </button>

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-1.5 text-[10px] text-zinc-400 dark:text-[#f0f0ff]/30">
                      <span>Advanced MCQ · 20s/Q · 3 strikes · 1 attempt/day</span>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-0.5 hover:underline"
                        onClick={async () => {
                          setSelectedDomain("academic");
                          setGauntletAlreadyPlayed(gauntletPlayedToday.academic);
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
                      "dark:bg-[#141428] dark:border-white/[0.08] dark:shadow-none"
                    )}
                  >
                    <div className="flex gap-3 mb-3.5">
                      <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-orange-500/15 dark:bg-orange-500/14">
                        <Flame className="h-[19px] w-[19px] text-orange-600 dark:text-orange-500" strokeWidth={1.8} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-[17px] font-bold leading-tight text-zinc-900 dark:text-[#f0f0ff]">Funbrain Forge</h2>
                        <p className="text-[11px] text-zinc-500 dark:text-[#f0f0ff]/38 mt-0.5">
                          Logic · GK · Puzzles · Verbal · Ages 15-20 · 5 min · 1 free spin/day
                        </p>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[11px] font-bold mb-3",
                        "border-orange-300/50 text-orange-700 bg-orange-500/8",
                        "dark:border-orange-500/28 dark:text-orange-400 dark:bg-orange-500/10"
                      )}
                    >
                      <Target className="h-3 w-3 shrink-0" />
                      Harder puzzles + GK · 5 min total · 20s/Q · 1 free spin
                    </div>

                    <div
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-[11px] border px-3 py-2.5 mb-3",
                        "border-orange-200/80 bg-orange-500/[0.06]",
                        "dark:border-orange-500/18 dark:bg-orange-500/8"
                      )}
                    >
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-zinc-400 dark:text-[#f0f0ff]/30 mb-0.5">Global Rating</div>
                        <div className="text-[26px] font-extrabold tabular-nums text-orange-600 dark:text-orange-500 leading-none tracking-tight">
                          {loadingStats ? "—" : Math.round(logicRating)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] uppercase tracking-wider text-zinc-400 dark:text-[#f0f0ff]/28 mb-0.5">ELO</div>
                        <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Play to climb</div>
                        <div className="text-[11px] text-zinc-500 dark:text-[#f0f0ff]/40">Rank updates live</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {FUNBRAIN_PILLS.map((p) => {
                        const isSelected = selectedDomain === "funbrain" && funbrainPillKey === p.pillKey;
                        return (
                          <button
                            key={p.pillKey}
                            type="button"
                            onClick={() => {
                              setSelectedDomain("funbrain");
                              setFunbrainPillKey(p.pillKey);
                              setSelectedCategory(p.id);
                            }}
                            className={cn(
                              "rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-all",
                              "bg-zinc-100/80 border-zinc-200/80 text-zinc-600",
                              "dark:bg-white/[0.06] dark:border-white/[0.09] dark:text-[#f0f0ff]/55",
                              p.pillClass,
                              isSelected && "ring-2 ring-orange-500/35 ring-offset-2 ring-offset-white dark:ring-offset-[#141428]"
                            )}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>

                    <div
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-2 rounded-[11px] border px-3 py-2.5 mb-3",
                        "bg-zinc-100/80 border-zinc-200/80",
                        "dark:bg-white/[0.05] dark:border-white/[0.09]"
                      )}
                    >
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-zinc-400 dark:text-[#f0f0ff]/30 mb-0.5">Session timer</div>
                        <div
                          className={cn(
                            "font-mono text-[22px] font-bold tabular-nums",
                            funbrainClockWarn ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-[#f0f0ff]"
                          )}
                        >
                          {funbrainClockSec !== null ? formatClock(funbrainClockSec) : "05:00"}
                        </div>
                      </div>
                      <div className="text-right min-w-[140px] flex-1">
                        <div className="text-[11px] text-zinc-500 dark:text-[#f0f0ff]/40">
                          {funbrainLiveGauntlet && gauntletTotalQ > 0
                            ? `${gauntletTotalQ} questions · 5 min session`
                            : "15 questions · 5 min total"}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-[#f0f0ff]/40 mt-0.5">
                          {funbrainLiveGauntlet
                            ? `${gauntletQTimeLeft}s · this question`
                            : funbrainLiveStreak
                              ? `${STREAK_TIMER_SEC}s · streak (this question)`
                              : "~20 seconds per question"}
                        </div>
                        <div className="h-[3px] rounded-full bg-zinc-200 dark:bg-white/[0.07] mt-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-orange-500 transition-[width] duration-300"
                            style={{ width: `${funbrainBarPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-[9px] border px-3 py-2 mb-3",
                        "border-amber-200/80 bg-amber-500/[0.07]",
                        "dark:border-amber-400/18 dark:bg-amber-400/6"
                      )}
                    >
                      <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="text-[11px] text-zinc-600 dark:text-[#f0f0ff]/55 flex-1">
                        {gauntletPlayedToday.funbrain
                          ? "No free spins left today — back tomorrow"
                          : "1 free spin remaining today"}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          "bg-amber-200/80 text-amber-900",
                          "dark:bg-amber-400/18 dark:text-amber-400"
                        )}
                      >
                        {gauntletPlayedToday.funbrain ? "USED" : "FREE"}
                      </span>
                    </div>

                    <button
                      type="button"
                      className={cn(
                        "w-full flex items-center justify-center gap-2 rounded-[11px] py-3 text-[13px] font-bold mb-2",
                        "bg-orange-600 text-white hover:bg-orange-700",
                        "disabled:opacity-50 disabled:pointer-events-none"
                      )}
                      onClick={() =>
                        selectedDomain === "funbrain" && selectedCategory && startStreak("funbrain", selectedCategory)
                      }
                      disabled={selectedDomain !== "funbrain" || !selectedCategory || streakLoading || gauntletLoading}
                    >
                      {streakLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
                      Streak Survival
                    </button>

                    <button
                      type="button"
                      className={cn(
                        "w-full flex items-center justify-center gap-2 rounded-[11px] border py-3 text-[13px] font-semibold mb-1.5",
                        gauntletPlayedToday.funbrain
                          ? "border-emerald-300/50 text-emerald-700 bg-emerald-500/8 cursor-default opacity-90 dark:border-emerald-500/25 dark:text-emerald-400"
                          : cn(
                              "border-zinc-200 bg-zinc-100/50 text-zinc-700 hover:bg-zinc-100",
                              "dark:border-white/[0.11] dark:bg-white/[0.06] dark:text-[#f0f0ff]/70 dark:hover:bg-white/10"
                            )
                      )}
                      onClick={() => !gauntletPlayedToday.funbrain && checkGauntletAndStart("funbrain")}
                      disabled={streakLoading || gauntletLoading || gauntletPlayedToday.funbrain}
                    >
                      {gauntletPlayedToday.funbrain ? (
                        <>
                          <Medal className="h-4 w-4" />
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
                      <span>Advanced · 20s/Q · 1 attempt · Ranked by speed + accuracy</span>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-0.5 hover:underline"
                        onClick={async () => {
                          setSelectedDomain("funbrain");
                          setGauntletAlreadyPlayed(gauntletPlayedToday.funbrain);
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

                {/* Inline arena (investor v3.1 — lobby stays visible above) */}
                {view === "streak" && (() => {
                  const ttl = selectedDomain === "funbrain" ? "Funbrain Forge" : "Academic Arena";
                  const accentFill = selectedDomain === "funbrain" ? "bg-orange-500" : "bg-indigo-600";
                  const sessionPct =
                    STREAK_TIMER_SEC > 0 ? Math.round((streakQTimeLeft / STREAK_TIMER_SEC) * 100) : 100;
                  const qFillClass = streakQTimeLeft <= 2 ? "bg-red-500" : accentFill;
                  const badgeLabel =
                    selectedCategory === "mixed"
                      ? "PCM mix"
                      : PCM_CATEGORIES.find((c) => c.id === selectedCategory)?.label
                      ?? FUNBRAIN_PILLS.find((p) => p.pillKey === funbrainPillKey)?.label
                      ?? "Question";
                  return (
                    <div className="px-3 pb-3 sm:px-[14px] sm:pb-[14px]">
                      <div
                        className={cn(
                          "rounded-[17px] border p-3 sm:p-4",
                          "bg-white border-zinc-200/90 shadow-sm",
                          "dark:bg-[#0A0F24]/90 dark:border-white/[0.1]"
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2 gap-y-2 border-b border-zinc-200/80 dark:border-white/[0.08] pb-2.5 mb-2.5">
                          <div className="text-[13px] sm:text-[15px] font-extrabold text-zinc-900 dark:text-[#f0f0ff]">{ttl}</div>
                          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[11px] sm:text-xs font-semibold text-zinc-600 dark:text-[#f0f0ff]/70">
                            <span className="tabular-nums">Survival · {streakCount} correct</span>
                            <span className="text-red-600 dark:text-red-400 tabular-nums">Strikes {strikes}/{STREAK_MAX_STRIKES}</span>
                            <span className={cn("font-mono tabular-nums", streakQTimeLeft <= 2 ? "text-red-500" : "text-orange-500 dark:text-orange-400")}>
                              {streakQuestion ? formatClock(streakQTimeLeft) : "—:—"}
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
                        {/* Single bar: streak uses one per-question timer (two identical bars looked like a bug). */}
                        <div className="mb-2.5">
                          <div className="mb-1 flex items-center justify-between gap-2 text-[9px] uppercase tracking-wider text-zinc-400 dark:text-[#f0f0ff]/35">
                            <span>Time · this question</span>
                            <span className="font-mono normal-case tracking-normal tabular-nums text-zinc-500 dark:text-[#f0f0ff]/45">
                              {streakQuestion ? `${streakQTimeLeft}s` : "—"}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-white/[0.08] overflow-hidden">
                            <div className={cn("h-full rounded-full transition-[width] duration-300", qFillClass)} style={{ width: `${sessionPct}%` }} />
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
                              No more questions in this category right now. Try another subject or come back later.
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
                              <span className="text-[10px] font-semibold text-zinc-500 dark:text-[#f0f0ff]/40">
                                Score: {streakCount * 10} · {STREAK_TIMER_SEC}s/Q
                              </span>
                            </div>
                            <PlayQuestionCard
                              question={streakQuestion}
                              onAnswer={handleStreakAnswer}
                              onNext={() => {}}
                              timerSeconds={STREAK_TIMER_SEC}
                              onTimeout={handleStreakTimeout}
                              showExplanation={true}
                              onTimerTick={setStreakQTimeLeft}
                              hideInlineTimer
                              optionLayout="grid"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {view === "streak_gameover" && (() => {
                  const score = streakCount * 10;
                  const encouragement =
                    streakCount === 0
                      ? "Tough round. Every expert started somewhere."
                      : streakCount <= 2
                        ? "Nice start! Try again to beat it."
                        : streakCount <= 5
                          ? "Solid run. You're getting the hang of it."
                          : "Impressive. That took real focus.";
                  const nearMiss =
                    streakCount > 0 ? `1 more correct and you'd have hit ${streakCount + 1}!` : null;
                  return (
                    <div className="px-3 pb-3 sm:px-[14px] sm:pb-[14px]">
                      <div
                        className={cn(
                          "rounded-[17px] border p-5 text-center",
                          "bg-white border-zinc-200/90 dark:bg-[#141428] dark:border-white/[0.1]"
                        )}
                      >
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-[#f0f0ff] mb-3">Game over</h2>
                        <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">{score} pts</p>
                        <p className="text-xs text-zinc-500 dark:text-[#f0f0ff]/45 mb-2">
                          {streakCount} correct · {STREAK_MAX_STRIKES} strikes max
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
                          "dark:bg-[#0A0F24]/90 dark:border-white/[0.1]"
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
                                  "border-zinc-200 bg-white dark:border-white/10 dark:bg-[#141428]/80",
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
                        <p className="text-sm text-zinc-500 dark:text-[#f0f0ff]/45">No attempts yet today.</p>
                      )}
                    </div>
                  </div>
                )}
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
