import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
  createClientWithToken,
} from "@/integrations/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const subject = url.searchParams.get("subject");
  const topicTitle = url.searchParams.get("topicTitle");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);

  const authHeader = req.headers.get("authorization");
  const bearer =
    authHeader && authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

  const supabaseUser = bearer ? createClientWithToken(bearer) : await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabaseUser.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Sign in to view test history." }, { status: 401 });
  }

  const db = createAdminClient() ?? supabaseUser;

  let query = db
    .from("teacher_generated_test_history")
    .select("*")
    .eq("teacher_id", user.id)
    .order("generated_at", { ascending: false })
    .limit(limit);

  if (subject) {
    query = query.eq("subject", subject);
  }
  if (topicTitle) {
    query = query.eq("topic_title", topicTitle);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    history: data ?? [],
    count: (data ?? []).length,
  });
}
