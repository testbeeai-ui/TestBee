import {
  launchOnboardingTaskCompanion,
  ONBOARDING_COMPANION_LAUNCHED_KEY,
} from "@/lib/onboarding/onboardingTaskCompanion";
import { clearEarnBuddyCompanionSessionMarkers } from "@/lib/onboarding/earnBuddyCompanionOnboarding";
import { clearEarnChallengeCompanionSessionMarkers } from "@/lib/onboarding/earnChallengeCompanionOnboarding";
import { clearProfileCompanionSessionMarkers } from "@/lib/onboarding/profileCompanionOnboarding";
import { clearLessonsCompanionSessionMarkers } from "@/lib/onboarding/lessonsOnboarding";
import { clearPlayDailyDoseCompanionSessionMarkers } from "@/lib/onboarding/playDailyDoseCompanionOnboarding";
import { startCbseMcqOnboardingFlow } from "@/lib/onboarding/cbseMcqOnboardingFlow";
import { startPrepClassesOnboardingFlow } from "@/lib/onboarding/prepClassesOnboardingFlow";
import { startEarnChallengeOnboardingFlow } from "@/lib/onboarding/earnChallengeOnboardingFlow";
import { startEdufundOnboardingFlow } from "@/lib/onboarding/edufundOnboardingFlow";
import { markOnboardingTaskComplete } from "@/lib/subscription/freeTrialClient";

/**
 * Shared launcher for site-tour checklist tasks (dashboard drawer + in-page promos).
 * Starts the companion, task-specific onboarding flows where needed, otherwise auto-completes
 * simple checklist rows locally (companion-driven tasks return without auto-complete).
 */
export function launchOnboardingChecklistTask(taskId: string): void {
  const prevCompanion =
    typeof window !== "undefined"
      ? window.localStorage.getItem(ONBOARDING_COMPANION_LAUNCHED_KEY)
      : null;

  launchOnboardingTaskCompanion(taskId);

  if (taskId === "lessons" && prevCompanion !== "lessons") {
    clearLessonsCompanionSessionMarkers();
  }

  if (taskId === "earn_buddy" && prevCompanion !== "earn_buddy") {
    clearEarnBuddyCompanionSessionMarkers();
  }

  if (taskId === "profile" && prevCompanion !== "profile") {
    clearProfileCompanionSessionMarkers();
  }

  if (taskId === "prep_mcq") {
    startCbseMcqOnboardingFlow();
    return;
  }
  if (taskId === "prep_classes") {
    startPrepClassesOnboardingFlow();
    return;
  }
  if (taskId === "earn_challenge") {
    clearEarnChallengeCompanionSessionMarkers();
    startEarnChallengeOnboardingFlow();
    return;
  }
  if (taskId === "edufund") {
    startEdufundOnboardingFlow();
    return;
  }
  if (taskId === "play_dailydose") {
    if (prevCompanion !== "play_dailydose") {
      clearPlayDailyDoseCompanionSessionMarkers();
    }
    return;
  }
  if (
    taskId === "lessons" ||
    taskId === "magic_wall" ||
    taskId === "gyan_plus" ||
    taskId === "earn_buddy" ||
    taskId === "news_blog" ||
    taskId === "profile"
  ) {
    return;
  }

  markOnboardingTaskComplete(taskId, { showChecklistToast: false });
}
