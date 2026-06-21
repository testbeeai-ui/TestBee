import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import {
  computeSubscriptionCheckoutSummary,
  rdmPackAmountPaise,
  type PaidSubscriptionPlan,
} from "@/lib/subscription/subscriptionCheckoutSummary";
import type { BillingCycle } from "@/lib/subscription/subscriptionBilling";
import {
  getRazorpayClient,
  getRazorpayPublicKeyId,
  parseRazorpayError,
} from "@/lib/razorpay/razorpayClient";

export const runtime = "nodejs";

type OrderPurpose = "demo" | "subscription" | "rdm_pack";

function parseBillingCycle(raw: unknown): BillingCycle | null {
  const v = String(raw ?? "").trim().toLowerCase();
  return v === "monthly" || v === "annual" ? v : null;
}

function parsePaidPlan(raw: unknown): PaidSubscriptionPlan | null {
  const v = String(raw ?? "").trim().toLowerCase();
  return v === "starter" || v === "pro" ? v : null;
}

export async function POST(request: Request) {
  let purpose: OrderPurpose = "demo";
  try {
    const razorpay = getRazorpayClient();
    const keyId = getRazorpayPublicKeyId();
    if (!razorpay || !keyId) {
      return NextResponse.json(
        {
          error:
            "Razorpay credentials not configured on server. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel Production, then redeploy.",
        },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => ({}));
    purpose = String(body.purpose ?? "demo").trim() as OrderPurpose;
    const currency = String(body.currency ?? "INR").trim() || "INR";

    let amountPaise: number;
    let receipt: string;
    let notes: Record<string, string> = { purpose };

    if (purpose === "subscription") {
      const ctx = await getSupabaseAndUser(request);
      if (!ctx) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const plan = parsePaidPlan(body.plan);
      const billingCycle = parseBillingCycle(body.billingCycle);
      if (!plan || !billingCycle) {
        return NextResponse.json(
          { error: "Invalid plan or billing cycle for subscription checkout" },
          { status: 400 },
        );
      }

      const summary = computeSubscriptionCheckoutSummary(plan, billingCycle);
      amountPaise = summary.amountPaise;
      receipt = `sub_${ctx.user.id.slice(0, 8)}_${Date.now()}`;
      notes = {
        purpose: "subscription",
        user_id: ctx.user.id,
        plan,
        billing_cycle: billingCycle,
      };
    } else if (purpose === "rdm_pack") {
      const ctx = await getSupabaseAndUser(request);
      if (!ctx) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const packId = String(body.packId ?? "").trim();
      const paise = rdmPackAmountPaise(packId);
      if (!paise) {
        return NextResponse.json({ error: "Invalid RDM pack selected" }, { status: 400 });
      }

      amountPaise = paise;
      receipt = `rdm_${ctx.user.id.slice(0, 8)}_${Date.now()}`;
      notes = {
        purpose: "rdm_pack",
        user_id: ctx.user.id,
        pack_id: packId,
      };
    } else {
      amountPaise = Number(body.amount);
      if (!Number.isFinite(amountPaise) || amountPaise < 100) {
        return NextResponse.json(
          { error: "Amount must be at least 100 paise (₹1)" },
          { status: 400 },
        );
      }
      receipt =
        body.receipt != null ? String(body.receipt) : `demo_${Date.now()}`;
      notes = { purpose: "demo" };
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amountPaise),
      currency,
      receipt,
      notes,
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
      purpose,
    });
  } catch (e) {
    const { message, status, detail, code } = parseRazorpayError(e);
    console.error("create-order error", { purpose, e });
    return NextResponse.json(
      { error: message, purpose, razorpayDetail: detail, razorpayCode: code },
      { status },
    );
  }
}
