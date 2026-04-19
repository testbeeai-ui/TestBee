"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import type { PlayQuestionRow } from "@/types";
import { cn } from "@/lib/utils";
import PlayQuestionMarkdown from "@/components/PlayQuestionMarkdown";

/** High-contrast feedback on dark DailyDose / arena modals (theme accent can be too subtle). */
const STRIKE_COLOR =
  "bg-red-500/15 border-2 border-red-500 text-foreground shadow-[inset_0_0_0_1px_rgba(239,68,68,0.25)] dark:bg-red-950/40 dark:border-red-400 dark:shadow-[inset_0_0_0_1px_rgba(248,113,113,0.2)]";
const CORRECT_COLOR =
  "bg-emerald-500/15 border-2 border-emerald-600 text-foreground shadow-[inset_0_0_0_1px_rgba(16,185,129,0.3)] dark:bg-emerald-950/35 dark:border-emerald-400 dark:shadow-[inset_0_0_0_1px_rgba(52,211,153,0.25)]";
const MUTED_COLOR = "bg-muted/45 text-muted-foreground border border-transparent opacity-90";

interface PlayQuestionCardProps {
  question: PlayQuestionRow;
  onAnswer: (selectedIndex: number, timeTakenMs: number) => void;
  /** Called when user clicks Next after answering (e.g. go to next question) */
  onNext?: () => void;
  /** Seconds per question; when 0 no countdown */
  timerSeconds?: number;
  onTimeout?: () => void;
  /** Hide explanation after answer */
  showExplanation?: boolean;
  /** Parent can mirror the countdown (e.g. arena header clock). */
  onTimerTick?: (secondsLeft: number) => void;
  /** Hide the small "Time / Ns" row when the parent shows the clock. */
  hideInlineTimer?: boolean;
  /** "grid" matches investor mock 2×2 options. */
  optionLayout?: "stack" | "grid";
  /** When true, Next is only via the button (no 2.5s auto-advance). */
  disableAutoAdvance?: boolean;
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
}: PlayQuestionCardProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const startTime = useRef<number>(Date.now());
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutFiredRef = useRef(false);

  // Clear auto-advance timer on unmount to prevent stale onNext calls
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
    if (answered || timerSeconds <= 0) return;
    if (timeLeft <= 0) {
      if (!timeoutFiredRef.current) {
        timeoutFiredRef.current = true;
        onTimeout?.();
      }
      return;
    }
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, answered, timerSeconds, onTimeout]);

  useEffect(() => {
    if (timerSeconds > 0) onTimerTick?.(timeLeft);
  }, [timeLeft, timerSeconds, onTimerTick]);

  const text =
    (question.content && typeof question.content === "object" && "text" in question.content)
      ? String((question.content as { text: string }).text ?? "")
      : String(question.content ?? "");
  const options: string[] = Array.isArray(question.options)
    ? question.options.map((o) => String(o))
    : [];
  const correctIndex = question.correct_answer_index ?? 0;
  const isCorrect = selectedOption === correctIndex;

  const handleAnswer = (index: number) => {
    if (answered) return;
    setSelectedOption(index);
    setAnswered(true);
    const timeTakenMs = Date.now() - startTime.current;
    onAnswer(index, timeTakenMs);

    if (index === correctIndex) {
      import("canvas-confetti").then((c) =>
        c.default({ particleCount: 50, spread: 60, origin: { y: 0.7 } })
      );
    }

    // Auto-advance after 2.5 seconds — store timer so it can be cancelled
    if (onNext && !disableAutoAdvance) {
      autoAdvanceTimer.current = setTimeout(() => {
        autoAdvanceTimer.current = null;
        onNext();
      }, 2500);
    }
  };

  const handleNext = () => {
    // Cancel the auto-advance so it doesn't fire again
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    onNext?.();
  };

  const optGrid = optionLayout === "grid";

  return (
    <div className="space-y-3">
      {timerSeconds > 0 && !answered && !hideInlineTimer && (
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-muted-foreground">Time</span>
          <span className={`text-lg font-mono font-bold ${timeLeft <= 5 ? "text-destructive" : "text-foreground"}`}>
            {timeLeft}s
          </span>
        </div>
      )}
      <div className={cn("bg-card rounded-2xl p-5 shadow-lg border border-border", optGrid && "p-4 sm:p-5")}>
        <PlayQuestionMarkdown
          variant="stem"
          source={text}
          className={cn(
            "mb-4 font-bold leading-snug",
            optGrid ? "text-base sm:text-lg" : "text-lg",
            "[&_.katex]:text-[1em] [&_.katex-display]:my-1",
          )}
        />
        <div className={cn(optGrid ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : "space-y-2")}>
          {options.map((option, i) => {
            let optionClass = "bg-muted hover:bg-muted/80 text-foreground";
            if (answered) {
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
                disabled={answered}
                whileTap={!answered ? { scale: 0.98 } : undefined}
                className={cn(
                  "w-full text-left rounded-xl font-semibold text-sm transition-all flex items-center gap-2",
                  optGrid ? "p-2.5 sm:p-3 min-h-[3rem]" : "p-3",
                  optionClass
                )}
              >
                <span className="w-7 h-7 rounded-full bg-background/50 flex items-center justify-center text-xs font-bold shrink-0">
                  {String.fromCharCode(65 + i)}
                </span>
                <div className="min-w-0 flex-1 text-left">
                  <PlayQuestionMarkdown variant="option" source={option} className="font-semibold" />
                </div>
                {answered && i === correctIndex && (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} aria-hidden />
                )}
                {answered && i === selectedOption && !isCorrect && (
                  <XCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" strokeWidth={2.5} aria-hidden />
                )}
              </motion.button>
            );
          })}
        </div>
        {answered && showExplanation && question.explanation && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-3 dark:border-emerald-500/30 dark:bg-emerald-950/25">
            <PlayQuestionMarkdown
              variant="explanation"
              source={String(question.explanation ?? "")}
              className="text-sm"
            />
          </div>
        )}
      </div>
      {answered && onNext && (
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
