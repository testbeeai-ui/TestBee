"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { LearningBuddyPanel } from "@/components/refer-earn/LearningBuddyPanel";
import { LearningBuddyMobileSheet } from "@/components/refer-earn/LearningBuddyMobileSheet";
import { cn } from "@/lib/utils";

/** Matches `lg:grid-cols-2` on Earn & Learn — below this, layout is single column. */
const DESKTOP_TWO_COLUMN_MQ = "(min-width: 1024px)";

function useEarnLearnDesktopLayout(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_TWO_COLUMN_MQ);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

type EarnLearnRightColumnProps = {
  showLearningBuddy: boolean;
  onBackToChallenges: () => void;
  children: ReactNode;
  className?: string;
};

/**
 * Desktop (lg+): Learning Buddy slides down over the challenges column (GSAP).
 * Mobile / stacked: challenges stay visible; Learning Buddy opens as a full-screen popup.
 */
export function EarnLearnRightColumn({
  showLearningBuddy,
  onBackToChallenges,
  children,
  className,
}: EarnLearnRightColumnProps) {
  const isDesktopLayout = useEarnLearnDesktopLayout();
  const showDesktopBuddy = showLearningBuddy && isDesktopLayout;
  const showMobilePopup = showLearningBuddy && !isDesktopLayout;

  const shellRef = useRef<HTMLElement>(null);
  const challengesRef = useRef<HTMLDivElement>(null);
  const buddyRef = useRef<HTMLDivElement>(null);
  const prevShowRef = useRef(showDesktopBuddy);

  useLayoutEffect(() => {
    if (!isDesktopLayout) {
      const challenges = challengesRef.current;
      const buddy = buddyRef.current;
      if (challenges) {
        gsap.set(challenges, {
          clearProps: "all",
          visibility: "visible",
          pointerEvents: "auto",
          opacity: 1,
        });
      }
      if (buddy) {
        gsap.set(buddy, { display: "none", visibility: "hidden", pointerEvents: "none" });
      }
      return;
    }

    const challenges = challengesRef.current;
    const buddy = buddyRef.current;
    if (!challenges || !buddy) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const wasShowing = prevShowRef.current;
    prevShowRef.current = showDesktopBuddy;

    gsap.killTweensOf([challenges, buddy]);

    if (reducedMotion) {
      gsap.set(challenges, {
        yPercent: 0,
        opacity: showDesktopBuddy ? 0 : 1,
        display: showDesktopBuddy ? "none" : "block",
        visibility: showDesktopBuddy ? "hidden" : "visible",
        pointerEvents: showDesktopBuddy ? "none" : "auto",
      });
      gsap.set(buddy, {
        yPercent: 0,
        opacity: showDesktopBuddy ? 1 : 0,
        visibility: showDesktopBuddy ? "visible" : "hidden",
        pointerEvents: showDesktopBuddy ? "auto" : "none",
        display: showDesktopBuddy ? "flex" : "none",
      });
      return;
    }

    if (showDesktopBuddy && !wasShowing) {
      gsap.set(buddy, { display: "flex", visibility: "visible", pointerEvents: "auto" });
      gsap.set(challenges, { visibility: "visible", pointerEvents: "auto" });
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo(
        buddy,
        { yPercent: -105, opacity: 0.35 },
        { yPercent: 0, opacity: 1, duration: 0.62 },
        0
      ).to(
        challenges,
        { yPercent: 12, opacity: 0, duration: 0.42, ease: "power2.in" },
        0.08
      );
      tl.set(challenges, {
        display: "none",
        visibility: "hidden",
        pointerEvents: "none",
      });
      return;
    }

    if (!showDesktopBuddy && wasShowing) {
      gsap.set(challenges, {
        display: "block",
        visibility: "visible",
        pointerEvents: "auto",
      });
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo(
        challenges,
        { yPercent: 12, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.48 },
        0
      ).to(
        buddy,
        { yPercent: -105, opacity: 0, duration: 0.45, ease: "power2.in" },
        0.06
      );
      tl.set(buddy, { display: "none", visibility: "hidden", pointerEvents: "none" });
      return;
    }

    if (showDesktopBuddy) {
      gsap.set(buddy, {
        display: "flex",
        visibility: "visible",
        pointerEvents: "auto",
        yPercent: 0,
        opacity: 1,
      });
      gsap.set(challenges, {
        display: "none",
        visibility: "hidden",
        pointerEvents: "none",
        yPercent: 0,
        opacity: 0,
      });
    } else {
      gsap.set(challenges, {
        display: "block",
        visibility: "visible",
        pointerEvents: "auto",
        yPercent: 0,
        opacity: 1,
      });
      gsap.set(buddy, {
        display: "none",
        visibility: "hidden",
        pointerEvents: "none",
        yPercent: -105,
        opacity: 0,
      });
    }
  }, [showDesktopBuddy, isDesktopLayout]);

  return (
    <>
      <section
        ref={shellRef}
        className={cn(
          "relative overflow-hidden rounded-[14px] border shadow-[0_24px_60px_rgba(8,6,24,0.45)]",
          showDesktopBuddy ? "min-h-[min(72vh,640px)] p-0" : "p-4",
          className
        )}
        style={{ background: "var(--re-card)", borderColor: "var(--re-border)" }}
      >
        <div
          ref={challengesRef}
          className={cn(
            "relative z-0 will-change-transform",
            showDesktopBuddy && "lg:!hidden"
          )}
          aria-hidden={showDesktopBuddy}
        >
          {children}
        </div>

        {/* Desktop only — full-bleed slide-over; opaque so challenges never show through */}
        <div
          ref={buddyRef}
          className={cn(
            "absolute inset-0 z-10 hidden min-h-full w-full flex-col overflow-hidden will-change-transform lg:flex",
            "bg-[var(--re-card)]"
          )}
          style={{ display: "none", visibility: "hidden" }}
          aria-hidden={!showDesktopBuddy}
        >
          <div className="flex h-full min-h-full w-full flex-1 flex-col overflow-y-auto overscroll-contain rounded-[14px] bg-gradient-to-br from-cyan-500/20 via-fuchsia-500/15 to-amber-400/20 p-[1.5px] shadow-[0_0_40px_rgba(34,211,238,0.1)]">
            <LearningBuddyPanel
              onBackToChallenges={onBackToChallenges}
              className="min-h-full flex-1"
            />
          </div>
        </div>
      </section>

      <LearningBuddyMobileSheet
        open={showMobilePopup}
        onOpenChange={(open) => {
          if (!open) onBackToChallenges();
        }}
      />
    </>
  );
}
