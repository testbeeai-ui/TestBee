import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import type { BuddyOnboardingVerification } from "@/lib/buddy/buddyOnboardingVerification";

export type EarnBuddyOnboardingStatus = BuddyOnboardingVerification;

export async function fetchEarnBuddyOnboardingStatus(): Promise<EarnBuddyOnboardingStatus> {
  const authHeaders = await getClientApiAuthHeaders();
  const res = await fetch("/api/user/onboarding-reward/earn-buddy-status", {
    headers: { ...authHeaders },
    cache: "no-store",
  });
  if (!res.ok) {
    return { hasAcceptedInvite: false, hasInvitedBuddyJoined: false };
  }
  return (await res.json()) as EarnBuddyOnboardingStatus;
}
