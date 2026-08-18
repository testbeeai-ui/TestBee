import type { PublicProfile } from "@/lib/profile/publicProfileService";
import {
  chunkIds,
  hoverPreviewToPublicProfile,
  uniqueUserIds,
  type HoverPreviewBatchFn,
  type HoverPreviewRow,
} from "@/lib/profile/hoverPreview";

export const PUBLIC_PROFILE_CLIENT_TTL_MS = 60_000;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type CacheEntry = {
  profile: PublicProfile | null;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<PublicProfile | null>>();
const hoverInflight = new Map<string, Promise<PublicProfile | null>>();

function nowMs(): number {
  return Date.now();
}

function isPublicProfile(value: unknown): value is PublicProfile {
  return Boolean(value && typeof value === "object" && "id" in value);
}

function writeCache(userId: string, profile: PublicProfile | null): void {
  cache.set(userId, {
    profile,
    expiresAt: nowMs() + PUBLIC_PROFILE_CLIENT_TTL_MS,
  });
}

export function invalidatePublicProfileClientCache(): void {
  cache.clear();
  inflight.clear();
  hoverInflight.clear();
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

/** Warm the hover cache from a batched preview RPC (does not replace a live cache hit). */
export function primeHoverPreviews(rows: HoverPreviewRow[]): void {
  for (const row of rows) {
    if (!row.id || peekPublicProfile(row.id) !== undefined) continue;
    writeCache(row.id, hoverPreviewToPublicProfile(row));
  }
}

export async function prefetchHoverPreviews(
  userIds: string[],
  fetchBatch: HoverPreviewBatchFn
): Promise<void> {
  const unique = uniqueUserIds(userIds);
  const missing = unique.filter(
    (id) => peekPublicProfile(id) === undefined && !hoverInflight.has(id)
  );
  if (missing.length > 0) {
    const chunks = chunkIds(missing);
    const batch = (async () => {
      for (const chunk of chunks) {
        const rows = await fetchBatch(chunk);
        primeHoverPreviews(rows);
        const found = new Set(rows.map((r) => r.id));
        for (const id of chunk) {
          if (peekPublicProfile(id) === undefined && !found.has(id)) {
            writeCache(id, null);
          }
        }
      }
    })().finally(() => {
      for (const id of missing) hoverInflight.delete(id);
    });
    const shared = batch.then(() => null as PublicProfile | null);
    for (const id of missing) {
      hoverInflight.set(
        id,
        shared.then(() => peekPublicProfile(id) ?? null)
      );
    }
  }
  await Promise.all(
    unique.map((id) => hoverInflight.get(id) ?? Promise.resolve(peekPublicProfile(id) ?? null))
  );
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
      writeCache(userId, profile);
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
