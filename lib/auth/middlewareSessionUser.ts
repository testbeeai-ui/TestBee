import type { SupabaseClient } from "@supabase/supabase-js";
import { type AuthedUser, authedUserFromUser, verifyClaims } from "@/lib/auth/verifiedUser";

/**
 * Go to the Auth server once the token has less than this left, so it is refreshed
 * (and new cookies written) well before it actually expires. Supabase's own margin
 * is 90s; a wider window absorbs a user idling mid-navigation.
 */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * Resolves the signed-in user for a page request, refreshing the session only when
 * it is actually close to expiring.
 *
 * The Supabase SSR middleware pattern calls `getUser()` on every navigation, which
 * costs a cross-region Auth round trip each time. A valid, non-expiring token needs
 * no refresh, so verifying it locally is enough — and the network path still runs
 * when a refresh is genuinely due, keeping cookie rotation intact.
 */
export async function resolveSessionUser(supabase: SupabaseClient): Promise<AuthedUser | null> {
  const verified = await verifyClaims(supabase);
  const refreshDue =
    verified?.expiresAtMs != null && verified.expiresAtMs - Date.now() <= REFRESH_MARGIN_MS;

  if (verified && !refreshDue) return verified.user;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? authedUserFromUser(user) : null;
}
