"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Coins, Loader2 } from "lucide-react";
import {
  NtaOptionBody,
  NtaQuestionStem,
  NtaRichTextBlock,
} from "@/components/prep-mock/nta/ntaExamParts";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { recordCbseChapterQuizAttempt } from "@/lib/mock/recordCbseChapterQuizAttempt";
import CbseChapterQuizCommunityShare from "@/components/prep-mock/library/CbseChapterQuizCommunityShare";
import { supabase } from "@/integrations/supabase/client";
import { useUserStore } from "@/store/useUserStore";
import { cn } from "@/lib/utils";
import { isOnboardingTaskCompanionLaunched } from "@/lib/onboarding/onboardingTaskCompanion";
import { handleDailyCbseMcqQuizComplete } from "@/lib/onboarding/dailyCbseMcqChecklist";
import {
  markOnboardingStepComplete,
  markOnboardingTaskComplete,
  getOnboardingProgress,
} from "@/lib/subscription/freeTrialClient";
import type { Question, Subject } from "@/types";

export type CbseChapterQuizResult = {
  correct: number;
  wrong: number;
  total: number;
  durationSeconds: number;
  answeredCount: number;
  attemptKey: string;
};

type CbseChapterQuizSessionProps = {
  questions: Question[];
  chapterTitle: string;
  subject: Subject;
  classLevel: 11 | 12;
  paperId: string;
  paperSlug: string;
  accessToken?: string | null;
  onComplete: (result: CbseChapterQuizResult) => void;
  onBack: () => void;
};

function shouldUseTwoColumnOptions(options: string[]): boolean {
  const nonEmpty = options.filter((o) => o?.trim());
  if (nonEmpty.length <= 2) return false;
  const maxLen = Math.max(...nonEmpty.map((o) => o.trim().length));
  return maxLen <= 42;
}

type Phase = "quiz" | "results";

export default function CbseChapterQuizSession({
  questions,
  chapterTitle,
  subject,
  classLevel,
  paperId,
  paperSlug,
  accessToken,
  onComplete,
  onBack,
}: CbseChapterQuizSessionProps) {
  const { toast } = useToast();
  const { user: authUser, profile, refreshProfile } = useAuth();
  const setRdmFromProfile = useUserStore((s) => s.setRdmFromProfile);
  const startedAtRef = useRef(Date.now());
  const recordSentRef = useRef(false);
  const scoreClaimSentRef = useRef(false);
  const attemptKeyRef = useRef("");

  const [phase, setPhase] = useState<Phase>("quiz");
  const [scoreRdmLine, setScoreRdmLine] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CbseChapterQuizResult | null>(null);

  const total = questions.length;
  const q = questions[currentIdx];
  const selected = q ? selectedAnswers[currentIdx] : undefined;
  const answered = typeof selected === "number";
  const isLast = currentIdx >= total - 1;

  const filledCount = useMemo(() => {
    let c = 0;
    for (let i = 0; i < total; i++) {
      if (typeof selectedAnswers[i] === "number") c++;
    }
    return c;
  }, [selectedAnswers, total]);

  const paperTitle = `Class ${classLevel} · ${chapterTitle}`;

  const scoreFromAnswers = useCallback(() => {
    let correct = 0;
    for (let i = 0; i < total; i++) {
      const sel = selectedAnswers[i];
      if (typeof sel === "number" && questions[i]!.correctAnswer === sel) correct++;
    }
    return correct;
  }, [questions, selectedAnswers, total]);

  const persistAttempt = useCallback(
    async (correct: number, durationSeconds: number) => {
      if (recordSentRef.current) return;
      recordSentRef.current = true;
      try {
        await recordCbseChapterQuizAttempt({
          accessToken,
          paperId,
          paperSlug,
          paperTitle,
          subject,
          correct,
          total,
          durationSeconds,
          attemptKey: attemptKeyRef.current || undefined,
        });
      } catch {
        /* Non-blocking; history may still show legacy rows */
      }
    },
    [accessToken, paperId, paperSlug, paperTitle, subject, total]
  );

  useEffect(() => {
    if (phase !== "results" || !result) return;
    void persistAttempt(result.correct, result.durationSeconds);
    onComplete(result);
  }, [phase, result, persistAttempt, onComplete]);

  useEffect(() => {
    if (phase !== "results" || !result || !authUser?.id) return;
    if (scoreClaimSentRef.current) return;
    scoreClaimSentRef.current = true;

    void (async () => {
      const { data: claimRaw, error: claimRpcError } = await supabase.rpc(
        "claim_cbse_mcq_chapter_score_rdm" as any,
        {
          p_paper_id: paperId,
          p_correct: result.correct,
          p_total: result.total,
          p_attempt_key: result.attemptKey,
        }
      );

      if (claimRpcError) {
        setScoreRdmLine("Quiz RDM could not be verified right now.");
        return;
      }

      const claim = claimRaw as unknown as Record<string, unknown> | null;
      if (claim?.ok === true) {
        const awarded =
          typeof claim.rdm_awarded === "number" && Number.isFinite(claim.rdm_awarded)
            ? Math.max(0, Math.trunc(claim.rdm_awarded))
            : 0;
        const pct =
          typeof claim.accuracy_pct === "number" && Number.isFinite(claim.accuracy_pct)
            ? Math.trunc(claim.accuracy_pct)
            : Math.round((100 * result.correct) / Math.max(1, result.total));
        const bal = claim.new_rdm_balance;
        if (typeof bal === "number" && Number.isFinite(bal)) {
          setRdmFromProfile(bal);
        } else {
          void refreshProfile();
        }
        const line =
          awarded > 0
            ? `+${awarded} RDM for ${pct}% accuracy (chapter quiz).`
            : "No quiz RDM for this run.";
        setScoreRdmLine(line);
        if (awarded > 0) {
          toast({
            title: "RDM earned",
            description: line,
          });
        }
        return;
      }

      const reason = typeof claim?.denial_reason === "string" ? claim.denial_reason : "unknown";
      if (reason === "below_minimum" || reason === "below_tier") {
        const pct =
          typeof claim?.accuracy_pct === "number" && Number.isFinite(claim.accuracy_pct)
            ? Math.trunc(claim.accuracy_pct as number)
            : Math.round((100 * result.correct) / Math.max(1, result.total));
        const minPct =
          typeof claim?.min_accuracy_pct === "number" && Number.isFinite(claim.min_accuracy_pct)
            ? Math.trunc(claim.min_accuracy_pct as number)
            : 60;
        setScoreRdmLine(`No win RDM — ${pct}% is below ${minPct}% required.`);
      } else if (reason === "already_claimed_session") {
        setScoreRdmLine("Quiz RDM was already credited for this run.");
      } else {
        setScoreRdmLine(null);
      }
    })();
  }, [phase, result, authUser?.id, paperId, toast, setRdmFromProfile, refreshProfile]);

  const handleSubmit = () => {
    setSubmitting(true);
    const correct = scoreFromAnswers();
    const wrong = total - correct;
    const durationSeconds = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
    attemptKeyRef.current = `${String(Date.now())}:${paperId}`;
    const next: CbseChapterQuizResult = {
      correct,
      wrong,
      total,
      durationSeconds,
      answeredCount: filledCount,
      attemptKey: attemptKeyRef.current,
    };
    setResult(next);
    setPhase("results");
    setSubmitting(false);

    // Onboarding CBSE MCQ task completion on quiz finish (so we do not interrupt them during the quiz)
    try {
      if (typeof window !== "undefined") {
        if (isOnboardingTaskCompanionLaunched("prep_mcq")) {
          // Explicitly mark all steps completed to guarantee completion
          [0, 1, 2, 3].forEach((idx) => {
            markOnboardingStepComplete("prep_mcq", idx);
          });
          markOnboardingTaskComplete("prep_mcq", { showChecklistToast: true });
          window.dispatchEvent(new CustomEvent("edublast-onboarding-prep-mcq-complete"));
        }
        if (authUser?.id) {
          handleDailyCbseMcqQuizComplete({
            userId: authUser.id,
            claimedAt: profile?.onboarding_reward_claimed_at ?? null,
            nowMs: Date.now() + (profile?.time_travel_offset_ms ?? 0),
          });
        }
      }
    } catch (e) {
      console.error("Failed to mark onboarding completion", e);
    }
  };

  if (phase === "results" && result) {
    return (
      <div className="edu-card space-y-5 rounded-2xl border border-border p-5 sm:p-6">
        <div className="text-center sm:text-left">
          <h2 className="text-lg font-bold text-foreground">Quiz complete</h2>
          <p className="mt-1 text-sm text-muted-foreground">{paperTitle}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
            <p className="text-xs text-muted-foreground">Correct</p>
            <p className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-300">
              {result.correct}
            </p>
          </div>
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-xs text-muted-foreground">Wrong</p>
            <p className="text-2xl font-bold tabular-nums text-destructive">{result.wrong}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">Score</p>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {result.correct}/{result.total}
            </p>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground sm:text-left">
          Saved to <span className="font-semibold text-foreground">Show history</span> on this tab.
        </p>

        {scoreRdmLine ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-sm text-foreground">
            <Coins className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
            <p>{scoreRdmLine}</p>
          </div>
        ) : null}

        <CbseChapterQuizCommunityShare
          chapterTitle={chapterTitle}
          subject={subject}
          classLevel={classLevel}
          paperId={paperId}
          paperSlug={paperSlug}
          attemptKey={result.attemptKey}
          correct={result.correct}
          total={result.total}
          answeredCount={result.answeredCount}
          durationSeconds={result.durationSeconds}
        />

        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onBack}>
            Back to chapters
          </Button>
        </div>
      </div>
    );
  }

  if (!q) return null;

  const isCorrectSelection = answered && selected === q.correctAnswer;
  const useTwoColumns = shouldUseTwoColumnOptions(q.options);

  return (
    <div className="edu-card space-y-4 rounded-2xl border border-border p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <p className="text-xs font-semibold text-muted-foreground" aria-live="polite">
          Question {currentIdx + 1} of {total}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {filledCount}/{total} answered
        </p>
      </div>

      <div className="min-w-0 space-y-3">
        <div className="min-w-0 max-w-full overflow-x-auto">
          <NtaQuestionStem q={q} mobile />
        </div>

        <div
          className={
            useTwoColumns ? "grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2" : "min-w-0 space-y-2"
          }
          role="radiogroup"
          aria-label={`Answers for question ${currentIdx + 1}`}
        >
          {q.options.map((opt, oi) => {
            const text = opt?.trim();
            if (!text) return null;
            const isCorrect = oi === q.correctAnswer;
            let cls = "bg-muted/70 hover:bg-muted text-foreground border-border";
            if (answered) {
              if (isCorrect) cls = "bg-green-500/12 border-green-500 text-foreground";
              else if (selected === oi && !isCorrectSelection)
                cls = "bg-destructive/10 border-destructive text-foreground";
              else cls = "bg-muted/60 text-muted-foreground border-border";
            }
            return (
              <button
                key={oi}
                type="button"
                disabled={answered}
                onClick={() => {
                  setSelectedAnswers((prev) => ({ ...prev, [currentIdx]: oi }));
                  if (isOnboardingTaskCompanionLaunched("prep_mcq")) {
                    markOnboardingStepComplete("prep_mcq", 3);
                  }
                }}
                role="radio"
                aria-checked={selected === oi}
                className={cn(
                  "flex min-w-0 w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                  cls
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background/90 text-sm font-bold">
                  {String.fromCharCode(65 + oi)}
                </span>
                <div className="min-w-0 flex-1 overflow-x-auto">
                  <NtaOptionBody text={text} mobile />
                </div>
              </button>
            );
          })}
        </div>

        {answered && (q.solutionHtml || q.solution) && (
          <div className="bits-quiz-explanation rounded-xl bg-muted/50 p-3 text-sm">
            <p className="mb-2 font-bold text-foreground">Explanation</p>
            <NtaRichTextBlock text={q.solutionHtml?.trim() || q.solution?.trim() || ""} mobile />
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full rounded-xl gap-1 sm:w-auto"
            disabled={currentIdx <= 0}
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            Previous
          </Button>
          <div className="flex w-full min-w-0 gap-2 sm:w-auto">
            <Button
              type="button"
              size="sm"
              className="edu-btn-primary h-9 min-w-0 flex-1 rounded-xl font-bold sm:min-w-[5.5rem] sm:flex-none"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  Submitting
                </>
              ) : (
                "Submit"
              )}
            </Button>
            {!isLast ? (
              <Button
                type="button"
                size="sm"
                className="edu-btn-primary h-9 min-w-0 flex-1 rounded-xl gap-1 font-bold sm:min-w-[5.5rem] sm:flex-none"
                disabled={submitting || !answered}
                onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4 shrink-0" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
