import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { assertClassroomHasStudentCapacity } from "@/lib/teacherPortal/teacherPlanServer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const ctx = await getSupabaseAndUser(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user, supabase } = ctx;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "teacher") {
    return NextResponse.json({ error: "Teachers only" }, { status: 403 });
  }

  const url = new URL(request.url);
  const classroomId = url.searchParams.get("classroomId")?.trim() ?? "";
  const adding = Math.max(1, Number(url.searchParams.get("adding") ?? 1));

  if (!classroomId) {
    return NextResponse.json({ error: "classroomId required" }, { status: 400 });
  }

  const { data: room } = await supabase
    .from("classrooms")
    .select("teacher_id")
    .eq("id", classroomId)
    .maybeSingle();

  if (!room || room.teacher_id !== user.id) {
    return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
  }

  const check = await assertClassroomHasStudentCapacity(user.id, classroomId, adding);
  if (!check.ok) {
    return NextResponse.json({ error: check.error, code: check.code }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
