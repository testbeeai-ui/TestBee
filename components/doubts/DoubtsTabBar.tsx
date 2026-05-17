"use client";

import type { TabFilter } from "./doubtTypes";

const tabs: { value: TabFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "student", label: "Student Qs" },
  { value: "ai", label: "Prof-Pi & AI" },
  { value: "teacher", label: "Teacher tagged" },
  { value: "revision", label: "Revision picks" },
];

interface DoubtsTabBarProps {
  activeTab: TabFilter;
  onTabChange: (tab: TabFilter) => void;
}

export default function DoubtsTabBar({ activeTab, onTabChange }: DoubtsTabBarProps) {
  return (
    <div className="mb-3 border-b border-border sm:mb-4">
      <div className="flex items-center gap-0.5 -mb-px pb-1 overflow-x-auto scrollbar-none sm:gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onTabChange(tab.value)}
            className={`px-2.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 sm:px-4 sm:py-2.5 sm:text-sm ${
              activeTab === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
