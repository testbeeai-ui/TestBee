import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { createAdminClient } from "@/integrations/supabase/server";
import { readTeacherRdmBalance } from "@/lib/teacherPortal/creditTeacherRdmBalance";

export async function GET(request: Request) {
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

    const rdm = await readTeacherRdmBalance(admin, ctx.user.id);
    return NextResponse.json({ ok: true, rdm });
  } catch (e) {
    console.error("teacher wallet balance error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 },
    );
  }
}
