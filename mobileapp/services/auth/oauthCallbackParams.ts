export type OAuthCallbackParams = {
  code?: string;
  accessToken?: string;
  refreshToken?: string;
};

/** Parse PKCE ?code= or implicit #access_token= from OAuth callback URL. */
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
