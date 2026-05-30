import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";

export type ProfileOnboardingStatus = {
  basicInfoComplete: boolean;
  hasAvatarUrl: boolean;
};

export async function fetchProfileOnboardingStatus(): Promise<ProfileOnboardingStatus> {
  const authHeaders = await getClientApiAuthHeaders();
  const res = await fetch("/api/user/onboarding-reward/profile-status", {
    headers: { ...authHeaders },
    cache: "no-store",
  });
  if (!res.ok) {
    return { basicInfoComplete: false, hasAvatarUrl: false };
  }
  return (await res.json()) as ProfileOnboardingStatus;
}
