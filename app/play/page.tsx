"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  BookOpen,
  Flame,
  Trophy,
  Zap,
  ArrowLeft,
  Loader2,
  Clock,
  Target,
  Sparkles,
  Medal,
  ChevronRight,
} from "lucide-react";

const ACADEMIC_CATEGORIES: { id: AcademicCategory | "mixed"; label: string }[] = [
  { id: "physics", label: "Physics" },
  { id: "chemistry", label: "Chemistry" },
  { id: "math", label: "Math" },
  { id: "biology", label: "Biology" },
  { id: "cs", label: "CS" },
  { id: "mixed", label: "Grand Trial" },
];

const FUNBRAIN_CATEGORIES: { id: FunbrainCategory; label: string }[] = [
  { id: "puzzles", label: "Puzzles" },
  { id: "verbal", label: "Verbal" },
  { id: "quantitative", label: "Quantitative" },
  { id: "analytical", label: "Analytical" },
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

export default function PlayPage() {
  const { user } = useAuth();
  const streakTimer = useStreakTimer();

  const [view, setView] = useState<View>("dashboard");
  const [userStats, setUserStats] = useState<{ category: string; current_rating: number }[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState<PlayDomain | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Streak Survival
  const [streakQuestion, setStreakQuestion] = useState<PlayQuestionRow | null>(null);
  const [streakLoading, setStreakLoading] = useState(false);
  const [strikes, setStrikes] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const strikesRef = useRef(0);
  useEffect(() => { strikesRef.current = strikes; }, [strikes]);
  const STREAK_MAX_STRIKES = 3;
  const STREAK_TIMER_SEC = 5;

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

  const fetchUserStats = useCallback(async () => {
    if (!user?.id) return;
    setLoadingStats(true);
    const { data } = await supabase.from("user_play_stats").select("category, current_rating").eq("user_id", user.id);
    setUserStats((data as { category: string; current_rating: number }[]) || []);
    setLoadingStats(false);
  }, [user?.id]);

  useEffect(() => {
    fetchUserStats();
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

  const getRatingForCategory = (category: string) =>
    userStats.find((s) => s.category === category)?.current_rating ?? 1000;
  const logicRating = userStats
    .filter((s) => FUNBRAIN_CATEGORIES.some((f) => f.id === s.category))
    .reduce((acc, s) => acc + s.current_rating, 0) / Math.max(1, userStats.filter((s) => FUNBRAIN_CATEGORIES.some((f) => f.id === s.category)).length) || 1000;

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
      const categories: AcademicCategory[] = ["physics", "chemistry", "math", "biology", "cs"];
      const cat = categories[Math.floor(Math.random() * categories.length)];
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
    if (isCorrect) {
      setStreakCount((c) => c + 1);
      const next = selectedCategory === "mixed"
        ? await fetchOneAdaptive("academic", ["physics", "chemistry", "math", "biology", "cs"][Math.floor(Math.random() * 5)] as AcademicCategory)
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
        ? await fetchOneAdaptive("academic", ["physics", "chemistry", "math", "biology", "cs"][Math.floor(Math.random() * 5)] as AcademicCategory)
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
    const newStrikes = strikesRef.current + 1;
    setStrikes(newStrikes);
    if (newStrikes >= STREAK_MAX_STRIKES) {
      setView("streak_gameover");
      setStreakQuestion(null);
      return;
    }
    const next = selectedCategory === "mixed"
      ? await fetchOneAdaptive("academic", (["physics", "chemistry", "math", "biology", "cs"] as const)[Math.floor(Math.random() * 5)])
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

  const submitGauntlet = async (
    results: { question_id: string; is_correct: boolean; time_taken_ms: number }[]
  ) => {
    const today = todayDate();
    const currentDomain = selectedDomain || "funbrain";

    // Show results immediately (never leave user stuck)
    const localCorrect = results.filter(r => r.is_correct).length;
    const localTimeMs = results.reduce((acc, r) => acc + r.time_taken_ms, 0);
    setGauntletSubmitted({ correct_count: localCorrect, total_time_ms: localTimeMs });
    setView("gauntlet_result");
    fetchLeaderboard(today, currentDomain);

    // Submit to DB with correct domain
    await supabase.rpc("submit_daily_gauntlet", {
      p_gauntlet_date: today,
      p_results: results,
      p_domain: currentDomain,
    });
  };

  const backToDashboard = () => {
    setView("dashboard");
    setStreakQuestion(null);
    setGauntletQuestions([]);
    setGauntletSubmitted(null);
    setGauntletAlreadyPlayed(false);
    fetchUserStats();
  };

  return (
    <ProtectedRoute>
      <AppLayout streakTimer={streakTimer}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <AnimatePresence mode="wait">
            {view === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                {/* Hero header */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 ring-2 ring-primary/20">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-foreground">Play</h1>
                    <p className="text-sm text-muted-foreground">Knowledge or logic — level up your rank.</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Zone A: Academic Arena */}
                  <motion.div
                    className="edu-card rounded-2xl p-6 border-2 border-primary/25 bg-gradient-to-br from-primary/8 via-primary/3 to-transparent shadow-sm hover:shadow-md hover:border-primary/35 transition-all duration-200"
                    whileHover={{ y: -2 }}
                    transition={{ type: "tween", duration: 0.2 }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="h-6 w-6 text-primary shrink-0" />
                      <h2 className="text-xl font-display font-bold text-foreground">Academic Arena</h2>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">Knowledge-based. Mastery rank per subject.</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {ACADEMIC_CATEGORIES.map((c) => {
                        const rating = c.id === "mixed" ? null : getRatingForCategory(c.id);
                        const rank = rating != null ? RATING_TO_RANK(rating) : null;
                        const nextTier = rating != null ? RATING_TO_NEXT(rating) : null;
                        const isSelected = selectedDomain === "academic" && selectedCategory === c.id;
                        const isGrandTrial = c.id === "mixed";
                        return (
                          <div key={c.id} className="flex flex-col items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={isSelected ? "default" : "outline"}
                                  size="sm"
                                  className={`rounded-xl transition-all duration-200 ${isGrandTrial ? "ring-2 ring-amber-400/50 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-900/40 dark:hover:to-orange-900/30 font-semibold" : ""}`}
                                  onClick={() => { setSelectedDomain("academic"); setSelectedCategory(c.id); }}
                                  disabled={streakLoading}
                                >
                                  {isGrandTrial && <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-600" />}
                                  {c.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[200px]">
                                {isGrandTrial ? "All subjects, random. One ultimate challenge." : (nextTier?.next ? `Progress to ${nextTier.next}: ${nextTier.progress.toFixed(0)}%` : "Master rank")}
                              </TooltipContent>
                            </Tooltip>
                            {rank && !isGrandTrial && (
                              <div className="flex flex-col items-center w-full max-w-[72px]">
                                <span className={`text-xs font-semibold ${rank.color}`}>{rank.label}</span>
                                {nextTier?.next && (
                                  <Progress value={nextTier.progress} className="h-1 w-full mt-0.5 bg-muted" />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            className="w-full rounded-xl h-11 font-semibold shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200"
                            onClick={() => selectedDomain === "academic" && selectedCategory && startStreak("academic", selectedCategory)}
                            disabled={selectedDomain !== "academic" || !selectedCategory || streakLoading || gauntletLoading}
                          >
                            {streakLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                            Start Streak Survival
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          Pick a subject above, then start. 5s per question, 3 strikes and out.
                        </TooltipContent>
                      </Tooltip>
                      <div className="relative mt-2">
                        <Button
                          variant="outline"
                          className="w-full rounded-xl h-11 font-medium hover:bg-primary/10 hover:border-primary/30 transition-all duration-200"
                          onClick={() => checkGauntletAndStart("academic")}
                          disabled={streakLoading || gauntletLoading}
                        >
                          {gauntletLoading && selectedDomain === "academic" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trophy className="h-4 w-4 mr-2 text-primary" />}
                          Daily Gauntlet
                          {gauntletPlayedToday.academic && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-edu-green/15 px-2 py-0.5 text-xs font-semibold text-edu-green">
                              <Medal className="h-3 w-3 mr-0.5" /> Done today
                            </span>
                          )}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2.5">Streak: 5s per Q, 3 strikes · Gauntlet: 10 Qs, 1 attempt</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-xs text-primary dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 -ml-1"
                      onClick={async () => {
                        setSelectedDomain("academic");
                        setGauntletAlreadyPlayed(gauntletPlayedToday.academic);
                        setView("gauntlet_result");
                        // Fetch leaderboard and extract user's own row
                        const today = todayDate();
                        setLeaderboardLoading(true);
                        const { data } = await supabase.rpc("get_daily_gauntlet_leaderboard", { p_gauntlet_date: today, p_domain: "academic" });
                        const rows = (data as { rank: number; user_id?: string; display_name: string | null; correct_count: number; total_time_ms: number }[]) || [];
                        setLeaderboard(rows);
                        setLeaderboardLoading(false);
                        const myRow = rows.find(r => r.user_id === user?.id);
                        if (myRow) setGauntletSubmitted({ correct_count: myRow.correct_count, total_time_ms: myRow.total_time_ms });
                      }}
                    >
                      View leaderboard <ChevronRight className="h-3 w-3 ml-0.5" />
                    </Button>
                  </motion.div>

                  {/* Zone B: Funbrain Forge */}
                  <motion.div
                    className="edu-card rounded-2xl p-6 border-2 border-orange-500/25 bg-gradient-to-br from-orange-500/8 via-orange-500/3 to-purple-500/5 shadow-sm hover:shadow-md hover:border-orange-500/40 transition-all duration-200"
                    whileHover={{ y: -2 }}
                    transition={{ type: "tween", duration: 0.2 }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Flame className="h-6 w-6 text-orange-500 shrink-0" />
                      <h2 className="text-xl font-display font-bold text-foreground">Funbrain Forge</h2>
                    </div>
                    <div className="flex items-baseline gap-2 mb-4 flex-wrap">
                      <span className="text-sm text-muted-foreground">Logic-based. Global rating:</span>
                      <span className="text-2xl font-bold tabular-nums bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                        {loadingStats ? "—" : Math.round(logicRating)}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground cursor-help border-b border-dashed border-muted-foreground/50">Elo-style</span>
                        </TooltipTrigger>
                        <TooltipContent side="top">Your logic skill rating. Play Streak Survival to climb.</TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {FUNBRAIN_CATEGORIES.map((c) => (
                        <Button
                          key={c.id}
                          variant={selectedDomain === "funbrain" && selectedCategory === c.id ? "default" : "outline"}
                          size="sm"
                          className="rounded-xl transition-all duration-200 data-[state=open]:ring-2 data-[state=open]:ring-orange-500/30"
                          onClick={() => { setSelectedDomain("funbrain"); setSelectedCategory(c.id); }}
                        >
                          {c.label}
                        </Button>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="default"
                        className="w-full rounded-xl h-11 font-semibold bg-orange-500 hover:bg-orange-600 shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200"
                        onClick={() => selectedCategory && startStreak("funbrain", selectedCategory)}
                        disabled={!selectedCategory || streakLoading}
                      >
                        {streakLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                        Streak Survival
                      </Button>
                      <div className="relative">
                        <Button
                          variant="outline"
                          className="w-full rounded-xl h-11 font-medium hover:bg-orange-500/10 hover:border-orange-500/30 transition-all duration-200"
                          onClick={() => checkGauntletAndStart("funbrain")}
                          disabled={streakLoading || gauntletLoading}
                        >
                          {gauntletLoading && selectedDomain === "funbrain" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trophy className="h-4 w-4 mr-2 text-amber-500" />}
                          Daily Gauntlet
                          {gauntletPlayedToday.funbrain && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-edu-green/15 px-2 py-0.5 text-xs font-semibold text-edu-green">
                              <Medal className="h-3 w-3 mr-0.5" /> Done today
                            </span>
                          )}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2.5">Same 10 puzzles for everyone today · One attempt · Leaderboard by speed</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 -ml-1 text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300"
                      onClick={async () => {
                        setSelectedDomain("funbrain");
                        setGauntletAlreadyPlayed(gauntletPlayedToday.funbrain);
                        setView("gauntlet_result");
                        // Fetch leaderboard and extract user's own row
                        const today = todayDate();
                        setLeaderboardLoading(true);
                        const { data } = await supabase.rpc("get_daily_gauntlet_leaderboard", { p_gauntlet_date: today, p_domain: "funbrain" });
                        const rows = (data as { rank: number; user_id?: string; display_name: string | null; correct_count: number; total_time_ms: number }[]) || [];
                        setLeaderboard(rows);
                        setLeaderboardLoading(false);
                        const myRow = rows.find(r => r.user_id === user?.id);
                        if (myRow) setGauntletSubmitted({ correct_count: myRow.correct_count, total_time_ms: myRow.total_time_ms });
                      }}
                    >
                      View leaderboard <ChevronRight className="h-3 w-3 ml-0.5" />
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {view === "streak" && (
              <motion.div
                key="streak"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-2xl mx-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <Button variant="ghost" size="sm" onClick={backToDashboard} className="rounded-xl">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-edu-green">Streak: {streakCount}</span>
                    <span className="text-sm font-bold text-destructive">Strikes: {strikes}/{STREAK_MAX_STRIKES}</span>
                  </div>
                </div>
                {streakLoading && !streakQuestion && (
                  <div className="flex justify-center py-20">
                    <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!streakLoading && !streakQuestion && (
                  <div className="edu-card rounded-2xl p-8 text-center border-2 border-border">
                    <p className="text-muted-foreground mb-4">No more questions in this category right now. Try another subject or come back later.</p>
                    <Button className="rounded-xl font-semibold" onClick={backToDashboard}>Back to Play</Button>
                  </div>
                )}
                {streakQuestion && (
                  <PlayQuestionCard
                    question={streakQuestion}
                    onAnswer={handleStreakAnswer}
                    onNext={() => { }}
                    timerSeconds={STREAK_TIMER_SEC}
                    onTimeout={handleStreakTimeout}
                    showExplanation={true}
                  />
                )}
              </motion.div>
            )}

            {view === "streak_gameover" && (() => {
              const score = streakCount * 10;
              const encouragement = streakCount === 0
                ? "Tough round. Every expert started somewhere."
                : streakCount <= 2
                  ? "Nice start! Try again to beat it."
                  : streakCount <= 5
                    ? "Solid run. You're getting the hang of it."
                    : "Impressive. That took real focus.";
              const nearMiss = streakCount > 0
                ? `1 more correct and you'd have hit ${streakCount + 1}!`
                : null;
              return (
                <motion.div
                  key="streak-go"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", damping: 20 }}
                  className="max-w-md mx-auto text-center py-12"
                >
                  <div className="edu-card rounded-2xl p-8 border-2 border-border">
                    <h2 className="text-2xl font-display font-bold text-foreground mb-4">Game Over</h2>
                    <div className="space-y-2 mb-6">
                      <p className="text-3xl font-bold text-edu-green">{score} <span className="text-lg font-medium text-muted-foreground">pts</span></p>
                      <p className="text-sm text-muted-foreground">{streakCount} correct · {STREAK_MAX_STRIKES} strikes</p>
                      {nearMiss && <p className="text-xs text-muted-foreground italic">So close — {nearMiss}</p>}
                    </div>
                    <p className="text-sm text-foreground/80 mb-6">{encouragement}</p>
                    <Button className="rounded-xl font-semibold shadow-md" onClick={backToDashboard}>Back to Play</Button>
                  </div>
                </motion.div>
              );
            })()}

            {view === "gauntlet" && gauntletQuestions.length > 0 && (
              <motion.div
                key="gauntlet"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-2xl mx-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <Button variant="ghost" size="sm" onClick={backToDashboard} className="rounded-xl">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <span className="text-sm font-bold text-muted-foreground">
                    Question {gauntletIndex + 1} of {gauntletQuestions.length}
                  </span>
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
                    showExplanation={true}
                  />
                )}
              </motion.div>
            )}

            {view === "gauntlet_result" && (
              <motion.div
                key="gauntlet-result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="max-w-2xl mx-auto"
              >
                <Button variant="ghost" size="sm" onClick={backToDashboard} className="rounded-xl mb-6 -ml-1">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back to Play
                </Button>
                {gauntletAlreadyPlayed && !gauntletSubmitted && (
                  <p className="text-muted-foreground mb-4">You already played today. See leaderboard below.</p>
                )}
                {gauntletSubmitted && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="edu-card p-6 rounded-2xl mb-6 border-2 border-edu-green/20 bg-edu-green/5"
                  >
                    <h3 className="text-lg font-bold text-foreground mb-2">Today&apos;s result</h3>
                    <p className="text-2xl font-bold text-edu-green">{gauntletSubmitted.correct_count}/10 correct</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="w-4 h-4" /> {(gauntletSubmitted.total_time_ms / 1000).toFixed(1)}s total
                    </p>
                  </motion.div>
                )}
                <h3 className="text-lg font-bold text-foreground mb-3">Daily Gauntlet Leaderboard</h3>
                {leaderboardLoading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                ) : (
                  <ul className="space-y-2">
                    {/* If no DB leaderboard yet (migration not applied), show the user's own result */}
                    {leaderboard.length === 0 && gauntletSubmitted && (
                      <li className="flex items-center justify-between edu-card px-4 py-3 rounded-xl ring-2 ring-primary/40 bg-primary/5">
                        <span className="font-bold w-8 text-amber-500">#1</span>
                        <span className="font-semibold flex-1 truncate mx-2 flex items-center gap-2">
                          You
                          <span className="text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full">YOU</span>
                        </span>
                        <span className="text-edu-green font-semibold">{gauntletSubmitted.correct_count}/10</span>
                        <span className="text-sm text-muted-foreground tabular-nums ml-3">{(gauntletSubmitted.total_time_ms / 1000).toFixed(1)}s</span>
                      </li>
                    )}
                    {leaderboard.slice(0, 10).map((row, i) => {
                      const isMe = row.user_id === user?.id;
                      return (
                        <li
                          key={i}
                          className={`flex items-center justify-between edu-card px-4 py-3 rounded-xl transition-colors ${isMe
                            ? 'ring-2 ring-primary/40 bg-primary/5'
                            : row.rank <= 3 ? 'ring-1 ring-amber-400/30 bg-amber-50/50 dark:bg-amber-950/20' : ''
                            }`}
                        >
                          <span className={`font-bold w-8 ${row.rank <= 3 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                            #{row.rank}
                          </span>
                          <span className="font-medium flex-1 truncate mx-2 flex items-center gap-2">
                            {row.display_name ?? 'Anonymous'}
                            {isMe && <span className="text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full">YOU</span>}
                          </span>
                          <span className="text-edu-green font-semibold">{row.correct_count}/10</span>
                          <span className="text-sm text-muted-foreground tabular-nums ml-3">{(row.total_time_ms / 1000).toFixed(1)}s</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {leaderboard.length === 0 && !leaderboardLoading && !gauntletSubmitted && (
                  <p className="text-muted-foreground">No attempts yet today.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
