import { NextResponse } from "next/server";
import { getRazorpayEnvStatus } from "@/lib/razorpay/razorpayEnv";

export const runtime = "nodejs";

/** Safe production diagnostic — no secrets, no Razorpay API calls. */
export async function GET() {
  const status = getRazorpayEnvStatus();
  const ready =
    status.keyIdPresent &&
    status.keySecretPresent &&
    (status.publicKeyMatchesServer === null || status.publicKeyMatchesServer);

  return NextResponse.json({
    ready,
    ...status,
    hint: ready
      ? "Env vars present. If checkout still fails, regenerate the key pair in Razorpay Dashboard and redeploy."
      : "Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and NEXT_PUBLIC_RAZORPAY_KEY_ID on Vercel Production (matching pair, no quotes), then redeploy.",
  });
}
