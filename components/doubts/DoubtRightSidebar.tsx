"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Coins, HelpCircle, Trophy, Plus, GraduationCap } from "lucide-react";
import { UserHoverCard } from "@/components/UserHoverCard";
import { getSubjectColor } from "./doubtTypes";

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
  // Stats
  todayCount: number;
  aiGeneratedCount: number;
  teacherTaggedCount: number;
  userRdmToday: number;
  // Panels
  bountyBoard: SimpleDoubtRow[];
  trending: SimpleDoubtRow[];
  topContributors: TopContributor[];
  topTeachers: TopTeacher[];
  onAskClick: () => void;
}

export default function DoubtRightSidebar({
  todayCount, aiGeneratedCount, teacherTaggedCount, userRdmToday,
  bountyBoard, trending, topContributors, topTeachers, onAskClick,
}: DoubtRightSidebarProps) {
  return (
    <aside className="lg:col-span-3 order-3 min-w-0 max-w-full">
      <div className="lg:sticky lg:top-4 space-y-3">

        {/* Stats grid */}
        <div className="edu-card p-3 rounded-2xl">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <p className="text-xs text-muted-foreground">Wall posts today</p>
              <p className="text-lg font-extrabold text-foreground tabular-nums">{todayCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">AI-generated</p>
              <p className="text-lg font-extrabold text-muted-foreground tabular-nums">{aiGeneratedCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Teacher tagged</p>
              <p className="text-lg font-extrabold text-foreground tabular-nums">{teacherTaggedCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Your RDM today</p>
              <p className="text-lg font-extrabold text-edu-orange tabular-nums">+{userRdmToday}</p>
            </div>
          </div>
        </div>

        {/* Bounty Board */}
        <div className="edu-card p-3 rounded-2xl min-w-0">
          <h3 className="font-bold text-foreground mb-1 flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-edu-orange shrink-0" /> Bounty board
            {bountyBoard.length > 0
              ? <span className="text-[10px] font-normal normal-case bg-emerald-500/20 text-emerald-600 px-1.5 py-0.5 rounded ml-1">Live</span>
              : <span className="text-[10px] font-normal normal-case bg-muted text-muted-foreground px-1.5 py-0.5 rounded ml-1">No data</span>}
          </h3>
          <ul className="space-y-1.5 mt-1.5">
            {bountyBoard.slice(0, 4).map((d) => (
              <li key={d.id}>
                <Link href={`/doubts/${d.id}`} className="flex items-start gap-1 text-[13px] text-foreground hover:text-primary group">
                  <span className="text-edu-orange font-bold shrink-0">+{d.bounty_rdm ?? 0}</span>
                  <span className="group-hover:underline line-clamp-1">{d.title}</span>
                </Link>
              </li>
            ))}
            {bountyBoard.length === 0 && (
              <li className="text-sm text-muted-foreground">No active bounty posts yet.</li>
            )}
          </ul>
        </div>

        {/* Top teachers this week */}
        {topTeachers.length > 0 && (
          <div className="edu-card p-3 rounded-2xl min-w-0">
            <h3 className="font-bold text-foreground mb-2 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-blue-500 shrink-0" /> Top teachers this week
            </h3>
            <ul className="space-y-2">
              {topTeachers.slice(0, 3).map((t) => {
                const sc = getSubjectColor(t.subject ?? null);
                return (
                  <li key={t.user_id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-7 w-7 rounded-full shrink-0">
                        <AvatarImage src={t.avatar_url ?? undefined} />
                        <AvatarFallback className="rounded-full text-xs font-bold bg-blue-500 text-white">{t.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.answerCount} answers</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-edu-orange font-bold text-sm">+{t.rdmEarned}</p>
                      {t.subject && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sc.bg} ${sc.text}`}>{t.subject.slice(0, 4)}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Trending topics */}
        <div className="edu-card p-3 rounded-2xl min-w-0">
          <h3 className="font-bold text-foreground mb-2 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-primary shrink-0" /> Trending topics
            {trending.length > 0
              ? <span className="text-[10px] font-normal normal-case bg-emerald-500/20 text-emerald-600 px-1.5 py-0.5 rounded ml-1">Live</span>
              : <span className="text-[10px] font-normal normal-case bg-muted text-muted-foreground px-1.5 py-0.5 rounded ml-1">No data</span>}
          </h3>
          <ul className="space-y-1.5">
            {trending.slice(0, 4).map((d, i) => {
              const sc = getSubjectColor(d.subject ?? null);
              return (
                <li key={d.id} className="flex items-start gap-1.5">
                  <span className="text-xs font-bold text-muted-foreground w-4 shrink-0 mt-0.5">{i + 1}</span>
                  <Link href={`/doubts/${d.id}`} className="flex-1 min-w-0 text-[13px] text-foreground hover:text-primary hover:underline flex items-center gap-1 flex-wrap">
                    <span className="line-clamp-1">{d.title}</span>
                    {d.subject && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${sc.bg} ${sc.text}`}>
                        {d.subject.slice(0, 4)}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
            {trending.length === 0 && (
              <li className="text-sm text-muted-foreground">No trending posts in the last 7 days.</li>
            )}
          </ul>
        </div>

        {/* Top helpers */}
        <div className="edu-card p-3 rounded-2xl min-w-0">
          <h3 className="font-bold text-foreground mb-2 flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-edu-orange shrink-0" /> Top helpers
            {topContributors.length > 0
              ? <span className="text-[10px] font-normal normal-case bg-emerald-500/20 text-emerald-600 px-1.5 py-0.5 rounded ml-1">Live</span>
              : <span className="text-[10px] font-normal normal-case bg-muted text-muted-foreground px-1.5 py-0.5 rounded ml-1">No data</span>}
          </h3>
          <ul className="space-y-2">
            {topContributors.map((c) => (
              <li key={c.user_id} className="flex items-center justify-between gap-2">
                <UserHoverCard userId={c.user_id}>
                  <div className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80 transition-opacity">
                    <Avatar className="h-7 w-7 rounded-full shrink-0">
                      <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
                      <AvatarFallback className="rounded-full text-xs font-bold">{(c.profiles?.name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.profiles?.name ?? "Someone"}</p>
                    </div>
                  </div>
                </UserHoverCard>
                <span className="text-edu-orange font-bold text-sm shrink-0">+{c.total} RDM</span>
              </li>
            ))}
            {topContributors.length === 0 && (
              <li className="text-sm text-muted-foreground">No accepted-answer payouts this week yet.</li>
            )}
          </ul>
        </div>

        {/* Post CTA */}
        <Button className="w-full rounded-2xl h-11 font-bold text-sm bg-edu-orange hover:bg-edu-orange/90 text-white border-0" onClick={onAskClick}>
          <Plus className="w-4 h-4 mr-1.5" /> Post (+5 RDM)
        </Button>

      </div>
    </aside>
  );
}
