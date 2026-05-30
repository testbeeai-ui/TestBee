"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { OnboardingRewardClaimDialog } from "@/components/dashboard/OnboardingRewardClaimDialog";
import { OnboardingRewardDialog } from "@/components/dashboard/OnboardingRewardDialog";
import { isMainOnboardingTaskId } from "@/lib/onboarding/onboardingNextTask";
import {
  ONBOARDING_TASK_CELEBRATION_ENDED_EVENT,
  isOnboardingTaskCompanionLaunched,
  type OnboardingTaskCelebrationEndedDetail,
} from "@/lib/onboarding/onboardingTaskCompanion";
import { flushPendingOnboardingSiteTourPromo } from "@/lib/onboarding/onboardingSiteTourPromo";
import {
  DAILY_STREAK_ALL_COMPLETE_EVENT,
  getDueDailyStreakTomorrowModal,
  isDailyStreakChecklistSuppressed,
  markDailyStreakTomorrowModalShown,
  scheduleDailyStreakTomorrowModal,
  dailyStreakClaimKey,
  DAILY_STREAK_POST_COMPLETE_DELAY_MS,
} from "@/lib/onboarding/dailyStreakClient";
import {
  getHighestClaimedStreakDay,
  loadDailyChecklistCompleted,
  isWaitingForDay2Unlock,
  parseDailyStreakServerState,
  ONBOARDING_DAILY_CHECKLIST_REOPEN_EVENT,
  type OnboardingDailyChecklistReopenDetail,
} from "@/lib/onboarding/dailyChecklistTaskStorage";
import {
  mergeDailyChecklistCompleted,
  ensureDailyStreakSyncRetryListeners,
} from "@/lib/onboarding/dailyStreakSync";
import { DailyStreakTomorrowModal } from "@/components/onboarding/DailyStreakTomorrowModal";
import { TIME_TRAVEL_OFFSET_CHANGED_EVENT } from "@/lib/dev/timeTravel";
import { fetchOnboardingRewardState } from "@/lib/subscription/onboardingRewardApi";
import { DEFAULT_RDM_CONFIG } from "@/lib/rdm/rdmConfig";
import {
  isAdminManualOnboardingChecklist,
  isOnboardingRewardClaimed,
  isOnboardingRewardComplete,
  ONBOARDING_CLAIM_REWARD_PROMO_EVENT,
  ONBOARDING_POST_TASK_SITE_TOUR_EVENT,
  ONBOARDING_PROGRESS_EVENT,
  ONBOARDING_REWARD_CLAIMED_EVENT,
  shouldPromoteOnboardingSiteTourAfterTask,
  type OnboardingClaimRewardPromoDetail,
  type OnboardingPostTaskSiteTourDetail,
} from "@/lib/subscription/freeTrialClient";

/** Brief delay so the checklist toast appears before the modal. */
const OPEN_DELAY_MS = 750;

function fullChecklistPromptSessionKey(completedTaskId: string): string {
  return `edublast-onboarding-full-checklist-promo-v2-${completedTaskId}`;
}

function claimRewardPromptSessionKey(): string {
  return "edublast-onboarding-claim-reward-promo-v1";
}

/** Global post-task UI: site-tour checklist after each task; Claim RDM when all 10 are done. */
export function OnboardingNextTaskPrompt() {
  const { profile } = useAuth();
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [checklistRewardRdm, setChecklistRewardRdm] = useState(
    DEFAULT_RDM_CONFIG.free_trial_checklist_reward_rdm
  );
  const [tomorrowModalDay, setTomorrowModalDay] = useState<number | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const promotedTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    ensureDailyStreakSyncRetryListeners();
  }, []);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current != null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const passesEligibility = useCallback((): boolean => {
    if (isOnboardingRewardClaimed(profile)) return false;
    const isAdminManual = isAdminManualOnboardingChecklist();
    if (!isAdminManual) {
      if (!shouldPromoteOnboardingSiteTourAfterTask(profile)) return false;
      if (profile?.role && profile.role !== "student") return false;
    }
    return true;
  }, [profile]);

  const maybeOpenClaimReward = useCallback(
    (opts?: OnboardingClaimRewardPromoDetail) => {
      if (typeof window === "undefined") return;
      if (!passesEligibility()) return;
      const checklistComplete = isOnboardingRewardComplete(profile) || isOnboardingRewardComplete();
      if (!checklistComplete) return;

      const afterCelebration = opts?.afterCompanionCelebration === true;
      const force = opts?.force === true;
      const companionStillActive = isOnboardingTaskCompanionLaunched();
      if (companionStillActive && !afterCelebration && !force) return;

      if (force) {
        try {
          window.sessionStorage.removeItem(claimRewardPromptSessionKey());
        } catch {
          /* ignore */
        }
      } else if (!afterCelebration) {
        try {
          if (window.sessionStorage.getItem(claimRewardPromptSessionKey())) return;
        } catch {
          /* ignore */
        }
      }

      clearOpenTimer();
      setChecklistOpen(false);
      const openDelayMs = force ? 0 : OPEN_DELAY_MS;
      openTimerRef.current = window.setTimeout(() => {
        openTimerRef.current = null;
        setClaimOpen(true);
      }, openDelayMs);
    },
    [profile, passesEligibility, clearOpenTimer]
  );

  const maybeOpenFullChecklist = useCallback(
    (completedTaskId: string, opts?: { afterCompanionCelebration?: boolean }) => {
      if (typeof window === "undefined") return;
      if (!completedTaskId || !isMainOnboardingTaskId(completedTaskId)) return;
      if (!passesEligibility()) return;

      const afterCelebration = opts?.afterCompanionCelebration === true;
      const companionStillActive = isOnboardingTaskCompanionLaunched();

      if (companionStillActive && !afterCelebration) {
        return;
      }

      if (isOnboardingRewardComplete(profile)) {
        maybeOpenClaimReward(opts);
        return;
      }

      if (!afterCelebration) {
        try {
          const key = fullChecklistPromptSessionKey(completedTaskId);
          if (window.sessionStorage.getItem(key)) return;
        } catch {
          /* ignore */
        }
      }

      clearOpenTimer();
      setClaimOpen(false);
      openTimerRef.current = window.setTimeout(() => {
        openTimerRef.current = null;
        promotedTaskIdRef.current = completedTaskId;
        setChecklistOpen(true);
      }, OPEN_DELAY_MS);
    },
    [profile, passesEligibility, clearOpenTimer, maybeOpenClaimReward]
  );

  const maybeOpenDay2Checklist = useCallback(
    (dailyTaskId: string) => {
      if (typeof window === "undefined") return;
      if (!dailyTaskId) return;
      if (!isOnboardingRewardClaimed(profile)) return;
      if (!profile?.id) return;
      const nowMs = Date.now() + (profile.time_travel_offset_ms ?? 0);
      if (isWaitingForDay2Unlock(profile.onboarding_reward_claimed_at, nowMs)) return;
      if (isDailyStreakChecklistSuppressed(profile.id, nowMs)) return;

      clearOpenTimer();
      setClaimOpen(false);
      setChecklistOpen(true);
    },
    [profile, clearOpenTimer]
  );

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    void fetchOnboardingRewardState().then((state) => {
      if (cancelled) return;
      setChecklistRewardRdm(state.checklistRewardRdm);
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!checklistOpen || !promotedTaskIdRef.current) return;
    try {
      window.sessionStorage.setItem(fullChecklistPromptSessionKey(promotedTaskIdRef.current), "1");
    } catch {
      /* ignore */
    }
  }, [checklistOpen]);

  useEffect(() => {
    if (!claimOpen) return;
    try {
      window.sessionStorage.setItem(claimRewardPromptSessionKey(), "1");
    } catch {
      /* ignore */
    }
  }, [claimOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onPostTaskSiteTour = (event: Event) => {
      const detail = (event as CustomEvent<OnboardingPostTaskSiteTourDetail>).detail;
      if (!detail?.taskId) return;
      maybeOpenFullChecklist(detail.taskId, {
        afterCompanionCelebration: detail.afterCompanionCelebration,
      });
    };

    const onClaimPromo = (event: Event) => {
      const detail = (event as CustomEvent<OnboardingClaimRewardPromoDetail>).detail;
      maybeOpenClaimReward({
        afterCompanionCelebration: detail?.afterCompanionCelebration,
        force: detail?.force,
      });
    };

    const onCelebrationEnded = (event: Event) => {
      const detail = (event as CustomEvent<OnboardingTaskCelebrationEndedDetail>).detail;
      if (!detail?.taskId || !isMainOnboardingTaskId(detail.taskId)) return;
      flushPendingOnboardingSiteTourPromo();
    };

    const onDailyChecklistReopen = (event: Event) => {
      const detail = (event as CustomEvent<OnboardingDailyChecklistReopenDetail>).detail;
      if (!detail?.dailyTaskId) return;
      maybeOpenDay2Checklist(detail.dailyTaskId);
    };

    window.addEventListener(ONBOARDING_POST_TASK_SITE_TOUR_EVENT, onPostTaskSiteTour);
    window.addEventListener(ONBOARDING_CLAIM_REWARD_PROMO_EVENT, onClaimPromo);
    window.addEventListener(ONBOARDING_TASK_CELEBRATION_ENDED_EVENT, onCelebrationEnded);
    window.addEventListener(ONBOARDING_DAILY_CHECKLIST_REOPEN_EVENT, onDailyChecklistReopen);
    return () => {
      window.removeEventListener(ONBOARDING_POST_TASK_SITE_TOUR_EVENT, onPostTaskSiteTour);
      window.removeEventListener(ONBOARDING_CLAIM_REWARD_PROMO_EVENT, onClaimPromo);
      window.removeEventListener(ONBOARDING_TASK_CELEBRATION_ENDED_EVENT, onCelebrationEnded);
      window.removeEventListener(ONBOARDING_DAILY_CHECKLIST_REOPEN_EVENT, onDailyChecklistReopen);
      clearOpenTimer();
    };
  }, [maybeOpenFullChecklist, maybeOpenClaimReward, maybeOpenDay2Checklist, clearOpenTimer]);

  useEffect(() => {
    const onProgress = () => {
      if (isOnboardingRewardClaimed(profile)) {
        setChecklistOpen(false);
        setClaimOpen(false);
      }
    };
    const onClaimed = () => {
      setClaimOpen(false);
      setChecklistOpen(false);
    };
    window.addEventListener(ONBOARDING_PROGRESS_EVENT, onProgress);
    window.addEventListener(ONBOARDING_REWARD_CLAIMED_EVENT, onClaimed);
    return () => {
      window.removeEventListener(ONBOARDING_PROGRESS_EVENT, onProgress);
      window.removeEventListener(ONBOARDING_REWARD_CLAIMED_EVENT, onClaimed);
    };
  }, [profile]);

  const syncTomorrowModal = useCallback(() => {
    if (!profile?.id) return;
    const nowMs = Date.now() + (profile.time_travel_offset_ms ?? 0);
    const due = getDueDailyStreakTomorrowModal(profile.id, nowMs);
    if (due) {
      setTomorrowModalDay(due.trialDayNumber);
    }
  }, [profile?.id, profile?.time_travel_offset_ms]);

  /** Recover modal if user claimed 6/6 but missed the overlay (refresh, closed tab, etc.). */
  useEffect(() => {
    if (!profile?.id || !isOnboardingRewardClaimed(profile)) return;
    const nowMs = Date.now() + (profile.time_travel_offset_ms ?? 0);
    const serverStreak = parseDailyStreakServerState(profile.free_trial_daily_streak);
    const recoveryDay = getHighestClaimedStreakDay(profile.id, serverStreak);
    if (recoveryDay < 2) return;

    const completed = mergeDailyChecklistCompleted(
      profile.id,
      recoveryDay,
      loadDailyChecklistCompleted(profile.id, recoveryDay),
      serverStreak,
      nowMs
    );
    if (completed.length < 6) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(dailyStreakClaimKey(profile.id, recoveryDay)) !== "1") {
      return;
    }

    const due = getDueDailyStreakTomorrowModal(profile.id, nowMs);
    if (due) {
      setTomorrowModalDay(due.trialDayNumber);
      return;
    }

    const scheduleRaw = window.localStorage.getItem(
      `edublast_daily_streak_tomorrow_modal_at_${profile.id}`
    );
    if (!scheduleRaw) {
      scheduleDailyStreakTomorrowModal(
        profile.id,
        recoveryDay,
        nowMs - DAILY_STREAK_POST_COMPLETE_DELAY_MS
      );
      syncTomorrowModal();
    }
  }, [
    profile?.id,
    profile?.onboarding_reward_claimed_at,
    profile?.free_trial_daily_streak,
    profile?.time_travel_offset_ms,
    syncTomorrowModal,
  ]);

  useEffect(() => {
    if (!profile?.id) return;
    syncTomorrowModal();
    const intervalId = window.setInterval(syncTomorrowModal, 1000);
    const onAllComplete = () => syncTomorrowModal();
    const onTimeTravel = () => syncTomorrowModal();
    window.addEventListener(DAILY_STREAK_ALL_COMPLETE_EVENT, onAllComplete);
    window.addEventListener(TIME_TRAVEL_OFFSET_CHANGED_EVENT, onTimeTravel);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(DAILY_STREAK_ALL_COMPLETE_EVENT, onAllComplete);
      window.removeEventListener(TIME_TRAVEL_OFFSET_CHANGED_EVENT, onTimeTravel);
    };
  }, [profile?.id, syncTomorrowModal]);

  return (
    <>
      <OnboardingRewardDialog
        open={checklistOpen}
        onOpenChange={(next) => {
          setChecklistOpen(next);
          if (!next) promotedTaskIdRef.current = null;
        }}
        checklistRewardRdm={checklistRewardRdm}
        allTasksComplete={
          !isOnboardingRewardClaimed(profile) && isOnboardingRewardComplete(profile)
        }
        onRequestClaimReward={() => {
          setChecklistOpen(false);
          setClaimOpen(true);
        }}
      />
      <OnboardingRewardClaimDialog
        open={claimOpen}
        onOpenChange={setClaimOpen}
        rewardRdm={checklistRewardRdm}
      />
      <DailyStreakTomorrowModal
        open={tomorrowModalDay !== null}
        trialDayNumber={tomorrowModalDay ?? 2}
        onClose={() => {
          if (profile?.id && tomorrowModalDay !== null) {
            markDailyStreakTomorrowModalShown(profile.id, tomorrowModalDay);
          }
          setTomorrowModalDay(null);
        }}
      />
    </>
  );
}
