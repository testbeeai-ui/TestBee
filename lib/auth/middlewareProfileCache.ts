import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionProfile = {
  role: string | null;
  onboardingComplete: boolean;
};

const TTL_MS = 60 * 1000;

/** Bounded so a long-lived server instance cannot grow this without limit. */
const MAX_ENTRIES = 500;

const cache = new Map<string, { value: SessionProfile; expiresAt: number }>();

function readCached(userId: string): SessionProfile | null {
  const hit = cache.get(userId);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(userId);
    return null;
  }
  return hit.value;
}

function writeCached(userId: string, value: SessionProfile): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(userId, { value, expiresAt: Date.now() + TTL_MS });
}

export function invalidateSessionProfile(userId: string): void {
  cache.delete(userId);
}

/**
 * Reads the role / onboarding flags the middleware routes on, avoiding a DB round
 * trip on every navigation.
 *
 * Only fully-onboarded users are cached. Someone still onboarding has flags that
 * change from under us, and serving those stale would strand them on the waitlist
 * gate; their reads stay live. Role changes for settled accounts are rare, so up
 * to `TTL_MS` of staleness there is an acceptable trade for dropping a ~165ms hop.
 */
export async function loadSessionProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<SessionProfile | null> {
  const cached = readCached(userId);
  if (cached) return cached;

  const { data } = await supabase
    .from("profiles")
    .select("role, onboarding_complete")
    .eq("id", userId)
    .maybeSingle<{ role: string | null; onboarding_complete: boolean | null }>();

  if (!data) return null;

  const profile: SessionProfile = {
    role: data.role ?? null,
    onboardingComplete: data.onboarding_complete === true,
  };
  if (profile.onboardingComplete) writeCached(userId, profile);
  return profile;
}
