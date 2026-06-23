/** Razorpay EMI is typically shown only from ~₹3,000 (dashboard rules may vary). */
export const RAZORPAY_EMI_MIN_PAISE = 300_000;

export type RazorpayKeyMode = "test" | "live" | "unknown";

export function razorpayKeyModeFromKeyId(keyId: string | null | undefined): RazorpayKeyMode {
  if (!keyId) return "unknown";
  if (keyId.startsWith("rzp_test_")) return "test";
  if (keyId.startsWith("rzp_live_")) return "live";
  return "unknown";
}

export function isRazorpayEmiEligible(amountPaise: number): boolean {
  return Number.isFinite(amountPaise) && amountPaise >= RAZORPAY_EMI_MIN_PAISE;
}

/**
 * Standard Checkout: show all Razorpay-enabled methods (UPI, card, netbanking, wallet, pay later, EMI).
 * Uses dashboard defaults — never hide methods in code (that broke checkout without checkout_config_id).
 */
export function standardRazorpayCheckoutDisplayConfig() {
  return {
    display: {
      sequence: ["upi", "card", "netbanking", "wallet", "paylater", "emi"],
      preferences: {
        show_default_blocks: true,
      },
    },
  } as const;
}
