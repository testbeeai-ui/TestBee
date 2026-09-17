"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Question } from "@/types";
import { NtaSolutionModal } from "@/components/prep-mock/nta/NtaSolutionModal";
import { ntaQuestionSolutionText } from "@/lib/mock/ntaQuestionSolution";
import {
  ShapeNotVisited,
  ShapeNotAnswered,
  ShapeAnswered,
  ShapeMarkedOnly,
  ShapeAnsweredMarked,
  getNtaPaletteKind,
  NtaPaletteShapeSvg,
} from "@/components/prep-mock/nta/ntaPaletteShapes";
import {
  computeNtaLegendCounts,
  formatNtaHhMmSs,
  NtaNumericAnswerInput,
  NtaOptionBody,
  NtaQuestionSourceChip,
  NtaQuestionStem,
  type NtaQuestionSource,
} from "@/components/prep-mock/nta/ntaExamParts";
import { NtaExamShellMobile } from "@/components/prep-mock/nta/NtaExamShellMobile";
import {
  NTA_EXAM_ACTION_BAR_CLASS,
  NTA_EXAM_AVATAR_CLASS,
  NTA_EXAM_FOOTER_DOCK_CLASS,
  NTA_EXAM_HEADER_CLASS,
  NTA_EXAM_NAV_FOOTER_CLASS,
  NTA_EXAM_PALETTE_ASIDE_CLASS,
  NTA_EXAM_TIMER_CLASS,
} from "@/lib/mock/ntaExamChrome";
import { cn } from "@/lib/utils";

export type { NtaLegendCounts } from "@/components/prep-mock/nta/ntaExamParts";

export interface NtaExamShellProps {
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
  /** Raw numeric-entry text per question id. Only read when `answerFormat === "numerical"`. */
  numericDrafts?: Record<string, string>;
  /** Every keystroke of the numeric input. The caller parses and commits to `answers`. */
  onNumericDraftChange?: (questionId: string, raw: string) => void;
  /** Optional short label rendered beside the question number (Chapter PYQ tier badge). */
  questionBadges?: Record<string, string>;
  /** Optional paper provenance on the question header (date + Morning/Evening). */
  questionSources?: Record<string, NtaQuestionSource>;
  /** Optional palette grid columns: 5 for ~25 question PYQ sets (5x5 grid), 8 for full mocks (default 8). */
  paletteColumns?: 5 | 8;
}

export function NtaExamShell({
  candidateName,
  avatarUrl: avatarUrlProp,
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
  numericDrafts,
  onNumericDraftChange,
  questionBadges,
  questionSources,
  paletteColumns = 8,
}: NtaExamShellProps) {
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const avatarUrl = avatarUrlProp && !avatarFailed ? avatarUrlProp : null;

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrlProp]);

  useEffect(() => {
    setSolutionOpen(false);
  }, [currentIndex]);
  const q = questions[currentIndex];
  const counts = useMemo(
    () => computeNtaLegendCounts(questions, visitedIds, answers, flagged),
    [questions, visitedIds, answers, flagged]
  );

  if (!q) return null;

  const selected = answers[q.id];

  const shellProps = {
    candidateName,
    avatarUrl,
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
    numericDrafts,
    onNumericDraftChange,
    questionBadges,
    questionSources,
    onOpenSolution: () => setSolutionOpen(true),
  };

  return (
    <>
      <NtaExamShellMobile {...shellProps} />
      <NtaSolutionModal
        open={solutionOpen}
        onClose={() => setSolutionOpen(false)}
        text={ntaQuestionSolutionText(q)}
      />
      <div
        className="hidden min-h-0 flex-1 flex-col overflow-hidden text-xs antialiased sm:text-[13px] lg:flex lg:text-sm"
        style={{ color: "var(--nta-text)", background: "var(--nta-bg)" }}
      >
        <header
          className={NTA_EXAM_HEADER_CLASS}
          style={{
            borderColor: "var(--nta-border)",
            backgroundImage: `linear-gradient(135deg, var(--nta-bg) 0%, var(--nta-pattern) 50%, var(--nta-bg) 100%)`,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
              <div className={NTA_EXAM_AVATAR_CLASS} style={{ borderColor: "var(--nta-border)" }}>
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote Supabase avatar URL
                  <img
                    src={avatarUrl}
                    alt=""
                    onError={() => setAvatarFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-gray-400"
                    aria-hidden
                  >
                    <path
                      fill="currentColor"
                      d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                    />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1 text-[11px] leading-tight sm:text-xs">
                <div className="truncate">
                  <span className="font-semibold" style={{ color: "var(--nta-text)" }}>
                    Candidate Name{" "}
                  </span>
                  <span className="font-bold" style={{ color: "var(--nta-candidate-accent)" }}>
                    {candidateName}
                  </span>
                </div>
                <div className="truncate">
                  <span className="font-semibold" style={{ color: "var(--nta-text)" }}>
                    Exam Name{" "}
                  </span>
                  <span className="font-bold" style={{ color: "var(--nta-candidate-accent)" }}>
                    {examNameLine}
                  </span>
                </div>
                <div className="truncate">
                  <span className="font-semibold" style={{ color: "var(--nta-text)" }}>
                    Subject Name{" "}
                  </span>
                  <span className="font-bold" style={{ color: "var(--nta-candidate-accent)" }}>
                    {subjectPaperLine}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5 sm:items-center">
                <span
                  className="text-[10px] font-bold uppercase tracking-wide sm:text-[11px]"
                  style={{ color: "var(--nta-muted)" }}
                >
                  Remaining Time
                </span>
                <span
                  className={NTA_EXAM_TIMER_CLASS}
                  style={{ background: "var(--nta-timer-bg)", color: "var(--nta-timer-text)" }}
                  aria-live="polite"
                >
                  {formatNtaHhMmSs(secondsLeft)}
                </span>
              </div>
            </div>
            <div
              className="min-w-0 max-w-[min(100%,20rem)] rounded border border-dashed px-2 py-1"
              style={{ borderColor: "var(--nta-text)" }}
            >
              <p
                className="mb-0.5 text-[9px] font-bold uppercase tracking-wide"
                style={{ color: "var(--nta-muted)" }}
              >
                Legend
              </p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 xl:grid-cols-3">
                <HeaderLegendCell
                  icon={<ShapeNotVisited />}
                  n={counts.notVisited}
                  label="Not Visited"
                />
                <HeaderLegendCell
                  icon={<ShapeNotAnswered />}
                  n={counts.notAnswered}
                  label="Not Answered"
                />
                <HeaderLegendCell icon={<ShapeAnswered />} n={counts.answered} label="Answered" />
                <HeaderLegendCell
                  icon={<ShapeMarkedOnly />}
                  n={counts.marked}
                  label="Marked for Review"
                />
                <HeaderLegendCell
                  icon={<ShapeAnsweredMarked />}
                  n={counts.answeredMarked}
                  label="Answered & Marked for Review"
                />
              </div>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
          <button
            type="button"
            onClick={() => setPaletteOpen((o) => !o)}
            className="hidden w-5 shrink-0 border-r sm:w-6 lg:block lg:w-6 xl:w-7"
            style={{ borderColor: "var(--nta-border)", background: "var(--nta-bar)" }}
            aria-label={paletteOpen ? "Collapse palette" : "Expand palette"}
          >
            <span className="text-xs" style={{ color: "var(--nta-muted)" }}>
              {paletteOpen ? "«" : "»"}
            </span>
          </button>

          <main
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r"
            style={{ borderColor: "var(--nta-border)" }}
          >
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              <div className="flex min-h-full flex-col py-4 pl-6 pr-5 sm:py-5 sm:pl-8 sm:pr-6 lg:pl-9 lg:pr-8">
                <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
                  <h2
                    className="min-w-0 text-2xl font-bold tracking-tight sm:text-3xl lg:text-[2rem]"
                    style={{ color: "var(--nta-text)" }}
                  >
                    Question {currentIndex + 1}:
                    {questionBadges?.[q.id] ? (
                      <span
                        className="ml-2.5 rounded-full border px-2.5 py-0.5 align-middle text-xs font-bold uppercase tracking-wide"
                        style={{ borderColor: "var(--nta-border)", color: "var(--nta-muted)" }}
                      >
                        {questionBadges[q.id]}
                      </span>
                    ) : null}
                  </h2>
                  {questionSources?.[q.id] ? (
                    <NtaQuestionSourceChip
                      date={questionSources[q.id].date}
                      shift={questionSources[q.id].shift}
                    />
                  ) : null}
                </div>
                <div className="mb-4 w-full min-w-0 shrink-0">
                  <NtaQuestionStem q={q} />
                </div>
                {q.answerFormat === "numerical" ? (
                  <NtaNumericAnswerInput
                    value={numericDrafts?.[q.id] ?? ""}
                    onChange={(next) => onNumericDraftChange?.(q.id, next)}
                    disabled={!onNumericDraftChange}
                  />
                ) : (
                  <div className="mt-4 w-full">
                    <p
                      className="mb-2.5 text-base font-bold sm:text-lg lg:text-xl"
                      style={{ color: "var(--nta-text)" }}
                    >
                      Options :
                    </p>
                    <div className="flex w-full flex-col gap-2.5 sm:gap-3 pb-3">
                      {q.options.map((opt, i) => (
                        <label
                          key={i}
                          className={cn(
                            "group flex min-h-[3rem] sm:min-h-[3.25rem] w-full cursor-pointer items-center gap-3.5 sm:gap-4 rounded-lg border px-4 py-3 sm:px-5 sm:py-3.5 text-base sm:text-[17px] lg:text-[18px] transition-all duration-150 select-none",
                            selected === i ? "ring-2" : ""
                          )}
                          style={{
                            borderColor: selected === i ? "var(--nta-blue)" : "var(--nta-border)",
                            background: selected === i ? "var(--nta-surface)" : "transparent",
                            boxShadow: selected === i ? "0 0 0 1.5px var(--nta-blue)" : undefined,
                          }}
                        >
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            checked={selected === i}
                            onChange={() => onAnswerSelect(q.id, i)}
                            className="size-4.5 sm:size-5 shrink-0 cursor-pointer accent-[var(--nta-blue)]"
                          />
                          <span className="shrink-0 font-bold text-base sm:text-lg lg:text-xl opacity-90">
                            {i + 1}.
                          </span>
                          <div className="min-w-0 flex-1 leading-normal">
                            <NtaOptionBody text={opt} />
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div
              className={NTA_EXAM_FOOTER_DOCK_CLASS}
              style={{
                borderColor: "var(--nta-border)",
                background: "var(--nta-bar)",
                boxShadow: "0 -6px 16px rgba(0,0,0,0.22)",
              }}
            >
              {/* Row 1: NTA actions, then a gap before Solution */}
              <div className={NTA_EXAM_ACTION_BAR_CLASS}>
                <NtaBtn variant="green" label="SAVE & NEXT" onClick={onSaveAndNext} />
                <NtaBtn variant="white" label="CLEAR" onClick={onClearResponse} />
                <NtaBtn
                  variant="orange"
                  label="SAVE & MARK FOR REVIEW & NEXT"
                  onClick={onSaveMarkReviewNext}
                />
                <NtaBtn
                  variant="blue"
                  label="MARK FOR REVIEW & NEXT"
                  onClick={onMarkReviewNext}
                />
                <NtaBtn
                  variant="solution"
                  label="SOLUTION"
                  onClick={() => setSolutionOpen(true)}
                  className="ml-3 sm:ml-5"
                />
              </div>

              {/* Row 2: Nav buttons on left and Submit button on right */}
              <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-1.5 sm:gap-2 w-full">
                <div className={NTA_EXAM_NAV_FOOTER_CLASS}>
                  <NtaBtn
                    variant="white"
                    label="<< BACK"
                    onClick={onBackNav}
                    className="min-w-[5.25rem] sm:min-w-[6.25rem]"
                  />
                  <NtaBtn
                    variant="white"
                    label="NEXT >>"
                    onClick={onNextNav}
                    className="min-w-[5.25rem] sm:min-w-[6.25rem]"
                  />
                </div>
                <NtaBtn
                  variant="green"
                  label="SUBMIT"
                  onClick={onSubmitClick}
                  className="min-w-[5.5rem] sm:min-w-[6.5rem]"
                />
              </div>
            </div>
          </main>

          <aside
            className={cn(
              NTA_EXAM_PALETTE_ASIDE_CLASS,
              !paletteOpen &&
                "hidden lg:flex lg:w-0 lg:min-w-0 lg:max-w-none lg:overflow-hidden lg:border-0 lg:p-0 lg:opacity-0"
            )}
            style={{ borderColor: "var(--nta-border)", background: "var(--nta-bg)" }}
          >
            <div
              className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-2 pb-3 pt-2"
              style={{ scrollbarGutter: "auto" }}
            >
              <p
                className="mb-1.5 text-[9px] font-bold uppercase tracking-wide sm:text-[10px]"
                style={{ color: "var(--nta-muted)" }}
              >
                Question Palette
              </p>
              <div
                className={cn(
                  "grid w-full min-w-0",
                  paletteColumns === 5
                    ? "grid-cols-5 gap-1.5 sm:gap-2"
                    : "nta-palette-grid-8 grid-cols-8 gap-1.5"
                )}
              >
                {questions.map((qq, i) => {
                  const visited = visitedIds.has(qq.id);
                  const answered = answers[qq.id] !== undefined;
                  const mark = flagged.has(qq.id);
                  const kind = getNtaPaletteKind(visited, answered, mark);
                  const active = i === currentIndex;
                  const numberColor =
                    kind === "not_visited"
                      ? "var(--nta-palette-unvisited-number, #1a2433)"
                      : "#ffffff";
                  return (
                    <button
                      key={`${qq.id}-${i}`}
                      type="button"
                      onClick={() => onSelectIndex(i)}
                      className="nta-palette-cell relative flex aspect-square w-full min-w-0 max-w-full items-center justify-center rounded-md p-0 transition-opacity hover:opacity-95"
                      style={{
                        background: "transparent",
                        border: "none",
                        boxShadow: active
                          ? "0 0 0 2px var(--nta-blue), 0 0 0 1px var(--nta-bg)"
                          : undefined,
                      }}
                      aria-current={active ? "true" : undefined}
                      aria-label={`Question ${i + 1}, ${kind.replaceAll("_", " ")}`}
                    >
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <NtaPaletteShapeSvg kind={kind} fill tile />
                      </span>
                      <span
                        className={cn(
                          "relative z-[1] font-black tabular-nums leading-none",
                          paletteColumns === 5 ? "text-xs sm:text-[13px]" : "text-[11px]",
                          kind !== "not_visited" && "drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]"
                        )}
                        style={{ color: numberColor }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function HeaderLegendCell({ icon, n, label }: { icon: React.ReactNode; n: number; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1 text-[9px] leading-tight sm:text-[10px]">
      <span className="flex w-4 shrink-0 items-center justify-center [&_svg]:origin-center [&_svg]:scale-90">
        {icon}
      </span>
      <span className="shrink-0 font-black tabular-nums" style={{ color: "var(--nta-text)" }}>
        {n}
      </span>
      <span className="min-w-0 font-medium" style={{ color: "var(--nta-muted)" }}>
        — {label}
      </span>
    </div>
  );
}

type NtaBtnVariant = "green" | "orange" | "blue" | "white" | "solution";

function ntaBtnStyle(variant: NtaBtnVariant): CSSProperties {
  switch (variant) {
    case "green":
      return { background: "var(--nta-green)", color: "#fff", border: "1px solid #4cae4c" };
    case "orange":
      return { background: "var(--nta-orange)", color: "#fff", border: "1px solid #eea236" };
    case "blue":
      return { background: "#286090", color: "#fff", border: "1px solid #204d74" };
    case "white":
      return {
        background: "var(--nta-surface)",
        color: "var(--nta-text)",
        border: "1px solid var(--nta-border)",
      };
    case "solution":
      return { background: "#0f766e", color: "#fff", border: "1px solid #0d5e58" };
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}

function NtaBtn({
  variant,
  label,
  onClick,
  className,
}: {
  variant: NtaBtnVariant;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  const style = ntaBtnStyle(variant);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3.5 py-2 text-center text-xs font-bold uppercase leading-tight shadow-sm transition-all duration-150 cursor-pointer sm:px-4 sm:py-2.5 sm:text-[12.5px] hover:brightness-105 active:scale-[0.98]",
        className
      )}
      style={style}
    >
      {label}
    </button>
  );
}
