import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
  createClientWithToken,
} from "@/integrations/supabase/server";
import type { Subject } from "@/types";

const SUBJECTS = new Set<Subject>(["physics", "chemistry", "math"]);

function isSubject(x: unknown): x is Subject {
  return typeof x === "string" && SUBJECTS.has(x as Subject);
}

function isValidScope(x: unknown): x is "Topic-wise" | "Unit-wise" {
  return x === "Topic-wise" || x === "Unit-wise";
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const {
    board,
    classLevel,
    subject,
    scope,
    chapterTitle,
    topicTitle,
    unitTitle,
    questions,
    questionCount,
    durationMinutes,
    usedQuestionStems,
  } = body as {
    board?: unknown;
    classLevel?: unknown;
    subject?: unknown;
    scope?: unknown;
    chapterTitle?: unknown;
    topicTitle?: unknown;
    unitTitle?: unknown;
    questions?: unknown;
    questionCount?: unknown;
    durationMinutes?: unknown;
    usedQuestionStems?: unknown;
  };

  // Validation
  if (classLevel !== 11 && classLevel !== 12) {
    return NextResponse.json({ error: "classLevel must be 11 or 12" }, { status: 400 });
  }
  if (!isSubject(subject)) {
    return NextResponse.json(
      { error: "subject must be physics, chemistry, or math" },
      { status: 400 }
    );
  }
  if (!isValidScope(scope)) {
    return NextResponse.json({ error: "scope must be Topic-wise or Unit-wise" }, { status: 400 });
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: "questions must be a non-empty array" }, { status: 400 });
  }

  const authHeader = req.headers.get("authorization");
  const bearer =
    authHeader && authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

  const supabaseUser = bearer ? createClientWithToken(bearer) : await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabaseUser.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Sign in to save test history." }, { status: 401 });
  }

  const db = createAdminClient() ?? supabaseUser;

  const { data, error } = await db
    // @ts-expect-error: Temporary ignore due to schema type mismatches
    .from("teacher_generated_test_history")
    .insert({
      teacher_id: user.id,
      board: typeof board === "string" ? board : "CBSE",
      class_level: classLevel,
      subject,
      scope,
      chapter_title: typeof chapterTitle === "string" ? chapterTitle : null,
      topic_title: typeof topicTitle === "string" ? topicTitle : null,
      unit_title: typeof unitTitle === "string" ? unitTitle : null,
      questions,
      question_count: questionCount,
      duration_minutes: durationMinutes,
      used_question_ids: usedQuestionStems,
    } as any)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: (data as unknown as { id: string })?.id,
    ok: true,
  });
}
