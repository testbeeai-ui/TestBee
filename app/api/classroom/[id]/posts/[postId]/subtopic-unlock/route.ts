import { NextResponse } from "next/server";
import { createClient, createClientWithToken } from "@/integrations/supabase/server";
import { hasActiveSubtopicUnlockGrant } from "@/lib/teacherPortal/subtopicUnlockRdm";
import { STUDENT_SUBTOPIC_UNLOCK_MESSAGE } from "@/lib/teacherPortal/subtopicUnlockRdmCopy";

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

/** Whether the current student has teacher-sponsored full subtopic access for this assignment. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  const { id: classroomId, postId } = await params;
  if (!classroomId || !postId) {
    return NextResponse.json({ error: "classroom id and post id required" }, { status: 400 });
  }

  const { user, supabase } = await getAuthedUser(_request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: post, error: postErr } = await supabase
    .from("posts")
    .select("id, classroom_id, type")
    .eq("id", postId)
    .maybeSingle();
  if (postErr || !post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.classroom_id !== classroomId) {
    return NextResponse.json({ error: "Post does not belong to this classroom" }, { status: 400 });
  }
  if (post.type !== "Concept Focus") {
    return NextResponse.json({ unlocked: false, reason: "not_concept_focus" });
  }

  const { data: mem } = await supabase
    .from("classroom_members")
    .select("user_id")
    .eq("classroom_id", classroomId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!mem) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const unlocked = await hasActiveSubtopicUnlockGrant(supabase, user.id, postId);

  return NextResponse.json({
    unlocked,
    ...(unlocked ? { message: STUDENT_SUBTOPIC_UNLOCK_MESSAGE } : {}),
  });
}
