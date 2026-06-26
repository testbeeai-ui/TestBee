const KEY_PREFIX = "edublast.site-tour-carousel-state-v1";

export type SiteTourCarouselPersistedState = {
  ci: number;
  earned: number;
  doneIds: string[];
};

function storageKey(userId: string | undefined): string | null {
  if (!userId || typeof window === "undefined") return null;
  return `${KEY_PREFIX}:${userId}`;
}

export function loadSiteTourCarouselState(
  userId: string | undefined
): SiteTourCarouselPersistedState | null {
  const key = storageKey(userId);
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SiteTourCarouselPersistedState;
    if (typeof parsed.ci !== "number" || !Array.isArray(parsed.doneIds)) return null;
    return {
      ci: Math.max(0, parsed.ci),
      earned: typeof parsed.earned === "number" ? parsed.earned : 0,
      doneIds: parsed.doneIds.filter((id) => typeof id === "string"),
    };
  } catch {
    return null;
  }
}

export function saveSiteTourCarouselState(
  userId: string | undefined,
  state: SiteTourCarouselPersistedState
): void {
  const key = storageKey(userId);
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export function clearSiteTourCarouselState(userId: string | undefined): void {
  const key = storageKey(userId);
  if (!key) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
