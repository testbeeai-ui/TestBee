"use client";

import { cn } from "@/lib/utils";

type Props = {
  step1Complete: boolean;
  ambassadorSubmitted: boolean;
};

export function WaitlistStepIndicator({ step1Complete, ambassadorSubmitted }: Props) {
  const steps = [
    { num: 1, label: "Join the waitlist", done: step1Complete },
    { num: 2, label: "Become an Ambassador", done: ambassadorSubmitted },
  ];

  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((step, idx) => (
        <div key={step.num} className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold border",
              step.done
                ? "bg-[#1D9E75] border-[#1D9E75] text-white"
                : idx === 0 || step1Complete
                  ? "border-[#1D9E75] text-[#1D9E75] bg-[#0A2A20]"
                  : "border-[#2A3347] text-[#5C6480] bg-[#161B25]"
            )}
          >
            {step.num}
          </div>
          <span
            className={cn(
              "text-xs font-medium truncate",
              step.done
                ? "text-[#1D9E75]"
                : idx === 0 || step1Complete
                  ? "text-white"
                  : "text-[#5C6480]"
            )}
          >
            {step.label}
          </span>
          {idx < steps.length - 1 && (
            <div
              className={cn(
                "hidden sm:block flex-1 h-px mx-1",
                step1Complete ? "bg-[#1D9E75]/40" : "bg-[#2A3347]"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
