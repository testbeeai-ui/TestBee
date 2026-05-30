/** Shared pill outlines for Revision section nav (dashboard preview + /revision page). */
export const REVISION_NAV_ACCENTS = [
  {
    border: "border-violet-500/40",
    bg: "bg-violet-500/10",
    ring: "ring-violet-400/35",
    badge: "text-violet-200",
  },
  {
    border: "border-sky-500/40",
    bg: "bg-sky-500/10",
    ring: "ring-sky-400/35",
    badge: "text-sky-200",
  },
  {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-400/35",
    badge: "text-emerald-200",
  },
  {
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    ring: "ring-amber-400/35",
    badge: "text-amber-200",
  },
  {
    border: "border-rose-500/40",
    bg: "bg-rose-500/10",
    ring: "ring-rose-400/35",
    badge: "text-rose-200",
  },
] as const;

export type RevisionNavTabId = "instacue" | "units" | "saved" | "community" | "questions";

export const REVISION_NAV_LINKS: { id: RevisionNavTabId; label: string }[] = [
  { id: "instacue", label: "InstaCue Cards" },
  { id: "units", label: "Unit Revision" },
  { id: "saved", label: "Saved Quiz & Formulas" },
  { id: "community", label: "Community Posts" },
  { id: "questions", label: "Saved Questions" },
];

/**
 * Dashboard Revision block: vertical rows with distinct accent outlines (prep / investor views).
 * Tailwind classes must stay literal strings for JIT.
 */
export const REVISION_DASHBOARD_ROW_STYLES = [
  {
    border: "border-violet-500/50",
    surface:
      "bg-gradient-to-br from-violet-500/[0.18] via-violet-950/20 to-background/90 backdrop-blur-[2px]",
    badge:
      "border border-violet-400/35 bg-violet-500/25 text-violet-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]",
    hover:
      "hover:border-violet-400/70 hover:shadow-[0_12px_40px_-16px_rgba(139,92,246,0.55)] hover:ring-2 hover:ring-violet-400/35 hover:ring-offset-2 hover:ring-offset-background",
  },
  {
    border: "border-sky-500/45",
    surface:
      "bg-gradient-to-br from-sky-500/[0.14] via-sky-950/15 to-background/90 backdrop-blur-[2px]",
    badge:
      "border border-sky-400/35 bg-sky-500/20 text-sky-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]",
    hover:
      "hover:border-sky-400/65 hover:shadow-[0_12px_40px_-16px_rgba(14,165,233,0.4)] hover:ring-2 hover:ring-sky-400/30 hover:ring-offset-2 hover:ring-offset-background",
  },
  {
    border: "border-emerald-500/45",
    surface:
      "bg-gradient-to-br from-emerald-500/[0.14] via-emerald-950/15 to-background/90 backdrop-blur-[2px]",
    badge:
      "border border-emerald-400/35 bg-emerald-500/20 text-emerald-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]",
    hover:
      "hover:border-emerald-400/65 hover:shadow-[0_12px_40px_-16px_rgba(16,185,129,0.38)] hover:ring-2 hover:ring-emerald-400/30 hover:ring-offset-2 hover:ring-offset-background",
  },
  {
    border: "border-amber-500/45",
    surface:
      "bg-gradient-to-br from-amber-500/[0.14] via-amber-950/15 to-background/90 backdrop-blur-[2px]",
    badge:
      "border border-amber-400/35 bg-amber-500/20 text-amber-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]",
    hover:
      "hover:border-amber-400/65 hover:shadow-[0_12px_40px_-16px_rgba(245,158,11,0.42)] hover:ring-2 hover:ring-amber-400/30 hover:ring-offset-2 hover:ring-offset-background",
  },
  {
    border: "border-rose-500/50",
    surface:
      "bg-gradient-to-br from-rose-500/[0.16] from-30% via-rose-950/20 to-background/90 backdrop-blur-[2px]",
    badge:
      "border border-rose-400/40 bg-rose-500/25 text-rose-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]",
    hover:
      "hover:border-rose-400/70 hover:shadow-[0_12px_40px_-16px_rgba(244,63,94,0.45)] hover:ring-2 hover:ring-rose-400/35 hover:ring-offset-2 hover:ring-offset-background",
  },
] as const;
