import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { getOAuthBridgeOrigin, MOBILE_OAUTH_CALLBACK_PATH, PREVIEW_AUTH_PATH } from "@/core/config/website";

const NATIVE_SCHEME = "edublast";

/**
 * OAuth return URL — preview-raknas-amu forwards tokens/code here after Google sign-in.
 */
export function getAppOAuthCallbackUrl(): string {
  if (Constants.appOwnership === "expo") {
    return Linking.createURL("auth/callback");
  }
  return `${NATIVE_SCHEME}://auth/callback`;
}

export function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

export function isAppOAuthCallbackUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    trimmed.startsWith("edublast://auth/callback") ||
    (trimmed.startsWith("exp://") && trimmed.includes("/auth/callback"))
  );
}

export function isOAuthResultUrl(url: string): boolean {
  if (isAppOAuthCallbackUrl(url)) return true;
  if (!/^https?:\/\//i.test(url)) return false;
  if (url.includes("access_token=") || url.includes("code=")) return true;
  if (url.includes("error=") || url.includes("oauth_exchange_failed")) return true;
  return false;
}

/** Supabase dashboard → Redirect URLs */
export function supabaseRedirectAllowListHint(): string {
  const bridge = `${getOAuthBridgeOrigin()}${MOBILE_OAUTH_CALLBACK_PATH}**`;
  const app = getAppOAuthCallbackUrl();
  return (
    "Supabase → Authentication → URL Configuration → Redirect URLs:\n" +
    `${bridge}\n` +
    (isExpoGo() ? `${app}\nexp://**` : "edublast://auth/callback")
  );
}
