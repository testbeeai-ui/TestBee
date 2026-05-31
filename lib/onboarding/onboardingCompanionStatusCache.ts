/**
 * Short TTL cache for onboarding companion status GETs (12s polls on profile / refer-earn).
 */

const STATUS_CACHE_TTL_MS = 10_000;

type CacheEntry<T> = { at: number; data: T };

const caches = new Map<string, CacheEntry<unknown>>();
const inFlights = new Map<string, Promise<unknown>>();

export async function fetchWithStatusCache<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = caches.get(key);
  if (hit && now - hit.at < STATUS_CACHE_TTL_MS) {
    return hit.data as T;
  }

  const pending = inFlights.get(key);
  if (pending) {
    return pending as Promise<T>;
  }

  const promise = (async () => {
    try {
      const data = await fetcher();
      caches.set(key, { at: Date.now(), data });
      return data;
    } finally {
      inFlights.delete(key);
    }
  })();

  inFlights.set(key, promise);
  return promise as Promise<T>;
}

export function invalidateOnboardingCompanionStatusCache(prefix?: string): void {
  if (!prefix) {
    caches.clear();
    inFlights.clear();
    return;
  }
  for (const key of caches.keys()) {
    if (key.startsWith(prefix)) caches.delete(key);
  }
  for (const key of inFlights.keys()) {
    if (key.startsWith(prefix)) inFlights.delete(key);
  }
}
