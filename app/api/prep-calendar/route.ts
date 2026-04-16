import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

const FIELDS = ["class", "revision", "mock", "doubt"] as const;
type ActivityField = (typeof FIELDS)[number];

function isActivityField(v: string): v is ActivityField {
  return (FIELDS as readonly string[]).includes(v);
}

function parseMonthParams(req: NextRequest): { y: number; m: number } | null {
  const url = new URL(req.url);
  const ys = url.searchParams.get("year");
  const ms = url.searchParams.get("month");
  if (!ys || !ms) return null;
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return null;
  return { y, m };
}

/** GET ?year=2026&month=4 — rows for that calendar month (inclusive). */
export async function GET(req: NextRequest) {
  const auth = await getSupabaseAndUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseMonthParams(req);
  if (!parsed) {
    return NextResponse.json({ error: "year and month query params required" }, { status: 400 });
  }

  const start = new Date(parsed.y, parsed.m - 1, 1);
  const end = new Date(parsed.y, parsed.m, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const startStr = `${parsed.y}-${pad(parsed.m)}-01`;
  const endStr = `${parsed.y}-${pad(parsed.m)}-${pad(end.getDate())}`;

  const url = new URL(req.url);
  const todayParam = url.searchParams.get("today");
  const todayForStreak =
    typeof todayParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(todayParam.trim())
      ? todayParam.trim()
      : null;

  const [{ data, error }, summaryRes] = await Promise.all([
    auth.supabase
      .from("prep_calendar_day_activity")
      .select("day, class_count, revision_count, mock_count, doubt_count")
      .eq("user_id", auth.user.id)
      .gte("day", startStr)
      .lte("day", endStr)
      .order("day", { ascending: true }),
    todayForStreak
      ? auth.supabase.rpc("get_prep_calendar_summary", { p_today: todayForStreak })
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (error) {
    console.error("[prep-calendar GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let summary: { streak: number; totalActiveDays: number } | null = null;
  if (todayForStreak && summaryRes.error) {
    console.error("[prep-calendar GET summary]", summaryRes.error.message);
  } else if (todayForStreak && summaryRes.data != null && typeof summaryRes.data === "object") {
    const s = summaryRes.data as { streak?: unknown; total_active_days?: unknown };
    summary = {
      streak: typeof s.streak === "number" ? s.streak : Number(s.streak) || 0,
      totalActiveDays:
        typeof s.total_active_days === "number" ? s.total_active_days : Number(s.total_active_days) || 0,
    };
  }

  return NextResponse.json({ days: data ?? [], summary });
}

/** POST { activity: 'class'|'revision'|'mock'|'doubt', day?: 'YYYY-MM-DD' } */
export async function POST(req: NextRequest) {
  const auth = await getSupabaseAndUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as { activity?: string; day?: string };
  const activity = typeof b.activity === "string" ? b.activity : "";
  if (!isActivityField(activity)) {
    return NextResponse.json({ error: "activity must be class, revision, mock, or doubt" }, { status: 400 });
  }

  let dayStr: string;
  if (typeof b.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.day)) {
    dayStr = b.day;
  } else {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    dayStr = `${y}-${m}-${d}`;
  }

  const { error } = await auth.supabase.rpc("increment_prep_calendar_day", {
    p_day: dayStr,
    p_field: activity,
  });

  if (error) {
    console.error("[prep-calendar POST rpc]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, day: dayStr, activity });
}
