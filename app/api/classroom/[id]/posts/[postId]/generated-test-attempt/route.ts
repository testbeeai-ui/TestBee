import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
  createClientWithToken,
} from "@/integrations/supabase/server";
import { parseAssignmentTasks, studentVisibleTasks } from "@/lib/classroom/assignmentTasks";

type GeneratedPaperQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number | null;
};

type GeneratedPaperPayload = {
  taskId?: string;
  test: {
    id: string;
    name: string;
    questions: GeneratedPaperQuestion[];
  };
};

type AttemptTableRow = {
  answers_json?: unknown;
  score?: number;
  total?: number;
  submitted_at?: string;
};

type GenericQueryResult = {
  data: AttemptTableRow | null;
  error: { code?: string; message?: string } | null;
};

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
          maybeSingle: () => Promise<GenericQueryResult>;
        };
      };
    };
    upsert: (
      values: Record<string, unknown>,
      options: { onConflict: string }
    ) => Promise<{ error: { code?: string; message?: string } | null }>;
  };
};

function isMissingAttemptTableError(err: { code?: string; message?: string } | null | undefined) {
  if (!err) return false;
  if (err.code === "42P01") return true;
  return (
    typeof err.message === "string" && err.message.includes("classroom_generated_test_attempts")
  );
}

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

function parseGeneratedTestPayload(contentJson: unknown): GeneratedPaperPayload | null {
  if (!contentJson || typeof contentJson !== "object" || Array.isArray(contentJson)) return null;
  const payload = (contentJson as { generatedTestPaper?: unknown }).generatedTestPaper;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const p = payload as { taskId?: unknown; test?: unknown };
  if (!p.test || typeof p.test !== "object" || Array.isArray(p.test)) return null;
  const t = p.test as { id?: unknown; name?: unknown; questions?: unknown };
  if (typeof t.id !== "string" || typeof t.name !== "string" || !Array.isArray(t.questions))
    return null;
  const questions: GeneratedPaperQuestion[] = t.questions
    .map((q) => {
      if (!q || typeof q !== "object" || Array.isArray(q)) return null;
      const item = q as {
        id?: unknown;
        question?: unknown;
        options?: unknown;
        correctAnswerIndex?: unknown;
      };
      if (typeof item.id !== "string" || typeof item.question !== "string") return null;
      if (!Array.isArray(item.options)) return null;
      const options = item.options.filter((x): x is string => typeof x === "string");
      if (options.length < 2) return null;
      const correctAnswerIndex =
        typeof item.correctAnswerIndex === "number" && Number.isInteger(item.correctAnswerIndex)
          ? item.correctAnswerIndex
          : null;
      return {
        id: item.id,
        question: item.question,
        options,
        correctAnswerIndex,
      };
    })
    .filter((q): q is GeneratedPaperQuestion => Boolean(q));
  if (questions.length === 0) return null;
  return {
    taskId: typeof p.taskId === "string" ? p.taskId : undefined,
    test: { id: t.id, name: t.name, questions },
  };
}

function normalizeAnswers(input: unknown, expectedCount: number): number[] {
  const out = new Array<number>(expectedCount).fill(-1);
  if (!Array.isArray(input)) return out;
  for (let i = 0; i < Math.min(input.length, expectedCount); i += 1) {
    const v = input[i];
    out[i] = typeof v === "number" && Number.isInteger(v) ? v : -1;
  }
  return out;
}

function computeScore(questions: GeneratedPaperQuestion[], answers: number[]) {
  let correct = 0;
  for (let i = 0; i < questions.length; i += 1) {
    const correctIdx = questions[i]?.correctAnswerIndex;
    if (typeof correctIdx === "number" && answers[i] === correctIdx) correct += 1;
  }
  return correct;
}

async function loadPostAndAccess(
  authedClient: Awaited<ReturnType<typeof createClient>>,
  classroomId: string,
  postId: string,
  userId: string
) {
  const { data: post, error: postErr } = await authedClient
    .from("posts")
    .select("id, classroom_id, teacher_id, type, title, content_json")
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

  const access = await loadPostAndAccess(authedClient, classroomId, postId, user.id);
  if ("error" in access)
    return NextResponse.json({ error: access.error }, { status: access.status });

  const payload = parseGeneratedTestPayload(access.post.content_json);
  if (!payload) {
    return NextResponse.json(
      { error: "No generated test found for this assignment." },
      { status: 404 }
    );
  }

  // Support teacher reviewing a specific student's attempt via ?reviewAs=userId
  const url = new URL(request.url);
  const reviewAs = url.searchParams.get("reviewAs");
  const targetUserId = access.isTeacher && reviewAs ? reviewAs : user.id;

  const genericClient = authedClient as unknown as GenericFrom;
  const { data: attempt, error: attemptErr } = await genericClient
    .from("classroom_generated_test_attempts")
    .select("answers_json, score, total, submitted_at")
    .eq("post_id", postId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (attemptErr && !isMissingAttemptTableError(attemptErr)) {
    return NextResponse.json({ error: attemptErr.message }, { status: 500 });
  }

  return NextResponse.json({
    testTitle: access.post.title || payload.test.name,
    taskId: payload.taskId ?? null,
    isTeacher: access.isTeacher,
    progressAvailable: !isMissingAttemptTableError(attemptErr),
    reviewingAs: access.isTeacher && reviewAs ? reviewAs : null,
    questions: payload.test.questions.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      correctAnswerIndex: q.correctAnswerIndex,
    })),
    attempt: attempt
      ? {
          answers: normalizeAnswers(attempt.answers_json, payload.test.questions.length),
          score: Number(attempt.score ?? 0),
          total: Number(attempt.total ?? payload.test.questions.length),
          submittedAt: attempt.submitted_at ?? null,
        }
      : null,
  });
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
    answers?: unknown;
    submit?: boolean;
    chapterQuizScore?: { score: number; total: number };
  };
  try {
    body = (await request.json()) as {
      answers?: unknown;
      submit?: boolean;
      chapterQuizScore?: { score: number; total: number };
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const access = await loadPostAndAccess(authedClient, classroomId, postId, user.id);
  if ("error" in access)
    return NextResponse.json({ error: access.error }, { status: access.status });
  if (access.isTeacher) {
    return NextResponse.json(
      { error: "Teachers cannot submit student attempts." },
      { status: 403 }
    );
  }

  const genericClient = authedClient as unknown as GenericFrom;

  // Branch for Chapter Quiz flow that just reports score/total
  if (body.chapterQuizScore && access.post.type === "quiz") {
    if (body.submit !== true) return NextResponse.json({ ok: true });

    const submittedAt = new Date().toISOString();
    const score = Number(body.chapterQuizScore.score) || 0;
    const total = Number(body.chapterQuizScore.total) || 0;

    const { error: upsertErr } = await genericClient
      .from("classroom_generated_test_attempts")
      .upsert(
        {
          post_id: postId,
          classroom_id: classroomId,
          user_id: user.id,
          answers_json: [], // We don't store answers for chapter quiz flow yet
          score,
          total,
          submitted_at: submittedAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "post_id,user_id" }
      );

    if (upsertErr) {
      if (isMissingAttemptTableError(upsertErr)) {
        return NextResponse.json(
          { error: "Test attempt tracking is not set up." },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    // Attempt to tick off the assignment task
    const content = access.post.content_json as Record<string, unknown>;
    const tasksRaw = Array.isArray(content.tasks) ? content.tasks : [];
    const chapterQuizTask = tasksRaw.find(
      (t: Record<string, unknown>) => t?.kind === "chapter_quiz"
    );
    if (chapterQuizTask?.id) {
      await authedClient.from("classroom_assignment_task_progress").upsert(
        {
          post_id: postId,
          task_id: chapterQuizTask.id,
          user_id: user.id,
        },
        { onConflict: "post_id,task_id,user_id" }
      );
    }

    return NextResponse.json({
      ok: true,
      progressAvailable: true,
      score,
      total,
      submittedAt,
    });
  }

  // Branch for Generated MCQ Test flow
  const payload = parseGeneratedTestPayload(access.post.content_json);
  if (!payload) {
    return NextResponse.json(
      { error: "No generated test found for this assignment." },
      { status: 404 }
    );
  }

  const answers = normalizeAnswers(body.answers, payload.test.questions.length);
  const score = computeScore(payload.test.questions, answers);
  const total = payload.test.questions.length;
  const submittedAt = body.submit === true ? new Date().toISOString() : null;

  const { error: upsertErrMcq } = await genericClient
    .from("classroom_generated_test_attempts")
    .upsert(
      {
        post_id: postId,
        classroom_id: classroomId,
        user_id: user.id,
        answers_json: answers,
        score,
        total,
        submitted_at: submittedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "post_id,user_id" }
    );

  if (upsertErrMcq) {
    if (isMissingAttemptTableError(upsertErrMcq)) {
      return NextResponse.json(
        { error: "Test attempt tracking is not set up. Please contact support." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: upsertErrMcq.message }, { status: 500 });
  }

  if (body.submit === true && payload.taskId) {
    const visible = studentVisibleTasks(
      parseAssignmentTasks(access.post.content_json, access.post.type)
    );
    if (visible.some((t) => t.id === payload.taskId)) {
      await authedClient.from("classroom_assignment_task_progress").insert({
        post_id: postId,
        task_id: payload.taskId,
        user_id: user.id,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    progressAvailable: true,
    score,
    total,
    submittedAt,
    answers,
  });
}
