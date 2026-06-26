import {
  SITE_TOUR_CAROUSEL_FLAT,
  SITE_TOUR_CAROUSEL_TOTAL_STEPS,
  getSiteTourMenu,
  type SiteTourFlatStep,
} from "@/lib/onboarding/siteTourCarouselData";
import { resolveSiteTourTaskIdForPathname } from "@/lib/onboarding/siteTourCarouselRoutes";
import { SITE_TOUR_ONBOARDING_SLIDES } from "@/lib/onboarding/siteTourOnboardingSlides";

/** Onboarding slide id → investor HTML menu id (`edublast_tour_carousel.html`). */
export const ONBOARDING_SLIDE_TO_MENU_ID: Record<string, string> = {
  dashboard: "db",
  magic_wall: "mw",
  lessons: "le",
  prep_mock: "pm",
  gyan_plus: "gy",
  earn_buddy: "el",
  earn_challenge: "el",
  news_blog: "nb",
  edufund: "ef",
  profile: "pr",
  rdm_wallet: "rw",
};

const DEFAULT_SUB_INDEX_FOR_SLIDE: Partial<Record<string, number>> = {
  earn_buddy: 0,
  earn_challenge: 2,
};

export function flatIndexForMenu(menuId: string, subIndex = 0): number {
  const menu = getSiteTourMenu(menuId);
  const sub = menu?.subs[subIndex];
  if (!sub) return SITE_TOUR_CAROUSEL_FLAT.findIndex((f) => f.mid === menuId);
  return SITE_TOUR_CAROUSEL_FLAT.findIndex((f) => f.mid === menuId && f.sid === sub.id);
}

/** Investor menu id for the page the user is on (navbar navigation). */
export function menuIdForPathname(pathname: string): string | null {
  const taskId = resolveSiteTourTaskIdForPathname(pathname);
  if (!taskId) return null;
  return ONBOARDING_SLIDE_TO_MENU_ID[taskId] ?? null;
}

export function flatIndexForOnboardingSlide(slideId: string): number {
  const menuId = ONBOARDING_SLIDE_TO_MENU_ID[slideId];
  if (!menuId) return 0;
  const subIndex = DEFAULT_SUB_INDEX_FOR_SLIDE[slideId] ?? 0;
  const idx = flatIndexForMenu(menuId, subIndex);
  return idx >= 0 ? idx : 0;
}

export function clampFlatIndex(index: number): number {
  return Math.max(0, Math.min(index, SITE_TOUR_CAROUSEL_TOTAL_STEPS - 1));
}

export function onboardingSlideIdForFlat(flat: SiteTourFlatStep): string | null {
  if (flat.mid === "el") {
    if (flat.sid === "el1") return "earn_buddy";
    if (flat.sid === "el3") return "earn_challenge";
    return null;
  }
  for (const [slideId, menuId] of Object.entries(ONBOARDING_SLIDE_TO_MENU_ID)) {
    if (menuId === flat.mid && slideId !== "earn_buddy" && slideId !== "earn_challenge") {
      return slideId;
    }
  }
  return null;
}

export function globalFlatPosition(flat: SiteTourFlatStep): number {
  const idx = SITE_TOUR_CAROUSEL_FLAT.findIndex(
    (f) => f.mid === flat.mid && f.sid === flat.sid
  );
  return idx >= 0 ? idx : 0;
}

/** Primary onboarding href when the tour lands on this investor menu. */
export function resolveTourHrefForMenu(menuId: string): string | null {
  if (menuId === "el") {
    return (
      SITE_TOUR_ONBOARDING_SLIDES.find((s) => s.id === "earn_buddy")?.href ??
      "/refer-earn?tab=learning_buddy&onboarding_buddy=1"
    );
  }
  const slideId = Object.entries(ONBOARDING_SLIDE_TO_MENU_ID).find(
    ([id, mid]) => mid === menuId && id !== "earn_buddy" && id !== "earn_challenge"
  )?.[0];
  if (!slideId) return null;
  return SITE_TOUR_ONBOARDING_SLIDES.find((s) => s.id === slideId)?.href ?? null;
}

export function primaryOnboardingSlideIdForMenu(menuId: string): string | null {
  if (menuId === "el") return "earn_buddy";
  return (
    Object.entries(ONBOARDING_SLIDE_TO_MENU_ID).find(
      ([id, mid]) => mid === menuId && id !== "earn_buddy" && id !== "earn_challenge"
    )?.[0] ?? null
  );
}
