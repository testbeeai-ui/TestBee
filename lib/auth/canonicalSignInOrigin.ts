import { EDUBLAST_PUBLIC_ORIGIN } from "@/lib/email/portalBaseUrl";

/** Production sign-in origin — never a Vercel preview or localhost. */
export function getCanonicalSiteOrigin(): string {
  return EDUBLAST_PUBLIC_ORIGIN;
}

export function isLocalDevHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  return h === "localhost" || h.startsWith("127.0.0.1");
}

/** Vercel branch/preview hostnames must not run Google OAuth — PKCE + Supabase URLs won't match. */
export function isVercelPreviewHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (!h || isLocalDevHostname(h)) return false;

  let canonicalHost: string;
  try {
    canonicalHost = new URL(getCanonicalSiteOrigin()).hostname.toLowerCase();
  } catch {
    return h.endsWith(".vercel.app");
  }

  if (h === canonicalHost) return false;
  if (h === canonicalHost.replace(/^www\./, "")) return false;
  if (canonicalHost.startsWith("www.") && h === canonicalHost.slice(4)) return false;

  return h.endsWith(".vercel.app");
}
