import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  applyPurchasedCouponRdmCredit,
  creditTeacherRdmBalance,
  readTeacherRdmBalance,
  type PurchasedCouponRow,
} from "@/lib/teacherPortal/creditTeacherRdmBalance";

export async function POST(request: Request) {
  try {
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

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Failed to verify user profile" }, { status: 500 });
    }

    if (profile.role !== "teacher") {
      return NextResponse.json({ error: "Only teachers can redeem RDM top-up coupons" }, { status: 403 });
    }

    const { data: couponData, error: couponError } = await (admin as typeof admin & {
      from: (t: string) => any;
    })
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

    const coupon = couponData as PurchasedCouponRow & {
      restricted_to_teacher_ids?: string[] | null;
      is_purchased?: boolean;
      bought_by_teacher_id?: string | null;
    };

    if (coupon.balance_applied_at) {
      const newBalance = await readTeacherRdmBalance(admin, user.id);
      return NextResponse.json({
        ok: true,
        rdmAmount: coupon.rdm_amount,
        newBalance,
        message: `This coupon was already applied. Current balance: ${newBalance} RDM`,
        alreadyRedeemed: true,
      });
    }

    if (coupon.status === "expired") {
      return NextResponse.json({ error: "This coupon is already redeemed or expired" }, { status: 400 });
    }

    if (coupon.restricted_to_teacher_ids && coupon.restricted_to_teacher_ids.length > 0) {
      if (!coupon.restricted_to_teacher_ids.includes(user.id)) {
        return NextResponse.json({ error: "This coupon is not valid for your account" }, { status: 403 });
      }
    }

    if (coupon.is_purchased && coupon.bought_by_teacher_id !== user.id) {
      return NextResponse.json(
        { error: "This coupon is linked to a different account and cannot be redeemed by you" },
        { status: 403 },
      );
    }

    if (!coupon.is_purchased && coupon.status !== "active") {
      return NextResponse.json({ error: "This coupon is already redeemed or expired" }, { status: 400 });
    }

    let newBalance: number;
    if (coupon.is_purchased) {
      newBalance = await applyPurchasedCouponRdmCredit(admin, user.id, coupon);
    } else {
      newBalance = await creditTeacherRdmBalance(admin, user.id, coupon.rdm_amount);
      const now = new Date().toISOString();
      const { error: updateError } = await (admin as typeof admin & { from: (t: string) => any })
        .from("coupons")
        .update({
          status: "redeemed",
          redeemed_at: now,
          redeemed_by_teacher_id: user.id,
          balance_applied_at: now,
        })
        .eq("id", coupon.id);

      if (updateError) {
        return NextResponse.json({ error: "Failed to redeem coupon" }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      rdmAmount: coupon.rdm_amount,
      newBalance,
      message: `Successfully credited ${coupon.rdm_amount} RDM to your balance`,
    });
  } catch (e) {
    console.error("redeem coupon error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 },
    );
  }
}
