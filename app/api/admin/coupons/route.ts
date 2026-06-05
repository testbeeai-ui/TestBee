import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";

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

    // Load coupons (using as any to bypass TS type generation limits)
    const { data: coupons, error: couponsError } = await (admin as any)
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (couponsError) {
      return NextResponse.json({ error: couponsError.message }, { status: 500 });
    }

    // Filter rules:
    // Once expired/redeemed, promotional (non-paid) coupons are only shown for 28 days
    const nowMs = Date.now();
    const twentyEightDaysAgoMs = nowMs - 28 * 24 * 60 * 60 * 1000;

    const filteredCoupons = (coupons ?? []).filter((c: any) => {
      if (c.status !== "active" && !c.is_purchased) {
        // Promotional, expired/redeemed
        const redeemedTime = c.redeemed_at ? Date.parse(c.redeemed_at) : null;
        if (redeemedTime && redeemedTime < twentyEightDaysAgoMs) {
          return false;
        }
      }
      return true;
    });

    return NextResponse.json({ coupons: filteredCoupons });
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
    const rdmAmount = Number(body.rdmAmount);
    const count = Math.max(1, Math.min(100, Number(body.count ?? 1)));
    const restrictedToTeacherIds = Array.isArray(body.restrictedToTeacherIds)
      ? body.restrictedToTeacherIds.filter((id: any) => typeof id === "string" && id.trim())
      : null;

    if (!rdmAmount || rdmAmount <= 0) {
      return NextResponse.json({ error: "Invalid RDM amount" }, { status: 400 });
    }

    const inserts = [];
    if (restrictedToTeacherIds && restrictedToTeacherIds.length > 0) {
      for (const teacherId of restrictedToTeacherIds) {
        inserts.push({
          code: generateCouponCode(),
          rdm_amount: rdmAmount,
          restricted_to_teacher_ids: [teacherId],
          is_purchased: false,
          status: "active",
        });
      }
    } else {
      for (let i = 0; i < count; i++) {
        inserts.push({
          code: generateCouponCode(),
          rdm_amount: rdmAmount,
          restricted_to_teacher_ids: null,
          is_purchased: false,
          status: "active",
        });
      }
    }

    const { data, error } = await (admin as any).from("coupons").insert(inserts).select("*");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, coupons: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
