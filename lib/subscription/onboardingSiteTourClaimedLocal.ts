/** Local mirror of profiles.onboarding_reward_claimed_at (avoids circular imports). */
export const ONBOARDING_SITE_TOUR_CLAIMED_LS_KEY = "edublast.onboarding_site_tour_claimed_v1";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function isOnboardingSiteTourClaimedLocally(): boolean {
  return (
    canUseStorage() && window.localStorage.getItem(ONBOARDING_SITE_TOUR_CLAIMED_LS_KEY) === "1"
  );
}

export function setOnboardingSiteTourClaimedLocally(): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(ONBOARDING_SITE_TOUR_CLAIMED_LS_KEY, "1");
}

export function clearOnboardingSiteTourClaimedLocally(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(ONBOARDING_SITE_TOUR_CLAIMED_LS_KEY);
}
