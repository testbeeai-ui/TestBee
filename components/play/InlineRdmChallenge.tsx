"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import PlayQuestionCard from "@/components/PlayQuestionCard";
import { fetchReferChallengeQuestions } from "@/lib/fetchReferChallengeQuestions";
import { renderShareCardToPng, downloadBlobAsPng } from "@/lib/referChallengeShareImage";
import { buildWhatsAppShareUrl } from "@/lib/referChallengeShareUrls";
import {
  buildReferSharePayload,
  buildReferShareTemplates,
  pickNextTemplate,
  type ReferChallengeShareTemplate,
} from "@/lib/referChallengeShareTemplates";
import { bumpUserStudyDayMs } from "@/lib/studyDayBump";
import { shufflePlayQuestionOptions } from "@/lib/shufflePlayQuestionOptions";
import type { ReferChallengePublicSpec, ReferClaimKey } from "@/lib/referEarnChallenges";
import { cn } from "@/lib/utils";
import type { PlayQuestionRow } from "@/types";
import { Clock, Copy, Download, Flame, Instagram, Loader2, MessageCircle, Play, Share2, Shuffle, Sparkles, Zap } from "lucide-react";

const MAX_STRIKES = 3;

function formatClock(sec: number): string {
  const s = Math.max(0, sec);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export type InlineRdmChallengeProps = {
  spec: ReferChallengePublicSpec;
  onClose: () => void;
  /** Fired once when the run ends (win/lose/strikes/time). Parent may persist “played today” per claim. */
  onTerminal?: (info: { claimKey: ReferClaimKey; outcome: "won" | "lost" }) => void;
  streakDays?: number;
  dailyRdmEarned?: number;
  dailyRdmCap?: number;
};

type SummaryReason = "won" | "strikes" | "time" | "below_threshold" | "quit" | null;

export default function InlineRdmChallenge({
  spec,
  onClose,
  onTerminal,
  streakDays = 0,
  dailyRdmEarned = 0,
  dailyRdmCap = 50,
}: InlineRdmChallengeProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const sessionSec = spec.sessionMinutes * 60;
  const [bootLoading, setBootLoading] = useState(true);
  const [questions, setQuestions] = useState<PlayQuestionRow[]>([]);
  /** When the bank returns fewer than requested, scale the pass bar (same ratio as spec). */
  const [minPassCorrect, setMinPassCorrect] = useState(spec.minCorrect);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<{ question_id: string; is_correct: boolean; time_taken_ms: number }[]>([]);
  const resultsRef = useRef(results);
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  const [sessionLeft, setSessionLeft] = useState(sessionSec);
  const [phase, setPhase] = useState<"playing" | "summary">("playing");
  const [summaryReason, setSummaryReason] = useState<SummaryReason>(null);
  const [igTemplateIndex, setIgTemplateIndex] = useState(0);
  const terminalFiredRef = useRef(false);
  const sessionEndRef = useRef(false);
  const sessionStartedAtRef = useRef<number | null>(null);
  const shareCardRef = useRef<HTMLDivElement | null>(null);
  const questionsRef = useRef(questions);
  const indexRef = useRef(index);
  useEffect(() => {
    questionsRef.current = questions;
    indexRef.current = index;
  }, [questions, index]);

  const fireTerminal = useCallback(
    (outcome: "won" | "lost") => {
      if (terminalFiredRef.current) return;
      terminalFiredRef.current = true;
      onTerminal?.({ claimKey: spec.key, outcome });
    },
    [onTerminal, spec.key],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBootLoading(true);
      setPhase("playing");
      setSummaryReason(null);
      setMinPassCorrect(spec.minCorrect);
      setIndex(0);
      setResults([]);
      setIgTemplateIndex(0);
      terminalFiredRef.current = false;
      sessionEndRef.current = false;
      sessionStartedAtRef.current = null;
      setSessionLeft(sessionSec);
      const uid = user?.id;
      if (!uid) {
        setBootLoading(false);
        setQuestions([]);
        return;
      }
      const rowsRaw = await fetchReferChallengeQuestions(supabase, spec);
      if (cancelled) return;
      setBootLoading(false);
      if (rowsRaw.length === 0) {
        setQuestions([]);
        return;
      }
      sessionStartedAtRef.current = Date.now();
      const rows = rowsRaw.map((q) => shufflePlayQuestionOptions(q));
      setQuestions(rows);
      const n = rows.length;
      const scaled =
        n >= spec.questionCount
          ? spec.minCorrect
          : Math.max(1, Math.ceil((spec.minCorrect / spec.questionCount) * n));
      setMinPassCorrect(Math.min(n, scaled));
    })();
    return () => {
      cancelled = true;
    };
  }, [spec, sessionSec, user?.id]);

  useEffect(() => {
    if (phase !== "playing" || questions.length === 0) return;
    const t = setInterval(() => {
      setSessionLeft((s) => {
        if (s <= 0) return 0;
        const next = s - 1;
        if (next === 0 && !sessionEndRef.current) {
          sessionEndRef.current = true;
          setPhase("summary");
          setSummaryReason("time");
          fireTerminal("lost");
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, questions.length, fireTerminal]);

  const handleAnswer = async (selectedIndex: number, timeTakenMs: number) => {
    const q = questions[indexRef.current];
    if (!q || phase !== "playing") return;
    const isCorrect = selectedIndex === q.correct_answer_index;
    await supabase.rpc("record_play_result", {
      p_question_id: q.id,
      p_is_correct: isCorrect,
      p_time_taken_ms: timeTakenMs,
      p_category: null,
      p_pool_key: spec.playCategory,
    });
    void bumpUserStudyDayMs(timeTakenMs);
    const row = { question_id: q.id, is_correct: isCorrect, time_taken_ms: timeTakenMs };
    const next = [...resultsRef.current, row];
    resultsRef.current = next;
    setResults(next);
  };

  const finishQuiz = useCallback(() => {
    const correct = resultsRef.current.filter((r) => r.is_correct).length;
    const misses = resultsRef.current.filter((r) => !r.is_correct).length;
    setPhase("summary");
    if (misses >= MAX_STRIKES) {
      setSummaryReason("strikes");
      fireTerminal("lost");
      return;
    }
    if (correct >= minPassCorrect) {
      setSummaryReason("won");
      fireTerminal("won");
    } else {
      setSummaryReason("below_threshold");
      fireTerminal("lost");
    }
  }, [fireTerminal, minPassCorrect]);

  const handleNext = () => {
    if (phase !== "playing") return;
    const misses = resultsRef.current.filter((r) => !r.is_correct).length;
    if (misses >= MAX_STRIKES) {
      setPhase("summary");
      setSummaryReason("strikes");
      fireTerminal("lost");
      return;
    }
    const idx = indexRef.current;
    const qs = questionsRef.current;
    if (idx >= qs.length - 1) {
      finishQuiz();
      return;
    }
    setIndex(idx + 1);
  };

  const handleQuit = () => {
    setPhase("summary");
    setSummaryReason("quit");
    // Abandon — do not mark challenge complete or fire onTerminal
  };

  const tot = questions.length;
  const idx = index;
  const correctCount = results.filter((r) => r.is_correct).length;
  const sessionPct = sessionSec > 0 ? Math.round((sessionLeft / sessionSec) * 100) : 100;
  const accentFill = spec.domain === "funbrain" ? "bg-orange-500" : "bg-indigo-600";
  const rdmAccent =
    spec.key === "5"
      ? "text-sky-400"
      : spec.key === "10"
        ? "text-emerald-400"
        : spec.key === "20"
          ? "text-violet-400"
          : "text-amber-400";

  if (bootLoading) {
    return (
      <div
        className="dark mt-3 flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-[14px] border border-violet-500/25 bg-black/40 p-6"
        role="status"
        aria-busy
      >
        <Loader2 className="h-9 w-9 animate-spin text-violet-400" />
        <p className="text-xs text-slate-400">Loading challenge…</p>
      </div>
    );
  }

  if (!user?.id) {
    return (
      <div className="dark mt-3 rounded-[14px] border border-amber-500/25 bg-amber-500/10 p-4 text-center text-sm text-amber-100/90">
        Sign in to start this challenge.
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="dark mt-3 rounded-[14px] border border-white/10 bg-black/30 p-4 text-center text-sm text-slate-400">
        Couldn&apos;t load questions for this challenge. Try again later.
        <Button type="button" variant="outline" className="mt-3 border-white/20" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  if (phase === "summary") {
    const won = summaryReason === "won";
    const passBar = minPassCorrect;
    const attempted = results.length;
    /** % correct out of all questions in the challenge (summary / share); in-quiz score line still uses answered-only. */
    const pctCorrectOverall = tot > 0 ? Math.round((correctCount / tot) * 100) : 0;
    const minPct = tot > 0 ? Math.round((passBar / tot) * 100) : 0;
    /** Met the same correct-count bar as a win (RDM rule), even if the run ended on time/strikes. */
    const passedScoreBar = tot > 0 && correctCount >= passBar;
    /** Encouraging tier only when the count bar was truly met — never from “% of all questions” alone on a partial run. */
    const strongScore = !won && summaryReason !== "quit" && passedScoreBar;
    const elapsedSec = Math.max(0, sessionSec - sessionLeft);
    const timeTakenLabel = formatClock(elapsedSec);

    const emoji = won ? "🎉" : summaryReason === "quit" ? "👋" : strongScore ? "💪" : "😔";
    const serifHeadline = won
      ? "You earned it!"
      : summaryReason === "quit"
        ? "Paused for now"
        : strongScore
          ? "Strong score — run didn’t finish as a win"
          : "Not quite this time";
    const sub =
      won
        ? `You scored ${pctCorrectOverall}% correct overall (${correctCount}/${tot} out of all questions${attempted < tot ? `, ${attempted} answered before the run ended` : ""}) and cleared the ${passBar}/${tot} bar. RDM credits when tracking is on.`
        : summaryReason === "quit"
          ? "You left the challenge early — no worries. Pick another run when you're ready."
          : summaryReason === "strikes"
            ? passedScoreBar
              ? `You already had at least ${passBar}/${tot} correct (the RDM bar), but three strikes ended the run before completion — so this attempt doesn’t count as a win.`
              : `Three strikes after ${attempted} answers — ${correctCount}/${tot} correct overall (${pctCorrectOverall}% of all questions). You still needed ${passBar} correct across all ${tot} questions to earn RDM (${minPct}% of all questions).`
            : summaryReason === "time"
              ? passedScoreBar
                ? `You hit the ${passBar}/${tot} correct bar, but the timer ran out before the session completed — try again with a quicker pace.`
                : `Time ran out with ${attempted}/${tot} answered — ${correctCount}/${tot} correct overall (${pctCorrectOverall}% of all questions). You needed ${passBar} correct (${minPct}% of all ${tot} questions).`
              : `You finished ${attempted}/${tot} answered — ${correctCount}/${tot} correct overall (${pctCorrectOverall}% of all questions). You needed at least ${passBar} correct (${minPct}% of all questions). Give it another shot!`;

    const rdmBarPct = dailyRdmCap > 0 ? Math.min(100, (dailyRdmEarned / dailyRdmCap) * 100) : 0;
    const appUrl = typeof window !== "undefined" ? `${window.location.origin}/refer-earn` : "https://edublast.in/refer-earn";
    const sharePayload = buildReferSharePayload({
      spec,
      correct: correctCount,
      attempted,
      total: tot,
      /** Same as summary “% correct”: correct ÷ total questions, not ÷ attempted. */
      accuracyPct: pctCorrectOverall,
      timeTakenLabel,
      neededCorrect: passBar,
      outcome: won ? "won" : "lost",
      appUrl,
    });
    const igTemplates = buildReferShareTemplates(sharePayload);
    const fallbackTemplate: ReferChallengeShareTemplate = {
      id: "fallback",
      platform: "instagram",
      tone: "progress",
      title: "Challenge result",
      body: `${correctCount}/${tot} correct`,
      cta: appUrl,
      text: `${correctCount}/${tot} correct`,
      charCount: `${correctCount}/${tot} correct`.length,
    };
    const activeTemplate = igTemplates[igTemplateIndex % Math.max(1, igTemplates.length)] ?? fallbackTemplate;
    const socialHeroKicker = won ? "THE WINNING RUN" : strongScore ? "THE HEARTBREAK RUN" : "THE COMEBACK RUN";
    const socialHeroMain = won ? "BAR CLEARED, BIG ENERGY" : strongScore ? "STRONG SCORE, NO WIN" : "RESET, RELOAD, RISE";
    const socialMidMessage = won
      ? `CRUSHED THE RDM BAR (${passBar}/${tot}) WITH ${pctCorrectOverall}% CORRECT ACROSS ALL ${tot} QUESTIONS.\nPROGRESS: ${attempted}/${tot}. MOMENTUM IS REAL.`
      : strongScore
        ? `HIT THE RDM BAR (${passBar}/${tot}) WITH ${pctCorrectOverall}% CORRECT ACROSS ALL ${tot} QUESTIONS,\nBUT GOT STOPPED RIGHT BEFORE THE FINAL FINISH LINE.\nPROGRESS: ${attempted}/${tot}. SO CLOSE.`
        : `NEEDED ${passBar}/${tot} TO WIN THIS RUN.\nLANDED AT ${correctCount}/${tot} (${pctCorrectOverall}% OF ALL QUESTIONS).\nNEXT RUN: SHARPER, FASTER, STRONGER.`;

    const openShareIntent = (url: string) => {
      if (typeof window === "undefined") return;
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win) {
        toast({
          title: "Popup blocked",
          description: "Allow popups to open the share composer, or copy the text manually.",
        });
      }
    };

    const copyShareText = async (
      text: string,
      toastCopy?: { title: string; description: string },
    ) => {
      try {
        await navigator.clipboard.writeText(text);
        toast({
          title: toastCopy?.title ?? "Caption copied",
          description: toastCopy?.description ?? "Paste it into your post composer.",
        });
      } catch {
        toast({
          title: "Copy failed",
          description: "Please copy manually from the preview.",
          variant: "destructive",
        });
      }
    };

    const getSharePngBlob = async () => {
      const node = shareCardRef.current;
      if (!node) throw new Error("share-card-missing");
      return renderShareCardToPng(node);
    };

    const handleDownloadPng = async () => {
      try {
        const blob = await getSharePngBlob();
        downloadBlobAsPng(blob, `edublast-challenge-${spec.key}-${sharePayload.shareDateIso}.png`);
      } catch {
        toast({
          title: "PNG export failed",
          description: "Sharing text still works. Please try again.",
          variant: "destructive",
        });
      }
    };

    const handleNativeShare = async () => {
      if (!navigator.share) {
        await copyShareText(activeTemplate.text);
        return;
      }
      try {
        const blob = await getSharePngBlob();
        const file = new File([blob], `edublast-challenge-${spec.key}.png`, { type: "image/png" });
        const shareData: ShareData = {
          title: activeTemplate.title,
          text: activeTemplate.text,
          url: appUrl,
        };
        if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
          await navigator.share({ ...shareData, files: [file] });
          return;
        }
        await navigator.share(shareData);
      } catch {
        // user cancel and unsupported paths are intentionally silent
      }
    };

    return (
      <div className="dark mt-3 space-y-4">
        <div
          className="overflow-hidden rounded-[16px] border border-violet-500/20 bg-gradient-to-b from-[#0c0b1a] to-[#070714] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:p-5"
          style={{ borderColor: "rgba(124,107,255,0.22)" }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-white sm:text-base">
                <Sparkles className="h-4 w-4 shrink-0 text-amber-300/90" />
                Challenge yourself — Earn more RDM
              </div>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-400 sm:text-[13px]">
                Complete challenges daily to earn RDM instantly · Max{" "}
                <span className="font-semibold text-amber-300/95">{dailyRdmCap} RDM</span> per day from challenges
              </p>
            </div>
            <div className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-amber-500/30 bg-amber-500/[0.12] px-3 py-1.5 text-xs font-semibold text-amber-100">
              <Flame className="h-3.5 w-3.5 text-orange-400" />
              {streakDays} day streak
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-[12px] border border-white/10 bg-black/30 px-3 py-2.5">
            <Zap className="h-4 w-4 shrink-0 text-orange-400" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-slate-500">Daily RDM earned from challenges</p>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/55">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-fuchsia-500 transition-all duration-500"
                  style={{ width: `${rdmBarPct}%` }}
                />
              </div>
            </div>
            <span className="text-xs font-bold tabular-nums text-amber-300/95">
              {dailyRdmEarned} / {dailyRdmCap} RDM
            </span>
          </div>

          <div className="mt-5 rounded-[14px] border border-white/[0.12] bg-[#0f0e1c]/90 p-5 sm:p-6">
            <div className="text-center">
              <div className="text-5xl leading-none sm:text-6xl" aria-hidden>
                {emoji}
              </div>
              <p className="mt-4 font-serif text-2xl font-semibold tracking-tight text-white sm:text-[1.65rem]">{serifHeadline}</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">{sub}</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { k: "Progress", v: `${attempted}/${tot}` },
                { k: "Correct", v: String(correctCount) },
                { k: "% correct", v: `${pctCorrectOverall}%` },
                { k: "Time taken", v: timeTakenLabel },
              ].map((cell) => (
                <div
                  key={cell.k}
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-center shadow-inner shadow-black/20"
                >
                  <p className="text-xl font-bold tabular-nums text-white sm:text-2xl">{cell.v}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{cell.k}</p>
                </div>
              ))}
            </div>

            {!won ? (
              <p className="mt-4 text-center text-[11px] text-slate-500">
                RDM is awarded only when you pass — separate from the Play hub Daily Gauntlet.
              </p>
            ) : null}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
              <Button
                type="button"
                className={cn(
                  "h-12 rounded-xl border-0 text-base font-bold shadow-lg transition hover:opacity-95",
                  won
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-emerald-950"
                    : "bg-gradient-to-r from-teal-400 to-emerald-500 text-slate-950",
                )}
                onClick={onClose}
              >
                <span className="inline-flex items-center gap-2">
                  <Play className="h-4 w-4 fill-current" />
                  Try another challenge
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-xl border-white/20 bg-transparent text-base font-semibold text-white hover:bg-white/5"
                onClick={onClose}
              >
                Back to challenges
              </Button>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Share this result</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Caption {igTemplateIndex + 1}/{Math.max(1, igTemplates.length)} · {activeTemplate.tone}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 border-white/20 bg-transparent text-[11px] text-slate-100 hover:bg-white/10"
                  onClick={() => {
                    if (igTemplates.length <= 1) return;
                    setIgTemplateIndex((prev) => pickNextTemplate(prev, igTemplates.length));
                  }}
                >
                  <Shuffle className="mr-1 h-3.5 w-3.5" />
                  Shuffle template
                </Button>
              </div>
              <p className="text-[12px] leading-relaxed text-slate-300 whitespace-pre-line">{activeTemplate.text}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-9 bg-cyan-500 text-cyan-950 hover:bg-cyan-400"
                  onClick={() => void handleDownloadPng()}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  Download PNG
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 border-white/20 bg-transparent text-white hover:bg-white/10"
                  onClick={() => void handleNativeShare()}
                >
                  <Share2 className="mr-1.5 h-4 w-4" />
                  Share
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 border-white/20 bg-transparent text-white hover:bg-white/10"
                  onClick={() => openShareIntent(buildWhatsAppShareUrl(activeTemplate.text))}
                >
                  <MessageCircle className="mr-1.5 h-4 w-4" />
                  WhatsApp
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 border-white/20 bg-transparent text-white hover:bg-white/10"
                  onClick={() =>
                    void copyShareText(activeTemplate.text, {
                      title: "Caption copied!",
                      description: "Paste it in Instagram.",
                    })
                  }
                >
                  <Instagram className="mr-1.5 h-4 w-4" />
                  Instagram
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                  onClick={() =>
                    toast({
                      title: "Community posting",
                      description: "Post to community is coming soon.",
                    })
                  }
                >
                  Post to Community (soon)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 border-white/20 bg-transparent text-white hover:bg-white/10"
                  onClick={() => void copyShareText(activeTemplate.text)}
                >
                  <Copy className="mr-1.5 h-4 w-4" />
                  Copy caption
                </Button>
              </div>
            </div>

            <p className="mt-4 text-center text-[11px] text-slate-500">
              <Link href="/play" className="text-violet-400 underline-offset-2 hover:underline">
                Open Play hub
              </Link>{" "}
              for Daily Gauntlet &amp; streak
            </p>

            <div
              ref={shareCardRef}
              className="pointer-events-none fixed left-0 top-0 z-10 h-[768px] w-[768px] overflow-hidden rounded-[24px] border border-cyan-300/30 bg-[#070714] p-0 text-white opacity-0"
              aria-hidden
            >
              <div className="relative flex h-full w-full flex-col bg-[radial-gradient(circle_at_10%_15%,rgba(56,189,248,0.22),transparent_35%),radial-gradient(circle_at_85%_0%,rgba(250,204,21,0.12),transparent_35%),linear-gradient(140deg,#071025_0%,#090d1d_42%,#060812_100%)] px-6 py-6">
                <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.03)_0%,transparent_22%,transparent_78%,rgba(255,255,255,0.03)_100%)]" />
                <div className="relative z-10 flex h-full flex-col">
                  <p className="inline-flex rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
                    EduBlast Challenge Result
                  </p>

                  <div className="mt-4 flex items-start gap-3">
                    <div className="text-[54px] leading-none">💪</div>
                    <div className="min-w-0">
                      <p className="text-[36px] font-black uppercase leading-[0.96] tracking-tight text-white">{socialHeroKicker}</p>
                      <p
                        className={cn(
                          "mt-1 text-[42px] font-black uppercase leading-[0.94] tracking-tight",
                          won ? "text-amber-200" : "text-amber-100"
                        )}
                      >
                        {socialHeroMain}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[18px] border border-white/30 bg-white/14 px-4 py-4 shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
                    <p className="whitespace-pre-line text-[28px] font-semibold leading-[1.14] text-white">{socialMidMessage}</p>
                  </div>

                  <div className="mt-5 grid grid-cols-4 gap-2.5">
                    <div className="rounded-[14px] border border-cyan-300/45 bg-gradient-to-b from-cyan-500/16 to-cyan-950/35 p-3 text-center shadow-[0_0_22px_rgba(34,211,238,0.16)]">
                      <p className="text-[16px]">🪜</p>
                      <p className="mt-1 text-[44px] font-black tabular-nums text-amber-100 leading-none">
                        {attempted}/{tot}
                      </p>
                      <p className="mt-1 text-[14px] font-semibold uppercase tracking-[0.1em] text-slate-200">Progress</p>
                    </div>
                    <div className="rounded-[14px] border border-cyan-300/45 bg-gradient-to-b from-cyan-500/16 to-cyan-950/35 p-3 text-center shadow-[0_0_22px_rgba(34,211,238,0.16)]">
                      <p className="text-[16px]">🎯</p>
                      <p className="mt-1 text-[44px] font-black tabular-nums text-amber-100 leading-none">{correctCount}</p>
                      <p className="mt-1 text-[14px] font-semibold uppercase tracking-[0.1em] text-slate-200">Correct</p>
                    </div>
                    <div className="rounded-[14px] border border-cyan-300/45 bg-gradient-to-b from-cyan-500/16 to-cyan-950/35 p-3 text-center shadow-[0_0_22px_rgba(34,211,238,0.16)]">
                      <p className="text-[16px]">🧭</p>
                      <p className="mt-1 text-[44px] font-black tabular-nums text-amber-100 leading-none">{pctCorrectOverall}%</p>
                      <p className="mt-1 text-[14px] font-semibold uppercase tracking-[0.1em] text-slate-200">% correct</p>
                    </div>
                    <div className="rounded-[14px] border border-cyan-300/45 bg-gradient-to-b from-cyan-500/16 to-cyan-950/35 p-3 text-center shadow-[0_0_22px_rgba(34,211,238,0.16)]">
                      <p className="text-[16px]">⏱</p>
                      <p className="mt-1 text-[44px] font-black tabular-nums text-amber-100 leading-none">{timeTakenLabel}</p>
                      <p className="mt-1 text-[14px] font-semibold uppercase tracking-[0.1em] text-slate-200">Time taken</p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3 pb-1">
                    <p className="text-center text-[16px] font-medium text-slate-100">
                      RDM is separate from Daily Gauntlet and only awarded for full pass.
                    </p>
                    <div className="rounded-[12px] border border-cyan-300/35 bg-cyan-500/10 px-4 py-2.5 text-center">
                      <p className="text-[17px] font-black uppercase tracking-wide text-cyan-100">
                        Can you beat this run? Share yours.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const wrongSoFar = results.filter((r) => !r.is_correct).length;
  const displayStrikes = Math.min(MAX_STRIKES, wrongSoFar);
  const answeredCount = results.length;
  const scoreLabel =
    answeredCount === 0 ? "0 / 0" : `${correctCount} / ${answeredCount}`;
  const questionTrackPct = tot > 0 ? Math.min(100, ((idx + 1) / tot) * 100) : 0;
  const rdmBarPctPlay = dailyRdmCap > 0 ? Math.min(100, (dailyRdmEarned / dailyRdmCap) * 100) : 0;

  return (
    <div className="dark mt-3 space-y-4">
      <div
        className="overflow-hidden rounded-[16px] border border-violet-500/20 bg-gradient-to-b from-[#0c0b1a] to-[#070714] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:p-5"
        style={{ borderColor: "rgba(124,107,255,0.22)" }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-white sm:text-base">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-300/90" />
              Challenge yourself — Earn more RDM
            </div>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-400 sm:text-[13px]">
              Complete challenges daily to earn RDM instantly · Max{" "}
              <span className="font-semibold text-amber-300/95">{dailyRdmCap} RDM</span> per day from challenges
            </p>
          </div>
          <div className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-amber-500/30 bg-amber-500/[0.12] px-3 py-1.5 text-xs font-semibold text-amber-100">
            <Flame className="h-3.5 w-3.5 text-orange-400" />
            {streakDays} day streak
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-[12px] border border-white/10 bg-black/30 px-3 py-2.5">
          <Zap className="h-4 w-4 shrink-0 text-orange-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-slate-500">Daily RDM earned from challenges</p>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/55">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-fuchsia-500 transition-all duration-500"
                style={{ width: `${rdmBarPctPlay}%` }}
              />
            </div>
          </div>
          <span className="text-xs font-bold tabular-nums text-amber-300/95">
            {dailyRdmEarned} / {dailyRdmCap} RDM
          </span>
        </div>

        <div className="mt-5 rounded-[14px] border border-white/[0.1] bg-[#0f0e1c]/95 p-4 shadow-inner shadow-black/30 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-200">
              <span className="font-semibold tabular-nums text-white">
                Question {idx + 1} of {tot}
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-400">
                <Clock className="h-4 w-4 text-slate-500" />
                <span className={cn("font-mono text-sm tabular-nums", sessionLeft <= 30 ? "text-red-400" : "text-amber-300")}>
                  {formatClock(sessionLeft)}
                </span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold tabular-nums text-emerald-400/95">Score: {scoreLabel}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-full border-white/20 bg-black/30 px-4 text-xs font-semibold text-white hover:bg-white/10"
                onClick={handleQuit}
              >
                Quit
              </Button>
            </div>
          </div>

          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-[width] duration-300"
                style={{ width: `${questionTrackPct}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
              <span>
                <span className="mr-1">{spec.headerEmoji}</span>
                {spec.name}
                <span className="mx-1.5 text-slate-600">·</span>
                <span className={cn("font-semibold", rdmAccent)}>+{spec.rdm} RDM on win</span>
              </span>
              <span className="tabular-nums text-rose-300/90">
                Strikes {displayStrikes}/{MAX_STRIKES}
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-[12px] border border-white/[0.08] bg-black/25 p-2 sm:p-3">
            {questions[idx] ? (
              <PlayQuestionCard
                question={questions[idx]!}
                onAnswer={handleAnswer}
                onNext={handleNext}
                timerSeconds={0}
                showExplanation
                optionLayout="grid"
                hideInlineTimer
                disableAutoAdvance
              />
            ) : null}
          </div>

          <div className="mt-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
            <div className="mb-1 flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              <span>Session time</span>
              <span className="font-mono normal-case tabular-nums text-slate-400">{formatClock(sessionLeft)}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={cn("h-full rounded-full transition-[width] duration-300", sessionLeft <= 30 ? "bg-red-500" : accentFill)}
                style={{ width: `${sessionPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-slate-500">Tap an answer, then Next — three wrong answers end the run.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
