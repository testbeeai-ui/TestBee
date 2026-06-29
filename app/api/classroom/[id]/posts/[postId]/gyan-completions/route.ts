import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
  createClientWithToken,
} from "@/integrations/supabase/server";
import { parseAssignmentTasks, studentVisibleTasks } from "@/lib/classroom/assignmentTasks";

async function getAuthedUser(request: Request) {
  const tokenFromHeader = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (tokenFromHeader) {
    const supabaseWithToken = createClientWithToken(tokenFromHeader);
    const {
      data: { user },
    } = await supabaseWithToken.auth.getUser();
    return { user: user ?? null };
  }
  const cookieClient = await createClient();
  const {
    data: { user },
  } = await cookieClient.auth.getUser();
  return { user: user ?? null };
}

export type GyanAssignmentCompletionRow = {
  userId: string;
  studentName: string;
  taskId: string;
  doubtId: string;
  doubtTitle: string;
  doubtBody: string;
  subject: string | null;
  completedAt: string;
  hasTeacherAnswer: boolean;
};

/** Teacher: list Gyan++ doubts linked to this assignment post. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  const { id: classroomId, postId } = await params;
  if (!classroomId || !postId) {
    return NextResponse.json({ error: "classroom id and post id required" }, { status: 400 });
  }

  const { user } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  const { data: post, error: postErr } = await admin
    .from("posts")
    .select("id, classroom_id, teacher_id, type, content_json")
    .eq("id", postId)
    .maybeSingle();
  if (postErr || !post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.classroom_id !== classroomId) {
    return NextResponse.json({ error: "Post does not belong to this classroom" }, { status: 400 });
  }
  if (post.teacher_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gyanTaskIds = new Set(
    studentVisibleTasks(parseAssignmentTasks(post.content_json, post.type))
      .filter((t) => t.kind === "gyan_engagement")
      .map((t) => t.id)
  );
  if (gyanTaskIds.size === 0) {
    return NextResponse.json({ completions: [] as GyanAssignmentCompletionRow[] });
  }

  type ProgressRow = {
    task_id: string;
    user_id: string;
    doubt_id: string | null;
    completed_at: string;
  };
  const progressClient = admin as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string
        ) => {
          not: (
            column: string,
            operator: string,
            value: null
          ) => Promise<{
            data: ProgressRow[] | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };
  };

  const { data: progressRows, error: progErr } = await progressClient
    .from("classroom_assignment_task_progress")
    .select("task_id, user_id, doubt_id, completed_at")
    .eq("post_id", postId)
    .not("doubt_id", "is", null);
  if (progErr) {
    return NextResponse.json({ error: progErr.message }, { status: 500 });
  }

  const linked = (progressRows ?? []).filter(
    (r): r is ProgressRow & { doubt_id: string } =>
      gyanTaskIds.has(r.task_id) && typeof r.doubt_id === "string" && r.doubt_id.length > 0
  );
  if (linked.length === 0) {
    return NextResponse.json({ completions: [] as GyanAssignmentCompletionRow[] });
  }

  const doubtIds = [...new Set(linked.map((r) => r.doubt_id))];
  const userIds = [...new Set(linked.map((r) => r.user_id))];

  const [{ data: doubts }, { data: profiles }, { data: answers }] = await Promise.all([
    admin.from("doubts").select("id, title, body, subject, user_id").in("id", doubtIds),
    admin.from("profiles").select("id, name").in("id", userIds),
    admin.from("doubt_answers").select("doubt_id, user_id").in("doubt_id", doubtIds),
  ]);

  const answerAuthorIds = [...new Set((answers ?? []).map((a) => a.user_id))];
  const { data: answerAuthors } =
    answerAuthorIds.length > 0
      ? await admin.from("profiles").select("id, role").in("id", answerAuthorIds)
      : { data: [] as Array<{ id: string; role: string | null }> };

  const doubtById = new Map((doubts ?? []).map((d) => [d.id, d]));
  const nameByUser = new Map((profiles ?? []).map((p) => [p.id, p.name ?? "Student"]));

  const teacherAuthorIds = new Set(
    (answerAuthors ?? []).filter((p) => p.role === "teacher").map((p) => p.id)
  );
  const doubtsWithTeacherAnswer = new Set<string>();
  for (const a of answers ?? []) {
    if (teacherAuthorIds.has(a.user_id)) {
      doubtsWithTeacherAnswer.add(a.doubt_id);
    }
  }

  const completions: GyanAssignmentCompletionRow[] = linked
    .map((row) => {
      const doubt = doubtById.get(row.doubt_id);
      if (!doubt) return null;
      return {
        userId: row.user_id,
        studentName: nameByUser.get(row.user_id) ?? "Student",
        taskId: row.task_id,
        doubtId: row.doubt_id,
        doubtTitle: doubt.title,
        doubtBody: doubt.body ?? "",
        subject: doubt.subject,
        completedAt: row.completed_at,
        hasTeacherAnswer: doubtsWithTeacherAnswer.has(row.doubt_id),
      };
    })
    .filter(Boolean) as GyanAssignmentCompletionRow[];

  completions.sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1));

  return NextResponse.json({ completions });
}
