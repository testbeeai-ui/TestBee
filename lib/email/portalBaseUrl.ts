/** Canonical public site (approval links, logos, onboarding CTAs in emails). */
export const EDUBLAST_PUBLIC_ORIGIN = "https://www.edublast.in";

/**
 * Public site origin for links in transactional emails.
 * Never uses VERCEL_URL — preview deploy hostnames must not appear in approval/waitlist mail.
 */
export function getPortalBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return EDUBLAST_PUBLIC_ORIGIN;
}
