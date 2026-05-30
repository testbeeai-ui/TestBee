"use client";

import { ArrowRight, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NOTE_COLOR_STYLES, type OnboardingTask } from "@/lib/onboarding/onboardingRewardTaskUi";

type OnboardingTaskDetailCardProps = {
  task: OnboardingTask;
  done: boolean;
  perTaskReward: number;
  variant: "student" | "admin";
  onOpenTask: () => void;
  onAdminToggle?: () => void;
};

export function OnboardingTaskDetailCard({
  task,
  done,
  perTaskReward,
  variant,
  onOpenTask,
  onAdminToggle,
}: OnboardingTaskDetailCardProps) {
  const Icon = task.icon;
  const styles = NOTE_COLOR_STYLES[task.color];

  return (
    <>
      {/* Subtle top glow in detail drawer */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none" aria-hidden>
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-24 bg-violet-500/10 rounded-full blur-[40px]" />
      </div>

      <div className="flex items-start gap-3 border-b border-[#222a3d]/40 bg-slate-950/20 px-4 py-3.5 relative z-10">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
            styles.pillBorder,
            styles.iconWrapBg
          )}
        >
          <Icon className={cn("h-5 w-5", styles.icon)} aria-hidden />
        </div>
        <div className="min-w-0 flex-1 pr-6">
          <h3 className="text-sm font-bold text-zinc-100">{task.title}</h3>
          <span
            className={cn(
              "mt-1.5 inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase",
              styles.pillBg,
              styles.pillBorder,
              styles.pillText
            )}
          >
            +{perTaskReward} RDM
          </span>
        </div>
      </div>

      <div className="px-4 py-3.5 relative z-10">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-amber-200">
          <Clock className="h-3.5 w-3.5 text-amber-400 animate-pulse" aria-hidden />
          {task.time}
        </span>

        <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
          {variant === "student"
            ? "Read the steps here first. Only the Open button below takes you straight to the task page."
            : "Tap Open page below to launch the task route."}
        </p>

        <ol className="mt-3 space-y-2.5">
          {task.steps.map((step, i) => (
            <li
              key={step}
              className={cn(
                "flex items-start gap-3 rounded-xl border border-[#222a3d]/45 bg-slate-950/40 px-3.5 py-2.5 transition-colors border-l-2",
                task.color === "teal" && "border-l-emerald-500/50 hover:bg-[#0c1524]/60",
                task.color === "amber" && "border-l-amber-500/50 hover:bg-[#12111d]/60",
                task.color === "purple" && "border-l-violet-500/50 hover:bg-[#110e25]/60"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-lg border text-[11px] font-extrabold shadow-sm",
                  styles.pillBg,
                  styles.pillBorder,
                  styles.icon
                )}
              >
                {i + 1}
              </span>
              <span className="text-[12px] leading-relaxed text-zinc-300">{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-4.5 space-y-2.5 pb-1">
          {variant === "admin" ? (
            <>
              <Button
                type="button"
                disabled={done}
                onClick={onAdminToggle}
                className={cn(
                  "h-10 w-full rounded-xl text-[12px] font-extrabold text-white transition-all active:scale-[0.98] shadow-md",
                  done
                    ? "bg-emerald-950/20 text-emerald-400 border border-emerald-500/20"
                    : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-950/20"
                )}
              >
                <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {done
                  ? `Done — ${perTaskReward} RDM step complete`
                  : `Mark as done — earn ${perTaskReward} RDM!`}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onOpenTask}
                className="h-9 w-full rounded-xl border-[#222a3d]/60 bg-transparent text-xs font-bold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all active:scale-[0.98]"
              >
                Open page
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={onOpenTask}
              className={cn(
                "h-10 w-full rounded-xl text-[12px] font-extrabold text-white shadow-lg transition-all active:scale-[0.98] cursor-pointer",
                done
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-950/20"
                  : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-violet-950/25"
              )}
            >
              <Check className="mr-1.5 h-3.5 w-3.5 animate-pulse" aria-hidden />
              {done ? "Open again" : `Open task — earn ${perTaskReward} RDM!`}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
