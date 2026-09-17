"use client";

import { memo, useMemo, useRef } from "react";
import type { Question } from "@/types";
import { sanitizeNumericDraft } from "@/lib/chapter-pyq/pyqNumericDraft";
import { pyqPaperHoverTitle } from "@/lib/chapter-pyq/pyqQuestionMap";
import { sanitizeMockHtml } from "@/lib/mock/mockHtml";
import {
  patchNtaHtmlPresentation,
  repairBankMathLatex,
  wrapPlainMockTextForKatexHtml,
} from "@/lib/mock/mockRichTextKatex";
import { useKatexAutoRender } from "@/hooks/useKatexAutoRender";
import { cn } from "@/lib/utils";

export function formatNtaHhMmSs(totalSeconds: number): string {
  const t = Math.max(0, totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const ntaImgClass =
  "[&_img]:my-2 [&_img]:block [&_img]:h-auto [&_img]:max-h-56 [&_img]:max-w-full [&_img]:w-auto [&_img]:rounded [&_img]:object-contain sm:[&_img]:max-h-64 lg:[&_img]:max-h-72";

const ntaMdClass =
  "min-w-0 max-w-full break-words text-[var(--nta-text)] [&_.katex]:!text-[var(--nta-text)] [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_a]:!text-[var(--nta-blue)] [&_.katex-error]:!text-[var(--nta-text)] [&_.katex-error]:!bg-transparent";

/** Repair `\\(…\\)` / `math-tex` spans in sanitized HTML before KaTeX auto-render. */
function repairMathInMockHtml(html: string): string {
  return html.replace(
    /\\\(([\s\S]*?)\\\)/g,
    (_match, inner: string) => `\\(${repairBankMathLatex(inner)}\\)`
  );
}

const ntaStemKatexClass =
  "[&_.katex]:![font-size:1.15rem] sm:[&_.katex]:![font-size:1.22rem] lg:[&_.katex]:![font-size:1.28rem] xl:[&_.katex]:![font-size:1.32rem] [&_.katex-display]:my-2 sm:[&_.katex-display]:my-3";

const ntaMobileStemKatexClass =
  "[&_.katex]:![font-size:1rem] sm:[&_.katex]:![font-size:1.05rem] [&_.katex-display]:my-1.5";

const ntaOptionKatexClass =
  "[&_.katex]:![font-size:1.1rem] sm:[&_.katex]:![font-size:1.16rem] lg:[&_.katex]:![font-size:1.22rem]";

const ntaMobileOptionKatexClass = "[&_.katex]:![font-size:0.95rem]";

/** Mobile exam stem/options — wireframe colors, not desktop NtaMockTokens. */
const ntaMobileMdClass =
  "min-w-0 max-w-full break-words text-[var(--nta-m-text)] [&_.katex]:!text-[var(--nta-m-text)] [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_a]:!text-[var(--nta-m-tab)] [&_.katex-error]:!text-[var(--nta-m-text)] [&_.katex-error]:!bg-transparent [&_em]:!text-[var(--nta-m-emphasis)] [&_em]:not-italic";

export const NtaOptionBody = memo(function NtaOptionBody({
  text,
  mobile = false,
  className,
}: {
  text: string;
  mobile?: boolean;
  className?: string;
}) {
  const t = text.trim();
  const htmlRef = useRef<HTMLDivElement>(null);
  const safeHtml = useMemo(() => {
    if (!t) return "";
    const core = t.includes("<")
      ? sanitizeMockHtml(t)
      : sanitizeMockHtml(wrapPlainMockTextForKatexHtml(t));
    return repairMathInMockHtml(patchNtaHtmlPresentation(core));
  }, [t]);
  useKatexAutoRender(htmlRef, safeHtml, t);

  return (
    <div
      ref={htmlRef}
      className={cn(
        "prose max-w-none text-base leading-normal sm:text-[17px] lg:text-[18px]",
        mobile && "text-sm sm:text-[15px]",
        mobile ? ntaMobileMdClass : ntaMdClass,
        ntaImgClass,
        mobile ? ntaMobileOptionKatexClass : ntaOptionKatexClass,
        className
      )}
      suppressHydrationWarning
    />
  );
});

const KEYPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "-"] as const;

/** JEE Main numeric-entry answer box. Mobile also gets an on-screen keypad. */
export const NtaNumericAnswerInput = memo(function NtaNumericAnswerInput({
  value,
  onChange,
  disabled = false,
  mobile = false,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  mobile?: boolean;
}) {
  const push = (key: string) =>
    onChange(
      sanitizeNumericDraft(key === "-" && value.startsWith("-") ? value.slice(1) : value + key)
    );

  return (
    <div className="w-full min-w-0">
      <p
        className={
          mobile ? "mb-1 text-sm font-bold" : "mb-2 text-base font-bold sm:text-lg"
        }
      >
        Answer :
      </p>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(sanitizeNumericDraft(e.target.value))}
        aria-label="Numerical answer"
        className="w-full max-w-[18rem] rounded-md border px-4 py-2.5 text-lg tabular-nums outline-none disabled:opacity-50 sm:text-xl"
        style={{
          borderColor: "var(--nta-border)",
          background: "var(--nta-surface)",
          color: "var(--nta-text)",
        }}
      />
      <p className="mt-1.5 text-xs sm:text-[13px]" style={{ color: "var(--nta-muted)" }}>
        {disabled
          ? "Numeric entry is unavailable in this session."
          : "Enter the numerical value. No options for this question."}
      </p>
      {mobile && !disabled ? (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {KEYPAD.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => push(key)}
              className="rounded border py-2 text-base font-bold tabular-nums"
              style={{ borderColor: "var(--nta-border)", background: "var(--nta-surface)" }}
            >
              {key}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange(sanitizeNumericDraft(value.slice(0, -1)))}
            className="col-span-3 rounded border py-2 text-sm font-bold"
            style={{ borderColor: "var(--nta-border)", background: "var(--nta-surface)" }}
          >
            Backspace
          </button>
        </div>
      ) : null}
    </div>
  );
});

const cardRichMdClass =
  "min-w-0 max-w-full break-words text-foreground/90 [&_.katex]:!text-foreground [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_.katex-error]:!text-foreground [&_.katex-error]:!bg-transparent";

/** Any mock HTML or plain string (solutions, hints) — same KaTeX pipeline as stems/options. */
export const NtaRichTextBlock = memo(function NtaRichTextBlock({
  text,
  mobile = false,
  className,
  variant = "default",
}: {
  text: string;
  mobile?: boolean;
  className?: string;
  variant?: "default" | "solution";
}) {
  const t = String(text ?? "").trim();
  const htmlRef = useRef<HTMLDivElement>(null);
  const safeHtml = useMemo(() => {
    if (!t) return "";
    const core = t.includes("<")
      ? sanitizeMockHtml(t)
      : sanitizeMockHtml(wrapPlainMockTextForKatexHtml(t));
    return repairMathInMockHtml(patchNtaHtmlPresentation(core));
  }, [t]);
  useKatexAutoRender(htmlRef, safeHtml, t);

  if (!safeHtml) return null;

  const variantClass = (() => {
    switch (variant) {
      case "solution":
        return cn(
          "nta-sol-sheet nta-worked-solution cbse-mcq-katex min-w-0 max-w-full break-words [&_.katex]:!text-white [&_.katex_*]:!text-white",
          ntaMdClass,
          ntaImgClass,
          mobile
            ? "[&_.katex]:![font-size:1.02rem] sm:[&_.katex]:![font-size:1.08rem]"
            : ntaStemKatexClass
        );
      case "default":
        return cn(
          "cbse-mcq-katex prose prose-sm max-w-none leading-relaxed",
          cardRichMdClass,
          ntaImgClass,
          mobile ? ntaMobileOptionKatexClass : ntaOptionKatexClass,
          "[&_.katex-display]:my-1"
        );
      default: {
        const _exhaustive: never = variant;
        return _exhaustive;
      }
    }
  })();

  return (
    <div ref={htmlRef} className={cn(variantClass, className)} suppressHydrationWarning />
  );
});

export const NtaQuestionStem = memo(function NtaQuestionStem({
  q,
  mobile = false,
  className,
}: {
  q: Question;
  mobile?: boolean;
  className?: string;
}) {
  const htmlRef = useRef<HTMLDivElement>(null);
  const safeHtml = useMemo(() => {
    if (q.questionHtml) {
      return repairMathInMockHtml(patchNtaHtmlPresentation(sanitizeMockHtml(q.questionHtml)));
    }
    const plain = String(q.question ?? "").trim();
    if (!plain) return "";
    return repairMathInMockHtml(
      patchNtaHtmlPresentation(sanitizeMockHtml(wrapPlainMockTextForKatexHtml(plain)))
    );
  }, [q.questionHtml, q.question]);
  useKatexAutoRender(htmlRef, safeHtml, q.id);

  if (!safeHtml) return null;
  return (
    <div
      ref={htmlRef}
      className={cn(
        "prose max-w-none font-medium leading-[1.75] [&_p]:my-2",
        mobile
          ? "text-[14px] leading-[1.7] sm:text-[15px]"
          : "text-base sm:text-[17px] md:text-[18px] lg:text-[18.5px] xl:text-[19px]",
        mobile ? ntaMobileMdClass : ntaMdClass,
        ntaImgClass,
        mobile ? ntaMobileStemKatexClass : ntaStemKatexClass,
        className
      )}
      suppressHydrationWarning
    />
  );
});

export type NtaQuestionSource = {
  date: string;
  shift: string | null;
};

/** Date + shift chip for Chapter PYQ. `shift` is Morning or Evening — never a lone E/M. */
export function NtaQuestionSourceChip({ date, shift }: NtaQuestionSource) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold sm:text-sm lg:text-[0.95rem]"
      style={{
        borderColor: "var(--nta-blue)",
        background: "var(--nta-surface)",
        color: "var(--nta-text)",
        boxShadow: "inset 0 0 0 1px var(--nta-blue)",
      }}
      title={pyqPaperHoverTitle(date, shift === "Morning" || shift === "Evening" ? shift : null)}
    >
      <span>{date}</span>
      {shift ? (
        <span
          className="rounded border px-1.5 py-px text-[10px] font-bold uppercase tracking-wide sm:text-[11px]"
          style={{
            borderColor: "var(--nta-title-blue)",
            color: "var(--nta-title-blue)",
            background: "var(--nta-bg)",
          }}
        >
          {shift}
        </span>
      ) : null}
    </span>
  );
}

export interface NtaLegendCounts {
  notVisited: number;
  notAnswered: number;
  answered: number;
  marked: number;
  answeredMarked: number;
}

export function computeNtaLegendCounts(
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
