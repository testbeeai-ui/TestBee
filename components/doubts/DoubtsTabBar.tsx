"use client";

import type { TabFilter } from "./doubtTypes";

const tabs: { value: TabFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "student", label: "Student Qs" },
  { value: "ai", label: "Prof-Pi & AI" },
  { value: "teacher", label: "Teacher tagged" },
  { value: "revision", label: "Revision picks" },
  { value: "bounties", label: "Bounties" },
];

interface DoubtsTabBarProps {
  activeTab: TabFilter;
  onTabChange: (tab: TabFilter) => void;
}

export default function DoubtsTabBar({ activeTab, onTabChange }: DoubtsTabBarProps) {
  return (
    <div className="mb-4 border-b border-border">
      <div className="flex flex-wrap items-center gap-1 -mb-px pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onTabChange(tab.value)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
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
