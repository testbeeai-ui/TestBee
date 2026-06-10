"use client";

import type { TabFilter } from "./doubtTypes";
import { gyanTabIdleClass, gyanWallFontClass } from "./gyanWallStyles";
import { cn } from "@/lib/utils";

const tabs: { value: TabFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "student", label: "Student Qs" },
  { value: "ai", label: "Prof-Pi & AI" },
  { value: "teacher", label: "Teacher tagged" },
  { value: "revision", label: "Revision picks" },
];

/** Distinct but muted accents — sage, steel blue, periwinkle, rose (no gold). */
const tabActiveStyles: Record<TabFilter, string> = {
  all: "border-[#5B9A85] text-[#A8D5C5] bg-[#5B9A85]/10",
  student: "border-[#6B8FC4] text-[#8EB8E8] bg-[#6B8FC4]/10",
  ai: "border-[#7A72B8] text-[#B8B0E8] bg-[#7A72B8]/12",
  teacher: "border-[#5B9A85] text-[#A8D5C5] bg-[#1e2a26]/55",
  revision: "border-[#C48A9A] text-[#D4A0AC] bg-[#2a1f24]/35",
};

interface DoubtsTabBarProps {
  activeTab: TabFilter;
  onTabChange: (tab: TabFilter) => void;
}

export default function DoubtsTabBar({ activeTab, onTabChange }: DoubtsTabBarProps) {
  return (
    <div className={cn("mb-3 border-b border-[#2A3347]/80 sm:mb-4", gyanWallFontClass)}>
      <div className="flex items-center gap-0.5 -mb-px pb-1 overflow-x-auto scrollbar-none sm:gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onTabChange(tab.value)}
            className={cn(
              "px-2.5 py-2 text-xs font-semibold whitespace-nowrap transition-all border-b-2 rounded-t-md sm:px-4 sm:py-2.5 sm:text-sm",
              activeTab === tab.value ? tabActiveStyles[tab.value] : gyanTabIdleClass
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
