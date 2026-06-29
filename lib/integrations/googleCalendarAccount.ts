import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchPrimaryCalendarEmail,
  refreshAccessToken,
} from "@/lib/integrations/googleCalendarServer";
import { getGoogleOAuthEnv } from "@/lib/integrations/googleEnv";

/** Persist connected Google account email on the teacher profile (Meet host hint). */
export async function persistTeacherGoogleCalendarEmail(
  admin: SupabaseClient,
  userId: string,
  email: string | null | undefined
): Promise<void> {
  const trimmed = email?.trim();
  if (!trimmed) return;
  await admin
    .from("profiles")
    .update({ google_calendar_email: trimmed, updated_at: new Date().toISOString() })
    .eq("id", userId);
}

/**
 * Read stored email or resolve from Calendar API using the refresh token (backfill for older connects).
 */
export async function ensureTeacherGoogleCalendarEmail(
  admin: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: profile } = await admin
    .from("profiles")
    .select("google_calendar_email, google_connected")
    .eq("id", userId)
    .maybeSingle();

  const stored = (profile as { google_calendar_email?: string | null } | null)?.google_calendar_email;
  if (typeof stored === "string" && stored.trim()) return stored.trim();

  const { data: tok } = await admin
    .from("teacher_google_calendar_tokens")
    .select("refresh_token")
    .eq("user_id", userId)
    .maybeSingle();

  const refreshToken =
    typeof tok?.refresh_token === "string" ? tok.refresh_token.trim() : "";
  if (!refreshToken) return null;

  try {
    const { clientId, clientSecret } = getGoogleOAuthEnv();
    const refreshed = await refreshAccessToken({ refreshToken, clientId, clientSecret });
    const email = await fetchPrimaryCalendarEmail(refreshed.access_token);
    if (email) await persistTeacherGoogleCalendarEmail(admin, userId, email);
    return email;
  } catch {
    return null;
  }
}
