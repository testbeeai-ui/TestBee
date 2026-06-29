import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/integrations/supabase/server";
import { fetchClassroomLiveSessionsForClassroom } from "@/lib/classroom/fetchClassroomLiveSessionsServer";

export const dynamic = "force-dynamic";

/** Merged live_sessions + live_class_slots (+ section schedule) for classroom members/teachers. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: classroomId } = await params;
  if (!classroomId) {
    return NextResponse.json({ error: "Classroom id required" }, { status: 400 });
  }

  const supabase = await createClient();
  const bearer = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  let user = (await supabase.auth.getUser()).data?.user ?? null;
  if (!user && bearer) {
    const {
      data: { user: u },
    } = await supabase.auth.getUser(bearer);
    user = u ?? null;
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

  const isTeacher = classroom.teacher_id === user.id;

  const { data: member } = await admin
    .from("classroom_members")
    .select("user_id, role, section_id")
    .eq("classroom_id", classroomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!isTeacher && !member) {
    const { data: exploration } = await admin
      .from("class_exploration_sessions")
      .select("started_at")
      .eq("user_id", user.id)
      .eq("classroom_id", classroomId)
      .maybeSingle();

    if (!exploration?.started_at) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }
  }

  const memberRole = (member?.role ?? "").toLowerCase();
  const isStudentMember = Boolean(member && memberRole !== "teacher" && !isTeacher);
  const viewerSectionId = isStudentMember ? (member?.section_id ?? null) : null;

  try {
    const liveSessions = await fetchClassroomLiveSessionsForClassroom(admin, classroomId, {
      viewerSectionId: isStudentMember ? viewerSectionId : undefined,
    });

    return NextResponse.json(
      { liveSessions },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load sessions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
