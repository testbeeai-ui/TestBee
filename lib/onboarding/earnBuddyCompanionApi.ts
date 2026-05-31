import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import type { BuddyOnboardingVerification } from "@/lib/buddy/buddyOnboardingVerification";
import { fetchWithStatusCache } from "@/lib/onboarding/onboardingCompanionStatusCache";

export type EarnBuddyOnboardingStatus = BuddyOnboardingVerification;

export async function fetchEarnBuddyOnboardingStatus(): Promise<EarnBuddyOnboardingStatus> {
  return fetchWithStatusCache("earn_buddy", async () => {
    const authHeaders = await getClientApiAuthHeaders();
    const res = await fetch("/api/user/onboarding-reward/earn-buddy-status", {
      headers: { ...authHeaders },
      cache: "no-store",
    });
    if (!res.ok) {
      return { hasAcceptedInvite: false, hasInvitedBuddyJoined: false };
    }
    return (await res.json()) as EarnBuddyOnboardingStatus;
  });
}
