import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import type { Json } from "@/integrations/supabase/types";

function monthKey(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return d.toISOString().slice(0, 7);
}

function jsonArrayLen(value: Json | null | undefined): number {
  return Array.isArray(value) ? value.length : 0;
}

function jsonObjectLen(value: Json | null | undefined): number {
  if (!value || Array.isArray(value) || typeof value !== "object") return 0;
  return Object.keys(value as Record<string, unknown>).length;
}

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const [{ data: profiles, error: profilesError }, { data: doubts, error: doubtsError }, { count: aiCalls, error: aiCountError }] =
      await Promise.all([
        admin
          .from("profiles")
          .select(
            "id, role, class_level, stream, rdm, lifetime_answer_rdm, created_at, updated_at, saved_bits, saved_formulas, saved_revision_cards, saved_revision_units, bits_test_attempts, subtopic_engagement"
          ),
        admin.from("doubts").select("id, is_resolved, created_at, views"),
        admin.from("ai_token_logs").select("*", { head: true, count: "exact" }),
      ]);

    if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 });
    if (doubtsError) return NextResponse.json({ error: doubtsError.message }, { status: 500 });
    if (aiCountError) return NextResponse.json({ error: aiCountError.message }, { status: 500 });

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const users = profiles ?? [];
    const doubtsRows = doubts ?? [];
    const students = users.filter((u) => u.role === "student");
    const teachers = users.filter((u) => u.role === "teacher");
    const admins = users.filter((u) => u.role === "admin");
    const active30d = users.filter((u) => {
      const ts = new Date(u.updated_at ?? u.created_at).getTime();
      return Number.isFinite(ts) && ts >= thirtyDaysAgo;
    }).length;

    const totalSavedBits = users.reduce((sum, u) => sum + jsonArrayLen(u.saved_bits), 0);
    const totalSavedFormulas = users.reduce((sum, u) => sum + jsonArrayLen(u.saved_formulas), 0);
    const totalSavedRevisionCards = users.reduce((sum, u) => sum + jsonArrayLen(u.saved_revision_cards), 0);
    const totalSavedRevisionUnits = users.reduce((sum, u) => sum + jsonArrayLen(u.saved_revision_units), 0);
    const totalSavedItems =
      totalSavedBits + totalSavedFormulas + totalSavedRevisionCards + totalSavedRevisionUnits;

    const bitsAttempts = users.reduce((sum, u) => sum + jsonObjectLen(u.bits_test_attempts), 0);
    const subtopicEngagement = users.reduce((sum, u) => sum + jsonObjectLen(u.subtopic_engagement), 0);

    const userGrowthMap = new Map<string, number>();
    for (const user of users) {
      const key = monthKey(user.created_at);
      userGrowthMap.set(key, (userGrowthMap.get(key) ?? 0) + 1);
    }
    const userGrowth = Array.from(userGrowthMap.entries())
      .filter(([month]) => month !== "unknown")
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month, count }));

    const doubtsMonthlyMap = new Map<string, number>();
    for (const d of doubtsRows) {
      const key = monthKey(d.created_at);
      doubtsMonthlyMap.set(key, (doubtsMonthlyMap.get(key) ?? 0) + 1);
    }
    const doubtsMonthly = Array.from(doubtsMonthlyMap.entries())
      .filter(([month]) => month !== "unknown")
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month, count }));

    const classMap = new Map<string, number>();
    for (const s of students) {
      const label = s.class_level ? `Class ${s.class_level}` : "Unknown";
      classMap.set(label, (classMap.get(label) ?? 0) + 1);
    }
    const classDistribution = Array.from(classMap.entries()).map(([name, value]) => ({ name, value }));

    const streamMap = new Map<string, number>();
    for (const s of students) {
      const label = s.stream || "Unknown";
      streamMap.set(label, (streamMap.get(label) ?? 0) + 1);
    }
    const streamDistribution = Array.from(streamMap.entries()).map(([name, value]) => ({ name, value }));

    const rdmByRole = [
      { role: "student", value: students.reduce((sum, u) => sum + Number(u.rdm ?? 0), 0) },
      { role: "teacher", value: teachers.reduce((sum, u) => sum + Number(u.rdm ?? 0), 0) },
      { role: "admin", value: admins.reduce((sum, u) => sum + Number(u.rdm ?? 0), 0) },
    ];

    const payload = {
      kpis: {
        totalUsers: users.length,
        studentUsers: students.length,
        teacherUsers: teachers.length,
        adminUsers: admins.length,
        active30d,
        totalRdm: users.reduce((sum, u) => sum + Number(u.rdm ?? 0), 0),
        lifetimeRdm: users.reduce((sum, u) => sum + Number(u.lifetime_answer_rdm ?? 0), 0),
        totalDoubts: doubtsRows.length,
        resolvedDoubts: doubtsRows.filter((d) => Boolean(d.is_resolved)).length,
        totalDoubtViews: doubtsRows.reduce((sum, d) => sum + Number(d.views ?? 0), 0),
        totalSavedItems,
        bitsAttempts,
        subtopicEngagement,
        aiCalls: aiCalls ?? 0,
      },
      series: {
        userGrowth,
        doubtsMonthly,
        classDistribution,
        streamDistribution,
        rdmByRole,
        savedContentBreakdown: [
          { name: "Saved Bits", value: totalSavedBits },
          { name: "Saved Formulas", value: totalSavedFormulas },
          { name: "InstaCue Cards", value: totalSavedRevisionCards },
          { name: "Revision Units", value: totalSavedRevisionUnits },
        ],
      },
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
