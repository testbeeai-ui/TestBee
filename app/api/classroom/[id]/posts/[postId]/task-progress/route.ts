import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
  createClientWithToken,
} from "@/integrations/supabase/server";
import { parseAssignmentTasks, studentVisibleTasks } from "@/lib/classroom/assignmentTasks";
import { isConceptFocusLessonChecklistComplete } from "@/lib/classroom/conceptFocusLessonCompletion";
import { parseBitsTestAttemptsStore } from "@/lib/play/bits/parseBitsTestAttemptsStore";

function isMissingProgressTableError(err: { code?: string; message?: string } | null | undefined) {
  if (!err) return false;
  if (err.code === "42P01") return true;
  return (
    typeof err.message === "string" && err.message.includes("classroom_assignment_task_progress")
  );
}

type GenericFrom = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => {
        eq: (
          column: string,
          value: string
        ) => {
          maybeSingle: () => Promise<{
            data: { submitted_at?: string | null } | null;
            error: { code?: string; message?: string } | null;
          }>;
        };
      };
    };
  };
};

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

function normalizeKey(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
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
    .select("id, classroom_id, teacher_id, type, content_json")
    .eq("id", postId)
    .maybeSingle();
  if (postErr || !post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.classroom_id !== classroomId) {
    return NextResponse.json({ error: "Post does not belong to this classroom" }, { status: 400 });
  }

  const isTeacher = post.teacher_id === user.id;
  if (!isTeacher) {
    const { data: mem } = await authedClient
      .from("classroom_members")
      .select("user_id")
      .eq("classroom_id", classroomId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!mem) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allTasks = parseAssignmentTasks(post.content_json, post.type);
  const tasksForClient = isTeacher ? allTasks : studentVisibleTasks(allTasks);

  const { data: progressRows, error: progErr } = await authedClient
    .from("classroom_assignment_task_progress")
    .select("task_id, user_id")
    .eq("post_id", postId);
  if (progErr && !isMissingProgressTableError(progErr)) {
    return NextResponse.json({ error: progErr.message }, { status: 500 });
  }

  const rows = (progressRows ?? []) as Array<{ task_id: string; user_id: string }>;
  const completedTaskIdSet = new Set<string>(
    isTeacher ? [] : rows.filter((r) => r.user_id === user.id).map((r) => r.task_id)
  );

  // Also infer completion from submitted quiz attempts for chapter_quiz tasks.
  // This keeps checklist state correct even when explicit progress rows are missing.
  if (!isTeacher) {
    const chapterQuizTasks = tasksForClient.filter((t) => t.kind === "chapter_quiz");
    if (chapterQuizTasks.length > 0) {
      const genericClient = authedClient as unknown as GenericFrom;
      const { data: attempt, error: attemptErr } = await genericClient
        .from("classroom_generated_test_attempts")
        .select("submitted_at")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!attemptErr && attempt?.submitted_at) {
        for (const task of chapterQuizTasks) completedTaskIdSet.add(task.id);
      }

      // Fallback: infer completion from profile.bits_test_attempts for this exact chapter-quiz scope.
      if (!attempt?.submitted_at) {
        const content =
          post.content_json && typeof post.content_json === "object" && !Array.isArray(post.content_json)
            ? (post.content_json as Record<string, unknown>)
            : null;
        const cq =
          content?.chapterQuiz && typeof content.chapterQuiz === "object" && !Array.isArray(content.chapterQuiz)
            ? (content.chapterQuiz as Record<string, unknown>)
            : null;
        const { data: profile } = await authedClient
          .from("profiles")
          .select("bits_test_attempts")
          .eq("id", user.id)
          .maybeSingle();
        const rows = parseBitsTestAttemptsStore((profile as { bits_test_attempts?: unknown } | null)?.bits_test_attempts ?? null);
        const expectedSubject = normalizeKey(cq?.subject);
        const expectedClass = Number(cq?.classLevel);
        const expectedTopic = normalizeKey(cq?.topic);
        const expectedSubtopic = normalizeKey(cq?.subtopicName);
        const matched = rows.some((r) => {
          return (
            normalizeKey(r.subject) === expectedSubject &&
            Number(r.classLevel) === expectedClass &&
            normalizeKey(r.topic) === expectedTopic &&
            normalizeKey(r.subtopicName) === expectedSubtopic
          );
        });
        if (matched) {
          for (const task of chapterQuizTasks) completedTaskIdSet.add(task.id);
        }
      }
    }

    // Concept Focus: collapsed client task id `concept-focus-subtopic` — infer from lesson checklist
    // saved on the subtopic page (profiles.subtopic_engagement.lessonChecklistMarkedCompleteAt).
    if (post.type === "Concept Focus") {
      const { data: profileRow } = await authedClient
        .from("profiles")
        .select("subtopic_engagement")
        .eq("id", user.id)
        .maybeSingle();
      const engagement = (profileRow as { subtopic_engagement?: unknown } | null)?.subtopic_engagement;
      if (isConceptFocusLessonChecklistComplete(engagement, post.content_json)) {
        completedTaskIdSet.add("concept-focus-subtopic");
      }
    }
  }

  return NextResponse.json(
    {
      tasks: tasksForClient,
      completedTaskIds: Array.from(completedTaskIdSet),
      isTeacher,
      progressAvailable: !isMissingProgressTableError(progErr),
    },
    { headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=60" } }
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  const { id: classroomId, postId } = await params;
  if (!classroomId || !postId) {
    return NextResponse.json({ error: "classroom id and post id required" }, { status: 400 });
  }
  const { user, authedClient } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { taskId?: string; completed?: boolean };
  try {
    body = (await request.json()) as { taskId?: string; completed?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
  const completed = body.completed === true;
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const { data: post, error: postErr } = await authedClient
    .from("posts")
    .select("id, classroom_id, teacher_id, type, content_json")
    .eq("id", postId)
    .maybeSingle();
  if (postErr || !post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.classroom_id !== classroomId) {
    return NextResponse.json({ error: "Post does not belong to this classroom" }, { status: 400 });
  }
  if (post.teacher_id === user.id) {
    return NextResponse.json(
      { error: "Teachers use the portal to track class progress" },
      { status: 403 }
    );
  }

  const { data: mem } = await authedClient
    .from("classroom_members")
    .select("user_id")
    .eq("classroom_id", classroomId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!mem) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const visible = studentVisibleTasks(parseAssignmentTasks(post.content_json, post.type));
  const isConceptFocusSynthetic =
    post.type === "Concept Focus" && taskId === "concept-focus-subtopic";
  if (!visible.some((t) => t.id === taskId) && !isConceptFocusSynthetic) {
    return NextResponse.json({ error: "Unknown or hidden task" }, { status: 400 });
  }

  if (isConceptFocusSynthetic && completed) {
    const { data: profileRow } = await authedClient
      .from("profiles")
      .select("subtopic_engagement")
      .eq("id", user.id)
      .maybeSingle();
    const engagement = (profileRow as { subtopic_engagement?: unknown } | null)?.subtopic_engagement;
    if (!isConceptFocusLessonChecklistComplete(engagement, post.content_json)) {
      return NextResponse.json(
        {
          error:
            "Finish the subtopic lesson checklist and tap Mark as complete on the topic page first.",
        },
        { status: 400 }
      );
    }
  }

  if (completed) {
    const { error: insErr } = await authedClient.from("classroom_assignment_task_progress").insert({
      post_id: postId,
      task_id: taskId,
      user_id: user.id,
    });
    if (insErr) {
      if (isMissingProgressTableError(insErr)) {
        return NextResponse.json({
          ok: true,
          progressAvailable: false,
        });
      }
      if (insErr.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  } else {
    const { error: delErr } = await authedClient
      .from("classroom_assignment_task_progress")
      .delete()
      .eq("post_id", postId)
      .eq("task_id", taskId)
      .eq("user_id", user.id);
    if (delErr) {
      if (isMissingProgressTableError(delErr)) {
        return NextResponse.json({
          ok: true,
          progressAvailable: false,
        });
      }
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, progressAvailable: true });
}
