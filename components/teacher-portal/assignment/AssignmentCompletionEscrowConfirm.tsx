"use client";

import {
  formatCompletionEscrowSummary,
  TEACHER_ASSIGNMENT_INCENTIVE_HELP,
} from "@/lib/teacherPortal/assignmentCompletionRdmCopy";
import {
  formatSubtopicUnlockSummary,
  TEACHER_SUBTOPIC_UNLOCK_HELP,
} from "@/lib/teacherPortal/subtopicUnlockRdmCopy";

type Props = {
  open: boolean;
  rewardRdm: number;
  studentCount: number;
  dueDateLabel: string | null;
  publishFeeRdm: number;
  /** Concept Focus: per-student subtopic unlock (replaces flat publish fee). */
  subtopicUnlockPerStudent?: number;
  showSubtopicUnlock?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
};

export default function AssignmentCompletionEscrowConfirm({
  open,
  rewardRdm,
  studentCount,
  dueDateLabel,
  publishFeeRdm,
  subtopicUnlockPerStudent = 0,
  showSubtopicUnlock = false,
  onConfirm,
  onCancel,
  busy = false,
}: Props) {
  if (!open) return null;

  const escrow = formatCompletionEscrowSummary(rewardRdm, studentCount);
  const unlock = formatSubtopicUnlockSummary(subtopicUnlockPerStudent, studentCount);
  const grandTotal = unlock.total + escrow.total + (showSubtopicUnlock ? 0 : publishFeeRdm);

  const title = showSubtopicUnlock
    ? grandTotal > 0
      ? `Create assignment for ${grandTotal} RDM?`
      : "Create this assignment?"
    : escrow.total > 0
      ? "Reserve completion rewards?"
      : publishFeeRdm > 0
        ? `Create assignment for ${publishFeeRdm} RDM?`
        : "Create this assignment?";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0c0e14] p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-escrow-title"
      >
        <h2 id="assignment-escrow-title" className="text-lg font-bold text-slate-100">
          {title}
        </h2>
        {showSubtopicUnlock ? (
          <p className="mt-2 text-sm text-slate-400">{TEACHER_SUBTOPIC_UNLOCK_HELP}</p>
        ) : (
          <p className="mt-2 text-sm text-slate-400">{TEACHER_ASSIGNMENT_INCENTIVE_HELP}</p>
        )}

        {showSubtopicUnlock && unlock.total > 0 ? (
          <div className="mt-4 space-y-2 rounded-xl border border-sky-500/25 bg-sky-500/5 p-3 text-sm text-slate-200">
            <div className="text-xs font-bold uppercase tracking-wide text-sky-300/90">
              Subtopic unlock
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">Per student</span>
              <span className="font-semibold text-sky-200">{unlock.perStudent} RDM</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">Students</span>
              <span className="font-semibold">{unlock.studentCount}</span>
            </div>
            <div className="flex justify-between gap-3 border-t border-white/10 pt-2">
              <span className="text-slate-400">Unlock total</span>
              <span className="font-bold text-sky-200">{unlock.total} RDM</span>
            </div>
          </div>
        ) : null}

        {escrow.total > 0 ? (
          <div className="mt-3 space-y-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm text-slate-200">
            <div className="text-xs font-bold uppercase tracking-wide text-emerald-300/90">
              Student completion rewards
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">Per student</span>
              <span className="font-semibold text-emerald-300">+{escrow.perStudent} RDM</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">Students</span>
              <span className="font-semibold">{escrow.studentCount}</span>
            </div>
            <div className="flex justify-between gap-3 border-t border-white/10 pt-2">
              <span className="text-slate-400">Reserved from your wallet</span>
              <span className="font-bold text-amber-300">{escrow.total} RDM</span>
            </div>
          </div>
        ) : null}

        {!showSubtopicUnlock && publishFeeRdm > 0 ? (
          <div className="mt-3 flex justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">
            <span>Publish fee (separate)</span>
            <span>{publishFeeRdm} RDM</span>
          </div>
        ) : null}

        {grandTotal > 0 ? (
          <div className="mt-3 flex justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
            <span className="font-semibold text-amber-100">Total deducted now</span>
            <span className="font-bold text-amber-200">{grandTotal} RDM</span>
          </div>
        ) : null}

        {escrow.total > 0 ? (
          dueDateLabel ? (
            <p className="mt-3 text-xs text-slate-500">
              Students must finish before <span className="text-slate-300">{dueDateLabel}</span> to
              receive rewards. Unused reward slots return to you after the deadline. You do not earn
              RDM when students complete — only students do.
            </p>
          ) : (
            <p className="mt-3 text-xs text-slate-500">
              Unused completion rewards return to you if students do not finish. You do not earn RDM
              when students complete.
            </p>
          )
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy
              ? "Creating…"
              : showSubtopicUnlock
                ? grandTotal > 0
                  ? `Yes, create (${grandTotal} RDM)`
                  : "Yes, create assignment"
                : grandTotal > 0
                  ? `Yes, confirm (${grandTotal} RDM)`
                  : "Yes, confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
