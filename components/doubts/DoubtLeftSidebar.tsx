"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Coins,
  FileQuestion,
  MessageCircle,
  Info,
  Filter,
  BookMarked,
  ChevronDown,
  ChevronRight,
  List,
} from "lucide-react";

import {
  DOUBT_FLAIRS,
  SUBJECT_COLORS,
  rankFromLifetime,
  rdmToNextRank,
  type ProfileRow,
  type SortOption,
  type ActivityView,
} from "./doubtTypes";
import {
  gyanActivityCardClass,
  gyanActivityCountActiveClass,
  gyanActivityCountIdleClass,
  gyanActivityRowActiveClass,
  gyanActivityRowIdleClass,
  gyanProfileCardClass,
  gyanRankBadgeClass,
  gyanRdmPillClass,
  gyanSidebarLeftClass,
  gyanWallFontClass,
} from "./gyanWallStyles";
import { cn } from "@/lib/utils";

interface DoubtLeftSidebarProps {
  profile: ProfileRow | null;
  strikeRate: { accepted: number; total: number } | null;
  subjectFilters: string[];
  subjectCounts: Record<string, number>;
  activityView: ActivityView;
  sort: SortOption;
  filteredCount: number;
  askedCount: number;
  answeredCount: number;
  savedCount: number;
  unansweredOnly: boolean;
  onToggleSubject: (flair: string) => void;
  onSelectAllSubjects: () => void;
  onClearAllSubjects: () => void;
  onSetActivityView: (v: ActivityView) => void;
  onSetSort: (s: SortOption) => void;
  onSetUnansweredOnly: (v: boolean) => void;
}

export default function DoubtLeftSidebar({
  profile,
  strikeRate,
  subjectFilters,
  subjectCounts,
  activityView,
  sort,
  filteredCount,
  askedCount,
  answeredCount,
  savedCount,
  unansweredOnly,
  onToggleSubject,
  onSelectAllSubjects,
  onClearAllSubjects,
  onSetActivityView,
  onSetSort,
  onSetUnansweredOnly,
  dailyGyanSlot,
}: DoubtLeftSidebarProps & { dailyGyanSlot?: React.ReactNode }) {
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const lifetime = profile?.lifetime_answer_rdm ?? 0;
  const rank = rankFromLifetime(lifetime);
  const nextRank = rdmToNextRank(lifetime);

  const activityItems: {
    key: ActivityView;
    label: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { key: "feed", label: "All doubts", count: filteredCount, icon: List },
    { key: "asked", label: "Questions I asked", count: askedCount, icon: FileQuestion },
    { key: "answered", label: "Questions I answered", count: answeredCount, icon: MessageCircle },
    { key: "saved", label: "Saved for revision", count: savedCount, icon: BookMarked },
  ];

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "recent", label: "Recent" },
    { value: "upvoted", label: "Most upvoted" },
    { value: "unanswered", label: "Unanswered" },
    { value: "bounty", label: "Highest bounty" },
    { value: "teacher_tagged", label: "Teacher tagged" },
    { value: "saved", label: "Marked for revision" },
  ];

  return (
    <aside className="order-2 lg:order-1 min-w-0 flex flex-col">
      <div
        className={cn(
          "flex flex-col gap-2.5 min-h-0 lg:sticky lg:top-[var(--app-header-sticky-offset)] lg:max-h-[calc(100dvh-var(--app-header-sticky-offset))] lg:overflow-y-auto py-3.5 px-3",
          gyanSidebarLeftClass,
          gyanWallFontClass
        )}
      >
        <TooltipProvider>
          {/* Profile card */}
          <div className={gyanProfileCardClass}>
            <div className="flex items-start gap-2">
              <Avatar className="h-[38px] w-[38px] rounded-full shrink-0 ring-2 ring-[#5B9A85]/25">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="rounded-full bg-[#5B9A85] text-white text-sm font-medium">
                  {(profile?.name ?? "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#E8EAF0] truncate">{profile?.name ?? "You"}</p>
                <p className={gyanRdmPillClass}>
                  <Coins className="w-3.5 h-3.5 shrink-0 text-[#7AB8A3]" /> {profile?.rdm ?? 0} RDM
                </p>
                <div className="text-[11px] text-[#5C6480] mt-1 flex items-center gap-1 flex-wrap">
                  {strikeRate && strikeRate.total > 0 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help inline-flex items-center gap-0.5">
                          Strike rate: {Math.round((strikeRate.accepted / strikeRate.total) * 100)}%
                          <Info className="w-3 h-3" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right">Accepted answers / total answers</TooltipContent>
                    </Tooltip>
                  ) : (
                    <span>Strike rate: —</span>
                  )}
                  <span className={gyanRankBadgeClass}>{rank}</span>
                </div>
                {nextRank && (
                  <p className="text-[11px] text-[#A8D5C5] mt-0.5 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-[#5B9A85]" />
                    {nextRank}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* My Activity */}
          <div className={gyanActivityCardClass}>
            <p className="text-[10px] font-bold text-slate-400 mb-2.5 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-[#389e78]" /> My activity
            </p>
            <div className="flex flex-col">
              {activityItems.map((item) => {
                const Icon = item.icon;
                const active = activityView === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-b-0 text-xs w-full transition-all duration-150 ${
                      active ? gyanActivityRowActiveClass : gyanActivityRowIdleClass
                    }`}
                    onClick={() => onSetActivityView(item.key)}
                  >
                    <span className="flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-[#7AB8A3]" : "text-slate-500"}`} />
                      {item.label}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums ${
                        active ? gyanActivityCountActiveClass : gyanActivityCountIdleClass
                      }`}
                    >
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter by subject */}
          <Collapsible open={subjectOpen} onOpenChange={setSubjectOpen}>
            <div className="rounded-xl border border-white/[0.06] bg-[#070c18]/60 backdrop-blur-md shadow-xl shadow-black/40 overflow-hidden transition-all duration-200 hover:border-white/[0.1]">
              <CollapsibleTrigger asChild>
                <button type="button" className="w-full text-left px-3 py-2.5 group">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Filter className="w-3.5 h-3.5 text-[#378ADD]/80" />
                      <span className="text-xs font-semibold text-white">Filter by subject</span>
                    </span>
                    {subjectOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-white/[0.04] px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1 mb-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] rounded-md text-slate-400 hover:text-white"
                      onClick={onSelectAllSubjects}
                    >
                      All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] rounded-md text-slate-400 hover:text-white"
                      onClick={onClearAllSubjects}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {DOUBT_FLAIRS.map((flair) => {
                      const color = SUBJECT_COLORS[flair.toLowerCase()];
                      return (
                        <label
                          key={flair}
                          className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white/[0.03] rounded px-1.5 py-1 text-slate-400 hover:text-white transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={subjectFilters.includes(flair)}
                            onChange={() => onToggleSubject(flair)}
                            className="rounded"
                          />
                          {color && <span className={`w-2 h-2 rounded-full ${color.dot} shrink-0`} />}
                          <span className="flex-1">{flair}</span>
                          <span className="text-slate-600 text-[10px] tabular-nums">
                            {subjectCounts[flair] ?? 0}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Sort & view */}
          <Collapsible open={sortOpen} onOpenChange={setSortOpen}>
            <div className="rounded-xl border border-white/[0.06] bg-[#070c18]/60 backdrop-blur-md shadow-xl shadow-black/40 overflow-hidden transition-all duration-200 hover:border-white/[0.1]">
              <CollapsibleTrigger asChild>
                <button type="button" className="w-full text-left px-3 py-2.5 group">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Filter className="w-3.5 h-3.5 text-[#378ADD]/80" />
                      <span className="text-xs font-semibold text-white">Sort &amp; view</span>
                    </span>
                    {sortOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-white/[0.04] px-3 py-2.5">
                  <div className="flex flex-col gap-0.5">
                    {sortOptions.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        className={`text-left text-xs py-1.5 px-2 rounded-md w-full transition-all duration-150 ${
                          sort === s.value
                            ? "bg-[#5B9A85]/12 text-[#A8D5C5] font-semibold"
                            : "text-slate-400 hover:bg-white/[0.03] hover:text-white"
                        }`}
                        onClick={() => onSetSort(s.value)}
                      >
                        {s.label}
                      </button>
                    ))}
                    <label className="flex items-center gap-2 text-xs cursor-pointer px-2 py-1.5 text-slate-400 hover:bg-white/[0.03] hover:text-white rounded-md mt-1 transition-all duration-150">
                      <input
                        type="checkbox"
                        checked={unansweredOnly}
                        onChange={(e) => onSetUnansweredOnly(e.target.checked)}
                        className="rounded"
                      />
                      Unanswered only
                    </label>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Daily Gyan inline slot */}
          {dailyGyanSlot && (
            <div className="mt-auto pt-1">
              {dailyGyanSlot}
            </div>
          )}
        </TooltipProvider>
      </div>
    </aside>
  );
}
