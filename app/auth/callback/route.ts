import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/integrations/supabase/types";
import { authCallbackCookieOptions } from "@/lib/auth/authCallbackCookies";
import { shouldRetryOAuthExchangeOnClient } from "@/lib/auth/oauthCallbackRedirect";

/**
 * Exchange Google OAuth PKCE code on the server and attach session cookies.
 * Supabase redirect URL must be: {origin}/auth/callback
 *
 * On localhost, PKCE verifier cookies are often only readable in the browser.
 * If the server exchange fails for that reason, pass `code` through to /finish
 * so the browser client can complete sign-in.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  const finish = new URL("/auth/callback/finish", url.origin);

  if (code.length < 16) {
    finish.searchParams.set("error", "oauth_exchange_failed");
    finish.searchParams.set("error_description", "missing_code");
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
            response.cookies.set(name, value, {
              ...authCallbackCookieOptions(options ?? {}, request.url),
            })
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed", {
      message: error.message,
      status: error.status,
    });
    if (shouldRetryOAuthExchangeOnClient(error.message)) {
      finish.searchParams.set("code", code);
      return NextResponse.redirect(finish);
    }
    finish.searchParams.set("error", "oauth_exchange_failed");
    finish.searchParams.set("error_description", error.message);
    response = NextResponse.redirect(finish);
    return response;
  }

  return response;
}
