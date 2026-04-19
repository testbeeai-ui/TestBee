"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useIsAppAdmin } from "@/hooks/useIsAppAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import PlayQuestionCard from "@/components/PlayQuestionCard";
import { bumpUserStudyDayMs } from "@/lib/studyDayBump";
import { shufflePlayQuestionOptions } from "@/lib/shufflePlayQuestionOptions";
import { cn } from "@/lib/utils";
import type { PlayDomain, PlayQuestionRow } from "@/types";
import { fetchDailyGauntletQuestionsWithFallback } from "@/lib/fetchPlayQuestionsAdaptiveWithFallback";
import { Clock, Loader2 } from "lucide-react";

const GAUNTLET_SESSION_SEC = 300;
const GAUNTLET_Q_SEC = 20;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function playGauntletDayDoneKey(userId: string, dayIso: string, d: PlayDomain) {
  return `testbee_gauntlet_done_${userId}_${dayIso}_${d}`;
}

function formatClock(sec: number): string {
  const s = Math.max(0, sec);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export type InlineDailyGauntletProps = {
  domain: PlayDomain;
  onClose: () => void;
  /** After a successful submit or when user finishes viewing a prior result */
  onSessionComplete?: () => void;
};

type LbRow = {
  rank: number;
  user_id?: string;
  display_name: string | null;
  correct_count: number;
  total_time_ms: number;
};

/**
 * Full Daily Gauntlet session embedded on pages like Refer & Earn (no redirect to /play).
 * Mirrors `app/play/page.tsx` gauntlet RPCs, timers, and submit behavior.
 */
export default function InlineDailyGauntlet({ domain, onClose, onSessionComplete }: InlineDailyGauntletProps) {
  const { user } = useAuth();
  const isPlayAdmin = useIsAppAdmin();
  const [bootLoading, setBootLoading] = useState(true);
  const [gauntletQuestions, setGauntletQuestions] = useState<PlayQuestionRow[]>([]);
  const [gauntletIndex, setGauntletIndex] = useState(0);
  const [gauntletResults, setGauntletResults] = useState<{ question_id: string; is_correct: boolean; time_taken_ms: number }[]>([]);
  const gauntletResultsRef = useRef(gauntletResults);
  useEffect(() => {
    gauntletResultsRef.current = gauntletResults;
  }, [gauntletResults]);

  const [gauntletSubmitted, setGauntletSubmitted] = useState<{ correct_count: number; total_time_ms: number } | null>(null);
  const [gauntletAlreadyPlayed, setGauntletAlreadyPlayed] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LbRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [gauntletSessionLeft, setGauntletSessionLeft] = useState(GAUNTLET_SESSION_SEC);
  const [gauntletQTimeLeft, setGauntletQTimeLeft] = useState(GAUNTLET_Q_SEC);

  const gauntletQuestionsRef = useRef(gauntletQuestions);
  const gauntletIndexRef = useRef(gauntletIndex);
  const gauntletSessionEndRef = useRef(false);
  const gauntletSubmitLockRef = useRef(false);
  gauntletQuestionsRef.current = gauntletQuestions;
  gauntletIndexRef.current = gauntletIndex;

  const fetchLeaderboard = useCallback(async (date: string, d: PlayDomain) => {
    setLeaderboardLoading(true);
    const { data } = await supabase.rpc("get_daily_gauntlet_leaderboard", { p_gauntlet_date: date, p_domain: d });
    setLeaderboard((data as LbRow[]) || []);
    setLeaderboardLoading(false);
  }, []);

  const submitGauntlet = useCallback(
    async (results: { question_id: string; is_correct: boolean; time_taken_ms: number }[]) => {
      if (gauntletSubmitLockRef.current) return;
      gauntletSubmitLockRef.current = true;
      const today = todayUtc();
      const uid = user?.id;
      const localCorrect = results.filter((r) => r.is_correct).length;
      const localTimeMs = results.reduce((acc, r) => acc + r.time_taken_ms, 0);

      const { error } = await supabase.rpc("submit_daily_gauntlet", {
        p_gauntlet_date: today,
        p_results: results,
        p_domain: domain,
      });
      void bumpUserStudyDayMs(localTimeMs);

      if (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("[InlineDailyGauntlet] submit_daily_gauntlet", error);
        }
        gauntletSubmitLockRef.current = false;
        return;
      }

      if (uid && !isPlayAdmin) {
        try {
          localStorage.setItem(playGauntletDayDoneKey(uid, today, domain), "1");
        } catch {
          /* ignore */
        }
      }

      setGauntletSubmitted({ correct_count: localCorrect, total_time_ms: localTimeMs });
      void fetchLeaderboard(today, domain);
      onSessionComplete?.();
    },
    [domain, fetchLeaderboard, onSessionComplete, user?.id, isPlayAdmin],
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
    if (gauntletQuestions.length === 0 || gauntletSubmitted) return;
    const t = setInterval(() => {
      setGauntletSessionLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [gauntletQuestions.length, gauntletSubmitted]);

  useEffect(() => {
    if (gauntletQuestions.length > 0 && !gauntletSubmitted) {
      setGauntletQTimeLeft(GAUNTLET_Q_SEC);
    }
  }, [gauntletIndex, gauntletQuestions.length, gauntletSubmitted]);

  useEffect(() => {
    if (gauntletSessionLeft > 0 || gauntletQuestions.length === 0 || gauntletSubmitted) return;
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
  }, [gauntletSessionLeft, gauntletQuestions.length, gauntletSubmitted, submitGauntlet]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBootLoading(true);
      gauntletSessionEndRef.current = false;
      gauntletSubmitLockRef.current = false;
      const uid = user?.id;
      if (!uid) {
        setBootLoading(false);
        return;
      }
      const today = todayUtc();
      const { data: lb } = await supabase.rpc("get_daily_gauntlet_leaderboard", {
        p_gauntlet_date: today,
        p_domain: domain,
      });
      if (cancelled) return;
      const lbRows = (lb as LbRow[]) || [];
      const myRow = lbRows.find((r) => r.user_id === uid);
      if (myRow && !isPlayAdmin) {
        setGauntletAlreadyPlayed(true);
        setGauntletSubmitted({ correct_count: myRow.correct_count, total_time_ms: myRow.total_time_ms });
        setLeaderboard(lbRows);
        setGauntletQuestions([]);
        setBootLoading(false);
        return;
      }
      const questions = await fetchDailyGauntletQuestionsWithFallback(supabase, {
        domain,
        dateIso: today,
      });
      if (cancelled) return;
      setBootLoading(false);
      if (questions.length === 0) {
        setGauntletAlreadyPlayed(false);
        setGauntletSubmitted(null);
        setLeaderboard([]);
        setGauntletQuestions([]);
        return;
      }
      setGauntletQuestions(questions.map((q) => shufflePlayQuestionOptions(q)));
      setGauntletIndex(0);
      setGauntletResults([]);
      setGauntletSubmitted(null);
      setGauntletAlreadyPlayed(false);
      setGauntletSessionLeft(GAUNTLET_SESSION_SEC);
      setGauntletQTimeLeft(GAUNTLET_Q_SEC);
    })();
    return () => {
      cancelled = true;
    };
  }, [domain, user?.id, isPlayAdmin]);

  const handleGauntletAnswer = (selectedIndex: number, timeTakenMs: number) => {
    if (!gauntletQuestions[gauntletIndex]) return;
    const q = gauntletQuestions[gauntletIndex];
    const isCorrect = selectedIndex === q.correct_answer_index;
    const newResult = { question_id: q.id, is_correct: isCorrect, time_taken_ms: timeTakenMs };
    const fullSoFar = [...gauntletResultsRef.current, newResult];
    setGauntletResults(fullSoFar);
  };

  const currentGauntletFinished = gauntletIndex >= gauntletQuestions.length - 1;
  const tot = gauntletQuestions.length;
  const idx = gauntletIndex;
  const correctCount = gauntletResults.filter((r) => r.is_correct).length;
  const answeredCount = gauntletResults.length;
  const sessionPct = Math.round((gauntletSessionLeft / GAUNTLET_SESSION_SEC) * 100);
  const qPct = Math.round((gauntletQTimeLeft / GAUNTLET_Q_SEC) * 100);
  const accentFill = domain === "funbrain" ? "bg-orange-500" : "bg-indigo-600";
  const qFillClass =
    gauntletQTimeLeft <= 5
      ? "bg-red-500"
      : domain === "funbrain"
        ? "bg-sky-500"
        : "bg-emerald-500";
  const ttl = domain === "funbrain" ? "Funbrain Forge" : "Academic Arena";
  const questionProgressPct = tot > 0 ? Math.round(((idx + 1) / tot) * 100) : 0;

  const handleDone = () => {
    onClose();
  };

  if (bootLoading) {
    return (
      <div
        className="dark mt-3 flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-[14px] border border-violet-500/25 bg-black/40 p-6"
        role="status"
        aria-busy
      >
        <Loader2 className="h-9 w-9 animate-spin text-violet-400" />
        <p className="text-xs text-slate-400">Loading today&apos;s Daily Gauntlet…</p>
      </div>
    );
  }

  if (!user?.id) {
    return (
      <div className="dark mt-3 rounded-[14px] border border-amber-500/25 bg-amber-500/10 p-4 text-center text-sm text-amber-100/90">
        Sign in to play the Daily Gauntlet.
      </div>
    );
  }

  if (gauntletSubmitted || (gauntletAlreadyPlayed && gauntletQuestions.length === 0)) {
    const denom = tot || 10;
    return (
      <div className="dark mt-3 space-y-4 rounded-[14px] border border-violet-500/25 bg-[#0a0818] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white">{ttl} · Daily Gauntlet</h3>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-slate-400 hover:text-white" onClick={handleDone}>
            Close
          </Button>
        </div>
        {gauntletSubmitted ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/90">Today&apos;s result</p>
            <p className="mt-1 text-2xl font-bold text-emerald-400">
              {gauntletSubmitted.correct_count}/{denom} correct
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
              <Clock className="h-3.5 w-3.5" /> {(gauntletSubmitted.total_time_ms / 1000).toFixed(1)}s total
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-400">No questions available for this domain today.</p>
        )}
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-300">Leaderboard</p>
          {leaderboardLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
          ) : (
            <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {leaderboard.length === 0 && gauntletSubmitted && (
                <li className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
                  <span className="font-bold text-amber-400">#1</span>
                  <span className="flex-1 truncate px-2 font-medium text-white">You</span>
                  <span className="font-semibold text-emerald-400">
                    {gauntletSubmitted.correct_count}/{denom}
                  </span>
                </li>
              )}
              {leaderboard.slice(0, 10).map((row, i) => {
                const isMe = row.user_id === user.id;
                return (
                  <li
                    key={`${row.rank}-${i}`}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2 text-xs",
                      "border-white/10 bg-black/30",
                      isMe && "ring-1 ring-violet-500/40",
                    )}
                  >
                    <span className={cn("w-7 font-bold", row.rank <= 3 ? "text-amber-400" : "text-slate-500")}>#{row.rank}</span>
                    <span className="flex min-w-0 flex-1 items-center gap-1 truncate px-2 font-medium text-slate-200">
                      {row.display_name ?? "Anonymous"}
                      {isMe ? (
                        <span className="shrink-0 rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold text-white">YOU</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-semibold text-emerald-400">
                      {row.correct_count}/{denom}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <p className="text-center text-[11px] text-slate-500">
          <Link href={`/play?domain=${domain}`} className="text-violet-400 underline-offset-2 hover:underline">
            Open full Play hub
          </Link>
        </p>
      </div>
    );
  }

  if (gauntletQuestions.length === 0) {
    return (
      <div className="dark mt-3 rounded-[14px] border border-white/10 bg-black/30 p-4 text-center text-sm text-slate-400">
        Couldn&apos;t load questions for today. Try again later or{" "}
        <Link href={`/play?domain=${domain}`} className="text-violet-400 underline-offset-2 hover:underline">
          open Play
        </Link>
        .
        <Button type="button" variant="outline" className="mt-3 border-white/20" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="dark mt-3 rounded-[14px] border border-violet-500/30 bg-[#070714] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)] sm:p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="min-w-0">
          <p className="text-[13px] font-extrabold text-white sm:text-[15px]">
            {ttl} · <span className="text-violet-300">Daily Gauntlet</span>
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">5 min session · 20s per question</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-300">
          <span className="tabular-nums text-slate-200">
            Question {idx + 1} of {tot}
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            <span className={cn("font-mono", gauntletSessionLeft <= 30 ? "text-red-400" : "text-amber-300")}>
              {formatClock(gauntletSessionLeft)}
            </span>
          </span>
          <span className="tabular-nums text-emerald-400">
            Score: {correctCount}/{answeredCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 border-white/20 bg-transparent px-2 text-[11px] text-slate-200 hover:bg-white/10"
            onClick={onClose}
          >
            Quit
          </Button>
        </div>
      </div>

      <div className="mb-3 space-y-2">
        <div>
          <div className="mb-1 flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Session</span>
            <span className="font-mono normal-case tabular-nums text-slate-400">{formatClock(gauntletSessionLeft)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className={cn("h-full rounded-full transition-[width] duration-300", accentFill)} style={{ width: `${sessionPct}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
            <span>This question</span>
            <span className="font-mono normal-case tabular-nums text-slate-400">{gauntletQTimeLeft}s</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className={cn("h-full rounded-full transition-[width] duration-300", qFillClass)} style={{ width: `${qPct}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Quiz progress</span>
            <span className="tabular-nums text-slate-400">
              {idx + 1}/{tot}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-violet-500 transition-[width] duration-300"
              style={{ width: `${questionProgressPct}%` }}
            />
          </div>
        </div>
      </div>

      {gauntletQuestions[gauntletIndex] ? (
        <div className="rounded-xl border border-white/10 bg-black/35 p-1 sm:p-2">
          <PlayQuestionCard
            question={gauntletQuestions[gauntletIndex]!}
            onAnswer={handleGauntletAnswer}
            onNext={
              !currentGauntletFinished
                ? () => setGauntletIndex((i) => i + 1)
                : () => void submitGauntlet(gauntletResultsRef.current)
            }
            timerSeconds={GAUNTLET_Q_SEC}
            onTimeout={handleGauntletTimeout}
            onTimerTick={setGauntletQTimeLeft}
            hideInlineTimer
            showExplanation
            optionLayout="grid"
          />
        </div>
      ) : null}
    </div>
  );
}
