import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { computeAccountState, parseGovernanceMeta } from "@/lib/adminGovernance";
import type { Json } from "@/integrations/supabase/types";

function jsonArrayLen(value: Json | null | undefined): number {
  return Array.isArray(value) ? value.length : 0;
}

function jsonObjectLen(value: Json | null | undefined): number {
  if (!value || Array.isArray(value) || typeof value !== "object") return 0;
  return Object.keys(value as Record<string, unknown>).length;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const userId = id?.trim();
    if (!userId) return NextResponse.json({ error: "Invalid user id" }, { status: 400 });

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const [authRes, profileRes, doubtsRes, aiRes] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
      admin.from("doubts").select("id, created_at, is_resolved, views").eq("user_id", userId),
      admin.from("ai_token_logs").select("id, created_at, prompt_tokens, candidates_tokens, total_tokens").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    ]);

    if (authRes.error || !authRes.data.user) {
      return NextResponse.json({ error: authRes.error?.message || "User not found" }, { status: 404 });
    }
    if (profileRes.error) return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
    if (doubtsRes.error) return NextResponse.json({ error: doubtsRes.error.message }, { status: 500 });
    if (aiRes.error) return NextResponse.json({ error: aiRes.error.message }, { status: 500 });

    const authUser = authRes.data.user;
    const profile = profileRes.data;
    const appMeta = parseGovernanceMeta(authUser.app_metadata);
    const status = computeAccountState({
      bannedUntil: authUser.banned_until,
      appMetadata: appMeta,
    });

    const doubts = doubtsRes.data ?? [];
    const aiLogs = aiRes.data ?? [];
    const monthlyMap = new Map<string, number>();
    for (const row of aiLogs) {
      const key = new Date(row.created_at).toISOString().slice(0, 7);
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + Number(row.total_tokens ?? 0));
    }

    return NextResponse.json({
      user: {
        id: authUser.id,
        email: authUser.email ?? null,
        role: profile?.role ?? null,
        name: profile?.name ?? null,
        createdAt: authUser.created_at ?? null,
        lastSignInAt: authUser.last_sign_in_at ?? null,
        status,
        bannedUntil: authUser.banned_until ?? null,
        suspendedUntil:
          typeof appMeta.admin_suspended_until === "string" ? appMeta.admin_suspended_until : null,
        deletedAt: typeof appMeta.admin_deleted_at === "string" ? appMeta.admin_deleted_at : null,
      },
      metrics: {
        rdm: Number(profile?.rdm ?? 0),
        lifetimeRdm: Number(profile?.lifetime_answer_rdm ?? 0),
        savedBits: jsonArrayLen((profile?.saved_bits as Json | null | undefined) ?? null),
        savedFormulas: jsonArrayLen((profile?.saved_formulas as Json | null | undefined) ?? null),
        savedRevisionCards: jsonArrayLen((profile?.saved_revision_cards as Json | null | undefined) ?? null),
        savedRevisionUnits: jsonArrayLen((profile?.saved_revision_units as Json | null | undefined) ?? null),
        bitsAttempts: jsonObjectLen((profile?.bits_test_attempts as Json | null | undefined) ?? null),
        subtopicEngagement: jsonObjectLen((profile?.subtopic_engagement as Json | null | undefined) ?? null),
        doubtsCreated: doubts.length,
        doubtsResolved: doubts.filter((d) => Boolean(d.is_resolved)).length,
        doubtViews: doubts.reduce((sum, d) => sum + Number(d.views ?? 0), 0),
        aiCalls: aiLogs.length,
        aiTotalTokens: aiLogs.reduce((sum, row) => sum + Number(row.total_tokens ?? 0), 0),
      },
      series: {
        aiTokensByMonth: Array.from(monthlyMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, tokens]) => ({ month, tokens })),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
