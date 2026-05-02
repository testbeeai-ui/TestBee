/**
 * Validates post-login redirect targets from untrusted query params (open-redirect guard).
 * Allows same-origin paths with optional query string.
 */
export function getSafeInternalNextPath(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.startsWith("/")) return null;
  if (t.startsWith("//")) return null;
  if (t.includes("://")) return null;
  if (t.includes("\\")) return null;
  const lower = t.toLowerCase();
  if (lower.includes("javascript:") || lower.includes("@")) return null;
  if (t.length > 2048) return null;
  return t;
}

const PENDING_KEY = "auth_pending_deep_link";

export function persistPendingDeepLink(path: string | null | undefined): void {
  const safe = getSafeInternalNextPath(path ?? null);
  if (!safe || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PENDING_KEY, safe);
  } catch {
    /* ignore */
  }
}

export function readPendingDeepLink(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return getSafeInternalNextPath(sessionStorage.getItem(PENDING_KEY));
  } catch {
    return null;
  }
}

export function clearPendingDeepLink(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/** OAuth stores a fallback in `auth_redirect_after_login`; ignore generic onboarding targets. */
export function destinationFromOAuthStored(stored: string | null): string | null {
  const s = getSafeInternalNextPath(stored);
  if (!s) return null;
  if (s === "/onboarding" || s.startsWith("/onboarding?")) return null;
  return s;
}

/** Append `next` to auth/marketing links when user opened a shared deep link. */
export function withNextQuery(href: string, nextPath: string | null | undefined): string {
  const safe = getSafeInternalNextPath(nextPath ?? null);
  if (!safe) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}next=${encodeURIComponent(safe)}`;
}
