import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { GYAN_STUDENT_PERSONAS, PROF_PI_CONFIG } from "@/lib/gyanBotPersonas";

const SEED_PASSWORD = process.env.GYAN_BOT_SEED_PASSWORD?.trim() || "GyanBotSeed2025!";

/**
 * Idempotent: creates 12 student + 1 ProfPi auth users with fixed UUIDs and upserts profiles.
 */
export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Service role not configured" }, { status: 500 });
    }

    const rows = [
      ...GYAN_STUDENT_PERSONAS.map((p) => ({
        id: p.userId,
        email: p.email,
        name: p.name,
        role: "student" as const,
      })),
      {
        id: PROF_PI_CONFIG.userId,
        email: PROF_PI_CONFIG.email,
        name: PROF_PI_CONFIG.name,
        role: PROF_PI_CONFIG.role,
      },
    ];

    const created: string[] = [];
    const skipped: string[] = [];

    const { data: listData, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 });
    }
    const allUsers = listData?.users ?? [];

    for (const row of rows) {
      const byEmail = allUsers.find((u) => u.email?.toLowerCase() === row.email.toLowerCase());
      if (byEmail) {
        await admin.from("profiles").upsert(
          {
            id: byEmail.id,
            name: row.name,
            role: row.role,
            rdm: 5000,
            lifetime_answer_rdm: row.role === "ai" ? 0 : 200,
            onboarding_complete: true,
          },
          { onConflict: "id" }
        );
        skipped.push(row.email);
        continue;
      }

      const { error: createErr } = await admin.auth.admin.createUser({
        id: row.id,
        email: row.email,
        password: SEED_PASSWORD,
        email_confirm: true,
        user_metadata: { name: row.name },
      });

      if (createErr) {
        console.error("[seed-gyan-bot-personas] createUser", row.email, createErr);
        return NextResponse.json(
          { error: createErr.message, email: row.email },
          { status: 500 }
        );
      }

      await admin.from("profiles").upsert(
        {
          id: row.id,
          name: row.name,
          role: row.role,
          rdm: 5000,
          lifetime_answer_rdm: row.role === "ai" ? 0 : 200,
          onboarding_complete: true,
        },
        { onConflict: "id" }
      );
      created.push(row.email);
    }

    return NextResponse.json({
      ok: true,
      created,
      skippedExistingEmail: skipped,
      hint: "Bots use GYAN_BOT_SEED_PASSWORD from env (or default). Never log in as bots in production.",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
