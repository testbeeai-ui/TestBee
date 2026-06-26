"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReferChallengeAntiCapture } from "@/hooks/useReferChallengeAntiCapture";
import { useScreenshotFilterEnabled } from "@/hooks/useScreenshotFilterEnabled";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToastAction } from "@/components/ui/toast";
import PlayQuestionCard from "@/components/PlayQuestionCard";
import type { EduBlastResultFlash } from "@/components/play/EduBlastChallengeCard";
import { remainingOptionsReviewMs } from "@/lib/rdm/eduBlastChallengeMeta";
import {
  buildEduBlastDotStates,
  difficultyRatingToLabel,
  playCategoryToSubjectTag,
} from "@/lib/rdm/eduBlastChallengeMeta";
import { fetchReferChallengeQuestions } from "@/lib/play/questions/fetchReferChallengeQuestions";
import { buildWhatsAppShareUrl } from "@/lib/rdm/referral/referChallengeShareUrls";
import {
  buildReferSharePayload,
  buildReferShareTemplates,
  pickNextTemplate,
  type ReferChallengeShareTemplate,
} from "@/lib/rdm/referral/referChallengeShareTemplates";
import { bumpUserStudyDayMs } from "@/lib/dashboard/studyDayBump";
import {
  markEarnChallengeCompanionCommunityShared,
  markEarnChallengeCompanionStarted,
  markEarnChallengeCompanionRoundComplete,
} from "@/lib/onboarding/earnChallengeCompanionOnboarding";
import { shufflePlayQuestionOptions } from "@/lib/play/questions/shufflePlayQuestionOptions";
import {
  referChallengePerQuestionTotalSec,
  referChallengeSessionDurationSec,
  type ReferChallengePublicSpec,
  type ReferClaimKey,
} from "@/lib/rdm/referral/referEarnChallenges";
import { cn } from "@/lib/utils";
import type { PlayQuestionRow } from "@/types";
import {
  CameraOff,
  Clock,
  Flame,
  Loader2,
  MessageCircle,
  Play,
  Shuffle,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

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
  onClaimsUpdated?: () => void | Promise<void>;
  streakDays?: number;
  dailyRdmEarned?: number;
  dailyRdmCap?: number;
};

type SummaryReason = "won" | "strikes" | "time" | "below_threshold" | "quit" | null;
type RoundOutcome = "correct" | "wrong" | "skip";

export default function InlineRdmChallenge({
  spec,
  onClose,
  onTerminal,
  onClaimsUpdated,
  streakDays = 0,
  dailyRdmEarned = 0,
  dailyRdmCap = 50,
}: InlineRdmChallengeProps) {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const sessionSec = referChallengeSessionDurationSec(spec);
  const perQuestionTotalSec = referChallengePerQuestionTotalSec(spec);
  const optionsPhaseSec = spec.optionsPhaseSec;
  const readPhaseSec = spec.readPhaseSec;
  const [bootLoading, setBootLoading] = useState(true);
  const [questions, setQuestions] = useState<PlayQuestionRow[]>([]);
  /** When the bank returns fewer than requested, scale the pass bar (same ratio as spec). */
  const [minPassCorrect, setMinPassCorrect] = useState(spec.minCorrect);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<
    { question_id: string; is_correct: boolean; time_taken_ms: number }[]
  >([]);
  const resultsRef = useRef(results);
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  const [sessionLeft, setSessionLeft] = useState(sessionSec);
  const [phase, setPhase] = useState<"playing" | "summary">("playing");
  const [summaryReason, setSummaryReason] = useState<SummaryReason>(null);
  const [igTemplateIndex, setIgTemplateIndex] = useState(0);
  const [winClaimed, setWinClaimed] = useState(false);
  const [shareClaimed, setShareClaimed] = useState(false);
  const [claimingWin, setClaimingWin] = useState(false);
  const [claimingShare, setClaimingShare] = useState(false);
  const [winClaimFailed, setWinClaimFailed] = useState(false);
  const [postPreviewOpen, setPostPreviewOpen] = useState(false);
  const [communityDraftTitle, setCommunityDraftTitle] = useState("");
  const [communityDraftBody, setCommunityDraftBody] = useState("");
  const [perQuestionLeft, setPerQuestionLeft] = useState(perQuestionTotalSec);
  const [resultReviewMs, setResultReviewMs] = useState(() =>
    remainingOptionsReviewMs(optionsPhaseSec, optionsPhaseSec)
  );
  const perQuestionLeftRef = useRef(perQuestionLeft);
  const [timeoutResolving, setTimeoutResolving] = useState(false);
  const [roundOutcomes, setRoundOutcomes] = useState<RoundOutcome[]>([]);
  const [resultFlash, setResultFlash] = useState<EduBlastResultFlash | null>(null);
  const terminalFiredRef = useRef(false);
  const winAutoClaimAttemptedRef = useRef(false);
  const sessionEndRef = useRef(false);
  const sessionStartedAtRef = useRef<number | null>(null);
  const shareCardRef = useRef<HTMLDivElement | null>(null);
  const questionsRef = useRef(questions);
  const indexRef = useRef(index);
  const phaseRef = useRef(phase);
  const questionRoundDeadlineRef = useRef<number | null>(null);
  const questionRoundStartedAtRef = useRef<number | null>(null);
  const answeredThisRoundRef = useRef(false);
  const questionTimeoutFiredRef = useRef(false);
  const advanceAfterResultRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAdvancingRef = useRef(false);
  useEffect(() => {
    questionsRef.current = questions;
    indexRef.current = index;
  }, [questions, index]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    perQuestionLeftRef.current = perQuestionLeft;
  }, [perQuestionLeft]);

  const lockResultReviewFromRemaining = useCallback(() => {
    const ms = remainingOptionsReviewMs(perQuestionLeftRef.current, optionsPhaseSec);
    setResultReviewMs(ms);
    return ms;
  }, [optionsPhaseSec]);

  const fireTerminal = useCallback(
    (outcome: "won" | "lost") => {
      if (terminalFiredRef.current) return;
      terminalFiredRef.current = true;
      markEarnChallengeCompanionRoundComplete();
      onTerminal?.({ claimKey: spec.key, outcome });
    },
    [onTerminal, spec.key]
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
      setRoundOutcomes([]);
      setResultFlash(null);
      setIgTemplateIndex(0);
      setWinClaimed(false);
      setShareClaimed(false);
      setClaimingWin(false);
      setClaimingShare(false);
      setWinClaimFailed(false);
      setPostPreviewOpen(false);
      terminalFiredRef.current = false;
      winAutoClaimAttemptedRef.current = false;
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
      markEarnChallengeCompanionStarted();
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

  const finalizeRun = useCallback(
    (reason: "strikes" | "time" | "finish") => {
      const correct = resultsRef.current.filter((r) => r.is_correct).length;
      const passedBar = correct >= minPassCorrect;
      if (passedBar) {
        setClaimingWin(true);
      }
      setPhase("summary");
      if (passedBar) {
        setSummaryReason("won");
        fireTerminal("won");
      } else {
        setSummaryReason(reason === "finish" ? "below_threshold" : reason);
        fireTerminal("lost");
      }
    },
    [fireTerminal, minPassCorrect]
  );

  const recordPlayResult = useCallback(
    async (selectedIndex: number, timeTakenMs: number) => {
      const q = questionsRef.current[indexRef.current];
      if (!q || phaseRef.current !== "playing") return;
      const isCorrect = selectedIndex === q.correct_answer_index;
      const alreadyLocal = resultsRef.current.some((r) => r.question_id === q.id);
      await supabase.rpc("record_play_result", {
        p_question_id: q.id,
        p_is_correct: isCorrect,
        p_time_taken_ms: timeTakenMs,
        p_category: undefined,
        p_pool_key: spec.playCategory,
        p_selected_answer_index: selectedIndex,
      });
      void bumpUserStudyDayMs(timeTakenMs);
      if (alreadyLocal) return;
      const row = { question_id: q.id, is_correct: isCorrect, time_taken_ms: timeTakenMs };
      const next = [...resultsRef.current, row];
      resultsRef.current = next;
      setResults(next);
    },
    [spec.playCategory]
  );

  const pushLocalResult = useCallback(
    (row: { question_id: string; is_correct: boolean; time_taken_ms: number }) => {
      if (resultsRef.current.some((r) => r.question_id === row.question_id)) return;
      const next = [...resultsRef.current, row];
      resultsRef.current = next;
      setResults(next);
    },
    []
  );

  const proceedAfterAnswer = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    const misses = resultsRef.current.filter((r) => !r.is_correct).length;
    if (misses >= MAX_STRIKES) {
      finalizeRun("strikes");
      return;
    }
    const curIdx = indexRef.current;
    const qs = questionsRef.current;
    if (curIdx >= qs.length - 1) {
      finalizeRun("finish");
      return;
    }
    setIndex(curIdx + 1);
  }, [finalizeRun]);

  const handleQuestionTimeout = useCallback(async () => {
    const q = questionsRef.current[indexRef.current];
    if (!q || phaseRef.current !== "playing") return;
    setTimeoutResolving(true);
    answeredThisRoundRef.current = true;
    lockResultReviewFromRemaining();
    questionRoundDeadlineRef.current = null;
    const nOpt = Array.isArray(q.options) ? q.options.length : 4;
    const wrongPick =
      Array.from({ length: nOpt }, (_, i) => i).find((i) => i !== q.correct_answer_index) ?? 0;
    const started = questionRoundStartedAtRef.current ?? Date.now();
    const elapsed = Date.now() - started;
    setRoundOutcomes((o) => [...o, "skip"]);
    setResultFlash({
      type: "skip",
      message: "⏱ Time up — marked as unanswered",
    });
    pushLocalResult({
      question_id: q.id,
      is_correct: false,
      time_taken_ms: elapsed,
    });
    try {
      await recordPlayResult(wrongPick, elapsed);
    } catch {
      void bumpUserStudyDayMs(elapsed);
    } finally {
      setTimeoutResolving(false);
    }
  }, [recordPlayResult, pushLocalResult, lockResultReviewFromRemaining]);

  useEffect(() => {
    if (phase !== "playing" || questions.length === 0) {
      questionRoundDeadlineRef.current = null;
      setPerQuestionLeft(perQuestionTotalSec);
      return;
    }
    questionRoundDeadlineRef.current = Date.now() + perQuestionTotalSec * 1000;
    questionRoundStartedAtRef.current = Date.now();
    answeredThisRoundRef.current = false;
    questionTimeoutFiredRef.current = false;
    setPerQuestionLeft(perQuestionTotalSec);
    setResultReviewMs(remainingOptionsReviewMs(optionsPhaseSec, optionsPhaseSec));
    setResultFlash(null);
    isAdvancingRef.current = false;
  }, [phase, index, questions.length, perQuestionTotalSec, optionsPhaseSec]);

  useEffect(() => {
    if (phase !== "playing" || questions.length === 0) return;
    const sessionStart = sessionStartedAtRef.current;
    if (!sessionStart) return;

    let timeoutInFlight = false;

    const tick = () => {
      if (phaseRef.current !== "playing") return;

      const sessionEndMs = sessionStart + sessionSec * 1000;
      const nextSessionLeft = Math.max(0, Math.ceil((sessionEndMs - Date.now()) / 1000));
      setSessionLeft(nextSessionLeft);
      if (nextSessionLeft === 0 && !sessionEndRef.current) {
        sessionEndRef.current = true;
        finalizeRun("time");
        return;
      }

      const qEnd = questionRoundDeadlineRef.current;
      if (qEnd && !answeredThisRoundRef.current) {
        const qLeft = Math.max(0, Math.ceil((qEnd - Date.now()) / 1000));
        setPerQuestionLeft(qLeft);
        if (qLeft === 0 && !questionTimeoutFiredRef.current && !timeoutInFlight) {
          questionTimeoutFiredRef.current = true;
          timeoutInFlight = true;
          void handleQuestionTimeout().finally(() => {
            timeoutInFlight = false;
          });
        }
      }
    };

    const id = window.setInterval(tick, 250);
    tick();
    return () => window.clearInterval(id);
  }, [phase, questions.length, index, sessionSec, finalizeRun, handleQuestionTimeout]);

  const handleAnswer = async (selectedIndex: number, timeTakenMs: number) => {
    const q = questionsRef.current[indexRef.current];
    if (!q || answeredThisRoundRef.current) return;
    answeredThisRoundRef.current = true;
    lockResultReviewFromRemaining();
    questionRoundDeadlineRef.current = null;
    const isCorrect = selectedIndex === q.correct_answer_index;
    pushLocalResult({
      question_id: q.id,
      is_correct: isCorrect,
      time_taken_ms: timeTakenMs,
    });
    setRoundOutcomes((o) => [...o, isCorrect ? "correct" : "wrong"]);
    setResultFlash({
      type: isCorrect ? "correct" : "wrong",
      message: isCorrect
        ? `✓ Correct! +${spec.winRdm} RDM on pass`
        : `✗ Incorrect — correct answer was option ${q.correct_answer_index + 1}`,
    });
    try {
      await recordPlayResult(selectedIndex, timeTakenMs);
    } catch {
      void bumpUserStudyDayMs(timeTakenMs);
    }
  };

  const handleSkip = useCallback(async () => {
    const q = questionsRef.current[indexRef.current];
    if (!q || answeredThisRoundRef.current || phaseRef.current !== "playing") return;
    answeredThisRoundRef.current = true;
    lockResultReviewFromRemaining();
    questionRoundDeadlineRef.current = null;
    const started = questionRoundStartedAtRef.current ?? Date.now();
    const elapsed = Date.now() - started;
    const nOpt = Array.isArray(q.options) ? q.options.length : 4;
    const wrongPick =
      Array.from({ length: nOpt }, (_, i) => i).find((i) => i !== q.correct_answer_index) ?? 0;
    pushLocalResult({
      question_id: q.id,
      is_correct: false,
      time_taken_ms: elapsed,
    });
    setRoundOutcomes((o) => [...o, "skip"]);
    setResultFlash({
      type: "skip",
      message: "→ Skipped — marked as unanswered",
    });
    try {
      await recordPlayResult(wrongPick, elapsed);
    } catch {
      void bumpUserStudyDayMs(elapsed);
    }
  }, [recordPlayResult, pushLocalResult, lockResultReviewFromRemaining]);

  const handleNext = useCallback(() => {
    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;
    if (advanceAfterResultRef.current) {
      clearTimeout(advanceAfterResultRef.current);
      advanceAfterResultRef.current = null;
    }
    setResultFlash(null);
    proceedAfterAnswer();
  }, [proceedAfterAnswer]);

  useEffect(() => {
    if (advanceAfterResultRef.current) {
      clearTimeout(advanceAfterResultRef.current);
      advanceAfterResultRef.current = null;
    }
    if (phase !== "playing" || results.length <= index) return;
    advanceAfterResultRef.current = setTimeout(() => {
      advanceAfterResultRef.current = null;
      handleNext();
    }, resultReviewMs);
    return () => {
      if (advanceAfterResultRef.current) {
        clearTimeout(advanceAfterResultRef.current);
        advanceAfterResultRef.current = null;
      }
    };
  }, [phase, index, results.length, handleNext, resultReviewMs]);

  const screenshotFilterEnabled = useScreenshotFilterEnabled();
  const { showCaptureBlockOverlay, dismissCaptureBlockOverlay } = useReferChallengeAntiCapture({
    enabled: screenshotFilterEnabled && phase === "playing" && questions.length > 0 && !bootLoading,
    clipboardMessage:
      "Screenshots and screen capture are not available during this Earn & Learn challenge.",
  });

  /** `document.body` — portal mounts before paint so `fixed` isn’t trapped by challenge card ancestors. */
  const [capturePortalReady, setCapturePortalReady] = useState(false);
  useLayoutEffect(() => {
    setCapturePortalReady(true);
  }, []);

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

  const claimReward = useCallback(
    async (rewardType: "win" | "share") => {
      const { data, error } = await supabase.rpc("claim_refer_challenge_reward", {
        p_challenge_key: spec.key,
        p_reward_type: rewardType,
      });
      if (error) throw new Error(error.message);
      const payload = (data ?? {}) as {
        ok?: boolean;
        error?: string;
        claimed_now?: boolean;
        already_claimed?: boolean;
        reward_rdm?: number;
        rdm?: number;
      };
      if (!payload.ok) throw new Error(payload.error ?? "Claim failed");
      return payload;
    },
    [spec.key]
  );

  const handleClaimWinReward = useCallback(async () => {
    if (winClaimed) return;
    setClaimingWin(true);
    setWinClaimFailed(false);
    try {
      const result = await claimReward("win");
      setWinClaimed(true);
      const winAmt = typeof result.reward_rdm === "number" ? result.reward_rdm : spec.winRdm;
      const winBalance =
        typeof result.rdm === "number" ? ` You’re at ${result.rdm} RDM total.` : "";
      toast({
        title: result.already_claimed
          ? "Your win reward is already in your wallet"
          : `Nice work — +${winAmt} RDM added`,
        description: result.already_claimed
          ? `We counted this win earlier today — nothing missing on your side.${winBalance}`
          : `You showed up and cleared the bar. Share below when you’re ready for your extra share bonus.${winBalance}`,
      });
      await onClaimsUpdated?.();
      await refreshProfile();
    } catch (error) {
      setWinClaimFailed(true);
      toast({
        title: "We couldn’t add win RDM just now",
        description:
          error instanceof Error ? error.message : "Take a breath and try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setClaimingWin(false);
    }
  }, [winClaimed, claimReward, spec.winRdm, onClaimsUpdated, refreshProfile, toast]);

  /** Win RDM auto-claim: do not gate on `claimingWin` — `finalizeRun` sets it true before summary so the UI shows “crediting”; gating would skip the RPC forever. */
  useEffect(() => {
    if (phase !== "summary" || summaryReason !== "won" || winClaimed) return;
    if (winAutoClaimAttemptedRef.current) return;
    winAutoClaimAttemptedRef.current = true;
    void handleClaimWinReward();
  }, [phase, summaryReason, winClaimed, handleClaimWinReward]);

  const postToCommunityFeed = useCallback(
    async (text: string, title: string) => {
      if (!user?.id) throw new Error("Sign in required");
      const { data, error } = await supabase
        .from("lessons_raw_posts")
        .insert({
          user_id: user.id,
          // Must match DB check constraint: ('post' | 'doubt' | 'instacue')
          kind: "post",
          title,
          content: text,
          tags: ["challenge", "refer-earn", spec.domain, spec.key],
          subject: spec.domain === "academic" ? "math" : null,
          source_type: "refer_challenge",
          source_payload: {
            challengeKey: spec.key,
            challengeName: spec.name,
            domain: spec.domain,
          },
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      if (!data?.id) throw new Error("Post created but ID was not returned.");
      return String(data.id);
    },
    [spec.domain, spec.key, spec.name, user?.id]
  );

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
    const sub = won
      ? `You scored ${pctCorrectOverall}% correct overall (${correctCount}/${tot} of ${tot} questions${attempted < tot ? `; ${attempted} answered before the run ended` : ""}) and cleared the ${passBar}/${tot} pass bar.`
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
    const appUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/refer-earn`
        : "https://edublast.in/refer-earn";
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
    const shareBonusFallback = `Earn & Learn: share from here for up to +${spec.shareRdm} RDM (one share bonus per challenge per day).`;
    const fallbackTemplate: ReferChallengeShareTemplate = {
      id: "fallback",
      platform: "instagram",
      tone: "progress",
      title: "Challenge result",
      body: `${correctCount}/${tot} correct`,
      cta: appUrl,
      text: ["Challenge result", `${correctCount}/${tot} correct`, appUrl].join("\n\n"),
      waTitle: "Challenge result",
      waBody: `${correctCount}/${tot} correct`,
      waCta: appUrl,
      whatsappText: [
        "Challenge result",
        `${correctCount}/${tot} correct`,
        appUrl,
        shareBonusFallback,
      ].join("\n\n"),
      shareBonusNote: shareBonusFallback,
      charCount: `${correctCount}/${tot} correct`.length,
    };
    const activeTemplate =
      igTemplates[igTemplateIndex % Math.max(1, igTemplates.length)] ?? fallbackTemplate;
    const defaultCommunityBody = [activeTemplate.body, activeTemplate.cta]
      .filter(Boolean)
      .join("\n\n");
    const showShareActions = !won || winClaimed;
    const socialHeroKicker = won
      ? "THE WINNING RUN"
      : strongScore
        ? "THE HEARTBREAK RUN"
        : "THE COMEBACK RUN";
    const socialHeroMain = won
      ? "BAR CLEARED, BIG ENERGY"
      : strongScore
        ? "STRONG SCORE, NO WIN"
        : "RESET, RELOAD, RISE";
    const socialMidMessage = won
      ? `CRUSHED THE RDM BAR (${passBar}/${tot}) WITH ${pctCorrectOverall}% CORRECT ACROSS ALL ${tot} QUESTIONS.\nPROGRESS: ${attempted}/${tot}. MOMENTUM IS REAL.`
      : strongScore
        ? `HIT THE RDM BAR (${passBar}/${tot}) WITH ${pctCorrectOverall}% CORRECT ACROSS ALL ${tot} QUESTIONS,\nBUT GOT STOPPED RIGHT BEFORE THE FINAL FINISH LINE.\nPROGRESS: ${attempted}/${tot}. SO CLOSE.`
        : `NEEDED ${passBar}/${tot} TO WIN THIS RUN.\nLANDED AT ${correctCount}/${tot} (${pctCorrectOverall}% OF ALL QUESTIONS).\nNEXT RUN: SHARPER, FASTER, STRONGER.`;

    /**
     * Opens a tab synchronously (preserves user gesture), then navigates after async work.
     * Reduces “popup blocked” after await compared to window.open(url) post-claim.
     */
    const openUrlInPreparedTab = (tab: Window | null, url: string): boolean => {
      if (!tab) return false;
      try {
        tab.location.href = url;
        return true;
      } catch {
        try {
          tab.close();
        } catch {
          /* ignore */
        }
        return false;
      }
    };

    type ShareClaimResult =
      | { ok: true; kind: "fresh" | "already"; rewardRdm: number; rdm?: number }
      | { ok: false };

    const shareAlreadyClaimedToastCopy = {
      title: "You already claimed today’s share",
      description:
        "Come back tomorrow to earn the share bonus on this challenge again. (One share reward per challenge per day — you can still share a different challenge today if you haven’t.)",
    } as const;

    const ensureShareRewardClaimed = async (opts?: {
      silent?: boolean;
    }): Promise<ShareClaimResult> => {
      if (shareClaimed) {
        return { ok: true, kind: "already", rewardRdm: spec.shareRdm };
      }
      setClaimingShare(true);
      try {
        const result = await claimReward("share");
        setShareClaimed(true);
        const shareAmt = typeof result.reward_rdm === "number" ? result.reward_rdm : spec.shareRdm;
        const kind: "fresh" | "already" = result.already_claimed ? "already" : "fresh";
        const rdm = typeof result.rdm === "number" ? result.rdm : undefined;
        if (!opts?.silent) {
          const balanceLine = rdm !== undefined ? ` You’re at ${rdm} RDM total.` : "";
          const shareAwarded = shareAmt > 0;
          toast(
            result.already_claimed
              ? {
                  title: shareAlreadyClaimedToastCopy.title,
                  description: `${shareAlreadyClaimedToastCopy.description}${balanceLine}`,
                }
              : {
                  title: shareAwarded
                    ? `Love it — +${shareAmt} RDM for sharing`
                    : "Love it — shared successfully",
                  description: shareAwarded
                    ? `Putting your progress out there matters. We’ve added your share bonus.${balanceLine}`
                    : `Putting your progress out there matters. Your share was recorded.${balanceLine}`,
                }
          );
        }
        await onClaimsUpdated?.();
        await refreshProfile();
        return { ok: true, kind, rewardRdm: shareAmt, rdm };
      } catch (error) {
        toast({
          title: "Share bonus couldn’t be added yet",
          description: error instanceof Error ? error.message : "Give it another try in a moment.",
          variant: "destructive",
        });
        return { ok: false };
      } finally {
        setClaimingShare(false);
      }
    };

    const handlePostToCommunity = async () => {
      const titleForPost = communityDraftTitle.trim();
      const bodyForPost = communityDraftBody.trim();
      if (titleForPost.length < 3) {
        toast({
          title: "Headline too short",
          description: "Please enter at least 3 characters for the community headline.",
          variant: "destructive",
        });
        return;
      }
      if (bodyForPost.length > 2000) {
        toast({
          title: "Body too long",
          description: "Community post body must be 2000 characters or fewer.",
          variant: "destructive",
        });
        return;
      }
      try {
        const postId = await postToCommunityFeed(bodyForPost, titleForPost);
        markEarnChallengeCompanionCommunityShared();
        setPostPreviewOpen(false);
        void ensureShareRewardClaimed();
        toast({
          title: "Posted — your voice is live",
          description: "Thanks for sharing with the community. Open your post below.",
          action: (
            <ToastAction
              altText="View post"
              onClick={() =>
                (window.location.href = `/home?focusPost=${encodeURIComponent(postId)}`)
              }
            >
              View post
            </ToastAction>
          ),
        });
      } catch (error) {
        toast({
          title: "Community post failed",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      }
    };

    const handleShareWhatsApp = async () => {
      const tab = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;
      const claim = await ensureShareRewardClaimed({ silent: true });
      if (!claim.ok) {
        try {
          tab?.close();
        } catch {
          /* ignore */
        }
        return;
      }
      const url = buildWhatsAppShareUrl(activeTemplate.whatsappText);
      const balanceHint =
        typeof claim.rdm === "number"
          ? `You’re at ${claim.rdm} RDM total.`
          : "Your updated total is in your wallet up top.";
      const navigated = openUrlInPreparedTab(tab, url);
      if (!navigated) {
        const fallbackOpened =
          typeof window !== "undefined"
            ? Boolean(window.open(url, "_blank", "noopener,noreferrer"))
            : false;
        if (!fallbackOpened) {
          toast(
            claim.kind === "fresh"
              ? {
                  title: "Bonus secured — you’re building momentum",
                  description: `+${claim.rewardRdm} RDM is in your account. ${balanceHint} This browser didn’t open WhatsApp in a new tab — copy your caption from above, or allow new windows for this site so the next tap goes straight through.`,
                }
              : {
                  title: shareAlreadyClaimedToastCopy.title,
                  description: `${shareAlreadyClaimedToastCopy.description} ${balanceHint} Copy the caption above if you still want to tell friends; allow new windows if WhatsApp should open in one tap.`,
                }
          );
        } else if (claim.kind === "fresh") {
          toast({
            title: "WhatsApp is open — and your bonus landed",
            description: `+${claim.rewardRdm} RDM added for sharing. ${balanceHint}`,
          });
        } else {
          toast({
            title: shareAlreadyClaimedToastCopy.title,
            description: `${shareAlreadyClaimedToastCopy.description} ${balanceHint} WhatsApp should be open — you can still share your caption if you like.`,
          });
        }
        return;
      }
      if (claim.kind === "fresh") {
        toast({
          title: "WhatsApp is opening — nice one",
          description: `+${claim.rewardRdm} RDM added for putting your progress out there. ${balanceHint}`,
        });
      } else {
        toast({
          title: shareAlreadyClaimedToastCopy.title,
          description: `${shareAlreadyClaimedToastCopy.description} ${balanceHint}`,
        });
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
                Earn &amp; Learn challenges build your RDM balance. Up to{" "}
                <span className="font-semibold text-amber-300/95">{dailyRdmCap} RDM</span> per day
                from this activity.
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
              <p className="text-[11px] font-medium text-slate-500">
                Daily RDM earned from challenges
              </p>
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
              <p className="mt-4 font-serif text-2xl font-semibold tracking-tight text-white sm:text-[1.65rem]">
                {serifHeadline}
              </p>
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
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {cell.k}
                  </p>
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
                    : "bg-gradient-to-r from-teal-400 to-emerald-500 text-slate-950"
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
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Share this result
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Caption {igTemplateIndex + 1}/{Math.max(1, igTemplates.length)} ·{" "}
                    {activeTemplate.tone}
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
              <p className="text-[12px] font-semibold leading-relaxed text-slate-100">
                {activeTemplate.title}
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-300 whitespace-pre-line">
                {[activeTemplate.body, activeTemplate.cta].filter(Boolean).join("\n\n")}
              </p>
              {won && !winClaimed && claimingWin ? (
                <p className="mt-3 flex items-center gap-2 text-[11px] font-medium text-emerald-200/95">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Auto-claiming +{spec.winRdm} RDM (win)…
                </p>
              ) : null}
              {won && !winClaimed && !claimingWin && winClaimFailed ? (
                <div className="mt-3">
                  <Button
                    type="button"
                    size="sm"
                    className="h-10 bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                    onClick={() => {
                      winAutoClaimAttemptedRef.current = false;
                      void handleClaimWinReward();
                    }}
                  >
                    Retry win RDM auto-claim
                  </Button>
                </div>
              ) : null}
              {showShareActions ? (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                      disabled={claimingShare}
                      onClick={() => {
                        setCommunityDraftTitle(activeTemplate.title);
                        setCommunityDraftBody(defaultCommunityBody);
                        setPostPreviewOpen(true);
                      }}
                    >
                      {claimingShare ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <Users className="mr-1.5 h-4 w-4" />
                      )}
                      Post to Community
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 border-white/20 bg-transparent text-white hover:bg-white/10"
                      disabled={claimingShare}
                      onClick={() => void handleShareWhatsApp()}
                    >
                      {claimingShare ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <MessageCircle className="mr-1.5 h-4 w-4" />
                      )}
                      WhatsApp
                    </Button>
                  </div>
                  <p className="mt-2.5 text-[11px] font-semibold leading-relaxed text-white">
                    {activeTemplate.shareBonusNote}
                  </p>
                </>
              ) : won && !winClaimed ? (
                <p className="mt-3 text-[11px] text-slate-500">
                  Share unlocks after win RDM is credited to your balance.
                </p>
              ) : (
                <p className="mt-3 text-[11px] text-slate-500">
                  Pass the challenge to unlock sharing and win RDM.
                </p>
              )}
              <Dialog open={postPreviewOpen} onOpenChange={setPostPreviewOpen}>
                <DialogContent className="max-w-xl border-white/15 bg-[#0d0f1d] text-white">
                  <DialogHeader>
                    <DialogTitle>Preview & edit community post</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Adjust the headline and body below, then click{" "}
                      <strong className="text-slate-200">Post now</strong>. Headline must be at
                      least 3 characters; body up to 2000.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="community-post-title"
                        className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400"
                      >
                        Title (community headline)
                      </label>
                      <Input
                        id="community-post-title"
                        value={communityDraftTitle}
                        onChange={(e) => setCommunityDraftTitle(e.target.value)}
                        maxLength={200}
                        className="border-white/15 bg-black/40 text-white placeholder:text-slate-600"
                        placeholder="Short headline"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="community-post-body"
                          className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400"
                        >
                          Body
                        </label>
                        <span className="text-[10px] text-slate-500 tabular-nums">
                          {communityDraftBody.length}/2000
                        </span>
                      </div>
                      <Textarea
                        id="community-post-body"
                        value={communityDraftBody}
                        onChange={(e) => setCommunityDraftBody(e.target.value)}
                        maxLength={2000}
                        rows={6}
                        className="min-h-[140px] resize-y border-white/15 bg-black/40 text-sm text-slate-100 placeholder:text-slate-600"
                        placeholder="Post body"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      onClick={() => {
                        setCommunityDraftTitle(activeTemplate.title);
                        setCommunityDraftBody(defaultCommunityBody);
                      }}
                    >
                      Reset to template
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/20 bg-transparent text-white"
                      onClick={() => setPostPreviewOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="bg-amber-500 text-amber-950 hover:bg-amber-400"
                      disabled={claimingShare}
                      onClick={() => void handlePostToCommunity()}
                    >
                      {claimingShare ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                      Post now
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
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
                      <p className="text-[36px] font-black uppercase leading-[0.96] tracking-tight text-white">
                        {socialHeroKicker}
                      </p>
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
                    <p className="whitespace-pre-line text-[28px] font-semibold leading-[1.14] text-white">
                      {socialMidMessage}
                    </p>
                  </div>

                  <div className="mt-5 grid grid-cols-4 gap-2.5">
                    <div className="rounded-[14px] border border-cyan-300/45 bg-gradient-to-b from-cyan-500/16 to-cyan-950/35 p-3 text-center shadow-[0_0_22px_rgba(34,211,238,0.16)]">
                      <p className="text-[16px]">🪜</p>
                      <p className="mt-1 text-[44px] font-black tabular-nums text-amber-100 leading-none">
                        {attempted}/{tot}
                      </p>
                      <p className="mt-1 text-[14px] font-semibold uppercase tracking-[0.1em] text-slate-200">
                        Progress
                      </p>
                    </div>
                    <div className="rounded-[14px] border border-cyan-300/45 bg-gradient-to-b from-cyan-500/16 to-cyan-950/35 p-3 text-center shadow-[0_0_22px_rgba(34,211,238,0.16)]">
                      <p className="text-[16px]">🎯</p>
                      <p className="mt-1 text-[44px] font-black tabular-nums text-amber-100 leading-none">
                        {correctCount}
                      </p>
                      <p className="mt-1 text-[14px] font-semibold uppercase tracking-[0.1em] text-slate-200">
                        Correct
                      </p>
                    </div>
                    <div className="rounded-[14px] border border-cyan-300/45 bg-gradient-to-b from-cyan-500/16 to-cyan-950/35 p-3 text-center shadow-[0_0_22px_rgba(34,211,238,0.16)]">
                      <p className="text-[16px]">🧭</p>
                      <p className="mt-1 text-[44px] font-black tabular-nums text-amber-100 leading-none">
                        {pctCorrectOverall}%
                      </p>
                      <p className="mt-1 text-[14px] font-semibold uppercase tracking-[0.1em] text-slate-200">
                        % correct
                      </p>
                    </div>
                    <div className="rounded-[14px] border border-cyan-300/45 bg-gradient-to-b from-cyan-500/16 to-cyan-950/35 p-3 text-center shadow-[0_0_22px_rgba(34,211,238,0.16)]">
                      <p className="text-[16px]">⏱</p>
                      <p className="mt-1 text-[44px] font-black tabular-nums text-amber-100 leading-none">
                        {timeTakenLabel}
                      </p>
                      <p className="mt-1 text-[14px] font-semibold uppercase tracking-[0.1em] text-slate-200">
                        Time taken
                      </p>
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
  const wrongCount = roundOutcomes.filter((o) => o === "wrong").length;
  const skipCount = roundOutcomes.filter((o) => o === "skip").length;
  const dotStates = buildEduBlastDotStates(tot, idx, roundOutcomes);
  const currentQ = questions[idx];
  /** Denominator is full challenge length so skips/timeouts still count toward the bar (same as summary %). */
  const scoreLabel = tot > 0 ? `${correctCount} / ${tot}` : "0 / 0";
  const accuracyPctRunning = tot > 0 ? Math.round((correctCount / tot) * 100) : 0;
  const questionTrackPct = tot > 0 ? Math.min(100, ((idx + 1) / tot) * 100) : 0;
  const rdmBarPctPlay = dailyRdmCap > 0 ? Math.min(100, (dailyRdmEarned / dailyRdmCap) * 100) : 0;
  const awaitingAdvance = results.length > idx;
  const optionsRevealCountdown = perQuestionLeft > optionsPhaseSec;
  const pacePhaseLabel = optionsRevealCountdown ? "Stem · read only" : "Choices · tap an option";

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
              <span className="font-semibold text-amber-300/95">{dailyRdmCap} RDM</span> per day
              from challenges
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
            <p className="text-[11px] font-medium text-slate-500">
              Daily RDM earned from challenges
            </p>
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
          <div className="space-y-2 border-b border-white/10 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-200">
                <span className="font-semibold tabular-nums text-white">
                  Question {idx + 1} of {tot}
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-400">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Session
                  </span>
                  <span
                    className={cn(
                      "font-mono text-sm tabular-nums",
                      sessionLeft <= 30 ? "text-red-400" : "text-amber-300"
                    )}
                  >
                    {formatClock(sessionLeft)}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold tabular-nums text-emerald-400/95">
                  Score: {scoreLabel}
                  {tot > 0 ? (
                    <span className="ml-1.5 font-normal text-slate-400">
                      ({accuracyPctRunning}%)
                    </span>
                  ) : null}
                </span>
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
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
              {awaitingAdvance ? (
                <p className="text-[11px] leading-snug text-slate-400">
                  <span className="font-semibold text-emerald-200/90">Recorded</span> · Options stay
                  visible with any time left on the 10s answer clock (tap{" "}
                  <span className="font-semibold text-white">Next</span> to skip). Session clock
                  still runs.
                </p>
              ) : (
                <p className="text-[11px] leading-snug text-slate-400">
                  <span className="font-semibold text-slate-200">{pacePhaseLabel}</span>
                  <span className="text-slate-600"> · </span>
                  <span className="font-mono text-slate-400">{formatClock(readPhaseSec)}</span>
                  <span className="mx-1 text-slate-600">+</span>
                  <span className="font-mono text-slate-400">{formatClock(optionsPhaseSec)}</span>
                  <span className="ml-1.5 text-slate-600">per question · timer in card</span>
                </p>
              )}
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
                <span className={cn("font-semibold", rdmAccent)}>+{spec.winRdm} RDM on win</span>
              </span>
              <span className="tabular-nums text-rose-300/90">
                Strikes {displayStrikes}/{MAX_STRIKES}
              </span>
            </div>
          </div>

          <div className="relative mt-4 overflow-hidden rounded-[12px] border border-white/[0.08] bg-black/25 p-2 sm:p-3">
            <div
              className="demo-mm-cap-shield-soft pointer-events-none absolute inset-0 z-0 rounded-[10px]"
              aria-hidden
            />
            <div className="relative z-10">
              {questions[idx] ? (
                <PlayQuestionCard
                  challengeUi="edublast"
                  question={questions[idx]!}
                  onAnswer={handleAnswer}
                  onNext={handleNext}
                  onSkip={handleSkip}
                  timerSeconds={0}
                  secondsLeft={perQuestionLeft}
                  readPhaseSec={readPhaseSec}
                  optionsPhaseSec={optionsPhaseSec}
                  questionIndex={idx}
                  questionTotal={tot}
                  dotStates={dotStates}
                  subjectLabel={playCategoryToSubjectTag(currentQ?.category, spec.domain)}
                  difficultyLabel={difficultyRatingToLabel(currentQ?.difficulty_rating ?? 3)}
                  marksLabel={`+${spec.winRdm} RDM`}
                  correctCount={correctCount}
                  wrongCount={wrongCount}
                  skipCount={skipCount}
                  rdmLabel="0 RDM"
                  playDomain={spec.domain}
                  showExplanation
                  disableAutoAdvance
                  resultPauseMs={resultReviewMs}
                  answered={awaitingAdvance}
                  resultFlash={resultFlash}
                  awaitingAdvance={awaitingAdvance}
                  disableInteraction={timeoutResolving}
                />
              ) : null}
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
            <div className="mb-1 flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              <span>Session time</span>
              <span className="font-mono normal-case tabular-nums text-slate-400">
                {formatClock(sessionLeft)}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-300",
                  sessionLeft <= 30 ? "bg-red-500" : accentFill
                )}
                style={{ width: `${sessionPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
              Stem, then choices. No pick before the question clock hits zero counts as wrong and
              advances. Tap <span className="font-semibold text-slate-400">Next</span> after you
              answer. Three strikes end the run.
            </p>
          </div>
        </div>
      </div>

      {capturePortalReady && showCaptureBlockOverlay
        ? createPortal(
            <div
              className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950 px-6"
              role="status"
              aria-live="polite"
              style={{ isolation: "isolate" }}
            >
              <div className="relative max-w-md rounded-2xl border border-white/15 bg-slate-900/55 px-6 py-8 text-center shadow-2xl">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="absolute right-3 top-3 h-8 rounded-full border-white/20 bg-black/30 px-3 text-xs font-semibold text-white hover:bg-white/10"
                  onClick={dismissCaptureBlockOverlay}
                >
                  OK
                </Button>
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-slate-100">
                  <CameraOff className="h-6 w-6" aria-hidden />
                </div>
                <p className="text-base font-semibold tracking-tight text-slate-50">
                  Screenshots and screencapture are not allowed here.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-300/95">
                  Press OK to go back to your question.
                </p>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
