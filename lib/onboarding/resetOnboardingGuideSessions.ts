import { clearCbseMcqOnboardingFlow } from "@/lib/onboarding/cbseMcqOnboardingFlow";
import { clearEarnChallengeOnboardingFlow } from "@/lib/onboarding/earnChallengeOnboardingFlow";
import { clearEdufundOnboardingFlow } from "@/lib/onboarding/edufundOnboardingFlow";
import { clearLessonsOnboardingFlow } from "@/lib/onboarding/lessonsOnboardingFlow";
import { clearPrepClassesOnboardingFlow } from "@/lib/onboarding/prepClassesOnboardingFlow";

/** Clears in-flight popup-only onboarding hints (sessionStorage step keys). */
export function resetAllOnboardingGuideSessions(): void {
  clearLessonsOnboardingFlow();
  clearCbseMcqOnboardingFlow();
  clearPrepClassesOnboardingFlow();
  clearEarnChallengeOnboardingFlow();
  clearEdufundOnboardingFlow();
}
