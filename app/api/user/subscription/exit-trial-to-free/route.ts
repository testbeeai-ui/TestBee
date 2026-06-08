import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
  createClientWithToken,
} from "@/integrations/supabase/server";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import { isFreeTrialPeriodEndedForProfile } from "@/lib/subscription/freeTrialTimer";

async function getSupabaseAndUser(request: Request) {
  const cookieClient = await createClient();
  let user = (await cookieClient.auth.getUser()).data?.user ?? null;
  if (!user) {
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (token) {
      const {
        data: { user: u },
      } = await cookieClient.auth.getUser(token);
      user = u ?? null;
      if (user) {
        return { supabase: createClientWithToken(token), user };
      }
    }
  }
  return user ? { supabase: cookieClient, user } : { supabase: cookieClient, user: null };
}

/**
 * Investor rule: when a student's free trial ends and they choose NOT to claim
 * the bonus (i.e. don't go to Starter/Pro), we drop them to the Free plan and
 * stamp `trial_original_ended_at` with the wall-clock instant the trial
 * actually ended. The 2-month calendar cap in {@link freePlanCap} is measured
 * from that timestamp.
 *
 * Idempotent: calling it twice is a no-op. Also refuses to run if the trial
 * is still active or if the user has already been moved to a paid plan.
 */
export async function POST(request: Request) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx || !ctx.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- profile columns ahead of generated types
    const { data: profileRowRaw, error: profileErr } = await (supabase as any)
      .from("profiles")
      .select(
        "plan_tier, free_trial_activated, free_trial_activated_at, created_at, trial_second_round_activated, trial_original_ended_at, trial_end_bonus_activated, time_travel_offset_ms"
      )
      .eq("id", user.id)
      .maybeSingle();
    const profileRow = profileRowRaw as {
      plan_tier?: string | null;
      free_trial_activated?: boolean | null;
      free_trial_activated_at?: string | null;
      created_at?: string | null;
      trial_second_round_activated?: boolean | null;
      trial_original_ended_at?: string | null;
      trial_end_bonus_activated?: boolean | null;
      time_travel_offset_ms?: number | null;
    } | null;

    if (profileErr) {
      console.error("exit-trial-to-free: read error", profileErr);
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    const currentTier = String(profileRow?.plan_tier ?? "")
      .trim()
      .toLowerCase();
    if (currentTier === "starter" || currentTier === "pro") {
      return NextResponse.json(
        { error: "Cannot exit trial to Free — user is on a paid plan." },
        { status: 409 }
      );
    }

    if (
      currentTier === "free" &&
      profileRow?.free_trial_activated === false &&
      profileRow?.trial_original_ended_at
    ) {
      return NextResponse.json({
        ok: true,
        plan_tier: "free",
        trial_original_ended_at: profileRow.trial_original_ended_at,
      });
    }

    const simulatedNow = Date.now() + Math.max(0, Number(profileRow?.time_travel_offset_ms ?? 0));
    const trialEnded = isFreeTrialPeriodEndedForProfile(
      {
        free_trial_activated_at: profileRow?.free_trial_activated_at,
        free_trial_activated: profileRow?.free_trial_activated,
        created_at: profileRow?.created_at,
        trial_second_round_activated: profileRow?.trial_second_round_activated,
      },
      simulatedNow
    );

    if (!trialEnded) {
      return NextResponse.json({ error: "Free trial period has not ended yet." }, { status: 400 });
    }

    // Stamp the transition moment (matches the existing semantic used by
    // claim-bonus). The 2-month cap measures calendar months from this point.
    const nowIso = new Date().toISOString();

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const { error: updateErr } = await admin
      .from("profiles")
      .update({
        plan_tier: "free",
        free_trial_activated: false,
        trial_second_round_activated: false,
        trial_original_ended_at: nowIso,
      })
      .eq("id", user.id);

    if (updateErr) {
      console.error("exit-trial-to-free: update error", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      plan_tier: "free",
      trial_original_ended_at: nowIso,
    });
  } catch (e) {
    console.error("exit-trial-to-free POST error", e);
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
