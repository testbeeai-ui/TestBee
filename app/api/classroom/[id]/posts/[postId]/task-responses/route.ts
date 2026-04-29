import { NextResponse } from "next/server";
import { createAdminClient, createClient, createClientWithToken } from "@/integrations/supabase/server";

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
    .select("id, classroom_id, teacher_id")
    .eq("id", postId)
    .maybeSingle();
  if (postErr || !post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.classroom_id !== classroomId) {
    return NextResponse.json({ error: "Post does not belong to this classroom" }, { status: 400 });
  }
  if (post.teacher_id !== user.id) {
    // Fallback: allow co-teacher/admin roles only if your app supports it later.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Use service role to avoid RLS surprises and return full response set.
  // Table is introduced via migration; until Supabase types are regenerated, keep this query typed as any.
  const generic = admin as unknown as {
    from: (table: string) => any;
  };
  const { data: rows, error } = await generic
    .from("classroom_assignment_responses")
    .select("task_id, user_id, response_text, links, updated_at, created_at")
    .eq("post_id", postId)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach display names via profiles (service role read).
  const safeRows = (rows ?? []) as Array<{
    task_id: string;
    user_id: string;
    response_text: string | null;
    links: string[] | null;
    updated_at: string;
    created_at: string;
  }>;
  const userIds = Array.from(new Set(safeRows.map((r) => r.user_id)));
  const { data: profiles } = await admin.from("profiles").select("id, name").in("id", userIds);
  const byId = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      { name: (p.name as string | null) ?? null, email: null as string | null },
    ])
  );

  const out = safeRows.map((r) => ({
    taskId: r.task_id,
    userId: r.user_id,
    responseText: r.response_text ?? null,
    links: (r.links ?? []) as string[],
    updatedAt: r.updated_at,
    createdAt: r.created_at,
    student: byId.get(r.user_id) ?? { name: null, email: null },
  }));

  return NextResponse.json({ responses: out });
}

