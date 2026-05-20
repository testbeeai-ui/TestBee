"use client";

import { memo, useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronLeft, ChevronRight, Trash2, XCircle } from "lucide-react";
import type { Question } from "@/types";
import { useUserStore } from "@/store/useUserStore";
import { sanitizeMockHtml } from "@/lib/mock/mockHtml";
import { patchNtaHtmlPresentation, wrapPlainMockTextForKatexHtml } from "@/lib/mock/mockRichTextKatex";
import { useKatexAutoRender } from "@/hooks/useKatexAutoRender";
import { cn } from "@/lib/utils";

function formatTopicLabel(topic: string | undefined): string {
  const t = topic?.trim() ?? "";
  if (!t || /^null$/i.test(t)) return "General";
  return t;
}

const stemKatexClass =
  "min-w-0 max-w-full break-words [&_.katex]:!text-[inherit] [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto";

const SavedRevisionStem = memo(function SavedRevisionStem({ q }: { q: Question }) {
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
        "prose prose-sm max-w-none font-bold leading-snug text-foreground dark:prose-invert [&_img]:max-h-32 [&_p]:my-1.5 sm:[&_img]:max-h-48 sm:[&_p]:my-2 sm:prose-base",
        stemKatexClass
      )}
      suppressHydrationWarning
    />
  );
});

const SavedRevisionOptionBody = memo(function SavedRevisionOptionBody({
  text,
  revisionKey,
}: {
  text: string;
  revisionKey: string;
}) {
  const t = text.trim();
  const htmlRef = useRef<HTMLDivElement>(null);
  const safeHtml = useMemo(() => {
    if (!t) return "";
    const core = t.includes("<")
      ? patchNtaHtmlPresentation(sanitizeMockHtml(t))
      : patchNtaHtmlPresentation(sanitizeMockHtml(wrapPlainMockTextForKatexHtml(t)));
    return core;
  }, [t]);
  useKatexAutoRender(htmlRef, safeHtml, revisionKey);
  return (
    <div
      ref={htmlRef}
      className={cn(
        "prose prose-sm max-w-none flex-1 leading-snug text-foreground dark:prose-invert min-w-0",
        "[&_.katex]:![font-size:0.9rem] sm:[&_.katex]:![font-size:1em] md:[&_.katex]:![font-size:1.03rem]",
        stemKatexClass
      )}
      suppressHydrationWarning
    />
  );
});

const SavedRevisionSolutionBody = memo(function SavedRevisionSolutionBody({
  solutionHtml,
  solutionPlain,
  revisionKey,
}: {
  solutionHtml?: string | null;
  solutionPlain: string;
  revisionKey: string;
}) {
  const htmlRef = useRef<HTMLDivElement>(null);
  const safeHtml = useMemo(() => {
    if (solutionHtml?.trim()) {
      return patchNtaHtmlPresentation(sanitizeMockHtml(solutionHtml));
    }
    const plain = String(solutionPlain ?? "").trim();
    if (!plain) return "";
    return patchNtaHtmlPresentation(sanitizeMockHtml(wrapPlainMockTextForKatexHtml(plain)));
  }, [solutionHtml, solutionPlain]);
  useKatexAutoRender(htmlRef, safeHtml, revisionKey);
  if (!safeHtml) return null;
  return (
    <div
      ref={htmlRef}
      className={cn(
        "prose prose-sm max-w-none text-foreground/90 dark:prose-invert [&_p]:my-0.5 sm:[&_p]:my-1",
        stemKatexClass
      )}
      suppressHydrationWarning
    />
  );
});

function SavedQuestionSlide({
  question,
  onUnsave,
}: {
  question: Question;
  onUnsave: () => void;
}) {
  const { recordAnswer } = useUserStore();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const answered = selectedOption !== null;
  const isCorrect = selectedOption === question.correctAnswer;
  const topicLine = formatTopicLabel(question.topic);

  const handleAnswer = (index: number) => {
    if (answered) return;
    setSelectedOption(index);
    recordAnswer({
      questionId: question.id,
      selectedAnswer: index,
      isCorrect: index === question.correctAnswer,
      timestamp: Date.now(),
    });
  };

  return (
    <div className="space-y-2 pt-1 sm:space-y-3 sm:pt-2">
      <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:rounded-2xl sm:p-4">
        <div className="mb-1.5 flex items-start justify-between gap-2 sm:mb-2 sm:gap-3">
          <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary/90 sm:text-[11px]">
              {topicLine}
            </p>
            <SavedRevisionStem q={question} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={onUnsave}
            className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:rounded-xl"
            title="Remove from saved"
          >
            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>
        <div className="space-y-1.5 sm:space-y-2">
          {question.options.map((option, i) => {
            let optionClass = "bg-muted hover:bg-muted/80 text-foreground";
            if (answered) {
              if (i === question.correctAnswer) {
                optionClass = "bg-emerald-500/15 border-2 border-emerald-500 text-foreground";
              } else if (i === selectedOption && !isCorrect) {
                optionClass = "bg-destructive/15 border-2 border-destructive text-foreground";
              } else {
                optionClass = "bg-muted/50 text-muted-foreground";
              }
            } else if (i === selectedOption) {
              optionClass = "bg-primary/20 border-2 border-primary text-foreground";
            }
            return (
              <button
                key={i}
                type="button"
                disabled={answered}
                onClick={() => handleAnswer(i)}
                className={`flex w-full items-center gap-1.5 rounded-lg p-2 text-left text-xs font-medium transition-all sm:gap-2 sm:rounded-xl sm:p-2.5 sm:text-sm ${optionClass}`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background/60 text-[10px] font-bold sm:h-6 sm:w-6 sm:text-xs">
                  {String.fromCharCode(65 + i)}
                </span>
                <SavedRevisionOptionBody text={option} revisionKey={`${question.id}-opt-${i}`} />
                {answered && i === question.correctAnswer && (
                  <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-600 sm:h-4 sm:w-4" />
                )}
                {answered && i === selectedOption && !isCorrect && (
                  <XCircle className="ml-auto h-3.5 w-3.5 shrink-0 text-destructive sm:h-4 sm:w-4" />
                )}
              </button>
            );
          })}
        </div>
        {answered && (question.solutionHtml?.trim() || question.solution?.trim()) && (
          <div className="mt-2 space-y-0.5 rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs text-muted-foreground sm:mt-3 sm:space-y-1 sm:rounded-xl sm:p-2.5 sm:text-sm">
            <p className="text-xs font-semibold text-foreground sm:text-sm">Explanation</p>
            <SavedRevisionSolutionBody
              solutionHtml={question.solutionHtml}
              solutionPlain={question.solution}
              revisionKey={`${question.id}-sol`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface SavedQuestionsCarouselProps {
  questions: Question[];
  onUnsave: (questionId: string) => void;
}

export function SavedQuestionsCarousel({ questions, onUnsave }: SavedQuestionsCarouselProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex((i) => Math.max(0, Math.min(i, Math.max(0, questions.length - 1))));
  }, [questions.length]);

  if (questions.length === 0) return null;

  const q = questions[Math.min(index, questions.length - 1)]!;

  return (
    <div className="space-y-2 pt-1 sm:space-y-3 sm:pt-2">
      <div className="flex items-center justify-between gap-1.5 sm:gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9 shrink-0 rounded-lg px-2.5 text-xs sm:h-10 sm:rounded-xl sm:px-3 sm:text-sm"
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          <ChevronLeft className="mr-0.5 h-3.5 w-3.5 sm:mr-1 sm:h-4 sm:w-4" /> Previous
        </Button>
        <span className="min-w-0 truncate text-center text-[11px] font-bold tabular-nums text-muted-foreground sm:text-sm">
          Question {index + 1} of {questions.length}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-9 shrink-0 rounded-lg px-2.5 text-xs sm:h-10 sm:rounded-xl sm:px-3 sm:text-sm"
          type="button"
          onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
          disabled={index === questions.length - 1}
        >
          Next <ChevronRight className="ml-0.5 h-3.5 w-3.5 sm:ml-1 sm:h-4 sm:w-4" />
        </Button>
      </div>
      <SavedQuestionSlide key={q.id} question={q} onUnsave={() => onUnsave(q.id)} />
    </div>
  );
}
