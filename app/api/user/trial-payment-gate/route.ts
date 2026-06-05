import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import {
  explainTrialGateDecision,
  isTrialGateAudience,
} from "@/lib/subscription/dashboardTrialPopups";

/** GET — server truth for whether the trial-end payment gate must show. */
export async function GET(request: Request) {
  const auth = await getSupabaseAndUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { supabase, user } = auth;
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "role, plan_tier, free_trial_activated, free_trial_activated_at, created_at, trial_second_round_activated, trial_end_bonus_activated, trial_original_ended_at, time_travel_offset_ms"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!profile || !isTrialGateAudience(profile.role)) {
    return NextResponse.json({
      required: false,
      blockers: ["not a student trial audience"],
    });
  }

  const nowMs =
    Date.now() + Math.max(0, Number(profile.time_travel_offset_ms ?? 0));
  const decision = explainTrialGateDecision(profile, nowMs);

  return NextResponse.json({
    required: decision.show,
    blockers: decision.blockers,
    nowMs,
    plan_tier: profile.plan_tier,
    free_trial_activated: profile.free_trial_activated,
    free_trial_activated_at: profile.free_trial_activated_at,
    trial_end_bonus_activated: profile.trial_end_bonus_activated,
  });
}
