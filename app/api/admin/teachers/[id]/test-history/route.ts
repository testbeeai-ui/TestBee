import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";

export type TeacherGeneratedTestHistoryRow = {
  id: string;
  teacher_id: string;
  board: string;
  class_level: number;
  subject: string;
  scope: string;
  chapter_title: string | null;
  topic_title: string | null;
  unit_title: string | null;
  question_count: number;
  duration_minutes: number | null;
  generated_at: string;
};

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const teacherId = id?.trim();
    if (!teacherId) return NextResponse.json({ error: "Invalid teacher id" }, { status: 400 });

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", teacherId)
      .maybeSingle();
    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
    if (!profile) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    if (profile.role !== "teacher") {
      return NextResponse.json({ error: "Target user is not a teacher" }, { status: 400 });
    }

    const url = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "100", 10), 1), 200);

    const { data, error } = await (admin as any)
      .from("teacher_generated_test_history")
      .select(
        "id, teacher_id, board, class_level, subject, scope, chapter_title, topic_title, unit_title, question_count, duration_minutes, generated_at"
      )
      .eq("teacher_id", teacherId)
      .order("generated_at", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const history = (data ?? []) as TeacherGeneratedTestHistoryRow[];
    return NextResponse.json({
      history,
      count: history.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
