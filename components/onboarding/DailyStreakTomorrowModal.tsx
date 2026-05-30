"use client";

import { Clock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type DailyStreakTomorrowModalProps = {
  open: boolean;
  trialDayNumber: number;
  onClose: () => void;
};

/** Global "come back tomorrow" overlay after Day 2–10 daily checklist is fully done. */
export function DailyStreakTomorrowModal({
  open,
  trialDayNumber,
  onClose,
}: DailyStreakTomorrowModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        hideClose
        overlayClassName="z-[200]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="z-[201] w-[min(calc(100vw-2rem),380px)] border border-emerald-500/20 bg-[radial-gradient(circle_at_top_left,#121A2A,#0A0F1A)] p-0 text-zinc-100 shadow-[0_30px_70px_rgba(0,0,0,0.9),0_0_50px_rgba(16,185,129,0.06)] sm:rounded-2xl"
      >
        <DialogTitle className="sr-only">Daily streak day complete</DialogTitle>
        <DialogDescription className="sr-only">
          Come back tomorrow after 9 AM for the next daily tasks.
        </DialogDescription>
        <div className="relative px-6 py-7 text-center">
          <button
            type="button"
            aria-label="Close"
            className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-400 hover:text-white"
            onClick={onClose}
          >
            ×
          </button>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10">
            <Clock className="h-7 w-7 animate-pulse text-amber-400" />
          </div>
          <h2 className="text-lg font-bold text-white">Day {trialDayNumber} complete! 🔥</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Your daily streak RDM is credited.{" "}
            {trialDayNumber >= 10 ? (
              <>
                You finished all <strong className="text-emerald-400">10 streak days</strong> —
                watch for your bonus trial extension and ONE Month FREE reward.
              </>
            ) : (
              <>
                Come back <strong className="text-violet-400">tomorrow after 9:00 AM</strong> for
                Day {trialDayNumber + 1} tasks.
              </>
            )}
          </p>
          <p className="mt-4 text-xs leading-relaxed text-zinc-500">
            Keep your streak alive to unlock an{" "}
            <strong className="text-emerald-400">additional 2-week FREE trial</strong> and a{" "}
            <strong className="text-violet-400">ONE Month FREE</strong> bonus.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
