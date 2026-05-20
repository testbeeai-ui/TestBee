import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { requireAuthenticatedUser } from "@/lib/auth/securityGuards";

const LIMIT = 200;

/**
 * All referral attributions where the current user is the referrer (newest first).
 * Uses admin client to resolve referee display names (profiles RLS may block cross-user reads).
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const uid = auth.user.id;
  const { data: rows, error } = await admin
    .from("referral_attributions")
    .select("id, credited_at, credited_week_start_ist, referee_user_id")
    .eq("referrer_user_id", uid)
    .order("credited_at", { ascending: false })
    .limit(LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const refereeIds = [...new Set((rows ?? []).map((r) => r.referee_user_id))];
  const nameById = new Map<string, string>();
  if (refereeIds.length > 0) {
    const { data: profs } = await admin.from("profiles").select("id, name").in("id", refereeIds);
    for (const p of profs ?? []) {
      nameById.set(p.id, p.name?.trim() || "Student");
    }
  }

  return NextResponse.json({
    entries: (rows ?? []).map((r) => ({
      id: r.id,
      creditedAt: r.credited_at,
      creditedWeekStartIst: r.credited_week_start_ist,
      refereeName: nameById.get(r.referee_user_id) ?? "Student",
    })),
  });
}
