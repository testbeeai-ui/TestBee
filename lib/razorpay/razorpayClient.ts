import Razorpay from "razorpay";

export function getRazorpayClient(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    return null;
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export function getRazorpayPublicKeyId(): string | null {
  return process.env.RAZORPAY_KEY_ID?.trim() || null;
}

export interface RazorpayApiError {
  statusCode?: number;
  error?: {
    description?: string;
    code?: string;
  };
}

export function parseRazorpayError(e: unknown): { message: string; status: number } {
  if (e && typeof e === "object" && "statusCode" in e) {
    const err = e as RazorpayApiError;
    const message =
      err.error?.description ??
      (err.statusCode === 401 ? "Razorpay authentication failed" : "Failed to create order");
    const status = err.statusCode === 401 ? 401 : err.statusCode ?? 500;
    return { message, status: status >= 400 && status < 600 ? status : 500 };
  }

  if (e instanceof Error) {
    const lower = e.message.toLowerCase();
    const status =
      lower.includes("authentication") || lower.includes("unauthorized") ? 401 : 500;
    return { message: e.message, status };
  }

  return { message: "Razorpay request failed", status: 500 };
}
