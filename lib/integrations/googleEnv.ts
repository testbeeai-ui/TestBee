export type GoogleOAuthEnv = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/** Live Calendar OAuth callback — never localhost, even if env still points there. */
export const GOOGLE_PRODUCTION_REDIRECT_URI =
  "https://www.edublast.in/api/integrations/google/callback";

export function oauthHostFromHeaders(headers: {
  get(name: string): string | null;
}): string | null {
  return headers.get("x-forwarded-host") ?? headers.get("host");
}

function hostnameOf(hostHeader: string): string {
  return hostHeader.split(",")[0]?.trim().toLowerCase().split(":")[0] ?? "";
}

export function isProductionEdublastHost(hostHeader: string | null | undefined): boolean {
  const host = hostnameOf(hostHeader ?? "");
  return host === "www.edublast.in" || host === "edublast.in";
}

export function isLocalCalendarOAuthHost(hostHeader: string | null | undefined): boolean {
  const host = hostnameOf(hostHeader ?? "");
  return host === "localhost" || host === "127.0.0.1";
}

function isLocalRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(uri);
  }
}

/**
 * Live EduBlast must never send Google Calendar OAuth back to localhost.
 * Localhost env leftovers are ignored unless THIS request is actually localhost.
 */
export function resolveGoogleRedirectUri(hostHeader?: string | null): string {
  const vercelEnv = process.env.VERCEL_ENV?.trim();
  const fromEnv = process.env.GOOGLE_REDIRECT_URI?.trim() ?? "";
  const requestIsLocal = isLocalCalendarOAuthHost(hostHeader);

  if (
    isProductionEdublastHost(hostHeader) ||
    vercelEnv === "production" ||
    (!requestIsLocal && (!fromEnv || isLocalRedirectUri(fromEnv)))
  ) {
    return GOOGLE_PRODUCTION_REDIRECT_URI;
  }

  if (!fromEnv) {
    throw new Error(
      "Missing Google OAuth env: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI."
    );
  }
  return fromEnv;
}

export function getGoogleOAuthEnv(hostHeader?: string | null): GoogleOAuthEnv {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = resolveGoogleRedirectUri(hostHeader);
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing Google OAuth env: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI."
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
