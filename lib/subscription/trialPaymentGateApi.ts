import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";

/** Remounts on /dive must not re-query profiles every time. */
const TRIAL_PAYMENT_GATE_TTL_MS = 60_000;

type GateCache = { at: number; userId: string; required: boolean };

let cached: GateCache | null = null;
let inFlight: Promise<boolean | null> | null = null;
let inFlightUserId: string | null = null;

export function invalidateTrialPaymentGateCache(): void {
  cached = null;
  inFlight = null;
  inFlightUserId = null;
}

/**
 * Session-deduped fetch for whether the trial-end payment gate must show.
 * Returns `null` on network/auth failure (caller keeps last known / client fallback).
 */
export async function fetchTrialPaymentGateRequired(
  userId: string,
  opts?: { fresh?: boolean }
): Promise<boolean | null> {
  const now = Date.now();
  if (
    !opts?.fresh &&
    cached &&
    cached.userId === userId &&
    now - cached.at < TRIAL_PAYMENT_GATE_TTL_MS
  ) {
    return cached.required;
  }

  if (!opts?.fresh && inFlight && inFlightUserId === userId) {
    return inFlight;
  }

  inFlightUserId = userId;
  inFlight = (async () => {
    try {
      const headers = await getClientApiAuthHeaders();
      const res = await fetch("/api/user/trial-payment-gate", {
        credentials: "same-origin",
        headers,
      });
      const body = (await res.json().catch(() => ({}))) as {
        required?: boolean;
      };
      if (res.ok && typeof body.required === "boolean") {
        cached = { at: Date.now(), userId, required: body.required };
        return body.required;
      }
      return null;
    } catch {
      return null;
    }
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
    inFlightUserId = null;
  }
}
