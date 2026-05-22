"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { LearningBuddyPanel } from "@/components/refer-earn/LearningBuddyPanel";
import { cn } from "@/lib/utils";

type LearningBuddyMobileSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Full-screen Learning Buddy on stacked/mobile Earn & Learn layout (< lg). */
export function LearningBuddyMobileSheet({ open, onOpenChange }: LearningBuddyMobileSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el || !open) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.killTweensOf(el);
    if (reducedMotion) {
      gsap.set(el, { y: 0, opacity: 1 });
      return;
    }
    gsap.fromTo(
      el,
      { y: "-18%", opacity: 0.4 },
      { y: 0, opacity: 1, duration: 0.55, ease: "power3.out" }
    );
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[200]"
        hideClose
        className={cn(
          "z-[200] flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden",
          "left-0 top-0 translate-x-0 translate-y-0 rounded-none border-0 p-0",
          "bg-[#070714]",
          "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          "data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0",
          "data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0",
          "data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100"
        )}
      >
        <DialogTitle className="sr-only">Learning Buddy</DialogTitle>
        <DialogDescription className="sr-only">
          Learning Buddy program on Earn and Learn
        </DialogDescription>
        <div
          ref={panelRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <div className="mx-auto w-full max-w-lg rounded-[14px] bg-gradient-to-br from-cyan-500/25 via-fuchsia-500/20 to-amber-400/25 p-[1.5px] sm:max-w-none">
            <LearningBuddyPanel onBackToChallenges={() => onOpenChange(false)} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
