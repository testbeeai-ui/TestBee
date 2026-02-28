"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import type { PublicProfile } from "@/lib/publicProfileService";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  GraduationCap,
  Medal,
  Zap,
  BookOpen,
  Trophy,
  HelpCircle,
  MessageSquare,
  CheckCircle2,
  Target,
  ShieldCheck,
  ShieldQuestion,
  ShieldAlert,
  Flame,
  Star,
  Calendar,
} from "lucide-react";

const RANK_COLORS: Record<string, string> = {
  Novice: "bg-muted text-muted-foreground",
  Scholar: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  Expert: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  Master: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

const SUBJECT_BAR_COLORS: Record<string, string> = {
  physics: "bg-blue-500",
  chemistry: "bg-purple-500",
  math: "bg-orange-500",
  biology: "bg-green-500",
};

const LEVEL_COLORS: Record<string, string> = {
  School: "bg-muted text-muted-foreground",
  District: "bg-blue-500/15 text-blue-600",
  State: "bg-green-500/15 text-green-600",
  National: "bg-purple-500/15 text-purple-600",
  International: "bg-amber-500/15 text-amber-600",
};

const VERIFICATION_ICONS = {
  verified: ShieldCheck,
  pending: ShieldQuestion,
  unverified: ShieldAlert,
};

const VERIFICATION_COLORS = {
  verified: "text-edu-green",
  pending: "text-amber-500",
  unverified: "text-muted-foreground",
};

export default function PublicProfilePage() {
  const params = useParams();
  const id = params?.id as string;
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/public-profile/${id}`, { credentials: "include", cache: "no-store" })
      .then((res) => res.json())
      .then((p: PublicProfile | null) => (p && typeof p === "object" && "id" in p ? (p as PublicProfile) : null))
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !id) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="max-w-3xl mx-auto py-12 text-center">
            <div className="animate-pulse space-y-6">
              <div className="h-24 w-24 rounded-2xl bg-muted mx-auto" />
              <div className="h-8 w-48 bg-muted rounded mx-auto" />
              <div className="h-4 w-32 bg-muted rounded mx-auto" />
            </div>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  const displayProfile: PublicProfile = profile ?? {
    id: id ?? "",
    name: "Student",
    initials: "S",
    avatarColor: "bg-muted",
    avatarUrl: null,
    bio: "No marks",
    rdm: 0,
    rank: "Novice" as const, // displays as "—" when placeholder via UI
    memberSince: "—",
    questionsAsked: 0,
    answersGiven: 0,
    acceptedAnswers: 0,
    strikeRate: 0,
    subjectStats: { physics: 0, chemistry: 0, math: 0, biology: 0 },
    rdmFromDoubts: 0,
    bountiesWon: 0,
    streakDays: 0,
    badges: [] as string[],
    recentDoubts: [] as { id: string; title: string }[],
    recentAnswers: [] as { id: string; doubtId: string; title: string }[],
    nextRankRdm: 100,
    academics: [] as { exam: string; board: string; score: string; verified: "verified" | "pending" | "unverified" }[],
    achievements: [] as { name: string; level: "School" | "District" | "State" | "National" | "International"; year: number; result: string }[],
    rdmBreakdown: {
      answersGiven: 0,
      acceptedBonus: 0,
      mockTests: 0,
      streakBonus: 0,
      bountiesWon: 0,
      doubtsAsked: 0,
    },
  };

  const rdmMax = Math.max(
    displayProfile.rdmBreakdown.answersGiven,
    displayProfile.rdmBreakdown.acceptedBonus,
    displayProfile.rdmBreakdown.mockTests,
    displayProfile.rdmBreakdown.streakBonus,
    displayProfile.rdmBreakdown.bountiesWon,
    displayProfile.rdmBreakdown.doubtsAsked,
    1
  );
  const subjectMax = Math.max(
    displayProfile.subjectStats.physics,
    displayProfile.subjectStats.chemistry,
    displayProfile.subjectStats.math,
    displayProfile.subjectStats.biology,
    1
  );
  const rankProgress = displayProfile.nextRankRdm > 0 ? (displayProfile.rdm / displayProfile.nextRankRdm) * 100 : 0;

  return (
    <ProtectedRoute>
      <AppLayout>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto space-y-6"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Button variant="ghost" size="sm" className="rounded-full font-extrabold -ml-1" asChild>
              <Link href="/doubts">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Link>
            </Button>
            {!profile && (
              <div className="px-3 py-2 rounded-lg bg-muted/80 border border-dashed border-muted-foreground/30">
                <p className="text-sm font-medium text-muted-foreground">Profile not found</p>
              </div>
            )}
          </div>

          {/* 1. Header */}
          <div className="edu-card p-6 rounded-2xl">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <Avatar className="h-20 w-20 rounded-2xl">
                <AvatarImage src={displayProfile.avatarUrl ?? undefined} />
                <AvatarFallback className={`rounded-2xl ${displayProfile.avatarColor} text-white text-2xl font-bold`}>
                  {displayProfile.initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-center sm:text-left flex-1">
                <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                  <h1 className="text-2xl font-display font-bold text-foreground">{displayProfile.name}</h1>
                  <span className={`edu-chip font-bold ${RANK_COLORS[displayProfile.rank] ?? RANK_COLORS.Novice}`}>
                    {!profile ? "—" : displayProfile.rank}
                  </span>
                </div>
                {displayProfile.bio && (
                  <p className="text-sm text-muted-foreground mt-1">{displayProfile.bio}</p>
                )}
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
                  <span className="flex items-center gap-1 font-bold text-edu-orange">
                    <Star className="w-4 h-4 shrink-0" /> {displayProfile.rdm} RDM
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="w-4 h-4 shrink-0" /> Since {displayProfile.memberSince}
                  </span>
                  {displayProfile.streakDays > 0 && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Flame className="w-4 h-4 text-edu-orange shrink-0" /> {displayProfile.streakDays}-day streak
                    </span>
                  )}
                </div>
                {displayProfile.badges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {displayProfile.badges.map((b) => (
                      <span key={b} className="edu-chip bg-edu-orange/15 text-edu-orange text-xs">
                        {b}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: HelpCircle, label: "Questions Asked", value: displayProfile.questionsAsked },
              { icon: MessageSquare, label: "Answers Given", value: displayProfile.answersGiven },
              { icon: CheckCircle2, label: "Accepted Answers", value: displayProfile.acceptedAnswers },
              { icon: Target, label: "Strike Rate", value: `${displayProfile.strikeRate}%` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="edu-card p-4 rounded-2xl text-center">
                <Icon className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-xl font-extrabold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
              </div>
            ))}
          </div>

          {/* 3. Academic Record */}
          <div className="edu-card p-6 rounded-2xl">
            <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
              <GraduationCap className="w-5 h-5 text-primary" /> Academic Record
            </h3>
            <div className="space-y-3">
              {displayProfile.academics.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">{!profile ? "No marks" : "No records yet"}</p>
              ) : displayProfile.academics.map((a, i) => {
                const Icon = VERIFICATION_ICONS[a.verified];
                const colorClass = VERIFICATION_COLORS[a.verified];
                return (
                  <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0">
                    <div>
                      <p className="font-semibold text-foreground">{a.exam} — {a.board}</p>
                      <p className="text-sm text-muted-foreground">{a.score}</p>
                    </div>
                    <span className={`flex items-center gap-1 text-xs font-medium capitalize ${colorClass}`}>
                      <Icon className="w-4 h-4" /> {a.verified}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Achievements */}
          <div className="edu-card p-6 rounded-2xl">
            <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-primary" /> Achievements & Competitions
            </h3>
            <div className="space-y-3">
              {displayProfile.achievements.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">{!profile ? "No achievements" : "No achievements yet"}</p>
              ) : displayProfile.achievements.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0">
                  <p className="font-semibold text-foreground">{a.name}</p>
                  <div className="flex items-center gap-2">
                    <span className={`edu-chip text-[10px] font-bold ${LEVEL_COLORS[a.level] ?? "bg-muted"}`}>
                      {a.level}
                    </span>
                    <span className="text-sm text-muted-foreground">{a.year} — {a.result}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5. RDM Score Breakdown */}
          <div className="edu-card p-6 rounded-2xl">
            <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-primary" /> RDM Score Breakdown
            </h3>
            <div className="space-y-3">
              {[
                { key: "answersGiven", label: "Answers Given", value: displayProfile.rdmBreakdown.answersGiven, color: "bg-purple-500" },
                { key: "acceptedBonus", label: "Accepted Bonus", value: displayProfile.rdmBreakdown.acceptedBonus, color: "bg-blue-500" },
                { key: "mockTests", label: "Mock Tests", value: displayProfile.rdmBreakdown.mockTests, color: "bg-green-500" },
                { key: "streakBonus", label: "Streak Bonus", value: displayProfile.rdmBreakdown.streakBonus, color: "bg-orange-500" },
                { key: "bountiesWon", label: "Bounties Won", value: displayProfile.rdmBreakdown.bountiesWon, color: "bg-amber-500" },
                { key: "doubtsAsked", label: "Doubts Asked", value: displayProfile.rdmBreakdown.doubtsAsked, color: "bg-muted" },
              ].map(({ key, label, value, color }) => (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-muted-foreground">{label}</span>
                    <span className="font-bold text-foreground">{value}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color}`}
                      style={{ width: `${(value / rdmMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm font-bold text-foreground mt-4 text-right">
              Total: {displayProfile.rdm} RDM
            </p>
          </div>

          {/* 6. Subject Breakdown */}
          <div className="edu-card p-6 rounded-2xl">
            <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-primary" /> Subject Breakdown
            </h3>
            <div className="space-y-3">
              {(["physics", "chemistry", "math", "biology"] as const).map((sub) => {
                const val = displayProfile.subjectStats[sub];
                const pct = (val / subjectMax) * 100;
                return (
                  <div key={sub}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-muted-foreground capitalize">{sub}</span>
                      <span className="font-bold text-foreground">{val}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${SUBJECT_BAR_COLORS[sub] ?? "bg-muted"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Total answers across subjects: {displayProfile.subjectStats.physics + displayProfile.subjectStats.chemistry + displayProfile.subjectStats.math + displayProfile.subjectStats.biology}
            </p>
          </div>

          {/* 7. Reputation */}
          <div className="edu-card p-6 rounded-2xl">
            <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-primary" /> Reputation
            </h3>
            <div className="flex flex-wrap gap-4 mb-4">
              <span className="font-bold text-foreground">{displayProfile.rdmFromDoubts} RDM from Doubts</span>
              <span className="font-bold text-foreground">{displayProfile.bountiesWon} Bounties Won</span>
              <span className="font-bold text-foreground">{displayProfile.streakDays}d Active Streak</span>
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Rank progress to next level</p>
            <Progress value={Math.min(100, rankProgress)} className="h-3" />
            <p className="text-sm text-muted-foreground mt-1">
              {displayProfile.rdm}/{displayProfile.nextRankRdm} RDM
            </p>
          </div>

          {/* 8. Recent Activity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="edu-card p-6 rounded-2xl">
              <h3 className="font-bold text-foreground mb-3">Recent Doubts</h3>
              <ul className="space-y-2">
                {displayProfile.recentDoubts.length === 0 ? (
                  <li className="text-sm text-muted-foreground">None yet</li>
                ) : (
                  displayProfile.recentDoubts.map((d) => (
                    <li key={d.id}>
                      <Link href={`/doubts/${d.id}`} className="text-sm text-primary hover:underline line-clamp-2">
                        {d.title}
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="edu-card p-6 rounded-2xl">
              <h3 className="font-bold text-foreground mb-3">Recent Answers</h3>
              <ul className="space-y-2">
                {displayProfile.recentAnswers.length === 0 ? (
                  <li className="text-sm text-muted-foreground">None yet</li>
                ) : (
                  displayProfile.recentAnswers.map((a) => (
                    <li key={a.id}>
                      <Link href={`/doubts/${a.doubtId}`} className="text-sm text-primary hover:underline line-clamp-2">
                        {a.title}
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </motion.div>
      </AppLayout>
    </ProtectedRoute>
  );
}
