"use client";

import { cn } from "@/lib/utils";
import styles from "../styles";

export type DiveProgressVariant = "completion" | "proficiency" | "quiz";

type DiveProgressBarProps = {
  valuePct: number;
  variant?: DiveProgressVariant;
  className?: string;
  trackClassName?: string;
  "aria-label"?: string;
};

export default function DiveProgressBar({
  valuePct,
  variant = "completion",
  className,
  trackClassName,
  "aria-label": ariaLabel,
}: DiveProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, valuePct));
  const isQuiz = variant === "quiz";

  return (
    <div
      className={cn(isQuiz ? styles.quizProgressTrack : styles.statBarTrack, trackClassName, className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          isQuiz ? styles.quizProgressFill : styles.statBarFill,
          !isQuiz && variant === "completion" && styles.statCompletion,
          !isQuiz && variant === "proficiency" && styles.statProficiency
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
