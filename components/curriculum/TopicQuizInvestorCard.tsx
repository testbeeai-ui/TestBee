"use client";

import Link from "next/link";
import { Lock, Play } from "lucide-react";
import MathText from "@/components/MathText";
import type { Subject } from "@/types";
import { cn } from "@/lib/utils";

export type TopicQuizBankSetRow = {
  setIndex: number;
  questionCount: number;
  locked: boolean;
  label: string;
  sublabel?: string;
  /** Show score styling (green check) when a set was submitted. */
  scored?: boolean;
  onPlay: () => void;
};

export type TopicQuizInvestorCardProps = {
  subtopicTitle: string;
  subtopicTooltip?: string;
  /** e.g. `Unit III.2 Magnetic Force` */
  topicTagLine?: string;
  subject?: Subject;
  set1QuestionCount: number;
  /** When set, replaces default "Free · N questions" (e.g. after submit shows score). */
  set1Sublabel?: string;
  /** Kept for callers; not shown on card */
  totalQuestionCount?: number;
  onStartSet1: () => void;
  showQuestionBank: boolean;
  questionBankUpsellOpen: boolean;
  onQuestionBankClick: () => void;
  onDismissUpsell: () => void;
  upgradeHref: string;
  bankSets?: TopicQuizBankSetRow[];
  reviewPreviousLabel?: string;
  onReviewPrevious?: () => void;
};

const SUBJECT_LABEL: Record<Subject, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  math: "Math",
};

function QuizSetRow({
  setName,
  sublabel,
  locked,
  onPlay,
  playLabel,
  accent = "free",
}: {
  setName: string;
  sublabel: string;
  locked?: boolean;
  onPlay: () => void;
  playLabel: string;
  accent?: "free" | "muted";
}) {
  return (
    <div
      className={cn(
        "mb-2 flex items-center justify-between gap-3 rounded-xl border bg-card px-3.5 py-3 shadow-sm transition-colors last:mb-0",
        locked
          ? "border-border/50 bg-muted/15"
          : "border-border/70 hover:border-primary/35 hover:bg-muted/20"
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          {setName}
          {locked ? <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden /> : null}
        </div>
        <div
          className={cn(
            "mt-0.5 flex items-center gap-1 text-[11px] font-medium",
            accent === "free" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
          )}
        >
          {accent === "free" ? <span aria-hidden>✓</span> : null}
          <span className="min-w-0 truncate">{sublabel}</span>
        </div>
      </div>
      <button
        type="button"
        aria-label={playLabel}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/10 transition hover:scale-[1.06] hover:bg-primary/90 hover:ring-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        onClick={onPlay}
      >
        <Play className="ml-0.5 h-3.5 w-3.5 fill-current" aria-hidden />
      </button>
    </div>
  );
}

export default function TopicQuizInvestorCard({
  subtopicTitle,
  subtopicTooltip,
  topicTagLine,
  subject = "physics",
  set1QuestionCount,
  set1Sublabel,
  onStartSet1,
  showQuestionBank,
  questionBankUpsellOpen,
  onQuestionBankClick,
  onDismissUpsell,
  upgradeHref,
  bankSets = [],
  reviewPreviousLabel,
  onReviewPrevious,
}: TopicQuizInvestorCardProps) {
  const subjectLabel = SUBJECT_LABEL[subject] ?? subject;

  return (
    <div className="edu-card min-w-0 overflow-hidden rounded-2xl border border-border p-5">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Sub-topic quiz
      </p>

      <h3
        className="mb-3 text-base font-bold leading-snug text-foreground"
        title={subtopicTooltip ?? subtopicTitle}
      >
        <MathText as="span" weight="bold">
          {subtopicTitle}
        </MathText>
      </h3>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="edu-chip bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {subjectLabel}
        </span>
        {topicTagLine ? (
          <span className="text-xs text-muted-foreground">{topicTagLine}</span>
        ) : null}
      </div>

      <div className="mb-4 border-t border-border" />

      <QuizSetRow
        setName="Set 1"
        sublabel={
          set1Sublabel ??
          `Free · ${set1QuestionCount} question${set1QuestionCount === 1 ? "" : "s"}`
        }
        onPlay={onStartSet1}
        playLabel="Start Set 1 quiz"
        accent="free"
      />

      {bankSets.map((row) => (
        <QuizSetRow
          key={row.setIndex}
          setName={`Set ${row.setIndex}`}
          sublabel={row.sublabel ?? `${row.questionCount} questions · Question bank`}
          locked={row.locked}
          onPlay={row.onPlay}
          playLabel={`Start Set ${row.setIndex} quiz`}
          accent={row.locked ? "muted" : row.scored ? "free" : "muted"}
        />
      ))}

      {showQuestionBank ? (
        <>
          <button
            type="button"
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-border/70 bg-card/30 px-4 py-3 text-[13px] font-semibold text-foreground/75 shadow-sm transition hover:border-primary/35 hover:bg-muted/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            onClick={onQuestionBankClick}
          >
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Open Question Bank
          </button>

          {questionBankUpsellOpen ? (
            <div className="mt-2.5 animate-in fade-in slide-in-from-top-1 rounded-xl border border-border bg-muted/30 p-4 duration-200">
              <p className="mb-2 text-center text-[22px]" aria-hidden>
                🔒
              </p>
              <p className="mb-2.5 text-center text-[12.5px] leading-relaxed text-muted-foreground">
                <strong className="mb-1 block text-foreground">
                  Question Bank is a premium feature
                </strong>
                Upgrade to Starter or Pro to unlock the full question bank, detailed solutions, and
                topic-wise filters.
              </p>
              <Link
                href={upgradeHref}
                className="block rounded-lg bg-primary px-3 py-2.5 text-center text-[13px] font-bold text-primary-foreground transition hover:bg-primary/90"
              >
                Upgrade Now
              </Link>
              <button
                type="button"
                className="mt-2 block w-full text-center text-[11px] text-muted-foreground transition hover:text-foreground"
                onClick={onDismissUpsell}
              >
                Dismiss
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {reviewPreviousLabel && onReviewPrevious ? (
        <button
          type="button"
          className="mt-2 w-full text-center text-xs text-primary transition hover:underline"
          onClick={onReviewPrevious}
        >
          {reviewPreviousLabel}
        </button>
      ) : null}
    </div>
  );
}
