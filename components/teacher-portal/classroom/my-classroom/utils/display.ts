import type { TeacherPortalClassroomStudent } from "@/lib/teacherPortal/types";
import type { MotivationMessageType } from "../types";

export function initials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "ST"
  );
}

export function formatOptionalPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value)}%`;
}

export function statusPill(status: "active" | "off_streak" | "at_risk"): string {
  if (status === "active") return "text-emerald-300";
  if (status === "off_streak") return "text-rose-300";
  return "text-amber-300";
}

export function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.max(1, Math.round(ms / (1000 * 60 * 60)));
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function recommendedAction(
  student: TeacherPortalClassroomStudent
): "boost" | "nudge" | "urgent_nudge" {
  if (student.status === "at_risk") return "urgent_nudge";
  if (student.status === "off_streak" || student.streakDays <= 2) return "nudge";
  return "boost";
}

export function actionLabel(action: "boost" | "nudge" | "urgent_nudge"): string {
  if (action === "urgent_nudge") return "Urgent nudge";
  if (action === "nudge") return "Nudge";
  return "Boost";
}

export function actionClass(action: "boost" | "nudge" | "urgent_nudge"): string {
  if (action === "urgent_nudge") return "border-rose-400/30 bg-rose-500/10 text-rose-200";
  if (action === "nudge") return "border-amber-400/30 bg-amber-500/10 text-amber-200";
  return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
}

export function messageTemplate(
  action: "boost" | "nudge" | "urgent_nudge",
  type: MotivationMessageType,
  _targetLabel: string
): string {
  if (type === "top_performer") {
    return `Hi [name],\n\nYou’ve been one of our top performers this week. Your consistency stands out — keep the same rhythm and you’ll keep earning strong RDM rewards.`;
  }
  if (type === "custom") {
    return `Hi [name],\n\nI wanted to check in and encourage you to keep your learning momentum going today.`;
  }
  if (action === "urgent_nudge") {
    return `Hi [name],\n\nYour study streak is at risk. Even one focused 20-minute session today will get you back on track — and you can earn +10 RDM when you complete it.`;
  }
  return `Hi [name],\n\nI noticed you haven’t been active recently, but your last results were strong. Don’t let the streak slip — come back today and earn +10 RDM on your next completed task.`;
}
