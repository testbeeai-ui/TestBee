import { PREVIEW_AUTH_LEGACY_PATHS, PREVIEW_AUTH_PATH } from "@/lib/auth/previewAuthPath";

/**
 * Paths that must be reachable without a Supabase session (Edge middleware).
 * Keep in sync with marketing/auth flows — everything else requires login.
 */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;

  const publicPrefixes = [
    "/auth",
    "/auth-choice",
    "/contact",
    "/pricing",
    "/razorpay-demo",
    "/select-role",
    "/join",
    "/news-blog",
    "/terms-conditions",
    "/waitlist",
    PREVIEW_AUTH_PATH,
    ...PREVIEW_AUTH_LEGACY_PATHS,
    "/integrations/google/oauth-complete",
  ] as const;

  for (const prefix of publicPrefixes) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }

  return false;
}

/** Pathname (+ optional query) safe to open without login when stored in `?next=`. */
export function isPublicDeepLinkTarget(raw: string | null | undefined): boolean {
  const safe = raw?.trim();
  if (!safe || !safe.startsWith("/")) return false;
  const pathname = safe.split("?")[0]?.split("#")[0] ?? "";
  if (!pathname || pathname === "/") return false;
  if (pathname.startsWith("/auth")) return false;
  return isPublicPath(pathname);
}
