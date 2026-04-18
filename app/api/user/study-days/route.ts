import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { computeStudyStreakFromDayMs } from "@/lib/studyStreakClient";

function parseIsoDate(s: string | null): string | null {
  if (!s || typeof s !== "string") return null;
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return t;
}

/** GET ?from=YYYY-MM-DD&to=YYYY-MM-DD&today=YYYY-MM-DD */
export async function GET(req: NextRequest) {
  const auth = await getSupabaseAndUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const from = parseIsoDate(url.searchParams.get("from"));
  const to = parseIsoDate(url.searchParams.get("to"));
  const today = parseIsoDate(url.searchParams.get("today")) ?? parseIsoDate(url.searchParams.get("to"));

  if (!from || !to) {
    return NextResponse.json({ error: "from and to query params (YYYY-MM-DD) are required" }, { status: 400 });
  }

  // Table/RPC from migration `20260418160000_user_study_day_totals.sql`; add to `Database` when types are regenerated.
  const sb = auth.supabase as any;
  const [{ data: rows, error }, summaryRes] = await Promise.all([
    sb
      .from("user_study_day_totals")
      .select("day, active_ms, presence_ms, updated_at")
      .eq("user_id", auth.user.id)
      .gte("day", from)
      .lte("day", to)
      .order("day", { ascending: true }),
    today ? sb.rpc("get_study_streak_summary", { p_today: today }) : Promise.resolve({ data: null, error: null }),
  ]);

  if (error) {
    console.error("[study-days GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let summary: { streak: number; activeDaysThisMonth: number } | null = null;
  if (today && summaryRes.error) {
    console.error("[study-days summary]", summaryRes.error.message);
  } else if (today && summaryRes.data != null && typeof summaryRes.data === "object") {
    const s = summaryRes.data as { streak?: unknown; activeDaysThisMonth?: unknown };
    summary = {
      streak: typeof s.streak === "number" ? s.streak : Number(s.streak) || 0,
      activeDaysThisMonth:
        typeof s.activeDaysThisMonth === "number"
          ? s.activeDaysThisMonth
          : Number(s.activeDaysThisMonth) || 0,
    };
  }

  if (today && summary == null && rows?.length) {
    const map = new Map<string, number>();
    for (const r of rows as { day?: string; active_ms?: number }[]) {
      if (r?.day && typeof r.active_ms === "number") map.set(r.day, Math.max(0, r.active_ms));
    }
    summary = computeStudyStreakFromDayMs(map, today);
  }

  return NextResponse.json({
    days: rows ?? [],
    summary,
  });
}

type BumpBody = { day?: string; deltaMs?: number; deltaPresenceMs?: number };

/**
 * POST study bump: `{ day, deltaMs }` → `add_user_study_day_ms` (streak / saved study time).
 * POST site dwell: `{ day, deltaPresenceMs }` → `add_user_site_presence_ms` (foreground tab time; capped server-side).
 */
export async function POST(req: NextRequest) {
  const auth = await getSupabaseAndUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: BumpBody;
  try {
    body = (await req.json()) as BumpBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const day = parseIsoDate(typeof body.day === "string" ? body.day : null);
  if (!day) {
    return NextResponse.json({ error: "day must be YYYY-MM-DD" }, { status: 400 });
  }

  const deltaPresenceMs = Number(body.deltaPresenceMs);
  const sbPost = auth.supabase as any;

  if (Number.isFinite(deltaPresenceMs) && deltaPresenceMs > 0) {
    const { error } = await sbPost.rpc("add_user_site_presence_ms", {
      p_day: day,
      p_delta_ms: Math.trunc(deltaPresenceMs),
    });
    if (error) {
      console.error("[study-days POST presence]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, kind: "presence" });
  }

  const deltaMs = Number(body.deltaMs);
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return NextResponse.json(
      { error: "Provide deltaMs (study) or deltaPresenceMs (site dwell), each a positive number" },
      { status: 400 }
    );
  }

  const { error } = await sbPost.rpc("add_user_study_day_ms", {
    p_day: day,
    p_delta_ms: Math.trunc(deltaMs),
  });

  if (error) {
    console.error("[study-days POST rpc]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, kind: "study" });
}
