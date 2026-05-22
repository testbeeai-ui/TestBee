/** Fired after topic quiz / lesson activity that buddies should see quickly. */
export const EDUBLAST_BUDDY_ACTIVITY_REFRESH = "edublast:buddy-activity-refresh";

export function notifyBuddyActivityRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EDUBLAST_BUDDY_ACTIVITY_REFRESH));
}
