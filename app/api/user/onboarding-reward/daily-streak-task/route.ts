import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import { DAILY_TASK_IDS } from "@/lib/onboarding/dailyStreakClient";

export async function POST(request: NextRequest) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase } = ctx;

    const body = (await request.json()) as {
      trialDayNumber?: number;
      taskId?: string;
      reset?: boolean;
    };

    const trialDayNumber = Number(body.trialDayNumber);

    if (body.reset === true) {
      if (!Number.isInteger(trialDayNumber) || trialDayNumber < 2 || trialDayNumber > 10) {
        return NextResponse.json({ error: "invalid_day" }, { status: 400 });
      }

      const { data, error } = await (
        supabase as unknown as {
          rpc: (
            fn: string,
            args: Record<string, unknown>
          ) => Promise<{ data: unknown; error: { message: string } | null }>;
        }
      ).rpc("reset_free_trial_daily_streak_day", { p_day: trialDayNumber });

      if (error) {
        console.error("reset_free_trial_daily_streak_day error", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const result = (data ?? {}) as { ok?: boolean; error?: string; trial_day?: number };
      if (result?.ok !== true) {
        return NextResponse.json(
          { ok: false, error: result?.error ?? "reset_failed" },
          { status: 400 }
        );
      }

      return NextResponse.json({ ok: true, trialDay: result.trial_day ?? trialDayNumber });
    }

    const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
    if (!taskId || !(DAILY_TASK_IDS as readonly string[]).includes(taskId)) {
      return NextResponse.json({ error: "invalid_task_id" }, { status: 400 });
    }
    if (!Number.isInteger(trialDayNumber) || trialDayNumber < 2 || trialDayNumber > 10) {
      return NextResponse.json({ error: "invalid_day" }, { status: 400 });
    }

    const { data, error } = await (
      supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      }
    ).rpc("sync_free_trial_daily_streak_task", {
      p_day: trialDayNumber,
      p_task_id: taskId,
    });

    if (error) {
      console.error("sync_free_trial_daily_streak_task error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = (data ?? {}) as {
      ok?: boolean;
      noop?: boolean;
      already_claimed?: boolean;
      error?: string;
      expected_day?: number;
      task_ids?: string[];
      trial_day?: number;
    };

    if (result?.ok !== true) {
      return NextResponse.json(
        {
          ok: false,
          error: result?.error ?? "sync_failed",
          expectedDay: result?.expected_day,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      noop: Boolean(result.noop),
      alreadyClaimed: Boolean(result.already_claimed),
      taskIds: Array.isArray(result.task_ids) ? result.task_ids : [],
      trialDay: Number(result.trial_day) || trialDayNumber,
    });
  } catch (e) {
    console.error("daily-streak-task POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
