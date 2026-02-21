"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import type { PlayQuestionRow } from "@/types";

const STRIKE_COLOR = "bg-destructive/20 border-2 border-destructive text-foreground";
const CORRECT_COLOR = "bg-accent/20 border-2 border-accent text-foreground";
const MUTED_COLOR = "bg-muted/50 text-muted-foreground";

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
}

export default function PlayQuestionCard({
  question,
  onAnswer,
  onNext,
  timerSeconds = 0,
  onTimeout,
  showExplanation = true,
}: PlayQuestionCardProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const startTime = useRef<number>(Date.now());
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    startTime.current = Date.now();
    setTimeLeft(timerSeconds);
    setSelectedOption(null);
    setAnswered(false);
  }, [question.id, timerSeconds]);

  useEffect(() => {
    if (answered || timerSeconds <= 0) return;
    if (timeLeft <= 0) {
      onTimeout?.();
      return;
    }
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, answered, timerSeconds, onTimeout]);

  const text = (question.content && typeof question.content === "object" && "text" in question.content)
    ? (question.content as { text: string }).text
    : String(question.content ?? "");
  const options: string[] = Array.isArray(question.options) ? question.options : [];
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
    if (onNext) {
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

  return (
    <div className="space-y-3">
      {timerSeconds > 0 && !answered && (
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-muted-foreground">Time</span>
          <span className={`text-lg font-mono font-bold ${timeLeft <= 5 ? "text-destructive" : "text-foreground"}`}>
            {timeLeft}s
          </span>
        </div>
      )}
      <div className="bg-card rounded-2xl p-5 shadow-lg border border-border">
        <h3 className="text-lg font-bold text-foreground leading-snug mb-4">{text}</h3>
        <div className="space-y-2">
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
                className={`w-full text-left p-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${optionClass}`}
              >
                <span className="w-7 h-7 rounded-full bg-background/50 flex items-center justify-center text-xs font-bold shrink-0">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{option}</span>
                {answered && i === correctIndex && <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />}
                {answered && i === selectedOption && !isCorrect && <XCircle className="w-5 h-5 text-destructive shrink-0" />}
              </motion.button>
            );
          })}
        </div>
        {answered && showExplanation && question.explanation && (
          <div className="mt-4 p-3 rounded-xl bg-muted border border-border">
            <p className="text-sm text-foreground">{question.explanation}</p>
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
            <span className="relative z-10 flex items-center justify-center gap-2">Next <span className="text-xs font-normal opacity-80">(Auto-advancing...)</span> →</span>

            {/* Animated progress background for auto-advance */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "0%" }}
              transition={{ duration: 2.5, ease: "linear" }}
              className="absolute inset-0 bg-white/20 z-0"
            />
          </Button>
        </motion.div>
      )}
    </div>
  );
}
