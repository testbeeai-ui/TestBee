import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

type BitsAttemptRecord = {
  board: string;
  subject: string;
  classLevel: 11 | 12;
  topic: string;
  subtopicName: string;
  level: "basics" | "intermediate" | "advanced";
  bitsSignature: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  selectedAnswers: Record<string, number>;
  submittedAt: string;
};

const ALLOWED_LEVELS = new Set(["basics", "intermediate", "advanced"]);
const MAX_ATTEMPT_KEYS = 400;

function sanitize(value: unknown, maxLen = 300): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\x00-\x1F\x7F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function normalizeKeyPart(value: unknown, maxLen = 300): string {
  return sanitize(value, maxLen).toLowerCase();
}

function makeAttemptKey(params: {
  board: string;
  subject: string;
  classLevel: number;
  topic: string;
  subtopicName: string;
  level: string;
}) {
  return [
    normalizeKeyPart(params.board, 40),
    normalizeKeyPart(params.subject, 80),
    String(params.classLevel),
    normalizeKeyPart(params.topic, 300),
    normalizeKeyPart(params.subtopicName, 300),
    normalizeKeyPart(params.level, 30),
  ].join("||");
}

function parseAttemptsStore(raw: unknown): Record<string, BitsAttemptRecord> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, BitsAttemptRecord> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const totalQuestions = Number(row.totalQuestions);
    const correctCount = Number(row.correctCount);
    const wrongCount = Number(row.wrongCount);
    const selectedAnswers =
      row.selectedAnswers && typeof row.selectedAnswers === "object" && !Array.isArray(row.selectedAnswers)
        ? (row.selectedAnswers as Record<string, unknown>)
        : {};
    const normalizedSelected: Record<string, number> = {};
    for (const [k, v] of Object.entries(selectedAnswers)) {
      const idx = Number(v);
      if (!Number.isInteger(idx) || idx < 0 || idx > 3) continue;
      normalizedSelected[String(k)] = idx;
    }
    const parsed: BitsAttemptRecord = {
      board: sanitize(row.board, 40),
      subject: sanitize(row.subject, 80).toLowerCase(),
      classLevel: Number(row.classLevel) === 12 ? 12 : 11,
      topic: sanitize(row.topic, 300),
      subtopicName: sanitize(row.subtopicName, 300),
      level: sanitize(row.level, 30) as BitsAttemptRecord["level"],
      bitsSignature: sanitize(row.bitsSignature, 200),
      totalQuestions: Number.isFinite(totalQuestions) ? Math.max(0, Math.trunc(totalQuestions)) : 0,
      correctCount: Number.isFinite(correctCount) ? Math.max(0, Math.trunc(correctCount)) : 0,
      wrongCount: Number.isFinite(wrongCount) ? Math.max(0, Math.trunc(wrongCount)) : 0,
      selectedAnswers: normalizedSelected,
      submittedAt: sanitize(row.submittedAt, 80),
    };
    if (!ALLOWED_LEVELS.has(parsed.level)) continue;
    if (!parsed.topic || !parsed.subtopicName || !parsed.bitsSignature || !parsed.submittedAt) continue;
    out[key] = parsed;
  }
  return out;
}

function trimAttemptStore(store: Record<string, BitsAttemptRecord>): Record<string, BitsAttemptRecord> {
  const entries = Object.entries(store);
  if (entries.length <= MAX_ATTEMPT_KEYS) return store;
  entries.sort((a, b) => {
    const at = Date.parse(a[1].submittedAt);
    const bt = Date.parse(b[1].submittedAt);
    return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
  });
  return Object.fromEntries(entries.slice(0, MAX_ATTEMPT_KEYS));
}

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;

    const { searchParams } = new URL(request.url);
    const board = sanitize(searchParams.get("board"), 40);
    const subject = sanitize(searchParams.get("subject"), 80).toLowerCase();
    const classLevel = Number(searchParams.get("classLevel"));
    const topic = sanitize(searchParams.get("topic"), 300);
    const subtopicName = sanitize(searchParams.get("subtopicName"), 300);
    const level = sanitize(searchParams.get("level"), 30).toLowerCase();

    if (
      !board ||
      !subject ||
      !topic ||
      !subtopicName ||
      Number.isNaN(classLevel) ||
      ![11, 12].includes(classLevel) ||
      !ALLOWED_LEVELS.has(level)
    ) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("bits_test_attempts")
      .eq("id", user.id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const key = makeAttemptKey({ board, subject, classLevel, topic, subtopicName, level });
    const store = parseAttemptsStore(data?.bits_test_attempts);
    return NextResponse.json({ attempt: store[key] ?? null });
  } catch (e) {
    console.error("bits-attempts GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;
    const body = await request.json();

    const board = sanitize(body?.board, 40);
    const subject = sanitize(body?.subject, 80).toLowerCase();
    const classLevel = Number(body?.classLevel);
    const topic = sanitize(body?.topic, 300);
    const subtopicName = sanitize(body?.subtopicName, 300);
    const level = sanitize(body?.level, 30).toLowerCase();
    const bitsSignature = sanitize(body?.bitsSignature, 200);
    const totalQuestions = Number(body?.totalQuestions);
    const correctCount = Number(body?.correctCount);
    const wrongCount = Number(body?.wrongCount);
    const selectedAnswersInput =
      body?.selectedAnswers && typeof body.selectedAnswers === "object" && !Array.isArray(body.selectedAnswers)
        ? (body.selectedAnswers as Record<string, unknown>)
        : {};

    const selectedAnswers: Record<string, number> = {};
    for (const [k, v] of Object.entries(selectedAnswersInput)) {
      const idx = Number(v);
      if (!Number.isInteger(idx) || idx < 0 || idx > 3) continue;
      selectedAnswers[String(k)] = idx;
    }

    if (
      !board ||
      !subject ||
      !topic ||
      !subtopicName ||
      !bitsSignature ||
      Number.isNaN(classLevel) ||
      ![11, 12].includes(classLevel) ||
      !ALLOWED_LEVELS.has(level) ||
      !Number.isFinite(totalQuestions) ||
      !Number.isFinite(correctCount) ||
      !Number.isFinite(wrongCount)
    ) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    const attempt: BitsAttemptRecord = {
      board,
      subject,
      classLevel: classLevel as 11 | 12,
      topic,
      subtopicName,
      level: level as BitsAttemptRecord["level"],
      bitsSignature,
      totalQuestions: Math.max(0, Math.trunc(totalQuestions)),
      correctCount: Math.max(0, Math.trunc(correctCount)),
      wrongCount: Math.max(0, Math.trunc(wrongCount)),
      selectedAnswers,
      submittedAt: new Date().toISOString(),
    };

    const key = makeAttemptKey({ board, subject, classLevel, topic, subtopicName, level });
    const { data: profile, error: readErr } = await supabase
      .from("profiles")
      .select("bits_test_attempts")
      .eq("id", user.id)
      .maybeSingle();
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

    const current = parseAttemptsStore(profile?.bits_test_attempts);
    const next = trimAttemptStore({ ...current, [key]: attempt });
    const { error: writeErr } = await supabase
      .from("profiles")
      .update({ bits_test_attempts: next } as never)
      .eq("id", user.id);
    if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, attempt });
  } catch (e) {
    console.error("bits-attempts POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
