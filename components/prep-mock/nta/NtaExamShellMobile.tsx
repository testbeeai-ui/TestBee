"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  Clock,
  Flag,
  Send,
  X,
} from "lucide-react";
import type { Question, Subject } from "@/types";
import { CORE_SUBJECTS } from "@/types";
import { getNtaPaletteKind } from "@/components/prep-mock/nta/ntaPaletteShapes";
import {
  computeNtaLegendCounts,
  formatNtaHhMmSs,
  NtaOptionBody,
  NtaQuestionStem,
} from "@/components/prep-mock/nta/ntaExamParts";
import { cn } from "@/lib/utils";

const SUBJECT_LABEL: Record<Subject, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  math: "Maths",
};

type SectionGroup = {
  subject: Subject;
  label: string;
  indices: number[];
};

export interface NtaExamShellMobileProps {
  candidateName: string;
  avatarUrl: string | null;
  examNameLine: string;
  subjectPaperLine: string;
  secondsLeft: number;
  questions: Question[];
  currentIndex: number;
  onSelectIndex: (index: number) => void;
  answers: Record<string, number>;
  flagged: Set<string>;
  visitedIds: Set<string>;
  onAnswerSelect: (questionId: string, optionIndex: number) => void;
  onSaveAndNext: () => void;
  onClearResponse: () => void;
  onSaveMarkReviewNext: () => void;
  onMarkReviewNext: () => void;
  onMarkForReviewOnly?: () => void;
  onBackNav: () => void;
  onNextNav: () => void;
  onSubmitClick: () => void;
}

export function NtaExamShellMobile({
  candidateName,
  examNameLine,
  subjectPaperLine,
  secondsLeft,
  questions,
  currentIndex,
  onSelectIndex,
  answers,
  flagged,
  visitedIds,
  onAnswerSelect,
  onSaveAndNext,
  onClearResponse,
  onSaveMarkReviewNext,
  onMarkReviewNext,
  onMarkForReviewOnly,
  onBackNav,
  onNextNav,
  onSubmitClick,
}: NtaExamShellMobileProps) {
  const q = questions[currentIndex];
  const paletteScrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const [sectionIdx, setSectionIdx] = useState(0);

  const counts = useMemo(
    () => computeNtaLegendCounts(questions, visitedIds, answers, flagged),
    [questions, visitedIds, answers, flagged]
  );

  const sectionGroups = useMemo((): SectionGroup[] => {
    return CORE_SUBJECTS.map((subject) => ({
      subject,
      label: SUBJECT_LABEL[subject],
      indices: questions.map((qq, i) => (qq.subject === subject ? i : -1)).filter((i) => i >= 0),
    })).filter((g) => g.indices.length > 0);
  }, [questions]);

  const activeSection = sectionGroups[sectionIdx] ?? sectionGroups[0];
  const paletteIndices = useMemo(
    () => questions.map((_, i) => i),
    [questions]
  );
  const displayQuestionNum = currentIndex + 1;
  const displayQuestionTotal = questions.length;

  useEffect(() => {
    if (!activeSection) return;
    if (!activeSection.indices.includes(currentIndex) && activeSection.indices.length > 0) {
      setSectionIdx((prev) => {
        const group = sectionGroups[prev];
        if (group?.indices.includes(currentIndex)) return prev;
        const match = sectionGroups.findIndex((g) => g.indices.includes(currentIndex));
        return match >= 0 ? match : prev;
      });
    }
  }, [currentIndex, activeSection, sectionGroups]);

  useEffect(() => {
    const el = paletteScrollRef.current?.querySelector<HTMLElement>(
      `[data-palette-index="${currentIndex}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [currentIndex, sectionIdx]);

  const handleSwipeEnd = useCallback(
    (clientX: number) => {
      const dx = clientX - touchStartX.current;
      if (Math.abs(dx) < 40) return;
      if (dx < 0) onNextNav();
      else onBackNav();
    },
    [onBackNav, onNextNav]
  );

  if (!q) return null;

  const selected = answers[q.id];
  const answeredDisplay = counts.answered + counts.answeredMarked;
  const markedDisplay = counts.marked + counts.answeredMarked;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden antialiased lg:hidden"
      data-nta-mobile-exam
    >
      <header className="nta-m-header shrink-0 px-3.5 py-2.5">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-[var(--nta-m-text)]">
              {candidateName}{" "}
              <span className="text-[10px] font-normal text-[var(--nta-m-dim)]">{examNameLine}</span>
            </p>
            <p className="line-clamp-2 text-[11px] text-[var(--nta-m-muted)]">{subjectPaperLine}</p>
          </div>
          <div
            className="nta-m-timer flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-mono text-sm font-medium tabular-nums"
            aria-live="polite"
          >
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {formatNtaHhMmSs(secondsLeft)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5 pt-1">
          <MobileLegendDot color="#2A3347" border="#334060" label="Not visited" />
          <MobileLegendDot color="#1D9E75" label="Answered" />
          <MobileLegendDot color="#E24B4A" label="Not answered" />
          <MobileLegendDot color="#7F77DD" label="Marked" />
          <MobileLegendDot color="#6FD4AF" outline="#7F77DD" label="Ans+Marked" />
        </div>
      </header>

      {sectionGroups.length > 1 ? (
        <div
          className="flex shrink-0 border-b border-[var(--nta-m-border)] bg-[var(--nta-m-bg)]"
          role="tablist"
          aria-label="Exam sections"
        >
          {sectionGroups.map((group, i) => (
            <button
              key={group.subject}
              type="button"
              role="tab"
              aria-selected={i === sectionIdx}
              onClick={() => {
                setSectionIdx(i);
                const first = group.indices[0];
                if (first !== undefined) onSelectIndex(first);
              }}
              className={cn(
                "flex-1 border-b-2 px-1 py-1.5 text-center text-[11px] transition-colors",
                i === sectionIdx
                  ? "nta-m-tab-active font-medium"
                  : "nta-m-tab-idle border-transparent"
              )}
            >
              {group.label} ({group.indices.length})
            </button>
          ))}
        </div>
      ) : null}

      <div className="nta-m-palette-band shrink-0 px-2.5 py-2">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--nta-m-dim)]">
          Question palette — scroll →
        </p>
        <div
          ref={paletteScrollRef}
          className="nta-m-palette-scroll overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]"
        >
          <div className="flex min-w-max gap-1.5 px-0.5">
            {paletteIndices.map((qi) => {
              const qq = questions[qi]!;
              const kind = getNtaPaletteKind(
                visitedIds.has(qq.id),
                answers[qq.id] !== undefined,
                flagged.has(qq.id)
              );
              const qNum = qi + 1;
              return (
                <button
                  key={qq.id}
                  type="button"
                  data-palette-index={qi}
                  onClick={() => onSelectIndex(qi)}
                  className="nta-m-palette-btn"
                  data-kind={kind}
                  data-current={qi === currentIndex ? "true" : "false"}
                  aria-current={qi === currentIndex ? "true" : undefined}
                  aria-label={`Question ${qNum}, ${SUBJECT_LABEL[qq.subject] ?? qq.subject}`}
                >
                  {qNum}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
          <span className="text-[var(--nta-m-green)]">{answeredDisplay} answered</span>
          <span className="text-[var(--nta-m-red)]">{counts.notAnswered} not answered</span>
          <span className="text-[var(--nta-m-purple)]">{markedDisplay} marked</span>
          <span className="text-[var(--nta-m-dim)]">{counts.notVisited} not visited</span>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3.5 py-3"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? 0;
        }}
        onTouchEnd={(e) => {
          handleSwipeEnd(e.changedTouches[0]?.clientX ?? touchStartX.current);
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] text-[var(--nta-m-dim)]">
            Q {displayQuestionNum} of {displayQuestionTotal} · {SUBJECT_LABEL[q.subject] ?? q.subject}
          </p>
          <div className="flex gap-0.5" aria-hidden>
            {questions.slice(0, Math.min(questions.length, 40)).map((_, i) => {
              const qq = questions[i]!;
              const kind = getNtaPaletteKind(
                visitedIds.has(qq.id),
                answers[qq.id] !== undefined,
                flagged.has(qq.id)
              );
              const done = kind === "answered" || kind === "answered_marked";
              return (
                <span
                  key={qq.id}
                  className={cn(
                    "h-[3px] rounded-sm",
                    i === currentIndex ? "w-2.5 bg-[var(--nta-m-current)]" : "w-[5px]",
                    i !== currentIndex && (done ? "bg-[var(--nta-m-green)]" : "bg-[var(--nta-m-palette-nv)]")
                  )}
                />
              );
            })}
          </div>
        </div>

        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-medium text-[var(--nta-m-text)]">Question {displayQuestionNum}</h2>
          <span className="nta-m-type-badge rounded-full px-2 py-0.5 text-[11px] font-medium">
            MCQ · +4 / −1
          </span>
        </div>

        <div className="mb-4 text-[var(--nta-m-text)]">
          <NtaQuestionStem q={q} mobile />
        </div>

        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--nta-m-dim)]">
          Choose one option
        </p>
        <div className="space-y-2">
          {q.options.map((opt, i) => {
            const isSelected = selected === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onAnswerSelect(q.id, i)}
                className="nta-m-opt"
                data-selected={isSelected ? "true" : "false"}
              >
                <span
                  className="nta-m-opt-radio"
                  aria-hidden
                >
                  {isSelected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                </span>
                <span
                  className="nta-m-opt-num"
                >
                  {i + 1}.
                </span>
                <div
                  className="nta-m-opt-body min-w-0 flex-1 text-[13px] leading-snug"
                >
                  <NtaOptionBody text={opt} mobile />
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-[var(--nta-m-dim)]">
          <ArrowLeft className="h-3 w-3" aria-hidden />
          swipe left/right or use arrows below
          <ArrowRight className="h-3 w-3" aria-hidden />
        </p>
      </div>


      <footer className="nta-m-footer shrink-0 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:py-2.5">
        <div className="mb-2 flex gap-1.5">
          <MobileActionBtn
            variant="save"
            icon={<Check className="h-4 w-4" aria-hidden />}
            label="Save & next"
            onClick={onSaveAndNext}
          />
          <MobileActionBtn
            variant="clear"
            icon={<X className="h-4 w-4" aria-hidden />}
            label="Clear"
            onClick={onClearResponse}
            className="flex-[0.65]"
          />
          <MobileActionBtn
            variant="review"
            icon={<Bookmark className="h-4 w-4" aria-hidden />}
            label="Save & mark"
            onClick={onSaveMarkReviewNext}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onBackNav}
            className="nta-m-action-btn nta-m-btn-nav flex items-center gap-1 px-3 py-2.5 text-xs font-medium"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Prev
          </button>
          <button
            type="button"
            onClick={onNextNav}
            className="nta-m-action-btn nta-m-btn-nav flex items-center gap-1 px-3 py-2.5 text-xs font-medium"
          >
            Next
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onMarkForReviewOnly ?? onMarkReviewNext}
            className="nta-m-action-btn nta-m-btn-mark flex shrink-0 items-center gap-1 px-2.5 py-2.5 text-xs font-medium"
          >
            <Flag className="h-4 w-4" aria-hidden />
            Mark only
          </button>
          <button
            type="button"
            onClick={onSubmitClick}
            className="nta-m-action-btn nta-m-btn-submit ml-auto flex shrink-0 items-center gap-1 px-3 py-2.5 text-xs font-medium"
          >
            <Send className="h-4 w-4" aria-hidden />
            Submit
          </button>
        </div>
      </footer>
    </div>
  );
}

function MobileLegendDot({
  color,
  border,
  outline,
  label,
}: {
  color: string;
  border?: string;
  outline?: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--nta-m-muted)" }}>
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{
          background: color,
          border: border ? `1px solid ${border}` : undefined,
          outline: outline ? `2px solid ${outline}` : undefined,
          outlineOffset: outline ? 1 : undefined,
        }}
        aria-hidden
      />
      {label}
    </span>
  );
}

function MobileActionBtn({
  variant,
  icon,
  label,
  onClick,
  className,
}: {
  variant: "save" | "clear" | "review";
  icon: ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  const variantClass =
    variant === "save"
      ? "nta-m-btn-save"
      : variant === "review"
        ? "nta-m-btn-review"
        : "nta-m-btn-clear";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("nta-m-action-btn", variantClass, className)}
    >
      {icon}
      {label}
    </button>
  );
}
