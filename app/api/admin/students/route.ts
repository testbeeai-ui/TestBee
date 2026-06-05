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
    const mode = (url.searchParams.get("mode") ?? "directory").trim();
    const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();

    if (mode !== "directory") {
      return NextResponse.json({ error: "Unsupported mode" }, { status: 400 });
    }

    const { data: rows, error } = await admin
      .from("profiles")
      .select("id, name")
      .eq("role", "student")
      .order("name", { ascending: true })
      .limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const authRes = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailByUserId = new Map(
      (authRes.data?.users ?? []).map((u) => [u.id, u.email ?? null])
    );

    let students = (rows ?? []).map((r) => ({
      id: r.id,
      name: r.name ?? null,
      email: emailByUserId.get(r.id) ?? null,
    }));

    if (search) {
      students = students.filter((s) => {
        const email = (s.email ?? "").toLowerCase();
        const name = (s.name ?? "").toLowerCase();
        return email.includes(search) || name.includes(search);
      });
    }

    return NextResponse.json({ students });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
