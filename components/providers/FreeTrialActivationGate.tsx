"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isTrialGateAudience } from "@/lib/subscription/dashboardTrialPopups";
import {
  FREE_TRIAL_ACTIVATED_EVENT,
  FREE_TRIAL_DEMO_RESET_EVENT,
  FREE_TRIAL_REVOKED_EVENT,
  getChecklistRewardRdm,
  getDashboardPopupPhase,
  hydrateFreeTrialRdmAmounts,
} from "@/lib/subscription/freeTrialClient";
import { DEFAULT_RDM_CONFIG } from "@/lib/rdm/rdmConfig";
import { fetchOnboardingRewardState } from "@/lib/subscription/onboardingRewardApi";

/**
 * App-wide gate: until the student activates the 14-day free trial, the promo /
 * onboarding dialog blocks interaction on every student app route (Dashboard,
 * Performance, Prep/Mock, Classrooms, Play, Gyan++, Magic Wall, Earn, Dive, …).
 * Post-trial card / continue-free is handled separately by TrialExpirationGate.
 */
const FreeTrialPromoDialog = dynamic(
  () =>
    import("@/components/dashboard/FreeTrialPromoDialog").then((m) => ({
      default: m.FreeTrialPromoDialog,
    })),
  { ssr: false }
);

/** Auth / staff surfaces — never force student trial activation here. */
const GATE_BYPASS_PREFIXES = [
  "/auth",
  "/admin",
  "/teacher-portal",
  "/select-role",
  "/auth-choice",
  "/waitlist",
  "/integrations",
];

/**
 * Student product routes that must show the activation popup (explicit list from product).
 * Any other non-bypass authenticated student route is also gated (catch-all).
 */
const STUDENT_APP_GATE_PREFIXES = [
  "/home",
  "/performance",
  "/explore-1",
  "/explore",
  "/mock",
  "/mock-test",
  "/classrooms",
  "/classroom",
  "/doubts",
  "/play",
  "/magic-wall",
  "/refer-earn",
  "/dive",
  "/exam-prep",
  "/revision",
  "/edufund",
  "/settings",
  "/profile",
  "/pricing",
  "/news-blog",
];

function isGateBypassRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return GATE_BYPASS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isStudentAppGateRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/") return true;
  return STUDENT_APP_GATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function FreeTrialActivationGateInner() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const pathname = usePathname();
  const [welcomeRdm, setWelcomeRdm] = useState(
    DEFAULT_RDM_CONFIG.free_trial_welcome_rdm
  );
  const [checklistRewardRdm, setChecklistRewardRdm] = useState(() =>
    getChecklistRewardRdm()
  );

  const needsActivation = useMemo(() => {
    if (loading || !user || !profile) return false;
    if (!isTrialGateAudience(profile.role)) return false;
    if (isGateBypassRoute(pathname)) return false;
    // Gate every authenticated student route (includes /home?page=dashboard,
    // /performance, /explore-1, /mock, /classrooms, /mock-test, /doubts, /play,
    // /explore/community, /magic-wall, /refer-earn, /dive, …).
    // Deep links must not bypass — only GATE_BYPASS_PREFIXES are excluded.
    if (!isStudentAppGateRoute(pathname) && process.env.NODE_ENV === "development") {
      console.debug(
        "[trial-activation-gate] gating non-listed student route:",
        pathname
      );
    }
    return getDashboardPopupPhase(profile, profile.id) === "free_trial";
  }, [
    loading,
    user,
    profile,
    pathname,
    profile?.id,
    profile?.role,
    profile?.plan_tier,
    profile?.free_trial_activated,
    profile?.free_trial_activated_at,
    profile?.trial_end_bonus_activated,
    profile?.trial_original_ended_at,
    profile?.time_travel_offset_ms,
  ]);

  const loadRewardAmounts = useCallback(async () => {
    if (!user?.id) return;
    const state = await fetchOnboardingRewardState();
    hydrateFreeTrialRdmAmounts({
      checklistRewardRdm: state.checklistRewardRdm,
    });
    setWelcomeRdm(
      state.freeTrialWelcomeRdm ?? DEFAULT_RDM_CONFIG.free_trial_welcome_rdm
    );
    setChecklistRewardRdm(state.checklistRewardRdm);
  }, [user?.id]);

  useEffect(() => {
    if (!needsActivation) return;
    void loadRewardAmounts();
  }, [needsActivation, loadRewardAmounts]);

  useEffect(() => {
    const onActivated = () => {
      void refreshProfile();
    };
    const onResetOrRevoke = () => {
      void refreshProfile();
    };
    window.addEventListener(FREE_TRIAL_ACTIVATED_EVENT, onActivated);
    window.addEventListener(FREE_TRIAL_DEMO_RESET_EVENT, onResetOrRevoke);
    window.addEventListener(FREE_TRIAL_REVOKED_EVENT, onResetOrRevoke);
    return () => {
      window.removeEventListener(FREE_TRIAL_ACTIVATED_EVENT, onActivated);
      window.removeEventListener(FREE_TRIAL_DEMO_RESET_EVENT, onResetOrRevoke);
      window.removeEventListener(FREE_TRIAL_REVOKED_EVENT, onResetOrRevoke);
    };
  }, [refreshProfile]);

  useEffect(() => {
    if (!needsActivation) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [needsActivation]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        void refreshProfile();
      }
    },
    [refreshProfile]
  );

  if (!needsActivation) return null;

  return (
    <>
      {/* Sync shell so navigation never leaves a gap while the dialog chunk loads */}
      <div
        aria-hidden
        className="fixed inset-0 z-[90] bg-[#0A0F1E]/85 backdrop-blur-[2px]"
      />
      <FreeTrialPromoDialog
        open
        onOpenChange={handleOpenChange}
        welcomeRdm={welcomeRdm}
        checklistRewardRdm={checklistRewardRdm}
      />
    </>
  );
}

export function FreeTrialActivationGate() {
  return (
    <Suspense fallback={null}>
      <FreeTrialActivationGateInner />
    </Suspense>
  );
}
