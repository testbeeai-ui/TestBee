import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
  createClientWithToken,
} from "@/integrations/supabase/server";
import { parseBitsTestAttemptsStore } from "@/lib/play/bits/parseBitsTestAttemptsStore";
import { parseAssignmentTasks, studentVisibleTasks } from "@/lib/classroom/assignmentTasks";

type GenericQueryResult = {
  data: Record<string, unknown>[] | null;
  error: { code?: string; message?: string } | null;
};

type GenericFrom = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => {
        order: (column: string, opts: { ascending: boolean }) => Promise<GenericQueryResult>;
      };
    };
  };
};

function normalizeKey(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
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

  // Verify user is the teacher of this classroom/post
  const { data: post, error: postErr } = await authedClient
    .from("posts")
    .select("id, classroom_id, teacher_id, type, content_json")
    .eq("id", postId)
    .maybeSingle();

  if (postErr || !post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  if (post.classroom_id !== classroomId) {
    return NextResponse.json({ error: "Post does not belong to this classroom" }, { status: 400 });
  }
  if (post.teacher_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Concept Focus is lesson checklist completion, not a scored quiz — never surface bits/MCQ marks here.
  if ((post as { type?: string }).type === "Concept Focus") {
    return NextResponse.json(
      { scores: [] },
      { headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=30" } }
    );
  }

  const genericClient = authedClient as unknown as GenericFrom;

  // Fetch all attempts for this post (no profiles join to avoid RLS row dropping)
  const { data: attempts, error: attemptsErr } = await genericClient
    .from("classroom_generated_test_attempts")
    .select("user_id, score, total, submitted_at, answers_json")
    .eq("post_id", postId)
    .order("submitted_at", { ascending: false });

  if (attemptsErr) {
    return NextResponse.json({ error: attemptsErr.message }, { status: 500 });
  }

  const latestByUser = new Map<
    string,
    {
      userId: string;
      score: number;
      total: number;
      submittedAt: string | null;
      answers: unknown[];
    }
  >();
  for (const raw of attempts ?? []) {
    const row = raw as Record<string, unknown>;
    const submittedAt = typeof row.submitted_at === "string" ? row.submitted_at : null;
    if (!submittedAt) continue;
    const userId = String(row.user_id);
    if (latestByUser.has(userId)) continue;
    latestByUser.set(userId, {
      userId,
      score: Number(row.score ?? 0),
      total: Number(row.total ?? 0),
      submittedAt,
      answers: Array.isArray(row.answers_json) ? row.answers_json : [],
    });
  }

  const results = Array.from(latestByUser.values());

  // Fallback path for chapter quiz attempts stored in profiles.bits_test_attempts.
  const content =
    post && typeof (post as { content_json?: unknown }).content_json === "object"
      ? ((post as { content_json?: unknown }).content_json as Record<string, unknown> | null)
      : null;
  const cq =
    content?.chapterQuiz &&
    typeof content.chapterQuiz === "object" &&
    !Array.isArray(content.chapterQuiz)
      ? (content.chapterQuiz as Record<string, unknown>)
      : null;
  if (cq) {
    const expectedSubject = normalizeKey(cq.subject);
    const expectedClass = Number(cq.classLevel);
    const expectedTopic = normalizeKey(cq.topic);
    const expectedSubtopic = normalizeKey(cq.subtopicName);
    const expectedLevel = normalizeKey(cq.level);

    const { data: members } = await authedClient
      .from("classroom_members")
      .select("user_id")
      .eq("classroom_id", classroomId);
    const memberIds = (members ?? []).map((m) => m.user_id);

    if (memberIds.length > 0) {
      const { data: profiles } = await authedClient
        .from("profiles")
        .select("id,bits_test_attempts")
        .in("id", memberIds);
      const seen = new Set(results.map((r) => r.userId));
      for (const profile of (profiles ?? []) as Array<{
        id: string;
        bits_test_attempts?: unknown;
      }>) {
        if (seen.has(profile.id)) continue;
        const rows = parseBitsTestAttemptsStore(profile.bits_test_attempts ?? null);
        const match = rows
          .filter((r) => {
            return (
              normalizeKey(r.subject) === expectedSubject &&
              Number(r.classLevel) === expectedClass &&
              normalizeKey(r.topic) === expectedTopic &&
              normalizeKey(r.subtopicName) === expectedSubtopic &&
              (!expectedLevel || normalizeKey(r.level) === expectedLevel)
            );
          })
          .sort((a, b) => (b.submittedAtMs ?? 0) - (a.submittedAtMs ?? 0))[0];
        if (!match) continue;
        results.push({
          userId: profile.id,
          score: Number(match.correctCount) || 0,
          total: Number(match.totalQuestions) || 0,
          submittedAt:
            typeof match.submittedAtMs === "number"
              ? new Date(match.submittedAtMs).toISOString()
              : null,
          answers: [],
        });
      }
    }
  }

  // Students who completed a scorable checklist task but have no attempt row yet (e.g. mock opened without finish).
  const scorableTaskIds = new Set(
    studentVisibleTasks(parseAssignmentTasks(post.content_json, (post as { type?: string }).type ?? ""))
      .filter(
        (t) =>
          t.kind === "chapter_quiz" || t.kind === "mock_paper" || t.kind === "past_paper"
      )
      .map((t) => t.id)
  );
  if (scorableTaskIds.size > 0) {
    const { data: progRows, error: progErr } = await authedClient
      .from("classroom_assignment_task_progress")
      .select("user_id, task_id, completed_at")
      .eq("post_id", postId);
    if (!progErr && progRows) {
      const seen = new Set(results.map((r) => r.userId));
      for (const row of progRows as Array<{
        user_id: string;
        task_id: string;
        completed_at?: string | null;
      }>) {
        if (!scorableTaskIds.has(row.task_id)) continue;
        const userId = String(row.user_id);
        if (seen.has(userId)) continue;
        seen.add(userId);
        results.push({
          userId,
          score: 0,
          total: 0,
          submittedAt:
            typeof row.completed_at === "string" && row.completed_at.trim()
              ? row.completed_at
              : new Date().toISOString(),
          answers: [],
        });
      }
    }
  }

  return NextResponse.json(
    { scores: results },
    { headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=30" } }
  );
}
