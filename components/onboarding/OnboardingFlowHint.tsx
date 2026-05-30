"use client";

import { cn } from "@/lib/utils";

/** Inline emphasis for steps — readable, not shouty UI chrome. */
export function OnboardingFlowHint({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline rounded border border-border bg-muted/60 px-1.5 py-px text-[13px] font-semibold text-foreground",
        "dark:border-white/12 dark:bg-white/[0.06]",
        className
      )}
    >
      {children}
    </span>
  );
}
