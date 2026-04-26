import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { exchangeAuthorizationCode } from "@/lib/integrations/googleCalendarServer";
import { getGoogleOAuthEnv } from "@/lib/integrations/googleEnv";
import { verifyGoogleOAuthState } from "@/lib/integrations/googleOAuthState";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const redirectBase = new URL("/teacher-portal", request.url);
  redirectBase.searchParams.set("section", "myClassroom");

  if (err) {
    redirectBase.searchParams.set("google", "error");
    redirectBase.searchParams.set("reason", err);
    return NextResponse.redirect(redirectBase);
  }
  if (!code || !state) {
    redirectBase.searchParams.set("google", "error");
    redirectBase.searchParams.set("reason", "missing_code");
    return NextResponse.redirect(redirectBase);
  }

  const admin = createAdminClient();
  if (!admin) {
    redirectBase.searchParams.set("google", "error");
    redirectBase.searchParams.set("reason", "server_config");
    return NextResponse.redirect(redirectBase);
  }

  try {
    const userId = await verifyGoogleOAuthState(state);
    const { clientId, clientSecret, redirectUri } = getGoogleOAuthEnv();
    const tokens = await exchangeAuthorizationCode({
      code,
      redirectUri,
      clientId,
      clientSecret,
    });

    if (!tokens.refresh_token) {
      redirectBase.searchParams.set("google", "error");
      redirectBase.searchParams.set("reason", "no_refresh_token");
      return NextResponse.redirect(redirectBase);
    }

    const expiresAt =
      typeof tokens.expires_in === "number"
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null;

    const { error: upsertErr } = await admin.from("teacher_google_calendar_tokens").upsert(
      {
        user_id: userId,
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token ?? null,
        access_token_expires_at: expiresAt,
        scope: tokens.scope ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (upsertErr) throw upsertErr;

    const { error: profileErr } = await admin
      .from("profiles")
      .update({ google_connected: true, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (profileErr) throw profileErr;

    redirectBase.searchParams.set("google", "connected");
    return NextResponse.redirect(redirectBase);
  } catch {
    redirectBase.searchParams.set("google", "error");
    redirectBase.searchParams.set("reason", "callback_failed");
    return NextResponse.redirect(redirectBase);
  }
}
