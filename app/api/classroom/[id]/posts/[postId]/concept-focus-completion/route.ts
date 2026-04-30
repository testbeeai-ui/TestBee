import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
  createClientWithToken,
} from "@/integrations/supabase/server";
import {
  parseChapterQuizRefFromContentJson,
  getConceptFocusLessonMarkedAtIso,
} from "@/lib/classroom/conceptFocusLessonCompletion";

async function getAuthedUser(request: Request) {
  const tokenFromHeader = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  let user: { id: string } | null = null;
  let cookieClient: Awaited<ReturnType<typeof createClient>> | null = null;
  if (tokenFromHeader) {
    const supabaseWithToken = createClientWithToken(tokenFromHeader);
    const {
      data: { user: u },
    } = await supabaseWithToken.auth.getUser();
    user = u ?? null;
  }
  if (!user) {
    cookieClient = await createClient();
    user = (await cookieClient.auth.getUser()).data?.user ?? null;
  }
  const admin = createAdminClient();
  const authedClient =
    admin ??
    (tokenFromHeader
      ? createClientWithToken(tokenFromHeader)
      : (cookieClient ?? (await createClient())));
  return { user, authedClient };
}

function isMissingProgressTableError(err: { code?: string; message?: string } | null | undefined) {
  if (!err) return false;
  if (err.code === "42P01") return true;
  return (
    typeof err.message === "string" && err.message.includes("classroom_assignment_task_progress")
  );
}

function parseTargetStudentIds(contentJson: unknown): string[] | null {
  if (!contentJson || typeof contentJson !== "object" || Array.isArray(contentJson)) return null;
  const raw = (contentJson as Record<string, unknown>).targetStudentIds;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const ids = [...new Set(raw.map((x) => String(x).trim()).filter(Boolean))];
  return ids.length ? ids : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  const { id: classroomId, postId } = await params;
  if (!classroomId || !postId) {
    return NextResponse.json({ error: "classroom id and post id required" }, { status: 400 });
  }

  const { user, authedClient } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: post, error: postErr } = await authedClient
    .from("posts")
    .select("id, classroom_id, teacher_id, type, content_json, section_id")
    .eq("id", postId)
    .maybeSingle();

  if (postErr || !post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.classroom_id !== classroomId) {
    return NextResponse.json({ error: "Post does not belong to this classroom" }, { status: 400 });
  }
  if (post.teacher_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (post.type !== "Concept Focus") {
    return NextResponse.json({ error: "Not a Concept Focus post" }, { status: 400 });
  }

  if (!parseChapterQuizRefFromContentJson(post.content_json)) {
    return NextResponse.json({ error: "Assignment has no subtopic anchor (chapterQuiz)" }, { status: 400 });
  }

  const postSectionId =
    typeof (post as { section_id?: unknown }).section_id === "string"
      ? String((post as { section_id: string }).section_id)
      : null;

  const { data: memberRows, error: memErr } = await authedClient
    .from("classroom_members")
    .select("user_id, role, section_id")
    .eq("classroom_id", classroomId);
  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

  let studentIds = (memberRows ?? [])
    .filter((m) => String((m as { role?: unknown }).role ?? "").toLowerCase() === "student")
    .filter((m) => {
      if (postSectionId == null) return true;
      return String((m as { section_id?: unknown }).section_id ?? "") === postSectionId;
    })
    .map((m) => String((m as { user_id: string }).user_id));

  const targets = parseTargetStudentIds(post.content_json);
  if (targets?.length) {
    const targetSet = new Set(targets);
    studentIds = studentIds.filter((id) => targetSet.has(id));
  }

  studentIds.sort((a, b) => a.localeCompare(b));

  const progressByUser = new Map<string, string>();
  const { data: progressRows, error: progErr } = await authedClient
    .from("classroom_assignment_task_progress")
    .select("user_id, completed_at")
    .eq("post_id", postId)
    .eq("task_id", "concept-focus-subtopic");
  if (progErr && !isMissingProgressTableError(progErr)) {
    return NextResponse.json({ error: progErr.message }, { status: 500 });
  }
  if (!progErr && progressRows) {
    for (const row of progressRows as Array<{ user_id: string; completed_at?: string | null }>) {
      const uid = String(row.user_id);
      const at = typeof row.completed_at === "string" ? row.completed_at : null;
      if (at) progressByUser.set(uid, at);
    }
  }

  let engagementByUser = new Map<string, unknown>();
  if (studentIds.length > 0) {
    const { data: profiles, error: profErr } = await authedClient
      .from("profiles")
      .select("id, subtopic_engagement")
      .in("id", studentIds);
    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
    for (const p of (profiles ?? []) as Array<{ id: string; subtopic_engagement?: unknown }>) {
      engagementByUser.set(p.id, p.subtopic_engagement ?? null);
    }
  }

  const students = studentIds.map((userId) => {
    const progressAt = progressByUser.get(userId) ?? null;
    const lessonMarkedAt = getConceptFocusLessonMarkedAtIso(
      engagementByUser.get(userId),
      post.content_json
    );
    const completed = Boolean(progressAt) || Boolean(lessonMarkedAt);
    let completedAt: string | null = progressAt ?? lessonMarkedAt ?? null;
    if (progressAt && lessonMarkedAt) {
      const a = new Date(progressAt).getTime();
      const b = new Date(lessonMarkedAt).getTime();
      if (!Number.isNaN(a) && !Number.isNaN(b)) {
        completedAt = a >= b ? progressAt : lessonMarkedAt;
      }
    }
    return {
      userId,
      completed,
      completedAt,
      sources: {
        assignmentProgress: Boolean(progressAt),
        lessonMarkedComplete: Boolean(lessonMarkedAt),
      },
    };
  });

  return NextResponse.json(
    { students },
    { headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=30" } }
  );
}
