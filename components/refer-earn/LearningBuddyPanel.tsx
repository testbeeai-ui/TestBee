"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LEARNING_BUDDY_ADVANCED_PATH } from "@/lib/buddy/learningBuddyRoutes";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchBuddyState,
  type BuddyPendingInvite,
  type BuddyProfile,
  withBuddyRdm,
} from "@/lib/buddy/buddyClient";
import { LearningBuddyDashboard } from "./learning-buddy/LearningBuddyDashboard";
import { LearningBuddyEmptyState } from "./learning-buddy/LearningBuddyEmptyState";

type LearningBuddyPanelProps = {
  onBackToChallenges: () => void;
  className?: string;
};

type PanelState =
  | { phase: "loading" }
  | { phase: "signed_out" }
  | { phase: "error"; message: string }
  | { phase: "empty"; pendingInvites: BuddyPendingInvite[] }
  | { phase: "connected"; buddy: BuddyProfile };

/** Learning Buddy surface — empty state (invite) vs connected state (dashboard). */
export function LearningBuddyPanel({ onBackToChallenges, className }: LearningBuddyPanelProps) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<PanelState>({ phase: "loading" });

  const refresh = useCallback(async () => {
    if (!user) {
      setState({ phase: "signed_out" });
      return;
    }
    try {
      const result = await fetchBuddyState();
      const primary = result.buddy ?? result.buddies[0] ?? null;
      if (primary) {
        setState({ phase: "connected", buddy: withBuddyRdm(primary) });
      } else {
        setState({ phase: "empty", pendingInvites: result.pendingInvites });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't load buddy state.";
      setState({ phase: "error", message });
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  return (
    <div
      className={cn(
        "flex min-h-full w-full flex-col rounded-[11px] bg-gradient-to-br from-[#071318] via-[#0d0a1c] to-[#14100a] px-4 py-3.5 sm:px-5 sm:py-4",
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2.5 border-b border-white/[0.08] pb-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onBackToChallenges}
          aria-label="Back to challenges"
          className="h-9 w-9 shrink-0 rounded-full border border-white/12 bg-white/[0.04] text-slate-300 hover:border-cyan-500/35 hover:bg-cyan-500/10 hover:text-cyan-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/40 via-fuchsia-500/35 to-amber-400/30 ring-1 ring-cyan-400/30">
            <Users className="h-[18px] w-[18px] text-cyan-50" />
          </span>
          <div className="min-w-0">
            <h2
              className={cn(
                "truncate text-base font-bold leading-tight sm:text-[17px]",
                "bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-amber-200 bg-clip-text text-transparent"
              )}
            >
              Learning Buddy
            </h2>
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-400/85">
              Study together · earn together
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 rounded-full border-fuchsia-400/35 bg-fuchsia-500/10 px-3.5 text-xs font-bold text-fuchsia-100 hover:border-fuchsia-400/55 hover:bg-fuchsia-500/20"
          asChild
        >
          <Link href={LEARNING_BUDDY_ADVANCED_PATH}>Advanced</Link>
        </Button>
      </div>

      {authLoading || state.phase === "loading" ? (
        <div className="grid gap-2">
          <div className="h-[60px] animate-pulse rounded-[10px] bg-white/[0.04]" />
          <div className="h-[100px] animate-pulse rounded-[10px] bg-white/[0.04]" />
        </div>
      ) : null}

      {state.phase === "signed_out" ? (
        <div className="rounded-[10px] border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5 text-[12px] text-amber-200">
          Sign in to pair a study buddy.
        </div>
      ) : null}

      {state.phase === "error" ? (
        <div className="rounded-[10px] border border-rose-500/30 bg-rose-500/[0.07] px-3 py-2.5 text-[12px] text-rose-200">
          {state.message}
        </div>
      ) : null}

      {state.phase === "empty" ? (
        <LearningBuddyEmptyState
          pendingInvites={state.pendingInvites}
          onChange={() => void refresh()}
        />
      ) : null}

      {state.phase === "connected" ? (
        <LearningBuddyDashboard
          buddy={state.buddy}
          onChange={() => void refresh()}
        />
      ) : null}
    </div>
  );
}
