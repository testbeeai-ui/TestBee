import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import type {
  ContactCategory,
  ContactMessageRow,
  ContactMessagesOverview,
} from "@/lib/contact/contactMessageTypes";

function isCategoryFilter(v: string): v is ContactCategory | "all" {
  return v === "all" || v === "sales" || v === "issue" || v === "comment";
}

/** GET /api/admin/contact-messages — list Contact Us submissions. */
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
    const statusFilter = (url.searchParams.get("status") ?? "all").toLowerCase();
    const categoryFilter = (url.searchParams.get("category") ?? "all").toLowerCase();
    const rawLimit = Number(url.searchParams.get("limit") ?? 100);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(300, Math.floor(rawLimit)))
      : 100;

    if (!isCategoryFilter(categoryFilter)) {
      return NextResponse.json({ error: "Invalid category filter" }, { status: 400 });
    }

    let query = admin
      .from("contact_messages" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (statusFilter === "new" || statusFilter === "reviewed" || statusFilter === "resolved") {
      query = query.eq("admin_status", statusFilter);
    } else if (statusFilter !== "all") {
      return NextResponse.json(
        { error: "Invalid status (use all, new, reviewed, resolved)" },
        { status: 400 }
      );
    }

    if (categoryFilter !== "all") {
      query = query.eq("category", categoryFilter);
    }

    const { data: rows, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const list = (rows ?? []) as ContactMessageRow[];

    const { count: totalCount } = await admin
      .from("contact_messages" as never)
      .select("id", { count: "exact", head: true });

    const { count: newCount } = await admin
      .from("contact_messages" as never)
      .select("id", { count: "exact", head: true })
      .eq("admin_status", "new");

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: last7 } = await admin
      .from("contact_messages" as never)
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo);

    const { data: categoryRows } = await admin.from("contact_messages" as never).select("category");
    const categoryCounts = new Map<ContactCategory, number>();
    for (const row of (categoryRows ?? []) as { category: ContactCategory }[]) {
      const cat = row.category;
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
    }

    const overview: ContactMessagesOverview = {
      total: totalCount ?? 0,
      newCount: newCount ?? 0,
      last7Days: last7 ?? 0,
      byCategory: (["sales", "issue", "comment"] as ContactCategory[]).map((category) => ({
        category,
        count: categoryCounts.get(category) ?? 0,
      })),
    };

    return NextResponse.json({
      rows: list,
      overview,
      calculatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[admin/contact-messages] GET", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
