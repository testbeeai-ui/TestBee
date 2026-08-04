import type { SupabaseClient, User, UserAppMetadata, UserMetadata } from "@supabase/supabase-js";

/**
 * Caller identity backed purely by verified access-token claims.
 *
 * Deliberately narrower than Supabase's `User`: fields the JWT does not carry
 * (`created_at`, `last_sign_in_at`, `identities`, `factors`, …) are absent, so a
 * route that needs them fails to compile instead of silently reading a blank
 * value. Those routes should ask for the full record explicitly.
 */
export type AuthedUser = {
  id: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  aud: string | null;
  is_anonymous: boolean;
  app_metadata: UserAppMetadata;
  user_metadata: UserMetadata;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function authedUserFromUser(user: User): AuthedUser {
  return {
    id: user.id,
    email: asString(user.email),
    phone: asString(user.phone),
    role: asString(user.role),
    aud: asString(user.aud),
    is_anonymous: user.is_anonymous === true,
    app_metadata: user.app_metadata ?? {},
    user_metadata: user.user_metadata ?? {},
  };
}

/**
 * Verifies an access token without calling the Auth server.
 *
 * This project signs JWTs with an asymmetric key (ES256), so `getClaims()`
 * checks the signature locally via WebCrypto against a JWKS that auth-js caches
 * process-wide for 10 minutes — replacing a ~165ms cross-region round trip with
 * local CPU work. `getClaims()` degrades to a network `getUser()` by itself if
 * the token is symmetric or WebCrypto is unavailable, so this stays correct on
 * any runtime.
 *
 * Returns `null` for a missing, malformed, or expired token; callers decide
 * whether to reject or retry against the Auth server (which can refresh).
 */
export async function verifyClaims(
  client: SupabaseClient,
  jwt?: string
): Promise<{ user: AuthedUser; expiresAtMs: number | null } | null> {
  // Not every rejection arrives as `error`: a token missing `exp` (or otherwise
  // undecodable) throws a plain Error out of getClaims. Untrusted input must not
  // be able to turn a 401 into a 500.
  const result = await client.auth.getClaims(jwt).catch(() => null);
  if (!result) return null;

  const { data, error } = result;
  if (error || !data) return null;

  const { claims } = data;
  const id = asString(claims.sub);
  if (!id) return null;

  return {
    user: {
      id,
      email: asString(claims.email),
      phone: asString(claims.phone),
      role: asString(claims.role),
      aud: typeof claims.aud === "string" ? claims.aud : (claims.aud?.[0] ?? null),
      is_anonymous: claims.is_anonymous === true,
      app_metadata: claims.app_metadata ?? {},
      user_metadata: claims.user_metadata ?? {},
    },
    expiresAtMs: typeof claims.exp === "number" ? claims.exp * 1000 : null,
  };
}

export async function verifyAuthedUser(
  client: SupabaseClient,
  jwt?: string
): Promise<AuthedUser | null> {
  return (await verifyClaims(client, jwt))?.user ?? null;
}
