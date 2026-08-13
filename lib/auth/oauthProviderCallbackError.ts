/**
 * Supabase Auth may redirect back to our /auth/callback with provider errors
 * instead of a PKCE `code` — e.g. Google token exchange failed on Supabase's side.
 */

export type OAuthProviderCallbackError = {
  error: string;
  errorDescription: string;
};

export function readOAuthProviderCallbackError(
  searchParams: URLSearchParams
): OAuthProviderCallbackError | null {
  const error = (searchParams.get("error") ?? "").trim();
  const errorDescription = (searchParams.get("error_description") ?? "").trim();
  if (!error && !errorDescription) return null;
  return {
    error: error || "oauth_provider_error",
    errorDescription: errorDescription || error || "unknown",
  };
}

export function isUnableToExchangeExternalCode(
  description: string | null | undefined
): boolean {
  if (!description) return false;
  return description.toLowerCase().includes("unable to exchange external code");
}

/** Project auth callback Google Cloud must allowlist. */
export function supabaseGoogleOAuthRedirectUri(supabaseUrl: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  return `${base}/auth/v1/callback`;
}
