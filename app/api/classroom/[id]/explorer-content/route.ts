import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { fetchClassroomLiveSessionsForClassroom } from "@/lib/classroom/fetchClassroomLiveSessionsServer";

/** Returns posts and live sessions for explorers (bypasses RLS). Ensures explorers always see content. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: classroomId } = await params;
  if (!classroomId) {
    return NextResponse.json({ error: "Classroom id required" }, { status: 400 });
  }

  const supabase = await createClient();
  let user = (await supabase.auth.getUser()).data?.user ?? null;
  if (!user) {
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (token) {
      const {
        data: { user: u },
      } = await supabase.auth.getUser(token);
      user = u ?? null;
    }
  }
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data: classroom } = await admin
    .from("classrooms")
    .select("id, teacher_id")
    .eq("id", classroomId)
    .maybeSingle();

  if (!classroom) {
    return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
  }

  if (classroom.teacher_id === user.id) {
    return NextResponse.json({ error: "Use direct access" }, { status: 400 });
  }

  const { data: member } = await admin
    .from("classroom_members")
    .select("user_id")
    .eq("classroom_id", classroomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (member) {
    return NextResponse.json({ error: "Members use direct access" }, { status: 400 });
  }

  let { data: exploration } = await admin
    .from("class_exploration_sessions")
    .select("started_at")
    .eq("user_id", user.id)
    .eq("classroom_id", classroomId)
    .maybeSingle();

  if (!exploration) {
    const { data: inserted } = await admin
      .from("class_exploration_sessions")
      .insert({ user_id: user.id, classroom_id: classroomId })
      .select("started_at")
      .single();
    exploration = inserted ?? null;
  }

  if (!exploration?.started_at) {
    return NextResponse.json({ error: "No active exploration" }, { status: 403 });
  }

  const postsRes = await admin
    .from("posts")
    .select("*, profiles!posts_teacher_id_fkey(name)")
    .eq("classroom_id", classroomId)
    .order("created_at", { ascending: false });

  if (postsRes.error) {
    return NextResponse.json({ error: postsRes.error.message }, { status: 500 });
  }

  let liveSessions;
  try {
    liveSessions = await fetchClassroomLiveSessionsForClassroom(admin, classroomId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load sessions";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    posts: postsRes.data ?? [],
    liveSessions,
  });
}
