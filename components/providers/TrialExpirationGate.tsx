"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import TrialExpirationOverlay from "@/components/dashboard/TrialExpirationOverlay";
import {
  explainTrialGateDecision,
  isTrialGateAudience,
  shouldShowTrialExpirationOverlay,
} from "@/lib/subscription/dashboardTrialPopups";
import {
  getTrialTrackerDaysCompleted,
  parseDailyStreakServerState,
} from "@/lib/onboarding/dailyStreakProgress";
import {
  TIME_TRAVEL_OFFSET_CHANGED_EVENT,
  type TimeTravelOffsetChangedDetail,
} from "@/lib/dev/timeTravel";

const GATE_BYPASS_PREFIXES = ["/auth", "/admin", "/teacher-portal"];

function isGateBypassRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return GATE_BYPASS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function TrialExpirationGateInner() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const pathname = usePathname();
  const [travelOffsetMs, setTravelOffsetMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [serverRequired, setServerRequired] = useState<boolean | null>(null);
  /** Keeps success UI mounted after claim until user taps "Let's Go Study!" */
  const [completionHold, setCompletionHold] = useState(false);

  const effectiveOffsetMs =
    travelOffsetMs ?? Math.max(0, Number(profile?.time_travel_offset_ms ?? 0));

  const tickClock = useCallback(() => {
    setNowMs(Date.now() + effectiveOffsetMs);
  }, [effectiveOffsetMs]);

  const fetchServerGate = useCallback(async () => {
    try {
      const headers = await getClientApiAuthHeaders();
      const res = await fetch("/api/user/trial-payment-gate", {
        credentials: "same-origin",
        headers,
      });
      const body = (await res.json().catch(() => ({}))) as {
        required?: boolean;
      };
      if (res.ok && typeof body.required === "boolean") {
        setServerRequired(body.required);
      }
    } catch {
      setServerRequired(null);
    }
  }, []);

  useEffect(() => {
    setTravelOffsetMs(null);
  }, [profile?.time_travel_offset_ms]);

  useEffect(() => {
    tickClock();
    const interval = window.setInterval(tickClock, 1000);
    const onTimeTravel = (event: Event) => {
      const detail = (event as CustomEvent<TimeTravelOffsetChangedDetail>).detail;
      if (detail && typeof detail.offsetMs === "number") {
        setTravelOffsetMs(detail.offsetMs);
      }
      void refreshProfile().then(() => fetchServerGate());
      tickClock();
    };
    window.addEventListener(TIME_TRAVEL_OFFSET_CHANGED_EVENT, onTimeTravel);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(TIME_TRAVEL_OFFSET_CHANGED_EVENT, onTimeTravel);
    };
  }, [tickClock, refreshProfile, fetchServerGate]);

  // Fetch server gate once per session/profile change — not on every 1s clock tick (nowMs).
  useEffect(() => {
    if (!user?.id || loading) return;
    void fetchServerGate();
  }, [user?.id, loading, profile?.id, profile?.time_travel_offset_ms, fetchServerGate]);

  const clientRequired = useMemo(() => {
    if (!profile) return false;
    return shouldShowTrialExpirationOverlay(profile, nowMs);
  }, [profile, nowMs]);

  const gateOpen = useMemo(() => {
    if (loading || !user || !profile) return false;
    if (!isTrialGateAudience(profile.role)) return false;
    if (isGateBypassRoute(pathname)) return false;
    if (serverRequired === true) return true;
    if (serverRequired === false) return false;
    return clientRequired;
  }, [loading, user, profile, pathname, serverRequired, clientRequired]);

  const trialTrackerDaysCompleted = useMemo(() => {
    if (!profile?.id) return 0;
    const serverStreak = parseDailyStreakServerState(profile.free_trial_daily_streak);
    return getTrialTrackerDaysCompleted(
      profile.id,
      profile.onboarding_reward_claimed_at,
      serverStreak
    );
  }, [profile?.id, profile?.onboarding_reward_claimed_at, profile?.free_trial_daily_streak]);

  if (process.env.NODE_ENV === "development" && profile && !gateOpen) {
    const decision = explainTrialGateDecision(profile, nowMs);
    if (decision.blockers.some((b) => b.includes("trial still running") === false)) {
      // only log when they might expect the gate
      console.debug("[trial-gate] hidden:", decision.blockers.join(" | "));
    }
  }

  useEffect(() => {
    if (gateOpen) setCompletionHold(false);
  }, [gateOpen]);

  const overlayVisible = gateOpen || completionHold;
  if (!overlayVisible || !profile) return null;

  return (
    <TrialExpirationOverlay
      open={overlayVisible}
      profile={profile}
      trialTrackerDaysCompleted={trialTrackerDaysCompleted}
      onCompletionHold={() => setCompletionHold(true)}
      onFinished={() => setCompletionHold(false)}
      onSuccess={async () => {
        await refreshProfile();
        await fetchServerGate();
      }}
    />
  );
}

export function TrialExpirationGate() {
  return (
    <Suspense fallback={null}>
      <TrialExpirationGateInner />
    </Suspense>
  );
}
