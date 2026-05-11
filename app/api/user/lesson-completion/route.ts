import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { LESSON_COMPLETION_TRACKED_LEVEL } from "@/lib/lessonCompletionRollup";
import type { LessonCompletionApiItem } from "@/lib/lessonCompletionRollup";

function sanitize(value: unknown, maxLen = 300): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;

    const { searchParams } = new URL(request.url);
    const subject = sanitize(searchParams.get("subject"), 80).toLowerCase();
    const classLevel = Number(searchParams.get("classLevel"));
    const boardParam = sanitize(searchParams.get("board"), 40).toLowerCase();

    if (!subject || !["physics", "chemistry", "math"].includes(subject)) {
      return NextResponse.json({ error: "Missing or invalid subject" }, { status: 400 });
    }
    if (Number.isNaN(classLevel) || ![11, 12].includes(classLevel)) {
      return NextResponse.json({ error: "Missing or invalid classLevel" }, { status: 400 });
    }

    let q = supabase
      .from("student_lesson_mark_completions" as never)
      .select("board,subject,class_level,topic,subtopic,marked_complete_at")
      .eq("user_id", user.id)
      .eq("subject", subject)
      .eq("class_level", classLevel)
      .eq("level", LESSON_COMPLETION_TRACKED_LEVEL);

    if (boardParam) {
      q = q.eq("board", boardParam);
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []) as Array<{
      board: string;
      subject: string;
      class_level: number;
      topic: string;
      subtopic: string;
      marked_complete_at: string;
    }>;

    const items: LessonCompletionApiItem[] = rows.map((r) => ({
      board: r.board,
      subject: r.subject,
      classLevel: r.class_level,
      topic: r.topic,
      subtopic: r.subtopic,
      markedCompleteAt: r.marked_complete_at,
    }));

    return NextResponse.json({ items });
  } catch (e) {
    console.error("lesson-completion GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
