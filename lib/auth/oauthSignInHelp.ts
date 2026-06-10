import { getCanonicalSiteOrigin, isVercelPreviewHostname } from "@/lib/auth/canonicalSignInOrigin";
import { PREVIEW_AUTH_PATH } from "@/lib/auth/previewAuthPath";

export function oauthSignInFailedMessage(hostname?: string): string {
  const host = hostname?.trim() || "this site";
  const canonical = getCanonicalSiteOrigin();
  const signInUrl = `${canonical}${PREVIEW_AUTH_PATH}?mode=signin&role=student`;
  const onPreview = isVercelPreviewHostname(host);

  const lines = [`Google sign-in did not complete on ${host}.`, ""];

  if (onPreview) {
    lines.push(
      `You are on a Vercel preview URL. Google sign-in only works on the live site:`,
      signInUrl,
      ""
    );
  }

  lines.push(
    "Try this:",
    `1. Open ${signInUrl} (from the approval email — not a ?code= URL).`,
    "2. Click Sign in with Google using the same email that was approved.",
    "3. Clear site data for this browser (cookies/localStorage keys starting with sb-), then try again on www.edublast.in only.",
    "",
    "For admins: Vercel NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY must match one Supabase project. Supabase → Authentication → URL Configuration: Site URL https://www.edublast.in, redirect https://www.edublast.in/auth/callback."
  );

  return lines.join("\n");
}

export function oauthTryAgainPath(): string {
  if (typeof window === "undefined") return PREVIEW_AUTH_PATH;
  try {
    const stored = sessionStorage.getItem("auth_entry_base");
    if (stored?.startsWith("/")) return `${stored}?mode=signin`;
  } catch {
    /* ignore */
  }
  return `${PREVIEW_AUTH_PATH}?mode=signin`;
}
