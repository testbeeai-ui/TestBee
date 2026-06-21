import Razorpay from "razorpay";
import { normalizeRazorpayEnvValue } from "@/lib/razorpay/razorpayEnv";

function getRazorpayKeyId(): string | null {
  return (
    normalizeRazorpayEnvValue(process.env.RAZORPAY_KEY_ID) ??
    normalizeRazorpayEnvValue(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID)
  );
}

function getRazorpayKeySecret(): string | null {
  return normalizeRazorpayEnvValue(process.env.RAZORPAY_KEY_SECRET);
}

export function getRazorpayClient(): Razorpay | null {
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();
  if (!keyId || !keySecret) {
    return null;
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export function getRazorpayPublicKeyId(): string | null {
  return getRazorpayKeyId();
}

export interface RazorpayApiError {
  statusCode?: number;
  error?: {
    description?: string;
    code?: string;
  };
}

const RAZORPAY_KEY_MISMATCH_HINT =
  "Razorpay rejected your API keys. In Vercel Production, set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the same key pair from Razorpay Dashboard → API Keys (no quotes), match NEXT_PUBLIC_RAZORPAY_KEY_ID to the key id, then redeploy.";

export function parseRazorpayError(e: unknown): {
  message: string;
  status: number;
  detail: string | null;
  code: string | null;
} {
  if (e && typeof e === "object" && "statusCode" in e) {
    const err = e as RazorpayApiError;
    const description = err.error?.description?.trim() ?? "";
    const code = err.error?.code?.trim() ?? null;
    const isAuthFailure =
      err.statusCode === 401 ||
      /authentication failed|unauthorized/i.test(description);
    const message = isAuthFailure
      ? RAZORPAY_KEY_MISMATCH_HINT
      : description || "Failed to create order";
    const status = isAuthFailure ? 502 : err.statusCode ?? 500;
    return {
      message,
      status: status >= 400 && status < 600 ? status : 500,
      detail: description || null,
      code,
    };
  }

  if (e instanceof Error) {
    const lower = e.message.toLowerCase();
    const status =
      lower.includes("authentication") || lower.includes("unauthorized") ? 401 : 500;
    return { message: e.message, status, detail: e.message, code: null };
  }

  return { message: "Razorpay request failed", status: 500, detail: null, code: null };
}
