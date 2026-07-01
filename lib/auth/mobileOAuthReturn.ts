/** Allowed deep-link targets for mobile OAuth return (open-redirect guard). */
export function isAllowedMobileOAuthReturn(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.startsWith("edublast://") || trimmed.startsWith("exp://");
}

export function buildMobileAppReturnUrl(returnTo: string, code: string): string {
  const base = returnTo.trim();
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}code=${encodeURIComponent(code)}`;
}

/** Supabase sometimes returns tokens in the URL hash (#access_token=…) instead of ?code=. */
export function buildMobileAppReturnUrlWithHash(returnTo: string, hash: string): string {
  const base = returnTo.trim();
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  return `${base}#${fragment}`;
}

export type OAuthCallbackParams = {
  code?: string;
  accessToken?: string;
  refreshToken?: string;
};

/** Parse PKCE code (query) or implicit tokens (hash) from a callback URL. */
export function parseOAuthCallbackParams(callbackUrl: string): OAuthCallbackParams {
  const hashIndex = callbackUrl.indexOf("#");
  const queryIndex = callbackUrl.indexOf("?");

  let query = "";
  let hash = "";
  if (queryIndex >= 0) {
    query = callbackUrl.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined);
  }
  if (hashIndex >= 0) {
    hash = callbackUrl.slice(hashIndex + 1);
  }

  const queryParams = new URLSearchParams(query);
  const hashParams = new URLSearchParams(hash);

  const code = queryParams.get("code") ?? undefined;
  const accessToken = hashParams.get("access_token") ?? queryParams.get("access_token") ?? undefined;
  const refreshToken = hashParams.get("refresh_token") ?? queryParams.get("refresh_token") ?? undefined;

  return { code, accessToken, refreshToken };
}

/** Build exp:// / edublast:// target from OAuth landing query + hash. */
export function resolveMobileAppOAuthReturnTarget(
  returnTo: string | null | undefined,
  search: string,
  hash: string
): string | null {
  if (!isAllowedMobileOAuthReturn(returnTo)) return null;

  if (hash.includes("access_token=")) {
    return buildMobileAppReturnUrlWithHash(returnTo!, hash);
  }

  const code = new URLSearchParams(search).get("code");
  if (code) {
    return buildMobileAppReturnUrl(returnTo!, code);
  }

  return null;
}
