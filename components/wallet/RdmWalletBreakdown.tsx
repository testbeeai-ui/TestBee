"use client";

import type { WalletGuide } from "@/lib/rdm/walletGuideTypes";
import { cn } from "@/lib/utils";

type Props = {
  guide: WalletGuide;
  /** Tighter rows for header popup. */
  compact?: boolean;
  variant?: "dark" | "light";
  /** Side-by-side columns with independent scroll (wallet popup). */
  popup?: boolean;
};

function WalletSection({
  title,
  rows,
  valueClassName,
  rowClassName,
  titleClassName,
  labelClassName,
  compact,
  scrollable,
}: {
  title: string;
  rows: WalletGuide["earn"];
  valueClassName: string;
  rowClassName: string;
  titleClassName: string;
  labelClassName: string;
  compact: boolean;
  scrollable: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <div className={cn("flex min-h-0 flex-col", scrollable && "md:max-h-[min(52vh,400px)]")}>
      <div className={cn("mb-2 shrink-0 text-xs font-semibold uppercase tracking-wider", titleClassName)}>
        {title}
      </div>
      <div
        className={cn(
          compact ? "space-y-1" : "space-y-1.5",
          scrollable && "min-h-0 overflow-y-auto pr-0.5 md:pr-1"
        )}
      >
        {rows.map((row) => (
          <div
            key={row.label}
            className={cn(
              "flex items-start justify-between gap-2 rounded-lg border",
              compact ? "px-2.5 py-1.5" : "px-3 py-2",
              rowClassName
            )}
          >
            <span
              className={cn(
                "min-w-0 flex-1 leading-snug",
                compact ? "text-xs" : "text-sm",
                labelClassName
              )}
            >
              {row.label}
            </span>
            <span
              className={cn(
                "shrink-0 font-semibold tabular-nums",
                compact ? "text-xs" : "text-sm",
                valueClassName
              )}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RdmWalletBreakdown({
  guide,
  compact = false,
  variant = "dark",
  popup = false,
}: Props) {
  const isDark = variant === "dark";

  const earnProps = {
    valueClassName: isDark ? "font-serif text-emerald-300" : "text-emerald-600",
    rowClassName: isDark ? "border-white/10 bg-black/20" : "border-border/70 bg-muted/30",
    titleClassName: isDark ? "text-slate-500" : "text-muted-foreground",
    labelClassName: isDark ? "text-slate-300" : "text-foreground/90",
    compact,
    scrollable: popup,
  };

  const spendProps = {
    valueClassName: isDark ? "font-serif text-amber-300" : "text-amber-600",
    rowClassName: isDark ? "border-white/10 bg-black/20" : "border-border/70 bg-muted/30",
    titleClassName: isDark ? "text-slate-500" : "text-muted-foreground",
    labelClassName: isDark ? "text-slate-300" : "text-foreground/90",
    compact,
    scrollable: popup,
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          popup ? "md:grid-cols-2 md:gap-5 md:items-start" : "md:grid-cols-2 md:gap-5"
        )}
      >
        <WalletSection title="You earn" rows={guide.earn} {...earnProps} />
        <WalletSection title="You spend" rows={guide.spend} {...spendProps} />
      </div>
      {guide.notes.length > 0 ? (
        <div
          className={cn(
            "space-y-1.5 border-t pt-3",
            isDark ? "border-white/10" : "border-border/60"
          )}
        >
          {guide.notes.map((note) => (
            <p
              key={note}
              className={cn(
                "text-[11px] leading-relaxed",
                isDark ? "text-slate-500" : "text-muted-foreground"
              )}
            >
              {note}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
