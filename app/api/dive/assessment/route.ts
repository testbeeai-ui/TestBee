import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { fetchLearningOutcomesQuestions } from "@/lib/curriculum/learningOutcomesLookup";
import { makeSubtopicEngagementStorageKey } from "@/lib/curriculum/subtopicEngagementStorageKey";
import {
  parseAnswerMap,
  parseBitsQuestions,
  parseFormulaBitsQuestions,
  parseQuizSetIndex,
  scorePctFromAnswers,
  sliceQuizSetQuestions,
  type DiveAssessmentKind,
} from "@/lib/dive/gradeDiveAssessment";
import type { Board, Subject } from "@/types";

const ALLOWED_LEVELS = new Set(["basics", "intermediate", "advanced"]);
const KINDS = new Set<DiveAssessmentKind>(["quiz", "numerals", "outcomes"]);

function sanitize(value: unknown, maxLen = 300): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function parseScope(input: {
  board?: unknown;
  subject?: unknown;
  classLevel?: unknown;
  topic?: unknown;
  subtopicName?: unknown;
  level?: unknown;
}) {
  const board = sanitize(input.board, 40);
  const subject = sanitize(input.subject, 80).toLowerCase();
  const classLevel = Number(input.classLevel);
  const topic = sanitize(input.topic, 300);
  const subtopicName = sanitize(input.subtopicName, 300);
  const level = sanitize(input.level, 30).toLowerCase() || "advanced";

  if (
    !board ||
    !subject ||
    !topic ||
    !subtopicName ||
    Number.isNaN(classLevel) ||
    ![11, 12].includes(classLevel) ||
    !ALLOWED_LEVELS.has(level)
  ) {
    return null;
  }

  return {
    board: board as Board,
    subject: subject as Subject,
    classLevel: classLevel as 11 | 12,
    topic,
    subtopicName,
    level,
    key: makeSubtopicEngagementStorageKey({
      board: board as Board,
      subject: subject as Subject,
      classLevel: classLevel as 11 | 12,
      topic,
      subtopicName,
      level: level as "basics" | "intermediate" | "advanced",
    }),
  };
}

function maxScore(a: number | null, b: number): number {
  if (a == null) return b;
  return Math.max(a, b);
}

/**
 * POST — submit Dive assessment answers; server re-grades from DB content and upserts score.
 * Body: { board, subject, classLevel, topic, subtopicName, level?, kind, answers, quizSetIndex?, formulaIndex? }
 */
export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;
    const body = await request.json();
    const scope = parseScope(body ?? {});
    if (!scope) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    const kindRaw = typeof body?.kind === "string" ? body.kind : "";
    if (!KINDS.has(kindRaw as DiveAssessmentKind)) {
      return NextResponse.json({ error: "Invalid assessment kind" }, { status: 400 });
    }
    const kind = kindRaw as DiveAssessmentKind;
    const answers = parseAnswerMap(body?.answers);
    const quizSetIndex = parseQuizSetIndex(body?.quizSetIndex);
    const formulaIndex = Number(body?.formulaIndex);

    let questions: ReturnType<typeof parseBitsQuestions> = [];

    if (kind === "quiz" || kind === "numerals") {
      const { data, error } = await supabase
        .from("subtopic_content")
        .select("bits_questions, practice_formulas")
        .eq("board", scope.board)
        .eq("subject", scope.subject)
        .eq("class_level", scope.classLevel)
        .eq("topic", scope.topic)
        .eq("subtopic_name", scope.subtopicName)
        .eq("level", scope.level)
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      if (kind === "quiz") {
        const all = parseBitsQuestions(data?.bits_questions);
        questions = sliceQuizSetQuestions(all, quizSetIndex ?? (all.length > 0 ? 1 : null));
      } else {
        if (!Number.isInteger(formulaIndex) || formulaIndex < 0) {
          return NextResponse.json({ error: "Invalid formulaIndex" }, { status: 400 });
        }
        questions = parseFormulaBitsQuestions(data?.practice_formulas, formulaIndex);
      }
    } else {
      const loQuestions = await fetchLearningOutcomesQuestions(supabase, {
        board: scope.board,
        subject: scope.subject,
        class_level: scope.classLevel,
        topic: scope.topic,
        subtopic_name: scope.subtopicName,
        level: scope.level,
      });
      questions = parseBitsQuestions(loQuestions);
    }

    if (questions.length === 0) {
      return NextResponse.json({ error: "No questions to grade" }, { status: 404 });
    }

    const scored = scorePctFromAnswers(questions, answers);

    const { data: existing, error: readErr } = await supabase
      .from("dive_hub_progress")
      .select("completed, quiz_score, numeral_score, outcomes_score, undertaking_accepted")
      .eq("user_id", user.id)
      .eq("storage_key", scope.key)
      .maybeSingle();

    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

    const completedRaw = Array.isArray(existing?.completed) ? existing.completed : [];
    const completed = Array.from(new Set([...completedRaw, kind]));

    const quizScore =
      kind === "quiz"
        ? maxScore(existing?.quiz_score ?? null, scored.scorePct)
        : existing?.quiz_score ?? null;
    const numeralScore =
      kind === "numerals"
        ? maxScore(existing?.numeral_score ?? null, scored.scorePct)
        : existing?.numeral_score ?? null;
    const outcomesScore =
      kind === "outcomes"
        ? maxScore(existing?.outcomes_score ?? null, scored.scorePct)
        : existing?.outcomes_score ?? null;

    const now = new Date().toISOString();
    const { error: writeErr } = await supabase.from("dive_hub_progress").upsert(
      {
        user_id: user.id,
        storage_key: scope.key,
        completed,
        quiz_score: quizScore,
        numeral_score: numeralScore,
        outcomes_score: outcomesScore,
        undertaking_accepted: existing?.undertaking_accepted === true,
        updated_at: now,
      },
      { onConflict: "user_id,storage_key" }
    );

    if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      kind,
      correct: scored.correct,
      total: scored.total,
      scorePct: scored.scorePct,
      progress: {
        completed,
        quizScore,
        numeralScore,
        outcomesScore,
        undertakingAccepted: existing?.undertaking_accepted === true,
      },
      updatedAt: now,
    });
  } catch (e) {
    console.error("dive assessment POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
