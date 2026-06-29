import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { exchangeAuthorizationCode, fetchPrimaryCalendarEmail } from "@/lib/integrations/googleCalendarServer";
import { persistTeacherGoogleCalendarEmail } from "@/lib/integrations/googleCalendarAccount";
import { getGoogleOAuthEnv } from "@/lib/integrations/googleEnv";
import { verifyGoogleOAuthState } from "@/lib/integrations/googleOAuthState";

function popupCompleteRedirect(
  request: NextRequest,
  result: "connected" | "error",
  reason?: string
) {
  const done = new URL("/integrations/google/oauth-complete", request.url);
  done.searchParams.set("result", result);
  if (reason) done.searchParams.set("reason", reason);
  return NextResponse.redirect(done);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const redirectBase = new URL("/teacher-portal", request.url);
  redirectBase.searchParams.set("section", "myClassroom");

  let popupFlow = false;
  try {
    if (state) {
      const verifiedEarly = await verifyGoogleOAuthState(state);
      popupFlow = verifiedEarly.popup;
    }
  } catch {
    // Invalid state — handled again below when code exists, or fail redirect.
  }

  const finishError = (reason: string) =>
    popupFlow
      ? popupCompleteRedirect(request, "error", reason)
      : NextResponse.redirect(
          (() => {
            redirectBase.searchParams.set("google", "error");
            redirectBase.searchParams.set("reason", reason);
            return redirectBase;
          })()
        );

  if (err) {
    return finishError(err);
  }
  if (!code || !state) {
    return finishError("missing_code");
  }

  const admin = createAdminClient();
  if (!admin) {
    return finishError("server_config");
  }

  try {
    const { userId, popup } = await verifyGoogleOAuthState(state);
    popupFlow = popup;
    const { clientId, clientSecret, redirectUri } = getGoogleOAuthEnv();
    const tokens = await exchangeAuthorizationCode({
      code,
      redirectUri,
      clientId,
      clientSecret,
    });

    if (!tokens.refresh_token) {
      return popupFlow
        ? popupCompleteRedirect(request, "error", "no_refresh_token")
        : NextResponse.redirect(
            (() => {
              redirectBase.searchParams.set("google", "error");
              redirectBase.searchParams.set("reason", "no_refresh_token");
              return redirectBase;
            })()
          );
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

    const calendarEmail = tokens.access_token
      ? await fetchPrimaryCalendarEmail(tokens.access_token)
      : null;
    await persistTeacherGoogleCalendarEmail(admin, userId, calendarEmail);

    const { error: profileErr } = await admin
      .from("profiles")
      .update({ google_connected: true, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (profileErr) throw profileErr;

    if (popupFlow) {
      return popupCompleteRedirect(request, "connected");
    }
    redirectBase.searchParams.set("google", "connected");
    return NextResponse.redirect(redirectBase);
  } catch {
    return popupFlow
      ? popupCompleteRedirect(request, "error", "callback_failed")
      : NextResponse.redirect(
          (() => {
            redirectBase.searchParams.set("google", "error");
            redirectBase.searchParams.set("reason", "callback_failed");
            return redirectBase;
          })()
        );
  }
}
