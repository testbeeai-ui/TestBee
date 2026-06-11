/** Supabase Google OAuth PKCE `?code=` values are UUID-shaped (not classroom join codes). */
const OAUTH_CODE_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OAUTH_CODE_EXCLUDED_PREFIXES = [
  "/auth/callback",
  "/api/integrations/google",
  "/join",
] as const;

export function isOAuthAuthorizationCode(
  code: string | null | undefined
): code is string {
  if (!code?.trim()) return false;
  return OAUTH_CODE_RE.test(code.trim());
}

/** True when this path should forward `?code=` to `/auth/callback`. */
export function shouldRedirectOAuthCodeToCallback(pathname: string, code: string | null): boolean {
  if (!isOAuthAuthorizationCode(code)) return false;
  return !OAUTH_CODE_EXCLUDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
