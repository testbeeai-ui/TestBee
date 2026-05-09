"use client";

import { memo, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Question } from "@/types";
import { sanitizeMockHtml } from "@/lib/mockHtml";
import { patchNtaHtmlPresentation, wrapPlainMockTextForKatexHtml } from "@/lib/mockRichTextKatex";
import { useKatexAutoRender } from "@/hooks/useKatexAutoRender";
import {
  ShapeNotVisited,
  ShapeNotAnswered,
  ShapeAnswered,
  ShapeMarkedOnly,
  ShapeAnsweredMarked,
  getNtaPaletteKind,
  NtaPaletteShapeSvg,
} from "@/components/prep-mock/nta/ntaPaletteShapes";
import { cn } from "@/lib/utils";

function formatHhMmSs(totalSeconds: number): string {
  const t = Math.max(0, totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const ntaMdClass =
  "min-w-0 max-w-full break-words text-[var(--nta-text)] [&_.katex]:!text-[var(--nta-text)] [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_a]:!text-[var(--nta-blue)]";

/** Question stem only — rem so KaTeX’s own em sizing doesn’t swallow tiny tweaks. */
const ntaStemKatexClass =
  "[&_.katex]:![font-size:1.0625rem] sm:[&_.katex]:![font-size:1.125rem] lg:[&_.katex]:![font-size:1.125rem] xl:[&_.katex]:![font-size:1.1875rem] 2xl:[&_.katex]:![font-size:1.25rem]";

/** Options when they contain math — modest bump. */
const ntaOptionKatexClass =
  "[&_.katex]:![font-size:1.0625rem] lg:[&_.katex]:![font-size:1.09375rem]";

/**
 * Supabase may send option HTML (`<span class="math-tex">\\(…\\)</span>`) or plain `\\(…\\)`.
 * One path: sanitize HTML + KaTeX auto-render (same as stems).
 * Memoized so header timer re-renders do not reconcile away KaTeX DOM.
 */
const NtaOptionBody = memo(function NtaOptionBody({ text }: { text: string }) {
  const t = text.trim();
  const htmlRef = useRef<HTMLDivElement>(null);
  const safeHtml = useMemo(() => {
    if (!t) return "";
    const core = t.includes("<")
      ? sanitizeMockHtml(t)
      : sanitizeMockHtml(wrapPlainMockTextForKatexHtml(t));
    return patchNtaHtmlPresentation(core);
  }, [t]);
  useKatexAutoRender(htmlRef, safeHtml, t);

  return (
    <div
      ref={htmlRef}
      className={cn(
        "prose prose-sm max-w-none leading-snug sm:prose-base",
        ntaMdClass,
        ntaOptionKatexClass
      )}
      suppressHydrationWarning
    />
  );
});

const NtaQuestionStem = memo(function NtaQuestionStem({ q }: { q: Question }) {
  const htmlRef = useRef<HTMLDivElement>(null);
  const safeHtml = useMemo(() => {
    if (q.questionHtml) return patchNtaHtmlPresentation(sanitizeMockHtml(q.questionHtml));
    const plain = String(q.question ?? "").trim();
    if (!plain) return "";
    return patchNtaHtmlPresentation(sanitizeMockHtml(wrapPlainMockTextForKatexHtml(plain)));
  }, [q.questionHtml, q.question]);
  useKatexAutoRender(htmlRef, safeHtml, q.id);

  if (!safeHtml) return null;
  return (
    <div
      ref={htmlRef}
      className={cn(
        "prose prose-sm max-w-none font-medium leading-relaxed sm:prose-base [&_img]:max-h-40 [&_p]:my-1.5 sm:[&_img]:max-h-48 sm:[&_p]:my-2 lg:prose-lg lg:[&_img]:max-h-56 lg:[&_p]:my-2.5 xl:[&_img]:max-h-64 xl:[&_p]:my-3 2xl:[&_img]:max-h-[22rem]",
        ntaMdClass,
        ntaStemKatexClass
      )}
      suppressHydrationWarning
    />
  );
});

export interface NtaLegendCounts {
  notVisited: number;
  notAnswered: number;
  answered: number;
  marked: number;
  answeredMarked: number;
}

function computeLegendCounts(
  questions: Question[],
  visitedIds: Set<string>,
  answers: Record<string, number>,
  flagged: Set<string>
): NtaLegendCounts {
  let notVisited = 0;
  let notAnswered = 0;
  let answered = 0;
  let marked = 0;
  let answeredMarked = 0;
  for (const q of questions) {
    const v = visitedIds.has(q.id);
    const a = answers[q.id] !== undefined;
    const f = flagged.has(q.id);
    if (!v) notVisited++;
    else if (a && f) answeredMarked++;
    else if (f) marked++;
    else if (a) answered++;
    else notAnswered++;
  }
  return { notVisited, notAnswered, answered, marked, answeredMarked };
}

interface NtaExamShellProps {
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
  onBackNav: () => void;
  onNextNav: () => void;
  onSubmitClick: () => void;
}

export function NtaExamShell({
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
  onBackNav,
  onNextNav,
  onSubmitClick,
}: NtaExamShellProps) {
  const [paletteOpen, setPaletteOpen] = useState(true);
  const q = questions[currentIndex];
  const counts = useMemo(
    () => computeLegendCounts(questions, visitedIds, answers, flagged),
    [questions, visitedIds, answers, flagged]
  );

  if (!q) return null;

  const selected = answers[q.id];

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden text-xs sm:text-[13px] lg:text-sm xl:text-[15px] 2xl:text-base antialiased"
      style={{ color: "var(--nta-text)", background: "var(--nta-bg)" }}
    >
      <header
        className="relative shrink-0 border-b px-2.5 py-2 sm:px-4 sm:py-3 lg:px-5 lg:py-3 xl:px-6 xl:py-4 2xl:px-8 2xl:py-5"
        style={{
          borderColor: "var(--nta-border)",
          backgroundImage: `linear-gradient(135deg, var(--nta-bg) 0%, var(--nta-pattern) 50%, var(--nta-bg) 100%)`,
        }}
      >
        <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded border bg-white sm:h-14 sm:w-14 lg:h-[3.25rem] lg:w-[3.25rem] xl:h-16 xl:w-16 2xl:h-[4.25rem] 2xl:w-[4.25rem]"
              style={{ borderColor: "var(--nta-border)" }}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote Supabase avatar URL
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <svg
                  width="32"
                  height="32"
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
            <div className="min-w-0 text-[11px] leading-tight sm:text-xs sm:leading-tight lg:text-sm lg:leading-snug">
              <div>
                <span className="font-semibold" style={{ color: "var(--nta-text)" }}>
                  Candidate Name{" "}
                </span>
                <span className="font-bold" style={{ color: "var(--nta-candidate-accent)" }}>
                  {candidateName}
                </span>
              </div>
              <div>
                <span className="font-semibold" style={{ color: "var(--nta-text)" }}>
                  Exam Name{" "}
                </span>
                <span className="font-bold" style={{ color: "var(--nta-candidate-accent)" }}>
                  {examNameLine}
                </span>
              </div>
              <div className="line-clamp-2">
                <span className="font-semibold" style={{ color: "var(--nta-text)" }}>
                  Subject Name{" "}
                </span>
                <span className="font-bold" style={{ color: "var(--nta-candidate-accent)" }}>
                  {subjectPaperLine}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:mt-2 sm:gap-2">
                <span className="font-semibold" style={{ color: "var(--nta-text)" }}>
                  Remaining Time:
                </span>
                <span
                  className="rounded px-2 py-0.5 font-mono text-xs font-bold tabular-nums sm:px-3 sm:py-1 sm:text-sm lg:px-3 lg:py-1 lg:text-sm xl:px-4 xl:py-1.5 xl:text-base"
                  style={{ background: "var(--nta-timer-bg)", color: "var(--nta-timer-text)" }}
                >
                  {formatHhMmSs(secondsLeft)}
                </span>
              </div>
            </div>
          </div>
          <div
            className="w-full min-w-0 max-w-full shrink-0 self-start rounded border border-dashed px-2 py-1.5 sm:max-w-[min(100%,26rem)] sm:px-2.5 sm:py-2 md:px-3 md:py-2.5 lg:w-auto lg:max-w-[min(100%,19rem)] lg:self-center xl:max-w-[22rem] 2xl:max-w-[26rem]"
            style={{ borderColor: "var(--nta-text)" }}
          >
            <p
              className="mb-1 text-[9px] font-bold uppercase tracking-wide sm:mb-1.5 sm:text-[10px] lg:text-[11px] xl:mb-2 xl:text-xs"
              style={{ color: "var(--nta-muted)" }}
            >
              Legend
            </p>
            <div className="flex flex-col gap-1 sm:gap-1.5 md:gap-2">
              <div className="flex min-w-0 gap-1.5 sm:gap-3 lg:gap-3.5">
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
              </div>
              <div className="flex min-w-0 gap-1.5 sm:gap-3 lg:gap-3.5">
                <HeaderLegendCell
                  icon={<ShapeAnswered />}
                  n={counts.answered}
                  label="Answered"
                />
                <HeaderLegendCell
                  icon={<ShapeMarkedOnly />}
                  n={counts.marked}
                  label="Marked for Review"
                />
              </div>
              <div className="min-w-0 border-t pt-1 sm:pt-1.5 md:pt-2" style={{ borderColor: "var(--nta-border)" }}>
                <HeaderLegendCell
                  icon={<ShapeAnsweredMarked />}
                  n={counts.answeredMarked}
                  label="Answered & Marked for Review"
                />
              </div>
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
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden border-r py-3 pl-3 pr-2.5 sm:py-4 sm:pl-5 sm:pr-4 md:pl-6 md:pr-4 lg:py-5 lg:pl-8 lg:pr-5 xl:py-6 xl:pl-10 xl:pr-6 2xl:py-8 2xl:pl-14 2xl:pr-9"
          style={{ borderColor: "var(--nta-border)" }}
        >
          <h2
            className="mb-2 text-base font-bold sm:mb-3 sm:text-lg lg:mb-3 lg:text-xl xl:mb-4 xl:text-2xl 2xl:text-[1.65rem]"
            style={{ color: "var(--nta-text)" }}
          >
            Question {currentIndex + 1}:
          </h2>
          <div className="mb-4 w-full min-w-0 max-h-[min(50vh,24rem)] overflow-y-auto pr-1 sm:max-h-[50vh] sm:mb-5 lg:mb-6 lg:max-h-[42vh] xl:max-h-none xl:mb-8">
            <NtaQuestionStem q={q} />
          </div>
          <p className="mb-1.5 text-sm font-bold sm:mb-2 sm:text-base lg:mb-2.5">Options :</p>
          <div className="w-full min-w-0 space-y-1.5 sm:space-y-2 lg:space-y-2">
            {q.options.map((opt, i) => (
              <label
                key={i}
                className={cn(
                  "flex cursor-pointer items-start gap-1.5 rounded border px-2.5 py-1.5 text-xs sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm lg:gap-2.5 lg:px-3.5 lg:py-2 lg:text-base",
                  selected === i ? "ring-2" : ""
                )}
                style={{
                  borderColor: "var(--nta-border)",
                  background: selected === i ? "var(--nta-surface)" : "transparent",
                  boxShadow: selected === i ? "0 0 0 2px var(--nta-blue)" : undefined,
                }}
              >
                <input
                  type="radio"
                  name={`q-${q.id}`}
                  checked={selected === i}
                  onChange={() => onAnswerSelect(q.id, i)}
                  className="mt-0.5 size-3.5 shrink-0 sm:mt-1 sm:size-4 lg:mt-1.5 lg:size-[1.0625rem]"
                />
                <span className="font-semibold">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <NtaOptionBody text={opt} />
                </div>
              </label>
            ))}
          </div>

          <div className="mt-4 flex w-full min-w-0 flex-wrap gap-1.5 sm:mt-5 sm:gap-2 lg:mt-6 lg:gap-2.5 xl:mt-8 xl:gap-3">
            <NtaBtn variant="green" label="Save & Next" onClick={onSaveAndNext} />
            <NtaBtn variant="white" label="Clear" onClick={onClearResponse} />
            <NtaBtn
              variant="orange"
              label="Save & Mark for Review & Next"
              onClick={onSaveMarkReviewNext}
            />
            <NtaBtn variant="blue" label="Mark for Review & Next" onClick={onMarkReviewNext} />
          </div>

          <div
            className="mt-4 flex w-full min-w-0 flex-wrap items-center justify-between gap-2 border-t pt-3 sm:mt-5 sm:gap-3 sm:pt-4 lg:mt-6 lg:pt-4 xl:mt-8 xl:gap-4 xl:pt-5"
            style={{ borderColor: "var(--nta-border)" }}
          >
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <NtaBtn variant="white" label="<< Back" onClick={onBackNav} />
              <NtaBtn variant="white" label="Next >>" onClick={onNextNav} />
            </div>
            <NtaBtn variant="green" label="Submit" onClick={onSubmitClick} />
          </div>
        </main>

        <aside
          className={cn(
            "flex w-full min-w-0 max-w-full shrink-0 flex-col overflow-x-hidden border-t lg:w-[15.5rem] lg:min-w-[15.5rem] lg:max-w-[15.5rem] lg:border-l lg:border-t-0 xl:w-[17.5rem] xl:min-w-[17.5rem] xl:max-w-[17.5rem] 2xl:w-[20rem] 2xl:min-w-[20rem] 2xl:max-w-[20rem]",
            !paletteOpen &&
              "hidden lg:flex lg:w-0 lg:min-w-0 lg:max-w-none lg:overflow-hidden lg:border-0 lg:p-0 lg:opacity-0"
          )}
          style={{ borderColor: "var(--nta-border)", background: "var(--nta-bg)" }}
        >
          <div
            className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-1.5 pb-3 pt-2 sm:px-2 sm:pb-4 sm:pt-3 lg:px-2 lg:pb-5 lg:pt-3 xl:px-2.5 xl:pb-6"
            style={{ scrollbarGutter: "auto" }}
          >
            <p
              className="mb-1.5 text-[9px] font-bold uppercase tracking-wide sm:mb-2 sm:text-[10px] lg:mb-2 lg:text-[11px] xl:text-xs 2xl:text-sm"
              style={{ color: "var(--nta-muted)" }}
            >
              Question Palette
            </p>
            <div className="grid w-full min-w-0 grid-cols-8 gap-x-1 gap-y-1.5 sm:gap-y-2 lg:grid-cols-9 lg:gap-y-1.5 xl:grid-cols-10 xl:gap-y-2 2xl:grid-cols-8 2xl:gap-x-1.5 2xl:gap-y-2.5">
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
                    className="relative flex aspect-square w-full min-w-0 max-w-full items-center justify-center rounded-md p-0 transition-opacity hover:opacity-95 sm:rounded-lg lg:rounded-lg xl:rounded-xl"
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
                        "relative z-[1] text-[10px] font-black tabular-nums leading-none sm:text-[11px] md:text-xs lg:text-[11px] xl:text-xs 2xl:text-sm",
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
  );
}

/** Compact legend row for header: icon, count, em dash label (two per line + one full-width row). */
function HeaderLegendCell({ icon, n, label }: { icon: React.ReactNode; n: number; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 text-[9px] leading-tight sm:gap-1.5 sm:text-[10px] md:text-[11px] lg:text-[11px] xl:text-xs">
      <span className="flex w-4 shrink-0 items-center justify-center sm:w-5 md:w-5 lg:w-6 [&_svg]:origin-center [&_svg]:scale-[0.85] sm:[&_svg]:scale-[0.9] md:[&_svg]:scale-95 lg:[&_svg]:scale-100">
        {icon}
      </span>
      <span className="shrink-0 font-black tabular-nums" style={{ color: "var(--nta-text)" }}>
        {n}
      </span>
      <span
        className="min-w-0 break-words font-medium leading-snug"
        style={{ color: "var(--nta-muted)" }}
      >
        — {label}
      </span>
    </div>
  );
}

function NtaBtn({
  variant,
  label,
  onClick,
}: {
  variant: "green" | "orange" | "blue" | "white";
  label: string;
  onClick: () => void;
}) {
  const style: CSSProperties =
    variant === "green"
      ? { background: "var(--nta-green)", color: "#fff", border: "1px solid #4cae4c" }
      : variant === "orange"
        ? { background: "var(--nta-orange)", color: "#fff", border: "1px solid #eea236" }
        : variant === "blue"
          ? { background: "#286090", color: "#fff", border: "1px solid #204d74" }
          : {
              background: "var(--nta-bg)",
              color: "var(--nta-text)",
              border: "1px solid var(--nta-border)",
            };
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded px-2 py-1.5 text-center text-[9px] font-bold uppercase leading-tight shadow-sm sm:px-2.5 sm:py-2 sm:text-[10px] md:text-[11px] lg:px-3 lg:py-2 lg:text-xs xl:px-4 xl:py-2.5 xl:text-[13px] 2xl:text-sm"
      style={style}
    >
      {label}
    </button>
  );
}
