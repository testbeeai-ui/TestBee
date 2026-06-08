import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { createAdminClient } from "@/integrations/supabase/server";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";

export async function POST(request: Request) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user } = ctx;
    const body = await request.json().catch(() => ({}));
    const code = String(body.code ?? "").trim();

    if (!code) {
      return NextResponse.json({ error: "Coupon code is required" }, { status: 400 });
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
        { error: "Only teachers can redeem RDM top-up coupons" },
        { status: 403 }
      );
    }

    // Query coupon (using as any to bypass TS type constraints on new table)
    const { data: couponData, error: couponError } = await (admin as any)
      .from("coupons")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (couponError) {
      return NextResponse.json({ error: couponError.message }, { status: 500 });
    }

    if (!couponData) {
      return NextResponse.json({ error: "Invalid coupon code" }, { status: 400 });
    }

    const coupon = couponData as any;

    if (coupon.status !== "active") {
      return NextResponse.json(
        { error: "This coupon is already redeemed or expired" },
        { status: 400 }
      );
    }

    // Check restrictions
    if (coupon.restricted_to_teacher_ids && coupon.restricted_to_teacher_ids.length > 0) {
      if (!coupon.restricted_to_teacher_ids.includes(user.id)) {
        return NextResponse.json(
          { error: "This coupon is not valid for your account" },
          { status: 403 }
        );
      }
    }

    // Check purchased link
    if (coupon.is_purchased && coupon.bought_by_teacher_id !== user.id) {
      return NextResponse.json(
        { error: "This coupon is linked to a different account and cannot be redeemed by you" },
        { status: 403 }
      );
    }

    // Atomically mark as redeemed. Without the status predicate, concurrent
    // requests can all pass the read above and each credit RDM.
    const { data: redeemedRows, error: updateError } = await (admin as any)
      .from("coupons")
      .update({
        status: "redeemed",
        redeemed_at: new Date().toISOString(),
        redeemed_by_teacher_id: user.id,
      })
      .eq("id", coupon.id)
      .eq("status", "active")
      .select("id");

    if (updateError) {
      return NextResponse.json({ error: "Failed to redeem coupon" }, { status: 500 });
    }

    if (!redeemedRows?.length) {
      return NextResponse.json(
        { error: "This coupon is already redeemed or expired" },
        { status: 400 }
      );
    }

    // Call add_rdm rpc to credit teacher's balance
    const { data: newBalance, error: rpcError } = await admin.rpc("add_rdm", {
      uid: user.id,
      amt: coupon.rdm_amount,
    });

    if (rpcError) {
      // rollback coupon redemption on balance update failure
      await (admin as any)
        .from("coupons")
        .update({
          status: "active",
          redeemed_at: null,
          redeemed_by_teacher_id: null,
        })
        .eq("id", coupon.id);

      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      rdmAmount: coupon.rdm_amount,
      newBalance,
      message: `Successfully credited ${coupon.rdm_amount} RDM to your balance`,
    });
  } catch (e) {
    console.error("redeem coupon error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
