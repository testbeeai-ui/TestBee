"use client";

import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  ONBOARDING_PROGRESS_EVENT,
  ONBOARDING_SYNC_FAILED_EVENT,
  ONBOARDING_TASK_TOAST_LINES,
  buildOnboardingRewardChecklistToast,
  getChecklistRewardRdm,
  getFreeTrialActivated,
  hydrateFreeTrialRdmAmounts,
  isOnboardingSiteTourClaimedLocally,
  type OnboardingProgressEventDetail,
  type OnboardingSyncFailedDetail,
} from "@/lib/subscription/freeTrialClient";
import { fetchOnboardingRewardState } from "@/lib/subscription/onboardingRewardApi";
import {
  clearPendingOnboardingProgressSyncs,
  ensureOnboardingProgressSyncRetryListeners,
  flushPendingOnboardingProgressSyncs,
} from "@/lib/onboarding/onboardingProgressSyncQueue";

export function OnboardingRewardToastListener() {
  const { toast } = useToast();

  useEffect(() => {
    ensureOnboardingProgressSyncRetryListeners();
    void fetchOnboardingRewardState().then((state) => {
      hydrateFreeTrialRdmAmounts({
        checklistRewardRdm: state.checklistRewardRdm,
      });
    });
    if (isOnboardingSiteTourClaimedLocally()) {
      clearPendingOnboardingProgressSyncs();
    } else {
      void flushPendingOnboardingProgressSyncs();
    }
  }, []);

  useEffect(() => {
    const onProgress = (event: Event) => {
      const detail = (event as CustomEvent<OnboardingProgressEventDetail>).detail;
      if (!detail?.taskId || detail.showChecklistToast === false) return;
      if (!getFreeTrialActivated()) return;

      const actionLine =
        detail.toastActionLine?.trim() ||
        ONBOARDING_TASK_TOAST_LINES[detail.taskId] ||
        "Checklist step done!";
      const copy = buildOnboardingRewardChecklistToast(actionLine, getChecklistRewardRdm());
      toast(copy);
    };

    window.addEventListener(ONBOARDING_PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(ONBOARDING_PROGRESS_EVENT, onProgress);
  }, [toast]);

  useEffect(() => {
    const onSyncFailed = (event: Event) => {
      const detail = (event as CustomEvent<OnboardingSyncFailedDetail>).detail;
      if (!detail?.taskId) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      toast({
        title: "Could not save checklist progress",
        description:
          "Your step was saved on this device and will sync when you're back online. Refresh if it still doesn't update.",
        variant: "destructive",
        duration: 6000,
      });
    };

    window.addEventListener(ONBOARDING_SYNC_FAILED_EVENT, onSyncFailed);
    return () => window.removeEventListener(ONBOARDING_SYNC_FAILED_EVENT, onSyncFailed);
  }, [toast]);

  return null;
}
