import {
  getCanonicalSiteOrigin,
  isLocalDevHostname,
  isVercelPreviewHostname,
} from "@/lib/auth/canonicalSignInOrigin";
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

export function oauthSignInFailedMessage(hostname?: string): string {
  const host = hostname?.trim() || "this site";
  const signInUrl = productionSignInUrl();
  const onPreview = isVercelPreviewHostname(host);
  const onLocal = isLocalDevHostname(host);

  const lines = [`Google sign-in did not complete on ${host}.`, ""];

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
