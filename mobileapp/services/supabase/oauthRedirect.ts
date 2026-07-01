import { getAppOAuthCallbackUrl } from "@/services/auth/oauthDeepLink";
import { getOAuthBridgeOrigin, MOBILE_OAUTH_CALLBACK_PATH } from "@/core/config/website";
import { parseOAuthCallbackParams, type OAuthCallbackParams } from "@/services/auth/oauthCallbackParams";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "./client";

/**
 * Minimal bridge page — no website sign-in UI. Forwards tokens/code into the app.
 * @see app/auth/mobile-callback/page.tsx
 */
export function getSupabaseOAuthRedirectUrl(): string {
  const url = new URL(MOBILE_OAUTH_CALLBACK_PATH, getOAuthBridgeOrigin());
  url.searchParams.set("return_to", getAppOAuthCallbackUrl());
  return url.toString();
}

export { getAppOAuthCallbackUrl };

export function parseOAuthCodeFromCallback(callbackUrl: string): string | null {
  return parseOAuthCallbackParams(callbackUrl).code ?? null;
}

export async function completeSessionFromCallbackUrl(callbackUrl: string): Promise<Session | null> {
  const params = parseOAuthCallbackParams(callbackUrl);
  const supabase = getSupabaseClient();

  if (params.accessToken && params.refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });
    if (error) throw error;
    return data.session ?? null;
  }

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return data.session ?? null;
  }

  return null;
}

export function describeOAuthCallbackParams(params: OAuthCallbackParams): string {
  if (params.accessToken) return "hash_tokens";
  if (params.code) return "pkce_code";
  return "empty";
}

export function oauthCallbackErrorMessage(callbackUrl: string): string | null {
  const decoded = decodeURIComponent(callbackUrl);
  if (decoded.includes("/auth/callback/finish") || decoded.includes("/auth/callback?")) {
    return (
      "OAuth hit the website /auth/callback instead of the mobile bridge. Add Supabase redirect URL: " +
      `${getOAuthBridgeOrigin()}${MOBILE_OAUTH_CALLBACK_PATH}**`
    );
  }

  try {
    const hashIndex = callbackUrl.indexOf("#");
    const queryIndex = callbackUrl.indexOf("?");
    const query =
      queryIndex >= 0 ? callbackUrl.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined) : "";
    const params = new URLSearchParams(query);
    const desc = params.get("error_description");
    const err = params.get("error");
    if (desc) return decodeURIComponent(desc.replace(/\+/g, " "));
    if (err) return err;
  } catch {
    /* ignore */
  }

  return null;
}
