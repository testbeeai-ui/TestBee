"use client";

import { cn } from "@/lib/utils";

type Props = {
  balance: number;
  variant?: "dark" | "light";
};

export default function RdmWalletBalanceStrip({ balance, variant = "dark" }: Props) {
  const isDark = variant === "dark";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-xl border px-4 py-3",
        isDark
          ? "border-amber-400/25 bg-gradient-to-r from-amber-400/10 to-amber-400/5"
          : "border-amber-500/25 bg-amber-500/10"
      )}
    >
      <div>
        <p
          className={cn(
            "text-[11px] font-semibold uppercase tracking-wider",
            isDark ? "text-slate-500" : "text-muted-foreground"
          )}
        >
          RDM balance
        </p>
        <p className={cn("text-xs", isDark ? "text-slate-400" : "text-muted-foreground")}>
          Reward points in your wallet
        </p>
      </div>
      <p
        className={cn(
          "text-3xl font-extrabold tabular-nums leading-none",
          isDark ? "font-serif text-amber-300" : "text-amber-600"
        )}
      >
        {balance.toLocaleString("en-IN")}
      </p>
    </div>
  );
}
