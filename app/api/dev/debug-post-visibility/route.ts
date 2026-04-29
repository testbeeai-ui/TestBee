import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";

/**
 * DEV-ONLY diagnostics (no auth).
 * Uses service role to inspect membership/history/posts for a classroom + user,
 * and returns a computed "shouldBeVisible" evaluation for each post based on our temporal rules.
 *
 * Query params:
 * - classroomId (required)
 * - userId (required)
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const classroomId = (url.searchParams.get("classroomId") ?? "").trim();
  const userId = (url.searchParams.get("userId") ?? "").trim();
  if (!classroomId || !userId) {
    return NextResponse.json({ error: "classroomId and userId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }

  const [memberRes, histRes, postsRes, sectionsRes] = await Promise.all([
    admin
      .from("classroom_members")
      .select("user_id, role, joined_at, section_id")
      .eq("classroom_id", classroomId)
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("student_section_history" as any)
      .select("section_id, joined_at, left_at")
      .eq("classroom_id", classroomId)
      .eq("user_id", userId)
      .order("joined_at", { ascending: true }),
    admin
      .from("posts")
      .select("id, type, title, created_at, due_date, section_id, content_json")
      .eq("classroom_id", classroomId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("classroom_sections" as any)
      .select("id, name")
      .eq("classroom_id", classroomId),
  ]);

  const member = memberRes.data ?? null;
  const history = ((histRes.data as any[]) ?? []).map((r) => ({
    section_id: r.section_id ?? null,
    joined_at: r.joined_at,
    left_at: r.left_at ?? null,
  }));
  const posts = (postsRes.data as any[]) ?? [];
  const sections = ((sectionsRes.data as any[]) ?? []).map((s) => ({ id: s.id, name: s.name }));
  const sectionNameById = new Map(sections.map((s) => [s.id, s.name]));

  const inInterval = (createdAt: string, joinedAt: string, leftAt: string | null) => {
    const c = Date.parse(createdAt);
    const j = Date.parse(joinedAt);
    const l = leftAt ? Date.parse(leftAt) : Number.POSITIVE_INFINITY;
    if (!Number.isFinite(c) || !Number.isFinite(j) || !Number.isFinite(l)) return false;
    return c >= j && c <= l;
  };

  const shouldSeePost = (p: any) => {
    const postSection = p.section_id ?? null;
    const createdAt = String(p.created_at ?? "");
    const due = p.due_date ? String(p.due_date) : null;
    for (const h of history) {
      // class-wide
      if (postSection == null) {
        if (inInterval(createdAt, h.joined_at, h.left_at)) return { ok: true, via: "class_interval" };
        continue;
      }
      // section scoped
      if ((h.section_id ?? null) !== postSection) continue;
      if (inInterval(createdAt, h.joined_at, h.left_at)) return { ok: true, via: "section_interval" };
      // pending exception (created before join, due after join)
      if (due) {
        const c = Date.parse(createdAt);
        const j = Date.parse(h.joined_at);
        const d = Date.parse(due);
        if (Number.isFinite(c) && Number.isFinite(j) && Number.isFinite(d)) {
          if (c < j && d > j) return { ok: true, via: "pending_exception" };
        }
      }
    }
    return { ok: false, via: "no_matching_interval" };
  };

  return NextResponse.json({
    classroomId,
    userId,
    member,
    history,
    posts: posts.map((p) => {
      const vis = shouldSeePost(p);
      const payload =
        p.content_json && typeof p.content_json === "object" && !Array.isArray(p.content_json)
          ? (p.content_json as Record<string, unknown>)
          : {};
      const tIds = Array.isArray(payload.targetStudentIds) ? payload.targetStudentIds : [];
      const hasTarget = Array.isArray(tIds) && tIds.length > 0;
      const sectionLabel =
        p.section_id == null ? "WHOLE_CLASS" : sectionNameById.get(p.section_id) ?? "SECTION";
      return {
        id: p.id,
        type: p.type,
        title: p.title,
        created_at: p.created_at,
        due_date: p.due_date,
        section_id: p.section_id ?? null,
        sectionLabel,
        has_targetStudentIds: hasTarget,
        shouldBeVisibleByHistory: vis.ok,
        shouldBeVisibleReason: vis.via,
      };
    }),
  });
}

