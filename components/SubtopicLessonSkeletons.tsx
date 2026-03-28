"use client";

import { BookMarked, HelpCircle, Lightbulb, Sigma } from "lucide-react";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-muted/70 animate-pulse ${className}`} />;
}

/** Right-rail placeholders for subtopic lesson page (AI / Supabase will fill later). */
export function TheoryPanelSkeleton() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-muted/20 p-6 space-y-3 min-h-[220px]">
      <SkeletonBlock className="h-4 w-2/5" />
      <SkeletonBlock className="h-3 w-full" />
      <SkeletonBlock className="h-3 w-11/12" />
      <SkeletonBlock className="h-3 w-4/5" />
      <SkeletonBlock className="h-24 w-full mt-4" />
    </div>
  );
}

export function InstaQCardSkeleton() {
  return (
    <div className="edu-card p-4 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5">
      <div className="flex items-center gap-2 mb-3">
        <HelpCircle className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-extrabold uppercase tracking-wide text-primary">Insta Q</span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">Quick questions — coming soon</p>
      <div className="space-y-2">
        <SkeletonBlock className="h-10 w-full rounded-xl" />
        <SkeletonBlock className="h-10 w-full rounded-xl" />
        <SkeletonBlock className="h-10 w-5/6 rounded-xl" />
      </div>
    </div>
  );
}

export function BitsCardSkeleton() {
  return (
    <div className="edu-card p-4 rounded-2xl border-2 border-dashed border-emerald-500/35 bg-emerald-500/5">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-xs font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          Bits
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">Byte-sized takeaways — coming soon</p>
      <div className="space-y-2">
        <SkeletonBlock className="h-8 w-full" />
        <SkeletonBlock className="h-8 w-full" />
        <SkeletonBlock className="h-8 w-4/5" />
      </div>
    </div>
  );
}

export function FormulasCardSkeleton() {
  return (
    <div className="edu-card p-4 rounded-2xl border-2 border-dashed border-violet-500/35 bg-violet-500/5">
      <div className="flex items-center gap-2 mb-3">
        <Sigma className="w-4 h-4 text-violet-600 shrink-0" />
        <span className="text-xs font-extrabold uppercase tracking-wide text-violet-700 dark:text-violet-400">
          Formulas
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">Key equations — coming soon</p>
      <SkeletonBlock className="h-16 w-full rounded-xl" />
      <SkeletonBlock className="h-12 w-3/4 rounded-xl mt-2" />
    </div>
  );
}

export function DeepDiveActionsSkeleton() {
  return (
    <div className="edu-card p-4 rounded-2xl border-2 border-dashed border-border bg-muted/15">
      <div className="flex items-center gap-2 mb-3">
        <BookMarked className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          Deep dive
        </span>
      </div>
      <div className="grid gap-2">
        <SkeletonBlock className="h-9 w-full rounded-xl" />
        <SkeletonBlock className="h-9 w-full rounded-xl" />
      </div>
    </div>
  );
}
