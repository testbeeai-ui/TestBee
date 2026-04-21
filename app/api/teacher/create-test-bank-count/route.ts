import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
  createClientWithToken,
} from "@/integrations/supabase/server";
import { normalizeSubtopicContentKey } from "@/lib/subtopicContentKeys";
import type { CreateTestQuestionBankMatch } from "@/lib/createTestBankTypes";
import type { Subject } from "@/types";

const SUBJECTS = new Set<Subject>(["physics", "chemistry", "math"]);
const BOARD = "CBSE";
const TOPIC_IN_CHUNK = 40;

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
  if (!Array.isArray(m.topicTitles) || !m.topicTitles.every((t) => typeof t === "string"))
    return false;
  if (m.scope === "Topic-wise") {
    return typeof m.chapterTitle === "string";
  }
  return true;
}

function sumBitsQuestions(rows: { bits_questions: unknown }[] | null): number {
  if (!rows?.length) return 0;
  let n = 0;
  for (const r of rows) {
    const arr = Array.isArray(r.bits_questions) ? r.bits_questions : [];
    n += arr.length;
  }
  return n;
}

type Db = ReturnType<typeof createClientWithToken>;

async function fetchBitsRowsForTopicsIn(
  db: Db,
  subject: string,
  classLevel: number,
  topicTitles: string[]
): Promise<{ rows: { bits_questions: unknown }[]; error: string | null }> {
  const keys = [...new Set(topicTitles.map((t) => normalizeSubtopicContentKey(t)).filter(Boolean))];
  if (keys.length === 0) return { rows: [], error: null };

  const all: { bits_questions: unknown }[] = [];
  for (const chunk of chunkStrings(keys, TOPIC_IN_CHUNK)) {
    const { data, error } = await db
      .from("subtopic_content")
      .select("bits_questions")
      .eq("board", BOARD)
      .eq("subject", subject)
      .eq("class_level", classLevel)
      .in("topic", chunk);
    if (error) return { rows: [], error: error.message };
    if (data?.length) all.push(...data);
  }
  return { rows: all, error: null };
}

/**
 * Counts MCQs in `subtopic_content.bits_questions` for the selected syllabus topic(s)
 * (all levels: basics / intermediate / advanced rows are included).
 */
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
    return NextResponse.json({ error: "Sign in to count the question bank." }, { status: 401 });
  }

  const admin = createAdminClient();
  const db = admin ?? supabaseUser;

  const titles = match.topicTitles;

  const { rows, error } = await fetchBitsRowsForTopicsIn(db, subject, classLevel, titles);
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
  let count = sumBitsQuestions(rows);
  let scanned = rows.length;

  if (count === 0 && classLevel === 11) {
    const r2 = await fetchBitsRowsForTopicsIn(db, subject, 12, titles);
    if (!r2.error && r2.rows.length) {
      count = sumBitsQuestions(r2.rows);
      scanned = r2.rows.length;
    }
  } else if (count === 0 && classLevel === 12) {
    const r2 = await fetchBitsRowsForTopicsIn(db, subject, 11, titles);
    if (!r2.error && r2.rows.length) {
      count = sumBitsQuestions(r2.rows);
      scanned = r2.rows.length;
    }
  }

  return NextResponse.json({
    count,
    error: null,
    scanned,
    source: "subtopic_content.bits_questions",
  });
}
