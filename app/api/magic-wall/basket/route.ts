import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

type InsertItem = {
  topicKey: string;
  board: string;
  subject: string;
  classLevel: number;
  examType: string | null;
  unitName: string;
  chapterTitle: string;
  topicName: string;
};

function clean(value: unknown, maxLen = 240): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\x00-\x1F\x7F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function normalizeTopicKey(value: unknown): string {
  return clean(value, 400).toLowerCase();
}

function normalizeInsertItems(raw: unknown): InsertItem[] {
  if (!Array.isArray(raw)) return [];
  const out: InsertItem[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const topicKey = normalizeTopicKey(o.topicKey);
    if (!topicKey || seen.has(topicKey)) continue;
    const board = clean(o.board, 10).toUpperCase();
    const subject = clean(o.subject, 40).toLowerCase();
    const classLevel = Number(o.classLevel) === 12 ? 12 : 11;
    const examTypeRaw = clean(o.examType, 30);
    const examType =
      examTypeRaw === "JEE" ||
      examTypeRaw === "JEE_Mains" ||
      examTypeRaw === "JEE_Advance" ||
      examTypeRaw === "NEET" ||
      examTypeRaw === "KCET" ||
      examTypeRaw === "other"
        ? examTypeRaw
        : null;
    const unitName = clean(o.unitName, 200);
    const chapterTitle = clean(o.chapterTitle, 200);
    const topicName = clean(o.topicName, 220);
    if (!topicName) continue;
    if (subject !== "physics" && subject !== "chemistry" && subject !== "math" && subject !== "biology") continue;
    out.push({
      topicKey,
      board: board === "ICSE" ? "ICSE" : "CBSE",
      subject,
      classLevel,
      examType,
      unitName,
      chapterTitle,
      topicName,
    });
    seen.add(topicKey);
  }
  return out;
}

function normalizeTopicKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const key = normalizeTopicKey(item);
    if (!key || seen.has(key)) continue;
    out.push(key);
    seen.add(key);
  }
  return out.slice(0, 500);
}

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;
    const db = supabase as any;
    const { data, error } = await db
      .from("magic_wall_basket_items")
      .select(
        "id, topic_key, board, subject, class_level, exam_type, unit_name, chapter_title, topic_name, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const items = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id,
      topicKey: row.topic_key,
      board: row.board,
      subject: row.subject,
      classLevel: row.class_level,
      examType: row.exam_type,
      unitName: row.unit_name,
      chapterTitle: row.chapter_title,
      topicName: row.topic_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    return NextResponse.json({ items });
  } catch (e) {
    console.error("magic-wall basket GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;
    const body = (await request.json().catch(() => null)) as { items?: unknown } | null;
    const items = normalizeInsertItems(body?.items);
    if (items.length === 0) return NextResponse.json({ ok: true, count: 0 });
    const nowIso = new Date().toISOString();
    const payload = items.map((item) => ({
      user_id: user.id,
      topic_key: item.topicKey,
      board: item.board,
      subject: item.subject,
      class_level: item.classLevel,
      exam_type: item.examType,
      unit_name: item.unitName || null,
      chapter_title: item.chapterTitle || null,
      topic_name: item.topicName,
      updated_at: nowIso,
    }));
    const db = supabase as any;
    const { error } = await db
      .from("magic_wall_basket_items")
      .upsert(payload, { onConflict: "user_id,topic_key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, count: payload.length });
  } catch (e) {
    console.error("magic-wall basket POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;
    const body = (await request.json().catch(() => null)) as { topicKeys?: unknown } | null;
    const topicKeys = normalizeTopicKeys(body?.topicKeys);
    if (topicKeys.length === 0) return NextResponse.json({ ok: true, count: 0 });
    const db = supabase as any;
    const { error } = await db
      .from("magic_wall_basket_items")
      .delete()
      .eq("user_id", user.id)
      .in("topic_key", topicKeys);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, count: topicKeys.length });
  } catch (e) {
    console.error("magic-wall basket DELETE error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
