import { NextRequest, NextResponse } from "next/server";
import { isOAuthAuthorizationCode } from "@/lib/auth/oauthCallbackRedirect";
import { createClient } from "@/integrations/supabase/server";

/**
 * Exchange Google OAuth PKCE code on the server (cookies), then hand off to /auth/callback/finish.
 * Supabase redirect URL must be: {origin}/auth/callback
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const finish = new URL("/auth/callback/finish", url.origin);

  if (!isOAuthAuthorizationCode(code)) {
    return NextResponse.redirect(finish);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    finish.searchParams.set("error", "oauth_exchange_failed");
    finish.searchParams.set("error_description", error.message);
    return NextResponse.redirect(finish);
  }

  return NextResponse.redirect(finish);
}
