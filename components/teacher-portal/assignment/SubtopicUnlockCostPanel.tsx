"use client";

import {
  formatSubtopicUnlockSummary,
  TEACHER_SUBTOPIC_UNLOCK_HELP,
  TEACHER_SUBTOPIC_UNLOCK_LABEL,
} from "@/lib/teacherPortal/subtopicUnlockRdmCopy";
import { formatCompletionEscrowSummary } from "@/lib/teacherPortal/assignmentCompletionRdmCopy";
import AssignmentInfoHelp from "@/components/teacher-portal/assignment/AssignmentInfoHelp";

type Props = {
  perStudentUnlock: number;
  studentCount: number;
  /** Optional completion reward per student (escrow). */
  rewardRdm?: number;
  compact?: boolean;
};

export function conceptFocusPublishGrandTotal(
  perStudentUnlock: number,
  studentCount: number,
  rewardRdm = 0
): number {
  const unlock = formatSubtopicUnlockSummary(perStudentUnlock, studentCount);
  const escrow = formatCompletionEscrowSummary(rewardRdm, studentCount);
  return unlock.total + escrow.total;
}

export default function SubtopicUnlockCostPanel({
  perStudentUnlock,
  studentCount,
  rewardRdm = 0,
  compact = false,
}: Props) {
  const unlock = formatSubtopicUnlockSummary(perStudentUnlock, studentCount);
  const escrow = formatCompletionEscrowSummary(rewardRdm, studentCount);
  const grandTotal = unlock.total + escrow.total;

  if (studentCount <= 0) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100">
        Pick at least one student to see the subtopic unlock cost.
      </div>
    );
  }

  if (compact) {
    return (
      <p className="text-xs text-slate-400">
        <span className="font-semibold text-sky-200">{unlock.total} RDM</span> unlock at publish
        ({unlock.perStudent}×{unlock.studentCount}).
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
          <span className="text-slate-400">Per student</span>
          <span className="font-semibold text-sky-200">{unlock.perStudent} RDM</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-slate-400">Students</span>
          <span className="font-semibold text-slate-100">{unlock.studentCount}</span>
        </div>
        <div className="flex justify-between gap-3 border-t border-white/10 pt-2">
          <span className="text-slate-400">Subtopic unlock</span>
          <span className="font-bold text-sky-200">{unlock.total} RDM</span>
        </div>
        {escrow.total > 0 ? (
          <div className="flex justify-between gap-3 border-t border-white/10 pt-2">
            <span className="text-slate-400">Completion rewards (reserved)</span>
            <span className="font-bold text-emerald-300">+{escrow.total} RDM</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 border-t border-amber-500/30 pt-2">
          <span className="font-semibold text-amber-100">Total at publish</span>
          <span className="text-lg font-bold text-amber-200">{grandTotal} RDM</span>
        </div>
      </div>
    </div>
  );
}
