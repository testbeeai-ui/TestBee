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
    "/select-role",
    "/join",
    "/news-blog",
    "/terms-conditions",
    "/integrations/google/oauth-complete",
  ] as const;

  for (const prefix of publicPrefixes) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }

  return false;
}
