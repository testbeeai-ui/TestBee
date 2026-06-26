/** Fired when the student taps the dashboard +100 Site Tour badge (or similar). */
export const OPEN_SITE_TOUR_CAROUSEL_EVENT = "edublast:open-site-tour-carousel";

export function requestOpenSiteTourCarousel(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_SITE_TOUR_CAROUSEL_EVENT));
}
