"use client";

import { memo, useMemo, useRef } from "react";
import type { Question } from "@/types";
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
  "[&_img]:my-2 [&_img]:block [&_img]:h-auto [&_img]:max-h-48 [&_img]:max-w-full [&_img]:w-auto [&_img]:rounded [&_img]:object-contain sm:[&_img]:max-h-56 lg:[&_img]:max-h-64";

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
  "[&_.katex]:![font-size:1.0625rem] sm:[&_.katex]:![font-size:1.125rem] lg:[&_.katex]:![font-size:1.125rem] xl:[&_.katex]:![font-size:1.1875rem] 2xl:[&_.katex]:![font-size:1.25rem]";

const ntaMobileStemKatexClass = "[&_.katex]:![font-size:0.9375rem] [&_.katex-display]:my-1";

const ntaOptionKatexClass =
  "[&_.katex]:![font-size:1.0625rem] lg:[&_.katex]:![font-size:1.09375rem]";

const ntaMobileOptionKatexClass = "[&_.katex]:![font-size:0.875rem]";

/** Mobile exam stem/options — wireframe colors, not desktop NtaMockTokens. */
const ntaMobileMdClass =
  "min-w-0 max-w-full break-words text-[var(--nta-m-text)] [&_.katex]:!text-[var(--nta-m-text)] [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_a]:!text-[var(--nta-m-tab)] [&_.katex-error]:!text-[var(--nta-m-text)] [&_.katex-error]:!bg-transparent [&_em]:!text-[var(--nta-m-emphasis)] [&_em]:not-italic";

export const NtaOptionBody = memo(function NtaOptionBody({
  text,
  mobile = false,
}: {
  text: string;
  mobile?: boolean;
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
        "prose prose-sm max-w-none leading-snug",
        mobile ? ntaMobileMdClass : ntaMdClass,
        ntaImgClass,
        mobile ? ntaMobileOptionKatexClass : ntaOptionKatexClass
      )}
      suppressHydrationWarning
    />
  );
});

export const NtaQuestionStem = memo(function NtaQuestionStem({
  q,
  mobile = false,
}: {
  q: Question;
  mobile?: boolean;
}) {
  const htmlRef = useRef<HTMLDivElement>(null);
  const safeHtml = useMemo(() => {
    if (q.questionHtml) {
      return repairMathInMockHtml(
        patchNtaHtmlPresentation(sanitizeMockHtml(q.questionHtml))
      );
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
        "prose prose-sm max-w-none font-medium leading-relaxed [&_p]:my-1.5",
        mobile && "text-[13px] leading-[1.7]",
        mobile ? ntaMobileMdClass : ntaMdClass,
        ntaImgClass,
        mobile ? ntaMobileStemKatexClass : ntaStemKatexClass,
        !mobile && "sm:prose-base sm:[&_p]:my-2 lg:prose-lg lg:[&_p]:my-2.5 xl:[&_p]:my-3"
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
