"use client";

import {
  formatCompletionEscrowSummary,
  TEACHER_ASSIGNMENT_INCENTIVE_HELP,
  TEACHER_ASSIGNMENT_INCENTIVE_LABEL,
} from "@/lib/teacherPortal/assignmentCompletionRdmCopy";
import AssignmentInfoHelp from "@/components/teacher-portal/assignment/AssignmentInfoHelp";

type Props = {
  rewardRdm: number;
  studentCount: number;
  /** Flat publish fee (mock, quiz, Gyan++, etc.) — not used with subtopic unlock. */
  publishFeeRdm?: number;
  compact?: boolean;
};

export function assignmentCompletionPublishGrandTotal(
  publishFeeRdm: number,
  studentCount: number,
  rewardRdm: number
): number {
  const escrow = formatCompletionEscrowSummary(rewardRdm, studentCount);
  const fee = Math.max(0, Math.round(publishFeeRdm));
  return fee + escrow.total;
}

export default function AssignmentCompletionRewardPanel({
  rewardRdm,
  studentCount,
  publishFeeRdm = 0,
  compact = false,
}: Props) {
  const escrow = formatCompletionEscrowSummary(rewardRdm, studentCount);
  const fee = Math.max(0, Math.round(publishFeeRdm));
  const grandTotal = fee + escrow.total;

  if (studentCount <= 0) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100">
        Pick at least one student to see completion reward and publish cost.
      </div>
    );
  }

  if (compact) {
    if (grandTotal <= 0) {
      return <p className="text-xs text-slate-400">No RDM reserved at publish.</p>;
    }
    return (
      <p className="text-xs text-slate-400">
        <span className="font-semibold text-amber-200">{grandTotal} RDM</span> at publish
        {escrow.total > 0 ? ` (${escrow.perStudent}×${escrow.studentCount} rewards)` : null}
        {fee > 0 ? ` + ${fee} publish fee` : null}.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
      <div className="flex items-center gap-2">
        <div className="text-sm font-bold text-emerald-100">{TEACHER_ASSIGNMENT_INCENTIVE_LABEL}</div>
        <AssignmentInfoHelp title={TEACHER_ASSIGNMENT_INCENTIVE_LABEL} tone="emerald">
          {TEACHER_ASSIGNMENT_INCENTIVE_HELP}
        </AssignmentInfoHelp>
      </div>

      <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-slate-400">Per student</span>
          <span className="font-semibold text-emerald-300">
            {escrow.perStudent > 0 ? `+${escrow.perStudent} RDM` : "No reward"}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-slate-400">Students</span>
          <span className="font-semibold text-slate-100">{escrow.studentCount}</span>
        </div>
        {escrow.total > 0 ? (
          <div className="flex justify-between gap-3 border-t border-white/10 pt-2">
            <span className="text-slate-400">Completion rewards (reserved)</span>
            <span className="font-bold text-emerald-300">{escrow.total} RDM</span>
          </div>
        ) : (
          <div className="border-t border-white/10 pt-2 text-xs text-slate-500">
            No completion reward selected — students will not receive RDM from you for finishing.
          </div>
        )}
        {fee > 0 ? (
          <div className="flex justify-between gap-3 border-t border-white/10 pt-2">
            <span className="text-slate-400">Publish fee</span>
            <span className="font-semibold text-slate-200">{fee} RDM</span>
          </div>
        ) : null}
        {grandTotal > 0 ? (
          <div className="flex justify-between gap-3 border-t border-amber-500/30 pt-2">
            <span className="font-semibold text-amber-100">Total at publish</span>
            <span className="text-lg font-bold text-amber-200">{grandTotal} RDM</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
