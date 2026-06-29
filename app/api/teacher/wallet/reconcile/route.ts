import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  applyPurchasedCouponRdmCredit,
  readTeacherRdmBalance,
  type PurchasedCouponRow,
} from "@/lib/teacherPortal/creditTeacherRdmBalance";

/** Applies any purchased coupons that were paid but never credited (NULL rdm bug / partial flow). */
export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", ctx.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Failed to verify user profile" }, { status: 500 });
    }

    if (profile.role !== "teacher") {
      return NextResponse.json({ error: "Teachers only" }, { status: 403 });
    }

    const { data: pendingRaw, error: listError } = await (admin as typeof admin & {
      from: (t: string) => any;
    })
      .from("coupons")
      .select(
        "id, code, rdm_amount, status, balance_applied_at, redeemed_at, redeemed_by_teacher_id"
      )
      .eq("bought_by_teacher_id", ctx.user.id)
      .eq("is_purchased", true)
      .is("balance_applied_at", null);

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    const pending = (pendingRaw ?? []) as unknown as PurchasedCouponRow[];
    let credited = 0;
    let newBalance = await readTeacherRdmBalance(admin, ctx.user.id);

    for (const coupon of pending) {
      newBalance = await applyPurchasedCouponRdmCredit(admin, ctx.user.id, coupon);
      credited += coupon.rdm_amount;
    }

    return NextResponse.json({
      ok: true,
      newBalance,
      pendingCount: pending.length,
      creditedRdm: credited,
    });
  } catch (e) {
    console.error("wallet reconcile error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 },
    );
  }
}
