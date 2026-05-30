import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;

    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit") ?? 100);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(500, Math.floor(rawLimit)))
      : 100;
    const cursor = url.searchParams.get("cursor"); // ISO timestamp of last row

    let query = supabase
      .from("ai_token_logs")
      .select(
        "id, created_at, user_id, action_type, model_id, backend, prompt_tokens, candidates_tokens, total_tokens, cost_usd"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = data ?? [];

    return NextResponse.json(
      {
        rows,
        nextCursor: rows.length === limit ? (rows[rows.length - 1]?.created_at ?? null) : null,
        calculatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
        },
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
