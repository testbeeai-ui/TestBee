import { NextResponse } from "next/server";
import {
  getRazorpayKeySecret,
  verifyRazorpayPaymentSignature,
} from "@/lib/razorpay/verifyPaymentSignature";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const keySecret = getRazorpayKeySecret();
    if (!keySecret) {
      return NextResponse.json({ error: "Razorpay credentials not configured" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const razorpay_order_id = String(body.razorpay_order_id ?? "").trim();
    const razorpay_payment_id = String(body.razorpay_payment_id ?? "").trim();
    const razorpay_signature = String(body.razorpay_signature ?? "").trim();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing razorpay_order_id, razorpay_payment_id, or razorpay_signature" },
        { status: 400 },
      );
    }

    const valid = verifyRazorpayPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      keySecret,
    );

    if (!valid) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    return NextResponse.json({
      verified: true,
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
    });
  } catch (e) {
    console.error("verify-payment error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
