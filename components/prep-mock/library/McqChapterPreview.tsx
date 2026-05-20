"use client";

import { NtaOptionBody, NtaQuestionStem } from "@/components/prep-mock/nta/ntaExamParts";
import type { Question } from "@/types";
import { cn } from "@/lib/utils";

type McqChapterPreviewProps = {
  questions: Question[];
  className?: string;
};

/** Read-only vertical list — all chapter MCQs visible while scrolling (no next/prev exam UI). */
export default function McqChapterPreview({ questions, className }: McqChapterPreviewProps) {
  return (
    <div className={cn("space-y-5", className)}>
      {questions.map((q, idx) => (
        <article
          key={q.id}
          id={`mcq-preview-q-${idx + 1}`}
          className="scroll-mt-4 rounded-2xl border border-border bg-card/60 p-4 shadow-sm sm:p-5"
        >
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/80 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Question {idx + 1}
            </span>
            <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
              {idx + 1} / {questions.length}
            </span>
          </div>

          <NtaQuestionStem q={q} />

          <ol className="mt-4 space-y-2">
            {q.options.map((opt, optIdx) => {
              const letter = String.fromCharCode(65 + optIdx);
              const text = opt?.trim();
              if (!text) return null;
              return (
                <li
                  key={optIdx}
                  className="flex gap-3 rounded-xl border border-border/80 bg-muted/25 px-3 py-2.5 sm:px-4"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-background text-xs font-bold text-foreground ring-1 ring-border">
                    {letter}
                  </span>
                  <div className="min-w-0 flex-1 text-sm leading-relaxed">
                    <NtaOptionBody text={text} />
                  </div>
                </li>
              );
            })}
          </ol>
        </article>
      ))}
    </div>
  );
}
