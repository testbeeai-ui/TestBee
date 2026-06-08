import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { createAdminClient } from "@/integrations/supabase/server";
import { enforceSameOriginForCookieAuth, isDangerousRouteEnabled } from "@/lib/auth/securityGuards";

const PACKS: Record<string, { rdm: number; price: number }> = {
  pack_500: { rdm: 500, price: 300 },
  pack_1000: { rdm: 1000, price: 500 },
  pack_2200: { rdm: 2200, price: 1000 },
};

function generateCouponCode(): string {
  const yearSuffix = new Date().getFullYear().toString().slice(-2); // e.g. "26"
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // Exclude confusing characters I, O
  const digits = "123456789"; // Exclude 0 to avoid confusion with O

  const startWithLetter = Math.random() < 0.5;
  let randomPart = "";
  for (let i = 0; i < 6; i++) {
    const pickLetter = startWithLetter ? i % 2 === 0 : i % 2 !== 0;
    if (pickLetter) {
      randomPart += letters.charAt(Math.floor(Math.random() * letters.length));
    } else {
      randomPart += digits.charAt(Math.floor(Math.random() * digits.length));
    }
  }
  return `${yearSuffix}${randomPart}`;
}

export async function POST(request: Request) {
  try {
    if (!isDangerousRouteEnabled("ALLOW_SIMULATED_PAYMENTS")) {
      return NextResponse.json(
        { error: "Payment verification is not configured." },
        { status: 403 }
      );
    }

    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user } = ctx;
    const body = await request.json().catch(() => ({}));
    const packId = String(body.packId ?? "").trim();
    const paymentMethod = String(body.paymentMethod ?? "upi").trim();

    const pack = PACKS[packId];
    if (!pack) {
      return NextResponse.json({ error: "Invalid RDM pack selected" }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Failed to verify user profile" }, { status: 500 });
    }

    if (profile.role !== "teacher") {
      return NextResponse.json(
        { error: "Only teachers can purchase RDM credits" },
        { status: 403 }
      );
    }

    const randomDigits = Math.floor(10000000 + Math.random() * 90000000).toString();
    const orderId = body.orderId || `pay_${randomDigits}`;

    const newCouponCode = generateCouponCode();

    const { data: coupon, error: insertError } = await (admin as any)
      .from("coupons")
      .insert({
        code: newCouponCode,
        rdm_amount: pack.rdm,
        restricted_to_teacher_ids: [user.id],
        is_purchased: true,
        bought_by_teacher_id: user.id,
        status: "active",
        order_id: orderId,
        payment_method: paymentMethod,
      })
      .select("*")
      .single();

    if (insertError || !coupon) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to create coupon code" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      code: coupon.code,
      rdmAmount: coupon.rdm_amount,
      price: pack.price,
      orderId,
    });
  } catch (e) {
    console.error("purchase coupon error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
