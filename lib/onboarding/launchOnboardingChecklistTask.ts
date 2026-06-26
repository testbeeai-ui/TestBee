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
  const companionTaskId = taskId === "prep_mock" ? "prep_classes" : taskId;
  const prevCompanion =
    typeof window !== "undefined"
      ? window.localStorage.getItem(ONBOARDING_COMPANION_LAUNCHED_KEY)
      : null;

  if (taskId === "dashboard" || taskId === "rdm_wallet") {
    return;
  }

  launchOnboardingTaskCompanion(companionTaskId);

  if (companionTaskId === "lessons" && prevCompanion !== "lessons") {
    clearLessonsCompanionSessionMarkers();
  }

  if (companionTaskId === "earn_buddy" && prevCompanion !== "earn_buddy") {
    clearEarnBuddyCompanionSessionMarkers();
  }

  if (companionTaskId === "profile" && prevCompanion !== "profile") {
    clearProfileCompanionSessionMarkers();
  }

  if (taskId === "prep_mcq" || taskId === "prep_mock") {
    startCbseMcqOnboardingFlow();
  }
  if (taskId === "prep_mock" || taskId === "prep_classes") {
    startPrepClassesOnboardingFlow();
    return;
  }
  if (taskId === "prep_mcq") {
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
    companionTaskId === "lessons" ||
    companionTaskId === "magic_wall" ||
    companionTaskId === "gyan_plus" ||
    companionTaskId === "earn_buddy" ||
    companionTaskId === "news_blog" ||
    companionTaskId === "profile"
  ) {
    return;
  }

  markOnboardingTaskComplete(taskId, { showChecklistToast: false });
}
