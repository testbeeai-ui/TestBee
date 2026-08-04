import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { makeSubtopicEngagementStorageKey } from "@/lib/curriculum/subtopicEngagementStorageKey";
import { DIVE_ACTIVITY_IDS, type DiveActivityId } from "@/components/dive/diveTypes";
import type { DiveHubProgress } from "@/lib/dive/diveHubProgress";
import type { Board, Subject } from "@/types";
import type { DifficultyLevel } from "@/lib/slugs";

const ALLOWED_LEVELS = new Set(["basics", "intermediate", "advanced"]);
const ACTIVITY_SET = new Set<string>(DIVE_ACTIVITY_IDS);
/** Only POST /api/dive/assessment may add these to completed. */
const ASSESSMENT_ACTIVITY_IDS = new Set(["quiz", "numerals", "outcomes"]);

function sanitize(value: unknown, maxLen = 300): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function clampScore(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseCompleted(raw: unknown): DiveActivityId[] {
  if (!Array.isArray(raw)) return [];
  const out: DiveActivityId[] = [];
  const seen = new Set<string>();
  for (const id of raw) {
    if (typeof id !== "string" || !ACTIVITY_SET.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id as DiveActivityId);
  }
  return out;
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

  const scope = {
    board: board as Board,
    subject: subject as Subject,
    classLevel: classLevel as 11 | 12,
    topic,
    subtopicName,
    level: level as DifficultyLevel,
  };
  return { scope, key: makeSubtopicEngagementStorageKey(scope) };
}

function rowToProgress(
  row: {
    completed?: string[] | null;
    quiz_score?: number | null;
    numeral_score?: number | null;
    outcomes_score?: number | null;
    undertaking_accepted?: boolean | null;
  } | null
): DiveHubProgress {
  if (!row) {
    return {
      completed: [],
      quizScore: null,
      numeralScore: null,
      outcomesScore: null,
      undertakingAccepted: false,
    };
  }
  return {
    completed: parseCompleted(row.completed),
    quizScore: clampScore(row.quiz_score),
    numeralScore: clampScore(row.numeral_score),
    outcomesScore: clampScore(row.outcomes_score),
    undertakingAccepted: row.undertaking_accepted === true,
  };
}

function progressEqual(a: DiveHubProgress, b: DiveHubProgress): boolean {
  if (a.quizScore !== b.quizScore) return false;
  if (a.numeralScore !== b.numeralScore) return false;
  if (a.outcomesScore !== b.outcomesScore) return false;
  if (a.undertakingAccepted !== b.undertakingAccepted) return false;
  if (a.completed.length !== b.completed.length) return false;
  const setB = new Set(b.completed);
  return a.completed.every((id) => setB.has(id));
}

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;

    const { searchParams } = new URL(request.url);
    const parsed = parseScope({
      board: searchParams.get("board"),
      subject: searchParams.get("subject"),
      classLevel: searchParams.get("classLevel"),
      topic: searchParams.get("topic"),
      subtopicName: searchParams.get("subtopicName"),
      level: searchParams.get("level"),
    });
    if (!parsed) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("dive_hub_progress")
      .select(
        "completed, quiz_score, numeral_score, outcomes_score, undertaking_accepted, updated_at"
      )
      .eq("user_id", user.id)
      .eq("storage_key", parsed.key)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(
      {
        progress: rowToProgress(data),
        updatedAt: data?.updated_at ?? null,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (e) {
    console.error("dive progress GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * PUT — sync completed activities + undertaking.
 * Assessment scores are server-graded via POST /api/dive/assessment; client score fields are ignored.
 */
export async function PUT(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;
    const body = await request.json();

    const parsed = parseScope(body ?? {});
    if (!parsed) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    const { data: existing, error: readErr } = await supabase
      .from("dive_hub_progress")
      .select("completed, quiz_score, numeral_score, outcomes_score, undertaking_accepted")
      .eq("user_id", user.id)
      .eq("storage_key", parsed.key)
      .maybeSingle();

    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

    const prev = rowToProgress(existing);
    // Ignore client claims for quiz/numerals/outcomes — those require server grading.
    const clientCompleted = parseCompleted(body?.completed ?? body?.progress?.completed).filter(
      (id) => !ASSESSMENT_ACTIVITY_IDS.has(id)
    );
    const completed = Array.from(new Set([...prev.completed, ...clientCompleted]));
    const undertakingAccepted =
      prev.undertakingAccepted ||
      body?.undertakingAccepted === true ||
      body?.progress?.undertakingAccepted === true;

    const next: DiveHubProgress = {
      completed,
      // Scores only change via /api/dive/assessment
      quizScore: prev.quizScore,
      numeralScore: prev.numeralScore,
      outcomesScore: prev.outcomesScore,
      undertakingAccepted,
    };

    if (progressEqual(prev, next)) {
      return new NextResponse(null, { status: 204 });
    }

    const now = new Date().toISOString();
    const { error: writeErr } = await supabase.from("dive_hub_progress").upsert(
      {
        user_id: user.id,
        storage_key: parsed.key,
        completed: next.completed,
        quiz_score: next.quizScore,
        numeral_score: next.numeralScore,
        outcomes_score: next.outcomesScore,
        undertaking_accepted: next.undertakingAccepted,
        updated_at: now,
      },
      { onConflict: "user_id,storage_key" }
    );

    if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, progress: next, updatedAt: now });
  } catch (e) {
    console.error("dive progress PUT error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
