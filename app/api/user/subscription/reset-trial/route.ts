import { NextResponse } from "next/server";
import { createClient, createClientWithToken } from "@/integrations/supabase/server";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";

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
  return user ? { supabase: cookieClient, user } : null;
}

/**
 * Demo/admin helper: re-arm the free trial to a clean Day 1.
 * Keeps `trial_onboarding_answers` so the wizard is not required again.
 * Clears site-tour progress, Day 2–10 streak, time-travel, and trial-end card/bonus state
 * so the Day 14 card popup can be demoed again after a new time-travel jump.
 */
export async function POST(request: Request) {
  try {
    const csrf = enforceSameOriginForCookieAuth(request);
    if (csrf) return csrf;

    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;

    const activatedAt = new Date().toISOString();

    const { error } = await supabase
      .from("profiles")
      .update({
        plan_tier: "free_trial",
        free_trial_activated: true,
        free_trial_activated_at: activatedAt,
        onboarding_reward_progress: {},
        onboarding_reward_claimed_at: null,
        free_trial_daily_streak: {},
        time_travel_offset_ms: 0,
        trial_end_bonus_activated: false,
        trial_second_round_activated: false,
        trial_original_ended_at: null,
        trial_streak_at_day_14: null,
        card_added_at: null,
        payment_card_details: null,
        subscription_started_at: null,
      })
      .eq("id", user.id);

    if (error) {
      console.error("reset-trial POST error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      free_trial_activated_at: activatedAt,
      trial_end_bonus_activated: false,
      time_travel_offset_ms: 0,
      plan_tier: "free_trial",
    });
  } catch (e) {
    console.error("reset-trial POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
