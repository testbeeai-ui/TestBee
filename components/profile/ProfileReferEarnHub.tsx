"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Gift, Trophy, Flame, Copy, Share2, Users, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ReferTab = "tiers" | "leaderboard" | "streak";

interface ProfileReferEarnHubProps {
  userId: string;
  displayName: string;
  rdm: number;
}

const REWARD_TIERS = [
  { referrals: 1, reward: 25, title: "Starter reward" },
  { referrals: 3, reward: 100, title: "Momentum boost" },
  { referrals: 5, reward: 220, title: "Power inviter" },
  { referrals: 10, reward: 500, title: "Campus ambassador" },
] as const;

const LEADERBOARD_SAMPLE = [
  { rank: 1, name: "Aarav", invites: 22, reward: 1100 },
  { rank: 2, name: "Diya", invites: 18, reward: 860 },
  { rank: 3, name: "Rohan", invites: 15, reward: 740 },
  { rank: 4, name: "You", invites: 9, reward: 420 },
  { rank: 5, name: "Meera", invites: 8, reward: 390 },
] as const;

const STREAK_BONUS = [
  { day: "Day 1", reward: 10 },
  { day: "Day 2", reward: 15 },
  { day: "Day 3", reward: 20 },
  { day: "Day 4", reward: 30 },
  { day: "Day 5", reward: 40 },
  { day: "Day 6", reward: 55 },
  { day: "Day 7", reward: 80 },
] as const;

export default function ProfileReferEarnHub({ userId, displayName, rdm }: ProfileReferEarnHubProps) {
  const [tab, setTab] = useState<ReferTab>("tiers");
  const { toast } = useToast();

  const inviteLink = useMemo(() => {
    if (typeof window === "undefined") return `https://edublast.app/invite/${userId}`;
    return `${window.location.origin}/invite/${userId}`;
  }, [userId]);

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast({
        title: "Invite link copied",
        description: "Share it with friends to earn referral rewards.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Please copy the link manually.",
        variant: "destructive",
      });
    }
  };

  const activeTierIndex = Math.min(Math.floor(LEADERBOARD_SAMPLE[3]!.invites / 3), REWARD_TIERS.length - 1);
  const nextTier = REWARD_TIERS[Math.min(activeTierIndex + 1, REWARD_TIERS.length - 1)];
  const invitesToNext = Math.max(nextTier.referrals - LEADERBOARD_SAMPLE[3]!.invites, 0);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-card to-violet-500/10 p-5 dark:border-emerald-300/20 dark:from-emerald-500/10 dark:via-slate-950/90 dark:to-violet-500/10"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
            Top Priority · Refer & Earn
          </div>
          <h3 className="mt-3 text-2xl font-black text-foreground dark:text-white">Grow your rewards with friend invites</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground dark:text-slate-300">
            Invite classmates, unlock tier rewards, climb the weekly board, and keep your streak bonus alive.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-200">RDM Wallet</p>
            <p className="text-xl font-black text-amber-100">{rdm}</p>
          </div>
          <div className="rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-200">Weekly Rank</p>
            <p className="text-xl font-black text-violet-100">#{LEADERBOARD_SAMPLE[3]!.rank}</p>
          </div>
          <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-center col-span-2 sm:col-span-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-cyan-200">Invite Streak</p>
            <p className="text-xl font-black text-cyan-100">6 days</p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border/70 bg-background/70 p-3 dark:border-white/10 dark:bg-slate-900/70">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invite link</p>
            <p className="truncate text-sm font-bold text-foreground dark:text-slate-100">{inviteLink}</p>
            <p className="text-xs text-muted-foreground dark:text-slate-400">
              {invitesToNext > 0
                ? `${invitesToNext} more invite${invitesToNext === 1 ? "" : "s"} to unlock your next tier reward.`
                : "You have unlocked the highest tier. Keep inviting to stay on top."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={copyInviteLink}
              className="rounded-xl border-border bg-muted text-foreground hover:bg-muted/80 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <Copy className="mr-2 h-4 w-4" /> Copy link
            </Button>
            <Button className="rounded-xl bg-emerald-500 text-white hover:bg-emerald-600">
              <Share2 className="mr-2 h-4 w-4" /> Share invite
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={tab === "tiers" ? "default" : "outline"}
          onClick={() => setTab("tiers")}
          className="rounded-xl"
        >
          <Gift className="mr-2 h-4 w-4" /> Reward Tiers
        </Button>
        <Button
          type="button"
          variant={tab === "leaderboard" ? "default" : "outline"}
          onClick={() => setTab("leaderboard")}
          className="rounded-xl"
        >
          <Trophy className="mr-2 h-4 w-4" /> Leaderboard
        </Button>
        <Button
          type="button"
          variant={tab === "streak" ? "default" : "outline"}
          onClick={() => setTab("streak")}
          className="rounded-xl"
        >
          <Flame className="mr-2 h-4 w-4" /> Streak Bonus
        </Button>
      </div>

      {tab === "tiers" ? (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {REWARD_TIERS.map((tier, idx) => {
            const unlocked = LEADERBOARD_SAMPLE[3]!.invites >= tier.referrals;
            const isNext = !unlocked && idx === activeTierIndex + 1;
            return (
              <div
                key={tier.referrals}
                className={`rounded-xl border p-4 ${
                  unlocked
                    ? "border-emerald-400/40 bg-emerald-500/10"
                    : isNext
                    ? "border-violet-400/40 bg-violet-500/10"
                    : "border-border bg-muted/40 dark:border-white/10 dark:bg-slate-900/70"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tier.title}</p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-lg font-black text-foreground dark:text-white">{tier.referrals} invites</p>
                  <p className="text-sm font-extrabold text-amber-300">+{tier.reward} RDM</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {unlocked ? "Unlocked" : isNext ? "Next target" : "Locked"}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}

      {tab === "leaderboard" ? (
        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3 dark:border-white/10 dark:bg-slate-900/70">
          <div className="space-y-2">
            {LEADERBOARD_SAMPLE.map((row) => {
              const isYou = row.name === "You";
              return (
                <div
                  key={row.rank}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                    isYou
                      ? "border-violet-400/40 bg-violet-500/15"
                      : "border-border/70 bg-background/80 dark:border-white/10 dark:bg-slate-950/80"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-7 text-center text-sm font-black text-muted-foreground">#{row.rank}</span>
                    <p className="font-bold text-foreground dark:text-white">{isYou ? displayName : row.name}</p>
                    {row.rank <= 3 ? <Crown className="h-3.5 w-3.5 text-amber-300" /> : null}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-foreground dark:text-slate-100">{row.invites} invites</p>
                    <p className="text-xs text-muted-foreground">+{row.reward} RDM</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {tab === "streak" ? (
        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4 dark:border-white/10 dark:bg-slate-900/70">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {STREAK_BONUS.map((step, i) => {
              const active = i < 6;
              return (
                <div
                  key={step.day}
                  className={`rounded-lg border px-3 py-2 text-center ${
                    active
                      ? "border-cyan-400/40 bg-cyan-500/10"
                      : "border-border/70 bg-background/80 dark:border-white/10 dark:bg-slate-950/70"
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{step.day}</p>
                  <p className="mt-1 text-sm font-black text-foreground dark:text-white">+{step.reward}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground">RDM</p>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
            <Users className="h-4 w-4 text-cyan-300" />
            Keep your daily invite streak to unlock bonus multipliers every week.
          </div>
        </div>
      ) : null}
    </motion.section>
  );
}

