"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ONBOARDING_ACTIVE_TASK_CHANGED_EVENT } from "@/lib/onboarding/onboardingTaskCompanion";
import {
  applyProfileOnboardingServerStatus,
  isProfileBasicFormDraftComplete,
  isProfileCompanionTrackingActive,
  markProfileCompanionFormStarted,
  markProfileCompanionHubOpened,
  reconcileProfileCompanionSteps,
  type ProfileBasicFormDraft,
} from "@/lib/onboarding/profileCompanionOnboarding";
import { fetchProfileOnboardingStatus } from "@/lib/onboarding/profileCompanionApi";
import type { Profile } from "@/hooks/useAuth";
import {
  clearOnboardingStepComplete,
  getOnboardingProgress,
} from "@/lib/subscription/freeTrialClient";
import { isStudentProfileBasicInfoComplete } from "@/lib/profile/studentProfileBasicInfo";

type ProfileOnboardingTrackerProps = {
  section: string;
  profile: Profile;
  accountEmail?: string | null;
  formDraft: ProfileBasicFormDraft;
};

export function ProfileOnboardingTracker({
  section,
  profile,
  accountEmail,
  formDraft,
}: ProfileOnboardingTrackerProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!isProfileCompanionTrackingActive()) return;
    if (pathname !== "/profile") return;
    if (section !== "personal") return;

    markProfileCompanionHubOpened();
    window.dispatchEvent(
      new CustomEvent(ONBOARDING_ACTIVE_TASK_CHANGED_EVENT, { detail: "profile" })
    );

    const sync = () => {
      reconcileProfileCompanionSteps(profile, accountEmail);
      void fetchProfileOnboardingStatus().then((status) => {
        applyProfileOnboardingServerStatus(status, profile, accountEmail);
      });
    };

    sync();
    const pollId = window.setInterval(sync, 12_000);
    return () => window.clearInterval(pollId);
  }, [pathname, section, profile, accountEmail]);

  useEffect(() => {
    if (!isProfileCompanionTrackingActive()) return;
    if (section !== "personal") return;

    const draftFilled = isProfileBasicFormDraftComplete(formDraft);
    const progress = getOnboardingProgress();

    if (draftFilled) {
      if (!progress["profile_step_1"]) {
        markProfileCompanionFormStarted();
      }
    } else {
      // If server info is also not complete, clear step 1
      const basicComplete = isStudentProfileBasicInfoComplete(profile, accountEmail);
      if (!basicComplete && progress["profile_step_1"]) {
        clearOnboardingStepComplete("profile", 1);
      }
    }
  }, [section, formDraft, profile, accountEmail]);

  return null;
}
