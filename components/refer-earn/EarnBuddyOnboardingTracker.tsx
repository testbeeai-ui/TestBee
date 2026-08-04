"use client";

import { useEffect } from "react";
import { ONBOARDING_ACTIVE_TASK_CHANGED_EVENT } from "@/lib/onboarding/onboardingTaskCompanion";
import {
  applyEarnBuddyOnboardingServerStatus,
  isEarnBuddyCompanionTrackingActive,
  markEarnBuddyCompanionTabOpened,
  reconcileEarnBuddyCompanionSteps,
} from "@/lib/onboarding/earnBuddyCompanionOnboarding";
import { fetchEarnBuddyOnboardingStatus } from "@/lib/onboarding/earnBuddyCompanionApi";
import { startVisiblePoll } from "@/lib/telemetry/visiblePoll";

type EarnBuddyOnboardingTrackerProps = {
  /** Learning Buddy tab is visible. */
  active: boolean;
  /** Optional fast path from GET /api/buddy/state. */
  hasInvitedBuddyJoined?: boolean;
};

export function EarnBuddyOnboardingTracker({
  active,
  hasInvitedBuddyJoined,
}: EarnBuddyOnboardingTrackerProps) {
  useEffect(() => {
    if (!active) return;
    if (!isEarnBuddyCompanionTrackingActive()) return;

    markEarnBuddyCompanionTabOpened();
    window.dispatchEvent(
      new CustomEvent(ONBOARDING_ACTIVE_TASK_CHANGED_EVENT, { detail: "earn_buddy" })
    );

    const sync = () => {
      if (typeof hasInvitedBuddyJoined === "boolean") {
        reconcileEarnBuddyCompanionSteps(hasInvitedBuddyJoined);
      }
      void fetchEarnBuddyOnboardingStatus().then(applyEarnBuddyOnboardingServerStatus);
    };

    sync();
    return startVisiblePoll({ intervalMs: 12_000, onTick: sync });
  }, [active, hasInvitedBuddyJoined]);

  return null;
}
