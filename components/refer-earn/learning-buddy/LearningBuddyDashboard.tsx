"use client";

import { useState } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useBuddyDashboardLive } from "@/hooks/useBuddyDashboardLive";
import {
  endBuddyPair,
  normalizeBuddyRdm,
  type BuddyProfile,
  withBuddyRdm,
} from "@/lib/buddy/buddyClient";
import { ChatButton } from "./widgets/ChatButton";
import { GyanRecentCard } from "./widgets/GyanRecentCard";
import { McqRecentCard } from "./widgets/McqRecentCard";
import { PlayArenaCard } from "./widgets/PlayArenaCard";
import { RightNowCard } from "./widgets/RightNowCard";
import { SubtopicCard } from "./widgets/SubtopicCard";

type LearningBuddyDashboardProps = {
  buddy: BuddyProfile;
  onChange: () => void;
  className?: string;
};

function buddyInitial(name: string | null): string {
  if (!name) return "B";
  const trimmed = name.trim();
  if (!trimmed) return "B";
  return trimmed.charAt(0).toUpperCase();
}

function BuddyPresenceDot({ live, className }: { live: boolean; className?: string }) {
  return (
    <span
      className={cn("relative inline-flex h-2.5 w-2.5 shrink-0", className)}
      title={live ? "Online now" : "Not live"}
      aria-label={live ? "Buddy is live" : "Buddy is offline"}
    >
      {live ? (
        <>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.65)] ring-2 ring-emerald-400/30" />
        </>
      ) : (
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-slate-500 ring-2 ring-slate-600/90" />
      )}
    </span>
  );
}

export function LearningBuddyDashboard({
  buddy,
  onChange,
  className,
}: LearningBuddyDashboardProps) {
  const { toast } = useToast();
  const { data, error, refresh } = useBuddyDashboardLive(buddy);
  const displayBuddy = withBuddyRdm(data?.buddy ?? buddy);
  const buddyLive = Boolean(data?.buddyOnline);
  const [unbuddyOpen, setUnbuddyOpen] = useState(false);
  const [unbuddying, setUnbuddying] = useState(false);

  const handleUnbuddy = async () => {
    setUnbuddying(true);
    try {
      await endBuddyPair(buddy.id);
      toast({ title: "Buddy ended", description: "You can invite a new buddy anytime." });
      onChange();
    } catch (err) {
      toast({
        title: "Couldn't end pair",
        description: err instanceof Error ? err.message : "Try again later.",
        variant: "destructive",
      });
    } finally {
      setUnbuddying(false);
      setUnbuddyOpen(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex items-center gap-2.5 rounded-[10px] border border-white/10 bg-white/[0.025] px-2.5 py-2">
        <span
          className={cn(
            "relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/40 via-fuchsia-500/35 to-amber-400/30 text-[12px] font-bold text-cyan-50",
            buddyLive
              ? "ring-2 ring-emerald-400/45 ring-offset-1 ring-offset-[#0a0a12]"
              : "ring-1 ring-white/15"
          )}
        >
          {buddyInitial(displayBuddy.name)}
          <BuddyPresenceDot
            live={buddyLive}
            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 ring-2 ring-[#0a0a12]"
          />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-[13px] font-semibold leading-tight text-slate-100">
              {displayBuddy.name ?? "Your study buddy"}
            </p>
            {buddyLive ? (
              <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-400">
                Live
              </span>
            ) : (
              <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Away
              </span>
            )}
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
              {displayBuddy.classLevel ? `Class ${displayBuddy.classLevel}` : "Active buddy"}
            </span>
            <span
              className="shrink-0 rounded-md border border-amber-400/45 bg-gradient-to-r from-amber-500/25 to-orange-500/15 px-2.5 py-0.5 text-[10px] font-bold tabular-nums tracking-wide text-amber-50 shadow-[0_0_14px_rgba(251,191,36,0.18)]"
              title="Total RDM balance"
            >
              {normalizeBuddyRdm(displayBuddy.rdm).toLocaleString("en-IN")} RDM
            </span>
          </div>
        </div>
        {unbuddyOpen ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-md px-2 text-[10.5px] text-slate-300"
              onClick={() => setUnbuddyOpen(false)}
              disabled={unbuddying}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 rounded-md bg-rose-500 px-2 text-[10.5px] font-bold text-rose-950 hover:bg-rose-400"
              onClick={() => void handleUnbuddy()}
              disabled={unbuddying}
            >
              {unbuddying ? "Ending…" : "Confirm"}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refresh()}
              title="Refresh buddy activity"
              className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-500 hover:text-cyan-300"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setUnbuddyOpen(true)}
              className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-500 hover:text-rose-300"
            >
              <LogOut className="h-3 w-3" />
              Unbuddy
            </button>
          </div>
        )}
      </div>

      {error ? (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
          {error}
        </div>
      ) : !data ? (
        <div className="grid gap-2">
          <div className="h-[60px] animate-pulse rounded-[10px] bg-white/[0.04]" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-[110px] animate-pulse rounded-[10px] bg-white/[0.04]" />
            <div className="h-[110px] animate-pulse rounded-[10px] bg-white/[0.04]" />
            <div className="h-[110px] animate-pulse rounded-[10px] bg-white/[0.04]" />
            <div className="h-[110px] animate-pulse rounded-[10px] bg-white/[0.04]" />
          </div>
        </div>
      ) : (
        <>
          <RightNowCard rightNow={data.rightNow} buddyOnline={buddyLive} />
          <div className="grid grid-cols-2 gap-2">
            <GyanRecentCard rows={data.gyanRecent} />
            <SubtopicCard data={data.subtopic} />
            <PlayArenaCard data={data.playArena} />
            <McqRecentCard rows={data.mcqRecent} />
          </div>
          <ChatButton buddyName={buddy.name} />
        </>
      )}
    </div>
  );
}
