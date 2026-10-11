import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";

export async function GET(request: Request) {
  const ctx = await getSupabaseAndUser(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const query = new URL(request.url).searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (query.length < 5 || !query.includes("@")) {
    return NextResponse.json({ error: "Enter an email address to check." }, { status: 400 });
  }

  const db = admin as unknown as SupabaseClient;
  const { data, error } = await db.rpc("lookup_users_by_email", { p_query: query });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const matches = (
    (data ?? []) as {
      id: string | null;
      email: string;
      name: string | null;
      role: string | null;
      source: string | null;
    }[]
  ).map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    source: row.source === "account" ? "account" : "approved",
  }));

  return NextResponse.json({ matches });
}
