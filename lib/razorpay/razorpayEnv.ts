/** Strip whitespace and wrapping quotes — common when pasting into Vercel env UI. */
export function normalizeRazorpayEnvValue(raw: string | undefined | null): string | null {
  if (raw == null || typeof raw !== "string") return null;
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value.length > 0 ? value : null;
}

/** Optional Razorpay Dashboard → Checkout configuration id (config_…). */
export function getRazorpayCheckoutConfigId(): string | null {
  return normalizeRazorpayEnvValue(process.env.RAZORPAY_CHECKOUT_CONFIG_ID);
}

export function razorpayKeyMode(keyId: string | null): "test" | "live" | "unknown" {
  if (!keyId) return "unknown";
  if (keyId.startsWith("rzp_test_")) return "test";
  if (keyId.startsWith("rzp_live_")) return "live";
  return "unknown";
}

export function maskRazorpayKeyId(keyId: string): string {
  if (keyId.length <= 12) return `${keyId.slice(0, 4)}…`;
  return `${keyId.slice(0, 12)}…`;
}

export type RazorpayEnvStatus = {
  keyIdPresent: boolean;
  keySecretPresent: boolean;
  publicKeyPresent: boolean;
  /** True when server key id matches NEXT_PUBLIC_RAZORPAY_KEY_ID (when both set). */
  publicKeyMatchesServer: boolean | null;
  keyMode: "test" | "live" | "unknown";
  keyIdPreview: string | null;
};

export function getRazorpayEnvStatus(): RazorpayEnvStatus {
  const keyId = normalizeRazorpayEnvValue(process.env.RAZORPAY_KEY_ID);
  const keySecret = normalizeRazorpayEnvValue(process.env.RAZORPAY_KEY_SECRET);
  const publicKey = normalizeRazorpayEnvValue(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID);

  let publicKeyMatchesServer: boolean | null = null;
  if (keyId && publicKey) {
    publicKeyMatchesServer = keyId === publicKey;
  }

  return {
    keyIdPresent: Boolean(keyId),
    keySecretPresent: Boolean(keySecret),
    publicKeyPresent: Boolean(publicKey),
    publicKeyMatchesServer,
    keyMode: razorpayKeyMode(keyId),
    keyIdPreview: keyId ? maskRazorpayKeyId(keyId) : null,
  };
}
