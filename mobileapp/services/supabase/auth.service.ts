import type { Session } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import { getSupabaseClient } from "./client";
import {
  completeSessionFromCallbackUrl,
  getAppOAuthCallbackUrl,
  getSupabaseOAuthRedirectUrl,
  oauthCallbackErrorMessage,
} from "./oauthRedirect";
import { getOAuthBridgeOrigin } from "@/core/config/website";
import type { MobileProfile } from "@/core/auth/session";

WebBrowser.maybeCompleteAuthSession();

export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session ?? null;
}

export async function refreshSession(): Promise<Session | null> {
  const { data, error } = await getSupabaseClient().auth.refreshSession();
  if (error) return null;
  return data.session ?? null;
}

export type SignInPhase = "browser" | "finishing";

/**
 * Google via Supabase → preview-raknas-amu (website) → deep link back with session tokens.
 */
export async function signInWithGoogle(
  onPhase?: (phase: SignInPhase) => void
): Promise<{ session: Session | null; profile: MobileProfile | null }> {
  const supabase = getSupabaseClient();
  const redirectTo = getSupabaseOAuthRedirectUrl();
  const appCallback = getAppOAuthCallbackUrl();

  if (__DEV__) {
    console.log("[auth] OAuth bridge origin:", getOAuthBridgeOrigin());
    console.log("[auth] Supabase redirectTo (mobile-callback):", redirectTo);
    console.log("[auth] App deep link (return_to):", appCallback);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data?.url) {
    throw new Error("Could not start Google sign-in.");
  }

  if (__DEV__) {
    try {
      const authorize = new URL(data.url);
      const actualRedirect = authorize.searchParams.get("redirect_to");
      console.log("[auth] Supabase authorize redirect_to:", actualRedirect);
      if (actualRedirect && !actualRedirect.includes("mobile-callback")) {
        console.warn(
          "[auth] Supabase replaced redirect — add to Supabase Redirect URLs:",
          `${getOAuthBridgeOrigin()}/auth/mobile-callback**`
        );
      }
    } catch {
      /* ignore */
    }
  }

  onPhase?.("browser");

  const result = await WebBrowser.openAuthSessionAsync(data.url, appCallback);

  if (result.type === "cancel" || result.type === "dismiss") {
    return { session: null, profile: null };
  }

  if (result.type !== "success") {
    throw new Error("Google sign-in did not complete.");
  }

  const errMsg = oauthCallbackErrorMessage(result.url);
  if (errMsg) throw new Error(errMsg);

  onPhase?.("finishing");

  const session = await completeSessionFromCallbackUrl(result.url);
  if (!session) {
    throw new Error("Sign-in returned no session. Close the browser tab and try again.");
  }

  return { session, profile: null };
}

export async function signOut(): Promise<void> {
  await getSupabaseClient().auth.signOut();
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getCurrentSession();
  return session?.access_token ?? null;
}
