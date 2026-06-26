import type { LucideIcon } from "lucide-react";

export type NoteColor = "teal" | "amber" | "purple";

export type OnboardingTask = {
  id: string;
  /** Full title in task detail drawer */
  title: string;
  /** Short label on sticky note */
  boardTitle: string;
  teaser: string;
  time: string;
  steps: string[];
  hints: string[];
  href: string;
  icon: LucideIcon;
  color: NoteColor;
  /** Day-1 checklist RDM share (sticky board + tour copy). */
  rdmReward?: number;
};

export const NOTE_COLOR_STYLES: Record<
  NoteColor,
  {
    border: string;
    icon: string;
    pillBg: string;
    pillBorder: string;
    pillText: string;
    iconWrapBg: string;
    iconWrapText: string;
    hoverBorder: string;
  }
> = {
  teal: {
    border: "border-emerald-500/20",
    hoverBorder: "hover:border-emerald-500/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.08)]",
    icon: "text-emerald-400",
    pillBg: "bg-emerald-500/10",
    pillBorder: "border-emerald-500/20",
    pillText: "text-emerald-300",
    iconWrapBg: "bg-emerald-500/10",
    iconWrapText: "text-emerald-300",
  },
  amber: {
    border: "border-amber-500/20",
    hoverBorder: "hover:border-amber-500/40 hover:shadow-[0_0_15px_rgba(245,158,11,0.08)]",
    icon: "text-amber-400",
    pillBg: "bg-amber-500/10",
    pillBorder: "border-amber-500/20",
    pillText: "text-amber-300",
    iconWrapBg: "bg-amber-500/10",
    iconWrapText: "text-amber-300",
  },
  purple: {
    border: "border-violet-500/20",
    hoverBorder: "hover:border-violet-500/40 hover:shadow-[0_0_15px_rgba(139,92,246,0.08)]",
    icon: "text-violet-400",
    pillBg: "bg-violet-500/10",
    pillBorder: "border-violet-500/20",
    pillText: "text-violet-300",
    iconWrapBg: "bg-violet-500/10",
    iconWrapText: "text-violet-300",
  },
};
