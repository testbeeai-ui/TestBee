"use client";

import { useState } from "react";
import { Coins, Gift, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { claimOnboardingReward } from "@/lib/subscription/onboardingRewardApi";
import {
  armDailyChecklistAfterOnboardingClaim,
  markOnboardingRewardClaimedLocally,
  prepareOnboardingRewardClaim,
} from "@/lib/subscription/freeTrialClient";
const ONBOARDING_TASK_LABELS: Record<string, string> = {
  magic_wall: "Magic Wall",
  lessons: "Lessons",
  prep_classes: "Classes",
  prep_mcq: "Prep + Mock",
  gyan_plus: "Gyan++",
  earn_buddy: "Earn & Learn · Buddy",
  earn_challenge: "Earn & Learn · Challenge",
  news_blog: "News & Blogs",
  edufund: "EduFund",
  profile: "Profile",
};

function formatIncompleteTasks(ids: string[]): string {
  return ids.map((id) => ONBOARDING_TASK_LABELS[id] ?? id).join(", ");
}

type OnboardingRewardClaimDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rewardRdm: number;
};

export function OnboardingRewardClaimDialog({
  open,
  onOpenChange,
  rewardRdm,
}: OnboardingRewardClaimDialogProps) {
  const { refreshProfile } = useAuth();
  const { toast } = useToast();
  const [claiming, setClaiming] = useState(false);
  const [claimPhase, setClaimPhase] = useState<"sync" | "claim" | null>(null);

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    setClaimPhase("sync");
    try {
      const prep = await prepareOnboardingRewardClaim();
      setClaimPhase("claim");
      if (!prep.ready) {
        const missing =
          prep.incompleteTaskIds.length > 0 ? formatIncompleteTasks(prep.incompleteTaskIds) : null;
        toast({
          title: "Checklist not ready to claim",
          description: missing
            ? prep.syncError === "trial_not_activated"
              ? `Your free trial is not activated on the server yet. Refresh the page, complete activation, then claim again. Missing: ${missing}.`
              : `These tasks are not saved on your account yet: ${missing}. Open the site tour, complete them, then claim again.`
            : prep.syncError === "trial_not_activated"
              ? "Your free trial is not activated on the server yet. Refresh the page and try again."
              : "Your progress is still syncing. Wait a few seconds and try again.",
          variant: "destructive",
        });
        return;
      }

      const result = await claimOnboardingReward();
      if (!result.ok) {
        toast({
          title: "Could not claim reward",
          description:
            result.error === "checklist_incomplete"
              ? "Your account still shows unfinished checklist tasks. Open the site tour from the dashboard, complete any remaining tasks, then claim again."
              : (result.error ?? "Please try again in a moment."),
          variant: "destructive",
        });
        return;
      }
      armDailyChecklistAfterOnboardingClaim();
      markOnboardingRewardClaimedLocally();
      await refreshProfile();
      onOpenChange(false);
      toast({
        title: result.alreadyClaimed ? "Already claimed" : "Reward claimed! 🎉",
        description: result.alreadyClaimed
          ? "Your onboarding reward was already credited."
          : `${result.amount} RDM added to your wallet.`,
        className:
          "border-2 border-emerald-500 bg-[#090f1e]/95 text-white shadow-xl shadow-emerald-950/40",
        duration: 6000,
      });
    } catch {
      toast({
        title: "Could not claim reward",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setClaiming(false);
      setClaimPhase(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          "flex w-full max-w-md flex-col gap-0 overflow-hidden border border-emerald-500/25 bg-[#0a0f18] p-0 " +
          "shadow-2xl shadow-emerald-950/40 ring-1 ring-white/10 sm:rounded-2xl " +
          "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        }
      >
        <div className="relative shrink-0 border-b border-white/10 bg-gradient-to-br from-emerald-500/20 via-violet-500/10 to-amber-500/10 px-6 pb-5 pt-7 text-center">
          <DialogHeader className="space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-400/50 bg-emerald-500/15">
              <Gift className="h-8 w-8 text-emerald-300" aria-hidden />
            </div>
            <DialogTitle className="text-xl font-bold text-white sm:text-2xl">
              Claim your {rewardRdm} RDM
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-slate-400">
              You finished every onboarding step. Tap below to credit{" "}
              <span className="font-semibold text-emerald-300">{rewardRdm} RDM</span> to your
              wallet.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
            <Coins className="h-5 w-5 shrink-0 text-amber-300" aria-hidden />
            <p className="text-left text-xs leading-relaxed text-amber-100/90">
              Use your RDM toward EduFund grants, mock tests, and other rewards across EduBlast.
            </p>
          </div>
          <Button
            type="button"
            disabled={claiming}
            onClick={() => void handleClaim()}
            className="h-11 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-base font-bold text-white hover:from-emerald-400 hover:to-emerald-500"
          >
            <Sparkles className="mr-2 h-4 w-4" aria-hidden />
            {claiming
              ? claimPhase === "sync"
                ? "Syncing progress…"
                : "Claiming…"
              : `Claim ${rewardRdm} RDM`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
