import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";

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

    const url = new URL(request.url);
    const status = (url.searchParams.get("status") ?? "pending").toLowerCase();

    let query = admin.from("profile_achievements").select("*").order("created_at", { ascending: false });
    if (status === "pending") {
      query = query.eq("verified", "pending");
    } else if (status !== "all") {
      return NextResponse.json({ error: "Invalid status filter (use pending or all)" }, { status: 400 });
    }

    const { data: achievements, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const userIds = [...new Set((achievements ?? []).map((a) => a.user_id))];
    const { data: profiles } =
      userIds.length > 0
        ? await admin.from("profiles").select("id, name").in("id", userIds)
        : { data: [] as { id: string; name: string | null }[] };

    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

    const rows = (achievements ?? []).map((a) => ({
      ...a,
      student_name: nameById.get(a.user_id) ?? null,
    }));

    return NextResponse.json({ rows });
  } catch (e) {
    console.error("[admin/student-achievements] GET", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
