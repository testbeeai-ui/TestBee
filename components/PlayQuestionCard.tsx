"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import type { PlayDomain, PlayQuestionRow } from "@/types";
import { cn } from "@/lib/utils";
import PlayQuestionMarkdown from "@/components/PlayQuestionMarkdown";
import EduBlastChallengeCard, {
  type EduBlastResultFlash,
} from "@/components/play/EduBlastChallengeCard";
import {
  buildEduBlastDotStates,
  difficultyRatingToLabel,
  playCategoryToSubjectTag,
  type EduBlastDotState,
} from "@/lib/rdm/eduBlastChallengeMeta";

/** High-contrast feedback on dark DailyDose / arena modals (theme accent can be too subtle). */
const STRIKE_COLOR =
  "bg-red-500/15 border-2 border-red-500 text-foreground shadow-[inset_0_0_0_1px_rgba(239,68,68,0.25)] dark:bg-red-950/40 dark:border-red-400 dark:shadow-[inset_0_0_0_1px_rgba(248,113,113,0.2)]";
const CORRECT_COLOR =
  "bg-emerald-500/15 border-2 border-emerald-600 text-foreground shadow-[inset_0_0_0_1px_rgba(16,185,129,0.3)] dark:bg-emerald-950/35 dark:border-emerald-400 dark:shadow-[inset_0_0_0_1px_rgba(52,211,153,0.25)]";
const MUTED_COLOR = "bg-muted/45 text-muted-foreground border border-transparent opacity-90";

interface PlayQuestionCardProps {
  question: PlayQuestionRow;
  onAnswer: (selectedIndex: number, timeTakenMs: number) => void;
  onNext?: () => void;
  timerSeconds?: number;
  onTimeout?: () => void;
  showExplanation?: boolean;
  onTimerTick?: (secondsLeft: number) => void;
  hideInlineTimer?: boolean;
  optionLayout?: "stack" | "grid";
  disableAutoAdvance?: boolean;
  optionsConcealed?: boolean;
  optionsConcealedHint?: string;
  optionsConcealedQuestionClock?: string;
  optionsConcealedUntilChoicesClock?: string;
  disableInteraction?: boolean;
  watermarkText?: string;
  /** Investor Edu Blast · Challenge shell (read-only phase + confirm/skip). */
  challengeUi?: "default" | "edublast";
  /** Required for edublast UI */
  questionIndex?: number;
  questionTotal?: number;
  dotStates?: EduBlastDotState[];
  readPhaseSec?: number;
  optionsPhaseSec?: number;
  secondsLeft?: number;
  subjectLabel?: string;
  difficultyLabel?: string;
  marksLabel?: string;
  correctCount?: number;
  wrongCount?: number;
  skipCount?: number;
  rdmLabel?: string;
  onSkip?: () => void;
  answered?: boolean;
  resultFlash?: EduBlastResultFlash | null;
  awaitingAdvance?: boolean;
  confirmedIndex?: number | null;
  playDomain?: PlayDomain;
  resultPauseMs?: number;
}

export default function PlayQuestionCard({
  question,
  onAnswer,
  onNext,
  timerSeconds = 0,
  onTimeout,
  showExplanation = true,
  onTimerTick,
  hideInlineTimer = false,
  optionLayout = "stack",
  disableAutoAdvance = false,
  optionsConcealed = false,
  optionsConcealedHint: _optionsConcealedHint,
  optionsConcealedQuestionClock: _optionsConcealedQuestionClock,
  optionsConcealedUntilChoicesClock: _optionsConcealedUntilChoicesClock,
  disableInteraction = false,
  watermarkText,
  challengeUi = "default",
  questionIndex = 0,
  questionTotal = 1,
  dotStates,
  readPhaseSec,
  optionsPhaseSec,
  secondsLeft: secondsLeftProp,
  subjectLabel,
  difficultyLabel,
  marksLabel,
  correctCount = 0,
  wrongCount = 0,
  skipCount = 0,
  rdmLabel,
  onSkip,
  answered: answeredProp,
  resultFlash,
  awaitingAdvance = false,
  confirmedIndex,
  playDomain = "academic",
  resultPauseMs,
}: PlayQuestionCardProps) {
  const useEduBlast = challengeUi === "edublast" || optionsConcealed;

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const startTime = useRef<number>(Date.now());
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutFiredRef = useRef(false);

  /** Parent `answered={false}` must not override local confirm — use `||`, not `??`. */
  const answeredState = answered || Boolean(answeredProp);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
        autoAdvanceTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    timeoutFiredRef.current = false;
    startTime.current = Date.now();
    setTimeLeft(timerSeconds);
    setSelectedOption(null);
    setAnswered(false);
  }, [question.id, timerSeconds]);

  useEffect(() => {
    if (answeredState || timerSeconds <= 0) return;
    if (timeLeft <= 0) {
      if (!timeoutFiredRef.current) {
        timeoutFiredRef.current = true;
        onTimeout?.();
      }
      return;
    }
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, answeredState, timerSeconds, onTimeout]);

  useEffect(() => {
    if (timerSeconds > 0) onTimerTick?.(timeLeft);
  }, [timeLeft, timerSeconds, onTimerTick]);

  const optsPhase =
    optionsPhaseSec ?? (timerSeconds > 0 ? Math.min(10, timerSeconds) : 10);
  const readPhase =
    readPhaseSec ?? (timerSeconds > 0 ? Math.max(0, timerSeconds - optsPhase) : 20);
  const perQuestionTotal = readPhase + optsPhase;
  const secondsLeft =
    secondsLeftProp ?? (timerSeconds > 0 ? timeLeft : perQuestionTotal);

  const resolvedDots =
    dotStates ??
    buildEduBlastDotStates(questionTotal, questionIndex, []);

  if (useEduBlast) {
    const handleConfirm = (index: number, timeTakenMs: number) => {
      setSelectedOption(index);
      setAnswered(true);
      onAnswer(index, timeTakenMs);
    };

    const handleSkip = () => {
      if (!onSkip) return;
      setAnswered(true);
      void onSkip();
    };

    return (
      <EduBlastChallengeCard
        question={question}
        questionIndex={questionIndex}
        questionTotal={questionTotal}
        dotStates={resolvedDots}
        subjectLabel={
          subjectLabel ??
          playCategoryToSubjectTag(question.category, playDomain)
        }
        difficultyLabel={
          difficultyLabel ?? difficultyRatingToLabel(question.difficulty_rating)
        }
        marksLabel={marksLabel}
        secondsLeft={secondsLeft}
        perQuestionTotalSec={perQuestionTotal}
        readPhaseSec={readPhase}
        optionsPhaseSec={optsPhase}
        correctCount={correctCount}
        wrongCount={wrongCount}
        skipCount={skipCount}
        rdmLabel={rdmLabel}
        onConfirm={handleConfirm}
        onSkip={handleSkip}
        onNext={onNext}
        answered={answeredState}
        confirmedIndex={confirmedIndex ?? selectedOption}
        resultFlash={resultFlash}
        awaitingAdvance={awaitingAdvance}
        disableInteraction={disableInteraction}
        watermarkText={watermarkText}
        showExplanation={showExplanation}
        disableAutoAdvance={disableAutoAdvance}
        resultPauseMs={resultPauseMs}
      />
    );
  }

  const text =
    question.content && typeof question.content === "object" && "text" in question.content
      ? String((question.content as { text: string }).text ?? "")
      : String(question.content ?? "");
  const options: string[] = Array.isArray(question.options)
    ? question.options.map((o) => String(o))
    : [];
  const correctIndex = question.correct_answer_index ?? 0;
  const isCorrect = selectedOption === correctIndex;

  const handleAnswer = (index: number) => {
    if (answeredState) return;
    setSelectedOption(index);
    setAnswered(true);
    const timeTakenMs = Date.now() - startTime.current;
    onAnswer(index, timeTakenMs);

    if (index === correctIndex) {
      void import("canvas-confetti").then((c) =>
        c.default({ particleCount: 50, spread: 60, origin: { y: 0.7 } })
      );
    }

    if (onNext && !disableAutoAdvance) {
      autoAdvanceTimer.current = setTimeout(() => {
        autoAdvanceTimer.current = null;
        onNext();
      }, 2500);
    }
  };

  const handleNext = () => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    onNext?.();
  };

  const optGrid = optionLayout === "grid";

  return (
    <div className="space-y-3">
      {timerSeconds > 0 && !answeredState && !hideInlineTimer && (
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-muted-foreground">Time</span>
          <span
            className={`text-lg font-mono font-bold ${timeLeft <= 5 ? "text-destructive" : "text-foreground"}`}
          >
            {timeLeft}s
          </span>
        </div>
      )}
      <div
        className={cn(
          "relative bg-card rounded-2xl p-5 shadow-lg border border-border",
          optGrid && "p-4 sm:p-5"
        )}
      >
        {watermarkText ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 select-none text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/10"
          >
            {watermarkText}
          </div>
        ) : null}
        <PlayQuestionMarkdown
          variant="stem"
          source={text}
          className={cn(
            "mb-3 font-bold leading-snug sm:mb-4",
            optGrid ? "text-sm sm:text-base lg:text-lg" : "text-sm sm:text-base lg:text-lg",
            "[&_.katex]:text-[0.95em] sm:[&_.katex]:text-[1em] [&_.katex-display]:my-1"
          )}
        />
        <div className={cn(optGrid ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : "space-y-2")}>
          {options.map((option, i) => {
            let optionClass = "bg-muted hover:bg-muted/80 text-foreground";
            if (answeredState) {
              if (i === correctIndex) optionClass = CORRECT_COLOR;
              else if (i === selectedOption && !isCorrect) optionClass = STRIKE_COLOR;
              else optionClass = MUTED_COLOR;
            } else if (i === selectedOption) {
              optionClass = "bg-primary/20 border-2 border-primary text-foreground";
            }
            return (
              <motion.button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={answeredState || disableInteraction}
                whileTap={!answeredState ? { scale: 0.98 } : undefined}
                className={cn(
                  "w-full text-left rounded-lg font-semibold text-xs transition-all flex items-center gap-1.5 sm:rounded-xl sm:text-sm sm:gap-2",
                  optGrid ? "p-2 sm:p-2.5 lg:p-3 min-h-[2.5rem] sm:min-h-[3rem]" : "p-2 sm:p-3",
                  optionClass
                )}
              >
                <span className="w-5 h-5 rounded-full bg-background/50 flex items-center justify-center text-[10px] font-bold shrink-0 sm:w-7 sm:h-7 sm:text-xs">
                  {String.fromCharCode(65 + i)}
                </span>
                <div className="min-w-0 flex-1 text-left">
                  <PlayQuestionMarkdown
                    variant="option"
                    source={option}
                    className="font-semibold"
                  />
                </div>
                {answeredState && i === correctIndex && (
                  <CheckCircle2
                    className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                )}
                {answeredState && i === selectedOption && !isCorrect && (
                  <XCircle
                    className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                )}
              </motion.button>
            );
          })}
        </div>
        {answeredState && showExplanation && question.explanation && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] p-2.5 sm:mt-4 sm:rounded-xl sm:p-3 dark:border-emerald-500/30 dark:bg-emerald-950/25">
            <PlayQuestionMarkdown
              variant="explanation"
              source={String(question.explanation ?? "")}
              className="text-xs sm:text-sm"
            />
          </div>
        )}
      </div>
      {answeredState && onNext && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
          <Button
            onClick={handleNext}
            size="lg"
            className="w-full rounded-xl font-bold overflow-hidden relative group"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              Next →
              {!disableAutoAdvance && (
                <span className="text-xs font-normal opacity-80">(Auto-advancing...)</span>
              )}
            </span>
            {!disableAutoAdvance && (
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "0%" }}
                transition={{ duration: 2.5, ease: "linear" }}
                className="absolute inset-0 bg-white/20 z-0"
              />
            )}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
