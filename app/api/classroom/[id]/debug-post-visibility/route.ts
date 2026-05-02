import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient, createClientWithToken } from "@/integrations/supabase/server";

/**
 * Teacher-only diagnostic endpoint to explain why a student can/can't see posts.
 * Compares:
 * - posts that exist in the classroom (service role)
 * - student membership + current section
 * - student_section_history intervals
 *
 * Query params:
 * - userId (required): the student user_id to debug
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: classroomId } = await ctx.params;
  if (!classroomId) return NextResponse.json({ error: "Classroom id required." }, { status: 400 });

  const url = new URL(request.url);
  const targetUserId = (url.searchParams.get("userId") ?? "").trim();
  if (!targetUserId) return NextResponse.json({ error: "userId required." }, { status: 400 });

  const headerAuth = request.headers.get("authorization") || "";
  const bearer = headerAuth.toLowerCase().startsWith("bearer ") ? headerAuth.slice(7).trim() : "";
  const supabaseUser = bearer ? createClientWithToken(bearer) : await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }

  const { data: room } = await admin
    .from("classrooms")
    .select("id, teacher_id")
    .eq("id", classroomId)
    .maybeSingle();
  if (!room) return NextResponse.json({ error: "Classroom not found." }, { status: 404 });
  if (room.teacher_id !== user.id) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const [memberRes, histRes, postsRes] = await Promise.all([
    admin
      .from("classroom_members")
      .select("user_id, role, joined_at, section_id")
      .eq("classroom_id", classroomId)
      .eq("user_id", targetUserId)
      .maybeSingle(),
    admin
      .from("student_section_history" as any)
      .select("section_id, joined_at, left_at")
      .eq("classroom_id", classroomId)
      .eq("user_id", targetUserId)
      .order("joined_at", { ascending: true }),
    admin
      .from("posts")
      .select("id, type, title, created_at, due_date, section_id, content_json")
      .eq("classroom_id", classroomId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const member = memberRes.data ?? null;
  const history = (histRes.data as any[]) ?? [];
  const posts = (postsRes.data as any[]) ?? [];

  return NextResponse.json({
    member,
    history,
    posts: posts.map((p) => ({
      id: p.id,
      type: p.type,
      title: p.title,
      created_at: p.created_at,
      due_date: p.due_date,
      section_id: p.section_id,
      has_targetStudentIds:
        p.content_json &&
        typeof p.content_json === "object" &&
        !Array.isArray(p.content_json) &&
        Array.isArray((p.content_json as any).targetStudentIds) &&
        (p.content_json as any).targetStudentIds.length > 0,
    })),
  });
}

