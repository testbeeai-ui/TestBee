import type { PublicProfile } from "@/lib/profile/publicProfileService";

export const PUBLIC_PROFILE_CLIENT_TTL_MS = 60_000;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type CacheEntry = {
  profile: PublicProfile | null;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<PublicProfile | null>>();

function nowMs(): number {
  return Date.now();
}

function isPublicProfile(value: unknown): value is PublicProfile {
  return Boolean(value && typeof value === "object" && "id" in value);
}

export function invalidatePublicProfileClientCache(): void {
  cache.clear();
  inflight.clear();
}

/** Cached profile, `null` if fetched and missing, `undefined` on miss/expiry. */
export function peekPublicProfile(userId: string): PublicProfile | null | undefined {
  const entry = cache.get(userId);
  if (!entry) return undefined;
  if (entry.expiresAt <= nowMs()) {
    cache.delete(userId);
    return undefined;
  }
  return entry.profile;
}

async function fetchPublicProfile(
  userId: string,
  fetchFn: FetchLike
): Promise<PublicProfile | null> {
  const res = await fetchFn(`/api/public-profile/${userId}`, {
    credentials: "include",
  });
  const body: unknown = await res.json();
  if (!res.ok || !isPublicProfile(body)) return null;
  return body;
}

export function getPublicProfileCached(
  userId: string,
  fetchFn: FetchLike = fetch
): Promise<PublicProfile | null> {
  const hit = peekPublicProfile(userId);
  if (hit !== undefined) return Promise.resolve(hit);

  const pending = inflight.get(userId);
  if (pending) return pending;

  const request = fetchPublicProfile(userId, fetchFn)
    .then((profile) => {
      cache.set(userId, {
        profile,
        expiresAt: nowMs() + PUBLIC_PROFILE_CLIENT_TTL_MS,
      });
      return profile;
    })
    .finally(() => {
      inflight.delete(userId);
    });

  inflight.set(userId, request);
  return request;
}

export function prefetchPublicProfile(
  userId: string,
  fetchFn: FetchLike = fetch
): Promise<PublicProfile | null> {
  return getPublicProfileCached(userId, fetchFn);
}
