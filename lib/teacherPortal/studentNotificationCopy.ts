import type { MotivationNudgeGoal } from "@/lib/teacherPortal/queries/mutations";

/** Stored on motivation posts — drives student bell layout and copy. */
export type StudentMessageKind =
  | "assignment_reminder"
  | "teacher_nudge"
  | "counsel"
  | "recognition"
  | "urgent_checkin";

const NAME_TOKEN = "[name]";

export type StudentNotificationPresentation = {
  kind: StudentMessageKind;
  categoryLabel: string;
  accentClass: string;
  chipClass: string;
  icon: string;
  ctaLabel: string;
};

export function isStudentMessageKind(raw: unknown): raw is StudentMessageKind {
  return (
    raw === "assignment_reminder" ||
    raw === "teacher_nudge" ||
    raw === "counsel" ||
    raw === "recognition" ||
    raw === "urgent_checkin"
  );
}

/** Infer kind for legacy rows that predate `studentMessageKind`. */
export function resolveStudentMessageKind(input: {
  studentMessageKind?: unknown;
  actionKind?: string | null;
  relatedPostId?: string | null;
  nudgeGoal?: MotivationNudgeGoal | string | null;
  rdmDelta?: number;
  recommendActionId?: string | null;
}): StudentMessageKind {
  if (isStudentMessageKind(input.studentMessageKind)) {
    return input.studentMessageKind;
  }

  const action = input.actionKind?.trim() ?? "";
  const goal = typeof input.nudgeGoal === "string" ? input.nudgeGoal.trim() : "";
  const hasAssignment = Boolean(input.relatedPostId?.trim());

  if (hasAssignment && (goal === "complete_pending_assignment" || goal === "attempt_mock")) {
    return "assignment_reminder";
  }
  if (action === "reward_top_students" || (action === "boost" && !hasAssignment && goal !== "restart_streak")) {
    return "recognition";
  }
  if (action === "urgent_nudge" && !hasAssignment) {
    return "urgent_checkin";
  }
  if (
    !hasAssignment &&
    (input.rdmDelta ?? 0) === 0 &&
    input.recommendActionId &&
    input.recommendActionId !== "none" &&
    !goal
  ) {
    return "counsel";
  }
  if (!hasAssignment && !goal && action === "nudge" && (input.rdmDelta ?? 0) === 0) {
    return "counsel";
  }
  return "teacher_nudge";
}

export function getStudentNotificationPresentation(
  kind: StudentMessageKind,
  nudgeGoal?: MotivationNudgeGoal | string | null
): StudentNotificationPresentation {
  switch (kind) {
    case "assignment_reminder":
      return {
        kind,
        categoryLabel: "Assignment",
        accentClass: "text-sky-700 dark:text-sky-200",
        chipClass:
          "border-sky-500/25 bg-sky-500/10 text-sky-800 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-100",
        icon: "📋",
        ctaLabel: "Open assignment",
      };
    case "counsel":
      return {
        kind,
        categoryLabel: "Personal note",
        accentClass: "text-violet-700 dark:text-violet-200",
        chipClass:
          "border-violet-500/25 bg-violet-500/10 text-violet-800 dark:border-violet-400/30 dark:bg-violet-500/15 dark:text-violet-100",
        icon: "💬",
        ctaLabel: "Read note",
      };
    case "recognition":
      return {
        kind,
        categoryLabel: "Recognition",
        accentClass: "text-emerald-700 dark:text-emerald-200",
        chipClass:
          "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-100",
        icon: "🏆",
        ctaLabel: "View message",
      };
    case "urgent_checkin":
      return {
        kind,
        categoryLabel: "Check-in",
        accentClass: "text-rose-700 dark:text-rose-200",
        chipClass:
          "border-rose-500/25 bg-rose-500/10 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-100",
        icon: "⏰",
        ctaLabel: "Respond now",
      };
    case "teacher_nudge":
    default: {
      const goal = typeof nudgeGoal === "string" ? nudgeGoal.trim() : "";
      const categoryLabel =
        goal === "restart_streak"
          ? "Streak"
          : goal === "answer_doubts"
            ? "Doubts"
            : goal === "watch_recorded_class"
              ? "Recording"
              : goal === "revise_chapter"
                ? "Concept focus"
                : "From your teacher";
      return {
        kind: "teacher_nudge",
        categoryLabel,
        accentClass: "text-amber-800 dark:text-amber-200",
        chipClass:
          "border-amber-500/25 bg-amber-500/10 text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-100",
        icon: goal === "restart_streak" ? "🔥" : "✨",
        ctaLabel: "See what's next",
      };
    }
  }
}

function truncateTitle(title: string, max = 52): string {
  const t = title.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function buildStudentNotificationTitle(input: {
  kind: StudentMessageKind;
  nudgeGoal?: MotivationNudgeGoal | string | null;
  relatedPostTitle?: string | null;
  actionKind?: string | null;
}): string {
  const assignmentTitle = input.relatedPostTitle?.trim() ?? "";
  const goal = typeof input.nudgeGoal === "string" ? input.nudgeGoal.trim() : "";

  switch (input.kind) {
    case "assignment_reminder":
      return assignmentTitle
        ? truncateTitle(assignmentTitle)
        : "Assignment waiting for you";
    case "counsel":
      return "A note from your teacher";
    case "recognition":
      return "You're standing out this week";
    case "urgent_checkin":
      return "Let's get back on track";
    case "teacher_nudge":
      switch (goal) {
        case "restart_streak":
          return "Your streak is waiting for you";
        case "complete_pending_assignment":
          return assignmentTitle
            ? `Finish · ${truncateTitle(assignmentTitle, 44)}`
            : "One assignment still open";
        case "attempt_mock":
          return assignmentTitle
            ? `Practice ready · ${truncateTitle(assignmentTitle, 40)}`
            : "Practice test ready for you";
        case "answer_doubts":
          return "Share your doubt — we'll help";
        case "revise_chapter":
          return assignmentTitle
            ? `Concept focus · ${truncateTitle(assignmentTitle, 40)}`
            : "Time to lock in this topic";
        case "watch_recorded_class":
          return "Recording shared for you";
        default:
          return "Message from your teacher";
      }
    default:
      return "Message from your teacher";
  }
}

export function buildAssignmentReminderMessage(input: {
  assignmentTitle: string;
  dueLabel: string;
  totalRdm: number;
  extraRdm: number;
}): string {
  const title = input.assignmentTitle.trim() || "your assignment";
  const due = input.dueLabel.trim() || "soon";
  const extraLine =
    input.extraRdm > 0
      ? ` That includes +${input.extraRdm} bonus RDM for submitting on time.`
      : "";
  return `Hi ${NAME_TOKEN},

Just a quick heads-up — **${title}** is due ${due}. Most students finish in about 20 minutes.

Submit to earn **+${input.totalRdm} RDM**.${extraLine}

You’ve got this — open the assignment when you’re ready.`;
}

export function buildNudgeMessage(input: {
  nudgeGoal: MotivationNudgeGoal;
  rdmDelta: number;
  pendingAssignmentTitle?: string;
  mockTitle?: string;
  conceptFocusSummary?: string;
  hasRecordingLink?: boolean;
}): string {
  const rdmLine =
    input.rdmDelta > 0
      ? ` Complete the step today and earn **+${input.rdmDelta} RDM**.`
      : "";

  switch (input.nudgeGoal) {
    case "restart_streak":
      return `Hi ${NAME_TOKEN},

I noticed you’ve been away for a couple of days — it happens. A short 20-minute session today is enough to restart your streak and keep your momentum.${rdmLine}

Pick up where you left off when you can.`;
    case "complete_pending_assignment": {
      const t = input.pendingAssignmentTitle?.trim();
      return t
        ? `Hi ${NAME_TOKEN},

**${t}** is still open on your list. Finishing it today keeps you on pace with the class.${rdmLine}

Open the assignment and work through it at your own pace.`
        : `Hi ${NAME_TOKEN},

You still have a pending assignment on your dashboard. Clearing it today keeps you aligned with the class.${rdmLine}`;
    }
    case "attempt_mock": {
      const t = input.mockTitle?.trim();
      return t
        ? `Hi ${NAME_TOKEN},

I’d like you to attempt **${t}** today. A focused mock run will show exactly where to revise next.${rdmLine}`
        : `Hi ${NAME_TOKEN},

Try a short mock or chapter quiz today — 20 minutes of targeted practice makes a big difference.${rdmLine}`;
    }
    case "answer_doubts":
      return `Hi ${NAME_TOKEN},

If something from class is still unclear, post it on **Gyan++** today. We’ll work through it together.${rdmLine}`;
    case "revise_chapter": {
      const topic = input.conceptFocusSummary?.trim();
      return topic
        ? `Hi ${NAME_TOKEN},

Let’s sharpen **${topic}** today — review the lesson, run through the checklist, and lock in the concepts.${rdmLine}`
        : `Hi ${NAME_TOKEN},

Spend time on today’s concept focus — review the material and complete the lesson checklist.${rdmLine}`;
    }
    case "watch_recorded_class":
      return `Hi ${NAME_TOKEN},

Catch up using the **recorded lesson** I shared. Watch at your pace, then attempt the linked practice.${rdmLine}`;
    default:
      return `Hi ${NAME_TOKEN},

Keep your learning rhythm going — take the next small step on your dashboard today.${rdmLine}`;
  }
}

export type CounselApproach = "remotivate" | "weak_areas" | "celebrate" | "custom";

export function buildCounselMessage(input: {
  approach: CounselApproach;
  avgScoreLabel: string;
  streakLabel: string;
  rankLabel: string;
}): string {
  switch (input.approach) {
    case "celebrate":
      return `Hi ${NAME_TOKEN},

I’ve been reviewing your work — your consistency is paying off. Your ${input.streakLabel} and recent scores show real discipline.

Keep doing exactly what you’re doing. Proud of the progress.`;
    case "weak_areas":
      return `Hi ${NAME_TOKEN},

I looked closely at your recent results (around **${input.avgScoreLabel}** average). A few topics are holding the score back — that’s normal and fixable.

Pick **one weak area**, revise for 30 minutes, then attempt a short practice set. Small, focused steps move your ${input.rankLabel} up fast.`;
    case "custom":
      return "";
    case "remotivate":
    default:
      return `Hi ${NAME_TOKEN},

I’ve reviewed your progress this week. You’re averaging around **${input.avgScoreLabel}**, and there’s clear room to push higher.

Let’s restart momentum today: **30 minutes of revision + one short practice test**. You have the ability — it’s about showing up again.`;
  }
}

export function buildStudentNotificationPreview(input: {
  kind: StudentMessageKind;
  body: string;
  studentFirstName: string;
  rdmDelta?: number;
  dueHint?: string | null;
}): string {
  const personalize = (text: string) =>
    text.replace(/\[name\]/g, input.studentFirstName.trim() || "there");

  if (input.kind === "assignment_reminder") {
    const rdm =
      typeof input.rdmDelta === "number" && input.rdmDelta > 0
        ? ` · Earn +${input.rdmDelta} RDM`
        : "";
    const due = input.dueHint?.trim() ? `Due ${input.dueHint.trim()}${rdm}` : `Action needed${rdm}`;
    return due;
  }

  const plain = personalize(input.body)
    .replace(/\*\*/g, "")
    .replace(/\n+/g, " ")
    .trim();
  const sentence = plain.split(/(?<=[.!?])\s+/)[0] ?? plain;
  if (input.kind === "counsel") {
    return sentence.length > 96 ? `${sentence.slice(0, 95)}…` : sentence;
  }
  if (input.kind === "recognition") {
    return sentence.length > 88 ? `${sentence.slice(0, 87)}…` : sentence;
  }
  if (input.kind === "urgent_checkin") {
    return "Your teacher checked in — a quick session today helps.";
  }
  return sentence.length > 90 ? `${sentence.slice(0, 89)}…` : sentence;
}

export function counselApproachToMessageKind(
  approach: CounselApproach,
  actionKind: "boost" | "nudge" | "urgent_nudge"
): StudentMessageKind {
  if (approach === "celebrate" || actionKind === "boost") return "recognition";
  if (actionKind === "urgent_nudge") return "urgent_checkin";
  return "counsel";
}

export function counselApproachToNotificationTitle(approach: CounselApproach): string {
  if (approach === "celebrate") return "You're standing out this week";
  if (approach === "weak_areas") return "Let's strengthen your weak areas";
  return "A note from your teacher";
}
