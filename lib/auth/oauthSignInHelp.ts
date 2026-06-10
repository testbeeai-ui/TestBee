import { PREVIEW_AUTH_PATH } from "@/lib/auth/previewAuthPath";

export function oauthSignInFailedMessage(hostname?: string): string {
  const host = hostname?.trim() || "this site";
  return [
    `Google sign-in did not complete on ${host}.`,
    "",
    "Try this:",
    "1. Open the approval email and use the www.edublast.in sign-in link (not an old ?code= URL).",
    "2. Click Sign in with Google using the same email that was approved.",
    "3. If it still fails, clear site data for this browser (remove cookies/localStorage keys starting with sb-), then try again.",
    "",
    "For admins: in Vercel, NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be from the same Supabase project. In Supabase → Authentication → URL Configuration, add https://www.edublast.in/auth/callback and set Site URL to https://www.edublast.in.",
  ].join("\n");
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
