import { createHmac, timingSafeEqual } from "crypto";
import { normalizeRazorpayEnvValue } from "@/lib/razorpay/razorpayEnv";

export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, receivedBuf);
}

export function getRazorpayKeySecret(): string | null {
  return normalizeRazorpayEnvValue(process.env.RAZORPAY_KEY_SECRET);
}
