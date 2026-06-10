"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, Plus, GraduationCap, Flame, Users, MessageSquare, Bot, Coins } from "lucide-react";
import { UserHoverCard } from "@/components/UserHoverCard";
import { getSubjectColor } from "./doubtTypes";
import {
  gyanAskBtnClass,
  gyanAskBtnRdmClass,
  gyanRdmTextClass,
  gyanSectionCardClass,
  gyanSidebarRightClass,
  gyanStatValueBlue,
  gyanStatValuePurple,
  gyanStatValueRose,
  gyanStatValueSage,
  gyanTeachersCardClass,
  gyanWallFontClass,
} from "./gyanWallStyles";
import { cn } from "@/lib/utils";

type SimpleDoubtRow = {
  id: string;
  title: string;
  bounty_rdm?: number;
  views?: number;
  subject?: string | null;
};

interface TopContributor {
  user_id: string;
  total: number;
  profiles: { name: string; avatar_url: string | null } | null;
}

interface TopTeacher {
  user_id: string;
  name: string;
  avatar_url: string | null;
  answerCount: number;
  rdmEarned: number;
  subject?: string | null;
}

interface DoubtRightSidebarProps {
  todayCount: number;
  aiGeneratedCount: number;
  teacherTaggedCount: number;
  userRdmToday: number;
  trending: SimpleDoubtRow[];
  topContributors: TopContributor[];
  topTeachers: TopTeacher[];
  onAskClick: () => void;
  postRewardRdm?: number;
  wallTabKey: string;
}

function teacherSubjectClass(subject: string | null | undefined): string {
  const s = (subject ?? "").toLowerCase();
  if (s.includes("phys")) return "border border-[#85B7EB]/25 bg-[#85B7EB]/10 text-[#85B7EB]";
  if (s.includes("math")) return "border border-[#AFA9EC]/25 bg-[#AFA9EC]/10 text-[#AFA9EC]";
  const sc = getSubjectColor(subject ?? null);
  return `${sc.bg} ${sc.text}`;
}

export default function DoubtRightSidebar({
  todayCount,
  aiGeneratedCount,
  teacherTaggedCount,
  userRdmToday,
  trending,
  topContributors,
  topTeachers,
  onAskClick,
  postRewardRdm = 5,
  wallTabKey,
}: DoubtRightSidebarProps) {
  const [trendingOpen, setTrendingOpen] = useState(false);
  const [helpersOpen, setHelpersOpen] = useState(false);

  useEffect(() => {
    setTrendingOpen(false);
    setHelpersOpen(false);
  }, [wallTabKey]);

  return (
    <aside className="order-3 min-w-0 flex flex-col">
      <div
        className={cn(
          "flex flex-col gap-2.5 min-h-0 lg:sticky lg:top-[var(--app-header-sticky-offset)] lg:max-h-[calc(100dvh-var(--app-header-sticky-offset))] lg:overflow-y-auto py-3.5 px-3",
          gyanSidebarRightClass,
          gyanWallFontClass
        )}
      >
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="relative rounded-xl border border-[#389e78]/12 bg-[#389e78]/4 p-3 hover:border-[#389e78]/30 hover:bg-[#389e78]/8 transition-all duration-200">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Posts</span>
              <MessageSquare className="w-3.5 h-3.5 text-[#389e78]" />
            </div>
            <p className={`text-2xl font-extrabold tabular-nums mt-1.5 ${gyanStatValueSage}`}>{todayCount}</p>
          </div>

          <div className="relative rounded-xl border border-[#AFA9EC]/12 bg-[#AFA9EC]/4 p-3 hover:border-[#AFA9EC]/30 hover:bg-[#AFA9EC]/8 transition-all duration-200">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Posts</span>
              <Bot className="w-3.5 h-3.5 text-[#AFA9EC]" />
            </div>
            <p className={`text-2xl font-extrabold tabular-nums mt-1.5 ${gyanStatValuePurple}`}>
              {aiGeneratedCount}
            </p>
          </div>

          <div className="relative rounded-xl border border-[#8EB8E8]/12 bg-[#8EB8E8]/4 p-3 hover:border-[#8EB8E8]/30 hover:bg-[#8EB8E8]/8 transition-all duration-200">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Teacher</span>
              <GraduationCap className="w-3.5 h-3.5 text-[#8EB8E8]" />
            </div>
            <p className={`text-2xl font-extrabold tabular-nums mt-1.5 ${gyanStatValueBlue}`}>
              {teacherTaggedCount}
            </p>
          </div>

          <div className="relative rounded-xl border border-[#D4A0AC]/12 bg-[#D4A0AC]/4 p-3 hover:border-[#D4A0AC]/30 hover:bg-[#D4A0AC]/8 transition-all duration-200">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">RDM Today</span>
              <Coins className="w-3.5 h-3.5 text-[#D4A0AC]" />
            </div>
            <p className={`text-2xl font-extrabold tabular-nums mt-1.5 ${gyanStatValueRose}`}>
              +{userRdmToday}
            </p>
          </div>
        </div>

        {/* Top teachers this week */}
        {topTeachers.length > 0 && (
          <div className={gyanTeachersCardClass}>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-slate-500 shrink-0" /> Top teachers this week
            </h3>
            <ul className="space-y-1">
              {topTeachers.slice(0, 3).map((t) => (
                <li
                  key={t.user_id}
                  className="flex items-center gap-2.5 py-2 px-1 rounded-lg hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] last:border-b-0"
                >
                  <Avatar className="h-7 w-7 rounded-full shrink-0 ring-2 ring-white/5 hover:ring-[#389e78]/30 transition-all">
                    <AvatarImage src={t.avatar_url ?? undefined} />
                    <AvatarFallback className="rounded-full text-[11px] font-bold bg-[#121c2e] text-[#8EB8E8]">
                      {t.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[#f8fafc]">{t.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{t.answerCount} answers</p>
                  </div>
                  {t.subject && (
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider ${teacherSubjectClass(t.subject)}`}
                    >
                      {t.subject.slice(0, 4)}
                    </span>
                  )}
                  <span className={cn("text-[11px] font-bold shrink-0 text-slate-300", gyanRdmTextClass)}>
                    +{t.rdmEarned}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Trending topics */}
        <Collapsible open={trendingOpen} onOpenChange={setTrendingOpen}>
          <div className="rounded-xl border border-white/[0.06] bg-[#070c18]/60 backdrop-blur-md shadow-xl shadow-black/40 overflow-hidden transition-all duration-200 hover:border-white/[0.1]">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full text-left px-3.5 py-3 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-3.5 h-3.5 text-[#D48A9A] shrink-0" />
                    <span className="text-xs font-semibold text-white">Trending topics</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform duration-200 ${trendingOpen ? "rotate-90" : ""}`} />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 ml-5.5">
                  {trending.length > 0
                    ? `${trending.length} topics active now`
                    : "No trending posts yet"}
                </p>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-white/[0.04] px-3.5 py-2.5">
                <ul className="space-y-1.5">
                  {trending.slice(0, 5).map((d, i) => {
                    const sc = getSubjectColor(d.subject ?? null);
                    return (
                      <li key={d.id} className="flex items-start gap-2">
                        <span className="text-[10px] font-bold text-slate-600 w-4 shrink-0 mt-0.5 tabular-nums">
                          {i + 1}
                        </span>
                        <Link
                          href={`/doubts/${d.id}`}
                          className="flex-1 min-w-0 text-xs text-slate-300 hover:text-white hover:underline flex items-center gap-1.5 flex-wrap transition-colors"
                          onClick={() => setTrendingOpen(false)}
                        >
                          <span className="line-clamp-1">{d.title}</span>
                          {d.subject && (
                            <span
                              className={`text-[10px] font-medium px-1.5 py-px rounded-full shrink-0 ${sc.bg} ${sc.text}`}
                            >
                              {d.subject.slice(0, 4)}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Top helpers */}
        <Collapsible open={helpersOpen} onOpenChange={setHelpersOpen}>
          <div className="rounded-xl border border-white/[0.06] bg-[#070c18]/60 backdrop-blur-md shadow-xl shadow-black/40 overflow-hidden transition-all duration-200 hover:border-white/[0.1]">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full text-left px-3.5 py-3 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-[#A8D5C5] shrink-0" />
                    <span className="text-xs font-semibold text-white">Top helpers</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform duration-200 ${helpersOpen ? "rotate-90" : ""}`} />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 ml-5.5">
                  See who&apos;s helping most
                </p>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-white/[0.04] px-3.5 py-2.5">
                <ul className="space-y-2">
                  {topContributors.slice(0, 5).map((c) => (
                    <li key={c.user_id} className="flex items-center justify-between gap-2">
                      <UserHoverCard userId={c.user_id}>
                        <div className="flex items-center gap-2 min-w-0 cursor-pointer group/item">
                          <Avatar className="h-6 w-6 rounded-full shrink-0 ring-1 ring-white/5">
                            <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
                            <AvatarFallback className="rounded-full text-[10px] font-bold bg-[#121c2e] text-[#8EB8E8]">
                              {(c.profiles?.name ?? "?").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <p className="truncate text-xs font-medium text-slate-300 group-hover/item:text-white transition-colors">
                            {c.profiles?.name ?? "Someone"}
                          </p>
                        </div>
                      </UserHoverCard>
                      <span className={cn("font-semibold text-xs shrink-0", gyanRdmTextClass)}>
                        +{c.total} RDM
                      </span>
                    </li>
                  ))}
                  {topContributors.length === 0 && (
                    <li className="text-xs text-slate-500">No accepted-answer payouts this week yet.</li>
                  )}
                </ul>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        <button type="button" className={gyanAskBtnClass} onClick={onAskClick}>
          <Plus className="w-4 h-4" /> Ask{" "}
          <span className={gyanAskBtnRdmClass}>(+{postRewardRdm} RDM)</span>
        </button>
      </div>
    </aside>
  );
}
