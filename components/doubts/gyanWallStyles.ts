/**
 * Gyan++ wall design tokens — professional ed-tech palette.
 * Sage green CTAs (mild, not neon), periwinkle AI, steel blue community. No gold.
 */

/** Side columns: HTML uses 220px; widened modestly for profile/stats readability. */
export const GYAN_SIDEBAR_WIDTH = 272;

/** Static string so Tailwind JIT includes the grid template. */
export const gyanWallGridClass = "lg:grid-cols-[272px_minmax(0,1fr)_272px]";

/** Sans-serif stack for the whole wall (inherits app font when Inter/system). */
export const gyanWallFontClass = "font-sans antialiased";

/** Muted sage — primary action & progress (not bright mint). */
export const GYAN_SAGE = "#389e78";
export const GYAN_SAGE_HOVER = "#2b8261";
export const GYAN_SAGE_MUTED = "#254b3d";
export const GYAN_SAGE_TEXT = "#a3e2ca";
export const GYAN_SAGE_LIGHT = "#6abfa0";

export const gyanWall = {
  bg: "bg-[#03060E]",
  surface1: "bg-[#090e1a]",
  surface2: "bg-[#0c1324]",
  surface3: "bg-[#121b30]",
  border: "border-[#1e293b]/60",
  border2: "border-[#334155]/60",
  text1: "text-[#f8fafc]",
  text2: "text-[#cbd5e1]",
  text3: "text-[#64748b]",
  sage: `bg-[${GYAN_SAGE}]`,
  sageHover: `hover:bg-[${GYAN_SAGE_HOVER}]`,
  sageText: `text-[${GYAN_SAGE_TEXT}]`,
  purpleChipBg: "bg-[#1a1828]",
  purpleChipBorder: "border-[#5c5494]",
  purpleChipText: "text-[#B8B0E8]",
  blueBadgeBg: "bg-[#121c2e]",
  blueBadgeText: "text-[#8EB8E8]",
  roseAccent: "text-[#D48A9A]",
} as const;

/** RDM / credits — neutral mint, never gold. */
export const gyanRdmTextClass = "text-[#B8D4C8]";
export const gyanRdmMutedClass = "text-[#8FA89C]";
/** RDM suffix on sage Ask buttons — must contrast on #389e78. */
export const gyanAskBtnRdmClass = "text-white/90 font-medium";

export const gyanSidebarLeftClass =
  "bg-gradient-to-b from-[#060a13] via-[#03060e] to-[#010204] border-r border-[#1e293b]/60 shadow-[4px_0_24px_rgba(0,0,0,0.5)]";

export const gyanSidebarRightClass =
  "bg-gradient-to-b from-[#010204] via-[#03060e] to-[#060a13] border-l border-[#1e293b]/60 shadow-[-4px_0_24px_rgba(0,0,0,0.5)]";

export const gyanProfileCardClass =
  "rounded-xl border border-white/[0.06] bg-gradient-to-br from-[#070c18]/80 to-[#03060e]/80 p-4 shadow-xl backdrop-blur-md shadow-black/50 transition-all duration-200";

export const gyanRdmPillClass =
  "inline-flex items-center gap-1 mt-1 rounded-lg border border-[#389e78]/25 bg-[#0a1814]/80 px-2 py-0.5 text-[13px] font-medium text-[#B8D4C8]";

export const gyanRankBadgeClass =
  "rounded-full bg-[#0a1813]/90 border border-[#389e78]/25 px-1.5 py-px text-[10px] font-medium text-[#A8D5C5]";

export const gyanActivityCardClass =
  "rounded-xl border border-white/[0.06] bg-[#070c18]/60 backdrop-blur-md p-4 shadow-xl shadow-black/40 hover:border-white/[0.1] transition-all duration-200";

export const gyanActivityRowActiveClass =
  "text-[#A8D5C5] bg-[#389e78]/10 rounded-md px-1.5 -mx-1.5";

export const gyanActivityRowIdleClass =
  "text-slate-400 hover:text-white hover:bg-white/[0.03] rounded-md px-1.5 -mx-1.5 transition-all duration-150";

export const gyanActivityCountActiveClass =
  "rounded-full bg-[#389e78] text-white/95 shadow-sm shadow-[#389e78]/15";

export const gyanActivityCountIdleClass = "rounded-full bg-white/[0.04] text-slate-400";

export const gyanSectionCardClass =
  "rounded-xl border border-white/[0.06] bg-[#070c18]/60 backdrop-blur-md p-3.5 shadow-xl shadow-black/40 hover:border-white/[0.1] transition-all duration-200";

export const gyanTeachersCardClass =
  "rounded-xl border border-white/[0.06] bg-[#070c18]/60 backdrop-blur-md p-3.5 shadow-xl shadow-black/40 hover:border-white/[0.1] transition-all duration-200";

export const gyanFilterBtnClass =
  "w-full flex items-center justify-between px-2.5 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02] text-xs text-slate-400 hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-white transition-colors";

/** Mild sage CTA — readable, calm, not fluorescent. */
export const gyanAskBtnClass =
  "w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-semibold text-white/95 bg-[#389e78] hover:bg-[#2b8261] shadow-sm shadow-black/20 transition-colors active:scale-[0.99]";

export const gyanAskBtnInlineClass =
  "inline-flex items-center justify-center gap-1.5 shrink-0 rounded-xl h-10 px-5 text-[13px] font-semibold text-white/95 bg-[#389e78] hover:bg-[#2b8261] shadow-sm shadow-black/20 transition-colors";

export const gyanFeedCardClass =
  "rounded-2xl overflow-hidden border border-white/[0.06] bg-[#0a0f1e] shadow-xl shadow-black/40 hover:border-[#389e78]/30 hover:shadow-[0_0_0_1px_rgba(56,158,120,0.12),0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-200 font-sans";

export const gyanStatValueSage = "text-[#A8D5C5]";
export const gyanStatValuePurple = "text-[#B8B0E8]";
export const gyanStatValueBlue = "text-[#8EB8E8]";
export const gyanStatValueRose = "text-[#D4A0AC]";

export const gyanTabIdleClass =
  "border-transparent text-[#5C6480] hover:text-[#9BA3B8] hover:border-[#334060]/50";

/** Accent helpers for inline use in feed cards */
export const gyanAccentSage = "#389e78";
export const gyanAccentSageText = "#A8D5C5";
export const gyanAccentSageBg = "#1e2a26";
export const gyanAccentSageBorder = "#356f59";

export const gyanSaveBtnActiveClass =
  "border-[#389e78] text-[#A8D5C5] bg-[#1e2a26]";

export const gyanSaveBtnIdleClass =
  "border-[#334060] bg-[#1a1f2c] text-[#9BA3B8] hover:border-[#389e78] hover:text-[#A8D5C5]";
