/** Shared visual tokens for Learning Buddy Advanced (dark, high-contrast). */

export type BuddyCardAccent =
  | "teal"
  | "blue"
  | "amber"
  | "lime"
  | "purple"
  | "rose";

export const BUDDY_CARD_ACCENT: Record<
  BuddyCardAccent,
  {
    border: string;
    glow: string;
    iconBg: string;
    iconText: string;
    label: string;
    topLine: string;
  }
> = {
  teal: {
    border: "border-emerald-500/20",
    glow: "shadow-[0_0_24px_-8px_rgba(29,158,117,0.35)]",
    iconBg: "bg-emerald-500/15 ring-1 ring-emerald-400/25",
    iconText: "text-emerald-400",
    label: "text-emerald-300/90",
    topLine: "from-emerald-500/60 via-emerald-400/20 to-transparent",
  },
  blue: {
    border: "border-sky-500/20",
    glow: "shadow-[0_0_24px_-8px_rgba(55,138,221,0.35)]",
    iconBg: "bg-sky-500/15 ring-1 ring-sky-400/25",
    iconText: "text-sky-400",
    label: "text-sky-300/90",
    topLine: "from-sky-500/60 via-sky-400/20 to-transparent",
  },
  amber: {
    border: "border-amber-500/20",
    glow: "shadow-[0_0_24px_-8px_rgba(239,159,39,0.3)]",
    iconBg: "bg-amber-500/15 ring-1 ring-amber-400/25",
    iconText: "text-amber-400",
    label: "text-amber-300/90",
    topLine: "from-amber-500/60 via-amber-400/20 to-transparent",
  },
  lime: {
    border: "border-lime-500/20",
    glow: "shadow-[0_0_24px_-8px_rgba(151,196,89,0.3)]",
    iconBg: "bg-lime-500/15 ring-1 ring-lime-400/25",
    iconText: "text-lime-400",
    label: "text-lime-300/90",
    topLine: "from-lime-500/60 via-lime-400/20 to-transparent",
  },
  purple: {
    border: "border-violet-500/20",
    glow: "shadow-[0_0_24px_-8px_rgba(127,119,221,0.4)]",
    iconBg: "bg-violet-500/15 ring-1 ring-violet-400/25",
    iconText: "text-violet-300",
    label: "text-violet-200/90",
    topLine: "from-violet-500/60 via-fuchsia-400/20 to-transparent",
  },
  rose: {
    border: "border-rose-500/20",
    glow: "shadow-[0_0_24px_-8px_rgba(244,63,94,0.25)]",
    iconBg: "bg-rose-500/15 ring-1 ring-rose-400/25",
    iconText: "text-rose-400",
    label: "text-rose-300/90",
    topLine: "from-rose-500/50 via-rose-400/15 to-transparent",
  },
};

export const BUDDY_AVA_GRADIENTS = [
  "bg-gradient-to-br from-emerald-600/80 to-teal-900/90 text-emerald-100 ring-2 ring-emerald-400/30",
  "bg-gradient-to-br from-sky-600/80 to-indigo-900/90 text-sky-100 ring-2 ring-sky-400/30",
  "bg-gradient-to-br from-fuchsia-600/70 to-violet-900/90 text-fuchsia-100 ring-2 ring-fuchsia-400/30",
  "bg-gradient-to-br from-amber-600/70 to-orange-900/90 text-amber-100 ring-2 ring-amber-400/30",
  "bg-gradient-to-br from-violet-600/70 to-purple-900/90 text-violet-100 ring-2 ring-violet-400/30",
] as const;

export const lbAdvancedShell =
  "relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080b12] font-sans text-[13px] text-slate-100 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.75)]";

export const lbAdvancedMesh =
  "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_0%_-10%,rgba(127,119,221,0.18),transparent_55%),radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(29,158,117,0.12),transparent_50%),radial-gradient(ellipse_50%_30%_at_50%_100%,rgba(55,138,221,0.08),transparent_45%)]";

export const lbAdvancedTopbar =
  "relative z-10 flex items-center gap-3 border-b border-white/[0.06] bg-gradient-to-r from-[#12182a]/95 via-[#141a28]/90 to-[#12182a]/95 px-4 py-3.5 backdrop-blur-md";

export const lbAdvancedRoster =
  "relative z-10 flex flex-col border-white/[0.06] bg-gradient-to-b from-[#101622]/98 to-[#0c1018]/98 md:border-r";

export const lbAdvancedDetailBg =
  "relative flex min-h-[320px] min-w-0 flex-col bg-[#070a10]/80";
