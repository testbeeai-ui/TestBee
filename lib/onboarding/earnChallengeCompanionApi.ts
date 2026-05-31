import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import { ensureEarnChallengeCompanionTimestamp } from "@/lib/onboarding/earnChallengeOnboardingFlow";
import { fetchWithStatusCache } from "@/lib/onboarding/onboardingCompanionStatusCache";

export async function fetchEarnChallengeCommunityPostStatus(): Promise<boolean> {
  const since = ensureEarnChallengeCompanionTimestamp();
  return fetchWithStatusCache(`earn_challenge:${since}`, async () => {
    const authHeaders = await getClientApiAuthHeaders();
    const url = `/api/user/onboarding-reward/earn-challenge-status?since=${encodeURIComponent(since)}`;
    const res = await fetch(url, {
      headers: { ...authHeaders },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { hasCommunityPost?: boolean };
    return Boolean(body.hasCommunityPost);
  });
}
