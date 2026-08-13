function isHttpLocalhost(requestUrl: string): boolean {
  try {
    const url = new URL(requestUrl);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "http:" && (host === "localhost" || host === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

/** Session cookies from the OAuth callback must stick on http://localhost. */
export function authCallbackCookieOptions<T extends { path?: string; secure?: boolean; domain?: string }>(
  incoming: T,
  requestUrl: string
): T & { path: string; secure?: boolean; domain?: string } {
  const localHttp = isHttpLocalhost(requestUrl);
  return {
    ...incoming,
    path: incoming.path ?? "/",
    secure: localHttp ? false : incoming.secure,
    domain: localHttp ? undefined : incoming.domain,
  };
}
