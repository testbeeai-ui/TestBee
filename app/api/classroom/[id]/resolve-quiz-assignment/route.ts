import { NextResponse } from "next/server";
import { createClient, createClientWithToken } from "@/integrations/supabase/server";
import { resolveChapterQuizAssignmentPost } from "@/lib/classroom/resolveChapterQuizAssignmentPost";

export const runtime = "nodejs";

async function getAuthedUser(request: Request) {
  const tokenFromHeader = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (tokenFromHeader) {
    const supabase = createClientWithToken(tokenFromHeader);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { user, supabase };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user, supabase };
}

/** Resolve quiz assignment post id from subtopic scope (when URL postId placeholder is broken). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: classroomId } = await params;
  if (!classroomId) {
    return NextResponse.json({ error: "classroom id required" }, { status: 400 });
  }

  const url = new URL(request.url);
  const subject = url.searchParams.get("subject")?.trim() ?? "";
  const classLevelRaw = url.searchParams.get("classLevel")?.trim() ?? "";
  const topic = url.searchParams.get("topic")?.trim() ?? "";
  const subtopicName = url.searchParams.get("subtopicName")?.trim() ?? "";
  const level = url.searchParams.get("level")?.trim() || null;
  const quizSetRaw = url.searchParams.get("quizSet")?.trim() ?? "";

  if (!subject || !classLevelRaw || !topic || !subtopicName) {
    return NextResponse.json(
      { error: "subject, classLevel, topic, and subtopicName are required" },
      { status: 400 }
    );
  }

  const classLevel = Number(classLevelRaw);
  if (!Number.isFinite(classLevel)) {
    return NextResponse.json({ error: "Invalid classLevel" }, { status: 400 });
  }

  const quizSet = quizSetRaw ? Number(quizSetRaw) : null;

  const { user, supabase } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: mem } = await supabase
    .from("classroom_members")
    .select("user_id")
    .eq("classroom_id", classroomId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!mem) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const resolved = await resolveChapterQuizAssignmentPost(supabase, {
    classroomId,
    studentUserId: user.id,
    scope: { subject, classLevel, topic, subtopicName, level, quizSet },
  });

  if (!resolved) {
    return NextResponse.json({ error: "No matching quiz assignment found" }, { status: 404 });
  }

  return NextResponse.json(resolved);
}
