"use client";

import { cn } from "@/lib/utils";

type ProfPiBrandNameProps = {
  className?: string;
  profClassName?: string;
  /** Header: white italic Pi; trigger hover: purple Pi; investor spec: teal */
  piTone?: "teal" | "purple" | "white";
  size?: "sm" | "md";
};

const SIZE_CLASS = {
  sm: "text-xs",
  md: "text-[15px]",
} as const;

const PI_TONE_CLASS = {
  teal: "text-[#9FE1CB]",
  purple: "text-[#7F77DD]",
  white: "text-white",
} as const;

/** Prof-Pi as one attached brand mark */
export default function ProfPiBrandName({
  className,
  profClassName = "text-white",
  piTone = "white",
  size = "md",
}: ProfPiBrandNameProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0 whitespace-nowrap tracking-[-0.01em] leading-none",
        SIZE_CLASS[size],
        className
      )}
    >
      <span className={cn("font-bold", profClassName)}>Prof-</span>
      <span
        className={cn(
          "font-normal italic [font-family:Georgia,'Times_New_Roman',Times,serif]",
          PI_TONE_CLASS[piTone]
        )}
      >
        Pi
      </span>
    </span>
  );
}
