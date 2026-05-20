"use client";

/** sessionStorage key for ?ref= captured on /join (7-char hex, uppercased). */
export const PENDING_REFERRAL_REF_KEY = "pending_referral_ref";

const HEX7 = /^[0-9A-F]{7}$/;

/** Normalize to 7-char uppercase hex or null if invalid. */
export function normalizeReferralRef(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const n = raw.trim().toUpperCase();
  if (!HEX7.test(n)) return null;
  return n;
}

export function persistPendingReferralRefFromUrl(refParam: string | null): void {
  const n = normalizeReferralRef(refParam);
  if (!n) return;
  try {
    sessionStorage.setItem(PENDING_REFERRAL_REF_KEY, n);
  } catch {
    /* ignore */
  }
}

export function getPendingReferralRef(): string | null {
  try {
    return normalizeReferralRef(sessionStorage.getItem(PENDING_REFERRAL_REF_KEY));
  } catch {
    return null;
  }
}

/**
 * Prefer `pending_referral_ref` (set when /join?ref= was opened). Fallback: parse `ref` from a
 * safe internal path like `/join?ref=...` stored as auth pending deep link (`next=` on /auth).
 */
export function resolvePendingReferralRef(alternatePathWithQuery: string | null): string | null {
  const direct = getPendingReferralRef();
  if (direct) return direct;
  if (!alternatePathWithQuery?.trim()) return null;
  try {
    const base =
      typeof window !== "undefined" ? window.location.origin : "https://placeholder.local";
    const u = new URL(alternatePathWithQuery, base);
    return normalizeReferralRef(u.searchParams.get("ref"));
  } catch {
    return null;
  }
}

export function clearPendingReferralRef(): void {
  try {
    sessionStorage.removeItem(PENDING_REFERRAL_REF_KEY);
  } catch {
    /* ignore */
  }
}
