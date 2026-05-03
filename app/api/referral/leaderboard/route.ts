import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { getIstWeekMondayDateString } from "@/lib/referralIst";

const LEADERBOARD_LIMIT = 20;

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  referralCount: number;
};

/**
 * Public aggregate: top referrers for the current IST week (no auth).
 */
export async function GET() {
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const weekStart = getIstWeekMondayDateString();

  const { data: rows, error } = await admin
    .from("referral_attributions")
    .select("referrer_user_id")
    .eq("credited_week_start_ist", weekStart);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const counts = new Map<string, number>();
  for (const r of rows ?? []) {
    const id = r.referrer_user_id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, LEADERBOARD_LIMIT);
  const ids = sorted.map(([id]) => id);
  if (ids.length === 0) {
    return NextResponse.json({ weekStartIst: weekStart, entries: [] as LeaderboardEntry[] });
  }

  const { data: profiles, error: pErr } = await admin.from("profiles").select("id, name").in("id", ids);

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name?.trim() || "Student"]));

  const entries: LeaderboardEntry[] = sorted.map(([userId, referralCount], i) => ({
    rank: i + 1,
    userId,
    name: nameById.get(userId) ?? "Student",
    referralCount,
  }));

  return NextResponse.json({ weekStartIst: weekStart, entries });
}
