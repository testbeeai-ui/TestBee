import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import type { DifficultyLevel } from "@/lib/slugs";
import type { Board, Subject } from "@/types";
import {
  clampDeltaMs,
  normalizeBoardParam,
  type LearningDwellClientEvent,
  type LearningDwellPanel,
} from "@/lib/dashboard/learningDwellTelemetry";

const MAX_EVENTS = 25;

const SUBJECTS = new Set<string>(["physics", "chemistry", "math"]);
const LEVELS = new Set<DifficultyLevel>(["basics", "intermediate", "advanced"]);
const PANELS = new Set<LearningDwellPanel>(["theory", "bits", "numerals", "instacue"]);

function sanitizeText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function parseScope(raw: unknown): LearningDwellClientEvent["scope"] | null {
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

export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;

    const body = (await request.json().catch(() => null)) as {
      events?: unknown[];
      clientSessionId?: unknown;
    } | null;
    const rawList = Array.isArray(body?.events) ? body.events : [];
    if (rawList.length === 0) {
      return NextResponse.json({ error: "No events" }, { status: 400 });
    }
    const trimmed = rawList.slice(0, MAX_EVENTS);

    const clientSessionId =
      typeof body?.clientSessionId === "string"
        ? sanitizeText(body.clientSessionId, 80)
        : null;

    const rows: Array<{
      user_id: string;
      board: Board;
      subject: Subject;
      class_level: number;
      topic: string;
      subtopic_name: string;
      level: DifficultyLevel;
      panel: LearningDwellPanel;
      delta_ms: number;
      bits_question_index: number | null;
      client_session_id: string | null;
      occurred_at?: string;
    }> = [];

    for (const item of trimmed) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const ev = item as Record<string, unknown>;
      const scope = parseScope(ev.scope);
      if (!scope) continue;
      const panel = sanitizeText(ev.panel, 20).toLowerCase();
      if (!PANELS.has(panel as LearningDwellPanel)) continue;
      const deltaMs = clampDeltaMs(Number(ev.deltaMs));
      if (deltaMs <= 0) continue;
      let bitsIdx: number | null = null;
      if (panel === "bits" && ev.bitsQuestionIndex != null) {
        const bi = Number(ev.bitsQuestionIndex);
        if (Number.isInteger(bi) && bi >= 0 && bi < 10_000) bitsIdx = bi;
      }
      let occurredAt: string | undefined;
      if (typeof ev.occurredAt === "string") {
        const t = Date.parse(ev.occurredAt);
        if (Number.isFinite(t)) occurredAt = new Date(t).toISOString();
      }
      rows.push({
        user_id: user.id,
        board: scope.board,
        subject: scope.subject,
        class_level: scope.classLevel,
        topic: scope.topic,
        subtopic_name: scope.subtopicName,
        level: scope.level,
        panel: panel as LearningDwellPanel,
        delta_ms: deltaMs,
        bits_question_index: bitsIdx,
        client_session_id: clientSessionId,
        ...(occurredAt ? { occurred_at: occurredAt } : {}),
      });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid events" }, { status: 400 });
    }

    const { error } = await supabase.from("student_learning_dwell_events").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, inserted: rows.length });
  } catch (e) {
    console.error("learning-dwell POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
