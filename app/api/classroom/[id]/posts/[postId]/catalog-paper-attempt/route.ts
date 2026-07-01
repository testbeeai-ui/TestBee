import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
  createClientWithToken,
} from "@/integrations/supabase/server";
import { tryFulfillAssignmentMotivationGrants } from "@/lib/teacherPortal/motivationRdm";
import { tryFulfillAssignmentCompletionReward } from "@/lib/teacherPortal/assignmentCompletionRdm";

/**
 * Persists catalog mock / past-paper attempts for classroom assignments.
 * Questions live in mock_questions / past_paper_questions (not embedded generatedTestPaper).
 *
 * Uses the same server Supabase client as other classroom APIs (prefers service role when
 * configured), after verifying the authenticated user is a classroom member — so writes
 * succeed even when the browser client's RLS policies reject direct upserts.
 */

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

async function loadPostAndAccess(
  authedClient: Awaited<ReturnType<typeof createClient>>,
  classroomId: string,
  postId: string,
  userId: string
) {
  const { data: post, error: postErr } = await authedClient
    .from("posts")
    .select("id, classroom_id, teacher_id, type, content_json")
    .eq("id", postId)
    .maybeSingle();
  if (postErr || !post) return { error: "Post not found", status: 404 } as const;
  if (post.classroom_id !== classroomId) {
    return { error: "Post does not belong to this classroom", status: 400 } as const;
  }
  const isTeacher = post.teacher_id === userId;
  if (!isTeacher) {
    const { data: mem } = await authedClient
      .from("classroom_members")
      .select("user_id")
      .eq("classroom_id", classroomId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!mem) return { error: "Forbidden", status: 403 } as const;
  }
  return { post, isTeacher } as const;
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

  let body: {
    submit?: unknown;
    answers?: unknown;
    score?: unknown;
    total?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const access = await loadPostAndAccess(authedClient, classroomId, postId, user.id);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (access.isTeacher) {
    return NextResponse.json(
      { error: "Teachers cannot submit student attempts." },
      { status: 403 }
    );
  }

  const postType = access.post.type;
  if (postType !== "mock" && postType !== "past_paper") {
    return NextResponse.json(
      { error: "This assignment type does not use catalog paper attempt tracking." },
      { status: 400 }
    );
  }

  if (body.submit !== true) {
    return NextResponse.json({ error: "submit must be true" }, { status: 400 });
  }

  if (!Array.isArray(body.answers)) {
    return NextResponse.json({ error: "answers must be an array" }, { status: 400 });
  }

  const scoreRaw = Number(body.score);
  const totalRaw = Number(body.total);
  if (!Number.isFinite(scoreRaw) || !Number.isFinite(totalRaw) || totalRaw < 1) {
    return NextResponse.json({ error: "Invalid score or total" }, { status: 400 });
  }

  const answers_json = body.answers.map((a) =>
    typeof a === "number" && Number.isInteger(a) ? a : -1
  );
  const score = Math.max(0, Math.floor(scoreRaw));
  const total = Math.max(1, Math.floor(totalRaw));

  const submittedAt = new Date().toISOString();

  const genericClient = authedClient as unknown as {
    from: (table: string) => {
      upsert: (
        values: Record<string, unknown>,
        options: { onConflict: string }
      ) => Promise<{ error: { code?: string; message?: string } | null }>;
    };
  };

  const { error: upsertErr } = await genericClient.from("classroom_generated_test_attempts").upsert(
    {
      post_id: postId,
      classroom_id: classroomId,
      user_id: user.id,
      answers_json,
      score,
      total,
      submitted_at: submittedAt,
      updated_at: submittedAt,
    },
    { onConflict: "post_id,user_id" }
  );

  if (upsertErr) {
    return NextResponse.json(
      { error: upsertErr.message ?? "Could not save attempt", code: upsertErr.code },
      { status: 500 }
    );
  }

  const content = access.post.content_json as Record<string, unknown> | null;
  const tasksRaw =
    content && Array.isArray(content.tasks) ? content.tasks : [];
  const paperTask = tasksRaw.find((t: unknown) => {
    if (!t || typeof t !== "object" || Array.isArray(t)) return false;
    const kind = (t as Record<string, unknown>).kind;
    return kind === "mock_paper" || kind === "past_paper";
  }) as Record<string, unknown> | undefined;
  if (paperTask?.id) {
    await authedClient.from("classroom_assignment_task_progress").upsert(
      {
        post_id: postId,
        task_id: String(paperTask.id),
        user_id: user.id,
        completed_at: submittedAt,
      },
      { onConflict: "post_id,task_id,user_id" }
    );
  }

  const adminAfterAttempt = createAdminClient();
  if (adminAfterAttempt) {
    try {
      await tryFulfillAssignmentMotivationGrants(adminAfterAttempt, user.id, postId);
      await tryFulfillAssignmentCompletionReward(adminAfterAttempt, user.id, postId);
    } catch {
      // Non-fatal: attempt saved even if reward fulfillment fails
    }
  }

  return NextResponse.json({ ok: true, submittedAt, score, total });
}
