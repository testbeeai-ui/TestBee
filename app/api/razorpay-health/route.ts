import { NextResponse } from "next/server";
import { getRazorpayEnvStatus, getRazorpayCheckoutConfigId } from "@/lib/razorpay/razorpayEnv";
import { pingRazorpayApi } from "@/lib/razorpay/pingRazorpayApi";

export const runtime = "nodejs";

/** Safe production diagnostic — validates env vars and pings Razorpay API. */
export async function GET() {
  const status = getRazorpayEnvStatus();
  const envReady =
    status.keyIdPresent &&
    status.keySecretPresent &&
    (status.publicKeyMatchesServer === null || status.publicKeyMatchesServer);

  const apiPing = envReady ? await pingRazorpayApi() : { ok: false, error: "Env not ready" };

  const ready = envReady && apiPing.ok;

  const checkoutConfigId = getRazorpayCheckoutConfigId();

  return NextResponse.json({
    ready,
    envReady,
    apiPing,
    checkoutConfigIdPresent: Boolean(checkoutConfigId),
    ...status,
    hint: ready
      ? "Keys verified with Razorpay API. Checkout should work for demo and subscription."
      : !envReady
        ? "Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and NEXT_PUBLIC_RAZORPAY_KEY_ID on Vercel Production (matching pair, no quotes), then redeploy."
        : "Env vars present but Razorpay API rejected the key pair — regenerate Test keys in Dashboard and update all 3 vars on Vercel, then redeploy.",
  });
}
