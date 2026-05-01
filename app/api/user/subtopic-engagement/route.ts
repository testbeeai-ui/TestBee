import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import type { Json } from "@/integrations/supabase/types";
import type { SubtopicEngagementSnapshot } from "@/lib/subtopicEngagementService";
import { parseEngagementStore } from "@/lib/subtopicEngagementStoreParse";
import { makeSubtopicEngagementStorageKey } from "@/lib/subtopicEngagementStorageKey";
import type { Board, Subject } from "@/types";
import type { DifficultyLevel } from "@/lib/slugs";

type ProfileEngagementRow = { subtopic_engagement?: Json | null };

const ALLOWED_LEVELS = new Set(["basics", "intermediate", "advanced"]);
const MAX_ENGAGEMENT_KEYS = 300;

function sanitize(value: unknown, maxLen = 300): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function normalizeKeyPart(value: unknown, maxLen = 300): string {
  return sanitize(value, maxLen).toLowerCase();
}

function trimStore(
  store: Record<string, SubtopicEngagementSnapshot>
): Record<string, SubtopicEngagementSnapshot> {
  const entries = Object.entries(store);
  if (entries.length <= MAX_ENGAGEMENT_KEYS) return store;
  entries.sort((a, b) => {
    const at = Date.parse(a[1].updatedAt);
    const bt = Date.parse(b[1].updatedAt);
    return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
  });
  return Object.fromEntries(entries.slice(0, MAX_ENGAGEMENT_KEYS));
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
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const key = makeSubtopicEngagementStorageKey({
      board: board as Board,
      subject: subject as Subject,
      classLevel: classLevel as 11 | 12,
      topic,
      subtopicName,
      level: level as DifficultyLevel,
    });
    const row = data as ProfileEngagementRow | null;
    const store = parseEngagementStore(row?.subtopic_engagement);
    return NextResponse.json({ engagement: store[key] ?? null });
  } catch (e) {
    console.error("subtopic-engagement GET error", e);
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
    const snapshot = body?.snapshot as SubtopicEngagementSnapshot | undefined;

    if (
      !board ||
      !subject ||
      !topic ||
      !subtopicName ||
      Number.isNaN(classLevel) ||
      ![11, 12].includes(classLevel) ||
      !ALLOWED_LEVELS.has(level) ||
      !snapshot ||
      snapshot.v !== 1 ||
      !sanitize(snapshot.bitsSignature, 200) ||
      !sanitize(snapshot.updatedAt, 80)
    ) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    const key = makeSubtopicEngagementStorageKey({
      board: board as Board,
      subject: subject as Subject,
      classLevel: classLevel as 11 | 12,
      topic,
      subtopicName,
      level: level as DifficultyLevel,
    });
    const { data: profile, error: readErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

    const profileRow = profile as ProfileEngagementRow | null;
    const current = parseEngagementStore(profileRow?.subtopic_engagement);
    const next = trimStore({ ...current, [key]: snapshot });
    const { error: writeErr } = await supabase
      .from("profiles")
      .update({ subtopic_engagement: next } as never)
      .eq("id", user.id);
    if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("subtopic-engagement POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
