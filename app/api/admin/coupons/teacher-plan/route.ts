import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { generateSubscriptionCouponCode } from "@/lib/subscription/subscriptionCouponUtils";

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const { data: coupons, error } = await (admin as any)
      .from("teacher_subscription_coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ coupons: coupons ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const planTier = String(body.planTier ?? "").trim().toLowerCase();
    const durationMonths = Math.max(1, Math.min(24, Number(body.durationMonths ?? 1)));
    const count = Math.max(1, Math.min(100, Number(body.count ?? 1)));
    const restrictedToTeacherIds = Array.isArray(body.restrictedToTeacherIds)
      ? body.restrictedToTeacherIds.filter((id: unknown) => typeof id === "string" && id.trim())
      : null;

    if (planTier !== "starter" && planTier !== "pro") {
      return NextResponse.json({ error: "Invalid plan. Use starter (Basic) or pro (Premium)." }, { status: 400 });
    }

    const inserts: Record<string, unknown>[] = [];
    if (restrictedToTeacherIds && restrictedToTeacherIds.length > 0) {
      for (const teacherId of restrictedToTeacherIds) {
        inserts.push({
          code: generateSubscriptionCouponCode(),
          plan_tier: planTier,
          duration_months: durationMonths,
          restricted_to_teacher_ids: [teacherId],
          status: "active",
        });
      }
    } else {
      for (let i = 0; i < count; i++) {
        inserts.push({
          code: generateSubscriptionCouponCode(),
          plan_tier: planTier,
          duration_months: durationMonths,
          restricted_to_teacher_ids: null,
          status: "active",
        });
      }
    }

    const { data, error } = await (admin as any)
      .from("teacher_subscription_coupons")
      .insert(inserts)
      .select("*");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, coupons: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "Coupon id is required" }, { status: 400 });
    }

    const { error } = await (admin as any)
      .from("teacher_subscription_coupons")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
