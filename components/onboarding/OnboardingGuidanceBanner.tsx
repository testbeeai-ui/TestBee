"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Full-width product-style hint (library / hub). */
export function OnboardingGuidanceBanner({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-xl border border-border/80 bg-gradient-to-br from-muted/40 via-muted/25 to-transparent px-4 py-3 sm:px-5 sm:py-4",
        "shadow-[inset_0_1px_0_0_rgb(255_255_255_/_.04)] dark:from-muted/30 dark:via-muted/15",
        className
      )}
    >
      <div className="flex gap-3 sm:items-start">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.07] text-primary">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-[13px] font-semibold leading-snug text-foreground">{title}</p>
          <div className="text-[13px] leading-relaxed text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}
