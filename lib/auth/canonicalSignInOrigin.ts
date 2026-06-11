import { getPortalBaseUrl } from "@/lib/email/portalBaseUrl";

/** Production sign-in origin (www.edublast.in). */
export function getCanonicalSiteOrigin(): string {
  return getPortalBaseUrl();
}

/** Vercel branch/preview hostnames must not run Google OAuth — PKCE + Supabase URLs won't match. */
export function isVercelPreviewHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (!h || h === "localhost" || h.startsWith("127.0.0.1")) return false;

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
