import type { SubscriptionPlanKey } from "@/lib/subscription/subscriptionConfig";

export type PricingCardTheme = {
  border: string;
  bg: string;
  badge: string;
  accent: string;
  button: string;
  glow: string;
};

export function getPricingCardTheme(
  planId: SubscriptionPlanKey,
  isCurrent: boolean
): PricingCardTheme {
  const themes: Record<SubscriptionPlanKey, Omit<PricingCardTheme, "border"> & { borderActive: string; borderIdle: string }> = {
    free_trial: {
      borderActive:
        "border-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.15),inset_0_1px_1px_rgba(255,255,255,0.05)]",
      borderIdle: "border-white/[0.08] hover:border-emerald-500/30",
      bg: "from-[#0d1424] via-[#090f1c] to-[#070a13]",
      badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      accent: "emerald-500",
      button:
        "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold shadow-[0_4px_12px_rgba(16,185,129,0.2)]",
      glow: "group-hover:shadow-[0_0_30px_rgba(16,185,129,0.08)]",
    },
    free: {
      borderActive:
        "border-cyan-500/80 shadow-[0_0_25px_rgba(6,182,212,0.15),inset_0_1px_1px_rgba(255,255,255,0.05)]",
      borderIdle: "border-white/[0.08] hover:border-cyan-500/30",
      bg: "from-[#0d1424] via-[#090f1c] to-[#070a13]",
      badge: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
      accent: "cyan-500",
      button:
        "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold shadow-[0_4px_12px_rgba(6,182,212,0.2)]",
      glow: "group-hover:shadow-[0_0_30px_rgba(6,182,212,0.08)]",
    },
    starter: {
      borderActive:
        "border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.2),inset_0_1px_1px_rgba(255,255,255,0.08)]",
      borderIdle: "border-white/[0.08] hover:border-blue-500/40",
      bg: "from-[#0d172e] via-[#091022] to-[#070a14]",
      badge:
        "border-blue-400/40 bg-blue-500/20 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.15)]",
      accent: "blue-500",
      button:
        "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-[0_4px_15px_rgba(37,99,235,0.25)]",
      glow: "group-hover:shadow-[0_0_35px_rgba(37,99,235,0.12)]",
    },
    pro: {
      borderActive:
        "border-purple-500 shadow-[0_0_35px_rgba(139,92,246,0.28),inset_0_1px_1px_rgba(255,255,255,0.1)]",
      borderIdle:
        "border-purple-500/35 hover:border-purple-400/60 shadow-[0_0_20px_-3px_rgba(139,92,246,0.15)]",
      bg: "from-[#140e34] via-[#0a0b1b] to-[#050610]",
      badge:
        "border-purple-400/40 bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.35)]",
      accent: "purple-500",
      button:
        "bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-500 hover:via-violet-500 hover:to-indigo-500 text-white font-bold shadow-[0_4px_20px_rgba(139,92,246,0.35)]",
      glow: "group-hover:shadow-[0_0_40px_rgba(139,92,246,0.22)]",
    },
  };

  const theme = themes[planId];
  return {
    ...theme,
    border: isCurrent ? theme.borderActive : theme.borderIdle,
  };
}
