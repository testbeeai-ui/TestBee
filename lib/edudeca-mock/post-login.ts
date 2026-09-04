import { isEduDecaMockDestination } from "@/lib/waitlist/whitelistGate";

export function shouldFollowPostLoginNext(
  nextPath: string | null | undefined,
  onboardingComplete: boolean,
): boolean {
  if (nextPath == null || nextPath === "") return false;
  if (onboardingComplete) return true;
  return isEduDecaMockDestination(nextPath);
}

export function pickEduDecaMockAwareDestination(input: {
  onboardingComplete: boolean;
  pendingDeepLink: string | null;
  oauthStored: string | null;
  onboardPath: string;
  postOnboardPath: string;
}): string {
  const mockDest = [input.pendingDeepLink, input.oauthStored].find((path) =>
    isEduDecaMockDestination(path),
  );
  if (mockDest) return mockDest;
  if (input.onboardingComplete) {
    return input.pendingDeepLink ?? input.oauthStored ?? input.postOnboardPath;
  }
  return input.onboardPath;
}
