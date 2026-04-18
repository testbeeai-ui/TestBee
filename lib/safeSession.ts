import type { AuthError, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

function isInvalidRefreshTokenError(error: AuthError | null): boolean {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("invalid refresh token") || msg.includes("refresh token not found");
}

/**
 * Reads session without leaving stale refresh tokens in local storage.
 * If Supabase reports an invalid/missing refresh token, we clear local auth state.
 */
export async function safeGetSession(): Promise<{ session: Session | null; error: AuthError | null }> {
  const { data, error } = await supabase.auth.getSession();
  if (isInvalidRefreshTokenError(error)) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    return { session: null, error };
  }
  return { session: data.session ?? null, error: error ?? null };
}
