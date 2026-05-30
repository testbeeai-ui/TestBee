"use client";

import { cn } from "@/lib/utils";

type PointerVariant = "default" | "violet" | "emerald";

export function OnboardingClickHerePointer({
  label = "Click here",
  className,
  variant = "default",
}: {
  label?: string;
  className?: string;
  variant?: PointerVariant;
}) {
  const isEmerald = variant === "emerald";

  const outerBorder = isEmerald
    ? "border-emerald-500/35 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)]"
    : "border-violet-500/35 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]";

  const pingBg = isEmerald ? "bg-emerald-400" : "bg-violet-400";
  const dotBg = isEmerald ? "bg-emerald-500" : "bg-violet-500";
  const arrowColor = isEmerald ? "text-emerald-500/40" : "text-violet-500/40";

  return (
    <div
      className={cn(
        "pointer-events-none flex flex-col items-center gap-1 z-30 select-none",
        "animate-[bounce_2s_infinite]",
        className
      )}
      aria-hidden
    >
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-lg border bg-[#090f1e]/95 px-2.5 py-1 text-[10px] font-black tracking-wider shadow-xl backdrop-blur-md uppercase ring-1 ring-white/5",
          outerBorder
        )}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              pingBg
            )}
          ></span>
          <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", dotBg)}></span>
        </span>
        {label}
      </div>
      <svg
        width="12"
        height="6"
        viewBox="0 0 12 6"
        fill="none"
        className={cn("drop-shadow-sm", arrowColor)}
        aria-hidden
      >
        <path
          d="M1 1L6 5L11 1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
