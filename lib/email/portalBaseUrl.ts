/** Canonical public deployment (logo, dashboard CTA, onboarding links in emails). */
export const EDUBLAST_PUBLIC_ORIGIN = "https://edublast.vercel.app";

/** Public site origin for links in transactional emails. */
export function getPortalBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  return EDUBLAST_PUBLIC_ORIGIN;
}
