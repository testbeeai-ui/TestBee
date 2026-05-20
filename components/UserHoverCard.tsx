"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { PublicProfile } from "@/lib/profile/publicProfileService";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  HelpCircle,
  MessageSquare,
  CheckCircle2,
  Zap,
  ChevronRight,
  Flame,
} from "lucide-react";

const SUBJECT_COLORS: Record<string, string> = {
  physics: "bg-blue-500",
  chemistry: "bg-purple-500",
  math: "bg-orange-500",
};

interface UserHoverCardProps {
  userId: string;
  children: React.ReactNode;
  displayName?: string;
}

export function UserHoverCard({ userId, children, displayName }: UserHoverCardProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const loadProfile = useCallback(async () => {
    if (fetched || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/public-profile/${userId}`, {
        credentials: "include",
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const p = (await res.json()) as PublicProfile | null;
      if (res.ok && p && typeof p === "object" && "id" in p) setProfile(p as PublicProfile);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [userId, fetched, loading]);

  return (
    <HoverCard openDelay={300} closeDelay={100} onOpenChange={(open) => open && loadProfile()}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent align="start" className="w-[340px] p-0 overflow-hidden rounded-xl">
        {loading ? (
          <div className="p-5 space-y-4 animate-pulse">
            <div className="flex gap-3">
              <div className="w-12 h-12 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-3 w-32 bg-muted rounded" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-muted rounded-lg" />
              ))}
            </div>
            <div className="h-4 w-full bg-muted rounded" />
          </div>
        ) : profile ? (
          <div className="p-4 space-y-4">
            <div className="flex gap-3">
              <Avatar className="h-12 w-12 rounded-xl">
                <AvatarImage src={profile.avatarUrl ?? undefined} />
                <AvatarFallback
                  className={`rounded-xl ${profile.avatarColor} text-white text-sm font-bold`}
                >
                  {profile.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground truncate">{profile.name}</span>
                </div>
                {profile.bio && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{profile.bio}</p>
                )}
                <p className="text-sm font-bold text-edu-orange mt-1">{profile.rdm} RDM</p>
                <p className="text-[11px] text-muted-foreground">Since {profile.memberSince}</p>
                {(profile.streakDays > 0 || profile.rdmFromDoubts > 0) && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    {profile.streakDays > 0 && (
                      <>
                        <Flame className="w-3 h-3 text-edu-orange shrink-0" />
                        {profile.streakDays}-day streak
                        {profile.rdmFromDoubts > 0 && " · "}
                      </>
                    )}
                    {profile.rdmFromDoubts > 0 && `${profile.rdmFromDoubts} RDM from doubts`}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-lg bg-muted/60 p-2 text-center">
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-0.5" />
                <span className="text-xs font-bold text-foreground block">
                  {profile.questionsAsked}
                </span>
                <span className="text-[10px] text-muted-foreground">Asked</span>
              </div>
              <div className="rounded-lg bg-muted/60 p-2 text-center">
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-0.5" />
                <span className="text-xs font-bold text-foreground block">
                  {profile.answersGiven}
                </span>
                <span className="text-[10px] text-muted-foreground">Answered</span>
              </div>
              <div className="rounded-lg bg-muted/60 p-2 text-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-0.5" />
                <span className="text-xs font-bold text-foreground block">
                  {profile.acceptedAnswers}
                </span>
                <span className="text-[10px] text-muted-foreground">Accepted</span>
              </div>
              <div className="rounded-lg bg-muted/60 p-2 text-center">
                <Zap className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-0.5" />
                <span className="text-xs font-bold text-foreground block">
                  {profile.strikeRate}%
                </span>
                <span className="text-[10px] text-muted-foreground">Strike</span>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Subject Breakdown
              </p>
              <div className="space-y-1.5">
                {(["physics", "chemistry", "math"] as const).map((sub) => {
                  const val = profile.subjectStats[sub] || 0;
                  const max = Math.max(
                    profile.subjectStats.physics,
                    profile.subjectStats.chemistry,
                    profile.subjectStats.math,
                    1
                  );
                  const pct = max > 0 ? (val / max) * 100 : 0;
                  return (
                    <div key={sub} className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-muted-foreground w-16 capitalize">
                        {sub}
                      </span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${SUBJECT_COLORS[sub] ?? "bg-muted"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-foreground w-6 text-right">
                        {val}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {(profile.recentDoubts.length > 0 || profile.recentAnswers.length > 0) && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Recent Doubts
                  </p>
                  <ul className="space-y-0.5">
                    {profile.recentDoubts.slice(0, 2).map((d) => (
                      <li key={d.id}>
                        <Link
                          href={`/doubts/${d.id}`}
                          className="text-[11px] text-primary hover:underline line-clamp-1"
                        >
                          {d.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Recent Answers
                  </p>
                  <ul className="space-y-0.5">
                    {profile.recentAnswers.slice(0, 2).map((a) => (
                      <li key={a.id}>
                        <Link
                          href={`/doubts/${a.doubtId}`}
                          className="text-[11px] text-primary hover:underline line-clamp-1"
                        >
                          {a.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <Link
              href={`/user/${profile.id}`}
              className="flex items-center justify-center gap-1 w-full py-2 rounded-lg bg-primary/10 text-primary text-sm font-bold hover:bg-primary/20 transition-colors"
            >
              View Full Profile <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="px-2 py-1.5 rounded-lg bg-muted/60 border border-dashed border-muted-foreground/30">
              <p className="text-[11px] font-semibold text-muted-foreground">Profile not found</p>
            </div>
            <div className="flex gap-3">
              <Avatar className="h-12 w-12 rounded-xl bg-muted">
                <AvatarFallback className="rounded-xl text-muted-foreground text-sm font-bold">
                  S
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground truncate">Student</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">No profile data</p>
                <p className="text-sm font-bold text-edu-orange mt-1">0 RDM</p>
                <p className="text-[11px] text-muted-foreground">No marks</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-lg bg-muted/60 p-2 text-center">
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-0.5" />
                <span className="text-xs font-bold text-foreground block">0</span>
                <span className="text-[10px] text-muted-foreground">Asked</span>
              </div>
              <div className="rounded-lg bg-muted/60 p-2 text-center">
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-0.5" />
                <span className="text-xs font-bold text-foreground block">0</span>
                <span className="text-[10px] text-muted-foreground">Answered</span>
              </div>
              <div className="rounded-lg bg-muted/60 p-2 text-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-0.5" />
                <span className="text-xs font-bold text-foreground block">0</span>
                <span className="text-[10px] text-muted-foreground">Accepted</span>
              </div>
              <div className="rounded-lg bg-muted/60 p-2 text-center">
                <Zap className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-0.5" />
                <span className="text-xs font-bold text-foreground block">0%</span>
                <span className="text-[10px] text-muted-foreground">Strike</span>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Subject Breakdown
              </p>
              <div className="space-y-1.5">
                {(["physics", "chemistry", "math"] as const).map((sub) => (
                  <div key={sub} className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-muted-foreground w-16 capitalize">
                      {sub}
                    </span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full w-0 rounded-full bg-muted" />
                    </div>
                    <span className="text-[10px] font-bold text-foreground w-6 text-right">0</span>
                  </div>
                ))}
              </div>
            </div>

            <Link
              href={`/user/${userId}`}
              className="flex items-center justify-center gap-1 w-full py-2 rounded-lg bg-primary/10 text-primary text-sm font-bold hover:bg-primary/20 transition-colors"
            >
              View profile <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
