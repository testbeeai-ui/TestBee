"use client";

import { useState, type CSSProperties } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

type RdmRewardInfoTipProps = {
  title: string;
  lines: string[];
  ariaLabel: string;
  /** Optional class for the trigger button (Quiz uses Tailwind; Numerals may pass none). */
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
  /**
   * Horizontal anchor of the tooltip under the info button.
   * Use `start` near the left edge of a panel so the tip opens to the right.
   */
  align?: "start" | "end";
};

/**
 * RDM explainer that opens only while the pointer is on the info button —
 * not on focus, dialog open, or hover over nearby content.
 */
export default function RdmRewardInfoTip({
  title,
  lines,
  ariaLabel,
  triggerClassName,
  triggerStyle,
  align = "end",
}: RdmRewardInfoTipProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex shrink-0">
      <button
        type="button"
        tabIndex={-1}
        aria-label={ariaLabel}
        aria-expanded={open}
        className={cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-700/50 bg-[#2a1f00] text-amber-300/90 hover:text-amber-200",
          triggerClassName
        )}
        style={triggerStyle}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <Info className="h-3 w-3" aria-hidden />
      </button>
      {open ? (
        <div
          role="tooltip"
          className={cn(
            "pointer-events-none absolute top-full z-[80] mt-2 w-72 rounded-md border border-slate-700 bg-slate-950 p-3 text-slate-100 shadow-md",
            align === "start" ? "left-0" : "right-0"
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300/90">
            {title}
          </p>
          <ul className="mt-2 space-y-1.5 text-[12px] leading-snug text-slate-300">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
