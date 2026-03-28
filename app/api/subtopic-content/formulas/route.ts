import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isAdminUser } from "@/lib/admin";
import { normalizeSubjectKey, normalizeSubtopicContentKey } from "@/lib/subtopicContentKeys";

function sanitize(value: unknown, maxLen = 500): string {
  if (typeof value !== "string") return "";
  return value.replace(/[<>\x00-\x1F\x7F]/g, " ").trim().slice(0, maxLen);
}

function normalizePracticeFormulas(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const o = item as Record<string, unknown>;
      const bitsRaw = Array.isArray(o.bitsQuestions) ? o.bitsQuestions : [];
      return {
        name: sanitize(o.name, 180),
        formulaLatex: sanitize(o.formulaLatex, 1500),
        description: sanitize(o.description, 800),
        bitsQuestions: bitsRaw
          .filter((q) => q && typeof q === "object")
          .map((q) => {
            const b = q as Record<string, unknown>;
            return {
              question: sanitize(b.question, 2000),
              options: Array.isArray(b.options)
                ? b.options.map((opt) => sanitize(opt, 1000)).filter(Boolean).slice(0, 4)
                : [],
              correctAnswer: sanitize(b.correctAnswer, 1000),
              solution: sanitize(b.solution, 4000),
            };
          })
          .filter((q) => q.question && q.options.length === 4 && q.correctAnswer),
      };
    })
    .filter((f) => f.name);
}

export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;
    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const board = normalizeSubtopicContentKey(body?.board);
    const subject = normalizeSubjectKey(body?.subject);
    const classLevel = Number(body?.classLevel);
    const topic = normalizeSubtopicContentKey(body?.topic);
    const subtopicName = normalizeSubtopicContentKey(body?.subtopicName);
    const level = normalizeSubtopicContentKey(body?.level);
    const practiceFormulas = normalizePracticeFormulas(body?.practiceFormulas);

    if (!board || !subject || !topic || !subtopicName || !level || Number.isNaN(classLevel)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { error } = await supabase
      .from("subtopic_content")
      .update({
        practice_formulas: JSON.parse(JSON.stringify(practiceFormulas)),
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("board", board)
      .eq("subject", subject)
      .eq("class_level", classLevel)
      .eq("topic", topic)
      .eq("subtopic_name", subtopicName)
      .eq("level", level);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("subtopic-content/formulas POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

