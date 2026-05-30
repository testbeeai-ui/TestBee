import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import type { DifficultyLevel } from "@/lib/slugs";
import type { Board, Subject } from "@/types";
import {
  normalizeBoardParam,
  type LearningDwellPanel,
  type LearningDwellScope,
} from "@/lib/dashboard/learningDwellTelemetry";

const SUBJECTS = new Set<string>(["physics", "chemistry", "math"]);
const LEVELS = new Set<DifficultyLevel>(["basics", "intermediate", "advanced"]);
const PANELS = new Set<LearningDwellPanel>(["theory", "bits", "numerals", "instacue"]);
/** Skip DB write when still on same subtopic/panel (reduces Supabase churn + buddy realtime noise). */
const PRESENCE_HEARTBEAT_MS = 2 * 60 * 1000;

function sanitizeText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function parseScope(raw: unknown): LearningDwellScope | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const board = normalizeBoardParam(String(o.board ?? ""));
  const subject = sanitizeText(o.subject, 40).toLowerCase();
  const classLevel = Number(o.classLevel);
  const topic = sanitizeText(o.topic, 300);
  const subtopicName = sanitizeText(o.subtopicName, 300);
  const level = sanitizeText(o.level, 30).toLowerCase();
  if (!SUBJECTS.has(subject)) return null;
  if (!LEVELS.has(level as DifficultyLevel)) return null;
  if (classLevel !== 11 && classLevel !== 12) return null;
  if (!topic || !subtopicName) return null;
  return {
    board,
    subject: subject as Subject,
    classLevel: classLevel as 11 | 12,
    topic,
    subtopicName,
    level: level as DifficultyLevel,
  };
}

/** POST /api/user/learning-presence — upsert current subtopic for Learning Buddy. */
export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;

    const body = (await request.json().catch(() => null)) as {
      scope?: unknown;
      panel?: unknown;
    } | null;

    const scope = parseScope(body?.scope);
    if (!scope) {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }

    const panel = sanitizeText(body?.panel, 20).toLowerCase();
    if (!PANELS.has(panel as LearningDwellPanel)) {
      return NextResponse.json({ error: "Invalid panel" }, { status: 400 });
    }

    type PresenceRow = {
      board: string;
      subject: string;
      class_level: number;
      topic: string;
      subtopic_name: string;
      level: string;
      panel: string;
      updated_at: string;
    };

    const { data: existing } = await supabase
      .from("student_learning_presence" as never)
      .select("board, subject, class_level, topic, subtopic_name, level, panel, updated_at")
      .eq("user_id" as never, user.id as never)
      .maybeSingle();

    const existingRow = existing as unknown as PresenceRow | null;
    const samePlace =
      existingRow != null &&
      existingRow.board === scope.board &&
      existingRow.subject === scope.subject &&
      existingRow.class_level === scope.classLevel &&
      existingRow.topic === scope.topic &&
      existingRow.subtopic_name === scope.subtopicName &&
      existingRow.level === scope.level &&
      existingRow.panel === (panel as LearningDwellPanel);

    const now = new Date().toISOString();

    if (samePlace && existingRow.updated_at) {
      const ageMs = Date.now() - new Date(existingRow.updated_at).getTime();
      if (ageMs >= 0 && ageMs < PRESENCE_HEARTBEAT_MS) {
        await supabase
          .from("student_learning_presence" as never)
          .update({ updated_at: now } as never)
          .eq("user_id" as never, user.id as never);
        return NextResponse.json({
          ok: true,
          updatedAt: now,
          skipped: true,
        });
      }
    }
    const { error } = await supabase.from("student_learning_presence" as never).upsert(
      {
        user_id: user.id,
        board: scope.board,
        subject: scope.subject,
        class_level: scope.classLevel,
        topic: scope.topic,
        subtopic_name: scope.subtopicName,
        level: scope.level,
        panel: panel as LearningDwellPanel,
        updated_at: now,
      } as never,
      { onConflict: "user_id" }
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, updatedAt: now, skipped: false });
  } catch (e) {
    console.error("learning-presence POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
