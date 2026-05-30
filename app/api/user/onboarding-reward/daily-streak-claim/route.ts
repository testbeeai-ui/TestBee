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
      taskIds?: string[];
    };

    const trialDayNumber = Number(body.trialDayNumber);
    if (!Number.isInteger(trialDayNumber) || trialDayNumber < 2 || trialDayNumber > 10) {
      return NextResponse.json({ error: "invalid_day" }, { status: 400 });
    }

    const taskIds =
      Array.isArray(body.taskIds) && body.taskIds.length === DAILY_TASK_IDS.length
        ? body.taskIds
        : [...DAILY_TASK_IDS];

    const { data, error } = await (
      supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      }
    ).rpc("claim_free_trial_daily_streak_reward", {
      p_day: trialDayNumber,
      p_task_ids: taskIds,
    });

    if (error) {
      console.error("claim_free_trial_daily_streak_reward error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = (data ?? {}) as {
      ok?: boolean;
      already_claimed?: boolean;
      amount?: number;
      balance?: number;
      error?: string;
      expected_day?: number;
      trial_day?: number;
    };

    if (result?.ok !== true) {
      return NextResponse.json(
        {
          ok: false,
          error: result?.error ?? "claim_failed",
          expectedDay: result?.expected_day,
          amount: 0,
          balance: 0,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      alreadyClaimed: Boolean(result.already_claimed),
      amount: Number(result.amount) || 0,
      balance: Number(result.balance) || 0,
      trialDay: Number(result.trial_day) || trialDayNumber,
    });
  } catch (e) {
    console.error("daily-streak-claim POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
