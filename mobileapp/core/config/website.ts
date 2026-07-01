import { LOCAL_API_BASE_URL, LOCAL_OAUTH_BRIDGE_ORIGIN, LOCAL_WEB_ORIGIN } from "@/core/config/supabaseEnv.local";

const PRODUCTION_OAUTH_BRIDGE = "https://www.edublast.in";

function stripTrailingSlash(value: string): string {
  return value.trim().replace(/\/$/, "");
}

function isLanOrLocalhost(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return (
      host === "localhost" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.endsWith(".local")
    );
  } catch {
    return false;
  }
}

/** Next.js API + onboarding links — can be LAN during dev. */
export function getWebSiteOrigin(): string {
  const explicit = process.env.EXPO_PUBLIC_WEB_ORIGIN?.trim();
  if (explicit) return stripTrailingSlash(explicit);

  const fromGenerated = LOCAL_WEB_ORIGIN.trim();
  if (fromGenerated) return stripTrailingSlash(fromGenerated);

  const api = LOCAL_API_BASE_URL.trim().replace(/\/$/, "");
  if (/^https?:\/\//.test(api) && !api.includes("edublast.in")) {
    return api;
  }

  return PRODUCTION_OAUTH_BRIDGE;
}

/**
 * Where Supabase OAuth redirects after Google (preview-raknas-amu forwards into the app).
 *
 * Defaults to production — Supabase only accepts URLs on its allow list. LAN IPs are ignored
 * unless you add them in Supabase AND set EXPO_PUBLIC_USE_LAN_OAUTH_BRIDGE=1.
 */
export function getOAuthBridgeOrigin(): string {
  const explicit = process.env.EXPO_PUBLIC_OAUTH_BRIDGE_ORIGIN?.trim();
  if (explicit) return stripTrailingSlash(explicit);

  const useLan = process.env.EXPO_PUBLIC_USE_LAN_OAUTH_BRIDGE === "1";
  if (useLan) {
    const fromGenerated = LOCAL_OAUTH_BRIDGE_ORIGIN.trim();
    if (fromGenerated && !fromGenerated.includes("edublast.in")) {
      return stripTrailingSlash(fromGenerated);
    }
    const web = getWebSiteOrigin();
    if (isLanOrLocalhost(web)) return web;
  }

  return PRODUCTION_OAUTH_BRIDGE;
}

export const WEB_SITE_ORIGIN = getWebSiteOrigin();

export const PREVIEW_AUTH_PATH = "/preview-raknas-amu";

/** Mobile OAuth bridge — no sign-in UI, only forwards into the app. */
export const MOBILE_OAUTH_CALLBACK_PATH = "/auth/mobile-callback";

export const WEB_PREVIEW_SIGN_IN_URL = `${getWebSiteOrigin()}${PREVIEW_AUTH_PATH}?mode=signin&role=student`;

export const WEB_ONBOARDING_STUDENT_URL = `${getWebSiteOrigin()}/onboarding?role=student`;

export const WEB_CONTACT_URL = `${getWebSiteOrigin()}/contact`;
