"use client";

import {
  formatMcqSponsorshipSummary,
  TEACHER_SUBTOPIC_UNLOCK_HELP,
  TEACHER_SUBTOPIC_UNLOCK_LABEL,
} from "@/lib/teacherPortal/subtopicUnlockRdmCopy";
import { formatCompletionEscrowSummary } from "@/lib/teacherPortal/assignmentCompletionRdmCopy";
import AssignmentInfoHelp from "@/components/teacher-portal/assignment/AssignmentInfoHelp";

type Props = {
  perStudentUnlock: number;
  billableStudentCount: number;
  premiumStudentCount?: number;
  totalStudentCount?: number;
  /** Optional completion reward per student (escrow). */
  rewardRdm?: number;
  compact?: boolean;
};

export function conceptFocusPublishGrandTotal(
  perStudentUnlock: number,
  billableStudentCount: number,
  rewardRdm = 0,
  premiumStudentCount = 0,
  totalStudentCount?: number
): number {
  const unlock = formatMcqSponsorshipSummary(perStudentUnlock, billableStudentCount, {
    premiumStudentCount,
    totalStudentCount,
  });
  const escrow = formatCompletionEscrowSummary(rewardRdm, unlock.totalStudentCount);
  return unlock.total + escrow.total;
}

export default function SubtopicUnlockCostPanel({
  perStudentUnlock,
  billableStudentCount,
  premiumStudentCount = 0,
  totalStudentCount,
  rewardRdm = 0,
  compact = false,
}: Props) {
  const unlock = formatMcqSponsorshipSummary(perStudentUnlock, billableStudentCount, {
    premiumStudentCount,
    totalStudentCount,
  });
  const escrow = formatCompletionEscrowSummary(rewardRdm, unlock.totalStudentCount);
  const grandTotal = unlock.total + escrow.total;

  if (unlock.totalStudentCount <= 0) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100">
        Select students to see unlock cost.
      </div>
    );
  }

  if (compact) {
    return (
      <p className="text-xs text-slate-400">
        <span className="font-semibold text-sky-200">{unlock.total} RDM</span> at publish
        ({unlock.perStudent} × {unlock.billableStudentCount} free
        {unlock.premiumStudentCount > 0 ? ` · ${unlock.premiumStudentCount} Starter/Pro` : ""}
        ).
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-sky-500/25 bg-sky-500/5 p-4">
      <div className="flex items-center gap-2">
        <div className="text-sm font-bold text-sky-100">{TEACHER_SUBTOPIC_UNLOCK_LABEL}</div>
        <AssignmentInfoHelp title={TEACHER_SUBTOPIC_UNLOCK_LABEL} tone="sky">
          {TEACHER_SUBTOPIC_UNLOCK_HELP}
        </AssignmentInfoHelp>
      </div>

      <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-slate-400">Rate (free student)</span>
          <span className="font-semibold text-sky-200">{unlock.perStudent} RDM</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-slate-400">Free students</span>
          <span className="font-semibold text-slate-100">{unlock.billableStudentCount}</span>
        </div>
        {unlock.premiumStudentCount > 0 ? (
          <div className="flex justify-between gap-3">
            <span className="text-slate-400">Starter / Pro</span>
            <span className="font-semibold text-emerald-300">{unlock.premiumStudentCount}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 border-t border-white/10 pt-2">
          <span className="text-slate-400">Unlock total</span>
          <span className="font-bold text-sky-200">−{unlock.total} RDM</span>
        </div>
        {escrow.total > 0 ? (
          <div className="flex justify-between gap-3 border-t border-white/10 pt-2">
            <span className="text-slate-400">Completion rewards (reserved)</span>
            <span className="font-bold text-amber-300">−{escrow.total} RDM</span>
          </div>
        ) : null}
        {grandTotal > 0 ? (
          <div className="flex justify-between gap-3 border-t border-white/10 pt-2">
            <span className="font-semibold text-slate-200">Total at publish</span>
            <span className="font-bold text-amber-200">−{grandTotal} RDM</span>
          </div>
        ) : unlock.premiumStudentCount > 0 && unlock.billableStudentCount === 0 ? (
          <p className="border-t border-white/10 pt-2 text-xs text-emerald-200/90">
            Everyone has Starter or Pro — no unlock fee.
          </p>
        ) : null}
      </div>
    </div>
  );
}
