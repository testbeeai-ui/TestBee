"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const ACCENT_STYLES = {
  cyan: { ring: "from-cyan-500/30", title: "text-cyan-200" },
  fuchsia: { ring: "from-fuchsia-500/30", title: "text-fuchsia-200" },
  amber: { ring: "from-amber-400/35", title: "text-amber-200" },
  emerald: { ring: "from-emerald-400/30", title: "text-emerald-200" },
} as const;

type Accent = keyof typeof ACCENT_STYLES;

export function TileFrame({
  title,
  accent,
  children,
  trailing,
}: {
  title: string;
  accent: Accent;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  const tone = ACCENT_STYLES[accent];
  return (
    <div className="relative rounded-[10px] p-[1px]">
      <div
        className={cn(
          "absolute inset-0 rounded-[10px] bg-gradient-to-br to-white/0 opacity-90",
          tone.ring
        )}
        aria-hidden
      />
      <div className="relative rounded-[10px] bg-[#0a0b13] px-2.5 py-2 min-h-[110px]">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className={cn("text-[10px] font-bold uppercase tracking-[0.12em]", tone.title)}>
            {title}
          </p>
          {trailing}
        </div>
        {children}
      </div>
    </div>
  );
}
