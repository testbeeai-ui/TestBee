import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
  createClientWithToken,
} from "@/integrations/supabase/server";
import { parseAssignmentTasks, studentVisibleTasks } from "@/lib/classroom/assignmentTasks";
import { tryFulfillAssignmentMotivationGrants } from "@/lib/teacherPortal/motivationRdm";

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

type ChapterQuizAttemptSnapshotV1 = {
  version: 1;
  items: Array<{
    question: string;
    options: string[];
    correctAnswerIndex: number;
    selectedAnswerIndex: number;
  }>;
};

type BitsAttemptRecordLite = {
  board: string;
  subject: string;
  classLevel: 11 | 12;
  topic: string;
  subtopicName: string;
  level: "basics" | "intermediate" | "advanced";
  selectedAnswers: Record<string, number>;
  submittedAt: string;
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

function sanitizeText(value: unknown, maxLen: number) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function parseChapterQuizSnapshot(input: unknown): ChapterQuizAttemptSnapshotV1 | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const snap = input as { version?: unknown; items?: unknown };
  if (snap.version !== 1) return null;
  if (!Array.isArray(snap.items)) return null;
  const items = snap.items
    .map((raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
      const r = raw as Record<string, unknown>;
      const question = sanitizeText(r.question, 2000);
      const optionsRaw = Array.isArray(r.options) ? r.options : [];
      const options = optionsRaw
        .map((o) => sanitizeText(o, 400))
        .filter((o) => Boolean(o))
        .slice(0, 10);
      const correctAnswerIndex =
        typeof r.correctAnswerIndex === "number" && Number.isInteger(r.correctAnswerIndex)
          ? r.correctAnswerIndex
          : -1;
      const selectedAnswerIndex =
        typeof r.selectedAnswerIndex === "number" && Number.isInteger(r.selectedAnswerIndex)
          ? r.selectedAnswerIndex
          : -1;
      if (!question || options.length < 2) return null;
      if (correctAnswerIndex < 0 || correctAnswerIndex >= options.length) return null;
      return { question, options, correctAnswerIndex, selectedAnswerIndex };
    })
    .filter(
      (
        x
      ): x is {
        question: string;
        options: string[];
        correctAnswerIndex: number;
        selectedAnswerIndex: number;
      } => Boolean(x)
    );
  if (items.length === 0) return null;
  return { version: 1, items };
}

function normalizeKeyPart(value: unknown, maxLen = 300): string {
  return sanitizeText(value, maxLen).toLowerCase();
}

function makeBitsAttemptKey(params: {
  board: string;
  subject: string;
  classLevel: number;
  topic: string;
  subtopicName: string;
  level: string;
  set?: 1 | 2 | 3;
}) {
  const base = [
    normalizeKeyPart(params.board, 40),
    normalizeKeyPart(params.subject, 80),
    String(params.classLevel),
    normalizeKeyPart(params.topic, 300),
    normalizeKeyPart(params.subtopicName, 300),
    normalizeKeyPart(params.level, 30),
  ].join("||");
  if (params.level === "advanced" && params.set != null && [1, 2, 3].includes(params.set)) {
    return `${base}||set:${params.set}`;
  }
  return base;
}

function parseBitsAttemptStoreForKey(raw: unknown, key: string): BitsAttemptRecordLite | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = (raw as Record<string, unknown>)[key];
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const r = row as Record<string, unknown>;
  const selectedRaw =
    r.selectedAnswers && typeof r.selectedAnswers === "object" && !Array.isArray(r.selectedAnswers)
      ? (r.selectedAnswers as Record<string, unknown>)
      : {};
  const selectedAnswers: Record<string, number> = {};
  for (const [k, v] of Object.entries(selectedRaw)) {
    const idx = Number(v);
    if (!Number.isInteger(idx) || idx < 0 || idx > 3) continue;
    selectedAnswers[String(k)] = idx;
  }
  const level = normalizeKeyPart(r.level, 30);
  if (level !== "basics" && level !== "intermediate" && level !== "advanced") return null;
  const submittedAt = sanitizeText(r.submittedAt, 80);
  if (!submittedAt) return null;
  return {
    board: sanitizeText(r.board, 40),
    subject: normalizeKeyPart(r.subject, 80),
    classLevel: Number(r.classLevel) === 12 ? 12 : 11,
    topic: sanitizeText(r.topic, 300),
    subtopicName: sanitizeText(r.subtopicName, 300),
    level: level as BitsAttemptRecordLite["level"],
    selectedAnswers,
    submittedAt,
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

  // Support teacher reviewing a specific student's attempt via ?reviewAs=userId
  const url = new URL(request.url);
  const reviewAs = url.searchParams.get("reviewAs");
  const targetUserId = access.isTeacher && reviewAs ? reviewAs : user.id;

  if (access.isTeacher && reviewAs) {
    const { data: member } = await authedClient
      .from("classroom_members")
      .select("user_id")
      .eq("classroom_id", classroomId)
      .eq("user_id", reviewAs)
      .maybeSingle();
    if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const payload = parseGeneratedTestPayload(access.post.content_json);
  if (payload) {
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

  if (access.post.type === "quiz") {
    const snap = parseChapterQuizSnapshot(attempt?.answers_json ?? null);
    if (!snap) {
      // Fallback for legacy chapter quizzes that only stored score in profiles.bits_test_attempts.
      // We reconstruct the per-question review using the persisted selectedAnswers + subtopic_content.bits_questions.
      const content =
        access.post && typeof access.post.content_json === "object" && access.post.content_json
          ? (access.post.content_json as Record<string, unknown>)
          : null;
      const cq =
        content?.chapterQuiz &&
        typeof content.chapterQuiz === "object" &&
        !Array.isArray(content.chapterQuiz)
          ? (content.chapterQuiz as Record<string, unknown>)
          : null;
      const subject = normalizeKeyPart(cq?.subject, 80);
      const classLevel = Number(cq?.classLevel);
      const topic = sanitizeText(cq?.topic, 300);
      const subtopicName = sanitizeText(cq?.subtopicName, 300);
      const level = normalizeKeyPart(cq?.level, 30);
      const advancedSetRaw = Number(cq?.advancedSet);
      const advancedSet: 1 | 2 | 3 | undefined = [1, 2, 3].includes(advancedSetRaw)
        ? (advancedSetRaw as 1 | 2 | 3)
        : undefined;

      if (subject && (classLevel === 11 || classLevel === 12) && topic && subtopicName && level) {
        const { data: profileRow } = await authedClient
          .from("profiles")
          .select("bits_test_attempts")
          .eq("id", targetUserId)
          .maybeSingle();
        const store =
          (profileRow as { bits_test_attempts?: unknown } | null)?.bits_test_attempts ?? null;

        // Try to match the same keying logic as /api/user/bits-attempts (CBSE/ICSE + optional set).
        const candidateBoards = ["CBSE", "ICSE"];
        let bitsAttempt: BitsAttemptRecordLite | null = null;
        for (const b of candidateBoards) {
          const keyed = makeBitsAttemptKey({
            board: b,
            subject,
            classLevel,
            topic,
            subtopicName,
            level,
            set: level === "advanced" ? advancedSet : undefined,
          });
          bitsAttempt = parseBitsAttemptStoreForKey(store, keyed);
          if (bitsAttempt) break;
          if (level === "advanced" && advancedSet === 1) {
            const legacy = makeBitsAttemptKey({
              board: b,
              subject,
              classLevel,
              topic,
              subtopicName,
              level,
            });
            bitsAttempt = parseBitsAttemptStoreForKey(store, legacy);
            if (bitsAttempt) break;
          }
        }

        if (bitsAttempt && Object.keys(bitsAttempt.selectedAnswers).length > 0) {
          // Load the question artifacts to rebuild a snapshot.
          const { data: subtopicRows } = await authedClient
            .from("subtopic_content")
            .select("bits_questions")
            .in("board", candidateBoards)
            .eq("subject", subject)
            .eq("class_level", classLevel)
            .eq("topic", topic)
            .eq("subtopic_name", subtopicName)
            .eq("level", level)
            .limit(1);

          const bitsQuestions = (subtopicRows?.[0] as { bits_questions?: unknown } | undefined)
            ?.bits_questions;
          if (Array.isArray(bitsQuestions) && bitsQuestions.length > 0) {
            const items = Object.entries(bitsAttempt.selectedAnswers)
              .map(([k, v]) => ({ idx: Number(k), selected: v }))
              .filter((x) => Number.isInteger(x.idx) && x.idx >= 0)
              .sort((a, b) => a.idx - b.idx)
              .map((x) => {
                const q = bitsQuestions[x.idx] as Record<string, unknown> | undefined;
                if (!q || typeof q !== "object" || Array.isArray(q)) return null;
                const question = sanitizeText(q.question, 2000);
                const optionsRaw = Array.isArray(q.options) ? q.options : [];
                const options = optionsRaw
                  .map((o) => sanitizeText(o, 400))
                  .filter((o) => Boolean(o))
                  .slice(0, 10);
                const correctAnswer = sanitizeText(q.correctAnswer, 400);
                const correctAnswerIndex = correctAnswer ? options.indexOf(correctAnswer) : -1;
                if (!question || options.length < 2) return null;
                if (correctAnswerIndex < 0) return null;
                return {
                  question,
                  options,
                  correctAnswerIndex,
                  selectedAnswerIndex: x.selected,
                };
              })
              .filter((x): x is ChapterQuizAttemptSnapshotV1["items"][number] => Boolean(x));

            if (items.length > 0) {
              const rebuilt: ChapterQuizAttemptSnapshotV1 = { version: 1, items };
              // Continue below with the standard snapshot response.
              return NextResponse.json({
                testTitle: access.post.title,
                taskId: null,
                isTeacher: access.isTeacher,
                progressAvailable: !isMissingAttemptTableError(attemptErr),
                reviewingAs: access.isTeacher && reviewAs ? reviewAs : null,
                questions: rebuilt.items.map((q, idx) => ({
                  id: String(idx + 1),
                  question: q.question,
                  options: q.options,
                  correctAnswerIndex: q.correctAnswerIndex,
                })),
                attempt: {
                  answers: rebuilt.items.map((i) => i.selectedAnswerIndex),
                  score: items.filter((i) => i.selectedAnswerIndex === i.correctAnswerIndex).length,
                  total: items.length,
                  submittedAt: bitsAttempt.submittedAt || null,
                },
              });
            }
          }
        }
      }

      return NextResponse.json(
        { error: "Answers were not recorded for this submission." },
        { status: 404 }
      );
    }
    return NextResponse.json({
      testTitle: access.post.title,
      taskId: null,
      isTeacher: access.isTeacher,
      progressAvailable: !isMissingAttemptTableError(attemptErr),
      reviewingAs: access.isTeacher && reviewAs ? reviewAs : null,
      questions: snap.items.map((q, idx) => ({
        id: String(idx + 1),
        question: q.question,
        options: q.options,
        correctAnswerIndex: q.correctAnswerIndex,
      })),
      attempt: attempt
        ? {
            answers: snap.items.map((i) => i.selectedAnswerIndex),
            score: Number(attempt.score ?? 0),
            total: Number(attempt.total ?? snap.items.length),
            submittedAt: attempt.submitted_at ?? null,
          }
        : null,
    });
  }

  return NextResponse.json(
    { error: "No generated test found for this assignment." },
    { status: 404 }
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

  let body: {
    answers?: unknown;
    submit?: boolean;
    chapterQuizScore?: { score: number; total: number };
    chapterQuizAttempt?: unknown;
  };
  try {
    body = (await request.json()) as {
      answers?: unknown;
      submit?: boolean;
      chapterQuizScore?: { score: number; total: number };
      chapterQuizAttempt?: unknown;
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
    const snapshot = parseChapterQuizSnapshot(body.chapterQuizAttempt ?? null);

    const { error: upsertErr } = await genericClient
      .from("classroom_generated_test_attempts")
      .upsert(
        {
          post_id: postId,
          classroom_id: classroomId,
          user_id: user.id,
          answers_json: snapshot ?? [],
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

    const adminAfterQuiz = createAdminClient();
    if (adminAfterQuiz) {
      try {
        await tryFulfillAssignmentMotivationGrants(adminAfterQuiz, user.id, postId);
      } catch {
        // non-fatal
      }
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

    const adminAfterMcq = createAdminClient();
    if (adminAfterMcq) {
      try {
        await tryFulfillAssignmentMotivationGrants(adminAfterMcq, user.id, postId);
      } catch {
        // non-fatal
      }
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
