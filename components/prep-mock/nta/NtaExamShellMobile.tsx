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
import { getNtaPaletteKind, type NtaPaletteKind } from "@/components/prep-mock/nta/ntaPaletteShapes";
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

function mobilePaletteClasses(kind: NtaPaletteKind, active: boolean): string {
  const base =
    "h-8 w-8 shrink-0 rounded-lg border-[1.5px] flex items-center justify-center text-[11px] font-medium tabular-nums";
  const byKind: Record<NtaPaletteKind, string> = {
    not_visited: "bg-[#2A3347] text-[#9BA3B8] border-[#334060]",
    not_answered: "bg-[#E24B4A] text-white border-[#A32D2D]",
    answered: "bg-[#1D9E75] text-white border-[#0F6E56]",
    marked: "bg-[#7F77DD] text-white border-[#534AB7]",
    answered_marked:
      "bg-[#5DCAA5] text-[#04342C] border-[#1D9E75] outline outline-2 outline-[#7F77DD] outline-offset-1",
  };
  const current = active ? "outline outline-2 outline-[#EF9F27] outline-offset-1 border-[#EF9F27]" : "";
  return cn(base, byKind[kind], current);
}

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
  const paletteIndices = activeSection?.indices ?? questions.map((_, i) => i);

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
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0E1117] text-[#E8EAF0] antialiased lg:hidden"
      data-nta-mobile-exam
    >
      <header className="shrink-0 border-b border-[#2A3347] bg-[#161B25] px-3.5 py-2.5">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-[#E8EAF0]">
              {candidateName}{" "}
              <span className="text-[10px] font-normal text-[#5C6480]">{examNameLine}</span>
            </p>
            <p className="line-clamp-2 text-[11px] text-[#9BA3B8]">{subjectPaperLine}</p>
          </div>
          <div
            className="flex shrink-0 items-center gap-1 rounded-full bg-[#0F6E56] px-2.5 py-1 font-mono text-sm font-medium tabular-nums text-[#9FE1CB]"
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
          <MobileLegendDot color="#5DCAA5" outline="#7F77DD" label="Ans+Marked" />
        </div>
      </header>

      {sectionGroups.length > 1 ? (
        <div
          className="flex shrink-0 border-b border-[#2A3347]"
          role="tablist"
          aria-label="Exam sections"
        >
          {sectionGroups.map((group, i) => (
            <button
              key={group.subject}
              type="button"
              role="tab"
              aria-selected={i === sectionIdx}
              onClick={() => setSectionIdx(i)}
              className={cn(
                "flex-1 border-b-2 px-1 py-1.5 text-center text-[11px] transition-colors",
                i === sectionIdx
                  ? "border-[#378ADD] font-medium text-[#85B7EB]"
                  : "border-transparent text-[#5C6480]"
              )}
            >
              {group.label} ({group.indices.length})
            </button>
          ))}
        </div>
      ) : null}

      <div className="shrink-0 border-b border-[#2A3347] bg-[#1C2333] px-2.5 py-2">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-[#5C6480]">
          Question palette — scroll →
        </p>
        <div ref={paletteScrollRef} className="overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          <div className="flex min-w-max gap-1.5 px-0.5">
            {paletteIndices.map((qi) => {
              const qq = questions[qi]!;
              const kind = getNtaPaletteKind(
                visitedIds.has(qq.id),
                answers[qq.id] !== undefined,
                flagged.has(qq.id)
              );
              return (
                <button
                  key={qq.id}
                  type="button"
                  data-palette-index={qi}
                  onClick={() => onSelectIndex(qi)}
                  className={mobilePaletteClasses(kind, qi === currentIndex)}
                  aria-current={qi === currentIndex ? "true" : undefined}
                  aria-label={`Question ${qi + 1}`}
                >
                  {String(qi + 1).padStart(2, "0")}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-3 text-[10px]">
          <span className="text-[#1D9E75]">{answeredDisplay} answered</span>
          <span className="text-[#E24B4A]">{counts.notAnswered} not answered</span>
          <span className="text-[#7F77DD]">{markedDisplay} marked</span>
          <span className="text-[#5C6480]">{counts.notVisited} not visited</span>
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
          <p className="text-[11px] text-[#5C6480]">
            Q {currentIndex + 1} of {questions.length} · {SUBJECT_LABEL[q.subject] ?? q.subject}
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
                    i === currentIndex ? "w-2.5 bg-[#EF9F27]" : "w-[5px]",
                    i !== currentIndex && (done ? "bg-[#1D9E75]" : "bg-[#2A3347]")
                  )}
                />
              );
            })}
          </div>
        </div>

        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-medium text-[#E8EAF0]">Question {currentIndex + 1}</h2>
          <span className="rounded-full bg-[#0D1E30] px-2 py-0.5 text-[11px] font-medium text-[#85B7EB]">
            MCQ · +4 / −1
          </span>
        </div>

        <div className="mb-4 text-[#E8EAF0]">
          <NtaQuestionStem q={q} mobile />
        </div>

        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#5C6480]">
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
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-xl border px-3 py-3 text-left transition-colors",
                  isSelected
                    ? "border-[#1D9E75] bg-[#0A2A20]"
                    : "border-[#2A3347] bg-[#161B25]"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                    isSelected ? "border-[#1D9E75] bg-[#1D9E75]" : "border-[#334060]"
                  )}
                  aria-hidden
                >
                  {isSelected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                </span>
                <span
                  className={cn(
                    "w-5 shrink-0 text-[13px] font-medium",
                    isSelected ? "text-[#9FE1CB]" : "text-[#9BA3B8]"
                  )}
                >
                  {i + 1}.
                </span>
                <div
                  className={cn(
                    "min-w-0 flex-1 text-[13px] leading-snug",
                    isSelected ? "text-[#9FE1CB]" : "text-[#9BA3B8]"
                  )}
                >
                  <NtaOptionBody text={opt} mobile />
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-[#5C6480]">
          <ArrowLeft className="h-3 w-3" aria-hidden />
          swipe left/right or use arrows below
          <ArrowRight className="h-3 w-3" aria-hidden />
        </p>
      </div>

      <footer className="shrink-0 border-t border-[#2A3347] bg-[#161B25] px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
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
            className="flex items-center gap-1 rounded-xl border border-[#334060] bg-[#2A3347] px-3 py-2.5 text-xs font-medium text-[#9BA3B8]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Prev
          </button>
          <button
            type="button"
            onClick={onNextNav}
            className="flex items-center gap-1 rounded-xl border border-[#334060] bg-[#2A3347] px-3 py-2.5 text-xs font-medium text-[#9BA3B8]"
          >
            Next
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onMarkForReviewOnly ?? onMarkReviewNext}
            className="flex shrink-0 items-center gap-1 rounded-xl bg-[#534AB7] px-2.5 py-2.5 text-xs font-medium text-white"
          >
            <Flag className="h-4 w-4" aria-hidden />
            Mark only
          </button>
          <button
            type="button"
            onClick={onSubmitClick}
            className="ml-auto flex shrink-0 items-center gap-1 rounded-xl bg-[#E24B4A] px-3 py-2.5 text-xs font-medium text-white"
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
    <span className="flex items-center gap-1 text-[10px] text-[#9BA3B8]">
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
  const styles =
    variant === "save"
      ? "bg-[#1D9E75] text-white"
      : variant === "review"
        ? "bg-[#EF9F27] text-[#412402]"
        : "border border-[#334060] bg-[#2A3347] text-[#9BA3B8]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-xs font-medium leading-tight",
        styles,
        className
      )}
    >
      {icon}
      {label}
    </button>
  );
}
