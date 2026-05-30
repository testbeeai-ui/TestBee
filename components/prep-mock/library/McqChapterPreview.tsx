"use client";

import {
  NtaOptionBody,
  NtaQuestionStem,
  NtaRichTextBlock,
} from "@/components/prep-mock/nta/ntaExamParts";
import type { Question } from "@/types";
import { cn } from "@/lib/utils";

type McqChapterPreviewProps = {
  questions: Question[];
  className?: string;
};

/** Read-only vertical list — all chapter MCQs visible while scrolling (no next/prev exam UI). */
export default function McqChapterPreview({ questions, className }: McqChapterPreviewProps) {
  return (
    <div className={cn("min-w-0 w-full max-w-full space-y-4 sm:space-y-5", className)}>
      {questions.map((q, idx) => (
        <article
          key={q.id}
          id={`mcq-preview-q-${idx + 1}`}
          className="scroll-mt-4 min-w-0 max-w-full rounded-2xl border border-border bg-card/60 p-3 shadow-sm sm:p-5"
        >
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/80 pb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground sm:text-xs">
              Question {idx + 1}
            </span>
            <span className="shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground">
              {idx + 1} / {questions.length}
            </span>
          </div>

          <div className="min-w-0 max-w-full overflow-x-auto overflow-y-visible">
            <NtaQuestionStem q={q} mobile />
          </div>

          <ol className="mt-3 min-w-0 max-w-full space-y-2 sm:mt-4">
            {q.options.map((opt, optIdx) => {
              const letter = String.fromCharCode(65 + optIdx);
              const text = opt?.trim();
              if (!text) return null;
              return (
                <li
                  key={optIdx}
                  className="flex min-w-0 max-w-full gap-2.5 rounded-xl border border-border/80 bg-muted/25 px-2.5 py-2 sm:gap-3 sm:px-4 sm:py-2.5"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-background text-xs font-bold text-foreground ring-1 ring-border">
                    {letter}
                  </span>
                  <div className="min-w-0 flex-1 overflow-x-auto text-sm leading-relaxed">
                    <NtaOptionBody text={text} mobile />
                  </div>
                </li>
              );
            })}
          </ol>

          {(q.solutionHtml || q.solution) && (
            <div className="bits-quiz-explanation mt-4 border-t border-border/80 pt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Explanation
              </p>
              <NtaRichTextBlock text={q.solutionHtml?.trim() || q.solution?.trim() || ""} mobile />
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
