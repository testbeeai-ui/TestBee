import { getRazorpayClient, parseRazorpayError } from "@/lib/razorpay/razorpayClient";

export type RazorpayApiPingResult = {
  ok: boolean;
  orderId?: string;
  error?: string;
};

/** Creates a ₹1 test order to verify key id + secret actually work with Razorpay API. */
export async function pingRazorpayApi(): Promise<RazorpayApiPingResult> {
  const client = getRazorpayClient();
  if (!client) {
    return { ok: false, error: "Razorpay client not configured" };
  }

  try {
    const order = await client.orders.create({
      amount: 100,
      currency: "INR",
      receipt: `ping_${Date.now()}`,
      notes: { purpose: "health_ping" },
    });
    return { ok: true, orderId: order.id };
  } catch (e) {
    const { message } = parseRazorpayError(e);
    return { ok: false, error: message };
  }
}
