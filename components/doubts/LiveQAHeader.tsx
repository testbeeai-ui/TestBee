"use client";

import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { OnboardingClickHerePointer } from "@/components/onboarding/OnboardingClickHerePointer";
import { cn } from "@/lib/utils";
import { gyanAskBtnInlineClass, gyanAskBtnRdmClass, gyanWallFontClass } from "./gyanWallStyles";

interface LiveQAHeaderProps {
  todayCount: number;
  onAskClick: () => void;
  askRewardRdm?: number;
  showAskPointer?: boolean;
}

export default function LiveQAHeader({
  todayCount,
  onAskClick,
  askRewardRdm = 5,
  showAskPointer = false,
}: LiveQAHeaderProps) {
  return (
    <div className={cn("mb-3", gyanWallFontClass)}>
      <div className="flex items-center gap-2 mb-2 flex-wrap rounded-xl border border-[#5B9A85]/15 bg-gradient-to-r from-[#1a2420]/40 via-[#181e2a] to-[#1a1e2e]/50 px-3 py-2">
        <h2 className="text-lg font-semibold text-[#E8EAF0] tracking-tight">Live Q&amp;A wall</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#5B9A85]/25 bg-[#1e2a26]/70 px-2 py-0.5 text-xs font-medium text-[#A8D5C5]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5B9A85] animate-pulse" />
          Live &middot; {todayCount} active
        </span>
      </div>

      <div className="relative flex flex-col sm:flex-row gap-2 sm:items-stretch">
        {showAskPointer && (
          <div className="absolute -top-11 left-6 z-10 pointer-events-none">
            <OnboardingClickHerePointer label="Click here" />
          </div>
        )}
        <Input
          placeholder="Ask a doubt, add a question, or browse the wall..."
          className={cn(
            "rounded-xl flex-1 min-w-0 h-10 text-[13px] font-sans",
            "bg-[#1C2333]/90 border-[#6B8FC4]/22 text-[#E8EAF0] placeholder:text-[#5C6480]",
            "focus-visible:ring-[#5B9A85]/35 focus-visible:border-[#5B9A85] shadow-inner shadow-black/15"
          )}
          onFocus={onAskClick}
          readOnly
        />
        <button type="button" className={gyanAskBtnInlineClass} onClick={onAskClick}>
          <Plus className="w-4 h-4" /> Ask{" "}
          <span className={gyanAskBtnRdmClass}>(+{askRewardRdm} RDM)</span>
        </button>
      </div>
    </div>
  );
}
