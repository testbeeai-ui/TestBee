import {
  getCanonicalSiteOrigin,
  isLocalDevHostname,
  isVercelPreviewHostname,
} from "@/lib/auth/canonicalSignInOrigin";
import {
  isUnableToExchangeExternalCode,
  supabaseGoogleOAuthRedirectUri,
} from "@/lib/auth/oauthProviderCallbackError";
import { PREVIEW_AUTH_PATH } from "@/lib/auth/previewAuthPath";

export function productionSignInUrl(): string {
  return `${getCanonicalSiteOrigin()}${PREVIEW_AUTH_PATH}?mode=signin&role=student`;
}

export function oauthTryAgainPathForHost(hostname: string): string {
  if (isVercelPreviewHostname(hostname)) {
    return productionSignInUrl();
  }
  return `${PREVIEW_AUTH_PATH}?mode=signin`;
}

function supabaseProjectUrlForHelp(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return "https://<your-project>.supabase.co";
}

export function oauthSignInFailedMessage(
  hostname?: string,
  errorDescription?: string | null
): string {
  const host = hostname?.trim() || "this site";
  const signInUrl = productionSignInUrl();
  const onPreview = isVercelPreviewHostname(host);
  const onLocal = isLocalDevHostname(host);
  const supabaseUrl = supabaseProjectUrlForHelp();
  const googleRedirect = supabaseGoogleOAuthRedirectUri(supabaseUrl);

  const lines = [`Google sign-in did not complete on ${host}.`, ""];

  // Supabase ↔ Google handshake failed (wrong Client Secret / redirect URI).
  if (isUnableToExchangeExternalCode(errorDescription)) {
    lines.push(
      "Supabase could not finish Google's login handshake (Unable to exchange external code).",
      "",
      "Admin fix (this is not a localhost cookie issue):",
      "1. Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Web client",
      "2. Authorized redirect URIs must include exactly:",
      `   ${googleRedirect}`,
      "3. Supabase → Authentication → Providers → Google: Client ID + Client Secret must be from that same Web client.",
      "4. Save, wait ~1 minute, then sign in again from http://localhost:3000 (or www.edublast.in).",
      ""
    );
    return lines.join("\n");
  }

  if (onLocal) {
    lines.push(
      "Stay on http://localhost:3000 (not 127.0.0.1).",
      "Supabase Redirect URLs must include http://localhost:3000/auth/callback.",
      "Then click Try again on this same local site.",
      ""
    );
  } else if (onPreview) {
    lines.push(
      "You are on a Vercel preview URL. Google sign-in only works on the live site:",
      signInUrl,
      ""
    );
  }

  if (!onLocal) {
    lines.push(
      "Try this:",
      `1. Open ${signInUrl} (from the approval email — not a ?code= URL).`,
      "2. Click Sign in with Google using the same email that was approved.",
      "3. Clear site data for this browser (cookies/localStorage keys starting with sb-), then try again on www.edublast.in only.",
      "",
      "For admins: Vercel NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY must match one Supabase project. Supabase → Authentication → URL Configuration: Site URL https://www.edublast.in, redirect https://www.edublast.in/auth/callback."
    );
  } else {
    lines.push(
      "If it still fails, clear cookies for localhost, restart `npm run dev`, and sign in again from http://localhost:3000."
    );
  }

  return lines.join("\n");
}

export function oauthTryAgainPath(): string {
  if (typeof window !== "undefined") {
    return oauthTryAgainPathForHost(window.location.hostname);
  }
  return `${PREVIEW_AUTH_PATH}?mode=signin`;
}
