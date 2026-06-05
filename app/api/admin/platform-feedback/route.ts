import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  feedbackSubmissionsTable,
  type FeedbackSubmissionDbRow,
} from "@/lib/feedback/feedbackDb";
import type {
  PlatformFeedbackOverview,
  PlatformFeedbackRow,
} from "@/lib/feedback/platformFeedbackTypes";

function hasIssue(row: {
  issue_category: string | null;
  issue_text: string | null;
}): boolean {
  return Boolean(row.issue_category?.trim() || row.issue_text?.trim());
}

/** GET /api/admin/platform-feedback — list all feedback submissions for admin inbox. */
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
    const issuesOnly = url.searchParams.get("issues") === "1";
    const rawLimit = Number(url.searchParams.get("limit") ?? 100);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(300, Math.floor(rawLimit)))
      : 100;

    const table = feedbackSubmissionsTable(admin);
    let query = table.select("*").order("created_at", { ascending: false }).limit(limit);

    if (statusFilter === "new" || statusFilter === "reviewed" || statusFilter === "resolved") {
      query = query.eq("admin_status", statusFilter);
    } else if (statusFilter !== "all") {
      return NextResponse.json(
        { error: "Invalid status (use all, new, reviewed, resolved)" },
        { status: 400 }
      );
    }

    const { data: rows, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let list = (rows ?? []) as FeedbackSubmissionDbRow[];
    if (issuesOnly) {
      list = list.filter((r) => hasIssue(r));
    }

    const userIds = [...new Set(list.map((r) => r.user_id).filter(Boolean))] as string[];
    const { data: profiles } =
      userIds.length > 0
        ? await admin.from("profiles").select("id, name, role").in("id", userIds)
        : { data: [] as { id: string; name: string | null; role: string | null }[] };

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    const enriched: PlatformFeedbackRow[] = list.map((r) => {
      const prof = r.user_id ? profileById.get(r.user_id) : undefined;
      return {
        id: r.id,
        created_at: r.created_at,
        user_id: r.user_id,
        user_email: r.user_email ?? null,
        user_display_name: r.user_display_name ?? null,
        source: r.source ?? "settings_feedback",
        role: r.role,
        overall_rating: r.overall_rating,
        features: Array.isArray(r.features) ? (r.features as string[]) : [],
        extra_value: r.extra_value,
        specific_ratings:
          r.specific_ratings && typeof r.specific_ratings === "object"
            ? (r.specific_ratings as Record<string, number>)
            : {},
        nps: r.nps,
        issue_category: r.issue_category,
        issue_text: r.issue_text ?? "",
        suggestion: r.suggestion ?? "",
        admin_status: r.admin_status ?? "new",
        admin_note: r.admin_note,
        reviewed_at: r.reviewed_at,
        reviewed_by: r.reviewed_by,
        profile_name: prof?.name ?? null,
        profile_role: prof?.role ?? null,
      };
    });

    const { count: totalCount } = await table.select("id", { count: "exact", head: true });

    const { count: newCount } = await table
      .select("id", { count: "exact", head: true })
      .eq("admin_status", "new");

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: last7 } = await table
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo);

    const { data: allForIssues } = await table.select("issue_category, issue_text, role");
    const issueRows = (allForIssues ?? []) as Pick<
      FeedbackSubmissionDbRow,
      "issue_category" | "issue_text" | "role"
    >[];

    const withIssues = issueRows.filter((r) => hasIssue(r)).length;
    const roleCounts = new Map<string, number>();
    for (const r of issueRows) {
      roleCounts.set(r.role, (roleCounts.get(r.role) ?? 0) + 1);
    }

    const overview: PlatformFeedbackOverview = {
      total: totalCount ?? 0,
      newCount: newCount ?? 0,
      withIssues,
      last7Days: last7 ?? 0,
      byRole: [...roleCounts.entries()].map(([role, count]) => ({ role, count })),
    };

    return NextResponse.json({
      rows: enriched,
      overview,
      calculatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[admin/platform-feedback] GET", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
