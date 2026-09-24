"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  MinusCircle,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NtaMockTokens, type NtaSkin } from "@/components/prep-mock/nta/NtaMockTokens";
import { NtaOptionBody, NtaQuestionStem } from "@/components/prep-mock/nta/ntaExamParts";
import { NtaSolutionModal } from "@/components/prep-mock/nta/NtaSolutionModal";
import { ReviewInlineHtml } from "@/components/prep-mock/utils/mockLatexReview";
import {
  pyqPaperHoverTitle,
  splitPyqExamLabel,
  type ChapterPyqQuestion,
} from "@/lib/chapter-pyq/pyqQuestionMap";
import {
  formatPyqCorrectAnswer,
  formatPyqStudentAnswer,
  pyqReviewFilterMatches,
  pyqReviewVerdict,
  type PyqReviewFilter,
  type PyqReviewVerdict,
} from "@/lib/chapter-pyq/pyqScoring";
import { ntaQuestionSolutionText } from "@/lib/mock/ntaQuestionSolution";
import { cn } from "@/lib/utils";

type ChapterPyqResultViewProps = {
  chapterName: string;
  setLabel: string;
  entries: ChapterPyqQuestion[];
  answers: Record<string, number>;
  ntaSkin: NtaSkin;
  onExit: () => void;
  onRetry: () => void;
  onNextSet?: () => void;
};

function VerdictIcon({ verdict }: { verdict: PyqReviewVerdict }) {
  switch (verdict) {
    case "correct":
      return <CheckCircle2 className="h-5 w-5 shrink-0 text-edu-green" />;
    case "wrong":
      return <XCircle className="h-5 w-5 shrink-0 text-destructive" />;
    case "skipped":
      return <MinusCircle className="h-5 w-5 shrink-0 text-muted-foreground" />;
    default: {
      const _exhaustive: never = verdict;
      return _exhaustive;
    }
  }
}

function verdictLabel(verdict: PyqReviewVerdict): string {
  switch (verdict) {
    case "correct":
      return "Correct";
    case "wrong":
      return "Wrong";
    case "skipped":
      return "Skipped";
    default: {
      const _exhaustive: never = verdict;
      return _exhaustive;
    }
  }
}

const REVIEW_FILTERS: { id: PyqReviewFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "correct", label: "Correct" },
  { id: "wrong", label: "Wrong" },
  { id: "skipped", label: "Skipped" },
];

export default function ChapterPyqResultView({
  chapterName,
  setLabel,
  entries,
  answers,
  ntaSkin,
  onExit,
  onRetry,
  onNextSet,
}: ChapterPyqResultViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [solutionOpenId, setSolutionOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<PyqReviewFilter>("all");

  const { score, skipped, wrong } = useMemo(() => {
    let correct = 0;
    let skippedCount = 0;
    let wrongCount = 0;
    for (const entry of entries) {
      const verdict = pyqReviewVerdict(entry.question, answers[entry.question.id]);
      if (verdict === "correct") correct += 1;
      else if (verdict === "skipped") skippedCount += 1;
      else wrongCount += 1;
    }
    return { score: correct, skipped: skippedCount, wrong: wrongCount };
  }, [entries, answers]);

  const visible = useMemo(
    () =>
      entries.filter((entry) =>
        pyqReviewFilterMatches(pyqReviewVerdict(entry.question, answers[entry.question.id]), filter)
      ),
    [entries, answers, filter]
  );

  const allSkipped = skipped === entries.length;
  const lead = allSkipped
    ? "You submitted without answering. Open a question, then tap Solution on the left to see the write-up."
    : "Open a question to see the paper. Solution is on the left; your answer is on the right.";

  const filterCount = (id: PyqReviewFilter): number => {
    switch (id) {
      case "all":
        return entries.length;
      case "correct":
        return score;
      case "wrong":
        return wrong;
      case "skipped":
        return skipped;
      default: {
        const _exhaustive: never = id;
        return _exhaustive;
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" className="rounded-xl font-semibold" onClick={onExit}>
          <ArrowLeft className="h-4 w-4" />
          All sets
        </Button>
        <div className="flex flex-wrap gap-2">
          {onNextSet ? (
            <Button type="button" variant="outline" size="sm" className="rounded-xl font-semibold" onClick={onNextSet}>
              Next set
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : null}
          <Button type="button" size="sm" className="rounded-xl font-semibold" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" />
            Try this set again
          </Button>
        </div>
      </div>

      <header className="space-y-2 text-center sm:text-left">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Set complete</p>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          {score} / {entries.length} correct
        </h2>
        <p className="text-sm font-medium text-muted-foreground">
          {chapterName} · {setLabel}
        </p>
        <p className="max-w-2xl text-sm text-muted-foreground">{lead}</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card/40 p-4 text-center">
          <span className="block text-2xl font-extrabold text-edu-green">{score}</span>
          <span className="text-xs font-bold text-muted-foreground">Correct</span>
        </div>
        <div className="rounded-2xl border border-border bg-card/40 p-4 text-center">
          <span className="block text-2xl font-extrabold text-destructive">{wrong}</span>
          <span className="text-xs font-bold text-muted-foreground">Wrong</span>
        </div>
        <div className="rounded-2xl border border-border bg-card/40 p-4 text-center">
          <span className="block text-2xl font-extrabold text-muted-foreground">{skipped}</span>
          <span className="text-xs font-bold text-muted-foreground">Skipped</span>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card/40 p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-foreground">Review answers</h3>
            <p className="text-xs text-muted-foreground">Tap a row. Green is the key; red is your miss.</p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter review">
            {REVIEW_FILTERS.map((chip) => {
              const count = filterCount(chip.id);
              const active = filter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={active}
                  disabled={count === 0 && chip.id !== "all"}
                  onClick={() => setFilter(chip.id)}
                  className={
                    active
                      ? "rounded-full border border-primary bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary"
                      : "rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40"
                  }
                >
                  {chip.label} · {count}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {visible.map((entry) => {
            const i = entries.indexOf(entry);
            const q = entry.question;
            const selected = answers[q.id];
            const verdict = pyqReviewVerdict(q, selected);
            const open = expandedId === q.id;
            const yours = formatPyqStudentAnswer(q, selected);
            const correct = formatPyqCorrectAnswer(q);
            const paper = entry.examLabel ? splitPyqExamLabel(entry.examLabel) : null;
            const topic = entry.topicName ?? entry.pdfChapterName;

            return (
              <div key={q.id} className="overflow-hidden rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : q.id)}
                  className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/30"
                >
                  <VerdictIcon verdict={verdict} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-xs font-bold text-foreground sm:text-sm">
                      Q{i + 1}. <ReviewInlineHtml text={q.question} />
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground sm:text-xs">
                      {topic ? <span>{topic}</span> : null}
                      {paper ? (
                        <span title={pyqPaperHoverTitle(paper.date, paper.shift)}>
                          {paper.date}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-[11px] font-bold sm:text-xs",
                      verdict === "correct" && "text-edu-green",
                      verdict === "wrong" && "text-destructive",
                      verdict === "skipped" && "text-muted-foreground"
                    )}
                  >
                    {verdictLabel(verdict)}
                  </span>
                  {open ? (
                    <ChevronUp className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  )}
                </button>
                {open ? (
                  <div className="space-y-3 border-t border-border px-3 pb-4 pt-3 sm:px-4">
                    <NtaMockTokens skin={ntaSkin} className="rounded-lg p-3">
                      <NtaQuestionStem q={q} />
                      {q.answerFormat !== "numerical" ? (
                        <div className="mt-3 space-y-1.5">
                          {q.options.map((opt, optIdx) => {
                            const picked = selected === optIdx;
                            const isKey = optIdx === q.correctAnswer;
                            return (
                              <div
                                key={`${q.id}-${optIdx}`}
                                className={cn(
                                  "flex items-start gap-2 rounded border px-3 py-2 text-sm",
                                  isKey && "border-edu-green bg-edu-green/10",
                                  picked && !isKey && "border-destructive bg-destructive/10"
                                )}
                                style={
                                  !isKey && !picked
                                    ? { borderColor: "var(--nta-border)" }
                                    : undefined
                                }
                              >
                                <span className="font-semibold">{optIdx + 1}.</span>
                                <div className="min-w-0 flex-1">
                                  <NtaOptionBody text={opt} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </NtaMockTokens>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col items-start gap-2">
                        <p className="text-sm font-medium text-edu-green">
                          Solution: {correct ? <ReviewInlineHtml text={correct} /> : "—"}
                        </p>
                        <button
                          type="button"
                          onClick={() => setSolutionOpenId(q.id)}
                          className="rounded-md px-3.5 py-2 text-center text-xs font-bold uppercase leading-tight shadow-sm transition-all duration-150 hover:brightness-105 active:scale-[0.98] sm:px-4 sm:py-2.5 sm:text-[12.5px]"
                          style={{ background: "#0f766e", color: "#fff", border: "1px solid #0d5e58" }}
                        >
                          Solution
                        </button>
                      </div>
                      <p className="min-w-0 text-right text-sm text-muted-foreground">
                        Your answer:{" "}
                        {yours != null && yours !== "" ? (
                          <span className="text-foreground">
                            <ReviewInlineHtml text={yours} />
                          </span>
                        ) : (
                          "—"
                        )}
                      </p>
                    </div>
                    <NtaSolutionModal
                      open={solutionOpenId === q.id}
                      onClose={() => setSolutionOpenId(null)}
                      text={ntaQuestionSolutionText(q)}
                      title="Solution"
                      emptyLabel="No solution"
                      useWorkedSheet
                      panel="solution"
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nothing in this filter.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
