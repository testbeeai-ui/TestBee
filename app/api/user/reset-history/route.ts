import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { parseClassLevelFromBitsStorageKey } from "@/lib/dashboardChapterCompletion";
import type { Json } from "@/integrations/supabase/types";

/** `profiles.subtopic_engagement` keys: `board||subject||classLevel||topic||subtopic||level` */
function isClass11Or12EngagementKey(key: string): boolean {
  const parts = key.split("||");
  if (parts.length < 3) return false;
  const segment = String(parts[2] ?? "").trim();
  return segment === "11" || segment === "12";
}

/** Drop subtopic / chapter-quiz attempts for Class 11 & 12 (same key shape as `bits-attempts` API). */
function isClass11Or12BitsEntry(key: string, value: unknown): boolean {
  const fromKey = parseClassLevelFromBitsStorageKey(key);
  if (fromKey === 11 || fromKey === 12) return true;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const row = value as Record<string, unknown>;
    const n = Number(row.classLevel);
    if (n === 11 || n === 12) return true;
  }
  return false;
}

/**
 * Clears Class 11 & 12 lesson completion marks, subtopic engagement, and stored quiz (`bits_test_attempts`) rows.
 * Used by Magic Wall "Reset History" so Topic Rain / History / dashboards can start fresh for those classes.
 */
export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;

    const { error: delErr } = await supabase
      .from("student_lesson_mark_completions" as never)
      .delete()
      .eq("user_id", user.id)
      .in("class_level", [11, 12]);

    if (delErr) {
      console.error("reset-history delete completions", delErr);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("subtopic_engagement, bits_test_attempts")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) {
      console.error("reset-history fetch profile", profErr);
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    if (!prof) {
      return NextResponse.json({ ok: true });
    }

    const raw = prof.subtopic_engagement;
    const store =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};

    const nextEngagement: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(store)) {
      if (isClass11Or12EngagementKey(k)) continue;
      nextEngagement[k] = v;
    }

    const rawBits = (prof as { bits_test_attempts?: unknown }).bits_test_attempts;
    const bitsStore =
      rawBits && typeof rawBits === "object" && !Array.isArray(rawBits)
        ? (rawBits as Record<string, unknown>)
        : {};
    const nextBits: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(bitsStore)) {
      if (isClass11Or12BitsEntry(k, v)) continue;
      nextBits[k] = v;
    }

    const { error: updErr } = await supabase
      .from("profiles")
      .update({
        subtopic_engagement: nextEngagement as Json,
        bits_test_attempts: nextBits as Json,
      })
      .eq("id", user.id);

    if (updErr) {
      console.error("reset-history update profile", updErr);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("reset-history error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
