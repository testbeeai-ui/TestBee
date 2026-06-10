import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/integrations/supabase/types";
import { isOAuthAuthorizationCode } from "@/lib/auth/oauthCallbackRedirect";

/**
 * Exchange Google OAuth PKCE code on the server and attach session cookies to the redirect.
 * Supabase redirect URL must be: {origin}/auth/callback
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const finish = new URL("/auth/callback/finish", url.origin);

  if (!isOAuthAuthorizationCode(code)) {
    return NextResponse.redirect(finish);
  }

  let response = NextResponse.redirect(finish);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.redirect(finish);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    finish.searchParams.set("error", "oauth_exchange_failed");
    finish.searchParams.set("error_description", error.message);
    response = NextResponse.redirect(finish);
    return response;
  }

  return response;
}
