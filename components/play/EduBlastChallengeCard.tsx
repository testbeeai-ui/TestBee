"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayQuestionRow } from "@/types";
import PlayQuestionMarkdown from "@/components/PlayQuestionMarkdown";
import {
  formatEduBlastClock,
  RESULT_FLASH_MS,
  type EduBlastDotState,
} from "@/lib/eduBlastChallengeMeta";
import { cn } from "@/lib/utils";

const RING_CIRCUMFERENCE = 138.2;

export type EduBlastResultFlash = {
  type: "correct" | "wrong" | "skip";
  message: string;
};

export interface EduBlastChallengeCardProps {
  question: PlayQuestionRow;
  questionIndex: number;
  questionTotal: number;
  dotStates: EduBlastDotState[];
  subjectLabel: string;
  difficultyLabel: string;
  marksLabel?: string;
  secondsLeft: number;
  perQuestionTotalSec: number;
  readPhaseSec: number;
  optionsPhaseSec: number;
  correctCount: number;
  wrongCount: number;
  skipCount: number;
  rdmLabel?: string;
  onConfirm: (selectedIndex: number, timeTakenMs: number) => void;
  onSkip?: () => void;
  onNext?: () => void;
  answered?: boolean;
  selectedIndex?: number | null;
  resultFlash?: EduBlastResultFlash | null;
  awaitingAdvance?: boolean;
  disableInteraction?: boolean;
  watermarkText?: string;
  showExplanation?: boolean;
  confirmedIndex?: number | null;
  disableAutoAdvance?: boolean;
  resultPauseMs?: number;
}

function dotClass(state: EduBlastDotState): string {
  switch (state) {
    case "correct":
      return "done";
    case "wrong":
      return "wrong";
    case "skip":
      return "skip";
    case "current":
      return "current";
    default:
      return "";
  }
}

export default function EduBlastChallengeCard({
  question,
  questionIndex,
  questionTotal,
  dotStates,
  subjectLabel,
  difficultyLabel,
  marksLabel,
  secondsLeft,
  readPhaseSec,
  optionsPhaseSec,
  correctCount,
  wrongCount,
  skipCount,
  rdmLabel,
  onConfirm,
  onSkip,
  onNext,
  answered = false,
  selectedIndex: selectedIndexProp,
  resultFlash,
  awaitingAdvance = false,
  disableInteraction = false,
  watermarkText,
  showExplanation = true,
  confirmedIndex,
  disableAutoAdvance = false,
  resultPauseMs = RESULT_FLASH_MS,
}: EduBlastChallengeCardProps) {
  const [localSelected, setLocalSelected] = useState<number | null>(null);
  const [resultSecondsLeft, setResultSecondsLeft] = useState(0);
  const startTimeRef = useRef(Date.now());
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIndex =
    selectedIndexProp !== undefined ? selectedIndexProp : localSelected;

  useEffect(() => {
    startTimeRef.current = Date.now();
    setLocalSelected(null);
    return () => {
      if (autoAdvanceRef.current) {
        clearTimeout(autoAdvanceRef.current);
        autoAdvanceRef.current = null;
      }
    };
  }, [question.id]);

  useEffect(() => {
    if (!answered) {
      setResultSecondsLeft(0);
      return;
    }
    const totalSec = Math.max(1, Math.ceil(resultPauseMs / 1000));
    setResultSecondsLeft(totalSec);
    const deadline = Date.now() + resultPauseMs;
    const id = window.setInterval(() => {
      setResultSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 200);
    return () => window.clearInterval(id);
  }, [answered, resultPauseMs, question.id]);

  useEffect(() => {
    if (!answered || !onNext || disableAutoAdvance) return;
    autoAdvanceRef.current = setTimeout(() => {
      autoAdvanceRef.current = null;
      onNext();
    }, resultPauseMs);
    return () => {
      if (autoAdvanceRef.current) {
        clearTimeout(autoAdvanceRef.current);
        autoAdvanceRef.current = null;
      }
    };
  }, [answered, onNext, disableAutoAdvance, resultPauseMs, question.id]);

  const text =
    question.content && typeof question.content === "object" && "text" in question.content
      ? String((question.content as { text: string }).text ?? "")
      : String(question.content ?? "");
  const options: string[] = Array.isArray(question.options)
    ? question.options.map((o) => String(o))
    : [];
  const correctIndex = question.correct_answer_index ?? 0;
  const explanation = question.explanation?.trim() || "";

  const displaySecondsLeft = answered ? resultSecondsLeft : secondsLeft;
  const resultReviewSec = Math.max(1, Math.ceil(resultPauseMs / 1000));

  const isReadPhase = !answered && displaySecondsLeft > optionsPhaseSec;
  const isAnswerPhase = !answered && displaySecondsLeft <= optionsPhaseSec && displaySecondsLeft > 0;
  const isUrgent = isAnswerPhase && displaySecondsLeft <= 5;

  const phaseBannerClass = answered
    ? "read"
    : isUrgent
      ? "urgent"
      : isReadPhase
        ? "read"
        : "answer";

  const phaseLabel = answered
    ? "RESULT"
    : isUrgent
      ? "ANSWER NOW"
      : isReadPhase
        ? "READ-ONLY PHASE"
        : "ANSWER PHASE";

  const phaseTimerDisplay = formatEduBlastClock(displaySecondsLeft);
  const untilChoicesSec = Math.max(0, displaySecondsLeft - optionsPhaseSec);
  const phaseSub = answered
    ? `${resultFlash?.message ?? "Recorded"}${displaySecondsLeft > 0 ? ` · ${displaySecondsLeft}s left` : ""}`
    : isReadPhase
      ? `Answer options unlock in ${untilChoicesSec}s`
      : "Choose & confirm before time runs out";

  const ringTotal = answered ? resultReviewSec : isReadPhase ? readPhaseSec : optionsPhaseSec;
  const ringCurrent = answered
    ? Math.max(0, displaySecondsLeft)
    : isReadPhase
      ? Math.max(0, displaySecondsLeft - optionsPhaseSec)
      : Math.max(0, displaySecondsLeft);
  const ringRatio = ringTotal > 0 ? Math.max(0, Math.min(1, ringCurrent / ringTotal)) : 0;
  const ringOffset = RING_CIRCUMFERENCE * (1 - ringRatio);
  const ringStroke = answered
    ? "var(--ebc-teal)"
    : isReadPhase
      ? "var(--ebc-blue)"
      : isUrgent
        ? "var(--ebc-coral)"
        : "var(--ebc-teal)";

  const locked = isReadPhase || answered || disableInteraction;
  const canSelect = isAnswerPhase && !answered && !disableInteraction;
  const showReveal = answered;
  const pickedIndex = confirmedIndex ?? selectedIndex;

  const handleSelect = (i: number) => {
    if (!canSelect) return;
    setLocalSelected(i);
  };

  const handleConfirm = () => {
    if (selectedIndex === null || answered || disableInteraction || isReadPhase) return;
    onConfirm(selectedIndex, Date.now() - startTimeRef.current);
    if (selectedIndex === correctIndex) {
      void import("canvas-confetti").then((c) =>
        c.default({ particleCount: 50, spread: 60, origin: { y: 0.7 } })
      );
    }
  };

  const handleSkipClick = () => {
    if (answered || disableInteraction || !onSkip) return;
    onSkip();
  };

  const confirmInactive =
    !answered && (disableInteraction || isReadPhase || selectedIndex === null);

  const canTapNext = answered && Boolean(onNext) && !disableInteraction;

  const confirmLabel = answered
    ? canTapNext
      ? "Tap Next to continue →"
      : "Recorded"
    : isReadPhase
      ? `Options appear in ${untilChoicesSec}s…`
      : selectedIndex === null
        ? "Select an option to confirm"
        : "Confirm answer →";

  const resultFlashClass =
    resultFlash?.type === "correct"
      ? "ebc-rf-correct"
      : resultFlash?.type === "wrong"
        ? "ebc-rf-wrong"
        : resultFlash?.type === "skip"
          ? "ebc-rf-skip"
          : "";

  return (
    <div className="edu-blast-challenge">
      <div className="ebc-card relative">
        {watermarkText ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-3 top-1/2 z-0 -translate-y-1/2 select-none text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/10"
          >
            {watermarkText}
          </div>
        ) : null}

        <div className="ebc-card-topbar">
          <div className="ebc-subject-tag">{subjectLabel}</div>
          <div className="ebc-difficulty">{difficultyLabel}</div>
          {marksLabel ? <div className="ebc-marks-tag">{marksLabel}</div> : null}
        </div>

        <div className="ebc-question-area">
          <div className="ebc-q-label">Question</div>
          <PlayQuestionMarkdown
            variant="stem"
            source={text}
            className="ebc-q-text [&_.katex]:text-[1em] [&_.katex-display]:my-1"
          />
        </div>

        <div className="ebc-ring-wrap">
          <svg className="ebc-ring-svg" width="56" height="56" viewBox="0 0 56 56" aria-hidden>
            <circle className="ebc-ring-track" cx="28" cy="28" r="22" />
            <circle
              className="ebc-ring-fill"
              cx="28"
              cy="28"
              r="22"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
              stroke={ringStroke}
            />
          </svg>
        </div>

        <div
          className={cn("ebc-phase-banner", phaseBannerClass)}
          role="status"
          aria-live="polite"
          aria-label={`${phaseLabel}. ${phaseTimerDisplay}. ${phaseSub}`}
        >
          <div className="ebc-phase-label">{phaseLabel}</div>
          <div className="ebc-phase-timer">{phaseTimerDisplay}</div>
          <div className="ebc-phase-sub">{phaseSub}</div>
        </div>

        <div className="ebc-options-area">
          {options.map((option, i) => {
            const isSelected = !showReveal && selectedIndex === i;
            const isCorrectPick = showReveal && pickedIndex === i && pickedIndex === correctIndex;
            const isWrongPick = showReveal && pickedIndex === i && pickedIndex !== correctIndex;
            const isRevealCorrect = showReveal && i === correctIndex && pickedIndex !== correctIndex;

            return (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(i)}
                disabled={locked && !showReveal}
                className={cn(
                  "ebc-option",
                  locked && !showReveal && "locked",
                  canSelect && "available",
                  isSelected && "selected",
                  isCorrectPick && "correct",
                  isWrongPick && "wrong-sel",
                  isRevealCorrect && "reveal-correct"
                )}
              >
                <div className="ebc-opt-num">{i + 1}</div>
                <div className="ebc-opt-text min-w-0">
                  <PlayQuestionMarkdown variant="option" source={option} />
                </div>
                {locked && !showReveal ? (
                  <span className="ebc-opt-lock-icon" aria-hidden>
                    🔒
                  </span>
                ) : null}
                <span className="ebc-opt-tick" aria-hidden>
                  ✓
                </span>
              </button>
            );
          })}
        </div>

        {answered && resultFlash ? (
          <div className={cn("ebc-result-flash", resultFlashClass)}>{resultFlash.message}</div>
        ) : (
          <div className="ebc-result-flash" aria-hidden />
        )}

        <div className="ebc-action-row">
          <button
            type="button"
            className="ebc-btn-skip"
            onClick={handleSkipClick}
            disabled={answered || disableInteraction}
          >
            Skip →
          </button>
          <button
            type="button"
            className={cn("ebc-btn-confirm", confirmInactive ? "inactive" : "active")}
            onClick={canTapNext ? () => onNext?.() : handleConfirm}
            disabled={canTapNext ? false : confirmInactive}
          >
            <span>{confirmLabel}</span>
          </button>
        </div>

        {answered && showExplanation && explanation ? (
          <div className="ebc-explanation">
            <PlayQuestionMarkdown variant="explanation" source={String(explanation)} />
          </div>
        ) : null}

        <div className="ebc-score-bar">
          <div className="ebc-sc-item">
            <div className="ebc-sc-dot" style={{ background: "var(--ebc-teal)" }} />
            <span className="ebc-sc-val">{correctCount}</span>
            <span className="ebc-sc-lbl">correct</span>
          </div>
          <div className="ebc-sc-item">
            <div className="ebc-sc-dot" style={{ background: "var(--ebc-coral)" }} />
            <span className="ebc-sc-val">{wrongCount}</span>
            <span className="ebc-sc-lbl">wrong</span>
          </div>
          <div className="ebc-sc-item">
            <div className="ebc-sc-dot" style={{ background: "var(--ebc-amber)" }} />
            <span className="ebc-sc-val">{skipCount}</span>
            <span className="ebc-sc-lbl">skipped</span>
          </div>
          {rdmLabel ? <div className="ebc-sc-rdm">{rdmLabel}</div> : null}
        </div>
      </div>
    </div>
  );
}
