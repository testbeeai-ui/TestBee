import { NextResponse } from "next/server";
import { createClient, createClientWithToken } from "@/integrations/supabase/server";

async function getAuthedUser(request: Request) {
  const tokenFromHeader = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (tokenFromHeader) {
    const supabaseWithToken = createClientWithToken(tokenFromHeader);
    const {
      data: { user },
    } = await supabaseWithToken.auth.getUser();
    return { user: user ?? null, authedClient: supabaseWithToken };
  }
  const cookieClient = await createClient();
  const {
    data: { user },
  } = await cookieClient.auth.getUser();
  return { user: user ?? null, authedClient: cookieClient };
}

function normalizeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(v.startsWith("http://") || v.startsWith("https://") ? v : `https://${v}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
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

  // Ensure the post is in this classroom (and that caller can read it via RLS).
  const { data: post, error: postErr } = await authedClient
    .from("posts")
    .select("id, classroom_id, teacher_id")
    .eq("id", postId)
    .maybeSingle();
  if (postErr || !post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.classroom_id !== classroomId) {
    return NextResponse.json({ error: "Post does not belong to this classroom" }, { status: 400 });
  }
  if (post.teacher_id === user.id) {
    return NextResponse.json({ error: "Teachers use /task-responses" }, { status: 403 });
  }

  // Table is introduced via migration; until Supabase types are regenerated, keep this query typed as any.
  const generic = authedClient as unknown as {
    from: (table: string) => any;
  };
  const { data: rows, error } = await generic
    .from("classroom_assignment_responses")
    .select("task_id, response_text, links, updated_at")
    .eq("post_id", postId)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ responses: rows ?? [] });
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

  let body: { taskId?: string; responseText?: string; links?: string[] };
  try {
    body = (await request.json()) as { taskId?: string; responseText?: string; links?: string[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const responseTextRaw = typeof body.responseText === "string" ? body.responseText : "";
  const responseText = responseTextRaw.trim().slice(0, 4000) || null;

  const rawLinks = Array.isArray(body.links) ? body.links : [];
  const links = rawLinks
    .map((l) => (typeof l === "string" ? normalizeUrl(l) : null))
    .filter((x): x is string => Boolean(x))
    .slice(0, 5);

  // Ensure post belongs to classroom and caller is a member (RLS might already cover this,
  // but we return clearer errors and prevent accidental cross-class writes).
  const { data: post, error: postErr } = await authedClient
    .from("posts")
    .select("id, classroom_id, teacher_id")
    .eq("id", postId)
    .maybeSingle();
  if (postErr || !post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.classroom_id !== classroomId) {
    return NextResponse.json({ error: "Post does not belong to this classroom" }, { status: 400 });
  }
  if (post.teacher_id === user.id) {
    return NextResponse.json({ error: "Teachers cannot submit responses" }, { status: 403 });
  }

  const { data: mem } = await authedClient
    .from("classroom_members")
    .select("user_id")
    .eq("classroom_id", classroomId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!mem) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = {
    classroom_id: classroomId,
    post_id: postId,
    task_id: taskId,
    user_id: user.id,
    response_text: responseText,
    links: links.length ? links : null,
  };

  // Table is introduced via migration; until Supabase types are regenerated, keep this query typed as any.
  const generic = authedClient as unknown as {
    from: (table: string) => any;
  };
  const { data, error } = await generic
    .from("classroom_assignment_responses")
    .upsert(payload, { onConflict: "post_id,task_id,user_id" })
    .select("task_id, response_text, links, updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, response: data });
}
