import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
  createClientWithToken,
} from "@/integrations/supabase/server";
import { normalizeSubtopicContentKey } from "@/lib/curriculum/subtopicContentKeys";
import type { CreateTestQuestionBankMatch } from "@/lib/play/quiz/createTestBankTypes";
import type { Subject } from "@/types";

const SUBJECTS = new Set<Subject>(["physics", "chemistry", "math"]);
const BOARD = "CBSE";
const TOPIC_IN_CHUNK = 40;

type Db = ReturnType<typeof createClientWithToken>;

type RawBankRow = {
  topic: string | null;
  subtopic_name: string | null;
  level: string | null;
  bits_questions: unknown;
};

function chunkStrings(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size));
  }
  return out;
}

function isSubject(x: unknown): x is Subject {
  return typeof x === "string" && SUBJECTS.has(x as Subject);
}

function isMatch(x: unknown): x is CreateTestQuestionBankMatch {
  if (!x || typeof x !== "object") return false;
  const m = x as { scope?: string; topicTitles?: unknown; chapterTitle?: unknown };
  if (m.scope !== "Topic-wise" && m.scope !== "Unit-wise") return false;
  if (!Array.isArray(m.topicTitles) || !m.topicTitles.every((t) => typeof t === "string")) {
    return false;
  }
  if (m.scope === "Topic-wise") {
    return typeof m.chapterTitle === "string";
  }
  return true;
}

function normalizeStem(text: unknown): string {
  return typeof text === "string" ? text.trim().toLowerCase() : "";
}

async function getUsedQuestionStemsForTopic(
  db: Db,
  teacherId: string,
  subject: string
): Promise<Set<string>> {
  const usedStems = new Set<string>();

  // Fetch all history for this teacher+subject — covers both Topic-wise and Unit-wise entries
  const { data, error } = await db
    .from("teacher_generated_test_history")
    .select("used_question_ids")
    .eq("teacher_id", teacherId)
    .eq("subject", subject);

  if (error || !data) return usedStems;

  for (const row of data as unknown as Array<{ used_question_ids: unknown }>) {
    const stems = Array.isArray(row.used_question_ids) ? row.used_question_ids : [];
    for (const stem of stems) {
      const normalized = normalizeStem(stem);
      if (normalized) usedStems.add(normalized);
    }
  }

  return usedStems;
}

function filterRowsExcludingUsed(rows: RawBankRow[], usedStems: Set<string>): RawBankRow[] {
  return rows
    .map((r) => ({
      ...r,
      bits_questions: Array.isArray(r.bits_questions)
        ? r.bits_questions.filter((q) => {
            if (!q || typeof q !== "object") return true;
            const stem = normalizeStem((q as { question?: unknown }).question);
            return !stem || !usedStems.has(stem);
          })
        : r.bits_questions,
    }))
    .filter((r) => {
      const arr = Array.isArray(r.bits_questions) ? r.bits_questions : [];
      return arr.length > 0;
    });
}

async function fetchBitsRowsForTopicsIn(
  db: Db,
  subject: string,
  classLevel: number,
  topicTitles: string[],
  levelFilter?: "basics" | "intermediate" | "advanced" | null
): Promise<{ rows: RawBankRow[]; error: string | null }> {
  const keys = [...new Set(topicTitles.map((t) => normalizeSubtopicContentKey(t)).filter(Boolean))];
  if (keys.length === 0) return { rows: [], error: null };

  const all: RawBankRow[] = [];
  for (const chunk of chunkStrings(keys, TOPIC_IN_CHUNK)) {
    let query = db
      .from("subtopic_content")
      .select("topic, subtopic_name, level, bits_questions")
      .eq("board", BOARD)
      .eq("subject", subject)
      .eq("class_level", classLevel)
      .in("topic", chunk);
    if (levelFilter) {
      query = query.eq("level", levelFilter);
    }
    const { data, error } = await query;
    if (error) return { rows: [], error: error.message };
    if (data?.length) all.push(...data);
  }
  return { rows: all, error: null };
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

  const { classLevel, subject, match } = body as {
    classLevel?: unknown;
    subject?: unknown;
    match?: unknown;
  };

  // Topic-wise and Unit-wise scopes automatically restrict to advanced level only
  const effectiveLevelFilter: "advanced" | null =
    match &&
    typeof match === "object" &&
    ((match as { scope?: string }).scope === "Topic-wise" ||
      (match as { scope?: string }).scope === "Unit-wise")
      ? "advanced"
      : null;

  if (classLevel !== 11 && classLevel !== 12) {
    return NextResponse.json({ error: "classLevel must be 11 or 12" }, { status: 400 });
  }
  if (!isSubject(subject)) {
    return NextResponse.json(
      { error: "subject must be physics, chemistry, or math" },
      { status: 400 }
    );
  }
  if (!isMatch(match)) {
    return NextResponse.json({ error: "Invalid match payload" }, { status: 400 });
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
    return NextResponse.json({ error: "Sign in to load question-bank rows." }, { status: 401 });
  }

  const db = createAdminClient() ?? supabaseUser;

  // Get used question stems from history for depletion
  const usedStems = await getUsedQuestionStemsForTopic(db, user.id, subject);

  const firstPass = await fetchBitsRowsForTopicsIn(
    db,
    subject,
    classLevel,
    match.topicTitles,
    effectiveLevelFilter
  );
  if (firstPass.error) {
    return NextResponse.json({ error: firstPass.error }, { status: 500 });
  }

  let rows = filterRowsExcludingUsed(firstPass.rows, usedStems);
  let classLevelUsed: 11 | 12 = classLevel;
  if (rows.length === 0) {
    const alt = classLevel === 11 ? 12 : 11;
    const secondPass = await fetchBitsRowsForTopicsIn(
      db,
      subject,
      alt,
      match.topicTitles,
      effectiveLevelFilter
    );
    if (secondPass.error) {
      return NextResponse.json({ error: secondPass.error }, { status: 500 });
    }
    if (secondPass.rows.length > 0) {
      rows = filterRowsExcludingUsed(secondPass.rows, usedStems);
      classLevelUsed = alt;
    }
  }

  return NextResponse.json({
    rows,
    scanned: rows.length,
    classLevelUsed,
    source: "subtopic_content.bits_questions",
    error: null,
  });
}
