import { clearEarnChallengeCompanionSessionMarkers } from "@/lib/onboarding/earnChallengeCompanionOnboarding";
import { clearPlayDailyDoseCompanionSessionMarkers } from "@/lib/onboarding/playDailyDoseCompanionOnboarding";
import { clearNewsBlogCompanionSessionMarkers } from "@/lib/onboarding/newsBlogCompanionOnboarding";

import { clearEarnChallengeOnboardingFlow } from "@/lib/onboarding/earnChallengeOnboardingFlow";

import { resetOnboardingCompanionTaskForDailyChecklist } from "@/lib/subscription/freeTrialClient";

/** Day-2+ daily streak: companion re-run session (flow-only, per streak day). */

const SESSION_KEY = "edublast-daily-checklist-companion-retry-v1";

export const DAILY_TASK_TO_ONBOARDING: Record<string, string> = {
  t1: "play_dailydose",

  t3: "prep_mcq",

  t4: "gyan_plus",

  t5: "earn_challenge",

  t6: "news_blog",
};

export type DailyCompanionRetrySession = {
  onboardingTaskId: string;

  dailyTaskId: string;

  trialDayNumber: number;

  userId: string;
};

function parseSession(): DailyCompanionRetrySession | null {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(SESSION_KEY);

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as DailyCompanionRetrySession;

    if (parsed?.onboardingTaskId && parsed?.dailyTaskId) return parsed;
  } catch {
    /* legacy plain onboarding id */

    const dailyTaskId = Object.entries(DAILY_TASK_TO_ONBOARDING).find(
      ([, onboardingId]) => onboardingId === raw
    )?.[0];

    if (dailyTaskId) {
      return {
        onboardingTaskId: raw,

        dailyTaskId,

        trialDayNumber: 0,

        userId: "",
      };
    }
  }

  return null;
}

function clearCompanionSessionMarkers(onboardingTaskId: string): void {
  if (onboardingTaskId === "play_dailydose") {
    clearPlayDailyDoseCompanionSessionMarkers();

    return;
  }

  if (onboardingTaskId === "earn_challenge") {
    clearEarnChallengeCompanionSessionMarkers();

    clearEarnChallengeOnboardingFlow();

    return;
  }

  if (onboardingTaskId === "news_blog") {
    clearNewsBlogCompanionSessionMarkers();
  }
}

/** Reset site-tour progress locally and mark this onboarding task as a Day-2+ daily retry. */

export function startDailyChecklistCompanionRetry(
  dailyTaskId: string,

  trialDayNumber: number,

  userId: string
): void {
  if (typeof window === "undefined") return;

  const onboardingTaskId = DAILY_TASK_TO_ONBOARDING[dailyTaskId];

  if (!onboardingTaskId) return;

  resetOnboardingCompanionTaskForDailyChecklist(onboardingTaskId);

  clearCompanionSessionMarkers(onboardingTaskId);

  const session: DailyCompanionRetrySession = {
    onboardingTaskId,

    dailyTaskId,

    trialDayNumber,

    userId,
  };

  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getDailyCompanionRetrySession(): DailyCompanionRetrySession | null {
  return parseSession();
}

export function isDailyChecklistCompanionRetryActive(onboardingTaskId?: string): boolean {
  const session = parseSession();

  if (!session) return false;

  if (!onboardingTaskId) return true;

  return session.onboardingTaskId === onboardingTaskId;
}

export function clearDailyChecklistCompanionRetry(): void {
  if (typeof window === "undefined") return;

  window.sessionStorage.removeItem(SESSION_KEY);
}
