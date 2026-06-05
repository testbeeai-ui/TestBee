"use client";

import Link from "next/link";
import { BarChart3, Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PerformanceUpgradeTarget } from "@/lib/subscription/performancePageAccess";

const UPGRADE_COPY: Record<
  PerformanceUpgradeTarget,
  { title: string; description: string; cta: string; hint: string; footnote: string }
> = {
  starter: {
    title: "Unlock your Performance dashboard",
    description:
      "Upgrade to Starter to track questions done, accuracy, quiz breakdown by subject, and quick actions — built for serious daily practice.",
    cta: "Upgrade to Starter",
    hint: "Starter · from ₹499/mo",
    footnote: "Free & trial plans do not include the Performance dashboard. Change plan in Profile → Subscription.",
  },
  pro: {
    title: "Test performance by category",
    description:
      "Upgrade to Pro to unlock CBSE, JEE Main, JEE Advanced, and KCET marks with subject-wise rings — your full mock & past-paper analytics.",
    cta: "Upgrade to Pro",
    hint: "Pro · from ₹899/mo",
    footnote: "Category reports are included on the Pro plan. Change plan in Profile → Subscription.",
  },
};

function UpgradeCard({
  upgradeTarget,
  showBarChartIcon,
}: {
  upgradeTarget: PerformanceUpgradeTarget;
  showBarChartIcon?: boolean;
}) {
  const copy = UPGRADE_COPY[upgradeTarget];
  return (
    <div className="w-full max-w-lg rounded-2xl border border-border/80 bg-card/95 p-5 text-center shadow-[0_24px_60px_rgba(0,0,0,0.35)] dark:border-white/10 dark:bg-[#0c1017]/95 sm:p-7">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">
        {showBarChartIcon ? (
          <BarChart3 className="h-5 w-5" aria-hidden />
        ) : (
          <Lock className="h-5 w-5" aria-hidden />
        )}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {copy.hint}
      </p>
      <h3 className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl">
        {copy.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.description}</p>
      <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
        <Button
          asChild
          className="bg-gradient-to-r from-amber-500 to-orange-500 font-semibold text-white hover:from-amber-600 hover:to-orange-600"
        >
          <Link href="/profile?section=sub-plans">
            <Crown className="mr-2 h-4 w-4" aria-hidden />
            {copy.cta}
          </Link>
        </Button>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">{copy.footnote}</p>
    </div>
  );
}

type PerformanceUpgradeGateProps = {
  locked: boolean;
  upgradeTarget: PerformanceUpgradeTarget | null;
  /** Full page: upgrade only (no stats). Section: blur + overlay. */
  variant?: "page" | "section";
  children: React.ReactNode;
};

export default function PerformanceUpgradeGate({
  locked,
  upgradeTarget,
  variant = "section",
  children,
}: PerformanceUpgradeGateProps) {
  if (!locked || !upgradeTarget) {
    return <>{children}</>;
  }

  const isPage = variant === "page";

  if (isPage) {
    return (
      <div
        className="flex min-h-[min(70vh,720px)] items-center justify-center px-4 py-10 sm:px-6"
        role="region"
        aria-label="Performance dashboard upgrade"
      >
        <UpgradeCard upgradeTarget={upgradeTarget} showBarChartIcon />
      </div>
    );
  }

  return (
    <div className="relative" aria-busy={locked}>
      <div
        className={cn(
          "pointer-events-none select-none blur-[6px] brightness-[0.92] saturate-75 transition-[filter] duration-300"
        )}
        aria-hidden
      >
        {children}
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl p-3 sm:p-4">
        <div
          className="pointer-events-auto absolute inset-0 rounded-2xl bg-gradient-to-b from-background/55 via-background/75 to-background/90 backdrop-blur-[2px] dark:from-[#070b12]/50 dark:via-[#070b12]/78 dark:to-[#070b12]/92"
          aria-hidden
        />
        <div className="relative z-10 w-full max-w-md">
          <UpgradeCard upgradeTarget={upgradeTarget} />
        </div>
      </div>
    </div>
  );
}
