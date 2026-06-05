import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { createAdminClient } from "@/integrations/supabase/server";

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user } = ctx;
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    // Fetch user profile to check role
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Failed to verify user profile" }, { status: 500 });
    }

    if (profile.role !== "teacher") {
      return NextResponse.json({ error: "Only teachers can access this data" }, { status: 403 });
    }

    // Query coupons where the teacher bought them OR they are restricted to them
    const { data: coupons, error: couponsError } = await (admin as any)
      .from("coupons")
      .select("*")
      .or(`bought_by_teacher_id.eq.${user.id},restricted_to_teacher_ids.cs.{${user.id}}`)
      .order("created_at", { ascending: false });

    if (couponsError) {
      return NextResponse.json({ error: couponsError.message }, { status: 500 });
    }

    return NextResponse.json({ coupons: coupons ?? [] });
  } catch (e) {
    console.error("user GET coupons error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
