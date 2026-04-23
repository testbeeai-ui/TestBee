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
  "[&_.katex]:![font-size:1.125rem] sm:[&_.katex]:![font-size:1.1875rem] lg:[&_.katex]:![font-size:1.25rem] xl:[&_.katex]:![font-size:1.3125rem]";

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
        "prose prose-sm max-w-none leading-snug lg:prose-base",
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
        "prose prose-base max-w-none font-medium leading-relaxed [&_img]:max-h-48 [&_p]:my-2 lg:prose-lg lg:[&_img]:max-h-64 lg:[&_p]:my-3 xl:[&_img]:max-h-[22rem]",
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
  const [langOpen, setLangOpen] = useState(false);
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
      className="flex min-h-0 flex-1 flex-col overflow-hidden text-[13px] sm:text-sm lg:text-[15px] xl:text-base 2xl:text-[1.0625rem] antialiased"
      style={{ color: "var(--nta-text)", background: "var(--nta-bg)" }}
    >
      <header
        className="relative shrink-0 border-b px-3 py-3 sm:px-6 lg:py-4 xl:px-8 xl:py-5"
        style={{
          borderColor: "var(--nta-border)",
          backgroundImage: `linear-gradient(135deg, var(--nta-bg) 0%, var(--nta-pattern) 50%, var(--nta-bg) 100%)`,
        }}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border bg-white lg:h-16 lg:w-16 xl:h-[4.25rem] xl:w-[4.25rem]"
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
            <div className="min-w-0 text-xs leading-tight sm:text-sm lg:leading-snug">
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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="font-semibold" style={{ color: "var(--nta-text)" }}>
                  Remaining Time:
                </span>
                <span
                  className="rounded px-3 py-1 font-mono text-sm font-bold tabular-nums lg:px-4 lg:py-1.5 lg:text-base xl:text-lg"
                  style={{ background: "var(--nta-timer-bg)", color: "var(--nta-timer-text)" }}
                >
                  {formatHhMmSs(secondsLeft)}
                </span>
              </div>
            </div>
          </div>
          <div className="relative flex shrink-0 items-center gap-2 self-start lg:self-center">
            <button
              type="button"
              onClick={() => setLangOpen((o) => !o)}
              className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold lg:px-4 lg:py-2 lg:text-sm"
              style={{
                borderColor: "var(--nta-border)",
                background: "var(--nta-surface)",
                color: "var(--nta-text)",
              }}
            >
              English ▾
            </button>
            {langOpen ? (
              <ul
                className="absolute right-0 top-full z-20 mt-1 min-w-[100px] rounded border py-1 shadow-md"
                style={{ background: "var(--nta-bg)", borderColor: "var(--nta-border)" }}
              >
                <li className="px-3 py-1.5 text-xs">English</li>
              </ul>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        <button
          type="button"
          onClick={() => setPaletteOpen((o) => !o)}
          className="hidden w-6 shrink-0 border-r lg:block lg:w-7 xl:w-8"
          style={{ borderColor: "var(--nta-border)", background: "var(--nta-bar)" }}
          aria-label={paletteOpen ? "Collapse palette" : "Expand palette"}
        >
          <span className="text-xs" style={{ color: "var(--nta-muted)" }}>
            {paletteOpen ? "«" : "»"}
          </span>
        </button>

        <main
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden border-r py-4 pl-6 pr-4 sm:py-5 sm:pl-8 sm:pr-5 lg:py-6 lg:pl-12 lg:pr-7 xl:py-8 xl:pl-14 xl:pr-9 2xl:py-9 2xl:pl-16 2xl:pr-10"
          style={{ borderColor: "var(--nta-border)" }}
        >
          <h2
            className="mb-3 text-lg font-bold sm:text-xl lg:mb-4 lg:text-2xl xl:text-[1.65rem]"
            style={{ color: "var(--nta-text)" }}
          >
            Question {currentIndex + 1}:
          </h2>
          <div className="mb-6 w-full min-w-0 max-h-[50vh] overflow-y-auto pr-1 lg:mb-8 lg:max-h-none">
            <NtaQuestionStem q={q} />
          </div>
          <p className="mb-2 font-bold lg:mb-3">Options :</p>
          <div className="w-full min-w-0 space-y-2 lg:space-y-2.5">
            {q.options.map((opt, i) => (
              <label
                key={i}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded border px-3 py-1.5 text-sm lg:gap-3 lg:px-4 lg:py-2 lg:text-base",
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
                  className="mt-1 size-4 shrink-0 lg:mt-1.5 lg:size-[1.125rem]"
                />
                <span className="font-semibold">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <NtaOptionBody text={opt} />
                </div>
              </label>
            ))}
          </div>

          <div className="mt-6 flex w-full min-w-0 flex-wrap gap-2 lg:mt-8 lg:gap-3">
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
            className="mt-6 flex w-full min-w-0 flex-wrap items-center justify-between gap-3 border-t pt-4 lg:mt-8 lg:gap-4 lg:pt-5"
            style={{ borderColor: "var(--nta-border)" }}
          >
            <div className="flex flex-wrap gap-2">
              <NtaBtn variant="white" label="<< Back" onClick={onBackNav} />
              <NtaBtn variant="white" label="Next >>" onClick={onNextNav} />
            </div>
            <NtaBtn variant="green" label="Submit" onClick={onSubmitClick} />
          </div>
        </main>

        <aside
          className={cn(
            "flex w-full min-w-0 max-w-full shrink-0 flex-col overflow-x-hidden border-t lg:w-[28rem] lg:border-l lg:border-t-0 xl:w-[32rem] 2xl:w-[36rem]",
            !paletteOpen &&
              "hidden lg:flex lg:w-0 lg:min-w-0 lg:overflow-hidden lg:border-0 lg:p-0 lg:opacity-0"
          )}
          style={{ borderColor: "var(--nta-border)", background: "var(--nta-bg)" }}
        >
          <div
            className="m-3 min-w-0 max-w-full space-y-2.5 overflow-x-hidden rounded border px-3 py-3.5 text-[11px] leading-snug sm:text-xs lg:m-4 lg:space-y-3 lg:px-5 lg:py-4 lg:text-xs xl:mx-5 xl:px-5 xl:py-5 xl:text-[13px] 2xl:text-sm"
            style={{ borderColor: "var(--nta-text)", borderStyle: "dashed" }}
          >
            <p
              className="mb-2 font-bold uppercase tracking-wide"
              style={{ color: "var(--nta-muted)" }}
            >
              Legend
            </p>
            <CountRow icon={<ShapeNotVisited />} n={counts.notVisited} label="Not Visited" />
            <CountRow icon={<ShapeNotAnswered />} n={counts.notAnswered} label="Not Answered" />
            <CountRow icon={<ShapeAnswered />} n={counts.answered} label="Answered" />
            <CountRow icon={<ShapeMarkedOnly />} n={counts.marked} label="Marked for Review" />
            <CountRow
              icon={<ShapeAnsweredMarked />}
              n={counts.answeredMarked}
              label="Answered & Marked for Review"
            />
          </div>
          <div
            className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-2 pb-4 sm:px-2.5 lg:px-3 lg:pb-6 xl:px-3.5 xl:pb-7"
            style={{ scrollbarGutter: "auto" }}
          >
            <p
              className="mb-2 text-[10px] font-bold uppercase tracking-wide sm:text-[11px] lg:mb-3 lg:text-xs xl:text-sm 2xl:text-base"
              style={{ color: "var(--nta-muted)" }}
            >
              Question Palette
            </p>
            <div className="grid w-full min-w-0 grid-cols-8 gap-x-1.5 gap-y-2.5 sm:gap-x-2 sm:gap-y-3 lg:gap-x-2 lg:gap-y-3 [grid-template-columns:repeat(8,minmax(0,1fr))]">
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
                    key={qq.id}
                    type="button"
                    onClick={() => onSelectIndex(i)}
                    className="relative flex aspect-square w-full min-w-0 max-w-full items-center justify-center rounded-xl p-0 transition-opacity hover:opacity-95"
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
                        "relative z-[1] text-[12px] font-black tabular-nums leading-none sm:text-sm lg:text-[0.95rem] xl:text-base 2xl:text-lg",
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

function CountRow({ icon, n, label }: { icon: React.ReactNode; n: number; label: string }) {
  return (
    <div className="flex min-w-0 max-w-full items-center gap-2.5 lg:gap-3 xl:gap-3.5">
      <span className="flex w-7 shrink-0 items-center justify-center lg:w-9 xl:w-10 [&_svg]:origin-center [&_svg]:lg:scale-110 xl:[&_svg]:scale-[1.18] 2xl:[&_svg]:scale-[1.28]">
        {icon}
      </span>
      <span className="min-w-[2ch] font-black tabular-nums" style={{ color: "var(--nta-text)" }}>
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
      className="rounded px-3 py-2 text-center text-[11px] font-bold uppercase leading-tight shadow-sm sm:text-xs lg:px-4 lg:py-2.5 lg:text-[13px] xl:text-sm"
      style={style}
    >
      {label}
    </button>
  );
}
