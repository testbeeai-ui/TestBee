import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { getStudentPersonaByIndex } from "@/lib/gyanBotPersonas";
import { getGyanBotCapabilities, getGyanBotSetupWarnings } from "@/lib/gyanBotCapabilities";
import { runGyanBotPostCycle } from "@/lib/gyanBotPostCycle";

function missingTableHint(message: string): string | undefined {
  if (
    /relation ["'].*gyan_bot_config|does not exist|schema cache|could not find the table/i.test(message)
  ) {
    return "Apply the migration: open supabase/migrations/20260411130000_gyan_bot_config.sql in Supabase SQL Editor and run it, or run `supabase db push` from the project root.";
  }
  return undefined;
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
      return NextResponse.json(
        {
          error: "SUPABASE_SERVICE_ROLE_KEY is not set",
          code: "MISSING_SERVICE_ROLE",
          hint: "Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Dashboard → Project Settings → API). Admin bot routes need the service role on the server.",
        },
        { status: 500 }
      );
    }

    const { data, error } = await admin.from("gyan_bot_config").select("*").eq("id", 1).maybeSingle();
    if (error) {
      const hint = missingTableHint(error.message);
      console.error("[admin/gyan-bot GET]", error.code, error.message);
      return NextResponse.json(
        { error: error.message, code: error.code, hint },
        { status: hint ? 503 : 500 }
      );
    }

    const nextStudent = getStudentPersonaByIndex(data?.current_student_index ?? 0);
    const capabilities = getGyanBotCapabilities();
    const warnings = getGyanBotSetupWarnings(capabilities);

    return NextResponse.json({
      config: data,
      nextStudent: { name: nextStudent.name, index: data?.current_student_index ?? 0, subjectFocus: nextStudent.subjectFocus },
      capabilities,
      warnings,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      active?: boolean;
      interval_minutes?: number;
      /** Admin-only: run one bot cycle immediately (bypasses interval gate; still requires bot active). */
      run_one_cycle?: boolean;
    };

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json(
        {
          error: "SUPABASE_SERVICE_ROLE_KEY is not set",
          code: "MISSING_SERVICE_ROLE",
          hint: "Add SUPABASE_SERVICE_ROLE_KEY to .env.local for admin bot updates.",
        },
        { status: 500 }
      );
    }

    if (body.run_one_cycle === true) {
      const cycle = await runGyanBotPostCycle(admin, { bypassInterval: true });
      const { data: cfg } = await admin.from("gyan_bot_config").select("*").eq("id", 1).maybeSingle();
      if (!cycle.ok) {
        return NextResponse.json({ error: cycle.error, config: cfg }, { status: 500 });
      }
      const nextStudent = getStudentPersonaByIndex(cfg?.current_student_index ?? 0);
      return NextResponse.json({
        ok: true,
        cycle,
        config: cfg,
        nextStudent: {
          name: nextStudent.name,
          index: cfg?.current_student_index ?? 0,
          subjectFocus: nextStudent.subjectFocus,
        },
      });
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.active === "boolean") patch.active = body.active;
    if (typeof body.interval_minutes === "number" && Number.isFinite(body.interval_minutes)) {
      const m = Math.floor(body.interval_minutes);
      if (m >= 1 && m <= 1440) patch.interval_minutes = m;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "No valid fields (active, interval_minutes, or run_one_cycle: true)" },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("gyan_bot_config")
      .update(patch)
      .eq("id", 1)
      .select("*")
      .single();

    if (error) {
      const hint = missingTableHint(error.message);
      console.error("[admin/gyan-bot POST]", error.code, error.message);
      return NextResponse.json(
        { error: error.message, code: error.code, hint },
        { status: hint ? 503 : 500 }
      );
    }
    return NextResponse.json({ ok: true, config: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
