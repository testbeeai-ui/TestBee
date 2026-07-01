/**
 * Shared UI copy for teacher-funded assignment completion rewards (escrow at publish).
 */

export const TEACHER_ASSIGNMENT_INCENTIVE_LABEL = "Completion reward (per student)";

export const TEACHER_ASSIGNMENT_INCENTIVE_HELP =
  "Optional RDM each student earns when they fully complete this assignment before the due date. You reserve (amount × students) from your wallet at publish; unused slots return after the deadline.";

export const TEACHER_ASSIGNMENT_INCENTIVE_DETAIL_PREFIX = "Reward";

export const TEACHER_ASSIGNMENT_NO_RDM_LABEL = "No RDM";

/** Shown beside the per-student reward in assignment detail rows. */
export const TEACHER_ASSIGNMENT_PLATFORM_RDM_NOTE =
  "Reserved from your wallet · unused slots refund after the due date";

export function teacherAssignmentPublishIncentiveLine(rewardRdm: number): string {
  const amount = Number.isFinite(rewardRdm) ? Math.max(0, Math.round(rewardRdm)) : 0;
  if (amount <= 0) return "No completion reward";
  return `+${amount} RDM per student on completion (before due date)`;
}

export function formatCompletionEscrowSummary(
  rewardRdm: number,
  studentCount: number
): { perStudent: number; total: number; studentCount: number } {
  const perStudent = Number.isFinite(rewardRdm) ? Math.max(0, Math.round(rewardRdm)) : 0;
  const n = Math.max(0, Math.floor(studentCount));
  return {
    perStudent,
    studentCount: n,
    total: perStudent > 0 ? perStudent * n : 0,
  };
}

export function studentCompletionRewardLine(
  rewardRdm: number,
  dueDateLabel: string | null
): string | null {
  const amount = Number.isFinite(rewardRdm) ? Math.max(0, Math.round(rewardRdm)) : 0;
  if (amount <= 0) return null;
  if (dueDateLabel) {
    return `+${amount} RDM from your teacher when you finish before ${dueDateLabel}`;
  }
  return `+${amount} RDM from your teacher when you complete this assignment`;
}

/** One short fragment for assignment modals (due date shown separately). */
export function studentCompletionRewardBadge(rewardRdm: number): string | null {
  const amount = Number.isFinite(rewardRdm) ? Math.max(0, Math.round(rewardRdm)) : 0;
  if (amount <= 0) return null;
  return `+${amount} RDM`;
}

/** Checklist status line after the server syncs completion-reward grants. */
export function studentCompletionRewardStatusLine(
  status: import("@/lib/teacherPortal/assignmentCompletionRdm").StudentCompletionRewardStatus
): string | null {
  if (status.advertisedRdm <= 0 || status.grantStatus === "none") return null;
  const amount = status.amount ?? status.advertisedRdm;
  switch (status.grantStatus) {
    case "paid":
      return `+${amount} RDM added to your wallet — nice work!`;
    case "pending":
      return `+${amount} RDM reserved for you — finish every task before the due date to receive it.`;
    case "past_due":
      return `The due date has passed; this completion reward is no longer available.`;
    case "refunded":
    case "cancelled":
      return `This completion reward was returned to your teacher.`;
    case "no_escrow":
      return `Your teacher labeled +${status.advertisedRdm} RDM on this post, but no reward was reserved at publish time — ask them to republish with completion rewards enabled.`;
    default: {
      const _exhaustive: never = status.grantStatus;
      return _exhaustive;
    }
  }
}
