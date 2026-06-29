"use client";

import { useState } from "react";
import { CircleAlert } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = {
  title: string;
  children: React.ReactNode;
  tone?: "emerald" | "sky" | "slate" | "amber";
};

const toneClass: Record<NonNullable<Props["tone"]>, string> = {
  emerald: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15",
  sky: "border-sky-400/35 bg-sky-500/10 text-sky-200 hover:bg-sky-500/15",
  slate: "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10",
  amber: "border-amber-400/35 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15",
};

/** Compact ! icon — hover/focus popover for assignment cost copy. */
export default function AssignmentInfoHelp({ title, children, tone = "slate" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className="inline-flex shrink-0"
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Info: ${title}`}
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${toneClass[tone]}`}
          >
            <CircleAlert className="h-3 w-3" strokeWidth={2.25} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          className="w-[min(18rem,calc(100vw-2rem))] border-white/10 bg-[#15162b] p-3 text-sm text-slate-200 shadow-xl"
        >
          <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
            {title}
          </div>
          <div className="mt-2 text-[13px] leading-snug text-slate-200">{children}</div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
