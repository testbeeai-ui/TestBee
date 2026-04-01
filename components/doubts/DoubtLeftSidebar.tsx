"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Coins, FileQuestion, MessageCircle, Info, Filter, BookMarked, Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import {
  DOUBT_FLAIRS,
  SUBJECT_COLORS,
  rankFromLifetime,
  rdmToNextRank,
  type ProfileRow,
  type SortOption,
  type ActivityView,
} from "./doubtTypes";

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
  aiGeneratedCount: number;
  unansweredOnly: boolean;
  onToggleSubject: (flair: string) => void;
  onSelectAllSubjects: () => void;
  onClearAllSubjects: () => void;
  onSetActivityView: (v: ActivityView) => void;
  onSetSort: (s: SortOption) => void;
  onSetUnansweredOnly: (v: boolean) => void;
}

export default function DoubtLeftSidebar({
  profile, strikeRate, subjectFilters, subjectCounts,
  activityView, sort, filteredCount, askedCount, answeredCount, savedCount, aiGeneratedCount, unansweredOnly,
  onToggleSubject, onSelectAllSubjects, onClearAllSubjects, onSetActivityView, onSetSort, onSetUnansweredOnly,
}: DoubtLeftSidebarProps) {
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const lifetime = profile?.lifetime_answer_rdm ?? 0;
  const rank = rankFromLifetime(lifetime);
  const nextRank = rdmToNextRank(lifetime);

  const activityItems: { key: ActivityView; label: string; count: number; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "feed", label: "All doubts", count: filteredCount, icon: FileQuestion },
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
    <aside className="lg:col-span-3 order-2 lg:order-1 min-w-0">
      <div className="lg:sticky lg:top-4 space-y-4">
        <TooltipProvider>
          {/* Profile card */}
          <div className="edu-card p-4 rounded-2xl">
            <div className="flex items-center gap-3 mb-2">
              <Avatar className="h-12 w-12 rounded-xl shrink-0">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="rounded-xl">{(profile?.name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-foreground truncate">{profile?.name ?? "You"}</p>
                <p className="flex items-center gap-1 text-sm text-edu-orange font-semibold">
                  <Coins className="w-4 h-4 shrink-0" /> {profile?.rdm ?? 0} RDM
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
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
                  <span className="text-emerald-600 font-medium">{rank}</span>
                  {nextRank && <span>{nextRank}</span>}
                </p>
              </div>
            </div>
          </div>

          {/* My Activity */}
          <div className="edu-card p-4 rounded-2xl">
            <p className="text-sm font-bold text-foreground mb-2">My activity</p>
            <div className="flex flex-col gap-0.5">
              {activityItems.map((item) => {
                const Icon = item.icon;
                const active = activityView === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`text-left text-sm py-1.5 px-2 rounded-lg flex items-center justify-between w-full ${active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"}`}
                    onClick={() => onSetActivityView(item.key)}
                  >
                    <span className="flex items-center gap-1.5">
                      <Icon className={`w-4 h-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      {item.label}
                    </span>
                    <span className={`tabular-nums ${active ? "text-primary font-medium" : "text-muted-foreground"}`}>{item.count}</span>
                  </button>
                );
              })}
              {/* AI-generated Qs (coming soon) */}
              <button
                type="button"
                className="text-left text-sm py-1.5 px-2 rounded-lg flex items-center justify-between w-full text-muted-foreground hover:bg-muted opacity-60 cursor-default"
                disabled
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 shrink-0 text-muted-foreground" />
                  AI-generated Qs
                  <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full ml-1">Soon</span>
                </span>
                <span className="tabular-nums text-muted-foreground">{aiGeneratedCount}</span>
              </button>
            </div>
          </div>

          {/* Filter by subject */}
          <Collapsible open={subjectOpen} onOpenChange={setSubjectOpen} className="edu-card rounded-2xl">
            <div className="p-4">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between text-left rounded-lg hover:bg-muted/40 px-1.5 py-1 -mx-1.5"
                >
                  <p className="text-sm font-bold text-foreground">Filter by subject</p>
                  {subjectOpen ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <div />
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="sm" className="h-6 text-xs rounded-lg" onClick={onSelectAllSubjects}>All</Button>
                    <Button type="button" variant="ghost" size="sm" className="h-6 text-xs rounded-lg" onClick={onClearAllSubjects}>Clear</Button>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {DOUBT_FLAIRS.map((flair) => {
                    const color = SUBJECT_COLORS[flair.toLowerCase()];
                    return (
                      <label key={flair} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1.5 py-1 -mx-1.5">
                        <input type="checkbox" checked={subjectFilters.includes(flair)} onChange={() => onToggleSubject(flair)} className="rounded" />
                        {color && <span className={`w-2 h-2 rounded-full ${color.dot} shrink-0`} />}
                        <span className="flex-1">{flair}</span>
                        <span className="text-muted-foreground text-xs tabular-nums">{subjectCounts[flair] ?? 0}</span>
                      </label>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Sort & view */}
          <Collapsible open={sortOpen} onOpenChange={setSortOpen} className="edu-card rounded-2xl">
            <div className="p-4">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between text-left rounded-lg hover:bg-muted/40 px-1.5 py-1 -mx-1.5"
                >
                  <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Filter className="w-4 h-4" /> Sort &amp; view
                  </p>
                  {sortOpen ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-col gap-0.5">
                  {sortOptions.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      className={`text-left text-sm py-1.5 px-2 rounded-lg w-full ${sort === s.value ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"}`}
                      onClick={() => onSetSort(s.value)}
                    >
                      {s.label}
                    </button>
                  ))}
                  <label className="flex items-center gap-2 text-sm cursor-pointer px-2 py-1.5 text-muted-foreground hover:bg-muted rounded-lg mt-1">
                    <input type="checkbox" checked={unansweredOnly} onChange={(e) => onSetUnansweredOnly(e.target.checked)} className="rounded" />
                    Unanswered only
                  </label>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </TooltipProvider>
      </div>
    </aside>
  );
}
