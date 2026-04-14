import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/integrations/supabase/server";

type ActivityItem = {
  type: "governance" | "doubt" | "ai_call";
  timestamp: string;
  title: string;
  details: string;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const userId = id?.trim();
    if (!userId) return NextResponse.json({ error: "Invalid user id" }, { status: 400 });

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const [governanceRes, doubtsRes, aiRes] = await Promise.all([
      (admin as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              order: (col: string, opts: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> };
            };
          };
        };
      })
        .from("admin_user_actions")
        .select("action_type, reason, created_at, actor_user_id")
        .eq("target_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      admin.from("doubts").select("id, title, created_at, is_resolved").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      admin.from("ai_token_logs").select("created_at, action_type, model_id, total_tokens").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    ]);

    const missingAuditTable = Boolean(
      governanceRes.error &&
        /admin_user_actions|schema cache|does not exist|relation/i.test(governanceRes.error.message)
    );
    if (governanceRes.error && !missingAuditTable) {
      return NextResponse.json({ error: governanceRes.error.message }, { status: 500 });
    }
    if (doubtsRes.error) return NextResponse.json({ error: doubtsRes.error.message }, { status: 500 });
    if (aiRes.error) return NextResponse.json({ error: aiRes.error.message }, { status: 500 });

    const governanceItems: ActivityItem[] = ((missingAuditTable ? [] : governanceRes.data) ?? []).map((row) => ({
      type: "governance",
      timestamp: String(row.created_at ?? new Date().toISOString()),
      title: `Admin action: ${String(row.action_type ?? "unknown")}`,
      details: `Actor ${String(row.actor_user_id ?? "unknown")}${row.reason ? ` · ${String(row.reason)}` : ""}`,
    }));

    const doubtItems: ActivityItem[] = (doubtsRes.data ?? []).map((row) => ({
      type: "doubt",
      timestamp: row.created_at,
      title: row.is_resolved ? "Resolved doubt" : "Created doubt",
      details: row.title?.slice(0, 120) ?? row.id,
    }));

    const aiItems: ActivityItem[] = (aiRes.data ?? []).map((row) => ({
      type: "ai_call",
      timestamp: row.created_at,
      title: `AI: ${row.action_type ?? "call"}`,
      details: `${row.model_id ?? "model"} · tokens ${Number(row.total_tokens ?? 0).toLocaleString()}`,
    }));

    const activity = [...governanceItems, ...doubtItems, ...aiItems]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 100);

    return NextResponse.json({ activity });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
