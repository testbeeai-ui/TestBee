import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import { ensureEarnChallengeCompanionTimestamp } from "@/lib/onboarding/earnChallengeOnboardingFlow";

export async function fetchEarnChallengeCommunityPostStatus(): Promise<boolean> {
  const authHeaders = await getClientApiAuthHeaders();
  // Always get a valid session timestamp — initialises to "now" if missing
  // (handles new browser sessions where sessionStorage was cleared but the
  // companion is still active from localStorage). This guarantees old posts
  // posted before this session are NEVER counted.
  const since = ensureEarnChallengeCompanionTimestamp();
  const url = `/api/user/onboarding-reward/earn-challenge-status?since=${encodeURIComponent(since)}`;
  const res = await fetch(url, {
    headers: { ...authHeaders },
    cache: "no-store",
  });
  if (!res.ok) return false;
  const body = (await res.json()) as { hasCommunityPost?: boolean };
  return Boolean(body.hasCommunityPost);
}
