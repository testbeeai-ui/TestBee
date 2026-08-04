"use client";

import Link from "next/link";
import { Lock, Play } from "lucide-react";
import MathText from "@/components/MathText";
import RdmRewardInfoTip from "@/components/rdm/RdmRewardInfoTip";
import { quizRdmTipLines } from "@/lib/rdm/subtopicUnitRdmCopy";
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

export type TopicQuizRdmInfo = {
  /** Badge amount shown next to the coin (typically per-set). */
  badgeAmount: number;
  perSetAmount: number;
  overallAmount: number;
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
  /** When teacher assigned a premium set, hide free Set 1 and show banner instead. */
  hideSet1?: boolean;
  assignmentUnlock?: { setIndex?: number; message: string; fullSubtopic?: boolean };
  /** Optional reward hint note displayed inside the card footer */
  rdmHint?: string;
  /** Structured RDM amounts for coin badge + info popover (preferred over parsing rdmHint). */
  rdmInfo?: TopicQuizRdmInfo;
  /** Optional best score % for Set / pack (Dive hub). */
  bestScorePct?: number | null;
};

const SUBJECT_LABEL: Record<Subject, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  math: "Math",
};

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
  hideSet1 = false,
  assignmentUnlock,
  rdmHint,
  rdmInfo,
  bestScorePct = null,
}: TopicQuizInvestorCardProps) {
  const subjectLabel = SUBJECT_LABEL[subject] ?? subject;
  const set1Meta =
    set1Sublabel ??
    `Free · ${set1QuestionCount} question${set1QuestionCount === 1 ? "" : "s"}`;
  const resolvedRdmInfo: TopicQuizRdmInfo | null =
    rdmInfo ??
    (rdmHint
      ? {
          badgeAmount: Number(rdmHint.match(/\d+/)?.[0] ?? 15) || 15,
          perSetAmount: 5,
          overallAmount: Number(rdmHint.match(/\d+/)?.[0] ?? 15) || 15,
        }
      : null);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      {/* Pack summary */}
      <div
        className="relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border px-4 py-3.5 sm:px-5"
        style={{
          background: "linear-gradient(135deg, #0c1f1a 0%, #0d1520 55%, #0b1220 100%)",
          borderColor: "rgba(34,197,94,0.22)",
          boxShadow: "0 4px 20px rgba(16,185,129,0.06)",
        }}
      >
        <div className="relative flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
            style={{
              background: "linear-gradient(135deg, #059669, #10b981)",
              boxShadow: "0 4px 14px rgba(16,185,129,0.35)",
            }}
            aria-hidden
          >
            <i className="ti ti-list-check text-[17px]" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold leading-none text-emerald-50/95">
              Quiz Pack
            </div>
            <div className="mt-1.5 truncate text-[12px] font-medium leading-none text-emerald-200/65">
              {subjectLabel}
              {topicTagLine ? ` · ${topicTagLine}` : ""}
              {` · ${set1QuestionCount} questions`}
            </div>
          </div>
        </div>

        {typeof bestScorePct === "number" ? (
          <div className="relative flex shrink-0 flex-col items-end justify-center gap-1">
            <div className="text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-emerald-200/55">
              Best
            </div>
            <div className="text-[20px] font-semibold leading-none tracking-tight text-emerald-400">
              {bestScorePct}
              <span className="text-[11px] font-medium">%</span>
            </div>
          </div>
        ) : resolvedRdmInfo ? (
          <div className="relative inline-flex shrink-0 items-center gap-1.5">
            <div
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold text-amber-300"
              style={{ background: "#2a1f00", borderColor: "#78450a" }}
            >
              <i className="ti ti-coin text-[13px]" aria-hidden />
              <span>+{resolvedRdmInfo.overallAmount} RDM</span>
            </div>
            <RdmRewardInfoTip
              title="Quiz RDM"
              ariaLabel="RDM reward details"
              lines={quizRdmTipLines(
                resolvedRdmInfo.perSetAmount,
                resolvedRdmInfo.overallAmount
              )}
            />
          </div>
        ) : null}
      </div>

      {/* Title block */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
          Sub-topic quiz
        </p>
        <h3
          className="text-[1.05rem] font-medium leading-[1.4] tracking-[-0.01em] text-slate-100 sm:text-[1.15rem] sm:leading-[1.4] [&_.katex]:text-[1em]"
          title={subtopicTooltip ?? subtopicTitle}
        >
          <MathText>{subtopicTitle}</MathText>
        </h3>
      </div>

      {assignmentUnlock ? (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs leading-relaxed text-emerald-100">
          <p className="font-semibold text-emerald-200">
            {assignmentUnlock.fullSubtopic
              ? "Full subtopic unlocked for this assignment"
              : `Set ${assignmentUnlock.setIndex} unlocked for this assignment`}
          </p>
          <p className="mt-1 text-emerald-100/80">{assignmentUnlock.message}</p>
        </div>
      ) : null}

      {/* Primary CTA — meta sits beside the button, not pushed to the far edge */}
      {!hideSet1 ? (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3.5">
          <button
            type="button"
            onClick={onStartSet1}
            aria-label="Start Set 1 quiz"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-[13px] font-semibold text-white transition hover:brightness-110 active:scale-[0.99] sm:min-w-[168px]"
            style={{
              background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
              boxShadow: "0 8px 22px -8px rgba(16,185,129,0.5)",
            }}
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
            Start Set 1
          </button>
          <p className="text-[13px] font-medium leading-none text-slate-400">{set1Meta}</p>
        </div>
      ) : null}

      {bankSets.length > 0 ? (
        <div className="space-y-2.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
            Question bank
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {bankSets.map((row) => (
              <li key={row.setIndex}>
                <button
                  type="button"
                  disabled={row.locked}
                  onClick={row.onPlay}
                  aria-label={`Start Set ${row.setIndex} quiz`}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition",
                    row.locked
                      ? "cursor-not-allowed border-white/5 bg-white/[0.02] opacity-60"
                      : "border-white/10 bg-white/[0.03] hover:border-emerald-500/30 hover:bg-emerald-500/[0.06]"
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-xs font-semibold text-slate-300">
                    {row.locked ? <Lock className="h-3.5 w-3.5" /> : row.setIndex}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-white">
                      {row.label || `Set ${row.setIndex}`}
                    </span>
                    <span className="block text-[11px] font-medium text-slate-400">
                      {row.sublabel ?? `${row.questionCount} questions`}
                    </span>
                  </span>
                  {!row.locked ? (
                    <Play className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showQuestionBank ? (
        <div className="space-y-2.5 border-t border-white/[0.06] pt-4">
          <button
            type="button"
            onClick={onQuestionBankClick}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-transparent px-4 text-[13px] font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
          >
            <Lock className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            Open full question bank
          </button>

          {questionBankUpsellOpen ? (
            <div className="rounded-xl border border-white/10 bg-[#0d1420] p-4">
              <p className="text-[13px] font-semibold text-white">Question Bank is premium</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">
                Upgrade to Starter or Pro for Sets 2–6, solutions, and filters.
              </p>
              <div className="mt-3.5 flex items-center gap-3">
                <Link
                  href={upgradeHref}
                  className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-3 py-2.5 text-center text-xs font-semibold text-white transition hover:bg-emerald-500"
                >
                  Upgrade now
                </Link>
                <button
                  type="button"
                  className="text-[12px] font-medium text-slate-400 hover:text-white"
                  onClick={onDismissUpsell}
                >
                  Not now
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {reviewPreviousLabel && onReviewPrevious ? (
        <button
          type="button"
          className="text-center text-xs font-medium text-emerald-400 hover:text-emerald-300"
          onClick={onReviewPrevious}
        >
          {reviewPreviousLabel}
        </button>
      ) : null}

      {rdmHint && typeof bestScorePct !== "number" ? (
        <p className="text-center text-[12px] font-normal leading-relaxed text-slate-500">
          {rdmHint}
        </p>
      ) : null}
    </div>
  );
}
