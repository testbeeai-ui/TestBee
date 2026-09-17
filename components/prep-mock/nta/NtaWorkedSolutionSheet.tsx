"use client";

import { useMemo, useRef } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { useKatexAutoRender } from "@/hooks/useKatexAutoRender";
import { sanitizeMockHtml } from "@/lib/mock/mockHtml";
import {
  patchNtaHtmlPresentation,
  repairBankMathLatex,
} from "@/lib/mock/mockRichTextKatex";
import {
  parsePyqWorkedSolution,
  problemTexForQuestion,
  wrapDisplayTex,
  type PyqWorkedBlock,
  type PyqWorkedPhase,
  type PyqWorkedSolution,
} from "@/lib/chapter-pyq/pyqWorkedSolution";
import { cn } from "@/lib/utils";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const MATH_WHITE =
  "[&_.katex]:!text-white [&_.katex_*]:!text-white [&_.katex-html]:!text-white [&_.katex-error]:!text-red-400";

const GENERIC_STEP_TITLE = new Set(["setup", "working", "evaluate", "result", "solution"]);

function repairMathHtml(html: string): string {
  return html.replace(
    /\\\(([\s\S]*?)\\\)/g,
    (_match, inner: string) => `\\(${repairBankMathLatex(inner)}\\)`
  );
}

function NtaSolutionKatex({
  text,
  display = false,
  className,
}: {
  text: string;
  display?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const safeHtml = useMemo(() => {
    const raw = display ? wrapDisplayTex(text) : text.trim();
    if (!raw) return "";
    return repairMathHtml(patchNtaHtmlPresentation(sanitizeMockHtml(raw)));
  }, [text, display]);
  useKatexAutoRender(ref, safeHtml, `${display}:${text}`);
  if (!safeHtml) return null;
  return <div ref={ref} className={cn(MATH_WHITE, className)} />;
}

function BoxedDisplay({ tex }: { tex: string }) {
  return (
    <div className="nta-sol-display-box min-w-0 max-w-full overflow-visible rounded-lg border border-slate-700/60 bg-slate-950 px-3 py-2.5 text-left">
      <NtaSolutionKatex
        text={tex}
        display
        className="max-w-full text-base text-white [&_.katex-display]:my-0 [&_.katex-display]:text-left sm:text-[1.05rem]"
      />
    </div>
  );
}

function QuestionPill({ tex }: { tex: string }) {
  const prepared = problemTexForQuestion(tex);
  if (!prepared.text) return null;
  return (
    <div className="nta-sol-question min-w-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-left">
      <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
        Question
      </span>
      {prepared.display ? (
        <div className="nta-sol-display-box min-w-0 max-w-full overflow-visible">
          <NtaSolutionKatex
            text={prepared.text}
            display
            className="max-w-full text-base font-medium text-white [&_.katex-display]:my-0 [&_.katex-display]:text-left sm:text-lg"
          />
        </div>
      ) : (
        <NtaSolutionKatex
          text={prepared.text}
          className="text-[15px] leading-7 text-white sm:text-base sm:leading-8"
        />
      )}
    </div>
  );
}

function stepHeading(title: string): string | null {
  const trimmed = title.trim();
  if (!trimmed) return null;
  if (/^step\s+\d+$/i.test(trimmed)) return null;
  if (GENERIC_STEP_TITLE.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

function isPunctParagraph(text: string): boolean {
  return /^[\s;:,.·•\-–—]*$/.test(text.trim());
}

function PhaseBlockView({ block }: { block: PyqWorkedBlock }) {
  switch (block.kind) {
    case "paragraph":
      if (isPunctParagraph(block.text)) return null;
      return (
        <NtaSolutionKatex
          text={block.text}
          className="text-[14.5px] leading-7 text-slate-300"
        />
      );
    case "callout":
      return (
        <div className="rounded-lg border border-indigo-500/25 bg-indigo-950/25 px-3 py-2">
          {block.text ? (
            <NtaSolutionKatex
              text={block.text}
              className="mb-1.5 text-xs font-medium text-indigo-200"
            />
          ) : null}
          {block.tex ? <BoxedDisplay tex={block.tex} /> : null}
        </div>
      );
    case "display":
      return <BoxedDisplay tex={block.tex} />;
    case "grid": {
      const compact =
        block.cells.length <= 2 &&
        block.cells.every((cell) => cell.tex.replace(/\s+/g, "").length <= 28);
      if (compact) {
        return (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {block.cells.map((cell, i) => (
              <div
                key={i}
                className="nta-sol-display-box min-w-0 overflow-visible rounded-lg border border-slate-700/60 bg-slate-950 px-3 py-2.5 text-left"
              >
                {cell.label ? (
                  <NtaSolutionKatex
                    text={cell.label}
                    className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                  />
                ) : null}
                {cell.tex ? (
                  <NtaSolutionKatex
                    text={cell.tex}
                    display
                    className="text-sm text-white [&_.katex-display]:my-0 [&_.katex-display]:text-left"
                  />
                ) : null}
              </div>
            ))}
          </div>
        );
      }
      return (
        <div className="overflow-hidden rounded-lg border border-slate-700/60">
          {block.cells.map((cell, i) => (
            <div
              key={i}
              className="flex min-w-0 flex-col gap-1.5 border-b border-slate-800 bg-slate-950 px-3 py-2.5 last:border-b-0 sm:flex-row sm:items-start sm:gap-4"
            >
              {cell.label ? (
                <NtaSolutionKatex
                  text={cell.label}
                  className="shrink-0 pt-0.5 text-[12px] font-semibold tracking-wide text-slate-400 sm:w-28"
                />
              ) : null}
              {cell.tex ? (
                <div className="nta-sol-display-box min-w-0 flex-1 overflow-visible">
                  <NtaSolutionKatex
                    text={cell.tex}
                    display
                    className="text-sm text-white [&_.katex-display]:my-0 [&_.katex-display]:text-left"
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      );
    }
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

function StepBlocks({ blocks }: { blocks: PyqWorkedBlock[] }) {
  const rows: PyqWorkedBlock[][] = [];
  for (const block of blocks) {
    const last = rows[rows.length - 1];
    if (block.kind === "display" && last?.[0]?.kind === "display") last.push(block);
    else rows.push([block]);
  }
  return (
    <div className="space-y-3">
      {rows.map((row, i) =>
        row[0]?.kind === "display" ? (
          <div key={i} className="space-y-2">
            {row.map((block, j) => (
              <PhaseBlockView key={j} block={block} />
            ))}
          </div>
        ) : (
          <PhaseBlockView key={i} block={row[0]!} />
        )
      )}
    </div>
  );
}

function StepSection({ phase, index }: { phase: PyqWorkedPhase; index: number }) {
  const heading = stepHeading(phase.title);
  return (
    <section className="min-w-0 border-l-2 border-slate-700/70 pl-4">
      <div className="mb-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-400">
          Step {index + 1}
        </p>
        {heading ? (
          <h3 className="mt-0.5 text-[15px] font-semibold leading-snug tracking-tight text-white">
            {heading}
          </h3>
        ) : null}
      </div>
      <StepBlocks blocks={phase.blocks} />
    </section>
  );
}

export function NtaWorkedSolutionSheet({
  solution,
  onClose,
}: {
  solution: PyqWorkedSolution;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        jakarta.className,
        "nta-worked-solution relative flex h-auto max-h-[78dvh] w-full min-w-0 max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-800/80 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl sm:max-h-[min(70vh,38rem)] sm:rounded-2xl sm:p-5"
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="relative flex shrink-0 items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            Worked Solution
          </span>
          <h2
            id="nta-solution-title"
            className="mt-0.5 text-xl font-bold tracking-tight text-white"
          >
            {solution.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg border border-slate-700/50 bg-slate-800/80 px-3.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700/80"
        >
          Close
        </button>
      </div>
      <div className="relative mt-3 min-h-0 min-w-0 flex-auto space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain pr-1">
        {solution.problem_tex ? <QuestionPill tex={solution.problem_tex} /> : null}
        {solution.phases.map((phase, index) => (
          <StepSection key={`${phase.title}-${index}`} phase={phase} index={index} />
        ))}
        <div className="flex flex-col items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-950/25 p-3 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-sm font-bold text-emerald-400">
              ✓
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Final Answer
              </span>
              {solution.answer_note ? (
                <NtaSolutionKatex
                  text={solution.answer_note}
                  className="text-xs text-slate-400"
                />
              ) : (
                <div className="text-xs text-slate-400">The keyed result</div>
              )}
            </div>
          </div>
          {solution.answer_tex ? (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-2xl font-bold text-white">
              <NtaSolutionKatex
                text={solution.answer_tex}
                display
                className="[&_.katex-display]:my-0"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function parseSolutionForSheet(text: string): PyqWorkedSolution | null {
  return parsePyqWorkedSolution(text);
}
