/**
 * Admin-only: full thread for a community post (comments + votes samples + totals).
 */
import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";

const COMMENT_SAMPLE = 200;
const VOTE_SAMPLE = 200;

export async function GET(_request: Request, context: { params: Promise<{ postId: string }> }) {
  try {
    const ctx = await getSupabaseAndUser(_request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { postId } = await context.params;
    const id = postId?.trim();
    if (!id) return NextResponse.json({ error: "Invalid post id" }, { status: 400 });

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const [
      postCheck,
      commentsCountRes,
      votesCountRes,
      commentsRes,
      votesRes,
    ] = await Promise.all([
      admin.from("lessons_raw_posts").select("id").eq("id", id).maybeSingle(),
      admin
        .from("lessons_raw_post_comments")
        .select("id", { head: true, count: "exact" })
        .eq("post_id", id),
      admin
        .from("lessons_raw_post_votes")
        .select("post_id", { head: true, count: "exact" })
        .eq("post_id", id),
      admin
        .from("lessons_raw_post_comments")
        .select("id, user_id, parent_id, body, created_at")
        .eq("post_id", id)
        .order("created_at", { ascending: false })
        .limit(COMMENT_SAMPLE),
      admin
        .from("lessons_raw_post_votes")
        .select("user_id, vote, created_at")
        .eq("post_id", id)
        .order("created_at", { ascending: false })
        .limit(VOTE_SAMPLE),
    ]);

    const errs = [
      postCheck.error,
      commentsCountRes.error,
      votesCountRes.error,
      commentsRes.error,
      votesRes.error,
    ].filter(Boolean);
    if (errs.length > 0) {
      return NextResponse.json({ error: errs[0]!.message }, { status: 500 });
    }

    if (!postCheck.data) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const commentRows = commentsRes.data ?? [];
    const voteRows = votesRes.data ?? [];
    const userIds = [...new Set([...commentRows.map((c) => c.user_id), ...voteRows.map((v) => v.user_id)])];

    let nameById = new Map<string, string | null>();
    if (userIds.length > 0) {
      const profRes = await admin.from("profiles").select("id, name").in("id", userIds);
      if (profRes.error) {
        return NextResponse.json({ error: profRes.error.message }, { status: 500 });
      }
      nameById = new Map((profRes.data ?? []).map((r) => [r.id, r.name]));
    }

    return NextResponse.json({
      postId: id,
      comments_total: commentsCountRes.count ?? commentRows.length,
      comments_returned: commentRows.length,
      comments_capped: commentRows.length >= COMMENT_SAMPLE,
      votes_total: votesCountRes.count ?? voteRows.length,
      votes_returned: voteRows.length,
      votes_capped: voteRows.length >= VOTE_SAMPLE,
      comments: commentRows.map((c) => ({
        id: c.id,
        user_id: c.user_id,
        parent_id: c.parent_id,
        body: c.body,
        created_at: c.created_at,
        author_name: nameById.get(c.user_id) ?? null,
      })),
      votes: voteRows.map((v) => ({
        user_id: v.user_id,
        vote: v.vote,
        created_at: v.created_at,
        author_name: nameById.get(v.user_id) ?? null,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
