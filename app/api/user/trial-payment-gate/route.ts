import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import {
  explainTrialGateDecision,
  isTrialGateAudience,
} from "@/lib/subscription/dashboardTrialPopups";
import { fetchSubscriptionConfig } from "@/lib/subscription/subscriptionConfig";
import {
  expiredBonusMonthProfileUpdates,
  isBonusMonthExpired,
  profileNowMs,
  type TrialAccessProfile,
} from "@/lib/subscription/trialLifecycle";

const GATE_PROFILE_SELECT =
  "role, plan_tier, free_trial_activated, free_trial_activated_at, created_at, trial_second_round_activated, trial_end_bonus_activated, trial_original_ended_at, time_travel_offset_ms, subscription_started_at, subscription_expires_at, card_added_at";

/** GET — server truth for whether the trial-end payment gate must show. */
export async function GET(request: Request) {
  const auth = await getSupabaseAndUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { supabase, user } = auth;
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(GATE_PROFILE_SELECT)
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

  const cfg = await fetchSubscriptionConfig(supabase);
  const nowMs = profileNowMs(profile as TrialAccessProfile);
  let working = profile as TrialAccessProfile;

  if (isBonusMonthExpired(working, nowMs, cfg)) {
    const persist = expiredBonusMonthProfileUpdates();
    const { error: persistErr } = await supabase
      .from("profiles")
      .update(persist)
      .eq("id", user.id);
    if (!persistErr) {
      working = { ...working, ...persist };
    }
  }

  const decision = explainTrialGateDecision(working, nowMs, cfg);

  return NextResponse.json({
    required: decision.show,
    blockers: decision.blockers,
    nowMs,
    plan_tier: working.plan_tier,
    free_trial_activated: working.free_trial_activated,
    free_trial_activated_at: working.free_trial_activated_at,
    trial_end_bonus_activated: working.trial_end_bonus_activated,
  });
}
