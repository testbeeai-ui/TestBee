"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { SiteTourCarousel } from "@/components/onboarding/SiteTourCarousel";
import { TIME_TRAVEL_OFFSET_CHANGED_EVENT } from "@/lib/dev/timeTravel";
import { fetchOnboardingRewardState } from "@/lib/subscription/onboardingRewardApi";
import { DEFAULT_RDM_CONFIG } from "@/lib/rdm/rdmConfig";
import {
  FREE_TRIAL_ACTIVATED_EVENT,
  FREE_TRIAL_DEMO_RESET_EVENT,
  FREE_TRIAL_REVOKED_EVENT,
  ONBOARDING_PROGRESS_EVENT,
  ONBOARDING_REWARD_CLAIMED_EVENT,
  getFreeTrialActivated,
  hydrateOnboardingProgressFromServer,
  isOnboardingRewardClaimed,
} from "@/lib/subscription/freeTrialClient";
import {
  shouldAutoOpenSiteTourCarousel,
  shouldShowTrialExpirationOverlay,
} from "@/lib/subscription/dashboardTrialPopups";
import { OPEN_SITE_TOUR_CAROUSEL_EVENT } from "@/lib/onboarding/openSiteTourCarousel";

/** Flip to true to auto-open the Day-1 carousel site tour after trial activation. */
const SHOW_ONBOARDING_REWARD_AUTO_POPUP = true;

/** Global Day-1 site tour carousel (AppLayout overlay). */
export function SiteTourCarouselHost() {
  const { profile, refreshProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dismissedRef = useRef(false);
  const manualOpenRef = useRef(false);
  const [trialActivated, setTrialActivated] = useState(() =>
    typeof window !== "undefined" ? getFreeTrialActivated(profile) : false
  );
  const [checklistRewardRdm, setChecklistRewardRdm] = useState(
    DEFAULT_RDM_CONFIG.free_trial_checklist_reward_rdm
  );

  const dashboardClock = useMemo(
    () => Date.now() + (profile?.time_travel_offset_ms ?? 0),
    [profile?.time_travel_offset_ms]
  );

  const trialExpirationOpen = useMemo(
    () => shouldShowTrialExpirationOverlay(profile, dashboardClock),
    [profile, dashboardClock]
  );

  const eligible =
    Boolean(profile?.id) &&
    trialActivated &&
    !trialExpirationOpen &&
    !isOnboardingRewardClaimed(profile) &&
    shouldAutoOpenSiteTourCarousel(profile, dashboardClock);

  const applyPopupPhase = useCallback(() => {
    const activated = getFreeTrialActivated(profile);
    const popupNow = Date.now() + (profile?.time_travel_offset_ms ?? 0);
    setTrialActivated(activated);
    const shouldAutoOpen =
      SHOW_ONBOARDING_REWARD_AUTO_POPUP &&
      shouldAutoOpenSiteTourCarousel(profile, popupNow);
    setIsOpen((prev) => {
      if (dismissedRef.current) return false;
      return prev || shouldAutoOpen;
    });
  }, [
    profile?.id,
    profile?.plan_tier,
    profile?.free_trial_activated,
    profile?.free_trial_activated_at,
    profile?.time_travel_offset_ms,
    profile?.trial_end_bonus_activated,
    profile?.trial_second_round_activated,
    profile?.onboarding_reward_claimed_at,
    profile?.onboarding_reward_progress,
  ]);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    void fetchOnboardingRewardState().then((state) => {
      if (cancelled) return;
      hydrateOnboardingProgressFromServer(state.progress);
      setChecklistRewardRdm(state.checklistRewardRdm);
      startTransition(() => applyPopupPhase());
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once per user; applyPopupPhase reads latest profile via closure on invoke
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    startTransition(() => applyPopupPhase());
  }, [profile?.id, profile?.time_travel_offset_ms, applyPopupPhase]);

  useEffect(() => {
    const onTimeTravel = () => startTransition(() => applyPopupPhase());
    const onTrialActivated = () => {
      dismissedRef.current = false;
      manualOpenRef.current = false;
      startTransition(() => applyPopupPhase());
    };
    const onTrialRevoked = () => {
      void refreshProfile().then(() => startTransition(() => applyPopupPhase()));
    };
    const onOnboardingProgress = () => {
      /* Progress hydrates elsewhere; do not re-run popup phase (was resetting tour + API storm). */
    };
    const onClaimed = () => {
      dismissedRef.current = false;
      startTransition(() => {
        setIsOpen(false);
        applyPopupPhase();
      });
    };
    const reopenOnReturn = () => startTransition(() => applyPopupPhase());
    const onManualOpen = () => {
      dismissedRef.current = false;
      manualOpenRef.current = true;
      startTransition(() => setIsOpen(true));
    };

    window.addEventListener(TIME_TRAVEL_OFFSET_CHANGED_EVENT, onTimeTravel);
    window.addEventListener(FREE_TRIAL_ACTIVATED_EVENT, onTrialActivated);
    window.addEventListener(FREE_TRIAL_DEMO_RESET_EVENT, onTrialActivated);
    window.addEventListener(FREE_TRIAL_REVOKED_EVENT, onTrialRevoked);
    window.addEventListener(ONBOARDING_PROGRESS_EVENT, onOnboardingProgress);
    window.addEventListener(ONBOARDING_REWARD_CLAIMED_EVENT, onClaimed);
    window.addEventListener("focus", reopenOnReturn);
    window.addEventListener("pageshow", reopenOnReturn);
    window.addEventListener(OPEN_SITE_TOUR_CAROUSEL_EVENT, onManualOpen);

    return () => {
      window.removeEventListener(TIME_TRAVEL_OFFSET_CHANGED_EVENT, onTimeTravel);
      window.removeEventListener(FREE_TRIAL_ACTIVATED_EVENT, onTrialActivated);
      window.removeEventListener(FREE_TRIAL_DEMO_RESET_EVENT, onTrialActivated);
      window.removeEventListener(FREE_TRIAL_REVOKED_EVENT, onTrialRevoked);
      window.removeEventListener(ONBOARDING_PROGRESS_EVENT, onOnboardingProgress);
      window.removeEventListener(ONBOARDING_REWARD_CLAIMED_EVENT, onClaimed);
      window.removeEventListener("focus", reopenOnReturn);
      window.removeEventListener("pageshow", reopenOnReturn);
      window.removeEventListener(OPEN_SITE_TOUR_CAROUSEL_EVENT, onManualOpen);
    };
  }, [applyPopupPhase, refreshProfile]);

  useEffect(() => {
    if (!trialExpirationOpen || profile?.trial_end_bonus_activated) return;
    startTransition(() => setIsOpen(false));
  }, [trialExpirationOpen, profile?.trial_end_bonus_activated]);

  useEffect(() => {
    if (eligible || !isOpen) return;
    if (manualOpenRef.current) return;
    if (isOnboardingRewardClaimed(profile)) {
      startTransition(() => setIsOpen(false));
    }
  }, [eligible, isOpen, profile]);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      dismissedRef.current = true;
      manualOpenRef.current = false;
    }
  }, []);

  if (!profile?.id) return null;

  return (
    <SiteTourCarousel
      open={isOpen}
      onOpenChange={handleOpenChange}
      checklistRewardRdm={checklistRewardRdm}
    />
  );
}
